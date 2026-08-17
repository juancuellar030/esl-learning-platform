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

  // Colors from CSS
  const COL = {
    bg: css("--panel","#0d1224"),
    grid: css("--grid","#131a33"),
    text: css("--text","#e6f2ff"),
    maze: css("--maze","#1e3a8a"),
    dot: css("--dot","#f8fafc"),
    power: css("--power","#fde047"),
    pac: css("--pac","#facc15"),
    fright: css("--ghostFright","#60a5fa"),
    eyes: css("--eyes","#94a3b8"),
    blink: css("--blinky","#ef4444"),
    pink:  css("--pinky","#f472b6"),
    inky:  css("--inky","#22d3ee"),
    clyde: css("--clyde","#f59e0b"),
  };
  function css(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }
  // helpers for glow
  function withAlpha(hex, alpha){
    const h = hex.replace('#',''); const full = h.length===3 ? h.split('').map(c=>c+c).join('') : h;
    const n = parseInt(full,16); const r=(n>>16)&255, g=(n>>8)&255, b=n&255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // Grid
  const TILE = 24; // px
  const COLS = Math.floor(W / TILE); // 28
  const ROWS = Math.floor(H / TILE); // 21

  // Speeds (px/s)
  const SPEED_PAC_BASE = 95;
  const SPEED_GHOST_BASE = 80;
  const SPEED_GHOST_FRIGHT = 60;

  // Timers
  const FRIGHT_TIME = 7000; // ms

  // Map legend: # wall, . dot, o power, P pac spawn, G gate (eyes-only), H ghost spawn, ' ' empty
  const MAP = [
    "############################",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#o####.#####.##.#####.####o#",
    "#.####.#####.##.#####.####.#",
    "#..........................#",
    "#.####.##.########.##.####.#",
    "#.####.##.########.##.####.#",
    "#......##....##....##......#",
    "######.##### ## #####.######",
    "G   H#.H          H.#H   G ", // 4 H spawns in the house row
    "######.##### ## #####.######",
    "#......##....##....##......#",
    "#.####.##.########.##.####.#",
    "#.####.##.########.##.####.#",
    "#..P....................P..#",
    "##.####.#####.##.#####.###.#",
    "#.......#####.##.#####....##",
    "#.########################.#",
    "#..........................#",
    "############################",
  ];

  // State
  let state;
  let paused=false, over=false;
  let last=0, acc=0, stepMs=1000/120;

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
    const o=actx.createOscillator(); o.type=type; o.frequency.value=freq; o.connect(gain);
    const t=actx.currentTime; o.start(t); o.stop(t+dur);
  }

  function init(level=1, lives=3, score=0){
    const high = Number(localStorage.getItem("pacman_high")||0);
    const dots = new Set();
    const powers = new Set();
    let pacSpawns = [];
    let houseSpawns = [];

    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        const ch = MAP[r][c];
        const k = key(c,r);
        if(ch === ".") dots.add(k);
        if(ch === "o") powers.add(k);
        if(ch === "P") pacSpawns.push({x:c*TILE+TILE/2,y:r*TILE+TILE/2});
        if(ch === "H") houseSpawns.push({x:c*TILE+TILE/2,y:r*TILE+TILE/2});
      }
    }
    const pacSpawn = pacSpawns[0] || {x: W/2, y:H-3*TILE};

    state = {
      level, lives, score, high,
      dots, powers,
      frightMs: 0, eatenInChain: 0,
      pac: makeActor(pacSpawn.x, pacSpawn.y, SPEED_PAC_BASE + (level-1)*4),
      ghosts: makeGhosts(houseSpawns),
    };
    over=false; paused=false; updateHUD();
  }

  function makeActor(x,y,speed){
    return { x, y, dir:{x:0,y:0}, want:{x:0,y:0}, speed, radius: 9, mouth:0 };
  }

  function makeGhosts(spawns){
    // corners for scatter (c,r)
    const corners = [
      {c:COLS-2, r:1},   // Blinky top-right
      {c:1,       r:1},   // Pinky top-left
      {c:COLS-2, r:ROWS-2}, // Inky bottom-right
      {c:1,       r:ROWS-2}, // Clyde bottom-left
    ];
    const names = ["blinky","pinky","inky","clyde"];
    const colors = [COL.blink, COL.pink, COL.inky, COL.clyde];
    const gs=[];
    for(let i=0;i<4;i++){
      const s = spawns[i] || {x: W/2, y:H/2};
      gs.push({
        name: names[i], color: colors[i],
        x:s.x, y:s.y, dir: {x:1,y:0}, speed: SPEED_GHOST_BASE,
        radius: 10, mode: "scatter", spawn: s, eyesOnly:false,
        corner: corners[i]
      });
    }
    return gs;
  }

  function updateHUD(){
    scoreEl.textContent = state.score;
    livesEl.textContent = state.lives;
    levelEl.textContent = state.level;
    state.high = Math.max(state.high, state.score);
    try{ localStorage.setItem("pacman_high", String(state.high)); }catch(e){}
    highEl.textContent = state.high;
    pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause";
  }

  // Input
  const keys = new Set();
  window.addEventListener("keydown", e=>{
    const k = e.key.toLowerCase();
    if(["arrowleft","arrowright","arrowup","arrowdown","w","a","s","d","p","r"].includes(k)) e.preventDefault();
    if(k==="p"){ paused=!paused; updateHUD(); initAudio(); return; }
    if(k==="r"){ init(); initAudio(); return; }
    if(["arrowleft","a"].includes(k)) setWant(-1,0);
    if(["arrowright","d"].includes(k)) setWant(1,0);
    if(["arrowup","w"].includes(k)) setWant(0,-1);
    if(["arrowdown","s"].includes(k)) setWant(0,1);
    initAudio();
  });
  function setWant(dx,dy){ state.pac.want = {x:dx,y:dy}; }

  // Touch
  document.querySelectorAll("[data-touch]").forEach(btn=>{
    const type = btn.getAttribute("data-touch");
    const map = {left:[-1,0], right:[1,0], up:[0,-1], down:[0,1]};
    btn.addEventListener("click", e=>{
      const v = map[type]; if(!v) return; setWant(v[0],v[1]); initAudio();
    });
    btn.addEventListener("touchstart", e=>{
      e.preventDefault(); const v = map[type]; if(!v) return; setWant(v[0],v[1]); initAudio();
    }, {passive:false});
  });
  pauseBtn.addEventListener("click", ()=>{ paused=!paused; updateHUD(); initAudio(); });
  resetBtn.addEventListener("click", ()=>{ init(); initAudio(); });

  // Helpers
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  const nearCenter = (pos)=> Math.abs((pos % TILE) - TILE/2) < 1.5;
  const cell = (x,y)=>({ c: Math.floor(x / TILE), r: Math.floor(y / TILE) });
  const key  = (c,r)=>`${c},${r}`;
  const wrapV = (v,max)=> (v<0? v+max : (v>=max? v-max : v));

  function isWall(c,r){
    if(c<0||c>=COLS||r<0||r>=ROWS) return true;
    return MAP[r][c] === "#" || MAP[r][c] === "G"; // G acts as wall for everyone but "eyes"
  }
  function isGate(c,r){ return MAP[r][c]==="G"; }

  // Mechanics
  function update(){
    if(paused || over) return;

    // Timers
    if(state.frightMs>0) state.frightMs = Math.max(0, state.frightMs - stepMs);

    updatePac();
    for(const g of state.ghosts) updateGhost(g);

    // Win: no dots left
    if(state.dots.size===0 && state.powers.size===0){
      nextLevel();
    }
  }

  function updatePac(){
    const p = state.pac;

    // turning logic at tile centers only
    if(p.want.x !== p.dir.x || p.want.y !== p.dir.y){
      if(nearCenter(p.x) && nearCenter(p.y)){
        const {c,r} = cell(p.x, p.y);
        const nc = c + p.want.x, nr = r + p.want.y;
        if(!isWall(nc,nr)){ p.dir = { ...p.want }; }
      }
    }

    // move; block by walls
    let nx = p.x + p.dir.x * p.speed * (stepMs/1000);
    let ny = p.y + p.dir.y * p.speed * (stepMs/1000);

    // wrap tunnels
    nx = wrapV(nx, W); ny = wrapV(ny, H);

    // collision with walls: check next cell edges
    const nextC = cell(nx, ny);
    const cx = Math.floor((nx + (p.dir.x>0? p.radius : -p.radius)) / TILE);
    const cy = Math.floor((ny + (p.dir.y>0? p.radius : -p.radius)) / TILE);
    if(p.dir.x!==0 && isWall(cx, nextC.r)) nx = p.x; // block X
    if(p.dir.y!==0 && isWall(nextC.c, cy)) ny = p.y; // block Y

    p.x = nx; p.y = ny;

    // mouth animation
    const phase = (Date.now()/100) % (Math.PI*2);
    p.mouth = 0.18 + 0.12*Math.sin(phase);

    // eat dots / powers
    const {c,r} = cell(p.x,p.y);
    const k = key(c,r);
    if(state.dots.has(k)){
      state.dots.delete(k);
      state.score += 10;
      beep(640,.03);
    }
    if(state.powers.has(k)){
      state.powers.delete(k);
      state.score += 50;
      state.frightMs = FRIGHT_TIME;
      state.eatenInChain = 0; // reset chain for ghost multipliers
      // set all non-eyes ghosts frightened
      for(const g of state.ghosts){ if(g.mode!=="eyes") g.mode = "fright"; }
      beep(320,.06);
    }

    // collisions with ghosts
    for(const g of state.ghosts){
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if(d < p.radius + g.radius - 2){
        if(g.mode === "fright"){
          // eat ghost → eyes mode returns to house
          g.mode = "eyes";
          g.speed = SPEED_GHOST_BASE + 40;
          // chained score: 200, 400, 800, 1600...
          const award = 200 * (2 ** state.eatenInChain);
          state.eatenInChain = Math.min(3, state.eatenInChain + 1);
          state.score += award;
          beep(860,.06);
        } else if(g.mode !== "eyes"){
          loseLife();
          return; // stop checking others this tick
        }
      }
    }
  }

  function updateGhost(g){
    const p = state.pac;

    // set speed by mode
    g.speed = (g.mode==="fright") ? SPEED_GHOST_FRIGHT
            : (g.mode==="eyes")   ? SPEED_GHOST_BASE + 40
            : SPEED_GHOST_BASE + (state.level-1)*3;

    // at tile center, choose dir
    if(nearCenter(g.x) && nearCenter(g.y)){
      const {c,r} = cell(g.x,g.y);
      // target
      let target = null;

      if(g.mode === "eyes"){
        target = cell(g.spawn.x, g.spawn.y); // go home through gates
      } else if(state.frightMs>0){
        // wander randomly in frightened (avoid reverse if possible)
        const dirs = openDirs(c,r, {x:-g.dir.x, y:-g.dir.y});
        g.dir = dirs[Math.floor(Math.random()*dirs.length)] || g.dir;
        // small chance to reverse
        if(Math.random()<0.05) g.dir = {x:-g.dir.x,y:-g.dir.y};
      } else {
        // scatter/chase personalities
        const pc = cell(p.x,p.y);
        const pd = p.dir;

        if(g.name==="blinky"){
          // direct chase to Pac
          target = pc;
        } else if(g.name==="pinky"){
          // 4 tiles ahead of Pac
          target = { c: pc.c + pd.x*4, r: pc.r + pd.y*4 };
        } else if(g.name==="inky"){
          // vector: from Blinky to a point 2 ahead of Pac, doubled
          const blinky = state.ghosts.find(x=>x.name==="blinky") || g;
          const inFront = { c: pc.c + pd.x*2, r: pc.r + pd.y*2 };
          const v = { c: inFront.c - cell(blinky.x,blinky.y).c,
                      r: inFront.r - cell(blinky.x,blinky.y).r };
          target = { c: inFront.c + v.c, r: inFront.r + v.r };
        } else if(g.name==="clyde"){
          // if near Pac (<=6 tiles) scatter to corner, else chase Pac
          const dTiles = Math.hypot(g.x - p.x, g.y - p.y) / TILE;
          target = (dTiles <= 6) ? g.corner : pc;
        }

        // pick direction greedily (not reverse if possible)
        g.dir = chooseGreedyDir(c,r, clampTarget(target).c, clampTarget(target).r, g.dir);
      }

      // reached house center in eyes mode → respawn normal
      if(g.mode==="eyes"){
        const gc = cell(g.x,g.y), sc = cell(g.spawn.x,g.spawn.y);
        if(gc.c===sc.c && gc.r===sc.r){
          g.mode = "scatter"; g.dir = {x:1,y:0};
        }
      }
    }

    // move with walls & gate rules
    let nx = g.x + g.dir.x * g.speed * (stepMs/1000);
    let ny = g.y + g.dir.y * g.speed * (stepMs/1000);
    nx = wrapV(nx, W); ny = wrapV(ny, H);

    const nextC = cell(nx, ny);
    const cx = Math.floor((nx + (g.dir.x>0? g.radius : -g.radius)) / TILE);
    const cy = Math.floor((ny + (g.dir.y>0? g.radius : -g.radius)) / TILE);

    // Gates block unless eyes mode
    const gateAhead = (MAP[nextC.r] && MAP[nextC.r][nextC.c] === "G") ||
                      (MAP[cy] && MAP[cy][cx] === "G");
    const hitWall = (g.dir.x!==0 && isWall(cx, nextC.r)) || (g.dir.y!==0 && isWall(nextC.c, cy));

    if((gateAhead && g.mode!=="eyes") || hitWall){
      // stop and pick a new dir next tick
      g.x = Math.round(g.x / TILE)*TILE + TILE/2;
      g.y = Math.round(g.y / TILE)*TILE + TILE/2;
      // nudge: reverse to avoid stall
      g.dir = {x:-g.dir.x, y:-g.dir.y};
    }else{
      g.x = nx; g.y = ny;
    }

    // leave frightened after timer
    if(g.mode==="fright" && state.frightMs<=0){
      g.mode = "chase";
    }
  }

  function clampTarget(t){
    if(!t) return {c:0,r:0};
    return { c: clamp(t.c, 0, COLS-1), r: clamp(t.r, 0, ROWS-1) };
  }

  function openDirs(c,r, forbid){
    const dirs = [];
    const cand = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
    for(const d of cand){
      if(forbid && d.x===forbid.x && d.y===forbid.y) continue;
      if(!isWall(c+d.x, r+d.y)) dirs.push(d);
    }
    return dirs.length? dirs : [ {x:-forbid.x, y:-forbid.y} ];
  }
  function chooseGreedyDir(c,r, tx,ty, curDir){
    // choose a non-wall direction (not reverse if possible) that minimizes distance to target
    const forbid = {x:-curDir.x, y:-curDir.y};
    const dirs = openDirs(c,r, forbid);
    let best = dirs[0], bestD = Infinity;
    for(const d of dirs){
      const nc = c+d.x, nr = r+d.y;
      const dd = (nc-tx)*(nc-tx) + (nr-ty)*(nr-ty);
      if(dd < bestD){ bestD = dd; best = d; }
    }
    return best || curDir;
  }

  function nextLevel(){
    state.level++;
    // tiny speed-ups
    state.pac.speed += 2;
    for(const g of state.ghosts) g.speed += 2;

    // rebuild dots/powers
    let pacSpawns=[]; const dots=new Set(), powers=new Set();
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        const ch = MAP[r][c]; const k = key(c,r);
        if(ch===".") dots.add(k);
        if(ch==="o") powers.add(k);
        if(ch==="P") pacSpawns.push({x:c*TILE+TILE/2,y:r*TILE+TILE/2});
      }
    }
    const spawn = pacSpawns[0] || {x: state.pac.x, y: state.pac.y};

    state.dots = dots; state.powers = powers;
    state.frightMs = 0; state.eatenInChain=0;
    state.pac.x = spawn.x; state.pac.y = spawn.y; state.pac.dir={x:0,y:0}; state.pac.want={x:0,y:0};
    for(const g of state.ghosts){
      g.x = g.spawn.x; g.y = g.spawn.y; g.mode="scatter"; g.dir={x:1,y:0};
    }
    updateHUD();
  }

  function loseLife(){
    state.lives--;
    updateHUD();
    if(state.lives<=0){ over=true; paused=false; return; }
    // reset positions
    let pacSpawn = {x: W/2, y: H/2};
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(MAP[r][c]==="P"){ pacSpawn={x:c*TILE+TILE/2,y:r*TILE+TILE/2}; }
    state.pac.x = pacSpawn.x; state.pac.y = pacSpawn.y; state.pac.dir={x:0,y:0}; state.pac.want={x:0,y:0};
    state.frightMs = 0; state.eatenInChain=0;
    for(const g of state.ghosts){
      g.x = g.spawn.x; g.y = g.spawn.y; g.mode="scatter"; g.dir={x:1,y:0};
    }
    beep(220,.08);
  }

  // Render
  function render(){
    // clear to panel color (grid reads well over photo page background)
    ctx.fillStyle = COL.bg; ctx.fillRect(0,0,W,H);

    // faint grid
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x=0;x<=W;x+=24){ ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,H); }
    for(let y=0;y<=H;y+=24){ ctx.moveTo(0,y+0.5); ctx.lineTo(W,y+0.5); }
    ctx.stroke();

    // Maze walls (no glow; keeps scene readable)
    ctx.strokeStyle = COL.maze; ctx.lineWidth = 4; ctx.lineJoin="round";
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        if(MAP[r][c] !== "#") continue;
        ctx.strokeRect(c*TILE+3, r*TILE+3, TILE-6, TILE-6);
      }
    }

    // Dots & power pellets
    for(const s of state.dots){
      const [c,r] = s.split(",").map(Number);
      const x = c*TILE + TILE/2, y = r*TILE + TILE/2;
      ctx.fillStyle = COL.dot;
      ctx.beginPath(); ctx.arc(x,y,2,0,Math.PI*2); ctx.fill();
    }
    const blink = (Math.floor(Date.now()/200)%2)===0;
    for(const s of state.powers){
      const [c,r] = s.split(",").map(Number);
      const x = c*TILE + TILE/2, y = r*TILE + TILE/2;
      ctx.fillStyle = blink? COL.power : "#b19f23";
      ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fill();
    }

    // Ghosts (glowy)
    for(const g of state.ghosts){
      const colCore = (g.mode==="fright") ? COL.fright : (g.mode==="eyes") ? COL.eyes : g.color;
      const colHalo = withAlpha(colCore, 0.18);

      ctx.save();
      ctx.translate(g.x, g.y);

      // path for body
      const R = g.radius;
      ctx.beginPath();
      ctx.arc(0, -2, R, Math.PI, 0);
      ctx.lineTo(R, R);
      for(let i=0;i<4;i++) ctx.lineTo(R - (i%2?8:0), R);
      ctx.lineTo(-R, R);
      ctx.closePath();

      // halo
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 6;
      ctx.shadowColor = colCore;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = colHalo;
      ctx.stroke();
      ctx.restore();

      // core
      ctx.fillStyle = colCore;
      ctx.strokeStyle = "rgba(0,0,0,.45)";
      ctx.lineWidth = 1.5;
      ctx.fill(); ctx.stroke();

      // eyes (skip pupils if frightened blinking is desired)
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(-5,-4,3,0,Math.PI*2); ctx.arc(5,-4,3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath(); ctx.arc(-5 + g.dir.x*2, -4 + g.dir.y*2, 1.6, 0, Math.PI*2);
      ctx.arc(5 + g.dir.x*2, -4 + g.dir.y*2, 1.6, 0, Math.PI*2); ctx.fill();

      ctx.restore();
    }

    // Pac-Man (glowy)
    const p = state.pac;
    ctx.save();
    ctx.translate(p.x,p.y);
    const a = Math.atan2(p.dir.y, p.dir.x) || 0;
    const open = p.mouth;

    // halo
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = COL.pac;
    ctx.shadowBlur = 22;
    ctx.fillStyle = withAlpha(COL.pac, 0.18);
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0, p.radius+2, a+open, a-open, false);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // core
    ctx.fillStyle = COL.pac;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0, p.radius, a+open, a-open, false);
    ctx.closePath(); ctx.fill();
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

  // Geometry utils
  function openDirs(c,r, forbid){
    const dirs = [];
    const cand = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
    for(const d of cand){
      if(forbid && d.x===forbid.x && d.y===forbid.y) continue;
      if(!isWall(c+d.x, r+d.y)) dirs.push(d);
    }
    return dirs.length? dirs : [ {x:-forbid.x, y:-forbid.y} ];
  }
  function chooseGreedyDir(c,r, tx,ty, curDir){
    const forbid = {x:-curDir.x, y:-curDir.y};
    const dirs = openDirs(c,r, forbid);
    let best = dirs[0], bestD = Infinity;
    for(const d of dirs){
      const nc = c+d.x, nr = r+d.y;
      const dd = (nc-tx)*(nc-tx) + (nr-ty)*(nr-ty);
      if(dd < bestD){ bestD = dd; best = d; }
    }
    return best || curDir;
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
