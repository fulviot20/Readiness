"use strict";
/* ------------------------------------------------------------ storage */
const LS={get(k){try{return localStorage.getItem(k)}catch(e){return null}},
  set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const clip=(x,a,b)=>Math.max(a,Math.min(b,x));

/* ------------------------------------------------------------ vocabulary */
const BANDS=[[80,"Super","var(--s4)"],[60,"Normal","var(--s3)"],[50,"Low","var(--s2)"],[0,"Very low","var(--s1)"]];
const ADVICE={"Super":"Recovery is above your usual: a good day to go for it if you feel it.",
  "Normal":"Recovery is in your usual range: train as planned and stay tuned to how it feels.",
  "Low":"Recovery is below your usual: see how the legs respond.",
  "Very low":"Recovery is well below your usual: keep an eye on how you feel today."};
const bandOf=s=>BANDS.find(b=>s>=b[0]);
const FEEL={1:"Strong",2:"Good",3:"Normal",4:"Poor",5:"Weak"};
const Q={
  sleep:{title:"How rested did you wake up?",
    hint:"Judge how rested you are, not how the night went: your watch already tracks that. A foggy head right after waking fades in minutes, so answer once you're properly awake.",
    opts:[["Exhausted","drained, could barely get up."],["Tired","felt like you needed a lot more sleep."],
      ["So-so","groggy at first, fine once moving."],["Rested","woke up fresh, even after a broken night."],
      ["Recharged","woke easily, full of energy."]]},
  feel:{title:"How do your legs and body feel?",
    hint:"Muscles only, as if you had to train right now. Sleepiness belongs to the first question, not here.",
    opts:[["Wrecked","heavy, sore legs; a session would be a struggle."],["Fatigued","legs still carry the last sessions."],
      ["Normal","no soreness or heaviness, nothing special either."],["Fresh","light legs, ready for a solid session."],
      ["Primed","legs feel great, you could go hard right now."]]},
};

/* ------------------------------------------------------------ crypto */
const b64={dec:s=>{const b=atob(s),n=b.length,u=new Uint8Array(n);for(let i=0;i<n;i++) u[i]=b.charCodeAt(i);return u;},
  enc:u=>{let s="";for(let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s);}};
// Turning the passphrase into a key is deliberately slow (200,000 rounds). The published data always uses the same
// salt, so the key is worked out once and kept on this device (it can't be read back out of the browser's store):
// after the first launch the app opens without that wait, and messages to the server reuse the same key.
const KEYS=new Map();let SALT0=null;
function keyStore(mode,fn){
  return new Promise(res=>{try{const o=indexedDB.open("rd-keys",1);
    o.onupgradeneeded=()=>o.result.createObjectStore("k");
    o.onerror=()=>res(null);
    o.onsuccess=()=>{try{const tx=o.result.transaction("k",mode),rq=fn(tx.objectStore("k"));
      tx.oncomplete=()=>{o.result.close();res(rq?rq.result:null);};tx.onerror=tx.onabort=()=>{o.result.close();res(null);};}catch(e){res(null);}};
  }catch(e){res(null);}});
}
const forgetKeys=()=>{KEYS.clear();SALT0=null;return keyStore("readwrite",s=>s.clear());};
async function passTag(pass){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("readiness-key-tag:"+pass));return b64.enc(new Uint8Array(h).subarray(0,12));}
async function keyFor(pass,salt,keep){
  const sid=b64.enc(salt),id=sid+"|"+pass;
  if(KEYS.has(id)) return KEYS.get(id);
  const job=(async()=>{
    const tag=keep?await passTag(pass):null;
    if(keep){const hit=await keyStore("readonly",s=>s.get(sid));if(hit&&hit.tag===tag&&hit.key) return hit.key;}
    const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(pass),"PBKDF2",false,["deriveKey"]);
    const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:200000,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
    if(keep) keyStore("readwrite",s=>{s.clear();s.put({tag,key},sid);});
    return key;
  })();
  KEYS.set(id,job); job.catch(()=>KEYS.delete(id));
  return job;
}
// keep=true for the published data: its key is remembered on the device
async function decryptEnv(env,pass,keep){
  const key=await keyFor(pass,b64.dec(env.salt),keep);
  const obj=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:b64.dec(env.iv)},key,b64.dec(env.ct))));
  if(keep) SALT0=env.salt;
  return obj;
}
async function encryptObj(obj,pass){
  const salt=SALT0?b64.dec(SALT0):crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await keyFor(pass,salt),new TextEncoder().encode(JSON.stringify(obj))));
  return {v:1,salt:b64.enc(salt),iv:b64.enc(iv),ct:b64.enc(ct)};
}

