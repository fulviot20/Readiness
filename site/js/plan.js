/* ------------------------------------------------------------ food: meal plan built from what you tell it */
// You tell the app how you eat (in your words, by voice, or with a short questionnaire). It keeps that as a list of
// notes you can read and edit, like a memory, and builds the plan from them around your daily target: every meal is
// made of components with alternatives, in grams and household portions, scaled for rest, training and long days.
// Tell it something new ("I forgot: no spicy food") and the notes and the plan update. Any meal goes into the diary with one tap.
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
  const H=DATA.energy?.history||[],f=1,adj=(goalState()?.adj||0)+(trimGet().v||0),floor=Math.max(1200,DATA.energy?.bmr||0),byd=Object.fromEntries((DATA.days||[]).map(x=>[x.date,x]));
  const groups={rest:[],train:[],long:[]};
  for(const h of H.slice(-42)){if(!h.kcal||h.date>=todayISO()) continue;const m=((byd[h.date]||{}).workouts||[]).filter(w=>w.type).reduce((a,w)=>a+(w.minutes||0),0);
    groups[m>=180?"long":m>=30?"train":"rest"].push(h.kcal);}
  const med=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[s.length>>1]:null;};
  const out={},M=burnModel();
  if(M.ok){                                      // same model as the daily range: everyday burn + what training usually costs on such days
    const tr={rest:[],train:[],long:[]};
    for(const d of (DATA.days||[]).slice(-43)){if(d.date>=todayISO()) continue;const m=(d.workouts||[]).filter(w=>w.type).reduce((a,w)=>a+(w.minutes||0),0);
      tr[m>=180?"long":m>=30?"train":"rest"].push(dayTraining(d.date).kcal);}
    for(const [k,a] of Object.entries(tr)) out[k]=a.length?Math.round(Math.max(floor,M.base+med(a)+adj)/50)*50:null;
  }else
  for(const [k,a] of Object.entries(groups)){const b=med(a);out[k]=b?Math.round(Math.max(floor,b*f+adj)/10)*10:null;}
  if(!out.train) out.train=targetOf(todayISO())?.kcal||null;
  if(!out.rest&&out.train) out.rest=out.train-300; if(!out.long&&out.train) out.long=out.train+700;
  return out;
}
// The plan follows the range by itself: the carbohydrate parts of each meal are resized so that the day's meals,
// plus what you take on the bike, land in the middle of the range for that kind of day. Following the portions
// is how you stay in range without logging anything.
function planTarget(dt){
  const t=todayISO();
  if(dt===dayTypeToday()){const tg=targetOf(t);if(tg) return {kcal:tg.kcal,fuel:Math.round(foodDay(t).filter(x=>x.fuel).reduce((a,x)=>a+x.kcal,0))};}
  const k=dayTypeTargets()[dt]; if(!k) return null;
  const fu=[];
  for(const d of (DATA.days||[]).slice(-43,-1)){const m=(d.workouts||[]).filter(w=>w.type).reduce((a,w)=>a+(w.minutes||0),0);
    if((m>=180?"long":m>=30?"train":"rest")===dt) fu.push(foodDay(d.date).filter(x=>x.fuel).reduce((a,x)=>a+x.kcal,0));}
  return {kcal:Math.round(k/50)*50,fuel:fu.length?Math.round(median(fu)):0};
}
function planFactor(P,dt,off=0){
  const mm=[],sel=lsJSON("rd_plan_sel",{}),T0=planTarget(dt),T=T0&&{...T0,kcal:T0.kcal+off},f0=+(P.day_types?.[dt]?.carb_factor)||1,wk=new Date().getDay()%6!==0;let fix=0,carb=0;
  const FX=typeof fixAll==="function"?fixAll():{};
  (P.meals||[]).forEach((m,mi)=>{const key=m.meal==="s"?"s"+mi:m.meal,fx=FX[key]&&libAll().find(e=>e.id===FX[key]&&e.items&&e.items.length);if(fx) m=Object.assign({},m,{_fx:fx});mm.push(m);});
  for(const m of mm){
    if(m._fx){fix+=ftot(m._fx.items).kcal;continue;}
    if(wk&&P.canteen&&(P.canteen.picks||[]).length&&m.meal===P.canteen.meal){const ks=P.canteen.picks.map(p=>+p.kcal||0);fix+=ks.reduce((a,b)=>a+b,0)/ks.length;continue;}
    (m.components||[]).forEach((c,ci)=>{const o=(c.options||[])[sel[m.meal+ci]??0];if(o) c.carb?carb+=+o.kcal||0:fix+=+o.kcal||0;});}
  const f=T&&carb?clip(Math.round((T.kcal-T.fuel-fix)/carb*20)/20,.5,2.5):f0;
  return {f,T,meals:Math.round(fix+carb*f)};
}
/* notes: the food memory */
function fnLocal(){return lsJSON("rd_fnotes",{});}
function fnAll(){
  const m={};
  for(const n of DATA.nutrition?.notes||[]) m[n.id]=n;
  for(const n of Object.values(fnLocal())) if(!m[n.id]||(n.ts||0)>=(m[n.id].ts||0)) m[n.id]=n;
  return Object.values(m).filter(n=>!n.del&&n.text).sort((a,b)=>(a.at||a.ts)-(b.at||b.ts));
}
function fnSave(n){n={...n,ts:Date.now()};const L=fnLocal();L[n.id]=n;LS.set("rd_fnotes",JSON.stringify(L));sendQ("fnote",n);}
function fnApply(ch){
  const now=Date.now();let k=0;
  for(const t of ch.add||[]) if(String(t).trim()) fnSave({id:uid(),text:String(t).trim().slice(0,200),at:now+k++});
  for(const e of ch.edit||[]){const o=fnAll().find(n=>n.id===e.id);if(o&&e.text) fnSave({...o,text:String(e.text).trim().slice(0,200)});}
  for(const id of ch.remove||[]){const o=fnAll().find(n=>n.id===id);if(o) fnSave({...o,del:true});}
}
// answers given to the old questionnaire become notes once
(function migratePrefs(){try{const P=lsJSON("rd_plan_prefs",null);if(!P||LS.get("rd_fn_mig")) return;LS.set("rd_fn_mig","1");
  const lines=PQ.filter(([k])=>P[k]).map(([k,q])=>`${q}: ${P[k]}`).concat(PQ_TEXT.filter(([k])=>P[k]).map(([k,l])=>`${l.replace(/ \(optional\)/,"")}: ${P[k]}`));
  const now=Date.now();lines.forEach((t,i)=>{const L=lsJSON("rd_fnotes",{}),id="m"+i+now.toString(36);L[id]={id,text:t,at:now+i,ts:now+i};LS.set("rd_fnotes",JSON.stringify(L));});}catch(e){}})();
