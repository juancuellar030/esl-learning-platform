"use strict";
(function(){
const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height;
const scoreEl=document.getElementById('score');
const highEl=document.getElementById('high');
const resetBtn=document.getElementById('resetBtn');
const COL={bg:css('--panel','#0e1424'),grid:css('--grid','#14203a'),text:css('--text','#e6f2ff'),bird:css('--bird','#facc15'),pipe:css('--pipe','#22c55e'),pipe2:css('--pipe2','#16a34a')};
function css(n,f){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||f}


const GRAV=980, FLAP=-300, PIPE_GAP=150, PIPE_W=66, PIPE_SPACING=2000, SPEED=140; // px, ms
let bird, pipes, score=0, high=Number(localStorage.getItem('flappy_high')||0), over=false, started=false, last=0, spawnTimer=0;


function init(){ bird={x:W*0.28,y:H*0.5,vy:0,r:14}; pipes=[]; score=0; over=false; started=false; spawnTimer=0; scoreEl.textContent='0'; highEl.textContent=high; }
function flap(){ if(over) return; started=true; bird.vy=FLAP; }


canvas.addEventListener('mousedown', flap); window.addEventListener('keydown',e=>{ if(e.code==='Space'||e.key===' '){ e.preventDefault(); flap(); } }); resetBtn.addEventListener('click',init);


function spawnPipe(){ const margin=40; const gapY=margin+Math.random()*(H-2*margin-PIPE_GAP); pipes.push({x:W+20, top:{h:gapY}, bot:{y:gapY+PIPE_GAP,h:H-(gapY+PIPE_GAP)}, passed:false}); }


function update(dt){ if(over) return; if(started){ bird.vy+=GRAV*(dt/1000); bird.y+=bird.vy*(dt/1000); spawnTimer+=dt; if(spawnTimer>PIPE_SPACING){ spawnTimer=0; spawnPipe(); } for(const p of pipes){ p.x-=SPEED*(dt/1000); if(!p.passed && p.x+PIPE_W<bird.x){ p.passed=true; score++; scoreEl.textContent=String(score); if(score>high){ high=score; localStorage.setItem('flappy_high',String(high)); highEl.textContent=high; } } } }
// collisions
if(bird.y-bird.r<0 || bird.y+bird.r>H) over=true; for(const p of pipes){ if(bird.x+bird.r>p.x && bird.x-bird.r<p.x+PIPE_W){ if(bird.y-bird.r< p.top.h || bird.y+bird.r> p.bot.y){ over=true; } } }
}
function render(){ ctx.fillStyle=COL.bg; ctx.fillRect(0,0,W,H); // grid
ctx.strokeStyle=COL.grid; ctx.lineWidth=1; ctx.beginPath(); for(let x=0;x<=W;x+=36){ctx.moveTo(x+0.5,0);ctx.lineTo(x+0.5,H);} for(let y=0;y<=H;y+=36){ctx.moveTo(0,y+0.5);ctx.lineTo(W,y+0.5);} ctx.stroke();
// pipes
for(const p of pipes){ ctx.fillStyle=COL.pipe; ctx.fillRect(p.x,0,PIPE_W,p.top.h); ctx.fillStyle=COL.pipe2; ctx.fillRect(p.x,p.bot.y,PIPE_W,p.bot.h); }
// bird
ctx.fillStyle=COL.bird; ctx.beginPath(); ctx.arc(bird.x,bird.y,bird.r,0,Math.PI*2); ctx.fill();
if(!started&&!over){ ctx.fillStyle=COL.text; ctx.textAlign='center'; ctx.font='600 16px system-ui'; ctx.fillText('Click / Space to Flap', W/2, H*0.5); }
if(over){ ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(0,0,W,H); ctx.fillStyle=COL.text; ctx.textAlign='center'; ctx.font='700 26px system-ui'; ctx.fillText('Game Over', W/2, H/2-8); ctx.font='500 16px system-ui'; ctx.fillText('Click Restart to play again', W/2, H/2+18); }
}


function loop(t){ const dt=(t-last)||0; last=t; update(dt); render(); requestAnimationFrame(loop); }


init(); requestAnimationFrame(loop);
})();