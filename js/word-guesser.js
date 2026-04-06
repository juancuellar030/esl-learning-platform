/* =============================================================
   WORD GUESSER – Main JavaScript
   ESL Learning Platform
   ============================================================= */
'use strict';

/* ── Constants ── */
const MAX_SESSIONS = 10;
const MAX_IMAGES = 6;
const MAX_DISTRACTORS = 5;
const STORAGE_KEY = 'wg-sessions';
const FEEDBACK_DURATION = 1800; // ms before advancing

/* ── State ── */
const wg = {
    sessions: [],          // array of session objects
    activeEditorId: null,  // id of session currently open in editor
    currentGame: {
        sessionIdx: 0,
        clueIdx: 0,        // how many clues have been revealed (manual mode)
        answered: false,
    }
};

/* ── Audio context (lazy) ── */
let _audioCtx = null;
function getAudioCtx() {
    if (!_audioCtx) {
        try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { }
    }
    return _audioCtx;
}

function playNote(freq, startTime, duration, gainVal = 0.25, type = 'sine') {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
}

function playWinChime() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    // C–E–G–C arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => playNote(freq, now + i * 0.1, 0.35, 0.22, 'sine'));
}

function playWrongBuzz() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    playNote(150, now, 0.28, 0.3, 'sawtooth');
}

/* ── Utility ── */
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function createSession() {
    return {
        id: uid(),
        word: '',
        clues: [],
        images: [],      // base64 strings
        revealMode: 'all',      // 'all' | 'manual'
        answerMode: 'choice',   // 'choice' | 'input-bar' | 'input-boxes'
        distractorSource: 'manual', // 'manual' | 'auto'
        distractors: ['', '', '', '', ''],
    };
}

function saveSessions() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(wg.sessions));
    } catch (e) {
        console.warn('WG: localStorage save failed', e);
    }
}

function loadSessions() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) { wg.sessions = JSON.parse(raw) || []; }
    } catch (_) { }
}

function sessionLabel(s) {
    return s.word ? s.word : 'Untitled';
}

/* ── DOM refs ── */
const $ = id => document.getElementById(id);

const dom = {
    settingsScreen: $('wg-screen-settings'),
    gameScreen: $('wg-screen-game'),
    sessionList: $('wg-session-list'),
    addSessionBtn: $('wg-add-session'),
    sessionCapHint: $('wg-session-cap-hint'),
    startGameBtn: $('wg-start-game'),
    editorEmpty: $('wg-editor-empty'),
    editorForm: $('wg-editor-form'),
    editorTitle: $('wg-editor-session-title'),
    answerWord: $('wg-answer-word'),
    cluesTextarea: $('wg-clues-textarea'),
    imageUploadInput: $('wg-image-upload-input'),
    imagePreviews: $('wg-image-previews'),
    revealToggle: $('wg-reveal-toggle'),
    answerModeTabs: $('wg-answer-mode-tabs'),
    choiceOptions: $('wg-choice-options'),
    distractorAutoToggle: $('wg-distractor-auto-toggle'),
    autoHint: $('wg-auto-hint'),
    manualDistr: $('wg-manual-distractors'),
    distractorInputs: $('wg-distractor-inputs'),
    saveSessionBtn: $('wg-save-session'),
    deleteSessionBtn: $('wg-delete-session'),
    sidebarToggle: $('wg-sidebar-toggle'),
    driveSyncBtn: $('wg-drive-sync-btn'),
    // Game
    backToSettings: $('wg-back-to-settings'),
    sessionCounter: $('wg-session-counter'),
    progressFill: $('wg-progress-bar-fill'),
    prevSessionBtn: $('wg-prev-session'),
    nextSessionBtn: $('wg-next-session'),
    gameImages: $('wg-game-images'),
    cluesList: $('wg-clues-list'),
    revealBtn: $('wg-reveal-btn'),
    answerArea: $('wg-answer-area'),
    feedbackOverlay: $('wg-feedback-overlay'),
    feedbackBadge: $('wg-feedback-badge'),
    confettiCanvas: $('wg-confetti-canvas'),
    endScreen: $('wg-end-screen'),
    restartGameBtn: $('wg-restart-game'),
    endBackSettings: $('wg-end-back-settings'),
};

