// Tools Access - Password Protection for Teacher Tools
(function () {
    'use strict';

    const TOOLS_PASSWORD = 'admin_esl_2026';

    // Get DOM elements
    const toolsFab = document.getElementById('tools-fab');
    const passwordModal = document.getElementById('password-modal');
    const passwordInput = document.getElementById('password-input');
    const passwordSubmit = document.getElementById('password-submit');
    const passwordCancel = document.getElementById('password-cancel');
    const passwordError = document.getElementById('password-error');

    // Show password modal
    function showPasswordModal() {
        passwordModal.style.display = 'flex';
        passwordInput.value = '';
        passwordError.style.display = 'none';
        // Focus on input after animation
        setTimeout(() => passwordInput.focus(), 100);
    }

    // Hide password modal
    function hidePasswordModal() {
        passwordModal.style.display = 'none';
        passwordInput.value = '';
        passwordError.style.display = 'none';
    }

    // Verify password and redirect
    function verifyPassword() {
        const enteredPassword = passwordInput.value.trim();

        if (enteredPassword === TOOLS_PASSWORD) {
            // Correct password - redirect to tools page
            window.location.href = 'tools.html';
        } else {
            // Incorrect password - show error
            passwordError.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();

            // Shake animation for error
            passwordInput.style.animation = 'shake 0.5s';
            setTimeout(() => {
                passwordInput.style.animation = '';
            }, 500);
        }
    }

    // Event Listeners
    toolsFab.addEventListener('click', showPasswordModal);
    passwordCancel.addEventListener('click', hidePasswordModal);
    passwordSubmit.addEventListener('click', verifyPassword);

    // Submit on Enter key
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            verifyPassword();
        }
    });

    // Close modal on backdrop click
    passwordModal.addEventListener('click', (e) => {
        if (e.target === passwordModal) {
            hidePasswordModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && passwordModal.style.display === 'flex') {
            hidePasswordModal();
        }
    });

})();
