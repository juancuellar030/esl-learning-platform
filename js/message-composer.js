// Broadcast Message Composer

const PRESET_MESSAGES = [
    { label: 'Look at the front screen', text: 'Look at the front screen', color: 'blue' },
    { label: 'Stop and listen', text: 'Stop and listen', color: 'red' },
    { label: "Time's up", text: "Time's up", color: 'yellow' },
    { label: 'Great job!', text: 'Great job!', color: 'green' },
    { label: 'Raise your hand if you need help', text: 'Raise your hand if you need help', color: 'blue' }
];

const COLOR_THEMES = {
    blue: { bg: '#1a4fa0', text: '#ffffff', label: 'Instruction' },
    red: { bg: '#c62828', text: '#ffffff', label: 'Warning' },
    green: { bg: '#2e7d32', text: '#ffffff', label: 'Praise' },
    yellow: { bg: '#f7b801', text: '#1a1a1a', label: 'Attention' }
};

const FONT_SIZES = {
    small: '3vw',
    medium: '5vw',
    large: '7vw',
    huge: '9vw'
};

const PREVIEW_FONT_SIZES = {
    small: '0.65rem',
    medium: '0.85rem',
    large: '1.1rem',
    huge: '1.4rem'
};

const RECENT_KEY = 'broadcastRecentMessages';
const MAX_RECENT = 5;

let selectedColor = 'blue';
let selectedSize = 'huge';

const $messageText = document.getElementById('message-text');
const $animationSelect = document.getElementById('animation-select');
const $previewScreen = document.getElementById('preview-screen');
const $broadcastLink = document.getElementById('broadcast-link');
const $copyFeedback = document.getElementById('copy-feedback');
const $presetContainer = document.getElementById('preset-buttons');
const $colorSwatches = document.getElementById('color-swatches');
const $sizeOptions = document.getElementById('size-options');
const $recentContainer = document.getElementById('recent-buttons');
const $generateBtn = document.getElementById('generate-link-btn');
const $copyBtn = document.getElementById('copy-link-btn');

function init() {
    renderPresets();
    renderColorSwatches();
    renderSizeOptions();
    renderRecentMessages();
    bindEvents();
    updatePreview();
}

function renderPresets() {
    $presetContainer.innerHTML = PRESET_MESSAGES.map((preset, i) =>
        `<button type="button" class="preset-btn" data-preset="${i}">${preset.label}</button>`
    ).join('');
}

function renderColorSwatches() {
    $colorSwatches.innerHTML = Object.entries(COLOR_THEMES).map(([key, theme]) => `
        <div class="color-swatch-wrap">
            <button type="button" class="color-swatch${key === selectedColor ? ' active' : ''}"
                data-color="${key}" style="background:${theme.bg}"
                title="${theme.label}" aria-label="${theme.label}"></button>
            <span class="color-swatch-label">${theme.label}</span>
        </div>
    `).join('');
}

function renderSizeOptions() {
    const labels = { small: 'Small', medium: 'Medium', large: 'Large', huge: 'Huge' };
    $sizeOptions.innerHTML = Object.keys(FONT_SIZES).map(key =>
        `<button type="button" class="size-btn${key === selectedSize ? ' active' : ''}" data-size="${key}">${labels[key]}</button>`
    ).join('');
}

function getFormState() {
    return {
        text: $messageText.value.trim(),
        color: selectedColor,
        size: selectedSize,
        anim: $animationSelect.value
    };
}

function applyState(state) {
    $messageText.value = state.text || '';
    selectedColor = state.color || 'blue';
    selectedSize = state.size || 'huge';
    $animationSelect.value = state.anim || 'none';
    renderColorSwatches();
    renderSizeOptions();
    updatePreview();
}

function updatePreview() {
    const { text, color, size } = getFormState();
    const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;

    $previewScreen.style.backgroundColor = theme.bg;
    $previewScreen.style.color = theme.text;
    $previewScreen.style.fontSize = PREVIEW_FONT_SIZES[size] || PREVIEW_FONT_SIZES.huge;
    $previewScreen.textContent = text || 'Your message preview…';
}

function buildBroadcastUrl(state) {
    const params = new URLSearchParams({
        text: state.text,
        color: state.color,
        size: state.size,
        anim: state.anim
    });
    const base = new URL('message-broadcast.html', window.location.href);
    base.search = params.toString();
    return base.href;
}

function saveToRecent(state) {
    let recent = [];
    try {
        recent = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
    } catch {
        recent = [];
    }

    recent = recent.filter(item =>
        !(item.text === state.text && item.color === state.color &&
          item.size === state.size && item.anim === state.anim)
    );

    recent.unshift({ ...state, sentAt: Date.now() });
    recent = recent.slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    renderRecentMessages();
}

function renderRecentMessages() {
    let recent = [];
    try {
        recent = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
    } catch {
        recent = [];
    }

    if (recent.length === 0) {
        $recentContainer.innerHTML = '<span class="recent-empty">No recent messages yet</span>';
        return;
    }

    $recentContainer.innerHTML = recent.map((item, i) => {
        const label = item.text.length > 30 ? item.text.slice(0, 30) + '…' : item.text;
        return `<button type="button" class="recent-btn" data-recent="${i}" title="${item.text.replace(/"/g, '&quot;')}">${label}</button>`;
    }).join('');
}

function generateLink() {
    const state = getFormState();
    if (!state.text) {
        $messageText.focus();
        return;
    }

    const url = buildBroadcastUrl(state);
    $broadcastLink.value = url;
    saveToRecent(state);
}

async function copyLink() {
    const link = $broadcastLink.value;
    if (!link) {
        generateLink();
        if (!$broadcastLink.value) return;
    }

    try {
        await navigator.clipboard.writeText($broadcastLink.value);
        $copyFeedback.classList.add('visible');
        setTimeout(() => $copyFeedback.classList.remove('visible'), 2000);
    } catch {
        $broadcastLink.select();
        document.execCommand('copy');
        $copyFeedback.classList.add('visible');
        setTimeout(() => $copyFeedback.classList.remove('visible'), 2000);
    }
}

function bindEvents() {
    $messageText.addEventListener('input', updatePreview);

    $presetContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-preset]');
        if (!btn) return;
        const preset = PRESET_MESSAGES[Number(btn.dataset.preset)];
        applyState({ text: preset.text, color: preset.color, size: selectedSize, anim: $animationSelect.value });
    });

    $colorSwatches.addEventListener('click', (e) => {
        const swatch = e.target.closest('[data-color]');
        if (!swatch) return;
        selectedColor = swatch.dataset.color;
        renderColorSwatches();
        updatePreview();
    });

    $sizeOptions.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-size]');
        if (!btn) return;
        selectedSize = btn.dataset.size;
        renderSizeOptions();
        updatePreview();
    });

    $animationSelect.addEventListener('change', updatePreview);

    $generateBtn.addEventListener('click', generateLink);
    $copyBtn.addEventListener('click', copyLink);

    $recentContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-recent]');
        if (!btn) return;
        let recent = [];
        try {
            recent = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
        } catch {
            return;
        }
        const item = recent[Number(btn.dataset.recent)];
        if (item) {
            applyState(item);
            generateLink();
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
