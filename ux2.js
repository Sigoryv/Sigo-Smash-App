/* =====================================================================
   ux2.js — v83 : 🔎 LA RECHERCHE PARTOUT, 🎨 UNE COULEUR PAR ESPACE, 🔠 LA TAILLE DU TEXTE.
   🔎 (en haut) : un perso Smash, un joueur, une unité / une liste / une figurine Warhammer, une ouverture ou un
   adversaire d'échecs — un seul champ, et on y va d'un toucher.
   ===================================================================== */

/* ------------------------------------------------------------ 🔠 la taille du texte */
const UX_FS = [["14", "Petit"], ["15", "Normal"], ["16", "Grand"], ["17", "Très grand"]];
const uxFs = () => (UX_FS.some((x) => x[0] === D.cfg.fs) ? D.cfg.fs : "15");
const uxApplyFs = () => document.documentElement.style.setProperty("--fs", uxFs() + "px");
uxApplyFs();
const sheetSettingsUx0 = sheetSettings;
sheetSettings = function () {
  sheetSettingsUx0();
  $("#sheet .btns").insertAdjacentHTML("beforebegin", `<div class="card"><h3>🔠 Affichage</h3><label>Taille du texte</label>
    <div class="seg" id="s-fs">${UX_FS.map(([k, n]) => `<button data-fs="${k}" class="${uxFs() === k ? "on" : ""}" style="font-size:${k}px">${n}</button>`).join("")}</div></div>`);
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("#s-fs [data-fs]"); if (!b) return;
  D.cfg.fs = b.dataset.fs; save(); uxApplyFs(); $$("#s-fs [data-fs]").forEach((x) => x.classList.toggle("on", x === b));
});

/* ------------------------------------------------------------ 🔎 la recherche dans tous les espaces */
const uxN = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function uxSearch(q) {
  const n = uxN(q).trim(), out = [];
  if (n.length < 2) return out;
  const hit = (s) => uxN(s).includes(n);
  // 🎮 Smash : les persos (surnoms compris), les joueurs rencontrés
  for (const [slug, name] of infList(q).slice(0, 6)) out.push({ g: "🎮 Persos", ico: luArt(slug, "lu-a ux-i"), t: name, s: "move set, frame data, tes MU", go: () => { D.space = "smash"; D.tab = "infos"; save(); render(); sheetChar(slug); } });
  const opp = new Map(); for (const s of allSets()) if (s.opp && hit(s.opp) && !opp.has(s.opp_id)) opp.set(s.opp_id, s);
  for (const s of [...opp.values()].slice(0, 6)) out.push({ g: "🎮 Joueurs", t: s.opp, s: `dernier set ${fmtDate(s.ts)}`, go: () => { D.space = "smash"; D.tab = "players"; save(); render(); sheetOpp(s.opp_id); } });
  // ⚔ Warhammer : listes, collection, fiches
  for (const l of E.list("wh:list:").filter((l) => hit(l.name) || hit(l.faction)).slice(0, 4)) out.push({ g: "⚔ Listes", t: l.name, s: `${l.faction} · ${wTotal(l)} pts`, go: () => { D.space = "wh"; D.tab = "wlists"; WHP.list = l.id; save(); render(); } });
  for (const x of E.list("wh:coll:").filter((x) => hit(x.name) || hit(x.project)).slice(0, 6)) out.push({ g: "⚔ Collection", t: x.name, s: x.project || x.faction || "", go: () => { D.space = "wh"; D.tab = "wcoll"; save(); render(); sheetWColl(x.id); } });
  for (const [fac, us] of Object.entries(WHU.f || {})) for (const u of us) if (hit(u.name)) { if (out.filter((r) => r.g === "⚔ Fiches").length >= 8) break; out.push({ g: "⚔ Fiches", t: u.name, s: `${fac} · ${wPts(u)} pts`, go: () => { D.space = "wh"; D.tab = "wsheets"; WHP.fac = fac; save(); render(); sheetWSheet(fac, u.id); } }); }
  // ♟ Échecs : ouvertures, adversaires
  for (const o of CH_LIB.filter((o) => hit(o.fr) || o.names.some(hit) || hit(o.eco)).slice(0, 5)) out.push({ g: "♟ Ouvertures", t: o.fr, s: `${o.eco} · ${o.side === "w" ? "avec les blancs" : "avec les noirs"}`, go: () => { D.space = "ch"; D.tab = "chlearn"; CHM.rev = null; chOpenLesson(o.id); save(); render(); } });
  const co = new Map(); for (const g of CHM.games || []) if (hit(g.opp.name)) co.set(g.opp.name.toLowerCase(), [...(co.get(g.opp.name.toLowerCase()) || []), g]);
  for (const l of [...co.values()].slice(0, 5)) out.push({ g: "♟ Adversaires", t: l[0].opp.name, s: `${l.length} partie(s)`, go: () => { D.space = "ch"; D.tab = "chopp"; save(); render(); sheetChOpp(l[0].opp.name); } });
  return out;
}
const UXS = { q: "", res: [] };
function uxSearchDraw() {
  const r = $("#ux-res"); if (!r) return;
  UXS.res = uxSearch(UXS.q);
  let g = "";
  r.innerHTML = UXS.res.map((x, i) => (x.g !== g ? `<h3>${esc((g = x.g))}</h3>` : "") + `<div class="row" data-uxgo="${i}">${x.ico || ""}<div class="grow"><div><b>${esc(x.t)}</b></div><div class="muted small">${esc(x.s)}</div></div>›</div>`).join("")
    || `<div class="empty small">${UXS.q.trim().length < 2 ? "Un perso, un joueur, une unité, une liste, une ouverture, un adversaire…" : "Rien trouvé."}</div>`;
}
function sheetSearch() {
  if (D.space === "ch" && chUser() && !CHM.games) chLoad().then(uxSearchDraw);
  if (!WHU.f) whUnitsLoad().then(uxSearchDraw);
  sheet(`<h2>🔎 Chercher partout</h2><input type="search" id="ux-q" placeholder="Fox, Leon, Terminators, Caro-Kann…" value="${esc(UXS.q)}" autocomplete="off"><div id="ux-res" style="margin-top:6px"></div>`);
  uxSearchDraw(); const q = $("#ux-q"); q.oninput = () => { UXS.q = q.value; uxSearchDraw(); }; setTimeout(() => q.focus(), 60);
}
document.addEventListener("click", (e) => {
  if (e.target.closest("#find-char")) { e.stopPropagation(); return sheetSearch(); }
  const r = e.target.closest("[data-uxgo]"); if (r) { e.stopPropagation(); const x = UXS.res[+r.dataset.uxgo]; $("#sheet-back").hidden = true; window.scrollTo(0, 0); x?.go(); }
}, true);
$("#find-char").setAttribute("aria-label", "Chercher partout");

/* ------------------------------------------------------------ ✨ les transitions : la page apparaît en douceur quand on change d'onglet */
let uxLastTab = null;
const renderViewUx2 = renderView;
renderView = function () {
  const changed = uxLastTab && uxLastTab !== `${D.space}|${D.tab}`;
  uxLastTab = `${D.space}|${D.tab}`;
  renderViewUx2();
  if (changed && !document.documentElement.dataset.swipe) { const v = $("#view"); v.classList.remove("ux-in"); void v.offsetWidth; v.classList.add("ux-in"); navigator.vibrate?.(5); }
};
