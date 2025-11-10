/**
 * Customer Portal Dashboard
 * Main landing page for authenticated customers
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
  supabase,
} from "../auth/auth.js";
import { getAllCustomers } from "../api/customers.js";
import {
  getPaintCondition,
  getPaintStatus,
  daysSinceService,
  getServiceMedia,
  getBoatPlaylist,
  getLatestServiceLog,
  getPlaylistVideos,
  convertAnodePercentToCondition,
  isAnodeReplaced,
} from "../api/boat-data.js";
import { formatDate, getConditionClass } from "../api/service-logs.js";

console.log("[PORTAL DEBUG] Module loaded, starting authentication...");

// IMPORTANT: Process session from URL hash BEFORE checking auth
// This prevents race condition where requireAuth() redirects before session is set
let hashTokenProcessed = false;

console.log("[PORTAL DEBUG] Checking if URL contains session hash...");
if (window.location.hash.includes("access_token")) {
  console.log(
    "[PORTAL DEBUG] access_token detected in hash, manually setting session...",
  );

  // Extract the hash parameters
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  console.log("[PORTAL DEBUG] Extracted tokens from hash:", {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
  });

  if (accessToken) {
    try {
      // Manually set the session using setSession
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || "",
      });

      console.log("[PORTAL DEBUG] setSession result:", {
        hasSession: !!data?.session,
        hasUser: !!data?.user,
        error: error?.message,
      });

      if (error) {
        console.error("[PORTAL DEBUG] Failed to set session:", error);
        // Clear hash and redirect to login
        window.location.href =
          "https://login.sailorskills.com/login.html?redirect=" +
          encodeURIComponent(window.location.origin + "/portal.html");
        throw new Error("Session setup failed");
      }

      if (!data?.session) {
        console.error("[PORTAL DEBUG] setSession did not return a session!");
        window.location.href =
          "https://login.sailorskills.com/login.html?redirect=" +
          encodeURIComponent(window.location.origin + "/portal.html");
        throw new Error("No session after setSession");
      }

      hashTokenProcessed = true;

      // Clean up the hash now that session is established
      console.log("[PORTAL DEBUG] Session established, cleaning URL hash");
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    } catch (err) {
      console.error("[PORTAL DEBUG] Error processing tokens:", err);
      // Only redirect if error wasn't already handled above
      if (
        !err.message.includes("Session setup failed") &&
        !err.message.includes("No session after setSession")
      ) {
        window.location.href =
          "https://login.sailorskills.com/login.html?redirect=" +
          encodeURIComponent(window.location.origin + "/portal.html");
      }
      throw err;
    }
  }
}

// NOW check authentication (after hash processing completes)
console.log("[PORTAL DEBUG] Calling requireAuth()...");
const isAuth = await requireAuth();
console.log("[PORTAL DEBUG] requireAuth() returned:", isAuth);

if (!isAuth) {
  console.error("[PORTAL DEBUG] Authentication failed!");
  throw new Error("Not authenticated");
}

console.log("[PORTAL DEBUG] Authentication successful, continuing...");

// Load user data
let currentUser = null;
let userBoats = [];
let selectedBoatId = null;
let isAdminUser = false;

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

  if (userBoats.length > 0) {
    userBoats.forEach((boat) => {
      const option = document.createElement("option");
      option.value = boat.name + (boat.isPrimary ? " (Primary)" : "");
      option.dataset.boatId = boat.id;
      boatDatalist.appendChild(option);
    });

    // Set initial value
    if (selectedBoatId) {
      const selectedBoat = userBoats.find((b) => b.id === selectedBoatId);
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
        await loadBoatData();
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
    // No impersonation active
    return;
  }

  const bannerEl = document.getElementById("impersonation-banner");
  const searchInput = document.getElementById("banner-customer-search");
  const datalist = document.getElementById("banner-customer-datalist");
  const exitBtn = document.getElementById("exit-impersonation-btn");

  // Show banner
  bannerEl.style.display = "flex";

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
  exitBtn.addEventListener("click", () => {
    clearImpersonation();
    window.location.reload();
  });
}

/**
 * Initialize customer selector for admins (header)
 */
