/**
 * Service History View
 * Customer-facing service history page
 */

import {
  requireAuth,
  getCurrentUser,
  getUserBoats,
  logout,
} from "../auth/auth.js";
import {
  loadServiceLogs,
  getServiceStats,
  formatDate,
  formatShortDate,
  formatHours,
  getConditionClass,
} from "../api/service-logs.js";
import { getBoatPlaylist, getPlaylistVideos } from "../api/boat-data.js";

// Check authentication
const isAuth = await requireAuth();
if (!isAuth) {
  throw new Error("Not authenticated");
}

// Get current user and boats
const { user, error: userError } = await getCurrentUser();
if (userError || !user) {
  console.error("Failed to get user:", userError);
  window.location.href = "/login.html";
  throw new Error("User not found");
}

// DOM Elements (must be defined before any potential showEmptyState() calls)
const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");
const dateRangeSelect = document.getElementById("date-range");
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

// Use first boat (in Phase 8 we'll add boat switching)
const currentBoat = boats[0];

// Playlist data (fetched once, used for all service logs)
let boatPlaylist = null;
let playlistVideos = [];

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Logout handler
  logoutBtn.addEventListener("click", async () => {
    await logout();
    window.location.href = "/login.html";
  });

  // Filter change handler
  dateRangeSelect.addEventListener("change", loadServices);
}

// Initialize
async function init() {
  // Set user email
  userEmailEl.textContent = user.email;

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

  // Get date range filter
  const dateRange = dateRangeSelect.value;
  const filters = {};

  if (dateRange !== "all") {
    const days = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    filters.startDate = startDate.toISOString().split("T")[0];
  }

  // Load service logs
  const { serviceLogs, error } = await loadServiceLogs(currentBoat.id, filters);

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
 */
function createTimelineItem(log, index, nextServiceDate = null) {
  const hasDetails =
    log.paint_condition_overall ||
    log.growth_level ||
    log.thru_hull_condition ||
    (log.anode_conditions && log.anode_conditions.length > 0) ||
    log.notes ||
    (log.propellers && log.propellers.length > 0);

  // Check if we have videos for this service
  const videosSection = createVideosSection(log, nextServiceDate);
  const hasVideos = videosSection !== "";
  const hasAnyDetails = hasDetails || hasVideos;

  return `
    <div class="timeline-item" data-log-id="${log.id}">
      <div class="timeline-header">
        <div>
          <div class="timeline-date">${formatDate(log.service_date)}</div>
          ${log.service_name ? `<div class="service-name">${escapeHtml(log.service_name)}</div>` : ""}
        </div>
        ${hasAnyDetails ? '<span class="expand-icon">▼</span>' : ""}
      </div>

      ${
        hasAnyDetails
          ? `
        <div class="timeline-details">
          ${videosSection}
          ${createConditionsSection(log)}
          ${createAnodesSection(log)}
          ${createPropellersSection(log)}
          ${
            log.notes
              ? `
            <div class="detail-section">
              <h4>Service Notes</h4>
              <div class="notes-section">${escapeHtml(log.notes)}</div>
            </div>
          `
              : ""
          }
        </div>
      `
          : ""
      }
    </div>
  `;
}

/**
 * Create conditions section
 */
function createConditionsSection(log) {
  const hasConditions =
    log.paint_condition_overall || log.growth_level || log.thru_hull_condition;

  if (!hasConditions) return "";

  return `
    <div class="detail-section">
      <h4>Vessel Condition</h4>
      <div class="detail-grid">
        ${
          log.paint_condition_overall
            ? `
          <div class="detail-item">
            <div class="detail-label">Paint Condition</div>
            <div class="detail-value">
              <span class="condition-badge ${getConditionClass(log.paint_condition_overall)}">
                ${escapeHtml(log.paint_condition_overall)}
              </span>
            </div>
          </div>
        `
            : ""
        }

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

        ${
          log.growth_level
            ? `
          <div class="detail-item">
            <div class="detail-label">Growth Level</div>
            <div class="detail-value">${escapeHtml(log.growth_level)}</div>
          </div>
        `
            : ""
        }

        ${
          log.thru_hull_condition
            ? `
          <div class="detail-item">
            <div class="detail-label">Through-Hulls</div>
            <div class="detail-value">${escapeHtml(log.thru_hull_condition)}</div>
          </div>
        `
            : ""
        }
      </div>

      ${
        log.thru_hull_notes
          ? `
        <div style="margin-top: var(--ss-space-sm); font-size: var(--ss-font-size-sm); color: var(--ss-neutral-600); font-style: italic;">
          ${escapeHtml(log.thru_hull_notes)}
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
  // Ensure anode_conditions is an array
  if (!log.anode_conditions) return "";

  const anodeConditions = Array.isArray(log.anode_conditions)
    ? log.anode_conditions
    : log.anode_conditions.anodes || []; // Handle object format {anodes: [...]}

  if (anodeConditions.length === 0) return "";

  return `
    <div class="detail-section">
      <h4>⚓ Anode Inspection</h4>
      <ul class="anode-list">
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

            // Check if this anode was replaced
            const replacement =
              log.anodes_installed &&
              log.anodes_installed.find(
                (installed) =>
                  installed.location &&
                  installed.location.toLowerCase() === location.toLowerCase() &&
                  (!installed.position ||
                    !anode.position ||
                    installed.position.toLowerCase() ===
                      anode.position.toLowerCase()),
              );

            return `
            <li class="anode-item">
              <div>
                ${locationText ? `<strong>${escapeHtml(locationText)}</strong>` : ""}
                ${replacement ? '<span style="color: var(--ss-success-700); margin-left: var(--ss-space-xs);">✓ Replaced</span>' : ""}
              </div>
              <div>
                <span class="condition-badge ${getConditionClass(anode.condition || anode.overall_condition || "fair")}">
                  ${escapeHtml(condition)}
                </span>
              </div>
            </li>
          `;
          })
          .join("")}
      </ul>
    </div>
  `;
}

/**
 * Create propellers section
 */
function createPropellersSection(log) {
  // Ensure propellers is an array
  if (!log.propellers) return "";

  const propellers = Array.isArray(log.propellers) ? log.propellers : [];

  if (propellers.length === 0) return "";

  return `
    <div class="detail-section">
      <h4>Propeller Condition</h4>
      <ul class="anode-list">
        ${propellers
          .map(
            (prop) => `
          <li class="anode-item">
            <div><strong>Propeller #${prop.number || 1}</strong></div>
            <div>
              <span class="condition-badge ${getConditionClass(prop.condition || "good")}">
                ${escapeHtml(prop.condition || "N/A")}
              </span>
            </div>
          </li>
          ${prop.notes ? `<div style="padding-left: var(--ss-space-md); font-size: var(--ss-font-size-xs); color: var(--ss-neutral-600); font-style: italic;">${escapeHtml(prop.notes)}</div>` : ""}
        `,
          )
          .join("")}
      </ul>
      ${
        log.propeller_notes
          ? `
        <div style="margin-top: var(--ss-space-sm); font-size: var(--ss-font-size-sm); color: var(--ss-neutral-600); font-style: italic;">
          ${escapeHtml(log.propeller_notes)}
        </div>
      `
          : ""
      }
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
