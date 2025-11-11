/**
 * Service History View
 * Customer-facing service history page
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
  loadServiceLogs,
  getServiceStats,
  formatDate,
  formatShortDate,
  formatHours,
  getConditionClass,
} from "../api/service-logs.js";
import {
  getBoatPlaylist,
  getPlaylistVideos,
  convertAnodePercentToCondition,
  isAnodeReplaced,
} from "../api/boat-data.js";

// Require authentication (redirects to SSO login)
const isAuth = await requireAuth();
if (!isAuth) {
  throw new Error("Not authenticated");
}

// Get current user and boats
const { user, error: userError } = await getEffectiveUser();
if (userError || !user) {
  console.error("Failed to get user:", userError);
  window.location.href = "/login.html";
  throw new Error("User not found");
}

// DOM Elements (must be defined before any potential showEmptyState() calls)
const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");
const timelineContainer = document.getElementById("service-timeline");
const statTotalEl = document.getElementById("stat-total");
const statYearEl = document.getElementById("stat-year");
const statLastEl = document.getElementById("stat-last");

const { boats, error: boatsError } = await getUserBoats(user.id);
if (boatsError || !boats || boats.length === 0) {
  console.error("Failed to get boats:", boatsError);
  showEmptyState("No boats found. Please contact support.");
  throw new Error("No boats found");
}

// Get the currently selected boat from localStorage (set by portal.js)
let currentBoat = null;
let selectedBoatId = localStorage.getItem("currentBoatId");
if (selectedBoatId && boats.find((b) => b.id === selectedBoatId)) {
  currentBoat = boats.find((b) => b.id === selectedBoatId);
} else {
  // Select primary boat or first boat
  const primaryBoat = boats.find((b) => b.isPrimary);
  currentBoat = primaryBoat || boats[0];
  selectedBoatId = currentBoat.id;
}

// Check if user is admin
const isAdminUser = await isAdmin(user.id);

// Playlist data (fetched once, used for all service logs)
let boatPlaylist = null;
let playlistVideos = [];

/**
 * Initialize admin selectors (customer and boat)
 */
async function initAdminSelectors() {
  if (!isAdminUser) return;

  const selectorsEl = document.getElementById("admin-selectors");
  selectorsEl.style.display = "flex";

  // Initialize customer selector
  const customerSearch = document.getElementById("customer-search");
  const customerDatalist = document.getElementById("customer-datalist");

  const { customers, error } = await getAllCustomers();
  if (error) {
    console.error("Failed to load customers:", error);
  } else {
    customers.forEach((customer) => {
      const option = document.createElement("option");
      option.value = customer.displayText;
      option.dataset.customerId = customer.id;
      customerDatalist.appendChild(option);
    });

    customerSearch.addEventListener("change", async (e) => {
      const selectedText = e.target.value;
      const selectedOption = Array.from(customerDatalist.options).find(
        (opt) => opt.value === selectedText,
      );

      if (selectedOption) {
        const customerId = selectedOption.dataset.customerId;
        const { success } = await setImpersonation(customerId);
        if (success) window.location.reload();
      }
    });
  }

  // Initialize boat selector
  const boatSearch = document.getElementById("boat-search");
  const boatDatalist = document.getElementById("boat-datalist");

  if (boats.length > 0) {
    boats.forEach((boat) => {
      const option = document.createElement("option");
      option.value = boat.name + (boat.isPrimary ? " (Primary)" : "");
      option.dataset.boatId = boat.id;
      boatDatalist.appendChild(option);
    });

    // Set initial value
    if (selectedBoatId) {
      const selectedBoat = boats.find((b) => b.id === selectedBoatId);
      if (selectedBoat) {
        boatSearch.value =
          selectedBoat.name + (selectedBoat.isPrimary ? " (Primary)" : "");
      }
    }

    boatSearch.addEventListener("change", async (e) => {
      const selectedText = e.target.value;
      const selectedOption = Array.from(boatDatalist.options).find(
        (opt) => opt.value === selectedText,
      );

      if (selectedOption) {
        selectedBoatId = selectedOption.dataset.boatId;
        localStorage.setItem("currentBoatId", selectedBoatId);
        currentBoat = boats.find((b) => b.id === selectedBoatId);
        await loadServiceStats();
        await loadServices();
      }
    });
  }
}

/**
 * Initialize impersonation banner (DEPRECATED - kept for compatibility)
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
  if (user) {
    const currentCustomer = customers.find((c) => c.id === user.id);
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
 * Setup event listeners
 */
