/* =====================================================================
   ch.js — v76 : ♟ LES ÉCHECS DANS LA POCHE.
   📚 Apprendre : la bibliothèque d'ouvertures du Hub (présentation, ligne sur l'échiquier, positions clés,
      pièges, entraînement coup par coup), tes ouvertures épinglées et ta progression (synchronisées avec tes PC) ·
   ♟ Parties : tes parties Chess.com, lues directement depuis Chess.com (gardées sur le téléphone), rejouées ·
   📊 Stats : classements, résultats, couleurs, ouvertures · 🆚 Adversaires : tes bilans.
   L'échiquier, les pièces et les ouvertures sont les mêmes fichiers que dans le Hub (chess_gfx.js, chess_lib.js).
   ===================================================================== */

var S = { settings: { ch_theme: localStorage.getItem("sigo.ch.theme") || "green" } };       // (pour chess_gfx.js : le thème de l'échiquier)
SPACE_TABS.ch = [["chlearn", "📚", "Apprendre"], ["chgames", "♟", "Parties"], ["chstats", "📊", "Stats"], ["chopp", "🆚", "Adversaires"]];
delete TABS.chome;
const CCOM = () => localStorage.getItem("sigo.dev.cc") || "https://api.chess.com/pub";
const CH_DRAWS = new Set(["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"]);
const CHM = { an: {}, rev: null, games: null, stats: null, busy: false, err: "", gid: "", ply: 0, flip: null, tc: "all", n: 60, lib: "all", q: "", les: null, oq: "" };
const chUser = () => String(D.cfg.chUser || E.get("ch:cfg")?.user || "").toLowerCase();
const chLearn = () => E.get("ch:learn") || { pins: [], prog: {} };
const TCN = { rapid: "Rapide", blitz: "Blitz", bullet: "Bullet", daily: "Par jour" };
(() => { const [, l, d] = CH_THEMES[chTheme()]; document.documentElement.style.setProperty("--chl", l); document.documentElement.style.setProperty("--chd", d); })();

/* ------------------------------------------------------------ Chess.com (comme hub_parts/chess.py) */
function chOpeningName(url) {
  let slug = decodeURIComponent(String(url || "").replace(/\/$/, "").split("/").pop() || "");
  slug = slug.split(/(?:\.\.\.|-)\d+\./)[0];
  return slug.split("-").filter(Boolean).join(" ").trim() || "Inconnue";
}
function chFamily(name) {
  const ws = name.split(" "), END = new Set(["Defense", "Game", "Opening", "Gambit", "Attack", "System", "Countergambit", "Variation"]);
  for (let i = 0; i < ws.length; i++) if (END.has(ws[i])) return ws[i] !== "Variation" ? ws.slice(0, i + 1).join(" ") : ws.slice(0, i).join(" ");
  return ws.slice(0, 3).join(" ");
}
const chHead = (pgn, k) => (String(pgn || "").match(new RegExp(`\\[${k} "([^"]*)"\\]`)) || [])[1] || "";
const CH_SAN = /(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O(?:-O)?)[+#]?/g;
const chSans = (mt) => (String(mt || "").replace(/\{[^}]*\}|\([^)]*\)|\$\d+/g, " ").match(CH_SAN) || []);
function chCompact(g, me) {
  if ((g.rules || "chess") !== "chess") return null;
  const w = g.white || {}, b = g.black || {}, mine = me.toLowerCase();
  let color, my, op;
  if ((w.username || "").toLowerCase() === mine) [color, my, op] = ["w", w, b]; else if ((b.username || "").toLowerCase() === mine) [color, my, op] = ["b", b, w]; else return null;
  const r = my.result || "", res = r === "win" ? "W" : CH_DRAWS.has(r) ? "D" : "L", pgn = g.pgn || "", eco = g.eco || chHead(pgn, "ECOUrl"), name = eco ? chOpeningName(eco) : "Inconnue";
  const parts = pgn.trim().split(/\n\s*\n/), mt = parts.length > 1 ? parts.slice(1).join("\n").trim() : "", acc = g.accuracies || {};
  const s0 = g.initial_setup && !String(g.initial_setup).startsWith("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w") ? g.initial_setup : "";
  return { id: String(g.uuid || String(g.url || "").replace(/\D/g, "") || g.end_time), url: g.url || "", end: +g.end_time || 0, tc: String(g.time_control || ""), tclass: g.time_class || "",
    rated: g.rated !== false, color, rating: my.rating, res, how: (res === "W" ? op.result : r) || "", opp: { name: op.username || "?", rating: op.rating },
    eco: chHead(pgn, "ECO"), opening: name, family: chFamily(name), acc: acc[color === "w" ? "white" : "black"], oacc: acc[color === "w" ? "black" : "white"],
    moves: chSans(mt), fen0: s0 };
}
async function chGet(path) {
  let r; try { r = await fetch(CCOM() + path, { cache: "no-store" }); } catch (_) { throw new Error("Chess.com injoignable (réseau)."); }
  if (r.status === 404) throw new Error("Joueur introuvable sur Chess.com : vérifie ton pseudo.");
  if (r.status === 429) throw new Error("Chess.com demande de ralentir : réessaie dans une minute.");
  if (!r.ok) throw new Error("Chess.com a répondu " + r.status);
  return r.json();
}
const chCache = () => caches.open("sigo-chess");
async function chLoad() {
  if (CHM.games) return CHM.games;
  const all = [];
  try {
    const c = await chCache();
    for (const k of await c.keys()) { const p = new URL(k.url).pathname; const d = await (await c.match(k)).json(); if (p.startsWith("/m/")) all.push(...(d.games || [])); else if (p === "/stats") CHM.stats = d; else if (p === "/an") CHM.an = d; }
  } catch (_) {}
  const seen = new Set(); CHM.games = all.sort((a, b) => b.end - a.end).filter((g) => !seen.has(g.id) && seen.add(g.id));
  return CHM.games;
}
async function chSync(full) {
  const u = chUser(); if (!u || CHM.busy) return;
  CHM.busy = true; CHM.err = "";
  try {
    const c = await chCache(), meta = await (await c.match("/meta"))?.json().catch(() => null);
    if (meta && meta.user !== u) { for (const k of await c.keys()) if (new URL(k.url).pathname !== "/an") await c.delete(k); CHM.games = null; }
    CHM.stats = await chGet(`/player/${u}/stats`); await c.put("/stats", new Response(JSON.stringify(CHM.stats)));
    const arch = ((await chGet(`/player/${u}/games/archives`)).archives || []).map((a) => (a.match(/\/games\/(\d{4})\/(\d{2})$/) || []).slice(1).join("-")).filter(Boolean);
    const now = new Date(), cur = now.toISOString().slice(0, 7), prev = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().slice(0, 7);
    for (const ym of arch) {
      const old = await (await c.match("/m/" + ym))?.json().catch(() => null);
      if (old?.final && !full) continue;
      const d = await chGet(`/player/${u}/games/${ym.replace("-", "/")}`);
      await c.put("/m/" + ym, new Response(JSON.stringify({ games: (d.games || []).map((g) => chCompact(g, u)).filter(Boolean), final: ym !== cur && ym !== prev })));
    }
    await c.put("/meta", new Response(JSON.stringify({ user: u, at: Date.now() })));
    CHM.games = null; await chLoad(); D.chAt = Date.now(); save();
  } catch (e) { CHM.err = e.message; }
  finally { CHM.busy = false; }
  if (D.space === "ch" && $("#sheet-back").hidden) render();
}
const chNeed = () => {
  if (!chUser()) return false;
  if (!CHM.games) { chLoad().then(() => { if (D.space === "ch") render(); if (!D.chAt || Date.now() - D.chAt > 30 * 60000) chSync(); }); return true; }
  return false;
};
const syncAllCh0 = syncAll;
syncAll = async function () { const p = syncAllCh0(); if (chUser()) chSync(); return p; };
const chAskUser = () => `<div class="card setup"><h2>♟ Ton compte Chess.com</h2><p class="muted small">Tes parties sont lues directement sur Chess.com (publiques), puis gardées sur ce téléphone.</p>
  <input type="text" id="ch-user" placeholder="Ton pseudo Chess.com" autocapitalize="off" value="${esc(chUser())}"><button class="btn accent" data-chact="user" style="width:100%;margin-top:8px">Lire mes parties</button></div>`;
