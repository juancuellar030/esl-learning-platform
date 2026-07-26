// Tools page — filter dashboard cards by search query

(function () {
    const $searchInput = document.getElementById('tools-search');
    const $searchBtn = document.getElementById('tools-search-btn');
    const $emptyState = document.getElementById('tools-search-empty');
    const $grid = document.getElementById('tools-grid');

    if (!$searchInput || !$grid) return;

    const cards = Array.from($grid.querySelectorAll('.dashboard-card'));

    function filterTools() {
        const query = $searchInput.value.trim().toLowerCase();
        let visibleCount = 0;

        cards.forEach((card) => {
            const text = card.textContent.toLowerCase();
            const matches = !query || text.includes(query);
            card.classList.toggle('is-hidden', !matches);
            if (matches) visibleCount++;
        });

        $emptyState.hidden = visibleCount > 0;
    }

    $searchInput.addEventListener('input', filterTools);
    $searchBtn.addEventListener('click', filterTools);
    $searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            filterTools();
        }
    });
})();
