/* =====================================================================
   wh.js — v75 : ⚔ WARHAMMER DANS LA POCHE.
   📋 tes listes d'armée (composition, équipement, personnages rattachés, contrôles des règles de base) ·
   🎲 la partie en cours (gros boutons, tour par tour) · 📖 les fiches de tes factions (sans réseau) ·
   📦 ta collection (avancer tes figurines, recettes, photos).
   Mêmes données que le Hub : entrées « wh:… » du document des espaces (spaces.js).
   ===================================================================== */

const WHS = [["grappe", "Sur grappe"], ["monte", "Monté"], ["sous_couche", "Sous-couche"], ["peint", "Peint"], ["socle", "Soclé"]];
const WHP = { list: "", fac: "", q: "", coll: "" };
const WHU = { f: null };
const wid = (p) => p + Date.now() + Math.random().toString(16).slice(2, 6);
const wKey = (n) => String(n || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const wFold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const wPts = (u) => u?.points?.variants?.[0]?.cost || u?.points?.base || 0;
const wHue = (f) => { let h = 0; for (const ch of String(f || "")) h = (h * 31 + ch.codePointAt(0)) % 360; return h; };
const wBadge = (f) => `<span class="wfb" style="--fh:${wHue(f)}">${esc(initials(f || "?"))}</span>`;
const wCfg = () => E.get("wh:cfg") || {};
const wArt = (k) => D.esp.flat["wh:art:" + k] || D.espRO.art?.[k] || "";
const wUimg = (k) => D.esp.flat["wh:uimg:" + k] || D.espRO.uimg?.[k] || "";

/* ------------------------------------------------------------ les fiches du Hub (wh-units-N.enc.json) */
async function whUnitsLoad() {
  if (WHU.f) return WHU.f;
  try { const r = self.caches && await (await caches.open("sigo-wh")).match("units.json"); WHU.f = r ? await r.json() : JSON.parse(localStorage.getItem("sigo.wh.units") || "{}"); }
  catch (_) { WHU.f = {}; }
  return WHU.f;
}
async function whSyncUnits(s) {
  const f = s?.wh_units; if (!f || !f.n || (localStorage.getItem("sigo.wh.units.hash") === f.hash && WHU.f && Object.keys(WHU.f).length)) return;
  const all = {};
  for (let i = 0; i < f.n; i++) { const g = await ghGet(`wh-units-${i}.enc.json`); if (!g.obj) throw new Error(`wh-units-${i}.enc.json introuvable`); Object.assign(all, (await decrypt(g.obj)).factions || {}); }
  WHU.f = all; const body = JSON.stringify(all);
  if (self.caches) await (await caches.open("sigo-wh")).put("units.json", new Response(body, { headers: { "Content-Type": "application/json" } }));
  else localStorage.setItem("sigo.wh.units", body);
  localStorage.setItem("sigo.wh.units.hash", f.hash);
}
if (typeof luSyncFrames === "function") { const lf = luSyncFrames; luSyncFrames = async function (s) { D.hubSpaces = !!s?.spaces; await whSyncUnits(s).catch((e) => (D.espErr = "Fiches Warhammer : " + e.message)); return lf(s); }; }
const whNeedUnits = () => { if (!WHU.f) { whUnitsLoad().then(() => { if (D.space === "wh") render(); }); return true; } return false; };
const wUnits = (fac) => (WHU.f || {})[fac] || [];
const wFacs = () => [...new Set([...Object.keys(WHU.f || {}), ...E.list("wh:list:").map((l) => l.faction)].filter(Boolean))].sort();
const wRefIn = (fac) => { const m = new Map(); for (const u of wUnits(fac)) { m.set(u.id, u); if (!m.has(wKey(u.name))) m.set(wKey(u.name), u); } return m; };

/* ------------------------------------------------------------ les règles (comme le Hub) */
const wIsChar = (r) => (r?.keywords || []).some((k) => /^character$/i.test(k));
const wHasKw = (r, re) => (r?.keywords || []).some((k) => re.test(k));
const wSizes = (r, u) => r?.points?.variants?.length ? r.points.variants : [{ name: u.variant && u.variant !== "—" ? u.variant : "Taille de base", cost: r ? wPts(r) : u.cost }];
const wModels = (u, r) => u.models || +(String(u.variant || "").match(/\d+/)?.[0] || 0) || (r?.composition?.min_models > 1 ? r.composition.min_models : 0) || (r?.type === "model" ? 1 : 0);
const wCanLead = (r, t) => (r?.leads || []).some((n) => wFold(n) === wFold(t.name));
const wTotal = (L) => L.units.reduce((a, u) => a + (u.cost || 0) + (u.enh_cost || 0), 0);
function wChecks(L, refs) {
  const out = [], ref = (u) => refs.get(u.unit_id) || refs.get(wKey(u.name)), total = wTotal(L);
  if (total > L.target) out.push(["ko", `${total - L.target} pts de trop.`]);
  const lords = L.units.filter((u) => u.warlord);
  if (!lords.length && L.units.length) out.push(["mid", "Pas de Seigneur de guerre."]);
  for (const u of lords) if (ref(u) && !wIsChar(ref(u))) out.push(["ko", `${u.name} : Seigneur de guerre sans être un personnage.`]);
  const enh = L.units.filter((u) => u.enh);
  if (enh.length > 3) out.push(["ko", `${enh.length} améliorations : 3 au plus.`]);
  for (const u of enh) if (ref(u) && (!wIsChar(ref(u)) || wHasKw(ref(u), /^epic hero$/i))) out.push(["ko", `Amélioration interdite sur ${u.name}.`]);
  const by = new Map(); for (const u of L.units) { const k = u.unit_id || wKey(u.name); by.set(k, [...(by.get(k) || []), u]); }
  for (const [, us] of by) { const r = ref(us[0]); if (r && wHasKw(r, /^epic hero$/i) && us.length > 1) out.push(["ko", `${us[0].name} : une seule fois.`]); else { const mx = r && wHasKw(r, /^(battleline|dedicated transport)$/i) ? 6 : 3; if (us.length > mx) out.push(["ko", `${us.length}× ${us[0].name} : ${mx} au plus.`]); } }
  for (const u of L.units.filter((x) => x.attach)) { const t = L.units.find((x) => x.uid === u.attach); if (t && ref(u) && !wCanLead(ref(u), t)) out.push(["ko", `${u.name} ne peut pas mener ${t.name}.`]); }
  for (const u of L.units) { const n = wModels(u, ref(u)); for (const [w, c] of Object.entries(u.gear || {})) if (n && c > n) out.push(["mid", `${u.name} : ${c}× ${w} pour ${n} fig.`]); }
  return out;
}
function wOwn(u, coll) {
  const k = wKey(u.name), mine = coll.filter((x) => (u.unit_id && x.unit_id === u.unit_id) || wKey(x.name) === k);
  const n = (st) => mine.reduce((a, x) => a + st.reduce((b, s) => b + (x.counts?.[s] || 0), 0), 0), p = n(["peint", "socle"]), all = n(WHS.map((s) => s[0]));
  return !all ? '<span class="wown ko">✗ manque</span>' : p ? '<span class="wown ok">✓ peinte</span>' : all - n(["grappe"]) ? '<span class="wown mid">◐ montée</span>' : '<span class="wown low">○ grappe</span>';
}
const wPic = (name, unitId) => { const coll = E.list("wh:coll:"), c = coll.find((x) => unitId && x.unit_id === unitId && x.photos?.length); return wUimg(wKey(name)) || c?.photos?.[0] || ""; };
const wThumb = (name, fac, unitId, cls = "wth") => { const p = wPic(name, unitId); return `<span class="${cls}" style="--fh:${wHue(fac)}" ${p ? `data-eimg="${esc(p)}"` : ""}>${esc(initials(name))}</span>`; };

/* ------------------------------------------------------------ 📋 les listes */
function viewWLists() {
  if (whNeedUnits()) return '<div class="empty">Les fiches…</div>';
  const lists = E.list("wh:list:").sort((a, b) => a.name.localeCompare(b.name));
  const L = WHP.list && lists.find((l) => l.id === WHP.list);
  if (L) return viewWList(L);
  const warn = D.espErr ? `<div class="card err small">⚠ ${esc(D.espErr)}</div>` : D.espNone ? '<div class="card small muted">☁ Dans le Hub, lance une fois la synchro entre PC (☁ en bas à gauche) : c\'est elle qui apporte tes listes, ta collection et tes parties.</div>' : "";
  return `${warn}<div class="lu-h"><h2>📋 Listes d'armée</h2><button class="btn" data-wact="list-new">＋ Liste</button></div>
    ${lists.map((l) => { const t = wTotal(l), art = wArt("list:" + l.id) || wArt("faction:" + wKey(l.faction));
      return `<div class="card wl-c" data-wlist="${esc(l.id)}" style="--fh:${wHue(l.faction)}">${art ? `<div class="wl-art" data-eimg="${esc(art)}"></div>` : ""}<div class="row" style="border:none;padding:0">${wBadge(l.faction)}
        <div class="grow"><div><b>${esc(l.name)}</b></div><div class="muted small">${esc(l.faction)}${l.detachment ? " · " + esc(l.detachment) : ""} · ${l.units.length} unités</div></div>
        <div style="text-align:right"><b class="${t > l.target ? "l" : ""}">${t}</b><div class="muted small">/ ${l.target}</div></div></div>
        <div class="bar"><span style="width:${Math.min(100, (100 * t) / (l.target || 1))}%"></span></div></div>`; }).join("") || '<div class="empty">Aucune liste : crée-en une, ou fais-la dans le Hub.</div>'}`;
}
function viewWList(L) {
  const refs = wRefIn(L.faction), ref = (u) => refs.get(u.unit_id) || refs.get(wKey(u.name)), coll = E.list("wh:coll:"), checks = wChecks(L, refs), t = wTotal(L);
  const art = wArt("list:" + L.id) || wArt("faction:" + wKey(L.faction));
  const row = (u, sub) => { const r = ref(u), gear = Object.entries(u.gear || {}).map(([w, n]) => `${n}× ${w}`).join(" · ");
    return `<div class="row wu ${sub ? "sub" : ""} ${u.warlord ? "lord" : ""}" data-wunit="${esc(u.uid)}">${wThumb(u.name, L.faction, u.unit_id)}
      <div class="grow"><div><b>${u.warlord ? "★ " : ""}${sub ? "👑 " : ""}${esc(u.name)}</b></div><div class="muted small">${esc(u.variant && u.variant !== "—" ? u.variant : "")}${wModels(u, r) ? ` · ${wModels(u, r)} fig.` : ""}${u.enh ? ` · ✨ ${esc(u.enh)}` : ""}</div>
        ${gear ? `<div class="small wgear">🔫 ${esc(gear)}</div>` : ""}</div><div style="text-align:right"><b>${(u.cost || 0) + (u.enh_cost || 0)}</b><div>${wOwn(u, coll)}</div></div></div>`; };
  const tops = L.units.filter((u) => !u.attach || !L.units.some((x) => x.uid === u.attach));
  const body = tops.map((u) => { const ls = L.units.filter((x) => x.attach === u.uid);
    return ls.length ? `<div class="wgroup"><div class="small wgroup-h">🔗 Unité menée · ${ls.reduce((a, x) => a + x.cost + (x.enh_cost || 0), u.cost + (u.enh_cost || 0))} pts</div>${row(u)}${ls.map((x) => row(x, true)).join("")}</div>` : row(u); }).join("");
  return `<button class="btn wback" data-wact="lists">← Listes</button>
    <div class="card whero" style="--fh:${wHue(L.faction)}">${art ? `<div class="wl-art big" data-eimg="${esc(art)}"></div>` : ""}<div class="row" style="border:none;padding:0">${wBadge(L.faction)}<div class="grow"><div><b>${esc(L.name)}</b></div>
      <div class="muted small">${esc(L.faction)}${L.detachment ? " · " + esc(L.detachment) : ""}</div></div><button class="btn wpic-btn" data-wpicker="list" data-key="${esc(L.id)}" title="Une image pour cette liste">🖼</button><button class="btn" data-wact="list-edit">✏</button></div>
      <div class="wtot ${t > L.target ? "over" : ""}"><b>${t}</b> / ${L.target} pts · ${t > L.target ? `⚠ ${t - L.target} de trop` : `reste ${L.target - t}`}</div><div class="bar"><span style="width:${Math.min(100, (100 * t) / (L.target || 1))}%"></span></div></div>
    ${L.units.length ? `<div class="card wchecks ${checks.some((c) => c[0] === "ko") ? "ko" : checks.length ? "mid" : "ok"}">${checks.length ? checks.map(([k, x]) => `<div class="small ${k}">${k === "ko" ? "✗" : "!"} ${esc(x)}</div>`).join("") : '<div class="small">✅ La liste respecte les règles de base.</div>'}</div>` : ""}
    <div class="card">${body || '<div class="empty">Liste vide.</div>'}</div>
    <div class="btns"><button class="btn accent" data-wact="unit-add">＋ Unité</button><button class="btn" data-wact="list-play">▶ Jouer</button><button class="btn" data-wact="list-copy">📋 Copier</button></div>`;
}
const wSaveList = (L) => E.set("wh:list:" + L.id, L);
const wCurList = () => E.get("wh:list:" + WHP.list);
function sheetWListEdit(L) {
  const facs = wFacs(); L = L || { id: "", name: "", faction: wCfg().faction || facs[0] || "Chaos Space Marines", detachment: "", target: 1000, notes: "", units: [] };
  sheet(`<h2>${L.id ? "✏ La liste" : "＋ Une liste"}</h2><div class="card"><label>Nom</label><input type="text" id="wl-n" value="${esc(L.name)}" placeholder="Ma liste 1000 pts">
    <label>Faction</label><select id="wl-f">${[...new Set([L.faction, ...facs])].map((f) => `<option ${f === L.faction ? "selected" : ""}>${esc(f)}</option>`).join("")}</select>
    <label>Détachement</label><input type="text" id="wl-d" value="${esc(L.detachment || "")}"><label>Format</label><select id="wl-t">${[500, 1000, 1500, 2000, 3000].map((p) => `<option ${p === L.target ? "selected" : ""} value="${p}">${p} pts</option>`).join("")}</select>
    <label>Notes</label><textarea id="wl-no" rows="3">${esc(L.notes || "")}</textarea></div>
    <div class="btns">${L.id ? '<button class="btn danger" data-wact="list-del">Supprimer</button>' : ""}<button class="btn accent" data-wact="list-save" data-id="${esc(L.id)}">Enregistrer</button></div>`);
}
function sheetWAdd(L) {
  const us = wUnits(L.faction);
  sheet(`<h2>＋ Une unité · ${esc(L.faction)}</h2><input type="search" id="wa-q" placeholder="Chercher (Terminators, Lord…)" autocomplete="off">
    <div class="card" id="wa-res">${us.length ? wAddRows(us, "") : '<div class="empty small">Pas de fiches pour cette faction sur le téléphone : ouvre-la une fois dans le Hub (Fiches d\'unités), puis ⟳.</div>'}</div>`);
}
const wAddRows = (us, q) => us.filter((u) => !q || wFold(u.name).includes(wFold(q))).slice(0, 80).map((u) => `<div class="row" data-wadd="${esc(u.id)}"><div class="grow"><div><b>${esc(u.name)}</b></div><div class="muted small">${wIsChar(u) ? "👑 personnage · " : ""}${(u.points?.variants || []).map((v) => v.cost).join(" / ") || wPts(u)} pts</div></div>＋</div>`).join("") || '<div class="empty small">Rien.</div>';
function sheetWUnit(L, uid) {
  const u = L.units.find((x) => x.uid === uid); if (!u) return;
  const r = wRefIn(L.faction).get(u.unit_id) || wRefIn(L.faction).get(wKey(u.name)), sizes = wSizes(r, u), ch = wIsChar(r), n = wModels(u, r);
  const ws = [...(r?.ranged || []).map((w) => ({ ...w, m: false })), ...(r?.melee || []).map((w) => ({ ...w, m: true }))];
  const cands = L.units.filter((t) => t.uid !== u.uid && !t.attach && (!r?.leads?.length || wCanLead(r, t)));
  sheet(`<h2>${esc(u.name)}</h2>${r ? `<button class="chip-b" data-wsheet="${esc(r.id)}" data-fac="${esc(L.faction)}">📖 La fiche</button>` : ""}
    <div class="card" id="wu-f"><label>Taille</label><select id="wu-v">${sizes.map((v) => `<option value="${esc(v.name)}" data-cost="${v.cost}" data-models="${v.models || +(String(v.name).match(/\d+/)?.[0] || 0) || ""}" ${v.name === u.variant || (!u.variant && v === sizes[0]) ? "selected" : ""}>${esc(v.name)} · ${v.cost} pts</option>`).join("")}</select>
      <div class="wgrid2"><div><label>Figurines</label><input type="number" id="wu-m" min="0" max="50" value="${n || ""}"></div><div><label>Points</label><input type="number" id="wu-c" min="0" value="${u.cost}"></div></div>
      ${ch ? `<label class="wchk"><input type="checkbox" id="wu-lord" ${u.warlord ? "checked" : ""}> ★ Seigneur de guerre</label>
        <div class="wgrid2"><div><label>Amélioration</label><input type="text" id="wu-e" value="${esc(u.enh || "")}"></div><div><label>Pts</label><input type="number" id="wu-ec" min="0" value="${u.enh_cost || 0}"></div></div>
        ${r?.leads?.length ? `<label>👑 Mène</label><select id="wu-a"><option value="">— seul</option>${cands.map((t) => `<option value="${esc(t.uid)}" ${u.attach === t.uid ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select><div class="muted small">Peut mener : ${esc(r.leads.join(", "))}</div>` : ""}` : ""}</div>
    ${ws.length ? `<h3>🔫 Équipement <span class="muted small">(figurines qui portent chaque arme)</span></h3><div class="card">${ws.map((w, i) => `<div class="row wgw"><span>${w.m ? "⚔" : "🎯"}</span><div class="grow"><div><b>${esc(w.name)}</b></div><div class="muted small">${esc([w.Range && !w.m ? w.Range : "", "A" + (w.A ?? "?"), "F" + (w.S ?? "?"), "PA" + (w.AP ?? "?"), "D" + (w.D ?? "?")].filter(Boolean).join(" · "))}</div></div>
      <div class="wstep"><button class="btn" data-wst="-1" data-i="${i}">−</button><b data-wg="${i}" data-name="${esc(w.name)}">${u.gear?.[w.name] || 0}</b><button class="btn" data-wst="1" data-i="${i}">＋</button></div></div>`).join("")}</div>` : ""}
    <div class="btns"><button class="btn danger" data-wact="unit-rm" data-uid="${esc(uid)}">Retirer</button><button class="btn accent" data-wact="unit-save" data-uid="${esc(uid)}">Enregistrer</button></div>`);
}
function wExport(L) {
  const line = (u, p = "") => [`${p}${u.warlord ? "★ " : ""}${u.name}${u.models ? ` (${u.models} fig.)` : ""} : ${u.cost} pts${u.enh ? ` + ${u.enh} (${u.enh_cost} pts)` : ""}`, ...Object.entries(u.gear || {}).map(([w, n]) => `${p}   • ${n}× ${w}`)];
  return [`${L.name} (${wTotal(L)} pts)`, `${L.faction}${L.detachment ? " · " + L.detachment : ""} · ${L.target} pts`, "",
    ...L.units.filter((u) => !u.attach).flatMap((u) => [...line(u), ...L.units.filter((x) => x.attach === u.uid).flatMap((x) => line(x, "   👑 "))])].join("\n");
}

/* ------------------------------------------------------------ 🎲 la partie en cours */
function viewWLive() {
  const lv = E.get("wh:live"), games = E.list("wh:game:").sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const recent = games.length ? `<h2>📓 Dernières parties</h2><div class="card">${games.slice(0, 6).map((g) => `<div class="row"><span class="res ${g.result === "V" ? "w" : g.result === "D" ? "l" : ""}">${g.result}</span><div class="grow"><div><b>${esc(g.faction || "?")}</b> <span class="muted small">${esc(g.opponent || "")}</span></div><div class="muted small">${esc(g.mission || "")} · ${g.points} pts · ${esc(g.date)}</div></div><b>${g.me}-${g.opp}</b></div>`).join("")}</div>
    <div class="muted small" style="text-align:center">${games.filter((g) => g.result === "V").length} V · ${games.filter((g) => g.result === "D").length} D · ${games.filter((g) => g.result === "N").length} N</div>` : "";
  if (!lv) {
    const lists = E.list("wh:list:");
    return `<h2>🎲 Nouvelle partie</h2><div class="card"><label>Adversaire</label><input type="text" id="wv-o" placeholder="Son pseudo"><label>Sa faction</label><input type="text" id="wv-f" list="wv-fl" placeholder="Orks…"><datalist id="wv-fl">${wFacs().map((f) => `<option value="${esc(f)}">`).join("")}</datalist>
      <label>Mission</label><input type="text" id="wv-mi"><label>Ma liste</label><select id="wv-l"><option value="">—</option>${lists.map((l) => `<option value="${esc(l.id)}">${esc(l.name)} (${wTotal(l)} pts)</option>`).join("")}</select>
      <label>Format</label><select id="wv-p">${[500, 1000, 1500, 2000, 3000].map((p) => `<option ${p === 1000 ? "selected" : ""}>${p}</option>`).join("")}</select></div>
      <button class="btn accent" data-wact="live-start" style="width:100%">▶ Commencer</button>${recent}`;
  }
  const me = lv.rounds.reduce((a, r) => a + r.me, 0), op = lv.rounds.reduce((a, r) => a + r.opp, 0), i = lv.turn - 1, R = lv.rounds[i] || { me: 0, opp: 0, cp_me: 0, cp_opp: 0 };
  const step = (k, lab) => `<div class="wlive-k"><span>${lab}</span><div class="wstep big"><button class="btn" data-wlv="${k}" data-d="-1">−</button><b>${R[k]}</b><button class="btn" data-wlv="${k}" data-d="1">＋</button></div></div>`;
  return `<div class="card wscore"><div><div class="muted small">Moi</div><b class="w">${me}</b></div><div class="muted">contre</div><div><div class="muted small">${esc(lv.opponent || "Adversaire")}${lv.faction ? " · " + esc(lv.faction) : ""}</div><b class="l">${op}</b></div></div>
    <div class="chips">${[1, 2, 3, 4, 5].map((n) => `<button class="chip-b ${n === lv.turn ? "on" : ""}" data-wturn="${n}">Tour ${n}${lv.rounds[n - 1] ? ` · ${lv.rounds[n - 1].me}-${lv.rounds[n - 1].opp}` : ""}</button>`).join("")}</div>
    <div class="card"><h3>Tour ${lv.turn}</h3>${step("me", "🎯 Mes points")}${step("opp", "🎯 Ses points")}${step("cp_me", "⚡ Mes PC")}${step("cp_opp", "⚡ Ses PC")}</div>
    <div class="card"><label>Notes</label><textarea id="wv-no" rows="2">${esc(lv.notes || "")}</textarea><div class="muted small">${esc(lv.mission || "")} · ${lv.points} pts${lv.list_id && E.get("wh:list:" + lv.list_id) ? " · " + esc(E.get("wh:list:" + lv.list_id).name) : ""}</div></div>
    <div class="btns"><button class="btn danger" data-wact="live-cancel">Abandonner</button><button class="btn accent" data-wact="live-end">🏁 Terminer</button></div>${recent}`;
}

/* ------------------------------------------------------------ 📖 les fiches */
function viewWSheets() {
  if (whNeedUnits()) return '<div class="empty">Les fiches…</div>';
  const facs = Object.keys(WHU.f || {}).sort();
  if (!facs.length) return `<div class="empty">Pas encore de fiches sur ce téléphone.<br><span class="small">Le Hub envoie celles de tes factions (tes listes, tes adversaires) à la synchro : ⟳ dans le Hub puis ici.</span></div>`;
  if (!facs.includes(WHP.fac)) WHP.fac = facs.includes(wCfg().faction) ? wCfg().faction : facs[0];
  const us = wUnits(WHP.fac).filter((u) => !WHP.q || wFold(u.name).includes(wFold(WHP.q)));
  return `<div class="chips">${facs.map((f) => `<button class="chip-b ${f === WHP.fac ? "on" : ""}" data-wfac="${esc(f)}">${esc(f)}</button>`).join("")}</div>
    <input type="search" id="ws-q" placeholder="Chercher une unité…" value="${esc(WHP.q)}" autocomplete="off">
    <div class="card" id="ws-list" style="margin-top:8px">${us.map((u) => `<div class="row" data-wsheet="${esc(u.id)}" data-fac="${esc(WHP.fac)}">${wThumb(u.name, WHP.fac, u.id)}<div class="grow"><div><b>${esc(u.name)}</b></div>
      <div class="muted small">${wIsChar(u) ? "👑 · " : ""}${["M", "T", "SV", "W"].map((k) => `${{ M: "M", T: "E", SV: "Sv", W: "PV" }[k]} ${esc(u.stats?.[k] ?? "–")}`).join(" · ")}${u.invuln ? ` · ${esc(u.invuln)} invu` : ""}</div></div><b>${wPts(u)}</b></div>`).join("") || '<div class="empty small">Rien.</div>'}</div>`;
}
function sheetWSheet(fac, id) {
  const u = wUnits(fac).find((x) => x.id === id); if (!u) return;
  const wt = (ws, m) => ws?.length ? `<h3>${m ? "⚔ Mêlée" : "🎯 Tir"}</h3><div class="card wweap">${ws.map((w) => `<div class="wweap-r"><b>${esc(w.name)}</b><div class="wweap-s">${(m ? [["A", w.A], ["CC", w.WS ?? w.BS], ["F", w.S], ["PA", w.AP], ["D", w.D]] : [["Portée", w.Range], ["A", w.A], ["CT", w.BS ?? w.WS], ["F", w.S], ["PA", w.AP], ["D", w.D]]).map(([k, v]) => `<span><i>${k}</i>${esc(v ?? "–")}</span>`).join("")}</div>${w.Keywords ? `<div class="muted small">${esc(Array.isArray(w.Keywords) ? w.Keywords.join(", ") : w.Keywords)}</div>` : ""}</div>`).join("")}</div>` : "";
  const p = wPic(u.name, u.id);
  sheet(`${p ? `<div class="wsheet-pic" data-eimg="${esc(p)}"></div>` : ""}<h2>${esc(u.name)}</h2><div class="muted small">${esc(fac)} · ${(u.points?.variants || []).map((v) => `${esc(v.name)} ${v.cost} pts`).join(" · ") || wPts(u) + " pts"}</div>
    <div class="wstats">${[["M", "M"], ["E", "T"], ["Sv", "SV"], ["PV", "W"], ["Cd", "LD"], ["OC", "OC"]].map(([l, k]) => `<div><span>${l}</span><b>${esc(u.stats?.[k] ?? "–")}</b></div>`).join("")}${u.invuln ? `<div class="inv"><span>Invu</span><b>${esc(u.invuln)}</b></div>` : ""}</div>
    ${u.leads?.length ? `<div class="card small">👑 <b>Peut mener :</b> ${esc(u.leads.join(", "))}</div>` : ""}
    ${wt(u.ranged, false)}${wt(u.melee, true)}
    ${u.abilities?.length ? `<h3>✨ Aptitudes</h3><div class="card">${u.abilities.map((a) => `<p class="small"><b>${esc(a.name)}</b>${a.description ? " — " + esc(a.description.replace(/\*\*/g, "")) : ""}</p>`).join("")}</div>` : ""}
    ${u.keywords?.length ? `<div class="chips wrap">${u.keywords.map((k) => `<span class="chip">${esc(k)}</span>`).join("")}</div>` : ""}
    <div class="btns"><button class="btn" data-wpicker="unit" data-key="${esc(wKey(u.name))}" data-fac="${esc(fac)}" data-id="${esc(id)}">🖼 ${p ? "Changer l'image" : "Choisir une image"}</button><button class="btn" data-act="close">Fermer</button></div>`);
}

/* ------------------------------------------------------------ 📦 la collection */
function viewWColl() {
  const items = E.list("wh:coll:"), tot = (k) => items.reduce((a, x) => a + (x.counts?.[k] || 0), 0), all = WHS.reduce((a, [k]) => a + tot(k), 0);
  const painted = tot("peint") + tot("socle"), built = all - tot("grappe"), pc = (n) => all ? Math.round((100 * n) / all) : 0;
  const paint = E.get("wh:paint") || {}, mo = new Date().toISOString().slice(0, 7), month = paint.months?.[mo] || 0;
  const groups = new Map(); for (const x of items) { const g = x.project || x.faction || "Sans faction"; groups.set(g, [...(groups.get(g) || []), x]); }
  return `<div class="kpis"><div class="kpi"><b>${all}</b><span>figurines</span></div><div class="kpi"><b>${pc(built)} %</b><span>montées</span></div><div class="kpi"><b>${pc(painted)} %</b><span>peintes</span></div></div>
    <div class="card small">🎨 Ce mois-ci : <b>${month}</b> peinte(s)${paint.goal ? ` / objectif ${paint.goal}` : ""}${paint.goal ? `<div class="bar"><span style="width:${Math.min(100, (100 * month) / paint.goal)}%"></span></div>` : ""}</div>
    ${[...groups].map(([g, l]) => `<h3>${esc(g)} <span class="muted small">· ${l.length}</span></h3><div class="card">${l.sort((a, b) => a.name.localeCompare(b.name)).map((x) => { const n = WHS.reduce((a, [k]) => a + (x.counts?.[k] || 0), 0);
      return `<div class="row" data-wcoll="${esc(x.id)}">${wThumb(x.name, x.faction, x.unit_id)}<div class="grow"><div><b>${esc(x.name)}</b>${x.recipe ? " 🎨" : ""}${x.photos?.length ? ` 📷${x.photos.length}` : ""}</div>
        <div class="wstack">${WHS.map(([k]) => x.counts?.[k] ? `<span class="wst-${k}" style="flex:${x.counts[k]}"></span>` : "").join("")}</div></div><b>${n}</b></div>`; }).join("")}</div>`).join("") || '<div class="empty">Ta collection est vide (elle se remplit depuis le Hub, ou Pile of Potential).</div>'}`;
}
function sheetWColl(id) {
  const x = E.get("wh:coll:" + id); if (!x) return;
  sheet(`<h2>📦 ${esc(x.name)}</h2><div class="muted small">${esc(x.project || x.faction || "")}</div>
    <div class="wphotos">${(x.photos || []).map((p) => `<span class="wph" data-eimg="${esc(p)}"><button class="wph-x" data-wphrm="${esc(p)}" data-id="${esc(id)}" aria-label="Retirer">✕</button></span>`).join("")}
      <label class="wph add" title="Prendre ou choisir une photo">📷<span class="small">Ajouter</span><input type="file" accept="image/*" multiple id="wc-file" data-id="${esc(id)}" hidden></label></div>
    <div class="card">${WHS.map(([k, n]) => `<div class="row wlive-k"><span class="wst-dot wst-${k}"></span><div class="grow">${n}</div><div class="wstep"><button class="btn" data-wcs="${k}" data-d="-1">−</button><b data-wcv="${k}">${x.counts?.[k] || 0}</b><button class="btn" data-wcs="${k}" data-d="1">＋</button></div></div>`).join("")}
      <div class="muted small">Une figurine passe à l'état suivant : − sur l'un, ＋ sur l'autre.</div></div>
    <h3>🎨 Recette de peinture</h3><textarea id="wc-r" rows="4">${esc(x.recipe || "")}</textarea><h3>Notes</h3><textarea id="wc-n" rows="2">${esc(x.notes || "")}</textarea>
    <div class="btns"><button class="btn" data-act="close">Annuler</button><button class="btn accent" data-wact="coll-save" data-id="${esc(id)}">Enregistrer</button></div>`);
}

/* ------------------------------------------------------------ 🖼 (v80) choisir une image : une de tes photos déjà là, ou une nouvelle */
function wAllPhotos() {
  const seen = new Set(), out = [];
  const add = (name, label) => { if (name && !seen.has(name) && (D.esp.flat["file:warhammer/photos/" + name] || D.espRO.files?.[name])) { seen.add(name); out.push({ name, label }); } };
  for (const x of E.list("wh:coll:").sort((a, b) => a.name.localeCompare(b.name))) for (const p of x.photos || []) add(p, x.name);
  for (const [k, v] of Object.entries(D.esp.flat)) if (k.startsWith("wh:uimg:") || k.startsWith("wh:art:")) add(v, k.startsWith("wh:art:list:") ? "image de liste" : k.startsWith("wh:art:") ? "faction" : "image d'unité");
  for (const k of Object.keys(D.espRO.files || {})) add(k, "");
  return out;
}
function sheetWPicker(kind, key, fac, id) {
  const ph = wAllPhotos(), cur = kind === "list" ? wArt("list:" + key) : wUimg(key);
  WHP.pick = { kind, key, fac, id };
  sheet(`<h2>🖼 ${kind === "list" ? "L'image de la liste" : "L'image de l'unité"}</h2>
    <label class="btn accent wpick-new">📷 Appareil photo ou galerie du téléphone<input type="file" accept="image/*" id="wp-file" hidden></label>
    <h3>Tes photos (collection, images déjà choisies)</h3>
    ${ph.length ? `<div class="wpick">${ph.map((x) => `<button class="wpick-i ${x.name === cur ? "on" : ""}" data-wpick="${esc(x.name)}" title="${esc(x.label)}"><span class="wph" data-eimg="${esc(x.name)}"></span><small>${esc(x.label)}</small></button>`).join("")}</div>`
      : '<div class="empty small">Pas encore de photo : prends-en une, ou ajoute-en dans 📦 Collection.</div>'}
    <div class="btns">${cur ? '<button class="btn danger" data-wact="pick-none">Retirer l\'image</button>' : ""}<button class="btn" data-act="close">Annuler</button></div>`);
}
function wPickDone(name) {
  const P = WHP.pick; if (!P) return;
  if (P.kind === "list") { E.set("wh:art:list:" + P.key, name || null); closeSheet(); }
  else { E.set("wh:uimg:" + P.key, name || null); sheetWSheet(P.fac, P.id); }
  toast(name ? "🖼 Image choisie" : "Image retirée");
}

TABS.wlists = viewWLists; TABS.wlive = viewWLive; TABS.wsheets = viewWSheets; TABS.wcoll = viewWColl;

/* ------------------------------------------------------------ les gestes */
document.addEventListener("input", (e) => {
  if (e.target.id === "ws-q") { WHP.q = e.target.value; const r = $("#ws-list"); if (r) { const pos = e.target.selectionStart; render(); const i = $("#ws-q"); i.focus(); i.setSelectionRange(pos, pos); } }
  if (e.target.id === "wa-q") { const L = wCurList(); if (L) $("#wa-res").innerHTML = wAddRows(wUnits(L.faction), e.target.value); }
});
document.addEventListener("change", async (e) => {
  const t = e.target;
  if ((t.id === "wc-file" || t.id === "wp-file") && t.files?.length) {
    if (!D.cfg.pass) return toast("Règle d'abord la synchro (⚙) : la photo est chiffrée avec ton mot de passe.", true);
    toast("📷 Photo…");
    try {
      if (t.id === "wc-file") {
        const x = E.get("wh:coll:" + t.dataset.id); if (!x) return;
        for (const f of t.files) x.photos = [...(x.photos || []), await espAddPhoto(f)].slice(-20);
        E.set("wh:coll:" + x.id, x); sheetWColl(x.id);
      } else wPickDone(await espAddPhoto(t.files[0], 1400));
      toast("📷 Ajoutée : elle part vers tes PC à la synchro");
    } catch (err) { toast("Photo illisible : " + err.message, true); }
    return;
  }
  if (e.target.id === "wu-v") { const o = e.target.selectedOptions[0]; $("#wu-c").value = o.dataset.cost; if (o.dataset.models) $("#wu-m").value = o.dataset.models; }
  if (e.target.id === "wv-no") { const lv = E.get("wh:live"); if (lv) E.set("wh:live", { ...lv, notes: e.target.value }); }
});
document.addEventListener("click", (e) => {
  const t = e.target;
  const wl = t.closest("[data-wlist]"); if (wl) { WHP.list = wl.dataset.wlist; window.scrollTo(0, 0); return render(); }
  const ws = t.closest("[data-wsheet]"); if (ws) return sheetWSheet(ws.dataset.fac, ws.dataset.wsheet);
  const wf = t.closest("[data-wfac]"); if (wf) { WHP.fac = wf.dataset.wfac; return render(); }
  const wc = t.closest("[data-wcoll]"); if (wc) return sheetWColl(wc.dataset.wcoll);
  const wu = t.closest("[data-wunit]"); if (wu) { const L = wCurList(); if (L) sheetWUnit(L, wu.dataset.wunit); return; }
  const wa = t.closest("[data-wadd]");
  if (wa) { const L = wCurList(), r = wUnits(L.faction).find((x) => x.id === wa.dataset.wadd), v0 = r.points?.variants?.[0];
    L.units.push({ uid: wid("l"), unit_id: r.id, name: r.name, variant: v0?.name || "", cost: v0?.cost || wPts(r), enh: "", enh_cost: 0, warlord: false, notes: "", models: v0?.models || (r.type === "model" ? 1 : 0) });
    wSaveList(L); closeSheet(); return toast(`＋ ${r.name}`); }
  const st = t.closest("[data-wst]"); if (st) { const b = $(`[data-wg="${st.dataset.i}"]`); b.textContent = Math.max(0, Math.min(50, +b.textContent + +st.dataset.wst)); return; }
  const pk = t.closest("[data-wpicker]"); if (pk) return sheetWPicker(pk.dataset.wpicker, pk.dataset.key, pk.dataset.fac, pk.dataset.id);
  const pi = t.closest("[data-wpick]"); if (pi) return wPickDone(pi.dataset.wpick);
  const rm = t.closest("[data-wphrm]");
  if (rm) { e.stopPropagation(); if (!confirm("Retirer cette photo (aussi sur tes PC) ?")) return; const x = E.get("wh:coll:" + rm.dataset.id); x.photos = (x.photos || []).filter((p) => p !== rm.dataset.wphrm); E.set("wh:coll:" + x.id, x); E.set("file:warhammer/photos/" + rm.dataset.wphrm, null); return sheetWColl(x.id); }
  const cs = t.closest("[data-wcs]"); if (cs) { const b = $(`[data-wcv="${cs.dataset.wcs}"]`); b.textContent = Math.max(0, Math.min(999, +b.textContent + +cs.dataset.d)); return; }
  const tn = t.closest("[data-wturn]"); if (tn) { const lv = E.get("wh:live"), n = +tn.dataset.wturn, rounds = [...lv.rounds]; while (rounds.length < n) rounds.push({ me: 0, opp: 0, cp_me: 0, cp_opp: 0 }); E.set("wh:live", { ...lv, turn: n, rounds }); return render(); }
  const lvb = t.closest("[data-wlv]");
  if (lvb) { const lv = E.get("wh:live"), rounds = lv.rounds.map((r) => ({ ...r })), r = rounds[lv.turn - 1]; r[lvb.dataset.wlv] = Math.max(0, Math.min(99, r[lvb.dataset.wlv] + +lvb.dataset.d)); E.set("wh:live", { ...lv, rounds }); navigator.vibrate?.(15); return render(); }
  const el = t.closest("[data-wact]"); if (!el) return;
  e.preventDefault();
  const a = el.dataset.wact, L = wCurList();
  if (a === "lists") { WHP.list = ""; return render(); }
  if (a === "pick-none") return wPickDone("");
  if (a === "list-new") return sheetWListEdit(null);
  if (a === "list-edit") return sheetWListEdit(L);
  if (a === "list-save") {
    const id = el.dataset.id || wid("L"), cur = E.get("wh:list:" + id) || { id, units: [] };
    const name = $("#wl-n").value.trim() || "Ma liste";
    E.set("wh:list:" + id, { ...cur, id, name, faction: $("#wl-f").value, detachment: $("#wl-d").value.trim(), target: +$("#wl-t").value, notes: $("#wl-no").value });
    WHP.list = id; closeSheet(); return toast("📋 Enregistrée");
  }
  if (a === "list-del") { if (!confirm(`Supprimer la liste « ${L.name} » (aussi sur tes PC) ?`)) return; E.set("wh:list:" + L.id, null); WHP.list = ""; closeSheet(); return toast("Liste supprimée"); }
  if (a === "unit-add") return sheetWAdd(L);
  if (a === "unit-save" || a === "unit-rm") {
    const i = L.units.findIndex((x) => x.uid === el.dataset.uid); if (i < 0) return;
    if (a === "unit-rm") { const [g] = L.units.splice(i, 1); L.units.forEach((x) => { if (x.attach === g.uid) delete x.attach; }); wSaveList(L); closeSheet(); return toast(`${g.name} retiré`); }
    const u = L.units[i], gear = {}; $$("[data-wg]").forEach((b) => { if (+b.textContent) gear[b.dataset.name] = +b.textContent; });
    Object.assign(u, { variant: $("#wu-v").value, models: +$("#wu-m").value || 0, cost: +$("#wu-c").value || 0, gear });
    if (!Object.keys(gear).length) delete u.gear; if (!u.models) delete u.models;
    if ($("#wu-lord")) { if ($("#wu-lord").checked) L.units.forEach((x) => (x.warlord = x.uid === u.uid)); else u.warlord = false; u.enh = $("#wu-e").value.trim(); u.enh_cost = +$("#wu-ec").value || 0; }
    if ($("#wu-a")) { if ($("#wu-a").value) u.attach = $("#wu-a").value; else delete u.attach; }
    wSaveList(L); closeSheet(); return toast("Enregistré");
  }
  if (a === "list-copy") { const txt = wExport(L); navigator.clipboard?.writeText(txt).then(() => toast("📋 Liste copiée"), () => toast("Copie impossible", true)); return; }
  if (a === "list-play") { E.set("wh:live", { opponent: "", faction: "", mission: "", points: L.target, list_id: L.id, rounds: [{ me: 0, opp: 0, cp_me: 0, cp_opp: 0 }], turn: 1, started: new Date().toISOString().slice(0, 10), notes: "" }); D.tab = "wlive"; save(); return render(); }
  if (a === "live-start") {
    E.set("wh:live", { opponent: $("#wv-o").value.trim().slice(0, 60), faction: $("#wv-f").value.trim().slice(0, 60), mission: $("#wv-mi").value.trim().slice(0, 80), points: +$("#wv-p").value,
      list_id: $("#wv-l").value, rounds: [{ me: 0, opp: 0, cp_me: 0, cp_opp: 0 }], turn: 1, started: new Date().toISOString().slice(0, 10), notes: "" });
    return render();
  }
  if (a === "live-cancel") { if (confirm("Abandonner la partie en cours (sans l'enregistrer) ?")) { E.set("wh:live", null); render(); } return; }
  if (a === "live-end") {
    const lv = E.get("wh:live"), me = lv.rounds.reduce((s, r) => s + r.me, 0), op = lv.rounds.reduce((s, r) => s + r.opp, 0), res = me > op ? "V" : op > me ? "D" : "N";
    if (!confirm(`Terminer : ${me}-${op} (${{ V: "victoire", D: "défaite", N: "nul" }[res]}) ?`)) return;
    const id = wid("g");
    E.set("wh:game:" + id, { id, date: lv.started, opponent: lv.opponent, faction: lv.faction, mission: lv.mission, points: lv.points, list_id: lv.list_id, result: res, me, opp: op, mvp: "", notes: lv.notes || "", rounds: lv.rounds });
    E.set("wh:live", null); toast(`🏁 Partie enregistrée : ${me}-${op}`); return render();
  }
  if (a === "coll-save") {
    const x = E.get("wh:coll:" + el.dataset.id), counts = Object.fromEntries(WHS.map(([k]) => [k, +$(`[data-wcv="${k}"]`).textContent || 0]));
    const pt = (c) => (c?.peint || 0) + (c?.socle || 0), delta = pt(counts) - pt(x.counts);
    E.set("wh:coll:" + x.id, { ...x, counts, recipe: $("#wc-r").value, notes: $("#wc-n").value });
    if (delta) { const p = structuredClone(E.get("wh:paint") || { goal: 0, months: {} }), mo = new Date().toISOString().slice(0, 7); p.months = p.months || {}; p.months[mo] = Math.max(0, (p.months[mo] || 0) + delta); E.set("wh:paint", p); }
    closeSheet(); return toast(delta > 0 ? `🎨 +${delta} peinte(s) ce mois-ci` : "Enregistré");
  }
});
