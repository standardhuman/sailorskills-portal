# Admin Customer Impersonation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable admins to select and view the portal as any customer for support and debugging.

**Architecture:** Add impersonation layer in auth.js with getEffectiveUser() that returns impersonated customer when session storage is set. Add customer selector UI in header and visual banner to prevent confusion. Update all portal pages to use effective user instead of current user.

**Tech Stack:** Vanilla JavaScript, Supabase (PostgreSQL + Auth), Vite, sessionStorage API

---

## Task 1: Add Impersonation Functions to Auth Layer

**Files:**
- Modify: `src/auth/auth.js` (add 3 new functions)

**Step 1: Add setImpersonation() function**

Add this function after the existing `isAdmin()` function:

```javascript
/**
 * Set impersonation mode (admin only)
 * @param {string} customerId - Customer UUID to impersonate
 * @returns {Object} { success: boolean, error?: string }
 */
export async function setImpersonation(customerId) {
  // Verify current user is admin
  const { user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const adminStatus = await isAdmin(user.id);
  if (!adminStatus) {
    console.error('Non-admin attempted impersonation');
    return { success: false, error: 'Unauthorized' };
  }

  sessionStorage.setItem('impersonatedCustomerId', customerId);
  return { success: true };
}
```

**Step 2: Add clearImpersonation() function**

Add this function after `setImpersonation()`:

```javascript
/**
 * Clear impersonation mode
 */
export function clearImpersonation() {
  sessionStorage.removeItem('impersonatedCustomerId');
}
```

**Step 3: Add getEffectiveUser() function**

Add this function after `clearImpersonation()`:

```javascript
/**
 * Get the effective user for data queries
 * Returns impersonated customer if admin is impersonating, otherwise returns actual user
 * @returns {Object} { user, error, isImpersonated?: boolean }
 */
export async function getEffectiveUser() {
  const impersonatedId = sessionStorage.getItem('impersonatedCustomerId');

  if (impersonatedId) {
    // Verify current user is still admin
    const { user: actualUser } = await getCurrentUser();
    if (!actualUser) {
      clearImpersonation();
      return { user: null, error: 'Not authenticated' };
    }

    const adminStatus = await isAdmin(actualUser.id);
    if (!adminStatus) {
      // Security: Non-admin shouldn't have impersonation state
      console.warn('Non-admin had impersonation state - clearing');
      clearImpersonation();
      return { user: actualUser, error: null };
    }

    // Fetch impersonated customer from customers table
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', impersonatedId)
      .single();

    if (error) {
      console.error('Failed to load impersonated customer:', error);
      clearImpersonation();
      return { user: actualUser, error: 'Impersonation failed' };
    }

    // Return customer as user with impersonation flag
    return { user: customer, error: null, isImpersonated: true };
  }

  // No impersonation - return actual user
  return getCurrentUser();
}
```

**Step 4: Update logout() to clear impersonation**

Find the existing `logout()` function and add `clearImpersonation()` call before signing out:

```javascript
export async function logout() {
  // Clear impersonation state on logout
  clearImpersonation();

  const { error } = await supabase.auth.signOut();
  // ... rest of existing logout code
}
```

**Step 5: Commit auth layer changes**

```bash
git add src/auth/auth.js
git commit -m "feat(auth): add customer impersonation layer

Add setImpersonation(), clearImpersonation(), and getEffectiveUser()
functions to support admin viewing portal as any customer.

- setImpersonation() verifies admin status and sets session storage
- clearImpersonation() removes impersonation state
- getEffectiveUser() returns impersonated customer or actual user
- logout() now clears impersonation state

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Add Customer List API Function

**Files:**
- Create: `src/api/customers.js`

**Step 1: Create customers API file**

Create new file `src/api/customers.js` with this content:

```javascript
/**
 * Customer API Functions
 * Admin-only functions for managing customer data
 */

import { supabase } from '../lib/supabase.js';
import { getCurrentUser, isAdmin } from '../auth/auth.js';

/**
 * Get all customers for admin selector
 * @returns {Object} { customers: Array, error }
 */
