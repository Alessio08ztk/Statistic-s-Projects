const $=s=>document.querySelector(s);
const PI=Math.PI;
const fmt=x=>x===Infinity?'∞':!isFinite(x)?'–':x===0?'0':Math.abs(x)>=1e5||Math.abs(x)<1e-3?x.toExponential(2):x.toPrecision(5);
const efmt=x=>x===Infinity?'∞':!isFinite(x)?'–':x===0?'0':x.toExponential(2);
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------- two links, one page ---------- */
function route(){
 const two=location.hash==='#ex2';
 $('#ex1').hidden=two;$('#ex2').hidden=!two;
 $('#l1').className=two?'':'on';$('#l2').className=two?'on':'';
}
window.onhashchange=route;

/* ---------- small plotting helper ---------- */
function frame(cv,x0,x1,y0,y1,xt,yt){
 const c=cv.getContext('2d'),W=cv.width,H=cv.height,L=46,R=8,T=8,B=24;
 c.clearRect(0,0,W,H);c.font='10px monospace';c.lineWidth=1;c.setLineDash([]);c.globalAlpha=1;
 const X=x=>L+(x-x0)/(x1-x0)*(W-L-R),Y=y=>H-B-(y-y0)/(y1-y0)*(H-B-T);
 c.strokeStyle=css('--line');c.fillStyle=css('--mute');
 yt.forEach(([v,l])=>{c.beginPath();c.moveTo(L,Y(v));c.lineTo(W-R,Y(v));c.stroke();c.fillText(l,2,Y(v)+3)});
 xt.forEach(([v,l])=>c.fillText(l,X(v)-8,H-8));
 c.strokeRect(L,T,W-L-R,H-T-B);c.save();c.beginPath();c.rect(L,T,W-L-R,H-T-B);c.clip();
 return{c,X,Y,W,H,done:()=>c.restore()};
}
function logPlot(cv,xs,series,names){
 const lx=xs.map(Math.log10),all=series.flat().filter(v=>isFinite(v)).map(v=>Math.log10(Math.max(v,1e-17)));
 let lo=Math.floor(Math.min(...all,-1)),hi=Math.ceil(Math.max(...all,-1));if(hi===lo)hi=lo+1;
 const yt=[];for(let v=lo;v<=hi;v+=Math.max(1,Math.round((hi-lo)/5)))yt.push([v,'1e'+v]);
 const f=frame(cv,lx[0],lx[lx.length-1],lo,hi,lx.filter((_,i)=>i%2===0).map((v,i)=>[v,String(xs[i*2])]),yt);
 const cols=[css('--acc2'),css('--acc')];
 series.forEach((s,k)=>{f.c.strokeStyle=cols[k];f.c.fillStyle=cols[k];f.c.lineWidth=2;f.c.beginPath();let pen=false;
  s.forEach((v,i)=>{if(!isFinite(v)){pen=false;return}const X=f.X(lx[i]),Y=f.Y(Math.log10(Math.max(v,1e-17)));pen?f.c.lineTo(X,Y):f.c.moveTo(X,Y);pen=true});f.c.stroke();
  s.forEach((v,i)=>{if(isFinite(v)){f.c.beginPath();f.c.arc(f.X(lx[i]),f.Y(Math.log10(Math.max(v,1e-17))),2.5,0,7);f.c.fill()}})});
 f.done();
 f.c.font='11px monospace';names.forEach((n,k)=>{f.c.fillStyle=cols[k];f.c.fillText('● '+n,f.W-150,22+14*k)});
}

/* =================================================================
   EXERCISE 1 – Riemann vs Lebesgue
   ================================================================= */
