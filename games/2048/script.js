"use strict";
(function(){
const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height; const GRID=4; const PADDING=24; const SIZE=Math.min(W,H)-PADDING*2; const TILE=(SIZE-15)/4; // 4 gaps (5*?)
const scoreEl=document.getElementById('score'); const bestEl=document.getElementById('best'); const resetBtn=document.getElementById('resetBtn');


const theme={bg:get('--panel','#fff'), grid:'#e5e7eb', text:get('--text','#0f172a')};
function get(n,f){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||f}
const colors={
0:'#edeff5', 2:'#e6f0ff',4:'#dbeafe',8:'#fee2e2',16:'#fde68a',32:'#fca5a5',64:'#f87171',128:'#fbbf24',256:'#a3e635',512:'#34d399',1024:'#60a5fa',2048:'#a78bfa'
};


let board, score=0, best=Number(localStorage.getItem('best2048')||0), moved=false, over=false;
function init(){ board=[...Array(GRID)].map(()=>Array(GRID).fill(0)); score=0; over=false; addTile(); addTile(); draw(); scoreEl.textContent='0'; bestEl.textContent=String(best); }


function addTile(){ const empty=[]; for(let r=0;r<GRID;r++)for(let c=0;c<GRID;c++) if(board[r][c]===0) empty.push([r,c]); if(!empty.length) return; const [r,c]=empty[Math.floor(Math.random()*empty.length)]; board[r][c]=Math.random()<0.9?2:4; }


function draw(){ ctx.fillStyle=theme.bg; ctx.fillRect(0,0,W,H); // grid box
const startX=(W-SIZE)/2, startY=(H-SIZE)/2; // background
ctx.fillStyle='#f1f5f9'; round(startX,startY,SIZE,SIZE,16); ctx.fill();
for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++){ const x=startX+c*(TILE+5)+5, y=startY+r*(TILE+5)+5; const v=board[r][c]; ctx.fillStyle=colors[v]||'#94a3b8'; round(x,y,TILE,TILE,10); ctx.fill(); if(v){ ctx.fillStyle= (v<=4?'#0f172a':'#fff'); ctx.font=`700 ${v<100? (TILE*0.45|0): v<1000? (TILE*0.38|0): (TILE*0.3|0)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(v), x+TILE/2, y+TILE/2+2); } }
if(over){ ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(0,0,W,H); ctx.fillStyle=theme.text; ctx.textAlign='center'; ctx.font='700 26px system-ui'; ctx.fillText('Game Over', W/2, H/2-8); ctx.font='500 16px system-ui'; ctx.fillText('Press New Game', W/2, H/2+18); }
}
function round(x,y,w,h,r){ const rr=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+rr,y); ctx.arcTo(x+w,y,x+w,y+h,rr); ctx.arcTo(x+w,y+h,x,y+h,rr); ctx.arcTo(x,y+h,x,y,rr); ctx.arcTo(x,y,x+w,y,rr); ctx.closePath(); }


function slideRow(row){ const arr=row.filter(v=>v); for(let i=0;i<arr.length-1;i++){ if(arr[i]===arr[i+1]){ arr[i]*=2; score+=arr[i]; arr.splice(i+1,1);} } while(arr.length<GRID) arr.push(0); return arr; }
function rotateCW(m){ const n=m.length; const r=[...Array(n)].map(()=>Array(n).fill(0)); for(let y=0;y<n;y++) for(let x=0;x<n;x++) r[x][n-1-y]=m[y][x]; return r; }


function move(dir){ if(over) return; // 0=left,1=up,2=right,3=down
let b=board.map(r=>r.slice()); for(let i=0;i<dir;i++) b=rotateCW(b); b=b.map(slideRow); for(let i=0;i<(4-dir)%4;i++) b=rotateCW(b); moved = JSON.stringify(b)!==JSON.stringify(board); board=b; if(moved){ addTile(); } scoreEl.textContent=String(score); if(score>best){ best=score; localStorage.setItem('best2048',String(best)); bestEl.textContent=String(best);} checkOver(); draw(); }


function checkOver(){ for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++){ if(board[r][c]===0) return; const v=board[r][c]; if(r+1<GRID && (board[r+1][c]===v)) return; if(c+1<GRID && (board[r][c+1]===v)) return; } over=true; }


window.addEventListener('keydown', e=>{ const k=e.key.toLowerCase(); if(['arrowleft','a'].includes(k)) move(0); if(['arrowup','w'].includes(k)) move(1); if(['arrowright','d'].includes(k)) move(2); if(['arrowdown','s'].includes(k)) move(3); });


// touch swipe
let sx=0,sy=0; canvas.addEventListener('touchstart',e=>{ const t=e.touches[0]; sx=t.clientX; sy=t.clientY; },{passive:true});
canvas.addEventListener('touchend',e=>{ const t=e.changedTouches[0]; const dx=t.clientX-sx, dy=t.clientY-sy; if(Math.hypot(dx,dy)<16) return; if(Math.abs(dx)>Math.abs(dy)) move(dx>0?2:0); else move(dy>0?3:1); },{passive:true});


const resetBtnEl=document.getElementById('resetBtn'); resetBtnEl.addEventListener('click', init);


init();
})();