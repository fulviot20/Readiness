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
      if (fuelRate({...f, min: 30}, 90) !== 0 || fuelRate(f, 90) < 60 || fuelRate(f, 60) > 60 || fuelRate({...f, min: 70}, 90, false) !== 0) throw new Error("intake rate out of range");
      const a = fuelRecovery(300, 150, 65, true), b = fuelRecovery(300, 150, 65, false), c = fuelRecovery(100, 95, 65, true);
      if (!(a.carbs > b.carbs) || c.carbs !== 0 || a.deficit !== 150) throw new Error("recovery rule wrong");
      const d = DATA.days.find(x => (x.workouts || []).some(w => w.fuel && planOf(x.date, w)));
      if (!d) throw new Error("no finished session matched to its plan");
      const w = d.workouts.find(w => planOf(d.date, w)), r = fuelDone(w, d.date);
      if (!(r.used > 0) || r.plan == null || r.extra == null) throw new Error("planned vs done not compared");
      TAB = "athlete"; ATH_SUB = "food"; PG.athlete = "diary"; foodSel = todayISO(); render(); }],
    ["fuel-settings", () => openFuelSettings()],
    // usual day: a whole day saved from the diary comes back with one tap, each food in its meal
    ["usual-day", () => { const t = todayISO(), now = Date.now(), real = () => foodDay(t).filter(x => !x.fuel);
      [["b", "Oats", 300], ["l", "Chicken", 400], ["d", "Rice", 500], ["s", "Banana", 100]].forEach(([meal, name, kcal], i) =>
        foodSave({id: "ud" + i, date: t, meal, name, g: 100, kcal, p: 10, c: 30, f: 5, at: now + i, ts: now + i}));
      TAB = "athlete"; ATH_SUB = "food"; PG.athlete = "diary"; foodSel = t; render();
      document.getElementById("day-save").click(); document.getElementById("sd-n").value = "Weekday canteen"; document.getElementById("sd-s").click();
      const e = libAll().find(x => x.kind === "day");
      if (!e || e.items.length !== 4 || e.items.map(x => x.meal).join("") !== "blds") throw new Error("usual day not saved with its meals");
      real().forEach(x => foodSave({id: x.id, date: t, del: true, ts: Date.now() + 9})); render();
      const b = document.querySelector(`[data-libd="${e.id}"]`); if (!b) throw new Error("usual day not offered on an empty diary");
      b.click();
      if (real().length !== 4 || real().map(x => x.meal).sort().join("") !== "bdls" || ftot(real()).kcal !== 1300) throw new Error("usual day not logged");
      if (document.querySelector("[data-libd]")) throw new Error("usual day still offered on a filled diary"); }],
    ["usual-day-edit", () => { const e = libAll().find(x => x.kind === "day"); openLibDay(structuredClone(e));
      if (!document.getElementById("ld-log") || document.querySelectorAll("#sheet [data-rm]").length !== 4) throw new Error("usual day can't be opened"); }],
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
      TAB = "athlete"; ATH_SUB = "food"; PG.athlete = "diary"; foodSel = t; render(); openTarget(t); }],
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
      localStorage.removeItem("rd_adh"); adhSet(isoAdd(t, -3), 1);
      localStorage.setItem("rd_trim", JSON.stringify({v: 0, at: isoAdd(t, -8)})); trimCheck();
      if (trimGet().v !== 0 || trimGet().held !== "more") throw new Error("gaining after eating over the plan shouldn't lower the range");
      TAB = "athlete"; ATH_SUB = "food"; PG.athlete = "balance"; render();
      if (!document.getElementById("wt-c") || !/come back inside/.test(document.getElementById("wt-c").textContent)) throw new Error("trend card missing");
      openAth("weight");
      if (!document.querySelector('#ath-svg line[stroke="#f59e0b"]')) throw new Error("no trend line on the weight chart");
      document.getElementById("w-v").value = "63.2"; document.getElementById("w-save").click(); }],
    ["weigh-in-answer", () => { const b = document.querySelector('#adh-s [data-a="0"]'); if (!b) throw new Error("no question after the weigh-in");
      b.click(); if (adhGet()[todayISO()] !== 0 || document.getElementById("adh-s")) throw new Error("answer not kept"); }],
    // the plan follows the range: carbohydrate portions are resized so the meals land in it
    ["plan-range", () => { const opt = (name, kcal) => ({name, grams: 100, portion: "1 plate", kcal, protein: 10, carbs: 40, fat: 5});
      syncSet("rd_plan", {made: todayISO(), summary: "Test plan.", day_types: {rest: {carb_factor: .8}, train: {carb_factor: 1}, long: {carb_factor: 1.4}},
        meals: ["b", "l", "d"].map(m => ({meal: m, title: MEAL_NAME[m], components: [
          {role: "Carbs", carb: true, options: [opt("Pasta", 500), opt("Rice", 450)]}, {role: "Protein", options: [opt("Chicken", 250)]}]})), tips: []});
      syncSet("rd_plan_sel", {});
      for (const dt of ["rest", "train", "long"]) { const P = planGet(), F = planFactor(P, dt);
        if (!F.T) throw new Error("no range for " + dt);
        if (F.f > .5 && F.f < 2.5 && Math.abs(F.meals + F.T.fuel - F.T.kcal) > 60) throw new Error(`plan misses the range on ${dt} days`); }
      if (!(planFactor(planGet(), "long").f > planFactor(planGet(), "rest").f)) throw new Error("long days should carry more carbohydrate");
      TAB = "athlete"; ATH_SUB = "food"; PG.athlete = "plan"; PLAN_DT = null; render();
      if (!/–/.test(document.querySelector(".pl-k b").textContent) || !document.querySelector(".pl-fit")) throw new Error("plan doesn't show its range"); }],
    // synced values: a newer copy from the server replaces the local one, an older one doesn't
    ["sync", () => { const ts = Date.now() + 5000; DATA.sync = {rd_plan_sel: {ts, v: {b0: 2}}, rd_fuel: {ts: 5, v: {max: 40}}}; syncPull();
      if (lsJSON("rd_plan_sel", {}).b0 !== 2) throw new Error("newer server value not taken");
      if (fuelCfg().max !== 90) throw new Error("older server value overwrote the local one"); }],
    ["reminders", () => { localStorage.setItem("rd_push", "1"); remindRow(); remindNudge(); GO_PENDING = "journal"; applyGo();
      if (PG.today !== "day" || !document.getElementById("journal")) throw new Error("notification link did not open the journal"); PG.today = "overview"; }],
    // slimmer navigation: two pages on Today, three on Training and Athlete; the old page names still land somewhere sensible
    ["slim", () => { setTab("today"); PG.today = "overview"; render();
      if (document.querySelectorAll(".pbar [data-pg]").length !== 2) throw new Error("Today should have two pages");
      if (!document.querySelector("details#more .signals") || !document.querySelector("details#more .checkin")) throw new Error("signals and check-in belong in the More block");
      if (document.querySelector("#app > .signals, #app > .sec .signals")) throw new Error("signals should not sit outside the More block");
      setPage("today", "journal"); if (PG.today !== "day" || !document.getElementById("journal")) throw new Error("journal not on the Day page");
      setTab("training"); if (document.querySelectorAll(".pbar [data-pg]").length !== 3) throw new Error("Training should have three pages");
      setPage("training", "volume"); if (PG.training !== "month") throw new Error("Hours should live on the Month page");
      setTab("athlete"); if (document.querySelectorAll(".pbar [data-pg]").length !== 3) throw new Error("Athlete should have three pages");
      setPage("athlete", "balance"); if (PG.athlete !== "profile" || !document.querySelector("details#balance[open] #bal-r")) throw new Error("balance not reachable from Profile");
      setTab("today"); }],
    // food search: a plain "ciambella" is the baked ring cake; foods found by the AI lookup are kept and found again locally,
    // and rows whose energy disagrees with the macros are dropped (from the AI and from Open Food Facts)
    ["food-db", () => { if (!/^Ring cake/.test(localSearch("ciambella")[0].name) || !/^Ring cake/.test(bestMatch("ciambella").name)) throw new Error("ciambella should be the ring cake");
      if (aiRefFood({name: "x", kcal: 900, protein: 1, carbs: 1, fat: 1}) || aiRefFood({name: "x", kcal: 100, protein: 60, carbs: 60, fat: 0})) throw new Error("implausible AI row kept");
      const f = aiRefFood({name: "Crema di zucca", kcal: 55, protein: 1.2, carbs: 7, fat: 2.4, unit: "Portion", unit_g: 300, nutrients: {fiber: 1.1}});
      if (!f || f.unit[1] !== 300 || f.n100.fiber !== 1.1) throw new Error("AI row not read");
      if (localSearch("vellutata zucca").some(x => x.src === "ai")) throw new Error("store should start empty");
      fdbPut("vellutata zucca", [f]); FDB = null;
      if (!fdbAsked("Vellutata  zucca".replace("  ", " ")) || localSearch("crema di zucca")[0].name !== "Crema di zucca" || bestMatch("vellutata zucca").name !== "Crema di zucca") throw new Error("learned food not found again");
      const o = (k, p, c, fat) => offFood({product_name: "Y", nutriments: {"energy-kcal_100g": k, proteins_100g: p, carbohydrates_100g: c, fat_100g: fat}});
      if (!o(400, 10, 60, 13).ok || o(400, 1, 2, 1).ok || offFood({product_name: "Y", nutriments: {"energy-kcal_100g": 400}}).ok) throw new Error("product label check wrong");
      localStorage.removeItem("rd_fdb"); FDB = null; }],
    // typing a food the table doesn't have: after a pause the AI lookup fills "More foods", and the next search needs no request
    ["food-search", async () => { localStorage.setItem("rd_gemini", "x"); const real = aiCall; let calls = 0;
      aiCall = async () => { calls++; return {json: {foods: [{name: "Castagnaccio", kcal: 190, protein: 3.5, carbs: 33, fat: 5, unit: "slice", unit_g: 80}]}}; };
      try { openAddFood("s", todayISO()); const q = document.getElementById("af-q"); q.value = "castagnaccio"; q.oninput();
        if (!document.getElementById("af-gen")) throw new Error("no lookup started");
        await new Promise(r => setTimeout(r, 1300));
        if (!/Castagnaccio/.test(document.getElementById("af-gen").textContent) || calls !== 1) throw new Error("AI foods not shown");
        q.value = ""; q.oninput(); q.value = "castagnaccio"; q.oninput(); await new Promise(r => setTimeout(r, 1100));
        if (calls !== 1 || document.getElementById("af-gen") || !/Castagnaccio/.test(document.getElementById("af-res").textContent)) throw new Error("learned food should come from the phone");
      } finally { aiCall = real; localStorage.removeItem("rd_gemini"); localStorage.removeItem("rd_fdb"); FDB = null; ADD = null; } }],
    // a ready-made list pasted in the Food coach is read on the phone, with no AI request, and saved after Confirm
    ["coach-list", async () => { localStorage.setItem("rd_gemini", "x"); const real = aiCall; let calls = 0; aiCall = async () => { calls++; throw new Error("no"); };
      try { const day = todayISO(), had = new Set(foodDay(day).map(x => x.id)), fresh = () => foodDay(day).filter(x => !had.has(x.id)); AS.msgs = []; openAssistant("food");
        document.getElementById("as-t").value = "Breakfast\nCiambella al forno, 100 g, 340 kcal, P 7, C 55, F 10\nSkyr 0%, 150 g, 95 kcal, P 16, C 6, F 0.3\nSnack\nBacio Perugina, 12 g, 70 kcal, P 1, C 6, F 4.5\nLunch\nCrema di zucca con crostini, 250 g, 150 kcal, P 4, C 22, F 5\nPatate contorno, 80 g, 100 kcal, P 2, C 15, F 3.5";
        document.getElementById("as-go").click(); await new Promise(r => setTimeout(r, 200));
        const yes = document.querySelector("[data-yes]"); if (calls || !yes) throw new Error("the list should be read without the AI");
        yes.click(); await new Promise(r => setTimeout(r, 200));
        const it = fresh(), sk = it.find(x => x.name === "Skyr 0%"), cr = it.find(x => /^Crema di zucca/.test(x.name));
        if (it.length !== 5 || !sk || sk.g !== 150 || sk.kcal !== 95 || sk.p !== 16 || sk.f !== 0.3 || sk.meal !== "b" || !cr || cr.meal !== "l" || cr.c !== 22 || it.find(x => /^Bacio/.test(x.name)).meal !== "s") throw new Error("list not saved as written: " + JSON.stringify(it.map(x => [x.name, x.meal, x.g, x.kcal])));
        // the same list again, with one amount corrected and one new food: the five old entries are replaced, not doubled;
        // an entry under its database name counts as the same food, an unrelated one stays
        const ref = bestMatch("ciambella"), keep = uid(), alias = uid(), twin = uid();
        foodSave({id: twin, date: day, meal: "s", name: "Skyr", g: 150, kcal: 95, p: 16, c: 6, f: 0.3, at: 3, ts: Date.now()});   // a second old copy goes too
        foodSave({id: keep, date: day, meal: "d", name: "Salmone al forno", g: 180, kcal: 360, p: 36, c: 0, f: 24, at: 1, ts: Date.now()});
        foodSave({id: it.find(x => /^Ciambella/.test(x.name)).id, date: day, del: true, ts: Date.now() + 9});
        foodSave({id: alias, date: day, meal: "b", name: ref.name, g: 60, kcal: 228, p: 4, c: 33, f: 9, at: 2, ts: Date.now()});
        document.getElementById("as-t").value = "Breakfast\nCiambella al forno, 100 g, 340 kcal, P 7, C 55, F 10\nSkyr 0%, 150 g, 95 kcal, P 16, C 6, F 0.3\nSnack\nBacio Perugina, 12 g, 70 kcal, P 1, C 6, F 4.5\nLunch\nCrema di zucca con crostini, 300 g, 180 kcal, P 5, C 26, F 6\nPatate contorno, 80 g, 100 kcal, P 2, C 15, F 3.5\nPanino, 60 g, 165 kcal, P 5, C 33, F 1";
        document.getElementById("as-go").click(); await new Promise(r => setTimeout(r, 200));
        if (!/Replace, already in/.test(document.getElementById("as-log").textContent)) throw new Error("replacement not announced: " + document.getElementById("as-log").textContent.slice(-300));
        [...document.querySelectorAll("[data-yes]")].pop().click(); await new Promise(r => setTimeout(r, 200));
        const now = fresh(), names = now.map(x => x.name).sort().join("|");
        if (now.length !== 7 || !now.find(x => x.id === keep) || now.find(x => x.id === alias) || now.filter(x => /^Skyr/.test(x.name)).length !== 1 || now.find(x => /^Crema/.test(x.name)).g !== 300) throw new Error("duplicates not replaced: " + names);
        now.forEach(x => foodSave({id: x.id, date: day, del: true, ts: Date.now() + 99}));
      } finally { aiCall = real; localStorage.removeItem("rd_gemini"); AS.msgs = []; } }],
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
      setTab("today"); render(); if (!document.querySelector(".adapt")) throw new Error("the two versions are not on Today");
      if (insightCard() !== "") throw new Error("no AI key: the insight card should stay hidden");
      localStorage.setItem("rd_gemini", "x"); syncSet("rd_insight", {date: todayISO(), text: "Test insight."}); render();
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
