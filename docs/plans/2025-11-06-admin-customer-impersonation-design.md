# Admin Customer Impersonation - Design Document

**Date:** 2025-11-06
**Feature:** Admin ability to view portal as any customer
**Status:** Design Approved

## Overview

Enable administrators to select any customer and view the portal exactly as that customer sees it. This supports customer support, debugging, and testing workflows without requiring actual customer credentials.

## Requirements Summary

- **Scope:** Customer selector appears on all portal pages
- **Display:** Show "Name (email) - X boats" in selector
- **Persistence:** Session storage with prominent visual warning banner
- **UX:** Searchable dropdown for filtering large customer lists
- **Audit:** No tracking required for initial implementation
- **Architecture:** Auth layer with impersonation state (selected approach)

## Architecture

### Core Impersonation Layer

Location: `src/auth/auth.js`

Three new functions provide the impersonation capability:

```javascript
// Set impersonation state (admin only)
export async function setImpersonation(customerId) {
  // Verify current user is admin
  const { user } = await getCurrentUser();
  const adminStatus = await isAdmin(user.id);

  if (!adminStatus) {
    console.error('Non-admin attempted impersonation');
    return { success: false, error: 'Unauthorized' };
  }

  sessionStorage.setItem('impersonatedCustomerId', customerId);
  return { success: true };
}

// Clear impersonation state
export function clearImpersonation() {
  sessionStorage.removeItem('impersonatedCustomerId');
}

// Get the effective user for data queries
export async function getEffectiveUser() {
  const impersonatedId = sessionStorage.getItem('impersonatedCustomerId');

  if (impersonatedId) {
    // Verify current user is still admin
    const { user } = await getCurrentUser();
    const adminStatus = await isAdmin(user.id);

    if (!adminStatus) {
      // Security: Non-admin shouldn't have impersonation state
      clearImpersonation();
      return { user, error: null };
    }

    // Fetch impersonated customer
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', impersonatedId)
      .single();

    if (error) {
      console.error('Failed to load impersonated customer:', error);
      clearImpersonation();
      return { user, error: 'Impersonation failed' };
    }

    return { user: data, error: null, isImpersonated: true };
  }

  // No impersonation - return actual user
  return getCurrentUser();
}
```

### Data Flow Integration

**Current behavior:**
```javascript
// Existing code pattern
const { user } = await getCurrentUser();
const { boats } = await getUserBoats(user.id);
```

**Updated behavior:**
```javascript
// New code pattern
const { user } = await getEffectiveUser();
const { boats } = await getUserBoats(user.id);
```

**Key benefits:**
- No changes to database queries or RLS policies
- Supabase RLS naturally filters data based on which user object is passed
- Minimal code changes across portal pages
- Security model remains intact

## UI Components

### 1. Customer Selector Component

**Location:** Portal header (after logo, before user email)
**Visibility:** Admin users only
**Implementation:** Searchable input with datalist or filtered dropdown

**HTML Structure:**
```html
<!-- In portal header -->
<div class="admin-customer-selector" id="admin-customer-selector" style="display: none;">
  <label for="customer-search">View as Customer:</label>
  <input
    type="text"
    id="customer-search"
    placeholder="Search customers..."
    list="customer-list"
  />
  <datalist id="customer-list">
    <!-- Populated with customer options -->
  </datalist>
</div>
```

**Data Structure:**
```javascript
// API function to load all customers (admin only)
export async function getAllCustomers() {
  const { user } = await getCurrentUser();
  const adminStatus = await isAdmin(user.id);

  if (!adminStatus) {
    return { customers: [], error: 'Unauthorized' };
  }

  const { data, error } = await supabase
    .from('customers')
    .select(`
      id,
      email,
      boats:boats(count)
    `)
    .order('email');

  if (error) {
    return { customers: [], error };
  }

  // Format for display: "Name (email) - X boats"
  const formatted = data.map(c => ({
    id: c.id,
    displayText: `${c.email} - ${c.boats[0].count} boat(s)`,
    email: c.email
  }));

  return { customers: formatted, error: null };
}
```

### 2. Impersonation Banner Component

**Location:** Full-width banner below portal header, above navigation
**Visibility:** Only when impersonation is active
**Purpose:** Prevent admin confusion about whose data they're viewing

**HTML Structure:**
```html
<!-- Inserted dynamically when impersonation active -->
<div class="impersonation-banner" id="impersonation-banner" style="display: none;">
  <div class="banner-content">
    <span class="banner-icon">🔍</span>
    <span class="banner-text">
      Viewing portal as: <strong id="impersonated-customer-name">Loading...</strong>
    </span>
  </div>
  <button class="banner-exit-btn" id="exit-impersonation-btn">
    Exit Customer View
  </button>
</div>
```

**Styling:**
```css
.impersonation-banner {
  background: #fef3c7; /* Warm yellow */
  border-bottom: 2px solid #f59e0b;
  padding: var(--ss-space-sm) var(--ss-space-lg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.banner-content {
  display: flex;
  align-items: center;
  gap: var(--ss-space-sm);
  font-size: var(--ss-text-sm);
  color: var(--ss-text-dark);
}

.banner-exit-btn {
  padding: var(--ss-space-xs) var(--ss-space-md);
  background: var(--ss-primary);
  color: white;
  border: none;
  border-radius: var(--ss-radius-none);
  font-weight: 600;
  cursor: pointer;
}
```

