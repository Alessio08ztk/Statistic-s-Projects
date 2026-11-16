const $=s=>document.querySelector(s);
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const f4=x=>Number.isInteger(x)?String(x):x.toFixed(4);
const f2=x=>Number.isInteger(x)?String(x):x.toFixed(2);
const fp=p=>p<1e-4?p.toExponential(2):p.toFixed(4);
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

/* ---------- chi-square distribution (needs the incomplete gamma function) ---------- */
function lgam(x){const c=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,.1208650973866179e-2,-.5395239384953e-5];
 let y=x,t=x+5.5;t-=(x+.5)*Math.log(t);let s=1.000000000190015;for(const v of c)s+=v/++y;return-t+Math.log(2.5066282746310005*s/x)}
// Q(a,x) = upper regularised incomplete gamma; the p-value of a chi-square with k d.o.f. is Q(k/2, chi2/2)
function gammaQ(a,x){
 if(x<=0)return 1;
 if(x<a+1){let ap=a,sum=1/a,del=sum;for(let n=0;n<500;n++){ap++;del*=x/ap;sum+=del;if(Math.abs(del)<Math.abs(sum)*1e-14)break}
  return 1-sum*Math.exp(-x+a*Math.log(x)-lgam(a))}
 let b=x+1-a,c=1e300,d=1/b,h=d;
 for(let i=1;i<500;i++){const an=-i*(i-a);b+=2;d=an*d+b;if(Math.abs(d)<1e-300)d=1e-300;c=b+an/c;if(Math.abs(c)<1e-300)c=1e-300;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<1e-14)break}
 return Math.exp(-x+a*Math.log(x)-lgam(a))*h;
}
const pValue=(chi,k)=>gammaQ(k/2,chi/2);
function critical(k,alpha){let lo=0,hi=10*k+50;for(let i=0;i<100;i++){const m=(lo+hi)/2;pValue(m,k)>alpha?lo=m:hi=m}return(lo+hi)/2}
const chiPdf=(x,k)=>x<=0?0:Math.exp((k/2-1)*Math.log(x)-x/2-(k/2)*Math.log(2)-lgam(k/2));

/* ---------- datasets ---------- */
// Hair and eye colour of 592 students (the classic R dataset HairEyeColor, summed over sex)
const HE={hair:['Black','Brown','Red','Blond'],eye:['Brown','Blue','Hazel','Green'],
 n:[[68,20,15,5],[119,84,54,29],[26,17,14,14],[7,94,10,16]]};
const pick=p=>{let r=Math.random(),k=0;while(k<p.length-1&&r>p[k]){r-=p[k];k++}return k};
function makeData(kind){
 const lines=[];
 if(kind==='hair'){HE.hair.forEach((h,i)=>HE.eye.forEach((e,j)=>{for(let k=0;k<HE.n[i][j];k++)lines.push(h+','+e)}));}
 else{
  const n=Math.max(20,Math.min(5000,Math.round(+$('#size').value)||300)),X=['A','B','C'],F=['low','mid','high'];
  const cond=kind==='dep'?[[.6,.3,.1],[.3,.4,.3],[.1,.3,.6]]:[[.5,.3,.2],[.5,.3,.2],[.5,.3,.2]];   // independent: same row for every X
  for(let i=0;i<n;i++){const x=pick([.4,.35,.25]);lines.push(X[x]+','+F[pick(cond[x])])}
 }
 return lines.join('\n');
}

/* ---------- from raw (X, F) pairs to the table ---------- */
function parse(text,header){
 const rows=[];let skipped=0;
 text.split(/\r?\n/).slice(header?1:0).forEach(l=>{if(!l.trim())return;const p=l.split(/[,;\t]/).map(s=>s.trim());if(p.length<2||p[0]===''||p[1]===''){skipped++;return}rows.push([p[0],p[1]])});
 return{rows,skipped};
}
const order=a=>{const u=[...new Set(a)];return u.every(v=>v!==''&&isFinite(v))?u.sort((p,q)=>p-q):u.sort((p,q)=>p.localeCompare(q))};
function contingency(rows){
 const xs=order(rows.map(r=>r[0])),fs=order(rows.map(r=>r[1])),xi=new Map(xs.map((v,i)=>[v,i])),fi=new Map(fs.map((v,i)=>[v,i]));
 const O=xs.map(()=>fs.map(()=>0));rows.forEach(([x,f])=>O[xi.get(x)][fi.get(f)]++);
 const rt=O.map(r=>r.reduce((a,b)=>a+b)),ct=fs.map((_,j)=>O.reduce((s,r)=>s+r[j],0)),n=rows.length;
 return{xs,fs,O,rt,ct,n};
}
function chiSquare(T){
 const E=T.O.map((r,i)=>r.map((_,j)=>T.rt[i]*T.ct[j]/T.n));
 let chi=0,big={v:-1};const C=T.O.map((r,i)=>r.map((o,j)=>{const c=(o-E[i][j])**2/E[i][j];chi+=c;if(c>big.v)big={v:c,i,j};return c}));
 const R=T.xs.length,K=T.fs.length,df=(R-1)*(K-1);
 return{E,C,chi,df,big,res:T.O.map((r,i)=>r.map((o,j)=>(o-E[i][j])/Math.sqrt(E[i][j]))),
  V:Math.sqrt(chi/(T.n*Math.min(R-1,K-1))),small:E.flat().filter(v=>v<5).length/(R*K)};
}

