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
  // the pages and sheets added with ride fuel, reminders and sync, on the real data: only counts and flags, never values
  const more=await p.evaluate(()=>{const out={},t=k=>{try{return k();}catch(e){return 'ERR '+String(e.message).slice(0,80);}};
    out.stamp=!!ENV_IV; out.sync=Object.keys(DATA.sync||{}).length;
    out.rides30=DATA.days.slice(-30).reduce((a,d)=>a+(d.workouts||[]).filter(isRide).length,0);
    out.carbsOnIntervals=DATA.days.reduce((a,d)=>a+(d.workouts||[]).filter(w=>w.carbs_in>0).length,0);
    out.fuelLines=t(()=>{const c=fuelCfg();LS.set('rd_fuel',JSON.stringify({...c,since:'2000-01-01'}));foodReset();
      const n=DATA.days.slice(-30).reduce((a,d)=>a+fuelItems(d.date).length,0);LS.del('rd_fuel');foodReset();return n;});
    for(const pg of ['diary','plan','balance']) out[pg]=t(()=>{TAB='athlete';ATH_SUB='food';PG.athlete=pg;foodSel=todayISO();render();return document.querySelectorAll('#app section,#app .f-hero').length>0;});
    out.fuelCard=!!document.querySelector('.fuel-c');
    out.settings=t(()=>{openSettings();const ok=!!document.querySelector('#s-fuel');closeSheet();return ok;});
    out.nudge=t(()=>{TAB='today';PG.today='overview';render();return document.querySelectorAll('.nudge').length;});
    return out;});
  console.log('new', JSON.stringify(more));
  console.log('render', JSON.stringify(info));console.log('errors', JSON.stringify(errs));
  await b.close();})();
