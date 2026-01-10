document.addEventListener('DOMContentLoaded', () => {
    const darkModeToggleHTML = `
        <button class="dark-mode-toggle" id="dark-mode-toggle" title="Toggle Dark Mode">
            <i class="fa-solid fa-moon"></i>
        </button>
    `;

    document.body.insertAdjacentHTML('beforeend', darkModeToggleHTML);

    const toggleBtn = document.getElementById('dark-mode-toggle');
    const icon = toggleBtn.querySelector('i');

    // Check for saved dark mode preference
    const isDarkMode = localStorage.getItem('dark-mode') === 'enabled';
    
    if (isDarkMode) {
        enableDarkMode();
    }

    toggleBtn.addEventListener('click', () => {
        const darkMode = localStorage.getItem('dark-mode');
        if (darkMode !== 'enabled') {
            enableDarkMode();
        } else {
            disableDarkMode();
        }
    });

    function enableDarkMode() {
        document.body.classList.add('dark-mode');
        icon.classList.replace('fa-moon', 'fa-sun');
        localStorage.setItem('dark-mode', 'enabled');
    }

    function disableDarkMode() {
        document.body.classList.remove('dark-mode');
        icon.classList.replace('fa-sun', 'fa-moon');
        localStorage.setItem('dark-mode', 'disabled');
    }
});
