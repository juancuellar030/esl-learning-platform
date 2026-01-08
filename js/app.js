// Main Application Module
const App = {
    currentSection: 'dashboard',
    
    init() {
        this.setupNavigation();
        this.setupDashboardCards();
        this.setupLibraryTabs();
        this.loadSavedLessons();
    },
    
    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        const sections = document.querySelectorAll('.content-section');
        
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetSection = btn.dataset.section;
                
                // Update active nav button
                navButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update visible section
                sections.forEach(section => {
                    section.classList.remove('active');
                    if (section.id === targetSection) {
                        section.classList.add('active');
                    }
                });
                
                this.currentSection = targetSection;
                
                // Scroll to top
                window.scrollTo({top: 0, behavior: 'smooth'});
            });
        });
    },
    
    setupDashboardCards() {
        const cards = document.querySelectorAll('.dashboard-card');
        
        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                const targetSection = card.dataset.goto;
                const targetBtn = document.querySelector(`[data-section="${targetSection}"]`);
                
                if (targetBtn) {
                    targetBtn.click();
                }
            });
        });
    },
    
    setupLibraryTabs() {
        const tabButtons = document.querySelectorAll('.lib-tab-btn');
        const tabContents = document.querySelectorAll('.lib-tab-content');
        
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                // Update active tab button
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update visible tab content
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === targetTab) {
                        content.classList.add('active');
                    }
                });
            });
        });
    },
    
    loadSavedLessons() {
        // Load from localStorage
        const vocabLessons = JSON.parse(localStorage.getItem('vocabLessons') || '[]');
        const grammarLessons = JSON.parse(localStorage.getItem('grammarLessons') || '[]');
        const boardLessons = JSON.parse(localStorage.getItem('boardLessons') || '[]');
        
        this.renderSavedLessons('vocab', vocabLessons);
        this.renderSavedLessons('grammar', grammarLessons);
        this.renderSavedLessons('board', boardLessons);
    },
    
    renderSavedLessons(type, lessons) {
        const containerId = `saved-${type}-list`;
        const container = document.getElementById(containerId);
        
        if (lessons.length === 0) {
            container.innerHTML = '<p class="empty-state">No saved lessons yet. Create one to get started!</p>';
            return;
        }
        
        container.innerHTML = lessons.map((lesson, index) => `
            <div class="saved-lesson-card">
                <h4>${lesson.title || 'Untitled Lesson'}</h4>
                <p>${lesson.description || 'No description'}</p>
                <p style="font-size: 0.85rem; color: #999;">
                    Created: ${new Date(lesson.date).toLocaleDateString()}
                </p>
                <div class="lesson-actions">
                    <button class="btn-primary" onclick="App.loadLesson('${type}', ${index})">
                        Load
                    </button>
                    <button class="btn-secondary" onclick="App.deleteLesson('${type}', ${index})">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    },
    
    saveLesson(type, data) {
        const storageKey = `${type}Lessons`;
        const lessons = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        const lesson = {
            ...data,
            date: new Date().toISOString()
        };
        
        lessons.push(lesson);
        localStorage.setItem(storageKey, JSON.stringify(lessons));
        
        this.loadSavedLessons();
        alert('Lesson saved successfully!');
    },
    
    loadLesson(type, index) {
        const storageKey = `${type}Lessons`;
        const lessons = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const lesson = lessons[index];
        
        if (!lesson) {
            alert('Lesson not found!');
            return;
        }
        
        // Navigate to appropriate section
        switch(type) {
            case 'vocab':
                document.querySelector('[data-section="vocabulary"]').click();
                // Load vocabulary lesson data
                if (window.VocabModule && lesson.words) {
                    window.VocabModule.selectedWords = lesson.words;
                    window.VocabModule.generateExercise();
                }
                break;
            case 'grammar':
                document.querySelector('[data-section="grammar"]').click();
                // Load grammar lesson data
                if (window.GrammarModule && lesson.grammarId) {
                    window.GrammarModule.showGrammarLesson(lesson.grammarId);
                }
                break;
            case 'board':
                document.querySelector('[data-section="virtualboard"]').click();
                // Load board data
                if (window.VirtualBoardModule && lesson.boardData) {
                    const img = new Image();
                    img.onload = () => {
                        const ctx = window.VirtualBoardModule.ctx;
                        ctx.clearRect(0, 0, window.VirtualBoardModule.canvas.width, 
                                     window.VirtualBoardModule.canvas.height);
                        ctx.drawImage(img, 0, 0);
                        window.VirtualBoardModule.saveState();
                    };
                    img.src = lesson.boardData;
                }
                break;
        }
        
        alert('Lesson loaded!');
    },
    
    deleteLesson(type, index) {
        if (!confirm('Are you sure you want to delete this lesson?')) {
            return;
        }
        
        const storageKey = `${type}Lessons`;
        const lessons = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        lessons.splice(index, 1);
        localStorage.setItem(storageKey, JSON.stringify(lessons));
        
        this.loadSavedLessons();
        alert('Lesson deleted!');
    },
    
    // Helper methods for saving current work
    saveCurrentVocabLesson() {
        if (!window.VocabModule || window.VocabModule.selectedWords.length === 0) {
            alert('Please select some words first!');
            return;
        }
        
        const title = prompt('Enter a title for this vocabulary lesson:');
        if (!title) return;
        
        const description = prompt('Enter a description (optional):') || '';
        
        this.saveLesson('vocab', {
            title,
            description,
            words: window.VocabModule.selectedWords,
            exerciseType: window.VocabModule.currentExerciseType
        });
    },
    
    saveCurrentGrammarLesson() {
        if (!window.GrammarModule || !window.GrammarModule.currentGrammar) {
            alert('Please select a grammar rule first!');
            return;
        }
        
        const title = prompt('Enter a title for this grammar lesson:');
        if (!title) return;
        
        const description = prompt('Enter a description (optional):') || '';
        
        this.saveLesson('grammar', {
            title,
            description,
            grammarId: window.GrammarModule.currentGrammar.id
        });
    },
    
    saveCurrentBoard() {
        if (!window.VirtualBoardModule) {
            alert('Board module not initialized!');
            return;
        }
        
        const title = prompt('Enter a title for this board:');
        if (!title) return;
        
        const description = prompt('Enter a description (optional):') || '';
        
        this.saveLesson('board', {
            title,
            description,
            boardData: window.VirtualBoardModule.canvas.toDataURL()
        });
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

// Make App available globally
window.App = App;

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        
        if (App.currentSection === 'vocabulary') {
            App.saveCurrentVocabLesson();
        } else if (App.currentSection === 'grammar') {
            App.saveCurrentGrammarLesson();
        } else if (App.currentSection === 'virtualboard') {
            App.saveCurrentBoard();
        }
    }
    
    // Ctrl/Cmd + Z for undo on board
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && App.currentSection === 'virtualboard') {
        e.preventDefault();
        window.VirtualBoardModule?.undo();
    }
    
    // Ctrl/Cmd + Y for redo on board
    if ((e.ctrlKey || e.metaKey) && e.key === 'y' && App.currentSection === 'virtualboard') {
        e.preventDefault();
        window.VirtualBoardModule?.redo();
    }
});

console.log('🎓 ESL Learning Platform Initialized!');
console.log('📚 Vocabulary Bank:', window.vocabularyBank?.length, 'words');
console.log('📝 Grammar Bank:', window.grammarBank?.length, 'rules');
console.log('🎨 Virtual Board: Ready');