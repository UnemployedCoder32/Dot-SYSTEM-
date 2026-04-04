document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('exportBackupBtn');
    const importBtn = document.getElementById('importBackupBtn');
    const importInput = document.getElementById('importBackupInput');

    // --- Export Logic ---
    exportBtn.addEventListener('click', () => {
        const backupData = {
            version: "1.0",
            timestamp: new Date().toISOString(),
            data: {}
        };

        const keys = [
            'hardware_sync_inventory',
            'hardware_sync_amc',
            'tally_repair_jobs',
            'tally_payroll_employees',
            'tally_payroll_expenses'
        ];

        keys.forEach(key => {
            const val = localStorage.getItem(key);
            if (val) backupData.data[key] = JSON.parse(val);
        });

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        
        a.href = url;
        a.download = `DOT_System_Backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // --- Import Logic ---
    importBtn.addEventListener('click', () => importInput.click());

    importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {

            try {
                const backup = JSON.parse(event.target.result);
                
                // --- Validation ---
                if (!backup.data || typeof backup.data !== 'object') {
                    throw new Error("Invalid backup format: Missing data object.");
                }

                const confirmed = await showConfirm({
                    title: 'Restore from Backup?',
                    message: 'This will overwrite ALL current data with the selected backup file. This cannot be undone.',
                    confirmText: 'Restore',
                    confirmIcon: 'fa-arrow-rotate-left',
                    type: 'warning'
                });
                if (confirmed) {
                    // Update localStorage
                    Object.entries(backup.data).forEach(([key, value]) => {
                        localStorage.setItem(key, JSON.stringify(value));
                    });

                    alert("System restored successfully! Refreshing page...");
                    location.reload();
                }
            } catch (err) {
                console.error(err);
                alert("Error importing backup: " + err.message);
            }
            importInput.value = ''; // Reset input
        };
        reader.readAsText(file);
    });
});
