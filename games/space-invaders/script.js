"use strict";

(function () {
  // --- Canvas & HUD
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  const scoreEl = document.getElementById("score");
  const highEl  = document.getElementById("high");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");

  // --- Theme colors
  const COL = {
    bg: css("--panel","#100a1f"),
    grid: css("--grid","#1b1232"),
    text: css("--text","#f3e8ff"),
    player: css("--player","#22d3ee"),
    invader: css("--invader","#fef3c7"),
    bullet: css("--bullet","#fb7185"),
    shield: css("--shield","#34d399"),
  };
  function css(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  // --- Gentle pacing + "top start" + step every 2 traversals
  const PLAYER_W = 46, PLAYER_H = 18, PLAYER_SPEED = 360;
  const PLAYER_COOLDOWN = 220;                      // ms
  const BULLET_W = 3, BULLET_H = 10, BULLET_SPEED = 520;
  const ENEMY_BULLET_SPEED = 180;                   // slower enemy bullets

  const INV_COLS = 11, INV_ROWS = 5;
  const INV_W = 28, INV_H = 20;
  const INV_HSPACING = 46, INV_VSPACING = 36;
  const INV_MARGIN_X = 80, INV_MARGIN_TOP = 60;     // << start near the top
  const INV_STEP_DOWN = 8;                          // small step
  const STEP_COOLDOWN_MS = 650;                     // min time between step-downs
  const EDGE_MARGIN = 10;                           // walls

  // Fire pacing
  const FIRE_RATE_BASE = 1 / 5000;                  // fewer shots early on
  const START_NO_FIRE_MS = 3000;                    // no enemy fire for first 3s

  const SHIELDS = 3, SHIELD_COLS = 9, SHIELD_ROWS = 5, SHIELD_CELL = 8;

  // score by row (top→bottom)
  const ROW_SCORE = [40, 30, 20, 20, 10];

  // --- State
  let state;
  let paused = false, over = false;
  let last = 0, acc = 0, stepMs = 1000 / 120;       // 120Hz fixed physics

  // --- Audio (minimal)
  let actx = null, gain;
  function initAudio(){
    if (actx) return;
    try{
      actx = new (window.AudioContext||window.webkitAudioContext)();
      gain = actx.createGain(); gain.gain.value = 0.07; gain.connect(actx.destination);
    }catch(e){}
  }
  function beep(freq=440, dur=0.06, type="square"){
    if (!actx) return;
    const o = actx.createOscillator(); o.type=type; o.frequency.value = freq;
    o.connect(gain); const t=actx.currentTime; o.start(t); o.stop(t+dur);
  }

  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));

  function init(level=1, lives=3, score=0){
    const high = Number(localStorage.getItem("invaders_high")||0);
    state = {
      level, lives, score, high,
      timeMs: 0,               // elapsed time
      invulnMs: 0,             // grace after being hit
      player: { x: W/2 - PLAYER_W/2, y: H-50, vx: 0, cooldown: 0 },
      bullets: [],
      ebullets: [],
      shields: makeShields(),
      formation: makeFormation(level),
    };
    over=false; paused=false; updateHUD();
  }

  function updateHUD(){
    scoreEl.textContent = state.score;
    livesEl.textContent = state.lives;
    levelEl.textContent = state.level;
    state.high = Math.max(state.high, state.score);
    try{ localStorage.setItem("invaders_high", String(state.high)); }catch(e){}
    highEl.textContent = state.high;
    pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause";
  }

  function makeFormation(level=1){
    const invs=[];
    for(let r=0;r<INV_ROWS;r++) for(let c=0;c<INV_COLS;c++) invs.push({r,c,alive:true});
    return {
      invs,
      originX: INV_MARGIN_X,
      originY: INV_MARGIN_TOP,
      dir: 1,
      speed: 18 + level*3,     // calm base speed + soft ramp
      lastStepMs: 0,           // for step cooldown
      bounces: 0,              // count edge hits
      edgeLock: false,         // prevent multi-trigger at edge
    };
  }

  function formationBounds(F){
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,alive=0;
    for(const inv of F.invs){
      if(!inv.alive) continue;
      alive++;
      const x = F.originX + inv.c*INV_HSPACING;
      const y = F.originY + inv.r*INV_VSPACING;
      minX = Math.min(minX,x);
      maxX = Math.max(maxX,x+INV_W);
      minY = Math.min(minY,y);
      maxY = Math.max(maxY,y+INV_H);
    }
    if(alive===0) return {alive:0,minX:0,maxX:0,minY:0,maxY:0};
    return {alive,minX,maxX,minY,maxY};
  }

  function makeShields(){
    const groups=[]; const spacing=W/(SHIELDS+1);
    for(let i=0;i<SHIELDS;i++){
      const gx=Math.round(spacing*(i+1)-(SHIELD_COLS*SHIELD_CELL)/2);
      const gy=H-140;
      const grid=Array.from({length:SHIELD_ROWS},()=>Array(SHIELD_COLS).fill(1));
      // carve classic notches
      for(let x=0;x<SHIELD_COLS;x++){
        for(let y=0;y<SHIELD_ROWS;y++){
          if((y===0&&(x<2||x>SHIELD_COLS-3))||(y===SHIELD_ROWS-1&&x===Math.floor(SHIELD_COLS/2))){ grid[y][x]=0; }
        }
      }
      groups.push({x:gx,y:gy,grid});
    }
    return groups;
  }

  // Inputs
  const keys=new Set();
  window.addEventListener("keydown", e=>{
    const k = (e.code==="Space")?" ":e.key.toLowerCase();
    if(["arrowleft","arrowright","a","d"," ","p","r"].includes(k)) e.preventDefault();
    if(k==="p"){ paused=!paused; updateHUD(); initAudio(); return; }
    if(k==="r"){ init(); initAudio(); return; }
    keys.add(k); initAudio();
  });
  window.addEventListener("keyup", e=>{
    const k = (e.code==="Space")?" ":e.key.toLowerCase();
    keys.delete(k);
  });

  document.querySelectorAll("[data-touch]").forEach(btn=>{
    const type=btn.getAttribute("data-touch");
    let hold=false,raf;
    const step=()=>{ if(!hold) return;
      if(type==="left") state.player.vx=-PLAYER_SPEED;
      if(type==="right") state.player.vx= PLAYER_SPEED;
      if(type==="fire") tryShoot();
      raf=requestAnimationFrame(step);
    };
    const start=(e)=>{ e.preventDefault(); hold=true; step(); initAudio(); };
    const end=(e)=>{ e&&e.preventDefault(); hold=false; if(type!=="fire") state.player.vx=0; cancelAnimationFrame(raf); };
    btn.addEventListener("touchstart",start,{passive:false});
    btn.addEventListener("touchend",end,{passive:false});
    btn.addEventListener("mousedown",start);
    btn.addEventListener("mouseup",end);
    btn.addEventListener("mouseleave",end);
  });

  pauseBtn.addEventListener("click",()=>{ paused=!paused; updateHUD(); initAudio(); });
  resetBtn.addEventListener("click",()=>{ init(); initAudio(); });

  function tryShoot(){
    const p=state.player;
    if(p.cooldown>0) return;
    state.bullets.push({x:p.x+PLAYER_W/2-BULLET_W/2,y:p.y-10,vy:-BULLET_SPEED,w:BULLET_W,h:BULLET_H,friendly:true});
    p.cooldown=PLAYER_COOLDOWN; beep(740,.05);
  }

  // Enemy bullet cap grows slowly (every 3 levels up to 3)
  function enemyBulletCap(){
    return Math.min(3, 1 + Math.floor((state.level-1)/3));
  }

  // Mechanics
  function fixedUpdate(){
    if(paused||over) return;

    const p=state.player, F=state.formation;
    state.timeMs += stepMs;

    // input
    p.vx=0;
    if(keys.has("arrowleft")||keys.has("a")) p.vx-=PLAYER_SPEED;
    if(keys.has("arrowright")||keys.has("d")) p.vx+=PLAYER_SPEED;
    if(keys.has(" ")) tryShoot();

    // timers
    if(p.cooldown>0) p.cooldown=Math.max(0,p.cooldown-stepMs);
    if(state.invulnMs>0) state.invulnMs=Math.max(0,state.invulnMs-stepMs);

    // move player
    p.x=clamp(p.x+p.vx*(stepMs/1000),EDGE_MARGIN,W-EDGE_MARGIN-PLAYER_W);

    // move formation — calm scaling with kills and level
    let bounds=formationBounds(F);
    const killed=INV_COLS*INV_ROWS - bounds.alive;
    const speed=(F.speed + killed*0.6) * (1 + (state.level-1)*0.03);
    F.originX += F.dir * speed * (stepMs/1000);

    // recalc bounds after moving
    bounds = formationBounds(F);

    // bounce + step logic:
    // - reverse direction at edge
    // - only step down every TWO bounces (left→right and back)
    // - use edgeLock so we don't trigger multiple times at the boundary
    const atEdge = bounds.alive>0 && (bounds.minX <= EDGE_MARGIN || bounds.maxX >= W-EDGE_MARGIN);
    if(atEdge && !F.edgeLock){
      F.dir *= -1;
      F.edgeLock = true;
      F.bounces += 1;
      if(F.bounces % 2 === 0 && (state.timeMs - F.lastStepMs >= STEP_COOLDOWN_MS)){
        F.originY += INV_STEP_DOWN;
        F.lastStepMs = state.timeMs;
      }
    }
    // clear lock once formation is back inside edges
    if(F.edgeLock && bounds.minX > EDGE_MARGIN && bounds.maxX < W-EDGE_MARGIN){
      F.edgeLock = false;
    }

    // reached player line → lose a life (require almost touching the player)
    if(bounds.maxY >= p.y - 2 && state.invulnMs<=0){
      loseLife();
    }

    // enemy fire (none in first 3s; then limited + low rate)
    maybeEnemyFire(F);

    // bullets
    state.bullets.forEach(b=> b.y += b.vy*(stepMs/1000));
    state.ebullets.forEach(b=> b.y += b.vy*(stepMs/1000));

    // player bullets vs shields & invaders
    for(let i=state.bullets.length-1;i>=0;i--){
      const b=state.bullets[i];
      if(hitShield(b)){ state.bullets.splice(i,1); continue; }
      if(b.y + b.h < 0){ state.bullets.splice(i,1); continue; }
      const hit = bulletHitsInvader(b, F);
      if(hit){
        state.score += ROW_SCORE[hit.r] || 10;
        state.bullets.splice(i,1);
        beep(520,.06);
      }
    }

    // enemy bullets vs player/shields
    for(let i=state.ebullets.length-1;i>=0;i--){
      const b=state.ebullets[i];
      if(hitShield(b)){ state.ebullets.splice(i,1); continue; }
      if(b.y > H){ state.ebullets.splice(i,1); continue; }
      if(state.invulnMs<=0 && rectsIntersect(b.x,b.y,b.w,b.h, p.x,p.y,PLAYER_W,PLAYER_H)){
        state.ebullets.splice(i,1);
        beep(180,.08);
        loseLife();
        break;
      }
    }

    // next level if cleared
    if(formationBounds(F).alive===0){
      state.level++;
      state.player.cooldown=0;
      state.bullets.length=0; state.ebullets.length=0;
      state.formation = makeFormation(state.level);
      state.shields = makeShields();
      updateHUD();
    }
  }

  function maybeEnemyFire(F){
    // wait a bit before enemies can fire
    if (state.timeMs < START_NO_FIRE_MS) return;
    if(state.ebullets.length >= enemyBulletCap()) return;
    const prob = FIRE_RATE_BASE * (1 + (state.level-1)*0.30) * stepMs;
    if(Math.random() > prob) return;

    // pick a random alive column, shoot from lowest invader
    const colsAlive=new Set(F.invs.filter(i=>i.alive).map(i=>i.c));
    if(colsAlive.size===0) return;
    const cols=[...colsAlive]; const col=cols[Math.floor(Math.random()*cols.length)];
    let shooter=null, yMax=-Infinity;
    for(const inv of F.invs){
      if(!inv.alive || inv.c!==col) continue;
      const y=F.originY + inv.r*INV_VSPACING + INV_H;
      if(y>yMax){ yMax=y; shooter=inv; }
    }
    if(!shooter) return;
    const sx = F.originX + shooter.c*INV_HSPACING + INV_W/2 - BULLET_W/2;
    const sy = F.originY + shooter.r*INV_VSPACING + INV_H + 2;
    state.ebullets.push({x:sx,y:sy,vy:ENEMY_BULLET_SPEED,w:BULLET_W,h:BULLET_H});
    beep(320,.05);
  }

  function loseLife(){
    state.lives--;
    updateHUD();
    if(state.lives<=0){ over=true; paused=false; return; }
    // reset player/bullets and grant invulnerability
    state.player.x = W/2 - PLAYER_W/2;
    state.player.cooldown = 0;
    state.bullets.length = 0;
    state.ebullets.length = 0;
    state.invulnMs = 1200; // 1.2s grace
  }

  function bulletHitsInvader(b,F){
    for(const inv of F.invs){
      if(!inv.alive) continue;
      const x=F.originX + inv.c*INV_HSPACING;
      const y=F.originY + inv.r*INV_VSPACING;
      if(rectsIntersect(b.x,b.y,b.w,b.h, x,y,INV_W,INV_H)){ inv.alive=false; return inv; }
    }
    return null;
  }

  function hitShield(b){
    for(const sh of state.shields){
      const sw=SHIELD_COLS*SHIELD_CELL, shh=SHIELD_ROWS*SHIELD_CELL;
      if(!rectsIntersect(b.x,b.y,b.w,b.h, sh.x,sh.y, sw, shh)) continue;
      const x0=Math.floor((b.x - sh.x)/SHIELD_CELL);
      const y0=Math.floor((b.y - sh.y)/SHIELD_CELL);
      const x1=Math.floor((b.x + b.w - sh.x)/SHIELD_CELL);
      const y1=Math.floor((b.y + b.h - sh.y)/SHIELD_CELL);
      for(let gy=y0; gy<=y1; gy++){
        for(let gx=x0; gx<=x1; gx++){
          if(gy<0||gy>=SHIELD_ROWS||gx<0||gx>=SHIELD_COLS) continue;
          if(sh.grid[gy][gx]){ sh.grid[gy][gx]=0; beep(260,.04); return true; }
        }
      }
    }
    return false;
  }

  function rectsIntersect(ax,ay,aw,ah, bx,by,bw,bh){
    return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
  }

  // --- Render
  function render(){
    ctx.fillStyle = COL.bg; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x=0;x<=W;x+=36){ ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,H); }
    for(let y=0;y<=H;y+=36){ ctx.moveTo(0,y+0.5); ctx.lineTo(W,y+0.5); }
    ctx.stroke();

    // shields
    ctx.fillStyle = COL.shield;
    for(const sh of state.shields){
      for(let y=0;y<SHIELD_ROWS;y++){
        for(let x=0;x<SHIELD_COLS;x++){
          if(!sh.grid[y][x]) continue;
          roundRect(ctx, sh.x + x*SHIELD_CELL + 1, sh.y + y*SHIELD_CELL + 1, SHIELD_CELL-2, SHIELD_CELL-2, 2);
          ctx.fill();
        }
      }
    }

    // invaders
    ctx.fillStyle = COL.invader;
    const F=state.formation;
    for(const inv of F.invs){
      if(!inv.alive) continue;
      const x=F.originX + inv.c*INV_HSPACING;
      const y=F.originY + inv.r*INV_VSPACING;
      drawInvader(ctx,x,y,INV_W,INV_H);
    }

    // player (blink a bit while invulnerable)
    ctx.save();
    if(state.invulnMs>0 && Math.floor(state.invulnMs/100)%2===0){ ctx.globalAlpha = 0.5; }
    ctx.fillStyle = COL.player;
    drawPlayer(ctx, state.player.x, state.player.y, PLAYER_W, PLAYER_H);
    ctx.restore();

    // bullets
    ctx.fillStyle = COL.bullet;
    state.bullets.forEach(b=>ctx.fillRect(b.x,b.y,b.w,b.h));
    state.ebullets.forEach(b=>ctx.fillRect(b.x,b.y,b.w,b.h));

    if(over || paused){
      ctx.fillStyle="rgba(0,0,0,.45)"; ctx.fillRect(0,0,W,H);
      ctx.fillStyle=COL.text; ctx.textAlign="center";
      ctx.font="700 26px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      ctx.fillText(over?"Game Over":"Paused", W/2, H/2 - 8);
      ctx.font="500 16px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      ctx.fillText(over?"Press R to restart":"Press P to resume", W/2, H/2 + 18);
    }
  }

  function drawPlayer(ctx,x,y,w,h){
    roundRect(ctx,x,y+4,w,h-4,6); ctx.fill();
    ctx.fillRect(x+w*0.45,y, w*0.10,6);
  }
  function drawInvader(ctx,x,y,w,h){
    const u=Math.min(w/14,h/10);
    const px=(gx,gy,gw,gh)=>ctx.fillRect(x+gx*u,y+gy*u,gw*u,gh*u);
    px(2,2,10,2); px(1,4,12,2); px(0,6,14,2); px(2,8,10,1);
    ctx.fillStyle="#000"; px(4,4,2,1); px(8,4,2,1);
    ctx.fillStyle=COL.invader; px(2,9,2,1); px(10,9,2,1);
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
    const dt=t-last; last=t; acc+=dt;
    while(acc>=stepMs){ fixedUpdate(); acc-=stepMs; }
    render();
    requestAnimationFrame(frame);
  }

  // Boot
  init();
  requestAnimationFrame(t=>{ last=t; requestAnimationFrame(frame); });
})();
