/**
 * Student Self-Assessment Survey
 * Handles survey flow, score calculation, radial picker,
 * Google Drive autosave, and CSV export.
 */

(function () {
    'use strict';

    // ── Configuration ────────────────────────────────────────────
    // PEGA AQUÍ LA URL DE TU APLICACIÓN WEB DE GOOGLE APPS SCRIPT
    const APPS_SCRIPT_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbz6QrPtwr6dkF04DgFfnXiQLR1mmRaOGx9fmY1D6G64aLnpZPb4o74hwkL40VE7CMDlDQ/exec";

    // ── Criteria Data ────────────────────────────────────────────
    const CRITERIA = [
        {
            statement: "Evito distraerme y participo de los aprendizajes de la clase",
            explanation: "Esto significa que le prestas atención al profesor y a las actividades de la clase, tanto en el salón como en la sala de sistemas. En el salón, evitas ponerte a jugar con tu regla, usar marcadores, pegar stickers, pintar, recortar, usar pegante o escribir cartas cuando no te lo han pedido. En la sala de sistemas, esto también significa que no abres páginas web, juegos, videos ni redes sociales que no tengan que ver con la clase mientras el profesor no lo haya autorizado. En ambos espacios, escuchas con cuidado cuando el profesor explica o cuando algún compañero está participando."
        },
        {
            statement: "Soy responsable y me preparo a tiempo para las actividades evaluativas",
            explanation: "Esto significa que te esfuerzas estudiando juiciosamente en casa. Por ejemplo, si hay una prueba o examen programado, repasas tus apuntes con anticipación y haces las actividades extra que te comparten para practicar, en vez de dejar el estudio para el último minuto."
        },
        {
            statement: "Respeto y pongo atención a las explicaciones de la clase",
            explanation: "Esto significa que cuando participas y hablas frente a tus compañeros, tus ideas ayudan a entender mejor el tema que están estudiando. Por ejemplo, levantas la mano para dar buenas opiniones que sumen a la clase, en lugar de usar tu turno para hacer chistes, bromas o comentarios que no tienen nada que ver con el tema."
        },
        {
            statement: "Trabajo con calidad y sigo instrucciones",
            explanation: "Esto significa que haces tus tareas, diseños y proyectos con mucho cuidado, esfuerzo y creatividad. Por ejemplo, cuando entregas un trabajo, se nota que seguiste paso a paso las instrucciones que dio el profesor y que lo hiciste lo mejor posible, en lugar de hacerlo de afán o sin ganas."
        },
        {
            statement: "Presento responsablemente el material escolar para la clase",
            explanation: "Esto significa que siempre traes al colegio las cosas que vas a necesitar para poder aprender. Por ejemplo, no se te olvida traer tus libros de texto a la clase, o si van a hacer un experimento o una manualidad, te aseguras de traer desde tu casa todos los materiales que el profesor pidió."
        },
        {
            statement: "Soy responsable y desarrollo a tiempo las actividades diarias de la clase",
            explanation: "Esto significa que aprovechas cada minuto de clase para avanzar y terminar tus actividades en el tiempo indicado. En la sala de sistemas, esto es especialmente importante: usas el computador únicamente para lo que el profesor asignó. Si todavía no has terminado tu proyecto o actividad, no abres páginas, juegos ni videos que no tengan que ver con la clase. El tiempo en la sala es valioso y no se puede recuperar, así que lo aprovechas trabajando con concentración desde el primer momento."
        },
        {
            statement: "Soy solidario con todos los que lo necesitan",
            explanation: "Esto significa que te gusta ayudar y compartir. Por ejemplo, si ves que a un compañero le hace falta un lápiz, una regla o algún material, tú se lo prestas. También, si ves que alguien está confundido o necesita ayuda con su trabajo, le explicas y lo guías amablemente."
        },
        {
            statement: "Demuestro hábitos de cortesía, respeto por mí y por los demás",
            explanation: "Esto significa que eres amable y respetuoso con todos en cualquier espacio de la clase. En el salón, tratas a todos con respeto y usas palabras amables cuando opinas sobre el trabajo de tus compañeros. En la sala de sistemas, el respeto también significa que no interrumpes a quienes están trabajando en su computador: no les hablas sin razón, no te acercas a mirar su pantalla sin permiso, y no haces ruidos ni comentarios que los distraigan. Cuando alguien está concentrado trabajando, respetar su espacio es una forma muy importante de ser considerado."
        },
        {
            statement: "Cuido los espacios del colegio y promuevo el orden, la limpieza y la seguridad",
            explanation: "Esto significa que cuidas todos los espacios del colegio para que se vean bien y sean seguros para todos. En el salón, botas la basura en su lugar y dejas tu pupitre limpio y ordenado al terminar. En la sala de sistemas, además del orden y la limpieza, también cuidas la seguridad: recuerdas no correr dentro de la sala, ya que los equipos son frágiles y una caída puede dañarlos o hacerte daño a ti o a un compañero. Cuidas el computador que tienes asignado, lo tratas con cuidado y lo dejas en las mismas condiciones en que lo encontraste."
        }
    ];

    const LIKERT_OPTIONS = [
        { value: 1, label: 'Nunca' },
        { value: 2, label: 'A veces' },
        { value: 3, label: 'Casi siempre' },
        { value: 4, label: 'Siempre' }
    ];

    const GROUPS = ['3A', '3B', '3C', '4A', '4B', '4C', '5A', '5B', '5C', '5D'];

    // ── State ────────────────────────────────────────────────────
    let studentName = '';
    let studentGroup = '';
    let answers = {}; // { c0: value, c1: value, ... }
    let generatedScore = null;
    let adjustedScore = null;
    let decision = null; // 'agree' | 'disagree'
    let currentRadialScore = 3.5;
    let currentQuestionIndex = 0;

    // ── DOM helpers ──────────────────────────────────────────────
    const $ = id => document.getElementById(id);
    const screens = {};

    // ── Init ─────────────────────────────────────────────────────
    function init() {
        // Init Themes
        setupThemes();

        // Populate group dropdown
        const groupSelect = $('sa-group');
        GROUPS.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            groupSelect.appendChild(opt);
        });

        // Render survey criteria (one question per step)
        renderCriteria();

        // Setup screen 1 (entry)
        $('sa-start-btn').addEventListener('click', startSurvey);
        $('sa-prev-btn').addEventListener('click', goToPreviousQuestion);
        $('sa-next-btn').addEventListener('click', goToNextQuestion);
        $('sa-calc-btn').addEventListener('click', calculateScore);

        // Keep the floating explanation aligned / dismissed as the layout moves
        window.addEventListener('scroll', hideFloatingTip, true);
        window.addEventListener('resize', hideFloatingTip);

        // Cache screen refs
        ['entry', 'survey', 'result', 'agree', 'disagree'].forEach(id => {
            screens[id] = $('sa-screen-' + id);
        });

        showScreen('entry');
    }

    // ── Screen transitions ───────────────────────────────────────
    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[name].classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ── Start survey ─────────────────────────────────────────────
    function startSurvey() {
        const nameInput = $('sa-name');
        const groupInput = $('sa-group');

        studentName = nameInput.value.trim();
        studentGroup = groupInput.value;

        if (!studentName) {
            nameInput.focus();
            nameInput.style.borderColor = '#ef4444';
            setTimeout(() => { nameInput.style.borderColor = ''; }, 1500);
            showToast('Por favor escribe tu nombre', 'error');
            return;
        }
        if (!studentGroup) {
            showToast('Por favor selecciona tu grupo', 'error');
            return;
        }

        // Update badge
        $('sa-student-badge-name').textContent = `${studentName} · ${studentGroup}`;

        answers = {};
        currentQuestionIndex = 0;
        renderStepDots();
        showQuestion(0, 'none');
        updateProgress();
        showScreen('survey');
    }

    // ── Render criteria (wizard: one per screen) ─────────────────
    function renderCriteria() {
        const list = $('sa-criteria-list');
        list.innerHTML = '';

        CRITERIA.forEach((crit, idx) => {
            const card = document.createElement('div');
            card.className = 'sa-criterion-card sa-question-slide';
            card.setAttribute('data-index', idx);
            if (idx === 0) card.classList.add('active');

            const likertHTML = LIKERT_OPTIONS.map(opt => `
                <label class="sa-likert-option">
                    <input type="radio" name="crit-${idx}" value="${opt.value}" data-index="${idx}" />
                    <span class="sa-likert-label">${opt.label}</span>
                </label>
            `).join('');

            card.innerHTML = `
                <div class="sa-question-inner">
                    <div class="sa-criterion-header">
                        <p class="sa-criterion-text">${crit.statement}</p>
                        <div class="sa-info-wrap">
                            <button class="sa-info-btn" type="button" aria-label="Ver explicación">
                                <i class="fa-solid fa-circle-info"></i>
                            </button>
                            <div class="sa-tooltip">${crit.explanation}</div>
                        </div>
                    </div>
                    <p class="sa-likert-prompt">¿Con qué frecuencia lo haces?</p>
                    <div class="sa-likert sa-likert-step" role="radiogroup" aria-label="Escala para criterio ${idx + 1}">
                        ${likertHTML}
                    </div>
                </div>
            `;

            list.appendChild(card);
        });

        renderStepDots();

        $('sa-criteria-list').addEventListener('change', e => {
            if (e.target.type === 'radio') {
                const idx = parseInt(e.target.dataset.index, 10);
                answers[`c${idx}`] = parseInt(e.target.value, 10);
                e.target.closest('.sa-criterion-card')?.classList.add('answered');
                updateProgress();
                updateQuestionNav();
                hideUnansweredWarning();
            }
        });

        // Explanations render in a body-level layer so they escape the
        // question slide's overflow/transform clipping.
        const floatingTip = ensureFloatingTip();
        list.querySelectorAll('.sa-info-btn').forEach(btn => {
            const src = btn.parentElement.querySelector('.sa-tooltip');
            const html = src ? src.innerHTML : '';
            btn.addEventListener('mouseenter', () => showFloatingTip(btn, html));
            btn.addEventListener('mouseleave', hideFloatingTip);
            btn.addEventListener('focus', () => showFloatingTip(btn, html));
            btn.addEventListener('blur', hideFloatingTip);
            btn.addEventListener('click', e => {
                e.stopPropagation();
                if (floatingTip.classList.contains('visible') && floatingTip._owner === btn) {
                    hideFloatingTip();
                } else {
                    showFloatingTip(btn, html);
                }
            });
        });

        document.addEventListener('click', hideFloatingTip);

        updateQuestionNav();
    }

    // ── Floating explanation tooltip (body-level, never clipped) ──
    function ensureFloatingTip() {
        let tip = $('sa-floating-tip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'sa-floating-tip';
            tip.setAttribute('role', 'tooltip');
            document.body.appendChild(tip);
        }
        return tip;
    }

    function showFloatingTip(btn, html) {
        const tip = ensureFloatingTip();
        tip.innerHTML = html;
        tip._owner = btn;
        tip.style.visibility = 'hidden';
        tip.classList.add('visible');

        const tw = tip.offsetWidth;
        const th = tip.offsetHeight;
        const r = btn.getBoundingClientRect();
        const m = 10;

        let left = r.left + r.width / 2 - tw / 2;
        left = Math.max(m, Math.min(left, window.innerWidth - tw - m));

        let top = r.bottom + 10;
        if (top + th > window.innerHeight - m) {
            const above = r.top - th - 10;
            top = above >= m ? above : Math.max(m, window.innerHeight - th - m);
        }

        tip.style.left = `${Math.round(left)}px`;
        tip.style.top = `${Math.round(top)}px`;
        tip.style.visibility = '';
    }

    function hideFloatingTip() {
        const tip = $('sa-floating-tip');
        if (tip) {
            tip.classList.remove('visible');
            tip._owner = null;
        }
    }

    function renderStepDots() {
        const dots = $('sa-step-dots');
        if (!dots) return;
        dots.innerHTML = '';
        CRITERIA.forEach((_, idx) => {
            const dot = document.createElement('span');
            dot.className = 'sa-step-dot';
            dot.dataset.index = idx;
            dots.appendChild(dot);
        });
    }

    function isQuestionAnswered(idx) {
        return answers[`c${idx}`] !== undefined;
    }

    function hideUnansweredWarning() {
        const warn = $('sa-unanswered-warn');
        if (warn) warn.classList.remove('visible');
    }

    function showUnansweredWarning() {
        const warn = $('sa-unanswered-warn');
        if (!warn) return;
        warn.textContent = 'Selecciona una respuesta antes de continuar.';
        warn.classList.add('visible');
        const card = document.querySelector(`.sa-question-slide[data-index="${currentQuestionIndex}"]`);
        card?.classList.add('needs-answer');
        setTimeout(() => card?.classList.remove('needs-answer'), 600);
        setTimeout(() => warn.classList.remove('visible'), 3200);
    }

    function restoreAnswersOnSlide(idx) {
        const card = document.querySelector(`.sa-question-slide[data-index="${idx}"]`);
        if (!card) return;
        const val = answers[`c${idx}`];
        if (val === undefined) return;
        const radio = card.querySelector(`input[type="radio"][value="${val}"]`);
        if (radio) radio.checked = true;
        card.classList.add('answered');
    }

    function showQuestion(index, direction) {
        currentQuestionIndex = index;
        const slides = document.querySelectorAll('.sa-question-slide');

        slides.forEach(slide => {
            slide.classList.remove('active', 'enter-forward', 'enter-back');
        });

        const target = slides[index];
        if (target) {
            target.classList.add('active');
            if (direction === 'forward') target.classList.add('enter-forward');
            if (direction === 'back') target.classList.add('enter-back');
            restoreAnswersOnSlide(index);
        }

        updateProgress();
        updateQuestionNav();
        updateStepDots();
        hideUnansweredWarning();
        hideFloatingTip();
    }

    function updateStepDots() {
        document.querySelectorAll('.sa-step-dot').forEach((dot, idx) => {
            dot.classList.toggle('current', idx === currentQuestionIndex);
            dot.classList.toggle('done', isQuestionAnswered(idx));
        });
    }

    function updateQuestionNav() {
        const total = CRITERIA.length;
        const isLast = currentQuestionIndex === total - 1;
        const answered = isQuestionAnswered(currentQuestionIndex);

        const prevBtn = $('sa-prev-btn');
        const nextBtn = $('sa-next-btn');
        const calcBtn = $('sa-calc-btn');

        if (prevBtn) prevBtn.disabled = currentQuestionIndex === 0;

        if (nextBtn) {
            nextBtn.hidden = isLast;
            nextBtn.disabled = !answered;
        }

        if (calcBtn) {
            calcBtn.hidden = !isLast;
            calcBtn.disabled = !answered;
        }
    }

    function goToPreviousQuestion() {
        if (currentQuestionIndex <= 0) return;
        showQuestion(currentQuestionIndex - 1, 'back');
    }

    function goToNextQuestion() {
        if (!isQuestionAnswered(currentQuestionIndex)) {
            showUnansweredWarning();
            return;
        }

        if (currentQuestionIndex >= CRITERIA.length - 1) return;
        showQuestion(currentQuestionIndex + 1, 'forward');
    }

    // ── Progress bar ──────────────────────────────────────────────
    function updateProgress() {
        const total = CRITERIA.length;
        const answered = Object.keys(answers).length;
        const stepPct = Math.round(((currentQuestionIndex + 1) / total) * 100);

        $('sa-progress-fill').style.width = stepPct + '%';

        const stepEl = $('sa-progress-step');
        if (stepEl) {
            stepEl.textContent = `Pregunta ${currentQuestionIndex + 1} de ${total}`;
        }

        const pctEl = $('sa-progress-pct');
        if (pctEl) pctEl.textContent = `${answered}/${total}`;
    }

    // ── Score calculation ─────────────────────────────────────────
    function calculateScore() {
        if (!isQuestionAnswered(currentQuestionIndex)) {
            showUnansweredWarning();
            return;
        }

        const answered = Object.keys(answers).length;
        if (answered < CRITERIA.length) {
            for (let i = 0; i < CRITERIA.length; i++) {
                if (!isQuestionAnswered(i)) {
                    showQuestion(i, i < currentQuestionIndex ? 'back' : 'forward');
                    showUnansweredWarning();
                    return;
                }
            }
        }

        // Map answers (1–4 scale) to score (3.0–5.0)
        const values = Object.values(answers);
        const mean = values.reduce((s, v) => s + v, 0) / values.length;
        // Likert 1–4 → grade 3.0–5.0: grade = 3.0 + ((mean-1)/(4-1)) * 2.0
        const raw = 3.0 + ((mean - 1) / 3) * 2.0;
        generatedScore = Math.round(raw * 10) / 10; // 1 decimal
        generatedScore = Math.min(5.0, Math.max(3.0, generatedScore));

        // Update result screen
        $('sa-score-display').textContent = generatedScore.toFixed(1);
        animateScoreRing(generatedScore);

        showScreen('result');
        setupResultButtons();
    }

    // ── Score ring animation ─────────────────────────────────────
    function animateScoreRing(score) {
        const circumference = 2 * Math.PI * 80; // r=80
        const pct = (score - 3.0) / 2.0;        // 3.0–5.0 → 0–1
        const offset = circumference * (1 - pct);
        const ring = $('sa-ring-fill');
        ring.style.strokeDasharray = circumference;
        ring.style.strokeDashoffset = circumference; // reset
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                ring.style.strokeDashoffset = offset;
            });
        });
    }

    // ── Result buttons ────────────────────────────────────────────
    function setupResultButtons() {
        $('sa-agree-btn').onclick = () => {
            decision = 'agree';
            adjustedScore = null;
            saveSubmission();
            triggerSparkles();
            showScreen('agree');
        };
        $('sa-disagree-btn').onclick = () => {
            decision = 'disagree';
            currentRadialScore = generatedScore;
            setupRadialPicker();
            showScreen('disagree');
        };
    }

    // ── Sparkle effect on agree ──────────────────────────────────
    function triggerSparkles() {
        const container = $('sa-agree-icon');
        const colors = ['#7678ed', '#f7b801', '#10b981', '#ef4444', '#a78bfa'];
        for (let i = 0; i < 12; i++) {
            const s = document.createElement('div');
            s.className = 'sa-sparkle';
            const angle = (i / 12) * 2 * Math.PI;
            const dist = 50 + Math.random() * 40;
            s.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
            s.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
            s.style.background = colors[i % colors.length];
            s.style.left = '50%'; s.style.top = '50%';
            s.style.transform = 'translate(-50%, -50%)';
            s.style.animationDelay = `${i * 0.07}s`;
            container.appendChild(s);
        }
        setTimeout(() => container.querySelectorAll('.sa-sparkle').forEach(s => s.remove()), 2000);
    }

    // ── Radial clock-style score picker ──────────────────────────
    function setupRadialPicker() {
        const SVG_NS = 'http://www.w3.org/2000/svg';
        const svg = $('sa-radial-svg');
        const CX = 140, CY = 140, R = 100;
        const MIN_SCORE = 3.0, MAX_SCORE = 5.0;
        const START_ANGLE = -220; // degrees from top (clockwise)
        const TOTAL_ARC = 260;    // degrees

        // Create gradient
        let defs = svg.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS(SVG_NS, 'defs');
            defs.innerHTML = `
                <linearGradient id="radialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#3d348b"/>
                    <stop offset="100%" stop-color="#7678ed"/>
                </linearGradient>`;
            svg.insertBefore(defs, svg.firstChild);
        }

        function scoreToAngle(score) {
            const pct = (score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);
            return START_ANGLE + pct * TOTAL_ARC;
        }

        function angleToScore(angle) {
            // Normalize angle to [-360, 360]
            let norm = ((angle - START_ANGLE) / TOTAL_ARC);
            norm = Math.min(1, Math.max(0, norm));
            const raw = MIN_SCORE + norm * (MAX_SCORE - MIN_SCORE);
            return Math.round(raw * 10) / 10;
        }

        function polarToXY(angleDeg, radius) {
            const rad = (angleDeg - 90) * Math.PI / 180;
            return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
        }

        function arcPath(startAngle, endAngle, r) {
            const s = polarToXY(startAngle, r);
            const e = polarToXY(endAngle, r);
            const large = (endAngle - startAngle > 180) ? 1 : 0;
            return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
        }

        // Draw ticks + labels (3.0 to 5.0 in 0.5 steps)
        const tickGroup = svg.querySelector('#sa-radial-ticks') || (() => {
            const g = document.createElementNS(SVG_NS, 'g');
            g.id = 'sa-radial-ticks';
            svg.appendChild(g);
            return g;
        })();
        tickGroup.innerHTML = '';
        for (let s = MIN_SCORE; s <= MAX_SCORE + 0.01; s += 0.5) {
            const angle = scoreToAngle(s);
            const outer = polarToXY(angle, R + 18);
            const inner = polarToXY(angle, R - 18);
            const tick = document.createElementNS(SVG_NS, 'line');
            tick.setAttribute('x1', inner.x); tick.setAttribute('y1', inner.y);
            tick.setAttribute('x2', outer.x); tick.setAttribute('y2', outer.y);
            tick.setAttribute('stroke', 'rgba(118,120,237,0.3)');
            tick.setAttribute('stroke-width', '2');
            tickGroup.appendChild(tick);

            const lbl = document.createElementNS(SVG_NS, 'text');
            const lpos = polarToXY(angle, R + 32);
            lbl.setAttribute('x', lpos.x); lbl.setAttribute('y', lpos.y);
            lbl.setAttribute('text-anchor', 'middle');
            lbl.setAttribute('dominant-baseline', 'middle');
            lbl.setAttribute('fill', '#9ca3af');
            lbl.setAttribute('font-size', '11');
            lbl.setAttribute('font-family', 'Reddit Sans, sans-serif');
            lbl.textContent = s.toFixed(1);
            tickGroup.appendChild(lbl);
        }

        // Draw track arc
        let trackEl = $('sa-radial-track-arc');
        if (!trackEl) {
            trackEl = document.createElementNS(SVG_NS, 'path');
            trackEl.id = 'sa-radial-track-arc';
            trackEl.setAttribute('fill', 'none');
            trackEl.setAttribute('stroke', 'rgba(118,120,237,0.15)');
            trackEl.setAttribute('stroke-width', '20');
            trackEl.setAttribute('stroke-linecap', 'round');
            svg.appendChild(trackEl);
        }
        trackEl.setAttribute('d', arcPath(START_ANGLE, START_ANGLE + TOTAL_ARC, R));

        // Draw filled arc
        let fillEl = $('sa-radial-fill-arc');
        if (!fillEl) {
            fillEl = document.createElementNS(SVG_NS, 'path');
            fillEl.id = 'sa-radial-fill-arc';
            fillEl.setAttribute('fill', 'none');
            fillEl.setAttribute('stroke', 'url(#radialGradient)');
            fillEl.setAttribute('stroke-width', '20');
            fillEl.setAttribute('stroke-linecap', 'round');
            svg.appendChild(fillEl);
        }

        // Draw thumb circle
        let thumbEl = $('sa-radial-thumb-el');
        if (!thumbEl) {
            thumbEl = document.createElementNS(SVG_NS, 'circle');
            thumbEl.id = 'sa-radial-thumb-el';
            thumbEl.setAttribute('r', '13');
            thumbEl.setAttribute('fill', 'white');
            thumbEl.setAttribute('stroke', '#7678ed');
            thumbEl.setAttribute('stroke-width', '3.5');
            thumbEl.setAttribute('filter', 'drop-shadow(0 4px 10px rgba(118,120,237,0.5))');
            thumbEl.style.cursor = 'grab';
            svg.appendChild(thumbEl);
        }

        // Center label
        let centerG = $('sa-radial-center-g');
        if (!centerG) {
            centerG = document.createElementNS(SVG_NS, 'g');
            centerG.id = 'sa-radial-center-g';
            svg.appendChild(centerG);
        }
        centerG.innerHTML = `
            <text id="sa-radial-val" text-anchor="middle" dominant-baseline="middle" 
                  x="${CX}" y="${CY - 10}" font-size="38" font-weight="800" 
                  font-family="Reddit Sans, sans-serif" fill="url(#radialGradient)">${currentRadialScore.toFixed(1)}</text>
            <text text-anchor="middle" dominant-baseline="middle" 
                  x="${CX}" y="${CY + 22}" font-size="12" font-weight="600"
                  font-family="Reddit Sans, sans-serif" fill="#9ca3af">mi nota</text>
        `;

        function updateUI() {
            const angle = scoreToAngle(currentRadialScore);
            const endAngle = Math.min(angle, START_ANGLE + TOTAL_ARC);
            fillEl.setAttribute('d', arcPath(START_ANGLE, endAngle, R));

            const thumbPos = polarToXY(angle, R);
            thumbEl.setAttribute('cx', thumbPos.x);
            thumbEl.setAttribute('cy', thumbPos.y);

            const valEl = $('sa-radial-val');
            if (valEl) valEl.textContent = currentRadialScore.toFixed(1);
            $('sa-radial-score-text').textContent = currentRadialScore.toFixed(1);
        }

        updateUI();

        // Drag interaction
        const container = $('sa-radial-container');
        let isDragging = false;

        function getAngleFromEvent(e) {
            const rect = container.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const dx = clientX - cx;
            const dy = clientY - cy;
            // angle from top (12-o'clock) clockwise
            let angle = Math.atan2(dx, -dy) * 180 / Math.PI;
            return angle;
        }

        function updateFromAngle(angle) {
            // Map raw angle to display angle range
            let displayAngle = angle;
            // START_ANGLE is relative to top (north), same convention
            // clamp to [START_ANGLE, START_ANGLE+TOTAL_ARC]
            let normalizedAngle = displayAngle - START_ANGLE;

            // Handle wrap-around
            if (normalizedAngle < -50) normalizedAngle += 360;
            normalizedAngle = Math.min(TOTAL_ARC, Math.max(0, normalizedAngle));

            const pct = normalizedAngle / TOTAL_ARC;
            const raw = MIN_SCORE + pct * (MAX_SCORE - MIN_SCORE);
            currentRadialScore = Math.round(raw * 10) / 10;
            currentRadialScore = Math.min(MAX_SCORE, Math.max(MIN_SCORE, currentRadialScore));
            updateUI();
        }

        container.addEventListener('mousedown', e => { isDragging = true; e.preventDefault(); });
        container.addEventListener('touchstart', e => { isDragging = true; }, { passive: true });

        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            updateFromAngle(getAngleFromEvent(e));
        });
        document.addEventListener('touchmove', e => {
            if (!isDragging) return;
            updateFromAngle(getAngleFromEvent(e));
        }, { passive: true });

        document.addEventListener('mouseup', () => { isDragging = false; });
        document.addEventListener('touchend', () => { isDragging = false; });

        // Confirm button
        $('sa-confirm-score-btn').onclick = () => {
            adjustedScore = currentRadialScore;
            saveSubmission();
            triggerSparkles2();
            // Show agree screen with different message
            $('sa-agree-note').textContent = `Tu nota ajustada fue: ${adjustedScore.toFixed(1)}`;
            $('sa-agree-note').style.display = 'block';
            showScreen('agree');
        };
    }

    function triggerSparkles2() {
        const container = $('sa-agree-icon');
        const colors = ['#7678ed', '#f7b801', '#10b981'];
        for (let i = 0; i < 8; i++) {
            const s = document.createElement('div');
            s.className = 'sa-sparkle';
            const angle = (i / 8) * 2 * Math.PI;
            const dist = 40 + Math.random() * 30;
            s.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
            s.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
            s.style.background = colors[i % colors.length];
            s.style.left = '50%'; s.style.top = '50%';
            s.style.transform = 'translate(-50%, -50%)';
            s.style.animationDelay = `${i * 0.07}s`;
            container.appendChild(s);
        }
        setTimeout(() => container.querySelectorAll('.sa-sparkle').forEach(s => s.remove()), 1500);
    }

    // ── Save submission ───────────────────────────────────────────
    function saveSubmission() {
        $('sa-agree-btn').disabled = true;
        $('sa-disagree-btn').disabled = true;
        const confirmBtn = $('sa-confirm-score-btn');
        if (confirmBtn) confirmBtn.disabled = true;

        const timestamp = new Date().toISOString();
        const answerLabels = {};
        CRITERIA.forEach((_, i) => {
            const val = answers[`c${i}`];
            const opt = LIKERT_OPTIONS.find(o => o.value === val);
            answerLabels[`c${i + 1}`] = opt ? opt.label : '';
        });

        const submission = {
            timestamp,
            name: studentName,
            group: studentGroup,
            answers: answerLabels,
            generatedScore,
            decision,
            adjustedScore: decision === 'disagree' ? adjustedScore : null
        };

        // Send to Google Apps Script Webhook
        if (APPS_SCRIPT_WEBHOOK_URL && APPS_SCRIPT_WEBHOOK_URL !== "") {
            fetch(APPS_SCRIPT_WEBHOOK_URL, {
                method: 'POST',
                // Using text/plain avoids CORS preflight issues in simple setups
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(submission)
            })
                .then(r => r.json())
                .then(data => {
                    console.log('[SelfAssessment] Saved to Sheets successfully:', data);
                })
                .catch(err => {
                    console.error('[SelfAssessment] Error saving to Sheets:', err);
                    showToast('Hubo un error guardando tu nota en línea. Avísale al profesor.', 'error');
                });
        }

        console.log('[SelfAssessment] Submission sent:', submission);
    }

    // ── Theme Engine ──────────────────────────────────────────────
    function setupThemes() {
        const fab = $('btn-theme-fab');
        const picker = $('theme-picker');
        const darkToggle = $('sa-dark-toggle');
        const darkIcon = $('sa-dark-icon');
        const swatches = document.querySelectorAll('.sa-theme-swatch');

        // Theme Definitions
        const themes = {
            'default': '#7b68ee', // medium-slate-blue
            'neon': '#00d4ff',
            'forest': '#208b5e',
            'winter': '#3498db',
            'candy': '#c026d3',
            'pastel': '#f472b6',
            'ocean': '#0284c7'
        };

        // Initialize from localStorage or default
        const currentTheme = localStorage.getItem('sa_theme') || 'default';
        const isDark = localStorage.getItem('sa_dark') === 'true';

        applyTheme(currentTheme);
        setDarkMode(isDark);

        // Toggle Picker
        if (fab && picker) {
            fab.addEventListener('click', (e) => {
                e.stopPropagation();
                picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
            });

            // Close Picker when clicking outside
            document.addEventListener('click', (e) => {
                if (!picker.contains(e.target) && e.target !== fab && !fab.contains(e.target)) {
                    picker.style.display = 'none';
                }
            });
        }

        // Dark Mode Toggle
        if (darkToggle) {
            darkToggle.addEventListener('click', () => {
                const newState = !document.body.classList.contains('dark-mode');
                setDarkMode(newState);
            });
        }

        // Theme Swatches
        if (swatches) {
            swatches.forEach(swatch => {
                swatch.addEventListener('click', () => {
                    const themeName = swatch.dataset.theme;
                    applyTheme(themeName);
                });
            });
        }

        function applyTheme(themeName) {
            const color = themes[themeName] || themes['default'];
            document.documentElement.style.setProperty('--medium-slate-blue', color);
            localStorage.setItem('sa_theme', themeName);

            // Update active swatch
            if (swatches) {
                swatches.forEach(s => {
                    if (s.dataset.theme === themeName) {
                        s.classList.add('active');
                    } else {
                        s.classList.remove('active');
                    }
                });
            }
        }

        function setDarkMode(active) {
            if (active) {
                document.body.classList.add('dark-mode');
                if (darkIcon) darkIcon.classList.replace('fa-moon', 'fa-sun');
            } else {
                document.body.classList.remove('dark-mode');
                if (darkIcon) darkIcon.classList.replace('fa-sun', 'fa-moon');
            }
            localStorage.setItem('sa_dark', active);
        }
    }


    // ── Toast ─────────────────────────────────────────────────────
    function showToast(msg, type = 'info') {
        const existing = document.querySelector('.sa-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `sa-toast ${type}`;
        const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 3500);
    }

    // ── Bootstrap ─────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for close-tab button
    window.saCloseTab = () => window.close();

})();
