/**
 * Authentication Module
 * Handles user authentication, session management, and authorization
 */

import { createClient } from '@supabase/supabase-js';

// Create Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{user, session, error}>}
 */
export async function loginWithEmail(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Update last login timestamp
    if (data.user) {
      await updateLastLogin(data.user.id);
    }

    return { user: data.user, session: data.session, error: null };
  } catch (error) {
    console.error('Login error:', error);
    return { user: null, session: null, error: error.message };
  }
}

/**
 * Login with magic link (passwordless)
 * @param {string} email - User email
 * @returns {Promise<{success, error}>}
 */
export async function loginWithMagicLink(email) {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/portal`
      }
    });

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error('Magic link error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sign up new user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} boatSlug - Boat slug for initial access
 * @returns {Promise<{user, session, error}>}
 */
export async function signUp(email, password, boatSlug = null) {
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/portal`
      }
    });

    if (authError) throw authError;

    // Create customer account record
    const { data: accountData, error: accountError } = await supabase
      .from('customer_accounts')
      .insert({
        id: authData.user.id,
        email: email,
        magic_link_enabled: true,
        password_enabled: true
      })
      .select()
      .single();

    if (accountError) throw accountError;

    // If boat slug provided, grant access
    if (boatSlug) {
      await grantBoatAccessBySlug(authData.user.id, boatSlug);
    }

    return { user: authData.user, session: authData.session, error: null };
  } catch (error) {
    console.error('Signup error:', error);
    return { user: null, session: null, error: error.message };
  }
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<{success, error}>}
 */
export async function resetPassword(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error('Password reset error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user password
 * @param {string} newPassword - New password
 * @returns {Promise<{success, error}>}
 */
export async function updatePassword(newPassword) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error('Password update error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current authenticated user
 * @returns {Promise<{user, error}>}
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) throw error;

    return { user, error: null };
  } catch (error) {
    console.error('Get user error:', error);
    return { user: null, error: error.message };
  }
}

/**
 * Get current session
 * @returns {Promise<{session, error}>}
 */
export async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) throw error;

    return { session, error: null };
  } catch (error) {
    console.error('Get session error:', error);
    return { session: null, error: error.message };
  }
}

/**
 * Sign out current user
 * @returns {Promise<{success, error}>}
 */
export async function logout() {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    // Clear any local storage
    localStorage.removeItem('currentBoatId');

    return { success: true, error: null };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const { session } = await getCurrentSession();
  return !!session;
}

/**
 * Require authentication (middleware for protected routes)
 * Redirects to login if not authenticated
 */
export async function requireAuth() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    // Store intended destination
    sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
    window.location.href = '/login.html';
    return false;
  }

  return true;
}

/**
 * Get user's accessible boats
 * @param {string} userId - User ID
 * @returns {Promise<{boats, error}>}
 */
export async function getUserBoats(userId) {
  try {
    const { data, error } = await supabase
      .from('customer_boat_access')
      .select(`
        *,
        boat:boats(*)
      `)
      .eq('customer_account_id', userId);

    if (error) throw error;

    const boats = data.map(access => ({
      ...access.boat,
      isPrimary: access.is_primary,
      grantedAt: access.granted_at
    }));

    return { boats, error: null };
  } catch (error) {
    console.error('Get boats error:', error);
    return { boats: [], error: error.message };
  }
}

/**
 * Grant boat access to user by boat slug
 * @param {string} userId - User ID
 * @param {string} boatSlug - Boat slug
 * @returns {Promise<{success, error}>}
 */
export async function grantBoatAccessBySlug(userId, boatSlug) {
  try {
    // Find boat by slug
    const { data: boat, error: boatError } = await supabase
      .from('boats')
      .select('id')
      .eq('slug', boatSlug)
      .single();

    if (boatError) throw new Error('Boat not found');

    // Grant access
    const { error: accessError } = await supabase
      .from('customer_boat_access')
      .insert({
        customer_account_id: userId,
        boat_id: boat.id,
        is_primary: true
      });

    if (accessError) throw accessError;

    return { success: true, error: null };
  } catch (error) {
    console.error('Grant access error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update last login timestamp
 * @param {string} userId - User ID
 */
async function updateLastLogin(userId) {
  try {
    await supabase
      .from('customer_accounts')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userId);
  } catch (error) {
    console.error('Update last login error:', error);
  }
}

/**
 * Listen for auth state changes
 * @param {Function} callback - Callback function
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

/**
 * Get customer account with preferences
 * @param {string} userId - User ID
 * @returns {Promise<{account, error}>}
 */
export async function getCustomerAccount(userId) {
  try {
    const { data, error } = await supabase
      .from('customer_accounts')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return { account: data, error: null };
  } catch (error) {
    console.error('Get account error:', error);
    return { account: null, error: error.message };
  }
}

/**
 * Update notification preferences
 * @param {string} userId - User ID
 * @param {object} preferences - Notification preferences
 * @returns {Promise<{success, error}>}
 */
export async function updateNotificationPreferences(userId, preferences) {
  try {
    const { error } = await supabase
      .from('customer_accounts')
      .update({ notification_preferences: preferences })
      .eq('id', userId);

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error('Update preferences error:', error);
    return { success: false, error: error.message };
  }
}
