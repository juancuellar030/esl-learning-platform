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
    yellow: { bg: '#f7b801', text: '#1a1a1a', label: 'Attention' },
    purple: { bg: '#6a1b9a', text: '#ffffff', label: 'Neutral' },
    black: { bg: '#1a1a1a', text: '#ffffff', label: 'Serious' }
};

const FONT_SIZES = {
    small: 3,
    medium: 5,
    large: 7,
    huge: 9
};

const SIZE_LABELS = { small: 'S', medium: 'M', large: 'L', huge: 'XL' };
const SIZE_TITLES = { small: 'Small', medium: 'Medium', large: 'Large', huge: 'Huge' };

const RECENT_KEY = 'broadcastRecentMessages';
const RECENT_BG_KEY = 'broadcastRecentBgUrls';
const SETTINGS_KEY = 'broadcastComposerSettings';
const MAX_RECENT = 5;
const MAX_RECENT_BG = 6;
const BG_OVERLAY_OPACITY = 0.72;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

function splitUrlMatch(raw) {
    let hrefText = raw;
    let trailing = '';

    while (hrefText.length) {
        const last = hrefText.slice(-1);
        if ('. ,;:!?'.includes(last)) {
            trailing = last + trailing;
            hrefText = hrefText.slice(0, -1);
            continue;
        }
        if (last === ')' && (hrefText.match(/\(/g) || []).length < (hrefText.match(/\)/g) || []).length) {
            trailing = last + trailing;
            hrefText = hrefText.slice(0, -1);
            continue;
        }
        break;
    }

    return { hrefText, trailing };
}

function toSafeHref(detected) {
    const candidate = /^https?:\/\//i.test(detected) ? detected : `https://${detected}`;
    try {
        const url = new URL(candidate);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        return url.href;
    } catch {
        return null;
    }
}

function renderTextWithLinks(el, text) {
    el.textContent = '';
    if (!text) return;

    const pattern = new RegExp(URL_PATTERN.source, 'gi');
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            el.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        const { hrefText, trailing } = splitUrlMatch(match[0]);
        const safeHref = toSafeHref(hrefText);
        if (safeHref) {
            const a = document.createElement('a');
            a.href = safeHref;
            a.textContent = hrefText;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = 'broadcast-inline-link';
            el.appendChild(a);
        } else {
            el.appendChild(document.createTextNode(hrefText));
        }
        if (trailing) {
            el.appendChild(document.createTextNode(trailing));
        }
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        el.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
}

let selectedColor = 'blue';
let selectedSize = 'huge';
let backgroundImageUrl = null;
let backgroundPreviewUrl = null;
let backgroundFetchToken = 0;
let settings = { showCopyButton: false };

const $messageText = document.getElementById('message-text');
const $animationSelect = document.getElementById('animation-select');
const $previewScreen = document.getElementById('preview-screen');
const $previewBg = document.getElementById('preview-bg');
const $previewOverlay = document.getElementById('preview-overlay');
const $previewMessage = document.getElementById('preview-message');
const $previewCopyBtn = document.getElementById('preview-copy-btn');
const $previewBox = document.querySelector('.preview-box');
const $bgImageUrl = document.getElementById('bg-image-url');
const $bgUrlApply = document.getElementById('bg-url-apply');
const $bgImageRemove = document.getElementById('bg-image-remove');
const $bgUploadError = document.getElementById('bg-upload-error');
const $recentBgUrls = document.getElementById('recent-bg-urls');
const $recentBgList = document.getElementById('recent-bg-list');
const $broadcastLink = document.getElementById('broadcast-link');
const $copyFeedback = document.getElementById('copy-feedback');
const $presetContainer = document.getElementById('preset-buttons');
const $colorSwatches = document.getElementById('color-swatches');
const $sizeOptions = document.getElementById('size-options');
const $recentContainer = document.getElementById('recent-buttons');
const $generateBtn = document.getElementById('generate-link-btn');
const $copyBtn = document.getElementById('copy-link-btn');
const $showCopyBtnSetting = document.getElementById('setting-show-copy-btn');

