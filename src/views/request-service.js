/**
 * Customer Portal - Request Service View
 * Handles service request form submission
 */

import {
  requireAuth,
  getCurrentUser,
  getEffectiveUser,
  getUserBoats,
  logout,
  isAdmin,
  setImpersonation,
  clearImpersonation,
} from "../auth/auth.js";
import { getAllCustomers } from "../api/customers.js";
import {
  submitInquiry,
  submitBooking,
  uploadRequestPhoto,
} from "../api/service-requests.js";

// Require authentication
const isAuth = await requireAuth();
if (!isAuth) {
  throw new Error("Not authenticated");
}

// State
let currentUser = null;
let currentBoatId = null;
let uploadedPhoto = null;
let requestType = "inquiry"; // 'inquiry' or 'booking'

/**
 * Initialize impersonation banner
 */
async function initImpersonationBanner() {
  const impersonatedId = sessionStorage.getItem("impersonatedCustomerId");
  if (!impersonatedId) return;

  const bannerEl = document.getElementById("impersonation-banner");
  const displayEl = document.getElementById("impersonated-customer-display");
  const exitBtn = document.getElementById("exit-impersonation-btn");

  if (bannerEl) bannerEl.style.display = "flex";
  if (displayEl && currentUser) displayEl.textContent = currentUser.email;
  if (exitBtn) {
    exitBtn.addEventListener("click", () => {
      clearImpersonation();
      window.location.reload();
    });
  }
}

/**
 * Initialize customer selector for admins
 */
async function initCustomerSelector() {
  const adminStatus = await isAdmin(currentUser.id);
  if (!adminStatus) return;

  const selectorEl = document.getElementById("admin-customer-selector");
  const searchInput = document.getElementById("customer-search");
  const datalist = document.getElementById("customer-datalist");

  if (!selectorEl || !searchInput || !datalist) return;
  selectorEl.style.display = "flex";

  const { customers, error } = await getAllCustomers();
  if (error) {
    console.error("Failed to load customers for selector:", error);
    return;
  }

  customers.forEach((customer) => {
    const option = document.createElement("option");
    option.value = customer.displayText;
    option.dataset.customerId = customer.id;
    datalist.appendChild(option);
  });

  searchInput.addEventListener("change", async (e) => {
    const selectedText = e.target.value;
    const selectedOption = Array.from(datalist.options).find(
      (opt) => opt.value === selectedText,
    );

    if (selectedOption) {
      const customerId = selectedOption.dataset.customerId;
      const { success } = await setImpersonation(customerId);
      if (success) window.location.reload();
    }
  });
}

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

  // Initialize impersonation UI
  await initImpersonationBanner();
  await initCustomerSelector();

  // Get user's boats
  const { boats, error: boatsError } = await getUserBoats(currentUser.id);
  if (boatsError) {
    console.error("Error loading boats:", boatsError);
    showError("Failed to load boat information. Please try again.");
    return;
  }

  if (boats.length === 0) {
    showError(
      "No boats found. Please contact support to link your boat before requesting service.",
    );
    document.getElementById("service-request-form").style.display = "none";
    return;
  }

  // Get current boat (from localStorage or first boat)
  const savedBoatId = localStorage.getItem("currentBoatId");
  const boat = boats.find((b) => b.id === savedBoatId) || boats[0];
  currentBoatId = boat.id;

  // Setup event listeners
  setupEventListeners();

  // Set minimum date to today
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("preferred-date").setAttribute("min", today);
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

  // Request type toggle
  const toggleButtons = document.querySelectorAll(".toggle-option");
  toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Update active state
      toggleButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Update request type
      requestType = button.dataset.type;

      // Show/hide booking fields
      const bookingFields = document.getElementById("booking-fields");
      if (requestType === "booking") {
        bookingFields.classList.remove("hidden");
        document
          .getElementById("preferred-date")
          .setAttribute("required", "required");
      } else {
        bookingFields.classList.add("hidden");
        document.getElementById("preferred-date").removeAttribute("required");
      }
    });
  });

  // Photo upload
  const photoUploadArea = document.getElementById("photo-upload-area");
  const photoInput = document.getElementById("photo-input");

  photoUploadArea.addEventListener("click", () => {
    photoInput.click();
  });

  photoInput.addEventListener("change", handlePhotoSelect);

  // Remove photo button
  document
    .getElementById("remove-photo-btn")
    .addEventListener("click", removePhoto);

  // Form submission
  document
    .getElementById("service-request-form")
    .addEventListener("submit", handleSubmit);
}