async function initCustomerSelector() {
  if (!isAdminUser) return;

  // Don't show header selector if impersonating (it's in the banner instead)
  const impersonatedId = sessionStorage.getItem("impersonatedCustomerId");
  if (impersonatedId) return;

  const selectorEl = document.getElementById("admin-customer-selector");
  const searchInput = document.getElementById("customer-search");
  const datalist = document.getElementById("customer-datalist");

  // Show selector for admins
  selectorEl.style.display = "flex";

  // Load all customers
  const { customers, error } = await getAllCustomers();
  if (error) {
    console.error("Failed to load customers for selector:", error);
    return;
  }

  // Populate datalist
  customers.forEach((customer) => {
    const option = document.createElement("option");
    option.value = customer.displayText;
    option.dataset.customerId = customer.id;
    datalist.appendChild(option);
  });

  // Handle customer selection
  searchInput.addEventListener("change", async (e) => {
    const selectedText = e.target.value;

    // Find matching customer
    const selectedOption = Array.from(datalist.options).find(
      (opt) => opt.value === selectedText,
    );

    if (selectedOption) {
      const customerId = selectedOption.dataset.customerId;
      const { success } = await setImpersonation(customerId);

      if (success) {
        // Reload page to show impersonated view
        window.location.reload();
      }
    }
  });
}

/**
 * Initialize portal
 */
async function init() {
  console.log("[PORTAL DEBUG] init() started");

  try {
    // Get current user
    console.log("[PORTAL DEBUG] Calling getEffectiveUser()...");
    const { user, error: userError, isImpersonated } = await getEffectiveUser();
    console.log("[PORTAL DEBUG] getEffectiveUser() returned:", {
      user: user?.email,
      error: userError,
      isImpersonated,
    });

    if (userError || !user) {
      console.error(
        "[PORTAL DEBUG] User error or no user, redirecting to login",
      );
      console.error("Error loading user:", userError);
      window.location.href = "/login.html";
      return;
    }

    currentUser = user;
    console.log("[PORTAL DEBUG] currentUser set:", currentUser.email);

    // Check if user is admin
    console.log("[PORTAL DEBUG] Calling isAdmin()...");
    isAdminUser = await isAdmin(user.id);
    console.log("[PORTAL DEBUG] isAdmin() returned:", isAdminUser);

    // Display user email with admin badge if applicable
    console.log("[PORTAL DEBUG] Updating user email display...");
    const userEmailEl = document.getElementById("user-email");
    if (isAdminUser) {
      userEmailEl.innerHTML = `${user.email} <span style="display: inline-block; margin-left: 8px; padding: 2px 8px; background: #ff6b6b; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">ADMIN</span>`;
      console.log("[PORTAL DEBUG] Admin badge added to email");
    } else {
      userEmailEl.textContent = user.email;
      console.log("[PORTAL DEBUG] User email set (non-admin)");
    }

    // Load boats
    console.log("[PORTAL DEBUG] Calling loadBoats()...");
    await loadBoats();
    console.log("[PORTAL DEBUG] loadBoats() completed");

    // Initialize admin selectors (customer and boat) for admins
    console.log("[PORTAL DEBUG] Calling initAdminSelectors()...");
    await initAdminSelectors();
    console.log("[PORTAL DEBUG] initAdminSelectors() completed");

    // Update welcome message
    console.log("[PORTAL DEBUG] Calling updateWelcomeMessage()...");
    updateWelcomeMessage();
    console.log("[PORTAL DEBUG] updateWelcomeMessage() completed");

    console.log("[PORTAL DEBUG] init() COMPLETED SUCCESSFULLY");
  } catch (error) {
    console.error("[PORTAL DEBUG] FATAL ERROR in init():", error);
    console.error("[PORTAL DEBUG] Error stack:", error.stack);

    // Update UI to show error
    const userEmailEl = document.getElementById("user-email");
    if (userEmailEl) {
      userEmailEl.textContent = `Error: ${error.message}`;
      userEmailEl.style.color = "red";
    }
  }
}

/**
 * Load user's accessible boats
 */
