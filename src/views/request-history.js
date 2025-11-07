/**
 * Customer Portal - Request History View
 * Displays service request history and tracking
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
  loadServiceRequests,
  getRequestStats,
  formatDate,
  formatDateTime,
  getStatusClass,
  getStatusText,
  getPriorityClass,
  getPriorityText,
  getServiceTypeDisplay,
} from "../api/service-requests.js";

// Require authentication
const isAuth = await requireAuth();
if (!isAuth) {
  throw new Error("Not authenticated");
}

// State
let currentUser = null;
let currentBoatId = null;
let allRequests = [];
let filteredRequests = [];

/**
 * Initialize impersonation banner
 */
async function initImpersonationBanner() {
  const impersonatedId = sessionStorage.getItem("impersonatedCustomerId");

  if (!impersonatedId) {
    return;
  }

  const bannerEl = document.getElementById("impersonation-banner");
  const searchInput = document.getElementById("banner-customer-search");
  const datalist = document.getElementById("banner-customer-datalist");
  const exitBtn = document.getElementById("exit-impersonation-btn");

  if (bannerEl) {
    bannerEl.style.display = "flex";
  }

  // Hide header selector when impersonating
  const headerSelector = document.getElementById("admin-customer-selector");
  if (headerSelector) headerSelector.style.display = "none";

  // Load all customers for banner selector
  const { customers, error } = await getAllCustomers();
  if (error) {
    console.error("Failed to load customers for banner:", error);
    return;
  }

  // Populate banner datalist
  customers.forEach((customer) => {
    const option = document.createElement("option");
    option.value = customer.displayText;
    option.dataset.customerId = customer.id;
    datalist.appendChild(option);
  });

  // Set current value to impersonated customer
  if (currentUser) {
    const currentCustomer = customers.find((c) => c.id === currentUser.id);
    if (currentCustomer) {
      searchInput.value = currentCustomer.displayText;
    }
  }

  // Handle banner customer selection (quick switch)
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

  // Handle dropdown arrow click - show all customers
  const dropdownArrow = document.getElementById("banner-dropdown-arrow");
  if (dropdownArrow) {
    dropdownArrow.addEventListener("click", () => {
      searchInput.value = ""; // Clear to show all options
      searchInput.focus();
      // Trigger the datalist to show by dispatching events
      searchInput.click();
    });
  }

  // Handle exit button
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
    return;
  }

  if (boats.length === 0) {
    showEmptyState("No boats found. Please contact support to link your boat.");
    return;
  }

  // Get current boat (from localStorage or first boat)
  const savedBoatId = localStorage.getItem("currentBoatId");
  const boat = boats.find((b) => b.id === savedBoatId) || boats[0];
  currentBoatId = boat.id;

  // Load data
  await loadData();

  // Setup event listeners
  setupEventListeners();
}

/**
 * Load request data
 */
async function loadData() {
  // Load stats
  await loadStats();

  // Load requests
  await loadRequestList();
}

/**
 * Load request statistics
 */
async function loadStats() {
  const { stats, error } = await getRequestStats(currentBoatId);

  if (error) {
    console.error("Error loading stats:", error);
    return;
  }

  if (!stats) return;

  // Update stats display
  const statsRow = document.getElementById("stats-row");
  statsRow.innerHTML = `
    <div class="stat-card">
      <h4>Total Requests</h4>
      <p class="stat-value">${stats.total}</p>
    </div>
    <div class="stat-card">
      <h4>Pending</h4>
      <p class="stat-value">${stats.pending}</p>
    </div>
    <div class="stat-card">
      <h4>Scheduled</h4>
      <p class="stat-value">${stats.scheduled}</p>
    </div>
    <div class="stat-card">
      <h4>Completed</h4>
      <p class="stat-value">${stats.completed}</p>
    </div>
  `;
}

/**
 * Load request list
 */
async function loadRequestList() {
  const { requests, error } = await loadServiceRequests(currentBoatId);

  if (error) {
    console.error("Error loading requests:", error);
    showError("Failed to load requests. Please try again.");
    return;
  }

  allRequests = requests;
  filteredRequests = requests;

  renderRequests();
}

/**
 * Render request list
 */
