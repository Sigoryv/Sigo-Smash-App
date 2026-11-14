/* =====================================================================
   ux.js — v82 : LE CONFORT DE L'APPLI.
   👆 les gestes : glisser une fiche vers le bas pour la fermer ; balayer à gauche / à droite pour changer
      d'onglet ; balayer sur l'échiquier d'une partie ou d'une leçon pour avancer / reculer d'un coup.
   ● la synchro dans l'en-tête : à jour, modifications en attente, hors ligne, erreur.
   🔆 l'écran reste allumé pendant une partie Warhammer.
   🚀 les raccourcis de l'icône (appui long) : partie Warhammer, réviser le répertoire, Jour J.
   ===================================================================== */

/* ------------------------------------------------------------ ● l'état de la synchro */
D.dirty = Object.assign({ c: [], e: [] }, D.dirty);
const Cset0 = C.set.bind(C);
C.set = function (sec, k, v) { const before = D.carnet.stamps[`${sec}/${k}`]; Cset0(sec, k, v); if (D.carnet.stamps[`${sec}/${k}`] !== before && !D.dirty.c.includes(`${sec}/${k}`)) { D.dirty.c.push(`${sec}/${k}`); save(); syncDot(); } };
const Eset0 = E.set;
E.set = function (k, v) { const before = D.esp.stamps[k]; Eset0(k, v); if (D.esp.stamps[k] !== before && !D.dirty.e.includes(k)) { D.dirty.e.push(k); save(); syncDot(); } };
const syncCloudUx0 = syncCloud;
syncCloud = async function () {
  D.syncing = true; syncDot();
  try {
    const sentC = [...D.dirty.c], sentE = [...D.dirty.e];
    const r = await syncCloudUx0();
    D.dirty.c = D.dirty.c.filter((k) => !sentC.includes(k));
    if (!D.espErr && !D.espNone) D.dirty.e = D.dirty.e.filter((k) => !sentE.includes(k));
    D.syncErr = D.espErr || ""; save(); return r;
  } catch (e) { D.syncErr = e.message; save(); throw e; }
  finally { D.syncing = false; syncDot(); }
};
$("#sync").insertAdjacentHTML("beforebegin", `<button id="syncdot" aria-label="État de la synchro"><i></i></button>`);
function syncState() {
  if (!D.cfg.repo || !D.cfg.ghToken || !D.cfg.pass) return null;
  const n = D.dirty.c.length + D.dirty.e.length + (D.espUp || []).length;
  if (D.syncing) return ["busy", "Synchronisation…"];
  if (!navigator.onLine) return ["off", n ? `Hors ligne : ${n} modification(s) en attente, envoyée(s) au retour du réseau` : "Hors ligne : tout ce qui est ici reste lisible"];
  if (D.syncErr) return ["err", "Synchro : " + D.syncErr];
  if (n) return ["wait", `${n} modification(s) pas encore envoyée(s) (dans quelques secondes)`];
  return ["ok", `✓ Tout est à jour${D.lastCloud ? " · " + ago(D.lastCloud) : ""}`];
}
function syncDot() { const b = $("#syncdot"), s = syncState(); if (!b) return; b.hidden = !s; if (s) { b.className = s[0]; b.title = s[1]; } }
document.addEventListener("click", (e) => { if (e.target.closest("#syncdot")) { e.stopPropagation(); const s = syncState(); if (s) toast(s[1], s[0] === "err"); if (s && (s[0] === "wait" || s[0] === "err") && navigator.onLine) syncAll(); } }, true);
window.addEventListener("online", syncDot); window.addEventListener("offline", syncDot);
setInterval(syncDot, 30000);

/* ------------------------------------------------------------ 🔆 l'écran allumé pendant une partie Warhammer */
let WWAKE = null;
const wwPref = () => localStorage.getItem("sigo.wake.wh") !== "0";
async function wwSync() {
  const want = wwPref() && !document.hidden && D.space === "wh" && D.tab === "wlive" && !!E.get("wh:live") && "wakeLock" in navigator;
  if (want && !WWAKE) { try { WWAKE = await navigator.wakeLock.request("screen"); WWAKE.addEventListener?.("release", () => { WWAKE = null; }); } catch (_) { WWAKE = null; } }
  else if (!want && WWAKE) { try { await WWAKE.release(); } catch (_) {} WWAKE = null; }
}
document.addEventListener("visibilitychange", wwSync);
const viewWLive0 = viewWLive;
viewWLive = function () {
  const h = viewWLive0();
  if (!E.get("wh:live") || !("wakeLock" in navigator)) return h;
  return `<button class="chip wake ${wwPref() ? "on" : ""}" data-uxact="wwake" style="margin-bottom:8px">🔆 ${wwPref() ? "écran allumé pendant la partie" : "garder l'écran allumé"}</button>` + h;
};
TABS.wlive = viewWLive;
document.addEventListener("click", (e) => { const b = e.target.closest("[data-uxact=wwake]"); if (!b) return; localStorage.setItem("sigo.wake.wh", wwPref() ? "0" : "1"); render(); });

