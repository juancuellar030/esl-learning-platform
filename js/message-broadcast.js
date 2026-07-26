// Broadcast Message Display — reads URL params and renders full-screen message

const COLOR_THEMES = {
    blue: { bg: '#1a4fa0', text: '#ffffff' },
    red: { bg: '#c62828', text: '#ffffff' },
    green: { bg: '#2e7d32', text: '#ffffff' },
    yellow: { bg: '#f7b801', text: '#1a1a1a' }
};

const FONT_SIZES = {
    small: 3,
    medium: 5,
    large: 7,
    huge: 9
};

const PLACEHOLDER_TEXT = 'Waiting for message…';

function init() {
    const params = new URLSearchParams(window.location.search);
    const text = params.get('text');
    const color = params.get('color') || 'blue';
    const size = params.get('size') || 'huge';
    const anim = params.get('anim') || 'none';

    const $screen = document.getElementById('broadcast-screen');
    const $text = document.getElementById('broadcast-text');

    if (!text) {
        $screen.classList.add('placeholder');
        $text.textContent = PLACEHOLDER_TEXT;
        return;
    }

    const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;
    $screen.style.backgroundColor = theme.bg;
    $screen.style.color = theme.text;
    $text.textContent = text;

    if (anim && anim !== 'none') {
        $screen.classList.add(`anim-${anim}`);
    }

    fitTextToViewport($text, FONT_SIZES[size] || FONT_SIZES.huge);
    window.addEventListener('resize', () => fitTextToViewport($text, FONT_SIZES[size] || FONT_SIZES.huge));
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
