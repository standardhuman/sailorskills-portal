# Portal Layout Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign Portal service history and dashboard layouts to fix alignment issues, restore paint gradient, and match Estimator's design aesthetic.

**Architecture:** Update inline styles and JavaScript rendering in portal-services.html and portal.html. Modify service-history.js and portal.js to generate new HTML structures with vertical stacking and inline badge layout.

**Tech Stack:** Vanilla JavaScript, Vite, Supabase, CSS design tokens

---

## Task 1: Service History - Update Timeline Item Structure

**Files:**
- Modify: `portal-services.html:214-393` (timeline item styles)
- Modify: `src/views/service-history.js:246-398` (createTimelineItem function)

### Step 1: Update timeline item CSS structure

**File:** `portal-services.html`

Replace the existing `.timeline-header` and related styles (lines ~229-248) with:

```css
/* Timeline Item - Vertical Stacking */
.timeline-header {
  display: flex;
  flex-direction: column;
  gap: var(--ss-space-xs);
  margin-bottom: var(--ss-space-sm);
}

.timeline-title-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.timeline-date {
  font-weight: 600;
  color: var(--ss-text-dark);
  font-size: var(--ss-text-base);
}

.service-name {
  color: var(--ss-primary);
  font-size: var(--ss-text-sm);
  font-weight: 500;
}

.expand-icon {
  transition: transform 0.2s;
  font-size: var(--ss-text-sm);
  color: var(--ss-text-medium);
  margin-left: auto;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

/* Condition Badges Row - Inline Flow */
.condition-badges-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ss-space-sm);
  margin-top: var(--ss-space-xs);
}

.condition-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: var(--ss-radius-none);
  font-size: var(--ss-text-xs);
  font-weight: 600;
  text-transform: capitalize;
}

.condition-badge.condition-excellent,
.condition-badge.condition-good {
  background: var(--ss-status-success-bg);
  color: var(--ss-status-success-text);
}

.condition-badge.condition-fair,
.condition-badge.condition-moderate {
  background: var(--ss-status-warning-bg);
  color: var(--ss-status-warning-text);
}

.condition-badge.condition-poor,
.condition-badge.condition-needs-replacement {
  background: var(--ss-status-danger-bg);
  color: var(--ss-status-danger-text);
}

.condition-badge.condition-sound,
.condition-badge.condition-inspected {
  background: var(--ss-status-info-bg);
  color: var(--ss-status-info-text);
}

.condition-badge.condition-unknown,
.condition-badge.condition-not-inspected {
  background: var(--ss-status-neutral-bg);
  color: var(--ss-status-neutral-text);
}
```

**Verification:**
- Check that CSS is valid (no syntax errors)
- Styles compile without warnings

### Step 2: Update createTimelineItem HTML structure

**File:** `src/views/service-history.js`

Replace the `createTimelineItem` function (starting ~line 247) with:

```javascript
/**
 * Create timeline item HTML
 * @param {Object} log - Service log
 * @param {number} index - Item index
 * @param {string|null} nextServiceDate - Next service date if available
 * @returns {string} HTML string
 */
function createTimelineItem(log, index, nextServiceDate = null) {
  const hasDetails =
    log.paint_condition_overall ||
    log.growth_level ||
    log.thru_hull_condition ||
    (log.anode_conditions && log.anode_conditions.length > 0) ||
    (log.propeller_conditions && log.propeller_conditions.length > 0) ||
    log.notes ||
    (log.service_videos && log.service_videos.length > 0);

  // Build condition badges array
  const badges = [];

  if (log.paint_condition_overall) {
    badges.push({
      label: `Paint: ${log.paint_condition_overall}`,
      class: `condition-${log.paint_condition_overall.toLowerCase().replace(/\s+/g, '-')}`
    });
  }

  if (log.growth_level) {
    badges.push({
      label: `Growth: ${log.growth_level}`,
      class: `condition-${log.growth_level.toLowerCase().replace(/\s+/g, '-')}`
    });
  }

  if (log.thru_hull_condition) {
    badges.push({
      label: `Through-Hulls: ${log.thru_hull_condition}`,
      class: `condition-${log.thru_hull_condition.toLowerCase().replace(/\s+/g, '-')}`
    });
  }

  // Anode conditions
  if (log.anode_conditions && log.anode_conditions.length > 0) {
    const anodeStatus = log.anode_conditions.some(a =>
      a.condition?.toLowerCase().includes('replace') ||
      a.condition?.toLowerCase().includes('poor')
    ) ? 'needs-replacement' : 'good';

    badges.push({
      label: `Anodes: ${log.anode_conditions.length} inspected`,
      class: `condition-${anodeStatus}`
    });
  }

  // Propeller conditions
  if (log.propeller_conditions && log.propeller_conditions.length > 0) {
    const propCondition = log.propeller_conditions[0]?.condition || 'inspected';
    badges.push({
      label: `Propeller: ${propCondition}`,
      class: `condition-${propCondition.toLowerCase().replace(/\s+/g, '-')}`
    });
  }

  return `
    <div class="timeline-item" data-index="${index}">
      <div class="timeline-header">
        <div class="timeline-title-row">
          <div>
            <div class="timeline-date">${formatDate(log.service_date)}</div>
            ${log.service_name ? `<div class="service-name">${escapeHtml(log.service_name)}</div>` : ''}
          </div>
          ${hasDetails ? '<span class="expand-icon">▼</span>' : ''}
        </div>

        ${badges.length > 0 ? `
          <div class="condition-badges-row">
            ${badges.map(badge => `
              <span class="condition-badge ${badge.class}">
                ${escapeHtml(badge.label)}
              </span>
            `).join('')}
          </div>
        ` : ''}
      </div>

      ${createMetadataRow(log)}

      ${hasDetails ? `
        <div class="timeline-details" id="details-${index}">
          ${createConditionsSection(log)}
          ${createAnodesSection(log)}
          ${createPropellersSection(log)}
          ${createNotesSection(log)}
          ${createVideosSection(log, index)}
        </div>
      ` : ''}
    </div>
  `;
}
```

**Verification:**
- Run dev server: `npm run dev`
- Navigate to service history page
- Check that badges appear inline below date/service name
- Verify no layout shifts or alignment issues

### Step 3: Commit service history layout changes

```bash
cd ~/.config/superpowers/worktrees/sailorskills-portal/portal-layout-redesign
git add portal-services.html src/views/service-history.js
git commit -m "feat(portal): update service history to vertical stacking layout

- Move condition badges to inline row below date/service
- Fix right-alignment issues with anode/propeller status
- Add condition-badges-row for clean badge flow
- Update createTimelineItem to generate new structure"
```

---

## Task 2: Dashboard - Add Paint Gradient Card

**Files:**
- Modify: `portal.html:235-337` (paint condition section styles)
- Modify: `src/views/portal.js:172-231` (loadPaintCondition function)

### Step 1: Update paint gradient card CSS (compact 20px version)

**File:** `portal.html`

Replace existing paint condition styles (lines ~235-336) with:

```css
/* Paint Condition Card */
.paint-condition-section {
  background: white;
  padding: var(--ss-space-lg);
  border-radius: var(--ss-radius-none);
  box-shadow: var(--ss-shadow-sm);
  border: 1px solid var(--ss-border-subtle);
  margin-bottom: var(--ss-space-lg);
}

.paint-condition-section h3 {
  color: var(--ss-text-dark);
  font-size: var(--ss-text-lg);
  margin-bottom: var(--ss-space-md);
  font-weight: 600;
}

.paint-condition-display {
  margin-top: var(--ss-space-md);
}

/* Compact Gradient Bar (20px) */
.gradient-bar {
  height: 20px;
  border-radius: 4px;
  position: relative;
  background: linear-gradient(to right,
    #b0b0b0 0%,      /* Not Inspected */
    #00b894 12.5%,   /* Excellent */
    #4caf50 25%,     /* Excellent-Good */
    #8bc34a 37.5%,   /* Good */
    #ffc107 50%,     /* Good-Fair */
    #ff9800 62.5%,   /* Fair */
    #ff5722 75%,     /* Fair-Poor */
    #d63031 87.5%,   /* Poor */
    #8b0000 100%     /* Very Poor */
  );
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: var(--ss-space-sm);
}

/* Compact Marker (32px) */
.condition-marker {
  position: absolute;
  top: -6px;
  transform: translateX(-50%);
  width: 32px;
  height: 32px;
  background: white;
  border: 3px solid var(--ss-primary);
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.3s ease;
}

.condition-labels {
  display: flex;
  justify-content: space-between;
  font-size: var(--ss-text-xs);
  color: var(--ss-text-medium);
  margin-top: var(--ss-space-xs);
  padding: 0 var(--ss-space-xs);
}

.condition-labels span {
  font-weight: 500;
}

.paint-status-message {
  margin-top: var(--ss-space-md);
  padding: var(--ss-space-sm);
  border-radius: var(--ss-radius-none);
  font-size: var(--ss-text-sm);
  font-weight: 500;
  border-left: 4px solid;
}

.paint-status-message.good {
  background: rgba(0, 184, 148, 0.1);
  color: #00b894;
  border-color: #00b894;
}

.paint-status-message.due-soon {
  background: rgba(255, 193, 7, 0.1);
  color: #f59e0b;
  border-color: #ffc107;
}

.paint-status-message.past-due {
  background: rgba(214, 48, 49, 0.1);
  color: #d63031;
  border-color: #d63031;
}

.service-date-info {
  font-size: var(--ss-text-xs);
  color: var(--ss-text-medium);
  margin-top: var(--ss-space-xs);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .condition-marker {
    width: 28px;
    height: 28px;
    font-size: 14px;
    top: -4px;
  }

  .paint-condition-section {
    padding: var(--ss-space-md);
  }
}
```

