/* =====================================================================
   plan.js — 🗺 LE PLAN DE MATCH (v146), le même fichier dans le Hub et sur le téléphone (ui/js/plan.js = mobile/plan.js).
   Rien que du calcul et du HTML. Pour un adversaire : ses persos ; pour chacun, ton meilleur counterpick (ta note de MU,
   sinon tes résultats sur 3 games ou plus, parmi ta line up hors « en apprentissage »), ton bilan contre ce perso, et
   les stages à prendre / à bannir d'après tes games contre lui (2 games ou plus par stage). Plus ton face-à-face et
   tes notes sur le joueur.
   ===================================================================== */
const planSlug = (n) => String(n || "").toLowerCase().replace(/&/g, "and").replace(/[.'’]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const planEsc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/* o = { oppChars: [{ name, pct? }], sets, games(s), lineup: { slug: { cat } }, mu: { "a|b": v }, charName(v), pid } */
function planBuild(o) {
  const G = [];
  for (const s of o.sets || []) {
    if (s.dq) continue;
    for (const g of o.games(s) || []) {
      if (g.win == null) continue;
      G.push({ me: planSlug(o.charName(g.me)), opp: planSlug(o.charName(g.opp)), stage: g.stage || "", win: !!g.win, vs: String(s.opp_id || "") === String(o.pid || "") });
    }
  }
  const rec = (l) => { const w = l.filter((g) => g.win).length; return { w, l: l.length - w, n: l.length, pct: l.length ? Math.round((100 * w) / l.length) : 0 }; };
  const mine = Object.entries(o.lineup || {}).filter(([, v]) => v && v.cat && v.cat !== "learn").map(([slug, v]) => ({ slug, cat: v.cat }));
  const chars = (o.oppChars || []).slice(0, 3).map((c) => {
    const oc = planSlug(c.name), vs = G.filter((g) => g.opp === oc);
    let best = null;
    for (const m of mine) {
      const r = (o.mu || {})[`${m.slug}|${oc}`], x = rec(vs.filter((g) => g.me === m.slug));
      const sc = r != null ? { v: +r, src: "note", rec: x } : x.n >= 3 ? { v: Math.max(-2, Math.min(2, Math.round((x.pct - 50) / 20))), src: "games", rec: x } : null;
      if (sc && (!best || sc.v > best.v || (sc.v === best.v && sc.src === "note" && best.src !== "note"))) best = { ...sc, slug: m.slug };
    }
    const st = new Map();
    for (const g of vs) if (g.stage) (st.get(g.stage) || st.set(g.stage, []).get(g.stage)).push(g);
    const stages = [...st].map(([k, l]) => ({ stage: k, ...rec(l) })).filter((x) => x.n >= 2);
    return { name: c.name, slug: oc, pct: c.pct, rec: rec(vs), best,
      pick: stages.slice().sort((a, b) => b.pct - a.pct || b.n - a.n).filter((x) => x.pct >= 50).slice(0, 2),
      ban: stages.slice().sort((a, b) => a.pct - b.pct || b.n - a.n).filter((x) => x.pct < 50).slice(0, 2) };
  });
  return { chars, h2h: rec(G.filter((g) => g.vs)), sets: (o.sets || []).filter((s) => !s.dq && String(s.opp_id || "") === String(o.pid || "")) };
}
/* le HTML. h = { who, icon(name) → html, myName(slug) → nom, note, sign(v) } */
function planHTML(p, h) {
  const sw = p.sets.filter((s) => s.win).length, sl = p.sets.length - sw;
  const sign = (v) => (v > 0 ? "+" + v : String(v));
  const stg = (l, cls) => l.map((x) => `<span class="pl-st ${cls}">${planEsc(x.stage)} <small>${x.w}-${x.l}</small></span>`).join("");
  const ch = p.chars.map((c) => `<div class="pl-ch">
      <div class="pl-h">${h.icon(c.name)}<b>${planEsc(c.name)}</b>${c.pct != null ? ` <span class="pl-m">${c.pct} % de ses games</span>` : ""}${c.rec.n ? ` <span class="pl-m">· toi contre ce perso : ${c.rec.w}-${c.rec.l} (games)</span>` : ""}</div>
      <div class="pl-row"><span class="pl-k">Counterpick</span>${c.best ? `${h.icon(h.myName(c.best.slug))} <b>${planEsc(h.myName(c.best.slug))}</b> <span class="pl-m">${c.best.src === "note" ? `ta note de MU ${sign(c.best.v)}` : `${c.best.rec.w}-${c.best.rec.l} en games`}</span>`
        : '<span class="pl-m">pas d\'info : note ce MU dans ton MU chart, ou joue-le</span>'}</div>
      <div class="pl-row"><span class="pl-k">Stages</span>${c.pick.length || c.ban.length ? `${stg(c.pick, "ok")}${stg(c.ban, "no")}` : '<span class="pl-m">pas assez de games renseignées contre ce perso</span>'}</div>
    </div>`).join("");
  return `<div class="pl">
    <div class="pl-top"><span>Face-à-face : <b>${p.sets.length ? `${sw}-${sl}` : "jamais joué"}</b></span>${p.h2h.n ? ` <span class="pl-m">(${p.h2h.w}-${p.h2h.l} en games)</span>` : ""}</div>
    ${h.note ? `<div class="pl-note">📝 ${planEsc(h.note)}</div>` : ""}
    ${ch || '<div class="pl-m">Ses persos ne sont pas connus (pas de games renseignées sur start.gg).</div>'}
    <div class="pl-m pl-foot">Counterpick : ta note de MU, sinon tes résultats (3 games ou plus) · stages : tes games contre ce perso (2 ou plus) · <span class="pl-st ok">à prendre</span> <span class="pl-st no">à bannir</span></div>
  </div>`;
}

/* 🎭 v147 : la saisie rapide des persos d'un set (Shobu surtout : son API ne les donne pas). Les sets à compléter : joués,
   sans perso renseigné, des `days` derniers jours. Les games créées d'après le score : tes victoires puis tes défaites
   (l'ordre n'a pas d'importance pour les stats), le même perso pour tout le set. */
function fillTodo(sets, games, days = 120) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  return (sets || []).filter((s) => !s.dq && (s.ts || "") >= since && (s.score || []).some((x) => x > 0) && !(games(s) || []).some((g) => g.me || g.opp))
    .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
}
function fillGames(s, me, opp) {
  const [a, b] = (s.score || []).map((x) => Math.max(0, +x || 0)), out = [];
  for (let i = 0; i < a; i++) out.push({ n: out.length + 1, me, opp, stage: "", win: true });
  for (let i = 0; i < b; i++) out.push({ n: out.length + 1, me, opp, stage: "", win: false });
  return out.length ? out : [{ n: 1, me, opp, stage: "", win: s.win == null ? null : !!s.win }];
}
/* les persos à proposer : toi (ta line up, puis tes plus joués) ; lui (ses mains, ce qu'il a joué contre toi, son scouting) */
function fillChoices(o) {
  const cnt = (arr) => [...arr.reduce((m, x) => (x ? m.set(x, (m.get(x) || 0) + 1) : m), new Map())].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const mineG = [], hisG = [];
  for (const s of o.sets || []) for (const g of o.games(s) || []) { if (g.me) mineG.push(o.charName(g.me)); if (g.opp && String(s.opp_id) === String(o.set.opp_id)) hisG.push(o.charName(g.opp)); }
  const lu = (o.lineupNames || []);
  const me = [...new Set([...lu, ...cnt(mineG)])].filter(Boolean).slice(0, 8);
  const him = [...new Set([...(o.oppMains || []).map(o.charName), ...cnt(hisG)])].filter(Boolean).slice(0, 6);
  return { me, him };
}

/* ------------------------------------------------------------ 🏆 le récap d'un tournoi (v148), Hub et téléphone
   t = { sets, place, seed, entrants, spr } ; uf(s) = paliers d'écart de seed (> 0 : il était mieux seedé). */
function recapFacts(t, uf) {
  const sets = (t.sets || []).slice().sort((a, b) => (a.ts || "").localeCompare(b.ts || "")), play = sets.filter((s) => !s.dq);
  const sc = (s) => [+(s.score?.[0] ?? -1), +(s.score?.[1] ?? -1)];
  const exploits = play.filter((s) => s.win && uf(s) > 0), contre = play.filter((s) => !s.win && uf(s) < 0);
  const close = play.filter((s) => { const [a, b] = sc(s); return a >= 0 && b >= 0 && Math.abs(a - b) === 1 && a + b >= 3; });
  const wins = play.filter((s) => s.win && s.opp_seed).sort((a, b) => a.opp_seed - b.opp_seed);
  const out = play.filter((s) => !s.win).slice(-1)[0] || null;
  const cw = close.filter((s) => s.win).length;
  return { sets, exploits, contre, close, closeW: cw, closeL: close.length - cw, best: wins[0] || null, out, won: t.place === 1 };
}
/* le brouillon de « Ce que je retiens » : des faits, à compléter */
function recapNote(t, f, round = (r) => r || "") {
  const L = [];
  L.push(`${t.place ? t.place + (t.place === 1 ? "er" : "e") : "?"}${t.entrants ? " sur " + t.entrants : ""}${t.seed ? ` (seed ${t.seed}${t.spr != null ? `, ${t.spr > 0 ? "+" : ""}${t.spr}` : ""})` : ""} · ${f.sets.filter((s) => s.win).length}-${f.sets.filter((s) => !s.win && !s.dq).length} en sets.`);
  if (f.best) L.push(`Meilleure victoire : ${f.best.opp} (seed ${f.best.opp_seed}).`);
  if (f.exploits.length) L.push(`Exploits : ${f.exploits.map((s) => s.opp).join(", ")}.`);
  if (f.contre.length) L.push(`Contre-perf : ${f.contre.map((s) => s.opp).join(", ")}.`);
  if (f.close.length) L.push(`Sets serrés (dernière game) : ${f.closeW} gagné${f.closeW > 1 ? "s" : ""}, ${f.closeL} perdu${f.closeL > 1 ? "s" : ""}.`);
  if (f.out) L.push(`Sorti par ${f.out.opp} (${round(f.out.round)}, ${f.out.score?.join("-") || "?"}).`);
  L.push("", "Ce qui a marché :", "- ", "", "À travailler :", "- ");
  return L.join("\n");
}
