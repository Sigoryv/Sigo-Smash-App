/* Le service worker : l'appli s'ouvre sans réseau (dernière version gardée), les images des tournois aussi. */
const APP = "sigo-smash-app-v9", IMG = "sigo-smash-img-v1";
const SHELL = ["./", "index.html", "app.js", "style.css", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(APP).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== APP && k !== IMG).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin === location.origin) {                       // l'appli : le réseau d'abord (mises à jour), sinon la copie
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(APP).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  } else if (/(^|\.)start\.gg$/.test(u.hostname) && /\.(png|jpe?g|webp|gif)$/i.test(u.pathname)) {   // les images : la copie d'abord
    e.respondWith(caches.open(IMG).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; })));
  }
});
