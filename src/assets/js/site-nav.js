document.addEventListener('DOMContentLoaded', () => {
  const mobileMenu = document.querySelector('.mobile-menu');
  const desktopDrawer = document.querySelector('.desktop-drawer');
  const newsletterModal = document.querySelector('.newsletter-modal');
  const episodesButton = document.querySelector('[aria-label="Toggle episode list"]');
  const drawerCloseButton = document.querySelector('.drawer-close');
  const ctaButton = document.querySelector('.cta');

  if (!mobileMenu || !desktopDrawer || !newsletterModal) return;

  // Initialize states
  let isDrawerOpen = false;
  let isMobileMenuOpen = false;
  let isNewsletterModalOpen = false;

  // Event listeners
  episodesButton.addEventListener('click', toggleMenu);
  drawerCloseButton.addEventListener('click', closeDrawer);
  ctaButton.addEventListener('click', openNewsletterModal);

  // Close on outside click
  document.addEventListener('click', (event) => {
    if (isDrawerOpen && !desktopDrawer.contains(event.target)) {
      closeDrawer();
    }
    if (isNewsletterModalOpen && !newsletterModal.contains(event.target)) {
      closeNewsletterModal();
    }
  });

  function toggleMenu() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      isMobileMenuOpen = !isMobileMenuOpen;
      mobileMenu.setAttribute('aria-hidden', !isMobileMenuOpen);
      episodesButton.setAttribute('aria-expanded', isMobileMenuOpen);
    } else {
      isDrawerOpen = !isDrawerOpen;
      desktopDrawer.setAttribute('aria-hidden', !isDrawerOpen);
      episodesButton.setAttribute('aria-expanded', isDrawerOpen);
    }
  }

  function closeDrawer() {
    isDrawerOpen = false;
    desktopDrawer.setAttribute('aria-hidden', true);
    episodesButton.setAttribute('aria-expanded', false);
  }

  function openNewsletterModal() {
    isNewsletterModalOpen = true;
    newsletterModal.setAttribute('aria-hidden', false);
    newsletterModal.focus();
  }

  function closeNewsletterModal() {
    isNewsletterModalOpen = false;
    newsletterModal.setAttribute('aria-hidden', true);
  }
});
