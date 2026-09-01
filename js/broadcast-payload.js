// Compact / compressed broadcast URL payload (shared by composer + display)
const BroadcastPayload = (() => {
    const PARAM = 'd';

    function normalizeTable(table) {
        if (!Array.isArray(table)) return [];
        const rows = table
            .filter(Array.isArray)
            .map(row => row.map(cell => String(cell ?? '')));
        if (!rows.length) return [];

        const width = Math.max(...rows.map(row => row.length));
        if (width < 2) return [];
        return rows.map(row => Array.from({ length: width }, (_, i) => row[i] || ''));
    }

    function compactFromState(state, showCopy, copyCells) {
        const payload = {};
        if (state.text) payload.t = state.text;
        const table = normalizeTable(state.table);
        if (table.length) payload.r = table;
        if (state.color && state.color !== 'blue') payload.c = state.color;
        if (state.size && state.size !== 'huge') payload.s = state.size;
        if (state.anim && state.anim !== 'none') payload.a = state.anim;
        if (showCopy) payload.k = 1;
        if (copyCells && table.length) payload.e = 1;
        if (state.bgUrl) payload.b = state.bgUrl;
        return payload;
    }

    function stateFromCompact(payload) {
        if (!payload || typeof payload !== 'object') return null;
        const text = typeof payload.t === 'string' ? payload.t : '';
        const table = normalizeTable(payload.r);
        if (!text && !table.length) return null;
        return {
            text,
            table,
            color: payload.c || 'blue',
            size: payload.s || 'huge',
            anim: payload.a || 'none',
            copy: payload.k === 1,
            copyCells: payload.e === 1 && table.length > 0,
            bgUrl: typeof payload.b === 'string' && payload.b ? payload.b : null
        };
    }

    function bytesToBase64Url(bytes) {
        const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        let bin = '';
        for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function base64UrlToBytes(str) {
        const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
        const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    function canDeflate() {
        return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
    }

    async function deflateRaw(bytes) {
        const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    async function inflateRaw(bytes) {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    function packJson(payload) {
        return new TextEncoder().encode(JSON.stringify(payload));
    }

    function unpackJson(bytes) {
        return JSON.parse(new TextDecoder().decode(bytes));
    }

    function buildLegacySearch(state, showCopy, copyCells) {
        const params = new URLSearchParams();
        if (state.text) params.set('text', state.text);
        const table = normalizeTable(state.table);
        if (table.length) params.set('table', JSON.stringify(table));
        params.set('color', state.color);
        params.set('size', state.size);
        params.set('anim', state.anim);
        if (showCopy) params.set('copy', '1');
        if (copyCells && table.length) params.set('copyCells', '1');
        if (state.bgUrl) params.set('bgUrl', state.bgUrl);
        return params.toString();
    }

    async function encodeToSearch(state, showCopy, copyCells = false) {
        const payload = compactFromState(state, showCopy, copyCells);
        const jsonBytes = packJson(payload);
        let token = '0' + bytesToBase64Url(jsonBytes);

        if (canDeflate()) {
            try {
                const deflated = await deflateRaw(jsonBytes);
                const deflateToken = '1' + bytesToBase64Url(deflated);
                if (deflateToken.length < token.length) token = deflateToken;
            } catch {
                /* keep uncompressed compact JSON */
            }
        }

        const compact = new URLSearchParams();
        compact.set(PARAM, token);
        const compactSearch = compact.toString();
        const legacySearch = buildLegacySearch(state, showCopy, copyCells);
        return compactSearch.length <= legacySearch.length ? compactSearch : legacySearch;
    }

    async function decodeFromSearchParams(params) {
        const token = params.get(PARAM);
        if (token && token.length > 1) {
            const kind = token.charAt(0);
            const body = token.slice(1);
            try {
                let bytes = base64UrlToBytes(body);
                if (kind === '1') bytes = await inflateRaw(bytes);
                else if (kind !== '0') return null;
                return stateFromCompact(unpackJson(bytes));
            } catch {
                return null;
            }
        }

        const text = params.get('text') || '';
        let table = [];
        const tableParam = params.get('table');
        if (tableParam) {
            try {
                table = normalizeTable(JSON.parse(tableParam));
            } catch {
                table = [];
            }
        }
        if (!text && !table.length) return null;

        return {
            text,
            table,
            color: params.get('color') || 'blue',
            size: params.get('size') || 'huge',
            anim: params.get('anim') || 'none',
            copy: params.get('copy') === '1',
            copyCells: params.get('copyCells') === '1' && table.length > 0,
            bgUrl: params.get('bgUrl') || null
        };
    }

    return { encodeToSearch, decodeFromSearchParams };
})();
