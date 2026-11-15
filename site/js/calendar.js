"use strict";
/* ------------------------------------------------------------ training: calendar of every session, and best efforts */
// Calendar: one month at a time (Monday first), each day with a bar per sport and its load, planned sessions outlined,
// a weekly total on the right. Tapping a day shows its sessions under the grid; tapping a week total shows the week.
// The sessions come from DATA.calendar (every activity since 1 January of last year), plans from DATA.upcoming.
let calMonth=null,calSel=null;          // calSel: "2026-11-14" (a day) or "w:2026-11-09" (a week from that Monday)
const calActs=()=>DATA.calendar||[];
function calByDay(){const m={};for(const a of calActs()) (m[a.d]=m[a.d]||[]).push(a);return m;}
function calPlans(d){if(d<todayISO()) return [];const dd=(DATA.days||[]).find(x=>x.date===d);
  const done=new Set(((dd&&dd.workouts)||[]).map(w=>w.event).filter(Boolean));
  return ((DATA.upcoming||{})[d]||(dd&&dd.plan)||[]).filter(p=>!p.done&&!done.has(p.id));}
const calMin=a=>a.reduce((s,x)=>s+(x.m||0),0);

function calendarPage(){
  const t=todayISO(),acts=calActs();
  if(!acts.length) return `<section class="sec"><div class="card"><p class="muted-s">No sessions yet.</p></div></section>`;
  const first=acts[0].d.slice(0,7)+"-01";
  if(!calMonth) calMonth=t.slice(0,7)+"-01";
  const m0=new Date(calMonth+"T12:00"),y=m0.getFullYear(),mo=m0.getMonth();
  const last=isoD(new Date(y,mo+1,0,12)),by=calByDay();
  const inMonth=acts.filter(a=>a.d>=calMonth&&a.d<=last);
  const km=inMonth.reduce((s,a)=>s+(a.km||0),0),load=inMonth.reduce((s,a)=>s+(a.load||0),0);
  // grid from the Monday on or before the 1st to the Sunday on or after the last day
  let d=mondayOf(calMonth);const end=isoAdd(mondayOf(last),6),rows=[];
  while(d<=end){const wk=[];for(let i=0;i<7;i++){wk.push(d);d=isoAdd(d,1);}rows.push(wk);}
  const maxMin=Math.max(90,...rows.flat().map(x=>calMin(by[x]||[])));
  const cell=x=>{const a=by[x]||[],pl=calPlans(x),out=x.slice(0,7)!==calMonth.slice(0,7),ld=a.reduce((s,y)=>s+(y.load||0),0);
    const sp={};for(const y of a) sp[y.s]=(sp[y.s]||0)+(y.m||0);
    const bars=Object.entries(sp).map(([k,v])=>`<u style="flex:${v};background:${sportCol(k)}"></u>`).join("");
    const h=Math.max(10,Math.min(100,calMin(a)/maxMin*100));
    return `<button class="cal-d${out?" out":""}${x===t?" today":""}${calSel===x?" sel":""}${a.length?" has":""}" data-cd="${x}" aria-label="${fmtDay(x,{weekday:"long",day:"numeric",month:"long"})}">
      <span class="cal-n">${+x.slice(8)}</span>
      ${a.length?`<span class="cal-b" style="height:${h}%">${bars}</span>`:pl.length?`<span class="cal-p"></span>`:""}
      <em>${a.length?(ld?Math.round(ld):dur(calMin(a))):pl.length?"plan":"&nbsp;"}</em></button>`;};
  const grid=rows.map(wk=>{const a=wk.flatMap(x=>by[x]||[]),mins=calMin(a),k=`w:${wk[0]}`;
    return wk.map(cell).join("")+`<button class="cal-w${calSel===k?" sel":""}" data-cw="${wk[0]}" aria-label="Week of ${fmtDay(wk[0],{day:"numeric",month:"long"})}"><b>${mins?hm2(mins):"–"}</b><small>${a.length?Math.round(a.reduce((s,y)=>s+(y.load||0),0)):""}</small></button>`;}).join("");
  const prevOk=calMonth>first.slice(0,7)+"-01",nextOk=calMonth<t.slice(0,7)+"-01";
  return `<section class="sec" id="calsec">
    <div class="cal-h"><button class="chev" id="cal-p" aria-label="Previous month"${prevOk?"":" disabled"}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg></button>
      <b>${m0.toLocaleDateString("en-GB",{month:"long",year:"numeric"})}</b>
      <button class="chev" id="cal-n" aria-label="Next month"${nextOk?"":" disabled"}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></button></div>
    <div class="card cal">
      <div class="cal-sum"><div><span>Time</span><b>${hm2(calMin(inMonth))}</b></div><div><span>Distance</span><b>${kmTxt(km)}<small> km</small></b></div><div><span>Load</span><b>${Math.round(load)}</b></div><div><span>Sessions</span><b>${inMonth.length}</b></div></div>
      <div class="cal-g"><small>M</small><small>T</small><small>W</small><small>T</small><small>F</small><small>S</small><small>S</small><small>Week</small>${grid}</div>
      <p class="cal-k">Bars: time by sport · numbers: load (TSS) · outlined dot: planned</p>
    </div>
    <div id="cal-list">${calList()}</div></section>`;
}
function calList(){
  if(!calSel) return `<p class="cal-hint">Tap a day or a week total to see the sessions.</p>`;
  const by=calByDay(),wk=calSel.startsWith("w:"),days=wk?[0,1,2,3,4,5,6].map(i=>isoAdd(calSel.slice(2),i)):[calSel];
  const blocks=days.map(d=>{const a=by[d]||[],pl=calPlans(d);if(!a.length&&!pl.length&&wk) return "";
    const head=`<div class="cal-dh">${fmtDay(d,{weekday:"long",day:"numeric",month:"long"})}</div>`;
    if(!a.length&&!pl.length) return head+`<div class="wcard rest"><div class="w-name">Rest day</div><div class="w-meta">Nothing recorded.</div></div>`;
    return head+a.map(calCard).join("")+pl.map(p=>planCard(p)).join("");}).join("");
  const all=days.flatMap(d=>by[d]||[]);
  const title=wk?`Week of ${fmtDay(calSel.slice(2),{day:"numeric",month:"long"})}`:"";
  return (wk?`<div class="sec-h" style="margin-top:4px"><h2>${title}</h2><span>${all.length} session${all.length===1?"":"s"} · ${hm2(calMin(all))}</span></div>`:"")+(blocks||`<div class="wcard rest"><div class="w-name">Rest week</div></div>`);
}
function calCard(a){
  const meta=[a.t,dur(a.m),a.km?`${a.km} km`:"",a.el?`${a.el} m`:""].filter(Boolean).join(" · ");
  const cells=[["Load",a.load,"TSS"],["Avg power",a.w,"W"],["Normalized",a.np,"W"],["Avg HR",a.hr?Math.round(a.hr):null,"bpm"],["Work",a.kj!=null?fmtK(a.kj):null,"kJ"]].filter(c=>c[1]!=null).slice(0,3);
  return `<button class="wcard cal-c" data-ca="${esc(String(a.id))}"><i style="background:${sportCol(a.s)}"></i>
    <div class="w-top"><span class="tag done">${check}${esc(KM_NAME[a.s]||a.s)}${a.in?" · indoor":""}</span><span class="go">${chevR}</span></div>
    <div class="w-name">${esc(a.n||a.s)}</div><div class="w-meta">${meta}</div>
    ${cells.length?`<div class="mgrid">${cells.map(c=>`<div><span>${c[0]}</span><b>${c[1]}<small>${c[2]}</small></b></div>`).join("")}</div>`:""}
    ${a.feel||a.rpe?`<div class="w-foot">${a.feel?`<span class="feel">${faceSVG(a.feel)}<span>Feel: <b>${FEEL[a.feel]||a.feel}</b></span></span>`:"<span></span>"}${a.rpe?`<span>RPE: <b>${a.rpe}/10</b></span>`:""}</div>`:""}
  </button>`;
}
function openCalAct(id){
  // recent sessions have the full detail (profile, fuel): open that; older ones get the summary and the link
  if((DATA.days||[]).some(x=>(x.workouts||[]).some(w=>String(w.id)===id))) return openDone(id);
  const a=calActs().find(x=>String(x.id)===id);if(!a) return;
  const cells=[["Load",a.load,"TSS"],["Avg power",a.w,"W"],["Normalized",a.np,"W"],["Work",a.kj!=null?fmtK(a.kj):null,"kJ"],["Avg HR",a.hr?Math.round(a.hr):null,"bpm"],
    ["Distance",a.km,"km"],["Climbing",a.el,"m"],["Time",dur(a.m),""]].filter(c=>c[1]!=null);
  openSheet(`<div class="sh-top"><h2>${esc(a.n||a.s)}</h2>${X}</div>
    <p class="sh-desc">${fmtDay(a.d,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}${a.t?` · ${a.t}`:""} · ${esc(KM_NAME[a.s]||a.s)}${a.in?" · indoor":""}</p>
    <div class="srcbar"><span class="src">Intervals.icu</span><span>Completed session</span></div>
    <div class="mgrid sh">${cells.map(c=>`<div><span>${c[0]}</span><b>${c[1]}<small>${c[2]}</small></b></div>`).join("")}</div>
    ${a.feel||a.rpe?`<div class="w-foot">${a.feel?`<span class="feel">${faceSVG(a.feel)}<span>Feel: <b>${FEEL[a.feel]||a.feel}</b></span></span>`:"<span></span>"}${a.rpe?`<span>RPE: <b>${a.rpe}/10</b></span>`:""}</div>`:""}
    <a class="pl-q" href="${INTERVALS}/activities/${encodeURIComponent(a.id)}" target="_blank" rel="noopener">Open in Intervals ${arrow}</a>`);
}
function redrawCal(){$("calsec").outerHTML=calendarPage();bindCalendar();}
function bindCalList(){
  document.querySelectorAll("#cal-list [data-ca]").forEach(b=>b.onclick=()=>{buzz(5);openCalAct(b.dataset.ca);});
  document.querySelectorAll("#cal-list [data-pd]").forEach(b=>b.onclick=()=>{buzz(5);openPlanned(b.dataset.pd);});
}
function bindCalendar(){
  if(!$("calsec")) return;
  const mv=k=>{const m=new Date(calMonth+"T12:00");calMonth=isoD(new Date(m.getFullYear(),m.getMonth()+k,1,12));calSel=null;buzz(4);redrawCal();};
  const p=$("cal-p"),n=$("cal-n");if(p) p.onclick=()=>mv(-1);if(n) n.onclick=()=>mv(1);
  const pick=k=>{calSel=calSel===k?null:k;buzz(4);
    document.querySelectorAll("#calsec .sel").forEach(e=>e.classList.remove("sel"));
    if(calSel) document.querySelectorAll(calSel.startsWith("w:")?`[data-cw="${calSel.slice(2)}"]`:`[data-cd="${calSel}"]`).forEach(e=>e.classList.add("sel"));
    $("cal-list").innerHTML=calList();bindCalList();
    if(calSel) $("cal-list").scrollIntoView({block:"nearest",behavior:"smooth"});};
  document.querySelectorAll("#calsec [data-cd]").forEach(b=>b.onclick=()=>pick(b.dataset.cd));
  document.querySelectorAll("#calsec [data-cw]").forEach(b=>b.onclick=()=>pick("w:"+b.dataset.cw));
  // swipe sideways on the grid to change month
  const g=document.querySelector("#calsec .cal-g");let x0=null,y0=0;
  if(g){g.addEventListener("touchstart",e=>{x0=e.touches[0].clientX;y0=e.touches[0].clientY;},{passive:true});
    g.addEventListener("touchend",e=>{if(x0==null) return;const dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;x0=null;
      if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5){const b=$(dx<0?"cal-n":"cal-p");if(b&&!b.disabled) mv(dx<0?1:-1);}},{passive:true});}
  bindCalList();
}

