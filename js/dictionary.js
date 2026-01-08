// Dictionary Module
const DictionaryModule = {
    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        const searchInput = document.getElementById('dictionary-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchDictionary(e.target.value);
            });
        }
    },

    searchDictionary(searchTerm) {
        const resultsContainer = document.getElementById('dictionary-results');
        if (!searchTerm.trim()) {
            resultsContainer.innerHTML = '<p class="empty-state">Type a word above to search the dictionary.</p>';
            return;
        }

        const results = window.vocabularyBank.filter(word => 
            word.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
            word.spanish.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (results.length === 0) {
            resultsContainer.innerHTML = '<p class="empty-state">No words found.</p>';
            return;
        }

        this.renderResults(results, resultsContainer);
    },

    renderResults(results, container) {
        container.innerHTML = results.map(word => `
            <div class="dictionary-card">
                <div class="dictionary-header">
                    <div class="word-title">
                        <h3>${word.word}</h3>
                        <div class="tags">
                            <span class="word-category">${word.category}</span>
                            ${word.type ? `<span class="word-type ${word.type}">${word.type}</span>` : ''}
                        </div>
                    </div>
                    <button class="audio-btn" onclick="DictionaryModule.playAudio('${word.word}')" title="Listen">
                        <i class="fa-solid fa-volume-high"></i>
                    </button>
                </div>
                <div class="dictionary-body">
                    <div class="translation">
                        <span class="label">Spanish:</span>
                        <span class="value">${word.spanish}</span>
                    </div>
                    <div class="definition">
                        <span class="label">Definition:</span>
                        <p>${word.definition}</p>
                    </div>
                    <div class="example">
                        <span class="label">Example:</span>
                        <p>"${word.example}"</p>
                    </div>
                </div>
            </div>
        `).join('');
    },

    playAudio(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            window.speechSynthesis.speak(utterance);
        } else {
            alert('Text-to-speech is not supported in this browser.');
        }
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DictionaryModule.init());
} else {
    DictionaryModule.init();
}

window.DictionaryModule = DictionaryModule;