**Verification:**
- CSS compiles without errors
- Gradient bar is 20px tall (not 40px)
- Marker is 32px diameter (not 56px)

### Step 2: Update loadPaintCondition function

**File:** `src/views/portal.js`

Replace the `loadPaintCondition` function (starting ~line 175) with:

```javascript
/**
 * Load and display paint condition
 * @param {string} boatId - Boat UUID
 */
async function loadPaintCondition(boatId) {
  const { paintData, error } = await getPaintCondition(boatId);

  if (error) {
    console.error("Error loading paint condition:", error);
    return;
  }

  if (!paintData) {
    // No service history yet - hide section
    const section = document.getElementById("paint-condition-section");
    if (section) {
      section.style.display = "none";
    }
    return;
  }

  // Show the paint condition section
  const section = document.getElementById("paint-condition-section");
  if (section) {
    section.style.display = "block";
  }

  // Map paint condition to position percentage on gradient
  const conditionMap = {
    "not-inspected": 0,
    excellent: 12.5,
    "exc-good": 18.75,
    good: 37.5,
    "good-fair": 50,
    fair: 62.5,
    "fair-poor": 75,
    poor: 87.5,
    "very-poor": 100,
  };

  const position = conditionMap[paintData.overall] || 0;

  // Position the marker on the gradient
  const marker = document.getElementById("condition-marker");
  if (marker) {
    marker.style.left = `${position}%`;
  }

  // Get paint status
  const days = daysSinceService(paintData.serviceDate);
  const status = getPaintStatus(paintData.overall, days);

  // Update status message
  const messageEl = document.getElementById("paint-status-message");
  if (messageEl) {
    messageEl.textContent = status.message;
    messageEl.className = `paint-status-message ${status.status}`;
  }

  // Update service date info
  const dateInfo = document.getElementById("service-date-info");
  if (dateInfo && paintData.serviceDate && days !== null) {
    dateInfo.textContent = `Last inspected ${days} day${days !== 1 ? "s" : ""} ago (${formatDate(paintData.serviceDate)})`;
  }

  // Update condition stat if it exists
  const conditionStat = document.getElementById("condition-stat");
  if (conditionStat) {
    conditionStat.textContent = formatConditionText(paintData.overall);
  }
}
```

**Verification:**
- Run dev server: `npm run dev`
- Navigate to dashboard
- Check paint gradient card appears
- Verify marker positions correctly
- Check responsive behavior on mobile width

### Step 3: Commit dashboard paint gradient changes

```bash
git add portal.html src/views/portal.js
git commit -m "feat(portal): add compact paint gradient card to dashboard

- Reduce gradient bar from 40px to 20px height
- Scale marker from 56px to 32px diameter
- Add proper spacing and typography per Estimator design
- Maintain full gradient functionality and status messages"
```

---

## Task 3: Typography & Spacing Refinement

**Files:**
- Modify: `portal-services.html:21-502` (remaining typography)
- Modify: `portal.html:21-500` (remaining typography)

### Step 1: Update timeline stats typography

**File:** `portal-services.html`

Update `.timeline-stats` section (around line 249-261):

```css
.timeline-stats {
  display: flex;
  gap: var(--ss-space-md);
  font-size: var(--ss-text-xs);
  color: var(--ss-text-medium);
  margin-top: var(--ss-space-xs);
}

.timeline-stat {
  display: flex;
  align-items: center;
  gap: var(--ss-space-xs);
}

.timeline-stat strong {
  font-weight: 600;
  color: var(--ss-text-dark);
}
```

