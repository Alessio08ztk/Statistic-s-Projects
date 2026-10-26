const $=s=>document.querySelector(s);
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmt=x=>!isFinite(x)?'–':Math.abs(x)>=100?x.toFixed(0):Math.abs(x)>=1?x.toPrecision(3):x.toPrecision(2);

/* ---------- normal distribution helpers ---------- */
function erf(x){const t=1/(1+.3275911*Math.abs(x)),y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);return x>=0?y:-y}
const Phi=x=>.5*(1+erf(x/Math.SQRT2));
const pdf=(x,m,s)=>Math.exp(-.5*((x-m)/s)**2)/(s*Math.sqrt(2*Math.PI));

/* ---------- model + simulation ---------- */
function params(){
 const bern=$('#model').value==='bern',p=bern?+$('#p').value:.5;
 const mu=bern?p:0,v=bern?p*(1-p):1;
 return{bern,p,mu,v,sd:Math.sqrt(v),h:bern?1:2,
  n:Math.max(10,Math.min(20000,Math.round(+$('#n').value)||1000)),
  m:Math.max(10,Math.min(5000,Math.round(+$('#m').value)||1000)),
  eps:+$('#eps').value>0?+$('#eps').value:.05};
}
// every attacker walks through n systems; we keep the running sum at the checkpoints
// and the full path (on a roughly geometric grid of k) for the first few attackers
function simulate(P,cps){
 const ks=[];for(let i=1;i<=P.n;i=Math.max(i+1,Math.floor(i*1.02)))ks.push(i);
 const marks=[...new Set([...ks,...cps])].sort((a,b)=>a-b),cpIdx=new Map(cps.map((c,i)=>[c,i]));
 const S=cps.map(()=>new Float64Array(P.m)),paths=[],K=Math.min(P.m,12);
 for(let a=0;a<P.m;a++){
  let s=0,j=0;const path=a<K?[]:null;
  for(let i=1;i<=P.n;i++){
   s+=P.bern?(Math.random()<P.p?1:0):(Math.random()<.5?1:-1);
   if(i===marks[j]){if(cpIdx.has(i))S[cpIdx.get(i)][a]=s;if(path)path.push(s);j++}
  }
  if(path)paths.push(path);
 }
 return{S,paths,marks};
}
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const variance=a=>{const m=mean(a);return a.reduce((s,v)=>s+(v-m)**2,0)/a.length};
function ks(z){const s=[...z].sort((a,b)=>a-b),m=s.length;let d=0;
 s.forEach((x,i)=>{const F=Phi(x);d=Math.max(d,Math.abs((i+1)/m-F),Math.abs(i/m-F))});return d}

/* ---------- drawing ---------- */
function frame(cv,x0,x1,y0,y1,xt,yt){
 const c=cv.getContext('2d'),W=cv.width,H=cv.height,L=44,R=8,T=8,B=24;
 c.clearRect(0,0,W,H);c.font='10px monospace';c.lineWidth=1;
 const X=x=>L+(x-x0)/(x1-x0)*(W-L-R),Y=y=>H-B-(y-y0)/(y1-y0)*(H-B-T);
 c.strokeStyle=css('--line');c.fillStyle=css('--mute');
 yt.forEach(v=>{c.beginPath();c.moveTo(L,Y(v));c.lineTo(W-R,Y(v));c.stroke();c.fillText(fmt(v),2,Y(v)+3)});
 xt.forEach(([v,lab])=>{c.fillText(lab,X(v)-8,H-8)});
 c.strokeRect(L,T,W-L-R,H-T-B);
 c.save();c.beginPath();c.rect(L,T,W-L-R,H-T-B);c.clip();
 return{c,X,Y,done:()=>c.restore()};
}
const ticks=(a,b,k=4)=>[...Array(k+1)].map((_,i)=>a+(b-a)*i/k);
function trajPlot(cv,R,P,tf,refs){
 const logx=$('#logx').checked,n=P.n,m=R.marks;
 const X0=logx?0:0,X1=logx?Math.log10(n):n,xf=k=>logx?Math.log10(k):k;
 let lo=Infinity,hi=-Infinity;
 const pts=R.paths.map(p=>p.map((s,i)=>{const y=tf(m[i],s);lo=Math.min(lo,y);hi=Math.max(hi,y);return[xf(m[i]),y]}));
 const rl=refs.map(r=>m.map(k=>{const y=r.f(k);lo=Math.min(lo,y);hi=Math.max(hi,y);return[xf(k),y]}));
 const pad=(hi-lo)*.05||1;lo-=pad;hi+=pad;
 const xt=logx?[...Array(Math.floor(Math.log10(n))+1)].map((_,i)=>[i,'1e'+i]):ticks(0,n).map(v=>[v,String(Math.round(v))]);
 const f=frame(cv,X0,X1,lo,hi,xt,ticks(lo,hi));
 const line=(arr,col,w,dash)=>{f.c.beginPath();f.c.strokeStyle=col;f.c.lineWidth=w;f.c.setLineDash(dash||[]);arr.forEach(([x,y],i)=>i?f.c.lineTo(f.X(x),f.Y(y)):f.c.moveTo(f.X(x),f.Y(y)));f.c.stroke()};
 f.c.globalAlpha=.75;pts.forEach(p=>line(p,css('--acc2'),1));f.c.globalAlpha=1;
 rl.forEach((r,i)=>line(r,css('--acc'),1.5,refs[i].dash?[5,4]:[]));
 f.done();
}
function histPlot(cv,data,h,mu,sd){
 const m=data.length;let lo=Infinity,hi=-Infinity;for(const x of data){if(x<lo)lo=x;if(x>hi)hi=x}
 const w=h*Math.max(1,Math.ceil((hi-lo)/(30*h))),st=lo-h/2,nb=Math.floor((hi+h/2-st)/w+1e-9)+1,cnt=Array(nb).fill(0);
 for(const x of data)cnt[Math.min(nb-1,Math.floor((x-st)/w+1e-9))]++;
 const dens=cnt.map(c=>c/(m*w));
 const x0=Math.min(st,mu-3.5*sd),x1=Math.max(st+nb*w,mu+3.5*sd),ymax=Math.max(...dens,pdf(mu,mu,sd))*1.1;
 const f=frame(cv,x0,x1,0,ymax,ticks(x0,x1).map(v=>[v,fmt(v)]),ticks(0,ymax,3));
 f.c.fillStyle=css('--acc2');f.c.globalAlpha=.6;
 dens.forEach((d,i)=>f.c.fillRect(f.X(st+i*w),f.Y(d),f.X(st+(i+1)*w)-f.X(st+i*w)-1,f.Y(0)-f.Y(d)));
 f.c.globalAlpha=1;f.c.beginPath();f.c.strokeStyle=css('--acc');f.c.lineWidth=2;
 for(let i=0;i<=200;i++){const x=x0+(x1-x0)*i/200;i?f.c.lineTo(f.X(x),f.Y(pdf(x,mu,sd))):f.c.moveTo(f.X(x),f.Y(pdf(x,mu,sd)))}
 f.c.stroke();f.done();
}