/* ------------------------------------------------------------ score adjust (mirrors readiness.py) */
function applyAnswers(day,ans){
  if(day.score==null) return day;
  let mod=0,sick=false;
  if(ans){ if(ans.feel) mod+=(ans.feel-3)*5; if(ans.sleep) mod+=(ans.sleep-3)*2.5; if(ans.sick){sick=true;mod-=10;} }
  mod=clip(mod,-15,15);
  let s=clip(day.base+mod,1,100); if(sick||day.alarm) s=Math.min(s,49); s=Math.round(s);
  const band=bandOf(s)[1];
  return {...day,score:s,mod:Math.round(mod),band,advice:ADVICE[band],answers:ans||null};
}

/* ------------------------------------------------------------ state */
let DATA=null,sel=0,draft={},prevScore=0;
// a refresh (pull down, or the browser's reload) brings you back to the same page, day and scroll position;
// closing and reopening the app starts from Today
const RELOAD=(()=>{try{return performance.getEntriesByType("navigation")[0]?.type==="reload";}catch(e){return false;}})();
// links from notifications: ?tab=training opens a tab, ?go=journal|checkin|weight goes straight to the thing to do
const QS=new URLSearchParams(location.search);let GO_PENDING=QS.get("go");
let NAV0=null;if(RELOAD){try{NAV0=JSON.parse(sessionStorage.getItem("rd_nav")||"null");}catch(e){}}
// which page of each tab is open (the pill menu under the title)
let PG={today:"overview",training:"week",athlete:"profile"};
function saveNav(){try{sessionStorage.setItem("rd_nav",JSON.stringify({t:TAB,s:ATH_SUB,p:PG,f:foodSel,d:DATA?.days?.[sel]?.date,y:scrollY}));}catch(e){}}
addEventListener("pagehide",saveNav);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden") saveNav();});
const todayISO=()=>new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Rome"});
const fmtDay=(iso,o)=>new Date(iso+"T12:00").toLocaleDateString("en-GB",o);
const hm=h=>{const m=Math.round(h*60);return `${Math.floor(m/60)}:${String(m%60).padStart(2,"0")}`};
const sameAns=(a,b)=>JSON.stringify(a||{},Object.keys(a||{}).sort())===JSON.stringify(b||{},Object.keys(b||{}).sort());