/* ══════════════════════════════════════════════
   SETTINGS PANEL
══════════════════════════════════════════════ */

function renderSessionList() {
    dom.sessionList.innerHTML = '';
    const atCap = wg.sessions.length >= MAX_SESSIONS;
    dom.addSessionBtn.disabled = atCap;
    dom.sessionCapHint.style.display = atCap ? 'flex' : 'none';
    dom.startGameBtn.disabled = wg.sessions.length === 0 || wg.sessions.every(s => !s.word.trim());

    wg.sessions.forEach((s, i) => {
        const li = document.createElement('li');
        li.className = 'wg-session-item' + (s.id === wg.activeEditorId ? ' active' : '');
        li.style.animationDelay = `${i * 0.04}s`;
        li.innerHTML = `
            <span class="wg-session-item-num">${i + 1}</span>
            <span class="wg-session-item-word">${escHtml(sessionLabel(s))}</span>
            <button class="wg-session-item-delete" data-id="${s.id}" title="Delete session">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        li.addEventListener('click', (e) => {
            if (e.target.closest('.wg-session-item-delete')) return;
            openEditor(s.id);
        });
        li.querySelector('.wg-session-item-delete').addEventListener('click', () => deleteSession(s.id));
        dom.sessionList.appendChild(li);
    });
}

function openEditor(id) {
    const s = wg.sessions.find(x => x.id === id);
    if (!s) return;
    wg.activeEditorId = id;

    dom.editorEmpty.style.display = 'none';
    dom.editorForm.style.display = 'block';

    const idx = wg.sessions.indexOf(s);
    dom.editorTitle.textContent = `Session ${idx + 1}`;
    dom.answerWord.value = s.word;
    dom.cluesTextarea.value = s.clues.join('\n');
    dom.revealToggle.checked = s.revealMode === 'manual';

    // Answer mode tabs
    dom.answerModeTabs.querySelectorAll('.wg-mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === s.answerMode);
    });
    toggleAnswerMode(s.answerMode);

    // Distractor source
    dom.distractorAutoToggle.checked = s.distractorSource === 'auto';
    syncDistractorUI(s);

    // Images
    renderImagePreviews(s.images, s.id);

    renderSessionList(); // highlight active
}

function toggleAnswerMode(mode) {
    dom.choiceOptions.style.display = mode === 'choice' ? 'block' : 'none';
}

function syncDistractorUI(s) {
    const isAuto = s.distractorSource === 'auto';
    dom.autoHint.style.display = isAuto ? 'flex' : 'none';
    dom.manualDistr.style.display = isAuto ? 'none' : 'block';
    if (!isAuto) renderDistractorInputs(s.distractors);
}

function renderDistractorInputs(vals) {
    dom.distractorInputs.innerHTML = '';
    for (let i = 0; i < MAX_DISTRACTORS; i++) {
        const row = document.createElement('div');
        row.className = 'wg-distractor-row';
        row.innerHTML = `
            <span class="wg-distractor-row-num">${i + 1}</span>
            <input type="text" placeholder="Wrong option ${i + 1}" value="${escHtml(vals[i] || '')}"
                   autocomplete="off" spellcheck="false" data-idx="${i}">
        `;
        dom.distractorInputs.appendChild(row);
    }
}

function renderImagePreviews(images, sessionId) {
    dom.imagePreviews.innerHTML = '';
    images.forEach((dataUrl, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'wg-image-thumb';
        wrap.innerHTML = `
            <img src="${dataUrl}" alt="Clue image ${i + 1}">
            <button class="wg-image-thumb-remove" data-idx="${i}" title="Remove image">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        wrap.querySelector('.wg-image-thumb-remove').addEventListener('click', () => {
            const s = wg.sessions.find(x => x.id === sessionId);
            if (s) {
                s.images.splice(i, 1);
                saveSessions();
                renderImagePreviews(s.images, sessionId);
            }
        });
        dom.imagePreviews.appendChild(wrap);
    });
}

function addSession() {
    if (wg.sessions.length >= MAX_SESSIONS) return;
    const s = createSession();
    wg.sessions.push(s);
    saveSessions();
    renderSessionList();
    openEditor(s.id);
}

