/**
 * Take Test Module
 * Student-facing test-taking interface with fullscreen anti-cheat, timing, and answer collection.
 */
const TakeTest = (function () {
    'use strict';

    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    // ===== STATE =====
    let testData = null;
    let testCode = '';
    let currentQ = 0;
    let answers = [];          // student's answers per question
    let startedAt = 0;
    let violations = [];
    let fullscreenEnabled = false;
    let timerInterval = null;
    let timeRemaining = 0;
    let lastGraded = null; // store graded results for review

    // Theme state
    let currentTheme = 'default';
    let isDarkMode = false;
    let bgAnimationsEnabled = localStorage.getItem('tt-anim-enabled') !== 'false';

    // Animation state
    let bgAnimFrame = null;
    let bgParticles = [];

    // ===== THEME DEFINITIONS =====
    const TT_THEMES = {
        'default': {
            '--tt-bg-from': '#3d348b', '--tt-bg-to': '#7678ed',
            dark: { '--tt-bg-from': '#1a1530', '--tt-bg-to': '#2c2a5a' }
        },
        'neon': {
            '--tt-bg-from': '#0a6e7a', '--tt-bg-to': '#00b4d8',
            dark: { '--tt-bg-from': '#05050f', '--tt-bg-to': '#0d0d2b' }
        },
        'forest': {
            '--tt-bg-from': '#1a3d2b', '--tt-bg-to': '#2d6a4f',
            dark: { '--tt-bg-from': '#0a1a11', '--tt-bg-to': '#152d1e' }
        },
        'winter': {
            '--tt-bg-from': '#4a9bbe', '--tt-bg-to': '#2a7fa8',
            dark: { '--tt-bg-from': '#0a2233', '--tt-bg-to': '#1a3a55' }
        },
        'candy': {
            '--tt-bg-from': '#a8005a', '--tt-bg-to': '#6a00c0',
            dark: { '--tt-bg-from': '#3d0030', '--tt-bg-to': '#28004a' }
        },
        'pastel': {
            '--tt-bg-from': '#b57bee', '--tt-bg-to': '#ee88b5',
            dark: { '--tt-bg-from': '#3d1f5a', '--tt-bg-to': '#5a1f3a' }
        },
        'ocean': {
            '--tt-bg-from': '#023e8a', '--tt-bg-to': '#0077b6',
            dark: { '--tt-bg-from': '#03045e', '--tt-bg-to': '#023e8a' }
        }
    };

    // ===== DOM CACHE =====
    let screens = {};

    // ===== BACKGROUND ANIMATIONS =====
    function startBgAnimation(theme, isDark) {
        if (!bgAnimationsEnabled) return stopBgAnimation();

        const canvas = document.getElementById('tt-bg-canvas');
        if (!canvas) return;

        // Cancel existing
        if (bgAnimFrame) cancelAnimationFrame(bgAnimFrame);
        bgParticles = [];

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const ctx = canvas.getContext('2d');
        const themeData = TT_THEMES[theme] || TT_THEMES['default'];

        // Define particle colors based on theme if not explicitly defined
        const defaultParticles = {
            'default': 'rgba(255,255,255,0.08)',
            'neon': 'rgba(0,245,255,0.16)',
            'forest': 'rgba(82,183,136,0.12)',
            'winter': 'rgba(255,255,255,0.18)',
            'candy': 'rgba(255,157,226,0.14)',
            'pastel': 'rgba(255,255,255,0.14)',
            'ocean': 'rgba(144,224,239,0.14)'
        };
        const particleColor = defaultParticles[theme] || 'rgba(255,255,255,0.1)';

        // Particle configs per theme
        const configs = {
            default: { count: 18, speed: 0.25, size: [3, 10], shape: 'circle' },
            neon: { count: 20, speed: 0.5, size: [6, 12], shape: 'line' },
            forest: { count: 14, speed: 0.2, size: [6, 12], shape: 'circle' },
            winter: { count: 25, speed: 0.4, size: [5, 15], shape: 'snow' },
            candy: { count: 16, speed: 0.3, size: [5, 15], shape: 'circle' },
            pastel: { count: 15, speed: 0.22, size: [6, 12], shape: 'circle' },
            ocean: { count: 18, speed: 0.3, size: [5, 15], shape: 'wave' }
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
        const canvas = document.getElementById('tt-bg-canvas');
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }

    // Resize handler for bg canvas
    window.addEventListener('resize', () => {
        const canvas = document.getElementById('tt-bg-canvas');
        if (canvas && bgAnimFrame) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            // No need to rebuild particles immediately, they will wrap
        }
    });

    // Listen to theme changes from the global scope
    window.addEventListener('test-theme-changed', (e) => {
        bgAnimationsEnabled = localStorage.getItem('tt-anim-enabled') !== 'false';
        startBgAnimation(e.detail.theme, e.detail.isDark);
    });

    // ===== INITIALIZATION =====
    function init() {
        cacheScreens();

        // Check URL for code
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code && code.length === 6) {
            testCode = code.toUpperCase();
            loadTest(testCode);
        } else {
            showScreen('code');
            setupCodeEntry();
        }

        // Global zoom listener
        document.addEventListener('click', (e) => {
            const zoomBtn = e.target.closest('.tt-zoom-btn');
            if (zoomBtn) {
                const imgSrc = zoomBtn.dataset.img;
                const lightbox = document.getElementById('image-lightbox');
                if (lightbox && imgSrc) {
                    document.getElementById('lightbox-img').src = imgSrc;
                    lightbox.style.display = 'flex';
                }
            }

            if (e.target.closest('.tt-btn-close-lightbox') || e.target.classList.contains('tt-lightbox')) {
                document.getElementById('image-lightbox').style.display = 'none';
            }
        });
    }

    function cacheScreens() {
        screens = {
            loading: document.getElementById('screen-loading'),
            error: document.getElementById('screen-error'),
            code: document.getElementById('screen-code'),
            student: document.getElementById('screen-student'),
            question: document.getElementById('screen-question'),
            results: document.getElementById('screen-results')
        };
    }

    function showScreen(name) {
        Object.values(screens).forEach(s => s.style.display = 'none');
        if (screens[name]) screens[name].style.display = 'flex';
    }

    // ===== CODE ENTRY =====
    function setupCodeEntry() {
        const inputs = document.querySelectorAll('.code-char');
        inputs.forEach((inp, i) => {
            inp.addEventListener('input', () => {
                inp.value = inp.value.toUpperCase();
                if (inp.value && i < inputs.length - 1) {
                    inputs[i + 1].focus();
                }
            });
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !inp.value && i > 0) {
                    inputs[i - 1].focus();
                }
                if (e.key === 'Enter') {
                    submitCode();
                }
            });
        });
        inputs[0].focus();

        document.getElementById('btn-submit-code').addEventListener('click', submitCode);
    }

    function submitCode() {
        const inputs = document.querySelectorAll('.code-char');
        let code = '';
        inputs.forEach(inp => code += inp.value);
        if (code.length !== 6) return;
        testCode = code.toUpperCase();
        showScreen('loading');
        loadTest(testCode);
    }

    // ===== LOAD TEST =====
    async function loadTest(code) {
        try {
            await FirebaseService.init();
            const data = await FirebaseService.getPublishedTest(code);

            if (!data) {
                showError('Test Not Found', 'This test code is invalid or doesn\'t exist.');
                return;
            }

            if (data.active === false) {
                showError('Test Closed', 'This test has been deactivated by the teacher.');
                return;
            }

            if (data.expiresAt && data.expiresAt < Date.now()) {
                showError('Test Expired', 'This test has expired and is no longer available.');
                return;
            }

            testData = data;
            fullscreenEnabled = testData.settings && testData.settings.enableFullscreen;
            answers = new Array(testData.questions.length).fill(null);

            // Apply default theme to avoid a blank white background initially
            applyTestTheme('default', false);

            showStudentScreen();
        } catch (err) {
            console.error('Load test error:', err);
            showError('Error', 'Could not load the test. Please try again.');
        }
    }

    function showError(title, message) {
        document.getElementById('error-title').textContent = title;
        document.getElementById('error-message').textContent = message;
        showScreen('error');
    }

    // ===== STUDENT ID SCREEN =====
    function showStudentScreen() {
        document.getElementById('test-title-display').textContent = testData.title || 'Test';
        document.getElementById('test-desc-display').textContent = testData.description || '';

        // Show/hide name/group fields
        const nameField = document.getElementById('name-field-container');
        const groupField = document.getElementById('group-field-container');
        const settings = testData.settings || {};

        nameField.style.display = settings.collectName !== false ? 'block' : 'none';
        groupField.style.display = settings.collectGroup !== false ? 'block' : 'none';

        // Populate groups
        const groupSelect = document.getElementById('student-group');
        groupSelect.innerHTML = '<option value="">Select your group...</option>';
        (settings.groupOptions || []).forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            groupSelect.appendChild(opt);
        });

        // Test info
        document.getElementById('info-questions').innerHTML = `<i class="fa-solid fa-list"></i> ${testData.questions.length} questions`;
        const timeLimit = settings.timeLimit || 0;
        document.getElementById('info-time').innerHTML = timeLimit > 0
            ? `<i class="fa-solid fa-clock"></i> ${timeLimit} min`
            : `<i class="fa-solid fa-clock"></i> No time limit`;

        // Start button
        document.getElementById('btn-start-test').addEventListener('click', startTest);

        // Show theme FAB if allowed
        if (testData.settings && testData.settings.allowThemes) {
            document.getElementById('btn-theme-fab').style.display = '';
        }

        showScreen('student');
    }

    // ===== START TEST =====
    function startTest() {
        const settings = testData.settings || {};
        const name = document.getElementById('student-name').value.trim();
        const group = document.getElementById('student-group').value;

        if (settings.collectName !== false && !name) {
            document.getElementById('student-name').style.borderColor = '#e74c3c';
            return;
        }
        if (settings.collectGroup !== false && !group) {
            document.getElementById('student-group').style.borderColor = '#e74c3c';
            return;
        }

        // Save student info
        testData._studentName = name;
        testData._studentGroup = group;
        startedAt = Date.now();

        // Shuffle questions if enabled
        if (settings.shuffleQuestions) {
            shuffleArray(testData.questions);
        }

        // Request fullscreen
        if (fullscreenEnabled) {
            requestFullscreen();
            setupAntiCheat();
        }

        // Start timer
        const timeLimit = settings.timeLimit || 0;
        if (timeLimit > 0) {
            timeRemaining = timeLimit * 60;
            startTimer();
        }

        // Setup navigation
        setupNavigation();

        // Show first question
        currentQ = 0;
        renderQuestion();
        showScreen('question');
    }

    // ===== FULLSCREEN & ANTI-CHEAT =====
    function requestFullscreen() {
        try {
            const el = document.documentElement;
            if (el.requestFullscreen) el.requestFullscreen();
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
            else if (el.msRequestFullscreen) el.msRequestFullscreen();
        } catch (e) {
            console.warn('Fullscreen not supported');
        }
    }

    function setupAntiCheat() {
        // Monitor fullscreen exit
        document.addEventListener('fullscreenchange', onFullscreenChange);
        document.addEventListener('webkitfullscreenchange', onFullscreenChange);

        // Monitor tab switch
        document.addEventListener('visibilitychange', onVisibilityChange);
    }

    function onFullscreenChange() {
        const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
        if (!isFS && fullscreenEnabled && screens.question.style.display !== 'none') {
            violations.push({ type: 'fullscreen-exit', timestamp: Date.now() });
            document.getElementById('fs-warning').style.display = 'flex';
        } else if (isFS) {
            document.getElementById('fs-warning').style.display = 'none';
        }
    }

    function onVisibilityChange() {
        if (document.hidden && fullscreenEnabled && screens.question.style.display !== 'none') {
            violations.push({ type: 'tab-switch', timestamp: Date.now() });
        }
    }

    // Return to fullscreen
    document.addEventListener('DOMContentLoaded', () => {
        const btnReturnFs = document.getElementById('btn-return-fs');
        if (btnReturnFs) {
            btnReturnFs.addEventListener('click', () => {
                requestFullscreen();
                document.getElementById('fs-warning').style.display = 'none';
            });
        }

        // Lightbox close events
        const lightbox = document.getElementById('image-lightbox');
        const btnCloseLb = document.getElementById('btn-close-lightbox');
        if (lightbox && btnCloseLb) {
            btnCloseLb.addEventListener('click', () => lightbox.style.display = 'none');
            lightbox.addEventListener('click', (e) => {
                if (e.target === lightbox) lightbox.style.display = 'none';
            });
        }
        // Incomplete question warning handlers
        const btnGoBack = document.getElementById('btn-go-back');
        const btnContinue = document.getElementById('btn-continue-anyway');
        if (btnGoBack) {
            btnGoBack.addEventListener('click', () => {
                document.getElementById('incomplete-warning').style.display = 'none';
                pendingDirection = null;
            });
        }
        if (btnContinue) {
            btnContinue.addEventListener('click', () => {
                document.getElementById('incomplete-warning').style.display = 'none';
                if (pendingDirection === 'next') doNext();
                pendingDirection = null;
            });
        }
    });

    // ===== TIMER =====
    function startTimer() {
        const timerEl = document.getElementById('q-timer');
        const timerText = document.getElementById('timer-text');
        timerEl.style.display = 'inline-flex';

        timerInterval = setInterval(() => {
            timeRemaining--;
            const mm = String(Math.floor(timeRemaining / 60)).padStart(2, '0');
            const ss = String(timeRemaining % 60).padStart(2, '0');
            timerText.textContent = `${mm}:${ss}`;

            if (timeRemaining <= 60) {
                timerEl.style.color = '#e74c3c';
            }

            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                submitTest();
            }
        }, 1000);
    }

    // ===== NAVIGATION =====
    function setupNavigation() {
        document.getElementById('btn-next').addEventListener('click', nextQuestion);
        document.getElementById('btn-prev').addEventListener('click', prevQuestion);
        document.getElementById('btn-submit-test').addEventListener('click', submitTest);

        // Incomplete question warning handlers
        document.getElementById('btn-go-back').addEventListener('click', () => {
            document.getElementById('incomplete-warning').style.display = 'none';
            pendingDirection = null;
        });
        document.getElementById('btn-continue-anyway').addEventListener('click', () => {
            document.getElementById('incomplete-warning').style.display = 'none';
            if (pendingDirection === 'next') {
                doNext();
            } else if (pendingDirection === 'submit') {
                submitTest(true);   // force submit
            }
            pendingDirection = null;
        });
    }

    let pendingDirection = null;  // 'next' or 'submit' ΓÇö used by incomplete warning

    function nextQuestion() {
        if (!isQuestionAnswered()) {
            pendingDirection = 'next';
            document.getElementById('incomplete-warning').style.display = 'flex';
            return;
        }
        doNext();
    }

    function doNext() {
        if (currentQ < testData.questions.length - 1) {
            currentQ++;
            renderQuestion();
        }
    }

    function prevQuestion() {
        if (currentQ > 0) {
            currentQ--;
            renderQuestion();
        }
    }

    // ===== RENDER QUESTION =====
    function renderQuestion() {
        const q = testData.questions[currentQ];
        const total = testData.questions.length;
        const body = document.getElementById('question-body');

        // Progress
        document.getElementById('progress-fill').style.width = `${((currentQ + 1) / total) * 100}%`;
        document.getElementById('q-counter').textContent = `${currentQ + 1} / ${total}`;

        // Nav buttons
        document.getElementById('btn-prev').style.display = currentQ > 0 ? 'inline-flex' : 'none';
        document.getElementById('btn-next').style.display = currentQ < total - 1 ? 'inline-flex' : 'none';
        document.getElementById('btn-submit-test').style.display = currentQ === total - 1 ? 'inline-flex' : 'none';

        // Media
        let mediaHtml = '';
        if (q.media && q.media.data) {
            if (q.media.type === 'image') {
                mediaHtml = `<div class="tt-q-media"><img class="tt-q-media-img" src="${q.media.data}" alt="Question image" data-preview="${q.media.data}" /></div>`;
            } else if (q.media.type === 'audio') {
                mediaHtml = `<div class="tt-q-media"><audio controls src="${q.media.data}"></audio></div>`;
            }
        }

        // Prompt
        let html = `
            <div class="tt-q-prompt">${escapeHtml(q.prompt)}</div>
            ${mediaHtml}
        `;

        // Question body by type
        switch (q.type) {
            case 'multiple-choice': html += renderMCQuestion(q); break;
            case 'true-false': html += renderTFQuestion(q); break;
            case 'fill-blank': html += renderFBQuestion(q); break;
            case 'matching': html += renderMatchQuestion(q); break;
            case 'unjumble-words': html += renderUWQuestion(q); break;
            case 'unjumble-letters': html += renderULQuestion(q); break;
            case 'drag-drop-category': html += renderDDQuestion(q); break;
        }

        body.innerHTML = html;

        // Bind interactions
        bindQuestionInteractions(q);
    }

    function renderMCQuestion(q) {
        const hasImages = q.optionImages && q.optionImages.some(img => img);
        const gridClass = hasImages
            ? (q.options.length <= 3 ? 'tt-options-img-grid tt-img-row' : 'tt-options-img-grid')
            : '';

        const opts = q.options.map((opt, i) => {
            const selected = answers[currentQ] === i ? 'selected' : '';
            const img = q.optionImages && q.optionImages[i]
                ? `<img class="tt-option-img" src="${q.optionImages[i]}" alt="" data-preview="${q.optionImages[i]}" />`
                : '';
            return `<div class="tt-option ${hasImages ? 'tt-option-card' : ''} ${selected}" data-idx="${i}">
                <span class="tt-opt-letter">${LETTERS[i]}</span>
                <span class="tt-opt-text">${img}${escapeHtml(opt)}</span>
            </div>`;
        }).join('');
        return `<div class="tt-options ${gridClass}">${opts}</div>`;
    }

    function renderTFQuestion(q) {
        const opts = q.options.map((opt, i) => {
            const selected = answers[currentQ] === i ? 'selected' : '';
            const icon = i === 0 ? 'fa-check' : 'fa-xmark';
            return `<div class="tt-option ${selected}" data-idx="${i}">
                <span class="tt-opt-letter"><i class="fa-solid ${icon}"></i></span>
                <span class="tt-opt-text">${escapeHtml(opt)}</span>
            </div>`;
        }).join('');
        return `<div class="tt-options">${opts}</div>`;
    }

    function renderFBQuestion(q) {
        // Migrate old single-sentence format
        if (q.sentence !== undefined && !q.sentences) {
            q.sentences = [q.sentence];
            delete q.sentence;
        }
        const sentences = q.sentences || [];

        let blankIdx = 0;
        const sentencesHtml = sentences.map(s => {
            let escaped = escapeHtml(s);
            escaped = escaped.replace(/___/g, () => {
                const val = answers[currentQ] && answers[currentQ][blankIdx] ? answers[currentQ][blankIdx] : '';
                return `<input type="text" class="tt-blank-input" data-blank="${blankIdx++}" value="${escapeHtml(val)}" placeholder="..." />`;
            });
            return `<div class="tt-fill-blank-sentence">${escaped}</div>`;
        }).join('');

        let wordBankHtml = '';
        if (q.useWordBank && q.blanks && q.blanks.length > 0) {
            const usedWords = answers[currentQ] || [];
            const bankWords = [...q.blanks];
            if (q.wordBank) bankWords.push(...q.wordBank);
            shuffleArray(bankWords);
            wordBankHtml = `<div class="tt-word-bank">${bankWords.map(w => {
                const used = usedWords.includes(w) ? 'used' : '';
                return `<span class="tt-word-bank-chip ${used}" data-word="${escapeHtml(w)}">${escapeHtml(w)}</span>`;
            }).join('')}</div>`;
        }

        return `${wordBankHtml}<div class="tt-fb-card">${sentencesHtml}</div>`;
    }

    // Cache shuffled right options per question so re-renders keep stable positions
    const matchShuffleCache = {};

    function renderMatchQuestion(q) {
        // Shuffle once, then reuse the cached order
        if (!matchShuffleCache[currentQ]) {
            const opts = q.pairs.map(p => p.right);
            if (q.shuffleRight !== false) shuffleArray(opts);
            matchShuffleCache[currentQ] = opts;
        }
        const rightOptions = matchShuffleCache[currentQ];

        const currentMatches = answers[currentQ] || [];

        const leftItems = q.pairs.map((p, i) => {
            const isMatched = currentMatches[i] !== undefined && currentMatches[i] !== '';
            const img = q.pairImages && q.pairImages[i]
                ? `<img class="tt-match-img" src="${q.pairImages[i]}" alt="" data-preview="${q.pairImages[i]}" />`
                : '';
            return `<div class="tt-match-item tt-match-item-left ${isMatched ? 'matched' : ''}" data-idx="${i}">${img}${escapeHtml(p.left)}</div>`;
        }).join('');

        const rightItems = rightOptions.map((r, i) => {
            const isMatched = currentMatches.includes(r);
            return `<div class="tt-match-item tt-match-item-right ${isMatched ? 'matched' : ''}" data-value="${escapeHtml(r)}" data-idx="${i}">
                <span class="tt-match-text">${escapeHtml(r)}</span>
                <button class="tt-match-clear" data-value="${escapeHtml(r)}"><i class="fa-solid fa-trash-can"></i></button>
            </div>`;
        }).join('');

        return `<div class="tt-matching">
            <div class="tt-match-container">
                <div class="tt-match-column tt-match-col-left">${leftItems}</div>
                <div class="tt-match-gap"></div>
                <div class="tt-match-column tt-match-col-right">${rightItems}</div>
                <svg class="tt-match-svg" id="match-svg"></svg>
            </div>
        </div>`;
    }

    function renderUWQuestion(q) {
        const placed = answers[currentQ] || [];
        const words = [...q.words];
        shuffleArray(words);

        let hintHtml = '';
        if (q.showHint && q.words.length > 0) {
            hintHtml = `<div class="tt-unjumble-hint">Hint: starts with "${escapeHtml(q.words[0])}"</div>`;
        }

        const placedCounts = {};
        placed.forEach(w => placedCounts[w] = (placedCounts[w] || 0) + 1);

        const tiles = words.map((w, i) => {
            let isPlaced = '';
            if (placedCounts[w] > 0) {
                isPlaced = 'placed';
                placedCounts[w]--;
            }
            return `<span class="tt-unjumble-tile ${isPlaced}" data-word="${escapeHtml(w)}" data-idx="${i}">${escapeHtml(w)}</span>`;
        }).join('');

        const answerChips = placed.map((w, i) =>
            `<span class="tt-answer-chip" data-idx="${i}">${escapeHtml(w)}</span>`
        ).join('');

        return `${hintHtml}
            <div class="tt-answer-zone" id="answer-zone">${answerChips || '<span style="color:#bbb;font-size:0.85rem;">Tap words to arrange them</span>'}</div>
            <div class="tt-unjumble-tiles">${tiles}</div>`;
    }

    function renderULQuestion(q) {
        const placed = answers[currentQ] || [];
        const letters = (q.correctWord || '').split('');
        shuffleArray(letters);

        let hintHtml = '';
        if (q.showHint && q.correctWord) {
            hintHtml = `<div class="tt-unjumble-hint">Hint: starts with "${q.correctWord[0]}"</div>`;
        }

        const placedCounts = {};
        placed.forEach(l => placedCounts[l] = (placedCounts[l] || 0) + 1);

        const tiles = letters.map((l, i) => {
            let isPlaced = '';
            if (placedCounts[l] > 0) {
                isPlaced = 'placed';
                placedCounts[l]--;
            }
            return `<span class="tt-unjumble-tile ${isPlaced}" data-letter="${escapeHtml(l)}" data-idx="${i}">${escapeHtml(l.toUpperCase())}</span>`;
        }).join('');

        const answerChips = placed.map((l, i) =>
            `<span class="tt-answer-chip" data-idx="${i}">${escapeHtml(l.toUpperCase())}</span>`
        ).join('');

        return `${hintHtml}
            <div class="tt-answer-zone" id="answer-zone">${answerChips || '<span style="color:#bbb;font-size:0.85rem;">Tap letters to spell the word</span>'}</div>
            <div class="tt-unjumble-tiles">${tiles}</div>`;
    }

    function renderDDQuestion(q) {
        // Collect all items, make a pool
        const allItems = [];
        q.categories.forEach(cat => {
            cat.items.forEach(item => allItems.push(item));
        });
        shuffleArray(allItems);

        const placedItems = answers[currentQ] || {}; // { catIndex: [items] }

        const cats = q.categories.map((cat, ci) => {
            const items = placedItems[ci] || [];
            const chips = items.map(item => {
                const hasImg = q.itemImages && q.itemImages[item];
                if (hasImg) {
                    return `<div class="tt-dd-item tt-dd-card" data-cat="${ci}" data-item="${escapeHtml(item)}">
                        <div class="tt-dd-img-wrap">
                            <img src="${q.itemImages[item]}" class="tt-dd-card-img" />
                            <button class="tt-zoom-btn" data-img="${q.itemImages[item]}"><i class="fa-solid fa-expand"></i></button>
                        </div>
                        <span class="tt-dd-text">${escapeHtml(item)}</span>
                    </div>`;
                }
                return `<span class="tt-dd-item" data-cat="${ci}" data-item="${escapeHtml(item)}">${escapeHtml(item)}</span>`;
            }).join('');
            return `<div class="tt-dd-category" data-cat="${ci}">
                <h4>${escapeHtml(cat.name)}</h4>
                <div class="tt-dd-cat-items">${chips}</div>
            </div>`;
        }).join('');

        const placedFlat = Object.values(placedItems).flat();
        const pool = allItems
            .filter(item => !placedFlat.includes(item))
            .map((item, i) => {
                const hasImg = q.itemImages && q.itemImages[item];
                if (hasImg) {
                    return `<div class="tt-dd-pool-item tt-dd-card" data-item="${escapeHtml(item)}" data-idx="${i}" draggable="true">
                        <div class="tt-dd-img-wrap">
                            <img src="${q.itemImages[item]}" class="tt-dd-card-img" />
                            <button class="tt-zoom-btn" data-img="${q.itemImages[item]}"><i class="fa-solid fa-expand"></i></button>
                        </div>
                        <span class="tt-dd-text">${escapeHtml(item)}</span>
                    </div>`;
                }
                return `<span class="tt-dd-pool-item" data-item="${escapeHtml(item)}" data-idx="${i}" draggable="true">${escapeHtml(item)}</span>`;
            }).join('');

        return `<div class="tt-dd-categories">${cats}</div>
            <div class="tt-dd-pool">${pool}</div>`;
    }

    // ===== BIND INTERACTIONS =====
    function bindQuestionInteractions(q) {
        switch (q.type) {
            case 'multiple-choice':
            case 'true-false':
                document.querySelectorAll('.tt-option').forEach(opt => {
                    opt.addEventListener('click', (e) => {
                        // Don't select option if clicking preview image
                        if (e.target.closest('.tt-option-img')) return;
                        answers[currentQ] = parseInt(opt.dataset.idx);
                        document.querySelectorAll('.tt-option').forEach(o => o.classList.remove('selected'));
                        opt.classList.add('selected');
                        opt.querySelector('.tt-opt-letter').style.transform = 'scale(1.1)';
                        setTimeout(() => opt.querySelector('.tt-opt-letter').style.transform = '', 200);
                    });
                });
                break;

            case 'fill-blank':
                document.querySelectorAll('.tt-blank-input').forEach(inp => {
                    inp.addEventListener('input', () => {
                        if (!answers[currentQ]) answers[currentQ] = [];
                        answers[currentQ][parseInt(inp.dataset.blank)] = inp.value;
                    });
                });
                // Word bank click
                document.querySelectorAll('.tt-word-bank-chip').forEach(chip => {
                    chip.addEventListener('click', () => {
                        if (chip.classList.contains('used')) return;
                        const word = chip.dataset.word;
                        // Fill first empty blank
                        const blanks = document.querySelectorAll('.tt-blank-input');
                        for (let b of blanks) {
                            if (!b.value) {
                                b.value = word;
                                if (!answers[currentQ]) answers[currentQ] = [];
                                answers[currentQ][parseInt(b.dataset.blank)] = word;
                                chip.classList.add('used');
                                break;
                            }
                        }
                    });
                });
                break;

            case 'matching':
                bindMatchInteractions(q);
                break;

            case 'unjumble-words':
                bindUnjumble('word');
                break;

            case 'unjumble-letters':
                bindUnjumble('letter');
                break;

            case 'drag-drop-category':
                bindDragDrop(q);
                break;
        }

        // Global Image preview lightbox (applies to all img with data-preview)
        document.querySelectorAll('img[data-preview]').forEach(img => {
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                showImageLightbox(img.dataset.preview);
            });
        });
    }

    function bindUnjumble(mode) {
        const tiles = document.querySelectorAll('.tt-unjumble-tile');
        const answerZone = document.getElementById('answer-zone');

        tiles.forEach(tile => {
            // Click to place
            tile.addEventListener('click', () => {
                if (tile.classList.contains('placed')) return;
                const value = mode === 'word' ? tile.dataset.word : tile.dataset.letter;
                if (!answers[currentQ]) answers[currentQ] = [];
                answers[currentQ].push(value);
                tile.classList.add('placed');
                renderQuestion();
            });

            // Drag start
            tile.setAttribute('draggable', 'true');
            tile.addEventListener('dragstart', (e) => {
                if (tile.classList.contains('placed')) { e.preventDefault(); return; }
                tile.classList.add('dragging');
                const value = mode === 'word' ? tile.dataset.word : tile.dataset.letter;
                e.dataTransfer.setData('text/plain', value);
                e.dataTransfer.setData('application/x-tile-idx', tile.dataset.idx);
                e.dataTransfer.effectAllowed = 'move';
            });
            tile.addEventListener('dragend', () => {
                tile.classList.remove('dragging');
            });
        });

        // Drop zone
        if (answerZone) {
            answerZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                answerZone.classList.add('drag-over');
            });
            answerZone.addEventListener('dragleave', () => {
                answerZone.classList.remove('drag-over');
            });
            answerZone.addEventListener('drop', (e) => {
                e.preventDefault();
                answerZone.classList.remove('drag-over');
                const value = e.dataTransfer.getData('text/plain');
                if (value) {
                    if (!answers[currentQ]) answers[currentQ] = [];
                    answers[currentQ].push(value);
                    renderQuestion();
                }
            });
        }

        // Remove from answer zone
        document.querySelectorAll('.tt-answer-chip').forEach(chip => {
            // Click to remove
            chip.addEventListener('click', () => {
                const idx = parseInt(chip.dataset.idx);
                if (answers[currentQ]) {
                    answers[currentQ].splice(idx, 1);
                }
                renderQuestion();
            });

            // Drag out to remove
            chip.setAttribute('draggable', 'true');
            chip.addEventListener('dragstart', (e) => {
                chip.classList.add('dragging');
                e.dataTransfer.setData('application/x-remove-chip-idx', chip.dataset.idx);
                e.dataTransfer.effectAllowed = 'move';
            });
            chip.addEventListener('dragend', (e) => {
                chip.classList.remove('dragging');
                if (e.dataTransfer.dropEffect === 'none') {
                    const idx = parseInt(chip.dataset.idx);
                    if (answers[currentQ]) {
                        answers[currentQ].splice(idx, 1);
                        renderQuestion();
                    }
                }
            });
        });
    }

    function bindDragDrop(q) {
        // === Click-to-place: click pool item, then click category ===
        let selectedItem = null;

        document.querySelectorAll('.tt-dd-pool-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.classList.contains('placed')) return;
                document.querySelectorAll('.tt-dd-pool-item').forEach(i => i.classList.remove('dd-selected'));
                item.classList.add('dd-selected');
                selectedItem = item.dataset.item;
            });

            // === Mouse drag support ===
            item.addEventListener('dragstart', (e) => {
                if (item.classList.contains('placed')) { e.preventDefault(); return; }
                item.classList.add('dragging');
                e.dataTransfer.setData('text/plain', item.dataset.item);
                e.dataTransfer.effectAllowed = 'move';
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });
        });

        document.querySelectorAll('.tt-dd-category').forEach(cat => {
            // Click-to-place
            cat.addEventListener('click', () => {
                if (!selectedItem) return;
                const ci = parseInt(cat.dataset.cat);
                if (!answers[currentQ]) answers[currentQ] = {};
                if (!answers[currentQ][ci]) answers[currentQ][ci] = [];
                answers[currentQ][ci].push(selectedItem);
                selectedItem = null;
                renderQuestion();
            });

            // Drag-over highlight
            cat.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                cat.classList.add('drag-over-cat');
            });
            cat.addEventListener('dragleave', () => {
                cat.classList.remove('drag-over-cat');
            });
            cat.addEventListener('drop', (e) => {
                e.preventDefault();
                cat.classList.remove('drag-over-cat');
                const itemValue = e.dataTransfer.getData('text/plain');
                if (!itemValue) return;
                const ci = parseInt(cat.dataset.cat);
                if (!answers[currentQ]) answers[currentQ] = {};
                if (!answers[currentQ][ci]) answers[currentQ][ci] = [];
                answers[currentQ][ci].push(itemValue);
                selectedItem = null;
                renderQuestion();
            });
        });

        // Remove from category (click placed item)
        document.querySelectorAll('.tt-dd-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const ci = parseInt(item.dataset.cat);
                const val = item.dataset.item;
                if (answers[currentQ] && answers[currentQ][ci]) {
                    const idx = answers[currentQ][ci].indexOf(val);
                    if (idx >= 0) answers[currentQ][ci].splice(idx, 1);
                }
                renderQuestion();
            });
        });
    }

    // ===== MATCHING: CLICK-TO-CONNECT =====
    let activeLeftIdx = null;

    function bindMatchInteractions(q) {
        if (!answers[currentQ]) answers[currentQ] = [];

        // Draw lines for existing matches
        setTimeout(() => renderMatchLines(), 50);

        // Left column click ΓÇö select
        document.querySelectorAll('.tt-match-item-left').forEach(item => {
            item.addEventListener('click', () => {
                if (item.classList.contains('matched')) return;
                document.querySelectorAll('.tt-match-item-left').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                activeLeftIdx = parseInt(item.dataset.idx);
            });
        });

        // Right column click ΓÇö connect
        document.querySelectorAll('.tt-match-item-right').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.tt-match-clear')) return; // handled separately
                if (activeLeftIdx === null) return;
                if (item.classList.contains('matched')) return;
                const rightValue = item.dataset.value;

                // Set the match
                answers[currentQ][activeLeftIdx] = rightValue;
                activeLeftIdx = null;
                renderQuestion();
            });
        });

        // Clear button ΓÇö undo match
        document.querySelectorAll('.tt-match-clear').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = btn.dataset.value;
                const idx = answers[currentQ].indexOf(val);
                if (idx >= 0) answers[currentQ][idx] = '';
                renderQuestion();
            });
        });
    }

    function renderMatchLines() {
        const svg = document.getElementById('match-svg');
        if (!svg) return;
        svg.innerHTML = '';
        const container = svg.closest('.tt-match-container');
        if (!container) return;

        const currentMatches = answers[currentQ] || [];
        const leftItems = container.querySelectorAll('.tt-match-item-left');
        const rightItems = container.querySelectorAll('.tt-match-item-right');
        const containerRect = container.getBoundingClientRect();

        currentMatches.forEach((rightVal, leftIdx) => {
            if (!rightVal) return;
            const leftEl = leftItems[leftIdx];
            const rightEl = [...rightItems].find(r => r.dataset.value === rightVal);
            if (!leftEl || !rightEl) return;

            const lr = leftEl.getBoundingClientRect();
            const rr = rightEl.getBoundingClientRect();

            const x1 = lr.right - containerRect.left;
            const y1 = lr.top + lr.height / 2 - containerRect.top;
            const x2 = rr.left - containerRect.left;
            const y2 = rr.top + rr.height / 2 - containerRect.top;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            svg.appendChild(line);
        });
    }

    // ===== QUESTION COMPLETENESS CHECK =====
    function isQuestionAnswered() {
        const q = testData.questions[currentQ];
        const a = answers[currentQ];
        switch (q.type) {
            case 'multiple-choice':
            case 'true-false':
                return a !== null && a !== undefined;
            case 'fill-blank':
                if (!Array.isArray(a)) return false;
                return (q.blanks || []).every((_, i) => a[i] && a[i].trim() !== '');
            case 'matching':
                if (!Array.isArray(a)) return false;
                return q.pairs.every((_, i) => a[i] && a[i] !== '');
            case 'unjumble-words':
            case 'unjumble-letters':
                return Array.isArray(a) && a.length > 0;
            case 'drag-drop-category':
                if (!a || typeof a !== 'object') return false;
                return Object.values(a).flat().length > 0;
            default:
                return true;
        }
    }

    // ===== SUBMIT TEST =====
    async function submitTest(force) {
        // If not forced, check if current question is answered
        if (force !== true && !isQuestionAnswered()) {
            pendingDirection = 'submit';
            document.getElementById('incomplete-warning').style.display = 'flex';
            return;
        }

        if (timerInterval) clearInterval(timerInterval);

        const completedAt = Date.now();
        const durationSeconds = Math.round((completedAt - startedAt) / 1000);

        // Grade
        let totalPoints = 0;
        let earnedPoints = 0;

        // Pre-calculate total points to ensure robustness
        testData.questions.forEach(q => {
            if (q.type === 'drag-drop-category' && testData.settings.partialGradingDragDrop) {
                // If partial grading, total points for THIS question is the number of items
                totalPoints += (q.categories || []).reduce((acc, cat) => acc + (cat.items || []).length, 0);
            } else {
                // Otherwise points for this question is the specified points (default 1)
                const pts = parseFloat(q.points);
                totalPoints += isNaN(pts) ? 1 : pts;
            }
        });

        const graded = testData.questions.map((q, i) => {
            const studentAnswer = answers[i];
            let earnedInQuestion = 0;
            const pts = parseFloat(q.points);
            let currentQPoints = isNaN(pts) ? 1 : pts;

            switch (q.type) {
                case 'multiple-choice':
                case 'true-false':
                    if (studentAnswer === q.correctAnswer) earnedInQuestion = currentQPoints;
                    break;
                case 'fill-blank':
                    if (Array.isArray(studentAnswer) && q.blanks) {
                        const allCorrect = q.blanks.every((b, bi) => {
                            const ans = studentAnswer[bi] || '';
                            return q.caseSensitive ? ans === b : ans.toLowerCase() === b.toLowerCase();
                        });
                        if (allCorrect) earnedInQuestion = currentQPoints;
                    }
                    break;
                case 'matching':
                    if (Array.isArray(studentAnswer) && q.pairs) {
                        const allCorrect = q.pairs.every((p, pi) => studentAnswer[pi] === p.right);
                        if (allCorrect) earnedInQuestion = currentQPoints;
                    }
                    break;
                case 'unjumble-words':
                    if (Array.isArray(studentAnswer) && q.words) {
                        const allCorrect = JSON.stringify(studentAnswer) === JSON.stringify(q.words);
                        if (allCorrect) earnedInQuestion = currentQPoints;
                    }
                    break;
                case 'unjumble-letters':
                    if (Array.isArray(studentAnswer) && q.correctWord) {
                        const allCorrect = studentAnswer.join('') === q.correctWord;
                        if (allCorrect) earnedInQuestion = currentQPoints;
                    }
                    break;
                case 'drag-drop-category':
                    if (studentAnswer && typeof studentAnswer === 'object' && q.categories) {
                        if (testData.settings.partialGradingDragDrop) {
                            let totalItems = 0;
                            let correctlyPlaced = 0;
                            q.categories.forEach((cat, ci) => {
                                totalItems += (cat.items || []).length;
                                const placed = studentAnswer[ci] || [];
                                placed.forEach(item => {
                                    if (cat.items.includes(item)) correctlyPlaced++;
                                });
                            });
                            earnedInQuestion = correctlyPlaced;
                            currentQPoints = totalItems;
                        } else {
                            const allCorrect = q.categories.every((cat, ci) => {
                                const placed = studentAnswer[ci] || [];
                                return cat.items.length === placed.length && cat.items.every(item => placed.includes(item));
                            });
                            if (allCorrect) earnedInQuestion = currentQPoints;
                        }
                    }
                    break;
            }

            earnedPoints += earnedInQuestion;
            return {
                questionId: q.id,
                answer: studentAnswer,
                correct: currentQPoints > 0 ? (earnedInQuestion === currentQPoints) : true,
                points: earnedInQuestion,
                maxPoints: currentQPoints
            };
        });

        const response = {
            studentName: testData._studentName || '',
            studentGroup: testData._studentGroup || '',
            score: earnedPoints,
            totalPoints: totalPoints,
            percentage: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0,
            answers: graded,
            startedAt: startedAt,
            completedAt: completedAt,
            durationSeconds: durationSeconds,
            violations: violations,
            violationCount: violations.length,
            submittedAt: Date.now()
        };

        // Submit to Firebase
        try {
            await FirebaseService.submitTestResponse(testCode, response);
        } catch (e) {
            console.error('Submit error:', e);
        }

        // Exit fullscreen
        if (document.fullscreenElement) {
            try { document.exitFullscreen(); } catch (e) { }
        }

        // Remove listeners
        document.removeEventListener('fullscreenchange', onFullscreenChange);
        document.removeEventListener('visibilitychange', onVisibilityChange);

        // Show results
        if (testData.settings && testData.settings.showResults !== false) {
            showResults(response, graded);
        } else {
            showResultsMinimal();
        }
    }

    // ===== RESULTS =====
    function showResults(response, graded) {
        lastGraded = graded;

        const scoreRingFill = document.getElementById('score-ring-fill');
        const scoreValueSpan = document.getElementById('score-value');

        let ringColor = '#e74c3c'; // Red (below 50%)
        if (response.percentage >= 80) ringColor = '#34d399'; // Green
        else if (response.percentage >= 50) ringColor = '#f5a623'; // Orange

        scoreRingFill.style.stroke = ringColor;

        // Animate counter and ring
        const targetPercent = response.percentage;
        scoreValueSpan.textContent = '0%';
        scoreRingFill.style.strokeDashoffset = '389.55'; // 2 * PI * 62 = full circumference

        // Give the UI a tick to render before starting animation
        setTimeout(() => {
            // Animate SVG stroke
            const offset = 389.55 - (targetPercent / 100) * 389.55;
            scoreRingFill.style.strokeDashoffset = offset;

            // Animate number count-up
            let currentNum = 0;
            const duration = 1500; // ms
            const interval = 20; // ms
            const steps = duration / interval;
            const inc = targetPercent / steps;

            const timer = setInterval(() => {
                currentNum += inc;
                if (currentNum >= targetPercent) {
                    currentNum = targetPercent;
                    clearInterval(timer);
                }
                scoreValueSpan.textContent = Math.round(currentNum) + '%';
            }, interval);

        }, 50);

        // Details
        const details = document.getElementById('results-details');
        const mm = Math.floor(response.durationSeconds / 60);
        const ss = response.durationSeconds % 60;
        details.innerHTML = `
            <div class="tt-results-row"><span>Correct</span><span>${response.score} / ${response.totalPoints}</span></div>
            <div class="tt-results-row"><span>Time</span><span>${mm}m ${ss}s</span></div>
        `;

        // Confetti ΓÇö only for 70% or above
        if (response.percentage >= 70) {
            const pieces = response.percentage >= 90 ? 60 : response.percentage >= 80 ? 40 : 20;
            spawnConfetti(pieces);
        }

        // Show Review Answers button if enabled
        if (testData.settings && testData.settings.showAnswerReview) {
            document.getElementById('btn-review-answers').style.display = '';
        }

        // Close button
        document.getElementById('btn-close-results').addEventListener('click', () => {
            window.close();
        });

        // Expose data for answer review
        window._ttLastGraded = graded;
        window._ttQuestions = testData.questions;
        window._ttAnswers = answers;

        showScreen('results');
    }

    function showResultsMinimal() {
        document.getElementById('score-value').textContent = 'Γ£ô';
        document.getElementById('score-circle').style.borderColor = '#34d399';
        document.getElementById('results-details').innerHTML = `
            <div class="tt-results-row"><span>Your test has been submitted successfully.</span></div>
        `;
        document.getElementById('btn-close-results').addEventListener('click', () => {
            window.close();
        });

        showScreen('results');
    }

    function spawnConfetti(count = 40) {
        const container = document.getElementById('confetti-container');
        container.innerHTML = ''; // clear any previous pieces
        const colors = ['#f5a623', '#7b68ee', '#34d399', '#e74c3c', '#3b82f6', '#ec4899'];
        for (let i = 0; i < count; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = Math.random() * 1.5 + 's';
            piece.style.animationDuration = (1.5 + Math.random()) + 's';
            container.appendChild(piece);
        }
    }

    // ===== UTILITIES =====
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showImageLightbox(src) {
        const lightbox = document.getElementById('image-lightbox');
        const img = document.getElementById('lightbox-img');
        if (lightbox && img) {
            img.src = src;
            lightbox.style.display = 'flex';
        }
    }

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ===== PUBLIC =====
    return { init };
})();

