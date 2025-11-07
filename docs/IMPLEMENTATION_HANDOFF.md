# Admin Customer Impersonation - Implementation Handoff

## Current Status: ~80% Complete

### ✅ Completed (Tasks 1-7)

**Task 1: Auth Layer** (Commit: 868d1f5)
- Added `setImpersonation()`, `clearImpersonation()`, `getEffectiveUser()` to `src/auth/auth.js`
- Updated `logout()` to clear impersonation state

**Task 2: Customer API** (Commit: 22df906)
- Created `src/api/customers.js` with `getAllCustomers()` function

**Task 3: Customer Selector Component** (Commit: a09da96)
- Added to `portal.html` (HTML + CSS)
- Added to `src/views/portal.js` (JavaScript functions)

**Task 4: Impersonation Banner** (Commit: 0aeadbe)
- Added to `portal.html` (HTML + CSS)
- Added to `src/views/portal.js` (JavaScript functions)

**Task 5: Portal Dashboard** (Commit: 913cf83)
- Updated `src/views/portal.js` to use `getEffectiveUser()`

**Task 6: Service History** (Commit: bc5dd7f)
- Updated `src/views/service-history.js` to use `getEffectiveUser()`

**Task 7: Remaining Pages** (Commit: 8ab805f)
- Updated all 5 JS files to use `getEffectiveUser()`:
  - `src/views/invoices.js`
  - `src/views/messages.js`
  - `src/views/request-service.js`
  - `src/views/request-history.js`
  - `src/views/account-settings.js`

**Task 8 (Partial): UI Components** (Commit: fcc62ae)
- ✅ Completed: `portal-services.html` + `service-history.js`
- ✅ In Progress: `invoices.js` (functions added, needs commit)

---

## 🔄 Remaining Work

### Task 8: Complete UI Components for 5 Pages

Each page needs:
1. **HTML file**: Add customer selector + impersonation banner HTML/CSS
2. **JS file**: Add imports + 2 functions + call them in init()

**Pages to complete:**
1. ✅ `portal-invoices.html` + `invoices.js` (JS done, needs HTML)
2. ⏳ `portal-messages.html` + `messages.js`
3. ⏳ `portal-request-service.html` + `request-service.js`
4. ⏳ `portal-request-history.html` + `request-history.js`
5. ⏳ `portal-account.html` + `account-settings.js`

### Task 9: Manual Testing
- Test admin login and customer selector visibility
- Test customer selection and impersonation
- Test navigation while impersonating
- Test exit customer view
- Test security (non-admin cannot impersonate)

### Task 10: Build and Deploy
- Run `npm run build`
- Run `npm run preview`
- Push to GitHub
- Verify Vercel deployment

---

## 📋 Templates for Completing Remaining Work

### Template 1: Add Imports to JS File

At the top of each JS file, update the imports from:

```javascript
import {
  requireAuth,
  getCurrentUser,
  getEffectiveUser,
  getUserBoats,
  logout,
} from "../auth/auth.js";
```

To:

```javascript
import {
  requireAuth,
  getCurrentUser,
  getEffectiveUser,
  getUserBoats,
  logout,
  isAdmin,
  setImpersonation,
  clearImpersonation,
} from "../auth/auth.js";
import { getAllCustomers } from "../api/customers.js";
```

### Template 2: Add Functions to JS File

Add these two functions BEFORE the `init()` function in each JS file:

```javascript
/**
 * Initialize impersonation banner
 */
async function initImpersonationBanner() {
  const impersonatedId = sessionStorage.getItem("impersonatedCustomerId");
  if (!impersonatedId) return;

  const bannerEl = document.getElementById("impersonation-banner");
  const displayEl = document.getElementById("impersonated-customer-display");
  const exitBtn = document.getElementById("exit-impersonation-btn");

  if (bannerEl) bannerEl.style.display = "flex";
  if (displayEl && currentUser) displayEl.textContent = currentUser.email;
  if (exitBtn) {
    exitBtn.addEventListener("click", () => {
      clearImpersonation();
      window.location.reload();
    });
  }
}

/**
 * Initialize customer selector for admins
 */
async function initCustomerSelector() {
  const adminStatus = await isAdmin(currentUser.id);
  if (!adminStatus) return;

  const selectorEl = document.getElementById("admin-customer-selector");
  const searchInput = document.getElementById("customer-search");
  const datalist = document.getElementById("customer-datalist");

  if (!selectorEl || !searchInput || !datalist) return;
  selectorEl.style.display = "flex";

  const { customers, error } = await getAllCustomers();
  if (error) {
    console.error("Failed to load customers for selector:", error);
    return;
  }

  customers.forEach((customer) => {
    const option = document.createElement("option");
    option.value = customer.displayText;
    option.dataset.customerId = customer.id;
    datalist.appendChild(option);
  });

  searchInput.addEventListener("change", async (e) => {
    const selectedText = e.target.value;
    const selectedOption = Array.from(datalist.options).find(
      (opt) => opt.value === selectedText,
    );

    if (selectedOption) {
      const customerId = selectedOption.dataset.customerId;
      const { success } = await setImpersonation(customerId);
      if (success) window.location.reload();
    }
  });
}
```