function setupEventListeners() {
  // Logout handler
  logoutBtn.addEventListener("click", async () => {
    await logout();
    window.location.href = "/login.html";
  });
}

// Initialize
async function init() {
  // Set user email with admin badge if applicable
  if (isAdminUser) {
    userEmailEl.innerHTML = `${user.email} <span style="display: inline-block; margin-left: 8px; padding: 2px 8px; background: #ff6b6b; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">ADMIN</span>`;
  } else {
    userEmailEl.textContent = user.email;
  }

  // Initialize admin selectors
  await initAdminSelectors();

  // Setup event listeners
  setupEventListeners();

  await loadServiceStats();
  await loadServices();
}

/**
 * Load service statistics
 */
async function loadServiceStats() {
  const { stats, error } = await getServiceStats(currentBoat.id);

  if (error) {
    console.error("Failed to load stats:", error);
    return;
  }

  if (stats) {
    statTotalEl.textContent = stats.total || 0;
    statYearEl.textContent = stats.thisYear || 0;

    if (stats.lastServiceDate) {
      statLastEl.textContent = formatShortDate(stats.lastServiceDate);
    } else {
      statLastEl.textContent = "None";
    }
  }
}

/**
 * Load service logs
 */
async function loadServices() {
  // Show loading
  timelineContainer.innerHTML =
    '<div class="loader">Loading service history...</div>';

  // Load all service logs
  const { serviceLogs, error } = await loadServiceLogs(currentBoat.id);

  if (error) {
    console.error("Failed to load service logs:", error);
    showError("Failed to load service history. Please try again.");
    return;
  }

  // Display service logs
  if (serviceLogs.length === 0) {
    showEmptyState("No service history found for the selected time period.");
    return;
  }

  // Fetch playlist and videos (once per load)
  await loadPlaylistData();

  displayServiceLogs(serviceLogs);
}

/**
 * Load playlist data for the boat
 */
async function loadPlaylistData() {
  try {
    // Fetch boat's YouTube playlist
    const { playlist, error: playlistError } = await getBoatPlaylist(
      currentBoat.id,
    );

    if (playlistError) {
      console.warn("Error loading playlist (may not exist):", playlistError);
      boatPlaylist = null;
      playlistVideos = [];
      return;
    }

    if (!playlist) {
      console.log("No playlist found for this boat");
      boatPlaylist = null;
      playlistVideos = [];
      return;
    }

    boatPlaylist = playlist;

    // Fetch all videos from the playlist (up to 50)
    // Wrap in timeout to prevent blocking the page
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Video fetch timeout")), 5000),
    );

    const videoPromise = getPlaylistVideos(
      playlist.playlist_id,
      null, // No date filter - fetch all videos
      50,
    );

    const { videos, error: videosError } = await Promise.race([
      videoPromise,
      timeoutPromise,
    ]).catch((err) => {
      console.warn("Video fetch timed out or failed:", err.message);
      return { videos: [], error: err };
    });

    if (videosError) {
      console.warn(
        "Error fetching playlist videos (continuing without videos):",
        videosError,
      );
      playlistVideos = [];
      return;
    }

    playlistVideos = videos || [];
    console.log(`Loaded ${playlistVideos.length} videos from playlist`);
  } catch (err) {
    console.error(
      "Exception in loadPlaylistData (continuing without videos):",
      err,
    );
    boatPlaylist = null;
    playlistVideos = [];
  }
}

/**
 * Display service logs
 */
function displayServiceLogs(logs) {
  timelineContainer.innerHTML = logs
    .map((log, index) => {
      // Get next service date for video filtering
      const nextServiceDate = index > 0 ? logs[index - 1].service_date : null;
      return createTimelineItem(log, index, nextServiceDate);
    })
    .join("");

  // Add click handlers to expand/collapse
  document.querySelectorAll(".timeline-item").forEach((item, index) => {
    item.addEventListener("click", (e) => {
      // Don't toggle if clicking on a link or button
      if (e.target.tagName === "A" || e.target.tagName === "BUTTON") {
        return;
      }

      const details = item.querySelector(".timeline-details");
      const icon = item.querySelector(".expand-icon");

      details.classList.toggle("expanded");
      icon.classList.toggle("expanded");
    });
  });
}

/**
 * Create timeline item HTML
 * @param {Object} log - Service log
 * @param {number} index - Item index
 * @param {string|null} nextServiceDate - Next service date if available
 * @returns {string} HTML string
 */
