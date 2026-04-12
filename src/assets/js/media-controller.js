/**
 * Media Controller
 *
 * Handles two modes via the media facade:
 *
 * 1. Audio episodes — hidden <audio> element, play/pause button on cover art,
 *    SVG circular progress ring animates during playback.
 * 2. Video episodes — click-to-play facade swaps in a <video> element,
 *    facade hides, video plays natively.
 *
 * Both share the same facade markup (cover art + play button + progress ring).
 * The `data-media-type` attribute on .media-facade determines behavior.
 *
 * Features:
 * - Media Session API for system controls
 * - localStorage position persistence
 * - Re-initializes cleanly after episode-nav transitions
 */

const STORAGE_KEY = 'heht-media-position';
const RING_CIRCUMFERENCE = 2 * Math.PI * 54; // r=54 in the SVG

let activeController = null;
let chaptersDelegationBound = false;

// Global click delegation for chapter seek buttons. Bound once on first
// init and never re-bound — chapter markup is re-rendered on every
// episode nav, but since we delegate from the document, new buttons
// work immediately without re-binding.
function bindChaptersDelegation() {
  if (chaptersDelegationBound) return;
  chaptersDelegationBound = true;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.chapters__item[data-seek]');
    if (!btn) return;
    if (!activeController) return;
    const seconds = parseFloat(btn.dataset.seek);
    if (!Number.isFinite(seconds)) return;

    // Video episodes don't create the <video> element until the facade
    // is clicked. Stash the target time as the resume position and
    // activate the video — the loadedmetadata handler will honor it.
    if (activeController.mediaType === 'video' && !activeController.el) {
      activeController._resumePosition = seconds;
      activeController._activateVideo();
      return;
    }
    if (!activeController.el) return;

    activeController.seek(seconds);
    // Chapter click is a strong play intent — start playback if paused.
    if (activeController.el.paused) activeController.play();
  });
}

