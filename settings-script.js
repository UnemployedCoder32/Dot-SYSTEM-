document.addEventListener('DOMContentLoaded', () => {
    // --- Master Settings Keys ---
    const SETTINGS_KEY = 'dot_system_settings';
    
    // --- Default Settings ---
    const DEFAULT_SETTINGS = {
        // 1. Business
        bizName: 'DOT SYSTEM',
        ownerName: '',
        gstNum: '',
        bizAddr: '',
        bizCity: '',
        bizPin: '',
        bizPhone: '',
        bizEmail: '',
        logo: null,
        
        // 2. Invoice
        pdfGst: 18,
        pdfPrefix: 'INV-',
        pdfStartNum: 1001,
        pdfDesc1: 'Goods once sold will not be taken back.',
        pdfDesc2: 'This is a computer generated invoice.',
        showBadge: true,
        
        // 3. Financial
        curSymbol: '₹',
        fyStart: 3,
        lowStockLimit: 5,
        autoDeduct: true,
        
        // 4. Payroll
        expenseCats: ['Petrol', 'Meals', 'Bonuses', 'Travel', 'Internet'],
        payrollCycle: 'monthly',
        payrollReset: true,
        
        // 5. Notifications
        amcAlertDays: 30,
        notifLowStock: true,
        notifOverdue: true,
        notifVisits: true,
        notifSound: true,
        
        // 6. Calendar
        calendarStart: 1,
        calShowAmc: true,
        calShowVisits: true,
        calShowRepairs: true,
        
        // 8. Appearance
        theme: 'dark',
        accent: '#00d4ff',
        compactMode: false,
        
        // 9. Integrations
        waTemplate: 'Hi, your service for {item} is scheduled for {date}. Regds, DOT System.',
        tallyPath: ''
    };

    let settings = { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) };

    // --- DOM Elements ---
    const saveAllBtn = document.getElementById('saveAllBtn');
    const accentColorInput = document.getElementById('accentColor');
    const accentPreview = document.getElementById('accentPreview');
    const logoUpload = document.getElementById('logoUpload');
    const logoPreview = document.getElementById('logoPreview');
    const expenseCategoryList = document.getElementById('expenseCategoryList');
    const dangerModal = document.getElementById('dangerModal');
    const dangerText = document.getElementById('dangerModalText');
    const dangerConfirmBtn = document.getElementById('dangerConfirmBtn');

    // --- Initialization ---
    const init = () => {
        loadFields();
        renderExpenseCategories();
        applyAppearance();
        setupEventListeners();
        if (window.loadActivityLog) loadActivityLog();
    };

    const loadFields = () => {
        // Auto-map simple inputs
        Object.keys(settings).forEach(key => {
            // Handle special mapping for compactModeToggle
            const elementId = (key === 'compactMode') ? 'compactModeToggle' : key;
            const el = document.getElementById(elementId);
            
            if (!el) return;

            if (el.type === 'checkbox') {
                el.checked = settings[key];
            } else if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.value = settings[key];
            }
        });

        // Special: Logo
        if (settings.logo) {
            logoPreview.innerHTML = `<img src="${settings.logo}" style="width: 100%; height: 100%; object-fit: contain;">`;
        }

        // Special: Accent Preview
        accentPreview.style.background = settings.accent;
    };

    const setupEventListeners = () => {
        // Logo Upload
        logoUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                settings.logo = event.target.result;
                logoPreview.innerHTML = `<img src="${settings.logo}" style="width: 100%; height: 100%; object-fit: contain;">`;
            };
            reader.readAsDataURL(file);
        });

        // Accent Color
        accentColorInput.addEventListener('input', (e) => {
            const color = e.target.value;
            settings.accent = color;
            accentPreview.style.background = color;
            applyAppearance();
        });

        // Theme Select
        document.getElementById('themeSelect').addEventListener('change', (e) => {
            settings.theme = e.target.value;
            applyAppearance();
        });

        // GST Validation
        document.getElementById('gstNum').addEventListener('blur', (e) => {
            const val = e.target.value.trim().toUpperCase();
            e.target.value = val;
            const errDiv = document.getElementById('gstinError');
            if (!val) {
                if(errDiv) errDiv.style.display = 'none';
                e.target.style.borderColor = '';
                return;
            }
            const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            if (!gstRegex.test(val)) {
                if(errDiv) errDiv.style.display = 'block';
                e.target.style.borderColor = '#ef4444';
            } else {
                if(errDiv) errDiv.style.display = 'none';
                e.target.style.borderColor = '#10b981';
            }
        });

        // Compact Mode
        document.getElementById('compactModeToggle').addEventListener('change', (e) => {
            settings.compactMode = e.target.checked;
            applyAppearance();
        });

        // Global Save
        saveAllBtn.addEventListener('click', () => {
            saveState();
            // Pulse animation on button
            saveAllBtn.style.transform = 'scale(0.95)';
            setTimeout(() => saveAllBtn.style.transform = 'scale(1)', 100);
        });

        // Import
        document.getElementById('importBackup').addEventListener('change', importData);
    };

    const renderExpenseCategories = () => {
        expenseCategoryList.innerHTML = '';
        settings.expenseCats.forEach((cat, index) => {
            const tag = document.createElement('div');
            tag.className = 'pill-cyan-outline';
            tag.innerHTML = `
                ${cat}
                <i class="fa-solid fa-xmark" style="cursor: pointer; opacity: 0.8; font-size: 10px;" onclick="removeExpenseCategory(${index})"></i>
            `;
            expenseCategoryList.appendChild(tag);
        });
    };

    window.addExpenseCategory = () => {
        const input = document.getElementById('newExpenseCat');
        const val = input.value.trim();
        if (val && !settings.expenseCats.includes(val)) {
            settings.expenseCats.push(val);
            input.value = '';
            renderExpenseCategories();
        }
    };

    window.removeExpenseCategory = (index) => {
        settings.expenseCats.splice(index, 1);
        renderExpenseCategories();
    };

    const applyAppearance = () => {
        // Theme
        document.body.className = settings.theme === 'light' ? 'light-theme' : 'dark-theme';
        if (settings.compactMode) document.body.classList.add('compact-mode');

        // Accent Variables
        document.documentElement.style.setProperty('--accent', settings.accent);
        document.documentElement.style.setProperty('--accent-glow', settings.accent + '33');
        
        // Notify theme system if it exists globally
        if (window.bootUI) window.bootUI();
    };

    const saveState = () => {
        // Collect all simple fields back into settings object
        Object.keys(DEFAULT_SETTINGS).forEach(key => {
            const elementId = (key === 'compactMode') ? 'compactModeToggle' : key;
            const el = document.getElementById(elementId);
            
            if (!el) return;

            if (el.type === 'checkbox') {
                settings[key] = el.checked;
            } else if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.type === 'number') {
                    settings[key] = parseFloat(el.value);
                } else {
                    settings[key] = el.value;
                }
            }
        });

        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        
        // Update complementary keys for tools that use them directly
        localStorage.setItem('dot_company_settings', JSON.stringify({
            name: settings.bizName,
            address: settings.bizAddr,
            phone: settings.bizPhone,
            email: settings.bizEmail,
            gst: settings.gstNum,
            prefix: settings.pdfPrefix,
            gstRate: settings.pdfGst
        }));

        // Explicitly sync theme variables
        localStorage.setItem('dot_theme_mode', settings.theme);
        localStorage.setItem('dot_accent_color', settings.accent);
        localStorage.setItem('dot_compact_mode', settings.compactMode);

        if (window.showToast) showToast('Settings synchronized successfully!');
    };

    // --- Data & Security ---
    window.loadActivityLog = () => {
        const tbody = document.getElementById('activityLogTableBody');
        if (!tbody) return;
        const logs = JSON.parse(localStorage.getItem('dot_system_activity_log')) || [];
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" style="padding: 14px; text-align: center; color: #64748b;">No recent activity found.</td></tr>';
            return;
        }
        tbody.innerHTML = logs.map(log => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 10px 14px; color: #cbd5e1; font-size: 12px;">${log.time}</td>
                <td style="padding: 10px 14px; color: #e2e8f0;">${log.desc}</td>
            </tr>
        `).join('');
    };

    window.clearActivityLog = () => {
        localStorage.removeItem('dot_system_activity_log');
        loadActivityLog();
        if (window.showToast) showToast('Activity log cleared.', 'info');
    };

    window.exportFullBackup = () => {
        const backup = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            backup[key] = localStorage.getItem(key);
        }
        
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DOT_SYSTEM_FULL_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const importData = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const backup = JSON.parse(event.target.result);
                openDangerModal(
                    'This will overwrite all existing data in the system with this backup file.',
                    () => {
                        localStorage.clear();
                        Object.entries(backup).forEach(([key, val]) => {
                            localStorage.setItem(key, val);
                        });
                        location.reload();
                    }
                );
            } catch (err) {
                alert('Invalid Backup File');
            }
        };
        reader.readAsText(file);
    };

    window.clearModuleData = () => {
        const module = document.getElementById('clearModuleSelect').value;
        if (!module) return;

        const moduleKeys = {
            repairs: 'tally_repair_jobs',
            amc: 'hardware_sync_amc',
            visits: 'tally_service_calls',
            transactions: 'tally_transactions'
        };

        const key = moduleKeys[module];
        openDangerModal(
            `Permanently delete all records in the ${module.toUpperCase()} module?`,
            () => {
                localStorage.removeItem(key);
                showToast(`${module.toUpperCase()} data wiped.`);
            }
        );
    };

    window.resetEntireSystem = () => {
        openDangerModal(
            'CRITICAL: This will factory reset the entire application and delete ALL data permanently.',
            () => {
                localStorage.clear();
                location.reload();
            }
        );
    };

    // --- Danger Modal ---
    const openDangerModal = (text, callback) => {
        dangerText.innerText = text;
        dangerModal.style.display = 'flex';
        dangerConfirmBtn.onclick = () => {
            callback();
            closeDangerModal();
        };
    };

    window.closeDangerModal = () => {
        dangerModal.style.display = 'none';
    };

    init();
});
