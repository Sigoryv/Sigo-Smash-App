/* =====================================================================
   ch_li.js — v181 : ♟ LICHESS DANS LA POCHE (sans compte, sans clé : tout est lu directement chez Lichess).
   🌐 sous l'échiquier d'une partie : l'évaluation « cloud » (3 meilleurs coups) et, à 7 pièces ou moins, la table
      de finales (le résultat parfait) ;
   🧩 le problème du jour (dans 📚 Apprendre) : à résoudre en touchant les cases, l'adversaire répond seul ;
   📡 Direct : les grands tournois retransmis en ce moment, leurs rondes, les parties (pendules, position, coups).
   L'explorateur d'ouvertures reste sur le PC (il demande ton jeton Lichess, qui ne quitte jamais le PC).
   ===================================================================== */
const LI = () => localStorage.getItem("sigo.dev.li") || "https://lichess.org";
const LITB = () => localStorage.getItem("sigo.dev.litb") || "https://tablebase.lichess.ovh";
const CHL = { on: false, ev: new Map(), busy: new Set(), wait: 0, pz: null, pzErr: "", top: null, topErr: "", tour: null, round: null, gid: "", pgn: null, ply: null, flip: false, t: 0 };
M_ICO.chlive = "activity";

async function liGet(url, text) {
  if (Date.now() < CHL.wait) throw new Error("Lichess demande de patienter une minute.");
  const r = await fetch(url, { headers: { Accept: text ? "application/x-chess-pgn" : "application/json" } });
  if (r.status === 429) { CHL.wait = Date.now() + 60000; throw new Error("Lichess demande de patienter une minute."); }
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("Lichess a répondu " + r.status);
  return text ? r.text() : r.json();
}
const liPieces = (fen) => (fen.split(" ")[0].match(/[a-z]/gi) || []).length;
const liUciSan = (fen, uci) => { try { const c = new Chess(fen), m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || "q" }); return m.san; } catch (_) { return uci; } };
function liSans(fen, ucis, n) { const c = new Chess(fen), out = []; for (const u of ucis.slice(0, n)) { try { out.push(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || "q" }).san); } catch (_) { break; } } return out; }