function createTimelineItem(log, index, nextServiceDate = null) {
  const hasDetails =
    log.paint_condition_overall ||
    log.growth_level ||
    log.thru_hull_condition ||
    (log.anode_conditions && log.anode_conditions.length > 0) ||
    (log.propeller_conditions && log.propeller_conditions.length > 0) ||
    log.notes ||
    (log.service_videos && log.service_videos.length > 0);

  // Build condition badges array
  const badges = [];

  if (log.paint_condition_overall) {
    const paintCondition = log.paint_condition_overall.toLowerCase();
    badges.push({
      label: `Paint: ${formatConditionText(paintCondition)}`,
      class: getConditionClass(paintCondition),
    });
  }

  if (log.growth_level) {
    const growthLevel = log.growth_level.toLowerCase();
    badges.push({
      label: `Growth: ${formatConditionText(growthLevel)}`,
      class: getConditionClass(growthLevel),
    });
  }

  if (log.thru_hull_condition) {
    badges.push({
      label: `Through-Hulls: ${log.thru_hull_condition}`,
      class: getConditionClass(log.thru_hull_condition),
    });
  }

  // Anode conditions - parse JSON if needed
  if (log.anode_conditions) {
    let anodeConditions = log.anode_conditions;
    if (typeof log.anode_conditions === "string") {
      try {
        anodeConditions = JSON.parse(log.anode_conditions);
      } catch (e) {
        console.error("Error parsing anode_conditions:", e);
        anodeConditions = null;
      }
    }

    // Handle array or object format
    if (anodeConditions && !Array.isArray(anodeConditions)) {
      anodeConditions = anodeConditions.anodes || [];
    }

    if (anodeConditions && anodeConditions.length > 0) {
      const anodeStatus = anodeConditions.some(
        (a) =>
          a.condition?.toLowerCase().includes("replace") ||
          a.condition?.toLowerCase().includes("poor"),
      )
        ? "needs-replacement"
        : "good";

      badges.push({
        label: `Anodes: ${anodeConditions.length} inspected`,
        class: `condition-${anodeStatus}`,
      });
    }
  }

  // Propeller conditions - parse JSON if needed
  if (log.propeller_conditions) {
    let propellerConditions = log.propeller_conditions;
    if (typeof log.propeller_conditions === "string") {
      try {
        propellerConditions = JSON.parse(log.propeller_conditions);
      } catch (e) {
        console.error("Error parsing propeller_conditions:", e);
        propellerConditions = null;
      }
    }

    // Handle array or object format
    if (propellerConditions && !Array.isArray(propellerConditions)) {
      propellerConditions = propellerConditions.propellers || [];
    }

    if (propellerConditions && propellerConditions.length > 0) {
      const propCondition = propellerConditions[0]?.condition || "inspected";
      badges.push({
        label: `Propeller: ${propCondition}`,
        class: `condition-${propCondition.toLowerCase().replace(/\s+/g, "-")}`,
      });
    }
  }

  return `
    <div class="timeline-item" data-index="${index}">
      <div class="timeline-header">
        <div class="timeline-title-row">
          <div>
            <div class="timeline-date">${formatDate(log.service_date)}</div>
            ${log.service_name ? `<div class="service-name">${escapeHtml(log.service_name)}</div>` : ""}
          </div>
          ${hasDetails ? '<span class="expand-icon">▼</span>' : ""}
        </div>
        ${
          badges.length > 0
            ? `
        <div class="condition-badges-row">
          ${badges.map((badge) => `<span class="condition-badge ${badge.class}">${escapeHtml(badge.label)}</span>`).join("")}
        </div>
        `
            : ""
        }
      </div>

      ${
        hasDetails
          ? `
        <div class="timeline-details" id="details-${index}">
          ${createConditionsSection(log)}
          ${createAnodesSection(log)}
          ${createPropellersSection(log)}
          ${createNotesSection(log)}
          ${createVideosSection(log, nextServiceDate)}
        </div>
      `
          : ""
      }
    </div>
  `;
}

/**
 * Create conditions section - show detailed paint areas only
 * (Overall conditions are shown as badges above)
 */
