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

function tableToTsv(table) {
    return table.map(row => row.map(value => {
        const text = String(value ?? '');
        return /["\t\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join('\t')).join('\n');
}

function buildBroadcastPlainText(text, table) {
    const parts = [];
    if (text) parts.push(text);
    if (table.length) parts.push(tableToTsv(table));
    return parts.join('\n\n');
}

function renderBroadcastTable(container, rows, copyCells, feedback) {
    container.replaceChildren();
    if (!rows.length) {
        container.hidden = true;
        container.removeAttribute('tabindex');
        container.removeAttribute('aria-label');
        return;
    }

    const table = document.createElement('table');
    table.className = 'broadcast-table';
    const tbody = document.createElement('tbody');

    rows.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            if (copyCells) {
                td.tabIndex = 0;
                td.setAttribute('role', 'button');
                td.setAttribute('aria-label', value ? `Copy ${value}` : 'Copy blank cell');
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
    container.hidden = false;
    container.tabIndex = 0;
    container.setAttribute('aria-label', 'Broadcast table');
    container.classList.toggle('cells-copyable', copyCells);

    if (!copyCells) return;
    const copyCell = async cell => {
        await writeClipboardText(cell.textContent || '');
        cell.classList.add('copied');
        showCopyFeedback(feedback, 'Cell copied!');
        setTimeout(() => cell.classList.remove('copied'), 900);
    };
    container.addEventListener('click', event => {
        const cell = event.target.closest('td');
        if (cell) void copyCell(cell);
    });
    container.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const cell = event.target.closest('td');
        if (!cell) return;
        event.preventDefault();
        void copyCell(cell);
    });
}

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

function resolveBroadcastBgImage(params, decodedBgUrl) {
    if (decodedBgUrl) return decodedBgUrl;

    const bgUrlParam = params.get('bgUrl');
    if (bgUrlParam) return bgUrlParam;

    const bgLegacy = params.get('bg');
    if (bgLegacy) return `data:image/jpeg;base64,${bgLegacy}`;

    return null;
}

async function init() {
    const params = new URLSearchParams(window.location.search);
    const decoded = await BroadcastPayload.decodeFromSearchParams(params);
    const text = decoded && decoded.text;
    const color = (decoded && decoded.color) || 'blue';
    const size = (decoded && decoded.size) || 'huge';
    const anim = (decoded && decoded.anim) || 'none';
    const showCopy = Boolean(decoded && decoded.copy);
    const copyCells = Boolean(decoded && decoded.copyCells);
    const table = decoded && Array.isArray(decoded.table) ? decoded.table : [];

    const $screen = document.getElementById('broadcast-screen');
    const $bg = document.getElementById('broadcast-bg');
    const $overlay = document.getElementById('broadcast-overlay');
    const $content = document.getElementById('broadcast-content');
    const $text = document.getElementById('broadcast-text');
    const $tableWrap = document.getElementById('broadcast-table-wrap');
    const $copyBtn = document.getElementById('broadcast-copy-btn');
    const $copyFeedback = document.getElementById('broadcast-copy-feedback');

    if (!text && !table.length) {
        $screen.classList.add('placeholder');
        $text.textContent = PLACEHOLDER_TEXT;
        return;
    }

    broadcastText = buildBroadcastPlainText(text || '', table);

    const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;
    const bgImage = resolveBroadcastBgImage(params, decoded && decoded.bgUrl);
    applyBackgroundLayers($bg, $overlay, $screen, bgImage, theme.bg);
    $screen.classList.toggle('has-bg-image', Boolean(bgImage));
    $screen.classList.toggle('has-table', table.length > 0);
    $screen.style.color = theme.text;
    if (text) {
        $text.hidden = false;
        renderTextWithLinks($text, text);
    } else {
        $text.hidden = true;
    }
    renderBroadcastTable($tableWrap, table, copyCells, $copyFeedback);
    $content.classList.toggle('has-caption', Boolean(text && table.length));

    if (anim && anim !== 'none') {
        $screen.classList.add(`anim-${anim}`);
    }

    if (showCopy) {
        $copyBtn.hidden = false;
        $copyBtn.addEventListener('click', () => copyBroadcastText($copyBtn, $copyFeedback));
    }

    const allowOverflow = table.length > 0;
    fitContentToViewport($content, FONT_SIZES[size] || FONT_SIZES.huge, { allowOverflow });
    window.addEventListener('resize', () =>
        fitContentToViewport($content, FONT_SIZES[size] || FONT_SIZES.huge, { allowOverflow })
    );
}

async function copyBroadcastText($btn, $feedback) {
    if (!broadcastText) return;

    await writeClipboardText(broadcastText);
    showCopyFeedback($feedback, 'Copied!');
    $btn.classList.add('copied');
    setTimeout(() => {
        $btn.classList.remove('copied');
    }, 2000);
}

async function writeClipboardText(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

let feedbackTimer = null;
function showCopyFeedback(feedback, message) {
    feedback.textContent = message;
    feedback.hidden = false;
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
        feedback.hidden = true;
    }, 1600);
}

function fitContentToViewport(el, baseVw, options = {}) {
    const screen = document.getElementById('broadcast-screen');
    el.style.fontSize = baseVw + 'vw';
    if (options.allowOverflow) return;

    const padding = parseFloat(getComputedStyle(screen).paddingLeft) * 2;
    const maxWidth = screen.clientWidth - padding;
    const maxHeight = screen.clientHeight - padding;

    let vw = baseVw;
    const minVw = 2;

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
