"use strict";
/* ------------------------------------------------------------ fitness markers */
const paceTxt=sec=>`${Math.floor(sec/60)}:${String(Math.round(sec%60)).padStart(2,"0")}`;
const MK={
  vo2max:{name:"VO₂max",unit:"ml/kg/min",fmt:v=>v.toFixed(1),col:"#5fe08a",better:1,
    desc:"Estimated from every steady run and ride: the oxygen cost of the effort (from pace and climb, or from power and weight) divided by how much of your heart-rate reserve it took. The value is the median of the last 30 days, so single sessions don't swing it."},
  ftp:{name:"FTP",unit:"W",fmt:v=>String(Math.round(v)),col:"#3a9cf5",better:1,
    desc:"Your rolling estimated FTP from Intervals, updated by your rides' power-duration data."},
  easy_pace:{name:"Easy pace",unit:"/km",fmt:v=>paceTxt(v),col:"#f2a65a",better:-1,
    desc:"How fast you run at one fixed easy heart rate, worked out from each run's pace and heart rate. As aerobic fitness improves you run faster for the same heart rate, so a lower time per km is better."},
};
function mkSeries(key,n){const s=(DATA.fitness?.series||[]);return s.slice(Math.max(0,s.length-n));}
function mkLatest(key){const s=DATA.fitness?.series||[];for(let i=s.length-1;i>=0;i--) if(s[i][key]!=null) return [s[i],i];return [null,-1];}
function mkDelta(key){
  const s=DATA.fitness?.series||[],[l,i]=mkLatest(key); if(!l) return null;
  const old=s.slice(0,Math.max(0,i-29)).reverse().find(x=>x[key]!=null)||s.slice(Math.max(0,i-30),i).find(x=>x[key]!=null);
  return old?l[key]-old[key]:null;
}
function markersSection(){
  if(!DATA.fitness) return "";
  const card=key=>{const m=MK[key],[l]=mkLatest(key),d=mkDelta(key);
    if(!l) return `<button class="mk" disabled><small>${m.name.toUpperCase()}</small><b>–</b><span>Not enough data</span></button>`;
    const v=l[key],cls=d==null||Math.abs(d)<(key==="easy_pace"?2:key==="ftp"?2:.3)?"":(d*m.better>0?"up":"down");
    const dt=d==null?"":key==="easy_pace"?`${d<0?"−":"+"}${Math.abs(Math.round(d))}s in 30 days`:`${d>0?"+":"−"}${key==="ftp"?Math.abs(Math.round(d)):Math.abs(d).toFixed(1)} in 30 days`;
    const sub=key==="ftp"&&l.wkg?`${l.wkg} W/kg`:key==="easy_pace"?`at ${DATA.fitness.easy_hr} bpm`:"";
    return `<button class="mk" data-mk="${key}"><small>${m.name.toUpperCase()}</small><b>${m.fmt(v)}<u>${key==="easy_pace"?"/km":m.unit==="W"?"W":""}</u></b>
      <span class="${cls}">${esc(dt||sub)}</span>${dt&&sub?`<span>${esc(sub)}</span>`:""}</button>`;};
  return `<section class="sec"><div class="sec-h"><h2>Fitness markers</h2><span>Tap for history</span></div>
    <div class="mks">${card("vo2max")}${card("ftp")}${card("easy_pace")}</div></section>`;
}
let mkPick=null;
function mkChart(key,n){
  const m=MK[key],s=mkSeries(key,n),W=320,H=170,PL=4,PR=40,PT=12,PB=8;
  const vals=s.filter(p=>p[key]!=null).map(p=>p[key]);
  if(vals.length<2) return "<p class='sh-desc'>Not enough data in this period yet.</p>";
  let lo=Math.min(...vals),hi=Math.max(...vals);const pad=(hi-lo)*.15||(key==="ftp"?5:key==="easy_pace"?5:.5);lo-=pad;hi+=pad;
  const inv=key==="easy_pace";                       // faster pace (fewer seconds) drawn higher
  const y=v=>inv?PT+(v-lo)/(hi-lo)*(H-PT-PB):PT+(hi-v)/(hi-lo)*(H-PT-PB),x=i=>PL+(i+.5)*((W-PL-PR)/s.length);
  const pick=mkPick==null||mkPick>=s.length||s[mkPick][key]==null?s.map(p=>p[key]!=null).lastIndexOf(true):mkPick;
  const line=s.map((p,i)=>p[key]!=null?`${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`:null).filter(Boolean).join(" ");
  const r=n>7?2.8:4.4;
  const dots=s.map((p,i)=>p[key]==null?"":`<circle cx="${x(i)}" cy="${y(p[key])}" r="${i===pick?r+2:r}" fill="${i===pick?m.col:"var(--surface)"}" stroke="${m.col}" stroke-width="2"/>`).join("");
  const hits=s.map((p,i)=>`<rect data-mi="${i}" x="${x(i)-(W-PL-PR)/s.length/2}" y="0" width="${(W-PL-PR)/s.length}" height="${H}" fill="transparent" style="cursor:pointer"/>`).join("");
  const ticks=[hi-pad,lo+pad].map(v=>`<line x1="${PL}" x2="${W-PR+4}" y1="${y(v)}" y2="${y(v)}" stroke="var(--muted)" stroke-dasharray="3 4" opacity=".4"/><text x="${W-PR+8}" y="${y(v)+4}" class="rl">${m.fmt(v)}</text>`).join("");
  const pk=s[pick];
  return `<div class="readout"><span>${fmtDay(pk.date,{weekday:"short",day:"numeric",month:"short"})}</span><b>${m.fmt(pk[key])}</b><em style="color:${m.col}">${key==="ftp"&&pk.wkg?pk.wkg+" W/kg":m.unit}</em></div>
    <div class="sh-chart"><svg viewBox="0 0 ${W} ${H}">${ticks}
      <line x1="${x(pick)}" x2="${x(pick)}" y1="${PT}" y2="${H-PB}" stroke="var(--muted)" opacity=".5"/>
      <polyline points="${line}" fill="none" stroke="${m.col}" stroke-width="2" stroke-linejoin="round"/>${dots}${hits}</svg>
    <div class="ax"><span>${fmtDay(s[0].date,{day:"numeric",month:"short"})}</span><span>${fmtDay(s[s.length-1].date,{day:"numeric",month:"short"})}</span></div></div>`;
}
function openMarker(key,n=30,keep=false){
  if(!keep) mkPick=null;
  const m=MK[key],[l]=mkLatest(key); if(!l) return;
  const extra=key==="vo2max"?`<div class="kv"><span>Sessions in the last 30 days</span><b>${l.vo2_n}</b><span>Heart rate used (rest / max)</span><b>${DATA.fitness.rest} / ${DATA.fitness.hrmax}</b></div>`
    :key==="easy_pace"?`<div class="kv"><span>Reference heart rate</span><b>${DATA.fitness.easy_hr} bpm</b></div>`
    :l.wkg?`<div class="kv"><span>Power to weight</span><b>${l.wkg} W/kg</b></div>`:"";
  const y=$("sheet").scrollTop;
  openSheet(`<div class="sh-top"><h2>${m.name}</h2>${X}</div>
    <div class="sh-big" style="color:${m.col}">${m.fmt(l[key])}<small>${m.unit}</small></div>
    <p class="sh-desc">${m.desc}</p>
    <div class="range"><button data-n="7" class="${n===7?"on":""}">7 days</button><button data-n="30" class="${n===30?"on":""}">30 days</button></div>
    ${mkChart(key,n)}${extra}`);
  if(keep) $("sheet").scrollTop=y;
  $("sheet").querySelectorAll(".range button").forEach(b=>b.onclick=()=>openMarker(key,+b.dataset.n));
  $("sheet").querySelectorAll("rect[data-mi]").forEach(r=>r.onclick=()=>{mkPick=+r.dataset.mi;openMarker(key,n,true);});
}

