/**
 * Service Logs API Client
 * Handles all service log-related data access for customer portal
 */

import { createSupabaseClient } from "../lib/supabase.js";

const supabase = createSupabaseClient();

/**
 * Load service logs for a boat
 * @param {string} boatId - Boat ID
 * @param {object} filters - Optional filters (status, dateRange)
 * @returns {Promise<{serviceLogs, error}>}
 */
export async function loadServiceLogs(boatId, filters = {}) {
  try {
    let query = supabase
      .from("service_logs")
      .select("*")
      .eq("boat_id", boatId)
      .order("service_date", { ascending: false });

    // Apply filters
    if (filters.startDate) {
      query = query.gte("service_date", filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte("service_date", filters.endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { serviceLogs: data || [], error: null };
  } catch (error) {
    console.error("Load service logs error:", error);
    return { serviceLogs: [], error: error.message };
  }
}

/**
 * Get single service log
 * @param {string} logId - Service log ID
 * @returns {Promise<{serviceLog, error}>}
 */
export async function getServiceLog(logId) {
  try {
    const { data, error } = await supabase
      .from("service_logs")
      .select(
        `
        *,
        boat:boats(name, slug)
      `,
      )
      .eq("id", logId)
      .single();

    if (error) throw error;

    return { serviceLog: data, error: null };
  } catch (error) {
    console.error("Get service log error:", error);
    return { serviceLog: null, error: error.message };
  }
}

/**
 * Get service log statistics for a boat
 * @param {string} boatId - Boat ID
 * @returns {Promise<{stats, error}>}
 */
export async function getServiceStats(boatId) {
  try {
    const { data: logs, error } = await supabase
      .from("service_logs")
      .select("service_date, service_name")
      .eq("boat_id", boatId)
      .order("service_date", { ascending: false });

    if (error) throw error;

    // Calculate stats
    const totalServices = logs.length;

    // Get most recent service
    const lastService = logs.length > 0 ? logs[0] : null;

    // Count services this year
    const currentYear = new Date().getFullYear();
    const servicesThisYear = logs.filter((log) => {
      const logYear = new Date(log.service_date).getFullYear();
      return logYear === currentYear;
    }).length;

    const stats = {
      total: totalServices,
      lastServiceDate: lastService ? lastService.service_date : null,
      lastServiceName: lastService ? lastService.service_name : null,
      thisYear: servicesThisYear,
    };

    return { stats, error: null };
  } catch (error) {
    console.error("Get service stats error:", error);
    return { stats: null, error: error.message };
  }
}

/**
 * Get recent service logs for a boat
 * @param {string} boatId - Boat ID
 * @param {number} limit - Number of logs to return
 * @returns {Promise<{serviceLogs, error}>}
 */
export async function getRecentServiceLogs(boatId, limit = 5) {
  try {
    const { data, error } = await supabase
      .from("service_logs")
      .select("*")
      .eq("boat_id", boatId)
      .order("service_date", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return { serviceLogs: data || [], error: null };
  } catch (error) {
    console.error("Get recent service logs error:", error);
    return { serviceLogs: [], error: error.message };
  }
}

/**
 * Format date
 * @param {string} dateString - ISO date string
 * @returns {string}
 */
export function formatDate(dateString) {
  if (!dateString) return "N/A";
  return new Date(dateString + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format short date
 * @param {string} dateString - ISO date string
 * @returns {string}
 */
export function formatShortDate(dateString) {
  if (!dateString) return "N/A";
  return new Date(dateString + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Get condition badge class
 * @param {string} condition - Condition value
 * @returns {string}
 */
export function getConditionClass(condition) {
  if (!condition) return "condition-default";

  const conditionLower = condition.toLowerCase().trim();

  // Full condition mappings matching billing slider
  const conditionMap = {
    "not inspected": "condition-not-inspected",
    "not-inspected": "condition-not-inspected",
    excellent: "condition-excellent",
    "excellent-good": "condition-excellent-good",
    "excellent good": "condition-excellent-good",
    good: "condition-good",
    "good-fair": "condition-good-fair",
    "good fair": "condition-good-fair",
    fair: "condition-fair",
    "fair-poor": "condition-fair-poor",
    "fair poor": "condition-fair-poor",
    poor: "condition-poor",
    "very poor": "condition-very-poor",
    "very-poor": "condition-very-poor",
    critical: "condition-critical", // Legacy alias for very poor
  };

  // Anode-specific status mappings
  if (
    conditionLower.includes("needs replacement") ||
    conditionLower.includes("missing")
  ) {
    return "condition-poor";
  }
  if (
    conditionLower.includes("installed") ||
    conditionLower.includes("replaced")
  ) {
    return "condition-good";
  }

  // Check for exact match first
  if (conditionMap[conditionLower]) {
    return conditionMap[conditionLower];
  }

  // Check for comma-separated conditions (e.g., "Good, Fair")
  // Use the worst condition mentioned
  if (
    conditionLower.includes("very poor") ||
    conditionLower.includes("critical")
  ) {
    return "condition-very-poor";
  }
  if (conditionLower.includes("poor")) {
    return "condition-poor";
  }
  if (conditionLower.includes("fair-poor")) {
    return "condition-fair-poor";
  }
  if (conditionLower.includes("fair")) {
    return "condition-fair";
  }
  if (conditionLower.includes("good-fair")) {
    return "condition-good-fair";
  }
  if (conditionLower.includes("good")) {
    return "condition-good";
  }
  if (conditionLower.includes("excellent-good")) {
    return "condition-excellent-good";
  }
  if (conditionLower.includes("excellent")) {
    return "condition-excellent";
  }
  if (conditionLower.includes("not inspected")) {
    return "condition-not-inspected";
  }

  return "condition-default";
}

/**
 * Format hours
 * @param {number} hours - Hours value
 * @returns {string}
 */
export function formatHours(hours) {
  if (!hours) return "N/A";
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}
