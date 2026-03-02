/**
 * Quiz Game — Core Logic
 * ESL Learning Platform
 * Handles both Host and Player flows, question generation,
 * real-time game state, scoring, and UI rendering.
 */

const QuizGame = (() => {
    // ===== STATE =====
    let role = null; // 'host' | 'player'
    let gameCode = null;
    let playerName = null;
    let config = {};
    let questions = [];
    let currentQ = -1;
    let timerInterval = null;
    let timeLeft = 0;
    let listeners = [];

    // Host state
    let players = {};
    let answerCounts = [0, 0, 0, 0];
    let isAdvancing = false; // Guard flag to prevent re-entrant revealAnswer

    // Player state
    let myScore = 0;
    let myStreak = 0;
    let hasAnswered = false;
    let selectedAvatar = null;

    let sourceMode = 'vocab'; // 'vocab' | 'custom'
    let gameMode = 'automatic'; // 'automatic' | 'student-paced' | 'teacher-paced'
    let customRows = [];

    // Avatar library — 32 animal photos
    const AVATAR_COUNT = 32;
    const AVATAR_PATH = 'assets/images/live-quiz-avatars/';
    function getAvatarSrc(index) {
        return AVATAR_PATH + 'animal_' + index + '.png';
    }

    // Sound
    let audioCtx = null;
    let soundEnabled = true;

    // ===== DOM REFS =====
    const $ = id => document.getElementById(id);

    // ===== INITIALIZATION =====
    function init() {
        loadQuizTheme();
        FirebaseService.init().then(() => {
            bindEvents();
            populateCategories();
            initAvatarGrids();
            addCustomRows(4);
        });
    }

    function bindEvents() {
        $('btn-role-host').addEventListener('click', () => showScreen('screen-setup'));
        $('btn-role-join').addEventListener('click', () => showScreen('screen-join'));
        $('btn-setup-back').addEventListener('click', () => showScreen('screen-role'));
        $('btn-join-back').addEventListener('click', () => showScreen('screen-role'));
        $('btn-create-game').addEventListener('click', createGame);
        $('btn-join-next').addEventListener('click', joinStep1);
        $('btn-avatar-back').addEventListener('click', () => showScreen('screen-join'));
        $('btn-join-game').addEventListener('click', joinStep2);
        $('btn-lobby-cancel').addEventListener('click', cancelLobby);
        $('btn-start-game').addEventListener('click', startCountdown);
        $('btn-play-again').addEventListener('click', playAgain);
        $('btn-new-game').addEventListener('click', () => { cleanup(); showScreen('screen-role'); });
        $('btn-change-avatar').addEventListener('click', toggleWaitingAvatars);
        $('btn-close-avatar-modal').addEventListener('click', toggleWaitingAvatars);
        $('btn-save-avatar').addEventListener('click', toggleWaitingAvatars);
        $('btn-random-avatar').addEventListener('click', randomizeAvatar);

        // Global End Game button for Host — single listener only
        const btnGlobalEnd = $('btn-global-end-game');
        if (btnGlobalEnd) {
            btnGlobalEnd.addEventListener('click', () => {
                if (confirm('Are you sure you want to end the game for everyone right now?')) {
                    endGame();
                }
            });
        }

        // Steppers
        $('q-minus').addEventListener('click', () => adjustStepper('q-count', -5, 5, 50));
        $('q-plus').addEventListener('click', () => adjustStepper('q-count', 5, 5, 50));
        $('t-minus').addEventListener('click', () => adjustStepper('t-count', -5, 5, 60));
        $('t-plus').addEventListener('click', () => adjustStepper('t-count', 5, 5, 60));

        // Level buttons
        document.querySelectorAll('.qg-level-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.qg-level-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Answer buttons
        document.querySelectorAll('.qg-answer-btn').forEach(btn => {
            btn.addEventListener('click', () => selectAnswer(parseInt(btn.dataset.index)));
        });

        // Join code uppercase
        $('join-code').addEventListener('input', e => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });

        // Source mode toggle
        document.querySelectorAll('.qg-source-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.qg-source-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                sourceMode = btn.dataset.source;
                $('vocab-mode').classList.toggle('qg-hidden', sourceMode !== 'vocab');
                $('custom-mode').classList.toggle('qg-hidden', sourceMode !== 'custom');
            });
        });

        // Custom quiz: add row button
        $('btn-add-row').addEventListener('click', () => addCustomRows(1));

        // Game mode toggle
        document.querySelectorAll('.qg-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.qg-mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                gameMode = btn.dataset.mode;

                // Disable shuffle for teacher-paced
                const shuffleCheckbox = $('opt-shuffle');
                const shuffleLabel = shuffleCheckbox.closest('.qg-toggle-option');
                if (gameMode === 'teacher-paced') {
                    shuffleCheckbox.checked = false;
                    shuffleCheckbox.disabled = true;
                    shuffleLabel.style.opacity = '0.4';
                    shuffleLabel.style.pointerEvents = 'none';
                } else {
                    shuffleCheckbox.disabled = false;
                    shuffleLabel.style.opacity = '';
                    shuffleLabel.style.pointerEvents = '';
                }
            });
        });

        // Teacher-paced: Next Question
        $('btn-next-question').addEventListener('click', teacherNextQuestion);

        // Note: Global End Game listener is already bound above (lines 77-85) — no duplicate needed here.

        // Rejoin from Booted screen
        $('btn-rejoin-game').addEventListener('click', () => {
            // Pre-fill the last known code if available
            const savedCode = sessionStorage.getItem('qg-last-code');
            cleanup();
            if (savedCode) $('join-code').value = savedCode;
            showScreen('screen-join');
        });

        // Lobby theme swatch buttons
        document.querySelectorAll('.qg-theme-swatch').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                const isDark = $('quiz-app').classList.contains('qg-dark');
                applyQuizTheme(theme, isDark);
            });
        });

        // Lobby dark mode toggle
        const darkToggle = $('qg-lobby-dark-toggle');
        if (darkToggle) {
            darkToggle.addEventListener('click', () => {
                const app = $('quiz-app');
                const isDark = app.classList.contains('qg-dark');
                const currentTheme = app.dataset.theme || 'default';
                applyQuizTheme(currentTheme, !isDark);
            });
        }
    }

    function adjustStepper(id, delta, min, max) {
        const el = $(id);
        let val = parseInt(el.textContent) + delta;
        val = Math.max(min, Math.min(max, val));
        el.textContent = val;
    }

    // ===== CATEGORIES =====
    function populateCategories() {
        const cats = {};
        (window.vocabularyBank || []).forEach(w => {
            if (!cats[w.category]) cats[w.category] = 0;
            cats[w.category]++;
        });
        const container = $('category-chips');
        container.innerHTML = '';

        // "All" chip
        const allChip = document.createElement('button');
        allChip.className = 'qg-cat-chip selected';
        allChip.textContent = `All (${window.vocabularyBank ? window.vocabularyBank.length : 0})`;
        allChip.dataset.cat = 'all';
        allChip.addEventListener('click', () => {
            document.querySelectorAll('.qg-cat-chip').forEach(c => c.classList.remove('selected'));
            allChip.classList.add('selected');
        });
        container.appendChild(allChip);

        const catNames = {
            'animals': '🐾 Animals', 'colors': '🎨 Colors', 'food': '🍕 Food',
            'body': '🦴 Body', 'clothes': '👕 Clothes', 'daily-routines': '🌅 Routines',
            'sports': '⚽ Sports', 'weather': '🌤️ Weather', 'places': '📍 Places',
            'transport': '🚗 Transport', 'arts': '🎭 Arts', 'grammar-words': '❓ Questions',
            'time': '📅 Time', 'classroom-language': '🏫 Classroom', 'shapes': '🔷 Shapes',
            'directions': '🧭 Directions', 'movement': '🏃 Movement', 'numbers': '🔢 Numbers',
            'feedback': '⭐ Feedback', 'connectors': '🔗 Connectors',
            'discourse-markers': '💬 Discourse', 'indefinite-pronouns': '👤 Pronouns',
            'verbs-past': '📖 Past Verbs', 'modal-verbs': '💡 Modals',
            'personal-pronouns': '👥 Pronouns', 'classroom-questions': '✋ Class Q\'s'
        };

        Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
            const chip = document.createElement('button');
            chip.className = 'qg-cat-chip';
            chip.textContent = (catNames[cat] || cat) + ` (${count})`;
            chip.dataset.cat = cat;
            chip.addEventListener('click', () => {
                // Deselect "All" when selecting specific
                document.querySelector('.qg-cat-chip[data-cat="all"]').classList.remove('selected');
                chip.classList.toggle('selected');
                // If none selected, select "All"
                if (!document.querySelector('.qg-cat-chip.selected')) {
                    allChip.classList.add('selected');
                }
            });
            container.appendChild(chip);
        });
    }

    // ===== CUSTOM QUIZ BUILDER =====
    function addCustomRows(count) {
        const list = $('custom-list');
        for (let i = 0; i < count; i++) {
            const rowId = 'cq-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
            const rowData = { id: rowId, word: '', clue: '', imageData: null, audioData: null, imageName: '', audioName: '' };
            customRows.push(rowData);
            renderCustomRow(list, rowData, customRows.length);
        }
    }

    function renderCustomRow(container, rowData, num) {
        const row = document.createElement('div');
        row.className = 'qg-custom-row';
        row.id = rowData.id;
        row.innerHTML = `
            <span class="qg-custom-row-num">Q${num}</span>
            <div class="qg-custom-inputs">
                <input type="text" class="cq-word" placeholder="Word / Concept" maxlength="60">
                <input type="text" class="cq-clue" placeholder="Clue / Definition" maxlength="150">
            </div>
            <div class="qg-custom-media">
                <button class="qg-media-btn cq-img-btn" type="button">
                    <i class="fa-solid fa-image"></i> <span class="file-name">Image</span>
                </button>
                <input type="file" class="cq-img-input" accept="image/*">
                <button class="qg-media-btn cq-audio-btn" type="button">
                    <i class="fa-solid fa-volume-high"></i> <span class="file-name">Audio</span>
                </button>
                <input type="file" class="cq-audio-input" accept="audio/*">
                <button class="qg-custom-remove" title="Remove" type="button">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;

        // Bind events
        row.querySelector('.cq-word').addEventListener('input', e => { rowData.word = e.target.value; });
        row.querySelector('.cq-clue').addEventListener('input', e => { rowData.clue = e.target.value; });

        // Image upload
        const imgBtn = row.querySelector('.cq-img-btn');
        const imgInput = row.querySelector('.cq-img-input');
        imgBtn.addEventListener('click', () => imgInput.click());
        imgInput.addEventListener('change', () => {
            const file = imgInput.files[0];
            if (file) {
                rowData.imageName = file.name;
                imgBtn.classList.add('has-file');
                imgBtn.querySelector('.file-name').textContent = file.name.length > 12 ? file.name.slice(0, 10) + '…' : file.name;
                const reader = new FileReader();
                reader.onload = e => { rowData.imageData = e.target.result; };
                reader.readAsDataURL(file);
            }
        });

        // Audio upload
        const audioBtn = row.querySelector('.cq-audio-btn');
        const audioInput = row.querySelector('.cq-audio-input');
        audioBtn.addEventListener('click', () => audioInput.click());
        audioInput.addEventListener('change', () => {
            const file = audioInput.files[0];
            if (file) {
                rowData.audioName = file.name;
                audioBtn.classList.add('has-file');
                audioBtn.querySelector('.file-name').textContent = file.name.length > 12 ? file.name.slice(0, 10) + '…' : file.name;
                const reader = new FileReader();
                reader.onload = e => { rowData.audioData = e.target.result; };
                reader.readAsDataURL(file);
            }
        });

        // Remove row
        row.querySelector('.qg-custom-remove').addEventListener('click', () => {
            customRows = customRows.filter(r => r.id !== rowData.id);
            row.remove();
            renumberCustomRows();
        });

        container.appendChild(row);
    }

    function renumberCustomRows() {
        document.querySelectorAll('.qg-custom-row .qg-custom-row-num').forEach((el, i) => {
            el.textContent = 'Q' + (i + 1);
        });
    }

    function generateCustomQuestions() {
        const validRows = customRows.filter(r => r.word.trim() && r.clue.trim());

        if (validRows.length < 2) {
            alert('Please add at least 2 questions with both a word and clue.');
            return null;
        }

        const qs = [];

        for (let i = 0; i < validRows.length; i++) {
            const item = validRows[i];
            // Get distractors from other custom rows
            const distractors = validRows.filter((r, idx) => idx !== i);
            shuffle(distractors);
            const picks = distractors.slice(0, Math.min(3, distractors.length));

            // Fill remaining distractors if < 3 available
            while (picks.length < 3) {
                picks.push({ word: '—', clue: '(no option)' });
            }

            const type = Math.random() < 0.5 ? 'word-to-clue' : 'clue-to-word';
            let questionText, optionsList;

            if (type === 'word-to-clue') {
                questionText = `What does "${item.word.trim()}" mean?`;
                optionsList = [item.clue.trim(), ...picks.map(p => p.clue.trim())];
            } else {
                questionText = item.clue.trim();
                optionsList = [item.word.trim(), ...picks.map(p => p.word.trim())];
            }

            const shuffledOpts = optionsList.map((opt, idx) => ({ opt, isCorrect: idx === 0 }));
            shuffle(shuffledOpts);

            qs.push({
                text: questionText,
                options: shuffledOpts.map(s => s.opt),
                correctIndex: shuffledOpts.findIndex(s => s.isCorrect),
                word: item.word.trim(),
                imageData: item.imageData || null,
                audioData: item.audioData || null
            });
        }

        return qs;
    }

    // ===== AVATAR SYSTEM =====
    function initAvatarGrids() {
        populateAvatarGrid('avatar-grid-select');
        populateAvatarGrid('avatar-grid-waiting');
    }

    function populateAvatarGrid(containerId) {
        const container = $(containerId);
        if (!container) return;
        container.innerHTML = '';

        for (let i = 1; i <= AVATAR_COUNT; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'qg-avatar-option';
            btn.dataset.avatar = 'animal_' + i;
            btn.innerHTML = `<img src="${getAvatarSrc(i)}" alt="Animal ${i}" loading="lazy">`;
            btn.addEventListener('click', () => selectAvatar('animal_' + i));
            container.appendChild(btn);
        }
    }

    function selectAvatar(avatarId) {
        selectedAvatar = avatarId;

        // Sync selection across all grids
        document.querySelectorAll('.qg-avatar-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.avatar === avatarId);
        });

        // Update waiting screen avatar display
        const waitingAvatar = $('waiting-avatar');
        if (waitingAvatar) {
            const idx = parseInt(avatarId.replace('animal_', ''));
            waitingAvatar.innerHTML = `<img src="${getAvatarSrc(idx)}" alt="Your avatar">`;
        }

        // Update Firebase if in session
        if (gameCode && !FirebaseService.isDemo()) {
            FirebaseService.updateSessionField(gameCode, 'players/' + FirebaseService.getUid() + '/avatar', avatarId);
        }

        playSound('click');
    }

    function toggleWaitingAvatars() {
        const modal = $('overlay-avatar-modal');
        modal.classList.toggle('active');
        playSound('click');
    }

    function randomizeAvatar() {
        const options = Array.from(document.querySelectorAll('#avatar-grid-waiting .qg-avatar-option'));
        if (options.length === 0) return;

        // Disable UI
        $('btn-random-avatar').disabled = true;
        $('btn-save-avatar').disabled = true;
        $('btn-close-avatar-modal').style.pointerEvents = 'none';

        let jumps = 0;
        const maxJumps = 20 + Math.floor(Math.random() * 10);
        const intervalTime = 70;

        playSound('click');

        const jumpInterval = setInterval(() => {
            options.forEach(opt => opt.classList.remove('selected'));
            const randomIndex = Math.floor(Math.random() * options.length);
            options[randomIndex].classList.add('selected');

            jumps++;
            if (jumps >= maxJumps) {
                clearInterval(jumpInterval);
                const finalId = options[randomIndex].dataset.avatar;

                // Invoke full selection to save changes automatically and sync images
                selectAvatar(finalId);

                $('btn-random-avatar').disabled = false;
                $('btn-save-avatar').disabled = false;
                $('btn-close-avatar-modal').style.pointerEvents = '';
            }
        }, intervalTime);
    }

    // ===== QUESTION GENERATION =====
    function generateQuestions(selectedCats, level, count) {
        let pool = [...(window.vocabularyBank || [])];

        // Filter by categories
        if (!selectedCats.includes('all')) {
            pool = pool.filter(w => selectedCats.includes(w.category));
        }

        // Filter by level
        if (level !== 'all') {
            pool = pool.filter(w => w.level === level);
        }

        // Filter to words with definitions (needed for questions)
        pool = pool.filter(w => w.definition && w.word);

        if (pool.length < 4) {
            alert('Not enough vocabulary words for a quiz. Please select more categories.');
            return null;
        }

        // Shuffle pool only if shuffle enabled — otherwise keep natural order
        if (config.shuffle) shuffle(pool);

        const qs = [];
        const usedWords = new Set();

        for (let i = 0; i < count && i < pool.length; i++) {
            const word = pool[i];
            if (usedWords.has(word.word)) continue;
            usedWords.add(word.word);

            // Pick question type
            const type = Math.random() < 0.5 ? 'def-to-word' : 'word-to-def';

            // Get distractors from same category preferably
            let distractorPool = pool.filter(w => w.id !== word.id && !usedWords.has(w.word));
            if (distractorPool.length < 3) {
                distractorPool = (window.vocabularyBank || []).filter(w => w.id !== word.id);
            }
            shuffle(distractorPool);
            const distractors = distractorPool.slice(0, 3);

            let questionText, options, correctIndex;

            if (type === 'def-to-word') {
                questionText = `Which word means: "${word.definition}"?`;
                options = [word, ...distractors].map(w => w.word);
                correctIndex = 0;
            } else {
                questionText = `What does "${word.word}" mean?`;
                options = [word, ...distractors].map(w => w.definition);
                correctIndex = 0;
            }

            // Shuffle options and track correct
            const shuffled = options.map((opt, idx) => ({ opt, isCorrect: idx === 0 }));
            shuffle(shuffled);
            correctIndex = shuffled.findIndex(s => s.isCorrect);

            qs.push({
                text: questionText,
                options: shuffled.map(s => s.opt),
                correctIndex: correctIndex,
                word: word.word,
                category: word.category
            });
        }

        return qs;
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ===== HOST: CREATE GAME =====
    function createGame() {
        const timer = parseInt($('t-count').textContent);

        config = {
            timer: timer,
            shuffle: $('opt-shuffle').checked,
            showAnswer: $('opt-show-answer').checked,
            streaks: $('opt-streaks').checked,
            sound: $('opt-sound').checked,
            gameMode: gameMode
        };
        soundEnabled = config.sound;

        if (sourceMode === 'custom') {
            questions = generateCustomQuestions();
            if (!questions || questions.length === 0) return;
            config.totalQuestions = questions.length;
        } else {
            const selectedCats = [...document.querySelectorAll('.qg-cat-chip.selected')]
                .map(c => c.dataset.cat);
            const level = document.querySelector('.qg-level-btn.active').dataset.level;
            const qCount = parseInt($('q-count').textContent);
            config.totalQuestions = qCount;
            questions = generateQuestions(selectedCats, level, qCount);
            if (!questions || questions.length === 0) return;
        }

        if (config.shuffle) shuffle(questions);
        config.totalQuestions = questions.length;

        role = 'host';

        FirebaseService.createSession(config, questions).then(code => {
            gameCode = code;

            if (!FirebaseService.isDemo()) {
                // Automatically delete the session if the host closes/refreshes the page
                FirebaseService.setupHostDisconnect(code);
            }

            showLobby(code);

            // Listen for players joining
            if (!FirebaseService.isDemo()) {
                const unsub = FirebaseService.onPlayersChange(code, p => {
                    players = p || {};
                    renderLobbyPlayers();
                });
                listeners.push(unsub);
            }
        });
    }

    function showLobby(code) {
        // Animate code display
        const codeEl = $('game-code-display');
        codeEl.innerHTML = code.split('').map(c => `<span>${c}</span>`).join('');
        renderLobbyPlayers();
        showScreen('screen-lobby');
        // Show session code badge for host
        showSessionBadge(code);
    }

    function renderLobbyPlayers() {
        const container = $('lobby-players');
        const count = Object.keys(players).length;
        $('player-count').textContent = count;
        $('btn-start-game').disabled = count < 1;

        container.innerHTML = '';
        Object.entries(players).forEach(([uid, p], i) => {
            const div = document.createElement('div');
            div.className = 'qg-lobby-player';
            div.style.animationDelay = (i * 0.05) + 's';
            const avatarId = p.avatar || '';
            let avatarHtml = '<i class="fa-solid fa-user"></i>';
            if (avatarId.startsWith('animal_')) {
                const idx = parseInt(avatarId.replace('animal_', ''));
                avatarHtml = `<img class="player-avatar-img" src="${getAvatarSrc(idx)}" alt="">`;
            }

            let bootHtml = '';
            if (role === 'host') {
                bootHtml = `<button class="qg-boot-btn" aria-label="Remove Player" data-uid="${uid}" data-name="${escapeHtml(p.name)}">
                                <i class="fa-solid fa-xmark"></i>
                            </button>`;
            }

            div.innerHTML = `${avatarHtml} <span class="player-name">${escapeHtml(p.name)}</span>${bootHtml}`;

            if (role === 'host') {
                const bootBtn = div.querySelector('.qg-boot-btn');
                if (bootBtn) {
                    bootBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        bootPlayer(bootBtn.dataset.uid, bootBtn.dataset.name);
                    });
                }
            }
            container.appendChild(div);
        });
    }

    function bootPlayer(uid, name) {
        // Immediately remove from local state for instant UI feedback
        delete players[uid];
        renderLobbyPlayers();

        // Remove from Firebase
        FirebaseService.removePlayer(gameCode, uid).catch(err => {
            console.error('[QuizGame] Failed to boot player:', err);
        });
    }

    function cancelLobby() {
        if (gameCode) FirebaseService.deleteSession(gameCode);
        cleanup();
        showScreen('screen-role');
    }

    function showDisconnectScreen(title, message) {
        clearInterval(timerInterval);
        $('booted-title').textContent = title;
        $('booted-message').textContent = message;
        showScreen('screen-booted');
    }

    // ===== PLAYER: JOIN GAME (Two-step) =====
    function joinStep1() {
        const code = $('join-code').value.trim().toUpperCase();
        const name = $('join-name').value.trim();

        $('join-error').textContent = '';

        if (!code || code.length < 4) {
            $('join-error').textContent = 'Please enter a valid game code.';
            return;
        }
        if (!name) {
            $('join-error').textContent = 'Please enter your name.';
            return;
        }

        // Store temporarily and show avatar selection
        gameCode = code;
        playerName = name;
        selectedAvatar = null;
        // Reset avatar selection
        document.querySelectorAll('.qg-avatar-option').forEach(o => o.classList.remove('selected'));
        showScreen('screen-avatar');
    }

    function joinStep2() {
        if (!selectedAvatar) {
            // Auto-select a random one
            const idx = Math.floor(Math.random() * AVATAR_COUNT) + 1;
            selectedAvatar = 'animal_' + idx;
        }

        role = 'player';

        // Save code so player can rejoin after accidental close
        sessionStorage.setItem('qg-last-code', gameCode);

        FirebaseService.joinSession(gameCode, playerName).then(sessionData => {
            // Update avatar in Firebase
            if (!FirebaseService.isDemo()) {
                FirebaseService.updateSessionField(gameCode, 'players/' + FirebaseService.getUid() + '/avatar', selectedAvatar);
            }

            const idx = parseInt(selectedAvatar.replace('animal_', ''));
            $('waiting-avatar').innerHTML = `<img src="${getAvatarSrc(idx)}" alt="Your avatar">`;
            $('waiting-name').textContent = playerName;

            // Detect if the game is already running (rejoin scenario)
            const currentStatus = sessionData && sessionData.status;
            const isRejoin = (currentStatus === 'playing' || currentStatus === 'reviewing');
            const isCountdownRejoin = (currentStatus === 'countdown');

            if (isRejoin) {
                // Jump straight into the game
                listenAsPlayer();
            } else if (isCountdownRejoin) {
                runCountdown(() => listenAsPlayer());
            } else {
                showScreen('screen-waiting');
            }

            if (!FirebaseService.isDemo()) {
                FirebaseService.setupDisconnect(gameCode);

                const unsub = FirebaseService.onFieldChange(gameCode, 'status', status => {
                    // Only trigger transitions while in waiting — not mid-game (listenAsPlayer handles that)
                    if (!$('screen-waiting').classList.contains('active')) return;
                    if (status === 'countdown') {
                        runCountdown(() => {
                            listenAsPlayer();
                        });
                    } else if (status === 'finished') {
                        showResults();
                    }
                });
                listeners.push(unsub);

                const kickUnsub = FirebaseService.onFieldChange(gameCode, 'players/' + FirebaseService.getUid(), val => {
                    if (val === null && role === 'player' && $('screen-waiting').classList.contains('active')) {
                        showDisconnectScreen('Oops!', 'You have been removed from the lobby by the host.');
                    }
                });
                listeners.push(kickUnsub);

                // Listen for session deletion (host refresh/disconnect)
                const sessionUnsub = FirebaseService.onSessionValue(gameCode, val => {
                    if (val === null && role === 'player') {
                        showDisconnectScreen('Disconnected', 'The host has ended the session or disconnected.');
                    }
                });
                listeners.push(sessionUnsub);
            }
        }).catch(err => {
            showScreen('screen-join');
            $('join-error').textContent = 'Could not join game. Check your code.';
            console.error(err);
        });
    }

    // ===== GAME FLOW: COUNTDOWN =====
    function startCountdown() {
        $('btn-start-game').disabled = true;

        if (!FirebaseService.isDemo()) {
            FirebaseService.updateSessionField(gameCode, 'status', 'countdown');
        }

        runCountdown(() => {
            if (role === 'host') {
                startHostGame();
            }
        });
    }

    function runCountdown(callback) {
        const overlay = $('overlay-countdown');
        const numEl = $('countdown-number');
        overlay.classList.add('active');
        let count = 3;
        numEl.textContent = count;
        numEl.style.animation = 'none';
        void numEl.offsetWidth;
        numEl.style.animation = '';

        playSound('countdown');

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                numEl.textContent = count;
                numEl.style.animation = 'none';
                void numEl.offsetWidth;
                numEl.style.animation = '';
                playSound('countdown');
            } else if (count === 0) {
                numEl.textContent = 'GO!';
                numEl.style.animation = 'none';
                void numEl.offsetWidth;
                numEl.style.animation = '';
                numEl.style.color = 'var(--amber-flame)';
                playSound('go');
            } else {
                clearInterval(interval);
                overlay.classList.remove('active');
                numEl.style.color = '';
                callback();
            }
        }, 800);
    }

    // ===== HOST: GAME PLAY =====
    function startHostGame() {
        showScreen('screen-game');
        $('teacher-view').classList.add('active');
        $('student-view').classList.remove('active');
        $('tv-q-total').textContent = questions.length;
        $('tv-total-players').textContent = Object.keys(players).length;
        currentQ = -1;

        const gm = config.gameMode || 'automatic';

        // Show/hide teacher controls based on mode
        $('tv-teacher-controls').classList.toggle('qg-hidden', gm !== 'teacher-paced');

        // Listen for player answers/progress
        if (!FirebaseService.isDemo()) {
            const unsub = FirebaseService.onPlayersChange(gameCode, p => {
                players = p || {};
                updateHostLeaderboard();
                if (gm !== 'student-paced') {
                    updateAnswerCounts();
                }
            });
            listeners.push(unsub);
        }

        if (gm === 'student-paced') {
            // Student-paced: host just monitors; push status so students start
            if (!FirebaseService.isDemo()) {
                FirebaseService.updateSessionField(gameCode, 'status', 'playing');
            }
            $('tv-q-num').textContent = '—';
            $('tv-question').innerHTML = '<div style="text-align:center; opacity:0.7;"><i class="fa-solid fa-users" style="font-size:2rem; margin-bottom:10px;"></i><br>Students are answering at their own pace.<br>Watch the leaderboard update live!</div>';
            $('tv-answers').innerHTML = '';
            $('tv-answered').textContent = '—';

            // Show an End Game button for the host
            $('tv-teacher-controls').classList.remove('qg-hidden');
            $('btn-next-question').innerHTML = '<i class="fa-solid fa-flag-checkered"></i> End Game';
            $('btn-next-question').onclick = () => {
                endGame();
            };
        } else {
            // Reset button for teacher-paced
            $('btn-next-question').innerHTML = 'Next Question <i class="fa-solid fa-arrow-right"></i>';
            $('btn-next-question').onclick = teacherNextQuestion;
            nextQuestion();
        }
    }

    function nextQuestion() {
        currentQ++;
        if (currentQ >= questions.length) {
            endGame();
            return;
        }

        const q = questions[currentQ];
        hasAnswered = false;
        answerCounts = [0, 0, 0, 0];
        timeLeft = config.timer;
        isAdvancing = false; // Allow answer counting for new question

        // Clear previous answers
        if (!FirebaseService.isDemo()) {
            FirebaseService.clearAllAnswers(gameCode, players);
            FirebaseService.updateSessionField(gameCode, 'currentQuestion', currentQ);
            FirebaseService.updateSessionField(gameCode, 'questionStartedAt', Date.now());
            FirebaseService.updateSessionField(gameCode, 'status', 'playing');
        }

        // Update UI
        $('tv-q-num').textContent = currentQ + 1;
        let qHtml = `<div>${escapeHtml(q.text)}</div>`;
        if (q.imageData) {
            qHtml = `<img src="${q.imageData}" style="max-height: 200px; max-width: 100%; border-radius: 12px; margin-bottom: 15px; object-fit: contain;" alt="Question Image" />` + qHtml;
        }
        $('tv-question').innerHTML = qHtml;
        $('tv-answered').textContent = '0';

        // Render answer bars
        const answersEl = $('tv-answers');
        answersEl.innerHTML = '';
        const icons = ['▲', '◆', '●', '■'];
        q.options.forEach((opt, i) => {
            const div = document.createElement('div');
            div.className = 'qg-tv-answer';
            div.id = 'tv-ans-' + i;
            div.innerHTML = `
                <span class="ans-icon">${icons[i]}</span>
                <span class="ans-text">${escapeHtml(opt)}</span>
                <span class="ans-count" id="tv-ans-count-${i}">0</span>
            `;
            answersEl.appendChild(div);
        });

        startTimer();
    }

    function startTimer() {
        clearInterval(timerInterval);
        const total = config.timer;
        timeLeft = total;

        updateTimerUI(total, total);

        timerInterval = setInterval(() => {
            timeLeft -= 0.1;
            if (timeLeft <= 0) {
                timeLeft = 0;
                clearInterval(timerInterval);
                revealAnswer();
            }
            updateTimerUI(timeLeft, total);
        }, 100);
    }

    function updateTimerUI(current, total) {
        const pct = (current / total) * 100;

        // Host timer bar
        const tvFill = $('tv-timer-fill');
        if (tvFill) {
            tvFill.style.width = pct + '%';
            tvFill.classList.toggle('warning', pct <= 50 && pct > 25);
            tvFill.classList.toggle('urgent', pct <= 25);
        }

        // Student timer bar
        const svFill = $('sv-timer-fill');
        if (svFill) {
            svFill.style.width = pct + '%';
            svFill.classList.toggle('warning', pct <= 50 && pct > 25);
            svFill.classList.toggle('urgent', pct <= 25);
        }
    }

    function updateAnswerCounts() {
        if (isAdvancing) return;

        let answered = 0;
        answerCounts = [0, 0, 0, 0];
        Object.values(players).forEach(p => {
            if (p.currentAnswer !== null && p.currentAnswer !== undefined) {
                answered++;
                const idx = typeof p.currentAnswer === 'object' ? p.currentAnswer.index : p.currentAnswer;
                if (idx >= 0 && idx < 4) answerCounts[idx]++;
            }
        });
        $('tv-answered').textContent = answered;
        for (let i = 0; i < 4; i++) {
            const el = $('tv-ans-count-' + i);
            if (el) el.textContent = answerCounts[i];
        }

        const gm = config.gameMode || 'automatic';

        // Auto-advance or auto-reveal when all answer
        if (gm === 'automatic' || gm === 'teacher-paced') {
            if (answered >= Object.keys(players).length && answered > 0) {
                clearInterval(timerInterval);
                timeLeft = 0;
                updateTimerUI(0, config.timer || 1);
                isAdvancing = true;
                revealAnswer();
            }
        }
    }

    function getPlayerProgress(p) {
        const gm = config.gameMode || 'automatic';
        if (gm === 'student-paced') {
            return p.progress || 0;
        } else {
            // For automatic and teacher-paced, all players are at the same question
            // Their progress is currentQ + 1 if they answered, or just currentQ if we are still waiting
            if (isAdvancing) return currentQ + 1; // Round over
            return p.currentAnswer !== null && p.currentAnswer !== undefined ? currentQ + 1 : currentQ;
        }
    }

    function updateHostLeaderboard() {
        const tot = questions.length || 1;

        const sorted = Object.entries(players)
            .map(([uid, p]) => {
                const prog = getPlayerProgress(p);
                return { uid, prog, isDone: prog >= tot, ...p };
            })
            // Sort completed first, then by score descending (or progress desc if score is 0)
            .sort((a, b) => {
                if (a.isDone && !b.isDone) return -1;
                if (!a.isDone && b.isDone) return 1;
                if (a.score !== b.score) return (b.score || 0) - (a.score || 0);
                return b.prog - a.prog;
            });

        const list = $('tv-lb-list');
        list.innerHTML = '';
        sorted.forEach((p, i) => {
            const row = document.createElement('div');
            row.className = 'qg-tv-lb-row';
            if (p.isDone) {
                row.style.background = 'rgba(118, 120, 237, 0.15)';
                row.style.border = '1px solid rgba(118, 120, 237, 0.3)';
            } else if (i === 0 && (p.score || 0) > 0) {
                row.style.background = 'rgba(247, 184, 1, 0.15)';
            }

            const streak = p.streak || 0;
            const streakHtml = streak >= 3 ? `<span class="fire">🔥</span>${streak}` : (streak > 0 ? `⚡${streak}` : '');

            // Progress width (0 to 100%)
            const pct = Math.min(100, Math.round((p.prog / tot) * 100));

            // Determine bar streak class
            let barClass = '';
            if (streak >= 5) barClass = 'streak-5';
            else if (streak >= 3) barClass = 'streak-3';
            else if (streak >= 2) barClass = 'streak-2';

            let statusTag = '';
            if (p.isDone) {
                statusTag = `<span style="font-size: 0.7rem; background: var(--medium-slate-blue); color: white; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">Completed</span>`;
            }

            row.innerHTML = `
                <span class="qg-tv-lb-rank">${i + 1}</span>
                <div class="qg-tv-lb-progress-wrap">
                    <div class="qg-tv-lb-info">
                        <span class="qg-tv-lb-name">${escapeHtml(p.name)} ${statusTag}</span>
                        <span class="qg-tv-lb-score">${p.score || 0}</span>
                    </div>
                    <div class="qg-tv-lb-bar-bg">
                        <div class="qg-tv-lb-bar ${barClass}" style="width: ${pct}%; transition: width 0.5s ease-out;"></div>
                    </div>
                </div>
                <span class="qg-tv-lb-streak">${streakHtml}</span>
            `;
            list.appendChild(row);
        });
    }

    function revealAnswer() {
        clearInterval(timerInterval);
        isAdvancing = true;
        const q = questions[currentQ];
        if (!q) return;

        // Highlight correct answer on teacher view
        const correctEl = $('tv-ans-' + q.correctIndex);
        if (correctEl) correctEl.classList.add('correct-answer');

        if (!FirebaseService.isDemo()) {
            FirebaseService.updateSessionField(gameCode, 'status', 'reviewing');
        }

        // Process scores
        Object.entries(players).forEach(([uid, p]) => {
            if (p.currentAnswer !== null && p.currentAnswer !== undefined) {
                const idx = typeof p.currentAnswer === 'object' ? p.currentAnswer.index : p.currentAnswer;
                if (idx === q.correctIndex) {
                    const timeBonus = Math.round((timeLeft / config.timer) * 50);
                    const streakMultiplier = config.streaks ? Math.min(p.streak + 1, 5) : 1;
                    const basePoints = 100;
                    const points = Math.round((basePoints + timeBonus) * (1 + (streakMultiplier - 1) * 0.2));
                    p.score += points;
                    p.streak = (p.streak || 0) + 1;
                } else {
                    p.streak = 0;
                }
            } else {
                p.streak = 0;
            }

            if (!FirebaseService.isDemo()) {
                FirebaseService.updatePlayerScore(gameCode, uid, p.score, p.streak);
            }
        });

        updateHostLeaderboard();

        const gm = config.gameMode || 'automatic';

        if (gm === 'teacher-paced') {
            // Show the Next Question button — teacher decides when to proceed
            $('tv-teacher-controls').classList.remove('qg-hidden');
            if (currentQ >= questions.length - 1) {
                $('btn-next-question').innerHTML = '<i class="fa-solid fa-flag-checkered"></i> Finish Quiz';
            } else {
                $('btn-next-question').innerHTML = 'Next Question <i class="fa-solid fa-arrow-right"></i>';
            }
        } else {
            // Automatic mode: wait then advance
            setTimeout(() => {
                nextQuestion();
            }, 3000);
        }
    }

    function teacherNextQuestion() {
        $('tv-teacher-controls').classList.add('qg-hidden');
        nextQuestion();
    }

    // ===== PLAYER: GAME PLAY =====
    function listenAsPlayer() {
        showScreen('screen-game');
        $('student-view').classList.add('active');
        $('teacher-view').classList.remove('active');
        myScore = 0;
        myStreak = 0;

        if (!FirebaseService.isDemo()) {
            // Get initial game state first
            FirebaseService.getSession(gameCode).then(session => {
                if (!session) return;
                questions = session.questions || [];
                config = session.config || {};
                soundEnabled = config.sound !== false;
                const gm = config.gameMode || 'automatic';

                if (gm === 'student-paced') {
                    // Student-paced: start from question 0 and advance locally
                    currentQ = -1;
                    studentPacedNextQuestion();

                    // Listen for game end
                    const unsub2 = FirebaseService.onFieldChange(gameCode, 'status', status => {
                        if (status === 'finished') {
                            showResults();
                        }
                    });
                    listeners.push(unsub2);
                } else {
                    // Automatic & Teacher-paced: listen for host-pushed question
                    const unsub1 = FirebaseService.onFieldChange(gameCode, 'currentQuestion', qIdx => {
                        if (qIdx === null || qIdx === -1) return;
                        loadPlayerQuestion(qIdx);
                    });
                    listeners.push(unsub1);

                    const unsub2 = FirebaseService.onFieldChange(gameCode, 'status', status => {
                        if (status === 'reviewing') {
                            revealPlayerAnswer();
                        } else if (status === 'finished') {
                            showResults();
                        }
                    });
                    listeners.push(unsub2);

                    if (session.currentQuestion >= 0) {
                        loadPlayerQuestion(session.currentQuestion);
                    }
                }
            });
        }
    }

    // Student-paced: advance to next question locally
    function studentPacedNextQuestion() {
        currentQ++;
        if (currentQ >= questions.length) {
            // Student finished all questions
            showResults();
            // Report final score to Firebase
            if (!FirebaseService.isDemo()) {
                FirebaseService.updatePlayerScore(gameCode, FirebaseService.getUid(), myScore, myStreak);
                FirebaseService.updateSessionField(gameCode,
                    'players/' + FirebaseService.getUid() + '/progress', questions.length);
            }
            return;
        }

        hasAnswered = false;
        const q = questions[currentQ];
        if (!q) return;

        $('sv-score').textContent = myScore;
        $('sv-progress').textContent = `${currentQ + 1} / ${questions.length}`;
        updateStreakDisplay();
        let qHtml = `<div>${escapeHtml(q.text)}</div>`;
        if (q.imageData) {
            qHtml = `<img src="${q.imageData}" style="max-height: 150px; max-width: 100%; border-radius: 12px; margin-bottom: 10px; object-fit: contain;" alt="Question Image" />` + qHtml;
        }
        $('sv-question').innerHTML = qHtml;

        const btns = document.querySelectorAll('.qg-answer-btn');
        btns.forEach((btn, i) => {
            btn.textContent = q.options[i] || '';
            btn.className = 'qg-answer-btn qg-ans-' + i;
            btn.disabled = false;
        });

        // Start local timer
        startPlayerTimer(config.timer, config.timer);
    }

    function loadPlayerQuestion(qIdx) {
        currentQ = qIdx;
        hasAnswered = false;

        FirebaseService.getSession(gameCode).then(session => {
            if (!session) return;
            questions = session.questions || [];
            config = session.config || {};
            const q = questions[currentQ];
            if (!q) return;

            // Update player data
            const pData = session.players ? session.players[FirebaseService.getUid()] : null;
            if (pData) {
                myScore = pData.score || 0;
                myStreak = pData.streak || 0;
            }

            // Render
            $('sv-score').textContent = myScore;
            $('sv-progress').textContent = `${currentQ + 1} / ${questions.length}`;
            updateStreakDisplay();
            let qHtml = `<div>${escapeHtml(q.text)}</div>`;
            if (q.imageData) {
                qHtml = `<img src="${q.imageData}" style="max-height: 150px; max-width: 100%; border-radius: 12px; margin-bottom: 10px; object-fit: contain;" alt="Question Image" />` + qHtml;
            }
            $('sv-question').innerHTML = qHtml;

            const btns = document.querySelectorAll('.qg-answer-btn');
            btns.forEach((btn, i) => {
                btn.textContent = q.options[i] || '';
                btn.className = 'qg-answer-btn qg-ans-' + i;
                btn.disabled = false;
            });

            // Start local timer
            const elapsed = (Date.now() - (session.questionStartedAt || Date.now())) / 1000;
            const remaining = Math.max(0, config.timer - elapsed);
            startPlayerTimer(remaining, config.timer);
        });
    }

    function startPlayerTimer(remaining, total) {
        clearInterval(timerInterval);
        timeLeft = remaining;
        updateTimerUI(timeLeft, total);

        timerInterval = setInterval(() => {
            timeLeft -= 0.1;
            if (timeLeft <= 0) {
                timeLeft = 0;
                clearInterval(timerInterval);
                disableAnswerButtons();

                const gm = config.gameMode || 'automatic';
                if (gm === 'student-paced' && !hasAnswered) {
                    // Auto-advance when time runs out in student-paced
                    hasAnswered = true;
                    myStreak = 0;
                    showFeedback(false, 0);
                    // Show correct answer briefly
                    const q = questions[currentQ];
                    if (q) {
                        const btns = document.querySelectorAll('.qg-answer-btn');
                        btns.forEach((btn, i) => {
                            if (i === q.correctIndex) btn.classList.add('correct');
                        });
                    }
                    if (!FirebaseService.isDemo()) {
                        FirebaseService.updatePlayerScore(gameCode, FirebaseService.getUid(), myScore, myStreak);
                    }
                    setTimeout(() => studentPacedNextQuestion(), 2000);
                }
            }
            updateTimerUI(timeLeft, total);
        }, 100);
    }

    function selectAnswer(index) {
        if (hasAnswered || timeLeft <= 0) return;
        hasAnswered = true;

        // Visual feedback
        document.querySelectorAll('.qg-answer-btn').forEach(btn => btn.classList.add('disabled'));
        document.querySelector(`.qg-answer-btn[data-index="${index}"]`).classList.remove('disabled');
        document.querySelector(`.qg-answer-btn[data-index="${index}"]`).classList.add('selected');

        playSound('click');

        // Submit to Firebase
        FirebaseService.submitAnswer(gameCode, index);

        const gm = config.gameMode || 'automatic';
        if (gm === 'student-paced') {
            // Immediately reveal and advance locally
            studentPacedRevealAndAdvance(index);
        }
    }

    function studentPacedRevealAndAdvance(selectedIdx) {
        clearInterval(timerInterval);
        const q = questions[currentQ];
        if (!q) return;

        const btns = document.querySelectorAll('.qg-answer-btn');
        btns.forEach((btn, i) => {
            btn.classList.add('disabled');
            if (i === q.correctIndex) btn.classList.add('correct');
        });

        if (selectedIdx === q.correctIndex) {
            const timeBonus = Math.round((timeLeft / config.timer) * 50);
            const streakMultiplier = config.streaks ? Math.min(myStreak + 1, 5) : 1;
            const points = Math.round((100 + timeBonus) * (1 + (streakMultiplier - 1) * 0.2));
            myScore += points;
            myStreak++;
            showFeedback(true, points);
            playSound('correct');
        } else {
            const selectedBtn = document.querySelector(`.qg-answer-btn[data-index="${selectedIdx}"]`);
            if (selectedBtn) selectedBtn.classList.add('wrong');
            myStreak = 0;
            showFeedback(false, 0);
            playSound('wrong');
        }

        $('sv-score').textContent = myScore;
        $('sv-score').classList.add('pop');
        setTimeout(() => $('sv-score').classList.remove('pop'), 300);
        updateStreakDisplay();

        // Report score to Firebase
        if (!FirebaseService.isDemo()) {
            FirebaseService.updatePlayerScore(gameCode, FirebaseService.getUid(), myScore, myStreak);
            FirebaseService.updateSessionField(gameCode,
                'players/' + FirebaseService.getUid() + '/progress', currentQ + 1);
        }

        // Auto-advance to next question after brief delay
        setTimeout(() => {
            studentPacedNextQuestion();
        }, 2000);
    }

    function revealPlayerAnswer() {
        clearInterval(timerInterval);
        const q = questions[currentQ];
        if (!q) return;

        const btns = document.querySelectorAll('.qg-answer-btn');
        btns.forEach((btn, i) => {
            btn.classList.add('disabled');
            if (i === q.correctIndex) {
                btn.classList.add('correct');
            }
        });

        // Check if player answered correctly
        const selectedBtn = document.querySelector('.qg-answer-btn.selected');
        if (selectedBtn) {
            const selectedIdx = parseInt(selectedBtn.dataset.index);
            if (selectedIdx === q.correctIndex) {
                // Correct!
                const timeBonus = Math.round((timeLeft / config.timer) * 50);
                const streakMultiplier = config.streaks ? Math.min(myStreak + 1, 5) : 1;
                const points = Math.round((100 + timeBonus) * (1 + (streakMultiplier - 1) * 0.2));
                myScore += points;
                myStreak++;
                showFeedback(true, points);
                playSound('correct');
            } else {
                selectedBtn.classList.add('wrong');
                myStreak = 0;
                showFeedback(false, 0);
                playSound('wrong');
            }
        } else {
            myStreak = 0;
            showFeedback(false, 0);
        }

        $('sv-score').textContent = myScore;
        $('sv-score').classList.add('pop');
        setTimeout(() => $('sv-score').classList.remove('pop'), 300);
        updateStreakDisplay();
    }

    function disableAnswerButtons() {
        document.querySelectorAll('.qg-answer-btn').forEach(btn => btn.classList.add('disabled'));
    }

    function updateStreakDisplay() {
        const el = $('sv-streak');
        if (myStreak >= 3) {
            el.innerHTML = `<span class="fire">🔥</span> ${myStreak}`;
        } else if (myStreak > 0) {
            el.textContent = `⚡ ${myStreak}`;
        } else {
            el.textContent = '';
        }
    }

    function showFeedback(correct, points) {
        const overlay = $('overlay-feedback');
        const icon = $('feedback-icon');
        const text = $('feedback-text');
        const pts = $('feedback-points');

        overlay.className = 'qg-overlay qg-feedback active ' + (correct ? 'correct' : 'incorrect');
        icon.innerHTML = correct
            ? '<i class="fa-solid fa-check"></i>'
            : '<i class="fa-solid fa-xmark"></i>';
        text.textContent = correct ? 'Correct!' : 'Wrong!';
        pts.textContent = correct ? `+${points} points` : '';

        // Re-trigger animations
        icon.style.animation = 'none';
        void icon.offsetWidth;
        icon.style.animation = '';

        setTimeout(() => {
            overlay.classList.remove('active');
        }, 1500);
    }

    // ===== END GAME =====
    function endGame() {
        clearInterval(timerInterval);
        if (!FirebaseService.isDemo()) {
            FirebaseService.updateSessionField(gameCode, 'status', 'finished');
        }
        showResults();
    }

    function showResults() {
        showScreen('screen-results');

        // Gather final scores
        const finalPlayers = role === 'host' ? players : {};

        if (role === 'host') {
            renderResults(finalPlayers);
        } else {
            // Player: fetch final state
            FirebaseService.getSession(gameCode).then(session => {
                if (session && session.players) {
                    renderResults(session.players);
                }
            });
        }

        // Confetti!
        setTimeout(launchConfetti, 500);
        playSound('podium');
    }

    function renderResults(playerData) {
        const sorted = Object.entries(playerData || {})
            .map(([uid, p]) => ({ uid, name: p.name, score: p.score || 0, streak: p.streak || 0 }))
            .sort((a, b) => b.score - a.score);

        // Podium
        for (let i = 0; i < 3; i++) {
            const place = $('podium-' + (i + 1));
            if (sorted[i]) {
                place.querySelector('.qg-podium-name').textContent = sorted[i].name;
                place.querySelector('.qg-podium-score').textContent = sorted[i].score + ' pts';
                place.style.display = '';
            } else {
                place.style.display = 'none';
            }
        }

        // Table
        const tbody = $('results-tbody');
        tbody.innerHTML = '';
        sorted.forEach((p, i) => {
            const tr = document.createElement('tr');
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
            const streakStr = p.streak >= 3 ? `🔥 ${p.streak}` : p.streak;
            tr.innerHTML = `
                <td>${medal}</td>
                <td>${escapeHtml(p.name)}</td>
                <td style="color: var(--amber-flame); font-weight: 800">${p.score}</td>
                <td>${streakStr}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ===== CONFETTI =====
    function launchConfetti() {
        const canvas = $('confetti-canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const colors = ['#f7b801', '#7678ed', '#f18701', '#f35b04', '#3d348b', '#51cf66', '#E74C3C', '#3498DB'];
        const particles = [];

        for (let i = 0; i < 200; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                w: Math.random() * 10 + 5,
                h: Math.random() * 6 + 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                vx: (Math.random() - 0.5) * 4,
                vy: Math.random() * 3 + 2,
                rot: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 10,
                opacity: 1
            });
        }

        let frames = 0;
        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            frames++;
            let alive = false;

            particles.forEach(p => {
                if (p.opacity <= 0) return;
                alive = true;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.05;
                p.rot += p.rotSpeed;
                if (frames > 200) p.opacity -= 0.01;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot * Math.PI / 180);
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            });

            if (alive && frames < 350) {
                requestAnimationFrame(draw);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        draw();
    }

    // ===== SOUND EFFECTS (Web Audio API) =====
    function playSound(type) {
        if (!soundEnabled) return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            const now = audioCtx.currentTime;

            switch (type) {
                case 'countdown':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, now);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                    osc.start(now);
                    osc.stop(now + 0.2);
                    break;
                case 'go':
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(523, now);
                    osc.frequency.setValueAtTime(659, now + 0.1);
                    osc.frequency.setValueAtTime(784, now + 0.2);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                    osc.start(now);
                    osc.stop(now + 0.4);
                    break;
                case 'correct':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(523, now);
                    osc.frequency.setValueAtTime(659, now + 0.1);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                    osc.start(now);
                    osc.stop(now + 0.35);
                    break;
                case 'wrong':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.setValueAtTime(150, now + 0.15);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                    osc.start(now);
                    osc.stop(now + 0.25);
                    break;
                case 'click':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(800, now);
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                    osc.start(now);
                    osc.stop(now + 0.08);
                    break;
                case 'podium':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(392, now);
                    osc.frequency.setValueAtTime(523, now + 0.2);
                    osc.frequency.setValueAtTime(659, now + 0.4);
                    osc.frequency.setValueAtTime(784, now + 0.6);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 1);
                    osc.start(now);
                    osc.stop(now + 1);
                    break;
            }
        } catch (e) {
            // Silent fail for audio
        }
    }

    // ===== SESSION CODE BADGE =====
    function showSessionBadge(code) {
        const badge = $('session-code-badge');
        const badgeCode = $('session-badge-code');
        if (badge && badgeCode) {
            badgeCode.textContent = code;
            badge.style.display = '';
        }
    }

    function hideSessionBadge() {
        const badge = $('session-code-badge');
        if (badge) badge.style.display = 'none';
    }

    // ===== SCREEN MANAGEMENT =====
    function showScreen(id) {
        document.querySelectorAll('.qg-screen').forEach(s => s.classList.remove('active'));
        $(id).classList.add('active');

        // Show/hide session badge depending on screen
        const badgeScreens = ['screen-lobby', 'screen-game', 'screen-waiting'];
        if (gameCode && badgeScreens.includes(id)) {
            showSessionBadge(gameCode);
        } else if (!badgeScreens.includes(id)) {
            hideSessionBadge();
        }
    }

    // ===== CLEANUP =====
    function cleanup() {
        clearInterval(timerInterval);
        listeners.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
        listeners = [];
        role = null;
        gameCode = null;
        currentQ = -1;
        players = {};
        myScore = 0;
        myStreak = 0;
        hasAnswered = false;
        $('teacher-view').classList.remove('active');
        $('student-view').classList.remove('active');
        hideSessionBadge();
        sessionStorage.removeItem('qg-last-code');
    }

    function playAgain() {
        if (role === 'host') {
            cleanup();
            showScreen('screen-setup');
        } else {
            cleanup();
            showScreen('screen-role');
        }
    }

    // ===== UTILITY =====
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    // ===== DEMO MODE (Simulate multiplayer locally) =====
    function addDemoPlayers() {
        if (!FirebaseService.isDemo()) return;
        const names = ['Sofia', 'Santiago', 'Valentina', 'Mateo', 'Isabella',
            'Samuel', 'Mariana', 'Nicolas', 'Camila', 'Daniel'];
        const shuffled = shuffle([...names]).slice(0, 5 + Math.floor(Math.random() * 5));
        shuffled.forEach((name, i) => {
            setTimeout(() => {
                const uid = 'demo_' + name.toLowerCase();
                if (!players[uid]) {
                    players[uid] = {
                        name: name,
                        score: 0,
                        streak: 0,
                        currentAnswer: null,
                        joinedAt: Date.now()
                    };
                    renderLobbyPlayers();
                }
            }, 300 + i * 400);
        });
    }

    // Expose demo helper
    window._addDemoPlayers = addDemoPlayers;

    // ===== QUIZ THEME ENGINE =====
    const QUIZ_THEMES = {
        'default': {
            '--qg-bg-from': '#3d348b',
            '--qg-bg-to': '#7678ed',
            '--qg-accent': '#f7b801',
            '--qg-particle': 'rgba(255,255,255,0.08)',
            dark: { '--qg-bg-from': '#1a1530', '--qg-bg-to': '#2c2a5a' }
        },
        'neon': {
            '--qg-bg-from': '#05050f',
            '--qg-bg-to': '#0d0d2b',
            '--qg-accent': '#00f5ff',
            '--qg-particle': 'rgba(0,245,255,0.12)',
            dark: { '--qg-bg-from': '#02020a', '--qg-bg-to': '#080820' }
        },
        'forest': {
            '--qg-bg-from': '#1a3d2b',
            '--qg-bg-to': '#2d6a4f',
            '--qg-accent': '#52b788',
            '--qg-particle': 'rgba(82,183,136,0.12)',
            dark: { '--qg-bg-from': '#0a1a11', '--qg-bg-to': '#152d1e' }
        },
        'winter': {
            '--qg-bg-from': '#4a9bbe',
            '--qg-bg-to': '#2a7fa8',
            '--qg-accent': '#caf0f8',
            '--qg-particle': 'rgba(255,255,255,0.18)',
            dark: { '--qg-bg-from': '#0a2233', '--qg-bg-to': '#1a3a55' }
        },
        'candy': {
            '--qg-bg-from': '#a8005a',
            '--qg-bg-to': '#6a00c0',
            '--qg-accent': '#ff9de2',
            '--qg-particle': 'rgba(255,157,226,0.14)',
            dark: { '--qg-bg-from': '#3d0030', '--qg-bg-to': '#28004a' }
        },
        'pastel': {
            '--qg-bg-from': '#b57bee',
            '--qg-bg-to': '#ee88b5',
            '--qg-accent': '#fff0f8',
            '--qg-particle': 'rgba(255,255,255,0.14)',
            dark: { '--qg-bg-from': '#3d1f5a', '--qg-bg-to': '#5a1f3a' }
        },
        'ocean': {
            '--qg-bg-from': '#023e8a',
            '--qg-bg-to': '#0077b6',
            '--qg-accent': '#90e0ef',
            '--qg-particle': 'rgba(144,224,239,0.14)',
            dark: { '--qg-bg-from': '#03045e', '--qg-bg-to': '#023e8a' }
        }
    };

    // Lightweight canvas animation per theme
    let bgAnimFrame = null;
    let bgParticles = [];

    function startBgAnimation(theme, isDark) {
        const canvas = $('qg-bg-canvas');
        if (!canvas) return;

        // Cancel existing
        if (bgAnimFrame) cancelAnimationFrame(bgAnimFrame);
        bgParticles = [];

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const ctx = canvas.getContext('2d');
        const themeData = QUIZ_THEMES[theme] || QUIZ_THEMES['default'];
        const particleColor = (isDark && themeData.dark?.['--qg-particle']) || themeData['--qg-particle'];

        // Particle configs per theme
        const configs = {
            default: { count: 18, speed: 0.25, size: [3, 6], shape: 'circle' },
            neon: { count: 20, speed: 0.5, size: [2, 4], shape: 'line' },
            forest: { count: 14, speed: 0.2, size: [4, 8], shape: 'circle' },
            winter: { count: 25, speed: 0.4, size: [3, 7], shape: 'snow' },
            candy: { count: 16, speed: 0.3, size: [5, 9], shape: 'circle' },
            pastel: { count: 15, speed: 0.22, size: [4, 8], shape: 'circle' },
            ocean: { count: 18, speed: 0.3, size: [3, 7], shape: 'wave' }
        };
        const cfg = configs[theme] || configs['default'];

        // Build particles
        for (let i = 0; i < cfg.count; i++) {
            bgParticles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                r: cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0]),
                vx: (Math.random() - 0.5) * cfg.speed,
                vy: theme === 'winter' ? (Math.random() * cfg.speed + 0.15) : (Math.random() - 0.5) * cfg.speed,
                opacity: 0.3 + Math.random() * 0.5,
                phase: Math.random() * Math.PI * 2,
                shape: cfg.shape
            });
        }

        function drawFrame() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            bgParticles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.phase += 0.01;

                // Wrap around edges
                if (p.x < -20) p.x = canvas.width + 20;
                if (p.x > canvas.width + 20) p.x = -20;
                if (p.y > canvas.height + 20) p.y = -20;
                if (p.y < -20) p.y = canvas.height + 20;

                const breathe = Math.sin(p.phase) * 0.15;
                const alpha = Math.min(1, p.opacity + breathe);

                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = particleColor;
                ctx.strokeStyle = particleColor;

                if (p.shape === 'snow') {
                    // Snowflake: simple asterisk
                    ctx.lineWidth = 1.5;
                    for (let arm = 0; arm < 6; arm++) {
                        ctx.save();
                        ctx.translate(p.x, p.y);
                        ctx.rotate((arm * Math.PI) / 3);
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(0, -p.r);
                        ctx.stroke();
                        ctx.restore();
                    }
                } else if (p.shape === 'line') {
                    // Neon streak
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x + p.vx * 30, p.y + p.vy * 30);
                    ctx.stroke();
                } else {
                    // Soft circle
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            });

            bgAnimFrame = requestAnimationFrame(drawFrame);
        }
        drawFrame();
    }

    function stopBgAnimation() {
        if (bgAnimFrame) { cancelAnimationFrame(bgAnimFrame); bgAnimFrame = null; }
        const canvas = $('qg-bg-canvas');
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }

    function applyQuizTheme(theme, isDark) {
        const app = $('quiz-app');
        if (!app) return;

        const themeData = QUIZ_THEMES[theme] || QUIZ_THEMES['default'];
        const vars = isDark
            ? Object.assign({}, themeData, themeData.dark || {})
            : themeData;

        // Apply CSS variables to the app element
        ['--qg-bg-from', '--qg-bg-to', '--qg-accent'].forEach(v => {
            if (vars[v]) app.style.setProperty(v, vars[v]);
        });

        // Remove old theme & dark classes
        Object.keys(QUIZ_THEMES).forEach(t => app.classList.remove('qg-theme-' + t));
        app.classList.remove('qg-dark');

        // Apply new classes
        app.classList.add('qg-theme-' + theme);
        if (isDark) app.classList.add('qg-dark');
        app.dataset.theme = theme;

        // Update active swatch
        updateThemeSwatches(theme);

        // Update dark icon
        updateDarkIcon(isDark);

        // Persist
        localStorage.setItem('qg-theme', theme);
        localStorage.setItem('qg-dark', isDark ? '1' : '0');

        // Restart background animation
        startBgAnimation(theme, isDark);
    }

    function loadQuizTheme() {
        const theme = localStorage.getItem('qg-theme') || 'default';
        const isDark = localStorage.getItem('qg-dark') === '1';
        applyQuizTheme(theme, isDark);
    }

    function updateThemeSwatches(activeTheme) {
        document.querySelectorAll('.qg-theme-swatch').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === activeTheme);
        });
    }

    function updateDarkIcon(isDark) {
        const icon = $('qg-dark-icon');
        if (icon) {
            icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
    }

    // Resize handler for bg canvas
    window.addEventListener('resize', () => {
        const canvas = $('qg-bg-canvas');
        if (!canvas || !bgAnimFrame) return;
        const app = $('quiz-app');
        const theme = app ? (app.dataset.theme || 'default') : 'default';
        const isDark = app ? app.classList.contains('qg-dark') : false;
        startBgAnimation(theme, isDark);
    });

    // ===== INIT ON LOAD =====
    window.addEventListener('DOMContentLoaded', init);

    return { init };
})();
