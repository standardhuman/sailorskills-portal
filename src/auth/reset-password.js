/**
 * Reset Password Page Logic
 * Handles password reset request and update
 */

import { resetPassword, updatePassword } from './auth.js';

// Check if this is a password update (from reset link) or request
const hashParams = new URLSearchParams(window.location.hash.substring(1));
const isPasswordUpdate = hashParams.get('type') === 'recovery';

if (isPasswordUpdate) {
  // Show password update form
  document.getElementById('request-reset-form').style.display = 'none';
  document.getElementById('new-password-form').style.display = 'block';
  document.getElementById('header-text').textContent = 'Enter your new password';
}

// Request reset form
const requestResetForm = document.getElementById('request-reset-form');
const resetBtn = document.getElementById('reset-btn');

requestResetForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();

  // Disable button
  resetBtn.disabled = true;
  resetBtn.textContent = 'Sending...';

  // Clear any previous alerts
  clearAlerts();

  // Send reset email
  const { success, error } = await resetPassword(email);

  if (error) {
    showAlert('error', error);
    resetBtn.disabled = false;
    resetBtn.textContent = 'Send Reset Link';
    return;
  }

  // Success
  showAlert('success', `Password reset link sent to ${email}! Check your inbox.`);
  resetBtn.disabled = false;
  resetBtn.textContent = 'Send Reset Link';
  requestResetForm.reset();
});

// New password form
const newPasswordForm = document.getElementById('new-password-form');
const updatePasswordBtn = document.getElementById('update-password-btn');

newPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const newPassword = document.getElementById('new-password').value;
  const confirmNewPassword = document.getElementById('confirm-new-password').value;

  // Clear any previous alerts
  clearAlerts();

  // Validate passwords match
  if (newPassword !== confirmNewPassword) {
    showAlert('error', 'Passwords do not match');
    return;
  }

  // Validate password strength
  if (!validatePassword(newPassword)) {
    showAlert('error', 'Password must be at least 8 characters with uppercase, lowercase, and numbers.');
    return;
  }

  // Disable button
  updatePasswordBtn.disabled = true;
  updatePasswordBtn.textContent = 'Updating...';

  // Update password
  const { success, error } = await updatePassword(newPassword);

  if (error) {
    showAlert('error', error);
    updatePasswordBtn.disabled = false;
    updatePasswordBtn.textContent = 'Update Password';
    return;
  }

  // Success
  showAlert('success', 'Password updated successfully! Redirecting to login...');

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
 * @param {string} type - 'success' or 'error'
 * @param {string} message - Alert message
 */
function showAlert(type, message) {
  const alertContainer = document.getElementById('alert-container');
  const alertClass = type === 'success' ? 'alert-success' : 'alert-error';

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
