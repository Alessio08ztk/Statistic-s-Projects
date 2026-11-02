const $=s=>document.querySelector(s);
const fmt=x=>!isFinite(x)?'–':x===0?'0':Math.abs(x)>=1e5||Math.abs(x)<1e-3?x.toExponential(3):Math.abs(x)>=100?x.toFixed(1):x.toPrecision(4);

/* ---------- two links, one page ---------- */
function route(){
 const two=location.hash==='#ex2';
 $('#ex1').hidden=two;$('#ex2').hidden=!two;
 $('#l1').className=two?'':'on';$('#l2').className=two?'on':'';
}
window.onhashchange=route;

/* =============== Exercise 1 =============== */
// the whole recurrence is these three lines
function welford(xs){
 let n=0,mean=0,ss=0;const rows=[];
 for(const x of xs){
  n++;
  const d=x-mean;        // delta = x_n - mean_(n-1)
  mean+=d/n;             // Knuth:   mean_n = mean_(n-1) + delta/n
  ss+=d*(x-mean);        // Welford: SS_n   = SS_(n-1) + delta*(x_n - mean_n)
  rows.push({n,x,mean,ss});
 }
 return rows;
}
function steps(){
 const xs=$('#nums').value.split(/[\s,;]+/).map(Number).filter(v=>$('#nums').value.trim()&&isFinite(v));
 if(xs.length<2){$('#stepTab').innerHTML='<tr><td colspan="6">need at least two numbers</td></tr>';$('#chk').textContent='';return}
 const rows=welford(xs);
 $('#stepTab').innerHTML=rows.map(r=>`<tr><td>${r.n}</td><td>${r.x}</td><td>${fmt(r.mean)}</td><td>${fmt(r.ss)}</td><td>${r.n>1?fmt(r.ss/(r.n-1)):'–'}</td><td>${fmt(r.ss/r.n)}</td></tr>`).join('');
 const N=xs.length,m=xs.reduce((a,b)=>a+b)/N,ss2=xs.reduce((a,b)=>a+(b-m)**2,0),w=rows[N-1];
 $('#chk').innerHTML=`Check with the usual two-pass formula: mean = ${fmt(m)}, SS = ${fmt(ss2)}, sample variance = ${fmt(ss2/(N-1))}. Welford gives ${fmt(w.mean)}, ${fmt(w.ss)}, ${fmt(w.ss/(N-1))}.`;
}
$('#nums').oninput=steps;

function stability(){
 const off=+$('#off').value||0,N=1000,xs=Array.from({length:N},()=>off+Math.random());
 let s=0,q=0;for(const x of xs){s+=x;q+=x*x}
 const naive=(q-s*s/N)/(N-1);
 const m=s/N,two=xs.reduce((a,x)=>a+(x-m)**2,0)/(N-1);
 const w=welford(xs)[N-1],wv=w.ss/(N-1);
 $('#stab').textContent=`${N} values = ${off} + uniform(0,1); true variance of the distribution is 1/12 = 0.08333\n`+
  `one-pass  (Σx² − (Σx)²/n)/(n−1) : ${naive}\ntwo-pass  Σ(x−mean)²/(n−1)       : ${two}\nWelford                          : ${wv}`;
}
$('#stBtn').onclick=stability;

