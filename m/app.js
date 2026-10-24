'use strict';
// MONEY LINE phone. Public shell only: all personal data arrives in data.enc (AES-GCM), unlocked with a key kept on this phone.
const $=id=>document.getElementById(id);
const LS='ml_key', DAY=86400000;
let D=null, blur=true, reblurT=null, off=0, vel=0, ppd=80, hits=[], cfDays={};
const money=v=>'$'+Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const pdate=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const today=()=>{const t=new Date();t.setHours(0,0,0,0);return t};
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function decrypt(blob,pw){
  const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
  const k=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:b64(blob.salt),iterations:blob.iter},km,{name:'AES-GCM',length:256},false,['decrypt']);
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(blob.iv)},k,b64(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
const norm=s=>(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
async function load(pw){
  const r=await fetch('data.enc?t='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw new Error('download failed ('+r.status+')');
  return decrypt(await r.json(),norm(pw));
}
async function refresh(manual){
  const pw=localStorage.getItem(LS); if(!pw){showLock();return}
  if(manual)$('upd').textContent='refreshing...';
  try{D=await load(pw);localStorage.setItem('ml_cache_ok','1');build();}
  catch(e){$('upd').textContent=(navigator.onLine?'could not unlock data':'offline')+' - tap REFRESH';if(String(e.name)==='OperationError'){localStorage.removeItem(LS);showLock('That key no longer works.')}}
}
function showLock(m){$('lock').style.display='flex';$('msg').textContent=m||''}
$('kGo').onclick=async()=>{
  const pw=$('key').value; $('msg').textContent='checking...';
  try{D=await load(pw);localStorage.setItem(LS,norm(pw));$('lock').style.display='none';$('key').value='';build()}
  catch(e){$('msg').textContent=String(e.name)==='OperationError'?'Wrong key - check it and try again.':('Error: '+e.message)}
};
// ---------- blur ----------
function setBlur(on){blur=on;document.body.classList.toggle('blur',on);$('bBlur').textContent=on?'BLUR ON':'BLUR OFF';$('bBlur').classList.toggle('on',!on);
  clearTimeout(reblurT);if(!on)reblurT=setTimeout(()=>setBlur(true),60000);draw()}
$('bBlur').onclick=()=>setBlur(!blur);
document.addEventListener('visibilitychange',()=>{if(document.hidden)setBlur(true);else refresh(false)});
// ---------- logo ----------
function logo(cv){const g=cv.getContext('2d'),W=cv.width,H=cv.height;g.clearRect(0,0,W,H);
  const gr=g.createLinearGradient(0,4,0,H-4);[[0,'#f4f6f8'],[.18,'#aab0b6'],[.42,'#585d63'],[.5,'#d2d6da'],[.7,'#6d7278'],[.86,'#a3a8ae'],[1,'#3a3d41']].forEach(s=>gr.addColorStop(s[0],s[1]));
  g.font='900 34px Bahnschrift, Roboto, "Arial Black", sans-serif';g.textBaseline='middle';
  const word=(t,x,y)=>{g.fillStyle='#000';g.fillText(t,x+1.5,y+1.5);g.fillStyle=gr;g.fillText(t,x,y);g.strokeStyle='#e8ebee88';g.lineWidth=.8;g.strokeText(t,x,y)};
  word('MONEY',4,20);word('LINE',W-4-g.measureText('LINE').width,49);
  g.save();g.globalCompositeOperation='source-atop';g.strokeStyle='#ffffff22';g.lineWidth=.6;for(let i=0;i<40;i++){const y=Math.random()*H;g.beginPath();g.moveTo(0,y);g.lineTo(W,y+Math.random()*3-1.5);g.stroke()}g.restore();
  g.strokeStyle='#28ff6e';g.lineWidth=2.6;g.shadowColor='#28ff6e';g.shadowBlur=9;g.beginPath();
  [[4,50],[70,50],[80,40],[92,64],[104,34],[114,50],[W-112,50]].forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();g.shadowBlur=0}
logo($('logo'));logo($('logo2'));
// ---------- build ----------
function payday(d){if(!D.payNext)return false;const n=D.payEvery||14,diff=Math.round((d-pdate(D.payNext))/DAY);return((diff%n)+n)%n===0}
function fmtTime(s){if(!s)return'--';const d=new Date(s);return d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
function cf7(){const f=iso(new Date(today()-6*DAY));return(D.cashflow.rows||[]).filter(r=>r.date>=f).reduce((a,r)=>a+r.amount,0)}
function build(){
  cfDays={};(D.cashflow.rows||[]).forEach(r=>{cfDays[r.date]=(cfDays[r.date]||0)+r.amount});
  $('upd').textContent='updated '+fmtTime(D.generated);
  const t=$('tiles');t.innerHTML='';
  const tile=(lbl,val,sub,fn)=>{const b=document.createElement('div');b.className='tile';b.innerHTML=lbl+' <span class="pv">'+val+'</span><small>'+sub+'</small>';b.onclick=fn;t.appendChild(b)};
  tile('CASH FLOW',money(cf7()),'out, last 7 days',()=>cfPanel(null));
  (D.accounts||[]).forEach(a=>tile(String(a.name).toUpperCase(),a.balance==null?'--':money(a.balance),(a.kind==='credit'?'owed':'balance')+' · '+fmtTime(a.asOf||D.balUpdated),()=>acctPanel(a)));
  draw();
}
// ---------- strip ----------
const cv=$('strip'),g=cv.getContext('2d');
function size(){const r=cv.getBoundingClientRect(),dp=devicePixelRatio||1;cv.width=r.width*dp;cv.height=r.height*dp;g.setTransform(dp,0,0,dp,0,0);ppd=Math.max(64,Math.min(96,r.width/5.2));draw()}
addEventListener('resize',size);
function txt(s,x,y,sz,col,al,bold,glow){g.font=(bold?'700 ':'400 ')+sz+'px "Segoe UI",Roboto,sans-serif';g.textAlign=al||'center';g.textBaseline='top';g.fillStyle=col;if(glow){g.shadowColor=glow;g.shadowBlur=6}g.fillText(s,x,y);g.shadowBlur=0;return g.measureText(s).width}
function trunc(s,n){s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1).trim()+'…':s}
function draw(){
  if(!D)return;const W=cv.clientWidth,H=cv.clientHeight;g.clearRect(0,0,W,H);hits=[];
  if(blur){g.filter='blur(6px)'}else g.filter='none';
  const t0=today(),cx=W/2,axisY=Math.max(H*.66,H-38),xOf=d=>cx+((d-t0)/DAY-off)*ppd;
  const first=new Date(t0.getTime()+Math.floor(off-W/2/ppd-2)*DAY),last=new Date(t0.getTime()+Math.ceil(off+W/2/ppd+2)*DAY);
  g.strokeStyle='#cfd3d7';g.lineWidth=1.5;g.beginPath();g.moveTo(0,axisY);g.lineTo(W,axisY);g.stroke();
  for(let d=new Date(first);d<=last;d=new Date(d.getTime()+DAY)){
    const x=xOf(d),k=iso(d),isT=k===iso(t0);
    g.strokeStyle='#55595e';g.lineWidth=1;g.beginPath();g.moveTo(x,axisY-3);g.lineTo(x,axisY+3);g.stroke();
    txt(d.toLocaleDateString('en-US',{weekday:'short'}).slice(0,2).toUpperCase(),x,axisY+7,8,'#8a8d92');
    txt(String(d.getDate()),x,axisY+17,10,isT?'#fff':'#aeb2b6','center',isT,isT?'#fff':null);
    if(d.getDate()===1||+d===+first){const mx=x-ppd/2;if(d.getDate()===1){g.strokeStyle='#33363a';g.beginPath();g.moveTo(mx,0);g.lineTo(mx,H);g.stroke()}
      txt(d.toLocaleDateString('en-US',{month:'long',year:'numeric'}).toUpperCase(),Math.max(mx+4,4),2,9,'#8a8d92','left')}
    const pd=payday(d);
    if(pd){txt('PAYDAY',x,16,8.5,'#fff','center',true,'#fff');g.strokeStyle='#44484d';g.beginPath();g.moveTo(x,30);g.lineTo(x,axisY-4);g.stroke()}
    if(cfDays[k]){const pw=Math.min(52,ppd-8),py=pd?3:17,px=x-pw/2;g.fillStyle='#2f7dff';rr(px,py,pw,11,3);g.fill();txt('CASHFLOW',x,py+1.5,7,'#fff','center',true);hits.push({x:px-4,y:py-6,w:pw+8,h:23,fn:()=>cfPanel(k)})}
  }
  // bills grouped by day
  const by={};(D.occ||[]).forEach(o=>{if(o.d>=iso(first)&&o.d<=iso(last))(by[o.d]=by[o.d]||[]).push(o)});
  const labels=[],tagBot=31,room=axisY-9-tagBot;
  Object.keys(by).sort().forEach(k=>{
    const it=by[k],x=xOf(pdate(k));let total=0,rem=0,sts=new Set(),tbd=false;it.forEach(o=>{total+=o.amt;if(o.st!=='paid')rem+=o.rem;sts.add(o.st);if(o.tbd)tbd=true});
    let st='due';if(sts.size===1&&sts.has('paid'))st='paid';else if(sts.has('pastdue'))st='pastdue';else if(sts.has('partial'))st='partial';else if(sts.has('due'))st='due';else if(sts.has('predicted'))st='predicted';
    const urg=it.some(o=>o.st==='pastdue')?'#ff4a4a':(it.some(o=>o.st!=='paid'&&(pdate(o.d)-t0)/DAY<=3&&(pdate(o.d)-t0)>=0)?'#ffb020':null);
    const sz=it.length>1?15:11;g.beginPath();g.arc(x,axisY,sz/2,0,7);
    if(st==='predicted'){g.setLineDash([2,1.5]);g.strokeStyle=urg||'#ffffffb0';g.lineWidth=1.2;g.stroke();g.setLineDash([])}
    else{g.fillStyle=urg||(st==='paid'?'#ffffff59':'#fff');g.shadowColor=urg||'#fff';g.shadowBlur=st==='paid'?3:10;g.fill();g.shadowBlur=0;if(st==='paid')txt('✓',x+sz/2+6,axisY-14,13,'#d8d8d8','center',true)}
    hits.push({x:x-14,y:axisY-14,w:28,h:28,fn:()=>billPanel(k,it)});
    let l1,l2,l3,l4,l5='';
    if(it.length>1){l1=it.length+' BILLS';const fq=[...new Set(it.map(o=>o.f))];l3=fq.length===1?fq[0]:'MIXED';l4=it.map(o=>o.n).join(', ');l2=(st==='paid'?'PAID '+money(total):money(rem))+(tbd?'+':'')}
    else{const o=it[0];l1=o.n;l2=o.tbd?'TBD':money(o.amt);l3=o.f;l4=o.a;
      if(o.catchup)l2=st==='paid'?'CAUGHT UP':'BEHIND '+money(o.rem);else if(st==='paid')l2='PAID '+l2;else if(st==='partial')l2=money(o.rem)+' left';else if(st==='pastdue')l2+=' · PAST DUE';else if(o.auto)l2+=' · auto'}
    l1=trunc(l1,22);let o3,o4,o2,sh,f2;
    if(room>=56&&it.length>1&&l4.length>20){const h=Math.ceil(it.length/2);l5=trunc(it.slice(h).map(o=>o.n).join(', '),22);l4=trunc(it.slice(0,h).map(o=>o.n).join(', '),22);o3=12;o4=21;var o5=30;o2=40;sh=56;f2=12}
    else{l4=trunc(l4,20);if(room>=47){o3=12;o4=21;o2=31;sh=47;f2=12}else if(room>=40){o3=11;o4=19;o2=27;sh=41;f2=11}else{o3=10;o4=10;o2=18;sh=32;f2=11;l3=l3+' · '+l4;l4=''}}
    const ly=Math.max(tagBot,axisY-9-sh),col=urg||(st==='paid'?'#b8b8b8':st==='predicted'?'#9a9da2':'#fff');
    g.font='400 9.5px sans-serif';let w=g.measureText(l1).width;g.font='700 '+f2+'px sans-serif';w=Math.max(w,g.measureText(l2).width);g.font='400 7.5px sans-serif';w=Math.max(w,g.measureText(l3).width,g.measureText(l4).width,g.measureText(l5).width);
    labels.push({x,w:w+8,ly,sh,lines:[[l1,0,9.5,col,false],[l3,o3,7.5,'#8a8d92',false],[l4,o4,7.5,'#8a8d92',false],[l5,o5,7.5,'#8a8d92',false],[l2,o2,f2,col,st!=='predicted']],ny:axisY-sz/2,col})
  });
  // de-overlap: cluster overlapping labels side by side; keep clear of the TODAY plate
  const blocks=[];labels.sort((a,b)=>a.x-b.x).forEach(L=>{blocks.push({items:[L],w:L.w,left:L.x-L.w/2});
    while(blocks.length>1){const b2=blocks[blocks.length-1],b1=blocks[blocks.length-2];if(b1.left+b1.w<=b2.left)break;const its=b1.items.concat(b2.items);let tw=0,s=0;its.forEach(i=>{s+=i.x-tw-i.w/2;tw+=i.w});blocks.splice(-2,2,{items:its,w:tw,left:s/its.length})}});
  const pw=plateW()/2+6;let lim=cx-pw;for(let i=blocks.length-1;i>=0;i--){const b=blocks[i];if(b.left+b.w/2>=cx)continue;if(b.left+b.w>lim)b.left=lim-b.w;lim=b.left}
  lim=cx+pw;blocks.forEach(b=>{if(b.left+b.w/2<cx)return;if(b.left<lim)b.left=lim;lim=b.left+b.w});
  blocks.forEach(b=>{let c=b.left;b.items.forEach(L=>{const ctr=c+L.w/2;c+=L.w;L.lines.forEach(s=>{if(s[0]&&s[1]!==undefined)txt(s[0],ctr,L.ly+s[1],s[2],s[3],'center',s[4],s[4]?'#ffffff80':null)});
    if(Math.abs(ctr-L.x)>3){g.globalAlpha=.55;g.strokeStyle=L.col;g.lineWidth=.8;g.beginPath();g.moveTo(ctr,L.ly+L.sh);g.lineTo(L.x,L.ny-1);g.stroke();g.globalAlpha=1}})});
  // TODAY plate + line (fixed at centre)
  const fd=new Date(t0.getTime()+Math.round(off)*DAY),lbl=Math.round(off)===0?'TODAY':fd.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase();
  const w=plateW(lbl),ph=24;g.shadowColor='#fff';g.shadowBlur=10;g.strokeStyle='#fff';g.lineWidth=3;g.beginPath();g.moveTo(cx,ph);g.lineTo(cx,axisY+2);g.stroke();g.beginPath();g.moveTo(cx-8,axisY+2);g.lineTo(cx+8,axisY+2);g.stroke();
  const pg=g.createLinearGradient(0,0,0,ph);[[0,'#e9ebed'],[.2,'#dcdfe2'],[.45,'#d6d9dd'],[.55,'#b8bcc1'],[.8,'#aeb3b8'],[1,'#9ea3a9']].forEach(s=>pg.addColorStop(s[0],s[1]));
  g.fillStyle=pg;rr(cx-w/2,0,w,ph,3);g.fill();g.shadowBlur=0;g.strokeStyle='#4a4e53';g.lineWidth=1.2;g.stroke();
  [[4,4],[w-4,4],[4,ph-4],[w-4,ph-4]].forEach(p=>{g.fillStyle='#8a8f95';g.beginPath();g.arc(cx-w/2+p[0],p[1],2.2,0,7);g.fill()});
  txt(lbl,cx,3,16,'#1e2124','center',true);g.filter='none';
}
function plateW(l){g.font='700 16px sans-serif';return g.measureText(l||'TODAY').width+30}
function rr(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
// ---------- touch pan with inertia ----------
let sx=null,so=0,lx=0,lt=0,moved=false,raf=null;
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);sx=e.clientX;so=off;lx=e.clientX;lt=performance.now();vel=0;moved=false;cancelAnimationFrame(raf)});
cv.addEventListener('pointermove',e=>{if(sx===null)return;const dx=e.clientX-sx;if(Math.abs(dx)>6)moved=true;off=clamp(so-dx/ppd);const n=performance.now();vel=(lx-e.clientX)/ppd/Math.max(1,n-lt)*16;lx=e.clientX;lt=n;draw()});
cv.addEventListener('pointerup',e=>{const was=sx;sx=null;if(was===null)return;
  if(!moved){const r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const h=hits.slice().reverse().find(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h);if(h)h.fn();return}
  const step=()=>{vel*=.94;off=clamp(off+vel);draw();if(Math.abs(vel)>.01)raf=requestAnimationFrame(step);else snap()};raf=requestAnimationFrame(step)});
function clamp(v){return Math.max(-95,Math.min(200,v))}
function snap(){const tgt=Math.round(off),s=off;let i=0;const f=()=>{i++;off=s+(tgt-s)*Math.min(1,i/8);draw();if(i<8)raf=requestAnimationFrame(f)};f()}
$('bToday').onclick=()=>{off=0;draw()};
// ---------- panels ----------
function sheet(title,sub,html,filter){$('ct').textContent=title;$('cs').textContent=sub||'';$('cf').innerHTML=filter||'';$('cbody').innerHTML=html;$('sheet').classList.add('show')}
$('cClose').onclick=()=>$('sheet').classList.remove('show');$('sheet').onclick=e=>{if(e.target.id==='sheet')$('sheet').classList.remove('show')};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function cfPanel(day){
  refresh(false);let acc='All accounts';
  const render=()=>{const rows=(D.cashflow.rows||[]).filter(r=>(!day||r.date===day)&&(acc==='All accounts'||r.account===acc));let sum=0;
    const h=rows.map(r=>{sum+=r.amount;return'<div class="row"><div>'+pdate(r.date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+(r.pending?' *':'')+'</div><div>'+esc(r.account)+'</div><div class="amt pv">'+money(r.amount)+'</div><div class="pv">'+esc(r.payee)+'</div><div class="d2 pv">'+esc(r.description)+'</div></div>'}).join('')||'<div style="color:#888;padding:10px">No withdrawals found.</div>';
    $('cbody').innerHTML=h;$('cs').innerHTML='Updated '+fmtTime(D.cashflow.lastUpdated)+' · <span class="pv">'+rows.length+' items · '+money(sum)+' out</span>'};
  const opts=['All accounts','360',"Brink's",'Platinum','Secured','Savor'].map(a=>'<option>'+esc(a)+'</option>').join('');
  sheet('CASH FLOW'+(day?' · '+pdate(day).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase():''),'','',
    '<div style="display:flex;gap:8px;margin-bottom:6px"><select id="fAcc">'+opts+'</select>'+(day?'<button class="btn" id="fAll" style="flex:none;padding:4px 10px">ALL DAYS</button>':'')+'</div>');
  $('fAcc').onchange=e=>{acc=e.target.value;render()};if(day)$('fAll').onclick=()=>{day=null;$('fAll').remove();$('ct').textContent='CASH FLOW';render()};render();
}
function billPanel(k,it){sheet(pdate(k).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'}).toUpperCase(),it.length+' bill'+(it.length>1?'s':''),
  it.map(o=>'<div class="row"><div class="pv" style="grid-column:1/3;color:#fff">'+esc(o.n)+'</div><div class="amt pv">'+(o.tbd?'TBD':money(o.st==='paid'?o.amt:o.rem))+'</div><div>'+o.st.toUpperCase()+(o.auto?' · auto':'')+'</div><div class="d2">'+esc(o.f)+' · '+esc(o.a)+'</div></div>').join(''))}
function acctPanel(a){sheet(String(a.name).toUpperCase(),'updated '+fmtTime(a.asOf||D.balUpdated),'<div style="text-align:center;padding:12px"><div style="color:#888;font-size:11px">'+(a.kind==='credit'?'OWED':'BALANCE')+'</div><div class="pv" style="font-size:30px;font-weight:700">'+(a.balance==null?'—':money(a.balance))+'</div><div style="color:#888;font-size:11px;margin-top:10px">AVAILABLE</div><div class="pv" style="font-size:18px">'+(a.available==null?'not reported':money(a.available))+'</div></div>')}
$('bAuto').onclick=()=>{if(!D)return;const t=iso(today()),e=iso(new Date(today().getTime()+45*DAY));const r=(D.occ||[]).filter(o=>o.auto&&o.d>=t&&o.d<=e);
  sheet('AUTO-PAYS','next 45 days',r.map(o=>'<div class="row"><div>'+pdate(o.d).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+'</div><div class="pv" style="grid-column:2/3">'+esc(o.a)+'</div><div class="amt pv">'+(o.tbd?'TBD':money(o.amt))+'</div><div class="pv">'+esc(o.n)+'</div></div>').join('')||'<div style="color:#888;padding:10px">None.</div>')};
$('bCF').onclick=()=>D&&cfPanel(null);
$('bRef').onclick=()=>refresh(true);
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
size();setBlur(true);refresh(false);setInterval(()=>refresh(false),15*60000);
