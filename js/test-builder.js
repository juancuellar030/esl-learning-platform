/**
 * Test Builder Module
 * Teacher-facing quiz/test builder with 7 question types, live preview, and settings.
 */
const TestBuilder = (function () {
    'use strict';

    // ===== CONSTANTS =====
    const STORAGE_KEY = 'esl_test_builder_data';
    const QUESTION_TYPES = [
        { id: 'multiple-choice', label: 'Multiple Choice', icon: 'fa-list-ul' },
        { id: 'true-false', label: 'True / False', icon: 'fa-check-double' },
        { id: 'fill-blank', label: 'Fill in the Blank', icon: 'fa-pen-to-square' },
        { id: 'matching', label: 'Matching', icon: 'fa-right-left' },
        { id: 'unjumble-words', label: 'Unjumble Words', icon: 'fa-shuffle' },
        { id: 'unjumble-letters', label: 'Unjumble Letters', icon: 'fa-spell-check' },
        { id: 'drag-drop-category', label: 'Drag & Drop', icon: 'fa-layer-group' }
    ];
    const DEFAULT_GROUPS = ['3A', '3B', '3C', '4A', '4B', '4C', '5A', '5B', '5C', '5D'];
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    // ===== STATE =====
    let testData = null;
    let currentQuestionIndex = -1;
    let dropdownOpen = false;

    // ===== DOM CACHE =====
    let dom = {};

    // ===== INITIALIZATION =====
    function init() {
        cacheDom();
        loadOrCreateTest();
        bindEvents();
        initResponsesDom();
        initGoogleDrive();
        renderSidebar();
        // Auto-start response listener if a share code was persisted
        if (currentShareCode) {
            responsesCode = currentShareCode;
            FirebaseService.init().then(() => {
                startResponseListener(currentShareCode);
            }).catch(() => { });
        }
        if (testData.questions.length > 0) {
            selectQuestion(0);
        } else {
            renderEditorEmpty();
            renderPreviewEmpty();
        }
    }

    function cacheDom() {
        dom.questionList = document.getElementById('question-list');
        dom.editorPanel = document.getElementById('editor-panel');
        dom.previewContent = document.getElementById('preview-content');
        dom.btnAddQuestion = document.getElementById('btn-add-question');
        dom.addDropdown = document.getElementById('add-question-dropdown');
        dom.settingsOverlay = document.getElementById('settings-overlay');
        dom.btnSettings = document.getElementById('btn-settings');
        dom.btnCloseSettings = document.getElementById('btn-close-settings');
        dom.btnSave = document.getElementById('btn-save');
        dom.btnExportToggle = document.getElementById('btn-export-toggle');
        dom.exportMenu = document.getElementById('export-menu');
        dom.exportDropdownWrap = document.getElementById('export-dropdown-wrap');
        dom.btnDownloadJson = document.getElementById('btn-download-json');
        dom.btnExportToDrive = document.getElementById('btn-export-to-drive');
        dom.importJsonInput = document.getElementById('import-json-input');
        dom.testTitleInput = document.getElementById('setting-test-title');
        dom.testDescInput = document.getElementById('setting-test-desc');
        dom.timeLimitInput = document.getElementById('setting-time-limit');
        dom.shuffleQuestionsToggle = document.getElementById('setting-shuffle-questions');
        dom.shuffleOptionsToggle = document.getElementById('setting-shuffle-options');
        dom.showResultsToggle = document.getElementById('setting-show-results');
        dom.allowRetakeToggle = document.getElementById('setting-allow-retake');
        dom.collectNameToggle = document.getElementById('setting-collect-name');
        dom.collectGroupToggle = document.getElementById('setting-collect-group');
        dom.fullscreenToggle = document.getElementById('setting-fullscreen');
        dom.allowThemesToggle = document.getElementById('setting-allow-themes');
        dom.showAnswerReviewToggle = document.getElementById('setting-show-answer-review');
        dom.partialGradingToggle = document.getElementById('setting-partial-grading');
        dom.groupPills = document.getElementById('group-pills');
        dom.addGroupInput = document.getElementById('add-group-input');
        dom.btnAddGroup = document.getElementById('btn-add-group');
        dom.headerTitle = document.getElementById('builder-title');
        dom.toast = document.getElementById('toast');
        // Share modal
        dom.btnShare = document.getElementById('btn-share');
        dom.shareOverlay = document.getElementById('share-overlay');
        dom.btnCloseShare = document.getElementById('btn-close-share');
        dom.shareContentLoading = document.getElementById('share-content-loading');
        dom.shareContentReady = document.getElementById('share-content-ready');
        dom.shareCodeDisplay = document.getElementById('share-code-display');
        dom.shareUrl = document.getElementById('share-url');
        dom.btnCopyUrl = document.getElementById('btn-copy-url');
        dom.shareQr = document.getElementById('share-qr');
        dom.btnDeactivate = document.getElementById('btn-deactivate-test');
    }

    function loadOrCreateTest() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                testData = JSON.parse(saved);
                // Ensure settings object and all new fields exist (guard against older saved formats)
                if (!testData.settings || typeof testData.settings !== 'object') {
                    testData.settings = {};
                }
                if (!testData.settings.groupOptions) testData.settings.groupOptions = [...DEFAULT_GROUPS];
                if (testData.settings.enableFullscreen === undefined) testData.settings.enableFullscreen = true;
                if (testData.settings.allowThemes === undefined) testData.settings.allowThemes = true;
                if (testData.settings.showAnswerReview === undefined) testData.settings.showAnswerReview = true;
                if (testData.settings.partialGradingDragDrop === undefined) testData.settings.partialGradingDragDrop = false;
            } catch (e) {
                testData = createEmptyTest();
            }
        } else {
            testData = createEmptyTest();
        }
    }

    function createEmptyTest() {
        return {
            id: generateId(),
            title: 'Untitled Test',
            description: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            settings: {
                timeLimit: 0,
                shuffleQuestions: false,
                shuffleOptions: false,
                showResults: true,
                allowRetake: false,
                collectName: true,
                collectGroup: true,
                groupOptions: [...DEFAULT_GROUPS],
                enableFullscreen: true,
                allowThemes: true,
                showAnswerReview: true,
                partialGradingDragDrop: false
            },
            questions: []
        };
    }

    function generateId() {
        return 'q-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }

    // ===== EVENT BINDING =====
    function bindEvents() {
        // Add question dropdown
        dom.btnAddQuestion.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown();
        });

        document.addEventListener('click', (e) => {
            if (dropdownOpen) closeDropdown();

            // Close export menu when clicking outside
            if (dom.exportMenu && dom.exportMenu.style.display === 'block') {
                if (!dom.exportDropdownWrap.contains(e.target)) {
                    dom.exportMenu.style.display = 'none';
                }
            }

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

        // Settings modal
        dom.btnSettings.addEventListener('click', openSettings);
        dom.btnCloseSettings.addEventListener('click', closeSettings);
        dom.settingsOverlay.addEventListener('click', (e) => {
            if (e.target === dom.settingsOverlay) closeSettings();
        });

        // Save
        dom.btnSave.addEventListener('click', () => {
            saveTest();
            showToast('Test saved!');
        });

        // Import JSON from local file
        if (dom.importJsonInput) {
            dom.importJsonInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        const imported = JSON.parse(evt.target.result);
                        if (!imported.questions || !Array.isArray(imported.questions)) {
                            showToast('Invalid quiz file — missing questions array.');
                            return;
                        }
                        // Merge into testData, keeping defaults for missing fields
                        Object.assign(testData, imported);
                        if (!testData.settings) testData.settings = {};
                        if (!testData.settings.groupOptions) testData.settings.groupOptions = [...DEFAULT_GROUPS];
                        if (testData.settings.partialGradingDragDrop === undefined) testData.settings.partialGradingDragDrop = false;
                        dom.headerTitle.textContent = testData.title || 'Untitled Test';
                        saveTest();
                        renderSidebar();
                        if (testData.questions.length > 0) {
                            selectQuestion(0);
                        } else {
                            renderEditorEmpty();
                            renderPreviewEmpty();
                        }
                        showToast(`Imported: ${file.name}`);
                    } catch (err) {
                        showToast('Could not parse file — is it a valid JSON quiz?');
                    }
                    // Reset so the same file can be re-imported
                    dom.importJsonInput.value = '';
                };
                reader.readAsText(file);
            });
        }

        // Export dropdown toggle
        if (dom.btnExportToggle) {
            dom.btnExportToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = dom.exportMenu.style.display === 'block';
                dom.exportMenu.style.display = isOpen ? 'none' : 'block';
            });
        }

        // Export option: Download JSON locally
        if (dom.btnDownloadJson) {
            dom.btnDownloadJson.addEventListener('click', () => {
                dom.exportMenu.style.display = 'none';
                saveTest();
                const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(testData, null, 2));
                const a = document.createElement('a');
                a.setAttribute('href', dataStr);
                a.setAttribute('download', (testData.title || 'quiz') + '.json');
                document.body.appendChild(a);
                a.click();
                a.remove();
                showToast('Quiz downloaded as JSON!');
            });
        }

        // Export option: Save to Google Drive
        if (dom.btnExportToDrive) {
            dom.btnExportToDrive.addEventListener('click', async () => {
                dom.exportMenu.style.display = 'none';
                saveTest();

                // Ensure Drive service is ready
                if (!driveService) {
                    showToast('Google Drive not available.');
                    return;
                }

                if (!driveService._initialized) {
                    showToast('Initializing Google Drive...');
                    const ok = await driveService.init();
                    if (!ok) {
                        showToast('Could not initialize Google Drive.');
                        return;
                    }
                }

                if (!driveService.isSignedIn) {
                    // Open the Drive modal so user can sign in; after sign-in the modal
                    // handles listing files. We hook a one-time post-sign-in save.
                    showToast('Please sign in to Google Drive first.');
                    driveService.openModal();
                    // After the user signs in, offer them to save via a banner
                    const origCallback = driveService.tokenClient._callback;
                    driveService.tokenClient._callback = async (tokenResponse) => {
                        if (origCallback) origCallback(tokenResponse);
                        if (tokenResponse && tokenResponse.access_token) {
                            await driveService.saveFile(testData.title || 'quiz');
                        }
                        driveService.tokenClient._callback = origCallback;
                    };
                    return;
                }

                await driveService.saveFile(testData.title || 'quiz');
            });
        }

        // Save Settings button (inside settings modal)
        const btnSaveSettings = document.getElementById('btn-save-settings');
        if (btnSaveSettings) {
            btnSaveSettings.addEventListener('click', () => {
                saveTest();
                closeSettings();
                showToast('Settings saved!');
            });
        }

        // Settings inputs
        dom.testTitleInput.addEventListener('input', (e) => {
            testData.title = e.target.value || 'Untitled Test';
            dom.headerTitle.textContent = testData.title;
            autoSave();
        });
        dom.testDescInput.addEventListener('input', (e) => {
            testData.description = e.target.value;
            autoSave();
        });
        dom.timeLimitInput.addEventListener('input', (e) => {
            testData.settings.timeLimit = parseInt(e.target.value) || 0;
            autoSave();
        });
        dom.shuffleQuestionsToggle.addEventListener('change', (e) => {
            testData.settings.shuffleQuestions = e.target.checked;
            autoSave();
        });
        dom.shuffleOptionsToggle.addEventListener('change', (e) => {
            testData.settings.shuffleOptions = e.target.checked;
            autoSave();
        });
        dom.showResultsToggle.addEventListener('change', (e) => {
            testData.settings.showResults = e.target.checked;
            autoSave();
        });
        dom.allowRetakeToggle.addEventListener('change', (e) => {
            testData.settings.allowRetake = e.target.checked;
            autoSave();
        });
        dom.collectNameToggle.addEventListener('change', (e) => {
            testData.settings.collectName = e.target.checked;
            autoSave();
        });
        dom.collectGroupToggle.addEventListener('change', (e) => {
            testData.settings.collectGroup = e.target.checked;
            autoSave();
        });
        dom.fullscreenToggle.addEventListener('change', (e) => {
            testData.settings.enableFullscreen = e.target.checked;
            autoSave();
        });
        dom.allowThemesToggle.addEventListener('change', (e) => {
            testData.settings.allowThemes = e.target.checked;
            autoSave();
        });
        dom.showAnswerReviewToggle.addEventListener('change', (e) => {
            testData.settings.showAnswerReview = e.target.checked;
            autoSave();
        });
        if (dom.partialGradingToggle) {
            dom.partialGradingToggle.addEventListener('change', (e) => {
                testData.settings.partialGradingDragDrop = e.target.checked;
                autoSave();
            });
        }

        // Toggles
        bindToggle(dom.shuffleQuestionsToggle, 'shuffleQuestions');
        bindToggle(dom.shuffleOptionsToggle, 'shuffleOptions');
        bindToggle(dom.showResultsToggle, 'showResults');
        bindToggle(dom.allowRetakeToggle, 'allowRetake');
        bindToggle(dom.collectNameToggle, 'collectName');
        bindToggle(dom.collectGroupToggle, 'collectGroup');
        bindToggle(dom.fullscreenToggle, 'enableFullscreen');
        bindToggle(dom.allowThemesToggle, 'allowThemes');
        bindToggle(dom.showAnswerReviewToggle, 'showAnswerReview');

        // Add group
        dom.btnAddGroup.addEventListener('click', addGroup);
        dom.addGroupInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addGroup();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                saveTest();
                showToast('Test saved!');
            }
        });

        // Share modal
        dom.btnShare.addEventListener('click', openShareModal);
        dom.btnCloseShare.addEventListener('click', closeShareModal);
        dom.shareOverlay.addEventListener('click', (e) => {
            if (e.target === dom.shareOverlay) closeShareModal();
        });
        dom.btnCopyUrl.addEventListener('click', () => {
            dom.shareUrl.select();
            navigator.clipboard.writeText(dom.shareUrl.value).then(() => showToast('Link copied!'));
        });
        dom.btnDeactivate.addEventListener('click', deactivateSharedTest);
    }

    function bindToggle(toggle, key) {
        toggle.addEventListener('change', () => {
            testData.settings[key] = toggle.checked;
            autoSave();
        });
    }

    // ===== DROPDOWN =====
    function toggleDropdown() {
        if (dropdownOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    }

    function openDropdown() {
        dom.addDropdown.innerHTML = QUESTION_TYPES.map(qt => `
            <button class="dropdown-item" data-type="${qt.id}">
                <i class="fa-solid ${qt.icon}"></i>
                <span>${qt.label}</span>
            </button>
        `).join('');

        dom.addDropdown.querySelectorAll('.dropdown-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                addQuestion(btn.dataset.type);
                closeDropdown();
            });
        });

        dom.addDropdown.style.display = 'block';
        dropdownOpen = true;
    }

    function closeDropdown() {
        dom.addDropdown.style.display = 'none';
        dropdownOpen = false;
    }

    // ===== QUESTION CRUD =====
    function addQuestion(type) {
        const q = createDefaultQuestion(type);
        testData.questions.push(q);
        renderSidebar();
        selectQuestion(testData.questions.length - 1);
        autoSave();
    }

    function createDefaultQuestion(type) {
        const base = {
            id: generateId(),
            type: type,
            prompt: '',
            points: 1,
            media: null  // { type: 'image'|'audio', data: 'base64...', filename: '...' }
        };

        switch (type) {
            case 'multiple-choice':
                base.options = ['', '', '', ''];
                base.correctAnswer = 0;
                base.multiSelect = false;
                break;
            case 'true-false':
                base.options = ['True', 'False'];
                base.correctAnswer = 0;
                base.customLabels = false;
                break;
            case 'fill-blank':
                base.sentence = 'The ___ is blue.';
                base.blanks = ['sky'];
                base.wordBank = [];
                base.useWordBank = false;
                base.caseSensitive = false;
                break;
            case 'matching':
                base.pairs = [
                    { left: '', right: '' },
                    { left: '', right: '' },
                    { left: '', right: '' }
                ];
                base.shuffleRight = true;
                break;
            case 'unjumble-words':
                base.correctSentence = '';
                base.words = [];
                base.showHint = false;
                break;
            case 'unjumble-letters':
                base.correctWord = '';
                base.hint = '';
                base.showHint = false;
                break;
            case 'drag-drop-category':
                base.categories = [
                    { name: 'Category 1', items: [] },
                    { name: 'Category 2', items: [] }
                ];
                break;
        }

        return base;
    }

    function deleteQuestion(index) {
        testData.questions.splice(index, 1);
        if (currentQuestionIndex >= testData.questions.length) {
            currentQuestionIndex = testData.questions.length - 1;
        }
        renderSidebar();
        if (currentQuestionIndex >= 0) {
            selectQuestion(currentQuestionIndex);
        } else {
            currentQuestionIndex = -1;
            renderEditorEmpty();
            renderPreviewEmpty();
        }
        autoSave();
    }

    function duplicateQuestion(index) {
        const clone = JSON.parse(JSON.stringify(testData.questions[index]));
        clone.id = generateId();
        testData.questions.splice(index + 1, 0, clone);
        renderSidebar();
        selectQuestion(index + 1);
        autoSave();
    }

    function selectQuestion(index) {
        currentQuestionIndex = index;
        renderSidebar();
        renderEditor();
        renderPreview();
    }

    // ===== SIDEBAR RENDERING =====
    function renderSidebar() {
        const questions = testData.questions;
        if (questions.length === 0) {
            dom.questionList.innerHTML = `
                <div style="text-align:center; padding:30px 10px; color:#bbb; font-size:0.85rem;">
                    <i class="fa-solid fa-plus-circle" style="font-size:2rem; display:block; margin-bottom:10px; color:#ddd;"></i>
                    Click <b>+</b> to add your first question
                </div>`;
            return;
        }

        dom.questionList.innerHTML = questions.map((q, i) => {
            const typeInfo = QUESTION_TYPES.find(t => t.id === q.type) || { label: q.type, icon: 'fa-question' };
            const previewText = q.prompt || '(No prompt yet)';
            return `
                <div class="question-item ${i === currentQuestionIndex ? 'active' : ''}"
                     data-index="${i}" draggable="true">
                    <span class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></span>
                    <span class="q-number">${i + 1}</span>
                    <div class="q-info">
                        <div class="q-type"><i class="fa-solid ${typeInfo.icon}"></i> ${typeInfo.label}</div>
                        <div class="q-preview-text">${escapeHtml(previewText)}</div>
                    </div>
                    <div class="q-actions">
                        <button class="dup-btn" title="Duplicate" data-index="${i}"><i class="fa-solid fa-copy"></i></button>
                        <button class="delete-btn" title="Delete" data-index="${i}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
        }).join('');

        // Bind click events
        dom.questionList.querySelectorAll('.question-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.q-actions')) return;
                selectQuestion(parseInt(item.dataset.index));
            });
        });

        // Delete/duplicate buttons
        dom.questionList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteQuestion(parseInt(btn.dataset.index));
            });
        });
        dom.questionList.querySelectorAll('.dup-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                duplicateQuestion(parseInt(btn.dataset.index));
            });
        });

        // Drag and drop
        setupDragDrop();
    }

    function setupDragDrop() {
        let dragIndex = null;
        const items = dom.questionList.querySelectorAll('.question-item');

        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                dragIndex = parseInt(item.dataset.index);
                item.style.opacity = '0.4';
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.style.opacity = '1';
                items.forEach(it => it.classList.remove('drag-over'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const dropIndex = parseInt(item.dataset.index);
                if (dragIndex !== null && dragIndex !== dropIndex) {
                    const moved = testData.questions.splice(dragIndex, 1)[0];
                    testData.questions.splice(dropIndex, 0, moved);
                    if (currentQuestionIndex === dragIndex) {
                        currentQuestionIndex = dropIndex;
                    } else if (dragIndex < currentQuestionIndex && dropIndex >= currentQuestionIndex) {
                        currentQuestionIndex--;
                    } else if (dragIndex > currentQuestionIndex && dropIndex <= currentQuestionIndex) {
                        currentQuestionIndex++;
                    }
                    renderSidebar();
                    renderEditor();
                    renderPreview();
                    autoSave();
                }
                dragIndex = null;
            });
        });
    }

    // ===== EDITOR RENDERING =====
    function renderEditorEmpty() {
        dom.editorPanel.innerHTML = `
            <div class="editor-empty-state">
                <i class="fa-solid fa-file-pen"></i>
                <h2>No Question Selected</h2>
                <p>Add a question using the <b>+</b> button in the sidebar, or click an existing question to edit it.</p>
            </div>`;
    }

    function renderEditor() {
        if (currentQuestionIndex < 0 || currentQuestionIndex >= testData.questions.length) {
            renderEditorEmpty();
            return;
        }

        const q = testData.questions[currentQuestionIndex];
        const typeInfo = QUESTION_TYPES.find(t => t.id === q.type) || { label: q.type };

        let editorHtml = `
            <div class="editor-card">
                <h3><i class="fa-solid ${QUESTION_TYPES.find(t => t.id === q.type)?.icon || 'fa-question'}"></i> ${typeInfo.label} — Question ${currentQuestionIndex + 1}</h3>
                <div class="field-group">
                    <label>Question Prompt</label>
                    <textarea id="editor-prompt" placeholder="Enter the question...">${escapeHtml(q.prompt)}</textarea>
                </div>
                <div class="field-group">
                    <label>Points</label>
                    <div class="points-selector">
                        <input type="number" id="editor-points" value="${q.points}" min="1" max="100" />
                    </div>
                </div>
            </div>
            <div class="editor-card">
                <h3><i class="fa-solid fa-image"></i> Media (optional)</h3>
                ${renderMediaEditor(q)}
            </div>
            <div class="editor-card">
                <h3>Answer Configuration</h3>
                ${renderTypeEditor(q)}
            </div>`;

        dom.editorPanel.innerHTML = editorHtml;

        // Bind prompt
        const promptEl = document.getElementById('editor-prompt');
        promptEl.addEventListener('input', () => {
            q.prompt = promptEl.value;
            renderPreview();
            renderSidebarPreviewText(currentQuestionIndex, q.prompt);
            autoSave();
        });

        // Bind points
        const pointsEl = document.getElementById('editor-points');
        pointsEl.addEventListener('input', () => {
            q.points = parseInt(pointsEl.value) || 1;
            autoSave();
        });

        // Bind media upload
        bindMediaEditor(q);

        // Bind type-specific editors
        bindTypeEditor(q);
    }

    function renderSidebarPreviewText(index, text) {
        const items = dom.questionList.querySelectorAll('.question-item');
        if (items[index]) {
            const previewEl = items[index].querySelector('.q-preview-text');
            if (previewEl) previewEl.textContent = text || '(No prompt yet)';
        }
    }

    // ===== TYPE-SPECIFIC EDITORS =====
    function renderTypeEditor(q) {
        switch (q.type) {
            case 'multiple-choice': return renderMCEditor(q);
            case 'true-false': return renderTFEditor(q);
            case 'fill-blank': return renderFBEditor(q);
            case 'matching': return renderMatchEditor(q);
            case 'unjumble-words': return renderUWEditor(q);
            case 'unjumble-letters': return renderULEditor(q);
            case 'drag-drop-category': return renderDDEditor(q);
            default: return '<p>Unknown question type</p>';
        }
    }

    // Multiple Choice
    function renderMCEditor(q) {
        if (!q.optionImages) q.optionImages = [];
        const options = q.options.map((opt, i) => {
            const imgThumb = q.optionImages[i]
                ? `<div class="opt-img-thumb"><img src="${q.optionImages[i]}" /><button class="opt-img-remove" data-index="${i}" title="Remove image"><i class="fa-solid fa-xmark"></i></button></div>`
                : '';
            return `
            <div class="option-item ${q.correctAnswer === i || (Array.isArray(q.correctAnswer) && q.correctAnswer.includes(i)) ? 'correct' : ''}" data-index="${i}">
                <span class="correct-toggle" data-index="${i}" title="Mark as correct">
                    <i class="fa-solid fa-check"></i>
                </span>
                <div class="opt-content">
                    <input type="text" value="${escapeHtml(opt)}" placeholder="Option ${LETTERS[i]}..." data-index="${i}" class="mc-option-input" />
                    ${imgThumb}
                    <label class="opt-img-upload" data-index="${i}" title="Add image">
                        <i class="fa-solid fa-image"></i>
                        <input type="file" accept="image/*" data-index="${i}" class="mc-opt-img-input" style="display:none;" />
                    </label>
                </div>
                ${q.options.length > 2 ? `<button class="remove-option" data-index="${i}" title="Remove"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
        `}).join('');

        return `
            <div class="option-list" id="mc-options">${options}</div>
            ${q.options.length < 6 ? '<button class="btn-add-option" id="btn-add-mc-option"><i class="fa-solid fa-plus"></i> Add option</button>' : ''}
        `;
    }

    // True / False
    function renderTFEditor(q) {
        return `
            <div class="option-list" id="tf-options">
                <div class="option-item ${q.correctAnswer === 0 ? 'correct' : ''}" data-index="0">
                    <span class="correct-toggle" data-index="0" title="Mark as correct"><i class="fa-solid fa-check"></i></span>
                    ${q.customLabels ? `<input type="text" value="${escapeHtml(q.options[0])}" class="tf-label-input" data-index="0" placeholder="True" />` : `<span style="flex:1; padding:4px 0; font-size:0.95rem; color:#333;">True</span>`}
                </div>
                <div class="option-item ${q.correctAnswer === 1 ? 'correct' : ''}" data-index="1">
                    <span class="correct-toggle" data-index="1" title="Mark as correct"><i class="fa-solid fa-check"></i></span>
                    ${q.customLabels ? `<input type="text" value="${escapeHtml(q.options[1])}" class="tf-label-input" data-index="1" placeholder="False" />` : `<span style="flex:1; padding:4px 0; font-size:0.95rem; color:#333;">False</span>`}
                </div>
            </div>
            <div class="toggle-row">
                <span class="toggle-label">Custom labels (e.g. Correct/Incorrect)</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="tf-custom-labels" ${q.customLabels ? 'checked' : ''} />
                    <span class="toggle-slider"></span>
                </label>
            </div>`;
    }

    // Fill in the Blank
    function renderFBEditor(q) {
        const blanks = q.blanks.map((b, i) => `
            <div class="blank-slot">
                <span class="blank-number">${i + 1}</span>
                <input type="text" value="${escapeHtml(b)}" placeholder="Correct answer for blank ${i + 1}" class="fb-blank-input" data-index="${i}" />
                ${q.blanks.length > 1 ? `<button class="remove-option" data-index="${i}" data-action="remove-blank"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
        `).join('');

        return `
            <div class="field-group">
                <label>Sentence (use ___ for blanks)</label>
                <input type="text" id="fb-sentence" value="${escapeHtml(q.sentence || '')}" placeholder="The ___ is blue." />
            </div>
            <div class="field-group">
                <label>Correct Answers</label>
                <div class="blank-slots" id="fb-blanks">${blanks}</div>
                <button class="btn-add-option" id="btn-add-blank" style="margin-top:8px;"><i class="fa-solid fa-plus"></i> Add blank</button>
            </div>
            <div class="toggle-row">
                <span class="toggle-label">Case sensitive</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="fb-case-sensitive" ${q.caseSensitive ? 'checked' : ''} />
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="toggle-row">
                <span class="toggle-label">Show word bank</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="fb-use-wordbank" ${q.useWordBank ? 'checked' : ''} />
                    <span class="toggle-slider"></span>
                </label>
            </div>`;
    }

    // Matching
    function renderMatchEditor(q) {
        if (!q.pairImages) q.pairImages = [];
        const pairs = q.pairs.map((p, i) => {
            const leftImg = q.pairImages[i]
                ? `<div class="opt-img-thumb small"><img src="${q.pairImages[i]}" /><button class="pair-img-remove" data-index="${i}" title="Remove"><i class="fa-solid fa-xmark"></i></button></div>`
                : '';
            return `
            <div class="pair-item" data-index="${i}">
                <div class="pair-left-wrap">
                    <input type="text" value="${escapeHtml(p.left)}" placeholder="Item ${i + 1}" class="match-left" data-index="${i}" />
                    ${leftImg}
                    <label class="opt-img-upload small" data-index="${i}" title="Add image">
                        <i class="fa-solid fa-image"></i>
                        <input type="file" accept="image/*" data-index="${i}" class="pair-img-input" style="display:none;" />
                    </label>
                </div>
                <span class="pair-arrow"><i class="fa-solid fa-arrows-left-right"></i></span>
                <input type="text" value="${escapeHtml(p.right)}" placeholder="Match ${i + 1}" class="match-right" data-index="${i}" />
                ${q.pairs.length > 2 ? `<button class="remove-pair" data-index="${i}"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
        `}).join('');

        return `
            <div class="pair-list" id="match-pairs">${pairs}</div>
            ${q.pairs.length < 8 ? '<button class="btn-add-option" id="btn-add-pair"><i class="fa-solid fa-plus"></i> Add pair</button>' : ''}
            <div class="toggle-row" style="margin-top:10px;">
                <span class="toggle-label">Shuffle right column for students</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="match-shuffle-right" ${q.shuffleRight !== false ? 'checked' : ''} />
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `;
    }

    // Unjumble Words
    function renderUWEditor(q) {
        const chips = q.words.map((w, i) => `
            <span class="word-chip">${escapeHtml(w)}<button class="remove-word" data-index="${i}"><i class="fa-solid fa-xmark"></i></button></span>
        `).join('');

        return `
            <div class="field-group">
                <label>Correct sentence (in order)</label>
                <input type="text" id="uw-correct-sentence" value="${escapeHtml(q.correctSentence || '')}" placeholder="I like to eat pizza" />
            </div>
            <div class="field-group">
                <label>Words (auto-generated from sentence, or add manually)</label>
                <div class="word-chips-editor" id="uw-chips">${chips || '<span style="color:#bbb;font-size:0.85rem;">Type a sentence above and press the button to generate words</span>'}</div>
                <button class="btn-add-option" id="btn-generate-words" style="margin-top:8px;"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate from sentence</button>
            </div>
            <div class="toggle-row">
                <span class="toggle-label">Show first-word hint to students</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="uw-show-hint" ${q.showHint ? 'checked' : ''} />
                    <span class="toggle-slider"></span>
                </label>
            </div>`;
    }

    // Unjumble Letters
    function renderULEditor(q) {
        return `
            <div class="field-group">
                <label>Correct word</label>
                <input type="text" id="ul-correct-word" value="${escapeHtml(q.correctWord || '')}" placeholder="apple" />
            </div>
            <div class="field-group">
                <label>Hint (optional)</label>
                <input type="text" id="ul-hint" value="${escapeHtml(q.hint || '')}" placeholder="A fruit that's red or green" />
            </div>
            <div class="toggle-row">
                <span class="toggle-label">Show first-letter hint to students</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="ul-show-hint" ${q.showHint ? 'checked' : ''} />
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div style="padding:10px;background:#f8fafc;border-radius:8px;margin-top:8px;">
                <span style="font-size:0.8rem;color:#888;font-weight:600;">PREVIEW: </span>
                <span style="font-size:1rem;font-weight:600;color:var(--indigo-velvet);letter-spacing:4px;" id="ul-letter-preview">
                    ${q.correctWord ? shuffleString(q.correctWord).split('').join(' ') : '—'}
                </span>
            </div>`;
    }

    // Drag & Drop Category
    function renderDDEditor(q) {
        if (!q.itemImages) q.itemImages = {};
        const cats = q.categories.map((cat, ci) => {
            const chips = cat.items.map((item, ii) => {
                const imgThumb = q.itemImages[item]
                    ? `<div class="opt-img-thumb"><img src="${q.itemImages[item]}" /><button class="dd-img-remove" data-item="${escapeHtml(item)}" title="Remove image"><i class="fa-solid fa-xmark"></i></button></div>`
                    : '';
                return `
                <div class="cat-item-chip-container" style="display:inline-flex; flex-direction:column; align-items:center; gap:4px; margin-right:6px; margin-bottom:6px; border:1px solid #ddd; padding:4px; border-radius:6px; background:#fff;">
                    <span class="cat-item-chip" style="margin:0;">${escapeHtml(item)}<button class="remove-chip" data-cat="${ci}" data-item="${ii}"><i class="fa-solid fa-xmark"></i></button></span>
                    ${imgThumb}
                    <label class="opt-img-upload dd-img-upload" data-item="${escapeHtml(item)}" title="Add image" style="font-size:0.75rem; cursor:pointer; color:var(--medium-slate-blue);">
                        <i class="fa-solid fa-image"></i> Image
                        <input type="file" accept="image/*" class="dd-item-img-input" data-item="${escapeHtml(item)}" style="display:none;" />
                    </label>
                </div>`;
            }).join('');
            return `
                <div class="category-block" data-cat="${ci}">
                    <div class="cat-header">
                        <input type="text" value="${escapeHtml(cat.name)}" placeholder="Category name" class="cat-name-input" data-cat="${ci}" />
                        ${q.categories.length > 2 ? `<button class="remove-pair" data-cat="${ci}" data-action="remove-cat"><i class="fa-solid fa-xmark"></i></button>` : ''}
                    </div>
                    <div class="cat-items">${chips}</div>
                    <div class="cat-add-item">
                        <input type="text" placeholder="Add item..." class="cat-add-input" data-cat="${ci}" />
                        <button class="cat-add-btn" data-cat="${ci}">Add</button>
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="category-editor" id="dd-categories">${cats}</div>
            ${q.categories.length < 4 ? '<button class="btn-add-option" id="btn-add-category" style="margin-top:8px;"><i class="fa-solid fa-plus"></i> Add category</button>' : ''}
        `;
    }

    // ===== BIND TYPE-SPECIFIC EDITORS =====
    function bindTypeEditor(q) {
        switch (q.type) {
            case 'multiple-choice': bindMCEditor(q); break;
            case 'true-false': bindTFEditor(q); break;
            case 'fill-blank': bindFBEditor(q); break;
            case 'matching': bindMatchEditor(q); break;
            case 'unjumble-words': bindUWEditor(q); break;
            case 'unjumble-letters': bindULEditor(q); break;
            case 'drag-drop-category': bindDDEditor(q); break;
        }
    }

    function bindMCEditor(q) {
        // Option text inputs
        document.querySelectorAll('.mc-option-input').forEach(input => {
            input.addEventListener('input', () => {
                q.options[parseInt(input.dataset.index)] = input.value;
                renderPreview();
                autoSave();
            });
        });

        // Correct answer toggles
        document.querySelectorAll('.correct-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                q.correctAnswer = parseInt(toggle.dataset.index);
                renderEditor();
                renderPreview();
                autoSave();
            });
        });

        // Remove option
        document.querySelectorAll('.remove-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                q.options.splice(idx, 1);
                if (q.correctAnswer === idx) q.correctAnswer = 0;
                else if (q.correctAnswer > idx) q.correctAnswer--;
                renderEditor();
                renderPreview();
                autoSave();
            });
        });

        // Add option
        const addBtn = document.getElementById('btn-add-mc-option');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                q.options.push('');
                renderEditor();
                autoSave();
            });
        }

        // Option image uploads
        document.querySelectorAll('.mc-opt-img-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file || !file.type.startsWith('image/')) return;
                const idx = parseInt(input.dataset.index);
                const reader = new FileReader();
                reader.onload = () => {
                    if (!q.optionImages) q.optionImages = [];
                    q.optionImages[idx] = reader.result;
                    renderEditor();
                    renderPreview();
                    autoSave();
                };
                reader.readAsDataURL(file);
            });
        });

        // Remove option image
        document.querySelectorAll('.opt-img-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                if (q.optionImages) q.optionImages[idx] = null;
                renderEditor();
                renderPreview();
                autoSave();
            });
        });
    }

    function bindTFEditor(q) {
        document.querySelectorAll('.correct-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                q.correctAnswer = parseInt(toggle.dataset.index);
                renderEditor();
                renderPreview();
                autoSave();
            });
        });

        // Custom labels toggle
        const customLabelsEl = document.getElementById('tf-custom-labels');
        if (customLabelsEl) {
            customLabelsEl.addEventListener('change', () => {
                q.customLabels = customLabelsEl.checked;
                if (!q.customLabels) {
                    q.options = ['True', 'False'];
                }
                renderEditor();
                renderPreview();
                autoSave();
            });
        }

        // Custom label text inputs
        document.querySelectorAll('.tf-label-input').forEach(input => {
            input.addEventListener('input', () => {
                q.options[parseInt(input.dataset.index)] = input.value;
                renderPreview();
                autoSave();
            });
        });
    }

    function bindFBEditor(q) {
        const sentenceEl = document.getElementById('fb-sentence');
        sentenceEl.addEventListener('input', () => {
            q.sentence = sentenceEl.value;
            renderPreview();
            autoSave();
        });

        document.querySelectorAll('.fb-blank-input').forEach(input => {
            input.addEventListener('input', () => {
                q.blanks[parseInt(input.dataset.index)] = input.value;
                renderPreview();
                autoSave();
            });
        });

        document.querySelectorAll('[data-action="remove-blank"]').forEach(btn => {
            btn.addEventListener('click', () => {
                q.blanks.splice(parseInt(btn.dataset.index), 1);
                renderEditor();
                renderPreview();
                autoSave();
            });
        });

        const addBlankBtn = document.getElementById('btn-add-blank');
        if (addBlankBtn) {
            addBlankBtn.addEventListener('click', () => {
                q.blanks.push('');
                renderEditor();
                autoSave();
            });
        }

        const caseSensitiveEl = document.getElementById('fb-case-sensitive');
        caseSensitiveEl.addEventListener('change', () => {
            q.caseSensitive = caseSensitiveEl.checked;
            autoSave();
        });

        const wordBankEl = document.getElementById('fb-use-wordbank');
        wordBankEl.addEventListener('change', () => {
            q.useWordBank = wordBankEl.checked;
            renderPreview();
            autoSave();
        });
    }

    function bindMatchEditor(q) {
        document.querySelectorAll('.match-left').forEach(input => {
            input.addEventListener('input', () => {
                q.pairs[parseInt(input.dataset.index)].left = input.value;
                renderPreview();
                autoSave();
            });
        });

        document.querySelectorAll('.match-right').forEach(input => {
            input.addEventListener('input', () => {
                q.pairs[parseInt(input.dataset.index)].right = input.value;
                renderPreview();
                autoSave();
            });
        });

        document.querySelectorAll('.remove-pair').forEach(btn => {
            if (btn.dataset.action === 'remove-cat') return;
            btn.addEventListener('click', () => {
                q.pairs.splice(parseInt(btn.dataset.index), 1);
                renderEditor();
                renderPreview();
                autoSave();
            });
        });

        const addPairBtn = document.getElementById('btn-add-pair');
        if (addPairBtn) {
            addPairBtn.addEventListener('click', () => {
                q.pairs.push({ left: '', right: '' });
                renderEditor();
                autoSave();
            });
        }

        // Shuffle toggle
        const shuffleEl = document.getElementById('match-shuffle-right');
        if (shuffleEl) {
            shuffleEl.addEventListener('change', () => {
                q.shuffleRight = shuffleEl.checked;
                autoSave();
            });
        }

        // Pair image uploads
        document.querySelectorAll('.pair-img-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file || !file.type.startsWith('image/')) return;
                const idx = parseInt(input.dataset.index);
                const reader = new FileReader();
                reader.onload = () => {
                    if (!q.pairImages) q.pairImages = [];
                    q.pairImages[idx] = reader.result;
                    renderEditor();
                    renderPreview();
                    autoSave();
                };
                reader.readAsDataURL(file);
            });
        });

        // Remove pair image
        document.querySelectorAll('.pair-img-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                if (q.pairImages) q.pairImages[idx] = null;
                renderEditor();
                renderPreview();
                autoSave();
            });
        });
    }

    function bindUWEditor(q) {
        const sentenceEl = document.getElementById('uw-correct-sentence');
        sentenceEl.addEventListener('input', () => {
            q.correctSentence = sentenceEl.value;
            autoSave();
        });

        const genBtn = document.getElementById('btn-generate-words');
        genBtn.addEventListener('click', () => {
            if (q.correctSentence.trim()) {
                q.words = q.correctSentence.trim().split(/\s+/);
                renderEditor();
                renderPreview();
                autoSave();
            }
        });

        document.querySelectorAll('#uw-chips .remove-word').forEach(btn => {
            btn.addEventListener('click', () => {
                q.words.splice(parseInt(btn.dataset.index), 1);
                renderEditor();
                renderPreview();
                autoSave();
            });
        });

        // Show hint toggle
        const hintEl = document.getElementById('uw-show-hint');
        if (hintEl) {
            hintEl.addEventListener('change', () => {
                q.showHint = hintEl.checked;
                renderPreview();
                autoSave();
            });
        }
    }

    function bindULEditor(q) {
        const wordEl = document.getElementById('ul-correct-word');
        wordEl.addEventListener('input', () => {
            q.correctWord = wordEl.value;
            const previewEl = document.getElementById('ul-letter-preview');
            if (previewEl) {
                previewEl.textContent = q.correctWord ? shuffleString(q.correctWord).split('').join(' ') : '—';
            }
            renderPreview();
            autoSave();
        });

        const hintEl = document.getElementById('ul-hint');
        hintEl.addEventListener('input', () => {
            q.hint = hintEl.value;
            renderPreview();
            autoSave();
        });

        // Show hint toggle
        const showHintEl = document.getElementById('ul-show-hint');
        if (showHintEl) {
            showHintEl.addEventListener('change', () => {
                q.showHint = showHintEl.checked;
                renderPreview();
                autoSave();
            });
        }
    }

    function bindDDEditor(q) {
        document.querySelectorAll('.cat-name-input').forEach(input => {
            input.addEventListener('input', () => {
                q.categories[parseInt(input.dataset.cat)].name = input.value;
                renderPreview();
                autoSave();
            });
        });

        document.querySelectorAll('.cat-add-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const ci = parseInt(btn.dataset.cat);
                const input = document.querySelector(`.cat-add-input[data-cat="${ci}"]`);
                if (input.value.trim()) {
                    q.categories[ci].items.push(input.value.trim());
                    input.value = '';
                    renderEditor();
                    renderPreview();
                    autoSave();
                }
            });
        });

        document.querySelectorAll('.cat-add-input').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const ci = parseInt(input.dataset.cat);
                    if (input.value.trim()) {
                        q.categories[ci].items.push(input.value.trim());
                        input.value = '';
                        renderEditor();
                        renderPreview();
                        autoSave();
                    }
                }
            });
        });

        document.querySelectorAll('.remove-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const ci = parseInt(btn.dataset.cat);
                const ii = parseInt(btn.dataset.item);
                q.categories[ci].items.splice(ii, 1);
                renderEditor();
                renderPreview();
                autoSave();
            });
        });

        document.querySelectorAll('[data-action="remove-cat"]').forEach(btn => {
            btn.addEventListener('click', () => {
                q.categories.splice(parseInt(btn.dataset.cat), 1);
                renderEditor();
                renderPreview();
                autoSave();
            });
        });

        const addCatBtn = document.getElementById('btn-add-category');
        if (addCatBtn) {
            addCatBtn.addEventListener('click', () => {
                q.categories.push({ name: `Category ${q.categories.length + 1}`, items: [] });
                renderEditor();
                renderPreview();
                autoSave();
            });
        }

        // DD image uploads
        document.querySelectorAll('.dd-item-img-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file || !file.type.startsWith('image/')) return;
                const itemtext = input.dataset.item;
                const reader = new FileReader();
                reader.onload = () => {
                    if (!q.itemImages) q.itemImages = {};
                    q.itemImages[itemtext] = reader.result;
                    renderEditor();
                    renderPreview();
                    autoSave();
                };
                reader.readAsDataURL(file);
            });
        });

        // Remove DD image
        document.querySelectorAll('.dd-img-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemtext = btn.dataset.item;
                if (q.itemImages && q.itemImages[itemtext]) {
                    delete q.itemImages[itemtext];
                }
                renderEditor();
                renderPreview();
                autoSave();
            });
        });
    }

    // ===== PREVIEW RENDERING =====
    function renderPreviewEmpty() {
        dom.previewContent.innerHTML = `
            <div class="preview-empty">
                <i class="fa-solid fa-eye"></i>
                <p>Select a question to see a live preview</p>
            </div>`;
    }

    function renderPreview() {
        if (currentQuestionIndex < 0 || currentQuestionIndex >= testData.questions.length) {
            renderPreviewEmpty();
            return;
        }

        const q = testData.questions[currentQuestionIndex];
        let mediaHtml = '';
        if (q.media && q.media.data) {
            if (q.media.type === 'image') {
                mediaHtml = `<div class="preview-media"><img src="${q.media.data}" alt="Question media" /></div>`;
            } else if (q.media.type === 'audio') {
                mediaHtml = `<div class="preview-media"><audio controls src="${q.media.data}"></audio></div>`;
            }
        }
        dom.previewContent.innerHTML = `
            <div class="preview-phone-frame">
                <div class="preview-question-number">Question ${currentQuestionIndex + 1} of ${testData.questions.length}</div>
                <div class="preview-prompt">${escapeHtml(q.prompt) || '<span style="color:#ccc;font-style:italic;">Enter a question prompt...</span>'}</div>
                ${mediaHtml}
                ${renderTypePreview(q)}
            </div>`;
    }

    function renderTypePreview(q) {
        switch (q.type) {
            case 'multiple-choice': return renderMCPreview(q);
            case 'true-false': return renderTFPreview(q);
            case 'fill-blank': return renderFBPreview(q);
            case 'matching': return renderMatchPreview(q);
            case 'unjumble-words': return renderUWPreview(q);
            case 'unjumble-letters': return renderULPreview(q);
            case 'drag-drop-category': return renderDDPreview(q);
            default: return '';
        }
    }

    function renderMCPreview(q) {
        return `<div class="preview-options">
            ${q.options.map((opt, i) => {
            const img = q.optionImages && q.optionImages[i]
                ? `<img src="${q.optionImages[i]}" style="max-height:40px;border-radius:4px;margin-right:6px;vertical-align:middle;" />`
                : '';
            return `
                <div class="preview-option ${q.correctAnswer === i ? 'correct-answer' : ''}">
                    <span class="option-letter">${LETTERS[i]}</span>
                    <span>${img}${escapeHtml(opt) || '<span style="color:#ccc;">—</span>'}</span>
                </div>`;
        }).join('')}
        </div>`;
    }

    function renderTFPreview(q) {
        return `<div class="preview-tf">
            <div class="preview-tf-btn ${q.correctAnswer === 0 ? 'correct-answer' : ''}">
                <i class="fa-solid fa-check" style="margin-right:6px;"></i> True
            </div>
            <div class="preview-tf-btn ${q.correctAnswer === 1 ? 'correct-answer' : ''}">
                <i class="fa-solid fa-xmark" style="margin-right:6px;"></i> False
            </div>
        </div>`;
    }

    function renderFBPreview(q) {
        let sentence = escapeHtml(q.sentence || '');
        let blankIdx = 0;
        sentence = sentence.replace(/___/g, () => {
            const answer = q.blanks[blankIdx] || '?';
            blankIdx++;
            return `<span class="preview-blank-slot">${escapeHtml(answer)}</span>`;
        });
        return `<div class="preview-fill-blank">${sentence}</div>`;
    }

    function renderMatchPreview(q) {
        return `<div class="preview-matching">
            <div class="preview-match-col">
                ${q.pairs.map((p, i) => {
            const img = q.pairImages && q.pairImages[i]
                ? `<img src="${q.pairImages[i]}" style="max-height:30px;border-radius:4px;margin-right:4px;vertical-align:middle;" />`
                : '';
            return `<div class="preview-match-item">${img}${escapeHtml(p.left) || '—'}</div>`;
        }).join('')}
            </div>
            <div class="preview-match-col">
                ${q.pairs.map(p => `<div class="preview-match-item">${escapeHtml(p.right) || '—'}</div>`).join('')}
            </div>
        </div>`;
    }

    function renderUWPreview(q) {
        if (!q.words || q.words.length === 0) {
            return '<div class="preview-empty" style="height:auto;padding:20px;"><p style="font-size:0.85rem;">Generate words from sentence to see preview</p></div>';
        }
        const shuffled = shuffleArray([...q.words]);
        return `<div class="preview-unjumble">
            ${shuffled.map(w => `<span class="preview-unjumble-chip">${escapeHtml(w)}</span>`).join('')}
        </div>`;
    }

    function renderULPreview(q) {
        if (!q.correctWord) {
            return '<div class="preview-empty" style="height:auto;padding:20px;"><p style="font-size:0.85rem;">Enter a word to see preview</p></div>';
        }
        const shuffled = shuffleString(q.correctWord);
        let html = `<div class="preview-unjumble">
            ${shuffled.split('').map(l => `<span class="preview-unjumble-chip">${l.toUpperCase()}</span>`).join('')}
        </div>`;
        if (q.hint) {
            html += `<div style="text-align:center;margin-top:12px;font-size:0.85rem;color:#888;font-style:italic;"><i class="fa-solid fa-lightbulb" style="margin-right:4px;"></i> Hint: ${escapeHtml(q.hint)}</div>`;
        }
        return html;
    }

    function renderDDPreview(q) {
        const allItems = q.categories.flatMap(c => c.items);
        return `
            <div class="preview-categories">
                ${q.categories.map(cat => `
                    <div class="preview-cat-box">
                        <div class="cat-title">${escapeHtml(cat.name) || 'Untitled'}</div>
                        <div class="preview-cat-items">
                            ${cat.items.map(it => {
            const hasImg = q.itemImages && q.itemImages[it];
            if (hasImg) {
                return `<div class="preview-cat-item-chip tt-dd-card">
                    <div class="tt-dd-img-wrap">
                        <img src="${q.itemImages[it]}" class="tt-dd-card-img" />
                    </div>
                    <span class="tt-dd-text">${escapeHtml(it)}</span>
                </div>`;
            }
            return `<span class="preview-cat-item-chip">${escapeHtml(it)}</span>`;
        }).join('')}
                            ${cat.items.length === 0 ? '<span style="color:#ccc;font-size:0.8rem;">Drop items here</span>' : ''}
                        </div>
                    </div>`).join('')}
            </div>
            ${allItems.length > 0 ? `
                <div style="margin-top:12px;">
                    <div style="font-size:0.75rem;color:#888;font-weight:600;margin-bottom:6px;text-transform:uppercase;">Items to sort:</div>
                    <div class="preview-unjumble">
                        ${shuffleArray([...allItems]).map(it => {
            const hasImg = q.itemImages && q.itemImages[it];
            if (hasImg) {
                return `<div class="preview-unjumble-chip tt-dd-card">
                    <div class="tt-dd-img-wrap">
                        <img src="${q.itemImages[it]}" class="tt-dd-card-img" />
                    </div>
                    <span class="tt-dd-text">${escapeHtml(it)}</span>
                </div>`;
            }
            return `<span class="preview-unjumble-chip">${escapeHtml(it)}</span>`;
        }).join('')}
                    </div>
                </div>` : ''}`;
    }

    // ===== SETTINGS =====
    function openSettings() {
        const s = testData.settings;
        dom.testTitleInput.value = testData.title;
        dom.testDescInput.value = testData.description;
        dom.timeLimitInput.value = s.timeLimit || '';
        dom.shuffleQuestionsToggle.checked = s.shuffleQuestions;
        dom.shuffleOptionsToggle.checked = s.shuffleOptions;
        dom.showResultsToggle.checked = s.showResults;
        dom.allowRetakeToggle.checked = s.allowRetake;
        dom.collectNameToggle.checked = s.collectName;
        dom.collectGroupToggle.checked = s.collectGroup;
        dom.fullscreenToggle.checked = s.enableFullscreen;
        dom.allowThemesToggle.checked = s.allowThemes;
        dom.showAnswerReviewToggle.checked = s.showAnswerReview;
        if (dom.partialGradingToggle) dom.partialGradingToggle.checked = s.partialGradingDragDrop;
        renderGroupPills();
        dom.settingsOverlay.classList.add('active');
    }

    function closeSettings() {
        dom.settingsOverlay.classList.remove('active');
        dom.headerTitle.textContent = testData.title;
        autoSave();
    }

    function renderGroupPills() {
        dom.groupPills.innerHTML = testData.settings.groupOptions.map((g, i) => `
            <span class="group-pill">${escapeHtml(g)}<button class="remove-group" data-index="${i}"><i class="fa-solid fa-xmark"></i></button></span>
        `).join('');

        dom.groupPills.querySelectorAll('.remove-group').forEach(btn => {
            btn.addEventListener('click', () => {
                testData.settings.groupOptions.splice(parseInt(btn.dataset.index), 1);
                renderGroupPills();
                autoSave();
            });
        });
    }

    function addGroup() {
        const val = dom.addGroupInput.value.trim();
        if (val && !testData.settings.groupOptions.includes(val)) {
            testData.settings.groupOptions.push(val);
            dom.addGroupInput.value = '';
            renderGroupPills();
            autoSave();
        }
    }

    // ===== PERSISTENCE =====
    let saveTimeout = null;
    function autoSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => saveTest(), 800);
    }

    function saveTest() {
        testData.updatedAt = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(testData));
    }

    // ===== TOAST =====
    function showToast(msg) {
        dom.toast.textContent = msg;
        dom.toast.classList.add('show');
        setTimeout(() => dom.toast.classList.remove('show'), 2000);
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

    function shuffleString(str) {
        return shuffleArray(str.split('')).join('');
    }

    // ===== SHARING =====
    let currentShareCode = null;

    // Restore share code from localStorage on load
    try {
        const savedCode = localStorage.getItem('lastPublishedCode');
        if (savedCode) currentShareCode = savedCode;
    } catch (e) { }

    async function openShareModal() {
        if (testData.questions.length === 0) {
            showToast('Add at least one question before sharing');
            return;
        }

        dom.shareOverlay.classList.add('active');
        dom.shareContentLoading.style.display = 'block';
        dom.shareContentReady.style.display = 'none';

        try {
            await FirebaseService.init();

            let code;
            if (currentShareCode) {
                // Reuse existing code — update the test data in place
                code = currentShareCode;
                await FirebaseService.updatePublishedTest(code, testData);
            } else {
                // First time sharing — publish and get a new code
                code = await FirebaseService.publishTest(testData);
                currentShareCode = code;
                try { localStorage.setItem('lastPublishedCode', code); } catch (e) { }
            }

            // Show share info
            dom.shareCodeDisplay.textContent = code;
            const baseUrl = window.location.origin + window.location.pathname.replace('test-builder.html', 'take-test.html');
            const fullUrl = baseUrl + '?code=' + code;
            dom.shareUrl.value = fullUrl;

            // Generate QR code on canvas
            generateQR(dom.shareQr, fullUrl);

            dom.shareContentLoading.style.display = 'none';
            dom.shareContentReady.style.display = 'block';

            showToast(currentShareCode ? 'Test updated!' : 'Test published!');
        } catch (err) {
            console.error('Publish error:', err);
            showToast('Error publishing test');
            closeShareModal();
        }
    }

    function closeShareModal() {
        dom.shareOverlay.classList.remove('active');
    }

    async function deactivateSharedTest() {
        if (!currentShareCode) return;
        try {
            await FirebaseService.deactivateTest(currentShareCode);
            currentShareCode = null;
            try { localStorage.removeItem('lastPublishedCode'); } catch (e) { }
            showToast('Test deactivated');
            closeShareModal();
        } catch (err) {
            showToast('Error deactivating test');
        }
    }

    // Simple QR code generator using canvas (basic version)
    function generateQR(canvas, text) {
        // Use a simple data URL approach: encode as a visual code grid
        // For a production app, use a library like qrcode.js
        // For now, display the code text visually on the canvas
        const ctx = canvas.getContext('2d');
        const size = 180;
        canvas.width = size;
        canvas.height = size;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = 'var(--indigo-velvet)';
        ctx.fillStyle = '#2c1f56';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Scan to take test', size / 2, 30);
        ctx.font = 'bold 36px monospace';
        ctx.fillText(text.slice(-6), size / 2, size / 2 + 10);
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#888';
        const wrapped = text.length > 30 ? text.substr(0, 28) + '...' : text;
        ctx.fillText(wrapped, size / 2, size - 20);

        // Draw a border
        ctx.strokeStyle = '#e0e2e8';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, size - 2, size - 2);
    }

    // ===== MEDIA UPLOAD =====
    function renderMediaEditor(q) {
        let preview = '';
        if (q.media && q.media.data) {
            if (q.media.type === 'image') {
                preview = `
                    <div class="media-preview">
                        <img src="${q.media.data}" alt="Uploaded" />
                        <div class="media-info">
                            <span class="media-filename"><i class="fa-solid fa-image"></i> ${escapeHtml(q.media.filename)}</span>
                            <button class="media-remove" id="btn-remove-media"><i class="fa-solid fa-trash"></i> Remove</button>
                        </div>
                    </div>`;
            } else if (q.media.type === 'audio') {
                preview = `
                    <div class="media-preview">
                        <audio controls src="${q.media.data}" style="width:100%;"></audio>
                        <div class="media-info">
                            <span class="media-filename"><i class="fa-solid fa-music"></i> ${escapeHtml(q.media.filename)}</span>
                            <button class="media-remove" id="btn-remove-media"><i class="fa-solid fa-trash"></i> Remove</button>
                        </div>
                    </div>`;
            }
        }
        return `
            ${preview}
            <div class="media-upload-area" id="media-upload-area">
                <input type="file" id="media-file-input" accept="image/*,audio/*" style="display:none;" />
                <button class="btn-add-option" id="btn-upload-media" style="width:100%;">
                    <i class="fa-solid fa-cloud-arrow-up"></i> Upload image or audio
                </button>
                <p style="font-size:0.75rem;color:#aaa;margin-top:6px;text-align:center;">Images resized to max 800px. Audio up to 2MB.</p>
            </div>`;
    }

    function bindMediaEditor(q) {
        const fileInput = document.getElementById('media-file-input');
        const uploadBtn = document.getElementById('btn-upload-media');
        const removeBtn = document.getElementById('btn-remove-media');

        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => fileInput.click());
        }

        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                if (file.type.startsWith('image/')) {
                    try {
                        const base64 = await compressImage(file, 800, 0.8);
                        q.media = { type: 'image', data: base64, filename: file.name };
                        renderEditor();
                        renderPreview();
                        autoSave();
                        showToast('Image uploaded!');
                    } catch (err) {
                        showToast('Error processing image');
                    }
                } else if (file.type.startsWith('audio/')) {
                    if (file.size > 2 * 1024 * 1024) {
                        showToast('Audio file too large (max 2MB)');
                        return;
                    }
                    try {
                        const base64 = await fileToBase64(file);
                        q.media = { type: 'audio', data: base64, filename: file.name };
                        renderEditor();
                        renderPreview();
                        autoSave();
                        showToast('Audio uploaded!');
                    } catch (err) {
                        showToast('Error processing audio');
                    }
                } else {
                    showToast('Unsupported file type');
                }
            });
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                q.media = null;
                renderEditor();
                renderPreview();
                autoSave();
                showToast('Media removed');
            });
        }
    }

    function compressImage(file, maxWidth, quality) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width;
                    let h = img.height;
                    if (w > maxWidth) {
                        h = Math.round(h * maxWidth / w);
                        w = maxWidth;
                    }
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ===== GOOGLE DRIVE =====
    let driveService = null;

    function initGoogleDrive() {
        const driveBtn = document.getElementById('btn-google-drive');
        if (!driveBtn) return;
        if (typeof GoogleDriveService === 'undefined') return;

        driveService = new GoogleDriveService({
            folderName: 'ESL - Quiz Builder',
            fileExtension: '.quiz.json',
            onSave: () => testData,
            onLoad: (data, filename) => {
                Object.assign(testData, data);
                renderSidebar();
                if (testData.questions.length > 0) {
                    selectQuestion(0);
                } else {
                    renderEditorEmpty();
                    renderPreviewEmpty();
                }
                showToast('Quiz loaded: ' + (filename || 'Untitled'));
            },
            onNotify: (msg, type) => showToast(msg)
        });

        driveBtn.addEventListener('click', () => driveService.openModal());
    }

    // ===== RESPONSE DASHBOARD (Phase 4) =====
    let responsesData = {};      // { responseId: responseObj }
    let responsesUnsubscribe = null;
    let responsesPollInterval = null;
    let responsesCode = null;    // the active share code being monitored

    function initResponsesDom() {
        dom.btnResponses = document.getElementById('btn-responses');
        dom.responsesOverlay = document.getElementById('responses-overlay');
        dom.btnCloseResponses = document.getElementById('btn-close-responses');
        dom.responseBadge = document.getElementById('response-badge');
        dom.btnExportCsv = document.getElementById('btn-export-csv');
        dom.statCount = document.getElementById('stat-count');
        dom.statAvgScore = document.getElementById('stat-avg-score');
        dom.statAvgTime = document.getElementById('stat-avg-time');
        dom.statViolations = document.getElementById('stat-violations');
        dom.qBreakdown = document.getElementById('q-breakdown');
        dom.qAccuracyBars = document.getElementById('q-accuracy-bars');
        dom.responsesEmpty = document.getElementById('responses-empty');
        dom.responsesTable = document.getElementById('responses-table');
        dom.responsesTbody = document.getElementById('responses-tbody');

        dom.btnResponses.addEventListener('click', openResponsesModal);
        dom.btnCloseResponses.addEventListener('click', closeResponsesModal);
        dom.responsesOverlay.addEventListener('click', (e) => {
            if (e.target === dom.responsesOverlay) closeResponsesModal();
        });
        dom.btnExportCsv.addEventListener('click', exportCsv);
    }

    async function openResponsesModal() {
        dom.responsesOverlay.classList.add('active');

        // Restore share code from localStorage if lost (e.g. page reload)
        if (!currentShareCode) {
            try { currentShareCode = localStorage.getItem('lastPublishedCode') || null; } catch (e) { }
        }

        if (currentShareCode && currentShareCode !== responsesCode) {
            responsesCode = currentShareCode;
            responsesData = {};
            startResponseListener(responsesCode);
        } else if (currentShareCode && currentShareCode === responsesCode) {
            // Already listening — just re-render what we have
            renderResponsesTable();
        } else {
            // No share code at all
            renderResponsesTable();
        }
    }

    function closeResponsesModal() {
        dom.responsesOverlay.classList.remove('active');
    }

    function startResponseListener(code) {
        // Clean up any existing listener
        if (responsesUnsubscribe) { responsesUnsubscribe(); responsesUnsubscribe = null; }
        if (responsesPollInterval) { clearInterval(responsesPollInterval); responsesPollInterval = null; }

        try {
            // Use onNewResponse for real-time updates
            responsesUnsubscribe = FirebaseService.onNewResponse(code, (id, response) => {
                responsesData[id] = response;
                renderResponsesTable();
                updateResponseBadge();
            });
        } catch (e) {
            // Fallback: poll every 5 seconds
            const poll = async () => {
                try {
                    const test = await FirebaseService.getPublishedTest(code);
                    if (test && test.responses) {
                        responsesData = test.responses;
                        renderResponsesTable();
                        updateResponseBadge();
                    }
                } catch (err) { /* silent */ }
            };
            poll();
            responsesPollInterval = setInterval(poll, 5000);
        }
    }

    function renderResponsesTable() {
        const responses = Object.values(responsesData);

        if (responses.length === 0) {
            dom.responsesEmpty.style.display = 'flex';
            dom.responsesTable.style.display = 'none';
            dom.qBreakdown.style.display = 'none';
            updateStats([]);
            return;
        }

        dom.responsesEmpty.style.display = 'none';
        dom.responsesTable.style.display = 'table';

        updateStats(responses);
        renderAccuracyBars(responses);

        dom.responsesTbody.innerHTML = responses
            .sort((a, b) => b.submittedAt - a.submittedAt)
            .map((r, i) => {
                const pct = r.totalPoints > 0 ? Math.round((r.score / r.totalPoints) * 100) : 0;
                const scoreClass = pct >= 80 ? 'score-high' : pct >= 50 ? 'score-mid' : 'score-low';
                const vc = r.violationCount || 0;
                const violClass = vc === 0 ? 'viol-0' : vc <= 2 ? `viol-${vc}` : 'viol-high';
                const dur = r.durationSeconds ? formatDuration(r.durationSeconds) : '—';
                const submitted = r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—';

                return `<tr>
                    <td>${responses.length - i}</td>
                    <td>${esc(r.studentName || '—')}</td>
                    <td>${esc(r.studentGroup || '—')}</td>
                    <td class="score-cell ${scoreClass}">${r.score ?? 0}/${r.totalPoints ?? 0} (${pct}%)</td>
                    <td>${dur}</td>
                    <td><span class="viol-badge ${violClass}">${vc}</span></td>
                    <td style="font-size:0.8rem;color:#888;">${submitted}</td>
                </tr>`;
            }).join('');
    }

    function updateStats(responses) {
        const n = responses.length;
        dom.statCount.textContent = n;

        if (n === 0) {
            dom.statAvgScore.textContent = '—';
            dom.statAvgTime.textContent = '—';
            dom.statViolations.textContent = '0';
            return;
        }

        const avgPct = Math.round(responses.reduce((s, r) => {
            return s + (r.totalPoints > 0 ? (r.score / r.totalPoints) * 100 : 0);
        }, 0) / n);
        dom.statAvgScore.textContent = avgPct + '%';

        const withTime = responses.filter(r => r.durationSeconds);
        if (withTime.length > 0) {
            const avgSec = Math.round(withTime.reduce((s, r) => s + r.durationSeconds, 0) / withTime.length);
            dom.statAvgTime.textContent = formatDuration(avgSec);
        } else {
            dom.statAvgTime.textContent = '—';
        }

        const totalViolations = responses.reduce((s, r) => s + (r.violationCount || 0), 0);
        dom.statViolations.textContent = totalViolations;
    }

    function renderAccuracyBars(responses) {
        if (!testData.questions.length || responses.length === 0) {
            dom.qBreakdown.style.display = 'none';
            return;
        }

        dom.qBreakdown.style.display = 'block';

        const bars = testData.questions.map((q, qi) => {
            let correctCount = 0;
            responses.forEach(r => {
                if (r.answers && r.answers[qi] && r.answers[qi].correct) correctCount++;
            });
            const pct = Math.round((correctCount / responses.length) * 100);
            const color = pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171';

            return `<div class="q-accuracy-item">
                <span class="q-acc-pct">${pct}%</span>
                <div class="q-acc-bar-wrap">
                    <div class="q-acc-bar-fill" style="height:${pct}%;background:${color};"></div>
                </div>
                <span class="q-acc-label">Q${qi + 1}</span>
            </div>`;
        }).join('');

        dom.qAccuracyBars.innerHTML = bars;
    }

    function updateResponseBadge() {
        const n = Object.keys(responsesData).length;
        if (n > 0) {
            dom.responseBadge.textContent = n;
            dom.responseBadge.style.display = 'inline-block';
        } else {
            dom.responseBadge.style.display = 'none';
        }
    }

    function formatDuration(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    }

    function esc(text) {
        if (!text) return '';
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    function exportCsv() {
        const responses = Object.values(responsesData);
        if (responses.length === 0) { showToast('No responses to export'); return; }

        const headers = [
            'Name', 'Group', 'Score', 'Max Score', 'Percentage',
            'Time (s)', 'Started At', 'Completed At', 'Violations', 'Submitted At'
        ];

        // Add per-question headers
        testData.questions.forEach((q, i) => {
            headers.push(`Q${i + 1} Correct`);
        });

        const rows = responses.map(r => {
            const pct = r.totalPoints > 0 ? Math.round((r.score / r.totalPoints) * 100) : 0;
            const row = [
                `"${(r.studentName || '').replace(/"/g, '""')}"`,
                `"${(r.studentGroup || '').replace(/"/g, '""')}"`,
                r.score ?? 0,
                r.totalPoints ?? 0,
                pct + '%',
                r.durationSeconds ?? '',
                r.startedAt ? new Date(r.startedAt).toISOString() : '',
                r.completedAt ? new Date(r.completedAt).toISOString() : '',
                r.violationCount ?? 0,
                r.submittedAt ? new Date(r.submittedAt).toISOString() : ''
            ];

            // Per-question correctness
            testData.questions.forEach((q, i) => {
                const ans = r.answers && r.answers[i];
                row.push(ans && ans.correct ? 1 : 0);
            });

            return row.join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${(testData.title || 'test').replace(/[^a-z0-9]/gi, '_')}_responses.csv`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('CSV exported!');
    }

    // ===== PUBLIC API =====
    return { init };
})();


// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    TestBuilder.init();
});