/* ------------------------------------------------------------ 🌐 l'évaluation d'une position */
async function liEval(fen) {
  if (CHL.ev.has(fen) || CHL.busy.has(fen)) return;
  CHL.busy.add(fen); let res;
  try {
    if (liPieces(fen) <= 7) {
      const t = await liGet(`${LITB()}/standard?fen=${encodeURIComponent(fen)}`);
      res = t ? { tb: t } : { none: true };
    } else {
      const c = await liGet(`${LI()}/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=3`);
      res = c?.pvs ? { cloud: c } : { none: true };
    }
  } catch (e) { res = { err: String(e.message || e) }; }
  CHL.busy.delete(fen); CHL.ev.set(fen, res); if (CHL.ev.size > 300) CHL.ev.delete(CHL.ev.keys().next().value);
  render();
}
const liFmt = (pv) => pv.mate != null ? `#${pv.mate}` : `${pv.cp >= 0 ? "+" : ""}${(pv.cp / 100).toFixed(1)}`;
const TBC = { win: ["gagnant", "w"], "syzygy-win": ["gagnant", "w"], "maybe-win": ["gagnant ?", "w"], "cursed-win": ["gain (50 coups)", "d"], draw: ["nulle", "d"], "blessed-loss": ["perte (50 coups)", "d"], "maybe-loss": ["perdant ?", "l"], "syzygy-loss": ["perdant", "l"], loss: ["perdant", "l"], unknown: ["?", ""] };
function liCard(fen) {
  if (!CHL.on) return `<button class="btn li-open" data-liact="on" style="width:100%;margin-top:8px">🌐 Évaluer avec Lichess</button>`;
  const r = CHL.ev.get(fen); if (!r) liEval(fen);
  const side = fen.split(" ")[1] === "w" ? "Blancs" : "Noirs";
  let body = '<div class="muted small">⟳ Lecture chez Lichess…</div>';
  if (r?.err) body = `<div class="err small">⚠ ${esc(r.err)}</div>`;
  else if (r?.none) body = '<div class="muted small">Position pas encore évaluée dans le cloud de Lichess (l\'analyse complète se fait sur le PC).</div>';
  else if (r?.cloud) body = `<div class="muted small">Profondeur ${r.cloud.depth} · évaluation pour les Blancs</div>` + r.cloud.pvs.map((pv) => { const sans = liSans(fen, pv.moves.split(" "), 6);
      return `<div class="li-pv"><b class="li-ev ${pv.mate != null ? (pv.mate > 0 ? "w" : "l") : pv.cp > 50 ? "w" : pv.cp < -50 ? "l" : ""}">${liFmt(pv)}</b><span>${esc(sans.join(" "))}</span></div>`; }).join("");
  else if (r?.tb) { const t = r.tb, [lab, k] = TBC[t.category] || TBC.unknown;
    body = `<div class="li-tb"><b class="li-ev ${k}">${esc(side)} : ${esc(lab)}</b>${t.dtm != null ? ` <span class="muted small">mat en ${Math.abs(t.dtm)} demi-coups</span>` : t.dtz != null && t.category !== "draw" ? ` <span class="muted small">DTZ ${Math.abs(t.dtz)}</span>` : ""}</div>`
      + (t.moves || []).slice(0, 4).map((m) => { const [l, kk] = TBC[m.category] ? [{ loss: "gagne", "syzygy-loss": "gagne", "maybe-loss": "gagne ?", win: "perd", "syzygy-win": "perd", "maybe-win": "perd ?", draw: "nulle" }[m.category] || "", { loss: "w", "syzygy-loss": "w", win: "l", "syzygy-win": "l" }[m.category] || "d"] : ["", ""];
        return `<div class="li-pv"><b class="li-ev ${kk}">${esc(l)}</b><span>${esc(m.san)}</span></div>`; }).join("")
      + '<div class="muted small">Table de finales : le résultat parfait, sans calcul.</div>'; }
  return `<div class="card li-card"><div class="lu-h"><b>🌐 Lichess</b><button class="btn" data-liact="off" title="Fermer">✕</button></div>${body}</div>`;
}
// sous l'échiquier d'une de tes parties
const viewChGameL0 = viewChGame;
viewChGame = function () {
  const html = viewChGameL0(), g = (CHM.games || []).find((x) => x.id === CHM.gid); if (!g) return html;
  const fen = chFenAt(g.moves, CHM.ply, g.fen0).fen, i = html.indexOf('<div class="ch-ml">');
  return i < 0 ? html + liCard(fen) : html.slice(0, i) + liCard(fen) + html.slice(i);
};