const gcd=(a,b)=>{while(b)[a,b]=[b,a%b];return a};
const Si_pi=1.8519370519824662;     // Si(π) = ∫_0^π sin(x)/x dx, known value
const FN=[
 {id:'sin',  name:'sin(x) on [0, π]',               a:0,b:PI,f:Math.sin,exact:2,m:0,M:1,pieces:[[0,PI/2,'inc'],[PI/2,PI,'dec']]},
 {id:'sq',   name:'x² on [0, 1]',                   a:0,b:1,f:x=>x*x,exact:1/3,m:0,M:1,pieces:[[0,1,'inc']]},
 {id:'s13',  name:'1 if x < 0.5, 3 otherwise',      a:0,b:1,f:x=>x<.5?1:3,exact:2,m:1,M:3,pieces:[[0,.5,'const'],[.5,1,'const']]},
 {id:'abs',  name:'|x − 0.5| on [0, 1]',            a:0,b:1,f:x=>Math.abs(x-.5),exact:.25,m:0,M:.5,pieces:[[0,.5,'dec'],[.5,1,'inc']]},
 {id:'isq',  name:'1/√x on (0, 1]  (unbounded)',    a:0,b:1,f:x=>x===0?Infinity:1/Math.sqrt(x),exact:2,m:1,M:5,unb:true,pieces:[[0,1,'dec']]},
 {id:'s10',  name:'1 if x < 0.5, 0 otherwise',      a:0,b:1,f:x=>x<.5?1:0,exact:.5,m:0,M:1,pieces:[[0,.5,'const'],[.5,1,'const']]},
 {id:'sinc', name:'sin(x)/x on [0, π]',             a:0,b:PI,f:x=>x===0?1:Math.sin(x)/x,exact:Si_pi,m:0,M:1,pieces:[[0,PI,'dec']]},
 {id:'dir',  name:'Dirichlet: 1 on rationals, 0 on irrationals',a:0,b:1,exact:0,m:0,M:1,path:'dir',
  rie:(n,mode)=>({v:mode==='rand'?0:1,ev:n})},       // rational tags give 1, a random real is irrational with probability 1
 {id:'tho',  name:'Thomae: 1/q at p/q, 0 on irrationals',a:0,b:1,exact:0,m:0,M:1,path:'tho',
  rie:(n,mode)=>{if(mode==='rand')return{v:0,ev:n};let s=0;
   for(let i=0;i<n;i++){let p,q;if(mode==='mid'){p=2*i+1;q=2*n}else{p=mode==='left'?i:i+1;q=n}s+=gcd(p,q)/q}   // f(p/q) = 1/(q/g)
   return{v:s/n,ev:n}}}
];
const sel=$('#fn');FN.forEach((f,i)=>sel.add(new Option(f.name,i)));

// Riemann: cut the domain in n cells, evaluate f at one tag per cell
function riemann(fn,n,mode){
 if(fn.rie)return fn.rie(n,mode);
 const h=(fn.b-fn.a)/n;let s=0;
 for(let i=0;i<n;i++){
  const x=mode==='left'?fn.a+i*h:mode==='right'?fn.a+(i+1)*h:mode==='rand'?fn.a+(i+Math.random())*h:fn.a+(i+.5)*h;
  s+=fn.f(x);
 }
 return{v:s*h,ev:n};
}
// Lebesgue: measure of the preimage {x : f(x) >= t}, found piece by piece on monotone stretches
function measureGE(fn,t,cnt){
 let tot=0;
 for(const[a,b,kind]of fn.pieces){
  if(kind==='const'){cnt.n++;if(fn.f((a+b)/2)>=t)tot+=b-a;continue}
  const fa=fn.f(a),fb=fn.f(b);cnt.n+=2;
  const top=kind==='dec'?fa:fb,bot=kind==='dec'?fb:fa;
  if(top<t)continue;
  if(bot>=t){tot+=b-a;continue}
  let lo=a,hi=b;                                  // bisection for the crossing point f(x*) = t
  for(let i=0;i<40;i++){const mid=(lo+hi)/2;cnt.n++;const ok=fn.f(mid)>=t;
   if(kind==='dec'){ok?lo=mid:hi=mid}else{ok?hi=mid:lo=mid}}
  tot+=kind==='dec'?lo-a:b-hi;
 }
 return tot;
}
// N horizontal strips [y_k, y_k+1): lower sum  Σ y_k · μ(preimage of the strip)
function lebesgue(fn,N){
 if(fn.path)return{v:0,ev:0};                      // level sets above 0 are countable: measure 0 (theory, nothing to evaluate)
 const cnt={n:0},m=fn.m,M=fn.unb?Math.max(2,Math.sqrt(N)):fn.M,h=(M-m)/N,G=[];
 for(let k=0;k<N;k++)G.push(measureGE(fn,m+k*h,cnt));
 G.push(0);let s=0;
 for(let k=0;k<N;k++)s+=(m+k*h)*(G[k]-G[k+1]);
 return{v:s,ev:cnt.n};
}

