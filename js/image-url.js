/**
 * Shared image URL helpers (Imgur page links, i.imgur.com, Google Drive).
 * Used by message-composer.js and test-builder.js.
 */
const ImageUrl = (function () {
    'use strict';

    function extractImgurId(pathname) {
        const parts = pathname.split('/').filter(Boolean);
        if (!parts.length) return null;
        if (parts[0] === 'a' || parts[0] === 'gallery') return parts[1] || null;
        return parts[0];
    }

    function normalize(raw) {
        const trimmed = String(raw || '').trim();
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

    return { extractImgurId, normalize };
})();
