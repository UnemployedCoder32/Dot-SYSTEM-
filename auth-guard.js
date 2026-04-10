/**
 * auth-guard.js
 * Protects the application by ensuring the user is authenticated.
 * Supports Role-Based Access Control (RBAC).
 */

(function() {
    const AUTH_DATA_KEY = 'dotsystem_auth_data';
    const LOCK_PAGE = 'lock.html';
    
    // Resilient Session Check (prevents JSON.parse crashes from corrupted cache)
    let authData = null;
    try {
        const raw = localStorage.getItem(AUTH_DATA_KEY);
        if (raw && raw !== 'undefined' && raw !== '[object Object]') {
            authData = JSON.parse(raw);
        }
    } catch(e) {
        console.warn("Corrupted Auth Token cleared.");
        localStorage.removeItem(AUTH_DATA_KEY);
    }
    
    const isLockPage = window.location.pathname.endsWith(LOCK_PAGE);

    // 1. Mandatory Login Check
    if (!authData && !isLockPage) {
        window.location.href = LOCK_PAGE;
        return;
    }

    // 2. Prevent Staff access to sensitive pages
    if (authData && authData.role === 'staff') {
        const restricted = ['settings.html', 'employees.html', 'amc-management.html'];
        const current = window.location.pathname.split('/').pop();
        if (restricted.includes(current)) {
            window.location.href = 'index.html';
        }
    }

    // 3. Prevent loop on Lock Page if already valid
    if (authData && isLockPage) {
        window.location.href = 'index.html';
    }

    // Export global helpers
    window.logoutSystem = function() {
        localStorage.removeItem(AUTH_DATA_KEY);
        window.location.href = LOCK_PAGE;
    };

    window.getCurrentUser = () => authData;
    window.isAdmin = () => authData && authData.role === 'admin';

    // Global UI Shroud for Staff
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.isAdmin()) {
            document.body.classList.add('user-is-staff');
            const restricted = document.querySelectorAll('.admin-only, .admin-insight');
            restricted.forEach(el => el.style.display = 'none');
        }
    });

})();
