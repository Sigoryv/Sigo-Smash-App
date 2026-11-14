/* =====================================================================
   bk_pool.js — 🔁 POULES (round robin) ET RONDES SUISSES (v84), le même fichier dans le Hub et sur le téléphone
   (ui/js/bk_pool.js = mobile/bk_pool.js, copies identiques). Rien que du calcul et du HTML :
   classement (sets, games, face-à-face), grille joueur × joueur, zone de qualification, ton parcours.
   Une phase : { id, name, type (bracketType start.gg), seeds, ngroups, groups: [{ id, name, sets }] }.
   ===================================================================== */
const BKP_TYPES = { ROUND_ROBIN: "rr", SWISS: "swiss", DOUBLE_ELIMINATION: "de", SINGLE_ELIMINATION: "se" };
const BKP_PILL = { rr: "Poules", swiss: "Suisse", de: "Double élim.", se: "Simple élim." };
const bkpEsc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* le format d'une phase : celui de start.gg ; sans (Shobu), on le devine : personne ne tombe en losers mais un perdant rejoue */
function bkpKind(ph) {
  const k = BKP_TYPES[String(ph?.type || "").toUpperCase()]; if (k) return k;
  const sets = (ph?.groups || []).flatMap((g) => g.sets || []);
  if (sets.length < 3 || sets.some((s) => s.round < 0 || (s.pre || []).some(Boolean))) return "";
  const lostAt = new Map();
  for (const s of sets) if (s.state === "done" && s.winner) for (const x of s.slots) if (x && x.id !== s.winner) lostAt.set(x.id, Math.min(lostAt.get(x.id) ?? 1e9, s.round));
  const replays = sets.some((s) => s.slots.some((x) => x && lostAt.has(x.id) && s.round > lostAt.get(x.id)));
  if (!replays) return "";
  return (ph.groups || []).every((g) => { const n = new Set(g.sets.flatMap((s) => s.slots.filter(Boolean).map((x) => x.id))).size; return g.sets.length === n * (n - 1) / 2; }) ? "rr" : "swiss";
}
const bkpIsPool = (ph) => ["rr", "swiss"].includes(bkpKind(ph));
const bkpPill = (ph) => BKP_PILL[bkpKind(ph)] || "";

/* qui sort de poule : ceux qu'on voit déjà dans une phase suivante (sûr), et le nombre de places par poule (estimé :
   joueurs de la phase suivante ÷ nombre de poules) */
function bkpNext(r, ph) { const i = r.phases.findIndex((p) => p.id === ph.id); return i >= 0 ? r.phases[i + 1] || null : null; }
function bkpQualified(r, ph) {
  const i = r.phases.findIndex((p) => p.id === ph.id), q = new Set();
  for (const p of r.phases.slice(i + 1)) for (const g of p.groups) for (const s of g.sets) for (const x of s.slots) if (x) q.add(x.id);
  return q;
}
function bkpAdv(r, ph) {
  const nx = bkpNext(r, ph); if (!nx) return 0;
  const groups = ph.ngroups || ph.groups.length || 1;
  let seeds = nx.seeds || 0;
  if (!seeds) { const ids = new Set(nx.groups.flatMap((g) => g.sets.flatMap((s) => s.slots.filter(Boolean).map((x) => x.id)))); seeds = ids.size; }
  const n = Math.floor(seeds / groups);
  return n > 0 ? n : 0;
}