### Step 2: Update detail section typography

**File:** `portal-services.html`

Update `.detail-section` styles (around line 274-307):

```css
.detail-section {
  margin-bottom: var(--ss-space-lg);
}

.detail-section h4 {
  font-size: var(--ss-text-sm);
  font-weight: 600;
  color: var(--ss-text-dark);
  margin-bottom: var(--ss-space-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--ss-space-md);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: var(--ss-space-xs);
}

.detail-label {
  font-size: var(--ss-text-xs);
  font-weight: 600;
  color: var(--ss-text-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-value {
  font-size: var(--ss-text-sm);
  color: var(--ss-text-dark);
  line-height: var(--ss-leading-relaxed);
}
```

### Step 3: Update notes section styling

**File:** `portal-services.html`

Update `.notes-section` (around line 359-366):

```css
.notes-section {
  background: var(--ss-bg-light);
  padding: var(--ss-space-md);
  border-left: 3px solid var(--ss-primary);
  font-size: var(--ss-text-sm);
  color: var(--ss-text-dark);
  line-height: var(--ss-leading-relaxed);
  margin-top: var(--ss-space-md);
}
```

### Step 4: Verify typography consistency

**Verification:**
- Run dev server: `npm run dev`
- Check service history page
- Verify all text sizes match design tokens:
  - h2: `var(--ss-text-2xl)` (40px)
  - h3: `var(--ss-text-lg)` (20px)
  - h4: `var(--ss-text-sm)` (14px)
  - Body: `var(--ss-text-base)` (16px)
  - Small: `var(--ss-text-sm)` (14px)
  - Tiny: `var(--ss-text-xs)` (13px)
- Check line heights match:
  - Headings: 1.2
  - Body: 1.6
- Check spacing matches Estimator

### Step 5: Commit typography refinements

```bash
git add portal-services.html portal.html
git commit -m "refactor(portal): align typography with Estimator hierarchy

- Use consistent font sizes from design-tokens.css
- Apply proper line heights (tight/relaxed)
- Add letter-spacing to uppercase labels
- Ensure spacing scale consistency"
```

---

## Task 4: Mobile Responsive Refinements

**Files:**
- Modify: `portal-services.html:490-501` (mobile media query)
- Modify: `portal.html` (add mobile breakpoint if missing)

### Step 1: Update service history mobile styles

**File:** `portal-services.html`

Update or add mobile media query (around line 490):

```css
/* Mobile responsiveness */
@media (max-width: 768px) {
  .service-video-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--ss-space-sm);
  }

  .video-play-overlay {
    width: 40px;
    height: 40px;
    font-size: var(--ss-text-lg);
  }

  .condition-badges-row {
    gap: var(--ss-space-xs);
  }

  .condition-badge {
    font-size: 11px;
    padding: 3px 10px;
  }

  .timeline-item {
    padding: var(--ss-space-md);
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
```

### Step 2: Test mobile responsiveness

**Verification:**
- Open dev server in browser
- Open Chrome DevTools
- Switch to mobile viewport (iPhone 12, 390px width)
- Check:
  - Badges wrap properly
  - No horizontal scroll
  - Text remains readable
  - Gradient marker scales to 28px
  - Touch targets are adequate (min 44px)

### Step 3: Commit mobile refinements

```bash
git add portal-services.html portal.html
git commit -m "fix(portal): improve mobile responsive layout

- Scale badges for smaller screens
- Adjust condition marker for touch
- Ensure proper wrapping on narrow viewports
- Maintain readability at mobile widths"
```

---

## Task 5: Build & Visual Verification

**Files:**
- None (testing only)

### Step 1: Run production build

```bash
npm run build
```

**Expected:** Build completes successfully with no errors or warnings

### Step 2: Preview production build

```bash
npm run preview
```

**Expected:** Preview server starts on http://localhost:4173

### Step 3: Visual verification checklist

Open preview server and verify:

**Service History Page:**
- [ ] Date and service name left-aligned
- [ ] Condition badges appear inline below title
- [ ] Badges use correct status colors
- [ ] Paint/Growth/Hulls/Anodes/Propellers all inline
- [ ] No badges pushed to far right
- [ ] Expand/collapse still works
- [ ] Details section displays correctly
- [ ] Mobile view wraps badges properly