function renderRequests() {
  const container = document.getElementById("request-list");

  if (filteredRequests.length === 0) {
    showEmptyState(
      'No service requests found. <a href="/portal-request-service.html" style="color: var(--ss-primary-600);">Submit your first request</a>',
    );
    return;
  }

  container.innerHTML = filteredRequests
    .map((request) => {
      const hasAttachments =
        request.attachments && request.attachments.length > 0;
      const hasAdminResponse = request.admin_notes || request.responded_at;

      return `
      <div class="request-item" data-request-id="${request.id}">
        <div class="request-header" onclick="toggleRequestDetails('${request.id}')">
          <div class="request-info">
            <div class="request-service-type">${getServiceTypeDisplay(request.service_type)}</div>
            <div class="request-date">
              Submitted ${formatDate(request.created_at)}
              ${
                request.request_type === "booking" && request.preferred_date
                  ? ` • Requested: ${formatDateTime(request.preferred_date, request.preferred_time)}`
                  : ""
              }
            </div>
          </div>
          <div class="request-badges">
            <span class="badge ${getStatusClass(request.status)}">
              ${getStatusText(request.status)}
            </span>
            <span class="badge ${getPriorityClass(request.priority)}">
              ${getPriorityText(request.priority)}
            </span>
            <span class="expand-icon" id="expand-${request.id}">▼</span>
          </div>
        </div>

        <div class="request-details" id="details-${request.id}">
          <div class="detail-row">
            <strong>Request Type:</strong>
            <span>${request.request_type === "inquiry" ? "General Inquiry" : "Booking Request"}</span>
          </div>

          ${
            request.preferred_date
              ? `
            <div class="detail-row">
              <strong>Preferred Date/Time:</strong>
              <span>${formatDateTime(request.preferred_date, request.preferred_time)}</span>
            </div>
          `
              : ""
          }

          ${
            request.notes
              ? `
            <div class="detail-row">
              <strong>Your Notes:</strong>
              <span>${request.notes}</span>
            </div>
          `
              : ""
          }

          ${
            hasAttachments
              ? `
            <div class="detail-row">
              <strong>Attachments:</strong>
              <div class="attachment-preview">
                ${request.attachments
                  .map(
                    (att) => `
                  <a href="${att.url}" target="_blank">
                    ${
                      att.type && att.type.startsWith("image/")
                        ? `<img src="${att.url}" alt="${att.filename}">`
                        : `<p>${att.filename}</p>`
                    }
                  </a>
                `,
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }

          ${
            hasAdminResponse
              ? `
            <div class="admin-response">
              <strong>Response from Sailor Skills</strong>
              ${
                request.responded_at
                  ? `
                <div style="font-size: var(--ss-font-size-xs); color: var(--ss-neutral-600); margin-bottom: var(--ss-space-xs);">
                  ${formatDate(request.responded_at)}
                </div>
              `
                  : ""
              }
              ${
                request.admin_notes
                  ? `
                <p style="color: var(--ss-neutral-700); font-size: var(--ss-font-size-sm);">
                  ${request.admin_notes}
                </p>
              `
                  : ""
              }
              ${
                request.status === "scheduled" && request.scheduled_service_id
                  ? `
                <p style="margin-top: var(--ss-space-xs); font-weight: 600;">
                  ✓ Service has been scheduled
                </p>
              `
                  : ""
              }
            </div>
          `
              : request.status === "pending"
                ? `
            <div class="detail-row">
              <span style="color: var(--ss-neutral-600); font-style: italic;">
                We're reviewing your request and will respond soon.
              </span>
            </div>
          `
                : ""
          }
        </div>
      </div>
    `;
    })
    .join("");
}

/**
 * Toggle request details
 * @param {string} requestId - Request ID
 */
window.toggleRequestDetails = function (requestId) {
  const details = document.getElementById(`details-${requestId}`);
  const icon = document.getElementById(`expand-${requestId}`);

  if (details.classList.contains("expanded")) {
    details.classList.remove("expanded");
    icon.classList.remove("expanded");
  } else {
    details.classList.add("expanded");
    icon.classList.add("expanded");
  }
};

/**
 * Apply filters
 */
function applyFilters() {
  const statusFilter = document.getElementById("status-filter").value;

  filteredRequests = allRequests.filter((request) => {
    // Status filter
    if (statusFilter && request.status !== statusFilter) {
      return false;
    }

    return true;
  });

  renderRequests();
}

/**
 * Show empty state
 * @param {string} message - Message to display
 */
function showEmptyState(message) {
  const container = document.getElementById("request-list");
  container.innerHTML = `
    <div class="empty-state">
      <p>${message}</p>
    </div>
  `;
}

/**
 * Show error
 * @param {string} message - Error message
 */
function showError(message) {
  const container = document.getElementById("request-list");
  container.innerHTML = `
    <div class="empty-state">
      <p style="color: var(--ss-error-600);">${message}</p>
    </div>
  `;
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

  // Filter changes
  document
    .getElementById("status-filter")
    .addEventListener("change", applyFilters);
}

// Initialize page
init();
