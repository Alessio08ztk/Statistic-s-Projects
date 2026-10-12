const $=s=>document.querySelector(s);
const pop=n=>{let c=0;while(n){c+=n&1;n>>=1}return c};

/* ---------- toy curve: y^2 = x^3 + 7 (mod 17) ---------- */
const P=17,mod=a=>((a%P)+P)%P;
const inv=a=>{a=mod(a);let r=1;for(let e=P-2,b=a;e;e>>=1,b=b*b%P)if(e&1)r=r*b%P;return r};
const pts=[];for(let x=0;x<P;x++)for(let y=0;y<P;y++)if(mod(y*y-x*x*x-7)===0)pts.push([x,y]);
const fmt=p=>p?`(${p[0]}, ${p[1]})`:'O (infinity)';
function add(p,q){
 if(!p)return[q,'O + Q = Q'];
 if(!q)return[p,'P + O = P'];
 if(p[0]===q[0]&&mod(p[1]+q[1])===0)return[null,'vertical line: P + (−P) = O'];
 let l,kind;
 if(p[0]===q[0]){l=mod(3*p[0]*p[0]*inv(2*p[1]));kind='tangent'}
 else{l=mod((q[1]-p[1])*inv(q[0]-p[0]));kind='chord'}
 const x=mod(l*l-p[0]-q[0]),y=mod(l*(p[0]-x)-p[1]);
 return[[x,y],`${kind}, slope λ = ${l}`];
}
function order(G){let Q=G,n=1;while(Q){Q=add(Q,G)[0];n++}return n}
function mults(G,k){const out=[{n:1,pt:G,note:'G itself'}];
 for(let n=2;n<=k;n++){const[pt,note]=add(out[n-2].pt,G);out.push({n,pt,note:`${n-1}G + G: ${note}`})}
 return out}
function dblAdd(G,k){let R=null,m=0,log=[`k = ${k} = ${k.toString(2)} in binary`];
 for(const b of k.toString(2)){
  R=add(R,R)[0];m*=2;if(m)log.push(`double → ${m}G = ${fmt(R)}`);
  if(b==='1'){R=add(R,G)[0];m+=1;log.push(`add G  → ${m}G = ${fmt(R)}`)}}
 return{R,log}}

const sel=$('#g');pts.forEach((p,i)=>sel.add(new Option(fmt(p),i)));sel.value=pts.findIndex(p=>p[0]==1&&p[1]==5);
let G,seq=[],shown=0,timer=null;

function setup(){
 G=pts[+sel.value];
 const k=Math.max(1,Math.min(200,parseInt($('#k').value)||1));
 seq=mults(G,k);shown=0;halt();
 const n=order(G);$('#ord').textContent=`order of G = ${n} (so kG repeats every ${n})`;
 const d=dblAdd(G,k);$('#dbl').textContent=d.log.join('\n')+`\n\nresult: ${fmt(d.R)}  ${fmt(d.R)===fmt(seq[k-1].pt)?'(matches the slow method)':'(MISMATCH!)'}`;
 draw();stats();
}
function halt(){clearInterval(timer);timer=null;$('#play').textContent='Play (slow)'}
function draw(){
 const cv=$('#cv'),c=cv.getContext('2d'),W=cv.width,m=30,s=(W-2*m)/(P-1);
 const css=getComputedStyle(document.documentElement),col=n=>css.getPropertyValue(n).trim();
 const X=x=>m+x*s,Y=y=>W-m-y*s;
 c.clearRect(0,0,W,W);c.font='10px monospace';c.fillStyle=col('--mute');c.strokeStyle=col('--line');
 for(let i=0;i<P;i++){c.beginPath();c.moveTo(X(i),Y(0));c.lineTo(X(i),Y(P-1));c.moveTo(X(0),Y(i));c.lineTo(X(P-1),Y(i));c.stroke();
  c.fillText(i,X(i)-3,W-m+14);c.fillText(i,m-18,Y(i)+3)}
 pts.forEach(p=>{c.beginPath();c.arc(X(p[0]),Y(p[1]),3,0,7);c.fill()});
 c.strokeStyle=col('--acc');c.fillStyle=col('--acc');c.lineWidth=1.5;
 let prev=null;
 for(let i=0;i<shown;i++){const p=seq[i].pt;if(!p)break;
  if(prev){c.beginPath();c.moveTo(X(prev[0]),Y(prev[1]));c.lineTo(X(p[0]),Y(p[1]));c.stroke()}
  c.beginPath();c.arc(X(p[0]),Y(p[1]),6,0,7);c.fill();
  c.fillStyle=col('--ink');c.font='bold 11px monospace';c.fillText(i?`${i+1}G`:'G',X(p[0])+8,Y(p[1])-6);c.fillStyle=col('--acc');prev=p}
 c.lineWidth=1;
 $('#tab tbody').innerHTML=seq.slice(0,shown).map(r=>`<tr><td>${r.n}</td><td>${fmt(r.pt)}</td><td>${r.note}</td></tr>`).join('');
 const last=seq[seq.length-1];
 $('#res').textContent=shown===seq.length?`TOY PUBLIC KEY  Q = ${last.n}G = ${fmt(last.pt)}`:'';
}
function step(){if(shown<seq.length){shown++;draw()}else halt()}
$('#step').onclick=()=>{halt();step()};
$('#all').onclick=()=>{halt();shown=seq.length;draw()};
$('#reset').onclick=()=>{halt();shown=0;draw()};
$('#play').onclick=()=>{if(timer)return halt();$('#play').textContent='Pause';if(shown>=seq.length)shown=0;timer=setInterval(step,800)};
$('#k').oninput=setup;sel.onchange=setup;

