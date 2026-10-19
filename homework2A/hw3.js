const $=s=>document.querySelector(s);
const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const enc=s=>Array.from(new TextEncoder().encode(s));
const dec=a=>new TextDecoder().decode(new Uint8Array(a));
const hexs=a=>a.map(v=>v.toString(16).padStart(2,'0')).join('');

/* ================= toy curve: y^2 = x^3 + 7 over F_p ================= */
const p=2147483647n;                       // 2^31 - 1, p = 3 (mod 4) so square roots are easy
const md=a=>((a%p)+p)%p;
function powm(b,e){let r=1n;b=md(b);while(e){if(e&1n)r=r*b%p;b=b*b%p;e>>=1n}return r}
function inv(a){let[r0,r1]=[p,md(a)],[s0,s1]=[0n,1n];while(r1){const q=r0/r1;[r0,r1]=[r1,r0-q*r1];[s0,s1]=[s1,s0-q*s1]}return md(s0)}
function findG(){for(let x=1n;;x++){const t=md(x**3n+7n),y=powm(t,(p+1n)/4n);if(y*y%p===t)return[x,y]}}
const G=findG();
function add(P,Q){
 if(!P)return Q;if(!Q)return P;
 let l;
 if(P[0]===Q[0]){if(md(P[1]+Q[1])===0n)return null;l=md(3n*P[0]*P[0]*inv(2n*P[1]))}
 else l=md((Q[1]-P[1])*inv(Q[0]-P[0]));
 const x=md(l*l-P[0]-Q[0]);return[x,md(l*(P[0]-x)-P[1])];
}
const neg=P=>P&&[P[0],md(-P[1])];
function mul(k,P){let R=null;for(const b of k.toString(2)){R=add(R,R);if(b==='1')R=add(R,P)}return R}
const fp=P=>P?`(${P[0]}, ${P[1]})`:'O';
const same=(A,B)=>A&&B&&A[0]===B[0]&&A[1]===B[1];

/* toy "ElGamal / ECIES" style scheme: the shared point seeds a keystream that is XORed with the message */
function keystream(S,n){
 let s=Number((S[0]^(S[1]<<5n))&0xffffffffn)||1,out=[];      // xorshift32 seeded by the shared point
 for(let i=0;i<n;i++){s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;out.push(s&255)}
 return out}
const rnd=bits=>BigInt(1+Math.floor(Math.random()*2**bits));
function eccEncrypt(m,Q){let r,S;do{r=rnd(30);S=mul(r,Q)}while(!S);
 const C1=mul(r,G),k=keystream(S,m.length);return{r,C1,S,k,ct:m.map((b,i)=>b^k[i])}}
function eccDecrypt(d,C1,ct){const S=mul(d,C1);if(!S)return null;const k=keystream(S,ct.length);return{S,k,pt:ct.map((b,i)=>b^k[i])}}

let pair=null,last=null;
function newPair(){
 const bits=+$('#bits').value,d=rnd(bits);pair={d,Q:mul(d,G),bits};last=null;
 $('#keys').textContent=`private key  d = ${d}   (secret, chosen in 1…2^${bits})\npublic key   Q = dG = ${fp(pair.Q)}`;
 $('#eccLog').innerHTML='';$('#eccOut').textContent='';
}
$('#gen').onclick=newPair;$('#bits').onchange=newPair;
$('#enc').onclick=()=>{
 const m=enc($('#msg').value);if(!m.length)return;
 last=eccEncrypt(m,pair.Q);
 $('#eccOut').textContent=`C1 = ${fp(last.C1)}\nciphertext bytes = ${hexs(last.ct)}`;
 $('#eccLog').innerHTML=[
  `Bob published <code>Q = dG = ${fp(pair.Q)}</code>; Alice only sees Q.`,
  `Alice picks a fresh random <code>r = ${last.r}</code> (used once, then thrown away).`,
  `She sends <code>C1 = rG = ${fp(last.C1)}</code> so Bob can rebuild the secret.`,
  `Shared secret: <code>S = rQ = ${fp(last.S)}</code> (= r·d·G).`,
  `Keystream from S (xorshift32 seeded by S): <code>${hexs(last.k.slice(0,8))}…</code>`,
  `Ciphertext: <code>c<sub>i</sub> = m<sub>i</sub> ⊕ k<sub>i</sub></code> for each byte.`].map(s=>`<li>${s}</li>`).join('');
};
$('#dec').onclick=()=>{
 if(!last){$('#eccOut').textContent='Encrypt something first.';return}
 const r=eccDecrypt(pair.d,last.C1,last.ct);
 $('#eccOut').textContent+=`\n\nBob: S = d·C1 = ${fp(r.S)}  ${same(r.S,last.S)?'(same as Alice\'s S)':'(MISMATCH)'}\ndecrypted: ${dec(r.pt)}`;
};

