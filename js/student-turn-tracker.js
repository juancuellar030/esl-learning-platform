/**
 * Student Turn Tracker – Logic
 * Manages student turns, random pickers, filtering, and persistence.
 */

(function () {
    'use strict';

    // ── State ─────────────────────────────────────────────
    const LOCAL_STORAGE_KEY = 'esl_turn_tracker_state';

    let state = {
        turns: {},       // { "STUDENT NAME": { count: 0, status: "none"|"correct"|"participated" } }
        absent: {},      // { "STUDENT NAME": true/false }
    };

    let activeFilter = 'all';  // 'all', 'correct', 'participated', 'unselected'
    let selectedWinner = null;

    // ── Helpers ───────────────────────────────────────────
    function getStudents() {
        return typeof studentNames !== 'undefined' ? studentNames : [];
    }

    function getAvailableStudents() {
        return getStudents().filter(s => !state.absent[s] && getStudentStatus(s) === 'none');
    }

    function getStudentStatus(name) {
        return (state.turns[name] && state.turns[name].status) || 'none';
    }

    function getStudentTurns(name) {
        return (state.turns[name] && state.turns[name].count) || 0;
    }

    // ── Persistence ───────────────────────────────────────
    function saveToLocalStorage() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
        } catch (e) { console.warn('Could not save to localStorage', e); }
    }

    function loadFromLocalStorage() {
        try {
            const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                state.turns = parsed.turns || {};
                state.absent = parsed.absent || {};
            }
        } catch (e) { console.warn('Could not load from localStorage', e); }
    }

    function getExportData() {
        return {
            tool: 'student-turn-tracker',
            savedDate: new Date().toISOString(),
            turns: state.turns,
            absent: state.absent,
        };
    }

    function importData(data) {
        if (!data || data.tool !== 'student-turn-tracker') {
            showNotification('Invalid file format', 'error');
            return;
        }
        state.turns = data.turns || {};
        state.absent = data.absent || {};
        saveToLocalStorage();
        renderGrid();
        updateFilterCounts();
        showNotification('Data loaded successfully!', 'success');
    }

    // ── Notifications ─────────────────────────────────────
    function showNotification(message, type = 'info') {
        const container = document.getElementById('ttNotifications');
        const el = document.createElement('div');
        el.className = `tt-notification ${type}`;
        const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
        el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${message}`;
        container.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 300);
        }, 3500);
    }

    // ── Grid Rendering ────────────────────────────────────
    function renderGrid() {
        const grid = document.getElementById('ttStudentGrid');
        grid.innerHTML = '';

        const students = getStudents();
        students.forEach(name => {
            const status = getStudentStatus(name);
            const turns = getStudentTurns(name);
            const isAbsent = !!state.absent[name];

            // Apply filter
            if (activeFilter === 'correct' && status !== 'correct') return;
            if (activeFilter === 'participated' && status !== 'participated') return;
            if (activeFilter === 'unselected' && status !== 'none') return;

            const card = document.createElement('div');
            card.className = 'tt-student-card';
            if (isAbsent) card.classList.add('status-absent');
            else if (status === 'correct') card.classList.add('status-correct');
            else if (status === 'participated') card.classList.add('status-participated');

            card.dataset.student = name;

            // Status icon
            let statusIcon = '';
            if (status === 'correct') statusIcon = '<span class="tt-status-icon" style="color:#27ae60;">✓</span>';
            else if (status === 'participated') statusIcon = '<span class="tt-status-icon" style="color:#f39c12;">●</span>';

            // Turn badge
            const badgeClass = turns > 0 ? 'tt-turn-badge has-turns' : 'tt-turn-badge';

            card.innerHTML = `
                <button class="tt-absent-toggle" data-student="${name}" title="${isAbsent ? 'Mark present' : 'Mark absent'}">
                    <i class="fa-solid ${isAbsent ? 'fa-user-slash' : 'fa-user-check'}"></i>
                </button>
                ${statusIcon}
                <div class="tt-student-name">${name}</div>
                <div class="${badgeClass}"><i class="fa-solid fa-rotate"></i> ${turns}</div>
            `;

            // Click handlers
            card.addEventListener('click', (e) => {
                if (e.target.closest('.tt-absent-toggle')) return;
                if (isAbsent) return;
                showWinner(name);
            });

            const absentBtn = card.querySelector('.tt-absent-toggle');
            absentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                state.absent[name] = !state.absent[name];
                saveToLocalStorage();
                renderGrid();
                updateFilterCounts();
            });

            grid.appendChild(card);
        });
    }

    // ── Filter Controls ───────────────────────────────────
    function updateFilterCounts() {
        const students = getStudents();
        const counts = { all: students.length, correct: 0, participated: 0, unselected: 0 };
        students.forEach(s => {
            const st = getStudentStatus(s);
            if (st === 'correct') counts.correct++;
            else if (st === 'participated') counts.participated++;
            else counts.unselected++;
        });

        document.querySelectorAll('.tt-filter-btn').forEach(btn => {
            const filter = btn.dataset.filter;
            const countEl = btn.querySelector('.filter-count');
            if (countEl && counts[filter] !== undefined) {
                countEl.textContent = counts[filter];
            }
            btn.classList.toggle('active', filter === activeFilter);
        });
    }

    // ── Winner Display ────────────────────────────────────
    function showWinner(name) {
        selectedWinner = name;
        const overlay = document.getElementById('ttWinnerOverlay');
        document.getElementById('ttWinnerName').textContent = name;
        overlay.classList.add('visible');
    }

    function hideWinner() {
        selectedWinner = null;
        document.getElementById('ttWinnerOverlay').classList.remove('visible');
    }

    function applyTurn(type) {
        if (!selectedWinner) return;
        const name = selectedWinner;
        if (!state.turns[name]) state.turns[name] = { count: 0, status: 'none' };
        state.turns[name].count++;
        state.turns[name].status = type; // 'correct' or 'participated'
        saveToLocalStorage();
        hideWinner();
        renderGrid();
        updateFilterCounts();
        showNotification(`${name}: ${type === 'correct' ? '✓ Correct answer!' : '● Participated!'}`, 'success');
    }

    // ── Hopping Selector ──────────────────────────────────
    let hopInterval = null;

    function startHop() {
        const pool = getAvailableStudents();
        if (pool.length === 0) {
            showNotification('All students have had turns! Reset categories to continue.', 'info');
            return;
        }

        // Clear any previous highlights
        document.querySelectorAll('.tt-student-card.hop-highlight').forEach(c => c.classList.remove('hop-highlight'));

        const allCards = Array.from(document.querySelectorAll('.tt-student-card')).filter(c => {
            const name = c.dataset.student;
            return pool.includes(name);
        });

        if (allCards.length === 0) return;

        let elapsed = 0;
        const totalDuration = 2500; // 2.5 seconds
        let currentIdx = -1;
        let speed = 80;

        function hop() {
            // Remove old highlight
            if (currentIdx >= 0 && allCards[currentIdx]) {
                allCards[currentIdx].classList.remove('hop-highlight');
            }

            currentIdx = Math.floor(Math.random() * allCards.length);
            allCards[currentIdx].classList.add('hop-highlight');

            // Scroll into view gently
            allCards[currentIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            elapsed += speed;

            if (elapsed < totalDuration) {
                // Gradually slow down
                speed = Math.min(speed + 8, 350);
                hopInterval = setTimeout(hop, speed);
            } else {
                // Final pick
                const winnerName = allCards[currentIdx].dataset.student;
                setTimeout(() => {
                    allCards[currentIdx].classList.remove('hop-highlight');
                    showWinner(winnerName);
                }, 500);
            }
        }

        hop();
    }

    // ── Roulette ──────────────────────────────────────────
    let rouletteSpinning = false;

    function openRoulette() {
        const pool = getAvailableStudents();
        if (pool.length === 0) {
            showNotification('All students have had turns! Reset categories to continue.', 'info');
            return;
        }

        const overlay = document.getElementById('ttRouletteOverlay');
        overlay.classList.add('visible');
        drawRouletteWheel(pool);
    }

    function closeRoulette() {
        document.getElementById('ttRouletteOverlay').classList.remove('visible');
        rouletteSpinning = false;
    }

    function drawRouletteWheel(names) {
        const canvas = document.getElementById('rouletteCanvas');
        const ctx = canvas.getContext('2d');
        const size = Math.min(window.innerWidth * 0.75, 540);
        canvas.width = size;
        canvas.height = size;

        const center = size / 2;
        const radius = center - 4;
        const sliceAngle = (2 * Math.PI) / names.length;

        const colors = [
            '#7678ed', '#f7b801', '#f18701', '#f35b04', '#27ae60',
            '#e74c3c', '#3498db', '#9b59b6', '#1abc9c', '#e67e22',
            '#2ecc71', '#f39c12', '#8e44ad', '#16a085', '#d35400',
            '#c0392b', '#2980b9', '#6c5ce7', '#fdcb6e', '#00b894',
        ];

        canvas._names = names;
        canvas._sliceAngle = sliceAngle;
        canvas._rotation = 0;

        function draw(rotation) {
            ctx.clearRect(0, 0, size, size);

            names.forEach((name, i) => {
                const startAngle = rotation + i * sliceAngle;
                const endAngle = startAngle + sliceAngle;

                ctx.beginPath();
                ctx.moveTo(center, center);
                ctx.arc(center, center, radius, startAngle, endAngle);
                ctx.closePath();
                ctx.fillStyle = colors[i % colors.length];
                ctx.fill();

                // Slice border
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Name text
                ctx.save();
                ctx.translate(center, center);
                ctx.rotate(startAngle + sliceAngle / 2);
                ctx.textAlign = 'right';
                ctx.fillStyle = 'white';
                ctx.font = `bold ${Math.max(11, Math.min(16, 600 / names.length))}px 'Reddit Sans', sans-serif`;
                ctx.shadowColor = 'rgba(0,0,0,0.4)';
                ctx.shadowBlur = 3;
                const displayName = name.length > 14 ? name.slice(0, 12) + '…' : name;
                ctx.fillText(displayName, radius - 14, 5);
                ctx.restore();
            });

            // Center circle
            ctx.beginPath();
            ctx.arc(center, center, 28, 0, 2 * Math.PI);
            ctx.fillStyle = var_indigo();
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        draw(0);

        // Store draw func for spinning
        canvas._drawFunc = draw;
    }

    function var_indigo() {
        return getComputedStyle(document.documentElement).getPropertyValue('--indigo-velvet').trim() || '#3d348b';
    }

    function spinRoulette() {
        if (rouletteSpinning) return;
        rouletteSpinning = true;

        const canvas = document.getElementById('rouletteCanvas');
        const names = canvas._names;
        const sliceAngle = canvas._sliceAngle;
        const draw = canvas._drawFunc;
        const spinBtn = document.getElementById('rouletteSpinBtn');
        spinBtn.disabled = true;

        const spinAmount = Math.PI * (8 + Math.random() * 6); // 4-7 full rotations
        const duration = 4000;
        const startTime = performance.now();
        let startRotation = canvas._rotation || 0;

        // Tick sound via AudioContext
        let audioCtx;
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }

        function playTick() {
            if (!audioCtx) return;
            try {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.value = 800 + Math.random() * 400;
                gain.gain.value = 0.05;
                osc.start();
                osc.stop(audioCtx.currentTime + 0.03);
            } catch (e) { }
        }

        let lastSliceIdx = -1;

        function animate(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentRotation = startRotation + spinAmount * eased;

            draw(currentRotation);

            // Tick sound
            const currentSlice = Math.floor(((currentRotation % (2 * Math.PI)) + 2 * Math.PI) / sliceAngle) % names.length;
            if (currentSlice !== lastSliceIdx) {
                lastSliceIdx = currentSlice;
                if (progress < 0.95) playTick();
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                canvas._rotation = currentRotation;
                rouletteSpinning = false;
                spinBtn.disabled = false;

                // Find winner: pointer is at top (angle -PI/2 from rightward axis)
                const pointerAngle = -Math.PI / 2;
                // Normalize final rotation
                const normalizedAngle = ((pointerAngle - currentRotation) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
                const winnerIdx = Math.floor(normalizedAngle / sliceAngle) % names.length;
                const winner = names[winnerIdx];

                setTimeout(() => {
                    closeRoulette();
                    showWinner(winner);
                }, 600);
            }
        }

        requestAnimationFrame(animate);
    }

    // ── Balloons ──────────────────────────────────────────
    function openBalloons() {
        const pool = getAvailableStudents();
        if (pool.length === 0) {
            showNotification('All students have had turns! Reset categories to continue.', 'info');
            return;
        }

        const overlay = document.getElementById('ttBalloonOverlay');
        overlay.classList.add('visible');

        // Clear old balloons
        overlay.querySelectorAll('.tt-balloon, .tt-balloon-pop').forEach(el => el.remove());

        const balloonColors = [
            '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c45ab3',
            '#ff9f43', '#1dd1a1', '#5f27cd', '#54a0ff', '#ee5a24',
            '#ff6348', '#ffa502', '#2ed573', '#3742fa', '#a29bfe',
        ];

        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Shuffle pool
        const shuffled = [...pool].sort(() => Math.random() - 0.5);

        shuffled.forEach((name, i) => {
            const balloon = document.createElement('div');
            balloon.className = 'tt-balloon';
            balloon.dataset.student = name;

            const color = balloonColors[i % balloonColors.length];
            const x = 60 + Math.random() * (vw - 160);
            const y = 100 + Math.random() * (vh - 250);
            const bw = 70;
            const bh = 90;

            balloon.style.left = x + 'px';
            balloon.style.top = y + 'px';
            balloon.style.width = bw + 'px';
            balloon.style.height = bh + 'px';

            balloon.innerHTML = `
                <svg viewBox="0 0 70 100" width="${bw}" height="${bh + 10}">
                    <ellipse cx="35" cy="40" rx="30" ry="38" fill="${color}" />
                    <polygon points="35,78 30,82 40,82" fill="${color}" />
                    <line x1="35" y1="82" x2="35" y2="100" stroke="#999" stroke-width="1.5" />
                    <ellipse cx="25" cy="28" rx="6" ry="10" fill="rgba(255,255,255,0.25)" transform="rotate(-20, 25, 28)" />
                </svg>
            `;

            // Floating animation
            const bobDuration = 2 + Math.random() * 2;
            const bobDelay = Math.random() * 2;
            balloon.style.animation = `ttBalloonFloat ${bobDuration}s ease-in-out ${bobDelay}s infinite alternate`;

            balloon.addEventListener('click', () => popBalloon(balloon, name, overlay));

            overlay.appendChild(balloon);
        });

        // Add float keyframe dynamically if not present
        if (!document.getElementById('ttBalloonFloatStyle')) {
            const style = document.createElement('style');
            style.id = 'ttBalloonFloatStyle';
            style.textContent = `
                @keyframes ttBalloonFloat {
                    0% { transform: translateY(0px) rotate(-3deg); }
                    100% { transform: translateY(-18px) rotate(3deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ── Pop Sound Effect (synthesized) ────────────────────
    function playPopSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;

            // Noise burst for the "pop"
            const bufferSize = ctx.sampleRate * 0.15;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            // Bandpass filter to shape the pop
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1200;
            filter.Q.value = 0.7;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            noise.start(now);
            noise.stop(now + 0.15);

            // Thump for body
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0.3, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.connect(oscGain);
            oscGain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.12);

            // Cleanup
            setTimeout(() => ctx.close(), 300);
        } catch (e) { /* Audio not available */ }
    }

    function popBalloon(balloon, name, overlay) {
        const rect = balloon.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        // Play pop sound
        playPopSound();

        // Remove balloon
        balloon.style.transition = 'transform 0.15s ease, opacity 0.15s ease';
        balloon.style.transform = 'scale(1.4)';
        balloon.style.opacity = '0';

        setTimeout(() => {
            balloon.remove();

            // Confetti — render ABOVE the balloon overlay (z-index 8500)
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 80,
                    spread: 80,
                    origin: { x: cx / window.innerWidth, y: cy / window.innerHeight },
                    colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c45ab3'],
                    zIndex: 9999,
                });
            }

            // Show name
            const nameEl = document.createElement('div');
            nameEl.className = 'tt-balloon-pop';
            nameEl.textContent = name;
            nameEl.style.left = (cx - 50) + 'px';
            nameEl.style.top = (cy - 15) + 'px';
            overlay.appendChild(nameEl);

            setTimeout(() => {
                closeBalloons();
                showWinner(name);
            }, 1200);
        }, 150);
    }

    function closeBalloons() {
        document.getElementById('ttBalloonOverlay').classList.remove('visible');
    }

    // ── Reset Categories ──────────────────────────────────
    function resetCategories() {
        getStudents().forEach(name => {
            if (state.turns[name]) {
                state.turns[name].status = 'none';
                state.turns[name].count = 0;
            }
        });
        saveToLocalStorage();
        renderGrid();
        updateFilterCounts();
        showNotification('Categories reset! All students are available again.', 'success');
    }

    function resetAll() {
        state.turns = {};
        state.absent = {};
        saveToLocalStorage();
        renderGrid();
        updateFilterCounts();
        showNotification('All data cleared.', 'success');
    }

    // ── Google Drive Integration ──────────────────────────
    function setupDrive() {
        if (typeof GoogleDriveService === 'undefined') {
            console.warn('GoogleDriveService not loaded');
            return;
        }

        const driveService = new GoogleDriveService({
            folderName: 'ESL - Turn Tracker',
            fileExtension: '.json',
            onSave: () => getExportData(),
            onLoad: (data) => importData(data),
            onNotify: (msg, type) => showNotification(msg, type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'),
        });

        document.getElementById('ttDriveBtn').addEventListener('click', () => {
            driveService.openModal();
            setTimeout(() => {
                const inp = document.getElementById('gds-filename');
                if (inp && !inp.value) {
                    inp.value = `turns-${new Date().toISOString().slice(0, 10)}`;
                }
            }, 400);
        });
    }

    // ── Init ──────────────────────────────────────────────
    function init() {
        loadFromLocalStorage();
        renderGrid();
        updateFilterCounts();
        setupDrive();

        // Filter buttons
        document.querySelectorAll('.tt-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                activeFilter = btn.dataset.filter;
                renderGrid();
                updateFilterCounts();
            });
        });

        // Picker buttons
        document.getElementById('ttPickerHop').addEventListener('click', startHop);
        document.getElementById('ttPickerRoulette').addEventListener('click', openRoulette);
        document.getElementById('ttPickerBalloon').addEventListener('click', openBalloons);

        // Winner actions
        document.getElementById('ttWinnerCorrect').addEventListener('click', () => applyTurn('correct'));
        document.getElementById('ttWinnerParticipated').addEventListener('click', () => applyTurn('participated'));
        document.getElementById('ttWinnerSkip').addEventListener('click', hideWinner);
        document.getElementById('ttWinnerClose').addEventListener('click', hideWinner);

        // Roulette
        document.getElementById('rouletteSpinBtn').addEventListener('click', spinRoulette);
        document.getElementById('rouletteCloseBtn').addEventListener('click', closeRoulette);

        // Balloons
        document.getElementById('balloonCloseBtn').addEventListener('click', closeBalloons);

        // Reset
        document.getElementById('ttResetCategories').addEventListener('click', () => {
            if (confirm('Reset all turn categories? Students will be available for selection again.')) {
                resetCategories();
            }
        });

        document.getElementById('ttResetAll').addEventListener('click', () => {
            if (confirm('Clear ALL data including absences? This cannot be undone.')) {
                resetAll();
            }
        });

        // Close overlays on background click
        document.getElementById('ttWinnerOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) hideWinner();
        });
        document.getElementById('ttRouletteOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeRoulette();
        });
        document.getElementById('ttBalloonOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeBalloons();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
