/**
 * Customer Portal - Invoices View
 * Displays invoice history and payment management
 */

import { requireAuth, getCurrentUser, getUserBoats, logout } from '../auth/auth.js';
import {
  loadInvoices,
  getInvoiceStats,
  formatCurrency,
  formatDate,
  getStatusClass,
  getStatusText,
  calculateCategoryTotals
} from '../api/invoices.js';

// Require authentication
const isAuth = await requireAuth();
if (!isAuth) {
  throw new Error('Not authenticated');
}

// State
let currentUser = null;
let currentBoatId = null;
let allInvoices = [];
let filteredInvoices = [];

/**
 * Initialize page
 */
async function init() {
  // Get current user
  const { user, error: userError } = await getCurrentUser();
  if (userError || !user) {
    console.error('Error loading user:', userError);
    window.location.href = '/login.html';
    return;
  }

  currentUser = user;
  document.getElementById('user-email').textContent = user.email;

  // Get user's boats
  const { boats, error: boatsError } = await getUserBoats(currentUser.id);
  if (boatsError) {
    console.error('Error loading boats:', boatsError);
    return;
  }

  if (boats.length === 0) {
    showEmptyState('No boats found. Please contact support to link your boat.');
    return;
  }

  // Get current boat (from localStorage or first boat)
  const savedBoatId = localStorage.getItem('currentBoatId');
  const boat = boats.find(b => b.id === savedBoatId) || boats[0];
  currentBoatId = boat.id;

  // Load data
  await loadData();

  // Setup event listeners
  setupEventListeners();
}

/**
 * Load invoice data
 */
async function loadData() {
  // Load stats
  await loadStats();

  // Load invoices
  await loadInvoiceList();
}

/**
 * Load invoice statistics
 */
async function loadStats() {
  const { stats, error } = await getInvoiceStats(currentBoatId);

  if (error) {
    console.error('Error loading stats:', error);
    return;
  }

  if (!stats) return;

  // Update stats display
  const statsRow = document.getElementById('stats-row');
  statsRow.innerHTML = `
    <div class="stat-card">
      <h4>Total Invoices</h4>
      <p class="stat-value">${stats.total}</p>
    </div>
    <div class="stat-card">
      <h4>Total Paid</h4>
      <p class="stat-value">${formatCurrency(stats.paidAmount)}</p>
    </div>
    <div class="stat-card">
      <h4>Outstanding</h4>
      <p class="stat-value">${formatCurrency(stats.outstandingAmount)}</p>
    </div>
  `;
}

/**
 * Load invoice list
 */
async function loadInvoiceList() {
  const { invoices, error } = await loadInvoices(currentBoatId);

  if (error) {
    console.error('Error loading invoices:', error);
    showError('Failed to load invoices. Please try again.');
    return;
  }

  allInvoices = invoices;
  filteredInvoices = invoices;

  renderInvoices();
}

/**
 * Render invoice list
 */
