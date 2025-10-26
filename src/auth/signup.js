/**
 * Signup Page Logic
 * Handles user registration
 */

import { signUp, isAuthenticated } from './auth.js';

// Check if already authenticated
(async () => {
  const authenticated = await isAuthenticated();
  if (authenticated) {
    window.location.href = '/portal.html';
  }
})();

// Check for boat slug in URL params
const urlParams = new URLSearchParams(window.location.search);
const boatSlugParam = urlParams.get('boat');
if (boatSlugParam) {
  document.getElementById('boat-slug').value = boatSlugParam;
}

// Signup form
const signupForm = document.getElementById('signup-form');
const signupBtn = document.getElementById('signup-btn');

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const boatSlug = document.getElementById('boat-slug').value.trim();

  // Clear any previous alerts
  clearAlerts();

  // Validate passwords match
  if (password !== confirmPassword) {
    showAlert('error', 'Passwords do not match');
    return;
  }

  // Validate password strength
  if (!validatePassword(password)) {
    showAlert('error', 'Password does not meet requirements. Please use at least 8 characters with uppercase, lowercase, and numbers.');
    return;
  }

  // Disable button
  signupBtn.disabled = true;
  signupBtn.textContent = 'Creating account...';

  // Attempt signup
  const { user, error } = await signUp(email, password, boatSlug || null);

  if (error) {
    showAlert('error', error);
    signupBtn.disabled = false;
    signupBtn.textContent = 'Create Account';
    return;
  }

  // Success - show message and redirect
  showAlert('success', 'Account created successfully! Please check your email to verify your account.');

  // Redirect after short delay
  setTimeout(() => {
    window.location.href = '/login.html';
  }, 2000);
});

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {boolean}
 */
function validatePassword(password) {
  // At least 8 characters
  if (password.length < 8) return false;

  // At least one uppercase letter
  if (!/[A-Z]/.test(password)) return false;

  // At least one lowercase letter
  if (!/[a-z]/.test(password)) return false;

  // At least one number
  if (!/[0-9]/.test(password)) return false;

  return true;
}

/**
 * Show alert message
 * @param {string} type - 'success', 'error', or 'info'
 * @param {string} message - Alert message
 */
function showAlert(type, message) {
  const alertContainer = document.getElementById('alert-container');
  const alertClass = `alert-${type}`;

  alertContainer.innerHTML = `
    <div class="alert ${alertClass}">
      ${message}
    </div>
  `;
}

/**
 * Clear all alerts
 */
function clearAlerts() {
  const alertContainer = document.getElementById('alert-container');
  alertContainer.innerHTML = '';
}
