# Portal UI/UX Improvements - Implementation Handoff
**Date:** 2025-11-08
**Status:** Ready for Implementation
**Priority:** Medium
**Estimated Time:** 4-6 hours

---

## Overview

This handoff covers 6 interconnected improvements to the Portal dashboard and service history to better communicate maintenance urgency, standardize condition displays, and improve admin navigation.

---

## Context

**Current State:**
- Paint condition slider shows condition but doesn't clearly communicate when to haul out
- Condition displays are inconsistent (dashboard shows cards, service history shows inline badges, anodes show percentages)
- Admin navigation has boat selector in content area + yellow banner + header selector (cluttered)
- Messaging feature is visible but not yet functional

**Desired State:**
- Paint slider emphasizes urgency and action items
- All condition displays use identical card styling with color-coded badges
- Anodes show condition labels (Excellent/Good/Fair/Poor) instead of percentages
- Admin navigation consolidated in header with searchable selectors
- Messaging hidden until ready for launch

---

## Design Decisions

Based on user preferences:
1. **Paint Slider:** Show urgency levels with action items (not just status)
2. **Growth Level:** Simple status display only (no urgency/actions)
3. **Anode Replacements:** Show "REPLACED" or "NEW" badge
4. **Admin Navigation:** Keep immediate switch behavior (no confirmation)

---

## Implementation Plan

### Task 3: Anode Percentage to Condition Conversion ⭐ START HERE

**Priority:** Implement first (affects both dashboard and service history)

**File:** `/sailorskills-portal/src/api/boat-data.js`

**Add conversion function:**
```javascript
/**
 * Convert anode percentage to condition label
 * @param {number} percent - Anode condition percentage
 * @returns {string} Condition label (excellent, good, fair, poor)
 */
export function convertAnodePercentToCondition(percent) {
  if (percent >= 90) return 'excellent';
  if (percent >= 80) return 'good';
  if (percent >= 60) return 'fair';
  return 'poor';
}

/**
 * Check if anode was recently replaced
 * @param {string} checkedDate - ISO date string
 * @param {string} serviceDate - ISO date string
 * @returns {boolean} True if replaced within 30 days of service
 */
export function isAnodeReplaced(checkedDate, serviceDate) {
  if (!checkedDate || !serviceDate) return false;

  const checked = new Date(checkedDate);
  const service = new Date(serviceDate);
  const daysDiff = Math.abs((checked - service) / (1000 * 60 * 60 * 24));

  return daysDiff <= 30;
}
```

**Update `createAnodesSection()` in `/sailorskills-portal/src/views/portal.js` (lines 890-922):**

Replace:
```javascript
const condition = anode.condition_percent !== undefined
  ? `${anode.condition_percent}%`
  : anode.condition || anode.overall_condition || "N/A";

return anode.condition_percent !== undefined
  ? `<div style="font-size: 24px; font-weight: 700; color: var(--ss-text-dark);">${condition}</div>`
  : `<span class="condition-badge ${getConditionClass(conditionClass)}">${condition}</span>`;
```

With:
```javascript
// Convert percentage to condition label
let condition;
let isReplaced = false;

if (anode.condition_percent !== undefined) {
  condition = convertAnodePercentToCondition(anode.condition_percent);
  isReplaced = isAnodeReplaced(anode.checked_date, log.service_date);
} else {
  condition = anode.condition || anode.overall_condition || "N/A";
}

// Build badge HTML
const badgeHtml = `<span class="condition-badge ${getConditionClass(condition)}">${escapeHtml(condition.charAt(0).toUpperCase() + condition.slice(1))}</span>`;

// Add REPLACED badge if applicable
const replacedBadge = isReplaced
  ? `<span class="condition-badge" style="background: #d1fae5; color: #065f46; margin-left: 8px;">✓ REPLACED</span>`
  : '';

return `
  <div class="condition-item-card" style="background: #fafbfc;">
    <div class="condition-item-label">${escapeHtml(locationText)}</div>
    ${badgeHtml}${replacedBadge}
  </div>
`;
```

**Also update in `/sailorskills-portal/src/views/service-history.js` (lines 538-607)** - apply same logic

**Import statement needed:**
```javascript
import { convertAnodePercentToCondition, isAnodeReplaced } from "../api/boat-data.js";
```