function picture(cv,fn,N,kind){
 const ymax=fn.unb?5:fn.M*1.1,c0=cv.getContext('2d');
 const f=frame(cv,fn.a,fn.b,0,ymax,[[fn.a,fmt(fn.a)],[fn.b,fmt(fn.b)]],[0,ymax/2,ymax].map(v=>[v,fmt(v)]));
 const c=f.c;c.fillStyle=css('--ink');c.strokeStyle=css('--ink');
 if(fn.path){
  c.fillStyle=css('--acc2');
  if(fn.path==='tho'){if(kind==='r')for(let q=1;q<=40;q++)for(let p=0;p<=q;p++)if(gcd(p,q)===1){c.beginPath();c.arc(f.X(p/q),f.Y(1/q),2,0,7);c.fill()}}
  else if(kind==='r'){for(let q=1;q<=12;q++)for(let p=0;p<=q;p++)if(gcd(p,q)===1){c.beginPath();c.arc(f.X(p/q),f.Y(1),2,0,7);c.fill()}
   c.strokeStyle=css('--acc2');c.setLineDash([2,3]);c.beginPath();c.moveTo(f.X(0),f.Y(0));c.lineTo(f.X(1),f.Y(0));c.stroke()}
  if(kind==='l'){c.fillStyle=css('--ink');c.font='12px monospace';
   c.fillText('every level set above 0 is',60,70);c.fillText('countable → measure 0',60,86);c.fillText('Lebesgue integral = 0',60,110)}
  f.done();return;
 }
 const K=300,w=(fn.b-fn.a)/K,Mp=fn.unb?5:fn.M,m=fn.m;
 c.globalAlpha=.45;c.fillStyle=css('--acc2');
 if(kind==='r'){const h=(fn.b-fn.a)/N;
  for(let i=0;i<N;i++){const x=$('#mode').value==='left'?fn.a+i*h:$('#mode').value==='right'?fn.a+(i+1)*h:fn.a+(i+.5)*h;
   const v=Math.min(fn.f(x),ymax);c.fillRect(f.X(fn.a+i*h)+1,f.Y(v),f.X(fn.a+(i+1)*h)-f.X(fn.a+i*h)-1,f.Y(0)-f.Y(v))}}
 else{const h=(Mp-m)/N;
  for(let i=0;i<K;i++){const x=fn.a+(i+.5)*w,v=Math.min(fn.f(x),Mp+1),k=Math.min(N-1,Math.max(0,Math.floor((v-m)/h))),y=m+k*h;
   c.fillRect(f.X(x-w/2),f.Y(y),f.X(x+w/2)-f.X(x-w/2)+.5,f.Y(0)-f.Y(y))}
  c.globalAlpha=.4;c.strokeStyle=css('--line');for(let k=0;k<=N;k++){c.beginPath();c.moveTo(f.X(fn.a),f.Y(m+k*h));c.lineTo(f.X(fn.b),f.Y(m+k*h));c.stroke()}}
 c.globalAlpha=1;c.strokeStyle=css('--acc');c.lineWidth=2;c.beginPath();let pen=false;
 for(let i=0;i<=K;i++){const x=fn.a+i*w,v=fn.f(x);if(!isFinite(v)){pen=false;continue}pen?c.lineTo(f.X(x),f.Y(Math.min(v,ymax*2))):c.moveTo(f.X(x),f.Y(Math.min(v,ymax*2)));pen=true}
 c.stroke();f.done();
}

