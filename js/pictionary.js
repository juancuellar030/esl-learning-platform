// js/pictionary.js
(function () {
    'use strict';

    // State
    const state = {
        usedWords: new Set(),
        currentFilteredPool: [],
        currentWord: null,
        isSpinning: false,
    };

    // DOM Elements
    const el = {
        catFilter: document.getElementById('category-filter'),
        diffFilter: document.getElementById('difficulty-filter'),
        slotText: document.getElementById('slot-machine-text'),
        slotSub: document.getElementById('slot-machine-sub'),
        btnDraw: document.getElementById('btn-draw'),
        btnUsed: document.getElementById('btn-used'),
        btnDismiss: document.getElementById('btn-dismiss'),
        wordsCount: document.getElementById('words-count'),
        usedCount: document.getElementById('used-count'),
        btnReset: document.getElementById('btn-reset'),
        btnExcalidraw: document.getElementById('btn-excalidraw')
    };

    // Initialize
    function init() {
        populateCategories();
        loadUsedWords();
        updatePool();

        // Listeners
        el.catFilter.addEventListener('change', updatePool);
        el.diffFilter.addEventListener('change', updatePool);

        el.btnDraw.addEventListener('click', startDraw);
        el.btnUsed.addEventListener('click', markAsUsed);
        el.btnDismiss.addEventListener('click', dismissWord);
        el.btnReset.addEventListener('click', resetHistory);
        el.btnExcalidraw.addEventListener('click', openExcalidraw);
    }

    // Load Unique Categories
    function populateCategories() {
        const uniqueCats = [...new Set(window.pictionaryData.map(w => w.category))].sort();
        uniqueCats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            el.catFilter.appendChild(opt);
        });
    }

    // Local Storage for Used Words (Optional persistence)
    function loadUsedWords() {
        const saved = localStorage.getItem('pictionaryUsed');
        if (saved) {
            state.usedWords = new Set(JSON.parse(saved));
        }
    }

    function saveUsedWords() {
        localStorage.setItem('pictionaryUsed', JSON.stringify([...state.usedWords]));
    }

    function updatePool() {
        const cFilter = el.catFilter.value;
        const dFilter = el.diffFilter.value;

        state.currentFilteredPool = window.pictionaryData.filter(item => {
            const matchCat = (cFilter === 'all' || item.category === cFilter);
            const matchDiff = (dFilter === 'all' || item.difficulty === dFilter);
            const notUsed = !state.usedWords.has(item.word);
            return matchCat && matchDiff && notUsed;
        });

        // Update stats UI
        el.wordsCount.textContent = state.currentFilteredPool.length;
        el.usedCount.textContent = state.usedWords.size;

        if (state.currentFilteredPool.length === 0) {
            el.btnDraw.disabled = true;
            if (!state.currentWord) {
                el.slotText.textContent = "Out of words!";
                el.slotSub.textContent = "Clear history or change filters";
            }
        } else {
            if (!state.isSpinning) {
                el.btnDraw.disabled = false;
            }
        }
    }

    // Slot Machine Animation Logic
    function startDraw() {
        if (state.currentFilteredPool.length === 0 || state.isSpinning) return;

        state.isSpinning = true;
        el.btnDraw.disabled = true;
        el.btnUsed.disabled = true;
        el.btnDismiss.disabled = true;

        el.slotText.classList.remove('slot-landing');
        el.slotText.classList.add('slot-rolling');

        // Pick the final winner
        const randIndex = Math.floor(Math.random() * state.currentFilteredPool.length);
        const finalWord = state.currentFilteredPool[randIndex];

        // Run animation interval
        let ticks = 0;
        const totalTicks = 20;

        const spinInterval = setInterval(() => {
            // Pick a random word just for display dummy effect
            const dummy = state.currentFilteredPool[Math.floor(Math.random() * state.currentFilteredPool.length)];
            el.slotText.textContent = dummy.word;
            el.slotSub.textContent = dummy.category;

            ticks++;
            if (ticks >= totalTicks) {
                clearInterval(spinInterval);
                finishDraw(finalWord);
            }
        }, 50); // fast flips 50ms
    }

    function finishDraw(finalItem) {
        state.currentWord = finalItem;
        el.slotText.classList.remove('slot-rolling');
        el.slotText.classList.add('slot-landing');

        el.slotText.textContent = finalItem.word;
        el.slotSub.textContent = finalItem.es + " - " + finalItem.category;

        state.isSpinning = false;
        el.btnDraw.disabled = false;
        el.btnUsed.disabled = false;
        el.btnDismiss.disabled = false;

        updatePool(); // Checks if next word is possible
    }

    // Button Handlers
    function markAsUsed() {
        if (!state.currentWord) return;
        state.usedWords.add(state.currentWord.word);
        saveUsedWords();

        // clear current
        state.currentWord = null;
        el.slotText.textContent = "Great job!";
        el.slotSub.textContent = "Pick another word";
        el.btnUsed.disabled = true;
        el.btnDismiss.disabled = true;

        updatePool();
    }

    function dismissWord() {
        if (!state.currentWord) return;
        // Don't mark as used, just throw away from view
        state.currentWord = null;
        el.slotText.textContent = "Skipped!";
        el.slotSub.textContent = "Try another one";
        el.btnUsed.disabled = true;
        el.btnDismiss.disabled = true;

        updatePool();
    }

    function resetHistory() {
        state.usedWords.clear();
        saveUsedWords();
        state.currentWord = null;
        el.slotText.textContent = "History Cleared!";
        el.slotSub.textContent = "Ready to play again";
        el.btnUsed.disabled = true;
        el.btnDismiss.disabled = true;
        updatePool();
    }

    function openExcalidraw() {
        window.open('https://excalidraw.com', '_blank');
    }

    // Boot
    document.addEventListener('DOMContentLoaded', init);

})();
