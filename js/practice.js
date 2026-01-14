const PracticeModule = {
    words: [],
    baseWords: [],
    difficultWords: [], 
    currentIndex: 0,
    config: {
        mode: 'flashcards',
        face: 'word_first',
        submode: null,
        settings: {
            timer: 'none',
            timerValue: 300, 
            lives: 0, 
            allowDiagonal: true,
            allowReverse: false,
            gridSize: 'M',
            clueTypes: ['image'],
            mustClickClue: false
        }
    },
    matches: 0,
    gameState: {
        timerInterval: null,
        timeLeft: 0,
        livesLeft: 0,
        isGameOver: false,
        pendingClueMatch: null // Stores word id that was found but needs clue click
    },

    init() {
        const params = new URLSearchParams(window.location.search);
        let idsParam = params.get('ids');
        
        // Try getting IDs from localStorage if not in URL
        if (!idsParam) {
            const storedIds = localStorage.getItem('selectedVocabIds');
            if (storedIds) {
                try {
                    idsParam = JSON.parse(storedIds).join(',');
                } catch(e) { console.error('Error parsing stored IDs', e); }
            }
        }

        const ids = idsParam ? idsParam.split(',') : [];
        this.config.mode = params.get('mode'); // Allow null
        this.config.face = params.get('face') || 'word_first';
        this.config.submode = params.get('face'); 

        // Load base words
        this.baseWords = window.vocabularyBank.filter(w => ids.includes(w.id));
        this.words = [...this.baseWords];
        this.difficultWords = []; 

        if (this.config.mode) {
            this.handleModeSetup(this.config.mode);
        } else {
            this.showModeSelection();
        }
        
        this.setupFullScreen();
        this.updateWordCountButton();
        this.setupSettingsButton();
    },

    setupSettingsButton() {
        const btn = document.getElementById('change-options-btn');
        if (btn) {
            btn.onclick = () => this.backToSettings();
        }
    },

    backToSettings() {
        if (this.gameState.timerInterval) clearInterval(this.gameState.timerInterval);
        this.handleModeSetup(this.config.mode);
    },

    updateWordCountButton() {
        const btn = document.getElementById('word-count-floating-btn');
        const text = document.getElementById('word-count-text');
        const list = document.getElementById('selected-words-list');
        
        if (!btn || !text || !list) return;

        const count = this.baseWords.length;
        text.textContent = `${count} Word${count !== 1 ? 's' : ''} Selected`;
        
        list.innerHTML = this.baseWords.map(w => `<li>${w.word}</li>`).join('');
    },

    toggleWordCountVisibility(visible) {
        const btn = document.getElementById('word-count-floating-btn');
        if (btn) {
            if (visible) btn.classList.add('visible');
            else btn.classList.remove('visible');
        }
    },

    showModeSelection() {
        document.getElementById('mode-selection-area').style.display = 'block';
        document.getElementById('settings-area').style.display = 'none';
        document.getElementById('game-area').style.display = 'none';
        document.getElementById('game-info').innerHTML = '';
        
        const settingsBtn = document.getElementById('change-options-btn');
        if (settingsBtn) settingsBtn.style.display = 'none';
        
        this.toggleWordCountVisibility(true);

        // Add click handlers
        document.querySelectorAll('.exercise-card').forEach(card => {
            card.onclick = () => {
                const mode = card.dataset.type;
                this.config.mode = mode;
                this.handleModeSetup(mode);
            };
        });
    },

    handleModeSetup(mode) {
        // Reset words from base
        this.words = [...this.baseWords];

        // Specific filtering
        if (mode === 'quiz') {
            this.words = window.classroomLanguageQuiz;
        } else if (mode === 'time-quiz') {
            this.words = window.timeQuizData;
            this.config.mode = 'quiz'; // Re-use quiz rendering logic
        } else if (mode === 'wordsearch') {
             if (this.words.length > 16) this.words = this.words.slice(0, 16);
        } else if (mode === 'unjumble') {
             this.words = this.words.filter(w => w.word.trim().includes(' '));
        }

        if (this.words.length === 0) {
            this.showToast('No suitable words selected for this mode! Please try another mode or select different words.', 'warning');
            if (!this.config.mode) this.showModeSelection(); // Go back if we were in selection
            return;
        }

        document.getElementById('mode-selection-area').style.display = 'none';
        
        const settingsBtn = document.getElementById('change-options-btn');
        
        if (mode === 'wordsearch') {
            if (settingsBtn) settingsBtn.style.display = 'none';
            this.showWordsearchSettings();
        } else if (mode === 'flashcards') {
            if (settingsBtn) settingsBtn.style.display = 'none';
            this.showFlashcardsSettings();
        } else {
            if (settingsBtn) settingsBtn.style.display = 'flex';
            document.getElementById('game-area').style.display = 'flex'; // Ensure visible
            this.render();
        }
    },

    showFlashcardsSettings() {
        this.toggleWordCountVisibility(true);
        const settingsArea = document.getElementById('settings-area');
        const gameArea = document.getElementById('game-area');
        settingsArea.style.display = 'block';
        gameArea.style.display = 'none';

        settingsArea.innerHTML = `
            <div class="ws-settings-panel">
                <h2>Flashcards Options</h2>
                
                <div class="flashcard-preview-container">
                    <div class="flashcard-preview">
                        <div class="flashcard-preview-inner">
                            <div class="flashcard-preview-face flashcard-preview-face-front"></div>
                            <div class="flashcard-preview-face flashcard-preview-face-back"></div>
                        </div>
                    </div>
                </div>

                <div class="settings-group">
                    <label>STUDY MODE</label>
                    <div class="horizontal-options">
                        <label>
                            <input type="radio" name="fc-mode" value="word_first" checked> 
                            <div class="option-btn">
                                <i class="fa-solid fa-font option-icon"></i>
                                <span>Word First</span>
                            </div>
                        </label>
                        <label>
                            <input type="radio" name="fc-mode" value="image_first"> 
                            <div class="option-btn">
                                <i class="fa-regular fa-image option-icon"></i>
                                <span>Image First</span>
                            </div>
                        </label>
                        <label>
                            <input type="radio" name="fc-mode" value="listening"> 
                            <div class="option-btn">
                                <i class="fa-solid fa-volume-high option-icon"></i>
                                <span>Listening</span>
                            </div>
                        </label>
                    </div>
                </div>

                <div class="settings-group">
                    <label>TIMER</label>
                    <div class="radio-group">
                        <label><input type="radio" name="timer" value="none" checked> None</label>
                        <label><input type="radio" name="timer" value="up"> Count up</label>
                        <label><input type="radio" name="timer" value="down"> Count down</label>
                        <div class="timer-inputs">
                            <input type="number" id="timer-m" value="5" min="0" max="59"> m
                            <input type="number" id="timer-s" value="0" min="0" max="59"> s
                        </div>
                    </div>
                </div>

                <div class="settings-group">
                    <label>RANDOM</label>
                    <div class="checkbox-group">
                        <label><input type="checkbox" id="fc-shuffle" checked> Shuffle item order</label>
                    </div>
                </div>

                <div class="settings-group">
                    <label>REPEAT CARDS</label>
                    <div class="radio-group">
                        <label><input type="radio" name="fc-repeat" value="until_correct" checked> Repeat cards until all correct</label>
                        <label><input type="radio" name="fc-repeat" value="once"> Each card only once</label>
                    </div>
                </div>

                <div class="settings-group">
                    <label>MARKING</label>
                    <div class="radio-group">
                        <label><input type="radio" name="fc-marking" value="none"> None</label>
                        <label><input type="radio" name="fc-marking" value="tick_cross" checked> Tick/Cross</label>
                    </div>
                    <div class="checkbox-group" style="margin-top: 10px;">
                        <label><input type="checkbox" id="fc-auto-proceed" checked> Automatically proceed after marking</label>
                    </div>
                </div>

                <div class="settings-group">
                    <label>END OF GAME</label>
                    <div class="checkbox-group">
                        <label><input type="checkbox" id="fc-show-answers"> Show answers</label>
                    </div>
                </div>

                <div class="settings-actions">
                    <button class="btn-primary start-game-btn" onclick="PracticeModule.startFlashcards()">Start Practice</button>
                </div>
            </div>
        `;

        // Initialize preview
        this.updateFlashcardPreview('word_first');

        // Add Hover Listeners
        const radios = document.querySelectorAll('input[name="fc-mode"]');
        radios.forEach(radio => {
            // Update on hover of the label (parent)
            radio.parentElement.addEventListener('mouseenter', () => {
                this.updateFlashcardPreview(radio.value);
            });
            
            // Also update on change
            radio.addEventListener('change', () => {
                this.updateFlashcardPreview(radio.value);
            });
        });
    },

    startFlashcards() {
        const mode = document.querySelector('input[name="fc-mode"]:checked').value;
        const timerType = document.querySelector('input[name="timer"]:checked').value;
        const minutes = parseInt(document.getElementById('timer-m').value) || 0;
        const seconds = parseInt(document.getElementById('timer-s').value) || 0;
        const shuffle = document.getElementById('fc-shuffle').checked;
        const repeatMode = document.querySelector('input[name="fc-repeat"]:checked').value;
        const markingMode = document.querySelector('input[name="fc-marking"]:checked').value;
        const autoProceed = document.getElementById('fc-auto-proceed').checked;
        const showAnswers = document.getElementById('fc-show-answers').checked;

        this.config.face = mode;
        this.config.settings = {
            ...this.config.settings,
            timer: timerType,
            timerValue: (minutes * 60) + seconds,
            shuffle: shuffle,
            repeatMode: repeatMode,
            markingMode: markingMode,
            autoProceed: autoProceed,
            showAnswers: showAnswers
        };

        if (shuffle) {
            this.words.sort(() => Math.random() - 0.5);
        }

        // Reset game state for flashcards
        this.gameState.timeLeft = this.config.settings.timerValue;
        this.gameState.isGameOver = false;
        
        document.getElementById('settings-area').style.display = 'none';
        document.getElementById('game-area').style.display = 'flex';
        
        this.startTimer(); // Start timer if configured
        this.render();
    },

    updateFlashcardPreview(mode) {
        const previewInner = document.querySelector('.flashcard-preview-inner');
        const frontFace = document.querySelector('.flashcard-preview-face-front');
        const backFace = document.querySelector('.flashcard-preview-face-back');
        
        if (!previewInner || !frontFace || !backFace) return;

        let frontContent = '';
        let backContent = '';

        if (mode === 'word_first') {
            frontContent = `<div class="preview-side-label">Front</div><i class="fa-solid fa-font preview-icon"></i><div class="preview-label">Word</div>`;
            backContent = `
                <div class="preview-side-label">Back</div>
                <div style="display:flex; gap:10px;">
                    <div style="text-align:center"><i class="fa-regular fa-image preview-icon"></i><div class="preview-label">Image</div></div>
                    <div style="text-align:center"><i class="fa-solid fa-volume-high preview-icon"></i><div class="preview-label">Sound</div></div>
                </div>
            `;
        } else if (mode === 'image_first') {
            frontContent = `<div class="preview-side-label">Front</div><i class="fa-regular fa-image preview-icon"></i><div class="preview-label">Image</div>`;
            backContent = `
                <div class="preview-side-label">Back</div>
                <div style="display:flex; gap:10px;">
                    <div style="text-align:center"><i class="fa-solid fa-font preview-icon"></i><div class="preview-label">Word</div></div>
                    <div style="text-align:center"><i class="fa-solid fa-volume-high preview-icon"></i><div class="preview-label">Sound</div></div>
                </div>
            `;
        } else if (mode === 'listening') {
            frontContent = `<div class="preview-side-label">Front</div><i class="fa-solid fa-volume-high preview-icon"></i><div class="preview-label">Sound</div>`;
            backContent = `<div class="preview-side-label">Back</div><i class="fa-solid fa-font preview-icon"></i><div class="preview-label">Word</div>`;
        }

        // Apply content but prevent flicker if same
        if (frontFace.innerHTML !== frontContent) frontFace.innerHTML = frontContent;
        if (backFace.innerHTML !== backContent) backFace.innerHTML = backContent;

        // Trigger Flip Animation
        previewInner.classList.remove('flipped');
        
        // Small delay to ensure reset before flipping (simulating user interaction)
        // If this is called on hover, we might want to flip to back then front?
        // User said: "flips to reveal what type of content will be in the back and it flips again to show what type of content will be at the front."
        
        // Clear any existing animation timeouts
        if (this._previewTimeout) clearTimeout(this._previewTimeout);
        if (this._previewTimeout2) clearTimeout(this._previewTimeout2);

        // Sequence: Start Front -> Flip to Back (show back content) -> Flip to Front (show front content)?
        // Or: Start Front (Front Content) -> Flip to Back (Back Content) -> Flip to Front (Front Content).
        
        // Let's try:
        // 1. Set content.
        // 2. Wait a bit.
        // 3. Add 'flipped' class (Show Back).
        // 4. Wait.
        // 5. Remove 'flipped' class (Show Front).
        
        this._previewTimeout = setTimeout(() => {
            previewInner.classList.add('flipped');
            this._previewTimeout2 = setTimeout(() => {
                previewInner.classList.remove('flipped');
            }, 1200); // Stay on back for 1.2s
        }, 100);
    },

    showWordsearchSettings() {
        this.toggleWordCountVisibility(true);
        const settingsArea = document.getElementById('settings-area');
        const gameArea = document.getElementById('game-area');
        settingsArea.style.display = 'block';
        gameArea.style.display = 'none';

        settingsArea.innerHTML = `
            <div class="ws-settings-panel">
                <h2>Wordsearch Options</h2>
                
                <div class="settings-group">
                    <label>TIMER</label>
                    <div class="radio-group">
                        <label><input type="radio" name="timer" value="none" checked> None</label>
                        <label><input type="radio" name="timer" value="up"> Count up</label>
                        <label><input type="radio" name="timer" value="down"> Count down</label>
                        <div class="timer-inputs">
                            <input type="number" id="timer-m" value="5" min="0" max="59"> m
                            <input type="number" id="timer-s" value="0" min="0" max="59"> s
                        </div>
                    </div>
                </div>

                <div class="settings-group">
                    <label>LIVES</label>
                    <div class="range-group">
                        <input type="range" id="lives-range" min="0" max="10" value="0">
                        <span id="lives-display">Infinite</span>
                    </div>
                </div>

                <div class="settings-group">
                    <label>DIFFICULTY</label>
                    <div class="checkbox-group">
                        <label><input type="checkbox" id="allow-diagonal" checked> Allow diagonal words</label>
                        <label><input type="checkbox" id="allow-reverse"> Allow reverse words</label>
                    </div>
                </div>

                <div class="settings-group">
                    <label>GRID SIZE</label>
                    <div class="size-buttons">
                        <button type="button" class="btn-size" data-size="XS">XS</button>
                        <button type="button" class="btn-size" data-size="S">S</button>
                        <button type="button" class="btn-size active" data-size="M">M</button>
                        <button type="button" class="btn-size" data-size="LG">LG</button>
                        <button type="button" class="btn-size" data-size="XL">XL</button>
                    </div>
                </div>

                <div class="settings-group">
                    <label>CLUE TYPES</label>
                    <div class="checkbox-group">
                        <label><input type="checkbox" class="clue-type-cb" value="image" checked> Image Clues</label>
                        <label><input type="checkbox" class="clue-type-cb" value="audio"> Audio Clues</label>
                        <label><input type="checkbox" class="clue-type-cb" value="text"> Text Clues</label>
                    </div>
                </div>

                <div class="settings-group">
                    <label>GAMEPLAY</label>
                    <div class="checkbox-group">
                        <label><input type="checkbox" id="must-click-clue"> Must click clue card after finding word</label>
                    </div>
                </div>

                <div class="settings-actions">
                    <button class="btn-primary start-game-btn" onclick="PracticeModule.startWordsearch()">Start Game</button>
                </div>
            </div>
        `;

        // Add event listeners for settings
        document.getElementById('lives-range').addEventListener('input', (e) => {
            const val = e.target.value;
            document.getElementById('lives-display').textContent = val == 0 ? 'Infinite' : val;
        });

        document.querySelectorAll('.btn-size').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-size').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.config.settings.gridSize = btn.dataset.size;
            });
        });
    },

    startWordsearch() {
        // Collect settings
        const timerType = document.querySelector('input[name="timer"]:checked').value;
        const minutes = parseInt(document.getElementById('timer-m').value) || 0;
        const seconds = parseInt(document.getElementById('timer-s').value) || 0;
        const lives = parseInt(document.getElementById('lives-range').value);
        const diagonal = document.getElementById('allow-diagonal').checked;
        const reverse = document.getElementById('allow-reverse').checked;
        const mustClickClue = document.getElementById('must-click-clue').checked;
        
        const clueTypes = [];
        document.querySelectorAll('.clue-type-cb:checked').forEach(cb => clueTypes.push(cb.value));

        if (clueTypes.length === 0) {
            this.showToast('Please select at least one clue type!', 'warning');
            return;
        }

        this.config.settings = {
            timer: timerType,
            timerValue: (minutes * 60) + seconds,
            lives: lives,
            allowDiagonal: diagonal,
            allowReverse: reverse,
            gridSize: this.config.settings.gridSize,
            clueTypes: clueTypes,
            mustClickClue: mustClickClue
        };

        this.gameState.timeLeft = this.config.settings.timerValue;
        this.gameState.livesLeft = this.config.settings.lives;
        this.gameState.isGameOver = false;
        this.gameState.pendingClueMatch = null;

        // Try to enable full screen
        this.toggleFullScreen(true);

        document.getElementById('settings-area').style.display = 'none';
        document.getElementById('game-area').style.display = 'flex';
        
        this.render();
    },

    setupFullScreen() {
        const btn = document.getElementById('fullscreen-btn');
        if (btn) {
            btn.onclick = () => this.toggleFullScreen();
        }
    },

    toggleFullScreen(force = null) {
        const btn = document.getElementById('fullscreen-btn');
        if (force === true || (force === null && !document.fullscreenElement)) {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.log(err));
                if (btn) btn.innerHTML = '<i class="fa-solid fa-compress"></i>';
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(err => console.log(err));
                if (btn) btn.innerHTML = '<i class="fa-solid fa-expand"></i>';
            }
        }
    },

    render() {
        this.toggleWordCountVisibility(false);
        const settingsBtn = document.getElementById('change-options-btn');
        if (settingsBtn) settingsBtn.style.display = 'flex';
        const area = document.getElementById('game-area');
        area.innerHTML = ''; // Clear previous content
        
        // Remove old nav if exists
        const oldNav = document.querySelector('.practice-nav');
        if (oldNav) oldNav.remove();

        switch(this.config.mode) {
            case 'flashcards':
                this.renderFlashcard(area);
                break;
            case 'matching':
                this.renderMatching(area);
                break;
            case 'spelling':
                this.renderSpelling(area);
                break;
            case 'sentences':
                this.renderSentences(area);
                break;
            case 'wordsearch':
                this.renderWordsearch(area);
                break;
            case 'unjumble':
                this.renderUnjumble(area);
                break;
            case 'crossword':
                this.renderCrossword(area);
                break;
            case 'quiz':
                this.renderQuiz(area);
                break;
            default:
                area.innerHTML = `<p>Mode ${this.config.mode} not implemented yet.</p>`;
        }
    },

    // --- FLASHCARDS LOGIC ---
    renderFlashcard(container) {
        const word = this.words[this.currentIndex];
        
        let frontContent = '';
        let backContent = '';

        const wordHtml = `<div class="card-content-word">${word.word}</div>`;
        const imgPath = `assets/images/vocabulary/${word.word.toLowerCase()}.png`;
        
        let visualHtml = `
            <img src="${imgPath}" class="card-content-image" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block'" 
                 alt="${word.word}">
        `;

        if (word.category === 'colors') {
            visualHtml = `
                <div class="card-content-color-circle" style="background-color: ${this.getColorHex(word.word)}"></div>
            `;
        } else if (word.category === 'shapes') {
            visualHtml = this.getShapeHtml(word.word, true);
        } else {
            visualHtml += `<div style="display:none" class="card-content-icon"><i class="${word.icon}"></i></div>`;
        }
        
        const soundBtnSmall = `<button class="sound-btn-small" onclick="event.stopPropagation(); PracticeModule.playSound('${word.word}')"><i class="fa-solid fa-volume-high"></i></button>`;
        const soundBtnLarge = `<button class="sound-btn-large" onclick="event.stopPropagation(); PracticeModule.playSound('${word.word}')"><i class="fa-solid fa-volume-high"></i></button>`;

        switch(this.config.face) {
            case 'word_first':
                frontContent = wordHtml;
                backContent = visualHtml + soundBtnSmall;
                break;
            case 'image_first':
                frontContent = visualHtml;
                backContent = wordHtml + soundBtnSmall;
                break;
            case 'sound_first':
                frontContent = soundBtnLarge;
                backContent = visualHtml + wordHtml;
                break;
            case 'listening':
                frontContent = soundBtnLarge;
                backContent = wordHtml;
                break;
        }

        container.innerHTML = `
            <div class="flashcard-scene" onclick="this.classList.toggle('is-flipped')">
                <div class="flashcard-inner">
                    <div class="flashcard-face flashcard-face-front">
                        ${frontContent}
                    </div>
                    <div class="flashcard-face flashcard-face-back">
                        ${backContent}
                    </div>
                </div>
                
                ${this.config.settings.markingMode !== 'none' ? `
                <div class="learning-controls" onclick="event.stopPropagation()">
                    <button class="learning-btn btn-known" title="I know this!" onclick="PracticeModule.markWord(true)">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="learning-btn btn-unknown" title="I need practice" onclick="PracticeModule.markWord(false)">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                ` : ''}
            </div>
            
            <div class="practice-nav">
                <button class="nav-btn" id="prev-btn" onclick="PracticeModule.prev()" ${this.currentIndex === 0 ? 'disabled' : ''}>← Previous</button>
                <span style="font-weight: bold; font-size: 1.2rem;">${this.currentIndex + 1} / ${this.words.length}</span>
                <button class="nav-btn" id="next-btn" onclick="PracticeModule.next()" 
                    ${this.currentIndex === this.words.length - 1 && this.config.settings.markingMode !== 'none' ? 'disabled' : ''}>
                    ${this.currentIndex === this.words.length - 1 && this.config.settings.markingMode === 'none' ? 'Finish' : 'Next →'}
                </button>
            </div>
            
            ${this.config.settings.timer && this.config.settings.timer !== 'none' ? `
            <div id="fc-timer" style="position: absolute; top: 20px; right: 20px; font-size: 1.5rem; font-weight: bold; color: white;">
                <i class="fa-solid fa-clock"></i> <span>${this.formatTime(this.gameState.timeLeft)}</span>
            </div>` : ''}
        `;
    },

    markWord(isKnown) {
        const currentWord = this.words[this.currentIndex];
        
        if (!isKnown) {
            // Add to difficult words if not already there
            if (!this.difficultWords.find(w => w.id === currentWord.id)) {
                this.difficultWords.push(currentWord);
            }
        } else {
            // If marked known, remove from difficult list if it was there (e.g. if going back)
            this.difficultWords = this.difficultWords.filter(w => w.id !== currentWord.id);
        }

        // Auto proceed if enabled
        if (this.config.settings.autoProceed !== false) {
            this.next();
        } else {
            // Provide feedback or just flip card?
            // For now, assume user will manually click Next or it's handled by UI
            this.showToast(isKnown ? 'Marked as Known' : 'Marked for Review', isKnown ? 'success' : 'warning');
        }
    },

    startReviewSession() {
        this.words = [...this.difficultWords];
        this.difficultWords = []; // Reset for the review session
        this.currentIndex = 0;
        this.render();
    },

    // --- MATCHING GAME LOGIC ---
    renderMatching(container) {
        this.matches = 0;
        // Limit to 8 pairs for better layout
        const gameWords = this.words.slice(0, 8); 
        
        const leftItems = [...gameWords].sort(() => Math.random() - 0.5);
        const rightItems = [...gameWords].sort(() => Math.random() - 0.5);

        const isEnEs = this.config.face === 'en_es';
        const title = isEnEs ? 'Match English to Spanish' : 'Match the Image to the Word';

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
                <h2 style="margin-bottom: 20px;">${title}</h2>
                <div class="matching-game">
                    <div class="matching-column" id="col-left">
                        ${leftItems.map(w => {
                            let content = '';
                            if (isEnEs) {
                                content = `<span class="match-card-word">${w.word}</span>`;
                            } else {
                                const imgPath = `assets/images/vocabulary/${w.word.toLowerCase()}.png`;
                                let visual = `
                                    <img src="${imgPath}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                                    <div style="display:none; font-size: 2rem; color: var(--hot-pink);"><i class="${w.icon}"></i></div>
                                `;
                                if (w.category === 'colors') {
                                    visual = `<div class="match-card-color-circle" style="background-color: ${this.getColorHex(w.word)}"></div>`;
                                } else if (w.category === 'shapes') {
                                    // Scale down shapes for matching cards
                                    visual = `<div style="transform: scale(0.4); margin: -40px;">${this.getShapeHtml(w.word)}</div>`;
                                }
                                content = visual;
                            }
                            
                            return `
                            <div class="match-card" data-id="${w.id}" data-type="left" onclick="PracticeModule.handleMatchClick(this)">
                                ${content}
                                <button class="sound-btn-small" style="width: 30px; height: 30px; font-size: 0.8rem; margin-left: 10px;" 
                                        onclick="event.stopPropagation(); PracticeModule.playSound('${w.word}')">
                                    <i class="fa-solid fa-volume-high"></i>
                                </button>
                            </div>`;
                        }).join('')}
                    </div>
                    <div class="matching-column" id="col-right">
                        ${rightItems.map(w => `
                            <div class="match-card" data-id="${w.id}" data-type="right" onclick="PracticeModule.handleMatchClick(this)">
                                <span class="match-card-word">${isEnEs ? w.spanish : w.word}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    handleMatchClick(card) {
        if (card.classList.contains('correct') || card.classList.contains('selected')) return;

        // Deselect others in same column
        const type = card.dataset.type;
        document.querySelectorAll(`.match-card[data-type="${type}"]`).forEach(c => c.classList.remove('selected'));
        
        card.classList.add('selected');

        // Check for match
        const selectedLeft = document.querySelector('.match-card[data-type="left"].selected');
        const selectedRight = document.querySelector('.match-card[data-type="right"].selected');

        if (selectedLeft && selectedRight) {
            if (selectedLeft.dataset.id === selectedRight.dataset.id) {
                // Match!
                selectedLeft.classList.remove('selected');
                selectedRight.classList.remove('selected');
                selectedLeft.classList.add('correct');
                selectedRight.classList.add('correct');
                
                this.matches++;
                if (this.matches === document.querySelectorAll('.match-card[data-type="left"]').length) {
                    setTimeout(() => this.showToast('🎉 All matched! Great job!', 'success'), 500);
                }
            } else {
                // No match
                setTimeout(() => {
                    selectedLeft.classList.remove('selected');
                    selectedRight.classList.remove('selected');
                }, 500);
            }
        }
    },

    showToast(message, type = 'info') {
        // Remove existing toast
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        
        let icon = 'fa-circle-info';
        if (type === 'success') icon = 'fa-circle-check';
        if (type === 'error') icon = 'fa-circle-xmark';
        if (type === 'warning') icon = 'fa-triangle-exclamation';

        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    },

    // --- SPELLING GAME LOGIC ---
    renderSpelling(container) {
        const word = this.words[this.currentIndex];
        const imgPath = `assets/images/vocabulary/${word.word.toLowerCase()}.png`;
        
        let visual = `
            <img src="${imgPath}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
            <div style="display:none; font-size: 6rem; color: var(--hot-pink);"><i class="${word.icon}"></i></div>
        `;

        if (word.category === 'colors') {
            visual = `<div class="card-content-color-circle" style="background-color: ${this.getColorHex(word.word)}"></div>`;
        } else if (word.category === 'shapes') {
            visual = this.getShapeHtml(word.word, true);
        }

        container.innerHTML = `
            <div class="spelling-container">
                <div class="spelling-image-container">
                    ${visual}
                </div>
                
                <button class="sound-btn-large" style="margin: 0 auto 20px auto;" onclick="PracticeModule.playSound('${word.word}')">
                    <i class="fa-solid fa-volume-high"></i>
                </button>
                
                <p>Type the word:</p>
                <input type="text" class="spelling-input" id="spelling-input" autocomplete="off">
                
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                    <button class="btn-primary" onclick="PracticeModule.checkSpelling()">Check</button>
                    <button class="btn-secondary" onclick="PracticeModule.next()">Skip</button>
                </div>
                
                <div id="spelling-feedback" class="spelling-feedback"></div>
                
                <p style="margin-top: 20px; color: #888;">Word ${this.currentIndex + 1} of ${this.words.length}</p>
            </div>
        `;

        const input = document.getElementById('spelling-input');
        input.focus();
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.checkSpelling();
        });
    },

    checkSpelling() {
        const input = document.getElementById('spelling-input');
        const feedback = document.getElementById('spelling-feedback');
        const word = this.words[this.currentIndex];
        
        if (input.value.trim().toLowerCase() === word.word.toLowerCase()) {
            feedback.innerHTML = '✅ Correct!';
            feedback.style.color = '#28a745';
            input.style.borderColor = '#28a745';
            setTimeout(() => this.next(), 1000);
        } else {
            feedback.innerHTML = '❌ Try again!';
            feedback.style.color = '#dc3545';
            input.style.borderColor = '#dc3545';
        }
    },

    // --- SENTENCES LOGIC ---
    renderSentences(container) {
        // ... (existing code)
    },

    // --- WORDSEARCH LOGIC ---
    wordsearchData: {
        grid: [],
        size: 12,
        selectedCells: [],
        isSelecting: false,
        foundWords: [],
        placedWords: [],
        isPendingMatch: false
    },

    renderWordsearch(container) {
        // Clear any existing timer
        if (this.gameState.timerInterval) clearInterval(this.gameState.timerInterval);

        // Determine grid size based on settings
        const sizeMap = { 'XS': 10, 'S': 12, 'M': 15, 'LG': 18, 'XL': 20 };
        let baseSize = sizeMap[this.config.settings.gridSize] || 15;
        
        // Ensure it fits the longest word
        const longestWordLen = Math.max(...this.words.map(w => w.word.replace(/\s/g, '').length));
        this.wordsearchData.size = Math.max(baseSize, longestWordLen);
        
        this.wordsearchData.foundWords = [];
        this.wordsearchData.placedWords = [];
        this.wordsearchData.isPendingMatch = false;
        this.generateWordsearchGrid();

        // Split words for side columns (max 16 words total)
        const leftWords = this.wordsearchData.placedWords.slice(0, Math.ceil(this.wordsearchData.placedWords.length / 2));
        const rightWords = this.wordsearchData.placedWords.slice(Math.ceil(this.wordsearchData.placedWords.length / 2));

        container.innerHTML = `
            <div class="wordsearch-layout-v2">
                <div class="ws-side-column ws-left-clues">
                    <div class="clues-grid-v2" style="grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(4, 1fr);">
                        ${this.renderWSCluesV2(leftWords)}
                    </div>
                </div>

                <div class="wordsearch-main-v2">
                    <div class="ws-header-info">
                        ${this.config.settings.timer !== 'none' ? `<div id="ws-timer" class="ws-info-item"><i class="fa-solid fa-clock"></i> <span>${this.formatTime(this.gameState.timeLeft)}</span></div>` : ''}
                        ${this.config.settings.lives > 0 ? `<div id="ws-lives" class="ws-info-item"><i class="fa-solid fa-heart"></i> <span>${this.gameState.livesLeft}</span></div>` : ''}
                        <div id="ws-status-v2" class="ws-status-v2">Find the words!</div>
                    </div>
                    <div class="wordsearch-grid-v2" id="ws-grid" 
                         style="grid-template-columns: repeat(${this.wordsearchData.size}, 1fr)">
                        ${this.renderWSGrid()}
                    </div>
                </div>

                <div class="ws-side-column ws-right-clues">
                    <div class="clues-grid-v2" style="grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(4, 1fr);">
                        ${this.renderWSCluesV2(rightWords)}
                    </div>
                </div>
            </div>
        `;

        this.setupWSEvents();
        this.startTimer();
    },

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    },

    startTimer() {
        if (this.config.settings.timer === 'none') return;

        this.gameState.timerInterval = setInterval(() => {
            if (this.config.settings.timer === 'down') {
                this.gameState.timeLeft--;
                if (this.gameState.timeLeft <= 0) {
                    this.gameOver(false, 'Time is up!');
                }
            } else {
                this.gameState.timeLeft++;
            }
            
            const timerEl = document.getElementById('ws-timer') || document.getElementById('fc-timer');
            if (timerEl) timerEl.querySelector('span').textContent = this.formatTime(this.gameState.timeLeft);
        }, 1000);
    },

    loseLife() {
        if (this.config.settings.lives <= 0) return;
        
        this.gameState.livesLeft--;
        const livesEl = document.getElementById('ws-lives');
        if (livesEl) {
            livesEl.querySelector('span').textContent = this.gameState.livesLeft;
            livesEl.classList.add('shake');
            setTimeout(() => livesEl.classList.remove('shake'), 500);
        }
        
        if (this.gameState.livesLeft <= 0) {
            this.gameOver(false, 'No more lives left!');
        }
    },

    gameOver(success, message) {
        this.gameState.isGameOver = true;
        if (this.gameState.timerInterval) clearInterval(this.gameState.timerInterval);
        
        this.showSummary(success, message);
    },

    generateWordsearchGrid() {
        const size = this.wordsearchData.size;
        this.wordsearchData.grid = Array(size).fill().map(() => Array(size).fill(''));
        
        const sortedWords = [...this.words].sort((a, b) => b.word.length - a.word.length);
        
        sortedWords.forEach(wordObj => {
            const placed = this.placeWordInGrid(wordObj.word.toUpperCase().replace(/\s/g, ''));
            if (placed) {
                this.wordsearchData.placedWords.push({
                    id: wordObj.id,
                    word: wordObj.word.toUpperCase().replace(/\s/g, ''),
                    original: wordObj
                });
            }
        });

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (this.wordsearchData.grid[r][c] === '') {
                    this.wordsearchData.grid[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
                }
            }
        }
    },

    placeWordInGrid(word) {
        const size = this.wordsearchData.size;
        let directions = [[0, 1], [1, 0]]; // Horizontal and Vertical always
        
        if (this.config.settings.allowDiagonal) {
            directions.push([1, 1], [-1, 1]);
        }
        
        if (this.config.settings.allowReverse) {
            const revDirs = directions.map(d => [-d[0], -d[1]]);
            directions = directions.concat(revDirs);
        }
        
        directions.sort(() => Math.random() - 0.5);

        for (let attempt = 0; attempt < 100; attempt++) {
            const direction = directions[Math.floor(Math.random() * directions.length)];
            const dr = direction[0];
            const dc = direction[1];
            
            const startR = Math.floor(Math.random() * size);
            const startC = Math.floor(Math.random() * size);
            
            if (this.canPlaceWord(word, startR, startC, dr, dc)) {
                for (let i = 0; i < word.length; i++) {
                    this.wordsearchData.grid[startR + i * dr][startC + i * dc] = word[i];
                }
                return true;
            }
        }
        return false;
    },

    canPlaceWord(word, r, c, dr, dc) {
        const size = this.wordsearchData.size;
        if (r + (word.length - 1) * dr < 0 || r + (word.length - 1) * dr >= size ||
            c + (word.length - 1) * dc < 0 || c + (word.length - 1) * dc >= size) {
            return false;
        }

        for (let i = 0; i < word.length; i++) {
            const cell = this.wordsearchData.grid[r + i * dr][c + i * dc];
            if (cell !== '' && cell !== word[i]) {
                return false;
            }
        }
        return true;
    },

    renderWSGrid() {
        let html = '';
        for (let r = 0; r < this.wordsearchData.size; r++) {
            for (let c = 0; c < this.wordsearchData.size; c++) {
                html += `<div class="ws-cell" data-r="${r}" data-c="${c}">${this.wordsearchData.grid[r][c]}</div>`;
            }
        }
        return html;
    },

    renderWSCluesV2(placedWordsList) {
        return placedWordsList.map(placed => {
            const word = placed.original;
            let content = '';
            const clueTypes = this.config.settings.clueTypes;
            
            if (clueTypes.includes('image')) {
                const imgPath = `assets/images/vocabulary/${word.word.toLowerCase()}.png`;
                let visual = `
                    <img src="${imgPath}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                    <div style="display:none" class="clue-icon"><i class="${word.icon}"></i></div>
                `;
                if (word.category === 'colors') {
                    visual = `<div class="clue-color-circle" style="background-color: ${this.getColorHex(word.word)}"></div>`;
                } else if (word.category === 'shapes') {
                     visual = `<div style="transform: scale(0.3); margin: -50px;">${this.getShapeHtml(word.word)}</div>`;
                }
                content += `<div class="clue-image-container-v2">${visual}</div>`;
            }

            if (clueTypes.includes('audio')) {
                content += `
                    <button class="sound-btn-small clue-audio-v2" onclick="event.stopPropagation(); PracticeModule.playSound('${word.word}')">
                        <i class="fa-solid fa-volume-high"></i>
                    </button>
                `;
            }

            if (clueTypes.includes('text')) {
                content += `<div class="clue-text-v2">${word.word}</div>`;
            }

            return `<div class="ws-clue-v2" id="clue-${word.id}" data-id="${word.id}">${content}</div>`;
        }).join('');
    },

    setupWSEvents() {
        const grid = document.getElementById('ws-grid');
        
        const getCell = (e) => {
            let clientX, clientY;
            if (e.touches) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            const el = document.elementFromPoint(clientX, clientY);
            return el && el.classList.contains('ws-cell') ? el : null;
        };

        const startSelection = (cell) => {
            if (!cell || this.gameState.isGameOver) return;
            
            if (this.config.settings.mustClickClue && this.gameState.pendingClueMatch) {
                this.updateWSStatusV2("Click the correct clue card first!", "error");
                return;
            }

            this.wordsearchData.isSelecting = true;
            this.wordsearchData.selectedCells = [cell];
            cell.classList.add('selecting');
        };

        const updateSelection = (cell) => {
            if (!this.wordsearchData.isSelecting || !cell || this.gameState.isGameOver) return;
            if (this.wordsearchData.selectedCells.includes(cell)) return;

            const lastCell = this.wordsearchData.selectedCells[0];
            const r1 = parseInt(lastCell.dataset.r);
            const c1 = parseInt(lastCell.dataset.c);
            const r2 = parseInt(cell.dataset.r);
            const c2 = parseInt(cell.dataset.c);

            const dr = r2 - r1;
            const dc = c2 - c1;
            
            if (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) {
                document.querySelectorAll('.ws-cell.selecting').forEach(c => c.classList.remove('selecting'));
                
                const steps = Math.max(Math.abs(dr), Math.abs(dc));
                const stepR = dr === 0 ? 0 : dr / steps;
                const stepC = dc === 0 ? 0 : dc / steps;
                
                this.wordsearchData.selectedCells = [];
                for (let i = 0; i <= steps; i++) {
                    const r = r1 + i * stepR;
                    const c = c1 + i * stepC;
                    const currentCell = document.querySelector(`.ws-cell[data-r="${r}"][data-c="${c}"]`);
                    if (currentCell) {
                        this.wordsearchData.selectedCells.push(currentCell);
                        currentCell.classList.add('selecting');
                    }
                }
            }
        };

        const endSelection = () => {
            if (!this.wordsearchData.isSelecting || this.gameState.isGameOver) return;
            this.wordsearchData.isSelecting = false;
            
            const selectedWord = this.wordsearchData.selectedCells.map(c => c.textContent).join('');
            const reversedWord = selectedWord.split('').reverse().join('');
            
            const match = this.wordsearchData.placedWords.find(p => 
                (p.word === selectedWord || p.word === reversedWord) && !this.wordsearchData.foundWords.includes(p.id)
            );

            if (match) {
                this.wordsearchData.foundWords.push(match.id);
                this.wordsearchData.selectedCells.forEach(c => {
                    c.classList.remove('selecting');
                    c.classList.add('found');
                });
                
                if (this.config.settings.mustClickClue) {
                    this.gameState.pendingClueMatch = match.id;
                    this.updateWSStatusV2(`Found: ${match.word}! Now click the clue.`, "success");
                    document.getElementById(`clue-${match.id}`).classList.add('highlight-pending');
                } else {
                    const clueEl = document.getElementById(`clue-${match.id}`);
                    if (clueEl) clueEl.classList.add('matched');
                    this.updateWSStatusV2(`Found: ${match.word}!`, "success");
                    this.checkWSCompletion();
                }
            } else {
                document.querySelectorAll('.ws-cell.selecting').forEach(c => c.classList.remove('selecting'));
                if (this.config.settings.lives > 0) {
                    this.loseLife();
                }
            }
            this.wordsearchData.selectedCells = [];
        };

        grid.addEventListener('mousedown', (e) => {
            const cell = getCell(e);
            if (cell) startSelection(cell);
        });

        window.addEventListener('mousemove', (e) => {
            if (this.wordsearchData.isSelecting) {
                const cell = getCell(e);
                updateSelection(cell);
            }
        });

        window.addEventListener('mouseup', endSelection);

        grid.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const cell = getCell(e);
            if (cell) startSelection(cell);
        });

        grid.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const cell = getCell(e);
            updateSelection(cell);
        });

        grid.addEventListener('touchend', endSelection);

        // Clue clicking
        document.querySelectorAll('.ws-clue-v2').forEach(clueEl => {
            clueEl.addEventListener('click', () => {
                if (this.gameState.isGameOver || clueEl.classList.contains('matched')) return;

                if (this.config.settings.mustClickClue) {
                    if (!this.gameState.pendingClueMatch) {
                        this.updateWSStatusV2("Find a word in the grid first!", "error");
                        return;
                    }

                    if (clueEl.dataset.id === this.gameState.pendingClueMatch) {
                        clueEl.classList.remove('highlight-pending');
                        clueEl.classList.add('matched');
                        this.gameState.pendingClueMatch = null;
                        this.updateWSStatusV2("Correct!", "success");
                        this.playSound(window.vocabularyBank.find(w => w.id === clueEl.dataset.id).word);
                        this.checkWSCompletion();
                    } else {
                        this.updateWSStatusV2("Wrong clue!", "error");
                        this.loseLife();
                    }
                }
            });
        });
    },

    updateWSStatusV2(msg, type) {
        const el = document.getElementById('ws-status-v2');
        if (!el) return;
        el.textContent = msg;
        el.className = 'ws-status-v2 ' + type;
        setTimeout(() => {
            if (!this.gameState.isGameOver) el.className = 'ws-status-v2';
        }, 2000);
    },

    checkWSCompletion() {
        const totalWords = this.wordsearchData.placedWords.length;
        const foundWords = this.wordsearchData.foundWords.length;
        
        if (foundWords === totalWords) {
            setTimeout(() => this.gameOver(true), 500);
        }
    },

    checkSentences() {
        document.querySelectorAll('.sentence-input').forEach(input => {
            const answer = input.dataset.answer;
            if (input.value.trim().toLowerCase() === answer.toLowerCase()) {
                input.style.borderColor = '#28a745';
                input.style.backgroundColor = '#d4edda';
            } else {
                input.style.borderColor = '#dc3545';
                input.style.backgroundColor = '#f8d7da';
            }
        });
    },

    // --- UNJUMBLE LOGIC ---
    renderUnjumble(container) {
        const wordObj = this.words[this.currentIndex];
        // Split the word/phrase into individual words
        const words = wordObj.word.split(' ');
        
        if (words.length <= 1) {
            // If it's just one word, unjumbling words doesn't make sense.
            // We could unjumble letters, but the user asked for words.
            // Let's just treat it as a special case or show it anyway.
        }

        const shuffled = [...words].sort(() => Math.random() - 0.5);
        const imgPath = `assets/images/vocabulary/${wordObj.word.toLowerCase()}.png`;

        let visual = `
            <img src="${imgPath}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'" style="max-height: 150px; margin-bottom: 10px;">
            <div style="display:none; font-size: 3rem; color: var(--hot-pink);"><i class="${wordObj.icon}"></i></div>
        `;

        if (wordObj.category === 'colors') {
            visual = `<div class="clue-color-circle" style="width: 100px; height: 100px; margin: 0 auto 10px auto; background-color: ${this.getColorHex(wordObj.word)}"></div>`;
        } else if (wordObj.category === 'shapes') {
             visual = `<div style="transform: scale(0.8); margin-bottom: 20px;">${this.getShapeHtml(wordObj.word)}</div>`;
        }

        container.innerHTML = `
            <div class="unjumble-exercise" style="width: 100%; max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 20px;">
                    ${visual}
                    <button class="sound-btn-large" style="margin: 0 auto 10px auto;" onclick="PracticeModule.playSound('${wordObj.word.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-volume-high"></i>
                    </button>
                    <h3 style="color: var(--indigo-velvet);">Unjumble the Phrase</h3>
                    <p style="color: #666;">Drag the words or click them in order:</p>
                </div>
                
                <div id="unjumble-feedback" class="unjumble-feedback" style="text-align: center; margin-bottom: 15px;"></div>
                
                <div class="unjumble-container target-area" id="unjumble-target"
                     style="min-height: 80px; padding: 20px; background: #f0f4ff; border: 2px dashed #cbd5e0; border-radius: 12px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; align-items: center;"
                     ondragover="PracticeModule.handleDragOver(event)"
                     ondragleave="event.currentTarget.classList.remove('drag-over')"
                     ondrop="event.currentTarget.classList.remove('drag-over')">
                </div>
                
                <div class="unjumble-container source-area" id="unjumble-source"
                     style="min-height: 80px; padding: 20px; background: #fff; border: 2px solid #eee; border-radius: 12px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; align-items: center;"
                     ondragover="PracticeModule.handleDragOver(event)"
                     ondragleave="event.currentTarget.classList.remove('drag-over')"
                     ondrop="event.currentTarget.classList.remove('drag-over')">
                    ${shuffled.map(w => `
                        <div class="unjumble-word" 
                             draggable="true" 
                             style="background: white; padding: 10px 20px; border-radius: 10px; border: 2px solid var(--indigo-velvet); color: var(--indigo-velvet); font-weight: 700; cursor: grab; user-select: none;"
                             ondragstart="PracticeModule.handleDragStart(event)" 
                             ondragend="PracticeModule.handleDragEnd(event)"
                             onclick="PracticeModule.handleUnjumbleClick(this)">${w}</div>
                    `).join('')}
                </div>

                <div style="text-align: center; display: flex; gap: 10px; justify-content: center;">
                    <button class="btn-primary" onclick="PracticeModule.checkUnjumble()">Check</button>
                    <button class="btn-secondary" onclick="PracticeModule.next()">Skip</button>
                </div>
                
                <p style="margin-top: 20px; text-align: center; color: #888;">Phrase ${this.currentIndex + 1} of ${this.words.length}</p>
            </div>
        `;
    },

    handleUnjumbleClick(wordEl) {
        const source = document.getElementById('unjumble-source');
        const target = document.getElementById('unjumble-target');
        
        if (wordEl.parentElement === source) {
            target.appendChild(wordEl);
        } else {
            source.appendChild(wordEl);
        }
    },

    handleDragStart(e) {
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.effectAllowed = 'move';
    },

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.unjumble-container').forEach(c => c.classList.remove('drag-over'));
    },

    handleDragOver(e) {
        e.preventDefault();
        const container = e.currentTarget;
        container.classList.add('drag-over');
        
        const dragging = document.querySelector('.dragging');
        if (!dragging) return;

        const afterElement = this.getDragAfterElement(container, e.clientX);
        if (afterElement == null) {
            container.appendChild(dragging);
        } else {
            container.insertBefore(dragging, afterElement);
        }
    },

    getDragAfterElement(container, x) {
        const draggableElements = [...container.querySelectorAll('.unjumble-word:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },

    checkUnjumble() {
        const wordObj = this.words[this.currentIndex];
        const targetArea = document.getElementById('unjumble-target');
        const feedback = document.getElementById('unjumble-feedback');
        
        const userSentence = Array.from(targetArea.children).map(el => el.textContent).join(' ');
        const correctAnswer = wordObj.word;
        
        const cleanUser = userSentence.toLowerCase().replace(/[.,!?;]$/, '');
        const cleanCorrect = correctAnswer.toLowerCase().replace(/[.,!?;]$/, '');

        if (cleanUser === cleanCorrect) {
            feedback.innerHTML = '✅ Correct!';
            feedback.style.color = '#28a745';
            targetArea.style.borderColor = '#28a745';
            targetArea.querySelectorAll('.unjumble-word').forEach(w => {
                w.style.backgroundColor = '#d4edda';
                w.style.borderColor = '#28a745';
            });
            setTimeout(() => this.next(), 1000);
        } else {
            feedback.innerHTML = '❌ Try again!';
            feedback.style.color = '#dc3545';
            targetArea.style.borderColor = '#dc3545';
            targetArea.querySelectorAll('.unjumble-word').forEach(w => {
                w.style.backgroundColor = '#f8d7da';
                w.style.borderColor = '#dc3545';
            });
        }
    },

    // --- CROSSWORD LOGIC ---
    crosswordData: {
        grid: [],
        size: 15,
        placedWords: [],
        clues: { across: [], down: [] }
    },

    renderCrossword(container) {
        this.generateCrossword();
        
        container.innerHTML = `
            <div class="crossword-container">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: var(--indigo-velvet);">Crossword Challenge</h2>
                    <p style="color: #666;">Fill in the words based on the clues!</p>
                </div>

                <div class="crossword-layout">
                    <div class="crossword-grid-wrapper">
                        <div class="crossword-grid" style="grid-template-columns: repeat(${this.crosswordData.size}, 1fr)">
                            ${this.renderCWGrid()}
                        </div>
                    </div>
                    
                    <div class="crossword-clues">
                        <div class="clue-group">
                            <h3><i class="fa-solid fa-arrows-left-right"></i> Across</h3>
                            <div id="clues-across">
                                ${this.renderCWClueList('across')}
                            </div>
                        </div>
                        <div class="clue-group" style="margin-top: 30px;">
                            <h3><i class="fa-solid fa-arrows-up-down"></i> Down</h3>
                            <div id="clues-down">
                                ${this.renderCWClueList('down')}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn-primary" onclick="PracticeModule.checkCrossword()">Check Crossword</button>
                    <button class="btn-secondary" onclick="window.location.reload()">Restart</button>
                </div>
            </div>
        `;

        this.setupCWEvents();
    },

    generateCrossword() {
        const size = 15;
        this.crosswordData.size = size;
        this.crosswordData.grid = Array(size).fill().map(() => Array(size).fill({ char: null, isSpace: false, number: null }));
        this.crosswordData.placedWords = [];
        this.crosswordData.clues = { across: [], down: [] };

        // Sort words by length descending
        const sortedWords = [...this.words].sort((a, b) => b.word.length - a.word.length);
        
        // Place first word in middle
        const firstWord = sortedWords[0];
        const startR = Math.floor(size / 2);
        const startC = Math.floor((size - firstWord.word.length) / 2);
        this.placeCWWord(firstWord, startR, startC, 'across', 1);

        // Try to place other words
        let wordCounter = 2;
        for (let i = 1; i < sortedWords.length; i++) {
            const wordObj = sortedWords[i];
            const cleanWord = wordObj.word.toUpperCase();
            let placedSuccessfully = false;

            // Try to intersect with already placed words
            for (const placed of this.crosswordData.placedWords) {
                for (let idx = 0; idx < cleanWord.length; idx++) {
                    const char = cleanWord[idx];
                    if (char === ' ') continue;

                    for (let j = 0; j < placed.word.length; j++) {
                        if (char === placed.word[j]) {
                            // Possible intersection
                            const newDir = placed.dir === 'across' ? 'down' : 'across';
                            const newR = newDir === 'down' ? placed.r - idx : placed.r + j;
                            const newC = newDir === 'down' ? placed.c + j : placed.c - idx;

                            if (this.canPlaceCWWord(cleanWord, newR, newC, newDir)) {
                                this.placeCWWord(wordObj, newR, newC, newDir, wordCounter++);
                                placedSuccessfully = true;
                                break;
                            }
                        }
                    }
                    if (placedSuccessfully) break;
                }
                if (placedSuccessfully) break;
            }
        }
    },

    canPlaceCWWord(word, r, c, dir) {
        const size = this.crosswordData.size;
        if (r < 0 || c < 0 || r >= size || c >= size) return false;

        if (dir === 'across') {
            if (c + word.length > size) return false;
            for (let i = -1; i <= word.length; i++) {
                for (let j = -1; j <= 1; j++) {
                    const rr = r + j;
                    const cc = c + i;
                    if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
                    
                    const cell = this.crosswordData.grid[rr][cc];
                    if (j === 0 && i >= 0 && i < word.length) {
                        if (cell.char && cell.char !== word[i]) return false;
                    } else {
                        if (cell.char) return false;
                    }
                }
            }
        } else {
            if (r + word.length > size) return false;
            for (let i = -1; i <= word.length; i++) {
                for (let j = -1; j <= 1; j++) {
                    const rr = r + i;
                    const cc = c + j;
                    if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;

                    const cell = this.crosswordData.grid[rr][cc];
                    if (j === 0 && i >= 0 && i < word.length) {
                        if (cell.char && cell.char !== word[i]) return false;
                    } else {
                        if (cell.char) return false;
                    }
                }
            }
        }
        return true;
    },

    placeCWWord(wordObj, r, c, dir, number) {
        const word = wordObj.word.toUpperCase();
        for (let i = 0; i < word.length; i++) {
            const rr = dir === 'across' ? r : r + i;
            const cc = dir === 'across' ? c + i : c;
            
            const cell = { ...this.crosswordData.grid[rr][cc] };
            cell.char = word[i];
            if (word[i] === ' ') cell.isSpace = true;
            if (i === 0) cell.number = number;
            
            this.crosswordData.grid[rr][cc] = cell;
        }

        this.crosswordData.placedWords.push({
            word: word,
            r: r,
            c: c,
            dir: dir,
            number: number,
            obj: wordObj
        });

        this.crosswordData.clues[dir].push({
            number: number,
            word: word,
            obj: wordObj
        });
    },

    renderCWGrid() {
        let html = '';
        for (let r = 0; r < this.crosswordData.size; r++) {
            for (let c = 0; c < this.crosswordData.size; c++) {
                const cell = this.crosswordData.grid[r][c];
                if (cell.char) {
                    const isSpace = cell.char === ' ';
                    html += `
                        <div class="cw-cell active ${isSpace ? 'space' : ''}" data-r="${r}" data-c="${c}">
                            ${cell.number ? `<span class="cw-number">${cell.number}</span>` : ''}
                            ${!isSpace ? `<input type="text" class="cw-input" maxlength="1" data-r="${r}" data-c="${c}" data-answer="${cell.char}">` : ''}
                        </div>
                    `;
                } else {
                    html += `<div class="cw-cell"></div>`;
                }
            }
        }
        return html;
    },

    renderCWClueList(dir) {
        const clues = this.crosswordData.clues[dir].sort((a, b) => a.number - b.number);
        if (clues.length === 0) return '<p style="color: #999; padding: 10px;">None</p>';

        return clues.map(clue => {
            let content = '';
            switch(this.config.face) {
                case 'easy':
                    const imgPath = `assets/images/vocabulary/${clue.obj.word.toLowerCase()}.png`;
                    content = `<img src="${imgPath}" class="clue-visual" onerror="this.src='assets/images/thumbnails/flashcards.svg'">`;
                    break;
                case 'text':
                    content = `<span>${clue.obj.spanish}</span>`;
                    break;
                case 'audio':
                    content = `<button class="clue-audio-btn" onclick="PracticeModule.playSound('${clue.obj.word}')"><i class="fa-solid fa-volume-high"></i></button>`;
                    break;
                default:
                    content = `<span>${clue.obj.word}</span>`;
            }

            return `
                <div class="clue-item" data-number="${clue.number}" data-dir="${dir}">
                    <strong>${clue.number}.</strong>
                    ${content}
                </div>
            `;
        }).join('');
    },

    setupCWEvents() {
        const inputs = document.querySelectorAll('.cw-input');
        
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                if (e.target.value) {
                    this.moveCWFocus(e.target, 1);
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value) {
                    this.moveCWFocus(e.target, -1);
                } else if (e.key === 'ArrowRight') {
                    this.moveCWFocus(e.target, 1, 'across');
                } else if (e.key === 'ArrowLeft') {
                    this.moveCWFocus(e.target, -1, 'across');
                } else if (e.key === 'ArrowDown') {
                    this.moveCWFocus(e.target, 1, 'down');
                } else if (e.key === 'ArrowUp') {
                    this.moveCWFocus(e.target, -1, 'down');
                }
            });

            input.addEventListener('focus', () => {
                document.querySelectorAll('.clue-item').forEach(el => el.classList.remove('active'));
                const r = parseInt(input.dataset.r);
                const c = parseInt(input.dataset.c);
                
                const words = this.crosswordData.placedWords.filter(pw => {
                    if (pw.dir === 'across') {
                        return pw.r === r && c >= pw.c && c < pw.c + pw.word.length;
                    } else {
                        return pw.c === c && r >= pw.r && r < pw.r + pw.word.length;
                    }
                });

                words.forEach(w => {
                    const clueEl = document.querySelector(`.clue-item[data-number="${w.number}"][data-dir="${w.dir}"]`);
                    if (clueEl) clueEl.classList.add('active');
                });
            });
        });
    },

    moveCWFocus(current, delta, forceDir = null) {
        const r = parseInt(current.dataset.r);
        const c = parseInt(current.dataset.c);
        
        let dir = forceDir;
        if (!dir) {
            const across = this.crosswordData.placedWords.some(pw => pw.dir === 'across' && pw.r === r && c >= pw.c && c < pw.c + pw.word.length);
            dir = across ? 'across' : 'down';
        }

        let nextR = r;
        let nextC = c;
        
        if (dir === 'across') nextC += delta;
        else nextR += delta;

        const cell = this.crosswordData.grid[nextR] ? this.crosswordData.grid[nextR][nextC] : null;
        if (cell && cell.isSpace) {
            if (dir === 'across') nextC += delta;
            else nextR += delta;
        }

        const nextInput = document.querySelector(`.cw-input[data-r="${nextR}"][data-c="${nextC}"]`);
        if (nextInput) nextInput.focus();
    },

    checkCrossword() {
        // ... (existing code)
    },

    // --- QUIZ LOGIC ---
    renderQuiz(container) {
        const question = this.words[this.currentIndex];
        const sentenceParts = question.sentence.split('____');
        const progress = ((this.currentIndex + 1) / this.words.length) * 100;
        
        // Shuffle options if not already shuffled for this question
        if (!question._shuffledOptions) {
            question._shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
        }

        container.innerHTML = `
            <div class="quiz-container">
                <div class="quiz-progress-container">
                    <div class="quiz-progress-text">
                        <span>Question ${this.currentIndex + 1} of ${this.words.length}</span>
                        <span>${Math.round(progress)}% Complete</span>
                    </div>
                    <div class="quiz-progress-bar-bg">
                        <div class="quiz-progress-bar-fill" style="width: ${progress}%"></div>
                    </div>
                </div>

                <div class="quiz-question-container">
                    <div class="quiz-sentence">
                        ${sentenceParts[0]}<span class="blank" id="quiz-blank">____</span>${sentenceParts[1] || ''}
                    </div>
                    ${question.audio ? `
                    <button class="sound-btn-large" style="margin-top: 20px;" onclick="PracticeModule.playQuizAudio('${question.audio.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-volume-high"></i>
                    </button>` : ''}
                </div>

                <div id="quiz-hint-area" style="margin-bottom: 20px;">
                    <button class="quiz-hint-btn" id="quiz-hint-btn" onclick="PracticeModule.toggleQuizHint()">
                        <i class="fa-solid fa-lightbulb"></i> Need a hint?
                    </button>
                    <div id="quiz-hint-text" class="quiz-hint-text" style="display: none;">
                        <strong>Hint:</strong> ${question.hint}
                    </div>
                </div>

                <div class="quiz-options">
                    ${question._shuffledOptions.map((option, index) => `
                        <div class="quiz-option" 
                             style="animation-delay: ${0.1 + (index * 0.1)}s"
                             onclick="PracticeModule.checkQuizAnswer(this, '${option}')">
                            ${option}
                        </div>
                    `).join('')}
                </div>

                <div id="quiz-feedback" style="min-height: 50px;"></div>
            </div>
        `;
    },

    checkQuizAnswer(optionEl, selectedOption) {
        if (document.querySelector('.quiz-option.correct')) return;

        const question = this.words[this.currentIndex];
        const feedback = document.getElementById('quiz-feedback');
        const blank = document.getElementById('quiz-blank');

        if (selectedOption === question.answer) {
            // Correct Answer
            optionEl.classList.add('correct');
            blank.textContent = question.answer;
            blank.style.color = '#2ECC71';
            blank.style.borderBottomStyle = 'solid';
            
            // Disable other options
            document.querySelectorAll('.quiz-option').forEach(opt => {
                if (opt !== optionEl) opt.style.opacity = '0.5';
                opt.style.pointerEvents = 'none';
            });

            feedback.innerHTML = `
                <div style="color: #2ECC71; font-weight: 800; font-size: 1.5rem; animation: bounce 0.5s ease;">
                    <i class="fa-solid fa-circle-check"></i> Amazing! That's correct!
                </div>
            `;
            
            if (question.audio) {
                this.playQuizAudio(question.audio);
            } else {
                this.playSound(question.answer);
            }

            setTimeout(() => {
                // Remove shuffled state for next session
                delete question._shuffledOptions;
                
                if (this.currentIndex < this.words.length - 1) {
                    this.currentIndex++;
                    this.render();
                } else {
                    this.showSummary();
                }
            }, 1800);
        } else {
            // Wrong Answer
            optionEl.classList.add('wrong');
            feedback.innerHTML = `
                <div style="color: #E74C3C; font-weight: 700; font-size: 1.2rem; animation: shake 0.5s ease;">
                    <i class="fa-solid fa-circle-xmark"></i> Not quite, try another one!
                </div>
            `;
            
            setTimeout(() => {
                optionEl.classList.remove('wrong');
                feedback.innerHTML = '';
            }, 1200);
        }
    },

    toggleQuizHint() {
        const hintText = document.getElementById('quiz-hint-text');
        const hintBtn = document.getElementById('quiz-hint-btn');
        const isHidden = hintText.style.display === 'none';
        
        hintText.style.display = isHidden ? 'block' : 'none';
        hintBtn.innerHTML = isHidden ? 
            '<i class="fa-solid fa-eye-slash"></i> Hide hint' : 
            '<i class="fa-solid fa-lightbulb"></i> Need a hint?';
    },

    // --- SHARED ---
    next() {
        if (this.currentIndex < this.words.length - 1) {
            this.currentIndex++;
            this.render();
        } else {
            // End of deck
            this.showSummary();
        }
    },

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.render();
        }
    },

    redo() {
        // Reset Game State
        this.gameState.isGameOver = false;
        this.gameState.pendingClueMatch = null;
        
        if (this.config.mode === 'wordsearch') {
             this.gameState.timeLeft = this.config.settings.timerValue;
             this.gameState.livesLeft = this.config.settings.lives;
        } else {
            this.currentIndex = 0;
            this.matches = 0;
        }
        
        this.render();
    },

    showSummary(success = true, message = '') {
        const settingsBtn = document.getElementById('change-options-btn');
        if (settingsBtn) settingsBtn.style.display = 'none';
        let content = '';
        
        if (this.difficultWords.length > 0 && this.config.mode === 'flashcards') {
            content = `
                <div class="summary-container">
                    <h1>🎉 Session Complete!</h1>
                    <p>You have reviewed all words.</p>
                    <div style="margin: 30px 0; padding: 30px; background: #fff3f3; border-radius: 20px; border: 1px solid #ffcdd2;">
                        <h3>Keep Practicing!</h3>
                        <p style="margin-bottom: 20px;">You marked <strong>${this.difficultWords.length} words</strong> as difficult.</p>
                        <button class="btn-primary" style="background-color: #E74C3C;" onclick="PracticeModule.startReviewSession()">
                            Review Difficult Words (${this.difficultWords.length})
                        </button>
                    </div>
                    <div class="summary-actions">
                        <button class="btn-secondary" onclick="window.close()">Close</button>
                        <button class="btn-secondary" onclick="PracticeModule.showModeSelection()">Choose Game Mode</button>
                    </div>
                </div>
            `;
        } else {
            let title = '🎉 Excellent!';
            let subtext = 'You have completed all words in this set.';
            let icon = 'fa-trophy';
            let extraButtons = '';
            
            if (!success) {
                title = 'Game Over';
                subtext = message || 'Better luck next time!';
                icon = 'fa-face-sad-tear';
                
                if (message && message.includes('Time')) {
                    title = "Time's Up!";
                    icon = 'fa-hourglass-end';
                } else if (message && message.includes('lives')) {
                    title = "Out of Lives!";
                    icon = 'fa-heart-crack';
                }
                
                extraButtons = `<button class="btn-primary" onclick="PracticeModule.redo()">Try Again</button>`;
            } else {
                // Success case - also allow replaying?
                extraButtons = `<button class="btn-primary" onclick="PracticeModule.redo()">Play Again</button>`;
            }

            content = `
                <div class="summary-container">
                    <h1><i class="fa-solid ${icon}"></i> ${title}</h1>
                    <p>${subtext}</p>
                    <div class="summary-actions">
                        ${extraButtons}
                        <button class="btn-secondary" onclick="PracticeModule.showModeSelection()">Choose Game Mode</button>
                        <button class="btn-secondary" onclick="window.close()">Close</button>
                    </div>
                </div>
            `;
        }
        
        document.getElementById('game-area').innerHTML = content;
    },

    playSound(wordText) {
        const cleanText = wordText.toLowerCase().replace(/\?/g, '');
        const audioPath = `assets/audio/vocabulary/${cleanText}.mp3`;
        const audio = new Audio(audioPath);
        
        audio.play().catch((e) => {
            console.log('Audio file not found or playback failed, using synthesis for:', wordText, e);
            if ('speechSynthesis' in window) {
                const speech = new SpeechSynthesisUtterance(wordText);
                speech.lang = 'en-US';
                speech.rate = 0.8;
                window.speechSynthesis.speak(speech);
            }
        });
    },

    playQuizAudio(audioPath) {
        const audio = new Audio(audioPath);
        audio.play().catch(e => console.error('Error playing quiz audio:', e));
    },

    getShapeHtml(word, isLarge = false) {
        const shapeClassMap = {
            'circle': 'shape-circle',
            'square': 'shape-square',
            'triangle': 'shape-triangle',
            'rectangle': 'shape-rectangle',
            'oval': 'shape-oval',
            'star': 'shape-star',
            'diamond': 'shape-diamond',
            'hexagon': 'shape-hexagon',
            'pentagon': 'shape-pentagon',
            'sphere': 'shape-sphere',
            'cube': 'shape-cube',
            'pyramid': 'shape-pyramid',
            'cylinder': 'shape-cylinder-simple',
            'cone': 'shape-cone-final'
        };
        const shapeClass = shapeClassMap[word.toLowerCase()] || 'shape-circle';
        
        // Some shapes need specific inner HTML for 3D effects
        let innerHtml = '';
        if (shapeClass === 'shape-cube') {
            innerHtml = `
                <div class="cube-face cube-front"></div>
                <div class="cube-face cube-back"></div>
                <div class="cube-face cube-right"></div>
                <div class="cube-face cube-left"></div>
                <div class="cube-face cube-top"></div>
                <div class="cube-face cube-bottom"></div>
            `;
        } else if (shapeClass === 'shape-pyramid') {
             innerHtml = `
                <div class="pyramid-side pyramid-front"></div>
                <div class="pyramid-side pyramid-back"></div>
                <div class="pyramid-side pyramid-left"></div>
                <div class="pyramid-side pyramid-right"></div>
                <div class="pyramid-bottom"></div>
            `;
        }
        
        return `<div class="shape-preview-container ${isLarge ? 'large' : ''}"><div class="css-shape ${shapeClass}">${innerHtml}</div></div>`;
    },

    getColorHex(colorName) {
        const colors = {
            'red': '#E02121',
            'blue': '#0000FF',
            'green': '#008000',
            'yellow': '#FFFB00',
            'orange': '#FF8C00',
            'purple': '#4B0082',
            'pink': '#FFC0CB',
            'black': '#000000',
            'white': '#FFFFFF',
            'brown': '#8B4513',
            'gray': '#808080',
            'vermilion': '#F46036',
            'amber': '#FFC000',
            'chartreuse': '#9ACD32',
            'teal': '#008080',
            'violet': '#8A2BE2',
            'magenta': '#C71585'
        };
        return colors[colorName.toLowerCase()] || '#CCCCCC';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    PracticeModule.init();
});
