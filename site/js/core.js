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
    hint:"Judge how you felt getting out of bed, not how the night went. Your watch already tracks the night.",
    opts:[["Exhausted","drained, could barely get up."],["Tired","felt like you needed a lot more sleep."],
      ["So-so","groggy at first, fine once moving."],["Rested","woke up fresh, even after a broken night."],
      ["Recharged","woke easily, full of energy."]]},
  feel:{title:"How recovered does your body feel?",
    hint:"Think legs and energy as if you had to train right now.",
    opts:[["Wrecked","heavy, sore legs; a session would be a struggle."],["Fatigued","legs still carry the last sessions."],
      ["Normal","neither fresh nor tired."],["Fresh","light legs, ready for a solid session."],
      ["Primed","you could go hard right now."]]},
};

/* ------------------------------------------------------------ crypto */
const b64={dec:s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)),enc:u=>btoa(String.fromCharCode(...u))};
async function keyFor(pass,salt){
  const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(pass),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:200000,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function decryptEnv(env,pass){
  const key=await keyFor(pass,b64.dec(env.salt));
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:b64.dec(env.iv)},key,b64.dec(env.ct))));
}
async function encryptObj(obj,pass){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
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
let NAV0=null;if(RELOAD){try{NAV0=JSON.parse(sessionStorage.getItem("rd_nav")||"null");}catch(e){}}
function saveNav(){try{sessionStorage.setItem("rd_nav",JSON.stringify({t:TAB,s:ATH_SUB,f:foodSel,d:DATA?.days?.[sel]?.date,y:scrollY}));}catch(e){}}
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
  DATA=d; CAL=null; ATH_CACHE=null;
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
}
let swDone=false;
async function load(quiet=false){
  const pass=LS.get("rd_pass"); if(!pass) return lock();
  quiet=quiet&&!!DATA; let shown=quiet;
  if(!quiet){
    const c=await cachedEnv();
    if(c){ try{ useData(await decryptEnv(c,pass),false,0); shown=true; }catch(e){} }
    if(!shown) $("app").innerHTML=splash();
  }
  try{
    const r=await fetch("data.enc?t="+Date.now(),{cache:"no-store"});
    if(!r.ok) throw new Error("No data published yet. Run the workflow on GitHub.");
    const txt=await r.text(),d=await decryptEnv(JSON.parse(txt),pass);
    saveEnv(txt);
    if(!shown||d.generated_at!==DATA.generated_at) useData(d,shown,scrollY); else loadedAt=Date.now();
  }catch(e){
    if(e.name==="OperationError") return lock("That passphrase doesn't match. Try again.");
    if(shown){ if(!quiet) toast("Offline · showing your last data"); return; }
    $("app").innerHTML=`<p class="loading">${esc(e.message)}</p>`; return;
  }
  flushOutbox();
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
  const was=DATA.generated_at,pass=LS.get("rd_pass"),t0=Date.now(),limit=(stale?11:6)*60000;
  while(Date.now()-t0<limit&&document.visibilityState==="visible"){
    await new Promise(r=>setTimeout(r,20000));
    try{
      const r=await fetch("data.enc?t="+Date.now(),{cache:"no-store"}); if(!r.ok) continue;
      const d=await decryptEnv(await r.json(),pass);
      if(d.generated_at!==was){ polling=false; return load(true); }
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
    TAB="today";ATH_SUB="profile";foodSel=todayISO();const i=DATA.days.findIndex(d=>d.date===todayISO());if(i>=0){sel=i;draft={...(DATA.days[i].answers||{})};}render();scrollTo(0,0);}
});
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&DATA&&!$("sheet").classList.contains("open")){ autoTries=0; if(Date.now()-loadedAt>60000) load(true); else autoRefresh(); }
});
async function requestUpdate(btn){
  autoTries=0; polling=false; LS.del("rd_ping"); autoRefresh();
}

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
  const tb=$("tabbar"); if(tb) tb.remove();
  $("app").innerHTML=`<div class="lock">${logoSVG(64)}<h1>Readiness</h1><p>Enter the passphrase you saved on GitHub. It stays on this device.</p>
    <div class="field"><label for="pw">Passphrase</label><input id="pw" type="password" autocomplete="current-password"></div>
    <button class="btn" id="go">Unlock</button><div class="err">${esc(msg||"")}</div></div>`;
  const go=()=>{const v=$("pw").value.trim(); if(v){LS.set("rd_pass",v);load();}};
  $("go").onclick=go; $("pw").onkeydown=e=>{if(e.key==="Enter")go()};
}