async function loadBoats() {
  console.log("[DEBUG] Loading boats for user:", currentUser.id);
  const { boats, error } = await getUserBoats(currentUser.id);

  if (error) {
    console.error("Error loading boats:", error);
    return;
  }

  console.log("[DEBUG] Boats loaded:", boats.length, "boat(s) found");
  userBoats = boats;

  // Set initial selected boat
  if (boats.length > 0) {
    // Check localStorage for previously selected boat
    const savedBoatId = localStorage.getItem("currentBoatId");
    if (savedBoatId && boats.find((b) => b.id === savedBoatId)) {
      selectedBoatId = savedBoatId;
    } else {
      // Select primary boat or first boat
      const primaryBoat = boats.find((b) => b.isPrimary);
      selectedBoatId = primaryBoat ? primaryBoat.id : boats[0].id;
    }

    // Load boat data
    await loadBoatData();
  }
}

/**
 * Populate boat selector dropdown
 * @param {Array} boats - User's boats
 */
function populateBoatSelector(boats) {
  const select = document.getElementById("current-boat");
  select.innerHTML = "";

  boats.forEach((boat) => {
    const option = document.createElement("option");
    option.value = boat.id;
    option.textContent = boat.name;
    if (boat.isPrimary) {
      option.textContent += " (Primary)";
    }
    select.appendChild(option);
  });

  // Listen for changes
  select.addEventListener("change", async (e) => {
    selectedBoatId = e.target.value;
    localStorage.setItem("currentBoatId", selectedBoatId);
    await loadBoatData();
  });
}

/**
 * Load data for selected boat
 */
async function loadBoatData() {
  const boat = userBoats.find((b) => b.id === selectedBoatId);
  if (!boat) return;

  // Update welcome message with boat name
  document.getElementById("welcome-heading").textContent =
    `Welcome to ${boat.name}'s Portal`;

  // Load paint condition
  await loadPaintCondition(boat.id);

  // Load latest service details (includes videos now - unified report)
  await loadLatestServiceDetails(boat.id);

  // Hide the separate videos section (videos now integrated into service report)
  const videosSection = document.getElementById("videos-section");
  if (videosSection) {
    videosSection.style.display = "none";
  }
}

/**
 * Load and display paint condition
 * @param {string} boatId - Boat UUID
 */
async function loadPaintCondition(boatId) {
  const { paintData, error } = await getPaintCondition(boatId);

  if (error) {
    console.error("Error loading paint condition:", error);
    return;
  }

  if (!paintData) {
    // No service history yet - hide section
    const section = document.getElementById("paint-condition-section");
    if (section) {
      section.style.display = "none";
    }
    return;
  }

  // Show the paint condition section
  const section = document.getElementById("paint-condition-section");
  if (section) {
    section.style.display = "block";
  }

  // Map paint condition to position percentage on gradient
  // Conditions are already normalized by getPaintCondition()
  const conditionMap = {
    "not-inspected": 0,
    excellent: 12.5,
    "excellent-good": 25,
    good: 37.5,
    "good-fair": 50,
    fair: 62.5,
    "fair-poor": 75,
    poor: 87.5,
    missing: 87.5,
    "very-poor": 100,
  };

  // Direct lookup - condition is already normalized to format like "fair-poor"
  const position = conditionMap[paintData.overall] || 0;

  // Position the marker on the gradient
  const marker = document.getElementById("condition-marker");
  if (marker) {
    marker.style.left = `${position}%`;
  }

  // Get paint status
  const days = daysSinceService(paintData.serviceDate);
  const status = getPaintStatus(paintData.overall, days);

  // Update status message
  const messageEl = document.getElementById("paint-status-message");
  if (messageEl) {
    messageEl.textContent = status.message;
    messageEl.className = `paint-status-message ${status.status}`;
  }

  // Update service date info
  const dateInfo = document.getElementById("service-date-info");
  if (dateInfo && paintData.serviceDate && days !== null) {
    const timeText =
      days === 0 ? "today" : `${days} day${days !== 1 ? "s" : ""} ago`;
    dateInfo.textContent = `Last inspected ${timeText} (${formatDate(paintData.serviceDate)})`;
  }

  // Update condition stat if it exists
  const conditionStat = document.getElementById("condition-stat");
  if (conditionStat) {
    conditionStat.textContent = formatConditionText(paintData.overall);
  }
}

/**
 * Load and display service media/videos
 * Filter videos to show only those from the most recent service
 * @param {string} boatId - Boat UUID
 */
