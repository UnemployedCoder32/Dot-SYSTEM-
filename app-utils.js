/**
 * app-utils.js
 * Global utility functions for the DOT System.
 * Provides: Real-time Indian Currency Formatting, Custom Confirm Modal.
 */

const BRAND_MARK = 'BLUEMARK Authorized';

// =====================================================================
// 1. REAL-TIME INDIAN CURRENCY FORMATTER
// =====================================================================

/**
 * Formats a number string into the Indian Numbering System (Lakhs/Crores).
 * e.g. 100000 -> 1,00,000 | 10000000 -> 1,00,00,000
 * @param {string|number} value - The raw numeric value.
 * @returns {string} The formatted string.
 */
function formatIndianNumber(value) {
    const num = String(value).replace(/[^0-9.]/g, ''); // Remove non-numeric chars
    if (!num) return '';
    const parts = num.split('.');
    let intPart = parts[0];
    const decPart = parts[1] !== undefined ? '.' + parts[1] : '';

    // Indian numbering: first comma at 3 digits from right, then every 2
    if (intPart.length <= 3) return intPart + decPart;
    const lastThree = intPart.slice(-3);
    const remaining = intPart.slice(0, -3);
    const formatted = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
    return formatted + decPart;
}

/**
 * Attaches a real-time Indian currency formatter to a single input element.
 * Stores raw value in input.dataset.rawValue for form submission.
 * @param {HTMLInputElement} input
 */
function attachCurrencyFormatter(input) {
    if (!input || input.dataset.currencyFormatted) return; // Prevent double-attaching
    input.dataset.currencyFormatted = 'true';

    // Store the original type for reference
    const originalType = input.type;

    // We need text type to allow formatted display
    input.type = 'text';
    input.autocomplete = 'off';

    input.addEventListener('input', (e) => {
        // Preserve cursor position as we reformat
        const cursorPos = e.target.selectionStart;
        const oldLength = e.target.value.length;

        const rawValue = e.target.value.replace(/[^0-9.]/g, '');
        input.dataset.rawValue = rawValue;

        const formatted = formatIndianNumber(rawValue);
        e.target.value = formatted;

        // Adjust cursor: offset by change in commas
        const newLength = formatted.length;
        const cursorOffset = newLength - oldLength;
        const newCursorPos = Math.max(0, cursorPos + cursorOffset);
        try { e.target.setSelectionRange(newCursorPos, newCursorPos); } catch (_) { }
    });

    input.addEventListener('focus', () => {
        // Show raw number when focused for easy editing
        const raw = input.dataset.rawValue || input.value.replace(/[^0-9.]/g, '');
        input.value = raw;
        input.dataset.rawValue = raw;
    });

    input.addEventListener('blur', () => {
        // Re-format on blur
        const raw = input.dataset.rawValue || input.value.replace(/[^0-9.]/g, '');
        input.dataset.rawValue = raw;
        input.value = formatIndianNumber(raw);
    });

    // Check if there's already a value, format it
    if (input.value) {
        const raw = String(input.value).replace(/[^0-9.]/g, '');
        input.dataset.rawValue = raw;
        input.value = formatIndianNumber(raw);
    }
}

/**
 * Scans the document for inputs with [data-currency] or [data-format="indian"]
 * and attaches the formatter. Can be called anytime (on load, after dynamic content).
 */
function initCurrencyFormatters() {
    const selectors = [
        'input[data-currency]',
        'input[data-format="indian"]',
    ];
    document.querySelectorAll(selectors.join(', ')).forEach(attachCurrencyFormatter);
}


/**
 * Formats a number to Indian Rupee (INR) currency format.
 * Includes NaN protection and graceful fallbacks.
 * @param {number|string} value
 * @returns {string}
 */
