"use strict";

(function () {
  // ==== Constants =========
  const COLS = 10, ROWS = 20, CELL = 30;          // 10x20, 30px => 300x600
  const GRAVITY_BASE = 1000;                      // ms at level 1
  const LEVEL_UP_EVERY = 10;                      // lines per level
  const SOFT_DROP_SCORE = 1;                      // per cell
  const HARD_DROP_SCORE = 2;                      // per cell

  // Piece definitions (4x4 matrices per rotation)
  const SHAPES = {
    I: [
      [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
      [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
      [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
      [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
    ],
    J: [
      [[2,0,0],[2,2,2],[0,0,0]],
      [[0,2,2],[0,2,0],[0,2,0]],
      [[0,0,0],[2,2,2],[0,0,2]],
      [[0,2,0],[0,2,0],[2,2,0]],
    ],
    L: [
      [[0,0,3],[3,3,3],[0,0,0]],
      [[0,3,0],[0,3,0],[0,3,3]],
      [[0,0,0],[3,3,3],[3,0,0]],
      [[3,3,0],[0,3,0],[0,3,0]],
    ],
    O: [
      [[4,4],[4,4]],
      [[4,4],[4,4]],
      [[4,4],[4,4]],
      [[4,4],[4,4]],
    ],
    S: [
      [[0,5,5],[5,5,0],[0,0,0]],
      [[0,5,0],[0,5,5],[0,0,5]],
      [[0,0,0],[0,5,5],[5,5,0]],
      [[5,0,0],[5,5,0],[0,5,0]],
    ],
    T: [
      [[0,6,0],[6,6,6],[0,0,0]],
      [[0,6,0],[0,6,6],[0,6,0]],
      [[0,0,0],[6,6,6],[0,6,0]],
      [[0,6,0],[6,6,0],[0,6,0]],
    ],
    Z: [
      [[7,7,0],[0,7,7],[0,0,0]],
      [[0,0,7],[0,7,7],[0,7,0]],
      [[0,0,0],[7,7,0],[0,7,7]],
      [[0,7,0],[7,7,0],[7,0,0]],
    ],
  };

  // Colors (CSS vars)
  const COLORS = {
    1: css("--c-i", "#60a5fa"), // I
    2: css("--c-j", "#3b82f6"), // J
    3: css("--c-l", "#f59e0b"), // L
    4: css("--c-o", "#facc15"), // O
    5: css("--c-s", "#22c55e"), // S
    6: css("--c-t", "#a78bfa"), // T
    7: css("--c-z", "#ef4444"), // Z
  };

  // ==== DOM ========
  const board = document.getElementById("board");
  const ctx = board.getContext("2d");
  const nextCanvas = document.getElementById("next");
  const nextCtx = nextCanvas.getContext("2d");
  const holdCanvas = document.getElementById("hold");
  const holdCtx = holdCanvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const linesEl = document.getElementById("lines");
  const levelEl = document.getElementById("level");
  const highEl  = document.getElementById("high");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");

  // ==== Utils ======
  function css(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }
  function clone(m){ return JSON.parse(JSON.stringify(m)); }

  // ==== Game State ====
  let grid, active, queue, hold, canHold;
  let score=0, lines=0, level=1, high=Number(localStorage.getItem("tetris_high")||0);
  let over=false, paused=false;

  // Gravity clock
  let last=0, acc=0, stepMs=gravityMs(level);

  // 7-bag generator
  function* bag() {
    const types = Object.keys(SHAPES); // ["I","J","L","O","S","T","Z"]
    while(true){
      const b = types.slice();
      for(let i=b.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; }
      for(const t of b) yield t;
    }
  }
  let dealer = bag();

  function gravityMs(lvl){
    // Classic-ish gravity curve
    return Math.max(60, Math.floor(GRAVITY_BASE * Math.pow(0.85, Math.max(0,lvl-1))));
  }

  function emptyGrid(){
    const g = Array.from({length:ROWS}, ()=>Array(COLS).fill(0));
    return g;
  }

  function newPiece(type){
    const shapes = SHAPES[type];
    const mat = clone(shapes[0]);
    const id = "IJLOSTZ".indexOf(type)+1; // 1..7 color id
    const w = mat[0].length;
    // spawn near top center
    return { type, r:0, m:mat, x: Math.floor((COLS - w)/2), y: -spawnTopOffset(mat), id };
  }

  function spawnTopOffset(mat){
    // allow pieces to start partially above the visible board
    let top=0;
    for(let r=0;r<mat.length;r++){
      if(mat[r].some(v=>v)) { top=r; break; }
    }
    return top+1;
  }

  function refillQueue(){
    while(queue.length < 5){
      queue.push(newPiece(dealer.next().value));
    }
  }

  function spawn(){
    refillQueue();
    active = queue.shift();
    canHold = true;
    if(collides(grid, active, active.x, active.y)){
      over = true;
      paused = false;
    }
    refillQueue();
    stepMs = gravityMs(level);
  }

  function reset(){
    grid = emptyGrid();
    queue = [];
    active = null;
    hold = null;
    canHold = true;
    score=0; lines=0; level=1; over=false; paused=false;
    dealer = bag();
    refillQueue();
    spawn();
    updateHUD();
  }

  function updateHUD(){
    scoreEl.textContent = score;
    linesEl.textContent = lines;
    levelEl.textContent = level;
    high = Math.max(high, score);
    localStorage.setItem("tetris_high", String(high));
    highEl.textContent = high;
    pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause";
  }

  // ==== Mechanics =====
  function collides(g, p, nx, ny){
    const m = p.m, h = m.length, w = m[0].length;
    for(let r=0;r<h;r++){
      for(let c=0;c<w;c++){
        if(!m[r][c]) continue;
        const x = nx + c, y = ny + r;
        if(x<0 || x>=COLS || y>=ROWS) return true;
        if(y>=0 && g[y][x]) return true;
      }
    }
    return false;
  }

  function mergePiece(){
    const m=active.m, h=m.length, w=m[0].length;
    for(let r=0;r<h;r++){
      for(let c=0;c<w;c++){
        if(!m[r][c]) continue;
        const x = active.x + c, y = active.y + r;
        if(y>=0) grid[y][x] = active.id;
      }
    }
  }

  function rotate(dir){
    const shapeSet = SHAPES[active.type];
    let r = (active.r + (dir>0?1:3)) % 4;
    let mat = clone(shapeSet[r]);
    const kicks = active.type==="I" ? [0,-2,2,-1,1] : [0,-1,1,-2,2];
    for(const k of kicks){
      const nx = active.x + k, ny = active.y; // simple wall kicks
      if(!collides(grid, {...active, m:mat}, nx, ny)){
        active.r = r; active.m = mat; active.x = nx; active.y = ny; return true;
      }
    }
    return false;
  }

  function move(dx, dy){
    const nx = active.x + dx, ny = active.y + dy;
    if(!collides(grid, active, nx, ny)){ active.x = nx; active.y = ny; return true; }
    return false;
  }

  function softDrop(){
    if(move(0,1)){ score += SOFT_DROP_SCORE; }
  }

  function hardDrop(){
    let cells=0;
    while(move(0,1)) cells++;
    score += cells * HARD_DROP_SCORE;
    lock();
  }

  function lock(){
    mergePiece();
    const cleared = clearLines();
    if(cleared>0){
      const base = [0,100,300,500,800][cleared] || 0;
      score += base * level;
      lines += cleared;
      const newLevel = Math.floor(lines/LEVEL_UP_EVERY)+1;
      if(newLevel!==level){ level = newLevel; stepMs = gravityMs(level); }
    }
    spawn();
    updateHUD();
  }

  function clearLines(){
    let removed = 0;
    for(let r=ROWS-1;r>=0;){
      if(grid[r].every(v=>v)){
        grid.splice(r,1);
        grid.unshift(Array(COLS).fill(0));
        removed++;
      } else r--;
    }
    return removed;
  }

  function holdPiece(){
    if(!canHold) return;
    canHold = false;
    if(!hold){
      hold = {...active}; // store type/id only for color; rotation resets
      spawn();
    } else {
      const tmp = hold;
      hold = {...active};
      const newP = newPiece(tmp.type);
      active = newP;
      if(collides(grid, active, active.x, active.y)){ over = true; }
    }
    updateHUD();
  }

  // ==== Ghost piece (projection) ====
  function ghostY(){
    let y = active.y;
    while(!collides(grid, active, active.x, y+1)) y++;
    return y;
  }

  // ==== Rendering =====
  function drawCell(px, py, id, ctx2d=ctx, size=CELL){
    const x = px*size, y = py*size, s = size;
    const color = COLORS[id] || "#64748b";
    // tile bg
    ctx2d.fillStyle = color;
    roundRect(ctx2d, x+1, y+1, s-2, s-2, 6);
    ctx2d.fill();
    // glossy highlight
    ctx2d.fillStyle = "rgba(255,255,255,.13)";
    roundRect(ctx2d, x+2, y+2, s-4, Math.floor((s-4)/2.2), 5);
    ctx2d.fill();
  }

  function roundRect(ctx2d, x, y, w, h, r){
    const rr = Math.min(r, w/2, h/2);
    ctx2d.beginPath();
    ctx2d.moveTo(x+rr,y);
    ctx2d.arcTo(x+w,y,x+w,y+h,rr);
    ctx2d.arcTo(x+w,y+h,x,y+h,rr);
    ctx2d.arcTo(x,y+h,x,y,rr);
    ctx2d.arcTo(x,y,x+w,y,rr);
    ctx2d.closePath();
  }

  function render(){
    // board background + subtle grid
    ctx.fillStyle = css("--panel","#121826");
    ctx.fillRect(0,0,board.width,board.height);
    ctx.strokeStyle = css("--grid","#20293a");
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0;i<=COLS;i++){ ctx.moveTo(i*CELL+0.5,0); ctx.lineTo(i*CELL+0.5,ROWS*CELL); }
    for(let j=0;j<=ROWS;j++){ ctx.moveTo(0,j*CELL+0.5); ctx.lineTo(COLS*CELL,j*CELL+0.5); }
    ctx.stroke();

    // settled blocks
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        if(grid[r][c]) drawCell(c,r,grid[r][c]);
      }
    }

    if(active){
      // ghost
      const gy = ghostY();
      if(gy !== active.y){
        ctx.globalAlpha = 0.25;
        const m = active.m;
        for(let r=0;r<m.length;r++){
          for(let c=0;c<m[0].length;c++){
            if(m[r][c]) drawCell(active.x+c, gy+r, active.id);
          }
        }
        ctx.globalAlpha = 1;
      }
      // active piece
      const m = active.m;
      for(let r=0;r<m.length;r++){
        for(let c=0;c<m[0].length;c++){
          if(m[r][c]) drawCell(active.x+c, active.y+r, active.id);
        }
      }
    }

    // next preview
    nextCtx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
    drawMini(nextCtx, queue[0]);

    // hold preview
    holdCtx.clearRect(0,0,holdCanvas.width,holdCanvas.height);
    if(hold) drawMini(holdCtx, {type: hold.type, m: SHAPES[hold.type][0], id: hold.id});
    
    // overlay if game over / paused
    if(over || paused){
      const c = board.getContext("2d");
      c.fillStyle = "rgba(0,0,0,.45)";
      c.fillRect(0,0,board.width, board.height);
      c.fillStyle = "#fff";
      c.textAlign = "center";
      c.font = "700 26px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      c.fillText(over ? "Game Over" : "Paused", board.width/2, board.height/2 - 8);
      c.font = "500 16px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      c.fillText(over ? "Press R to restart" : "Press P to resume", board.width/2, board.height/2 + 18);
    }
  }

  function drawMini(ctx2d, piece){
    const cell = 20;
    const pad = 10;
    const w = ctx2d.canvas.width, h = ctx2d.canvas.height;
    // panel bg
    ctx2d.fillStyle = css("--panel","#121826");
    ctx2d.fillRect(0,0,w,h);
    // center the piece
    const m = SHAPES[piece.type][0];
    const mh = m.length, mw = m[0].length;
    const ox = Math.floor((w - mw*cell)/2);
    const oy = Math.floor((h - mh*cell)/2);
    for(let r=0;r<mh;r++){
      for(let c=0;c<mw;c++){
        if(m[r][c]) drawCell(c + (ox/cell), r + (oy/cell), piece.id || ("IJLOSTZ".indexOf(piece.type)+1), ctx2d, cell);
      }
    }
  }

  // ==== Loop =====
  function frame(t){
    const dt = t - last; last = t; if(paused || over){ render(); requestAnimationFrame(frame); return; }
    acc += dt;
    while(acc >= stepMs){
      // try to drop
      if(!move(0,1)){ lock(); }
      acc -= stepMs;
    }
    render();
    requestAnimationFrame(frame);
  }

  // ==== Input =====
  window.addEventListener("keydown", e=>{
    if(over){ if(e.key.toLowerCase()==="r"){ reset(); } return; }
    const k = e.key;
    if(k==="p"||k==="P"){ paused=!paused; updateHUD(); return; }
    if(k==="r"||k==="R"){ reset(); return; }

    if(paused) return;

    if(k==="ArrowLeft"){ move(-1,0); }
    else if(k==="ArrowRight"){ move(1,0); }
    else if(k==="ArrowDown"){ softDrop(); }
    else if(k==="ArrowUp" || k==="x" || k==="X"){ rotate(+1); }
    else if(k==="z" || k==="Z"){ rotate(-1); }
    else if(k===" "){ e.preventDefault(); hardDrop(); }
    else if(k==="c" || k==="C"){ holdPiece(); }
  });

  // Touch controls
  document.querySelectorAll("[data-touch]").forEach(btn=>{
    const type = btn.getAttribute("data-touch");
    let active=false, raf;
    const step = ()=>{
      if(!active) return;
      if(type==="left") move(-1,0);
      if(type==="right") move(1,0);
      if(type==="down") softDrop();
      if(type==="rotl") rotate(-1);
      if(type==="rotr") rotate(+1);
      if(type==="drop") hardDrop();
      raf = requestAnimationFrame(step);
    };
    const start = (e)=>{ e.preventDefault(); if(over||paused) return; active=true; step(); };
    const end = (e)=>{ e && e.preventDefault(); active=false; cancelAnimationFrame(raf); };
    btn.addEventListener("touchstart", start, {passive:false});
    btn.addEventListener("touchend", end, {passive:false});
    btn.addEventListener("mousedown", start);
    btn.addEventListener("mouseup", end);
    btn.addEventListener("mouseleave", end);
  });

  pauseBtn.addEventListener("click", ()=>{ paused=!paused; updateHUD(); });
  resetBtn.addEventListener("click", ()=> reset());

  // ==== Boot ====
  reset();
  requestAnimationFrame(t=>{ last=t; requestAnimationFrame(frame); });
})();
