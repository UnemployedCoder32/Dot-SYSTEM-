document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let repairJobs = DataController.getRepairs();
    let editingId = null;

window.filterRepairs = () => {
    const query = document.getElementById('jobSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#jobList tr:not(.empty-state)');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
};
    let crmHistory = DataController.getCrmHistory();
    let filterQuery = '';
    let statusFilter = 'all';

    // --- DOM Elements ---
    const repairForm = document.getElementById('repairForm');
    const jobList = document.getElementById('jobList');
    const emptyRow = document.getElementById('emptyJobRow');
    const totalJobsBadge = document.getElementById('totalJobs');
    const jobSearch = document.getElementById('jobSearch');
    const crmIndicator = document.getElementById('crmIndicator');
    const statusTabs = document.querySelectorAll('.status-tab');

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
        DataController.saveRepairs(repairJobs);
        DataController.saveCrmHistory(crmHistory);
    };

    const loadState = () => {
        console.log('📊 repair-script.js: Loading state...');
        repairJobs = DataController.getRepairs();
        crmHistory = DataController.getCrmHistory();
        renderTable();
        applyRoleRestrictions();
    };

    // --- Deterministic Initialization Logic ---
    const init = () => {
        // 1. Initial render from LocalStorage Cache (PWA Feel)
        loadState();

        // 2. Trigger sync with Local File system
        if (DataController.syncWithLocalFile) {
            DataController.syncWithLocalFile();
        }
    };

    // Listen for definitive sync completion
    window.addEventListener('syncComplete', () => {
        console.log('✅ repair-script.js: Sync Complete received. Refreshing UI...');
        loadState();
    });

    // Also listen for partial data updates
    window.addEventListener('dataUpdate', (e) => {
        if (e.detail && e.detail.source !== 'sync') {
            loadState();
        }
    });

    const applyRoleRestrictions = () => {
        const authData = JSON.parse(localStorage.getItem('dotsystem_auth_data') || '{}');
        const role = authData.role || 'staff';
        const name = authData.name || 'User';

        // 1. Personalized Greeting
        const welcomeText = document.querySelector('.header-title p') || document.querySelector('.header-left p');
        if (welcomeText) welcomeText.textContent = `Welcome back, ${name} | Role: ${role.toUpperCase()}`;

        if (role === 'staff') {
            document.body.classList.add('user-is-staff');
            
            // 2. Hide all admin-only elements
            document.querySelectorAll('.admin-only, .admin-insight').forEach(el => {
                el.style.display = 'none';
            });

            // 3. Hide Restricted Sidebar/Nav links
            const restrictedLinks = ['employees.html', 'amc-management.html', 'settings.html', 'staff'];
            document.querySelectorAll('.nav-btn-alt, .sidebar-link, .nav-link').forEach(link => {
                const href = link.getAttribute('href') || '';
                const text = link.textContent.toLowerCase();
                const isRestricted = restrictedLinks.some(rl => href.includes(rl) || text.includes(rl));
                
                if (isRestricted) {
                    link.style.display = 'none';
                    if (link.parentElement.tagName === 'LI') link.parentElement.style.display = 'none';
                }
            });
        }
    };

    const generateSRNo = () => {
        // Find highest existing SR number index to avoid collisions
        let maxIndex = 0;
        repairJobs.forEach(job => {
            const num = parseInt(job.srNo?.split('-').pop());
            if (!isNaN(num) && num > maxIndex) maxIndex = num;
        });
        
        // If no jobs or parsing failed, start at 1000
        if (maxIndex < 1000) maxIndex = 1000;
        
        return `HS-J-${maxIndex + 1}`;
    };

    let deviceChart = null;

    const updateKPIs = () => {
        const statRepairRevenue = document.getElementById('statRepairRevenue');
        const statActiveJobs = document.getElementById('statActiveJobs');
        const statAvgTat = document.getElementById('statAvgTat');
        const ctxDevice = document.getElementById('deviceTypeChart');

        let totalRevenue = 0;
        let activeJobs = 0;
        const deviceData = {};
        let tatTotal = 0, tatCount = 0;

        repairJobs.forEach(job => {
            if (job.status === 'Completed') {
                totalRevenue += (job.price + (job.extraCharges || 0));
                if (job.createdAt && job.completedAt) {
                    const tat = Math.round((new Date(job.completedAt) - new Date(job.createdAt)) / (1000 * 60 * 60 * 24));
                    if (tat >= 0) { tatTotal += tat; tatCount++; }
                }
            } else {
                activeJobs++;
            }

            const type = job.deviceType || 'Other';
            deviceData[type] = (deviceData[type] || 0) + 1;
        });

        if (statRepairRevenue) statRepairRevenue.textContent = formatCurrency(totalRevenue);
        if (statActiveJobs) statActiveJobs.textContent = activeJobs;
        if (statAvgTat) statAvgTat.textContent = tatCount > 0 ? `${(tatTotal / tatCount).toFixed(1)}d` : '—';

        if (ctxDevice && typeof Chart !== 'undefined') {
            if (deviceChart) deviceChart.destroy();
            
            const isLight = document.body.classList.contains('light-theme');
            const textColor = isLight ? '#1e293b' : 'rgba(255,255,255,0.7)';

            deviceChart = new Chart(ctxDevice, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(deviceData),
                    datasets: [{
                        data: Object.values(deviceData),
                        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { color: textColor, font: { family: 'Outfit', size: 10 }, boxWidth: 10 }
                        }
                    },
                    cutout: '65%'
                }
            });
        }
    };

    const renderTable = () => {
        const filteredJobs = repairJobs.filter(job => {
            const query = filterQuery.toLowerCase();
            return (
                job.customerName.toLowerCase().includes(query) ||
                job.phone.includes(query) ||
                (job.srNo && job.srNo.toLowerCase().includes(query)) ||
                (job.deviceType && job.deviceType.toLowerCase().includes(query)) ||
                (job.model && job.model.toLowerCase().includes(query))
            );
        }).filter(job => {
            if (statusFilter === 'all') return true;
            return job.status === statusFilter;
        });

        if (filteredJobs.length === 0) {
            jobList.innerHTML = '';
            if (filterQuery.trim() === '') {
                jobList.appendChild(emptyRow);
            } else {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="6" style="text-align: center; padding: 4rem; color: var(--text-muted)">
                    <i class="fa-solid fa-magnifying-glass-minus" style="font-size: 2rem; display: block; margin-bottom: 1rem; opacity: 0.5;"></i>
                    No matching records found for "<strong>${escapeXml(filterQuery)}</strong>"
                </td>`;
                jobList.appendChild(tr);
            }
            totalJobsBadge.textContent = `${repairJobs.length} Jobs`;
            return;
        }

        jobList.innerHTML = '';
        
        const phoneCounts = {};
        repairJobs.forEach(j => {
            phoneCounts[j.phone] = (phoneCounts[j.phone] || 0) + 1;
        });

        const clvStats = DataController.getCustomerCLV() || [];
        const top5Diamond = clvStats.slice(0, 5).filter(c => c.totalValue > 5000).map(c => c.name.toLowerCase());

        filteredJobs.forEach((job, index) => {
            const tr = document.createElement('tr');
            tr.className = 'fade-in';
            tr.style.animationDelay = `${index * 0.05}s`;

            const totalFinal = job.price + (job.extraCharges || 0);
            
            const isDiamond = top5Diamond.includes(job.customerName.toLowerCase());
            const diamondHtml = isDiamond ? `<i class="fa-solid fa-gem" style="color: #60a5fa; font-size: 0.8rem; margin-left: 0.3rem;" title="Diamond Client"></i>` : '';

            tr.innerHTML = `
                <td>
                    <span style="color: var(--primary); font-family: monospace; font-weight: bold; font-size: 0.85rem;">${job.srNo || 'N/A'}</span>
                    <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 0.2rem;">${job.createdAt?.split(',')[0]}</div>
                </td>
                <td>
                    <div style="font-weight: 600;">
                        ${escapeXml(job.customerName)} ${diamondHtml}
                        ${phoneCounts[job.phone] > 1 ? '<span style="font-size: 0.65rem; margin-left: 0.5rem; background: var(--accent); color: var(--bg-dark); padding: 0.1rem 0.3rem; border-radius: 4px; font-weight: bold;" title="Repeat Customer">🔄 REPEAT</span>' : ''}
                    </div>
                </td>
                <td>
                    <div style="font-weight: 500;">${job.deviceType || 'Device'} - ${escapeXml(job.model || 'N/A')}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">${escapeXml(job.deviceIssue)}</div>
                </td>
                <td style="text-align: center;">
                    <div id="qr-${job.id}" class="qr-cell" onclick="showQrModal('${job.id}')" title="Click to enlarge tracking QR"></div>
                </td>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                        <button class="btn-wa" onclick="sendWhatsAppStatus('${job.id}')" title="Send Live Status">
                            <i class="fa-brands fa-whatsapp"></i> Status
                        </button>
                    </div>
                </td>
                <td>
                    <div style="font-weight: bold;">${formatCurrency(totalFinal)}</div>
                </td>
                <td>
                    <select class="status-select val-${job.status.toLowerCase().replace(/ /g, '-')}" onchange="updateJobStatus('${job.id}', this.value)">
                        <option value="Pending" ${job.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="In Progress" ${job.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Awaiting Parts" ${job.status === 'Awaiting Parts' ? 'selected' : ''}>Awaiting Parts</option>
                        <option value="Completed" ${job.status === 'Completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </td>
                <td>
                    <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
                        <button class="details-btn" onclick="openTimelineModal('${job.id}')" title="Timeline"><i class="fa-solid fa-timeline"></i></button>
                        <button class="details-btn" onclick="generateInvoice('${job.id}')" title="Invoice"><i class="fa-solid fa-file-pdf"></i></button>
                        <button class="btn-delete-animated" onclick="deleteJob('${job.id}')"><svg viewBox="0 0 448 512" class="svgIcon"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg></button>
                    </div>
                </td>
            `;
            jobList.appendChild(tr);

            // Generate mini QR for table
            new QRCode(document.getElementById(`qr-${job.id}`), {
                text: `https://dotsystem.track/${job.srNo}`,
                width: 40,
                height: 40,
                colorDark : "#3b82f6",
                colorLight : "transparent",
                correctLevel : QRCode.CorrectLevel.H
            });
        });

        totalJobsBadge.textContent = `${repairJobs.length} Job${repairJobs.length > 1 ? 's' : ''}`;
        updateKPIs();
    };

    // --- CRM Intelligence ---
    const phoneInput = document.getElementById('custPhone');
    const nameInput = document.getElementById('custName');

    phoneInput.addEventListener('input', () => {
        const phone = phoneInput.value.trim();
        if (phone.length === 10 && crmHistory[phone]) {
            const history = crmHistory[phone];
            nameInput.value = history.name;
            crmIndicator.style.display = 'block';
            crmIndicator.title = `Last visit: ${history.lastVisit} for ${history.device}`;
            
            // Subtle feedback
            nameInput.style.borderColor = 'var(--accent)';
            setTimeout(() => nameInput.style.borderColor = '', 1500);
        } else {
            crmIndicator.style.display = 'none';
        }
    });

    // --- Core Features ---

    if (repairForm) {
        repairForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            console.log('📝 repair-script.js: Intercepted Repair Form Submission');

            try {
                // Safer Value Extraction Helper
                const getNumericValue = (id) => {
                    const el = document.getElementById(id);
                    if (!el) return 0;
                    return Math.max(0, parseFloat(el.dataset.rawValue || el.value || '0') || 0);
                };

                const nameEl = document.getElementById('custName');
                const phoneEl = document.getElementById('custPhone');
                const typeEl = document.getElementById('deviceType');
                const modelEl = document.getElementById('deviceModel');
                const issueEl = document.getElementById('deviceIssue');
                const dateEl = document.getElementById('estCompletion');
                const commentEl = document.getElementById('jobComment');

                if (!nameEl || !phoneEl || !typeEl) {
                    throw new Error('Critical form elements missing from DOM');
                }

                const phone = phoneEl.value.trim();
                const price = getNumericValue('estPrice');
                const partCost = getNumericValue('partCost');
                const extraCharges = getNumericValue('extraCharges');

                if (!validatePhone(phone)) {
                    showToast('Please enter a valid 10-digit phone number.', 'error');
                    phoneEl.focus();
                    return;
                }

                const newJob = {
                    id: editingId || Date.now().toString(),
                    srNo: editingId ? (repairJobs.find(j => j.id === editingId)?.srNo || generateSRNo()) : generateSRNo(),
                    customerName: nameEl.value.trim(),
                    phone: phone,
                    deviceType: typeEl.value,
                    model: modelEl ? modelEl.value.trim() : '',
                    deviceIssue: issueEl ? issueEl.value.trim() : '',
                    price: price,
                    partCost: partCost,
                    extraCharges: extraCharges,
                    comment: commentEl ? commentEl.value.trim() : '',
                    status: editingId ? (repairJobs.find(j => j.id === editingId)?.status || 'Pending') : 'Pending',
                    createdAt: editingId ? (repairJobs.find(j => j.id === editingId)?.createdAt || new Date().toLocaleString('en-IN')) : new Date().toLocaleString('en-IN')
                };

                if (editingId) {
                    const idx = repairJobs.findIndex(j => j.id === editingId);
                    if (idx !== -1) {
                        repairJobs[idx] = newJob;
                        showToast('Repair Job Updated!');
                    }
                } else {
                    repairJobs.push(newJob);
                    
                    // Update CRM Intelligence
                    if (!crmHistory[phone] || new Date().getTime() > new Date(crmHistory[phone].lastVisit).getTime()) {
                        crmHistory[phone] = {
                            name: newJob.customerName,
                            lastVisit: new Date().toLocaleDateString(),
                            device: `${newJob.deviceType} ${newJob.model}`
                        };
                    }
                    showToast('New Repair Job Created!');
                }

                saveState();
                loadState();
                
                // Reset form and UI
                repairForm.reset();
                editingId = null;
                const submitBtn = repairForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Create Ticket';
                
                // Focus back on phone for next entry
                phoneEl.focus();

            } catch (err) {
                console.error('❌ repair-script.js: Critical Submission Error:', err);
                showToast('Failed to save repair job: ' + err.message, 'error');
            }
        });
    }

    jobSearch.addEventListener('input', (e) => {
        filterQuery = e.target.value;
        renderTable();
    });

    window.deleteJob = async (id) => {
        const confirmed = await showConfirm({
            title: 'Delete Repair Ticket?',
            message: 'This will permanently remove this job from the repair queue. This cannot be undone.',
            confirmText: 'Delete Ticket',
            confirmIcon: 'fa-ticket',
            type: 'danger'
        });
        if (confirmed) {
            repairJobs = repairJobs.filter(job => job.id !== id);
            saveState();
            renderTable();
        }
    };

    let currentCompletingJobId = null;

    window.updateJobStatus = (id, newStatus) => {
        if (newStatus === 'Completed') {
            openCompleteModal(id);
            return;
        }

        const jobIndex = repairJobs.findIndex(j => j.id === id);
        if (jobIndex !== -1) {
            repairJobs[jobIndex].status = newStatus;
            // Add timeline step
            if (!repairJobs[jobIndex].timeline) repairJobs[jobIndex].timeline = [];
            repairJobs[jobIndex].timeline.push({ status: newStatus, timestamp: new Date().toLocaleString() });
            saveState();
            renderTable();
            if (window.DataController) {
                DataController.logActivity('Status Update', `SR No. ${repairJobs[jobIndex].srNo} changed to ${newStatus}`, 'info');
            }
            if (window.showToast) showToast(`SR No. ${repairJobs[jobIndex].srNo} status updated to ${newStatus}`);
        }
    };

    const openCompleteModal = (id) => {
        const job = repairJobs.find(j => j.id === id);
        if (!job) return;

        currentCompletingJobId = id;
        document.getElementById('completeSrNo').textContent = job.srNo;
        document.getElementById('completeCustName').textContent = job.customerName;
        document.getElementById('partsUsedList').innerHTML = '';
        
        document.getElementById('completeJobModal').classList.add('active');
    };

    window.closeCompleteModal = () => {
        document.getElementById('completeJobModal').classList.remove('active');
        currentCompletingJobId = null;
        renderTable();
    };

    // --- Timeline Modal ---
    const STATUS_ICONS = {
        'Received':       { icon: 'fa-box-open',       color: '#6366f1' },
        'Pending':        { icon: 'fa-hourglass-half', color: '#f59e0b' },
        'In Progress':    { icon: 'fa-wrench',         color: '#3b82f6' },
        'Awaiting Parts': { icon: 'fa-truck',          color: '#8b5cf6' },
        'Completed':      { icon: 'fa-circle-check',   color: '#10b981' },
        'Delivered':      { icon: 'fa-handshake',      color: '#10b981' }
    };

    window.openTimelineModal = (id) => {
        const job = repairJobs.find(j => j.id === id);
        if (!job) return;

        document.getElementById('timelineSrNo').textContent = `${job.srNo} · ${job.customerName} · ${job.deviceType || ''}`;
        const timeline = job.timeline || [{ status: 'Received', timestamp: job.createdAt }];
        
        const content = document.getElementById('timelineContent');
        content.innerHTML = `
            <div style="position: relative; padding-left: 2rem;">
                <div style="position: absolute; left: 11px; top: 8px; bottom: 8px; width: 2px; background: rgba(255,255,255,0.08);"></div>
                ${timeline.map((step, i) => {
                    const s = STATUS_ICONS[step.status] || { icon: 'fa-circle', color: '#6b7280' };
                    const isLast = i === timeline.length - 1;
                    return `
                    <div style="display: flex; gap: 1rem; align-items: flex-start; margin-bottom: ${isLast ? '0' : '1.5rem'}; position: relative;">
                        <div style="width: 24px; height: 24px; border-radius: 50%; background: ${s.color}20; border: 2px solid ${s.color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; z-index: 1;">
                            <i class="fa-solid ${s.icon}" style="font-size: 0.6rem; color: ${s.color};"></i>
                        </div>
                        <div>
                            <div style="font-weight: 700; color: ${s.color};">${step.status}</div>
                            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">${step.timestamp}</div>
                            ${step.note ? `<div style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin-top: 4px;">${step.note}</div>` : ''}
                        </div>
                    </div>`;
                }).join('')}
            </div>
        `;
        document.getElementById('timelineModal').classList.add('active');
    };

    window.closeTimelineModal = () => {
        document.getElementById('timelineModal').classList.remove('active');
    };

    window.addPartUsedRow = () => {
        const list = document.getElementById('partsUsedList');
        const inventory = DataController.getInventory();
        
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '0.5rem';
        row.style.alignItems = 'center';
        row.className = 'part-usage-row';

        const selectId = `part-sel-${Date.now()}`;
        row.innerHTML = `
            <select id="${selectId}" class="part-select" style="flex: 2;">
                <option value="">Select Part...</option>
                ${inventory.map(i => `<option value="${i.id}">${i.name} (Stock: ${i.qty})</option>`).join('')}
            </select>
            <input type="number" class="part-qty" value="1" min="1" style="flex: 0.5; padding: 0.8rem; border-radius: 8px; background: rgba(15,23,42,0.6); border: 1px solid var(--border); color: #fff;">
            <button class="btn btn-outline" style="padding: 0.8rem; color: var(--danger); border-color: rgba(239,68,68,0.2);" onclick="this.parentElement.remove()">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        list.appendChild(row);
        
        if (window.makeSearchableSelect) {
            makeSearchableSelect(selectId, "Search inventory...");
        }
    };

    window.finalizeCompletion = async () => {
        if (!currentCompletingJobId) return;
        
        const jobIndex = repairJobs.findIndex(j => j.id === currentCompletingJobId);
        if (jobIndex === -1) return;

        const partRows = document.querySelectorAll('.part-usage-row');
        const inventory = DataController.getInventory();
        const transactions = DataController.getTransactions() || [];

        let partsDeducted = [];

        // Process Parts
        for (const row of partRows) {
            const partId = row.querySelector('.part-select').value;
            const qtyUsed = parseInt(row.querySelector('.part-qty').value) || 0;

            if (partId && qtyUsed > 0) {
                const invItem = inventory.find(i => i.id === partId);
                if (invItem) {
                    if (invItem.qty < qtyUsed) {
                        if (window.showToast) showToast(`Insufficient stock for ${invItem.name}`, 'error');
                        return;
                    }
                    invItem.qty -= qtyUsed;
                    partsDeducted.push(`${invItem.name} x${qtyUsed}`);

                    // Log usage transaction
                    transactions.push({
                        id: 'tr_usage_' + Date.now() + Math.random(),
                        date: new Date().toISOString().split('T')[0],
                        totalValue: 0,
                        relatedJobSr: repairJobs[jobIndex].srNo
                    });
                }
            }
        }

        // Update Job
        repairJobs[jobIndex].status = 'Completed';
        repairJobs[jobIndex].completedAt = new Date().toLocaleString();
        if (partsDeducted.length > 0) {
            repairJobs[jobIndex].comment = (repairJobs[jobIndex].comment ? repairJobs[jobIndex].comment + ' | ' : '') + 'Used: ' + partsDeducted.join(', ');
        }

        DataController.saveInventory(inventory);
        DataController.saveTransactions(transactions);
        saveState();
        
        const completedJobId = currentCompletingJobId;
        closeCompleteModal();
        renderTable();
        if (window.showToast) showToast(`SR No. ${repairJobs[jobIndex].srNo} marked as Completed. Inventory updated.`);

        setTimeout(() => {
            if (confirm(`Would you like to send a WhatsApp notification to ${repairJobs[jobIndex].customerName} that their device is ready?`)) {
                sendWhatsApp(completedJobId);
            }
        }, 800);
    };

    // PDF Generation for Quotation
    window.generateQuotation = (id) => {
        const job = repairJobs.find(j => j.id === id);
        if (!job) return;
        generatePDF('Estimate', job);
    };

    window.editJob = (id) => {
        const job = repairJobs.find(j => j.id === id);
        if (!job) return;

        // Populate form fields for editing
        document.getElementById('custName').value = job.customerName;
        document.getElementById('custPhone').value = job.phone;
        document.getElementById('deviceType').value = job.deviceType;
        document.getElementById('deviceModel').value = job.model;
        document.getElementById('deviceIssue').value = job.deviceIssue;
        document.getElementById('estPrice').value = job.price;
        document.getElementById('partCost').value = job.partCost;
        document.getElementById('extraCharges').value = job.extraCharges;
        document.getElementById('jobComment').value = job.comment;

        // Set editing state
        editingId = id;
        document.getElementById('submitJobBtn').textContent = 'Update Job';
        document.getElementById('cancelEditBtn').style.display = 'inline-block';
        document.getElementById('newJobTitle').textContent = 'Edit Repair Job';

        // Scroll to top or form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.sendWhatsAppStatus = (id) => {
        const job = repairJobs.find(j => j.id === id);
        if (!job) return;

        const statusLabel = job.status === 'Completed' ? '✅ READY FOR COLLECTION' : `🛠️ STATUS: ${job.status}`;
        const message = `*DOT SYSTEM REPAIR UPDATE*\n\n` +
                        `Hello ${job.customerName},\n` +
                        `Update for your ${job.deviceType} (${job.model || 'Device'})\n\n` +
                        `${statusLabel}\n` +
                        `SR No: ${job.srNo}\n\n` +
                        `Track live: https://dotsystem.track/${job.srNo}\n\n` +
                        `Thank you!`;
        
        if (window.shareToWhatsApp) {
            window.shareToWhatsApp(job.phone, message);
        } else {
            const encodedMsg = encodeURIComponent(message);
            window.open(`https://wa.me/91${job.phone}?text=${encodedMsg}`, '_blank');
        }
    };

    window.showQrModal = (id) => {
        const job = repairJobs.find(j => j.id === id);
        if (!job) return;
        
        const modal = document.getElementById('qrModal');
        const content = document.getElementById('qrModalContent');
        if (!modal || !content) return;

        content.innerHTML = '';
        new QRCode(content, {
            text: `https://dotsystem.track/${job.srNo}`,
            width: 256,
            height: 256,
            colorDark : "#3b82f6",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
        
        document.getElementById('qrModalSrNo').textContent = job.srNo;
        modal.classList.add('active');
    };

    window.closeQrModal = () => {
        document.getElementById('qrModal').classList.remove('active');
    };

    window.generateInvoice = (id) => {
        const job = repairJobs.find(j => j.id === id);
        if (!job) return;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const total = job.price + (job.extraCharges || 0);
        const isQuotation = job.status === 'Pending';
        const docTitle = isQuotation ? "SERVICE QUOTATION" : "TAX INVOICE";

        // --- Watermark (BLUEMARK) ---
        doc.setFontSize(60);
        doc.setTextColor(245, 245, 245); // Extremely light gray
        doc.setFont("helvetica", "bold");
        // Center-ish diagonal watermark
        doc.text("BLUEMARK", 45, 180, { angle: 45, opacity: 0.1 });

        // Header Branding
        doc.setFillColor(15, 23, 42); // --bg-dark
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("DOT SYSTEM", 15, 25);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Premium Device Solutions & Services", 15, 32);
        
        doc.setFontSize(16);
        doc.text(docTitle, 140, 25);

        // Job & Customer Details
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Invoice To:", 15, 55);
        
        doc.setFont("helvetica", "normal");
        doc.text(`${job.customerName}`, 15, 62);
        doc.text(`+91 ${job.phone}`, 15, 68);
        
        doc.setFont("helvetica", "bold");
        doc.text("Document Details:", 130, 55);
        doc.setFont("helvetica", "normal");
        doc.text(`SR No: ${job.srNo}`, 130, 62);
        doc.text(`Date: ${job.createdAt?.split(',')[0]}`, 130, 68);
        doc.text(`Status: ${job.status}`, 130, 74);

        // Table Data
        const tableBody = [
            ["Service Description", `${job.deviceType} Repair (${job.model})`, formatCurrency(job.price)],
            ["Additional Charges", job.comment || "Misc. Parts & Labor", formatCurrency(job.extraCharges)]
        ];

        doc.autoTable({
            startY: 85,
            head: [['Description', 'Details', 'Amount']],
            body: tableBody,
            headStyles: { fillColor: [0, 180, 219], textColor: 255 }, // Cyan matching theme
            theme: 'striped',
            foot: [['', 'Grand Total', formatCurrency(total)]],
            footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' }
        });

        // Footer
        const finalY = doc.lastAutoTable.finalY + 20;
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("Thank you for choosing DOT System!", 105, finalY, { align: 'center' });
        doc.setTextColor(59, 130, 246); // Accent Blue
        doc.setFont("helvetica", "bold");
        doc.text("BLUEMARK Authorized", 105, finalY + 10, { align: 'center' });

        doc.save(`${job.srNo}_${isQuotation ? 'Quotation' : 'Invoice'}.pdf`);
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

    window.exportRepairsToCSV = () => {
        const jobs = DataController.getRepairJobs();
        if (jobs.length === 0) {
            if (window.showToast) showToast('No repairs to export!', 'error');
            return;
        }

        const headers = ['SR No', 'Date', 'Customer', 'Phone', 'Device', 'Model', 'Issue', 'Estimated Price', 'Part Cost', 'Status'];
        const csvRows = [headers];

        jobs.forEach(j => {
            csvRows.push([
                `"${j.srNo}"`,
                `"${j.createdAt}"`,
                `"${j.customerName}"`,
                `"${j.phone}"`,
                `"${j.deviceType}"`,
                `"${j.model}"`,
                `"${j.deviceIssue}"`,
                j.price,
                j.partCost || 0,
                `"${j.status}"`
            ]);
        });

        const csvContent = csvRows.map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Repairs_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Tab Filtering ---
    statusTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            statusTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            statusFilter = tab.dataset.status;
            renderTable();
        });
    });

    // Start sequence
    init();
});
