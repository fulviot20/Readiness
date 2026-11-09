"use strict";
/* ------------------------------------------------------------ sleep coach */
const STAGE_C={deep:"#6d5dfc",rem:"#a78bfa",light:"#c4b5fd",awake:"#f0a5b4"};
const noonMin=ms=>((Math.floor(ms/6e4)%1440)+1440-720)%1440;            // minutes from local noon
const clockN=m=>{const t=Math.round(m+720)%1440;return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`;};
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const mad=a=>{const m=mean(a);return mean(a.map(x=>Math.abs(x-m)));};
let coachPick={debt:null,win:null};
function coachNights(n){
  const out=[];for(let i=Math.max(0,sel-n+1);i<=sel;i++){const s=DATA.days[i].sleep_score;out.push({date:DATA.days[i].date,s:s&&s.hours&&s.need?s:null});}
  return out;
}
function sleepCoach(){
  const n14=coachNights(14),ok=n14.filter(x=>x.s),wk=n14.slice(-7).filter(x=>x.s);
  if(ok.length<3) return null;
  const debt=Math.max(0,wk.reduce((a,x)=>a+(x.s.need-x.s.hours),0));
  const bed=ok.filter(x=>x.s.start).map(x=>noonMin(x.s.start)),wake=ok.filter(x=>x.s.end).map(x=>noonMin(x.s.end));
  const reg=bed.length>=5?{bed:mean(bed),wake:mean(wake),madBed:mad(bed),madWake:mad(wake)}:null;
  if(reg) reg.score=Math.round(clip(100-((reg.madBed+reg.madWake)/2-10)*100/80,0,100));
  const mid=x=>(noonMin(x.s.start)+noonMin(x.s.end)+(noonMin(x.s.end)<noonMin(x.s.start)?1440:0))/2;
  const isWe=d=>[0,6].includes(new Date(d+"T12:00").getDay());               // nights ending Sat or Sun
  const we=ok.filter(x=>x.s.start&&isWe(x.date)).map(mid),wd=ok.filter(x=>x.s.start&&!isWe(x.date)).map(mid);
  const jet=we.length>=2&&wd.length>=3?Math.round(mean(we)-mean(wd)):null;
  const st=ok.filter(x=>x.s.deep!=null&&x.s.hours),avg=k=>st.length>=5?mean(st.map(x=>x.s[k]/x.s.hours)):null;
  return {n14,ok,wk,debt,reg,jet,deepAvg:avg("deep"),remAvg:avg("rem"),need:ok[ok.length-1].s.need,
    awakeAvg:ok.length>=5?mean(ok.map(x=>x.s.awake_min||0)):null};
}
function coachTips(c,night){
  const t=[];
  if(c.debt>=1.5) t.push({k:"debt",lead:`You're about ${hmh(c.debt)} short on sleep this week.`,
    html:`<b>Pay the debt back gradually.</b> 30–45 minutes more on the next few nights works better than one very long lie-in, which shifts your body clock and makes the next night harder.`});
  else if(c.debt>=.5) t.push({k:"debt",lead:`A small sleep debt this week, about ${hmh(c.debt)}.`,
    html:`<b>A small debt, easy to clear.</b> One or two nights a little longer than usual are enough.`});
  if(c.reg&&c.reg.score<60) t.push({k:"reg",lead:"Your sleep times have been moving around a lot.",
    html:`<b>Steadier timing.</b> Your bedtime moved by about ±${Math.round(c.reg.madBed)} min and your wake-up by ±${Math.round(c.reg.madWake)} min. A steady wake-up is the strongest anchor for the body clock: keep it close to your usual one even after a late night, and let an early night pay back the difference.`});
  if(c.jet!=null&&Math.abs(c.jet)>=60) t.push({k:"jet",lead:"Your weekends shift your sleep a lot.",
    html:`<b>Weekend shift of ${hmh(Math.abs(c.jet)/60)}.</b> Your nights are ${c.jet>0?"later":"earlier"} at the weekend than on weekdays: Monday then feels like a small jet lag. Halving the gap already helps.`});
  if(night&&night.awake_min!=null&&c.awakeAvg!=null&&night.awake_min>=Math.max(30,c.awakeAvg*1.6)) t.push({k:"awake",lead:"Last night was broken up more than usual.",
    html:`<b>${night.awake_min} min awake last night</b>, against your usual ${Math.round(c.awakeAvg)}. Late caffeine, alcohol, a heavy dinner or a warm room are the usual suspects: tag the evening in the habit journal and the app will tell you over time which one weighs on you.`});
  if(night&&night.deep!=null&&c.deepAvg&&night.hours&&night.deep/night.hours<c.deepAvg*.7) t.push({k:"deep",lead:"Less deep sleep than your normal last night.",
    html:`<b>Deep sleep below your normal.</b> It is the most restorative phase and it comes mostly in the first half of the night: a regular bedtime and no alcohol in the evening protect it best. One night alone means little, a trend matters more.`});
  if(!t.length) t.push({k:"ok",lead:"Solid week: enough sleep and steady timing.",
    html:`<b>Keep it up.</b> You're covering your need and your timing is steady: that's what makes the hours count.`});
  return t.slice(0,4);
}
function hypnoChart(s){
  const h=s.hyp,end=Math.max(...h.map(x=>x[0]+x[1])),W=320,L=40,H=104,rows=["awake","rem","light","deep"],rh=H/4;
  const names={awake:"Awake",rem:"REM",light:"Light",deep:"Deep"},x=m=>L+(W-L)*clip(m,0,end)/end;
  const blocks=h.map(([a,len,st])=>{const r=rows.indexOf(st);return `<rect x="${x(a).toFixed(1)}" y="${(r*rh+3).toFixed(1)}" width="${Math.max(.8,x(a+len)-x(a)).toFixed(1)}" height="${(rh-6).toFixed(1)}" rx="2" fill="${STAGE_C[st]}"/>`;}).join("");
  const guides=rows.map((r,i)=>`<line x1="${L}" x2="${W}" y1="${(i*rh+rh/2).toFixed(1)}" y2="${(i*rh+rh/2).toFixed(1)}" stroke="#fff" stroke-opacity=".05"/><text class="lb" x="0" y="${(i*rh+rh/2+3.5).toFixed(1)}">${names[r]}</text>`).join("");
  let ticks="";
  if(s.start){const m0=noonMin(s.start);for(let m=Math.ceil((m0)/60)*60-m0;m<=end;m+=60){
    if(end>300&&Math.round((m+m0)/60)%2) continue;
    ticks+=`<text x="${x(m).toFixed(1)}" y="${H+13}" text-anchor="middle">${clockN(m0+m).slice(0,2)}:00</text>`;}}
  return `<div class="ch-chart"><svg viewBox="0 -2 ${W} ${H+18}" role="img" aria-label="Sleep stages along the night">${guides}${blocks}${ticks}</svg></div>`;
}
function debtChart(c){
  const ns=c.n14,W=320,H=96,mid=H/2+6,bw=W/ns.length,sc=(H/2-6)/2,pick=coachPick.debt??ns.length-1,p=ns[pick];
  const bars=ns.map((x,i)=>{if(!x.s) return `<rect x="${(i*bw+bw/2-1).toFixed(1)}" y="${mid-1}" width="2" height="2" fill="var(--line)"/>`;
    const d=clip(x.s.hours-x.s.need,-2,2),hgt=Math.max(2,Math.abs(d)*sc);
    return `<rect x="${(i*bw+2).toFixed(1)}" y="${(d>=0?mid-hgt:mid).toFixed(1)}" width="${(bw-4).toFixed(1)}" height="${hgt.toFixed(1)}" rx="2.5" fill="${d>=0?"#a78bfa":"#e9a15a"}" opacity="${i===pick?1:.45}"/>`;}).join("");
  const hits=ns.map((x,i)=>`<rect data-cp="debt:${i}" x="${(i*bw).toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${H}" fill="transparent" style="cursor:pointer"/>`).join("");
  const diff=p.s?p.s.hours-p.s.need:null;
  return `<div class="ch-read"><span>${fmtDay(p.date,{weekday:"short",day:"numeric",month:"short"})}</span>${p.s?`<b>${hmh(p.s.hours)}</b><span>${Math.abs(diff)<.09?"right on your need":`${hmh(Math.abs(diff))} ${diff>0?"over":"under"} your need`}</span>`:"<span>No data</span>"}</div>
    <div class="ch-chart"><svg viewBox="0 0 ${W} ${H+14}"><line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="var(--muted)" stroke-opacity=".5" stroke-dasharray="3 3"/>
    ${bars}${hits}
    <text x="0" y="${H+12}">${fmtDay(ns[0].date,{day:"numeric",month:"short"})}</text><text x="${W}" y="${H+12}" text-anchor="end">${fmtDay(ns[ns.length-1].date,{day:"numeric",month:"short"})}</text></svg></div>`;
}
function windowChart(c){
  const ns=c.n14,W=320,H=150,top=14,G=34,bw=(W-G)/ns.length,pick=coachPick.win??ns.length-1,p=ns[pick];
  const pts=c.ok.filter(x=>x.s.start).flatMap(x=>{const a=noonMin(x.s.start),b=noonMin(x.s.end);return [a,b<a?b+1440:b];});
  const lo=Math.floor((Math.min(...pts)-30)/60)*60,hi=Math.ceil((Math.max(...pts)+30)/60)*60,y=m=>top+(H-top)*(m-lo)/(hi-lo);
  let grid="";for(let m=lo;m<=hi;m+=60){if((hi-lo)>600&&(m/60)%2) continue;
    grid+=`<line x1="${G}" x2="${W}" y1="${y(m).toFixed(1)}" y2="${y(m).toFixed(1)}" stroke="#fff" stroke-opacity=".05"/><text x="0" y="${(y(m)+3).toFixed(1)}">${clockN(m).slice(0,2)}:00</text>`;}
  const bars=ns.map((x,i)=>{if(!x.s||!x.s.start) return "";const a=noonMin(x.s.start);let b=noonMin(x.s.end);if(b<a)b+=1440;
    return `<rect x="${(G+i*bw+bw*.28).toFixed(1)}" y="${y(a).toFixed(1)}" width="${(bw*.44).toFixed(1)}" height="${Math.max(2,y(b)-y(a)).toFixed(1)}" rx="${(bw*.22).toFixed(1)}" fill="#a78bfa" opacity="${i===pick?1:.45}"/>`;}).join("");
  const avg=c.reg?[c.reg.bed,c.reg.wake<c.reg.bed?c.reg.wake+1440:c.reg.wake].map(m=>`<line x1="${G}" x2="${W}" y1="${y(m).toFixed(1)}" y2="${y(m).toFixed(1)}" stroke="#c4b5fd" stroke-opacity=".7" stroke-dasharray="4 4"/>`).join(""):"";
  const hits=ns.map((x,i)=>`<rect data-cp="win:${i}" x="${(G+i*bw).toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${H}" fill="transparent" style="cursor:pointer"/>`).join("");
  return `<div class="ch-read"><span>${fmtDay(p.date,{weekday:"short",day:"numeric",month:"short"})}</span>${p.s&&p.s.start?`<b>${clock(p.s.start)} → ${clock(p.s.end)}</b><span>${hmh(p.s.hours)} asleep</span>`:"<span>No data</span>"}</div>
    <div class="ch-chart"><svg viewBox="0 0 ${W} ${H+14}">${grid}${avg}${bars}${hits}
    <text x="${G}" y="${H+12}">${fmtDay(ns[0].date,{day:"numeric",month:"short"})}</text><text x="${W}" y="${H+12}" text-anchor="end">${fmtDay(ns[ns.length-1].date,{day:"numeric",month:"short"})}</text></svg></div>`;
}
function openSleepCoach(keep){
  if(!keep) coachPick={debt:null,win:null};
  const c=sleepCoach(),night=DATA.days[sel].sleep_score;
  if(!c){openSheet(`<div class="sh-top"><h2>Sleep coach</h2>${X}</div><p class="sh-desc">The coach needs at least three recorded nights. Keep wearing the watch to bed and it will start in a few days.</p>`);return;}
  const tips=coachTips(c,night),pct=v=>Math.round(v*100)+"%";
  const debtBand=c.debt<.5?"None":c.debt<1.5?"Small":c.debt<3?"Moderate":"High";
  openSheet(`<div class="sh-top"><h2>Sleep coach</h2>${X}</div>
    <p class="ch-lead">${esc(tips[0].lead)}</p>
    ${sleepAdvice()}
    ${night&&(night.hyp||night.deep!=null)?`<div class="ch-sec"><h3>The night<span>${fmtDay(DATA.days[sel].date,{weekday:"short",day:"numeric",month:"short"})}</span></h3>
      ${night.start?`<p class="ch-sub">${clock(night.start)} → ${clock(night.end)} · ${hmh(night.hours)} asleep</p>`:""}
      ${night.hyp?hypnoChart(night):""}${night.deep!=null?stagesBar(night):""}
      ${night.deep!=null&&c.deepAvg?`<div class="ch-stats"><div><small>Deep</small><b>${pct(night.deep/night.hours)}</b><em>usual ${pct(c.deepAvg)}</em></div>
        <div><small>REM</small><b>${pct(night.rem/night.hours)}</b><em>usual ${pct(c.remAvg)}</em></div>
        <div><small>Awake</small><b>${night.awake_min??"–"} min</b><em>usual ${c.awakeAvg!=null?Math.round(c.awakeAvg):"–"}</em></div></div>`:""}
</div>`:""}
    <div class="ch-sec"><h3>Sleep debt<span>last 7 nights</span></h3>
      <div class="ch-stats"><div><small>Debt</small><b>${c.debt<.1?"0":hmh(c.debt)}</b><em>${debtBand}</em></div>
        <div><small>Your need</small><b>${hmh(c.need)}</b><em>last 30 nights</em></div>
        <div><small>Avg night</small><b>${c.wk.length?hmh(mean(c.wk.map(x=>x.s.hours))):"–"}</b><em>this week</em></div></div>
      <p class="ch-sub">Each bar is a night against your need (the dashed line, ${hmh(c.need)}): purple over, amber under. Extra sleep pays back the debt. Tap a night.</p>
      ${debtChart(c)}</div>
    <div class="ch-sec"><h3>Regularity<span>last 14 nights</span></h3>
      ${c.reg?`<div class="ch-stats"><div><small>Score</small><b>${c.reg.score}</b><em>${c.reg.score>=80?"Very steady":c.reg.score>=60?"Steady":c.reg.score>=40?"Irregular":"Very irregular"}</em></div>
        <div><small>Bedtime</small><b>±${Math.round(c.reg.madBed)}′</b><em>avg ${clockN(c.reg.bed)}</em></div>
        <div><small>Wake-up</small><b>±${Math.round(c.reg.madWake)}′</b><em>avg ${clockN(c.reg.wake)}</em></div></div>
      ${c.jet!=null?`<p class="ch-sub">Weekend shift: ${Math.abs(c.jet)<15?"none":`${hmh(Math.abs(c.jet)/60)} ${c.jet>0?"later":"earlier"} than weekdays`}.</p>`:""}
      <p class="ch-sub">When you fell asleep and woke up each night; dashed lines are your averages. Tap a night.</p>
      ${windowChart(c)}`:`<p class="ch-sub">Needs at least five nights with times.</p>`}</div>
    <div class="ch-sec"><h3>Coach's notes</h3><ul class="ch-tips">${tips.map(t=>`<li>${t.html}</li>`).join("")}</ul></div>
    <p class="sh-note">Debt: the hours you slept under your need over the last 7 nights, minus the extra hours. Regularity: how far bedtime and wake-up moved from your average (±10 min scores 100, ±90 min scores 0). Deep and REM are compared with your own last 14 nights.</p>`);
  document.querySelectorAll("#sheet rect[data-cp]").forEach(r=>r.onclick=()=>{const [k,i]=r.dataset.cp.split(":");coachPick[k]=+i;const y=$("sheet").scrollTop;openSleepCoach(true);$("sheet").scrollTop=y;});
}

