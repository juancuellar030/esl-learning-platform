// Broadcast Message Display — reads URL params and renders full-screen message

const COLOR_THEMES = {
    blue: { bg: '#1a4fa0', text: '#ffffff' },
    red: { bg: '#c62828', text: '#ffffff' },
    green: { bg: '#2e7d32', text: '#ffffff' },
    yellow: { bg: '#f7b801', text: '#1a1a1a' },
    purple: { bg: '#6a1b9a', text: '#ffffff' },
    black: { bg: '#1a1a1a', text: '#ffffff' }
};

const FONT_SIZES = {
    small: 3,
    medium: 5,
    large: 7,
    huge: 9
};

const PLACEHOLDER_TEXT = 'Waiting for message…';
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

let broadcastText = '';

function applyBackgroundLayers(bgEl, overlayEl, screenEl, imageUrl, themeBg) {
    if (imageUrl) {
        bgEl.referrerPolicy = 'no-referrer';
        if (bgEl.dataset.src !== imageUrl) {
            bgEl.dataset.src = imageUrl;
            bgEl.src = imageUrl;
        }
        bgEl.hidden = false;
        overlayEl.style.backgroundColor = themeBg;
        overlayEl.style.opacity = BG_OVERLAY_OPACITY;
        overlayEl.hidden = false;
        screenEl.style.backgroundColor = 'transparent';
    } else {
        bgEl.removeAttribute('src');
        delete bgEl.dataset.src;
        bgEl.hidden = true;
        overlayEl.hidden = true;
        screenEl.style.backgroundColor = themeBg;
    }
}

function resolveBroadcastBgImage(params) {
    const bgUrlParam = params.get('bgUrl');
    if (bgUrlParam) return bgUrlParam;

    const bgLegacy = params.get('bg');
    if (bgLegacy) return `data:image/jpeg;base64,${bgLegacy}`;

    return null;
}

function init() {
    const params = new URLSearchParams(window.location.search);
    const text = params.get('text');
    const color = params.get('color') || 'blue';
    const size = params.get('size') || 'huge';
    const anim = params.get('anim') || 'none';
    const showCopy = params.get('copy') === '1';

    const $screen = document.getElementById('broadcast-screen');
    const $bg = document.getElementById('broadcast-bg');
    const $overlay = document.getElementById('broadcast-overlay');
    const $text = document.getElementById('broadcast-text');
    const $copyBtn = document.getElementById('broadcast-copy-btn');
    const $copyFeedback = document.getElementById('broadcast-copy-feedback');

    if (!text) {
        $screen.classList.add('placeholder');
        $text.textContent = PLACEHOLDER_TEXT;
        return;
    }

    broadcastText = text;

    const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;
    const bgImage = resolveBroadcastBgImage(params);
    applyBackgroundLayers($bg, $overlay, $screen, bgImage, theme.bg);
    $screen.classList.toggle('has-bg-image', Boolean(bgImage));
    $screen.style.color = theme.text;
    renderTextWithLinks($text, text);

    if (anim && anim !== 'none') {
        $screen.classList.add(`anim-${anim}`);
    }

    if (showCopy) {
        $copyBtn.hidden = false;
        $copyBtn.addEventListener('click', () => copyBroadcastText($copyBtn, $copyFeedback));
    }

    fitTextToViewport($text, FONT_SIZES[size] || FONT_SIZES.huge);
    window.addEventListener('resize', () => fitTextToViewport($text, FONT_SIZES[size] || FONT_SIZES.huge));
}

async function copyBroadcastText($btn, $feedback) {
    if (!broadcastText) return;

    try {
        await navigator.clipboard.writeText(broadcastText);
    } catch {
        const textarea = document.createElement('textarea');
        textarea.value = broadcastText;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    $feedback.hidden = false;
    $btn.classList.add('copied');
    setTimeout(() => {
        $feedback.hidden = true;
        $btn.classList.remove('copied');
    }, 2000);
}

function fitTextToViewport(el, baseVw) {
    const screen = document.getElementById('broadcast-screen');
    const padding = parseFloat(getComputedStyle(screen).paddingLeft) * 2;
    const maxWidth = screen.clientWidth - padding;
    const maxHeight = screen.clientHeight - padding;

    let vw = baseVw;
    const minVw = 2;

    el.style.fontSize = vw + 'vw';

    let safety = 0;
    while (safety < 40 && (el.scrollWidth > maxWidth || el.scrollHeight > maxHeight) && vw > minVw) {
        vw -= 0.25;
        el.style.fontSize = vw + 'vw';
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

document.addEventListener('DOMContentLoaded', init);
