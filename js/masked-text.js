// Shared message rendering: linkify plain text and mask -password- markers.
const MaskedText = (() => {
    const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
    const BEFORE_BOUNDARY = /[\s([{"':=¿¡«“‘]/;
    const AFTER_BOUNDARY = /[\s.,;:!?)\]}"'¿¡»”’]/;

    let copyHandler = null;

    function isBeforeBoundary(text, index) {
        if (index <= 0) return true;
        return BEFORE_BOUNDARY.test(text[index - 1]);
    }

    function isAfterBoundary(text, index) {
        if (index >= text.length) return true;
        return AFTER_BOUNDARY.test(text[index]);
    }

    // A password is text wrapped in one or more dashes: -secret- or -my-pass-.
    // The opening dash must start the text or follow a space or opening punctuation,
    // and the closing dash must end the text or precede a space or closing punctuation.
    // Hyphenated words (well-known, 9-10-year-olds) are left alone.
    function nextPassword(text, from) {
        for (let i = from; i < text.length; i++) {
            if (text[i] !== '-' || !isBeforeBoundary(text, i)) continue;

            let contentStart = i;
            while (contentStart < text.length && text[contentStart] === '-') contentStart++;
            if (contentStart === i) continue;

            for (let k = contentStart; k < text.length; k++) {
                if (text[k] === '\n') break;
                if (text[k] !== '-') continue;

                let end = k;
                while (end < text.length && text[end] === '-') end++;
                if (!isAfterBoundary(text, end)) {
                    k = end - 1;
                    continue;
                }

                const secret = text.slice(contentStart, k).trim();
                if (!secret) break;
                return { start: i, end, secret };
            }
        }
        return null;
    }

    function nextUrl(text, from) {
        const pattern = new RegExp(URL_PATTERN.source, 'gi');
        pattern.lastIndex = from;
        const match = pattern.exec(text);
        if (!match || match.index < from) return null;
        return { start: match.index, end: match.index + match[0].length, raw: match[0] };
    }

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

    function walk(text, linkify, emit) {
        let index = 0;
        while (index < text.length) {
            const password = nextPassword(text, index);
            const url = linkify ? nextUrl(text, index) : null;
            if (!password && !url) {
                emit({ type: 'text', value: text.slice(index) });
                break;
            }

            const usePassword = password && (!url || password.start < url.start);
            const next = usePassword ? password : url;
            if (next.start > index) emit({ type: 'text', value: text.slice(index, next.start) });
            emit(usePassword ? { type: 'password', secret: password.secret } : { type: 'url', raw: url.raw });
            index = next.end;
        }
    }

    function reveal(text) {
        if (!text) return '';
        let out = '';
        walk(text, true, segment => {
            if (segment.type === 'password') out += segment.secret;
            else if (segment.type === 'url') out += segment.raw;
            else out += segment.value;
        });
        return out;
    }

    function createPasswordButton(secret) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'masked-password';
        button.dataset.secret = secret;
        button.textContent = '••••••••';
        button.setAttribute('aria-label', 'Copy hidden password');
        button.title = 'Click to copy password';
        button.addEventListener('click', event => {
            event.stopPropagation();
            event.preventDefault();
            if (copyHandler) copyHandler(secret, button);
        });
        button.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
        });
        return button;
    }

    function render(el, text, options = {}) {
        el.replaceChildren();
        if (!text) return;

        const linkify = options.links !== false;
        walk(text, linkify, segment => {
            if (segment.type === 'text') {
                el.appendChild(document.createTextNode(segment.value));
                return;
            }
            if (segment.type === 'password') {
                el.appendChild(createPasswordButton(segment.secret));
                return;
            }

            const { hrefText, trailing } = splitUrlMatch(segment.raw);
            const safeHref = toSafeHref(hrefText);
            if (safeHref) {
                const link = document.createElement('a');
                link.href = safeHref;
                link.textContent = hrefText;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.className = 'broadcast-inline-link';
                el.appendChild(link);
            } else {
                el.appendChild(document.createTextNode(hrefText));
            }
            if (trailing) el.appendChild(document.createTextNode(trailing));
        });
    }

    function textFromElement(el) {
        let out = '';
        el.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                out += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.classList.contains('masked-password')) out += node.dataset.secret || '';
                else out += textFromElement(node);
            }
        });
        return out;
    }

    function setCopyHandler(handler) {
        copyHandler = handler;
    }

    return { reveal, render, textFromElement, setCopyHandler };
})();