export function initMediaController() {
  bindChaptersDelegation();
  // Clean up previous controller
  if (activeController) {
    activeController.destroy();
    activeController = null;
  }

  const facade = document.querySelector('.media-facade');
  if (!facade) return null;

  const mediaType = facade.dataset.mediaType; // 'audio' or 'video'

  const controller = {
    facade,
    el: null, // the <audio> or <video> element
    mediaType,
    _resumePosition: 0,
    _raf: null,
    _lastSavedSecond: -1,
    _scrubRect: null,

    init() {
      if (mediaType === 'audio') {
        this._initAudio();
      }
      this._bindFacade();
      this._restorePosition();
      return this;
    },

    destroy() {
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this.el) {
        this.el.pause();
        this.el.remove();
      }
    },

    // ── Audio setup ──────────────────────────────────────────
    _initAudio() {
      const src = this.facade.dataset.audioSrc;
      if (!src) return;

      const audio = document.createElement('audio');
      audio.id = 'media-player';
      audio.preload = 'metadata';
      audio.src = src;

      // Add captions track if available
      const captionsSrc = this.facade.dataset.captions;
      if (captionsSrc) {
        const track = document.createElement('track');
        track.kind = 'captions';
        track.src = captionsSrc;
        track.srclang = 'en';
        track.label = 'English';
        audio.appendChild(track);
      }

      // Hidden — facade provides the visual UI
      audio.style.display = 'none';
      this.facade.appendChild(audio);
      this.el = audio;

      this._bindMediaEvents();
      this._setupMediaSession();
    },

    // ── Facade interaction ───────────────────────────────────
    _bindFacade() {
      const playBtn = this.facade.querySelector('.media-facade__play');
      if (!playBtn) return;

      this._scrubbing = false;
      this._scrubMoved = false;

      playBtn.addEventListener('click', (e) => {
        // Ignore click if we just finished a scrub drag
        if (this._scrubMoved) return;

        if (this.mediaType === 'video') {
          this._activateVideo();
        } else {
          this.toggle();
        }
      });

      // Scrub: drag on the ring to seek (audio only)
      if (this.mediaType === 'audio') {
        this._bindScrub(playBtn);
      }
    },

    // ── Ring scrub (drag to seek) ────────────────────────────
    _bindScrub(playBtn) {
      const ring = this.facade.querySelector('.media-facade__ring');
      if (!ring) return;

      const onDown = (e) => {
        if (!this.el || !this.el.duration) return;
        // Don't call e.preventDefault() here — it suppresses the
        // subsequent click event (per spec), which kills the
        // play/pause toggle. The _scrubMoved flag already
        // distinguishes drags from clicks without needing to
        // cancel default behavior.
        this._scrubbing = true;
        this._scrubMoved = false;
        // Cache the ring rect once per drag. getBoundingClientRect
        // forces layout, and running it on every pointermove during a
        // scrub is a measurable hot path on lower-end devices.
        this._scrubRect = playBtn.getBoundingClientRect();
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      };

      const onMove = (e) => {
        if (!this._scrubbing) return;
        // Prevent text selection / default drag behavior during scrub.
        // This is safe on pointermove (doesn't cancel click like
        // pointerdown.preventDefault does).
        e.preventDefault();
        this._scrubMoved = true;
        this._scrubSeek(e);
      };

      const onUp = () => {
        this._scrubbing = false;
        this._scrubRect = null;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        // Reset scrubMoved flag after click event fires
        requestAnimationFrame(() => { this._scrubMoved = false; });
      };

      playBtn.addEventListener('pointerdown', onDown);
    },

    _scrubSeek(e) {
      if (!this.el || !this.el.duration || !this._scrubRect) return;

      const rect = this._scrubRect;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // Angle from center, with 12 o'clock = 0 (matching ring rotation)
      let angle = Math.atan2(e.clientX - cx, -(e.clientY - cy));
      if (angle < 0) angle += 2 * Math.PI;

      const progress = angle / (2 * Math.PI);
      this.seek(progress * this.el.duration);
      this._updateRing();
    },

    // ── Video facade → real <video> swap ─────────────────────
    _activateVideo() {
      const slide = this.facade.closest('.video-panel__slide');
      if (!slide) return;

      const video = document.createElement('video');
      video.id = 'media-player';
      video.preload = 'metadata';
      video.playsInline = true;
      video.autoplay = true;

      // Poster from the existing cover image
      const cover = this.facade.querySelector('.media-facade__cover');
      if (cover) video.poster = cover.src;

      // Primary source
      const src = document.createElement('source');
      src.src = this.facade.dataset.videoSrc;
      src.type = this.facade.dataset.videoType || 'video/mp4';
      video.appendChild(src);

      // HLS source (if available)
      const hlsSrc = this.facade.dataset.videoHls;
      if (hlsSrc) {
        const hlsSource = document.createElement('source');
        hlsSource.src = hlsSrc;
        hlsSource.type = 'application/x-mpegURL';
        video.appendChild(hlsSource);
      }

      // Captions
      const captionsSrc = this.facade.dataset.captions;
      if (captionsSrc) {
        const track = document.createElement('track');
        track.kind = 'captions';
        track.src = captionsSrc;
        track.srclang = 'en';
        track.label = 'English';
        track.default = true;
        video.appendChild(track);
      }

      // Style to fill the panel
      video.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;max-width:none;cursor:pointer';

      // Insert video and hide facade
      slide.appendChild(video);
      this.facade.classList.add('is-video-active');
      this.el = video;

      // Click-to-toggle on video
      video.addEventListener('click', () => this.toggle());

      this._bindMediaEvents();
      this._setupMediaSession();
    },

    // ── Playback controls ────────────────────────────────────
    play() {
      if (!this.el) return;
      const p = this.el.play();
      if (p && p.catch) p.catch(() => {});
    },

    pause() {
      if (this.el) this.el.pause();
    },

    toggle() {
      if (!this.el) return;
      if (this.el.paused) {
        this.play();
      } else {
        this.pause();
      }
    },

    seek(time) {
      if (!this.el) return;
      this.el.currentTime = Math.max(0, Math.min(time, this.el.duration || 0));
    },

    skipBack(seconds = 15) {
      this.seek(this.el.currentTime - seconds);
    },

    skipForward(seconds = 30) {
      this.seek(this.el.currentTime + seconds);
    },

    // ── Progress ring (audio only) ───────────────────────────
    _updateRing() {
      if (this.mediaType !== 'audio' || !this.el) return;

      const ring = this.facade.querySelector('.media-facade__ring-progress');
      if (!ring) return;

      const progress = this.el.duration ? this.el.currentTime / this.el.duration : 0;
      const offset = RING_CIRCUMFERENCE * (1 - progress);
      ring.style.strokeDashoffset = offset;
    },

    _startRingLoop() {
      if (this.mediaType !== 'audio') return;
      const tick = () => {
        this._updateRing();
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    },

    _stopRingLoop() {
      if (this._raf) {
        cancelAnimationFrame(this._raf);
        this._raf = null;
      }
      // One final update so ring lands on the exact position
      this._updateRing();
    },

    // ── Position persistence ─────────────────────────────────
    _getStorageKey() {
      return `${STORAGE_KEY}:${window.location.pathname}`;
    },

    _restorePosition() {
      try {
        const saved = localStorage.getItem(this._getStorageKey());
        if (saved) {
          const pos = parseFloat(saved);
          if (pos > 0 && isFinite(pos)) {
            this._resumePosition = pos;
          }
        }
      } catch (e) {}
    },

    _savePosition() {
      try {
        if (this.el && this.el.currentTime > 0) {
          localStorage.setItem(this._getStorageKey(), String(this.el.currentTime));
          this._lastSavedSecond = Math.floor(this.el.currentTime);
        }
      } catch (e) {}
    },

    // ── Media events ─────────────────────────────────────────
    _bindMediaEvents() {
      if (!this.el) return;

      this.el.addEventListener('loadedmetadata', () => {
        if (this._resumePosition > 0 && this._resumePosition < this.el.duration) {
          this.el.currentTime = this._resumePosition;
        }
        // Update ring to restored position
        this._updateRing();
      });

      this.el.addEventListener('play', () => {
        this.facade.classList.add('is-playing');
        this._startRingLoop();
      });

      this.el.addEventListener('pause', () => {
        this.facade.classList.remove('is-playing');
        this._stopRingLoop();
        this._savePosition();
      });

      this.el.addEventListener('ended', () => {
        this.facade.classList.remove('is-playing');
        this._stopRingLoop();
        try {
          localStorage.removeItem(this._getStorageKey());
        } catch (e) {}
      });

      this.el.addEventListener('timeupdate', () => {
        // Save at most once per integer second divisible by 5.
        // `timeupdate` fires ~4x/sec, so the raw mod check would write
        // to localStorage several times inside the same matching second.
        const second = Math.floor(this.el.currentTime);
        if (second % 5 === 0 && second !== this._lastSavedSecond) {
          this._savePosition();
        }
      });
    },

    // ── Media Session API ────────────────────────────────────
    _setupMediaSession() {
      if (!('mediaSession' in navigator) || !this.el) return;

      const title = document.querySelector('.detail__title');
      const eyebrow = document.querySelector('.detail__eyebrow');
      const cover = this.facade.querySelector('.media-facade__cover');

      navigator.mediaSession.metadata = new MediaMetadata({
        title: title ? title.textContent.trim() : document.title,
        artist: 'Higher Ed Hot Takes',
        album: eyebrow ? eyebrow.textContent.trim() : '',
        artwork: cover ? [{ src: cover.src, sizes: '512x512', type: 'image/jpeg' }] : [],
      });

      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => this.skipBack());
      navigator.mediaSession.setActionHandler('seekforward', () => this.skipForward());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) this.seek(details.seekTime);
      });
    },
  };

  activeController = controller.init();
  return activeController;
}

// Expose for re-init after episode nav transitions
window.initMediaController = initMediaController;