// ===== THEME & REVIEW EVENT BINDINGS (outside IIFE for DOM access) =====
document.addEventListener('DOMContentLoaded', () => {
    TakeTest.init();

    // Theme FAB toggle
    const fab = document.getElementById('btn-theme-fab');
    const picker = document.getElementById('theme-picker');
    if (fab && picker) {
        fab.addEventListener('click', (e) => {
            e.stopPropagation();
            picker.style.display = picker.style.display === 'none' ? '' : 'none';
        });
        document.addEventListener('click', (e) => {
            if (!picker.contains(e.target) && e.target !== fab) {
                picker.style.display = 'none';
            }
        });
    }

    // Theme swatch clicks
    document.querySelectorAll('.tt-theme-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
            applyTestTheme(btn.dataset.theme, document.body.classList.contains('tt-dark'));
        });
    });

    // Dark mode toggle
    const darkToggle = document.getElementById('tt-dark-toggle');
    if (darkToggle) {
        darkToggle.addEventListener('click', () => {
            const isDark = document.body.classList.contains('tt-dark');
            const activeTheme = document.querySelector('.tt-theme-swatch.active');
            const theme = activeTheme ? activeTheme.dataset.theme : 'default';
            applyTestTheme(theme, !isDark);
        });
    }

    // Animation toggle
    const animToggle = document.getElementById('tt-anim-toggle');
    if (animToggle) {
        // Init toggle icon state
        const icon = document.getElementById('tt-anim-icon');
        const animEnabled = localStorage.getItem('tt-anim-enabled') !== 'false';
        if (icon) icon.className = animEnabled ? 'fa-solid fa-pause' : 'fa-solid fa-play';

        animToggle.addEventListener('click', () => {
            const currentlyEnabled = localStorage.getItem('tt-anim-enabled') !== 'false';
            const willEnable = !currentlyEnabled;
            localStorage.setItem('tt-anim-enabled', willEnable ? 'true' : 'false');

            if (icon) icon.className = willEnable ? 'fa-solid fa-pause' : 'fa-solid fa-play';

            // Access internal state via function params or global read
            const isDark = document.body.classList.contains('tt-dark');
            const activeTheme = document.querySelector('.tt-theme-swatch.active');
            const theme = activeTheme ? activeTheme.dataset.theme : 'default';
            applyTestTheme(theme, isDark);
        });
    }

    // Review Answers button
    const btnReview = document.getElementById('btn-review-answers');
    if (btnReview) {
        btnReview.addEventListener('click', () => {
            document.querySelector('.tt-results-card').style.display = 'none';
            buildAnswerReview();
            document.getElementById('answer-review').style.display = '';
        });
    }

    // Back to Score button
    const btnBackToScore = document.getElementById('btn-back-to-score');
    if (btnBackToScore) {
        btnBackToScore.addEventListener('click', () => {
            document.getElementById('answer-review').style.display = 'none';
            document.querySelector('.tt-results-card').style.display = '';
        });
    }
});

