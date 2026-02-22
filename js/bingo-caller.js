/* ============================================================
   BINGO CALLER — JS
   Interactive Caller Session for live classroom play.
   Audio: uploaded files preferred, SpeechSynthesis as fallback.
   ============================================================ */

(function () {
    'use strict';

    let _state = null;
    let calledItems = [];
    let calledSet = new Set();
    let randomCalledKeys = new Set(); // For the random picker cross-product logic

    // Audio stores
    const headerAudio = {}; // colIdx -> Audio
    const itemAudio = {}; // itemIdx -> Audio

    // Raw Blob stores for persistence
    const headerAudioBlobs = {}; // colIdx -> Blob
    const itemAudioBlobs = {}; // itemIdx -> Blob

    // ── Public API ─────────────────────────────────────────────
    function init(state) {
        _state = state;
        calledItems = [];
        calledSet.clear();
        randomCalledKeys.clear();
        Object.keys(headerAudio).forEach(k => delete headerAudio[k]);
        Object.keys(itemAudio).forEach(k => delete itemAudio[k]);
        Object.keys(headerAudioBlobs).forEach(k => delete headerAudioBlobs[k]);
        Object.keys(itemAudioBlobs).forEach(k => delete itemAudioBlobs[k]);

        renderHeaderRow();
        renderGrid();
        updateSidebar();
        renderAudioManager();
        renderRandomPicker();
        updateAudioBadge();
    }

    // ── Header letters ──────────────────────────────────────────
    function getHeaderLetters() {
        const gs = _state.gridSize;
        if (_state.headerMode === 'numbers') return Array.from({ length: gs }, (_, i) => String(i + 1));
        if (_state.headerMode === 'custom') {
            const s = _state.customHeader.toUpperCase().padEnd(gs, ' ').slice(0, gs);
            return [...s];
        }
        const defaults = ['B', 'I', 'N', 'G', 'O'];
        return Array.from({ length: gs }, (_, i) => defaults[i] || String.fromCharCode(65 + i));
    }

    // ── Render header row ────────────────────────────────────────
    function renderHeaderRow() {
        const container = document.getElementById('callerHeaderRow');
        if (!container) return;
        container.innerHTML = '';
        if (!_state.showHeader) { container.style.display = 'none'; return; }
        container.style.display = 'flex';
        const letters = getHeaderLetters();

        letters.forEach((letter, i) => {
            const cell = document.createElement('div');
            cell.className = 'caller-header-cell';
            cell.style.background = `linear-gradient(135deg, ${_state.colorHeaderBg}, ${lighten(_state.colorHeaderBg, 20)})`;
            cell.id = `header-cell-${i}`;
            cell.innerHTML = `
                <span class="header-letter">${letter}</span>
                <span class="header-audio-indicator" id="header-audio-ind-${i}"></span>
            `;
            cell.addEventListener('click', () => playHeaderAudio(i, letter));
            container.appendChild(cell);
        });
    }

    // ── Render master grid ────────────────────────────────────────
    function renderGrid() {
        const grid = document.getElementById('callerGrid');
        if (!grid) return;
        const gs = _state.gridSize;
        grid.style.gridTemplateColumns = `repeat(${gs}, 1fr)`;
        grid.innerHTML = '';

        const pool = _state.itemPool;
        const headers = getHeaderLetters();

        pool.forEach((item, itemIdx) => {
            const colIdx = itemIdx % gs;
            const colLetter = headers[colIdx] || '';
            const cell = document.createElement('div');
            cell.className = 'caller-cell';
            cell.dataset.itemIndex = itemIdx;
            cell.id = `caller-cell-${itemIdx}`;

            if (_state.mode === 'word') {
                const word = typeof item === 'string' ? item : item.name;
                const span = document.createElement('span');
                span.className = 'cell-word';
                span.textContent = word;
                cell.appendChild(span);
            } else {
                const img = document.createElement('img');
                img.src = item.src;
                img.alt = item.name;
                cell.appendChild(img);
            }

            // Green dot indicator when audio is uploaded
            const dot = document.createElement('span');
            dot.className = 'cell-audio-dot';
            dot.id = `cell-audio-dot-${itemIdx}`;
            cell.appendChild(dot);

            cell.addEventListener('click', () => toggleCall(cell, itemIdx, item, colLetter, colIdx));
            grid.appendChild(cell);
        });
    }

    // ── Toggle call ───────────────────────────────────────────────
    function toggleCall(cell, itemIdx, item, colLetter, colIdx) {
        if (calledSet.has(itemIdx)) {
            calledSet.delete(itemIdx);
            calledItems = calledItems.filter(c => c.itemIdx !== itemIdx);
            cell.classList.remove('called');
            cell.querySelector('.stamp-overlay')?.remove();
        } else {
            calledSet.add(itemIdx);
            calledItems.push({ itemIdx, item, colLetter, colIdx });
            cell.classList.add('called');
            const stamp = document.createElement('div');
            stamp.className = 'stamp-overlay';
            stamp.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
            cell.appendChild(stamp);
            playItemAudio(itemIdx, item, colLetter);
        }
        updateSidebar();
    }

    // ── Audio playback ─────────────────────────────────────────────
    function playHeaderAudio(colIdx, letter) {
        if (headerAudio[colIdx]) {
            headerAudio[colIdx].currentTime = 0;
            headerAudio[colIdx].play().catch(() => { });
        } else {
            speak(`Under the letter ${letter}!`);
        }
    }

    function playItemAudio(itemIdx, item, colLetter) {
        const colIdx = itemIdx % _state.gridSize;
        if (itemAudio[itemIdx]) {
            // Chain: header audio first → then item audio
            if (_state.showHeader && headerAudio[colIdx]) {
                headerAudio[colIdx].currentTime = 0;
                headerAudio[colIdx].play().catch(() => { });
                setTimeout(() => {
                    itemAudio[itemIdx].currentTime = 0;
                    itemAudio[itemIdx].play().catch(() => { });
                }, 800);
            } else {
                itemAudio[itemIdx].currentTime = 0;
                itemAudio[itemIdx].play().catch(() => { });
            }
        } else {
            // Fallback: SpeechSynthesis
            if (_state.mode === 'word') {
                const word = typeof item === 'string' ? item : item.name;
                const phrase = _state.showHeader ? `${colLetter}… ${word}` : word;
                speak(phrase);
            } else {
                if (_state.showHeader) playHeaderAudio(colIdx, colLetter);
                playChime();
            }
        }
    }

    function speak(text) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = 'en-US';
        utt.rate = 0.88;
        utt.pitch = 1.0;
        // Prefer a natural-sounding voice over TTS defaults
        const pickVoice = () => {
            const voices = window.speechSynthesis.getVoices();
            return voices.find(v => v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Daniel') || v.name.includes('Google US')))
                || voices.find(v => v.lang === 'en-US')
                || null;
        };
        const voice = pickVoice();
        if (voice) utt.voice = voice;
        window.speechSynthesis.speak(utt);
    }

    function playChime() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            [880, 1100].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
                gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.18 + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.35);
                osc.start(ctx.currentTime + i * 0.18);
                osc.stop(ctx.currentTime + i * 0.18 + 0.4);
            });
        } catch (e) { }
    }

    // ── Audio Manager Modal ─────────────────────────────────────
    function renderAudioManager() {
        // Clean up old instances
        document.getElementById('audioManagerModal')?.remove();
        document.getElementById('audioManagerBtn')?.remove();

        const pool = _state.itemPool;
        const letters = getHeaderLetters();

        // ── Toolbar button ──
        const toolbar = document.querySelector('.caller-toolbar');
        if (toolbar) {
            const btn = document.createElement('button');
            btn.id = 'audioManagerBtn';
            btn.className = 'btn-secondary';
            btn.style.cssText = 'display:flex;align-items:center;gap:6px;position:relative;padding:10px 16px;border-radius:10px;cursor:pointer;font-family:inherit;font-weight:600;font-size:0.9rem;';
            btn.innerHTML = `
                <i class="fa-solid fa-headphones"></i> Audio
                <span id="amBadge" style="
                    position:absolute; top:-7px; right:-7px;
                    background:var(--cayenne-red); color:#fff; border-radius:50%;
                    width:20px; height:20px; font-size:0.7rem;
                    display:none; align-items:center; justify-content:center;
                    font-weight:700; border:2px solid #fff;
                ">0</span>
            `;
            btn.addEventListener('click', openAudioManager);
            const resetBtn = document.getElementById('resetCaller');
            if (resetBtn) toolbar.insertBefore(btn, resetBtn);
            else toolbar.appendChild(btn);
        }

        // ── Modal backdrop ──
        const modal = document.createElement('div');
        modal.id = 'audioManagerModal';
        modal.style.cssText = `
            display:none; position:fixed; inset:0; z-index:9999;
            background:rgba(0,0,0,0.55); backdrop-filter:blur(5px);
            justify-content:center; align-items:flex-start; padding-top:40px;
        `;

        modal.innerHTML = `
            <div style="
                background:#fff; border-radius:20px; width:92%; max-width:660px;
                max-height:80vh; overflow:hidden; display:flex; flex-direction:column;
                box-shadow:0 24px 70px rgba(0,0,0,0.35);
                animation:fadeInUp 0.3s ease both;
            ">
                <!-- Header -->
                <div style="
                    padding:22px 26px 18px;
                    background:linear-gradient(135deg, var(--indigo-velvet), var(--medium-slate-blue));
                    border-radius:20px 20px 0 0; color:#fff; flex-shrink:0;
                    display:flex; align-items:center; justify-content:space-between;
                ">
                    <div>
                        <h3 style="margin:0; font-size:1.15rem; display:flex; align-items:center; gap:10px;">
                            <i class="fa-solid fa-headphones"></i> Audio Manager
                        </h3>
                        <p style="margin:5px 0 0; font-size:0.82rem; opacity:0.8;">
                            Upload MP3/WAV clips for each item. Voice synthesis is used as a fallback when no file is uploaded.
                        </p>
                    </div>
                    <button id="amClose" style="
                        background:rgba(255,255,255,0.2); border:none; color:#fff;
                        width:36px; height:36px; border-radius:50%; cursor:pointer;
                        font-size:1.1rem; display:flex; align-items:center; justify-content:center;
                        flex-shrink:0; transition:background 0.2s;
                    "><i class="fa-solid fa-xmark"></i></button>
                </div>

                <!-- Body -->
                <div style="overflow-y:auto; flex:1;">
                    ${_state.showHeader ? `
                <div style="padding:18px 26px 0;">
                        <p style="margin:0 0 10px; font-size:0.78rem; font-weight:800; color:#888; text-transform:uppercase; letter-spacing:0.08em;">
                            <i class="fa-solid fa-table-columns" style="color:var(--medium-slate-blue); margin-right:5px;"></i>
                            Column Header Intros
                        </p>
                        <div id="amHeaderRow" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:9px; margin-bottom:4px;"></div>
                    </div>` : ''}
                    <div style="padding:18px 26px 24px;">
                        <p style="margin:0 0 10px; font-size:0.78rem; font-weight:800; color:#888; text-transform:uppercase; letter-spacing:0.08em;">
                            <i class="fa-solid fa-music" style="color:var(--amber-flame); margin-right:5px;"></i>
                            ${_state.mode === 'word' ? 'Word' : 'Image'} Audio Clips
                        </p>
                        <div id="amItemList" style="display:flex; flex-direction:column; gap:7px;"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) closeAudioManager(); });
        document.getElementById('amClose').addEventListener('click', closeAudioManager);

        // Build header chips
        if (_state.showHeader) {
            const amHeaderRow = document.getElementById('amHeaderRow');
            letters.forEach((letter, i) => {
                const chip = buildAudioChip(
                    `"${letter}"`, `header-${i}`,
                    (audio, blob) => {
                        headerAudio[i] = audio;
                        headerAudioBlobs[i] = blob;
                        updateHeaderDot(i);
                        updateAudioBadge();
                    }
                );
                amHeaderRow.appendChild(chip);
            });
        }

        // Build item rows
        const amItemList = document.getElementById('amItemList');
        pool.forEach((item, itemIdx) => {
            const colLetter = letters[itemIdx % _state.gridSize] || '';
            const label = _state.mode === 'word'
                ? (typeof item === 'string' ? item : item.name)
                : (item.name || `Image ${itemIdx + 1}`);
            const row = buildAudioChip(
                `${_state.showHeader ? `<span style="background:var(--indigo-velvet);color:#fff;border-radius:5px;padding:1px 7px;font-size:0.8rem;margin-right:6px;font-weight:800;">${colLetter}</span>` : ''}${escHtml(label)}`,
                `item-${itemIdx}`,
                (audio, blob) => {
                    itemAudio[itemIdx] = audio;
                    itemAudioBlobs[itemIdx] = blob;
                    updateCellDot(itemIdx);
                    updateAudioBadge();
                }
            );
            amItemList.appendChild(row);
        });
    }

    function buildAudioChip(labelHtml, id, onLoad) {
        const row = document.createElement('div');
        row.id = `am-row-${id}`;
        row.style.cssText = `
            display:flex; align-items:center; gap:10px; padding:10px 14px;
            border:2px solid #ebebeb; border-radius:12px; background:#fff;
            transition:border-color 0.25s ease, background 0.25s ease;
            min-width:0; overflow:hidden;
        `;

        row.innerHTML = `
            <div style="flex:1; font-size:0.9rem; font-weight:600; color:#333; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${labelHtml}</div>
            <span id="am-status-${id}" style="font-size:0.75rem;color:#bbb;font-weight:700;white-space:nowrap;flex-shrink:0;">No audio</span>
            <button id="am-play-${id}" style="
                display:none; background:none; border:none; cursor:pointer;
                color:var(--indigo-velvet); font-size:0.95rem; padding:4px 6px;
                border-radius:6px; transition:background 0.2s;
            " title="Preview"><i class="fa-solid fa-play"></i></button>
            <label style="
                background:var(--indigo-velvet); color:#fff; border-radius:9px;
                padding:7px 13px; font-size:0.8rem; font-weight:700; cursor:pointer;
                display:flex; align-items:center; gap:5px; white-space:nowrap;
                flex-shrink:0; transition:background 0.2s;
            ">
                <i class="fa-solid fa-upload"></i> Upload
                <input type="file" accept="audio/*" hidden>
            </label>
        `;

        let audioEl = null;
        const fileInput = row.querySelector('input[type="file"]');
        const statusEl = row.querySelector(`#am-status-${id}`);
        const playBtn = row.querySelector(`#am-play-${id}`);

        fileInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            audioEl = new Audio(URL.createObjectURL(file));
            onLoad(audioEl, file); // passing raw Blob

            // Visual feedback
            markChipUploaded(row, statusEl, playBtn, file.name);
        });

        playBtn.addEventListener('click', () => {
            if (audioEl) { audioEl.currentTime = 0; audioEl.play().catch(() => { }); }
        });

        // Add method to simulate upload for loading state
        row.loadExistingBlob = (blob) => {
            if (!blob) return;
            audioEl = new Audio(URL.createObjectURL(blob));
            onLoad(audioEl, blob);
            markChipUploaded(row, statusEl, playBtn, "Loaded audio");
        };

        return row;
    }

    function markChipUploaded(row, statusEl, playBtn, fileName) {
        row.style.borderColor = '#2e7d32';
        row.style.background = '#f0fff4';
        statusEl.style.color = '#2e7d32';
        const shortName = fileName.length > 22 ? fileName.slice(0, 20) + '…' : fileName;
        statusEl.textContent = '✓ ' + shortName;
        playBtn.style.display = 'inline-flex';
    }

    function openAudioManager() {
        const modal = document.getElementById('audioManagerModal');
        if (modal) { modal.style.display = 'flex'; }
    }

    function closeAudioManager() {
        const modal = document.getElementById('audioManagerModal');
        if (modal) modal.style.display = 'none';
    }

    function updateAudioBadge() {
        const badge = document.getElementById('amBadge');
        if (!badge) return;
        const total = Object.keys(itemAudio).length + Object.keys(headerAudio).length;
        badge.textContent = total;
        badge.style.display = total > 0 ? 'flex' : 'none';
    }

    function updateHeaderDot(colIdx) {
        const ind = document.getElementById(`header-audio-ind-${colIdx}`);
        if (!ind || !headerAudio[colIdx]) return;
        ind.style.cssText = `
            width:8px; height:8px; border-radius:50%; background:#4caf50;
            display:inline-block; position:absolute; top:5px; right:5px;
            box-shadow:0 0 0 2px rgba(255,255,255,0.6);
        `;
        ind.title = 'Custom audio loaded';
    }

    function updateCellDot(itemIdx) {
        const dot = document.getElementById(`cell-audio-dot-${itemIdx}`);
        if (!dot || !itemAudio[itemIdx]) return;
        dot.style.cssText = `
            position:absolute; top:5px; right:5px;
            width:8px; height:8px; border-radius:50%; background:#4caf50;
            box-shadow:0 0 0 2px rgba(255,255,255,0.8);
        `;
        dot.title = 'Custom audio loaded';
    }

    // ── Sidebar update ─────────────────────────────────────────────
    function updateSidebar() {
        const list = document.getElementById('calledList');
        const count = document.getElementById('calledCount');
        if (!list || !count) return;
        count.textContent = calledItems.length;
        list.innerHTML = '';
        [...calledItems].reverse().forEach((entry, i) => {
            const num = calledItems.length - i;
            const word = entry.item && (typeof entry.item === 'string' ? entry.item : entry.item.name);
            const li = document.createElement('li');
            li.className = 'called-list-item';
            li.style.animationDelay = `${i * 0.04}s`;
            li.innerHTML = `
                <span class="call-number">${num}</span>
                ${_state.showHeader ? `<span class="call-header">${entry.colLetter}</span>` : ''}
                <span>${escHtml(word || ('Image ' + (entry.itemIdx + 1)))}</span>
            `;
            list.appendChild(li);
        });
    }

    // ── Reset ──────────────────────────────────────────────────────
    function reset() {
        calledItems = [];
        calledSet.clear();
        randomCalledKeys.clear();
        document.querySelectorAll('.caller-cell.called').forEach(cell => {
            cell.classList.remove('called');
            cell.querySelector('.stamp-overlay')?.remove();
        });
        updateSidebar();
        window.speechSynthesis?.cancel();
    }

    // ── Helpers ────────────────────────────────────────────────────
    function lighten(hex, amount) {
        const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
        const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
        const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    function escHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── Random Picker ──────────────────────────────────────────────
    // ── Random Picker ──────────────────────────────────────────────
    // Cross-product deck: every item × every header = one combo

    function buildCallDeck() {
        const pool = _state.itemPool;
        const letters = getHeaderLetters();
        const deck = [];
        // If headers are shown, pair every item with every header
        if (_state.showHeader) {
            letters.forEach((letter, colIdx) => {
                pool.forEach((item, itemIdx) => {
                    const key = `${colIdx}:${itemIdx}`;
                    if (!randomCalledKeys.has(key)) {
                        deck.push({ colIdx, colLetter: letter, itemIdx, item });
                    }
                });
            });
        } else {
            // No headers — just pick uncalled items
            pool.forEach((item, itemIdx) => {
                const key = `0:${itemIdx}`;
                if (!randomCalledKeys.has(key)) {
                    deck.push({ colIdx: 0, colLetter: '', itemIdx, item });
                }
            });
        }
        return deck;
    }

    function renderRandomPicker() {
        // Clean up old instances
        document.getElementById('randomPickBtn')?.remove();
        document.getElementById('randomPickModal')?.remove();

        const toolbar = document.querySelector('.caller-toolbar');
        if (toolbar) {
            const btn = document.createElement('button');
            btn.id = 'randomPickBtn';
            btn.className = 'btn-primary';
            btn.style.cssText = 'display:flex;align-items:center;gap:6px;padding:10px 16px;border-radius:10px;cursor:pointer;font-family:inherit;font-weight:600;font-size:0.9rem; margin-right:auto;';
            btn.innerHTML = '<i class="fa-solid fa-dice"></i> Random Pick';
            btn.addEventListener('click', doRandomPick);
            // Insert at the beginning of the toolbar
            toolbar.insertBefore(btn, toolbar.firstChild);
        }

        const modal = document.createElement('div');
        modal.id = 'randomPickModal';
        modal.style.cssText = `
            display:none; position:fixed; inset:0; z-index:9999;
            background:rgba(0,0,0,0.8); backdrop-filter:blur(8px);
            justify-content:center; align-items:center; flex-direction:column;
            animation:fadeIn 0.2s ease both;
        `;
        document.body.appendChild(modal);
    }

    function doRandomPick() {
        const deck = buildCallDeck();

        if (deck.length === 0) {
            alert('All combinations have been called!');
            return;
        }

        // Pick a random combo from the remaining deck
        const pick = deck[Math.floor(Math.random() * deck.length)];
        const key = `${pick.colIdx}:${pick.itemIdx}`;
        randomCalledKeys.add(key);

        // Mark the grid cell as called (only the first time this item appears)
        if (!calledSet.has(pick.itemIdx)) {
            const cell = document.getElementById(`caller-cell-${pick.itemIdx}`);
            if (cell) cell.click();  // triggers toggleCall which adds to calledItems & sidebar
        }

        // Also record in calledItems for sidebar (with the random header pairing)
        // But only add to sidebar if the cell was already called (to avoid duplicate from click)
        if (calledSet.has(pick.itemIdx) && calledItems[calledItems.length - 1]?.itemIdx === pick.itemIdx
            && calledItems[calledItems.length - 1]?.colLetter !== pick.colLetter) {
            // The last entry was just added by cell.click() with the grid column letter
            // Update it to use the randomly-assigned header letter
            calledItems[calledItems.length - 1].colLetter = pick.colLetter;
            calledItems[calledItems.length - 1].colIdx = pick.colIdx;
            updateSidebar();
        }

        // Play audio: header audio first, then item audio
        if (_state.showHeader) {
            playHeaderAudio(pick.colIdx, pick.colLetter);
            setTimeout(() => {
                playItemAudio(pick.itemIdx, pick.item, pick.colLetter);
            }, 800);
        } else {
            playItemAudio(pick.itemIdx, pick.item, pick.colLetter);
        }

        showRandomModal(pick);
    }

    function showRandomModal(pick) {
        const modal = document.getElementById('randomPickModal');
        if (!modal) return;

        const { itemIdx, item, colLetter, colIdx } = pick;

        const isWord = _state.mode === 'word';
        const wordHtml = isWord
            ? `<div style="font-size:4rem; font-weight:900; color:#fff; text-shadow:0 4px 15px rgba(0,0,0,0.5); text-align:center;">${escHtml(typeof item === 'string' ? item : item.name)}</div>`
            : `<img src="${item.src}" style="max-width:300px; max-height:300px; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.5); border:6px solid #fff;">`;

        // Show remaining combos count
        const remaining = buildCallDeck().length;
        const total = _state.showHeader
            ? _state.itemPool.length * getHeaderLetters().length
            : _state.itemPool.length;

        modal.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; gap:20px; transform:scale(0.8); animation:popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;">
                ${_state.showHeader ? `<div style="
                    background:var(--amber-flame); color:#fff;
                    width:100px; height:100px; border-radius:50%;
                    display:flex; align-items:center; justify-content:center;
                    font-size:3.5rem; font-weight:900; box-shadow:0 8px 25px rgba(241,135,1,0.5);
                    border:4px solid #fff; margin-bottom:-10px; z-index:2;
                ">${colLetter}</div>` : ''}
                
                ${wordHtml}

                <div style="color:rgba(255,255,255,0.5); font-size:0.85rem; font-weight:600; margin-top:5px;">
                    ${remaining} of ${total} combos remaining
                </div>

                <div style="display:flex; gap:15px; margin-top:20px;">
                    <button id="rpRepeatBtn" class="btn-secondary" style="font-size:1.1rem; padding:12px 24px; border-radius:50px;">
                        <i class="fa-solid fa-volume-high" style="margin-right:8px;"></i> Repeat Audio
                    </button>
                    <button id="rpNextBtn" class="btn-primary" style="font-size:1.1rem; padding:12px 24px; border-radius:50px;">
                        <i class="fa-solid fa-dice" style="margin-right:8px;"></i> Next Pick
                    </button>
                </div>
            </div>
            
            <button id="rpCloseBtn" style="
                position:absolute; top:30px; right:30px;
                background:rgba(255,255,255,0.15); border:none; color:#fff;
                width:50px; height:50px; border-radius:50%; cursor:pointer;
                font-size:1.5rem; display:flex; align-items:center; justify-content:center;
                transition:background 0.2s, transform 0.2s;
            "><i class="fa-solid fa-xmark"></i></button>
        `;

        modal.style.display = 'flex';

        // Hover effects for close button
        const closeBtn = document.getElementById('rpCloseBtn');
        closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = 'rgba(255,255,255,0.3)');
        closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'rgba(255,255,255,0.15)');
        closeBtn.addEventListener('click', () => modal.style.display = 'none');

        document.getElementById('rpRepeatBtn').addEventListener('click', () => {
            if (_state.showHeader) {
                playHeaderAudio(colIdx, colLetter);
                setTimeout(() => playItemAudio(itemIdx, item, colLetter), 800);
            } else {
                playItemAudio(itemIdx, item, colLetter);
            }
        });

        document.getElementById('rpNextBtn').addEventListener('click', () => {
            doRandomPick();
        });
    }

    // ── Wire reset button ──────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        const resetBtn = document.getElementById('resetCaller');
        if (resetBtn) resetBtn.addEventListener('click', reset);
    });

    // ── Storage Export & Import hooks ───────────────────────────
    function getCallerState() {
        return {
            calledItems: JSON.parse(JSON.stringify(calledItems)),
            calledSet: Array.from(calledSet),
            randomCalledKeys: Array.from(randomCalledKeys),
            headerAudioBlobs: headerAudioBlobs,
            itemAudioBlobs: itemAudioBlobs
        };
    }

    function loadCallerState(data) {
        if (!data) return;

        // Ensure UI is completely clean and rebuilt first
        init(_state);

        // Restore collections
        calledItems = data.calledItems || [];
        calledSet = new Set(data.calledSet || []);
        randomCalledKeys = new Set(data.randomCalledKeys || []);

        // Restore UI state for matched Caller items without triggering double-audio playback
        calledSet.forEach(itemIdx => {
            const cell = document.getElementById(`caller-cell-${itemIdx}`);
            if (cell) {
                cell.classList.add('called');

                // Add red stamp explicitly
                const stamp = document.createElement('div');
                stamp.className = 'stamp-overlay';
                stamp.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
                // Remove existing to avoid dupes
                const exist = cell.querySelector('.stamp-overlay');
                if (exist) exist.remove();
                cell.appendChild(stamp);
            }
        });

        updateSidebar();

        // Restore Audio Blobs
        // We have to feed these to the chip UI nodes so the Object URLs can get reminted and assigned to actual new Audio classes
        if (data.headerAudioBlobs) {
            for (const [colIdx, blob] of Object.entries(data.headerAudioBlobs)) {
                const chip = document.getElementById(`am-row-header-${colIdx}`);
                if (chip && chip.loadExistingBlob) {
                    chip.loadExistingBlob(blob);
                }
            }
        }
        if (data.itemAudioBlobs) {
            for (const [itemIdx, blob] of Object.entries(data.itemAudioBlobs)) {
                const chip = document.getElementById(`am-row-item-${itemIdx}`);
                if (chip && chip.loadExistingBlob) {
                    chip.loadExistingBlob(blob);
                }
            }
        }
    }

    window.BingoCaller = { init, reset, getCallerState, loadCallerState };
})();
