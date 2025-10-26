/**
 * Account API Client
 * Handles all account management and settings operations
 */

import { createSupabaseClient } from '../lib/supabase.js';

const supabase = createSupabaseClient();

/**
 * Get current account information
 * @returns {Promise<{account, error}>}
 */
export async function getAccountInfo() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('customer_accounts')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    return { account: data, error: null };
  } catch (error) {
    console.error('Get account info error:', error);
    return { account: null, error: error.message };
  }
}

/**
 * Update email address (requires verification)
 * @param {string} newEmail - New email address
 * @returns {Promise<{success, error}>}
 */
export async function updateEmail(newEmail) {
  try {
    const { data, error } = await supabase.auth.updateUser({
      email: newEmail
    });

    if (error) throw error;

    // Note: User will receive a verification email at the new address
    // Email won't be updated until they confirm

    return { success: true, error: null, requiresVerification: true };
  } catch (error) {
    console.error('Update email error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update phone number
 * @param {string} newPhone - New phone number
 * @returns {Promise<{success, error}>}
 */
export async function updatePhone(newPhone) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Update phone in customer_accounts if we add that field
    // For now, we'll update it in the customers table via the linked customer
    const { data: boats } = await supabase
      .from('customer_boat_access')
      .select('boat:boats(customer_id)')
      .eq('customer_account_id', user.id)
      .limit(1)
      .single();

    if (boats?.boat?.customer_id) {
      const { error } = await supabase
        .from('customers')
        .update({ phone: newPhone })
        .eq('id', boats.boat.customer_id);

      if (error) throw error;
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Update phone error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Change password
 * @param {string} newPassword - New password
 * @returns {Promise<{success, error}>}
 */
export async function changePassword(newPassword) {
  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error('Change password error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get notification preferences
 * @returns {Promise<{preferences, error}>}
 */
export async function getNotificationPreferences() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('customer_accounts')
      .select('notification_preferences')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    return { preferences: data.notification_preferences, error: null };
  } catch (error) {
    console.error('Get notification preferences error:', error);
    return { preferences: null, error: error.message };
  }
}

/**
 * Update notification preferences
 * @param {object} preferences - Notification preferences object
 * @returns {Promise<{success, error}>}
 */
export async function updateNotificationPreferences(preferences) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const { error } = await supabase
      .from('customer_accounts')
      .update({ notification_preferences: preferences })
      .eq('id', user.id);

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error('Update notification preferences error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's accessible boats
 * @returns {Promise<{boats, error}>}
 */
export async function getAccessibleBoats() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('customer_boat_access')
      .select(`
        *,
        boat:boats(
          id,
          name,
          slug,
          make,
          model,
          year
        )
      `)
      .eq('customer_account_id', user.id)
      .order('is_primary', { ascending: false });

    if (error) throw error;

    return { boats: data || [], error: null };
  } catch (error) {
    console.error('Get accessible boats error:', error);
    return { boats: [], error: error.message };
  }
}

/**
 * Switch current boat
 * @param {string} boatId - Boat ID to switch to
 * @returns {Promise<{success, error}>}
 */
export async function switchCurrentBoat(boatId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Verify user has access to this boat
    const { data, error } = await supabase
      .from('customer_boat_access')
      .select('boat_id')
      .eq('customer_account_id', user.id)
      .eq('boat_id', boatId)
      .single();

    if (error || !data) {
      throw new Error('You do not have access to this boat');
    }

    // Store in localStorage
    localStorage.setItem('currentBoatId', boatId);

    return { success: true, error: null };
  } catch (error) {
    console.error('Switch boat error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get customer information (for profile display)
 * @returns {Promise<{customer, error}>}
 */
export async function getCustomerInfo() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get customer info from first boat access
    const { data: boatAccess } = await supabase
      .from('customer_boat_access')
      .select(`
        boat:boats(
          customer:customers(
            id,
            name,
            email,
            phone,
            billing_address
          )
        )
      `)
      .eq('customer_account_id', user.id)
      .limit(1)
      .single();

    const customer = boatAccess?.boat?.customer;

    return { customer: customer || null, error: null };
  } catch (error) {
    console.error('Get customer info error:', error);
    return { customer: null, error: error.message };
  }
}

/**
 * Delete account (soft delete / deactivate)
 * @returns {Promise<{success, error}>}
 */
export async function deleteAccount() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // In production, you might want to:
    // 1. Mark account as deleted/deactivated instead of hard delete
    // 2. Remove access to boats
    // 3. Keep data for legal/accounting purposes
    // 4. Send confirmation email

    // For now, we'll just sign out and let admin handle deletion
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error('Delete account error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Format phone number for display
 * @param {string} phone - Phone number
 * @returns {string}
 */
export function formatPhoneNumber(phone) {
  if (!phone) return 'N/A';

  // Simple US phone number formatting
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  return phone;
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean}
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password
 * @returns {object} {valid, message}
 */
export function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }

  return { valid: true, message: 'Password is strong' };
}
