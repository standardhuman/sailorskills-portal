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
 * Get service photos/videos for a boat's latest service
 * @param {string} boatId - Boat UUID
 * @returns {Promise<{media: Array, error: any}>}
 */
export async function getServiceMedia(boatId) {
  try {
    const { serviceLog, error } = await getLatestServiceLog(boatId);

    if (error || !serviceLog) {
      return { media: [], error };
    }

    // Photos are stored in the service log
    const photos = serviceLog.photos || [];

    // TODO: Add video URL fetching when implemented
    // For now, return photos only
    return { media: photos, error: null };
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