/**
 * Handle photo selection
 * @param {Event} event - Change event
 */
async function handlePhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith("image/")) {
    showError("Please upload an image file");
    return;
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showError("Image file size must be less than 5MB");
    return;
  }

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("preview-image").src = e.target.result;
    document.getElementById("photo-name").textContent = file.name;
    document.getElementById("photo-preview").classList.add("visible");
  };
  reader.readAsDataURL(file);

  // Store file for upload
  uploadedPhoto = file;
}

/**
 * Remove photo
 */
function removePhoto() {
  document.getElementById("photo-input").value = "";
  document.getElementById("photo-preview").classList.remove("visible");
  uploadedPhoto = null;
}

/**
 * Handle form submission
 * @param {Event} event - Submit event
 */
async function handleSubmit(event) {
  event.preventDefault();

  // Clear previous errors
  hideAllErrors();
  hideAllAlerts();

  // Validate form
  if (!validateForm()) {
    return;
  }

  // Disable submit button
  const submitBtn = document.getElementById("submit-btn");
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  try {
    // Upload photo if provided
    let photoAttachment = null;
    if (uploadedPhoto) {
      const {
        url,
        filename,
        size,
        type,
        error: uploadError,
      } = await uploadRequestPhoto(uploadedPhoto, currentBoatId);

      if (uploadError) {
        throw new Error(`Failed to upload photo: ${uploadError}`);
      }

      photoAttachment = { url, filename, size, type };
    }

    // Prepare request data
    const requestData = {
      serviceType: document.getElementById("service-type").value,
      priority: document.getElementById("priority").value,
      notes: document.getElementById("notes").value.trim() || null,
      attachments: photoAttachment ? [photoAttachment] : [],
    };

    // Add booking-specific fields if applicable
    if (requestType === "booking") {
      requestData.preferredDate =
        document.getElementById("preferred-date").value;
      requestData.preferredTime =
        document.getElementById("preferred-time").value || null;
    }

    // Submit request
    let result;
    if (requestType === "inquiry") {
      result = await submitInquiry(currentBoatId, requestData);
    } else {
      result = await submitBooking(currentBoatId, requestData);
    }

    if (result.error) {
      throw new Error(result.error);
    }

    // Show success message
    showSuccess();

    // Reset form
    document.getElementById("service-request-form").reset();
    removePhoto();

    // Redirect to dashboard after 2 seconds
    setTimeout(() => {
      window.location.href = "/portal.html";
    }, 2000);
  } catch (error) {
    console.error("Submit error:", error);
    showError(error.message || "Failed to submit request. Please try again.");
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

/**
 * Validate form
 * @returns {boolean}
 */
function validateForm() {
  let isValid = true;

  // Validate service type
  const serviceType = document.getElementById("service-type").value;
  if (!serviceType) {
    showFieldError("service-type-error");
    isValid = false;
  }

  // Validate preferred date for booking requests
  if (requestType === "booking") {
    const preferredDate = document.getElementById("preferred-date").value;
    if (!preferredDate) {
      showFieldError("preferred-date-error");
      isValid = false;
    }
  }

  return isValid;
}

/**
 * Show field error
 * @param {string} errorId - Error element ID
 */
function showFieldError(errorId) {
  const errorElement = document.getElementById(errorId);
  if (errorElement) {
    errorElement.classList.add("visible");
  }
}

/**
 * Hide all field errors
 */
function hideAllErrors() {
  const errors = document.querySelectorAll(".form-error");
  errors.forEach((error) => error.classList.remove("visible"));
}

/**
 * Show success alert
 */
function showSuccess() {
  const alert = document.getElementById("success-alert");
  alert.classList.add("visible");

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Show error alert
 * @param {string} message - Error message
 */
function showError(message) {
  const alert = document.getElementById("error-alert");
  document.getElementById("error-message").textContent = message;
  alert.classList.add("visible");

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Hide all alerts
 */
function hideAllAlerts() {
  document.getElementById("success-alert").classList.remove("visible");
  document.getElementById("error-alert").classList.remove("visible");
}

// Initialize page
init();
