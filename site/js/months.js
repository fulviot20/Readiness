"use strict";
/* ------------------------------------------------------------ monthly reports and long trends */
let monPick=null;
const MON_COL={ctl:"#4aa3ff",hrv:"#a78bfa",rhr:"#f07a8c",sleep_h:"#c4b5fd",hours_week:"#5fc795",weight:"#d9c46a",recovery:"#5fe08a"};
const monName=(ym,o={month:"long",year:"numeric"})=>new Date(ym+"-15T12:00").toLocaleDateString("en-GB",o);
function monList(){return (DATA.monthly?.months||[]);}
function monthSection(){
  const ms=monList(); if(!ms.length) return "";
  const today=new Date(todayISO()+"T12:00"),early=today.getDate()<=7&&ms.length>1;
  const m=early?ms[ms.length-2]:ms[ms.length-1];
  return `<section class="sec"><div class="sec-h"><h2>${early?"Last month":"This month"}</h2><span>${esc(monName(m.month,{month:"long"}))}${m.partial?" so far":""}</span></div>
    <button class="mon-card" onclick="openMonths('${m.month}')"><p>${esc(m.headline||"Not enough data yet.")}</p>
      <span>Monthly reports and long trends<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg></span></button></section>`;
}
function monTile(lab,val,d,better,fmt){
  const dd=d==null||Math.abs(d)<1e-9?"":`<em class="${better===0?"":(d*better>0?"up":"down")}">${d>0?"+":"−"}${fmt(Math.abs(d))}</em>`;
  return `<div><small>${lab}</small><b>${val??"–"}</b>${dd}</div>`;
}
function monSpark(key,fmt){
  const ms=monList().filter(m=>m[key]!=null); if(ms.length<2) return "";
  const W=300,H=54,vals=ms.map(m=>m[key]),lo=Math.min(...vals),hi=Math.max(...vals),pad=(hi-lo)*.15||1;
  const x=i=>8+i*(W-16)/(ms.length-1),y=v=>6+(H-12)*(1-(v-lo+pad)/(hi-lo+2*pad));
  const pts=ms.map((m,i)=>`${x(i).toFixed(1)},${y(m[key]).toFixed(1)}`).join(" "),col=MON_COL[key]||"var(--text)";
  return `<svg viewBox="0 0 ${W} ${H+14}" class="mon-sp"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${ms.map((m,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(m[key]).toFixed(1)}" r="${i===ms.length-1?3.5:2.2}" fill="${col}" ${m.partial?'fill-opacity=".45"':""}/>`).join("")}
    <text x="8" y="${H+12}">${esc(monName(ms[0].month,{month:"short"}))}</text><text x="${W-8}" y="${H+12}" text-anchor="end">${esc(monName(ms[ms.length-1].month,{month:"short"}))}</text></svg>`;
}
function openMonths(ym,keep){
  const ms=monList(); if(!ms.length) return;
  if(ym) monPick=ym; if(!monPick||!ms.some(m=>m.month===monPick)) monPick=ms[ms.length-1].month;
  const y0=$("sheet").scrollTop;
  openSheet(`<div class="sh-top"><h2>Monthly report</h2>${X}</div>