const chHeadState = () => `${CHM.busy ? '<div class="card small muted">⟳ Lecture de Chess.com…</div>' : ""}${CHM.err ? `<div class="card err small">⚠ ${esc(CHM.err)}</div>` : ""}`;

/* ------------------------------------------------------------ l'échiquier (tap pour jouer) */
const chRes = (r) => `<span class="res ${r === "W" ? "w" : r === "L" ? "l" : ""}">${r === "W" ? "V" : r === "L" ? "D" : "N"}</span>`;
function chFenAt(moves, n, fen0) {
  const c = fen0 ? new Chess(fen0) : new Chess(); let last = null;
  for (const m of moves.slice(0, n)) { try { last = c.move(m); } catch (_) { break; } }
  return { fen: c.fen(), last: last ? { from: last.from, to: last.to, san: last.san } : null, c };
}
const chNav = (k) => `<div class="ch-nav-m"><button class="btn" data-chnav="${k}:0">⏮</button><button class="btn" data-chnav="${k}:-1">◀</button><button class="btn" data-chnav="${k}:1">▶</button><button class="btn" data-chnav="${k}:end">⏭</button><button class="btn" data-chnav="${k}:flip">⇅</button></div>`;
const chMoveList = (moves, ply, k) => `<div class="ch-ml">${moves.map((m, i) => `${i % 2 === 0 ? `<i>${i / 2 + 1}.</i>` : ""}<button class="${i + 1 === ply ? "on" : ""}" data-chply="${k}:${i + 1}">${esc(m)}</button>`).join("")}</div>`;