window.formatCurrency = (value) => {
    const rawValue = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    if (isNaN(rawValue)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(rawValue);
};

// =====================================================================
// 2. CUSTOM DARK-MODE CONFIRM MODAL
// =====================================================================

/**
 * Creates and injects the confirm modal HTML into the body (only once).
 */
function _injectConfirmModal() {
    if (document.getElementById('customConfirmModal')) return;

    const modal = document.createElement('div');
    modal.id = 'customConfirmModal';
    modal.className = 'custom-confirm-overlay';
    modal.innerHTML = `
        <div class="custom-confirm-box glass-card">
            <div class="custom-confirm-icon-wrap" id="confirmIconWrap">
                <i class="fa-solid fa-triangle-exclamation" id="confirmIcon"></i>
            </div>
            <h3 class="custom-confirm-title" id="confirmTitle">Are you sure?</h3>
            <p class="custom-confirm-message" id="confirmMessage">This action cannot be undone.</p>
            <div id="confirmInputWrap" style="display: none; margin-top: 1rem;">
                <input type="text" id="confirmInput" style="text-align: center; font-weight: bold; width: 100%; border: 1px solid var(--border); padding: 0.5rem; border-radius: 6px; background: rgba(0,0,0,0.2); color: var(--text-base);" autocomplete="off">
            </div>
            <div class="custom-confirm-actions">
                <button class="btn btn-outline" id="confirmCancelBtn">
                    <i class="fa-solid fa-xmark"></i> Cancel
                </button>
                <button class="btn btn-danger" id="confirmOkBtn">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

/**
 * Shows a custom, styled confirmation modal that matches the UI theme.
 * Replaces the native window.confirm() with a Promise-based API.
 *
 * @param {object} options - Configuration options.
 * @param {string} [options.title="Are you sure?"] - The modal title.
 * @param {string} [options.message="This action cannot be undone."] - The modal body message.
 * @param {string} [options.confirmText="Delete"] - Text for the confirm button.
 * @param {string} [options.confirmIcon="fa-trash"] - FontAwesome icon class for the confirm button.
 * @param {'danger'|'warning'|'info'} [options.type='danger'] - Theme for the modal.
 * @returns {Promise<boolean>} Resolves to `true` if confirmed, `false` if cancelled.
 */
function showConfirm(options = {}) {
    _injectConfirmModal();

    const {
        title = 'Are you sure?',
        message = 'This action cannot be undone.',
        confirmText = 'Delete',
        confirmIcon = 'fa-trash',
        type = 'danger'
    } = options;

    return new Promise((resolve) => {
        const modal = document.getElementById('customConfirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const okBtn = document.getElementById('confirmOkBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');
        const iconWrap = document.getElementById('confirmIconWrap');
        const icon = document.getElementById('confirmIcon');

        // Configure modal content
        titleEl.textContent = title;
        messageEl.textContent = message;
        okBtn.innerHTML = `<i class="fa-solid ${confirmIcon}"></i> ${confirmText}`;

        // Apply type-specific styles
        iconWrap.className = `custom-confirm-icon-wrap type-${type}`;
        okBtn.className = `btn btn-${type}`;

        const iconMap = {
            danger: 'fa-triangle-exclamation',
            warning: 'fa-circle-exclamation',
            info: 'fa-circle-info'
        };
        icon.className = `fa-solid ${iconMap[type] || 'fa-triangle-exclamation'}`;

        const requireInput = options.requireInput;
        const inputWrap = document.getElementById('confirmInputWrap');
        const inputEl = document.getElementById('confirmInput');

        if (requireInput) {
            inputWrap.style.display = 'block';
            inputEl.value = '';
            inputEl.placeholder = `Type "${requireInput}" to confirm`;
            okBtn.disabled = true;
            okBtn.style.opacity = '0.5';

            inputEl.oninput = (e) => {
                if (e.target.value === requireInput) {
                    okBtn.disabled = false;
                    okBtn.style.opacity = '1';
                } else {
                    okBtn.disabled = true;
                    okBtn.style.opacity = '0.5';
                }
            };
        } else if (inputWrap) {
            inputWrap.style.display = 'none';
            okBtn.disabled = false;
            okBtn.style.opacity = '1';
            inputEl.oninput = null;
        }

        // Show modal
        modal.classList.add('active');
        // Trigger animation after display
        requestAnimationFrame(() => {
            modal.querySelector('.custom-confirm-box').classList.add('visible');
        });

        const cleanup = (result) => {
            if (requireInput && inputEl) inputEl.oninput = null;
            modal.querySelector('.custom-confirm-box').classList.remove('visible');
            setTimeout(() => modal.classList.remove('active'), 300);
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onOverlayClick);
            resolve(result);
        };

        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onOverlayClick = (e) => { if (e.target === modal) cleanup(false); };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onOverlayClick);
    });
}


// =====================================================================
// 3. SUCCESS TOAST NOTIFICATION SYSTEM
// =====================================================================

function _injectToastContainer() {
    if (document.getElementById('toastContainer')) return;
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
}

/**
 * Shows a brief, elegant toast notification.
 * @param {string} message - The message to display.
 * @param {'success'|'error'|'info'} [type='success'] - The toast type.
 */
function showToast(message, type = 'success') {
    _injectToastContainer();
    const container = document.getElementById('toastContainer');

    // Log successful actions
    if (type === 'success') {
        logActivity(message);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info');

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}


// =====================================================================
// 4. AUTOMATED PDF GENERATION (Estimates & Invoices)
// =====================================================================

/** 
 * Generates and opens a professional PDF using the new HTML template.
 * @param {'Estimate'|'Invoice'} type - Document type.
 * @param {object} data - Data for the document.
 */
async function generatePDF(type, data) {
    let htmlString = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${type || 'Tax Invoice'}</title>
    <style>
        /* General Setup */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
        }

        body {
            background-color: #f2f2f2;
            display: flex;
            justify-content: center;
            padding: 20px;
        }

        /* A4 Page Styling */
        .page {
            width: 210mm;
            min-height: 297mm;
            padding: 10mm;
            background: #fff;
            border: 1px solid #ddd;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }

        /* Print Specifics */
        @media print {
            body {
                background: none;
                padding: 0;
            }
            .page {
                border: none;
                box-shadow: none;
                width: 100%;
                height: 100%;
                padding: 10mm;
            }
        }

        /* Typography */
        body {
            font-size: 10pt;
            color: #000;
        }
        
        h1, h2, h3, h4, h5 { font-size: 11pt; }
        
        .small-text {
            font-size: 8pt;
        }

        /* Global Borders Helper */
        .border-box {
            border: 1px solid #000;
        }
        
        .border-bottom { border-bottom: 1px solid #000; }
        .border-right { border-right: 1px solid #000; }
        .border-left { border-left: 1px solid #000; }
        .border-top { border-top: 1px solid #000; }

        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }

        /* Outer Table Wrapper */
        .invoice-wrapper {
            border: 1px solid #000;
            display: flex;
            flex-direction: column;
        }

        /* Header Layout */
        .header-title-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px;
            border-bottom: 1px solid #000;
        }
        .header-title {
            flex-grow: 1;
            text-align: center;
            font-weight: bold;
            font-size: 12pt;
        }
        .header-original {
            font-size: 9pt;
            font-style: italic;
        }

        .header-split {
            display: flex;
            border-bottom: 1px solid #000;
        }
        
        /* Seller Column */
        .seller-col {
            flex: 1;
            padding: 5px;
            border-right: 1px solid #000;
        }
        .seller-name {
            font-weight: bold;
            font-size: 11pt;
            margin-bottom: 5px;
        }

        /* Meta Table Column */
        .meta-col {
            flex: 1;
        }

        .meta-table {
            width: 100%;
            border-collapse: collapse;
        }
        .meta-table td {
            border-bottom: 1px solid #000;
            border-right: 1px solid #000;
            padding: 3px 5px;
            width: 50%;
            vertical-align: top;
            font-size: 9pt;
        }
        .meta-table td:last-child {
            border-right: none;
        }
        .meta-table tr:last-child td {
            border-bottom: none;
        }
        .meta-label {
            font-size: 8pt;
            display: block;
            margin-bottom: 2px;
        }
        .meta-value {
            font-weight: bold;
        }

        /* Buyer Layout */
        .buyer-section {
            padding: 5px;
            border-bottom: 1px solid #000;
        }

        /* Line Items Table */
        .items-table {
            width: 100%;
            border-collapse: collapse;
        }
        .items-table th, .items-table td {
            border-right: 1px solid #000;
            padding: 5px;
            vertical-align: top;
        }
        .items-table th:last-child, .items-table td:last-child {
            border-right: none;
        }
        
        .items-table th {
            border-bottom: 1px solid #000;
            text-align: left;
            font-weight: normal;
        }

        .items-table .td-number { text-align: right; }
        .items-table .td-center { text-align: center; }

        /* Make main table take available space to push footer down */
        .items-table-body td {
            height: 350px; /* Minimum height for line items area */
        }
        
        /* Subtotal Rows inside the item table space */
        .subtotal-row td {
            border-right: none;
            border-top: none;
            padding: 2px 5px;
            height: auto;
        }
        .border-right-only {
            border-right: 1px solid #000 !important;
        }

        .total-hr {
            border-top: 1px solid #000;
            margin: 5px 0;
            width: 100%;
        }

        /* Total Row Footer */
        .total-row-container {
            display: flex;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
        }
        .total-label {
            flex: 1;
            padding: 5px;
            text-align: right;
            border-right: 1px solid #000;
        }
        .total-qty {
            width: 80px; 
            padding: 5px;
            text-align: center;
            border-right: 1px solid #000;
        }
        .total-amount-col {
            width: 120px;
            padding: 5px;
            text-align: right;
            font-weight: bold;
        }

        /* Footer Layout */
        .footer-split {
            display: flex;
        }
        .footer-left {
            flex: 1;
            border-right: 1px solid #000;
            display: flex;
            flex-direction: column;
        }
        .footer-amount-words {
            padding: 5px;
            border-bottom: 1px solid #000;
        }
        .footer-declaration {
            padding: 5px;
            flex-grow: 1;
        }
        .footer-legal {
            text-align: center;
            font-size: 8pt;
            padding: 5px;
            border-top: 1px solid #000;
            margin-top: auto;
        }

        .footer-right {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 5px;
        }
        .bank-details {
            font-size: 9pt;
            line-height: 1.3;
        }
        .bank-details .label {
            display: inline-block;
            width: 100px;
        }
        .signatory-box {
            margin-top: auto;
            text-align: right;
            font-size: 9pt;
        }
        .signatory-space {
            height: 60px;
        }

        /* Width classes for Items table */
        .col-sl { width: 30px; }
        .col-desc { width: auto; }
        .col-hsn { width: 70px; }
        .col-qty { width: 60px; }
        .col-rate-incl { width: 70px; }
        .col-rate { width: 70px; text-align: right; }
        .col-per { width: 40px; text-align: center; }
        .col-disc { width: 50px; text-align: right; }
        .col-amt { width: 100px; text-align: right; }

    </style>
</head>
<body>

<div class="page" id="invoice">
    
    <div class="invoice-wrapper">
        
        <!-- HEADER ROW 1 -->
        <div class="header-title-container">
            <div></div> <!-- Empty div to balance flex for center title -->
            <div class="header-title">${type || 'Tax Invoice'}</div>
            <div class="header-original">(ORIGINAL FOR RECIPIENT)</div>
        </div>

        <!-- HEADER ROW 2 (Seller & Meta) -->
        <div class="header-split">
            <div class="seller-col">
                <div class="seller-name" id="seller-name">Wintel Systems & Services</div>
                <div id="seller-address">103, Amar Palace Behind Bjp Office<br>Dhantoli, Nagpur</div>
                <div id="seller-phone">09823015709 / 09923201709</div>
                <div>GSTIN/UIN: <span id="seller-gstin" class="font-bold">27AAQPM6844C1ZF</span></div>
                <div>State Name : <span id="seller-state">Maharashtra</span>, Code : <span id="seller-state-code">27</span></div>
                <div>E-Mail : <span id="seller-email">admin@wintelsystems.co.in</span></div>
            </div>

            <div class="meta-col">
                <table class="meta-table">
                    <tr>
                        <td>
                            <span class="meta-label">${docTitle === 'Delivery Memo' ? 'Memo No.' : 'Invoice No.'}</span>
                            <span class="meta-value font-bold" id="inv-no">64</span>
                        </td>
                        <td>
                            <span class="meta-label">Dated</span>
                            <span class="meta-value font-bold" id="inv-date">4-Apr-26</span>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <span class="meta-label">Delivery Note</span>
                            <span class="meta-value" id="inv-delivery"></span>
                        </td>
                        <td>
                            <span class="meta-label">Mode/Terms of Payment</span>
                            <span class="meta-value" id="inv-payment"></span>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <span class="meta-label">Reference No. & Date.</span>
                            <span class="meta-value" id="inv-ref"></span>
                        </td>
                        <td>
                            <span class="meta-label">Other References</span>
                            <span class="meta-value" id="inv-other-ref"></span>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <span class="meta-label">Buyer's Order No.</span>
                            <span class="meta-value" id="inv-buyer-order"></span>
                        </td>
                        <td>
                            <span class="meta-label">Dated</span>
                            <span class="meta-value" id="inv-buyer-order-date"></span>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <span class="meta-label">Dispatch Doc No.</span>
                            <span class="meta-value" id="inv-dispatch-doc"></span>
                        </td>
                        <td>
                            <span class="meta-label">Delivery Note Date</span>
                            <span class="meta-value" id="inv-delivery-date"></span>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <span class="meta-label">Dispatched through</span>
                            <span class="meta-value" id="inv-dispatch-through"></span>
                        </td>
                        <td>
                            <span class="meta-label">Destination</span>
                            <span class="meta-value" id="inv-destination"></span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2">
                            <span class="meta-label">Terms of Delivery</span>
                            <span class="meta-value" id="inv-terms"></span>
                        </td>
                    </tr>
                </table>
            </div>
        </div>

        <!-- BUYER SECTION -->
        <div class="buyer-section">
            <div class="small-text">Buyer (Bill to)</div>
            <div class="seller-name font-bold" id="buyer-name">DOT- SYSTEM</div>
            <div id="buyer-address">SF-2 SUNRAJ BHAKAR OPP. DURGA MANDIR<br>RANAPRATAP NAGAR<br>NAGPUR</div>
            <div>GSTIN/UIN: <span id="buyer-gstin" class="font-bold">27AGLPK6741K1ZX</span></div>
            <div>Place of Supply: <span id="buyer-placeOfSupply">Maharashtra</span></div>
        </div>

        <!-- LINE ITEMS -->
        <table class="items-table">
            <thead>
                <tr>
                    <th class="col-sl td-center">Sl<br>No.</th>
                    <th class="col-desc">Description of Goods</th>
                    <th class="col-hsn">HSN/SAC</th>
                    <th class="col-qty td-center">Quantity</th>
                    <th class="col-rate-incl td-number">Rate<br><span class="small-text">(Incl. of Tax)</span></th>
                    <th class="col-rate">Rate</th>
                    <th class="col-per">per</th>
                    <th class="col-disc">Disc. %</th>
                    <th class="col-amt">Amount</th>
                </tr>
            </thead>
            <tbody class="items-table-body" id="invoice-items">
                <!-- Using a single large TR for items to let border stretch full height if necessary, 
                     but standard HTML tables grow by row. We will mix items and empty space. -->
                <tr>
                    <td class="col-sl td-center">
                        <div style="margin-bottom: 5px;">1</div>
                        <div style="margin-bottom: 5px;">2</div>
                    </td>
                    <td class="col-desc font-bold">
                        <div style="margin-bottom: 5px;">CABINET ANT ESPORTS VM 10</div>
                        <div style="margin-bottom: 5px;">POWER SUPPLY ANT ESPORTS ECO 500</div>
                        <br><br><br>
                        <div class="text-right pd-right-10">OUTPUT CGST @ 9 %</div>
                        <div class="text-right pd-right-10">OUTPUT SGST @ 9 %</div>
                    </td>
                    <td class="col-hsn">
                        <div style="margin-bottom: 5px;">84733099</div>
                        <div style="margin-bottom: 5px;">85044090</div>
                    </td>
                    <td class="col-qty td-center font-bold">
                        <div style="margin-bottom: 5px;">1 NOS</div>
                        <div style="margin-bottom: 5px;">1 NOS</div>
                    </td>
                    <td class="col-rate-incl td-number">
                        <div style="margin-bottom: 5px;">1,650.01</div>
                        <div style="margin-bottom: 5px;">750.00</div>
                    </td>
                    <td class="col-rate">
                        <div style="margin-bottom: 5px;">1,398.31</div>
                        <div style="margin-bottom: 5px;">635.59</div>
                    </td>
                    <td class="col-per td-center">
                        <div style="margin-bottom: 5px;">NOS</div>
                        <div style="margin-bottom: 5px;">NOS</div>
                    </td>
                    <td class="col-disc">
                        <div style="margin-bottom: 5px;"></div>
                        <div style="margin-bottom: 5px;"></div>
                        <br><br><br>
                        <div class="text-right">9 %</div>
                        <div class="text-right">9 %</div>
                    </td>
                    <td class="col-amt font-bold">
                        <div style="margin-bottom: 5px;">1,398.31</div>
                        <div style="margin-bottom: 5px;">635.59</div>
                        
                        <div class="total-hr"></div>
                        <div class="text-right" style="font-weight: normal">2,033.90</div>
                        <div class="text-right">183.05</div>
                        <div class="text-right">183.05</div>
                    </td>
                </tr>
            </tbody>
        </table>

        <!-- TOTAL ROW -->
        <div class="total-row-container">
            <div class="total-label">Total</div>
            <div class="total-qty font-bold" id="total-qty-all">2 NOS</div>
            <!-- Blank space for visual columns -->
            <div style="flex:1;"></div>
            <div style="flex:1;"></div>
            <div style="flex:1;"></div>
            <div class="total-amount-col">
                <span style="float:left;">&#8377;</span>
                <span id="total-grand">2,400.00</span>
                <div class="small-text text-right" style="font-weight:normal; margin-top:2px;">E & O.E</div>
            </div>
        </div>

        <!-- FOOTER SPLIT -->
        <div class="footer-split">
            <!-- Left Side -->
            <div class="footer-left">
                <div class="footer-amount-words">
                    <div class="small-text">Amount Chargeable (in words)</div>
                    <div class="font-bold" id="amount-in-words">INR Two Thousand Four Hundred Only</div>
                </div>
                <div class="footer-declaration">
                    <div class="small-text">Declaration</div>
                    <div style="font-size: 9pt;">
                        We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                    </div>
                </div>
                <div class="footer-legal">
                    SUBJECT TO NAGPUR JURISDICTION<br>
                    This is a Computer Generated Invoice
                </div>
            </div>
            
            <!-- Right Side -->
            <div class="footer-right">
                <div class="small-text">Company's Bank Details</div>
                <div class="bank-details">
                    <div><span class="label">A/c Holder's Name :</span><span class="font-bold" id="bank-holder">Wintel Systems And Services</span></div>
                    <div><span class="label">Bank Name :</span><span id="bank-name">CENTRAL BANK OF INDIA</span></div>
                    <div><span class="label">A/c No. :</span><span class="font-bold" id="bank-acc">5290630760</span></div>
                    <div><span class="label">Branch & IFS Code :</span><span id="bank-branch-ifsc">DIGHORI NAGPUR & CBIN0284431</span></div>
                </div>
                
                <div class="signatory-box">
                    <div class="font-bold">for <span id="signatory-company">Wintel Systems & Services</span></div>
                    <div class="signatory-space">
                        <!-- Add digital signature image here if needed -->
                    </div>
                    <div>Authorised Signatory</div>
                </div>
            </div>
        </div>

    </div>

</div>

<!-- DATA SCRIPT PLACEHOLDER (For future dynamic population) -->
<script>
    // This script block is a designated place for you to push the JSON data into this template dynamically.
    /*
    const invoiceData = {
        seller: { name: "", address: [], ... },
        buyer: { ... },
        ...
    };
    */
</script>
</body>
</html>
`;

    const allSettings = JSON.parse(localStorage.getItem('dot_system_settings') || '{}');
    const isQuotation = (type === 'Estimate' || type === 'Quotation');
    const docTitle = isQuotation ? 'QUOTATION' : 'TAX INVOICE';

    const bizName = allSettings.bizName || 'DOT SYSTEM';
    const bizAddrLines = [allSettings.bizAddr || '', `${allSettings.bizCity || ''} - ${allSettings.bizPin || ''}`].filter(Boolean).join('<br>');
    const bizPhone = allSettings.bizPhone || '';
    const bizEmail = allSettings.bizEmail || '';
    const bizGst = allSettings.gstNum || 'NOT PROVIDED';

    // Customer
    const customerName = data.customer || data.customerName || data.orgName || 'Cash / Walk-in Customer';

    // Invoice Meta
    const invNo = data.invoiceNo || data.id || `INV-${Math.floor(1000 + Math.random() * 9000)}`;
    const docDate = data.date || data.createdAt?.split(',')[0] || new Date().toLocaleDateString('en-GB');

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const setText = (id, text) => {
        const el = doc.getElementById(id);
        if (el) el.textContent = text;
    };
    const setHtml = (id, html) => {
        const el = doc.getElementById(id);
        if (el) el.innerHTML = html;
    };

    // Update Header
    const titleEls = doc.querySelectorAll('.header-title');
    if (titleEls.length > 0) titleEls[0].textContent = docTitle;

    const origEls = doc.querySelectorAll('.header-original');
    if (origEls.length > 0 && isQuotation) origEls[0].style.display = 'none';

    // Update Seller
    setText('seller-name', bizName);
    setHtml('seller-address', bizAddrLines || 'SF-2 SUNRAJ BHAKAR<br>RANAPRATAP NAGAR, NAGPUR');
    setText('seller-phone', bizPhone || '09823015709 / 09923201709');
    setText('seller-gstin', bizGst);
    setText('seller-email', bizEmail || 'admin@wintelsystems.co.in');

    // Update Buyer
    setText('buyer-name', customerName);
    const splitAddr = (data.address || '').split(',').join('<br>');
    setHtml('buyer-address', splitAddr || 'Nagpur, Maharashtra');
    setText('buyer-gstin', data.gstin || 'NOT PROVIDED');

    // Meta Table
    setText('inv-no', invNo);
    setText('inv-date', docDate);

    // Build Line Items
    const itemsBody = doc.getElementById('invoice-items');
    if (itemsBody) {
        itemsBody.innerHTML = '';

        let items = [];
        if (data.items && Array.isArray(data.items)) {
            items = data.items;
        } else {
            const desc = data.problem || data.deviceIssue || data.category || data.type || 'Service / Repair Job';
            const rate = data.price || data.amount || data.fee || 0;
            items.push({ name: desc, qty: 1, price: rate, hsn: '9987', rateExcl: rate, amount: rate });
        }

        let subtotal = 0;
        let totalQty = 0;

        let slHtml = '';
        let descHtml = '';
        let hsnHtml = '';
        let qtyHtml = '';
        let rateInclHtml = '';
        let rateHtml = '';
        let perHtml = '';
        let discHtml = '';
        let amtHtml = '';

        items.forEach((item, index) => {
            const qty = parseFloat(item.qty) || 1;
            const rateExcl = parseFloat(item.price || item.rate || 0); // Base price before GST
            const amountExcl = rateExcl * qty;
            const priceIncl = rateExcl * 1.18; // Reverse adding 18% GST

            subtotal += amountExcl;
            totalQty += qty;

            slHtml += `<div style="margin-bottom: 5px;">${index + 1}</div>`;
            descHtml += `<div style="margin-bottom: 5px;">${escapeHtml(item.name || item.product || item.deviceType)}</div>`;
            hsnHtml += `<div style="margin-bottom: 5px;">${item.hsn || '84733099'}</div>`;
            qtyHtml += `<div style="margin-bottom: 5px;">${qty} NOS</div>`;
            rateInclHtml += `<div style="margin-bottom: 5px;">${priceIncl.toFixed(2)}</div>`;
            rateHtml += `<div style="margin-bottom: 5px;">${rateExcl.toFixed(2)}</div>`;
            perHtml += `<div style="margin-bottom: 5px;">NOS</div>`;
            discHtml += `<div style="margin-bottom: 5px;"></div>`;
            amtHtml += `<div style="margin-bottom: 5px;">${amountExcl.toFixed(2)}</div>`;
        });

        let grandTotal = 0;
        const isTaxDoc = type === 'Invoice' || type === 'Tax Invoice';

        if (isTaxDoc) {
            const cgst = subtotal * 0.09;
            const sgst = subtotal * 0.09;
            grandTotal = Math.round(subtotal + cgst + sgst);

            descHtml += `<br><br><br><div class="text-right" style="padding-right: 10px;">OUTPUT CGST @ 9 %</div><div class="text-right" style="padding-right: 10px;">OUTPUT SGST @ 9 %</div>`;
            discHtml += `<br><br><br><div class="text-right">9 %</div><div class="text-right">9 %</div>`;
            
            amtHtml += `
                <div class="total-hr"></div>
                <div class="text-right" style="font-weight: normal">${subtotal.toFixed(2)}</div>
                <div class="text-right">${cgst.toFixed(2)}</div>
                <div class="text-right">${sgst.toFixed(2)}</div>
            `;
        } else {
            grandTotal = Math.round(subtotal);
            amtHtml += `
                <div class="total-hr"></div>
                <div class="text-right" style="font-weight: bold">${subtotal.toFixed(2)}</div>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-sl td-center">${slHtml}</td>
            <td class="col-desc font-bold">${descHtml}</td>
            <td class="col-hsn">${hsnHtml}</td>
            <td class="col-qty td-center font-bold">${qtyHtml}</td>
            <td class="col-rate-incl td-number">${rateInclHtml}</td>
            <td class="col-rate">${rateHtml}</td>
            <td class="col-per td-center">${perHtml}</td>
            <td class="col-disc">${discHtml}</td>
            <td class="col-amt font-bold">${amtHtml}</td>
        `;
        itemsBody.appendChild(tr);

        setText('total-qty-all', `${totalQty} NOS`);
        setText('total-grand', grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
        setText('amount-in-words', `INR ${numberToWords(grandTotal)} Only`);
    }

    setText('signatory-company', bizName);
    setText('bank-holder', bizName);

    // 3. Open Print Window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(doc.documentElement.outerHTML);
        printWindow.document.close();

        printWindow.setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            if (window.showToast) showToast(`${docTitle} ready for print/download!`);
        }, 500);
    } else {
        alert('Please allow popups for this site to view the invoice.');
    }
}

