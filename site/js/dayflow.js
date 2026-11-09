"use strict";
/* ------------------------------------------------------------ the day, hour by hour */
let DFTAB=LS.get("rd_dftab")||"energy";
const DF_W=320,DF_H=118,DF_T=6;
const dfX=k=>k/288*DF_W;
const dfClock=k=>`${String(Math.floor(k*5/60)).padStart(2,"0")}:${String(k*5%60).padStart(2,"0")}`;
const enBand=v=>v>=75?["High","#5fe08a"]:v>=40?["Medium","#e5c33f"]:v>=20?["Low","#ee8a3a"]:["Very low","#ff5d6c"];
function dfPath(vals,y){
  let d="",pen=false;
  vals.forEach((v,k)=>{if(v==null){pen=false;return;}d+=`${pen?"L":"M"}${(dfX(k)+DF_W/576).toFixed(1)} ${y(v).toFixed(1)}`;pen=true;});
  return d;
}
function dfLast(v){for(let k=v.length-1;k>=0;k--) if(v[k]!=null) return k;return -1;}
function dfStress15(st){
  const out=[];for(let k=0;k<288;k+=3){const w=st.slice(k,k+3).filter(x=>x!=null);
    if(!w.length){out.push(null);continue;}const act=w.filter(x=>x<0).length,ok=w.filter(x=>x>=0);
    out.push(act*2>w.length||!ok.length?-1:Math.round(mean(ok)));}
  return out;
}
function dfBands(F,raw){
  const H=DF_H;
  let s=(F.sleep||[]).map(([a,b])=>`<rect x="${dfX(a).toFixed(1)}" y="${DF_T}" width="${(dfX(b+1)-dfX(a)).toFixed(1)}" height="${H-DF_T}" fill="#a78bfa" fill-opacity=".09"/>`).join("");
  (raw.workouts||[]).forEach(w=>{if(!w.start||!w.minutes) return;const [h,m]=w.start.split(":").map(Number),a=(h*60+m)/5,b=a+w.minutes/5;
    s+=`<rect x="${dfX(a).toFixed(1)}" y="${DF_T}" width="${Math.max(2,dfX(b)-dfX(a)).toFixed(1)}" height="${H-DF_T}" fill="#f97316" fill-opacity=".13"/>`;});
  return s;
}
function dfAxis(){
  let t="";for(let h=0;h<=24;h+=6){const x=dfX(h*12);t+=`<line x1="${x}" x2="${x}" y1="${DF_T}" y2="${DF_H}" stroke="#fff" stroke-opacity=".05"/>
    <text x="${x}" y="${DF_H+13}" text-anchor="${h===0?"start":h===24?"end":"middle"}">${String(h%24).padStart(2,"0")}:00</text>`;}
  return t;
}
function dfChart(F,raw){
  const H=DF_H,inner=H-DF_T;let body="",extra="";
  if(DFTAB==="energy"){
    const y=v=>DF_T+inner*(1-v/100),p=dfPath(F.energy,y),k0=F.energy.findIndex(v=>v!=null),k1=dfLast(F.energy);
    body=`<defs><linearGradient id="dfg" gradientUnits="userSpaceOnUse" x1="0" y1="${DF_T}" x2="0" y2="${H}">
      <stop offset="0" stop-color="#5fe08a"/><stop offset=".45" stop-color="#e5c33f"/><stop offset=".8" stop-color="#ee8a3a"/><stop offset="1" stop-color="#ff5d6c"/></linearGradient></defs>
      ${k1>k0?`<path d="${p} L${(dfX(k1)+DF_W/576).toFixed(1)} ${H} L${(dfX(k0)+DF_W/576).toFixed(1)} ${H}Z" fill="url(#dfg)" fill-opacity=".16"/>`:""}
      <path d="${p}" fill="none" stroke="url(#dfg)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }else if(DFTAB==="hr"){
    const v=F.hr.filter(x=>x!=null),lo=Math.min(...v,F.rest)-6,hi=Math.max(...v)+6,y=x=>DF_T+inner*(1-(x-lo)/(hi-lo));
    body=`<line x1="0" x2="${DF_W}" y1="${y(F.rest).toFixed(1)}" y2="${y(F.rest).toFixed(1)}" stroke="var(--muted)" stroke-opacity=".6" stroke-dasharray="3 4"/>
      <text x="${DF_W}" y="${(y(F.rest)-4).toFixed(1)}" text-anchor="end">resting ${F.rest}</text>
      <path d="${dfPath(F.hr,y)}" fill="none" stroke="var(--hr)" stroke-width="1.5" stroke-linejoin="round"/>`;
  }else{
    const b=dfStress15(F.stress),bw=DF_W/96;
    body=b.map((v,i)=>{if(v==null) return "";if(v<0) return `<rect x="${(i*bw+.4).toFixed(1)}" y="${H-8}" width="${(bw-.8).toFixed(1)}" height="8" rx="1" fill="#22d3ee" fill-opacity=".55"/>`;
      const h=Math.max(1.5,inner*v/100);return `<rect x="${(i*bw+.4).toFixed(1)}" y="${(H-h).toFixed(1)}" width="${(bw-.8).toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${stressBand(Math.max(1,v))[2]}"/>`;}).join("");
  }
  extra=`<line id="df-cur" x1="0" x2="0" y1="${DF_T}" y2="${H}" stroke="var(--text)" stroke-opacity=".55" stroke-width="1" visibility="hidden"/><circle id="df-dot" r="3.5" fill="var(--text)" visibility="hidden"/>`;
  return `<svg viewBox="0 0 ${DF_W} ${H+16}" id="df-svg">${dfBands(F,raw)}${dfAxis()}${body}${extra}</svg>`;
}
function dfRead(F,k){
  const t=k==null?"":`<span class="t">${dfClock(k)}</span>`;
  const asleep=k!=null&&(F.sleep||[]).some(([a,b])=>k>=a&&k<=b);
  if(DFTAB==="energy"){const kk=k??dfLast(F.energy),v=F.energy[kk];if(v==null) return `<span>No data</span>${t}`;const [n,c]=enBand(v);
    return `<b>${Math.round(v)}</b><em style="color:${c}">${n}</em><span>${k==null?"now":asleep?"asleep, recharging":""}</span>${k==null?`<span class="t">${dfClock(kk)}</span>`:t}`;}
  if(DFTAB==="hr"){const kk=k??dfLast(F.hr),v=F.hr[kk];if(v==null) return `<span>No reading</span>${t}`;
    return `<b>${v}</b><em style="color:var(--hr)">bpm</em><span>${asleep?"asleep":kk===dfLast(F.hr)&&k==null?"latest":""}</span>${k==null?`<span class="t">${dfClock(kk)}</span>`:t}`;}
  const b=dfStress15(F.stress);
  if(k==null){const ok=b.filter(v=>v!=null&&v>=0);if(!ok.length) return `<span>No data yet</span>`;const a=Math.round(mean(ok)),sb=stressBand(Math.max(1,a));
    return `<b>${a}</b><em style="color:${sb[2]}">${sb[1]}</em><span>awake average</span>`;}
  const v=b[Math.floor(k/3)];
  if(v==null) return `<span>${asleep?"Asleep":"No reading"}</span>${t}`;
  if(v<0) return `<b style="font-size:22px">Activity</b><span>heart rate from exercise</span>${t}`;
  const sb=stressBand(Math.max(1,v));return `<b>${v}</b><em style="color:${sb[2]}">${sb[1]}</em>${t}`;
}
function dfStats(F){
  const awake=(v,k)=>v!=null&&!(F.sleep||[]).some(([a,b])=>k>=a&&k<=b);
  if(DFTAB==="energy"){let up=0,dn=0;for(let k=1;k<288;k++){const a=F.energy[k-1],b=F.energy[k];if(a==null||b==null) continue;if(b>a) up+=b-a; else dn+=a-b;}
    const v=F.energy.filter(x=>x!=null);
    return [["Charged",`+${Math.round(up)}`],["Drained",`−${Math.round(dn)}`],["Lowest",v.length?Math.round(Math.min(...v)):"–"]];}
  if(DFTAB==="hr"){const aw=F.hr.filter(awake);return [["Resting",`${F.rest} bpm`],["Awake avg",aw.length?`${Math.round(mean(aw))} bpm`:"–"],["Max",aw.length?`${Math.max(...F.hr.filter(x=>x!=null))} bpm`:"–"]];}
  const ok=F.stress.filter(x=>x!=null&&x>=0),act=F.stress.filter(x=>x===-1).length;
  return [["Calm",hmh(ok.filter(x=>x<=25).length*5/60)],["High",hmh(ok.filter(x=>x>75).length*5/60)],["Activity",hmh(act*5/60)]];
}
const DF_NOTE={energy:"Our own estimate from your heart rate: sleep recharges it (more after a good night), being awake and exercise drain it, harder minutes much more.",
  hr:"Every 5 minutes from your watch. The dashed line is your resting heart rate.",
  stress:"Estimated from heart rate while you're not exercising: how far it sits above your resting value. Walking about lifts it too, so read it as a guide. Garmin's own day average is in the Stress tile."};
function dayFlowSection(raw){
  const F=DATA.dayflow?.days?.[raw.date]; if(!F) return "";
  const key=DFTAB==="energy"?`<span><i style="background:linear-gradient(90deg,#ff5d6c,#e5c33f,#5fe08a)"></i>Energy</span>`:DFTAB==="stress"?STRESS.map(b=>`<span><i style="background:${b[2]}"></i>${b[1]}</span>`).join("")+`<span><i style="background:#22d3ee;opacity:.6"></i>Activity</span>`:"";
  return `<section class="sec" id="df-sec"><div class="sec-h"><h2>Hour by hour</h2><span>Touch the chart</span></div>
  <div class="df"><div class="df-tabs" role="tablist">${[["energy","Energy"],["hr","Heart rate"],["stress","Stress"]].map(([k,n])=>`<button role="tab" aria-selected="${DFTAB===k}" class="${DFTAB===k?"on":""}" data-df="${k}">${n}</button>`).join("")}</div>
    <div class="df-read" id="df-read">${dfRead(F,null)}</div>
    <div class="df-chart" id="df-chart">${dfChart(F,raw)}</div>
    <div class="df-key">${key}<span><i style="background:#a78bfa;opacity:.35"></i>Sleep</span>${(raw.workouts||[]).some(w=>w.start)?`<span><i style="background:#f97316;opacity:.45"></i>Workout</span>`:""}</div>
    <div class="df-stats">${dfStats(F).map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join("")}</div>
    <p class="df-note">${DF_NOTE[DFTAB]}</p></div></section>`;
}
function bindDayFlow(raw){
  const F=DATA.dayflow?.days?.[raw.date],sec=$("df-sec"); if(!F||!sec) return;
  sec.querySelectorAll("[data-df]").forEach(b=>b.onclick=()=>{DFTAB=b.dataset.df;LS.set("rd_dftab",DFTAB);buzz(5);
    sec.outerHTML=dayFlowSection(raw);bindDayFlow(raw);});
  const ch=$("df-chart"),svg=$("df-svg"),cur=$("df-cur"),dot=$("df-dot"),rd=$("df-read");
  const at=e=>{const r=svg.getBoundingClientRect();return clip(Math.floor((e.clientX-r.left)/r.width*288),0,287);};
  const show=k=>{const x=dfX(k)+DF_W/576;cur.setAttribute("x1",x);cur.setAttribute("x2",x);cur.setAttribute("visibility","visible");
    let v=null,y=null;
    if(DFTAB==="energy"){v=F.energy[k];if(v!=null) y=DF_T+(DF_H-DF_T)*(1-v/100);}
    else if(DFTAB==="hr"){v=F.hr[k];if(v!=null){const vs=F.hr.filter(x=>x!=null),lo=Math.min(...vs,F.rest)-6,hi=Math.max(...vs)+6;y=DF_T+(DF_H-DF_T)*(1-(v-lo)/(hi-lo));}}
    if(y!=null){dot.setAttribute("cx",x);dot.setAttribute("cy",y.toFixed(1));dot.setAttribute("visibility","visible");}else dot.setAttribute("visibility","hidden");
    rd.innerHTML=dfRead(F,k);};
  ch.onpointerdown=e=>{show(at(e));ch.setPointerCapture?.(e.pointerId);};
  ch.onpointermove=e=>{if(e.buttons||e.pointerType==="mouse") show(at(e));};
  ch.onpointerleave=()=>{cur.setAttribute("visibility","hidden");dot.setAttribute("visibility","hidden");rd.innerHTML=dfRead(F,null);};
}

