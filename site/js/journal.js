"use strict";
/* ------------------------------------------------------------ journal: habits and what they do to you */
// Tap what happened on a day; over the weeks the app compares the next morning's recovery and sleep
// on days with and without each habit. It's a correlation over your own data, not proof.
// the rule for each habit, so the same day is always tagged the same way
const J_HINT={alcohol:"Any alcohol, even one glass.",caffeine:"Coffee, tea, cola or energy drinks after 4 pm.",
  late_meal:"Finished eating less than 2 hours before going to sleep.",big_meal:"A much bigger meal than usual: pizza, fried food, a big dinner out.",
  screens:"Phone, tablet or TV in bed in the hour before sleep.",stress:"Mental or emotional stress: work, worries, arguments. Not training: that is measured already.",
  late_workout:"Training that ended less than 3 hours before sleep.",nap:"Any nap during the day.",travel:"Long drive or travel: well over your usual commute.",
  relax:"Stretching, breathing or meditation before sleep."};
let jHintId=null;
const J_DEFAULT=[["alcohol","🍷","Alcohol"],["caffeine","☕","Caffeine after 4 pm"],["late_meal","🍽️","Late dinner"],["big_meal","🍝","Heavy meal"],
  ["screens","📱","Screens in bed"],["stress","😮‍💨","Stressful day"],["late_workout","🌙","Late workout"],["nap","😴","Nap"],
  ["travel","🚗","Long commute or travel"],["relax","🧘","Stretching or meditation"]].map(([id,ic,label])=>({id,ic,label}));
