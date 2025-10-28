/**
 * Invoice API Client
 * Handles all invoice-related data access
 */

import { createSupabaseClient } from '../lib/supabase.js';

const supabase = createSupabaseClient();

/**
 * Load invoices for a boat
 * @param {string} boatId - Boat ID (optional, kept for backward compatibility)
 * @param {string} customerId - Customer ID
 * @param {object} filters - Optional filters (status, dateRange)
 * @returns {Promise<{invoices, error}>}
 */
export async function loadInvoices(boatId, customerId, filters = {}) {
  try {
    // Query by customer_id to get all invoices (both boat-specific and customer-level)
    let query = supabase
      .from('invoices')
      .select(`*`)
      .eq('customer_id', customerId)
      .order('issued_at', { ascending: false });

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.startDate) {
      query = query.gte('issued_at', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('issued_at', filters.endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { invoices: data || [], error: null };
  } catch (error) {
    console.error('Load invoices error:', error);
    return { invoices: [], error: error.message };
  }
}

/**
 * Get single invoice with line items
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<{invoice, error}>}
 */
export async function getInvoice(invoiceId) {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        boat:boats(name, slug)
      `)
      .eq('id', invoiceId)
      .single();

    if (error) throw error;

    return { invoice: data, error: null };
  } catch (error) {
    console.error('Get invoice error:', error);
    return { invoice: null, error: error.message };
  }
}

/**
 * Get invoice statistics for a boat
 * @param {string} boatId - Boat ID (optional, kept for backward compatibility)
 * @param {string} customerId - Customer ID
 * @returns {Promise<{stats, error}>}
 */
export async function getInvoiceStats(boatId, customerId) {
  try {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('amount, status')
      .eq('customer_id', customerId);

    if (error) throw error;

    const stats = {
      total: invoices.length,
      paid: invoices.filter(i => i.status === 'paid').length,
      pending: invoices.filter(i => i.status === 'pending').length,
      overdue: invoices.filter(i => i.status === 'overdue').length,
      totalAmount: invoices.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0),
      paidAmount: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + parseFloat(i.amount || 0), 0),
      outstandingAmount: invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + parseFloat(i.amount || 0), 0)
    };

    return { stats, error: null };
  } catch (error) {
    console.error('Get invoice stats error:', error);
    return { stats: null, error: error.message };
  }
}

/**
 * Get recent invoices for a boat
 * @param {string} boatId - Boat ID (optional, kept for backward compatibility)
 * @param {string} customerId - Customer ID
 * @param {number} limit - Number of invoices to return
 * @returns {Promise<{invoices, error}>}
 */
export async function getRecentInvoices(boatId, customerId, limit = 3) {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('customer_id', customerId)
      .order('issued_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return { invoices: data || [], error: null };
  } catch (error) {
    console.error('Get recent invoices error:', error);
    return { invoices: [], error: error.message };
  }
}

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @returns {string}
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

/**
 * Format date
 * @param {string} dateString - ISO date string
 * @returns {string}
 */
export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Get status badge class
 * @param {string} status - Invoice status
 * @returns {string}
 */
export function getStatusClass(status) {
  const statusClasses = {
    'pending': 'status-pending',
    'paid': 'status-paid',
    'overdue': 'status-overdue',
    'cancelled': 'status-cancelled'
  };
  return statusClasses[status] || 'status-default';
}

/**
 * Get status display text
 * @param {string} status - Invoice status
 * @returns {string}
 */
export function getStatusText(status) {
  const statusText = {
    'pending': 'Pending',
    'paid': 'Paid',
    'overdue': 'Overdue',
    'cancelled': 'Cancelled'
  };
  return statusText[status] || status;
}

/**
 * Calculate invoice totals by category
 * @param {Array} lineItems - Invoice line items
 * @returns {object}
 */
export function calculateCategoryTotals(lineItems) {
  const totals = {
    labor: 0,
    parts: 0,
    anodes: 0,
    travel: 0,
    other: 0
  };

  lineItems.forEach(item => {
    const category = item.category || 'other';
    const amount = parseFloat(item.amount || 0);
    if (totals.hasOwnProperty(category)) {
      totals[category] += amount;
    } else {
      totals.other += amount;
    }
  });

  return totals;
}
