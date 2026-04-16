/**
 * sequence-unscrambler.js
 * Sequence Unscrambler — ESL Learning Platform
 *
 * Architecture:
 *  - State: sessions[], currentSessionIdx, globalSettings
 *  - Settings UI: sidebar + editor form
 *  - Image Crop: hidden canvas → data-URL stored in session
 *  - Game: layout engine (inverted-S rows), pointer-events drag-drop, validation
 *  - Confetti: canvas particles
 */

/* ═══════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════ */
const STORAGE_KEY = 'su_sessions_v2';
const MAX_SESSIONS = 10;
const ITEMS_PER_ROW = 6; // threshold for wrapping to next row

let sessions = [];
let currentSessionIdx = null;   // which session is being edited in settings
let globalSettings = { sound: 'on' };
let driveService = null;

// Game runtime state
let gameSessionIdx = 0;         // which session we're currently playing
let placedItems = [];           // array of item indices placed in drop slots (null = empty)
let gameOrder = [];             // shuffled order of item indices
let sessionOrder = [];          // indices of sessions to play (in order)
let gameMode = 'words';         // 'words' | 'images'
let aspectRatio = '1:1';
let showLabels = true;
let forceSingleRow = false;

/* ═══════════════════════════════════════════════════════
   PERSISTENCE
═══════════════════════════════════════════════════════ */
function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) sessions = JSON.parse(raw);
    } catch (e) { sessions = []; }
}

function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) { /* quota */ }
}

function newSession() {
    return {
        id: Date.now() + Math.random(),
        label: '',
        mode: 'words',         // 'words' | 'images'
        aspectRatio: '1:1',
        showLabels: true,
        forceSingleRow: false,
        items: []              // [{text, imageDataUrl, caption}]
    };
}

function newItem(mode) {
    return mode === 'images'
        ? { text: '', imageDataUrl: null, caption: '' }
        : { text: '', imageDataUrl: null, caption: '' };
}