/**
 * Generates a professional Job Card PDF for Repair Intake using the same template.
 * @param {Object} job - The repair job object.
 */
function generateJobCardPDF(job) {
    const itemDesc = `REPAIR: ${job.deviceType || ''} ${job.model || ''} - ${job.deviceIssue || ''}. SR No: ${job.srNo || ''}`;
    const mappedData = {
        id: job.id || job.srNo,
        customerName: job.customerName,
        date: job.createdAt?.split(',')[0],
        items: [{
            name: itemDesc,
            qty: 1,
            price: job.price || 0,
            hsn: '998729'
        }]
    };
    generatePDF('Estimate', mappedData);
}

// Helper functions for template injection
function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe.toString().replace(/[&<"'>]/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '"': '&quot;', "'": '&#39;', '>': '&gt;' }[m];
    });
}

function numberToWords(num) {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if ((num = num.toString()).length > 9) return 'overflow';
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.trim() || 'Zero';
}


// =====================================================================
// 5. MICRO-SPARKLINE GENERATOR
// =====================================================================

/**
 * Enhances a standard <select> with a live search filter.
 * @param {string} selectId - The ID of the select element.
 * @param {string} [placeholder="Search options..."] - Search input placeholder.
 */
function makeSearchableSelect(selectId, placeholder = "Search options...") {
    const select = document.getElementById(selectId);
    if (!select || select.dataset.searchableAttached) return;
    select.dataset.searchableAttached = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'searchable-select-wrapper';
    wrapper.style.position = 'relative';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '0.5rem';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = placeholder;
    searchInput.className = 'form-control';
    searchInput.style.fontSize = '0.8rem';
    searchInput.style.padding = '0.4rem 0.8rem';
    searchInput.style.marginBottom = '0.2rem';

    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(searchInput);
    wrapper.appendChild(select);

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const options = select.options;
        let firstMatch = -1;

        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const text = opt.textContent.toLowerCase();
            const matches = text.includes(query) || i === 0; // Always show first (placeholder) option

            // Note: Hiding options in <select> is flaky but works in most modern desktops
            opt.style.display = matches ? 'block' : 'none';
            if (matches && firstMatch === -1 && i !== 0) firstMatch = i;
        }
    });
}