const NS=[2,4,8,16,32,64,128,256,512,1024,2048,4096],SHOW=[4,16,64,256,1024,4096];
function timeit(fn){const t0=performance.now();let r,reps=0;do{r=fn();reps++}while(performance.now()-t0<6&&reps<200);return{r,ms:(performance.now()-t0)/reps}}
function run1(){
 const fn=FN[+sel.value],mode=$('#mode').value,Np=+$('#np').value;$('#npv').textContent=Np;
 const status=fn.id==='dir'?'<span class="warn">not Riemann integrable</span> (Lebesgue integral = 0)':fn.id==='tho'?'Riemann integrable (integral 0)':fn.unb?'improper Riemann integral; Lebesgue integrable':'Riemann integrable';
 $('#info').innerHTML=`<b>${fn.name}</b> – exact value ${fn.id==='sinc'?'Si(π) ≈ '+fmt(fn.exact):fmt(fn.exact)} – ${status}`;
 picture($('#pr'),fn,Np,'r');picture($('#pl'),fn,Np,'l');
 const R=[],L=[];
 NS.forEach(N=>{const a=timeit(()=>riemann(fn,N,mode)),b=timeit(()=>lebesgue(fn,N));
  R.push({N,v:a.r.v,e:Math.abs(a.r.v-fn.exact),ev:a.r.ev,ms:a.ms});L.push({N,v:b.r.v,e:Math.abs(b.r.v-fn.exact),ev:b.r.ev,ms:b.ms})});
 $('#tab1').innerHTML=NS.map((N,i)=>SHOW.includes(N)?`<tr><td>${N}</td><td>${fmt(R[i].v)}</td><td>${efmt(R[i].e)}</td><td>${R[i].ev}</td><td>${R[i].ms.toFixed(3)}</td><td>${fmt(L[i].v)}</td><td>${efmt(L[i].e)}</td><td>${L[i].ev}</td><td>${L[i].ms.toFixed(3)}</td></tr>`:'').join('');
 logPlot($('#conv'),NS,[R.map(r=>r.e),L.map(r=>r.e)],['Riemann ('+({left:'left',mid:'midpoint',right:'right',rand:'random'}[mode])+')','Lebesgue (lower)']);
 const slope=a=>{const i=NS.indexOf(64),j=NS.indexOf(1024);return(Math.log10(a[j].e)-Math.log10(a[i].e))/(Math.log10(1024)-Math.log10(64))};
 const sr=slope(R),sl=slope(L);
 $('#slope').innerHTML=isFinite(sr)&&isFinite(sl)&&R[6].e>1e-14&&L[6].e>1e-14?`Observed slope between N = 64 and N = 1024: Riemann ≈ <b>${sr.toFixed(2)}</b>, Lebesgue ≈ <b>${sl.toFixed(2)}</b> (error ∝ N<sup>slope</sup>).`:'Slopes are not meaningful here (error is zero, noisy or infinite).';
}
['fn','mode','np'].forEach(id=>$('#'+id).onchange=run1);$('#np').oninput=()=>{$('#npv').textContent=$('#np').value;run1()};

/* =================================================================
   EXERCISE 2 – the normal CDF
   ================================================================= */
const phi=x=>Math.exp(-x*x/2)/Math.sqrt(2*PI);
function trap(x,n){const a=Math.abs(x);if(!a)return .5;const h=a/n;let s=(phi(0)+phi(a))/2;for(let i=1;i<n;i++)s+=phi(i*h);return .5+Math.sign(x)*s*h}
function simp(x,n){n+=n%2;const a=Math.abs(x);if(!a)return .5;const h=a/n;let s=phi(0)+phi(a);for(let i=1;i<n;i++)s+=(i%2?4:2)*phi(i*h);return .5+Math.sign(x)*s*h/3}
// power series:  Φ(x) = 1/2 + φ(x)·( x + x³/3 + x⁵/(3·5) + x⁷/(3·5·7) + … )  (all terms positive for x>0)
function series(x){let t=x,s=x,n=0;while(Math.abs(t)>1e-17*Math.abs(s)&&n<3000){n++;t*=x*x/(2*n+1);s+=t}return{v:.5+phi(x)*s,it:n}}
// continued fraction for the upper tail:  Q(x) = φ(x) / (x + 1/(x + 2/(x + 3/(x + …))))   (x > 0)
function tailCF(x,K){let f=x;for(let k=K;k>=1;k--)f=x+k/f;return phi(x)/f}
function hybrid(x){const a=Math.abs(x);if(a<=2.5){const r=series(x);return{v:r.v,it:r.it}}
 const K=Math.ceil(500/a),Q=tailCF(a,K);return{v:x>0?1-Q:Q,it:K}}
// Abramowitz & Stegun 26.2.17, absolute error < 7.5e-8
function asApprox(x){const a=Math.abs(x),t=1/(1+.2316419*a),p=t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));const Q=phi(a)*p;return x>=0?1-Q:Q}

