// Clock & Timer Tool - Real-time clock and classroom timer
(function () {
    'use strict';

    // DOM Elements
    const timeDisplay = document.getElementById('time-display');
    const dateDisplay = document.getElementById('date-display');
    const hoursInput = document.getElementById('hours-input');
    const minutesInput = document.getElementById('minutes-input');
    const secondsInput = document.getElementById('seconds-input');
    const startTimerBtn = document.getElementById('start-timer-btn');
    const timerSetup = document.getElementById('timer-setup');
    const timerDisplayContainer = document.getElementById('timer-display-container');
    const timerDisplay = document.getElementById('timer-display');
    const timerProgressFill = document.getElementById('timer-progress-fill');
    const pauseTimerBtn = document.getElementById('pause-timer-btn');
    const resumeTimerBtn = document.getElementById('resume-timer-btn');
    const restartTimerBtn = document.getElementById('restart-timer-btn');
    const resetTimerBtn = document.getElementById('reset-timer-btn');

    // Timer state
    let timerInterval = null;
    let totalSeconds = 0;
    let remainingSeconds = 0;
    let isPaused = false;
    let isFinished = false;

    // Initialize
    function init() {
        startClock();
        attachEventListeners();
    }

    // Real-time clock
    function startClock() {
        updateClock();
        setInterval(updateClock, 1000);
    }

    function updateClock() {
        const now = new Date();

        // Format time
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        timeDisplay.textContent = `${hours}:${minutes}:${seconds}`;

        // Format date
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateStr = now.toLocaleDateString('en-US', options);
        dateDisplay.textContent = dateStr;
    }

    // Event listeners
    function attachEventListeners() {
        startTimerBtn.addEventListener('click', startTimer);
        pauseTimerBtn.addEventListener('click', pauseTimer);
        resumeTimerBtn.addEventListener('click', resumeTimer);
        restartTimerBtn.addEventListener('click', restartTimer);
        resetTimerBtn.addEventListener('click', resetTimer);

        // Prevent negative values and auto-correct
        [hoursInput, minutesInput, secondsInput].forEach(input => {
            input.addEventListener('input', (e) => {
                if (e.target.value < 0) e.target.value = 0;
            });

            input.addEventListener('blur', (e) => {
                const max = e.target.id === 'hours-input' ? 23 : 59;
                if (e.target.value > max) e.target.value = max;
                if (e.target.value === '') e.target.value = 0;
            });
        });
    }

    // Start timer
    function startTimer() {
        const hours = parseInt(hoursInput.value) || 0;
        const minutes = parseInt(minutesInput.value) || 0;
        const seconds = parseInt(secondsInput.value) || 0;

        totalSeconds = hours * 3600 + minutes * 60 + seconds;

        if (totalSeconds === 0) {
            alert('Please set a time greater than 0');
            return;
        }

        remainingSeconds = totalSeconds;
        isPaused = false;
        isFinished = false;

        // Hide setup, show display
        timerSetup.style.display = 'none';
        timerDisplayContainer.style.display = 'block';

        // Reset classes
        timerDisplayContainer.className = 'timer-display-container';

        // Start countdown
        updateTimerDisplay();
        timerInterval = setInterval(countdown, 1000);
    }

    // Countdown logic
    function countdown() {
        if (isPaused) return;

        remainingSeconds--;

        if (remainingSeconds < 0) {
            finishTimer();
            return;
        }

        updateTimerDisplay();
        updateWarningState();
    }

    // Update timer display
    function updateTimerDisplay() {
        const hours = Math.floor(remainingSeconds / 3600);
        const minutes = Math.floor((remainingSeconds % 3600) / 60);
        const seconds = remainingSeconds % 60;

        timerDisplay.textContent =
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Update progress bar
        const percentage = (remainingSeconds / totalSeconds) * 100;
        timerProgressFill.style.width = `${percentage}%`;
    }

    // Update warning state based on remaining time
    function updateWarningState() {
        const percentage = (remainingSeconds / totalSeconds) * 100;

        // Remove all warning classes
        timerDisplayContainer.classList.remove('warning-50', 'warning-25', 'warning-10');

        if (percentage <= 10) {
            timerDisplayContainer.classList.add('warning-10');
        } else if (percentage <= 25) {
            timerDisplayContainer.classList.add('warning-25');
        } else if (percentage <= 50) {
            timerDisplayContainer.classList.add('warning-50');
        }
    }

    // Finish timer
    function finishTimer() {
        clearInterval(timerInterval);
        isFinished = true;
        remainingSeconds = 0;
        updateTimerDisplay();

        // Add finished class for red screen
        timerDisplayContainer.classList.add('finished');

        // Play alarm sound
        playAlarm();
    }

    // Play alarm sound
    function playAlarm() {
        // Use Web Audio API to generate alarm sound
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create a pleasant alarm sound with multiple beeps
            function beep(frequency, startTime, duration) {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = frequency;
                oscillator.type = 'sine';

                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

                oscillator.start(startTime);
                oscillator.stop(startTime + duration);
            }

            // Create a sequence of beeps
            const now = audioContext.currentTime;
            beep(800, now, 0.2);
            beep(800, now + 0.3, 0.2);
            beep(800, now + 0.6, 0.2);
            beep(1000, now + 0.9, 0.4);

        } catch (error) {
            console.log('Could not generate alarm sound:', error);
        }
    }

    // Pause timer
    function pauseTimer() {
        isPaused = true;
        pauseTimerBtn.style.display = 'none';
        resumeTimerBtn.style.display = 'inline-flex';
    }

    // Resume timer
    function resumeTimer() {
        isPaused = false;
        pauseTimerBtn.style.display = 'inline-flex';
        resumeTimerBtn.style.display = 'none';
    }

    // Restart timer
    function restartTimer() {
        clearInterval(timerInterval);
        remainingSeconds = totalSeconds;
        isPaused = false;
        isFinished = false;

        // Reset classes
        timerDisplayContainer.classList.remove('finished', 'warning-10', 'warning-25', 'warning-50');

        // Reset button visibility
        pauseTimerBtn.style.display = 'inline-flex';
        resumeTimerBtn.style.display = 'none';

        // Restart countdown
        updateTimerDisplay();
        timerInterval = setInterval(countdown, 1000);
    }

    // Reset timer (back to setup)
    function resetTimer() {
        clearInterval(timerInterval);
        isPaused = false;
        isFinished = false;
        remainingSeconds = 0;
        totalSeconds = 0;

        // Reset button visibility
        pauseTimerBtn.style.display = 'inline-flex';
        resumeTimerBtn.style.display = 'none';

        // Show setup, hide display
        timerSetup.style.display = 'block';
        timerDisplayContainer.style.display = 'none';

        // Reset classes
        timerDisplayContainer.classList.remove('finished', 'warning-10', 'warning-25', 'warning-50');
    }

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
