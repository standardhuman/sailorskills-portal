/**
 * Customer Portal Dashboard
 * Main landing page for authenticated customers
 */

import {
  requireAuth,
  getCurrentUser,
  getUserBoats,
  logout,
  isAdmin,
} from "../auth/auth.js";
import {
  getPaintCondition,
  getPaintStatus,
  daysSinceService,
  getServiceMedia,
  getBoatPlaylist,
} from "../api/boat-data.js";

// Require authentication
const isAuth = await requireAuth();
if (!isAuth) {
  // requireAuth handles redirect
  throw new Error("Not authenticated");
}

// Load user data
let currentUser = null;
let userBoats = [];
let selectedBoatId = null;
let isAdminUser = false;

/**
 * Initialize portal
 */
async function init() {
  // Get current user
  const { user, error: userError } = await getCurrentUser();

  if (userError || !user) {
    console.error("Error loading user:", userError);
    window.location.href = "/login.html";
    return;
  }

  currentUser = user;

  // Check if user is admin
  isAdminUser = await isAdmin(user.id);

  // Display user email with admin badge if applicable
  const userEmailEl = document.getElementById("user-email");
  if (isAdminUser) {
    userEmailEl.innerHTML = `${user.email} <span style="display: inline-block; margin-left: 8px; padding: 2px 8px; background: #ff6b6b; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">ADMIN</span>`;
  } else {
    userEmailEl.textContent = user.email;
  }

  // Load boats
  await loadBoats();

  // Update welcome message
  updateWelcomeMessage();
}

/**
 * Load user's accessible boats
 */
async function loadBoats() {
  const { boats, error } = await getUserBoats(currentUser.id);

  if (error) {
    console.error("Error loading boats:", error);
    return;
  }

  userBoats = boats;

  // Show selector if multiple boats OR if user is admin
  const shouldShowSelector =
    boats.length > 1 || (isAdminUser && boats.length > 0);

  if (shouldShowSelector) {
    const selectorEl = document.getElementById("boat-selector");
    selectorEl.style.display = "block";

    // Add admin indicator to selector label if admin
    if (isAdminUser) {
      const label = selectorEl.querySelector("label");
      if (label && !label.querySelector(".admin-view-badge")) {
        label.innerHTML = `Select Boat: <span class="admin-view-badge" style="color: #ff6b6b; font-size: 11px; font-weight: 600;">(Admin View - All Boats)</span>`;
      }
    }

    populateBoatSelector(boats);
  }

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

    // Update selector if visible
    if (shouldShowSelector) {
      document.getElementById("current-boat").value = selectedBoatId;
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

  // Load paint condition data
  await loadPaintCondition(boat.id);

  // Load service media/videos
  await loadServiceMedia(boat.id);
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
    section.style.display = "none";
    return;
  }

  // Show the paint condition section
  const section = document.getElementById("paint-condition-section");
  section.style.display = "block";

  // Map paint condition to position percentage on gradient
  const conditionMap = {
    "not-inspected": 0,
    excellent: 12.5,
    "exc-good": 18.75,
    good: 37.5,
    "good-fair": 50,
    fair: 62.5,
    "fair-poor": 75,
    poor: 87.5,
    "very-poor": 100,
  };

  const position = conditionMap[paintData.overall] || 0;

  // Position the marker on the gradient
  const marker = document.getElementById("condition-marker");
  marker.style.left = `${position}%`;

  // Get paint status
  const days = daysSinceService(paintData.serviceDate);
  const status = getPaintStatus(paintData.overall, days);

  // Update status message
  const messageEl = document.getElementById("paint-status-message");
  messageEl.textContent = status.message;
  messageEl.className = `paint-status-message ${status.status}`;

  // Update service date info
  const dateInfo = document.getElementById("service-date-info");
  if (paintData.serviceDate && days !== null) {
    dateInfo.textContent = `Last inspected ${days} day${days !== 1 ? "s" : ""} ago (${formatDate(paintData.serviceDate)})`;
  }

  // Update condition stat
  const conditionStat = document.getElementById("condition-stat");
  conditionStat.textContent = formatConditionText(paintData.overall);
}

/**
 * Load and display service media/videos
 * @param {string} boatId - Boat UUID
 */
async function loadServiceMedia(boatId) {
  const { media, error } = await getServiceMedia(boatId);

  if (error) {
    console.error("Error loading service media:", error);
  }

  // Show videos section
  const section = document.getElementById("videos-section");
  const grid = document.getElementById("video-grid");

  // Filter media to only show videos (not photos for now)
  const videos =
    media?.filter((item) => item.id && item.thumbnail && item.url) || [];

  // If no individual videos, try to show playlist link as fallback
  if (videos.length === 0) {
    const { playlist, error: playlistError } = await getBoatPlaylist(boatId);

    if (!playlistError && playlist) {
      // Show playlist link card as fallback
      grid.innerHTML = `
        <div class="youtube-playlist-card">
          <div class="playlist-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="#FF0000">
              <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/>
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
      `;
    } else {
      // No playlist at all
      grid.innerHTML =
        '<div class="no-videos-message">No videos available yet. Videos from your latest service will appear here.</div>';
    }
    section.style.display = "block";
    return;
  }

  // Display video thumbnails
  grid.innerHTML = ""; // Clear existing content

  videos.forEach((video) => {
    const videoCard = document.createElement("div");
    videoCard.className = "video-thumbnail";
    videoCard.innerHTML = `
      <img src="${escapeHtml(video.thumbnail)}" alt="${escapeHtml(video.title)}">
      <div class="video-play-overlay">▶</div>
    `;

    // Click to open video in new tab
    videoCard.addEventListener("click", () => {
      window.open(video.url, "_blank");
    });

    grid.appendChild(videoCard);
  });

  section.style.display = "block";
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
    "exc-good": "Exc-Good",
    good: "Good",
    "good-fair": "Good-Fair",
    fair: "Fair",
    "fair-poor": "Fair-Poor",
    poor: "Poor",
    "very-poor": "Very Poor",
  };
  return textMap[condition] || "Unknown";
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  setupEventListeners();
  await init();
}

startPortal();
