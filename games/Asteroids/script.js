"use strict";

(function () {
  // --- Canvas & HUD
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  // --- Background image
const BG_ALPHA = 0.22; // ✨ opacity of the background (0 → invisible, 1 → solid)
const bgImg = new Image();
bgImg.src = "./spa.jpg";
let bgReady = false;
bgImg.onload = () => { bgReady = true; };

// Draw the image like CSS object-fit: cover (no squish)
function drawCover(img, ctx, x, y, w, h){
  const rImg = img.width / img.height;
  const rBox = w / h;
  let sx, sy, sw, sh;
  if (rBox > rImg) {
    sw = img.width; sh = img.width / rBox;
    sx = 0; sy = (img.height - sh) / 2;
  } else {
    sw = img.height * rBox; sh = img.height;
    sx = (img.width - sw) / 2; sy = 0;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}


  const scoreEl = document.getElementById("score");
  const highEl  = document.getElementById("high");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");

  // --- Colors from CSS
  const COL = {
    bg: css("--panel","#0b1017"),
    grid: css("--grid","#0f1824"),
    text: css("--text","#e6f2ff"),
    ship: css("--ship","#22d3ee"),
    flame: css("--flame","#f59e0b"),
    bullet: css("--bullet","#f43f5e"),
    rocks: [css("--rock1","#a3e635"), css("--rock2","#f472b6"), css("--rock3","#60a5fa")]
  };
  function css(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  // --- Game constants
  const SHIP_R = 14;
  const TURN_RATE = 3.6;         // rad/s
  const THRUST = 240;            // px/s^2
  const DAMPING = 0.992;         // velocity damping per frame tick

  const BULLET_SPEED = 520;      // px/s
  const BULLET_COOLDOWN = 200;   // ms
  const BULLET_LIFE = 900;       // ms

  const SPAWN_SAFE_RADIUS = 120; // no rocks spawn near the ship
  const RESPAWN_INVULN = 1500;   // ms

  // Asteroid tiers
  const TIER = {
    BIG:   { r: 44, score: 20, next: "MED", splits: 2 },
    MED:   { r: 28, score: 50, next: "SMALL", splits: 2 },
    SMALL: { r: 16, score: 100, next: null, splits: 0 },
  };

  // --- State
  let state;
  let paused=false, over=false;
  let last=0, acc=0, stepMs = 1000/120; // fixed physics
  let keys = new Set();

  // --- Audio (tiny beeps)
  let actx = null, gain;
  function initAudio(){
    if (actx) return;
    try{
      actx = new (window.AudioContext||window.webkitAudioContext)();
      gain = actx.createGain(); gain.gain.value = 0.07; gain.connect(actx.destination);
    }catch(e){}
  }
  function beep(freq=440, dur=0.05, type="square"){
    if(!actx) return;
    const o=actx.createOscillator(); o.type=type; o.frequency.value=freq; o.connect(gain);
    const t=actx.currentTime; o.start(t); o.stop(t+dur);
  }

  // --- Utils
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  const rand  = (a,b)=>a + Math.random()*(b-a);
  const wrap  = (x, max)=> (x<0? x+max: (x>max? x-max : x));

  // --- Init
  function init(level=1, lives=3, score=0){
    const high = Number(localStorage.getItem("asteroids_high")||0);
    state = {
      level, lives, score, high,
      ship: { x: W/2, y: H/2, a: -Math.PI/2, vx:0, vy:0, thrusting:false, cooldown:0, invulnMs:0 },
      bullets: [],
      rocks: [],
      particles: [],
    };
    spawnLevelRocks(level);
    over=false; paused=false; updateHUD();
  }
  function updateHUD(){
    scoreEl.textContent = state.score;
    livesEl.textContent = state.lives;
    levelEl.textContent = state.level;
    state.high = Math.max(state.high, state.score);
    try{ localStorage.setItem("asteroids_high", String(state.high)); }catch(e){}
    highEl.textContent = state.high;
    pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause";
  }

  function spawnLevelRocks(level){
    const base = 4 + Math.min(level-1, 4); // 4..8 big rocks
    for(let i=0;i<base;i++){
      spawnRock("BIG");
    }
  }
  function spawnRock(size, x=null, y=null){
    const spec = TIER[size];
    let rx = x, ry = y;
    if(rx===null || ry===null){
      // pick a spawn away from ship
      let ok=false;
      while(!ok){
        rx = rand(0,W); ry = rand(0,H);
        const d = Math.hypot(rx - state.ship.x, ry - state.ship.y);
        ok = d > SPAWN_SAFE_RADIUS;
      }
    }
    const speed = rand(40, 90);
    const dir = rand(0, Math.PI*2);
    const spin = rand(-1.2, 1.2);
    const verts = jaggedPolygon(spec.r, 10, 0.4);
    state.rocks.push({
      x:rx, y:ry, vx: Math.cos(dir)*speed, vy: Math.sin(dir)*speed,
      a: rand(0,Math.PI*2), spin, r: spec.r, size, verts, color: COL.rocks[Math.floor(Math.random()*COL.rocks.length)]
    });
  }

  function jaggedPolygon(radius, points, jag){
    // returns an array of [rMult, angle] pairs to draw an irregular rock
    const v=[];
    for(let i=0;i<points;i++){
      const ang = (i/points)*Math.PI*2;
      const rm = 1 - jag + Math.random()*jag*2;
      v.push([radius*rm, ang]);
    }
    return v;
  }

  // --- Input
  window.addEventListener("keydown", e=>{
    const k = (e.code==="Space") ? " " : e.key.toLowerCase();
    if(["arrowleft","arrowright","arrowup","a","d","w"," ","p","r"].includes(k)) e.preventDefault();
    if(k==="p"){ paused=!paused; updateHUD(); initAudio(); return; }
    if(k==="r"){ init(); initAudio(); return; }
    if(k===" "){ fire(); initAudio(); return; }
    keys.add(k); initAudio();
  });
  window.addEventListener("keyup", e=>{
    const k = (e.code==="Space") ? " " : e.key.toLowerCase();
    keys.delete(k);
  });

  // Touch controls
  document.querySelectorAll("[data-touch]").forEach(btn=>{
    const type = btn.getAttribute("data-touch");
    let hold=false, raf;
    const step=()=>{
      if(!hold) return;
      if(type==="left")  keys.add("left_touch");
      if(type==="right") keys.add("right_touch");
      if(type==="thrust"){ state.ship.thrusting = true; }
      if(type==="fire") fire();
      raf=requestAnimationFrame(step);
    };
    const start=(e)=>{ e.preventDefault(); hold=true; step(); initAudio(); };
    const end=(e)=>{ e && e.preventDefault(); hold=false; keys.delete("left_touch"); keys.delete("right_touch"); state.ship.thrusting=false; cancelAnimationFrame(raf); };
    btn.addEventListener("touchstart",start,{passive:false});
    btn.addEventListener("touchend",end,{passive:false});
    btn.addEventListener("mousedown",start);
    btn.addEventListener("mouseup",end);
    btn.addEventListener("mouseleave",end);
  });

  pauseBtn.addEventListener("click", ()=>{ paused=!paused; updateHUD(); initAudio(); });
  resetBtn.addEventListener("click", ()=>{ init(); initAudio(); });

  // --- Fire
  function fire(){
    const s = state.ship;
    if(s.cooldown>0) return;
    const dirx = Math.cos(s.a), diry = Math.sin(s.a);
    const x = s.x + dirx * (SHIP_R+4);
    const y = s.y + diry * (SHIP_R+4);
    const vx = s.vx + dirx * BULLET_SPEED;
    const vy = s.vy + diry * BULLET_SPEED;
    state.bullets.push({x,y,vx,vy,life:BULLET_LIFE});
    s.cooldown = BULLET_COOLDOWN;
    beep(760,.05);
  }

  // --- Mechanics
  function update(){
    if(paused || over) return;
    const s = state.ship;

    // Input → rotation & thrust
    const left = keys.has("arrowleft") || keys.has("a") || keys.has("left_touch");
    const right= keys.has("arrowright")|| keys.has("d") || keys.has("right_touch");
    const thr  = keys.has("arrowup")   || keys.has("w") || s.thrusting;

    if(left)  s.a -= TURN_RATE * (stepMs/1000);
    if(right) s.a += TURN_RATE * (stepMs/1000);

    if(thr){
      s.vx += Math.cos(s.a) * THRUST * (stepMs/1000);
      s.vy += Math.sin(s.a) * THRUST * (stepMs/1000);
    }

    // damping
    s.vx *= DAMPING; s.vy *= DAMPING;

    // move ship + wrap
    s.x += s.vx*(stepMs/1000); s.y += s.vy*(stepMs/1000);
    s.x = wrap(s.x, W); s.y = wrap(s.y, H);

    // timers
    if(s.cooldown>0) s.cooldown = Math.max(0, s.cooldown - stepMs);
    if(s.invulnMs>0) s.invulnMs = Math.max(0, s.invulnMs - stepMs);

    // bullets
    for(let i=state.bullets.length-1;i>=0;i--){
      const b = state.bullets[i];
      b.x += b.vx*(stepMs/1000); b.y += b.vy*(stepMs/1000);
      b.x = wrap(b.x, W); b.y = wrap(b.y, H);
      b.life -= stepMs;
      if(b.life<=0){ state.bullets.splice(i,1); }
    }

    // rocks
    for(const r of state.rocks){
      r.x += r.vx*(stepMs/1000); r.y += r.vy*(stepMs/1000);
      r.x = wrap(r.x, W); r.y = wrap(r.y, H);
      r.a += r.spin*(stepMs/1000);
    }

    // collisions: bullets vs rocks
    for(let i=state.bullets.length-1;i>=0;i--){
      const b = state.bullets[i];
      for(let j=state.rocks.length-1;j>=0;j--){
        const r = state.rocks[j];
        if(dist(b.x,b.y, r.x,r.y) <= r.r){
          // hit!
          state.bullets.splice(i,1);
          splitRock(j);
          state.score += TIER[r.size].score;
          beep(520,.05);
          break;
        }
      }
    }

    // collisions: ship vs rocks
    if(s.invulnMs<=0){
      for(const r of state.rocks){
        if(dist(s.x,s.y, r.x,r.y) <= r.r + SHIP_R*0.8){
          // boom
          loseLife();
          break;
        }
      }
    }

    // next level?
    if(state.rocks.length===0){
      state.level++;
      spawnLevelRocks(state.level);
      updateHUD();
    }
  }

  function splitRock(index){
    const r = state.rocks[index];
    const tier = TIER[r.size];
    // explosion particles
    spawnParticles(r.x, r.y, r.color);
    // remove current
    state.rocks.splice(index,1);
    // spawn children
    if(!tier.next) return;
    for(let i=0;i<tier.splits;i++){
      const ang = rand(0, Math.PI*2);
      const speed = rand(60, 120);
      const child = {
        x: r.x + Math.cos(ang)*8,
        y: r.y + Math.sin(ang)*8,
        vx: Math.cos(ang)*speed,
        vy: Math.sin(ang)*speed,
        a: rand(0,Math.PI*2),
        spin: rand(-1.8,1.8),
        r: TIER[tier.next].r,
        size: tier.next,
        verts: jaggedPolygon(TIER[tier.next].r, 10, 0.45),
        color: r.color
      };
      state.rocks.push(child);
    }
  }

  function loseLife(){
    state.lives--;
    updateHUD();
    if(state.lives<=0){ over=true; paused=false; return; }
    // reset ship
    state.ship.x = W/2; state.ship.y = H/2; state.ship.vx = 0; state.ship.vy = 0; state.ship.a = -Math.PI/2;
    state.ship.invulnMs = RESPAWN_INVULN;
    state.ship.cooldown = 0;
    // clear bullets
    state.bullets.length = 0;
    beep(220,.08);
  }

  // particles
  function spawnParticles(x,y,color){
    for(let i=0;i<18;i++){
      const ang = rand(0,Math.PI*2), sp = rand(60,220);
      state.particles.push({
        x, y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, life: 500+Math.random()*400, color
      });
    }
  }
  function withAlpha(hex, alpha){
    const h = hex.replace('#','');
    const full = h.length===3 ? h.split('').map(c=>c+c).join('') : h;
    const n = parseInt(full,16);
    const r = (n>>16)&255, g = (n>>8)&255, b = n&255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  

  // distance
  function dist(x1,y1,x2,y2){ const dx=x2-x1, dy=y2-y1; return Math.hypot(dx,dy); }

  // --- Render
  function render(){
    // background & faint grid
    // background
ctx.clearRect(0,0,W,H);
if (bgReady) {
  ctx.save();
  ctx.globalAlpha = BG_ALPHA;    // ← control opacity here
  drawCover(bgImg, ctx, 0, 0, W, H);
  ctx.restore();
} else {
  // fallback color until image loads
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0,0,W,H);
}


    // particles
    for(let i=state.particles.length-1;i>=0;i--){
      const p = state.particles[i];
      p.x += p.vx*(stepMs/1000); p.y += p.vy*(stepMs/1000);
      p.vx *= 0.99; p.vy *= 0.99;
      p.life -= stepMs;
      ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life/900);
      ctx.fillRect(p.x, p.y, 2, 2);
      ctx.globalAlpha = 1;
      if(p.life<=0) state.particles.splice(i,1);
    }

    // rocks
    // rocks (glowy)
for (const r of state.rocks) {
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.a);

  // Build the rock path once
  ctx.beginPath();
  for (let i = 0; i < r.verts.length; i++) {
    const [rv, ang] = r.verts[i];
    const x = Math.cos(ang) * rv, y = Math.sin(ang) * rv;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();

  // 1) Outer halo (additive + shadow blur)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = 6;                 // halo thickness
  ctx.shadowColor = r.color;         // glow color = rock color
  ctx.shadowBlur = 18;               // glow radius
  ctx.strokeStyle = withAlpha(r.color, 0.18);
  ctx.stroke();
  ctx.restore();

  // 2) Core neon outline
  ctx.lineWidth = 2;
  ctx.shadowBlur = 0;
  ctx.strokeStyle = r.color;
  ctx.stroke();

  ctx.restore();
}


    // bullets
    ctx.fillStyle = COL.bullet;
    for(const b of state.bullets){ ctx.fillRect(b.x-1.5, b.y-1.5, 3, 3); }

    // ship
    const s = state.ship;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.a);
    // invulnerability blink
    if(s.invulnMs>0 && Math.floor(s.invulnMs/120)%2===0) ctx.globalAlpha = 0.5;

    // ship body (triangle)
    ctx.strokeStyle = COL.ship; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(SHIP_R, 0);
    ctx.lineTo(-SHIP_R*0.8, SHIP_R*0.6);
    ctx.lineTo(-SHIP_R*0.8, -SHIP_R*0.6);
    ctx.closePath(); ctx.stroke();

    // flame when thrusting
    if(s.thrusting || keys.has("arrowup") || keys.has("w")){
      ctx.strokeStyle = COL.flame;
      ctx.beginPath();
      ctx.moveTo(-SHIP_R*0.8, 0);
      ctx.lineTo(-SHIP_R*1.2, 0);
      ctx.stroke();
    }
    ctx.restore();

    // overlays
    if(over || paused){
      ctx.fillStyle="rgba(0,0,0,.45)"; ctx.fillRect(0,0,W,H);
      ctx.fillStyle=COL.text; ctx.textAlign="center";
      ctx.font="700 26px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      ctx.fillText(over?"Game Over":"Paused", W/2, H/2 - 8);
      ctx.font="500 16px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      ctx.fillText(over?"Press R to restart":"Press P to resume", W/2, H/2 + 18);
    }
  }

  // --- Loop
  function frame(t){
    const dt = t - last; last = t; acc += dt;
    while(acc >= stepMs){ update(); acc -= stepMs; }
    render();
    requestAnimationFrame(frame);
  }

  // --- Boot
  init();
  requestAnimationFrame(t=>{ last=t; requestAnimationFrame(frame); });
})();