/* ---------- statistics over all k ---------- */
function pearson(a,b){const n=a.length,ma=a.reduce((s,v)=>s+v)/n,mb=b.reduce((s,v)=>s+v)/n;
 let sab=0,sa=0,sb=0;for(let i=0;i<n;i++){sab+=(a[i]-ma)*(b[i]-mb);sa+=(a[i]-ma)**2;sb+=(b[i]-mb)**2}
 return sa&&sb?sab/Math.sqrt(sa*sb):0}
function hist(cnt,name){const mx=Math.max(...cnt,1);
 return`<b>${name}</b><div class="hist">${cnt.map((c,v)=>`<div title="${v}: ${c}"><i style="height:${75*c/mx}%"></i><b>${v}</b></div>`).join('')}</div>`}
function stats(){
 const n=order(G),all=mults(G,n-1).map(r=>r.pt),ks=all.map((_,i)=>i+1);
 const xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);
 const cx=Array(P).fill(0),cy=Array(P).fill(0);xs.forEach(v=>cx[v]++);ys.forEach(v=>cy[v]++);
 const bits=a=>[4,3,2,1,0].map(b=>(a.filter(v=>v>>b&1).length/a.length).toFixed(2)).join('  ');
 // avalanche: flip one bit of k, count differing bits in (x,y) (10 bits)
 const hd=(p,q)=>pop(p[0]^q[0])+pop(p[1]^q[1]);
 let tot=0,cnt=0;const nb=Math.ceil(Math.log2(n));
 for(let k=1;k<n;k++)for(let b=0;b<nb;b++){const k2=k^(1<<b);if(k2>=1&&k2<n){tot+=hd(all[k-1],all[k2-1]);cnt++}}
 let rt=0,rc=0;for(let i=0;i<all.length;i++)for(let j=0;j<all.length;j++)if(i!==j){rt+=hd(all[i],all[j]);rc++}
 const mirror=all.filter((p,i)=>i+1<n-(i+1)&&all[n-(i+1)-1][0]===p[0]).length;
 $('#stats').innerHTML=`<p>G = ${fmt(G)}, order ${n}, so ${n-1} points.</p>`+
 hist(cx,'frequency of x values')+hist(cy,'frequency of y values')+
 `<pre>fraction of 1s per bit (MSB → LSB)
x: ${bits(xs)}
y: ${bits(ys)}

correlation k ↔ x: ${pearson(ks,xs).toFixed(3)}
correlation k ↔ y: ${pearson(ks,ys).toFixed(3)}

avalanche (flip 1 bit of k, Hamming distance of (x,y) over 10 bits):
  measured mean : ${(tot/cnt).toFixed(2)}
  random pairs  : ${(rt/rc).toFixed(2)}   (ideal ≈ 5)

mirror pairs (kG and (n−k)G share x): ${mirror} of ${Math.floor((n-1)/2)} pairs</pre>
 <p class="mute">Reading: values are not flat across 0–16 because only points on the curve exist (about half of the x values have a y at all), and each x appears at most twice (±y). Correlation with k is small but not zero, which is expected for such a tiny sample.</p>`;
}


setup();
