/* ------------------------------------------------------------ food: meal plan built from your habits */
// A short questionnaire about how you actually eat (family cooking, canteen, no scales…), then the AI writes
// a plan around your daily target: every meal is made of components with several alternatives, in grams
// and in household portions, scaled for rest, training and long days. Any meal goes into the diary with one tap.
const PQ=[
  ["cook","Who cooks most of your meals?",["Me","My family","Both"]],
  ["weigh","Can you weigh your food?",["Usually","Sometimes","Almost never"]],
  ["lunch","Lunch on work days",["Canteen","Packed from home","At home","Bar or restaurant"]],
  ["wkend","Lunch at the weekend",["At home","With family","Often out"]],
  ["bfast","Breakfast",["Same every day","It varies","I skip it"]],
  ["snacks","Snacks a day",["0","1","2","3 or more"]],
  ["train","When do you train on work days?",["Morning","Lunch break","Evening","It varies"]],
  ["diet","How do you eat?",["Everything","Little meat","Vegetarian","Vegan"]],
  ["hunger","When are you hungriest?",["Morning","Afternoon","Evening","Late night"]]];
const PQ_TEXT=[["bdesc","Your usual breakfast (optional)","e.g. porridge with oats, yogurt, kiwi, peanut butter"],
  ["avoid","Foods you avoid or dislike","e.g. spicy food, dressed pasta at the canteen"],
  ["other","Anything else the plan should know","e.g. one evening a week I eat out with my girlfriend"]];