/* ------------------------------------------------------------ après chaque affichage */
const renderViewUx0 = renderView;
renderView = function () { renderViewUx0(); syncDot(); wwSync(); };

/* ------------------------------------------------------------ 👆 les gestes */
const UXG = { x0: 0, y0: 0, t0: 0, el: null, mode: "", dy: 0 };
const NO_SWIPE = ".chips, .bk-wrap, .lu-strip, .wphotos, .wpick, .ch-ml, input, textarea, select, .tier, .mc, .tl-pool, .tl-r, #chd-b, #chr-b, .ch-gwrap";
document.addEventListener("touchstart", (e) => {
  const t = e.touches[0], tg = e.target?.closest ? e.target : e.target?.parentElement; if (!t || !tg) return;   // (un doigt sur du texte : son élément)
  Object.assign(UXG, { x0: t.clientX, y0: t.clientY, t0: Date.now(), mode: "", dy: 0, el: tg });
  const sh = tg.closest("#sheet");
  if (sh && sh.scrollTop <= 0 && !tg.closest("input, textarea, select, .wstep, .bk-wrap, .ch-board")) UXG.mode = "sheet?";
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (UXG.mode !== "sheet?" && UXG.mode !== "sheet") return;
  const t = e.touches[0]; if (!t) return; const dy = t.clientY - UXG.y0, dx = t.clientX - UXG.x0;
  if (UXG.mode === "sheet?") { if (Math.abs(dy) < 8) return; if (dy < 0 || Math.abs(dx) > Math.abs(dy)) { UXG.mode = ""; return; } UXG.mode = "sheet"; }
  UXG.dy = Math.max(0, dy); const s = $("#sheet"); s.style.transition = "none"; s.style.transform = `translateY(${UXG.dy}px)`;
}, { passive: true });
document.addEventListener("touchend", (e) => {
  const t = e.changedTouches[0]; if (!t) return; const dx = t.clientX - UXG.x0, dy = t.clientY - UXG.y0, fast = Date.now() - UXG.t0 < 600;
  if (UXG.mode === "sheet") {
    const s = $("#sheet"); s.style.transition = "transform .18s ease-out";
    if (UXG.dy > 110 || (UXG.dy > 50 && fast)) { s.style.transform = "translateY(100%)"; setTimeout(() => { s.style.transform = ""; s.style.transition = ""; const b = $("#sheet [data-act=back]"); if (b) b.click(); else closeSheet(); }, 170); }
    else { s.style.transform = ""; setTimeout(() => (s.style.transition = ""), 200); }
    UXG.mode = ""; return;
  }
  if (Math.abs(dx) < 70 || Math.abs(dx) < 2 * Math.abs(dy) || !fast || !$("#sheet-back").hidden) return;
  const board = UXG.el?.closest?.("#chg-b, #chl-b");
  if (board) { const k = board.id === "chg-b" ? "game" : "les"; const b = $(`[data-chnav="${k}:${dx < 0 ? 1 : -1}"]`); if (b) { b.click(); navigator.vibrate?.(8); } return; }
  if (UXG.el?.closest?.(NO_SWIPE) || !UXG.el?.closest?.("#view")) return;
  const tabs = SPACE_TABS[D.space], i = tabs.findIndex((x) => x[0] === D.tab), j = i + (dx < 0 ? 1 : -1);
  if (i < 0 || j < 0 || j >= tabs.length) return;
  D.tab = tabs[j][0]; save(); document.documentElement.dataset.swipe = dx < 0 ? "l" : "r"; render(); setTimeout(() => delete document.documentElement.dataset.swipe, 260);
}, { passive: true });

/* ------------------------------------------------------------ 🚀 les raccourcis de l'icône (manifest « shortcuts ») */
(() => {
  const go = new URLSearchParams(location.search).get("go"); if (!go) return;
  history.replaceState(history.state, "", location.pathname);
  if (go === "wlive") { D.space = "wh"; D.tab = "wlive"; }
  else if (go === "rev") { D.space = "ch"; D.tab = "chlearn"; chLoad().then(() => { if (CHM.games?.length) { chRevStart(); render(); } }); }
  else if (go === "day") { D.space = "smash"; D.tab = "home"; setTimeout(() => { const d = $("#view [data-act=day]"); if (d) d.click(); }, 400); }
  save(); render();
})();
syncDot();
