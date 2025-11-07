/**
 * Customer API Functions
 * Admin-only functions for managing customer data
 */

import { createSupabaseClient } from "../lib/supabase.js";
import { getCurrentUser, isAdmin } from "../auth/auth.js";

const supabase = createSupabaseClient();

/**
 * Get all customers for admin selector
 * @returns {Object} { customers: Array, error }
 */
export async function getAllCustomers() {
  // Verify admin access
  const { user } = await getCurrentUser();
  if (!user) {
    return { customers: [], error: "Not authenticated" };
  }

  const adminStatus = await isAdmin(user.id);
  if (!adminStatus) {
    console.error("Non-admin attempted to fetch all customers");
    return { customers: [], error: "Unauthorized" };
  }

  // Fetch all customers with boat count
  const { data: customers, error } = await supabase
    .from("customers")
    .select(
      `
      id,
      name,
      email,
      boats:boats(count)
    `,
    )
    .order("name");

  if (error) {
    console.error("Error fetching customers:", error);
    return { customers: [], error };
  }

  // Format for display: "Name (email) - X boat(s)"
  const formatted = customers.map((c) => {
    const boatCount = c.boats?.[0]?.count || 0;
    const name = c.name || c.email; // Fallback to email if no name
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      boatCount,
      displayText: `${name} (${c.email}) - ${boatCount} boat${boatCount !== 1 ? "s" : ""}`,
    };
  });

  return { customers: formatted, error: null };
}
