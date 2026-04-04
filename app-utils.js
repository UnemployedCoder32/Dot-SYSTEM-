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
        try { e.target.setSelectionRange(newCursorPos, newCursorPos); } catch (_) {}
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
 * Generates and downloads a professional PDF.
 * @param {'Estimate'|'Invoice'} type - Document type.
 * @param {object} data - Data for the document.
 */
async function generatePDF(type, data) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        alert('PDF library not loaded. Please ensure you are connected to the internet.');
        return;
    }

    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    const isQuotation = (type === 'Estimate' && data.status === 'Pending');
    
    // --- Header Section (Dark Navy) ---
    const allSettings = JSON.parse(localStorage.getItem('dot_system_settings')) || {};
    const businessName = allSettings.bizName || 'DOT SYSTEM';
    const businessSub = allSettings.bizEmail || 'Business Solutions & Hardware Services';
    const businessAddress = `${allSettings.bizAddr || ''}, ${allSettings.bizCity || ''} - ${allSettings.bizPin || ''}`;
    const businessPhone = allSettings.bizPhone || '';
    const gstNumber = allSettings.gstNum ? `GSTIN: ${allSettings.gstNum}` : 'GSTIN: NOT PROVIDED';

    doc.setFillColor(15, 23, 42); // #0f172a
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Logo Rendering (if exists)
    if (allSettings.logo) {
        try {
            doc.addImage(allSettings.logo, 'PNG', margin, 5, 30, 30);
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(businessName.toUpperCase(), margin + 35, 22);
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(businessSub, margin + 35, 30);
        } catch (e) {
            console.error('Logo render failed', e);
            // Fallback to text
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text(businessName.toUpperCase(), margin, 22);
        }
    } else {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(businessName.toUpperCase(), margin, 22);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(businessSub, margin, 30);
    }
    
    // BLUEMARK Badge (Right aligned)
    let badgeX;
    let textWidth;
    if (allSettings.showBadge !== false) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const badgeText = 'BLUEMARK';
        textWidth = doc.getTextWidth(badgeText);
        badgeX = pageWidth - margin - 8; 
        doc.text(badgeText, badgeX - textWidth, 22);
        
        // Green Dot
        doc.setFillColor(16, 185, 129); // Green
        doc.circle(badgeX - textWidth + textWidth + 3, 20.5, 1.5, 'F');
    }

    // Document Type Label (TAX INVOICE or SERVICE QUOTATION)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const docTitle = isQuotation ? 'SERVICE QUOTATION' : 'TAX INVOICE';
    doc.text(docTitle, pageWidth - margin, 32, { align: 'right' });

    // --- Watermark (BLUEMARK) ---
    doc.saveGraphicsState();
    doc.setTextColor(230, 230, 230);
    doc.setFontSize(70);
    doc.text('BLUEMARK', pageWidth / 2, doc.internal.pageSize.height / 2, {
        align: 'center',
        angle: 45,
        opacity: 0.1
    });
    doc.restoreGraphicsState();
    
    // --- Bill To & Document Details ---
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    let y = 50;

    // Company Info (Small)
    doc.setFont('helvetica', 'bold');
    doc.text(businessName, margin, y);
    doc.setFont('helvetica', 'normal');
    if (businessAddress) {
        y += 4;
        const addrLines = doc.splitTextToSize(businessAddress, 80);
        doc.text(addrLines, margin, y);
        y += (addrLines.length * 4);
    }
    if (businessPhone) {
        doc.text(`Phone: ${businessPhone}`, margin, y);
        y += 4;
    }
    if (gstNumber) {
        doc.text(`GSTIN: ${gstNumber}`, margin, y);
        y += 6;
    }

    y += 10;
    const startBillingY = y;
    
    // Left side: Bill To
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', margin, y);
    doc.setFont('helvetica', 'normal');
    y += 7;
    doc.text(`Customer ID: ${data.id || 'N/A'}`, margin, y);
    if (data.customer || data.orgName) {
        y += 5;
        doc.text(data.customer || data.orgName, margin, y);
    }
    
    // Document Details (Right)
    let detailsY = 60;
    doc.setFont('helvetica', 'bold');
    doc.text('Document Details:', pageWidth / 2 + 10, detailsY);
    doc.setFont('helvetica', 'normal');
    detailsY += 7;
    const docDate = data.date || new Date().toLocaleDateString();
    doc.text(`Date: ${docDate}`, pageWidth / 2 + 10, detailsY);
    detailsY += 5;
    const invNo = data.invoiceNo || `INV-${Math.floor(100000 + Math.random() * 900000)}`;
    doc.text(`Invoice No: ${invNo}`, pageWidth / 2 + 10, detailsY);
    
    y = Math.max(y, detailsY) + 20;

    // --- Line Items Table ---
    const body = [];
    let subtotal = 0;

    if (data.items && Array.isArray(data.items)) {
        data.items.forEach(item => {
            const qty = item.qty || 1;
            const price = item.price || item.rate || 0;
            const total = qty * price;
            body.push([item.name || item.product, qty, `₹${price.toLocaleString()}`, `₹${total.toLocaleString()}`]);
            subtotal += total;
        });
    } else {
        const desc = data.problem || data.category || data.type || 'Service Job';
        const amt = data.fee || data.amount || 0;
        body.push([desc, 1, `₹${amt.toLocaleString()}`, `₹${amt.toLocaleString()}`]);
        subtotal = amt;
    }

    doc.autoTable({
        startY: y,
        head: [['Description', 'Qty', 'Unit Price', 'Total']],
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [15, 118, 110] }, // Teal/Cyan Accent
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 5 }
    });

    // --- Totals Section (Right Aligned) ---
    let finalY = doc.lastAutoTable.finalY + 15;
    const gstRate = 0.18;
    const gstAmt = subtotal * gstRate;
    const totalPayable = subtotal + gstAmt;

    const summaryX = pageWidth - margin - 65;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', summaryX, finalY);
    doc.text(`₹${subtotal.toLocaleString()}`, pageWidth - margin, finalY, { align: 'right' });
    
    finalY += 7;
    doc.text('GST (18%):', summaryX, finalY);
    doc.text(`₹${gstAmt.toLocaleString()}`, pageWidth - margin, finalY, { align: 'right' });
    
    finalY += 10;
    doc.setFillColor(15, 118, 110, 0.1); // Light cyan highlight
    doc.rect(summaryX - 5, finalY - 7, 70, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Total Payable:', summaryX, finalY);
    doc.text(`₹${totalPayable.toLocaleString()}`, pageWidth - margin, finalY, { align: 'right' });

    // --- Footer Disclaimers ---
    finalY += 40;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(`* ${allSettings.pdfDesc2 || 'This is a computer generated invoice. No signature required.'}`, margin, finalY);
    doc.text(`* ${allSettings.pdfDesc1 || 'Goods once sold will not be taken back.'}`, margin, finalY + 5);

    // --- Corporate Final Footer ---
    const pdfFooterY = doc.internal.pageSize.height - 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('BLUEMARK Authorized Signature', pageWidth - margin, pdfFooterY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text('DOT System Business & Support Portal', pageWidth - margin, pdfFooterY + 5, { align: 'right' });

    const fileName = `${isQuotation ? 'Quotation' : 'Invoice'}_${data.id || 'doc'}.pdf`;
    doc.save(fileName);
    
    if (window.showToast) showToast(`${isQuotation ? 'Quotation' : 'Invoice'} generated successfully!`);
}

/**
 * Generates a professional Job Card PDF for Repair Intake.
 * @param {Object} job - The repair job object.
 */
function generateJobCardPDF(job) {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;

    // Fetch Company Settings
    const allSettings = JSON.parse(localStorage.getItem('dot_system_settings') || '{}');
    const bizName = allSettings.bizName || 'DOT SYSTEM';
    const bizAddr = `${allSettings.bizAddr || ''}, ${allSettings.bizCity || ''} - ${allSettings.bizPin || ''}`;
    const bizPhone = allSettings.bizPhone || '+91 XXXXXXXXXX';
    const bizGst = allSettings.gstNum ? `GSTIN: ${allSettings.gstNum}` : 'GSTIN: NOT PROVIDED';

    // --- Header Section ---
    doc.setFillColor(15, 23, 42); // Dark Navy
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Logo (if exists)
    if (allSettings.logo) {
        try {
            doc.addImage(allSettings.logo, 'PNG', margin, 5, 30, 30);
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            doc.text(bizName.toUpperCase(), margin + 35, 20);
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(bizAddr, margin + 35, 28);
            doc.text(`Contact: ${bizPhone} | ${bizGst}`, margin + 35, 34);
        } catch (e) {
            console.error('Logo render failed', e);
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont("helvetica", "bold");
            doc.text(bizName.toUpperCase(), margin, 20);
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(bizAddr, margin, 28);
            doc.text(`Contact: ${bizPhone} | ${bizGst}`, margin, 34);
        }
    } else {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text(bizName.toUpperCase(), margin, 20);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(bizAddr, margin, 28);
        doc.text(`Contact: ${bizPhone} | ${bizGst}`, margin, 34);
    }

    // BLUEMARK Badge
    if (allSettings.showBadge !== false) {
        doc.setFillColor(16, 185, 129); // Green
        doc.roundedRect(pageWidth - 55, 12, 40, 18, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text("BLUEMARK", pageWidth - 35, 22, { align: 'center' });
        doc.setFontSize(7);
        doc.text("AUTHORIZED", pageWidth - 35, 26, { align: 'center' });
    }

    // --- Title ---
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("REPAIR JOB CARD", pageWidth / 2, 55, { align: 'center' });
    doc.setDrawColor(0, 180, 219);
    doc.setLineWidth(1);
    doc.line(pageWidth / 2 - 25, 58, pageWidth / 2 + 25, 58);

    // --- Info Grid ---
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    
    // Left Column: Customer
    doc.setFont("helvetica", "bold");
    doc.text("CUSTOMER DETAILS", margin, 75);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${job.customerName}`, margin, 82);
    doc.text(`Phone: +91 ${job.phone}`, margin, 88);
    
    // Right Column: Job Info
    doc.setFont("helvetica", "bold");
    doc.text("JOB SPECIFICATIONS", pageWidth / 2 + 10, 75);
    doc.setFont("helvetica", "normal");
    doc.text(`SR No: ${job.srNo}`, pageWidth / 2 + 10, 82);
    doc.text(`Date: ${job.createdAt?.split(',')[0]}`, pageWidth / 2 + 10, 88);
    doc.text(`Est. Completion: ${job.estCompletion || 'N/A'}`, pageWidth / 2 + 10, 94);

    // --- Device Details Table ---
    doc.autoTable({
        startY: 105,
        head: [['Device Type', 'Model / Serial', 'Reported Problem']],
        body: [[job.deviceType, job.model || 'N/A', job.deviceIssue]],
        theme: 'grid',
        headStyles: { fillColor: [0, 180, 219], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 6 }
    });

    // --- Estimate & Notes ---
    let finalY = doc.lastAutoTable.finalY + 15;
    doc.setFont("helvetica", "bold");
    doc.text("ESTIMATED QUOTE:", margin, finalY);
    doc.setFontSize(14);
    doc.setTextColor(0, 180, 219);
    doc.text(`₹${(job.price || 0).toLocaleString()}`, margin + 45, finalY);
    
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", margin, finalY + 12);
    doc.setFont("helvetica", "normal");
    const splitNotes = doc.splitTextToSize(job.comment || "No specific instructions provided.", pageWidth - 2 * margin);
    doc.text(splitNotes, margin, finalY + 18);

    // --- Terms & Conditions ---
    finalY += 45;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("TERMS & CONDITIONS:", margin, finalY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("1. Any hardware issue found during repair will be charged extra.", margin, finalY + 6);
    doc.text("2. Data backup is the responsibility of the customer. We are not liable for data loss.", margin, finalY + 11);
    doc.text("3. Estimate valid for 7 days. Devices not collected within 30 days will be disposed of.", margin, finalY + 16);

    // --- Signatures ---
    finalY += 50;
    doc.setDrawColor(200);
    doc.line(margin, finalY, margin + 60, finalY);
    doc.line(pageWidth - margin - 60, finalY, pageWidth - margin, finalY);
    
    doc.text("Customer Signature", margin + 10, finalY + 5);
    doc.text("Authorized Center", pageWidth - margin - 50, finalY + 5);

    // Watermark
    doc.setTextColor(240, 240, 240);
    doc.setFontSize(40);
    doc.text("DOT SYSTEM INTAKE", pageWidth / 2, doc.internal.pageSize.height / 2, { align: 'center', angle: 45 });

    doc.save(`JobCard_${job.srNo}.pdf`);
    if (window.showToast) showToast(`Job Card for ${job.srNo} generated!`);
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
    container.title = `7-Day Sales Trend: ${data.join(' → ')}`;
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
                    <span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
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
                if(window.showToast) showToast('Shortcuts: Ctrl+K (Commands), Ctrl+P (Print)', 'info');
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
document.addEventListener('DOMContentLoaded', () => {
    _injectConfirmModal();
    _injectToastContainer();
    initCurrencyFormatters();
    initBorderGlow();
    initGlobalFeatures();
});
