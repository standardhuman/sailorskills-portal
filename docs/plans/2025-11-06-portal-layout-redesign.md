# Portal Layout Redesign - Service History & Dashboard

**Date:** 2025-11-06
**Status:** Approved
**Design Approach:** Unified Flow

---

## Overview

Redesign the Portal service history and dashboard layouts to match Estimator's design aesthetic while fixing alignment issues and restoring the paint condition gradient indicator.

### Design Goals

1. Fix right-alignment issues in service history (anode/propeller status pushed too far right)
2. Restore paint condition rainbow gradient to dashboard (compact version)
3. Match Estimator's card layouts and typography hierarchy
4. Create clean, vertical stacking pattern for service entries
5. Maintain mobile responsiveness

---

## Service History Layout

### Structure

Each service entry uses vertical stacking with left alignment:

**Line 1: Date & Service Name**
- Date: `var(--ss-text-base)`, `font-weight: 600`, `color: var(--ss-text-dark)`
- Service Name: `var(--ss-text-sm)`, `font-weight: 500`, `color: var(--ss-primary)`
- Both left-aligned with `padding: var(--ss-space-md)`
- Vertical gap: `var(--ss-space-xs)` (4px)

**Line 2: Compact Condition Badge Row**
- Position: Directly below Line 1 (8px gap)
- Display: `inline-flex` with wrap
- Badge order: Paint → Growth → Through-Hulls → Anodes → Propellers

**Badge Styling:**
```css
.condition-badge {
  padding: 4px 12px;
  font-size: var(--ss-text-xs);
  font-weight: 600;
  border-radius: var(--ss-radius-none);
  margin-right: var(--ss-space-sm); /* 8px gap */
  background: var(--ss-status-*-bg);
  color: var(--ss-status-*-text);
}
```

**Line 3: Service Metadata**
- Hours, technician, etc.
- Font: `var(--ss-text-xs)`, `color: var(--ss-text-medium)`
- Margin-top: `var(--ss-space-xs)`

### Expanded Details

**Animation:**
- Slide down with `max-height` transition
- Duration: `0.3s ease`

**Content:**
- Full condition details in grid layout
- Grid: `repeat(auto-fill, minmax(200px, 1fr))`
- Service notes in bordered callout
- Anode details with specific conditions
- Propeller condition details
- Video thumbnails (if available)

### Visual Hierarchy

**Key Fix:** Vertical stacking prevents justify-space-between from pushing badges too far right. All content flows naturally from left with consistent alignment.

**Hover State:**
```css
.timeline-item:hover {
  background: var(--ss-bg-light);
  cursor: pointer;
  transition: background 0.2s ease;
}
```

---

## Dashboard Paint Gradient Card

### Card Structure

**Positioning:** Between stats row and latest service section

**Card Styling:**
```css
.paint-condition-card {
  background: white;
  padding: var(--ss-space-lg); /* 24px */
  box-shadow: var(--ss-shadow-sm);
  border-radius: var(--ss-radius-none);
  border: 1px solid var(--ss-border-subtle);
  margin-bottom: var(--ss-space-lg);
}
```

### Content Layout

**1. Header Section**
- Title: "Vessel Paint Condition"
- Font: `var(--ss-text-lg)` (20px), `font-weight: 600`
- Color: `var(--ss-text-dark)`
- Margin-bottom: `var(--ss-space-md)` (16px)

**2. Gradient Bar**
- Height: `20px` (compact)
- Border-radius: `4px`
- Box-shadow: `0 2px 8px rgba(0,0,0,0.1)`
- Gradient: 9-stop rainbow (gray → green → yellow → orange → red)

**Gradient Stops:**
```css
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
```

**Condition Marker:**
- Diameter: `32px` (scaled from 56px)
- Position: Absolute, `top: -6px`, `left: X%`
- Transform: `translateX(-50%)`
- Background: `white`
- Border: `3px solid var(--ss-primary)`
- Box-shadow: `0 2px 8px rgba(0,0,0,0.2)`
- Content: Emoji indicator (⚓ or appropriate icon)
- Transition: `all 0.3s ease`

**3. Label Row**
- Display: `flex`, `justify-content: space-between`
- Labels: Excellent | Good | Fair | Poor
- Font: `var(--ss-text-xs)`, `color: var(--ss-text-medium)`
- Margin-top: `var(--ss-space-xs)`

**4. Status Message**
- Contextual message based on condition + days since service
- Examples:
  - Good: "Paint in excellent condition"
  - Due Soon: "Repainting recommended within 30 days"
  - Past Due: "Bottom paint service overdue"

**Status Styling:**
```css
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
```

**5. Last Inspected Info**
- Text: "Last inspected X days ago (MM/DD/YYYY)"
- Font: `var(--ss-text-xs)`, `color: var(--ss-text-medium)`
- Margin-top: `var(--ss-space-xs)`

### Responsive Behavior

**Mobile (<768px):**
- Gradient stays full-width within card
- Marker scales to `28px` for touch-friendliness
- Label text size reduced slightly if needed
- Card padding reduces to `var(--ss-space-md)`

---

## Typography & Spacing System

### Typography Hierarchy

**Headings:**
- h2 (Page titles): `var(--ss-text-2xl)` (40px), `font-weight: 600`
- h3 (Section titles): `var(--ss-text-lg)` (20px), `font-weight: 600`
- h4 (Card titles): `var(--ss-text-sm)` (14px), `font-weight: 600`, uppercase
- All headings: `color: var(--ss-text-dark)`

