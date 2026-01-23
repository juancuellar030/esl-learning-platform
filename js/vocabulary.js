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
        'directions': { label: 'Directions', icon: 'fa-solid fa-diamond-turn-right' },
        'movement': { label: 'Movement', icon: 'fa-solid fa-person-running' },
        'classroom-language': { label: 'Classroom Language', icon: 'fa-solid fa-chalkboard-user' },
        'classroom-questions': { label: 'Classroom Questions', icon: 'fa-solid fa-circle-question' },
        'connectors': { label: 'Connectors', icon: 'fa-solid fa-link' },
        'discourse-markers': { label: 'Discourse Markers', icon: 'fa-solid fa-comment-dots' },
        'grammar-words': { label: 'Grammar & Questions', icon: 'fa-solid fa-question' },
        'indefinite-pronouns': { label: 'Indefinite Pronouns', icon: 'fa-solid fa-users-viewfinder' },
        'time': { label: 'Calendar & Time', icon: 'fa-solid fa-calendar-days' },
        'shapes': { label: 'Geometric Shapes', icon: 'fa-solid fa-shapes' },
        'numbers': { label: 'Numbers', icon: 'fa-solid fa-hashtag' },
        'feedback': { label: 'Feedback & Praise', icon: 'fa-solid fa-thumbs-up' }
    },

    init() {
        // Show categories by default initially
        this.renderCategories();
        this.setupEventListeners();
    },

    normalizeString(str) {
        if (!str) return '';
        return str.toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
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
            const searchTokens = this.normalizeString(searchTerm).split(/\s+/).filter(t => t);

            words = words.filter(w => {
                const searchableText = this.normalizeString([
                    w.word,
                    w.spanish,
                    w.definition || '',
                    w.subcategory || '',
                    w.category || ''
                ].join(' '));

                return searchTokens.every(token => searchableText.includes(token));
            });
        }

        if (words.length === 0) {
            let message = 'No words found matching your filters.';

            // Check if results exist outside the current category filter
            if (category !== 'all' && searchTerm) {
                const searchTokens = this.normalizeString(searchTerm).split(/\s+/).filter(t => t);
                const globalResults = window.vocabularyBank.filter(w => {
                    const searchableText = this.normalizeString([
                        w.word, w.spanish, w.definition || '', w.subcategory || '', w.category || ''
                    ].join(' '));
                    return searchTokens.every(token => searchableText.includes(token));
                });

                if (globalResults.length > 0) {
                    message = `No words found in this category, but ${globalResults.length} result(s) found elsewhere. <a href="#" onclick="document.getElementById('vocab-category').value='all'; VocabModule.handleCategoryChange('all'); return false;" style="color: var(--medium-slate-blue); font-weight: bold;">Show all results</a>`;
                }
            }

            grid.innerHTML = `<p style="text-align: center; padding: 40px; color: #999; grid-column: 1/-1;">${message}</p>`;
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

        // Add Color Wheel button if category is colors
        this.updateSpecialButtons(category);
    },

    updateSpecialButtons(category) {
        const container = document.getElementById('special-actions-container') || this.createSpecialActionsContainer();
        container.innerHTML = '';

        if (category === 'colors') {
            const btn = document.createElement('button');
            btn.className = 'btn-primary';
            btn.style.backgroundColor = '#f39c12';
            btn.innerHTML = '<i class="fa-solid fa-circle-dot"></i> Interactive RYB Color Wheel';
            btn.onclick = () => window.open('color-wheel.html', '_blank');
            container.appendChild(btn);
        }
    },

    createSpecialActionsContainer() {
        const container = document.createElement('div');
        container.id = 'special-actions-container';
        container.style.margin = '20px 0';
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        const grid = document.getElementById('word-grid');
        grid.parentNode.insertBefore(container, grid);
        return container;
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

    generateExercise() {
        if (this.selectedWords.length === 0) {
            alert('Please select at least one word!');
            return;
        }

        // Save selected word IDs to localStorage
        localStorage.setItem('selectedVocabIds', JSON.stringify(this.selectedWords));
        localStorage.removeItem('practiceMode'); // Clear previous mode to trigger mode selection in practice.html

        // Open practice.html in a new tab
        window.open('practice.html', '_blank');
    },

    updateGenerateButton() {
        const btn = document.getElementById('generate-vocab-exercise');
        if (this.selectedWords.length > 0) {
            btn.classList.add('visible');
            btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Exercise (${this.selectedWords.length})`;
        } else {
            btn.classList.remove('visible');
        }
    },

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
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => VocabModule.init());
} else {
    VocabModule.init();
}

window.VocabModule = VocabModule;
