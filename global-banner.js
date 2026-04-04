document.addEventListener('DOMContentLoaded', () => {
    // Check if dismissed today
    const today = new Date().toDateString();
    const dismissedOn = localStorage.getItem('dot_banner_dismissed_today');
    if (dismissedOn === today) return;

    // Create banner
    const banner = document.createElement('div');
    banner.className = 'global-warning-banner';
    banner.style.cssText = `
        background-color: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
        border-bottom: 1px solid rgba(245, 158, 11, 0.3);
        padding: 0.75rem 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        font-size: 0.85rem;
        z-index: 9999;
        position: relative;
    `;

    banner.innerHTML = `
        <div>
            <i class="fa-solid fa-triangle-exclamation"></i>
            <strong>Warning:</strong> Your data is stored locally in this browser. If you clear your cache, you will lose your data.
        </div>
        <button id="globalBackupBtn" style="
            background: #f59e0b;
            color: #fff;
            border: none;
            padding: 0.3rem 0.8rem;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        ">
            <i class="fa-solid fa-download"></i> Export Backup
        </button>
        <button id="closeWarningBtn" style="
            background: transparent;
            border: none;
            color: #f59e0b;
            cursor: pointer;
            font-size: 1rem;
            margin-left: auto;
            opacity: 0.8;
        ">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    // Insert at top of body
    document.body.insertBefore(banner, document.body.firstChild);

    // Event Listeners
    document.getElementById('globalBackupBtn').addEventListener('click', () => {
        if (typeof DataController !== 'undefined' && DataController.exportFullBackup) {
            DataController.exportFullBackup();
        } else if (typeof window.exportFullBackup === 'function') {
            window.exportFullBackup();
        } else {
             // fallback if DataController not fully loaded
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
        }
    });

    document.getElementById('closeWarningBtn').addEventListener('click', () => {
        banner.remove();
        localStorage.setItem('dot_banner_dismissed_today', today);
    });
});