/* ------------------------------------------------------------ 🧩 le problème du jour */
async function liPuzzleLoad(force) {
  if (CHL.pzBusy) return; CHL.pzBusy = true;
  const day = new Date().toISOString().slice(0, 10), key = "sigo.ch.pz";
  if (!force) { try { const c = JSON.parse(localStorage.getItem(key) || "null"); if (c?.day === day) { CHL.pz = c.pz; CHL.pzBusy = false; queueMicrotask(render); return; } } catch (_) {} }
  try {
    const d = await liGet(`${LI()}/api/puzzle/daily`);
    const sans = String(d.game.pgn || "").split(/\s+/).filter(Boolean), c = new Chess();
    let last = null; for (const s of sans.slice(0, d.puzzle.initialPly + 1)) last = c.move(s);
    const prev = await liKeep();
    CHL.pz = { id: d.puzzle.id, rating: d.puzzle.rating, themes: d.puzzle.themes || [], fen: c.fen(), last: last ? { from: last.from, to: last.to } : null, sol: d.puzzle.solution, side: c.turn(), i: 0, sel: null, err: 0, done: prev?.id === d.puzzle.id ? prev.done : false };
    CHL.pzErr = ""; localStorage.setItem(key, JSON.stringify({ day, pz: CHL.pz }));
  } catch (e) { CHL.pzErr = String(e.message || e); }
  CHL.pzBusy = false; render();
}
const liKeep = async () => { try { return JSON.parse(localStorage.getItem("sigo.ch.pz") || "null")?.pz; } catch (_) { return null; } };
function liPzPos() {
  const P = CHL.pz, c = new Chess(P.fen); let last = P.last;
  for (const u of P.sol.slice(0, P.i)) { const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || "q" }); last = { from: m.from, to: m.to }; }
  return { c, last };
}
function liPuzzleCard() {
  if (!CHL.pz && !CHL.pzErr) { liPuzzleLoad(); return `<div class="card li-pz"><b>🧩 Problème du jour</b><div class="muted small">⟳ Lichess…</div></div>`; }
  if (!CHL.pz) return `<div class="card li-pz"><b>🧩 Problème du jour</b><div class="err small">⚠ ${esc(CHL.pzErr)}</div><button class="btn" data-liact="pz-reload">⟳</button></div>`;
  const P = CHL.pz, { c, last } = liPzPos(), solved = P.i >= P.sol.length;
  const targets = P.sel ? c.moves({ square: P.sel, verbose: true }).map((m) => m.to) : [];
  const msg = solved ? `<b class="li-ok">✓ Résolu${P.err ? ` (${P.err} erreur${P.err > 1 ? "s" : ""})` : " du premier coup !"}</b>`
    : P.bad ? '<b class="li-ko">✗ Pas ça. Réessaie.</b>' : `<span>${P.side === "w" ? "⚪ Les Blancs" : "⚫ Les Noirs"} jouent et gagnent.</span>`;
  return `<div class="card li-pz"><div class="lu-h"><b>🧩 Problème du jour</b><span class="muted small">Lichess · ${P.rating}</span></div>
    ${chBoard(c.fen(), { flip: P.side === "b", last, sel: P.sel, targets, hint: P.hint || null, id: "lipz-b" })}
    <div class="li-pz-m">${msg}</div>
    <div class="btns">${solved ? `<a class="btn" href="${esc(LI())}/training/${esc(P.id)}" target="_blank" rel="noopener">Voir sur Lichess ↗</a>` : `<button class="btn" data-liact="pz-hint">💡 Indice</button><button class="btn" data-liact="pz-show">👁 Solution</button>`}</div>
    ${P.themes.length ? `<div class="muted small">${P.themes.slice(0, 4).map(esc).join(" · ")}</div>` : ""}</div>`;
}
function liPzTap(sq) {
  const P = CHL.pz; if (!P || P.i >= P.sol.length) return;
  const { c } = liPzPos(), pc = c.get(sq);
  if (P.sel && P.sel !== sq) {
    let mv = null; try { mv = c.move({ from: P.sel, to: sq, promotion: "q" }); } catch (_) {}
    if (mv) {
      const want = P.sol[P.i], ok = mv.from + mv.to === want.slice(0, 4) || c.isCheckmate();
      P.sel = null; P.hint = null;
      if (ok) { P.i++; P.bad = false; navigator.vibrate?.(10); if (P.i >= P.sol.length) P.done = true; liPzSave(); render(); if (P.i < P.sol.length) setTimeout(() => { P.i++; if (P.i >= P.sol.length) P.done = true; liPzSave(); render(); }, 400); return; }
      P.err++; P.bad = true; navigator.vibrate?.([30, 40, 30]); liPzSave(); render(); $("#lipz-b")?.classList.add("shake"); return;
    }
  }
  P.sel = pc && pc.color === P.side ? sq : null; render();
}
const liPzSave = () => { try { const c = JSON.parse(localStorage.getItem("sigo.ch.pz") || "null"); if (c) localStorage.setItem("sigo.ch.pz", JSON.stringify({ ...c, pz: CHL.pz })); } catch (_) {} };
const viewChLearnL0 = viewChLearn;
viewChLearn = function () { const h = viewChLearnL0(); return CHM.les || CHM.rev ? h : liPuzzleCard() + h; };
TABS.chlearn = viewChLearn;

