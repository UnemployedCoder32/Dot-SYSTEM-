document.addEventListener('DOMContentLoaded', () => {
    const inventoryForm = document.getElementById('inventoryForm');
    const inventoryList = document.getElementById('inventoryList');
    const emptyState = document.getElementById('emptyState');
    const inventoryFooter = document.getElementById('inventoryFooter');
    const totalItemsBadge = document.getElementById('totalItems');
    const totalValueEl = document.getElementById('totalValue');
    const exportVoucherBtn = document.getElementById('exportVoucherBtn');
    const importTallyBtn = document.getElementById('importTallyBtn');
    const importTallyInput = document.getElementById('importTallyInput');
    const submitBtn = inventoryForm ? inventoryForm.querySelector('button[type="submit"]') : null;
    const setBtnLoading = async (btnId, isLoading) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        if (isLoading) {
            btn.classList.add('loading');
            btn.closest('.sync-toolset')?.classList.add('processing');
            btn.disabled = true;
        } else {
            // Slight delay for "smoothing" even if operation was instant
            await new Promise(r => setTimeout(r, 600)); 
            btn.classList.remove('loading');
            btn.closest('.sync-toolset')?.classList.remove('processing');
            btn.disabled = false;
        }
    };

    // --- Tally Integration ---
    window.generateTallyXml = async (type) => {
        const btnId = type === 'Voucher' ? 'exportVoucherBtn' : 'exportBtn';
        await setBtnLoading(btnId, true);
        await new Promise(r => setTimeout(r, 800));

        let xmlStr = "";
        const date = new Date().toISOString().split('T')[0].replace(/-/g, '');

        if (type === 'Masters') {
            xmlStr = `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC><REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF">`;
            inventory.forEach(item => {
                const openingValue = -(item.qty * item.price);
                xmlStr += `<STOCKITEM NAME="${escapeXml(item.name)}" ACTION="Create"><NAME>${escapeXml(item.name)}</NAME><BASEUNITS>Nos</BASEUNITS><OPENINGBALANCE>${item.qty} Nos</OPENINGBALANCE><OPENINGVALUE>${openingValue}</OPENINGVALUE><OPENINGRATE>${item.price}/Nos</OPENINGRATE></STOCKITEM>`;
            });
            xmlStr += `</TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
            downloadFile(xmlStr, 'Tally_Masters.xml');
        } else if (type === 'Voucher') {
            const totalVal = inventory.reduce((sum, item) => sum + (item.qty * item.price), 0);
            xmlStr = `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC><REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice View"><DATE>${date}</DATE><VOUCHERTYPENAME>Sales</VOUCHERTYPENAME><PARTYLEDGERNAME>Cash</PARTYLEDGERNAME><PERSISTEDVIEW>Invoice View</PERSISTEDVIEW><ALLLEDGERENTRIES.LIST><LEDGERNAME>Cash</LEDGERNAME><ISPARTYLEDGER>Yes</ISPARTYLEDGER><AMOUNT>-${totalVal}</AMOUNT></ALLLEDGERENTRIES.LIST><ALLLEDGERENTRIES.LIST><LEDGERNAME>Sales Accounts</LEDGERNAME><AMOUNT>${totalVal}</AMOUNT></ALLLEDGERENTRIES.LIST>`;
            inventory.forEach(item => {
                xmlStr += `<ALLINVENTORYENTRIES.LIST><STOCKITEMNAME>${escapeXml(item.name)}</STOCKITEMNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><ACTUALQTY>${item.qty} Nos</ACTUALQTY><BILLEDQTY>${item.qty} Nos</BILLEDQTY><RATE>${item.price}/Nos</RATE><AMOUNT>${item.qty * item.price}</AMOUNT></ALLINVENTORYENTRIES.LIST>`;
            });
            xmlStr += `</VOUCHER></TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
            downloadFile(xmlStr, 'Tally_Sales.xml');
        }

        await setBtnLoading(btnId, false);
        showToast(`${type} exported for Tally Prime.`);
    };

    // --- Excel System Enhancements ---
    window.ExcelSystem = {
        ...window.ExcelSystem,
        exportAll: async function() {
            await setBtnLoading('exportExcelBtn', true);
            await new Promise(r => setTimeout(r, 1000));
            // Actual export logic...
            DataController.getInventory().length > 0 ? this.originalExport() : showToast('No data to export', 'error');
            await setBtnLoading('exportExcelBtn', false);
        },
        handleImport: async function(event) {
            await setBtnLoading('importExcelBtn', true);
            // Actual import logic...
            await this.originalImport(event);
            await setBtnLoading('importExcelBtn', false);
        }
    };

    window.exportData = async () => {
        await setBtnLoading('backupBtn', true);
        DataController.exportFullBackup();
        await setBtnLoading('backupBtn', false);
        showToast('System backup saved to computer.');
    };

    let editingId = null;
    let inventory = DataController.getInventory();
    let suppliers = DataController.getSuppliers();
    let charts = {
        revenue: null,
        health: null
    };

    // --- Theme / Custom Events ---
    window.addEventListener('themeChanged', () => {
        initAnalyticsCharts();
    });

    // --- Data Persistence ---
    const saveState = () => {
        DataController.saveInventory(inventory);
        DataController.saveSuppliers(suppliers);
    };

    const loadState = () => {
        inventory = DataController.getInventory();
        suppliers = DataController.getSuppliers();
        renderInventory();
        renderSuppliers();
        
        // Enable Search on Supplier Hub
        if (window.makeSearchableSelect) {
            makeSearchableSelect('partSupplier', 'Search Suppliers...');
        }
    };

    // Listen for cloud data updates
    window.addEventListener('dataUpdate', () => {
        loadState();
    });

    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    // Escape XML special characters
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

    // Helper: Get Last Sold Date for a SKU
    const getLastSoldDate = (sku) => {
        if (!sku) return 'Never';
        const transactions = DataController.getTransactions() || [];
        const sales = transactions.filter(t => t.type === 'Sale' && t.itemName === sku);
        if (sales.length === 0) return 'Never';
        
        // Find latest date
        const dates = sales.map(t => new Date(t.date));
        const latest = new Date(Math.max(...dates));
        return latest.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    };

    // Add Item
    if (inventoryForm) {
        inventoryForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const skuInput = document.getElementById('partSku');
            const skuValue = (skuInput.value || '').trim().toUpperCase();
            const skuError = document.getElementById('sku-error');

            // SKU Duplicate Validation
            const isDuplicate = inventory.some(item => item.sku === skuValue && item.id !== editingId);
            if (isDuplicate && skuValue !== "") {
                if (skuError) skuError.style.display = 'block';
                skuInput.focus();
                return;
            } else {
                if (skuError) skuError.style.display = 'none';
            }

            const nameInput = document.getElementById('partName');
            const qtyInput = document.getElementById('quantity');
            const buyPriceInput = document.getElementById('buyPrice');
            const priceInput = document.getElementById('price');
            const minStockInput = document.getElementById('minStock');
            const supplierSelect = document.getElementById('partSupplier');

            const itemData = {
                sku: (document.getElementById('partSku').value || '').trim().toUpperCase(),
                name: (nameInput.value || 'Unnamed Product').trim(),
                qty: Math.max(0, parseFloat(qtyInput.value) || 0),
                minStock: Math.max(0, parseFloat(minStockInput.value) || 0),
                buyPrice: Math.max(0, parseFloat(buyPriceInput.dataset.rawValue || buyPriceInput.value) || 0),
                price: Math.max(0, parseFloat(priceInput.dataset.rawValue || priceInput.value) || 0),
                supplier: supplierSelect ? supplierSelect.value : ''
            };

            if (editingId) {
                // Update mode
                const index = inventory.findIndex(item => item.id === editingId);
                if (index !== -1) {
                    inventory[index] = { ...inventory[index], ...itemData };
                }
                editingId = null;
                submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add to Inventory';
                addItemSection.classList.remove('editing-mode');
            } else {
                // Add mode with Deduplication (Check SKU first, then Name)
                const existingIndex = inventory.findIndex(i => {
                    if (itemData.sku && i.sku === itemData.sku) return true;
                    return i.name.toLowerCase() === itemData.name.toLowerCase();
                });
                if (existingIndex !== -1) {
                    // Merge quantities
                    inventory[existingIndex].qty += itemData.qty;
                    // Update prices if they are different (Keep latest)
                    inventory[existingIndex].price = itemData.price;
                    inventory[existingIndex].buyPrice = itemData.buyPrice;
                    inventory[existingIndex].minStock = itemData.minStock;
                    inventory[existingIndex].supplier = itemData.supplier;
                } else {
                    const item = {
                        id: Date.now().toString(),
                        addedAt: Date.now(),
                        ...itemData
                    };
                    inventory.push(item);
                }
            }
            
            saveState();
            
            // Reset form
            inventoryForm.reset();
            const infoBox = document.getElementById('supplier-info-box');
            if (infoBox) infoBox.style.display = 'none';
            nameInput.focus();

            renderInventory();
            showToast(editingId ? 'Product info updated!' : 'New product added to inventory!');
        });
    }

    // Edit Item
    window.editItem = (id) => {
        const item = inventory.find(i => i.id === id);
        if (!item) return;

        editingId = id;
        if (document.getElementById('partSku')) document.getElementById('partSku').value = item.sku || '';
        if (document.getElementById('partName')) document.getElementById('partName').value = item.name;
        if (document.getElementById('quantity')) document.getElementById('quantity').value = item.qty;
        if (document.getElementById('minStock')) document.getElementById('minStock').value = item.minStock;
        if (document.getElementById('buyPrice')) document.getElementById('buyPrice').value = item.buyPrice || 0;
        if (document.getElementById('price')) document.getElementById('price').value = item.price;
        if (document.getElementById('partSupplier')) document.getElementById('partSupplier').value = item.supplier || '';

        if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-save"></i> Update Part Info';
        if (addItemSection) addItemSection.classList.add('editing-mode');
        
        // Show supplier info if exists
        const supplierSelect = document.getElementById('partSupplier');
        if (supplierSelect) supplierSelect.dispatchEvent(new Event('change'));
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Delete Item
    window.deleteItem = async (id) => {
        const confirmed = await showConfirm({
            title: 'Remove Inventory Item?',
            message: 'This will permanently remove this item from your inventory. This action cannot be undone.',
            confirmText: 'Remove',
            confirmIcon: 'fa-box-open',
            type: 'danger'
        });
        if (confirmed) {
            if (editingId === id) {
                editingId = null;
                if (inventoryForm) inventoryForm.reset();
                if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add to Inventory';
                if (addItemSection) addItemSection.classList.remove('editing-mode');
            }
            inventory = inventory.filter(item => item.id !== id);
            saveState();
            renderInventory();
            showToast('Item removed from inventory.', 'info');
        }
    };

    // Supplier Info Logic
    const partSupplierSelect = document.getElementById('partSupplier');
    const supplierInfoBox = document.getElementById('supplier-info-box');
    const gstinEl = document.getElementById('supplier-gstin');
    const phoneEl = document.getElementById('supplier-phone');

    if (partSupplierSelect) {
        partSupplierSelect.addEventListener('change', () => {
            const selectedSupplierName = partSupplierSelect.value;
            const supplier = suppliers.find(s => s.name === selectedSupplierName);

            if (supplier && supplierInfoBox) {
                if (gstinEl) gstinEl.textContent = `GSTIN: ${supplier.gstin || '--'}`;
                if (phoneEl) phoneEl.textContent = `Phone: ${supplier.phone || '--'}`;
                supplierInfoBox.style.display = 'block';
            } else if (supplierInfoBox) {
                supplierInfoBox.style.display = 'none';
            }
        });
    }

    // --- Bulk Edit System ---
    let isBulkEditMode = false;

    window.toggleBulkEdit = () => {
        isBulkEditMode = !isBulkEditMode;
        const bulkToggleBtn = document.getElementById('bulkEditToggle');
        const bulkSaveBtn = document.getElementById('bulkSaveBtn');
        
        if (isBulkEditMode) {
            bulkToggleBtn.classList.add('active', 'btn-primary');
            bulkToggleBtn.classList.remove('btn-outline');
            bulkToggleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editing...';
            bulkSaveBtn.style.display = 'inline-flex';
        } else {
            bulkToggleBtn.classList.remove('active', 'btn-primary');
            bulkToggleBtn.classList.add('btn-outline');
            bulkToggleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Bulk Edit';
            bulkSaveBtn.style.display = 'none';
        }
        
        renderInventory();
    };

    window.saveBulkEdit = () => {
        const rows = document.querySelectorAll('#inventoryList tr.fade-in');
        rows.forEach(row => {
            const id = row.dataset.id;
            const item = inventory.find(i => i.id === id);
            if (!item) return;

            const qtyInput = row.querySelector('.bulk-qty');
            const minStockInput = row.querySelector('.bulk-min');
            const rateInput = row.querySelector('.bulk-rate');
            
            if (qtyInput) item.qty = Math.max(0, parseFloat(qtyInput.value) || 0);
            if (minStockInput) item.minStock = Math.max(0, parseFloat(minStockInput.value) || 0);
            if (rateInput) item.price = Math.max(0, parseFloat(rateInput.value) || 0);
        });

        saveState();
        isBulkEditMode = false;
        
        document.getElementById('bulkEditToggle').classList.remove('active', 'btn-primary');
        document.getElementById('bulkEditToggle').classList.add('btn-outline');
        document.getElementById('bulkEditToggle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Bulk Edit';
        document.getElementById('bulkSaveBtn').style.display = 'none';
        
        showToast('Bulk edited inventory saved!');
        renderInventory();
    };

    // Render Table
    const renderInventory = () => {
        if (!inventoryList) return;

        if (inventory.length === 0) {
            inventoryList.innerHTML = '';
            if (emptyState) inventoryList.appendChild(emptyState);
            if (inventoryFooter) inventoryFooter.style.display = 'none';
            const exportBtn = document.getElementById('exportBtn');
            if (exportBtn) exportBtn.disabled = true;
            if (exportVoucherBtn) exportVoucherBtn.disabled = true;
            if (totalItemsBadge) totalItemsBadge.textContent = '0 Items';
            return;
        }

        inventoryList.innerHTML = '';
        let totalVal = 0;

        inventory.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'fade-in';
            tr.style.animationDelay = `${index * 0.05}s`;
            
            const buyPrice = parseFloat(item.buyPrice) || 0;
            const itemValue = item.qty * buyPrice;
            totalVal += itemValue;

            const isLowStock = item.qty < (item.minStock || 0);
            if (isLowStock) {
                tr.classList.add('low-stock-row');
            }
            
            // Age Calculation
            const addedAt = item.addedAt || Date.now(); // fallback to now
            const ageDays = Math.floor((Date.now() - addedAt) / (1000 * 60 * 60 * 24));
            let ageHtml = '';
            if (ageDays < 30) {
                ageHtml = `<span class="badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);">${ageDays}d old</span>`;
            } else if (ageDays <= 90) {
                ageHtml = `<span class="badge" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2);">${ageDays}d old</span>`;
            } else {
                ageHtml = `<span class="badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);">${ageDays}d old</span>`;
            }

            // Margin Calculation
            let marginText = '<span style="opacity: 0.3;">—</span>';
            let marginColor = 'inherit';
            let marginTitle = 'Buying price missing';
            if (item.buyPrice && item.buyPrice > 0) {
                const margin = ((item.price - item.buyPrice) / item.buyPrice) * 100;
                marginText = `${margin.toFixed(1)}%`;
                marginTitle = `Profit: ${formatCurrency(item.price - item.buyPrice)} per unit`;
                if (margin > 20) marginColor = '#10b981';
                else if (margin < 10) marginColor = '#f59e0b';
            }

            tr.dataset.id = item.id;
            
            if (isBulkEditMode) {
                tr.innerHTML = `
                    <td>
                        <div style="font-weight: 700;">${escapeXml(item.name)}</div>
                        <div style="font-size: 0.75rem; opacity: 0.6;">SKU: ${item.sku || 'N/A'}</div>
                    </td>
                    <td><input type="number" class="bulk-qty" value="${item.qty}" style="width: 70px; padding: 4px; background: rgba(0,0,0,0.2); border: 1px solid var(--border); color: #fff; border-radius: 4px;"></td>
                    <td><input type="number" class="bulk-min" value="${item.minStock || 0}" style="width: 70px; padding: 4px; background: rgba(0,0,0,0.2); border: 1px solid var(--border); color: #fff; border-radius: 4px;"> (Min)</td>
                    <td>${getLastSoldDate(item.sku)}</td>
                    <td><input type="number" class="bulk-rate" value="${item.price}" style="width: 90px; padding: 4px; background: rgba(0,0,0,0.2); border: 1px solid var(--border); color: #fff; border-radius: 4px;"></td>
                    <td>${formatCurrency(itemValue)}</td>
                    <td style="color: ${marginColor}; font-weight: 600;" title="${marginTitle}">${marginText}</td>
                    <td>—</td>
                    <td>
                        <button class="btn-delete" onclick="deleteItem('${item.id}')" title="Remove Item" style="color: var(--danger); background: none; border: none; cursor: pointer;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                `;
            } else {
                tr.innerHTML = `
                    <td>
                        <div style="font-weight: 700;">${escapeXml(item.name)}</div>
                        <div style="font-size: 0.75rem; opacity: 0.6;">SKU: ${item.sku || 'N/A'}</div>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span>${item.qty} Nos</span>
                            <div class="sparkline-container" data-id="${item.id}"></div>
                        </div>
                    </td>
                    <td>${ageHtml}</td>
                    <td><span class="badge" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2);">${getLastSoldDate(item.sku)}</span></td>
                    <td>${formatCurrency(item.price || 0)}</td>
                    <td>${formatCurrency(itemValue)}</td>
                    <td style="color: ${marginColor}; font-weight: 600;" title="${marginTitle}">${marginText}</td>
                    <td>
                        ${item.qty === 0 ? '<span class="status-critical bg-danger badge">CRITICAL</span>' : 
                          (isLowStock ? '<span class="badge-restock">Restock</span>' : '<span style="color: grey; opacity: 0.5; font-size: 0.8rem;">Stock OK</span>')}
                    </td>
                    <td>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button class="btn-edit" onclick="generatePDF('Estimate', {id: '${item.id}', orgName: 'Customer', items: [{product: '${escapeXml(item.name)}', qty: 1, price: ${item.price}}], price: ${item.price}})" title="Generate Quotation">
                                <i class="fa-solid fa-file-pdf" style="color: #ec4899;"></i>
                            </button>
                            ${isLowStock ? `<button class="btn-edit" onclick="window.location.href='transactions.html?action=buy&item=${encodeURIComponent(item.name)}'" title="Quick Reorder" style="color: #f59e0b;"><i class="fa-solid fa-arrows-rotate"></i></button>` : ''}
                            <button class="btn-edit" onclick="editItem('${item.id}')" title="Edit Item">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn-delete-animated" onclick="deleteItem('${item.id}')" title="Remove Item">
                                 <svg viewBox="0 0 448 512" class="svgIcon"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg>
                            </button>
                        </div>
                    </td>
                `;
            }

            inventoryList.appendChild(tr);

            // Mock Stock Trend Data for Sparkline
            setTimeout(() => {
                const container = tr.querySelector('.sparkline-container');
                const trend = [item.qty + 5, item.qty + 2, item.qty + 3, item.qty - 1, item.qty];
                renderSparkline(container, trend, isLowStock ? '#ef4444' : '#3b82f6');
            }, 100);
        });

        if (totalValueEl) totalValueEl.innerHTML = `<strong>${formatCurrency(totalVal)}</strong>`;
        if (totalItemsBadge) totalItemsBadge.textContent = `${inventory.length} Item${inventory.length > 1 ? 's' : ''}`;
        
        // Update Insights Bar
        updateBusinessInsights(inventory, totalVal);
        initAnalyticsCharts();

        if (inventoryFooter) inventoryFooter.style.display = 'table-row-group';
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.disabled = false;
        if (exportVoucherBtn) exportVoucherBtn.disabled = false;
    };

    const updateBusinessInsights = (data, totalValue) => {
        const statTotalItems = document.getElementById('statTotalItems');
        const statTotalValue = document.getElementById('statTotalValue');
        const statStockHealth = document.getElementById('statStockHealth');
        const healthIconBox = document.getElementById('healthIconBox');

        if (statTotalItems) statTotalItems.textContent = data.length;
        if (statTotalValue) statTotalValue.textContent = formatCurrency(totalValue);

        if (data.length === 0) {
            if (statStockHealth) statStockHealth.textContent = '100%';
            if (healthIconBox) {
                healthIconBox.style.color = '#10b981';
                healthIconBox.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
            }
            return;
        }

        const itemsInHealth = data.filter(item => item.qty >= (item.minStock || 0)).length;
        const healthPercentage = Math.round((itemsInHealth / data.length) * 100);
        
        if (statStockHealth) statStockHealth.textContent = `${healthPercentage}%`;
        
        if (healthPercentage < 50 && healthIconBox) {
            healthIconBox.style.color = 'var(--danger)';
            healthIconBox.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            if (statStockHealth) statStockHealth.style.color = 'var(--danger)';
        } else if (healthPercentage < 90 && healthIconBox) {
            healthIconBox.style.color = '#f59e0b';
            healthIconBox.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
            if (statStockHealth) statStockHealth.style.color = '#f59e0b';
        } else if (healthIconBox) {
            healthIconBox.style.color = '#10b981';
            healthIconBox.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
            if (statStockHealth) statStockHealth.style.color = '#10b981';
        }

        renderSmartLowStockBanner(data);

        // Update AMC Revenue from shared localStorage
        updateAmcInsights();
        calculateNetProfit();
        renderTopProducts();
        
        // Phase 3 Features
        renderDeadStock();
    };

    const renderDeadStock = () => {
        const deadStockSection = document.getElementById('deadStockSection');
        const deadStockList = document.getElementById('deadStockList');
        const countBadge = document.getElementById('deadStockCount');
        if (!deadStockSection || !deadStockList) return;

        const transactions = DataController.getTransactions() || [];
        const now = Date.now();
        const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

        const deadItems = inventory.filter(item => {
            if (item.qty <= 0) return false;
            
            const addedAt = item.addedAt || now; // Assumes now if missing, won't trigger initially.
            const ageMs = now - addedAt;
            if (ageMs < sixtyDaysMs) return false;

            const sales = transactions.filter(t => t.type === 'Sale' && (t.itemName === item.name || t.itemId === item.id));
            const hasRecentSale = sales.some(s => {
                const sellDate = new Date(s.timestamp || s.date).getTime();
                return (now - sellDate) <= sixtyDaysMs;
            });

            return !hasRecentSale;
        });

        if (deadItems.length > 0) {
            deadStockSection.style.display = 'block';
            countBadge.innerText = `${deadItems.length} Items`;
            
            deadStockList.innerHTML = deadItems.map(item => {
                const daysOld = Math.floor((now - (item.addedAt || now)) / (1000 * 60 * 60 * 24));
                const valueLocked = item.qty * item.price;
                return `
                    <tr>
                        <td style="font-weight: 500">${escapeXml(item.name)}</td>
                        <td style="color: #f59e0b;">${daysOld} Days</td>
                        <td><span class="badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">${item.qty} Nos</span></td>
                        <td>${formatCurrency(valueLocked)}</td>
                        <td>
                            <button class="btn-sm btn-outline" style="border-color: #f59e0b; color: #f59e0b;" onclick="window.location.href='transactions.html?action=sell&item=${encodeURIComponent(item.name)}'">
                                Consider Discounting
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            deadStockSection.style.display = 'none';
        }
    };

    const renderTopProducts = () => {
        const topProductsList = document.getElementById('topProductsList');
        if (!topProductsList) return;
        
        const transactions = DataController.getTransactions() || [];
        const productStats = {};
        
        // Aggregate sales
        transactions.forEach(t => {
            if (t.type === 'Sale') {
                if (!productStats[t.itemName]) {
                    productStats[t.itemName] = { units: 0, revenue: 0 };
                }
                productStats[t.itemName].units += t.qty;
                productStats[t.itemName].revenue += (t.qty * t.rate);
            }
        });
        
        // Sort by units
        const sortedProducts = Object.entries(productStats)
            .map(([name, stats]) => ({ name, ...stats }))
            .sort((a, b) => b.units - a.units)
            .slice(0, 5);
            
        topProductsList.innerHTML = '';
        if (sortedProducts.length === 0) {
            topProductsList.innerHTML = '<tr><td colspan="3" style="text-align:center; opacity:0.6;">No sales data available yet</td></tr>';
            return;
        }
        
        sortedProducts.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 500">${escapeXml(p.name)}</td>
                <td><span class="badge" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">${p.units} Nos</span></td>
                <td style="color: #10b981; font-weight: 600;">${formatCurrency(p.revenue)}</td>
            `;
            topProductsList.appendChild(tr);
        });
    };

    const renderSmartLowStockBanner = (data) => {
        const topBanner = document.querySelector('.main-content');
        let existingBanner = document.getElementById('lowStockBanner');
        
        // Critical / Low Stock items
        const lowStockItems = data
            .filter(i => i.qty <= (i.minStock || 0))
            .sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0))
            .slice(0, 3);

        if (lowStockItems.length === 0) {
            if (existingBanner) existingBanner.remove();
            return;
        }

        if (!existingBanner) {
            existingBanner = document.createElement('div');
            existingBanner.id = 'lowStockBanner';
            existingBanner.className = 'low-stock-banner fade-in';
            topBanner.prepend(existingBanner);
        }

        const itemsHtml = lowStockItems.map(i => `<b style="color: #ef4444;">${i.name}</b> (${i.qty} left)`).join(', ');
        existingBanner.innerHTML = `
            <div style="background: var(--danger); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
                <h4 style="margin: 0; font-size: 0.95rem;">Smart Restock Alert</h4>
                <p style="margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--text-muted);">
                    Based on sales velocity, you are critical on: ${itemsHtml}. Order soon to avoid stockout.
                </p>
            </div>
        `;
    };

    // --- Supplier Hub Logic ---
    const supplierModal = document.getElementById('supplierModal');
    const openSuppBtn = document.getElementById('openSupplierHub');
    const closeSuppBtn = document.getElementById('closeSupplierModal');
    const supplierForm = document.getElementById('supplierForm');
    const supplierList = document.getElementById('supplierList');

    const renderSuppliers = () => {
        if (!supplierList || !partSupplierSelect) return;
        supplierList.innerHTML = '';
        partSupplierSelect.innerHTML = '<option value="">Select Supplier</option>';
        
        suppliers.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 0.5rem;">${escapeXml(s.name)}</td>
                <td style="padding: 0.5rem;">${escapeXml(s.gst || 'N/A')}</td>
                <td style="padding: 0.5rem; text-align: right;">
                    ${s.phone ? `<a href="https://wa.me/${s.phone.replace(/[^0-9]/g, '')}" target="_blank" class="btn-edit" style="color: #25D366; text-decoration: none; display: inline-block; margin-right: 0.5rem;" title="WhatsApp Contact"><i class="fa-brands fa-whatsapp"></i></a>` : ''}
                    <button class="btn-delete" onclick="deleteSupplier('${s.id}')" style="color: var(--danger); background: none; border: none; cursor: pointer;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            supplierList.appendChild(tr);

            const opt = document.createElement('option');
            opt.value = s.name;
            opt.textContent = s.name;
            partSupplierSelect.appendChild(opt);
        });
    };

    if (openSuppBtn) {
        openSuppBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (supplierModal) supplierModal.classList.add('active');
            renderSuppliers();
        });
    }

    if (closeSuppBtn) {
        closeSuppBtn.addEventListener('click', () => {
            if (supplierModal) supplierModal.classList.remove('active');
        });
    }

    if (supplierForm) {
        supplierForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newSupp = {
                id: Date.now().toString(),
                name: document.getElementById('suppName').value.trim(),
                gst: document.getElementById('suppGst').value.trim(),
                phone: document.getElementById('suppPhone').value.trim()
            };
            suppliers.push(newSupp);
            saveState();
            supplierForm.reset();
            renderSuppliers();
        });
    }

    window.deleteSupplier = async (id) => {
        const confirmed = await showConfirm({
            title: 'Remove Supplier?',
            message: 'This will permanently remove this supplier from your Supplier Hub.',
            confirmText: 'Remove',
            confirmIcon: 'fa-truck',
            type: 'danger'
        });
        if (confirmed) {
            suppliers = suppliers.filter(s => s.id !== id);
            saveState();
            renderSuppliers();
        }
    };

    // Initialize Suppliers on load
    renderSuppliers();

    const calculateNetProfit = () => {
        const netProfitEl = document.getElementById('statNetProfit');
        const netProfitMarginEl = document.getElementById('statNetProfitMargin');
        if (netProfitEl) {
            const currentMonthProfit = DataController.getCalculatedNetProfit(new Date());
            
            const prevDate = new Date();
            prevDate.setMonth(prevDate.getMonth() - 1);
            const prevMonthProfit = DataController.getCalculatedNetProfit(prevDate);

            netProfitEl.textContent = formatCurrency(currentMonthProfit);
            netProfitEl.style.color = currentMonthProfit >= 0 ? '#10b981' : '#ef4444';

            if (netProfitMarginEl) {
                if (prevMonthProfit === 0) {
                    netProfitMarginEl.innerHTML = '<span style="color: #10b981"><i class="fa-solid fa-arrow-up"></i> 100%</span>';
                } else {
                    const diff = ((currentMonthProfit - prevMonthProfit) / Math.abs(prevMonthProfit)) * 100;
                    if (diff >= 0) {
                        netProfitMarginEl.innerHTML = `<span style="color: #10b981"><i class="fa-solid fa-arrow-up"></i> ${diff.toFixed(1)}%</span>`;
                    } else {
                        netProfitMarginEl.innerHTML = `<span style="color: #ef4444"><i class="fa-solid fa-arrow-down"></i> ${Math.abs(diff).toFixed(1)}%</span>`;
                    }
                }
            }
        }
        
        const avgMarginEl = document.getElementById('statAvgMargin');
        if (avgMarginEl && inventory.length > 0) {
            const totalMargin = inventory.reduce((sum, item) => {
                if (!item.buyPrice) return sum;
                return sum + (((item.price - item.buyPrice) / item.buyPrice) * 100);
            }, 0);
            avgMarginEl.textContent = (totalMargin / inventory.length).toFixed(1) + '%';
        }

        updateAmcInsights();
    };

    const updateAmcInsights = () => {
        const statAmcTotal = document.getElementById('statAmcTotal');
        if (!statAmcTotal) return;

        const amcContracts = DataController.getAmc();
        const totalAmcValue = amcContracts.reduce((sum, amc) => sum + (parseFloat(amc.amount) || 0), 0);
        statAmcTotal.textContent = formatCurrency(totalAmcValue);
    };

    // --- Analytics Charts ---
    let revenueChart = null;
    let volumeChart = null;
    let healthChart = null;

    const initAnalyticsCharts = () => {
        if (typeof Chart === 'undefined') return;

        const ctxRevenue = document.getElementById('revenueChart');
        const ctxVolume = document.getElementById('volumeChart');
        const ctxHealth = document.getElementById('healthChart');
        if (!ctxRevenue || !ctxVolume || !ctxHealth) return;

        const monthsRevenueBreakdown = []; // For interactivity

        const repairJobs = DataController.getRepairs();
        const amcContracts = DataController.getAmc();
        const inventoryData = DataController.getInventory();

        // 1. Revenue Trends (Last 6 Months)
        const months = [];
        const repairRevenueData = [];
        const amcRevenueData = [];
        const serviceVisitRevenueData = [];
        
        // 1.b Volume Chart logic
        const purchaseCounts = [];
        const saleCounts = [];

        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = d.toLocaleString('default', { month: 'short' });
            months.push(monthName);

            // Repair Revenue for this month
            const monthRepairTotal = repairJobs.filter(job => {
                if (job.status !== 'Completed') return false;
                const jobDate = new Date(job.createdAt);
                return jobDate.getMonth() === d.getMonth() && jobDate.getFullYear() === d.getFullYear();
            }).reduce((sum, job) => sum + (job.price + (job.extraCharges || 0)), 0);
            repairRevenueData.push(monthRepairTotal);

            // AMC Revenue for this month
            const monthAmcTotal = amcContracts.filter(amc => {
                const amcDate = new Date(amc.createdAt);
                return amcDate.getMonth() === d.getMonth() && amcDate.getFullYear() === d.getFullYear();
            }).reduce((sum, amc) => sum + (parseFloat(amc.amount) || 0), 0);
            amcRevenueData.push(monthAmcTotal);

            // Service Visit Revenue for this month
            const serviceVisits = DataController.getNonAmcCalls() || [];
            const monthVisitTotal = serviceVisits.filter(v => {
                const vDate = new Date(v.timestamp);
                return vDate.getMonth() === d.getMonth() && vDate.getFullYear() === d.getFullYear();
            }).reduce((sum, v) => sum + (parseFloat(v.fee) || 0), 0);
            serviceVisitRevenueData.push(monthVisitTotal);
            
            // Sales Revenue from Transactions
            const transactions = DataController.getTransactions() || [];
            
            let pCount = 0;
            let sCount = 0;
            let monthSalesTotal = 0;

            transactions.forEach(t => {
                const tDate = new Date(t.timestamp || t.date);
                if (tDate.getMonth() === d.getMonth() && tDate.getFullYear() === d.getFullYear()) {
                    if (t.type === 'Sale') {
                        sCount++;
                        monthSalesTotal += (t.amount || t.totalValue || 0);
                    } else if (t.type === 'Purchase') {
                        pCount++;
                    }
                }
            });

            purchaseCounts.push(pCount);
            saleCounts.push(sCount);

            monthsRevenueBreakdown.push({
                repair: monthRepairTotal,
                amc: monthAmcTotal,
                sales: monthSalesTotal,
                visits: monthVisitTotal
            });
        }

        const isLight = document.body.classList.contains('light-theme');
        const textColor = isLight ? '#64748b' : 'rgba(255,255,255,0.5)';
        const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';

        if (revenueChart) revenueChart.destroy();
        revenueChart = new Chart(ctxRevenue, {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Repairs (₹)',
                        data: repairRevenueData,
                        borderColor: '#00B4DB',
                        backgroundColor: 'rgba(0, 180, 219, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#00B4DB'
                    },
                    {
                        label: 'AMC (₹)',
                        data: amcRevenueData,
                        borderColor: '#a855f7',
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#a855f7'
                    },
                    {
                        label: 'Service Visits (₹)',
                        data: serviceVisitRevenueData,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#f59e0b'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#fff',
                        bodyColor: 'rgba(255, 255, 255, 0.8)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                onClick: (e, activeEls) => {
                    if (activeEls.length > 0) {
                        const index = activeEls[0].index;
                        const label = months[index];
                        const breakdown = monthsRevenueBreakdown[index];
                        alert(`📊 Revenue Breakdown for ${label} 2026:\n\n` +
                              `• Repairs: ₹${breakdown.repair.toLocaleString()}\n` +
                              `• AMC Contracts: ₹${breakdown.amc.toLocaleString()}\n` +
                              `• Ad-hoc Visits: ₹${breakdown.visits.toLocaleString()}\n` +
                              `• Product Sales: ₹${breakdown.sales.toLocaleString()}\n\n` +
                              `Total: ₹${(breakdown.repair + breakdown.amc + breakdown.sales + breakdown.visits).toLocaleString()}`);
                    }
                },
                plugins: { 
                    legend: { 
                        display: true, 
                        position: 'top',
                        labels: { color: textColor, font: { family: 'Outfit', size: 10 } }
                    } 
                },
                scales: {
                    y: { grid: { color: gridColor }, ticks: { color: textColor } },
                    x: { grid: { display: false }, ticks: { color: textColor } }
                }
            }
        });

        // 1.b Volume Purchases vs Sales Bar Chart
        if (volumeChart) volumeChart.destroy();
        volumeChart = new Chart(ctxVolume, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Sales Vol.',
                        data: saleCounts,
                        backgroundColor: '#10b981', // Green
                        borderRadius: 4
                    },
                    {
                        label: 'Purchases Vol.',
                        data: purchaseCounts,
                        backgroundColor: '#ef4444', // Red
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top', labels: { color: textColor, font: { family: 'Outfit', size: 10 } } }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, precision: 0 } },
                    x: { grid: { display: false }, ticks: { color: textColor } }
                }
            }
        });

        // 2. Stock Health
        const okCount = inventoryData.filter(i => i.qty > (i.minStock || 0)).length;
        const restockCount = inventoryData.filter(i => i.qty <= (i.minStock || 0)).length;

        if (healthChart) healthChart.destroy();
        healthChart = new Chart(ctxHealth, {
            type: 'doughnut',
            data: {
                labels: ['Stock OK', 'RESTOCK'],
                datasets: [{
                    data: [okCount, restockCount],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderColor: isLight ? '#fff' : 'rgba(15, 23, 42, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'bottom', 
                        labels: { color: isLight ? '#1e293b' : 'rgba(255,255,255,0.7)', font: { family: 'Outfit' } } 
                    }
                },
                cutout: '70%'
            }
        });

        const healthCard = ctxHealth.closest('.glass-card');
        if (healthCard) {
            if (inventoryData.length > 0 && restockCount === 0) {
                healthCard.classList.add('shimmer-glow');
            } else {
                healthCard.classList.remove('shimmer-glow');
            }
        }
    };

    // --- Tally Logic ---
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => window.generateTallyXml('Masters'));
    }

    if (exportVoucherBtn) {
        exportVoucherBtn.addEventListener('click', () => window.generateTallyXml('Voucher'));
    }

    if (importTallyBtn && importTallyInput) {
        importTallyBtn.addEventListener('click', () => importTallyInput.click());
        importTallyInput.addEventListener('change', async (e) => {
            const btnId = 'importTallyBtn';
            const file = e.target.files[0];
            if (!file) return;
            
            window.setBtnLoading(btnId, true);
            await new Promise(r => setTimeout(r, 800));

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(event.target.result, "text/xml");
                    const stockItems = xmlDoc.getElementsByTagName('STOCKITEM');
                    Array.from(stockItems).forEach(itemNode => {
                        const name = itemNode.getElementsByTagName('NAME')[0]?.textContent || itemNode.getAttribute('NAME');
                        if (!name) return;
                        let qtyStr = itemNode.getElementsByTagName('OPENINGBALANCE')[0]?.textContent || "0";
                        let qty = Math.abs(parseFloat(qtyStr.replace(/[^-0-9.]/g, '')) || 0);
                        let rateStr = itemNode.getElementsByTagName('OPENINGRATE')[0]?.textContent || "0";
                        let price = parseFloat(rateStr.replace(/[^-0-9.]/g, '')) || 0;
                        const existing = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
                        if (existing) { existing.qty += qty; if (price > 0) existing.price = price; }
                        else { inventory.push({ id: Date.now() + Math.random().toString(), name, qty, minStock: 0, price }); }
                    });
                    saveState(); 
                    renderInventory(); 
                    showToast('Tally Data Imported!');
                } catch (err) { 
                    showToast('XML Parse Error', 'error');
                }
                window.setBtnLoading(btnId, false);
            };
            reader.readAsText(file);
        });
    }

    // --- Search & Filtering ---
    window.filterInventory = () => {
        const query = document.getElementById('inventorySearch').value.toLowerCase();
        const rows = document.querySelectorAll('#inventoryList tr:not(.empty-state)');
        
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
        
        // Update empty state if all hidden
        const visibleRows = Array.from(rows).filter(r => r.style.display !== 'none');
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.style.display = visibleRows.length === 0 ? '' : 'none';
    };

    // --- Global Data Hub ---
    window.setBtnLoading = (btnId, isLoading) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        if (isLoading) {
            btn.classList.add('loading');
            btn.closest('.sync-toolset')?.classList.add('processing');
            btn.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.closest('.sync-toolset')?.classList.remove('processing');
            btn.disabled = false;
        }
    };

    window.exportData = async () => {
        setBtnLoading('backupBtn', true);
        await new Promise(r => setTimeout(r, 800)); // Smooth transition
        DataController.exportFullBackup();
        setBtnLoading('backupBtn', false);
        showToast('System backup saved to computer.');
    };

    window.importData = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const confirmed = await showConfirm({
                title: 'Restore Database?',
                message: 'This will OVERWRITE all current data with the selected backup. This cannot be undone.',
                confirmText: 'Restore Now',
                confirmIcon: 'fa-clock-rotate-left',
                type: 'danger'
            });

            if (confirmed) {
                setBtnLoading('restoreBtn', true);
                await new Promise(r => setTimeout(r, 1200)); // For "smoothing" feel
                const result = DataController.importFullBackup(e.target.result);
                setBtnLoading('restoreBtn', false);
                
                if (result.success) {
                    showToast('Database restored! App will refresh...');
                    setTimeout(() => location.reload(), 1500);
                } else {
                    alert('Restore failed: ' + result.error);
                }
            }
        };
        reader.readAsText(file);
    };

    // --- Today at a Glance Logic ---
    const renderTodaySummary = () => {
        const repairs = DataController.getRepairs();
        const amcs = DataController.getAmc();
        const calls = DataController.getNonAmcCalls() || [];
        const today = new Date().toDateString();

        // 1. Visits Today
        const visitsTodayCount = calls.filter(v => new Date(v.timestamp).toDateString() === today).length;
        const visitsEl = document.getElementById('todayVisits');
        if (visitsEl) visitsEl.textContent = visitsTodayCount;

        // 2. Repairs Pending
        const pendingCount = repairs.filter(r => r.status === 'Pending').length;
        const pendingEl = document.getElementById('pendingRepairs');
        if (pendingEl) pendingEl.textContent = pendingCount;

        // 3. AMCs Due This Week
        const oneWeekFromNow = new Date();
        oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
        const amcsDueCount = amcs.filter(a => {
            const nextDue = new Date(a.nextVisitDate);
            return nextDue >= new Date() && nextDue <= oneWeekFromNow;
        }).length;
        const amcsDueEl = document.getElementById('amcsDue');
        if (amcsDueEl) amcsDueEl.textContent = amcsDueCount;
    };

    // Initial Load
    loadState();
    initAnalyticsCharts();
    renderTodaySummary();
});