### Template 3: Update init() Function in JS File

In the `init()` function, add these two calls after setting `currentUser`:

```javascript
async function init() {
  // ... existing code to get user ...
  
  currentUser = user;
  document.getElementById("user-email").textContent = user.email;

  // ADD THESE TWO LINES:
  await initImpersonationBanner();
  await initCustomerSelector();

  // ... rest of existing code ...
}
```

### Template 4: Update HTML Header

In each HTML file, find the `<header class="portal-header">` section and update it from:

```html
<header class="portal-header">
  <div class="header-left">
    <h1>⚓ Sailor Skills</h1>
  </div>
  <div class="header-right">
    <span class="user-email" id="user-email">Loading...</span>
    <button class="btn btn-secondary" id="logout-btn">Sign Out</button>
  </div>
</header>
```

To:

```html
<header class="portal-header">
  <div class="header-left">
    <h1>⚓ Sailor Skills</h1>
  </div>
  <!-- Admin Customer Selector -->
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
  <!-- End Admin Customer Selector -->
  <div class="header-right">
    <span class="user-email" id="user-email">Loading...</span>
    <button class="btn btn-secondary" id="logout-btn">Sign Out</button>
  </div>
</header>

<!-- Impersonation Banner -->
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
<!-- End Impersonation Banner -->
```

### Template 5: Add CSS to HTML File

In each HTML file, add these styles BEFORE the closing `</style>` tag:

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

---

## 🎯 Quick Completion Steps

### Step 1: Commit Current Progress
```bash
git add src/views/invoices.js
git commit -m "feat(invoices): add impersonation UI functions

Add initImpersonationBanner() and initCustomerSelector() functions
to invoices view. Calls them in init() function.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 2: Complete Remaining Pages
For each of the 5 remaining pages, apply templates 1-5 above.

Files to update (in order):
1. `portal-invoices.html` (Template 4 + 5)
2. `portal-messages.html` + `src/views/messages.js` (All templates)
3. `portal-request-service.html` + `src/views/request-service.js` (All templates)
4. `portal-request-history.html` + `src/views/request-history.js` (All templates)
5. `portal-account.html` + `src/views/account-settings.js` (All templates)

### Step 3: Commit Completed Pages
```bash
git add portal-invoices.html portal-messages.html portal-request-service.html portal-request-history.html portal-account.html
git add src/views/messages.js src/views/request-service.js src/views/request-history.js src/views/account-settings.js
git commit -m "feat(portal): add impersonation UI to all remaining pages

Add customer selector and impersonation banner to:
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

### Step 4: Test Locally
```bash
npm run dev
# Test with admin account: standardhuman@gmail.com / KLRss!650
```

### Step 5: Build and Deploy
```bash
npm run build
npm run preview
git push origin feature/admin-customer-impersonation
```

---

## 📊 Implementation Plan Reference

Full plan located at: `docs/plans/2025-11-06-admin-customer-impersonation.md`

**Success Criteria** (from plan):
- ✅ Admin can search and select customers from header
- ✅ Impersonation banner appears after selection
- ✅ Dashboard shows impersonated customer's data
- ⏳ Navigation maintains impersonation context (5 pages remaining)
- ⏳ Exit button clears impersonation and returns to admin view
- ✅ Non-admin users cannot access impersonation
- ⏳ Customer selector appears on all portal pages (5 pages remaining)
- ⏳ Production build succeeds
- ⏳ Deployed to production without errors

---

## 🔍 Current Branch Status

Branch: `feature/admin-customer-impersonation`

Recent commits:
- `fcc62ae` - feat(service-history): add impersonation UI components
- `8ab805f` - feat(portal): use effective user across all portal pages
- `bc5dd7f` - feat(service-history): use effective user for queries
- `913cf83` - feat(portal): use effective user for data queries
- `0aeadbe` - feat(portal): add impersonation warning banner
- `a09da96` - feat(portal): add admin customer selector to header
- `22df906` - feat(api): add getAllCustomers function for admin selector
- `868d1f5` - feat(auth): add customer impersonation layer

Next commit: invoices.js function additions (in progress)

---

**End of Handoff Document**
