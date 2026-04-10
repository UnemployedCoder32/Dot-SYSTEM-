document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let nonAmcCalls = DataController.getNonAmcCalls();
    let amcContracts = DataController.getAmc();
    let employees = DataController.getEmployees();

    // --- DOM ---
    const visitForm = document.getElementById('visitForm');
    const visitHistoryList = document.getElementById('visitHistoryList');
    const emptyVisitRow = document.getElementById('emptyVisitRow');
    const totalVisitsBadge = document.getElementById('totalVisits');
    const techSelect = document.getElementById('technician');
    const customerInput = document.getElementById('customerName');
    const amcBadge = document.getElementById('amcBadge');

    // --- Initialization ---
    const init = () => {
        const customerInput = document.getElementById('customerName');
        const amcBadge = document.getElementById('amcBadge');

        // Set default date
        document.getElementById('visitDate').valueAsDate = new Date();
        
        // Populate Technicians
        techSelect.innerHTML = '<option value="" disabled selected>Assign Technician...</option>';
        employees.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.name;
            opt.textContent = emp.name;
            techSelect.appendChild(opt);
        });

        // --- Event Listeners ---
        customerInput?.addEventListener('input', () => {
            const name = customerInput.value.trim().toLowerCase();
            const today = new Date();
            today.setHours(0,0,0,0);

            const hasActiveAmc = amcContracts.some(amc => 
                amc.orgName.toLowerCase() === name && 
                new Date(amc.endDate) >= today
            );

            if (hasActiveAmc) {
                amcBadge.style.display = 'block';
                amcBadge.classList.add('fade-in');
            } else {
                amcBadge.style.display = 'none';
            }
        });

        renderVisits();
        applyRoleRestrictions();

        // Enable Search
        if (window.makeSearchableSelect) {
            makeSearchableSelect('technician', 'Search Technician...');
            makeSearchableSelect('category', 'Search Category...');
        }
    };

    const applyRoleRestrictions = () => {
        const authData = JSON.parse(localStorage.getItem('dotsystem_auth_data') || '{}');
        const role = authData.role || 'staff';
        const name = authData.name || 'User';

        // 1. Personalized Greeting
        const welcomeText = document.querySelector('.header-title p') || document.querySelector('.header-left p');
        if (welcomeText) welcomeText.textContent = `Welcome back, ${name} | Role: ${role.toUpperCase()}`;

        if (role === 'staff') {
            document.body.classList.add('user-is-staff');
            
            // Hide Settings gear
            const settingsBtn = document.querySelector('.nav-gear-btn[href="settings.html"]');
            if (settingsBtn) settingsBtn.style.display = 'none';

            // Hide Restricted Nav Links
            const restrictedLinks = ['employees.html', 'amc-management.html', 'settings.html'];
            document.querySelectorAll('.nav-btn-alt').forEach(link => {
                const href = link.getAttribute('href');
                if (restrictedLinks.includes(href)) link.style.display = 'none';
            });

            // 3. Hide all admin-only elements (Financials, Price Hub, etc.)
            document.querySelectorAll('.admin-only, .admin-insight').forEach(el => {
                el.style.display = 'none';
            });
        }
    };

    const saveState = () => {
        DataController.saveNonAmcCalls(nonAmcCalls);
    };

    const updateInsights = () => {
        const statRevenue = document.getElementById('statVisitRevenue');
        const techBody = document.getElementById('techPerformanceBody');
        const heatmap = document.getElementById('visitHeatmap');

        let totalRev = 0;
        const techStats = {};

        nonAmcCalls.forEach(visit => {
            const fee = parseFloat(visit.fee) || 0;
            const isCompleted = visit.status === 'Job Resolved' || visit.status === 'Payment Received' || visit.status === 'Completed';

            if (isCompleted) {
                totalRev += fee;
            }

            if (visit.tech) {
                if (!techStats[visit.tech]) techStats[visit.tech] = { count: 0, rev: 0 };
                techStats[visit.tech].count += 1;
                if (isCompleted) {
                    techStats[visit.tech].rev += fee;
                }
            }
        });

        if (statRevenue) statRevenue.textContent = window.formatCurrency(totalRev);

        if (techBody) {
            const sortedTechs = Object.entries(techStats).sort((a, b) => b[1].rev - a[1].rev).slice(0, 3);
            techBody.innerHTML = sortedTechs.length ? sortedTechs.map(([tech, stats]) => `
                <tr style="border-bottom: 1px dotted rgba(255,255,255,0.05);">
                    <td style="padding: 0.4rem 0;">${escapeXml(tech)}</td>
                    <td style="padding: 0.4rem 0; text-align: center;">${stats.count}</td>
                    <td style="padding: 0.4rem 0; text-align: right; color: var(--accent);">${formatCurrency(stats.rev)}</td>
                </tr>
            `).join('') : `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 0.5rem;">No data</td></tr>`;
        }

        if (heatmap) {
            heatmap.innerHTML = '';
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const dateCounts = {};
            nonAmcCalls.forEach(v => {
                const d = new Date(v.date);
                d.setHours(0,0,0,0);
                const diffTime = today.getTime() - d.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays < 28) {
                    dateCounts[diffDays] = (dateCounts[diffDays] || 0) + 1;
                }
            });

            // Index 27 (oldest) to 0 (today)
            for (let i = 27; i >= 0; i--) {
                const count = dateCounts[i] || 0;
                let opacity = count === 0 ? 0.05 : Math.min(1, 0.2 + (count * 0.25));
                
                const square = document.createElement('div');
                square.style.width = '100%';
                square.style.aspectRatio = '1';
                square.style.backgroundColor = `rgba(16, 185, 129, ${opacity})`;
                square.style.borderRadius = '3px';
                square.style.transition = 'all 0.2s';
                square.style.cursor = 'help';
                
                const targetDate = new Date(today.getTime() - (i * 24 * 60 * 60 * 1000));
                square.title = `${count} visits on ${targetDate.toLocaleDateString()}`;
                
                square.onmouseover = () => square.style.transform = 'scale(1.1)';
                square.onmouseout = () => square.style.transform = 'scale(1)';

                heatmap.appendChild(square);
            }
        }
    };

    const renderVisits = () => {
        if (nonAmcCalls.length === 0) {
            visitHistoryList.innerHTML = '';
            visitHistoryList.appendChild(emptyVisitRow);
            totalVisitsBadge.textContent = '0 Visits';
            return;
        }

        visitHistoryList.innerHTML = '';
        nonAmcCalls.forEach((visit, index) => {
            const tr = document.createElement('tr');
            tr.className = 'fade-in';
            tr.style.animationDelay = `${index * 0.05}s`;

            const statusClass = getStatusClass(visit.status);
            const fee = parseFloat(visit.fee) || 0;

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600;">
                        ${escapeXml(visit.customerName)}
                        ${amcContracts.some(a => a.orgName.toLowerCase() === visit.customerName.toLowerCase() && a.status === 'Active') ? '<span class="amc-badge-active"><i class="fa-solid fa-shield-halved"></i> AMC Active</span>' : ''}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(visit.date).toLocaleDateString()}</div>
                </td>
                <td>
                    <span class="type-badge">${visit.type}</span>
                    <div style="font-size: 0.85rem; margin-top: 0.2rem;">${visit.category}</div>
                </td>
                <td><i class="fa-solid fa-user-gear" style="font-size: 0.8rem; opacity: 0.7;"></i> ${escapeXml(visit.tech)}</td>
                <td class="admin-only" style="font-weight: 500;">${window.formatCurrency(fee)}</td>
                <td>
                    <span class="visit-badge ${statusClass}" onclick="advanceStatus('${visit.id}')">
                        ${visit.status}
                    </span>
                    ${visit.rating ? `<div style="font-size: 0.85rem; margin-top: 0.25rem; color: #fbbf24;">${'★'.repeat(visit.rating)}${'☆'.repeat(5 - visit.rating)}</div>` : ''}
                </td>
                <td>
                    <div style="display: flex; gap: 0.4rem;">
                        <button class="btn-wa" onclick="shareVisitWA('${visit.id}')" title="Share via WhatsApp" style="padding: 0.4rem 0.6rem; font-size: 0.8rem;">
                            <i class="fa-brands fa-whatsapp"></i>
                        </button>
                        <button class="btn-edit" onclick="downloadVisitInvoice('${visit.id}')" title="Download Tax Invoice" style="padding: 0.4rem 0.6rem; font-size: 0.8rem;">
                            <i class="fa-solid fa-file-invoice" style="color: #ec4899;"></i>
                        </button>
                        <button class="btn-delete admin-only" onclick="deleteVisit('${visit.id}')" style="color: var(--danger); padding: 0.4rem 0.6rem; font-size: 0.8rem;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            `;
            visitHistoryList.appendChild(tr);
        });

        totalVisitsBadge.textContent = `${nonAmcCalls.length} Visits`;
        updateInsights();
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Visit Scheduled': return 'status-scheduled';
            case 'Technician On-Site': return 'status-onsite';
            case 'Job Resolved': return 'status-resolved';
            case 'Payment Received': return 'status-paid';
            default: return '';
        }
    };

    window.advanceStatus = async (id) => {
        const visit = nonAmcCalls.find(v => v.id === id);
        if (!visit) return;

        const flow = ['Visit Scheduled', 'Technician On-Site', 'Job Resolved', 'Payment Received'];
        const currentIndex = flow.indexOf(visit.status);
        
        if (currentIndex < flow.length - 1) {
            const nextStatus = flow[currentIndex + 1];
            visit.status = nextStatus;

            // Rating prompt on resolution
            if (nextStatus === 'Job Resolved') {
                const ratingStr = window.prompt('⭐ Rate this visit (1–5 stars):', '5');
                const rating = parseInt(ratingStr);
                if (!isNaN(rating) && rating >= 1 && rating <= 5) {
                    visit.rating = rating;
                }
            }

            saveState();
            renderVisits();
        }
    };

    window.deleteVisit = async (id) => {
        const confirmed = await showConfirm({
            title: 'Delete Visit?',
            message: 'Are you sure you want to remove this service visit log?',
            confirmText: 'Delete',
            confirmIcon: 'fa-trash-can',
            type: 'danger'
        });
        if (confirmed) {
            nonAmcCalls = nonAmcCalls.filter(v => v.id !== id);
            saveState();
            renderVisits();
        }
    };

    // --- Actions ---
    visitForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const feeRaw = document.getElementById('serviceCharge').value;
        const fee = parseFloat(feeRaw.replace(/,/g, '')) || 0;
        const techName = techSelect.value;
        const trackInPayroll = document.getElementById('trackInPayroll').checked;

        const newVisit = {
            id: 'visit_' + Date.now().toString(),
            customerName: document.getElementById('customerName').value.trim(),
            type: document.getElementById('visitType').value,
            category: document.getElementById('category').value,
            tech: techName,
            fee: fee,
            problem: document.getElementById('visitProblem').value.trim(),
            date: document.getElementById('visitDate').value,
            status: 'Visit Scheduled',
            createdAt: new Date().toISOString()
        };

        nonAmcCalls.unshift(newVisit);
        saveState();

        // Integration with Payroll: Add as a "Performance Bonus" or "Service Revenue" expense entry
        if (trackInPayroll && fee > 0) {
            updateStaffRevenue(techName, fee, newVisit.customerName);
        }

        visitForm.reset();
        init(); // Reset date and dropdowns
        showToast('Service visit scheduled successfully!');
    });

    window.shareVisitWA = (id) => {
        const visit = nonAmcCalls.find(v => v.id === id);
        if (!visit) return;
        const msg = `*Service Visit Scheduled*%0A*Customer:* ${visit.customerName}%0A*Type:* ${visit.type}%0A*Issue:* ${visit.problem}%0A*Date:* ${new Date(visit.date).toLocaleDateString()}%0A*Technician:* ${visit.tech}`;
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    };

    window.downloadVisitInvoice = (id) => {
        const visit = nonAmcCalls.find(v => v.id === id);
        if (!visit) return;
        generatePDF('Invoice', {
            id: visit.id,
            customer: visit.customerName,
            category: visit.category,
            fee: visit.fee,
            type: visit.type,
            tech: visit.tech,
            problem: visit.problem
        });
    };

    const updateStaffRevenue = (techName, amount, customer) => {
        let employees = DataController.getEmployees();
        const empIndex = employees.findIndex(e => e.name === techName);
        if (empIndex === -1) return;

        const now = new Date();
        const monthLabel = now.toLocaleString('default', { month: 'short' }) + ' ' + now.getFullYear();

        if (!employees[empIndex].expenses) employees[empIndex].expenses = [];
        
        employees[empIndex].expenses.push({
            id: 'rev_' + Date.now(),
            date: now.toISOString(),
            monthYear: monthLabel,
            category: 'Bonus', // Categorizing as Bonus for simplicity in payslip
            amount: amount * 0.1, // Example: Tech gets 10% commission/bonus for ad-hoc visits
            note: `Revenue from: ${customer} (Visit Fee: ₹${amount})`
        });

        DataController.saveEmployees(employees);
    };

    const escapeXml = (unsafe) => {
        if (!unsafe) return '';
        return unsafe.replace(/[<>&"']/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '"': return '&quot;';
                case "'": return '&apos;';
                default: return c;
            }
        });
    };

    window.filterVisits = () => {
        const query = document.getElementById('visitSearch')?.value.toLowerCase() || '';
        const rows = document.querySelectorAll('#visitHistoryList tr:not(#emptyVisitRow)');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    };

    init();
});
