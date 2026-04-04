document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let inventory = DataController.getInventory();
    let transactions = DataController.getTransactions();

    // --- DOM Elements ---
    const ledgerList = document.getElementById('ledgerList');
    const transactionModal = document.getElementById('transactionModal');
    const transactionForm = document.getElementById('transactionForm');
    const statSalesProfit = document.getElementById('statSalesProfit');
    const trItemsList = document.getElementById('trItemsList');
    const sumTotalPurchase = document.getElementById('sumTotalPurchase');
    const sumTotalSale = document.getElementById('sumTotalSale');
    const sumNetProfit = document.getElementById('sumNetProfit');
    const trItemsRows = document.getElementById('trItemsRows');
    const trWhomInput = document.getElementById('trWhom');
    const trDateInput = document.getElementById('trDate');
    const labelWhom = document.getElementById('labelWhom');
    const stockError = document.getElementById('stockError');
    const marginWarning = document.getElementById('marginWarning');
    const typeSale = document.getElementById('typeSale');
    const typeService = document.getElementById('typeService');
    const typePurchase = document.getElementById('typePurchase');
    const confirmTrBtn = document.getElementById('confirmTrBtn');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const transactionSearch = document.getElementById('transactionSearch');
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    const selectedCountSpan = document.getElementById('selectedCount');

    let currentFilterType = 'All';
    let selectedTransactions = new Set();
    let editingBatchId = null;

    // --- Utilities ---
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const escapeXml = (unsafe) => {
        if (!unsafe) return "";
        return unsafe.toString().replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    };

    // --- Core logic ---

    const renderLedger = () => {
        if (!ledgerList) return;
        transactions = DataController.getTransactions();
        ledgerList.innerHTML = '';
        
        if (transactions.length === 0) {
            ledgerList.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fa-solid fa-inbox" style="display: block; font-size: 2rem; margin-bottom: 1rem; opacity: 0.2;"></i> No transactions logged yet.</td></tr>`;
            if (sumTotalPurchase) sumTotalPurchase.textContent = formatCurrency(0);
            if (sumTotalSale) sumTotalSale.textContent = formatCurrency(0);
            if (sumNetProfit) sumNetProfit.textContent = formatCurrency(0);
            return;
        }

        transactions.forEach(tr => {
            const row = document.createElement('tr');
            row.className = tr.type === 'Sale' ? 'ledger-sale' : 'ledger-purchase';
            row.dataset.type = tr.type;
            row.dataset.date = tr.date;
            row.dataset.id = tr.id;
            
            // Margin Calculation
            let marginText = '<span style="opacity: 0.3;">—</span>';
            let marginStyle = 'opacity: 0.5;';
            if (tr.type === 'Sale') {
                const item = inventory.find(i => i.name === tr.itemName) || {};
                const buyRate = item.buyPrice || 0;
                if (buyRate > 0) {
                    const margin = ((tr.rate - buyRate) / tr.rate) * 100;
                    marginText = `${margin.toFixed(1)}%`;
                    marginStyle = `color: ${margin >= 0 ? '#10b981' : '#ef4444'}; font-weight: 700;`;
                }
            }

            // Payment mode badge
            const payMode = tr.paymentMode || 'Cash';
            const payColors = { Cash: '#10b981', UPI: '#6366f1', Card: '#3b82f6', Credit: '#f59e0b' };
            const payColor = payColors[payMode] || '#6b7280';

            row.innerHTML = `
                <td><input type="checkbox" class="tr-checkbox" onchange="toggleTrSelect('${tr.id}', this)"></td>
                <td>${tr.date}</td>
                <td><div style="font-weight: 600;">${escapeXml(tr.whom || 'N/A')}</div></td>
                <td>
                    <strong>${escapeXml(tr.itemName)}</strong>
                    ${tr.notes ? `<div style="font-size: 0.75rem; opacity: 0.6; margin-top: 2px;"><i class="fa-solid fa-note-sticky"></i> ${escapeXml(tr.notes)}</div>` : ''}
                </td>
                <td><span class="type-badge ${tr.type.toLowerCase()}">${tr.type}</span></td>
                <td>${tr.qty} Nos</td>
                <td>${formatCurrency(tr.rate)}</td>
                <td><span style="font-size: 0.8rem; font-weight: 600; color: ${payColor};">${payMode}</span></td>
                <td style="font-weight: 600;">${formatCurrency(tr.totalValue)}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem; justify-content: center;">
                        <button class="btn-edit" onclick="editTransaction('${tr.id}')" title="Edit Batch">
                            <i class="fa-solid fa-pen-to-square" style="color: #6366f1;"></i>
                        </button>
                        <button class="btn-edit" onclick="downloadInvoice('${tr.id}')" title="Download Tax Invoice">
                            <i class="fa-solid fa-file-invoice" style="color: #ec4899;"></i>
                        </button>
                        <button class="btn-edit" onclick="duplicateTransaction('${tr.id}')" title="Duplicate Transaction">
                            <i class="fa-solid fa-copy" style="color: var(--primary);"></i>
                        </button>
                    </div>
                </td>
            `;
            ledgerList.appendChild(row);
        });

        // Update top profit stat
        const saleProfit = DataController.getTransactionProfit();
        if (statSalesProfit) {
            statSalesProfit.textContent = formatCurrency(saleProfit);
            statSalesProfit.style.color = saleProfit >= 0 ? '#10b981' : '#ef4444';
        }

        // Draw profit sparkline from last 6 months
        renderProfitSparkline();

        // Initial filter & summary
        filterTransactions();
        renderMonthlyPnL();
    };

    const renderMonthlyPnL = () => {
        const now = new Date();
        let monthPurchases = 0;
        let monthSales = 0;
        
        transactions.forEach(tr => {
            const trDate = new Date(tr.timestamp || tr.date);
            if (trDate.getMonth() === now.getMonth() && trDate.getFullYear() === now.getFullYear()) {
                if (tr.type === 'Sale') monthSales += tr.totalValue;
                else if (tr.type === 'Purchase') monthPurchases += tr.totalValue;
            }
        });
        
        const netProfit = monthSales - monthPurchases;
        const gst = monthSales * 0.18;
        
        const mpEl = document.getElementById('monthlyPurchases');
        const msEl = document.getElementById('monthlySales');
        const mnpEl = document.getElementById('monthlyNetProfit');
        const gstEl = document.getElementById('monthlyGST');
        
        if (mpEl) mpEl.textContent = formatCurrency(monthPurchases);
        if (msEl) msEl.textContent = formatCurrency(monthSales);
        if (mnpEl) { mnpEl.textContent = formatCurrency(netProfit); mnpEl.style.color = netProfit >= 0 ? '#10b981' : '#ef4444'; }
        if (gstEl) gstEl.textContent = formatCurrency(gst);
    };

    const renderProfitSparkline = () => {
        const container = document.getElementById('profitSparkline');
        if (!container) return;

        const now = new Date();
        const points = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthSales = transactions
                .filter(t => t.type === 'Sale' && new Date(t.timestamp || t.date).getMonth() === d.getMonth() && new Date(t.timestamp || t.date).getFullYear() === d.getFullYear())
                .reduce((s, t) => s + (t.totalValue || 0), 0);
            points.push(monthSales);
        }

        const max = Math.max(...points, 1);
        const w = 100, h = 30;
        const pts = points.map((v, i) => `${(i / (points.length - 1)) * w},${h - (v / max) * (h - 4)}`).join(' ');
        
        const trend = points[5] >= points[0];
        const color = trend ? '#10b981' : '#ef4444';

        container.innerHTML = `
            <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
                <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
                <circle cx="${w}" cy="${h - (points[5]/max)*(h-4)}" r="3" fill="${color}"/>
            </svg>
        `;
    };

    // --- Bulk Delete ---
    window.toggleTrSelect = (id, checkbox) => {
        if (checkbox.checked) {
            selectedTransactions.add(id);
        } else {
            selectedTransactions.delete(id);
        }
        updateBulkDeleteUI();
    };

    window.toggleAllTransactions = (masterCheckbox) => {
        const checkboxes = document.querySelectorAll('.tr-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = masterCheckbox.checked;
            const id = cb.closest('tr')?.dataset.id;
            if (id) {
                if (masterCheckbox.checked) selectedTransactions.add(id);
                else selectedTransactions.delete(id);
            }
        });
        updateBulkDeleteUI();
    };

    const updateBulkDeleteUI = () => {
        const count = selectedTransactions.size;
        if (bulkDeleteBtn) bulkDeleteBtn.style.display = count > 0 ? 'inline-flex' : 'none';
        if (selectedCountSpan) selectedCountSpan.textContent = count;
    };

    window.deleteSelectedTransactions = async () => {
        if (selectedTransactions.size === 0) return;
        const confirmed = await showConfirm({
            title: `Delete ${selectedTransactions.size} Transaction(s)?`,
            message: 'This will permanently remove them. Stock quantities will NOT be adjusted.',
            confirmText: 'Delete All',
            confirmIcon: 'fa-trash',
            type: 'danger'
        });
        if (!confirmed) return;

        let allTr = DataController.getTransactions();
        allTr = allTr.filter(t => !selectedTransactions.has(t.id));
        DataController.saveTransactions(allTr);
        selectedTransactions.clear();
        transactions = allTr;
        renderLedger();
        showToast(`Deleted transactions removed.`);
    };

    window.setFilterType = (type, btn) => {
        currentFilterType = type;
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        filterTransactions();
    };

    window.filterTransactions = () => {
        const query = transactionSearch.value.toLowerCase();
        const dateFrom = dateFromInput.value;
        const dateTo = dateToInput.value;
        const rows = document.querySelectorAll('#ledgerList tr');

        let totalPurchase = 0;
        let totalSale = 0;
        let visibleCount = 0;

        rows.forEach(row => {
            if (row.cells.length < 5) return; // Skip empty state

            const type = row.dataset.type;
            const dateStr = row.dataset.date;
            const text = row.innerText.toLowerCase();

            // Criteria checks
            const matchesSearch = text.includes(query);
            const matchesType = currentFilterType === 'All' || type === currentFilterType;
            
            let matchesDate = true;
            if (dateFrom && dateStr < dateFrom) matchesDate = false;
            if (dateTo && dateStr > dateTo) matchesDate = false;

            const isVisible = matchesSearch && matchesType && matchesDate;
            row.style.display = isVisible ? '' : 'none';

            if (isVisible) {
                visibleCount++;
        const rowParent = row.cells[5]?.textContent;
        const valStr = row.cells[7]?.textContent.replace(/[^-0-9.]/g, '');
        const val = parseFloat(valStr) || 0;
        if (type === 'Sale') totalSale += val;
        else if (type === 'Purchase') totalPurchase += val;
            }
        });

        // Update Summary Bar
        if (sumTotalPurchase) sumTotalPurchase.textContent = formatCurrency(totalPurchase);
        if (sumTotalSale) sumTotalSale.textContent = formatCurrency(totalSale);
        if (sumNetProfit) {
            const net = totalSale - totalPurchase;
            sumNetProfit.textContent = formatCurrency(net);
            sumNetProfit.style.color = net >= 0 ? '#10b981' : '#ef4444';
        }
    };

    window.openTransactionModal = () => {
        editingBatchId = null; // Clear edit state
        document.getElementById('confirmTrBtn').textContent = 'Confirm Transaction';
        inventory = DataController.getInventory();
        if (trItemsList) {
            trItemsList.innerHTML = '';
            inventory.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.name;
                opt.dataset.id = item.id;
                trItemsList.appendChild(opt);
            });
        }
        
        if (trDateInput) {
            trDateInput.value = new Date().toISOString().split('T')[0];
        }

        updateModalLabels();
        
        if (trItemsRows) {
            trItemsRows.innerHTML = '';
            addTrItemRow(); // Start with one row
        }

        transactionModal.classList.add('active');
    };

    window.addTrItemRow = () => {
        const rowId = 'tr_row_' + Date.now() + Math.floor(Math.random()*100);
        const div = document.createElement('div');
        div.className = 'tr-item-row';
        div.id = rowId;
        div.style = 'display: grid; grid-template-columns: 1fr 80px 100px 30px; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center;';
        
        div.innerHTML = `
            <div>
                <input type="text" list="trItemsList" class="tr-item-name" placeholder="Item Name" required style="width:100%" onchange="autoFillRowRate('${rowId}')">
            </div>
            <div>
                <input type="number" class="tr-item-qty" min="1" value="1" required style="width:100%" oninput="validateTrForm()">
            </div>
            <div>
                <input type="number" class="tr-item-rate" min="0" step="0.01" required placeholder="0.00" style="width:100%" oninput="validateTrForm()">
            </div>
            <div>
                <button type="button" class="btn-delete" onclick="removeTrItemRow('${rowId}')" style="color:#ef4444; background:none; border:none; cursor:pointer;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
        trItemsRows.appendChild(div);
        validateTrForm();
    };

    window.removeTrItemRow = (id) => {
        if (trItemsRows.children.length > 1) {
            document.getElementById(id).remove();
            validateTrForm();
        } else {
            showToast('Order must have at least one item.', 'error');
        }
    };

    window.autoFillRowRate = (rowId) => {
        const row = document.getElementById(rowId);
        const name = row.querySelector('.tr-item-name').value.trim();
        const rateInput = row.querySelector('.tr-item-rate');
        
        const item = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
        if (item) {
            const isSale = typeSale?.checked;
            rateInput.value = isSale ? (item.price || 0) : (item.buyPrice || 0);
        }
        validateTrForm();
    };

    const updateModalLabels = () => {
        const type = document.querySelector('input[name="trType"]:checked')?.value || 'Purchase';
        if (labelWhom) {
            labelWhom.textContent = type === 'Purchase' ? 'Supplier Name' : 'Customer Name';
        }
    };

    window.closeTransactionModal = () => {
        transactionModal.classList.remove('active');
        transactionForm.reset();
        if (stockError) stockError.style.display = 'none';
        if (marginWarning) marginWarning.style.display = 'none';
        confirmTrBtn.disabled = false;
    };

    window.duplicateTransaction = (id) => {
        const tr = transactions.find(t => t.id === id);
        if (!tr) return;
        
        openTransactionModal();
        
        setTimeout(() => {
            const typeRadio = document.querySelector(`input[name="trType"][value="${tr.type}"]`);
            if (typeRadio) {
                typeRadio.checked = true;
                updateModalLabels();
            }
            
            if (trWhomInput) trWhomInput.value = tr.whom || '';
            if (trDateInput) trDateInput.value = new Date(tr.timestamp || tr.date).toISOString().split('T')[0];
            
            const firstRow = trItemsRows.querySelector('.tr-item-row');
            if (firstRow) {
                firstRow.querySelector('.tr-item-name').value = tr.itemName;
                firstRow.querySelector('.tr-item-qty').value = tr.qty;
                firstRow.querySelector('.tr-item-rate').value = tr.rate;
            }
            
            validateTrForm();
        }, 100);
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
            
            if (isSale && item && qty > item.qty) {
                hasStockError = true;
                qtyEl.style.borderColor = '#ef4444';
            } else {
                qtyEl.style.borderColor = '';
            }

            if (isSale && item && item.buyPrice && rate <= item.buyPrice && rate > 0) {
                hasMarginWarning = true;
            }
        });

        if (stockError) stockError.style.display = hasStockError ? 'block' : 'none';
        if (marginWarning) marginWarning.style.display = hasMarginWarning ? 'block' : 'none';
        
        confirmTrBtn.disabled = hasStockError && !typePurchase.checked;
    };

    window.editTransaction = (id) => {
        const tr = transactions.find(t => t.id === id);
        if (!tr) return;
        
        editingBatchId = tr.batchId;
        const batchItems = tr.batchId ? transactions.filter(t => t.batchId === tr.batchId) : [tr];
        
        openTransactionModal();
        editingBatchId = tr.batchId; // Reset after openTransactionModal clears it
        document.getElementById('confirmTrBtn').textContent = 'Update Transaction';
        
        setTimeout(() => {
            // Header
            if (trWhomInput) trWhomInput.value = tr.whom || '';
            if (trDateInput) trDateInput.value = new Date(tr.timestamp || tr.date).toISOString().split('T')[0];
            const typeRadio = document.querySelector(`input[name="trType"][value="${tr.type}"]`);
            if (typeRadio) typeRadio.checked = true;
            updateModalLabels();

            // Items
            if (trItemsRows) {
                trItemsRows.innerHTML = '';
                batchItems.forEach(item => {
                    const rowId = 'tr_row_' + Math.random().toString(36).substr(2, 9);
                    const div = document.createElement('div');
                    div.className = 'tr-item-row';
                    div.id = rowId;
                    div.style = 'display: grid; grid-template-columns: 1fr 80px 100px 30px; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center;';
                    div.innerHTML = `
                        <div>
                            <input type="text" list="trItemsList" class="tr-item-name" placeholder="Item Name" required style="width:100%" value="${escapeXml(item.itemName)}" onchange="autoFillRowRate('${rowId}')">
                        </div>
                        <div>
                            <input type="number" class="tr-item-qty" min="1" value="${item.qty}" required style="width:100%" oninput="validateTrForm()">
                        </div>
                        <div>
                            <input type="number" class="tr-item-rate" min="0" step="0.01" value="${item.rate}" required placeholder="0.00" style="width:100%" oninput="validateTrForm()">
                        </div>
                        <div>
                            <button type="button" class="btn-delete" onclick="removeTrItemRow('${rowId}')" style="color:#ef4444; background:none; border:none; cursor:pointer;">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    `;
                    trItemsRows.appendChild(div);
                });
                validateTrForm();
            }
        }, 100);
    };

    const trTypeRadios = document.getElementsByName('trType');
    trTypeRadios.forEach(radio => radio.addEventListener('change', () => {
        updateModalLabels();
        // Update all prices if type changes
        document.querySelectorAll('.tr-item-row').forEach(row => {
            autoFillRowRate(row.id);
        });
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
                        batchId: batchId, // Link them all!
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

    window.downloadInvoice = (id) => {
        const tr = transactions.find(t => t.id === id);
        if (!tr) return;

        let batchItems = [];
        if (tr.batchId) {
            // Find all siblings in the batch
            batchItems = transactions.filter(t => t.batchId === tr.batchId);
        } else {
            batchItems = [tr];
        }

        const first = batchItems[0];
        generatePDF('Invoice', {
            invoiceNo: first.batchId || first.id.substring(3, 8),
            orgName: first.whom || 'Customer',
            items: batchItems.map(i => ({
                product: i.itemName,
                qty: i.qty,
                price: i.rate
            })),
            date: first.date,
            type: first.type
        });
    };

    // --- Initial Load ---
    renderLedger();
});
