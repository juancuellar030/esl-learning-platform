"use strict";

(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // HUD
  const s1El = document.getElementById("s1");
  const s2El = document.getElementById("s2");
  const spdEl = document.getElementById("spd");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const diffSel = document.getElementById("difficulty");
  const modeSel = document.getElementById("mode");

  // Colors from CSS custom props
  const COL = {
    bg: css("--panel", "#111827"),
    grid: css("--grid", "#1c2436"),
    paddle: css("--paddle", "#93c5fd"),
    ball: css("--ball", "#fbbf24"),
    text: css("--text", "#e5e7eb"),
  };
  function css(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  // Globals that change on resize
  let W = 800, H = 500, DPR = Math.max(1, window.devicePixelRatio || 1);
  let PADDLE_W, PADDLE_H, PADDLE_SPEED, BALL_SIZE, BASE_SPEED, MAX_SPEED;
  const WIN_SCORE = 11;
  const ASPECT = 16 / 10;     // keep 16:10 aspect
  const MARGIN_X = 0.03;      // paddle horizontal margin as % of width
  const SPEED_UP = 1.045;     // after each paddle hit

  // Difficulty presets (AI tuning independent of resolution)
  const DIFF = {
    Easy:   { aiMax: 180, follow: 0.08, reactX: 0.62 },
    Medium: { aiMax: 240, follow: 0.12, reactX: 0.50 },
    Hard:   { aiMax: 320, follow: 0.18, reactX: 0.40 },
  };

  // State
  let state;
  let running = true;
  let over = false;
  let last = 0, acc = 0, stepMs = 1000 / 120; // 120 ticks/s fixed

  // Audio (lazy init)
  let actx = null, gain;
  function initAudio() {
    if (actx) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      gain = actx.createGain();
      gain.gain.value = 0.06;
      gain.connect(actx.destination);
    } catch (e) {}
  }
  function beep(freq = 440, dur = 0.055) {
    if (!actx) return;
    const o = actx.createOscillator();
    o.type = "square"; o.frequency.value = freq; o.connect(gain);
    const t = actx.currentTime; o.start(t); o.stop(t + dur);
  }

  // Metrics recompute on resize
  function computeMetrics() {
    // Derive sizes from CSS size of canvas (logical pixels, not backing store)
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    W = cw; H = ch;
    DPR = Math.max(1, window.devicePixelRatio || 1);
    canvas.width  = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); // draw using CSS pixel coordinates

    // Scale game elements relative to viewport
    PADDLE_W     = Math.max(10, Math.round(W * 0.012));
    PADDLE_H     = Math.max(70, Math.round(H * 0.18));
    PADDLE_SPEED = Math.round(H * 0.72); // px/s
    BALL_SIZE    = Math.max(8, Math.round(Math.min(W, H) * 0.014));
    BASE_SPEED   = Math.round(W * 0.32);
    MAX_SPEED    = Math.round(W * 0.95);
  }

  // Resize canvas to fill available space with 16:10 aspect
  function layoutCanvas() {
    const card = canvas.parentElement; // grid column
    // available width is the column width; height constrained by viewport
    const maxW = Math.min(card.clientWidth, 1400);
    const maxH = Math.min(window.innerHeight * 0.82, 900);
    // fit 16:10
    let w = maxW, h = w / ASPECT;
    if (h > maxH) { h = maxH; w = h * ASPECT; }
    // apply CSS size (backing store size set in computeMetrics)
    canvas.style.width = `${Math.round(w)}px`;
    canvas.style.height = `${Math.round(h)}px`;
    computeMetrics();
  }

  // Helpers
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // Ball serve and reset
  function serve(toRight = true) {
    const angle = Math.random() * Math.PI / 3 - Math.PI / 6; // -30..+30°
    const dir = toRight ? 1 : -1;
    const speed = BASE_SPEED;
    state.ball = {
      x: W / 2 - BALL_SIZE / 2,
      y: H / 2 - BALL_SIZE / 2,
      vx: Math.cos(angle) * speed * dir,
      vy: Math.sin(angle) * speed,
      speed,
    };
  }

  function reset() {
    const margin = MARGIN_X * W;
    state = {
      p1: { x: margin, y: H / 2 - PADDLE_H / 2, vy: 0 },
      p2: { x: W - margin - PADDLE_W, y: H / 2 - PADDLE_H / 2, vy: 0 },
      ball: null,
      score1: 0,
      score2: 0,
      twoP: modeSel.value === "2p",
      diff: DIFF[diffSel.value],
    };
    serve(Math.random() < 0.5);
    running = true; over = false; updateHUD();
  }

  function updateHUD() {
    s1El.textContent = state.score1;
    s2El.textContent = state.score2;
    spdEl.textContent = (state.ball ? (state.ball.speed / BASE_SPEED).toFixed(2) : "1.00") + "x";
    pauseBtn.textContent = running ? "⏸ Pause" : "▶ Resume";
  }

  // Maintain positions/velocity across resizes
  function rescaleState(oldW, oldH) {
    if (!state || !state.ball) return;
    const sx = W / oldW, sy = H / oldH;
    const margin = MARGIN_X * W;

    // keep paddles at margins, scale Y
    state.p1.x = margin;
    state.p2.x = W - margin - PADDLE_W;
    state.p1.y = clamp(state.p1.y * sy, 0, H - PADDLE_H);
    state.p2.y = clamp(state.p2.y * sy, 0, H - PADDLE_H);

    // ball: preserve angle & speed fraction relative to BASE_SPEED
    const b = state.ball;
    const angle = Math.atan2(b.vy, b.vx);
    const frac = b.speed / (BASE_SPEED / sx); // rough continuity
    b.speed = frac * BASE_SPEED;
    b.x = clamp(b.x * sx, 0, W - BALL_SIZE);
    b.y = clamp(b.y * sy, 0, H - BALL_SIZE);
    const dir = Math.sign(Math.cos(angle)) || 1;
    b.vx = Math.cos(angle) * b.speed;
    b.vy = Math.sin(angle) * b.speed;
  }

  // Inputs
  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup","arrowdown","w","s","p","r"].includes(k)) e.preventDefault();
    if (k === "p") { running = !running; updateHUD(); initAudio(); return; }
    if (k === "r") { reset(); initAudio(); return; }
    keys.add(e.key); initAudio();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key));

  // Touch buttons (P1)
  document.querySelectorAll("[data-touch]").forEach((btn) => {
    const dir = btn.getAttribute("data-touch");
    let active = false, raf;
    const stepTouch = () => { if (!active) return; state.p1.vy = dir === "up" ? -PADDLE_SPEED : PADDLE_SPEED; raf = requestAnimationFrame(stepTouch); };
    const end = () => { active = false; state.p1.vy = 0; cancelAnimationFrame(raf); };
    btn.addEventListener("touchstart", (e) => { e.preventDefault(); active = true; stepTouch(); initAudio(); }, { passive: false });
    btn.addEventListener("touchend",   (e) => { e.preventDefault(); end(); }, { passive: false });
    btn.addEventListener("mousedown", () => { active = true; stepTouch(); initAudio(); });
    btn.addEventListener("mouseup", end);
    btn.addEventListener("mouseleave", end);
  });

  pauseBtn.addEventListener("click", () => { running = !running; updateHUD(); initAudio(); });
  resetBtn.addEventListener("click", () => { reset(); initAudio(); });
  diffSel.addEventListener("change", () => { state.diff = DIFF[diffSel.value]; });
  modeSel.addEventListener("change", () => { state.twoP = modeSel.value === "2p"; });

  // Physics update
  function fixedUpdate() {
    if (!running || over) return;
    const p1 = state.p1, p2 = state.p2, b = state.ball;

    // Keyboard control
    p1.vy = 0;
    if (keys.has("w") || keys.has("W")) p1.vy -= PADDLE_SPEED;
    if (keys.has("s") || keys.has("S")) p1.vy += PADDLE_SPEED;

    if (state.twoP) {
      p2.vy = 0;
      if (keys.has("ArrowUp")) p2.vy -= PADDLE_SPEED;
      if (keys.has("ArrowDown")) p2.vy += PADDLE_SPEED;
    } else {
      const d = state.diff;
      const react = b.vx > 0 && b.x > W * d.reactX;
      const target = react ? (b.y + BALL_SIZE / 2) : H / 2;
      const center = p2.y + PADDLE_H / 2;
      const delta = target - center;
      const desired = clamp(delta * d.follow, -d.aiMax, d.aiMax);
      p2.vy = desired;
    }

    // Move paddles
    p1.y = clamp(p1.y + p1.vy * (stepMs / 1000), 0, H - PADDLE_H);
    p2.y = clamp(p2.y + p2.vy * (stepMs / 1000), 0, H - PADDLE_H);

    // Move ball
    b.x += b.vx * (stepMs / 1000);
    b.y += b.vy * (stepMs / 1000);

    // Top/bottom walls
    if (b.y <= 0) { b.y = 0; b.vy *= -1; beep(700); }
    if (b.y + BALL_SIZE >= H) { b.y = H - BALL_SIZE; b.vy *= -1; beep(700); }

    // Paddle collisions
    // Left
    if (b.x <= state.p1.x + PADDLE_W && b.x >= state.p1.x && b.y + BALL_SIZE >= state.p1.y && b.y <= state.p1.y + PADDLE_H) {
      b.x = state.p1.x + PADDLE_W; collideWithPaddle(state.p1, false);
    }
    // Right
    if (b.x + BALL_SIZE >= state.p2.x && b.x + BALL_SIZE <= state.p2.x + PADDLE_W && b.y + BALL_SIZE >= state.p2.y && b.y <= state.p2.y + PADDLE_H) {
      b.x = state.p2.x - BALL_SIZE; collideWithPaddle(state.p2, true);
    }

    // Scoring
    if (b.x + BALL_SIZE < 0) { state.score2++; beep(240); pointScored(false); }
    else if (b.x > W) { state.score1++; beep(240); pointScored(true); }

    // Win condition
    if (state.score1 >= WIN_SCORE || state.score2 >= WIN_SCORE) { over = true; running = false; }
    updateHUD();
  }

  function pointScored(scoredByP1) { serve(!scoredByP1); }

  function collideWithPaddle(p, isRight) {
    const b = state.ball;
    const rel = ((b.y + BALL_SIZE / 2) - (p.y + PADDLE_H / 2)) / (PADDLE_H / 2); // [-1..1]
    const maxAngle = Math.PI / 3; // 60°
    const angle = rel * maxAngle;
    const dir = isRight ? -1 : 1;
    const speed = Math.min(b.speed * SPEED_UP, MAX_SPEED);
    b.vx = Math.cos(angle) * speed * dir;
    b.vy = Math.sin(angle) * speed;
    b.speed = speed;
    beep(520);
  }

  // Render
  function render() {
    // background
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, W, H);

    // center line
    ctx.strokeStyle = COL.grid;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // paddles
    ctx.fillStyle = COL.paddle;
    ctx.fillRect(state.p1.x, state.p1.y, PADDLE_W, PADDLE_H);
    ctx.fillRect(state.p2.x, state.p2.y, PADDLE_W, PADDLE_H);

    // ball
    ctx.fillStyle = COL.ball;
    ctx.fillRect(state.ball.x, state.ball.y, BALL_SIZE, BALL_SIZE);

    // overlay if over
    if (over) {
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = COL.text;
      ctx.textAlign = "center";
      ctx.font = "700 28px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      const winner = state.score1 > state.score2 ? "Player 1" : "Player 2";
      ctx.fillText(winner + " wins!", W / 2, H / 2 - 8);
      ctx.font = "500 16px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      ctx.fillText("Press R to restart", W / 2, H / 2 + 18);
    }

    // Scores (large)
    ctx.fillStyle = COL.text;
    ctx.textAlign = "center";
    ctx.font = "700 38px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
    ctx.fillText(String(state.score1), W / 2 - 60, 56);
    ctx.fillText(String(state.score2), W / 2 + 60, 56);
  }

  // Game loop
  function frame(t) {
    const dt = t - last; last = t; acc += dt;
    while (acc >= stepMs) { fixedUpdate(); acc -= stepMs; }
    render();
    requestAnimationFrame(frame);
  }

  // Handle window resize
  let firstLayout = true;
  function onResize() {
    const oldW = W, oldH = H;
    layoutCanvas();
    if (!firstLayout) rescaleState(oldW, oldH);
    firstLayout = false;
  }
  window.addEventListener("resize", onResize);

  // Boot
  layoutCanvas();
  reset();
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
})();
