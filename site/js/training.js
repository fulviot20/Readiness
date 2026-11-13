"use strict";
/* ------------------------------------------------------------ workouts */
const INTERVALS="https://intervals.icu";
const dur=m=>m>=60?`${Math.floor(m/60)}h${m%60?String(Math.round(m%60)).padStart(2,"0"):""}`:`${Math.round(m)} min`;
const arrow=`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>`;
const check=`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const zoneOf=p=>p<56?1:p<76?2:p<91?3:p<106?4:p<121?5:p<151?6:7;
function profileSVG(prof){
  const w=prof.w,hr=prof.hr,n=(w||hr).length,W=320,H=84,bw=W/n,x=i=>(i*bw+bw/2).toFixed(1);
  const line=(vals,top,band)=>{const v=vals.filter(z=>z!=null),lo=Math.min(...v),hi=Math.max(...v),pad=(hi-lo)*.12||5;
    const y=z=>(top+(hi+pad-z)/(hi-lo+2*pad)*band).toFixed(1);
    return vals.map((z,i)=>z==null?null:[x(i),y(z)]).filter(Boolean);};
  let pw="",hl="";
  if(w&&w.some(v=>v!=null)){const pts=line(w,30,H-34);
    pw=`<defs><linearGradient id="pwfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--pw)" stop-opacity=".35"/><stop offset="1" stop-color="var(--pw)" stop-opacity="0"/></linearGradient></defs>
      <polygon points="${pts[0][0]},${H} ${pts.map(p=>p.join(",")).join(" ")} ${pts[pts.length-1][0]},${H}" fill="url(#pwfill)"/>
      <polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" stroke="var(--pw)" stroke-width="1.8" stroke-linejoin="round"/>`;}
  if(hr&&hr.some(v=>v!=null)){const pts=line(hr,4,40);
    hl=`<polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" stroke="var(--hr)" stroke-width="1.6" stroke-linejoin="round"/>`;}
  return `<svg class="prof" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${pw}${hl}</svg>
    <div class="prof-lg">${pw?`<span><i class="ln" style="border-color:var(--pw)"></i>Power</span>`:""}${hl?`<span><i class="ln"></i>Heart rate</span>`:""}</div>`;
}
const FACE={1:["M8 14.2c1.1 1.8 2.4 2.6 4 2.6s2.9-.8 4-2.6","var(--b5)"],2:["M8.4 14.6c1 1.1 2.2 1.6 3.6 1.6s2.6-.5 3.6-1.6","var(--b4)"],
  3:["M8.6 15.2h6.8","var(--b3)"],4:["M8.4 16.2c1-1.1 2.2-1.6 3.6-1.6s2.6.5 3.6 1.6","var(--amber)"],5:["M8 16.8c1.1-1.8 2.4-2.6 4-2.6s2.9.8 4 2.6","var(--rose)"]};