function deleteSession(id) {
    wg.sessions = wg.sessions.filter(s => s.id !== id);
    if (wg.activeEditorId === id) {
        wg.activeEditorId = null;
        dom.editorEmpty.style.display = '';
        dom.editorForm.style.display = 'none';
    }
    saveSessions();
    renderSessionList();
}

function saveCurrentSession() {
    const s = wg.sessions.find(x => x.id === wg.activeEditorId);
    if (!s) return;

    s.word = dom.answerWord.value.trim();
    s.clues = dom.cluesTextarea.value
        .split('\n')
        .map(l => l.replace(/^[•\-\*]\s*/, '').trim())
        .filter(Boolean);
    s.revealMode = dom.revealToggle.checked ? 'manual' : 'all';

    const activeTab = dom.answerModeTabs.querySelector('.wg-mode-tab.active');
    s.answerMode = activeTab ? activeTab.dataset.mode : 'choice';

    s.distractorSource = dom.distractorAutoToggle.checked ? 'auto' : 'manual';
    if (s.distractorSource === 'manual') {
        s.distractors = Array.from(dom.distractorInputs.querySelectorAll('input'))
            .map(inp => inp.value.trim());
    }

    saveSessions();
    renderSessionList();

    // Flash the save button
    dom.saveSessionBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
    setTimeout(() => {
        dom.saveSessionBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Session';
    }, 1400);
}

/* ── Image upload ── */
function handleImageUpload(files) {
    const s = wg.sessions.find(x => x.id === wg.activeEditorId);
    if (!s) return;
    const remaining = MAX_IMAGES - s.images.length;
    const toProcess = Array.from(files).slice(0, remaining);
    toProcess.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = e => {
            s.images.push(e.target.result);
            saveSessions();
            renderImagePreviews(s.images, s.id);
        };
        reader.readAsDataURL(file);
    });
}

/* ══════════════════════════════════════════════
   GAME ENGINE
══════════════════════════════════════════════ */

function startGame() {
    // Autosave first
    saveCurrentSession();

    const validSessions = wg.sessions.filter(s => s.word.trim());
    if (!validSessions.length) return;

    wg.currentGame.sessionIdx = 0;
    wg.currentGame.clueIdx = 0;
    wg.currentGame.answered = false;

    switchScreen(dom.gameScreen);
    renderGameSession();
}

function renderGameSession() {
    const sessions = wg.sessions.filter(s => s.word.trim());
    const idx = wg.currentGame.sessionIdx;
    const s = sessions[idx];
    if (!s) { showEndScreen(); return; }

    wg.currentGame.answered = false;
    wg.currentGame.clueIdx = 0;

    // Header
    dom.sessionCounter.textContent = `Session ${idx + 1} / ${sessions.length}`;
    const pct = ((idx) / sessions.length) * 100;
    dom.progressFill.style.width = pct + '%';
    dom.prevSessionBtn.disabled = idx === 0;
    dom.nextSessionBtn.disabled = idx >= sessions.length - 1;

    // Images
    dom.gameImages.innerHTML = '';
    s.images.forEach(src => {
        const div = document.createElement('div');
        div.className = 'wg-game-image-item';
        div.innerHTML = `<img src="${src}" alt="Clue image">`;
        dom.gameImages.appendChild(div);
    });

    // Clues
    dom.cluesList.innerHTML = '';
    dom.revealBtn.style.display = 'none';

    if (s.revealMode === 'all') {
        s.clues.forEach((clue, i) => addClueItem(clue, i));
    } else {
        // Show first clue, reveal button for the rest
        if (s.clues.length > 0) addClueItem(s.clues[0], 0);
        wg.currentGame.clueIdx = 1;
        updateRevealBtn(s);
    }

    // Answer area
    renderAnswerArea(s, sessions);
}

function addClueItem(text, idx) {
    const li = document.createElement('div');
    li.className = 'wg-clue-item';
    li.style.animationDelay = `${idx * 0.08}s`;
    li.innerHTML = `<span class="wg-clue-num">${idx + 1}</span><span>${escHtml(text)}</span>`;
    dom.cluesList.appendChild(li);
}

