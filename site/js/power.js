"use strict";
/* ------------------------------------------------------------ training: power (mirrors power.py) */
// Three things from the ride power streams: CP and W' with the power-duration curve, durability (how much power
// is left after hours of work), and the weekly time in each intensity band, intensive endurance first.
const PW_COL=["#6b7889","#4aa3df","#5fc795","#d9c46a","#f2a65a","#f0798a"];
const PW_KEY=[["5","5 s"],["60","1 min"],["300","5 min"],["1200","20 min"]];
let ZPick=null;
const pwDur=s=>s<60?`${s} s`:s<3600?`${Math.round(s/60)} min`:`${r1(s/3600)} h`;
const hTxt=s=>{const m=Math.round(s/60);return m<60?`${m} min`:`${Math.floor(m/60)}h${String(m%60).padStart(2,"0")}`;};

function powerSection(){
  const P=DATA.power;if(!P||!P.curve||!Object.keys(P.curve).length) return "";
  const F=P.fit,kg=weightNow(),setCP=P.set_cp;
  // the curve on a log scale of time, the last 90 days against the 90 before
  const W=320,H=120,ds=Object.keys(P.curve).map(Number).sort((a,b)=>a-b),lx=Math.log(ds[0]),rx=Math.log(ds[ds.length-1]);
  const all=[...Object.values(P.curve),...Object.values(P.curve_prev||{})],hi=Math.max(...all)*1.04,lo=Math.min(...all)*.9;
  const X=d=>(Math.log(d)-lx)/(rx-lx)*(W-8)+4,Y=v=>6+(hi-v)/(hi-lo)*(H-12);
  const line=c=>ds.filter(d=>c[d]).map(d=>`${X(d).toFixed(1)},${Y(c[d]).toFixed(1)}`).join(" ");
  const cpY=F?Y(F.cp):null;
  const tr=(P.trend||[]).slice(-26),tlo=tr.length?Math.min(...tr.map(t=>t.cp))-6:0,thi=tr.length?Math.max(...tr.map(t=>t.cp))+6:1;
  const spark=tr.length>=3?`<svg viewBox="0 0 120 34" class="pw-spark"><polyline points="${tr.map((t,i)=>`${(i/(tr.length-1)*116+2).toFixed(1)},${(32-(t.cp-tlo)/(thi-tlo)*30).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--b3)" stroke-width="2" stroke-linejoin="round"/></svg>`:"";
  const ch=tr.length>=5?tr[tr.length-1].cp-tr[Math.max(0,tr.length-5)].cp:null;
  const keys=PW_KEY.filter(([d])=>P.curve[d]).map(([d,n])=>{const v=P.curve[d],p=(P.curve_prev||{})[d],dd=p?v-p:null;
    return `<div><small>${n}</small><b>${v}</b><span>${kg?r1(v/kg)+" W/kg":""}${dd!=null&&Math.abs(dd)>=3?` <em style="color:${dd>0?"#5fc795":"#f2a65a"}">${dd>0?"+":"−"}${Math.abs(dd)}</em>`:""}</span></div>`;}).join("");
  return `<section class="sec"><div class="sec-h"><h2>Power</h2><span>Last 90 days</span></div>
    <div class="card pw">
      <div class="pw-top"><div><small>CP FROM YOUR RIDES</small><b>${F?F.cp:"–"}<u>W</u></b><span>${F&&kg?`${r1(F.cp/kg)} W/kg · `:""}${F?`W′ ${F.wp} kJ`:"Needs a few hard 3–20 min efforts"}</span></div>
        <div class="pw-tr">${spark}<span>${ch!=null?`${ch>0?"+":ch<0?"−":"±"}${Math.abs(ch)} W in 4 weeks`:""}</span></div></div>
      <svg viewBox="0 0 ${W} ${H}" class="pw-svg" preserveAspectRatio="none">
        ${cpY?`<line x1="0" x2="${W}" y1="${cpY.toFixed(1)}" y2="${cpY.toFixed(1)}" stroke="var(--b3)" stroke-dasharray="3 4" opacity=".55"/>`:""}
        ${P.curve_prev&&Object.keys(P.curve_prev).length?`<polyline points="${line(P.curve_prev)}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3" opacity=".7"/>`:""}
        <polyline points="${line(P.curve)}" fill="none" stroke="#f59e0b" stroke-width="2.4" stroke-linejoin="round"/></svg>
      <div class="ax"><span>5 s</span><span>1 min</span><span>5 min</span><span>20 min</span><span>2 h</span></div>
      <div class="pw-keys">${keys}</div>
      <p class="pw-n"><i style="background:#f59e0b"></i>last 90 days <i style="background:var(--muted)"></i>90 days before${F?` · dashed line: CP`:""}. ${F?`Fitted on your best 3–20 min efforts: it's a floor, it only rises when you go really hard (a test, a race, a climb all out).`:""}${setCP?` CP set on Intervals: ${setCP} W.`:""}</p>
    </div></section>`;
}

function durabilitySection(){
  const P=DATA.power,D=(P&&P.durability)||[];if(!D.length) return "";
  const k2=D.find(x=>x.kj===2000)||D[D.length-1];
  const head=k2.pc20!=null?k2.pc20:k2.pc5,what=k2.pc20!=null?"20 min":"5 min";
  const verdict=head==null?"":head>=95?"Excellent: you lose almost nothing.":head>=90?"Good: the power holds well.":head>=85?"Some fade: long rides at intensive endurance build this.":"Big fade: this is the limiter for long events.";
  const bar=(pc,c)=>pc==null?`<span class="du-x">–</span>`:`<div class="du-bar"><i style="width:${Math.min(100,pc)}%;background:${c}"></i></div><span class="du-p">${pc}%</span>`;
  return `<section class="sec"><div class="sec-h"><h2>Durability</h2><span>Power left after work</span></div>
    <div class="card du">
      <div class="du-h"><b>${head!=null?head+"%":"–"}</b><span>of your fresh ${what} power still there after ${fmtK(k2.kj)} kJ. ${verdict}</span></div>
      <div class="du-g"><small></small><small>5 MIN</small><small>20 MIN</small>
        ${D.map(x=>`<span class="du-k">${fmtK(x.kj)} kJ</span><div class="du-c"><b>${x.p5} W</b>${bar(x.pc5,"#6fd3e6")}</div><div class="du-c">${x.p20?`<b>${x.p20} W</b>`:""}${bar(x.pc20,"#5fc795")}</div>`).join("")}</div>
      <p class="pw-n">Best power that started after that much work in a ride, against your best fresh power in the same 90 days. About 700–900 kJ is an hour of endurance for you; the Sportful is over 4000.</p>
    </div></section>`;
}

function intensitySection(){
  const P=DATA.power,Z=(P&&P.zones)||[];if(!Z.length||!Z.some(z=>z.secs.some(Boolean))) return "";
  const B=P.bands,W=320,H=120,bw=W/Z.length,mx=Math.max(3600,...Z.map(z=>z.secs.reduce((a,b)=>a+b,0)));
  const pick=ZPick==null||ZPick>=Z.length?Z.length-1:ZPick,pz=Z[pick],tot=pz.secs.reduce((a,b)=>a+b,0);
  const bars=Z.map((z,i)=>{let y=H;return z.secs.map((s,k)=>{const h=s/mx*(H-4);y-=h;return h>0?`<rect x="${(i*bw+bw*.18).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw*.64).toFixed(1)}" height="${h.toFixed(1)}" fill="${PW_COL[k]}" opacity="${i===pick?1:.55}"/>`:"";}).join("")+
    `<rect data-zp="${i}" x="${(i*bw).toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${H}" fill="transparent" style="cursor:pointer"/>`;}).join("");
  const ie=pz.secs[2],ieAvg=Z.slice(-5,-1).reduce((a,z)=>a+z.secs[2],0)/Math.max(1,Math.min(4,Z.length-1));
  const wk=pick===Z.length-1?"This week":`Week of ${fmtDay(pz.week,{day:"numeric",month:"short"})}`;
  return `<section class="sec" id="intsec"><div class="sec-h"><h2>Intensity</h2><span>Rides with power · % of CP</span></div>
    <div class="card in">
      <div class="in-h"><small>${esc(wk.toUpperCase())} · INTENSIVE ENDURANCE (70–80%)</small><b style="color:${PW_COL[2]}">${hTxt(ie)}</b><span>${ieAvg>60?`average of the 4 weeks before: ${hTxt(ieAvg)}`:""}</span></div>
      <svg viewBox="0 0 ${W} ${H}" class="in-svg" preserveAspectRatio="none">${bars}</svg>
      <div class="ax"><span>${fmtDay(Z[0].week,{day:"numeric",month:"short"})}</span><span>12 weeks</span><span>now</span></div>
      <div class="in-l">${B.map(([lo,hi,n],k)=>`<div><i style="background:${PW_COL[k]}"></i><span>${esc(n)} <small>${hi>200?`>${lo}`:`${lo}–${hi}`}%</small></span><b>${pz.secs[k]?hTxt(pz.secs[k]):"–"}</b></div>`).join("")}
        <div class="in-t"><span>Total with power</span><b>${hTxt(tot)}</b></div></div>
    </div></section>`;
}
function bindIntensity(){
  document.querySelectorAll("rect[data-zp]").forEach(r=>r.onclick=()=>{ZPick=+r.dataset.zp;buzz(4);$("intsec").outerHTML=intensitySection();bindIntensity();});
}
