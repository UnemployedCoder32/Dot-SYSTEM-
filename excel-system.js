/**
 * ExcelSystem - Handles .xlsx Import/Export for DOT System
 * Uses SheetJS (XLSX) library.
 */
window.ExcelSystem = (() => {
    let _parsedData = [];
    let _validationErrors = [];

    // Header Mapping
    const HEADERS = {
        SKU: 'sku',
        'PRODUCT NAME': 'name',
        'PRODUCT_NAME': 'name',
        'PART NAME': 'name',
        'PART_NAME': 'name',
        CATEGORY: 'category',
        QUANTITY: 'qty',
        'UNIT PRICE': 'price',
        'UNIT_PRICE': 'price',
        'PRICE': 'price',
        SUPPLIER: 'supplier',
        'BUY PRICE': 'buyPrice',
        'BUY_PRICE': 'buyPrice',
        'PURCHASE PRICE': 'buyPrice',
        'PURCHASE_PRICE': 'buyPrice',
        'MIN STOCK': 'minStock',
        'MIN_STOCK': 'minStock'
    };

    const ALLOWED_EXTENSIONS = ['xlsx', 'xls'];

    const init = () => {
        const importBtn = document.getElementById('importExcelBtn');
        const excelInput = document.getElementById('excelInput');
        const exportBtn = document.getElementById('exportExcelBtn');
        const templateBtn = document.getElementById('downloadTemplateBtn');
        const confirmBtn = document.getElementById('confirmImportBtn');

        if (importBtn) importBtn.onclick = () => excelInput.click();
        if (excelInput) excelInput.onchange = (e) => handleFile(e);
        if (exportBtn) exportBtn.onclick = () => exportAll();
        if (templateBtn) templateBtn.onclick = () => downloadTemplate();
        if (confirmBtn) confirmBtn.onclick = () => commitImport();
    };

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            showToast('Invalid file format. Please upload .xlsx or .xls', 'error');
            return;
        }

        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rawJson.length < 2) {
            showToast('The file is empty or missing data rows.', 'error');
            return;
        }

        processRawData(rawJson);
    };

    const processRawData = (rows) => {
        const rawHeaders = rows[0].map(h => String(h).toUpperCase().trim());
        const dataRows = rows.slice(1);
        
        _parsedData = [];
        _validationErrors = [];

        dataRows.forEach((row, index) => {
            if (row.length === 0) return; // Skip empty rows

            const item = {};
            const rowNum = index + 2; // +1 for 0-index, +1 for header

            rawHeaders.forEach((header, colIndex) => {
                const key = HEADERS[header];
                if (key) {
                    let val = row[colIndex];
                    // Clean values
                    if (key === 'sku') val = String(val || '').toUpperCase().replace(/\s/g, '');
                    if (key === 'qty' || key === 'minStock') val = parseInt(val) || 0;
                    if (key === 'price' || key === 'buyPrice') val = parseFloat(val) || 0;
                    
                    item[key] = val;
                }
            });

            // Validation
            const errors = validateRow(item, rowNum);
            if (errors.length > 0) {
                _validationErrors.push(...errors);
            }

            _parsedData.push({ ...item, _rowNum: rowNum });
        });

        showPreview();
    };

    const validateRow = (item, rowNum) => {
        const errors = [];
        if (!item.sku) errors.push({ row: rowNum, field: 'SKU', message: 'Required' });
        if (!item.name) errors.push({ row: rowNum, field: 'Product Name', message: 'Required' });
        if (item.qty < 0) errors.push({ row: rowNum, field: 'Quantity', message: 'Cannot be negative' });
        if (item.price < 0) errors.push({ row: rowNum, field: 'Price', message: 'Cannot be negative' });
        return errors;
    };

    const showPreview = () => {
        const modal = document.getElementById('excelPreviewModal');
        const headerRow = document.getElementById('excelPreviewHeader');
        const tbody = document.getElementById('excelPreviewBody');
        const errorDiv = document.getElementById('excelValidationErrors');
        const statsDiv = document.getElementById('importStats');
        const confirmBtn = document.getElementById('confirmImportBtn');

        // Headers
        headerRow.innerHTML = '<th>Row</th><th>SKU</th><th>Name</th><th>Category</th><th>Qty</th><th>Price</th><th>Supplier</th>';
        
        // Body
        tbody.innerHTML = '';
        _parsedData.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item._rowNum}</td>
                <td style="font-family: monospace;">${item.sku || '-'}</td>
                <td>${item.name || '-'}</td>
                <td>${item.category || '-'}</td>
                <td>${item.qty || 0}</td>
                <td>₹${(item.buyPrice || 0).toLocaleString()}</td>
                <td>₹${(item.price || 0).toLocaleString()}</td>
                <td>${item.supplier || '-'}</td>
            `;
            tbody.appendChild(tr);
        });

        // Errors
        if (_validationErrors.length > 0) {
            errorDiv.style.display = 'block';
            errorDiv.innerHTML = '<strong>Validation Failed:</strong><ul style="margin-top: 0.5rem; padding-left: 1.2rem;">' +
                _validationErrors.map(e => `<li>Row ${e.row}: ${e.field} - ${e.message}</li>`).join('') +
                '</ul>';
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
        } else {
            errorDiv.style.display = 'none';
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
        }

        // Stats
        const inventory = DataController.getInventory();
        let newCount = 0;
        let updateCount = 0;
        _parsedData.forEach(item => {
            if (inventory.some(i => i.sku === item.sku || i.name === item.name)) updateCount++;
            else newCount++;
        });
        statsDiv.innerHTML = `Summary: <span style="color: #10b981;">${newCount} New</span>, <span style="color: #3b82f6;">${updateCount} Updates</span>`;

        modal.classList.add('active');
    };

    const commitImport = async () => {
        const btnId = 'confirmImportBtn';
        if (window.setBtnLoading) window.setBtnLoading(btnId, true);
        await new Promise(r => setTimeout(r, 1000));

        let inventory = DataController.getInventory();
        let added = 0;
        let updated = 0;

        _parsedData.forEach(item => {
            // Find by SKU or Name (fallback for legacy)
            const idx = inventory.findIndex(i => (item.sku && i.sku === item.sku) || (i.name === item.name));
            
            if (idx !== -1) {
                // Update
                inventory[idx] = { ...inventory[idx], ...item };
                delete inventory[idx]._rowNum;
                updated++;
            } else {
                // Insert
                const newItem = {
                    id: 'it_' + Date.now() + Math.random().toString(36).substr(2, 5),
                    sku: item.sku,
                    name: item.name,
                    category: item.category || 'General',
                    qty: item.qty || 0,
                    price: item.price || 0,
                    minStock: item.minStock || 5,
                    buyPrice: item.buyPrice || 0,
                    supplier: item.supplier || '',
                    totalSold: 0
                };
                inventory.push(newItem);
                added++;
            }
        });

        DataController.saveInventory(inventory);
        closeExcelPreview();
        if (window.setBtnLoading) window.setBtnLoading(btnId, false);
        showToast(`Import Success: ${added} added, ${updated} updated!`);
        if (window.renderInventory) window.renderInventory();
    };

    const exportAll = async () => {
        const btnId = 'exportExcelBtn';
        if (window.setBtnLoading) window.setBtnLoading(btnId, true);
        await new Promise(r => setTimeout(r, 800));

        const inventory = DataController.getInventory();
        const data = inventory.map(item => ({
            SKU: item.sku || '',
            'Product Name': item.name,
            Category: item.category || 'General',
            Quantity: item.qty,
            'Purchase Price': item.buyPrice || 0,
            'Selling Price': item.price,
            'Min Stock': item.minStock || 5,
            Supplier: item.supplier || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Stock");

        XLSX.writeFile(wb, `Stock_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
        if (window.setBtnLoading) window.setBtnLoading(btnId, false);
    };

    const downloadTemplate = async () => {
        const btnId = 'downloadTemplateBtn';
        if (window.setBtnLoading) window.setBtnLoading(btnId, true);
        await new Promise(r => setTimeout(r, 500));

        const headers = [['SKU', 'Product Name', 'Category', 'Quantity', 'Unit Price', 'Supplier']];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Stock_Import_Template.xlsx");
        if (window.setBtnLoading) window.setBtnLoading(btnId, false);
    };

    window.closeExcelPreview = () => {
        document.getElementById('excelPreviewModal').classList.remove('active');
        document.getElementById('excelInput').value = ''; // Reset input
    };

    init();

    return { exportAll, downloadTemplate };
})();
