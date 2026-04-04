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

        filteredJobs.forEach((job, index) => {
            const tr = document.createElement('tr');
            tr.className = 'fade-in';
            tr.style.animationDelay = `${index * 0.05}s`;

            const totalFinal = job.price + (job.extraCharges || 0);

            // Completion Countdown
            let completionHtml = '<span style="color: var(--text-muted);">Not Set</span>';
            if (job.estCompletion) {
                const target = new Date(job.estCompletion);
                const today = new Date();
                today.setHours(0,0,0,0);
                const diffTime = target - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (job.status === 'Completed') {
                    completionHtml = `<span style="opacity: 0.5;">${new Date(job.estCompletion).toLocaleDateString('en-IN', {day:'2-digit', month:'short'})}</span>`;
                } else if (diffDays < 0) {
                    completionHtml = `<span style="color: #ef4444; font-weight: bold;"><i class="fa-solid fa-clock"></i> Overdue (${Math.abs(diffDays)}d)</span>`;
                } else if (diffDays === 0) {
                    completionHtml = `<span style="color: #f59e0b; font-weight: bold;"><i class="fa-solid fa-bolt"></i> Today!</span>`;
                } else {
                    completionHtml = `<span>${new Date(job.estCompletion).toLocaleDateString('en-IN', {day:'2-digit', month:'short'})}</span> <span style="font-size: 0.75rem; color: var(--text-muted);">(${diffDays}d left)</span>`;
                }
            }

            tr.innerHTML = `
                <td>
                    <span style="color: var(--primary); font-family: monospace; font-weight: bold; font-size: 0.85rem;">${job.srNo || 'N/A'}</span>
                    <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 0.2rem;">${job.createdAt?.split(',')[0]}</div>
                </td>
                <td>
                    <div style="font-weight: 600;">
                        ${escapeXml(job.customerName)}
                        ${phoneCounts[job.phone] > 1 ? '<span style="font-size: 0.65rem; margin-left: 0.5rem; background: var(--accent); color: var(--bg-dark); padding: 0.1rem 0.3rem; border-radius: 4px; font-weight: bold;" title="Repeat Customer">🔄 REPEAT</span>' : ''}
                    </div>
                    <div style="font-size: 0.82rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.4rem; margin-top: 0.2rem;">
                        <i class="fa-solid fa-phone" style="font-size: 0.7rem;"></i> +91 ${job.phone}
                        <a href="tel:+91${job.phone}" class="btn-call" style="padding: 0.1rem 0.35rem; font-size: 0.7rem;" title="Call Customer">
                            <i class="fa-solid fa-phone-volume"></i>
                        </a>
                    </div>
                </td>
                <td>
                    <div style="font-weight: 500;">${job.deviceType || 'Device'} - ${escapeXml(job.model || 'N/A')}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">${escapeXml(job.deviceIssue)}</div>
                    ${job.comment ? `<div style="font-size: 0.72rem; color: var(--accent); margin-top: 0.2rem;"><i class="fa-solid fa-comment-dots"></i> ${escapeXml(job.comment)}</div>` : ''}
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="font-weight: bold;">${formatCurrency(totalFinal)}</div>
                        ${(job.partCost / totalFinal > 0.7) ? '<i class="fa-solid fa-triangle-exclamation" style="color: var(--danger); font-size: 0.8rem;" title="Low Margin: High Part Cost!"></i>' : ''}
                    </div>
                    ${job.extraCharges > 0 ? `<div style="font-size: 0.7rem; color: var(--danger);">+ ${formatCurrency(job.extraCharges)} extra</div>` : ''}
                    <div class="badge-profit" style="margin-top: 0.3rem; font-size: 0.65rem; padding: 0.1rem 0.4rem; background: rgba(16, 185, 129, 0.1); color: #10b981; border-radius: 4px; display: inline-block; font-weight: bold;">
                        Net: ${formatCurrency(totalFinal - (job.partCost || 0))}
                    </div>
                </td>
                <td>
                    <div style="font-size: 0.85rem;">${completionHtml}</div>
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
                        <button class="btn-wa" onclick="sendWhatsApp('${job.id}')" title="Send WhatsApp">
                            <i class="fa-brands fa-whatsapp"></i>
                        </button>
                        <button class="details-btn" style="padding: 0.4rem 0.6rem; background: rgba(99,102,241,0.1); color: #6366f1; border: 1px solid rgba(99,102,241,0.2);" onclick="openTimelineModal('${job.id}')" title="View Job Timeline">
                            <i class="fa-solid fa-timeline"></i>
                        </button>
                        <button class="details-btn" style="padding: 0.4rem 0.6rem; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);" onclick="generateJobCardPDF(repairJobs.find(j => j.id === '${job.id}'))" title="Download Job Card">
                            <i class="fa-solid fa-address-card"></i>
                        </button>
                        <button class="details-btn" style="padding: 0.4rem 0.6rem; background: rgba(0, 180, 219, 0.1); color: #00B4DB; border: 1px solid rgba(0, 180, 219, 0.2);" onclick="generateInvoice('${job.id}')" title="Download Invoice">
                            <i class="fa-solid fa-file-pdf"></i>
                        </button>
                        <button class="btn-delete-animated" onclick="deleteJob('${job.id}')" title="Delete">
                             <svg viewBox="0 0 448 512" class="svgIcon"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg>
                        </button>
                    </div>
                </td>
            `;
            jobList.appendChild(tr);
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

    repairForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('custName');
        const phoneInput = document.getElementById('custPhone');
        const typeInput = document.getElementById('deviceType');
        const modelInput = document.getElementById('deviceModel');
        const issueInput = document.getElementById('deviceIssue');
        const priceInput = document.getElementById('estPrice');
        const costInput = document.getElementById('partCost');
        const extraInput = document.getElementById('extraCharges');
        const commentInput = document.getElementById('jobComment');

        const phone = phoneInput.value.trim();
        const price = Math.max(0, parseFloat(priceInput.dataset.rawValue || priceInput.value) || 0); // Defaults to 0 correctly
        const partCost = Math.max(0, parseFloat(costInput.dataset.rawValue || costInput.value) || 0);
        const extraCharges = Math.max(0, parseFloat(extraInput.dataset.rawValue || extraInput.value) || 0);

        if (!validatePhone(phone)) {
            alert('Please enter a valid 10-digit phone number.');
            return;
        }

        // CRM Update
        const name = nameInput.value.trim();
        crmHistory[phone] = {
            name: name,
            lastVisit: new Date().toLocaleDateString(),
            device: typeInput.value
        };

        const newJob = {
            id: 'job_' + Date.now().toString(),
            srNo: generateSRNo(),
            customerName: name,
            phone: phone,
            deviceType: typeInput.value,
            model: modelInput.value.trim(),
            deviceIssue: issueInput.value.trim(),
            price: price,
            partCost: partCost,
            extraCharges: extraCharges,
            comment: commentInput.value.trim(),
            techNotes: document.getElementById('techNotes')?.value.trim() || '',
            status: 'Pending',
            estCompletion: document.getElementById('estCompletion').value,
            createdAt: new Date().toLocaleString(),
            timeline: [
                { status: 'Received', timestamp: new Date().toLocaleString() }
            ]
        };

        repairJobs.unshift(newJob);
        saveState();
        repairForm.reset();
        
        // Clear dataset raw values
        priceInput.dataset.rawValue = '';
        costInput.dataset.rawValue = '';
        extraInput.dataset.rawValue = '';
        
        nameInput.focus();
        renderTable();
        showToast('Repair ticket created successfully!');
    });

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
                        itemName: invItem.name,
                        type: 'Repair Use',
                        qty: qtyUsed,
                        rate: 0,
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

    window.sendWhatsApp = (id) => {
        const job = repairJobs.find(j => j.id === id);
        if (!job) return;

        const total = job.price + (job.extraCharges || 0);
        const message = `Hi ${job.customerName}, your ${job.deviceType} (${job.model}) at DOT System is ready for collection. Total: ${formatCurrency(total)}.`;
        const encodedMsg = encodeURIComponent(message);
        const waUrl = `https://wa.me/91${job.phone}?text=${encodedMsg}`;
        
        window.open(waUrl, '_blank');
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

    // --- Initial Load ---
    renderTable();
});
