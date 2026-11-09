"use strict";
/* ------------------------------------------------------------ check-in */
function checkin(raw){
  const scale=key=>{const q=Q[key],v=draft[key];
    return `<div class="qq"><h3>${q.title}</h3><div class="seg">${q.opts.map((o,i)=>
      `<button data-k="${key}" data-v="${i+1}" class="${v===i+1?"on":""}" aria-label="${i+1}: ${o[0]}">${i+1}</button>`).join("")}</div>
      <div class="anchor">${v?`<b>${q.opts[v-1][0]}</b>: ${q.opts[v-1][1]}`:esc(q.hint)}</div></div>`;};
  const saved=raw.answers&&sameAns(raw.answers,draft);
  const tok=true;
  return `<section class="sec"><div class="sec-h"><h2>Morning check-in</h2><span>Optional</span></div>
  <div class="checkin"><p class="lead">Answer within 30 minutes of waking, before coffee. It nudges the score by up to 15 points.</p>
    ${scale("sleep")}${scale("feel")}
    <div class="qq"><h3>Any signs of illness?</h3><div class="seg two">
      <button data-k="sick" data-v="0" class="${draft.sick===false?"on":""}">No</button>
      <button data-k="sick" data-v="1" class="${draft.sick===true?"on":""}">Yes</button></div>
      <div class="anchor">${draft.sick?"<b>Yes</b>: the score is capped at 49 until you feel well again.":"Sore throat, congestion, fever, unusual aches."}</div></div>
    <div class="savebar"><span class="st" id="qst">${saved?(tok?"Saved.":"Saved on this phone only."):""}</span>
      <button class="btn" id="qsave" ${saved||!Object.keys(draft).length?"disabled":""}>${raw.answers?"Update check-in":"Save check-in"}</button></div>
  </div></section>`;
}

/* ------------------------------------------------------------ trend */
function trend(){
  const days=DATA.days.slice(-30),W=300,H=104,bw=W/days.length;
  const y70=H-.7*H;
  const bars=days.map(d=>{const i=DATA.days.indexOf(d),s=d.score,h=s?Math.max(3,s/100*H):2,x=(days.indexOf(d))*bw;
    return `<rect data-i="${i}" x="${(x+1.2).toFixed(1)}" y="${(H-h).toFixed(1)}" width="${(bw-2.4).toFixed(1)}" height="${h.toFixed(1)}" rx="2"
      fill="${s?bandOf(s)[2]:"var(--line)"}" opacity="${i===sel?1:.42}" style="cursor:pointer"/>`;}).join("");
  const si=days.findIndex(d=>DATA.days.indexOf(d)===sel);
  return `<section class="sec"><div class="sec-h"><h2>Last 30 days</h2><span>Tap a day</span></div><div class="trend">
    <svg viewBox="0 0 ${W} ${H+8}" preserveAspectRatio="none">
      <line x1="0" x2="${W}" y1="${y70}" y2="${y70}" stroke="var(--muted)" stroke-dasharray="2 4" opacity=".5"/>${bars}
      ${si>=0?`<rect x="${(si*bw+1.2).toFixed(1)}" y="${H+4}" width="${(bw-2.4).toFixed(1)}" height="3" rx="1.5" fill="var(--text)"/>`:""}
    </svg><div class="ax"><span>${fmtDay(days[0].date,{day:"numeric",month:"short"})}</span><span>Dashed line: a typical day for you</span><span>${fmtDay(days[days.length-1].date,{day:"numeric",month:"short"})}</span></div></div></section>`;
}