// reference values found on the web (see the sources at the bottom of the page)
const REF=[[-3,'0.0013498980316300933','SciPy'],[-2,'0.022750131948179195','SciPy'],[-1,'0.15865525393145707','SciPy'],[0,'0.5','A&S'],
 [1,'0.8413447460685429','SciPy'],[1.96,'0.975002104851780','A&S'],[2,'0.9772498680518208','SciPy'],[2.58,'0.995059984242230','A&S'],[3,'0.9986501019683699','SciPy']];

function run2(){
 const n=Math.max(2,Math.round(+$('#np2').value)||20);
 const rows=REF.map(([x,r,src])=>{const ref=Number(r);
  return`<tr><td>${x}</td><td class="mono">${r}</td><td>${src}</td><td>${efmt(Math.abs(hybrid(x).v-ref))}</td><td>${efmt(Math.abs(series(x).v-ref))}</td><td>${efmt(Math.abs(asApprox(x)-ref))}</td><td>${efmt(Math.abs(simp(x,n)-ref))}</td><td>${efmt(Math.abs(trap(x,n)-ref))}</td></tr>`}).join('');
 $('#refTab').innerHTML=rows;$('#nTxt').textContent=n;
 calc();conv();
}
function calc(){
 const x=parseFloat($('#x').value),n=Math.max(2,Math.round(+$('#np2').value)||20);
 if(!isFinite(x)){$('#calc').textContent='enter a number';return}
 const h=hybrid(x),s=series(x),a=asApprox(x),si=simp(x,n),tr=trap(x,n),d=v=>efmt(Math.abs(v-h.v));
 $('#calc').textContent=
`hybrid (series for |x| ≤ 2.5, continued fraction beyond) : ${h.v.toPrecision(16)}   (${h.it} terms)
power series                                             : ${s.v.toPrecision(16)}   (${s.it} terms, |diff| ${d(s.v)})
Abramowitz–Stegun 26.2.17 polynomial                     : ${a.toPrecision(16)}   (5 terms, |diff| ${d(a)})
Simpson, ${n} panels                                       : ${si.toPrecision(16)}   (${n+1} evaluations, |diff| ${d(si)})
trapezoid, ${n} panels                                     : ${tr.toPrecision(16)}   (${n+1} evaluations, |diff| ${d(tr)})

erf(x/√2) = 2Φ(x) − 1 = ${(2*h.v-1).toPrecision(16)}`;
}
function conv(){
 const x=parseFloat($('#x').value);if(!isFinite(x)||x===0)return;
 const ns=[2,4,8,16,32,64,128,256,512,1024,2048],ref=hybrid(x).v;
 const et=ns.map(k=>Math.abs(trap(x,k)-ref)),es=ns.map(k=>Math.abs(simp(x,k)-ref));
 logPlot($('#conv2'),ns,[et,es],['trapezoid','Simpson']);
 const ord=e=>(Math.log10(e[5])-Math.log10(e[2]))/(Math.log10(64)-Math.log10(8));
 $('#order').innerHTML=`Observed order between n = 8 and n = 64: trapezoid ≈ <b>${ord(et).toFixed(2)}</b> (error ∝ h²), Simpson ≈ <b>${ord(es).toFixed(2)}</b> (error ∝ h⁴). The curves stop at about 1e-16, which is the limit of double precision.`;
}
function bench(){
 const N=100000,xs=Array.from({length:N},(_,i)=>-5+10*i/N),n=Math.max(2,Math.round(+$('#np2').value)||20),grid=Array.from({length:401},(_,i)=>-5+i/40);
 const ms={hybrid:hybrid,series:x=>series(x),'A&S 26.2.17':asApprox,['Simpson '+n]:x=>({v:simp(x,n)}),['trapezoid '+n]:x=>({v:trap(x,n)})};
 $('#benchTab').innerHTML=Object.entries(ms).map(([name,fn])=>{
  const g=v=>typeof v==='number'?v:v.v;
  const t0=performance.now();let acc=0;for(const x of xs)acc+=g(fn(x));const ms_=performance.now()-t0;
  const err=Math.max(...grid.map(x=>Math.abs(g(fn(x))-hybrid(x).v)));
  return`<tr><td>${name}</td><td>${ms_.toFixed(0)}</td><td>${efmt(err)}</td></tr>`}).join('');
}
$('#x').oninput=()=>{calc();conv()};$('#np2').onchange=run2;$('#bench').onclick=bench;

/* ---------- init ---------- */
route();run1();run2();