async function loadServiceMedia(boatId) {
  // Get latest service log to filter videos by date
  const { serviceLog: latestService } = await getLatestServiceLog(boatId);

  const { media, error } = await getServiceMedia(boatId);

  if (error) {
    console.error("Error loading service media:", error);
  }

  // Show videos section
  const section = document.getElementById("videos-section");
  const grid = document.getElementById("video-grid");

  // Filter media to only show videos (not photos for now)
  let videos =
    media?.filter((item) => item.id && item.thumbnail && item.url) || [];

  // Filter videos by latest service date (if we have a service log)
  if (latestService && latestService.service_date && videos.length > 0) {
    const serviceDate = new Date(latestService.service_date);
    videos = videos.filter((video) => {
      const videoDate = new Date(video.publishedAt);
      return videoDate >= serviceDate; // Only show videos from latest service forward
    });
  }

  // If no individual videos, try to show playlist link as fallback
  if (videos.length === 0) {
    const { playlist, error: playlistError } = await getBoatPlaylist(boatId);

    if (!playlistError && playlist) {
      // Show playlist link card as fallback
      grid.innerHTML = `
        <div class="youtube-playlist-card">
          <div class="playlist-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="#FF0000">
              <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.10-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/>
            </svg>
          </div>
          <div class="playlist-content">
            <h4>Service Video Playlist</h4>
            <p>Watch all videos from your boat's services</p>
            <a href="${escapeHtml(playlist.playlist_url)}"
               target="_blank"
               rel="noopener noreferrer"
               class="playlist-link-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
              Watch on YouTube
            </a>
          </div>
        </div>
        <div style="margin-top: var(--ss-space-md); text-align: center;">
          <a href="/portal-services.html" style="color: var(--ss-primary-600); text-decoration: none; font-weight: 500;">
            See all service history →
          </a>
        </div>
      `;
    } else {
      // No playlist at all
      grid.innerHTML = `
        <div class="no-videos-message">No videos available yet. Videos from your latest service will appear here.</div>
        <div style="margin-top: var(--ss-space-md); text-align: center;">
          <a href="/portal-services.html" style="color: var(--ss-primary-600); text-decoration: none; font-weight: 500;">
            See all service history →
          </a>
        </div>
      `;
    }
    section.style.display = "block";
    return;
  }

  // Display video thumbnails with titles
  grid.innerHTML = ""; // Clear existing content

  videos.forEach((video) => {
    const videoCard = document.createElement("div");
    videoCard.className = "video-thumbnail";
    videoCard.innerHTML = `
      <img src="${escapeHtml(video.thumbnail)}" alt="${escapeHtml(video.title)}">
      <div class="video-play-overlay">▶</div>
      <div class="video-title">${escapeHtml(video.title)}</div>
    `;

    // Click to open video in new tab
    videoCard.addEventListener("click", () => {
      window.open(video.url, "_blank");
    });

    grid.appendChild(videoCard);
  });

  // Add "View all videos" link after the grid
  const viewAllLink = document.createElement("div");
  viewAllLink.style.marginTop = "var(--ss-space-md)";
  viewAllLink.style.textAlign = "center";
  viewAllLink.innerHTML = `
    <a href="/portal-services.html" style="color: var(--ss-primary-600); text-decoration: none; font-weight: 500;">
      View all service history and videos →
    </a>
  `;

  // Append to the section (not the grid)
  section.appendChild(viewAllLink);

  section.style.display = "block";
}

/**
 * Load and display latest service log details with videos (unified report)
 * @param {string} boatId - Boat UUID
 */
