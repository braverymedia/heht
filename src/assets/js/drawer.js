document.addEventListener('DOMContentLoaded', () => {
  const drawer = document.querySelector('.desktop-drawer');
  const toggleButton = document.querySelector('.menu-toggle');
  const closeButton = document.querySelector('.drawer-close');

  if (!drawer || !toggleButton || !closeButton) return;

  // Toggle drawer
  toggleButton.addEventListener('click', () => {
    const isHidden = drawer.getAttribute('aria-hidden') === 'true';
    drawer.setAttribute('aria-hidden', !isHidden);
    document.body.style.overflow = isHidden ? 'hidden' : '';
  });

  // Close drawer
  closeButton.addEventListener('click', () => {
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  });

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.getAttribute('aria-hidden') === 'false') {
      drawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (
      drawer.getAttribute('aria-hidden') === 'false' &&
      !drawer.contains(e.target) &&
      !toggleButton.contains(e.target)
    ) {
      drawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  });

  // Format episode duration
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Format episode numbers
  const formatnumber = (number) => {
    return number.toString().padStart(3, '0');
  };

  // Apply formatting to all episode items
  document.querySelectorAll('.episode-item').forEach((item) => {
    const duration = item.querySelector('.episode-duration');
    const number = item.querySelector('.episode-number');

    if (duration && duration.dataset.duration) {
      duration.textContent = formatDuration(parseInt(duration.dataset.duration, 10));
    }

    if (number && number.dataset.number) {
      number.textContent = `#${formatnumber(number.dataset.number)}`;
    }
  });
});