// opens at once on the last copy kept on this phone, then swaps in the fresh data as soon as it arrives
async function cachedEnv(){try{const c=await caches.open("rd-data"),r=await c.match("data.enc");return r?await r.json():null;}catch(e){return null;}}
async function saveEnv(txt){try{const c=await caches.open("rd-data");await c.put("data.enc",new Response(txt,{headers:{"content-type":"application/json"}}));}catch(e){}}
function useData(d,quiet,keepY){
  const keepDate=quiet&&DATA?DATA.days[sel]?.date:null,keepDraft=quiet?{...draft}:null;
  DATA=d; CAL=null; PB=null; ATH_CACHE=null; foodReset(); syncPull(); try{trimCheck();}catch(e){}
  for(const d of DATA.days){const n=LS.get("note:"+d.date); if(n&&!d.note) d.note=JSON.parse(n);}
  for(const d of DATA.days){const l=LS.get("ans:"+d.date); if(l&&!d.answers) Object.assign(d,applyAnswers(d,JSON.parse(l)));}
  // always open on today, even before today's data has arrived
  const today=todayISO();
  if(!DATA.days.some(d=>d.date===today)){
    const loc=LS.get("ans:"+today);
    DATA.days.push({date:today,workouts:[],plan:(DATA.upcoming||{})[today]||[],answers:loc?JSON.parse(loc):null});
  }
  const k=keepDate?DATA.days.findIndex(d=>d.date===keepDate):NAV0?.d?DATA.days.findIndex(d=>d.date===NAV0.d):-1;
  sel=k>=0?k:DATA.days.findIndex(d=>d.date===today);
  draft=keepDraft&&Object.keys(keepDraft).length?keepDraft:{...(DATA.days[sel].answers||{})};
  loadedAt=Date.now(); if(!quiet) prevScore=0; render(); if(quiet) scrollTo(0,keepY);
  else if(NAV0&&!NAV0.used){NAV0.used=true;requestAnimationFrame(()=>scrollTo(0,NAV0.y||0));}
  applyGo();
}
function applyGo(){
  const g=GO_PENDING; if(!g) return; GO_PENDING=null;
  const t=DATA.days.findIndex(d=>d.date===todayISO()); if(t>=0&&sel!==t){sel=t;draft={...(DATA.days[t].answers||{})};}
  if(g==="journal"){TAB="today";PG.today="day";SCROLL_TO="journal";jDay=todayISO();render();afterRender();}
  else if(g==="weight"){TAB="athlete";ATH_SUB="profile";PG.athlete="profile";render();scrollTo(0,0);setTimeout(()=>openAth("weight"),350);}
  else if(g==="checkin"){TAB="today";PG.today="overview";MORE_OPEN=true;render();requestAnimationFrame(()=>document.querySelector(".checkin")?.scrollIntoView({block:"center"}));}
}
let swDone=false;
// ENV_IV names the published file that is on screen. A tiny "stamp" file says which one is current,
// so the app downloads the full data only when it has actually changed (not at every open or every check).
let ENV_IV=null;
async function stampIV(){
  try{const r=await fetch("stamp.json?t="+Date.now(),{cache:"no-store"});if(!r.ok) return null;return (await r.json()).iv||null;}catch(e){return null;}
}
async function fetchEnv(){
  const r=await fetch("data.enc?t="+Date.now(),{cache:"no-store"});
  if(!r.ok) throw new Error("No data published yet. Run the workflow on GitHub.");
  return r.text();
}
async function load(quiet=false){
  const pass=LS.get("rd_pass"); if(!pass) return lock();
  quiet=quiet&&!!DATA; let shown=quiet;
  const stamp=stampIV();                      // asked straight away, while the saved copy is being opened
  let first=null;
  if(!quiet){
    const c=await cachedEnv();
    if(c){ try{ useData(await decryptEnv(c,pass,true),false,0); ENV_IV=c.iv; shown=true; }catch(e){} }
    if(!shown){ $("app").innerHTML=splash(); first=fetchEnv(); first.catch(()=>{}); }
  }
  try{
    const cur=first?null:await stamp;
    if(shown&&cur&&cur===ENV_IV) loadedAt=Date.now();          // nothing new: no download, no decryption
    else{
      const txt=await (first||fetchEnv()),env=JSON.parse(txt);
      if(shown&&env.iv===ENV_IV) loadedAt=Date.now();
      else{
        const d=await decryptEnv(env,pass,true);
        saveEnv(txt); ENV_IV=env.iv;
        if(!shown||d.generated_at!==DATA.generated_at) useData(d,shown,scrollY); else loadedAt=Date.now();
      }
    }
  }catch(e){
    if(e.name==="OperationError") return lock("That passphrase doesn't match. Try again.");
    if(shown){ if(!quiet) toast("Offline · showing your last data"); return; }
    bootDone(); $("app").innerHTML=`<p class="loading">${esc(e.message)}</p>`; return;
  }
  flushOutbox(); syncPush();
  keepSubscription();
  if(!swDone&&"serviceWorker" in navigator){ swDone=true; navigator.serviceWorker.register("sw.js").catch(()=>{}); }
  autoRefresh();
}
let loadedAt=0,polling=false,autoTries=0;
// GitHub's schedule is unreliable (runs can be skipped for hours): every time the app opens
// with stale data, it asks GitHub to recalculate and waits for the new score by itself
// opening the app asks the server for a fresh calculation (the Keeper picks it up within ~20 s),
// then waits quietly for the new data; if today's score is still missing it says so
async function pingServer(){
  if(Date.now()-(+LS.get("rd_ping")||0)<120000) return;
  LS.set("rd_ping",String(Date.now()));
  try{ await fetch("https://ntfy.sh/"+await mailTopic(),{method:"POST",body:JSON.stringify({kind:"refresh"})}); }catch(e){}
}
async function autoRefresh(){
  const latest=DATA.days[DATA.days.length-1],age=Date.now()-new Date(DATA.generated_at).getTime();
  const stale=((latest.date!==todayISO()||latest.score==null)&&new Date().getHours()>=5)||age>30*60000;
  const synced=Date.now()-syncAt<10*60000;          // just back from Garmin Connect
  if((age<3*60000&&!synced)||polling||autoTries>=2) return;
  if(synced) LS.del("rd_ping");
  pingServer();
  autoTries++; polling=true; if(stale) setNote(synced?"Getting last night from Garmin…":"Checking for new data…");
  const was=ENV_IV,t0=Date.now(),limit=(stale?11:6)*60000;
  while(Date.now()-t0<limit&&document.visibilityState==="visible"){
    await new Promise(r=>setTimeout(r,20000));
    try{
      let cur=await stampIV();
      if(!cur){ const r=await fetch("data.enc?t="+Date.now(),{cache:"no-store"}); if(!r.ok) continue; cur=(await r.json()).iv; }
      if(cur!==was){ polling=false; return load(true); }
    }catch(e){}
  }
  polling=false; setNote("");
}
function setNote(t){ const n=$("upd-note"); if(n) n.textContent=t; const b=$("upd"); if(b) b.disabled=!!t; }
// the installed app stays in memory overnight: refresh the data when it comes back to the screen
// back after more than 10 minutes away: start again from today's score, like a fresh launch
let hiddenAt=0;
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="hidden"){hiddenAt=Date.now();return;}
  if(DATA&&hiddenAt&&Date.now()-hiddenAt>10*60000&&!$("sheet").classList.contains("open")){
    TAB="today";ATH_SUB="profile";PG={today:"overview",training:"week",athlete:"profile"};foodSel=todayISO();const i=DATA.days.findIndex(d=>d.date===todayISO());if(i>=0){sel=i;draft={...(DATA.days[i].answers||{})};}render();scrollTo(0,0);}
});
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&DATA&&!$("sheet").classList.contains("open")){ autoTries=0; if(Date.now()-loadedAt>60000) load(true); else autoRefresh(); }
});
async function requestUpdate(btn){
  autoTries=0; polling=false; LS.del("rd_ping"); autoRefresh();
}

