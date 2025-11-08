/**
 * Authentication Module
 * Handles user authentication, session management, and authorization
 */

import { createClient } from "@supabase/supabase-js";

/**
 * Custom storage with SSO cookie support
 */
const customStorage = {
  getItem: (key) => {
    const localValue = localStorage.getItem(key);
    if (localValue) return localValue;
    // Fallback to cookie
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${key}=`);
    if (parts.length === 2) {
      return parts.pop().split(";").shift();
    }
    return null;
  },
  setItem: (key, value) => {
    localStorage.setItem(key, value);
    // Also set cookie with SSO domain
    const cookie = `${key}=${value}; path=/; max-age=604800; samesite=lax; domain=.sailorskills.com; secure`;
    document.cookie = cookie;
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
    document.cookie = `${key}=; path=/; max-age=-1; domain=.sailorskills.com`;
  },
};

// Create Supabase client with SSO configuration
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: customStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
    cookieOptions: {
      name: "sb-auth-token",
      domain: ".sailorskills.com",
      path: "/",
      sameSite: "lax",
      maxAge: 604800,
    },
  },
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
      password,
    });

    if (error) throw error;

    // Update last login timestamp
    if (data.user) {
      await updateLastLogin(data.user.id);
    }

    return { user: data.user, session: data.session, error: null };
  } catch (error) {
    console.error("Login error:", error);
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
        emailRedirectTo: `${window.location.origin}/portal`,
      },
    });

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error("Magic link error:", error);
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
        emailRedirectTo: `${window.location.origin}/portal`,
      },
    });

    if (authError) throw authError;

    // Create customer account record
    const { data: accountData, error: accountError } = await supabase
      .from("customer_accounts")
      .insert({
        id: authData.user.id,
        email: email,
        magic_link_enabled: true,
        password_enabled: true,
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
    console.error("Signup error:", error);
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
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error("Password reset error:", error);
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
      password: newPassword,
    });

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error("Password update error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current authenticated user
 * @returns {Promise<{user, error}>}
 */
export async function getCurrentUser() {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) throw error;

    return { user, error: null };
  } catch (error) {
    console.error("Get user error:", error);
    return { user: null, error: error.message };
  }
}

/**
 * Get current session
 * @returns {Promise<{session, error}>}
 */
export async function getCurrentSession() {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;

    return { session, error: null };
  } catch (error) {
    console.error("Get session error:", error);
    return { session: null, error: error.message };
  }
}

/**
 * Sign out current user
 * @returns {Promise<{success, error}>}
 */
export async function logout() {
  try {
    // Clear impersonation state on logout
    clearImpersonation();

    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    // Clear any local storage
    localStorage.removeItem("currentBoatId");

    return { success: true, error: null };
  } catch (error) {
    console.error("Logout error:", error);
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
 * Redirects to SSO login if not authenticated
 */
export async function requireAuth() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    // Redirect to SSO login service with return URL
    const redirectUrl = encodeURIComponent(window.location.href);
    window.location.href = `https://login.sailorskills.com/login.html?redirect=${redirectUrl}`;
    return false;
  }

  return true;
}

/**
 * Check if user is an admin
 * @param {string} userId - User ID (can be account ID or customer ID)
 * @returns {Promise<boolean>}
 */
export async function isAdmin(userId) {
  try {
    // If we're impersonating, userId might be a customer ID
    // In that case, get the actual admin user's account ID
    const impersonatedId = sessionStorage.getItem("impersonatedCustomerId");
    let checkUserId = userId;

    if (impersonatedId && userId === impersonatedId) {
      // User ID is a customer ID, get the actual authenticated user
      const { user } = await getCurrentUser();
      if (!user) return false;
      checkUserId = user.id;
    }

    const { data, error } = await supabase
      .from("customer_accounts")
      .select("is_admin")
      .eq("id", checkUserId)
      .single();

    if (error) {
      console.error("Error checking admin status:", error);
      return false;
    }

    return data?.is_admin === true;
  } catch (error) {
    console.error("Error in isAdmin check:", error);
    return false;
  }
}

/**
 * Set impersonation mode (admin only)
 * @param {string} customerId - Customer UUID to impersonate
 * @returns {Object} { success: boolean, error?: string }
 */