const PREVIEW_ANIM_CLASSES = ['anim-pulse', 'anim-shake', 'anim-flash'];

function init() {
    loadSettings();
    renderPresets();
    renderColorSwatches();
    renderSizeOptions();
    renderRecentMessages();
    renderRecentBgUrls();
    bindEvents();
    updatePreview();

    if ($previewBox && window.ResizeObserver) {
        new ResizeObserver(() => fitPreviewText($previewMessage, selectedSize)).observe($previewBox);
    }
}

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        if (saved && typeof saved.showCopyButton === 'boolean') {
            settings.showCopyButton = saved.showCopyButton;
        }
    } catch {
        settings = { showCopyButton: false };
    }
    $showCopyBtnSetting.checked = settings.showCopyButton;
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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
    $sizeOptions.innerHTML = Object.keys(FONT_SIZES).map(key => {
        const isActive = key === selectedSize;
        return `<button type="button" class="size-btn${isActive ? ' active' : ''}" data-size="${key}" title="${SIZE_TITLES[key]}" aria-label="${SIZE_TITLES[key]}" aria-pressed="${isActive}">${SIZE_LABELS[key]}</button>`;
    }).join('');
}

function fitPreviewText(el, sizeKey) {
    const screen = $previewScreen;
    if (!screen || !el) return;

    const baseVw = FONT_SIZES[sizeKey] || FONT_SIZES.huge;
    const padding = parseFloat(getComputedStyle(screen).paddingLeft) * 2;
    const maxWidth = screen.clientWidth - padding;
    const maxHeight = screen.clientHeight - padding;

    let vw = baseVw;
    const minVw = 2;

    const setSize = (v) => {
        el.style.fontSize = (screen.clientWidth * v / 100) + 'px';
    };

    setSize(vw);

    let safety = 0;
    while (safety < 40 && (el.scrollWidth > maxWidth || el.scrollHeight > maxHeight) && vw > minVw) {
        vw -= 0.25;
        setSize(vw);
        safety++;
    }

    if (el.scrollWidth > maxWidth || el.scrollHeight > maxHeight) {
        const ratioW = maxWidth / el.scrollWidth;
        const ratioH = maxHeight / el.scrollHeight;
        const ratio = Math.min(ratioW, ratioH, 1);
        const currentPx = parseFloat(getComputedStyle(el).fontSize);
        el.style.fontSize = (currentPx * ratio * 0.95) + 'px';
    }
}

function extractImgurId(pathname) {
    const parts = pathname.split('/').filter(Boolean);
    if (!parts.length) return null;
    if (parts[0] === 'a' || parts[0] === 'gallery') return parts[1] || null;
    return parts[0];
}