/* ------------------------------------------------------------ best efforts (Fitness page) */
// Pick a duration: this season, last season and all time from Intervals (each with its ride), the best of each of the
// last 12 months, and this season's top rides for that duration.
const BEST_NAME={5:"5 s",15:"15 s",30:"30 s",60:"1 min",120:"2 min",300:"5 min",600:"10 min",1200:"20 min",1800:"30 min",3600:"1 h",7200:"2 h"};
let bestDur=(()=>+LS.get("rd_bestd")||300)();
function bestSection(){
  const B=DATA.power&&DATA.power.best;if(!B) return "";
  const durs=B.durs.filter(d=>Object.values(B.curves||{}).some(c=>c.pts[d])||(B.top||{})[d]);if(!durs.length) return "";
  if(!durs.includes(bestDur)) bestDur=durs.includes(300)?300:durs[0];
  const k=String(bestDur),kg=weightNow(),C=B.curves||{};
  const wkg=v=>kg?`${r1(v/kg)} W/kg`:"";
  const link=(id,inner,cls)=>id?`<a class="${cls}" href="${INTERVALS}/activities/${encodeURIComponent(id)}" target="_blank" rel="noopener">${inner}</a>`:`<div class="${cls}">${inner}</div>`;
  const tile=(cid,name)=>{const p=(C[cid]||{}).pts&&C[cid].pts[k];if(!p) return "";const [w,id,d,n]=p;
    return link(id,`<small>${name}</small><b>${w}<u>W</u></b><span>${wkg(w)}</span><em>${d?fmtDay(d,{day:"numeric",month:"short",year:"numeric"}):""}${n?` · ${esc(n)}`:""}</em>`,"be-t"+(cid==="all"?" all":""));};
  const tiles=tile("s0","THIS SEASON")+tile("s1","LAST SEASON")+tile("all","ALL TIME");
  const s0=(C.s0||{}).pts&&C.s0.pts[k],al=(C.all||{}).pts&&C.all.pts[k];
  const gap=s0&&al&&al[0]>s0[0]?`${s0[0]===al[0]?"":`This season is ${al[0]-s0[0]} W (${Math.round((1-s0[0]/al[0])*100)}%) below your all-time best.`}`:s0&&al?"This season's best is your all-time best.":"";
  // month by month
  const M=(B.monthly||{})[k]||[],mx=Math.max(1,...M.filter(Boolean)),mn=Math.min(...M.filter(Boolean))*.85,top=M.indexOf(Math.max(...M.filter(Boolean)));
  const bars=M.length?`<div class="be-m">${M.map((v,i)=>`<div class="be-mb${i===top?" top":""}"><span>${v||""}</span><i style="height:${v?Math.max(6,(v-mn)/(mx-mn)*100):0}%"></i><em>${new Date(B.months[i]+"-15").toLocaleDateString("en-GB",{month:"narrow"})}</em></div>`).join("")}</div>`:"";
  const T=(B.top||{})[k]||[];
  const list=T.length?`<div class="be-l">${T.map(([w,d,id,n],i)=>link(id,`<span class="be-r">${i+1}</span><span class="be-nm"><b>${esc(n||"Ride")}</b><small>${fmtDay(d,{day:"numeric",month:"short"})}</small></span><span class="be-w"><b>${w} W</b><small>${wkg(w)}</small></span>`,"be-i")).join("")}</div>`:"";
  return `<section class="sec" id="bestsec"><div class="sec-h"><h2>Best efforts</h2><span>Rides with power</span></div>
    <div class="card be">
      <div class="be-chips">${durs.map(d=>`<button data-bd="${d}" class="${d===bestDur?"on":""}">${BEST_NAME[d]||pwDur(d)}</button>`).join("")}</div>
      <div class="be-ts">${tiles}</div>
      ${gap?`<p class="be-g">${gap}</p>`:""}
      ${bars?`<div class="be-h"><small>BEST ${esc((BEST_NAME[bestDur]||"").toUpperCase())} · MONTH BY MONTH</small></div>${bars}`:""}
      ${list?`<div class="be-h"><small>TOP RIDES THIS SEASON${B.season?` · SINCE ${fmtDay(B.season,{day:"numeric",month:"short"}).toUpperCase()}`:""}</small></div>${list}`:""}
      <p class="pw-n">Season, last season and all time as Intervals counts them (its season dates). Tap a ride to open it in Intervals.</p>
    </div></section>`;
}
function bindBest(){
  document.querySelectorAll("#bestsec [data-bd]").forEach(b=>b.onclick=()=>{bestDur=+b.dataset.bd;LS.set("rd_bestd",String(bestDur));buzz(4);
    const s=$("bestsec").getBoundingClientRect().top;$("bestsec").outerHTML=bestSection();bindBest();
    const c=document.querySelector("#bestsec .be-chips .on");if(c) c.scrollIntoView({inline:"center",block:"nearest"});scrollBy(0,$("bestsec").getBoundingClientRect().top-s);});
}