/* le classement d'une poule */
function bkpTable(sets) {
  const P = new Map();
  const get = (x) => { if (!P.has(x.id)) P.set(x.id, { x, w: 0, l: 0, gw: 0, gl: 0, vs: new Map(), left: [], live: null }); const p = P.get(x.id); if (x.seed != null && p.x.seed == null) p.x = x; return p; };
  for (const s of sets) {
    const [a, b] = s.slots; if (a) get(a); if (b) get(b);
    if (!a || !b) continue;
    const A = get(a), B = get(b);
    if (s.state === "done" && s.winner) {
      const aw = s.winner === a.id, sa = a.score, sb = b.score;
      (aw ? A : B).w++; (aw ? B : A).l++;
      if (sa != null && sb != null && sa >= 0 && sb >= 0) { A.gw += sa; A.gl += sb; B.gw += sb; B.gl += sa; }
      const sc = (m, o) => m == null || o == null ? "" : m < 0 ? "DQ" : o < 0 ? "W" : `${m}-${o}`;
      A.vs.set(b.id, { res: aw ? "w" : "l", sc: sc(sa, sb), s }); B.vs.set(a.id, { res: aw ? "l" : "w", sc: sc(sb, sa), s });
    } else {
      const lv = s.state === "live";
      A.vs.set(b.id, { res: lv ? "live" : "next", sc: lv && a.score != null ? `${a.score}-${b.score ?? 0}` : "", s }); B.vs.set(a.id, { res: lv ? "live" : "next", sc: lv && b.score != null ? `${b.score}-${a.score ?? 0}` : "", s });
      A.left.push({ o: b, s }); B.left.push({ o: a, s }); if (lv) { A.live = b; B.live = a; }
    }
  }
  const rows = [...P.values()];
  rows.sort((p, q) => q.w - p.w || p.l - q.l
    || (p.vs.get(q.x.id)?.res === "w" ? -1 : q.vs.get(p.x.id)?.res === "w" ? 1 : 0)
    || (q.gw - q.gl) - (p.gw - p.gl) || q.gw - p.gw || (p.x.seed ?? 999) - (q.x.seed ?? 999));
  rows.forEach((p, i) => (p.rank = i + 1));
  return rows;
}

/* le bloc complet d'une poule / d'une phase suisse : ton point, le classement, la grille (round robin).
   o = { isMe(x), hl (id suivi), av(x) → html (photo), kind } */