function normalizeBackgroundUrl(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    let url;
    try {
        url = new URL(trimmed);
    } catch {
        throw new Error('Enter a valid image URL starting with https://');
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Image URL must use http:// or https://');
    }

    const host = url.hostname.toLowerCase();

    if (host === 'imgur.com' || host === 'www.imgur.com') {
        const id = extractImgurId(url.pathname);
        if (id) return `https://i.imgur.com/${id}`;
        throw new Error('Use an Imgur image link or right-click the image and choose “Copy image address”.');
    }

    if (host === 'i.imgur.com') {
        const path = url.pathname.replace(/^\//, '').split('?')[0];
        if (path) return `https://i.imgur.com/${path}`;
    }

    if (host === 'drive.google.com' || host === 'docs.google.com') {
        const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
        if (fileMatch) {
            return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`;
        }
        const idParam = url.searchParams.get('id');
        if (idParam) {
            return `https://drive.google.com/uc?export=view&id=${idParam}`;
        }
    }

    return url.href;
}

function revokeBackgroundPreviewUrl() {
    if (backgroundPreviewUrl && backgroundPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(backgroundPreviewUrl);
    }
    backgroundPreviewUrl = null;
}

async function fetchBackgroundPreviewUrl(imageUrl) {
    const response = await fetch(imageUrl, { referrerPolicy: 'no-referrer', mode: 'cors' });
    if (!response.ok) {
        throw new Error(`Image request blocked (${response.status}). Try Google Drive or re-upload to Imgur.`);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
}

function setBackgroundImageElement(bgEl, displayUrl) {
    bgEl.referrerPolicy = 'no-referrer';
    if (bgEl.dataset.displaySrc !== displayUrl) {
        bgEl.dataset.displaySrc = displayUrl;
        bgEl.src = displayUrl;
    }
    bgEl.hidden = false;
}

function clearBackgroundImageElement(bgEl) {
    bgEl.removeAttribute('src');
    delete bgEl.dataset.displaySrc;
    bgEl.hidden = true;
}

function getFormState() {
    return {
        text: $messageText.value.trim(),
        color: selectedColor,
        size: selectedSize,
        anim: $animationSelect.value,
        bgUrl: backgroundImageUrl || null
    };
}

function resolveStoredBgUrl(state) {
    if (state.bgUrl) return state.bgUrl;
    if (state.bgImage && typeof state.bgImage === 'string' && /^https?:\/\//i.test(state.bgImage)) {
        return state.bgImage;
    }
    return null;
}

function applyState(state) {
    $messageText.value = state.text || '';
    selectedColor = state.color || 'blue';
    selectedSize = state.size || 'huge';
    $animationSelect.value = state.anim || 'none';
    backgroundImageUrl = resolveStoredBgUrl(state);
    $bgImageUrl.value = backgroundImageUrl || '';
    $bgImageRemove.hidden = !backgroundImageUrl;
    clearBgUploadError();
    renderColorSwatches();
    renderSizeOptions();
    if (backgroundImageUrl) {
        saveRecentBgUrl(backgroundImageUrl);
        refreshBackgroundPreview();
    } else {
        backgroundFetchToken++;
        revokeBackgroundPreviewUrl();
        updatePreview();
        renderRecentBgUrls();
    }
}

function applyBackgroundLayers(bgEl, overlayEl, screenEl, displayUrl, themeBg) {
    if (displayUrl) {
        setBackgroundImageElement(bgEl, displayUrl);
        overlayEl.style.backgroundColor = themeBg;
        overlayEl.style.opacity = BG_OVERLAY_OPACITY;
        overlayEl.hidden = false;
        screenEl.style.backgroundColor = 'transparent';
    } else {
        clearBackgroundImageElement(bgEl);
        overlayEl.hidden = true;
        screenEl.style.backgroundColor = themeBg;
    }
}

async function refreshBackgroundPreview() {
    const token = ++backgroundFetchToken;
    revokeBackgroundPreviewUrl();

    if (!backgroundImageUrl) {
        updatePreview();
        return;
    }

    try {
        const displayUrl = await fetchBackgroundPreviewUrl(backgroundImageUrl);
        if (token !== backgroundFetchToken) {
            URL.revokeObjectURL(displayUrl);
            return;
        }
        backgroundPreviewUrl = displayUrl;
        clearBgUploadError();
        updatePreview();
    } catch (err) {
        if (token !== backgroundFetchToken) return;
        backgroundPreviewUrl = backgroundImageUrl;
        showBgUploadError(
            `${err.message} Showing direct link — if preview is blank, use Google Drive instead.`
        );
        updatePreview();
    }
}

function clearBgUploadError() {
    $bgUploadError.hidden = true;
    $bgUploadError.textContent = '';
}

function showBgUploadError(message) {
    $bgUploadError.textContent = message;
    $bgUploadError.hidden = false;
}

function removeBackgroundImage() {
    backgroundFetchToken++;
    backgroundImageUrl = null;
    revokeBackgroundPreviewUrl();
    $bgImageUrl.value = '';
    $bgImageRemove.hidden = true;
    clearBgUploadError();
    updatePreview();
    renderRecentBgUrls();
    if ($broadcastLink.value) void generateLink();
}

async function applyBackgroundUrl() {
    const raw = $bgImageUrl.value.trim();
    if (!raw) {
        removeBackgroundImage();
        return;
    }

    clearBgUploadError();

    try {
        const normalized = normalizeBackgroundUrl(raw);
        backgroundImageUrl = normalized;
        $bgImageUrl.value = normalized;
        $bgImageRemove.hidden = false;
        saveRecentBgUrl(normalized);
        await refreshBackgroundPreview();
        if ($broadcastLink.value) await generateLink();
    } catch (err) {
        backgroundFetchToken++;
        backgroundImageUrl = null;
        revokeBackgroundPreviewUrl();
        $bgImageRemove.hidden = true;
        showBgUploadError(err.message || 'Could not use that image link.');
        updatePreview();
    }
}

function updatePreview() {
    const { text, color, size, anim } = getFormState();
    const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;

    applyBackgroundLayers(
        $previewBg,
        $previewOverlay,
        $previewScreen,
        backgroundPreviewUrl || backgroundImageUrl,
        theme.bg
    );
    $previewScreen.classList.toggle('has-bg-image', Boolean(backgroundImageUrl));
    $previewScreen.style.color = theme.text;
    if (text) {
        renderTextWithLinks($previewMessage, text);
    } else {
        $previewMessage.textContent = 'Your message preview…';
    }
    $previewCopyBtn.hidden = !(settings.showCopyButton && text);
    fitPreviewText($previewMessage, size);

    $previewScreen.classList.remove(...PREVIEW_ANIM_CLASSES);
    void $previewScreen.offsetWidth;
    if (anim && anim !== 'none') {
        $previewScreen.classList.add(`anim-${anim}`);
    }
}

async function buildBroadcastUrl(state) {
    const base = new URL('message-broadcast.html', window.location.href);
    base.search = await BroadcastPayload.encodeToSearch(state, settings.showCopyButton);
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
          item.size === state.size && item.anim === state.anim &&
          (item.bgUrl || resolveStoredBgUrl(item) || null) === (state.bgUrl || null))
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
        const safeTitle = item.text.replace(/"/g, '&quot;');
        return `
            <div class="recent-item">
                <button type="button" class="recent-btn" data-recent="${i}" title="${safeTitle}">
                    <span class="recent-btn-text">${label}</span>
                </button>
                <button type="button" class="recent-btn-delete" data-delete-recent="${i}" aria-label="Remove message" title="Remove">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>`;
    }).join('');
}

