/* =====================================================================
   spaces.js — v75 : 🎮 / ⚔ / ♟ LES ESPACES DANS LA POCHE.
   - Un sélecteur en haut : Smash, Warhammer, Échecs ; chaque espace a ses onglets en bas (et retient le dernier).
   - La synchro des espaces passe par le MÊME document que tes PC : pc/espaces.enc.json dans ton dépôt privé
     (chiffré, fusion entrée par entrée, la plus récente gagne). Le téléphone n'y garde que Warhammer et Échecs ;
     ce qu'il modifie arrive sur tes PC à leur prochaine synchro, et inversement.
   - Les images (tes photos Warhammer) : pc/f/<empreinte>.enc, déchiffrées ici et gardées dans le cache.
   - Les fiches OpenHammer de tes factions : wh-units-N.enc.json, envoyées par le Hub (lisibles sans réseau).
   ===================================================================== */

/** (v83) un squelette de chargement (au lieu de « … ») */
const uxSkel = (n = 4) => `<div class="skel">${Array.from({ length: n }, (_, i) => `<div class="skel-r"><i></i><div><b style="width:${55 + ((i * 17) % 35)}%"></b><b style="width:${30 + ((i * 23) % 40)}%"></b></div></div>`).join("")}</div>`;
const SPACES = [["smash", "🎮", "Smash"], ["wh", "⚔", "Warhammer"], ["ch", "♟", "Échecs"]];
const SPACE_TABS = {
  smash: [["home", "🏠", "Accueil"], ["tours", "🏆", "Tournois"], ["players", "🆚", "Joueurs"], ["mu", "🎭", "Line Up"], ["carnet", "📓", "Carnet"], ["infos", "🔎", "Infos"]],
  wh: [["wlists", "📋", "Listes"], ["wlive", "🎲", "Partie"], ["wsheets", "📖", "Fiches"], ["wcoll", "📦", "Collection"]],
  ch: [["chome", "♟", "Échecs"]],
};
const spaceOfTab = (t) => (Object.entries(SPACE_TABS).find(([, ts]) => ts.some((x) => x[0] === t)) || ["smash"])[0];
D.space = SPACES.some((s) => s[0] === D.space) ? D.space : spaceOfTab(D.tab);
D.tabs = D.tabs || {}; D.esp = Object.assign({ flat: {}, stamps: {} }, D.esp); D.espRO = D.espRO || {};

/* ------------------------------------------------------------ l'en-tête et les onglets */
$("#title").insertAdjacentHTML("beforebegin", `<div id="spaces" role="tablist">${SPACES.map(([id, ico, n]) => `<button data-space="${id}" aria-label="${n}" title="${n}">${ico}</button>`).join("")}</div>`);
function paintChrome() {
  $$("#spaces [data-space]").forEach((b) => b.classList.toggle("on", b.dataset.space === D.space));
  const tabs = SPACE_TABS[D.space];
  if (!tabs.some((t) => t[0] === D.tab)) D.tab = D.tabs[D.space] && tabs.some((t) => t[0] === D.tabs[D.space]) ? D.tabs[D.space] : tabs[0][0];
  const html = tabs.map(([id, ico, n]) => `<button data-tab="${id}"><span>${ico}</span>${esc(n)}</button>`).join("");
  const nav = $("#tabs"); if (nav.dataset.space !== D.space) { nav.innerHTML = html; nav.dataset.space = D.space; nav.style.gridTemplateColumns = `repeat(${tabs.length}, 1fr)`; }
  $("#find-char").hidden = false;                       // (v83 : 🔎 cherche dans tous les espaces)
  document.documentElement.dataset.space = D.space;
}
const renderView0 = renderView;
renderView = function () {
  paintChrome();
  D.tabs[D.space] = D.tab;
  if (D.space === "smash") return renderView0();
  $$("#tabs [data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === D.tab));
  $("#title").textContent = SPACES.find((s) => s[0] === D.space)[2];
  const v = $("#view");
  if ((!D.cfg.repo || !D.cfg.ghToken || !D.cfg.pass) && D.space !== "ch") {             // (♟ : l'apprentissage et Chess.com marchent sans le Hub)
    v.innerHTML = `<div class="card setup"><h2>${SPACES.find((s) => s[0] === D.space)[1]} ${SPACES.find((s) => s[0] === D.space)[2]}</h2>
      <p>Tes données ${D.space === "wh" ? "Warhammer (listes, collection, parties)" : "d'échecs"} viennent de tes PC, par le même dépôt privé chiffré que le carnet Smash.</p>
      <button class="btn accent" data-act="settings" style="width:100%">⚙ Régler la synchro avec le Hub</button></div>`;
    return;
  }
  v.innerHTML = (TABS[D.tab] || (() => '<div class="empty">Bientôt.</div>'))();
  bindView(); espHydrate(v);
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("#spaces [data-space]"); if (!b) return;
  e.stopPropagation();
  if (b.dataset.space === D.space) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  D.tabs[D.space] = D.tab; D.space = b.dataset.space; D.tab = D.tabs[D.space] || SPACE_TABS[D.space][0][0];
  save(); closeSheetQuiet(); render();
}, true);
function closeSheetQuiet() { $("#sheet-back").hidden = true; }

