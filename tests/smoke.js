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
    ["food-pages", () => { for (const k of ["diary", "plan", "balance", "profile"]) setPage("athlete", k); }],
    ["months", () => { if (typeof openMonths === "function") openMonths(); }],
    // ride fuel: every ride long enough adds one diary line by itself, and it can be corrected
    ["fuel", () => { syncSet("rd_fuel", {on: true, max: 90, since: "2000-01-01"}); foodReset();
      const d = [...DATA.days].reverse().find(x => fuelItems(x.date).length);
      if (!d) throw new Error("no ride got a fuel line");
      const it = foodDay(d.date).find(x => x.fuel); if (!it || it.kcal !== it.c * 4) throw new Error("fuel line missing from the diary");
      foodSel = d.date; TAB = "athlete"; ATH_SUB = "food"; PG.athlete = "diary"; render();
      if (!document.querySelector(`[data-fi="${it.id}"]`)) throw new Error("fuel line not shown");
      openFuel(it); document.getElementById("fu-c").value = "120"; document.getElementById("fu-save").click();
      if (foodDay(d.date).find(x => x.fuel).c !== 120) throw new Error("fuel edit not kept"); }],
    // the model: a session that ran longer than planned leaves more to refill than the plan foresaw
    ["fuel-model", () => { const f = {kcal: 2000, frac: .5, min: 180, how: "power zones"};
      if (!(fuelUsed(f, 180) > fuelUsed(f, 0))) throw new Error("intake should raise carbohydrate use");
      if (fuelRate({...f, min: 50}, 90) !== 0 || fuelRate(f, 90) < 50 || fuelRate(f, 60) > 60) throw new Error("intake rate out of range");
      const a = fuelRecovery(300, 150, 65, true), b = fuelRecovery(300, 150, 65, false), c = fuelRecovery(100, 95, 65, true);
      if (!(a.carbs > b.carbs) || c.carbs !== 0 || a.deficit !== 150) throw new Error("recovery rule wrong");
      const d = DATA.days.find(x => (x.workouts || []).some(w => w.fuel && planOf(x.date, w)));
      if (!d) throw new Error("no finished session matched to its plan");
      const w = d.workouts.find(w => planOf(d.date, w)), r = fuelDone(w, d.date);
      if (!(r.used > 0) || r.plan == null || r.extra == null) throw new Error("planned vs done not compared");
      TAB = "athlete"; ATH_SUB = "food"; PG.athlete = "diary"; foodSel = todayISO(); render(); }],
    ["fuel-settings", () => openFuelSettings()],
    // synced values: a newer copy from the server replaces the local one, an older one doesn't
    ["sync", () => { const ts = Date.now() + 5000; DATA.sync = {rd_plan_sel: {ts, v: {b0: 2}}, rd_fuel: {ts: 5, v: {max: 40}}}; syncPull();
      if (lsJSON("rd_plan_sel", {}).b0 !== 2) throw new Error("newer server value not taken");
      if (fuelCfg().max !== 90) throw new Error("older server value overwrote the local one"); }],
    ["reminders", () => { localStorage.setItem("rd_push", "1"); remindRow(); remindNudge(); GO_PENDING = "journal"; applyGo();
      if (PG.today !== "journal") throw new Error("notification link did not open the journal"); PG.today = "overview"; }],
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