function deleteRecentMessage(index) {
    let recent = [];
    try {
        recent = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
    } catch {
        return;
    }

    if (index < 0 || index >= recent.length) return;
    recent.splice(index, 1);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    renderRecentMessages();
}

function readRecentBgUrls() {
    const raw = localStorage.getItem(RECENT_BG_KEY);
    if (raw === null) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(url => typeof url === 'string' && /^https?:\/\//i.test(url));
    } catch {
        return [];
    }
}

function backfillRecentBgUrlsFromMessages() {
    let messages = [];
    try {
        messages = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
    } catch {
        return [];
    }

    const urls = [];
    for (const item of messages) {
        const url = resolveStoredBgUrl(item);
        if (url && !urls.includes(url)) urls.push(url);
    }
    return urls.slice(0, MAX_RECENT_BG);
}

function getRecentBgUrls() {
    const stored = readRecentBgUrls();
    if (stored) return stored;

    const backfilled = backfillRecentBgUrlsFromMessages();
    if (backfilled.length) {
        localStorage.setItem(RECENT_BG_KEY, JSON.stringify(backfilled));
    }
    return backfilled;
}

function bgUrlLabel(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');
        const file = parsed.pathname.split('/').filter(Boolean).pop() || '';
        if (host.includes('imgur')) return file || 'Imgur';
        if (host.includes('google')) return 'Google Drive';
        return file ? `${host}/${file}` : host;
    } catch {
        return url;
    }
}

