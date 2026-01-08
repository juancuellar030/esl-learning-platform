// Grammar Module
const GrammarModule = {
    currentGrammar: null,
    
    init() {
        this.renderGrammarList();
        this.setupEventListeners();
    },
    
    renderGrammarList(category = 'all', level = 'all') {
        const list = document.getElementById('grammar-list');
        let rules = window.grammarBank;
        
        if (category !== 'all') {
            rules = rules.filter(g => g.category === category);
        }
        if (level !== 'all') {
            rules = rules.filter(g => g.level === level);
        }
        
        list.innerHTML = rules.map(grammar => `
            <div class="grammar-card" data-id="${grammar.id}">
                <h4>${grammar.rule}</h4>
                <p>${grammar.explanation.substring(0, 100)}...</p>
                <div class="grammar-meta">
                    <span>${grammar.category}</span>
                    <span>${grammar.level}</span>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        document.querySelectorAll('.grammar-card').forEach(card => {
            card.addEventListener('click', () => {
                this.showGrammarLesson(card.dataset.id);
            });
        });
    },
    
    showGrammarLesson(grammarId) {
        const grammar = window.grammarBank.find(g => g.id === grammarId);
        if (!grammar) return;
        
        this.currentGrammar = grammar;
        
        document.getElementById('grammar-title').textContent = grammar.rule;
        document.getElementById('grammar-explanation').innerHTML = `
            <h4>Explanation</h4>
            <p>${grammar.explanation}</p>
        `;
        
        document.getElementById('grammar-examples').innerHTML = `
            <h4>Examples</h4>
            <ul>
                ${grammar.examples.map(ex => `<li>${ex}</li>`).join('')}
            </ul>
        `;
        
        document.getElementById('grammar-mistakes').innerHTML = `
            <h4>Common Mistakes</h4>
            <ul>
                ${grammar.commonMistakes.map(m => `<li>${m}</li>`).join('')}
            </ul>
        `;
        
        document.getElementById('grammar-lesson-container').style.display = 'block';
        document.getElementById('grammar-lesson-container').scrollIntoView({behavior: 'smooth'});
    },
    
    generateExercises() {
        if (!this.currentGrammar) return;
        
        const display = document.getElementById('grammar-exercise-display');
        const grammar = this.currentGrammar;
        
        display.innerHTML = `
            <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin-top: 20px;">
                <h3 style="color: #667eea; margin-bottom: 30px;">Practice Exercises</h3>
                
                <div style="margin-bottom: 40px;">
                    <h4 style="color: #764ba2; margin-bottom: 20px;">Fill in the Blanks</h4>
                    ${grammar.exercises.filter(ex => ex.type === 'fill-blank').map((ex, idx) => `
                        <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 15px;">
                            <p style="font-size: 1.2rem; margin-bottom: 10px;">
                                ${ex.sentence}
                            </p>
                            <input type="text" data-answer="${ex.answer}" 
                                   style="width: 100%; padding: 10px; font-size: 1.1rem; border: 2px solid #ddd; border-radius: 8px;"
                                   placeholder="Your answer...">
                            <div class="result" style="margin-top: 10px; font-weight: bold;"></div>
                        </div>
                    `).join('')}
                </div>
                
                ${grammar.exercises.filter(ex => ex.type === 'error-correction').length > 0 ? `
                <div style="margin-bottom: 40px;">
                    <h4 style="color: #764ba2; margin-bottom: 20px;">Error Correction</h4>
                    ${grammar.exercises.filter(ex => ex.type === 'error-correction').map((ex, idx) => `
                        <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 15px;">
                            <p style="font-size: 1.2rem; margin-bottom: 10px; color: #dc3545;">
                                ❌ ${ex.sentence}
                            </p>
                            <input type="text" data-answer="${ex.answer.toLowerCase()}" 
                                   style="width: 100%; padding: 10px; font-size: 1.1rem; border: 2px solid #ddd; border-radius: 8px;"
                                   placeholder="Write the correct sentence...">
                            <div class="result" style="margin-top: 10px; font-weight: bold;"></div>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
                
                <button class="btn-primary" id="check-grammar-answers" style="width: 100%; padding: 15px; font-size: 1.2rem;">
                    Check All Answers
                </button>
                
                <div id="grammar-score" style="text-align: center; margin-top: 20px; font-size: 1.3rem; font-weight: bold;"></div>
            </div>
        `;
        
        document.getElementById('check-grammar-answers').addEventListener('click', () => {
            this.checkAnswers();
        });
        
        display.scrollIntoView({behavior: 'smooth'});
    },
    
    checkAnswers() {
        const inputs = document.querySelectorAll('#grammar-exercise-display input[data-answer]');
        let correct = 0;
        let total = inputs.length;
        
        inputs.forEach(input => {
            const answer = input.value.trim().toLowerCase();
            const correctAnswer = input.dataset.answer.toLowerCase();
            const result = input.nextElementSibling;
            
            if (answer === correctAnswer) {
                result.innerHTML = '✅ Correct!';
                result.style.color = '#28a745';
                input.style.borderColor = '#28a745';
                correct++;
            } else {
                result.innerHTML = `❌ Incorrect. Correct answer: ${input.dataset.answer}`;
                result.style.color = '#dc3545';
                input.style.borderColor = '#dc3545';
            }
        });
        
        const score = document.getElementById('grammar-score');
        const percentage = Math.round((correct / total) * 100);
        score.innerHTML = `Score: ${correct}/${total} (${percentage}%)`;
        
        if (percentage === 100) {
            score.innerHTML += ' 🎉 Perfect!';
            score.style.color = '#28a745';
        } else if (percentage >= 70) {
            score.innerHTML += ' 👍 Good job!';
            score.style.color = '#ffc107';
        } else {
            score.innerHTML += ' 💪 Keep practicing!';
            score.style.color = '#667eea';
        }
    },
    
    setupEventListeners() {
        // Category and level filters
        document.getElementById('grammar-category').addEventListener('change', (e) => {
            const level = document.getElementById('grammar-level').value;
            this.renderGrammarList(e.target.value, level);
        });
        
        document.getElementById('grammar-level').addEventListener('change', (e) => {
            const category = document.getElementById('grammar-category').value;
            this.renderGrammarList(category, e.target.value);
        });
        
        // Generate exercise button
        document.getElementById('generate-grammar-exercise').addEventListener('click', () => {
            this.generateExercises();
        });
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GrammarModule.init());
} else {
    GrammarModule.init();
}

window.GrammarModule = GrammarModule;