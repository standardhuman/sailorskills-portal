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
  try {
    // Check for auth tokens in URL hash (magic link callback)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hasAuthToken = hashParams.has("access_token");

    // Get current session
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Session error:", error);
    }

    // Only redirect if we have a VALID session
    if (session && session.user) {
      // Verify the session is actually valid by checking expiry
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at > now) {
        console.log("Valid session found, redirecting to portal");
        const redirect =
          sessionStorage.getItem("redirectAfterLogin") || "/portal.html";
        sessionStorage.removeItem("redirectAfterLogin");
        window.location.href = redirect;
        return;
      } else {
        console.log("Session expired, clearing");
        await supabase.auth.signOut();
      }
    } else if (hasAuthToken) {
      // Magic link callback with tokens, but session not established yet
      // Wait a moment for Supabase to process the tokens
      console.log("Auth tokens detected, waiting for session...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check again
      const {
        data: { session: newSession },
      } = await supabase.auth.getSession();
      if (newSession && newSession.user) {
        console.log("Session established after token processing");
        window.location.href = "/portal.html";
        return;
      }
    }

    // Check for error in URL hash (magic link expired, etc.)
    const errorDescription = hashParams.get("error_description");
    if (errorDescription) {
      showAlert("error", `Authentication error: ${errorDescription}`);
    }
  } catch (err) {
    console.error("Login initialization error:", err);
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
