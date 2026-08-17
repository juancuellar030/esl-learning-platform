"use strict";

(function () {
  // --- Config
  const GRID = 24;              // board is GRID x GRID cells
  const CELL = 20;              // px per cell (canvas size: GRID*CELL)
  const BASE_HZ = 8;            // base steps per second
  const SPEEDUP_FOOD = 4;       // speed up after this many foods
  const SPEED_FACTOR = 1.15;    // speed multiplier per stage
  const START_LEN = 4;

  // Background animation (set to false for a static colorful bg)
  const ANIMATE_BG = true;
  let hue = 200;                // start hue (0..360)

  // Setup canvas
  const c = document.getElementById("game");
  const ctx = c.getContext("2d");
  c.width = c.height = GRID * CELL;

  // HUD elements
  const scoreEl = document.getElementById("score");
  const highEl = document.getElementById("high");
  const speedEl = document.getElementById("speed");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Colors (adjusted grid to be semi-transparent for contrast on rainbow bg)
  const COL = {
    grid: "rgba(255,255,255,.18)",
    snake: getCss("--snake", "#6ee7b7"),
    head:  getCss("--head",  "#34d399"),
    food:  getCss("--food",  "#f472b6"),
  };
  function getCss(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  // Game state
  let state;
  let running = true;
  let tPrev = 0;
  let acc = 0;
  let stepMs;

  function rndCell() {
    return Math.floor(Math.random() * GRID);
  }

  function init() {
    const center = { x: Math.floor(GRID / 2), y: Math.floor(GRID / 2) };
    const body = [];
    for (let i = 0; i < START_LEN; i++) body.push({ x: center.x - i, y: center.y });
    stepMs = 1000 / BASE_HZ;
    state = {
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      snake: body,
      food: spawnFood(body),
      score: 0,
      eaten: 0,
      speedStage: 0,
      over: false,
    };
    updateHUD();
  }

  function spawnFood(occupied) {
    while (true) {
      const f = { x: rndCell(), y: rndCell() };
      if (!occupied.some((p) => p.x === f.x && p.y === f.y)) return f;
    }
  }

  function updateHUD() {
    scoreEl.textContent = state.score;
    const high = Math.max(Number(localStorage.getItem("snake_high") || 0), state.score);
    localStorage.setItem("snake_high", String(high));
    highEl.textContent = high;
    speedEl.textContent = Math.pow(SPEED_FACTOR, state.speedStage).toFixed(2) + "x";
    pauseBtn.textContent = running ? "⏸ Pause" : "▶ Resume";
  }

  function setDirection(nx, ny) {
    // prevent reversing directly into self
    if (nx === -state.dir.x && ny === -state.dir.y) return;
    state.nextDir = { x: nx, y: ny };
  }

  // Input
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "w"].includes(k)) setDirection(0, -1);
    else if (["arrowdown", "s"].includes(k)) setDirection(0, 1);
    else if (["arrowleft", "a"].includes(k)) setDirection(-1, 0);
    else if (["arrowright", "d"].includes(k)) setDirection(1, 0);
    else if (k === "p") togglePause();
    else if (k === "r") {
      init();
      running = true;
    }
  });

  document.querySelectorAll("[data-dir]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const d = btn.getAttribute("data-dir");
      if (d === "up") setDirection(0, -1);
      if (d === "down") setDirection(0, 1);
      if (d === "left") setDirection(-1, 0);
      if (d === "right") setDirection(1, 0);
    });
  });
  pauseBtn.addEventListener("click", togglePause);
  resetBtn.addEventListener("click", () => {
    init();
    running = true;
  });

  function togglePause() {
    running = !running;
    updateHUD();
  }

  // Game Loop (fixed timestep using rAF)
  function frame(t) {
    const dt = t - tPrev;
    tPrev = t;
    acc += dt;
    while (acc >= stepMs) {
      if (running && !state.over) {
        step();
      }
      acc -= stepMs;
    }
    render();
    requestAnimationFrame(frame);
  }

  function step() {
    // apply buffered direction
    state.dir = state.nextDir;

    const head = { x: state.snake[0].x + state.dir.x, y: state.snake[0].y + state.dir.y };

    // collisions: walls
    if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) {
      state.over = true;
      running = false;
      return;
    }
    // collisions: self
    if (state.snake.some((p) => p.x === head.x && p.y === head.y)) {
      state.over = true;
      running = false;
      return;
    }

    state.snake.unshift(head);

    // eat
    if (head.x === state.food.x && head.y === state.food.y) {
      state.score += 10;
      state.eaten += 1;
      if (state.eaten % SPEEDUP_FOOD === 0) {
        state.speedStage++;
        stepMs = stepMs / SPEED_FACTOR; // increase speed
      }
      state.food = spawnFood(state.snake);
    } else {
      state.snake.pop(); // move tail
    }

    updateHUD();
  }

  // Colorful gradient fill (animated)
  function fillColorfulBackground() {
    // three-stop diagonal gradient cycling through hues
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0.0, `hsl(${hue}, 75%, 14%)`);
    g.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 70%, 18%)`);
    g.addColorStop(1.0, `hsl(${(hue + 120) % 360}, 75%, 14%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);

    if (ANIMATE_BG) hue = (hue + 0.4) % 360; // slow, gentle shift
  }

  function render() {
    // colorful bg
    fillColorfulBackground();

    // grid (subtle, on top of gradient)
    ctx.strokeStyle = COL.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= GRID; i++) {
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, c.height);
      ctx.moveTo(0, i * CELL + 0.5);
      ctx.lineTo(c.width, i * CELL + 0.5);
    }
    ctx.stroke();

    // food
    drawCell(state.food.x, state.food.y, COL.food, 6);

    // snake
    state.snake.forEach((p, idx) => {
      drawCell(p.x, p.y, idx === 0 ? COL.head : COL.snake, idx === 0 ? 6 : 8);
    });

    // overlay if game over
    if (state.over) {
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "700 28px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      ctx.fillText("Game Over", c.width / 2, c.height / 2 - 8);
      ctx.font = "500 16px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      ctx.fillText("Press R to restart", c.width / 2, c.height / 2 + 18);
    }
  }

  function drawCell(x, y, color, r) {
    const px = x * CELL, py = y * CELL;
    const s = CELL;
    ctx.fillStyle = color;
    roundRect(ctx, px + 1, py + 1, s - 2, s - 2, r);
    ctx.fill();
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // boot
  init();
  requestAnimationFrame((t) => {
    tPrev = t;
    requestAnimationFrame(frame);
  });
})();
