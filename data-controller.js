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
        trash: [],
        users: {},
        pulse: [],
        expenses: []
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
        INV_COUNTER: 'tally_inv_counter',
        USERS: 'dotsystem_users',
        PULSE: 'dotsystem_pulse',
        EXPENSES: 'dotsystem_expenses'
    };

    // Load all data into cache once
    const fallbackInit = () => {
        const safeParse = (key, defaultVal) => {
            try {
                const item = localStorage.getItem(key);
                if (item === null || item === 'undefined' || item === 'NaN' || item === '[object Object]') return defaultVal;
                return JSON.parse(item) || defaultVal;
            } catch (e) {
                console.warn(`Corrupted localStorage for ${key}, resetting.`);
                return defaultVal;
            }
        };

        _state.inventory = safeParse(KEYS.INVENTORY, []);
        _state.suppliers = safeParse(KEYS.SUPPLIERS, []);
        _state.repairJobs = safeParse(KEYS.REPAIRS, []);
        _state.amcContracts = safeParse(KEYS.AMC, []);
        _state.employees = safeParse(KEYS.EMPLOYEES, []);
        _state.crmHistory = safeParse(KEYS.CRM, {});
        _state.transactions = safeParse(KEYS.TRANSACTIONS, []);
        _state.serviceCalls = safeParse(KEYS.SERVICECALLS, []);
        _state.nonAmcCalls = safeParse(KEYS.NONAMCCALLS, []);
        _state.trash = safeParse(KEYS.TRASH, []);
        _state.expenses = safeParse(KEYS.EXPENSES, []);
        _state.users = safeParse(KEYS.USERS, {});
        _state.pulse = safeParse(KEYS.PULSE, []);

        // Cleanup trash > 30 days
        const limitDate = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const originalLength = (_state.trash || []).length;
        _state.trash = (_state.trash || []).filter(item => item && item.deletedAt > limitDate);
        if ((_state.trash || []).length !== originalLength) {
            fallbackSave(KEYS.TRASH, _state.trash);
        }

        console.log('📦 DataController: Initialized Local PWA Cache.');
        window.dispatchEvent(new CustomEvent('dataUpdate', { detail: { key: 'ALL' } }));
    };

    const fallbackSave = (key, data) => {
        localStorage.setItem(key, JSON.stringify(data));
        window.dispatchEvent(new CustomEvent('dataUpdate', { detail: { key } }));
    };

    // ── Supabase Cloud Engine (Production Sync) ────────────────
    let _syncTimeout = null;

    const syncWithSupabase = async () => {
        console.log('📡 Sync Engine: Connecting to Supabase Cloud...');
        try {
            const cloudData = await SupabaseDB.getData();

            if (!cloudData) {
                console.warn('📂 Cloud Database is empty. Initializing with current local cache...');
                queueCloudSync(0); // Immediate upload
                return;
            }

            // Standard merge: Take cloud data as truth, fallback to local if missing
            _state.inventory    = cloudData.inventory    || _state.inventory;
            _state.suppliers    = cloudData.suppliers    || _state.suppliers;
            _state.repairJobs   = cloudData.repairJobs   || _state.repairJobs;
            _state.amcContracts = cloudData.amcContracts || _state.amcContracts;
            _state.employees    = cloudData.employees    || _state.employees;
            _state.transactions = cloudData.transactions || _state.transactions;
            _state.serviceCalls = cloudData.serviceCalls || _state.serviceCalls;
            _state.nonAmcCalls  = cloudData.nonAmcCalls  || _state.nonAmcCalls;
            _state.expenses     = cloudData.expenses     || _state.expenses;
            _state.trash        = cloudData.trash        || _state.trash;
            _state.pulse        = cloudData.pulse        || _state.pulse;
            _state.users        = cloudData.users        || _state.users;
            _state.crmHistory   = cloudData.crmHistory   || _state.crmHistory;

            console.log('✅ Sync Engine: Cloud Parity achieved.');
            window.dispatchEvent(new CustomEvent('dataUpdate', { detail: { key: 'ALL' } }));
        } catch (err) {
            console.error('❌ Sync Engine Error:', err.message);
        }
    };

    const queueCloudSync = (delay = 5000) => {
        if (_syncTimeout) clearTimeout(_syncTimeout);
        _syncTimeout = setTimeout(async () => {
            console.log('💾 Sync Engine: Saving to Supabase...');
            const success = await SupabaseDB.saveData(_state);
            if (success) {
                console.log('✅ Sync Engine: Cloud Persistence Successful.');
            } else {
                console.error('❌ Sync Engine: Cloud Persistence Failed.');
            }
        }, delay);
    };


    const init = () => {
        // Load Local PWA cache first for instant startup
        fallbackInit();
        // Then reconcile with Supabase Cloud
        syncWithSupabase();
    };

    const save = (key, data) => {
        // 1. Instant UI update via LocalStorage
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('LocalStorage persistence failed:', e);
        }

        window.dispatchEvent(new CustomEvent('dataUpdate', { detail: { key } }));

        // 2. Debounced Cloud Storage (saves every 5 seconds)
        queueCloudSync();
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
            gstRate: item.gstRate || 18,
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
        return revertBatch(null, dmNumber);
    };

    const revertTransaction = (trId) => {
        const trIndex = _state.transactions.findIndex(t => t.id === trId);
        if (trIndex === -1) return { success: false, reason: 'Transaction not found' };
        
        const tr = _state.transactions[trIndex];
        const item = _state.inventory.find(i => i.id === tr.itemId);
        
        if (item) {
            // Revert stock impact
            if (tr.type === 'Sale' || tr.type === 'DM-Out') {
                item.qty += tr.qty;
                if (tr.type === 'Sale') item.totalSold = (parseFloat(item.totalSold) || 0) - tr.qty;
            } else if (tr.type === 'Purchase' || tr.type === 'DM-In' || tr.type === 'Initial') {
                item.qty -= tr.qty;
                if (tr.type === 'Purchase') item.totalPurchased = (parseFloat(item.totalPurchased) || 0) - tr.qty;
            }
        }

        _state.transactions.splice(trIndex, 1);
        save(KEYS.INVENTORY, _state.inventory);
        save(KEYS.TRANSACTIONS, _state.transactions);
        return { success: true };
    };

    const revertBatch = (batchId, dmNumber = null) => {
        const toRevert = _state.transactions.filter(t => 
            (batchId && t.batchId == batchId) || (dmNumber && t.dmNumber == dmNumber)
        );
        
        if (toRevert.length === 0) return { success: false, reason: 'Batch not found' };

        toRevert.forEach(tr => {
            const item = _state.inventory.find(i => i.id === tr.itemId);
            if (item) {
                if (tr.type === 'Sale' || tr.type === 'DM-Out') {
                    item.qty += tr.qty;
                    if (tr.type === 'Sale') item.totalSold = (parseFloat(item.totalSold) || 0) - tr.qty;
                } else if (tr.type === 'Purchase' || tr.type === 'DM-In' || tr.type === 'Initial') {
                    item.qty -= tr.qty;
                    if (tr.type === 'Purchase') item.totalPurchased = (parseFloat(item.totalPurchased) || 0) - tr.qty;
                }
            }
        });

        _state.transactions = _state.transactions.filter(t => 
            !((batchId && t.batchId == batchId) || (dmNumber && t.dmNumber == dmNumber))
        );

        save(KEYS.INVENTORY, _state.inventory);
        save(KEYS.TRANSACTIONS, _state.transactions);
        return { success: true, count: toRevert.length };
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
                const rate = parseFloat(t.rate) || 0;
                const buyRate = parseFloat(t.buyRate) || 0;
                const qty = parseFloat(t.qty) || 0;
                const profitPerUnit = rate - buyRate;
                return sum + (profitPerUnit * qty);
            }, 0);
    };

    // Integrated Net Profit Calculation for Dashboard
    const getCalculatedNetProfit = (targetDate = new Date()) => {
        // Transaction profit for current month only
        const currentMonthSalesProfit = _state.transactions
            .filter(t => {
                if (t.type !== 'Sale') return false;
                const d = new Date(t.timestamp || t.date);
                return d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear();
            })
            .reduce((sum, t) => {
                const gstRate = parseFloat(t.gstRate || 18);
                // Remove GST liability from revenue for accurate Net Profit
                const baseRate = parseFloat(t.rate) / (1 + (gstRate / 100));
                const buyRate = parseFloat(t.buyRate) || 0;
                const qty = parseFloat(t.qty) || 0;
                const profitPerUnit = baseRate - buyRate;
                return sum + (profitPerUnit * qty);
            }, 0);

        const repairProfit = parseFloat(getCompletedRepairRevenue(targetDate)) || 0;
        const amcProfit = parseFloat(getAmcMonthlyRevenue(targetDate)) || 0;

        // Match current month-year string format for payroll filter (e.g., "Mar 2026")
        const monthLabel = targetDate.toLocaleString('default', { month: 'short' }) + ' ' + targetDate.getFullYear();
        const payroll = parseFloat(getPayrollExpense(monthLabel)) || 0;

        const officeOverheads = (_state.expenses || [])
            .filter(e => {
                const d = new Date(e.date);
                return d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear();
            })
            .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        return (currentMonthSalesProfit + repairProfit + amcProfit) - (payroll + officeOverheads);
    };

    // --- Expenses ---
    const getExpenses = () => _state.expenses || [];
    const saveExpenses = (data) => {
        _state.expenses = data;
        save(KEYS.EXPENSES, data);
    };

    // --- Elite Analytics ---
    const getBurnRateReport = () => {
        const report = [];
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        
        _state.inventory.forEach(item => {
            // Find sales of this item in last 30 days
            const recentSales = _state.transactions.filter(t => 
                t.itemId === item.id && 
                t.type === 'Sale' && 
                new Date(t.timestamp).getTime() > thirtyDaysAgo
            ).reduce((sum, t) => sum + (parseFloat(t.qty) || 0), 0);

            const dailyBurn = recentSales / 30;
            const daysLeft = dailyBurn > 0 ? (item.qty / dailyBurn) : Infinity;

            if (item.qty > 0 && daysLeft !== Infinity) {
                const oosDate = new Date();
                oosDate.setDate(oosDate.getDate() + daysLeft);
                report.push({ ...item, dailyBurn, daysLeft, oosDate });
            }
        });
        return report.sort((a, b) => a.daysLeft - b.daysLeft);
    };

    const getCustomerCLV = () => {
        const clvMap = {};
        
        // From Sales Transactions
        _state.transactions.filter(t => t.type === 'Sale').forEach(t => {
            const org = t.whom || 'Unknown';
            if (!clvMap[org]) clvMap[org] = { revenue: 0, repairs: 0, purchases: 0 };
            clvMap[org].revenue += parseFloat(t.totalValue) || 0;
            clvMap[org].purchases += 1;
        });

        // From Repairs
        _state.repairJobs.filter(j => j.status === 'Completed').forEach(j => {
            const name = j.customerName || 'Unknown';
            const price = (parseFloat(j.price) || 0) + (parseFloat(j.extraCharges) || 0);
            if (!clvMap[name]) clvMap[name] = { revenue: 0, repairs: 0, purchases: 0 };
            clvMap[name].revenue += price;
            clvMap[name].repairs += 1;
        });

        // Form Rank Array
        return Object.entries(clvMap)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue);
    };

    // --- Global Data Hub (Backup/Restore) ---
    const exportFullBackup = () => {
        if (!isAdmin()) {
            console.warn('Unauthorized export attempt');
            return;
        }
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
        if (!isAdmin()) {
            console.warn('Unauthorized import attempt');
            return { success: false, error: 'Unauthorized' };
        }
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

    const isAdmin = () => {
        const auth = JSON.parse(localStorage.getItem('dotsystem_auth_data') || '{}');
        const role = auth.role || 'staff';
        // Staff don't need 2FA, but Admins MUST be verified
        if (role === 'admin') {
            return auth.twoStepVerified === true;
        }
        return false;
    };

    const seedUsers = () => {
        if (!_state.users || Object.keys(_state.users).length === 0) {
            const initialUsers = {
                "Sudipto": { role: "staff", name: "Sudipto" },
                "Pankaj": { role: "staff", name: "Pankaj" },
                "Shashikant": { role: "admin", name: "Shashikant" },
                "Prajakta": { role: "admin", name: "Prajakta" }
            };
            if (window.FirebaseDB && window.FirebaseDB.database) {
                // Check if collection exists first to avoid overwriting manually changed passwords
                window.FirebaseDB.database.ref(KEYS.USERS).once('value', snapshot => {
                    if (!snapshot.exists()) {
                        window.FirebaseDB.database.ref(KEYS.USERS).set(initialUsers);
                    }
                });
            }
        }
    };

    const logActivity = (action, details, type = 'info') => {
        const auth = JSON.parse(localStorage.getItem('dotsystem_auth_data') || '{}');
        const user = auth.name || 'System';
        
        const logEntry = {
            id: 'log_' + Date.now() + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            user: user,
            role: auth.role || 'staff',
            action: action,
            details: details,
            type: type
        };

        _state.pulse = [logEntry, ...(_state.pulse || [])].slice(0, 100);
        save(KEYS.PULSE, _state.pulse);
        console.log(`📡 System Pulse: ${user} - ${action}`);
    };

    // Run init on Script Load
    init();
    
    // Seed users if empty (delayed to ensure firebase init)
    setTimeout(seedUsers, 2000);

    return {
        getInventory, saveInventory, getInventoryValue,
        getSuppliers, saveSuppliers,
        getRepairs, saveRepairs, getRepairJobs: getRepairs, saveRepairJobs: saveRepairs, getCompletedRepairRevenue,
        getAmc, saveAmc, getAmcMonthlyRevenue,
        getEmployees, saveEmployees, getPayrollExpense,
        getCrmHistory, saveCrmHistory,
        getTransactions, updateStock, getTransactionProfit, saveTransactions,
        getNextDMNumber, getNextInvoiceNumber, cancelDM, revertTransaction, revertBatch,
        getServiceCalls, saveServiceCalls,
        getNonAmcCalls, saveNonAmcCalls,
        getCalculatedNetProfit,
        getTrash, moveToTrash, restoreFromTrash,
        getPulse: () => _state.pulse || [],
        getExpenses, saveExpenses,
        getBurnRateReport, getCustomerCLV,
        logActivity,
        exportFullBackup,
        importFullBackup,
        isAdmin: () => {
             const auth = JSON.parse(localStorage.getItem('dotsystem_auth_data') || '{}');
             return auth.role === 'admin' && auth.twoStepVerified === true;
        },
        getCurrentUser: () => JSON.parse(localStorage.getItem('dotsystem_auth_data') || '{}'),
        KEYS
    };
})();
