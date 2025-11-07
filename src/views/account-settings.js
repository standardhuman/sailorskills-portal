/**
 * Customer Portal - Account Settings View
 * Handles account management, profile updates, and preferences
 */

import {
  requireAuth,
  getCurrentUser,
  getEffectiveUser,
  logout,
} from "../auth/auth.js";
import {
  getAccountInfo,
  getCustomerInfo,
  updateEmail,
  updatePhone,
  changePassword,
  getNotificationPreferences,
  updateNotificationPreferences,
  getAccessibleBoats,
  switchCurrentBoat,
  deleteAccount,
  formatPhoneNumber,
  isValidEmail,
  validatePassword,
} from "../api/account.js";

// Require authentication
const isAuth = await requireAuth();
if (!isAuth) {
  throw new Error("Not authenticated");
}

// State
let currentUser = null;
let currentPreferences = null;
let currentBoatId = null;

/**
 * Initialize page
 */
async function init() {
  // Get current user
  const { user, error: userError } = await getEffectiveUser();
  if (userError || !user) {
    console.error("Error loading user:", userError);
    window.location.href = "/login.html";
    return;
  }

  currentUser = user;
  document.getElementById("user-email").textContent = user.email;

  // Load account data
  await loadAccountInfo();
  await loadCustomerInfo();
  await loadNotificationPreferences();
  await loadBoats();

  // Setup event listeners
  setupEventListeners();
}

/**
 * Load account information
 */
async function loadAccountInfo() {
  const { account, error } = await getAccountInfo();

  if (error) {
    console.error("Error loading account:", error);
    return;
  }

  // Pre-fill email
  if (account) {
    document.getElementById("email").value = account.email || currentUser.email;
  }
}

/**
 * Load customer information
 */
async function loadCustomerInfo() {
  const { customer, error } = await getCustomerInfo();

  if (error) {
    console.error("Error loading customer info:", error);
    return;
  }

  // Pre-fill phone
  if (customer) {
    document.getElementById("phone").value = customer.phone || "";
  }
}

/**
 * Load notification preferences
 */
async function loadNotificationPreferences() {
  const { preferences, error } = await getNotificationPreferences();

  if (error) {
    console.error("Error loading preferences:", error);
    return;
  }

  currentPreferences = preferences || {
    service_completion: true,
    new_invoice: true,
    upcoming_service: true,
    new_message: true,
    reminder_days_before: 3,
  };

  // Update UI toggles
  Object.keys(currentPreferences).forEach((key) => {
    if (key === "reminder_days_before") {
      document.getElementById("reminder-days").value = currentPreferences[key];
    } else {
      const toggle = document.querySelector(`[data-pref="${key}"]`);
      if (toggle && currentPreferences[key]) {
        toggle.classList.add("active");
      }
    }
  });
}

/**
 * Load accessible boats
 */
async function loadBoats() {
  const { boats, error } = await getAccessibleBoats();

  if (error) {
    console.error("Error loading boats:", error);
    return;
  }

  const container = document.getElementById("boat-selector");

  if (boats.length === 0) {
    container.innerHTML =
      '<p class="form-help">No boats found. Contact support to link your boat.</p>';
    return;
  }

  // Get current boat from localStorage
  currentBoatId = localStorage.getItem("currentBoatId") || boats[0]?.boat?.id;

  container.innerHTML = boats
    .map((access) => {
      const boat = access.boat;
      const isActive = boat.id === currentBoatId;

      return `
      <div class="boat-option ${isActive ? "active" : ""}" data-boat-id="${boat.id}">
        <div class="boat-name">${boat.name}</div>
        <div class="boat-details">
          ${boat.year || ""} ${boat.make || ""} ${boat.model || ""}
          ${access.is_primary ? " • Primary Contact" : ""}
        </div>
      </div>
    `;
    })
    .join("");

  // Add click handlers
  document.querySelectorAll(".boat-option").forEach((option) => {
    option.addEventListener("click", () =>
      handleBoatSwitch(option.dataset.boatId),
    );
  });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Logout button
  document.getElementById("logout-btn").addEventListener("click", async () => {
    const { success } = await logout();
    if (success) {
      window.location.href = "/login.html";
    }
  });

  // Profile form
  document
    .getElementById("profile-form")
    .addEventListener("submit", handleProfileSubmit);

  // Password form
  document
    .getElementById("password-form")
    .addEventListener("submit", handlePasswordSubmit);

  // Notification toggles
  document.querySelectorAll(".toggle-switch").forEach((toggle) => {
    toggle.addEventListener("click", () => handleToggle(toggle));
  });

  // Reminder days input
  document
    .getElementById("reminder-days")
    .addEventListener("change", handleReminderDaysChange);

  // Delete account button
  document
    .getElementById("delete-account-btn")
    .addEventListener("click", handleDeleteAccount);
}

/**
 * Handle profile form submission
 */