---

### Task 2: Standardize Condition Display Styling

**Goal:** Make all condition boxes use identical card layout

**Files to modify:**
- `/sailorskills-portal/src/views/portal.js`
- `/sailorskills-portal/src/views/service-history.js`

**Current inconsistency:**
- Dashboard: Uses card grid with `.condition-item-card`
- Service History: Uses inline badges in timeline header

**Changes needed:**

1. **Ensure all condition sections use consistent grid:**
```javascript
<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
  <!-- condition cards -->
</div>
```

2. **All condition cards use same structure:**
```javascript
<div class="condition-item-card">
  <div class="condition-item-label">[Label]</div>
  <span class="condition-badge [class]">[Value]</span>
</div>
```

3. **In service-history.js, remove inline badge row from timeline header** (lines 440-460):

Remove or hide:
```html
<div class="condition-badges-row">
  <!-- inline badges -->
</div>
```

Keep badges only in expanded details section, using card layout.

---

### Task 1: Paint Condition Slider - Urgency Messages

**Goal:** Make message below slider emphasize action items

**File:** `/sailorskills-portal/src/api/boat-data.js`

**Update `getPaintStatus()` function (lines 334-364):**

Replace current messages with action-oriented ones:

```javascript
export function getPaintStatus(paintCondition, daysSinceService) {
  // Normalize condition to severity score (0 = best, 8 = worst)
  const severityMap = {
    'excellent': 0,
    'excellent-good': 1,
    'good': 2,
    'good-fair': 3,
    'fair': 4,
    'fair-poor': 5,
    'poor': 6,
    'very-poor': 7,
    'not-inspected': 8,
  };

  const severity = severityMap[paintCondition.toLowerCase()] ?? 4;

  // Urgency based on condition + time
  if (severity <= 1 && daysSinceService < 180) {
    return {
      isDue: false,
      status: 'good',
      message: '✓ No action needed - Paint in excellent condition',
      urgency: 'low'
    };
  }

  if (severity <= 2 && daysSinceService < 365) {
    return {
      isDue: false,
      status: 'good',
      message: '✓ Monitor condition - Check again in 3-6 months',
      urgency: 'low'
    };
  }

  if (severity <= 4 || daysSinceService >= 365) {
    return {
      isDue: true,
      status: 'due-soon',
      message: '⚠️ Plan haul-out - Repainting recommended within 6 months',
      urgency: 'medium'
    };
  }

  // Poor or very poor condition
  return {
    isDue: true,
    status: 'past-due',
    message: '🔴 Schedule haul-out now - Paint requires immediate attention',
    urgency: 'high'
  };
}
```

**Update CSS for message styling in `/sailorskills-portal/portal.html` (lines 310-335):**

Make message text larger and bolder:

```css
.paint-status-message {
  margin-top: var(--ss-space-md);
  padding: var(--ss-space-md);  /* Increased from sm */
  border-radius: var(--ss-radius-none);
  font-size: var(--ss-text-md);  /* Increased from sm */
  font-weight: 600;  /* Increased from 500 */
  border-left: 4px solid;
}
```

---

### Task 4: Apply Styling to Service History

**File:** `/sailorskills-portal/src/views/service-history.js`

**Ensure consistency with dashboard:**

1. Import shared helper functions from portal.js (if not already available, add to boat-data.js)
2. Use identical `createConditionsSection()` logic
3. Use identical `createAnodesSection()` logic (with new percentage conversion)
4. Use identical `createPropellersSection()` logic

**Key changes:**
- Replace inline badges with card grid
- Use same CSS classes
- Same structure: `.condition-item-card` > `.condition-item-label` + `.condition-badge`

---

### Task 5: Improve Admin Navigation

**Goal:** Move selectors to header, make boat selector searchable, remove yellow banner

**Files to modify:**
- `/sailorskills-portal/portal.html` (and all other portal-*.html pages)
- `/sailorskills-portal/src/views/portal.js` (and corresponding JS files)

**Step 1: Update HTML structure in all portal pages**

**Remove from content area (lines 830-835):**
```html
<!-- DELETE THIS -->
<div class="boat-selector" id="boat-selector" style="display: none;">
  <label for="current-boat">Select Boat:</label>
  <select id="current-boat">
    <option value="">Loading boats...</option>
  </select>
</div>
```

