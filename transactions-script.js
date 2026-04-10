document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let inventory = DataController.getInventory();
    let transactions = DataController.getTransactions();
    let editingBatchId = null;

    // --- DOM Elements ---
    const ledgerList = document.getElementById('ledgerList');
    const transactionModal = document.getElementById('transactionModal');
    const transactionForm = document.getElementById('transactionForm');
    const trItemsRows = document.getElementById('trItemsRows');
    const trItemsList = document.getElementById('trItemsList');
    const trWhomInput = document.getElementById('trWhom');
    const trDateInput = document.getElementById('trDate');
    const labelWhom = document.getElementById('labelWhom');
    const stockError = document.getElementById('stockError');
    const marginWarning = document.getElementById('marginWarning');
    const typeSale = document.getElementById('typeSale');
    const typePurchase = document.getElementById('typePurchase');
    const typeService = document.getElementById('typeService');
    const confirmTrBtn = document.getElementById('confirmTrBtn');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const statSalesProfit = document.getElementById('statSalesProfit');

    const sumTotalPurchase = document.getElementById('sumTotalPurchase');
    const sumTotalSale = document.getElementById('sumTotalSale');
    const sumNetProfit = document.getElementById('sumNetProfit');

    let currentFilterType = 'All';
    let selectedTransactions = new Set();

    // --- Utilities ---
    const loadState = () => {
        inventory = DataController.getInventory();
        transactions = DataController.getTransactions();
        renderLedger();
        applyRoleRestrictions();
    };

    // Listen for cloud data updates
    window.addEventListener('dataUpdate', () => {
        loadState();
    });

    const applyRoleRestrictions = () => {
        const authData = JSON.parse(localStorage.getItem('dotsystem_auth_data') || '{}');
        const role = authData.role || 'staff';
        const name = authData.name || 'User';

        // 1. Personalized Greeting
        const welcomeText = document.querySelector('.header-title p');
        if (welcomeText) welcomeText.textContent = `Welcome back, ${name} | Role: ${role.toUpperCase()}`;

        if (role === 'staff') {
            document.body.classList.add('user-is-staff');
            
            // Hide Settings gear
            const settingsBtn = document.querySelector('.nav-gear-btn[href="settings.html"]');
            if (settingsBtn) settingsBtn.style.display = 'none';

            // Hide Restricted Nav Links
            const restrictedLinks = ['employees.html', 'amc-management.html', 'settings.html'];
            document.querySelectorAll('.nav-btn-alt').forEach(link => {
                const href = link.getAttribute('href');
                if (restrictedLinks.includes(href)) link.style.display = 'none';
            });
        }
    };

    const renderLedger = () => {
        if (!ledgerList) return;
        ledgerList.innerHTML = '';
        
        transactions = DataController.getTransactions();
        inventory = DataController.getInventory();

        // Sort by date/timestamp descending
        const sorted = [...transactions].sort((a, b) => {
            const dateA = new Date(a.timestamp || a.date);
            const dateB = new Date(b.timestamp || b.date);
            return dateB - dateA;
        });

        if (sorted.length === 0) {
            ledgerList.innerHTML = `<tr class="empty-state"><td colspan="9" style="text-align: center; padding: 4rem; color: var(--text-muted);">
                <i class="fa-solid fa-receipt" style="font-size: 2.5rem; display: block; margin-bottom: 1rem; opacity: 0.3;"></i>
                No transactions recorded yet.
            </td></tr>`;
            return;
        }

        sorted.forEach(tr => {
            const row = document.createElement('tr');
            row.className = 'fade-in';
            row.dataset.type = tr.type;
            row.dataset.date = tr.date;
            row.dataset.id = tr.id;
            
            const payMode = tr.paymentMode || 'Cash';
            const payColors = { Cash: '#10b981', UPI: '#6366f1', Card: '#3b82f6', Credit: '#f59e0b' };
            const payStyle = `background: ${payColors[payMode]}20; color: ${payColors[payMode]}; border: 1px solid ${payColors[payMode]}40;`;

            row.innerHTML = `
                <td>
                    <input type="checkbox" onchange="toggleTrSelect('${tr.id}', this)" ${selectedTransactions.has(tr.id) ? 'checked' : ''}>
                </td>
                <td>
                    <span class="type-pill val-${tr.type.toLowerCase()}">${tr.type}</span>
                </td>
                <td style="font-size: 0.82rem; font-weight: 500;">${new Date(tr.timestamp || tr.date).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})}</td>
                <td>
                    <div style="font-weight: 700;">${escapeXml(tr.itemName)}</div>
                    <div style="font-size: 0.65rem; color: var(--text-muted);">INV: #${tr.batchId || 'N/A'}</div>
                </td>
                <td style="font-size: 0.85rem; color: var(--text-muted);">${escapeXml(tr.whom)}</td>
                <td style="text-align: center; font-weight: bold;">${tr.qty}</td>
                <td style="text-align: right;">${formatCurrency(tr.rate)}</td>
                <td style="padding: 0.5rem; text-align: center;">
                    <span class="badge" style="${payStyle} padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">${payMode}</span>
                </td>
                <td style="text-align: right; font-weight: 800; color: ${tr.type === 'Sale' ? 'var(--primary)' : 'inherit'}">
                    ${formatCurrency(tr.totalValue)}
                </td>
                <td>
                    <div style="display: flex; gap: 0.4rem; justify-content: flex-end;">
                        <button class="btn-edit admin-only" onclick="editTransaction('${tr.id}')" title="Edit Batch"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="btn-edit" style="color: #6366f1; border-color: rgba(99,102,241,0.2);" onclick="generateTransactionPDF('${tr.id}')" title="Download Invoice"><i class="fa-solid fa-file-pdf"></i></button>
                    </div>
                </td>
            `;
            ledgerList.appendChild(row);
        });

        const saleProfit = DataController.getTransactionProfit();
        if (statSalesProfit) statSalesProfit.textContent = formatCurrency(saleProfit);

        if (typeof renderProfitSparkline === 'function') renderProfitSparkline();
        filterTransactions();
    };

    window.toggleTrSelect = (id, checkbox) => {
        if (checkbox.checked) selectedTransactions.add(id);
        else selectedTransactions.delete(id);
        
        const bulkBtn = document.getElementById('bulkDeleteBtn');
        const selectedCount = document.getElementById('selectedCount');
        if (bulkBtn) bulkBtn.style.display = selectedTransactions.size > 0 ? 'inline-block' : 'none';
        if (selectedCount) selectedCount.textContent = selectedTransactions.size;
    };

    window.openTransactionModal = () => {
        editingBatchId = null;
        document.getElementById('confirmTrBtn').textContent = 'Confirm Transaction';
        inventory = DataController.getInventory();
        if (trItemsList) {
            trItemsList.innerHTML = '';
            inventory.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.name;
                trItemsList.appendChild(opt);
            });
        }
        if (trDateInput) trDateInput.value = new Date().toISOString().split('T')[0];
        updateModalLabels();
        if (trItemsRows) {
            trItemsRows.innerHTML = '';
            addTrItemRow();
        }
        transactionModal.classList.add('active');
    };

    window.closeTransactionModal = () => {
        transactionModal.classList.remove('active');
        transactionForm.reset();
        editingBatchId = null;
    };

    window.addTrItemRow = () => {
        const rowId = 'tr_row_' + Math.random().toString(36).substr(2, 9);
        const div = document.createElement('div');
        div.className = 'tr-item-row';
        div.id = rowId;
        div.style = 'display: grid; grid-template-columns: 1fr 80px 100px 30px; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center;';
        
        div.innerHTML = `
            <div><input type="text" list="trItemsList" class="tr-item-name" placeholder="Item Name" required style="width:100%" onchange="autoFillRowRate('${rowId}')"></div>
            <div><input type="number" class="tr-item-qty" min="1" value="1" required style="width:100%" oninput="validateTrForm()"></div>
            <div><input type="number" class="tr-item-rate" min="0" step="0.01" required placeholder="0.00" style="width:100%" oninput="validateTrForm()"></div>
            <div><button type="button" class="btn-delete" onclick="removeTrItemRow('${rowId}')" style="color:#ef4444; background:none; border:none; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button></div>
        `;
        trItemsRows.appendChild(div);
        validateTrForm();
    };

    window.removeTrItemRow = (rowId) => {
        const rows = document.querySelectorAll('.tr-item-row');
        if (rows.length > 1) {
            document.getElementById(rowId).remove();
            validateTrForm();
        } else {
            showToast('Transaction must have at least one product.', 'error');
        }
    };

    window.autoFillRowRate = (rowId) => {
        const row = document.getElementById(rowId);
        const name = row.querySelector('.tr-item-name').value.trim();
        const rateInput = row.querySelector('.tr-item-rate');
        const item = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (item) {
            const isSale = typeSale?.checked;
            rateInput.value = isSale ? (item.sellPrice || 0) : (item.buyPrice || 0);
        }
        validateTrForm();
    };

    const updateModalLabels = () => {
        const typeValue = document.querySelector('input[name="trType"]:checked')?.value || 'Purchase';
        if (labelWhom) labelWhom.textContent = typeValue === 'Purchase' ? 'Supplier Name' : 'Customer Name';
        
        // Handle Service Description visibility/label
        const trNotesLabel = document.querySelector('label[for="trNotes"]');
        if (trNotesLabel) {
            if (typeValue === 'Service') {
                trNotesLabel.textContent = 'Service Description (Mandatory for Service)';
                document.getElementById('trNotes').placeholder = 'Describe the service provided...';
                document.getElementById('trNotes').required = true;
            } else {
                trNotesLabel.textContent = 'Internal Notes (Optional)';
                document.getElementById('trNotes').placeholder = 'Any remarks...';
                document.getElementById('trNotes').required = false;
            }
        }
    };

    const validateTrForm = () => {
        const rows = document.querySelectorAll('.tr-item-row');
        let hasStockError = false;
        let hasMarginWarning = false;
        const isSale = typeSale?.checked;

        rows.forEach(row => {
            const nameEl = row.querySelector('.tr-item-name');
            const qtyEl = row.querySelector('.tr-item-qty');
            const rateEl = row.querySelector('.tr-item-rate');
            const name = nameEl.value.trim();
            const qty = parseFloat(qtyEl.value) || 0;
            const rate = parseFloat(rateEl.value) || 0;
            const item = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
            
            if (isSale && item && qty > item.qty) { hasStockError = true; qtyEl.style.borderColor = '#ef4444'; }
            else { qtyEl.style.borderColor = ''; }
            if (isSale && item && item.buyPrice && rate <= item.buyPrice && rate > 0) hasMarginWarning = true;
        });

        if (stockError) stockError.style.display = hasStockError ? 'block' : 'none';
        if (marginWarning) marginWarning.style.display = hasMarginWarning ? 'block' : 'none';
        if (confirmTrBtn) confirmTrBtn.disabled = hasStockError && !typePurchase.checked && !typeService.checked;
    };

    window.editTransaction = (id) => {
        const tr = transactions.find(t => t.id === id);
        if (!tr) return;
        editingBatchId = tr.batchId || tr.id;
        const batchItems = tr.batchId ? transactions.filter(t => t.batchId === tr.batchId) : [tr];
        openTransactionModal();
        editingBatchId = tr.batchId || tr.id;
        document.getElementById('confirmTrBtn').textContent = 'Update Transaction';
        setTimeout(() => {
            if (trWhomInput) trWhomInput.value = tr.whom || '';
            if (trDateInput) trDateInput.value = new Date(tr.timestamp || tr.date).toISOString().split('T')[0];
            const typeRadio = document.querySelector(`input[name="trType"][value="${tr.type}"]`);
            if (typeRadio) { typeRadio.checked = true; updateModalLabels(); }
            if (trItemsRows) {
                trItemsRows.innerHTML = '';
                batchItems.forEach(item => {
                    const rowId = 'tr_row_' + Math.random().toString(36).substr(2, 9);
                    const div = document.createElement('div');
                    div.className = 'tr-item-row';
                    div.id = rowId;
                    div.style = 'display: grid; grid-template-columns: 1fr 80px 100px 30px; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center;';
                    div.innerHTML = `
                        <div><input type="text" list="trItemsList" class="tr-item-name" placeholder="Item Name" required style="width:100%" value="${escapeXml(item.itemName)}" onchange="autoFillRowRate('${rowId}')"></div>
                        <div><input type="number" class="tr-item-qty" min="1" value="${item.qty}" required style="width:100%" oninput="validateTrForm()"></div>
                        <div><input type="number" class="tr-item-rate" min="0" step="0.01" value="${item.rate}" required placeholder="0.00" style="width:100%" oninput="validateTrForm()"></div>
                        <div><button type="button" class="btn-delete" onclick="removeTrItemRow('${rowId}')" style="color:#ef4444; background:none; border:none; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button></div>
                    `;
                    trItemsRows.appendChild(div);
                });
                validateTrForm();
            }
            if (tr.notes) document.getElementById('trNotes').value = tr.notes;
            const payRadio = document.querySelector(`input[name="trPayment"][value="${tr.paymentMode || 'Cash'}"]`);
            if (payRadio) payRadio.checked = true;
        }, 100);
    };

    document.getElementsByName('trType').forEach(radio => radio.addEventListener('change', () => {
        updateModalLabels();
        document.querySelectorAll('.tr-item-row').forEach(row => autoFillRowRate(row.id));
    }));

    if (transactionForm) {
        transactionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const typeValue = document.querySelector('input[name="trType"]:checked').value;
            const paymentMode = document.querySelector('input[name="trPayment"]:checked')?.value || 'Cash';
            const notes = document.getElementById('trNotes')?.value.trim() || '';
            const whom = trWhomInput?.value.trim();
            const customDate = trDateInput?.value;

            const rows = document.querySelectorAll('.tr-item-row');
            const batchId = editingBatchId || DataController.getNextInvoiceNumber();
            
            // If editing, revert previous entries first
            if (editingBatchId) {
                DataController.revertBatch(editingBatchId);
            }
            
            let successCount = 0;
            rows.forEach(row => {
                const itemName = row.querySelector('.tr-item-name').value.trim();
                const qty = parseFloat(row.querySelector('.tr-item-qty').value);
                const rate = parseFloat(row.querySelector('.tr-item-rate').value || 0);

                if (itemName && qty > 0) {
                    const item = inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
                    const itemId = item ? item.id : 'NEW_ITEM';

                    DataController.updateStock(itemId, typeValue, qty, { 
                        paymentMode, 
                        notes, 
                        rate, 
                        itemName: itemName, 
                        whom: whom,
                        customDate: customDate,
                        batchId: batchId,
                        allowNegative: true 
                    });
                    successCount++;
                }
            });

            if (successCount > 0) {
                closeTransactionModal();
                renderLedger();
                showToast(`Invoice #${batchId} generated with ${successCount} products.`);
            }
        });
    }

    if (dateFromInput) dateFromInput.addEventListener('change', renderLedger);
    if (dateToInput) dateToInput.addEventListener('change', renderLedger);

    window.filterTransactions = () => {
        const query = document.getElementById('transactionSearch')?.value.toLowerCase() || '';
        const rows = document.querySelectorAll('#ledgerList tr:not(.empty-state)');
        const from = dateFromInput?.value ? new Date(dateFromInput.value) : null;
        const to = dateToInput?.value ? new Date(dateToInput.value) : null;

        if (from) from.setHours(0,0,0,0);
        if (to) to.setHours(23,59,59,999);

        let totalPurchase = 0;
        let totalSale = 0;

        rows.forEach(row => {
            const trDate = new Date(row.dataset.date);
            const type = row.dataset.type;
            const text = row.innerText.toLowerCase();

            const matchesSearch = text.includes(query);
            const matchesType = currentFilterType === 'All' || type === currentFilterType;
            const matchesDate = (!from || trDate >= from) && (!to || trDate <= to);
            
            const isVisible = matchesSearch && matchesType && matchesDate;
            row.style.display = isVisible ? '' : 'none';

            if (isVisible) {
                const valStr = row.cells[8]?.textContent.replace(/[^-0-9.]/g, '');
                const val = parseFloat(valStr) || 0;
                if (type === 'Sale') totalSale += val;
                else if (type === 'Purchase') totalPurchase += val;
            }
        });

        if (sumTotalPurchase) sumTotalPurchase.textContent = formatCurrency(totalPurchase);
        if (sumTotalSale) sumTotalSale.textContent = formatCurrency(totalSale);
        if (sumNetProfit) {
            const net = totalSale - totalPurchase;
            sumNetProfit.textContent = formatCurrency(net);
            sumNetProfit.className = `value ${net >= 0 ? 'text-green' : 'text-red'}`;
        }
    };

    window.generateTransactionPDF = (id) => {
        const tr = transactions.find(t => t.id === id);
        if (!tr) return;
        const batchItems = tr.batchId ? transactions.filter(t => t.batchId === tr.batchId) : [tr];
        
        const data = {
            invoiceNo: tr.batchId || tr.id.split('_').pop(),
            date: tr.date,
            customer: tr.whom,
            whom: tr.whom,
            type: tr.type,
            paymentMode: tr.paymentMode || 'Cash',
            notes: tr.notes || '',
            items: batchItems.map(item => ({
                product: item.itemName,
                qty: item.qty,
                price: item.rate,
                total: item.totalValue
            })),
            total: batchItems.reduce((sum, item) => sum + item.totalValue, 0)
        };
        
        if (window.generatePDF) generatePDF(tr.type === 'Purchase' ? 'Purchase Invoice' : 'Tax Invoice', data);
    };

    function escapeXml(unsafe) {
        if (!unsafe) return '';
        return unsafe.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }

    renderLedger();
});