/* ------------------------------------------------------------ main render */
function deltaTxt(day){
  const i=DATA.days.indexOf(DATA.days.find(d=>d.date===day.date)),prev=DATA.days.slice(0,i).reverse().find(d=>d.score!=null);
  const parts=[];
  if(day.mod) parts.push(`check-in ${day.mod>0?"+":""}${day.mod}`);
  if(prev){const d=day.score-prev.score; parts.push(d===0?"same as yesterday":`${d>0?"+":""}${d} vs yesterday`);}
  return parts.join(", ");
}
// opens Garmin Connect (the only app that can pull the night off the watch); back in Readiness the score follows
const GC_INTENT="intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.garmin.android.apps.connectmobile;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.garmin.android.apps.connectmobile;end";
let syncAt=0;
function pendingNote(){
  const prev=DATA.days.slice(0,sel).reverse().find(d=>d.score!=null);
  const android=/Android/i.test(navigator.userAgent);
  return `<div class="pending"><p>Last night's sleep hasn't left your watch yet${prev?`; yesterday you were at <b>${prev.score}</b>`:""}.</p>
    ${android?`<a class="btn" id="sync" href="${GC_INTENT}">Get today's score</a>
    <p class="st" id="upd-note">Garmin Connect opens for a moment to collect the night: come back here and the score appears by itself.</p>`
    :`<button class="btn quiet" id="upd">Update now</button><p class="st" id="upd-note"></p>`}</div>`;
}
let TAB=(()=>new URLSearchParams(location.search).get("tab")||"today")();   // every launch opens on Today…
if(NAV0){TAB=NAV0.t||TAB;ATH_SUB=NAV0.s||"profile";if(NAV0.p) PG={...PG,...NAV0.p};if(NAV0.f) foodSel=NAV0.f;}  // …but a refresh stays on the page you were on
const GEAR=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>`;
function setTab(t){ if(t===TAB) {scrollTo({top:0,behavior:"smooth"});return;} TAB=t; if(t==="athlete"){ATH_SUB="profile";PG.athlete="profile";foodSel=todayISO();} buzz(5); render(); scrollTo(0,0); animIn("enter"); }
function animIn(c){const a=$("app");a.classList.remove("enter","swl","swr");void a.offsetWidth;a.classList.add(c);}
// Each tab is split into a few short pages, picked from a row of pills that stays at the top while you scroll
const PAGES={today:[["overview","Overview"],["signals","Signals"],["day","Your day"],["checkin","Check-in"]],
  training:[["week","Week"],["month","Month"],["volume","Hours"],["fitness","Fitness"]],
  athlete:[["profile","Profile"],["diary","Diary"],["plan","Plan"],["balance","Balance"],["nutrients","Nutrients"]]};
function pageBar(tab){
  const list=PAGES[tab].filter(p=>tab!=="athlete"||p[0]==="profile"||foodOn());
  if(list.length<2) return "";
  return `<nav class="pbar" role="tablist">${list.map(([k,n])=>`<button role="tab" data-pg="${k}" class="${PG[tab]===k?"on":""}" aria-selected="${PG[tab]===k}">${n}</button>`).join("")}</nav>`;
}
function setPage(tab,k){
  if(PG[tab]===k) return scrollTo({top:0,behavior:"smooth"});
  PG[tab]=k; if(tab==="athlete"){ATH_SUB=k==="profile"?"profile":"food";if(k!=="profile"&&!foodSel) foodSel=todayISO();}
  buzz(5); render(); scrollTo(0,0); animIn("enter");
}
document.addEventListener("click",e=>{const b=e.target.closest(".pbar [data-pg]");if(b) setPage(TAB,b.dataset.pg);});
function tabbar(){
  const ic={today:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4.5 16.5a8 8 0 1 1 15 0"/><path d="M12 13.5l3.6-3.6"/></svg>`,
    training:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M5 19V11M10 19V6M15 19v-5M20 19V9"/></svg>`,
    food:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.2 1.2-3.5 3.8-3.5 7v3H17"/></svg>`,
    athlete:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c.8-4 3.6-6 7-6s6.2 2 7 6"/></svg>`};
  let bar=$("tabbar");
  if(!bar){bar=document.createElement("nav");bar.id="tabbar";bar.className="tabbar";document.body.appendChild(bar);}
  bar.innerHTML=["today","training","athlete"].map(t=>`<button data-tab="${t}" class="${TAB===t?"on":""}" aria-current="${TAB===t?"page":"false"}">${ic[t]}<span>${t[0].toUpperCase()+t.slice(1)}</span></button>`).join("");
  bar.querySelectorAll("button").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
}
function render(){
  tabbar(); setTimeout(saveNav,0);
  if(TAB==="training") return renderTraining();
  if(TAB==="athlete") return renderAthlete();
  renderToday();
}
function renderToday(){
  const raw=DATA.days[sel],isToday=raw.date===todayISO();
  const day=isToday?applyAnswers(raw,Object.keys(draft).length?draft:raw.answers):raw;
  const has=day.score!=null,[,band,color]=has?bandOf(day.score):[0,"Waiting for data","var(--faint)"];
  const latest=DATA.days[DATA.days.length-1],todayPending=latest.date!==todayISO()||latest.score==null;
  const c=day.comp||{};
  const label=isToday?"Today":fmtDay(raw.date,{weekday:"short",day:"numeric",month:"short"});
  const chev=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

  $("app").innerHTML=`
  <div class="top">
    <div class="daypick">
      <button class="chev" id="prev" aria-label="Previous day" ${sel<=0?"disabled":""}>${chev("M15 18l-6-6 6-6")}</button>
      <span class="d">${esc(label)}</span>
      <button class="chev" id="next" aria-label="Next day" ${sel>=DATA.days.length-1?"disabled":""}>${chev("M9 18l6-6-6-6")}</button>
    </div>
    <span class="tb">${ASK}<button class="gear" id="gear" aria-label="Settings">${GEAR}</button></span>
  </div>
  ${pageBar("today")}
  ${PG.today==="overview"?`
  <div class="g-wrap"><button class="gauge" id="gauge" aria-label="Score details">${gaugeSVG(has?day.score:null,band,color)}</button>${legendHTML(has?band:"")}</div>
  <p class="adj">${has?esc(deltaTxt(day)):""}</p>
  ${has?`<button class="verdict-b" id="guide"><span class="verdict">${esc(day.advice)}</span><span class="why">${esc(day.why)}</span><span class="more">What this means for today</span></button>`:""}
  ${isToday&&!has?pendingNote():""}
  ${isToday?keyNotice():""}
  ${has&&day.alarm?alertCard(day):""}
  ${duo(raw,isToday)}
  ${isToday?feelNudge():""}
  ${sessions(raw)}
  ${has?`<button class="off" id="off">Score doesn't feel right?</button>`:""}`:""}
  ${PG.today==="signals"?`
  <section class="sec first"><div class="sec-h"><h2>Signals</h2><span>Tap for history</span></div>
    <div class="signals">${SIG_KEYS().map(k=>signalRow(k,c[k])).join("")}</div>
    ${isToday?tonightCard():""}</section>`:""}
  ${PG.today==="day"?`${isToday?yourDay():""}${dayFlowSection(raw)||(isToday?"":`<p class="notice">No hour-by-hour data for this day.</p>`)}`:""}
  ${PG.today==="checkin"?(isToday?checkin(raw)+journalCard():`<p class="notice">The check-in and the journal are for today and yesterday: go back to today to fill them in.</p>`):""}
  <p class="foot">Updated ${esc(new Date(DATA.generated_at).toLocaleString("en-GB",{weekday:"long",hour:"2-digit",minute:"2-digit"}))}<br>Calibrated on ${DATA.calibration.n} days of your data</p>`;

  if(has&&$("gauge")){animateGauge(prevScore,day.score); prevScore=day.score;}
  const u=$("upd"); if(u) u.onclick=()=>requestUpdate(u);
  const sy=$("sync"); if(sy) sy.onclick=()=>{syncAt=Date.now(); LS.del("rd_ping");};
  bind(raw);
}