**Remove yellow banner (lines 792-812):**
```html
<!-- DELETE THIS -->
<div class="impersonation-banner" id="impersonation-banner" style="display: none;">
  ...
</div>
```

**Update header structure (lines 768-789):**

Replace entire header with:
```html
<header class="portal-header">
  <div class="header-left">
    <h1>⚓ Sailor Skills</h1>
  </div>

  <!-- Admin Selectors (shown only for admin users) -->
  <div class="admin-selectors" id="admin-selectors" style="display: none;">
    <!-- Customer Selector -->
    <div class="admin-selector-group">
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

    <!-- Boat Selector (NEW - searchable) -->
    <div class="admin-selector-group">
      <label for="boat-search">Select Boat:</label>
      <input
        type="text"
        id="boat-search"
        placeholder="Search boats..."
        autocomplete="off"
        list="boat-datalist"
      />
      <datalist id="boat-datalist"></datalist>
    </div>
  </div>
  <!-- End Admin Selectors -->

  <div class="header-right">
    <span class="user-email" id="user-email">Loading...</span>
    <button class="btn btn-secondary" id="logout-btn">Sign Out</button>
  </div>
</header>
```

**Add CSS for new admin selectors (after line 667):**
```css
.admin-selectors {
  display: flex;
  gap: var(--ss-space-lg);
  align-items: center;
}

.admin-selector-group {
  display: flex;
  align-items: center;
  gap: var(--ss-space-xs);
}

.admin-selector-group label {
  font-size: var(--ss-text-sm);
  font-weight: 600;
  color: var(--ss-text-medium);
  white-space: nowrap;
}

.admin-selector-group input {
  width: 250px;
  padding: var(--ss-space-xs) var(--ss-space-sm);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-none);
  font-size: var(--ss-text-sm);
  font-family: var(--ss-font-primary);
}

.admin-selector-group input:focus {
  outline: none;
  border-color: var(--ss-primary);
}
```

**Step 2: Update JavaScript in portal.js**

**Replace `initCustomerSelector()` and boat selector logic (lines 121-169, 230-289):**

```javascript
/**
 * Initialize admin selectors (customer and boat)
 */
async function initAdminSelectors() {
  if (!isAdminUser) return;

  const selectorsEl = document.getElementById('admin-selectors');
  selectorsEl.style.display = 'flex';

  // Initialize customer selector
  const customerSearch = document.getElementById('customer-search');
  const customerDatalist = document.getElementById('customer-datalist');

  const { customers, error } = await getAllCustomers();
  if (error) {
    console.error('Failed to load customers:', error);
  } else {
    customers.forEach((customer) => {
      const option = document.createElement('option');
      option.value = customer.displayText;
      option.dataset.customerId = customer.id;
      customerDatalist.appendChild(option);
    });

    customerSearch.addEventListener('change', async (e) => {
      const selectedText = e.target.value;
      const selectedOption = Array.from(customerDatalist.options).find(
        (opt) => opt.value === selectedText
      );

      if (selectedOption) {
        const customerId = selectedOption.dataset.customerId;
        const { success } = await setImpersonation(customerId);
        if (success) window.location.reload();
      }
    });
  }

  // Initialize boat selector
  const boatSearch = document.getElementById('boat-search');
  const boatDatalist = document.getElementById('boat-datalist');

  if (userBoats.length > 0) {
    userBoats.forEach((boat) => {
      const option = document.createElement('option');
      option.value = boat.name + (boat.isPrimary ? ' (Primary)' : '');
      option.dataset.boatId = boat.id;
      boatDatalist.appendChild(option);
    });

    // Set initial value
    if (selectedBoatId) {
      const selectedBoat = userBoats.find((b) => b.id === selectedBoatId);
      if (selectedBoat) {
        boatSearch.value = selectedBoat.name + (selectedBoat.isPrimary ? ' (Primary)' : '');
      }
    }

    boatSearch.addEventListener('change', async (e) => {
      const selectedText = e.target.value;
      const selectedOption = Array.from(boatDatalist.options).find(
        (opt) => opt.value === selectedText
      );

      if (selectedOption) {
        selectedBoatId = selectedOption.dataset.boatId;
        localStorage.setItem('currentBoatId', selectedBoatId);
        await loadBoatData();
      }
    });
  }
}
```