// the opening screen (logo and name, in index.html) stays for at least 0.8 s from launch, then fades into the page
function bootDone(){
  const b=$("boot"); if(!b||b.dataset.out) return; b.dataset.out="1";
  setTimeout(()=>{b.classList.add("out");setTimeout(()=>b.remove(),340);},Math.max(0,800-performance.now()));
}
setTimeout(bootDone,6000);
const LOGO_C=[[255,93,108],[247,201,72],[52,211,153],[74,163,255]];
function logoSVG(sz){
  const P=a=>[50+38*Math.sin(a*Math.PI/180),50-38*Math.cos(a*Math.PI/180)];
  const arc=(a,b)=>{const[x1,y1]=P(a),[x2,y2]=P(b);return `M${x1.toFixed(2)} ${y1.toFixed(2)}A38 38 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;};
  const mix=t=>{t=Math.min(.9999,t)*3;const i=Math.floor(t),f=t-i,a=LOGO_C[i],b=LOGO_C[i+1];return `rgb(${a.map((v,k)=>Math.round(v+(b[k]-v)*f)).join(",")})`;};
  let segs="";for(let a=0;a<300;a+=3)segs+=`<path d="${arc(a,a+3.6)}" stroke="${mix(a/300)}" stroke-width="5" fill="none"/>`;
  const[hx,hy]=P(300);
  return `<svg viewBox="0 0 100 100" width="${sz}" height="${sz}" aria-hidden="true">
    <circle cx="50" cy="50" r="38" fill="none" stroke="#fff" stroke-opacity=".06" stroke-width="5"/>${segs}<circle cx="50" cy="12" r="2.5" fill="rgb(255,93,108)"/>
    <circle cx="${hx.toFixed(2)}" cy="${hy.toFixed(2)}" r="4.2" fill="#fff"/><circle cx="${hx.toFixed(2)}" cy="${hy.toFixed(2)}" r="1.6" fill="#121a26"/></svg>`;
}
function splash(){return `<div class="splash">${logoSVG(96)}<div class="sp-w">Readiness</div></div>`;}
function lock(msg){
  bootDone(); const tb=$("tabbar"); if(tb) tb.remove();
  $("app").innerHTML=`<div class="lock">${logoSVG(64)}<h1>Readiness</h1><p>Enter the passphrase you saved on GitHub. It stays on this device.</p>
    <div class="field"><label for="pw">Passphrase</label><input id="pw" type="password" autocomplete="current-password"></div>
    <button class="btn" id="go">Unlock</button><div class="err">${esc(msg||"")}</div></div>`;
  const go=()=>{const v=$("pw").value.trim(); if(v){LS.set("rd_pass",v);MAIL_TOPIC=null;load();}};
  $("go").onclick=go; $("pw").onkeydown=e=>{if(e.key==="Enter")go()};
}

