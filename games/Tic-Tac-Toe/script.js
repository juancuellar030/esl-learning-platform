"use strict";
(function(){
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W=canvas.width, H=canvas.height;
  const turnEl=document.getElementById("turn");
  const scoreEl=document.getElementById("score");
  const modeEl=document.getElementById("mode");
  const resetBtn=document.getElementById("resetBtn");
  const modeSel=document.getElementById("modeSel");

  // Pull colors from CSS (updated to neon palette)
  const COL={
    bg:get("--bg","#0e1022"),
    grid:get("--grid","#1b1f3e"),
    text:get("--text","#eaf2ff"),
    x:get("--x","#36e8ff"),
    o:get("--o","#ff4db8")
  };
  function get(n,f){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||f}
  function withAlpha(hex, a){
    const h=hex.replace("#",""); const f=h.length===3?h.split("").map(c=>c+c).join(""):h;
    const n=parseInt(f,16); const r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    return `rgba(${r},${g},${b},${a})`;
  }

  const cell=Math.min(W,H)/3|0;
  const offsetX=(W-cell*3)/2|0, offsetY=(H-cell*3)/2|0;

  let board, turn, score={X:0,O:0}; let mode="ai"; let over=false;

  function init(){ board=Array(9).fill(null); turn='X'; over=false; updateHUD(); render(); maybeAIMove(); }
  function updateHUD(){ turnEl.textContent=turn; scoreEl.textContent=`${score.X}–${score.O}`; modeEl.textContent= mode==="ai"?"1P (AI)":"2P"; }

  canvas.addEventListener('click', e=>{
    if(over) return;
    const {c,r}=hit(e);
    if(c<0||c>2||r<0||r>2) return;
    const i=r*3+c; if(board[i]) return;
    move(i);
    if(!over) maybeAIMove();
  });
  function hit(e){
    const rect=canvas.getBoundingClientRect();
    const x=(e.clientX-rect.left)*(canvas.width/rect.width) - offsetX;
    const y=(e.clientY-rect.top)*(canvas.height/rect.height) - offsetY;
    return {c:Math.floor(x/cell), r:Math.floor(y/cell)};
  }
  resetBtn.addEventListener('click', ()=>{score={X:0,O:0}; init();});
  modeSel.addEventListener('change', ()=>{ mode=modeSel.value; updateHUD(); init(); });

  function move(i){
    if(board[i]||over) return;
    board[i]=turn;
    const w=winner(board);
    if(w||isFull(board)){ over=true; if(w){ score[w]++; } setTimeout(init, 900); }
    turn=turn==='X'?'O':'X';
    render(); updateHUD();
  }

  function maybeAIMove(){
    if(mode!=="ai"||over||turn!=='O') return;
    const i=bestMove(board,'O');
    if(i!=null) setTimeout(()=>move(i), 180);
  }
  function bestMove(b, me){
    let best=-Infinity, bestIdx=null;
    for(let i=0;i<9;i++){
      if(!b[i]){ b[i]=me; const v=minimax(b,false,me); b[i]=null; if(v>best){best=v; bestIdx=i;} }
    }
    return bestIdx;
  }
  function minimax(b, isMax, me){
    const w=winner(b); if(w) return w===me? 1 : -1;
    if(isFull(b)) return 0;
    const cur=isMax?me:(me==='X'?'O':'X');
    let best=isMax?-Infinity:Infinity;
    for(let i=0;i<9;i++){
      if(!b[i]){ b[i]=cur; const val=minimax(b,!isMax,me); b[i]=null;
        best= isMax? Math.max(best,val): Math.min(best,val);
      }
    }
    return best;
  }
  function winner(b){
    const L=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(const [a,c,d] of L){ if(b[a]&&b[a]===b[c]&&b[a]===b[d]) return b[a]; }
    return null;
  }
  const isFull=b=>b.every(Boolean);

  function render(){
    // panel background
    ctx.fillStyle=COL.bg; ctx.fillRect(0,0,W,H);

    // board grid
    ctx.strokeStyle=COL.grid; ctx.lineWidth=6;
    for(let i=1;i<3;i++){
      ctx.beginPath(); ctx.moveTo(offsetX+i*cell, offsetY); ctx.lineTo(offsetX+i*cell, offsetY+cell*3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(offsetX, offsetY+i*cell); ctx.lineTo(offsetX+cell*3, offsetY+i*cell); ctx.stroke();
    }

    // pieces
    for(let r=0;r<3;r++){
      for(let c=0;c<3;c++){
        const v=board[r*3+c]; if(!v) continue;
        const x=offsetX+c*cell, y=offsetY+r*cell;
        if(v==='X') drawX(x,y); else drawO(x,y);
      }
    }

    if(over){
      const w=winner(board);
      ctx.fillStyle=COL.text; ctx.font='700 26px system-ui,Segoe UI,Roboto,Arial';
      ctx.textAlign='center';
      ctx.fillText(w? `${w} wins!`:'Draw', W/2, H-24);
    }
  }

  // --- Neon strokes ---------------------------------------------------------
  function drawX(x,y){
    const p=cell*0.2, q=cell*0.8;

    // halo (additive glow)
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.shadowColor=COL.x;
    ctx.shadowBlur=18;
    ctx.strokeStyle=withAlpha(COL.x,0.22);
    ctx.lineWidth=14; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(x+p,y+p); ctx.lineTo(x+q,y+q); ctx.moveTo(x+q,y+p); ctx.lineTo(x+p,y+q); ctx.stroke();
    ctx.restore();

    // core
    ctx.strokeStyle=COL.x; ctx.lineWidth=8; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(x+p,y+p); ctx.lineTo(x+q,y+q); ctx.moveTo(x+q,y+p); ctx.lineTo(x+p,y+q); ctx.stroke();
  }

  function drawO(x,y){
    const R=cell*0.34;

    // halo
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.shadowColor=COL.o;
    ctx.shadowBlur=18;
    ctx.strokeStyle=withAlpha(COL.o,0.22);
    ctx.lineWidth=14;
    ctx.beginPath(); ctx.arc(x+cell/2,y+cell/2,R,0,Math.PI*2); ctx.stroke();
    ctx.restore();

    // core
    ctx.strokeStyle=COL.o; ctx.lineWidth=8;
    ctx.beginPath(); ctx.arc(x+cell/2,y+cell/2,R,0,Math.PI*2); ctx.stroke();
  }
  // --------------------------------------------------------------------------

  init();
})();
