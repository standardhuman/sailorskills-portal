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
  getLatestServiceLog,
  getPlaylistVideos,
} from "../api/boat-data.js";
import { formatDate, getConditionClass } from "../api/service-logs.js";

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

  // Normalize condition to lowercase for lookup
  const normalizedCondition = paintData.overall.toLowerCase();
  const position = conditionMap[normalizedCondition] || 0;

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
    dateInfo.textContent = `Last inspected ${days} day${days !== 1 ? "s" : ""} ago (${formatDate(paintData.serviceDate)})`;
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
    <div style="margin-bottom: var(--ss-space-lg);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--ss-space-md);">
        <div>
          <div style="font-size: var(--ss-text-lg); font-weight: 600; color: var(--ss-text-dark);">
            ${formatDate(serviceLog.service_date)}
          </div>
          ${serviceLog.service_name ? `<div style="color: var(--ss-text-medium); font-size: var(--ss-text-sm); margin-top: var(--ss-space-xs);">${escapeHtml(serviceLog.service_name)}</div>` : ""}
        </div>
        <a href="/portal-services.html" style="color: var(--ss-primary); text-decoration: none; font-weight: 500; font-size: var(--ss-text-sm);">
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
        <div style="margin-top: var(--ss-space-md); padding: var(--ss-space-md); background: var(--ss-bg-light); border-left: 3px solid var(--ss-primary);">
          <h4 style="margin: 0 0 var(--ss-space-xs) 0; font-size: var(--ss-text-sm); font-weight: 600; color: var(--ss-text-dark);">Service Notes</h4>
          <div style="color: var(--ss-text-dark); font-size: var(--ss-text-sm);">${escapeHtml(serviceLog.notes)}</div>
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
 * Create conditions section for service display
 */
function createConditionsSection(log) {
  const hasConditions =
    log.paint_condition_overall || log.growth_level || log.thru_hull_condition;
  if (!hasConditions) return "";

  return `
    <div style="margin-top: var(--ss-space-md);">
      <h4 style="margin: 0 0 var(--ss-space-sm) 0; font-size: var(--ss-text-md); font-weight: 600; color: var(--ss-text-dark);">Vessel Condition</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--ss-space-sm);">
        ${
          log.paint_condition_overall
            ? `
          <div>
            <div style="font-size: var(--ss-text-xs); color: var(--ss-text-medium); margin-bottom: var(--ss-space-xs);">Paint Condition</div>
            <span class="condition-badge ${getConditionClass(log.paint_condition_overall)}" style="display: inline-block; padding: var(--ss-space-xs) var(--ss-space-sm); border-radius: var(--ss-radius-none); font-size: var(--ss-text-xs); font-weight: 600;">
              ${escapeHtml(log.paint_condition_overall)}
            </span>
          </div>
        `
            : ""
        }
        ${
          log.growth_level
            ? `
          <div>
            <div style="font-size: var(--ss-text-xs); color: var(--ss-text-medium); margin-bottom: var(--ss-space-xs);">Growth Level</div>
            <div style="font-size: var(--ss-text-sm); color: var(--ss-text-dark);">${escapeHtml(log.growth_level)}</div>
          </div>
        `
            : ""
        }
        ${
          log.thru_hull_condition
            ? `
          <div>
            <div style="font-size: var(--ss-text-xs); color: var(--ss-text-medium); margin-bottom: var(--ss-space-xs);">Through-Hulls</div>
            <div style="font-size: var(--ss-text-sm); color: var(--ss-text-dark);">${escapeHtml(log.thru_hull_condition)}</div>
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
    <div style="margin-top: var(--ss-space-md);">
      <h4 style="margin: 0 0 var(--ss-space-sm) 0; font-size: var(--ss-text-md); font-weight: 600; color: var(--ss-text-dark);">⚓ Anode Inspection</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--ss-space-sm);">
        ${anodeConditions
          .map((anode) => {
            const location = anode.location || anode.type || "";
            const position = anode.position ? ` (${anode.position})` : "";
            const locationText =
              location || position ? `${location}${position}`.trim() : "";
            const condition =
              anode.condition_percent !== undefined
                ? `${anode.condition_percent}%`
                : anode.condition || anode.overall_condition || "N/A";

            return `
            <div style="padding: var(--ss-space-sm); background: var(--ss-bg-light); border: 1px solid var(--ss-border);">
              ${locationText ? `<div style="font-size: var(--ss-text-xs); color: var(--ss-text-medium); margin-bottom: var(--ss-space-xs);">${escapeHtml(locationText)}</div>` : ""}
              <span class="condition-badge ${getConditionClass(anode.condition || anode.overall_condition || "fair")}" style="display: inline-block; padding: var(--ss-space-xs) var(--ss-space-sm); border-radius: var(--ss-radius-none); font-size: var(--ss-text-xs); font-weight: 600;">
                ${escapeHtml(condition)}
              </span>
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

  return `
    <div style="margin-top: var(--ss-space-md);">
      <h4 style="margin: 0 0 var(--ss-space-sm) 0; font-size: var(--ss-text-md); font-weight: 600; color: var(--ss-text-dark);">Propeller Condition</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--ss-space-sm);">
        ${propellers
          .map(
            (prop) => `
          <div style="padding: var(--ss-space-sm); background: var(--ss-bg-light); border: 1px solid var(--ss-border);">
            <div style="font-size: var(--ss-text-xs); color: var(--ss-text-medium); margin-bottom: var(--ss-space-xs);">Propeller #${prop.number || 1}</div>
            <span class="condition-badge ${getConditionClass(prop.condition || "good")}" style="display: inline-block; padding: var(--ss-space-xs) var(--ss-space-sm); border-radius: var(--ss-radius-none); font-size: var(--ss-text-xs); font-weight: 600;">
              ${escapeHtml(prop.condition || "N/A")}
            </span>
            ${prop.notes ? `<div style="margin-top: var(--ss-space-xs); font-size: var(--ss-text-xs); color: var(--ss-text-medium); font-style: italic;">${escapeHtml(prop.notes)}</div>` : ""}
          </div>
        `,
          )
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
