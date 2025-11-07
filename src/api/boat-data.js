/**
 * Boat Data API
 * Fetch boat-specific data like service history, conditions, and videos
 */

import { createSupabaseClient } from "../lib/supabase.js";

const supabase = createSupabaseClient();

/**
 * Get latest service log for a boat
 * @param {string} boatId - Boat UUID
 * @returns {Promise<{serviceLog: Object|null, error: any}>}
 */
export async function getLatestServiceLog(boatId) {
  try {
    const { data, error } = await supabase
      .from("service_logs")
      .select("*")
      .eq("boat_id", boatId)
      .order("service_date", { ascending: false })
      .limit(1)
      .maybeSingle(); // Use maybeSingle() to return null if no rows exist

    if (error) {
      console.error("Error fetching latest service log:", error);
      return { serviceLog: null, error };
    }

    // data will be null if no service logs exist - this is OK
    return { serviceLog: data, error: null };
  } catch (err) {
    console.error("Exception in getLatestServiceLog:", err);
    return { serviceLog: null, error: err };
  }
}

/**
 * Normalize condition from Notion import format to standard format
 * Converts "Fair, Poor" → "fair-poor", "Fair, Good" → "good-fair"
 * Always orders from better condition to worse condition
 * @param {string} condition - Raw condition from database
 * @returns {string} Normalized condition
 */
function normalizeCondition(condition) {
  if (!condition) return "not-inspected";

  const raw = condition.trim();

  // Handle comma-separated ranges (e.g., "Fair, Poor" means fair-to-poor range)
  if (raw.includes(",")) {
    const parts = raw.split(",").map((p) => p.trim().toLowerCase());

    // Handle special cases
    if (parts.includes("missing")) {
      // "Good, Missing" or "Fair, Missing" → treat as "poor"
      return "poor";
    }

    // Severity ranking (lower number = better condition)
    const severityMap = {
      "not inspected": 0,
      "not-inspected": 0,
      excellent: 1,
      "excellent-good": 2,
      good: 3,
      "good-fair": 4,
      fair: 5,
      "fair-poor": 6,
      poor: 7,
      heavy: 7, // growth level
      moderate: 4, // growth level
      minimal: 2, // growth level
      "very-poor": 8,
    };

    // Sort parts by severity (better condition first)
    parts.sort((a, b) => {
      const sevA = severityMap[a] || 99;
      const sevB = severityMap[b] || 99;
      return sevA - sevB;
    });

    // Join with hyphen for range: "good-fair", "excellent-good", etc.
    return parts.join("-");
  }

  return raw.toLowerCase();
}

/**
 * Get paint condition data for a boat
 * Returns the latest paint condition assessment
 * @param {string} boatId - Boat UUID
 * @returns {Promise<{paintData: Object|null, error: any}>}
 */
export async function getPaintCondition(boatId) {
  try {
    const { serviceLog, error } = await getLatestServiceLog(boatId);

    if (error || !serviceLog) {
      return { paintData: null, error };
    }

    const paintData = {
      overall: normalizeCondition(serviceLog.paint_condition_overall),
      keel: serviceLog.paint_detail_keel,
      waterline: serviceLog.paint_detail_waterline,
      bootStripe: serviceLog.paint_detail_boot_stripe,
      serviceDate: serviceLog.service_date,
      growthLevel: normalizeCondition(serviceLog.growth_level),
    };

    return { paintData, error: null };
  } catch (err) {
    console.error("Exception in getPaintCondition:", err);
    return { paintData: null, error: err };
  }
}

/**
 * Get YouTube playlist for a boat
 * @param {string} boatId - Boat UUID
 * @returns {Promise<{playlist: Object|null, error: any}>}
 */
export async function getBoatPlaylist(boatId) {
  try {
    const { data, error } = await supabase
      .from("youtube_playlists")
      .select("*")
      .eq("boat_id", boatId)
      .eq("is_public", true)
      .maybeSingle(); // Use maybeSingle() to return null if no playlist exists

    if (error) {
      console.error("Error fetching playlist:", error);
      return { playlist: null, error };
    }

    // data will be null if no playlist exists - this is OK
    return { playlist: data, error: null };
  } catch (err) {
    console.error("Exception in getBoatPlaylist:", err);
    return { playlist: null, error: err };
  }
}

/**
 * Extract playlist ID from YouTube URL
 * @param {string} url - YouTube playlist URL
 * @returns {string|null} Playlist ID or null
 */