/* =============== Exercise 2 =============== */
const binom=(n,k)=>{let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return r};
function dist(){
 const t=$('#dist').value,q=+$('#q').value;$('#qv').textContent=q.toFixed(2);$('#q').disabled=t==='unif';
 let pmf=[...Array(11)].map((_,k)=>t==='bin'?binom(10,k)*q**k*(1-q)**(10-k):t==='unif'?1:q**k);
 const z=pmf.reduce((a,b)=>a+b);pmf=pmf.map(v=>v/z);
 const mu=pmf.reduce((s,p,k)=>s+k*p,0),v=pmf.reduce((s,p,k)=>s+p*(k-mu)**2,0),m4=pmf.reduce((s,p,k)=>s+p*(k-mu)**4,0);
 const cdf=[];pmf.reduce((s,p,i)=>(cdf[i]=s+p,s+p),0);
 return{pmf,cdf,mu,v,m4,draw:()=>{const r=Math.random();let k=0;while(k<10&&r>cdf[k])k++;return k}};
}
function hackers(D,n,m){
 const M=new Float64Array(m),V=new Float64Array(m),B=new Float64Array(m);
 for(let j=0;j<m;j++){
  let mean=0,ss=0;
  for(let i=1;i<=n;i++){const x=D.draw(),d=x-mean;mean+=d/i;ss+=d*(x-mean)}   // Welford, as in exercise 1
  M[j]=mean;V[j]=ss/(n-1);B[j]=ss/n;
 }
 return{M,V,B};
}
const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
const vr=a=>{const m=avg(a);return a.reduce((s,v)=>s+(v-m)**2,0)/a.length};

/* ---------- drawing (same small helpers as the previous homework) ---------- */
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function frame(cv,x0,x1,y0,y1,xt,yt){
 const c=cv.getContext('2d'),W=cv.width,H=cv.height,L=46,R=8,T=8,B=24;
 c.clearRect(0,0,W,H);c.font='10px monospace';c.lineWidth=1;c.setLineDash([]);
 const X=x=>L+(x-x0)/(x1-x0)*(W-L-R),Y=y=>H-B-(y-y0)/(y1-y0)*(H-B-T);
 c.strokeStyle=css('--line');c.fillStyle=css('--mute');
 yt.forEach(v=>{c.beginPath();c.moveTo(L,Y(v));c.lineTo(W-R,Y(v));c.stroke();c.fillText(fmt(v),2,Y(v)+3)});
 xt.forEach(([v,l])=>c.fillText(l,X(v)-8,H-8));
 c.strokeRect(L,T,W-L-R,H-T-B);c.save();c.beginPath();c.rect(L,T,W-L-R,H-T-B);c.clip();
 return{c,X,Y,done:()=>c.restore()};
}
const ticks=(a,b,k=4)=>[...Array(k+1)].map((_,i)=>a+(b-a)*i/k);
function vline(f,x,y0,y1,col){f.c.beginPath();f.c.strokeStyle=col;f.c.lineWidth=2;f.c.setLineDash([5,4]);f.c.moveTo(f.X(x),f.Y(y0));f.c.lineTo(f.X(x),f.Y(y1));f.c.stroke();f.c.setLineDash([])}
function hist(cv,data,ref,normal){
 let lo=Infinity,hi=-Infinity;for(const x of data){if(x<lo)lo=x;if(x>hi)hi=x}
 const bins=30,w=(hi-lo)/bins||1,cnt=Array(bins).fill(0);
 for(const x of data)cnt[Math.min(bins-1,Math.floor((x-lo)/w))]++;
 const dens=cnt.map(c=>c/(data.length*w));
 const pdf=x=>normal?Math.exp(-.5*((x-normal[0])/normal[1])**2)/(normal[1]*Math.sqrt(2*Math.PI)):0;
 const x0=Math.min(lo,ref-.2*(hi-lo)),x1=Math.max(hi,ref+.2*(hi-lo)),ymax=Math.max(...dens,pdf(ref))*1.1;
 const f=frame(cv,x0,x1,0,ymax,ticks(x0,x1).map(v=>[v,fmt(v)]),ticks(0,ymax,3));
 f.c.fillStyle=css('--acc2');f.c.globalAlpha=.6;
 dens.forEach((d,i)=>f.c.fillRect(f.X(lo+i*w),f.Y(d),f.X(lo+(i+1)*w)-f.X(lo+i*w)-1,f.Y(0)-f.Y(d)));
 f.c.globalAlpha=1;
 if(normal){f.c.beginPath();f.c.strokeStyle=css('--acc');f.c.lineWidth=2;
  for(let i=0;i<=200;i++){const x=x0+(x1-x0)*i/200;i?f.c.lineTo(f.X(x),f.Y(pdf(x))):f.c.moveTo(f.X(x),f.Y(pdf(x)))}f.c.stroke()}
 vline(f,ref,0,ymax,css('--acc'));f.done();
}
function runPlot(cv,ks,series,ref){
 let lo=ref,hi=ref;series.forEach(s=>s.forEach(y=>{lo=Math.min(lo,y);hi=Math.max(hi,y)}));
 const pad=(hi-lo)*.05||1;lo-=pad;hi+=pad;
 const a=Math.log10(ks[0]),b=Math.log10(ks[ks.length-1]);
 const f=frame(cv,a,b,lo,hi,[...Array(Math.floor(b)+1)].map((_,i)=>[i,'1e'+i]).filter(t=>t[0]>=a),ticks(lo,hi));
 f.c.globalAlpha=.75;f.c.strokeStyle=css('--acc2');f.c.lineWidth=1;
 series.forEach(s=>{f.c.beginPath();s.forEach((y,i)=>i?f.c.lineTo(f.X(Math.log10(ks[i])),f.Y(y)):f.c.moveTo(f.X(Math.log10(ks[i])),f.Y(y)));f.c.stroke()});
 f.c.globalAlpha=1;f.c.strokeStyle=css('--acc');f.c.lineWidth=2;f.c.setLineDash([5,4]);
 f.c.beginPath();f.c.moveTo(f.X(a),f.Y(ref));f.c.lineTo(f.X(b),f.Y(ref));f.c.stroke();f.done();
}