async function loadLatestServiceDetails(boatId) {
  const { serviceLog, error } = await getLatestServiceLog(boatId);

  const section = document.getElementById("latest-service-section");
  const content = document.getElementById("latest-service-content");

  if (error || !serviceLog) {
    content.innerHTML = `
      <div style="text-align: center; padding: var(--ss-space-xl); color: var(--ss-text-medium);">
        No service history available yet.
        <div style="margin-top: var(--ss-space-md);">
          <a href="/portal-services.html" style="color: var(--ss-primary); text-decoration: none; font-weight: 500;">
            View all services →
          </a>
        </div>
      </div>
    `;
    section.style.display = "block";
    return;
  }

  // Load videos for this service
  const videosHtml = await createServiceVideosSection(
    boatId,
    serviceLog.service_date,
  );

  // Build unified service report HTML
  content.innerHTML = `
    <div style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
        <div>
          <div style="font-size: 18px; font-weight: 600; color: var(--ss-text-dark);">
            ${formatDate(serviceLog.service_date)}
          </div>
          ${serviceLog.service_name ? `<div style="color: #6b7280; font-size: 14px; margin-top: 4px; font-weight: 400;">${escapeHtml(serviceLog.service_name)}</div>` : ""}
        </div>
        <a href="/portal-services.html" style="color: var(--ss-primary); text-decoration: none; font-weight: 500; font-size: 14px;">
          View all history →
        </a>
      </div>

      ${createConditionsSection(serviceLog)}
      ${createAnodesSection(serviceLog)}
      ${createPropellersSection(serviceLog)}
      ${videosHtml}
      ${
        serviceLog.notes
          ? `
        <div style="margin-top: 16px; padding: 12px; background: var(--ss-bg-light); border-left: 3px solid var(--ss-primary);">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: var(--ss-text-dark);">Service Notes</h4>
          <div style="color: var(--ss-text-dark); font-size: 14px;">${escapeHtml(serviceLog.notes)}</div>
        </div>
      `
          : ""
      }
    </div>
  `;

  section.style.display = "block";
}

/**
 * Create service videos section (integrated into service report)
 * @param {string} boatId - Boat UUID
 * @param {string} serviceDate - Service date to filter videos
 * @returns {Promise<string>} HTML for videos section
 */
async function createServiceVideosSection(boatId, serviceDate) {
  // Get boat's playlist
  const { playlist, error: playlistError } = await getBoatPlaylist(boatId);

  if (playlistError || !playlist) {
    return ""; // No playlist, skip videos section
  }

  // Get playlist videos
  const { videos, error: videosError } = await getPlaylistVideos(
    playlist.playlist_id,
  );

  if (videosError || !videos || videos.length === 0) {
    // Show playlist fallback link
    return `
      <div style="margin-top: var(--ss-space-lg);">
        <h4 style="margin: 0 0 var(--ss-space-sm) 0; font-size: var(--ss-text-md); font-weight: 600; color: var(--ss-text-dark);">📹 Service Videos</h4>
        <div style="padding: var(--ss-space-md); background: var(--ss-bg-light); border: 1px solid var(--ss-border); border-radius: var(--ss-radius-none); text-align: center;">
          <p style="margin: 0 0 var(--ss-space-sm) 0; color: var(--ss-text-medium); font-size: var(--ss-text-sm);">Videos from this service</p>
          <a href="${escapeHtml(playlist.playlist_url)}"
             target="_blank"
             rel="noopener noreferrer"
             style="display: inline-flex; align-items: center; gap: var(--ss-space-xs); padding: var(--ss-space-sm) var(--ss-space-md); background: #FF0000; color: white; text-decoration: none; border-radius: var(--ss-radius-none); font-weight: 500; font-size: var(--ss-text-sm);">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.10-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/>
            </svg>
            Watch on YouTube
          </a>
        </div>
      </div>
    `;
  }

  // Filter videos by service date range
  // Show videos from service date up to 60 days after service (typical service interval)
  const serviceDateObj = new Date(serviceDate);
  const maxDate = new Date(serviceDateObj);
  maxDate.setDate(maxDate.getDate() + 60); // 60 days after service

  const relevantVideos = videos.filter((video) => {
    const videoDate = new Date(video.publishedAt);
    return videoDate >= serviceDateObj && videoDate <= maxDate;
  });

  // If no videos in this date range, show playlist fallback
  if (relevantVideos.length === 0) {
    return `
      <div style="margin-top: var(--ss-space-lg);">
        <h4 style="margin: 0 0 var(--ss-space-sm) 0; font-size: var(--ss-text-md); font-weight: 600; color: var(--ss-text-dark);">📹 Service Videos</h4>
        <div style="padding: var(--ss-space-md); background: var(--ss-bg-light); border: 1px solid var(--ss-border); border-radius: var(--ss-radius-none); text-align: center;">
          <p style="margin: 0 0 var(--ss-space-sm) 0; color: var(--ss-text-medium); font-size: var(--ss-text-sm);">No videos for this service date range</p>
          <a href="${escapeHtml(playlist.playlist_url)}"
             target="_blank"
             rel="noopener noreferrer"
             style="display: inline-flex; align-items: center; gap: var(--ss-space-xs); padding: var(--ss-space-sm) var(--ss-space-md); background: #FF0000; color: white; text-decoration: none; border-radius: var(--ss-radius-none); font-weight: 500; font-size: var(--ss-text-sm);">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.10-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/>
            </svg>
            View all videos on YouTube
          </a>
        </div>
      </div>
    `;
  }

  // Show up to 6 most recent videos from the date range
  const filteredVideos = relevantVideos.slice(0, 6);

  // Build video thumbnails
  const videoThumbnails = filteredVideos
    .map(
      (video) => `
    <div class="service-video-thumbnail" onclick="window.open('${escapeHtml(video.url)}', '_blank')" style="position: relative; cursor: pointer; border-radius: var(--ss-radius-none); overflow: hidden; box-shadow: var(--ss-shadow-sm); transition: transform 0.2s;">
      <img src="${escapeHtml(video.thumbnail)}" alt="${escapeHtml(video.title)}" style="width: 100%; height: auto; display: block;">
      <div class="video-play-overlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 48px; height: 48px; background: rgba(0,0,0,0.7); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; pointer-events: none;">▶</div>
      <div class="video-title" style="padding: var(--ss-space-xs); font-size: var(--ss-text-xs); color: var(--ss-text-dark); background: white; line-height: 1.3; max-height: 2.6em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${escapeHtml(video.title)}</div>
    </div>
  `,
    )
    .join("");

  return `
    <div style="margin-top: var(--ss-space-lg);">
      <h4 style="margin: 0 0 var(--ss-space-sm) 0; font-size: var(--ss-text-md); font-weight: 600; color: var(--ss-text-dark);">📹 Service Videos</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--ss-space-md); margin-top: var(--ss-space-sm);">
        ${videoThumbnails}
      </div>
    </div>
  `;
}

