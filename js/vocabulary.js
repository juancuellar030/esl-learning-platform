// Vocabulary Module
const VocabModule = {
    selectedWords: [],
    currentExerciseType: null,
    currentFlashcardIndex: 0,
    
    // Category mapping with icons
    categories: {
        'animals': { label: 'Animals', icon: 'fa-solid fa-paw' },
        'colors': { label: 'Colors', icon: 'fa-solid fa-palette' },
        'food': { label: 'Food & Drink', icon: 'fa-solid fa-utensils' },
        'body': { label: 'Body Parts', icon: 'fa-solid fa-child' },
        'clothes': { label: 'Clothes', icon: 'fa-solid fa-shirt' },
        'daily-routines': { label: 'Daily Routines', icon: 'fa-solid fa-clock' },
        'sports': { label: 'Sports & Activities', icon: 'fa-solid fa-volleyball' },
        'weather': { label: 'Weather', icon: 'fa-solid fa-cloud-sun' },
        'places': { label: 'Places', icon: 'fa-solid fa-map-location-dot' },
        'transport': { label: 'Transport', icon: 'fa-solid fa-car' },
        'arts': { label: 'Arts & Crafts', icon: 'fa-solid fa-palette' },
        'grammar-words': { label: 'Grammar & Questions', icon: 'fa-solid fa-question' },
        'time': { label: 'Calendar & Time', icon: 'fa-solid fa-calendar-days' }
    },

    init() {
        // Show categories by default initially
        this.renderCategories();
        this.setupEventListeners();
    },
    
    renderCategories() {
        const grid = document.getElementById('word-grid');
        grid.innerHTML = '';
        
        // Hide subcategory dropdown when showing all categories
        document.getElementById('subcategory-group').style.display = 'none';

        Object.keys(this.categories).forEach(key => {
            const cat = this.categories[key];
            const card = document.createElement('div');
            card.className = 'category-card';
            card.innerHTML = `
                <div class="category-icon"><i class="${cat.icon}"></i></div>
                <div class="category-label">${cat.label}</div>
            `;
            card.addEventListener('click', () => {
                document.getElementById('vocab-category').value = key;
                this.handleCategoryChange(key);
            });
            grid.appendChild(card);
        });
    },

    renderWords(category = 'all', level = 'all', searchTerm = '', subcategory = 'all') {
        const grid = document.getElementById('word-grid');
        
        if (category === 'all' && !searchTerm) {
            this.renderCategories();
            return;
        }

        let words = window.vocabularyBank;
        
        if (category !== 'all') {
            words = words.filter(w => w.category === category);
        }
        if (level !== 'all') {
            words = words.filter(w => w.level === level);
        }
        if (subcategory !== 'all') {
            words = words.filter(w => w.subcategory === subcategory);
        }
        if (searchTerm) {
            words = words.filter(w => 
                w.word.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        if (words.length === 0) {
            grid.innerHTML = '<p style="text-align: center; padding: 40px; color: #999; grid-column: 1/-1;">No words found matching your filters.</p>';
            return;
        }
        
        grid.innerHTML = words.map(word => `
            <div class="word-card ${this.selectedWords.includes(word.id) ? 'selected' : ''}" data-id="${word.id}">
                <div class="word-text">${word.word}</div>
                <div class="word-level ${word.level}">${word.level}</div>
                <div style="font-size: 0.8rem; color: #666; margin-top: 5px;">${word.subcategory ? word.subcategory.replace('-', ' ') : ''}</div>
            </div>
        `).join('');
        
        // Add click handlers
        document.querySelectorAll('.word-card').forEach(card => {
            card.addEventListener('click', () => {
                this.toggleWordSelection(card);
            });
        });
    },
    
    handleCategoryChange(category) {
        const subcategorySelect = document.getElementById('vocab-subcategory');
        const subcategoryGroup = document.getElementById('subcategory-group');
        const level = document.getElementById('vocab-level').value;
        const search = document.getElementById('vocab-search').value;

        // Reset subcategory select
        subcategorySelect.innerHTML = '<option value="all">All Subcategories</option>';
        
        if (category !== 'all') {
            // Find unique subcategories for this category
            const subcats = [...new Set(window.vocabularyBank
                .filter(w => w.category === category && w.subcategory)
                .map(w => w.subcategory))].sort();
            
            if (subcats.length > 0) {
                subcats.forEach(sub => {
                    const option = document.createElement('option');
                    option.value = sub;
                    option.textContent = sub.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    subcategorySelect.appendChild(option);
                });
                subcategoryGroup.style.display = 'flex';
            } else {
                subcategoryGroup.style.display = 'none';
            }
        } else {
            subcategoryGroup.style.display = 'none';
        }

        this.renderWords(category, level, search, 'all');
    },

    toggleWordSelection(card) {
        const wordId = card.dataset.id;
        card.classList.toggle('selected');
        
        if (card.classList.contains('selected')) {
            if (!this.selectedWords.includes(wordId)) {
                this.selectedWords.push(wordId);
            }
        } else {
            this.selectedWords = this.selectedWords.filter(id => id !== wordId);
        }
        
        this.updateGenerateButton();
    },
    
    playAudio(wordId) {
        const word = window.vocabularyBank.find(w => w.id === wordId);
        // Simulate audio playback
        const speech = new SpeechSynthesisUtterance(word.word);
        speech.rate = 0.8;
        window.speechSynthesis.speak(speech);
    },
    
    generateExercise() {
        if (this.selectedWords.length === 0) {
            alert('Please select at least one word!');
            return;
        }
        document.getElementById('vocab-exercise-container').style.display = 'block';
        document.getElementById('vocab-exercise-container').scrollIntoView({behavior: 'smooth'});
    },
    
    showExercise(type) {
        this.currentExerciseType = type;
        const display = document.getElementById('exercise-display');
        
        // Get selected word objects
        const words = window.vocabularyBank.filter(w => 
            this.selectedWords.includes(w.id)
        );
        
        if (type === 'flashcards') {
            display.innerHTML = `
                <div class="exercise-setup-panel">
                    <h3><img src="assets/images/thumbnails/flashcards.svg" style="height: 40px; vertical-align: middle; margin-right: 10px;"> Flashcard Mode:</h3>
                    <div class="setup-options">
                        <button class="btn-secondary" onclick="VocabModule.launchPractice('flashcards', 'word_first')">
                            <i class="fa-solid fa-font"></i> Word First
                        </button>
                        <button class="btn-secondary" onclick="VocabModule.launchPractice('flashcards', 'image_first')">
                            <i class="fa-regular fa-image"></i> Image First
                        </button>
                        <button class="btn-secondary" onclick="VocabModule.launchPractice('flashcards', 'sound_first')">
                            <i class="fa-solid fa-volume-high"></i> Sound First
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        if (type === 'wordsearch') {
            display.innerHTML = `
                <div class="exercise-setup-panel">
                    <h3><img src="assets/images/thumbnails/wordsearch.svg" style="height: 40px; vertical-align: middle; margin-right: 10px;"> Wordsearch Mode:</h3>
                    <div class="setup-options">
                        <button class="btn-secondary" onclick="VocabModule.launchPractice('wordsearch', 'easy')">
                            <i class="fa-regular fa-image"></i> Easy (Images)
                        </button>
                        <button class="btn-secondary" onclick="VocabModule.launchPractice('wordsearch', 'text')">
                            <i class="fa-solid fa-quote-left"></i> Text Clues
                        </button>
                        <button class="btn-secondary" onclick="VocabModule.launchPractice('wordsearch', 'audio')">
                            <i class="fa-solid fa-volume-high"></i> Audio Clues
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        // For other modes, simple launch button
        let title = '';
        let icon = '';
        switch(type) {
            case 'matching':
                title = 'Matching Game';
                icon = 'fa-puzzle-piece';
                break;
            case 'spelling':
                title = 'Spelling Practice';
                icon = 'fa-pen-to-square';
                break;
            case 'sentences':
                title = 'Fill-in Sentences';
                icon = 'fa-align-left';
                break;
        }

        display.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h3><i class="fa-solid ${icon}"></i> ${title}</h3>
                <p>Ready to practice with ${words.length} words?</p>
                <button class="btn-primary" style="margin-top: 20px; font-size: 1.2rem; padding: 15px 30px;" 
                        onclick="VocabModule.launchPractice('${type}')">
                    Start ${title} <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </button>
                <p style="margin-top: 15px; font-size: 0.9rem; color: #666;">Opens in a new immersive window</p>
            </div>
        `;
    },

    launchPractice(mode, face) {
        const ids = this.selectedWords.join(',');
        let url = `practice.html?ids=${ids}&mode=${mode}`;
        if (face) {
            url += `&face=${face}`;
        }
        window.open(url, '_blank');
    },
    
    // ... (Old inline render methods removed as we use the separate practice window now) ...
    
    setupEventListeners() {
        // Search input
        document.getElementById('vocab-search').addEventListener('input', (e) => {
            const category = document.getElementById('vocab-category').value;
            const level = document.getElementById('vocab-level').value;
            const subcategory = document.getElementById('vocab-subcategory').value;
            this.renderWords(category, level, e.target.value, subcategory);
        });
        
        // Category change
        document.getElementById('vocab-category').addEventListener('change', (e) => {
            this.handleCategoryChange(e.target.value);
        });

        // Subcategory change
        document.getElementById('vocab-subcategory').addEventListener('change', (e) => {
            const category = document.getElementById('vocab-category').value;
            const level = document.getElementById('vocab-level').value;
            const search = document.getElementById('vocab-search').value;
            this.renderWords(category, level, search, e.target.value);
        });
        
        // Level change
        document.getElementById('vocab-level').addEventListener('change', (e) => {
            const category = document.getElementById('vocab-category').value;
            const subcategory = document.getElementById('vocab-subcategory').value;
            const search = document.getElementById('vocab-search').value;
            this.renderWords(category, e.target.value, search, subcategory);
        });
        
        // Select All Filtered button
        document.getElementById('select-all-vocab').addEventListener('click', () => {
            const visibleCards = document.querySelectorAll('.word-card');
            visibleCards.forEach(card => {
                if (!card.classList.contains('selected')) {
                    card.classList.add('selected');
                    const wordId = card.dataset.id;
                    if (!this.selectedWords.includes(wordId)) {
                        this.selectedWords.push(wordId);
                    }
                }
            });
            this.updateGenerateButton();
        });
        
        // Deselect All button
        document.getElementById('deselect-all-vocab').addEventListener('click', () => {
            document.querySelectorAll('.word-card').forEach(card => {
                card.classList.remove('selected');
            });
            // Also deselect logically even if not visible
            this.selectedWords = [];
            this.updateGenerateButton();
        });
        
        // Generate exercise button
        document.getElementById('generate-vocab-exercise').addEventListener('click', () => {
            this.generateExercise();
        });
        
        // Exercise type cards
        document.querySelectorAll('.exercise-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.exercise-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.showExercise(card.dataset.type);
            });
        });
    },
    
    updateGenerateButton() {
        const btn = document.getElementById('generate-vocab-exercise');
        if (this.selectedWords.length > 0) {
            btn.style.display = 'inline-block';
            btn.classList.add('pulsate');
            btn.textContent = `Generate Exercise (${this.selectedWords.length})`;
        } else {
            btn.style.display = 'none';
            btn.classList.remove('pulsate');
        }
    },
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => VocabModule.init());
} else {
    VocabModule.init();
}

window.VocabModule = VocabModule;