**Body Text:**
- Primary: `var(--ss-text-base)` (16px), `font-weight: 400`
- Secondary/Labels: `var(--ss-text-sm)` (14px), `font-weight: 500`
- Metadata/Hints: `var(--ss-text-xs)` (13px), `color: var(--ss-text-medium)`

**Line Height:**
- Headings: `var(--ss-leading-tight)` (1.2)
- Body text: `var(--ss-leading-relaxed)` (1.6)
- Compact elements: `var(--ss-leading-normal)` (1.5)

### Spacing Scale

Following Estimator's consistent spacing:
- `--ss-space-xs`: 4px (tight inline gaps)
- `--ss-space-sm`: 8px (badge gaps, label-to-input)
- `--ss-space-md`: 16px (between related elements)
- `--ss-space-lg`: 24px (card padding, section gaps)
- `--ss-space-xl`: 32px (major section separation)
- `--ss-space-2xl`: 40px (page-level spacing)

### Card Layout Consistency

**All Cards:**
```css
.card {
  background: white;
  border: 1px solid var(--ss-border-subtle);
  border-radius: var(--ss-radius-none);
  padding: var(--ss-space-lg);
  box-shadow: var(--ss-shadow-sm);
  margin-bottom: var(--ss-space-lg);
}
```

**No Rounded Corners:**
- All elements use `var(--ss-radius-none)` (0px)
- Exception: Gradient bar has subtle 4px radius for visual polish
- Exception: Condition marker is circular (50%)

---

## Color System

### Condition Badge Colors

Using design-tokens.css status colors:

**Excellent/Good:**
- Background: `var(--ss-status-success-bg)` (#D1FAE5)
- Text: `var(--ss-status-success-text)` (#065F46)

**Fair/Moderate:**
- Background: `var(--ss-status-warning-bg)` (#FEF3C7)
- Text: `var(--ss-status-warning-text)` (#92400E)

**Poor/Needs Replacement:**
- Background: `var(--ss-status-danger-bg)` (#FEE2E2)
- Text: `var(--ss-status-danger-text)` (#991B1B)

**Not Inspected/Unknown:**
- Background: `var(--ss-status-neutral-bg)` (#F3F4F6)
- Text: `var(--ss-status-neutral-text)` (#6B7280)

### Primary Brand Color Usage

- Links: `var(--ss-primary)` (#345475)
- Gradient marker border: `var(--ss-primary)`
- Active navigation: `var(--ss-primary)`
- Service name text: `var(--ss-primary)`

### Interaction States

**Hover:**
```css
.timeline-item:hover {
  background: var(--ss-bg-light);
}

.video-thumbnail:hover {
  transform: translateY(-4px);
  box-shadow: var(--ss-shadow-md);
}
```

**Transitions:**
- All interactive elements: `transition: all 0.2s ease`
- Expandable sections: `transition: max-height 0.3s ease`

---

## Implementation Notes

### Files to Modify

**Service History:**
- `/sailorskills-portal/portal-services.html` (inline styles)
- `/sailorskills-portal/src/views/service-history.js` (HTML generation)

**Dashboard:**
- `/sailorskills-portal/portal.html` (paint gradient card styles)
- `/sailorskills-portal/src/views/portal.js` (`loadPaintCondition()` function)

### Key CSS Changes

**Service History:**
1. Change `.timeline-header` from `justify-content: space-between` to vertical stacking
2. Add `.condition-badges-row` for inline-flex badge container
3. Fix all condition indicators to use left-alignment
4. Update `.detail-grid` to maintain consistent layout

**Dashboard:**
1. Add `.paint-condition-card` section
2. Scale gradient from 40px to 20px height
3. Scale marker from 56px to 32px diameter
4. Update gradient positioning logic to match compact size

### JavaScript Updates

**Service History (`service-history.js`):**
- Update `createTimelineItem()` to generate new badge row structure
- Ensure all condition fields (paint, growth, hulls, anodes, propellers) render inline
- Maintain expand/collapse functionality with new layout

**Dashboard (`portal.js`):**
- Update `loadPaintCondition()` to populate new compact gradient card
- Ensure marker positioning calculates correctly at 20px height
- Update responsive breakpoints for mobile scaling

### Testing Checklist

- [ ] Service history entries align correctly (no right-push)
- [ ] All condition badges display inline in correct order
- [ ] Paint gradient shows on dashboard at 20px height
- [ ] Gradient marker positions accurately for all condition levels
- [ ] Status message updates based on condition + days
- [ ] Mobile responsive breakpoints work correctly
- [ ] Expand/collapse functionality still works
- [ ] Typography matches Estimator hierarchy
- [ ] Colors use design-tokens.css variables
- [ ] No console errors

---

## Success Criteria

1. ✅ Anode and propeller status no longer pushed far right
2. ✅ All vessel condition info displays inline, left-aligned
3. ✅ Paint gradient restored to dashboard (compact 20px version)
4. ✅ Visual consistency with Estimator card layouts
5. ✅ Typography hierarchy matches Estimator
6. ✅ Mobile responsive without horizontal scroll
7. ✅ Clean, professional appearance matching brand standards

---

**Design approved by:** Brian
**Next step:** Implementation planning