function bind(raw){
  $("prev").onclick=()=>go(sel-1); $("next").onclick=()=>go(sel+1);
  const on=(id,f)=>{const e=$(id);if(e) e.onclick=f;};
  $("gear").onclick=openSettings; on("gauge",()=>openScore());
  on("guide",()=>openGuide());
  on("m-sleep",()=>openSleepScore()); on("m-strain",()=>openStrain());
  const of=$("off"); if(of) of.onclick=openOff;
  // Calories opens the food diary (when it's on); the other tiles open their history
  document.querySelectorAll(".day4 [data-en]").forEach(b=>b.onclick=()=>{
    if(b.dataset.en==="kcal"&&foodOn()){TAB="athlete";ATH_SUB="food";PG.athlete="diary";foodSel=todayISO();buzz(5);render();scrollTo(0,0);animIn("enter");return;}
    enKey=b.dataset.en;openEnergy();});
  bindJournal(); bindDayFlow(raw);
  const tn=$("tonight"); if(tn) tn.onclick=()=>{ if(DATA.days[sel].sleep_score) openSleepCoach(); else if(DATA.days[sel].comp?.sleep) openSignal("sleep"); };
  document.querySelectorAll(".sig[data-sig]").forEach(b=>b.onclick=()=>openSignal(b.dataset.sig));
  document.querySelectorAll(".trend rect[data-i]").forEach(r=>r.onclick=()=>go(+r.dataset.i));
  document.querySelectorAll(".seg button").forEach(b=>b.onclick=()=>{
    const k=b.dataset.k,v=+b.dataset.v;
    if(k==="sick") draft.sick=draft.sick===!!v?undefined:!!v; else draft[k]=draft[k]===v?undefined:v;
    Object.keys(draft).forEach(x=>draft[x]===undefined&&delete draft[x]);
    const y=scrollY; render(); scrollTo(0,y);
  });
  const s=$("qsave"); if(s) s.onclick=()=>saveAnswers(raw);
}
function go(i){ if(i<0||i>=DATA.days.length) return; const dir=i>sel?"swl":"swr"; sel=i; draft={...(DATA.days[sel].answers||{})}; buzz(5); render(); animIn(dir); }
(()=>{ let x0=null,y0=0;
  const app=$("app");
  app.addEventListener("touchstart",e=>{ const t=e.target; x0=null;
    if($("sheet").classList.contains("open")||t.closest("svg,input,textarea,.range,.seg,.scroll-x,.fi-w")) return;
    x0=e.touches[0].clientX; y0=e.touches[0].clientY; },{passive:true});
  app.addEventListener("touchend",e=>{ if(x0==null) return; const dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0; x0=null;
    if(Math.abs(dx)<70||Math.abs(dy)>Math.abs(dx)*.6) return;
    if(TAB==="today") go(sel+(dx<0?1:-1));
    else if(TAB==="athlete"&&ATH_SUB==="food"&&foodOn()){ const t=todayISO(),n=isoAdd(foodSel,dx<0?1:-1); if(n<=t&&n>=isoAdd(t,-120)){ foodSel=n; buzz(5); renderFood(); animIn(dx<0?"swl":"swr"); } } },{passive:true});
})();