let jDay=null;
function jTags(){
  const s=DATA.journal?.tags,l=lsJSON("rd_jtags",null),t=!s?l:!l?s:(l.ts||0)>=(s.ts||0)?l:s;
  const custom=t?.custom||[],hidden=new Set(t?.hidden||[]);
  return [...J_DEFAULT.filter(x=>!hidden.has(x.id)),...custom.map(c=>({...c,ic:"✦"}))];
}
function jTagCfg(){const s=DATA.journal?.tags,l=lsJSON("rd_jtags",null);return (!s?l:!l?s:(l.ts||0)>=(s.ts||0)?l:s)||{custom:[],hidden:[]};}
function jAll(){
  const m={};
  for(const [d,o] of Object.entries(DATA.journal?.days||{})) m[d]=o;
  for(const [d,o] of Object.entries(lsJSON("rd_journal",{}))) if(!m[d]||(o.ts||0)>=(m[d].ts||0)) m[d]=o;
  return m;
}
function jSave(date,tags){
  const o={date,tags,ts:Date.now()},L=lsJSON("rd_journal",{}),lim=isoAdd(todayISO(),-30);
  L[date]=o;for(const d of Object.keys(L)) if(d<lim) delete L[d];
  LS.set("rd_journal",JSON.stringify(L));sendQ("journal",o);
}
function journalCard(){
  const t=todayISO();if(!jDay) jDay=new Date().getHours()<15?isoAdd(t,-1):t;
  const e=jAll()[jDay],on=new Set(e?.tags||[]),done=!!e;
  return `<section class="sec" id="journal"><div class="sec-h"><h2>Journal</h2>
      <div class="range jr-d"><button data-jd="${isoAdd(t,-1)}" class="${jDay!==t?"on":""}">Yesterday</button><button data-jd="${t}" class="${jDay===t?"on":""}">Today</button></div></div>
    <div class="jr"><p class="jr-q">${jDay===t?"What's happening today?":"What happened yesterday?"} <span>${done?"Saved":"Tap all that apply"}</span></p>
      <div class="chips">${jTags().map(x=>`<button data-jt="${x.id}" class="${on.has(x.id)?"on":""}"><i>${x.ic}</i>${esc(x.label)}</button>`).join("")}
        <button data-jt="" class="none ${done&&!on.size?"on":""}">None of these</button></div>
      <p class="jr-h">${jHintId&&J_HINT[jHintId]?`<b>${esc(jTags().find(x=>x.id===jHintId)?.label||"")}:</b> ${esc(J_HINT[jHintId])}`:"Tap a habit to see exactly when it counts."}</p>
      <div class="jr-f"><button id="jr-edit">Edit habits</button><button id="jr-imp">See what they do to you →</button></div></div></section>`;
}
function bindJournal(){
  const box=$("journal");if(!box) return;
  box.querySelectorAll("[data-jd]").forEach(b=>b.onclick=()=>{jDay=b.dataset.jd;redrawJournal();});
  box.querySelectorAll("[data-jt]").forEach(b=>b.onclick=()=>{
    const e=jAll()[jDay],cur=new Set(e?.tags||[]),id=b.dataset.jt;
    if(!id) cur.clear(); else cur.has(id)?cur.delete(id):cur.add(id);
    jHintId=id||null;
    jSave(jDay,[...cur]);buzz(5);redrawJournal();});
  $("jr-imp").onclick=openImpact; $("jr-edit").onclick=openJTags;
}
function redrawJournal(){const b=$("journal");if(!b) return;b.outerHTML=journalCard();bindJournal();}
function habitImpact(){
  const J=jAll(),byDate=Object.fromEntries((DATA.days||[]).map(d=>[d.date,d])),mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
  const rows=[];
  for(const [d,o] of Object.entries(J)){const nx=byDate[isoAdd(d,1)];if(!nx) continue;
    const rec=nx.score??null,sl=nx.sleep_score?.score??null;if(rec==null&&sl==null) continue;rows.push({tags:o.tags||[],rec,sl});}
  return jTags().map(tag=>{
    const y=rows.filter(r=>r.tags.includes(tag.id)),n=rows.filter(r=>!r.tags.includes(tag.id));
    if(y.length<3||n.length<3) return {tag,n:y.length,base:n.length,need:true};
    const f=(a,k)=>mean(a.map(r=>r[k]).filter(v=>v!=null));
    const rec=f(y,"rec")!=null&&f(n,"rec")!=null?f(y,"rec")-f(n,"rec"):null,sl=f(y,"sl")!=null&&f(n,"sl")!=null?f(y,"sl")-f(n,"sl"):null;
    return {tag,n:y.length,base:n.length,rec,sl};
  }).sort((a,b)=>(a.need-b.need)||Math.abs(b.rec??0)-Math.abs(a.rec??0));
}
function openImpact(){
  const I=habitImpact(),days=Object.keys(jAll()).length;
  const bar=(v,lbl)=>{if(v==null) return "";const w=Math.min(50,Math.abs(v)/20*50),c=v>=0?"var(--alpine)":"#f0798a";
    return `<div class="im-b"><small>${lbl}</small><div class="im-t"><i style="${v>=0?`left:50%`:`right:50%`};width:${w}%;background:${c}"></i></div><b style="color:${c}">${v>=0?"+":"−"}${Math.abs(v).toFixed(0)}</b></div>`;};
  const ready=I.filter(x=>!x.need),wait=I.filter(x=>x.need);
  openSheet(`<div class="sh-top"><h2>Habits impact</h2>${X}</div>
    <p class="sh-desc">Next morning's recovery and sleep score on days with each habit, compared with days without it. ${days} day${days===1?"":"s"} journaled so far.</p>
    ${ready.length?ready.map(x=>`<div class="im"><div class="im-h"><span>${x.tag.ic} ${esc(x.tag.label)}</span><em>${x.n} days${x.n<6?" · early":""}</em></div>${bar(x.rec,"Recovery")}${bar(x.sl,"Sleep")}</div>`).join("")
      :`<div class="note-card">Nothing to compare yet. Each habit needs at least 3 days with it and 3 without: keep tapping the Journal for a couple of weeks and the first results appear here.</div>`}
    ${wait.length?`<h3 class="sh-sub">Collecting</h3>${wait.map(x=>`<div class="ent"><span>${x.tag.ic} ${esc(x.tag.label)}</span><b>${x.n<3?`${3-x.n} more day${3-x.n>1?"s":""} with it`:`${3-x.base} more without`}</b></div>`).join("")}`:""}
    <p class="sh-note" style="margin-top:16px">This is a comparison over your own days, not proof of cause: a late dinner and a bad night may both come from a long shift. Patterns become reliable after 4–6 weeks.</p>
    ${aiKey()&&ready.length?`<button class="coach-bar" id="im-ai">${SPARK}<span>Ask AI to explain my patterns</span></button>`:""}`);
  const a=$("im-ai");if(a) a.onclick=()=>{openAssistant("today");setTimeout(()=>{const t=$("as-t");if(t){t.value="Spiegami cosa dicono le correlazioni del mio journal e cosa potrei cambiare.";t.dispatchEvent(new Event("input"));}},50);};
}
function openJTags(){
  const cfg=structuredClone(jTagCfg());cfg.custom=cfg.custom||[];cfg.hidden=cfg.hidden||[];
  const draw=()=>{
    openSheet(`<div class="sh-top"><h2>Edit habits</h2>${X}</div>
      <p class="sh-desc">Choose what to track. Add your own, like "shift at the hospital" or "evening rehearsal".</p>
      ${J_DEFAULT.map(x=>`<div class="ent"><span>${x.ic} ${esc(x.label)}</span><button data-hd="${x.id}">${cfg.hidden.includes(x.id)?"Show":"Hide"}</button></div>`).join("")}
      ${cfg.custom.map((c,i)=>`<div class="ent"><span>✦ ${esc(c.label)}</span><button data-rc="${i}">Remove</button></div>`).join("")}
      <div class="ath-log" style="grid-template-columns:1fr auto;margin-top:16px"><div class="field"><label for="jt-n">New habit</label><input id="jt-n" type="text" maxlength="30" placeholder="e.g. Night shift"></div><button class="btn" id="jt-add">Add</button></div>
      <div class="savebar" style="margin-top:12px"><span></span><button class="btn" id="jt-save">Done</button></div>`);
    $("sheet").querySelectorAll("[data-hd]").forEach(b=>b.onclick=()=>{const id=b.dataset.hd,i=cfg.hidden.indexOf(id);i>=0?cfg.hidden.splice(i,1):cfg.hidden.push(id);draw();});
    $("sheet").querySelectorAll("[data-rc]").forEach(b=>b.onclick=()=>{cfg.custom.splice(+b.dataset.rc,1);draw();});
    $("jt-add").onclick=()=>{const v=$("jt-n").value.trim();if(!v) return;cfg.custom.push({id:"c_"+uid(),label:v});draw();};
    $("jt-save").onclick=()=>{cfg.ts=Date.now();LS.set("rd_jtags",JSON.stringify(cfg));sendQ("jtags",cfg);closeSheet();redrawJournal();toast("Habits updated");};
  };
  draw();
}

