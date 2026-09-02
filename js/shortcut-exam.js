/**
 * Standalone Keyboard Shortcut Exam
 * Uses the published-test Firebase path without adding a Test Builder question type.
 */
const ShortcutExam = (() => {
    'use strict';

    const TARGET_SHORTCUTS = 10;
    const VIRTUAL_KEY_IDLE_MS = 4000;
    const DEFAULT_GROUPS = ['3A', '3B', '3C', '4A', '4B', '4C', '5A', '5B', '5C', '5D'];
    const STUDENT_DATA = typeof STUDENT_GROUPS !== 'undefined' ? STUDENT_GROUPS : {};
    const EXAM_SESSION_REGISTRY_KEY = 'shortcut_exam_sessions';

    /*
     * PLACEHOLDER CONTENT FOR TEACHER REVIEW BEFORE REAL USE.
     * These function questions are intentionally local to the standalone exam until
     * a teacher-reviewed question bank is available.
     */
    const FUNCTION_PROMPT = 'What is the function of this shortcut?';
    const OPTION_ICONS = {
        'Copy': 'fa-copy',
        'Cut': 'fa-scissors',
        'Paste': 'fa-paste',
        'Undo': 'fa-rotate-left',
        'Redo': 'fa-rotate-right',
        'Select All': 'fa-object-group',
        'Save': 'fa-floppy-disk',
        'Print': 'fa-print',
        'Bold': 'fa-bold',
        'Italic': 'fa-italic',
        'Underline': 'fa-underline',
        'Align Left': 'fa-align-left',
        'Center': 'fa-align-center',
        'Align Right': 'fa-align-right',
        'Find': 'fa-magnifying-glass',
        'Refresh': 'fa-arrows-rotate',
        'Hard Refresh': 'fa-bolt',
        'Zoom In': 'fa-magnifying-glass-plus',
        'Zoom Out': 'fa-magnifying-glass-minus',
        'Reset Zoom': 'fa-compress',
        'Delete': 'fa-trash',
        'Close': 'fa-rectangle-xmark',
        'Duplicate': 'fa-clone',
        'New': 'fa-file-circle-plus',
        'Repeat': 'fa-repeat',
        'End': 'fa-forward-step',
        'New Page': 'fa-file',
        'Explorer': 'fa-folder-tree',
        'Reopen': 'fa-window-restore',
        'New Window': 'fa-window-maximize',
        'Select Line': 'fa-i-cursor',
        'Clear': 'fa-eraser',
        'Move Down': 'fa-arrow-down',
        'Open': 'fa-folder-open',
        'Fullscreen': 'fa-expand',
        'Replace': 'fa-right-left',
        'History': 'fa-clock-rotate-left',
        'Restart': 'fa-power-off',
        'Back': 'fa-arrow-left',
        'Lock': 'fa-lock',
        'Select': 'fa-check'
    };
    const PLACEHOLDER_FUNCTION_QUESTIONS = {
        copy: {
            prompt: FUNCTION_PROMPT,
            options: ['Copy [Copiar]', 'Delete [Eliminar]', 'Close [Cerrar]', 'Center [Centrar]'],
            correctIndex: 0
        },
        cut: {
            prompt: FUNCTION_PROMPT,
            options: ['Duplicate [Duplicar]', 'Cut [Cortar]', 'Underline [Subrayar]', 'New [Nuevo]'],
            correctIndex: 1
        },
        paste: {
            prompt: FUNCTION_PROMPT,
            options: ['Print [Imprimir]', 'Select All [Seleccionar todo]', 'Paste [Pegar]', 'Repeat [Repetir]'],
            correctIndex: 2
        },
        undo: {
            prompt: FUNCTION_PROMPT,
            options: ['Save [Guardar]', 'Undo [Deshacer]', 'Close [Cerrar]', 'Zoom Out [Alejar]'],
            correctIndex: 1
        },
        redo: {
            prompt: FUNCTION_PROMPT,
            options: ['Redo [Rehacer]', 'Refresh [Actualizar]', 'Copy [Copiar]', 'End [Final]'],
            correctIndex: 0
        },
        'select-all': {
            prompt: FUNCTION_PROMPT,
            options: ['Align Left [Izquierda]', 'Save [Guardar]', 'Select All [Seleccionar todo]', 'New Page [Página nueva]'],
            correctIndex: 2
        },
        save: {
            prompt: FUNCTION_PROMPT,
            options: ['Find [Buscar]', 'Save [Guardar]', 'Bold [Negrita]', 'Print [Imprimir]'],
            correctIndex: 1
        },
        print: {
            prompt: FUNCTION_PROMPT,
            options: ['Print [Imprimir]', 'Paste [Pegar]', 'Refresh [Actualizar]', 'Explorer [Explorador]'],
            correctIndex: 0
        },
        bold: {
            prompt: FUNCTION_PROMPT,
            options: ['Italic [Cursiva]', 'Center [Centrar]', 'Bold [Negrita]', 'Delete [Eliminar]'],
            correctIndex: 2
        },
        italic: {
            prompt: FUNCTION_PROMPT,
            options: ['Italic [Cursiva]', 'Zoom In [Acercar]', 'Select All [Seleccionar todo]', 'Align Right [Derecha]'],
            correctIndex: 0
        },
        underline: {
            prompt: FUNCTION_PROMPT,
            options: ['Reopen [Reabrir]', 'Underline [Subrayar]', 'Undo [Deshacer]', 'New Window [Ventana nueva]'],
            correctIndex: 1
        },
        'align-left': {
            prompt: FUNCTION_PROMPT,
            options: ['Align Left [Izquierda]', 'Bold [Negrita]', 'Zoom Out [Alejar]', 'Select Line [Seleccionar línea]'],
            correctIndex: 0
        },
        'align-center': {
            prompt: FUNCTION_PROMPT,
            options: ['Align Right [Derecha]', 'Center [Centrar]', 'Copy [Copiar]', 'Clear [Borrar]'],
            correctIndex: 1
        },
        'align-right': {
            prompt: FUNCTION_PROMPT,
            options: ['Refresh [Actualizar]', 'Center [Centrar]', 'Align Right [Derecha]', 'Move Down [Bajar]'],
            correctIndex: 2
        },
        'new-tab': {
            prompt: FUNCTION_PROMPT,
            options: ['Open New Tab [Abrir pestaña nueva]', 'Close Tab [Cerrar pestaña]', 'History [Historial]', 'Refresh [Actualizar]'],
            correctIndex: 0
        },
        'close-tab': {
            prompt: FUNCTION_PROMPT,
            options: ['Open New Window [Abrir ventana nueva]', 'Close Tab [Cerrar pestaña]', 'Lock Computer [Bloquear computador]', 'Find [Buscar]'],
            correctIndex: 1
        },
        'new-window': {
            prompt: FUNCTION_PROMPT,
            options: ['Reopen Closed Tab [Reabrir pestaña cerrada]', 'Open Private Window [Abrir ventana privada]', 'Open New Window [Abrir ventana nueva]', 'Show Desktop [Mostrar escritorio]'],
            correctIndex: 2
        },
        'reopen-tab': {
            prompt: FUNCTION_PROMPT,
            options: ['Close App [Cerrar aplicación]', 'Reopen Closed Tab [Reabrir pestaña cerrada]', 'Open New Tab [Abrir pestaña nueva]', 'History [Historial]'],
            correctIndex: 1
        },
        history: {
            prompt: FUNCTION_PROMPT,
            options: ['View History [Ver historial]', 'Open File Explorer [Abrir explorador de archivos]', 'Refresh [Actualizar]', 'Close Tab [Cerrar pestaña]'],
            correctIndex: 0
        },
        'private-window': {
            prompt: FUNCTION_PROMPT,
            options: ['Open New Window [Abrir ventana nueva]', 'Switch Apps [Cambiar aplicaciones]', 'Open Private Window [Abrir ventana privada]', 'Lock Computer [Bloquear computador]'],
            correctIndex: 2
        },
        'switch-app': {
            prompt: FUNCTION_PROMPT,
            options: ['Show Desktop [Mostrar escritorio]', 'Switch Apps [Cambiar aplicaciones]', 'Close App [Cerrar aplicación]', 'Open File Explorer [Abrir explorador de archivos]'],
            correctIndex: 1
        },
        'show-desktop': {
            prompt: FUNCTION_PROMPT,
            options: ['Lock Computer [Bloquear computador]', 'Open New Window [Abrir ventana nueva]', 'Show Desktop [Mostrar escritorio]', 'Switch Apps [Cambiar aplicaciones]'],
            correctIndex: 2
        },
        'file-explorer': {
            prompt: FUNCTION_PROMPT,
            options: ['Open File Explorer [Abrir explorador de archivos]', 'View History [Ver historial]', 'Open Private Window [Abrir ventana privada]', 'Find [Buscar]'],
            correctIndex: 0
        },
        'close-app': {
            prompt: FUNCTION_PROMPT,
            options: ['Close Tab [Cerrar pestaña]', 'Show Desktop [Mostrar escritorio]', 'Close App [Cerrar aplicación]', 'Lock Computer [Bloquear computador]'],
            correctIndex: 2
        },
        'lock-computer': {
            prompt: FUNCTION_PROMPT,
            options: ['Switch Apps [Cambiar aplicaciones]', 'Lock Computer [Bloquear computador]', 'Close App [Cerrar aplicación]', 'Open File Explorer [Abrir explorador de archivos]'],
            correctIndex: 1
        },
        find: {
            prompt: FUNCTION_PROMPT,
            options: ['Find [Buscar]', 'Open [Abrir]', 'Fullscreen [Pantalla completa]', 'Replace [Reemplazar]'],
            correctIndex: 0
        },
        refresh: {
            prompt: FUNCTION_PROMPT,
            options: ['Reset Zoom [Restablecer zoom]', 'Refresh [Actualizar]', 'History [Historial]', 'Save [Guardar]'],
            correctIndex: 1
        },
        'hard-refresh': {
            prompt: FUNCTION_PROMPT,
            options: ['Hard Refresh [Recarga forzada]', 'Restart [Reiniciar]', 'Back [Atrás]', 'Lock [Bloquear]'],
            correctIndex: 0
        },
        'zoom-in': {
            prompt: FUNCTION_PROMPT,
            options: ['Zoom Out [Alejar]', 'Reset Zoom [Restablecer zoom]', 'Zoom In [Acercar]', 'Fullscreen [Pantalla completa]'],
            correctIndex: 2
        },
        'zoom-out': {
            prompt: FUNCTION_PROMPT,
            options: ['Zoom Out [Alejar]', 'Refresh [Actualizar]', 'Cut [Cortar]', 'Italic [Cursiva]'],
            correctIndex: 0
        },
        'reset-zoom': {
            prompt: FUNCTION_PROMPT,
            options: ['Reset Zoom [Restablecer zoom]', 'Close [Cerrar]', 'Select [Seleccionar]', 'Clear [Borrar]'],
            correctIndex: 0
        },
        fullscreen: {
            prompt: FUNCTION_PROMPT,
            options: ['Fullscreen [Pantalla completa]', 'Refresh [Actualizar]', 'Zoom In [Acercar]', 'Print [Imprimir]'],
            correctIndex: 0
        }
    };

    let testCode = '';
    let testData = null;
    let eligibleShortcuts = [];
    let selectedGroup = '';
    let selectedStudents = [];
    let highlightedStudentIndex = -1;
    let studentName = '';
    let studentGroup = '';

    let examActive = false;
    let examLocked = false;
    let resumeRequested = false;
    let ambientEnabled = false;
    let modalOpen = false;
    let currentShortcut = null;
    let currentResult = null;
    let shortcutResults = [];
    let creditedIds = new Set();
    let exitCount = 0;
    let submitInProgress = false;
    let suppressFullscreenLock = false;
    let suppressExitUntil = 0;
    let leavePromptOpen = false;
    let allowUnload = false;
    let virtualKeyboardOpen = false;
    let virtualActiveKeys = new Set();
    let virtualKeyIdleTimer = null;

    let timeRemainingMs = 0;
    let timerDeadline = 0;
    let timerInterval = null;
    let toastTimer = null;

    const $ = (id) => document.getElementById(id);

    function init() {
        const darkToggle = document.getElementById('dark-mode-toggle');
        const container = $('shortcut-exam-container');
        if (darkToggle && container) container.appendChild(darkToggle);

        eligibleShortcuts = buildEligibleShortcuts();
        ShortcutsData.renderVirtualKeyboard($('exam-virtual-keyboard'), {
            paletteClass: 'keyboard--palette-gold-black',
            includeNumpad: false
        });
        bindVirtualKeyboardKeys();
        bindStaticEvents();

        if (eligibleShortcuts.length < TARGET_SHORTCUTS) {
            showError('Shortcut Data Error', `At least ${TARGET_SHORTCUTS} eligible shortcuts are required.`);
            return;
        }

        const rawCode = new URLSearchParams(window.location.search).get('code');
        if (!rawCode) {
            showScreen('screen-create');
            return;
        }

        const normalizedCode = rawCode.trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
            showError('Exam Not Found', 'The exam link contains an invalid code.');
            return;
        }

        testCode = normalizedCode;
        loadExam();
    }

    function buildEligibleShortcuts() {
        if (!window.ShortcutsData || !Array.isArray(ShortcutsData.SHORTCUTS)) return [];

        return ShortcutsData.SHORTCUTS
            .filter((shortcut) => ShortcutsData.comboCapKeys(shortcut) !== null)
            .map((shortcut) => ({
                id: shortcut.id,
                keys: [...shortcut.keys],
                label: shortcut.label,
                inputChannel: ShortcutsData.isLiveFormatAllowed(shortcut) ? 'physical' : 'virtual',
                functionQuestion: PLACEHOLDER_FUNCTION_QUESTIONS[shortcut.id]
            }))
            .filter((shortcut) => {
                const question = shortcut.functionQuestion;
                return question && question.options.length === 4 &&
                    Number.isInteger(question.correctIndex) &&
                    question.correctIndex >= 0 && question.correctIndex < 4;
            });
    }

    function openVirtualKeyboard() {
        if (!examActive || examLocked || modalOpen || leavePromptOpen || submitInProgress) return;
        virtualKeyboardOpen = true;
        ambientEnabled = false;
        $('exam-content').inert = true;
        $('shortcut-exam-container').classList.add('virtual-keyboard-open');
        $('virtual-keyboard-panel').classList.add('open');
        $('virtual-keyboard-panel').setAttribute('aria-hidden', 'false');
        $('btn-virtual-keyboard').setAttribute('aria-expanded', 'true');
        $('btn-close-virtual-keyboard').focus();
    }

    function closeVirtualKeyboard(restoreInput = true) {
        clearVirtualKeySelection();
        virtualKeyboardOpen = false;
        $('virtual-keyboard-panel').classList.remove('open');
        $('virtual-keyboard-panel').setAttribute('aria-hidden', 'true');
        $('btn-virtual-keyboard').setAttribute('aria-expanded', 'false');
        $('shortcut-exam-container').classList.remove('virtual-keyboard-open');
        $('exam-content').inert = modalOpen;
        if (restoreInput && examActive && !examLocked && !modalOpen && !leavePromptOpen) {
            ambientEnabled = true;
            $('btn-virtual-keyboard').focus();
        }
    }

    function toggleVirtualKeyboard() {
        if (virtualKeyboardOpen) closeVirtualKeyboard();
        else openVirtualKeyboard();
    }

    function bindVirtualKeyboardKeys() {
        $('exam-virtual-keyboard').querySelectorAll('[data-key]').forEach((keyElement) => {
            keyElement.addEventListener('click', onVirtualKeyClick);
        });
    }

    function onVirtualKeyClick(event) {
        if (!examActive || !virtualKeyboardOpen || examLocked || modalOpen || submitInProgress) return;

        const key = String(event.currentTarget.dataset.key || '').toLowerCase();
        if (!key) return;

        const isActive = !virtualActiveKeys.has(key);
        if (isActive) virtualActiveKeys.add(key);
        else virtualActiveKeys.delete(key);
        setKeyActive(key, isActive);
        restartVirtualKeyIdleTimer();

        const matchedShortcut = eligibleShortcuts
            .filter((shortcut) => shortcut.inputChannel === 'virtual' && !creditedIds.has(shortcut.id))
            .find((shortcut) => {
                const expectedKeys = ShortcutsData.comboCapKeys(shortcut);
                return ShortcutsData.isComboCorrect([...virtualActiveKeys], expectedKeys);
            });

        if (!matchedShortcut) return;

        clearVirtualKeySelection();
        closeVirtualKeyboard();
        recordShortcutAttempt(matchedShortcut);
    }

    function setKeyActive(key, active) {
        $('exam-virtual-keyboard').querySelectorAll('[data-key]').forEach((keyElement) => {
            if (String(keyElement.dataset.key).toLowerCase() !== key) return;
            keyElement.classList.toggle('active', active);
            keyElement.setAttribute('aria-pressed', String(active));
        });
    }

    function restartVirtualKeyIdleTimer() {
        if (virtualKeyIdleTimer) clearTimeout(virtualKeyIdleTimer);
        virtualKeyIdleTimer = window.setTimeout(clearVirtualKeySelection, VIRTUAL_KEY_IDLE_MS);
    }

    function clearVirtualKeySelection() {
        if (virtualKeyIdleTimer) {
            clearTimeout(virtualKeyIdleTimer);
            virtualKeyIdleTimer = null;
        }
        virtualActiveKeys.clear();
        $('exam-virtual-keyboard').querySelectorAll('[data-key].active').forEach((keyElement) => {
            keyElement.classList.remove('active');
            keyElement.setAttribute('aria-pressed', 'false');
        });
    }

    function bindStaticEvents() {
        $('btn-create-session').addEventListener('click', createExamSession);
        $('btn-copy-url').addEventListener('click', copyStudentUrl);
        $('btn-start-test').addEventListener('click', handleStartClick);
        $('btn-retake-cancel').addEventListener('click', cancelRetake);
        $('btn-retake-continue').addEventListener('click', continueRetake);
        $('btn-dismiss-question').addEventListener('click', dismissFunctionQuestion);
        $('btn-resume-exam').addEventListener('click', handleResumeClick);
        $('btn-virtual-keyboard').addEventListener('click', toggleVirtualKeyboard);
        $('btn-close-virtual-keyboard').addEventListener('click', () => closeVirtualKeyboard());
        $('btn-stay-exam').addEventListener('click', dismissLeavePrompt);
        $('btn-leave-exam').addEventListener('click', confirmLeaveExam);
        $('btn-finish-test').addEventListener('click', () => finishExam('manual'));
        $('btn-change-theme').addEventListener('click', changeTheme);
        $('btn-close-result').addEventListener('click', () => window.close());

        document.addEventListener('keydown', onAmbientKeydown, true);
        document.addEventListener('fullscreenchange', onFullscreenChange);
        document.addEventListener('webkitfullscreenchange', onFullscreenChange);
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('blur', onWindowBlur);
        window.addEventListener('beforeunload', onBeforeUnload);
        document.addEventListener('contextmenu', onContextMenu);
        document.addEventListener('click', onDocumentClick);

        bindStudentSearch();
    }

    function showScreen(screenId) {
        document.querySelectorAll('.se-screen').forEach((screen) => {
            screen.style.display = screen.id === screenId ? 'flex' : 'none';
        });
    }

    function showError(title, message) {
        $('error-title').textContent = title;
        $('error-message').textContent = message;
        showScreen('screen-error');
    }

    async function createExamSession() {
        const input = $('time-limit-input');
        const minutes = Number(input.value);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
            input.focus();
            input.select();
            return;
        }

        const button = $('btn-create-session');
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';

        const createdAt = Date.now();
        const metadata = {
            title: 'Keyboard Shortcut Exam',
            description: 'Standalone keyboard shortcut demonstration exam',
            examType: 'keyboard-shortcut',
            createdAt,
            timeLimitMinutes: minutes
        };

        try {
            await FirebaseService.init();
            const code = await FirebaseService.publishTest(metadata);
            const studentUrl = buildStudentUrl(code);

            rememberExamSession(code, createdAt);
            $('session-code').textContent = code;
            $('session-url').value = studentUrl;
            renderQrCode(studentUrl);
            showScreen('screen-created');
        } catch (error) {
            console.error('[ShortcutExam] Session creation failed:', error);
            showError('Could Not Create Session', 'Check your connection and try again.');
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fa-solid fa-link"></i> Create Exam Session';
        }
    }

    function buildStudentUrl(code) {
        const url = new URL('shortcut-exam.html', window.location.href);
        url.search = '';
        url.hash = '';
        url.searchParams.set('code', code);
        return url.href;
    }

    function rememberExamSession(code, createdAt) {
        let sessions = [];
        try {
            sessions = JSON.parse(localStorage.getItem(EXAM_SESSION_REGISTRY_KEY)) || [];
        } catch (error) {
            sessions = [];
        }

        const entry = {
            id: `shortcut-exam-${code}`,
            title: 'Keyboard Shortcut Exam',
            shareCode: code,
            active: true,
            createdAt,
            updatedAt: createdAt,
            expiresAt: createdAt + (7 * 24 * 60 * 60 * 1000)
        };

        sessions = [entry, ...sessions.filter((session) => session.shareCode !== code)];
        try {
            localStorage.setItem(EXAM_SESSION_REGISTRY_KEY, JSON.stringify(sessions));
        } catch (error) {
            console.warn('[ShortcutExam] Could not save the local results shortcut:', error);
        }
    }

    function renderQrCode(url) {
        const container = $('session-qr');
        container.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            new QRCode(container, {
                text: url,
                width: 128,
                height: 128,
                colorDark: '#2d1b4e',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        } else {
            container.textContent = 'QR code unavailable';
        }
    }

    async function copyStudentUrl() {
        const input = $('session-url');
        let copied = false;
        try {
            await navigator.clipboard.writeText(input.value);
            copied = true;
        } catch (error) {
            input.select();
            copied = document.execCommand('copy');
        }
        $('copy-status').textContent = copied ? 'Link copied.' : 'Select and copy the link above.';
    }

    async function loadExam() {
        try {
            await FirebaseService.init();
            const data = await FirebaseService.getPublishedTest(testCode);

            if (!data) {
                showError('Exam Not Found', 'This exam code does not exist.');
                return;
            }
            if (data.active === false) {
                showError('Exam Closed', 'This exam session has been deactivated.');
                return;
            }
            if (data.expiresAt && data.expiresAt < Date.now()) {
                showError('Exam Expired', 'This exam session has expired.');
                return;
            }

            const timeLimitMinutes = Number(data.timeLimitMinutes);
            if (!Number.isFinite(timeLimitMinutes) || timeLimitMinutes <= 0) {
                showError('Invalid Exam Session', 'This session does not contain a valid time limit.');
                return;
            }

            testData = data;
            testData.timeLimitMinutes = timeLimitMinutes;
            showStudentScreen();
        } catch (error) {
            console.error('[ShortcutExam] Exam load failed:', error);
            showError('Could Not Load Exam', 'Check your connection and try the link again.');
        }
    }

    function showStudentScreen() {
        selectedGroup = '';
        selectedStudents = [];
        highlightedStudentIndex = -1;
        $('test-title-display').textContent = testData.title || 'Keyboard Shortcut Exam';
        $('info-time').innerHTML = `<i class="fa-solid fa-clock"></i> ${testData.timeLimitMinutes} min`;
        $('student-name-search').value = '';
        $('student-name-search').disabled = true;
        $('student-name-search').placeholder = 'First select your group above...';
        $('selected-students').innerHTML = '';
        $('student-autocomplete').className = 'tt-autocomplete-dropdown';

        const selector = $('group-selector');
        selector.innerHTML = '';
        DEFAULT_GROUPS.forEach((group) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'tt-group-pill';
            button.dataset.group = group;
            button.textContent = group;
            button.addEventListener('click', () => selectGroup(button, group));
            selector.appendChild(button);
        });

        $('btn-start-test').disabled = false;
        showScreen('screen-student');
    }

    function bindStudentSearch() {
        const searchInput = $('student-name-search');
        const dropdown = $('student-autocomplete');

        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toLocaleLowerCase();
            if (!query) {
                closeStudentDropdown();
                return;
            }

            const candidates = STUDENT_DATA[selectedGroup] || [];
            const matches = candidates
                .filter((name) => !selectedStudents.includes(name))
                .filter((name) => name.toLocaleLowerCase().includes(query))
                .slice(0, 20);
            highlightedStudentIndex = -1;
            renderAutocomplete(matches, query);
        });

        searchInput.addEventListener('keydown', (event) => {
            const items = dropdown.querySelectorAll('.tt-autocomplete-item');
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                highlightedStudentIndex = Math.min(highlightedStudentIndex + 1, items.length - 1);
                updateAutocompleteHighlight(items);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                highlightedStudentIndex = Math.max(highlightedStudentIndex - 1, 0);
                updateAutocompleteHighlight(items);
            } else if (event.key === 'Enter' && items[highlightedStudentIndex]) {
                event.preventDefault();
                items[highlightedStudentIndex].click();
            } else if (event.key === 'Escape') {
                closeStudentDropdown();
            }
        });
    }

    function selectGroup(button, group) {
        document.querySelectorAll('.tt-group-pill').forEach((pill) => pill.classList.remove('active'));
        button.classList.add('active');
        selectedGroup = group;
        selectedStudents = [];
        $('selected-students').innerHTML = '';
        closeStudentDropdown();

        const searchInput = $('student-name-search');
        searchInput.disabled = false;
        searchInput.value = '';
        searchInput.placeholder = 'Type to search your name...';
        searchInput.focus();
    }

    function renderAutocomplete(matches, query) {
        const dropdown = $('student-autocomplete');
        if (matches.length === 0) {
            dropdown.innerHTML = '<div class="tt-autocomplete-empty">No students found</div>';
            dropdown.className = 'tt-autocomplete-dropdown open';
            return;
        }

        dropdown.innerHTML = matches.map((name, index) => {
            const lowerName = name.toLocaleLowerCase();
            const matchIndex = lowerName.indexOf(query);
            const before = escapeHtml(name.slice(0, matchIndex));
            const match = escapeHtml(name.slice(matchIndex, matchIndex + query.length));
            const after = escapeHtml(name.slice(matchIndex + query.length));
            return `<div class="tt-autocomplete-item" data-index="${index}" data-name="${escapeHtml(name)}">${before}<span class="tt-match">${match}</span>${after}</div>`;
        }).join('');
        dropdown.className = 'tt-autocomplete-dropdown open';

        dropdown.querySelectorAll('.tt-autocomplete-item').forEach((item) => {
            item.addEventListener('click', () => selectStudent(item.dataset.name));
        });
    }

    function updateAutocompleteHighlight(items) {
        items.forEach((item, index) => {
            item.classList.toggle('highlighted', index === highlightedStudentIndex);
        });
        if (items[highlightedStudentIndex]) {
            items[highlightedStudentIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    function selectStudent(name) {
        selectedStudents = [name];
        $('selected-students').innerHTML = `
            <span class="tt-selected-chip">
                <span>${escapeHtml(name)}</span>
                <button type="button" class="tt-chip-remove" title="Remove"><i class="fa-solid fa-xmark"></i></button>
            </span>`;
        $('selected-students').querySelector('.tt-chip-remove').addEventListener('click', removeSelectedStudent);
        $('student-name-search').value = '';
        $('student-name-search').disabled = true;
        $('student-name-search').placeholder = name;
        closeStudentDropdown();
    }

    function removeSelectedStudent() {
        selectedStudents = [];
        $('selected-students').innerHTML = '';
        $('student-name-search').disabled = false;
        $('student-name-search').placeholder = 'Type to search your name...';
        $('student-name-search').focus();
    }

    function closeStudentDropdown() {
        $('student-autocomplete').className = 'tt-autocomplete-dropdown';
        $('student-autocomplete').innerHTML = '';
    }

    async function handleStartClick() {
        if (!selectedGroup) {
            flashInvalid($('group-selector'));
            return;
        }
        if (selectedStudents.length === 0) {
            flashInvalid($('student-name-search'));
            return;
        }

        const startButton = $('btn-start-test');
        startButton.disabled = true;

        // This must happen synchronously in the Start Test click gesture.
        const fullscreenAttempt = requestExamFullscreen();

        try {
            const submittedNames = await FirebaseService.getSubmittedNames(testCode);
            const selectedName = selectedStudents[0];
            const hasSubmitted = submittedNames.some((name) =>
                name === selectedName || name.includes(selectedName) || selectedName.includes(name)
            );

            if (hasSubmitted) {
                $('retake-warn-text').textContent = `"${selectedName}" has already submitted this exam. Do you want to continue anyway?`;
                $('retake-warning').style.display = 'flex';
                startButton.disabled = false;
                return;
            }
        } catch (error) {
            console.warn('[ShortcutExam] Could not check previous submissions:', error);
        }

        proceedToStart(fullscreenAttempt);
    }

    function cancelRetake() {
        $('retake-warning').style.display = 'none';
        $('btn-start-test').disabled = false;
        exitExamFullscreen();
    }

    function continueRetake() {
        $('retake-warning').style.display = 'none';
        $('btn-start-test').disabled = true;
        const fullscreenAttempt = isFullscreen() ? Promise.resolve(true) : requestExamFullscreen();
        proceedToStart(fullscreenAttempt);
    }

    function proceedToStart(fullscreenAttempt) {
        studentName = selectedStudents[0];
        studentGroup = selectedGroup;
        $('student-name').value = studentName;
        $('student-group').value = studentGroup;

        shortcutResults = [];
        creditedIds = new Set();
        exitCount = 0;
        modalOpen = false;
        currentShortcut = null;
        currentResult = null;
        submitInProgress = false;
        examLocked = false;
        resumeRequested = false;
        ambientEnabled = true;
        suppressFullscreenLock = false;
        suppressExitUntil = 0;
        leavePromptOpen = false;
        allowUnload = false;
        virtualKeyboardOpen = false;
        clearVirtualKeySelection();
        timeRemainingMs = testData.timeLimitMinutes * 60 * 1000;

        $('shortcut-exam-container').classList.remove('modal-open');
        $('exam-content').inert = false;
        $('function-modal').style.display = 'none';
        $('lock-overlay').style.display = 'none';
        $('leave-overlay').style.display = 'none';
        $('virtual-keyboard-panel').classList.remove('open');
        $('virtual-keyboard-panel').setAttribute('aria-hidden', 'true');
        $('btn-virtual-keyboard').setAttribute('aria-expanded', 'false');
        $('btn-finish-test').disabled = true;
        updateProgress();
        updateTimerDisplay();
        showScreen('screen-exam');
        examActive = true;

        Promise.resolve(fullscreenAttempt).then((entered) => {
            if (!examActive) return;
            if (entered && isFullscreen()) {
                startTimer();
            } else {
                showLock(false);
            }
        });
    }

    function requestExamFullscreen() {
        const container = $('shortcut-exam-container');
        try {
            const request = container.requestFullscreen
                ? container.requestFullscreen()
                : container.webkitRequestFullscreen
                    ? container.webkitRequestFullscreen()
                    : Promise.reject(new Error('Fullscreen is not supported.'));
            return Promise.resolve(request)
                .then(() => true)
                .catch((error) => {
                    console.warn('[ShortcutExam] Fullscreen request failed:', error);
                    return false;
                });
        } catch (error) {
            console.warn('[ShortcutExam] Fullscreen request failed:', error);
            return Promise.resolve(false);
        }
    }

    function exitExamFullscreen() {
        try {
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        } catch (error) {
            console.warn('[ShortcutExam] Could not exit fullscreen:', error);
        }
    }

    function isFullscreen() {
        return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    }

    function onFullscreenChange() {
        if (!examActive) return;
        if (isFullscreen()) {
            if (examLocked && resumeRequested) resumeFromLock();
            return;
        }
        if (consumeFullscreenShortcutSuppression()) {
            restoreExamFullscreen();
            return;
        }
        showLock(true);
    }

    function onVisibilityChange() {
        if (examActive && document.hidden && !shouldSuppressExitLock()) showLock(true);
    }

    function onWindowBlur() {
        if (examActive && !shouldSuppressExitLock()) showLock(true);
    }

    function markFullscreenShortcutHandled() {
        suppressFullscreenLock = true;
        suppressExitUntil = Date.now() + 800;
    }

    function shouldSuppressExitLock() {
        return suppressFullscreenLock || Date.now() < suppressExitUntil;
    }

    function consumeFullscreenShortcutSuppression() {
        if (!shouldSuppressExitLock()) return false;
        suppressFullscreenLock = false;
        return true;
    }

    function restoreExamFullscreen() {
        requestExamFullscreen().catch(() => {});
    }

    function isF11Event(event) {
        return event.key === 'F11' || event.code === 'F11';
    }

    function isCloseTabShortcut(event) {
        const key = String(event.key || '').toLowerCase();
        const code = event.code;
        const ctrlOrCmd = event.ctrlKey || event.metaKey;
        if (ctrlOrCmd && (key === 'w' || code === 'KeyW')) return true;
        if (ctrlOrCmd && (key === 'f4' || code === 'F4')) return true;
        if (event.altKey && !ctrlOrCmd && (key === 'f4' || code === 'F4')) return true;
        return false;
    }

    function onBeforeUnload(event) {
        if (!examActive || allowUnload) return;
        event.preventDefault();
        event.returnValue = '';
    }

    function showLeavePrompt() {
        if (!examActive || leavePromptOpen || submitInProgress) return;
        if (virtualKeyboardOpen) closeVirtualKeyboard(false);
        leavePromptOpen = true;
        pauseTimer();
        hideContextMenu();
        ambientEnabled = false;
        $('leave-overlay').style.display = 'flex';
        $('btn-stay-exam').focus();
    }

    function dismissLeavePrompt() {
        if (!leavePromptOpen) return;
        leavePromptOpen = false;
        $('leave-overlay').style.display = 'none';
        if (!examActive || examLocked) return;
        ambientEnabled = !modalOpen;
        startTimer();
    }

    function confirmLeaveExam() {
        if (!leavePromptOpen) return;
        leavePromptOpen = false;
        $('leave-overlay').style.display = 'none';
        finishExam('leave');
    }

    function showLock(incrementExitCount) {
        if (!examActive || examLocked) return;
        if (virtualKeyboardOpen) closeVirtualKeyboard(false);
        examLocked = true;
        resumeRequested = false;
        ambientEnabled = false;
        pauseTimer();
        hideContextMenu();
        if (incrementExitCount) exitCount += 1;
        $('lock-overlay').style.display = 'flex';
    }

    async function handleResumeClick() {
        if (!examActive || !examLocked) return;
        const button = $('btn-resume-exam');
        button.disabled = true;
        resumeRequested = true;
        const entered = await requestExamFullscreen();
        button.disabled = false;

        if (entered && isFullscreen() && !document.hidden) {
            resumeFromLock();
        } else {
            resumeRequested = false;
        }
    }

    function resumeFromLock() {
        if (!examLocked || !isFullscreen() || document.hidden) return;
        examLocked = false;
        resumeRequested = false;
        $('lock-overlay').style.display = 'none';
        ambientEnabled = !modalOpen && !virtualKeyboardOpen;
        startTimer();
    }

    function startTimer() {
        if (!examActive || examLocked || leavePromptOpen || timerInterval) return;
        timerDeadline = Date.now() + timeRemainingMs;
        updateTimerDisplay();
        timerInterval = window.setInterval(tickTimer, 250);
    }

    function tickTimer() {
        timeRemainingMs = Math.max(0, timerDeadline - Date.now());
        updateTimerDisplay();
        if (timeRemainingMs <= 0) {
            pauseTimer();
            finishExam('time');
        }
    }

    function pauseTimer() {
        if (timerInterval) {
            timeRemainingMs = Math.max(0, timerDeadline - Date.now());
            clearInterval(timerInterval);
            timerInterval = null;
        }
        updateTimerDisplay();
    }

    function updateTimerDisplay() {
        const totalSeconds = Math.max(0, Math.ceil(timeRemainingMs / 1000));
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        $('exam-timer').querySelector('span').textContent = `${minutes}:${seconds}`;
        $('exam-timer').classList.toggle('warning', totalSeconds <= 60);
    }

    function onAmbientKeydown(event) {
        if (!examActive || submitInProgress) return;

        if (isCloseTabShortcut(event)) {
            event.preventDefault();
            event.stopPropagation();
            showLeavePrompt();
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (leavePromptOpen) {
                dismissLeavePrompt();
                return;
            }
            showLock(true);
            return;
        }

        if (isF11Event(event) && isFullscreen()) {
            event.preventDefault();
            event.stopPropagation();
            if (leavePromptOpen) return;
            markFullscreenShortcutHandled();
            restoreExamFullscreen();

            if (examLocked || modalOpen || !ambientEnabled) return;

            const fullscreenShortcut = eligibleShortcuts.find(
                (candidate) => candidate.id === 'fullscreen' && candidate.inputChannel === 'physical'
            );
            if (!fullscreenShortcut) return;
            recordShortcutAttempt(fullscreenShortcut);
            return;
        }

        if (examLocked || modalOpen || !ambientEnabled) return;
        if (isModifierOnlyEvent(event)) return;

        const shortcut = eligibleShortcuts.find(
            (candidate) => candidate.inputChannel === 'physical' && matchesShortcutEvent(candidate, event)
        );
        if (!shortcut) return;

        event.preventDefault();
        event.stopPropagation();
        recordShortcutAttempt(shortcut);
    }

    function recordShortcutAttempt(shortcut) {
        if (creditedIds.has(shortcut.id)) {
            showToast('That shortcut was already recorded.');
            return;
        }

        creditedIds.add(shortcut.id);
        ambientEnabled = false;
        currentShortcut = shortcut;
        currentResult = {
            shortcutId: shortcut.id,
            inputChannel: shortcut.inputChannel,
            keypressCorrect: true,
            mcCorrect: false,
            pointsEarned: 0.5
        };
        shortcutResults.push(currentResult);
        updateProgress();
        showFunctionQuestion(shortcut);
    }

    function isModifierOnlyEvent(event) {
        if (window.ShortcutsData && typeof ShortcutsData.isModifierOnlyEvent === 'function') {
            return ShortcutsData.isModifierOnlyEvent(event);
        }
        return ['Control', 'Shift', 'Alt', 'Meta', 'OS'].includes(event.key);
    }

    function matchesShortcutEvent(shortcut, event) {
        const required = shortcut.keys.map((key) => String(key).toLowerCase());
        const needsCtrl = required.includes('ctrl');
        const needsShift = required.includes('shift');
        const needsAlt = required.includes('alt');
        const needsMeta = required.includes('win');
        const mainKey = required.find((key) => !['ctrl', 'shift', 'alt', 'win'].includes(key));
        const eventKey = String(event.key || '').toLowerCase();
        const isPlus = mainKey === '+' && (eventKey === '+' || eventKey === '=');

        return event.ctrlKey === needsCtrl &&
            (isPlus || event.shiftKey === needsShift) &&
            event.altKey === needsAlt &&
            event.metaKey === needsMeta &&
            (isPlus || eventKey === mainKey);
    }

    function showFunctionQuestion(shortcut) {
        modalOpen = true;
        const question = shortcut.functionQuestion;
        $('shortcut-exam-container').classList.add('modal-open');
        $('exam-content').inert = true;
        $('mc-shortcut-label').textContent = `${formatShortcut(shortcut)} recorded`;
        $('mc-prompt').textContent = question.prompt;
        $('mc-feedback').textContent = '';
        $('btn-dismiss-question').style.display = 'none';

        $('mc-options').innerHTML = question.options.map((option, index) => `
            <button class="se-mc-option" data-index="${index}">
                <span class="se-option-letter">${String.fromCharCode(65 + index)}</span>
                <span class="se-option-icon" aria-hidden="true"><i class="fa-solid ${optionIconClass(option)}"></i></span>
                <span class="se-option-text">${formatOptionLabel(option)}</span>
            </button>
        `).join('');

        $('mc-options').querySelectorAll('.se-mc-option').forEach((button) => {
            button.addEventListener('click', () => answerFunctionQuestion(Number(button.dataset.index)));
        });
        $('function-modal').style.display = 'flex';
    }

    function answerFunctionQuestion(selectedIndex) {
        if (!modalOpen || !currentShortcut || !currentResult) return;
        const question = currentShortcut.functionQuestion;
        const correct = selectedIndex === question.correctIndex;

        currentResult.mcCorrect = correct;
        currentResult.pointsEarned = correct ? 1 : 0.5;

        $('mc-options').querySelectorAll('.se-mc-option').forEach((button) => {
            const index = Number(button.dataset.index);
            button.disabled = true;
            if (index === question.correctIndex) button.classList.add('correct');
            if (index === selectedIndex && !correct) button.classList.add('incorrect');
        });

        $('mc-feedback').textContent = correct
            ? 'Correct — 1 point earned.'
            : 'Not quite — 0.5 points earned for the shortcut.';
        $('mc-feedback').style.color = correct ? 'var(--se-success)' : 'var(--se-danger)';
        $('btn-dismiss-question').style.display = 'inline-flex';
        $('btn-dismiss-question').focus();
    }

    function dismissFunctionQuestion() {
        if (!modalOpen || !currentResult) return;
        modalOpen = false;
        currentShortcut = null;
        currentResult = null;
        $('function-modal').style.display = 'none';
        $('shortcut-exam-container').classList.remove('modal-open');
        $('exam-content').inert = false;

        if (shortcutResults.length >= TARGET_SHORTCUTS) {
            finishExam('complete');
            return;
        }
        if (examActive && !examLocked && !virtualKeyboardOpen) ambientEnabled = true;
    }

    function updateProgress() {
        const attempted = shortcutResults.length;
        $('shortcut-counter').textContent = `${attempted} / ${TARGET_SHORTCUTS} shortcuts demonstrated`;
        $('btn-finish-test').disabled = attempted < 1;
    }

    async function finishExam(reason) {
        if (!examActive || submitInProgress) return;
        const attempted = shortcutResults.length;

        if (reason === 'manual' && attempted < TARGET_SHORTCUTS) {
            const confirmed = window.confirm(`You've only completed ${attempted} of ${TARGET_SHORTCUTS} — submit anyway?`);
            if (!confirmed) return;
        }

        submitInProgress = true;
        examActive = false;
        ambientEnabled = false;
        leavePromptOpen = false;
        allowUnload = true;
        pauseTimer();
        hideContextMenu();
        $('btn-finish-test').disabled = true;
        $('function-modal').style.display = 'none';
        $('lock-overlay').style.display = 'none';
        $('leave-overlay').style.display = 'none';
        closeVirtualKeyboard(false);
        $('shortcut-exam-container').classList.remove('modal-open');
        $('exam-content').inert = false;

        const score = shortcutResults.reduce((total, result) => total + result.pointsEarned, 0);
        const response = {
            studentName,
            group: studentGroup,
            score,
            shortcutsAttempted: attempted,
            shortcutResults: shortcutResults.map((result) => ({
                shortcutId: result.shortcutId,
                inputChannel: result.inputChannel,
                keypressCorrect: result.keypressCorrect,
                mcCorrect: result.mcCorrect,
                pointsEarned: result.pointsEarned
            })),
            exitCount,
            submittedAt: Date.now()
        };

        const submission = FirebaseService.submitTestResponse(testCode, response);
        exitExamFullscreen();

        let submitted = true;
        try {
            await submission;
        } catch (error) {
            submitted = false;
            console.error('[ShortcutExam] Response submission failed:', error);
        }

        $('result-score').textContent = `${formatScore(score)} / ${TARGET_SHORTCUTS}`;
        $('result-summary').textContent = submitted
            ? `${attempted} shortcut${attempted === 1 ? '' : 's'} recorded. Your response was saved.`
            : 'Your response could not be saved. Tell your teacher before closing this page.';
        showScreen('screen-result');
    }

    function formatScore(score) {
        return Number.isInteger(score) ? String(score) : score.toFixed(1);
    }

    function formatShortcut(shortcut) {
        if (window.ShortcutsData && typeof ShortcutsData.formatCombo === 'function') {
            return ShortcutsData.formatCombo(shortcut);
        }
        return shortcut.keys.map((key) => String(key).toUpperCase()).join(' + ');
    }

    function onContextMenu(event) {
        if (!examActive) return;
        event.preventDefault();
        if (modalOpen || examLocked || virtualKeyboardOpen) return;

        const menu = $('shortcut-context-menu');
        const menuWidth = 200;
        const menuHeight = 56;
        const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
        const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
        menu.style.left = `${Math.max(8, x)}px`;
        menu.style.top = `${Math.max(8, y)}px`;
        menu.style.display = 'block';
    }

    function onDocumentClick(event) {
        if (!event.target.closest('#shortcut-context-menu')) hideContextMenu();
        if (!event.target.closest('.tt-name-search-wrap')) closeStudentDropdown();
    }

    function hideContextMenu() {
        $('shortcut-context-menu').style.display = 'none';
    }

    function changeTheme() {
        document.getElementById('dark-mode-toggle')?.click();
        hideContextMenu();
    }

    function formatOptionLabel(option) {
        const match = String(option).match(/^(.*?)(\s*\[[^\]]+\])\s*$/);
        if (!match) return `<span class="se-option-en">${escapeHtml(option)}</span>`;
        return `<span class="se-option-en">${escapeHtml(match[1].trim())}</span> ` +
            `<span class="se-option-es">${escapeHtml(match[2].trim())}</span>`;
    }

    function optionEnglishLabel(option) {
        return String(option).replace(/\s*\[[^\]]+\]\s*$/, '').trim();
    }

    function optionIconClass(option) {
        return OPTION_ICONS[optionEnglishLabel(option)] || 'fa-keyboard';
    }

    function showToast(message) {
        const toast = $('exam-toast');
        toast.textContent = message;
        toast.style.display = 'block';
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.style.display = 'none';
        }, 1400);
    }

    function flashInvalid(element) {
        const previousOutline = element.style.outline;
        element.style.outline = '3px solid var(--se-danger)';
        setTimeout(() => {
            element.style.outline = previousOutline;
        }, 1400);
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', ShortcutExam.init);
