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
    let playerGameStarted = false; // Guard: prevents listenAsPlayer() being triggered multiple times

    let sourceMode = 'vocab'; // 'vocab' | 'custom' | 'shortcuts'
    let gameMode = 'automatic'; // 'automatic' | 'student-paced' | 'teacher-paced'
    let customRows = [];

    // Shortcut Combo question state (player side)
    let selectedKeys = new Set();
    let shortcutKeyboardBound = false;
    let liveShortcutListener = null;
    let kickCheckTimer = null;
    let waitingPlayersListenerAdded = false;
    let waitingMiniGameDisabled = false;
    let playerKicked = false;
    const lobbyPlayerCardMap = new Map();
    const liveStandingsRowMap = new Map();
    const liveStandingsRankMap = new Map();
    const hostLbRowMap = new Map();
    const hostLbRankMap = new Map();
    let liveStandingsListenerAdded = false;
    let onLiveStandings = false;

    const INACTIVE_PLAYER_GRACE_MS = 60000;

    /**
     * Host waits this long before finishHostBonusRound(). Student bonus animation
     * (reveal + flip + shuffle) must finish well before this — see derived timings below.
     * If you change this value, verify BONUS_SEQUENCE_TARGET_MS still leaves a pick window.
     */
    const BONUS_STAGE_DURATION_MS = 18000;
    const BONUS_REVEAL_MS = 3000;
    const BONUS_FLIP_WAIT_MS = 800;
    const BONUS_SHUFFLE_INTERVAL_MS = 400;
    /** Target time for reveal→flip→shuffle before cards become clickable (~12–14s). */
    const BONUS_SEQUENCE_TARGET_MS = 13000;
    const BONUS_SHUFFLE_CYCLES = Math.max(
        1,
        Math.floor(
            (BONUS_SEQUENCE_TARGET_MS - BONUS_REVEAL_MS - BONUS_FLIP_WAIT_MS) / BONUS_SHUFFLE_INTERVAL_MS
        )
    );
    const BONUS_PICK_MARGIN_MS = BONUS_STAGE_DURATION_MS - BONUS_SEQUENCE_TARGET_MS;

    const playerSyncState = {
        questionStartedAt: 0,
        bonusActive: false
    };
    let playerSessionGen = 0;
    let lastPlayerSync = {
        currentQuestion: -2,
        questionStartedAt: 0,
        bonusActive: false,
        status: ''
    };

    function isPlayerDisconnected(player) {
        return player?.connectionStatus?.state === 'disconnected';
    }

    function getDisconnectedAt(player) {
        if (!player?.connectionStatus) return 0;
        return FirebaseService.getConnectionTimestamp
            ? FirebaseService.getConnectionTimestamp(player.connectionStatus)
            : (player.connectionStatus.at || 0);
    }

    // Answer slot shapes — shared by the host bars and the player tiles so a given
    // slot always looks the same on both screens.
    const ANSWER_SHAPE_ICONS = [
        'assets/images/live-quiz-icons/quiz-question-triangle.svg',
        'assets/images/live-quiz-icons/quiz-question-diamond.svg',
        'assets/images/live-quiz-icons/question-circle.svg',
        'assets/images/live-quiz-icons/quiz-question-square.svg'
    ];

    function getAnswerShapeHtml(index) {
        const src = ANSWER_SHAPE_ICONS[index];
        if (!src) return '';
        return `<img class="qg-shape-icon" src="${src}" alt="" aria-hidden="true">`;
    }

    // Questions saved before shortcut sub-formats existed default to click-the-caps.
    function getQuestionType(q) {
        if (!q) return 'mcq';
        if (q.type === 'shortcut') return 'shortcut';
        return 'mcq';
    }

    function getShortcutFormat(q) {
        if (!q || getQuestionType(q) !== 'shortcut') return null;
        const format = q.shortcutFormat || 'click';
        if (!window.ShortcutsData?.resolveQuizFormat || !q.shortcutId) return format;
        const shortcut = ShortcutsData.SHORTCUTS.find((s) => s.id === q.shortcutId);
        if (!shortcut) return format;
        return ShortcutsData.resolveQuizFormat(shortcut, format);
    }

    // Avatar library — named animal photos (assets/images/live-quiz-avatars/)
    const AVATAR_PATH = 'assets/images/live-quiz-avatars/';
    const AVATAR_IDS = [
        'animal_bat', 'animal_bear', 'animal_bee', 'animal_butterfly', 'animal_camel', 'animal_cat',
        'animal_chameleon', 'animal_clown_fish', 'animal_cow', 'animal_crocodile', 'animal_dog',
        'animal_dolphin', 'animal_flamingo', 'animal_fox', 'animal_frog', 'animal_gorilla',
        'animal_hamster', 'animal_horse', 'animal_hummingbird', 'animal_jellyfish', 'animal_koala',
        'animal_ladybug', 'animal_lion', 'animal_llama', 'animal_monkey', 'animal_owl', 'animal_panda',
        'animal_peacock', 'animal_penguin', 'animal_pig', 'animal_polar_bear', 'animal_rabbit',
        'animal_raccoon', 'animal_reindeer', 'animal_rhino', 'animal_sea_turtle', 'animal_shark',
        'animal_sheep', 'animal_sloth', 'animal_snake', 'animal_squirrel', 'animal_starfish',
        'animal_tiger', 'animal_toucan', 'animal_wolf'
    ];
    const AVATAR_EXT = {
        animal_toucan: 'jpg'
    };

    function resolveAvatarId(avatarId) {
        if (!avatarId) return '';
        if (AVATAR_IDS.includes(avatarId)) return avatarId;
        const legacy = /^animal_(\d+)$/.exec(avatarId);
        if (legacy) {
            const idx = parseInt(legacy[1], 10) - 1;
            if (idx >= 0 && idx < AVATAR_IDS.length) return AVATAR_IDS[idx];
        }
        return '';
    }

    function getAvatarSrc(avatarId) {
        const resolved = resolveAvatarId(avatarId);
        if (!resolved) return '';
        const ext = AVATAR_EXT[resolved] || 'png';
        return `${AVATAR_PATH}${resolved}.${ext}`;
    }

    function getAvatarLabel(avatarId) {
        const resolved = resolveAvatarId(avatarId);
        if (!resolved) return 'Avatar';
        return resolved.replace(/^animal_/, '').replace(/_/g, ' ');
    }

    function shuffledAvatarIds() {
        const ids = [...AVATAR_IDS];
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        return ids;
    }

    function pickRandomAvatarId() {
        return AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)];
    }

    let lobbyShareInitialized = false;
    let lobbyQrInstance = null;

    // Dev freeze — pause timers/auto-advance for layout/CSS tweaking (?freeze=1 only, this page load)
    let devFreeze = false;

    function clearPersistedDevFreeze() {
        try {
            localStorage.removeItem('qg-dev-freeze');
        } catch (_) { /* ignore */ }
    }
    clearPersistedDevFreeze();

    function parseDevFlags() {
        clearPersistedDevFreeze();
        const params = new URLSearchParams(window.location.search);
        devFreeze = params.has('freeze');
        if (devFreeze) {
            console.info('[QuizGame] Dev freeze ON for this page load (?freeze=1). Reload without the param to disable.');
        }
    }

    function isDevFreeze() {
        return devFreeze;
    }

    function setDevFreeze(on) {
        devFreeze = Boolean(on);
        console.info(`[QuizGame] Dev freeze ${on ? 'ON' : 'OFF'} (this page load only)`);
    }

    function delayUnlessFrozen(fn, ms) {
        if (isDevFreeze()) return null;
        return setTimeout(fn, ms);
    }

    // Entry mode: host (from Tools) vs student (shared join link / QR)
    let isStudentEntry = false;
    let isHostEntry = true;
    let urlJoinCode = null;

    function formatPlayerCountLabel(count) {
        if (count === 1) return '1 player joined';
        return count + ' players joined';
    }

    function getPageBaseUrl() {
        return window.location.origin + window.location.pathname;
    }

    function getStudentJoinUrl(code) {
        const params = new URLSearchParams({ join: '1' });
        if (code) params.set('code', String(code).trim().toUpperCase());
        return `${getPageBaseUrl()}?${params.toString()}`;
    }

    function parseEntryMode() {
        const params = new URLSearchParams(window.location.search);
        urlJoinCode = params.get('code')?.trim().toUpperCase() || null;
        isStudentEntry = params.has('join') || Boolean(urlJoinCode);
        isHostEntry = params.has('host') || !isStudentEntry;
    }

    function stripJoinParamsFromUrl() {
        if (!window.location.search) return;
        const params = new URLSearchParams(window.location.search);
        if (!params.has('join') && !params.has('code')) return;
        params.delete('join');
        params.delete('code');
        const qs = params.toString();
        const next = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
        history.replaceState(null, '', next);
    }

    function applyEntryModeUI() {
        $('btn-role-host')?.classList.toggle('qg-hidden', isStudentEntry);
        $('btn-back-to-tools')?.classList.toggle('qg-hidden', !isHostEntry);
        $('btn-join-back')?.classList.toggle('qg-hidden', isStudentEntry);
        document.querySelector('.qg-role-cards')
            ?.classList.toggle('qg-role-cards--join-only', isStudentEntry);
    }

    function applyStudentEntryRoute() {
        applyEntryModeUI();
        if (!isStudentEntry) return;

        if (urlJoinCode) {
            $('join-code').value = urlJoinCode;
        }
        stripJoinParamsFromUrl();
        showScreen('screen-join');
    }

    function goToEntryHome() {
        if (isStudentEntry) {
            applyStudentEntryRoute();
        } else {
            applyEntryModeUI();
            showScreen('screen-role');
        }
    }

    function getDefaultShareUrl() {
        return getStudentJoinUrl(gameCode);
    }

    function isLocalhostHost() {
        const h = window.location.hostname;
        return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
    }

    function renderLobbyQR() {
        const urlInput = $('lobby-share-url');
        const qrWrap = $('lobby-qr-wrap');
        if (!urlInput || !qrWrap) return;

        const url = urlInput.value.trim() || getDefaultShareUrl();
        qrWrap.innerHTML = '';
        lobbyQrInstance = null;

        if (typeof QRCode !== 'undefined') {
            lobbyQrInstance = new QRCode(qrWrap, {
                text: url,
                width: 112,
                height: 112,
                colorDark: '#2d1b4e',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        }
    }

    function updateLobbyShareUI(code) {
        const urlInput = $('lobby-share-url');
        const tip = $('lobby-localhost-tip');
        if (!urlInput) return;

        const shareCode = code || gameCode;
        if (shareCode) {
            urlInput.value = getStudentJoinUrl(shareCode);
            lobbyShareInitialized = true;
        } else if (!lobbyShareInitialized) {
            urlInput.value = getPageBaseUrl() + '?join=1';
            lobbyShareInitialized = true;
        }

        if (tip) tip.hidden = !isLocalhostHost();
        renderLobbyQR();
    }

    // Sound
    let audioCtx = null;
    let soundEnabled = true;
    let musicEnabled = true;
    let lastQuestionTrackIndex = null;
    let currentQuestionTrackIndex = null;
    const QUESTION_TRACK_VOLUME = 0.55;

    // Google Drive
    let driveService = null;
    let customQuizDriveService = null;
    let lastSortedResults = [];

    // ===== DOM REFS =====
    const $ = id => document.getElementById(id);

    function safeSetLocalStorage(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (err) {
            console.warn(`[QuizGame] Could not save "${key}" to localStorage:`, err);
            return false;
        }
    }

    function safeGetLocalStorage(key, fallback = null) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : value;
        } catch (err) {
            console.warn(`[QuizGame] Could not read "${key}" from localStorage:`, err);
            return fallback;
        }
    }

    // ===== INITIALIZATION =====
    function init() {
        parseDevFlags();
        parseEntryMode();
        bindEvents();
        initWaitingMiniGames();

        try {
            loadQuizTheme();
        } catch (err) {
            console.warn('[QuizGame] Could not load saved theme:', err);
            applyQuizTheme('default', false, { persist: false });
        }

        updateFloatingThemeBtn('screen-role');

        FirebaseService.init().then(user => {
            populateCategories();
            initAvatarGrids();
            addCustomRows(4);
            initDriveService();
            initCustomQuizDriveService();

            // Host Resumption Logic: If we have a saved code and we are the host, resume host role
            const savedCode = sessionStorage.getItem('qg-last-code');
            if (savedCode && user) {
                FirebaseService.getSession(savedCode).then(session => {
                    if (!session) {
                        applyStudentEntryRoute();
                        return;
                    }

                    if (session.hostId === user.uid) {
                        console.log(`[QuizGame] Resuming host role for session: ${savedCode}`);
                        role = 'host';
                        enforceHostTheme();
                        gameCode = savedCode;
                        config = session.config || {};
                        questions = session.questions || [];

                        if (session.status === 'lobby') {
                            showLobby(savedCode);
                            const unsub = FirebaseService.onPlayersChange(savedCode, p => {
                                players = p || {};
                                renderLobbyPlayers();
                            });
                            listeners.push(unsub);
                        } else {
                            startHostGame();
                        }
                    } else if (session.players && session.players[user.uid]) {
                        console.log(`[QuizGame] Resuming player role for session: ${savedCode}`);
                        role = 'player';
                        gameCode = savedCode;
                        playerName = session.players[user.uid].name;
                        selectedAvatar = resolveAvatarId(session.players[user.uid].avatar)
                            || session.players[user.uid].avatar;

                        // Determine where to land
                        const status = session.status;
                        if (status === 'lobby') {
                            // Re-setup player lobby state
                            if (selectedAvatar) {
                                $('waiting-avatar').innerHTML =
                                    `<img src="${getAvatarSrc(selectedAvatar)}" alt="Your avatar">`;
                            }
                            $('waiting-name').textContent = playerName;
                            resetWaitingMiniGamesForLobby();
                            showScreen('screen-waiting');
                        } else if (status === 'countdown') {
                            teardownWaitingMiniGames();
                            runCountdown(() => listenAsPlayer());
                        } else if (status === 'finished') {
                            showResults();
                        } else {
                            listenAsPlayer();
                        }

                        // Re-attach all player-side listeners consistently
                        setupPlayerListeners();
                    } else {
                        applyStudentEntryRoute();
                    }
                }).catch(() => applyStudentEntryRoute());
            } else {
                applyStudentEntryRoute();
            }
        });
    }

    function initDriveService() {
        if (typeof GoogleDriveService !== 'undefined') {
            driveService = new GoogleDriveService({
                folderName: 'ESL Quiz Scoreboards',
                fileExtension: '.json',
                onSave: () => ({
                    gameCode: gameCode,
                    date: new Date().toLocaleString(),
                    results: lastSortedResults
                }),
                onNotify: (msg, type) => {
                    // Using basic alert if no toast system exists here
                    console.log(`[Drive] ${type}: ${msg}`);
                }
            });
        }
    }

    function initCustomQuizDriveService() {
        if (typeof GoogleDriveService !== 'undefined') {
            customQuizDriveService = new GoogleDriveService({
                folderName: 'ESL Custom Quizzes',
                fileExtension: '.json',
                onSave: () => {
                    const validRows = customRows.filter(r => r.type === 'shortcut'
                        ? Boolean(r.shortcutId)
                        : (r.question.trim() && r.options.some(opt => opt.trim())));
                    if (validRows.length === 0) {
                        alert('Your quiz is empty. Add at least one question with options to save.');
                        return null;
                    }
                    return validRows.map(r => ({
                        type: r.type || 'mcq',
                        shortcutId: r.shortcutId || '',
                        question: r.question,
                        options: r.options,
                        correctIndex: r.correctIndex,
                        imageData: r.imageData,
                        imageName: r.imageName,
                        audioData: r.audioData,
                        audioName: r.audioName
                    }));
                },
                onLoad: (data, filename) => {
                    if (!Array.isArray(data)) {
                        alert('Invalid custom quiz format.');
                        return;
                    }
                    // Clear existing
                    $('custom-list').innerHTML = '';
                    customRows = [];

                    data.forEach(rowData => {
                        const rowId = 'cq-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
                        const newRow = {
                            id: rowId,
                            type: rowData.type === 'shortcut' ? 'shortcut' : 'mcq',
                            shortcutId: rowData.shortcutId || '',
                            question: rowData.question || '',
                            options: rowData.options || ['', '', '', ''],
                            correctIndex: rowData.correctIndex !== undefined ? rowData.correctIndex : 0,
                            imageData: rowData.imageData || null,
                            imageName: rowData.imageName || '',
                            audioData: rowData.audioData || null,
                            audioName: rowData.audioName || ''
                        };
                        customRows.push(newRow);
                        renderCustomRow($('custom-list'), newRow, customRows.length);
                    });

                    // Add empty row if none loaded
                    if (customRows.length === 0) {
                        addCustomRows(1);
                    }
                },
                onNotify: (msg, type) => {
                    console.log(`[Custom Quiz Drive] ${type}: ${msg}`);
                    if (type === 'error') {
                        alert(`Save/Load Error: ${msg}`);
                    }
                }
            });
        }
    }

    function bindEvents() {
        $('btn-role-host').addEventListener('click', () => showScreen('screen-setup'));
        $('btn-role-join').addEventListener('click', () => showScreen('screen-join'));
        $('btn-setup-back').addEventListener('click', () => goToEntryHome());
        $('btn-join-back').addEventListener('click', () => goToEntryHome());
        $('btn-create-game').addEventListener('click', createGame);
        $('btn-join-next').addEventListener('click', joinStep1);
        $('btn-avatar-back').addEventListener('click', () => showScreen('screen-join'));
        $('btn-join-game').addEventListener('click', joinStep2);
        $('btn-lobby-cancel').addEventListener('click', cancelLobby);
        $('btn-start-game').addEventListener('click', startCountdown);

        const shareUrlInput = $('lobby-share-url');
        if (shareUrlInput) {
            shareUrlInput.addEventListener('change', renderLobbyQR);
            shareUrlInput.addEventListener('blur', renderLobbyQR);
        }

        $('btn-copy-join-url')?.addEventListener('click', (e) => copyLobbyText($('lobby-share-url')?.value.trim(), e.currentTarget));
        $('btn-copy-game-code')?.addEventListener('click', (e) => copyLobbyText(gameCode || '', e.currentTarget));

        const toggleShareUrlBtn = $('btn-toggle-share-url');
        const shareUrlExpand = $('lobby-url-expand');
        if (toggleShareUrlBtn && shareUrlExpand) {
            toggleShareUrlBtn.addEventListener('click', () => {
                const willExpand = shareUrlExpand.hidden;
                shareUrlExpand.hidden = !willExpand;
                toggleShareUrlBtn.setAttribute('aria-expanded', String(willExpand));
                if (willExpand) {
                    $('lobby-share-url')?.focus();
                }
            });
        }
        $('btn-remove-inactive-players')?.addEventListener('click', removeInactivePlayers);
        $('btn-play-again').addEventListener('click', playAgain);
        $('btn-new-game').addEventListener('click', () => {
            sessionStorage.removeItem('qg-last-code');
            cleanup();
            goToEntryHome();
        });
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
        $('b-minus').addEventListener('click', () => adjustStepper('b-count', -1, 1, 10));
        $('b-plus').addEventListener('click', () => adjustStepper('b-count', 1, 1, 10));

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

        // Shortcut Combo answer controls
        $('btn-shortcut-submit')?.addEventListener('click', submitShortcutAnswer);
        $('btn-shortcut-clear')?.addEventListener('click', clearShortcutSelection);
        $('btn-sv-music')?.addEventListener('click', toggleStudentQuestionMusic);

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
                $('shortcuts-mode').classList.toggle('qg-hidden', sourceMode !== 'shortcuts');
            });
        });

        // Custom quiz buttons
        $('btn-add-row').addEventListener('click', () => addCustomRows(1));

        const btnCustomSaveDrive = $('btn-custom-save-drive');
        if (btnCustomSaveDrive) {
            btnCustomSaveDrive.addEventListener('click', () => {
                if (customQuizDriveService) customQuizDriveService.openModal();
            });
        }

        const btnCustomLoadDrive = $('btn-custom-load-drive');
        if (btnCustomLoadDrive) {
            btnCustomLoadDrive.addEventListener('click', () => {
                if (customQuizDriveService) customQuizDriveService.openModal();
            });
        }

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

        // Lobby theme picker bars
        renderThemePicker();
        const themePicker = $('theme-picker-list');
        if (themePicker) {
            themePicker.addEventListener('click', (e) => {
                const bar = e.target.closest('.qg-theme-bar');
                if (!bar) return;
                const theme = bar.dataset.theme;
                const isDark = $('quiz-app').classList.contains('qg-dark');
                applyQuizTheme(theme, isDark);
            });
        }

        document.querySelectorAll('.qg-open-theme-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isThemePanelOpen()) closeThemePanel();
                else openThemePanel();
            });
        });

        $('theme-dropdown-backdrop')?.addEventListener('click', () => {
            closeThemePanel();
        });

        $('overlay-theme-modal')?.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        const btnCloseThemeModal = $('btn-close-theme-modal');
        if (btnCloseThemeModal) {
            btnCloseThemeModal.addEventListener('click', (e) => {
                e.stopPropagation();
                closeThemePanel();
            });
        }

        // Lobby dark mode toggle
        const darkCheckbox = $('qg-dark-checkbox');
        if (darkCheckbox) {
            darkCheckbox.addEventListener('change', () => {
                const app = $('quiz-app');
                const isDark = darkCheckbox.checked;
                const currentTheme = app.dataset.theme || 'default';
                applyQuizTheme(currentTheme, isDark);

                if (isDark) {
                    document.body.classList.add('dark-mode');
                    safeSetLocalStorage('dark-mode', 'enabled');
                } else {
                    document.body.classList.remove('dark-mode');
                    safeSetLocalStorage('dark-mode', 'disabled');
                }
            });
        }

        $('btn-download-results')?.addEventListener('click', downloadScoreboard);
        $('btn-save-drive')?.addEventListener('click', () => driveService?.openModal());
    }

    function adjustStepper(id, delta, min, max) {
        const el = $(id);
        let val = parseInt(el.textContent) + delta;
        val = Math.max(min, Math.min(max, val));
        el.textContent = val;
    }

    // ===== CATEGORIES =====
    function copyLobbyText(text, buttonEl) {
        if (!text) return;
        const showCopied = () => {
            if (!buttonEl) return;
            const original = buttonEl.innerHTML;
            buttonEl.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
            setTimeout(() => {
                buttonEl.innerHTML = original;
            }, 1600);
        };

        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(showCopied).catch(() => {});
        }
    }

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
            const rowData = { id: rowId, type: 'mcq', shortcutId: '', question: '', options: ['', '', '', ''], correctIndex: 0, imageData: null, audioData: null, imageName: '', audioName: '' };
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
                <div class="qg-custom-type-row">
                    <select class="cq-type" aria-label="Question type">
                        <option value="mcq">Multiple Choice</option>
                        <option value="shortcut">Shortcut Combo</option>
                    </select>
                    <select class="cq-shortcut" aria-label="Shortcut"></select>
                </div>
                <input type="text" class="cq-question" placeholder="Enter question..." maxlength="150">
                <div class="qg-custom-options-grid"></div>
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
        const qInput = row.querySelector('.cq-question');
        qInput.value = rowData.question || '';
        qInput.addEventListener('input', e => { rowData.question = e.target.value; });

        // Question type: Multiple Choice or Shortcut Combo
        const typeSelect = row.querySelector('.cq-type');
        const shortcutSelect = row.querySelector('.cq-shortcut');
        const pool = window.ShortcutsData ? ShortcutsData.QUIZ_POOL : [];

        shortcutSelect.innerHTML = pool
            .map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.label)} — ${escapeHtml(ShortcutsData.formatCombo(s))}</option>`)
            .join('');
        if (!rowData.shortcutId && pool.length) rowData.shortcutId = pool[0].id;
        shortcutSelect.value = rowData.shortcutId || '';
        shortcutSelect.addEventListener('change', e => { rowData.shortcutId = e.target.value; });

        const applyRowType = () => {
            const isShortcut = rowData.type === 'shortcut';
            row.classList.toggle('qg-custom-row-shortcut', isShortcut);
            shortcutSelect.classList.toggle('qg-hidden', !isShortcut);
            qInput.classList.toggle('qg-hidden', isShortcut);
            row.querySelector('.qg-custom-options-grid').classList.toggle('qg-hidden', isShortcut);
        };

        typeSelect.value = rowData.type === 'shortcut' ? 'shortcut' : 'mcq';
        typeSelect.addEventListener('change', e => {
            rowData.type = e.target.value;
            applyRowType();
        });
        if (!pool.length) typeSelect.querySelector('option[value="shortcut"]').disabled = true;
        applyRowType();

        const optionsGrid = row.querySelector('.qg-custom-options-grid');
        for (let i = 0; i < 4; i++) {
            const optWrapper = document.createElement('div');
            optWrapper.className = 'qg-custom-option-wrapper';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'correct-' + rowData.id;
            radio.checked = rowData.correctIndex === i;
            radio.addEventListener('change', () => { rowData.correctIndex = i; });

            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.placeholder = 'Option ' + (i + 1);
            textInput.maxLength = 60;
            textInput.value = rowData.options && rowData.options[i] ? rowData.options[i] : '';
            textInput.addEventListener('input', e => {
                if (!rowData.options) rowData.options = ['', '', '', ''];
                rowData.options[i] = e.target.value;
            });

            optWrapper.appendChild(radio);
            optWrapper.appendChild(textInput);
            optionsGrid.appendChild(optWrapper);
        }

        // Image upload
        const imgBtn = row.querySelector('.cq-img-btn');
        const imgInput = row.querySelector('.cq-img-input'); // Corrected: This should be imgInput
        const audioBtn = row.querySelector('.cq-audio-btn'); // Added: Need audioBtn here for initial state
        const audioInput = row.querySelector('.cq-audio-input'); // Added: Need audioInput here for initial state

        // Initial state for loaded rows
        if (rowData.imageName) {
            imgBtn.classList.add('has-file');
            imgBtn.querySelector('.file-name').textContent = rowData.imageName.length > 12 ? rowData.imageName.slice(0, 10) + '…' : rowData.imageName;
        }
        if (rowData.audioName) {
            audioBtn.classList.add('has-file');
            audioBtn.querySelector('.file-name').textContent = rowData.audioName.length > 12 ? rowData.audioName.slice(0, 10) + '…' : rowData.audioName;
        }



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
        const validRows = customRows.filter(r => r.type === 'shortcut'
            ? Boolean(r.shortcutId)
            : (r.question.trim() && r.options.filter(o => o.trim()).length >= 2));

        if (validRows.length === 0) {
            alert('Please add at least 1 question with at least 2 options.');
            return null;
        }

        const qs = [];

        for (let i = 0; i < validRows.length; i++) {
            const item = validRows[i];

            if (item.type === 'shortcut') {
                const shortcut = window.ShortcutsData
                    ? ShortcutsData.SHORTCUTS.find(s => s.id === item.shortcutId)
                    : null;
                const built = shortcut ? buildShortcutQuestion(shortcut, 'click', ShortcutsData.QUIZ_POOL) : null;
                if (built) qs.push(built);
                continue;
            }

            const rawOptions = item.options.map((opt, idx) => ({ opt: opt.trim(), isCorrect: idx === item.correctIndex }));
            let validOptions = rawOptions.filter(o => o.opt);

            let correctOption = validOptions.find(o => o.isCorrect);
            if (!correctOption) {
                validOptions[0].isCorrect = true;
                correctOption = validOptions[0];
            }

            shuffle(validOptions);

            qs.push({
                text: item.question.trim(),
                options: validOptions.map(s => s.opt),
                correctIndex: validOptions.findIndex(s => s.isCorrect),
                word: item.question.trim().slice(0, 20),
                imageData: item.imageData || null,
                audioData: item.audioData || null
            });
        }

        return qs;
    }

    // ===== AVATAR SYSTEM =====
    function initAvatarGrids() {
        populateAvatarGrid('avatar-grid-select', { animate: false });
        populateAvatarGrid('avatar-grid-waiting', { animate: false });
    }

    function populateAvatarGrid(containerId, options = {}) {
        const container = $(containerId);
        if (!container) return;

        const animate = options.animate !== false;
        const selectedId = resolveAvatarId(selectedAvatar);
        container.innerHTML = '';

        shuffledAvatarIds().forEach((avatarId, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'qg-avatar-option' + (animate ? ' qg-avatar-pop-in' : '');
            if (animate) {
                btn.style.setProperty('--qg-avatar-pop-delay', `${Math.min(index * 30, 1100)}ms`);
            }
            btn.dataset.avatar = avatarId;
            const label = getAvatarLabel(avatarId);
            btn.innerHTML = `<img src="${getAvatarSrc(avatarId)}" alt="${label}" loading="lazy">`;
            btn.addEventListener('click', () => selectAvatar(avatarId));
            if (selectedId && selectedId === avatarId) {
                btn.classList.add('selected');
            }
            container.appendChild(btn);
        });
    }

    function selectAvatar(avatarId) {
        const resolved = resolveAvatarId(avatarId);
        if (!resolved) return;
        selectedAvatar = resolved;

        // Sync selection across all grids
        document.querySelectorAll('.qg-avatar-option').forEach(opt => {
            opt.classList.toggle('selected', resolveAvatarId(opt.dataset.avatar) === resolved);
        });

        // Update waiting screen avatar display
        const waitingAvatar = $('waiting-avatar');
        if (waitingAvatar) {
            waitingAvatar.innerHTML = `<img src="${getAvatarSrc(resolved)}" alt="Your avatar">`;
        }

        // Update Firebase if in session
        if (gameCode && !FirebaseService.isDemo()) {
            FirebaseService.updateSessionField(gameCode, 'players/' + FirebaseService.getUid() + '/avatar', resolved);
        }

        playSound('click');
    }

    function toggleWaitingAvatars() {
        const modal = $('overlay-avatar-modal');
        const opening = !modal.classList.contains('active');
        modal.classList.toggle('active');
        if (opening) {
            populateAvatarGrid('avatar-grid-waiting', { animate: true });
        }
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

        const jumpInterval = setInterval(() => {
            playSound('click');
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

    /**
     * Shortcut questions use three player-facing formats that rotate in the
     * Keyboard Shortcuts source: click caps, pick the combo (MCQ), or press live.
     */
    function buildShortcutClickQuestion(shortcut) {
        const keys = ShortcutsData.comboCapKeys(shortcut);
        if (!keys) return null;

        return {
            type: 'shortcut',
            shortcutFormat: 'click',
            text: `Click the keys for: "${shortcut.label}"`,
            shortcutId: shortcut.id,
            keys: keys,
            combo: ShortcutsData.formatCombo(shortcut),
            options: ['Incorrect', 'Correct'],
            correctIndex: 1,
            word: shortcut.label,
            category: shortcut.category
        };
    }

    function buildShortcutMcqQuestion(shortcut, pool) {
        const keys = ShortcutsData.comboCapKeys(shortcut);
        if (!keys) return null;

        const correctCombo = ShortcutsData.formatCombo(shortcut);
        const distractors = shuffle([...pool])
            .filter((s) => s.id !== shortcut.id)
            .slice(0, 3)
            .map((s) => ShortcutsData.formatCombo(s));

        while (distractors.length < 3) {
            distractors.push('Ctrl + Z');
        }

        const options = shuffle([correctCombo, ...distractors.slice(0, 3)]);
        return {
            type: 'shortcut',
            shortcutFormat: 'mcq',
            text: `What is the keyboard shortcut for "${shortcut.label}"?`,
            shortcutId: shortcut.id,
            keys: keys,
            combo: correctCombo,
            options: options,
            correctIndex: options.indexOf(correctCombo),
            word: shortcut.label,
            category: shortcut.category
        };
    }

    function buildShortcutLiveQuestion(shortcut) {
        const keys = ShortcutsData.comboCapKeys(shortcut);
        if (!keys) return null;

        return {
            type: 'shortcut',
            shortcutFormat: 'live',
            text: `Press the keyboard shortcut for "${shortcut.label}"`,
            shortcutId: shortcut.id,
            keys: keys,
            combo: ShortcutsData.formatCombo(shortcut),
            options: ['Incorrect', 'Correct'],
            correctIndex: 1,
            word: shortcut.label,
            category: shortcut.category
        };
    }

    function buildShortcutQuestion(shortcut, format, pool) {
        const resolved = ShortcutsData.resolveQuizFormat
            ? ShortcutsData.resolveQuizFormat(shortcut, format)
            : format;
        if (resolved === 'mcq') return buildShortcutMcqQuestion(shortcut, pool);
        if (resolved === 'live') return buildShortcutLiveQuestion(shortcut);
        return buildShortcutClickQuestion(shortcut);
    }

    function generateShortcutQuestions(count) {
        if (!window.ShortcutsData) {
            alert('Shortcut data failed to load. Please refresh the page.');
            return null;
        }

        const pool = shuffle([...ShortcutsData.QUIZ_POOL]);
        if (pool.length === 0) {
            alert('No shortcuts are available for a quiz.');
            return null;
        }

        const formats = [];
        for (let i = 0; i < count; i++) {
            formats.push(['click', 'mcq', 'live'][i % 3]);
        }
        shuffle(formats);

        return pool.slice(0, count).map((shortcut, i) => {
            return buildShortcutQuestion(shortcut, formats[i], pool);
        }).filter(Boolean);
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
            gameMode: gameMode,
            bonusEnabled: $('opt-bonus-stage').checked,
            bonusFrequency: parseInt($('b-count').textContent)
        };
        soundEnabled = config.sound;
        musicEnabled = config.sound;

        if (sourceMode === 'custom') {
            questions = generateCustomQuestions();
            if (!questions || questions.length === 0) return;
            config.totalQuestions = questions.length;
        } else if (sourceMode === 'shortcuts') {
            questions = generateShortcutQuestions(parseInt($('q-count').textContent));
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
        enforceHostTheme();

        FirebaseService.createSession(config, questions).then(code => {
            gameCode = code;

            // Save code for host resumption on refresh
            sessionStorage.setItem('qg-last-code', code);

            if (!FirebaseService.isDemo()) {
                // Automatically delete the session if the host closes/re freshes the page
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
        updateLobbyShareUI(code);
        renderLobbyPlayers();
        showScreen('screen-lobby');
        // Show session code badge for host
        showSessionBadge(code);
    }

    function hasLobbyAvatar(avatarId) {
        return !!resolveAvatarId(avatarId);
    }

    function isLobbyPlayerPending(p) {
        return !p.name?.trim() || !hasLobbyAvatar(p.avatar);
    }

    function getLobbyNameLoadingHtml() {
        return `<span class="qg-lobby-name-loading" aria-label="Loading player" role="status">
            <span></span><span></span><span></span><span></span>
        </span>`;
    }

    function getLobbyAvatarInnerHtml(avatarId) {
        const resolved = resolveAvatarId(avatarId);
        if (resolved) {
            return `<img class="player-avatar-img" src="${getAvatarSrc(resolved)}" alt="">`;
        }
        return '<i class="fa-solid fa-user" aria-hidden="true"></i>';
    }

    function renderLobbyPlayerName(nameEl, p) {
        if (!nameEl) return;
        if (isLobbyPlayerPending(p)) {
            if (!nameEl.querySelector('.qg-lobby-name-loading')) {
                nameEl.innerHTML = getLobbyNameLoadingHtml();
            }
        } else {
            nameEl.textContent = p.name;
        }
    }

    function setLobbyPlayerPending(el, pending) {
        el.classList.toggle('qg-lobby-player--pending', pending);
    }

    function createLobbyPlayerCard(uid, p, staggerIndex) {
        const div = document.createElement('div');
        div.className = 'qg-lobby-player';
        div.dataset.playerUid = uid;
        div.dataset.playerAvatar = p.avatar || '';
        div.dataset.playerName = p.name || '';
        div.style.animationDelay = (staggerIndex * 0.05) + 's';

        const disconnected = isPlayerDisconnected(p);
        const pending = isLobbyPlayerPending(p);
        if (disconnected) div.classList.add('qg-lobby-player--disconnected');
        setLobbyPlayerPending(div, pending);

        const avatarWrap = document.createElement('div');
        avatarWrap.className = 'qg-lobby-player-avatar';
        avatarWrap.innerHTML = getLobbyAvatarInnerHtml(p.avatar || '');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name';
        renderLobbyPlayerName(nameSpan, p);

        div.appendChild(avatarWrap);
        div.appendChild(nameSpan);

        if (disconnected) {
            const badge = document.createElement('span');
            badge.className = 'qg-reconnect-badge';
            badge.textContent = 'Reconnecting…';
            div.appendChild(badge);
        }

        if (role === 'host') {
            const bootBtn = document.createElement('button');
            bootBtn.className = 'qg-boot-btn';
            bootBtn.setAttribute('aria-label', `Remove ${p.name}`);
            bootBtn.dataset.uid = uid;
            bootBtn.dataset.name = p.name;
            bootBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            bootBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                bootPlayer(bootBtn.dataset.uid, bootBtn.dataset.name);
            });
            div.appendChild(bootBtn);
        }

        return div;
    }

    function updateLobbyPlayerCard(el, p) {
        const disconnected = isPlayerDisconnected(p);
        el.classList.toggle('qg-lobby-player--disconnected', disconnected);

        const avatarId = p.avatar || '';
        const playerName = p.name || '';
        const pending = isLobbyPlayerPending(p);
        setLobbyPlayerPending(el, pending);

        if (el.dataset.playerAvatar !== avatarId) {
            const avatarEl = el.querySelector('.qg-lobby-player-avatar');
            if (avatarEl) avatarEl.innerHTML = getLobbyAvatarInnerHtml(avatarId);
            el.dataset.playerAvatar = avatarId;
        }

        const nameEl = el.querySelector('.player-name');
        renderLobbyPlayerName(nameEl, p);
        el.dataset.playerName = playerName;

        const badge = el.querySelector('.qg-reconnect-badge');
        if (disconnected) {
            if (!badge) {
                const newBadge = document.createElement('span');
                newBadge.className = 'qg-reconnect-badge';
                newBadge.textContent = 'Reconnecting…';
                const bootBtn = el.querySelector('.qg-boot-btn');
                if (bootBtn) el.insertBefore(newBadge, bootBtn);
                else el.appendChild(newBadge);
            }
        } else if (badge) {
            badge.remove();
        }

        const bootBtn = el.querySelector('.qg-boot-btn');
        if (bootBtn) {
            bootBtn.setAttribute('aria-label', `Remove ${p.name}`);
            bootBtn.dataset.name = p.name;
        }
    }

    function renderLobbyPlayers() {
        const container = $('lobby-players');
        if (!container) return;

        const count = Object.keys(players).length;
        const countLabel = $('player-count-label');
        if (countLabel) countLabel.textContent = formatPlayerCountLabel(count);
        $('btn-start-game').disabled = count < 1;

        const inactiveBtn = $('btn-remove-inactive-players');
        const hasInactive = role === 'host' && Object.values(players).some(isPlayerDisconnected);
        if (inactiveBtn) inactiveBtn.hidden = !hasInactive;

        const activeUids = new Set(Object.keys(players));

        lobbyPlayerCardMap.forEach((el, uid) => {
            if (!activeUids.has(uid)) {
                el.remove();
                lobbyPlayerCardMap.delete(uid);
            }
        });

        Object.entries(players).forEach(([uid, p]) => {
            const existing = lobbyPlayerCardMap.get(uid);
            if (existing) {
                updateLobbyPlayerCard(existing, p);
                return;
            }

            const staggerIndex = lobbyPlayerCardMap.size;
            const card = createLobbyPlayerCard(uid, p, staggerIndex);
            container.appendChild(card);
            lobbyPlayerCardMap.set(uid, card);
        });
    }

    function bootPlayer(uid, name) {
        if (role !== 'host' || !uid) return;

        const label = name || 'this student';
        if (!confirm(`Remove ${label} from the session?`)) return;

        // Immediately remove from local state for instant UI feedback
        delete players[uid];
        renderLobbyPlayers();

        if ($('teacher-view')?.classList.contains('active')) {
            updateHostLeaderboard();
            if ((config.gameMode || 'automatic') !== 'student-paced') {
                updateAnswerCounts();
            }
            const totalEl = $('tv-total-players');
            if (totalEl) totalEl.textContent = Object.keys(players).length;
        }

        // Mark kicked + delete player node so answer/score writes cannot recreate them
        const kickFn = FirebaseService.kickPlayer || FirebaseService.removePlayer;
        kickFn(gameCode, uid).catch(err => {
            console.error('[QuizGame] Failed to boot player:', err);
        });
    }

    function attachHostLbBootButton(row, entry) {
        if (role !== 'host' || !row || !entry?.uid) return;

        let bootBtn = row.querySelector('.qg-tv-lb-boot');
        if (!bootBtn) {
            bootBtn = document.createElement('button');
            bootBtn.type = 'button';
            bootBtn.className = 'qg-boot-btn qg-tv-lb-boot';
            bootBtn.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
            bootBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                bootPlayer(bootBtn.dataset.uid, bootBtn.dataset.name);
            });
            row.appendChild(bootBtn);
        }

        bootBtn.dataset.uid = entry.uid;
        bootBtn.dataset.name = entry.name || '';
        bootBtn.setAttribute('aria-label', `Remove ${entry.name || 'student'}`);
        bootBtn.title = `Remove ${entry.name || 'student'}`;
    }

    function removeInactivePlayers() {
        if (role !== 'host' || !gameCode) return;

        const now = Date.now();
        const stale = Object.entries(players).filter(([uid, p]) => {
            if (!isPlayerDisconnected(p)) return false;
            const disconnectedAt = getDisconnectedAt(p) || now;
            return (now - disconnectedAt) >= INACTIVE_PLAYER_GRACE_MS;
        });

        if (stale.length === 0) {
            alert(`No players have been disconnected for ${INACTIVE_PLAYER_GRACE_MS / 1000} seconds or longer.`);
            return;
        }

        if (!confirm(`Remove ${stale.length} inactive player${stale.length === 1 ? '' : 's'}?`)) return;

        Promise.all(stale.map(([uid]) => {
            delete players[uid];
            const kickFn = FirebaseService.kickPlayer || FirebaseService.removePlayer;
            return kickFn(gameCode, uid);
        })).then(() => {
            renderLobbyPlayers();
            if ($('teacher-view')?.classList.contains('active')) {
                updateHostLeaderboard();
            }
        }).catch(err => {
            console.error('[QuizGame] Failed to remove inactive players:', err);
        });
    }

    function cancelLobby() {
        if (gameCode) FirebaseService.deleteSession(gameCode);
        sessionStorage.removeItem('qg-last-code');
        cleanup();
        goToEntryHome();
    }

    function showDisconnectScreen(title, message) {
        clearInterval(timerInterval);
        clearTimeout(kickCheckTimer);
        stopLiveShortcutListener();
        hideWaitingOverlay();
        hideShortcutPanels();
        onLiveStandings = false;
        $('booted-title').textContent = title;
        $('booted-message').textContent = message;
        showScreen('screen-booted');
    }

    function handlePlayerKicked() {
        if (playerKicked || role !== 'player') return;
        playerKicked = true;
        clearInterval(timerInterval);
        clearTimeout(kickCheckTimer);
        stopLiveShortcutListener();
        hideWaitingOverlay();
        hideShortcutPanels();
        onLiveStandings = false;
        hasAnswered = true;
        sessionStorage.removeItem('qg-last-code');
        if (gameCode && FirebaseService.cancelPlayerDisconnect) {
            FirebaseService.cancelPlayerDisconnect(gameCode);
        }
        showDisconnectScreen('Oops!', 'You have been removed from the session by the host.');
    }

    // ===== PLAYER: JOIN GAME (Two-step) =====
    function joinStep1() {
        const code = $('join-code').value.trim().toUpperCase();
        const name = $('join-name').value.trim();
        const nextBtn = $('btn-join-next');
        const errorEl = $('join-error');

        errorEl.textContent = '';

        if (!code || code.length < 4) {
            errorEl.textContent = 'Please enter a valid game code.';
            return;
        }
        if (!name) {
            errorEl.textContent = 'Please enter your name.';
            return;
        }

        if (nextBtn) nextBtn.disabled = true;
        errorEl.textContent = 'Checking…';

        FirebaseService.getSession(code).then(session => {
            if (nextBtn) nextBtn.disabled = false;

            if (!session) {
                errorEl.textContent = 'Could not find a game with that code. Check the code and try again.';
                return;
            }

            gameCode = code;
            playerName = name;
            selectedAvatar = null;
            document.querySelectorAll('.qg-avatar-option').forEach(o => o.classList.remove('selected'));
            showScreen('screen-avatar');
            populateAvatarGrid('avatar-grid-select', { animate: true });
        }).catch(err => {
            if (nextBtn) nextBtn.disabled = false;
            errorEl.textContent = 'Could not join game. Check your code and connection.';
            console.error(err);
        });
    }

    function joinStep2() {
        if (!selectedAvatar) {
            selectedAvatar = pickRandomAvatarId();
        } else {
            selectedAvatar = resolveAvatarId(selectedAvatar) || pickRandomAvatarId();
        }

        role = 'player';

        // Save code so player can rejoin after accidental close
        sessionStorage.setItem('qg-last-code', gameCode);

        FirebaseService.joinSession(gameCode, playerName).then(sessionData => {
            // Update avatar in Firebase
            if (!FirebaseService.isDemo()) {
                FirebaseService.updateSessionField(gameCode, 'players/' + FirebaseService.getUid() + '/avatar', selectedAvatar);
            }

            const resolved = resolveAvatarId(selectedAvatar);
            if (resolved) {
                $('waiting-avatar').innerHTML = `<img src="${getAvatarSrc(resolved)}" alt="Your avatar">`;
            }
            $('waiting-name').textContent = playerName;

            // Detect if the game is already running (rejoin scenario)
            const currentStatus = sessionData && sessionData.status;
            const isRejoin = (currentStatus === 'playing' || currentStatus === 'reviewing');
            const isCountdownRejoin = (currentStatus === 'countdown');

            if (isRejoin) {
                // Jump straight into the game
                listenAsPlayer();
            } else if (isCountdownRejoin) {
                teardownWaitingMiniGames();
                runCountdown(() => listenAsPlayer());
            } else {
                resetWaitingMiniGamesForLobby();
                showScreen('screen-waiting');
            }

            if (!FirebaseService.isDemo()) {
                console.log('[QuizGame][Player] Setting up listeners for code:', gameCode, '| UID:', FirebaseService.getUid());
                setupPlayerListeners();
            } else {
                console.warn('[QuizGame][Player] Firebase is in demo mode — real-time listeners will NOT fire.');
            }
        }).catch(err => {
            showScreen('screen-join');
            $('join-error').textContent = 'Could not join game. Check your code.';
            console.error(err);
        });
    }

    // ===== PLAYER LISTENERS HELPER =====
    function setupPlayerListeners() {
        if (FirebaseService.isDemo()) {
            console.warn('[QuizGame][Player] setupPlayerListeners: demo mode — skipping.');
            return;
        }

        console.log('[QuizGame][Player] setupPlayerListeners() called. gameCode:', gameCode, '| playerGameStarted:', playerGameStarted);

        if (gameCode) {
            FirebaseService.markPlayerConnected(gameCode);
        }

        // 1. Status transition listener
        const unsubStatus = FirebaseService.onFieldChange(gameCode, 'status', status => {
            const waitingActive = $('screen-waiting').classList.contains('active');
            console.log('[QuizGame][Player] status changed =>', status, '| screen-waiting active:', waitingActive, '| playerGameStarted:', playerGameStarted);

            // Once the game transition has been triggered, only handle game-end from here.
            // All in-game status changes (reviewing, finished) are handled by listenAsPlayer()'s own listeners.
            if (playerGameStarted) {
                if (status === 'finished') showResults();
                return;
            }

            if (status === 'countdown' && waitingActive) {
                teardownWaitingMiniGames();
                playerGameStarted = true;
                console.log('[QuizGame][Player] Starting countdown -> listenAsPlayer()');
                runCountdown(() => listenAsPlayer());
            } else if ((status === 'playing' || status === 'reviewing') && waitingActive) {
                teardownWaitingMiniGames();
                console.log(`[QuizGame][Player] Syncing to active game on status: ${status}`);
                playerGameStarted = true;
                listenAsPlayer();
            } else if (status === 'finished') {
                showResults();
            } else {
                console.warn('[QuizGame][Player] Status fired but no action taken. screen-waiting active:', waitingActive);
            }
        });
        listeners.push(unsubStatus);

        // 2. Kick listeners — host boot writes kicked/{uid} AND deletes players/{uid}.
        // Answer/score writes used to recreate the player node within a grace window;
        // the kicked flag is the durable signal that stops local play immediately.
        const myUid = FirebaseService.getUid();
        const unsubKicked = FirebaseService.onFieldChange(gameCode, 'kicked/' + myUid, val => {
            if (val == null || role !== 'player') return;
            console.log('[QuizGame] Player marked kicked by host.');
            handlePlayerKicked();
        });
        listeners.push(unsubKicked);

        const unsubKick = FirebaseService.onFieldChange(gameCode, 'players/' + myUid, val => {
            if (val !== null || role !== 'player' || playerKicked) return;
            if ($('screen-booted').classList.contains('active')) return;

            clearTimeout(kickCheckTimer);
            kickCheckTimer = setTimeout(() => {
                if (playerKicked) return;
                Promise.all([
                    FirebaseService.getSession(gameCode),
                    FirebaseService.isPlayerKicked
                        ? FirebaseService.isPlayerKicked(gameCode, myUid)
                        : Promise.resolve(false)
                ]).then(([session, kicked]) => {
                    if (playerKicked) return;
                    if (!session) {
                        showDisconnectScreen('Disconnected', 'The host has ended the session or disconnected.');
                        return;
                    }
                    if (kicked || !session.players || !session.players[myUid]) {
                        console.log('[QuizGame] Player node still missing after grace period — ejecting.');
                        handlePlayerKicked();
                    }
                });
            }, 800);
        });
        listeners.push(unsubKick);

        // 3. Session End listener (host deleted the session)
        const unsubSession = FirebaseService.onSessionValue(gameCode, val => {
            if (val === null && role === 'player') {
                if ($('screen-booted').classList.contains('active')) return;
                showDisconnectScreen('Disconnected', 'The host has ended the session or disconnected.');
            }
        });
        listeners.push(unsubSession);
        console.log('[QuizGame][Player] All listeners registered.');
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
        teardownWaitingMiniGames();
        closeThemePanel();

        const overlay = $('overlay-countdown');
        const numEl = $('countdown-number');
        overlay.classList.add('active');
        let count = 3;
        numEl.textContent = count;
        numEl.style.animation = 'none';
        void numEl.offsetWidth;
        numEl.style.animation = '';

        playSfxOneShot('sfx-quiz-countdown');

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                numEl.textContent = count;
                numEl.style.animation = 'none';
                void numEl.offsetWidth;
                numEl.style.animation = '';
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
                closeThemePanel();
                callback();
            }
        }, 800);
    }

    // ===== HOST-ONLY MUSIC / STINGERS (real audio files) =====
    function isHostMusicEnabled() {
        return role === 'host' && musicEnabled;
    }

    function isStudentPacedPlayer() {
        return role !== 'host' && (config.gameMode || '') === 'student-paced';
    }

    function isQuestionTrackEnabled() {
        if (!musicEnabled) return false;
        if (role === 'host') return true;
        return isStudentPacedPlayer();
    }

    function updateStudentMusicButton() {
        const btn = $('btn-sv-music');
        if (!btn) return;
        const on = musicEnabled;
        btn.classList.toggle('is-muted', !on);
        btn.setAttribute('aria-pressed', String(on));
        btn.title = on ? 'Turn music off' : 'Turn music on';
        btn.setAttribute('aria-label', on ? 'Turn question music off' : 'Turn question music on');
        btn.innerHTML = on
            ? '<i class="fa-solid fa-volume-high"></i>'
            : '<i class="fa-solid fa-volume-xmark"></i>';
    }

    function syncStudentMusicChrome() {
        const btn = $('btn-sv-music');
        if (!btn) return;
        const show = isStudentPacedPlayer() && $('screen-game')?.classList.contains('active');
        btn.classList.toggle('qg-hidden', !show);
        updateStudentMusicButton();
    }

    function toggleStudentQuestionMusic() {
        if (!isStudentPacedPlayer()) return;
        musicEnabled = !musicEnabled;
        updateStudentMusicButton();
        if (!musicEnabled) {
            pauseQuestionTrack();
            return;
        }
        if (!hasAnswered && !isBonusActive && $('screen-game')?.classList.contains('active')) {
            restartQuestionTrack();
        }
    }

    function pauseQuestionTrack() {
        for (let i = 1; i <= 4; i++) {
            const el = $('bg-question-' + i);
            if (el) {
                el.pause();
                el.currentTime = 0;
            }
        }
    }

    function stopQuestionTrack() {
        pauseQuestionTrack();
        currentQuestionTrackIndex = null;
    }

    function startQuestionTrackAtIndex(index) {
        if (!index) return;
        pauseQuestionTrack();
        lastQuestionTrackIndex = index;
        currentQuestionTrackIndex = index;
        const el = $('bg-question-' + index);
        if (!el) return;
        el.loop = true;
        el.volume = QUESTION_TRACK_VOLUME;
        el.currentTime = 0;
        el.play().catch(() => { });
    }

    function restartQuestionTrack() {
        if (!isQuestionTrackEnabled()) return;
        const index = currentQuestionTrackIndex || lastQuestionTrackIndex;
        if (index) {
            startQuestionTrackAtIndex(index);
            return;
        }
        playQuestionTrack();
    }

    function playQuestionTrack() {
        if (!isQuestionTrackEnabled()) return;

        const choices = [];
        for (let i = 1; i <= 4; i++) {
            if (i !== lastQuestionTrackIndex) choices.push(i);
        }
        const pick = choices[Math.floor(Math.random() * choices.length)];
        startQuestionTrackAtIndex(pick);
    }

    function playHostSfxOneShot(elementId) {
        if (!isHostMusicEnabled()) return;
        const el = $(elementId);
        if (!el) return;
        el.pause();
        el.currentTime = 0;
        el.play().catch(() => { });
    }

    function playHostQuestionEndSfx() {
        if (!isHostMusicEnabled()) return;
        const gm = config.gameMode || 'automatic';
        if (gm !== 'teacher-paced') return;
        playHostSfxOneShot('sfx-question-end');
    }

    function playHostPodiumSfx() {
        if (!isHostMusicEnabled()) return;
        stopQuestionTrack();
        playHostSfxOneShot('sfx-podium');
    }

    function playPlayerAnswerSfx(type) {
        if (!soundEnabled) return;
        const elementId = type === 'correct' ? 'sfx-correct-answer' : 'sfx-incorrect-answer';
        playSfxOneShot(elementId);
    }

    function playSfxOneShot(elementId) {
        if (!soundEnabled) return;
        const el = $(elementId);
        if (!el) return;
        el.pause();
        el.currentTime = 0;
        el.play().catch(() => { });
    }

    function startBonusShuffleTrack() {
        if (!soundEnabled) return;
        const el = $('sfx-bonus-shuffle');
        if (!el) return;
        el.loop = true;
        el.currentTime = 0;
        el.play().catch(() => { });
    }

    function stopBonusShuffleTrack() {
        const el = $('sfx-bonus-shuffle');
        if (!el) return;
        el.pause();
        el.currentTime = 0;
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

        syncHostStudentPacedChrome();
        clearHostLeaderboardRows();

        // Show/hide teacher controls based on mode
        $('tv-teacher-controls').classList.toggle('qg-hidden', gm !== 'teacher-paced' && gm !== 'student-paced');

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

        // Handle Bonus Stage — advance session index first so players stay in sync
        if (!skipBonusCheck && config.bonusEnabled && currentQ > 0 && currentQ % config.bonusFrequency === 0) {
            beginBonusRound();
            return;
        }
        skipBonusCheck = false;

        if (!FirebaseService.isDemo()) {
            FirebaseService.clearAllAnswers(gameCode, players);
            FirebaseService.updateSessionFields(gameCode, {
                'currentQuestion': currentQ,
                'questionStartedAt': Date.now(),
                'bonusActive': false,
                'status': 'playing'
            });
        }

        showHostQuestionAtIndex(currentQ);
    }

    function beginBonusRound() {
        isAdvancing = false;

        // TODO(BonusDebug): remove diagnostic log once bonus sync is confirmed stable in classrooms.
        console.log('[BonusDebug]', Date.now(), 'beginBonusRound host', {
            currentQ,
            bonusActive: true,
            status: 'playing'
        });

        if (!FirebaseService.isDemo()) {
            FirebaseService.clearAllAnswers(gameCode, players);
            FirebaseService.updateSessionFields(gameCode, {
                'currentQuestion': currentQ,
                'questionStartedAt': Date.now(),
                'bonusActive': true,
                'status': 'playing'
            });
        }

        $('tv-q-num').textContent = currentQ + 1;
        if (role === 'host') stopQuestionTrack();
        startBonusStage('host');
    }

    function showHostQuestionAtIndex(qIdx) {
        const q = questions[qIdx];
        if (!q) return;

        hasAnswered = false;
        answerCounts = [0, 0, 0, 0];
        timeLeft = config.timer;
        isAdvancing = false;

        $('tv-q-num').textContent = qIdx + 1;
        let qHtml = `<div>${escapeHtml(q.text)}</div>`;
        if (q.imageData) {
            qHtml = `<img src="${q.imageData}" style="max-height: 200px; max-width: 100%; border-radius: 12px; margin-bottom: 15px; object-fit: contain;" alt="Question Image" />` + qHtml;
        }
        $('tv-question').innerHTML = qHtml;
        $('tv-answered').textContent = '0';

        renderHostAnswerBars(q);
        startTimer();
        if (role === 'host') playQuestionTrack();
    }

    function finishHostBonusRound() {
        $('tv-bonus-indicator').classList.add('qg-hidden');
        $('tv-question').classList.remove('qg-hidden');
        $('tv-answers').classList.remove('qg-hidden');
        $('tv-timer-container').classList.remove('qg-hidden');
        isBonusActive = false;

        if (!FirebaseService.isDemo()) {
            FirebaseService.updateSessionFields(gameCode, {
                'bonusActive': false,
                'status': 'playing',
                'questionStartedAt': Date.now()
            });
        }

        skipBonusCheck = true;
        showHostQuestionAtIndex(currentQ);
    }

    /**
     * Shortcut Combo answers are submitted as index 1 (correct) / 0 (incorrect), so the
     * host tallies them into two buckets instead of the four A/B/C/D option bars.
     */
    function renderHostAnswerBars(q) {
        const answersEl = $('tv-answers');
        answersEl.innerHTML = '';

        const addBar = (index, icon, text, extraClass = '') => {
            const div = document.createElement('div');
            div.className = 'qg-tv-answer' + (extraClass ? ' ' + extraClass : '');
            div.id = 'tv-ans-' + index;
            div.innerHTML = `
                <span class="ans-icon">${icon}</span>
                <span class="ans-text">${escapeHtml(text)}</span>
                <span class="ans-count" id="tv-ans-count-${index}">0</span>
            `;
            answersEl.appendChild(div);
        };

        if (getQuestionType(q) === 'shortcut' && getShortcutFormat(q) !== 'mcq') {
            addBar(0, '<i class="fa-solid fa-xmark"></i>', 'Incorrect', 'qg-tv-answer-tally');
            addBar(1, '<i class="fa-solid fa-check"></i>',
                'Correct — ' + (q.combo || ''), 'qg-tv-answer-tally');
            return;
        }

        q.options.forEach((opt, i) => {
            if (!opt || opt.trim() === '') return;
            addBar(i, getAnswerShapeHtml(i), opt);
        });
    }

    function startTimer() {
        clearInterval(timerInterval);
        const total = config.timer;
        timeLeft = total;

        updateTimerUI(total, total);

        if (isDevFreeze()) return;

        timerInterval = setInterval(() => {
            if (isDevFreeze()) return;
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

    function getHostLeaderboardSorted() {
        const tot = questions.length || 1;

        return Object.entries(players)
            .map(([uid, p]) => {
                const prog = getPlayerProgress(p);
                return { uid, prog, isDone: prog >= tot, ...p };
            })
            .sort((a, b) => {
                if (a.isDone && !b.isDone) return -1;
                if (!a.isDone && b.isDone) return 1;
                if (a.score !== b.score) return (b.score || 0) - (a.score || 0);
                return b.prog - a.prog;
            });
    }

    function getHostLbBarClass(streak) {
        if (streak >= 5) return 'streak-5';
        if (streak >= 3) return 'streak-3';
        if (streak >= 2) return 'streak-2';
        return '';
    }

    function getHostLbStreakHtml(streak) {
        if (streak >= 3) return `<span class="fire">🔥</span>${streak}`;
        if (streak > 0) return `⚡${streak}`;
        return '';
    }

    function getHostLbStatusTag(entry) {
        if (entry.isDone) {
            return '<span class="qg-tv-lb-status qg-tv-lb-status--done">Completed</span>';
        }
        if (isPlayerDisconnected(entry)) {
            return '<span class="qg-reconnect-badge qg-reconnect-badge--lb">Reconnecting…</span>';
        }
        return '';
    }

    function applyHostLbRowChrome(row, entry, rank) {
        row.classList.toggle('qg-tv-lb-row--disconnected', isPlayerDisconnected(entry));

        if (entry.isDone) {
            row.style.background = 'rgba(118, 120, 237, 0.15)';
            row.style.border = '1px solid rgba(118, 120, 237, 0.3)';
        } else if (rank === 1 && (entry.score || 0) > 0) {
            row.style.background = 'rgba(247, 184, 1, 0.15)';
            row.style.border = '';
        } else {
            row.style.background = '';
            row.style.border = '';
        }
    }

    function createHostLeaderboardRow(entry, rank) {
        const row = document.createElement('div');
        row.className = 'qg-tv-lb-row';
        row.dataset.uid = entry.uid;
        row.innerHTML = `
            <span class="qg-tv-lb-rank"></span>
            <div class="qg-tv-lb-progress-wrap">
                <div class="qg-tv-lb-info">
                    <span class="qg-tv-lb-name"></span>
                    <span class="qg-tv-lb-score"></span>
                </div>
                <div class="qg-tv-lb-bar-bg">
                    <div class="qg-tv-lb-bar"></div>
                </div>
            </div>
            <span class="qg-tv-lb-streak"></span>
        `;
        updateHostLeaderboardRow(row, entry, rank, null);
        return row;
    }

    function updateHostLeaderboardRow(row, entry, rank, prevRank) {
        const tot = questions.length || 1;
        const streak = entry.streak || 0;
        const pct = Math.min(100, Math.round((entry.prog / tot) * 100));
        const barClass = getHostLbBarClass(streak);

        row.querySelector('.qg-tv-lb-rank').textContent = rank;
        row.querySelector('.qg-tv-lb-name').innerHTML =
            `${escapeHtml(entry.name || '')} ${getHostLbStatusTag(entry)}`;
        row.querySelector('.qg-tv-lb-score').textContent = entry.score || 0;
        row.querySelector('.qg-tv-lb-streak').innerHTML = getHostLbStreakHtml(streak);

        const bar = row.querySelector('.qg-tv-lb-bar');
        if (bar) {
            bar.className = 'qg-tv-lb-bar' + (barClass ? ` ${barClass}` : '');
            bar.style.width = `${pct}%`;
        }

        applyHostLbRowChrome(row, entry, rank);
        attachHostLbBootButton(row, entry);

        if (prevRank != null && prevRank !== rank) {
            row.classList.remove('qg-ls-row--moved');
            void row.offsetWidth;
            row.classList.add('qg-ls-row--moved');
        }
    }

    function updateHostLeaderboardKeyed() {
        const list = $('tv-lb-list');
        if (!list) return;

        const sorted = getHostLeaderboardSorted();
        const activeUids = new Set(sorted.map((entry) => entry.uid));

        hostLbRowMap.forEach((row, uid) => {
            if (!activeUids.has(uid)) {
                row.remove();
                hostLbRowMap.delete(uid);
                hostLbRankMap.delete(uid);
            }
        });

        sorted.forEach((entry, index) => {
            const rank = index + 1;
            const prevRank = hostLbRankMap.get(entry.uid);
            let row = hostLbRowMap.get(entry.uid);
            if (!row) {
                row = createHostLeaderboardRow(entry, rank);
                hostLbRowMap.set(entry.uid, row);
            } else {
                updateHostLeaderboardRow(row, entry, rank, prevRank);
            }
            hostLbRankMap.set(entry.uid, rank);
        });

        sorted.forEach((entry, index) => {
            const row = hostLbRowMap.get(entry.uid);
            const ref = list.children[index];
            if (row && ref !== row) {
                list.insertBefore(row, ref || null);
            }
        });
    }

    function updateHostLeaderboardClassic() {
        const tot = questions.length || 1;
        const sorted = getHostLeaderboardSorted();
        const list = $('tv-lb-list');
        if (!list) return;

        list.innerHTML = '';
        sorted.forEach((p, i) => {
            const row = document.createElement('div');
            row.className = 'qg-tv-lb-row';
            const rank = i + 1;
            applyHostLbRowChrome(row, p, rank);

            const streak = p.streak || 0;
            const streakHtml = getHostLbStreakHtml(streak);
            const pct = Math.min(100, Math.round((p.prog / tot) * 100));
            const barClass = getHostLbBarClass(streak);

            if (isPlayerDisconnected(p)) {
                row.classList.add('qg-tv-lb-row--disconnected');
            }

            row.innerHTML = `
                <span class="qg-tv-lb-rank">${rank}</span>
                <div class="qg-tv-lb-progress-wrap">
                    <div class="qg-tv-lb-info">
                        <span class="qg-tv-lb-name">${escapeHtml(p.name)} ${getHostLbStatusTag(p)}</span>
                        <span class="qg-tv-lb-score">${p.score || 0}</span>
                    </div>
                    <div class="qg-tv-lb-bar-bg">
                        <div class="qg-tv-lb-bar ${barClass}" style="width: ${pct}%;"></div>
                    </div>
                </div>
                <span class="qg-tv-lb-streak">${streakHtml}</span>
            `;
            attachHostLbBootButton(row, p);
            list.appendChild(row);
        });
    }

    function updateHostLeaderboard() {
        const gm = config.gameMode || 'automatic';
        if (gm === 'student-paced') {
            updateHostLeaderboardKeyed();
        } else {
            updateHostLeaderboardClassic();
        }
    }

    function clearHostLeaderboardRows() {
        hostLbRowMap.forEach((row) => row.remove());
        hostLbRowMap.clear();
        hostLbRankMap.clear();
        const list = $('tv-lb-list');
        if (list) list.innerHTML = '';
    }

    function syncHostStudentPacedChrome() {
        const teacherView = $('teacher-view');
        if (!teacherView) return;
        const studentPaced = role === 'host' && (config.gameMode || gameMode) === 'student-paced';
        teacherView.classList.toggle('qg-teacher-view--student-paced', studentPaced);
    }

    function revealAnswer() {
        if (role === 'host') {
            stopQuestionTrack();
            playHostQuestionEndSfx();
        }

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
            delayUnlessFrozen(() => {
                nextQuestion();
            }, 3000);
        }
    }

    function teacherNextQuestion() {
        $('tv-teacher-controls').classList.add('qg-hidden');
        nextQuestion();
    }

    // ===== PLAYER: GAME PLAY =====
    function handleHostedSessionSync(session) {
        if (!session) return;

        // TODO(BonusDebug): remove diagnostic log once bonus sync is confirmed stable in classrooms.
        console.log('[BonusDebug]', Date.now(), 'handleHostedSessionSync', {
            bonusActive: session.bonusActive,
            currentQuestion: session.currentQuestion,
            status: session.status
        });

        questions = session.questions || questions;
        config = session.config || config;
        soundEnabled = config.sound !== false;

        const qIdx = session.currentQuestion;
        const startedAt = session.questionStartedAt || 0;
        const bonusActive = !!session.bonusActive;
        const status = session.status || '';

        playerSyncState.questionStartedAt = startedAt;
        playerSyncState.bonusActive = bonusActive;

        if (status === 'finished' && lastPlayerSync.status !== 'finished') {
            hideWaitingOverlay();
            lastPlayerSync = { currentQuestion: qIdx, questionStartedAt: startedAt, bonusActive, status };
            showResults();
            return;
        }

        // Bonus must win over a stale "reviewing" status write that can arrive after beginBonusRound.
        if (bonusActive) {
            if (qIdx >= 0) currentQ = qIdx;
            hideWaitingOverlay();
            lastPlayerSync = { currentQuestion: qIdx, questionStartedAt: startedAt, bonusActive, status };
            const bonusVisible = !$('sv-bonus-container').classList.contains('qg-hidden');
            if (!isBonusActive || !bonusVisible) startBonusStage('auto');
            return;
        }

        if (status === 'bonus') {
            if (qIdx >= 0) currentQ = qIdx;
            hideWaitingOverlay();
            lastPlayerSync = { currentQuestion: qIdx, questionStartedAt: startedAt, bonusActive, status };
            startBonusStage('auto');
            return;
        }

        if (status === 'reviewing' && lastPlayerSync.status !== 'reviewing') {
            if (qIdx >= 0) currentQ = qIdx;
            lastPlayerSync = { currentQuestion: qIdx, questionStartedAt: startedAt, bonusActive, status };
            hideWaitingOverlay();
            revealPlayerAnswer();
            return;
        }

        const questionChanged = qIdx !== lastPlayerSync.currentQuestion;
        const timerChanged = startedAt !== lastPlayerSync.questionStartedAt;
        const bonusChanged = bonusActive !== lastPlayerSync.bonusActive;

        if (!questionChanged && !timerChanged && !bonusChanged) return;

        lastPlayerSync = { currentQuestion: qIdx, questionStartedAt: startedAt, bonusActive, status };

        if (qIdx === null || qIdx === undefined || qIdx < 0) return;

        const syncGen = ++playerSessionGen;
        loadPlayerQuestion(qIdx, { questionStartedAt: startedAt, sessionGen: syncGen });
    }

    function listenAsPlayer() {
        showScreen('screen-game');
        $('student-view').classList.add('active');
        $('teacher-view').classList.remove('active');
        myScore = 0;
        myStreak = 0;

        if (!FirebaseService.isDemo()) {
            FirebaseService.markPlayerConnected(gameCode);

            // Get initial game state first
            FirebaseService.getSession(gameCode).then(session => {
                if (!session) {
                    console.error('[QuizGame][Player] listenAsPlayer: getSession returned null! gameCode:', gameCode);
                    return;
                }
                questions = session.questions || [];
                config = session.config || {};
                soundEnabled = config.sound !== false;
                musicEnabled = config.sound !== false;
                const gm = config.gameMode || 'automatic';
                console.log('[QuizGame][Player] listenAsPlayer: session loaded. questions:', questions.length, '| currentQuestion:', session.currentQuestion, '| gameMode:', gm);

                if (gm === 'student-paced') {
                    // Student-paced: start from question 0 and advance locally
                    currentQ = -1;
                    syncStudentMusicChrome();
                    studentPacedNextQuestion();

                    // Listen for game end
                    const unsub2 = FirebaseService.onFieldChange(gameCode, 'status', status => {
                        if (status === 'finished') {
                            showResults();
                        }
                    });
                    listeners.push(unsub2);
                } else {
                    const unsubSync = FirebaseService.onSessionValue(gameCode, handleHostedSessionSync);
                    listeners.push(unsubSync);

                    const unsubSelf = FirebaseService.onFieldChange(gameCode, 'players/' + FirebaseService.getUid(), pData => {
                        if (!pData) return;
                        myScore = pData.score || 0;
                        myStreak = pData.streak || 0;
                        if ($('screen-game').classList.contains('active')) {
                            $('sv-score').textContent = myScore;
                            updateStreakDisplay();
                        }
                    });
                    listeners.push(unsubSelf);

                    handleHostedSessionSync(session);
                }
            });
        }
    }

    // Student-paced: advance to next question locally
    function studentPacedNextQuestion() {
        if (playerKicked) return;
        currentQ++;
        if (currentQ >= questions.length) {
            showLiveStandings();
            return;
        }

        hasAnswered = false;
        const q = questions[currentQ];
        if (!q) return;

        $('sv-score').textContent = myScore;
        $('sv-progress').textContent = `${currentQ + 1} / ${questions.length}`;
        updateStreakDisplay();

        // Hide bonus stage, show question
        stopBonusShuffleTrack();
        $('sv-bonus-container').classList.add('qg-hidden');
        $('sv-question').classList.remove('qg-hidden');
        $('sv-timer-container').classList.remove('qg-hidden');

        let qHtml = `<div>${escapeHtml(q.text)}</div>`;
        if (q.imageData) {
            qHtml += `<img src="${q.imageData}" style="max-height: 300px; max-width: 100%; border-radius: 12px; margin-top: 12px; margin-left: 16px; object-fit: contain;" alt="Question Image" />`;
        }
        $('sv-question').innerHTML = qHtml;

        const btns = renderPlayerAnswerArea(q);

        // Apply pending powerups
        let timerDuration = config.timer;
        if (pendingPowerup === '5050' && (getQuestionType(q) === 'mcq' || getShortcutFormat(q) === 'mcq')) {
            // Remove 2 wrong answers
            const wrongIndices = [];
            q.options.forEach((_, i) => { if (i !== q.correctIndex) wrongIndices.push(i); });
            // Shuffle and pick 2 to hide
            wrongIndices.sort(() => Math.random() - 0.5);
            const toHide = wrongIndices.slice(0, 2);
            toHide.forEach(idx => {
                const btn = btns[idx];
                if (btn) {
                    btn.style.display = 'none';
                }
            });
            pendingPowerup = null;
        } else if (pendingPowerup === 'time') {
            timerDuration = config.timer * 2;
            pendingPowerup = null;
        }

        // Start local timer
        startPlayerTimer(timerDuration, timerDuration);
        playQuestionTrack();
    }

    function loadPlayerQuestion(qIdx, opts = {}) {
        if (opts.sessionGen != null && opts.sessionGen !== playerSessionGen) {
            console.log('[QuizGame][Player] Discarding stale question load for index', qIdx);
            return;
        }

        if (playerSyncState.bonusActive) {
            currentQ = qIdx;
            const bonusVisible = !$('sv-bonus-container').classList.contains('qg-hidden');
            if (!isBonusActive || !bonusVisible) startBonusStage('auto');
            return;
        }

        currentQ = qIdx;
        hasAnswered = false;
        console.log('[QuizGame][Player] loadPlayerQuestion called. qIdx:', qIdx);

        const q = questions[currentQ];
        if (!q) {
            console.error('[QuizGame][Player] loadPlayerQuestion: question at index', currentQ, 'is undefined! questions.length:', questions.length);
            return;
        }
        console.log('[QuizGame][Player] Rendering question', currentQ, ':', q.text?.substring(0, 50));

        // Render
        stopBonusShuffleTrack();
        $('sv-bonus-container').classList.add('qg-hidden');
        $('sv-question').classList.remove('qg-hidden');
        $('sv-timer-container').classList.remove('qg-hidden');

        $('sv-score').textContent = myScore;
        $('sv-progress').textContent = `${currentQ + 1} / ${questions.length}`;
        updateStreakDisplay();
        let qHtml = `<div>${escapeHtml(q.text)}</div>`;
        if (q.imageData) {
            qHtml += `<img src="${q.imageData}" style="max-height: 300px; max-width: 100%; border-radius: 12px; margin-top: 12px; margin-left: 16px; object-fit: contain;" alt="Question Image" />`;
        }
        $('sv-question').innerHTML = qHtml;

        const btns = renderPlayerAnswerArea(q);

        // Apply pending powerups
        let timerDuration = config.timer;
        if (pendingPowerup === '5050' && (getQuestionType(q) === 'mcq' || getShortcutFormat(q) === 'mcq')) {
            const wrongIndices = [];
            q.options.forEach((_, i) => { if (i !== q.correctIndex) wrongIndices.push(i); });
            wrongIndices.sort(() => Math.random() - 0.5);
            const toHide = wrongIndices.slice(0, 2);
            toHide.forEach(idx => {
                const btn = btns[idx];
                if (btn) {
                    btn.style.display = 'none';
                }
            });
            pendingPowerup = null;
        } else if (pendingPowerup === 'time') {
            timerDuration = config.timer * 2;
            pendingPowerup = null;
        }

        const startedAt = opts.questionStartedAt ?? playerSyncState.questionStartedAt ?? 0;
        const elapsed = startedAt > 0 ? (Date.now() - startedAt) / 1000 : 0;
        const remaining = Math.max(3, timerDuration - elapsed);
        console.log('[QuizGame][Player] Timer: elapsed', elapsed.toFixed(1), 's | remaining', remaining.toFixed(1), 's');
        startPlayerTimer(remaining, timerDuration);
    }

    /**
     * Renders whichever answer UI the question needs and returns the MCQ tile buttons,
     * which the 50/50 powerup and the shared answer-submission path still rely on.
     */
    function renderPlayerAnswerArea(q) {
        stopLiveShortcutListener();
        const studentView = $('student-view');
        const isShortcut = getQuestionType(q) === 'shortcut';
        const format = isShortcut ? getShortcutFormat(q) : null;
        const isShortcutMcq = format === 'mcq';
        const isShortcutClick = format === 'click';
        const isShortcutLive = format === 'live';

        studentView?.classList.toggle('qg-has-shortcut', isShortcutClick);
        studentView?.classList.toggle('qg-has-shortcut-live', isShortcutLive);

        $('sv-answers').classList.toggle('qg-hidden', !isShortcutMcq && isShortcut);
        $('sv-shortcut').classList.toggle('qg-hidden', !isShortcutClick);
        $('sv-shortcut-live').classList.toggle('qg-hidden', !isShortcutLive);

        const btns = document.querySelectorAll('.qg-answer-btn');
        btns.forEach((btn, i) => {
            btn.className = 'qg-answer-btn qg-ans-' + i;
            btn.disabled = false;
            btn.style.opacity = '1';

            if (isShortcut && !isShortcutMcq) {
                btn.textContent = '';
                btn.style.display = 'none';
                return;
            }

            const opt = q.options && q.options[i];
            if (opt && String(opt).trim() !== '') {
                setAnswerTile(btn, i, opt);
                btn.style.display = '';
            } else {
                btn.style.display = 'none';
            }
        });

        if (isShortcutClick) renderShortcutClickQuestion(q);
        else if (isShortcutLive) renderShortcutLiveQuestion(q);
        return btns;
    }

    function setAnswerTile(btn, index, text) {
        btn.innerHTML = `${getAnswerShapeHtml(index)}<span class="qg-tile-text"></span>`;
        btn.querySelector('.qg-tile-text').textContent = text;
    }

    // ===== PLAYER: SHORTCUT COMBO QUESTIONS =====
    function getKeyboardPaletteClass() {
        const app = $('quiz-app');
        const theme = (app && app.dataset.theme) || 'default';
        const themeData = QUIZ_THEMES[theme];
        return (themeData && themeData.keyboard) || 'keyboard--palette-classic';
    }

    function formatCapLabel(key) {
        const labels = {
            control: 'Ctrl', meta: 'Win', shift: 'Shift', alt: 'Alt', ' ': 'Space',
            escape: 'Esc', capslock: 'Caps Lock', backspace: 'Backspace', enter: 'Enter', tab: 'Tab'
        };
        return labels[key] || String(key).toUpperCase();
    }

    function renderShortcutClickQuestion(q) {
        const container = $('sv-keyboard');
        if (!container || !window.ShortcutsData) return;

        selectedKeys = new Set();
        ShortcutsData.renderVirtualKeyboard(container, {
            paletteClass: getKeyboardPaletteClass(),
            includeNumpad: true
        });
        container.classList.remove('qg-keyboard-locked');
        bindShortcutKeyboard();

        const keyCount = (q.keys || []).length;
        $('sv-shortcut-hint').textContent = keyCount
            ? `Click the ${keyCount} keys for this shortcut, then submit.`
            : 'Click every key in the combo, then submit.';

        setShortcutLocked(false);
    }

    function resetLiveKeyDisplay(message = 'Waiting for keypress…') {
        const keysEl = $('sv-shortcut-live-keys');
        const selectionEl = $('sv-shortcut-selection');
        if (keysEl) {
            keysEl.innerHTML = '<span class="qg-live-keycap qg-live-keycap--placeholder">Press keys…</span>';
        }
        if (selectionEl) selectionEl.textContent = message;
    }

    function updateLiveKeyDisplay(event) {
        const keysEl = $('sv-shortcut-live-keys');
        const selectionEl = $('sv-shortcut-selection');
        if (!keysEl || !event) return;

        const pressed = [];
        if (event.ctrlKey) pressed.push('control');
        if (event.shiftKey) pressed.push('shift');
        if (event.altKey) pressed.push('alt');
        if (event.metaKey) pressed.push('meta');

        const mainKey = ShortcutsData.normalizeComboKey(
            event.key === 'Control' ? 'ctrl'
                : event.key === 'Meta' ? 'win'
                    : String(event.key || '').toLowerCase()
        );
        const isModifier = ['ctrl', 'control', 'shift', 'alt', 'win', 'meta'].includes(mainKey);
        if (mainKey && !isModifier) pressed.push(mainKey);

        if (!pressed.length) {
            resetLiveKeyDisplay();
            return;
        }

        const labels = pressed.map((key) => formatCapLabel(key === 'control' ? 'control' : key));
        keysEl.innerHTML = labels.map((label) => `<span class="qg-live-keycap">${escapeHtml(label)}</span>`).join('<span class="qg-live-keycap-plus" aria-hidden="true">+</span>');
        if (selectionEl) selectionEl.textContent = labels.join(' + ');
    }

    function renderShortcutLiveQuestion(q) {
        const reveal = $('sv-shortcut-live-reveal');
        if (!window.ShortcutsData) return;

        $('sv-shortcut-live-hint').textContent =
            `Press the keyboard shortcut for "${q.word || 'this action'}" on your keyboard.`;
        resetLiveKeyDisplay();
        if (reveal) {
            reveal.textContent = '';
            reveal.classList.add('qg-hidden');
        }

        startLiveShortcutListener();
    }

    function startLiveShortcutListener() {
        stopLiveShortcutListener();
        liveShortcutListener = (event) => handleLiveShortcutKeydown(event);
        document.addEventListener('keydown', liveShortcutListener, true);
    }

    function stopLiveShortcutListener() {
        if (!liveShortcutListener) return;
        document.removeEventListener('keydown', liveShortcutListener, true);
        liveShortcutListener = null;
    }

    function handleLiveShortcutKeydown(event) {
        if (hasAnswered || timeLeft <= 0) return;
        const q = questions[currentQ];
        if (!q || getShortcutFormat(q) !== 'live') return;
        if (event.repeat) return;
        if (event.key === 'Escape') return;

        updateLiveKeyDisplay(event);
        if (ShortcutsData.isModifierOnlyEvent(event)) return;

        const shortcut = ShortcutsData.SHORTCUTS.find((s) => s.id === q.shortcutId);
        if (!shortcut) return;

        event.preventDefault();
        const correct = ShortcutsData.matchesKeyboardEvent(shortcut, event);
        const selectionEl = $('sv-shortcut-selection');
        if (selectionEl) {
            selectionEl.textContent = correct ? 'Correct combo!' : 'That was not the right shortcut.';
        }
        selectAnswer(correct ? 1 : 0);
    }

    function bindShortcutKeyboard() {
        if (shortcutKeyboardBound) return;
        const container = $('sv-keyboard');
        if (!container) return;
        shortcutKeyboardBound = true;

        container.addEventListener('click', e => {
            const cap = e.target.closest('.ks-key');
            if (cap) toggleShortcutKey(cap);
        });

        container.addEventListener('keydown', e => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const cap = e.target.closest('.ks-key');
            if (!cap) return;
            e.preventDefault();
            toggleShortcutKey(cap);
        });
    }

    function toggleShortcutKey(cap) {
        if (hasAnswered || timeLeft <= 0) return;
        const key = cap.dataset.key;
        if (!key) return;

        const aliasGroup = ShortcutsData.getCapAliasGroup
            ? ShortcutsData.getCapAliasGroup(key)
            : [key];
        const wasSelected = aliasGroup.some((alias) => selectedKeys.has(alias));

        if (wasSelected) {
            aliasGroup.forEach((alias) => selectedKeys.delete(alias));
        } else {
            aliasGroup.forEach((alias) => selectedKeys.add(alias));
        }

        // Shift/Ctrl/Alt appear twice on the board under one data-key — keep the twins in sync.
        $('sv-keyboard').querySelectorAll('.ks-key').forEach((el) => {
            const capKey = el.dataset.key;
            if (!capKey) return;
            const selected = ShortcutsData.getCapAliasGroup
                ? ShortcutsData.getCapAliasGroup(capKey).some((alias) => selectedKeys.has(alias))
                : selectedKeys.has(capKey);
            el.classList.toggle('selected', selected);
            el.setAttribute('aria-pressed', String(selected));
        });

        playSound('click');
    }

    function clearShortcutSelection() {
        if (hasAnswered) return;
        selectedKeys = new Set();
        const container = $('sv-keyboard');
        if (container) {
            container.querySelectorAll('.ks-key.selected').forEach(cap => {
                cap.classList.remove('selected');
                cap.setAttribute('aria-pressed', 'false');
            });
        }
    }

    function submitShortcutAnswer() {
        if (hasAnswered || timeLeft <= 0) return;
        const q = questions[currentQ];
        if (!q || getShortcutFormat(q) !== 'click') return;
        if (!selectedKeys.size || !window.ShortcutsData) return;

        const correct = ShortcutsData.isComboCorrect([...selectedKeys], q.keys || []);
        selectAnswer(correct ? 1 : 0);
    }

    function setShortcutLocked(locked) {
        const container = $('sv-keyboard');
        if (container) container.classList.toggle('qg-keyboard-locked', locked);
        const submit = $('btn-shortcut-submit');
        const clear = $('btn-shortcut-clear');
        if (submit) submit.disabled = locked;
        if (clear) clear.disabled = locked;
    }

    function revealShortcutKeys() {
        const q = questions[currentQ];
        const format = getShortcutFormat(q);

        if (format === 'live') {
            stopLiveShortcutListener();
            const reveal = $('sv-shortcut-live-reveal');
            resetLiveKeyDisplay('Time is up.');
            if (reveal) {
                reveal.textContent = 'Answer: ' + (q.combo || '');
                reveal.classList.remove('qg-hidden');
            }
            return;
        }

        if (format !== 'click') return;

        const container = $('sv-keyboard');
        if (!container || !q) return;

        setShortcutLocked(true);
        const expected = (q.keys || []).map(k => String(k).toLowerCase());
        container.querySelectorAll('.ks-key').forEach(cap => {
            const key = (cap.dataset.key || '').toLowerCase();
            const isExpected = expected.some((exp) =>
                ShortcutsData.capMatchesExpected
                    ? ShortcutsData.capMatchesExpected(key, exp)
                    : key === exp
            );
            if (isExpected) cap.classList.add('key-correct');
            else if (cap.classList.contains('selected')) cap.classList.add('key-wrong');
        });
    }

    function startPlayerTimer(remaining, total) {
        clearInterval(timerInterval);
        timeLeft = remaining;
        updateTimerUI(timeLeft, total);

        if (isDevFreeze()) return;

        timerInterval = setInterval(() => {
            if (isDevFreeze()) return;
            timeLeft -= 0.1;
            if (timeLeft <= 0) {
                timeLeft = 0;
                clearInterval(timerInterval);
                disableAnswerButtons();

                const gm = config.gameMode || 'automatic';
                if (gm === 'student-paced' && !hasAnswered) {
                    // Auto-advance when time runs out in student-paced
                    hasAnswered = true;
                    if (pendingPowerup === 'shield') {
                        pendingPowerup = null;
                        showFeedback(false, 0, { shield: true });
                    } else {
                        myStreak = 0;
                        showFeedback(false, 0);
                    }
                    // Show correct answer briefly
                    const q = questions[currentQ];
                    if (q) {
                        const btns = document.querySelectorAll('.qg-answer-btn');
                        btns.forEach((btn, i) => {
                            if (i === q.correctIndex) btn.classList.add('correct');
                        });
                        revealShortcutKeys();
                    }
                    if (!FirebaseService.isDemo()) {
                        FirebaseService.updatePlayerScore(gameCode, FirebaseService.getUid(), myScore, myStreak);
                    }
                    delayUnlessFrozen(() => studentPacedNextQuestion(), 2000);
                }
            }
            updateTimerUI(timeLeft, total);
        }, 100);
    }

    function selectAnswer(index) {
        if (playerKicked || hasAnswered || timeLeft <= 0) return;
        hasAnswered = true;

        // Visual feedback
        document.querySelectorAll('.qg-answer-btn').forEach(btn => btn.classList.add('disabled'));
        document.querySelector(`.qg-answer-btn[data-index="${index}"]`).classList.remove('disabled');
        document.querySelector(`.qg-answer-btn[data-index="${index}"]`).classList.add('selected');

        playSound('click');
        setShortcutLocked(true);
        if (getShortcutFormat(questions[currentQ]) === 'live') stopLiveShortcutListener();

        // Submit to Firebase
        FirebaseService.submitAnswer(gameCode, index);

        const gm = config.gameMode || 'automatic';
        if (gm === 'automatic' || gm === 'teacher-paced') {
            showWaitingOverlay();
        } else if (gm === 'student-paced') {
            // Immediately reveal and advance locally
            studentPacedRevealAndAdvance(index);
        }
    }

    function studentPacedRevealAndAdvance(selectedIdx) {
        if (playerKicked) return;
        clearInterval(timerInterval);
        const q = questions[currentQ];
        if (!q) return;

        const btns = document.querySelectorAll('.qg-answer-btn');
        btns.forEach((btn, i) => {
            btn.classList.add('disabled');
            if (i === q.correctIndex) btn.classList.add('correct');
        });
        revealShortcutKeys();

        if (selectedIdx === q.correctIndex) {
            const timeBonus = Math.round((timeLeft / config.timer) * 50);
            const streakMultiplier = config.streaks ? Math.min(myStreak + 1, 5) : 1;
            let points = Math.round((100 + timeBonus) * (1 + (streakMultiplier - 1) * 0.2));
            if (pendingPowerup === 'double') {
                points *= 2;
                pendingPowerup = null;
            }
            myScore += points;
            myStreak++;
            showFeedback(true, points);
            playPlayerAnswerSfx('correct');
        } else {
            const selectedBtn = document.querySelector(`.qg-answer-btn[data-index="${selectedIdx}"]`);
            if (selectedBtn) selectedBtn.classList.add('wrong');
            if (pendingPowerup === 'shield') {
                pendingPowerup = null;
                showFeedback(false, 0, { shield: true });
            } else {
                myStreak = 0;
                showFeedback(false, 0);
                playPlayerAnswerSfx('incorrect');
            }
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
        delayUnlessFrozen(() => {
            if (config.bonusEnabled && (currentQ + 1) % config.bonusFrequency === 0 && (currentQ + 1) < questions.length) {
                startBonusStage('student-paced');
            } else {
                studentPacedNextQuestion();
            }
        }, 2000);
    }

    function revealPlayerAnswer() {
        hideWaitingOverlay();
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
        revealShortcutKeys();

        // Check if player answered correctly
        const selectedBtn = document.querySelector('.qg-answer-btn.selected');
        if (selectedBtn) {
            const selectedIdx = parseInt(selectedBtn.dataset.index);
            if (selectedIdx === q.correctIndex) {
                // Correct!
                const timeBonus = Math.round((timeLeft / config.timer) * 50);
                const streakMultiplier = config.streaks ? Math.min(myStreak + 1, 5) : 1;
                let points = Math.round((100 + timeBonus) * (1 + (streakMultiplier - 1) * 0.2));
                if (pendingPowerup === 'double') {
                    points *= 2;
                    pendingPowerup = null;
                }
                myScore += points;
                myStreak++;
                showFeedback(true, points);
                playPlayerAnswerSfx('correct');
            } else {
                selectedBtn.classList.add('wrong');
                if (pendingPowerup === 'shield') {
                    pendingPowerup = null;
                    showFeedback(false, 0, { shield: true });
                } else {
                    myStreak = 0;
                    showFeedback(false, 0);
                    playPlayerAnswerSfx('incorrect');
                }
            }
        } else if (pendingPowerup === 'shield') {
            pendingPowerup = null;
            showFeedback(false, 0, { shield: true });
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
        setShortcutLocked(true);
        stopLiveShortcutListener();
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

    function ensureWaitingPlayersListener() {
        if (waitingPlayersListenerAdded || FirebaseService.isDemo() || !gameCode) return;
        waitingPlayersListenerAdded = true;
        const unsub = FirebaseService.onPlayersChange(gameCode, updateWaitingCount);
        listeners.push(unsub);
    }

    function updateWaitingCount(playersData) {
        const overlay = $('overlay-waiting');
        const countEl = $('waiting-count');
        if (!overlay || !countEl || !overlay.classList.contains('active')) return;

        const roster = playersData || {};
        const total = Object.keys(roster).length;
        let answered = 0;
        Object.values(roster).forEach(p => {
            if (p && p.currentAnswer !== null && p.currentAnswer !== undefined) answered++;
        });
        countEl.textContent = `${answered} / ${total} answered`;
    }

    function showWaitingOverlay() {
        if (role === 'host') return;
        const gm = config.gameMode || 'automatic';
        if (gm === 'student-paced') return;

        const overlay = $('overlay-waiting');
        if (!overlay) return;

        ensureWaitingPlayersListener();
        overlay.classList.add('active');
        updateWaitingCount(players);
    }

    function hideWaitingOverlay() {
        const overlay = $('overlay-waiting');
        if (overlay) overlay.classList.remove('active');
    }

    function showFeedback(correct, points, options = {}) {
        stopQuestionTrack();
        const overlay = $('overlay-feedback');
        const icon = $('feedback-icon');
        const text = $('feedback-text');
        const pts = $('feedback-points');

        if (options.shield) {
            overlay.className = 'qg-overlay qg-feedback active shield';
            icon.innerHTML = '<i class="fa-solid fa-shield-halved"></i>';
            text.textContent = 'Shield protected you!';
            pts.textContent = '';
        } else {
            overlay.className = 'qg-overlay qg-feedback active ' + (correct ? 'correct' : 'incorrect');
            icon.innerHTML = correct
                ? '<i class="fa-solid fa-check"></i>'
                : '<i class="fa-solid fa-xmark"></i>';
            text.textContent = correct ? 'Correct!' : 'Wrong!';
            pts.textContent = correct ? `+${points} points` : '';
        }

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
        isBonusActive = false;
        stopBonusShuffleTrack();
        if (!FirebaseService.isDemo()) {
            FirebaseService.updateSessionField(gameCode, 'status', 'finished');
        }
        showResults();
    }

    function isStudentFinished(p) {
        const tot = questions.length || 1;
        return (p?.progress || 0) >= tot;
    }

    function countFinishedStudents(roster) {
        const total = Object.keys(roster || {}).length;
        let finished = 0;
        Object.values(roster || {}).forEach(p => {
            if (isStudentFinished(p)) finished++;
        });
        return { finished, total };
    }

    function getLiveStandingsSorted(roster) {
        const tot = questions.length || 1;
        return Object.entries(roster || {})
            .map(([uid, p]) => ({
                uid,
                name: p.name || '',
                score: p.score || 0,
                progress: p.progress || 0,
                avatar: p.avatar || '',
                isDone: (p.progress || 0) >= tot
            }))
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.progress !== a.progress) return b.progress - a.progress;
                return a.name.localeCompare(b.name);
            });
    }

    function updateLiveStandingsFinishedCount(roster) {
        const el = $('live-standings-finished-count');
        if (!el) return;
        const { finished, total } = countFinishedStudents(roster);
        el.textContent = `${finished} / ${total} students finished`;
    }

    function createLiveStandingsRow(entry, rank) {
        const row = document.createElement('div');
        row.className = 'qg-ls-row';
        row.setAttribute('role', 'listitem');
        row.dataset.uid = entry.uid;
        row.innerHTML = `
            <span class="qg-ls-rank">${rank}</span>
            <span class="qg-ls-rank-change" aria-hidden="true"></span>
            <div class="qg-ls-avatar" aria-hidden="true"></div>
            <div class="qg-ls-info">
                <span class="qg-ls-name"></span>
                <span class="qg-ls-score"></span>
            </div>
        `;
        updateLiveStandingsRow(row, entry, rank, null);
        return row;
    }

    function updateLiveStandingsRow(row, entry, rank, prevRank) {
        row.querySelector('.qg-ls-rank').textContent = rank;
        row.querySelector('.qg-ls-name').textContent = entry.name;
        row.querySelector('.qg-ls-score').textContent = entry.score + ' pts';

        const avatarId = entry.avatar || '';
        if (row.dataset.playerAvatar !== avatarId) {
            const avatarEl = row.querySelector('.qg-ls-avatar');
            if (avatarEl) avatarEl.innerHTML = getLobbyAvatarInnerHtml(avatarId);
            row.dataset.playerAvatar = avatarId;
        }

        const isSelf = entry.uid === FirebaseService.getUid();
        row.classList.toggle('qg-ls-row--self', isSelf);
        row.classList.toggle('qg-ls-row--done', entry.isDone);

        const changeEl = row.querySelector('.qg-ls-rank-change');
        if (prevRank != null && prevRank !== rank) {
            const movedUp = rank < prevRank;
            changeEl.textContent = movedUp ? '▲' : '▼';
            changeEl.className = 'qg-ls-rank-change ' + (movedUp ? 'qg-ls-rank-change--up' : 'qg-ls-rank-change--down');
            row.classList.remove('qg-ls-row--moved');
            void row.offsetWidth;
            row.classList.add('qg-ls-row--moved');
        } else if (changeEl) {
            changeEl.textContent = '';
            changeEl.className = 'qg-ls-rank-change';
        }
    }

    function renderLiveStandings(roster) {
        const container = $('live-standings-list');
        if (!container) return;

        const sorted = getLiveStandingsSorted(roster);
        const activeUids = new Set(sorted.map(entry => entry.uid));

        liveStandingsRowMap.forEach((el, uid) => {
            if (!activeUids.has(uid)) {
                el.remove();
                liveStandingsRowMap.delete(uid);
                liveStandingsRankMap.delete(uid);
            }
        });

        sorted.forEach((entry, index) => {
            const rank = index + 1;
            const prevRank = liveStandingsRankMap.get(entry.uid);
            let row = liveStandingsRowMap.get(entry.uid);
            if (!row) {
                row = createLiveStandingsRow(entry, rank);
                liveStandingsRowMap.set(entry.uid, row);
            } else {
                updateLiveStandingsRow(row, entry, rank, prevRank);
            }
            liveStandingsRankMap.set(entry.uid, rank);
        });

        sorted.forEach((entry, index) => {
            const row = liveStandingsRowMap.get(entry.uid);
            const ref = container.children[index];
            if (row && ref !== row) {
                container.insertBefore(row, ref || null);
            }
        });

        updateLiveStandingsFinishedCount(roster);
    }

    function ensureLiveStandingsListener() {
        if (liveStandingsListenerAdded || FirebaseService.isDemo() || !gameCode) return;
        liveStandingsListenerAdded = true;
        const unsub = FirebaseService.onPlayersChange(gameCode, roster => {
            players = roster || {};
            if (onLiveStandings) renderLiveStandings(players);
        });
        listeners.push(unsub);
    }

    function showLiveStandings() {
        clearInterval(timerInterval);
        stopQuestionTrack();
        hideWaitingOverlay();
        hideShortcutPanels();
        onLiveStandings = true;

        if (!FirebaseService.isDemo()) {
            FirebaseService.updatePlayerScore(gameCode, FirebaseService.getUid(), myScore, myStreak);
            FirebaseService.updateSessionField(gameCode,
                'players/' + FirebaseService.getUid() + '/progress', questions.length);
        } else {
            const uid = FirebaseService.getUid() || 'demo_self';
            players[uid] = {
                name: playerName || 'You',
                score: myScore,
                streak: myStreak,
                progress: questions.length,
                avatar: selectedAvatar || ''
            };
        }

        showScreen('screen-live-standings');
        syncStudentMusicChrome();
        renderLiveStandings(players);

        if (!FirebaseService.isDemo()) {
            ensureLiveStandingsListener();
            FirebaseService.getSession(gameCode).then(session => {
                if (session?.players) {
                    players = session.players;
                    renderLiveStandings(players);
                }
            });
        }
    }

    function showResults() {
        onLiveStandings = false;
        isBonusActive = false;
        stopBonusShuffleTrack();
        stopQuestionTrack();
        $('sv-bonus-container')?.classList.add('qg-hidden');
        hideWaitingOverlay();
        showScreen('screen-results');
        syncStudentMusicChrome();

        // Gather final scores
        const finalPlayers = role === 'host' ? players : {};

        const extraActions = document.querySelector('.qg-results-extra-actions');
        if (extraActions) {
            extraActions.style.display = role === 'host' ? 'flex' : 'none';
        }

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
        if (role === 'host') {
            playHostPodiumSfx();
        }
    }

    function hideShortcutPanels() {
        $('sv-shortcut')?.classList.add('qg-hidden');
        $('sv-shortcut-live')?.classList.add('qg-hidden');
        $('student-view')?.classList.remove('qg-has-shortcut');
        stopLiveShortcutListener();
    }

    function renderPodiumAvatar(container, avatarId, medal) {
        if (!container) return;
        let imgHtml = '';
        if (avatarId) {
            const resolved = resolveAvatarId(avatarId);
            if (resolved) {
                imgHtml = `<img class="qg-podium-avatar-img" src="${getAvatarSrc(resolved)}" alt="">`;
            }
        }
        container.innerHTML = `${imgHtml}<span class="qg-podium-medal" aria-hidden="true">${medal}</span>`;
    }

    function renderResults(playerData) {
        const sorted = Object.entries(playerData || {})
            .map(([uid, p]) => ({
                uid,
                name: p.name,
                score: p.score || 0,
                streak: p.streak || 0,
                avatar: p.avatar || ''
            }))
            .sort((a, b) => b.score - a.score);

        lastSortedResults = sorted;
        const medals = ['🥇', '🥈', '🥉'];

        // Podium
        for (let i = 0; i < 3; i++) {
            const place = $('podium-' + (i + 1));
            if (sorted[i]) {
                place.querySelector('.qg-podium-name').textContent = sorted[i].name;
                place.querySelector('.qg-podium-score').textContent = sorted[i].score + ' pts';
                renderPodiumAvatar(place.querySelector('.qg-podium-avatar'), sorted[i].avatar, medals[i]);
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

    function downloadScoreboard() {
        if (!lastSortedResults || lastSortedResults.length === 0) return;

        let csv = 'Rank,Name,Score,Max Streak\n';
        lastSortedResults.forEach((p, i) => {
            csv += `${i + 1},"${p.name.replace(/"/g, '""')}",${p.score},${p.streak}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
        link.setAttribute('href', url);
        link.setAttribute('download', `scoreboard_${gameCode || 'quiz'}_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ===== BONUS STAGE LOGIC =====
    let isBonusActive = false;
    let skipBonusCheck = false;
    let pendingPowerup = null; // Stores '5050', 'time', 'shield', or 'double'

    function startBonusStage(context) {
        isBonusActive = true;

        if (context === 'host' || context === 'auto') {
            // TODO(BonusDebug): remove diagnostic log once bonus sync is confirmed stable in classrooms.
            console.log('[BonusDebug]', Date.now(), 'startBonusStage', context, {
                role,
                currentQ,
                isBonusActive: true
            });
        }

        if (role === 'host') {
            // Hide question/answer/timer, show the indicator
            $('tv-question').classList.add('qg-hidden');
            $('tv-answers').classList.add('qg-hidden');
            $('tv-timer-container').classList.add('qg-hidden');
            $('tv-bonus-indicator').classList.remove('qg-hidden');

            // Wait for players to finish bonus then resume the current question
            delayUnlessFrozen(() => {
                finishHostBonusRound();
            }, BONUS_STAGE_DURATION_MS);
            return;
        }

        // Student View Logic
        stopQuestionTrack();
        $('sv-question').classList.add('qg-hidden');
        $('sv-answers').classList.add('qg-hidden');
        $('sv-timer-container').classList.add('qg-hidden');
        hideShortcutPanels();

        const bonusContainer = $('sv-bonus-container');
        bonusContainer.classList.remove('qg-hidden');
        playSfxOneShot('sfx-bonus-stage-intro');

        // Generate Rewards
        const rewards = generateBonusRewards();
        renderBonusCards(rewards, context);
    }

    function generateBonusRewards() {
        const pool = [
            { type: 'points', val: 100, text: '+100 Pts', icon: 'fa-coins', class: 'positive', weight: 3 },
            { type: 'points', val: 200, text: '+200 Pts', icon: 'fa-coins', class: 'positive', weight: 2 },
            { type: 'points', val: 500, text: '+500 Pts', icon: 'fa-gem', class: 'positive', weight: 2 },
            { type: 'points', val: -100, text: '-100 Pts', icon: 'fa-skull', class: 'negative', weight: 3 },
            { type: 'points', val: -200, text: '-200 Pts', icon: 'fa-skull-crossbones', class: 'negative', weight: 2 },
            { type: 'powerup', val: '5050', text: '50:50', icon: 'fa-arrows-down-to-line', class: 'powerup', weight: 3 },
            { type: 'powerup', val: 'time', text: '+Extra Time', icon: 'fa-stopwatch-20', class: 'powerup', weight: 2 },
            { type: 'points', val: 0, text: 'Blank', icon: 'fa-ghost', class: 'powerup', weight: 3 },
            { type: 'powerup', val: 'shield', text: 'Shield', icon: 'fa-shield-halved', class: 'powerup', weight: 2 },
            { type: 'powerup', val: 'double', text: '2x Points', icon: 'fa-clone', class: 'powerup', weight: 2 },
            { type: 'points', val: 1000, text: '+1000 Pts', icon: 'fa-trophy', class: 'positive', weight: 1 }
        ];

        return weightedSampleWithoutReplacement(pool, 6);
    }

    function weightedSampleWithoutReplacement(pool, count) {
        const remaining = pool.slice();
        const picked = [];
        const n = Math.min(count, remaining.length);
        for (let i = 0; i < n; i++) {
            const totalWeight = remaining.reduce((sum, item) => sum + (item.weight || 1), 0);
            let roll = Math.random() * totalWeight;
            let idx = remaining.length - 1;
            for (let j = 0; j < remaining.length; j++) {
                roll -= remaining[j].weight || 1;
                if (roll <= 0) {
                    idx = j;
                    break;
                }
            }
            picked.push(remaining.splice(idx, 1)[0]);
        }
        return picked;
    }

    function renderBonusCards(rewards, context) {
        const grid = $('sv-bonus-grid');
        grid.innerHTML = '';
        grid.parentNode.classList.remove('shuffling');

        rewards.forEach((r, i) => {
            const wrapper = document.createElement('div');
            wrapper.className = `qg-bonus-card-wrapper qg-bonus-pos-${i}`;
            wrapper.dataset.index = i;

            const card = document.createElement('div');
            // Cards start face-up (NOT flipped) — showing their reward
            card.className = 'qg-bonus-card';

            card.innerHTML = `
                <div class="qg-bonus-card-inner">
                    <div class="qg-bonus-card-front"><i class="fa-solid fa-question"></i></div>
                    <div class="qg-bonus-card-back ${r.class}">
                        <i class="fa-solid ${r.icon}"></i>
                        <div class="qg-bonus-card-text">${r.text}</div>
                    </div>
                </div>
            `;

            wrapper.appendChild(card);
            grid.appendChild(wrapper);
        });

        if (isDevFreeze()) {
            grid.querySelectorAll('.qg-bonus-card').forEach(c => c.classList.add('is-flipped'));
            shuffleBonusCards(grid, rewards, context, { instant: true });
            return;
        }

        // Phase 1: Show rewards (cards face-up)
        delayUnlessFrozen(() => {
            // Phase 2: Flip cards face-down (add is-flipped to show the question-mark side)
            const cards = grid.querySelectorAll('.qg-bonus-card');
            cards.forEach(c => c.classList.add('is-flipped'));

            // Phase 3: Start shuffling after the flip animation completes
            delayUnlessFrozen(() => {
                shuffleBonusCards(grid, rewards, context);
            }, BONUS_FLIP_WAIT_MS);
        }, BONUS_REVEAL_MS);
    }

    function shuffleBonusCards(grid, rewards, context, options = {}) {
        grid.parentNode.classList.add('shuffling');
        startBonusShuffleTrack();
        const wrappers = Array.from(grid.querySelectorAll('.qg-bonus-card-wrapper'));
        let positions = [0, 1, 2, 3, 4, 5];

        function applyPositions(nextPositions) {
            wrappers.forEach((w, i) => {
                w.className = `qg-bonus-card-wrapper qg-bonus-pos-${nextPositions[i]}`;
            });
        }

        function enableCardClicks() {
            grid.parentNode.classList.remove('shuffling');
            wrappers.forEach((w, i) => {
                const card = w.querySelector('.qg-bonus-card');
                card.addEventListener('click', () => {
                    if (!isBonusActive) return;
                    selectBonusCard(card, rewards[i], context, grid);
                }, { once: true });
            });
        }

        if (options.instant) {
            applyPositions(positions.sort(() => Math.random() - 0.5));
            enableCardClicks();
            return;
        }

        let shuffles = 0;
        const shuffleInterval = setInterval(() => {
            positions = positions.sort(() => Math.random() - 0.5);
            applyPositions(positions);

            shuffles++;
            if (shuffles >= BONUS_SHUFFLE_CYCLES) {
                clearInterval(shuffleInterval);
                enableCardClicks();
            }
        }, BONUS_SHUFFLE_INTERVAL_MS);
    }

    function selectBonusCard(selectedCard, reward, context, grid) {
        isBonusActive = false;
        stopBonusShuffleTrack();

        const isPositive = (reward.type === 'points' && reward.val > 0)
            || (reward.type === 'powerup' && reward.val !== 0);
        playSfxOneShot(isPositive ? 'sfx-positive-bonus' : 'sfx-negative-bonus');

        // Flip ALL cards face-up to reveal everything
        grid.querySelectorAll('.qg-bonus-card').forEach(c => {
            c.classList.remove('is-flipped');
            if (c !== selectedCard) {
                c.classList.add('not-selected');
            }
        });

        // Highlight selected card
        selectedCard.classList.add('selected');

        // Apply reward
        if (reward.type === 'points') {
            myScore += reward.val;
            $('sv-score').textContent = myScore;
            $('sv-score').classList.add('pop');
            setTimeout(() => $('sv-score').classList.remove('pop'), 300);

            if (!FirebaseService.isDemo()) {
                FirebaseService.updatePlayerScore(gameCode, FirebaseService.getUid(), myScore, myStreak);
            }
        } else if (reward.type === 'powerup') {
            pendingPowerup = reward.val; // '5050', 'time', 'shield', or 'double'
            console.log('[QuizGame] Powerup earned and stored:', pendingPowerup);
        }

        // Leave visible for a moment then resume
        delayUnlessFrozen(() => {
            $('sv-bonus-container').classList.add('qg-hidden');
            hideShortcutPanels();
            if (context === 'student-paced') {
                studentPacedNextQuestion();
            } else {
                // For host-paced/auto, show "waiting" until host advances
                $('sv-question').classList.remove('qg-hidden');
                $('sv-answers').classList.add('qg-hidden');
                $('sv-question').innerHTML = '<h3>Waiting for host...</h3>';
            }
        }, 3500);
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
                case 'bonus-positive':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(523, now);      // C5
                    osc.frequency.setValueAtTime(659, now + 0.1); // E5
                    osc.frequency.setValueAtTime(784, now + 0.2); // G5
                    osc.frequency.setValueAtTime(1047, now + 0.3); // C6
                    gain.gain.setValueAtTime(0.18, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                    osc.start(now);
                    osc.stop(now + 0.6);
                    break;
                case 'bonus-negative':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(350, now);
                    osc.frequency.setValueAtTime(250, now + 0.15);
                    osc.frequency.setValueAtTime(180, now + 0.3);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                    osc.start(now);
                    osc.stop(now + 0.45);
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
        console.log(`[QuizGame] Transitioning to screen: ${id} (Role: ${role})`);
        document.querySelectorAll('.qg-screen').forEach(s => s.classList.remove('active'));
        $(id).classList.add('active');
        updateFloatingThemeBtn(id);

        // Show/hide session badge depending on screen
        const badgeScreens = ['screen-lobby', 'screen-game', 'screen-waiting', 'screen-live-standings'];
        if (gameCode && badgeScreens.includes(id)) {
            showSessionBadge(gameCode);
        } else if (!badgeScreens.includes(id)) {
            hideSessionBadge();
        }
    }

    // ===== CLEANUP =====
    function cleanup() {
        clearInterval(timerInterval);
        clearTimeout(kickCheckTimer);
        stopLiveShortcutListener();
        listeners.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
        listeners = [];
        role = null;
        gameCode = null;
        currentQ = -1;
        players = {};
        myScore = 0;
        myStreak = 0;
        hasAnswered = false;
        playerGameStarted = false; // Reset so next session starts clean
        waitingPlayersListenerAdded = false;
        playerKicked = false;
        resetWaitingMiniGamesForLobby();
        onLiveStandings = false;
        liveStandingsListenerAdded = false;
        hideWaitingOverlay();
        stopBonusShuffleTrack();
        stopQuestionTrack();
        lastQuestionTrackIndex = null;
        lastPlayerSync = { currentQuestion: -2, questionStartedAt: 0, bonusActive: false, status: '' };
        playerSessionGen = 0;
        $('teacher-view').classList.remove('active');
        $('student-view').classList.remove('active');
        $('teacher-view')?.classList.remove('qg-teacher-view--student-paced');
        $('btn-sv-music')?.classList.add('qg-hidden');
        hideSessionBadge();
        lobbyPlayerCardMap.forEach((el) => el.remove());
        lobbyPlayerCardMap.clear();
        liveStandingsRowMap.forEach((el) => el.remove());
        liveStandingsRowMap.clear();
        liveStandingsRankMap.clear();
        clearHostLeaderboardRows();

        // Only remove if it's a full cleanup (leaving session)
        // Note: we don't remove on refresh, only on manual 'New Game' or 'Cancel'
    }

    function playAgain() {
        if (role === 'host') {
            cleanup();
            showScreen('screen-setup');
        } else {
            cleanup();
            goToEntryHome();
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
    const THEME_PICKER_ORDER = [
        'default', 'gold-black', 'lego', 'neon', 'citrus', 'retro-arcade', 'kawaii-pastel',
        'mint-pop', 'peach-cream', 'pink-pop', 'frost-white'
    ];

    // `keyboard` picks the Keyboard Shortcut Playground keycap palette used for
    // Shortcut Combo questions on this player's device.
    const QUIZ_THEMES = {
        'default': {
            label: 'Classic',
            palette: ['#3d348b', '#7678ed', '#f7b801', '#9b9eff', '#f0eeff'],
            '--qg-bg-color': '#7678ed',
            '--qg-text': '#ffffff',
            '--qg-accent': '#f7b801',
            '--qg-panel-accent': '#f7b801',
            '--qg-particle': 'rgba(255,255,255,0.08)',
            keyboard: 'keyboard--palette-classic',
            dark: { '--qg-bg-color': '#1a1530', '--qg-bg-from': '#1a1530', '--qg-bg-to': '#2c2a5a', '--qg-text': '#ffffff' },
            roleCards: {
                host: { face: '#f7b801', depth: '#b88a00', text: '#1a1530', icon: '#1a1530' },
                join: { face: '#9b9eff', depth: '#5c5fd4', text: '#ffffff', icon: '#ffffff' },
                dark: {
                    host: { face: '#524d82', depth: '#32305a', text: '#ffffff', icon: '#f7b801' },
                    join: { face: '#625d92', depth: '#3a3868', text: '#ffffff', icon: '#b8bbff' }
                }
            }
        },
        'gold-black': {
            label: 'Gold Black',
            palette: ['#0B0B0C', '#1A1B1F', '#3B3C41', '#D4AF37', '#F5E6C8'],
            '--qg-bg-color': '#0B0B0C',
            '--qg-bg-from': '#0B0B0C',
            '--qg-bg-to': '#1A1B1F',
            '--qg-text': '#F5E6C8',
            '--qg-subtitle-': '#3B3C41',
            '--qg-theme-btn-icon': '#0B0B0C',
            '--qg-accent': '#D4AF37',
            '--qg-panel-accent': '#D4AF37',
            '--qg-particle': 'rgba(212,175,55,0.18)',
            keyboard: 'keyboard--palette-gold-black',
            dark: {
                '--qg-bg-color': '#0B0B0C',
                '--qg-bg-from': '#0B0B0C',
                '--qg-bg-to': '#1A1B1F',
                '--qg-text': '#F5E6C8',
                '--qg-particle': 'rgba(245,230,200,0.12)'
            },
            roleCards: {
                host: { face: '#D4AF37', depth: '#9a7c22', text: '#0B0B0C', icon: '#0B0B0C' },
                join: { face: '#3B3C41', depth: '#1A1B1F', text: '#F5E6C8', icon: '#D4AF37' },
                dark: {
                    host: { face: '#D4AF37', depth: '#9a7c22', text: '#0B0B0C', icon: '#0B0B0C' },
                    join: { face: '#3B3C41', depth: '#1A1B1F', text: '#F5E6C8', icon: '#D4AF37' }
                }
            }
        },
        'retro-arcade': {
            label: 'Retro Arcade',
            light: true,
            palette: ['#EBE0CA', '#8F2F2B', '#221B17', '#1A1816', '#c4a882'],
            '--qg-bg-color': '#EBE0CA',
            '--qg-bg-from': '#221B17',
            '--qg-bg-to': '#8F2F2B',
            '--qg-theme-btn-icon': '#EBE0CA',
            '--qg-text': '#221B17',
            '--qg-accent': '#8F2F2B',
            '--qg-panel-accent': '#8F2F2B',
            '--qg-particle': 'rgba(143,47,43,0.22)',
            keyboard: 'keyboard--palette-retro-arcade',
            dark: {
                '--qg-bg-color': '#221B17',
                '--qg-bg-from': '#1A1816',
                '--qg-bg-to': '#8F2F2B',
                '--qg-text': '#EBE0CA',
                '--qg-particle': 'rgba(235,224,202,0.16)'
            },
            roleCards: {
                host: { face: '#8F2F2B', depth: '#5c1c19', text: '#EBE0CA', icon: '#EBE0CA' },
                join: { face: '#3D3535', depth: '#000000', text: '#EBE0CA', icon: '#EBE0CA' },
                dark: {
                    host: { face: '#8F2F2B', depth: '#5c1c19', text: '#EBE0CA', icon: '#EBE0CA' },
                    join: { face: '#3a322c', depth: '#221B17', text: '#EBE0CA', icon: '#EBE0CA' }
                }
            }
        },
        'kawaii-pastel': {
            label: 'Kawaii Pastel',
            light: true,
            palette: ['#ffffb0', '#ffabde', '#dbafff', '#afd0ff', '#aafff8'],
            '--qg-bg-color': '#FFFDCF',
            '--qg-bg-from': '#dbafff',
            '--qg-bg-to': '#ffabde',
            '--qg-text': '#3a2450',
            '--qg-accent': '#dbafff',
            '--qg-panel-accent': '#7a4a9e',
            '--qg-particle': 'rgba(219,175,255,0.32)',
            keyboard: 'keyboard--palette-kawaii-pastel',
            dark: {
                '--qg-bg-color': '#3a2450',
                '--qg-bg-from': '#3a2450',
                '--qg-bg-to': '#6b3b7a',
                '--qg-text': '#ffffb0',
                '--qg-particle': 'rgba(255,171,222,0.18)'
            },
            roleCards: {
                host: { face: '#ffabde', depth: '#d486b8', text: '#3a2450', icon: '#3a2450' },
                join: { face: '#dbafff', depth: '#b38ad9', text: '#3a2450', icon: '#3a2450' },
                dark: {
                    host: { face: '#6b3b7a', depth: '#3a2450', text: '#ffffb0', icon: '#ffabde' },
                    join: { face: '#4a3470', depth: '#2e2247', text: '#ffffff', icon: '#dbafff' }
                }
            }
        },
        'mint-pop': {
            label: 'Mint Pop',
            light: true,
            palette: ['#F8FAFC', '#A7F3D0', '#5EEAD4', '#99F6E4', '#0F766E'],
            '--qg-bg-color': '#D9FFEC',
            '--qg-bg-from': '#0F766E',
            '--qg-bg-to': '#5EEAD4',
            '--qg-text': '#0F766E',
            '--qg-accent': '#0F766E',
            '--qg-panel-accent': '#0F766E',
            '--qg-particle': 'rgba(15,118,110,0.18)',
            keyboard: 'keyboard--palette-mint-pop',
            dark: {
                '--qg-bg-color': '#0a4a46',
                '--qg-bg-from': '#0a4a46',
                '--qg-bg-to': '#0F766E',
                '--qg-text': '#F8FAFC',
                '--qg-particle': 'rgba(94,234,212,0.16)'
            },
            roleCards: {
                host: { face: '#5EEAB9', depth: '#2FBF94', text: '#0a4a46', icon: '#0a4a46' },
                join: { face: '#0F766E', depth: '#0a4a46', text: '#F8FAFC', icon: '#F8FAFC' },
                dark: {
                    host: { face: '#5EEAB9', depth: '#0a4a46', text: '#F8FAFC', icon: '#A7F3D0' },
                    join: { face: '#145e58', depth: '#0a3a38', text: '#ffffff', icon: '#5EEAD4' }
                }
            }
        },
        'peach-cream': {
            label: 'Peach Cream',
            light: true,
            palette: ['#FFEBD1', '#fe90a0', '#afdcd4', '#ffbab3', '#ff6632'],
            '--qg-bg-color': '#FFEBD1',
            '--qg-bg-from': '#ff6632',
            '--qg-bg-to': '#fe90a0',
            '--qg-text': '#5c2210',
            '--qg-accent': '#ff6632',
            '--qg-panel-accent': '#ff6632',
            '--qg-particle': 'rgba(255,102,50,0.22)',
            keyboard: 'keyboard--palette-peach-cream',
            dark: {
                '--qg-bg-color': '#5c2210',
                '--qg-bg-from': '#3b1a0a',
                '--qg-bg-to': '#ff6632',
                '--qg-text': '#fff0e1',
                '--qg-particle': 'rgba(255,186,179,0.16)'
            },
            roleCards: {
                host: { face: '#FFAA8A', depth: '#E87E56', text: '#3b1a0a', icon: '#3b1a0a' },
                join: { face: '#FFA3B2', depth: '#DB6979', text: '#5c2210', icon: '#5c2210' },
                dark: {
                    host: { face: '#c44a20', depth: '#7a2e12', text: '#fff0e1', icon: '#ffbab3' },
                    join: { face: '#8a4038', depth: '#5c2210', text: '#fff0e1', icon: '#fe90a0' }
                }
            }
        },
        'pink-pop': {
            label: 'Pink Pop',
            light: true,
            palette: ['#FFD6E1', '#FFB3C6', '#FFC2D1', '#FF8FAB', '#FB6F92'],
            '--qg-bg-color': '#FFD6E1',
            '--qg-bg-from': '#FB6F92',
            '--qg-bg-to': '#FF8FAB',
            '--qg-text': '#6c2944',
            '--qg-accent': '#FB6F92',
            '--qg-panel-accent': '#FB6F92',
            '--qg-particle': 'rgba(251,111,146,0.24)',
            keyboard: 'keyboard--palette-pink-pop',
            dark: {
                '--qg-bg-color': '#6c2944',
                '--qg-bg-from': '#6c2944',
                '--qg-bg-to': '#FB6F92',
                '--qg-text': '#FFE1E9',
                '--qg-particle': 'rgba(255,177,198,0.18)'
            },
            roleCards: {
                host: { face: '#FB6F92', depth: '#d44e72', text: '#3a1528', icon: '#3a1528' },
                join: { face: '#FFB3C6', depth: '#e889a4', text: '#6c2944', icon: '#6c2944' },
                dark: {
                    host: { face: '#a03860', depth: '#6c2944', text: '#FFE1E9', icon: '#FFB3C6' },
                    join: { face: '#8a3058', depth: '#5a2040', text: '#ffffff', icon: '#FFC2D1' }
                }
            }
        },
        'frost-white': {
            label: 'Frost White',
            light: true,
            palette: ['#F8F8F8', '#E2E2E2', '#BDBDBD', '#979797', '#6A6A6A'],
            '--qg-bg-color': '#F8F8F8',
            '--qg-bg-from': '#6A6A6A',
            '--qg-bg-to': '#BDBDBD',
            '--qg-text': '#6A6A6A',
            '--qg-accent': '#6A6A6A',
            '--qg-panel-accent': '#6A6A6A',
            '--qg-particle': 'rgba(106,106,106,0.20)',
            keyboard: 'keyboard--palette-frost-white',
            dark: {
                '--qg-bg-color': '#161717',
                '--qg-bg-from': '#3a3a3a',
                '--qg-bg-to': '#6A6A6A',
                '--qg-text': '#F8F8F8',
                '--qg-particle': 'rgba(226,226,226,0.16)'
            },
            roleCards: {
                host: { face: '#E2E2E2', depth: '#BDBDBD', text: '#3a3a3a', icon: '#3a3a3a' },
                join: { face: '#6A6A6A', depth: '#4a4a4a', text: '#F8F8F8', icon: '#F8F8F8' },
                dark: {
                    host: { face: '#6A6A6A', depth: '#4a4a4a', text: '#F8F8F8', icon: '#E2E2E2' },
                    join: { face: '#4a4a4a', depth: '#2e2e2e', text: '#ffffff', icon: '#BDBDBD' }
                }
            }
        },
        'lego': {
            label: 'LEGO',
            light: true,
            palette: ['#FFD700', '#DA291C', '#006CB7', '#FFFFFF', '#000000'],
            '--qg-bg-color': '#FFD700',
            '--qg-bg-from': '#DA291C',
            '--qg-bg-to': '#006CB7',
            '--qg-text': '#000000',
            '--qg-theme-btn-icon': '#FFFFFF',
            '--qg-accent': '#DA291C',
            '--qg-panel-accent': '#DA291C',
            '--qg-particle': 'rgba(183, 150, 0, 0.22)',
            keyboard: 'keyboard--palette-lego',
            dark: {
                '--qg-bg-color': '#000000',
                '--qg-bg-from': '#000000',
                '--qg-bg-to': '#DA291C',
                '--qg-text': '#FFD700',
                '--qg-particle': 'rgba(255,215,0,0.16)'
            },
            roleCards: {
                host: { face: '#006CB7', depth: '#004A82', text: '#FFFFFF', icon: '#FFFFFF' },
                join: { face: '#DA291C', depth: '#9e1c14', text: '#FFFFFF', icon: '#FFFFFF' },
                dark: {
                    host: { face: '#006CB7', depth: '#004A82', text: '#FFFFFF', icon: '#FFD700' },
                    join: { face: '#DA291C', depth: '#9e1c14', text: '#FFFFFF', icon: '#FFD700' }
                }
            }
        },
        'neon': {
            label: 'Neon',
            disableDark: true,
            palette: ['#111111', '#B026FF', '#FF2DAA', '#00FFD5', '#FFF200'],
            '--qg-bg-color': '#09090e',
            '--qg-bg-from': '#09090e',
            '--qg-bg-to': '#45125e',
            '--qg-text': '#00FFD5',
            '--qg-accent': '#B026FF',
            '--qg-panel-accent': '#B026FF',
            '--qg-particle': 'rgba(0,255,213,0.22)',
            keyboard: 'keyboard--palette-neon',
            roleCards: {
                host: { face: '#B026FF', depth: '#6e00b8', text: '#FFFFFF', icon: '#FFFFFF' },
                join: { face: '#FF2DAA', depth: '#b01872', text: '#FFFFFF', icon: '#FFFFFF' }
            }
        },
        'citrus': {
            label: 'Citrus',
            light: true,
            palette: ['#FDD69B', '#FDF05D', '#FCC92F', '#608336', '#A74900'],
            '--qg-bg-color': '#FDD69B',
            '--qg-bg-from': '#608336',
            '--qg-bg-to': '#FCC92F',
            '--qg-text': '#608336',
            '--qg-theme-btn-icon': '#FDD69B',
            '--qg-accent': '#A74900',
            '--qg-panel-accent': '#A74900',
            '--qg-particle': 'rgba(96,131,54,0.22)',
            keyboard: 'keyboard--palette-citrus',
            dark: {
                '--qg-bg-color': '#608336',
                '--qg-bg-from': '#3f5a22',
                '--qg-bg-to': '#A74900',
                '--qg-text': '#FDD69B',
                '--qg-particle': 'rgba(253,240,93,0.16)'
            },
            roleCards: {
                host: { face: '#FCC92F', depth: '#E4A646', text: '#608336', icon: '#608336' },
                join: { face: '#608336', depth: '#3f5a22', text: '#FDD69B', icon: '#FDD69B' },
                dark: {
                    host: { face: '#A74900', depth: '#6e3000', text: '#FDD69B', icon: '#FDF05D' },
                    join: { face: '#3f5a22', depth: '#2a3c16', text: '#FDD69B', icon: '#FCC92F' }
                }
            }
        }
    };

    // Lightweight canvas animation per theme
    let bgAnimFrame = null;
    let bgParticles = [];

    const BG_PARTICLE_ICONS = {
        frost: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="256" height="256"><path fill="currentColor" d="M19 27.586V8.415l4.828-4.829s.707-.707 0-1.415c-.707-.707-1.414 0-1.414 0L19 5.586V1s0-1-1-1s-1 1-1 1v4.586l-3.414-3.415s-.707-.707-1.414 0c-.707.708 0 1.415 0 1.415L17 8.415v19.171l-4.828 4.828s-.707.707 0 1.414s1.414 0 1.414 0L17 30.414V35s0 1 1 1s1-1 1-1v-4.586l3.414 3.414s.707.707 1.414 0s0-1.414 0-1.414L19 27.586z"/><path fill="currentColor" d="M34.622 20.866c-.259-.966-1.225-.707-1.225-.707l-6.595 1.767l-16.603-9.586l-1.767-6.595s-.259-.966-1.225-.707C6.24 5.297 6.5 6.263 6.5 6.263l1.25 4.664l-3.972-2.294s-.866-.5-1.366.366c-.5.866.366 1.366.366 1.366l3.971 2.293l-4.664 1.249s-.967.259-.707 1.225c.259.967 1.225.708 1.225.708l6.596-1.767l16.603 9.586l1.767 6.596s.259.966 1.225.707c.966-.26.707-1.225.707-1.225l-1.25-4.664l3.972 2.293s.867.5 1.367-.365c.5-.867-.367-1.367-.367-1.367l-3.971-2.293l4.663-1.249c0-.001.966-.26.707-1.226z"/><path fill="currentColor" d="M33.915 13.907l-4.664-1.25l3.972-2.293s.867-.501.367-1.367c-.501-.867-1.367-.366-1.367-.366l-3.971 2.292l1.249-4.663s.259-.966-.707-1.225c-.966-.259-1.225.707-1.225.707l-1.767 6.595l-16.604 9.589l-6.594-1.768s-.966-.259-1.225.707c-.26.967.707 1.225.707 1.225l4.663 1.249l-3.971 2.293s-.865.501-.365 1.367c.5.865 1.365.365 1.365.365l3.972-2.293l-1.25 4.663s-.259.967.707 1.225c.967.26 1.226-.706 1.226-.706l1.768-6.597l16.604-9.585l6.595 1.768s.966.259 1.225-.707c.255-.967-.71-1.225-.71-1.225z"/></svg>',
        lego: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="256" height="256"><path fill="currentColor" fill-rule="evenodd" d="M664.4,261.1h-42.2v-96.5c0-8.1-6.5-14.6-14.6-14.6h-165.2c-8.1,0-14.6,6.5-14.6,14.6v96.5h-55.6v-96.5c0-8.1-6.5-14.6-14.6-14.6h-165.2c-8.1,0-14.6,6.5-14.6,14.6v96.5h-42.2c-7.4,0-13.3,6-13.3,13.3v334.4c0,7.4,6,13.3,13.3,13.3h528.9c7.4,0,13.3-6,13.3-13.3v-334.4c0-7.4-6-13.3-13.3-13.3Z"/></svg>',
        citrus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" width="256" height="256"><path fill="currentColor" d="m 12.461819,1.5381967 c -0.541265,-0.54123998 -1.274764,-0.67716998 -1.759944,-0.39454 -1.3806072,0.80418 -4.2480411,-1.24398998 -7.5251386,2.0331 -3.27709736,3.2771 -1.2288968,6.14451 -2.0330833,7.5250703 -0.28263244,0.48521 -0.14671855,1.21873 0.394523,1.75999 0.5412883,0.54129 1.2748108,0.67714 1.7600368,0.3945 1.3804904,-0.80414 4.2479477,1.24404 7.5250221,-2.03303 3.277074,-3.2770803 1.228944,-6.1445303 2.033107,-7.5251003 0.282632,-0.4852 0.146742,-1.21872 -0.394523,-1.75999 z m -5.7458605,1.7006 c -1.3638029,0.34095 -3.136121,2.11301 -3.4771362,3.47714 -0.042586,0.17039 -0.1955154,0.28416 -0.3635386,0.28416 -0.030094,0 -0.060703,-0.004 -0.091242,-0.0113 -0.200906,-0.0503 -0.3230621,-0.25383 -0.272859,-0.45475 0.4083745,-1.63343 2.3868486,-3.61383 4.0228543,-4.02286 0.2009763,-0.0502 0.4045542,0.0719 0.4547572,0.27286 0.050203,0.20093 -0.07193,0.40451 -0.2728356,0.45473 z"/></svg>',
        arcade: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="256" height="256"><path fill="currentColor" fill-rule="evenodd" d="M7 4C3.68629 4 1 6.68629 1 10V14C1 17.3137 3.68629 20 7 20H17C20.3137 20 23 17.3137 23 14V10C23 6.68629 20.3137 4 17 4H7ZM7 15C6.44775 15 6 14.5522 6 14V13H5C4.44775 13 4 12.5522 4 12C4 11.4478 4.44775 11 5 11H6V10C6 9.44775 6.44775 9 7 9C7.55225 9 8 9.44775 8 10V11H9C9.55225 11 10 11.4478 10 12C10 12.5522 9.55225 13 9 13H8V14C8 14.5522 7.55225 15 7 15ZM17 11C17.5522 11 18 10.5522 18 10C18 9.44775 17.5522 9 17 9C16.4478 9 16 9.44775 16 10C16 10.5522 16.4478 11 17 11ZM18 14C18 14.5522 17.5522 15 17 15C16.4478 15 16 14.5522 16 14C16 13.4478 16.4478 13 17 13C17.5522 13 18 13.4478 18 14ZM18 12C18 12.5522 18.4478 13 19 13C19.5522 13 20 12.5522 20 12C20 11.4478 19.5522 11 19 11C18.4478 11 18 11.4478 18 12ZM15 13C14.4478 13 14 12.5522 14 12C14 11.4478 14.4478 11 15 11C15.5522 11 16 11.4478 16 12C16 12.5522 15.5522 13 15 13Z"/></svg>',
        heart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="256" height="256"><path fill="currentColor" d="M1.24264 8.24264L8 15L14.7574 8.24264C15.553 7.44699 16 6.36786 16 5.24264V5.05234C16 2.8143 14.1857 1 11.9477 1C10.7166 1 9.55233 1.55959 8.78331 2.52086L8 3.5L7.21669 2.52086C6.44767 1.55959 5.28338 1 4.05234 1C1.8143 1 0 2.8143 0 5.05234V5.24264C0 6.36786 0.44699 7.44699 1.24264 8.24264Z"/></svg>',
        mint: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="256" height="256"><path fill="currentColor" d="M178.736,512c-2.359,0-4.717-0.899-6.518-2.7c-3.599-3.599-3.598-9.435,0.001-13.033 c81.329-81.309,74.657-213.411,74.581-214.736c-0.295-5.081,3.584-9.44,8.667-9.735c5.098-0.301,9.44,3.586,9.735,8.667 c0.084,1.441,1.949,35.827-6.836,81.238c-8.152,42.139-27.454,101.953-73.113,147.601C183.452,511.101,181.094,512,178.736,512z"/><path fill="currentColor" d="M427.082,161.402c-25.124-13.737-58.485-11.703-92.065-1.543 c24.589-24.4,41.987-52.391,41.987-80.711C377.003,35.436,346.906,0,309.78,0C280.078,0,256,28.348,256,63.319 C256,28.348,231.922,0,202.221,0c-37.127,0-67.224,35.436-67.224,79.148c0,28.32,17.397,56.311,41.987,80.711 c-33.579-10.16-66.94-12.192-92.065,1.543c-38.354,20.969-55.01,64.377-37.199,96.952c14.248,26.062,50.672,33.588,81.356,16.812 c-30.683,16.776-44.007,51.501-29.759,77.562c17.81,32.577,63.341,41.986,101.695,21.016c29.043-15.878,46.29-52.391,54.989-92.75 c8.699,40.359,25.946,76.871,54.989,92.75c38.354,20.969,83.885,11.561,101.695-21.016c14.248-26.06,0.924-60.786-29.759-77.562 c30.683,16.776,67.108,9.248,81.356-16.812C482.091,225.779,465.436,182.372,427.082,161.402z"/></svg>'
    };

    function makeParticleIconImage(svgMarkup, color) {
        const tinted = svgMarkup.replace(/currentColor/g, color);
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(tinted);
        return img;
    }

    function aleaPrng(seed) {
        let s0 = 0.1;
        let s1 = 0.1;
        let s2 = 0.1;
        let c = 1;

        if (seed) {
            const mash = mashHash();
            s0 = mash(' ');
            s1 = mash(' ');
            s2 = mash(' ');
            for (let i = 0; i < seed.length; i++) {
                s0 -= mash(seed[i]);
                if (s0 < 0) s0 += 1;
                s1 -= mash(seed[i]);
                if (s1 < 0) s1 += 1;
                s2 -= mash(seed[i]);
                if (s2 < 0) s2 += 1;
            }
        }

        return function () {
            const t = 2091639 * s0 + c * 2.3283064365386963e-10;
            s0 = s1;
            s1 = s2;
            s2 = t - (c = t | 0);
            return s2;
        };

        function mashHash() {
            let n = 0xefc8249d;
            return function (data) {
                for (let i = 0; i < data.length; i++) {
                    n += data.charCodeAt(i);
                    let h = 0.02519603282416938 * n;
                    n = h >>> 0;
                    h -= n;
                    h *= n;
                    n = h >>> 0;
                    h -= n;
                    n += h * 0x100000000;
                }
                return (n >>> 0) * 2.3283064365386963e-10;
            };
        }
    }

    function SimplexNoise2D(random) {
        const F2 = 0.5 * (Math.sqrt(3) - 1);
        const G2 = (3 - Math.sqrt(3)) / 6;
        const grad3 = [
            [1, 1], [-1, 1], [1, -1], [-1, -1],
            [1, 0], [-1, 0], [1, 0], [-1, 0],
            [0, 1], [0, -1], [0, 1], [0, -1]
        ];
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = Math.floor(random() * 256);
        const perm = new Uint8Array(512);
        const permMod12 = new Uint8Array(512);
        for (let i = 0; i < 512; i++) {
            perm[i] = p[i & 255];
            permMod12[i] = perm[i] % 12;
        }
        this.noise2D = function (xin, yin) {
            const s = (xin + yin) * F2;
            const i = Math.floor(xin + s);
            const j = Math.floor(yin + s);
            const t = (i + j) * G2;
            const x0 = xin - (i - t);
            const y0 = yin - (j - t);
            const i1 = x0 > y0 ? 1 : 0;
            const j1 = x0 > y0 ? 0 : 1;
            const x1 = x0 - i1 + G2;
            const y1 = y0 - j1 + G2;
            const x2 = x0 - 1 + 2 * G2;
            const y2 = y0 - 1 + 2 * G2;
            const ii = i & 255;
            const jj = j & 255;
            const gi0 = permMod12[ii + perm[jj]];
            const gi1 = permMod12[ii + i1 + perm[jj + j1]];
            const gi2 = permMod12[ii + 1 + perm[jj + 1]];
            let n0 = 0;
            let n1 = 0;
            let n2 = 0;
            let t0 = 0.5 - x0 * x0 - y0 * y0;
            if (t0 >= 0) {
                t0 *= t0;
                n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0);
            }
            let t1 = 0.5 - x1 * x1 - y1 * y1;
            if (t1 >= 0) {
                t1 *= t1;
                n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1);
            }
            let t2 = 0.5 - x2 * x2 - y2 * y2;
            if (t2 >= 0) {
                t2 *= t2;
                n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2);
            }
            return 70 * (n0 + n1 + n2);
        };
    }

    function startLavaLampBg(canvas, particleColor) {
        const dpr = window.devicePixelRatio || 1;
        const width = window.innerWidth;
        const height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.classList.add('qg-bg-lava');

        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const simplex = new SimplexNoise2D(aleaPrng('lava-lamp-seed'));
        const noise2D = (x, y) => simplex.noise2D(x, y);
        const random = (min, max) => Math.random() * (max - min) + min;

        const MAX_MASS = 210;
        const INITIAL_RADIUS_MIN = 1;
        const INITIAL_RADIUS_MAX = 2;
        const GROWTH_RATE = 12;
        const MOVE_SPEED_MIN = 8;
        const MOVE_SPEED_MAX = 12;
        const NUM_POINTS = 100;
        const NOISE_SCALE = 0.005;
        const NOISE_STRENGTH = 14;
        const MORPH_SPEED_MIN = 0.2;
        const MORPH_SPEED_MAX = 0.3;
        const NOISE_REDUCTION_RATE = 0.05;
        const MIN_MAX_MASS = 100;
        const SMALL_BUBBLE_CHANCE = 0.01;
        const SMALL_BUBBLE_MAX_MASS_MIN = 20;
        const SMALL_BUBBLE_MAX_MASS_MAX = 80;
        const MIN_BUBBLES = 2;
        const MAX_BUBBLES = 6;
        const FAILSAFE_TIMEOUT = 10;
        const BLOB_SPAWN_INTERVAL_MIN = 30;
        const BLOB_SPAWN_INTERVAL_MAX = 60;

        function Blob(options) {
            this.numPoints = options.numPoints || NUM_POINTS;
            this.initialRadius = options.radius || random(INITIAL_RADIUS_MIN, INITIAL_RADIUS_MAX);
            this.mass = this.initialRadius * 0.1;
            this.massGrowthRate = options.massGrowthRate || GROWTH_RATE;
            this.maxMass = options.maxMass || MAX_MASS;
            this.origin = options.origin || 'top';
            this.direction = this.origin === 'top' ? 1 : -1;
            this.centerX = options.centerX || random(width * 0.2, width * 0.8);
            this.centerY = options.centerY || (this.origin === 'top'
                ? random(-this.initialRadius, 0)
                : random(height, height + this.initialRadius));
            this.color = options.color || particleColor;
            this.speed = options.speed || random(MOVE_SPEED_MIN, MOVE_SPEED_MAX);
            this.morphSpeed = options.morphSpeed || random(MORPH_SPEED_MIN, MORPH_SPEED_MAX);
            this.noiseScale = options.noiseScale || NOISE_SCALE;
            this.noiseStrength = options.noiseStrength || NOISE_STRENGTH;
            this.initialNoiseStrength = this.noiseStrength;
            this.vx = 0;
            this.vy = 0;
            this.state = 'growing';
            this.radius = this.initialRadius;
            this.movingStartTime = null;
            this.targetMass = null;
            this.points = [];
            const angleStep = (Math.PI * 2) / this.numPoints;
            for (let i = 0; i < this.numPoints; i++) {
                this.points.push({ angle: i * angleStep, offset: 0 });
            }
        }

        Blob.prototype.isOutOfBounds = function () {
            return (this.direction === 1 && this.centerY - this.radius > height)
                || (this.direction === -1 && this.centerY + this.radius < 0);
        };

        Blob.prototype.update = function (deltaTime, globalTime) {
            if (this.state === 'growing') {
                this.mass += this.massGrowthRate * deltaTime;
                if (this.targetMass !== null) {
                    if (this.mass >= this.targetMass) {
                        this.mass = this.targetMass;
                        this.state = 'moving';
                        this.vy = this.direction * this.speed;
                        this.vx = 0;
                        this.movingStartTime = globalTime;
                    }
                } else if (this.mass >= this.maxMass) {
                    this.mass = this.maxMass;
                    this.state = 'moving';
                    this.vy = this.direction * this.speed;
                    this.vx = 0;
                    this.movingStartTime = globalTime;
                }
                this.radius = this.initialRadius + (this.mass - this.initialRadius * 0.1) * 0.5;
            }
            if (this.state === 'moving') {
                if (this.movingStartTime !== null) {
                    const movingDuration = globalTime - this.movingStartTime;
                    this.noiseStrength = Math.max(0, this.initialNoiseStrength - movingDuration * NOISE_REDUCTION_RATE);
                }
                this.centerX += this.vx * deltaTime;
                this.centerY += this.vy * deltaTime;
            }
            this.points.forEach((point) => {
                const x = this.centerX + Math.cos(point.angle) * this.radius;
                const y = this.centerY + Math.sin(point.angle) * this.radius;
                point.offset = noise2D(x * this.noiseScale, y * this.noiseScale + globalTime * this.morphSpeed) * this.noiseStrength;
            });
        };

        Blob.prototype.draw = function () {
            ctx.save();
            ctx.translate(this.centerX, this.centerY);
            ctx.beginPath();
            const points = this.points;
            const len = points.length;
            for (let i = 0; i < len; i++) {
                const current = points[i];
                const next = points[(i + 1) % len];
                const currentRadius = this.radius + (current.offset || 0);
                const currentX = currentRadius * Math.cos(current.angle);
                const currentY = currentRadius * Math.sin(current.angle);
                const nextRadius = this.radius + (next.offset || 0);
                const nextX = nextRadius * Math.cos(next.angle);
                const nextY = nextRadius * Math.sin(next.angle);
                if (i === 0) ctx.moveTo(currentX, currentY);
                ctx.quadraticCurveTo(currentX, currentY, (currentX + nextX) / 2, (currentY + nextY) / 2);
            }
            ctx.closePath();
            ctx.fillStyle = this.color;
            ctx.globalAlpha = 1;
            ctx.fill();
            ctx.restore();
        };

        function createBlob(origin) {
            const maxMassVal = Math.random() < SMALL_BUBBLE_CHANCE
                ? random(SMALL_BUBBLE_MAX_MASS_MIN, SMALL_BUBBLE_MAX_MASS_MAX)
                : random(MIN_MAX_MASS, MAX_MASS);
            return new Blob({
                numPoints: NUM_POINTS,
                radius: random(INITIAL_RADIUS_MIN, INITIAL_RADIUS_MAX),
                origin,
                centerX: random(width * 0.2, width * 0.8),
                centerY: origin === 'top' ? random(-60, 0) : random(height, height + 60),
                color: particleColor,
                speed: random(MOVE_SPEED_MIN, MOVE_SPEED_MAX),
                morphSpeed: random(MORPH_SPEED_MIN, MORPH_SPEED_MAX),
                noiseScale: NOISE_SCALE,
                noiseStrength: NOISE_STRENGTH,
                massGrowthRate: GROWTH_RATE,
                maxMass: maxMassVal
            });
        }

        const blobs = [];
        for (let i = 0; i < MIN_BUBBLES; i++) {
            blobs.push(createBlob(i % 2 === 0 ? 'top' : 'bottom'));
        }

        let blobSpawnTimer = 0;
        let nextBlobSpawnTime = random(BLOB_SPAWN_INTERVAL_MIN, BLOB_SPAWN_INTERVAL_MAX);
        let noBlobsStartTime = null;
        let lastTime = performance.now();
        let time = 0;

        function animate(currentTime) {
            const deltaTime = (currentTime - lastTime) / 1000;
            lastTime = currentTime;
            time += deltaTime;
            ctx.clearRect(0, 0, width, height);

            blobs.forEach((blob) => {
                blob.update(deltaTime, time);
                blob.draw();
            });

            for (let i = 0; i < blobs.length; i++) {
                for (let j = i + 1; j < blobs.length; j++) {
                    const blobA = blobs[i];
                    const blobB = blobs[j];
                    const dx = blobA.centerX - blobB.centerX;
                    const dy = blobA.centerY - blobB.centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const minDistance = (blobA.radius + blobB.radius) * 1.2;
                    if (distance < minDistance && distance > 0) {
                        const overlap = minDistance - distance;
                        const angle = Math.atan2(dy, dx);
                        const force = (overlap / minDistance) * 0.05;
                        blobA.centerX += Math.cos(angle) * force;
                        blobA.centerY += Math.sin(angle) * force;
                        blobB.centerX -= Math.cos(angle) * force;
                        blobB.centerY -= Math.sin(angle) * force;
                    }
                }
            }

            for (let i = 0; i < blobs.length; i++) {
                for (let j = i + 1; j < blobs.length; j++) {
                    const blobA = blobs[i];
                    const blobB = blobs[j];
                    if (blobA.state !== 'growing' || blobB.state !== 'growing') continue;
                    const dx = blobA.centerX - blobB.centerX;
                    const dy = blobA.centerY - blobB.centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance >= blobA.radius + blobB.radius) continue;
                    const newMass = blobA.mass + blobB.mass;
                    const mergedBlob = new Blob({
                        numPoints: NUM_POINTS,
                        radius: (blobA.radius + blobB.radius) / 2,
                        origin: blobA.origin,
                        centerX: (blobA.centerX * blobA.mass + blobB.centerX * blobB.mass) / newMass,
                        centerY: (blobA.centerY * blobA.mass + blobB.centerY * blobB.mass) / newMass,
                        color: particleColor,
                        speed: (blobA.speed + blobB.speed) / 2,
                        morphSpeed: (blobA.morphSpeed + blobB.morphSpeed) / 2,
                        noiseScale: NOISE_SCALE,
                        noiseStrength: NOISE_STRENGTH,
                        massGrowthRate: GROWTH_RATE,
                        maxMass: newMass
                    });
                    mergedBlob.mass = (blobA.mass + blobB.mass) / 2;
                    mergedBlob.targetMass = newMass;
                    mergedBlob.state = 'growing';
                    blobs.splice(j, 1);
                    blobs.splice(i, 1, mergedBlob);
                    j = i;
                }
            }

            for (let i = blobs.length - 1; i >= 0; i--) {
                if (!blobs[i].isOutOfBounds()) continue;
                const origin = blobs[i].origin === 'top' ? 'bottom' : 'top';
                blobs.splice(i, 1);
                if (blobs.length < MAX_BUBBLES) blobs.push(createBlob(origin));
            }

            while (blobs.length < MIN_BUBBLES && blobs.length < MAX_BUBBLES) {
                blobs.push(createBlob(blobs.length % 2 === 0 ? 'top' : 'bottom'));
            }

            blobSpawnTimer += deltaTime;
            if (blobSpawnTimer >= nextBlobSpawnTime) {
                if (blobs.length < MAX_BUBBLES) {
                    blobs.push(createBlob(Math.random() < 0.5 ? 'top' : 'bottom'));
                }
                blobSpawnTimer = 0;
                nextBlobSpawnTime = random(BLOB_SPAWN_INTERVAL_MIN, BLOB_SPAWN_INTERVAL_MAX);
            }

            if (blobs.length === 0) {
                if (!noBlobsStartTime) noBlobsStartTime = time;
                else if (time - noBlobsStartTime >= FAILSAFE_TIMEOUT) {
                    blobs.push(createBlob('top'));
                    noBlobsStartTime = null;
                }
            } else {
                noBlobsStartTime = null;
            }

            bgAnimFrame = requestAnimationFrame(animate);
        }

        bgAnimFrame = requestAnimationFrame(animate);
    }

    function setSynthwaveVisible(on) {
        const layer = $('qg-synthwave');
        if (!layer) return;
        layer.hidden = !on;
        layer.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (on) initSynthwaveLayer(layer);
    }

    function initSynthwaveLayer(layer) {
        if (layer.dataset.ready === 'css-floor-v2') return;
        layer.dataset.ready = 'css-floor-v2';

        const starsHost = layer.querySelector('.qg-synth-stars');
        if (starsHost && !starsHost.childElementCount) {
            for (let i = 0; i < 90; i++) {
                const star = document.createElement('div');
                star.className = 'qg-synth-star';
                star.style.left = `${100 * Math.random()}%`;
                star.style.top = `${55 * Math.random()}%`;
                starsHost.appendChild(star);
            }
        }

        const sun = layer.querySelector('.qg-synth-sun');
        if (sun && !sun.childElementCount) {
            for (let i = 0; i < 16; i++) {
                const band = document.createElement('div');
                band.className = 'qg-synth-sun-band';
                band.style.animationDelay = `${-0.5 * i}s`;
                sun.appendChild(band);
            }
        }

        const grid = layer.querySelector('.qg-synth-grid');
        if (grid) grid.innerHTML = '';
    }

    function startBgAnimation(theme, isDark) {
        const canvas = $('qg-bg-canvas');
        if (!canvas) return;

        // Cancel existing
        if (bgAnimFrame) cancelAnimationFrame(bgAnimFrame);
        bgParticles = [];
        canvas.classList.remove('qg-bg-lava');
        setSynthwaveVisible(false);

        const themeData = QUIZ_THEMES[theme] || QUIZ_THEMES['default'];
        const particleColor = (isDark && themeData.dark?.['--qg-particle']) || themeData['--qg-particle'];

        if (theme === 'neon') {
            setSynthwaveVisible(true);
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        if (theme === 'kawaii-pastel' || theme === 'peach-cream') {
            startLavaLampBg(canvas, particleColor);
            return;
        }

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const ctx = canvas.getContext('2d');

        const configs = {
            default: { count: 9, speed: 0.16, size: [60, 140], shape: 'cube' },
            'gold-black': { count: 8, speed: 0.14, size: [55, 130], shape: 'cube' },
            'retro-arcade': { count: 9, speed: 0.18, size: [70, 120], shape: 'icon', icon: 'arcade', rise: true },
            'mint-pop': { count: 9, speed: 0.14, size: [70, 130], shape: 'icon', icon: 'mint', rise: true },
            'pink-pop': { count: 9, speed: 0.16, size: [58, 120], shape: 'icon', icon: 'heart', rise: true },
            'frost-white': { count: 10, speed: 0.17, size: [52, 110], shape: 'icon', icon: 'frost', rise: false },
            lego: { count: 9, speed: 0.16, size: [70, 130], shape: 'icon', icon: 'lego', rise: true },
            neon: { count: 12, speed: 0.28, size: [36, 88], shape: 'line' },
            citrus: { count: 9, speed: 0.15, size: [64, 120], shape: 'icon', icon: 'citrus', rise: true }
        };
        const cfg = configs[theme] || configs['default'];
        const iconImg = cfg.shape === 'icon'
            ? makeParticleIconImage(BG_PARTICLE_ICONS[cfg.icon], particleColor)
            : null;
        const rises = cfg.rise === true || cfg.shape === 'cube';

        for (let i = 0; i < cfg.count; i++) {
            const radius = cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0]);
            bgParticles.push({
                x: Math.random() * canvas.width,
                y: rises
                    ? canvas.height + radius + 20 - Math.random() * (canvas.height + radius * 2 + 40)
                    : Math.random() * canvas.height,
                r: radius,
                vx: (Math.random() - 0.5) * cfg.speed,
                vy: rises
                    ? -(Math.random() * cfg.speed + cfg.speed * 0.25)
                    : (Math.random() - 0.5) * cfg.speed,
                opacity: 0.3 + Math.random() * 0.5,
                phase: Math.random() * Math.PI * 2,
                shape: cfg.shape,
                angle: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.02
            });
        }

        function drawCubeParticle(p) {
            const size = p.r * 2;
            const radius = size * 0.17;
            const half = p.r;

            if (typeof ctx.roundRect === 'function') {
                ctx.beginPath();
                ctx.roundRect(-half, -half, size, size, radius);
                ctx.fill();
                return;
            }

            const x = -half;
            const y = -half;
            const w = size;
            const h = size;
            const r = Math.min(radius, w / 2, h / 2);
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
            ctx.fill();
        }

        function drawFrame() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            bgParticles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.phase += 0.01;

                if (p.x < -p.r - 20) p.x = canvas.width + p.r + 20;
                if (p.x > canvas.width + p.r + 20) p.x = -p.r - 20;
                if (rises) {
                    if (p.y < -p.r - 20) p.y = canvas.height + p.r + 20;
                } else {
                    if (p.y > canvas.height + p.r + 20) p.y = -p.r - 20;
                    if (p.y < -p.r - 20) p.y = canvas.height + p.r + 20;
                }

                const breathe = Math.sin(p.phase) * 0.15;
                const alpha = Math.min(1, p.opacity + breathe);

                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = particleColor;
                ctx.strokeStyle = particleColor;

                if (p.shape === 'icon') {
                    p.angle += p.rotationSpeed;
                    if (iconImg && iconImg.complete) {
                        ctx.translate(p.x, p.y);
                        ctx.rotate(p.angle);
                        ctx.drawImage(iconImg, -p.r, -p.r, p.r * 2, p.r * 2);
                    }
                } else if (p.shape === 'cube') {
                    p.angle += p.rotationSpeed;
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.angle);
                    drawCubeParticle(p);
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
        if (!canvas) return;
        canvas.classList.remove('qg-bg-lava');
        setSynthwaveVisible(false);
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }

    /**
     * The host screen is projected for the whole class, so it always renders the
     * default palette no matter what this device has stored. Player theme choices
     * stay local — nothing here is written to the shared session.
     */
    function enforceHostTheme() {
        const app = $('quiz-app');
        applyQuizTheme('default', app ? app.classList.contains('qg-dark') : false, { persist: false });
        updateFloatingThemeBtn(document.querySelector('.qg-screen.active')?.id);
    }

    const THEME_PICKER_SCREENS = new Set(['screen-role', 'screen-join', 'screen-waiting']);

    function isThemePanelOpen() {
        return $('overlay-theme-modal')?.classList.contains('open');
    }

    function openThemePanel() {
        const panel = $('overlay-theme-modal');
        const backdrop = $('theme-dropdown-backdrop');
        if (!panel || !backdrop) return;
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        backdrop.classList.add('open');
        backdrop.setAttribute('aria-hidden', 'false');
    }

    function closeThemePanel() {
        const panel = $('overlay-theme-modal');
        const backdrop = $('theme-dropdown-backdrop');
        if (!panel || !backdrop) return;
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
        backdrop.classList.remove('open');
        backdrop.setAttribute('aria-hidden', 'true');
        panel.style.display = '';
    }

    function updateFloatingThemeBtn(screenId) {
        const anchor = $('floating-theme-anchor');
        const btn = $('btn-floating-theme');
        const show = THEME_PICKER_SCREENS.has(screenId) && role !== 'host';
        if (anchor) anchor.hidden = !show;
        if (btn) btn.hidden = !show;
        if (!show) closeThemePanel();
    }

    function renderThemePicker() {
        const container = $('theme-picker-list');
        if (!container) return;

        container.innerHTML = THEME_PICKER_ORDER.map((themeId) => {
            const theme = QUIZ_THEMES[themeId];
            if (!theme) return '';

            const segments = (theme.palette || []).map((color) =>
                `<span class="qg-theme-bar-seg" style="--c:${color}"></span>`
            ).join('');

            return `<button type="button" class="qg-theme-bar qg-theme-swatch" data-theme="${themeId}" title="${theme.label || themeId}">
                <span class="qg-theme-bar-name">${theme.label || themeId}</span>
                <span class="qg-theme-bar-colors" aria-hidden="true">${segments}</span>
            </button>`;
        }).join('');
    }

    function hexToRgb(hex) {
        const normalized = hex.replace('#', '');
        const expanded = normalized.length === 3
            ? normalized.split('').map((ch) => ch + ch).join('')
            : normalized;
        const value = parseInt(expanded, 16);
        return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
    }

    function mixHex(hex, targetHex, amount) {
        const a = hexToRgb(hex);
        const b = hexToRgb(targetHex);
        const t = Math.max(0, Math.min(1, amount));
        const channels = ['r', 'g', 'b'].map((key) =>
            Math.round(a[key] + (b[key] - a[key]) * t)
        );
        return `#${channels.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    }

    function accentLuminance(hex) {
        const { r, g, b } = hexToRgb(hex);
        const [rs, gs, bs] = [r, g, b].map((v) => {
            const channel = v / 255;
            return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    function resolvePanelButtonAccents(accent) {
        if (!accent || accent[0] !== '#') {
            return { btn: accent, btnDark: accent };
        }
        if (accentLuminance(accent) > 0.5) {
            return {
                btn: mixHex(accent, '#000000', 0.45),
                btnDark: mixHex(accent, '#000000', 0.65)
            };
        }
        return {
            btn: accent,
            btnDark: mixHex(accent, '#000000', 0.25)
        };
    }

    function applyQuizTheme(requestedTheme, isDark, options = {}) {
        const app = $('quiz-app');
        if (!app) return;

        const theme = role === 'host' ? 'default' : requestedTheme;
        const persist = options.persist !== false && role !== 'host';
        const themeData = QUIZ_THEMES[theme] || QUIZ_THEMES['default'];
        if (themeData.disableDark) isDark = false;
        const vars = isDark
            ? Object.assign({}, themeData, themeData.dark || {})
            : themeData;

        // Apply CSS variables to the app element
        ['--qg-bg-color', '--qg-bg-from', '--qg-bg-to', '--qg-text', '--qg-theme-btn-icon', '--qg-accent', '--qg-panel-accent'].forEach(v => {
            if (vars[v]) app.style.setProperty(v, vars[v]);
        });
        if (!vars['--qg-bg-color'] && vars['--qg-bg-from']) {
            app.style.setProperty('--qg-bg-color', vars['--qg-bg-from']);
        }
        if (!vars['--qg-text']) {
            app.style.setProperty('--qg-text', '#ffffff');
        }

        const panelAccent = vars['--qg-panel-accent'] || vars['--qg-accent'];
        if (panelAccent) {
            const buttonAccents = resolvePanelButtonAccents(panelAccent);
            app.style.setProperty('--qg-panel-accent-btn', buttonAccents.btn);
            app.style.setProperty('--qg-panel-accent-btn-dark', buttonAccents.btnDark);

            if (!vars['--qg-theme-btn-icon']) {
                const iconOnBtn = accentLuminance(buttonAccents.btn) > 0.45 ? '#1a1a1a' : '#ffffff';
                app.style.setProperty('--qg-theme-btn-icon', iconOnBtn);
            }

            const needsLightTitle =
                panelAccent[0] === '#' && accentLuminance(panelAccent) > 0.5;
            app.style.setProperty(
                '--qg-panel-accent-title',
                needsLightTitle ? buttonAccents.btn : panelAccent
            );
        }

        const bonusDark = themeData.dark?.['--qg-bg-from'] || themeData['--qg-bg-from'];
        const bonusMid = themeData.dark?.['--qg-bg-to'] || themeData['--qg-bg-to'];
        app.style.setProperty('--qg-bonus-dark', bonusDark);
        app.style.setProperty('--qg-bonus-mid', bonusMid);

        applyRoleCardTheme(themeData.roleCards, isDark);

        // Remove old theme & dark classes
        Object.keys(QUIZ_THEMES).forEach(t => app.classList.remove('qg-theme-' + t));
        app.classList.remove('qg-dark', 'qg-theme-light');

        // Apply new classes
        app.classList.add('qg-theme-' + theme);
        if (isDark) app.classList.add('qg-dark');
        app.classList.toggle('qg-theme-light', !isDark && themeData.light === true);
        app.dataset.theme = theme;

        // Update active swatch
        updateThemeSwatches(theme);

        // Update dark toggle
        updateDarkToggle(isDark, theme);

        // Persist (player devices only)
        if (persist) {
            safeSetLocalStorage('qg-theme', theme);
            safeSetLocalStorage('qg-dark', isDark ? '1' : '0');
        }

        // Keep shortcut keyboards on the newly picked palette
        [$('sv-keyboard')].forEach((keyboard) => {
            if (!keyboard) return;
            Object.values(QUIZ_THEMES).forEach(t => {
                if (t.keyboard) keyboard.classList.remove(t.keyboard);
            });
            keyboard.classList.add(themeData.keyboard || 'keyboard--palette-classic');
        });

        // Restart background animation
        startBgAnimation(theme, isDark);
    }

    function applyRoleCardTheme(roleCards, isDark) {
        const hostCard = document.querySelector('.qg-role-host');
        const joinCard = document.querySelector('.qg-role-join');
        if (!roleCards) return;

        const palette = isDark && roleCards.dark ? roleCards.dark : roleCards;

        [['host', hostCard], ['join', joinCard]].forEach(([key, el]) => {
            const colors = palette[key];
            if (!el || !colors) return;
            el.style.setProperty('--qg-role-face', colors.face);
            el.style.setProperty('--qg-role-depth', colors.depth);
            el.style.setProperty('--qg-role-text', colors.text);
            el.style.setProperty('--qg-role-subtext', colors.subtext || colors.text);
            el.style.setProperty('--qg-role-icon', colors.icon || colors.text);
        });
    }

    function loadQuizTheme() {
        const validThemes = new Set(Object.keys(QUIZ_THEMES));
        let theme = safeGetLocalStorage('qg-theme', 'default');
        if (!validThemes.has(theme)) theme = 'default';

        const globalDark = safeGetLocalStorage('dark-mode') === 'enabled';

        // If qg-dark isn't set yet, inherit from global dark mode
        const isDarkStr = safeGetLocalStorage('qg-dark');
        const isDark = isDarkStr !== null ? (isDarkStr === '1') : globalDark;

        applyQuizTheme(theme, isDark, { persist: false });

        // Sync global body dark mode on load
        if (isDark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    function updateThemeSwatches(activeTheme) {
        document.querySelectorAll('.qg-theme-bar, .qg-theme-swatch').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === activeTheme);
        });
    }

    function updateDarkToggle(isDark, themeId) {
        const checkbox = $('qg-dark-checkbox');
        const wrap = document.querySelector('.qg-dark-switch-wrap');
        const divider = document.querySelector('.qg-theme-modal-divider');
        const disableDark = !!(QUIZ_THEMES[themeId] || {}).disableDark;
        if (wrap) wrap.hidden = disableDark;
        if (divider) divider.hidden = disableDark;
        if (checkbox) {
            checkbox.disabled = disableDark;
            checkbox.checked = disableDark ? false : isDark;
        }
    }

    // ===== WAITING ROOM MINI-GAMES (local only — no Firebase) =====
    const WAITING_MINI_GAMES = [
        {
            id: 'breakout',
            label: 'Breakout',
            icon: 'fa-solid fa-table-cells',
            src: 'games/breakout/index.html?embed=1'
        },
        {
            id: 'tetris',
            label: 'Tetris',
            icon: 'fa-solid fa-cubes',
            src: 'games/tetris/index.html?embed=1'
        },
        {
            id: 'space-invaders',
            label: 'Space Invaders',
            icon: 'fa-solid fa-rocket',
            src: 'games/space-invaders/index.html?embed=1'
        }
    ];

    let activeWaitingMiniGame = null;

    function isWaitingMiniGameModalOpen() {
        return $('waiting-minigame-overlay')?.classList.contains('open') ?? false;
    }

    function openWaitingMiniGameModal() {
        const overlay = $('waiting-minigame-overlay');
        const modal = $('waiting-minigame');
        const toggle = $('waiting-minigame-toggle');
        if (!overlay || !modal || waitingMiniGameDisabled) return;

        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
        modal.setAttribute('aria-hidden', 'false');
        toggle?.setAttribute('aria-expanded', 'true');
    }

    function closeWaitingMiniGameModal({ resetPicker = true } = {}) {
        const overlay = $('waiting-minigame-overlay');
        const modal = $('waiting-minigame');
        const toggle = $('waiting-minigame-toggle');

        overlay?.classList.remove('open');
        overlay?.setAttribute('aria-hidden', 'true');
        modal?.setAttribute('aria-hidden', 'true');
        toggle?.setAttribute('aria-expanded', 'false');

        if (resetPicker) {
            showWaitingMiniGamePicker();
        }
    }

    function initWaitingMiniGames() {
        const toggle = $('waiting-minigame-toggle');
        const grid = $('waiting-minigame-grid');
        const backBtn = $('waiting-minigame-back');
        const overlay = $('waiting-minigame-overlay');
        const modal = $('waiting-minigame');

        if (!toggle || !grid) return;

        grid.innerHTML = WAITING_MINI_GAMES.map((game) => `
            <button type="button" class="qg-waiting-minigame-card" data-game-id="${game.id}">
                <i class="${game.icon}" aria-hidden="true"></i>
                <span>${game.label}</span>
            </button>
        `).join('');

        toggle.addEventListener('click', () => {
            if (waitingMiniGameDisabled) return;
            if (isWaitingMiniGameModalOpen()) closeWaitingMiniGameModal();
            else openWaitingMiniGameModal();
        });

        overlay?.addEventListener('click', (event) => {
            if (waitingMiniGameDisabled) return;
            if (event.target === overlay) closeWaitingMiniGameModal();
        });

        modal?.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        grid.addEventListener('click', (event) => {
            if (waitingMiniGameDisabled) return;
            const card = event.target.closest('[data-game-id]');
            if (!card) return;
            const game = WAITING_MINI_GAMES.find((entry) => entry.id === card.dataset.gameId);
            if (game) startWaitingMiniGame(game);
        });

        backBtn?.addEventListener('click', () => {
            if (waitingMiniGameDisabled) return;
            showWaitingMiniGamePicker();
        });
    }

    function resetWaitingMiniGamesForLobby() {
        waitingMiniGameDisabled = false;
        activeWaitingMiniGame = null;

        const root = $('waiting-minigame');
        const overlay = $('waiting-minigame-overlay');
        const toggle = $('waiting-minigame-toggle');
        const picker = $('waiting-minigame-picker');
        const play = $('waiting-minigame-play');

        closeWaitingMiniGameModal({ resetPicker: false });
        destroyWaitingArcadeFrame();

        if (overlay) {
            overlay.classList.remove('qg-waiting-minigame--disabled');
            overlay.style.pointerEvents = '';
        }
        if (root) {
            root.classList.remove('qg-waiting-minigame--disabled');
            root.removeAttribute('hidden');
            root.style.pointerEvents = '';
        }
        if (toggle) {
            toggle.disabled = false;
            toggle.setAttribute('aria-expanded', 'false');
        }
        if (picker) {
            picker.classList.remove('is-hidden');
            picker.hidden = false;
        }
        if (play) {
            play.classList.remove('is-active');
            play.hidden = true;
        }
    }

    function teardownWaitingMiniGames() {
        if (waitingMiniGameDisabled) return;
        waitingMiniGameDisabled = true;
        activeWaitingMiniGame = null;

        const root = $('waiting-minigame');
        const overlay = $('waiting-minigame-overlay');
        const toggle = $('waiting-minigame-toggle');
        const picker = $('waiting-minigame-picker');
        const play = $('waiting-minigame-play');

        closeWaitingMiniGameModal({ resetPicker: false });
        destroyWaitingArcadeFrame();

        if (toggle) {
            toggle.disabled = true;
            toggle.setAttribute('aria-expanded', 'false');
        }
        if (picker) {
            picker.classList.remove('is-hidden');
            picker.hidden = false;
        }
        if (play) {
            play.classList.remove('is-active');
            play.hidden = true;
        }

        if (overlay) {
            overlay.classList.add('qg-waiting-minigame--disabled');
            overlay.style.pointerEvents = 'none';
        }
        if (root) {
            root.classList.add('qg-waiting-minigame--disabled');
            root.setAttribute('hidden', '');
            root.style.pointerEvents = 'none';
        }
    }

    function destroyWaitingArcadeFrame() {
        const stage = $('waiting-minigame-stage');
        const frame = stage?.querySelector('.qg-waiting-arcade-frame');
        if (frame) {
            frame.src = 'about:blank';
            frame.remove();
        }
        if (stage) stage.innerHTML = '';
        $('waiting-minigame')?.classList.remove('qg-waiting-minigame--playing');
    }

    function showWaitingMiniGamePicker() {
        activeWaitingMiniGame = null;
        destroyWaitingArcadeFrame();
        const picker = $('waiting-minigame-picker');
        const play = $('waiting-minigame-play');
        if (picker) {
            picker.hidden = false;
            picker.classList.remove('is-hidden');
        }
        if (play) {
            play.hidden = true;
            play.classList.remove('is-active');
        }
    }

    function startWaitingMiniGame(game) {
        if (waitingMiniGameDisabled) return;
        activeWaitingMiniGame = game.id;
        const picker = $('waiting-minigame-picker');
        const play = $('waiting-minigame-play');
        const modal = $('waiting-minigame');
        if (picker) {
            picker.hidden = true;
            picker.classList.add('is-hidden');
        }
        if (play) {
            play.hidden = false;
            play.classList.add('is-active');
        }
        modal?.classList.add('qg-waiting-minigame--playing');
        const stage = $('waiting-minigame-stage');
        if (!stage || !game.src) return;
        const existing = stage.querySelector('.qg-waiting-arcade-frame');
        if (existing) {
            existing.src = 'about:blank';
            existing.remove();
        }
        stage.innerHTML = '';
        const frame = document.createElement('iframe');
        frame.className = 'qg-waiting-arcade-frame';
        frame.title = game.label;
        frame.tabIndex = 0;
        frame.src = game.src;
        frame.addEventListener('load', () => {
            try {
                frame.contentWindow?.focus();
            } catch (err) { /* ignore cross-origin focus errors */ }
            frame.focus();
        });
        stage.appendChild(frame);
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

    window.QuizGameDev = {
        setFreeze: setDevFreeze,
        isFrozen: isDevFreeze
    };

    return { init };
})();
