/**
 * Birthday Notification System
 * Manages the floating bell, notification panel, and celebration overlay.
 * Requires: students-data.js (STUDENTS_DATA)
 */
(function () {
    'use strict';

    const UPCOMING_DAYS = 30;
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // ─── Utility Functions ──────────────────────────────────
    function today() {
        return new Date();
    }

    function getDaysUntilBirthday(birthdateMMDD) {
        const now = today();
        const [mm, dd] = birthdateMMDD.split('-').map(Number);
        let bdayThisYear = new Date(now.getFullYear(), mm - 1, dd);
        if (bdayThisYear < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
            bdayThisYear = new Date(now.getFullYear() + 1, mm - 1, dd);
        }
        const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return Math.round((bdayThisYear - nowMidnight) / (1000 * 60 * 60 * 24));
    }

    function formatBirthdate(mmdd) {
        const [mm, dd] = mmdd.split('-').map(Number);
        return `${MONTH_NAMES[mm - 1]} ${dd}`;
    }

    /**
     * Weekend Fallback: if birthday is on Sat/Sun, the effective
     * trigger day is the following Monday. We also check if the
     * teacher has already dismissed it.
     */
    function getEffectiveDays(birthdateMMDD, studentName) {
        const raw = getDaysUntilBirthday(birthdateMMDD);
        const now = today();
        const [mm, dd] = birthdateMMDD.split('-').map(Number);

        // Actual birthday date this cycle
        let bdayDate = new Date(now.getFullYear(), mm - 1, dd);
        if (bdayDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
            bdayDate = new Date(now.getFullYear() + 1, mm - 1, dd);
        }

        const dayOfWeek = bdayDate.getDay(); // 0=Sun, 6=Sat
        let effectiveDate = new Date(bdayDate);

        if (dayOfWeek === 0) effectiveDate.setDate(bdayDate.getDate() + 1); // Sun → Mon
        if (dayOfWeek === 6) effectiveDate.setDate(bdayDate.getDate() + 2); // Sat → Mon

        const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const effectiveDays = Math.round((effectiveDate - nowMidnight) / (1000 * 60 * 60 * 24));

        // If effective day is today (0) but already celebrated/dismissed, skip
        const key = `birthday_celebrated_${studentName}_${effectiveDate.getFullYear()}_${effectiveDate.getMonth()}_${effectiveDate.getDate()}`;
        const dismissed = localStorage.getItem(key);

        return {
            daysUntil: effectiveDays < 0 ? raw : effectiveDays,
            isToday: effectiveDays === 0 && !dismissed,
            wasWeekend: dayOfWeek === 0 || dayOfWeek === 6,
            dismissKey: key,
            rawDays: raw
        };
    }

    function getUpcomingBirthdays() {
        return STUDENTS_DATA.map(s => {
            const info = getEffectiveDays(s.birthdate, s.name);
            return {
                name: s.name,
                birthdate: s.birthdate,
                ...info
            };
        })
            .filter(s => s.daysUntil <= UPCOMING_DAYS)
            .sort((a, b) => a.daysUntil - b.daysUntil);
    }


    // ─── DOM Injection ──────────────────────────────────────
    function injectBirthdayUI() {
        const upcoming = getUpcomingBirthdays();
        const todayBirthdays = upcoming.filter(s => s.isToday);
        const count = upcoming.length;

        // Bell Button
        const bell = document.createElement('button');
        bell.className = 'birthday-bell-btn' + (todayBirthdays.length > 0 ? ' has-today' : '');
        bell.id = 'birthdayBellBtn';
        bell.title = 'Birthday Notifications';
        bell.innerHTML = `
            <i class="fa-solid fa-bell"></i>
            <span class="birthday-badge ${count === 0 ? 'hidden' : ''}">${count}</span>
        `;
        document.body.appendChild(bell);

        // Panel Overlay
        const overlay = document.createElement('div');
        overlay.className = 'birthday-panel-overlay';
        overlay.id = 'birthdayPanelOverlay';
        document.body.appendChild(overlay);

        // Panel
        const panel = document.createElement('div');
        panel.className = 'birthday-panel';
        panel.id = 'birthdayPanel';
        panel.innerHTML = `
            <div class="birthday-panel-header">
                <h3><i class="fa-solid fa-cake-candles"></i> Upcoming Birthdays</h3>
                <button class="birthday-panel-close" id="birthdayPanelClose"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="birthday-panel-body" id="birthdayPanelBody"></div>
        `;
        document.body.appendChild(panel);

        // Celebration Overlay
        const celeb = document.createElement('div');
        celeb.className = 'celebration-overlay';
        celeb.id = 'celebrationOverlay';
        celeb.innerHTML = `
            <button class="celebration-close-btn" id="celebrationCloseBtn"><i class="fa-solid fa-xmark"></i></button>
            <canvas class="confetti-canvas" id="confettiCanvas"></canvas>
            <div class="balloon-container" id="balloonContainer"></div>
            <div class="celebration-glow"></div>
            <div class="celebration-content">
                <div class="celebration-emoji">🎂</div>
                <div class="celebration-title">Happy Birthday!</div>
                <div class="celebration-name" id="celebrationName"></div>
                <div class="celebration-date" id="celebrationDate"></div>
            </div>
        `;
        document.body.appendChild(celeb);

        // Populate Panel
        renderPanel(upcoming);

        // Events
        bell.addEventListener('click', togglePanel);
        overlay.addEventListener('click', closePanel);
        document.getElementById('birthdayPanelClose').addEventListener('click', closePanel);
        document.getElementById('celebrationCloseBtn').addEventListener('click', closeCelebration);
    }

    function renderPanel(upcoming) {
        const body = document.getElementById('birthdayPanelBody');
        if (!body) return;

        if (upcoming.length === 0) {
            body.innerHTML = `
                <div class="birthday-panel-empty">
                    <i class="fa-solid fa-calendar-check"></i>
                    <p>No upcoming birthdays in the next ${UPCOMING_DAYS} days</p>
                </div>
            `;
            return;
        }

        body.innerHTML = upcoming.map(s => {
            const isToday = s.isToday;
            const daysLabel = isToday ? '🎉 Today!' : `${s.daysUntil} day${s.daysUntil !== 1 ? 's' : ''}`;
            const daysClass = isToday ? 'today-tag' : 'soon-tag';
            const weekendNote = s.wasWeekend && isToday ? ' (weekend b-day)' : '';

            return `
                <div class="birthday-item ${isToday ? 'is-today' : ''}" 
                     ${isToday ? `onclick="window._birthdaySystem.openCelebration('${s.name.replace(/'/g, "\\'")}', '${s.birthdate}')"` : ''}>
                    <div class="birthday-item-icon">
                        <i class="fa-solid ${isToday ? 'fa-gift' : 'fa-cake-candles'}"></i>
                    </div>
                    <div class="birthday-item-info">
                        <div class="birthday-item-name">${s.name}</div>
                        <div class="birthday-item-date">${formatBirthdate(s.birthdate)}${weekendNote}</div>
                    </div>
                    <span class="birthday-item-days ${daysClass}">${daysLabel}</span>
                </div>
            `;
        }).join('');
    }


    // ─── Panel Toggle ───────────────────────────────────────
    function togglePanel() {
        const panel = document.getElementById('birthdayPanel');
        const overlay = document.getElementById('birthdayPanelOverlay');
        const isOpen = panel.classList.contains('active');
        if (isOpen) {
            closePanel();
        } else {
            panel.classList.add('active');
            overlay.classList.add('active');
        }
    }

    function closePanel() {
        const panel = document.getElementById('birthdayPanel');
        const overlay = document.getElementById('birthdayPanelOverlay');
        panel.classList.remove('active');
        overlay.classList.remove('active');
    }


    // ─── Celebration ────────────────────────────────────────
    let confettiAnimId = null;
    let confettiInterval = null;
    let birthdayAudio = null;

    function openCelebration(name, birthdate) {
        closePanel();

        const overlay = document.getElementById('celebrationOverlay');
        const nameEl = document.getElementById('celebrationName');
        const dateEl = document.getElementById('celebrationDate');

        // Extract first name for display
        nameEl.textContent = name;
        dateEl.textContent = `🎈 ${formatBirthdate(birthdate)} 🎈`;

        // Reset animation
        nameEl.style.animation = 'none';
        nameEl.offsetHeight; // trigger reflow
        nameEl.style.animation = '';

        overlay.classList.add('active');

        // Start confetti
        startConfetti();

        // Create balloons
        createBalloons();

        // Play birthday music
        playBirthdayMusic();

        // Mark as celebrated (dismiss key)
        const info = getEffectiveDays(birthdate, name);
        localStorage.setItem(info.dismissKey, 'true');
    }

    function closeCelebration() {
        const overlay = document.getElementById('celebrationOverlay');
        overlay.classList.remove('active');
        stopConfetti();
        clearBalloons();
        stopBirthdayMusic();

        // Refresh panel data after dismissing
        const upcoming = getUpcomingBirthdays();
        renderPanel(upcoming);
        updateBellBadge(upcoming);
    }

    function updateBellBadge(upcoming) {
        const bell = document.getElementById('birthdayBellBtn');
        const badge = bell.querySelector('.birthday-badge');
        const todayBirthdays = upcoming.filter(s => s.isToday);
        const count = upcoming.length;

        badge.textContent = count;
        badge.classList.toggle('hidden', count === 0);
        bell.classList.toggle('has-today', todayBirthdays.length > 0);
    }


    // ─── Confetti Engine ────────────────────────────────────
    function startConfetti() {
        const canvas = document.getElementById('confettiCanvas');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const colors = ['#f35b04', '#f7b801', '#7678ed', '#3d348b', '#f18701', '#00b894', '#ff6b6b', '#ffd93d', '#6c5ce7', '#fd79a8'];
        let particles = [];

        function createBurst() {
            const burstCount = 80;
            // Left corner burst — shoots RIGHT toward center
            for (let i = 0; i < burstCount; i++) {
                particles.push(createParticle(30, canvas.height, 1, colors));
            }
            // Right corner burst — shoots LEFT toward center
            for (let i = 0; i < burstCount; i++) {
                particles.push(createParticle(canvas.width - 30, canvas.height, -1, colors));
            }
        }

        function createParticle(x, y, dir, colors) {
            // Wide angular spread: mostly inward with some variation
            const angle = (Math.random() * 55 + 35) * (Math.PI / 180); // 35°–90° from horizontal
            const speed = Math.random() * 16 + 12; // strong launch speed
            return {
                x: x,
                y: y,
                vx: Math.cos(angle) * speed * dir + (Math.random() - 0.3) * 3,
                vy: -Math.sin(angle) * speed,
                gravity: 0.28,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 12,
                opacity: 1,
                shape: Math.floor(Math.random() * 3), // 0=rect, 1=circle, 2=strip
            };
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach(p => {
                p.vy += p.gravity;
                p.x += p.vx;
                p.y += p.vy;
                p.rotation += p.rotationSpeed;
                p.vx *= 0.99;

                if (p.y > canvas.height + 50) {
                    p.opacity -= 0.05;
                }

                if (p.opacity <= 0) return;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = Math.max(p.opacity, 0);
                ctx.fillStyle = p.color;

                if (p.shape === 0) {
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                } else if (p.shape === 1) {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.fillRect(-p.size / 2, -p.size * 1.2 / 2, p.size * 0.3, p.size * 1.2);
                }

                ctx.restore();
            });

            // Remove dead particles
            particles = particles.filter(p => p.opacity > 0);

            confettiAnimId = requestAnimationFrame(animate);
        }

        // Initial burst
        createBurst();
        animate();

        // Repeating bursts every 2.5 seconds
        confettiInterval = setInterval(() => {
            createBurst();
        }, 2500);
    }

    function stopConfetti() {
        if (confettiAnimId) {
            cancelAnimationFrame(confettiAnimId);
            confettiAnimId = null;
        }
        if (confettiInterval) {
            clearInterval(confettiInterval);
            confettiInterval = null;
        }
        const canvas = document.getElementById('confettiCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }


    // ─── Balloons ───────────────────────────────────────────
    function createBalloons() {
        const container = document.getElementById('balloonContainer');
        const balloonColors = ['#f35b04', '#f7b801', '#7678ed', '#00b894', '#fd79a8', '#6c5ce7', '#ff6b6b', '#ffd93d'];

        for (let i = 0; i < 12; i++) {
            const balloon = document.createElement('div');
            balloon.className = 'balloon';
            const color = balloonColors[Math.floor(Math.random() * balloonColors.length)];
            balloon.style.background = color;
            balloon.style.left = `${Math.random() * 90 + 5}%`;
            balloon.style.setProperty('--duration', `${6 + Math.random() * 6}s`);
            balloon.style.setProperty('--delay', `${Math.random() * 4}s`);
            balloon.style.width = `${40 + Math.random() * 25}px`;
            balloon.style.height = `${50 + Math.random() * 30}px`;
            container.appendChild(balloon);
        }
    }

    function clearBalloons() {
        const container = document.getElementById('balloonContainer');
        if (container) container.innerHTML = '';
    }


    // ─── Birthday Music ─────────────────────────────────────
    function playBirthdayMusic() {
        try {
            birthdayAudio = new Audio('assets/birthday-music.mp3');
            birthdayAudio.loop = true;
            birthdayAudio.volume = 0.5;
            birthdayAudio.play().catch(() => { });
        } catch (e) {
            console.warn('Birthday music not available:', e);
        }
    }

    function stopBirthdayMusic() {
        if (!birthdayAudio) return;
        // Fade out over 800ms
        const fadeInterval = setInterval(() => {
            if (birthdayAudio.volume > 0.05) {
                birthdayAudio.volume = Math.max(0, birthdayAudio.volume - 0.05);
            } else {
                clearInterval(fadeInterval);
                birthdayAudio.pause();
                birthdayAudio.currentTime = 0;
                birthdayAudio = null;
            }
        }, 50);
    }


    // ─── Init ───────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof STUDENTS_DATA === 'undefined') return;
        injectBirthdayUI();
    });

    // Expose for inline onclick
    window._birthdaySystem = {
        openCelebration: openCelebration
    };

})();
