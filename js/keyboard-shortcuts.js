// Keyboard Shortcut Playground — all progress and theme state is intentionally session-only.

const SHORTCUTS = [
    { id: 'copy', category: 'Basic Actions', keys: ['ctrl', 'c'], label: 'Copy', type: 'interactive', sandboxAction: 'copy' },
    { id: 'cut', category: 'Basic Actions', keys: ['ctrl', 'x'], label: 'Cut', type: 'interactive', sandboxAction: 'cut' },
    { id: 'paste', category: 'Basic Actions', keys: ['ctrl', 'v'], label: 'Paste', type: 'interactive', sandboxAction: 'paste' },
    { id: 'undo', category: 'Basic Actions', keys: ['ctrl', 'z'], label: 'Undo', type: 'interactive', sandboxAction: 'undo' },
    { id: 'redo', category: 'Basic Actions', keys: ['ctrl', 'y'], label: 'Redo', type: 'interactive', sandboxAction: 'redo' },
    { id: 'select-all', category: 'Basic Actions', keys: ['ctrl', 'a'], label: 'Select All', type: 'interactive', sandboxAction: 'selectAll' },
    { id: 'save', category: 'Basic Actions', keys: ['ctrl', 's'], label: 'Save', type: 'interactive', sandboxAction: 'save' },
    { id: 'print', category: 'Basic Actions', keys: ['ctrl', 'p'], label: 'Print', type: 'interactive', sandboxAction: 'print' },

    { id: 'bold', category: 'Text Formatting', keys: ['ctrl', 'b'], label: 'Bold', type: 'interactive', sandboxAction: 'bold' },
    { id: 'italic', category: 'Text Formatting', keys: ['ctrl', 'i'], label: 'Italic', type: 'interactive', sandboxAction: 'italic' },
    { id: 'underline', category: 'Text Formatting', keys: ['ctrl', 'u'], label: 'Underline', type: 'interactive', sandboxAction: 'underline' },
    { id: 'align-left', category: 'Text Formatting', keys: ['ctrl', 'shift', 'l'], label: 'Align Left', type: 'interactive', sandboxAction: 'justifyLeft' },
    { id: 'align-center', category: 'Text Formatting', keys: ['ctrl', 'shift', 'e'], label: 'Center Text', type: 'interactive', sandboxAction: 'justifyCenter' },
    { id: 'align-right', category: 'Text Formatting', keys: ['ctrl', 'shift', 'r'], label: 'Align Right', type: 'interactive', sandboxAction: 'justifyRight' },

    { id: 'new-tab', category: 'Web Browser', keys: ['ctrl', 't'], label: 'Open New Tab', type: 'demo', sandboxAction: null },
    { id: 'close-tab', category: 'Web Browser', keys: ['ctrl', 'w'], label: 'Close Tab', type: 'demo', sandboxAction: null },
    { id: 'reopen-tab', category: 'Web Browser', keys: ['ctrl', 'shift', 't'], label: 'Reopen Closed Tab', type: 'demo', sandboxAction: null },
    { id: 'history', category: 'Web Browser', keys: ['ctrl', 'h'], label: 'View History', type: 'demo', sandboxAction: null },
    { id: 'private-window', category: 'Web Browser', keys: ['ctrl', 'shift', 'n / p'], label: 'Open Private Window', type: 'demo', sandboxAction: null },

    { id: 'switch-app', category: 'Windows Actions', keys: ['alt', 'tab'], label: 'Switch Apps', type: 'interactive', sandboxAction: 'switchApp' },
    { id: 'show-desktop', category: 'Windows Actions', keys: ['win', 'd'], label: 'Show Desktop', type: 'interactive', sandboxAction: 'showDesktop' },
    { id: 'file-explorer', category: 'Windows Actions', keys: ['win', 'e'], label: 'Open File Explorer', type: 'interactive', sandboxAction: 'fileExplorer' },
    { id: 'close-app', category: 'Windows Actions', keys: ['alt', 'f4'], label: 'Close App', type: 'demo', sandboxAction: null },
    { id: 'lock-computer', category: 'Windows Actions', keys: ['win', 'l'], label: 'Lock Computer', type: 'demo', sandboxAction: null },

    { id: 'find', category: 'Search & Refresh', keys: ['ctrl', 'f'], label: 'Find', type: 'interactive', sandboxAction: 'find' },
    { id: 'refresh', category: 'Search & Refresh', keys: ['f5'], label: 'Refresh', type: 'interactive', sandboxAction: 'refresh' },
    { id: 'hard-refresh', category: 'Search & Refresh', keys: ['ctrl', 'f5'], label: 'Hard Refresh', type: 'interactive', sandboxAction: 'refresh' },

    { id: 'zoom-in', category: 'Zoom & View', keys: ['ctrl', '+'], label: 'Zoom In', type: 'interactive', sandboxAction: 'zoomIn' },
    { id: 'zoom-out', category: 'Zoom & View', keys: ['ctrl', '-'], label: 'Zoom Out', type: 'interactive', sandboxAction: 'zoomOut' },
    { id: 'reset-zoom', category: 'Zoom & View', keys: ['ctrl', '0'], label: 'Reset Zoom', type: 'interactive', sandboxAction: 'resetZoom' },
    { id: 'fullscreen', category: 'Zoom & View', keys: ['f11'], label: 'Full Screen', type: 'interactive', sandboxAction: 'fullscreenDemo' }
];

