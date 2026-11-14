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
const CHM = { games: null, stats: null, busy: false, err: "", gid: "", ply: 0, flip: null, tc: "all", n: 60, lib: "all", q: "", les: null, oq: "" };
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
    for (const k of await c.keys()) { const p = new URL(k.url).pathname; const d = await (await c.match(k)).json(); if (p.startsWith("/m/")) all.push(...(d.games || [])); else if (p === "/stats") CHM.stats = d; }
  } catch (_) {}
  const seen = new Set(); CHM.games = all.sort((a, b) => b.end - a.end).filter((g) => !seen.has(g.id) && seen.add(g.id));
  return CHM.games;
}
async function chSync(full) {
  const u = chUser(); if (!u || CHM.busy) return;
  CHM.busy = true; CHM.err = "";
  try {
    const c = await chCache(), meta = await (await c.match("/meta"))?.json().catch(() => null);
    if (meta && meta.user !== u) { for (const k of await c.keys()) await c.delete(k); CHM.games = null; }
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
      <div class="muted small">${esc(g.opening)} · ${esc(TCN[g.tclass] || g.tclass)} · ${fmtDate(g.end)}</div></div><div style="text-align:right"><b>${g.rating || ""}</b>${g.acc ? `<div class="muted small">${Math.round(g.acc)} %</div>` : ""}</div></div>`).join("") || '<div class="empty small">Aucune partie.</div>'}</div>
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
  if (a === "games-back") { CHM.gid = ""; return render(); }
  if (a === "more") { CHM.n += 60; return render(); }
  if (a === "pin") { const lr = chLearn(), id = CHM.les.id, pins = (lr.pins || []).filter((x) => x !== id); if (!(lr.pins || []).includes(id)) pins.push(id); E.set("ch:learn", { ...lr, pins: pins.slice(-12), prog: lr.prog || {} }); return render(); }
  if (a === "drill-again") { CHM.les.drill = { i: 0, err: 0, sel: null, hint: null, miss: 0 }; chDrillAuto(); return render(); }
  if (a === "drill-hint") { const L = CHM.les; L.drill.hint = chFenAt(L.dsans, L.drill.i + 1).last?.from || null; return render(); }
});

/* (le premier affichage d'app.js a eu lieu avant les espaces : on réaffiche avec tout chargé) */
render();