function run(){
 const D=dist(),n=Math.max(2,Math.min(5000,Math.round(+$('#n').value)||100)),m=Math.max(10,Math.min(5000,Math.round(+$('#m').value)||1000));
 const sd=Math.sqrt(D.v);
 // the chosen distribution
 const mx=Math.max(...D.pmf);
 $('#pmf').innerHTML=D.pmf.map((p,k)=>`<div title="P(${k}) = ${p.toFixed(3)}"><i style="height:${100*p/mx}%"></i><b>${k}</b></div>`).join('');
 $('#theo').innerHTML=`μ = <b>${fmt(D.mu)}</b>, σ² = <b>${fmt(D.v)}</b> (σ = ${fmt(sd)})`;
 // running Welford estimates for a few hackers
 const ks=[];for(let i=2;i<=n;i=Math.max(i+1,Math.floor(i*1.03)))ks.push(i);if(ks[ks.length-1]!==n)ks.push(n);
 const rm=[],rv=[];
 for(let h=0;h<8;h++){let mean=0,ss=0,j=0;const a=[],b=[];
  for(let i=1;i<=n;i++){const x=D.draw(),d=x-mean;mean+=d/i;ss+=d*(x-mean);if(i===ks[j]){a.push(mean);b.push(ss/(i-1));j++}}
  rm.push(a);rv.push(b)}
 runPlot($('#c1'),ks,rm,D.mu);runPlot($('#c2'),ks,rv,D.v);
 // table for increasing n
 const grid=[...new Set([2,5,10,30,100,300,1000,n].filter(g=>g<=n))].sort((a,b)=>a-b);let last;
 $('#tab').innerHTML=grid.map(g=>{
  const r=hackers(D,g,m);if(g===n)last=r;
  const tv=(D.m4-(g-3)/(g-1)*D.v**2)/g;
  return`<tr><td>${g}</td><td>${fmt(avg(r.M))}</td><td>${fmt(avg(r.V))}</td><td>${fmt(avg(r.B))} / ${fmt(D.v*(g-1)/g)}</td><td>${fmt(vr(r.M))} / ${fmt(D.v/g)}</td><td>${fmt(vr(r.V))} / ${fmt(tv)}</td></tr>`}).join('');
 hist($('#h1'),last.M,D.mu,[D.mu,sd/Math.sqrt(n)]);
 hist($('#h2'),last.V,D.v,null);
 $('#hn').textContent=n;
}
['dist','q','n','m'].forEach(id=>$('#'+id).onchange=run);
$('#q').oninput=()=>$('#qv').textContent=(+$('#q').value).toFixed(2);
$('#go').onclick=run;

$('#nums').value='2 4 4 4 5 5 7 9';
route();steps();stability();run();
