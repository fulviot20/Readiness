"use strict";
/* ------------------------------------------------------------ steps & calories */
const EN_COL={basal:"#64748b",active_so_far:"#f59e0b",rest_of_day:"#fcd34d",planned:"#fb923c"};
const EN_TXT={basal:"Basal (resting, whole day)",active_so_far:"Active so far",rest_of_day:"Rest of the day, usual pace",planned:"Planned training still to do"};
const fmtK=n=>n==null?"–":Number(n).toLocaleString("en-GB");
const asofTxt=h=>`${String(Math.floor(h)).padStart(2,"0")}:${String(Math.round(h%1*60)).padStart(2,"0")}`;
const STRESS=[[25,"Rest","#60a5fa"],[50,"Low","#fbbf24"],[75,"Medium","#f59e0b"],[100,"High","#f97316"]];
const stressBand=v=>STRESS.find(b=>v<=b[0]);
const EN_KEYS={kcal:["Calories","#f59e0b","kcal"],steps:["Steps","#34d399","steps"],km:["Distance","#2dd4bf","km"],stress:["Stress","#f472b6","avg stress"]};
function yourDay(){
  const E=DATA.energy?.today; if(!E) return "";
  const p=E.parts,tot=E.projected||1,seg=k=>`<i style="width:${p[k]/tot*100}%;background:${EN_COL[k]}"></i>`;
  const sp=E.goal?Math.min(100,E.steps/E.goal*100):0,sb=E.stress!=null?stressBand(E.stress):null;
  return `<section class="sec"><div class="sec-h"><h2>Your day</h2><span>As of ${asofTxt(E.asof)}</span></div>
  <div class="day4">
    <button class="en-c" data-en="kcal"><small>CALORIES</small><b>${fmtK(E.kcal_now)}<u>kcal</u></b>
      <div class="en-bar">${["basal","active_so_far","rest_of_day","planned"].map(seg).join("")}</div>
      <span>On track for ~${fmtK(E.projected)}</span></button>
    <button class="en-c" data-en="steps"><small>STEPS</small><b>${fmtK(E.steps)}</b>
      <div class="en-bar"><i style="width:${sp}%;background:#34d399"></i></div>
      <span>${E.goal?(E.steps>=E.goal?"Goal reached":`${fmtK(E.goal-E.steps)} to ${fmtK(E.goal)}`):`~${fmtK(E.steps_projected)} by tonight`}</span></button>
    <button class="en-c" data-en="km"><small>DISTANCE</small><b>${E.km!=null?E.km.toFixed(1):"–"}<u>km</u></b>
      <div class="en-bar"><i style="width:${E.km&&E.steps_projected?Math.min(100,E.steps/E.steps_projected*100):0}%;background:#2dd4bf"></i></div>
      <span>Estimate, on the safe side</span></button>
    <button class="en-c" data-en="stress"><small>STRESS</small><b>${E.stress??"–"}${sb?`<em style="color:${sb[2]}">${sb[1]}</em>`:""}</b>
      <div class="st-bar">${STRESS.map(b=>`<i class="${sb===b?"on":""}" style="background:${b[2]}"></i>`).join("")}</div>
      <span>${E.stress!=null?"Day average so far":"No data yet"}</span></button>
  </div></section>`;
}
let enPick=null,enKey="kcal";
function enBars(key,n){
  const h=(DATA.energy?.history||[]).slice(-n),W=320,H=120,bw=W/h.length,vals=h.map(d=>d[key]||0),max=Math.max(...vals,1);
  const pick=enPick==null||enPick>=h.length?h.length-1:enPick,col=EN_KEYS[key][1];
  const bars=h.map((d,i)=>{const v=d[key],hh=v?Math.max(3,v/max*H):2;
    return `<rect x="${(i*bw+1.2).toFixed(1)}" y="${(H-hh).toFixed(1)}" width="${(bw-2.4).toFixed(1)}" height="${hh.toFixed(1)}" rx="2" fill="${v?col:"var(--line)"}" opacity="${i===pick?1:.4}"/>
      <rect data-ei="${i}" x="${(i*bw).toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${H}" fill="transparent" style="cursor:pointer"/>`;}).join("");
  const goal=key==="steps"&&h[pick].goal?`<line x1="0" x2="${W}" y1="${H-h[pick].goal/max*H}" y2="${H-h[pick].goal/max*H}" stroke="var(--muted)" stroke-dasharray="3 4" opacity="${h[pick].goal<=max?.6:0}"/>`:"";
  const pd=h[pick],det=key==="kcal"?(pd.active!=null?`${fmtK(pd.active)} active + ${fmtK(pd.resting)} basal`:""):key==="steps"?(pd.km!=null?pd.km.toFixed(1)+" km":""):key==="km"?(pd.steps?fmtK(pd.steps)+" steps":""):(pd.stress!=null?stressBand(pd.stress)[1]:"");
  return `<div class="readout"><span>${fmtDay(pd.date,{weekday:"short",day:"numeric",month:"short"})}</span><b>${key==="km"&&pd.km!=null?pd.km.toFixed(1):fmtK(pd[key])}</b><em style="color:${col}">${EN_KEYS[key][2]}</em><span style="margin-left:auto">${esc(det)}</span></div>
    <div class="sh-chart bars30"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${goal}${bars}</svg>
    <div class="ax"><span>${fmtDay(h[0].date,{day:"numeric",month:"short"})}</span><span>${fmtDay(h[h.length-1].date,{day:"numeric",month:"short"})}</span></div></div>`;
}
function openEnergy(n=7,keep=false){
  if(!keep) enPick=null;
  const E=DATA.energy?.today; if(!E) return;
  const y=$("sheet").scrollTop,p=E.parts;
  openSheet(`<div class="sh-top"><h2>Your day</h2>${X}</div>
    <div class="sh-big" style="color:#f59e0b">~${fmtK(E.projected)}<small>kcal by tonight</small></div>
    <p class="sh-desc">${fmtK(E.kcal_now)} kcal burned so far (data at ${asofTxt(E.asof)}). The projection adds your full-day basal burn, the rest of the day at your usual pace outside workouts${E.planned_names.length?` and ${esc(E.planned_names.join(", "))} at your usual cost for that sport`:""}. It updates every 10 minutes as the day goes.</p>
    <div class="en-bar" style="height:10px">${["basal","active_so_far","rest_of_day","planned"].map(k=>`<i style="width:${p[k]/(E.projected||1)*100}%;background:${EN_COL[k]}"></i>`).join("")}</div>
    <div class="en-parts">${["basal","active_so_far","rest_of_day","planned"].filter(k=>p[k]>0).map(k=>`<div><i style="background:${EN_COL[k]}"></i><span>${EN_TXT[k]}</span><b>${fmtK(p[k])}</b></div>`).join("")}</div>
    <div class="kv"><span>Steps</span><b>${fmtK(E.steps)}${E.goal?` / ${fmtK(E.goal)}`:""}</b><span>Steps by tonight, at your usual pace</span><b>~${fmtK(E.steps_projected)}</b>${E.km!=null?`<span>Distance (estimate)</span><b>${E.km.toFixed(1)} km</b>`:""}${E.km_garmin?`<span>Garmin's figure</span><b>${E.km_garmin} km</b>`:""}${E.stress!=null?`<span>Stress, day average</span><b>${E.stress} · ${stressBand(E.stress)[1]}</b>`:""}</div>
    <p class="sh-note">Distance: GPS distance of runs and walks you record, plus the other steps × ${E.stride} m, your walking step length${E.height_known?" from your height":" (add your height in Athlete for a better one)"} shortened a little, since steps around the house are shorter than a real stride. When Garmin's own figure is lower, the lower one is kept, so it errs on the short side.</p>
    <div class="range">${Object.entries(EN_KEYS).map(([k,v])=>`<button data-k="${k}" class="${enKey===k?"on":""}">${v[0]}</button>`).join("")}</div>
    <div class="range" style="margin-top:8px"><button data-n="7" class="${n===7?"on":""}">7 days</button><button data-n="30" class="${n===30?"on":""}">30 days</button></div>
    ${enBars(enKey,n)}`);
  if(keep) $("sheet").scrollTop=y;
  $("sheet").querySelectorAll(".range button[data-n]").forEach(b=>b.onclick=()=>openEnergy(+b.dataset.n,true));
  $("sheet").querySelectorAll(".range button[data-k]").forEach(b=>b.onclick=()=>{enKey=b.dataset.k;openEnergy(n,true);});
  $("sheet").querySelectorAll("rect[data-ei]").forEach(r=>r.onclick=()=>{enPick=+r.dataset.ei;openEnergy(n,true);});
}


/* ------------------------------------------------------------ shared helpers */
const MAC={p:["Protein","#f07a8c"],c:["Carbs","#6fd3e6"],f:["Fat","#d9c46a"]};
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const r1=v=>Math.round(v*10)/10;
const isoAdd=(iso,k)=>{const d=new Date(iso+"T12:00");d.setDate(d.getDate()+k);return d.toLocaleDateString("sv-SE");};
let DAY_MAP=null;
const dayOf=date=>(DAY_MAP||(DAY_MAP=new Map((DATA.days||[]).map(d=>[d.date,d])))).get(date);
function dayReset(){DAY_MAP=null;}
function weightNow(){const w=athLast("weight");return w?w.v:null;}
let camStop=null;          // a sheet that uses the camera sets this so closing the sheet turns the camera off

/* ------------------------------------------------------------ AI (your own free Gemini key): coach and morning insight */
const aiKey=()=>LS.get("rd_gemini")||"";
function aiNeeded(what){
  openSheet(`<div class="sh-top"><h2>Needs a Gemini key</h2>${X}</div>
    <p class="sh-desc">${what} uses Google's Gemini. It is free with a personal key: create one at aistudio.google.com (Get API key), then paste it in Settings → AI key. It stays on this phone.</p>
    <p class="sh-note">On the free tier Google may use what you send to improve its models.</p>
    <div class="savebar"><button class="btn quiet" id="an-b">Back</button><button class="btn" id="an-s">Open Settings</button></div>`);
  $("an-b").onclick=()=>closeSheet(); $("an-s").onclick=openSettings;
}
// Speech on Android Chrome sends each growing version of the phrase as a new result ("sei", "sei in", "sei in grado"…):
// a result that starts with what we have replaces it instead of being appended
function srText(e){
  let out="";
  for(const r of e.results){const t=r[0].transcript.trim();if(!t) continue;
    const lo=out.toLowerCase(),tl=t.toLowerCase();
    if(!out||tl.startsWith(lo)) out=t; else if(!lo.endsWith(tl)) out=out+" "+t;}
  return out;
}
// Dictation: phones end recognition after a short pause, so it restarts by itself and keeps what you said
// until you tap Stop or Send (or after 10 minutes)
// The text is never cleared: each restart continues after what's already written (typed or dictated), and if the
// phone refuses to restart a few times in a row it pauses, keeping everything, until you tap the mic again.
function dictation(ta,onText,onState){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR) return null;
  let rec=null,on=false,t0=0,base="",fails=0,heard=false;
  const begin=()=>{rec=new SR();rec.lang="it-IT";rec.continuous=true;rec.interimResults=true;base=ta.value.trim()?ta.value.trim()+" ":"";heard=false;
    rec.onresult=e=>{const t=srText(e);if(t){heard=true;fails=0;}ta.value=base+t;onText&&onText();};
    rec.onerror=e=>{if(e.error==="not-allowed"||e.error==="service-not-allowed"){toast("Allow the microphone for Readiness");stop();}else if(e.error!=="no-speech"&&e.error!=="aborted") fails++;};
    rec.onend=()=>{rec=null;if(!on) return;
      if(Date.now()-t0>15*60000||fails>=4){stop();toast("Dictation paused — your text is kept. Tap the mic to go on.");return;}
      if(!heard) fails++;
      setTimeout(()=>{if(on) try{begin();}catch(err){fails++;stop();toast("Dictation paused — tap the mic to go on.");}},fails?400:120);};
    rec.start();};
  const stop=()=>{const was=on;on=false;if(rec){rec.onend=null;try{rec.stop();}catch(e){}rec=null;}if(was) onState&&onState(false);};
  const start=()=>{if(on) return;on=true;fails=0;t0=Date.now();try{begin();onState&&onState(true);buzz(10);}catch(e){stop();}};
  return {start,stop,toggle:()=>on?stop():start(),get on(){return on;}};
}
// Which Gemini models this key can use: asked once a day, newest Flash first (names change over time)
async function aiModels(){
  const c=lsJSON("rd_gm",null);if(c&&c.v2&&Date.now()-c.t<864e5&&c.k===aiKey().slice(-6)&&c.m.length) return c.m;
  let m=[];
  try{
    const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",{headers:{"x-goog-api-key":aiKey()}});
    if(r.ok){const j=await r.json();
      m=(j.models||[]).filter(x=>(x.supportedGenerationMethods||[]).includes("generateContent")).map(x=>x.name.replace(/^models\//,""))
        .filter(n=>/flash/.test(n)&&!/(image|tts|audio|live|thinking|exp|embedding|8b)/.test(n));
      const ver=n=>parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/)||[])[1]||0);
      const rank=n=>(/latest/.test(n)?100:0)+ver(n)*10-(/lite/.test(n)?3:0)-(/preview/.test(n)?12:0)-(/\d{3}$/.test(n)?1:0);
      m.sort((a,b)=>rank(b)-rank(a));
      // the fallbacks must not all be the same model under other names: when one generation is overloaded (503)
      // they all are, so the list keeps the two best of the newest generation, then the best of each older one
      const gen=n=>Math.floor(ver(n))||0,out=[],seen={};
      const top=m.length?gen(m.find(n=>!/latest/.test(n))||m[0]):0;
      for(const n of m){if(/latest/.test(n)) continue;const g=gen(n);seen[g]=(seen[g]||0)+1;if(seen[g]<=(g===top?2:1)) out.push(n);}
      m=out;
    }else if(r.status===400||r.status===403){const t=await r.text();if(/API key|API_KEY|PERMISSION/i.test(t)) throw new Error("The Gemini key isn't valid: check it in Settings");}
  }catch(e){if(/key/.test(e.message)) throw e;}
  if(!m.length) m=["gemini-flash-latest","gemini-2.5-flash","gemini-2.5-flash-lite"];
  if(!m.some(n=>/2\.5-flash$/.test(n))) m.push("gemini-2.5-flash");      // a steady older model always closes the list
  LS.set("rd_gm",JSON.stringify({v2:1,t:Date.now(),k:aiKey().slice(-6),m:m.slice(0,5)}));
  return m.slice(0,5);
}
// one call to Gemini that must answer with JSON. Each try has a time limit, "thinking" is kept low
// (it can make a Flash model take a minute or more), and a slow or failing model hands over to the next one.
// "deep" (the coach answering a question) lets the model reason a little; quick answers stay fast
const thinkCfg=(m,deep)=>/gemini-2\.5/.test(m)?{thinkingBudget:deep?1536:0}:/gemini-[3-9]|latest/.test(m)?{thinkingLevel:"low"}:null;
async function aiCall(contents,limitMs=35000,deep=false){
  const errs=[];let netRetry=false;
  for(const model of await aiModels()){
    let think=thinkCfg(model,deep);
    for(let attempt=0;attempt<3;attempt++){
      const cfg={responseMimeType:"application/json",temperature:0.2};if(think) cfg.thinkingConfig=think;
      const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),limitMs);
      let r=null,timedOut=false;
      try{r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:"POST",signal:ctl.signal,
        headers:{"Content-Type":"application/json","x-goog-api-key":aiKey()},body:JSON.stringify({contents,generationConfig:cfg})});}
      catch(e){timedOut=e.name==="AbortError";}
      finally{clearTimeout(timer);}
      if(!r&&!timedOut&&!netRetry){netRetry=true;await new Promise(z=>setTimeout(z,900));attempt--;continue;}   // a dropped request: once more
      if(timedOut){errs.push(`${model}: no answer within ${Math.round(limitMs/1000)} s`);break;}
      if(!r) throw new Error(navigator.onLine?"Couldn't reach Gemini just now: send it again in a moment":"No internet connection: the AI needs one");
      if(r.ok){
        const j=await r.json(),txt=(j.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||"").join("");
        if(!txt){errs.push(`${model}: empty answer (${j.candidates?.[0]?.finishReason||j.promptFeedback?.blockReason||"?"})`);break;}
        try{return {json:JSON.parse(txt.replace(/^\s*```(?:json)?|```\s*$/g,"").trim()),raw:txt};}
        catch(e){errs.push(`${model}: answer not readable`);break;}
      }
      const t=await r.text();let msg=t;try{msg=JSON.parse(t).error?.message||t;}catch(e){}
      if(/API key|API_KEY_INVALID/i.test(msg)) throw new Error("The Gemini key isn't valid: check it in Settings");
      if(r.status===400&&think&&/think/i.test(msg)){think=null;continue;}      // this model doesn't take that setting
      errs.push(`${model}: ${r.status} ${String(msg).slice(0,90)}`);
      if(r.status===404){LS.del("rd_gm");break;}
      if(r.status>=500&&attempt<2){await new Promise(z=>setTimeout(z,attempt?5000:2000));continue;}   // overloaded: usually gone in seconds
      if(r.status===429&&attempt===0){await new Promise(z=>setTimeout(z,1500));continue;}
      break;
    }
  }
  const quota=errs.length&&errs.every(e=>/ 429 /.test(e));
  const busy=errs.length&&errs.every(e=>/ 50[0-9] | 429 /.test(e));
  throw new Error(quota?"Gemini's free limit is used up for now: try again in a while":busy?"Gemini is overloaded right now (it happens at peak times and passes quickly): try again in a minute":"The AI didn't answer. "+(errs[errs.length-1]||""));
}