/* ------------------------------------------------------------ 🗂 les données des espaces (à plat, datées, comme sur les PC) */
const ESP_DOC = "pc/espaces.enc.json";
const espIn = (k) => /^(wh:(coll|list|game|live|paint|cfg|art|uimg)(:|$)|ch:(cfg|learn|rep)(:|$)|file:warhammer\/photos\/)/.test(k);     // (v78 : + tes images Warhammer, ajoutables d'ici)
const E = {
  get: (k) => (D.esp.flat[k] === undefined ? undefined : structuredClone(D.esp.flat[k])),     // (une copie : la modifier ne change rien tant qu'on ne fait pas E.set)
  set(k, v) {
    if (v == null) { if (!(k in D.esp.flat)) return; delete D.esp.flat[k]; }
    else { if (same(D.esp.flat[k], v)) return; D.esp.flat[k] = structuredClone(v); }
    D.esp.stamps[k] = now(); save(); espSoon();
  },
  list: (pre) => Object.entries(D.esp.flat).filter(([k]) => k.startsWith(pre)).map(([, v]) => v),
};
let espT = null;
function espSoon() { if (!D.cfg.repo || !D.cfg.ghToken || !D.cfg.pass) return; clearTimeout(espT); espT = setTimeout(() => syncSpaces().then(() => { if (D.space !== "smash" && $("#sheet-back").hidden) render(); }).catch((e) => status("☁ " + e.message, true)), 4000); }
/** un fichier du dépôt, même gros (au-delà de 1 Mo, GitHub ne met plus le contenu dans la réponse) */
async function ghGetBig(name, binary) {
  const d = await gh("GET", name); if (!d) return { raw: null, sha: null };
  if (d.content) return { raw: unb64(d.content), sha: d.sha };
  const r = await fetch(`${GH()}/repos/${D.cfg.repo}/contents/${name}`, { cache: "no-store", headers: { Authorization: "Bearer " + D.cfg.ghToken, Accept: "application/vnd.github.raw+json" } });
  if (!r.ok) throw new Error("GitHub a répondu " + r.status);
  return { raw: new Uint8Array(await r.arrayBuffer()), sha: d.sha };
}
async function syncSpaces() {
  let got = 0, sent = 0;
  if (!D.hubSpaces) { D.espNone = true; save(); return { got: 0, sent: 0, none: true }; }     // (la synchro entre PC n'a jamais tourné : pas de document à lire)
  await espUpload();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { raw, sha } = await ghGetBig(ESP_DOC);
    if (!raw) { D.espNone = true; save(); return { got: 0, sent: 0, none: true }; }        // (la synchro entre PC n'est pas encore lancée dans le Hub)
    D.espNone = false;
    const remote = (await decrypt(JSON.parse(dec.decode(raw)))).entries || {};
    const [out, st, doc] = merge(D.esp.flat, D.esp.stamps, remote);
    const flat = Object.fromEntries(Object.entries(out).filter(([k]) => espIn(k))), stamps = Object.fromEntries(Object.entries(st).filter(([k]) => espIn(k)));
    got = [...new Set([...Object.keys(flat), ...Object.keys(D.esp.flat)])].filter((k) => !same(flat[k], D.esp.flat[k])).length;
    D.esp = { flat, stamps };
    D.espRO = { files: Object.fromEntries(Object.entries(out).filter(([k]) => k.startsWith("file:warhammer/photos/")).map(([k, v]) => [k.split("/").pop(), v.h])),
      uimg: Object.fromEntries(Object.entries(out).filter(([k]) => k.startsWith("wh:uimg:")).map(([k, v]) => [k.slice(8), v])),
      art: Object.fromEntries(Object.entries(out).filter(([k]) => k.startsWith("wh:art:")).map(([k, v]) => [k.slice(7), v])) };
    save();
    if (typeof chAnStore === "function") await chAnStore(Object.fromEntries(Object.entries(out).filter(([k]) => k.startsWith("ch:an:")).map(([k, v]) => [k.slice(6), v])));   // (v79 : les analyses du Hub, à part)
    sent = Object.keys(doc).filter((k) => !same(remote[k], doc[k])).length;
    if (!sent) break;
    const r = await ghPut(ESP_DOC, await encrypt({ v: 1, entries: doc }), sha, "Espaces (depuis le téléphone)");
    if (!r.conflict) break;
    if (attempt === 2) throw new Error("Un PC écrivait en même temps : réessaie.");
  }
  D.lastEsp = new Date().toISOString(); save();
  return { got, sent };
}
const syncCloud0 = syncCloud;
syncCloud = async function () {
  const r = await syncCloud0();
  try { const e = await syncSpaces(); r.got += e.got; r.sent += e.sent; D.espErr = ""; }
  catch (e) { D.espErr = e.message; }
  save(); return r;
};