async function handleProfileSubmit(event) {
  event.preventDefault();
  hideAllAlerts();
  hideAllErrors();

  const newEmail = document.getElementById("email").value.trim();
  const newPhone = document.getElementById("phone").value.trim();

  let hasChanges = false;
  let hasErrors = false;

  // Validate email
  if (newEmail !== currentUser.email) {
    if (!isValidEmail(newEmail)) {
      showFieldError("email-error", "Please enter a valid email address");
      hasErrors = true;
    } else {
      hasChanges = true;
    }
  }

  if (hasErrors) {
    return;
  }

  if (!hasChanges && !newPhone) {
    showInfo("No changes to save");
    return;
  }

  // Disable submit button
  const submitBtn = document.getElementById("save-profile-btn");
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    // Update email if changed
    if (newEmail !== currentUser.email) {
      const { error } = await updateEmail(newEmail);
      if (error) {
        throw new Error(`Failed to update email: ${error}`);
      }
      showInfo(
        "Verification email sent to " +
          newEmail +
          ". Please check your inbox to confirm the change.",
      );
    }

    // Update phone
    if (newPhone) {
      const { error } = await updatePhone(newPhone);
      if (error) {
        throw new Error(`Failed to update phone: ${error}`);
      }
    }

    if (!newEmail || newEmail === currentUser.email) {
      showSuccess("Profile updated successfully");
    }
  } catch (error) {
    console.error("Profile update error:", error);
    showError(error.message || "Failed to update profile");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

/**
 * Handle password form submission
 */
async function handlePasswordSubmit(event) {
  event.preventDefault();
  hideAllAlerts();
  hideAllErrors();

  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;

  // Validate password
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    showFieldError("password-error", validation.message);
    return;
  }

  // Confirm passwords match
  if (newPassword !== confirmPassword) {
    showFieldError("confirm-password-error", "Passwords do not match");
    return;
  }

  // Disable submit button
  const submitBtn = document.getElementById("save-password-btn");
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Changing Password...";

  try {
    const { error } = await changePassword(newPassword);

    if (error) {
      throw new Error(error);
    }

    // Clear form
    document.getElementById("password-form").reset();

    showSuccess("Password changed successfully");
  } catch (error) {
    console.error("Password change error:", error);
    showError(error.message || "Failed to change password");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

/**
 * Handle notification toggle
 */
async function handleToggle(toggle) {
  const pref = toggle.dataset.pref;

  // Toggle UI
  toggle.classList.toggle("active");

  // Update preferences
  currentPreferences[pref] = toggle.classList.contains("active");

  // Save to database
  await saveNotificationPreferences();
}

/**
 * Handle reminder days change
 */
async function handleReminderDaysChange(event) {
  const days = parseInt(event.target.value);

  if (days < 1 || days > 7) {
    event.target.value = currentPreferences.reminder_days_before;
    return;
  }

  currentPreferences.reminder_days_before = days;

  // Save to database
  await saveNotificationPreferences();
}

/**
 * Save notification preferences
 */
async function saveNotificationPreferences() {
  const { error } = await updateNotificationPreferences(currentPreferences);

  if (error) {
    console.error("Error saving preferences:", error);
    showError("Failed to save notification preferences");
  }
}

/**
 * Handle boat switch
 */
async function handleBoatSwitch(boatId) {
  if (boatId === currentBoatId) {
    return;
  }

  const { success, error } = await switchCurrentBoat(boatId);

  if (error) {
    showError("Failed to switch boat: " + error);
    return;
  }

  // Update UI
  document.querySelectorAll(".boat-option").forEach((option) => {
    option.classList.toggle("active", option.dataset.boatId === boatId);
  });

  currentBoatId = boatId;

  showSuccess(
    "Switched to selected boat. Refresh the page to see updated data.",
  );
}

/**
 * Handle account deletion
 */
async function handleDeleteAccount() {
  const confirmed = confirm(
    "Are you sure you want to delete your account?\n\n" +
      "This action cannot be undone. You will lose access to all your data.\n\n" +
      "Click OK to proceed with deletion, or Cancel to keep your account.",
  );

  if (!confirmed) {
    return;
  }

  // Second confirmation
  const doubleConfirm = confirm(
    "This is your final warning.\n\n" +
      "Deleting your account will permanently remove all your data.\n\n" +
      "Are you absolutely sure?",
  );

  if (!doubleConfirm) {
    return;
  }

  try {
    const { success, error } = await deleteAccount();

    if (error) {
      throw new Error(error);
    }

    // Redirect to login
    window.location.href = "/login.html?message=account-deleted";
  } catch (error) {
    console.error("Delete account error:", error);
    showError("Failed to delete account. Please contact support.");
  }
}

/**
 * Show field error
 */
function showFieldError(errorId, message) {
  const errorElement = document.getElementById(errorId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add("visible");
  }
}

/**
 * Hide all field errors
 */
function hideAllErrors() {
  document.querySelectorAll(".form-error").forEach((error) => {
    error.classList.remove("visible");
  });
}

/**
 * Show success alert
 */
function showSuccess(message) {
  const alert = document.getElementById("success-alert");
  alert.textContent = message;
  alert.classList.add("visible");
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Auto-hide after 5 seconds
  setTimeout(() => {
    alert.classList.remove("visible");
  }, 5000);
}

/**
 * Show error alert
 */
function showError(message) {
  const alert = document.getElementById("error-alert");
  alert.textContent = message;
  alert.classList.add("visible");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Show info alert
 */
function showInfo(message) {
  const alert = document.getElementById("info-alert");
  alert.textContent = message;
  alert.classList.add("visible");
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Auto-hide after 5 seconds
  setTimeout(() => {
    alert.classList.remove("visible");
  }, 5000);
}

/**
 * Hide all alerts
 */
function hideAllAlerts() {
  document.getElementById("success-alert").classList.remove("visible");
  document.getElementById("error-alert").classList.remove("visible");
  document.getElementById("info-alert").classList.remove("visible");
}

// Initialize page
init();