/* ------------------------------------------------------------ athlete */
// Fitness age: the age at which an average healthy person has your VO2max. Reference: HUNT Fitness Study,
// 3816 healthy adults (Loe et al., PLoS ONE 2013): mean 54.4 (men) / 43.0 (women) ml/kg/min at 20-29 years,
// about 3.5 ml/kg/min lower every decade.
const FIT_REF={m:54.4,f:43.0},FIT_DECLINE=0.35;
const expectedVO2=(sex,age)=>FIT_REF[sex]-FIT_DECLINE*(age-25);
const fitAgeOf=(sex,vo2)=>25+(FIT_REF[sex]-vo2)/FIT_DECLINE;
const lsJSON=(k,d)=>{try{return JSON.parse(LS.get(k)||"null")??d}catch(e){return d}};
function athProfile(){
  const srv=DATA.athlete?.profile||null,loc=lsJSON("ath_profile",null);
  return (loc&&(!srv||(loc.ts||0)>=(srv.ts||0))?loc:srv)||{};
}
function athEntries(key){   // values logged in the app: server copy plus what this phone hasn't synced yet
  const out={...(DATA.athlete?.metrics?.[key]||{})};
  for(const [d,v] of Object.entries(lsJSON("ath_m_"+key,{}))){ if(v==null) delete out[d]; else out[d]=v; }
  return out;
}
const yearsAt=(birth,iso)=>(new Date(iso+"T12:00")-new Date(birth+"T12:00"))/31557600000;
function ageNow(birth){const b=new Date(birth+"T12:00"),d=new Date(todayISO()+"T12:00");let a=d.getFullYear()-b.getFullYear();
  if(d.getMonth()<b.getMonth()||(d.getMonth()===b.getMonth()&&d.getDate()<b.getDate()))a--;return a;}
