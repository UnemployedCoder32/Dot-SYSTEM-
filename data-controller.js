/**
 * DataController - Centralized Data Management for DOT System
 * Optimizes localStorage access and unifies business logic.
 */
window.DataController = (() => {
    // Shared state cache
    let _state = {
        inventory: [],
        suppliers: [],
        repairJobs: [],
        amcContracts: [],
        employees: [],
        crmHistory: {},
        transactions: [],
        serviceCalls: [],
        nonAmcCalls: [],
        trash: []
    };

    // localStorage keys
    const KEYS = {
        INVENTORY: 'hardware_sync_inventory',
        SUPPLIERS: 'tally_suppliers',
        REPAIRS: 'tally_repair_jobs',
        AMC: 'hardware_sync_amc',
        EMPLOYEES: 'tally_employees',
        CRM: 'tally_crm_history',
        TRANSACTIONS: 'tally_transactions',
        SERVICECALLS: 'tally_service_calls',
        NONAMCCALLS: 'tally_non_amc_calls',
        TRASH: 'tally_trash',
        DM_COUNTER: 'tally_dm_counter',
        INV_COUNTER: 'tally_inv_counter'
    };

    // Load all data into cache once
    const init = () => {
        _state.inventory = JSON.parse(localStorage.getItem(KEYS.INVENTORY)) || [];
        _state.suppliers = JSON.parse(localStorage.getItem(KEYS.SUPPLIERS)) || [];
        _state.repairJobs = JSON.parse(localStorage.getItem(KEYS.REPAIRS)) || [];
        _state.amcContracts = JSON.parse(localStorage.getItem(KEYS.AMC)) || [];
        _state.employees = JSON.parse(localStorage.getItem(KEYS.EMPLOYEES)) || [];
        _state.crmHistory = JSON.parse(localStorage.getItem(KEYS.CRM)) || {};
        _state.transactions = JSON.parse(localStorage.getItem(KEYS.TRANSACTIONS)) || [];
        _state.serviceCalls = JSON.parse(localStorage.getItem(KEYS.SERVICECALLS)) || [];
        _state.nonAmcCalls = JSON.parse(localStorage.getItem(KEYS.NONAMCCALLS)) || [];
        _state.trash = JSON.parse(localStorage.getItem(KEYS.TRASH)) || [];

        // Cleanup trash > 30 days
        const limitDate = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const originalLength = _state.trash.length;
        _state.trash = _state.trash.filter(item => item.deletedAt > limitDate);
        if (_state.trash.length !== originalLength) {
            save(KEYS.TRASH, _state.trash);
        }

        console.log('📦 DataController: Initialized Cache');
    };

    const save = (key, data) => {
        localStorage.setItem(key, JSON.stringify(data));
        // Also notify interested parties
        window.dispatchEvent(new CustomEvent('dataUpdate', { detail: { key } }));
    };

    // --- Inventory ---
    const getInventory = () => _state.inventory;
    const saveInventory = (data) => {
        _state.inventory = data;
        save(KEYS.INVENTORY, data);
    };
    const getTrash = () => _state.trash;
    const moveToTrash = (item) => {
        item.deletedAt = Date.now();
        _state.trash.push(item);
        save(KEYS.TRASH, _state.trash);
    };
    const restoreFromTrash = (id) => {
        const itemIndex = _state.trash.findIndex(i => i.id === id);
        if (itemIndex > -1) {
            const item = _state.trash.splice(itemIndex, 1)[0];
            delete item.deletedAt;
            _state.inventory.push(item);
            save(KEYS.INVENTORY, _state.inventory);
            save(KEYS.TRASH, _state.trash);
            return true;
        }
        return false;
    };

    const updateStock = (partId, type, quantity, meta = {}) => {
        let itemIndex = _state.inventory.findIndex(i => i.id === partId);
        let item;

        // --- 1. Service Logic (No inventory impact) ---
        if (type === 'Service') {
            const transaction = {
                id: 'tr_srv_' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
                timestamp: meta.customDate ? new Date(meta.customDate).toISOString() : new Date().toISOString(),
                date: meta.customDate ? new Date(meta.customDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
                itemId: 'SERVICE',
                itemName: meta.itemName || 'General Service',
                type: 'Service',
                qty: parseFloat(quantity) || 1,
                rate: parseFloat(meta.rate) || 0,
                buyRate: 0,
                totalValue: (parseFloat(quantity) || 1) * (parseFloat(meta.rate) || 0),
                paymentMode: meta.paymentMode || 'Cash',
                notes: meta.notes || '',
                whom: meta.whom || 'Customer'
            };
            _state.transactions.unshift(transaction);
            save(KEYS.TRANSACTIONS, _state.transactions);
            return { success: true };
        }

        // --- 2. Auto-Creation / Item Matching ---
        if (itemIndex === -1 && (meta.itemName || partId && partId !== 'NEW_ITEM')) {
            const searchName = meta.itemName || partId;
            // Search by name (case-insensitive)
            itemIndex = _state.inventory.findIndex(i => i.name.toLowerCase() === searchName.toLowerCase());
            
            if (itemIndex === -1 && meta.itemName) {
                // Truly new item - Create it
                const newItem = {
                    id: 'item_' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    name: meta.itemName,
                    sku: (meta.sku || meta.itemName.substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 1000)),
                    qty: 0,
                    minStock: 0,
                    buyPrice: parseFloat(meta.buyPrice || 0),
                    price: parseFloat(meta.rate || 0),
                    addedAt: Date.now()
                };
                _state.inventory.push(newItem);
                itemIndex = _state.inventory.length - 1;
                save(KEYS.INVENTORY, _state.inventory);
            }
        }

        // If still not found and no name provided
        if (itemIndex === -1) return { success: false, reason: 'Item not found' };

        item = _state.inventory[itemIndex];
        const qty = parseFloat(quantity);
        const rate = meta.rate !== undefined ? parseFloat(meta.rate) : (type === 'Sale' ? parseFloat(item.price || 0) : parseFloat(item.buyPrice || 0));
        const buyRate = parseFloat(item.buyPrice || 0);

        if (type === 'Sale' || type === 'DM-Out') {
            if (type === 'Sale' && item.qty < qty && !meta.allowNegative) {
                return { success: false, reason: 'Insufficient Stock' };
            }
            item.qty -= qty;
            if (type === 'Sale') item.totalSold = (parseFloat(item.totalSold) || 0) + qty;
        } else if (type === 'Purchase' || type === 'DM-In' || type === 'Initial') {
            item.qty += qty;
            if (type === 'Purchase') {
                item.totalPurchased = (parseFloat(item.totalPurchased) || 0) + qty;
                // Update purchase price if provided
                if (meta.rate) item.buyPrice = parseFloat(meta.rate);
            }
        }

        // --- 3. Ledger Entry ---
        const transaction = {
            id: 'tr_' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
            timestamp: meta.customDate ? new Date(meta.customDate).toISOString() : new Date().toISOString(),
            date: meta.customDate ? new Date(meta.customDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
            itemId: item.id,
            itemName: item.name,
            type: type,
            qty: qty,
            rate: rate,
            buyRate: buyRate,
            totalValue: qty * rate,
            paymentMode: meta.paymentMode || 'Cash',
            notes: meta.notes || '',
            whom: meta.whom || (type === 'Sale' || type === 'DM-Out' ? 'Customer' : 'Supplier'),
            dmNumber: meta.dmNumber || null, // Track DM association
            batchId: meta.batchId || null // Track multi-item batch association
        };

        _state.transactions.unshift(transaction);

        save(KEYS.INVENTORY, _state.inventory);
        save(KEYS.TRANSACTIONS, _state.transactions);
        return { success: true, itemId: item.id };
    };

    const getNextDMNumber = () => {
        let count = parseInt(localStorage.getItem(KEYS.DM_COUNTER)) || 500; // Start at 500
        count++;
        localStorage.setItem(KEYS.DM_COUNTER, count.toString());
        return count;
    };

    const getNextInvoiceNumber = () => {
        let count = parseInt(localStorage.getItem(KEYS.INV_COUNTER)) || 100; // Start at 101
        count++;
        localStorage.setItem(KEYS.INV_COUNTER, count.toString());
        return count;
    };

    const cancelDM = (dmNumber) => {
        if (!dmNumber) return { success: false, reason: 'No DM number' };
        
        // 1. Find all transactions for this DM
        const dmTransactions = _state.transactions.filter(t => t.dmNumber == dmNumber);
        if (dmTransactions.length === 0) return { success: false, reason: 'DM not found' };

        // 2. Revert Stock for each
        dmTransactions.forEach(tr => {
            const item = _state.inventory.find(i => i.id === tr.itemId);
            if (item) {
                if (tr.type === 'DM-Out') {
                    item.qty += tr.qty;
                } else if (tr.type === 'DM-In') {
                    item.qty -= tr.qty;
                }
            }
        });

        // 3. Remove transactions
        _state.transactions = _state.transactions.filter(t => t.dmNumber != dmNumber);
        
        // 4. Save
        save(KEYS.INVENTORY, _state.inventory);
        save(KEYS.TRANSACTIONS, _state.transactions);
        
        return { success: true, count: dmTransactions.length };
    };

    const saveTransactions = (data) => {
        _state.transactions = data;
        save(KEYS.TRANSACTIONS, data);
    };

    const getInventoryValue = () => {
        return _state.inventory.reduce((sum, item) => sum + ((item.qty || 0) * (item.price || 0)), 0);
    };

    // --- Suppliers ---
    const getSuppliers = () => _state.suppliers;
    const saveSuppliers = (data) => {
        _state.suppliers = data;
        save(KEYS.SUPPLIERS, data);
    };

    // --- Repairs ---
    const getRepairs = () => _state.repairJobs;
    const saveRepairs = (data) => {
        _state.repairJobs = data;
        save(KEYS.REPAIRS, data);
    };
    const getCompletedRepairRevenue = (monthDate) => {
        return _state.repairJobs
            .filter(job => {
                if (job.status !== 'Completed') return false;
                const d = new Date(job.createdAt);
                return d.getMonth() === monthDate.getMonth() && d.getFullYear() === monthDate.getFullYear();
            })
            .reduce((sum, job) => sum + (job.price + (job.extraCharges || 0)), 0);
    };

    // --- AMC ---
    const getAmc = () => _state.amcContracts;
    const saveAmc = (data) => {
        _state.amcContracts = data;
        save(KEYS.AMC, data);
    };
    const getAmcMonthlyRevenue = (monthDate) => {
        return _state.amcContracts
            .filter(amc => {
                const d = new Date(amc.createdAt);
                return d.getMonth() === monthDate.getMonth() && d.getFullYear() === monthDate.getFullYear();
            })
            .reduce((sum, amc) => sum + (parseFloat(amc.amount) || 0), 0);
    };

    // --- Employees ---
    const getEmployees = () => _state.employees;
    const saveEmployees = (data) => {
        _state.employees = data;
        save(KEYS.EMPLOYEES, data);
    };
    const getPayrollExpense = (monthYear) => {
        // monthYear format: "Mar 2026" or "all"
        return _state.employees.reduce((sum, emp) => {
            const base = emp.baseSalary || 0;
            const extras = (emp.expenses || [])
                .filter(exp => monthYear === 'all' || exp.monthYear === monthYear)
                .reduce((s, e) => s + e.amount, 0);
            return sum + base + extras;
        }, 0);
    };

    // --- CRM ---
    const getCrmHistory = () => _state.crmHistory;
    const saveCrmHistory = (data) => {
        _state.crmHistory = data;
        save(KEYS.CRM, data);
    };

    // --- Service Calls ---
    const getServiceCalls = () => _state.serviceCalls;
    const saveServiceCalls = (data) => {
        _state.serviceCalls = data;
        save(KEYS.SERVICECALLS, data);
    };

    // --- Non-AMC Service Calls ---
    const getNonAmcCalls = () => _state.nonAmcCalls;
    const saveNonAmcCalls = (data) => {
        _state.nonAmcCalls = data;
        save(KEYS.NONAMCCALLS, data);
    };

    // --- Transactions ---
    const getTransactions = () => _state.transactions;
    const getTransactionProfit = () => {
        return _state.transactions
            .filter(t => t.type === 'Sale')
            .reduce((sum, t) => {
                const profitPerUnit = t.rate - (t.buyRate || 0);
                return sum + (profitPerUnit * t.qty);
            }, 0);
    };

    // Integrated Net Profit Calculation for Dashboard
    const getCalculatedNetProfit = (targetDate = new Date()) => {
        const salesProfit = getTransactionProfit();
        const repairProfit = getCompletedRepairRevenue(targetDate);
        const amcProfit = getAmcMonthlyRevenue(targetDate);

        // Match current month-year string format for payroll filter (e.g., "Mar 2026")
        const monthLabel = targetDate.toLocaleString('default', { month: 'short' }) + ' ' + targetDate.getFullYear();
        const payroll = getPayrollExpense(monthLabel);

        // Transaction profit for current month only
        const currentMonthSalesProfit = _state.transactions
            .filter(t => {
                if (t.type !== 'Sale') return false;
                const d = new Date(t.timestamp || t.date);
                return d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear();
            })
            .reduce((sum, t) => {
                const profitPerUnit = t.rate - (t.buyRate || 0);
                return sum + (profitPerUnit * t.qty || 0);
            }, 0);

        return (currentMonthSalesProfit + repairProfit + amcProfit) - payroll;
    };

    // --- Global Data Hub (Backup/Restore) ---
    const exportFullBackup = () => {
        const backup = {};
        Object.keys(KEYS).forEach(key => {
            const storageKey = KEYS[key];
            try {
                backup[storageKey] = JSON.parse(localStorage.getItem(storageKey)) || [];
            } catch (e) { backup[storageKey] = []; }
        });

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DOT_SYSTEM_DB_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const importFullBackup = (jsonData) => {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            Object.values(KEYS).forEach(storageKey => {
                if (data[storageKey]) {
                    localStorage.setItem(storageKey, JSON.stringify(data[storageKey]));
                }
            });
            return { success: true };
        } catch (err) {
            console.error('Import Failed:', err);
            return { success: false, error: err.message };
        }
    };

    // Run init on Script Load
    init();

    return {
        getInventory, saveInventory, getInventoryValue,
        getSuppliers, saveSuppliers,
        getRepairs, saveRepairs, getCompletedRepairRevenue,
        getAmc, saveAmc, getAmcMonthlyRevenue,
        getEmployees, saveEmployees, getPayrollExpense,
        getCrmHistory, saveCrmHistory,
        getTransactions, updateStock, getTransactionProfit, saveTransactions,
        getNextDMNumber, getNextInvoiceNumber, cancelDM,
        getServiceCalls, saveServiceCalls,
        getNonAmcCalls, saveNonAmcCalls,
        getCalculatedNetProfit,
        getTrash, moveToTrash, restoreFromTrash,
        exportFullBackup,
        importFullBackup,
        KEYS
        // this is an extensive Keys contract this should be confidential // 
    };
})();
