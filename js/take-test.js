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

    // ===== DOM CACHE =====
    let screens = {};

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

    let pendingDirection = null;  // 'next' or 'submit' — used by incomplete warning

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
                mediaHtml = `<div class="tt-q-media"><img src="${q.media.data}" alt="Question image" /></div>`;
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
        const opts = q.options.map((opt, i) => {
            const selected = answers[currentQ] === i ? 'selected' : '';
            const img = q.optionImages && q.optionImages[i]
                ? `<img class="tt-option-img" src="${q.optionImages[i]}" alt="" />`
                : '';
            return `<div class="tt-option ${selected}" data-idx="${i}">
                <span class="tt-opt-letter">${LETTERS[i]}</span>
                <span class="tt-opt-text">${img}${escapeHtml(opt)}</span>
            </div>`;
        }).join('');
        return `<div class="tt-options">${opts}</div>`;
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
        // Replace ___ with inputs
        let sentence = escapeHtml(q.sentence || '');
        let blankIdx = 0;
        sentence = sentence.replace(/___/g, () => {
            const val = answers[currentQ] && answers[currentQ][blankIdx] ? answers[currentQ][blankIdx] : '';
            return `<input type="text" class="tt-blank-input" data-blank="${blankIdx++}" value="${escapeHtml(val)}" placeholder="..." />`;
        });

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

        return `<div class="tt-fill-blank-sentence">${sentence}</div>${wordBankHtml}`;
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
                ? `<img class="tt-match-img" src="${q.pairImages[i]}" alt="" />`
                : '';
            return `<div class="tt-match-item tt-match-item-left ${isMatched ? 'matched' : ''}" data-idx="${i}">${img}${escapeHtml(p.left)}</div>`;
        }).join('');

        const rightItems = rightOptions.map((r, i) => {
            const isMatched = currentMatches.includes(r);
            return `<div class="tt-match-item tt-match-item-right ${isMatched ? 'matched' : ''}" data-value="${escapeHtml(r)}" data-idx="${i}">
                <span class="tt-match-text">${escapeHtml(r)}</span>
                <button class="tt-match-clear" data-value="${escapeHtml(r)}"><i class="fa-solid fa-xmark"></i></button>
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

        const tiles = words.map((w, i) => {
            const isPlaced = placed.includes(w) ? 'placed' : '';
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

        const tiles = letters.map((l, i) => {
            const isPlaced = placed.length > 0 && placed.filter(x => x === l).length >= letters.filter((x, j) => x === l && placed.includes(x) && j <= i).length ? '' : '';
            return `<span class="tt-unjumble-tile" data-letter="${escapeHtml(l)}" data-idx="${i}">${escapeHtml(l.toUpperCase())}</span>`;
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
            const chips = items.map(item =>
                `<span class="tt-dd-item" data-cat="${ci}" data-item="${escapeHtml(item)}">${escapeHtml(item)}</span>`
            ).join('');
            return `<div class="tt-dd-category" data-cat="${ci}">
                <h4>${escapeHtml(cat.name)}</h4>
                <div class="tt-dd-cat-items">${chips}</div>
            </div>`;
        }).join('');

        const placedFlat = Object.values(placedItems).flat();
        const pool = allItems.map((item, i) => {
            const isPlaced = placedFlat.includes(item) ? 'placed' : '';
            return `<span class="tt-dd-pool-item ${isPlaced}" data-item="${escapeHtml(item)}" data-idx="${i}" draggable="true">${escapeHtml(item)}</span>`;
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
                    opt.addEventListener('click', () => {
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
            chip.addEventListener('click', () => {
                const idx = parseInt(chip.dataset.idx);
                if (answers[currentQ]) {
                    answers[currentQ].splice(idx, 1);
                }
                renderQuestion();
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

        // Left column click — select
        document.querySelectorAll('.tt-match-item-left').forEach(item => {
            item.addEventListener('click', () => {
                if (item.classList.contains('matched')) return;
                document.querySelectorAll('.tt-match-item-left').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                activeLeftIdx = parseInt(item.dataset.idx);
            });
        });

        // Right column click — connect
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

        // Clear button — undo match
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
        const graded = testData.questions.map((q, i) => {
            const studentAnswer = answers[i];
            let correct = false;
            totalPoints += (q.points || 1);

            switch (q.type) {
                case 'multiple-choice':
                case 'true-false':
                    correct = studentAnswer === q.correctAnswer;
                    break;
                case 'fill-blank':
                    if (Array.isArray(studentAnswer) && q.blanks) {
                        correct = q.blanks.every((b, bi) => {
                            const ans = studentAnswer[bi] || '';
                            return q.caseSensitive ? ans === b : ans.toLowerCase() === b.toLowerCase();
                        });
                    }
                    break;
                case 'matching':
                    if (Array.isArray(studentAnswer) && q.pairs) {
                        correct = q.pairs.every((p, pi) => studentAnswer[pi] === p.right);
                    }
                    break;
                case 'unjumble-words':
                    if (Array.isArray(studentAnswer) && q.words) {
                        correct = JSON.stringify(studentAnswer) === JSON.stringify(q.words);
                    }
                    break;
                case 'unjumble-letters':
                    if (Array.isArray(studentAnswer) && q.correctWord) {
                        correct = studentAnswer.join('') === q.correctWord;
                    }
                    break;
                case 'drag-drop-category':
                    if (studentAnswer && typeof studentAnswer === 'object' && q.categories) {
                        correct = q.categories.every((cat, ci) => {
                            const placed = studentAnswer[ci] || [];
                            return cat.items.length === placed.length && cat.items.every(item => placed.includes(item));
                        });
                    }
                    break;
            }

            if (correct) earnedPoints += (q.points || 1);
            return { questionId: q.id, answer: studentAnswer, correct, points: correct ? (q.points || 1) : 0 };
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
            showResults(response);
        } else {
            showResultsMinimal();
        }
    }

    // ===== RESULTS =====
    function showResults(response) {
        document.getElementById('score-value').textContent = response.percentage + '%';

        // Color the score circle
        const circle = document.getElementById('score-circle');
        if (response.percentage >= 80) {
            circle.style.borderColor = '#34d399';
        } else if (response.percentage >= 50) {
            circle.style.borderColor = '#f5a623';
        } else {
            circle.style.borderColor = '#e74c3c';
        }

        // Details
        const details = document.getElementById('results-details');
        const mm = Math.floor(response.durationSeconds / 60);
        const ss = response.durationSeconds % 60;
        details.innerHTML = `
            <div class="tt-results-row"><span>Correct</span><span>${response.score} / ${response.totalPoints}</span></div>
            <div class="tt-results-row"><span>Time</span><span>${mm}m ${ss}s</span></div>
        `;

        // Confetti — only for 70% or above
        if (response.percentage >= 70) {
            const pieces = response.percentage >= 90 ? 60 : response.percentage >= 80 ? 40 : 20;
            spawnConfetti(pieces);
        }

        // Close button
        document.getElementById('btn-close-results').addEventListener('click', () => {
            window.close();
        });

        showScreen('results');
    }

    function showResultsMinimal() {
        document.getElementById('score-value').textContent = '✓';
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

document.addEventListener('DOMContentLoaded', () => {
    TakeTest.init();
});
