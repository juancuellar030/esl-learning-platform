window.BonesQuiz = {
    title: "Human Bones Quiz",
    description: "Identify the bones of the human body!",

    questions: [
        {
            id: 1,
            question: "Which bone is shown in the image?",
            image: "skull.png",
            options: [
                "Skull",
                "Jaw",
                "Rib Cage",
                "Pelvis"
            ],
            correctAnswer: 0,
            explanation: "The skull is the bony structure that forms the head and protects the brain."
        },
        {
            id: 2,
            question: "Identify this bone located in the upper arm.",
            image: "humerus.png",
            options: [
                "Femur",
                "Radius",
                "Humerus",
                "Tibia"
            ],
            correctAnswer: 2,
            explanation: "The humerus is the long bone in the upper arm that runs from the shoulder to the elbow."
        },
        {
            id: 3,
            question: "What is the name of this bone forming the lower jaw?",
            image: "jaw.png",
            options: [
                "Maxilla",
                "Jaw (Mandible)",
                "Clavicle",
                "Sternum"
            ],
            correctAnswer: 1,
            explanation: "The jaw (mandible) is the largest, strongest and lowest bone in the human face."
        },
        {
            id: 4,
            question: "Which bone is the longest and strongest in the human body?",
            image: "femur.png",
            options: [
                "Humerus",
                "Femur",
                "Tibia",
                "Fibula"
            ],
            correctAnswer: 1,
            explanation: "The femur (thigh bone) is the longest and strongest bone in the human body."
        },
        {
            id: 5,
            question: "Identify this structure that protects the heart and lungs.",
            image: "rib-cage.png",
            options: [
                "Pelvis",
                "Spine",
                "Rib Cage",
                "Skull"
            ],
            correctAnswer: 2,
            explanation: "The rib cage protects the vital organs of the chest, including the heart and lungs."
        },
        {
            id: 6,
            question: "Which of the forearm bones is shown here?",
            image: "radius.png",
            options: [
                "Ulna",
                "Radius",
                "Humerus",
                "Femur"
            ],
            correctAnswer: 1,
            explanation: "The radius is one of the two large bones of the forearm, the other being the ulna."
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
                ${question.image ? `<div class="quiz-image-container"><img src="${question.image}" alt="Quiz Image" class="quiz-image"></div>` : ''}
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
            message = 'Bone Expert! Outstanding job!';
        } else if (percentage >= 70) {
            message = 'Great work! You know your bones well.';
        } else if (percentage >= 50) {
            message = 'Good effort! Review the vocabulary and try again.';
        } else {
            message = 'Keep practicing! You will get better.';
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
    },
};
