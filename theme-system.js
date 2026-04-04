document.addEventListener('DOMContentLoaded', () => {
    const themeCheckbox = document.getElementById('themeCheckbox');
    const body = document.body;

    const bootUI = () => {
        const settings = JSON.parse(localStorage.getItem('dot_system_settings')) || {};
        
        // 1. Theme
        const theme = settings.theme || localStorage.getItem('tally_theme') || 'dark';
        if (theme === 'light') {
            body.classList.add('light-theme');
            if (themeCheckbox) themeCheckbox.checked = true;
        } else {
            body.classList.remove('light-theme');
            if (themeCheckbox) themeCheckbox.checked = false;
        }

        // 2. Accent Color
        if (settings.accent) {
            document.documentElement.style.setProperty('--accent', settings.accent);
            document.documentElement.style.setProperty('--accent-glow', settings.accent + '33');
        }

        // 3. Compact Mode
        if (settings.compactMode) {
            body.classList.add('compact-mode');
        } else {
            body.classList.remove('compact-mode');
        }
    };

    const toggleTheme = () => {
        const isLight = body.classList.toggle('light-theme');
        const theme = isLight ? 'light' : 'dark';
        
        // Update both legacy and new keys for compatibility
        localStorage.setItem('tally_theme', theme);
        const settings = JSON.parse(localStorage.getItem('dot_system_settings')) || {};
        settings.theme = theme;
        localStorage.setItem('dot_system_settings', JSON.stringify(settings));
        
        if (themeCheckbox) themeCheckbox.checked = isLight;
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    };

    if (themeCheckbox) {
        themeCheckbox.addEventListener('change', toggleTheme);
    }
    
    // Listen for systemic updates (e.g. from Settings page)
    window.addEventListener('storage', (e) => {
        if (e.key === 'dot_system_settings') bootUI();
    });

    bootUI();
});
