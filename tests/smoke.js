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
    const file = f === "data.enc" ? path.join(ROOT, "tests", "out", "data.enc") : path.join(SITE, f);
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
    ["page-signals", () => setPage("today", "signals")], ["page-checkin", () => setPage("today", "checkin")],
    ["page-overview", () => setPage("today", "overview")],
    ["prev-day", () => document.getElementById("prev").click()],
    ["training", () => setTab("training")],
    ["training-pages", () => { for (const k of ["month", "volume", "fitness", "week"]) setPage("training", k); }],
    ["athlete", () => setTab("athlete")],
    ["food-pages", () => { for (const k of ["diary", "plan", "balance", "nutrients", "profile"]) setPage("athlete", k); }],
    ["months", () => { if (typeof openMonths === "function") openMonths(); }],
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