**Update init() function:**

Replace calls to `initCustomerSelector()` and `initImpersonationBanner()` with single call to `initAdminSelectors()`.

**Remove:**
```javascript
await initImpersonationBanner();
// ...
await initCustomerSelector();
```

**Add:**
```javascript
await initAdminSelectors();
```

---

### Task 6: Hide Messaging References

**Goal:** Remove messaging UI elements until feature is ready

**Files to modify:**
- All portal-*.html files

**Changes:**

1. **Remove "Messages" from navigation** (in all portal pages):

Delete or comment out:
```html
<a href="/portal-messages.html" class="nav-link">
  Messages
  <span class="nav-badge" id="unread-badge" style="display: none;">0</span>
</a>
```

2. **Remove "Unread Messages" stat card from portal.html (lines 887-889):**

Delete:
```html
<div class="stat-card">
  <h4>Unread Messages</h4>
  <p class="stat-value">0</p>
</div>
```

3. **Update features list in portal.html (line 903):**

Remove or comment out:
```html
<li><strong>Messages:</strong> Communicate directly with the Sailor Skills team</li>
```

---

## Testing Checklist

After implementation, test:

**Paint Condition:**
- [ ] Slider shows correct urgency message for each condition level
- [ ] Message uses correct icon (✓, ⚠️, 🔴)
- [ ] Message text is bold and prominent
- [ ] All urgency levels display correctly (good, monitor, due soon, urgent)

**Condition Displays:**
- [ ] All condition boxes use identical card styling
- [ ] Paint, growth, through-hulls, propellers, anodes all match
- [ ] Color-coded badges show correct colors for each condition
- [ ] Dashboard and service history use same styling

**Anodes:**
- [ ] Percentages converted to condition labels (Excellent/Good/Fair/Poor)
- [ ] "REPLACED" badge appears for recently replaced anodes
- [ ] Conversion thresholds work correctly (90%, 80%, 60%)
- [ ] Display matches on dashboard and service history

**Admin Navigation:**
- [ ] Both selectors appear in header when logged in as admin
- [ ] Customer selector is searchable (type to filter)
- [ ] Boat selector is searchable (type to filter)
- [ ] Selecting customer immediately switches view
- [ ] Selecting boat immediately loads that boat's data
- [ ] No yellow banner appears
- [ ] Selectors persist across all portal pages

**Messaging:**
- [ ] "Messages" link removed from navigation
- [ ] "Unread Messages" stat card removed from dashboard
- [ ] No references to messaging in features list
- [ ] Direct access to /portal-messages.html still works (for future launch)

---

## Files Modified Summary

**Core Files:**
1. `/sailorskills-portal/portal.html` - Dashboard HTML
2. `/sailorskills-portal/src/views/portal.js` - Dashboard logic
3. `/sailorskills-portal/portal-services.html` - Service history HTML
4. `/sailorskills-portal/src/views/service-history.js` - Service history logic
5. `/sailorskills-portal/src/api/boat-data.js` - Anode conversion, paint status

**Additional Portal Pages (for Task 5 & 6):**
6. `/sailorskills-portal/portal-invoices.html`
7. `/sailorskills-portal/portal-account.html`
8. `/sailorskills-portal/portal-request-service.html`
9. `/sailorskills-portal/portal-payment-setup.html`

---

## Deployment Notes

**No database changes required** - all changes are frontend/display logic

**No breaking changes** - anodes still store percentage in database, we just convert for display

**Backwards compatible** - existing data will display correctly with new logic

**Testing:** Use Playwright to verify all flows work correctly after deployment

---

## Next Steps

1. Implement tasks in order (3 → 2 → 1 → 4 → 5 → 6)
2. Test each task before moving to next
3. Commit after each completed task
4. Deploy to production after all tasks complete and tested
5. Monitor for any issues in first 24 hours

---

**Estimated Timeline:**
- Task 3: 1 hour
- Task 2: 1 hour
- Task 1: 30 minutes
- Task 4: 1 hour
- Task 5: 2 hours (most complex - multiple pages)
- Task 6: 30 minutes

**Total: 6 hours**

---

**Questions or Issues?**
Refer to the research document for detailed current implementation details and file locations.
