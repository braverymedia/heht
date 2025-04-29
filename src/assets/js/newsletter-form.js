(function () {
  'use strict';

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

      // Check if honeypot field is filled
      if (honeypotField.value) {
        errorContainer.style.display = 'flex';
        errorMessage.innerText = 'Invalid submission detected. Please try again.';
        return;
      }

      // Check if form was submitted too quickly (less than 2 seconds)
      const formLoadTime = parseInt(timestampField.value);
      const currentTime = Date.now();
      if (currentTime - formLoadTime < 2000) {
        errorContainer.style.display = 'flex';
        errorMessage.innerText = 'Please wait a moment before submitting.';
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
          success.style.display = 'flex';
          form.reset();
        } else {
          const data = await response.json();
          errorContainer.style.display = 'flex';
          errorMessage.innerText = data.message || response.statusText;
        }
      } catch (error) {
        errorContainer.style.display = 'flex';
        errorMessage.innerText = error.message || 'An error occurred. Please try again.';
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