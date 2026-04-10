/**
 * auth-guard.js
 * Protects the application by ensuring the user is authenticated.
 * Redirects to lock.html if unauthorized.
 */

(function() {
    const AUTH_DATA_KEY = 'dotsystem_auth_data';
    const LOCK_PAGE = 'lock.html';
    
    // Check if current page is the lock page
    const isLockPage = window.location.pathname.endsWith(LOCK_PAGE);
    const authData = JSON.parse(localStorage.getItem(AUTH_DATA_KEY) || 'null');

    // 1. Check if user is logged in at all
    if (!authData && !isLockPage) {
        window.location.href = LOCK_PAGE;
        return;
    }

    // 2. Check 2FA status for Admins
    if (authData && authData.role === 'admin' && !authData.twoStepVerified && !isLockPage) {
        window.location.href = LOCK_PAGE + '?step=2';
        return;
    }

    // 3. Prevent Staff from accessing Admin-only pages
    if (authData && authData.role === 'staff') {
        const restrictedPages = ['settings.html', 'employees.html', 'amc-management.html'];
        const currentPage = window.location.pathname.split('/').pop();
        if (restrictedPages.includes(currentPage)) {
            window.alert("Access Denied: You do not have administrator privileges.");
            window.location.href = 'index.html';
        }
    }

    // 4. If fully authenticated, don't stay on lock page
    if (authData && isLockPage) {
        const isVerified = (authData.role === 'staff' || (authData.role === 'admin' && authData.twoStepVerified));
        if (isVerified && !window.location.search.includes('step=2')) {
            window.location.href = 'index.html';
        }
    }

    // Export global logout function
    window.logoutSystem = function() {
        localStorage.removeItem(AUTH_DATA_KEY);
        window.location.href = LOCK_PAGE;
    };
})();