## User Flows

### Flow 1: Admin Selects Customer

1. Admin logs into portal (sees customer selector in header)
2. Admin types customer name/email in search box
3. Dropdown filters customers matching search term
4. Admin clicks customer from filtered list
5. JavaScript calls `setImpersonation(customerId)`
6. Page reloads with `window.location.reload()`
7. Portal loads with impersonation banner visible
8. All data queries use impersonated customer's context
9. Admin sees exactly what customer sees

### Flow 2: Admin Exits Customer View

1. Admin clicks "Exit Customer View" button in banner
2. JavaScript calls `clearImpersonation()`
3. Page reloads
4. Portal returns to admin's own view
5. Impersonation banner disappears
6. Customer selector still visible (admin mode)

### Flow 3: Admin Navigation While Impersonating

1. Admin is viewing portal as Customer A
2. Admin clicks "Service History" navigation link
3. Service history page loads
4. Page calls `getEffectiveUser()` which returns Customer A's data
5. Service history shows Customer A's services
6. Impersonation banner remains visible on all pages
7. Admin can navigate freely while maintaining impersonation context

## Security Considerations

### Admin Verification
- Every call to `getEffectiveUser()` verifies actual authenticated user is an admin
- If non-admin user manually tampers with `sessionStorage`, impersonation is cleared
- Admin status checked via existing `isAdmin()` function (queries `user_roles` table)

### Session Storage Rationale
- **Clears on tab close:** Reduces risk of admin accidentally viewing wrong customer data in future sessions
- **Tab-specific:** Each browser tab maintains independent impersonation state
- **No server state:** Simpler implementation, no database tables needed
- **Visual warning:** Banner prevents confusion about active context

### Data Access
- No changes to Row-Level Security (RLS) policies needed
- Existing RLS policies continue to enforce customer data isolation
- Impersonation works by passing different user object, not bypassing security
- Admin cannot see data they shouldn't (RLS still applies to effective user)

## Implementation Files

### Files to Modify
1. **`src/auth/auth.js`** - Add impersonation functions
2. **`src/api/customers.js`** (new file) - Add `getAllCustomers()`
3. **`portal.html`** - Add customer selector and banner to header
4. **`portal-services.html`** - Update to use `getEffectiveUser()`
5. **`portal-invoices.html`** - Update to use `getEffectiveUser()`
6. **`portal-messages.html`** - Update to use `getEffectiveUser()`
7. **`portal-account.html`** - Update to use `getEffectiveUser()`
8. **`portal-request-service.html`** - Update to use `getEffectiveUser()`
9. **`src/views/portal.js`** - Update to use `getEffectiveUser()`, add selector logic
10. **`src/views/service-history.js`** - Update to use `getEffectiveUser()`
11. **`src/views/invoices.js`** - Update to use `getEffectiveUser()`
12. **`src/views/messages.js`** - Update to use `getEffectiveUser()`
13. **`src/views/account-settings.js`** - Update to use `getEffectiveUser()`
14. **`src/views/request-service.js`** - Update to use `getEffectiveUser()`
15. **`src/ui/portal-styles.css`** - Add banner and selector styles

### New Shared Component
Consider creating `src/components/admin-impersonation.js` to handle:
- Customer selector initialization
- Banner rendering
- Impersonation state management
- Event handlers (select customer, exit view)

This can be imported by all portal pages to reduce code duplication.

## Testing Considerations

### Manual Testing Checklist
- [ ] Admin can search and select customers
- [ ] Impersonation banner appears after selection
- [ ] Data loads correctly for impersonated customer
- [ ] Navigation maintains impersonation context
- [ ] Exit button clears impersonation
- [ ] Non-admin users don't see selector
- [ ] Session storage cleared on logout
- [ ] Multiple boats handled correctly
- [ ] Service history shows correct customer data
- [ ] Invoices show correct customer data

### Edge Cases
- Customer with no boats (should still work)
- Customer with no service history
- Admin switches between multiple customers rapidly
- Session storage manually modified by admin
- Impersonated customer deleted while admin viewing
- Network error during customer list load

## Future Enhancements

### Phase 2 Considerations (Not in Initial Scope)
1. **Audit logging** - Track when admins view customer accounts
2. **Recent customers list** - Show last 5 viewed customers for quick access
3. **Customer details preview** - Show boat names before selecting customer
4. **Keyboard navigation** - Arrow keys to navigate customer list
5. **localStorage option** - Toggle to persist impersonation across sessions (with clear warning)

## Success Criteria

Feature is complete when:
1. ✅ Admin can select any customer from searchable dropdown
2. ✅ Portal displays impersonated customer's data correctly
3. ✅ Impersonation persists across page navigation (within session)
4. ✅ Visual banner clearly indicates impersonation mode
5. ✅ Admin can exit customer view and return to own account
6. ✅ Non-admin users cannot access impersonation features
7. ✅ No security vulnerabilities introduced

---

**Next Steps:** Create implementation plan with detailed tasks and file changes.
