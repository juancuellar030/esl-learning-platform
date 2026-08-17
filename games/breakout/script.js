"use strict";

(function () {
  // Canvas & HUD
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  const scoreEl = document.getElementById("score");
  const highEl  = document.getElementById("high");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Theme colors from CSS
  const COL = {
    bg: css("--panel","#ffffff"),
    grid: css("--grid","#e6e8f0"),
    text: css("--text","#0f172a"),
    paddle: css("--paddle","#111827"),
    ball: css("--ball","#ef4444"),
    bricks: [css("--b1","#60a5fa"), css("--b2","#34d399"), css("--b3","#fbbf24"),
             css("--b4","#f472b6"), css("--b5","#a78bfa"), css("--b6","#22d3ee")],
    power: css("--accent","#2563eb")
  };
  function css(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  // Game constants
  const PADDLE_W_BASE = 110, PADDLE_H = 14, PADDLE_SPEED = 520; // px/s
  const BALL_R = 6, BALL_SPEED_BASE = 360;                       // starting speed
  const MAX_DEFLECT_ANGLE = Math.PI * 0.78;                      // ~140°

  const BRICK_COLS = 12;
  const BRICK_ROWS_START = 6;
  const BRICK_GAP = 4;
  const BRICK_MARGIN_X = 20;
  const BRICK_MARGIN_TOP = 60;

  const SCORE_PER_BRICK = 10;

  // Power-ups
  const POWERUP_CHANCE = 0.18;        // 18% chance a destroyed brick drops a power-up
  const POWERUP_FALL_SPEED = 180;     // px/s
  const MAX_BALLS = 4;                // cap chaos 🙂
  const POWERUP_SIZE = {w: 28, h: 14};

  // State
  let state;
  let paused = false, over = false;
  let last = 0, acc = 0, stepMs = 1000/120; // 120 Hz fixed physics

  // Audio (tiny beeps)
  let actx = null, gain;
  function initAudio(){
    if(actx) return;
    try{
      actx = new (window.AudioContext||window.webkitAudioContext)();
      gain = actx.createGain(); gain.gain.value = 0.06; gain.connect(actx.destination);
    }catch(e){}
  }
  function beep(freq=440, dur=0.05, type="square"){
    if(!actx) return;
    const o = actx.createOscillator(); o.type=type; o.frequency.value=freq; o.connect(gain);
    const t=actx.currentTime; o.start(t); o.stop(t+dur);
  }

  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  const rand = (a,b)=>a + Math.random()*(b-a);

  function init(level=1, lives=3, score=0, high=Number(localStorage.getItem("breakout_high")||0)){
    const paddleW = Math.max(70, PADDLE_W_BASE - (level-1)*6);
    state = {
      level, lives, score, high,
      bricks: buildBricks(level),
      paddle: { w:paddleW, h:PADDLE_H, x: W/2 - paddleW/2, y: H-36, vx:0 },
      balls:  [ makeBall(W/2, H-36-BALL_R-2, 0, 0, true, BALL_SPEED_BASE + (level-1)*18) ],
      powerups: [],
      cleared: 0 // bricks destroyed this level
    };
    over=false; paused=false; updateHUD();
  }

  function makeBall(x,y,vx,vy,stuck,speed){
    return { x, y, vx, vy, r: BALL_R, stuck, speed };
  }

  function updateHUD(){
    scoreEl.textContent = state.score;
    livesEl.textContent = state.lives;
    levelEl.textContent = state.level;
    state.high = Math.max(state.high, state.score);
    try{ localStorage.setItem("breakout_high", String(state.high)); }catch(e){}
    highEl.textContent = state.high;
    pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause";
  }

  function buildBricks(level){
    const rows = BRICK_ROWS_START + Math.min(level-1, 4); // up to +4 rows by lvl 5
    const cols = BRICK_COLS;
    const usableW = W - BRICK_MARGIN_X*2 - BRICK_GAP*(cols-1);
    const bw = Math.floor(usableW / cols);
    const bricks = [];
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const x = BRICK_MARGIN_X + c*(bw+BRICK_GAP);
        const y = BRICK_MARGIN_TOP + r*(18+BRICK_GAP); // 18px tall bricks
        bricks.push({x,y,w:bw,h:18, alive:true, color: COL.bricks[r % COL.bricks.length]});
      }
    }
    return bricks;
  }

  // Input
  const keys = new Set();
  window.addEventListener("keydown", e=>{
    const k = (e.code==="Space") ? " " : e.key.toLowerCase();
    if(["arrowleft","arrowright","a","d"," ","p","r"].includes(k)) e.preventDefault();
    if(k==="p"){ paused=!paused; updateHUD(); initAudio(); return; }
    if(k==="r"){ init(1,3,0,state?.high||0); initAudio(); return; }
    if(k===" "){ launch(); initAudio(); return; }
    keys.add(k); initAudio();
  });
  window.addEventListener("keyup", e=>{
    const k = (e.code==="Space") ? " " : e.key.toLowerCase();
    keys.delete(k);
  });

  // Touch
  document.querySelectorAll("[data-touch]").forEach(btn=>{
    const type = btn.getAttribute("data-touch");
    let hold=false, raf;
    const step = ()=>{
      if(!hold) return;
      if(type==="left")  state.paddle.vx = -PADDLE_SPEED;
      if(type==="right") state.paddle.vx =  PADDLE_SPEED;
      if(type==="launch") launch();
      raf = requestAnimationFrame(step);
    };
    const start=(e)=>{ e.preventDefault(); hold=true; step(); initAudio(); };
    const end  =(e)=>{ e && e.preventDefault(); hold=false; state.paddle.vx=0; cancelAnimationFrame(raf); };
    btn.addEventListener("touchstart", start,{passive:false});
    btn.addEventListener("touchend",   end,  {passive:false});
    btn.addEventListener("mousedown",  start);
    btn.addEventListener("mouseup",    end);
    btn.addEventListener("mouseleave", end);
  });

  pauseBtn.addEventListener("click", ()=>{ paused=!paused; updateHUD(); initAudio(); });
  resetBtn.addEventListener("click", ()=>{ init(1,3,0,state?.high||0); initAudio(); });

  function launch(){
    // Launch the first stuck ball (if any)
    const b = state.balls.find(bb => bb.stuck);
    if(!b) return;
    const angle = rand(-0.35*Math.PI, -0.65*Math.PI); // mostly upward
    const speed = b.speed || BALL_SPEED_BASE;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.stuck = false;
    beep(720,.06);
  }

  // Physics helpers
  function update(){
    if(paused || over) return;

    const p = state.paddle;

    // Input → paddle velocity
    p.vx = 0;
    if(keys.has("arrowleft")||keys.has("a")) p.vx -= PADDLE_SPEED;
    if(keys.has("arrowright")||keys.has("d")) p.vx += PADDLE_SPEED;

    // Move paddle
    p.x = clamp(p.x + p.vx*(stepMs/1000), 8, W-8 - p.w);

    // Balls
    for(let bi = state.balls.length-1; bi>=0; bi--){
      const b = state.balls[bi];

      // Ball follow when stuck
      if(b.stuck){
        b.x = clamp(p.x + p.w/2, b.r+2, W-b.r-2);
        b.y = p.y - b.r - 2;
        continue;
      }

      // Move ball
      b.x += b.vx*(stepMs/1000);
      b.y += b.vy*(stepMs/1000);

      // Wall collisions
      if(b.x - b.r <= 0){ b.x = b.r; b.vx = Math.abs(b.vx); beep(420,.03); }
      if(b.x + b.r >= W){ b.x = W - b.r; b.vx = -Math.abs(b.vx); beep(420,.03); }
      if(b.y - b.r <= 0){ b.y = b.r; b.vy = Math.abs(b.vy); beep(420,.03); }

      // Bottom → remove this ball (life only if none remain)
      if(b.y - b.r > H){
        state.balls.splice(bi,1);
        if(state.balls.length === 0){
          loseLife();
        }
        continue;
      }

      // Paddle collision (circle vs rect)
      if(circleRectIntersect(b.x,b.y,b.r, p.x,p.y,p.w,p.h) && b.vy > 0){
        // position correction
        b.y = p.y - b.r - 0.5;

        // compute hit offset (-1 .. 1 across the paddle)
        const hit = (b.x - (p.x + p.w/2)) / (p.w/2);
        const clamped = clamp(hit, -1, 1);
        // deflect angle
        const angle = (-Math.PI/2) + clamped * (MAX_DEFLECT_ANGLE/2);
        const speed = Math.max(BALL_SPEED_BASE*0.85, Math.hypot(b.vx, b.vy)) * 1.02; // gentle ramp
        b.vx = Math.cos(angle)*speed;
        b.vy = Math.sin(angle)*speed;
        beep(520,.04);
      }

      // Brick collisions (at most one brick per tick per ball)
      for(let i=0;i<state.bricks.length;i++){
        const br = state.bricks[i];
        if(!br.alive) continue;
        if(circleRectIntersect(b.x,b.y,b.r, br.x,br.y,br.w,br.h)){
          // figure out primary axis of collision using penetration
          const overlapX = (b.x < br.x) ? (b.x + b.r - br.x)
                          : (br.x + br.w - (b.x - b.r));
          const overlapY = (b.y < br.y) ? (b.y + b.r - br.y)
                          : (br.y + br.h - (b.y - b.r));
          if(Math.abs(overlapX) < Math.abs(overlapY)){
            b.vx *= -1;
          } else {
            b.vy *= -1;
          }
          br.alive = false;
          state.cleared++;
          state.score += SCORE_PER_BRICK;
          // gentle speed ramp for THIS ball
          const add = Math.min(120, 10 + state.cleared*0.25);
          const sp = BALL_SPEED_BASE + (state.level-1)*18 + add;
          const dir = Math.atan2(b.vy,b.vx);
          b.vx = Math.cos(dir)*sp;
          b.vy = Math.sin(dir)*sp;
          beep(800,.03);

          // maybe drop a power-up
          if(Math.random() < POWERUP_CHANCE){
            spawnPowerup(br.x + br.w/2 - POWERUP_SIZE.w/2, br.y + br.h/2 - POWERUP_SIZE.h/2, "multi");
          }

          // next level?
          if(state.bricks.every(bk => !bk.alive)){
            nextLevel();
          }
          break; // only one brick per ball per tick
        }
      }
    }

    // Power-ups fall & collect
    for(let i=state.powerups.length-1;i>=0;i--){
      const u = state.powerups[i];
      u.y += POWERUP_FALL_SPEED * (stepMs/1000);
      // caught?
      if(rectsIntersect(u.x,u.y,u.w,u.h, state.paddle.x,state.paddle.y,state.paddle.w,state.paddle.h)){
        applyPowerup(u.type);
        state.powerups.splice(i,1);
        continue;
      }
      // missed?
      if(u.y > H + u.h){
        state.powerups.splice(i,1);
      }
    }
  }

  function spawnPowerup(x,y,type){
    state.powerups.push({x,y,w:POWERUP_SIZE.w,h:POWERUP_SIZE.h,type});
  }

  function applyPowerup(type){
    if(type==="multi"){
      activateMultiBall();
      beep(980,.08);
    }
  }

  function activateMultiBall(){
    // Don’t exceed MAX_BALLS
    const current = state.balls.length;
    if(current >= MAX_BALLS) return;

    // Base off the fastest non-stuck ball, else any ball
    let b = state.balls.find(bb=>!bb.stuck) || state.balls[0];
    if(!b) return;

    // Create up to 2 new balls, angled ±18°
    const toAdd = Math.min(2, MAX_BALLS - current);
    const dir = Math.atan2(b.vy,b.vx);
    const angles = (toAdd===2) ? [dir - 0.32, dir + 0.32] : [dir + 0.32];
    const speed = Math.max(BALL_SPEED_BASE, Math.hypot(b.vx,b.vy));

    for(const a of angles){
      state.balls.push(makeBall(b.x, b.y, Math.cos(a)*speed, Math.sin(a)*speed, false, speed));
    }
  }

  function loseLife(){
    state.lives--;
    updateHUD();
    if(state.lives <= 0){
      over = true; paused = false;
      return;
    }
    // reset to single stuck ball
    const p = state.paddle;
    state.balls = [ makeBall(p.x + p.w/2, p.y - BALL_R - 2, 0, 0, true, BALL_SPEED_BASE + (state.level-1)*18) ];
    beep(180,.06);
  }

  function nextLevel(){
    state.level++;
    state.paddle.w = Math.max(70, PADDLE_W_BASE - (state.level-1)*6);
    state.paddle.x = W/2 - state.paddle.w/2;
    state.cleared = 0;
    state.bricks = buildBricks(state.level);
    state.powerups = [];

    // reset to single stuck ball with slightly faster base
    const base = BALL_SPEED_BASE + (state.level-1)*18;
    state.balls = [ makeBall(state.paddle.x + state.paddle.w/2, state.paddle.y - BALL_R - 2, 0, 0, true, base) ];
    updateHUD();
  }

  // Geometry
  function circleRectIntersect(cx,cy,cr, rx,ry,rw,rh){
    const nx = clamp(cx, rx, rx+rw);
    const ny = clamp(cy, ry, ry+rh);
    const dx = cx - nx, dy = cy - ny;
    return (dx*dx + dy*dy) <= cr*cr;
  }
  function rectsIntersect(ax,ay,aw,ah, bx,by,bw,bh){
    return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
  }

  // Render
  function render(){
    // background + subtle grid
    ctx.fillStyle = COL.bg; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x=0;x<=W;x+=32){ ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,H); }
    for(let y=0;y<=H;y+=32){ ctx.moveTo(0,y+0.5); ctx.lineTo(W,y+0.5); }
    ctx.stroke();

    // bricks
    for(const br of state.bricks){
      if(!br.alive) continue;
      ctx.fillStyle = br.color;
      roundRect(ctx, br.x+1, br.y+1, br.w-2, br.h-2, 6);
      ctx.fill();
      // tiny glossy line
      ctx.fillStyle = "rgba(255,255,255,.25)";
      roundRect(ctx, br.x+3, br.y+3, br.w-6, Math.max(2, Math.floor(br.h/4)), 4);
      ctx.fill();
    }

    // paddle
    ctx.fillStyle = COL.paddle;
    roundRect(ctx, state.paddle.x, state.paddle.y, state.paddle.w, state.paddle.h, 8);
    ctx.fill();

    // power-ups
    for(const u of state.powerups){
      ctx.fillStyle = COL.power;
      roundRect(ctx, u.x, u.y, u.w, u.h, 7); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "700 11px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("★", u.x + u.w/2, u.y + u.h/2 + 4);
    }

    // balls (draw last so they’re on top)
    ctx.fillStyle = COL.ball;
    for(const b of state.balls){
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fill();
    }

    // overlays
    if(over || paused){
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle = COL.text; ctx.textAlign="center";
      ctx.font = "700 24px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      ctx.fillText(over ? "Game Over" : "Paused", W/2, H/2 - 10);
      ctx.font = "500 15px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      ctx.fillText(over ? "Press R to restart" : "Press P to resume", W/2, H/2 + 16);
    }

    // serve hint
    if(state.balls.some(b=>b.stuck) && !over && !paused){
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.textAlign="center";
      ctx.font = "600 14px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      ctx.fillText("Press Space or ● to launch — catch ★ for Multi-Ball", W/2, H/2);
    }
  }

  function roundRect(ctx,x,y,w,h,r){
    const rr=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
  }

  // Loop
  function frame(t){
    const dt = t - last; last = t; acc += dt;
    while(acc >= stepMs){ update(); acc -= stepMs; }
    render();
    requestAnimationFrame(frame);
  }

  // Boot
  init();
  requestAnimationFrame(t=>{ last=t; requestAnimationFrame(frame); });
})();
