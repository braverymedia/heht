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

  // Collapse/expand buttons
  const railCollapseBtn = document.getElementById('rail-collapse-btn');
  const detailCollapseBtn = document.getElementById('detail-collapse-btn');
  const expandRailBtn = document.getElementById('rail-expand-btn');

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

  // ── Rail collapse ───────────────────────────────────────
  if (railCollapseBtn) {
    railCollapseBtn.addEventListener('click', () => {
      shell.classList.add('rail-collapsed');
    });
  }

  if (expandRailBtn) {
    expandRailBtn.addEventListener('click', () => {
      shell.classList.remove('rail-collapsed');
    });
  }

  // ── Detail collapse (toggle) ─────────────────────────────
  if (detailCollapseBtn) {
    detailCollapseBtn.addEventListener('click', () => {
      shell.classList.toggle('detail-collapsed');
      if (shell.classList.contains('detail-collapsed')) {
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
