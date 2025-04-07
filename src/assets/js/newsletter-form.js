document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.newsletter-form');
  if (!form) return;

  // Add error message containers
  const formGroups = form.querySelectorAll('.form-group');
  formGroups.forEach(group => {
    const errorSpan = document.createElement('span');
    errorSpan.className = 'error-message';
    group.appendChild(errorSpan);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Clear previous errors
    formGroups.forEach(group => {
      const error = group.querySelector('.error-message');
      error.textContent = '';
    });

    // Get form data
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Validate form data
    const errors = validateForm(data);
    if (Object.keys(errors).length > 0) {
      displayErrors(errors);
      return;
    }

    // Show loading state
    const submitButton = form.querySelector('.submit-button');
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    try {
      const response = await fetch('https://app.loops.so/api/newsletter-form/clmf0qar501k6mb0npy4e33r8', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to subscribe');
      }

      // Handle successful submission
      form.reset();
      showSuccessMessage();
    } catch (error) {
      // Handle error
      showError(error.message || 'An error occurred. Please try again.');
    } finally {
      // Reset button state
      submitButton.disabled = false;
      submitButton.textContent = 'Subscribe';
    }
  });
});

function validateForm(data) {
  const errors = {};
  
  if (!data.firstName) errors.firstName = 'First name is required';
  if (!data.lastName) errors.lastName = 'Last name is required';
  if (!data.email) errors.email = 'Email is required';
  else if (!isValidEmail(data.email)) errors.email = 'Please enter a valid email address';

  return errors;
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function displayErrors(errors) {
  const formGroups = document.querySelectorAll('.form-group');
  formGroups.forEach(group => {
    const error = group.querySelector('.error-message');
    error.textContent = '';
  });

  Object.entries(errors).forEach(([field, message]) => {
    const group = document.querySelector(`[for="${field}"]`).parentElement;
    const error = group.querySelector('.error-message');
    error.textContent = message;
  });
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'form-error';
  errorDiv.textContent = message;
  form.insertBefore(errorDiv, form.firstChild);
}

function showSuccessMessage() {
  const successDiv = document.createElement('div');
  successDiv.className = 'form-success';
  successDiv.textContent = 'Thank you for subscribing!';
  form.insertBefore(successDiv, form.firstChild);
}
