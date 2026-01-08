const PracticeModule = {
    words: [],
    difficultWords: [], // To track words user struggled with
    currentIndex: 0,
    config: {
        mode: 'flashcards', // flashcards, matching, spelling, sentences
        face: 'word_first' // for flashcards
    },
    matches: 0,

    init() {
        const params = new URLSearchParams(window.location.search);
        const ids = params.get('ids')?.split(',') || [];
        this.config.mode = params.get('mode') || 'flashcards';
        this.config.face = params.get('face') || 'word_first';
        this.config.submode = params.get('face'); // Reuse 'face' param for wordsearch submodes

        // Load words
        this.words = window.vocabularyBank.filter(w => ids.includes(w.id));
        this.difficultWords = []; // Reset difficult words on init
        
        if (this.words.length === 0) {
            document.getElementById('game-area').innerHTML = '<p>No words selected.</p>';
            return;
        }

        this.render();
        this.setupFullScreen();
    },

    setupFullScreen() {
        if (document.getElementById('fullscreen-btn')) return;
        
        const btn = document.createElement('button');
        btn.id = 'fullscreen-btn';
        btn.innerHTML = '<i class="fa-solid fa-expand"></i>';
        btn.title = 'Toggle Full Screen';
        btn.onclick = () => this.toggleFullScreen();
        document.body.appendChild(btn);
    },

    toggleFullScreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            document.getElementById('fullscreen-btn').innerHTML = '<i class="fa-solid fa-compress"></i>';
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                document.getElementById('fullscreen-btn').innerHTML = '<i class="fa-solid fa-expand"></i>';
            }
        }
    },

    render() {
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
        
        const imageHtml = `
            <img src="${imgPath}" class="card-content-image" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block'" 
                 alt="${word.word}">
            <div style="display:none" class="card-content-icon"><i class="${word.icon}"></i></div>
        `;
        
        const soundBtnSmall = `<button class="sound-btn-small" onclick="event.stopPropagation(); PracticeModule.playSound('${word.word}')"><i class="fa-solid fa-volume-high"></i></button>`;
        const soundBtnLarge = `<button class="sound-btn-large" onclick="event.stopPropagation(); PracticeModule.playSound('${word.word}')"><i class="fa-solid fa-volume-high"></i></button>`;

        switch(this.config.face) {
            case 'word_first':
                frontContent = wordHtml;
                backContent = imageHtml + soundBtnSmall;
                break;
            case 'image_first':
                frontContent = imageHtml;
                backContent = wordHtml + soundBtnSmall;
                break;
            case 'sound_first':
                frontContent = soundBtnLarge;
                backContent = imageHtml + wordHtml;
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
                
                <div class="learning-controls" onclick="event.stopPropagation()">
                    <button class="learning-btn btn-known" title="I know this!" onclick="PracticeModule.markWord(true)">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="learning-btn btn-unknown" title="I need practice" onclick="PracticeModule.markWord(false)">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            
            <div class="practice-nav">
                <button class="nav-btn" id="prev-btn" onclick="PracticeModule.prev()" ${this.currentIndex === 0 ? 'disabled' : ''}>← Previous</button>
                <span style="font-weight: bold; font-size: 1.2rem;">${this.currentIndex + 1} / ${this.words.length}</span>
                <button class="nav-btn" id="next-btn" onclick="PracticeModule.next()" ${this.currentIndex === this.words.length - 1 ? 'disabled' : ''}>Next →</button>
            </div>
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

        // Move to next card
        this.next();
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
        // Limit to 6 pairs for better layout (or use all if small)
        const gameWords = this.words.slice(0, 8); 
        
        // Create left column (Images) and right column (Words)
        // We will shuffle both independently to create the challenge
        
        const leftItems = [...gameWords].sort(() => Math.random() - 0.5);
        const rightItems = [...gameWords].sort(() => Math.random() - 0.5);

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
                <h2 style="margin-bottom: 20px;">Match the Image to the Word</h2>
                <div class="matching-game">
                    <div class="matching-column" id="col-images">
                        ${leftItems.map(w => {
                            const imgPath = `assets/images/vocabulary/${w.word.toLowerCase()}.png`;
                            return `
                            <div class="match-card" data-id="${w.id}" data-type="image" onclick="PracticeModule.handleMatchClick(this)">
                                <img src="${imgPath}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                                <div style="display:none; font-size: 2rem; color: var(--hot-pink);"><i class="${w.icon}"></i></div>
                                <button class="sound-btn-small" style="width: 30px; height: 30px; font-size: 0.8rem; margin-left: 10px;" 
                                        onclick="event.stopPropagation(); PracticeModule.playSound('${w.word}')">
                                    <i class="fa-solid fa-volume-high"></i>
                                </button>
                            </div>`;
                        }).join('')}
                    </div>
                    <div class="matching-column" id="col-words">
                        ${rightItems.map(w => `
                            <div class="match-card" data-id="${w.id}" data-type="word" onclick="PracticeModule.handleMatchClick(this)">
                                <span class="match-card-word">${w.word}</span>
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
        const selectedImage = document.querySelector('.match-card[data-type="image"].selected');
        const selectedWord = document.querySelector('.match-card[data-type="word"].selected');

        if (selectedImage && selectedWord) {
            if (selectedImage.dataset.id === selectedWord.dataset.id) {
                // Match!
                selectedImage.classList.remove('selected');
                selectedWord.classList.remove('selected');
                selectedImage.classList.add('correct');
                selectedWord.classList.add('correct');
                
                // Play success sound/effect?
                this.matches++;
                if (this.matches === document.querySelectorAll('.match-card[data-type="image"]').length) {
                    setTimeout(() => alert('🎉 All matched! Great job!'), 500);
                }
            } else {
                // No match
                setTimeout(() => {
                    selectedImage.classList.remove('selected');
                    selectedWord.classList.remove('selected');
                }, 500);
            }
        }
    },

    // --- SPELLING GAME LOGIC ---
    renderSpelling(container) {
        const word = this.words[this.currentIndex];
        const imgPath = `assets/images/vocabulary/${word.word.toLowerCase()}.png`;

        container.innerHTML = `
            <div class="spelling-container">
                <div class="spelling-image-container">
                    <img src="${imgPath}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                    <div style="display:none; font-size: 6rem; color: var(--hot-pink);"><i class="${word.icon}"></i></div>
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
        this.wordsearchData.size = this.words.length > 8 ? 15 : 12;
        this.wordsearchData.foundWords = [];
        this.wordsearchData.placedWords = [];
        this.wordsearchData.isPendingMatch = false;
        this.generateWordsearchGrid();

        container.innerHTML = `
            <div class="wordsearch-container">
                <div class="wordsearch-main">
                    <div id="ws-status-msg" class="ws-status-msg">Find a word in the grid!</div>
                    <div class="wordsearch-grid" id="ws-grid" 
                         style="grid-template-columns: repeat(${this.wordsearchData.size}, 1fr)">
                        ${this.renderWSGrid()}
                    </div>
                </div>
                <div class="wordsearch-clues">
                    <h3>Words to find:</h3>
                    <div class="clues-grid" id="ws-clues">
                        ${this.renderWSClues()}
                    </div>
                </div>
            </div>
        `;

        this.setupWSEvents();
    },

    generateWordsearchGrid() {
        const size = this.wordsearchData.size;
        this.wordsearchData.grid = Array(size).fill().map(() => Array(size).fill(''));
        
        // Sort words by length descending for better placement
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

        // Fill empty cells with random letters
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
        const directions = [
            [0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]
        ];
        
        // Randomly shuffle directions
        directions.sort(() => Math.random() - 0.5);

        for (let attempt = 0; attempt < 100; attempt++) {
            const direction = directions[attempt % directions.length];
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

    renderWSClues() {
        return this.wordsearchData.placedWords.map(placed => {
            const word = placed.original;
            let content = '';
            
            switch(this.config.submode) {
                case 'easy':
                    const imgPath = `assets/images/vocabulary/${word.word.toLowerCase()}.png`;
                    content = `
                        <div class="clue-image-container">
                            <img src="${imgPath}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                            <div style="display:none" class="clue-icon"><i class="${word.icon}"></i></div>
                        </div>
                    `;
                    break;
                case 'text':
                    content = `<div class="clue-text">${word.definition}</div>`;
                    break;
                case 'audio':
                    content = `
                        <button class="sound-btn-large" onclick="event.stopPropagation(); PracticeModule.playSound('${word.word}')">
                            <i class="fa-solid fa-volume-high"></i>
                        </button>
                    `;
                    break;
                default:
                    content = `<div class="clue-word">${word.word}</div>`;
            }

            return `<div class="ws-clue" id="clue-${word.id}" data-id="${word.id}">${content}</div>`;
        }).join('');
    },

    setupWSEvents() {
        const grid = document.getElementById('ws-grid');
        const cells = document.querySelectorAll('.ws-cell');

        const getCell = (e) => {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            return el && el.classList.contains('ws-cell') ? el : null;
        };

        const startSelection = (cell) => {
            if (!cell) return;
            
            if (this.wordsearchData.isPendingMatch) {
                this.updateWSStatus("Match the word with its clue first!", "error");
                const cluesBox = document.querySelector('.wordsearch-clues');
                cluesBox.classList.add('highlight-clues');
                setTimeout(() => cluesBox.classList.remove('highlight-clues'), 500);
                return;
            }

            this.wordsearchData.isSelecting = true;
            this.wordsearchData.selectedCells = [cell];
            cell.classList.add('selecting');
        };

        const updateSelection = (cell) => {
            if (!this.wordsearchData.isSelecting || !cell) return;
            if (this.wordsearchData.selectedCells.includes(cell)) return;

            const lastCell = this.wordsearchData.selectedCells[0];
            const r1 = parseInt(lastCell.dataset.r);
            const c1 = parseInt(lastCell.dataset.c);
            const r2 = parseInt(cell.dataset.r);
            const c2 = parseInt(cell.dataset.c);

            // Calculate direction
            const dr = r2 - r1;
            const dc = c2 - c1;
            
            // Only allow straight lines (horizontal, vertical, diagonal)
            if (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) {
                // Clear previous selection visually
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
            if (!this.wordsearchData.isSelecting) return;
            this.wordsearchData.isSelecting = false;
            
            const selectedWord = this.wordsearchData.selectedCells.map(c => c.textContent).join('');
            const reversedWord = selectedWord.split('').reverse().join('');
            
            const match = this.wordsearchData.placedWords.find(p => 
                (p.word === selectedWord || p.word === reversedWord) && !this.wordsearchData.foundWords.includes(p.id)
            );

            if (match) {
                // Success! Word found in grid
                this.wordsearchData.foundWords.push(match.id);
                this.wordsearchData.selectedCells.forEach(c => {
                    c.classList.remove('selecting');
                    c.classList.add('found');
                });
                
                const clueEl = document.getElementById(`clue-${match.id}`);
                clueEl.dataset.gridFound = "true";
                this.wordsearchData.isPendingMatch = true;
                
                this.updateWSStatus("Great! Now click the matching clue.", "match");
                this.checkWSCompletion();
            } else {
                document.querySelectorAll('.ws-cell.selecting').forEach(c => c.classList.remove('selecting'));
            }
            this.wordsearchData.selectedCells = [];
        };

        // Clue clicking for matching
        document.querySelectorAll('.ws-clue').forEach(clueEl => {
            clueEl.addEventListener('click', () => {
                if (clueEl.classList.contains('matched')) return;

                if (clueEl.dataset.gridFound === "true") {
                    // Match successful!
                    clueEl.classList.add('matched');
                    this.wordsearchData.isPendingMatch = false;
                    this.updateWSStatus("Correct! Find another word.", "success");
                    PracticeModule.playSound(window.vocabularyBank.find(w => w.id === clueEl.dataset.id).word);
                    this.checkWSCompletion();
                } else {
                    // Not found in grid yet or wrong match
                    this.updateWSStatus("Find this word in the grid first!", "error");
                    clueEl.classList.add('highlight-clues');
                    setTimeout(() => clueEl.classList.remove('highlight-clues'), 500);
                }
            });
        });

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

        // Touch support
        grid.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const cell = getCell(touch);
            if (cell) startSelection(cell);
        });

        grid.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const cell = getCell(touch);
            updateSelection(cell);
        });

        grid.addEventListener('touchend', endSelection);
    },

    updateWSStatus(msg, type) {
        const el = document.getElementById('ws-status-msg');
        if (!el) return;
        el.textContent = msg;
        el.className = 'ws-status-msg ' + type;
    },

    checkWSCompletion() {
        const totalWords = this.wordsearchData.placedWords.length;
        const foundWords = this.wordsearchData.foundWords.length;
        const matchedClues = document.querySelectorAll('.ws-clue.matched').length;
        
        if (foundWords === totalWords && matchedClues === totalWords) {
            setTimeout(() => this.showSummary(), 500);
        } else if (foundWords === totalWords) {
            // Hint to match the remaining clues
            // Subtle indication if needed
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

    showSummary() {
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
                        <button class="btn-secondary" onclick="window.location.reload()">Restart All</button>
                    </div>
                </div>
            `;
        } else {
            content = `
                <div class="summary-container">
                    <h1>🎉 Excellent!</h1>
                    <p>You have completed all words in this set.</p>
                    <div class="summary-actions">
                        <button class="btn-primary" onclick="window.location.reload()">Restart</button>
                        <button class="btn-secondary" onclick="window.close()">Close</button>
                    </div>
                </div>
            `;
        }
        
        document.getElementById('game-area').innerHTML = content;
    },

    playSound(wordText) {
        const audioPath = `assets/audio/vocabulary/${wordText.toLowerCase()}.mp3`;
        const audio = new Audio(audioPath);
        
        audio.play().catch(() => {
            console.log('Audio file not found, using synthesis');
            const speech = new SpeechSynthesisUtterance(wordText);
            speech.rate = 0.8;
            window.speechSynthesis.speak(speech);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    PracticeModule.init();
});