/* ------------------------------------------------------------ feel: toast, haptics, outbox */
function buzz(ms=8){try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}}
let toastT=null;
function toast(msg,action,fn){
  let t=$("toast"); if(!t){t=document.createElement("div");t.id="toast";t.className="toast";t.setAttribute("role","status");document.body.appendChild(t);}
  t.innerHTML=`<span>${esc(msg)}</span>${action?`<button>${esc(action)}</button>`:""}`;
  if(action) t.querySelector("button").onclick=()=>{t.classList.remove("on");fn();};
  t.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("on"),action?5000:2200);
}
// messages that couldn't leave the phone wait here and go out when the connection is back
async function sendQ(kind,obj){
  try{await sendMail(kind,obj);return true;}
  catch(e){const q=lsJSON("rd_outbox",[]);q.push({kind,obj});LS.set("rd_outbox",JSON.stringify(q.slice(-300)));return false;}
}
let flushing=false;
async function flushOutbox(){
  const q=lsJSON("rd_outbox",[]); if(!q.length||flushing||!LS.get("rd_pass")) return; flushing=true;
  const rest=[]; for(const m of q){try{await sendMail(m.kind,m.obj);}catch(e){rest.push(m);}}
  LS.set("rd_outbox",JSON.stringify(rest)); flushing=false;
}
addEventListener("online",flushOutbox);