/* ================= Caesar ================= */
const shift=(t,k)=>t.replace(/[a-z]/gi,c=>{const b=c<'a'?65:97;return String.fromCharCode((((c.charCodeAt(0)-b+k)%26)+26)%26+b)});
function caesar(){
 const k=((+$('#cs').value||0)%26+26)%26,m=$('#msg').value,c=shift(m,k);
 $('#csOut').textContent=`encrypted (shift +${k}): ${c}\ndecrypted (shift −${k}): ${shift(c,-k)}`;
}
$('#cs').oninput=caesar;$('#msg').oninput=caesar;

/* ================= statistics: plaintext vs Caesar vs toy ECC ================= */
const letters=t=>t.toUpperCase().replace(/[^A-Z]/g,'');
function counts(a,n){const c=Array(n).fill(0);a.forEach(v=>c[v]++);return c}
const ioc=c=>{const N=c.reduce((a,b)=>a+b);return c.reduce((s,v)=>s+v*(v-1),0)/(N*(N-1))};
const entropy=c=>{const N=c.reduce((a,b)=>a+b);return-c.reduce((s,v)=>v?s+v/N*Math.log2(v/N):s,0)};
function hist(c,lab,name){const mx=Math.max(...c,1);
 return`<b>${name}</b><div class="hist">${c.map((v,i)=>`<div title="${lab[i]}: ${v}"><i style="height:${75*v/mx}%"></i><b>${lab[i]}</b></div>`).join('')}</div>`}
function stats(){
 const k=((+$('#cs').value||0)%26+26)%26,L=[...Array(26)].map((_,i)=>String.fromCharCode(65+i));
 const pl=letters(TEST),cc=letters(shift(TEST,k));
 const cp=counts([...pl].map(c=>c.charCodeAt(0)-65),26),cs=counts([...cc].map(c=>c.charCodeAt(0)-65),26);
 const e=eccEncrypt(enc(TEST),pair.Q),ce=counts(e.ct.map(b=>Math.min(25,Math.floor(b/10))),26),cb=counts(e.ct,256);
 $('#statOut').innerHTML=hist(cp,L,'plaintext letters')+hist(cs,L,`Caesar ciphertext (shift ${k}): same bars, rotated`)+
 hist(ce,[...Array(26)].map((_,i)=>i*10),'toy ECC ciphertext bytes (buckets of 10 values)')+
 `<table><tr><th></th><th>index of coincidence</th><th>entropy (bits/symbol)</th></tr>
 <tr><td>plaintext (26 letters)</td><td>${ioc(cp).toFixed(4)}</td><td>${entropy(cp).toFixed(2)}</td></tr>
 <tr><td>Caesar ciphertext</td><td>${ioc(cs).toFixed(4)}</td><td>${entropy(cs).toFixed(2)}</td></tr>
 <tr><td>toy ECC ciphertext (bytes)</td><td>${ioc(cb).toFixed(4)}</td><td>${entropy(cb).toFixed(2)}</td></tr></table>
 <p class="mute">Random uniform letters would give an index of coincidence of 1/26 ≈ 0.0385, random bytes 1/256 ≈ 0.0039. English sits near 0.065, and Caesar cannot change that number.</p>`;
}
$('#stBtn').onclick=stats;

/* ================= statistical attack on Caesar ================= */
const CORPUS=`Insert Here yout text`;
const TEST=`The harbor was quiet when the last ferry left the pier, and the fishermen were already folding their nets for the night. Nobody noticed the young woman who stood near the lighthouse with a small leather bag and a letter she had been carrying for three days. She read it once more, put it back into her pocket, and walked slowly along the wall toward the market, where the lamps were still burning and the smell of bread and salt filled the narrow street. A dog followed her for a while and then lost interest. By the time she reached the old square the church bell had begun to ring, and she knew that there was no way back now, because the decision had been made long before she came to the sea.`;
function model(){
 const t=letters($('#corpus').value),uni=Array(26).fill(.5),bi=Array(676).fill(1);
 for(let i=0;i<t.length;i++){const a=t.charCodeAt(i)-65;uni[a]++;if(i+1<t.length)bi[a*26+t.charCodeAt(i+1)-65]++}
 const nu=uni.reduce((a,b)=>a+b),nb=bi.reduce((a,b)=>a+b);
 return{f:uni.map(v=>v/nu),lb:bi.map(v=>Math.log(v/nb))}}
function crack(ct,M){
 const L=letters(ct),N=L.length,rows=[];
 const obs=Array(26).fill(0);for(const ch of L)obs[ch.charCodeAt(0)-65]++;
 for(let s=0;s<26;s++){
  let chi=0,bi=0;
  for(let i=0;i<26;i++){const o=obs[(i+s)%26],e=M.f[i]*N;chi+=(o-e)**2/e}      // plaintext letter i appears as i+s in the ciphertext
  for(let j=0;j+1<N;j++){const a=(L.charCodeAt(j)-65-s+26)%26,b=(L.charCodeAt(j+1)-65-s+26)%26;bi+=M.lb[a*26+b]}
  rows.push({s,chi,bi});
 }
 const e=obs.indexOf(Math.max(...obs));
 return{rows,byE:(e-4+26)%26,byChi:rows.reduce((a,b)=>b.chi<a.chi?b:a).s,byBi:rows.reduce((a,b)=>b.bi>a.bi?b:a).s}}