export async function getAllCustomers() {
  // Verify admin access
  const { user } = await getCurrentUser();
  if (!user) {
    return { customers: [], error: 'Not authenticated' };
  }

  const adminStatus = await isAdmin(user.id);
  if (!adminStatus) {
    console.error('Non-admin attempted to fetch all customers');
    return { customers: [], error: 'Unauthorized' };
  }

  // Fetch all customers with boat count
  const { data: customers, error } = await supabase
    .from('customers')
    .select(`
      id,
      email,
      boats:boats(count)
    `)
    .order('email');

  if (error) {
    console.error('Error fetching customers:', error);
    return { customers: [], error };
  }

  // Format for display: "Email - X boat(s)"
  const formatted = customers.map(c => {
    const boatCount = c.boats?.[0]?.count || 0;
    return {
      id: c.id,
      email: c.email,
      boatCount,
      displayText: `${c.email} - ${boatCount} boat${boatCount !== 1 ? 's' : ''}`
    };
  });

  return { customers: formatted, error: null };
}
```

**Step 2: Commit customers API**

```bash
git add src/api/customers.js
git commit -m "feat(api): add getAllCustomers function for admin selector

Admin-only API function to fetch all customers with boat counts
for customer impersonation selector.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Add Customer Selector Component

**Files:**
- Modify: `portal.html` (add selector to header)
- Modify: `src/views/portal.js` (add selector initialization)

**Step 1: Add customer selector HTML to portal header**

In `portal.html`, find the `.portal-header` section and add the customer selector between the logo and user email:

```html
<header class="portal-header">
  <div class="header-left">
    <h1>⚓ Sailor Skills</h1>
  </div>
  <!-- ADD THIS SECTION -->
  <div class="admin-customer-selector" id="admin-customer-selector" style="display: none;">
    <label for="customer-search">View as:</label>
    <input
      type="text"
      id="customer-search"
      placeholder="Search customers..."
      autocomplete="off"
      list="customer-datalist"
    />
    <datalist id="customer-datalist"></datalist>
  </div>
  <!-- END NEW SECTION -->
  <div class="header-right">
    <span class="user-email" id="user-email">Loading...</span>
    <button class="btn btn-secondary" id="logout-btn">Sign Out</button>
  </div>
</header>
```

**Step 2: Add customer selector styles to portal.html**

In the `<style>` section of `portal.html`, add these styles before the closing `</style>` tag:

```css
/* Admin Customer Selector */
.admin-customer-selector {
  display: flex;
  align-items: center;
  gap: var(--ss-space-xs);
}

.admin-customer-selector label {
  font-size: var(--ss-text-sm);
  font-weight: 600;
  color: var(--ss-text-medium);
}

.admin-customer-selector input {
  width: 300px;
  padding: var(--ss-space-xs) var(--ss-space-sm);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-none);
  font-size: var(--ss-text-sm);
  font-family: var(--ss-font-primary);
}

.admin-customer-selector input:focus {
  outline: none;
  border-color: var(--ss-primary);
}
```

**Step 3: Add customer selector initialization to portal.js**

In `src/views/portal.js`, add import at top:

```javascript
import { getAllCustomers } from '../api/customers.js';
import { setImpersonation, clearImpersonation } from '../auth/auth.js';
```

Then add this function before the `init()` function:

```javascript
/**
 * Initialize customer selector for admins
 */
async function initCustomerSelector() {
  if (!isAdminUser) return;

  const selectorEl = document.getElementById('admin-customer-selector');
  const searchInput = document.getElementById('customer-search');
  const datalist = document.getElementById('customer-datalist');

  // Show selector for admins
  selectorEl.style.display = 'flex';

  // Load all customers
  const { customers, error } = await getAllCustomers();
  if (error) {
    console.error('Failed to load customers for selector:', error);
    return;
  }

  // Populate datalist
  customers.forEach(customer => {
    const option = document.createElement('option');
    option.value = customer.displayText;
    option.dataset.customerId = customer.id;
    datalist.appendChild(option);
  });

  // Handle customer selection
  searchInput.addEventListener('change', async (e) => {
    const selectedText = e.target.value;

    // Find matching customer
    const selectedOption = Array.from(datalist.options).find(
      opt => opt.value === selectedText
    );

    if (selectedOption) {
      const customerId = selectedOption.dataset.customerId;
      const { success } = await setImpersonation(customerId);

      if (success) {
        // Reload page to show impersonated view
        window.location.reload();
      }
    }
  });
}
```

**Step 4: Call initCustomerSelector in init() function**

In the `init()` function of `src/views/portal.js`, add this call after loading boats:

```javascript
async function init() {
  // ... existing code ...

  // Load boats
  await loadBoats();

  // Initialize customer selector for admins
  await initCustomerSelector();

  // Update welcome message
  updateWelcomeMessage();
}
```

