/**
 * Messages API Client
 * Handles all messaging-related data access
 */

import { createSupabaseClient } from "../lib/supabase.js";

// createSupabaseClient is the configured client instance, not a factory function
const supabase = createSupabaseClient;

/**
 * Load all conversations for a boat
 * Groups messages by service_log_id or general conversation
 * @param {string} boatId - Boat ID
 * @returns {Promise<{conversations, error}>}
 */
export async function loadConversations(boatId) {
  try {
    const { data: messages, error } = await supabase
      .from("customer_messages")
      .select("*")
      .eq("boat_id", boatId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Group messages by service_log_id (or null for general)
    const grouped = {};
    messages.forEach((msg) => {
      const key = msg.service_log_id || "general";
      if (!grouped[key]) {
        grouped[key] = {
          id: key,
          service_log_id: msg.service_log_id,
          messages: [],
          last_message_at: msg.created_at,
          unread_count: 0,
        };
      }
      grouped[key].messages.push(msg);

      // Count unread (messages from admin that haven't been read)
      if (msg.sender_type === "admin" && !msg.read_at) {
        grouped[key].unread_count++;
      }
    });

    const conversations = Object.values(grouped);

    return { conversations, error: null };
  } catch (error) {
    console.error("Load conversations error:", error);
    return { conversations: [], error: error.message };
  }
}

/**
 * Load message thread
 * @param {string} boatId - Boat ID
 * @param {string|null} serviceLogId - Optional service log ID
 * @returns {Promise<{messages, error}>}
 */
export async function loadThread(boatId, serviceLogId = null) {
  try {
    let query = supabase
      .from("customer_messages")
      .select("*")
      .eq("boat_id", boatId)
      .order("created_at", { ascending: true });

    if (serviceLogId) {
      query = query.eq("service_log_id", serviceLogId);
    } else {
      query = query.is("service_log_id", null);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { messages: data || [], error: null };
  } catch (error) {
    console.error("Load thread error:", error);
    return { messages: [], error: error.message };
  }
}

/**
 * Send a message
 * @param {string} boatId - Boat ID
 * @param {string} messageText - Message content
 * @param {string} senderAccountId - Sender's account ID
 * @param {Array} attachments - File attachments
 * @param {string|null} serviceLogId - Optional service log ID
 * @returns {Promise<{message, error}>}
 */
export async function sendMessage(
  boatId,
  messageText,
  senderAccountId,
  attachments = [],
  serviceLogId = null,
) {
  try {
    const { data, error } = await supabase
      .from("customer_messages")
      .insert({
        boat_id: boatId,
        service_log_id: serviceLogId,
        sender_type: "customer",
        sender_account_id: senderAccountId,
        message_text: messageText,
        attachments: attachments,
      })
      .select()
      .single();

    if (error) throw error;

    return { message: data, error: null };
  } catch (error) {
    console.error("Send message error:", error);
    return { message: null, error: error.message };
  }
}

/**
 * Mark messages as read
 * @param {Array<string>} messageIds - Array of message IDs to mark as read
 * @returns {Promise<{success, error}>}
 */
export async function markAsRead(messageIds) {
  try {
    const { error } = await supabase
      .from("customer_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", messageIds)
      .eq("sender_type", "admin") // Only mark admin messages as read
      .is("read_at", null);

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error("Mark as read error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get unread message count for a boat
 * @param {string} boatId - Boat ID
 * @returns {Promise<{count, error}>}
 */
export async function getUnreadCount(boatId) {
  try {
    const { count, error } = await supabase
      .from("customer_messages")
      .select("*", { count: "exact", head: true })
      .eq("boat_id", boatId)
      .eq("sender_type", "admin")
      .is("read_at", null);

    if (error) throw error;

    return { count: count || 0, error: null };
  } catch (error) {
    console.error("Get unread count error:", error);
    return { count: 0, error: error.message };
  }
}

/**
 * Upload file attachment to Supabase Storage
 * @param {File} file - File to upload
 * @param {string} boatId - Boat ID (for organizing storage)
 * @returns {Promise<{attachment, error}>}
 */
export async function uploadAttachment(file, boatId) {
  try {
    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error("File too large (max 10MB)");
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error("File type not allowed");
    }

    // Generate unique file name
    const timestamp = Date.now();
    const fileExt = file.name.split(".").pop();
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${boatId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("customer-attachments")
      .upload(filePath, file);

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("customer-attachments")
      .getPublicUrl(filePath);

    const attachment = {
      url: urlData.publicUrl,
      filename: file.name,
      size: file.size,
      type: file.type,
    };

    return { attachment, error: null };
  } catch (error) {
    console.error("Upload attachment error:", error);
    return { attachment: null, error: error.message };
  }
}

/**
 * Subscribe to new messages (real-time)
 * @param {string} boatId - Boat ID
 * @param {Function} callback - Callback function for new messages
 * @returns {Subscription}
 */
export function subscribeToMessages(boatId, callback) {
  const subscription = supabase
    .channel(`messages:${boatId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "customer_messages",
        filter: `boat_id=eq.${boatId}`,
      },
      (payload) => {
        callback(payload.new);
      },
    )
    .subscribe();

  return subscription;
}

/**
 * Unsubscribe from messages
 * @param {Subscription} subscription - Subscription to unsubscribe
 */
export async function unsubscribeFromMessages(subscription) {
  if (subscription) {
    await supabase.removeChannel(subscription);
  }
}

/**
 * Format timestamp for display
 * @param {string} timestamp - ISO timestamp
 * @returns {string}
 */
export function formatMessageTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if attachment is an image
 * @param {string} type - MIME type
 * @returns {boolean}
 */
export function isImage(type) {
  return type && type.startsWith("image/");
}