// ===== THEME ENGINE =====
function applyTestTheme(theme, isDark) {
    const TT_THEMES = {
        'default': {
            '--tt-bg-from': '#3d348b', '--tt-bg-to': '#7678ed',
            dark: { '--tt-bg-from': '#1a1530', '--tt-bg-to': '#2c2a5a' }
        },
        'neon': {
            '--tt-bg-from': '#0a6e7a', '--tt-bg-to': '#00b4d8',
            dark: { '--tt-bg-from': '#05050f', '--tt-bg-to': '#0d0d2b' }
        },
        'forest': {
            '--tt-bg-from': '#1a3d2b', '--tt-bg-to': '#2d6a4f',
            dark: { '--tt-bg-from': '#0a1a11', '--tt-bg-to': '#152d1e' }
        },
        'winter': {
            '--tt-bg-from': '#4a9bbe', '--tt-bg-to': '#2a7fa8',
            dark: { '--tt-bg-from': '#0a2233', '--tt-bg-to': '#1a3a55' }
        },
        'candy': {
            '--tt-bg-from': '#a8005a', '--tt-bg-to': '#6a00c0',
            dark: { '--tt-bg-from': '#3d0030', '--tt-bg-to': '#28004a' }
        },
        'pastel': {
            '--tt-bg-from': '#b57bee', '--tt-bg-to': '#ee88b5',
            dark: { '--tt-bg-from': '#3d1f5a', '--tt-bg-to': '#5a1f3a' }
        },
        'ocean': {
            '--tt-bg-from': '#023e8a', '--tt-bg-to': '#0077b6',
            dark: { '--tt-bg-from': '#03045e', '--tt-bg-to': '#023e8a' }
        }
    };

    const themeData = TT_THEMES[theme] || TT_THEMES['default'];
    const vars = isDark ? Object.assign({}, themeData, themeData.dark || {}) : themeData;

    // Apply CSS variables to body
    document.body.style.setProperty('--tt-bg-from', vars['--tt-bg-from']);
    document.body.style.setProperty('--tt-bg-to', vars['--tt-bg-to']);

    // Toggle dark class
    if (isDark) {
        document.body.classList.add('tt-dark');
    } else {
        document.body.classList.remove('tt-dark');
    }

    // Update active swatch
    document.querySelectorAll('.tt-theme-swatch').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    // Update dark icon
    const icon = document.getElementById('tt-dark-icon');
    if (icon) {
        icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    // Update canvas animations via the exposed global function
    // For encapsulation, we attach it to window or use custom events, but since startBgAnimation is inside IIFE...
    // Let's expose it to window just for the theme engine, OR better yet: 
    // we can just put the theme engine *inside* the IIFE or make applyTestTheme call a private function.
    // However, since applyTestTheme is standalone here, we'll dispatch an event or use the internal var.
    // Actually, `applyTestTheme` IS outside the IIFE!

    // Quick fix: Dispatch a custom event and let the IIFE pick it up
    window.dispatchEvent(new CustomEvent('test-theme-changed', {
        detail: { theme, isDark }
    }));
}

// Attach listener for the custom event inside the IIFE or out... 
// Wait, startBgAnimation is in the IIFE but applyTestTheme is not.
// Let's just listen to it globally.
window.addEventListener('test-theme-changed', (e) => {
    // Reconfigure the internal global startBgAnimation function if we had exposed it.
});

// ===== ANSWER REVIEW =====
function buildAnswerReview() {
    const reviewList = document.getElementById('review-list');
    if (!reviewList) return;

    // Access state from TakeTest closure ΓÇö we stored lastGraded on window
    const graded = window._ttLastGraded;
    const questions = window._ttQuestions;
    const studentAnswers = window._ttAnswers;
    if (!graded || !questions) return;

    const typeIcons = {
        'multiple-choice': 'fa-list-ol',
        'true-false': 'fa-check-double',
        'fill-blank': 'fa-pen-to-square',
        'matching': 'fa-right-left',
        'unjumble-words': 'fa-shuffle',
        'unjumble-letters': 'fa-spell-check',
        'drag-drop-category': 'fa-layer-group'
    };

    const escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    let html = '';
    questions.forEach((q, i) => {
        const g = graded[i];
        const icon = typeIcons[q.type] || 'fa-question';
        const isCorrect = g.correct;
        const statusClass = isCorrect ? 'tt-review-correct' : 'tt-review-wrong';
        const statusIcon = isCorrect ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-xmark"></i>';

        let studentAnswerText = '';
        let correctAnswerText = '';

        switch (q.type) {
            case 'multiple-choice':
                const sa = studentAnswers[i];
                studentAnswerText = (sa !== null && sa !== undefined && q.options) ? escapeHtml(q.options[sa]?.text || q.options[sa] || 'No answer') : 'No answer';
                correctAnswerText = q.options ? escapeHtml(q.options[q.correctAnswer]?.text || q.options[q.correctAnswer] || '') : '';
                break;
            case 'true-false':
                const saT = studentAnswers[i];
                const labels = q.trueLabel && q.falseLabel ? [q.trueLabel, q.falseLabel] : ['True', 'False'];
                studentAnswerText = saT === 0 ? labels[0] : saT === 1 ? labels[1] : 'No answer';
                correctAnswerText = q.correctAnswer === 0 ? labels[0] : labels[1];
                break;
            case 'fill-blank':
                const fbAns = studentAnswers[i];
                studentAnswerText = Array.isArray(fbAns) ? fbAns.map(a => a || '(empty)').join(', ') : 'No answer';
                correctAnswerText = (q.blanks || []).join(', ');
                break;
            case 'matching':
                const mAns = studentAnswers[i];
                studentAnswerText = Array.isArray(mAns) ? mAns.map(a => a || '(empty)').join(', ') : 'No answer';
                correctAnswerText = (q.pairs || []).map(p => p.right).join(', ');
                break;
            case 'unjumble-words':
                const uwAns = studentAnswers[i];
                studentAnswerText = Array.isArray(uwAns) ? uwAns.join(' ') : 'No answer';
                correctAnswerText = (q.words || []).join(' ');
                break;
            case 'unjumble-letters':
                const ulAns = studentAnswers[i];
                studentAnswerText = Array.isArray(ulAns) ? ulAns.join('') : 'No answer';
                correctAnswerText = q.correctWord || '';
                break;
            case 'drag-drop-category':
                const ddAns = studentAnswers[i];
                if (ddAns && typeof ddAns === 'object' && q.categories) {
                    studentAnswerText = `<div class="tt-review-dd-breakdown">`;
                    q.categories.forEach((cat, ci) => {
                        const placed = ddAns[ci] || [];
                        const correctItems = cat.items || [];

                        studentAnswerText += `
                            <div class="tt-review-dd-cat">
                                <span class="tt-review-dd-cat-name">${escapeHtml(cat.name)}</span>
                                <div class="tt-review-dd-items">
                                    ${placed.map(item => {
                            const isCorrect = correctItems.includes(item);
                            if (isCorrect) {
                                return `<span class="tt-review-dd-item correct" title="Correctly placed"><i class="fa-solid fa-check"></i> ${escapeHtml(item)}</span>`;
                            } else {
                                // Find where it actually belongs
                                const correctCat = q.categories.find(c => c.items.includes(item));
                                const belongsTo = correctCat ? correctCat.name : 'None';
                                return `<span class="tt-review-dd-item wrong" title="Belongs in: ${escapeHtml(belongsTo)}"><i class="fa-solid fa-xmark"></i> ${escapeHtml(item)}</span>`;
                            }
                        }).join('')}
                                    ${correctItems.filter(item => !placed.includes(item)).map(item => {
                            return `<span class="tt-review-dd-item missing" title="Missing from this category"><i class="fa-solid fa-ellipsis"></i> ${escapeHtml(item)}</span>`;
                        }).join('')}
                                    ${placed.length === 0 && correctItems.length === 0 ? '<span class="tt-review-dd-empty">Empty</span>' : ''}
                                </div>
                            </div>`;
                    });
                    studentAnswerText += `</div>`;

                    // Correct answer text for DD is redundant if we show breakdown above, 
                    // but we can summarize what was missing globally if needed.
                    correctAnswerText = "See breakdown above";
                } else {
                    studentAnswerText = 'No answer';
                    correctAnswerText = q.categories ? q.categories.map(cat => `${escapeHtml(cat.name)}: ${cat.items.map(it => escapeHtml(it)).join(', ')}`).join(' | ') : '';
                }
                break;
            default:
                studentAnswerText = 'N/A';
        }

        html += `
            <div class="tt-review-card ${statusClass}">
                <div class="tt-review-card-header">
                    <span class="tt-review-q-num"><i class="fa-solid ${icon}"></i> Q${i + 1}</span>
                    <span class="tt-review-status">${statusIcon}</span>
                </div>
                <div class="tt-review-prompt">${escapeHtml(q.prompt || q.text || '')}</div>
                <div class="tt-review-answer-row">
                    <div class="tt-review-student-answer">
                        <span class="tt-review-label">Your answer:</span>
                        <span class="tt-review-value">${studentAnswerText}</span>
                    </div>
                    ${!isCorrect ? `
                    <div class="tt-review-correct-answer">
                        <span class="tt-review-label">Correct answer:</span>
                        <span class="tt-review-value">${correctAnswerText}</span>
                    </div>` : ''}
                </div>
            </div>`;
    });

    reviewList.innerHTML = html;
}

// ===== ANTI-CHEAT: KEYBOARD & CONTEXT MENU =====
document.addEventListener('DOMContentLoaded', () => {
    // 1. Block Keyboard Shortcuts (Copy, Paste, Print, Save, Select All)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            const blockedKeys = ['c', 'v', 'x', 'a', 'p', 's'];
            if (blockedKeys.includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
        }
    });

    // 2. Custom Context Menu
    const contextMenu = document.getElementById('tt-context-menu');
    if (!contextMenu) return;

    // We must capture the contextmenu on the document. Overriding inline styles just in case it's on body
    document.body.oncontextmenu = null;

    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        // Only show if the quiz hasn't finished completely (optional)
        // For now, always show it as it has 'Restart'.

        let x = e.clientX;
        let y = e.clientY;

        // Ensure menu stays within viewport
        const menuWidth = 220;
        const menuHeight = 200;

        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.style.display = 'block';
    });

    // Hide context menu on outside click
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
        }
    });

    // Context Menu Actions
    document.getElementById('cm-btn-theme')?.addEventListener('click', () => {
        contextMenu.style.display = 'none';
        const picker = document.getElementById('theme-picker');
        if (picker) {
            picker.style.display = picker.style.display === 'block' ? 'none' : 'block';
        }
    });

    document.getElementById('cm-btn-prev')?.addEventListener('click', () => {
        contextMenu.style.display = 'none';
        const scrQ = document.getElementById('screen-question');
        if (scrQ && scrQ.style.display !== 'none') {
            const btnPrev = document.getElementById('btn-prev');
            if (btnPrev && !btnPrev.disabled) btnPrev.click();
        }
    });

    document.getElementById('cm-btn-next')?.addEventListener('click', () => {
        contextMenu.style.display = 'none';
        const scrQ = document.getElementById('screen-question');
        if (scrQ && scrQ.style.display !== 'none') {
            const btnNext = document.getElementById('btn-next');
            if (btnNext && !btnNext.disabled) btnNext.click();
        }
    });

    document.getElementById('cm-btn-restart')?.addEventListener('click', () => {
        contextMenu.style.display = 'none';

        // Show the stylized restart modal
        const restartModal = document.getElementById('restart-warning');
        if (restartModal) {
            restartModal.style.display = 'flex';
        }
    });

    // Wire up the new restart modal buttons
    document.getElementById('btn-cancel-restart')?.addEventListener('click', () => {
        const restartModal = document.getElementById('restart-warning');
        if (restartModal) restartModal.style.display = 'none';
    });

    document.getElementById('btn-confirm-restart')?.addEventListener('click', () => {
        location.reload();
    });
});
