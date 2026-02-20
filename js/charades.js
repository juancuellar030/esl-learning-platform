// ==========================================
// CHARADES GAME LOGIC
// ESL Learning Platform
// ==========================================

(function () {
    'use strict';

    // === STATE ===
    const GAME_DURATION = 60; // seconds
    let state = {
        screen: 'hub',        // hub | playing | results
        language: 'en',       // en | es
        inputMode: 'swipe',   // swipe | tilt
        selectedCategory: null,
        words: [],
        currentIndex: 0,
        score: 0,
        results: [],          // { word, spanish, result: 'correct' | 'skipped' }
        timer: GAME_DURATION,
        timerInterval: null,
    };

    // === DOM REFS ===
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // === SOUND EFFECTS (Web Audio API) ===
    let audioCtx = null;
    function getAudioCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    function playCorrectSound() {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
    }

    function playSkipSound() {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    }

    function playTickSound() {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.08);
    }

    function playEndSound() {
        const ctx = getAudioCtx();
        [0, 0.15, 0.3].forEach((delay, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime([523, 440, 330][i], ctx.currentTime + delay);
            gain.gain.setValueAtTime(0.25, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.35);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.35);
        });
    }

    // === INIT ===
    function init() {
        renderCategoryHub();
        setupLanguageToggle();
        setupKeyboardControls();
        setupTouchControls();
        setupTiltControls();
    }

    // === FULLSCREEN ===
    function enterFullscreen() {
        const el = document.documentElement;
        const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        if (rfs) {
            rfs.call(el).catch(() => { });
        }
    }

    function exitFullscreen() {
        const efs = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
        if (efs && (document.fullscreenElement || document.webkitFullscreenElement)) {
            efs.call(document).catch(() => { });
        }
    }

    // === RENDER CATEGORY HUB ===
    function renderCategoryHub() {
        const categories = window.getAllCharadesCategories();
        const grid = $('#charades-vocab-grid');
        const funGrid = $('#charades-fun-grid');
        if (!grid || !funGrid) return;

        grid.innerHTML = '';
        funGrid.innerHTML = '';

        const vocabKeys = [
            'animals', 'food', 'body', 'clothes', 'sports',
            'weather', 'places', 'transport', 'daily-routines',
            'arts', 'shapes', 'movement', 'classroom-language'
        ];
        const funKeys = [
            'movies-characters', 'countries', 'food-snacks',
            'superheroes-villains', 'sports-activities', 'cartoons',
            'video-game-characters', 'silly-actions', 'emojis-emotions'
        ];

        for (const key of vocabKeys) {
            const cat = categories[key];
            if (cat) grid.appendChild(createCategoryCard(key, cat));
        }

        for (const key of funKeys) {
            const cat = categories[key];
            if (cat) funGrid.appendChild(createCategoryCard(key, cat));
        }
    }

    function createCategoryCard(key, cat) {
        const card = document.createElement('div');
        card.className = 'charades-cat-card';
        card.dataset.category = key;
        card.style.setProperty('--cat-color', cat.color);
        card.style.setProperty('--stripe', cat.color);
        card.innerHTML = `
            <div class="charades-cat-icon" style="color: ${cat.color}">
                <i class="${cat.icon}"></i>
            </div>
            <div class="charades-cat-label">${state.language === 'en' ? cat.label : cat.labelEs}</div>
            <div class="charades-cat-count">${cat.words.length} words</div>
        `;
        card.addEventListener('click', () => startGame(key));
        return card;
    }

    // === LANGUAGE TOGGLE ===
    function setupLanguageToggle() {
        const toggle = $('#charades-lang-switch');
        if (!toggle) return;
        toggle.addEventListener('change', () => {
            state.language = toggle.checked ? 'es' : 'en';
            updateLanguageLabels();
            renderCategoryHub();
        });
    }

    function updateLanguageLabels() {
        const enLabel = $('#charades-lang-en');
        const esLabel = $('#charades-lang-es');
        if (enLabel) enLabel.classList.toggle('active-lang', state.language === 'en');
        if (esLabel) esLabel.classList.toggle('active-lang', state.language === 'es');
    }

    // === START GAME ===
    function startGame(categoryKey) {
        const categories = window.getAllCharadesCategories();
        const cat = categories[categoryKey];
        if (!cat) return;

        state.selectedCategory = cat;
        state.words = shuffle([...cat.words]);
        state.currentIndex = 0;
        state.score = 0;
        state.results = [];
        state.timer = GAME_DURATION;
        state.screen = 'playing';

        enterFullscreen();
        showGameScreen();
        showCountdown(() => {
            displayCurrentWord();
            startTimer();
        });
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // === COUNTDOWN ===
    function showCountdown(callback) {
        const overlay = $('#charades-countdown');
        const num = $('#charades-countdown-num');
        overlay.classList.remove('charades-screen-hidden');
        let count = 3;
        num.textContent = count;

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                num.textContent = count;
                num.style.animation = 'none';
                void num.offsetWidth;
                num.style.animation = '';
            } else {
                clearInterval(interval);
                overlay.classList.add('charades-screen-hidden');
                callback();
            }
        }, 800);
    }

    // === GAME SCREEN ===
    function showGameScreen() {
        $('#charades-hub').classList.add('charades-screen-hidden');
        $('#charades-game').classList.remove('charades-screen-hidden');
        $('#charades-results').classList.add('charades-screen-hidden');

        const catLabel = $('#charades-game-category');
        if (catLabel) {
            catLabel.textContent = state.language === 'en'
                ? state.selectedCategory.label
                : state.selectedCategory.labelEs;
        }
        updateScoreDisplay();
    }

    function displayCurrentWord() {
        const wordEl = $('#charades-current-word');
        if (!wordEl) return;

        if (state.currentIndex >= state.words.length) {
            // Ran out of words, recycle
            state.words = shuffle([...state.words]);
            state.currentIndex = 0;
        }

        const entry = state.words[state.currentIndex];
        const text = state.language === 'en' ? entry.word : entry.spanish;

        wordEl.classList.add('enter');
        setTimeout(() => {
            wordEl.textContent = text;
            wordEl.classList.remove('enter', 'exit-up', 'exit-down');
        }, 150);
    }

    function updateScoreDisplay() {
        const scoreEl = $('#charades-score');
        if (scoreEl) scoreEl.textContent = state.score;
    }

    // === TIMER ===
    function startTimer() {
        const timerText = $('#charades-timer-text');
        const ringProgress = $('#charades-ring-progress');
        const circumference = 2 * Math.PI * 28; // r=28
        ringProgress.style.strokeDasharray = circumference;

        updateTimerDisplay(timerText, ringProgress, circumference);

        state.timerInterval = setInterval(() => {
            state.timer--;
            updateTimerDisplay(timerText, ringProgress, circumference);

            // Tick sound for last 5 seconds
            if (state.timer > 0 && state.timer <= 5) {
                playTickSound();
            }

            if (state.timer <= 0) {
                clearInterval(state.timerInterval);
                playEndSound();
                endGame();
            }
        }, 1000);
    }

    function updateTimerDisplay(textEl, ringEl, circumference) {
        textEl.textContent = state.timer;
        const progress = state.timer / GAME_DURATION;
        ringEl.style.strokeDashoffset = circumference * (1 - progress);

        if (state.timer <= 10) {
            ringEl.classList.add('urgent');
        } else {
            ringEl.classList.remove('urgent');
        }
    }

    // === ACTIONS ===
    function markCorrect() {
        if (state.screen !== 'playing') return;
        const entry = state.words[state.currentIndex];
        state.results.push({ word: entry.word, spanish: entry.spanish, result: 'correct' });
        state.score++;
        updateScoreDisplay();
        playCorrectSound();
        showFlash('correct');
        transitionWord('exit-down');
    }

    function markSkip() {
        if (state.screen !== 'playing') return;
        const entry = state.words[state.currentIndex];
        state.results.push({ word: entry.word, spanish: entry.spanish, result: 'skipped' });
        playSkipSound();
        showFlash('skip');
        transitionWord('exit-up');
    }

    function transitionWord(exitClass) {
        const wordEl = $('#charades-current-word');
        wordEl.classList.add(exitClass);
        setTimeout(() => {
            state.currentIndex++;
            displayCurrentWord();
        }, 200);
    }

    function showFlash(type) {
        const flash = $('#charades-flash');
        const icon = $('#charades-flash-icon');

        flash.className = 'charades-flash show ' + type;
        icon.className = 'charades-flash-icon fa-solid ' +
            (type === 'correct' ? 'fa-check' : 'fa-xmark');

        setTimeout(() => {
            flash.classList.remove('show');
        }, 350);
    }

    // === KEYBOARD CONTROLS ===
    function setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            if (state.screen !== 'playing') return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                markCorrect();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                markSkip();
            }
        });
    }

    // === TOUCH / SWIPE CONTROLS ===
    function setupTouchControls() {
        let touchStartY = 0;
        let touchStartX = 0;

        document.addEventListener('touchstart', (e) => {
            if (state.screen !== 'playing') return;
            getAudioCtx(); // Resume audio context on first touch (iOS)
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            // Only handle swipe when in swipe mode
            if (state.screen !== 'playing' || state.inputMode !== 'swipe') return;
            const deltaY = e.changedTouches[0].clientY - touchStartY;
            const deltaX = e.changedTouches[0].clientX - touchStartX;
            const absDeltaY = Math.abs(deltaY);
            const absDeltaX = Math.abs(deltaX);

            if (Math.max(absDeltaY, absDeltaX) < 40) return;

            if (absDeltaY > absDeltaX) {
                if (deltaY < 0) markSkip();
                else markCorrect();
            }
        }, { passive: true });
    }

    // === TILT / DEVICE ORIENTATION CONTROLS ===
    // In LANDSCAPE mode:
    //   gamma = forward/back tilt of the phone (the axis we want)
    //   beta  = left/right lean (NOT what we want — this was the previous bug)
    //
    // gamma conventions when phone is landscape:
    //   ~0°  = flat on table
    //   negative = top of phone tilts AWAY from user (forward/down) → SKIP
    //   positive = top of phone tilts TOWARD user (backward/up)     → CORRECT
    //
    // We also check screen.orientation / window.orientation to confirm landscape.
    function setupTiltControls() {
        const TILT_THRESHOLD = 25;  // degrees — lower threshold for easier triggering
        const COOLDOWN_MS = 800;

        const requestAndAttach = () => {
            if (typeof DeviceOrientationEvent !== 'undefined' &&
                typeof DeviceOrientationEvent.requestPermission === 'function') {
                // iOS 13+ — must be triggered by a user gesture
                DeviceOrientationEvent.requestPermission()
                    .then(r => { if (r === 'granted') attachTiltListener(); })
                    .catch(() => { });
            } else if (typeof DeviceOrientationEvent !== 'undefined') {
                attachTiltListener();
            }
        };

        // Hook into first touch so iOS permission dialog appears during user gesture
        document.addEventListener('touchstart', requestAndAttach, { once: true });

        function attachTiltListener() {
            let cooldownActive = false;

            window.addEventListener('deviceorientation', (e) => {
                if (state.screen !== 'playing' || state.inputMode !== 'tilt' || cooldownActive) return;
                if (e.gamma === null || e.gamma === undefined) return;

                // gamma is the correct axis for landscape forward/back tilt
                const gamma = e.gamma;

                if (gamma < -TILT_THRESHOLD) {
                    // Top of phone tilted away from user = tilt down/forward = Skip
                    cooldownActive = true;
                    markSkip();
                    setTimeout(() => { cooldownActive = false; }, COOLDOWN_MS);
                } else if (gamma > TILT_THRESHOLD) {
                    // Top of phone tilted toward user = tilt back/up = Correct
                    cooldownActive = true;
                    markCorrect();
                    setTimeout(() => { cooldownActive = false; }, COOLDOWN_MS);
                }
            }, true);
        }
    }

    // === INPUT MODE TOGGLE ===
    function toggleInputMode() {
        state.inputMode = state.inputMode === 'swipe' ? 'tilt' : 'swipe';
        updateInputToggleUI();
    }

    function updateInputToggleUI() {
        const btn = $('#charades-input-toggle');
        const skipHint = document.querySelector('.charades-hint.skip-hint');
        const correctHint = document.querySelector('.charades-hint.correct-hint');

        if (btn) {
            if (state.inputMode === 'tilt') {
                btn.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i> Tilt';
                btn.classList.add('tilt-active');
            } else {
                btn.innerHTML = '<i class="fa-solid fa-hand-point-up"></i> Swipe';
                btn.classList.remove('tilt-active');
            }
        }

        if (skipHint) {
            skipHint.innerHTML = state.inputMode === 'tilt'
                ? '<i class="fa-solid fa-rotate-left"></i> Tilt Forward = Skip'
                : '<i class="fa-solid fa-arrow-up"></i> Swipe Up = Skip';
        }
        if (correctHint) {
            correctHint.innerHTML = state.inputMode === 'tilt'
                ? '<i class="fa-solid fa-rotate-right"></i> Tilt Back = Correct'
                : '<i class="fa-solid fa-arrow-down"></i> Swipe Down = Correct';
        }
    }

    function endGame() {
        state.screen = 'results';
        clearInterval(state.timerInterval);

        $('#charades-game').classList.add('charades-screen-hidden');
        $('#charades-results').classList.remove('charades-screen-hidden');

        const totalWords = state.results.length;
        const correctCount = state.results.filter(r => r.result === 'correct').length;

        $('#charades-final-score').textContent = correctCount;
        $('#charades-final-total').textContent = `/ ${totalWords}`;
        $('#charades-results-subtitle').textContent =
            correctCount >= 10 ? '🎉 Amazing job!' :
                correctCount >= 5 ? '👏 Great effort!' :
                    '💪 Keep practicing!';

        // Render word list
        const listEl = $('#charades-results-list');
        listEl.innerHTML = '';
        for (const item of state.results) {
            const div = document.createElement('div');
            div.className = 'charades-word-item ' +
                (item.result === 'correct' ? 'correct-word' : 'skipped-word');
            const displayWord = state.language === 'en' ? item.word : item.spanish;
            div.innerHTML = `
                <i class="fa-solid ${item.result === 'correct' ? 'fa-check' : 'fa-xmark'}"></i>
                <span>${displayWord}</span>
            `;
            listEl.appendChild(div);
        }
    }

    // === BACK / PLAY AGAIN ===
    function goToHub() {
        state.screen = 'hub';
        clearInterval(state.timerInterval);
        exitFullscreen();

        $('#charades-game').classList.add('charades-screen-hidden');
        $('#charades-results').classList.add('charades-screen-hidden');
        $('#charades-countdown').classList.add('charades-screen-hidden');
        $('#charades-hub').classList.remove('charades-screen-hidden');
    }

    // Expose for inline event handlers
    window.charadesGoToHub = goToHub;
    window.charadesToggleInput = toggleInputMode;
    window.charadesPlayAgain = function () {
        if (state.selectedCategory) {
            // Find the key from the category
            const categories = window.getAllCharadesCategories();
            for (const [key, cat] of Object.entries(categories)) {
                if (cat.label === state.selectedCategory.label) {
                    startGame(key);
                    return;
                }
            }
        }
        goToHub();
    };

    // === BOOT ===
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
