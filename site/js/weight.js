"use strict";
/* ------------------------------------------------------------ athlete: weight sheet (log, trend, aim) */
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
// What is happening, in one or two sentences, with the change on the plate when there is one
function wStatusHTML(){
  const t=todayISO(),tn=wTrendNow(),W=weightTrend(),B=trimBand(),Tr=trimGet(),kgw=v=>`${v>0?"+":v<0?"−":"±"}${Math.abs(v).toFixed(2)} kg/week`;
  let st;
  if(!W.ok) st=`<b>Getting started.</b> ${W.n} of 4 weigh-ins in the last three weeks${W.span?`, over ${Math.round(W.span)} days`:""}: with 4 weigh-ins over at least two weeks the trend is reliable and the portions start correcting themselves.`;
  else{
    const want=B.want,diff=W.slope-want,on=W.slope>=B.lo&&W.slope<=B.hi;
    st=`Trend <b>${tn.toFixed(1)} kg</b>, <b>${kgw(W.slope)}</b>${want?` against the ${kgw(want)} you chose`:""}. `+
      (Tr.held==="more"?"You ate over the plan on several days: the portions stay, coming back to the plan is enough.":
       Tr.held==="less"?"You ate under the plan on several days: eat the full plan.":
       on?"On course: change nothing.":
       diff>0?(want<0?"Losing slower than planned":"Gaining")+(Tr.step<0?": the portions have been reduced.":": the portions shrink at the next weekly check."):
       (want>0?"Gaining slower than planned":"Losing faster than planned")+(Tr.step>0?": the portions have been increased.":": the portions grow at the next weekly check."));
  }
  const sh=Tr.step&&Tr.at>=isoAdd(t,-10)?planShift(Tr.step):[],next=Tr.at?isoAdd(Tr.at,7):null;
  return `<div class="card wt-st"><p>${st}</p>
    ${sh.length?`<p class="wt-sh2">${Tr.step>0?"More":"Less"} on the plate from now: ${sh.slice(0,4).map(x=>`<b>${esc(x.name)} ${x.a} → ${x.b} g</b>`).join(" · ")}</p>`:""}
    ${next?`<p class="wt-n">Next check ${fmtDay(next,{weekday:"short",day:"numeric",month:"short"})}.</p>`:""}</div>`;
}
function wAimHTML(){
  const mode=WMODE||wMode(),g=goalGet(),gs=goalState(),tn=wTrendNow();
  return `<h3 class="sh-sub">Your aim</h3>
    <div class="seg three" id="wt-m">${[["lose","Lose"],["keep","Maintain"],["gain","Gain"]].map(([k,n])=>`<button data-wm="${k}" class="${mode===k?"on":""}"><b>${n}</b></button>`).join("")}</div>
    ${mode!=="keep"?`<div class="wt-aim">
      <div class="field"><label for="wt-t">Target (kg)</label><input id="wt-t" type="number" inputmode="decimal" step="0.5" value="${g&&gs&&gs.dir===(mode==="lose"?-1:1)?g.target:tn!=null?(mode==="lose"?Math.round(tn-2):Math.round(tn+2)):""}"></div>
      <div class="field"><label>Pace, kg a week</label><div class="chips" id="wt-p">${[.25,.5,.75].map(p=>`<button data-p="${p}" class="${(g?.pace||.25)===p?"on":""}">${p}</button>`).join("")}</div></div></div>
      <p class="wt-n">${mode==="lose"?`0.25 a week is about 1 kg a month: the pace that keeps sessions strong.${gs&&gs.dir<0&&gs.eta?` At this pace: around ${fmtDay(gs.eta,{day:"numeric",month:"long"})}.`:""}`:"0.25 a week keeps the gain mostly useful weight."}</p>`:
      `<p class="wt-n">Eat for what you burn: the plan follows your training, the scale keeps it honest.</p>`}
    ${mode!=="keep"||mode!==wMode()?`<button class="btn" id="wt-aim" style="width:100%;margin-top:12px">Save aim</button>`:""}`;
}
function bindWAim(redraw){
  document.querySelectorAll("[data-wm]").forEach(b=>b.onclick=()=>{WMODE=b.dataset.wm;buzz(5);redraw();});
  document.querySelectorAll("#wt-p [data-p]").forEach(b=>b.onclick=()=>{document.querySelectorAll("#wt-p [data-p]").forEach(x=>x.classList.toggle("on",x===b));buzz(4);});
  const sv=$("wt-aim");if(!sv) return;
  sv.onclick=()=>{
    const mode=WMODE||wMode(),tn=wTrendNow(),g=goalGet();
    let target,pace=+(document.querySelector("#wt-p .on")?.dataset.p||.25);
    if(mode==="keep"){if(tn==null) return toast("Log your weight first");target=r1(tn);pace=.25;}
    else{target=r1(+String($("wt-t").value).replace(",","."));
      if(!(target>=35&&target<=200)) return toast("Check the target");
      if(tn!=null&&(mode==="lose"?target>=tn-.3:target<=tn+.3)) return toast(mode==="lose"?"The target should be below your weight":"The target should be above your weight");}
    const obj={target,pace,start:g&&g.target===target?g.start:weightNow(),since:g&&g.target===target?g.since:todayISO(),ts:Date.now()};
    LS.set("rd_goal",JSON.stringify(obj));sendQ("goal",obj);CAL=null;WMODE=null;buzz(12);toast("Aim saved");redraw();render();};
}
