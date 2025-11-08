/**
 * Payment Setup View
 * Handles adding payment methods to customer accounts
 */

import { createSupabaseClient } from "../lib/supabase.js";

// Initialize Supabase client
const supabase = createSupabaseClient();

// Get Stripe publishable key from environment
const STRIPE_PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  "pk_test_51QBWb1P2sHTtHN9K0MQb4HKXD2VF7x6Zm8KvxPWdW0XdBaBT1lHg9zFwZHYB6kZN7fPPwaNQJd7b6dI6fEZxZcIU00uF6eGC7t";

// Initialize Stripe
let stripe;
let elements;
let cardElement;

// DOM Elements
const paymentForm = document.getElementById("payment-form");
const submitBtn = document.getElementById("submit-btn");
const cardErrors = document.getElementById("card-errors");
const successAlert = document.getElementById("success-alert");
const errorAlert = document.getElementById("error-alert");
const infoAlert = document.getElementById("info-alert");
const paymentFormContainer = document.getElementById("payment-form-container");
const successMessage = document.getElementById("success-message");
const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");

// State
let currentUser = null;

/**
 * Show alert message
 */
function showAlert(type, message) {
  const alerts = {
    success: successAlert,
    error: errorAlert,
    info: infoAlert,
  };

  // Hide all alerts
  Object.values(alerts).forEach((alert) => {
    alert.classList.add("hidden");
    alert.textContent = "";
  });

  // Show specific alert
  const alert = alerts[type];
  if (alert) {
    alert.textContent = message;
    alert.classList.remove("hidden");

    // Auto-hide after 5 seconds (except errors)
    if (type !== "error") {
      setTimeout(() => {
        alert.classList.add("hidden");
      }, 5000);
    }
  }
}

/**
 * Initialize Stripe Elements
 */
function initializeStripe() {
  if (!STRIPE_PUBLISHABLE_KEY) {
    console.error("Stripe publishable key not found");
    showAlert(
      "error",
      "Payment system configuration error. Please contact support.",
    );
    return false;
  }

  try {
    // Initialize Stripe
    stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

    // Create Elements instance
    elements = stripe.elements();

    // Create card element with styling
    cardElement = elements.create("card", {
      style: {
        base: {
          fontSize: "16px",
          color: "#000",
          fontFamily: "Montserrat, Arial, sans-serif",
          "::placeholder": {
            color: "#999",
          },
        },
        invalid: {
          color: "#d63031",
          iconColor: "#d63031",
        },
      },
    });

    // Mount card element
    cardElement.mount("#card-element");

    // Handle real-time validation errors
    cardElement.on("change", (event) => {
      if (event.error) {
        cardErrors.textContent = event.error.message;
      } else {
        cardErrors.textContent = "";
      }
    });

    return true;
  } catch (error) {
    console.error("Error initializing Stripe:", error);
    showAlert(
      "error",
      "Failed to initialize payment system. Please refresh the page.",
    );
    return false;
  }
}

/**
 * Get customer data
 */
async function getCustomerData() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Get customer record
    const { data: customer, error } = await supabase
      .from("customers")
      .select("id, email, name, stripe_customer_id")
      .eq("email", user.email)
      .single();

    if (error) {
      console.error("Error fetching customer:", error);
      throw new Error("Customer record not found");
    }

    return customer;
  } catch (error) {
    console.error("Error getting customer data:", error);
    throw error;
  }
}

/**
 * Handle form submission
 */
async function handleSubmit(event) {
  event.preventDefault();

  // Disable submit button
  submitBtn.disabled = true;
  submitBtn.textContent = "Processing...";

  try {
    // Clear previous errors
    showAlert("info", "Setting up your payment method...");

    // Get customer data
    const customer = await getCustomerData();

    // Call edge function to create SetupIntent
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/setup-payment-method`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          customerId: customer.id,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to setup payment method");
    }

    const { clientSecret } = await response.json();

    // Confirm card setup with Stripe
    const result = await stripe.confirmCardSetup(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: customer.name,
          email: customer.email,
        },
      },
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    // Success!
    console.log("Payment method setup successful:", result.setupIntent);

    // Hide form, show success message
    paymentFormContainer.classList.add("hidden");
    successMessage.classList.remove("hidden");
    showAlert("success", "Payment method added successfully!");
  } catch (error) {
    console.error("Payment setup error:", error);
    showAlert(
      "error",
      error.message || "Failed to setup payment method. Please try again.",
    );
  } finally {
    // Re-enable submit button
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Payment Method";
  }
}

/**
 * Check authentication and load user
 */
async function checkAuth() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Redirect to login
      window.location.href = "/login.html?redirect=/portal-payment-setup.html";
      return false;
    }

    currentUser = user;
    userEmailEl.textContent = user.email;

    return true;
  } catch (error) {
    console.error("Auth error:", error);
    window.location.href = "/login.html";
    return false;
  }
}

/**
 * Handle logout
 */
async function handleLogout() {
  try {
    await supabase.auth.signOut();
    window.location.href = "/login.html";
  } catch (error) {
    console.error("Logout error:", error);
    showAlert("error", "Failed to logout. Please try again.");
  }
}

/**
 * Initialize page
 */
async function init() {
  // Check authentication
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) {
    return;
  }

  // Initialize Stripe
  const stripeInitialized = initializeStripe();
  if (!stripeInitialized) {
    return;
  }

  // Setup event listeners
  paymentForm.addEventListener("submit", handleSubmit);
  logoutBtn.addEventListener("click", handleLogout);

  // Check if customer already has a payment method
  try {
    const customer = await getCustomerData();
    if (customer.stripe_customer_id) {
      showAlert(
        "info",
        "You already have a payment method on file. Adding a new one will replace the existing method.",
      );
    }
  } catch (error) {
    console.error("Error checking existing payment method:", error);
  }
}

// Initialize when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
