document.addEventListener('DOMContentLoaded', () => {
    const themeSwitcherHTML = `
        <div class="theme-switcher-container">
            <button class="theme-btn" id="theme-toggle-btn" title="Change Platform Theme">
                <i class="fa-solid fa-palette"></i>
            </button>
            <div class="theme-menu" id="theme-menu">
                <button class="theme-option" data-theme="default">
                    <span class="color-preview" style="background: #3d348b;"></span> Classic
                </button>
                <button class="theme-option" data-theme="nature">
                    <span class="color-preview" style="background: #2d6a4f;"></span> Nature
                </button>
                <button class="theme-option" data-theme="sunset">
                    <span class="color-preview" style="background: #b56576;"></span> Sunset
                </button>
                <button class="theme-option" data-theme="ocean">
                    <span class="color-preview" style="background: #0077b6;"></span> Ocean
                </button>
                <button class="theme-option" data-theme="amber">
                    <span class="color-preview" style="background: #f9c74f;"></span> Amber
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', themeSwitcherHTML);

    const themeBtn = document.getElementById('theme-toggle-btn');
    const themeMenu = document.getElementById('theme-menu');
    const themeOptions = document.querySelectorAll('.theme-option');

    // Load saved theme
    const savedTheme = localStorage.getItem('platform-theme') || 'default';
    applyTheme(savedTheme);

    themeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        themeMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        themeMenu.classList.remove('show');
    });

    themeMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.getAttribute('data-theme');
            applyTheme(theme);
            localStorage.setItem('platform-theme', theme);
            themeMenu.classList.remove('show');
        });
    });

    function applyTheme(theme) {
        // Remove all theme classes
        document.body.classList.remove('theme-nature', 'theme-sunset', 'theme-ocean', 'theme-amber');
        
        if (theme !== 'default') {
            document.body.classList.add(`theme-${theme}`);
        }
    }
});