async function learnFood(text){
  const notes=fnAll().map(n=>({id:n.id,text:n.text}));
  const {json}=await aiCall([{role:"user",parts:[{text:`You keep a short list of notes about how the user eats, used to build their meal plan (like a memory).
Existing notes: ${JSON.stringify(notes)}
The user now says: """${text}"""
Turn it into changes: one fact per note, short, in the user's language. Merge with existing notes instead of duplicating; if something contradicts an old note, edit that note; remove notes the user says are no longer true. Keep useful details (who cooks, where they eat, foods liked/avoided, timing, hunger, portions, weighing, budget, special days).
Reply with JSON only: {"add":["..."],"edit":[{"id":"...","text":"..."}],"remove":["id"],"reply":"one short sentence in the user's language saying what you noted"}`}]}]);
  fnApply(json);
  return json.reply||"Noted.";
}
function openNotes(){
  let editing=null;
  const draw=()=>{const N=fnAll();
    openSheet(`<div class="sh-top"><h2>What I know about how you eat</h2>${X}</div>
      <p class="sh-desc">The plan is built from these notes. Change them here, or just tell the plan (or Ask AI) something new and they update by themselves.</p>
      ${N.length?N.map(n=>editing===n.id?`<div class="fn-r ed"><textarea id="fn-e" class="sm-t" style="min-height:70px">${esc(n.text)}</textarea><div class="savebar"><button class="btn quiet" data-fx="1">Cancel</button><button class="btn" data-fs="${n.id}">Save</button></div></div>`
        :`<div class="fn-r"><span>${esc(n.text)}</span><button data-fe="${n.id}" aria-label="Edit">Edit</button><button data-fd="${n.id}" aria-label="Delete">Delete</button></div>`).join(""):`<p class="notice">No notes yet.</p>`}
      <div class="ath-log" style="grid-template-columns:1fr auto;margin-top:16px"><div class="field"><label for="fn-n">Add a note</label><input id="fn-n" type="text" maxlength="200" placeholder="e.g. No spicy food"></div><button class="btn" id="fn-add">Add</button></div>
      ${planGet()?`<button class="btn" id="fn-re" style="width:100%;margin-top:14px">Update the plan with these notes</button>`:`<button class="btn" id="fn-re" style="width:100%;margin-top:14px">Build my plan</button>`}`);
    document.querySelectorAll("[data-fe]").forEach(b=>b.onclick=()=>{editing=b.dataset.fe;draw();setTimeout(()=>$("fn-e")?.focus(),50);});
    document.querySelectorAll("[data-fx]").forEach(b=>b.onclick=()=>{editing=null;draw();});
    document.querySelectorAll("[data-fs]").forEach(b=>b.onclick=()=>{const o=fnAll().find(n=>n.id===b.dataset.fs),t=$("fn-e").value.trim();
      if(o) t?fnSave({...o,text:t}):fnSave({...o,del:true});editing=null;buzz(5);draw();});
    document.querySelectorAll("[data-fd]").forEach(b=>b.onclick=()=>{const o=fnAll().find(n=>n.id===b.dataset.fd);if(o) fnSave({...o,del:true});buzz(5);draw();
      toast("Note deleted","Undo",()=>{fnSave({...o,del:false});draw();});});
    $("fn-add").onclick=()=>{const t=$("fn-n").value.trim();if(!t) return;fnSave({id:uid(),text:t,at:Date.now()});buzz(5);draw();};
    $("fn-re").onclick=()=>genPlan();
  };
  draw();
}
function planView(){
  const P=planGet(),N=fnAll(),SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!P) return `<section class="sec first"><div class="plan-intro">
      <h3>Tell me how you eat</h3>
      <p>Write or say anything that matters: who cooks, where you have lunch, what you like or avoid, when you're hungry, whether you can weigh things. I keep it as notes you can always read and change, and build your plan from them around your daily target and the kind of day.</p>
      ${aiKey()?`<textarea id="pl-t" class="sm-t" placeholder="e.g. I live with my parents and my mum cooks dinner; on work days I eat at the hospital canteen; breakfast is always porridge; no spicy food…"></textarea>
      <div class="savebar" style="margin-top:10px">${SR?`<button class="btn quiet mic" id="pl-mic">Dictate</button>`:"<span></span>"}<button class="btn" id="pl-go">${N.length?"Build my plan":"Save and build my plan"}</button></div>
      <button class="pl-q" id="pl-quiz">Prefer quick questions? Answer a short questionnaire</button>
      ${N.length?`<button class="pl-q" id="pl-notes">What I already know about you · ${N.length} notes</button>`:""}`
      :`<button class="btn" id="pl-key" style="width:100%">Add your Gemini key in Settings first</button>`}</div></section>`;
  const t=todayISO(),dtT=dayTypeToday(),dt=PLAN_DT||dtT,isT=dt===dtT,PF=planFactor(P,dt),f=PF.f,D=P.day_types?.[dt]||{};
  const sel=lsJSON("rd_plan_sel",{}),pk=pckDay(t),L=planMealsFor(t);
  const comp=(m,ci,c)=>{const pick=sel[m.meal+ci]??0;
    return `<div class="pl-c"><small>${esc(c.role)}</small><div class="pl-o">${(c.options||[]).map((o,oi)=>{const k=c.carb?f:1;
      return `<button data-pk="${m.meal+ci}" data-oi="${oi}" class="${oi===pick?"on":""}"><b>${esc(o.name)}</b><span>${o.grams?Math.round(o.grams*k)+" g":""}${o.portion?` · ${esc(o.portion)}`:""}</span></button>`;}).join("")}</div></div>`;};
  const checks=x=>isT?`<div class="pck-s">${Object.entries(PCK_K).map(([k,[,n]])=>`<button data-pck="${x.key}" data-st="${k}" class="${pk[x.key]===k?"on":""}">${n}</button>`).join("")}</div>`:"";
  const day=dayOf(t),tr=(day?.plan||[]).filter(p=>!p.done).map(p=>p.name).join(", ");
  const fuel=isT?fuelCard(t,foodDay(t)):dt!=="rest"?`<div class="fuel-c static"><i>${FUEL_IC}</i><div><p><b>On the bike</b>At least 70 g of carbs an hour from the first half hour (80–90 g/h on hard or long rides), plus a normal meal with protein within an hour or two of getting home.</p></div></div>`:"";
  const mealCardP=x=>{const m=x.m,fx=planFix(x.key);
    if(x.canteen) return `<div class="pl-m${pk[x.key]?" set":""}"><div class="pl-mh"><i class="ml-i ml-${m.meal}">${MEAL_ICON[m.meal]||""}</i><b>${esc(MEAL_NAME[m.meal]||m.title)} · canteen</b><span>~${fmtK(Math.round(pckMealKcal(x)))} kcal</span></div>
        <ul class="pl-rules">${(P.canteen.rules||[]).map(r=>`<li>${esc(r)}</li>`).join("")}</ul>
        <details class="pl-cp"><summary>Typical plates</summary>${(P.canteen.picks||[]).map(p=>`<div class="pl-pick"><span>${esc(p.name)}</span><b>~${fmtK(Math.round(+p.kcal||0))} kcal</b></div>`).join("")}</details>
        ${checks(x)}</div>`;
    const lib=libAll().filter(e=>e.kind==="meal"&&e.for===m.meal&&(!fx||e.id!==fx.id));
    return `<div class="pl-m${pk[x.key]?" set":""}"><div class="pl-mh"><i class="ml-i ml-${m.meal}">${MEAL_ICON[m.meal]||""}</i><b>${esc(fx?fx.name:x.title)}</b><span>~${fmtK(Math.round(pckMealKcal(x,dt)))} kcal</span></div>
      ${fx?`<div class="pl-fx">${fx.items.map(it=>`<div><span>${esc(it.name)}</span><b>${it.g?`${Math.round(it.g)} g`:"1 portion"}</b></div>`).join("")}</div>
        <div class="pl-act"><button data-fxe="${x.key}">Edit quantities</button><button data-fxu="${x.key}">Back to suggestions</button></div>`
      :`${(m.components||[]).map((c,ci)=>comp(m,ci,c)).join("")}${m.note?`<p class="pl-n">${esc(m.note)}</p>`:""}
        <div class="pl-act"><button data-fxs="${x.key}">Make this my usual ${esc((MEAL_NAME[m.meal]||"meal").toLowerCase().replace(/s$/,""))}</button>${lib.map(e=>`<button data-fxp="${x.key}|${e.id}">Use “${esc(e.name)}”</button>`).join("")}</div>`}
      ${checks(x)}</div>`;};
  const before=L.filter(x=>x.meal!=="d"),dinner=L.filter(x=>x.meal==="d");
  return `<section class="sec first">
    <div class="pl-top"><div class="range" id="pl-dt">${[["rest","Rest"],["train","Training"],["long","Long"]].map(([k,n])=>`<button data-dt="${k}" class="${dt===k?"on":""}${k===dtT?" tday":""}">${n}</button>`).join("")}</div>
      <div class="pl-k"><b${PF.T?' style="font-size:21px;white-space:nowrap"':""}>${PF.T?`${fmtK(PF.T.kcal-100)}–${fmtK(PF.T.kcal+100)}`:D.kcal?fmtK(D.kcal):"–"}</b><span>kcal a day</span></div></div>
    <p class="pl-fit">${isT?`<b>Today</b>${tr?` · ${esc(tr)}`:" · rest day"}. Tick each meal as you eat it: one tap, nothing to weigh.`:`What a ${dt==="rest"?"rest":dt==="long"?"long-ride":"training"} day looks like. Today is underlined.`}</p>
    ${before.map(mealCardP).join("")}
    ${fuel?`<div class="pl-fuel">${fuel}</div>`:""}
    ${dinner.map(mealCardP).join("")}
    ${isT?`<p class="pck-f">Less and more mean about a quarter less or a third more than shown. Extras (a slice of cake, an aperitivo) go in the Diary.</p>`:""}
    ${trendCard()}
    <div class="pl-tell"><input id="pl-new" type="text" placeholder="Tell me something new… e.g. no spicy food" enterkeyhint="send">${SR?`<button class="as-b" id="pl-mic2" aria-label="Speak"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg></button>`:""}<button class="as-b send" id="pl-send" aria-label="Update the plan"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></div>
    <button class="pl-q" id="pl-notes" style="margin-top:6px">What I know about how you eat · ${N.length} note${N.length===1?"":"s"} →</button>
    ${(P.tips||[]).length?`<details class="pl-tips"><summary>Tips for your situation</summary><ul>${P.tips.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></details>`:""}
    <p class="foot">Portions follow the kind of day and your weight trend: when the scale says so, they change by themselves.</p></section>`;
}
function bindPlan(){
  const on=(id,f)=>{const e=$(id);if(e) e.onclick=f;};
  on("pl-key",openSettings); on("pl-quiz",openPlanQuiz); on("pl-notes",openNotes);
  const go=$("pl-go"),ta=$("pl-t");
  if(ta){try{ta.value=sessionStorage.getItem("rd_pl_draft")||"";}catch(e){}ta.oninput=()=>{try{sessionStorage.setItem("rd_pl_draft",ta.value);}catch(e){}};}
  if(go) go.onclick=async()=>{const t=ta.value.trim();if(!t&&!fnAll().length) return toast("Tell me a little about how you eat first");
    if(t){go.disabled=true;go.textContent="Saving notes…";try{await learnFood(t);try{sessionStorage.removeItem("rd_pl_draft");}catch(e){}}catch(e){go.disabled=false;go.textContent="Save and build my plan";return toast(e.message);}}
    genPlan();};
  const d1=ta?dictation(ta,()=>ta.oninput&&ta.oninput(),on=>{const m=$("pl-mic");if(m){m.textContent=on?"Stop":"Dictate";m.classList.toggle("on",on);}}):null;
  on("pl-mic",()=>d1&&d1.toggle());
  const inp=$("pl-new");
  if(inp){
    const d2=dictation(inp,null,on=>$("pl-mic2")?.classList.toggle("on",on));
    on("pl-mic2",()=>d2&&d2.toggle());
    const send=async()=>{d2&&d2.stop();const t=inp.value.trim();if(!t) return;inp.value="";inp.disabled=true;
      inp.placeholder="Updating your notes…";
      try{const r=await learnFood(t);toast(r);genPlan({quiet:true});}catch(e){toast(e.message);}
      inp.disabled=false;inp.placeholder="Tell me something new… e.g. no spicy food";};
    on("pl-send",send); inp.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();send();}};
  }
  document.querySelectorAll("#pl-dt [data-dt]").forEach(b=>b.onclick=()=>{PLAN_DT=b.dataset.dt;buzz(5);renderFood();});
  document.querySelectorAll("[data-pk]").forEach(b=>b.onclick=()=>{const s=lsJSON("rd_plan_sel",{});s[b.dataset.pk]=+b.dataset.oi;syncSet("rd_plan_sel",s);buzz(4);const y=scrollY;renderFood();scrollTo(0,y);});
  bindPlanCheck(todayISO());
  const LL=planMealsFor(todayISO()),rr=()=>{const y=scrollY;renderFood();scrollTo(0,y);};
  document.querySelectorAll("[data-fxs]").forEach(b=>b.onclick=()=>{const x=LL.find(y=>y.key===b.dataset.fxs);if(!x) return;fixFromPlan(x);buzz(10);rr();openFixMeal(x.key);});
  document.querySelectorAll("[data-fxp]").forEach(b=>b.onclick=()=>{const [k,id]=b.dataset.fxp.split("|");fixSet(k,id);buzz(8);rr();});
  document.querySelectorAll("[data-fxu]").forEach(b=>b.onclick=()=>{fixSet(b.dataset.fxu,null);buzz(5);rr();});
  document.querySelectorAll("[data-fxe]").forEach(b=>b.onclick=()=>openFixMeal(b.dataset.fxe));
  document.querySelectorAll("[data-cp]").forEach(b=>b.onclick=()=>{const P=planGet(),p=P.canteen.picks[+b.dataset.cp],now=Date.now();
    foodSave({...aiFood({name:p.name,grams:p.grams,kcal:p.kcal,protein:p.protein,carbs:p.carbs,fat:p.fat,note:"canteen, estimated"},P.canteen.meal),id:uid(),date:todayISO(),meal:P.canteen.meal,at:now,ts:now});
    buzz(12);toast(`Canteen lunch logged · ~${fmtK(Math.round(+p.kcal||0))} kcal`);});
}
function logPlanMeal(meal,o={}){
  const P=planGet(),m=(P.meals||[]).find(x=>x.meal===meal);if(!m) return 0;
  const dt=o.dt||PLAN_DT||dayTypeToday(),f=planFactor(P,dt).f,sel=lsJSON("rd_plan_sel",{}),now=Date.now(),q=o.k||1,date=o.date||todayISO();let n=0,k=0;
  (m.components||[]).forEach((c,ci)=>{const op=(c.options||[])[sel[meal+ci]??0];if(!op) return;const s=(c.carb?f:1)*q;
    const it=aiFood({name:op.name,grams:(+op.grams||0)*s||null,kcal:(+op.kcal||0)*s,protein:(+op.protein||0)*s,carbs:(+op.carbs||0)*s,fat:(+op.fat||0)*s,note:op.portion||null},meal);
    foodSave({...it,src:"plan",id:uid(),date,meal,at:now+n,ts:now+n});n++;k+=it.kcal;});
  if(!o.quiet){buzz(12);toast(`${MEAL_NAME[meal]} logged · ${fmtK(Math.round(k))} kcal — adjust anything in the Diary`);}
  return k;
}
/* ------------------------------------------------------------ plan: your usual meals */
// A slot of the plan (e.g. breakfast) can be pinned to one of your saved meals: you eat the same thing,
// with the quantities you choose, and the rest of the day's portions make room for it.
const fixAll=()=>lsJSON("rd_plan_fix",{});
function planFix(key){const id=fixAll()[key];return id?libAll().find(e=>e.id===id&&e.items&&e.items.length)||null:null;}
function fixSet(key,id){const F={...fixAll()};if(id) F[key]=id; else delete F[key];syncSet("rd_plan_fix",F);}
function fixFromPlan(x){
  const P=planGet(),dt=PLAN_DT||dayTypeToday(),f=planFactor(P,dt).f,sel=lsJSON("rd_plan_sel",{});
  const items=(x.m.components||[]).map((c,ci)=>{const o=(c.options||[])[sel[x.meal+ci]??0];if(!o) return null;const s=c.carb?f:1;
    return aiFood({name:o.name,grams:(+o.grams||0)*s||null,kcal:(+o.kcal||0)*s,protein:(+o.protein||0)*s,carbs:(+o.carbs||0)*s,fat:(+o.fat||0)*s,note:o.portion||null},x.meal);}).filter(Boolean);
  const e={id:uid(),kind:"meal",for:x.meal,name:`My ${(MEAL_NAME[x.meal]||"meal").toLowerCase().replace(/s$/,"")}`,items};
  libSave(e);fixSet(x.key,e.id);return e;
}
// edit the grams of a usual meal, remove a food, add one by name and grams (values from the tables)
function openFixMeal(key){
  const e0=planFix(key);if(!e0) return;const e=JSON.parse(JSON.stringify(e0));
  const per=it=>{const g=+it.g||0;return it.k100!=null?{k:it.k100,p:it.p100||0,c:it.c100||0,f:it.f100||0}:g?{k:it.kcal/g*100,p:it.p/g*100,c:it.c/g*100,f:it.f/g*100}:null;};
  const regram=(it,g)=>{const q=per(it);if(!q||!(g>0)) return it;return {...it,g:Math.round(g),kcal:Math.round(q.k*g/100),p:r1(q.p*g/100),c:r1(q.c*g/100),f:r1(q.f*g/100),k100:Math.round(q.k),p100:r1(q.p),c100:r1(q.c),f100:r1(q.f)};};
  const draw=()=>{
    openSheet(`<div class="sh-top"><h2>${esc(e.name)}</h2>${X}</div>
      <p class="sh-desc">Change the grams and the kcal follow. The other meals of the day make room for it.</p>
      <div class="field"><label for="fx-n">Name</label><input id="fx-n" type="text" maxlength="40" value="${esc(e.name)}"></div>
      ${e.items.map((it,i)=>`<div class="fx-r"><span>${esc(it.name)}<small>${fmtK(Math.round(it.kcal))} kcal</small></span><input data-g="${i}" type="number" inputmode="decimal" min="0" step="5" value="${it.g||""}" aria-label="grams of ${esc(it.name)}"><u>g</u><button data-rm="${i}" aria-label="Remove">✕</button></div>`).join("")}
      <h3 class="sh-sub">${fmtK(Math.round(ftot(e.items).kcal))} kcal · P ${Math.round(ftot(e.items).p)} · C ${Math.round(ftot(e.items).c)} · F ${Math.round(ftot(e.items).f)} g</h3>
      <div class="fx-add"><input id="fx-a" type="text" placeholder="Add a food, e.g. miele" maxlength="40"><input id="fx-ag" type="number" inputmode="decimal" placeholder="g"><button class="btn quiet" id="fx-ab">Add</button></div><p class="st" id="fx-st"></p>
      <div class="savebar" style="margin-top:18px"><span></span><button class="btn" id="fx-s">Save</button></div>`);
    const keepName=()=>{e.name=$("fx-n").value.trim()||e.name;};
    $("sheet").querySelectorAll("[data-g]").forEach(inp=>inp.onchange=()=>{keepName();const i=+inp.dataset.g;e.items[i]=regram(e.items[i],+String(inp.value).replace(",","."));const y=$("sheet").scrollTop;draw();$("sheet").scrollTop=y;});
    $("sheet").querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{keepName();e.items.splice(+b.dataset.rm,1);draw();});
    $("fx-ab").onclick=async()=>{keepName();const q=$("fx-a").value.trim(),g=+String($("fx-ag").value).replace(",",".");if(!q||!(g>0)){$("fx-st").textContent="Name and grams";return;}
      let fd=groundFood(q)||localSearch(q,1)[0];
      if(!fd&&aiKey()){$("fx-st").textContent="Looking it up…";try{fd=(await aiSearch(q))[0];}catch(err){}}
      if(!fd){$("fx-st").textContent="Not found: try another name";return;}
      e.items.push(fromFood(fd,g,e.for));draw();};
    $("fx-s").onclick=()=>{keepName();if(!e.items.length) return;libSave(e);buzz(10);closeSheet();render();toast("Saved");};
  };
  draw();
}
/* ------------------------------------------------------------ plan check-off: the plan is the diary */
// Instead of logging every food, each meal of the plan gets one tap: as planned, less, more, or something else.
// "As planned / less / more" put the plan's portions in the diary (×1, ×0.75, ×1.3) so the day's total and the range
// still work; "Something else" opens the normal add sheet. The taps also tell the scale correction how closely the
// plan was followed, so the weigh-in no longer needs to ask.
const PCK_K={ok:[1,"As planned",0],less:[.75,"Less",-1],more:[1.3,"More",1],other:[0,"Other",0]};
const pckAll=()=>lsJSON("rd_pck",{});
const pckDay=d=>pckAll()[d]||{};
function planMealsFor(date){
  const P=planGet();if(!P) return [];
  const wk=new Date(date+"T12:00").getDay()%6!==0,cant=wk&&P.canteen&&(P.canteen.picks||[]).length?P.canteen.meal:null;
  return (P.meals||[]).map((m,i)=>({key:m.meal==="s"?"s"+i:m.meal,meal:m.meal,title:m.title||MEAL_NAME[m.meal],canteen:m.meal===cant,m}));
}
function pckMealKcal(x,dt0){
  const P=planGet(),dt=dt0||dayTypeToday(),f=planFactor(P,dt).f,sel=lsJSON("rd_plan_sel",{}),fx=planFix(x.key);
  if(fx) return ftot(fx.items).kcal;
  if(x.canteen){const ks=P.canteen.picks.map(p=>+p.kcal||0);return ks.reduce((a,b)=>a+b,0)/ks.length;}
  return (x.m.components||[]).reduce((a,c,ci)=>{const o=(c.options||[])[sel[x.meal+ci]??0];return a+(o?(+o.kcal||0)*(c.carb?f:1):0);},0);
}
function pckSet(date,x,state){
  const A=pckAll(),D={...(A[date]||{})},prev=D[x.key];
  // what this meal put in the diary before goes, whatever the new answer
  foodDay(date).filter(it=>it.pck===x.key).forEach(it=>foodSave({id:it.id,date,del:true,ts:Date.now()}));
  if(prev===state||!state) delete D[x.key]; else D[x.key]=state;
  const st=D[x.key];
  if(st&&st!=="other"){
    const q=PCK_K[st][0],now=Date.now();
    if(x.canteen){const P=planGet(),ps=P.canteen.picks,avg=k=>ps.reduce((a,p)=>a+(+p[k]||0),0)/ps.length;
      foodSave({...aiFood({name:"Canteen lunch",grams:avg("grams")*q||null,kcal:avg("kcal")*q,protein:avg("protein")*q,carbs:avg("carbs")*q,fat:avg("fat")*q,note:"typical plate, estimated"},x.meal),src:"plan",pck:x.key,id:uid(),date,meal:x.meal,at:now,ts:now});}
    else if(planFix(x.key)){const fx=planFix(x.key);fx.items.forEach((it,i)=>foodSave({...it,g:it.g?Math.round(it.g*q):it.g,kcal:Math.round(it.kcal*q),p:r1(it.p*q),c:r1(it.c*q),f:r1(it.f*q),n:it.n?scaleN(it.n,q):null,src:"plan",pck:x.key,id:uid(),date,meal:x.meal,at:now+i,ts:now+i}));}
    else{const before=new Set(foodDay(date).map(i=>i.id));logPlanMeal(x.meal,{k:q,date,dt:dayTypeToday(),quiet:true});
      foodDay(date).filter(i=>!before.has(i.id)).forEach(i=>foodSave({...i,pck:x.key,ts:Date.now()}));}
  }
  A[date]=D;const lim=isoAdd(todayISO(),-60);for(const d of Object.keys(A)) if(d<lim) delete A[d];
  syncSet("rd_pck",A);
  const v=Object.values(D);if(v.length) adhSet(date,Math.round(v.reduce((a,s)=>a+PCK_K[s][2],0)/v.length*100)/100);
  buzz(st?10:5);
  if(st==="other") openAddFood(x.meal,date);
}
function planCheckCard(date){
  const L=planMealsFor(date);if(!L.length||date<isoAdd(todayISO(),-3)) return "";
  const D=pckDay(date),done=L.filter(x=>D[x.key]).length;
  return `<section class="sec pck"><div class="sec-h"><h2>From your plan</h2><span>${done?`${done} of ${L.length} done`:"One tap per meal"}</span></div>
    ${L.map(x=>`<div class="pck-r${D[x.key]?" set":""}"><div class="pck-h"><i class="ml-i ml-${x.meal}">${MEAL_ICON[x.meal]||""}</i><b>${esc(x.title)}${x.canteen?" · canteen":""}</b><span>~${fmtK(Math.round(pckMealKcal(x)))} kcal</span></div>
      <div class="pck-s">${Object.entries(PCK_K).map(([k,[,n]])=>`<button data-pck="${x.key}" data-st="${k}" class="${D[x.key]===k?"on":""}">${n}</button>`).join("")}</div></div>`).join("")}
    <p class="pck-f">Less and more count as about a quarter less or a third more than the plan. Extras like a slice of cake: + on that meal below.</p></section>`;
}
function bindPlanCheck(date){
  const L=planMealsFor(date);
  document.querySelectorAll("[data-pck]").forEach(b=>b.onclick=()=>{const x=L.find(y=>y.key===b.dataset.pck);if(!x) return;
    const y=scrollY;pckSet(date,x,b.dataset.st);if(b.dataset.st!=="other"||pckDay(date)[x.key]!=="other"){renderFood();scrollTo(0,y);}});
}
// What a change of the range means at the table: the portions of the foods you picked, before and after
function planShift(step){
  const P=planGet();if(!P||!step) return [];
  const dt=dayTypeToday(),now=planFactor(P,dt),was=planFactor(P,dt,-step),sel=lsJSON("rd_plan_sel",{}),out=[];
  if(!now.T) return [];
  const cant=new Date().getDay()%6!==0&&P.canteen&&(P.canteen.picks||[]).length?P.canteen.meal:null;
  const FX=fixAll();
  (P.meals||[]).forEach((m,mi)=>{if(m.meal===cant||FX[m.meal==="s"?"s"+mi:m.meal]) return;(m.components||[]).forEach((c,ci)=>{if(!c.carb) return;const o=(c.options||[])[sel[m.meal+ci]??0];if(!o||!o.grams) return;
    const a=Math.round(o.grams*was.f/5)*5,b=Math.round(o.grams*now.f/5)*5;
    if(a!==b) out.push({meal:m.meal,name:o.name,a,b});});});
  return out;
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
      LS.set("rd_plan_prefs",JSON.stringify(A));LS.set("rd_fn_mig","1");
      const lines=PQ.filter(([k])=>A[k]).map(([k,q])=>`${q}: ${A[k]}`).concat(PQ_TEXT.filter(([k])=>A[k]).map(([k,l])=>`${l.replace(/ \(optional\)/,"")}: ${A[k]}`));
      fnApply({add:lines});genPlan();};
  };
  const keepText=()=>PQ_TEXT.forEach(([k])=>{const e=$("pq-"+k);if(e) A[k]=e.value.trim();});
  draw();
}
let PLAN_BUSY=false;
async function genPlan(o={}){
  if(!aiKey()) return aiNeeded("Building a meal plan");
  if(PLAN_BUSY) return toast("The plan is already being updated");
  const quiet=o.quiet&&planGet();
  if(!quiet) openSheet(`<div class="sh-top"><h2>${planGet()?"Updating your plan…":"Building your plan…"}</h2>${X}</div><p class="af-wait" style="justify-content:center;margin:40px 0"><i class="spin"></i>Fitting meals to your notes, your target and the kind of day</p>`);
  else toast("Updating your plan…");
  PLAN_BUSY=true;
  const T=dayTypeTargets(),gs=goalState(),w=weightNow(),lib=libAll().filter(e=>e.kind==="meal").map(e=>({name:e.name,meal:e.for,foods:e.items.map(x=>`${x.name}${x.g?" "+x.g+" g":""}`)}));
  const recent=recents().slice(0,25).map(x=>x.name),notes=fnAll().map(n=>n.text),prev=planGet();
  const prompt=`You are a sports dietitian. ${prev?"Update the athlete's meal plan below so it respects ALL the notes (they may have changed); keep what still fits.":"Build a flexible Italian-style meal plan for an endurance athlete (cyclist who also runs)."} Reply with JSON only.
Athlete: weight ${w??"unknown"} kg; goal ${gs?`${gs.g.target} kg at ${gs.g.pace} kg/week (${gs.adj} kcal/day vs burn)`:"maintain"}; protein about 1.7–1.8 g/kg; fat enough for health; carbohydrates are the priority and must follow training.
Daily targets (kcal): rest/easy day ${T.rest}, training day ${T.train}, long ride day ${T.long}. Grams in the plan are for a TRAINING day; components marked "carb":true get scaled by carb_factor on the other days (choose factors so each day type lands near its target).
What the athlete told us (always respect these): ${JSON.stringify(notes)}
Saved meals they already eat: ${JSON.stringify(lib)}
Foods they log often: ${JSON.stringify(recent)}
${prev?`Previous plan: ${JSON.stringify({summary:prev.summary,meals:prev.meals,canteen:prev.canteen,tips:prev.tips})}`:""}
Rules: meals b (breakfast), l (lunch), d (dinner) plus one entry per snack as meal "s" (title "Morning snack" / "Afternoon snack"…). Each meal = 2–5 components (e.g. Carbs, Protein, Vegetables, Fat/Dressing, Fruit), each with 3–5 realistic alternatives the family kitchen or a canteen would have; every option has grams, a household "portion" (e.g. "2 medium slices", "1 full soup plate", "3 tablespoons", "1 fist") and its kcal/protein/carbs/fat for those grams. If they rarely weigh, choose portions that are easy to eyeball. If they have lunch at a canteen on work days, fill "canteen" with simple choosing rules and 3–4 typical plates with estimates (still include a lunch meal for days off); otherwise leave "canteen" empty. Keep cooking oil inside the dish values. Keep names short, in English, with the Italian name in brackets when useful.
JSON: {"summary":"2 sentences","day_types":{"rest":{"label":"Rest or easy day","kcal":0,"carb_factor":0.8},"train":{"label":"Training day","kcal":0,"carb_factor":1},"long":{"label":"Long ride day","kcal":0,"carb_factor":1.4}},
"meals":[{"meal":"b","title":"Breakfast","note":"","components":[{"role":"Carbs","carb":true,"options":[{"name":"","grams":0,"portion":"","kcal":0,"protein":0,"carbs":0,"fat":0}]}]}],
"canteen":{"meal":"l","rules":[""],"picks":[{"name":"","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0}]},"tips":["5 short practical tips for their situation"]}`;
  try{
    const {json}=await aiCall([{role:"user",parts:[{text:prompt}]}],90000);
    if(!Array.isArray(json.meals)||!json.meals.length) throw new Error("The AI returned an empty plan, try again");
    json.made=todayISO();json.kcal_ref=T.train;
    for(const k of ["rest","train","long"]) if(json.day_types?.[k]&&!json.day_types[k].kcal) json.day_types[k].kcal=T[k];
    syncSet("rd_plan",json);if(!prev) syncSet("rd_plan_sel",{});PLAN_BUSY=false;
    if(!quiet){closeSheet();PLAN_DT=null;TAB="athlete";ATH_SUB="food";PG.athlete="plan";scrollTo(0,0);}
    if(TAB==="athlete"&&PG.athlete==="plan"){const y=scrollY;render();scrollTo(0,quiet?y:0);}
    toast(prev?"Plan updated":"Your plan is ready");
  }catch(e){
    PLAN_BUSY=false;
    if(quiet) return toast("Couldn't update the plan: "+e.message);
    openSheet(`<div class="sh-top"><h2>Plan not ready</h2>${X}</div><p class="sh-desc">${esc(e.message)}</p><div class="savebar"><span></span><button class="btn" id="pq-retry">Try again</button></div>`);
    $("pq-retry").onclick=()=>genPlan(o);
  }
}
