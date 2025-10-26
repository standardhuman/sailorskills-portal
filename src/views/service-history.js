/**
 * Service History View
 * Customer-facing service history page
 */

import { requireAuth, getCurrentUser, getUserBoats, logout } from '../auth/auth.js';
import {
  loadServiceLogs,
  getServiceStats,
  formatDate,
  formatShortDate,
  formatHours,
  getConditionClass
} from '../api/service-logs.js';

// Check authentication
const isAuth = await requireAuth();
if (!isAuth) {
  throw new Error('Not authenticated');
}

// Get current user and boats
const { user, error: userError } = await getCurrentUser();
if (userError || !user) {
  console.error('Failed to get user:', userError);
  window.location.href = '/login.html';
  throw new Error('User not found');
}

const { boats, error: boatsError } = await getUserBoats(user.id);
if (boatsError || !boats || boats.length === 0) {
  console.error('Failed to get boats:', boatsError);
  showEmptyState('No boats found. Please contact support.');
  throw new Error('No boats found');
}

// Use first boat (in Phase 8 we'll add boat switching)
const currentBoat = boats[0];

// DOM Elements
const userEmailEl = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const dateRangeSelect = document.getElementById('date-range');
const timelineContainer = document.getElementById('service-timeline');
const statTotalEl = document.getElementById('stat-total');
const statYearEl = document.getElementById('stat-year');
const statLastEl = document.getElementById('stat-last');

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Logout handler
  logoutBtn.addEventListener('click', async () => {
    await logout();
    window.location.href = '/login.html';
  });

  // Filter change handler
  dateRangeSelect.addEventListener('change', loadServices);
}

// Initialize
async function init() {
  // Set user email
  userEmailEl.textContent = user.email;

  // Setup event listeners
  setupEventListeners();

  await loadServiceStats();
  await loadServices();
}

/**
 * Load service statistics
 */
async function loadServiceStats() {
  const { stats, error } = await getServiceStats(currentBoat.id);

  if (error) {
    console.error('Failed to load stats:', error);
    return;
  }

  if (stats) {
    statTotalEl.textContent = stats.total || 0;
    statYearEl.textContent = stats.thisYear || 0;

    if (stats.lastServiceDate) {
      statLastEl.textContent = formatShortDate(stats.lastServiceDate);
    } else {
      statLastEl.textContent = 'None';
    }
  }
}

/**
 * Load service logs
 */
async function loadServices() {
  // Show loading
  timelineContainer.innerHTML = '<div class="loader">Loading service history...</div>';

  // Get date range filter
  const dateRange = dateRangeSelect.value;
  const filters = {};

  if (dateRange !== 'all') {
    const days = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    filters.startDate = startDate.toISOString().split('T')[0];
  }

  // Load service logs
  const { serviceLogs, error } = await loadServiceLogs(currentBoat.id, filters);

  if (error) {
    console.error('Failed to load service logs:', error);
    showError('Failed to load service history. Please try again.');
    return;
  }

  // Display service logs
  if (serviceLogs.length === 0) {
    showEmptyState('No service history found for the selected time period.');
    return;
  }

  displayServiceLogs(serviceLogs);
}

/**
 * Display service logs
 */
function displayServiceLogs(logs) {
  timelineContainer.innerHTML = logs.map((log, index) => {
    return createTimelineItem(log, index);
  }).join('');

  // Add click handlers to expand/collapse
  document.querySelectorAll('.timeline-item').forEach((item, index) => {
    item.addEventListener('click', (e) => {
      // Don't toggle if clicking on a link or button
      if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') {
        return;
      }

      const details = item.querySelector('.timeline-details');
      const icon = item.querySelector('.expand-icon');

      details.classList.toggle('expanded');
      icon.classList.toggle('expanded');
    });
  });
}

/**
 * Create timeline item HTML
 */
