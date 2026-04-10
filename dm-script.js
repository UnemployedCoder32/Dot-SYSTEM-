document.addEventListener('DOMContentLoaded', () => {
    const dmItemsList = document.getElementById('dmItemsList');
    const dmHistoryList = document.getElementById('dmHistoryList');
    const dmWhomInput = document.getElementById('dmWhom');
    const dmDateInput = document.getElementById('dmDate');
    const dmTypeSelect = document.getElementById('dmType');
    const dmNotesInput = document.getElementById('dmNotes');
    const inventoryDatalist = document.getElementById('inventoryDatalist');

    let inventory = DataController.getInventory();
    let editingDMNumber = null;

    // --- 1. Initialize ---
    const init = () => {
        // Set default date
        dmDateInput.value = new Date().toISOString().split('T')[0];
        loadState();
    };

    const loadState = () => {
        inventory = DataController.getInventory();
        // Populate inventory datalist
        updateInventoryDatalist();
        // Add first empty row if none
        if (dmItemsList.children.length === 0) addNewItemRow();
        // Render History
        renderDMHistory();
    };

    // Listen for cloud data updates
    window.addEventListener('dataUpdate', () => {
        loadState();
    });

    const updateInventoryDatalist = () => {
        inventory = DataController.getInventory();
        if (!inventoryDatalist) return;
        inventoryDatalist.innerHTML = '';
        inventory.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.name;
            inventoryDatalist.appendChild(opt);
        });
    };

    // --- 2. Row Management ---
    window.addNewItemRow = () => {
        const tr = document.createElement('tr');
        tr.className = 'dm-item-row';
        tr.innerHTML = `
            <td>
                <input type="text" list="inventoryDatalist" class="dm-item-name" placeholder="Search or type item..." style="width:100%" required>
            </td>
            <td>
                <input type="number" class="dm-item-qty" min="1" value="1" style="width:100%" required>
            </td>
            <td>
                <input type="number" class="dm-item-rate" min="0" value="0" style="width:100%">
            </td>
            <td>
                <button class="btn btn-sm btn-delete" onclick="removeItemRow(this)" style="color:var(--danger)">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        dmItemsList.appendChild(tr);
    };

    window.removeItemRow = (btn) => {
        if (dmItemsList.children.length > 1) {
            btn.closest('tr').remove();
        } else {
            showToast('At least one item is required.', 'error');
        }
    };

    // --- 3. Finalization ---
    window.finalizeDM = async () => {
        const whom = dmWhomInput.value.trim();
        const date = dmDateInput.value;
        const type = dmTypeSelect.value;
        const notes = dmNotesInput.value.trim();
        const rows = document.querySelectorAll('.dm-item-row');

        if (!whom) {
            showToast('Please enter the recipient name.', 'error');
            dmWhomInput.focus();
            return;
        }

        const itemsToProcess = [];
        let isValid = true;

        rows.forEach(row => {
            const name = row.querySelector('.dm-item-name').value.trim();
            const qty = parseFloat(row.querySelector('.dm-item-qty').value) || 0;
            const rate = parseFloat(row.querySelector('.dm-item-rate').value) || 0;

            if (!name || qty <= 0) {
                isValid = false;
                row.style.background = 'rgba(239, 68, 68, 0.1)';
            } else {
                itemsToProcess.push({ name, qty, rate });
                row.style.background = 'transparent';
            }
        });

        if (!isValid) {
            showToast('Please complete all item details.', 'error');
            return;
        }

        const confirmed = await showConfirm({
            title: `Confirm ${type}?`,
            message: `Logging movement for ${itemsToProcess.length} items to ${whom}.`,
            confirmText: 'Procceed',
            confirmIcon: 'fa-truck-fast',
            type: 'info'
        });

        if (!confirmed) return;

        // --- Process Stock Updates ---
        const dmNumber = editingDMNumber || DataController.getNextDMNumber();
        
        // If editing, revert old first
        if (editingDMNumber) {
            DataController.revertBatch(null, editingDMNumber);
        }

        const results = [];
        for (const itemData of itemsToProcess) {
            // Find existing item by name
            const item = inventory.find(i => i.name.toLowerCase() === itemData.name.toLowerCase());
            const partId = item ? item.id : 'NEW_ITEM';

            const result = DataController.updateStock(partId, type, itemData.qty, {
                whom: whom,
                itemName: itemData.name,
                customDate: date,
                rate: itemData.rate,
                notes: notes,
                dmNumber: dmNumber, // Pass the DM ID for batching
                allowNegative: true 
            });
            results.push(result);
        }

        showToast(`DM #${dmNumber} processed successfully!`);
        
        // --- Generate PDF ---
        generateDMPDF(whom, date, itemsToProcess, type, notes, dmNumber);

        // --- Reset Form ---
        editingDMNumber = null;
        document.querySelector('.section-header h2').innerHTML = '<i class="fa-solid fa-truck-ramp-box"></i> Create Delivery Memo';
        document.getElementById('finalizeBtn').textContent = 'Generate Memo & Process Stock';
        dmWhomInput.value = '';
        dmNotesInput.value = '';
        dmItemsList.innerHTML = '';
        addNewItemRow();
        renderDMHistory();
    };

    const renderDMHistory = () => {
        const transactions = DataController.getTransactions();
        const dmTransactions = transactions.filter(t => t.dmNumber);
        
        if (!dmHistoryList) return;
        dmHistoryList.innerHTML = '';

        if (dmTransactions.length === 0) {
            dmHistoryList.innerHTML = '<tr><td colspan="5" style="text-align: center; opacity: 0.5;">No delivery memos found</td></tr>';
            return;
        }

        // Group by DM Number
        const groups = {};
        dmTransactions.forEach(t => {
            if (!groups[t.dmNumber]) {
                groups[t.dmNumber] = {
                    dmNumber: t.dmNumber,
                    date: t.date,
                    whom: t.whom,
                    type: t.type,
                    items: [],
                    notes: t.notes
                };
            }
            groups[t.dmNumber].items.push(t);
        });

        // Convert to array and sort by number desc
        const sortedGroups = Object.values(groups).sort((a, b) => b.dmNumber - a.dmNumber);
        
        sortedGroups.forEach(group => {
            const trRow = document.createElement('tr');
            const itemsSummary = group.items.map(i => `• ${i.itemName} (x${i.qty})`).join('<br>');
            
            trRow.innerHTML = `
                <td>
                    <div style="font-weight:700; color:var(--accent);">#${group.dmNumber}</div>
                    <div style="font-size:0.75rem; opacity:0.6;">${group.date}</div>
                </td>
                <td>${group.whom || 'Unknown'}</td>
                <td style="font-size:0.85rem;">${itemsSummary}</td>
                <td><span class="badge ${group.type.toLowerCase() === 'dm-out' ? 'bg-danger' : 'bg-success'}">${group.type}</span></td>
                <td>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="btn btn-sm btn-outline" onclick="editDM(${group.dmNumber})" title="Edit Memo" style="color:var(--primary)">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="reprintDM(${group.dmNumber})" title="Reprint">
                            <i class="fa-solid fa-print"></i>
                        </button>
                        <button class="btn btn-sm btn-delete" onclick="handleCancelDM(${group.dmNumber})" title="Cancel & Revert Stock" style="color:var(--danger)">
                            <i class="fa-solid fa-ban"></i>
                        </button>
                    </div>
                </td>
            `;
            dmHistoryList.appendChild(trRow);
        });
    };

    window.handleCancelDM = async (num) => {
        const confirmed = await showConfirm({
            title: `Cancel DM #${num}?`,
            message: 'All associated stock movements will be REVERTED and logs will be deleted.',
            confirmText: 'Delete and Revert',
            confirmIcon: 'fa-ban',
            type: 'danger'
        });

        if (!confirmed) return;

        const res = DataController.cancelDM(num);
        if (res.success) {
            showToast(`DM #${num} cancelled. ${res.count} items reverted.`);
            renderDMHistory();
        } else {
            showToast(res.reason, 'error');
        }
    };

    window.reprintDM = (num) => {
        const transactions = DataController.getTransactions();
        const group = transactions.filter(t => t.dmNumber == num);
        if (group.length > 0) {
            const first = group[0];
            generateDMPDF(first.whom, first.date, group.map(g => ({
                name: g.itemName,
                qty: g.qty,
                rate: g.rate
            })), first.type, first.notes, num);
        }
    };

    window.editDM = (num) => {
        const transactions = DataController.getTransactions();
        const group = transactions.filter(t => t.dmNumber == num);
        if (group.length === 0) return;

        const first = group[0];
        editingDMNumber = num;

        // UI Feedback
        document.querySelector('.section-header h2').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editing Memo #${num}`;
        document.getElementById('finalizeBtn').textContent = 'Update Memo & Revert Old Stock';
        
        // Fill Header
        dmWhomInput.value = first.whom || '';
        dmDateInput.value = new Date(first.timestamp || first.date).toISOString().split('T')[0];
        dmTypeSelect.value = first.type;
        dmNotesInput.value = first.notes || '';

        // Fill Items
        dmItemsList.innerHTML = '';
        group.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'dm-item-row';
            tr.innerHTML = `
                <td>
                    <input type="text" list="inventoryDatalist" class="dm-item-name" placeholder="Search or type item..." style="width:100%" required value="${escapeXml(item.itemName)}">
                </td>
                <td>
                    <input type="number" class="dm-item-qty" min="1" value="${item.qty}" style="width:100%" required>
                </td>
                <td>
                    <input type="number" class="dm-item-rate" min="0" value="${item.rate}" style="width:100%">
                </td>
                <td>
                    <button class="btn btn-sm btn-delete" onclick="removeItemRow(this)" style="color:var(--danger)">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            dmItemsList.appendChild(tr);
        });

        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- PDF Generation helper ---
    function generateDMPDF(whom, date, items, type, notes, dmNumber) {
        if (typeof generatePDF === 'function') {
            const mappedItems = items.map(i => ({
                product: i.name || i.itemName, // handle item structures from both forms
                qty: i.qty,
                price: i.rate || i.price || 0
            }));

            // We pass dmNumber in the data object for app-utils to display
            generatePDF('Delivery Memo', {
                invNo: dmNumber || 'New',
                orgName: whom,
                date: date,
                items: mappedItems,
                notes: notes,
                type: type 
            });
        }
    }

    init();
});
