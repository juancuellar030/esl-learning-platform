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

    // Stopwatch state
    let stopwatchInterval = null;
    let stopwatchStartTime = 0;
    let stopwatchElapsed = 0;
    let stopwatchRunning = false;
    let laps = [];

    // Initialize
    function init() {
        startClock();
        attachEventListeners();
        initTabSwitching();
    }

    // Tab Switching
    function initTabSwitching() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;

                // Update active tab button
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update active tab content
                tabContents.forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${targetTab}-tab`).classList.add('active');
            });
        });
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

    // Stopwatch Functions
    function startStopwatch() {
        if (!stopwatchRunning) {
            stopwatchStartTime = Date.now() - stopwatchElapsed;
            stopwatchRunning = true;
            stopwatchInterval = setInterval(updateStopwatch, 10); // Update every 10ms for milliseconds

            document.getElementById('stopwatch-display').classList.add('running');
            document.getElementById('start-stopwatch-btn').style.display = 'none';
            document.getElementById('stop-stopwatch-btn').style.display = 'flex';
            document.getElementById('lap-stopwatch-btn').style.display = 'flex';
        }
    }

    function stopStopwatch() {
        if (stopwatchRunning) {
            stopwatchRunning = false;
            clearInterval(stopwatchInterval);
            stopwatchElapsed = Date.now() - stopwatchStartTime;

            document.getElementById('stopwatch-display').classList.remove('running');
            document.getElementById('start-stopwatch-btn').style.display = 'flex';
            document.getElementById('stop-stopwatch-btn').style.display = 'none';
            document.getElementById('lap-stopwatch-btn').style.display = 'none';
        }
    }

    function resetStopwatch() {
        stopStopwatch();
        stopwatchElapsed = 0;
        laps = [];
        updateStopwatchDisplay(0);
        document.getElementById('laps-container').style.display = 'none';
        document.getElementById('laps-list').innerHTML = '';
    }

    function recordLap() {
        if (stopwatchRunning) {
            const lapTime = Date.now() - stopwatchStartTime;
            laps.push(lapTime);
            updateLapsList();
            document.getElementById('laps-container').style.display = 'block';
        }
    }

    function updateStopwatch() {
        const elapsed = Date.now() - stopwatchStartTime;
        updateStopwatchDisplay(elapsed);
    }

    function updateStopwatchDisplay(ms) {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const milliseconds = Math.floor((ms % 1000));

        const display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
        document.getElementById('stopwatch-display').textContent = display;
    }

    function updateLapsList() {
        const lapsList = document.getElementById('laps-list');
        lapsList.innerHTML = '';

        // Calculate lap times (difference between consecutive laps)
        const lapTimes = laps.map((lap, index) => {
            if (index === 0) return lap;
            return lap - laps[index - 1];
        });

        // Find fastest and slowest laps
        const fastest = Math.min(...lapTimes);
        const slowest = Math.max(...lapTimes);

        laps.forEach((lap, index) => {
            const lapTime = lapTimes[index];
            const lapItem = document.createElement('div');
            lapItem.className = 'lap-item';

            // Highlight fastest and slowest (only if there are more than 2 laps)
            if (laps.length > 2) {
                if (lapTime === fastest) lapItem.classList.add('fastest');
                if (lapTime === slowest) lapItem.classList.add('slowest');
            }

            const hours = Math.floor(lapTime / 3600000);
            const minutes = Math.floor((lapTime % 3600000) / 60000);
            const seconds = Math.floor((lapTime % 60000) / 1000);
            const milliseconds = Math.floor((lapTime % 1000));

            lapItem.innerHTML = `
                <span class="lap-number">Lap ${index + 1}</span>
                <span class="lap-time">${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}</span>
            `;

            lapsList.appendChild(lapItem);
        });
    }

    // Event Listeners
    function attachEventListeners() {
        // Timer events
        startTimerBtn.addEventListener('click', startTimer);
        pauseTimerBtn.addEventListener('click', pauseTimer);
        resumeTimerBtn.addEventListener('click', resumeTimer);
        restartTimerBtn.addEventListener('click', restartTimer);
        resetTimerBtn.addEventListener('click', resetTimer);

        // Stopwatch events
        document.getElementById('start-stopwatch-btn').addEventListener('click', startStopwatch);
        document.getElementById('stop-stopwatch-btn').addEventListener('click', stopStopwatch);
        document.getElementById('reset-stopwatch-btn').addEventListener('click', resetStopwatch);
        document.getElementById('lap-stopwatch-btn').addEventListener('click', recordLap);
    }

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
