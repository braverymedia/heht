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