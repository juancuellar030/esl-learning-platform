/* ============================================================
   BINGO GENERATOR — Core JS
   Handles UI, mode toggling, image upload, card generation,
   live preview, and view switching.
   ============================================================ */

(function () {
    'use strict';

    // ── State ─────────────────────────────────────────────────
    const state = {
        mode: 'word',           // 'word' | 'picture'
        gridSize: 4,
        freeSpace: false,
        freeSpaceText: '★ FREE ★',
        words: [],
        images: [],             // { src: base64, name: string }[]
        // Design
        showHeader: true,
        headerMode: 'bingo',    // 'bingo' | 'custom' | 'numbers'
        customHeader: '',
        font: "'Fredoka One', cursive",
        colorCardBg: '#ffffff',
        colorBorder: '#3d348b',
        colorHeaderBg: '#3d348b',
        colorText: '#333333',
        // Export
        cardQuantity: 6,
        paperSize: 'letter',
        cardsPerPage: 1,
        // Generated data (shared with pdf + caller)
        generatedCards: [],     // array of shuffled item arrays
        itemPool: [],           // all words or image objects
    };

    // ── Element refs ──────────────────────────────────────────
    const el = {
        modeToggle: () => document.querySelectorAll('#modeToggle .pill'),
        gridToggle: () => document.querySelectorAll('#gridSizeToggle .pill'),
        cardsPerPage: () => document.querySelectorAll('#cardsPerPageToggle .pill'),
        wordInput: () => document.getElementById('wordInput'),
        wordCounter: () => document.getElementById('wordCounter'),
        imageCounter: () => document.getElementById('imageCounter'),
        imageFileInput: () => document.getElementById('imageFileInput'),
        dropZone: () => document.getElementById('dropZone'),
        imageThumbnails: () => document.getElementById('imageThumbnails'),
        freeSpaceToggle: () => document.getElementById('freeSpaceToggle'),
        freeSpaceText: () => document.getElementById('freeSpaceText'),
        freeSpaceGroup: () => document.getElementById('freeSpaceGroup'),
        wordPanel: () => document.getElementById('wordInputPanel'),
        picPanel: () => document.getElementById('pictureInputPanel'),
        headerToggle: () => document.getElementById('headerToggle'),
        headerModeGroup: () => document.getElementById('headerModeGroup'),
        customHeaderInput: () => document.getElementById('customHeaderInput'),
        fontSelect: () => document.getElementById('fontSelect'),
        colorCardBg: () => document.getElementById('colorCardBg'),
        colorBorder: () => document.getElementById('colorBorder'),
        colorHeaderBg: () => document.getElementById('colorHeaderBg'),
        colorText: () => document.getElementById('colorText'),
        cardQuantity: () => document.getElementById('cardQuantity'),
        paperSize: () => document.getElementById('paperSize'),
        generateBtn: () => document.getElementById('generateBtn'),
        callerBtn: () => document.getElementById('callerBtn'),
        generateStatus: () => document.getElementById('generateStatus'),
        previewCard: () => document.getElementById('previewCard'),
        previewHeader: () => document.getElementById('previewHeader'),
        previewGrid: () => document.getElementById('previewGrid'),
        generatorView: () => document.getElementById('generatorView'),
        callerView: () => document.getElementById('callerView'),
    };

    // ── Helpers ───────────────────────────────────────────────
    function itemsRequired() {
        const total = state.gridSize * state.gridSize;
        return state.freeSpace ? total - 1 : total;
    }

    function getItemPool() {
        if (state.mode === 'word') {
            return state.words;
        } else {
            return state.images;
        }
    }

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function getHeaderLetters() {
        if (!state.showHeader) return [];
        if (state.headerMode === 'numbers') {
            return Array.from({ length: state.gridSize }, (_, i) => String(i + 1));
        }
        if (state.headerMode === 'custom') {
            const letters = state.customHeader.toUpperCase().padEnd(state.gridSize, ' ').slice(0, state.gridSize);
            return [...letters];
        }
        // default: B I N G O (truncate/extend as needed)
        const defaults = ['B', 'I', 'N', 'G', 'O'];
        return Array.from({ length: state.gridSize }, (_, i) => defaults[i] || String.fromCharCode(65 + i));
    }

    function showStatus(msg, type) {
        const s = el.generateStatus();
        s.textContent = msg;
        s.className = 'generate-status ' + type;
    }

    function hideStatus() {
        const s = el.generateStatus();
        s.style.display = 'none';
        s.className = 'generate-status';
    }

    // ── Counter updates ───────────────────────────────────────
    function updateWordCounter() {
        const need = itemsRequired();
        const have = state.words.length;
        const c = el.wordCounter();
        c.textContent = `(${have} / ${need} needed)`;
        c.className = 'item-counter' + (have >= need ? ' ready' : (have > 0 ? ' short' : ''));
    }

    function updateImageCounter() {
        const need = itemsRequired();
        const have = state.images.length;
        const c = el.imageCounter();
        c.textContent = `(${have} / ${need} needed)`;
        c.className = 'item-counter' + (have >= need ? ' ready' : (have > 0 ? ' short' : ''));
    }

    // ── Live Preview ──────────────────────────────────────────
    function updatePreview() {
        const card = el.previewCard();
        const headerEl = el.previewHeader();
        const grid = el.previewGrid();

        // Colors & font
        card.style.borderColor = state.colorBorder;
        card.style.fontFamily = state.font;
        headerEl.style.background = state.colorHeaderBg;
        headerEl.style.display = state.showHeader ? 'flex' : 'none';

        // Header letters
        const letters = getHeaderLetters();
        headerEl.innerHTML = letters.map(l => `<span>${l}</span>`).join('');

        // Grid cells
        grid.style.gridTemplateColumns = `repeat(${state.gridSize}, 28px)`;
        const total = state.gridSize * state.gridSize;
        const centerIdx = Math.floor(total / 2);
        grid.innerHTML = '';
        for (let i = 0; i < total; i++) {
            const cell = document.createElement('div');
            cell.className = 'preview-cell';
            const isFree = state.freeSpace && i === centerIdx && (state.gridSize % 2 === 1);
            if (isFree) {
                cell.classList.add('free-cell');
                cell.textContent = '★';
                cell.style.background = state.colorHeaderBg;
                cell.style.color = '#fff';
            } else {
                cell.style.background = state.colorCardBg;
                cell.style.color = state.colorText;
                cell.style.borderColor = state.colorBorder;
                cell.textContent = state.mode === 'word'
                    ? (state.words[i - (isFree ? 1 : 0)] || '?').substring(0, 3)
                    : (state.images[i] ? '🖼' : '?');
            }
            grid.appendChild(cell);
        }

        // Pulse animation on change
        card.classList.remove('morphing');
        void card.offsetWidth;
        card.classList.add('morphing');
    }

    // ── Mode toggle ───────────────────────────────────────────
    function initModeToggle() {
        el.modeToggle().forEach(btn => {
            btn.addEventListener('click', () => {
                el.modeToggle().forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.mode = btn.dataset.mode;

                if (state.mode === 'word') {
                    el.wordPanel().style.display = '';
                    el.picPanel().style.display = 'none';
                    updateWordCounter();
                } else {
                    el.wordPanel().style.display = 'none';
                    el.picPanel().style.display = '';
                    updateImageCounter();
                }
                updatePreview();
            });
        });
    }

    // ── Grid size toggle ──────────────────────────────────────
    function initGridToggle() {
        el.gridToggle().forEach(btn => {
            btn.addEventListener('click', () => {
                el.gridToggle().forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.gridSize = parseInt(btn.dataset.size, 10);

                // Free space only makes sense on odd grids
                const fsg = el.freeSpaceGroup();
                fsg.style.display = (state.gridSize % 2 === 1) ? '' : 'none';
                if (state.gridSize % 2 === 0) {
                    state.freeSpace = false;
                    el.freeSpaceToggle().checked = false;
                }

                updateWordCounter();
                updateImageCounter();
                updatePreview();
            });
        });
    }

    // ── Free space toggle ─────────────────────────────────────
    function initFreeSpace() {
        el.freeSpaceToggle().addEventListener('change', e => {
            state.freeSpace = e.target.checked;
            el.freeSpaceText().disabled = !state.freeSpace;
            updateWordCounter();
            updateImageCounter();
            updatePreview();
        });
        el.freeSpaceText().addEventListener('input', e => {
            state.freeSpaceText = e.target.value || '★ FREE ★';
            updatePreview();
        });
    }

    // ── Word input ────────────────────────────────────────────
    function initWordInput() {
        el.wordInput().addEventListener('input', () => {
            state.words = el.wordInput().value
                .split('\n')
                .map(w => w.trim())
                .filter(Boolean);
            updateWordCounter();
            updatePreview();
        });
    }

    // ── Image upload ──────────────────────────────────────────
    function initImageUpload() {
        const dz = el.dropZone();
        const fi = el.imageFileInput();

        dz.addEventListener('click', () => fi.click());

        dz.addEventListener('dragover', e => {
            e.preventDefault();
            dz.classList.add('dragover');
        });
        dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
        dz.addEventListener('drop', e => {
            e.preventDefault();
            dz.classList.remove('dragover');
            handleFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
        });

        fi.addEventListener('change', e => {
            handleFiles(Array.from(e.target.files));
            fi.value = '';
        });
    }

    function handleFiles(files) {
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = ev => {
                downscaleImage(ev.target.result, 200, src => {
                    state.images.push({ src, name: file.name });
                    addThumbnail(state.images.length - 1, src);
                    updateImageCounter();
                    updatePreview();
                });
            };
            reader.readAsDataURL(file);
        });
    }

    function downscaleImage(dataUrl, size, cb) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            // Center-crop square
            const min = Math.min(img.width, img.height);
            const sx = (img.width - min) / 2;
            const sy = (img.height - min) / 2;
            ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
            cb(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = dataUrl;
    }

    function addThumbnail(index, src) {
        const grid = el.imageThumbnails();
        const item = document.createElement('div');
        item.className = 'thumb-item';
        item.dataset.index = index;
        item.innerHTML = `
            <img src="${src}" alt="image ${index + 1}">
            <button class="thumb-remove" title="Remove"><i class="fa-solid fa-xmark"></i></button>
        `;
        item.querySelector('.thumb-remove').addEventListener('click', e => {
            e.stopPropagation();
            const idx = parseInt(item.dataset.index, 10);
            state.images.splice(idx, 1);
            // Re-index remaining thumbnails
            document.querySelectorAll('.thumb-item').forEach((t, i) => {
                t.dataset.index = i;
            });
            item.remove();
            updateImageCounter();
            updatePreview();
        });
        grid.appendChild(item);
    }

    // ── Header controls ───────────────────────────────────────
    function initHeaderControls() {
        el.headerToggle().addEventListener('change', e => {
            state.showHeader = e.target.checked;
            el.headerModeGroup().style.display = state.showHeader ? '' : 'none';
            updatePreview();
        });

        document.querySelectorAll('[name="headerMode"]').forEach(radio => {
            radio.addEventListener('change', e => {
                state.headerMode = e.target.value;
                el.customHeaderInput().style.display = state.headerMode === 'custom' ? '' : 'none';
                updatePreview();
            });
        });

        el.customHeaderInput().addEventListener('input', e => {
            state.customHeader = e.target.value;
            updatePreview();
        });
    }

    // ── Design controls ───────────────────────────────────────
    function initDesignControls() {
        el.fontSelect().addEventListener('change', e => {
            state.font = e.target.value;
            updatePreview();
        });

        ['colorCardBg', 'colorBorder', 'colorHeaderBg', 'colorText'].forEach(id => {
            el[id]().addEventListener('input', e => {
                state[id] = e.target.value;
                updatePreview();
            });
        });
    }

    // ── Theme presets ─────────────────────────────────────────
    const THEMES = {
        classic: { cardBg: '#ffffff', border: '#3d348b', headerBg: '#3d348b', text: '#333333' },
        ocean: { cardBg: '#e3f2fd', border: '#1565c0', headerBg: '#1565c0', text: '#0d47a1' },
        sunset: { cardBg: '#fff8e1', border: '#f18701', headerBg: '#f18701', text: '#5d4037' },
        candy: { cardBg: '#fce4ec', border: '#ad1457', headerBg: '#ad1457', text: '#880e4f' },
        forest: { cardBg: '#e8f5e9', border: '#2e7d32', headerBg: '#2e7d32', text: '#1b5e20' },
        midnight: { cardBg: '#263238', border: '#7678ed', headerBg: '#7678ed', text: '#eceff1' },
    };

    function initThemePresets() {
        document.querySelectorAll('.theme-swatch').forEach(btn => {
            btn.addEventListener('click', function () {
                const theme = THEMES[this.dataset.theme];
                if (!theme) return;

                // Ripple
                const ripple = document.createElement('span');
                ripple.className = 'ripple-effect';
                this.appendChild(ripple);
                setTimeout(() => ripple.remove(), 500);

                document.querySelectorAll('.theme-swatch').forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                state.colorCardBg = theme.cardBg;
                state.colorBorder = theme.border;
                state.colorHeaderBg = theme.headerBg;
                state.colorText = theme.text;

                el.colorCardBg().value = theme.cardBg;
                el.colorBorder().value = theme.border;
                el.colorHeaderBg().value = theme.headerBg;
                el.colorText().value = theme.text;

                updatePreview();
            });
        });
    }

    // ── Cards per page toggle ─────────────────────────────────
    function initCardsPerPage() {
        el.cardsPerPage().forEach(btn => {
            btn.addEventListener('click', () => {
                el.cardsPerPage().forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.cardsPerPage = parseInt(btn.dataset.cards, 10);
            });
        });
    }

    // ── Card generation (for PDF + Caller) ───────────────────
    function generateCards(quantity) {
        const pool = getItemPool();
        if (pool.length < itemsRequired()) return null;

        const cards = [];
        for (let c = 0; c < quantity; c++) {
            const shuffled = shuffle(pool).slice(0, itemsRequired());
            cards.push(shuffled);
        }
        return cards;
    }

    // ── Generate PDF button ───────────────────────────────────
    function initGenerateButton() {
        el.generateBtn().addEventListener('click', async () => {
            hideStatus();
            const qty = parseInt(el.cardQuantity().value, 10) || 6;
            state.cardQuantity = qty;
            state.paperSize = el.paperSize().value;

            const pool = getItemPool();
            if (pool.length < itemsRequired()) {
                const need = itemsRequired();
                showStatus(`⚠ Not enough ${state.mode === 'word' ? 'words' : 'images'}! Need ${need}, have ${pool.length}.`, 'error');
                return;
            }

            const btn = el.generateBtn();
            btn.classList.add('loading');
            btn.querySelector('i').className = 'fa-solid fa-spinner';
            btn.querySelector('span').textContent = 'Generating…';

            state.generatedCards = generateCards(qty);
            state.itemPool = pool;

            // Small delay to let the UI update before heavy PDF work
            await new Promise(r => setTimeout(r, 60));

            try {
                await window.BingoPDF.generate(state);
                showStatus('✓ PDF generated and downloaded!', 'success');
                el.callerBtn().style.opacity = '1';
                el.callerBtn().style.pointerEvents = 'auto';
            } catch (err) {
                console.error(err);
                showStatus('✗ PDF generation failed. ' + err.message, 'error');
            }

            btn.classList.remove('loading');
            btn.querySelector('i').className = 'fa-solid fa-wand-magic-sparkles';
            btn.querySelector('span').textContent = 'Generate PDF';
        });
    }

    // ── Caller Session button ─────────────────────────────────
    function initCallerButton() {
        el.callerBtn().addEventListener('click', () => {
            const pool = getItemPool();
            if (pool.length === 0) {
                showStatus(`⚠ Add some ${state.mode === 'word' ? 'words' : 'images'} first!`, 'error');
                return;
            }
            // Populate state if not yet generated
            if (!state.generatedCards.length) {
                state.generatedCards = generateCards(1) || [];
                state.itemPool = pool;
            }

            el.generatorView().style.display = 'none';
            el.callerView().style.display = '';
            window.BingoCaller.init(state);
        });

        document.getElementById('backToGenerator').addEventListener('click', () => {
            el.callerView().style.display = 'none';
            el.generatorView().style.display = '';
        });
    }

    // ── Init ──────────────────────────────────────────────────
    function init() {
        initModeToggle();
        initGridToggle();
        initFreeSpace();
        initWordInput();
        initImageUpload();
        initHeaderControls();
        initDesignControls();
        initThemePresets();
        initCardsPerPage();
        initGenerateButton();
        initCallerButton();

        // Initially hide the free space group for even grids
        if (state.gridSize % 2 === 0) {
            el.freeSpaceGroup().style.display = 'none';
        }

        // Caller button starts dimmed until words/images + generate done
        el.callerBtn().style.opacity = '0.65';

        updateWordCounter();
        updatePreview();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