/**
 * Normalize condition from database (convert comma-separated to hyphenated)
 * Orders from better to worse condition for consistent display
 * @param {string} condition - Raw condition from database
 * @returns {string} Normalized condition
 */
function normalizeDisplayCondition(condition) {
  if (!condition) return "";

  const raw = condition.trim();

  // Handle comma-separated ranges: "Fair, Good" → "Good-Fair"
  if (raw.includes(",")) {
    const parts = raw.split(",").map((p) => p.trim());

    // Handle special cases
    if (parts.some((p) => p.toLowerCase() === "missing")) {
      return "Poor";
    }

    // Severity ranking (lower number = better condition)
    const severityMap = {
      "Not Inspected": 0,
      Excellent: 1,
      "Excellent-Good": 2,
      Good: 3,
      "Good-Fair": 4,
      Fair: 5,
      "Fair-Poor": 6,
      Poor: 7,
      Heavy: 7, // growth level
      Moderate: 4, // growth level
      Minimal: 2, // growth level
      "Very Poor": 8,
    };

    // Sort parts by severity (better condition first)
    parts.sort((a, b) => {
      const sevA = severityMap[a] || 99;
      const sevB = severityMap[b] || 99;
      return sevA - sevB;
    });

    // Join with hyphen for range display: "Good-Fair", "Excellent-Good", etc.
    return parts.join("-");
  }

  return raw;
}

/**
 * Create conditions section for service display
 */
