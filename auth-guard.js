/**
 * auth-guard.js
 * Protects the application by ensuring the user is authenticated.
 * Redirects to lock.html if unauthorized.
 */

(function() {
    const AUTH_KEY = 'dotsystem_auth';
    const LOCK_PAGE = 'lock.html';
    
    // Check if current page is the lock page
    const isLockPage = window.location.pathname.endsWith(LOCK_PAGE);
    const isAuth = localStorage.getItem(AUTH_KEY) === 'authorized';

    if (!isAuth && !isLockPage) {
        // Not authorized and not on lock page, redirect to lock
        window.location.href = LOCK_PAGE;
    } else if (isAuth && isLockPage) {
        // Authorized but on lock page, redirect to dashboard
        window.location.href = 'index.html';
    }

    // Export global logout function
    window.logoutSystem = function() {
        localStorage.removeItem(AUTH_KEY);
        window.location.href = LOCK_PAGE;
    };
})();
