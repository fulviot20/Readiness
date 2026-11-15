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
    ["old-food-links", () => { for (const k of ["diary", "plan", "weight", "balance", "profile"]) { setPage("athlete", k); if (PG.athlete !== "profile") throw new Error("old food link should open Profile"); } }],
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
      // a ride's carbs set by hand win over the automatic amount, and recovery follows
      const auto = fuelIntake(w, d.date).g; syncSet("rd_fuelg", {[w.id]: auto + 40});
      if (fuelIntake(w, d.date).g !== auto + 40 || !fuelIntake(w, d.date).own) throw new Error("carbs set by hand not used");
      openFuelTaken(w.id, d.date); if (!document.getElementById("fu-c")) throw new Error("carbs sheet missing");
      document.getElementById("fu-del").click(); if (fuelIntake(w, d.date).own) throw new Error("back to automatic failed"); }],
    ["fuel-settings", () => openFuelSettings()],
    // today's fuel on the Score page: each line opens its session
    ["fuel-today", () => { const t = todayISO(), d = DATA.days.find(x => x.date === t);
      const ride = {id: 999002, name: "Test ride", type: "Ride", minutes: 120, load: 90, fuel: {kcal: 1800, frac: .6, min: 120}, detail: {secs: 7200}};
      (d.plan = d.plan || []).push(ride); dayReset(); goPage("today", "overview");
      const b = document.querySelector('.fuel-c [data-pd="999002"]'); if (!b) throw new Error("today's ride fuel not on Score");
      b.click(); if (!document.getElementById("sheet").classList.contains("open")) throw new Error("fuel line did not open the session");
      closeSheet(); d.plan.pop(); render(); }],
    ["plan-fuel", () => { const t = todayISO(), d = DATA.days.find(x => x.date === t);
      const ride = {id: 999001, name: "Test ride", type: "Ride", minutes: 120, load: 90, fuel: {kcal: 1800, frac: .6, min: 120}, detail: {secs: 7200}};
      (d.plan = d.plan || []).push(ride); openPlanned("999001");
      if (document.querySelectorAll("#sheet .fz div").length !== 3) throw new Error("no before/during/after in the session");
      d.plan.pop(); }],
    // distance by sport (hike apart from run) and a gear counter from a start date
    ["distance-gear", () => { const t = todayISO(); localStorage.removeItem("rd_gear");
      if (!DATA.km || !Object.keys(DATA.km).length) throw new Error("no km in data");
      DATA.km[t] = {...(DATA.km[t] || {}), Hiking: 12.4}; kmMode = "week"; TAB = "training"; PG.training = "month"; render();
      const rows = [...document.querySelectorAll("#kmsec .km-r span")].map(e => e.textContent);
      if (!rows.includes("Hike")) throw new Error("hike not shown apart: " + rows);
      document.getElementById("gear-add").click(); document.getElementById("g-n").value = "Test shoes"; document.getElementById("g-s").value = "Running";
      const from = isoAdd(t, -30); document.getElementById("g-f").value = from; document.getElementById("g-ok").click();
      const want = Object.entries(DATA.km).filter(([d]) => d >= from).reduce((a, [, v]) => a + (v.Running || 0), 0);
      const g = gearAll()[0]; if (!g || Math.abs(gearKm(g) - want) > .01 || want <= 0) throw new Error("gear km wrong");
      if (!document.querySelector("#kmsec .gear-c")) throw new Error("gear card missing");
      localStorage.removeItem("rd_gear"); delete DATA.km[t].Hiking; }],
    // today's planned session: Intervals' numbers in Readiness, no trip to Intervals
    ["planned-session", () => { const td = DATA.days.find(x => x.date === todayISO()), keep = [td.workouts, (td.plan || []).map(q => q.done)];
      td.workouts = []; (td.plan || []).forEach(q => { q.done = false; });   // the card shows a session still to do: whatever the fixture rode today
      TAB = "training"; PG.training = "week"; render();
      const c = document.querySelector(".wcard.hero[data-pd]"); if (!c) throw new Error("no premium planned card");
      if (!c.querySelector(".shp polygon") || !c.querySelector(".zstrip i")) throw new Error("no workout shape on the card");
      c.click(); const sh = document.getElementById("sheet");
      if (!sh.querySelector(".zr") || !sh.querySelector(".ssc") || !sh.querySelector(".wdesc li") || !/Intervals/.test(sh.querySelector(".srcbar").textContent)) throw new Error("planned sheet incomplete");
      closeSheet(); td.workouts = keep[0]; (td.plan || []).forEach((q, i) => { q.done = keep[1][i]; }); render(); }],
    // synced values: a newer copy from the server replaces the local one, an older one doesn't
    ["sync", () => { syncSet("rd_fuel", {on: true, max: 90, since: "2000-01-01"}); const ts = Date.now() + 5000; DATA.sync = {rd_gear: {ts, v: [{name: "Server chain", sport: "Cycling", from: "2026-01-01"}]}, rd_fuel: {ts: 5, v: {max: 40}}}; syncPull();
      if ((lsJSON("rd_gear", [])[0] || {}).name !== "Server chain") throw new Error("newer server value not taken"); localStorage.removeItem("rd_gear");
      if (fuelCfg().max !== 90) throw new Error("older server value overwrote the local one"); }],
    ["reminders", () => { localStorage.setItem("rd_push", "1"); remindRow(); remindNudge(); GO_PENDING = "journal"; applyGo();
      if (PG.today !== "day" || !document.getElementById("journal")) throw new Error("notification link did not open the journal"); PG.today = "overview"; }],
    // slimmer navigation: two pages on Today, three on Training and Athlete; the old page names still land somewhere sensible
    ["slim", () => { setTab("today"); PG.today = "overview"; render();
      if (document.querySelectorAll(".pbar [data-pg]").length !== 2) throw new Error("Today should have two pages");
      if (!document.querySelector("#app > .sec .signals") || !document.querySelector("#app .checkin")) throw new Error("signals and check-in should be visible on Score");
      if (document.querySelector("details#more")) throw new Error("nothing should be hidden in a More block");
      setPage("today", "journal"); if (PG.today !== "day" || !document.getElementById("journal")) throw new Error("journal not on the Day page");
      setTab("training"); if (document.querySelectorAll(".pbar [data-pg]").length !== 4) throw new Error("Training should have four pages");
      setPage("training", "volume"); if (PG.training !== "month") throw new Error("Hours should live on the Month page");
      setTab("athlete"); if (document.querySelectorAll(".pbar [data-pg]").length !== 0) throw new Error("Athlete is a single page");
      setPage("athlete", "balance"); if (PG.athlete !== "profile") throw new Error("old balance link should open Profile");
      setTab("today"); }],
    // four tabs, and the search sheet reaches every destination without an error
    ["tabs", () => { if (document.querySelectorAll(".tabbar button").length !== 3) throw new Error("the bar should have three tabs");
      setTab("athlete"); setPage("athlete", "diary"); if (!document.querySelector('.tabbar [data-tab="athlete"].on') || PG.athlete !== "profile") throw new Error("an old food link should land on Athlete"); }],
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
    // calendar: a day with a session shows it under the grid, a week total shows the week; months move
    ["calendar", () => { setTab("training"); setPage("training", "cal");
      const d = document.querySelector(".cal-d.has"); if (!d) throw new Error("no session in the calendar");
      d.click(); if (!document.querySelector("#cal-list .cal-c")) throw new Error("day sessions not listed");
      document.querySelector("#cal-list .cal-c").click(); if (!document.getElementById("sheet").classList.contains("open")) throw new Error("session sheet not opened"); closeSheet();
      document.querySelector(".cal-w").click(); if (!document.querySelector("#cal-list .sec-h")) throw new Error("week not listed");
      // a planned session of the coming days opens its full detail from the calendar
      const up = Object.keys(DATA.upcoming || {}).find(d => d > todayISO() && DATA.upcoming[d].some(q => q.detail));
      if (up) { calSel = up; $("cal-list").innerHTML = calList(); bindCalList(); const c = document.querySelector("#cal-list [data-pd]");
        if (!c) throw new Error("planned session not listed"); c.click();
        if (!document.querySelector("#sheet.open .pw-sheet")) throw new Error("planned session detail did not open from the calendar"); closeSheet(); }
      document.getElementById("cal-p").click(); if (!document.querySelector(".cal-g")) throw new Error("previous month broken"); }],
    // distance between two dates, gear replaced on a day keeps the old part in the history
    ["distance-gear", () => { setPage("training", "month"); localStorage.setItem("rd_kmr", JSON.stringify({from: isoAdd(todayISO(), -20), to: todayISO()}));
      kmMode = "custom"; render(); if (!document.getElementById("km-f")) throw new Error("no date range");
      const t = window.toast; window.toast = () => {};
      openGear(null, {name: "Chain", sport: "Cycling", limit: 3000, from: isoAdd(todayISO(), -40)}); document.getElementById("g-i").checked = false; document.getElementById("g-ok").click();
      const i = gearAll().findIndex(g => g.name === "Chain"); if (i < 0 || gearAll()[i].indoor !== false) throw new Error("chain not saved");
      openGear(i); document.getElementById("g-rd").value = isoAdd(todayISO(), -10); document.getElementById("g-rp").click();
      const G = gearAll().filter(g => g.name === "Chain"); if (G.length !== 2 || !G.some(g => g.to) || !G.some(g => !g.to && g.base === 0)) throw new Error("replace did not split the chain");
      if (!document.querySelector(".gear-old")) throw new Error("old chain not in the history");
      localStorage.removeItem("rd_gear"); window.toast = t; kmMode = "month"; }],
    // best efforts: switching duration redraws the tiles
    ["best-efforts", () => { setPage("training", "fitness"); if (!document.querySelector("#bestsec .be-t")) throw new Error("no best efforts");
      const b = [...document.querySelectorAll("#bestsec [data-bd]")].find(x => x.dataset.bd === "1200"); b.click();
      if (!document.querySelector('#bestsec [data-bd="1200"].on') || !document.querySelector("#bestsec .be-t.all")) throw new Error("duration pick broken"); }],
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