function createConditionsSection(log) {
  const hasDetailedConditions =
    log.paint_detail_keel ||
    log.paint_detail_waterline ||
    log.paint_detail_boot_stripe ||
    log.thru_hull_notes;

  if (!hasDetailedConditions) return "";

  return `
    <div class="detail-section">
      <h4>Paint Details</h4>
      <div class="detail-grid">
        ${
          log.paint_detail_keel
            ? `
          <div class="detail-item">
            <div class="detail-label">Keel</div>
            <div class="detail-value">${escapeHtml(log.paint_detail_keel)}</div>
          </div>
        `
            : ""
        }

        ${
          log.paint_detail_waterline
            ? `
          <div class="detail-item">
            <div class="detail-label">Waterline</div>
            <div class="detail-value">${escapeHtml(log.paint_detail_waterline)}</div>
          </div>
        `
            : ""
        }

        ${
          log.paint_detail_boot_stripe
            ? `
          <div class="detail-item">
            <div class="detail-label">Boot Stripe</div>
            <div class="detail-value">${escapeHtml(log.paint_detail_boot_stripe)}</div>
          </div>
        `
            : ""
        }
      </div>

      ${
        log.thru_hull_notes
          ? `
        <div style="margin-top: var(--ss-space-sm); font-size: var(--ss-text-sm); color: var(--ss-text-medium); font-style: italic;">
          <strong>Through-Hull Notes:</strong> ${escapeHtml(log.thru_hull_notes)}
        </div>
      `
          : ""
      }
    </div>
  `;
}

/**
 * Create anodes section
 */
function createAnodesSection(log) {
  if (!log.anode_conditions) return "";

  // Parse JSON string if needed
  let anodeConditions;
  if (typeof log.anode_conditions === "string") {
    try {
      anodeConditions = JSON.parse(log.anode_conditions);
    } catch (e) {
      console.error("Error parsing anode_conditions:", e);
      return "";
    }
  } else {
    anodeConditions = log.anode_conditions;
  }

  // Handle array or object format
  if (!Array.isArray(anodeConditions)) {
    anodeConditions = anodeConditions.anodes || [];
  }

  if (anodeConditions.length === 0) return "";

  return `
    <div class="detail-section">
      <h4>⚓ Anode Inspection</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
        ${anodeConditions
          .map((anode) => {
            const location = anode.location || anode.type || "";
            const position = anode.position ? ` (${anode.position})` : "";
            const locationText =
              location || position ? `${location}${position}`.trim() : "Anode";

            // Convert percentage to condition label
            let condition;
            let isReplaced = false;

            if (anode.condition_percent !== undefined) {
              condition = convertAnodePercentToCondition(
                anode.condition_percent,
              );
              isReplaced = isAnodeReplaced(
                anode.checked_date,
                log.service_date,
              );
            } else {
              condition = anode.condition || anode.overall_condition || "N/A";
            }

            // Build badge HTML
            const badgeHtml = `<span class="condition-badge ${getConditionClass(condition)}">${escapeHtml(condition.charAt(0).toUpperCase() + condition.slice(1))}</span>`;

            // Add REPLACED badge if applicable
            const replacedBadge = isReplaced
              ? `<span class="condition-badge" style="background: #d1fae5; color: #065f46; margin-left: 8px;">✓ REPLACED</span>`
              : "";

            return `
            <div class="condition-item-card" style="background: #fafbfc;">
              <div class="condition-item-label">${escapeHtml(locationText)}</div>
              ${badgeHtml}${replacedBadge}
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `;
}

/**
 * Create propellers section
 */
function createPropellersSection(log) {
  if (!log.propellers) return "";

  // Parse JSON string if needed
  let propellers;
  if (typeof log.propellers === "string") {
    try {
      propellers = JSON.parse(log.propellers);
    } catch (e) {
      console.error("Error parsing propellers:", e);
      return "";
    }
  } else {
    propellers = log.propellers;
  }

  // Ensure it's an array
  if (!Array.isArray(propellers)) {
    propellers = [];
  }

  if (propellers.length === 0) return "";

  // Determine propeller labels
  const getPropellerLabel = (index, total) => {
    if (total === 1) {
      return null; // No label for single propeller
    } else if (total === 2) {
      return index === 0 ? "Port" : "Starboard";
    } else {
      return `Propeller #${index + 1}`;
    }
  };

  return `
    <div class="detail-section">
      <h4>Propeller Condition</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
        ${propellers
          .map((prop, index) => {
            const label = getPropellerLabel(index, propellers.length);
            return `
          <div class="condition-item-card">
            <div class="condition-item-label">${label || "Propeller"}</div>
            <span class="condition-badge ${getConditionClass(prop.condition || "good")}">
              ${escapeHtml(prop.condition || "N/A")}
            </span>
            ${prop.notes ? `<div style="margin-top: 6px; font-size: 11px; color: #6b7280; font-style: italic;">${escapeHtml(prop.notes)}</div>` : ""}
          </div>
        `;
          })
          .join("")}
      </div>
      ${
        log.propeller_notes
          ? `
        <div style="margin-top: var(--ss-space-sm); font-size: var(--ss-text-sm); color: var(--ss-text-medium); font-style: italic;">
          ${escapeHtml(log.propeller_notes)}
        </div>
      `
          : ""
      }
    </div>
  `;
}

