"use strict";
/* ------------------------------------------------------------ assistant: ask or tell, by text or voice */
// It reads a summary of your day, answers questions, and turns requests into actions
// (log food, save a meal or recipe, set the goal, log weight, delete entries) that you confirm before they run.
let AS={msgs:[],pending:null,busy:false};
const SPARK=`<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.5l2.1 6.4 6.4 2.1-6.4 2.1L12 19.5l-2.1-6.4L3.5 11l6.4-2.1z"/><path d="M19 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" opacity=".7"/></svg>`;
const ASK=`<button class="ask-p" id="ask" aria-label="Ask AI">${SPARK}<span>Ask AI</span></button>`;
document.addEventListener("click",e=>{if(e.target.closest("#ask")) openAssistant();});
function aiContext(){
  const t=todayISO(),raw=(DATA.days||[]).find(x=>x.date===t)||{},d=raw.score!=null?applyAnswers(raw,raw.answers):raw,c=d.comp||{},E=DATA.energy?.today;
  const fo=foodOn(),items=fo?foodDay(t):[],T=ftot(items),tg=fo?targetOf(t):null,gs=goalState();
  const sig=k=>c[k]?.value!=null?Math.round(c[k].value*10)/10:null;
  return {now:new Date().toLocaleString("en-GB",{timeZone:"Europe/Rome",weekday:"long",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}),today:t,
    readiness:d.score??null,readiness_band:d.score!=null?bandOf(d.score)[1]:null,advice:d.advice||null,
    signals:{hrv_ms:sig("hrv"),sleeping_hr:sig("rhr"),sleep_h:sig("sleep"),load_pct:sig("load")},
    sleep_score:raw.sleep_score?.score??null,strain:raw.strain?.score??null,
    planned_today:(raw.plan||[]).map(p=>p.name),done_today:(raw.workouts||[]).filter(w=>w.type).map(w=>`${w.name} ${w.minutes} min`),
    energy:E?{burned_so_far:E.kcal_now,expected_today:E.projected,steps:E.steps,km:E.km,stress:E.stress}:null,
    food_diary_on:fo,food_today:items.map(x=>({id:x.id,meal:x.meal,name:x.name,grams:x.g,kcal:x.kcal})),
    eaten:{kcal:Math.round(T.kcal),protein:Math.round(T.p),carbs:Math.round(T.c),fat:Math.round(T.f)},
    target:tg?{kcal:tg.kcal,protein:tg.p,carbs:tg.c,fat:tg.f}:null,
    weight_kg:weightNow(),goal:gs?{target_kg:gs.g.target,pace_kg_week:gs.g.pace,eta:gs.eta}:null,
    my_meals:libAll().map(e=>({id:e.id,kind:e.kind,name:e.name,for:e.for||null})),
    page:AS.section||"today",
    journal_last_14_days:Object.entries(jAll()).filter(([d])=>d>=isoAdd(t,-14)).map(([d,o])=>({date:d,habits:(o.tags||[]).map(id=>jTags().find(x=>x.id===id)?.label||id)})),
    habit_impact:habitImpact().filter(x=>!x.need).map(x=>({habit:x.tag.label,days:x.n,next_morning_recovery_diff:x.rec!=null?Math.round(x.rec):null,next_morning_sleep_diff:x.sl!=null?Math.round(x.sl):null})),
    last_7_days:(DATA.days||[]).slice(-8,-1).map(x=>({date:x.date,readiness:x.score??null,sleep:x.sleep_score?.score??null,strain:x.strain?.score??null,
      workouts:(x.workouts||[]).filter(w=>w.type).map(w=>({name:w.name,type:w.type,min:w.minutes,load:w.load,feel:w.feel??null}))})),
    next_days:Object.entries(DATA.upcoming||{}).filter(([d])=>d>t).slice(0,4).map(([d,ps])=>({date:d,plan:ps.map(p=>`${p.name}${p.minutes?` ${p.minutes} min`:""}`)})),
    fitness:{ftp:athLast("ftp")?.v??null,vo2max:athLast("vo2max")?r1(athLast("vo2max").v):null,lthr:athLast("lthr")?.v??null}};
}
const AS_RULES=()=>`You are the assistant inside Readiness, a personal app for an endurance athlete (cyclist who also runs). The user writes or speaks, usually in Italian.
Reply with JSON only: {"reply":"...","actions":[...]}.
"reply": short, friendly, in the user's language; say what you are about to do, or answer the question using the context (numbers from it, not invented). No medical diagnoses.
The score is a companion, not a judge: the user decides whether to train and adapts by feel (e.g. fewer intervals); never call sessions "missed" or sound alarming.
"actions" (empty when it's only a question). Allowed:
{"type":"log_food","date":"YYYY-MM-DD","items":[ITEM]}
{"type":"save_meal","name":"...","for":"b|l|d|s","items":[ITEM]}   a set of foods eaten together, logged later with one tap
{"type":"save_recipe","name":"...","servings":1,"cooked_weight_g":null,"items":[ITEM]}   a dish cooked in several servings
{"type":"delete_food","date":"YYYY-MM-DD","ids":["..."]}   only ids listed in food_today
{"type":"delete_saved","id":"..."}   only ids listed in my_meals
{"type":"set_goal","target_kg":71,"pace_kg_week":0.5}   pace 0.25, 0.5 or 0.75
{"type":"log_weight","date":"YYYY-MM-DD","kg":72.4}
ITEM = {"meal":"b|l|d|s","name":"...","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0,"note":"",${NUT_JSON}}: grams as eaten (drinks in ml), realistic values (Italian CREA tables, USDA, labels), typical Italian portion when the amount is missing.
${AI_ESTIMATE}
When you estimate, the reply lists each food with its kcal and says the user can adjust the grams after saving.
meal: b breakfast/colazione, l lunch/pranzo, d dinner/cena, s snack/spuntino/merenda; if not said, pick from the time of day.
When the user wants to save something they always eat (e.g. "la mia colazione"), use save_meal with "for" set to that meal so it gets a one-tap button, even if they call it a recipe; use save_recipe for dishes made in several servings or when they talk about servings or the cooked weight.
To log a saved meal, copy its foods into log_food only if you know them; otherwise tell the user to tap its button.
Dates: "ieri" = the day before today; never in the future. Keep names short, in the user's language.
Context (JSON): ${JSON.stringify(aiContext())}`;
function actText(a){
  const L=it=>`${esc(it.name)}${it.grams?` ${Math.round(it.grams)} g`:""} · ${Math.round(+it.kcal||0)} kcal${it.note?`<i class="as-note">${esc(it.note)}</i>`:""}`;
  const sum=its=>Math.round((its||[]).reduce((s,x)=>s+(+x.kcal||0),0));
  const day=d=>d===todayISO()?"today":fmtDay(d,{weekday:"short",day:"numeric",month:"short"});
  if(a.type==="log_food") return `<b>Log ${(a.items||[]).length} food${(a.items||[]).length>1?"s":""} · ${day(a.date)} · ${fmtK(sum(a.items))} kcal</b>${(a.items||[]).map(it=>`<span>${MEAL_TAG[it.meal]||""} · ${L(it)}</span>`).join("")}`;
  if(a.type==="save_meal") return `<b>Save meal “${esc(a.name)}” · ${MEAL_NAME[a.for]||""} · ${fmtK(sum(a.items))} kcal</b>${(a.items||[]).map(it=>`<span>${L(it)}</span>`).join("")}`;
  if(a.type==="save_recipe") return `<b>Save recipe “${esc(a.name)}” · ${a.servings||1} serving${(a.servings||1)>1?"s":""}</b>${(a.items||[]).map(it=>`<span>${L(it)}</span>`).join("")}`;
  if(a.type==="delete_food"){const its=foodDay(a.date).filter(x=>(a.ids||[]).includes(x.id));return `<b>Delete from ${day(a.date)}</b>${its.map(x=>`<span>${esc(x.name)} · ${fmtK(Math.round(x.kcal))} kcal</span>`).join("")}`;}
  if(a.type==="delete_saved"){const e=libAll().find(x=>x.id===a.id);return `<b>Delete “${esc(e?.name||"?")}”</b>`;}
  if(a.type==="set_goal") return `<b>Goal ${(+a.target_kg).toFixed(1)} kg · ${a.pace_kg_week} kg a week</b>`;
  if(a.type==="log_weight") return `<b>Weight ${(+a.kg).toFixed(1)} kg · ${day(a.date)}</b>`;
  return "";
}
function validAct(a){
  const t=todayISO(),okD=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||"")&&d<=t&&d>=isoAdd(t,-120);
  if(!a||!a.type) return false;
  if(a.type==="log_food") {a.date=okD(a.date)?a.date:t; return (a.items||[]).length>0&&foodOn();}
  if(a.type==="save_meal") {a.for=MEAL_NAME[a.for]?a.for:"b"; return !!a.name&&(a.items||[]).length>0;}
  if(a.type==="save_recipe") return !!a.name&&(a.items||[]).length>0;
  if(a.type==="delete_food") return okD(a.date)&&(a.ids||[]).length>0;
  if(a.type==="delete_saved") return !!libAll().find(x=>x.id===a.id);
  if(a.type==="set_goal") {a.pace_kg_week=[.25,.5,.75].reduce((b,p)=>Math.abs(p-a.pace_kg_week)<Math.abs(b-a.pace_kg_week)?p:b,.5); return +a.target_kg>=35&&+a.target_kg<=200;}
  if(a.type==="log_weight") {a.date=okD(a.date)?a.date:t; return +a.kg>=30&&+a.kg<=200;}
  return false;
}
async function runActs(acts){
  const now=Date.now();let n=0;
  for(const a of acts){
    if(a.type==="log_food") a.items.forEach(x=>{const it=aiFood(x,"s");foodSave({...it,id:uid(),date:a.date,at:now+n,ts:now+n});n++;});
    else if(a.type==="save_meal") libSave({id:uid(),kind:"meal",for:a.for,name:String(a.name).slice(0,40),items:a.items.map(x=>aiFood(x,a.for))});
    else if(a.type==="save_recipe") libSave({id:uid(),kind:"recipe",name:String(a.name).slice(0,40),servings:Math.max(1,Math.round(+a.servings||1)),weight:+a.cooked_weight_g||null,items:a.items.map(x=>aiFood(x,"s"))});
    else if(a.type==="delete_food") foodDay(a.date).filter(x=>a.ids.includes(x.id)).forEach(x=>foodSave({id:x.id,date:x.date,del:true,ts:Date.now()}));
    else if(a.type==="delete_saved") libSave({id:a.id,del:true,name:"deleted"});
    else if(a.type==="set_goal"){const g=goalGet(),w=weightNow(),t=r1(+a.target_kg);
      const obj={target:t,pace:a.pace_kg_week,start:g&&g.target===t?g.start:w,since:g&&g.target===t?g.since:todayISO(),ts:Date.now()};LS.set("rd_goal",JSON.stringify(obj));sendQ("goal",obj);CAL=null;}
    else if(a.type==="log_weight") await logMetric("weight",a.date,r1(+a.kg));
  }
  ATH_CACHE=null;
}
function asLog(){
  const EX={today:["Perché il mio score oggi è così?","Ho dormito poco: come adatto l'allenamento di oggi?","Quante ore dovrei dormire stanotte?","Cosa sta pesando di più sul recupero questa settimana?"],
    training:["Com'è andata la mia settimana di allenamento?","Il carico di questa settimana è troppo alto?","Domani ho la seduta dura: come mi preparo?","Riassumi gli allenamenti degli ultimi 7 giorni"],
    food:["Salva la mia colazione classica: 50 g di avena, 200 ml di latte, una banana","Ho mangiato due uova e una fetta di pane a colazione","Quante calorie mi restano oggi?","Cosa mangio stasera per arrivare alle proteine?"],
    athlete:["Come sta andando il peso rispetto all'obiettivo?","Imposta l'obiettivo a 71 kg, 0,5 kg a settimana","Peso di stamattina 72,4 kg","Come sono messo con FTP e VO2max?"]};
  const ex=EX[AS.section]||EX.today;
  if(!AS.msgs.length) return `<p class="sh-desc">Ask about your score, sleep, training or food, or tell me what to do: log what you ate, save your usual breakfast, build a recipe, set a goal, log your weight. I always ask before saving.</p>
    <div class="as-ex">${ex.map(t=>`<button data-ex="${esc(t)}">${esc(t)}</button>`).join("")}</div>`;
  return AS.msgs.map((m,i)=>m.role==="user"?`<div class="as-u">${esc(m.text)}</div>`:
    `<div class="as-a">${esc(m.text)}${m.acts&&m.acts.length?`<div class="as-acts">${m.acts.map(a=>`<div class="as-act">${actText(a)}</div>`).join("")}
      ${m.state==="pending"?`<div class="as-btns"><button class="btn quiet" data-no="${i}">Cancel</button><button class="btn" data-yes="${i}">Confirm</button></div>`:`<p class="as-st">${m.state==="done"?"✓ Done":"Cancelled"}</p>`}</div>`:""}</div>`).join("")+
    (AS.busy?`<div class="as-a as-wait"><i class="spin"></i><span id="as-el">Thinking…</span></div>`:"");
}
function openAssistant(section){
  AS.section=section||(TAB==="athlete"&&ATH_SUB==="food"?"food":TAB);
  if(!aiKey()){ADD=null;return aiNeeded("The AI coach");}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  openSheet(`<div class="sh-top"><h2>${AS.section==="food"?"Food coach":"Ask AI"}</h2>${X}</div>
    <div id="as-log" class="as-log">${asLog()}</div>
    <div class="as-in"><textarea id="as-t" rows="1" placeholder="Ask or tell me…" enterkeyhint="send"></textarea>
      ${SR?`<button class="as-b" id="as-mic" aria-label="Speak"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg></button>`:""}
      <button class="as-b send" id="as-go" aria-label="Send"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></div>
    ${AS.msgs.length?`<button class="as-new" id="as-new">New conversation</button>`:""}`);
  const ta=$("as-t"),mic=$("as-mic");
  const grow=()=>{ta.style.height="auto";ta.style.height=Math.min(140,ta.scrollHeight)+"px";};
  const redraw=()=>{$("as-log").innerHTML=asLog();bind();const sh=$("sheet");sh.scrollTop=sh.scrollHeight;};
  const D=dictation(ta,()=>grow(),on=>{if(mic) mic.classList.toggle("on",on);ta.placeholder=on?"Listening… tap the mic to stop":"Ask or tell me…";});
  const stop=()=>D&&D.stop();
  const send=async()=>{
    stop();const text=ta.value.trim();if(!text||AS.busy) return;
    ta.value="";grow();AS.msgs.push({role:"user",text});AS.busy=true;redraw();
    const t0=Date.now(),tick=setInterval(()=>{const el=$("as-el");if(!el) return;const s=Math.round((Date.now()-t0)/1000);
      el.textContent=s<8?"Thinking…":s<20?`Working on it… ${s} s`:`Still working… ${s} s (trying a faster model if needed)`;},1000);
    const contents=[{role:"user",parts:[{text:AS_RULES()}]},{role:"model",parts:[{text:'{"reply":"Ok.","actions":[]}'}]},
      ...AS.msgs.filter(m=>!m.busy).slice(-10).map(m=>m.role==="user"?{role:"user",parts:[{text:m.text}]}:{role:"model",parts:[{text:m.raw||JSON.stringify({reply:m.text,actions:[]})}]})];
    try{
      const {json,raw}=await aiCall(contents);
      const acts=(json.actions||[]).filter(validAct);
      AS.msgs.push({role:"model",text:json.reply||(acts.length?"Here's what I'll do:":"Ok."),acts,raw,state:acts.length?"pending":null});
    }catch(e){AS.msgs.push({role:"model",text:e.message});}
    clearInterval(tick);AS.busy=false;redraw();buzz(6);
  };
  const bind=()=>{
    $("as-log").querySelectorAll("[data-ex]").forEach(b=>b.onclick=()=>{ta.value=b.dataset.ex;grow();ta.focus();});
    $("as-log").querySelectorAll("[data-yes]").forEach(b=>b.onclick=async()=>{const m=AS.msgs[+b.dataset.yes];if(m.state!=="pending") return;
      m.state="done";await runActs(m.acts);buzz(12);redraw();render();toast("Done");});
    $("as-log").querySelectorAll("[data-no]").forEach(b=>b.onclick=()=>{AS.msgs[+b.dataset.no].state="cancelled";redraw();});
  };
  ta.oninput=grow;
  ta.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}};
  $("as-go").onclick=send;
  const nw=$("as-new"); if(nw) nw.onclick=()=>{AS={msgs:[],pending:null,busy:false};openAssistant();};
  if(mic) mic.onclick=()=>D.toggle();
  const old=camStop;camStop=()=>{stop();camStop=old;};
  bind();const sh=$("sheet");sh.scrollTop=sh.scrollHeight;
  setTimeout(()=>ta.focus({preventScroll:true}),320);
}

