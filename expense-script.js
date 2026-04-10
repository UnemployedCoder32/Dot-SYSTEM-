document.addEventListener('DOMContentLoaded', () => {
    const expenseList = document.getElementById('expenseList');
    const expenseModal = document.getElementById('expenseModal');
    const expenseForm = document.getElementById('expenseForm');
    const statMonthExpense = document.getElementById('statMonthExpense');
    const statTotalSalaries = document.getElementById('statTotalSalaries');
    const statTotalUtilities = document.getElementById('statTotalUtilities');
    let editingId = null;

    const loadState = () => {
        renderExpenses();
    };

    window.addEventListener('dataUpdate', loadState);

    const renderExpenses = () => {
        if (!expenseList) return;
        const expenses = DataController.getExpenses() || [];
        expenseList.innerHTML = '';

        if (expenses.length === 0) {
            expenseList.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No expenses recorded yet.</td></tr>`;
        } else {
            // Sort by date desc
            expenses.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(exp => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-size: 0.85rem;">${new Date(exp.date).toLocaleDateString()}</td>
                    <td><span class="badge" style="background: rgba(59,130,246,0.1); color: #3b82f6;">${exp.category}</span></td>
                    <td>${escapeXml(exp.description || '--')}</td>
                    <td>
                        <span class="badge" style="${exp.status === 'Paid' ? 'background: rgba(16,185,129,0.1); color: #10b981;' : 'background: rgba(245,158,11,0.1); color: #f59e0b;'}">
                            ${exp.status}
                        </span>
                    </td>
                    <td style="text-align: right; font-weight: bold;">${window.formatCurrency(exp.amount)}</td>
                    <td style="text-align: right;">
                        <button class="btn-edit" onclick="editExpense('${exp.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="btn-delete" onclick="deleteExpense('${exp.id}')" style="color: var(--danger); background: none; border: none; cursor: pointer; margin-left: 0.5rem;"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                expenseList.appendChild(tr);
            });
        }

        updateStats(expenses);
    };

    const updateStats = (expenses) => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        
        let monthTotal = 0;
        let salaries = 0;
        let utilities = 0;

        expenses.forEach(exp => {
            const expTime = new Date(exp.date).getTime();
            if (expTime >= startOfMonth) {
                monthTotal += exp.amount;
                if (exp.category === 'Salary') salaries += exp.amount;
                if (exp.category === 'Electricity') utilities += exp.amount;
            }
        });

        if (statMonthExpense) statMonthExpense.textContent = window.formatCurrency(monthTotal);
        if (statTotalSalaries) statTotalSalaries.textContent = window.formatCurrency(salaries);
        if (statTotalUtilities) statTotalUtilities.textContent = window.formatCurrency(utilities);
    };

    window.openExpenseModal = () => {
        editingId = null;
        expenseForm.reset();
        document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('expSubmitBtn').textContent = 'Save Expense';
        expenseModal.classList.add('active');
    };

    window.closeExpenseModal = () => {
        expenseModal.classList.remove('active');
    };

    window.editExpense = (id) => {
        const expenses = DataController.getExpenses() || [];
        const exp = expenses.find(e => e.id === id);
        if (!exp) return;
        editingId = id;
        document.getElementById('expDate').value = exp.date;
        document.getElementById('expCategory').value = exp.category;
        document.getElementById('expAmount').value = exp.amount;
        document.getElementById('expDesc').value = exp.description || '';
        document.querySelector(`input[name="expStatus"][value="${exp.status}"]`).checked = true;
        document.getElementById('expSubmitBtn').textContent = 'Update Expense';
        expenseModal.classList.add('active');
    };

    window.deleteExpense = async (id) => {
        const confirmed = await window.showConfirm({
            title: 'Delete Expense',
            message: 'Are you sure you want to remove this expense record?',
            confirmText: 'Delete',
            type: 'danger'
        });
        if (confirmed) {
            let expenses = DataController.getExpenses() || [];
            expenses = expenses.filter(e => e.id !== id);
            DataController.saveExpenses(expenses);
            renderExpenses();
            window.showToast('Expense removed', 'info');
        }
    };

    if (expenseForm) {
        expenseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const expenses = DataController.getExpenses() || [];
            
            const expData = {
                date: document.getElementById('expDate').value,
                category: document.getElementById('expCategory').value,
                amount: parseFloat(document.getElementById('expAmount').value) || 0,
                status: document.querySelector('input[name="expStatus"]:checked').value,
                description: document.getElementById('expDesc').value.trim()
            };

            if (editingId) {
                const index = expenses.findIndex(e => e.id === editingId);
                if (index !== -1) {
                    expenses[index] = { ...expenses[index], ...expData };
                }
            } else {
                expenses.push({
                    id: 'exp_' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    ...expData
                });
            }

            DataController.saveExpenses(expenses);
            closeExpenseModal();
            renderExpenses();
            window.showToast(editingId ? 'Expense updated' : 'Expense recorded');
        });
    }

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

    loadState();
});
