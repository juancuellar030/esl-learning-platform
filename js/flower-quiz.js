window.FlowerQuiz = {
    title: "Flower Parts Quiz",
    description: "Test your knowledge of flower parts and their functions!",

    questions: [
        {
            id: 1,
            question: "What is the main function of the anther?",
            options: [
                "Produces pollen grains",
                "Receives pollen grains",
                "Connects parts together",
                "Protects the flower bud"
            ],
            correctAnswer: 0,
            explanation: "The anther produces pollen grains which contain the male reproductive cell. Pollen grains are sticky to stick onto the body of pollinators."
        },
        {
            id: 2,
            question: "Which part receives the pollen grains?",
            options: [
                "Anther",
                "Stigma",
                "Ovary",
                "Filament"
            ],
            correctAnswer: 1,
            explanation: "The stigma receives the pollen grains during pollination."
        },
        {
            id: 3,
            question: "What does the ovary develop into after fertilisation?",
            options: [
                "A seed",
                "A pollen grain",
                "A fruit",
                "A petal"
            ],
            correctAnswer: 2,
            explanation: "The ovary contains the ovules and develops into a fruit after fertilisation."
        },
        {
            id: 4,
            question: "What is the function of the filament?",
            options: [
                "Produces pollen",
                "Connects the anther to the flower",
                "Receives pollen",
                "Protects the bud"
            ],
            correctAnswer: 1,
            explanation: "The filament connects the anther to the flower, supporting the anther in position."
        },
        {
            id: 5,
            question: "Which part develops into a seed after fertilisation?",
            options: [
                "Ovary",
                "Ovule",
                "Stigma",
                "Style"
            ],
            correctAnswer: 1,
            explanation: "The ovule contains the egg cell and develops into a seed after fertilisation."
        },
        {
            id: 6,
            question: "What is the main purpose of petals?",
            options: [
                "To protect the flower bud",
                "To produce pollen",
                "To attract pollinators",
                "To connect flower parts"
            ],
            correctAnswer: 2,
            explanation: "Petals attract pollinators and are usually brightly coloured for this purpose."
        },
        {
            id: 7,
            question: "What connects the stigma to the ovary?",
            options: [
                "Filament",
                "Style",
                "Petal",
                "Sepal"
            ],
            correctAnswer: 1,
            explanation: "The style connects the stigma to the ovary, forming part of the female reproductive system."
        },
        {
            id: 8,
            question: "What is the function of the sepal?",
            options: [
                "Attracts pollinators",
                "Produces pollen",
                "Protects the flower bud",
                "Receives pollen"
            ],
            correctAnswer: 2,
            explanation: "The sepal protects the flower bud before it opens."
        },
        {
            id: 9,
            question: "Which parts together form the stamen (male parts)?",
            options: [
                "Stigma and style",
                "Anther and filament",
                "Ovary and ovule",
                "Petal and sepal"
            ],
            correctAnswer: 1,
            explanation: "The stamen consists of the anther (which produces pollen) and the filament (which supports it)."
        },
        {
            id: 10,
            question: "Which parts together form the carpel (female parts)?",
            options: [
                "Anther and filament",
                "Petal and sepal",
                "Stigma, style, ovary, and ovule",
                "Only the ovary"
            ],
            correctAnswer: 2,
            explanation: "The carpel consists of the stigma (receives pollen), style (connects parts), ovary (contains ovules), and ovule (becomes seed)."
        },
        {
            id: 11,
            question: "Why are pollen grains sticky?",
            options: [
                "To protect them from rain",
                "To stick onto the body of pollinators",
                "To help them grow faster",
                "To make them heavier"
            ],
            correctAnswer: 1,
            explanation: "Pollen grains are sticky so they can stick onto the body of pollinators like bees and butterflies for transfer to other flowers."
        },
        {
            id: 12,
            question: "What does the ovule contain?",
            options: [
                "Pollen grains",
                "The egg cell",
                "Nectar",
                "Seeds"
            ],
            correctAnswer: 1,
            explanation: "The ovule contains the egg cell, which after fertilisation develops into a seed."
        },
        {
            id: 13,
            question: "Which flower part is usually brightly coloured?",
            options: [
                "Sepal",
                "Filament",
                "Petal",
                "Style"
            ],
            correctAnswer: 2,
            explanation: "Petals are usually brightly coloured to attract pollinators to the flower."
        },
        {
            id: 14,
            question: "Which part contains the ovules?",
            options: [
                "Anther",
                "Stigma",
                "Ovary",
                "Petal"
            ],
            correctAnswer: 2,
            explanation: "The ovary contains the ovules and develops into a fruit after fertilisation."
        },
        {
            id: 15,
            question: "What happens to the ovary and ovule after fertilisation?",
            options: [
                "Both become seeds",
                "Both become fruits",
                "Ovary becomes fruit, ovule becomes seed",
                "Ovary becomes seed, ovule becomes fruit"
            ],
            correctAnswer: 2,
            explanation: "After fertilisation, the ovary develops into a fruit while the ovule develops into a seed."
        }
    ],

    currentQuestion: 0,
    score: 0,
    answers: [],

    init() {
        this.currentQuestion = 0;
        this.score = 0;
        this.answers = [];
        this.showQuestion();
    },

    showQuestion() {
        const question = this.questions[this.currentQuestion];
        const quizContainer = document.getElementById('quiz-container');
        if (!quizContainer) return;

        quizContainer.innerHTML = `
            <div class="quiz-header">
                <h3>${this.title}</h3>
                <p class="quiz-progress">Question ${this.currentQuestion + 1} of ${this.questions.length}</p>
            </div>
            <div class="quiz-question">
                <p class="question-text">${question.question}</p>
                <div class="quiz-options">
                    ${question.options.map((option, index) => `
                        <button class="quiz-option" data-index="${index}">
                            ${option}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        // Add click listeners to options
        document.querySelectorAll('.quiz-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.checkAnswer(parseInt(e.target.dataset.index));
            });
        });
    },

    checkAnswer(selectedIndex) {
        const question = this.questions[this.currentQuestion];
        const isCorrect = selectedIndex === question.correctAnswer;

        if (isCorrect) {
            this.score++;
        }

        this.answers.push({
            questionId: question.id,
            selectedIndex,
            isCorrect
        });

        this.showFeedback(selectedIndex, isCorrect, question);
    },

    showFeedback(selectedIndex, isCorrect, question) {
        const quizContainer = document.getElementById('quiz-container');
        if (!quizContainer) return;

        quizContainer.innerHTML = `
            <div class="quiz-header">
                <h3>${this.title}</h3>
                <p class="quiz-progress">Question ${this.currentQuestion + 1} of ${this.questions.length}</p>
            </div>
            <div class="quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}">
                <div class="feedback-icon">${isCorrect ? '✓' : '✗'}</div>
                <h4>${isCorrect ? 'Correct!' : 'Incorrect'}</h4>
                <p class="feedback-explanation">${question.explanation}</p>
                ${!isCorrect ? `<p class="correct-answer">The correct answer was: <strong>${question.options[question.correctAnswer]}</strong></p>` : ''}
                <button class="quiz-next-btn" id="next-question-btn">
                    ${this.currentQuestion < this.questions.length - 1 ? 'Next Question' : 'See Results'}
                </button>
            </div>
        `;

        document.getElementById('next-question-btn').addEventListener('click', () => {
            this.currentQuestion++;
            if (this.currentQuestion < this.questions.length) {
                this.showQuestion();
            } else {
                this.showResults();
            }
        });
    },

    showResults() {
        const percentage = Math.round((this.score / this.questions.length) * 100);
        const quizContainer = document.getElementById('quiz-container');
        if (!quizContainer) return;

        let message = '';
        if (percentage >= 90) {
            message = 'Excellent! You have mastered flower parts!';
        } else if (percentage >= 70) {
            message = 'Great job! You have a good understanding of flower parts.';
        } else if (percentage >= 50) {
            message = 'Good effort! Review the diagram and try again.';
        } else {
            message = 'Keep studying! Explore the interactive diagram more.';
        }

        quizContainer.innerHTML = `
            <div class="quiz-results">
                <h3>Quiz Complete!</h3>
                <div class="score-circle">
                    <div class="score-number">${percentage}%</div>
                    <div class="score-text">${this.score} / ${this.questions.length}</div>
                </div>
                <p class="results-message">${message}</p>
                <div class="results-buttons">
                    <button class="quiz-btn primary" id="retry-quiz-btn">Try Again</button>
                    <button class="quiz-btn secondary" id="close-quiz-btn">Close</button>
                </div>
            </div>
        `;

        document.getElementById('retry-quiz-btn').addEventListener('click', () => {
            this.init();
        });

        document.getElementById('close-quiz-btn').addEventListener('click', () => {
            if (document.getElementById('quiz-modal')) {
                document.getElementById('quiz-modal').style.display = 'none';
            }
        });

        // Save score to localStorage
        this.saveScore(percentage);
    },

    saveScore(percentage) {
        try {
            const scores = JSON.parse(localStorage.getItem('flowerQuizScores') || '[]');
            scores.push({
                date: new Date().toISOString(),
                score: this.score,
                total: this.questions.length,
                percentage
            });
            localStorage.setItem('flowerQuizScores', JSON.stringify(scores));
        } catch (e) {
            console.error('Error saving score:', e);
        }
    }
};
