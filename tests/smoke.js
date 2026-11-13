// App smoke test: loads the real site/ files with the synthetic fixture (tests/out/data.enc, passphrase "test")
// in headless Chrome at phone size, opens every tab and the main sheets, and fails on any page error.
// Usage: node tests/smoke.js [--shots dir]
const {chromium} = require("playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), SITE = path.join(ROOT, "site");
const shots = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".enc": "application/json"};

(async () => {
  const exe = process.env.CHROME || "/usr/bin/google-chrome";
  const b = await chromium.launch({executablePath: exe});
  const p = await b.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});
  const errs = [];
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  await p.route("**/*", r => {
    const u = new URL(r.request().url());
    if (u.host !== "app.test") return r.abort();
    let f = u.pathname === "/" ? "index.html" : u.pathname.slice(1);
    const file = f === "data.enc" || f === "stamp.json" ? path.join(ROOT, "tests", "out", f) : path.join(SITE, f);
    if (!fs.existsSync(file)) return r.fulfill({status: 404, body: "missing"});
    return r.fulfill({body: fs.readFileSync(file), contentType: TYPES[path.extname(file)] || "application/octet-stream"});
  });
  await p.addInitScript(() => { localStorage.setItem("rd_pass", "test"); navigator.serviceWorker && (navigator.serviceWorker.register = () => Promise.reject()); });
  await p.goto("https://app.test/");
  await p.waitForFunction(() => typeof DATA !== "undefined" && DATA && document.querySelector(".gauge"), null, {timeout: 15000});
  const checks = [];
  const shot = async n => { if (shots) await p.screenshot({path: path.join(shots, n + ".png")}); };
  const step = async (name, fn) => {
    const before = errs.length;
    try { await p.evaluate(fn); await p.waitForTimeout(250); }
    catch (e) { errs.push(`${name}: ${e.message.split("\n")[0]}`); }
    checks.push([name, errs.length === before]);
    await shot(name);
    await p.evaluate(() => typeof closeSheet === "function" && closeSheet());
  };
  await shot("today");
  for (const [n, fn] of [
    ["score", () => openScore()], ["sleep", () => openSleepScore()], ["coach", () => openSleepCoach()],
    ["strain", () => openStrain()], ["hrv", () => openSignal("hrv")], ["rhr", () => openSignal("rhr")],
    ["energy", () => openEnergy()], ["settings", () => openSettings()], ["validation", () => openValidation()],
    ["page-day", () => setPage("today", "day")],
    ["dayflow-tabs", () => { for (const t of ["hr", "stress", "energy"]) document.querySelector(`[data-df="${t}"]`).click(); }],
    ["page-journal", () => setPage("today", "journal")],
    ["page-overview", () => setPage("today", "overview")],
    ["prev-day", () => document.getElementById("prev").click()],
    ["training", () => setTab("training")],
    ["training-pages", () => { for (const k of ["month", "volume", "fitness", "week"]) setPage("training", k); }],
    ["athlete", () => setTab("athlete")],
    ["food-pages", () => { for (const k of ["diary", "plan", "weight", "balance", "profile"]) setPage("athlete", k); }],
    ["months", () => { if (typeof openMonths === "function") openMonths(); }],
    // the model: a session that ran longer than planned leaves more to refill than the plan foresaw
    ["fuel-model", () => { const f = {kcal: 2000, frac: .5, min: 180, how: "power zones"};
      if (!(fuelUsed(f, 180) > fuelUsed(f, 0))) throw new Error("intake should raise carbohydrate use");
      if (fuelRate({...f, min: 30}, 90) !== 0 || fuelRate(f, 90) < 60 || fuelRate(f, 60) > 60 || fuelRate({...f, min: 70}, 90, false) !== 0) throw new Error("intake rate out of range");
      const a = fuelRecovery(300, 150, 65, true), b = fuelRecovery(300, 150, 65, false), c = fuelRecovery(100, 95, 65, true);
      if (!(a.carbs > b.carbs) || c.carbs !== 0 || a.deficit !== 150) throw new Error("recovery rule wrong");
      const d = DATA.days.find(x => (x.workouts || []).some(w => w.fuel && planOf(x.date, w)));
      if (!d) throw new Error("no finished session matched to its plan");
      const w = d.workouts.find(w => planOf(d.date, w)), r = fuelDone(w, d.date);
      if (!(r.used > 0) || r.plan == null || r.extra == null) throw new Error("planned vs done not compared");
      TAB = "athlete"; ATH_SUB = "food"; PG.athlete = "plan"; foodSel = todayISO(); render(); }],
    ["fuel-settings", () => openFuelSettings()],
    // the target is a range fixed for the day: Garmin's moving projection doesn't touch it, the session does once it's done
    ["range", () => { const t = todayISO(), a = targetOf(t);
      if (!a || !a.burn.fixed || a.hi - a.lo !== 200 || a.kcal % 50) throw new Error("no fixed range");
      DATA.energy.today.projected += 600; DATA.energy.today.kcal_now += 600;
      if (targetOf(t).kcal !== a.kcal) throw new Error("the range moved with Garmin's projection");
      const d = DATA.days.find(x => x.date === t), extra = {name: "Test ride", type: "Ride", minutes: 120};
      (d.plan = d.plan || []).push(extra); const r = targetOf(t);
      if (!(r.kcal > a.kcal + 300) || !r.burn.proj || !/Training day|Long day/.test(dayKind(r.tr))) throw new Error("a planned session should raise the range from the morning");
      extra.done = true; const q = targetOf(t); d.plan.pop();
      if (q.kcal !== a.kcal) throw new Error("a planned session that isn't pending any more shouldn't count twice");
      if (rangeState(a.lo - 10, a).k !== "under" || rangeState(a.kcal, a).k !== "in" || rangeState(a.hi + 10, a).k !== "over") throw new Error("range state wrong");
      TAB = "athlete"; ATH_SUB = "food"; PG.athlete = "plan"; foodSel = t; render(); openTarget(t); }],
    // the scale corrects the range: losing faster than the goal's pace raises it, once a week, in a small step
    ["scale", () => { const t = todayISO(), set = f => { DATA.athlete.weights = [0, 4, 8, 12, 16, 20].map(k => ({date: isoAdd(t, -k), kg: 63 + f * k / 7})); ATH_CACHE = null; };
      localStorage.removeItem("ath_m_weight"); if (DATA.athlete.metrics) DATA.athlete.metrics.weight = {};
      localStorage.removeItem("rd_trim"); localStorage.removeItem("rd_goal"); DATA.nutrition.goal = null;
      const base = targetOf(t).kcal;
      set(0); trimCheck(); if (trimGet().v !== 0 || trimGet().at !== t) throw new Error("stable weight should change nothing");
      localStorage.removeItem("rd_trim"); set(0.6); trimCheck();                       // 0.6 kg lighter every week
      if (trimGet().v !== 150 || targetOf(t).kcal !== base + 150) throw new Error("fast loss should raise the range");
      set(-0.6); trimCheck(); if (trimGet().v !== 150) throw new Error("checked twice in the same week");
      localStorage.setItem("rd_trim", JSON.stringify({v: 150, at: isoAdd(t, -8)})); trimCheck();
      if (trimGet().v !== 50) throw new Error("gaining should lower the range a little");
      openTarget(t); if (!document.getElementById("trim-0")) throw new Error("no reset"); }],
    // no diary: the one-tap answer at the weigh-in keeps the correction fair, and the weight sheet shows the trend
    ["weigh-in", () => { const t = todayISO();
      DATA.athlete.weights = [0, 4, 8, 12, 16, 20].map(k => ({date: isoAdd(t, -k), kg: 63 - 0.6 * k / 7})); ATH_CACHE = null;      // gaining
      localStorage.setItem("rd_trim", JSON.stringify({v: 0, at: isoAdd(t, -8)})); trimCheck();
      if (trimGet().v !== -100) throw new Error("gaining should lower the need, with no diary to ask");
      openAth("weight");
      if (!document.querySelector("#sheet .wt-st")) throw new Error("weight status missing");
      if (!document.querySelector("#sheet #wt-m")) throw new Error("aim missing from the weight sheet");
      if (!document.querySelector('#ath-svg line[stroke="#f59e0b"]')) throw new Error("no trend line on the weight chart");
      document.getElementById("w-v").value = "63.2"; document.getElementById("w-save").click(); }],
    // today's plan: macros from the need, every meal with alternatives, dinner closes the day on target whatever you pick
    ["plan", () => { const t = todayISO(); localStorage.removeItem("rd_plan_sel"); localStorage.removeItem("rd_trim");
      const D = dayPlan(t); if (!D) throw new Error("no plan");
      if (Math.abs(D.sum.kcal - D.kcal) > 150) throw new Error(`default plan off by ${Math.round(D.sum.kcal - D.kcal)} kcal`);
      if (Math.abs(D.sum.p - D.P) > 15 || Math.abs(D.sum.c - D.C) > 30) throw new Error("macros off: " + JSON.stringify(D.sum));
      if (D.meals[D.meals.length - 1].slot !== "d" || !D.meals.every(m => m.parts.every(x => x.opts.length >= 1))) throw new Error("meals malformed");
      let worst = 0;
      for (const m of D.meals) m.parts.forEach(x => x.opts.forEach((o, oi) => { syncSet("rd_plan_sel", {[x.key]: oi}); const E = dayPlan(t);
        worst = Math.max(worst, Math.abs(E.sum.kcal - E.kcal)); }));
      if (worst > 250) throw new Error(`some pick lands ${Math.round(worst)} kcal off`);
      localStorage.removeItem("rd_plan_sel");
      const d = DATA.days.find(x => x.date === t), ride = {name: "Test ride", type: "Ride", minutes: 120, fuel: {kcal: 1800, frac: .6, min: 120}};
      (d.plan = d.plan || []).push(ride); PB = null; const R = dayPlan(t);
      if (!(R.bike.g > 100) || !R.slots.some(s => s.ride)) throw new Error("ride fuel missing from a training day");
      if (new Date(t + "T12:00").getDay() % 6 && !R.meals.some(m => m.slot === "pre")) throw new Error("no pre-ride snack on a work day");
      if (Math.abs(R.sum.kcal - R.kcal) > 150) throw new Error("training day plan off target");
      TAB = "athlete"; ATH_SUB = "food"; PG.athlete = "plan"; render();
      if (!document.querySelector(".pl-head") || document.querySelectorAll(".pl-m").length < 4 || !document.querySelector(".fuel-c")) throw new Error("plan page incomplete");
      document.querySelector('[data-meal="d"]').click(); document.querySelector('[data-mk="d.0"][data-mi="1"]').click(); document.getElementById("at-s").click();
      if (PSEL()["d.0"] !== 1) throw new Error("pick not kept");
      d.plan.pop(); PB = null; render(); }],
    // a meal that went differently: details on tap, grams as eaten, extras, skipped; dinner takes up the difference
    ["plan-ate", () => { const t = todayISO(); localStorage.removeItem("rd_ate"); localStorage.removeItem("rd_plan_sel");
      TAB = "athlete"; ATH_SUB = "food"; PG.athlete = "plan"; render();
      const D0 = dayPlan(t), din0 = D0.meals.find(m => m.slot === "d").tot.kcal;
      // Choose: change the grams of the porridge, tick the yogurt, mark the fruit as not had
      document.querySelector('[data-meal="b"]').click(); if (!document.querySelector('#sheet [data-qi="b.0"]')) throw new Error("no amount in Choose");
      const qi = document.querySelector('#sheet [data-qi="b.0"]'); qi.value = "100"; qi.onchange();
      document.querySelector('#sheet [data-tk="b.1"]').click(); document.querySelector('#sheet [data-mo="b.2"]').click(); document.getElementById("at-s").click();
      const D1 = dayPlan(t), b = D1.meals.find(m => m.slot === "b");
      if (b.parts[0].g !== 100 || !b.parts[0].ok || !b.parts[1].ok || !b.parts[2].off || b.parts[2].m.kcal !== 0) throw new Error("Choose not kept: " + JSON.stringify(b.ate));
      if (!(D1.meals.find(m => m.slot === "d").tot.kcal < din0 - 50) || Math.abs(D1.sum.kcal - D1.kcal) > 150) throw new Error("dinner didn't make room " + JSON.stringify([din0, D1.meals.map(m=>[m.slot,Math.round(m.tot.kcal)]), D0.meals.map(m=>[m.slot,Math.round(m.tot.kcal)]), Math.round(D1.sum.kcal - D1.kcal)]));
      document.querySelector('[data-meal="b"]').click(); const q = document.getElementById("at-q"); q.value = "mozza"; q.oninput();
      document.querySelector('[data-ha="mozz"]').click(); document.getElementById("at-s").click();
      if (dayPlan(t).meals.find(m => m.slot === "b").extra.length !== 1) throw new Error("extra not kept");
      document.querySelector('[data-meal="b"]').click(); document.getElementById("at-sk").click(); document.getElementById("at-s").click();
      if (dayPlan(t).meals.find(m => m.slot === "b").tot.kcal !== 0) throw new Error("skip not kept");
      document.querySelector('[data-meal="b"]').click(); document.getElementById("at-r").click();
      if (dayPlan(t).meals.find(m => m.slot === "b").ate) throw new Error("reset failed");
      // one tap: the whole lunch as planned
      const ls = dayPlan(t).meals.find(m => m.slot === "lc" || m.slot === "l").slot; document.querySelector(`[data-eat="${ls}"]`).click();
      if (!dayPlan(t).meals.find(m => m.slot === ls).parts.every(x => x.ok || !x.m.lines.length)) throw new Error("ate-it tap not kept");
      document.querySelector(`[data-undo="${ls}"]`).click(); if (dayPlan(t).meals.find(m => m.slot === ls).ate) throw new Error("undo failed"); }],
    // today's planned session: Intervals' numbers in Readiness, no trip to Intervals
    ["planned-session", () => { TAB = "training"; PG.training = "week"; render();
      const c = document.querySelector(".wcard.hero[data-pd]"); if (!c) throw new Error("no premium planned card");
      if (!c.querySelector(".shp polygon") || !c.querySelector(".zstrip i")) throw new Error("no workout shape on the card");
      c.click(); const sh = document.getElementById("sheet");
      if (!sh.querySelector(".zr") || !sh.querySelector(".ssc") || !sh.querySelector(".wdesc li") || !/Intervals/.test(sh.querySelector(".srcbar").textContent)) throw new Error("planned sheet incomplete");
      closeSheet(); }],
    // synced values: a newer copy from the server replaces the local one, an older one doesn't
    ["sync", () => { syncSet("rd_fuel", {on: true, max: 90, since: "2000-01-01"}); const ts = Date.now() + 5000; DATA.sync = {rd_plan_sel: {ts, v: {b0: 2}}, rd_fuel: {ts: 5, v: {max: 40}}}; syncPull();
      if (lsJSON("rd_plan_sel", {}).b0 !== 2) throw new Error("newer server value not taken");
      if (fuelCfg().max !== 90) throw new Error("older server value overwrote the local one"); }],
    ["reminders", () => { localStorage.setItem("rd_push", "1"); remindRow(); remindNudge(); GO_PENDING = "journal"; applyGo();
      if (PG.today !== "day" || !document.getElementById("journal")) throw new Error("notification link did not open the journal"); PG.today = "overview"; }],
    // slimmer navigation: two pages on Today, three on Training and Athlete; the old page names still land somewhere sensible
    ["slim", () => { setTab("today"); PG.today = "overview"; render();
      if (document.querySelectorAll(".pbar [data-pg]").length !== 2) throw new Error("Today should have two pages");
      if (!document.querySelector("#app > .sec .signals") || !document.querySelector("#app .checkin")) throw new Error("signals and check-in should be visible on Score");
      if (document.querySelector("details#more")) throw new Error("nothing should be hidden in a More block");
      setPage("today", "journal"); if (PG.today !== "day" || !document.getElementById("journal")) throw new Error("journal not on the Day page");
      setTab("training"); if (document.querySelectorAll(".pbar [data-pg]").length !== 3) throw new Error("Training should have three pages");
      setPage("training", "volume"); if (PG.training !== "month") throw new Error("Hours should live on the Month page");
      setTab("athlete"); if (document.querySelectorAll(".pbar [data-pg]").length !== 2) throw new Error("Athlete should have two pages");
      setPage("athlete", "balance"); if (PG.athlete !== "profile") throw new Error("old balance link should open Profile");
      setTab("today"); }],
    // four tabs, and the search sheet reaches every destination without an error
    ["tabs", () => { if (document.querySelectorAll(".tabbar button").length !== 3) throw new Error("the bar should have three tabs");
      setTab("athlete"); setPage("athlete", "diary"); if (!document.querySelector('.tabbar [data-tab="athlete"].on') || !document.querySelector('.pbar [data-pg="profile"]')) throw new Error("Food should sit inside Athlete"); }],
    ["find", () => { openFind(); const q = document.getElementById("fd-q"); q.value = "peso"; q.oninput();
      if (!document.querySelectorAll("#fd-l [data-fd]").length) throw new Error("search in Italian found nothing");
      q.value = ""; q.oninput(); if (document.querySelectorAll("#fd-l [data-fd]").length !== FIND.length) throw new Error("not every destination is listed");
      const t = window.toast; let bad = 0; window.toast = m => { if (/Not available/.test(m)) bad++; };
      for (const e of FIND) { if (e[1] === "Ask AI") continue; e[3](); closeSheet(); }
      window.toast = t; }],
    // the planned session in two ways: intervals lose a repetition, a very low day turns it into easy endurance
    ["adapt", () => { const p = {name: "4x8", type: "Ride", minutes: 80, steps: [{min: 15, lo: 55, hi: 55}, ...[0, 1, 2, 3].flatMap(() => [{min: 8, lo: 100, hi: 100}, {min: 4, lo: 50, hi: 50}]), {min: 17, lo: 60, hi: 60}]};
      const n = adaptPlan(p, "Normal"), l = adaptPlan(p, "Low"), v = adaptPlan(p, "Very low"), e = adaptPlan({type: "Ride", minutes: 120, steps: [{min: 120, lo: 65, hi: 65}]}, "Low");
      if (n.pick !== "full" || l.pick !== null || v.pick !== "short") throw new Error("wrong suggestion for the band");
      if (!/^3×8 min/.test(l.short.txt) || l.short.min !== 68 || v.short.min > 60 || e.short.min !== 90) throw new Error("short version wrong: " + l.short.txt + " " + l.short.min);
      if (adaptPlan({...p, race: true}, "Low") !== null) throw new Error("a race has no short version");
      const d = DATA.days.find(x => x.date === todayISO()); d.workouts = []; (d.plan || []).forEach(q => { q.done = false; });
      setTab("training"); PG.training = "week"; render(); if (!document.querySelector(".adapt")) throw new Error("the two versions are not on Training");
      if (insightCard() !== "") throw new Error("no AI key: the insight card should stay hidden");
      localStorage.setItem("rd_gemini", "x"); syncSet("rd_insight", {date: todayISO(), text: "Test insight."}); setTab("today"); render();
      if (document.getElementById("ins-t")?.textContent !== "Test insight.") throw new Error("saved insight not shown");
      if (!insightFacts().today_plan.length) throw new Error("insight facts miss today's plan");
      localStorage.removeItem("rd_gemini"); }],
    ["today", () => setTab("today")],
  ]) await step(n, fn);
  const info = await p.evaluate(() => { PG.today = "day"; render(); const dayflow = !!document.getElementById("df-sec");
    PG.today = "overview"; render(); return {days: DATA.days.length, gauge: !!document.querySelector(".gauge"), dayflow}; });
  await b.close();
  for (const [n, ok] of checks) console.log(ok ? "ok  " : "FAIL", n);
  console.log("info", JSON.stringify(info));
  if (errs.length || !info.gauge || !info.dayflow) { console.error(errs.join("\n")); process.exit(1); }
  console.log("smoke test passed");
})().catch(e => { console.error(e); process.exit(1); });