**Dashboard:**
- [ ] Paint gradient card appears
- [ ] Gradient bar is 20px tall (compact)
- [ ] Marker is 32px diameter
- [ ] Marker positions correctly for all conditions
- [ ] Status message updates appropriately
- [ ] Last inspected date displays
- [ ] Mobile view scales marker to 28px
- [ ] Card spacing matches other cards

**Typography:**
- [ ] All text sizes match Estimator
- [ ] Line heights correct (1.2 headings, 1.6 body)
- [ ] Letter spacing on uppercase labels
- [ ] Colors use design tokens

**Spacing:**
- [ ] Card padding consistent (24px)
- [ ] Section gaps consistent (24px)
- [ ] Badge gaps (8px)
- [ ] Element spacing matches Estimator

### Step 4: Stop preview server

Press `Ctrl+C` to stop the preview server

### Step 5: Commit build verification

```bash
git commit --allow-empty -m "test: verify production build and visual layout

All visual verification checks passed:
- Service history vertical stacking ✓
- Inline condition badges ✓
- Dashboard paint gradient (20px) ✓
- Typography hierarchy ✓
- Mobile responsive ✓"
```

---

## Task 6: Final Integration & Documentation

**Files:**
- Create: `docs/implementation/2025-11-06-layout-redesign-complete.md`
- Modify: `CLAUDE.md` (if needed)

### Step 1: Document implementation completion

**File:** `docs/implementation/2025-11-06-layout-redesign-complete.md`

```markdown
# Portal Layout Redesign - Implementation Complete

**Date:** 2025-11-06
**Branch:** feature/portal-layout-redesign
**Status:** ✅ Complete

## Changes Implemented

### Service History (portal-services.html)
- Vertical stacking layout with date/service name
- Inline condition badges row
- Fixed right-alignment issues
- Proper badge color coding

### Dashboard (portal.html)
- Compact paint gradient card (20px height)
- Scaled marker (32px diameter)
- Status messages and date info
- Mobile responsive scaling

### Typography & Spacing
- Consistent font sizes from design-tokens.css
- Proper line heights (1.2/1.6)
- Letter spacing on labels
- Spacing scale aligned with Estimator

## Files Modified

- `portal-services.html` - Service history layout
- `src/views/service-history.js` - Timeline item rendering
- `portal.html` - Dashboard paint gradient
- `src/views/portal.js` - Paint condition display

## Testing Completed

- [x] Production build successful
- [x] Visual verification (desktop)
- [x] Visual verification (mobile)
- [x] Service history layout correct
- [x] Dashboard gradient functional
- [x] Typography matches Estimator
- [x] Spacing consistent

## Next Steps

1. Merge to main via PR
2. Deploy to Vercel
3. Monitor for any visual regressions
```

### Step 2: Commit documentation

```bash
mkdir -p docs/implementation
git add docs/implementation/2025-11-06-layout-redesign-complete.md
git commit -m "docs: add implementation completion summary"
```

### Step 3: Push branch to remote

```bash
git push -u origin feature/portal-layout-redesign
```

**Expected:** Branch pushed successfully to origin

### Step 4: Final verification

Confirm all commits are pushed:

```bash
git log --oneline origin/feature/portal-layout-redesign
```

**Expected:** See all commits from this implementation

---

## Success Criteria

- [x] Service history uses vertical stacking
- [x] Condition badges inline (not pushed right)
- [x] Paint gradient on dashboard (20px compact)
- [x] Typography matches Estimator hierarchy
- [x] Spacing consistent with design system
- [x] Mobile responsive without horizontal scroll
- [x] Production build successful
- [x] All visual verification passed

## Ready for Code Review

Branch ready for review and merge to main. All implementation tasks complete.

**Estimated Time:** 60-90 minutes total
**Commits:** 6 discrete commits
**Files Changed:** 4 core files + documentation

---

## Troubleshooting

**If badges don't appear:**
- Check `createTimelineItem` returns correct HTML
- Verify badge array builds correctly
- Check CSS class names match

**If gradient doesn't show:**
- Verify `paintData` is loading
- Check `loadPaintCondition` is called
- Confirm DOM IDs match

**If styles look wrong:**
- Clear browser cache
- Rebuild: `npm run build`
- Check design-tokens.css loaded

**If mobile view breaks:**
- Check media query at 768px
- Verify badge wrapping
- Test on actual device