${monthBody()}`);
  if(keep) $("sheet").scrollTop=y0;
  const c=$("mon-chips"),on=c.querySelector(".on"); if(on) c.scrollLeft=on.offsetLeft-c.clientWidth/2+on.clientWidth/2;
  c.querySelectorAll("[data-mon]").forEach(b=>b.onclick=()=>{monPick=b.dataset.mon;buzz(5);openMonths(null,true);});
}
// the same report, shown as the Month page of Training
function monthBody(){
  const ms=monList();if(!monPick||!ms.some(m=>m.month===monPick)) monPick=ms[ms.length-1].month;
  const m=ms.find(x=>x.month===monPick),v=m.vs_prev||{},T=DATA.monthly.trend;
  const hrs=h=>h?hmh(h):"–",one=n=>(Math.round(n*10)/10).toString();
  return `    <div class="mon-chips" id="mon-chips">${ms.map(x=>`<button class="${x.month===monPick?"on":""}" data-mon="${x.month}">${esc(monName(x.month,{month:"short",year:x.month.slice(0,4)===todayISO().slice(0,4)?undefined:"2-digit"}))}</button>`).join("")}</div>
    <h3 class="mon-t">${esc(monName(m.month))}${m.partial?` <span>so far, ${m.days} days</span>`:""}</h3>
    ${m.headline?`<p class="ch-lead">${esc(m.headline)}</p>`:""}
    <div class="wr-g mon-g">
      ${monTile("RECOVERY",m.recovery,v.recovery,1,n=>Math.round(n))}
      ${monTile("SLEEP / NIGHT",hrs(m.sleep_h),v.sleep_h,1,n=>Math.round(n*60)+" min")}
      ${monTile("HRV",m.hrv!=null?`${Math.round(m.hrv)}<u>ms</u>`:null,v.hrv,1,n=>Math.round(n)+" ms")}
      ${monTile("RESTING HR",m.rhr!=null?`${Math.round(m.rhr)}<u>bpm</u>`:null,v.rhr,-1,n=>one(n))}
      ${monTile("TRAINING / WEEK",m.hours_week?hmh(m.hours_week):"–",v.hours_week,0,n=>hmh(n))}
      ${monTile("FITNESS (CTL)",m.ctl!=null?Math.round(m.ctl):null,v.ctl,1,n=>Math.round(n))}
    </div>
    <div class="wr-m">${m.sessions?`<span><b>${m.sessions}</b> sessions</span>`:""}${m.ride_km?`<span>Ride <b>${m.ride_km} km</b></span>`:""}${m.run_km?`<span>Run <b>${m.run_km} km</b></span>`:""}${m.weight!=null?`<span>Weight <b>${m.weight} kg</b></span>`:""}${m.ftp?`<span>FTP <b>${Math.round(m.ftp)} W</b></span>`:""}</div>
    ${(m.lines||[]).filter(l=>l!==m.headline).length?`<div class="ch-sec"><h3>What happened</h3><ul class="ch-tips">${m.lines.filter(l=>l!==m.headline).map(l=>`<li>${esc(l)}</li>`).join("")}</ul></div>`:""}
    ${T&&T.items?.length?`<div class="ch-sec"><h3>Long trends<span>last ${T.months} complete months</span></h3>
      <ul class="mon-tr">${T.items.map(t=>`<li class="${t.dir===0?"":t.good===true?"good":t.good===false?"bad":""}">${esc(t.text)}</li>`).join("")}</ul>
      ${[["ctl","Fitness (CTL)",n=>Math.round(n)],["hrv","Overnight HRV",n=>Math.round(n)+" ms"],["rhr","Resting heart rate",n=>Math.round(n)+" bpm"],
         ["sleep_h","Sleep per night",n=>hmh(n)],["hours_week","Training per week",n=>hmh(n)],["weight","Weight",n=>n.toFixed(1)+" kg"]]
        .map(([k,n,f])=>{const sp=monSpark(k,f);const last=monList().filter(m=>m[k]!=null).slice(-1)[0];return sp?`<div class="mon-row"><div><small>${n}</small><b>${f(last[k])}</b></div>${sp}</div>`:"";}).join("")}</div>`
      :`<p class="sh-note">Long trends appear after three complete months of data.</p>`}
    <p class="sh-note">Each month is compared with the month before (the small numbers) and, in the text, with the average of the three months before it. Readiness and sleep scores exist only for the last four months.</p>`;
}
function monthPage(){
  if(!monList().length) return `<p class="notice">Monthly reports appear after the first month of data.</p>`;
  return `<section class="sec first" id="mon-page">${monthBody()}</section>`;
}
function bindMonthPage(){
  const c=$("mon-chips");if(!c||!$("mon-page")) return;const on=c.querySelector(".on");if(on) c.scrollLeft=on.offsetLeft-c.clientWidth/2+on.clientWidth/2;
  c.querySelectorAll("[data-mon]").forEach(b=>b.onclick=()=>{monPick=b.dataset.mon;buzz(5);$("mon-page").innerHTML=monthBody();bindMonthPage();});
}
