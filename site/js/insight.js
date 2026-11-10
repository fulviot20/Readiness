"use strict";
/* ------------------------------------------------------------ morning insight (roadmap 10) */
// One or two sentences on Today that connect what the numbers don't say by themselves: which signal moved the score,
// the likely reason (yesterday's journal, training, sleep) and what it means for today's session.
// Written by the AI once a day with your own key (one request), kept and shared between your devices.
const insightGet=()=>{const o=lsJSON("rd_insight",null);return o&&o.date===todayISO()&&o.text?o:null;};
function insightFacts(){
  const t=todayISO(),i=DATA.days.findIndex(d=>d.date===t),raw=DATA.days[i],day=applyAnswers(raw,raw.answers),c=day.comp||{};
  const prev=DATA.days.slice(0,i).reverse().find(d=>d.score!=null),y=DATA.days[i-1]||{},J=jAll(),lab=id=>jTags().find(x=>x.id===id)?.label||id;
  const sig={};
  for(const k of Object.keys(c)){const v=c[k];if(v?.value==null) continue;
    sig[k]={value:Math.round(v.value*10)/10,normal_low:v.lo??null,normal_high:v.hi??null,reading:k==="load"||v.lo!=null?CLS_TXT[sigClass(k,v.value,v)]:null};}
  const ss=raw.sleep_score||{},plan=(raw.plan||[]).filter(p=>!p.done);
  return {score:day.score,band:day.band,change_vs_yesterday:prev?day.score-prev.score:null,early_warning:!!day.alarm,
    signals:sig,sleep:{hours:ss.hours??c.sleep?.value??null,score:ss.score??null,need_hours:ss.need??null,debt_hours_last_nights:ss.debt??null},
    check_in:raw.answers?{rested:raw.answers.sleep??null,body:raw.answers.feel??null,ill:!!raw.answers.sick}:null,
    yesterday:{training:(y.workouts||[]).filter(w=>w.type).map(w=>({name:w.name,type:w.type,minutes:w.minutes,load:w.load??null,feel:w.feel?FEEL[w.feel]:null})),
      strain:y.strain?.score??null,journal:J[y.date]?(J[y.date].tags||[]).map(lab):null},
    last_scores:DATA.days.slice(Math.max(0,i-4),i).map(d=>d.score??null),
    today_plan:plan.map(p=>{const a=adaptPlan(p,day.band,day.alarm);return {name:p.name,type:p.type,minutes:p.minutes,load:p.load??null,race:!!p.race,short_version:a?a.short.txt:null};}),
    tomorrow_plan:((DATA.upcoming||{})[isoAdd(t,1)]||[]).map(p=>({name:p.name,minutes:p.minutes,load:p.load??null}))};
}
function insightCard(){
  if(!aiKey()) return "";
  const o=insightGet();
  return `<div class="ins" id="ins">${SPARK}<p id="ins-t">${o?esc(o.text):`<span class="ins-w">Reading your morning…</span>`}</p></div>`;
}
let INS_BUSY=false,INS_FAIL=0;
async function insightRun(){
  const t=todayISO(),raw=DATA.days.find(d=>d.date===t);
  if(INS_BUSY||!aiKey()||!raw||raw.score==null||insightGet()||Date.now()-INS_FAIL<15*60000) return;
  INS_BUSY=true;
  try{
    const {json}=await aiCall([{role:"user",parts:[{text:`You are the recovery coach inside an endurance athlete's own training app (a cyclist who also runs). Write this morning's insight.
ONE or TWO short sentences, 40 words at most, in English, addressed to him ("you").
Connect the most telling facts into something he could not read off a single number: which signal moved the score and the likely reason (yesterday's training, journal habits, the night), and what that means for today's session.
Rules: be specific and calm; use a number only when it helps; never alarmist; never tell him to skip or cut training: the score accompanies, he decides (you may say to see how the legs respond, or mention the short version as an option); if everything is normal say so plainly and point at what makes today a good day for the plan; no greeting, no emoji, don't just restate the score.
Facts (JSON): ${JSON.stringify(insightFacts())}
Reply with JSON only: {"text":"..."}`}]}],25000);
    const text=String(json?.text||"").trim().slice(0,320);
    if(!text) throw new Error("empty");
    syncSet("rd_insight",{date:t,text});
    const el=$("ins-t"); if(el) el.textContent=text;
  }catch(e){ INS_FAIL=Date.now(); const c=$("ins"); if(c) c.remove(); }
  INS_BUSY=false;
}

