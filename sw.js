/* Le service worker : l'appli s'ouvre sans réseau (dernière version gardée), les images des tournois aussi. */
const APP = "sigo-smash-app-v74", IMG = "sigo-smash-img-v1";
const SHELL = ["./", "index.html", "bk_pool.js", "bk_proj.js", "plan.js", "app.js", "lineup.js", "lineup2.js", "spaces.js", "wh.js", "chesslib.js", "chess_gfx.js", "chess_lib.js", "ch.js", "nav.js", "ux.js", "ux2.js", "watch.js", "scene.js", "chess.css", "fonts.css", "style.css", "icons.js", "fonts/barlow-condensed-latin-700-normal.woff2", "fonts/barlow-condensed-latin-800-normal.woff2", "fonts/cinzel-latin-700-normal.woff2", "fonts/cormorant-garamond-latin-700-normal.woff2", "fonts/fraunces-latin-600-normal.woff2", "fonts/inter-latin-400-normal.woff2", "fonts/inter-latin-600-normal.woff2", "fonts/inter-latin-700-normal.woff2", "fonts/space-grotesk-latin-600-normal.woff2", "manifest.webmanifest", "icon-v2-192.png", "icon-v2-512.png", "icon-v2-maskable.png", "apple-touch-icon-v2.png", "img/smash.png", "img/wh.png", "img/chess.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(APP).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== APP && k !== IMG).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin === location.origin) {                       // l'appli : le réseau d'abord (mises à jour), sinon la copie
    e.respondWith(fetch(e.request, { cache: "no-cache" }).then((r) => {   // (v68 : jamais la copie du cache HTTP : la nouvelle version s'affiche tout de suite)
       const c = r.clone(); caches.open(APP).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  } else if ((/(^|\.)start\.gg$/.test(u.hostname) || (u.hostname === "ultimateframedata.com" && u.pathname.startsWith("/characterart/"))) && /\.(png|jpe?g|webp|gif)$/i.test(u.pathname)) {   // (v63 : + les portraits de la Line Up)   // les images : la copie d'abord
    e.respondWith(caches.open(IMG).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; })));
  }
});