/**
 * Renders a simple sparkline in a container using Canvas.
 * @param {HTMLElement} container - The container DIV.
 * @param {number[]} data - Array of numbers to plot.
 * @param {string} [color='#3b82f6'] - Line color.
 */
function renderSparkline(container, data, color = '#3b82f6') {
    if (!container || !data || data.length < 2) return;

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';

    data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.stroke();
    container.innerHTML = '';
    container.appendChild(canvas);

    // Add tooltip with data values
    container.title = `7-Day Sales Trend: ${data.join(' â†’ ')}`;
    container.style.cursor = 'help';
}


// =====================================================================
// 6. PREMIUM BORDER GLOW (Spotlight Hover Effect)
// =====================================================================

/**
 * Initializes cursor tracking on all elements with `.border-glow-card`.
 * Dynamically sets `--mouse-x` and `--mouse-y` CSS variables.
 */
function initBorderGlow() {
    const glowCards = document.querySelectorAll('.border-glow-card');

    glowCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            // Calculate mouse position relative to the card
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Set the CSS variables dynamically
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });

        // Optional: Reset position when mouse leaves to gracefully fade out
        card.addEventListener('mouseleave', () => {
            card.style.setProperty('--mouse-x', `-200px`);
            card.style.setProperty('--mouse-y', `-200px`);
        });
    });
}