function saveRecentBgUrl(url) {
    if (!url) return;
    let recent = getRecentBgUrls();
    recent = recent.filter(item => item !== url);
    recent.unshift(url);
    recent = recent.slice(0, MAX_RECENT_BG);
    localStorage.setItem(RECENT_BG_KEY, JSON.stringify(recent));
    renderRecentBgUrls();
}

function deleteRecentBgUrl(index) {
    const recent = getRecentBgUrls();
    if (index < 0 || index >= recent.length) return;
    recent.splice(index, 1);
    localStorage.setItem(RECENT_BG_KEY, JSON.stringify(recent));
    renderRecentBgUrls();
}

function renderRecentBgUrls() {
    const recent = getRecentBgUrls();
    $recentBgUrls.hidden = recent.length === 0;
    $recentBgList.replaceChildren();

    recent.forEach((url, i) => {
        const item = document.createElement('div');
        item.className = 'recent-bg-item';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'recent-bg-thumb' + (url === backgroundImageUrl ? ' active' : '');
        btn.dataset.recentBg = String(i);
        btn.title = url;
        btn.setAttribute('aria-label', `Use background ${bgUrlLabel(url)}`);

        const img = document.createElement('img');
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.src = url;
        img.addEventListener('error', () => {
            img.remove();
            btn.classList.add('broken');
        });
        btn.appendChild(img);

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'recent-bg-delete';
        del.dataset.deleteRecentBg = String(i);
        del.setAttribute('aria-label', 'Remove background');
        del.title = 'Remove';
        del.innerHTML = '<i class="fa-solid fa-xmark"></i>';

        item.appendChild(btn);
        item.appendChild(del);
        $recentBgList.appendChild(item);
    });
}

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-xmark';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    document.body.appendChild(toast);
    void toast.offsetWidth;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 2800);
}

async function generateLink() {
    const state = getFormState();
    if (!state.text) {
        $messageText.focus();
        return false;
    }

    const url = await buildBroadcastUrl(state);
    $broadcastLink.value = url;
    saveToRecent(state);
    return true;
}

async function copyLink() {
    const link = $broadcastLink.value;
    if (!link) {
        await generateLink();
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

    $bgUrlApply.addEventListener('click', applyBackgroundUrl);
    $bgImageUrl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyBackgroundUrl();
        }
    });
    $bgImageRemove.addEventListener('click', removeBackgroundImage);

    $recentBgList.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('[data-delete-recent-bg]');
        if (deleteBtn) {
            e.stopPropagation();
            deleteRecentBgUrl(Number(deleteBtn.dataset.deleteRecentBg));
            return;
        }

        const btn = e.target.closest('[data-recent-bg]');
        if (!btn) return;
        const url = getRecentBgUrls()[Number(btn.dataset.recentBg)];
        if (!url) return;
        $bgImageUrl.value = url;
        applyBackgroundUrl();
    });

    $generateBtn.addEventListener('click', async () => {
        if (await generateLink()) {
            showToast('Broadcast link generated', 'success');
        }
    });
    $copyBtn.addEventListener('click', copyLink);

    $recentContainer.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('[data-delete-recent]');
        if (deleteBtn) {
            e.stopPropagation();
            deleteRecentMessage(Number(deleteBtn.dataset.deleteRecent));
            return;
        }

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
            void generateLink();
        }
    });

    $showCopyBtnSetting.addEventListener('change', () => {
        settings.showCopyButton = $showCopyBtnSetting.checked;
        saveSettings();
        updatePreview();
        if ($broadcastLink.value) void generateLink();
    });

    $previewCopyBtn.addEventListener('click', async () => {
        const text = $messageText.value.trim();
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            /* preview-only fallback */
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