function updateRevealBtn(s) {
    const remaining = s.clues.length - wg.currentGame.clueIdx;
    if (remaining <= 0 || wg.currentGame.answered) {
        dom.revealBtn.style.display = 'none';
    } else {
        dom.revealBtn.style.display = 'inline-flex';
        dom.revealBtn.disabled = false;
        dom.revealBtn.innerHTML = `<i class="fa-solid fa-eye"></i> Reveal Clue ${wg.currentGame.clueIdx + 1} of ${s.clues.length}`;
    }
}

function revealNextClue() {
    const sessions = wg.sessions.filter(s => s.word.trim());
    const s = sessions[wg.currentGame.sessionIdx];
    if (!s || wg.currentGame.clueIdx >= s.clues.length) return;
    addClueItem(s.clues[wg.currentGame.clueIdx], wg.currentGame.clueIdx);
    wg.currentGame.clueIdx++;
    updateRevealBtn(s);
}

/* ── Answer area rendering ── */
function renderAnswerArea(s, allSessions) {
    dom.answerArea.innerHTML = '';

    if (s.answerMode === 'choice') {
        renderChoices(s, allSessions);
    } else if (s.answerMode === 'input-bar') {
        renderInputBar(s);
    } else {
        renderLetterBoxes(s);
    }
}

function buildChoicesArray(s, allSessions) {
    let wrong = [];
    if (s.distractorSource === 'auto') {
        wrong = allSessions
            .filter(x => x.id !== s.id && x.word.trim())
            .map(x => x.word.trim());
    } else {
        wrong = s.distractors.filter(d => d.trim());
    }
    // Shuffle wrong, pick up to 5
    wrong = shuffle(wrong).slice(0, 5);
    const choices = shuffle([s.word.trim(), ...wrong]);
    return choices.slice(0, 6); // max 6 total
}

function renderChoices(s, allSessions) {
    const choices = buildChoicesArray(s, allSessions);
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const grid = document.createElement('div');
    grid.className = 'wg-choices-grid';

    choices.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.className = 'wg-choice-btn';
        btn.innerHTML = `<span class="wg-choice-letter">${letters[i]}</span><span>${escHtml(c)}</span>`;
        btn.addEventListener('click', () => handleChoiceAnswer(c, s.word.trim(), btn, grid));
        grid.appendChild(btn);
    });

    dom.answerArea.appendChild(grid);
}

function handleChoiceAnswer(chosen, correct, btn, grid) {
    if (wg.currentGame.answered) return;
    wg.currentGame.answered = true;

    // Disable all
    grid.querySelectorAll('.wg-choice-btn').forEach(b => b.disabled = true);

    const isCorrect = normalise(chosen) === normalise(correct);
    btn.classList.add(isCorrect ? 'correct' : 'wrong');

    // If wrong, also highlight the correct one
    if (!isCorrect) {
        grid.querySelectorAll('.wg-choice-btn').forEach(b => {
            if (normalise(b.textContent.replace(/^[A-F]/, '').trim()) === normalise(correct)) {
                b.classList.add('correct');
            }
        });
    }

    showFeedback(isCorrect, correct);
}

function renderInputBar(s) {
    const wrap = document.createElement('div');
    wrap.className = 'wg-input-bar-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'wg-input-bar';
    input.placeholder = 'Type your answer…';
    input.autocomplete = 'off';
    input.spellcheck = false;

    const checkBtn = document.createElement('button');
    checkBtn.className = 'wg-check-btn';
    checkBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Check Answer';

    const check = () => {
        if (wg.currentGame.answered) return;
        const correct = normalise(s.word.trim());
        const given = normalise(input.value.trim());
        const ok = given === correct;
        wg.currentGame.answered = true;
        input.disabled = true;
        checkBtn.disabled = true;
        input.classList.add(ok ? 'correct' : 'wrong');
        showFeedback(ok, s.word.trim());
    };

    checkBtn.addEventListener('click', check);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });

    wrap.appendChild(input);
    wrap.appendChild(checkBtn);
    dom.answerArea.appendChild(wrap);
    setTimeout(() => input.focus(), 100);
}