/* ------------------------------------------------------------ early warning, feel reminder, week in review */
function keyNotice(){
  const k=DATA.garmin_key; if(!k) return "";
  const days=Math.round((new Date(k.expires+"T12:00")-new Date(todayISO()+"T12:00"))/864e5);
  if(!k.error&&days>30) return "";
  const msg=k.error||days<=0?"Garmin isn't accepting the personal API key any more, so new data has stopped.":`Your Garmin personal API key expires in ${days} day${days===1?"":"s"}.`;
  return `<div class="alert" role="alert"><span class="ai"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/></svg></span>
    <span><b>Garmin key</b><span>${msg} Create a new one in Garmin Connect (Settings → Personal API key) and ask Claude to put it in place.</span></span></div>`;
}
function alertCard(day){
  return `<div class="alert" role="alert"><span class="ai"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.6v.1"/></svg></span>
    <span><b>Early warning</b><span>${esc((day.why||"").split(". ")[0])}. Go easy today and check how you feel; if symptoms appear, rest.</span></span></div>`;
}
function feelNudge(){
  // most recent session of the last two days without a feel rating
  const t=todayISO(),i=DATA.days.findIndex(d=>d.date===t);
  for(const d of [DATA.days[i],DATA.days[i-1]].filter(Boolean)){
    const w=(d.workouts||[]).filter(w=>w.type&&w.id).reverse().find(w=>w.feel==null);
    if(w) return `<a class="nudge" href="${INTERVALS}/activities/${encodeURIComponent(w.id)}" target="_blank" rel="noopener">
      <span class="ni"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg></span>
      <span><b>How did ${d.date===t?"today's":"yesterday's"} ${esc((w.name||"session").toLowerCase().includes("corsa")||w.type.includes("Run")?"run":w.type.includes("Ride")?"ride":"session")} feel?</b>
      <span>Rate it 1–5 in Intervals: it's how the score gets tuned to you.</span></span></a>`;
  }
  return "";
}
/* ------------------------------------------------------------ reminders */
// Three gentle nudges, each only when the thing is actually missing: the morning check-in, the evening journal and the
// weekly weigh-in. As notifications they are sent by the server (push.py reads the same settings, which follow you
// between devices); inside the app they show as one small card on Today.
const REMIND_DEF={checkin:true,journal:true,weight:true,jhour:21};
const remindCfg=()=>({...REMIND_DEF,...(lsJSON("rd_remind",null)||{})});
function weighAge(){const w=athLast("weight");return w?Math.round((new Date(todayISO()+"T12:00")-new Date(w.date+"T12:00"))/864e5):null;}
function remindNudge(){
  const cfg=remindCfg(),h=new Date().getHours(),age=weighAge();
  const card=(id,ic,t,sub)=>`<button class="nudge" id="${id}"><span class="ni">${ic}</span><span><b>${t}</b><span>${sub}</span></span></button>`;
  if(cfg.weight&&age!=null&&age>=7&&h<12) return card("nd-w",`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9.5a4.2 4.2 0 0 1 6 0M12 9.5l1.5-1.5"/></svg>`,
    "Weekly weigh-in",`Your last one was ${age} days ago. Before breakfast is the best moment.`);
  if(cfg.journal&&h>=20&&!jAll()[todayISO()]) return card("nd-j",`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h11a1 1 0 0 1 1 1v15H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zM9 9h6M9 13h4"/></svg>`,
    "Today's journal","Ten seconds: tap what happened today.");
  return "";
}
function remindRow(){
  if(pushState()!=="on") return "";
  const c=remindCfg(),chip=(k,t)=>`<button data-rm="${k}" class="${c[k]?"on":""}" aria-pressed="${!!c[k]}">${t}</button>`;
  return `<div class="rem"><label>Reminders</label><p>Sent only when something is missing, each at most once. Tap to switch one off.</p>
    <div class="chips">${chip("checkin","Morning check-in")}${chip("journal","Evening journal")}${chip("weight","Weekly weigh-in")}</div>
    <div class="rem-h${c.journal?"":" off"}"><span>Journal reminder at</span><div class="range">${[20,21,22].map(h=>`<button data-rh="${h}" class="${c.jhour===h?"on":""}">${h}:00</button>`).join("")}</div></div></div>`;
}
function bindRemind(){
  const box=document.querySelector("#sheet .rem"); if(!box) return;
  const redraw=()=>{box.outerHTML=remindRow();bindRemind();};
  box.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{const c=remindCfg();c[b.dataset.rm]=!c[b.dataset.rm];syncSet("rd_remind",c);buzz(5);redraw();});
  box.querySelectorAll("[data-rh]").forEach(b=>b.onclick=()=>{const c=remindCfg();c.jhour=+b.dataset.rh;syncSet("rd_remind",c);buzz(5);redraw();});
}
function weekReviewSection(){
  const today=new Date(todayISO()+"T12:00"),monday=today.getDay()===1;
  const R=monday&&DATA.last_week_review?DATA.last_week_review:DATA.week_review; if(!R||!R.cur.days) return "";
  const c=R.cur,p=R.prev;
  const delta=(a,b,better=1,unit="")=>a==null||b==null?"":`<em class="${(a-b)*better>0?"up":(a-b)*better<0?"down":""}">${a-b>0?"+":""}${Math.round((a-b)*10)/10}${unit}</em>`;
  const tile=(lab,val,d)=>`<div><small>${lab}</small><b>${val??"–"}</b>${d}</div>`;
  const hrs=h=>h?hmh(h):"–";
  const mk=R.markers||{},mtxt=[mk.vo2max!=null?`VO₂max <b>${mk.vo2max>0?"+":""}${mk.vo2max}</b>`:"",mk.ftp!=null?`FTP <b>${mk.ftp>0?"+":""}${Math.round(mk.ftp)} W</b>`:"",
    mk.easy_pace!=null?`Easy pace <b>${mk.easy_pace>0?"+":"−"}${Math.abs(Math.round(mk.easy_pace))}s/km</b>`:""].filter(Boolean);
  return `<section class="sec"><div class="sec-h"><h2>${monday?"Last week":"This week so far"}</h2><span>vs the week before</span></div>
    <div class="wr"><p class="wr-h">${esc(R.headline||"")}</p><div class="wr-g">
      ${tile("RECOVERY",c.recovery,delta(c.recovery,p.recovery))}
      ${tile("SLEEP",c.sleep,delta(c.sleep,p.sleep))}
      ${tile("SLEEP / NIGHT",hrs(c.hours),c.hours&&p.hours?`<em class="${c.hours>=p.hours?"up":"down"}">${c.hours>=p.hours?"+":"−"}${Math.round(Math.abs(c.hours-p.hours)*60)} min</em>`:"")}
      ${tile("TRAINING",c.minutes?hm2(c.minutes):"–",`<em>${c.sessions} session${c.sessions===1?"":"s"}</em>`)}
    </div>${mtxt.length?`<div class="wr-m">${mtxt.join("")}</div>`:""}</div></section>`;
}