/* ---------- main ---------- */
function run(){
 const P=params();$('#pv').textContent=P.p.toFixed(2);$('#p').disabled=!P.bern;
 const grid=[10,30,100,300,1000,3000,10000].filter(g=>g<P.n),cps=[...grid,P.n];
 const R=simulate(P,cps),sq=Math.sqrt;
 // trajectories: S_k, S_k/k, S_k/sqrt(k), with the theoretical mean and +-2 sd bands
 trajPlot($('#c1'),R,P,(k,s)=>s,[{f:k=>k*P.mu},{f:k=>k*P.mu+2*P.sd*sq(k),dash:1},{f:k=>k*P.mu-2*P.sd*sq(k),dash:1}]);
 trajPlot($('#c2'),R,P,(k,s)=>s/k,[{f:k=>P.mu},{f:k=>P.mu+2*P.sd/sq(k),dash:1},{f:k=>P.mu-2*P.sd/sq(k),dash:1}]);
 trajPlot($('#c3'),R,P,(k,s)=>s/sq(k),[{f:k=>P.mu*sq(k)},{f:k=>P.mu*sq(k)+2*P.sd,dash:1},{f:k=>P.mu*sq(k)-2*P.sd,dash:1}]);
 // distributions at the chosen n
 const n=P.n,last=R.S[cps.length-1],A=Array.from(last),B=A.map(s=>s/n),C=A.map(s=>s/sq(n));
 histPlot($('#h1'),A,P.h,n*P.mu,sq(n)*P.sd);
 histPlot($('#h2'),B,P.h/n,P.mu,P.sd/sq(n));
 histPlot($('#h3'),C,P.h/sq(n),P.mu*sq(n),P.sd);
 $('#sum').innerHTML=`n = ${n} systems, m = ${P.m} attackers. Average total over attackers: <b>${fmt(mean(A))}</b> (theory ${fmt(n*P.mu)}), standard error ≈ ${fmt(P.sd*sq(n/P.m))}. `+
  `Sample variance: S<sub>n</sub> <b>${fmt(variance(A))}</b> (theory ${fmt(n*P.v)}), S<sub>n</sub>/n <b>${fmt(variance(B))}</b> (theory ${fmt(P.v/n)}), S<sub>n</sub>/√n <b>${fmt(variance(C))}</b> (theory ${fmt(P.v)}).`;
 // table over increasing n
 $('#tab').innerHTML=cps.map((c,i)=>{
  const a=Array.from(R.S[i]),b=a.map(s=>s/c),d=a.map(s=>s/sq(c)),z=a.map(s=>(s-c*P.mu)/(P.sd*sq(c)));
  const dev=b.filter(x=>Math.abs(x-P.mu)>P.eps).length/P.m,cheb=Math.min(1,P.v/(c*P.eps*P.eps));
  return`<tr><td>${c}</td><td>${fmt(mean(b))}</td><td>${fmt(variance(a))} / ${fmt(c*P.v)}</td><td>${fmt(variance(b))} / ${fmt(P.v/c)}</td><td>${fmt(variance(d))} / ${fmt(P.v)}</td><td>${fmt(dev)} ≤ ${fmt(cheb)}</td><td>${ks(z).toFixed(3)}</td></tr>`}).join('');
 $('#muTxt').textContent=fmt(P.mu);$('#epsTxt').textContent=P.eps;
}
['model','p','n','m','eps','logx'].forEach(id=>$('#'+id).onchange=run);
$('#p').oninput=()=>$('#pv').textContent=(+$('#p').value).toFixed(2);
$('#go').onclick=run;
run();