const CATEGORIES = [
    'Basic Actions',
    'Text Formatting',
    'Web Browser',
    'Windows Actions',
    'Search & Refresh',
    'Zoom & View'
];

const KEYBOARD_ROWS = [
    [
        ['escape', 'Esc', 'wide'], ['f1', 'F1'], ['f2', 'F2'], ['f3', 'F3'], ['f4', 'F4'],
        ['f5', 'F5'], ['f6', 'F6'], ['f7', 'F7'], ['f8', 'F8'], ['f9', 'F9'],
        ['f10', 'F10'], ['f11', 'F11'], ['f12', 'F12']
    ],
    [
        ['`', '`'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'],
        ['6', '6'], ['7', '7'], ['8', '8'], ['9', '9'], ['0', '0'], ['-', '-'],
        ['=', '='], ['backspace', 'Backspace', 'extra-wide']
    ],
    [
        ['tab', 'Tab', 'wide'], ['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R'], ['t', 'T'],
        ['y', 'Y'], ['u', 'U'], ['i', 'I'], ['o', 'O'], ['p', 'P'], ['[', '['], [']', ']'],
        ['\\', '\\', 'wide']
    ],
    [
        ['capslock', 'Caps Lock', 'extra-wide'], ['a', 'A'], ['s', 'S'], ['d', 'D'], ['f', 'F'],
        ['g', 'G'], ['h', 'H'], ['j', 'J'], ['k', 'K'], ['l', 'L'], [';', ';'], ["'", "'"],
        ['enter', 'Enter', 'extra-wide']
    ],
    [
        ['shift', 'Shift', 'shift'], ['z', 'Z'], ['x', 'X'], ['c', 'C'], ['v', 'V'],
        ['b', 'B'], ['n', 'N'], ['m', 'M'], [',', ','], ['.', '.'], ['/', '/'],
        ['shift', 'Shift', 'shift']
    ],
    [
        ['control', 'Ctrl', 'mod'], ['meta', 'Win', 'mod'], ['alt', 'Alt', 'mod'],
        [' ', 'Space', 'space'], ['alt', 'Alt', 'mod'], ['meta', 'Win', 'mod'],
        ['control', 'Ctrl', 'mod'], ['arrowleft', '←', 'arrow'], ['arrowup', '↑', 'arrow'],
        ['arrowdown', '↓', 'arrow'], ['arrowright', '→', 'arrow']
    ]
];

// Numpad keys carry their own data-key values so they highlight independently of the
// main row keys that share the same printed symbol. CSS places them on the grid.
const NUMPAD_KEYS = [
    ['numlock', 'Num Lock'],
    ['numpaddivide', '/'],
    ['numpadmultiply', '*'],
    ['numpadsubtract', '−'],
    ['numpad7', '7'],
    ['numpad8', '8'],
    ['numpad9', '9'],
    ['numpadadd', '+'],
    ['numpad4', '4'],
    ['numpad5', '5'],
    ['numpad6', '6'],
    ['numpad1', '1'],
    ['numpad2', '2'],
    ['numpad3', '3'],
    ['numpadenter', 'Enter'],
    ['numpad0', '0'],
    ['numpaddecimal', '.']
];

// KeyboardEvent.code -> the data-key of the numpad cap to light up. Needed because
// event.key alone is ambiguous (Numpad7 reports "7", or "Home" when Num Lock is off).
const NUMPAD_CODE_TO_KEY = {
    NumLock: 'numlock',
    NumpadDivide: 'numpaddivide',
    NumpadMultiply: 'numpadmultiply',
    NumpadSubtract: 'numpadsubtract',
    NumpadAdd: 'numpadadd',
    NumpadEnter: 'numpadenter',
    NumpadDecimal: 'numpaddecimal',
    Numpad0: 'numpad0',
    Numpad1: 'numpad1',
    Numpad2: 'numpad2',
    Numpad3: 'numpad3',
    Numpad4: 'numpad4',
    Numpad5: 'numpad5',
    Numpad6: 'numpad6',
    Numpad7: 'numpad7',
    Numpad8: 'numpad8',
    Numpad9: 'numpad9'
};

// A numpad press resolves to the same shortcut token as its main-row twin, so
// Ctrl+NumpadAdd and Ctrl+Equal both satisfy Zoom In.
const NUMPAD_CODE_TO_SHORTCUT_KEY = {
    NumpadAdd: '+',
    NumpadSubtract: '-',
    NumpadMultiply: '*',
    NumpadDivide: '/',
    NumpadDecimal: '.',
    NumpadEnter: 'enter',
    Numpad0: '0',
    Numpad1: '1',
    Numpad2: '2',
    Numpad3: '3',
    Numpad4: '4',
    Numpad5: '5',
    Numpad6: '6',
    Numpad7: '7',
    Numpad8: '8',
    Numpad9: '9'
};

const NUMPAD_MODIFIER_KEYS = [
    'numlock', 'numpaddivide', 'numpadmultiply', 'numpadsubtract', 'numpadadd'
];

const state = {
    completed: new Set(),
    activeCategory: CATEGORIES[0],
    selectedTen: new Set(),
    checkCorrect: new Set(),
    checkActive: false,
    sandboxFontSize: 18,
    shape: 'square',
    palette: 'classic',
    effect: 'none'
};

const dom = {};

document.addEventListener('DOMContentLoaded', init);

function init() {
    cacheDom();
    renderKeyboard();
    renderCategoryTabs();
    renderPracticeCards();
    renderDemoCards();
    renderCheckOptions();
    bindTabs();
    bindThemeControls();
    bindSandbox();
    bindCheckMyTen();
    bindKeyboardListeners();
    updateTheme();
    trackNavOffset();
}

// The keyboard block sticks below the site nav, whose height changes when its
// buttons wrap, so the offset is measured rather than hard-coded.
function trackNavOffset() {
    const nav = document.querySelector('.main-nav');
    if (!nav) return;

    const apply = () => {
        document.documentElement.style.setProperty('--ks-nav-offset', `${nav.offsetHeight}px`);
    };
    apply();
    window.addEventListener('resize', apply);
    // The icon webfont lands after DOMContentLoaded and changes the nav height.
    if (document.fonts) document.fonts.ready.then(apply);
}

function cacheDom() {
    dom.keyboard = document.getElementById('ks-keyboard');
    dom.shapePicker = document.getElementById('ks-shape-picker');
    dom.palettePicker = document.getElementById('ks-palette-picker');
    dom.effectPicker = document.getElementById('ks-effect-picker');
    dom.categoryTabs = document.getElementById('ks-category-tabs');
    dom.practiceGrid = document.getElementById('ks-practice-grid');
    dom.demoGrid = document.getElementById('ks-demo-grid');
    dom.sandbox = document.getElementById('ks-sandbox');
    dom.sandboxPanel = document.querySelector('.ks-sandbox-panel');
    dom.practiceSide = document.getElementById('ks-practice-side');
    dom.checkSide = document.getElementById('ks-check-side');
    dom.checkSession = document.getElementById('ks-check-session');
    dom.focusStatus = document.getElementById('ks-focus-status');
    dom.findBar = document.getElementById('ks-find-bar');
    dom.findInput = document.getElementById('ks-find-input');
    dom.findClose = document.getElementById('ks-find-close');
    dom.refreshSpinner = document.getElementById('ks-refresh-spinner');
    dom.checkOptions = document.getElementById('ks-check-options');
    dom.selectedCount = document.getElementById('ks-selected-count');
    dom.startCheck = document.getElementById('ks-start-check');
    dom.randomTen = document.getElementById('ks-random-ten');
    dom.score = document.getElementById('ks-score');
    dom.checkProgress = document.getElementById('ks-check-progress');
    dom.passBanner = document.getElementById('ks-pass-banner');
    dom.tryMore = document.getElementById('ks-try-more');
    dom.toast = document.getElementById('ks-toast');
}

function renderKeyLabel(key, label) {
    if (key === 'shift') {
        return '<span class="ks-key-label"><i class="fa-solid fa-arrow-up ks-key-icon" aria-hidden="true"></i><span>Shift</span></span>';
    }
    if (key === 'meta') {
        return '<span class="ks-key-label"><i class="fa-brands fa-windows ks-key-icon" aria-hidden="true"></i><span>Win</span></span>';
    }
    return label;
}

function renderKeyboard() {
    const mainRows = KEYBOARD_ROWS.map((row) => `
        <div class="ks-keyboard-row">
            ${row.map(([key, label, size = '']) => {
                const modifier = ['control', 'shift', 'alt', 'meta', 'enter', 'tab', 'capslock', 'backspace'].includes(key);
                const ariaLabel = key === 'shift' ? 'Shift' : key === 'meta' ? 'Win' : undefined;
                return `<div class="ks-key${size ? ` ks-key--${size}` : ''}${modifier ? ' ks-key--modifier' : ''}"
                    data-key="${escapeAttribute(key)}"${ariaLabel ? ` aria-label="${ariaLabel}"` : ''}>${renderKeyLabel(key, label)}</div>`;
            }).join('')}
        </div>
    `).join('');

    const numpadKeys = NUMPAD_KEYS.map(([key, label]) => `
        <div class="ks-key${NUMPAD_MODIFIER_KEYS.includes(key) ? ' ks-key--modifier' : ''}"
            data-key="${escapeAttribute(key)}">${label}</div>
    `).join('');

    dom.keyboard.innerHTML = `
        <div class="ks-keyboard-main">${mainRows}</div>
        <div class="ks-numpad" aria-label="Numeric keypad">${numpadKeys}</div>
    `;
}

function renderCategoryTabs() {
    dom.categoryTabs.innerHTML = CATEGORIES.map((category) => `
        <button type="button" class="ks-category-btn${category === state.activeCategory ? ' active' : ''}"
            data-category="${category}">${category}</button>
    `).join('');

    dom.categoryTabs.addEventListener('click', (event) => {
        const button = event.target.closest('[data-category]');
        if (!button) return;
        state.activeCategory = button.dataset.category;
        renderCategoryTabs();
        renderPracticeCards();
    }, { once: true });
}

function renderPracticeCards() {
    const shortcuts = SHORTCUTS.filter((shortcut) =>
        shortcut.type === 'interactive' && shortcut.category === state.activeCategory
    );

    dom.practiceGrid.innerHTML = shortcuts.map((shortcut) => `
        <article class="ks-card${state.completed.has(shortcut.id) ? ' completed' : ''}" data-shortcut-id="${shortcut.id}">
            <span class="ks-status-dot" aria-label="${state.completed.has(shortcut.id) ? 'Completed' : 'Not tried'}"></span>
            <h3>${shortcut.label}</h3>
            ${renderCombo(shortcut.keys)}
        </article>
    `).join('');
}

function renderCombo(keys) {
    return `<div class="ks-combo">${keys.map((key) =>
        `<kbd>${displayKey(key)}</kbd>`
    ).join('<span>+</span>')}</div>`;
}

function renderDemoCards() {
    const demos = SHORTCUTS.filter((shortcut) => shortcut.type === 'demo');
    dom.demoGrid.innerHTML = demos.map((shortcut) => `
        <article class="ks-card ks-demo-card" data-demo="${shortcut.id}">
            <div class="ks-demo-visual ks-demo-visual--${shortcut.id}">
                ${getDemoVisual(shortcut.id)}
            </div>
            <h3>${shortcut.label}</h3>
            ${renderCombo(shortcut.keys)}
            <label class="ks-self-check">
                <input type="checkbox">
                <span>I practiced this on my own PC</span>
            </label>
        </article>
    `).join('');

    dom.demoGrid.addEventListener('change', (event) => {
        const card = event.target.closest('.ks-demo-card');
        if (card) card.classList.toggle('self-checked', event.target.checked);
    });
}

function getDemoVisual(id) {
    if (id === 'lock-computer') {
        return '<i class="fa-solid fa-lock"></i><span class="ks-lock-ring"></span>';
    }
    if (id === 'close-app') {
        return '<div class="ks-demo-window"><i class="fa-solid fa-xmark"></i></div>';
    }
    if (id === 'history') {
        return '<i class="fa-solid fa-clock-rotate-left"></i><span class="ks-history-lines"></span>';
    }
    if (id === 'private-window') {
        return '<div class="ks-private-window"><i class="fa-solid fa-user-secret"></i></div>';
    }
    return '<div class="ks-tab-bar"><span></span><span></span><span></span></div>';
}

function renderCheckOptions() {
    const interactive = SHORTCUTS.filter((shortcut) => shortcut.type === 'interactive');
    dom.checkOptions.innerHTML = interactive.map((shortcut) => `
        <label class="ks-check-option${state.selectedTen.has(shortcut.id) ? ' selected' : ''}">
            <input type="checkbox" value="${shortcut.id}" ${state.selectedTen.has(shortcut.id) ? 'checked' : ''}
                ${state.checkActive ? 'disabled' : ''}>
            <span>
                <strong>${shortcut.label}</strong>
                ${renderCombo(shortcut.keys)}
            </span>
        </label>
    `).join('');
    updateSelectionStatus();
}

function renderCheckProgress() {
    const selected = SHORTCUTS.filter((shortcut) => state.selectedTen.has(shortcut.id));
    dom.checkProgress.innerHTML = selected.map((shortcut) => `
        <div class="ks-progress-item${state.checkCorrect.has(shortcut.id) ? ' completed' : ''}">
            <i class="fa-solid ${state.checkCorrect.has(shortcut.id) ? 'fa-circle-check' : 'fa-circle'}"></i>
            <span>${shortcut.label}</span>
            ${renderCombo(shortcut.keys)}
        </div>
    `).join('');
    dom.score.textContent = `${state.checkCorrect.size} / 10 correct`;
}

function bindTabs() {
    document.querySelector('.ks-tab-navigation').addEventListener('click', (event) => {
        const button = event.target.closest('.ks-tab-btn');
        if (!button) return;
        showTab(button.dataset.tab);
    });
}

function showTab(tabName) {
    document.querySelectorAll('.ks-tab-btn').forEach((button) => {
        const active = button.dataset.tab === tabName;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.ks-tab-panel').forEach((panel) => {
        const active = panel.dataset.panel === tabName;
        panel.classList.toggle('active', active);
        panel.hidden = !active;
    });

    if (tabName === 'check' && state.checkActive) {
        dom.checkSide.appendChild(dom.sandboxPanel);
    } else if (tabName === 'practice') {
        dom.practiceSide.appendChild(dom.sandboxPanel);
    }
}

function bindThemeControls() {
    dom.shapePicker.addEventListener('change', () => {
        state.shape = dom.shapePicker.value;
        updateTheme();
    });
    dom.palettePicker.addEventListener('change', () => {
        state.palette = dom.palettePicker.value;
        updateTheme();
    });
    dom.effectPicker.addEventListener('change', () => {
        state.effect = dom.effectPicker.value;
        updateTheme();
    });
}

function updateTheme() {
    dom.keyboard.className = [
        'ks-keyboard',
        state.shape === 'round' ? 'keyboard--round' : '',
        `keyboard--palette-${state.palette}`,
        state.effect !== 'none' ? `keyboard--fx-${state.effect}` : ''
    ].filter(Boolean).join(' ');
}

function bindSandbox() {
    dom.sandbox.addEventListener('focus', () => {
        dom.focusStatus.textContent = 'Sandbox active — try a shortcut';
        dom.focusStatus.classList.add('active');
    });
    dom.sandbox.addEventListener('blur', () => {
        dom.focusStatus.textContent = 'Click the sandbox to begin';
        dom.focusStatus.classList.remove('active');
    });
    dom.findInput.addEventListener('input', findInSandbox);
    dom.findClose.addEventListener('click', closeFind);
}

function bindCheckMyTen() {
    dom.checkOptions.addEventListener('change', (event) => {
        const checkbox = event.target.closest('input[type="checkbox"]');
        if (!checkbox || state.checkActive) return;

        if (checkbox.checked && state.selectedTen.size >= 10) {
            checkbox.checked = false;
            showToast('Choose no more than 10 shortcuts.');
            return;
        }

        if (checkbox.checked) state.selectedTen.add(checkbox.value);
        else state.selectedTen.delete(checkbox.value);
        renderCheckOptions();
    });

    dom.randomTen.addEventListener('click', () => {
        if (state.checkActive) return;
        const ids = SHORTCUTS.filter((shortcut) => shortcut.type === 'interactive').map((shortcut) => shortcut.id);
        ids.sort(() => Math.random() - 0.5);
        state.selectedTen = new Set(ids.slice(0, 10));
        renderCheckOptions();
    });

    dom.startCheck.addEventListener('click', startCheck);
    dom.tryMore.addEventListener('click', resetCheck);
}

function updateSelectionStatus() {
    dom.selectedCount.textContent = `${state.selectedTen.size} / 10 selected`;
    dom.startCheck.disabled = state.selectedTen.size !== 10 || state.checkActive;
}

function startCheck() {
    if (state.selectedTen.size !== 10) return;
    state.checkActive = true;
    state.checkCorrect.clear();
    dom.checkSession.hidden = false;
    dom.passBanner.hidden = true;
    dom.randomTen.disabled = true;
    renderCheckOptions();
    renderCheckProgress();
    dom.checkSide.appendChild(dom.sandboxPanel);
    dom.sandbox.focus();
}

function resetCheck() {
    state.checkActive = false;
    state.selectedTen.clear();
    state.checkCorrect.clear();
    dom.checkSession.hidden = true;
    dom.passBanner.hidden = true;
    dom.randomTen.disabled = false;
    dom.practiceSide.appendChild(dom.sandboxPanel);
    renderCheckOptions();
    renderCheckProgress();
}

function bindKeyboardListeners() {
    document.addEventListener('keydown', (event) => {
        highlightPressedKeys(event);
        if (event.repeat || document.activeElement !== dom.sandbox) return;

        const shortcut = SHORTCUTS.find((item) => item.type === 'interactive' && matchesShortcut(item, event));
        if (!shortcut) return;

        event.preventDefault();
        markCompleted(shortcut);
        performSandboxAction(shortcut, event);
    });

    document.addEventListener('keyup', (event) => {
        setKeyActive(resolveCapKey(event), false);
        syncModifierHighlights(event);
    });

    window.addEventListener('blur', clearKeyboardHighlights);
    window.addEventListener('beforeunload', (event) => {
        if (!state.checkActive || state.checkCorrect.size === 10) return;
        event.preventDefault();
        event.returnValue = '';
    });
}

function highlightPressedKeys(event) {
    setKeyActive(resolveCapKey(event), true);
    syncModifierHighlights(event);
}

function resolveCapKey(event) {
    return NUMPAD_CODE_TO_KEY[event.code] || normalizeKeyboardKey(event.key);
}

function syncModifierHighlights(event) {
    setKeyActive('control', event.ctrlKey);
    setKeyActive('alt', event.altKey);
    setKeyActive('shift', event.shiftKey);
    setKeyActive('meta', event.metaKey);
}

function setKeyActive(key, active) {
    if (key === null) return;
    dom.keyboard.querySelectorAll(`[data-key="${escapeSelector(key)}"]`).forEach((element) => {
        element.classList.toggle('active', active);
    });
}

function clearKeyboardHighlights() {
    dom.keyboard.querySelectorAll('.ks-key.active').forEach((key) => key.classList.remove('active'));
}

function matchesShortcut(shortcut, event) {
    const required = shortcut.keys.map((key) => key.toLowerCase());
    const key = normalizeShortcutKey(event);
    const needsCtrl = required.includes('ctrl');
    const needsShift = required.includes('shift');
    const needsAlt = required.includes('alt');
    const needsMeta = required.includes('win');
    const mainKey = required.find((item) => !['ctrl', 'shift', 'alt', 'win'].includes(item));

    return event.ctrlKey === needsCtrl &&
        event.shiftKey === needsShift &&
        event.altKey === needsAlt &&
        event.metaKey === needsMeta &&
        key === mainKey;
}

function normalizeShortcutKey(event) {
    const numpadKey = NUMPAD_CODE_TO_SHORTCUT_KEY[event.code];
    if (numpadKey) return numpadKey;
    const key = event.key.toLowerCase();
    if ((key === '=' || key === '+') && event.ctrlKey) return '+';
    return key;
}

function normalizeKeyboardKey(key) {
    const normalized = key.toLowerCase();
    if (normalized === 'ctrl') return 'control';
    if (normalized === 'os') return 'meta';
    return normalized;
}

function markCompleted(shortcut) {
    state.completed.add(shortcut.id);
    if (shortcut.category === state.activeCategory) renderPracticeCards();

    if (state.checkActive && state.selectedTen.has(shortcut.id)) {
        state.checkCorrect.add(shortcut.id);
        renderCheckProgress();
        if (state.checkCorrect.size === 10) {
            state.checkActive = false;
            dom.passBanner.hidden = false;
            dom.checkSession.hidden = true;
            dom.randomTen.disabled = false;
            dom.practiceSide.appendChild(dom.sandboxPanel);
            showToast('All 10 shortcuts completed!');
        }
    }
}

async function performSandboxAction(shortcut) {
    const action = shortcut.sandboxAction;
    const execActions = ['bold', 'italic', 'underline', 'justifyLeft', 'justifyCenter', 'justifyRight', 'undo', 'redo', 'selectAll'];

    if (execActions.includes(action)) {
        document.execCommand(action, false);
        return;
    }

    if (action === 'copy' || action === 'cut') {
        const selectedText = window.getSelection().toString();
        try {
            if (selectedText) await navigator.clipboard.writeText(selectedText);
            if (action === 'cut' && selectedText) document.execCommand('delete', false);
            showToast(action === 'copy' ? 'Copied from the sandbox!' : 'Cut from the sandbox!');
        } catch {
            document.execCommand(action, false);
            showToast(`${shortcut.label} detected — clipboard access was unavailable.`);
        }
        return;
    }

    if (action === 'paste') {
        try {
            const text = await navigator.clipboard.readText();
            document.execCommand('insertText', false, text);
            showToast('Pasted into the sandbox!');
        } catch {
            showToast('Paste detected — allow clipboard access to insert text.');
        }
        return;
    }

    if (action === 'save') showToast('Saved! (practice mode)');
    else if (action === 'print') showToast('Print preview (practice mode)');
    else if (action === 'find') openFind();
    else if (action === 'refresh') playRefresh();
    else if (action === 'zoomIn') adjustSandboxZoom(2);
    else if (action === 'zoomOut') adjustSandboxZoom(-2);
    else if (action === 'resetZoom') adjustSandboxZoom(0, true);
    else if (action === 'fullscreenDemo') showToast('Full screen shortcut detected! (practice mode)');
    else if (action === 'switchApp') showToast('App switch shortcut detected! (practice mode)');
    else if (action === 'showDesktop') showToast('Show Desktop detected! (practice mode)');
    else if (action === 'fileExplorer') showToast('File Explorer shortcut detected! (practice mode)');
}

function openFind() {
    dom.findBar.hidden = false;
    dom.findInput.focus();
}

function closeFind() {
    dom.findBar.hidden = true;
    dom.findInput.value = '';
    clearFindHighlights();
    dom.sandbox.focus();
}

function findInSandbox() {
    clearFindHighlights();
    const query = dom.findInput.value.trim();
    if (!query) return;

    const walker = document.createTreeWalker(dom.sandbox, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    const regex = new RegExp(escapeRegExp(query), 'gi');
    nodes.forEach((node) => {
        if (!regex.test(node.nodeValue)) return;
        regex.lastIndex = 0;
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        node.nodeValue.replace(regex, (match, offset) => {
            fragment.append(node.nodeValue.slice(lastIndex, offset));
            const mark = document.createElement('mark');
            mark.dataset.ksFind = 'true';
            mark.textContent = match;
            fragment.append(mark);
            lastIndex = offset + match.length;
            return match;
        });
        fragment.append(node.nodeValue.slice(lastIndex));
        node.replaceWith(fragment);
    });
}

function clearFindHighlights() {
    dom.sandbox.querySelectorAll('mark[data-ks-find]').forEach((mark) => {
        mark.replaceWith(document.createTextNode(mark.textContent));
    });
    dom.sandbox.normalize();
}

function playRefresh() {
    dom.refreshSpinner.classList.remove('active');
    void dom.refreshSpinner.offsetWidth;
    dom.refreshSpinner.classList.add('active');
    setTimeout(() => dom.refreshSpinner.classList.remove('active'), 900);
    showToast('Refreshed! (practice mode)');
}

function adjustSandboxZoom(delta, reset = false) {
    // Chrome may still zoom the page despite preventDefault; this is a known browser limitation.
    state.sandboxFontSize = reset ? 18 : Math.min(32, Math.max(12, state.sandboxFontSize + delta));
    dom.sandbox.style.fontSize = `${state.sandboxFontSize}px`;
    showToast(`Sandbox text: ${state.sandboxFontSize}px`);
}

let toastTimer;
function showToast(message) {
    clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.classList.add('visible');
    toastTimer = setTimeout(() => dom.toast.classList.remove('visible'), 2200);
}

function displayKey(key) {
    const labels = { ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', win: 'Win', '+': '+', '-': '−' };
    return labels[key] || key.toUpperCase();
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeAttribute(value) {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeSelector(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}