/* ═══════════════════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

const settingsScreen = $('su-screen-settings');
const gameScreen = $('su-screen-game');
const sessionSidebar = $('su-session-sidebar');
const sessionList = $('su-session-list');
const addSessionBtn = $('su-add-session');
const startGameBtn = $('su-start-game');
const sidebarToggle = $('su-sidebar-toggle');
const capHint = $('su-session-cap-hint');
const editorEmpty = $('su-editor-empty');
const editorCollapsed = $('su-editor-collapsed-state');
const editorForm = $('su-editor-form');

// Editor fields
const editorTitle = $('su-editor-session-title');
const sessionLabelInp = $('su-session-label');
const modeTabs = document.querySelectorAll('.su-mode-tab');
const aspectBtns = document.querySelectorAll('.su-aspect-btn');
const aspectGroup = $('su-aspect-ratio-group');
const labelsGroup = $('su-labels-group');
const forceSingleRowCk = $('su-force-single-row');
const showLabelsCk = $('su-show-labels');
const itemsList = $('su-items-list');
const addItemBtn = $('su-add-item');
const saveSessionBtn = $('su-save-session');
const deleteSessionBtn = $('su-delete-session');
const globalSoundSel = $('su-global-sound');
const driveSyncBtn = $('su-drive-sync-btn');

// Game elements
const sessionCounter = $('su-session-counter');
const progressFill = $('su-progress-bar-fill');
const prevBtn = $('su-prev-session');
const nextBtn = $('su-next-session');
const backToSettings = $('su-back-to-settings');
const gameTitle = $('su-game-title');
const sourceBank = $('su-source-bank');
const dropContainer = $('su-drop-zone-container');
const checkBtn = $('su-check-answer');
const shuffleBtn = $('su-shuffle-again');
const feedbackOverlay = $('su-feedback-overlay');
const feedbackIcon = $('su-feedback-icon');
const feedbackTitle = $('su-feedback-title');
const feedbackMsg = $('su-feedback-msg');
const tryAgainBtn = $('su-try-again');
const nextCorrectBtn = $('su-next-after-correct');
const finishBtn = $('su-finish-game');
const endScreen = $('su-end-screen');
const restartBtn = $('su-restart-game');
const endBackBtn = $('su-end-back-settings');
const confettiCanvas = $('su-confetti-canvas');

/* ═══════════════════════════════════════════════════════
   BACKGROUND CANVAS (floating particles)
═══════════════════════════════════════════════════════ */
(function initBgCanvas() {
    const canvas = $('su-bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const particles = [];
    let W, H;
    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();
    for (let i = 0; i < 60; i++) {
        particles.push({
            x: Math.random() * W, y: Math.random() * H,
            r: Math.random() * 2 + 0.5,
            vx: (Math.random() - .5) * .3,
            vy: (Math.random() - .5) * .3,
            a: Math.random()
        });
    }
    function draw() {
        ctx.clearRect(0, 0, W, H);
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(118,120,237,${p.a * .5})`;
            ctx.fill();
            p.x += p.vx; p.y += p.vy; p.a += .005 * (Math.random() > .5 ? 1 : -1);
            if (p.a < 0) p.a = 0; if (p.a > 1) p.a = 1;
            if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        });
        requestAnimationFrame(draw);
    }
    draw();
})();

/* ═══════════════════════════════════════════════════════
   IMAGE CROP UTILITY
═══════════════════════════════════════════════════════ */
function ratioToNumbers(ratioStr) {
    const parts = ratioStr.split(':');
    return { w: parseInt(parts[0]), h: parseInt(parts[1]) };
}

function cropImageFile(file, ratioStr) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const { w: rw, h: rh } = ratioToNumbers(ratioStr);
                const targetRatio = rw / rh;
                const srcRatio = img.width / img.height;

                let sx, sy, sw, sh;
                if (srcRatio > targetRatio) {
                    sh = img.height; sw = sh * targetRatio;
                    sx = (img.width - sw) / 2; sy = 0;
                } else {
                    sw = img.width; sh = sw / targetRatio;
                    sx = 0; sy = (img.height - sh) / 2;
                }

                const MAX_DIM = 600;
                const scale = Math.min(1, MAX_DIM / sw, MAX_DIM / sh);
                const outW = Math.round(sw * scale);
                const outH = Math.round(sh * scale);

                const canvas = $('su-crop-canvas');
                canvas.width = outW;
                canvas.height = outH;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
                resolve(canvas.toDataURL('image/jpeg', .85));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

/* ═══════════════════════════════════════════════════════
   SETTINGS UI — RENDER SESSION LIST
═══════════════════════════════════════════════════════ */
function renderSessionList() {
    sessionList.innerHTML = '';
    sessions.forEach((s, idx) => {
        const li = document.createElement('li');
        li.className = 'su-session-item' + (idx === currentSessionIdx ? ' active' : '');
        li.innerHTML = `
            <div class="su-session-item-info">
                <span class="su-session-number">${s.mode === 'images' ? '🖼 ' : '📝 '}Session ${idx + 1}</span>
                <span class="su-session-preview">${s.label || 'Untitled'}</span>
            </div>
            <button class="su-session-delete" data-idx="${idx}" title="Delete session">
                <i class="fa-solid fa-xmark"></i>
            </button>`;
        li.addEventListener('click', e => {
            if (e.target.closest('.su-session-delete')) return;
            selectSession(idx);
        });
        li.querySelector('.su-session-delete').addEventListener('click', e => {
            e.stopPropagation();
            deleteSession(idx);
        });
        sessionList.appendChild(li);
    });

    const isFull = sessions.length >= MAX_SESSIONS;
    addSessionBtn.disabled = isFull;
    capHint.style.display = isFull ? '' : 'none';

    startGameBtn.disabled = sessions.length === 0 || sessions.every(s => s.items.length < 2);
}

function renderEditorForm() {
    if (currentSessionIdx === null) {
        editorEmpty.style.display = '';
        editorCollapsed.style.display = 'none';
        editorForm.style.display = 'none';
        return;
    }
    if (sessionSidebar.classList.contains('collapsed')) {
        editorEmpty.style.display = 'none';
        editorCollapsed.style.display = '';
        editorForm.style.display = 'none';
        return;
    }
    editorEmpty.style.display = 'none';
    editorCollapsed.style.display = 'none';
    editorForm.style.display = '';

    const s = sessions[currentSessionIdx];
    editorTitle.textContent = `Session ${currentSessionIdx + 1}`;
    sessionLabelInp.value = s.label || '';
    forceSingleRowCk.checked = s.forceSingleRow || false;
    showLabelsCk.checked = s.showLabels !== false;
    globalSoundSel.value = globalSettings.sound;

    // Mode tabs
    modeTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === s.mode);
    });

    // Aspect ratio
    aspectBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.ratio === (s.aspectRatio || '1:1'));
    });

    // Toggle image-mode fields
    const isImg = s.mode === 'images';
    aspectGroup.style.display = isImg ? '' : 'none';
    labelsGroup.style.display = isImg ? '' : 'none';

    renderEditorItems(s);
}

function renderEditorItems(s) {
    itemsList.innerHTML = '';
    (s.items || []).forEach((item, idx) => {
        const li = document.createElement('li');
        li.className = 'su-item-row';
        li.dataset.idx = idx;
        li.draggable = true;

        if (s.mode === 'images') {
            li.innerHTML = `
                <span class="su-item-drag-handle"><i class="fa-solid fa-grip-vertical"></i></span>
                <span class="su-item-number-badge">${idx + 1}</span>
                <div class="su-item-image-wrapper">
                    ${item.imageDataUrl
                    ? `<img class="su-item-thumb" src="${item.imageDataUrl}" alt="">`
                    : `<div class="su-item-thumb" style="background:var(--su-input-bg);display:flex;align-items:center;justify-content:center;color:var(--su-panel-muted);font-size:.7rem;border-radius:8px;">No img</div>`}
                    <div class="su-item-image-info">
                        <input class="su-item-img-label" type="text" placeholder="Caption (optional)" value="${escHtml(item.caption || '')}">
                        <button class="su-item-upload-btn" data-idx="${idx}">
                            <i class="fa-solid fa-upload"></i> ${item.imageDataUrl ? 'Change image' : 'Upload image'}
                        </button>
                    </div>
                </div>
                <button class="su-item-remove" data-idx="${idx}" title="Remove"><i class="fa-solid fa-xmark"></i></button>`;
            li.querySelector('.su-item-upload-btn').addEventListener('click', () => triggerImageUpload(idx));
            li.querySelector('.su-item-img-label').addEventListener('input', e => {
                sessions[currentSessionIdx].items[idx].caption = e.target.value;
            });
        } else {
            li.innerHTML = `
                <span class="su-item-drag-handle"><i class="fa-solid fa-grip-vertical"></i></span>
                <span class="su-item-number-badge">${idx + 1}</span>
                <input class="su-item-text-input" type="text" placeholder="Item text…" value="${escHtml(item.text || '')}">
                <button class="su-item-remove" data-idx="${idx}" title="Remove"><i class="fa-solid fa-xmark"></i></button>`;
            li.querySelector('.su-item-text-input').addEventListener('input', e => {
                sessions[currentSessionIdx].items[idx].text = e.target.value;
            });
        }

        li.querySelector('.su-item-remove').addEventListener('click', e => {
            e.preventDefault();
            sessions[currentSessionIdx].items.splice(idx, 1);
            renderEditorItems(sessions[currentSessionIdx]);
        });

        // Drag-to-reorder in editor
        setupEditorItemDrag(li, idx);

        itemsList.appendChild(li);
    });
}

// ── Editor item drag-to-reorder ──
let dragSrcIdx = null;
function setupEditorItemDrag(li, idx) {
    li.addEventListener('dragstart', () => {
        dragSrcIdx = idx;
        li.style.opacity = '.4';
    });
    li.addEventListener('dragend', () => { li.style.opacity = ''; });
    li.addEventListener('dragover', e => {
        e.preventDefault();
        li.classList.add('dragging-over');
    });
    li.addEventListener('dragleave', () => li.classList.remove('dragging-over'));
    li.addEventListener('drop', e => {
        e.preventDefault();
        li.classList.remove('dragging-over');
        if (dragSrcIdx === null || dragSrcIdx === idx) return;
        const s = sessions[currentSessionIdx];
        const [moved] = s.items.splice(dragSrcIdx, 1);
        s.items.splice(idx, 0, moved);
        dragSrcIdx = null;
        renderEditorItems(s);
    });
}

// ── Image upload trigger ──
function triggerImageUpload(itemIdx) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.click();
    inp.addEventListener('change', async () => {
        const file = inp.files[0];
        if (!file) { inp.remove(); return; }
        const ratio = sessions[currentSessionIdx].aspectRatio || '1:1';
        const dataUrl = await cropImageFile(file, ratio);
        sessions[currentSessionIdx].items[itemIdx].imageDataUrl = dataUrl;
        renderEditorItems(sessions[currentSessionIdx]);
        inp.remove();
    });
}

/* ═══════════════════════════════════════════════════════
   SETTINGS UI — ACTIONS
═══════════════════════════════════════════════════════ */
function selectSession(idx) {
    currentSessionIdx = idx;
    renderSessionList();
    renderEditorForm();
}

function deleteSession(idx) {
    sessions.splice(idx, 1);
    if (currentSessionIdx === idx) currentSessionIdx = null;
    else if (currentSessionIdx > idx) currentSessionIdx--;
    saveToStorage();
    renderSessionList();
    renderEditorForm();
}

function saveCurrentSession() {
    if (currentSessionIdx === null) return;
    const s = sessions[currentSessionIdx];
    s.label = sessionLabelInp.value.trim();
    s.forceSingleRow = forceSingleRowCk.checked;
    s.showLabels = showLabelsCk.checked;
    globalSettings.sound = globalSoundSel.value;
    // Items saved real-time; just persist
    saveToStorage();
    renderSessionList();
    // Flash save feedback
    const icon = saveSessionBtn.querySelector('i');
    icon.className = 'fa-solid fa-check';
    saveSessionBtn.style.background = 'var(--su-correct)';
    setTimeout(() => {
        icon.className = 'fa-solid fa-floppy-disk';
        saveSessionBtn.style.background = '';
    }, 1200);
}

/* ═══════════════════════════════════════════════════════
   SETTINGS EVENT LISTENERS
═══════════════════════════════════════════════════════ */
addSessionBtn.addEventListener('click', () => {
    if (sessions.length >= MAX_SESSIONS) return;
    const s = newSession();
    sessions.push(s);
    saveToStorage();
    selectSession(sessions.length - 1);
    renderSessionList();
});

sidebarToggle.addEventListener('click', () => {
    sessionSidebar.classList.toggle('collapsed');
    renderEditorForm();
});

saveSessionBtn.addEventListener('click', saveCurrentSession);

deleteSessionBtn.addEventListener('click', () => {
    if (currentSessionIdx === null) return;
    if (!confirm('Delete this session?')) return;
    deleteSession(currentSessionIdx);
});

addItemBtn.addEventListener('click', () => {
    if (currentSessionIdx === null) return;
    const s = sessions[currentSessionIdx];
    s.items.push(newItem(s.mode));
    renderEditorItems(s);
});

// Mode tabs
modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        if (currentSessionIdx === null) return;
        modeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        sessions[currentSessionIdx].mode = tab.dataset.mode;
        const isImg = tab.dataset.mode === 'images';
        aspectGroup.style.display = isImg ? '' : 'none';
        labelsGroup.style.display = isImg ? '' : 'none';
        // Clear items on mode switch to avoid mixing types
        sessions[currentSessionIdx].items = [];
        renderEditorItems(sessions[currentSessionIdx]);
    });
});

// Aspect ratio buttons
aspectBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (currentSessionIdx === null) return;
        aspectBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sessions[currentSessionIdx].aspectRatio = btn.dataset.ratio;
    });
});

/* ═══════════════════════════════════════════════════════
   GAME — START & LAYOUT
═══════════════════════════════════════════════════════ */
startGameBtn.addEventListener('click', () => {
    // Validate & filter sessions with at least 2 items
    sessionOrder = sessions
        .map((s, i) => i)
        .filter(i => (sessions[i].items || []).length >= 2);
    if (sessionOrder.length === 0) return;
    gameSessionIdx = 0;
    settingsScreen.classList.remove('active');
    gameScreen.classList.add('active');
    loadGameSession();
});

function loadGameSession() {
    const idx = sessionOrder[gameSessionIdx];
    const s = sessions[idx];
    gameMode = s.mode;
    aspectRatio = s.aspectRatio || '1:1';
    showLabels = s.showLabels !== false;
    forceSingleRow = s.forceSingleRow || false;

    // Update progress
    sessionCounter.textContent = `Session ${gameSessionIdx + 1} / ${sessionOrder.length}`;
    progressFill.style.width = `${((gameSessionIdx) / sessionOrder.length) * 100}%`;
    prevBtn.disabled = gameSessionIdx === 0;
    nextBtn.disabled = gameSessionIdx === sessionOrder.length - 1;

    // Title
    gameTitle.textContent = s.label || `Session ${gameSessionIdx + 1}`;

    // Shuffle item order
    const n = s.items.length;
    gameOrder = shuffle(Array.from({ length: n }, (_, i) => i));
    placedItems = new Array(n).fill(null);

    // Apply mode class
    document.querySelector('.su-game-body').className = `su-game-body su-mode-${gameMode}`;

    // Smart Sizing Calculation
    const perRow = (forceSingleRow || n <= ITEMS_PER_ROW) ? n : ITEMS_PER_ROW;
    if (gameMode === 'images') {
        const maxW = Math.floor((820 - (perRow - 1) * 10) / Math.max(1, perRow));
        playState.baseW = Math.max(60, Math.min(160, maxW));
    } else {
        playState.baseW = null;
    }

    buildSourceBank(s);
    buildDropZones(s);
    hideFeedback();
    endScreen.style.display = 'none';

    // re-enable check btn
    checkBtn.disabled = false;
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* ─────── Source bank ─────── */
function buildSourceBank(s) {
    sourceBank.innerHTML = '';
    gameOrder.forEach(itemIdx => {
        const tile = makeTile(s.items[itemIdx], itemIdx, s);
        tile.dataset.itemIdx = itemIdx;
        tile.dataset.location = 'source';
        sourceBank.appendChild(tile);
        initTileDrag(tile);
    });
}

/* ─────── Drop zone rows (inverted-S) ─────── */
function buildDropZones(s) {
    dropContainer.innerHTML = '';
    const n = s.items.length;
    const perRow = (forceSingleRow || n <= ITEMS_PER_ROW) ? n : ITEMS_PER_ROW;
    let slotI = 0;

    let rowNum = 0;
    while (slotI < n) {
        // --- add connector arrow between rows ---
        if (rowNum > 0) {
            const prevRow = dropContainer.querySelector(`.su-drop-row:last-child`);
            const isRtl = (rowNum % 2 === 1);
            dropContainer.appendChild(makeArrow(isRtl));
        }

        const rowEl = document.createElement('div');
        rowEl.className = 'su-drop-row' + (rowNum % 2 === 1 ? ' rtl' : '');
        rowEl.dataset.row = rowNum;

        const rowEnd = Math.min(slotI + perRow, n);
        for (let i = slotI; i < rowEnd; i++) {
            const slot = document.createElement('div');
            slot.className = 'su-drop-slot';
            slot.dataset.slotIdx = i;
            const badge = document.createElement('span');
            badge.className = 'su-slot-number';
            badge.textContent = i + 1;
            slot.appendChild(badge);
            sizeDragSlot(slot, s);
            initDropSlot(slot);
            rowEl.appendChild(slot);
        }

        dropContainer.appendChild(rowEl);
        slotI = rowEnd;
        rowNum++;
    }
}

function sizeDragSlot(slot, s) {
    if (s.mode === 'images') {
        const { w, h } = ratioToNumbers(s.aspectRatio || '1:1');
        const baseW = playState.baseW || 100;
        const baseH = Math.round(baseW * h / w);
        slot.style.width = baseW + 'px';
        slot.style.height = (baseH + (s.showLabels !== false ? 28 : 0)) + 'px';
    } else {
        slot.style.minWidth = '90px';
        slot.style.minHeight = '52px';
    }
}

function makeArrow(isRtl) {
    const wrap = document.createElement('div');
    wrap.className = 'su-arrow-connector';
    // isRtl = previous row was left-to-right, so arrow bends to the right end
    // arrow goes from right (end of prev row) down and left to left (start of next row)
    // or vice-versa
    const arrowSvg = isRtl
        ? `<svg viewBox="0 0 100 44" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
              <path class="su-arrow-path" d="M 98 4 Q 98 22 50 22 Q 2 22 2 40"/>
              <polygon class="su-arrow-head" points="2,40 8,30 -4,30"/>
           </svg>`
        : `<svg viewBox="0 0 100 44" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
              <path class="su-arrow-path" d="M 2 4 Q 2 22 50 22 Q 98 22 98 40"/>
              <polygon class="su-arrow-head" points="98,40 104,30 92,30"/>
           </svg>`;
    wrap.innerHTML = arrowSvg;
    return wrap;
}

/* ═══════════════════════════════════════════════════════
   TILE FACTORY
═══════════════════════════════════════════════════════ */
function makeTile(item, itemIdx, s) {
    const tile = document.createElement('div');
    tile.className = 'su-tile';

    if (s.mode === 'images') {
        tile.classList.add('su-tile-image');
        if (!s.showLabels) tile.classList.add('no-label');
        const { w, h } = ratioToNumbers(s.aspectRatio || '1:1');
        const baseW = playState.baseW || 100;
        const baseH = Math.round(baseW * h / w);
        tile.style.width = baseW + 'px';

        if (item.imageDataUrl) {
            const img = document.createElement('img');
            img.className = 'su-tile-img';
            img.src = item.imageDataUrl;
            img.style.width = '100%';
            img.style.height = baseH + 'px';
            img.draggable = false;
            tile.appendChild(img);
        } else {
            const ph = document.createElement('div');
            ph.style.cssText = `width:100%;height:${baseH}px;background:rgba(118,120,237,.2);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.8rem;`;
            ph.textContent = 'No image';
            tile.appendChild(ph);
        }

        if (s.showLabels !== false) {
            const lbl = document.createElement('div');
            lbl.className = 'su-tile-label';
            lbl.textContent = item.caption || item.text || '';
            tile.appendChild(lbl);
        }
    } else {
        tile.classList.add('su-tile-word');
        tile.textContent = item.text || '(empty)';
        if ((s.items && s.items.length > 6) || s.forceSingleRow) {
            tile.style.fontSize = '0.9rem';
            tile.style.padding = '8px 12px';
        }
    }

    return tile;
}

/* ═══════════════════════════════════════════════════════
   DRAG & DROP (Pointer Events — works on both touch and mouse)
═══════════════════════════════════════════════════════ */
let ghost = null;  // floating clone
let ghostOffsetX = 0, ghostOffsetY = 0;
let activeTile = null;  // the original tile being dragged
let hoverSlot = null;  // slot currently hovered

function initTileDrag(tile) {
    tile.addEventListener('pointerdown', onPointerDown);
}

function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return; // left btn / touch only
    e.preventDefault();

    activeTile = e.currentTarget;
    activeTile.setPointerCapture(e.pointerId);

    // Create floating ghost
    const rect = activeTile.getBoundingClientRect();
    ghostOffsetX = e.clientX - rect.left;
    ghostOffsetY = e.clientY - rect.top;

    ghost = activeTile.cloneNode(true);
    ghost.className += ' su-drag-ghost';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    document.body.appendChild(ghost);

    activeTile.style.opacity = '.25';
    activeTile.classList.add('is-dragging');

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp, { once: true });
}

function onPointerMove(e) {
    if (!ghost) return;
    const x = e.clientX - ghostOffsetX;
    const y = e.clientY - ghostOffsetY;
    ghost.style.left = x + 'px';
    ghost.style.top = y + 'px';

    // Find slot under pointer
    ghost.style.pointerEvents = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    ghost.style.pointerEvents = '';

    const slot = under ? under.closest('.su-drop-slot') : null;
    if (slot !== hoverSlot) {
        if (hoverSlot) hoverSlot.classList.remove('drag-over');
        hoverSlot = slot;
        if (hoverSlot) hoverSlot.classList.add('drag-over');
    }

    const bank = under ? under.closest('#su-source-bank') : null;
    sourceBank.classList.toggle('drag-over', !!bank && !slot);
}

function onPointerUp(e) {
    document.removeEventListener('pointermove', onPointerMove);
    if (hoverSlot) hoverSlot.classList.remove('drag-over');
    sourceBank.classList.remove('drag-over');

    if (!activeTile) {
        if (ghost) { ghost.remove(); ghost = null; }
        return;
    }

    const startRect = ghost ? ghost.getBoundingClientRect() : activeTile.getBoundingClientRect();
    if (ghost) { ghost.remove(); ghost = null; }

    activeTile.classList.remove('is-dragging');

    if (hoverSlot) {
        placeTileInSlot(activeTile, hoverSlot, startRect);
    } else {
        // Return to source bank if dropped outside a slot
        returnTileToSource(activeTile, startRect);
    }

    hoverSlot = null;
    activeTile = null;
}

function placeTileInSlot(tile, slot, startRect) {
    const slotIdx = parseInt(slot.dataset.slotIdx);
    const itemIdx = parseInt(tile.dataset.itemIdx);
    const prevLoc = tile.dataset.location;
    const prevSlot = prevLoc === 'slot' ? parseInt(tile.dataset.slotIdx) : null;

    // If slot already has a tile, swap or return it to source
    const existingTile = slot.querySelector('.su-tile');
    if (existingTile) {
        const extRect = existingTile.getBoundingClientRect();
        if (prevSlot !== null) {
            // Move existing tile to the old slot
            const oldSlot = dropContainer.querySelector(`[data-slot-idx="${prevSlot}"]`);
            if (oldSlot) {
                existingTile.dataset.location = 'slot';
                existingTile.dataset.slotIdx = prevSlot;
                placedItems[prevSlot] = parseInt(existingTile.dataset.itemIdx);
                oldSlot.classList.add('occupied');
                animateTileTo(existingTile, extRect, oldSlot, false);
            } else {
                placedItems[parseInt(existingTile.dataset.slotIdx)] = null;
                returnTileToSource(existingTile, extRect);
            }
        } else {
            placedItems[parseInt(existingTile.dataset.slotIdx)] = null;
            returnTileToSource(existingTile, extRect);
        }
    } else if (prevSlot !== null) {
        placedItems[prevSlot] = null;
        const oldSlot = dropContainer.querySelector(`[data-slot-idx="${prevSlot}"]`);
        if (oldSlot) oldSlot.classList.remove('occupied');
    }

    // Place in new slot
    tile.dataset.location = 'slot';
    tile.dataset.slotIdx = slotIdx;
    placedItems[slotIdx] = itemIdx;
    slot.classList.add('occupied');

    animateTileTo(tile, startRect, slot, false);
}

function returnTileToSource(tile, startRect) {
    const prevLoc = tile.dataset.location;
    const prevSlot = prevLoc === 'slot' ? parseInt(tile.dataset.slotIdx) : null;
    if (prevSlot !== null) {
        placedItems[prevSlot] = null;
        const slot = dropContainer.querySelector(`[data-slot-idx="${prevSlot}"]`);
        if (slot) slot.classList.remove('occupied');
    }
    tile.dataset.location = 'source';
    tile.removeAttribute('data-slot-idx');

    if (!startRect) startRect = tile.getBoundingClientRect();

    animateTileTo(tile, startRect, sourceBank, true);
}

function animateTileTo(tile, startRect, targetParent, isReturn) {
    targetParent.appendChild(tile);
    tile.style.opacity = '1';

    const endRect = tile.getBoundingClientRect();

    tile.classList.add(isReturn ? 'snap-return' : 'snap-animating');
    tile.style.left = startRect.left + 'px';
    tile.style.top = startRect.top + 'px';
    tile.style.width = startRect.width + 'px';
    tile.style.height = startRect.height + 'px';

    void tile.offsetHeight; // force reflow

    tile.style.left = endRect.left + 'px';
    tile.style.top = endRect.top + 'px';
    tile.style.width = endRect.width + 'px';
    tile.style.height = endRect.height + 'px';

    setTimeout(() => {
        tile.classList.remove('snap-animating', 'snap-return');
        tile.style.left = '';
        tile.style.top = '';
        tile.style.width = '';
        tile.style.height = '';
    }, 360);
}

function initDropSlot(slot) {
    // Slots handle drops through the global pointerup handler.
    // Extra: allow clicking an occupied slot to return tile to source
    slot.addEventListener('click', () => {
        const tile = slot.querySelector('.su-tile');
        if (tile && !ghost) {
            const rect = tile.getBoundingClientRect();
            returnTileToSource(tile, rect);
        }
    });
}

/* ═══════════════════════════════════════════════════════
   GAME CONTROLS
═══════════════════════════════════════════════════════ */
checkBtn.addEventListener('click', checkAnswer);

shuffleBtn.addEventListener('click', () => {
    // Return all placed tiles to the source bank, then reshuffle
    dropContainer.querySelectorAll('.su-tile').forEach(t => {
        const rect = t.getBoundingClientRect();
        returnTileToSource(t, rect);
    });
    placedItems.fill(null);
    dropContainer.querySelectorAll('.su-drop-slot').forEach(s => {
        s.classList.remove('occupied');
        // remove feedback classes
        s.querySelectorAll('.su-tile').forEach(t => {
            t.classList.remove('correct', 'wrong');
        });
    });
    // Reshuffle source bank
    const tiles = Array.from(sourceBank.querySelectorAll('.su-tile'));
    shuffle(tiles).forEach(t => sourceBank.appendChild(t));
    checkBtn.disabled = false;
    hideFeedback();
});

backToSettings.addEventListener('click', () => {
    gameScreen.classList.remove('active');
    settingsScreen.classList.add('active');
    renderSessionList();
    renderEditorForm();
});

prevBtn.addEventListener('click', () => {
    if (gameSessionIdx > 0) { gameSessionIdx--; loadGameSession(); }
});

nextBtn.addEventListener('click', () => {
    if (gameSessionIdx < sessionOrder.length - 1) { gameSessionIdx++; loadGameSession(); }
});

tryAgainBtn.addEventListener('click', () => {
    hideFeedback();
    // Clear visual feedback from tiles
    document.querySelectorAll('.su-tile').forEach(t => t.classList.remove('correct', 'wrong'));
    checkBtn.disabled = false;
});

nextCorrectBtn.addEventListener('click', advanceSession);
finishBtn.addEventListener('click', showEndScreen);
restartBtn.addEventListener('click', () => {
    endScreen.style.display = 'none';
    gameSessionIdx = 0;
    loadGameSession();
});
endBackBtn.addEventListener('click', () => {
    endScreen.style.display = 'none';
    gameScreen.classList.remove('active');
    settingsScreen.classList.add('active');
    renderSessionList();
    renderEditorForm();
});

function checkAnswer() {
    const idx = sessionOrder[gameSessionIdx];
    const s = sessions[idx];
    const n = s.items.length;
    let allFilled = true;
    let allCorrect = true;

    for (let slotI = 0; slotI < n; slotI++) {
        const placed = placedItems[slotI]; // item index placed in slot slotI
        if (placed === null) { allFilled = false; break; }
        const slot = dropContainer.querySelector(`[data-slot-idx="${slotI}"]`);
        const tile = slot ? slot.querySelector('.su-tile') : null;
        const correct = (placed === slotI); // slot i should have item i
        if (tile) {
            tile.classList.remove('correct', 'wrong');
            tile.classList.add(correct ? 'correct' : 'wrong');
        }
        if (!correct) allCorrect = false;
    }

    if (!allFilled) {
        // Don't check yet — show a mini alert
        checkBtn.disabled = false;
        checkBtn.animate([
            { transform: 'translateX(-6px)' },
            { transform: 'translateX(6px)' },
            { transform: 'translateX(0)' }
        ], { duration: 300, iterations: 2 });
        return;
    }

    checkBtn.disabled = true;

    if (allCorrect) {
        if (globalSettings.sound === 'on') playTone(660, 0.12, 'sine');
        launchConfetti();
        showFeedback(true, '🎉 Correct!', 'You got the order right. Great job!',
            gameSessionIdx < sessionOrder.length - 1 ? 'next' : 'finish');
    } else {
        if (globalSettings.sound === 'on') playTone(220, 0.15, 'sawtooth');
        showFeedback(false, '❌ Not quite!', 'Some items are in the wrong order. Try again!', 'retry');
    }
}

function advanceSession() {
    hideFeedback();
    gameSessionIdx++;
    progressFill.style.width = `${((gameSessionIdx) / sessionOrder.length) * 100}%`;
    loadGameSession();
}

function showEndScreen() {
    hideFeedback();
    progressFill.style.width = '100%';
    endScreen.style.display = 'flex';
    launchConfetti();
}

function showFeedback(correct, title, msg, action) {
    feedbackOverlay.style.display = 'flex';
    feedbackIcon.textContent = correct ? '🎉' : '❌';
    feedbackTitle.textContent = title;
    feedbackMsg.textContent = msg;
    tryAgainBtn.style.display = action === 'retry' ? '' : 'none';
    nextCorrectBtn.style.display = action === 'next' ? '' : 'none';
    finishBtn.style.display = action === 'finish' ? '' : 'none';
}

function hideFeedback() {
    feedbackOverlay.style.display = 'none';
}

/* ═══════════════════════════════════════════════════════
   CONFETTI
═══════════════════════════════════════════════════════ */
let confettiParticles = [];
let confettiFrame = null;

function launchConfetti() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    confettiParticles = [];
    for (let i = 0; i < 130; i++) {
        confettiParticles.push({
            x: Math.random() * confettiCanvas.width,
            y: -Math.random() * confettiCanvas.height * .5,
            vx: (Math.random() - .5) * 5,
            vy: Math.random() * 4 + 2,
            rot: Math.random() * 360,
            vrot: Math.random() * 8 - 4,
            w: Math.random() * 12 + 6,
            h: Math.random() * 6 + 3,
            color: `hsl(${Math.random() * 360},90%,60%)`
        });
    }
    if (confettiFrame) cancelAnimationFrame(confettiFrame);
    animateConfetti();
    setTimeout(() => { if (confettiFrame) cancelAnimationFrame(confettiFrame); }, 3500);
}

function animateConfetti() {
    const ctx = confettiCanvas.getContext('2d');
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiParticles.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        p.x += p.vx; p.y += p.vy;
        p.rot += p.vrot; p.vy += .12;
    });
    confettiFrame = requestAnimationFrame(animateConfetti);
}

/* ═══════════════════════════════════════════════════════
   SOUND
═══════════════════════════════════════════════════════ */
function playTone(freq, dur = 0.1, type = 'sine') {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = type; osc.frequency.value = freq;
        gain.gain.setValueAtTime(.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + dur);
        osc.start(); osc.stop(ctx.currentTime + dur);
    } catch (e) { /* no audio */ }
}

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════
function init() {
    loadFromStorage();

    // Initialize Drive Sync
    if (typeof window.GoogleDriveService === 'function') {
        driveService = new window.GoogleDriveService({
            folderName: 'ESL Learning - Sequence Unscrambler',
            fileExtension: '.json',
            onSave: () => ({
                version: 1,
                settings: globalSettings,
                sessions: sessions
            }),
            onLoad: (data) => {
                if (data.sessions && Array.isArray(data.sessions)) {
                    sessions = data.sessions;
                    if (data.settings) {
                        globalSettings = { ...globalSettings, ...data.settings };
                        globalSoundSel.value = globalSettings.sound;
                    }
                    renderSessionList();
                    if (sessions.length > 0) {
                        selectSession(0);
                    } else {
                        currentSessionIdx = null;
                        renderEditorForm();
                    }
                    saveToStorage();
                }
            }
        });
    }

    if (driveSyncBtn) {
        driveSyncBtn.addEventListener('click', () => {
            if (driveService) driveService.openModal();
        });
    }

    renderSessionList();
    renderEditorForm();
}

init();
