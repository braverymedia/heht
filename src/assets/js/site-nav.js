document.addEventListener('DOMContentLoaded', () => {
  const mobileMenu = document.querySelector('.mobile-menu');
  const desktopDrawer = document.querySelector('.desktop-drawer');
  const newsletterModal = document.querySelector('.newsletter-modal');
  const episodesButton = document.querySelector('[aria-label="Toggle episode list"]');
  const drawerCloseButton = document.querySelector('.drawer-close');
  const ctaButton = document.querySelector('.cta');
  const modalCloseButton = document.querySelector('.modal-close');
  let lastFocusedElement = null;

  if (!mobileMenu || !desktopDrawer || !newsletterModal) return;

  // Initialize states
  let isDrawerOpen = false;
  let isMobileMenuOpen = false;
  let isNewsletterModalOpen = false;

  // Event listeners
  episodesButton.addEventListener('click', toggleMenu);
  drawerCloseButton.addEventListener('click', closeDrawer);
  ctaButton.addEventListener('click', openNewsletterModal);
  if (modalCloseButton) {
    modalCloseButton.addEventListener('click', closeNewsletterModal);
  }

  // Close on outside click
  document.addEventListener('click', (event) => {
    if (isDrawerOpen && !desktopDrawer.contains(event.target)) {
      closeDrawer();
    }
    if (isNewsletterModalOpen && !newsletterModal.contains(event.target) && event.target !== ctaButton) {
      closeNewsletterModal();
    }
  });

  // Trap focus in modal
  document.addEventListener('keydown', (event) => {
    if (isNewsletterModalOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeNewsletterModal();
      } else if (event.key === 'Tab') {
        trapFocus(newsletterModal, event);
      }
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
    lastFocusedElement = document.activeElement;
    newsletterModal.classList.add('is-open');
    newsletterModal.setAttribute('aria-hidden', false);
    newsletterModal.focus();
    // Move focus to first focusable element inside modal
    setTimeout(() => {
      const focusable = getFocusableElements(newsletterModal);
      if (focusable.length) focusable[0].focus();
    }, 10);
  }

  function closeNewsletterModal() {
    isNewsletterModalOpen = false;
    newsletterModal.classList.remove('is-open');
    newsletterModal.setAttribute('aria-hidden', true);
    if (lastFocusedElement) lastFocusedElement.focus();
  }

  function getFocusableElements(container) {
    return Array.from(container.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'));
  }

  function trapFocus(container, event) {
    const focusable = getFocusableElements(container);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
});
