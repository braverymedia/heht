/**
 * Panel Controller
 *
 * Handles:
 * - Collapsing/expanding the nav rail and detail panel
 * - Slide-in overlays in the detail panel (episode list, newsletter)
 * - Expand toggles on the video panel when panels are collapsed
 */

export function initPanelController() {
  const shell = document.getElementById('shell');
  if (!shell) return;

  // Pull-tab toggles (one per panel, always visible)
  const railTab = document.getElementById('rail-tab');
  const detailTab = document.getElementById('detail-tab');

  // Slide-in panels
  const episodeListPanel = document.getElementById('episode-list-panel');
  const episodeListBack = document.getElementById('episode-list-back');
  const episodesTrigger = document.querySelector('[data-action="show-episodes"]');

  const newsletterPanel = document.getElementById('newsletter-panel');
  const newsletterBack = document.getElementById('newsletter-back');
  const newsletterTrigger = document.querySelector('[data-action="show-newsletter"]');

  // Helper: close all slide-in panels
  function closeAllSlideIns() {
    [episodeListPanel, newsletterPanel].forEach(panel => {
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

  // ── Rail tab ────────────────────────────────────────────
  // Single always-visible toggle at the rail's right edge.
  if (railTab) {
    railTab.addEventListener('click', () => {
      const isCollapsed = shell.classList.toggle('rail-collapsed');
      railTab.setAttribute('aria-expanded', String(!isCollapsed));
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
    });
  }

  // ── Episode list slide-in ───────────────────────────────
  if (episodesTrigger) {
    episodesTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      openSlideIn(episodeListPanel);
    });
  }

  if (episodeListBack) {
    episodeListBack.addEventListener('click', () => {
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

  if (newsletterBack) {
    newsletterBack.addEventListener('click', () => {
      closeAllSlideIns();
    });
  }

  // ── Keyboard: Escape closes slide-ins ───────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const anyOpen = [episodeListPanel, newsletterPanel].some(
        p => p && p.classList.contains('is-open')
      );
      if (anyOpen) {
        closeAllSlideIns();
      }
    }
  });
}

// Auto-init when loaded as a standalone module (dev mode)
initPanelController();