/* ------------------------------------------------------------ today's session, two ways (roadmap 11) */
// A proposal, never an order: the planned session as it is, and a shorter version worked out from its own structure.
// Intervals lose about a quarter of the repetitions (at least one); steady sessions lose a quarter of the time.
// On a very low day, or with an early warning, the short version becomes easy endurance. Which one is suggested
// follows the score band; the choice stays yours.
function planShape(p){
  const st=(p.steps||[]).filter(s=>s.min>0),groups={};
  st.forEach((s,i)=>{if(s.hi>=88){const k=s.min+"@"+s.lo+"-"+s.hi;(groups[k]=groups[k]||[]).push(i);}});
  const main=Object.values(groups).sort((a,b)=>b.length*st[b[0]].min-a.length*st[a[0]].min)[0];
  if(!main||main.length<2) return null;
  const w=st[main[0]],nx=st[main[0]+1],rest=nx&&nx.hi<88?nx.min:0;
  return {n:main.length,w:w.min,r:rest,lo:w.lo,hi:w.hi};
}
const minTxt=m=>m>=1?`${Math.round(m*10)/10} min`:`${Math.round(m*60)} s`;
function adaptPlan(p,band,alarm){
  const tot=p.minutes; if(!tot||tot<20||p.race) return null;
  const sh=planShape(p),veryLow=band==="Very low"||!!alarm,r5m=m=>Math.max(20,Math.round(m/5)*5);
  const pct=sh?(sh.lo===sh.hi?`${sh.hi}%`:`${sh.lo}–${sh.hi}%`):"";
  const full={txt:sh?`${sh.n}×${minTxt(sh.w)} at ${pct}, as planned`:"As planned",min:tot};
  let short;
  if(veryLow) short={txt:`Easy ${/Run/.test(p.type||"")?"jog":"endurance"}, no efforts`,min:r5m(Math.min(60,tot*.6))};
  else if(sh){const drop=Math.max(1,Math.round(sh.n*.25)),n2=sh.n-drop;
    short=n2>=1?{txt:`${n2}×${minTxt(sh.w)} instead of ${sh.n}, same targets`,min:Math.round(tot-drop*(sh.w+sh.r))}
      :{txt:"Easy endurance, no efforts",min:r5m(tot*.6)};}
  else short={txt:"Same session, a quarter shorter",min:r5m(tot*.75)};
  const pick=veryLow?"short":band==="Low"?null:"full";
  const hint={"Super":"Recovery is above your usual: the full session fits, and the upper end of the targets if the legs agree.",
    "Normal":"A normal day for you: the full session fits.",
    "Low":"Start as planned and let the warm-up decide: if the legs feel heavy, the short version keeps the quality.",
    "Very low":"Several signals are down: the short version is the gentle option. If you feel fine, the full one is still yours to do."}[alarm?"Very low":band]||"";
  return {full,short,pick,hint};
}
function adaptCard(p,band,alarm){
  const a=adaptPlan(p,band,alarm); if(!a) return "";
  const opt=(k,name,o)=>`<div class="ad-o${a.pick===k?" on":""}"><b>${name}${a.pick===k?"<i>fits today</i>":""}</b><span>${esc(o.txt)} · ${dur(o.min)}</span></div>`;
  return `<div class="adapt"><div class="ad-h"><b>Two ways to do it</b><span>your call</span></div>${opt("full","Full",a.full)}${opt("short","Short",a.short)}<p>${esc(a.hint)}</p></div>`;
}
