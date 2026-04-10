/**
 * Media Controller
 *
 * Unified playback module for audio and video episodes.
 * Owns the <video> or <img> element already in the video-panel__slide.
 *
 * Features:
 * - Play/pause via click on the media element
 * - Media Session API for system controls
 * - localStorage position persistence
 * - Falls back gracefully when no media element exists
 */

const STORAGE_KEY = 'heht-media-position';

export function initMediaController() {
  const media = document.getElementById('media-player');
  if (!media) return null;

  const controller = {
    el: media,
    _resumePosition: 0,

    init() {
      this._restorePosition();
      this._bindEvents();
      this._setupMediaSession();
      return this;
    },

    play() {
      const p = this.el.play();
      if (p && p.catch) p.catch(() => {}); // autoplay may be blocked
    },

    pause() {
      this.el.pause();
    },

    toggle() {
      if (this.el.paused) {
        this.play();
      } else {
        this.pause();
      }
    },

    seek(time) {
      this.el.currentTime = Math.max(0, Math.min(time, this.el.duration || 0));
    },

    skipBack(seconds = 15) {
      this.seek(this.el.currentTime - seconds);
    },

    skipForward(seconds = 30) {
      this.seek(this.el.currentTime + seconds);
    },

    // ── Position persistence ────────────────────────────────
    _getStorageKey() {
      // Use the page URL as a unique key per episode
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
      } catch (e) {
        // localStorage unavailable
      }
    },

    _savePosition() {
      try {
        if (this.el.currentTime > 0) {
          localStorage.setItem(this._getStorageKey(), String(this.el.currentTime));
        }
      } catch (e) {
        // localStorage unavailable
      }
    },

    // ── Events ──────────────────────────────────────────────
    _bindEvents() {
      // Resume position once metadata is loaded
      this.el.addEventListener('loadedmetadata', () => {
        if (this._resumePosition > 0 && this._resumePosition < this.el.duration) {
          this.el.currentTime = this._resumePosition;
        }
      });

      // Save position periodically
      this.el.addEventListener('timeupdate', () => {
        // Save every ~5 seconds to avoid excessive writes
        if (Math.floor(this.el.currentTime) % 5 === 0) {
          this._savePosition();
        }
      });

      // Save on pause/end
      this.el.addEventListener('pause', () => this._savePosition());
      this.el.addEventListener('ended', () => {
        try {
          localStorage.removeItem(this._getStorageKey());
        } catch (e) {}
      });

      // Click to toggle play/pause (for video elements)
      if (this.el.tagName === 'VIDEO') {
        this.el.addEventListener('click', () => this.toggle());
        this.el.style.cursor = 'pointer';
      }
    },

    // ── Media Session API ───────────────────────────────────
    _setupMediaSession() {
      if (!('mediaSession' in navigator)) return;

      // Set metadata from data attributes or page info
      const title = document.querySelector('.detail__title');
      const eyebrow = document.querySelector('.detail__eyebrow');

      navigator.mediaSession.metadata = new MediaMetadata({
        title: title ? title.textContent.trim() : document.title,
        artist: 'Higher Ed Hot Takes',
        album: eyebrow ? eyebrow.textContent.trim() : '',
        artwork: this._getArtwork(),
      });

      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => this.skipBack());
      navigator.mediaSession.setActionHandler('seekforward', () => this.skipForward());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) this.seek(details.seekTime);
      });
    },

    _getArtwork() {
      const poster = this.el.getAttribute('poster');
      const coverImg = document.getElementById('video-poster');
      const src = poster || (coverImg && coverImg.src) || '';
      if (!src) return [];
      return [{ src, sizes: '512x512', type: 'image/jpeg' }];
    },
  };

  return controller.init();
}