function weightPts(){
  const m={};for(const w of DATA.athlete?.weights||[]) m[w.date]=w.kg;
  Object.assign(m,athEntries("weight"));
  return Object.entries(m).sort().map(([date,v])=>({date,v:+v}));
}
function valueAt(pts,iso){let r=null;for(const p of pts){if(p.date<=iso) r=p.v; else break;} return r??(pts[0]?.v??null);}
function lthrAt(iso){const e=Object.entries(athEntries("lthr")).sort().map(([date,v])=>({date,v:+v}));
  return e.length?valueAt(e,iso):DATA.athlete?.lthr_default??null;}
const median=a=>{const s=[...a].sort((x,y)=>x-y),n=s.length;return n?(n%2?s[n>>1]:(s[n/2-1]+s[n/2])/2):null;};
let ATH_CACHE=null;
function athSeries(key){
  if(!ATH_CACHE) ATH_CACHE={};
  if(ATH_CACHE[key]) return ATH_CACHE[key];
  const F=DATA.fitness||{},S=F.series||[],P=athProfile();let out=[];
  const col=k=>S.filter(x=>x[k]!=null).map(x=>({date:x.date,v:x[k]}));
  if(key==="weight") out=weightPts();
  else if(key==="vo2max"||key==="ftp"||key==="easy_pace") out=col(key);
  else if(key==="wkg"){const w=weightPts();out=col("ftp").map(p=>{const kg=valueAt(w,p.date);return kg?{date:p.date,v:p.v/kg}:null}).filter(Boolean);}
  else if(key==="lthr"){const e=Object.entries(athEntries("lthr")).sort().map(([date,v])=>({date,v:+v}));
    out=e.length?e:(DATA.athlete?.lthr_default?[{date:todayISO(),v:DATA.athlete.lthr_default}]:[]);}
  else if(key==="thr_pace"){
    const runs=(F.runs||[]).map(r=>{const L=lthrAt(r.date);return L&&F.rest&&r.hr>F.rest+10?{date:r.date,v:r.v*(L-F.rest)/(r.hr-F.rest)}:null}).filter(Boolean);
    for(const x of S){const lo=new Date(new Date(x.date+"T12:00")-30*864e5).toLocaleDateString("sv-SE");
      const w=runs.filter(r=>r.date>lo&&r.date<=x.date).map(r=>r.v); if(w.length>=2) out.push({date:x.date,v:1000/median(w)});}
  }
  else if(key==="fitage"&&P.birth&&P.sex) out=col("vo2max").map(p=>({date:p.date,v:Math.max(20,fitAgeOf(P.sex,p.v)),age:yearsAt(P.birth,p.date)}));
  return ATH_CACHE[key]=out;
}
const yrs=v=>v<20?"20":String(Math.round(v));
const AM={
  fitage:{name:"Fitness age",unit:"years",col:"#5fe08a",fmt:yrs,better:-1,eps:.5,dfmt:d=>`${Math.abs(d).toFixed(1)} yr`,
    desc:"The age at which an average healthy person has your VO₂max. Reference: the HUNT Fitness Study (3,816 healthy Norwegian adults tested on a treadmill): on average men reach 54.4 and women 43.0 ml/kg/min at 20–29, and lose about 3.5 every decade. It follows your estimated VO₂max, so it moves with your training. The scale starts at 20: below that there is no healthy reference."},
  weight:{name:"Weight",unit:"kg",col:"#d9c46a",fmt:v=>v.toFixed(1),better:0,eps:.2,dfmt:d=>`${Math.abs(d).toFixed(1)} kg`,
    desc:"What you log here every few days, plus any weigh-ins recorded on Intervals. Weigh yourself in the same conditions (morning, after the bathroom, before breakfast): day-to-day swings of 1 kg are mostly water."},
  vo2max:{name:"VO₂max",unit:"ml/kg/min",col:"#5fe08a",fmt:v=>v.toFixed(1),better:1,eps:.3,dfmt:d=>Math.abs(d).toFixed(1),desc:MK.vo2max.desc},
  ftp:{name:"FTP",unit:"W",col:"#3a9cf5",fmt:v=>String(Math.round(v)),better:1,eps:2,dfmt:d=>`${Math.abs(Math.round(d))} W`,desc:MK.ftp.desc},
  wkg:{name:"Power to weight",unit:"W/kg",col:"#6fd3e6",fmt:v=>v.toFixed(2),better:1,eps:.03,dfmt:d=>Math.abs(d).toFixed(2),
    desc:"FTP divided by your weight on that day. On long climbs like the Dolomites it matters more than FTP alone."},
  lthr:{name:"LTHR",unit:"bpm",col:"#f07a8c",fmt:v=>String(Math.round(v)),better:0,eps:1,dfmt:d=>`${Math.abs(Math.round(d))} bpm`,
    desc:"Running lactate-threshold heart rate: roughly the highest heart rate you can hold for about an hour. It is the anchor for the threshold pace. Update it after a 30-minute time trial (average heart rate of the last 20 minutes) or when Intervals finds a new one."},
  thr_pace:{name:"Threshold pace",unit:"/km",col:"#e9a15a",fmt:v=>paceTxt(v),better:-1,eps:2,inv:1,dfmt:d=>`${Math.abs(Math.round(d))}s`,
    desc:"The pace you would hold at your LTHR, worked out from every steady run: pace and heart rate are close to a straight line up to threshold, so each run is scaled to your LTHR. Median of the last 30 days; a lower time per km is better."},
  easy_pace:{name:"Easy pace",unit:"/km",col:"#f2a65a",fmt:v=>paceTxt(v),better:-1,eps:2,inv:1,dfmt:d=>`${Math.abs(Math.round(d))}s`,desc:MK.easy_pace.desc},
};
function athLast(key){const s=athSeries(key);return s.length?s[s.length-1]:null;}
function athDelta(key,days=30){
  const s=athSeries(key),l=s[s.length-1];if(!l) return null;
  const lim=new Date(new Date(l.date+"T12:00")-days*864e5).toLocaleDateString("sv-SE");
  const old=[...s].reverse().find(p=>p.date<=lim);
  return old?l.v-old.v:null;
}
function athDeltaTxt(key,days=30){
  const d=athDelta(key,days),m=AM[key];if(d==null) return ["",""];
  if(Math.abs(d)<m.eps) return [`Stable over ${days} days`,""];
  const sign=(m.inv?-d:d)>0?"+":"−",good=m.better===0?"":(d*m.better>0?"up":"down");
  const txt=m.inv?`${d<0?"−":"+"}${m.dfmt(d)} in ${days} days`:key==="fitage"?`${d<0?"−":"+"}${m.dfmt(d)} in ${days} days`:`${d>0?"+":"−"}${m.dfmt(d)} in ${days} days`;
  return [txt,good];
}
function sparkAth(key){
  const s=athSeries(key).filter(p=>p.date>=new Date(Date.now()-90*864e5).toLocaleDateString("sv-SE"));
  if(s.length<2) return `<svg viewBox="0 0 100 26"></svg>`;
  const t0=+new Date(s[0].date),t1=+new Date(s[s.length-1].date)||t0+1,vs=s.map(p=>p.v);
  let lo=Math.min(...vs),hi=Math.max(...vs);if(hi-lo<1e-6){lo-=1;hi+=1;}
  const inv=AM[key].inv,x=p=>(+new Date(p.date)-t0)/Math.max(1,t1-t0)*100,y=v=>inv?3+(v-lo)/(hi-lo)*20:23-(v-lo)/(hi-lo)*20;
  const pts=s.map(p=>`${x(p).toFixed(1)},${y(p.v).toFixed(1)}`).join(" "),l=s[s.length-1];
  return `<svg viewBox="0 0 100 26" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${AM[key].col}" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke" opacity=".85"/>
    <circle cx="${x(l)}" cy="${y(l.v)}" r="2.2" fill="${AM[key].col}" vector-effect="non-scaling-stroke"/></svg>`;
}
function amkCard(key,sub){
  const m=AM[key],l=athLast(key);
  if(!l) return `<button class="amk" disabled><small>${m.name.toUpperCase()}</small><b>–</b><span>${key==="weight"?"Tap to log":"Not enough data yet"}</span></button>`;
  const [dt,cls]=athDeltaTxt(key);
  return `<button class="amk" data-am="${key}"><small>${m.name.toUpperCase()}</small><b>${m.fmt(l.v)}<u>${m.unit}</u></b>
    <span class="${cls}">${esc(dt||sub||"")}</span>${dt&&sub?`<span>${esc(sub)}</span>`:""}${sparkAth(key)}</button>`;
}
function athHero(){
  const P=athProfile(),w=athLast("weight");
  if(!P.birth||!P.sex) return `<button class="ath-hero" id="ath-edit"><div class="ah-empty"><b>Set up your profile</b><span>Birth date, sex and height: your age updates by itself and your fitness age appears here.</span></div></button>`;
  const age=ageNow(P.birth),fa=athLast("fitage"),bmi=w&&P.height?w.v/(P.height/100)**2:null;
  let fit="–",fsub="Needs a few steady sessions",scale="";
  if(fa){
    const diff=fa.age-fa.v,col=diff>=0?"var(--alpine)":"var(--amber)";
    fit=`<em style="font-style:normal;color:${col}">${yrs(fa.v)}</em>`;
    fsub=fa.v<=20?"At least as fit as the average 20-year-old":Math.abs(diff)<1?"Same as your age":`${Math.abs(diff).toFixed(1)} years ${diff>0?"younger":"older"}`;
    const lo=20,hi=Math.max(70,Math.ceil((Math.max(age,fa.v)+10)/10)*10),pc=v=>clip((v-lo)/(hi-lo)*100,0,100);
    const a=pc(age),f=pc(fa.v);
    scale=`<div class="ah-scale"><div class="tr"></div><div class="lnk" style="left:${Math.min(a,f)}%;width:${Math.abs(a-f)}%;background:${col}"></div>
      <i class="real" style="left:${a}%"></i><i style="left:${f}%;background:${col};box-shadow:0 0 12px ${col}"></i>
      <em style="left:0;transform:none">${lo}</em><em style="left:100%;transform:translateX(-100%)">${hi}</em></div>`;
  }
  return `<div class="ath-hero" role="group"><div class="ah-row">
      <button class="hb" id="ath-edit"><small>AGE</small><b>${age}<u>years</u></b><span>Born ${esc(fmtDay(P.birth,{day:"numeric",month:"short",year:"numeric"}))}</span></button>
      <button class="hb" id="ath-fit" ${fa?"":"disabled"}><small>FITNESS AGE</small><b>${fit}<u>years</u></b><span>${esc(fsub)}</span></button></div>
    ${scale}
    <div class="ah-facts">${P.height?`<span>Height <b>${P.height} cm</b></span>`:""}${w?`<span>Weight <b>${w.v.toFixed(1)} kg</b></span>`:""}${bmi?`<span>BMI <b>${bmi.toFixed(1)}</b></span>`:""}<span>${P.sex==="m"?"Male":"Female"}</span></div></div>`;
}
// Food lives inside Athlete, as an optional second page (it can be hidden in Settings)
let ATH_SUB="profile";
const foodOn=()=>LS.get("rd_food_off")!=="1";
const athSwitch=()=>pageBar("athlete");
function bindSwitch(){}
function renderAthlete(){
  if(PG.athlete!=="profile"&&!foodOn()) PG.athlete="profile";
  ATH_SUB=PG.athlete==="profile"?"profile":"food";
  if(ATH_SUB==="food") return renderFood();
  ATH_CACHE=null; if(!foodSel) foodSel=todayISO();
  const ftp=athLast("ftp"),wk=athLast("wkg"),L=athLast("lthr"),src=DATA.athlete?.lthr_src;
  const lsub=athEntries("lthr")&&Object.keys(athEntries("lthr")).length?"Set by you":src==="intervals"?"From Intervals":src==="estimate"?"Estimated · tap to set":"";
  $("app").innerHTML=`
  <div class="top"><div class="ttl">Athlete</div><span class="tb">${ASK}<button class="gear" id="gear" aria-label="Settings">${GEAR}</button></span></div>
  ${athSwitch()}
  ${athHero()}
  <section class="sec"><div class="sec-h"><h2>Body</h2><span>Tap for history</span></div>
    <div class="amks">${amkCard("weight")}${amkCard("vo2max","Estimated from your sessions")}</div></section>
  <section class="sec"><div class="sec-h"><h2>Cycling</h2><span>Tap for history</span></div>
    <div class="amks">${amkCard("ftp",wk?`${wk.v.toFixed(2)} W/kg`:"")}${amkCard("wkg")}</div></section>
  <section class="sec"><div class="sec-h"><h2>Running</h2><span>Tap for history</span></div>
    <div class="amks">${amkCard("lthr",lsub)}${amkCard("thr_pace",L?`at ${Math.round(L.v)} bpm`:"")}${amkCard("easy_pace",DATA.fitness?.easy_hr?`at ${DATA.fitness.easy_hr} bpm`:"")}</div></section>
  ${foodOn()?`<details class="more" id="balance" ${BAL_OPEN?"open":""}><summary><span>Energy balance &amp; weight goal</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></summary>${trendCard()}${weekCard(false)}${goalCard()}${balanceSection()}</details>`:""}
  <p class="foot">Age and fitness age update by themselves. Log your weight every 3–4 days, same conditions: the calorie range follows its trend.</p>`;
  $("gear").onclick=openSettings;
  $("ath-edit").onclick=openProfile; bindSwitch();
  const f=$("ath-fit"); if(f) f.onclick=()=>openAth("fitage");
  const bd=$("balance"); if(bd){ bd.addEventListener("toggle",()=>{BAL_OPEN=bd.open;});
    const bon=(id,fn)=>{const e=$(id); if(e) e.onclick=fn;}; bon("goal-c",openGoal); bon("wt-c",()=>openAth("weight")); if($("bal-r")) bindBalance(); }
  document.querySelectorAll(".amk[data-am]").forEach(b=>b.onclick=()=>openAth(b.dataset.am));
  document.querySelectorAll(".amk[disabled]").forEach(b=>{if(b.textContent.includes("Tap to log")){b.disabled=false;b.onclick=()=>openAth("weight");}});
}
function openProfile(){
  const P=athProfile();let sex=P.sex||null;
  openSheet(`<div class="sh-top"><h2>Profile</h2>${X}</div>
    <p class="sh-desc">Used for your age, fitness age, BMI and power to weight. Stored encrypted, like the rest of your data.</p>
    <div class="field"><label for="p-b">Birth date</label><input id="p-b" type="date" value="${esc(P.birth||"")}" max="${todayISO()}"></div>
    <div class="field"><label>Sex</label><div class="seg two" id="p-s"><button data-v="m" class="${sex==="m"?"on":""}">Male</button><button data-v="f" class="${sex==="f"?"on":""}">Female</button></div><p>Fitness age is compared with people of the same sex.</p></div>
    <div class="field"><label for="p-h">Height (cm)</label><input id="p-h" type="number" inputmode="numeric" min="120" max="230" value="${esc(P.height||"")}"></div>
    <div class="savebar" style="margin-top:22px"><span class="st" id="p-st"></span><button class="btn" id="p-save">Save</button></div>`);
  $("p-s").querySelectorAll("button").forEach(b=>b.onclick=()=>{sex=b.dataset.v;$("p-s").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));});
  $("p-save").onclick=async()=>{
    const birth=$("p-b").value,h=+$("p-h").value;
    if(!birth||!sex){$("p-st").textContent="Birth date and sex are needed.";return;}
    const obj={birth,sex,height:h>=120&&h<=230?Math.round(h):null,ts:Date.now()};
    LS.set("ath_profile",JSON.stringify(obj));closeSheet();render();
    sendQ("profile",obj);
  };
}
async function logMetric(key,date,value){
  const loc=lsJSON("ath_m_"+key,{});loc[date]=value;LS.set("ath_m_"+key,JSON.stringify(loc));ATH_CACHE=null;
  return sendQ("metric",{key,date,value});
}
let athPick=null;
function athChart(key,days){
  const m=AM[key],all=athSeries(key),lim=days?new Date(Date.now()-days*864e5).toLocaleDateString("sv-SE"):"";
  const s=all.filter(p=>p.date>=lim);
  if(!s.length) return "<p class='sh-desc'>No values in this period yet.</p>";
  const W=320,H=170,PL=4,PR=42,PT=12,PB=8;
  const t0=days?+new Date(lim):+new Date(s[0].date),t1=Math.max(+new Date(todayISO()),+new Date(s[s.length-1].date));
  const gl=key==="weight"?goalGet():null;
  const vals=s.map(p=>p.v).concat(key==="fitage"?s.map(p=>p.age):[]).concat(gl?[gl.target]:[]);
  let lo=Math.min(...vals),hi=Math.max(...vals);const pad=(hi-lo)*.15||Math.max(m.eps*3,Math.abs(hi)*.01);lo-=pad;hi+=pad;
  const x=d=>PL+(+new Date(d)-t0)/Math.max(1,t1-t0)*(W-PL-PR),y=v=>m.inv?PT+(v-lo)/(hi-lo)*(H-PT-PB):PT+(hi-v)/(hi-lo)*(H-PT-PB);
  const pick=athPick==null||athPick>=s.length?s.length-1:athPick,pk=s[pick];
  const line=s.map(p=>`${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const ref=key==="fitage"?`<polyline points="${s.map(p=>`${x(p.date).toFixed(1)},${y(p.age).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--muted)" stroke-width="1.4" stroke-dasharray="4 4" opacity=".7"/>`:"";
  const r=s.length>60?2:s.length>20?2.8:4.2;
  const dots=s.map((p,i)=>`<circle cx="${x(p.date).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${i===pick?r+2:r}" fill="${i===pick?m.col:"var(--surface)"}" stroke="${m.col}" stroke-width="${s.length>60&&i!==pick?1.4:2}"/>`).join("");
  const ticks=[hi-pad,lo+pad].map(v=>`<line x1="${PL}" x2="${W-PR+4}" y1="${y(v)}" y2="${y(v)}" stroke="var(--muted)" stroke-dasharray="3 4" opacity=".4"/><text x="${W-PR+8}" y="${y(v)+4}" class="rl">${m.fmt(v)}</text>`).join("");
  const extra=key==="fitage"?`<span style="margin-left:auto">age ${pk.age.toFixed(1)}</span>`:key==="ftp"||key==="wkg"?"":"";
  const WT=key==="weight"&&typeof weightTrend==="function"?weightTrend():null;let trend="";
  if(WT&&WT.ok){const a=WT.from<new Date(t0).toLocaleDateString("sv-SE")?new Date(t0).toLocaleDateString("sv-SE"):WT.from,b=todayISO(),cy=v=>clip(y(v),PT,H-PB);
    trend=`<line x1="${x(a).toFixed(1)}" x2="${x(b).toFixed(1)}" y1="${cy(WT.at(a)).toFixed(1)}" y2="${cy(WT.at(b)).toFixed(1)}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 4" stroke-linecap="round" opacity=".9"/>`;}
  return `<div class="readout"><span>${fmtDay(pk.date,{weekday:"short",day:"numeric",month:"short",year:days&&days<=90?undefined:"2-digit"})}</span><b>${m.fmt(pk.v)}</b><em style="color:${m.col}">${m.unit}</em>${extra}</div>
    <div class="sh-chart"><svg id="ath-svg" viewBox="0 0 ${W} ${H}" style="touch-action:pan-y">${ticks}
      <line x1="${x(pk.date)}" x2="${x(pk.date)}" y1="${PT}" y2="${H-PB}" stroke="var(--muted)" opacity=".5"/>${ref}
      ${gl?`<line x1="${PL}" x2="${W-PR+4}" y1="${y(gl.target)}" y2="${y(gl.target)}" stroke="#5fc795" stroke-dasharray="5 4" opacity=".8"/><text x="${PL+4}" y="${y(gl.target)-6}" class="rl" style="fill:#5fc795">goal ${gl.target.toFixed(1)}</text>`:""}
      ${s.length>1?`<polyline points="${line}" fill="none" stroke="${m.col}" stroke-width="2" stroke-linejoin="round"/>`:""}${trend}${dots}
      <rect x="0" y="0" width="${W}" height="${H}" fill="transparent" style="cursor:pointer"/></svg>
    <div class="ax"><span>${fmtDay(new Date(t0).toLocaleDateString("sv-SE"),{day:"numeric",month:"short",year:"2-digit"})}</span><span>${fmtDay(new Date(t1).toLocaleDateString("sv-SE"),{day:"numeric",month:"short",year:"2-digit"})}</span></div>
    ${key==="fitage"?`<div class="lg">Dashed: your real age</div>`:""}${trend?`<div class="lg">Dashed amber: the trend of your last three weeks, the one the calorie range follows</div>`:""}</div>`;
}
function athBindChart(key,days){
  const svg=$("ath-svg");if(!svg) return;
  const s=athSeries(key).filter(p=>p.date>=(days?new Date(Date.now()-days*864e5).toLocaleDateString("sv-SE"):""));
  svg.onclick=e=>{const b=svg.getBoundingClientRect(),vx=(e.clientX-b.left)/b.width*320;
    let best=0,bd=1e9;svg.querySelectorAll("circle").forEach((c,i)=>{const d=Math.abs(+c.getAttribute("cx")-vx);if(d<bd){bd=d;best=i;}});
    athPick=best;openAth(key,days,true);};
}
const ATH_R=[[30,"30 days"],[90,"90 days"],[365,"1 year"],[0,"All"]];
function openAth(key,days=90,keep=false){
  if(!keep) athPick=null;
  ATH_CACHE=null;
  const m=AM[key],l=athLast(key),y=$("sheet").scrollTop,P=athProfile();
  let extra="";
  if(key==="weight"){
    const ent=Object.entries(athEntries("weight")).sort().reverse().slice(0,8);
    const gs=goalState();
    extra=`<button class="goal-c" id="w-goal" style="margin:14px 0 4px">${gs?`<b style="font-size:15px">Goal ${gs.g.target.toFixed(1)} kg</b><span>${gs.dir===0?"Reached · maintaining":`${gs.g.pace} kg a week · around ${fmtDay(gs.eta,{day:"numeric",month:"short"})}`} · tap to edit</span>`:`<b style="font-size:15px">Set a weight goal</b><span>Your daily calorie target in Food then follows it.</span>`}</button>
      <h3 class="sh-sub">Log weight</h3>
      <div class="ath-log"><div class="field"><label for="w-d">Date</label><input id="w-d" type="date" value="${todayISO()}" max="${todayISO()}"></div>
        <div class="field"><label for="w-v">Kg</label><input id="w-v" type="number" inputmode="decimal" step="0.1" min="30" max="200" placeholder="${l?l.v.toFixed(1):"70.0"}"></div>
        <button class="btn" id="w-save">Save</button></div><p class="st" id="w-st" style="font-size:13px;color:var(--muted);margin:-6px 0 10px"></p><div id="w-adh"></div>
      ${ent.length?ent.map(([d,v])=>`<div class="ent"><span>${esc(fmtDay(d,{weekday:"short",day:"numeric",month:"short",year:"numeric"}))}</span><b>${(+v).toFixed(1)} kg</b><button data-del="${d}" aria-label="Delete">Delete</button></div>`).join(""):""}`;
  } else if(key==="lthr"){
    const own=Object.keys(athEntries("lthr")).length,src=DATA.athlete?.lthr_src;
    extra=`<p class="src">${own?"Set by you.":src==="intervals"?"Taken from your running settings on Intervals until you set your own.":src==="estimate"?`Estimated as 88% of your heart-rate reserve (rest ${DATA.fitness?.rest}, max ${DATA.fitness?.hrmax}) until you set your own.`:""}</p>
      <h3 class="sh-sub">Set LTHR</h3>
      <div class="ath-log"><div class="field"><label for="w-d">From</label><input id="w-d" type="date" value="${todayISO()}" max="${todayISO()}"></div>
        <div class="field"><label for="w-v">Bpm</label><input id="w-v" type="number" inputmode="numeric" min="120" max="215" placeholder="${l?Math.round(l.v):""}"></div>
        <button class="btn" id="w-save">Save</button></div><p class="st" id="w-st" style="font-size:13px;color:var(--muted);margin:-6px 0 10px"></p>`;
  } else if(key==="fitage"&&l){
    const age=yearsAt(P.birth,todayISO()),vo=athLast("vo2max").v,ex=expectedVO2(P.sex,age);
    extra=`<div class="kv"><span>Your VO₂max (estimated)</span><b>${vo.toFixed(1)}</b><span>Average healthy ${P.sex==="m"?"man":"woman"} your age</span><b>${ex.toFixed(1)}</b>
      <span>Difference</span><b style="color:${vo>=ex?"var(--alpine)":"var(--amber)"}">${vo>=ex?"+":"−"}${Math.abs(vo-ex).toFixed(1)}</b><span>Each 1 ml/kg/min is worth</span><b>~3 years</b></div>`;
  } else if((key==="vo2max"||key==="easy_pace")&&DATA.fitness){
    extra=`<div class="kv"><span>Heart rate used (rest / max)</span><b>${DATA.fitness.rest} / ${DATA.fitness.hrmax}</b></div>`;
  } else if(key==="thr_pace"){
    const L=athLast("lthr");extra=`<div class="kv"><span>LTHR used</span><b>${L?Math.round(L.v)+" bpm":"–"}</b><span>Steady runs in the last 30 days</span><b>${(DATA.fitness?.runs||[]).filter(r=>r.date>new Date(Date.now()-30*864e5).toLocaleDateString("sv-SE")).length}</b></div>`;
  }
  const [dt]=athDeltaTxt(key,days&&days<365?days:30);
  openSheet(`<div class="sh-top"><h2>${m.name}</h2>${X}</div>
    <div class="sh-big" style="color:${m.col}">${l?m.fmt(l.v):"–"}<small>${m.unit}</small></div>
    ${dt?`<p class="src" style="margin:2px 0 6px">${esc(dt)}</p>`:""}
    <p class="sh-desc">${m.desc}</p>
    <div class="range">${ATH_R.map(([n,t])=>`<button data-n="${n}" class="${n===days?"on":""}">${t}</button>`).join("")}</div>
    ${athChart(key,days)}${extra}`);
  if(keep) $("sheet").scrollTop=y;
  athBindChart(key,days);
  const wg=$("w-goal"); if(wg) wg.onclick=openGoal;
  $("sheet").querySelectorAll(".range button").forEach(b=>b.onclick=()=>openAth(key,+b.dataset.n));
  const sv=$("w-save");
  if(sv) sv.onclick=async()=>{
    const d=$("w-d").value,v=+String($("w-v").value).replace(",",".");
    const ok=key==="weight"?v>=30&&v<=200:v>=120&&v<=215;
    if(!d||!ok){$("w-st").textContent=key==="weight"?"Enter a weight between 30 and 200 kg.":"Enter a heart rate between 120 and 215.";return;}
    sv.disabled=true;const sent=await logMetric(key,d,key==="weight"?Math.round(v*10)/10:Math.round(v));
    openAth(key,days);renderIfAthlete();
    $("w-st").textContent=sent?"Saved.":"Saved on this phone: it goes out as soon as you're back online.";
    if(key==="weight"&&foodOn()&&d>=isoAdd(todayISO(),-2)) adhAsk(d);
  };
  $("sheet").querySelectorAll("button[data-del]").forEach(b=>b.onclick=async()=>{await logMetric(key,b.dataset.del,null);openAth(key,days);renderIfAthlete();});
}
// one tap after a weigh-in, instead of a food diary
function adhAsk(date){
  const box=$("w-adh");if(!box) return;
  box.innerHTML=`<div class="note-card" style="margin:4px 0 14px"><b>One tap, instead of a food diary</b><p style="margin:6px 0 10px">Since your last weigh-in, compared with your plan you ate:</p>
    <div class="seg three" id="adh-s"><button data-a="-1"><b>Less</b><span>Skipped, smaller</span></button><button data-a="0"><b>About that</b><span>Close to it</span></button><button data-a="1"><b>More</b><span>Extras, bigger</span></button></div></div>`;
  box.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{adhSet(date,+b.dataset.a);buzz();try{trimCheck();}catch(e){}
    box.innerHTML=`<p class="st" style="font-size:13px;color:var(--muted);margin:0 0 12px">Noted. Weight and this answer together decide whether your range moves.</p>`;renderIfAthlete();});
}
function renderIfAthlete(){ if(TAB==="athlete"){const y=scrollY;renderAthlete();scrollTo(0,y);} }

