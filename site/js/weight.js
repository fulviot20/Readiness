"use strict";
/* ------------------------------------------------------------ athlete: weight, one page for the whole system */
// Weigh in, choose lose / maintain / gain, read what's happening and what to change on the plate.
// The scale trend is the truth: no food weighing. The plan gives the portions, the check-offs say whether it was
// followed, and once a week the trend corrects the range (and so the portions) by itself.
let WMODE=null;      // mode being edited before saving (null = the saved one)
function wTrendNow(){const W=weightTrend();return W.ok?W.at(todayISO()):weightNow();}
function wMode(){const gs=goalState();return !gs||!gs.dir?"keep":gs.dir<0?"lose":"gain";}
function wChart(){
  const t=todayISO(),lim=isoAdd(t,-56),s=athSeries("weight").filter(p=>p.date>=lim);if(s.length<2) return "";
  const W=320,H=120,t0=+new Date(lim+"T12:00"),t1=+new Date(t+"T12:00"),g=goalGet(),T=weightTrend();
  const vals=s.map(p=>p.v);let lo=Math.min(...vals),hi=Math.max(...vals);const pad=Math.max(.4,(hi-lo)*.2);lo-=pad;hi+=pad;
  const x=d=>4+(+new Date(d+"T12:00")-t0)/(t1-t0)*(W-8),y=v=>6+(hi-v)/(hi-lo)*(H-12);
  const tl=T.ok?`<line x1="${x(T.from).toFixed(1)}" y1="${y(T.at(T.from)).toFixed(1)}" x2="${x(t).toFixed(1)}" y2="${y(T.at(t)).toFixed(1)}" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round"/>`:"";
  const gl=g&&g.target>lo&&g.target<hi?`<line x1="0" x2="${W}" y1="${y(g.target).toFixed(1)}" y2="${y(g.target).toFixed(1)}" stroke="#5fc795" stroke-dasharray="4 4" opacity=".7"/>`:"";
  return `<svg viewBox="0 0 ${W} ${H}" class="wt-svg" preserveAspectRatio="none">${gl}${s.map(p=>`<circle cx="${x(p.date).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3" fill="var(--muted)" opacity=".8"/>`).join("")}${tl}</svg>
    <div class="ax"><span>${fmtDay(lim,{day:"numeric",month:"short"})}</span><span>dots: weigh-ins · line: trend${gl?" · green: goal":""}</span><span>today</span></div>`;
}
function weightView(){
  const t=todayISO(),last=athLast("weight"),tn=wTrendNow(),W=weightTrend(),B=trimBand(),Tr=trimGet(),gs=goalState();
  const mode=WMODE||wMode(),g=goalGet(),kgw=v=>`${v>0?"+":v<0?"−":"±"}${Math.abs(v).toFixed(2)} kg/week`;
  const loggedToday=last&&last.date===t;
  // what is happening, in one or two sentences
  let st;
  if(!W.ok) st=`<b>Getting started.</b> ${W.n} of 4 weigh-ins in the last three weeks${W.span?`, over ${Math.round(W.span)} days`:""}: with 4 weigh-ins spread over at least two weeks the trend is reliable and the range starts correcting itself.`;
  else{
    const want=B.want,diff=W.slope-want,on=W.slope>=B.lo&&W.slope<=B.hi;
    st=`<b>${kgw(W.slope)}</b>${want?` against the ${kgw(want)} you chose`:""}. `+
      (Tr.held==="more"?"You ate over the plan on several days: the range stays, coming back inside the plan is enough.":
       Tr.held==="less"?"You ate under the plan on several days: eat the full plan, the range stays.":
       on?"On course: change nothing.":
       diff>0?(want<0?"Losing slower than planned":"Gaining")+(Tr.step<0?": the range has been lowered.":": the range will be lowered at the next weekly check."):
       (want>0?"Gaining slower than planned":"Losing faster than planned")+(Tr.step>0?": the range has been raised.":": the range will be raised at the next weekly check."));
  }
  const sh=Tr.step&&Tr.at>=isoAdd(t,-10)?planShift(Tr.step):[];
  const next=Tr.at?isoAdd(Tr.at,7):null;
  const R=dayTypeTargets(),rng=k=>R[k]?`${fmtK(R[k]-100)}–${fmtK(R[k]+100)}`:"–";
  return `<section class="sec first">
    <div class="card wt-hero">
      <div class="wt-top"><div><small>WEIGHT · TREND</small><b>${tn!=null?tn.toFixed(1):"–"}<u>kg</u></b>
        <span>${last?`last weigh-in ${last.v.toFixed(1)} kg · ${last.date===t?"today":fmtDay(last.date,{weekday:"short",day:"numeric",month:"short"})}`:"No weigh-ins yet"}</span></div>
        ${g&&gs&&gs.dir?`<div class="wt-goal"><small>GOAL</small><b>${g.target.toFixed(1)}</b><span>${gs.eta?`around ${fmtDay(gs.eta,{day:"numeric",month:"short"})}`:""}</span></div>`:""}</div>
      ${wChart()}
      <div class="wt-log"><input id="wt-v" type="number" inputmode="decimal" step="0.1" min="30" max="200" placeholder="${last?last.v.toFixed(1):"kg"}" value="${loggedToday?last.v.toFixed(1):""}" aria-label="Today's weight in kg">
        <button class="btn" id="wt-save">${loggedToday?"Update today":"Log today"}</button></div>
      <p class="wt-tip">Morning, after the bathroom, before breakfast, 3–4 times a week. Day-to-day swings of 1 kg are water: only the trend counts.</p>
    </div></section>
  <section class="sec"><div class="sec-h"><h2>What's happening</h2>${next?`<span>Next check ${fmtDay(next,{weekday:"short",day:"numeric"})}</span>`:""}</div>
    <div class="card wt-st"><p>${st}</p>
      ${sh.length?`<p class="wt-sh2">${Tr.step>0?"More":"Less"} on the plate from now: ${sh.slice(0,4).map(x=>`<b>${esc(x.name)} ${x.a} → ${x.b} g</b>`).join(" · ")}</p>`:""}
      ${Tr.v?`<p class="wt-n">Range adjusted by the scale so far: ${Tr.v>0?"+":"−"}${fmtK(Math.abs(Tr.v))} kcal a day.</p>`:""}</div></section>
  <section class="sec"><div class="sec-h"><h2>Your aim</h2><span>Change it any time</span></div>
    <div class="seg three" id="wt-m">${[["lose","Lose"],["keep","Maintain"],["gain","Gain"]].map(([k,n])=>`<button data-wm="${k}" class="${mode===k?"on":""}"><b>${n}</b></button>`).join("")}</div>
    ${mode!=="keep"?`<div class="wt-aim">
      <div class="field"><label for="wt-t">Target (kg)</label><input id="wt-t" type="number" inputmode="decimal" step="0.5" value="${g&&gs&&gs.dir===(mode==="lose"?-1:1)?g.target:tn!=null?(mode==="lose"?Math.round(tn-2):Math.round(tn+2)):""}"></div>
      <div class="field"><label>Pace, kg a week</label><div class="chips" id="wt-p">${[.25,.5,.75].map(p=>`<button data-p="${p}" class="${(g?.pace||.25)===p?"on":""}">${p}</button>`).join("")}</div></div></div>
      <p class="wt-n">${mode==="lose"?"0.25 a week is about 1 kg a month: the pace that keeps sessions strong. Faster costs power and recovery.":"0.25 a week keeps the gain mostly useful weight."}</p>`:
      `<p class="wt-n">Eat for what you burn: the range follows your training, and the scale keeps it honest.</p>`}
    ${WMODE&&WMODE!==wMode()||mode!=="keep"?`<button class="btn" id="wt-aim" style="width:100%;margin-top:12px">Save aim</button>`:""}</section>
  <section class="sec"><div class="sec-h"><h2>At the table</h2><span>kcal a day</span></div>
    <div class="wt-r">${[["rest","Rest"],["train","Training"],["long","Long ride"]].map(([k,n])=>`<div><small>${n.toUpperCase()}</small><b>${rng(k)}</b></div>`).join("")}</div>
    <button class="lib-c" id="wt-plan"><span><b>${planGet()?"Your plan, with the portions for this":"Build your plan"}</b><small>One tap per meal in the Diary, no weighing</small></span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button></section>
  <p class="foot">The ranges come from what you burn on each kind of day (Garmin, corrected by your scale), plus your aim.</p>`;
}
function bindWeight(){
  const on=(id,f)=>{const e=$(id);if(e) e.onclick=f;};
  on("wt-save",async()=>{const v=+String($("wt-v").value).replace(",",".");if(!(v>=30&&v<=200)) return toast("Enter your weight in kg");
    await logMetric("weight",todayISO(),r1(v));ATH_CACHE=null;try{trimCheck();}catch(e){}buzz(12);toast(`${r1(v).toFixed(1)} kg saved`);const y=scrollY;render();scrollTo(0,y);});
  document.querySelectorAll("[data-wm]").forEach(b=>b.onclick=()=>{WMODE=b.dataset.wm;buzz(5);const y=scrollY;render();scrollTo(0,y);});
  document.querySelectorAll("#wt-p [data-p]").forEach(b=>b.onclick=()=>{document.querySelectorAll("#wt-p [data-p]").forEach(x=>x.classList.toggle("on",x===b));buzz(4);});
  on("wt-aim",()=>{
    const mode=WMODE||wMode(),tn=wTrendNow(),g=goalGet();
    let target,pace=+(document.querySelector("#wt-p .on")?.dataset.p||.25);
    if(mode==="keep"){if(tn==null) return toast("Log your weight first");target=r1(tn);pace=.25;}
    else{target=r1(+String($("wt-t").value).replace(",","."));
      if(!(target>=35&&target<=200)) return toast("Check the target");
      if(tn!=null&&(mode==="lose"?target>=tn-.3:target<=tn+.3)) return toast(mode==="lose"?"The target should be below your weight":"The target should be above your weight");}
    const obj={target,pace,start:g&&g.target===target?g.start:weightNow(),since:g&&g.target===target?g.since:todayISO(),ts:Date.now()};
    LS.set("rd_goal",JSON.stringify(obj));sendQ("goal",obj);CAL=null;WMODE=null;buzz(12);toast("Aim saved");const y=scrollY;render();scrollTo(0,y);});
  on("wt-plan",()=>setPage("athlete","plan"));
}