/* ------------------------------------------------------------ 📡 les tournois en direct */
async function liTop(force) {
  if (CHL.topBusy || (CHL.top && !force && Date.now() - CHL.t < 60000)) return; CHL.topBusy = true;
  try { const d = await liGet(`${LI()}/api/broadcast/top`); CHL.top = (d.active || []).map((x) => ({ id: x.tour.id, slug: x.tour.slug, name: x.tour.name, info: x.tour.info?.format || x.tour.description || "", tier: x.tour.tier || 0, round: x.round ? { id: x.round.id, slug: x.round.slug, name: x.round.name, ongoing: !!x.round.ongoing, startsAt: x.round.startsAt || 0 } : null })); CHL.topErr = ""; CHL.t = Date.now(); }
  catch (e) { CHL.topErr = String(e.message || e); }
  CHL.topBusy = false; render();
}
async function liTour(id) {
  try { const d = await liGet(`${LI()}/api/broadcast/${encodeURIComponent(id)}`); CHL.tour = { id, slug: d.tour.slug, name: d.tour.name, rounds: (d.rounds || []).map((r) => ({ id: r.id, slug: r.slug, name: r.name, ongoing: !!r.ongoing, finished: !!r.finished, startsAt: r.startsAt || 0 })) };
    const def = d.defaultRoundId || CHL.tour.rounds.find((r) => r.ongoing)?.id || CHL.tour.rounds.at(-1)?.id; if (def) await liRound(def); }
  catch (e) { toast(String(e.message || e), true); }
  render();
}
async function liRound(rid) {
  const T = CHL.tour, r = T?.rounds.find((x) => x.id === rid); if (!r) return;
  try { const d = await liGet(`${LI()}/api/broadcast/${encodeURIComponent(T.slug)}/${encodeURIComponent(r.slug)}/${encodeURIComponent(rid)}`);
    CHL.round = { id: rid, name: r.name, ongoing: !!d.round?.ongoing, games: (d.games || []).map((g) => ({ id: g.id, fen: g.fen || new Chess().fen(), last: g.lastMove ? { from: g.lastMove.slice(0, 2), to: g.lastMove.slice(2, 4) } : null, status: g.status || "*", think: g.thinkTime || 0,
      p: (g.players || []).map((p) => ({ name: p.name || "?", title: p.title || "", rating: p.rating || 0, fed: p.fed || "", clock: p.clock })) })), at: Date.now() }; CHL.pgn = null; }
  catch (e) { toast(String(e.message || e), true); }
}
async function liPgn() {
  const R = CHL.round; if (!R || CHL.pgnBusy) return; CHL.pgnBusy = true;
  try { const txt = await liGet(`${LI()}/api/broadcast/round/${encodeURIComponent(R.id)}.pgn`, true); const parts = String(txt || "").split(/\n\s*\n(?=\[Event )/);
    CHL.pgn = {}; R.games.forEach((g, i) => { const chunk = parts.find((p) => p.includes(g.id)) || parts[i]; if (!chunk) return; try { const c = new Chess(); c.loadPgn(chunk); CHL.pgn[g.id] = c.history(); } catch (_) {} }); }
  catch (e) { CHL.pgn = {}; }
  CHL.pgnBusy = false; render();
}
const liClock = (c) => c == null ? "" : (() => { const s = Math.max(0, Math.round(c / 100)); return `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ":" : ""}${String(Math.floor(s / 60) % 60).padStart(Math.floor(s / 3600) ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`; })();
const liP = (p) => p ? `${p.title ? `<span class="li-title">${esc(p.title)}</span> ` : ""}${esc(p.name)}${p.rating ? ` <span class="muted small">${p.rating}</span>` : ""}` : "?";
const liRes = (s) => s === "1-0" ? "1–0" : s === "0-1" ? "0–1" : s === "½-½" || s === "1/2-1/2" ? "½–½" : "en cours";
function viewChLive() {
  if (CHL.gid && CHL.round) return viewChLiveGame();
  if (CHL.tour) {
    const T = CHL.tour, R = CHL.round;
    return `<button class="btn wback" data-liact="tour-back">← Tournois</button><h2>${esc(T.name)}</h2>
      <div class="li-rounds">${T.rounds.map((r) => `<button class="chip-b ${R?.id === r.id ? "on" : ""}" data-liround="${esc(r.id)}">${r.ongoing ? "🔴 " : r.finished ? "" : "⏳ "}${esc(r.name)}</button>`).join("")}</div>
      ${R ? `<div class="lu-h"><h3>${esc(R.name)} ${R.ongoing ? '<span class="chip live">🔴 en direct</span>' : ""}</h3><button class="btn" data-liact="round-reload" title="Actualiser">⟳</button></div>
        ${R.games.length ? `<div class="li-games">${R.games.map((g) => `<button class="card li-g" data-ligame="${esc(g.id)}">${chBoard(g.fen, { last: g.last, mini: true })}
          <div class="li-gp"><div>⚪ ${liP(g.p[0])} <span class="li-ck">${liClock(g.p[0]?.clock)}</span></div><div>⚫ ${liP(g.p[1])} <span class="li-ck">${liClock(g.p[1]?.clock)}</span></div><div class="li-st ${g.status === "*" ? "on" : ""}">${liRes(g.status)}</div></div></button>`).join("")}</div>`
        : '<div class="empty">Pas encore de partie dans cette ronde.</div>'}` : '<div class="muted small">⟳ Lichess…</div>'}
      <p class="muted small">Retransmis par Lichess (lichess.org/broadcast).</p>`;
  }
  if (!CHL.top && !CHL.topErr) { liTop(); return `<h2>📡 En direct</h2><div class="muted small">⟳ Lichess…</div>`; }
  if (!CHL.top) return `<h2>📡 En direct</h2><div class="card err">⚠ ${esc(CHL.topErr)}</div><button class="btn" data-liact="top-reload">⟳ Réessayer</button>`;
  return `<div class="lu-h"><h2>📡 En direct</h2><button class="btn" data-liact="top-reload" title="Actualiser">⟳</button></div>
    <p class="muted small">Les grands tournois retransmis sur Lichess en ce moment, partie par partie.</p>
    ${CHL.top.length ? CHL.top.map((t) => `<button class="card li-tour" data-litour="${esc(t.id)}"><div><b>${esc(t.name)}</b></div>
      ${t.round ? `<div class="muted small">${t.round.ongoing ? "🔴 " : "⏳ "}${esc(t.round.name)}${!t.round.ongoing && t.round.startsAt ? " · " + esc(new Date(t.round.startsAt).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })) : ""}</div>` : ""}
      ${t.info ? `<div class="muted small">${esc(t.info)}</div>` : ""}</button>`).join("") : '<div class="empty">Aucun tournoi retransmis en ce moment.</div>'}`;
}
function viewChLiveGame() {
  const g = CHL.round.games.find((x) => x.id === CHL.gid); if (!g) { CHL.gid = ""; return viewChLive(); }
  if (!CHL.pgn) liPgn();
  const mv = CHL.pgn?.[g.id] || null, ply = CHL.ply == null ? (mv ? mv.length : 0) : CHL.ply;
  const P = mv ? chFenAt(mv, ply) : { fen: g.fen, last: g.last };
  const top = CHL.flip ? g.p[0] : g.p[1], bot = CHL.flip ? g.p[1] : g.p[0], tc = CHL.flip ? "⚪" : "⚫", bc = CHL.flip ? "⚫" : "⚪";
  return `<button class="btn wback" data-liact="game-back">← ${esc(CHL.round.name)}</button>
    <div class="li-pl">${tc} ${liP(top)} <span class="li-ck">${liClock(top?.clock)}</span></div>
    ${chBoard(P.fen, { flip: CHL.flip, last: P.last, id: "lilive-b" })}
    <div class="li-pl">${bc} ${liP(bot)} <span class="li-ck">${liClock(bot?.clock)}</span></div>
    <div class="li-st ${g.status === "*" ? "on" : ""}" style="text-align:center">${liRes(g.status)}</div>
    ${mv ? chNav("live") + `<div class="muted small" style="text-align:center">${ply}/${mv.length}</div>` + chMoveList(mv, ply, "live") : '<div class="muted small">⟳ les coups…</div>'}
    ${liCard(P.fen)}`;
}
TABS.chlive = viewChLive;
// (📡 en direct : la ronde se relit toute seule toutes les 30 s tant que tu la regardes)
setInterval(async () => {
  if (document.hidden || D.space !== "ch" || D.tab !== "chlive" || !CHL.round?.ongoing || Date.now() - CHL.round.at < 30000) return;
  const keep = CHL.gid, follow = CHL.ply == null; await liRound(CHL.round.id); CHL.gid = keep; if (follow) CHL.ply = null; if (keep) await liPgn(); else render();
}, 5000);

/* ------------------------------------------------------------ les gestes */
document.addEventListener("click", async (e) => {
  const t = e.target;
  const pq = t.closest("#lipz-b [data-sq]"); if (pq) return liPzTap(pq.dataset.sq);
  const nv = t.closest("[data-chnav^='live:']");
  if (nv) { e.stopImmediatePropagation(); const a = nv.dataset.chnav.split(":")[1], mv = CHL.pgn?.[CHL.gid] || [], cur = CHL.ply == null ? mv.length : CHL.ply;
    if (a === "flip") CHL.flip = !CHL.flip; else { const n = a === "0" ? 0 : a === "end" ? mv.length : Math.max(0, Math.min(mv.length, cur + +a)); CHL.ply = n >= mv.length ? null : n; }
    return render(); }
  const pl = t.closest("[data-chply^='live:']"); if (pl) { e.stopImmediatePropagation(); const n = +pl.dataset.chply.split(":")[1], mv = CHL.pgn?.[CHL.gid] || []; CHL.ply = n >= mv.length ? null : n; return render(); }
  const tr = t.closest("[data-litour]"); if (tr) { CHL.tour = { id: tr.dataset.litour, name: "…", rounds: [] }; CHL.round = null; render(); window.scrollTo(0, 0); return liTour(tr.dataset.litour); }
  const rd = t.closest("[data-liround]"); if (rd) { CHL.round = null; render(); await liRound(rd.dataset.liround); return render(); }
  const gm = t.closest("[data-ligame]"); if (gm) { CHL.gid = gm.dataset.ligame; CHL.ply = null; CHL.flip = false; window.scrollTo(0, 0); return render(); }
  const el = t.closest("[data-liact]"); if (!el) return;
  const a = el.dataset.liact;
  if (a === "on") { CHL.on = true; return render(); }
  if (a === "off") { CHL.on = false; return render(); }
  if (a === "pz-reload") { CHL.pz = null; CHL.pzErr = ""; return liPuzzleLoad(true); }
  if (a === "pz-hint") { const P = CHL.pz; P.hint = P.sol[P.i]?.slice(0, 2); P.sel = null; return render(); }
  if (a === "pz-show") { const P = CHL.pz; P.err = Math.max(P.err, 1); P.i = P.sol.length; P.done = true; liPzSave(); return render(); }
  if (a === "top-reload") { CHL.top = null; CHL.topErr = ""; render(); return liTop(true); }
  if (a === "tour-back") { CHL.tour = null; CHL.round = null; return render(); }
  if (a === "round-reload") { await liRound(CHL.round.id); return render(); }
  if (a === "game-back") { CHL.gid = ""; CHL.pgn = null; return render(); }
}, true);
if (D.space === "ch") render();          // (un premier affichage a pu partir avant ce fichier)