function createConditionsSection(log) {
  const hasConditions =
    log.paint_condition_overall || log.growth_level || log.thru_hull_condition;
  if (!hasConditions) return "";

  // Normalize conditions for display
  const paintCondition = normalizeDisplayCondition(log.paint_condition_overall);
  const growthLevel = normalizeDisplayCondition(log.growth_level);

  return `
    <div style="margin-top: 24px;">
      <h4 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: var(--ss-text-dark);">Vessel Condition</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
        ${
          paintCondition
            ? `
          <div class="condition-item-card">
            <div class="condition-item-label">Paint Condition</div>
            <span class="condition-badge ${getConditionClass(paintCondition.toLowerCase())}">
              ${escapeHtml(paintCondition)}
            </span>
          </div>
        `
            : ""
        }
        ${
          growthLevel
            ? `
          <div class="condition-item-card">
            <div class="condition-item-label">Growth Level</div>
            <span class="condition-badge" style="background: #e5e7eb; color: #4b5563;">
              ${escapeHtml(growthLevel.charAt(0).toUpperCase() + growthLevel.slice(1))}
            </span>
          </div>
        `
            : ""
        }
        ${
          log.thru_hull_condition
            ? `
          <div class="condition-item-card">
            <div class="condition-item-label">Through-Hulls</div>
            <div style="font-size: 14px; color: var(--ss-text-dark); font-weight: 400;">${escapeHtml(log.thru_hull_condition)}</div>
          </div>
        `
            : ""
        }
      </div>
    </div>
  `;
}

/**
 * Create anodes section for service display
 */
function createAnodesSection(log) {
  if (!log.anode_conditions) {
    return "";
  }

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

  if (anodeConditions.length === 0) {
    return "";
  }

  return `
    <div style="margin-top: 24px;">
      <h4 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: var(--ss-text-dark);">⚓ Anode Inspection</h4>
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
 * Create propellers section for service display
 */
function createPropellersSection(log) {
  if (!log.propellers) {
    return "";
  }

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

  if (propellers.length === 0) {
    return "";
  }

  // Determine propeller labels
  const getPropellerLabel = (index, total) => {
    if (total === 1) {
      return "Propeller"; // Just "Propeller" for single propeller
    } else if (total === 2) {
      return index === 0 ? "Port Propeller" : "Starboard Propeller";
    } else {
      return `Propeller #${index + 1}`;
    }
  };

  return `
    <div style="margin-top: 24px;">
      <h4 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: var(--ss-text-dark);">Propeller Condition</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
        ${propellers
          .map((prop, index) => {
            const label = getPropellerLabel(index, propellers.length);
            return `
          <div class="condition-item-card">
            <div class="condition-item-label">${label}</div>
            <span class="condition-badge ${getConditionClass(prop.condition || "good")}">
              ${escapeHtml(prop.condition || "N/A")}
            </span>
            ${prop.notes ? `<div style="margin-top: 6px; font-size: 11px; color: #6b7280; font-style: italic;">${escapeHtml(prop.notes)}</div>` : ""}
          </div>
        `;
          })
          .join("")}
      </div>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format paint condition text for display
 * @param {string} condition - Paint condition value
 * @returns {string} Formatted text
 */
function formatConditionText(condition) {
  const textMap = {
    "not-inspected": "Not Inspected",
    excellent: "Excellent",
    "excellent-good": "Excellent-Good",
    good: "Good",
    "good-fair": "Good-Fair",
    fair: "Fair",
    "fair-poor": "Fair-Poor",
    poor: "Poor",
    missing: "Poor",
    "very-poor": "Very Poor",
  };
  return textMap[condition] || "Unknown";
}

/**
 * Update welcome message
 */
function updateWelcomeMessage() {
  if (userBoats.length === 0) {
    document.getElementById("welcome-heading").textContent =
      "Welcome to Your Portal";
  }
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
}

// Initialize portal
async function startPortal() {
  console.log("[PORTAL DEBUG] startPortal() called");

  try {
    console.log("[PORTAL DEBUG] Setting up event listeners...");
    setupEventListeners();
    console.log("[PORTAL DEBUG] Event listeners set up, calling init()...");

    await init();

    console.log("[PORTAL DEBUG] startPortal() COMPLETED");

    // Now it's safe to clean up the URL hash (after everything is initialized)
    if (window.location.hash.includes("access_token")) {
      console.log("[PORTAL DEBUG] Cleaning up auth hash from URL...");
      window.history.replaceState(null, "", window.location.pathname);
    }
  } catch (error) {
    console.error("[PORTAL DEBUG] FATAL ERROR in startPortal():", error);
    console.error("[PORTAL DEBUG] Error stack:", error.stack);
  }
}

console.log("[PORTAL DEBUG] About to call startPortal()...");
startPortal();
