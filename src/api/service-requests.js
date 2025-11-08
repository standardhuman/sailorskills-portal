/**
 * Service Requests API Client
 * Handles all service request-related data access
 */

import { createSupabaseClient } from "../lib/supabase.js";

// createSupabaseClient is the configured client instance, not a factory function
const supabase = createSupabaseClient;

/**
 * Submit a service inquiry
 * @param {string} boatId - Boat ID
 * @param {object} data - Inquiry data
 * @returns {Promise<{request, error}>}
 */
export async function submitInquiry(boatId, data) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    const { data: request, error } = await supabase
      .from("service_requests")
      .insert({
        boat_id: boatId,
        customer_account_id: user.id,
        request_type: "inquiry",
        service_type: data.serviceType,
        priority: data.priority || "normal",
        notes: data.notes,
        attachments: data.attachments || [],
      })
      .select()
      .single();

    if (error) throw error;
    return { request, error: null };
  } catch (error) {
    console.error("Submit inquiry error:", error);
    return { request: null, error: error.message };
  }
}

/**
 * Submit a booking request with preferred date/time
 * @param {string} boatId - Boat ID
 * @param {object} data - Booking data
 * @returns {Promise<{request, error}>}
 */
export async function submitBooking(boatId, data) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    const { data: request, error } = await supabase
      .from("service_requests")
      .insert({
        boat_id: boatId,
        customer_account_id: user.id,
        request_type: "booking",
        service_type: data.serviceType,
        priority: data.priority || "normal",
        preferred_date: data.preferredDate,
        preferred_time: data.preferredTime,
        notes: data.notes,
        attachments: data.attachments || [],
      })
      .select()
      .single();

    if (error) throw error;
    return { request, error: null };
  } catch (error) {
    console.error("Submit booking error:", error);
    return { request: null, error: error.message };
  }
}

/**
 * Load service requests for a boat
 * @param {string} boatId - Boat ID
 * @param {object} filters - Optional filters (status)
 * @returns {Promise<{requests, error}>}
 */
export async function loadServiceRequests(boatId, filters = {}) {
  try {
    let query = supabase
      .from("service_requests")
      .select("*")
      .eq("boat_id", boatId)
      .order("created_at", { ascending: false });

    // Apply filters
    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { requests: data || [], error: null };
  } catch (error) {
    console.error("Load service requests error:", error);
    return { requests: [], error: error.message };
  }
}

/**
 * Get single service request details
 * @param {string} requestId - Request ID
 * @returns {Promise<{request, error}>}
 */
export async function getRequestDetails(requestId) {
  try {
    const { data, error } = await supabase
      .from("service_requests")
      .select(
        `
        *,
        boat:boats(name, slug),
        customer_account:customer_accounts(email)
      `,
      )
      .eq("id", requestId)
      .single();

    if (error) throw error;

    return { request: data, error: null };
  } catch (error) {
    console.error("Get request details error:", error);
    return { request: null, error: error.message };
  }
}

/**
 * Upload photo attachment for service request
 * @param {File} file - File to upload
 * @param {string} boatId - Boat ID
 * @returns {Promise<{url, error}>}
 */
export async function uploadRequestPhoto(file, boatId) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExt = file.name.split(".").pop();
    const fileName = `${boatId}/${timestamp}.${fileExt}`;

    // Upload to storage
    const { data, error: uploadError } = await supabase.storage
      .from("customer-attachments")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("customer-attachments").getPublicUrl(fileName);

    return {
      url: publicUrl,
      filename: file.name,
      size: file.size,
      type: file.type,
      error: null,
    };
  } catch (error) {
    console.error("Upload photo error:", error);
    return { url: null, error: error.message };
  }
}

/**
 * Get service request statistics for a boat
 * @param {string} boatId - Boat ID
 * @returns {Promise<{stats, error}>}
 */
export async function getRequestStats(boatId) {
  try {
    const { data: requests, error } = await supabase
      .from("service_requests")
      .select("status, priority, created_at")
      .eq("boat_id", boatId);

    if (error) throw error;

    const stats = {
      total: requests.length,
      pending: requests.filter((r) => r.status === "pending").length,
      scheduled: requests.filter((r) => r.status === "scheduled").length,
      completed: requests.filter((r) => r.status === "completed").length,
      cancelled: requests.filter((r) => r.status === "cancelled").length,
      urgent: requests.filter(
        (r) => r.priority === "urgent" && r.status === "pending",
      ).length,
    };

    return { stats, error: null };
  } catch (error) {
    console.error("Get request stats error:", error);
    return { stats: null, error: error.message };
  }
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string}
 */
export function formatDate(dateString) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format date and time for display
 * @param {string} dateString - ISO date string
 * @param {string} timeString - Time string
 * @returns {string}
 */
export function formatDateTime(dateString, timeString) {
  if (!dateString) return "N/A";
  const formattedDate = formatDate(dateString);
  if (timeString) {
    return `${formattedDate} at ${timeString}`;
  }
  return formattedDate;
}

/**
 * Get status badge class
 * @param {string} status - Request status
 * @returns {string}
 */
export function getStatusClass(status) {
  const statusClasses = {
    pending: "status-pending",
    scheduled: "status-scheduled",
    completed: "status-completed",
    cancelled: "status-cancelled",
  };
  return statusClasses[status] || "status-default";
}

/**
 * Get status display text
 * @param {string} status - Request status
 * @returns {string}
 */
export function getStatusText(status) {
  const statusText = {
    pending: "Pending Review",
    scheduled: "Scheduled",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return statusText[status] || status;
}

/**
 * Get priority badge class
 * @param {string} priority - Request priority
 * @returns {string}
 */
export function getPriorityClass(priority) {
  const priorityClasses = {
    low: "priority-low",
    normal: "priority-normal",
    high: "priority-high",
    urgent: "priority-urgent",
  };
  return priorityClasses[priority] || "priority-normal";
}

/**
 * Get priority display text
 * @param {string} priority - Request priority
 * @returns {string}
 */
export function getPriorityText(priority) {
  const priorityText = {
    low: "Low",
    normal: "Normal",
    high: "High",
    urgent: "Urgent",
  };
  return priorityText[priority] || priority;
}

/**
 * Get service type display name
 * @param {string} serviceType - Service type code
 * @returns {string}
 */
export function getServiceTypeDisplay(serviceType) {
  const serviceTypes = {
    "bottom-cleaning": "Bottom Cleaning",
    "anode-replacement": "Anode Replacement",
    "general-maintenance": "General Maintenance",
    "emergency-repair": "Emergency Repair",
    inspection: "Inspection",
    other: "Other Service",
  };
  return serviceTypes[serviceType] || serviceType;
}
