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

  // Colors
  const COL = {
    bg: css("--panel","#0e171a"),
    grid: css("--grid","#102228"),
    text: css("--text","#e7f6ff"),
    grass: css("--grass","#0e2e1e"),
    river: css("--river","#0a2740"),
    road: css("--road","#1f1f25"),
    frog: css("--frog","#84cc16"),
    car: css("--car","#f59e0b"),
    truck: css("--truck","#ef4444"),
    log: css("--log","#9ca3af"),
  };
  function css(name, fallback){
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }
  function withAlpha(hex, a){
    const h = hex.replace('#',''); const f=h.length===3?h.split('').map(c=>c+c).join(''):h;
    const n=parseInt(f,16); const r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    return `rgba(${r},${g},${b},${a})`;
  }

  // Grid
  const TILE = 36; // 20x15 tiles on 720x540
  const COLS = Math.floor(W / TILE); // 20
  const ROWS = Math.floor(H / TILE); // 15

  // Zones (row indexes)
  const ROW_HOME = 1;
  const RIVER_FROM = 2, RIVER_TO = 6;
  const ROW_MEDIAN = 7;
  const ROAD_FROM = 8, ROAD_TO = 12;
  const ROW_START = 14;

  // Game tuning
  const HOP_SCORE = 1;
  const HOME_SCORE = 50;
  const LEVEL_BONUS = 100;

  // Entities
  const lanes = []; // filled in initLevel()
  let frog, homes, state;

  // Loop
  let paused=false, over=false;
  let last=0, acc=0, stepMs = 1000/120;

  // Audio (tiny beeps)
  let actx=null,gain;
  function initAudio(){
    if(actx) return;
    try{ actx=new (window.AudioContext||window.webkitAudioContext)();
      gain=actx.createGain(); gain.gain.value=0.06; gain.connect(actx.destination);
    }catch(e){}
  }
  function beep(freq=440,dur=0.05,type="square"){
    if(!actx) return;
    const o=actx.createOscillator(); o.type=type; o.frequency.value=freq; o.connect(gain);
    const t=actx.currentTime; o.start(t); o.stop(t+dur);
  }

  function init(level=1, lives=3, score=0){
    const high = Number(localStorage.getItem("frogger_high")||0);
    state = { level, lives, score, high };
    over=false; paused=false;
    buildHomes();
    initLevel();
    placeFrog();
    updateHUD();
  }

  function updateHUD(){
    scoreEl.textContent = state.score;
    livesEl.textContent = state.lives;
    levelEl.textContent = state.level;
    state.high = Math.max(state.high, state.score);
    try{ localStorage.setItem("frogger_high", String(state.high)); }catch(e){}
    highEl.textContent = state.high;
    pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause";
  }

  function buildHomes(){
    // 5 bays across row 1
    const cols = [2,6,10,14,18];
    homes = cols.map(c=>{
      const x=c*TILE+TILE/2, y=ROW_HOME*TILE+TILE/2;
      return {c,x,y, filled:false};
    });
  }

  function initLevel(){
    lanes.length=0;
    // ROAD lanes 8..12 (5 lanes)
    const roadSpeeds = [120, 160, 100, 180, 140].map(v=>v + (state.level-1)*10);
    for(let i=0;i<=ROAD_TO-ROAD_FROM;i++){
      const row = ROAD_FROM + i;
      const dir = (i%2===0)? 1 : -1;
      const speed = roadSpeeds[i];
      const vehicle = {
        kind:"road",
        y: row*TILE,
        dir,
        speed,
        spawnEvery: 1200 - i*80, // ms
        lastSpawn: 0,
        items: []
      };
      lanes.push(vehicle);
    }

    // RIVER lanes 2..6 (5 lanes)
    const riverSpeeds = [80, 120, 90, 110, 70].map(v=>v + (state.level-1)*8);
    for(let i=0;i<=RIVER_TO-RIVER_FROM;i++){
      const row = RIVER_FROM + i;
      const dir = (i%2===0)? -1 : 1;
      const speed = riverSpeeds[i];
      const logLane = {
        kind:"river",
        y: row*TILE,
        dir,
        speed,
        spawnEvery: 1300 - i*60,
        lastSpawn: 0,
        items: []
      };
      lanes.push(logLane);
    }
  }

  function placeFrog(){
    frog = {
      c: Math.floor(COLS/2),
      r: ROW_START,
      x: Math.floor(COLS/2)*TILE + TILE/2,
      y: ROW_START*TILE + TILE/2,
      size: 26,
      riding: null // reference to a log if riding
    };
  }

  // Input (discrete hops)
  const keys = new Set();
  window.addEventListener("keydown", e=>{
    const k = e.key.toLowerCase();
    if(["arrowleft","arrowright","arrowup","arrowdown","w","a","s","d","p","r"].includes(k)) e.preventDefault();
    if(k==="p"){ paused=!paused; updateHUD(); initAudio(); return; }
    if(k==="r"){ init(); initAudio(); return; }
    if(["arrowleft","a"].includes(k)) hop(-1,0);
    if(["arrowright","d"].includes(k)) hop(1,0);
    if(["arrowup","w"].includes(k)) hop(0,-1);
    if(["arrowdown","s"].includes(k)) hop(0,1);
    initAudio();
  });

  // Touch
  document.querySelectorAll("[data-touch]").forEach(btn=>{
    const type = btn.getAttribute("data-touch");
    const map = {left:[-1,0], right:[1,0], up:[0,-1], down:[0,1]};
    btn.addEventListener("click", e=>{
      const v = map[type]; if(!v) return; hop(v[0],v[1]); initAudio();
    });
    btn.addEventListener("touchstart", e=>{
      e.preventDefault(); const v = map[type]; if(!v) return; hop(v[0],v[1]); initAudio();
    }, {passive:false});
  });

  pauseBtn.addEventListener("click", ()=>{ paused=!paused; updateHUD(); initAudio(); });
  resetBtn.addEventListener("click", ()=>{ init(); initAudio(); });

  function hop(dx,dy){
    if(over||paused) return;
    const nc = clamp(frog.c + dx, 0, COLS-1);
    const nr = clamp(frog.r + dy, 0, ROWS-1);
    if(nc===frog.c && nr===frog.r) return;

    frog.c = nc; frog.r = nr;
    frog.x = frog.c*TILE + TILE/2;
    frog.y = frog.r*TILE + TILE/2;
    frog.riding = null; // will re-evaluate this tick
    state.score += (dy<0? HOP_SCORE : 0); // reward upward hops
    beep(720,.03);
  }

  // Utils
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const rects=(ax,ay,aw,ah,bx,by,bw,bh)=> ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;

  // Spawning
  function trySpawn(lane, dt){
    lane.lastSpawn += dt;
    const want = lane.spawnEvery;
    if(lane.lastSpawn < want) return;
    lane.lastSpawn = 0;

    if(lane.kind==="road"){
      const truck = Math.random()<0.35;
      const w = truck ? TILE*2.2 : TILE*1.2;
      const h = TILE*0.8;
      const x = lane.dir>0 ? -w-2 : W+2;
      lane.items.push({x, y: lane.y + (TILE-h)/2, w, h, vx: lane.dir*lane.speed, truck});
    } else {
      // river log
      const w = TILE*(2.0 + Math.random()*1.6);
      const h = TILE*0.7;
      const x = lane.dir>0 ? -w-2 : W+2;
      lane.items.push({x, y: lane.y + (TILE-h)/2, w, h, vx: lane.dir*lane.speed});
    }
  }

  function update(){
    if(paused||over) return;

    // lanes
    for(const lane of lanes){
      trySpawn(lane, stepMs);

      // move items
      for(const it of lane.items){
        it.x += it.vx*(stepMs/1000);
      }

      // wrap/remove far-off items
      for(let i=lane.items.length-1;i>=0;i--){
        const it=lane.items[i];
        if(lane.dir>0 && it.x > W+it.w+8) lane.items.splice(i,1);
        else if(lane.dir<0 && it.x < -it.w-8) lane.items.splice(i,1);
      }
    }

    // hazards & riding
    const fx = frog.x - frog.size/2, fy = frog.y - frog.size/2, fs = frog.size;

    // road collision
    if(frog.r>=ROAD_FROM && frog.r<=ROAD_TO){
      const lane = lanes.find(l=>l.kind==="road" && l.y===frog.r*TILE);
      let hit=false;
      if(lane){
        for(const c of lane.items){
          if(rects(fx,fy,fs,fs, c.x,c.y,c.w,c.h)){ hit=true; break; }
        }
      }
      if(hit){ die(); return; }
    }

    // river logic
    if(frog.r>=RIVER_FROM && frog.r<=RIVER_TO){
      const lane = lanes.find(l=>l.kind==="river" && l.y===frog.r*TILE);
      let onLog=null;
      if(lane){
        for(const log of lane.items){
          if(rects(fx,fy,fs,fs, log.x,log.y,log.w,log.h)){ onLog=log; break; }
        }
      }
      if(onLog){
        frog.x += onLog.vx*(stepMs/1000);
        frog.c = Math.round((frog.x - TILE/2)/TILE);
        // carried off-screen?
        if(frog.x < 0 || frog.x > W){ die(); return; }
      }else{
        // in water and not on log
        die(); return;
      }
    }

    // home bays
    if(frog.r === ROW_HOME){
      const bay = homes.find(h=>!h.filled && Math.abs(h.x - frog.x) <= TILE);
      if(bay){
        bay.filled = true;
        state.score += HOME_SCORE;
        // all filled → next level
        if(homes.every(h=>h.filled)){
          state.score += LEVEL_BONUS;
          state.level++;
          // reset homes and lanes for next level
          buildHomes(); initLevel();
        }
        placeFrog();
        updateHUD();
      } else {
        // landed between bays → die
        die(); return;
      }
    }
  }

  function die(){
    state.lives--;
    updateHUD();
    if(state.lives<=0){ over=true; paused=false; return; }
    placeFrog(); beep(220,.06);
  }

  function render(){
    // background layers
    ctx.fillStyle = COL.bg; ctx.fillRect(0,0,W,H);

    // draw zones
    // top grass
    ctx.fillStyle = COL.grass; ctx.fillRect(0, 0, W, TILE);
    // home row (bays)
    ctx.fillStyle = COL.grass; ctx.fillRect(0, TILE, W, TILE);
    // river
    ctx.fillStyle = COL.river; ctx.fillRect(0, RIVER_FROM*TILE, W, (RIVER_TO-RIVER_FROM+1)*TILE);
    // median
    ctx.fillStyle = COL.grass; ctx.fillRect(0, ROW_MEDIAN*TILE, W, TILE);
    // road
    ctx.fillStyle = COL.road; ctx.fillRect(0, ROAD_FROM*TILE, W, (ROAD_TO-ROAD_FROM+1)*TILE);
    // start grass (bottom two rows look lush)
    ctx.fillStyle = COL.grass; ctx.fillRect(0, (ROW_START-1)*TILE, W, TILE*2);

    // faint grid
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x=0;x<=W;x+=TILE){ ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,H); }
    for(let y=0;y<=H;y+=TILE){ ctx.moveTo(0,y+0.5); ctx.lineTo(W,y+0.5); }
    ctx.stroke();

    // home bays (targets)
    for(const h of homes){
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.strokeStyle = withAlpha("#ffffff", .25);
      ctx.lineWidth = 2;
      roundRect(-TILE, -TILE/2+2, TILE*2, TILE-4, 8); ctx.stroke();
      if(h.filled){
        // little lilypad icon
        ctx.fillStyle = withAlpha(COL.frog, .9);
        roundRect(-10,-10,20,20,10); ctx.fill();
      }
      ctx.restore();
    }

    // river logs
    for(const lane of lanes){
      if(lane.kind!=="river") continue;
      for(const log of lane.items){
        ctx.fillStyle = COL.log;
        roundRect(log.x, log.y, log.w, log.h, 8); ctx.fill();
        // glossy stripe
        ctx.fillStyle = "rgba(255,255,255,.12)";
        roundRect(log.x+6, log.y+4, log.w-12, 4, 3); ctx.fill();
      }
    }

    // road vehicles
    for(const lane of lanes){
      if(lane.kind!=="road") continue;
      for(const c of lane.items){
        ctx.fillStyle = c.truck ? COL.truck : COL.car;
        roundRect(c.x, c.y, c.w, c.h, 6); ctx.fill();
        // headlight hint
        ctx.fillStyle = "rgba(255,255,255,.18)";
        if(lane.dir>0) roundRect(c.x+c.w-8, c.y+4, 6, c.h-8, 3), ctx.fill();
        else           roundRect(c.x+2,      c.y+4, 6, c.h-8, 3), ctx.fill();
      }
    }

    // frog (glowy)
    ctx.save();
    ctx.translate(frog.x, frog.y);
    // halo
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = COL.frog;
    ctx.shadowBlur = 18;
    ctx.fillStyle = withAlpha(COL.frog, .2);
    roundRect(-frog.size/2, -frog.size/2, frog.size, frog.size, 8); ctx.fill();
    ctx.restore();
    // body
    ctx.fillStyle = COL.frog;
    roundRect(-frog.size/2, -frog.size/2, frog.size, frog.size, 8); ctx.fill();
    // eyes
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(-6,-10,4,4); ctx.fillRect(2,-10,4,4);
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

  function roundRect(x,y,w,h,r){
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