// =====================================================================
// 7. GLOBAL FEATURES (FAB, Command Palette, Activity Log)
// =====================================================================

function logActivity(actionDesc) {
    let logs = JSON.parse(localStorage.getItem('dot_system_activity_log')) || [];
    logs.unshift({ desc: actionDesc, time: new Date().toLocaleString() });
    if (logs.length > 10) logs = logs.slice(0, 10);
    localStorage.setItem('dot_system_activity_log', JSON.stringify(logs));
}

function initGlobalFeatures() {
    // 1. FAB
    if (!document.getElementById('globalFabWrap')) {
        const fab = document.createElement('div');
        fab.id = 'globalFabWrap';
        fab.className = 'global-fab-wrap fade-in';
        fab.innerHTML = `
            <div class="global-fab-menu" id="fabMenu">
                <a href="repair-jobs.html" class="fab-item">
                    <span class="fab-item-label">New Repair</span>
                    <div class="fab-item-icon"><i class="fa-solid fa-screwdriver-wrench"></i></div>
                </a>
                <a href="transactions.html" class="fab-item">
                    <span class="fab-item-label">Log Transaction</span>
                    <div class="fab-item-icon"><i class="fa-solid fa-receipt"></i></div>
                </a>
                <a href="#" class="fab-item" onclick="window.print(); return false;">
                    <span class="fab-item-label">Print/Export PDF</span>
                    <div class="fab-item-icon"><i class="fa-solid fa-print"></i></div>
                </a>
            </div>
            <button class="fab-btn" id="fabToggleBtn" title="Quick Actions">
                <i class="fa-solid fa-plus" id="fabIcon"></i>
            </button>
        `;
        document.body.appendChild(fab);

        const btn = document.getElementById('fabToggleBtn');
        const menu = document.getElementById('fabMenu');
        const icon = document.getElementById('fabIcon');

        btn.addEventListener('click', () => {
            menu.classList.toggle('active');
            if (menu.classList.contains('active')) {
                icon.classList.remove('fa-plus');
                icon.classList.add('fa-xmark');
                btn.style.transform = 'rotate(90deg)';
            } else {
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-plus');
                btn.style.transform = 'rotate(0deg)';
            }
        });
    }

    // 2. Command Palette
    if (!document.getElementById('cmdPalette')) {
        const cmd = document.createElement('div');
        cmd.id = 'cmdPalette';
        cmd.className = 'cmd-palette-overlay';
        cmd.innerHTML = `
            <div class="cmd-palette" onclick="event.stopPropagation()">
                <div class="cmd-input-wrap">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="cmdInput" placeholder="Search pages or commands..." autocomplete="off" spellcheck="false" style="width:100%; color:#fff;">
                </div>
                <div class="cmd-results" id="cmdResults">
                </div>
                <div style="padding: 0.5rem 1.5rem; border-top: 1px solid var(--border); font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                    <span><kbd>â†‘</kbd> <kbd>â†“</kbd> to navigate</span>
                    <span><kbd>Enter</kbd> to select</span>
                    <span><kbd>Esc</kbd> to close</span>
                </div>
            </div>
        `;
        document.body.appendChild(cmd);

        const cmdOverlay = document.getElementById('cmdPalette');
        const cmdInput = document.getElementById('cmdInput');
        const cmdResults = document.getElementById('cmdResults');

        const routes = [
            { name: 'Dashboard Home', url: 'index.html', icon: 'fa-house' },
            { name: 'Transactions & Ledger', url: 'transactions.html', icon: 'fa-receipt' },
            { name: 'Repair Jobs', url: 'repair-jobs.html', icon: 'fa-screwdriver-wrench' },
            { name: 'AMC Management', url: 'amc-management.html', icon: 'fa-building-shield' },
            { name: 'Service Visits', url: 'service-visits.html', icon: 'fa-car-side' },
            { name: 'Staff Payroll', url: 'employees.html', icon: 'fa-users' },
            { name: 'Business Calendar', url: 'calendar.html', icon: 'fa-calendar-days' },
            { name: 'System Settings', url: 'settings.html', icon: 'fa-gear' },
            { name: 'Print Current Page', action: () => window.print(), icon: 'fa-print' },
            { name: 'Clear Cache & Reload', action: () => { localStorage.clear(); window.location.reload(); }, icon: 'fa-rotate' }
        ];

        let selectedCmdIndex = 0;
        let filteredRoutes = [...routes];

        function renderCmdResults() {
            cmdResults.innerHTML = '';
            filteredRoutes.forEach((r, idx) => {
                const item = document.createElement('a');
                item.className = 'cmd-result-item' + (idx === selectedCmdIndex ? ' selected' : '');
                item.innerHTML = `<i class="fa-solid ${r.icon}"></i> <span>${r.name}</span>`;
                item.onclick = (e) => {
                    e.preventDefault();
                    executeCmd(r);
                };
                item.onmouseover = () => {
                    selectedCmdIndex = idx;
                    renderCmdResults();
                };
                cmdResults.appendChild(item);
            });
        }

        function executeCmd(route) {
            cmdOverlay.classList.remove('active');
            if (route.url) window.location.href = route.url;
            else if (route.action) route.action();
        }

        window.toggleCmdPalette = () => {
            const isActive = cmdOverlay.classList.contains('active');
            if (isActive) {
                cmdOverlay.classList.remove('active');
            } else {
                cmdOverlay.classList.add('active');
                cmdInput.value = '';
                filteredRoutes = [...routes];
                selectedCmdIndex = 0;
                renderCmdResults();
                setTimeout(() => cmdInput.focus(), 100);
            }
        };

        cmdOverlay.addEventListener('click', () => cmdOverlay.classList.remove('active'));

        cmdInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            filteredRoutes = routes.filter(r => r.name.toLowerCase().includes(query));
            selectedCmdIndex = 0;
            renderCmdResults();
        });

        cmdInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedCmdIndex = (selectedCmdIndex + 1) % filteredRoutes.length;
                renderCmdResults();
                const sel = cmdResults.querySelector('.selected');
                if (sel) sel.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedCmdIndex = (selectedCmdIndex - 1 + filteredRoutes.length) % filteredRoutes.length;
                renderCmdResults();
                const sel = cmdResults.querySelector('.selected');
                if (sel) sel.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredRoutes[selectedCmdIndex]) {
                    executeCmd(filteredRoutes[selectedCmdIndex]);
                }
            } else if (e.key === 'Escape') {
                cmdOverlay.classList.remove('active');
            }
        });

        // 3. Global Shortcuts Keyboard Listeners
        document.addEventListener('keydown', (e) => {
            const active = document.activeElement;
            const isTyping = active && (
                active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.tagName === 'SELECT' ||
                active.isContentEditable
            );
            if (isTyping) return; // don't intercept when user is in a form field

            // Ctrl+K for Command Palette
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                toggleCmdPalette();
            }
            // Shift + ? for Help
            if (e.shiftKey && e.key === '?') {
                e.preventDefault();
                if (window.showToast) showToast('Shortcuts: Ctrl+K (Commands), Ctrl+P (Print)', 'info');
            }
            // Esc closes palette
            if (e.key === 'Escape') {
                const modal = document.getElementById('customConfirmModal');
                if (modal && modal.classList.contains('active')) return;
                cmdOverlay.classList.remove('active');
            }
        });
    }
}


// =====================================================================
// INIT ON DOM READY
// =====================================================================

/**
 * 4. WHATSAPP CONNECT
 * -------------------
 * Opens WhatsApp with a pre-filled encoded message.
 * @param {string} phone - Target phone number (e.g. 919876543210)
 * @param {string} message - Text message to send.
 */
window.shareToWhatsApp = function(phone, message) {
    if (!phone) {
        if (window.showToast) showToast('Missing customer phone number', 'error');
        return;
    }
    // Clean phone number (remove spaces, symbols)
    const cleanPhone = phone.toString().replace(/\D/g, '');
    const encodedMsg = encodeURIComponent(message);
    const url = `https://wa.me/${cleanPhone}/?text=${encodedMsg}`;
    window.open(url, '_blank');
};

document.addEventListener('DOMContentLoaded', () => {
    _injectConfirmModal();
    _injectToastContainer();
    initCurrencyFormatters();
    initBorderGlow();
    initGlobalFeatures();
});
