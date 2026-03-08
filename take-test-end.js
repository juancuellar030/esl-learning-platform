    document.getElementById('cm-btn-next')?.addEventListener('click', () => {
        contextMenu.style.display = 'none';
        const scrQ = document.getElementById('screen-question');
        if (scrQ && scrQ.style.display !== 'none') {
            const btnNext = document.getElementById('btn-next');
            if (btnNext && !btnNext.disabled) btnNext.click();
        }
    });

    document.getElementById('cm-btn-restart')?.addEventListener('click', () => {
        contextMenu.style.display = 'none';

        // Show the stylized restart modal
        const restartModal = document.getElementById('restart-warning');
        if (restartModal) {
            restartModal.style.display = 'flex';
        }
    });

    // Wire up the new restart modal buttons
    document.getElementById('btn-cancel-restart')?.addEventListener('click', () => {
        const restartModal = document.getElementById('restart-warning');
        if (restartModal) restartModal.style.display = 'none';
    });

    document.getElementById('btn-confirm-restart')?.addEventListener('click', () => {
        location.reload();
    });
}

// ===== EXPOSED API =====
return {
    init: function () {
        loadTest();
        setupAntiCheatMenu();
    }
};

}) ();