/* ------------------------------------------------------------ sheets */
// the phone's Back gesture closes an open sheet instead of leaving the app
let sheetHist=false,popSkip=false;
function openSheet(html){
  if(camStop) camStop();
  const sh=$("sheet"),was=sh.classList.contains("open");
  sh.innerHTML=`<div class="grab"></div>${html}`; sh.classList.add("open"); $("scrim").classList.add("open");
  if(!was){ sh.scrollTop=0; if(!sheetHist){ history.pushState({sheet:1},""); sheetHist=true; } }
  const x=sh.querySelector(".x"); if(x){x.onclick=()=>closeSheet(); if(!was) x.focus({preventScroll:true});} }
function closeSheet(fromPop){
  if(camStop) camStop();
  const sh=$("sheet"); sh.classList.remove("open","drag"); sh.style.transform=""; $("scrim").classList.remove("open"); $("scrim").style.opacity="";
  if(sheetHist&&!fromPop){ popSkip=true; history.back(); } sheetHist=false; }
addEventListener("popstate",()=>{ if(popSkip){popSkip=false;return;} if($("sheet").classList.contains("open")) closeSheet(true); });
(()=>{ const sh=$("sheet"); let y0=null,dy=0,t0=0;
  sh.addEventListener("touchstart",e=>{ const r=sh.getBoundingClientRect(),ty=e.touches[0].clientY;
    if(sh.scrollTop>0||ty-r.top>64||e.target.closest("input,video")) {y0=null;return;} y0=ty;dy=0;t0=Date.now(); },{passive:true});
  sh.addEventListener("touchmove",e=>{ if(y0==null) return; dy=Math.max(0,e.touches[0].clientY-y0);
    if(dy>4){ sh.classList.add("drag"); sh.style.transform=`translateY(${dy}px)`; $("scrim").style.opacity=String(Math.max(0,1-dy/400)); } },{passive:true});
  sh.addEventListener("touchend",()=>{ if(y0==null) return; const fast=dy>40&&dy/(Date.now()-t0)>.6; y0=null;
    sh.classList.remove("drag"); if(dy>110||fast) closeSheet(); else { sh.style.transform=""; $("scrim").style.opacity=""; } });
})();
$("scrim").onclick=()=>closeSheet(); addEventListener("keydown",e=>{if(e.key==="Escape"&&$("sheet").classList.contains("open"))closeSheet()});
const X=`<button class="x" aria-label="Close"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;

const BETTER={hrv:1,rhr:-1,sleep:1,load:1};
function sigClass(key,v,c){
  if(key==="load") return v< -30?"worse":v> -10?"better":"in";
  if(key==="sleep") return v<c.lo?"worse":"in";
  if(v>=c.lo&&v<=c.hi) return "in";
  return (v>c.hi)===(BETTER[key]>0)?"better":"worse";
}
const CLS_COL={in:"var(--text)",better:"var(--alpine)",worse:"var(--amber)"};
const CLS_TXT={in:"within your normal",better:"better than normal",worse:"worse than normal"};
const fmtVal=(key,v)=>key==="sleep"?hm(v):key==="load"?`${v>0?"+":""}${Math.round(v)}%`:`${Math.round(v)} ${SIG[key].unit}`;
let chartPick=null;
function sigChart(key,n){
  const s=series(key,n),cur=DATA.days[sel].comp[key];
  if(s.filter(p=>p.c).length<2) return "<p class='sh-desc'>Not enough data yet.</p>";
  const W=320,H=170,PL=4,PR=62,PT=12,PB=8;
  const refs=key==="sleep"?[[cur.hi,"usual "+hm(cur.hi),"solid"],[cur.lo,"min "+hm(cur.lo),"dash"]]:key==="load"?[[-10,"−10%","dash"],[-30,"−30%","dash"]]
    :[[cur.hi,fmtNum(cur.hi),"dash"],[cur.base,"avg "+fmtNum(cur.base),"solid"],[cur.lo,fmtNum(cur.lo),"dash"]];
  const vals=s.filter(p=>p.c).map(p=>p.c.value).concat(refs.map(r=>r[0]),key==="hrv"?s.filter(p=>p.c).map(p=>p.c.avg7):[]);
  let lo=Math.min(...vals),hi=Math.max(...vals); const pad=(hi-lo)*.1||1; lo-=pad; hi+=pad;
  const y=v=>PT+(hi-v)/(hi-lo)*(H-PT-PB),x=i=>PL+(i+.5)*((W-PL-PR)/s.length);
  const bandTop=key==="load"?-10:cur.hi,bandBot=key==="load"?-30:cur.lo;
  const pick=chartPick==null||chartPick>=s.length||!s[chartPick].c?s.map(p=>!!p.c).lastIndexOf(true):chartPick;
  const line=s.map((p,i)=>p.c?`${x(i).toFixed(1)},${y(p.c.value).toFixed(1)}`:null).filter(Boolean).join(" ");
  const avg=key==="hrv"?`<polyline points="${s.map((p,i)=>p.c?`${x(i).toFixed(1)},${y(p.c.avg7).toFixed(1)}`:null).filter(Boolean).join(" ")}" fill="none" stroke="var(--glacier)" stroke-width="1.6" stroke-dasharray="1 0" opacity=".55"/>`:"";
  const r=n>7?3.2:4.6;
  const dots=s.map((p,i)=>{if(!p.c) return ""; const k=sigClass(key,p.c.value,cur);
    return `<circle cx="${x(i)}" cy="${y(p.c.value)}" r="${i===pick?r+2:r}" fill="${i===pick?CLS_COL[k]:"var(--surface)"}" stroke="${CLS_COL[k]}" stroke-width="2"/>`;}).join("");
  const hits=s.map((p,i)=>`<rect data-pi="${i}" x="${x(i)-(W-PL-PR)/s.length/2}" y="0" width="${(W-PL-PR)/s.length}" height="${H}" fill="transparent" style="cursor:pointer"/>`).join("");
  const pk=s[pick],pc=sigClass(key,pk.c.value,cur);
  return `<div class="readout"><span>${fmtDay(pk.date,{weekday:"short",day:"numeric",month:"short"})}</span>
      <b>${fmtVal(key,pk.c.value)}</b><em style="color:${CLS_COL[pc]}">${CLS_TXT[pc]}</em></div>
    <div class="sh-chart"><svg viewBox="0 0 ${W} ${H}">
      <rect x="${PL}" y="${y(bandTop)}" width="${W-PL-PR}" height="${Math.max(0,y(bandBot)-y(bandTop))}" fill="var(--alpine)" opacity=".08"/>
      ${refs.map(([v,l,t])=>`<line x1="${PL}" x2="${W-PR+4}" y1="${y(v)}" y2="${y(v)}" stroke="var(--muted)" stroke-width="1" ${t==="dash"?'stroke-dasharray="3 4"':""} opacity=".6"/>
        <text x="${W-PR+8}" y="${y(v)+4}" class="rl">${l}</text>`).join("")}
      <line x1="${x(pick)}" x2="${x(pick)}" y1="${PT}" y2="${H-PB}" stroke="var(--muted)" stroke-width="1" opacity=".5"/>
      ${avg}<polyline points="${line}" fill="none" stroke="var(--text)" stroke-width="1.8" stroke-linejoin="round" opacity=".85"/>
      ${dots}${hits}
    </svg>
    <div class="ax"><span>${fmtDay(s[0].date,{day:"numeric",month:"short"})}</span><span>${fmtDay(s[s.length-1].date,{day:"numeric",month:"short"})}</span></div>
    <div class="legend"><span><i style="border-color:var(--text)"></i>Within normal</span><span><i style="border-color:var(--alpine)"></i>Better</span><span><i style="border-color:var(--amber)"></i>Worse</span>${key==="hrv"?`<span><i class="ln"></i>7-day average</span>`:""}</div>
    <div class="lg">${key==="sleep"?"The solid line is your usual night, the dashed line your minimum, both learned from your last 30 nights.":key==="load"?"Dashed lines mark the productive range, −10% to −30%.":"Dashed lines mark the edges of your normal range, the solid line your average. Tap a point to read it."}</div></div>`;
}
function fmtNum(v){return Number.isInteger(v)?String(v):v.toFixed(1).replace(/\.0$/,"");}
const hmh=h=>{const m=Math.round(h*60);return m<60?`${m} min`:`${Math.floor(m/60)}h${m%60?String(m%60).padStart(2,"0"):""}`;};
function sleepPlan(){
  let i=sel; while(i>=0&&!DATA.days[i].sleep_score?.need&&!DATA.days[i].comp?.sleep?.avg3) i--;
  if(i<0) return null;
  const ss=DATA.days[i].sleep_score,c=DATA.days[i].comp?.sleep||{};
  const usual=ss?.need??c.hi,min=ss?.floor??c.lo;
  const debt=ss?.need?ss.debt:Math.max(0,(usual-c.avg3)*3);
  const extra=Math.min(.75,debt*.5);
  const t=DATA.days[sel],tm=new Date(new Date(t.date+"T12:00").getTime()+864e5).toLocaleDateString("sv-SE");
  const todayLoad=(t.workouts||[]).reduce((a,w)=>a+(w.load||0),0);
  const tomorrowLoad=((DATA.upcoming||{})[tm]||[]).reduce((a,p)=>a+(p.load||0),0);
  const hard=todayLoad>=100||tomorrowLoad>=100?.25:0;
  let rec=Math.max(7,usual+Math.min(.75,extra+hard)); rec=Math.min(9,Math.round(rec*4)/4);
  const why=[];
  if(extra>=.25) why.push(`you're about ${hmh(debt)} short over the last three nights`);
  if(hard) why.push(todayLoad>=100?"today's session was a big one":"tomorrow's session is a big one");
  if(usual<7&&rec===7) why.push("7 hours is the floor for adults who train");
  return {rec,usual,min,why};
}
function sleepAdvice(){
  const p=sleepPlan(); if(!p) return "";
  const parts=[`Your usual night is ${hmh(p.usual)}, so that's the baseline.`];
  if(p.why.length) parts.push(`A little more tonight because ${p.why.join(" and ")}.`);
  else parts.push("You're not carrying a sleep debt, so your usual amount is enough.");
  return `<div class="note-card sl"><b>Tonight: ${hmh(p.rec)} of sleep.</b> ${esc(parts.join(" "))} Try not to go below ${hmh(Math.max(p.min,6.5))}, where your short nights start to cost you.</div>`;
}
function tonightCard(){
  const p=sleepPlan(); if(!p) return "";
  const moon=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>`;
  return `<button class="tonight" id="tonight"><span class="tn-ic">${moon}</span>
    <span class="tn-t"><b>Tonight, aim for ${hmh(p.rec)}</b><span>${p.why.length?esc(p.why[0][0].toUpperCase()+p.why[0].slice(1))+".":"Your usual amount is enough."}</span></span></button>`;
}
function openSignal(key,n=7,keepPick=false){
  if(!keepPick) chartPick=null;
  const m=SIG[key],c=DATA.days[sel].comp[key];
  const stats={
    hrv:[["Last night",`${Math.round(c.value)} ms`],["7-day average",`${c.avg7} ms`],["Your normal",`${Math.round(c.lo)}–${Math.round(c.hi)} ms`],["Weight in score",wPct(key)]],
    rhr:[["Last night",`${Math.round(c.value)} bpm`],["Your average",`${c.base} bpm`],["Your normal",`${c.lo}–${c.hi} bpm`],["Weight in score",wPct(key)]],
    resp:[["Last night",`${c.value} /min`],["Your average",`${c.base} /min`],["Your normal",`${c.lo}–${c.hi} /min`],["Weight in score",wPct(key)]],
    sleep:[["Last night",hm(c.value)],c.score!=null?["Sleep score",String(c.score)]:["3-night average",hm(c.avg3)],["Your need",hm(c.hi)],["Your minimum",hm(c.lo)]],
    load:[["Form",`${c.value>0?"+":""}${c.value}%`],["Fitness / fatigue",`${c.ctl} / ${c.atl}`],["Productive range","−30% to −10%"],["Weight in score",wPct(key)]],
  }[key];
  const keepScroll=$("sheet").scrollTop;
  openSheet(`<div class="sh-top"><h2>${m.name}</h2>${X}</div>
    <div class="sh-big">${m.fmt(c.value)}<small>${key==="sleep"?"h":m.unit}</small></div>
    ${key==="sleep"?sleepAdvice():""}
    <p class="sh-desc">${m.desc}</p>
    <div class="range"><button data-n="7" class="${n===7?"on":""}">7 days</button><button data-n="30" class="${n===30?"on":""}">30 days</button></div>
    ${sigChart(key,n)}
    <div class="stats">${stats.map(s=>`<div><span>${s[0]}</span><b>${s[1]}</b></div>`).join("")}</div>`);
  if(keepPick) $("sheet").scrollTop=keepScroll;
  $("sheet").querySelectorAll(".range button").forEach(b=>b.onclick=()=>openSignal(key,+b.dataset.n));
  $("sheet").querySelectorAll("rect[data-pi]").forEach(r=>r.onclick=()=>{chartPick=+r.dataset.pi; openSignal(key,n,true);});
}
const GUIDE={
  "Super":["Recovery is better than on most of your days.","If there's a test or a hard session on the plan, this is a good day for it.","If the legs agree, aim for the upper part of the target range, or add a little extra."],
  "Normal":["This is a normal day for you: most of your days land here.","Train as planned.","In the hard parts, let the legs decide: if the effort feels heavier than usual, settle at the lower end of the range."],
  "Low":["Recovery is below your usual, but the score can't feel your legs: you can.","Start the session as planned and use the first 15–20 minutes to check in.","Legs feel good: carry on, maybe at the lower end of the targets.","Legs feel heavy: drop the watts a little, or do one repetition less.","Legs feel cooked: turn it into easy endurance and save the quality for another day."],
  "Very low":["Several signals are well below your usual. Sometimes it's fatigue, sometimes a cold on the way, sometimes just a bad night.","If you feel fine, an easy or shortened session is a reasonable choice.","If you also feel off, a rest day or a very easy spin will pay back more than forcing it.","If it stays this low for a few days, look at sleep, stress and how you feel overall."],
};
function openGuide(){
  const raw=DATA.days[sel],isT=raw.date===todayISO(),day=isT?applyAnswers(raw,Object.keys(draft).length?draft:raw.answers):raw;
  const g=GUIDE[bandOf(day.score)[1]]||GUIDE.Normal,col=segColor(day.score);
  openSheet(`<div class="sh-top"><h2>Reading today's score</h2>${X}</div>
    <div class="sh-big" style="color:${col}">${day.score}<small>${esc(day.band)}</small></div>
    <p class="sh-desc">${esc(g[0])}</p>
    <ul class="guide">${g.slice(1).map(t=>`<li>${esc(t)}</li>`).join("")}</ul>
    <div class="note-card"><b>You have the final say.</b> The score measures how your body has recovered overnight; it can't feel your legs or know your day. Use it as context, then decide with how you actually feel on the bike.</div>`);
}
function openSettings(){
  openSheet(`<div class="sh-top"><h2>Settings</h2>${X}</div>
    <div class="field"><label for="s-pw">Passphrase</label><div style="display:flex;gap:8px"><input id="s-pw" type="password" value="${esc(LS.get("rd_pass")||"")}"><button class="btn quiet" id="s-show" type="button">Show</button></div></div>
    <div class="tog"><div><label>Morning notification</label><p>Your score as soon as it's ready, early warnings, and a weekly review on Sunday evening.</p></div>
      <button class="btn ${pushState()==="on"?"quiet":""}" id="s-push">${pushState()==="on"?"Send a test":"Turn on"}</button></div><p class="st" id="s-pst" style="font-size:13px;color:var(--muted);margin:8px 0 0">${pushState()==="blocked"?"Notifications are blocked for Readiness: allow them in Android Settings → Apps → Readiness → Notifications, then come back.":pushState()==="on"?`On${DATA.push_devices?` · ${DATA.push_devices} device${DATA.push_devices>1?"s":""} registered`:""}.`:""}</p>
    <div class="tog"><div><label>Food diary</label><p>Food in Athlete: log meals, daily target and energy balance.</p></div>
      <button class="btn ${foodOn()?"quiet":""}" id="s-food">${foodOn()?"Hide":"Show"}</button></div>
    <div class="field"><label for="s-ai">AI key (Google Gemini, free)</label><div style="display:flex;gap:8px"><input id="s-ai" type="password" autocomplete="off" placeholder="Paste your key" value="${esc(aiKey())}"><button class="btn quiet" id="s-ai-t" type="button">Test</button></div>
      <p>For food photos, speaking and free-text logging. Create it at aistudio.google.com → Get API key. It stays on this phone; on the free tier Google may use what you send to improve its models.</p><p id="s-ai-st"></p></div>
    <button class="btn quiet" id="s-val" style="width:100%;margin-top:18px">Score check</button>
    <div class="savebar" style="margin-top:22px"><button class="btn quiet" id="s-out">Lock app</button><button class="btn" id="s-save">Save settings</button></div>`);
  const keepAI=()=>{const k=$("s-ai").value.trim(); if(k) LS.set("rd_gemini",k); else LS.del("rd_gemini");};
  $("s-save").onclick=()=>{keepAI(); const p=$("s-pw").value.trim(); if(p) LS.set("rd_pass",p); closeSheet(); load();};
  $("s-food").onclick=()=>{const on=foodOn(); if(on) LS.set("rd_food_off","1"); else LS.del("rd_food_off"); if(on){ATH_SUB="profile";PG.athlete="profile";}
    $("s-food").textContent=on?"Show":"Hide"; $("s-food").classList.toggle("quiet",!on); render();};
  $("s-ai-t").onclick=async()=>{keepAI(); const st=$("s-ai-st"); if(!aiKey()){st.textContent="Paste a key first.";return;} st.textContent="Testing…";
    try{const it=await aiItems([{text:"1 banana"}]); st.textContent=it.length?`Works: 1 banana ≈ ${it[0].kcal} kcal.`:"The key works.";}catch(e){st.textContent=e.message;}};
  $("s-out").onclick=()=>{LS.del("rd_pass"); closeSheet(); lock();};
  $("s-show").onclick=()=>{const i=$("s-pw"),h=i.type==="password";i.type=h?"text":"password";$("s-show").textContent=h?"Hide":"Show";};
  $("s-val").onclick=openValidation;
  $("s-push").onclick=async()=>{const st=t=>$("s-pst").textContent=t,b=$("s-push");b.disabled=true;
    try{ await enableNotifications(st); await sendMail("test",{ts:Date.now()}); LS.del("rd_ping"); await pingServer();
      st("Test sent: it should arrive within about a minute. If it doesn't, check Android Settings → Apps → Readiness → Notifications.");
      b.textContent="Send a test"; b.classList.add("quiet"); }
    catch(e){ st("Couldn't turn them on: "+e.message+"."); }
    b.disabled=false;};
}

/* ------------------------------------------------------------ save check-in */
async function saveAnswers(raw){
  const st=$("qst"),btn=$("qsave"); btn.disabled=true;
  LS.set("ans:"+raw.date,JSON.stringify(draft));
  Object.assign(raw,applyAnswers(raw,{...draft}));
  const done=msg=>{const y=scrollY; render(); scrollTo(0,y); $("qst").textContent=msg;};
  st.textContent="Saving…";
  const ok=await sendQ("answers",{date:raw.date,...draft});
  done(ok?"Saved. The score updates within 10 minutes.":"Saved on this phone: it goes out as soon as you're back online.");
}

load();