/* ---------- html tables ---------- */
function tbl(T,M,f,o={}){
 let h=`<div class="wide"><table><tr><th class="rh">X \\ F</th>${T.fs.map(v=>`<th>${esc(v)}</th>`).join('')}${o.rt?'<th class="tot">total</th>':''}</tr>`;
 T.xs.forEach((x,i)=>{h+=`<tr><th class="rh">${esc(x)}</th>`+M[i].map((v,j)=>{
  const r=o.heat?o.heat[i][j]:0,w=Math.min(70,Math.abs(r)*17);
  const bg=o.heat?` style="background:color-mix(in srgb, var(${r>0?'--acc':'--acc2'}) ${w}%, transparent)"`:'';
  return`<td class="hot"${bg}>${f(v)}</td>`}).join('')+(o.rt?`<td class="tot hot">${f(o.rt[i])}</td>`:'')+'</tr>'});
 if(o.ct)h+=`<tr><th class="rh tot">total</th>${o.ct.map(v=>`<td class="tot hot">${f(v)}</td>`).join('')}${o.rt?`<td class="tot hot">${f(o.tot)}</td>`:''}</tr>`;
 return h+'</table></div>';
}

/* ---------- chi-square plot ---------- */
function frame(cv,x0,x1,y0,y1,xt,yt){
 const c=cv.getContext('2d'),W=cv.width,H=cv.height,L=46,R=8,T=8,B=24;
 c.clearRect(0,0,W,H);c.font='10px monospace';c.lineWidth=1;c.setLineDash([]);c.globalAlpha=1;
 const X=x=>L+(x-x0)/(x1-x0)*(W-L-R),Y=y=>H-B-(y-y0)/(y1-y0)*(H-B-T);
 c.strokeStyle=css('--line');c.fillStyle=css('--mute');
 yt.forEach(v=>{c.beginPath();c.moveTo(L,Y(v));c.lineTo(W-R,Y(v));c.stroke();c.fillText(v.toPrecision(2),2,Y(v)+3)});
 xt.forEach(v=>c.fillText(v.toPrecision(3),X(v)-8,H-8));
 c.strokeRect(L,T,W-L-R,H-T-B);c.save();c.beginPath();c.rect(L,T,W-L-R,H-T-B);c.clip();
 return{c,X,Y,done:()=>c.restore()};
}
let perm=null;
function plot(M){
 const k=M.df,x1=Math.max(M.crit*1.8,M.chi*1.15,k+5*Math.sqrt(2*k)),N=300;
 const pts=[...Array(N)].map((_,i)=>{const x=x1*(i+1)/N;return[x,chiPdf(x,k)]});
 let ymax=Math.max(...pts.slice(k<=2?2:0).map(p=>p[1]));
 const ph=perm?perm.bins.map(b=>b.d):[];ymax=Math.max(ymax,...ph)*1.1;
 const t=[0,1,2,3,4].map(i=>x1*i/4),f=frame($('#plot'),0,x1,0,ymax,t,[0,1,2,3].map(i=>ymax*i/3)),c=f.c;
 if(perm){c.fillStyle=css('--acc2');c.globalAlpha=.35;perm.bins.forEach(b=>c.fillRect(f.X(b.x0),f.Y(b.d),f.X(b.x1)-f.X(b.x0)-1,f.Y(0)-f.Y(b.d)));c.globalAlpha=1}
 c.fillStyle=css('--acc');c.globalAlpha=.25;c.beginPath();c.moveTo(f.X(M.crit),f.Y(0));
 pts.filter(p=>p[0]>=M.crit).forEach(p=>c.lineTo(f.X(p[0]),f.Y(Math.min(p[1],ymax))));c.lineTo(f.X(x1),f.Y(0));c.fill();c.globalAlpha=1;
 c.strokeStyle=css('--ink');c.lineWidth=2;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(f.X(p[0]),f.Y(Math.min(p[1],ymax))):c.moveTo(f.X(p[0]),f.Y(Math.min(p[1],ymax))));c.stroke();
 c.strokeStyle=css('--acc');c.lineWidth=2;c.setLineDash([5,4]);c.beginPath();c.moveTo(f.X(M.chi),f.Y(0));c.lineTo(f.X(M.chi),f.Y(ymax));c.stroke();
 c.setLineDash([2,3]);c.strokeStyle=css('--mute');c.beginPath();c.moveTo(f.X(M.crit),f.Y(0));c.lineTo(f.X(M.crit),f.Y(ymax));c.stroke();f.done();
}