export async function setImpersonation(customerId) {
  // Verify current user is admin
  const { user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const adminStatus = await isAdmin(user.id);
  if (!adminStatus) {
    console.error("Non-admin attempted impersonation");
    return { success: false, error: "Unauthorized" };
  }

  sessionStorage.setItem("impersonatedCustomerId", customerId);
  return { success: true };
}

/**
 * Clear impersonation mode
 */
export function clearImpersonation() {
  sessionStorage.removeItem("impersonatedCustomerId");
}

/**
 * Get the effective user for data queries
 * Returns impersonated customer if admin is impersonating, otherwise returns actual user
 * @returns {Object} { user, error, isImpersonated?: boolean }
 */
export async function getEffectiveUser() {
  const impersonatedId = sessionStorage.getItem("impersonatedCustomerId");

  if (impersonatedId) {
    // Verify current user is still admin
    const { user: actualUser } = await getCurrentUser();
    if (!actualUser) {
      clearImpersonation();
      return { user: null, error: "Not authenticated" };
    }

    const adminStatus = await isAdmin(actualUser.id);
    if (!adminStatus) {
      // Security: Non-admin shouldn't have impersonation state
      console.warn("Non-admin had impersonation state - clearing");
      clearImpersonation();
      return { user: actualUser, error: null };
    }

    // Fetch impersonated customer from customers table
    const { data: customer, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", impersonatedId)
      .single();

    if (error) {
      console.error("Failed to load impersonated customer:", error);
      clearImpersonation();
      return { user: actualUser, error: "Impersonation failed" };
    }

    // Return customer as user with impersonation flag
    return { user: customer, error: null, isImpersonated: true };
  }

  // No impersonation - return actual user
  return getCurrentUser();
}

/**
 * Get user's accessible boats
 * If user is admin, returns ALL boats. Otherwise returns only boats with granted access.
 * @param {string} userId - User ID
 * @returns {Promise<{boats, error}>}
 */
export async function getUserBoats(userId) {
  try {
    // Check if we're in impersonation mode
    const impersonatedId = sessionStorage.getItem("impersonatedCustomerId");

    if (impersonatedId && userId === impersonatedId) {
      // Impersonating: userId is a customer_id, query boats directly
      const { data, error } = await supabase
        .from("boats")
        .select("*")
        .eq("customer_id", userId)
        .order("name", { ascending: true });

      if (error) throw error;

      // Format boats for impersonated view
      const boats = data.map((boat) => ({
        ...boat,
        isPrimary: false,
        grantedAt: null,
        isAdminView: false,
      }));

      return { boats, error: null };
    }

    // Check if user is admin
    const adminStatus = await isAdmin(userId);

    if (adminStatus) {
      // Admin: return ALL boats
      const { data, error } = await supabase
        .from("boats")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;

      // Format boats with admin flag
      const boats = data.map((boat) => ({
        ...boat,
        isPrimary: false, // Admin doesn't have a primary boat
        grantedAt: null,
        isAdminView: true, // Flag to indicate admin view
      }));

      return { boats, error: null };
    }

    // Regular user: return only boats with access
    const { data, error } = await supabase
      .from("customer_boat_access")
      .select(
        `
        *,
        boat:boats(*)
      `,
      )
      .eq("customer_account_id", userId);

    if (error) throw error;

    const boats = data.map((access) => ({
      ...access.boat,
      isPrimary: access.is_primary,
      grantedAt: access.granted_at,
      isAdminView: false,
    }));

    return { boats, error: null };
  } catch (error) {
    console.error("Get boats error:", error);
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
      .from("boats")
      .select("id")
      .eq("slug", boatSlug)
      .single();

    if (boatError) throw new Error("Boat not found");

    // Grant access
    const { error: accessError } = await supabase
      .from("customer_boat_access")
      .insert({
        customer_account_id: userId,
        boat_id: boat.id,
        is_primary: true,
      });

    if (accessError) throw accessError;

    return { success: true, error: null };
  } catch (error) {
    console.error("Grant access error:", error);
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
      .from("customer_accounts")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", userId);
  } catch (error) {
    console.error("Update last login error:", error);
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
      .from("customer_accounts")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) throw error;

    return { account: data, error: null };
  } catch (error) {
    console.error("Get account error:", error);
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
      .from("customer_accounts")
      .update({ notification_preferences: preferences })
      .eq("id", userId);

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error("Update preferences error:", error);
    return { success: false, error: error.message };
  }
}
