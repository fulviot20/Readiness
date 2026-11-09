// Opens the built app with the real encrypted data and reports only errors and what is on screen (no values)
const {chromium}=require('playwright-core');
(async()=>{
  const b=await chromium.launch({executablePath:'/usr/bin/google-chrome'});
  const p=await b.newPage({viewport:{width:390,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(String(e.message).slice(0,200)));
  const fs=require('fs');
  const path=require('path'),T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.enc':'application/json','.png':'image/png'};
  await p.route('**/*',r=>{const u=new URL(r.request().url());
    if(u.host!=='app.test')return r.continue();
    const f=path.join('site',u.pathname==='/'?'index.html':u.pathname.slice(1));
    if(!fs.existsSync(f))return r.fulfill({status:404,body:''});
    return r.fulfill({body:fs.readFileSync(f),contentType:T[path.extname(f)]||'application/octet-stream'});});
  await p.addInitScript(pw=>{localStorage.setItem('rd_pass',pw)},process.env.READINESS_PASSPHRASE);
  await p.goto('https://app.test/');await p.waitForTimeout(4000);
  const info=await p.evaluate(()=>({hasData:!!window.DATA||typeof DATA!=='undefined'&&!!DATA,
    days:typeof DATA!=='undefined'&&DATA?DATA.days.length:0,
    gauge:!!document.querySelector('.gauge'),signals:document.querySelectorAll('.sig').length,
    pending:!!document.querySelector('.pending'),locked:!!document.querySelector('.lock'),
    loadingText:(document.querySelector('.loading')||{}).textContent?.slice(0,120)||null,
    todaySel:typeof sel!=='undefined'?(DATA.days[sel]||{}).date:null,
    todayHasScore:typeof sel!=='undefined'&&DATA?DATA.days[sel].score!=null:null}));
  console.log('render', JSON.stringify(info));console.log('errors', JSON.stringify(errs));
  await b.close();})();