/* ------------------------------------------------------------ 🖼 tes images (chiffrées dans le dépôt) */
const ESPI = { urls: new Map(), busy: new Map() };
async function decBytes(blob) {
  if (dec.decode(blob.slice(0, 5)) !== "SIGO1") throw new Error("image illisible");
  const key = await aesKey(D.cfg.pass, blob.slice(5, 21), 150000);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: blob.slice(21, 33) }, key, blob.slice(33)));
}
/** l'adresse (blob:) d'une photo du Hub, par son nom de fichier ; "" si elle n'est pas (encore) là */
async function espImg(name) {
  const h = D.esp.flat["file:warhammer/photos/" + name]?.h || D.espRO.files?.[name]; if (!h) return "";
  if (ESPI.urls.has(h)) return ESPI.urls.get(h);
  if (!ESPI.busy.has(h)) ESPI.busy.set(h, (async () => {
    const ext = (name.split(".").pop() || "png").replace("jpg", "jpeg"), type = "image/" + ext;
    let blob = null;
    try { const c = self.caches && await caches.open("sigo-esp-img"); const m = c && await c.match("/" + h); if (m) blob = await m.blob(); } catch (_) {}
    if (!blob) {
      const { raw } = await ghGetBig(`pc/f/${h}.enc`); if (!raw) return "";
      blob = new Blob([await decBytes(raw)], { type });
      try { if (self.caches) await (await caches.open("sigo-esp-img")).put("/" + h, new Response(blob, { headers: { "Content-Type": type } })); } catch (_) {}
    }
    const u = URL.createObjectURL(blob); ESPI.urls.set(h, u); return u;
  })().catch(() => ""));
  return ESPI.busy.get(h);
}
/** après l'affichage : les [data-eimg] reçoivent leur image */
function espHydrate(root) {
  for (const el of root.querySelectorAll("[data-eimg]")) espImg(el.dataset.eimg).then((u) => { if (u && el.isConnected) { el.style.backgroundImage = `url("${u}")`; el.classList.add("has"); } });
}
const sheet0 = sheet;
sheet = function (html) { sheet0(html); espHydrate($("#sheet")); };

/* ------------------------------------------------------------ 📷 (v78) une photo prise ici : réduite, chiffrée, envoyée une fois */
async function encBytes(raw) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(D.cfg.pass, salt, 150000), raw));
  const out = new Uint8Array(5 + 16 + 12 + ct.length); out.set(enc.encode("SIGO1")); out.set(salt, 5); out.set(iv, 21); out.set(ct, 33); return out;
}
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
/** une image du téléphone → le nom de fichier de la photo (gardée ici, envoyée à la prochaine synchro) */
async function espAddPhoto(file, max = 1600) {
  const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
  const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", 0.85)), raw = new Uint8Array(await blob.arrayBuffer());
  const h = hex(await crypto.subtle.digest("SHA-256", raw)), name = `tel-${Date.now()}-${h.slice(0, 6)}.jpg`;
  try { if (self.caches) await (await caches.open("sigo-esp-img")).put("/" + h, new Response(blob, { headers: { "Content-Type": "image/jpeg" } })); } catch (_) {}
  ESPI.urls.set(h, URL.createObjectURL(blob));
  D.espUp = [...(D.espUp || []).filter((x) => x !== h), h];
  E.set("file:warhammer/photos/" + name, { h, n: raw.length });
  return name;
}
async function espUpload() {
  for (const h of [...(D.espUp || [])]) {
    let blob = null; try { blob = await (await (await caches.open("sigo-esp-img")).match("/" + h))?.blob(); } catch (_) {}
    if (!blob) { D.espUp = D.espUp.filter((x) => x !== h); continue; }
    const r = await gh("PUT", `pc/f/${h}.enc`, { message: "Image (depuis le téléphone)", content: b64(await encBytes(new Uint8Array(await blob.arrayBuffer()))) });
    if (r) { D.espUp = D.espUp.filter((x) => x !== h); save(); }          // (déjà là : 409/422 → { conflict } : c'est bon aussi)
  }
}