/* ---------- main analysis ---------- */
let model=null;
function analyse(){
 perm=null;$('#permOut').textContent='';
 const header=$('#hdr').checked,{rows,skipped}=parse($('#data').value,header);
 const msg=$('#msg');
 if(rows.length<2){msg.textContent='Need at least two (X, F) pairs, one per line.';$('#results').hidden=true;return}
 const T=contingency(rows),R=T.xs.length,K=T.fs.length;
 if(R<2||K<2){msg.textContent=`X has ${R} distinct value${R>1?'s':''} and F has ${K}: each variable needs at least 2 distinct values.`;$('#results').hidden=true;return}
 $('#results').hidden=false;
 msg.textContent=`${rows.length} valid pairs${skipped?`, ${skipped} lines skipped`:''}; X has ${R} categories, F has ${K}.`;
 const M=chiSquare(T),alpha=Math.min(.5,Math.max(1e-6,+$('#alpha').value||.05));
 M.p=pValue(M.chi,M.df);M.crit=critical(M.df,alpha);M.T=T;M.alpha=alpha;model=M;
 const n=T.n;
 // 1. contingency table + marginals
 $('#t-obs').innerHTML=tbl(T,T.O,String,{rt:T.rt,ct:T.ct,tot:n});
 $('#t-joint').innerHTML=tbl(T,T.O.map(r=>r.map(v=>v/n)),f4,{rt:T.rt.map(v=>v/n),ct:T.ct.map(v=>v/n),tot:1});
 $('#t-cx').innerHTML=tbl(T,T.O.map((r,i)=>r.map(v=>v/T.rt[i])),f4,{rt:T.rt.map(()=>1),ct:T.ct.map(v=>v/n),tot:1});
 $('#t-cf').innerHTML=tbl(T,T.O.map(r=>r.map((v,j)=>v/T.ct[j])),f4,{rt:T.rt.map(v=>v/n),ct:T.ct.map(()=>1),tot:1});
 // 2. expected counts and chi-square
 $('#t-exp').innerHTML=tbl(T,M.E,f2,{rt:T.rt,ct:T.ct,tot:n});
 $('#t-chi').innerHTML=tbl(T,M.C,f2,{heat:M.res});
 const rej=M.p<alpha,b=M.big;
 $('#stat').innerHTML=`<p>χ² = Σ (O − E)² / E = <b>${M.chi.toFixed(3)}</b>, degrees of freedom = (${R}−1)(${K}−1) = <b>${M.df}</b>, p-value = <b>${fp(M.p)}</b>.<br>
 Critical value at α = ${alpha}: <b>${M.crit.toFixed(3)}</b>. Cramér's V = <b>${M.V.toFixed(3)}</b>.</p>
 <div class="verdict">${rej?`<b>Reject independence</b> (p &lt; α). `:`<b>Do not reject independence</b> (p ≥ α). `}${rej
  ?`The table is too far from what independence predicts to be blamed on sampling noise. The cell that deviates most is X = ${esc(T.xs[b.i])}, F = ${esc(T.fs[b.j])}: observed ${T.O[b.i][b.j]}, expected ${M.E[b.i][b.j].toFixed(1)}.`
  :`The differences from the expected counts are of the size we would often see by chance if X and F were independent. This does not prove independence; with little data the test just has little power.`}</div>
 ${M.small>.2?`<p class="warn">Warning: ${(M.small*100).toFixed(0)}% of the expected counts are below 5, so the χ² approximation of the p-value may be unreliable (see the permutation test).</p>`:''}`;
 plot(M);
}
$('#data').oninput=()=>{$('#preset').value='own';analyse()};
['hdr','alpha'].forEach(id=>$('#'+id).onchange=analyse);
$('#preset').onchange=load;$('#size').onchange=load;$('#again').onclick=load;
function load(){const k=$('#preset').value;if(k==='own')return analyse();$('#hdr').checked=false;$('#data').value=makeData(k);analyse()}

// permutation test: shuffle the F labels, keep X, recompute chi-square each time
$('#perm').onclick=()=>{
 if(!model)return;
 const T=model.T,xi=[],fl=[];T.O.forEach((r,i)=>r.forEach((o,j)=>{for(let k=0;k<o;k++){xi.push(i);fl.push(j)}}));
 const K=T.fs.length,B=2000,E=model.E.flat(),vals=[];let ge=0;
 for(let b=0;b<B;b++){
  for(let i=fl.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[fl[i],fl[j]]=[fl[j],fl[i]]}
  const cnt=new Array(E.length).fill(0);for(let i=0;i<fl.length;i++)cnt[xi[i]*K+fl[i]]++;
  let c=0;for(let i=0;i<E.length;i++)c+=(cnt[i]-E[i])**2/E[i];
  vals.push(c);if(c>=model.chi-1e-9)ge++;
 }
 const hi=Math.max(...vals),w=hi/30,bins=Array.from({length:30},(_,i)=>({x0:i*w,x1:(i+1)*w,d:0}));
 vals.forEach(v=>bins[Math.min(29,Math.floor(v/w))].d++);bins.forEach(b=>b.d/=B*w);perm={bins};
 $('#permOut').innerHTML=`${B} shuffles: ${ge} gave a χ² at least as large as the observed one, so the permutation p-value is <b>${fp((ge+1)/(B+1))}</b> (the χ² approximation said ${fp(model.p)}).`;
 plot(model);
};

load();
