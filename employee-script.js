document.addEventListener('DOMContentLoaded', () => {
    

    // --- State Management ---
    // Example format: { id: "123", name: "Rahul", baseSalary: 20000, expenses: [{ type: "Petrol", amount: 500, note: "..." }] }
    let employees = DataController.getEmployees();

    // --- DOM Elements ---
    const empForm = document.getElementById('employeeForm');
    const expForm = document.getElementById('expenseForm');
    const expEmpSelect = document.getElementById('expenseEmp');
    
    const payrollList = document.getElementById('payrollList');
    const emptyRow = document.getElementById('emptyPayrollRow');
    const payrollFooter = document.getElementById('payrollFooter');
    
    const totalEmployeesBadge = document.getElementById('totalEmployees');
    const totalPayoutBadge = document.getElementById('totalPayout');
    const monthSelector = document.getElementById('monthSelector');
    const clearDataBtn = document.getElementById('clearDataBtn');

    // Modal Elements
    const modal = document.getElementById('expenseModal');
    const modalEmpName = document.getElementById('modalEmpName');
    const modalExpenseList = document.getElementById('modalExpenseList');
    const modalTotal = document.getElementById('modalTotal');

    let salaryChartInst = null;
    let expenseChartInst = null;
    let modalChartInst = null;

    // --- Utilities ---
    const applyRoleRestrictions = () => {
        const authData = JSON.parse(localStorage.getItem('dotsystem_auth_data') || '{}');
        const role = authData.role || 'staff';
        const name = authData.name || 'User';

        // 1. Personalized Greeting
        const welcomeText = document.querySelector('.header-title p') || document.querySelector('.header-left p');
        if (welcomeText) welcomeText.textContent = `Welcome back, ${name} | Role: ${role.toUpperCase()}`;

        if (role === 'staff') {
            document.body.classList.add('user-is-staff');
            
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
        DataController.saveEmployees(employees);
    };

    const loadState = () => {
        employees = DataController.getEmployees();
        renderDropdown();
        renderMonthSelector();
        renderTable();
        updateCharts();
        applyRoleRestrictions();
    };

    // Listen for cloud data updates
    window.addEventListener('dataUpdate', () => {
        loadState();
    });

    // --- Core Features ---

    const renderDropdown = () => {
        expEmpSelect.innerHTML = '<option value="" disabled selected>Choose an employee...</option>';
        employees.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.name;
            expEmpSelect.appendChild(opt);
        });
    };

    const renderMonthSelector = () => {
        const uniqueMonths = new Set();
        employees.forEach(emp => {
            emp.expenses.forEach(exp => {
                if (exp.monthYear) uniqueMonths.add(exp.monthYear);
            });
        });

        // Current month
        const now = new Date();
        const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        uniqueMonths.add(currentMonthYear);

        const sortedMonths = Array.from(uniqueMonths).sort().reverse();
        
        const currentValue = monthSelector.value;
        monthSelector.innerHTML = '<option value="all">All Time</option>';
        
        sortedMonths.forEach(my => {
            const [year, month] = my.split('-');
            const date = new Date(year, month - 1);
            const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
            
            const opt = document.createElement('option');
            opt.value = my;
            opt.textContent = label;
            monthSelector.appendChild(opt);
        });

        if (currentValue && monthSelector.querySelector(`option[value="${currentValue}"]`)) {
            monthSelector.value = currentValue;
        } else {
            monthSelector.value = currentMonthYear;
        }
    };

    const renderTable = () => {
        const selectedMonth = monthSelector.value;
        
        if (employees.length === 0) {
            payrollList.innerHTML = '';
            payrollList.appendChild(emptyRow);
            payrollFooter.style.display = 'none';
            totalEmployeesBadge.textContent = '0 Employees';
            return;
        }

        payrollList.innerHTML = '';
        let grandTotalPayout = 0;

        employees.forEach(emp => {
            // Filter expenses by selected month
            const filteredExpenses = selectedMonth === 'all' 
                ? emp.expenses 
                : emp.expenses.filter(exp => exp.monthYear === selectedMonth);

            const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
            const netSalary = emp.baseSalary + totalExpenses; 
            
            grandTotalPayout += netSalary;

            // YTD Calculation
            const currentYear = new Date().getFullYear();
            let ytdExpenses = 0;
            emp.expenses.forEach(e => {
                if (e.monthYear && e.monthYear.startsWith(String(currentYear))) {
                    ytdExpenses += e.amount;
                }
            });
            const currentMonth = new Date().getMonth() + 1;
            const ytdPayout = (emp.baseSalary * currentMonth) + ytdExpenses;
            
            const tr = document.createElement('tr');
            tr.className = 'fade-in';
            
            const expenseWarning = (totalExpenses > (emp.baseSalary * 0.3));
            const expenseClass = totalExpenses > 0 ? (expenseWarning ? 'expenses-badge warning' : 'expenses-badge') : '';

            tr.innerHTML = `
                <td>
                    <strong>${emp.name}</strong>
                    <div style="font-size: 0.75rem; color: #f59e0b; margin-top: 0.2rem;"><i class="fa-solid fa-coins"></i> YTD Payout: ${formatCurrency(ytdPayout)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem; margin-top: 0.2rem;">
                        <span>+91 ${emp.phone || 'N/A'}</span>
                        ${emp.phone ? `<a href="tel:+91${emp.phone}" class="btn-call" style="padding: 0.15rem 0.4rem; font-size: 0.75rem;" title="Call Employee"><i class="fa-solid fa-phone-volume"></i></a>` : ''}
                    </div>
                </td>
                <td>${formatCurrency(emp.baseSalary)}</td>
                <td><span class="${expenseClass}">${formatCurrency(totalExpenses)}${selectedMonth === 'all' ? ' (Total)' : ''}</span></td>
                <td><span class="salary-badge">${formatCurrency(netSalary)}</span></td>
                <td>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button class="details-btn" onclick="openExpenseModal('${emp.id}')" title="View Items">
                            <i class="fa-solid fa-list"></i> Details
                        </button>
                        ${selectedMonth !== 'all' ? `
                        <button class="btn ${emp.paidMonths && emp.paidMonths.includes(selectedMonth) ? 'btn-secondary' : 'btn-primary'}" onclick="markAsPaid('${emp.id}', '${selectedMonth}')" title="${emp.paidMonths && emp.paidMonths.includes(selectedMonth) ? 'Paid' : 'Mark as Paid'}" ${emp.paidMonths && emp.paidMonths.includes(selectedMonth) ? 'disabled' : ''} style="padding: 0.4rem 0.6rem; font-size: 0.85rem;">
                            <i class="fa-solid ${emp.paidMonths && emp.paidMonths.includes(selectedMonth) ? 'fa-check-double' : 'fa-check'}"></i>
                        </button>` : ''}
                        <button class="btn-delete-animated" onclick="deleteEmployee('${emp.id}')" title="Remove">
                             <svg viewBox="0 0 448 512" class="svgIcon"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg>
                        </button>
                    </div>
                </td>
            `;
            payrollList.appendChild(tr);
        });

        totalEmployeesBadge.textContent = `${employees.length} Employee${employees.length > 1 ? 's' : ''}`;
        totalPayoutBadge.innerHTML = `<strong>${formatCurrency(grandTotalPayout)}</strong>`;
        payrollFooter.style.display = 'table-row-group';
    };

    const refreshApp = (skipMonthSelector = false) => {
        saveState();
        renderDropdown();
        if (!skipMonthSelector) renderMonthSelector();
        renderTable();
        updateCharts();
    };

    // --- Payroll Archive ---
    const PAYROLL_ARCHIVE_KEY = 'dot_payroll_archive';

    window.archivePayroll = () => {
        const selectedMonth = monthSelector.value;
        if (!selectedMonth || selectedMonth === 'all') {
            showToast('Select a specific month to archive.', 'error');
            return;
        }

        const archive = JSON.parse(localStorage.getItem(PAYROLL_ARCHIVE_KEY) || '{}');
        const snapshot = employees.map(emp => {
            const filteredExpenses = emp.expenses.filter(exp => exp.monthYear === selectedMonth);
            const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
            return {
                id: emp.id,
                name: emp.name,
                phone: emp.phone,
                baseSalary: emp.baseSalary,
                expenses: filteredExpenses,
                totalExpenses,
                netSalary: emp.baseSalary + totalExpenses
            };
        });

        archive[selectedMonth] = { month: selectedMonth, archivedAt: new Date().toLocaleString(), employees: snapshot };
        localStorage.setItem(PAYROLL_ARCHIVE_KEY, JSON.stringify(archive));
        showToast(`Payroll for ${selectedMonth} archived!`);
        populateHistorySelect();
    };

    const populateHistorySelect = () => {
        const archive = JSON.parse(localStorage.getItem(PAYROLL_ARCHIVE_KEY) || '{}');
        const select = document.getElementById('historyMonthSelect');
        if (!select) return;
        select.innerHTML = '<option value="">— Select Month —</option>';
        Object.keys(archive).sort().reverse().forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            const [year, month] = key.split('-');
            opt.textContent = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
            select.appendChild(opt);
        });
    };

    window.togglePayrollHistory = () => {
        const panel = document.getElementById('payrollHistoryPanel');
        if (!panel) return;
        const isShown = panel.style.display !== 'none';
        panel.style.display = isShown ? 'none' : 'block';
        if (!isShown) populateHistorySelect();
    };

    window.renderPayrollHistory = (monthKey) => {
        const archive = JSON.parse(localStorage.getItem(PAYROLL_ARCHIVE_KEY) || '{}');
        const content = document.getElementById('payrollHistoryContent');
        if (!content) return;
        const data = archive[monthKey];
        if (!data) { content.innerHTML = '<p style="color: var(--text-muted);">No archive found.</p>'; return; }

        const total = data.employees.reduce((s, e) => s + e.netSalary, 0);
        const fmtDate = new Date(data.archivedAt).toLocaleDateString();
        content.innerHTML = `
            <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem;">Archived on ${data.archivedAt}</p>
            <table class="tally-table">
                <thead><tr><th>Employee</th><th>Base Salary</th><th>Expenses</th><th>Net Payout</th></tr></thead>
                <tbody>
                    ${data.employees.map(e => `
                        <tr>
                            <td><strong>${e.name}</strong></td>
                            <td>${formatCurrency(e.baseSalary)}</td>
                            <td>${formatCurrency(e.totalExpenses)}</td>
                            <td><span class="salary-badge">${formatCurrency(e.netSalary)}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot><tr>
                    <td colspan="3" class="text-right"><strong>Total Payout:</strong></td>
                    <td><strong>${formatCurrency(total)}</strong></td>
                </tr></tfoot>
            </table>
        `;
    };


    // --- Event Handlers ---

    // Add Employee
    empForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('empName').value.trim();
        const salaryInput = document.getElementById('baseSalary');
        const salary = Math.max(0, parseFloat(salaryInput.dataset.rawValue || salaryInput.value) || 0);

        const newEmp = {
            id: Date.now().toString(),
            name: name,
            phone: document.getElementById('empPhone').value.trim(),
            baseSalary: salary,
            expenses: []
        };

        employees.push(newEmp);
        empForm.reset();
        document.getElementById('empName').focus();
        refreshApp();
        showToast('New employee added to payroll.');
    });

    // Add Expense
    expForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const empId = expEmpSelect.value;
        if (!empId) {
            alert("Please select an employee.");
            return;
        }

        const typeInput = document.getElementById('expenseType');
        const amountInput = document.getElementById('expenseAmount');
        const noteInput = document.getElementById('expenseNote');

        const empIndex = employees.findIndex(emp => emp.id === empId);
        
        if (empIndex !== -1) {
            const now = new Date();
            const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            employees[empIndex].expenses.push({
                id: 'exp_' + Date.now().toString(),
                type: typeInput.value,
                amount: Math.max(0, parseFloat(amountInput.dataset.rawValue || amountInput.value) || 0),
                note: noteInput.value.trim() || '-',
                date: now.toLocaleDateString(),
                monthYear: monthYear
            });

            // Reset form except employee dropdown
            amountInput.value = '';
            noteInput.value = '';
            typeInput.value = 'Petrol'; // reset default
            refreshApp();
            showToast('Expense logged and net salary updated.');
        }
    });

    monthSelector.addEventListener('change', () => {
        renderTable();
    });

    // Delete Employee
    window.deleteEmployee = async (id) => {
        const confirmed = await showConfirm({
            title: 'Remove Employee?',
            message: 'This will permanently delete this employee and all their expense history.',
            confirmText: 'Remove Employee',
            confirmIcon: 'fa-user-minus',
            type: 'danger'
        });
        if (confirmed) {
            employees = employees.filter(emp => emp.id !== id);
            refreshApp();
        }
    };

    // Clear All
    clearDataBtn.addEventListener('click', async () => {
       const confirmed = await showConfirm({
           title: 'Clear All Staff Data?',
           message: 'WARNING: This will permanently delete ALL employee records and expense history. This cannot be undone.',
           confirmText: 'Clear All',
           confirmIcon: 'fa-database',
           type: 'danger',
           requireInput: 'RESET'
       });
       if (confirmed) {
           employees = [];
           refreshApp();
       }
    });


    // --- Modal Logic ---

    window.markAsPaid = async (empId, monthYear) => {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return;

        if (!emp.paidMonths) emp.paidMonths = [];
        
        const confirmed = await showConfirm({
            title: 'Mark as Paid?',
            message: `Confirm that you have paid ${emp.name} for ${monthYear}?`,
            confirmText: 'Mark Paid',
            confirmIcon: 'fa-check-double',
            type: 'primary'
        });

        if (confirmed) {
            emp.paidMonths.push(monthYear);
            refreshApp(true);
            if (window.showToast) showToast(`${emp.name} marked as paid for ${monthYear}.`);
        }
    };

    window.openExpenseModal = (empId) => {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return;

        const selectedMonth = monthSelector.value;
        const currentMonthDisplay = selectedMonth === 'all' ? 'All Time' : selectedMonth;
        modalEmpName.innerHTML = `<i class="fa-solid fa-receipt text-cyan"></i> ${emp.name} <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-muted);">(${currentMonthDisplay})</span>`;
        modalExpenseList.innerHTML = '';
        
        // Filter expenses by selected month
        const filteredExpenses = emp.expenses.filter(exp => {
            return selectedMonth === 'all' || exp.monthYear === selectedMonth;
        });
        
        if (filteredExpenses.length === 0) {
            modalExpenseList.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--text-muted)">
                    <i class="fa-solid fa-mug-hot" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <br>No expenses logged for this employee yet.
                </div>
            `;
            modalTotal.textContent = '₹0.00';
            modal.classList.add('active');
            return;
        }

        const chartContainer = document.getElementById('modalChartContainer');
        const ctx = document.getElementById('modalExpenseChart');

        let total = 0;
        const categoryTotals = {};
        
        // Map icon by type
        const icons = {
            'Petrol': 'fa-gas-pump',
            'Meals': 'fa-utensils',
            'Bonus': 'fa-star',
            'Other': 'fa-money-bill'
        };

        filteredExpenses.forEach(exp => {
            total += exp.amount;
            categoryTotals[exp.type] = (categoryTotals[exp.type] || 0) + exp.amount;
            
            const item = document.createElement('div');
            item.className = 'expense-item';
            
            // Add slight opacity to expenses from other months (Safety check, though filtered now)
            const isDifferentMonth = (selectedMonth !== 'all' && exp.monthYear !== selectedMonth);
            if (isDifferentMonth) {
                item.style.opacity = '0.5';
            }

            const iconRef = icons[exp.type] || 'fa-tag';

            item.innerHTML = `
                <div style="display: flex; gap: 1rem; align-items: flex-start;">
                    <div style="background: rgba(255,255,255,0.05); padding: 0.8rem; border-radius: 8px;">
                        <i class="fa-solid ${iconRef}" style="color: var(--accent); font-size: 1.2rem;"></i>
                    </div>
                    <div>
                        <div style="font-weight: 600; font-size: 1.05rem;">${exp.type}</div>
                        <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.2rem;">${exp.date} • ${exp.note}${isDifferentMonth ? ' <span style="font-style: italic;">(Other Month)</span>' : ''}</div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <strong class="expenses-badge">${formatCurrency(exp.amount)}</strong>
                    <div style="margin-top: 0.5rem;">
                        <button class="btn-delete-animated" style="margin-left: auto;" onclick="deleteExpense('${emp.id}', '${exp.id}')" title="Delete Expense">
                             <svg viewBox="0 0 448 512" class="svgIcon"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg>
                        </button>
                    </div>
                </div>
            `;
            modalExpenseList.appendChild(item);
        });

        modalTotal.textContent = formatCurrency(total);

        // Chart Render
        if (chartContainer && ctx && typeof Chart !== 'undefined') {
            chartContainer.style.display = 'block';
            if (modalChartInst) modalChartInst.destroy();
            modalChartInst = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: Object.keys(categoryTotals),
                    datasets: [{
                        data: Object.values(categoryTotals),
                        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { color: 'rgba(255,255,255,0.7)', font: { size: 10 }, boxWidth: 10 } }
                    }
                }
            });
        }

        // Update Download button with listener
        const downloadBtn = document.getElementById('downloadPayslipBtn');
        const newDownloadBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
        newDownloadBtn.addEventListener('click', () => generatePayslip(emp.id, selectedMonth));

        modal.classList.add('active');
    };

    window.generatePayslip = (empId, selectedMonth) => {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Month Display
        const monthDisplay = selectedMonth === 'all' ? 'All Time' : selectedMonth;
        const filteredExpenses = emp.expenses.filter(exp => selectedMonth === 'all' || exp.monthYear === selectedMonth);
        const expenseTotal = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const finalPayout = emp.baseSalary + expenseTotal;

        // --- Header ---
        doc.setFillColor(59, 130, 246); // Primary Blue
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("DOT SYSTEM | PAYROLL", 105, 25, { align: "center" });

        // --- Employee Info ---
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.text(`Employee Name: ${emp.name}`, 15, 60);
        doc.text(`Period: ${monthDisplay}`, 15, 68);
        doc.text(`Contact: ${emp.phone}`, 15, 76);
        doc.text(`Generated On: ${new Date().toLocaleDateString()}`, 15, 84);

        // --- Summary Table ---
        const summaryData = [
            ["Base Monthly Salary", formatCurrency(emp.baseSalary)],
            ["Total Managed Expenses", formatCurrency(expenseTotal)],
            ["Final Monthly Payout", formatCurrency(finalPayout)]
        ];

        doc.autoTable({
            startY: 95,
            head: [['Description', 'Amount']],
            body: summaryData,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] },
            styles: { font: 'helvetica', fontSize: 10 }
        });

        // --- Detailed Expenses ---
        if (filteredExpenses.length > 0) {
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("Detailed Expense Log", 15, doc.lastAutoTable.finalY + 15);

            const tableData = filteredExpenses.map(exp => [
                exp.date,
                exp.type,
                exp.note,
                formatCurrency(exp.amount)
            ]);

            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 20,
                head: [['Date', 'Category', 'Note', 'Amount']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [148, 163, 184] },
                styles: { font: 'helvetica', fontSize: 9 }
            });
        }

        // --- Footer ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("DOT System - Computer Sales & Service Portal", 105, 285, { align: "center" });
            doc.text(`Page ${i} of ${pageCount}`, 200, 285, { align: "right" });
        }

        doc.save(`Payslip_${emp.name.replace(/\s/g, '_')}_${monthDisplay.replace(/\s/g, '_')}.pdf`);
    };

    window.closeModal = () => {
        modal.classList.remove('active');
    };

    window.deleteExpense = (empId, expId) => {
        const empIndex = employees.findIndex(emp => emp.id === empId);
        if (empIndex !== -1) {
            employees[empIndex].expenses = employees[empIndex].expenses.filter(exp => exp.id !== expId);
            refreshApp(true); // Don't reset selector while deleting from modal
            // Re-render modal current view
            openExpenseModal(empId);
        }
    };

    // Close modal on outside click
    window.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };


    window.filterPayroll = () => {
        const query = document.getElementById('payrollSearch')?.value.toLowerCase() || '';
        const rows = document.querySelectorAll('#payrollList tr:not(.empty-state)');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    };

    const updateCharts = () => {
        const salaryCtx = document.getElementById('salaryChart')?.getContext('2d');
        const expenseCtx = document.getElementById('expenseChart')?.getContext('2d');

        if (!salaryCtx || !expenseCtx) return;

        // 1. Salary Distribution Chart
        const salaryLabels = employees.map(emp => emp.name);
        const salaryData = employees.map(emp => emp.baseSalary);

        if (salaryChartInst) salaryChartInst.destroy();
        salaryChartInst = new Chart(salaryCtx, {
            type: 'bar',
            data: {
                labels: salaryLabels,
                datasets: [{
                    label: 'Base Salary (₹)',
                    data: salaryData,
                    backgroundColor: 'rgba(0, 180, 219, 0.4)',
                    borderColor: '#00B4DB',
                    borderWidth: 2,
                    borderRadius: 8,
                    hoverBackgroundColor: 'rgba(0, 180, 219, 0.6)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#00B4DB',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => ` Salary: ₹${context.raw.toLocaleString()}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.6)', callback: (v) => '₹' + v.toLocaleString() }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'rgba(255, 255, 255, 0.6)' }
                    }
                }
            }
        });

        // 2. Expense Trends Chart (Last 6 Months)
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            last6Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }

        const expenseData = last6Months.map(my => {
            let total = 0;
            employees.forEach(emp => {
                emp.expenses.forEach(exp => {
                    if (exp.monthYear === my) total += exp.amount;
                });
            });
            return total;
        });

        const monthLabels = last6Months.map(my => {
            const [y, m] = my.split('-');
            return new Date(y, m - 1).toLocaleString('default', { month: 'short' });
        });

        if (expenseChartInst) expenseChartInst.destroy();
        expenseChartInst = new Chart(expenseCtx, {
            type: 'line',
            data: {
                labels: monthLabels,
                datasets: [{
                    label: 'Total Expenses',
                    data: expenseData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointRadius: 5,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => ` Total: ₹${context.raw.toLocaleString()}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.6)', callback: (v) => '₹' + v.toLocaleString() }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'rgba(255, 255, 255, 0.6)' }
                    }
                }
            }
        });
    };

    // --- Initial Load ---
    refreshApp();
});