function bkpHTML(r, ph, g, o) {
  const kind = o.kind || bkpKind(ph), rows = bkpTable(g.sets), adv = bkpAdv(r, ph), qual = bkpQualified(r, ph);
  if (!rows.length) return '<div class="muted small">Pas encore de joueurs dans cette poule.</div>';
  const nd = g.sets.filter((s) => s.state === "done").length, over = nd === g.sets.length;
  const focus = rows.find((p) => o.hl ? p.x.id === o.hl : o.isMe(p.x));
  const cls = (p) => `${o.isMe(p.x) ? "me" : ""} ${o.hl === p.x.id ? "hl" : ""} ${qual.has(p.x.id) ? "q" : ""}`;
  const pname = (p) => `<span class="bkp-pn" data-bkp="${bkpEsc(p.x.id)}" data-bkn="${bkpEsc(p.x.name)}">${o.av ? o.av(p.x) : ""}<span class="bk-name">${bkpEsc(p.x.name)}</span></span>`;
  const gd = (p) => { const d = p.gw - p.gl; return d > 0 ? "+" + d : String(d); };
  const pre = (p) => p.w + p.l;
  const head = `<div class="bkp-info small muted"><span class="bkp-pill ${kind}">${BKP_PILL[kind] || "Poule"}</span> ${rows.length} joueurs · ${nd}/${g.sets.length} sets joués${adv ? ` · <b>${adv}</b> sortent${qual.size ? "" : " (estimé)"}` : ""}${over ? " · poule terminée" : ""}</div>`;
  let me = "";
  if (focus) {
    const who = o.hl ? bkpEsc(focus.x.name) : "Toi", inZone = adv && focus.rank <= adv;
    const sure = qual.has(focus.x.id);
    const zone = sure ? '<span class="bkp-ok">✓ qualifié·e pour la suite</span>' : adv ? (over ? (inZone ? '<span class="bkp-ok">✓ dans les qualifiés</span>' : '<span class="bkp-ko">hors qualification</span>') : inZone ? `<span class="bkp-ok">dans la zone (top ${adv})</span>` : `<span class="bkp-ko">${focus.rank - adv} place${focus.rank - adv > 1 ? "s" : ""} sous la zone (top ${adv})</span>`) : "";
    const next = focus.live ? `<div>🔴 En cours contre <b>${bkpEsc(focus.live.name)}</b></div>` : "";
    let path = "";
    if (kind === "swiss") {
      const mine = g.sets.filter((s) => s.slots.some((x) => x && x.id === focus.x.id)).sort((a, b) => a.round - b.round);
      path = `<div class="bkp-path">${mine.map((s) => { const op = s.slots.find((x) => x && x.id !== focus.x.id), v = op && focus.vs.get(op.id);
        const c = v ? v.res : "next"; return `<span class="bkp-step ${c}" title="${bkpEsc(s.label || "")}">R${s.round} ${c === "w" ? "✓" : c === "l" ? "✗" : c === "live" ? "●" : "·"} ${bkpEsc(op?.name || "?")}${v?.sc ? " " + bkpEsc(v.sc) : ""}</span>`; }).join("")}</div>`;
    } else if (focus.left.length) {
      const nx = focus.left.filter((x) => x.s.state !== "live").sort((a, b) => a.s.round - b.s.round);
      path = nx.length ? `<div class="small">Restent : ${nx.map((x) => `<b>${bkpEsc(x.o.name)}</b>${x.o.seed ? ` <span class="muted">(seed ${x.o.seed})</span>` : ""}`).join(", ")}</div>` : "";
    }
    me = `<div class="bkp-me"><div><b>${who}</b> · ${focus.rank}${focus.rank === 1 ? "er" : "e"} sur ${rows.length} · <b>${focus.w}–${focus.l}</b> en sets · ${gd(focus)} en games ${zone ? "· " + zone : ""}</div>${next}${path}</div>`;
  }
  let lastRec = null;
  const std = `<table class="bkp-std"><thead><tr><th>#</th><th class="lf">Joueur</th><th title="sets gagnés–perdus">Sets</th><th title="games gagnés–perdus">Games</th><th>±</th></tr></thead><tbody>${rows.map((p) => {
    const rec = `${p.w}-${p.l}`, sep = kind === "swiss" && lastRec !== null && rec !== lastRec; lastRec = rec;
    const line = adv && p.rank === adv + 1 ? " cut" : "";
    return `<tr class="${cls(p)}${sep ? " sep" : ""}${line}"><td class="rk">${p.rank}${qual.has(p.x.id) ? '<span class="bkp-qm" title="qualifié">✓</span>' : ""}</td><td class="lf">${pname(p)}</td><td><b>${p.w}–${p.l}</b></td><td>${p.gw}–${p.gl}</td><td>${pre(p) ? gd(p) : ""}</td></tr>`; }).join("")}</tbody></table>`;
  let grid = "";
  if (kind === "rr") {
    const short = (p) => { const t = String(p.x.name).split(" | ").pop(); return bkpEsc(t.length <= 7 ? t : t.slice(0, 6) + "."); };
    grid = `<div class="bkp-gridw"><table class="bkp-grid"><thead><tr><th></th>${rows.map((p) => `<th class="${cls(p)}" title="${bkpEsc(p.x.name)}">${p.rank}<div>${short(p)}</div></th>`).join("")}</tr></thead><tbody>${rows.map((p) =>
      `<tr class="${cls(p)}"><th class="lf">${p.rank}. ${pname(p)}</th>${rows.map((q) => { if (p === q) return '<td class="diag"></td>'; const v = p.vs.get(q.x.id);
        if (!v) return '<td class="none"></td>';
        return `<td class="${v.res}" title="${bkpEsc(p.x.name)} – ${bkpEsc(q.x.name)}${v.s.label ? " · " + bkpEsc(v.s.label) : ""}">${v.res === "live" ? "●" + (v.sc ? " " + bkpEsc(v.sc) : "") : v.res === "next" ? "·" : bkpEsc(v.sc || (v.res === "w" ? "V" : "D"))}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  return `<div class="bkp ${kind}">${head}${me}<div class="bkp-body">${std}${grid}</div></div>`;
}
/* les titres de colonnes : « Ronde 2 » en suisse, « Tour 2 » en poule */
const bkpRoundLabel = (kind, round) => (kind === "swiss" ? "Ronde " : "Tour ") + round;
