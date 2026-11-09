"use strict";
/* ------------------------------------------------------------ "something's off" notes */
const OFF={too_high:"The score feels too high",too_low:"The score feels too low",signal:"A signal looks wrong",other:"Something else"};
function openOff(){
  const raw=DATA.days[sel],prev=raw.note||JSON.parse(LS.get("note:"+raw.date)||"null")||{};
  let kind=prev.kind||"";
  openSheet(`<div class="sh-top"><h2>Something off?</h2>${X}</div>
    <p class="sh-desc">Note it now while it's fresh. After a few weeks these notes, together with how your sessions felt, are used to retune the score.</p>
    <div class="picks">${Object.entries(OFF).map(([k,t])=>`<button data-o="${k}" class="${k===kind?"on":""}">${t}</button>`).join("")}</div>
    <div class="field"><label for="o-tx">What happened (optional)</label><textarea id="o-tx" maxlength="800" placeholder="e.g. legs felt great on the climbs">${esc(prev.text||"")}</textarea></div>
    <div class="savebar" style="margin-top:16px"><span class="st" id="o-st"></span><button class="btn" id="o-save" ${kind?"":"disabled"}>Save note</button></div>`);
  document.querySelectorAll(".picks button").forEach(b=>b.onclick=()=>{kind=b.dataset.o;
    document.querySelectorAll(".picks button").forEach(x=>x.classList.toggle("on",x===b)); $("o-save").disabled=false;});
  $("o-save").onclick=async()=>{
    const note={date:raw.date,kind,text:$("o-tx").value.trim(),score:raw.score??null};
    LS.set("note:"+raw.date,JSON.stringify(note)); raw.note=note;
    const st=$("o-st"); $("o-save").disabled=true; st.textContent="Saving…";
    try{ await sendMail("notes",note); st.textContent="Saved. Thanks, it's on record.";    }catch(e){ st.textContent=`Saved on this phone only (${e.message}).`; }
  };
}
const VSTAT={ok:["Holding up","#5fc795"],watch:["Watch","#e9a15a"],bad:["Off","#ff5d6c"],early:["Too early","#8c98ab"],wait:["Waiting","#5f6c80"]};
function openValidation(){
  const v=DATA.validation||{n:0,by_band:{},notes:[],checks:[]};
  const order=["Super","Normal","Low","Very low"],fl=f=>FEEL[Math.round(f)]||"–";
  const vd=v.verdict||{state:"collecting",text:""},pct=Math.min(100,Math.round((v.n||0)/(v.target||30)*100));
  const vcol={collecting:"var(--b3)",valid:"#5fc795",retune:"#e9a15a"}[vd.state]||"var(--b3)";
  const h=v.history;
  openSheet(`<div class="sh-top"><h2>Score check</h2>${X}</div>
    <div class="v-verdict" style="--vc:${vcol}"><b>${vd.state==="valid"?"Validated":vd.state==="retune"?"Needs retuning":"Test in progress"}</b>
      <span>${esc(vd.text)}</span>${vd.state==="collecting"?`<div class="v-prog"><i style="width:${pct}%"></i></div><em>${v.n} / ${v.target} rated sessions · ${v.days||0} days since ${fmtDay(v.since,{day:"numeric",month:"short"})}</em>`:""}</div>
    <div class="v-checks">${(v.checks||[]).map(c=>`<div class="v-c"><div class="v-ch"><b>${esc(c.name)}</b><em style="color:${VSTAT[c.status][1]}">${VSTAT[c.status][0]}</em></div><p>${esc(c.text)}</p></div>`).join("")}</div>
    ${h&&h.r!=null?`<div class="note-card" style="margin-top:12px"><b>Back-test on earlier data.</b> Running today's algorithm on your sessions from ${fmtDay(h.from,{day:"numeric",month:"short"})} to the start of the test: match ${h.r>0?"+":""}${h.r} over ${h.n} sessions${h.r>=.3?", a good sign":h.r>=.1?", a weak link":", no clear link"}. Sessions you didn't rate back then don't count.</div>`:""}
    ${order.some(b=>v.by_band[b])?`<div class="sec-h" style="margin-top:22px"><h2>Feel by band</h2><span>since ${fmtDay(v.since,{day:"numeric",month:"short"})}</span></div>
    ${order.filter(b=>v.by_band[b]).map(b=>`<div class="vrow"><span>${b} days (${v.by_band[b].n})</span><b>avg feel ${v.by_band[b].feel} · ${fl(v.by_band[b].feel)}</b></div>`).join("")}`:""}
    <div class="sec-h" style="margin-top:22px"><h2>Your notes</h2><span>${v.notes.length}</span></div>
    ${v.notes.length?v.notes.slice().reverse().map(n=>`<div class="vnote"><b>${OFF[n.kind]||"Note"}</b> <em>· ${fmtDay(n.date,{day:"numeric",month:"short"})}, score ${n.score}</em>${n.text?`<br>${esc(n.text)}`:""}</div>`).join(""):"<p class='sh-desc'>No notes yet. When the score doesn't match how you feel, tap “Score doesn't feel right?” under the score.</p>"}
    <p class="sh-note">The verdict comes once there are ${v.target||30} sessions with a feel rating (1 strong … 5 weak in Intervals) and four weeks of scores. Each check is independent: session feel and your morning answer test whether the score tracks how you really are; alarms are checked against the days you reported being ill; notes, stability and spread catch an offset or a noisy score.</p>`);
}

/* ------------------------------------------------------------ score sheet */
let scorePick=null;
function scoreChart(n){
  const s=DATA.days.slice(Math.max(0,sel-n+1),sel+1);
  if(s.filter(d=>d.score!=null).length<2) return "<p class='sh-desc'>Not enough data yet.</p>";
  const W=320,H=170,PL=4,PR=30,PT=8,PB=8,y=v=>PT+(100-v)/100*(H-PT-PB),x=i=>PL+(i+.5)*((W-PL-PR)/s.length);
  const pick=scorePick==null||scorePick>=s.length||s[scorePick].score==null?s.map(d=>d.score!=null).lastIndexOf(true):scorePick;
  const zones=SEGS.map(([a,b,c])=>`<rect x="${PL}" y="${y(b)}" width="${W-PL-PR}" height="${y(a)-y(b)}" fill="${c}" opacity=".07"/>
    <line x1="${PL}" x2="${W-PR+4}" y1="${y(a)}" y2="${y(a)}" stroke="var(--muted)" stroke-dasharray="3 4" opacity="${a?.35:0}"/>
    ${a?`<text class="rl" x="${W-PR+8}" y="${y(a)+4}">${a}</text>`:""}`).join("");
  const line=s.map((d,i)=>d.score!=null?`${x(i).toFixed(1)},${y(d.score).toFixed(1)}`:null).filter(Boolean).join(" ");
  const r=n>7?3.2:4.6;
  const dots=s.map((d,i)=>d.score==null?"":`<circle cx="${x(i)}" cy="${y(d.score)}" r="${i===pick?r+2:r}" fill="${i===pick?segColor(d.score):"var(--surface)"}" stroke="${segColor(d.score)}" stroke-width="2"/>`).join("");
  const hits=s.map((d,i)=>`<rect data-si="${i}" x="${x(i)-(W-PL-PR)/s.length/2}" y="0" width="${(W-PL-PR)/s.length}" height="${H}" fill="transparent" style="cursor:pointer"/>`).join("");
  const pk=s[pick];
  return `<div class="readout"><span>${fmtDay(pk.date,{weekday:"short",day:"numeric",month:"short"})}</span><b>${pk.score}</b><em style="color:${segColor(pk.score)}">${pk.band}</em></div>
    <div class="sh-chart"><svg viewBox="0 0 ${W} ${H}">${zones}
      <line x1="${x(pick)}" x2="${x(pick)}" y1="${PT}" y2="${H-PB}" stroke="var(--muted)" opacity=".5"/>
      <polyline points="${line}" fill="none" stroke="var(--text)" stroke-width="1.8" stroke-linejoin="round" opacity=".85"/>${dots}${hits}</svg>
    <div class="ax"><span>${fmtDay(s[0].date,{day:"numeric",month:"short"})}</span><span>${fmtDay(s[s.length-1].date,{day:"numeric",month:"short"})}</span></div></div>`;
}
function openScore(n=30,keep=false){
  if(!keep) scorePick=null;
  const raw=DATA.days[sel],isT=raw.date===todayISO(),day=isT?applyAnswers(raw,Object.keys(draft).length?draft:raw.answers):raw;
  if(day.score==null) return;
  const c=day.comp||{},order=SIG_KEYS().map(k=>[k,SIG[k].name]);
  const rows=order.map(([k,name])=>{const v=c[k],w=Math.round(DATA.weights[k]*100);
    if(!v) return `<div class="bd"><div class="bd-t"><span>${name}<i>${w}%</i></span><b>–</b></div><div class="bd-bar"></div></div>`;
    return `<div class="bd"><div class="bd-t"><span>${name}<i>${w}%</i></span><b>${v.sub}</b></div>
      <div class="bd-bar"><span style="width:${v.sub}%;background:${segColor(v.sub)}"></span><em style="left:70%"></em></div></div>`;}).join("");
  const keepScroll=$("sheet").scrollTop;
  openSheet(`<div class="sh-top"><h2>Readiness</h2>${X}</div>
    <div class="sh-big" style="color:${segColor(day.score)}">${day.score}<small>${esc(day.band)}</small></div>
    <p class="sh-desc">${esc(day.advice)} ${esc(day.why)}</p>
    <div class="range"><button data-n="7" class="${n===7?"on":""}">7 days</button><button data-n="30" class="${n===30?"on":""}">30 days</button></div>
    ${scoreChart(n)}
    <h3 class="sh-h3">What makes up the score</h3>
    <p class="sh-note">Each signal scored against your own history. 70, the tick on each bar, is a normal day for you.</p>
    ${rows}
    ${day.mod?`<div class="bd-adj"><span>Morning check-in</span><b>${day.mod>0?"+":""}${day.mod}</b></div>`:""}
    ${day.alarm?`<p class="sh-note warn">An early-warning pattern (low HRV with high sleeping heart rate, or a jump in breathing rate): the score is capped at 49.</p>`:""}
    ${day.legacy!=null&&day.model==="garmin"?`<div class="bd-adj"><span>Previous model (Intervals summaries)</span><b>${day.legacy}</b></div>`:""}
    <h3 class="sh-h3">How it works</h3>
    <p class="sh-note">Signals are combined with the weights shown, then scaled on the last ${DATA.calibration.n} days of your data so that a typical day lands around 70 and only your best few days reach 95 and above. Bands: 0–49 very low, 50–59 low, 60–79 normal, 80–100 super.${day.model==="garmin"?" Computed by our own model on raw Garmin data: HRV readings, all-night heart rate, breathing and sleep stages.":""}</p>`);
  if(keep) $("sheet").scrollTop=keepScroll;
  $("sheet").querySelectorAll(".range button").forEach(b=>b.onclick=()=>openScore(+b.dataset.n));
  $("sheet").querySelectorAll("rect[data-si]").forEach(r=>r.onclick=()=>{scorePick=+r.dataset.si; openScore(n,true);});
}

/* ------------------------------------------------------------ signals */
const SIG={
  hrv:{name:"HRV",unit:"ms",fmt:v=>Math.round(v),weight:"40%",
    desc:"Heart rate variability overnight: the median of the watch's 5-minute readings across the night, which ignores restless moments. The score uses its 7-day trend against your last 60 days. Higher than your normal usually means good recovery; a drop that lasts several days points to fatigue, stress or illness.",
    status:c=>c.value<c.lo?[c.lo-c.value<1?"Just below normal":`${Math.round(c.lo-c.value)} ms below normal`,"var(--amber)"]:c.value>c.hi?[c.value-c.hi<1?"Just above normal":`${Math.round(c.value-c.hi)} ms above normal`,"var(--alpine)"]:["Within normal","var(--muted)"]},
  rhr:{name:"Sleeping HR",unit:"bpm",fmt:v=>Math.round(v),weight:"20%",
    desc:"Your lowest 30 minutes of heart rate during sleep, from the watch's all-night heart rate. A rise of 3–5 bpm over your normal often shows up with accumulated fatigue or a cold coming on.",
    status:c=>c.value>c.hi?[`${Math.max(1,Math.round(c.value-c.base))} bpm above average`,"var(--amber)"]:c.value<c.lo?["Below normal","var(--alpine)"]:["Within normal","var(--muted)"]},
  resp:{name:"Breathing rate",unit:"/min",fmt:v=>(Math.round(v*10)/10).toFixed(1),weight:"10%",
    desc:"Average breaths per minute during sleep. It is remarkably stable night to night, so a rise of one breath or more over your normal is one of the earliest signs of illness. It can only lower the score, never raise it.",
    status:c=>c.value>c.hi?[`${(c.value-c.base).toFixed(1)} above your normal`,"var(--amber)"]:["Within normal","var(--muted)"]},
  sleep:{name:"Sleep",unit:"h",fmt:v=>hm(v),weight:"15%",
    desc:"Time asleep last night against your own need. In the recovery score it counts through the Sleep score, which also weighs efficiency, deep and REM sleep, awakenings and how regular your timing is.",
    status:c=>c.value<c.lo?[`Below your minimum of ${hmh(c.lo)}`,"var(--amber)"]:c.value<c.hi?[`${hmh(c.hi-c.value)} under your usual`,"var(--muted)"]:["At or above your usual","var(--muted)"]},
  load:{name:"Training load",unit:"%",fmt:v=>(v>0?"+":"")+Math.round(v),weight:"15%",
    desc:"Form: fitness minus fatigue as a share of fitness, from yesterday's numbers. Between −10% and −30% you are training productively; below −30% fatigue is piling up.",
    status:c=>c.value< -30?["Heavy fatigue","var(--rose)"]:c.value< -10?["Productive training","var(--muted)"]:["Fresh","var(--alpine)"]},
};
function series(key,n){
  return DATA.days.slice(Math.max(0,sel-n+1),sel+1).map(d=>({date:d.date,c:d.comp?.[key]||null}));
}
function spark(key){
  const s=series(key,14),vals=s.filter(x=>x.c).map(x=>x.c.value);
  if(vals.length<2) return "";
  const last=s[s.length-1].c||{},lo=Math.min(...vals,last.lo??Infinity),hi=Math.max(...vals,last.hi??-Infinity);
  const pad=(hi-lo)*.15||1,y=v=>34-((v-(lo-pad))/((hi+pad)-(lo-pad)))*34,x=i=>i*(92/(s.length-1));
  const pts=s.map((p,i)=>p.c?`${x(i).toFixed(1)},${y(p.c.value).toFixed(1)}`:null).filter(Boolean);
  const band=last.lo!=null?`<rect x="0" y="${y(last.hi)}" width="92" height="${Math.max(1,y(last.lo)-y(last.hi))}" fill="var(--text)" opacity=".06"/>`:"";
  const [lx,ly]=pts[pts.length-1].split(",");
  return `<svg viewBox="0 0 92 34" preserveAspectRatio="none" aria-hidden="true">${band}
    <polyline points="${pts.join(" ")}" fill="none" stroke="var(--muted)" stroke-width="1.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${lx}" cy="${ly}" r="2.6" fill="var(--text)"/></svg>`;
}
const wPct=k=>DATA.weights&&DATA.weights[k]!=null?Math.round(DATA.weights[k]*100)+"%":SIG[k].weight;
const SIG_KEYS=()=>["hrv","rhr","resp","sleep","load"].filter(k=>!DATA.weights||DATA.weights[k]!=null);
function signalRow(key,c){
  const m=SIG[key];
  if(!c) return `<button class="sig" disabled><div><div class="n">${m.name}</div><div class="s">No valid data</div></div><span></span><div class="v">–</div></button>`;
  const [st,col]=m.status(c);
  return `<button class="sig" data-sig="${key}"><div><div class="n">${m.name}</div><div class="s"><i style="background:${col}"></i>${esc(st)}</div></div>
    ${spark(key)}<div class="v">${m.fmt(c.value)}<small>${key==="sleep"?"":m.unit}</small></div></button>`;
}