function renderLetterBoxes(s) {
    const word = s.word.trim();
    if (!word) return;

    const wrap = document.createElement('div');
    wrap.className = 'wg-letter-boxes-wrap';
    const boxRow = document.createElement('div');
    boxRow.className = 'wg-letter-boxes';

    const boxes = [];

    word.split('').forEach((_, i) => {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.maxLength = 1;
        inp.className = 'wg-letter-box';
        inp.autocomplete = 'off';
        inp.spellcheck = false;
        inp.autocorrect = 'off';
        inp.setAttribute('aria-label', `Letter ${i + 1}`);

        inp.addEventListener('input', () => {
            inp.value = inp.value.replace(/[^a-zA-ZÀ-ÿ]/, '');
            if (inp.value.length === 1) {
                inp.classList.add('filled');
                if (i < boxes.length - 1) boxes[i + 1].focus();
            } else {
                inp.classList.remove('filled');
            }
        });

        inp.addEventListener('keydown', e => {
            if (e.key === 'Backspace' && !inp.value && i > 0) {
                boxes[i - 1].focus();
                boxes[i - 1].value = '';
                boxes[i - 1].classList.remove('filled');
            }
            if (e.key === 'Enter') checkBoxes();
        });

        boxes.push(inp);
        boxRow.appendChild(inp);
    });

    const checkBtn = document.createElement('button');
    checkBtn.className = 'wg-check-btn';
    checkBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Check Answer';

    function checkBoxes() {
        if (wg.currentGame.answered) return;
        const given = boxes.map(b => b.value).join('');
        const correct = s.word.trim();
        const ok = normalise(given) === normalise(correct);
        wg.currentGame.answered = true;
        boxes.forEach(b => { b.disabled = true; b.classList.add(ok ? 'correct' : 'wrong'); });
        checkBtn.disabled = true;
        showFeedback(ok, correct);
    }

    checkBtn.addEventListener('click', checkBoxes);
    wrap.appendChild(boxRow);
    wrap.appendChild(checkBtn);
    dom.answerArea.appendChild(wrap);
    setTimeout(() => { if (boxes.length) boxes[0].focus(); }, 100);
}

/* ── Feedback ── */
function showFeedback(isCorrect, word) {
    if (isCorrect) {
        playWinChime();
        burstConfetti();
    } else {
        playWrongBuzz();
    }

    dom.feedbackBadge.className = 'wg-feedback-badge ' + (isCorrect ? 'correct' : 'wrong');
    dom.feedbackBadge.innerHTML = `
        <span class="wg-feedback-icon">${isCorrect ? '🎉' : '❌'}</span>
        <span class="wg-feedback-label">${isCorrect ? 'Correct!' : 'Not quite!'}</span>
        ${!isCorrect ? `<span class="wg-feedback-word">Answer: <strong>${escHtml(word)}</strong></span>` : ''}
    `;
    dom.feedbackOverlay.classList.add('active');

    // Hide reveal btn on answer
    dom.revealBtn.style.display = 'none';

    setTimeout(() => {
        dom.feedbackOverlay.classList.remove('active');
        if (isCorrect) {
            advanceSession();
        }
    }, FEEDBACK_DURATION);
}

function advanceSession() {
    const sessions = wg.sessions.filter(s => s.word.trim());
    const next = wg.currentGame.sessionIdx + 1;
    if (next >= sessions.length) {
        // Complete progress
        dom.progressFill.style.width = '100%';
        showEndScreen();
    } else {
        wg.currentGame.sessionIdx = next;
        renderGameSession();
    }
}

function showEndScreen() {
    dom.endScreen.style.display = 'flex';
}

/* ── Confetti ── */
function burstConfetti() {
    const canvas = dom.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#f7b801', '#7678ed', '#22c55e', '#f35b04', '#90e0ef', '#fff'];
    const pieces = Array.from({ length: 28 }, () => ({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2 + (Math.random() - 0.5) * 120,
        vx: (Math.random() - 0.5) * 9,
        vy: -(Math.random() * 10 + 5),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 5,
        rot: Math.random() * 360,
        rotV: (Math.random() - 0.5) * 10,
        alpha: 1,
    }));

    let frame;
    const tick = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        pieces.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.35;      // gravity
            p.vx *= 0.98;
            p.rot += p.rotV;
            p.alpha -= 0.018;
            if (p.alpha <= 0) return;
            alive = true;
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            ctx.restore();
        });
        ctx.globalAlpha = 1;
        if (alive) frame = requestAnimationFrame(tick);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    cancelAnimationFrame(frame);
    tick();
}

