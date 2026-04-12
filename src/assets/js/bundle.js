(function () {
  'use strict';

  (function () {

    function initNewsletterForm() {
      const form = document.querySelector('.newsletter-form');
      if (!form) return;

      const container = form.closest('.newsletter-form-container');
      const firstName = form.querySelector('#firstName');
      const lastName = form.querySelector('#lastName');
      const email = form.querySelector('#email');
      const ipAddress = form.querySelector('#ipAddress');
      const success = container.querySelector('.newsletter-success');
      const errorContainer = container.querySelector('.newsletter-error');
      const errorMessage = container.querySelector('.newsletter-error-message');
      const timestampField = form.querySelector('#formTimestamp');
      const honeypotField = form.querySelector('#website');

      // Set timestamp when form is loaded
      timestampField.value = Date.now();

      // Get IP address
      async function getIpAddress() {
        try {
          const response = await fetch('https://api.ipify.org?format=json');
          const data = await response.json();
          return data.ip;
        } catch (error) {
          console.error('Failed to get IP address:', error);
          return '';
        }
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Get submit button and spinner elements
        const submitButton = form.querySelector('button[type="submit"]');
        const buttonText = submitButton.querySelector('.button-text');
        const spinner = submitButton.querySelector('.spinner');

        // Set loading state
        submitButton.disabled = true;
        buttonText.textContent = 'Subscribing...';
        const spinnerIcon = spinner.querySelector('.spinner-icon');
        const successIcon = spinner.querySelector('.success-icon');
        
        // Show spinner and hide success icon
        spinner.style.display = 'inline-block';
        spinnerIcon.style.display = 'block';
        successIcon.style.display = 'none';
        successIcon.classList.remove('show');

        // Hide any previous errors
        errorContainer.style.display = 'none';

        // Check if honeypot field is filled
        if (honeypotField.value) {
          errorContainer.style.display = 'flex';
          errorMessage.innerText = 'Invalid submission detected. Please try again.';
          // Reset button state
          submitButton.disabled = false;
          buttonText.textContent = 'Subscribe';
          spinner.style.display = 'none';
          return;
        }

        // Check if form was submitted too quickly (less than 2 seconds)
        const formLoadTime = parseInt(timestampField.value);
        const currentTime = Date.now();
        if (currentTime - formLoadTime < 2000) {
          errorContainer.style.display = 'flex';
          errorMessage.innerText = 'Please wait a moment before submitting.';
          // Reset button state so the form stays usable
          submitButton.disabled = false;
          buttonText.textContent = 'Subscribe';
          spinner.style.display = 'none';
          return;
        }

        try {
          // Set IP address
          ipAddress.value = await getIpAddress();

          const formBody = `formId=clmf0qar501k6mb0npy4e33r8&userGroup=&mailingLists=clxw13yb8004y0ml459zv0z3c&firstName=${encodeURIComponent(firstName.value)}&lastName=${encodeURIComponent(lastName.value)}&email=${encodeURIComponent(email.value)}&ipAddress=${encodeURIComponent(ipAddress.value)}`;

          const response = await fetch(event.target.action, {
            method: 'POST',
            body: formBody,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          });

          if (response.ok) {
            // Show success state with animation
            const spinnerIcon = spinner.querySelector('.spinner-icon');
            const successIcon = spinner.querySelector('.success-icon');
            
            // Hide spinner and show success icon with animation
            spinnerIcon.style.display = 'none';
            successIcon.style.display = 'block';
            // Trigger reflow to ensure the display change is applied
            void successIcon.offsetWidth;
            successIcon.classList.add('show');
            
            // Update button text
            buttonText.textContent = 'Subscribed!';
            
            // Show success message
            success.style.display = 'flex';
            
            // Reset form
            form.reset();
            
            // Reset button state after animation
            setTimeout(() => {
              submitButton.disabled = false;
              buttonText.textContent = 'Subscribe';
              // Hide both icons and spinner container
              spinner.style.display = 'none';
              spinnerIcon.style.display = 'block';
              successIcon.style.display = 'none';
              successIcon.classList.remove('show');
            }, 2000);
          } else {
            let data;
            try {
              data = await response.json();
            } catch (e) {
              data = {};
            }
            errorContainer.style.display = 'flex';
            // Show a specific message for rate limiting (HTTP 429)
            if (response.status === 429) {
              errorMessage.innerText = data.error || data.message || 'Too many signups from this IP. Please try again later.';
            } else {
              errorMessage.innerText = data.error || data.message || response.statusText || 'An error occurred. Please try again.';
            }
            // Reset button state on error
            submitButton.disabled = false;
            buttonText.textContent = 'Subscribe';
            spinner.style.display = 'none';
          }
        } catch (error) {
          errorContainer.style.display = 'flex';
          errorMessage.innerText = error.message || 'An error occurred. Please try again.';
          // Reset button state on error
          submitButton.disabled = false;
          buttonText.textContent = 'Subscribe';
          spinner.style.display = 'none';
        }
      });
    }

    // Initialize when DOM is loaded
    if (typeof document !== 'undefined') {
      document.addEventListener('DOMContentLoaded', () => {
        initNewsletterForm();
      });
    }
  })();

  /**
   * Panel Controller
   *
   * Handles:
   * - Collapsing/expanding the nav rail and detail panel
   * - Slide-in overlays in the detail panel (episode list, newsletter)
   * - Expand toggles on the video panel when panels are collapsed
   *
   * Collapse states (rail-collapsed, detail-collapsed) are persisted
   * to localStorage so the layout remembers the user's preference
   * across page loads. Restored inline on init; writes on every toggle.
   */

  const STORAGE_KEY$1 = 'heht-panel-state';

  function loadPanelState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY$1);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function savePanelState(state) {
    try {
      localStorage.setItem(STORAGE_KEY$1, JSON.stringify(state));
    } catch (e) {
      // localStorage full or disabled — non-fatal
    }
  }

  function initPanelController() {
    const shell = document.getElementById('shell');
    if (!shell) return;

    // ── Restore collapse state from localStorage ────────────
    // Applied before any event listeners bind so the layout paints
    // in the right state without a flash. We skip mobile because the
    // collapsed desktop classes don't map to the mobile bottom-bar
    // layout — mobile uses display: contents and a fixed rail.
    const isMobile = matchMedia('(max-width: 767px)').matches;
    const savedState = loadPanelState();
    if (!isMobile) {
      if (savedState.railCollapsed) shell.classList.add('rail-collapsed');
      if (savedState.detailCollapsed) shell.classList.add('detail-collapsed');
    }

    // Pull-tab toggles (one per panel, always visible)
    const railTab = document.getElementById('rail-tab');
    const detailTab = document.getElementById('detail-tab');

    // Slide-in panels
    const episodeListPanel = document.getElementById('episode-list-panel');
    const episodeListClose = document.getElementById('episode-list-close');
    const episodesTrigger = document.querySelector('[data-action="show-episodes"]');

    const newsletterPanel = document.getElementById('newsletter-panel');
    const newsletterClose = document.getElementById('newsletter-close');
    const newsletterTrigger = document.querySelector('[data-action="show-newsletter"]');

    const aboutPanel = document.getElementById('about-panel');
    const aboutClose = document.getElementById('about-close');
    const aboutTriggers = document.querySelectorAll('[data-action="show-about"]');

    // Helper: close all slide-in panels
    function closeAllSlideIns() {
      [episodeListPanel, newsletterPanel, aboutPanel].forEach(panel => {
        if (panel) {
          panel.classList.remove('is-open');
          panel.setAttribute('aria-hidden', 'true');
        }
      });
    }

    // Helper: open a slide-in panel (closes others first)
    function openSlideIn(panel) {
      if (!panel) return;
      closeAllSlideIns();
      shell.classList.remove('detail-collapsed');
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
    }

    // Reflect initial aria-expanded based on restored state.
    if (railTab) {
      railTab.setAttribute('aria-expanded', String(!shell.classList.contains('rail-collapsed')));
    }
    if (detailTab) {
      detailTab.setAttribute('aria-expanded', String(!shell.classList.contains('detail-collapsed')));
    }

    // ── Rail tab ────────────────────────────────────────────
    // Single always-visible toggle at the rail's right edge.
    if (railTab) {
      railTab.addEventListener('click', () => {
        const isCollapsed = shell.classList.toggle('rail-collapsed');
        railTab.setAttribute('aria-expanded', String(!isCollapsed));
        savePanelState({
          ...loadPanelState(),
          railCollapsed: isCollapsed,
        });
      });
    }

    // ── Detail tab ──────────────────────────────────────────
    // Same pattern as rail tab; also clears open slide-ins on collapse.
    if (detailTab) {
      detailTab.addEventListener('click', () => {
        const isCollapsed = shell.classList.toggle('detail-collapsed');
        detailTab.setAttribute('aria-expanded', String(!isCollapsed));
        if (isCollapsed) {
          closeAllSlideIns();
        }
        savePanelState({
          ...loadPanelState(),
          detailCollapsed: isCollapsed,
        });
      });
    }

    // ── Episode list slide-in ───────────────────────────────
    if (episodesTrigger) {
      episodesTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        openSlideIn(episodeListPanel);
      });
    }

    if (episodeListClose) {
      episodeListClose.addEventListener('click', () => {
        closeAllSlideIns();
      });
    }

    // ── Newsletter slide-in ─────────────────────────────────
    if (newsletterTrigger) {
      newsletterTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        openSlideIn(newsletterPanel);
      });
    }

    if (newsletterClose) {
      newsletterClose.addEventListener('click', () => {
        closeAllSlideIns();
      });
    }

    // ── About slide-in ──────────────────────────────────────
    // Multiple triggers (nav rail link, possibly others). Each intercepts
    // the click only if the panel exists in this page — otherwise falls
    // through to hard-nav (/about/ standalone).
    if (aboutPanel) {
      aboutTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
          e.preventDefault();
          openSlideIn(aboutPanel);
        });
      });
    }

    if (aboutClose) {
      aboutClose.addEventListener('click', () => {
        // On the standalone /about/ page (pageType: about) there's nothing
        // underneath the slide — closing would strand the user on an empty
        // shell. Hard-nav home to the latest episode instead.
        if (document.body.dataset.type === 'about') {
          window.location.href = '/';
          return;
        }
        closeAllSlideIns();
      });
    }

    // ── Keyboard: Escape closes slide-ins ───────────────────
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const anyOpen = [episodeListPanel, newsletterPanel, aboutPanel].some(
          p => p && p.classList.contains('is-open')
        );
        if (anyOpen) {
          closeAllSlideIns();
        }
      }
    });
  }

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

  function initMediaController() {
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

  /**
   * Episode Navigation + Seamless Slot-Machine Transitions
   *
   * Fetches the next/prev episode page, stacks the incoming content below
   * (or above) the current content, then slides both as one continuous reel.
   * Video panel leads, detail panel follows at 50%.
   *
   * Uses Web Animations API (Motion Pro integration deferred to later).
   */

  function initEpisodeNav() {
    const shell = document.getElementById('shell');
    const detail = document.querySelector('.detail');
    const videoPanel = document.getElementById('video-panel');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    if (!shell || !detail || !videoPanel || !prevBtn || !nextBtn) return;

    let animating = false;

    // Build episode index from the episode list panel links
    const episodeLinks = Array.from(
      document.querySelectorAll('.episode-list-panel__item')
    ).map(a => a.getAttribute('href')).reverse(); // reverse: list is newest-first, we want oldest-first

    const currentPath = window.location.pathname;
    let currentIndex = episodeLinks.indexOf(currentPath);

    // Home page shows latest episode — match it
    if (currentIndex === -1 && currentPath === '/') {
      currentIndex = episodeLinks.length - 1;
    }

    updateButtons();

    function updateButtons() {
      prevBtn.disabled = currentIndex <= 0;
      nextBtn.disabled = currentIndex >= episodeLinks.length - 1;
    }

    async function fetchEpisodePage(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      const html = await res.text();
      const parser = new DOMParser();
      return parser.parseFromString(html, 'text/html');
    }

    function extractDetailContent(doc) {
      const content = doc.querySelector('.detail__content');
      return content ? content.innerHTML : '';
    }

    function extractVideoSlide(doc) {
      const slide = doc.querySelector('.video-panel__slide');
      return slide ? slide.innerHTML : '';
    }

    function extractEpisodeNumber(doc) {
      const odo = doc.querySelector('#episode-odometer');
      if (!odo) return null;
      const n = parseInt(odo.dataset.episodeNumber, 10);
      return Number.isFinite(n) ? n : null;
    }

    function updateOdometer(number) {
      const odo = document.getElementById('episode-odometer');
      if (!odo || number == null) return;
      const padded = String(number).padStart(3, '0');
      const strips = odo.querySelectorAll('.odo-strip');
      padded.split('').forEach((d, i) => {
        const digit = parseInt(d, 10);
        if (strips[i]) {
          strips[i].style.transform = `translateY(-${digit * 0.82}em)`;
        }
      });
      odo.dataset.episodeNumber = String(number);
    }

    async function navigate(direction) {
      if (animating) return;

      const targetIndex = currentIndex + direction;
      if (targetIndex < 0 || targetIndex >= episodeLinks.length) return;

      const targetUrl = episodeLinks[targetIndex];
      animating = true;

      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

      try {
        // Fetch target episode
        const doc = await fetchEpisodePage(targetUrl);
        const newDetailHtml = extractDetailContent(doc);
        const newVideoHtml = extractVideoSlide(doc);
        const newEpisodeNumber = extractEpisodeNumber(doc);

        if (reducedMotion) {
          // Instant swap
          swapContent(newDetailHtml, newVideoHtml, targetUrl);
          updateOdometer(newEpisodeNumber);
          currentIndex = targetIndex;
          updateButtons();
          animating = false;
          return;
        }

        // Start odometer roll at the same moment the slot-machine begins
        updateOdometer(newEpisodeNumber);

        // ── Build the reel ──────────────────────────────────
        // swapContent happens *inside* animateTransition — between the
        // animation finishing and the clones being removed — so the old
        // content never flashes back into view in the cleanup frame.
        await animateTransition(direction, newDetailHtml, newVideoHtml, targetUrl);

        currentIndex = targetIndex;
        updateButtons();

      } catch (err) {
        console.error('[episode-nav] Navigation failed:', err);
        // Fallback: hard navigate
        window.location.href = targetUrl;
      } finally {
        animating = false;
      }
    }

    function swapContent(detailHtml, videoHtml, url) {
      const detailContent = detail.querySelector('.detail__content');
      const videoSlide = document.getElementById('video-slide');

      if (detailContent) detailContent.innerHTML = detailHtml;
      if (videoSlide) videoSlide.innerHTML = videoHtml;

      // Update URL without reload
      history.pushState({ episodeUrl: url }, '', url);

      // Update page title from the new detail content
      const newTitle = detail.querySelector('.detail__title');
      if (newTitle) {
        document.title = newTitle.textContent.trim() + ' - Higher Ed Hot Takes';
      }

      // Scroll the detail content back to top. .detail is overflow:hidden
      // (it's the non-scrolling frame); .detail__content is the actual
      // scroller, and innerHTML replacement can leave its scrollTop
      // pinned if the new content is tall enough.
      if (detailContent) detailContent.scrollTop = 0;

      // Re-init media controller for new content
      if (window.initMediaController) window.initMediaController();
    }

    async function animateTransition(direction, newDetailHtml, newVideoHtml, targetUrl) {
      const dur = 700;
      const stagger = 120; // detail starts 120ms after video — slight offset, not waiting
      const exitY = direction > 0 ? '-100%' : '100%';
      const enterY = direction > 0 ? '100%' : '-100%';

      // ── Video reel ────────────────────────────────────────
      const videoSlide = document.getElementById('video-slide');
      const videoClone = videoSlide.cloneNode(false);
      videoClone.innerHTML = newVideoHtml;
      videoClone.style.position = 'absolute';
      videoClone.style.inset = '0';
      videoClone.style.transform = `translateY(${enterY})`;
      videoClone.id = '';
      videoPanel.appendChild(videoClone);

      // Animate video: current exits, clone enters
      const videoCurrentAnim = videoSlide.animate(
        [{ transform: 'translateY(0)' }, { transform: `translateY(${exitY})` }],
        { duration: dur, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
      );
      videoClone.animate(
        [{ transform: `translateY(${enterY})` }, { transform: 'translateY(0)' }],
        { duration: dur, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
      );

      // ── Detail reel (staggered) ───────────────────────────
      // .detail is overflow:hidden, .detail__content is 100% height + scrolls.
      // Clone matches exactly — same height, same padding, clean slide.
      const detailContent = detail.querySelector('.detail__content');
      const detailClone = document.createElement('div');
      detailClone.className = detailContent.className;
      detailClone.innerHTML = newDetailHtml;
      detailClone.style.position = 'absolute';
      detailClone.style.inset = '0';
      detailClone.style.transform = `translateY(${enterY})`;
      detail.appendChild(detailClone);

      // Make current content positionable for the exit animation
      detailContent.style.position = 'absolute';
      detailContent.style.inset = '0';

      await new Promise(resolve => setTimeout(resolve, stagger));

      const detailCurrentAnim = detailContent.animate(
        [{ transform: 'translateY(0)' }, { transform: `translateY(${exitY})` }],
        { duration: dur, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
      );
      detailClone.animate(
        [{ transform: `translateY(${enterY})` }, { transform: 'translateY(0)' }],
        { duration: dur, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
      );

      // Wait for both to finish
      await videoCurrentAnim.finished;
      await detailCurrentAnim.finished;

      // ── Cleanup order matters ─────────────────────────────
      // Both originals are held off-screen by fill:forwards and both
      // clones are held on-screen at translateY(0) showing the new
      // content. If we cancel the originals' animations first, they
      // snap back to transform:'' (their natural on-screen position)
      // and briefly paint their *old* content for a frame before we
      // swap it — that's the flicker.
      //
      // Instead: swap the originals' content to the new content while
      // they're still transformed off-screen (invisible swap), then
      // cancel the animations (originals return to natural position
      // already showing the new content, exactly where the clones are
      // still rendering), then remove the clones in the same frame.
      swapContent(newDetailHtml, newVideoHtml, targetUrl);

      videoSlide.getAnimations().forEach(a => a.cancel());
      detailContent.getAnimations().forEach(a => a.cancel());
      videoSlide.style.transform = '';
      detailContent.style.position = '';
      detailContent.style.inset = '';
      detailContent.style.transform = '';

      videoClone.remove();
      detailClone.remove();
    }

    // ── Event listeners ─────────────────────────────────────
    nextBtn.addEventListener('click', () => navigate(1));
    prevBtn.addEventListener('click', () => navigate(-1));

    // Keyboard nav
    document.addEventListener('keydown', (e) => {
      if (animating) return;
      // Don't intercept when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === 'ArrowLeft') navigate(-1);
    });

    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.episodeUrl) {
        const idx = episodeLinks.indexOf(e.state.episodeUrl);
        if (idx !== -1 && idx !== currentIndex) {
          currentIndex = idx;
          // Fetch and swap without animation for back/forward
          fetchEpisodePage(e.state.episodeUrl).then(doc => {
            swapContent(
              extractDetailContent(doc),
              extractVideoSlide(doc),
              e.state.episodeUrl
            );
            updateOdometer(extractEpisodeNumber(doc));
            updateButtons();
          });
        }
      }
    });

    // Also handle clicks on episode list items as soft-nav
    document.querySelectorAll('.episode-list-panel__item').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        const idx = episodeLinks.indexOf(href);
        if (idx === -1) return; // let it hard-navigate

        e.preventDefault();

        // Close the episode list panel
        const panel = document.getElementById('episode-list-panel');
        if (panel) {
          panel.classList.remove('is-open');
          panel.setAttribute('aria-hidden', 'true');
        }

        const direction = idx > currentIndex ? 1 : -1;
        currentIndex = idx - direction; // navigate() will add the direction back
        navigate(direction);
      });
    });
  }

  // Initialize panel collapse/expand and episode list
  initPanelController();

  // Initialize media playback
  initMediaController();

  // Initialize episode navigation + transitions
  initEpisodeNav();

})();
//# sourceMappingURL=bundle.js.map
