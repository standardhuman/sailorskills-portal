/**
 * Boat Data API
 * Fetch boat-specific data like service history, conditions, and videos
 */

import { createSupabaseClient } from '../lib/supabase.js';

const supabase = createSupabaseClient();

/**
 * Get latest service log for a boat
 * @param {string} boatId - Boat UUID
 * @returns {Promise<{serviceLog: Object|null, error: any}>}
 */
export async function getLatestServiceLog(boatId) {
  try {
    const { data, error } = await supabase
      .from('service_logs')
      .select('*')
      .eq('boat_id', boatId)
      .order('service_date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching latest service log:', error);
      return { serviceLog: null, error };
    }

    return { serviceLog: data, error: null };
  } catch (err) {
    console.error('Exception in getLatestServiceLog:', err);
    return { serviceLog: null, error: err };
  }
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
      overall: serviceLog.paint_condition_overall || 'not-inspected',
      keel: serviceLog.paint_detail_keel,
      waterline: serviceLog.paint_detail_waterline,
      bootStripe: serviceLog.paint_detail_boot_stripe,
      serviceDate: serviceLog.service_date,
      growthLevel: serviceLog.growth_level,
    };

    return { paintData, error: null };
  } catch (err) {
    console.error('Exception in getPaintCondition:', err);
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
      .from('youtube_playlists')
      .select('*')
      .eq('boat_id', boatId)
      .eq('is_public', true)
      .single();

    if (error && error.code !== 'PGRST116') { // Not a "not found" error
      console.error('Error fetching playlist:', error);
      return { playlist: null, error };
    }

    return { playlist: data, error: null };
  } catch (err) {
    console.error('Exception in getBoatPlaylist:', err);
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
    /[?&]list=([a-zA-Z0-9_-]+)/,  // ?list=... or &list=...
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
 * @returns {Promise<{videos: Array, error: any}>}
 */
export async function getPlaylistVideos(playlistId, serviceDate = null) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/get-playlist-videos`;

    const params = new URLSearchParams({ playlistId });
    if (serviceDate) {
      params.append('serviceDate', serviceDate);
    }

    const response = await fetch(`${functionUrl}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch playlist videos');
    }

    const data = await response.json();
    return { videos: data.videos || [], error: null };
  } catch (err) {
    console.error('Exception in getPlaylistVideos:', err);
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
    const { serviceLog, error: serviceError } = await getLatestServiceLog(boatId);

    if (serviceError) {
      console.error('Error loading service log:', serviceError);
      return { media: [], error: serviceError };
    }

    // Get photos from service log
    const photos = serviceLog?.photos || [];

    // Get YouTube playlist videos
    const { playlist, error: playlistError } = await getBoatPlaylist(boatId);

    if (playlistError) {
      console.warn('Error loading playlist (may not exist):', playlistError);
      // Not a critical error - just return photos
      return { media: photos, error: null };
    }

    if (!playlist) {
      // No playlist found - return photos only
      return { media: photos, error: null };
    }

    // Extract playlist ID from URL
    const playlistId = playlist.playlist_id || extractPlaylistId(playlist.playlist_url);

    if (!playlistId) {
      console.warn('Could not extract playlist ID from URL:', playlist.playlist_url);
      return { media: photos, error: null };
    }

    // Fetch videos from playlist, filtered by service date
    const serviceDate = serviceLog?.service_date;
    const { videos, error: videosError } = await getPlaylistVideos(playlistId, serviceDate);

    if (videosError) {
      console.error('Error fetching playlist videos:', videosError);
      // Return photos even if videos fail
      return { media: photos, error: null };
    }

    // Combine photos and videos
    const media = [...photos, ...videos];

    return { media, error: null };
  } catch (err) {
    console.error('Exception in getServiceMedia:', err);
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

  const service = new Date(serviceDate);
  const today = new Date();
  const diffTime = Math.abs(today - service);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Determine if paint is due for repainting based on condition and time
 * @param {string} paintCondition - Paint condition value
 * @param {number} daysSince - Days since last service
 * @returns {Object} Status object with isDue, status, message
 */
export function getPaintStatus(paintCondition, daysSince) {
  // Paint condition threshold: good-fair = time to consider repainting
  // fair-poor or worse = past due
  const needsRepaint = ['fair-poor', 'poor', 'very-poor'].includes(paintCondition);
  const shouldConsider = ['good-fair', 'fair'].includes(paintCondition);

  let status = 'good';
  let message = 'Paint condition is good';
  let isDue = false;

  if (needsRepaint) {
    status = 'past-due';
    message = 'Paint needs attention soon';
    isDue = true;
  } else if (shouldConsider) {
    status = 'due-soon';
    message = 'Consider repainting in the near future';
    isDue = false;
  } else if (['excellent', 'exc-good', 'good'].includes(paintCondition)) {
    status = 'good';
    message = 'Paint condition is excellent';
    isDue = false;
  }

  return { isDue, status, message };
}
