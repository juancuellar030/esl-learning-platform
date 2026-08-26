// Compact / compressed broadcast URL payload (shared by composer + display)
const BroadcastPayload = (() => {
    const PARAM = 'd';

    function compactFromState(state, showCopy) {
        const payload = { t: state.text };
        if (state.color && state.color !== 'blue') payload.c = state.color;
        if (state.size && state.size !== 'huge') payload.s = state.size;
        if (state.anim && state.anim !== 'none') payload.a = state.anim;
        if (showCopy) payload.k = 1;
        if (state.bgUrl) payload.b = state.bgUrl;
        return payload;
    }

    function stateFromCompact(payload) {
        if (!payload || typeof payload.t !== 'string' || !payload.t) return null;
        return {
            text: payload.t,
            color: payload.c || 'blue',
            size: payload.s || 'huge',
            anim: payload.a || 'none',
            copy: payload.k === 1,
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

    function buildLegacySearch(state, showCopy) {
        const params = new URLSearchParams({
            text: state.text,
            color: state.color,
            size: state.size,
            anim: state.anim
        });
        if (showCopy) params.set('copy', '1');
        if (state.bgUrl) params.set('bgUrl', state.bgUrl);
        return params.toString();
    }

    async function encodeToSearch(state, showCopy) {
        const payload = compactFromState(state, showCopy);
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
        const legacySearch = buildLegacySearch(state, showCopy);
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

        const text = params.get('text');
        if (!text) return null;

        return {
            text,
            color: params.get('color') || 'blue',
            size: params.get('size') || 'huge',
            anim: params.get('anim') || 'none',
            copy: params.get('copy') === '1',
            bgUrl: params.get('bgUrl') || null
        };
    }

    return { encodeToSearch, decodeFromSearchParams };
})();
