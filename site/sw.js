// Readiness service worker: shows push notifications, opens the app when one is tapped,
// and keeps a copy of the app on the phone so it opens at once, also without a connection.
//
// How each kind of file is served:
// * app code and styles carry a version in their address (?v=…): a given address never changes, so the saved copy
//   is used straight away and the network isn't touched (this is what makes a launch on a weak signal fast);
// * the page itself (index.html) is asked to the network first, so a new version arrives straight away,
//   but only for 2 seconds: after that the saved page opens and the new one is picked up at the next launch;
// * fonts are kept for good; icons and the manifest are served from the copy and refreshed in the background;
// * the data (data.enc, stamp.json) never goes through here: the app has its own copy and its own freshness rules.
const SHELL = "rd-shell-v3", FONTS = "rd-fonts-v1", KEEP = [SHELL, FONTS, "rd-data"];
const ASSET = /(?:src|href)="([^":#]+\.(?:js|css|png|json)(?:\?[^"]*)?)"/g;

async function savePage(res) {
  // keep the page, fetch the files it names that we don't have yet, drop the ones from older versions
  const c = await caches.open(SHELL), html = await res.clone().text();
  await c.put("./", res);
  const want = new Set([...html.matchAll(ASSET)].map(m => new URL(m[1], self.registration.scope).href));
  const have = new Set((await c.keys()).map(r => r.url));
  await Promise.all([...want].filter(u => !have.has(u)).map(u => c.add(u).catch(() => {})));
  for (const u of have) if (u.includes("?v=") && !want.has(u)) c.delete(u);
}
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(fetch("./", { cache: "no-cache" }).then(r => r.ok ? savePage(r) : null).catch(() => {}));
});
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => !KEEP.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim())));

const timeout = ms => new Promise((_, no) => setTimeout(() => no(new Error("slow")), ms));
async function page(e) {
  const c = await caches.open(SHELL), saved = await c.match("./");
  const net = fetch(e.request).then(r => {
    if (r.ok) { const p = savePage(r.clone()).catch(() => {}); try { e.waitUntil(p); } catch (_) {} }
    return r;
  });
  if (!saved) return net;
  net.catch(() => {});
  try { const r = await Promise.race([net, timeout(2000)]); return r.ok ? r : saved; } catch (_) { return saved; }
}
async function fixed(e, name) {          // an address whose content never changes
  const c = await caches.open(name), hit = await c.match(e.request);
  if (hit) return hit;
  const r = await fetch(e.request);
  if (r.ok) c.put(e.request, r.clone());
  return r;
}
async function refreshed(e, name) {      // saved copy now, fresh copy for next time
  const c = await caches.open(name), hit = await c.match(e.request);
  const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; });
  if (!hit) return net;
  e.waitUntil(net.catch(() => {}));
  return hit;
}
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.hostname === "fonts.gstatic.com") return e.respondWith(fixed(e, FONTS));
  if (u.hostname === "fonts.googleapis.com") return e.respondWith(refreshed(e, FONTS));
  if (u.origin !== self.location.origin || /\/(data\.enc|stamp\.json|sw\.js)$/.test(u.pathname)) return;
  if (e.request.mode === "navigate") return e.respondWith(page(e));
  if (u.searchParams.has("v")) return e.respondWith(fixed(e, SHELL));
  e.respondWith(refreshed(e, SHELL));
});
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "Readiness", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Readiness", {
    body: d.body || "", tag: d.tag || "readiness", renotify: true,
    icon: "icon-192-v2.png", badge: "badge-96.png", data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    for (const w of ws) if (w.url.startsWith(self.registration.scope)) { w.navigate(url); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