/**
 * Create notes section
 * @param {Object} log - Service log
 * @returns {string} HTML string
 */
function createNotesSection(log) {
  if (!log.notes) return "";

  return `
    <div class="detail-section">
      <h4>Service Notes</h4>
      <div class="notes-section">${escapeHtml(log.notes)}</div>
    </div>
  `;
}

/**
 * Create videos section for a service log
 * Filters videos published between this service date and the next service date
 */
function createVideosSection(log, nextServiceDate = null) {
  // If no playlist or no videos, return empty
  if (!boatPlaylist || playlistVideos.length === 0) {
    return "";
  }

  // Filter videos by service date range
  const serviceDate = new Date(log.service_date);
  const nextDate = nextServiceDate ? new Date(nextServiceDate) : new Date(); // Use today if no next service

  const relevantVideos = playlistVideos.filter((video) => {
    const videoDate = new Date(video.publishedAt);
    return videoDate >= serviceDate && videoDate < nextDate;
  });

  // If no videos in this date range, try to show playlist link as fallback
  if (relevantVideos.length === 0) {
    // Only show fallback if this is a recent service (within last 90 days)
    const daysSince = Math.floor(
      (new Date() - serviceDate) / (1000 * 60 * 60 * 24),
    );
    if (daysSince <= 90) {
      return `
        <div class="detail-section">
          <h4>📹 Service Videos</h4>
          <div class="youtube-playlist-card-small">
            <div class="playlist-icon-small">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="#FF0000">
                <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/>
              </svg>
            </div>
            <div class="playlist-content-small">
              <p style="margin: 0; font-size: var(--ss-font-size-sm); color: var(--ss-neutral-600);">
                No videos found for this service date.
                <a href="${escapeHtml(boatPlaylist.playlist_url)}"
                   target="_blank"
                   rel="noopener noreferrer"
                   style="color: var(--ss-primary-600); text-decoration: none;">
                  View full playlist
                </a>
              </p>
            </div>
          </div>
        </div>
      `;
    }
    return ""; // Don't show videos section for older services
  }

  // Display video thumbnails
  return `
    <div class="detail-section">
      <h4>📹 Service Videos (${relevantVideos.length})</h4>
      <div class="service-video-grid">
        ${relevantVideos
          .map(
            (video) => `
          <div class="service-video-thumbnail" onclick="window.open('${escapeHtml(video.url)}', '_blank')">
            <img src="${escapeHtml(video.thumbnail)}" alt="${escapeHtml(video.title)}" loading="lazy">
            <div class="video-play-overlay">▶</div>
            <div class="video-title">${escapeHtml(video.title)}</div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
}

/**
 * Show empty state
 */
function showEmptyState(message) {
  timelineContainer.innerHTML = `
    <div class="empty-state">
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * Show error message
 */
function showError(message) {
  timelineContainer.innerHTML = `
    <div class="empty-state" style="color: var(--ss-error-600);">
      <p>⚠️ ${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * Format condition text for display
 * @param {string} condition - Condition value
 * @returns {string} Formatted text
 */
function formatConditionText(condition) {
  const textMap = {
    "not-inspected": "Not Inspected",
    not_inspected: "Not Inspected",
    excellent: "Excellent",
    "excellent-good": "Excellent-Good",
    good: "Good",
    "good-fair": "Good-Fair",
    fair: "Fair",
    "fair-poor": "Fair-Poor",
    poor: "Poor",
    missing: "Poor",
    "very-poor": "Very Poor",
    // Growth levels
    minimal: "Minimal",
    moderate: "Moderate",
    heavy: "Heavy",
    // Through-hull conditions
    sound: "Sound",
    inspected: "Inspected",
  };
  return (
    textMap[condition] || condition.charAt(0).toUpperCase() + condition.slice(1)
  );
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Initialize the page
init();
