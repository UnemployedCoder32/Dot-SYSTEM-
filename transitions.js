document.addEventListener('DOMContentLoaded', () => {
    const preloader = document.getElementById('preloader');

    // 1. Entry Animation
    document.body.classList.add('page-entering');
    
    // Hide Preloader on Load (Wait for Data)
    const hidePreloader = () => {
        if (preloader) preloader.classList.add('hidden');
        document.body.classList.remove('page-exiting');
        document.body.classList.add('page-entering');
    };

    // Wait for DataController to signal data is ready
    window.addEventListener('dataUpdate', (e) => {
        if (e.detail && e.detail.key === 'ALL') {
             hidePreloader();
        }
    });
    
    // Explicit timeout as total fallback (3 seconds)
    setTimeout(hidePreloader, 3000);

    // 2. Intercept Navigation
    const navLinks = document.querySelectorAll('a:not([href^="http"]):not([href^="mailto"]):not([target="_blank"]):not(.btn-call):not(.btn-wa)');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            
            // Skip anchor links on same page
            if (href && !href.startsWith('#')) {
                e.preventDefault();
                
                // Show Preloader
                if (preloader) preloader.classList.remove('hidden');
                
                // Trigger Exit Animation
                document.body.classList.add('page-exiting');
                
                // Delay actual navigation
                setTimeout(() => {
                    window.location.href = href;
                }, 600);
            }
        });
    });

    // Handle back/forward cache
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            if (preloader) preloader.classList.add('hidden');
            document.body.classList.remove('page-exiting');
            document.body.classList.add('page-entering');
        }
    });
});
