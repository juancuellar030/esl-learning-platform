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
        fontWeight: '400',
        colorCardBg: '#ffffff',
        colorBorder: '#3d348b',
        colorHeaderBg: '#3d348b',
        colorText: '#333333',
        colorHeaderText: '#ffffff',
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
        fontWeightSelect: () => document.getElementById('fontWeightSelect'),
        colorCardBg: () => document.getElementById('colorCardBg'),
        colorBorder: () => document.getElementById('colorBorder'),
        colorHeaderBg: () => document.getElementById('colorHeaderBg'),
        colorText: () => document.getElementById('colorText'),
        colorHeaderText: () => document.getElementById('colorHeaderText'),
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

    // ── Toast Notifications ─────────────────────────────────
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;

        let iconClass = 'fa-info-circle';
        if (type === 'success') iconClass = 'fa-check-circle';
        if (type === 'error') iconClass = 'fa-exclamation-circle';
        if (type === 'warning') iconClass = 'fa-exclamation-triangle';

        toast.innerHTML = `
            <i class="fa-solid ${iconClass}"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);

        // trigger reflow
        void toast.offsetWidth;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
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
        card.style.fontWeight = state.fontWeight;
        headerEl.style.background = state.colorHeaderBg;
        headerEl.style.color = state.colorHeaderText;
        headerEl.style.display = state.showHeader ? 'flex' : 'none';

        // Header letters
        const letters = getHeaderLetters();
        headerEl.innerHTML = letters.map(l => `<span>${l}</span>`).join('');

        // Grid cells
        grid.style.gridTemplateColumns = `repeat(${state.gridSize}, 55px)`;
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
                downscaleImage(ev.target.result, 400, src => {
                    state.images.push({ src, name: file.name });
                    addThumbnail(state.images.length - 1, src);
                    updateImageCounter();
                    updatePreview();
                });
            };
            reader.readAsDataURL(file);
        });
    }

    function downscaleImage(dataUrl, maxSize, cb) {
        const img = new Image();
        img.onload = () => {
            let w = img.width;
            let h = img.height;
            // Preserve aspect ratio
            if (w > maxSize || h > maxSize) {
                const ratio = Math.min(maxSize / w, maxSize / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            // Use original type or PNG to preserve transparency
            const isJpeg = dataUrl.startsWith('data:image/jpeg');
            cb(canvas.toDataURL(isJpeg ? 'image/jpeg' : 'image/png', 0.85));
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
    function adjustWeightOptions() {
        const font = state.font || '';
        const weightSelect = el.fontWeightSelect();
        if (!weightSelect) return;

        // Disable/enable options based on selected font family
        if (font.includes('Quicksand')) {
            weightSelect.disabled = false;
            Array.from(weightSelect.options).forEach(opt => {
                opt.disabled = !['300', '400', '500', '600', '700'].includes(opt.value);
            });
            if (weightSelect.options[weightSelect.selectedIndex].disabled) weightSelect.value = '600';
        } else if (font.includes('Montserrat')) {
            weightSelect.disabled = false;
            Array.from(weightSelect.options).forEach(opt => opt.disabled = false);
        } else if (font.includes('Comic Neue')) {
            weightSelect.disabled = false;
            Array.from(weightSelect.options).forEach(opt => {
                opt.disabled = !['400', '700'].includes(opt.value);
            });
            if (weightSelect.options[weightSelect.selectedIndex].disabled) weightSelect.value = '700';
        } else if (font.includes('Baloo 2')) {
            weightSelect.disabled = false;
            Array.from(weightSelect.options).forEach(opt => {
                opt.disabled = !['400', '600', '800'].includes(opt.value);
            });
            if (weightSelect.options[weightSelect.selectedIndex].disabled) weightSelect.value = '800';
        } else {
            // Other fonts usually just have 400 (Regular)
            weightSelect.disabled = true;
            weightSelect.value = '400';
        }
        state.fontWeight = weightSelect.value;
    }

    function initDesignControls() {
        el.fontSelect().addEventListener('change', e => {
            state.font = e.target.value;
            adjustWeightOptions();
            updatePreview();
        });

        el.fontWeightSelect().addEventListener('change', e => {
            state.fontWeight = e.target.value;
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
        classic: { cardBg: '#ffffff', border: '#3d348b', headerBg: '#3d348b', text: '#333333', headerText: '#ffffff' },
        basic: { cardBg: '#ffffff', border: '#dddddd', headerBg: '#000000', text: '#000000', headerText: '#ffffff' },
        ocean: { cardBg: '#e3f2fd', border: '#1565c0', headerBg: '#1565c0', text: '#0d47a1', headerText: '#ffffff' },
        sunset: { cardBg: '#fff8e1', border: '#f18701', headerBg: '#f18701', text: '#5d4037', headerText: '#ffffff' },
        neon: { cardBg: '#12002b', border: '#ff006e', headerBg: '#00f5d4', text: '#00f5d4', headerText: '#12002b' },
        citrus: { cardBg: '#fffff3', border: '#f9a03f', headerBg: '#77b828', text: '#77b828', headerText: '#ffffff' },
        // Gradients (bg represents css for live preview, PDF uses linear-gradient mapping)
        grad_sunset: { isGradient: true, cardBg: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', border: '#ff9a9e', headerBg: '#ff9a9e', text: '#333333', headerText: '#ffffff', colors: ['#ff9a9e', '#fecfef'] },
        grad_ocean: { isGradient: true, cardBg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', border: '#4facfe', headerBg: '#4facfe', text: '#003366', headerText: '#ffffff', colors: ['#4facfe', '#00f2fe'] },
        grad_forest: { isGradient: true, cardBg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', border: '#43e97b', headerBg: '#43e97b', text: '#1e5f32', headerText: '#ffffff', colors: ['#43e97b', '#38f9d7'] },
        grad_night: { isGradient: true, cardBg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', border: '#a18cd1', headerBg: '#a18cd1', text: '#333366', headerText: '#ffffff', colors: ['#a18cd1', '#fbc2eb'] }
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
                state.colorHeaderText = theme.headerText;

                // For gradient themes, the hex inputs for card bg will just stay as whatever they were,
                // but we might want to set it to the first color of the gradient as a fallback
                el.colorCardBg().value = theme.isGradient ? theme.colors[0] : theme.cardBg;
                el.colorBorder().value = theme.border;
                el.colorHeaderBg().value = theme.headerBg;
                el.colorText().value = theme.text;
                el.colorHeaderText().value = theme.headerText;

                // Update visually for the custom bubble wrappers
                document.querySelector('[data-target="colorCardBg"]').style.setProperty('--color-val', theme.isGradient ? theme.colors[0] : theme.cardBg);
                document.querySelector('[data-target="colorBorder"]').style.setProperty('--color-val', theme.border);
                document.querySelector('[data-target="colorHeaderBg"]').style.setProperty('--color-val', theme.headerBg);
                document.querySelector('[data-target="colorText"]').style.setProperty('--color-val', theme.text);
                document.querySelector('[data-target="colorHeaderText"]').style.setProperty('--color-val', theme.headerText);

                updatePreview();
            });
        });
    }

    // ── Custom Color Picker Popover ───────────────────────────
    function initCustomColorPicker() {
        const popover = document.getElementById('custom-color-popover');
        const presetsContainer = document.getElementById('popover-presets');
        const hexInput = document.getElementById('popover-hex-input');

        let currentTargetId = null;
        let currentBubble = null;

        // Extract colors from THEMES to use as presets in the popover
        const presetColors = new Set();
        Object.values(THEMES).forEach(t => {
            presetColors.add(t.cardBg);
            presetColors.add(t.border);
            presetColors.add(t.headerBg);
            presetColors.add(t.text);
        });

        // Add some basic extras
        ['#ffffff', '#000000', '#f4f4f4', '#ffeb3b', '#f44336', '#2196f3', '#4caf50', '#9c27b0', '#ff9800', '#00bcd4'].forEach(c => presetColors.add(c));

        // Render presets
        Array.from(presetColors).slice(0, 15).forEach(color => {
            const btn = document.createElement('button');
            btn.className = 'preset-color';
            btn.style.backgroundColor = color;
            btn.addEventListener('click', () => {
                applyColor(color);
            });
            presetsContainer.appendChild(btn);
        });

        // Toggle popover on bubble click
        document.querySelectorAll('.color-picker-bubble').forEach(bubble => {
            bubble.addEventListener('click', (e) => {
                e.stopPropagation();

                const targetId = bubble.dataset.target;

                // If clicking same bubble, toggle it
                if (currentTargetId === targetId && popover.style.display === 'flex') {
                    popover.style.display = 'none';
                    return;
                }

                currentTargetId = targetId;
                currentBubble = bubble;

                const hiddenInput = document.getElementById(targetId);
                hexInput.value = hiddenInput.value;

                // Position popover inside the relative parent
                bubble.parentElement.appendChild(popover);
                popover.style.display = 'flex';
            });
        });

        // Hex input typing
        hexInput.addEventListener('input', (e) => {
            let val = e.target.value;
            if (!val.startsWith('#')) val = '#' + val;

            // Validate hex
            if (/^#[0-9A-F]{6}$/i.test(val)) {
                applyColor(val);
            }
        });

        function applyColor(hex) {
            if (!currentTargetId) return;

            hexInput.value = hex;

            // Update hidden native input + state
            const hiddenInput = document.getElementById(currentTargetId);
            hiddenInput.value = hex;
            state[currentTargetId] = hex;

            // Update bubble visual
            currentBubble.style.setProperty('--color-val', hex);

            updatePreview();
        }

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (popover.style.display === 'flex' && !popover.contains(e.target)) {
                popover.style.display = 'none';
            }
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

        el.paperSize().addEventListener('change', (e) => {
            const size = e.target.value;
            state.paperSize = size;

            const btn6 = Array.from(el.cardsPerPage()).find(btn => btn.dataset.cards === '6');
            if (btn6) {
                if (size === 'legal') {
                    btn6.style.display = '';
                } else {
                    btn6.style.display = 'none';
                    if (state.cardsPerPage === 6) {
                        // Fallback to 1 card
                        el.cardsPerPage().forEach(b => b.classList.remove('active'));
                        const btn1 = Array.from(el.cardsPerPage()).find(b => b.dataset.cards === '1');
                        if (btn1) {
                            btn1.classList.add('active');
                            state.cardsPerPage = 1;
                        }
                    }
                }
            }
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
            const qty = parseInt(el.cardQuantity().value, 10) || 6;
            state.cardQuantity = qty;
            state.paperSize = el.paperSize().value;

            const pool = getItemPool();
            if (pool.length < itemsRequired()) {
                const need = itemsRequired();
                showToast(`⚠ Not enough ${state.mode === 'word' ? 'words' : 'images'}! Need ${need}, have ${pool.length}.`, 'error');
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
                showToast('✓ PDF generated and downloaded!', 'success');
                el.callerBtn().style.opacity = '1';
                el.callerBtn().style.pointerEvents = 'auto';
            } catch (err) {
                console.error(err);
                showToast('✗ PDF generation failed. ' + err.message, 'error');
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
                showToast(`⚠ Add some ${state.mode === 'word' ? 'words' : 'images'} first!`, 'error');
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

    // ── Session Save / Load ───────────────────────────────────

    // Expose for external save
    function getState() {
        return state;
    }

    // Load from external source
    function loadState(savedState) {
        Object.assign(state, savedState);

        // Update UI

        // Mode toggle
        el.modeToggle().forEach(b => b.classList.remove('active'));
        const modeBtn = document.querySelector(`#modeToggle .pill[data-mode="${state.mode}"]`);
        if (modeBtn) modeBtn.classList.add('active');
        if (state.mode === 'word') {
            el.wordPanel().style.display = '';
            el.picPanel().style.display = 'none';
        } else {
            el.wordPanel().style.display = 'none';
            el.picPanel().style.display = '';
        }

        // Grid toggle
        el.gridToggle().forEach(b => b.classList.remove('active'));
        const gridBtn = document.querySelector(`#gridSizeToggle .pill[data-size="${state.gridSize}"]`);
        if (gridBtn) gridBtn.classList.add('active');

        // Free space
        const fsg = el.freeSpaceGroup();
        fsg.style.display = (state.gridSize % 2 === 1) ? '' : 'none';
        el.freeSpaceToggle().checked = state.freeSpace;
        el.freeSpaceText().disabled = !state.freeSpace;
        el.freeSpaceText().value = state.freeSpaceText;

        // Words
        el.wordInput().value = (state.words || []).join('\n');
        updateWordCounter();

        // Images
        el.imageThumbnails().innerHTML = '';
        if (state.images) {
            state.images.forEach((img, idx) => {
                addThumbnail(idx, img.src);
            });
        }
        updateImageCounter();

        // Headers
        el.headerToggle().checked = state.showHeader;
        el.headerModeGroup().style.display = state.showHeader ? '' : 'none';

        document.querySelectorAll('[name="headerMode"]').forEach(radio => {
            radio.checked = (radio.value === state.headerMode);
        });

        el.customHeaderInput().value = state.customHeader;
        el.customHeaderInput().style.display = state.headerMode === 'custom' ? '' : 'none';

        // Design
        el.fontSelect().value = state.font;
        el.fontWeightSelect().value = state.fontWeight;
        el.colorCardBg().value = state.colorCardBg;
        el.colorBorder().value = state.colorBorder;
        el.colorHeaderBg().value = state.colorHeaderBg;
        el.colorText().value = state.colorText;
        el.colorHeaderText().value = state.colorHeaderText;

        document.querySelector('[data-target="colorCardBg"]').style.setProperty('--color-val', state.colorCardBg);
        document.querySelector('[data-target="colorBorder"]').style.setProperty('--color-val', state.colorBorder);
        document.querySelector('[data-target="colorHeaderBg"]').style.setProperty('--color-val', state.colorHeaderBg);
        document.querySelector('[data-target="colorText"]').style.setProperty('--color-val', state.colorText);
        document.querySelector('[data-target="colorHeaderText"]').style.setProperty('--color-val', state.colorHeaderText);

        // Export settings
        el.cardQuantity().value = state.cardQuantity;
        el.paperSize().value = state.paperSize;

        const btn6 = document.querySelector(`#cardsPerPageToggle .pill[data-cards="6"]`);
        if (btn6) {
            btn6.style.display = state.paperSize === 'legal' ? '' : 'none';
        }

        el.cardsPerPage().forEach(b => b.classList.remove('active'));
        const cppBtn = document.querySelector(`#cardsPerPageToggle .pill[data-cards="${state.cardsPerPage}"]`);
        if (cppBtn) cppBtn.classList.add('active');

        // Caller UI re-init if already open
        if (el.callerView().style.display !== 'none') {
            window.BingoCaller.init(state);
            // We assume caller UI loadCallerState will be handled by the session load flow directly
        } else {
            // Revert state of caller button
            if (state.generatedCards && state.generatedCards.length > 0) {
                el.callerBtn().style.opacity = '1';
                el.callerBtn().style.pointerEvents = 'auto';
            } else {
                el.callerBtn().style.opacity = '0.65';
                el.callerBtn().style.pointerEvents = 'none';
            }
        }

        updatePreview();
    }

    function initSessionModals() {
        const saveModal = document.getElementById('saveSessionModal');
        const saveNameInput = document.getElementById('saveSessionName');
        const btnSaveDevice = document.getElementById('confirmSaveSession');
        const btnExportJson = document.getElementById('exportSessionBtn');
        const loadModal = document.getElementById('loadSessionModal');
        const sessionList = document.getElementById('sessionList');
        const sessionListEmpty = document.getElementById('sessionListEmpty');

        // Save Flow
        document.getElementById('saveSessionBtn').addEventListener('click', () => {
            saveNameInput.value = '';
            saveModal.style.display = 'flex';
            saveNameInput.focus();
        });

        document.getElementById('cancelSaveSession').addEventListener('click', () => saveModal.style.display = 'none');
        saveModal.addEventListener('click', e => { if (e.target === saveModal) saveModal.style.display = 'none'; });

        const performSave = async (isExport) => {
            const name = saveNameInput.value.trim() || 'Untitled Session';
            const callerState = window.BingoCaller && window.BingoCaller.getCallerState
                ? window.BingoCaller.getCallerState()
                : null;

            const sessionData = {
                id: Date.now(),
                name: name,
                date: new Date().toISOString(),
                generatorState: state,
                callerState: callerState
            };

            btnSaveDevice.classList.add('loading');

            try {
                if (isExport) {
                    await window.BingoStorage.exportSessionToJson(sessionData);
                    showToast('✓ Session exported to JSON file', 'success');
                } else {
                    await window.BingoStorage.saveSession(sessionData);
                    showToast('✓ Session saved to device', 'success');
                }
                saveModal.style.display = 'none';
            } catch (err) {
                console.error(err);
                showToast('✗ Save failed: ' + err.message, 'error');
            } finally {
                btnSaveDevice.classList.remove('loading');
            }
        };

        btnSaveDevice.addEventListener('click', () => performSave(false));
        btnExportJson.addEventListener('click', () => performSave(true));

        // Load Flow
        document.getElementById('loadSessionBtn').addEventListener('click', async () => {
            loadModal.style.display = 'flex';
            sessionList.style.display = 'none';
            sessionListEmpty.style.display = 'none';

            try {
                const sessions = await window.BingoStorage.getSessionsList();
                if (sessions.length === 0) {
                    sessionListEmpty.style.display = 'block';
                } else {
                    sessionList.innerHTML = '';
                    sessions.forEach(session => {
                        const li = document.createElement('li');
                        li.className = 'session-list-item';

                        const d = new Date(session.date);
                        const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        li.innerHTML = `
                            <div class="session-list-info">
                                <div class="session-list-title">${session.name}</div>
                                <div class="session-list-meta">
                                    <span><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                                    <span><i class="fa-solid fa-${session.mode === 'word' ? 'font' : 'image'}"></i> ${session.itemCount} items</span>
                                </div>
                            </div>
                            <div class="session-list-actions">
                                <button class="btn-session-load" data-id="${session.id}">Load</button>
                                <button class="btn-session-delete" data-id="${session.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        `;
                        sessionList.appendChild(li);
                    });
                    sessionList.style.display = 'flex';
                }
            } catch (err) {
                console.error(err);
                showToast('Failed to load sessions list', 'error');
            }
        });

        document.getElementById('closeLoadSessionModal').addEventListener('click', () => loadModal.style.display = 'none');
        loadModal.addEventListener('click', e => { if (e.target === loadModal) loadModal.style.display = 'none'; });

        // List Interaction (Delegated)
        sessionList.addEventListener('click', async e => {
            const loadBtn = e.target.closest('.btn-session-load');
            const delBtn = e.target.closest('.btn-session-delete');

            if (delBtn) {
                const id = delBtn.dataset.id;
                if (confirm('Delete this saved session?')) {
                    await window.BingoStorage.deleteSession(id);
                    delBtn.closest('.session-list-item').remove();
                    if (sessionList.children.length === 0) {
                        sessionList.style.display = 'none';
                        sessionListEmpty.style.display = 'block';
                    }
                }
            } else if (loadBtn) {
                const id = loadBtn.dataset.id;
                const fullSession = await window.BingoStorage.getSession(id);
                if (fullSession) {
                    loadState(fullSession.generatorState);
                    // Explicitly jump into Caller UI if we have valid Caller State
                    if (fullSession.callerState && fullSession.callerState.calledItems) {
                        el.generatorView().style.display = 'none';
                        el.callerView().style.display = '';
                        if (window.BingoCaller && window.BingoCaller.loadCallerState) {
                            window.BingoCaller.loadCallerState(fullSession.callerState, state);
                        }
                    } else {
                        // Default to returning to the generator
                        el.callerView().style.display = 'none';
                        el.generatorView().style.display = '';
                    }
                    showToast('✓ Session loaded', 'success');
                    loadModal.style.display = 'none';
                } else {
                    showToast('Failed to load session details', 'error');
                }
            }
        });

        // JSON Import
        const importInput = document.getElementById('importSessionFile');
        importInput.addEventListener('change', async (e) => {
            if (!e.target.files.length) return;
            const file = e.target.files[0];
            try {
                const parsedSession = await window.BingoStorage.importSessionFromJson(file);
                loadState(parsedSession.generatorState);
                if (parsedSession.callerState && parsedSession.callerState.calledItems) {
                    el.generatorView().style.display = 'none';
                    el.callerView().style.display = '';
                    if (window.BingoCaller && window.BingoCaller.loadCallerState) {
                        window.BingoCaller.loadCallerState(parsedSession.callerState, state);
                    }
                } else {
                    el.callerView().style.display = 'none';
                    el.generatorView().style.display = '';
                }
                showToast('✓ Session imported successfully', 'success');
                loadModal.style.display = 'none';
            } catch (err) {
                console.error(err);
                showToast(err.message || 'Failed to import JSON file', 'error');
            }
            importInput.value = ''; // Reset
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
        initCustomColorPicker();
        initCardsPerPage();
        initGenerateButton();
        initCallerButton();
        initSessionModals();

        // Initially hide the free space group for even grids
        if (state.gridSize % 2 === 0) {
            el.freeSpaceGroup().style.display = 'none';
        }

        // Caller button starts dimmed until words/images + generate done
        el.callerBtn().style.opacity = '0.65';

        adjustWeightOptions();
        updateWordCounter();
        updatePreview();
    }

    // Expose APIs for other modules
    window.BingoGenerator = {
        getState,
        loadState
    };

    document.addEventListener('DOMContentLoaded', init);
})();
