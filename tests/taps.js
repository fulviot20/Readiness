// No dead taps: on every page, taps each visible button and link (and what each opened sheet contains) and fails
// when a tap changes nothing: no new content, no sheet, no page, no link opened. Usage: node tests/taps.js
const {chromium}=require("playwright-core");const fs=require("fs"),path=require("path");const ROOT=path.join(__dirname,".."),SITE=ROOT+"/site";
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||"/usr/bin/google-chrome"});const p=await b.newPage({viewport:{width:390,height:844}});const errs=[];p.on("pageerror",e=>errs.push(e.message));
await p.route("**/*",r=>{const u=new URL(r.request().url());if(u.host!=="app.test")return r.abort();let f=u.pathname==="/"?"index.html":u.pathname.slice(1);
const file=f==="data.enc"||f==="stamp.json"?path.join(ROOT,"tests","out",f):path.join(SITE,f);if(!fs.existsSync(file))return r.fulfill({status:404,body:"x"});
return r.fulfill({body:fs.readFileSync(file),contentType:{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(file)]||"application/json"});});
await p.addInitScript(()=>{localStorage.setItem("rd_pass","test");window.__opened=[];window.open=(u)=>{window.__opened.push(u);};});
await p.goto("https://app.test/");await p.waitForFunction(()=>typeof DATA!=="undefined"&&DATA&&document.querySelector(".gauge"),null,{timeout:15000});await p.waitForTimeout(2500);
const pages=[["today","overview"],["today","day"],["training","week"],["training","cal"],["training","month"],["training","fitness"],["athlete","profile"]];
const out=await p.evaluate(async(pages)=>{
  const res=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const desc=e=>(e.id?"#"+e.id:"")+"."+[...e.classList].join(".")+" "+JSON.stringify((e.textContent||e.getAttribute("aria-label")||"").trim().slice(0,40));
  for(const [tab,pg] of pages){
    goPage(tab,pg);await sleep(50);
    const sel="#app button, #app a, #app [data-cd], #app [role=button], #app rect[data-i], #app rect[data-fi], #app rect[data-zp]";
    const n=document.querySelectorAll(sel).length;
    for(let i=0;i<n;i++){
      goPage(tab,pg);await sleep(20);
      const els=[...document.querySelectorAll(sel)];const e=els[i];if(!e) continue;
      const r=e.getBoundingClientRect();if(!r.width||!r.height||e.disabled||getComputedStyle(e).visibility==="hidden") continue;
      if(e.tagName==="A"&&e.getAttribute("href")&&e.getAttribute("href")!=="#") continue;   // real link
      const before=document.getElementById("app").innerHTML,sh=document.getElementById("sheet").classList.contains("open"),op=window.__opened.length,tb=TAB+JSON.stringify(PG)+sel;
      if(e.classList.contains("on")) continue;   // already the selected pill/range
      const tap=x=>x.click?x.click():x.dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:x.getBoundingClientRect().x+2,clientY:x.getBoundingClientRect().y+2}));
      try{tap(e);}catch(x){res.push(["ERROR",tab,pg,desc(e),x.message]);continue;}
      await sleep(60);
      const changed=document.getElementById("app").innerHTML!==before||document.getElementById("sheet").classList.contains("open")!==sh||window.__opened.length!==op;
      if(!changed) res.push(["DEAD",tab,pg,desc(e)]);
      const SH=document.getElementById("sheet");
      if(SH.classList.contains("open")&&!sh){
        const html0=SH.innerHTML,ssel="#sheet button:not(.x), #sheet [data-ca], #sheet rect[data-i]";const m=SH.querySelectorAll(ssel).length;
        for(let j=0;j<m;j++){
          if(!SH.classList.contains("open")||SH.innerHTML!==html0){ tap(e); await sleep(40); }
          const se=[...SH.querySelectorAll(ssel)][j];if(!se||se.disabled||se.classList.contains("on")) continue;
          if(/^(Delete|Remove|Lock app|Retire it|Replaced|Save|Send a test|Turn on|Test)/.test((se.textContent||"").trim())) continue;   // destructive or network
          document.querySelector(".toast")?.remove();const b2=SH.innerHTML,o2=window.__opened.length,app2=document.getElementById("app").innerHTML,t2=(document.querySelector(".toast")||{}).outerHTML;
          try{tap(se);}catch(x){res.push(["ERROR",tab,pg,desc(e)+" > "+desc(se),x.message]);continue;}
          await sleep(60);
          if(SH.innerHTML===b2&&window.__opened.length===o2&&document.getElementById("app").innerHTML===app2&&(document.querySelector(".toast")||{}).outerHTML===t2&&SH.classList.contains("open")) res.push(["DEAD-IN-SHEET",tab,pg,desc(e)+" > "+desc(se)]);
        }
      }
      if(document.getElementById("sheet").classList.contains("open")) closeSheet();
    }
  }
  return res;},pages);
for(const r of out) console.log(r.join(" | "));await b.close();
if(out.length||errs.length){console.error(errs.join("\n"));process.exit(1);}console.log("no dead taps");})().catch(e=>{console.error(e);process.exit(1);});
