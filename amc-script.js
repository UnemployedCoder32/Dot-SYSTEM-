document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let amcContracts = DataController.getAmc();
    let crmHistory = DataController.getCrmHistory();
    let employees = DataController.getEmployees();
    let serviceCalls = DataController.getServiceCalls();
    let currentFilter = null; // To track service history filter

    // --- DOM ---
    const amcForm = document.getElementById('amcForm');
    const amcGrid = document.getElementById('amcGrid');
    const expiredAmcGrid = document.getElementById('expiredAmcGrid');
    const expiredHeader = document.getElementById('expiredHeader');
    const totalAmcsBadge = document.getElementById('totalAmcs');
    const totalExpiredBadge = document.getElementById('totalExpiredAmcs');
    const crmIndicator = document.getElementById('crmIndicator');
    const orgInput = document.getElementById('orgName');
    const contactInput = document.getElementById('contactPerson');

    const serviceCallForm = document.getElementById('serviceCallForm');
    const callOrgSelect = document.getElementById('callOrg');
    const callTechSelect = document.getElementById('callTech');
    const serviceHistoryList = document.getElementById('serviceHistoryList');
    const emptyHistoryRow = document.getElementById('emptyHistoryRow');
    const totalCallsBadge = document.getElementById('totalCalls');
    const historyFilterTag = document.getElementById('historyFilterTag');
    const clearHistoryFilterBtn = document.getElementById('clearHistoryFilter');

    // --- Utilities ---
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2
        }).format(amount);
    };

    const validatePhone = (phone) => {
        return /^\d{10}$/.test(phone);
    };

    const saveState = () => {
        DataController.saveAmc(amcContracts);
        DataController.saveCrmHistory(crmHistory);
        DataController.saveServiceCalls(serviceCalls);
    };

    const calculateNextService = (startDate) => {
        const start = new Date(startDate);
        const today = new Date();
        
        // Default 90 day frequency
        let nextService = new Date(start);
        while (nextService <= today) {
            nextService.setDate(nextService.getDate() + 90);
        }
        return nextService;
    };

    const getStatusColor = (endDate) => {
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'danger';
        if (diffDays <= 30) return 'warning';
        return '';
    };

    const getUrgencyStyle = (endDate) => {
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0)  return { border: '#ef4444', bg: 'rgba(239,68,68,0.04)', label: 'EXPIRED', labelColor: '#ef4444' };
        if (diffDays <= 30) return { border: '#f59e0b', bg: 'rgba(245,158,11,0.04)', label: `${diffDays}d left`, labelColor: '#f59e0b' };
        if (diffDays <= 60) return { border: '#eab308', bg: 'rgba(234,179,8,0.04)', label: `${diffDays}d left`, labelColor: '#eab308' };
        return { border: '#10b981', bg: 'rgba(16,185,129,0.04)', label: `${diffDays}d left`, labelColor: '#10b981' };
    };

    const getStatusLabel = (endDate) => {
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return end < today ? 'EXPIRED' : 'ACTIVE';
    };


    // --- Asset Row Management ---
    const assetListContainer = document.getElementById('assetListContainer');
    const addAssetBtn = document.getElementById('addAssetBtn');

    const addAssetRow = (data = { name: '', qty: 1, notes: '' }) => {
        const rowId = 'row_' + Date.now() + Math.random().toString(36).substr(2, 5);
        const row = document.createElement('div');
        row.className = 'asset-row fade-in';
        row.id = rowId;
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1fr 80px 1fr 40px';
        row.style.gap = '0.5rem';
        row.style.alignItems = 'center';

        row.innerHTML = `
            <input type="text" placeholder="Product Name" value="${data.name}" class="asset-name" required>
            <input type="number" placeholder="Qty" value="${data.qty}" class="asset-qty" min="1" required>
            <input type="text" placeholder="Notes (S/N, etc)" value="${data.notes}" class="asset-notes">
            <button type="button" onclick="document.getElementById('${rowId}').remove()" class="btn-delete" style="padding: 0.5rem; color: var(--danger);">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        assetListContainer.appendChild(row);
    };

    if (addAssetBtn) {
        addAssetBtn.addEventListener('click', () => addAssetRow());
    }

    // Add initial row
    if (assetListContainer && assetListContainer.children.length === 0) {
        addAssetRow();
    }

    const renderAmcs = () => {
        const today = new Date();
        today.setHours(0,0,0,0);

        const activeAmcs = amcContracts.filter(a => new Date(a.endDate) >= today);
        const expiredAmcs = amcContracts.filter(a => new Date(a.endDate) < today);

        const populateGrid = (grid, list, badge, isEmpty) => {
            grid.innerHTML = '';
            if (list.length === 0) {
                grid.innerHTML = `<div class="glass-card" style="grid-column: 1/-1; text-align: center; padding: 2rem; opacity: 0.5;">No ${isEmpty} contracts found.</div>`;
                badge.textContent = `0 ${isEmpty}`;
                return;
            }
            list.forEach((amc, index) => {
                const statusClass = getStatusColor(amc.endDate);
                const urgency = getUrgencyStyle(amc.endDate);
                const nextService = calculateNextService(amc.startDate);
                
                const card = document.createElement('div');
                card.className = `amc-card ${statusClass} collapsible-card fade-in`;
                card.style.animationDelay = `${index * 0.05}s`;
                card.style.borderLeft = `4px solid ${urgency.border}`;
                card.style.background = `var(--card-bg, rgba(15,23,42,0.6))`;

                // Service call usage for this contract
                const contractCalls = serviceCalls.filter(sc => sc.orgId === amc.id);
                const maxCalls = amc.maxCalls || 12;
                const usedCalls = contractCalls.length;
                const callPct = Math.min((usedCalls / maxCalls) * 100, 100);

            // Prepare Assets HTML
            let assetsHtml = 'No assets listed.';
            if (amc.assets && Array.isArray(amc.assets) && amc.assets.length > 0) {
                assetsHtml = amc.assets.map(asset => `
                    <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px dotted var(--border); font-size: 0.8rem;">
                        <span style="flex: 1; font-weight: 600;">${escapeXml(asset.name)}</span>
                        <span style="width: 40px; text-align: center; color: var(--accent);">${asset.qty}</span>
                        <span style="flex: 1; text-align: right; opacity: 0.7;">${escapeXml(asset.notes || '')}</span>
                    </div>
                `).join('');
            } else if (typeof amc.assets === 'string' && amc.assets.trim()) {
                assetsHtml = escapeXml(amc.assets);
            }

            // AMC KPI Logic
            const estCost = amc.amount * 0.2; // approx 20% cost
            const profitScore = ((amc.amount - estCost) / Math.max(amc.amount, 1)) * 100;

            const sDate = new Date(amc.startDate || amc.createdAt);
            const eDate = new Date(amc.endDate);
            const todayDate = new Date();
            const totalDuration = eDate - sDate;
            const elapsed = todayDate - sDate;
            let elapsedPct = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 100;
            if (elapsedPct > 100) elapsedPct = 100;
            if (elapsedPct < 0) elapsedPct = 0;

            const billedRev = amc.amount * (elapsedPct / 100);
            const remainRev = amc.amount - billedRev;

                card.innerHTML = `
                    <div class="card-summary" onclick="this.parentElement.classList.toggle('expanded')">
                        <div class="summary-main">
                            <div class="org-name" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                ${escapeXml(amc.orgName)}
                                <span style="font-size: 0.65rem; background: rgba(0,0,0,0.2); color: ${profitScore >= 70 ? '#10b981' : '#f59e0b'}; padding: 0.1rem 0.3rem; border-radius: 4px; border: 1px solid currentColor;">Profit: ${profitScore.toFixed(0)}%</span>
                                <span style="font-size: 0.65rem; color: ${urgency.labelColor}; padding: 0.1rem 0.3rem; border-radius: 4px; border: 1px solid ${urgency.labelColor}; background: ${urgency.bg}; font-weight: 700;">${urgency.label}</span>
                            </div>
                            <div class="due-info">Next Visit: ${new Date(amc.nextServiceDate || nextService).toLocaleDateString()}</div>
                        </div>
                        <div class="summary-side">
                            <div class="price-pill">${formatCurrency(amc.amount)}</div>
                            <i class="fa-solid fa-chevron-down expand-icon"></i>
                        </div>
                    </div>
                    
                    <div class="card-expanded-content">
                        <!-- KPI Metrics -->
                        <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px dotted var(--border);">
                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.3rem;">
                                <span>Timeline (${elapsedPct.toFixed(0)}% Elapsed)</span>
                                <span>${new Date(amc.endDate).toLocaleDateString()}</span>
                            </div>
                            <div style="width: 100%; height: 6px; background: rgba(0,0,0,0.3); border-radius: 3px; overflow: hidden;">
                                <div style="width: ${elapsedPct}%; height: 100%; background: var(--accent); border-radius: 3px;"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.8rem; margin-bottom: 0.3rem;">
                                <span>Service Calls Used: <strong style="color:${callPct >= 90 ? '#ef4444' : callPct >= 60 ? '#f59e0b' : '#10b981'}">${usedCalls}</strong> / ${maxCalls}</span>
                                <span>${(100-callPct).toFixed(0)}% remaining</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
                                <div style="width: ${callPct}%; height: 100%; background: ${callPct >= 90 ? '#ef4444' : callPct >= 60 ? '#f59e0b' : '#10b981'}; border-radius: 4px; transition: width 0.5s;"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.8rem; margin-bottom: 0.3rem;">
                                <span>Revenue: Billed vs Remaining</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: rgba(239, 68, 68, 0.2); border-radius: 4px; overflow: hidden; display: flex;" title="Billed: ₹${billedRev.toFixed(0)} | Remaining: ₹${remainRev.toFixed(0)}">
                                <div style="width: ${elapsedPct}%; height: 100%; background: #10b981;"></div>
                            </div>
                        </div>

                        <div class="amc-details">
                            <div class="amc-detail-item">
                                <span class="amc-label">Contact</span>
                                <span class="amc-value">${escapeXml(amc.contact)}</span>
                            </div>
                            <div class="amc-detail-item">
                                <span class="amc-label">Type</span>
                                <span class="amc-value">${amc.type}</span>
                            </div>
                            <div class="amc-detail-item">
                                <span class="amc-label">Billing</span>
                                <span class="amc-value">${amc.payCycle}</span>
                            </div>
                            <div class="amc-detail-item">
                                <span class="amc-label">Ends On</span>
                                <span class="amc-value" style="color: ${statusClass === 'danger' ? 'var(--danger)' : 'inherit'}">${new Date(amc.endDate).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div class="amc-assets">
                            <div style="font-weight: 700; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.2rem;">Assets Under Management</div>
                            <div style="max-height: 120px; overflow-y: auto;">
                                ${assetsHtml}
                            </div>
                        </div>
                        <div class="maintenance-log">
                            <div class="log-header">
                                <span>Maintenance Log</span>
                                <span style="font-size: 0.7rem;">Every 90 Days</span>
                            </div>
                            <ul class="log-list">
                                <li class="log-item">
                                    <input type="checkbox" class="service-checkbox" onchange="markServiceComplete('${amc.id}')">
                                    <span>Quarterly Visit (Mark Complete)</span>
                                </li>
                                ${(amc.maintenanceLog || []).map(log => `
                                    <li class="log-item" style="opacity: 0.7;">
                                        <i class="fa-solid fa-circle-check text-green"></i> 
                                        <span>Completed: ${new Date(log).toLocaleDateString()}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>

                        <div class="amc-actions" style="display: flex; gap: 0.75rem; align-items: center; margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1rem;">
                            <button class="btn btn-accent" onclick="exportAmcInvoice('${amc.id}')" title="Export XML">
                                <i class="fa-solid fa-file-code"></i> Tally
                            </button>
                            <button class="btn btn-secondary" onclick="downloadAmcInvoice('${amc.id}')" title="Download PDF">
                                <i class="fa-solid fa-file-pdf"></i> PDF
                            </button>
                            <button class="btn btn-primary" onclick="filterHistoryByAmc('${amc.id}')" title="View Call History" style="font-size: 0.75rem; padding: 0.4rem 0.6rem;">
                                <i class="fa-solid fa-clock-rotate-left"></i> History
                            </button>
                            <button class="btn btn-secondary" onclick="cloneContract('${amc.id}')" title="Clone Contract" style="padding: 0.4rem 0.6rem; margin-left: auto;">
                                <i class="fa-solid fa-copy"></i>
                            </button>
                            <button class="btn-delete" onclick="deleteAmc('${amc.id}')" title="Delete">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                        <div class="bluemark-signature" style="text-align: right; margin-top: 1rem;"><i class="fa-solid fa-circle-check"></i> BLUEMARK Authorized</div>
                    </div>
                `;
                grid.appendChild(card);
            });
            badge.textContent = `${list.length} ${isEmpty}`;
        };

        populateGrid(amcGrid, activeAmcs, totalAmcsBadge, 'Active');
        
        if (expiredAmcs.length > 0) {
            expiredHeader.style.display = 'block';
            expiredAmcGrid.style.display = 'grid';
            populateGrid(expiredAmcGrid, expiredAmcs, totalExpiredBadge, 'Expired');
        } else {
            expiredHeader.style.display = 'none';
            expiredAmcGrid.style.display = 'none';
        }

        populateCallDropdowns();
    };



    const populateCallDropdowns = () => {
        if (!callOrgSelect || !callTechSelect) return;

        // Populate Organizations
        const currentOrg = callOrgSelect.value;
        callOrgSelect.innerHTML = '<option value="" disabled selected>Choose an active AMC...</option>';
        amcContracts.forEach(amc => {
            const opt = document.createElement('option');
            opt.value = amc.id;
            opt.textContent = amc.orgName;
            callOrgSelect.appendChild(opt);
        });
        if (currentOrg) callOrgSelect.value = currentOrg;

        // Populate Technicians
        const currentTech = callTechSelect.value;
        callTechSelect.innerHTML = '<option value="" disabled selected>Assign Technician...</option>';
        employees.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.name;
            opt.textContent = emp.name;
            callTechSelect.appendChild(opt);
        });
        if (currentTech) callTechSelect.value = currentTech;

        // Enable Search
        if (typeof makeSearchableSelect === 'function') {
            makeSearchableSelect('callOrg', 'Search Organization...');
            makeSearchableSelect('callTech', 'Search Technician...');
        }
    };

    const renderServiceHistory = () => {
        if (!serviceHistoryList) return;

        let filteredCalls = serviceCalls;
        if (currentFilter) {
            filteredCalls = serviceCalls.filter(call => call.amcId === currentFilter);
            historyFilterTag.style.display = 'block';
            clearHistoryFilterBtn.style.display = 'block';
            const amc = amcContracts.find(a => a.id === currentFilter);
            historyFilterTag.textContent = `Filtered: ${amc ? amc.orgName : 'Unknown'}`;
        } else {
            historyFilterTag.style.display = 'none';
            clearHistoryFilterBtn.style.display = 'none';
        }

        if (filteredCalls.length === 0) {
            serviceHistoryList.innerHTML = '';
            serviceHistoryList.appendChild(emptyHistoryRow);
            totalCallsBadge.textContent = '0 Calls';
            return;
        }

        serviceHistoryList.innerHTML = '';
        filteredCalls.forEach(call => {
            const tr = document.createElement('tr');
            const amc = amcContracts.find(a => a.id === call.amcId);
            const statusClass = call.status === 'Resolved' ? 'salary-badge' : 'expenses-badge';

            tr.innerHTML = `
                <td style="font-weight: 500;">${escapeXml(amc ? amc.orgName : 'N/A')}</td>
                <td style="font-size: 0.85rem;">${new Date(call.date).toLocaleDateString()}</td>
                <td><i class="fa-solid fa-user-gear" style="font-size: 0.8rem; margin-right: 0.3rem;"></i> ${escapeXml(call.tech)}</td>
                <td style="max-width: 200px; font-size: 0.85rem;" title="${escapeXml(call.problem)}">
                    <span class="text-truncate">${escapeXml(call.problem)}</span>
                </td>
                <td><span class="${statusClass}" onclick="toggleCallStatus('${call.id}')" style="cursor: pointer;">${call.status}</span></td>
                <td>
                    <button class="btn-delete" onclick="deleteCall('${call.id}')" style="color: var(--danger); padding: 0.3rem;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;
            serviceHistoryList.appendChild(tr);
        });

        totalCallsBadge.textContent = `${filteredCalls.length} Calls`;
    };

    window.toggleCallStatus = (id) => {
        const call = serviceCalls.find(c => c.id === id);
        if (call) {
            call.status = call.status === 'Open' ? 'Resolved' : 'Open';
            saveState();
            renderServiceHistory();
        }
    };

    window.deleteCall = async (id) => {
        const confirmed = await showConfirm({
            title: 'Delete Service Log?',
            message: 'This will permanently remove this service call entry.',
            confirmText: 'Delete',
            confirmIcon: 'fa-trash-can',
            type: 'danger'
        });
        if (confirmed) {
            serviceCalls = serviceCalls.filter(c => c.id !== id);
            saveState();
            renderServiceHistory();
        }
    };

    window.filterHistoryByAmc = (amcId) => {
        currentFilter = amcId;
        renderServiceHistory();
        // Scroll to history
        document.getElementById('serviceHistoryList').closest('.glass-card').scrollIntoView({ behavior: 'smooth' });
    };

    if (clearHistoryFilterBtn) {
        clearHistoryFilterBtn.addEventListener('click', () => {
            currentFilter = null;
            renderServiceHistory();
        });
    }

    // --- Actions ---
    amcForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const orgName = orgInput.value.trim();
        const contact = contactInput.value.trim();
        const phone = document.getElementById('phone')?.value.trim() || '';
        const amcAmountInput = document.getElementById('amcAmount');
        const amount = Math.max(0, parseFloat(amcAmountInput.dataset.rawValue || amcAmountInput.value) || 0);

        // Collect Assets
        const assetRows = assetListContainer.querySelectorAll('.asset-row');
        const assets = Array.from(assetRows).map(row => ({
            name: row.querySelector('.asset-name').value.trim(),
            qty: parseInt(row.querySelector('.asset-qty').value) || 1,
            notes: row.querySelector('.asset-notes').value.trim()
        })).filter(a => a.name !== '');

        const newAmc = {
            id: 'amc_' + Date.now().toString(),
            orgName: orgName,
            contact: contact,
            phone: phone,
            type: document.getElementById('amcType').value,
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            payCycle: document.getElementById('payCycle').value,
            amount: amount,
            assets: assets,
            status: 'Active',
            createdAt: new Date().toISOString()
        };

        crmHistory[phone || orgName] = {
            name: newAmc.orgName,
            contact: newAmc.contact,
            lastVisit: new Date().toLocaleDateString(),
            type: 'AMC'
        };

        amcContracts.push(newAmc);
        saveState();
        amcForm.reset();
        assetListContainer.innerHTML = '';
        addAssetRow();

        refreshApp();
        refreshApp();
        if (window.showToast) showToast('New AMC contract registered successfully!');
    });

    window.cloneContract = (id) => {
        const amc = amcContracts.find(a => a.id === id);
        if (!amc) return;

        document.getElementById('orgName').value = amc.orgName + " (Copy)";
        document.getElementById('contactPerson').value = amc.contact;
        const phoneEl = document.getElementById('phone');
        if (phoneEl) phoneEl.value = amc.phone || '';
        document.getElementById('amcType').value = amc.type;
        document.getElementById('payCycle').value = amc.payCycle;
        document.getElementById('amcAmount').value = amc.amount;

        assetListContainer.innerHTML = '';
        if (amc.assets && Array.isArray(amc.assets)) {
            amc.assets.forEach(a => addAssetRow({ name: a.name, qty: a.qty, notes: a.notes }));
        }
        if (assetListContainer.children.length === 0) addAssetRow();

        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (window.showToast) showToast('Contract cloned! Adjust details and save.', 'info');
    };

    window.deleteAmc = async (id) => {
        const confirmed = await showConfirm({
            title: 'Remove AMC Contract?',
            message: 'This will permanently delete this AMC contract and all associated maintenance logs.',
            confirmText: 'Remove Contract',
            confirmIcon: 'fa-file-circle-xmark',
            type: 'danger'
        });
        if (confirmed) {
            amcContracts = amcContracts.filter(a => a.id !== id);
            saveState();
            renderAmcs();
        }
    };

    window.markServiceComplete = (id) => {
        const amc = amcContracts.find(a => a.id === id);
        if (!amc) return;

        // 1. Calculate next date (90 days from today)
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 90);
        
        // 2. Initialize log if not exists
        if (!amc.maintenanceLog) amc.maintenanceLog = [];
        
        // 3. Add current completion to log
        amc.maintenanceLog.unshift(new Date().toISOString());
        
        // 4. Update next service date
        amc.nextServiceDate = nextDate.toISOString();

        saveState();
        renderAmcs();
        
        showToast(`Service complete for ${amc.orgName}. Next: ${nextDate.toLocaleDateString()}`);
    };

    window.downloadAmcInvoice = (id) => {
        const amc = amcContracts.find(a => a.id === id);
        if (!amc) return;
        generatePDF('Invoice', {
            id: amc.id,
            orgName: amc.orgName,
            customer: amc.contact,
            phone: amc.phone,
            items: amc.assets.map(a => ({ product: a.name, qty: a.qty, price: amc.amount / (amc.assets.length || 1) })),
            amount: amc.amount
        });
    };

    window.exportAmcInvoice = (id) => {
        const amc = amcContracts.find(a => a.id === id);
        if (!amc) return;

        const gstRate = 0.18;
        const baseAmount = amc.amount / (1 + gstRate);
        const gstAmount = amc.amount - baseAmount;
        const date = new Date().toISOString().split('T')[0].replace(/-/g, '');

        let xml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice View">
            <DATE>${date}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>${escapeXml(amc.orgName)}</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(amc.orgName)}</LEDGERNAME>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>-${amc.amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>AMC Service Revenue</LEDGERNAME>
              <AMOUNT>${baseAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output IGST @ 18%</LEDGERNAME>
              <AMOUNT>${gstAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AMC_Invoice_${amc.orgName.replace(/\s+/g, '_')}.xml`;
        a.click();
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

    window.filterAmcGrid = () => {
        const query = document.getElementById('amcGridSearch').value.toLowerCase();
        const cards = document.querySelectorAll('#amcGrid .amc-card');
        
        cards.forEach(card => {
            const text = card.innerText.toLowerCase();
            card.style.display = text.includes(query) ? '' : 'none';
        });

        // Toggle empty state
        const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
        const emptyAmc = document.getElementById('emptyAmc');
        if (emptyAmc) emptyAmc.style.display = (visibleCards.length === 0 && cards.length > 0) ? 'block' : 'none';
    };

    window.filterAmcHistory = () => {
        const query = document.getElementById('amcSearch').value.toLowerCase();
        const rows = document.querySelectorAll('#serviceHistoryList tr:not(#emptyHistoryRow)');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    };

    renderAmcs();
    renderServiceHistory();
});