function renderInvoices() {
  const container = document.getElementById('invoice-list');

  if (filteredInvoices.length === 0) {
    showEmptyState('No invoices found.');
    return;
  }

  container.innerHTML = filteredInvoices.map(invoice => {
    const lineItems = invoice.line_items || [];
    const categoryTotals = calculateCategoryTotals(lineItems);

    return `
      <div class="invoice-item" data-invoice-id="${invoice.id}">
        <div class="invoice-header" onclick="toggleInvoiceDetails('${invoice.id}')">
          <div class="invoice-info">
            <div class="invoice-number">Invoice #${invoice.invoice_number}</div>
            <div class="invoice-date">${formatDate(invoice.invoice_date)}</div>
          </div>
          <div class="invoice-amount">${formatCurrency(invoice.amount_total)}</div>
          <span class="invoice-status ${getStatusClass(invoice.status)}">
            ${getStatusText(invoice.status)}
          </span>
          <span class="expand-icon" id="expand-${invoice.id}">▼</span>
        </div>

        <div class="invoice-details" id="details-${invoice.id}">
          ${lineItems.length > 0 ? `
            <table class="line-items-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${lineItems.map(item => `
                  <tr>
                    <td>${item.description}</td>
                    <td>${item.category ? item.category.charAt(0).toUpperCase() + item.category.slice(1) : 'Other'}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.unit_price)}</td>
                    <td class="item-amount">${formatCurrency(item.amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div style="margin-bottom: var(--ss-space-md);">
              <strong>Breakdown by Category:</strong><br>
              ${Object.entries(categoryTotals).map(([category, amount]) =>
                amount > 0 ? `${category.charAt(0).toUpperCase() + category.slice(1)}: ${formatCurrency(amount)}<br>` : ''
              ).join('')}
            </div>
          ` : '<p>No line items available.</p>'}

          ${invoice.payment_date ? `
            <div class="payment-info">
              <strong>Payment Details:</strong><br>
              Paid on ${formatDate(invoice.payment_date)}
              ${invoice.payment_method_id ? ` via ${invoice.payment_method_id}` : ''}
            </div>
          ` : invoice.status === 'sent' || invoice.status === 'overdue' ? `
            <div class="payment-info">
              <strong>Due Date:</strong> ${invoice.due_date ? formatDate(invoice.due_date) : 'Upon receipt'}
            </div>
          ` : ''}

          ${invoice.notes ? `
            <div style="margin-top: var(--ss-space-sm); font-size: var(--ss-font-size-xs); color: var(--ss-neutral-600);">
              <strong>Notes:</strong> ${invoice.notes}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Toggle invoice details
 * @param {string} invoiceId - Invoice ID
 */
window.toggleInvoiceDetails = function(invoiceId) {
  const details = document.getElementById(`details-${invoiceId}`);
  const icon = document.getElementById(`expand-${invoiceId}`);

  if (details.classList.contains('expanded')) {
    details.classList.remove('expanded');
    icon.classList.remove('expanded');
  } else {
    details.classList.add('expanded');
    icon.classList.add('expanded');
  }
};

/**
 * Apply filters
 */
function applyFilters() {
  const statusFilter = document.getElementById('status-filter').value;
  const dateRange = document.getElementById('date-range').value;

  filteredInvoices = allInvoices.filter(invoice => {
    // Status filter
    if (statusFilter && invoice.status !== statusFilter) {
      return false;
    }

    // Date range filter
    if (dateRange !== 'all') {
      const days = parseInt(dateRange);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const invoiceDate = new Date(invoice.invoice_date);
      if (invoiceDate < cutoffDate) {
        return false;
      }
    }

    return true;
  });

  renderInvoices();
}

/**
 * Show empty state
 * @param {string} message - Message to display
 */
function showEmptyState(message) {
  const container = document.getElementById('invoice-list');
  container.innerHTML = `
    <div class="empty-state">
      <p>${message}</p>
    </div>
  `;
}

/**
 * Show error
 * @param {string} message - Error message
 */
function showError(message) {
  const container = document.getElementById('invoice-list');
  container.innerHTML = `
    <div class="empty-state">
      <p style="color: var(--ss-error-600);">${message}</p>
    </div>
  `;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Logout button
  document.getElementById('logout-btn').addEventListener('click', async () => {
    const { success } = await logout();
    if (success) {
      window.location.href = '/login.html';
    }
  });

  // Filter changes
  document.getElementById('status-filter').addEventListener('change', applyFilters);
  document.getElementById('date-range').addEventListener('change', applyFilters);

  // Manage payment methods (Stripe Customer Portal)
  document.getElementById('manage-payment-btn').addEventListener('click', () => {
    // TODO: Implement Stripe Customer Portal integration
    alert('Payment method management coming soon! You will be able to update your card on file through Stripe\'s secure portal.');
  });
}

// Initialize page
init();
