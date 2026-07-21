/**
 * Student Turn Tracker – Logic
 * Manages student turns, random pickers, filtering, and persistence.
 * Supports multiple class groups via CLASS_GROUPS (students-data.js).
 */

(function () {
    'use strict';

    // ── State ─────────────────────────────────────────────
    const LS_KEY = 'esl_turn_tracker_v2';   // versioned key (multi-group)

    // activeGroupId holds the currently displayed group
    let activeGroupId = null;

    // state is now keyed by group id:
    // { "5B": { turns: {...}, absent: {...} }, "5C": { ... } }
    let allState = {};

    // View preferences
    let nameMode = 'full'; // 'full' or 'first'
    let sortMode = 'first'; // 'first' or 'last'

    // ── Custom Audio Preloading & Setup ────────────────────
    const globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let balloonPopBuffer = null;
    let cardFlipBuffer = null;
    let slotSpinBuffer = null;
    let balloonInflateBuffer = null;
    let studentSelectedBuffer = null;
    let pinataHit1Buffer = null;
    let pinataHit2Buffer = null;
    let pinataExplosionBuffer = null;

    function playAudioBuffer(buffer) {
        if (!buffer) return;
        try {
            if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
            const source = globalAudioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(globalAudioCtx.destination);
            source.start(0);
        } catch (e) { }
    }

    async function preloadSounds() {
        try {
            const popRes = await fetch('assets/sounds/balloon-pop.ogg');
            balloonPopBuffer = await globalAudioCtx.decodeAudioData(await popRes.arrayBuffer());

            const flipRes = await fetch('assets/sounds/card-flip.ogg');
            cardFlipBuffer = await globalAudioCtx.decodeAudioData(await flipRes.arrayBuffer());

            const spinRes = await fetch('assets/sounds/slot-machine-spin.ogg');
            slotSpinBuffer = await globalAudioCtx.decodeAudioData(await spinRes.arrayBuffer());

            const inflateRes = await fetch('assets/sounds/balloon-inflate.ogg');
            balloonInflateBuffer = await globalAudioCtx.decodeAudioData(await inflateRes.arrayBuffer());

            const selectedRes = await fetch('assets/sounds/student-selected.ogg');
            studentSelectedBuffer = await globalAudioCtx.decodeAudioData(await selectedRes.arrayBuffer());

            const hit1Res = await fetch('assets/sounds/piñata-hit-1.ogg');
            pinataHit1Buffer = await globalAudioCtx.decodeAudioData(await hit1Res.arrayBuffer());

            const hit2Res = await fetch('assets/sounds/piñata-hit-2.ogg');
            pinataHit2Buffer = await globalAudioCtx.decodeAudioData(await hit2Res.arrayBuffer());

            const explosionRes = await fetch('assets/sounds/piñata-explosion.ogg');
            pinataExplosionBuffer = await globalAudioCtx.decodeAudioData(await explosionRes.arrayBuffer());
        } catch (e) {
            console.warn("Custom sound files (.ogg) not found or failed to load. Will fail gracefully.");
        }
    }
    // Initialize buffers immediately
    preloadSounds();

    /**
     * Parses a Hispanic/LATAM full name.
     * Assumes format: FirstSurname SecondSurname FirstName1 FirstName2...
     * If 3+ words: index 0 and 1 are surnames. rest are first names.
     */
    function parseName(fullName) {
        const parts = fullName.trim().split(/\s+/);
        let lastNames = [];
        let firstNames = [];
        let firstSurname = "";

        if (parts.length >= 3) {
            lastNames = [parts[0], parts[1]];
            firstNames = parts.slice(2);
            firstSurname = parts[0];
        } else if (parts.length === 2) {
            lastNames = [parts[0]];
            firstNames = [parts[1]];
            firstSurname = parts[0];
        } else {
            firstNames = parts;
            lastNames = [];
            firstSurname = fullName;
        }

        const firstNamesStr = firstNames.join(' ');
        const lastNamesStr = lastNames.join(' ');

        return {
            original: fullName,
            firstNamesStr,
            lastNamesStr,
            firstSurname,
            rearrangedFull: (firstNamesStr + ' ' + lastNamesStr).trim(),
            firstPlusFirstLast: (firstNamesStr + ' ' + firstSurname).trim(),
            sortByLast: (lastNamesStr + ' ' + firstNamesStr).trim(),
            sortByFirst: (firstNamesStr + ' ' + lastNamesStr).trim()
        };
    }

    function getGroups() {
        return (typeof CLASS_GROUPS !== 'undefined' && CLASS_GROUPS.length)
            ? CLASS_GROUPS
            : [{ id: '__default', label: 'Class', students: (typeof STUDENTS_DATA !== 'undefined' ? STUDENTS_DATA : []) }];
    }

    function getActiveGroup() {
        const groups = getGroups();
        return groups.find(g => g.id === activeGroupId) || groups[0];
    }

    function getGroupState(groupId) {
        if (!allState[groupId]) {
            allState[groupId] = { turns: {}, absent: {} };
        }
        return allState[groupId];
    }

    function currentState() {
        return getGroupState(activeGroupId);
    }

    // ── Helpers ───────────────────────────────────────────
    function getStudents() {
        const group = getActiveGroup();
        return group ? group.students.map(s => (typeof s === 'string' ? s : s.name)) : [];
    }

    function getAvailableStudents() {
        const st = currentState();
        return getStudents().filter(s => !st.absent[s] && getStudentStatus(s) === 'none');
    }

    function getStudentStatus(name) {
        const st = currentState();
        return (st.turns[name] && st.turns[name].status) || 'none';
    }

    function getStudentTurns(name) {
        const st = currentState();
        return (st.turns[name] && st.turns[name].count) || 0;
    }

    // ── Persistence ───────────────────────────────────────
    function saveToLocalStorage() {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify({ allState, activeGroupId, nameMode, sortMode }));
        } catch (e) { console.warn('Could not save to localStorage', e); }
    }

    function loadFromLocalStorage() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                allState = parsed.allState || {};

                if (parsed.nameMode) nameMode = parsed.nameMode;
                if (parsed.sortMode) sortMode = parsed.sortMode;

                // Restore last active group only if it still exists
                const groups = getGroups();
                const savedId = parsed.activeGroupId;
                if (savedId && groups.find(g => g.id === savedId)) {
                    activeGroupId = savedId;
                } else {
                    activeGroupId = groups[0].id;
                }
            } else {
                activeGroupId = getGroups()[0].id;
            }

            // Legacy migration: if old single-group key exists, absorb into first group
            const legacyRaw = localStorage.getItem('esl_turn_tracker_state');
            if (legacyRaw && !allState[getGroups()[0].id]) {
                try {
                    const legacy = JSON.parse(legacyRaw);
                    allState[getGroups()[0].id] = {
                        turns: legacy.turns || {},
                        absent: legacy.absent || {},
                    };
                } catch (_) { }
            }
        } catch (e) {
            console.warn('Could not load from localStorage', e);
            activeGroupId = getGroups()[0].id;
        }
    }

    function getExportData() {
        const group = getActiveGroup();
        return {
            tool: 'student-turn-tracker',
            groupId: activeGroupId,
            groupLabel: group ? group.label : '',
            savedDate: new Date().toISOString(),
            turns: currentState().turns,
            absent: currentState().absent,
        };
    }

    function importData(data) {
        if (!data || data.tool !== 'student-turn-tracker') {
            showNotification('Invalid file format', 'error');
            return;
        }
        // If the file carries a groupId, switch to that group (if it exists)
        if (data.groupId) {
            const groups = getGroups();
            const target = groups.find(g => g.id === data.groupId);
            if (target) {
                activeGroupId = target.id;
                renderGroupTabs();
            }
        }
        getGroupState(activeGroupId).turns = data.turns || {};
        getGroupState(activeGroupId).absent = data.absent || {};
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

    // ── Group Tabs ────────────────────────────────────────
    function renderGroupTabs() {
        const container = document.getElementById('ttGroupTabs');
        if (!container) return;
        container.innerHTML = '';

        getGroups().forEach(group => {
            const btn = document.createElement('button');
            btn.className = 'tt-group-tab' + (group.id === activeGroupId ? ' active' : '');
            btn.dataset.groupId = group.id;
            btn.innerHTML = `<i class="fa-solid fa-users"></i> ${group.label}`;
            btn.addEventListener('click', () => switchGroup(group.id));
            container.appendChild(btn);
        });
    }

    function switchGroup(groupId) {
        if (groupId === activeGroupId) return;
        activeGroupId = groupId;
        saveToLocalStorage();
        renderGroupTabs();
        renderGrid();
        updateFilterCounts();
        const group = getActiveGroup();
        showNotification(`Switched to ${group ? group.label : groupId}`, 'info');
    }

    // ── Grid Rendering ────────────────────────────────────
    let activeFilter = 'all';
    let selectedWinner = null;

    function renderGrid() {
        const grid = document.getElementById('ttStudentGrid');
        grid.innerHTML = '';

        let students = getStudents();

        // Sort students based on sortMode
        students.sort((a, b) => {
            const pa = parseName(a);
            const pb = parseName(b);
            if (sortMode === 'last') {
                return pa.sortByLast.localeCompare(pb.sortByLast);
            } else {
                return pa.sortByFirst.localeCompare(pb.sortByFirst);
            }
        });

        students.forEach(name => {
            const status = getStudentStatus(name);
            const turns = getStudentTurns(name);
            const isAbsent = !!currentState().absent[name];

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

            const parsed = parseName(name);
            const displayName = nameMode === 'first' ? parsed.firstNamesStr : parsed.rearrangedFull;

            card.innerHTML = `
                ${statusIcon}
                <div class="tt-student-name">${displayName}</div>
                <div class="tt-card-footer" style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:4px;">
                    <button class="tt-absent-toggle" data-student="${name}" title="${isAbsent ? 'Mark present' : 'Mark absent'}">
                        <i class="fa-solid ${isAbsent ? 'fa-user-slash' : 'fa-user-check'}"></i>
                    </button>
                    <div class="${badgeClass}"><i class="fa-solid fa-rotate"></i> ${turns}</div>
                </div>
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
                currentState().absent[name] = !currentState().absent[name];
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
        const parsed = parseName(name);
        const displayName = parsed.rearrangedFull;

        playAudioBuffer(studentSelectedBuffer);

        const overlay = document.getElementById('ttWinnerOverlay');
        document.getElementById('ttWinnerName').textContent = displayName;
        overlay.classList.add('visible');
    }

    function hideWinner() {
        selectedWinner = null;
        document.getElementById('ttWinnerOverlay').classList.remove('visible');
    }

    function applyTurn(type) {
        if (!selectedWinner) return;
        const name = selectedWinner;
        const st = currentState();
        if (!st.turns[name]) st.turns[name] = { count: 0, status: 'none' };
        st.turns[name].count++;
        st.turns[name].status = type; // 'correct' or 'participated'
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

        // Setup simple audio
        let audioCtx;
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }

        function playHopSound() {
            if (!audioCtx) return;
            try {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.setValueAtTime(500, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
                gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
                osc.start(audioCtx.currentTime);
                osc.stop(audioCtx.currentTime + 0.05);
            } catch (e) { }
        }

        function hop() {
            // Remove old highlight
            if (currentIdx >= 0 && allCards[currentIdx]) {
                allCards[currentIdx].classList.remove('hop-highlight');
            }

            currentIdx = Math.floor(Math.random() * allCards.length);
            allCards[currentIdx].classList.add('hop-highlight');

            playHopSound();

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
                const parsed = parseName(name);
                const displayFull = parsed.firstPlusFirstLast || name;
                const displayName = displayFull.length > 16 ? displayFull.slice(0, 14) + '…' : displayFull;
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

    let chargeInterval = null;
    let chargeValue = 0;
    let chargeDirection = 1;

    function startChargeRoulette(e) {
        if (e && e.type === 'mousedown' && e.button !== 0) return; // Only left click
        if (rouletteSpinning) return;

        chargeValue = 0;
        chargeDirection = 1;

        const fill = document.getElementById('rouletteChargeFill');
        if (fill) fill.style.width = '0%';

        const spinBtn = document.getElementById('rouletteSpinBtn');
        spinBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> CHARGING...';

        if (chargeInterval) clearInterval(chargeInterval);
        chargeInterval = setInterval(() => {
            chargeValue += chargeDirection * 4;
            if (chargeValue >= 100) {
                chargeValue = 100;
                chargeDirection = -1;
            } else if (chargeValue <= 0) {
                chargeValue = 0;
                chargeDirection = 1;
            }
            if (fill) fill.style.width = `${chargeValue}%`;
        }, 30);
    }

    function releaseChargeRoulette(e) {
        if (!chargeInterval) return;
        clearInterval(chargeInterval);
        chargeInterval = null;
        if (chargeValue < 5) chargeValue = 5;
        spinRoulette(chargeValue);
    }

    function spinRoulette(charge = 50) {
        if (rouletteSpinning) return;
        rouletteSpinning = true;

        const canvas = document.getElementById('rouletteCanvas');
        const names = canvas._names;
        const sliceAngle = canvas._sliceAngle;
        const draw = canvas._drawFunc;
        const spinBtn = document.getElementById('rouletteSpinBtn');
        spinBtn.disabled = true;
        spinBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> SPINNING...';

        const minRotations = 2; // base spin
        const maxRotations = 15; // max charge spin
        const baseSpin = minRotations + (maxRotations - minRotations) * (charge / 100);
        const spinAmount = Math.PI * 2 * (baseSpin + Math.random() * 2);

        const duration = 2000 + (charge / 100) * 4000;
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
                spinBtn.innerHTML = '<i class="fa-solid fa-play"></i> HOLD TO SPIN!';
                const fill = document.getElementById('rouletteChargeFill');
                if (fill) fill.style.width = '0%';

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
        playAudioBuffer(balloonInflateBuffer);

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

    // ── Pop Sound Effect (.ogg asset playback) ────────────────────
    function playPopSound() {
        if (!balloonPopBuffer) return;
        try {
            if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
            const source = globalAudioCtx.createBufferSource();
            source.buffer = balloonPopBuffer;
            source.connect(globalAudioCtx.destination);
            source.start(0);
        } catch (e) { }
    }

    // ── Slot Spin Sound Effect (.ogg asset playback) ────────
    function playSlotTickSound() {
        if (!slotSpinBuffer) return;
        try {
            if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
            const source = globalAudioCtx.createBufferSource();
            source.buffer = slotSpinBuffer;
            source.connect(globalAudioCtx.destination);
            source.start(0);
        } catch (e) { }
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
            const parsed = parseName(name);
            const displayName = nameMode === 'first' ? parsed.firstNamesStr : parsed.rearrangedFull;
            const nameEl = document.createElement('div');
            nameEl.className = 'tt-balloon-pop';
            nameEl.textContent = displayName;
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

    // ── Slot Machine ──────────────────────────────────────
    let slotSpinning = false;
    let slotAnimFrame = null;
    let slotSpeed = 0;
    let slotPosition = 0;
    const ITEM_HEIGHT = 120; // Must match CSS

    function openSlotMachine() {
        const pool = getAvailableStudents();
        if (pool.length === 0) {
            showNotification('All students have had turns! Reset categories to continue.', 'info');
            return;
        }

        const overlay = document.getElementById('ttSlotOverlay');
        overlay.classList.add('visible');

        const track = document.getElementById('slotTrack');
        track.innerHTML = '';

        // Setup lights
        const lightsContainer = document.getElementById('slotLights');
        if (lightsContainer && !lightsContainer.dataset.initialized) {
            lightsContainer.dataset.initialized = 'true';
            lightsContainer.innerHTML = '';

            const topEdge = createEdge('row', ['top', '0'], ['left', '12px'], ['right', '12px']);
            const rightEdge = createEdge('column', ['right', '0'], ['top', '12px'], ['bottom', '12px']);
            const bottomEdge = createEdge('row', ['bottom', '0'], ['left', '12px'], ['right', '12px']);
            bottomEdge.style.flexDirection = 'row-reverse';
            const leftEdge = createEdge('column', ['left', '0'], ['top', '12px'], ['bottom', '12px']);
            leftEdge.style.flexDirection = 'column-reverse';

            lightsContainer.append(topEdge, rightEdge, bottomEdge, leftEdge);

            let count = 0;
            for (let i = 0; i < 8; i++) topEdge.appendChild(createLight(count++));
            for (let i = 0; i < 2; i++) rightEdge.appendChild(createLight(count++));
            for (let i = 0; i < 8; i++) bottomEdge.appendChild(createLight(count++));
            for (let i = 0; i < 2; i++) leftEdge.appendChild(createLight(count++));

            function createEdge(dir, ...positions) {
                const el = document.createElement('div');
                el.style.position = 'absolute';
                el.style.display = 'flex';
                el.style.justifyContent = 'space-evenly';
                el.style.alignItems = 'center';
                if (dir.includes('column')) {
                    el.style.flexDirection = dir;
                    el.style.width = '0px';
                } else {
                    el.style.flexDirection = dir;
                    el.style.height = '0px';
                }
                for (let pos of positions) el.style[pos[0]] = pos[1];
                return el;
            }

            function createLight(idx) {
                const l = document.createElement('div');
                l.className = 'slot-light';
                l.style.animationDelay = `${idx * -0.05}s`;
                return l;
            }
        }

        // Shuffle pool
        const shuffled = [...pool].sort(() => Math.random() - 0.5);

        // Add an extra clone at the end to make it seamless
        const reel = [...shuffled, shuffled[0]];

        const slotColors = [
            'rgba(255, 107, 107, 0.1)', 'rgba(255, 217, 61, 0.1)',
            'rgba(107, 203, 119, 0.1)', 'rgba(77, 150, 255, 0.1)',
            'rgba(196, 90, 179, 0.1)'
        ];

        reel.forEach((name, idx) => {
            const div = document.createElement('div');
            div.className = 'tt-slot-item';
            div.style.backgroundColor = slotColors[idx % slotColors.length];

            const parsed = parseName(name);
            const displayFull = parsed.firstPlusFirstLast || name;
            const displayName = displayFull.length > 20 ? displayFull.slice(0, 18) + '…' : displayFull;

            div.textContent = "• • •";
            div.dataset.displayLabel = displayName;
            div.dataset.fullName = name;

            track.appendChild(div);
        });

        slotPosition = 0;
        track.style.transform = `translateY(0px)`;
        const btn = document.getElementById('slotActionBtn');
        btn.innerHTML = '<i class="fa-solid fa-play"></i> SPIN!';
        btn.disabled = false;
        btn.dataset.action = 'spin';
        track.dataset.poolSize = shuffled.length;

        track.querySelectorAll('.tt-slot-item').forEach(el => el.classList.remove('blur'));
    }

    function closeSlotMachine() {
        document.getElementById('ttSlotOverlay').classList.remove('visible');
        if (slotSpinning) {
            cancelAnimationFrame(slotAnimFrame);
            slotSpinning = false;
        }
    }

    function handleSlotAction() {
        const btn = document.getElementById('slotActionBtn');
        if (btn.dataset.action === 'spin') {
            startSlotSpin(btn);
        } else if (btn.dataset.action === 'stop') {
            stopSlotMachine(btn);
        }
    }

    function startSlotSpin(btn) {
        if (slotSpinning) return;
        slotSpinning = true;

        btn.innerHTML = '<i class="fa-solid fa-stop"></i> STOP!';
        btn.dataset.action = 'stop';

        const wrapper = document.querySelector('.tt-slot-machine-wrapper');
        if (wrapper) wrapper.classList.add('fast-spin');

        const lever = document.getElementById('slotLeverArm');
        if (lever) {
            lever.classList.add('pulled');
            setTimeout(() => lever.classList.remove('pulled'), 300);
        }

        const track = document.getElementById('slotTrack');
        track.querySelectorAll('.tt-slot-item').forEach(el => {
            el.classList.add('blur');
            if (el.dataset.displayLabel) {
                el.textContent = el.dataset.displayLabel;
            }
        });

        const poolSize = parseInt(track.dataset.poolSize);
        const maxScroll = poolSize * ITEM_HEIGHT;
        slotSpeed = 40;

        let distanceAccumulator = 0;
        const TICK_DISTANCE = ITEM_HEIGHT * 3; // Space the sounds out every 3 blocks

        function animate() {
            if (!slotSpinning) return;

            // Move physically and register absolute distance traveled
            slotPosition -= slotSpeed;
            distanceAccumulator += slotSpeed;

            // Visual boundary wrapper
            if (slotPosition <= -maxScroll) {
                slotPosition = slotPosition % maxScroll;
            }

            track.style.transform = `translateY(${slotPosition}px)`;

            // Fire sound evenly regardless of wrapper
            if (distanceAccumulator >= TICK_DISTANCE) {
                playSlotTickSound();
                distanceAccumulator %= TICK_DISTANCE;
            }

            slotAnimFrame = requestAnimationFrame(animate);
        }

        slotAnimFrame = requestAnimationFrame(animate);
    }

    function stopSlotMachine(btn) {
        if (!slotSpinning) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> STOPPING...';

        const track = document.getElementById('slotTrack');
        const poolSize = parseInt(track.dataset.poolSize);
        const maxScroll = poolSize * ITEM_HEIGHT;

        const currIndex = Math.floor(Math.abs(slotPosition) / ITEM_HEIGHT);
        const targetIndex = (currIndex + 3 + Math.floor(Math.random() * poolSize / 2)) % poolSize;
        const targetPosition = -(targetIndex * ITEM_HEIGHT);

        let distanceToGo = targetPosition - slotPosition;
        if (distanceToGo >= 0) {
            distanceToGo -= maxScroll;
        }

        const startPos = slotPosition;
        const duration = 1200;
        const startTime = performance.now();

        cancelAnimationFrame(slotAnimFrame);

        // Ensure deceleration also follows the * 3 grouping distance
        let lastIndexRendered = Math.floor(Math.abs(startPos) / (ITEM_HEIGHT * 3));

        let audioCtx;
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
        function playSuccess() {
            if (!audioCtx) return;
            try {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.setValueAtTime(400, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.3);
            } catch (e) { }
        }

        function easeOutCubic(t) {
            return 1 - Math.pow(1 - t, 3);
        }

        function finishAnim(now) {
            const elapsed = Math.min(now - startTime, duration);
            const progress = elapsed / duration;
            const easeProgress = easeOutCubic(progress);

            slotPosition = startPos + distanceToGo * easeProgress;

            let displayPos = slotPosition;
            if (displayPos <= -maxScroll) {
                displayPos = displayPos % maxScroll;
            }
            track.style.transform = `translateY(${displayPos}px)`;

            const absoluteIndex = Math.floor(Math.abs(slotPosition) / (ITEM_HEIGHT * 3));
            if (absoluteIndex !== lastIndexRendered) {
                playSlotTickSound();
                lastIndexRendered = absoluteIndex;
            }

            if (progress < 1) {
                slotAnimFrame = requestAnimationFrame(finishAnim);
            } else {
                slotSpinning = false;
                track.style.transform = `translateY(${targetPosition}px)`;

                const wrapper = document.querySelector('.tt-slot-machine-wrapper');
                if (wrapper) wrapper.classList.remove('fast-spin');

                track.querySelectorAll('.tt-slot-item').forEach(el => el.classList.remove('blur'));

                playSuccess();

                const winnerName = track.children[targetIndex].dataset.fullName;

                setTimeout(() => {
                    closeSlotMachine();
                    showWinner(winnerName);
                }, 800);
            }
        }

        slotAnimFrame = requestAnimationFrame(finishAnim);
    }

    // ── Poker Cards ───────────────────────────────────────
    let cardsShuffling = false;

    function playCardShuffleSound() {
        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                try {
                    if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
                    const osc = globalAudioCtx.createOscillator();
                    const gain = globalAudioCtx.createGain();
                    osc.connect(gain);
                    gain.connect(globalAudioCtx.destination);
                    osc.frequency.setValueAtTime(800 - i * 50, globalAudioCtx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(100, globalAudioCtx.currentTime + 0.05);
                    gain.gain.setValueAtTime(0.05, globalAudioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, globalAudioCtx.currentTime + 0.05);
                    osc.start(globalAudioCtx.currentTime);
                    osc.stop(globalAudioCtx.currentTime + 0.05);
                } catch (e) { }
            }, i * 40);
        }
    }

    // ── Card Flip Sound (.ogg asset playback) ────────────────────
    function playCardFlipSound() {
        if (!cardFlipBuffer) return;
        try {
            if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
            const source = globalAudioCtx.createBufferSource();
            source.buffer = cardFlipBuffer;
            source.connect(globalAudioCtx.destination);
            source.start(0);
        } catch (e) { }
    }


    function openCards() {
        const pool = getAvailableStudents();
        if (pool.length === 0) {
            showNotification('All students have had turns! Reset categories to continue.', 'info');
            return;
        }

        const overlay = document.getElementById('ttCardsOverlay');
        overlay.classList.add('visible');

        const grid = document.getElementById('cardsGrid');
        grid.innerHTML = '';

        const baseIcons = [
            'fa-ghost', 'fa-crown', 'fa-gem', 'fa-hat-wizard', 'fa-dragon', 'fa-music',
            'fa-bolt', 'fa-star', 'fa-moon', 'fa-clover', 'fa-fire', 'fa-chess-rook',
            'fa-meteor', 'fa-leaf', 'fa-chess-knight', 'fa-house', 'fa-gamepad',
            'fa-cat', 'fa-dog', 'fa-fish', 'fa-frog', 'fa-burger', 'fa-spider', 'fa-mug-saucer',
            'fa-bug', 'fa-horse', 'fa-dove', 'fa-trophy', 'fa-computer', 'fa-pencil',
            'fa-apple-whole', 'fa-lemon', 'fa-carrot', 'fa-pepper-hot', 'fa-cake-candles',
            'fa-sun', 'fa-cloud', 'fa-snowflake', 'fa-tree', 'fa-ice-cream',
            'fa-mountain', 'fa-water', 'fa-wind', 'fa-rocket', 'fa-robot',
            'fa-user-astronaut', 'fa-paper-plane', 'fa-anchor', 'fa-bomb'
        ];

        let deckIcons = [...baseIcons].sort(() => Math.random() - 0.5);

        const shuffled = [...pool].sort(() => Math.random() - 0.5);

        shuffled.forEach((name, i) => {
            const parsed = parseName(name);
            const displayName = parsed.firstPlusFirstLast || name;

            const card = document.createElement('div');
            card.className = 'tt-card-item';
            card.dataset.fullName = name;

            const randomIcon = deckIcons[i % deckIcons.length];

            card.innerHTML = `
                <div class="tt-card-front">
                    <i class="fa-solid ${randomIcon}"></i>
                </div>
                <div class="tt-card-back">
                    ${displayName}
                </div>
            `;

            card.addEventListener('click', function () {
                if (cardsShuffling || this.classList.contains('flipped')) return;

                const allCards = grid.querySelectorAll('.tt-card-item');
                allCards.forEach(c => {
                    c.classList.add('flipped');
                    if (c !== this) c.classList.add('unselected');
                });

                document.getElementById('cardsShuffleBtn').disabled = true;
                grid.style.pointerEvents = 'none';

                playCardFlipSound();

                setTimeout(() => {
                    closeCards();
                    showWinner(this.dataset.fullName);
                }, 2000);
            });

            grid.appendChild(card);
        });

        document.getElementById('cardsShuffleBtn').disabled = false;
        grid.style.pointerEvents = 'auto';

        // Initial deal animation
        setTimeout(() => {
            shuffleCardsLogic(true);
        }, 50);
    }

    function closeCards() {
        const overlay = document.getElementById('ttCardsOverlay');
        const grid = document.getElementById('cardsGrid');
        overlay.classList.remove('visible');
        grid.style.pointerEvents = 'none';

        // Clear DOM after CSS fade-out completes
        setTimeout(() => {
            if (!overlay.classList.contains('visible')) {
                grid.innerHTML = '';
            }
        }, 350);
    }

    function shuffleCards() {
        if (cardsShuffling) return;
        shuffleCardsLogic(false);
    }

    function shuffleCardsLogic(isInitialDeal = false) {
        cardsShuffling = true;
        const grid = document.getElementById('cardsGrid');
        const cards = Array.from(grid.children);
        const btn = document.getElementById('cardsShuffleBtn');
        btn.disabled = true;

        const gridRect = grid.getBoundingClientRect();
        const centerX = gridRect.left + gridRect.width / 2;
        const centerY = gridRect.top + gridRect.height / 2;

        playCardShuffleSound();

        // Gather to center
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const tx = centerX - (rect.left + rect.width / 2);
            const ty = centerY - (rect.top + rect.height / 2);

            if (isInitialDeal) {
                card.style.transition = 'none';
                card.style.transform = `translate(${tx}px, ${ty}px) scale(0)`;
            } else {
                const rot = (Math.random() - 0.5) * 60;
                card.style.transition = 'transform 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)';
                card.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(0.9)`;
            }
        });

        setTimeout(() => {
            // Reorder DOM
            cards.sort(() => Math.random() - 0.5);

            // Clear transforms to reset them to pure CSS positions across flex grid
            cards.forEach(c => {
                c.style.transition = 'none';
                c.style.transform = 'none';
                grid.appendChild(c);
            });

            // Force reflow to calculate proper physical rect coordinates
            void grid.offsetHeight;

            // Compute correct offset vectors relative to center, given their new layout anchors
            cards.forEach(card => {
                const rect = card.getBoundingClientRect();
                const tx = centerX - (rect.left + rect.width / 2);
                const ty = centerY - (rect.top + rect.height / 2);
                card.style.transform = `translate(${tx}px, ${ty}px) scale(0.9)`;
            });

            // Second reflow commits the transform override prior to kicking off sliding animation
            void grid.offsetHeight;

            // Animate outwards from center stack to new natural positions
            cards.forEach((card, idx) => {
                card.style.transition = `transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${idx * 0.02}s`;
                card.style.transform = '';
            });

            setTimeout(() => {
                cardsShuffling = false;
                btn.disabled = false;
            }, 400 + cards.length * 20);
        }, isInitialDeal ? 50 : 450);
    }

    // ── Piñata ────────────────────────────────────────────
    let pinataActive = false;
    let pinataTapCount = 0;
    let pinataRequiredTaps = 0;
    let pinataWinner = null;
    let pinataColors = [];

    // Color palettes per piñata image (from SVG gradient stop-colors)
    const PINATA_PALETTES = [
        // piñata-1: llama — greens, purples, pinks, yellows, blues
        ['#62d202', '#6d4fff', '#ff519f', '#ffc40b', '#4a98ff', '#d10038', '#8b33f2', '#ff7c27'],
        // piñata-2: star — oranges, purples, blues, greens, pinks
        ['#ffaa00', '#b009ff', '#4a98ff', '#82d900', '#ff519f', '#d64a1a', '#72ffff', '#ffc40b'],
        // piñata-3: sun/star — pinks, yellows, oranges, greens, purples
        ['#ec2c85', '#ffd93d', '#ff6b6b', '#6bcb77', '#9b59b6', '#f39c12', '#3498db', '#e74c3c'],
        // piñata-4: donut — pinks, purples, yellows, oranges, blues
        ['#ff69b4', '#c45ab3', '#ffd93d', '#ff9f43', '#4d96ff', '#ff6b6b', '#a29bfe', '#1dd1a1'],
        // piñata-5: horse — yellows, oranges, greens, blues, pinks
        ['#fce938', '#f18701', '#27ae60', '#3498db', '#e74c3c', '#9b59b6', '#1abc9c', '#f39c12'],
    ];

    const PINATA_IMAGES = [
        'assets/images/student-turn-tracker/piñata-1.svg',
        'assets/images/student-turn-tracker/piñata-2.svg',
        'assets/images/student-turn-tracker/piñata-3.svg',
        'assets/images/student-turn-tracker/piñata-4.svg',
        'assets/images/student-turn-tracker/piñata-5.svg',
    ];

    const CANDY_IMAGES = [
        'assets/images/student-turn-tracker/candy-1.svg',
        'assets/images/student-turn-tracker/candy-2.svg',
        'assets/images/student-turn-tracker/candy-3.svg',
        'assets/images/student-turn-tracker/candy-4.svg',
        'assets/images/student-turn-tracker/candy-5.svg',
        'assets/images/student-turn-tracker/candy-6.svg',
        'assets/images/student-turn-tracker/candy-7.svg',
    ];

    function playPinataHitSound() {
        // Randomly pick one of the two real hit sound files
        const buf = Math.random() < 0.5 ? pinataHit1Buffer : pinataHit2Buffer;
        playAudioBuffer(buf);
    }

    function openPinata() {
        const pool = getAvailableStudents();
        if (pool.length === 0) {
            showNotification('All students have had turns! Reset categories to continue.', 'info');
            return;
        }

        // Pick random winner upfront
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        pinataWinner = shuffled[0];

        // Pick random piñata image and colours
        const piIdx = Math.floor(Math.random() * PINATA_IMAGES.length);
        pinataColors = PINATA_PALETTES[piIdx];

        // Setup
        pinataTapCount = 0;
        pinataRequiredTaps = 5 + Math.floor(Math.random() * 6); // 5-10 taps
        pinataActive = true;

        const overlay = document.getElementById('ttPinataOverlay');
        const body = document.getElementById('pinataBody');

        // Clean up previous run
        overlay.querySelectorAll('.tt-pinata-piece, .tt-pinata-name-reveal').forEach(el => el.remove());
        body.classList.remove('pinata-hit', 'pinata-exploding');
        body.style.animation = '';

        // Inject image
        body.innerHTML = `<img src="${PINATA_IMAGES[piIdx]}" alt="Piñata" draggable="false">`;

        // Reset idle swing
        requestAnimationFrame(() => {
            body.style.animation = 'pinataIdleSwing 3s ease-in-out infinite alternate';
        });

        // Show hint
        const hint = overlay.querySelector('.tt-pinata-hint');
        if (hint) hint.style.display = '';

        overlay.classList.add('visible');
    }

    function closePinata() {
        document.getElementById('ttPinataOverlay').classList.remove('visible');
        pinataActive = false;
    }

    function spawnPinataPieces(bodyEl) {
        const overlay = document.getElementById('ttPinataOverlay');
        const scene = overlay.querySelector('.tt-pinata-scene');
        const rect = bodyEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const count = 3 + Math.floor(Math.random() * 4); // 3-6 pieces
        for (let i = 0; i < count; i++) {
            const piece = document.createElement('div');
            piece.className = 'tt-pinata-piece';

            const size = 6 + Math.random() * 10;
            const color = pinataColors[Math.floor(Math.random() * pinataColors.length)];
            const driftX = (Math.random() - 0.5) * 200;
            const fallY = 200 + Math.random() * 250;
            const spin = 180 + Math.random() * 720;
            const duration = 0.8 + Math.random() * 0.6;
            const isCircle = Math.random() > 0.5;

            piece.style.width = size + 'px';
            piece.style.height = size * (isCircle ? 1 : 0.6) + 'px';
            piece.style.backgroundColor = color;
            piece.style.left = (cx - size / 2 + (Math.random() - 0.5) * 40) + 'px';
            piece.style.top = (cy - size / 2 + (Math.random() - 0.5) * 30) + 'px';
            piece.style.borderRadius = isCircle ? '50%' : '3px';
            piece.style.setProperty('--drift-x', driftX + 'px');
            piece.style.setProperty('--fall-y', fallY + 'px');
            piece.style.setProperty('--spin', spin + 'deg');
            piece.style.setProperty('--fall-duration', duration + 's');
            piece.style.boxShadow = `0 2px 4px rgba(0,0,0,0.2)`;

            overlay.insertBefore(piece, scene); // Insert before scene for background layering

            // Remove after animation
            setTimeout(() => piece.remove(), duration * 1000 + 100);
        }
    }

    function spawnPinataCandies(bodyEl, amount = 20) {
        const overlay = document.getElementById('ttPinataOverlay');
        const scene = overlay.querySelector('.tt-pinata-scene');
        const rect = bodyEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        // Target floor: roughly 82% from the TOP of the viewport
        const floorY = window.innerHeight * 0.82;

        for (let i = 0; i < amount; i++) {
            const candy = document.createElement('img');
            candy.src = CANDY_IMAGES[Math.floor(Math.random() * CANDY_IMAGES.length)];
            candy.className = 'tt-pinata-piece tt-pinata-candy';

            const size = 30 + Math.random() * 25;
            const driftX = (Math.random() - 0.5) * 600; // Wider spread

            // Calculate distance to land on floor
            const spawnY = cy - size / 2 + (Math.random() - 0.5) * 40;
            const distanceToFloor = floorY - spawnY;
            const fallY = distanceToFloor + (Math.random() - 0.5) * 30; // some variation on floor height

            const spin = 360 + Math.random() * 1080;
            const duration = 0.8 + Math.random() * 0.8;

            candy.style.width = size + 'px';
            candy.style.height = 'auto';
            candy.style.left = (cx - size / 2 + (Math.random() - 0.5) * 60) + 'px';
            candy.style.top = spawnY + 'px';
            candy.style.setProperty('--drift-x', driftX + 'px');
            candy.style.setProperty('--fall-y', fallY + 'px');
            candy.style.setProperty('--spin', spin + 'deg');
            candy.style.setProperty('--fall-duration', duration + 's');
            candy.style.filter = `drop-shadow(0 4px 8px rgba(0,0,0,0.25))`;

            overlay.insertBefore(candy, scene);
            // No removal: stay on floor until overlay closes/resets
        }
    }

    function handlePinataTap() {
        if (!pinataActive) return;
        const body = document.getElementById('pinataBody');

        pinataTapCount++;

        // Hit animation: remove then re-add class
        body.classList.remove('pinata-hit');
        body.style.animation = 'none';
        void body.offsetWidth; // force reflow
        body.classList.add('pinata-hit');
        body.style.animation = '';

        // Play hit sound
        playPinataHitSound();

        // Spawn pieces
        spawnPinataPieces(body);

        // Remove hit class after animation
        setTimeout(() => {
            body.classList.remove('pinata-hit');
            if (pinataActive && pinataTapCount < pinataRequiredTaps) {
                body.style.animation = 'pinataIdleSwing 3s ease-in-out infinite alternate';
            }
        }, 400);

        // Check if enough taps
        if (pinataTapCount >= pinataRequiredTaps) {
            pinataActive = false;
            triggerPinataExplosion();
        }
    }

    function triggerPinataExplosion() {
        const body = document.getElementById('pinataBody');
        const overlay = document.getElementById('ttPinataOverlay');
        const hint = overlay.querySelector('.tt-pinata-hint');
        if (hint) hint.style.display = 'none';

        // Big burst of pieces and CANDY!
        for (let wave = 0; wave < 3; wave++) {
            setTimeout(() => {
                spawnPinataPieces(body);
                if (wave === 1) spawnPinataCandies(body, 18);
            }, wave * 100);
        }

        // Explosion animation + sound
        body.classList.remove('pinata-hit');
        body.style.animation = 'none';
        void body.offsetWidth;
        body.classList.add('pinata-exploding');
        playAudioBuffer(pinataExplosionBuffer);

        // Confetti
        setTimeout(() => {
            if (typeof confetti === 'function') {
                // Center burst
                confetti({
                    particleCount: 120,
                    spread: 100,
                    origin: { x: 0.5, y: 0.45 },
                    colors: pinataColors.slice(0, 6),
                    zIndex: 9999,
                });
                // Side cannons
                confetti({
                    particleCount: 60,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0, y: 0.5 },
                    colors: pinataColors.slice(0, 6),
                    zIndex: 9999,
                });
                confetti({
                    particleCount: 60,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1, y: 0.5 },
                    colors: pinataColors.slice(0, 6),
                    zIndex: 9999,
                });
            }
        }, 400);

        // Show name
        setTimeout(() => {
            const parsed = parseName(pinataWinner);
            const displayName = nameMode === 'first' ? parsed.firstNamesStr : parsed.rearrangedFull;
            const nameEl = document.createElement('div');
            nameEl.className = 'tt-pinata-name-reveal';
            nameEl.textContent = displayName;
            overlay.appendChild(nameEl);
        }, 600);

        // Close and show winner
        setTimeout(() => {
            closePinata();
            showWinner(pinataWinner);
        }, 2200);
    }

    // ── Plinko ──────────────────────────────────────────────
    const PLINKO_H = 620;
    const PLINKO_MIN_W = 560;
    const PLINKO_MAX_W = 1080;
    const PLINKO_WALL = 18;
    const PLINKO_TUBE_H = 64;
    const PLINKO_SLOT_H = 118;
    const PLINKO_PEG_ROWS = 10;
    const PLINKO_PEG_R = 6;
    const PLINKO_BOOST_PEG_R = 7;
    const PLINKO_BALL_R = 11;
    const PLINKO_TUBE_W = 40;
    const PLINKO_MIN_SLOT_W = PLINKO_BALL_R * 2 + 14;
    const PLINKO_BOOST_PEG_COUNT_MIN = 4;
    const PLINKO_BOOST_PEG_COUNT_MAX = 8;
    const PLINKO_PEG_SOUND_COOLDOWN_MS = 55;

    let plinkoBoardW = PLINKO_MIN_W;
    let plinkoEngine = null;
    let plinkoWorld = null;
    let plinkoBall = null;
    let plinkoAnimId = null;
    let plinkoStudents = [];
    let plinkoSlotMeta = [];
    let plinkoTubeX = PLINKO_MIN_W / 2;
    let plinkoDragging = false;
    let plinkoActive = false;
    let plinkoSettled = false;
    let plinkoWinIdx = -1;
    let plinkoSettleFrames = 0;
    let plinkoPulsePhase = 0;
    let plinkoCanvas = null;
    let plinkoCtx = null;
    let plinkoDpr = 1;
    let plinkoLastPegSoundAt = 0;
    let plinkoCollisionBound = false;
    let plinkoSettleToken = 0;

    function plinkoComputeBoardWidth(studentCount) {
        return Math.max(
            PLINKO_MIN_W,
            Math.min(PLINKO_MAX_W, PLINKO_WALL * 2 + studentCount * PLINKO_MIN_SLOT_W + 32)
        );
    }

    function plinkoPegMargin() {
        return PLINKO_BALL_R + PLINKO_PEG_R + 14;
    }

    function plinkoDisplayLabel(name) {
        const parsed = parseName(name);
        const displayFull = parsed.firstPlusFirstLast || name;
        const maxChars = Math.max(6, Math.floor((PLINKO_SLOT_H - 16) / 8));
        return displayFull.length > maxChars
            ? displayFull.slice(0, Math.max(4, maxChars - 1)) + '…'
            : displayFull;
    }

    function playPlinkoPegTick() {
        const now = performance.now();
        if (now - plinkoLastPegSoundAt < PLINKO_PEG_SOUND_COOLDOWN_MS) return;
        plinkoLastPegSoundAt = now;
        try {
            if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
            const t = globalAudioCtx.currentTime;
            const osc = globalAudioCtx.createOscillator();
            const gain = globalAudioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(920 + Math.random() * 220, t);
            osc.frequency.exponentialRampToValueAtTime(420, t + 0.045);
            gain.gain.setValueAtTime(0.028, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            osc.connect(gain);
            gain.connect(globalAudioCtx.destination);
            osc.start(t);
            osc.stop(t + 0.055);
        } catch (e) { }
    }

    function playPlinkoLandSound() {
        try {
            if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
            const t = globalAudioCtx.currentTime;
            const osc = globalAudioCtx.createOscillator();
            const gain = globalAudioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(330, t);
            osc.frequency.exponentialRampToValueAtTime(660, t + 0.12);
            osc.frequency.exponentialRampToValueAtTime(440, t + 0.28);
            gain.gain.setValueAtTime(0.001, t);
            gain.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            osc.connect(gain);
            gain.connect(globalAudioCtx.destination);
            osc.start(t);
            osc.stop(t + 0.38);
        } catch (e) { }
    }

    function plinkoOnCollisionStart(event) {
        if (!plinkoBall || plinkoSettled) return;
        for (const pair of event.pairs) {
            const labels = [pair.bodyA.label, pair.bodyB.label];
            if (!labels.includes('ball')) continue;
            if (labels.includes('peg') || labels.includes('boost-peg')) {
                playPlinkoPegTick();
                break;
            }
        }
    }

    function plinkoPegX(row, col, pegLeft, pegSpan, pegCols) {
        const step = pegCols > 1 ? pegSpan / (pegCols - 1) : 0;
        const stagger = (row % 2) * (step / 2);
        return pegLeft + col * step + stagger;
    }

    function plinkoSpawnBoostPegs(pegLeft, pegSpan, pegCols, pegTop, rowGap, pegOptsBase) {
        const { Bodies, Composite } = Matter;
        const boostCount = PLINKO_BOOST_PEG_COUNT_MIN
            + Math.floor(Math.random() * (PLINKO_BOOST_PEG_COUNT_MAX - PLINKO_BOOST_PEG_COUNT_MIN + 1));
        const minSep = (PLINKO_PEG_R + PLINKO_BOOST_PEG_R) * 2.2;
        const placed = [];

        const tryPlace = (x, y) => {
            const bodies = Matter.Composite.allBodies(plinkoWorld);
            for (const p of placed) {
                if (Math.hypot(p.x - x, p.y - y) < minSep) return false;
            }
            for (const body of bodies) {
                if (body.label !== 'peg' && body.label !== 'boost-peg') continue;
                if (Math.hypot(body.position.x - x, body.position.y - y) < minSep) return false;
            }
            placed.push({ x, y });
            Composite.add(plinkoWorld, Bodies.circle(x, y, PLINKO_BOOST_PEG_R, {
                ...pegOptsBase,
                restitution: 0.92,
                label: 'boost-peg',
            }));
            return true;
        };

        for (let attempt = 0; attempt < 120 && placed.length < boostCount; attempt++) {
            const row = Math.floor(Math.random() * PLINKO_PEG_ROWS);
            const col = Math.floor(Math.random() * pegCols);
            const y = pegTop + row * rowGap;
            const x = plinkoPegX(row, col, pegLeft, pegSpan, pegCols);
            tryPlace(x, y);
        }
    }

    function openPlinko() {
        if (typeof Matter === 'undefined') {
            showNotification('Plinko physics failed to load. Check your connection.', 'error');
            return;
        }

        const pool = getAvailableStudents();
        if (pool.length === 0) {
            showNotification('All students have had turns! Reset categories to continue.', 'info');
            return;
        }

        plinkoSettleToken += 1;
        plinkoStudents = [...pool];
        plinkoBoardW = plinkoComputeBoardWidth(plinkoStudents.length);
        plinkoTubeX = plinkoBoardW / 2;
        plinkoSettled = false;
        plinkoWinIdx = -1;
        plinkoSettleFrames = 0;
        plinkoBall = null;
        plinkoActive = true;

        document.getElementById('ttPlinkoOverlay').classList.add('visible');
        const wrap = document.getElementById('plinkoBoardWrap');
        if (wrap) wrap.style.aspectRatio = `${plinkoBoardW} / ${PLINKO_H}`;
        plinkoSetupCanvas();
        plinkoBuildWorld();
        plinkoUpdateButtons();
        plinkoStartLoop();
    }

    function closePlinko() {
        plinkoSettleToken += 1;
        plinkoActive = false;
        plinkoSettled = false;
        plinkoWinIdx = -1;
        plinkoStopLoop();
        plinkoDestroyWorld();
        document.getElementById('ttPlinkoOverlay').classList.remove('visible');
        plinkoDragging = false;
        if (plinkoCanvas) plinkoCanvas.classList.remove('plinko-dragging');
    }

    function plinkoSetupCanvas() {
        plinkoCanvas = document.getElementById('plinkoCanvas');
        plinkoCtx = plinkoCanvas.getContext('2d');
        plinkoDpr = Math.min(window.devicePixelRatio || 1, 2);
        plinkoCanvas.width = plinkoBoardW * plinkoDpr;
        plinkoCanvas.height = PLINKO_H * plinkoDpr;
    }

    function plinkoInnerLeft() {
        return PLINKO_WALL;
    }

    function plinkoInnerRight() {
        return plinkoBoardW - PLINKO_WALL;
    }

    function plinkoInnerWidth() {
        return plinkoInnerRight() - plinkoInnerLeft();
    }

    function plinkoSlotTopY() {
        return PLINKO_H - PLINKO_SLOT_H;
    }

    function plinkoPegAreaTop() {
        return PLINKO_TUBE_H + 8;
    }

    function plinkoPegAreaBottom() {
        return plinkoSlotTopY() - 10;
    }

    function plinkoTubeMinX() {
        return plinkoInnerLeft() + PLINKO_TUBE_W / 2 + 4;
    }

    function plinkoTubeMaxX() {
        return plinkoInnerRight() - PLINKO_TUBE_W / 2 - 4;
    }

    function plinkoClampTubeX(x) {
        return Math.max(plinkoTubeMinX(), Math.min(plinkoTubeMaxX(), x));
    }

    function plinkoBuildWorld() {
        plinkoDestroyWorld();

        const { Engine, World, Bodies, Composite, Events } = Matter;
        plinkoEngine = Engine.create({ gravity: { x: 0, y: 1.15 } });
        plinkoWorld = plinkoEngine.world;
        Events.on(plinkoEngine, 'collisionStart', plinkoOnCollisionStart);
        plinkoCollisionBound = true;

        const wallOpts = { isStatic: true, friction: 0.2, restitution: 0.35, label: 'wall' };
        const innerW = plinkoInnerWidth();
        const innerL = plinkoInnerLeft();
        const slotTop = plinkoSlotTopY();

        // Floor
        Composite.add(plinkoWorld, Bodies.rectangle(
            plinkoBoardW / 2, PLINKO_H - PLINKO_WALL / 2,
            innerW + 4, PLINKO_WALL, wallOpts
        ));

        // Side walls
        Composite.add(plinkoWorld, Bodies.rectangle(
            PLINKO_WALL / 2, PLINKO_H / 2,
            PLINKO_WALL, PLINKO_H, wallOpts
        ));
        Composite.add(plinkoWorld, Bodies.rectangle(
            plinkoBoardW - PLINKO_WALL / 2, PLINKO_H / 2,
            PLINKO_WALL, PLINKO_H, wallOpts
        ));

        // Slot dividers (only in slot zone — keeps peg channels open)
        const n = plinkoStudents.length;
        const slotW = innerW / n;
        const divH = PLINKO_SLOT_H - 6;
        const divOpts = { isStatic: true, friction: 0.1, restitution: 0.2, label: 'divider' };

        plinkoSlotMeta = plinkoStudents.map((name, i) => ({
            name,
            label: plinkoDisplayLabel(name),
            x: innerL + i * slotW,
            width: slotW,
            centerX: innerL + i * slotW + slotW / 2,
        }));

        for (let i = 1; i < n; i++) {
            const x = innerL + i * slotW;
            Composite.add(plinkoWorld, Bodies.rectangle(
                x, slotTop + divH / 2 + 4,
                2, divH, divOpts
            ));
        }

        // Peg grid (staggered), inset from walls so ball can pass
        const pegTop = plinkoPegAreaTop();
        const pegBottom = plinkoPegAreaBottom();
        const rowGap = (pegBottom - pegTop) / (PLINKO_PEG_ROWS - 1);
        const pegMargin = plinkoPegMargin();
        const pegLeft = innerL + pegMargin;
        const pegRight = plinkoInnerRight() - pegMargin;
        const pegSpan = pegRight - pegLeft;
        const pegCols = Math.max(7, Math.min(12, Math.floor(pegSpan / 42)));
        const pegOpts = { isStatic: true, friction: 0.05, restitution: 0.55, label: 'peg' };

        for (let row = 0; row < PLINKO_PEG_ROWS; row++) {
            const y = pegTop + row * rowGap;
            for (let col = 0; col < pegCols; col++) {
                const x = plinkoPegX(row, col, pegLeft, pegSpan, pegCols);
                Composite.add(plinkoWorld, Bodies.circle(x, y, PLINKO_PEG_R, pegOpts));
            }
        }

        plinkoSpawnBoostPegs(pegLeft, pegSpan, pegCols, pegTop, rowGap, pegOpts);
    }

    function plinkoDestroyWorld() {
        if (plinkoEngine) {
            if (plinkoCollisionBound) {
                Matter.Events.off(plinkoEngine, 'collisionStart', plinkoOnCollisionStart);
                plinkoCollisionBound = false;
            }
            Matter.World.clear(plinkoWorld);
            Matter.Engine.clear(plinkoEngine);
            plinkoEngine = null;
            plinkoWorld = null;
        }
        plinkoBall = null;
        plinkoLastPegSoundAt = 0;
    }

    function plinkoIsFalling() {
        return plinkoBall && !plinkoSettled;
    }

    function plinkoUpdateButtons() {
        const dropBtn = document.getElementById('plinkoDropBtn');
        const resetBtn = document.getElementById('plinkoResetBtn');
        const busy = plinkoIsFalling();
        if (dropBtn) {
            dropBtn.disabled = busy || plinkoSettled;
        }
        if (resetBtn) {
            resetBtn.disabled = busy;
        }
    }

    function plinkoDropBall() {
        if (!plinkoActive || plinkoBall || plinkoSettled) return;

        const { Bodies, Composite } = Matter;
        const spawnY = PLINKO_TUBE_H * 0.55;
        const nudge = (Math.random() - 0.5) * 3.5;

        plinkoBall = Bodies.circle(plinkoTubeX, spawnY, PLINKO_BALL_R, {
            restitution: 0.5,
            friction: 0.08,
            frictionAir: 0.012,
            density: 0.004,
            label: 'ball',
        });

        Matter.Body.setVelocity(plinkoBall, { x: nudge, y: 0 });
        Composite.add(plinkoWorld, plinkoBall);
        plinkoSettleFrames = 0;
        plinkoUpdateButtons();
    }

    function plinkoReset() {
        if (plinkoIsFalling()) return;

        if (plinkoBall && plinkoWorld) {
            Matter.Composite.remove(plinkoWorld, plinkoBall);
        }
        plinkoBall = null;
        plinkoSettled = false;
        plinkoWinIdx = -1;
        plinkoSettleFrames = 0;
        plinkoUpdateButtons();
    }

    function plinkoSlotIndexFromX(x) {
        const innerL = plinkoInnerLeft();
        const slotW = plinkoInnerWidth() / plinkoStudents.length;
        let idx = Math.floor((x - innerL) / slotW);
        idx = Math.max(0, Math.min(plinkoStudents.length - 1, idx));
        return idx;
    }

    function plinkoCheckSettlement() {
        if (!plinkoBall || plinkoSettled) return;

        const speed = Matter.Vector.magnitude(plinkoBall.velocity);
        const ang = Math.abs(plinkoBall.angularVelocity);
        const inSlotZone = plinkoBall.position.y >= plinkoSlotTopY() - PLINKO_BALL_R;

        if (speed < 0.25 && ang < 0.12 && inSlotZone) {
            plinkoSettleFrames++;
        } else {
            plinkoSettleFrames = 0;
        }

        if (plinkoSettleFrames >= 45) {
            plinkoSettled = true;
            plinkoWinIdx = plinkoSlotIndexFromX(plinkoBall.position.x);
            plinkoUpdateButtons();
            playPlinkoLandSound();

            const settleToken = plinkoSettleToken;
            const winnerName = plinkoStudents[plinkoWinIdx];
            setTimeout(() => {
                if (settleToken !== plinkoSettleToken || !winnerName) return;
                closePlinko();
                showWinner(winnerName);
            }, 1400);
        }
    }

    function plinkoDrawChevronWall(ctx, side) {
        const zigW = 6;
        const zigH = 14;
        const x = side === 'left' ? plinkoInnerLeft() + 2 : plinkoInnerRight() - 2;
        const dir = side === 'left' ? 1 : -1;
        const steps = Math.ceil(PLINKO_H / zigH);

        ctx.strokeStyle = '#ff2d9b';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff2d9b';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const y = i * zigH;
            const px = x + (i % 2 === 0 ? 0 : dir * zigW);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(px, y);
            ctx.lineTo(x, y + zigH);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function plinkoRoundRectPath(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function plinkoDrawBallAt(ctx, x, y) {
        ctx.beginPath();
        ctx.arc(x, y, PLINKO_BALL_R, 0, Math.PI * 2);
        const ballGrad = ctx.createRadialGradient(
            x - 3, y - 3, 1,
            x, y, PLINKO_BALL_R
        );
        ballGrad.addColorStop(0, '#ff8ed4');
        ballGrad.addColorStop(1, '#ff2d9b');
        ctx.fillStyle = ballGrad;
        ctx.shadowColor = '#ff2d9b';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function plinkoDrawTube(ctx) {
        const tw = PLINKO_TUBE_W;
        const th = PLINKO_TUBE_H - 6;
        const x = plinkoTubeX;
        const top = 6;
        const left = x - tw / 2;
        const previewY = PLINKO_TUBE_H * 0.55;

        ctx.save();
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 14;

        const grad = ctx.createLinearGradient(left, top, left + tw, top + th);
        grad.addColorStop(0, 'rgba(0, 229, 255, 0.35)');
        grad.addColorStop(0.5, 'rgba(255, 45, 155, 0.25)');
        grad.addColorStop(1, 'rgba(0, 229, 255, 0.15)');

        ctx.fillStyle = grad;
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.85)';
        ctx.lineWidth = 2;
        plinkoRoundRectPath(ctx, left, top, tw, th, 6);
        ctx.fill();
        ctx.stroke();

        // Drop indicator
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#ff6ec7';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, top + th);
        ctx.lineTo(x, top + th + 22);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrow head
        ctx.fillStyle = '#ff6ec7';
        ctx.beginPath();
        ctx.moveTo(x, top + th + 26);
        ctx.lineTo(x - 6, top + th + 18);
        ctx.lineTo(x + 6, top + th + 18);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // Preview ball drawn after tube chrome so it stays visible while dragging
        if (!plinkoBall) {
            plinkoDrawBallAt(ctx, x, previewY);
        }
    }

    function plinkoRender() {
        if (!plinkoCtx || !plinkoActive) return;

        const ctx = plinkoCtx;
        ctx.setTransform(plinkoDpr, 0, 0, plinkoDpr, 0, 0);
        ctx.clearRect(0, 0, plinkoBoardW, PLINKO_H);

        // Background
        const bg = ctx.createLinearGradient(0, 0, 0, PLINKO_H);
        bg.addColorStop(0, '#0a0e2e');
        bg.addColorStop(0.5, '#12153a');
        bg.addColorStop(1, '#0d0828');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, plinkoBoardW, PLINKO_H);

        plinkoDrawChevronWall(ctx, 'left');
        plinkoDrawChevronWall(ctx, 'right');

        // Slot labels & highlights
        const slotTop = plinkoSlotTopY();
        plinkoPulsePhase += 0.08;

        plinkoSlotMeta.forEach((slot, i) => {
            const isWin = plinkoSettled && i === plinkoWinIdx;
            if (isWin) {
                const pulse = 0.35 + Math.sin(plinkoPulsePhase) * 0.15;
                ctx.fillStyle = `rgba(255, 45, 155, ${pulse})`;
                ctx.shadowColor = '#ff2d9b';
                ctx.shadowBlur = 20;
                ctx.fillRect(slot.x + 2, slotTop + 2, slot.width - 4, PLINKO_SLOT_H - 4);
                ctx.shadowBlur = 0;
            }

            const fontSize = Math.max(11, Math.min(15, Math.floor(slot.width / 2.6)));
            ctx.fillStyle = isWin ? '#fff' : 'rgba(210, 245, 255, 0.98)';
            ctx.font = isWin
                ? `bold ${fontSize + 1}px 'Reddit Sans', sans-serif`
                : `700 ${fontSize}px 'Reddit Sans', sans-serif`;

            const drawVerticalLabel = () => {
                ctx.save();
                ctx.translate(slot.centerX, slotTop + PLINKO_SLOT_H / 2);
                if (isWin) {
                    const scale = 1 + Math.sin(plinkoPulsePhase) * 0.08;
                    ctx.scale(scale, scale);
                    ctx.shadowColor = '#00e5ff';
                    ctx.shadowBlur = 12;
                } else {
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
                    ctx.shadowBlur = 4;
                }
                ctx.rotate(-Math.PI / 2);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(slot.label, 0, 0);
                ctx.restore();
            };

            drawVerticalLabel();
        });

        // Slot divider lines (visual)
        ctx.strokeStyle = 'rgba(255, 45, 155, 0.35)';
        ctx.lineWidth = 1;
        for (let i = 1; i < plinkoSlotMeta.length; i++) {
            const x = plinkoSlotMeta[i].x;
            ctx.beginPath();
            ctx.moveTo(x, slotTop);
            ctx.lineTo(x, PLINKO_H - PLINKO_WALL);
            ctx.stroke();
        }

        plinkoDrawTube(ctx);

        // Pegs
        if (plinkoWorld) {
            const bodies = Matter.Composite.allBodies(plinkoWorld);
            bodies.forEach(body => {
                if (body.label !== 'peg' && body.label !== 'boost-peg') return;
                const isBoost = body.label === 'boost-peg';
                const r = isBoost ? PLINKO_BOOST_PEG_R : PLINKO_PEG_R;
                ctx.beginPath();
                ctx.arc(body.position.x, body.position.y, r, 0, Math.PI * 2);
                if (isBoost) {
                    ctx.fillStyle = '#ffd93d';
                    ctx.shadowColor = '#ffaa00';
                    ctx.shadowBlur = 16;
                } else {
                    ctx.fillStyle = '#00d4ff';
                    ctx.shadowColor = '#00e5ff';
                    ctx.shadowBlur = 10;
                }
                ctx.fill();
                ctx.shadowBlur = 0;
            });

            if (plinkoBall) {
                plinkoDrawBallAt(ctx, plinkoBall.position.x, plinkoBall.position.y);
            }
        }
    }

    function plinkoLoop() {
        if (!plinkoActive) return;

        if (plinkoEngine) {
            Matter.Engine.update(plinkoEngine, 1000 / 60);
            plinkoCheckSettlement();
        }

        plinkoRender();
        plinkoAnimId = requestAnimationFrame(plinkoLoop);
    }

    function plinkoStartLoop() {
        plinkoStopLoop();
        plinkoAnimId = requestAnimationFrame(plinkoLoop);
    }

    function plinkoStopLoop() {
        if (plinkoAnimId) {
            cancelAnimationFrame(plinkoAnimId);
            plinkoAnimId = null;
        }
    }

    function plinkoPointerPos(e) {
        const rect = plinkoCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const scaleX = plinkoBoardW / rect.width;
        return (clientX - rect.left) * scaleX;
    }

    function plinkoOnPointerDown(e) {
        if (!plinkoActive || plinkoBall) return;
        const x = plinkoPointerPos(e);
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - plinkoCanvas.getBoundingClientRect().top;
        const scaleY = PLINKO_H / plinkoCanvas.getBoundingClientRect().height;
        const logicalY = y * scaleY;

        if (logicalY <= PLINKO_TUBE_H + 12 && Math.abs(x - plinkoTubeX) < PLINKO_TUBE_W) {
            plinkoDragging = true;
            plinkoCanvas.classList.add('plinko-dragging');
            e.preventDefault();
        }
    }

    function plinkoOnPointerMove(e) {
        if (!plinkoDragging) return;
        plinkoTubeX = plinkoClampTubeX(plinkoPointerPos(e));
        e.preventDefault();
    }

    function plinkoOnPointerUp() {
        plinkoDragging = false;
        if (plinkoCanvas) plinkoCanvas.classList.remove('plinko-dragging');
    }

    // ── Flying Fruit ──────────────────────────────────────
    const FRUIT_HINT_KEY = 'esl_fruit_hint_seen';
    const FRUIT_TYPES = ['mango', 'watermelon', 'orange', 'strawberry', 'pineapple'];
    // slow = former Normal, normal = former Fast, fast = new top tier
    const FRUIT_SPEED_MULT = { slow: 1, normal: 1.55, fast: 2.35 };
    const FRUIT_BASE_DURATION = { min: 2200, max: 4200 };

    let fruitActive = false;
    let fruitPicking = false;
    let fruitPool = [];
    let fruitNameIndex = 0;
    let fruitRespawnQueue = [];
    let fruitActiveMap = new Map();
    let fruitNextId = 0;
    let fruitSpeedMode = 'normal';
    let fruitSpawnTimer = null;
    let fruitAutoTimer = null;
    let fruitRafId = null;

    const FRUIT_SVG = {
        mango: '<ellipse cx="50" cy="52" rx="38" ry="32" fill="#f5a623"/><ellipse cx="42" cy="48" rx="8" ry="12" fill="#e86a17" opacity="0.5"/><path d="M50 18 Q58 8 68 14 Q55 22 50 28Z" fill="#4a8f29"/>',
        watermelon: '<path d="M10 55 Q50 15 90 55 Q50 95 10 55Z" fill="#2d8a3e"/><path d="M18 55 Q50 28 82 55" fill="#e74c3c"/><circle cx="35" cy="50" r="2" fill="#1a1a1a"/><circle cx="50" cy="58" r="2" fill="#1a1a1a"/><circle cx="65" cy="48" r="2" fill="#1a1a1a"/>',
        orange: '<circle cx="50" cy="52" r="36" fill="#ff8c00"/><circle cx="50" cy="52" r="30" fill="#ffa726"/><circle cx="42" cy="44" r="6" fill="rgba(255,255,255,0.25)"/>',
        strawberry: '<path d="M50 88 Q20 55 35 35 Q50 48 65 35 Q80 55 50 88Z" fill="#e74c3c"/><circle cx="40" cy="58" r="2.5" fill="#ffd700"/><circle cx="52" cy="62" r="2.5" fill="#ffd700"/><circle cx="62" cy="52" r="2.5" fill="#ffd700"/><path d="M35 32 Q50 18 65 32 L58 38 Q50 30 42 38Z" fill="#27ae60"/>',
        pineapple: '<ellipse cx="50" cy="58" rx="32" ry="36" fill="#f1c40f"/><path d="M22 58 L78 58" stroke="#d4a017" stroke-width="2" opacity="0.5"/><path d="M50 20 L42 38 L50 32 L58 38Z" fill="#27ae60"/><path d="M38 24 L50 18 L62 24 L50 30Z" fill="#2ecc71"/>',
    };

    const FRUIT_CHUNK_COLORS = {
        mango: ['#f5a623', '#e86a17', '#ffd56a'],
        watermelon: ['#e74c3c', '#2d8a3e', '#ff6b6b'],
        orange: ['#ff8c00', '#ffa726', '#ffb74d'],
        strawberry: ['#e74c3c', '#c0392b', '#ff6b81'],
        pineapple: ['#f1c40f', '#d4a017', '#ffe066'],
    };

    function fruitDisplayName(name) {
        const parsed = parseName(name);
        const display = parsed.firstPlusFirstLast || name;
        return display.length > 18 ? display.slice(0, 16) + '…' : display;
    }

    function fruitSpeedMultiplier() {
        return FRUIT_SPEED_MULT[fruitSpeedMode] || 1;
    }

    function fruitNextStudentName() {
        if (!fruitPool.length) return null;
        if (fruitRespawnQueue.length) return fruitRespawnQueue.shift();
        const name = fruitPool[fruitNameIndex % fruitPool.length];
        fruitNameIndex++;
        return name;
    }

    function fruitGetStageSize() {
        const stage = document.getElementById('fruitStage');
        if (!stage) return { w: window.innerWidth, h: window.innerHeight };
        const r = stage.getBoundingClientRect();
        return { w: r.width || window.innerWidth, h: r.height || window.innerHeight };
    }

    function fruitCreateElement(studentName, typeKey) {
        const type = typeKey || FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
        const el = document.createElement('div');
        el.className = 'tt-flying-fruit tt-flying-fruit-spin';
        el.innerHTML = `
            <div class="tt-flying-fruit-body">
                <svg viewBox="0 0 100 100" aria-hidden="true">${FRUIT_SVG[type]}</svg>
            </div>
            <span class="tt-flying-fruit-name">${fruitDisplayName(studentName)}</span>
        `;
        el.dataset.student = studentName;
        el.dataset.fruitType = type;
        return el;
    }

    function fruitBuildTrajectory() {
        const { w, h } = fruitGetStageSize();
        const mult = fruitSpeedMultiplier();
        const duration = (FRUIT_BASE_DURATION.min + Math.random() * (FRUIT_BASE_DURATION.max - FRUIT_BASE_DURATION.min)) / mult;
        const kind = Math.random() < 0.5 ? 'horizontal' : 'arc';

        if (kind === 'horizontal') {
            const ltr = Math.random() < 0.5;
            const yBase = h * (0.12 + Math.random() * 0.68);
            const drift = (Math.random() - 0.5) * h * 0.08;
            return {
                kind: 'horizontal',
                duration,
                computePos(t) {
                    const x = ltr ? -100 + (w + 200) * t : w + 100 - (w + 200) * t;
                    const y = yBase + Math.sin(t * Math.PI * 2) * drift * 0.35;
                    return { x, y };
                },
            };
        }

        const fromLeft = Math.random() < 0.5;
        const startX = fromLeft ? -80 : w + 80;
        const endX = fromLeft ? w + 80 : -80;
        const startY = h + 50;
        const peakY = h * (0.08 + Math.random() * 0.35);
        return {
            kind: 'arc',
            duration,
            computePos(t) {
                const x = startX + (endX - startX) * t;
                const y = startY + (peakY - startY) * (4 * t * (1 - t));
                return { x, y };
            },
        };
    }

    function fruitRemove(id, requeueName) {
        const entry = fruitActiveMap.get(id);
        if (!entry) return;
        if (entry.el.parentNode) entry.el.remove();
        fruitActiveMap.delete(id);
        if (requeueName && fruitActive && !fruitPicking) {
            fruitRespawnQueue.push(entry.studentName);
        }
    }

    function fruitRemoveAll() {
        fruitActiveMap.forEach((_, id) => fruitRemove(id, false));
    }

    function fruitAnimateLoop(timestamp) {
        if (!fruitActive || fruitPicking) {
            fruitRafId = null;
            return;
        }

        fruitActiveMap.forEach((entry, id) => {
            const elapsed = timestamp - entry.startTime;
            const t = elapsed / entry.duration;
            if (t >= 1) {
                fruitRemove(id, true);
                return;
            }
            const pos = entry.trajectory.computePos(t);
            const wobble = Math.sin(elapsed * 0.004) * 8;
            entry.el.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${wobble}deg)`;
        });

        fruitRafId = requestAnimationFrame(fruitAnimateLoop);
    }

    function fruitSpawnOne() {
        if (!fruitActive || fruitPicking) return;
        if (fruitActiveMap.size >= 9) {
            fruitScheduleSpawn();
            return;
        }

        const name = fruitNextStudentName();
        if (!name) return;

        const stage = document.getElementById('fruitStage');
        if (!stage) return;

        const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
        const el = fruitCreateElement(name, type);
        const trajectory = fruitBuildTrajectory();
        const id = fruitNextId++;
        const startPos = trajectory.computePos(0);

        el.style.transform = `translate(${startPos.x}px, ${startPos.y}px)`;
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            fruitPick(id, name, el);
        });

        stage.appendChild(el);
        fruitActiveMap.set(id, {
            el,
            studentName: name,
            trajectory,
            duration: trajectory.duration,
            startTime: performance.now(),
        });

        fruitScheduleSpawn();
    }

    function fruitScheduleSpawn() {
        if (fruitSpawnTimer) clearTimeout(fruitSpawnTimer);
        if (!fruitActive || fruitPicking) return;
        const delay = 400 + Math.random() * 500;
        fruitSpawnTimer = setTimeout(fruitSpawnOne, delay);
    }

    function fruitPlaySplat() {
        playAudioBuffer(balloonPopBuffer);
    }

    function fruitExplode(fruitEl, typeKey, onDone) {
        const stage = document.getElementById('fruitStage');
        const rect = fruitEl.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        const cx = rect.left - stageRect.left + rect.width / 2;
        const cy = rect.top - stageRect.top + rect.height / 2;
        const colors = FRUIT_CHUNK_COLORS[typeKey] || FRUIT_CHUNK_COLORS.mango;
        const chunkCount = 5 + Math.floor(Math.random() * 4);

        fruitPlaySplat();
        fruitEl.style.visibility = 'hidden';
        fruitEl.style.pointerEvents = 'none';

        for (let i = 0; i < chunkCount; i++) {
            const chunk = document.createElement('div');
            chunk.className = 'tt-fruit-chunk';
            chunk.style.left = (cx - 11) + 'px';
            chunk.style.top = (cy - 11) + 'px';
            chunk.style.background = colors[i % colors.length];
            const angle = (Math.PI * 2 * i) / chunkCount + Math.random() * 0.5;
            const dist = 50 + Math.random() * 90;
            chunk.style.setProperty('--fx', Math.cos(angle) * dist + 'px');
            chunk.style.setProperty('--fy', Math.sin(angle) * dist + 'px');
            chunk.style.setProperty('--fr', (Math.random() * 540 - 270) + 'deg');
            stage.appendChild(chunk);
            setTimeout(() => chunk.remove(), 650);
        }

        setTimeout(onDone, 620);
    }

    function fruitPick(id, name, el) {
        if (fruitPicking || !fruitActive) return;
        fruitPicking = true;

        if (fruitSpawnTimer) clearTimeout(fruitSpawnTimer);
        if (fruitAutoTimer) clearTimeout(fruitAutoTimer);
        fruitSpawnTimer = null;
        fruitAutoTimer = null;

        const typeKey = el.dataset.fruitType || 'mango';
        fruitActiveMap.forEach((entry, fid) => {
            if (fid !== id) fruitRemove(fid, false);
        });

        fruitExplode(el, typeKey, () => {
            fruitRemove(id, false);
            closeFlyingFruit();
            showWinner(name);
        });
    }

    function fruitAutoPick() {
        if (!fruitActive || fruitPicking) return;
        const entries = Array.from(fruitActiveMap.entries());
        if (!entries.length) {
            fruitSpawnOne();
            setTimeout(fruitAutoPick, 200);
            return;
        }
        const pick = entries[Math.floor(Math.random() * entries.length)];
        fruitPick(pick[0], pick[1].studentName, pick[1].el);
    }

    function fruitStartSpawning() {
        fruitScheduleSpawn();
        for (let i = 0; i < 3; i++) setTimeout(fruitSpawnOne, i * 180);

        fruitAutoTimer = setTimeout(fruitAutoPick, 15000);

        const hint = document.getElementById('fruitHint');
        if (hint && !localStorage.getItem(FRUIT_HINT_KEY)) {
            hint.classList.remove('hidden');
            localStorage.setItem(FRUIT_HINT_KEY, '1');
            setTimeout(() => hint.classList.add('hidden'), 5000);
        } else if (hint) {
            hint.classList.add('hidden');
        }

        if (!fruitRafId) fruitRafId = requestAnimationFrame(fruitAnimateLoop);
    }

    function fruitRunCountdown(done) {
        const el = document.getElementById('fruitCountdown');
        if (!el) {
            done();
            return;
        }
        el.hidden = false;
        const steps = ['3', '2', '1', 'Go!'];
        let i = 0;
        el.textContent = steps[0];

        const tick = () => {
            i++;
            if (i >= steps.length) {
                el.hidden = true;
                done();
                return;
            }
            el.textContent = steps[i];
            setTimeout(tick, i === steps.length - 1 ? 450 : 850);
        };
        setTimeout(tick, 850);
    }

    function openFlyingFruit() {
        const pool = getAvailableStudents();
        if (pool.length === 0) {
            showNotification('All students have had turns! Reset categories to continue.', 'info');
            return;
        }

        fruitPool = [...pool];
        fruitNameIndex = 0;
        fruitRespawnQueue = [];
        fruitActive = true;
        fruitPicking = false;
        fruitActiveMap.clear();
        fruitNextId = 0;

        const overlay = document.getElementById('ttFruitOverlay');
        const stage = document.getElementById('fruitStage');
        if (stage) stage.innerHTML = '';

        overlay.classList.add('visible');

        document.querySelectorAll('.tt-fruit-speed-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.speed === fruitSpeedMode);
        });

        fruitRunCountdown(() => {
            if (fruitActive) fruitStartSpawning();
        });
    }

    function closeFlyingFruit() {
        fruitActive = false;
        fruitPicking = false;

        if (fruitSpawnTimer) clearTimeout(fruitSpawnTimer);
        if (fruitAutoTimer) clearTimeout(fruitAutoTimer);
        fruitSpawnTimer = null;
        fruitAutoTimer = null;

        if (fruitRafId) {
            cancelAnimationFrame(fruitRafId);
            fruitRafId = null;
        }

        fruitRemoveAll();
        const stage = document.getElementById('fruitStage');
        if (stage) stage.innerHTML = '';

        const countdown = document.getElementById('fruitCountdown');
        if (countdown) countdown.hidden = true;

        document.getElementById('ttFruitOverlay')?.classList.remove('visible');
    }

    function fruitBindSpeedControls() {
        const group = document.getElementById('fruitSpeedGroup');
        if (!group || group.dataset.fruitBound) return;
        group.dataset.fruitBound = 'true';

        group.querySelectorAll('.tt-fruit-speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                fruitSpeedMode = btn.dataset.speed || 'normal';
                group.querySelectorAll('.tt-fruit-speed-btn').forEach(b => {
                    b.classList.toggle('active', b === btn);
                });
            });
        });
    }

    function ensurePlinkoModeCard() {
        let card = document.getElementById('ttModeCardPlinko');

        if (!card) {
            const grid = document.querySelector('.tt-modes-grid');
            if (!grid) return null;

            card = document.createElement('div');
            card.className = 'tt-mode-card';
            card.id = 'ttModeCardPlinko';
            card.innerHTML = `
                <div class="tt-mode-thumbnail tt-mode-thumbnail-plinko">
                    <div class="mini-plinko">
                        <div class="m-plinko-peg"></div>
                        <div class="m-plinko-peg"></div>
                        <div class="m-plinko-peg"></div>
                        <div class="m-plinko-ball"></div>
                    </div>
                </div>
                <h3>Plinko</h3>
                <p>Drop the ball, land a name.</p>
            `;

            const hopCard = document.getElementById('ttModeCardHop');
            const slotCard = document.getElementById('ttModeCardSlot');
            if (hopCard) hopCard.insertAdjacentElement('afterend', card);
            else if (slotCard) slotCard.insertAdjacentElement('beforebegin', card);
            else grid.appendChild(card);
        }

        if (!card.dataset.plinkoBound) {
            card.dataset.plinkoBound = 'true';
            card.addEventListener('click', () => {
                document.getElementById('ttModesOverlay')?.classList.remove('visible');
                openPlinko();
            });
        }

        return card;
    }

    function ensurePlinkoOverlay() {
        if (document.getElementById('ttPlinkoOverlay')) return false;

        const pinataOverlay = document.getElementById('ttPinataOverlay');
        const overlay = document.createElement('div');
        overlay.className = 'tt-plinko-overlay';
        overlay.id = 'ttPlinkoOverlay';
        overlay.innerHTML = `
            <div class="tt-plinko-container">
                <button class="tt-plinko-close" id="plinkoCloseBtn" title="Close" type="button">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <div class="tt-plinko-board-wrap" id="plinkoBoardWrap">
                    <canvas id="plinkoCanvas" aria-label="Plinko board"></canvas>
                </div>
                <div class="tt-plinko-controls">
                    <button class="tt-plinko-btn tt-plinko-drop-btn" id="plinkoDropBtn" type="button">
                        <i class="fa-solid fa-circle-down"></i> Drop
                    </button>
                    <button class="tt-plinko-btn tt-plinko-reset-btn" id="plinkoResetBtn" type="button">
                        <i class="fa-solid fa-rotate-left"></i> Reset
                    </button>
                </div>
            </div>
        `;

        if (pinataOverlay) pinataOverlay.insertAdjacentElement('beforebegin', overlay);
        else document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePlinko();
        });
        document.getElementById('plinkoCloseBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            closePlinko();
        });
        document.getElementById('plinkoDropBtn')?.addEventListener('click', plinkoDropBall);
        document.getElementById('plinkoResetBtn')?.addEventListener('click', plinkoReset);
        plinkoBindPointerEvents();

        return true;
    }

    function plinkoBindPointerEvents() {
        const canvas = document.getElementById('plinkoCanvas');
        if (!canvas || canvas.dataset.plinkoBound) return;
        canvas.dataset.plinkoBound = 'true';

        canvas.addEventListener('mousedown', plinkoOnPointerDown);
        canvas.addEventListener('mousemove', plinkoOnPointerMove);
        window.addEventListener('mouseup', plinkoOnPointerUp);

        canvas.addEventListener('touchstart', plinkoOnPointerDown, { passive: false });
        canvas.addEventListener('touchmove', plinkoOnPointerMove, { passive: false });
        window.addEventListener('touchend', plinkoOnPointerUp);
    }

    // ── Reset Categories ──────────────────────────────────
    function resetCategories() {
        const st = currentState();
        getStudents().forEach(name => {
            if (st.turns[name]) {
                st.turns[name].status = 'none';
                st.turns[name].count = 0;
            }
        });
        saveToLocalStorage();
        renderGrid();
        updateFilterCounts();
        showNotification('Categories reset! All students are available again.', 'success');
    }

    function resetAll() {
        const group = getActiveGroup();
        allState[activeGroupId] = { turns: {}, absent: {} };
        saveToLocalStorage();
        renderGrid();
        updateFilterCounts();
        showNotification(`All data cleared for ${group ? group.label : 'this group'}.`, 'success');
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
                    const group = getActiveGroup();
                    inp.value = `turns-${(group ? group.id : 'class').toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;
                }
            }, 400);
        });
    }

    // ── Init ──────────────────────────────────────────────
    function init() {
        loadFromLocalStorage();
        renderGroupTabs();
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

        // Modes Overlay
        const modesOverlay = document.getElementById('ttModesOverlay');
        const openModesBtn = document.getElementById('ttOpenModesBtn');
        const closeModesBtn = document.getElementById('modesCloseBtn');

        if (openModesBtn) {
            openModesBtn.addEventListener('click', () => {
                modesOverlay.classList.add('visible');
            });
        }

        if (closeModesBtn) {
            closeModesBtn.addEventListener('click', () => {
                modesOverlay.classList.remove('visible');
            });
        }

        if (modesOverlay) {
            modesOverlay.addEventListener('click', (e) => {
                if (e.target === modesOverlay) {
                    modesOverlay.classList.remove('visible');
                }
            });
        }

        const closeModes = () => {
            if (modesOverlay) modesOverlay.classList.remove('visible');
        };

        // Plinko UI (inject if cached HTML is missing the card/overlay)
        ensurePlinkoOverlay();
        ensurePlinkoModeCard();

        // Mode cards
        document.getElementById('ttModeCardHop')?.addEventListener('click', () => { closeModes(); startHop(); });
        document.getElementById('ttModeCardRoulette')?.addEventListener('click', () => { closeModes(); openRoulette(); });
        document.getElementById('ttModeCardBalloons')?.addEventListener('click', () => { closeModes(); openBalloons(); });
        document.getElementById('ttModeCardSlot')?.addEventListener('click', () => { closeModes(); openSlotMachine(); });
        document.getElementById('ttModeCardCards')?.addEventListener('click', () => { closeModes(); openCards(); });
        document.getElementById('ttModeCardPinata')?.addEventListener('click', () => { closeModes(); openPinata(); });
        document.getElementById('ttModeCardFruit')?.addEventListener('click', () => { closeModes(); openFlyingFruit(); });

        fruitBindSpeedControls();
        document.getElementById('fruitCloseBtn')?.addEventListener('click', closeFlyingFruit);
        document.getElementById('ttFruitOverlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget && !fruitPicking) closeFlyingFruit();
        });

        // Plinko overlay controls (when overlay is in HTML)
        plinkoBindPointerEvents();
        const plinkoCloseBtn = document.getElementById('plinkoCloseBtn');
        if (plinkoCloseBtn && !plinkoCloseBtn.dataset.plinkoBound) {
            plinkoCloseBtn.dataset.plinkoBound = 'true';
            plinkoCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closePlinko();
            });
        }
        const plinkoDropBtn = document.getElementById('plinkoDropBtn');
        if (plinkoDropBtn && !plinkoDropBtn.dataset.plinkoBound) {
            plinkoDropBtn.dataset.plinkoBound = 'true';
            plinkoDropBtn.addEventListener('click', plinkoDropBall);
        }
        const plinkoResetBtn = document.getElementById('plinkoResetBtn');
        if (plinkoResetBtn && !plinkoResetBtn.dataset.plinkoBound) {
            plinkoResetBtn.dataset.plinkoBound = 'true';
            plinkoResetBtn.addEventListener('click', plinkoReset);
        }

        // Cards action
        document.getElementById('cardsCloseBtn').addEventListener('click', closeCards);
        document.getElementById('cardsShuffleBtn').addEventListener('click', shuffleCards);

        // Piñata
        document.getElementById('pinataCloseBtn').addEventListener('click', closePinata);
        document.getElementById('pinataBody').addEventListener('click', handlePinataTap);

        // Slot action
        document.getElementById('slotActionBtn').addEventListener('click', handleSlotAction);
        document.getElementById('slotCloseBtn').addEventListener('click', closeSlotMachine);

        // Winner actions
        document.getElementById('ttWinnerCorrect').addEventListener('click', () => applyTurn('correct'));
        document.getElementById('ttWinnerParticipated').addEventListener('click', () => applyTurn('participated'));
        document.getElementById('ttWinnerSkip').addEventListener('click', hideWinner);
        document.getElementById('ttWinnerClose').addEventListener('click', hideWinner);

        // Roulette
        const rouletteSpinBtn = document.getElementById('rouletteSpinBtn');
        rouletteSpinBtn.addEventListener('mousedown', startChargeRoulette);
        rouletteSpinBtn.addEventListener('touchstart', startChargeRoulette, { passive: true });
        const stopChargeHandler = (e) => releaseChargeRoulette(e);
        window.addEventListener('mouseup', stopChargeHandler);
        window.addEventListener('touchend', stopChargeHandler);

        document.getElementById('rouletteCloseBtn').addEventListener('click', closeRoulette);

        // Balloons
        document.getElementById('balloonCloseBtn').addEventListener('click', closeBalloons);

        // Reset
        document.getElementById('ttResetCategories').addEventListener('click', () => {
            const group = getActiveGroup();
            if (confirm(`Reset turn categories for ${group ? group.label : 'this group'}? Students will be available for selection again.`)) {
                resetCategories();
            }
        });

        document.getElementById('ttResetAll').addEventListener('click', () => {
            const group = getActiveGroup();
            if (confirm(`Clear ALL data for ${group ? group.label : 'this group'} including absences? This cannot be undone.`)) {
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
        document.getElementById('ttSlotOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeSlotMachine();
        });
        document.getElementById('ttCardsOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeCards();
        });
        document.getElementById('ttPinataOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closePinata();
        });
        document.getElementById('ttPlinkoOverlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closePlinko();
        });

        // Setup View Toggles
        const toggleNameModeBtn = document.getElementById('ttToggleNameMode');
        const toggleSortBtn = document.getElementById('ttToggleSort');

        function updateToggleUI() {
            if (nameMode === 'first') {
                toggleNameModeBtn.innerHTML = '<i class="fa-solid fa-id-badge"></i> First Name';
                toggleNameModeBtn.classList.remove('active');
            } else {
                toggleNameModeBtn.innerHTML = '<i class="fa-solid fa-id-card"></i> Full Name';
                toggleNameModeBtn.classList.add('active');
            }
            if (sortMode === 'last') {
                toggleSortBtn.innerHTML = '<i class="fa-solid fa-arrow-down-a-z"></i> Sort: Last';
                toggleSortBtn.classList.remove('active');
            } else {
                toggleSortBtn.innerHTML = '<i class="fa-solid fa-arrow-down-z-a"></i> Sort: First';
                toggleSortBtn.classList.add('active');
            }
        }

        if (toggleNameModeBtn && toggleSortBtn) {
            updateToggleUI();

            toggleNameModeBtn.addEventListener('click', () => {
                nameMode = nameMode === 'full' ? 'first' : 'full';
                saveToLocalStorage();
                updateToggleUI();
                renderGrid();
            });

            toggleSortBtn.addEventListener('click', () => {
                sortMode = sortMode === 'first' ? 'last' : 'first';
                saveToLocalStorage();
                updateToggleUI();
                renderGrid();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