/* ------------------------------------------------------------ notifications */
const repoInfo=()=>({owner:location.hostname.split(".")[0],repo:location.pathname.split("/").filter(Boolean)[0]});
const b64u=s=>{const p="=".repeat((4-s.length%4)%4),b=atob((s+p).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(b,c=>c.charCodeAt(0));};
// token-free channel to the server: encrypted messages on an ntfy.sh topic derived from the passphrase
let MAIL_TOPIC=null;
async function mailTopic(){
  const pw=LS.get("rd_pass"); if(MAIL_TOPIC&&MAIL_TOPIC[0]===pw) return MAIL_TOPIC[1];
  const t=await mailTopic0(); MAIL_TOPIC=[pw,t]; return t;
}
async function mailTopic0(){
  const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("readiness-mailbox:"+LS.get("rd_pass")));
  return "rd-"+[...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,32);
}
async function sendMail(kind,obj){
  const env=await encryptObj(obj,LS.get("rd_pass"));
  const r=await fetch("https://ntfy.sh/"+await mailTopic(),{method:"POST",body:JSON.stringify({kind,env})});
  if(!r.ok) throw new Error("no connection ("+r.status+")");
}
async function enableNotifications(st){
  if(!("serviceWorker" in navigator)||!("PushManager" in window)) throw new Error("this browser doesn't support notifications; open the app from the home-screen icon");
  if(!DATA.push_key) throw new Error("the server isn't ready yet, try again in a few minutes");
  const perm=await Notification.requestPermission(); if(perm!=="granted") throw new Error("notifications are blocked for this app in the phone settings");
  st("Setting up…");
  const reg=await navigator.serviceWorker.register("sw.js"); await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(DATA.push_key)});
  await sendMail("sub",sub.toJSON());
  LS.set("rd_push","1"); LS.set("rd_sub",sub.endpoint);
}
// every time the app opens: make sure this device's current subscription is the one the server has
// (Android can renew it silently; an old one keeps being "accepted" but never reaches the phone)
async function keepSubscription(){
  try{
    if(!LS.get("rd_push")||!("serviceWorker" in navigator)||!("PushManager" in window)||Notification.permission!=="granted"||!DATA.push_key) return;
    const reg=await navigator.serviceWorker.register("sw.js"); await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(DATA.push_key)});
    if(LS.get("rd_sub")!==sub.endpoint){ await sendMail("sub",sub.toJSON()); LS.set("rd_sub",sub.endpoint); }
  }catch(e){}
}
const pushState=()=>!("Notification" in window)?"unsupported":Notification.permission==="denied"?"blocked":LS.get("rd_push")&&Notification.permission==="granted"?"on":"off";

