class ScienceQuizRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.quizData = null;
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.shuffledQuestions = [];
    }

    init(quizData) {
        if (!this.container) {
            console.error('Quiz container not found');
            return;
        }

        this.quizData = quizData;
        this.currentQuestionIndex = 0;
        this.score = 0;

        // Clone and shuffle questions if needed, or just use as is
        // For now, we'll just use the provided order but we could shuffle
        this.shuffledQuestions = [...this.quizData.questions];

        // Reset specific question shuffles
        this.shuffledQuestions.forEach(q => {
            delete q._shuffledOptions;
        });

        this.render();
    }

    render() {
        if (this.currentQuestionIndex >= this.shuffledQuestions.length) {
            this.showResults();
            return;
        }

        const question = this.shuffledQuestions[this.currentQuestionIndex];

        // Shuffle options once per question instance
        if (!question._shuffledOptions) {
            // Store original indices to map back to correct answer
            question._shuffledOptions = question.options.map((opt, index) => ({
                text: opt,
                originalIndex: index
            })).sort(() => Math.random() - 0.5);
        }

        const progress = ((this.currentQuestionIndex + 1) / this.shuffledQuestions.length) * 100;

        this.container.innerHTML = `
            <div class="science-quiz-container">
                <div class="quiz-header">
                    <h2 style="color: var(--indigo-velvet); margin-bottom: 10px;">${this.quizData.title}</h2>
                    <p style="color: #666;">${this.quizData.description}</p>
                </div>

                <div class="quiz-progress-container">
                    <div class="quiz-progress-text">
                        <span>Question ${this.currentQuestionIndex + 1} of ${this.shuffledQuestions.length}</span>
                        <span>${Math.round(progress)}%</span>
                    </div>
                    <div class="quiz-progress-bar-bg">
                        <div class="quiz-progress-bar-fill" style="width: ${progress}%"></div>
                    </div>
                </div>

                <div class="quiz-question-container">
                    ${question.image ? `<div class="quiz-image-container" style="margin-bottom: 15px; display: flex; justify-content: center;">
                        <img src="assets/images/science/${question.image}" alt="Quiz Image" style="max-height: 200px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    </div>` : ''}
                    <div class="quiz-question-text">${question.question}</div>
                </div>

                ${question.hint ? `
                <div class="quiz-hint-area">
                    <button class="quiz-hint-btn" onclick="scienceQuizRenderer.toggleHint(this)">
                        <i class="fa-solid fa-lightbulb"></i> Need a hint?
                    </button>
                    <div class="quiz-hint-text" style="display: none;">${question.hint}</div>
                </div>
                ` : ''}

                <div class="quiz-options">
                    ${question._shuffledOptions.map((opt, idx) => `
                        <div class="quiz-option" onclick="scienceQuizRenderer.checkAnswer(${opt.originalIndex}, this)">
                            ${opt.text}
                        </div>
                    `).join('')}
                </div>

                <div id="quiz-feedback" class="quiz-feedback"></div>
            </div>
        `;
    }

    toggleHint(btn) {
        const hintText = btn.nextElementSibling;
        const isHidden = hintText.style.display === 'none';
        hintText.style.display = isHidden ? 'block' : 'none';
        btn.innerHTML = isHidden ?
            '<i class="fa-solid fa-eye-slash"></i> Hide hint' :
            '<i class="fa-solid fa-lightbulb"></i> Need a hint?';
    }

    checkAnswer(selectedIndex, optionEl) {
        // Prevent multiple clicks
        if (this.container.querySelector('.quiz-option.correct')) return;

        const question = this.shuffledQuestions[this.currentQuestionIndex];
        const isCorrect = selectedIndex === question.correctAnswer;
        const feedbackEl = document.getElementById('quiz-feedback');

        // Disable all options
        this.container.querySelectorAll('.quiz-option').forEach(el => {
            el.classList.add('disabled');
        });

        if (isCorrect) {
            this.score++;
            optionEl.classList.add('correct');
            optionEl.classList.remove('disabled'); // Keep correct one opacity normal

            feedbackEl.innerHTML = `
                <div style="font-weight: 700; font-size: 1.2rem;">
                    <i class="fa-solid fa-circle-check"></i> Correct!
                </div>
                <div style="font-size: 0.9rem; margin-top: 5px;">${question.explanation || 'Great job!'}</div>
            `;
            feedbackEl.className = 'quiz-feedback show success';

            this.playSound('correct');
        } else {
            optionEl.classList.add('wrong');
            optionEl.classList.remove('disabled');

            // Highlight correct answer
            const options = this.container.querySelectorAll('.quiz-option');
            // Find the element with the correct original index
            const correctOptIndex = question._shuffledOptions.findIndex(o => o.originalIndex === question.correctAnswer);
            if (correctOptIndex !== -1 && options[correctOptIndex]) {
                options[correctOptIndex].classList.add('correct');
                options[correctOptIndex].classList.remove('disabled');
            }

            feedbackEl.innerHTML = `
                <div style="font-weight: 700; font-size: 1.2rem;">
                    <i class="fa-solid fa-circle-xmark"></i> Incorrect
                </div>
                <div style="font-size: 0.9rem; margin-top: 5px;">${question.explanation || 'Better luck next time!'}</div>
            `;
            feedbackEl.className = 'quiz-feedback show error';

            this.playSound('wrong');
        }

        // Auto proceed
        setTimeout(() => {
            this.currentQuestionIndex++;
            this.render();
        }, 2200);
    }

    showResults() {
        const percentage = Math.round((this.score / this.shuffledQuestions.length) * 100);
        let message = '';
        let icon = 'fa-trophy';

        if (percentage >= 90) {
            message = 'Outstanding! You are a science master!';
        } else if (percentage >= 70) {
            message = 'Great job! You know your stuff.';
        } else if (percentage >= 50) {
            message = 'Good effort! Keep practicing.';
        } else {
            message = 'Keep studying! You will get it next time.';
            icon = 'fa-book-open-reader';
        }

        this.container.innerHTML = `
            <div class="science-quiz-container">
                <div class="quiz-results">
                    <h1><i class="fa-solid ${icon}" style="color: var(--amber-flame, #ffbf00);"></i> Quiz Complete!</h1>
                    
                    <div class="score-circle">
                        <div class="score-number">${percentage}%</div>
                        <div class="score-text">${this.score} / ${this.shuffledQuestions.length}</div>
                    </div>

                    <p class="results-message">${message}</p>

                    <div class="results-buttons">
                        <button class="btn-primary" onclick="scienceQuizRenderer.init(scienceQuizRenderer.quizData)">
                            <i class="fa-solid fa-rotate-right"></i> Play Again
                        </button>
                        <button class="btn-secondary" onclick="scienceQuizRenderer.exitQuiz()">
                            <i class="fa-solid fa-list"></i> Back to Menu
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    exitQuiz() {
        // This function should be overridden or handled by the parent controller
        // For now, we'll try to trigger a custom event or check window context
        if (window.handleQuizExit) {
            window.handleQuizExit();
        } else {
            // Fallback: reload page or hide container
            console.log('Quiz exited');
            // Attempt to find the main science tab logic if possible, 
            // but ideally the parent script managing this renderer should define handleQuizExit
        }
    }

    playSound(type) {
        // Simple sound mapping, ignoring if missing for now or using simple beep if possible
        // Ideally we use the same assets as practice.js
        const path = type === 'correct' ? 'assets/audio/correct.mp3' : 'assets/audio/wrong.mp3';
        const audio = new Audio(path);
        audio.volume = 0.5;
        audio.play().catch(e => {
            // Silent fail if audio missing, common in dev environments
            // console.warn('Audio play failed', e); 
        });
    }
}

// Global instance 
window.scienceQuizRenderer = new ScienceQuizRenderer('science-quiz-display-area');
