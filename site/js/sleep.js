"use strict";
/* ------------------------------------------------------------ sleep & strain */
const SLEEP_C="#a78bfa",STRAIN_C="#22d3ee";
function miniRing(v,col){
  const r=21,C=2*Math.PI*r,L=C*clip(v??0,0,100)/100;
  return `<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="${r}" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="5"/>
    ${v?`<circle cx="26" cy="26" r="${r}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${L.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 26 26)"/>`:""}
    <text class="mn" x="26" y="32.5" text-anchor="middle">${v??"–"}</text></svg>`;
}
function duo(raw,isToday){
  const sl=raw.sleep_score,sk=raw.strain,i=DATA.days.indexOf(raw),y=i>0?DATA.days[i-1].strain:null;
  const skSub=sk&&sk.trimp!=null?(sk.load?`Workouts ${sk.load}`:"Daily activity"):sk&&sk.score?`Load ${sk.load}`:(isToday&&y&&y.score?`Yesterday ${y.score}`:"No training");
  return `<div class="duo">
    <button class="mini" id="m-sleep">${miniRing(sl?sl.score:null,SLEEP_C)}<span class="mt"><small>SLEEP</small><b>${sl?esc(sl.band):"–"}</b><span>${sl?hmh(sl.hours):"No data"}</span></span></button>
    <button class="mini" id="m-strain">${miniRing(sk?sk.score:null,STRAIN_C)}<span class="mt"><small>STRAIN</small><b>${sk?esc(sk.band):"–"}</b><span>${esc(skSub)}</span></span></button></div>`;
}
let barPick=null;
function bars30(key,col){
  const days=DATA.days.slice(Math.max(0,sel-29),sel+1),W=320,H=110,bw=W/days.length;
  const pick=barPick==null||barPick>=days.length?days.length-1:barPick,pd=days[pick],pv=pd[key];
  const bars=days.map((d,i)=>{const v=d[key]?.score,h=v?Math.max(3,v/100*H):2;
    return `<rect x="${(i*bw+1.2).toFixed(1)}" y="${(H-h).toFixed(1)}" width="${(bw-2.4).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${v?col:"var(--line)"}" opacity="${i===pick?1:.38}"/>
      <rect data-bi="${i}" x="${(i*bw).toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${H}" fill="transparent" style="cursor:pointer"/>`;}).join("");
  const det=!pv?"No data":key==="sleep_score"?`${hmh(pv.hours)} of sleep`:pv.load?`Load ${pv.load}`:"No training";
  return `<div class="readout"><span>${fmtDay(pd.date,{weekday:"short",day:"numeric",month:"short"})}</span><b>${pv?pv.score:"–"}</b><em style="color:${col}">${pv?esc(pv.band):""}</em><span style="margin-left:auto">${esc(det)}</span></div>
    <div class="sh-chart bars30"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars}</svg>
    <div class="ax"><span>${fmtDay(days[0].date,{day:"numeric",month:"short"})}</span><span>${fmtDay(days[days.length-1].date,{day:"numeric",month:"short"})}</span></div></div>`;
}
function bindBars(reopen){
  document.querySelectorAll("#sheet rect[data-bi]").forEach(r=>r.onclick=()=>{barPick=+r.dataset.bi;const y=$("sheet").scrollTop;reopen(true);$("sheet").scrollTop=y;});
}
const clock=ms=>{const d=new Date(ms);return `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;};
function stagesBar(s){
  const t=s.deep+s.rem+s.light+(s.awake_min||0)/60; if(!t||!(s.deep+s.rem+s.light)) return "";
  const seg=[["Deep",s.deep,"#6d5dfc"],["REM",s.rem,"#a78bfa"],["Light",s.light,"#c4b5fd"],["Awake",(s.awake_min||0)/60,"#f0a5b4"]];
  return `<div class="stg">${seg.map(([n,v,c])=>`<i style="flex:${v};background:${c}"></i>`).join("")}</div>
    <div class="stg-k">${seg.map(([n,v,c])=>`<span><i style="background:${c}"></i>${n} <b>${n==="Awake"?Math.round(v*60)+" min":hmh(v)}</b></span>`).join("")}</div>`;
}
const PART_NAMES={duration:"Duration vs your need",efficiency:"Efficiency",restorative:"Deep + REM",continuity:"Few awakenings",regularity:"Regular timing"};
function openSleepScore(keep){
  if(!keep) barPick=null;
  const s=DATA.days[sel].sleep_score; if(!s) return;
  const parts=s.parts||{};
  openSheet(`<div class="sh-top"><h2>Sleep</h2>${X}</div>
    <div class="sh-big" style="color:${SLEEP_C}">${s.score}<small>${esc(s.band)}</small></div>
    ${s.start?`<p class="sh-desc">${clock(s.start)} → ${clock(s.end)} · ${hmh(s.hours)} asleep${s.eff?` · ${Math.round(s.eff*100)}% efficiency`:""}</p>`:""}
    ${s.deep!=null?stagesBar(s):""}
    <button class="coach-btn" id="to-coach"><span class="tn-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/><path d="M15 4h4l-4 4h4"/></svg></span>
      <span><b>Sleep coach</b><span>Night stages, sleep debt and regularity</span></span><span class="go"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg></span></button>
    ${Object.keys(parts).length?`<h3 class="sh-h3">What makes up the score</h3>${Object.entries(parts).map(([k,v])=>`<div class="bd"><div class="bd-t"><span>${PART_NAMES[k]||k}</span><b>${v}</b></div>
      <div class="bd-bar"><span style="width:${v}%;background:${SLEEP_C}"></span></div></div>`).join("")}`:""}
    <div class="kv" style="margin-top:14px"><span>Your need</span><b>${hmh(s.need)}</b>
      <span>Debt over 3 nights</span><b>${s.debt>=.1?hmh(s.debt):"None"}</b>
      ${s.midpoint_dev!=null?`<span>Timing vs your last week</span><b>${s.midpoint_dev<=15?"On time":s.midpoint_dev+" min off"}</b>`:""}</div>
    <p class="sh-note">Our own score from the raw night: duration against your need (learned from your last 30 nights) 40%, regular timing 20%, efficiency 15%, deep + REM against your own normal 15%, awakenings 10%, minus up to 15 points of short-term debt.</p>
    <div class="sec-h"><h2>Last 30 days</h2><span>Tap a day</span></div>${bars30("sleep_score",SLEEP_C)}`);
  bindBars(openSleepScore);
  $("to-coach").onclick=()=>openSleepCoach();
}
function openStrain(keep){
  if(!keep) barPick=null;
  const raw=DATA.days[sel],s=raw.strain; if(!s) return;
  const own=s.trimp!=null;
  openSheet(`<div class="sh-top"><h2>Strain</h2>${X}</div>
    <div class="sh-big" style="color:${STRAIN_C}">${s.score}<small>${esc(s.band)}</small></div>
    <p class="sh-desc">${own?"How hard the whole day was on your heart, workouts and everything else, compared with your usual day.":"How hard the day was compared with your usual day of training."} The scale gets harder to climb as it goes up: a usual day lands near 50.</p>
    <div class="kv">${own?`<span>Cardio load today (TRIMP)</span><b>${s.trimp}</b><span>Your usual day</span><b>${s.usual}</b>`:""}
      <span>Training load of workouts</span><b>${s.load||0}</b></div>
    <div class="kv"><span>Light</span><b>0–29</b><span>Moderate</span><b>30–59</b><span>High</span><b>60–79</b><span>Max</span><b>80–100</b></div>
    ${own?`<p class="sh-note">Our own score from the all-day heart rate: every minute above 30% of your heart-rate reserve counts, more the harder it is (Banister TRIMP), against your average of the last six weeks.</p>`:""}
    <div class="sec-h"><h2>Last 30 days</h2><span>Tap a day</span></div>${bars30("strain",STRAIN_C)}`);
  bindBars(openStrain);
}

