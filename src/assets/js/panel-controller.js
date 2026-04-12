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

const STORAGE_KEY = 'heht-panel-state';

function loadPanelState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function savePanelState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // localStorage full or disabled — non-fatal
  }
}

export function initPanelController() {
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
