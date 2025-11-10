/**
 * Login Page Logic
 * Handles password and magic link authentication
 */

import {
  loginWithEmail,
  loginWithMagicLink,
  isAuthenticated,
  supabase,
} from "./auth.js";

// Check if already authenticated or handle magic link callback
(async () => {
  // First, check for magic link tokens in URL (Supabase will auto-detect)
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Session error:", error);
  }

  if (session) {
    // User is authenticated (either existing session or magic link callback)
    const redirect =
      sessionStorage.getItem("redirectAfterLogin") || "/portal.html";
    sessionStorage.removeItem("redirectAfterLogin");
    window.location.href = redirect;
    return;
  }

  // Check for error in URL hash (magic link expired, etc.)
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const errorDescription = hashParams.get("error_description");
  if (errorDescription) {
    showAlert("error", `Authentication error: ${errorDescription}`);
  }
})();

// Tab switching
const tabs = document.querySelectorAll(".auth-tab");
const panels = document.querySelectorAll(".auth-panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const targetTab = tab.dataset.tab;

    // Update active tab
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    // Update active panel
    panels.forEach((p) => p.classList.remove("active"));
    document.getElementById(`${targetTab}-panel`).classList.add("active");
  });
});

// Password login form
const passwordLoginForm = document.getElementById("password-login-form");
const passwordLoginBtn = document.getElementById("password-login-btn");

passwordLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("password-email").value.trim();
  const password = document.getElementById("password").value;

  // Disable button
  passwordLoginBtn.disabled = true;
  passwordLoginBtn.textContent = "Signing in...";

  // Clear any previous alerts
  clearAlerts();

  // Attempt login
  const { user, error } = await loginWithEmail(email, password);

  if (error) {
    showAlert("error", error);
    passwordLoginBtn.disabled = false;
    passwordLoginBtn.textContent = "Sign In";
    return;
  }

  // Success - redirect
  const redirect =
    sessionStorage.getItem("redirectAfterLogin") || "/portal.html";
  sessionStorage.removeItem("redirectAfterLogin");
  window.location.href = redirect;
});

// Magic link form
const magicLinkForm = document.getElementById("magic-link-form");
const magicLinkBtn = document.getElementById("magic-link-btn");

magicLinkForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("magic-link-email").value.trim();

  // Disable button
  magicLinkBtn.disabled = true;
  magicLinkBtn.textContent = "Sending...";

  // Clear any previous alerts
  clearAlerts();

  // Send magic link
  const { success, error } = await loginWithMagicLink(email);

  if (error) {
    showAlert("error", error);
    magicLinkBtn.disabled = false;
    magicLinkBtn.textContent = "Send Magic Link";
    return;
  }

  // Success
  showAlert(
    "success",
    `Magic link sent to ${email}! Check your inbox and click the link to sign in.`,
  );
  magicLinkBtn.disabled = false;
  magicLinkBtn.textContent = "Send Magic Link";
  magicLinkForm.reset();
});

/**
 * Show alert message
 * @param {string} type - 'success' or 'error'
 * @param {string} message - Alert message
 */
function showAlert(type, message) {
  const alertContainer = document.getElementById("alert-container");
  const alertClass = type === "success" ? "alert-success" : "alert-error";

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
  const alertContainer = document.getElementById("alert-container");
  alertContainer.innerHTML = "";
}
