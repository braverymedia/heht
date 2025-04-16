/**
 * Episode drawer functionality
 * Handles opening/closing the drawer and tab switching
 */
// Lightweight, accessible episode drawer for single-panel use
(function() {
  function trapFocus(element) {
    const focusable = element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return () => {};
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    function handleTab(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    element.addEventListener('keydown', handleTab);
    return () => element.removeEventListener('keydown', handleTab);
  }

  function initDrawer() {
    const triggers = document.querySelectorAll('[data-toggle="episode-drawer"]');
    const drawer = document.getElementById('episode-drawer');
    const closeBtn = document.getElementById('close-drawer');
    if (!triggers.length || !drawer || !closeBtn) return;
    let untrap = null;
    function openDrawer(e) {
      drawer.setAttribute('aria-hidden', 'false');
      triggers.forEach(btn => btn.setAttribute('aria-expanded', 'true'));
      drawer.classList.add('is-open');
      closeBtn.focus();
      untrap = trapFocus(drawer);
      document.body.classList.add('drawer-open');
      if (e) e.preventDefault();
    }
    function closeDrawer() {
      drawer.setAttribute('aria-hidden', 'true');
      triggers.forEach(btn => btn.setAttribute('aria-expanded', 'false'));
      drawer.classList.remove('is-open');
      // Focus the first trigger
      if (triggers[0]) triggers[0].focus();
      if (untrap) untrap();
      document.body.classList.remove('drawer-open');
    }
    triggers.forEach(btn => btn.addEventListener('click', openDrawer));
    closeBtn.addEventListener('click', closeDrawer);
    drawer.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeDrawer();
    });
    // Expose openDrawer globally for programmatic access
    window.openEpisodeDrawer = openDrawer;
    // Optional: click outside to close (if you want)
    // drawer.addEventListener('mousedown', function(e) {
    //   if (e.target === drawer) closeDrawer();
    // });
    // Cleanup for AJAX nav
    return () => {
      triggers.forEach(btn => btn.removeEventListener('click', openDrawer));
      closeBtn.removeEventListener('click', closeDrawer);
      drawer.removeEventListener('keydown', closeDrawer);
      if (untrap) untrap();
      // Clean up global
      if (window.openEpisodeDrawer === openDrawer) {
        delete window.openEpisodeDrawer;
      }
    };
  }
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  function updateHomepageDrawerContent() {
    console.log('[episode-drawer] updateHomepageDrawerContent called');
    if (!document.body.classList.contains('home')) {
      console.warn('[episode-drawer] Body does not have class "home". Drawer content may not load.');
      // Continue anyway for debugging
    }
    const drawer = document.getElementById('episode-drawer');
    if (!drawer) {
      console.error('[episode-drawer] Drawer element #episode-drawer not found.');
      return;
    }
    const drawerContent = drawer.querySelector('.episode-content');
    if (!drawerContent) {
      console.error('[episode-drawer] Drawer content element .episode-content not found inside #episode-drawer.');
      return;
    }
    fetch('/api/episodes.json')
      .then(res => res.json())
      .then(data => {
        let latest = null;
        if (Array.isArray(data)) {
          // Defensive: if API returns array
          latest = data[0];
        } else if (data.latestEpisode) {
          // Defensive: if API returns object with latestEpisode
          latest = data.latestEpisode;
        }
        if (latest && latest.html) {
          drawerContent.innerHTML = `<article class="drawer-episode-content"><h2>${latest.title}</h2>${latest.html}</article>`;
          console.log('[episode-drawer] Loaded latest episode content into drawer.');
        } else {
          drawerContent.innerHTML = '<p>Episode content unavailable.</p>';
          console.warn('[episode-drawer] No latest episode HTML found in API response.');
        }
      })
      .catch((err) => {
        drawerContent.innerHTML = '<p>Failed to load episode content.</p>';
        console.error('[episode-drawer] Failed to fetch episode content:', err);
      });
  }

  function setupDrawerInit() {
    let cleanup = null;
    function reinit() {
      if (cleanup) cleanup();
      cleanup = initDrawer();
      updateHomepageDrawerContent();
    }
    ready(reinit);
    document.addEventListener('pageContentUpdated', reinit);
    // Or, for Swup: document.addEventListener('swup:contentReplaced', reinit);
    // Or, for Barba: document.addEventListener('barba:after', reinit);
  }
  setupDrawerInit();
})();