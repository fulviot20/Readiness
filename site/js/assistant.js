"use strict";
/* ------------------------------------------------------------ assistant: ask by text or voice */
// It reads a summary of your day and training and answers like a coach. The only thing it can change is your weight
// (log it), always after you confirm. Food logging was removed with the food section (November 2026).
let AS={msgs:[],pending:null,busy:false,draft:(()=>{try{return sessionStorage.getItem("rd_as_draft")||"";}catch(e){return "";}})()};
const SPARK=`<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.5l2.1 6.4 6.4 2.1-6.4 2.1L12 19.5l-2.1-6.4L3.5 11l6.4-2.1z"/><path d="M19 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" opacity=".7"/></svg>`;
const ASK=`<button class="ask-p" id="ask" aria-label="Ask AI">${SPARK}<span>Ask AI</span></button><button class="gear" id="find" aria-label="Find in the app"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg></button>`;
document.addEventListener("click",e=>{if(e.target.closest("#ask")) openAssistant();});
// What the message is about decides what goes in the context: a short, relevant context makes answers faster,
// spares the free quota and keeps a Flash model from getting lost in data that has nothing to do with the question.
const RX_HAB=/abitudin|journal|diario|alcol|vino|birr|caff|schermo|telefono|stress|correla/i;
function aiTopics(text){return {habits:RX_HAB.test(String(text||""))};}
function aiContext(TP={habits:true}){
  const t=todayISO(),raw=(DATA.days||[]).find(x=>x.date===t)||{},d=raw.score!=null?applyAnswers(raw,raw.answers):raw,c=d.comp||{},E=DATA.energy?.today;
  const fuelToday=(raw.plan||[]).filter(p=>!p.done&&p.fuel&&p.fuel.min>=40).map(p=>{const q=fuelPlanned(p);return {session:p.name,carbs_on_bike_g:q.intake,g_per_hour:q.rate};});
  const sig=k=>c[k]?.value!=null?Math.round(c[k].value*10)/10:null;
  return {now:new Date().toLocaleString("en-GB",{timeZone:"Europe/Rome",weekday:"long",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}),today:t,
    readiness:d.score??null,readiness_band:d.score!=null?bandOf(d.score)[1]:null,advice:d.advice||null,
    signals:{hrv_ms:sig("hrv"),sleeping_hr:sig("rhr"),sleep_h:sig("sleep"),load_pct:sig("load")},
    his_usual:{hrv_ms:c.hrv?.base??null,sleeping_hr:c.rhr?.base??null,sleep_need_h:c.sleep?.base??null},
    sleep_score:raw.sleep_score?.score??null,strain:raw.strain?.score??null,
    planned_today:(raw.plan||[]).map(p=>p.name),done_today:(raw.workouts||[]).filter(w=>w.type).map(w=>`${w.name} ${w.minutes} min`),
    energy:E?{burned_so_far:E.kcal_now,expected_today:E.projected,steps:E.steps,km:E.km,stress:E.stress}:null,
    fuel_today:fuelCfg().on?fuelToday:null,
    page:AS.section||"today",
    ...(TP.habits?{journal_last_14_days:Object.entries(jAll()).filter(([d])=>d>=isoAdd(t,-14)).map(([d,o])=>({date:d,habits:(o.tags||[]).map(id=>jTags().find(x=>x.id===id)?.label||id)})),
    habit_impact:habitImpact().filter(x=>!x.need).map(x=>({habit:x.tag.label,days:x.n,next_morning_recovery_diff:x.rec!=null?Math.round(x.rec):null,next_morning_sleep_diff:x.sl!=null?Math.round(x.sl):null}))}:{}),
    last_7_days:(DATA.days||[]).slice(-8,-1).map(x=>({date:x.date,readiness:x.score??null,sleep:x.sleep_score?.score??null,strain:x.strain?.score??null,
      workouts:(x.workouts||[]).filter(w=>w.type).map(w=>({name:w.name,type:w.type,min:w.minutes,load:w.load,feel:w.feel??null}))})),
    next_days:Object.entries(DATA.upcoming||{}).filter(([d])=>d>t).slice(0,4).map(([d,ps])=>({date:d,plan:ps.map(p=>`${p.name}${p.minutes?` ${p.minutes} min`:""}`)})),
    weight_kg:weightNow(),fitness:{ftp:athLast("ftp")?.v??null,vo2max:athLast("vo2max")?r1(athLast("vo2max").v):null,lthr:athLast("lthr")?.v??null}};
}
const AS_RULES=(T,deep)=>`You are the assistant inside Readiness, a personal app for an endurance athlete (cyclist who also runs). The user writes or speaks, usually in Italian.
Reply with JSON only: {"reply":"...","actions":[...]}.
"reply": in the user's language, friendly and direct. ${deep?`This is a question: answer it like a good sports scientist and coach who knows this athlete: lead with the answer, then the 2–4 reasons that matter, each tied to his actual numbers from the context. No filler.`:"Keep it short."}
On the bike he takes at least 70 g/h of carbohydrate; fuelling and recovery after a session follow the numbers in fuel_today when present.
The score is a companion, not a judge: the user decides whether to train and adapts by feel (e.g. fewer intervals); never call sessions "missed" or sound alarming.
The app has no food diary or meal plan: if asked to log food, say that the app only tracks fuelling on the bike and recovery after sessions.
"actions" (empty when it's only a question). Allowed:
{"type":"log_weight","date":"YYYY-MM-DD","kg":72.4}
Dates: "ieri" = the day before today; never in the future.
Context (JSON): ${JSON.stringify(aiContext(T))}`;
function actText(a){
  const day=d=>d===todayISO()?"today":fmtDay(d,{weekday:"short",day:"numeric",month:"short"});
  if(a.type==="log_weight") return `<b>Weight ${(+a.kg).toFixed(1)} kg · ${day(a.date)}</b>`;
  return "";
}
function validAct(a){
  const t=todayISO(),okD=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||"")&&d<=t&&d>=isoAdd(t,-120);
  if(a&&a.type==="log_weight") {a.date=okD(a.date)?a.date:t; return +a.kg>=30&&+a.kg<=200;}
  return false;
}
async function runActs(acts){
  for(const a of acts) if(a.type==="log_weight") await logMetric("weight",a.date,r1(+a.kg));
  ATH_CACHE=null;
}
function asLog(){
  const EX={today:["Perché il mio score oggi è così?","Ho dormito poco: come adatto l'allenamento di oggi?","Quante ore dovrei dormire stanotte?","Cosa sta pesando di più sul recupero questa settimana?"],
    training:["Com'è andata la mia settimana di allenamento?","Il carico di questa settimana è troppo alto?","Domani ho la seduta dura: come mi preparo?","Riassumi gli allenamenti degli ultimi 7 giorni"],
    athlete:["Come sta andando il peso?","Peso di stamattina 72,4 kg","Come sono messo con FTP e VO2max?","Quanti carboidrati porto domani in bici?"]};
  const ex=EX[AS.section]||EX.today;
  if(!AS.msgs.length) return `<p class="sh-desc">Ask about your score, sleep, training, fuelling and recovery. You can also tell me your weight: I always ask before saving.</p>
    <div class="as-ex">${ex.map(t=>`<button data-ex="${esc(t)}">${esc(t)}</button>`).join("")}</div>`;
  return AS.msgs.map((m,i)=>m.role==="user"?`<div class="as-u">${esc(m.text)}</div>`:
    `<div class="as-a">${esc(m.text)}${m.acts&&m.acts.length?`<div class="as-acts">${m.acts.map(a=>`<div class="as-act">${actText(a)}</div>`).join("")}
      ${m.state==="pending"?`<div class="as-btns"><button class="btn quiet" data-no="${i}">Cancel</button><button class="btn" data-yes="${i}">Confirm</button></div>`:`<p class="as-st">${m.state==="done"?"✓ Done":"Cancelled"}</p>`}</div>`:""}</div>`).join("")+
    (AS.busy?`<div class="as-a as-wait"><i class="spin"></i><span id="as-el">Thinking…</span></div>`:"");
}
function openAssistant(section){
  AS.section=section||TAB;
  if(!aiKey()) return aiNeeded("The AI coach");
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  openSheet(`<div class="sh-top"><h2>Ask AI</h2>${X}</div>
    <div id="as-log" class="as-log">${asLog()}</div>
    <div class="as-in"><textarea id="as-t" rows="1" placeholder="Ask or tell me…" enterkeyhint="enter">${esc(AS.draft||"")}</textarea>
      ${SR?`<button class="as-b" id="as-mic" aria-label="Speak"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg></button>`:""}
      <button class="as-b send" id="as-go" aria-label="Send"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></div>
    ${AS.msgs.length?`<button class="as-new" id="as-new">New conversation</button>`:""}`);
  const ta=$("as-t"),mic=$("as-mic");
  // the draft survives closing the sheet or leaving the app; the box grows as you talk or type
  const grow=()=>{AS.draft=ta.value;try{sessionStorage.setItem("rd_as_draft",ta.value);}catch(e){}ta.style.height="auto";ta.style.height=Math.min(innerHeight*.45,ta.scrollHeight)+"px";};
  const redraw=()=>{$("as-log").innerHTML=asLog();bind();const sh=$("sheet");sh.scrollTop=sh.scrollHeight;};
  grow();
  const D=dictation(ta,()=>grow(),on=>{if(mic) mic.classList.toggle("on",on);ta.placeholder=on?"Listening… tap the mic to stop":"Ask or tell me…";});
  const stop=()=>D&&D.stop();
  const send=async()=>{
    stop();const text=ta.value.trim();if(!text||AS.busy) return;
    ta.value="";grow();AS.draft="";AS.msgs.push({role:"user",text});
    AS.busy=true;redraw();
    const t0=Date.now(),tick=setInterval(()=>{const el=$("as-el");if(!el) return;const s=Math.round((Date.now()-t0)/1000);
      el.textContent=s<8?"Thinking…":s<20?`Working on it… ${s} s`:`Still working… ${s} s (trying a faster model if needed)`;},1000);
    // a request to log or change something wants speed; a question wants a thought-through answer
    const T=aiTopics(AS.msgs.filter(m=>m.role==="user").slice(-3).map(m=>m.text).join(" "));
    const deep=/\?\s*$|^(perch|come |cosa |quant|qual|dovrei|conviene|ha senso|why|how|what|should)/i.test(text)&&!/^(peso di|registra)/i.test(text);
    const contents=[{role:"user",parts:[{text:AS_RULES(T,deep)}]},{role:"model",parts:[{text:'{"reply":"Ok.","actions":[]}'}]},
      ...AS.msgs.filter(m=>!m.busy).slice(-10).map(m=>m.role==="user"?{role:"user",parts:[{text:m.text}]}:{role:"model",parts:[{text:m.raw||JSON.stringify({reply:m.text,actions:[]})}]})];
    try{
      const {json,raw}=await aiCall(contents,deep?50000:35000,deep);
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
  // on a phone Enter makes a new line (only the arrow sends); on a computer Enter sends, Shift+Enter is a new line
  ta.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey&&!matchMedia("(pointer:coarse)").matches){e.preventDefault();send();}};
  $("as-go").onclick=send;
  const nw=$("as-new"); if(nw) nw.onclick=()=>{AS={msgs:[],pending:null,busy:false};openAssistant();};
  if(mic) mic.onclick=()=>D.toggle();
  const old=camStop;camStop=()=>{stop();camStop=old;};
  bind();const sh=$("sheet");sh.scrollTop=sh.scrollHeight;
  setTimeout(()=>ta.focus({preventScroll:true}),320);
}

