/**
 * Shared Keyboard Shortcut Data + Virtual Keyboard Renderer
 *
 * Mirrors the SHORTCUTS / KEYBOARD_ROWS data and the keyboard markup used by the
 * Keyboard Shortcut Playground (js/keyboard-shortcuts.js), exposed as a reusable
 * module so other tools can render the same keyboard without loading that page's
 * script (which auto-inits against DOM ids that only exist there).
 *
 * Everything lives behind window.ShortcutsData: the Playground declares SHORTCUTS
 * and KEYBOARD_ROWS as top-level consts, so exposing bare globals here would throw
 * a redeclaration error if both files ever loaded on one page.
 *
 * Emitted markup matches the Playground exactly (.ks-key[data-key], .ks-numpad),
 * so the existing ks-* styles and .keyboard--palette-* themes in css/styles.css
 * apply with no extra CSS.
 */

window.ShortcutsData = (() => {
    'use strict';

    const SHORTCUTS = [
        { id: 'copy', category: 'Basic Actions', keys: ['ctrl', 'c'], label: 'Copy', type: 'interactive' },
        { id: 'cut', category: 'Basic Actions', keys: ['ctrl', 'x'], label: 'Cut', type: 'interactive' },
        { id: 'paste', category: 'Basic Actions', keys: ['ctrl', 'v'], label: 'Paste', type: 'interactive' },
        { id: 'undo', category: 'Basic Actions', keys: ['ctrl', 'z'], label: 'Undo', type: 'interactive' },
        { id: 'redo', category: 'Basic Actions', keys: ['ctrl', 'y'], label: 'Redo', type: 'interactive' },
        { id: 'select-all', category: 'Basic Actions', keys: ['ctrl', 'a'], label: 'Select All', type: 'interactive' },
        { id: 'save', category: 'Basic Actions', keys: ['ctrl', 's'], label: 'Save', type: 'interactive' },
        { id: 'print', category: 'Basic Actions', keys: ['ctrl', 'p'], label: 'Print', type: 'interactive' },

        { id: 'bold', category: 'Text Formatting', keys: ['ctrl', 'b'], label: 'Bold', type: 'interactive' },
        { id: 'italic', category: 'Text Formatting', keys: ['ctrl', 'i'], label: 'Italic', type: 'interactive' },
        { id: 'underline', category: 'Text Formatting', keys: ['ctrl', 'u'], label: 'Underline', type: 'interactive' },
        { id: 'align-left', category: 'Text Formatting', keys: ['ctrl', 'shift', 'l'], label: 'Align Left', type: 'interactive' },
        { id: 'align-center', category: 'Text Formatting', keys: ['ctrl', 'shift', 'e'], label: 'Center Text', type: 'interactive' },
        { id: 'align-right', category: 'Text Formatting', keys: ['ctrl', 'shift', 'r'], label: 'Align Right', type: 'interactive' },

        { id: 'new-tab', category: 'Web Browser', keys: ['ctrl', 't'], label: 'Open New Tab', type: 'demo' },
        { id: 'close-tab', category: 'Web Browser', keys: ['ctrl', 'w'], label: 'Close Tab', type: 'demo' },
        { id: 'new-window', category: 'Web Browser', keys: ['ctrl', 'n'], label: 'Open New Window', type: 'demo' },
        { id: 'reopen-tab', category: 'Web Browser', keys: ['ctrl', 'shift', 't'], label: 'Reopen Closed Tab', type: 'demo' },
        { id: 'history', category: 'Web Browser', keys: ['ctrl', 'h'], label: 'View History', type: 'demo' },
        { id: 'private-window', category: 'Web Browser', keys: ['ctrl', 'shift', 'n'], label: 'Open Private Window', type: 'demo' },

        { id: 'switch-app', category: 'Windows Actions', keys: ['alt', 'tab'], label: 'Switch Apps', type: 'interactive' },
        { id: 'show-desktop', category: 'Windows Actions', keys: ['win', 'd'], label: 'Show Desktop', type: 'interactive' },
        { id: 'file-explorer', category: 'Windows Actions', keys: ['win', 'e'], label: 'Open File Explorer', type: 'interactive' },
        { id: 'close-app', category: 'Windows Actions', keys: ['alt', 'f4'], label: 'Close App', type: 'demo' },
        { id: 'lock-computer', category: 'Windows Actions', keys: ['win', 'l'], label: 'Lock Computer', type: 'demo' },

        { id: 'find', category: 'Search & Refresh', keys: ['ctrl', 'f'], label: 'Find', type: 'interactive' },
        { id: 'refresh', category: 'Search & Refresh', keys: ['f5'], label: 'Refresh', type: 'interactive' },
        { id: 'hard-refresh', category: 'Search & Refresh', keys: ['ctrl', 'f5'], label: 'Hard Refresh', type: 'interactive' },

        { id: 'zoom-in', category: 'Zoom & View', keys: ['ctrl', '+'], label: 'Zoom In', type: 'interactive' },
        { id: 'zoom-out', category: 'Zoom & View', keys: ['ctrl', '-'], label: 'Zoom Out', type: 'interactive' },
        { id: 'reset-zoom', category: 'Zoom & View', keys: ['ctrl', '0'], label: 'Reset Zoom', type: 'interactive' },
        { id: 'fullscreen', category: 'Zoom & View', keys: ['f11'], label: 'Full Screen', type: 'interactive' }
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

    const NUMPAD_MODIFIER_KEYS = [
        'numlock', 'numpaddivide', 'numpadmultiply', 'numpadsubtract', 'numpadadd'
    ];

    const MODIFIER_CAPS = ['control', 'shift', 'alt', 'meta', 'enter', 'tab', 'capslock', 'backspace'];

    /**
     * Shortcut data and keyboard caps use different token namespaces: shortcuts say
     * 'ctrl'/'win', caps say 'control'/'meta'. Zoom In stores '+', which lives on the
     * '=' cap. Returns null when a token has no single clickable cap.
     */
    const COMBO_KEY_TO_CAP = {
        ctrl: 'control',
        win: 'meta',
        shift: 'shift',
        alt: 'alt',
        '+': '='
    };

    /** Main-row and numpad caps that satisfy the same shortcut token when clicked. */
    const CAP_ALIAS_GROUPS = [
        ['=', '+', 'numpadadd'],
        ['-', 'numpadsubtract'],
        ['0', 'numpad0'],
        ['enter', 'numpadenter'],
        ['.', 'numpaddecimal'],
        ['/', 'numpaddivide'],
        ['*', 'numpadmultiply']
    ];

    function canonicalizeCap(cap) {
        const key = String(cap).toLowerCase();
        const group = CAP_ALIAS_GROUPS.find((aliases) => aliases.includes(key));
        return group ? group[0] : key;
    }

    function getCapAliasGroup(cap) {
        const key = String(cap).toLowerCase();
        const group = CAP_ALIAS_GROUPS.find((aliases) => aliases.includes(key));
        return group ? [...group] : [key];
    }

    function capMatchesExpected(cap, expectedCap) {
        return canonicalizeCap(cap) === canonicalizeCap(expectedCap);
    }

    function normalizeComboKey(token) {
        const key = String(token).toLowerCase().trim();
        if (COMBO_KEY_TO_CAP[key]) return COMBO_KEY_TO_CAP[key];
        // Anything with a slash ("n / p") means "either key" and cannot be one cap.
        if (key.includes('/')) return null;
        return key;
    }

    /** Cap data-keys for a shortcut's combo, or null if any token is unmappable. */
    function comboCapKeys(shortcut) {
        const caps = [];
        for (const token of shortcut.keys) {
            const cap = normalizeComboKey(token);
            if (!cap) return null;
            caps.push(cap);
        }
        return caps;
    }

    function isSelectable(shortcut) {
        return comboCapKeys(shortcut) !== null;
    }

    /**
     * Live "press the keys" format cannot capture OS/browser shortcuts (Alt+Tab, Win+*, F11,
     * Ctrl+T new tab, etc.) because the browser never delivers those keydown events to the page.
     */
    function isLiveFormatAllowed(shortcut) {
        if (!shortcut) return false;
        if (shortcut.type === 'demo') return false;
        const keys = shortcut.keys.map((k) => String(k).toLowerCase());
        if (keys.some((k) => k === 'win' || k === 'alt')) return false;
        if (shortcut.id === 'fullscreen') return false;
        return true;
    }

    /** Downgrade live format to click or MCQ when the OS would steal the combo. */
    function resolveQuizFormat(shortcut, format) {
        if (format !== 'live' || isLiveFormatAllowed(shortcut)) return format;
        return shortcut.id.charCodeAt(0) % 2 === 0 ? 'mcq' : 'click';
    }

    // Every shortcut is fair game here (including browser-reserved "demo" ones) because
    // clicking caps never triggers a real keydown. Only unmappable combos drop out.
    const QUIZ_POOL = SHORTCUTS.filter(isSelectable);

    function displayKey(key) {
        const labels = { ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', win: 'Win', '+': '+', '-': '−' };
        return labels[key] || String(key).toUpperCase();
    }

    function formatCombo(shortcut) {
        return shortcut.keys.map(displayKey).join(' + ');
    }

    /** Order-independent comparison of clicked caps against the expected combo. */
    function isComboCorrect(selectedCaps, expectedCaps) {
        if (!Array.isArray(selectedCaps) || !Array.isArray(expectedCaps)) return false;
        const selected = new Set(selectedCaps.map((key) => canonicalizeCap(key)));
        const expected = new Set(expectedCaps.map((key) => canonicalizeCap(key)));
        if (selected.size !== expected.size) return false;
        for (const key of expected) {
            if (!selected.has(key)) return false;
        }
        return true;
    }

    function escapeAttribute(value) {
        return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }

    function renderKeyLabel(key, label) {
        if (key === 'shift') {
            return '<span class="ks-key-label"><i class="fa-solid fa-arrow-up ks-key-icon" aria-hidden="true"></i><span>Shift</span></span>';
        }
        if (key === 'meta') {
            return '<span class="ks-key-label"><i class="fa-brands fa-windows ks-key-icon" aria-hidden="true"></i><span>Win</span></span>';
        }
        if (key === 'numlock') {
            return '<span class="ks-key-label ks-key-label--stacked"><span>Num</span><span>Lock</span></span>';
        }
        return label;
    }

    /**
     * Builds the keyboard into any container. Same markup as the Playground's
     * renderKeyboard(), but takes the container instead of a cached module ref.
     */
    function renderVirtualKeyboard(container, options = {}) {
        if (!container) return;
        const { paletteClass = 'keyboard--palette-classic', includeNumpad = true } = options;

        const mainRows = KEYBOARD_ROWS.map((row) => `
            <div class="ks-keyboard-row">
                ${row.map(([key, label, size = '']) => {
                    const modifier = MODIFIER_CAPS.includes(key);
                    const ariaLabel = key === 'shift' ? 'Shift' : key === 'meta' ? 'Win' : undefined;
                    return `<div class="ks-key${size ? ` ks-key--${size}` : ''}${modifier ? ' ks-key--modifier' : ''}"
                        role="button" tabindex="0" aria-pressed="false"
                        data-key="${escapeAttribute(key)}"${ariaLabel ? ` aria-label="${ariaLabel}"` : ''}>${renderKeyLabel(key, label)}</div>`;
                }).join('')}
            </div>
        `).join('');

        const numpadKeys = NUMPAD_KEYS.map(([key, label]) => `
            <div class="ks-key${NUMPAD_MODIFIER_KEYS.includes(key) ? ' ks-key--modifier' : ''}"
                role="button" tabindex="0" aria-pressed="false"
                data-key="${escapeAttribute(key)}"${key === 'numlock' ? ' aria-label="Num Lock"' : ''}>${renderKeyLabel(key, label)}</div>
        `).join('');

        container.className = `ks-keyboard ${paletteClass}`.trim();
        container.innerHTML = `
            <div class="ks-keyboard-main">${mainRows}</div>
            ${includeNumpad ? `<div class="ks-numpad" aria-label="Numeric keypad">${numpadKeys}</div>` : ''}
        `;
    }

    function normalizeShortcutKey(event) {
        const key = String(event.key || '').toLowerCase();
        if ((key === '=' || key === '+') && event.ctrlKey) return '+';
        if (key === 'control') return 'ctrl';
        if (key === 'meta' || key === 'os') return 'win';
        return key;
    }

    /** True when a live KeyboardEvent matches the shortcut combo (modifiers + main key). */
    function matchesKeyboardEvent(shortcut, event) {
        if (!shortcut || !event) return false;
        const required = shortcut.keys.map((k) => String(k).toLowerCase());
        const needsCtrl = required.includes('ctrl');
        const needsShift = required.includes('shift');
        const needsAlt = required.includes('alt');
        const needsMeta = required.includes('win');
        const mainKey = required.find((item) => !['ctrl', 'shift', 'alt', 'win'].includes(item));
        const pressed = normalizeShortcutKey(event);

        return event.ctrlKey === needsCtrl &&
            event.shiftKey === needsShift &&
            event.altKey === needsAlt &&
            event.metaKey === needsMeta &&
            pressed === mainKey;
    }

    function isModifierOnlyEvent(event) {
        const key = normalizeShortcutKey(event);
        return ['ctrl', 'win', 'shift', 'alt', 'control', 'meta', 'os', 'capslock'].includes(key);
    }

    return {
        SHORTCUTS,
        QUIZ_POOL,
        KEYBOARD_ROWS,
        NUMPAD_KEYS,
        renderVirtualKeyboard,
        normalizeComboKey,
        comboCapKeys,
        canonicalizeCap,
        getCapAliasGroup,
        capMatchesExpected,
        isComboCorrect,
        matchesKeyboardEvent,
        isModifierOnlyEvent,
        isLiveFormatAllowed,
        resolveQuizFormat,
        displayKey,
        formatCombo
    };
})();
