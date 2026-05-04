/**
 * Picture Reveal Game Engine
 * Handles session logic, drive sync, canvas themes, and grid animations.
 */

const PictureReveal = (() => {
    // ===== STATE =====
    let sessions = [];
    let currentSessionIndex = -1;
    let driveService = null;

    // Background Animation State
    let bgParticles = [];
    let bgAnimationId = null;

    // Default global settings
    let globalSettings = {
        mode: 'side-options', // 'side-options' or 'stop-button'
        time: 30, // seconds
        gridSize: 4, // 4x4
        sound: true,
        shufflePics: false,
        shuffleOpts: true,
        autoNext: false
    };

    // Sound engine state
    let audioCtx = null;
    let soundEnabled = true;

    // Canvas Themes (Ported from Live Quiz)
    const PR_THEMES = {
        'default': {
            '--pr-bg-from': '#3d348b', '--pr-bg-to': '#7678ed', '--pr-accent': '#f7b801', '--pr-particle': 'rgba(255,255,255,0.08)',
            dark: { '--pr-bg-from': '#1a1530', '--pr-bg-to': '#2c2a5a' }
        },
        'neon': {
            '--pr-bg-from': '#05050f', '--pr-bg-to': '#0d0d2b', '--pr-accent': '#00f5ff', '--pr-particle': 'rgba(0,245,255,0.12)',
            dark: { '--pr-bg-from': '#02020a', '--pr-bg-to': '#080820' }
        },
        'forest': {
            '--pr-bg-from': '#1a3d2b', '--pr-bg-to': '#2d6a4f', '--pr-accent': '#52b788', '--pr-particle': 'rgba(82,183,136,0.12)',
            dark: { '--pr-bg-from': '#0a1a11', '--pr-bg-to': '#152d1e' }
        },
        'winter': {
            '--pr-bg-from': '#4a9bbe', '--pr-bg-to': '#2a7fa8', '--pr-accent': '#caf0f8', '--pr-particle': 'rgba(255,255,255,0.18)',
            dark: { '--pr-bg-from': '#0a2233', '--pr-bg-to': '#1a3a55' }
        },
        'candy': {
            '--pr-bg-from': '#a8005a', '--pr-bg-to': '#6a00c0', '--pr-accent': '#ff9de2', '--pr-particle': 'rgba(255,157,226,0.14)',
            dark: { '--pr-bg-from': '#3d0030', '--pr-bg-to': '#28004a' }
        },
        'pastel': {
            '--pr-bg-from': '#b57bee', '--pr-bg-to': '#ee88b5', '--pr-accent': '#fff0f8', '--pr-particle': 'rgba(255,255,255,0.14)',
            dark: { '--pr-bg-from': '#3d1f5a', '--pr-bg-to': '#5a1f3a' }
        },
        'ocean': {
            '--pr-bg-from': '#023e8a', '--pr-bg-to': '#0077b6', '--pr-accent': '#90e0ef', '--pr-particle': 'rgba(144,224,239,0.14)',
            dark: { '--pr-bg-from': '#03045e', '--pr-bg-to': '#023e8a' }
        }
    };

    // DOM references
    const dom = {
        app: document.getElementById('pr-app'),
        bgCanvas: document.getElementById('pr-bg-canvas'),
        // Screens
        screenSettings: document.getElementById('pr-screen-settings'),
        screenGame: document.getElementById('pr-screen-game'),
        // Sidebar
        sidebar: document.querySelector('.pr-session-sidebar'),
        sidebarToggle: document.getElementById('pr-sidebar-toggle'),
        sessionList: document.getElementById('pr-session-list'),
        addSessionBtn: document.getElementById('pr-add-session'),
        capHint: document.getElementById('pr-session-cap-hint'),
        startGameBtn: document.getElementById('pr-start-game'),
        driveSyncBtn: document.getElementById('pr-drive-sync-btn'),
        themeBtn: document.getElementById('btn-change-theme'),
        darkToggle: document.getElementById('pr-dark-toggle'),
        darkIcon: document.getElementById('pr-dark-icon'),
        // Editor
        editorMain: document.getElementById('pr-session-editor'),
        emptyState: document.getElementById('pr-editor-empty'),
        collapsedState: document.getElementById('pr-editor-collapsed-state'),
        editorForm: document.getElementById('pr-editor-form'),
        sessionTitle: document.getElementById('pr-editor-session-title'),
        answerInput: document.getElementById('pr-answer-word'),

        // Global Settings Dropdowns
        globalMode: document.getElementById('pr-global-mode'),
        globalTime: document.getElementById('pr-global-time'),
        globalGrid: document.getElementById('pr-global-grid'),
        globalSound: document.getElementById('pr-global-sound'),
        globalShufflePics: document.getElementById('pr-global-shuffle-pics'),
        globalShuffleOpts: document.getElementById('pr-global-shuffle-opts'),
        globalAutoNext: document.getElementById('pr-global-auto-next'),

        // Image Upload
        uploadArea: document.getElementById('pr-image-upload-area'),
        imageInput: document.getElementById('pr-image-input'),
        uploadPlaceholder: document.getElementById('pr-upload-placeholder'),
        previewContainer: document.getElementById('pr-image-preview-container'),
        imagePreview: document.getElementById('pr-image-preview'),
        removeImageBtn: document.getElementById('pr-remove-image'),

        // Distractors
        distractorRadios: document.getElementsByName('distractor_mode'),
        manualDistractorsContainer: document.getElementById('pr-manual-distractors'),
        autoDistractorsHint: document.getElementById('pr-auto-distractors-hint'),
        distractorList: document.getElementById('pr-distractor-list'),
        addDistractorBtn: document.getElementById('pr-add-distractor'),

        // Theme Modal
        themeModal: document.getElementById('overlay-theme-modal'),
        closeThemeModal: document.getElementById('btn-close-theme-modal'),
        themeSwatches: document.querySelectorAll('.pr-theme-swatch')
    };

    function init() {
        console.log("Picture Reveal Initializing...");

        // Initialize Drive Sync
        if (typeof window.GoogleDriveService === 'function') {
            driveService = new window.GoogleDriveService({
                folderName: 'ESL Learning - Picture Reveal',
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
                            dom.globalMode.value = globalSettings.mode;
                            dom.globalTime.value = globalSettings.time.toString();
                            dom.globalGrid.value = globalSettings.gridSize.toString();
                            dom.globalSound.value = globalSettings.sound ? 'on' : 'off';
                            if (dom.globalShufflePics) dom.globalShufflePics.value = globalSettings.shufflePics ? 'on' : 'off';
                            if (dom.globalShuffleOpts) dom.globalShuffleOpts.value = globalSettings.shuffleOpts ? 'on' : 'off';
                            if (dom.globalAutoNext) dom.globalAutoNext.value = globalSettings.autoNext ? 'on' : 'off';
                        }
                        renderSessionList();
                        if (sessions.length > 0) {
                            selectSession(0);
                        } else {
                            currentSessionIndex = -1;
                            updateEditorView();
                        }
                        validateState();
                    }
                }
            });
        }

        loadAppTheme();
        bindEvents();

        if (sessions.length === 0) {
            addSession(); // Start with one empty picture
        }
        validateState();
    }

    // ===== UI & EVENT BINDING =====

    function bindEvents() {
        // Sidebar & UI
        dom.sidebarToggle.addEventListener('click', toggleSidebar);
        dom.addSessionBtn.addEventListener('click', addSession);

        // Settings Sync
        dom.globalMode.addEventListener('change', (e) => globalSettings.mode = e.target.value);
        dom.globalTime.addEventListener('change', (e) => globalSettings.time = parseInt(e.target.value));
        dom.globalGrid.addEventListener('change', (e) => globalSettings.gridSize = parseInt(e.target.value));
        dom.globalSound.addEventListener('change', (e) => {
            globalSettings.sound = e.target.value === 'on';
            soundEnabled = globalSettings.sound;
            if (soundEnabled) playSound('click');
        });
        dom.globalShufflePics.addEventListener('change', (e) => globalSettings.shufflePics = e.target.value === 'on');
        dom.globalShuffleOpts.addEventListener('change', (e) => globalSettings.shuffleOpts = e.target.value === 'on');
        dom.globalAutoNext.addEventListener('change', (e) => globalSettings.autoNext = e.target.value === 'on');

        // Editor Form
        dom.answerInput.addEventListener('input', (e) => {
            if (currentSessionIndex === -1) return;
            sessions[currentSessionIndex].answer = e.target.value;
            updateSessionListItem(currentSessionIndex);
            validateState();
        });

        // Image Handling
        dom.uploadArea.addEventListener('click', (e) => {
            if (e.target !== dom.removeImageBtn && !dom.removeImageBtn.contains(e.target)) {
                dom.imageInput.click();
            }
        });
        dom.imageInput.addEventListener('change', handleImageUpload);
        dom.removeImageBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeImage();
        });

        // Distractors
        dom.distractorRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (currentSessionIndex === -1) return;
                sessions[currentSessionIndex].distractorMode = e.target.value;
                updateDistractorUI();
                validateState();
            });
        });
        dom.addDistractorBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentSessionIndex === -1) return;
            if (sessions[currentSessionIndex].distractors.length >= 5) return;
            sessions[currentSessionIndex].distractors.push('');
            renderDistractorList();
            validateState();
        });

        // Theme Modal & Dark Mode
        dom.themeBtn.addEventListener('click', () => dom.themeModal.style.display = 'flex');
        dom.closeThemeModal.addEventListener('click', () => dom.themeModal.style.display = 'none');
        dom.themeSwatches.forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                const isDark = document.body.classList.contains('dark-mode');
                applyCanvasTheme(theme, isDark);
            });
        });
        dom.darkToggle.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark-mode');
            dom.darkIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            localStorage.setItem('pr-dark-mode', isDark ? 'enabled' : 'disabled');
            applyCanvasTheme(dom.app.dataset.theme || 'default', isDark);
        });

        // Drive & Game Start
        if (dom.driveSyncBtn) {
            dom.driveSyncBtn.addEventListener('click', () => {
                if (driveService) driveService.openModal();
            });
        }
        dom.startGameBtn.addEventListener('click', startGame);

        window.addEventListener('resize', handleCanvasResize);
    }

    function toggleSidebar() {
        dom.sidebar.classList.toggle('collapsed');
        if (dom.sidebar.classList.contains('collapsed')) {
            dom.editorForm.style.display = 'none';
            dom.emptyState.style.display = 'none';
            dom.collapsedState.style.display = 'flex';
        } else {
            dom.collapsedState.style.display = 'none';
            updateEditorView();
        }
    }

    // ===== DATA MANAGEMENT =====

    function addSession() {
        if (sessions.length >= 10) return;
        const newSession = {
            id: 'pr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            answer: '',
            imageData: null,
            distractorMode: 'auto',
            distractors: ['']
        };
        sessions.push(newSession);
        renderSessionList();
        selectSession(sessions.length - 1);
        validateState();
    }

    function deleteSession(index) {
        sessions.splice(index, 1);
        if (sessions.length === 0) {
            currentSessionIndex = -1;
            renderSessionList();
            updateEditorView();
        } else {
            if (currentSessionIndex === index) {
                selectSession(Math.max(0, index - 1));
            } else if (currentSessionIndex > index) {
                currentSessionIndex--;
                renderSessionList();
                updateEditorView();
            } else {
                renderSessionList();
            }
        }
        validateState();
    }

    function selectSession(index) {
        if (dom.sidebar.classList.contains('collapsed')) {
            toggleSidebar(); // Auto-expand if clicking a session
        }
        currentSessionIndex = index;
        document.querySelectorAll('.pr-session-item').forEach((el, i) => {
            el.classList.toggle('active', i === index);
        });
        updateEditorView();
    }

    function renderSessionList() {
        dom.sessionList.innerHTML = '';
        sessions.forEach((sess, i) => {
            const li = document.createElement('li');
            li.className = 'pr-session-item' + (i === currentSessionIndex ? ' active' : '');
            li.onclick = (e) => {
                if (!e.target.closest('.pr-session-delete')) {
                    selectSession(i);
                }
            };

            const info = document.createElement('div');
            info.className = 'pr-session-item-info';

            const num = document.createElement('span');
            num.className = 'pr-session-number';
            num.textContent = 'Picture ' + (i + 1);

            const preview = document.createElement('span');
            preview.className = 'pr-session-preview';
            preview.textContent = sess.answer.trim() || 'Untitled';

            info.appendChild(num);
            info.appendChild(preview);

            li.appendChild(info);

            const delBtn = document.createElement('button');
            delBtn.className = 'pr-session-delete';
            delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm('Delete this picture?')) {
                    deleteSession(i);
                }
            };
            li.appendChild(delBtn);

            dom.sessionList.appendChild(li);
        });

        // Cap check
        const atCap = sessions.length >= 10;
        dom.addSessionBtn.disabled = atCap;
        dom.capHint.style.display = atCap ? 'block' : 'none';
    }

    function updateSessionListItem(index) {
        if (index < 0 || index >= sessions.length) return;
        const item = dom.sessionList.children[index];
        if (item) {
            const preview = item.querySelector('.pr-session-preview');
            preview.textContent = sessions[index].answer.trim() || 'Untitled';
        }
    }

    // ===== EDITOR VIEW =====

    function updateEditorView() {
        if (currentSessionIndex === -1) {
            dom.editorForm.style.display = 'none';
            dom.emptyState.style.display = 'flex';
            dom.collapsedState.style.display = 'none';
            return;
        }

        const session = sessions[currentSessionIndex];
        dom.emptyState.style.display = 'none';
        dom.collapsedState.style.display = 'none';
        dom.editorForm.style.display = 'block';

        dom.sessionTitle.textContent = 'Picture ' + (currentSessionIndex + 1);
        dom.answerInput.value = session.answer;

        // Image
        if (session.imageData) {
            dom.imagePreview.src = session.imageData;
            dom.previewContainer.style.display = 'flex';
            dom.uploadPlaceholder.style.display = 'none';
            dom.uploadArea.style.borderColor = 'transparent';
        } else {
            dom.imagePreview.src = '';
            dom.previewContainer.style.display = 'none';
            dom.uploadPlaceholder.style.display = 'flex';
            dom.uploadArea.style.borderColor = '';
        }

        // Set radio button mode
        dom.distractorRadios.forEach(r => {
            r.checked = (r.value === session.distractorMode);
        });
        updateDistractorUI();
    }

    function handleImageUpload(e) {
        if (currentSessionIndex === -1) return;
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            sessions[currentSessionIndex].imageData = event.target.result;
            updateEditorView();
            validateState();
        };
        reader.readAsDataURL(file);

        // Reset input so the same file can be uploaded again if deleted
        e.target.value = '';
    }

    function removeImage() {
        if (currentSessionIndex === -1) return;
        sessions[currentSessionIndex].imageData = null;
        updateEditorView();
        validateState();
    }

    function updateDistractorUI() {
        const session = sessions[currentSessionIndex];
        if (!session) return;

        if (session.distractorMode === 'manual') {
            dom.autoDistractorsHint.style.display = 'none';
            dom.manualDistractorsContainer.style.display = 'block';
            renderDistractorList();
        } else {
            dom.autoDistractorsHint.style.display = 'block';
            dom.manualDistractorsContainer.style.display = 'none';
        }
    }

    function renderDistractorList() {
        if (currentSessionIndex === -1) return;
        const session = sessions[currentSessionIndex];
        dom.distractorList.innerHTML = '';

        session.distractors.forEach((distractor, i) => {
            const li = document.createElement('li');
            li.className = 'pr-distractor-item';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'pr-text-input';
            input.placeholder = 'Wrong answer...';
            input.value = distractor;
            input.oninput = (e) => {
                session.distractors[i] = e.target.value;
                validateState();
            };

            const delBtn = document.createElement('button');
            delBtn.className = 'pr-distractor-remove';
            delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            delBtn.onclick = () => {
                session.distractors.splice(i, 1);
                renderDistractorList();
                validateState();
            };

            li.appendChild(input);
            li.appendChild(delBtn);
            dom.distractorList.appendChild(li);
        });

        dom.addDistractorBtn.style.display = session.distractors.length >= 5 ? 'none' : 'inline-flex';
    }

    function validateState() {
        let isValid = sessions.length > 0;

        // For auto mode, we need at least 2 distinct answers across all sessions to have distractors
        const uniqueAnswers = new Set(sessions.map(s => s.answer.trim().toLowerCase()).filter(a => a));
        const canUseAuto = uniqueAnswers.size >= 2;

        for (const session of sessions) {
            if (!session.imageData) isValid = false;
            if (!session.answer.trim()) isValid = false;

            if (session.distractorMode === 'manual') {
                const validDistractors = session.distractors.filter(d => d.trim().length > 0);
                if (validDistractors.length === 0) isValid = false;
            } else if (session.distractorMode === 'auto') {
                if (!canUseAuto) isValid = false;
            }
        }

        dom.startGameBtn.disabled = !isValid;
    }

    // ===== CANVAS THEME ANIMATIONS =====

    function loadAppTheme() {
        const globalDark = localStorage.getItem('dark-mode') === 'enabled';
        const isDarkStr = localStorage.getItem('pr-dark-mode');
        const isDark = isDarkStr !== null ? (isDarkStr === 'enabled') : globalDark;

        if (isDark) {
            document.body.classList.add('dark-mode');
            dom.darkIcon.className = 'fa-solid fa-sun';
        } else {
            dom.darkIcon.className = 'fa-solid fa-moon';
        }
        const savedTheme = localStorage.getItem('pr-theme') || 'default';
        applyCanvasTheme(savedTheme, isDark);
    }

    function applyCanvasTheme(theme, isDark) {
        dom.app.dataset.theme = theme;
        localStorage.setItem('pr-theme', theme);

        dom.themeSwatches.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });

        const themeData = PR_THEMES[theme] || PR_THEMES['default'];
        const vars = isDark ? Object.assign({}, themeData, themeData.dark || {}) : themeData;

        // Apply CSS variables to root
        ['--pr-bg-from', '--pr-bg-to', '--pr-accent'].forEach(v => {
            if (vars[v]) dom.app.style.setProperty(v, vars[v]);
        });

        startBgAnimation(theme, isDark);
    }

    function handleCanvasResize() {
        if (!bgAnimationId) return;
        const theme = dom.app.dataset.theme || 'default';
        const isDark = document.body.classList.contains('dark-mode');
        startBgAnimation(theme, isDark);
    }

    function startBgAnimation(theme, isDark) {
        const canvas = dom.bgCanvas;
        if (!canvas) return;

        if (bgAnimationId) cancelAnimationFrame(bgAnimationId);
        bgParticles = [];

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const ctx = canvas.getContext('2d');
        const themeData = PR_THEMES[theme] || PR_THEMES['default'];
        const particleColor = (isDark && themeData.dark?.['--pr-particle']) || themeData['--pr-particle'];

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
            // Draw gradient background
            const bgFrom = dom.app.style.getPropertyValue('--pr-bg-from') || '#3d348b';
            const bgTo = dom.app.style.getPropertyValue('--pr-bg-to') || '#7678ed';
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, bgFrom);
            gradient.addColorStop(1, bgTo);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw particles
            bgParticles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.phase += 0.01;

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
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x + p.vx * 30, p.y + p.vy * 30);
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            });

            bgAnimationId = requestAnimationFrame(drawFrame);
        }
        drawFrame();
    }

    // ===== GAME LOOP FLOW =====

    let playState = {
        sessionIndex: 0,
        timerId: null,
        rafId: null,
        startTime: 0,
        blocks: [],
        scheduledTimes: [], // pre-calculated removal times
        blocksRemoved: 0,
        isPaused: false,
        score: 100,
        totalScore: 0,
        playQueue: [],
        queueIndex: 0
    };

    function startGame() {
        if (sessions.length === 0) return;
        playState.totalScore = 0;

        // Transition UI
        dom.screenSettings.style.display = 'none';
        dom.screenGame.style.display = 'flex';
        playSound('go');

        // Hide/Show controls based on mode
        document.getElementById('pr-mc-container').style.display = globalSettings.mode === 'side-options' ? 'block' : 'none';
        document.getElementById('pr-stop-container').style.display = globalSettings.mode === 'stop-button' ? 'block' : 'none';

        // Bind stop button and game actions
        document.getElementById('btn-end-game').onclick = endGame;
        document.getElementById('btn-stop-reveal').onclick = handleStopReveal;

        // Feedback actions
        document.getElementById('btn-try-again').onclick = () => {
            document.getElementById('pr-game-feedback').style.display = 'none';
            if (globalSettings.mode === 'side-options') {
                resumeTimer();
            } else {
                // If try again in stop mode, show options again
                document.getElementById('pr-mc-container').style.display = 'block';
            }
        };
        document.getElementById('btn-next-picture').onclick = () => {
            document.getElementById('pr-game-feedback').style.display = 'none';
            playState.queueIndex++;
            startSession(playState.playQueue[playState.queueIndex]);
        };
        document.getElementById('btn-finish-game').onclick = () => {
            document.getElementById('pr-game-feedback').style.display = 'none';
            endGame();
        };

        playState.playQueue = sessions.map((_, i) => i);
        if (globalSettings.shufflePics) {
            shuffleArray(playState.playQueue);
        }
        playState.queueIndex = 0;

        startSession(playState.playQueue[playState.queueIndex]);
    }

    function endGame() {
        stopTimer();
        dom.screenGame.style.display = 'none';
        dom.screenSettings.style.display = 'flex';
        document.getElementById('pr-game-feedback').style.display = 'none';
    }

    function startSession(index) {
        if (index >= sessions.length) return endGame();

        playState.sessionIndex = index;
        const session = sessions[index];

        // Update Header
        document.getElementById('pr-game-progress').textContent = `Picture ${index + 1} / ${sessions.length}`;

        // Setup Grid
        setupGrid(session);

        // Setup Options if Side-Options mode
        if (globalSettings.mode === 'side-options') {
            setupOptions(session, document.getElementById('pr-mc-options'));
            document.getElementById('pr-stop-options-grid').style.display = 'none';
        } else {
            // Stop button mode resets
            document.getElementById('btn-stop-reveal').style.display = 'block';
            document.getElementById('pr-mc-container').style.display = 'none';
            document.getElementById('pr-game-controls').style.display = 'flex';
            document.getElementById('pr-grid-container').style.display = 'inline-block'; // show image
            document.getElementById('pr-stop-options-grid').style.display = 'none';
        }

        playState.score = 100;
        document.getElementById('pr-score-value').textContent = playState.score;

        // Start Timer
        startTimer();
    }

    function setupGrid(session) {
        document.getElementById('pr-game-image').src = session.imageData;

        const overlay = document.getElementById('pr-grid-overlay');
        overlay.innerHTML = '';

        const size = globalSettings.gridSize; // e.g. 4
        overlay.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
        overlay.style.gridTemplateRows = `repeat(${size}, 1fr)`;

        const totalBlocks = size * size;
        playState.blocks = [];

        for (let i = 0; i < totalBlocks; i++) {
            const cell = document.createElement('div');
            cell.className = 'pr-grid-cell';
            overlay.appendChild(cell);
            playState.blocks.push(cell);
        }

        // Shuffle blocks for random removal
        shuffleArray(playState.blocks);

        // Calculate removal times (Accelerating curve)
        // t_i = T * (1 - (1 - i/N)^2)
        // Starts slow, speeds up at the end
        playState.scheduledTimes = [];
        const T = globalSettings.time * 1000;
        for (let i = 0; i < totalBlocks; i++) {
            // We want the last block to disappear exactly at T, or slightly before.
            // i goes from 0 to totalBlocks - 1.
            // Power 0.5 curve mapping logic to start slow and accelerate
            const fraction = i / (totalBlocks - 1);
            const timeMs = T * Math.pow(fraction, 0.5);
            playState.scheduledTimes.push(timeMs);
        }

        playState.blocksRemoved = 0;
    }

    function setupOptions(session, targetContainer = null) {
        const mcContainer = targetContainer || document.getElementById('pr-mc-options');
        mcContainer.innerHTML = '';

        let allOptions = [];
        if (session.distractorMode === 'manual') {
            allOptions = [session.answer, ...session.distractors.filter(d => d.trim().length > 0)];
        } else {
            // Auto: pick random answers from other sessions
            const otherAnswers = sessions
                .filter((s, i) => i !== playState.sessionIndex && s.answer.trim().length > 0)
                .map(s => s.answer.trim());

            // Get unique random distractors
            shuffleArray(otherAnswers);
            const uniqueDistractors = [...new Set(otherAnswers)].slice(0, 3);
            allOptions = [session.answer, ...uniqueDistractors];
        }

        if (globalSettings.shuffleOpts) {
            shuffleArray(allOptions);
        }

        if (targetContainer && targetContainer.id === 'pr-stop-options-grid') {
            if (allOptions.length <= 4) {
                targetContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
            } else {
                targetContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
            }
        }

        allOptions.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'pr-mc-btn';
            btn.textContent = opt;
            btn.onclick = () => handleGuess(opt, btn);
            mcContainer.appendChild(btn);
        });
    }

    function startTimer() {
        playState.startTime = Date.now();
        playState.isPaused = false;

        document.getElementById('pr-timer-bar').style.transform = 'scaleX(1)';
        document.getElementById('pr-timer-bar').style.backgroundColor = 'var(--coral-pink)';

        playState.rafId = requestAnimationFrame(updateTimer);
    }

    function pauseTimer() {
        playState.isPaused = true;
        if (playState.rafId) cancelAnimationFrame(playState.rafId);
    }

    function resumeTimer() {
        if (!playState.isPaused) return;
        playState.isPaused = false;

        // Re-sync startTime so it continues from current elapsed
        playState.startTime = Date.now() - playState.elapsedTime;
        playState.rafId = requestAnimationFrame(updateTimer);
    }

    function stopTimer() {
        if (playState.rafId) cancelAnimationFrame(playState.rafId);
        playState.isPaused = false;
    }

    function updateTimer() {
        if (playState.isPaused) return;

        const now = Date.now();
        const elapsed = now - playState.startTime;
        playState.elapsedTime = elapsed;
        const duration = globalSettings.time * 1000;

        let remaining = Math.max(0, duration - elapsed);

        // Update score
        playState.score = Math.max(0, Math.round(100 * (remaining / duration)));
        document.getElementById('pr-score-value').textContent = playState.score;

        // Update bar
        const fraction = remaining / duration;
        document.getElementById('pr-timer-bar').style.transform = `scaleX(${fraction})`;

        // Color shifts to red as time runs out
        if (fraction < 0.2) {
            document.getElementById('pr-timer-bar').style.backgroundColor = '#ff0000';
        }

        // Update text
        document.getElementById('pr-timer-text').textContent = Math.ceil(remaining / 1000);

        // Grid removal logic
        while (playState.blocksRemoved < playState.scheduledTimes.length && elapsed >= playState.scheduledTimes[playState.blocksRemoved]) {
            // Hide the block
            const block = playState.blocks[playState.blocksRemoved];
            if (block) block.classList.add('hidden');
            playState.blocksRemoved++;
        }

        if (remaining > 0) {
            playState.rafId = requestAnimationFrame(updateTimer);
        } else {
            // Time's up
            document.getElementById('pr-timer-bar').style.transform = `scaleX(0)`;
            document.getElementById('pr-timer-text').textContent = "0";
            handleTimeUp();
        }
    }

    function handleTimeUp() {
        if (globalSettings.mode === 'stop-button') {
            // If they didn't stop in time
            playSound('wrong');
            handleStopReveal(); // Force stop
            showFeedback(false, "Time's up!");
        } else {
            // Highlight correct answer since time is up
            playSound('wrong');
            showFeedback(false, "Time's up!");
        }
    }

    // ===== GAME INTERACTIONS =====

    function handleStopReveal() {
        pauseTimer();
        playSound('click');
        document.getElementById('btn-stop-reveal').style.display = 'none';

        // Hide image entirely
        document.getElementById('pr-grid-container').style.display = 'none';

        // Display 3x2 grid correctly right in the image area
        document.getElementById('pr-stop-options-grid').style.display = 'grid';
        document.getElementById('pr-game-controls').style.display = 'none'; // hide the right panel entirely

        // Show options
        const stopContainer = document.getElementById('pr-stop-options-grid');
        setupOptions(sessions[playState.sessionIndex], stopContainer);
    }

    function handleGuess(guessedWord, btnElement) {
        const session = sessions[playState.sessionIndex];
        const isCorrect = guessedWord.trim().toLowerCase() === session.answer.trim().toLowerCase();

        if (isCorrect) {
            playState.totalScore += playState.score;
            btnElement.classList.add('correct');
            stopTimer();
            playSound('correct');
            launchConfetti();

            // Reveal whole image
            playState.blocks.forEach(b => b.classList.add('hidden'));
            document.getElementById('pr-grid-container').style.display = 'inline-block'; // guarantee image is shown

            setTimeout(() => {
                showFeedback(true, "Correct!");
            }, 1000);
        } else {
            btnElement.classList.add('frozen');
            btnElement.disabled = true;
            playSound('wrong');

            if (globalSettings.mode === 'stop-button') {
                document.getElementById('pr-mc-container').style.display = 'none';
                document.getElementById('pr-stop-options-grid').style.display = 'none';
                showFeedback(false, "Oops! That's not it.");
            } else {
                pauseTimer();
                setTimeout(() => {
                    showFeedback(false, "Oops! That's not it.");
                }, 500);
            }
        }
    }

    function showFeedback(isWin, message) {
        const overlay = document.getElementById('pr-game-feedback');
        overlay.style.display = 'flex';

        const title = document.getElementById('pr-feedback-title');
        const icon = document.getElementById('pr-feedback-icon');
        const msg = document.getElementById('pr-feedback-message');

        const btnTryAgain = document.getElementById('btn-try-again');
        const btnNext = document.getElementById('btn-next-picture');
        const btnFinish = document.getElementById('btn-finish-game');

        title.textContent = message;

        if (isWin) {
            icon.innerHTML = '<i class="fa-solid fa-star" style="color:var(--lemon-yellow);"></i>';
            msg.textContent = `You guessed the picture: ${sessions[playState.sessionIndex].answer}. You earned ${playState.score} points! Total Score: ${playState.totalScore}`;

            btnTryAgain.style.display = 'none';
            if (playState.queueIndex < playState.playQueue.length - 1) {
                btnNext.style.display = 'inline-flex';
                btnFinish.style.display = 'none';

                if (globalSettings.autoNext) {
                    btnNext.style.display = 'none';
                    setTimeout(() => {
                        const feedback = document.getElementById('pr-game-feedback');
                        if (feedback.style.display !== 'none') {
                            document.getElementById('btn-next-picture').click();
                        }
                    }, 3000);
                }
            } else {
                btnNext.style.display = 'none';
                btnFinish.style.display = 'inline-flex';
            }
        } else {
            icon.innerHTML = '<i class="fa-solid fa-face-frown" style="color:var(--coral-pink);"></i>';
            msg.textContent = "";
            btnTryAgain.style.display = 'inline-flex';
            btnNext.style.display = 'none';
            btnFinish.style.display = 'none';
        }
    }

    // UTILS
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
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
                    osc.frequency.setValueAtTime(880, now);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    osc.start(now);
                    osc.stop(now + 0.1);
                    break;
            }
        } catch (e) {
            console.error("Audio error:", e);
        }
    }

    // ===== CONFETTI =====
    function launchConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;
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

            if (alive) {
                requestAnimationFrame(draw);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        draw();
    }

    // Public API
    return {
        init
    };
})();

document.addEventListener('DOMContentLoaded', PictureReveal.init);