/* ------------------------------------------------------------ 📚 Apprendre */
const clSans = (l) => String(l || "").replace(/\d+\.(\.\.)?\s*/g, "").trim().split(/\s+/).filter(Boolean);
function chProg(id) { const p = Object.entries(chLearn().prog || {}).filter(([k]) => k.startsWith(id + "|")).map(([, v]) => v); return { ok: p.reduce((a, x) => a + x.ok, 0), ko: p.reduce((a, x) => a + x.ko, 0), streak: Math.max(0, ...p.map((x) => x.streak || 0)) }; }
const chMine = (o) => (CHM.games || []).filter((g) => o.names.some((n) => g.opening.startsWith(n) || g.family === n));
function viewChLearn() {
  if (CHM.les) return viewChLesson();
  const pins = chLearn().pins || [], q = CHM.q && wFold(CHM.q);
  const list = CH_LIB.filter((o) => (CHM.lib === "all" || o.side === CHM.lib) && (!q || wFold(o.fr + " " + o.names.join(" ") + " " + o.eco).includes(q)));
  const card = (o) => { const p = chProg(o.id);
    return `<div class="row" data-chles="${o.id}"><span class="ch-side ${o.side}">${o.side === "w" ? "♔" : "♚"}</span><div class="grow"><div><b>${esc(o.fr)}</b> ${pins.includes(o.id) ? "📌" : ""}</div>
      <div class="muted small">${esc(o.eco)} · ${esc(clSans(o.line).slice(0, 4).join(" "))}…</div></div><div style="text-align:right">${p.ok + p.ko ? `<b class="w">${p.ok}</b><span class="muted">/${p.ok + p.ko}</span>${p.streak > 1 ? `<div class="small">🔥 ${p.streak}</div>` : ""}` : '<span class="muted small">à découvrir</span>'}</div></div>`; };
  return `${pins.length ? `<h2>📌 Épinglées</h2><div class="card">${pins.map((id) => CH_LIB.find((o) => o.id === id)).filter(Boolean).map(card).join("")}</div>` : ""}
    <h2>📚 Ouvertures</h2><div class="seg">${[["all", "Toutes"], ["w", "Avec les blancs"], ["b", "Avec les noirs"]].map(([k, n]) => `<button class="${CHM.lib === k ? "on" : ""}" data-chlib="${k}">${n}</button>`).join("")}</div>
    <input type="search" id="ch-q" placeholder="Chercher (sicilienne, Caro-Kann, B20…)" value="${esc(CHM.q)}" autocomplete="off">
    <div class="card" style="margin-top:8px">${list.map(card).join("") || '<div class="empty small">Rien.</div>'}</div>`;
}
function viewChLesson() {
  const L = CHM.les, o = CH_LIB.find((x) => x.id === L.id), pinned = (chLearn().pins || []).includes(o.id);
  const tabs = [["intro", "📖"], ["line", "♟ Ligne"], ["keys", "📍"], ["traps", "⚠"], ["drill", "🎯 S'entraîner"]];
  let body = "";
  if (L.tab === "intro") { const my = chMine(o), w = my.filter((g) => g.res === "W").length, d = my.filter((g) => g.res === "D").length;
    body = `<div class="card"><p>${esc(o.intro)}</p></div>${["w", "b"].map((s) => `<h3>${s === "w" ? "♔ Plans des blancs" : "♚ Plans des noirs"}</h3><div class="card"><ul class="ch-ul">${(o.plans?.[s] || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}
      ${my.length ? `<div class="card small">♟ Dans tes parties : <b>${my.length}</b> fois · ${wl(w, my.length - w - d)}${d ? ` · ${d} nulle(s)` : ""}</div>` : ""}`; }
  if (L.tab === "line") { const P = chFenAt(L.sans, L.ply), key = L.key === "main" ? (o.keys || []).find((k) => k.ply === L.ply) : null;
    body = `${L.key !== "main" ? `<div class="card small">⚠ ${esc(L.title)} <button class="chip-b" data-chline="main">Ligne principale</button></div>` : ""}
      ${chBoard(P.fen, { flip: L.flip, last: P.last, id: "chl-b" })}${chNav("les")}${key ? `<div class="card ch-key"><b>📍 ${esc(key.t)}</b><div class="small">${esc(key.x)}</div></div>` : L.key !== "main" && L.ply === L.sans.length ? `<div class="card small">${esc(L.note || "")}</div>` : ""}
      ${chMoveList(L.sans, L.ply, "les")}`; }
  if (L.tab === "keys") body = (o.keys || []).map((k) => { const P = chFenAt(clSans(o.line), k.ply); return `<div class="card ch-keyc" data-chkey="${k.ply}">${chBoard(P.fen, { flip: o.side === "b", last: P.last, mini: true })}<div><b>${esc(k.t)}</b><div class="small">${esc(k.x)}</div><div class="muted small">après ${Math.ceil(k.ply / 2)}. ${esc(clSans(o.line)[k.ply - 1])}</div></div></div>`; }).join("") || '<div class="empty">Pas de positions clés.</div>';
  if (L.tab === "traps") body = [...(o.traps || []).map((t, i) => ["trap", i, t]), ...(o.games || []).map((t, i) => ["game", i, t])].map(([k, i, t]) => `<div class="card"><b>${k === "trap" ? "⚠" : "🏆"} ${esc(t.t)}</b><div class="small">${esc(t.x)}</div><button class="btn" style="margin-top:8px" data-chline="${k}:${i}">▶ La voir sur l'échiquier</button></div>`).join("") || '<div class="empty">Pas de piège noté.</div>';
  if (L.tab === "drill") { const Dr = L.drill, P = chFenAt(L.dsans, Dr.i), mySide = o.side, done = Dr.i >= L.dsans.length;
    const tg = Dr.sel ? P.c.moves({ square: Dr.sel, verbose: true }).map((m) => m.to) : [];
    body = `<div class="card small">${done ? (Dr.err ? `✓ Ligne terminée avec ${Dr.err} erreur(s).` : "🎉 Sans faute !") : `Joue les coups des ${mySide === "w" ? "blancs" : "noirs"} : touche une pièce puis sa case. ${Dr.err ? `<b class="l">${Dr.err} erreur(s)</b>` : ""}`}</div>
      ${chBoard(P.fen, { flip: mySide === "b", last: P.last, sel: Dr.sel, targets: tg, hint: Dr.hint, id: "chd-b" })}
      <div class="btns">${done ? `<button class="btn accent" data-chact="drill-again">↻ Recommencer</button>` : `<button class="btn" data-chact="drill-hint">💡 Indice</button>`}</div>
      <div class="muted small" style="margin-top:8px">${esc(clSans(o.line).length)} demi-coups · réussites : ${chProg(o.id).ok} · série : ${chProg(o.id).streak}</div>`; }
  return `<button class="btn wback" data-chact="les-back">← Ouvertures</button><div class="lu-h"><h2 style="margin:0">${esc(o.fr)}</h2><button class="btn" data-chact="pin">${pinned ? "📌 Épinglée" : "📌 Épingler"}</button></div>
    <div class="muted small" style="margin:0 2px 8px">${esc(o.eco)} · ${o.side === "w" ? "avec les blancs" : "avec les noirs"}</div>
    <div class="chips">${tabs.map(([k, n]) => `<button class="chip-b ${L.tab === k ? "on" : ""}" data-chtab="${k}">${n}</button>`).join("")}</div>${body}`;
}
function chOpenLesson(id, tab) { const o = CH_LIB.find((x) => x.id === id); CHM.les = { id, tab: tab || "intro", sans: clSans(o.line), ply: 0, key: "main", flip: o.side === "b", dsans: clSans(o.line), drill: { i: 0, err: 0, sel: null, hint: null, miss: 0 } }; chDrillAuto(); }
function chDrillAuto() {                                      // les coups adverses se jouent seuls
  const L = CHM.les, o = CH_LIB.find((x) => x.id === L.id), Dr = L.drill;
  while (Dr.i < L.dsans.length && (Dr.i % 2 === 0 ? "w" : "b") !== o.side) Dr.i++;
  if (Dr.i >= L.dsans.length && !Dr.saved) {
    Dr.saved = true; const lr = chLearn(), k = `${o.id}|main`, p = lr.prog?.[k] || { ok: 0, ko: 0, streak: 0 }, ok = !Dr.err;
    lr.prog = { ...(lr.prog || {}), [k]: { ...p, ok: p.ok + (ok ? 1 : 0), ko: p.ko + (ok ? 0 : 1), streak: ok ? (p.streak || 0) + 1 : 0, last: Math.floor(Date.now() / 1000) } }; lr.pins = lr.pins || [];
    E.set("ch:learn", lr);
  }
}

/* ------------------------------------------------------------ ♟ Parties */
const chFiltered = () => (CHM.games || []).filter((g) => CHM.tc === "all" || g.tclass === CHM.tc);
function viewChGames() {
  if (!chUser()) return chAskUser();
  if (chNeed()) return '<div class="empty">Tes parties…</div>';
  if (CHM.gid) return viewChGame();
  const gs = chFiltered(), tcs = [...new Set((CHM.games || []).map((g) => g.tclass))];
  return `${chHeadState()}<div class="chips">${[["all", "Toutes"], ...tcs.map((t) => [t, TCN[t] || t])].map(([k, n]) => `<button class="chip-b ${CHM.tc === k ? "on" : ""}" data-chtc="${k}">${n}</button>`).join("")}</div>
    <div class="card">${gs.slice(0, CHM.n).map((g) => `<div class="row" data-chg="${esc(g.id)}">${chRes(g.res)}<div class="grow"><div><b>${esc(g.opp.name)}</b> <span class="muted small">${g.opp.rating || ""}</span> <span class="ch-dot ${g.color}"></span></div>
      <div class="muted small">${esc(g.opening)} · ${esc(TCN[g.tclass] || g.tclass)} · ${fmtDate(g.end)}</div></div><div style="text-align:right"><b>${g.rating || ""}</b>${chAn(g) ? `<div class="small">🔍 ${chAn(g).blunders ? `<span class="l">${chAn(g).blunders}??</span>` : "✓"}</div>` : g.acc ? `<div class="muted small">${Math.round(g.acc)} %</div>` : ""}</div></div>`).join("") || '<div class="empty small">Aucune partie.</div>'}</div>
    ${gs.length > CHM.n ? `<button class="btn" data-chact="more" style="width:100%">Plus de parties (${gs.length - CHM.n})</button>` : ""}`;
}
function viewChGame() {
  const g = (CHM.games || []).find((x) => x.id === CHM.gid); if (!g) { CHM.gid = ""; return viewChGames(); }
  if (CHM.flip == null) CHM.flip = g.color === "b";
  const P = chFenAt(g.moves, CHM.ply, g.fen0);
  return `<button class="btn wback" data-chact="games-back">← Parties</button>
    <div class="card ch-ghead">${chRes(g.res)}<div class="grow"><div><b>${esc(g.opp.name)}</b> (${g.opp.rating || "?"}) · toi ${g.rating || "?"}</div><div class="muted small">${esc(g.opening)} · ${esc(TCN[g.tclass] || g.tclass)} · ${esc(g.how)} · ${fmtDate(g.end)}</div>
      ${g.acc ? `<div class="small">Précision : <b>${Math.round(g.acc)} %</b>${g.oacc ? ` · lui ${Math.round(g.oacc)} %` : ""}</div>` : ""}</div></div>
    ${chBoard(P.fen, { flip: CHM.flip, last: P.last, id: "chg-b" })}${chNav("game")}<div class="muted small" style="text-align:center">${CHM.ply}/${g.moves.length}</div>
    ${chMoveList(g.moves, CHM.ply, "game")}${g.url ? `<a class="btn" style="display:block;text-align:center;margin-top:10px" href="${esc(g.url)}" target="_blank" rel="noopener">Ouvrir sur Chess.com ↗</a>` : ""}`;
}

/* ------------------------------------------------------------ 📊 Stats */
function chSpark(pts) {
  if (pts.length < 2) return "";
  const W = 320, H = 90, lo = Math.min(...pts), hi = Math.max(...pts), x = (i) => (i / (pts.length - 1)) * W, y = (v) => H - 6 - ((v - lo) / Math.max(1, hi - lo)) * (H - 12);
  return `<svg class="ch-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"/></svg><div class="muted small" style="display:flex;justify-content:space-between"><span>${lo}</span><span>${hi}</span></div>`;
}
const chScore = (gs) => gs.length ? Math.round((100 * (gs.filter((g) => g.res === "W").length + gs.filter((g) => g.res === "D").length / 2)) / gs.length) : 0;
function viewChStats() {
  if (!chUser()) return chAskUser();
  if (chNeed()) return '<div class="empty">Tes stats…</div>';
  const all = CHM.games || [], st = CHM.stats || {}, gs = chFiltered(), tcs = [...new Set(all.map((g) => g.tclass))];
  const kpi = (t) => { const s = st["chess_" + t]; return s ? `<div class="kpi"><b>${s.last?.rating ?? "–"}</b><span>${TCN[t] || t}${s.best?.rating ? ` · max ${s.best.rating}` : ""}</span></div>` : ""; };
  const recent = gs.filter((g) => g.end * 1000 > Date.now() - 30 * 864e5), fam = (c) => { const m = new Map(); for (const g of gs.filter((x) => x.color === c)) m.set(g.family, [...(m.get(g.family) || []), g]); return [...m].sort((a, b) => b[1].length - a[1].length).slice(0, 6); };
  const cnt = (l) => `${wl(l.filter((g) => g.res === "W").length, l.filter((g) => g.res === "L").length)} <span class="muted small">${l.filter((g) => g.res === "D").length} N</span>`;
  const curve = gs.filter((g) => g.rated && g.rating).slice(0, 200).reverse().map((g) => g.rating);
  return `${chHeadState()}<div class="kpis">${["rapid", "blitz", "bullet", "daily"].map(kpi).join("")}</div>
    <div class="chips">${[["all", "Toutes"], ...tcs.map((t) => [t, TCN[t] || t])].map(([k, n]) => `<button class="chip-b ${CHM.tc === k ? "on" : ""}" data-chtc="${k}">${n}</button>`).join("")}</div>
    ${CHM.tc !== "all" && curve.length > 1 ? `<div class="card"><h3>📈 Classement (${curve.length} parties)</h3>${chSpark(curve)}</div>` : ""}
    <div class="card"><div class="row" style="border:none"><div class="grow">Toutes (${gs.length})</div><div>${cnt(gs)} · <b>${chScore(gs)} %</b></div></div>
      <div class="row"><div class="grow">30 derniers jours (${recent.length})</div><div>${cnt(recent)} · <b>${chScore(recent)} %</b></div></div>
      ${["w", "b"].map((c) => { const l = gs.filter((g) => g.color === c); return `<div class="row"><div class="grow"><span class="ch-dot ${c}"></span> ${c === "w" ? "Blancs" : "Noirs"} (${l.length})</div><div>${cnt(l)} · <b>${chScore(l)} %</b></div></div>`; }).join("")}</div>
    ${["w", "b"].map((c) => `<h3>${c === "w" ? "♔ Tes ouvertures avec les blancs" : "♚ Avec les noirs"}</h3><div class="card">${fam(c).map(([n, l]) => `<div class="row"><div class="grow"><div>${esc(n)}</div><div class="bar"><span style="width:${chScore(l)}%"></span></div></div><div style="text-align:right"><b>${chScore(l)} %</b><div class="muted small">${l.length} parties</div></div></div>`).join("") || '<div class="empty small">—</div>'}</div>`).join("")}`;
}

/* ------------------------------------------------------------ 🆚 Adversaires */
function viewChOpp() {
  if (!chUser()) return chAskUser();
  if (chNeed()) return '<div class="empty">Tes adversaires…</div>';
  const m = new Map(); for (const g of chFiltered()) { const k = g.opp.name.toLowerCase(); m.set(k, [...(m.get(k) || []), g]); }
  const q = CHM.oq.toLowerCase(), rows = [...m.values()].filter((l) => !q || l[0].opp.name.toLowerCase().includes(q)).sort((a, b) => b.length - a.length || b[0].end - a[0].end);
  return `${chHeadState()}<input type="search" id="ch-oq" placeholder="Chercher un adversaire…" value="${esc(CHM.oq)}" autocomplete="off">
    <div class="muted small" style="margin:6px 2px">${m.size} adversaires · ${chFiltered().length} parties${CHM.tc !== "all" ? ` (${TCN[CHM.tc] || CHM.tc})` : ""}</div>
    <div class="card">${rows.slice(0, 120).map((l) => `<div class="row" data-chopp="${esc(l[0].opp.name)}"><div class="grow"><div><b>${esc(l[0].opp.name)}</b> <span class="muted small">${l[0].opp.rating || ""}</span></div><div class="muted small">${l.length} partie(s) · dernière ${fmtDate(l[0].end)}</div></div><div style="text-align:right">${wl(l.filter((g) => g.res === "W").length, l.filter((g) => g.res === "L").length)}<div class="muted small">${chScore(l)} %</div></div></div>`).join("") || '<div class="empty small">Aucun.</div>'}</div>`;
}
function sheetChOpp(name) {
  const l = (CHM.games || []).filter((g) => g.opp.name.toLowerCase() === name.toLowerCase());
  sheet(`<h2>🆚 ${esc(name)}</h2><div class="kpis"><div class="kpi"><b>${chScore(l)} %</b><span>score</span></div><div class="kpi"><b>${l.length}</b><span>parties</span></div><div class="kpi"><b>${l[0]?.opp.rating || "–"}</b><span>son classement</span></div></div>
    <div class="card">${l.map((g) => `<div class="row" data-chg="${esc(g.id)}">${chRes(g.res)}<div class="grow"><div>${esc(g.opening)} <span class="ch-dot ${g.color}"></span></div><div class="muted small">${esc(TCN[g.tclass] || g.tclass)} · ${fmtDate(g.end)} · ${esc(g.how)}</div></div>›</div>`).join("")}</div>
    <div class="btns"><button class="btn" data-act="close">Fermer</button></div>`);
}

TABS.chlearn = viewChLearn; TABS.chgames = viewChGames; TABS.chstats = viewChStats; TABS.chopp = viewChOpp;

/* ------------------------------------------------------------ les gestes */
document.addEventListener("input", (e) => {
  const keep = (id) => { const pos = e.target.selectionStart; render(); const i = $("#" + id); if (i) { i.focus(); i.setSelectionRange(pos, pos); } };
  if (e.target.id === "ch-q") { CHM.q = e.target.value; keep("ch-q"); }
  if (e.target.id === "ch-oq") { CHM.oq = e.target.value; keep("ch-oq"); }
});
function chTapSquare(sq) {
  const L = CHM.les, o = CH_LIB.find((x) => x.id === L.id), Dr = L.drill; if (Dr.i >= L.dsans.length) return;
  const P = chFenAt(L.dsans, Dr.i), pc = P.c.get(sq);
  if (Dr.sel && Dr.sel !== sq) {
    let mv = null; try { mv = P.c.move({ from: Dr.sel, to: sq, promotion: "q" }); } catch (_) {}
    if (mv) {
      if (mv.san.replace(/[+#]/g, "") === L.dsans[Dr.i].replace(/[+#]/g, "")) { Dr.i++; Dr.sel = null; Dr.hint = null; Dr.miss = 0; navigator.vibrate?.(10); render(); setTimeout(() => { chDrillAuto(); render(); }, 350); return; }
      Dr.err++; Dr.miss++; Dr.sel = null; if (Dr.miss >= 2) Dr.hint = chFenAt(L.dsans, Dr.i + 1).last?.from || null; navigator.vibrate?.([30, 40, 30]); render(); $("#chd-b")?.classList.add("shake"); return;
    }
  }
  Dr.sel = pc && pc.color === o.side ? sq : null; render();
}
document.addEventListener("click", (e) => {
  const t = e.target;
  const sq = t.closest("#chd-b [data-sq]"); if (sq && CHM.les?.tab === "drill") return chTapSquare(sq.dataset.sq);
  const rq = t.closest("#chr-b [data-sq]"); if (rq && CHM.rev) return chRevTap(rq.dataset.sq);
  const les = t.closest("[data-chles]"); if (les) { chOpenLesson(les.dataset.chles); window.scrollTo(0, 0); return render(); }
  const tab = t.closest("[data-chtab]"); if (tab) { CHM.les.tab = tab.dataset.chtab; if (tab.dataset.chtab === "drill") { CHM.les.drill = { i: 0, err: 0, sel: null, hint: null, miss: 0 }; chDrillAuto(); } return render(); }
  const key = t.closest("[data-chkey]"); if (key) { Object.assign(CHM.les, { tab: "line", key: "main", sans: clSans(CH_LIB.find((x) => x.id === CHM.les.id).line), ply: +key.dataset.chkey }); return render(); }
  const ln = t.closest("[data-chline]");
  if (ln) { const o = CH_LIB.find((x) => x.id === CHM.les.id), v = ln.dataset.chline;
    if (v === "main") Object.assign(CHM.les, { key: "main", sans: clSans(o.line), ply: 0, title: "", note: "" });
    else { const [k, i] = v.split(":"), x = (k === "trap" ? o.traps : o.games)[+i]; Object.assign(CHM.les, { key: v, sans: clSans(x.line), ply: 0, title: x.t, note: x.x }); }
    CHM.les.tab = "line"; return render(); }
  const nv = t.closest("[data-chnav]");
  if (nv) { const [k, a] = nv.dataset.chnav.split(":"), st = k === "les" ? CHM.les : null, g = k === "game" ? (CHM.games || []).find((x) => x.id === CHM.gid) : null, max = st ? st.sans.length : g.moves.length;
    let ply = st ? st.ply : CHM.ply;
    if (a === "flip") { if (st) st.flip = !st.flip; else CHM.flip = !CHM.flip; return render(); }
    ply = a === "0" ? 0 : a === "end" ? max : Math.max(0, Math.min(max, ply + +a));
    if (st) st.ply = ply; else CHM.ply = ply; return render(); }
  const pl = t.closest("[data-chply]"); if (pl) { const [k, n] = pl.dataset.chply.split(":"); if (k === "les") CHM.les.ply = +n; else CHM.ply = +n; return render(); }
  const lib = t.closest("[data-chlib]"); if (lib) { CHM.lib = lib.dataset.chlib; return render(); }
  const tc = t.closest("[data-chtc]"); if (tc) { CHM.tc = tc.dataset.chtc; CHM.n = 60; return render(); }
  const g = t.closest("[data-chg]"); if (g) { CHM.gid = g.dataset.chg; CHM.ply = 0; CHM.flip = null; if (!$("#sheet-back").hidden) { $("#sheet-back").hidden = true; } D.tab = "chgames"; save(); window.scrollTo(0, 0); return render(); }
  const op = t.closest("[data-chopp]"); if (op) return sheetChOpp(op.dataset.chopp);
  const el = t.closest("[data-chact]"); if (!el) return;
  e.preventDefault();
  const a = el.dataset.chact;
  if (a === "user") { const u = $("#ch-user").value.trim().replace(/^.*\//, "").toLowerCase(); if (!/^[a-z0-9_-]{3,25}$/.test(u)) return toast("Ton pseudo Chess.com ?", true); D.cfg.chUser = u; save(); CHM.games = null; render(); return chSync(); }
  if (a === "les-back") { CHM.les = null; return render(); }
  if (a === "rev") { chRevStart(); window.scrollTo(0, 0); return render(); }
  if (a === "rev-end") { CHM.rev = null; return render(); }
  if (a === "rev-next") { const R = CHM.rev; R.i++; R.state = "ask"; R.sel = null; R.played = null; return render(); }
  if (a === "rev-show") { const R = CHM.rev, c = R.q[R.i]; R.state = "ko"; chRepResult(c, false); return render(); }
  if (a === "games-back") { CHM.gid = ""; return render(); }
  if (a === "more") { CHM.n += 60; return render(); }
  if (a === "pin") { const lr = chLearn(), id = CHM.les.id, pins = (lr.pins || []).filter((x) => x !== id); if (!(lr.pins || []).includes(id)) pins.push(id); E.set("ch:learn", { ...lr, pins: pins.slice(-12), prog: lr.prog || {} }); return render(); }
  if (a === "drill-again") { CHM.les.drill = { i: 0, err: 0, sel: null, hint: null, miss: 0 }; chDrillAuto(); return render(); }
  if (a === "drill-hint") { const L = CHM.les; L.drill.hint = chFenAt(L.dsans, L.drill.i + 1).last?.from || null; return render(); }
});


/* ============================================================ v79 : 🔍 les analyses Stockfish du Hub, 🎓 la révision du répertoire */
const chWp = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
/** (appelé par la synchro des espaces) les analyses faites sur tes PC : gardées dans le cache, en lecture seule */
async function chAnStore(an) {
  if (same(an, CHM.an)) return;
  CHM.an = an; try { await (await chCache()).put("/an", new Response(JSON.stringify(an))); } catch (_) {}
}
const chAn = (g) => CHM.an?.[g.id];
function chGraph(ev, ply, cls, color, firstColor) {
  const W = 600, H = 110, n = ev.length, x = (i) => (i / Math.max(1, n - 1)) * W, y = (cp) => H - (chWp(cp) / 100) * H;
  const d = ev.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const kc = { "??": "b", "?": "m", "?!": "i" };
  const dots = (cls || []).map((k, i) => kc[k] ? { k, i: i + 1, mine: ((i % 2 === 0) ? firstColor : firstColor === "w" ? "b" : "w") === color } : null).filter((o) => o && o.k !== "?!");
  return `<div class="ch-gwrap"><svg class="ch-graph" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d}L${W},${H}L0,${H}Z" class="wa"/><path d="${d}" class="ln"/>
      <line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" class="mid"/><line x1="${x(ply)}" x2="${x(ply)}" y1="0" y2="${H}" class="cur"/></svg>
    ${dots.map((o) => `<button class="ch-gdot ${kc[o.k]} ${o.mine ? "me" : ""}" data-chply="game:${o.i}" style="left:${(100 * o.i / Math.max(1, n - 1)).toFixed(2)}%;top:${(100 * y(ev[o.i]) / H).toFixed(2)}%"></button>`).join("")}</div>`;
}
/** la partie avec son analyse : barre d'évaluation, courbe, ?? / ? sur la pièce, la flèche du meilleur coup */
function chGameAnalysis(g, P) {
  const a = chAn(g); if (!a?.evals?.length) return null;
  const ply = CHM.ply, k = a.cls?.[ply - 1], nk = a.cls?.[ply], bsan = (nk === "??" || nk === "?") ? a.best?.[ply] : null;
  let arrow = null; if (bsan) { try { const c = new Chess(P.fen); const m = c.move(bsan); arrow = { from: m.from, to: m.to, kind: "best" }; } catch (_) {} }
  const first = (g.fen0 || "").split(" ")[1] === "b" ? "b" : "w", whoNext = ((ply % 2 === 0) ? first : first === "w" ? "b" : "w") === g.color ? "tu as joué" : "il a joué";
  return { board: `<div class="ch-bw">${chEvalBar(a.evals[ply] ?? 0, CHM.flip)}${chBoard(P.fen, { flip: CHM.flip, last: P.last, id: "chg-b", arrows: arrow ? [arrow] : null, badge: k && P.last ? { sq: P.last.to, k } : null })}</div>`,
    graph: chGraph(a.evals, ply, a.cls, g.color, first),
    sum: `<div class="ch-ansum"><span class="b">?? ${a.blunders || 0}</span><span class="m">? ${a.mistakes || 0}</span><span class="i">?! ${a.inacc || 0}</span>${a.acc != null ? `<span>🎯 ${a.acc} %</span>` : ""}${a.swing ? "<span>⚠ gagnante ratée</span>" : ""}</div>`,
    tip: bsan ? `<div class="card ch-tip small">Au coup suivant, ${whoNext} <b>${esc(g.moves[ply])}</b> ${esc(nk)} — Stockfish préférait <b>${esc(bsan)}</b> (flèche verte).</div>` : "" };
}

/* ------------------------------------------------------------ 🎓 le répertoire (comme le Hub : tes 8 premiers coups) */
const REP_PLIES = 16, REP_DAYS = [0, 1, 3, 7, 21, 60];
function chRepCards() {
  const nodes = new Map();
  for (const g of CHM.games || []) {
    if (g.fen0) continue;
    const mv = g.moves, a = chAn(g) || {}, me = g.color, cls = a.cls || [], best = a.best || {};
    for (let i = me === "w" ? 0 : 1; i < Math.min(mv.length, REP_PLIES); i += 2) {
      const id = `${me}:${mv.slice(0, i).join(" ")}`;
      const n = nodes.get(id) || { id, c: me, line: mv.slice(0, i), n: 0, moves: {}, best: "", last: 0 }; nodes.set(id, n);
      n.n++; n.last = Math.max(n.last, g.end || 0);
      const m = n.moves[mv[i]] ||= { san: mv[i], n: 0, w: 0, d: 0, l: 0, err: 0 };
      m.n++; m[{ W: "w", D: "d" }[g.res] || "l"]++;
      if (cls[i] === "??" || cls[i] === "?") { m.err++; if (best[i]) n.best = best[i]; }
    }
  }
  const now = Date.now() / 1000, out = [];
  for (const n of nodes.values()) {
    const moves = Object.values(n.moves).sort((a, b) => b.n - a.n || a.san.localeCompare(b.san));
    if (n.n < 2 && !n.best) continue;
    const good = moves.filter((m) => !m.err), r = E.get("ch:rep:" + n.id) || {};
    out.push({ ...n, moves, exp: n.best || (good[0] || moves[0]).san, src: n.best ? "stockfish" : "habitude", weak: moves.reduce((a, m) => a + m.err, 0),
      box: +r.box || 0, due: +r.due || 0, ok: +r.ok || 0, ko: +r.ko || 0, isDue: (+r.due || 0) <= now });
  }
  return out.sort((a, b) => b.weak - a.weak || b.n - a.n || a.line.length - b.line.length).slice(0, 240);
}
function chRepResult(card, ok) {
  const r = E.get("ch:rep:" + card.id) || { box: 0, ok: 0, ko: 0 };
  if (ok) { r.box = Math.min(REP_DAYS.length - 1, (+r.box || 0) + 1); r.ok = (+r.ok || 0) + 1; r.due = Date.now() / 1000 + REP_DAYS[r.box] * 86400; }
  else { r.box = 0; r.ko = (+r.ko || 0) + 1; r.due = Date.now() / 1000 + 600; }
  E.set("ch:rep:" + card.id, r);
}
function chRepBanner() {
  if (!chUser() || !CHM.games) return "";
  const cards = chRepCards(), due = cards.filter((c) => c.isDue);
  if (!cards.length) return "";
  return `<div class="card ch-rep-b" data-chact="rev"><div class="row" style="border:none;padding:0"><span class="ch-rep-i">🎓</span><div class="grow"><div><b>Ton répertoire</b></div>
    <div class="muted small">${due.length ? `<b class="accent">${due.length}</b> position(s) à revoir aujourd'hui` : "À jour : rien à revoir aujourd'hui"} · ${cards.length} positions tirées de tes parties</div></div>${due.length ? '<span class="btn accent">▶ Réviser</span>' : "›"}</div></div>`;
}
function chRevStart() {
  const cards = chRepCards(), due = cards.filter((c) => c.isDue);
  CHM.rev = { q: (due.length ? due : cards.slice().sort((a, b) => a.due - b.due)).slice(0, 15), i: 0, okN: 0, sel: null, state: "ask", played: null };
}
function viewChRev() {
  const R = CHM.rev, c = R.q[R.i];
  if (!c) return `<button class="btn wback" data-chact="rev-end">← Apprendre</button><div class="card setup"><h2>🎓 Séance terminée</h2><p><b>${R.okN}</b> / ${R.q.length} sans faute.</p>
    <p class="muted small">Les positions réussies reviendront dans quelques jours (1, 3, 7, 21 puis 60 jours) ; les ratées reviennent dans 10 minutes.</p><button class="btn accent" data-chact="rev-end" style="width:100%">Terminer</button></div>`;
  const P = chFenAt(c.line, c.line.length), tg = R.sel && R.state === "ask" ? P.c.moves({ square: R.sel, verbose: true }).map((m) => m.to) : [];
  let arrows = null, ex = null;
  if (R.state !== "ask") { try { const x = new Chess(P.fen); const m = x.move(c.exp); ex = m; arrows = [{ from: m.from, to: m.to, kind: "best" }]; if (R.played && R.state === "ko") arrows.push({ from: R.played.from, to: R.played.to, kind: "bad" }); } catch (_) {} }
  const tot = c.moves.reduce((a, m) => a + m.n, 0);
  return `<div class="lu-h"><button class="btn wback" data-chact="rev-end" style="margin:0">✕</button><div class="muted small">${R.i + 1} / ${R.q.length}</div></div>
    <div class="bar"><span style="width:${(100 * R.i) / R.q.length}%"></span></div>
    <div class="card small">${c.line.length ? `Après <b>${esc(c.line.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ` : "") + m).join(" "))}</b>` : "Premier coup"}, avec les ${c.c === "w" ? "blancs" : "noirs"} : <b>ton coup ?</b>
      <div class="muted">${c.n} parties ici${c.weak ? ` · ⚠ ${c.weak} faute(s) déjà faite(s)` : ""}</div></div>
    ${chBoard(P.fen, { flip: c.c === "b", last: P.last, sel: R.sel, targets: tg, arrows, id: "chr-b" })}
    ${R.state === "ask" ? `<div class="btns"><button class="btn" data-chact="rev-show">👁 Voir la réponse</button></div>`
      : `<div class="card ${R.state === "ok" ? "ch-ok" : "ch-ko"}"><b>${R.state === "ok" ? "✓ Bien joué" : "✗ Pas tout à fait"}</b> — ${c.src === "stockfish" ? "Stockfish conseille" : "tu joues d'habitude"} <b>${esc(c.exp)}</b>.
        <div class="small muted" style="margin-top:4px">Tes coups ici : ${c.moves.slice(0, 4).map((m) => `${esc(m.san)} ${Math.round((100 * m.n) / tot)} % (${m.w}-${m.d}-${m.l})${m.err ? " ⚠" : ""}`).join(" · ")}</div></div>
        <button class="btn accent" data-chact="rev-next" style="width:100%">Suivante ›</button>`}`;
}
function chRevTap(sq) {
  const R = CHM.rev, c = R.q[R.i]; if (!c || R.state !== "ask") return;
  const P = chFenAt(c.line, c.line.length), pc = P.c.get(sq);
  if (R.sel && R.sel !== sq) {
    let mv = null; try { mv = P.c.move({ from: R.sel, to: sq, promotion: "q" }); } catch (_) {}
    if (mv) { const ok = mv.san.replace(/[+#]/g, "") === c.exp.replace(/[+#]/g, ""); R.state = ok ? "ok" : "ko"; R.played = mv; R.sel = null; if (ok) R.okN++; chRepResult(c, ok); navigator.vibrate?.(ok ? 15 : [30, 40, 30]); return render(); }
  }
  R.sel = pc && pc.color === c.c ? sq : null; render();
}
const viewChLearn0 = viewChLearn;
viewChLearn = function () { if (CHM.rev) return viewChRev(); if (!CHM.les && chUser() && !CHM.games) chNeed(); return (CHM.les ? "" : chRepBanner()) + viewChLearn0(); };
TABS.chlearn = viewChLearn;
const viewChGame0 = viewChGame;
viewChGame = function () {
  const g = (CHM.games || []).find((x) => x.id === CHM.gid); if (!g) return viewChGame0();
  if (CHM.flip == null) CHM.flip = g.color === "b";
  const P = chFenAt(g.moves, CHM.ply, g.fen0), A = chGameAnalysis(g, P);
  if (!A) return viewChGame0().replace("</a>", "</a>") + '<div class="muted small" style="text-align:center;margin-top:8px">Pas encore analysée : dans le Hub, ♟ → la partie → 🔍 Analyser (ou l\'analyse en lot) ; elle arrive ici à la synchro.</div>';
  const html = viewChGame0(), i = html.indexOf('<div class="ch-board'), j = html.indexOf(chNav("game"));
  const ml = chMoveList(g.moves, CHM.ply, "game").replace(/<button class="([^"]*)" data-chply="game:(\d+)">/g, (m, cls, n) => { const k = chAn(g).cls?.[n - 1]; return `<button class="${cls} ${k === "??" ? "kb" : k === "?" ? "km" : k === "?!" ? "ki" : ""}" data-chply="game:${n}">`; });
  return html.slice(0, i) + A.sum + A.board + html.slice(j).replace(chMoveList(g.moves, CHM.ply, "game"), A.tip + A.graph + ml);
};

/* (le premier affichage d'app.js a eu lieu avant les espaces : on réaffiche avec tout chargé) */
render();