let sampleCT='',sampleKey=0;
$('#fill').onclick=()=>{sampleKey=1+Math.floor(Math.random()*25);sampleCT=shift(TEST,sampleKey);$('#ct').value=sampleCT;$('#crackOut').innerHTML=''};
$('#crack').onclick=()=>{
 const ct=$('#ct').value;if(letters(ct).length<2){$('#crackOut').textContent='Need some ciphertext.';return}
 const r=crack(ct,model());
 const truth=ct===sampleCT?`<p>True key (hidden until now): <b>${sampleKey}</b></p>`:'';
 $('#crackOut').innerHTML=`${truth}<p>${letters(ct).length} letters. Guesses: "most frequent letter is E" → <b>${r.byE}</b>, chi-square → <b>${r.byChi}</b>, bigram likelihood → <b>${r.byBi}</b>.</p>
 <div class="wide"><table><tr><th>shift</th><th>χ² (lower = better)</th><th>bigram log-likelihood</th><th>candidate plaintext</th></tr>`+
 r.rows.map(x=>`<tr class="${x.s===r.byChi?'best':''}"><td>${x.s}</td><td class="num">${x.chi.toFixed(1)}</td><td class="num">${x.bi.toFixed(1)}</td><td class="mono">${esc(shift(ct,-x.s).slice(0,50))}</td></tr>`).join('')+'</table></div>';
};
$('#exp').onclick=()=>{
 const M=model(),T=letters(TEST),T_=200,lens=[5,10,20,40,80,160,320];let html='';
 for(const n of lens){let a=0,b=0,c=0;
  for(let t=0;t<T_;t++){
   const st=Math.floor(Math.random()*(T.length-n)),k=1+Math.floor(Math.random()*25),r=crack(shift(T.substr(st,n),k),M);
   a+=r.byE===k;b+=r.byChi===k;c+=r.byBi===k}
  html+=`<tr><td>${n}</td><td class="num">${(100*a/T_).toFixed(0)}%</td><td class="num">${(100*b/T_).toFixed(0)}%</td><td class="num">${(100*c/T_).toFixed(0)}%</td></tr>`}
 $('#expOut').innerHTML=`<table><tr><th>ciphertext length</th><th>"E" heuristic</th><th>χ² unigram</th><th>bigram score</th></tr>${html}</table><p class="mute">${T_} random fragments of the hold-out text per length, random key each time. The corpus used for training is the first text box, the test fragments come from a different paragraph.</p>`;
};

/* ================= attacks on the toy ECC key ================= */
function show(d,steps,ms,name){
 const r=last?eccDecrypt(d,last.C1,last.ct):null;
 $('#atkOut').innerHTML=`<b>${name}</b>: found d = ${d} after ${steps.toLocaleString()} group operations in ${ms.toFixed(0)} ms. ${d===pair.d?'<span class="ok">matches the real key</span>':'<span class="bad">does not match</span>'}${r?`<br>decrypted message: <b>${esc(dec(r.pt))}</b>`:'<br><span class="mute">(encrypt a message above to see it decrypted too)</span>'}`;
}
$('#brute').onclick=async()=>{
 const N=2**pair.bits,t0=performance.now();let P=G,k=1;
 $('#atkOut').innerHTML='<div class="prog"><i id="pb"></i></div>';
 while(k<=N){
  for(let i=0;i<3000&&k<=N;i++,k++){if(same(P,pair.Q)){show(BigInt(k),k,performance.now()-t0,'Exhaustive search');return}P=add(P,G)}
  $('#pb').style.width=(100*k/N)+'%';await new Promise(r=>setTimeout(r));
 }
};
$('#bsgs').onclick=()=>{
 const N=2**pair.bits,m=Math.ceil(Math.sqrt(N)),t0=performance.now(),tab=new Map(),key=P=>P?P[0]+','+P[1]:'O';
 let P=null;for(let j=0;j<=m;j++){tab.set(key(P),j);P=add(P,G)}
 const step=neg(mul(BigInt(m),G));let R=pair.Q;
 for(let i=0;i<=m;i++){const j=tab.get(key(R));if(j!==undefined&&i*m+j>0){show(BigInt(i*m+j),m+1+i,performance.now()-t0,'Baby-step giant-step');return}R=add(R,step)}
};

/* ================= init ================= */
$('#corpus').value=CORPUS;
$('#gx').textContent=`p = ${p}, G = ${fp(G)}`;
newPair();caesar();
