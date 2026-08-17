"use strict";
(function(){
  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d');
  const W=canvas.width,H=canvas.height;

  // Board geometry (draw 480x480 board centered)
  const SIZE=480, TILE=SIZE/8, OFFX=(W-SIZE)/2, OFFY=(H-SIZE)/2;

  // HUD
  const turnEl=document.getElementById('turn');
  const statusEl=document.getElementById('status');
  const resetBtn=document.getElementById('resetBtn');

  // Theme from CSS (light)
  const C={
    light:get('--light','#f3f4f6'),
    dark:get('--dark','#4b5563'),
    bg:get('--bg','#ffffff'),
    text:get('--text','#0f172a'),
    acc:get('--accent','#0284c7')
  };
  function get(n,f){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||f}

  // Unicode chess icons
  const GLYPH = {
    wK:"\u2654", wQ:"\u2655", wR:"\u2656", wB:"\u2657", wN:"\u2658", wP:"\u2659",
    bK:"\u265A", bQ:"\u265B", bR:"\u265C", bB:"\u265D", bN:"\u265E", bP:"\u265F",
  };

  // State
  let board, whiteToMove, select=null, legal=[], over=false;

  function start(){
    board=setup();
    whiteToMove=true; select=null; legal=[]; over=false;
    statusEl.textContent="Ready"; updateHUD(); draw();
  }

  function setup(){
    const e=null; const b=[...Array(8)].map(()=>Array(8).fill(e));
    const back=['R','N','B','Q','K','B','N','R'];
    for(let i=0;i<8;i++){ b[0][i]='b'+back[i]; b[1][i]='bP'; b[6][i]='wP'; b[7][i]='w'+back[i]; }
    return b;
  }

  function updateHUD(){ turnEl.textContent=whiteToMove?'White':'Black'; }

  canvas.addEventListener('mousedown', e=>{
    if(over) return;
    const {c,r}=hit(e); if(!inBoard(c,r)) return;
    if(select && includesMove(legal,c,r)){ makeMove(select.c,select.r,c,r); select=null; legal=[]; draw(); return; }
    const piece=board[r][c]; const side=whiteToMove?'w':'b';
    if(piece && piece[0]===side){ select={c,r}; legal=legalMoves(c,r); draw(); }
  });
  resetBtn.addEventListener('click', start);

  function hit(e){
    const rect=canvas.getBoundingClientRect();
    const x=(e.clientX-rect.left)*(canvas.width/rect.width)-OFFX;
    const y=(e.clientY-rect.top)*(canvas.height/rect.height)-OFFY;
    return {c:Math.floor(x/TILE), r:Math.floor(y/TILE)};
  }
  const inBoard=(c,r)=> c>=0&&c<8&&r>=0&&r<8;

  function makeMove(sc,sr,dc,dr){
    const piece=board[sr][sc];
    board[dr][dc]=piece; board[sr][sc]=null;
    // promotions (auto-queen)
    if(piece==='wP' && dr===0) board[dr][dc]='wQ';
    if(piece==='bP' && dr===7) board[dr][dc]='bQ';

    whiteToMove=!whiteToMove; updateHUD();

    // end checks
    const nextSide=whiteToMove?'w':'b';
    const any=anyLegal(nextSide);
    const inChk=isInCheck(nextSide);
    if(!any){
      over=true;
      statusEl.textContent = inChk ? (whiteToMove? 'Black mates' : 'White mates') : 'Stalemate';
    } else {
      statusEl.textContent = inChk ? 'Check' : 'Ready';
    }
  }

  function includesMove(list,c,r){ return list.some(m=>m.c===c&&m.r===r); }

  // ----- Move generation (no castling / en passant) -------------------------
  function legalMoves(c,r){
    const piece=board[r][c]; if(!piece) return [];
    const side=piece[0], type=piece[1], enemy= side==='w'?'b':'w';
    const res=[], add=(cc,rr)=>{ if(!inBoard(cc,rr)) return; const t=board[rr][cc]; if(!t||t[0]!==side) res.push({c:cc,r:rr}); };

    if(type==='P'){
      const dir= side==='w'?-1:1;
      if(inBoard(c,r+dir) && !board[r+dir][c]) res.push({c:c,r:r+dir});
      const startR= side==='w'?6:1;
      if(r===startR && !board[r+dir][c] && !board[r+2*dir][c]) res.push({c:c,r:r+2*dir});
      for(const dc of [-1,1]){ const cc=c+dc, rr=r+dir; if(inBoard(cc,rr)&& board[rr][cc] && board[rr][cc][0]===enemy) res.push({c:cc,r:rr}); }
    }
    if(type==='N'){
      const K=[[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
      for(const [dx,dy] of K) add(c+dx,r+dy);
    }
    if(type==='B'||type==='R'||type==='Q'){
      const rays=[];
      if(type==='B'||type==='Q') rays.push([1,1],[1,-1],[-1,1],[-1,-1]);
      if(type==='R'||type==='Q') rays.push([1,0],[-1,0],[0,1],[0,-1]);
      for(const [dx,dy] of rays){
        let cc=c+dx, rr=r+dy;
        while(inBoard(cc,rr)){
          const t=board[rr][cc];
          if(!t) res.push({c:cc,r:rr}); else { if(t[0]!==side) res.push({c:cc,r:rr}); break; }
          cc+=dx; rr+=dy;
        }
      }
    }
    if(type==='K'){
      for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++){ if(dx||dy) add(c+dx,r+dy); }
    }
    return res.filter(m=> !leavesKingInCheck(c,r,m.c,m.r));
  }

  function leavesKingInCheck(sc,sr,dc,dr){
    const piece=board[sr][sc]; const saved=board[dr][dc];
    board[dr][dc]=piece; board[sr][sc]=null;
    const bad=isInCheck(piece[0]);
    board[sr][sc]=piece; board[dr][dc]=saved;
    return bad;
  }

  function isInCheck(side){
    let kc=-1, kr=-1;
    for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(board[r][c]===side+'K'){ kc=c; kr=r; }
    const enemy= side==='w'?'b':'w';

    const K=[[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
    for(const [dx,dy] of K){ const c=kc+dx,r=kr+dy; if(inBoard(c,r)&& board[r][c]===enemy+'N') return true; }

    const dir= side==='w'?-1:1;
    for(const dc of [-1,1]){ const c=kc+dc,r=kr+dir; if(inBoard(c,r)&& board[r][c]===enemy+'P') return true; }

    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++){
      if(dx||dy){ const c=kc+dx,r=kr+dy; if(inBoard(c,r)&& board[r][c]===enemy+'K') return true; }
    }

    const rays=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for(const [dx,dy] of rays){
      let c=kc+dx,r=kr+dy;
      while(inBoard(c,r)){
        const t=board[r][c];
        if(t){
          if(t[0]===enemy){
            const T=t[1];
            if((dx===0||dy===0) && (T==='R'||T==='Q')) return true;
            if((dx!==0&&dy!==0) && (T==='B'||T==='Q')) return true;
          }
          break;
        }
        c+=dx; r+=dy;
      }
    }
    return false;
  }

  function anyLegal(side){
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const p=board[r][c]; if(p&&p[0]===side){ if(legalMoves(c,r).length) return true; }
    }
    return false;
  }
  // -------------------------------------------------------------------------

  // Drawing
  function draw(){
    // panel
    ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);

    // board squares
    for(let r=0;r<8;r++){
      for(let c=0;c<8;c++){
        const x=OFFX+c*TILE, y=OFFY+r*TILE;
        ctx.fillStyle=(r+c)%2 ? C.dark : C.light;
        ctx.fillRect(x,y,TILE,TILE);
      }
    }

    // selection
    if(select){
      ctx.fillStyle='rgba(2,132,199,.15)';
      ctx.fillRect(OFFX+select.c*TILE, OFFY+select.r*TILE, TILE, TILE);
      for(const m of legal){
        ctx.fillStyle='rgba(2,132,199,.28)';
        ctx.beginPath();
        ctx.arc(OFFX+m.c*TILE+TILE/2, OFFY+m.r*TILE+TILE/2, 7, 0, Math.PI*2);
        ctx.fill();
      }
    }

    // pieces (Unicode glyphs) — outlined for readability
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const fontSize = Math.floor(TILE*0.78);
    // broader glyph stack so icons render on more systems
    const stack = `"DejaVu Sans","Segoe UI Symbol","Noto Sans Symbols","Symbola",system-ui,sans-serif`;
    ctx.font = `700 ${fontSize}px ${stack}`;

    for(let r=0;r<8;r++){
      for(let c=0;c<8;c++){
        const p=board[r][c]; if(!p) continue;
        const glyph = GLYPH[p]; if(!glyph) continue;
        const x=OFFX+c*TILE+TILE/2, y=OFFY+r*TILE+TILE/2 + 2;

        // fill + dark outline (helps on light squares)
        const isWhite = p[0]==='w';
        ctx.lineWidth = 2;
        ctx.strokeStyle = isWhite ? "rgba(15,23,42,.7)" : "rgba(255,255,255,.65)";
        ctx.fillStyle   = isWhite ? "#ffffff"          : "#0b1020";
        ctx.strokeText(glyph, x, y);
        ctx.fillText(glyph, x, y);
      }
    }

    if(over){
      ctx.fillStyle="rgba(0,0,0,.35)";
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle=C.text; ctx.textAlign="center";
      ctx.font="700 26px system-ui,Segoe UI,Roboto,Arial";
      ctx.fillText(statusEl.textContent, W/2, H/2);
    }
  }

  start();
})();
