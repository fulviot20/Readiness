"use strict";
/* ------------------------------------------------------------ gauge */
const SEGS=[[0,50,"var(--s1)","Very low"],[50,60,"var(--s2)","Low"],[60,80,"var(--s3)","Normal"],[80,100,"var(--s4)","Super"]];
const segColor=v=>SEGS.find(s=>v<s[1]||s[1]===100)[2];
const RING={c:120,r:98,w:12};RING.C=2*Math.PI*RING.r;
const HUE={"var(--s1)":["#ff8a95","#ff4d5e"],"var(--s2)":["#ffe08a","#f2b632"],"var(--s3)":["#7ef0c0","#1fbf86"],"var(--s4)":["#8cc8ff","#3b82f6"],"var(--faint)":["#5f6c80","#5f6c80"]};
function ringDash(v){const L=RING.C*clip(v,0,100)/100;return `${L.toFixed(2)} ${RING.C.toFixed(2)}`;}
function ringHead(v){const a=(-90+360*clip(v,0,100)/100)*Math.PI/180;return [RING.c+RING.r*Math.cos(a),RING.c+RING.r*Math.sin(a)];}
function gaugeSVG(score,band,color){
  const {c,r,w}=RING,[h1,h2]=HUE[color]||HUE["var(--faint)"],v=score??0,[hx,hy]=ringHead(v);
  const notches=[50,60,80].map(t=>{const a=(-90+3.6*t)*Math.PI/180,p=k=>[c+k*Math.cos(a),c+k*Math.sin(a)],[x1,y1]=p(r-w/2-1),[x2,y2]=p(r+w/2+1);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--bg)" stroke-width="2.2"/>`;}).join("");
  return `<svg viewBox="0 0 240 240" aria-label="Readiness ${score??"pending"} of 100, ${esc(band)}">
    <defs>
      <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${h1}"/><stop offset="1" stop-color="${h2}"/></linearGradient>
      <radialGradient id="rin" cx="50%" cy="38%" r="62%"><stop offset="0" stop-color="#ffffff" stop-opacity=".055"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
      <filter id="rglow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <circle cx="${c}" cy="${c}" r="${r-w/2-4}" fill="url(#rin)"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="${w}"/>
    ${notches}
    <g transform="rotate(-90 ${c} ${c})" style="opacity:${score==null?0:1}">
      <circle class="r-arc" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${h2}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${ringDash(v)}" filter="url(#rglow)" opacity=".5"/>
      <circle class="r-arc" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="url(#rg)" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${ringDash(v)}"/>
    </g>
    <circle id="r-head" cx="${hx.toFixed(2)}" cy="${hy.toFixed(2)}" r="3.4" fill="#fff" opacity="${score==null?0:.95}"/>
    <text class="g-num" id="g-num" x="${c}" y="${c+14}" text-anchor="middle">${score??"–"}</text>
    <text class="g-band" x="${c}" y="${c+40}" text-anchor="middle" fill="${h1}">${esc(band.toUpperCase())}</text>
  </svg>`;
}
function legendHTML(band){
  const rng={"Super":"80–100","Normal":"60–79","Low":"50–59","Very low":"0–49"};
  return `<ul class="g-legend" aria-label="Score bands">${[...SEGS].reverse().map(([,,col,name])=>
    `<li class="${name===band?"on":""}"><i style="background:${col};box-shadow:0 0 6px ${col}"></i><b>${name}</b><span>${rng[name]}</span></li>`).join("")}</ul>`;
}
function animateGauge(from,to){
  const num=$("g-num"),arcs=[...document.querySelectorAll(".gauge .r-arc")],head=$("r-head");
  if(!num) return;
  const reduce=matchMedia("(prefers-reduced-motion:reduce)").matches,T=reduce?0:1200,t0=performance.now();
  const step=now=>{const k=T?clip((now-t0)/T,0,1):1,e=1-Math.pow(1-k,3),v=from+(to-from)*e,d=ringDash(v),[hx,hy]=ringHead(v);
    arcs.forEach(a=>a.setAttribute("stroke-dasharray",d)); head.setAttribute("cx",hx.toFixed(2)); head.setAttribute("cy",hy.toFixed(2));
    num.textContent=Math.round(v); if(k<1) requestAnimationFrame(step);};
  requestAnimationFrame(step);
}