function faceSVG(f){const [m,c]=FACE[f]||FACE[3];
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9.2"/><circle cx="9" cy="10" r=".6" fill="${c}"/><circle cx="15" cy="10" r=".6" fill="${c}"/><path d="${m}"/></svg>`;}
function metricsGrid(w){
  const cells=[
    ["Avg power",w.avg_w,"W"],["Normalized",w.np,"W"],["Avg HR",w.avg_hr,"bpm"],
    ["Load",w.load,"TSS"],["Intensity",w.if!=null?w.if.toFixed(2):null,"IF"],["Work",w.kj,"kJ"],
    ["Distance",w.km,"km"],["Max HR",w.max_hr,"bpm"],["Climbing",w.elev,"m"]
  ].filter(c=>c[1]!=null).slice(0,6);
  return cells.length?`<div class="mgrid">${cells.map(c=>`<div><span>${c[0]}</span><b>${c[1]}<small>${c[2]}</small></b></div>`).join("")}</div>`:"";
}
function doneCard(w){
  const feel=`<span class="feel">${w.feel?`${faceSVG(w.feel)}<span>Feel: <b>${FEEL[w.feel]||w.feel}</b></span>`:"Feel not logged in Intervals"}</span>`;
  return `<button class="wcard" data-wd="${esc(String(w.id))}">
    <div class="w-top"><span class="tag done">${check}Completed</span><span class="go">${chevR}</span></div>
    <div class="w-name">${esc(w.name||w.type)}</div>
    <div class="w-meta">${dur(w.minutes)}${w.km?` · ${w.km} km`:""}</div>
    ${w.profile?profileSVG(w.profile):""}
    ${metricsGrid(w)}
    <div class="w-foot">${feel}${w.rpe?`<span>RPE: <b>${w.rpe}/10</b></span>`:""}</div>
  </button>`;
}
/* planned session: Intervals' own numbers (power, work, strain, zones, shape), shown here without leaving the app */
const chevR=`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`;
const ZCOL=["#6b7a90","#3a9cf5","#5fe08a","#f7c948","#e9a15a","#ff5d6c","#b07cf0"];
const zcol=pct=>ZCOL[zoneOf(pct)-1];
const secTxt=s=>s>=3600?`${Math.floor(s/3600)}h${String(Math.round(s%3600/60)).padStart(2,"0")}m`:s>=60?`${Math.floor(s/60)}m${s%60?String(Math.round(s%60)).padStart(2,"0")+"s":""}`:`${Math.round(s)}s`;
const zonesOf=D=>(D.zones||[]).filter(z=>/^Z\d$/.test(z.id||""));
// the session drawn as Intervals does: one block per step, height = %FTP, colour = zone
function shapeSVG(D,big){
  const S=(D.segs||[]).filter(s=>s[0]>0);if(!S.length) return "";
  const W=320,H=big?120:64,T=S.reduce((a,s)=>a+s[0],0),top=Math.max(130,...S.flatMap(s=>[s[1]||0,s[2]||0]))*1.06;
  const y=v=>(H-(v||0)/top*(H-2)).toFixed(1);let t=0;
  const blocks=S.map(([d,a,b])=>{const x0=t/T*W,x1=(t+d)/T*W;t+=d;if(a==null) return "";const bb=b??a;
    return `<polygon points="${x0.toFixed(1)},${H} ${x0.toFixed(1)},${y(a)} ${x1.toFixed(1)},${y(bb)} ${x1.toFixed(1)},${H}" fill="${zcol((a+bb)/2)}" opacity=".9"/>`;}).join("");
  const ftp=`<line x1="0" x2="${W}" y1="${y(100)}" y2="${y(100)}" stroke="var(--text)" stroke-opacity=".35" stroke-dasharray="3 4"/>`;
  const lbl=big&&D.ftp?`<text x="${W-2}" y="${(+y(100)-4).toFixed(1)}" text-anchor="end" class="shp-t">FTP ${D.ftp} W</text>`:"";
  return `<svg class="shp${big?" big":""}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${blocks}${ftp}</svg>${big?`<div class="shp-ax"><span>0:00</span><span>${secTxt(T/2)}</span><span>${secTxt(T)}</span></div>`:""}${lbl?`<svg class="shp-l" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${lbl}</svg>`:""}`;
}
function zoneStrip(D){const Z=zonesOf(D),T=Z.reduce((a,z)=>a+z.secs,0);if(!T) return "";
  return `<div class="zstrip">${Z.map((z,i)=>z.secs?`<i style="flex:${z.secs};background:${ZCOL[i]||ZCOL[6]}"></i>`:"").join("")}</div>`;}
const heroK=(p,D)=>{const m=D.secs?Math.round(D.secs/60):p.minutes;
  return `<div class="hero-k"><div><span>Duration</span><b>${m?dur(m):"–"}</b></div><div><span>Load</span><b>${p.load!=null?Math.round(p.load):"–"}</b></div><div><span>Intensity</span><b>${D.if!=null?Math.round(D.if*100)+"<small>%</small>":"–"}</b></div></div>`;};
function planCard(p){
  const D=p.detail;
  if(!D){const href=p.id?`${INTERVALS}/?event=${encodeURIComponent(p.id)}`:`${INTERVALS}/`;
    return `<a class="wcard" href="${href}" target="_blank" rel="noopener">
    <div class="w-top"><span class="tag">Planned</span><span class="go">${arrow}</span></div>
    <div class="w-name">${esc(p.name)}</div>
    <div class="w-meta">${[p.minutes?dur(p.minutes):"",p.load?`${Math.round(p.load)} TSS`:""].filter(Boolean).join(" · ")||"Open in Intervals for details"}</div>
  </a>`;}
  return `<button class="wcard hero" data-pd="${esc(String(p.id))}">
    <div class="w-top"><span class="tag pl">${p.race?"Race":"Planned"}</span><span class="src">Intervals.icu</span></div>
    <div class="w-name">${esc(p.name)}</div>
    ${heroK(p,D)}
    ${shapeSVG(D)}${zoneStrip(D)}
    <div class="w-foot"><span>${[D.np?`NP <b>${D.np} W</b>`:"",D.kj?`<b>${fmtK(D.kj)}</b> kJ`:"",D.ss?`SS <b>${D.ss}</b>`:""].filter(Boolean).join(" · ")}</span><span class="more">Details ${chevR}</span></div>
  </button>`;
}
const findPlan=id=>{for(const d of DATA.days||[]) for(const p of d.plan||[]) if(String(p.id)===id) return [p,d.date];return [null,null];};
function descHTML(t){
  return t.split(/\n/).map(l=>l.trim()).reduce((a,l)=>{if(!l){a.push("<i class='gap'></i>");return a;}
    const m=l.match(/^[-•*]\s*(.*)$/);a.push(m?`<li>${esc(m[1])}</li>`:`<p>${esc(l)}</p>`);return a;},[]).join("")
    .replace(/(<li>.*?<\/li>)+/g,x=>`<ul>${x}</ul>`).replace(/^(<i class='gap'><\/i>)+|(<i class='gap'><\/i>)+$/g,"");
}
function openPlanned(id){
  const [p,date]=findPlan(id);if(!p||!p.detail) return;const D=p.detail,Z=zonesOf(D),T=Z.reduce((a,z)=>a+z.secs,0)||1;
  const cell=(n,v,u)=>v==null?"":`<div><span>${n}</span><b>${v}<small>${u}</small></b></div>`;
  openSheet(`<div class="sh-top"><h2>${esc(p.name)}</h2>${X}</div>
    <p class="sh-desc">${fmtDay(date,{weekday:"long",day:"numeric",month:"long"})} · ${esc(/Ride/.test(p.type||"")?"Ride":/Run/.test(p.type||"")?"Run":(p.type||"Workout"))}${D.indoor?" · indoor":""}</p>
    <div class="srcbar"><span class="src">Intervals.icu</span><span>Planned workout, numbers computed by Intervals${D.ftp?` on your FTP of ${D.ftp} W`:""}</span></div>
    <div class="pw-sheet">${heroK(p,D)}${shapeSVG(D,true)}</div>
    ${Z.length&&T>1?`<h3 class="sh-sub">Time in zones</h3><div class="zrows">${Z.map((z,i)=>`<div class="zr"><b style="color:${ZCOL[i]}">${esc(z.id)}</b><span>${z.lo!=null&&z.hi!=null?(z.hi>3000?`${z.lo}+ W`:`${z.lo}–${z.hi} W`):""}</span>
      <em><u style="width:${(z.secs/T*100).toFixed(1)}%;background:${ZCOL[i]}"></u></em><i>${z.secs?secTxt(z.secs):"–"}</i><small>${z.secs?(z.secs/T*100).toFixed(1)+"%":""}</small></div>`).join("")}</div>`:""}
    <h3 class="sh-sub">Power</h3>
    <div class="mgrid sh">${cell("Normalized",D.np,"W")}${cell("Average",D.avg_w,"W")}${cell("Variability",D.vi!=null?D.vi.toFixed(2):null,"VI")}
      ${cell("Polarization",D.pi!=null?D.pi.toFixed(2):null,"PI")}${cell("Work",D.kj!=null?fmtK(D.kj):null,"kJ")}${cell("Work > FTP",D.kj_ftp,"kJ")}</div>
    ${D.ss!=null?`<h3 class="sh-sub">Strain score</h3><div class="ssc"><b>${D.ss}</b><div><span><i style="background:var(--b5)"></i>Below CP <em>${D.ss_cp??"–"}</em></span><span><i style="background:var(--s2)"></i>W′ <em>${D.ss_wp??"–"}</em></span><span><i style="background:var(--hr)"></i>Max power <em>${D.ss_pmax??"–"}</em></span></div></div>`:""}
    ${D.desc?`<h3 class="sh-sub">The workout</h3><div class="wdesc">${descHTML(D.desc)}</div>`:""}
    <a class="pl-q" href="${INTERVALS}/?event=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">Open in Intervals ${arrow}</a>`);
}
function openDone(id){
  const d=(DATA.days||[]).find(x=>(x.workouts||[]).some(w=>String(w.id)===id)),w=d&&d.workouts.find(w=>String(w.id)===id);if(!w) return;
  const cells=[["Avg power",w.avg_w,"W"],["Normalized",w.np,"W"],["Intensity",w.if!=null?Math.round(w.if*100):null,"%"],["Load",w.load,"TSS"],["Work",w.kj!=null?fmtK(w.kj):null,"kJ"],
    ["Avg HR",w.avg_hr,"bpm"],["Max HR",w.max_hr,"bpm"],["Cadence",w.cadence!=null?Math.round(w.cadence):null,"rpm"],["Distance",w.km,"km"],["Climbing",w.elev,"m"],["Calories",w.kcal!=null?fmtK(w.kcal):null,"kcal"],["Elapsed",w.elapsed?dur(w.elapsed):null,""]].filter(c=>c[1]!=null);
  openSheet(`<div class="sh-top"><h2>${esc(w.name||w.type)}</h2>${X}</div>
    <p class="sh-desc">${fmtDay(d.date,{weekday:"long",day:"numeric",month:"long"})}${w.start?` · ${w.start}`:""} · ${dur(w.minutes)}</p>
    <div class="srcbar"><span class="src">Intervals.icu</span><span>Completed session, recorded by Garmin and analysed by Intervals</span></div>
    ${w.profile?`<div class="pw-sheet">${profileSVG(w.profile)}</div>`:""}
    <div class="mgrid sh">${cells.map(c=>`<div><span>${c[0]}</span><b>${c[1]}<small>${c[2]}</small></b></div>`).join("")}</div>
    <div class="w-foot"><span class="feel">${w.feel?`${faceSVG(w.feel)}<span>Feel: <b>${FEEL[w.feel]||w.feel}</b></span>`:"Feel not logged in Intervals"}</span>${w.rpe?`<span>RPE: <b>${w.rpe}/10</b></span>`:""}</div>
    <a class="pl-q" href="${INTERVALS}/activities/${encodeURIComponent(w.id)}" target="_blank" rel="noopener">Open in Intervals ${arrow}</a>`);
}
function bindSessions(){
  document.querySelectorAll("[data-pd]").forEach(b=>b.onclick=()=>{buzz(5);openPlanned(b.dataset.pd);});
  document.querySelectorAll("[data-wd]").forEach(b=>b.onclick=()=>{buzz(5);openDone(b.dataset.wd);});
}
function sessions(day){
  const isT=day.date===todayISO();
  const done=(day.workouts||[]).filter(w=>w.type);
  const doneEvents=new Set(done.map(w=>w.event).filter(Boolean));
  const plans=day.date<todayISO()?[]:(day.plan||[]).filter(p=>!p.done&&!doneEvents.has(p.id));
  // today, with a score: each planned session comes with its full and short version
  const sc=isT&&day.score!=null?applyAnswers(day,Object.keys(draft).length?draft:day.answers):null;
  const cards=done.map(doneCard).concat(plans.map(p=>planCard(p)+(sc?adaptCard(p,sc.band,sc.alarm):"")));
  const title=isT?"Today's training":"Training";
  const empty=`<div class="wcard rest"><div class="w-name">Nothing planned</div><div class="w-meta">Rest day, or nothing on the calendar yet.</div></div>`;
  return `<section class="sec"><div class="sec-h"><h2>${title}</h2><span>Synced with Garmin & Intervals</span></div>
    ${cards.length?cards.join(""):empty}
    <a class="callink" href="${INTERVALS}/" target="_blank" rel="noopener">
      <span class="cal-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></span>
      <span class="cal-t"><b>Training calendar</b><span>This week's plan in Intervals</span></span>
      <span class="go">${arrow}</span></a>
  </section>`;
}

/* ------------------------------------------------------------ training tab */
const SPORT_COL={Cycling:"#3a9cf5",Running:"#f2a65a",Strength:"#b07cf0",Hiking:"#5fe08a",Walking:"#9ed9a8",Swimming:"#2cc9c0",
  Yoga:"#f07ab0",Skiing:"#9fb8ff",Rowing:"#6b6cf2",Climbing:"#e8c35a",Football:"#c9d36a"};
const EXTRA_COL=["#e07a5f","#81b29a","#f2cc8f","#a8dadc","#cdb4db","#ffafcc"];
const sportCol=k=>SPORT_COL[k]||EXTRA_COL[[...k].reduce((a,c)=>a+c.charCodeAt(0),0)%EXTRA_COL.length];
const SPORT_PRI=["Cycling","Running","Strength"];
const sportsOf=o=>Object.keys(o).sort((a,b)=>{const pa=SPORT_PRI.indexOf(a),pb=SPORT_PRI.indexOf(b);
  return (pa<0?9:pa)-(pb<0?9:pb)||o[b]-o[a];});
const hrs=m=>{const h=m/60;return h>=100?Math.round(h)+"h":h>=10?h.toFixed(0)+"h":(Math.round(h*10)/10).toString()+"h";};
const hm2=m=>`${Math.floor(m/60)}h${String(Math.round(m%60)).padStart(2,"0")}`;
const isoD=d=>d.toLocaleDateString("sv-SE");
const mondayOf=iso=>{const d=new Date(iso+"T12:00");d.setDate(d.getDate()-((d.getDay()+6)%7));return isoD(d);};
function sumRange(from,to){ // inclusive iso dates -> {sport:minutes}
  const out={}; for(const [d,v] of Object.entries(DATA.volume||{})) if(d>=from&&d<=to) for(const [k,m] of Object.entries(v)) out[k]=(out[k]||0)+m;
  return out;}
const tot=o=>Object.values(o).reduce((a,b)=>a+b,0);
function sportRows(o,caption){
  const t=tot(o)||1,ks=sportsOf(o);
  if(!ks.length) return `<p class="muted-s">No activities ${esc(caption||"")}.</p>`;
  return `<div class="sp-cap">${esc(caption?caption[0].toUpperCase()+caption.slice(1):"")}, by sport</div>`+ks.map(k=>`<div class="sp-row"><i style="background:${sportCol(k)}"></i><span>${esc(k)}</span>
    <em><u style="width:${o[k]/t*100}%;background:${sportCol(k)}"></u></em><b>${hm2(o[k])}</b></div>`).join("");
}

/* streak: consecutive weeks with at least one activity (the current week keeps it alive until it ends) */
function streakInfo(){
  const weeks=new Set(Object.keys(DATA.volume||{}).map(mondayOf)),cur=mondayOf(todayISO());
  const step=(iso,k)=>{const d=new Date(iso+"T12:00");d.setDate(d.getDate()+7*k);return isoD(d);};
  let n=0,w=weeks.has(cur)?cur:step(cur,-1);
  while(weeks.has(w)){n++;w=step(w,-1);}
  const last=[...Array(12)].map((_,i)=>{const s=step(cur,i-11);return {start:s,on:weeks.has(s),cur:s===cur};});
  // best streak ever, for the restart messages
  const all=[...weeks].sort();let best=0,run=0,prev=null;
  for(const w0 of all){run=prev&&step(prev,1)===w0?run+1:1;best=Math.max(best,run);prev=w0;}
  return {n,thisWeek:weeks.has(cur),last,best};
}
/* one line a day, picked from a large pool so repeats are rare and always positive */
const STREAK_LINES={
 on:["{n} weeks of showing up. That's how strong cyclists are built.","Consistency is your superpower: {n} weeks and counting.","Another week in the bank. Future you says thanks.",
  "{n} weeks straight. The hard part is behind you, keep rolling.","Quiet, steady, relentless: {n} weeks of it.","The best training plan is the one you keep doing. You're doing it.",
  "Week after week, the legs remember. {n} in a row.","{n} weeks. Not luck, a habit.","Small sessions, big streak. Nicely done.",
  "You've turned training into part of who you are.","{n} weeks of choosing yourself. Keep choosing.","Momentum is on your side this week.",
  "Every week counts, and you've counted {n} of them.","The Dolomites are built one week at a time. {n} down.","Strong week, strong habit.",
  "Showing up beats perfect. You keep showing up.","{n} weeks and the streak still looks hungry.","This is what commitment looks like on a calendar.",
  "Rain, work, life: still {n} weeks in a row.","Your consistency is doing more than any single hard session.","The streak is alive and so are the legs.",
  "{n} weeks. Make it {n1}.","Fitness is patience in disguise. You've got plenty.","Another tick on the board. Keep the line unbroken.",
  "Some people talk about training. You've done {n} weeks of it.","Easy days, hard days, all of them count. {n} weeks.","Your engine is getting built, week by week.",
  "Proud of this one: {n} weeks without a gap.","The habit is stronger than the excuse. {n} weeks prove it.","You're writing a good story here. Chapter {n}.",
  "Discipline today, freedom on the climbs tomorrow.","{n} weeks in. The compound interest is coming.","A streak like this doesn't happen by accident.",
  "Steady wins. {n} weeks of steady.","You're the kind of athlete who shows up. {n} weeks say so.","Every pedal stroke this week kept the fire going.",
  "Keep stacking weeks. They add up to seasons.","{n} straight weeks. Enjoy that for a second.","This week is done. The streak thanks you.",
  "Great rhythm. Let's keep the beat going."],
 pending:["The streak is waiting for this week's session. One ride does it.","{n} weeks and counting. This week is still open.",
  "One activity this week and the streak grows to {n1}.","No pressure, just a reminder: one session keeps {n} weeks alive.","The week is young. Your streak believes in you.",
  "Any ride counts. Any run counts. Keep the {n}-week fire going.","Week {n1} is just one workout away.","You've done this {n} times already. Once more.",
  "Even an easy spin keeps the streak alive.","Life gets busy. A short session still counts.","{n} weeks of habit don't disappear. Add this one.",
  "Your streak is the easiest win of the week. Go get it.","Fresh week, same you. Let's go.","One move this week. That's all it takes.",
  "The best session is the one that happens. Find a slot this week.","Plan it, ride it, tick it. Week {n1} awaits.","Your legs are ready when you are.",
  "A new week to keep a good thing going.","Keep the chain moving: {n} weeks so far.","This week's tick is still up for grabs.",
  "Thirty minutes is enough to keep the fire lit.","You've built {n} weeks. Protect them with one session.","Find your window this week. The streak will thank you.",
  "Momentum loves company. Join it this week.","Small effort, big streak. One activity this week.","Week {n1} is calling.",
  "Make this week count, even a little.","Every streak survives on one simple session.","Don't overthink it. Just get out once this week.",
  "The fire is lit. Add a log this week."],
 restart:["Every streak starts at one. Start yours this week.","New streak, same engine. Let's build it again.","Your best run was {best} weeks. Time to chase it.",
  "Breaks happen. Comebacks are better.","A fresh start is still a start. One activity this week.","The legs remember more than you think. Let's go again.",
  "Week one of something great.","No streak to protect means nothing to fear. Just go.","Restart mode: one session this week and you're back on the board.",
  "You've done {best} weeks before. You can do it again.","Rest is part of training. Now let's rebuild.","Champions aren't the ones who never stop. They're the ones who restart.",
  "The road is still there. So are you.","Today is a perfect day to begin again.","Every season has a first week. This can be yours.",
  "Small step, new streak. Let's light it up.","Momentum starts with one ride.","Back at it. The best part of a streak is building it.",
  "You're not starting over, you're starting stronger.","Let's write a new streak, one week at a time.","One activity this week turns zero into one.",
  "Fitness comes back faster than you think. Go remind it.","Fresh legs, fresh streak.","Your next streak could be your longest. Begin it.",
  "Lace up or clip in. Week one awaits.","Progress isn't a straight line. Neither are the Dolomites.","A pause, not a stop. Let's go.",
  "Light the fire again. It catches fast.","Week one is the hardest and the best. Go get it.","Your comeback starts with a single session."]};
function streakLine(s){
  const pool=STREAK_LINES[s.n===0?"restart":s.thisWeek?"on":"pending"];
  const day=todayISO(),h=[...day].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
  return pool[h%pool.length].replace(/\{n1\}/g,s.n+1).replace(/\{n\}/g,s.n).replace(/\{best\}/g,Math.max(s.best,1)).replace(/\b1 weeks\b/g,"1 week").replace(/\b1 times\b/g,"once").replace(/\b1-week\b/g,"1-week");
}
function flameBadge(){
  return `<svg class="flame" viewBox="0 0 64 64" width="58" height="58" aria-hidden="true">
    <defs>
      <radialGradient id="fb-bg" cx="50%" cy="38%" r="65%"><stop offset="0" stop-color="#3a2230"/><stop offset="1" stop-color="#1c1a26"/></radialGradient>
      <linearGradient id="fb-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".9"/><stop offset=".5" stop-color="#ff7a59" stop-opacity=".35"/><stop offset="1" stop-color="#c2407a" stop-opacity=".8"/></linearGradient>
      <linearGradient id="fb-outer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset=".55" stop-color="#ff6a3d"/><stop offset="1" stop-color="#d9366b"/></linearGradient>
      <linearGradient id="fb-inner" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d6"/><stop offset=".6" stop-color="#ffd36b"/><stop offset="1" stop-color="#ff9a3d"/></linearGradient>
      <filter id="fb-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.2"/></filter>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#fb-bg)"/>
    <circle cx="32" cy="32" r="29.2" fill="none" stroke="url(#fb-ring)" stroke-width="1.4"/>
    <path d="M33.4 12.5c1 5.6-2 8.7-4.6 11.6-2.7 3-5.6 6.2-5.6 11.5 0 6.9 4.5 12.4 10.6 12.4 6.4 0 11-5.2 11-12.2 0-4.9-2.3-8.1-4.4-10.6-.3 2.4-1.2 4.2-2.9 5.4.3-6.7-.9-12.8-4.1-18.1z" fill="#ff6a3d" filter="url(#fb-glow)" opacity=".7"/>
    <path d="M33.4 12.5c1 5.6-2 8.7-4.6 11.6-2.7 3-5.6 6.2-5.6 11.5 0 6.9 4.5 12.4 10.6 12.4 6.4 0 11-5.2 11-12.2 0-4.9-2.3-8.1-4.4-10.6-.3 2.4-1.2 4.2-2.9 5.4.3-6.7-.9-12.8-4.1-18.1z" fill="url(#fb-outer)"/>
    <path d="M33.6 30.5c.4 2.8-1 4.3-2.3 5.8-1.3 1.5-2.7 3-2.7 5.6 0 3.3 2.2 6 5.2 6s5.3-2.5 5.3-5.9c0-2.4-1.1-3.9-2.1-5.1-.2 1.2-.6 2-1.4 2.6.1-3.2-.5-6.3-2-9z" fill="url(#fb-inner)"/>
  </svg>`;
}
function streakCard(){
  const s=streakInfo();
  return `<div class="card streak">
    <div class="st-top">${flameBadge()}<div><div class="st-n"><b>${s.n}</b><span>${s.n===1?"week":"weeks"}</span></div><div class="st-l">Training streak</div></div></div>
    <p class="st-quote">${esc(streakLine(s))}</p>
    <div class="st-weeks">${s.last.map(w=>`<i class="${w.on?"on":""}${w.cur?" cur":""}"></i>`).join("")}</div>
    <div class="st-ax"><span>12 weeks ago</span><span>This week</span></div></div>`;
}

function weekSection(){
  const W=DATA.weeks; if(!W) return "";
  const t=todayISO(),ds=W.days,end=ds[6].date;
  const sum=k=>ds.reduce((a,d)=>a+(d[k]||0),0);
  const dm=tot(sumRange(W.start,end))||sum("done_min"),pm=sum("plan_min"),dl=sum("done_load"),pl=sum("plan_load"),dn=sum("done_n"),pn=sum("plan_n");
  const stat=(label,done,plan,fmt)=>{const pct=plan?clip(done/plan*100,0,100):done?100:0;
    return `<div class="wk-stat"><span>${label}</span><b>${fmt(done)}${plan?`<small>/ ${fmt(plan)}</small>`:""}</b>
      <div class="wk-bar"><i style="width:${pct}%"></i></div></div>`;};
  const letters=["M","T","W","T","F","S","S"];
  const strip=ds.map((d,i)=>{
    const st=d.done_n?"done":d.plan_n&&d.date>=t?"plan":"rest";
    const v=d.done_n?Math.round(d.done_load||d.done_min):st==="plan"?Math.round(d.plan_load||d.plan_min):"";
    return `<div class="wk-day ${st}${d.date===t?" today":""}"><span>${letters[i]}</span><i></i><em>${v||"&nbsp;"}</em></div>`;}).join("");
  const sp=sumRange(W.start,end);
  return `<section class="sec"><div class="sec-h"><h2>This week</h2><span>${fmtDay(W.start,{day:"numeric",month:"short"})} – ${fmtDay(end,{day:"numeric",month:"short"})}</span></div>
    <div class="card wk">
      <div class="wk-stats">${stat("Time",dm,pm,hrs)}${stat("Load",dl,pl,v=>Math.round(v))}${stat("Sessions",dn,pn,v=>v)}</div>
      <div class="wk-strip">${strip}</div>
      <div class="wk-key"><span><i class="k done"></i>Done</span><span><i class="k plan"></i>Planned</span><span class="r">Numbers: TSS</span></div>
      ${tot(sp)?`<div class="wk-sp">${sportRows(sp,"this week")}</div>`:""}
    </div></section>`;
}

/* volume history: hours per week / month / year, stacked by sport */
let volMode=(()=>LS.get("rd_vol")||"week")(),volPick=null;
function volBuckets(mode){
  const t=todayISO(),out=[];
  if(mode==="week"){let m=mondayOf(t);for(let i=0;i<12;i++){const d=new Date(m+"T12:00");d.setDate(d.getDate()-7*i);const s=isoD(d),e=new Date(d);e.setDate(e.getDate()+6);
      out.unshift({label:fmtDay(s,{day:"numeric",month:"short"}),title:`Week of ${fmtDay(s,{day:"numeric",month:"long"})}`,o:sumRange(s,isoD(e)),short:i===0?"This":fmtDay(s,{day:"numeric"})});}}
  else if(mode==="month"){const n=new Date(t+"T12:00");for(let i=0;i<12;i++){const d=new Date(n.getFullYear(),n.getMonth()-i,1,12),e=new Date(d.getFullYear(),d.getMonth()+1,0,12);
      out.unshift({title:d.toLocaleDateString("en-GB",{month:"long",year:"numeric"}),o:sumRange(isoD(d),isoD(e)),short:d.toLocaleDateString("en-GB",{month:"narrow"})});}}
  else{const ys=[...new Set(Object.keys(DATA.volume||{}).map(d=>d.slice(0,4)))].sort();const y0=+t.slice(0,4);
      for(const y of ys.length?ys:[String(y0)]) out.push({title:y+(+y===y0?" so far":""),o:sumRange(`${y}-01-01`,`${y}-12-31`),short:y});}
  return out;
}
function volCaption(P){return volMode==="week"?(P.short==="This"?"this week":P.title.replace("Week of","week of")):volMode==="month"?"in "+P.title:"in "+P.title.replace(" so far"," so far");}
function volumeSection(){
  const B=volBuckets(volMode),max=Math.max(...B.map(b=>tot(b.o)),60);
  const pick=volPick==null||volPick>=B.length?B.length-1:volPick,P=B[pick];
  const bars=B.map((b,i)=>{const segs=sportsOf(b.o).map(k=>`<u style="height:${b.o[k]/max*100}%;background:${sportCol(k)}"></u>`).join("");
    return `<button class="vb${i===pick?" on":""}" data-vi="${i}" aria-label="${esc(b.title)}"><span class="vb-col">${segs||'<u class="nil"></u>'}</span><em>${esc(b.short)}</em></button>`;}).join("");
  const avg=B.length>1?tot(B.slice(0,-1).reduce((a,b)=>{for(const[k,v] of Object.entries(b.o))a[k]=(a[k]||0)+v;return a;},{}))/(B.length-1):0;
  return `<section class="sec" id="volsec"><div class="sec-h"><h2>Hours</h2><span>By sport</span></div>
    <div class="card vol">
      <div class="range"><button data-vm="week" class="${volMode==="week"?"on":""}">Weeks</button><button data-vm="month" class="${volMode==="month"?"on":""}">Months</button><button data-vm="year" class="${volMode==="year"?"on":""}">Years</button></div>
      <div class="vol-read"><span>${esc(P.title)}</span><b>${hm2(tot(P.o))}</b>${volMode!=="year"&&avg?`<em>avg ${hm2(avg)}</em>`:""}</div>
      <div class="vbars${B.length<6?" few":""}">${bars}</div>
      <div class="vol-sp">${sportRows(P.o,volCaption(P))}</div>
    </div></section>`;
}
function bindVolume(){
  document.querySelectorAll("#volsec .vb").forEach(b=>b.onclick=()=>{volPick=+b.dataset.vi;redrawVol();});
  document.querySelectorAll("#volsec [data-vm]").forEach(b=>b.onclick=()=>{volMode=b.dataset.vm;LS.set("rd_vol",volMode);volPick=null;redrawVol();});
}
function redrawVol(){$("volsec").outerHTML=volumeSection();bindVolume();}

let fitPick=null;
function formZone(f){return f>5?["Fresh","var(--b3)"]:f>=-10?["Neutral","var(--muted)"]:f>=-30?["Optimal","var(--b5)"]:["High risk","var(--amber)"];}
function fitnessSection(){
  const s=DATA.days.filter(d=>d.ctl!=null).slice(-42); if(s.length<7) return "";
  const W=320,H=130,FH=46,PR=4,x=i=>(i+.5)*(W-PR)/s.length;
  const vals=s.flatMap(d=>[d.ctl,d.atl]),lo=Math.min(...vals)*.9,hi=Math.max(...vals)*1.05;
  const y=v=>6+(hi-v)/(hi-lo)*(H-12);
  const pl=k=>s.map((d,i)=>`${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(" ");
  const form=s.map(d=>(d.ctl-d.atl)/d.ctl*100),fmax=Math.max(40,...form.map(Math.abs));
  const fy=v=>FH/2-v/fmax*(FH/2-2);
  const fb=form.map((f,i)=>{const bw=(W-PR)/s.length*.62,[,c]=formZone(f);
    return `<rect x="${(x(i)-bw/2).toFixed(1)}" y="${Math.min(fy(f),FH/2).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1,Math.abs(fy(f)-FH/2)).toFixed(1)}" rx="1" fill="${c}" opacity=".85"/>`;}).join("");
  const pick=fitPick==null||fitPick>=s.length?s.length-1:fitPick,pd=s[pick],pf=Math.round(form[pick]),[zn,zc]=formZone(form[pick]);
  const hits=s.map((d,i)=>`<rect data-fi="${i}" x="${(x(i)-(W-PR)/s.length/2).toFixed(1)}" y="0" width="${((W-PR)/s.length).toFixed(1)}" height="${H+FH+10}" fill="transparent" style="cursor:pointer"/>`).join("");
  return `<section class="sec" id="fitsec"><div class="sec-h"><h2>Fitness</h2><span>Last 6 weeks</span></div>
    <div class="card fit">
      <div class="fit-top">
        <div><span><i style="background:var(--b3)"></i>Fitness</span><b>${Math.round(pd.ctl)}</b></div>
        <div><span><i style="background:var(--pw)"></i>Fatigue</span><b>${Math.round(pd.atl)}</b></div>
        <div><span><i style="background:${zc}"></i>Form</span><b style="color:${zc}">${pf>0?"+":""}${pf}%</b></div>
      </div>
      <div class="fit-day">${fmtDay(pd.date,{weekday:"short",day:"numeric",month:"short"})} · ${zn}</div>
      <svg viewBox="0 0 ${W} ${H+FH+10}" class="fit-svg">
        <line x1="${x(pick)}" x2="${x(pick)}" y1="0" y2="${H+FH+10}" stroke="var(--muted)" opacity=".4"/>
        <polyline points="${pl("atl")}" fill="none" stroke="var(--pw)" stroke-width="1.6" stroke-linejoin="round" opacity=".9"/>
        <polyline points="${pl("ctl")}" fill="none" stroke="var(--b3)" stroke-width="2.4" stroke-linejoin="round"/>
        <circle cx="${x(pick)}" cy="${y(pd.ctl)}" r="4" fill="var(--b3)" stroke="var(--surface)" stroke-width="2"/>
        <circle cx="${x(pick)}" cy="${y(pd.atl)}" r="3.5" fill="var(--pw)" stroke="var(--surface)" stroke-width="2"/>
        <g transform="translate(0,${H+10})">
          <rect x="0" y="${fy(-10)}" width="${W-PR}" height="${fy(-30)-fy(-10)}" fill="var(--b5)" opacity=".07"/>
          <line x1="0" x2="${W-PR}" y1="${FH/2}" y2="${FH/2}" stroke="var(--line)"/>${fb}
        </g>${hits}
      </svg>
      <div class="ax"><span>${fmtDay(s[0].date,{day:"numeric",month:"short"})}</span><span>Form bars · shaded: optimal −10% to −30%</span><span>${fmtDay(s[s.length-1].date,{day:"numeric",month:"short"})}</span></div>
    </div></section>`;
}
function bindFitness(){
  document.querySelectorAll("rect[data-fi]").forEach(r=>r.onclick=()=>{fitPick=+r.dataset.fi;
    $("fitsec").outerHTML=fitnessSection(); bindFitness();});
}
function renderTraining(){
  $("app").innerHTML=`
  <div class="top"><div class="ttl">Training</div>
    <span class="tb">${ASK}<button class="gear" id="gear" aria-label="Settings">${GEAR}</button></span></div>
  ${pageBar("training")}
  ${PG.training==="week"?(()=>{const t=(DATA.days||[]).find(d=>d.date===todayISO());return t?sessions(t):"";})()+weekReviewSection()+streakCard()+weekSection():""}
  ${PG.training==="month"?monthPage()+intensitySection()+volumeSection():""}
  ${PG.training==="fitness"?powerSection()+durabilitySection()+markersSection()+fitnessSection():""}
  <p class="foot">Updated ${esc(new Date(DATA.generated_at).toLocaleString("en-GB",{weekday:"long",hour:"2-digit",minute:"2-digit"}))}</p>`;
  $("gear").onclick=openSettings; bindSessions(); bindVolume(); bindFitness(); bindMonthPage(); bindIntensity();
  document.querySelectorAll(".mk[data-mk]").forEach(b=>b.onclick=()=>openMarker(b.dataset.mk));
}