**Step 5: Commit customer selector UI**

```bash
git add portal.html src/views/portal.js
git commit -m "feat(portal): add admin customer selector to header

Add searchable customer selector that appears for admin users.
Allows admin to type customer email and select to impersonate.

- Searchable input with datalist for filtering
- Only visible to admin users
- Triggers setImpersonation() and reloads page

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Add Impersonation Banner Component

**Files:**
- Modify: `portal.html` (add banner HTML and styles)
- Modify: `src/views/portal.js` (add banner initialization)

**Step 1: Add impersonation banner HTML**

In `portal.html`, add the banner immediately after the `</header>` closing tag and before the `<nav class="portal-nav">`:

```html
</header>

<!-- ADD THIS SECTION -->
<div class="impersonation-banner" id="impersonation-banner" style="display: none;">
  <div class="banner-content">
    <span class="banner-icon">🔍</span>
    <span class="banner-text">
      Viewing portal as: <strong id="impersonated-customer-display">Loading...</strong>
    </span>
  </div>
  <button class="btn-exit-impersonation" id="exit-impersonation-btn">
    Exit Customer View
  </button>
</div>
<!-- END NEW SECTION -->

<nav class="portal-nav">
```

**Step 2: Add impersonation banner styles**

In the `<style>` section of `portal.html`, add these styles:

```css
/* Impersonation Banner */
.impersonation-banner {
  background: #fef3c7;
  border-bottom: 2px solid #f59e0b;
  padding: var(--ss-space-sm) var(--ss-space-lg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.banner-content {
  display: flex;
  align-items: center;
  gap: var(--ss-space-sm);
  font-size: var(--ss-text-sm);
  color: var(--ss-text-dark);
}

.banner-icon {
  font-size: var(--ss-text-lg);
}

.banner-text {
  font-weight: 500;
}

.banner-text strong {
  color: var(--ss-primary);
  font-weight: 700;
}

.btn-exit-impersonation {
  padding: var(--ss-space-xs) var(--ss-space-md);
  background: var(--ss-primary);
  color: white;
  border: none;
  border-radius: var(--ss-radius-none);
  font-weight: 600;
  font-size: var(--ss-text-sm);
  cursor: pointer;
  font-family: var(--ss-font-primary);
  transition: background 0.2s;
}

.btn-exit-impersonation:hover {
  background: var(--ss-primary-dark);
}
```

**Step 3: Add banner initialization function to portal.js**

In `src/views/portal.js`, add this function before `init()`:

```javascript
/**
 * Initialize impersonation banner
 */
async function initImpersonationBanner() {
  const impersonatedId = sessionStorage.getItem('impersonatedCustomerId');

  if (!impersonatedId) {
    // No impersonation active
    return;
  }

  const bannerEl = document.getElementById('impersonation-banner');
  const displayEl = document.getElementById('impersonated-customer-display');
  const exitBtn = document.getElementById('exit-impersonation-btn');

  // Show banner
  bannerEl.style.display = 'flex';

  // Display impersonated customer info
  if (currentUser) {
    displayEl.textContent = `${currentUser.email}`;
  }

  // Handle exit button
  exitBtn.addEventListener('click', () => {
    clearImpersonation();
    window.location.reload();
  });
}
```

**Step 4: Call initImpersonationBanner in init() function**

In the `init()` function, add this call after getting current user:

```javascript
async function init() {
  // Get current user
  const { user, error: userError } = await getCurrentUser();
  // ... existing error handling ...

  currentUser = user;

  // Initialize impersonation banner if active
  await initImpersonationBanner();

  // Check if user is admin
  isAdminUser = await isAdmin(user.id);
  // ... rest of existing code ...
}
```

**Step 5: Commit impersonation banner**

```bash
git add portal.html src/views/portal.js
git commit -m "feat(portal): add impersonation warning banner

Add prominent yellow banner that appears when admin is viewing
portal as a customer. Prevents confusion about whose data is shown.

- Banner shows impersonated customer email
- Exit button clears impersonation and reloads
- Only visible when sessionStorage has impersonatedCustomerId

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Update Portal Dashboard to Use Effective User

**Files:**
- Modify: `src/views/portal.js`

**Step 1: Import getEffectiveUser**

At the top of `src/views/portal.js`, update the import from auth.js:

```javascript
import {
  requireAuth,
  getCurrentUser,
  getEffectiveUser,  // ADD THIS
  getUserBoats,
  logout,
  isAdmin,
} from "../auth/auth.js";
```

**Step 2: Replace getCurrentUser with getEffectiveUser in init()**

In the `init()` function, change this line:

```javascript
// OLD:
const { user, error: userError } = await getCurrentUser();

// NEW:
const { user, error: userError, isImpersonated } = await getEffectiveUser();
```

**Step 3: Commit portal.js effective user update**

```bash
git add src/views/portal.js
git commit -m "feat(portal): use effective user for data queries

Update portal dashboard to use getEffectiveUser() instead of
getCurrentUser(). Now shows impersonated customer's data when
admin is in impersonation mode.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Update Service History Page to Use Effective User

**Files:**
- Modify: `src/views/service-history.js`

**Step 1: Import getEffectiveUser**

At the top of `src/views/service-history.js`, update the import:

```javascript
import {
  requireAuth,
  getCurrentUser,
  getEffectiveUser,  // ADD THIS
  getUserBoats,
  logout,
} from "../auth/auth.js";
```

**Step 2: Replace getCurrentUser with getEffectiveUser**

Find this line (around line 29):

```javascript
// OLD:
const { user, error: userError } = await getCurrentUser();

// NEW:
const { user, error: userError } = await getEffectiveUser();
```

**Step 3: Commit service history update**

```bash
git add src/views/service-history.js
git commit -m "feat(service-history): use effective user for queries

Update service history page to show impersonated customer's
service logs when admin is in impersonation mode.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Update Remaining Portal Pages to Use Effective User

**Files:**
- Modify: `src/views/invoices.js`
- Modify: `src/views/messages.js`
- Modify: `src/views/request-service.js`
- Modify: `src/views/request-history.js`
- Modify: `src/views/account-settings.js`

**Step 1: Update invoices.js**

Import and use getEffectiveUser:

```javascript
// Add to imports
import { getEffectiveUser } from "../auth/auth.js";

// Replace getCurrentUser() call
const { user, error: userError } = await getEffectiveUser();
```

**Step 2: Update messages.js**

Same pattern as invoices.js - import and replace getCurrentUser() call.

**Step 3: Update request-service.js**

Same pattern - import and replace getCurrentUser() call.

**Step 4: Update request-history.js**

Same pattern - import and replace getCurrentUser() call.

**Step 5: Update account-settings.js**

Same pattern - import and replace getCurrentUser() call.

**Step 6: Commit all portal page updates**

```bash
git add src/views/invoices.js src/views/messages.js src/views/request-service.js src/views/request-history.js src/views/account-settings.js
git commit -m "feat(portal): use effective user across all portal pages

Update all remaining portal pages (invoices, messages, requests,
account) to use getEffectiveUser() for data queries.

Now all portal pages respect impersonation mode and show correct
customer data when admin is viewing as another customer.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Add Impersonation Components to All Portal HTML Pages

**Files:**
- Modify: `portal-services.html`
- Modify: `portal-invoices.html`
- Modify: `portal-messages.html`
- Modify: `portal-request-service.html`
- Modify: `portal-request-history.html`
- Modify: `portal-account.html`

**Step 1: Add customer selector and banner to portal-services.html**

Copy the customer selector, banner HTML, and CSS from `portal.html` to `portal-services.html`:

1. Add customer selector in header (same location as portal.html)
2. Add impersonation banner after header (same location as portal.html)
3. Add customer selector CSS (same styles as portal.html)
4. Add impersonation banner CSS (same styles as portal.html)

**Step 2: Add initialization to service-history.js**

Copy `initCustomerSelector()` and `initImpersonationBanner()` functions from `portal.js` to `src/views/service-history.js`.

Call both functions in the initialization section:

```javascript
async function init() {
  // Set user email
  userEmailEl.textContent = user.email;

  // Initialize impersonation banner if active
  await initImpersonationBanner();

  // Initialize customer selector for admins
  const isAdminUser = await isAdmin(user.id);
  if (isAdminUser) {
    await initCustomerSelector();
  }

  // Setup event listeners
  setupEventListeners();
  // ... rest of existing code
}
```

**Step 3: Repeat for all other portal pages**

Copy the same HTML, CSS, and JavaScript initialization to:
- `portal-invoices.html` / `src/views/invoices.js`
- `portal-messages.html` / `src/views/messages.js`
- `portal-request-service.html` / `src/views/request-service.js`
- `portal-request-history.html` / `src/views/request-history.js`
- `portal-account.html` / `src/views/account-settings.js`

**Step 4: Commit all portal page UI updates**

```bash
git add portal-services.html portal-invoices.html portal-messages.html portal-request-service.html portal-request-history.html portal-account.html
git add src/views/service-history.js src/views/invoices.js src/views/messages.js src/views/request-service.js src/views/request-history.js src/views/account-settings.js
git commit -m "feat(portal): add impersonation UI to all portal pages

Add customer selector and impersonation banner to all portal pages:
- Service History
- Invoices
- Messages
- Request Service
- Request History
- Account Settings

Admin can now switch customers from any page, and impersonation
banner appears consistently across the entire portal.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Manual Testing Verification

**Files:**
- None (testing only)

**Step 1: Test admin login and customer selector visibility**

1. Run dev server: `npm run dev`
2. Login as admin user (standardhuman@gmail.com / KLRss!650)
3. Verify customer selector appears in header
4. Verify "View as:" label and search input are visible

**Step 2: Test customer selection and impersonation**

1. Type in customer search box
2. Select a customer from filtered list
3. Verify page reloads
4. Verify impersonation banner appears with customer email
5. Verify dashboard shows selected customer's data (boats, services, etc.)

**Step 3: Test navigation while impersonating**

1. Click "Service History" link
2. Verify impersonation banner still appears
3. Verify service history shows impersonated customer's services
4. Navigate to "Invoices" - verify correct customer data
5. Navigate to "Messages" - verify correct customer data

**Step 4: Test exit customer view**

1. Click "Exit Customer View" button in banner
2. Verify page reloads
3. Verify banner disappears
4. Verify dashboard shows admin's own data
5. Verify customer selector still visible (admin mode)

**Step 5: Test security - non-admin cannot impersonate**

1. Logout from admin account
2. Login as regular customer account
3. Verify customer selector does NOT appear
4. Open browser console
5. Run: `sessionStorage.setItem('impersonatedCustomerId', 'some-uuid')`
6. Reload page
7. Verify impersonation is cleared and customer sees their own data

**Step 6: Test multiple boat customers**

1. Login as admin
2. Select a customer with 2+ boats
3. Verify boat selector appears (existing functionality)
4. Verify can switch between customer's boats
5. Verify service history filters correctly per boat

**Step 7: Document any bugs found**

If any issues found during testing:
- Document in GitHub issue
- Fix before considering task complete
- Re-run all tests after fixes

**Step 8: Commit any test fixes**

```bash
# If fixes needed
git add [files]
git commit -m "fix(impersonation): [description of fix]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Build and Deploy Verification

**Files:**
- None (verification only)

**Step 1: Run production build**

```bash
npm run build
```

Expected: Build succeeds with no errors

**Step 2: Preview production build**

```bash
npm run preview
```

Expected: Preview server starts, manually verify impersonation works in preview mode

**Step 3: Push to GitHub**

```bash
git push origin feature/admin-customer-impersonation
```

**Step 4: Merge to main (if all tests pass)**

Option A: Create pull request on GitHub for review

Option B: Merge locally:
```bash
git checkout main
git merge feature/admin-customer-impersonation
git push origin main
```

**Step 5: Verify Vercel deployment**

1. Wait for Vercel deployment to complete
2. Visit https://portal.sailorskills.com
3. Test impersonation on production
4. Verify no console errors

---

## Success Criteria

Feature is complete when:
- ✅ Admin can search and select customers from header
- ✅ Impersonation banner appears after selection
- ✅ Dashboard shows impersonated customer's data
- ✅ Navigation maintains impersonation context
- ✅ Exit button clears impersonation and returns to admin view
- ✅ Non-admin users cannot access impersonation
- ✅ Customer selector appears on all portal pages
- ✅ Production build succeeds
- ✅ Deployed to production without errors

---

## Notes for Implementation

**DRY Principle:**
- Customer selector and banner HTML/CSS repeated across pages (acceptable for now)
- Future refactor: Create shared component in `src/components/admin-impersonation.js`

**YAGNI Principle:**
- No audit logging (not needed for initial release)
- No "recent customers" list (add if users request it)
- No localStorage persistence (session storage sufficient)

**TDD Considerations:**
- Manual testing sufficient for UI-heavy feature
- Consider adding Playwright tests in future for critical paths

**Database Queries:**
- No RLS policy changes needed
- Existing security model handles impersonation naturally
- getAllCustomers() properly verifies admin status
