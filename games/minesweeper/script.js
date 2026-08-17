"use strict";

(function () {
  // Canvas & HUD
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  const minesLeftEl = document.getElementById("minesLeft");
  const timeEl = document.getElementById("time");
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const diffSel = document.getElementById("difficulty");
  const flagModeBtn = document.getElementById("flagModeBtn");

  // Theme
  const COL = {
    panel: css("--panel", "#ffffff"),
    grid: css("--grid", "#e5e7eb"),
    text: css("--text", "#0f172a"),
    cell: css("--cell", "#f9fafb"),
    cell2: css("--cell2", "#eef2f7"),
    reveal: css("--reveal", "#ffffff"),
    bomb: css("--bomb", "#ef4444"),
    flag: css("--flag", "#f97316"),
    n: [null,
      css("--n1","#2563eb"), css("--n2","#16a34a"), css("--n3","#dc2626"), css("--n4","#7c3aed"),
      css("--n5","#b45309"), css("--n6","#0ea5e9"), css("--n7","#334155"), css("--n8","#9333ea")
    ]
  };
  function css(name, fallback){
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  // Grid (square cells)
  const COLS = 24, ROWS = 18;
  const TILE = Math.floor(Math.min(W/COLS, H/ROWS)); // 30px
  const PADX = Math.floor((W - COLS*TILE)/2);
  const PADY = Math.floor((H - ROWS*TILE)/2);

  // Difficulty map
  const DIFF_MINES = { easy: 40, medium: 80, hard: 120 };

  // State
  let state;
  let over=false, won=false, started=false, flagMode=false;
  let timeMs=0, lastTs=0;

  // Board representation
  // cell = { mine, adj (0-8), revealed, flagged }
  function newBoard(){
    const b=[];
    for(let r=0;r<ROWS;r++){
      const row=[];
      for(let c=0;c<COLS;c++){
        row.push({mine:false, adj:0, revealed:false, flagged:false});
      }
      b.push(row);
    }
    return b;
  }

  function init(){
    const mines = DIFF_MINES[diffSel.value] || 80;
    state = {
      mines,
      board: newBoard(),
      placed: false, // mines placed after first click
      flags: 0
    };
    over=false; won=false; started=false; timeMs=0; lastTs=0;
    statusEl.textContent = "Ready";
    minesLeftEl.textContent = String(mines - state.flags);
    timeEl.textContent = "0";
    flagMode=false; flagModeBtn.classList.remove("on");
    render();
  }

  resetBtn.addEventListener("click", init);
  diffSel.addEventListener("change", init);
  flagModeBtn.addEventListener("click", ()=>{
    flagMode=!flagMode;
    flagModeBtn.classList.toggle("on", flagMode);
  });

  // Events
  canvas.addEventListener("contextmenu", e=>e.preventDefault());

  canvas.addEventListener("mousedown", (e)=>{
    if(over||won) return;
    const {c,r} = cellFromEvent(e);
    if(!inBounds(c,r)) return;
    // left=0, right=2, middle=1
    if(e.button===2 || flagMode) { toggleFlag(c,r); }
    else if(e.button===0) { reveal(c,r); }
  });

  // basic touch: tap reveals, with Flag Mode toggle for flags
  canvas.addEventListener("touchstart", (e)=>{
    e.preventDefault();
    if(over||won) return;
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = (t.clientX - rect.left) * (canvas.width/rect.width);
    const y = (t.clientY - rect.top) * (canvas.height/rect.height);
    const c = Math.floor((x - PADX) / TILE);
    const r = Math.floor((y - PADY) / TILE);
    if(!inBounds(c,r)) return;
    if(flagMode) toggleFlag(c,r);
    else reveal(c,r);
  }, {passive:false});

  function inBounds(c,r){ return c>=0 && c<COLS && r>=0 && r<ROWS; }
  function cellFromEvent(e){
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width/rect.width);
    const y = (e.clientY - rect.top) * (canvas.height/rect.height);
    const c = Math.floor((x - PADX) / TILE);
    const r = Math.floor((y - PADY) / TILE);
    return {c,r};
  }

  // Place mines after first click, ensuring the clicked cell (and neighbors) are safe
  function placeMines(safeC, safeR){
    const board = state.board;
    const minesToPlace = state.mines;
    const forbidden = new Set();
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
      forbidden.add((safeR+dr)+","+ (safeC+dc));
    }

    let placed=0;
    while(placed < minesToPlace){
      const c = Math.floor(Math.random()*COLS);
      const r = Math.floor(Math.random()*ROWS);
      const k = r+","+c;
      if(forbidden.has(k)) continue;
      const cell = board[r][c];
      if(cell.mine) continue;
      cell.mine = true; placed++;
    }

    // compute adj counts
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        if(board[r][c].mine){ board[r][c].adj = -1; continue; }
        let n=0;
        for(let dr=-1;dr<=1;dr++){
          for(let dc=-1;dc<=1;dc++){
            if(dr===0 && dc===0) continue;
            const rr=r+dr, cc=c+dc;
            if(inBounds(cc,rr) && board[rr][cc].mine) n++;
          }
        }
        board[r][c].adj = n;
      }
    }
    state.placed = true;
  }

  function reveal(c,r){
    if(!inBounds(c,r)) return;
    const cell = state.board[r][c];
    if(cell.revealed || cell.flagged) return;

    if(!state.placed){
      placeMines(c,r);
      started=true; statusEl.textContent="Playing";
    }

    cell.revealed = true;

    if(cell.mine){
      // BOOM
      over=true; started=false;
      statusEl.textContent="Boom!";
      // reveal all mines
      for(let rr=0; rr<ROWS; rr++) for(let cc=0; cc<COLS; cc++){
        if(state.board[rr][cc].mine) state.board[rr][cc].revealed = true;
      }
      render(); return;
    }

    // flood fill on zero
    if(cell.adj===0){
      flood(c,r);
    }

    // quick open/chord: if clicking a number and flags==adj, open neighbors
    quickOpen(c,r);

    checkWin();
    render();
  }

  function quickOpen(c,r){
    const cell = state.board[r][c];
    if(!cell.revealed || cell.adj<=0) return;
    let flags=0;
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
      if(dr===0&&dc===0) continue;
      const rr=r+dr, cc=c+dc;
      if(inBounds(cc,rr) && state.board[rr][cc].flagged) flags++;
    }
    if(flags===cell.adj){
      for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
        if(dr===0&&dc===0) continue;
        const rr=r+dr, cc=c+dc;
        if(inBounds(cc,rr) && !state.board[rr][cc].flagged && !state.board[rr][cc].revealed){
          reveal(cc,rr);
        }
      }
    }
  }

  function flood(c,r){
    const q=[[c,r]];
    const seen = new Set([r+","+c]);
    while(q.length){
      const [x,y] = q.shift();
      for(let dr=-1;dr<=1;dr++){
        for(let dc=-1;dc<=1;dc++){
          const rr=y+dr, cc=x+dc;
          if(!inBounds(cc,rr)) continue;
          const key = rr+","+cc;
          const cell = state.board[rr][cc];
          if(cell.revealed || cell.flagged || cell.mine) continue;
          cell.revealed = true;
          if(cell.adj===0 && !seen.has(key)){
            seen.add(key); q.push([cc,rr]);
          }
        }
      }
    }
  }

  function toggleFlag(c,r){
    if(!inBounds(c,r)) return;
    const cell = state.board[r][c];
    if(cell.revealed) return;
    cell.flagged = !cell.flagged;
    state.flags += cell.flagged ? 1 : -1;
    minesLeftEl.textContent = String(state.mines - state.flags);
    render();
  }

  function checkWin(){
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        const cell = state.board[r][c];
        if(!cell.mine && !cell.revealed) return;
      }
    }
    won=true; started=false; statusEl.textContent="Cleared!";
  }

  // Timer
  function tick(ts){
    if(!lastTs) lastTs = ts;
    const dt = ts - lastTs; lastTs = ts;
    if(started) timeMs += dt;
    timeEl.textContent = String(Math.floor(timeMs/1000));
    render();
    requestAnimationFrame(tick);
  }

  // Drawing
  function render(){
    // board back
    ctx.fillStyle = COL.panel; ctx.fillRect(0,0,W,H);

    // cells
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        const x = PADX + c*TILE, y = PADY + r*TILE;
        const cell = state.board[r][c];

        // cell background
        if(cell.revealed){
          ctx.fillStyle = COL.reveal;
        } else {
          // checkerboard for hidden
          const check = ((r+c)&1)===0;
          ctx.fillStyle = check ? COL.cell : COL.cell2;
        }
        ctx.fillRect(x,y,TILE,TILE);

        // grid line
        ctx.strokeStyle = COL.grid;
        ctx.strokeRect(x+0.5,y+0.5,TILE-1,TILE-1);

        if(cell.revealed){
          if(cell.mine){
            // bomb
            drawBomb(x,y);
          }else if(cell.adj>0){
            ctx.fillStyle = COL.n[cell.adj];
            ctx.font = `${Math.floor(TILE*0.6)}px system-ui,Segoe UI,Roboto,Arial`;
            ctx.textAlign = "center"; ctx.textBaseline="middle";
            ctx.fillText(String(cell.adj), x+TILE/2, y+TILE/2+1);
          }
        } else if(cell.flagged){
          drawFlag(x,y);
        }
      }
    }

    // overlay text
    if(over || won){
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle = COL.text; ctx.textAlign="center";
      ctx.font = "700 26px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      ctx.fillText(won ? "You Win!" : "Boom!", W/2, H/2 - 8);
      ctx.font = "500 16px system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      ctx.fillText("Press Reset to play again", W/2, H/2 + 18);
    }
  }

  function drawBomb(x,y){
    const cx=x+TILE/2, cy=y+TILE/2, r=TILE*0.28;
    ctx.fillStyle = COL.bomb;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
    // fuse
    ctx.strokeStyle = COL.bomb; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx+r*0.7, cy-r*0.7); ctx.lineTo(cx+r*1.2, cy-r*1.2); ctx.stroke();
  }

  function drawFlag(x,y){
    ctx.fillStyle = COL.flag;
    // pole
    ctx.fillRect(x+TILE*0.55, y+TILE*0.2, 2, TILE*0.6);
    // flag triangle
    ctx.beginPath();
    ctx.moveTo(x+TILE*0.55, y+TILE*0.2);
    ctx.lineTo(x+TILE*0.3, y+TILE*0.32);
    ctx.lineTo(x+TILE*0.55, y+TILE*0.44);
    ctx.closePath(); ctx.fill();
    // base
    ctx.fillRect(x+TILE*0.48, y+TILE*0.78, TILE*0.18, 3);
  }

  // Boot
  init();
  requestAnimationFrame(tick);
})();