const planPrefs=()=>lsJSON("rd_plan_prefs",{});
const planGet=()=>lsJSON("rd_plan",null);
let PLAN_DT=null;
function dayTypeToday(){
  const t=todayISO(),raw=(DATA.days||[]).find(x=>x.date===t)||{};
  const mins=[...(raw.workouts||[]).filter(w=>w.type).map(w=>w.minutes||0),...(raw.plan||[]).filter(p=>!p.done).map(p=>p.minutes||0)];
  const tot=mins.reduce((a,b)=>a+b,0);
  return tot>=180?"long":tot>=30?"train":"rest";
}
// typical target for each kind of day, from what you burned on similar days in the last 6 weeks
function dayTypeTargets(){
  const H=DATA.energy?.history||[],f=calib().f,adj=goalState()?.adj||0,floor=Math.max(1200,DATA.energy?.bmr||0),byd=Object.fromEntries((DATA.days||[]).map(x=>[x.date,x]));
  const groups={rest:[],train:[],long:[]};
  for(const h of H.slice(-42)){if(!h.kcal||h.date>=todayISO()) continue;const m=((byd[h.date]||{}).workouts||[]).filter(w=>w.type).reduce((a,w)=>a+(w.minutes||0),0);
    groups[m>=180?"long":m>=30?"train":"rest"].push(h.kcal);}
  const med=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[s.length>>1]:null;};
  const out={};for(const [k,a] of Object.entries(groups)){const b=med(a);out[k]=b?Math.round(Math.max(floor,b*f+adj)/10)*10:null;}
  if(!out.train) out.train=targetOf(todayISO())?.kcal||null;
  if(!out.rest&&out.train) out.rest=out.train-300; if(!out.long&&out.train) out.long=out.train+700;
  return out;
}
function planView(){
  const P=planGet();
  if(!P) return `<section class="sec first"><div class="plan-intro">
      <h3>A plan that fits your life</h3>
      <p>Answer a few questions about how you really eat — family cooking, canteen lunches, no scales — and the AI builds a plan around your daily target: each meal with alternatives, in grams and in portions you can eyeball, adjusted for rest, training and long days.</p>
      <button class="btn" id="pl-new" style="width:100%">${aiKey()?"Create my plan":"Add your Gemini key in Settings first"}</button></div></section>`;
  const dt=PLAN_DT||dayTypeToday(),D=P.day_types?.[dt]||{},f=+D.carb_factor||1,prefs=planPrefs(),wk=new Date().getDay()%6!==0;
  const sel=lsJSON("rd_plan_sel",{});
  const comp=(m,ci,c)=>{const pick=sel[m.meal+ci]??0;
    return `<div class="pl-c"><small>${esc(c.role)}</small><div class="pl-o">${(c.options||[]).map((o,oi)=>{const k=c.carb?f:1;
      return `<button data-pk="${m.meal+ci}" data-oi="${oi}" class="${oi===pick?"on":""}"><b>${esc(o.name)}</b><span>${o.grams?Math.round(o.grams*k)+" g":""}${o.portion?` · ${esc(o.portion)}`:""}</span></button>`;}).join("")}</div></div>`;};
  const mealKcal=m=>(m.components||[]).reduce((a,c,ci)=>{const o=(c.options||[])[sel[m.meal+ci]??0];return a+(o?(+o.kcal||0)*(c.carb?f:1):0);},0);
  const canteen=prefs.lunch==="Canteen"&&P.canteen;
  return `<section class="sec first">
    <div class="pl-top"><div class="range" id="pl-dt">${[["rest","Rest"],["train","Training"],["long","Long ride"]].map(([k,n])=>`<button data-dt="${k}" class="${dt===k?"on":""}">${n}</button>`).join("")}</div>
      <div class="pl-k"><b>${D.kcal?fmtK(D.kcal):"–"}</b><span>kcal target</span></div></div>
    ${P.summary?`<p class="pl-sum">${esc(P.summary)}</p>`:""}
    ${(P.meals||[]).map(m=>canteen&&m.meal===P.canteen.meal&&wk?`
      <div class="pl-m"><div class="pl-mh"><i class="ml-i ml-${m.meal}">${MEAL_ICON[m.meal]||""}</i><b>${esc(MEAL_NAME[m.meal]||m.title)} · canteen</b></div>
        <ul class="pl-rules">${(P.canteen.rules||[]).map(r=>`<li>${esc(r)}</li>`).join("")}</ul>
        ${(P.canteen.picks||[]).map((p,i)=>`<button class="pl-pick" data-cp="${i}"><span>${esc(p.name)}</span><b>~${fmtK(Math.round(+p.kcal||0))} kcal</b></button>`).join("")}
        <p class="pl-n">Tap the plate closest to what you took: it goes into the diary as an estimate.</p></div>`:`
      <div class="pl-m"><div class="pl-mh"><i class="ml-i ml-${m.meal}">${MEAL_ICON[m.meal]||""}</i><b>${esc(m.title||MEAL_NAME[m.meal])}</b><span>~${fmtK(Math.round(mealKcal(m)))} kcal</span></div>
        ${(m.components||[]).map((c,ci)=>comp(m,ci,c)).join("")}
        ${m.note?`<p class="pl-n">${esc(m.note)}</p>`:""}
        <button class="btn quiet pl-log" data-log="${m.meal}">Log this ${esc((MEAL_NAME[m.meal]||"meal").toLowerCase().replace(/s$/,""))}</button></div>`).join("")}
    ${(P.tips||[]).length?`<details class="pl-tips"><summary>Tips for your situation</summary><ul>${P.tips.map(t=>`<li>${esc(t)}</li>`).join("")}</ul></details>`:""}
    <div class="savebar" style="margin-top:16px"><button class="btn quiet" id="pl-edit">Edit my answers</button><button class="btn quiet" id="pl-redo">New plan</button></div>
    <p class="foot">Made ${fmtDay(P.made||todayISO(),{day:"numeric",month:"short"})} for a target of ${fmtK(P.kcal_ref||0)} kcal on training days. Make a new one when your goal or routine changes.</p></section>`;
}
function bindPlan(){
  const on=(id,f)=>{const e=$(id);if(e) e.onclick=f;};
  on("pl-new",()=>aiKey()?openPlanQuiz():openSettings()); on("pl-edit",openPlanQuiz); on("pl-redo",()=>genPlan(planPrefs()));
  document.querySelectorAll("#pl-dt [data-dt]").forEach(b=>b.onclick=()=>{PLAN_DT=b.dataset.dt;buzz(5);renderFood();});
  document.querySelectorAll("[data-pk]").forEach(b=>b.onclick=()=>{const s=lsJSON("rd_plan_sel",{});s[b.dataset.pk]=+b.dataset.oi;LS.set("rd_plan_sel",JSON.stringify(s));buzz(4);const y=scrollY;renderFood();scrollTo(0,y);});
  document.querySelectorAll("[data-log]").forEach(b=>b.onclick=()=>logPlanMeal(b.dataset.log));
  document.querySelectorAll("[data-cp]").forEach(b=>b.onclick=()=>{const P=planGet(),p=P.canteen.picks[+b.dataset.cp],now=Date.now();
    foodSave({...aiFood({name:p.name,grams:p.grams,kcal:p.kcal,protein:p.protein,carbs:p.carbs,fat:p.fat,note:"canteen, estimated"},P.canteen.meal),id:uid(),date:todayISO(),meal:P.canteen.meal,at:now,ts:now});
    buzz(12);toast(`Canteen lunch logged · ~${fmtK(Math.round(+p.kcal||0))} kcal`);});
}
function logPlanMeal(meal){
  const P=planGet(),m=(P.meals||[]).find(x=>x.meal===meal);if(!m) return;
  const dt=PLAN_DT||dayTypeToday(),f=+(P.day_types?.[dt]?.carb_factor)||1,sel=lsJSON("rd_plan_sel",{}),now=Date.now();let n=0,k=0;
  (m.components||[]).forEach((c,ci)=>{const o=(c.options||[])[sel[meal+ci]??0];if(!o) return;const s=c.carb?f:1;
    const it=aiFood({name:o.name,grams:(+o.grams||0)*s||null,kcal:(+o.kcal||0)*s,protein:(+o.protein||0)*s,carbs:(+o.carbs||0)*s,fat:(+o.fat||0)*s,note:o.portion||null},meal);
    foodSave({...it,src:"plan",id:uid(),date:todayISO(),meal,at:now+n,ts:now+n});n++;k+=it.kcal;});
  buzz(12);toast(`${MEAL_NAME[meal]} logged · ${fmtK(Math.round(k))} kcal — adjust anything in the Diary`);
}
function openPlanQuiz(){
  const A={...planPrefs()};
  const draw=()=>{
    openSheet(`<div class="sh-top"><h2>About how you eat</h2>${X}</div>
      <p class="sh-desc">Two minutes. The plan is only as good as these answers, so answer for a normal week, not the ideal one.</p>
      ${PQ.map(([k,q,opts])=>`<div class="pq"><label>${q}</label><div class="chips">${opts.map(o=>`<button data-q="${k}" data-v="${esc(o)}" class="${A[k]===o?"on":""}">${esc(o)}</button>`).join("")}</div></div>`).join("")}
      ${PQ_TEXT.map(([k,l,ph])=>`<div class="field"><label for="pq-${k}">${l}</label><input id="pq-${k}" type="text" maxlength="160" placeholder="${esc(ph)}" value="${esc(A[k]||"")}"></div>`).join("")}
      <div class="savebar" style="margin-top:20px"><span class="st" id="pq-st"></span><button class="btn" id="pq-go">Build my plan</button></div>`);
    document.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>{keepText();A[b.dataset.q]=b.dataset.v;buzz(4);const y=$("sheet").scrollTop;draw();$("sheet").scrollTop=y;});
    $("pq-go").onclick=()=>{keepText();const miss=PQ.filter(([k])=>!A[k]).length;if(miss>2){$("pq-st").textContent=`${miss} questions left`;return;}
      LS.set("rd_plan_prefs",JSON.stringify(A));genPlan(A);};
  };
  const keepText=()=>PQ_TEXT.forEach(([k])=>{const e=$("pq-"+k);if(e) A[k]=e.value.trim();});
  draw();
}
async function genPlan(A){
  if(!aiKey()) return aiNeeded("Building a meal plan");
  openSheet(`<div class="sh-top"><h2>Building your plan…</h2>${X}</div><p class="af-wait" style="justify-content:center;margin:40px 0"><i class="spin"></i>Fitting meals to your target and your routine</p>`);
  const T=dayTypeTargets(),gs=goalState(),w=weightNow(),lib=libAll().filter(e=>e.kind==="meal").map(e=>({name:e.name,meal:e.for,foods:e.items.map(x=>`${x.name}${x.g?" "+x.g+" g":""}`)}));
  const recent=recents().slice(0,25).map(x=>x.name);
  const prompt=`You are a sports dietitian. Build a flexible Italian-style meal plan for an endurance athlete (cyclist who also runs). Reply with JSON only.
Athlete: weight ${w??"unknown"} kg; goal ${gs?`${gs.g.target} kg at ${gs.g.pace} kg/week (${gs.adj} kcal/day vs burn)`:"maintain"}; protein about 1.7–1.8 g/kg; fat enough for health; carbohydrates are the priority and must follow training.
Daily targets (kcal): rest/easy day ${T.rest}, training day ${T.train}, long ride day ${T.long}. Grams in the plan are for a TRAINING day; components marked "carb":true get scaled by carb_factor on the other days (choose factors so each day type lands near its target).
Habits: ${JSON.stringify(A)}
Saved meals they already eat: ${JSON.stringify(lib)}
Foods they log often: ${JSON.stringify(recent)}
Rules: meals b (breakfast), l (lunch), d (dinner) plus one entry per snack as meal "s" (title "Morning snack" / "Afternoon snack"…). Each meal = 2–5 components (e.g. Carbs, Protein, Vegetables, Fat/Dressing, Fruit), each with 3–5 realistic alternatives the family kitchen or a canteen would have; every option has grams, a household "portion" (e.g. "2 medium slices", "1 full soup plate", "3 tablespoons", "1 fist") and its kcal/protein/carbs/fat for those grams. If they rarely weigh, choose portions that are easy to eyeball. Respect what they avoid. If lunch is at a canteen, fill "canteen" with simple choosing rules and 3–4 typical plates with estimates (still include a lunch meal for days off). Keep cooking oil inside the dish values. Keep names short, in English, with the Italian name in brackets when useful.
JSON: {"summary":"2 sentences","day_types":{"rest":{"label":"Rest or easy day","kcal":0,"carb_factor":0.8},"train":{"label":"Training day","kcal":0,"carb_factor":1},"long":{"label":"Long ride day","kcal":0,"carb_factor":1.4}},
"meals":[{"meal":"b","title":"Breakfast","note":"","components":[{"role":"Carbs","carb":true,"options":[{"name":"","grams":0,"portion":"","kcal":0,"protein":0,"carbs":0,"fat":0}]}]}],
"canteen":{"meal":"l","rules":[""],"picks":[{"name":"","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0}]},"tips":["5 short practical tips for their situation"]}`;
  try{
    const {json}=await aiCall([{role:"user",parts:[{text:prompt}]}],90000);
    if(!Array.isArray(json.meals)||!json.meals.length) throw new Error("The AI returned an empty plan, try again");
    json.made=todayISO();json.kcal_ref=T.train;
    for(const k of ["rest","train","long"]) if(json.day_types?.[k]&&!json.day_types[k].kcal) json.day_types[k].kcal=T[k];
    LS.set("rd_plan",JSON.stringify(json));LS.del("rd_plan_sel");
    closeSheet();PLAN_DT=null;TAB="athlete";ATH_SUB="food";PG.athlete="plan";render();scrollTo(0,0);toast("Your plan is ready");
  }catch(e){
    openSheet(`<div class="sh-top"><h2>Plan not ready</h2>${X}</div><p class="sh-desc">${esc(e.message)}</p><div class="savebar"><span></span><button class="btn" id="pq-retry">Try again</button></div>`);
    $("pq-retry").onclick=()=>genPlan(A);
  }
}