function extractPlaylistId(url) {
  if (!url) return null;

  // Handle different YouTube playlist URL formats
  const patterns = [
    /[?&]list=([a-zA-Z0-9_-]+)/, // ?list=... or &list=...
    /playlist\/([a-zA-Z0-9_-]+)/, // /playlist/...
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If already just the ID
  if (/^[a-zA-Z0-9_-]+$/.test(url)) {
    return url;
  }

  return null;
}

/**
 * Fetch videos from YouTube playlist via Supabase Edge Function
 * @param {string} playlistId - YouTube playlist ID
 * @param {string} serviceDate - Optional service date to filter videos (ISO format)
 * @param {number} maxResults - Maximum number of videos to fetch (default: 4)
 * @returns {Promise<{videos: Array, error: any}>}
 */
export async function getPlaylistVideos(
  playlistId,
  serviceDate = null,
  maxResults = 4,
) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/get-playlist-videos`;

    const params = new URLSearchParams({
      playlistId,
      maxResults: maxResults.toString(),
    });
    if (serviceDate) {
      params.append("serviceDate", serviceDate);
    }

    const response = await fetch(`${functionUrl}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch playlist videos");
    }

    const data = await response.json();
    return { videos: data.videos || [], error: null };
  } catch (err) {
    console.error("Exception in getPlaylistVideos:", err);
    return { videos: [], error: err };
  }
}

/**
 * Get service photos/videos for a boat's latest service
 * @param {string} boatId - Boat UUID
 * @returns {Promise<{media: Array, error: any}>}
 */
export async function getServiceMedia(boatId) {
  try {
    const { serviceLog, error: serviceError } =
      await getLatestServiceLog(boatId);

    if (serviceError) {
      console.error("Error loading service log:", serviceError);
      return { media: [], error: serviceError };
    }

    // Get photos from service log
    const photos = serviceLog?.photos || [];

    // Get YouTube playlist videos
    const { playlist, error: playlistError } = await getBoatPlaylist(boatId);

    if (playlistError) {
      console.warn("Error loading playlist (may not exist):", playlistError);
      // Not a critical error - just return photos
      return { media: photos, error: null };
    }

    if (!playlist) {
      // No playlist found - return photos only
      return { media: photos, error: null };
    }

    // Extract playlist ID from URL
    const playlistId =
      playlist.playlist_id || extractPlaylistId(playlist.playlist_url);

    if (!playlistId) {
      console.warn(
        "Could not extract playlist ID from URL:",
        playlist.playlist_url,
      );
      return { media: photos, error: null };
    }

    // Fetch videos from playlist (most recent 4 videos, not filtered by service date)
    const { videos, error: videosError } = await getPlaylistVideos(
      playlistId,
      null,
      4,
    );

    if (videosError) {
      console.error("Error fetching playlist videos:", videosError);
      // Return photos even if videos fail
      return { media: photos, error: null };
    }

    // Combine photos and videos
    const media = [...photos, ...videos];

    return { media, error: null };
  } catch (err) {
    console.error("Exception in getServiceMedia:", err);
    return { media: [], error: err };
  }
}

/**
 * Calculate days since last service
 * @param {string} serviceDate - Service date (YYYY-MM-DD)
 * @returns {number} Days since service
 */
export function daysSinceService(serviceDate) {
  if (!serviceDate) return null;

  const service = new Date(serviceDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison

  const diffTime = today - service;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays); // Return 0 for today, not negative for future dates
}

/**
 * Determine if paint is due for repainting based on condition and time
 * @param {string} paintCondition - Paint condition value
 * @param {number} daysSince - Days since last service
 * @returns {Object} Status object with isDue, status, message
 */
export function getPaintStatus(paintCondition, daysSince) {
  // Condition is already normalized to format like "fair-poor"
  const condition = paintCondition.toLowerCase().trim();

  // Paint condition threshold: good-fair = time to consider repainting
  // fair-poor or worse = past due
  const needsRepaint = ["fair-poor", "poor", "missing", "very-poor"].includes(
    condition,
  );
  const shouldConsider = ["good-fair", "fair"].includes(condition);

  let status = "good";
  let message = "Paint condition is good";
  let isDue = false;

  if (needsRepaint) {
    status = "past-due";
    message = "Paint needs attention soon";
    isDue = true;
  } else if (shouldConsider) {
    status = "due-soon";
    message = "Consider repainting in the near future";
    isDue = false;
  } else if (["excellent", "excellent-good", "good"].includes(condition)) {
    status = "good";
    message = "Paint condition is excellent";
    isDue = false;
  }

  return { isDue, status, message };
}
