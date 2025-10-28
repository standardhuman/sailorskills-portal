import { createClient } from '@supabase/supabase-js';
import { formatCurrency, formatInvoiceDate, formatPaymentMethod } from '../../../sailorskills-shared/src/utils/invoice-formatters.js';
import { createStatusBadge } from '../../../sailorskills-shared/src/ui/components/status-badge.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentCustomerId = null;
let invoices = [];
let payments = [];

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthentication();
    await loadBillingData();
});

async function checkAuthentication() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/login.html';
        return;
    }

    // Get customer_id from customer_accounts table
    const { data: account, error } = await supabase
        .from('customer_accounts')
        .select('customer_id')
        .eq('user_id', session.user.id)
        .single();

    if (error || !account) {
        showError('Failed to load account information');
        return;
    }

    currentCustomerId = account.customer_id;
    // Set app context for RLS
    await supabase.rpc('set_app_context', { customer_id: currentCustomerId });
}

async function loadBillingData() {
    try {
        showLoading(true);

        // Load invoices (RLS will filter to current customer)
        const { data: invoiceData, error: invoiceError } = await supabase
            .from('invoices')
            .select('*')
            .eq('customer_id', currentCustomerId)
            .order('issued_at', { ascending: false });

        if (invoiceError) throw invoiceError;
        invoices = invoiceData || [];

        // Load payments
        const { data: paymentData, error: paymentError } = await supabase
            .from('payments')
            .select('*')
            .eq('customer_id', currentCustomerId)
            .order('payment_date', { ascending: false });

        if (paymentError) throw paymentError;
        payments = paymentData || [];

        renderSummary();
        renderInvoices();
        renderPaymentHistory();

        showLoading(false);
    } catch (error) {
        console.error('Error loading billing data:', error);
        showError('Failed to load billing information: ' + error.message);
        showLoading(false);
    }
}

function renderSummary() {
    // Current balance (sum of pending invoices)
    const balance = invoices
        .filter(inv => inv.status === 'pending')
        .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

    document.getElementById('currentBalance').textContent = formatCurrency(balance);

    // Last payment
    if (payments.length > 0) {
        const lastPayment = payments[0];
        document.getElementById('lastPaymentAmount').textContent = formatCurrency(lastPayment.amount);
        document.getElementById('lastPaymentDate').textContent = formatInvoiceDate(lastPayment.payment_date);
    }
}

function renderInvoices() {
    const list = document.getElementById('invoicesList');
    const section = document.getElementById('invoicesSection');

    if (invoices.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📄</div>
                <h3>No Invoices Yet</h3>
                <p>Your invoices will appear here when available.</p>
            </div>
        `;
        section.style.display = 'block';
        return;
    }

    list.innerHTML = '';
    invoices.forEach(invoice => {
        const card = createInvoiceCard(invoice);
        list.appendChild(card);
    });

    section.style.display = 'block';
}

function createInvoiceCard(invoice) {
    const card = document.createElement('div');
    card.className = 'invoice-card';

    const serviceDesc = invoice.service_details?.description || 'Service';

    card.innerHTML = `
        <div class="invoice-card-header">
            <div class="invoice-number">Invoice ${invoice.invoice_number}</div>
            <div id="status-${invoice.id}"></div>
        </div>
        <div class="invoice-details">
            <div class="detail-item">
                <div class="detail-label">Service</div>
                <div class="detail-value">${serviceDesc}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Amount</div>
                <div class="detail-value">${formatCurrency(invoice.amount)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Issued</div>
                <div class="detail-value">${formatInvoiceDate(invoice.issued_at)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Due</div>
                <div class="detail-value">${formatInvoiceDate(invoice.due_at)}</div>
            </div>
        </div>
        <div class="invoice-actions">
            <button class="btn btn-secondary" onclick="toggleLineItems('${invoice.id}')">View Details</button>
            <button class="btn btn-primary" onclick="downloadPDF('${invoice.id}')">📥 Download PDF</button>
        </div>
        <div id="lineItems-${invoice.id}" class="line-items-section">
            <!-- Line items will be loaded here -->
        </div>
    `;

    // Add status badge
    const statusCell = card.querySelector(`#status-${invoice.id}`);
    statusCell.appendChild(createStatusBadge(invoice.status));

    return card;
}

window.toggleLineItems = async function(invoiceId) {
    const section = document.getElementById(`lineItems-${invoiceId}`);

    if (section.classList.contains('expanded')) {
        section.classList.remove('expanded');
        return;
    }

    // Load line items if not already loaded
    if (section.innerHTML === '') {
        try {
            const { data: lineItems, error } = await supabase
                .from('invoice_line_items')
                .select('*')
                .eq('invoice_id', invoiceId);

            if (error) throw error;

            if (lineItems && lineItems.length > 0) {
                section.innerHTML = `
                    <h4 style="margin: 0 0 10px 0;">Line Items</h4>
                    ${lineItems.map(item => `
                        <div class="line-item">
                            <span class="line-item-desc">${item.description}</span>
                            <span class="line-item-type">(${item.type})</span>
                            <span class="line-item-amount">${formatCurrency(item.total)}</span>
                        </div>
                    `).join('')}
                `;
            } else {
                section.innerHTML = '<p style="color: #6c757d; font-size: 0.875rem;">No itemized details available</p>';
            }
        } catch (error) {
            console.error('Error loading line items:', error);
            section.innerHTML = '<p style="color: #dc3545; font-size: 0.875rem;">Failed to load details</p>';
        }
    }

    section.classList.add('expanded');
};

window.downloadPDF = function(invoiceId) {
    // TODO: Implement PDF generation
    alert('PDF download coming soon!');
};

function renderPaymentHistory() {
    const body = document.getElementById('paymentHistoryBody');
    const section = document.getElementById('paymentHistorySection');

    if (payments.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #6c757d;">No payment history</td></tr>';
        section.style.display = 'block';
        return;
    }

    body.innerHTML = '';
    payments.forEach(payment => {
        const row = document.createElement('tr');
        const paymentMethodFormatted = formatPaymentMethod(payment.payment_method);

        // Find associated invoice
        const invoice = invoices.find(inv => inv.id === payment.invoice_id);
        const invoiceNumber = invoice ? invoice.invoice_number : 'N/A';

        row.innerHTML = `
            <td>${formatInvoiceDate(payment.payment_date)}</td>
            <td>${paymentMethodFormatted.icon} ${paymentMethodFormatted.text}</td>
            <td>${formatCurrency(payment.amount)}</td>
            <td>${invoiceNumber}</td>
            <td id="payment-status-${payment.id}"></td>
        `;

        body.appendChild(row);

        // Add status badge
        const statusCell = row.querySelector(`#payment-status-${payment.id}`);
        statusCell.appendChild(createStatusBadge(payment.status));
    });

    section.style.display = 'block';
}

function showLoading(show) {
    document.getElementById('loadingIndicator').style.display = show ? 'block' : 'none';
    document.getElementById('invoicesSection').style.display = show ? 'none' : 'block';
    document.getElementById('paymentHistorySection').style.display = show ? 'none' : 'block';
}

function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}
