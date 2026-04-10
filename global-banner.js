document.addEventListener('DOMContentLoaded', () => {
    // Check if dismissed today
    const today = new Date().toDateString();
    const dismissedOn = localStorage.getItem('dot_banner_dismissed_today');
    if (dismissedOn === today) return;

    // Create banner
    const banner = document.createElement('div');
    banner.className = 'global-sync-banner';
    banner.style.cssText = `
        background: linear-gradient(90deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1));
        backdrop-filter: blur(10px);
        color: #e2e8f0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        padding: 0.6rem 1.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1.5rem;
        font-size: 0.8rem;
        z-index: 10001;
        position: relative;
        font-family: 'Inter', sans-serif;
    `;

    const isAdmin = JSON.parse(localStorage.getItem('dotsystem_auth_data') || '{}').role === 'admin';
    const isCloudActive = window.isFirebaseReady ? 'Active' : 'Offline';
    const statusColor = window.isFirebaseReady ? '#10b981' : '#f59e0b';
    const statusIcon = window.isFirebaseReady ? 'fa-cloud-arrow-up' : 'fa-cloud-slash';

    banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor}; box-shadow: 0 0 10px ${statusColor};"></div>
            <span><strong>Cloud Sync:</strong> ${isCloudActive}</span>
            <span style="opacity: 0.4; margin: 0 0.5rem;">|</span>
            <span style="opacity: 0.8;"><i class="fa-solid ${statusIcon}"></i> Your data is securely mirrored to the DOT Cloud.</span>
        </div>
        <div style="display: flex; gap: 0.75rem;">
            ${isAdmin ? `
            <button id="globalBackupBtn" style="
                background: rgba(255,255,255,0.05);
                color: #fff;
                border: 1px solid rgba(255,255,255,0.1);
                padding: 0.25rem 0.75rem;
                border-radius: 6px;
                font-size: 0.75rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                <i class="fa-solid fa-download"></i> Manual Backup
            </button>` : ''}
            <button id="closeWarningBtn" style="
                background: transparent;
                border: none;
                color: rgba(255,255,255,0.4);
                cursor: pointer;
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                transition: color 0.2s;
            " onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.4)'">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;

    // Insert at top of body
    document.body.insertBefore(banner, document.body.firstChild);

    // Event Listeners
    document.getElementById('globalBackupBtn').addEventListener('click', () => {
        if (typeof DataController !== 'undefined' && DataController.exportFullBackup) {
            DataController.exportFullBackup();
        } else {
             const backup = {};
             for (let i = 0; i < localStorage.length; i++) {
                 const key = localStorage.key(i);
                 backup[key] = localStorage.getItem(key);
             }
             const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
             const a = document.createElement('a');
             a.href = URL.createObjectURL(blob);
             a.download = `DOT_SYSTEM_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
             a.click();
        }
    });

    document.getElementById('closeWarningBtn').addEventListener('click', () => {
        banner.style.marginTop = '-50px';
        banner.style.opacity = '0';
        banner.style.transition = 'all 0.4s ease';
        setTimeout(() => {
            banner.remove();
            localStorage.setItem('dot_banner_dismissed_today', today);
        }, 400);
    });
});
