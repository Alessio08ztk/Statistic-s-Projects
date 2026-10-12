const $=s=>document.querySelector(s);
const pop=n=>{let c=0;while(n){c+=n&1;n>>=1}return c};

/* ---------- Keccak (BigInt, compact) ---------- */
const M=(1n<<64n)-1n,rotl=(x,n)=>n?((x<<BigInt(n))|(x>>BigInt(64-n)))&M:x;
function lf(t){let R=1;for(let i=0;i<t%255;i++){R<<=1;if(R&256)R^=0x171}return R&1}
const RC=[...Array(24)].map((_,r)=>{let c=0n;for(let j=0;j<7;j++)if(lf(j+7*r))c|=1n<<BigInt((1<<j)-1);return c});
function perm(A){
 for(let r=0;r<24;r++){
  const C=[0,1,2,3,4].map(x=>A[x]^A[x+5]^A[x+10]^A[x+15]^A[x+20]);
  for(let x=0;x<5;x++){const D=C[(x+4)%5]^rotl(C[(x+1)%5],1);for(let y=0;y<25;y+=5)A[x+y]^=D}
  let x=1,y=0,cur=A[1];
  for(let t=0;t<24;t++){[x,y]=[y,(2*x+3*y)%5];const tmp=A[x+5*y];A[x+5*y]=rotl(cur,((t+1)*(t+2)/2)%64);cur=tmp}
  for(let y=0;y<25;y+=5){const T=A.slice(y,y+5);for(let x=0;x<5;x++)A[y+x]=T[x]^((~T[(x+1)%5]&T[(x+2)%5])&M)}
  A[0]^=RC[r];
 }}
function sponge(bytes,dom){
 const rate=136,buf=new Uint8Array((Math.floor(bytes.length/rate)+1)*rate);
 buf.set(bytes);buf[bytes.length]^=dom;buf[buf.length-1]^=0x80;
 const A=Array(25).fill(0n);
 for(let o=0;o<buf.length;o+=rate){
  for(let i=0;i<17;i++){let v=0n;for(let b=7;b>=0;b--)v=(v<<8n)|BigInt(buf[o+i*8+b]);A[i]^=v}
  perm(A)}
 const out=[];for(let i=0;i<4;i++)for(let b=0;b<8;b++)out.push(Number((A[i]>>BigInt(8*b))&255n));
 return out}
const keccak256=b=>sponge(b,0x01),sha3_256=b=>sponge(b,0x06);
const hex=b=>b.map(v=>v.toString(16).padStart(2,'0')).join('');
const enc=s=>new TextEncoder().encode(s);


/* ---------- BIP-44 path builder ---------- */
function path(){
 const coin=$('#coin').value,acct=Math.max(0,+$('#acct').value||0),chg=$('#chg').value,idx=Math.max(0,+$('#idx').value||0);
 $('#pathOut').textContent=`m / 44' / ${coin}' / ${acct}' / ${chg} / ${idx}`;
 $('#pathWhy').innerHTML=[
  `<b>m</b> – master key from the BIP-32 root (HMAC-SHA512 of the seed)`,
  `<b>44'</b> – "purpose": this tree follows BIP-44`,
  `<b>${coin}'</b> – coin type (SLIP-44 registry); 60 is Ethereum`,
  `<b>${acct}'</b> – account, lets you keep separate "wallets" under one seed`,
  `<b>${chg}</b> – ${chg==0?'external chain (receiving addresses). Ethereum wallets only ever use 0':'internal chain (change addresses, mostly a Bitcoin thing)'}`,
  `<b>${idx}</b> – address index; "Account 2" in MetaMask is just index ${idx+1} here`
 ].map(s=>`<li>${s}</li>`).join('');
}
['coin','acct','chg','idx'].forEach(i=>$('#'+i).oninput=path);

/* ---------- hash lab ---------- */
function hashLab(){
 const b=enc($('#msg').value),nbits=b.length*8;
 $('#flip').max=Math.max(nbits-1,0);
 const pos=Math.min(+$('#flip').value,Math.max(nbits-1,0));
 $('#flipLbl').textContent=nbits?`flip input bit #${pos} (of ${nbits})`:'(type something)';
 const k=keccak256(b);
 $('#hashes').textContent=`Keccak-256 : ${hex(k)}\nSHA3-256   : ${hex(sha3_256(b))}\n`+(hex(k)===hex(sha3_256(b))?'same':'different, only the padding byte changed (0x01 vs 0x06)');
 if(!nbits){$('#bits').innerHTML='';$('#avl').textContent='';return}
 const b2=b.slice();b2[pos>>3]^=1<<(pos&7);
 const k2=keccak256(b2);let d=0,cells='';
 for(let i=0;i<32;i++)for(let j=0;j<8;j++){const x=(k[i]^k2[i])>>j&1;d+=x;cells+=`<i class="${x?'d':''}"></i>`}
 $('#bits').innerHTML=cells;
 $('#avl').textContent=`${d} of 256 output bits changed (${(d/2.56).toFixed(1)}%). A good hash sits around 50% whichever bit you flip.`;
}
$('#msg').oninput=hashLab;$('#flip').oninput=hashLab;

/* ---------- EIP-55 lab ---------- */
function checksum(raw){const h=hex(keccak256(enc(raw)));return[...raw].map((c,i)=>parseInt(h[i],16)>=8?c.toUpperCase():c).join('')}
function eipCheck(){
 const t=$('#addr').value.trim().replace(/^0x/i,'');
 const out=$('#eip');
 if(!/^[0-9a-fA-F]{40}$/.test(t)){out.textContent='Needs 40 hex characters.';return}
 const good=checksum(t.toLowerCase());
 let verdict;
 if(t===t.toLowerCase()||t===t.toUpperCase())verdict='<span class="mute">no checksum present (all one case), so nothing can be checked</span>';
 else verdict=t===good?'<span class="ok">checksum valid</span>':'<span class="bad">checksum INVALID – probably a typo</span>';
 out.innerHTML=`expected: 0x${[...good].map((c,i)=>c!==t[i]&&t[i]!==undefined&&c.toLowerCase()===t[i].toLowerCase()?`<span class="up">${c}</span>`:c).join('')}\nyou have: 0x${t}\n${verdict}`;
}
$('#addr').oninput=eipCheck;
$('#typo').onclick=()=>{
 const g=checksum($('#addr').value.trim().replace(/^0x/i,'').toLowerCase());
 const i=Math.floor(Math.random()*40),hx='0123456789abcdef';let c;
 do{c=hx[Math.floor(Math.random()*16)]}while(c===g[i].toLowerCase());
 $('#addr').value='0x'+g.slice(0,i)+(/[a-f]/i.test(g[i])?c.toUpperCase():c)+g.slice(i+1);eipCheck();
};
$('#fix').onclick=()=>{$('#addr').value='0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed';eipCheck()};
$('#many').onclick=()=>{
 const g=checksum($('#addr').value.trim().replace(/^0x/i,'').toLowerCase());
 let caught=0,N=1000;
 for(let n=0;n<N;n++){
  const i=Math.floor(Math.random()*40);let c;
  do{c='0123456789abcdef'[Math.floor(Math.random()*16)]}while(c===g[i].toLowerCase());
  const t=g.slice(0,i)+(/[a-f]/i.test(g[i])?c.toUpperCase():c)+g.slice(i+1);
  if(t!==checksum(t.toLowerCase()))caught++;
 }
 $('#manyOut').textContent=`${caught} of ${N} random single-character typos were caught (${(caught/N*100).toFixed(2)}%).`;
};

path();hashLab();eipCheck();
