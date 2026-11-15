"use strict";
/* ------------------------------------------------------------ fuelling and recovery (mirrors fuel.py) */
// The server works out, for every finished and planned session, the energy spent and the share of it that came from
// carbohydrate (power zones, duration; see fuel.py for the physiology and the references). From those two numbers:
//   burned  = energy × share (the share rises a little with what you take while riding)
//   to take = a rate per hour that follows the session's demands, inside the published ranges for its duration
//   after   = burned − taken is the hole left in your glycogen; how fast to refill it depends on what comes next.
// What you took on a ride: the grams recorded on Intervals, else what you set in the app (rd_fuelg), else the planned
// amount. If the session turns out longer or harder than planned, the difference goes into recovery.
const FUEL_DEF={on:true,max:90,since:"2026-11-10"};
const fuelCfg=()=>({...FUEL_DEF,...(lsJSON("rd_fuel",null)||{})});
const isRide=w=>/Ride/.test(w?.type||"");
const durTxt=m=>m<60?`${Math.round(m)} min`:`${Math.floor(m/60)}h${String(Math.round(m%60)).padStart(2,"0")}`;
const startMs=(date,hhmm)=>new Date(`${date}T${hhmm||"12:00"}`).getTime();
const r5=v=>Math.round(v/5)*5;
const FUEL_INTAKE=0.0005/0.30;
function fuelUsed(f,intake=0){const rate=f.min?intake/(f.min/60):0;return f.kcal*clip(f.frac+FUEL_INTAKE*rate,.15,1)/4;}
// On the bike: 70% of what the session burns per hour (before the fall that comes with duration), 10% more for every
// hour beyond the second, never under 40 g/h, never over your ceiling. Other sports: the classic duration tiers.
function fuelRate(f,max,ride=true){
  const m=f.min;
  if(ride){ if(m<40) return 0;
    const burn=f.kcal*(f.frac0??f.frac)/4/(m/60);
    return r5(Math.min(max,Math.max(40,.7*burn*(1+.1*Math.max(0,m/60-2))))); }
  if(m<75) return 0;
  const [lo,hi]=m<150?[30,60]:[50,90];
  return r5(Math.min(max,hi,Math.max(lo,.55*fuelUsed(f)/(m/60))));
}
function fuelRecovery(used,intake,kg,soon,extra=0){
  const deficit=Math.max(0,used-intake),fast=soon||extra>=.3*kg,cap=(fast?1.2:.8)*kg;
  const carbs=deficit<.25*kg?0:Math.min(deficit,cap);
  let more=fast&&carbs?Math.min(deficit-carbs,kg):0; if(more<.25*kg) more=0;
  return {deficit:Math.round(deficit),carbs:r5(carbs),more:r5(more),protein:Math.round(.3*kg),fast,window:fast?"within the hour":"in your next meal"};
}
// the unplanned part of the hole: what is left to refill now, minus what the plan expected to leave
const fuelExtra=(used,intake,plan)=>plan?Math.max(0,used-intake)-plan.deficit:0;
const planOf=(date,w)=>(dayOf(date)?.plan||[]).find(p=>p.done_id&&p.done_id===w.id&&p.fuel)||null;
function fuelPlanned(p){            // what a planned session asks for
  const rate=fuelRate(p.fuel,fuelCfg().max,isRide(p)),intake=rate*p.fuel.min/60,used=fuelUsed(p.fuel,intake);
  return {rate,intake:r5(intake),used,deficit:Math.max(0,used-intake)};
}
// what you took during a finished session, and how we know
const fuelSet=()=>lsJSON("rd_fuelg",{});
function fuelIntake(w,date){
  const own=fuelSet()[w.id];
  if(own!=null) return {g:own,src:"set by you",own:true};
  if(w.carbs_in>0) return {g:Math.round(w.carbs_in),src:"recorded on Intervals"};
  if(!isRide(w)||!w.fuel) return {g:0,src:"nothing recorded"};
  const p=planOf(date,w);
  if(p){const q=fuelPlanned(p);return {g:q.intake,src:q.rate?`as planned, ${q.rate} g/h`:"nothing planned",guess:true};}
  const rate=fuelRate(w.fuel,fuelCfg().max);
  return {g:r5(rate*w.fuel.min/60),src:rate?`suggested ${rate} g/h`:"short ride",guess:true};
}
// is another demanding session close enough that refilling fast matters?
function fuelSoon(date,w){
  const day=dayOf(date),big=p=>(p.load||0)>=70||(p.minutes||0)>=90;
  return (day?.plan||[]).some(p=>!p.done&&big(p))||((DATA.upcoming||{})[isoAdd(date,1)]||[]).some(big)
    ||(dayOf(isoAdd(date,1))?.workouts||[]).some(x=>(x.load||0)>=70||(x.minutes||0)>=90);
}
function fuelDone(w,date){
  if(!w.fuel) return null;
  const it=fuelIntake(w,date),used=fuelUsed(w.fuel,it.g),p=planOf(date,w),plan=p?fuelPlanned(p):null,soon=fuelSoon(date,w);
  const rec=fuelRecovery(used,it.g,weightNow()||70,soon,fuelExtra(used,it.g,plan));
  const extra=plan?r5(rec.deficit-plan.deficit):null;
  let why="";
  if(plan&&Math.abs(extra)>=15){const dm=w.fuel.min-p.fuel.min,dk=w.fuel.kcal/w.fuel.min-p.fuel.kcal/p.fuel.min;
    why=extra>0?(dm>=10?"the session ran longer than planned":dk>0?"it was harder than planned":"you took less than planned")
               :(dm<=-10?"the session was shorter than planned":dk<0?"it was easier than planned":"you took more than planned");}
  return {w,used:Math.round(used),it,plan,p,rec,extra,why,soon};
}
const fuelHow=f=>({"power zones":"your power in each zone","average power":"your average power","heart rate":"heart rate and Garmin's calories"})[f.how]||"the plan";
function fuelBreakdown(w,date,intake){
  const d=fuelDone(w,date); if(!d) return "";
  const g=intake??d.it.g,used=Math.round(fuelUsed(w.fuel,g)),rec=fuelRecovery(used,g,weightNow()||70,d.soon,fuelExtra(used,g,d.plan));
  const extra=d.plan?r5(rec.deficit-d.plan.deficit):null;
  return `<div class="kv"><span>Burned · from ${fuelHow(w.fuel)}</span><b>≈ ${r5(used)} g</b>
      <span>Taken while riding</span><b>${Math.round(g)} g</b>
      <span>Left to refill</span><b>≈ ${r5(rec.deficit)} g</b>
      ${d.plan?`<span>Planned to refill</span><b>≈ ${r5(d.plan.deficit)} g</b>`:""}</div>
    <p class="sh-note">${rec.carbs?`<b>After: about ${rec.carbs} g of carbs and ${rec.protein} g of protein ${rec.window}${rec.more?`, then another ${rec.more} g of carbs in the two hours after`:""}.</b>${d.soon?" Another demanding session is close, so refilling quickly matters.":rec.fast?" The session took more than the plan foresaw, so the difference is refilled straight away.":" Nothing demanding is close, so timing matters little."}`
      :"<b>After: a normal meal is enough.</b> What you took covered almost all of it."}
      ${extra!=null&&Math.abs(extra)>=15?` That is ${Math.abs(extra)} g ${extra>0?"more":"less"} to refill than planned.`:""}
      ${rec.deficit>rec.carbs+rec.more+20?` The other ${r5(rec.deficit-rec.carbs-rec.more)} g come back with your normal meals over the day.`:""}</p>`;
}
// correct what you took on a ride (when it isn't recorded on Intervals, or was wrong): the recovery follows
function openFuelTaken(wid,date){
  const w=(dayOf(date)?.workouts||[]).find(x=>String(x.id)===String(wid));if(!w||!w.fuel) return;
  const it=fuelIntake(w,date);
  openSheet(`<div class="sh-top"><h2>Carbs on the bike</h2>${X}</div>
    <p class="sh-desc">What you took during <b>${esc(w.name||"your ride")}</b> (${durTxt(w.minutes||w.fuel.min)}): ${esc(it.src)}. Correct it if it went differently: the recovery below follows.</p>
    <div class="field"><label for="fu-c">Carbs taken (g)</label><input id="fu-c" type="number" inputmode="numeric" min="0" max="900" step="5" value="${Math.round(it.g)}"><p id="fu-k"></p></div>
    <div id="fu-b"></div>
    <div class="savebar" style="margin-top:18px">${it.own?`<button class="btn quiet" id="fu-del">Back to automatic</button>`:"<span></span>"}<button class="btn" id="fu-save">Save</button></div>
    <button class="pl-q" id="fu-set" style="margin-top:14px">How this is worked out →</button>`);
  const inp=$("fu-c"),upd=()=>{const c=+inp.value||0;$("fu-k").textContent=`${w.minutes?`${Math.round(c/(w.minutes/60))} g/h`:""}`;$("fu-b").innerHTML=fuelBreakdown(w,date,c);};
  inp.oninput=upd; upd();
  const put=v=>{const S={...fuelSet()};if(v==null) delete S[w.id]; else S[w.id]=v;
    const keep=new Set((DATA.days||[]).flatMap(d=>(d.workouts||[]).map(x=>String(x.id))));for(const k of Object.keys(S)) if(!keep.has(String(k))) delete S[k];
    syncSet("rd_fuelg",S);buzz();closeSheet();render();};
  $("fu-save").onclick=()=>{put(clip(Math.round(+inp.value||0),0,900));toast("Saved");};
  const del=$("fu-del");if(del) del.onclick=()=>{put(null);toast("Back to automatic");};
  $("fu-set").onclick=openFuelSettings;
}
function openFuelSettings(){
  const cfg=fuelCfg();let on=cfg.on;
  openSheet(`<div class="sh-top"><h2>Fuelling</h2>${X}</div>
    <p class="sh-desc">For every session the app estimates the carbohydrate you burn, tells you how much to take while riding and how much to eat afterwards.</p>
    <ul class="guide">
      <li><b>Burned.</b> Work from your power meter, at 22% efficiency, gives the energy. The share from carbohydrate comes from the time in each power zone: about 45% in easy endurance, 60–70% at tempo, nearly all of it at threshold and above. It drops about 8 points an hour as the ride goes on and rises a little with what you take.</li>
      <li><b>While riding: the priority.</b> Sized on your engine: 70% of what the session burns each hour, a little more on long rides, never under 40 g an hour and never over your ceiling. It feeds the session, starts the refill for the next one and keeps your gut trained. A hard hour burns 150 g or more, so it lands on your ceiling.</li>
      <li><b>After.</b> Burned minus taken is what your glycogen is missing. With another demanding session within a day: up to 1.2 g per kg in the first hour. Otherwise up to 0.8 g per kg in the next meal. Always 0.3 g of protein per kg.</li>
      <li><b>If the session changes.</b> Longer or harder than planned means more burned than what you carried: the difference is added to recovery and refilled straight away, in two doses when it is large.</li>
    </ul>
    <p class="sh-note">It is an estimate: without a lab test the share of fat and carbohydrate can be off by a quarter either way. Sources: Rothschild 2022, Podlogar &amp; Wallis 2022, Jeukendrup 2014, Burke 2017, Thomas 2016.</p>
    <div class="field"><label for="fs-r">Most you take in an hour (g)</label><input id="fs-r" type="number" inputmode="numeric" min="30" max="120" step="5" value="${cfg.max}"><p>The plan never asks for more than this. Above 60 g an hour use a glucose + fructose mix; above 90 only if your gut is trained for it.</p></div>
    <div class="savebar" style="margin-top:22px"><span class="st"></span><button class="btn" id="fs-save">Save</button></div>`);
  $("fs-save").onclick=()=>{syncSet("rd_fuel",{on,max:clip(r5(+$("fs-r").value||90),30,120),since:cfg.since});
    buzz();closeSheet();render();toast("Saved");};
}
// Today's fuelling on the Score page: what the session still to do asks for, and what to eat after the one just done.
// Each line opens its session.
function fuelCard(){
  if(!fuelCfg().on) return "";
  const d=todayISO(),day=dayOf(d); if(!day) return "";
  const rows=[];
  for(const p of (day.plan||[]).filter(p=>!p.done&&p.fuel&&p.fuel.min>=30)){
    const q=fuelPlanned(p),tot=q.intake;
    rows.push(`<button class="fuel-r" data-pd="${esc(String(p.id))}"><b>On the bike · ${esc(p.name||"Session")}, ${durTxt(p.fuel.min)}</b>${q.rate&&isRide(p)?`<em>${tot} g of carbs</em> in the bottle${p.fuel.min>=90?"s":""} (${q.rate} g/h${q.rate>60?", glucose + fructose":""}). You'll burn about ${r5(q.used)} g.`
      :q.rate?`You'll burn about ${r5(q.used)} g of carbs. If you can, take about ${tot} g during it.`:`You'll burn about ${r5(q.used)} g of carbs: too short to need anything on the way, eat well afterwards.`}</button>`);
  }
  const done=(day.workouts||[]).filter(w=>w.type&&w.start&&w.fuel&&(w.minutes||0)>=30).sort((a,b)=>a.start<b.start?-1:1),last=done[done.length-1];
  const end=last?startMs(d,last.start)+(last.elapsed||last.minutes)*60000:0;
  if(last&&end<=Date.now()&&Date.now()-end<6*3600000){
    const f=fuelDone(last,d),rec=f.rec,what=isRide(last)?"ride":/Run/.test(last.type)?"run":"session";
    rows.push(`<button class="fuel-r" data-wd="${esc(String(last.id))}"><b>After your ${what}</b>Burned about ${r5(f.used)} g of carbs, took ${f.it.g} g${f.it.guess?" (assumed)":""}: about ${r5(rec.deficit)} g to refill.
      ${rec.carbs?`Aim for <em>${rec.carbs} g of carbs</em> and ${rec.protein} g of protein ${rec.window}${rec.more?`, then another ${rec.more} g of carbs in the two hours after`:""}.`
        :`A normal meal with about ${rec.protein} g of protein is enough.`}
      ${f.why&&f.extra>0?` That includes ${f.extra} g more than planned, because ${f.why}.`:f.why?` ${Math.abs(f.extra)} g less than planned, because ${f.why}.`:""}</button>`);
  }
  return rows.length?`<section class="sec"><div class="sec-h"><h2>Fuel</h2><span>On the bike and after</span></div><div class="fuel-c"><i>${FUEL_IC}</i><div>${rows.join("")}</div></div></section>`:"";
}
function bindFuelCard(){
  document.querySelectorAll(".fuel-c [data-pd]").forEach(b=>b.onclick=()=>{buzz(5);openPlanned(b.dataset.pd);});
  document.querySelectorAll(".fuel-c [data-wd]").forEach(b=>b.onclick=()=>{buzz(5);openDone(b.dataset.wd);});
}
const FUEL_IC=`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6v3l1.5 2.5V20a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V7.5L9 5z"/><path d="M7.5 12h9"/></svg>`;