function createTimelineItem(log, index) {
  const hasDetails = log.paint_condition_overall || log.growth_level ||
    log.thru_hull_condition || (log.anode_conditions && log.anode_conditions.length > 0) ||
    log.notes || (log.propellers && log.propellers.length > 0);

  return `
    <div class="timeline-item" data-log-id="${log.id}">
      <div class="timeline-header">
        <div>
          <div class="timeline-date">${formatDate(log.service_date)}</div>
          ${log.service_name ? `<div class="service-name">${escapeHtml(log.service_name)}</div>` : ''}
        </div>
        ${hasDetails ? '<span class="expand-icon">▼</span>' : ''}
      </div>

      ${hasDetails ? `
        <div class="timeline-details">
          ${createConditionsSection(log)}
          ${createAnodesSection(log)}
          ${createPropellersSection(log)}
          ${log.notes ? `
            <div class="detail-section">
              <h4>Service Notes</h4>
              <div class="notes-section">${escapeHtml(log.notes)}</div>
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Create conditions section
 */
function createConditionsSection(log) {
  const hasConditions = log.paint_condition_overall || log.growth_level || log.thru_hull_condition;

  if (!hasConditions) return '';

  return `
    <div class="detail-section">
      <h4>Vessel Condition</h4>
      <div class="detail-grid">
        ${log.paint_condition_overall ? `
          <div class="detail-item">
            <div class="detail-label">Paint Condition</div>
            <div class="detail-value">
              <span class="condition-badge ${getConditionClass(log.paint_condition_overall)}">
                ${escapeHtml(log.paint_condition_overall)}
              </span>
            </div>
          </div>
        ` : ''}

        ${log.paint_detail_keel ? `
          <div class="detail-item">
            <div class="detail-label">Keel</div>
            <div class="detail-value">${escapeHtml(log.paint_detail_keel)}</div>
          </div>
        ` : ''}

        ${log.paint_detail_waterline ? `
          <div class="detail-item">
            <div class="detail-label">Waterline</div>
            <div class="detail-value">${escapeHtml(log.paint_detail_waterline)}</div>
          </div>
        ` : ''}

        ${log.paint_detail_boot_stripe ? `
          <div class="detail-item">
            <div class="detail-label">Boot Stripe</div>
            <div class="detail-value">${escapeHtml(log.paint_detail_boot_stripe)}</div>
          </div>
        ` : ''}

        ${log.growth_level ? `
          <div class="detail-item">
            <div class="detail-label">Growth Level</div>
            <div class="detail-value">${escapeHtml(log.growth_level)}</div>
          </div>
        ` : ''}

        ${log.thru_hull_condition ? `
          <div class="detail-item">
            <div class="detail-label">Through-Hulls</div>
            <div class="detail-value">${escapeHtml(log.thru_hull_condition)}</div>
          </div>
        ` : ''}
      </div>

      ${log.thru_hull_notes ? `
        <div style="margin-top: var(--ss-space-sm); font-size: var(--ss-font-size-sm); color: var(--ss-neutral-600); font-style: italic;">
          ${escapeHtml(log.thru_hull_notes)}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Create anodes section
 */
function createAnodesSection(log) {
  if (!log.anode_conditions || log.anode_conditions.length === 0) return '';

  return `
    <div class="detail-section">
      <h4>⚓ Anode Inspection</h4>
      <ul class="anode-list">
        ${log.anode_conditions.map(anode => {
          const location = anode.location || anode.type || 'Unknown';
          const position = anode.position ? ` (${anode.position})` : '';
          const condition = anode.condition_percent !== undefined
            ? `${anode.condition_percent}%`
            : anode.condition || 'N/A';

          // Check if this anode was replaced
          const replacement = log.anodes_installed && log.anodes_installed.find(installed =>
            installed.location && installed.location.toLowerCase() === location.toLowerCase() &&
            (!installed.position || !anode.position || installed.position.toLowerCase() === anode.position.toLowerCase())
          );

          return `
            <li class="anode-item">
              <div>
                <strong>${escapeHtml(location)}${escapeHtml(position)}</strong>
                ${replacement ? '<span style="color: var(--ss-success-700); margin-left: var(--ss-space-xs);">✓ Replaced</span>' : ''}
              </div>
              <div>
                <span class="condition-badge ${getConditionClass(anode.condition || 'fair')}">
                  ${escapeHtml(condition)}
                </span>
              </div>
            </li>
          `;
        }).join('')}
      </ul>
    </div>
  `;
}

/**
 * Create propellers section
 */
function createPropellersSection(log) {
  if (!log.propellers || log.propellers.length === 0) return '';

  return `
    <div class="detail-section">
      <h4>Propeller Condition</h4>
      <ul class="anode-list">
        ${log.propellers.map(prop => `
          <li class="anode-item">
            <div><strong>Propeller #${prop.number || 1}</strong></div>
            <div>
              <span class="condition-badge ${getConditionClass(prop.condition || 'good')}">
                ${escapeHtml(prop.condition || 'N/A')}
              </span>
            </div>
          </li>
          ${prop.notes ? `<div style="padding-left: var(--ss-space-md); font-size: var(--ss-font-size-xs); color: var(--ss-neutral-600); font-style: italic;">${escapeHtml(prop.notes)}</div>` : ''}
        `).join('')}
      </ul>
      ${log.propeller_notes ? `
        <div style="margin-top: var(--ss-space-sm); font-size: var(--ss-font-size-sm); color: var(--ss-neutral-600); font-style: italic;">
          ${escapeHtml(log.propeller_notes)}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Show empty state
 */
function showEmptyState(message) {
  timelineContainer.innerHTML = `
    <div class="empty-state">
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * Show error message
 */
function showError(message) {
  timelineContainer.innerHTML = `
    <div class="empty-state" style="color: var(--ss-error-600);">
      <p>⚠️ ${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize the page
init();