/* ── Helpers ── */
function normalise(str) {
    return str.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function switchScreen(screen) {
    document.querySelectorAll('.wg-screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

/* ── Google Drive Sync ── */
let wgDriveService = null;
function initDriveService() {
    if (typeof window.GoogleDriveService !== 'function') return;
    wgDriveService = new window.GoogleDriveService({
        folderName: 'ESL Learning - Word Guesser',
        fileExtension: '.json',
        onSave: () => {
            saveCurrentSession(); // ensure latest is saved
            return wg.sessions;
        },
        onLoad: (data) => {
            if (Array.isArray(data)) {
                wg.sessions = data;
                saveSessions();
                renderSessionList();
                if (wg.sessions.length > 0) {
                    openEditor(wg.sessions[0].id);
                } else {
                    wg.activeEditorId = null;
                    dom.editorEmpty.style.display = 'flex';
                    dom.editorForm.style.display = 'none';
                }
            } else {
                console.error("WG: Invalid session data format from Drive");
            }
        }
    });
}

/* ══════════════════════════════════════════════
   EVENT LISTENERS
══════════════════════════════════════════════ */

// Add session
dom.addSessionBtn.addEventListener('click', addSession);

// Start game
dom.startGameBtn.addEventListener('click', startGame);

// Save session
dom.saveSessionBtn.addEventListener('click', saveCurrentSession);

// Delete session
dom.deleteSessionBtn.addEventListener('click', () => {
    if (wg.activeEditorId) deleteSession(wg.activeEditorId);
});

// Answer mode tabs
dom.answerModeTabs.addEventListener('click', e => {
    const tab = e.target.closest('.wg-mode-tab');
    if (!tab) return;
    dom.answerModeTabs.querySelectorAll('.wg-mode-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    toggleAnswerMode(tab.dataset.mode);
});

// Reveal toggle label hints
dom.revealToggle.addEventListener('change', () => {
    const s = wg.sessions.find(x => x.id === wg.activeEditorId);
    if (s) s.revealMode = dom.revealToggle.checked ? 'manual' : 'all';
});

// Distractor auto toggle
dom.distractorAutoToggle.addEventListener('change', () => {
    const s = wg.sessions.find(x => x.id === wg.activeEditorId);
    if (!s) return;
    s.distractorSource = dom.distractorAutoToggle.checked ? 'auto' : 'manual';
    syncDistractorUI(s);
});

// Image upload
dom.imageUploadInput.addEventListener('change', e => {
    handleImageUpload(e.target.files);
    e.target.value = '';
});

// Game: back to settings
dom.backToSettings.addEventListener('click', () => switchScreen(dom.settingsScreen));

// Game: prev/next session
dom.prevSessionBtn.addEventListener('click', () => {
    if (wg.currentGame.sessionIdx > 0) {
        wg.currentGame.sessionIdx--;
        renderGameSession();
    }
});
dom.nextSessionBtn.addEventListener('click', () => {
    const sessions = wg.sessions.filter(s => s.word.trim());
    if (wg.currentGame.sessionIdx < sessions.length - 1) {
        wg.currentGame.sessionIdx++;
        renderGameSession();
    }
});

// Game: reveal next clue
dom.revealBtn.addEventListener('click', revealNextClue);

// End screen
dom.restartGameBtn.addEventListener('click', () => {
    dom.endScreen.style.display = 'none';
    startGame();
});
dom.endBackSettings.addEventListener('click', () => {
    dom.endScreen.style.display = 'none';
    switchScreen(dom.settingsScreen);
});

// Unlock audio on first interaction
document.addEventListener('pointerdown', () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume();
}, { once: true });

// Sidebar Toggle
if (dom.sidebarToggle) {
    dom.sidebarToggle.addEventListener('click', () => {
        const layout = document.querySelector('.wg-settings-layout');
        if (layout) layout.classList.toggle('sidebar-collapsed');
    });
}

// Drive Sync
if (dom.driveSyncBtn) {
    dom.driveSyncBtn.addEventListener('click', () => {
        if (wgDriveService) wgDriveService.openModal();
    });
}

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
initDriveService();
loadSessions();
renderSessionList();

// If there are saved sessions, open the first one
if (wg.sessions.length > 0) {
    openEditor(wg.sessions[0].id);
}
