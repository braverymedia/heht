(function () {
  'use strict';

  function initNewsletterForm() {
    const form = document.querySelector('.newsletter-form');
    if (!form) return;

    const container = form.closest('.newsletter-form-container');
    const firstName = form.querySelector('#firstName');
    const lastName = form.querySelector('#lastName');
    const email = form.querySelector('#email');
    const success = container.querySelector('.newsletter-success');
    const errorContainer = container.querySelector('.newsletter-error');
    const errorMessage = container.querySelector('.newsletter-error-message');
    const timestampField = form.querySelector('#formTimestamp');
    const honeypotField = form.querySelector('#website');

    // Set timestamp when form is loaded
    timestampField.value = Date.now();

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
        // Serialize the actual form fields — the edge function (see
        // src/edge/newsletter.js) reads email/firstName/lastName/
        // website/formTimestamp via form.get(...). This used to send a
        // hand-built Loops-hosted-form-style body instead (a leftover
        // from before the form posted to our own Bunny edge function),
        // which meant the server never saw the honeypot or timestamp
        // fields and its spam checks silently never ran.
        //
        // cf-turnstile-response only exists when the Turnstile widget is
        // rendered (turnstileSiteKey configured in podcast.json) — this
        // form doesn't serialize all fields generically, so it has to be
        // picked up by name explicitly, unlike jggweb's generic serializer.
        const turnstileField = form.querySelector('[name="cf-turnstile-response"]');
        const formBody = new URLSearchParams({
          email: email.value,
          firstName: firstName.value,
          lastName: lastName.value,
          website: honeypotField.value,
          formTimestamp: timestampField.value,
        });
        if (turnstileField) {
          formBody.set('cf-turnstile-response', turnstileField.value);
        }

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
