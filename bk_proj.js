/* =====================================================================
   bk_proj.js — 🔮 LA RUN PRÉVUE DANS UN BRACKET (v133), le même fichier dans le Hub et sur le téléphone
   (ui/js/bk_proj.js = mobile/bk_proj.js, copies identiques). Rien que du calcul et du HTML.

   On rejoue le tableau (une poule / un bracket) : les sets déjà joués gardent leur vrai résultat, les autres sont
   gagnés par la meilleure seed. Chaque slot vide se remplit en suivant ses liens « pre » : le vainqueur du set
   d'avant, ou son perdant quand on passe de winners à losers (start.gg les donne ; Shobu : déduits, bk_layout).
   La run d'un joueur = ses sets dans ce rejeu : winners, puis losers s'il y tombe, puis la grande finale.
   ===================================================================== */
const BKJ_BYE = null;                                         // (personne : un bye)
/* le rejeu : id du set → { slots: [joueur | null (bye) | undefined (inconnu)], w, l } */
function bkjProject(sets, inject, pick) {
  const by = new Map(sets.map((s) => [String(s.id), s])), memo = new Map();
  const seedOf = (x) => (x && x.seed != null ? +x.seed : 1e9);
  const P = (id) => {
    if (memo.has(id)) return memo.get(id);
    const out = { slots: [undefined, undefined], w: undefined, l: undefined }; memo.set(id, out);     // (garde-fou contre une boucle)
    const s = by.get(id); if (!s) return out;
    const reset = /reset/i.test(s.label || "");
    out.slots = [0, 1].map((i) => {
      const x = s.slots[i] || inject?.get(id)?.[i]; if (x) return x;     // (v137 : un qualifié prévu d'une phase d'avant)
      if (s.bslot?.[i]) return BKJ_BYE;                       // (Shobu : ce côté est un bye)
      const p = s.pre?.[i]; if (!p || reset) return undefined;
      const c = by.get(String(p)); if (!c) return BKJ_BYE;     // (le set d'avant n'existe pas : un bye retiré)
      const r = P(String(p));
      return s.round < 0 && c.round > 0 ? r.l : r.w;          // (de winners vers losers : le perdant tombe)
    });
    const [a, b] = out.slots;
    if (s.state === "done" && s.winner) {
      out.w = out.slots.find((x) => x && x.id === s.winner); out.l = out.slots.find((x) => x && x.id !== s.winner) ?? BKJ_BYE;
    } else if (a === undefined || b === undefined || reset) { out.w = out.l = undefined; }
    else if (a === BKJ_BYE || b === BKJ_BYE) { out.w = a || b || BKJ_BYE; out.l = BKJ_BYE; }
    else { out.w = pick ? pick(a, b, s) : seedOf(a) <= seedOf(b) ? a : b; out.l = out.w === a ? b : a; }     // (v145 : pick = un tirage, pour la simulation)
    return out;
  };
  for (const s of sets) P(String(s.id));
  return memo;
}
/* la run prévue de celui pour qui isMe(x) est vrai : ses sets dans le rejeu, winners puis losers puis grande finale.
   byes : les sets à bye du tableau (cachés à l'écran, mais ils font passer leur joueur au tour suivant) */
function bkjRun(sets, isMe, byes = [], pr0 = null) {
  const pr = pr0 || bkjProject(sets.concat(byes)), A = (s) => Math.abs(s.round);
  const kind = (s) => (s.round >= 99 || /grand/i.test(s.label || "") ? 2 : s.round > 0 ? 0 : 1);
  const ord = sets.filter((s) => !s.bye && !/reset/i.test(s.label || "")).slice().sort((a, b) => kind(a) - kind(b) || A(a) - A(b) || (a.order || 0) - (b.order || 0));
  const steps = [];
  for (const s of ord) {
    const p = pr.get(String(s.id)), i = p.slots.findIndex((x) => x && isMe(x)); if (i < 0) continue;
    const me = p.slots[i], opp = p.slots[1 - i], real = (x) => !!x && s.slots.some((y) => y && y.id === x.id);
    const res = s.state === "done" ? (s.winner === me.id ? "w" : "l") : opp === BKJ_BYE ? "bye" : opp === undefined ? "?" : p.w && p.w.id === me.id ? "w" : "l";
    steps.push({ s, p, side: ["w", "l", "gf"][kind(s)], me, opp, res, done: s.state === "done", live: s.state === "live", guess: !!opp && !real(opp), guessMe: !real(me) });
  }
  return steps;
}
const bkjEsc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const bkjLab = (lab) => String(lab || "").replace(/^Winners /, "").replace(/^Losers /, "").replace("Round", "Tour").replace("Quarter-Final", "Quart").replace("Semi-Final", "Demie")
  .replace("Grand Final Reset", "Grande finale (reset)").replace("Grand Final", "Grande finale").replace("Final", "Finale");
/* le bandeau : la run en pastilles (un clic → le set), et où elle s'arrête. o = { who, goAttr } */
function bkjHTML(steps, o) {
  const who = bkjEsc(o.who || "Toi");
  if (!steps.length) return `<div class="bkj"><div class="bkj-h">🔮 <b>Run prévue</b> · ${who} : pas dans ce tableau.</div></div>`;
  const chip = (t) => {
    const ic = t.done ? (t.res === "w" ? "✓" : "✗") : t.live ? "●" : t.res === "w" ? "↗" : t.res === "l" ? "↘" : t.res === "bye" ? "→" : "?";
    const vs = t.opp === BKJ_BYE ? "bye" : t.opp === undefined ? "à déterminer" : `${t.guess ? "🔮 " : ""}${bkjEsc(t.opp.name)}${t.opp.seed ? ` <span class="bkj-sd">(${t.opp.seed})</span>` : ""}`;
    const sm = o.sim && !t.done ? o.sim : null, rp = sm?.reach.get(String(t.s.id)), wp = sm?.win.get(String(t.s.id)), op = sm?.opps.get(String(t.s.id)) || [];
    const tip = (t.done ? "Joué" : t.live ? "En cours" : "Prévu (meilleure seed)") + (sm && rp != null ? ` · tu y arrives ${rp} %, tu le gagnes ${wp ?? 0} %` + (op.length ? ` · adversaires : ${op.map(([nm, c]) => `${nm} ${c} %`).join(", ")}` : "") : "");
    const plan = o.planAttr && !t.done && t.opp && t.opp.pid ? `<button class="bkj-plan" ${o.planAttr}="${bkjEsc(t.opp.pid)}" data-pn="${bkjEsc(t.opp.name)}" title="🗺 Plan de match contre ${bkjEsc(t.opp.name)}">🗺</button>` : "";
    return plan + `<button class="bkj-c ${t.res} ${t.done ? "done" : ""} ${t.live ? "live" : ""}" ${o.goAttr}="${bkjEsc(t.s.id)}" title="${bkjEsc(tip)}"><span class="bkj-r">${bkjEsc(bkjLab(t.s.label) || "Tour " + Math.abs(t.s.round))}</span> vs ${vs} <b>${ic}</b>${sm && rp != null ? ` <span class="bkj-pc" title="atteint · gagné">${rp}% · ${wp ?? 0}%</span>` : ""}</button>`;
  };
  const row = (side, lab) => { const l = steps.filter((t) => t.side === side); return l.length ? `<div class="bkj-row"><span class="bkj-side">${lab}</span>${l.map(chip).join('<span class="bkj-ar">›</span>')}</div>` : ""; };
  const last = steps[steps.length - 1], lw = steps.filter((t) => t.side === "w").pop(), dropped = steps.some((t) => t.side === "l");
  const end = last.side === "gf" ? (last.res === "w" ? "🏆 gagne le tableau" : "🥈 finaliste")
    : last.res === "l" && last.side === "l" ? `éliminé·e en losers · ${bkjEsc(bkjLab(last.s.label))}`
    : last.res === "l" ? `perd en winners · ${bkjEsc(bkjLab(last.s.label))} <span class="bkj-n">(sa suite en losers n'est pas encore connue)</span>`
    : last.res === "?" ? "la suite dépend d'un adversaire pas encore connu" : "se qualifie pour la suite";
  return `<div class="bkj"><div class="bkj-h">🔮 <b>Run prévue</b> · ${who} → <b>${end}</b>${dropped && lw && lw.res === "l" ? ` <span class="bkj-n">(tombe en losers après ${bkjEsc(bkjLab(lw.s.label))})</span>` : ""}</div>
    ${o.simLine || ""}${row("w", "Winners")}${row("l", "Losers")}${row("gf", "Finale")}
    <div class="bkj-n">Sets joués : résultat réel · à venir : la meilleure seed gagne (🔮 = adversaire prévu).</div></div>`;
}
/* v136 : tout le bracket prévu. bkjAll : le rejeu d'un tableau (byes compris) ; bkjSlot : un slot vide rempli par le
   rejeu (sinon null) ; bkjWin : l'id du vainqueur prévu d'un set pas encore joué (sinon "") */
function bkjAll(sets, byes = []) { return bkjProject(sets.concat(byes)); }
function bkjSlot(pr, s, i) { const p = pr && pr.get(String(s.id)); return !s.slots[i] && p && p.slots[i] ? p.slots[i] : null; }
function bkjWin(pr, s) {
  const p = pr && pr.get(String(s.id));
  return p && s.state !== "done" && p.slots[0] && p.slots[1] && p.w ? p.w.id : "";
}
/* un slot vide d'un set de la run, rempli par le rejeu (sinon null) */
function bkjFill(steps, s, i) {
  const t = steps.find((x) => x.s.id === s.id);
  return t && !s.slots[i] && t.p.slots[i] ? t.p.slots[i] : null;
}

/* 🔮 v137 : la prévision continue dans les phases suivantes (poules → top 16 → top 8…). On rejoue les phases dans
   l'ordre (de la plus grande à la plus petite) ; les qualifiés prévus d'une phase (vainqueurs du dernier tour winners
   et du dernier tour losers de chaque poule, ou de la grande finale) sont placés dans les places encore vides de la
   suivante, d'après leur seed, en placement classique (1 contre 16, 8 contre 9… ; côté losers aussi, vu sur Shobu). start.gg et Shobu ne donnent pas ce placement avant la fin des poules : estimation.
   Renvoie Map « idPhase|idPoule » → rejeu de ce tableau. */
function bkjStd(n) { let o = [1]; while (o.length < n) { const m = o.length * 2 + 1; o = o.flatMap((a) => [a, m - a]); } return o; }
function bkjMulti(phases, isPool, pick) {
  const out = new Map(), seedOf = (x) => (x && x.seed != null ? +x.seed : 1e9), A = (s) => Math.abs(s.round);
  const list = (phases || []).filter((p) => !(isPool && isPool(p))).map((p, i) => ({ p, i, n: p.groups.reduce((a, g) => a + g.sets.length + (g.byes || []).length, 0) }))
    .sort((a, b) => b.n - a.n || a.i - b.i).map((x) => x.p);
  let carry = null;
  for (const ph of list) {
    const inject = new Map();
    if (carry) {
      const placed = new Set(ph.groups.flatMap((g) => g.sets.flatMap((s) => s.slots.filter(Boolean).map((x) => x.id))));
      const free = (side) => ph.groups.flatMap((g) => g.sets.filter((s) => side * s.round > 0 && s.round < 99 && !/reset|grand/i.test(s.label || ""))
        .flatMap((s) => [0, 1].filter((i) => !s.slots[i] && !s.pre?.[i]).map((i) => ({ s, i }))));
      const put = (slots, q) => slots.forEach((sl, k) => { if (!q[k]) return; const a = inject.get(String(sl.s.id)) || [null, null]; a[sl.i] = q[k]; inject.set(String(sl.s.id), a); });
      const qw = carry.w.filter((x) => !placed.has(x.id)).sort((a, b) => seedOf(a) - seedOf(b));
      const ql = carry.l.filter((x) => !placed.has(x.id)).sort((a, b) => seedOf(a) - seedOf(b));
      const fw = free(1).sort((a, b) => A(a.s) - A(b.s) || (a.s.order || 0) - (b.s.order || 0) || a.i - b.i);
      const n = fw.length, pow = n && !(n & (n - 1));
      put(fw, pow ? bkjStd(n).map((r) => qw[r - 1]) : qw);
      const fl = free(-1).sort((a, b) => A(a.s) - A(b.s) || (a.s.order || 0) - (b.s.order || 0) || a.i - b.i);
      const nl = fl.length;                                     // (v139 : comme Shobu, placement classique aussi côté losers : 17 contre 32…)
      put(fl, nl && !(nl & (nl - 1)) ? bkjStd(nl).map((r) => ql[r - 1]) : ql);
    }
    const w = [], l = [];
    for (const g of ph.groups) {
      const pr = bkjProject(g.sets.concat(g.byes || []), inject, pick);
      out.set(`${ph.id}|${g.id}`, pr);
      const all = g.sets.concat(g.byes || []), P = (s) => pr.get(String(s.id));
      const gf = all.find((s) => s.round >= 99 && !/reset/i.test(s.label || ""));
      if (gf) { if (P(gf)?.w) w.push(P(gf).w); continue; }
      const top = (side) => { const ss = all.filter((s) => side * s.round > 0 && s.round < 99); const m = Math.max(0, ...ss.map(A)); return ss.filter((s) => A(s) === m); };
      for (const s of top(1)) if (P(s)?.w) w.push(P(s).w);
      for (const s of top(-1)) if (P(s)?.w) l.push(P(s).w);
    }
    carry = { w, l };
  }
  return out;
}

/* 🔮 v140 : ta run prévue dans tout le bracket (poules, winners, losers, phases suivantes), phase après phase :
   [{ ph, g, steps }] dans l'ordre où on les joue. (La fiche d'un tournoi sur le téléphone.) */
function bkjRunAll(r, isMe, isPool) {
  const M = bkjMulti(r.phases, isPool), out = [];
  const n = (p) => p.groups.reduce((a, g) => a + g.sets.length + (g.byes || []).length, 0);
  const order = (r.phases || []).filter((p) => !(isPool && isPool(p))).map((p, i) => ({ p, i })).sort((a, b) => n(b.p) - n(a.p) || a.i - b.i).map((x) => x.p);
  for (const ph of order) for (const g of ph.groups) {
    const pr = M.get(`${ph.id}|${g.id}`); if (!pr) continue;
    const steps = bkjRun(g.sets, isMe, g.byes || [], pr);
    if (steps.length) out.push({ ph, g, steps });
  }
  return out;
}

/* 🎲 v145 : la prévision en probabilités. La chance que a batte b : d'après l'écart de seed (courbe logistique sur le
   log des seeds : 8 contre 9 ≈ 53 %, 1 contre 16 ≈ 96 %), corrigée par ton face-à-face quand l'un des deux est toi
   (h2h : pid → [victoires, défaites]). Le tournoi est joué n fois (les sets joués gardent leur vrai résultat) ;
   pour le joueur suivi : la chance d'atteindre et de gagner chacun de ses sets, ses adversaires probables, et ses
   chances de sortir de poule, de faire top 8, de gagner. */
const BKJ_K = 1.25;
function bkjP(a, b, o = {}) {
  const sa = a?.seed != null ? +a.seed : null, sb = b?.seed != null ? +b.seed : null;
  let p = sa && sb ? 1 / (1 + Math.exp(-BKJ_K * (Math.log(sb) - Math.log(sa)))) : 0.5;
  const me = o.isMe, h = o.h2h || {};
  for (const [x, y, sgn] of [[a, b, 1], [b, a, -1]]) {
    if (me && me(x) && y && h[y.pid]) {                         // (ton face-à-face : un a priori de 4 sets « à la seed »)
      const [w, l] = h[y.pid], m = 4, q = sgn === 1 ? p : 1 - p, post = (w + q * m) / (w + l + m);
      p = sgn === 1 ? post : 1 - post;
    }
  }
  return Math.min(0.97, Math.max(0.03, p));
}
function bkjRng(seed) { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
function bkjSim(r, isPool, isMe, o = {}) {
  const n = o.n || 400, rnd = bkjRng(o.seed || 7), meOpt = { isMe: o.youMe || isMe, h2h: o.h2h };
  const pick = (a, b) => (rnd() < bkjP(a, b, meOpt) ? a : b);
  const reach = new Map(), win = new Map(), opps = new Map(), tab = new Map();
  let top8 = 0, champ = 0, deep = 0;
  const phases = (r.phases || []).filter((p) => !(isPool && isPool(p)));
  const size = (p) => p.groups.reduce((a, g) => a + g.sets.length + (g.byes || []).length, 0);
  const last = phases.slice().sort((a, b) => size(a) - size(b))[0];
  for (let k = 0; k < n; k++) {
    const M = bkjMulti(r.phases, isPool, pick);
    let inLast = false;
    for (const ph of phases) for (const g of ph.groups) {
      const pr = M.get(`${ph.id}|${g.id}`); if (!pr) continue;
      const all = g.sets.concat(g.byes || []);
      let here = false, alive = true;
      for (const s of all) {
        const q = pr.get(String(s.id)); if (!q) continue;
        const i = q.slots.findIndex((x) => x && isMe(x)); if (i < 0) continue;
        here = true;
        if (s.bye) continue;                                       // (un bye : rien à compter)
        const id = String(s.id), opp = q.slots[1 - i];
        reach.set(id, (reach.get(id) || 0) + 1);
        if (q.w && isMe(q.w)) win.set(id, (win.get(id) || 0) + 1);
        else if (q.w && s.round < 0) alive = false;
        else if (q.w && s.round >= 99 && !/reset/i.test(s.label || "")) alive = false;
        if (opp) { const m = opps.get(id) || new Map(); m.set(opp.name, (m.get(opp.name) || 0) + 1); opps.set(id, m); }
      }
      if (!here) continue;
      const key = `${ph.id}|${g.id}`, t = tab.get(key) || { here: 0, out: 0 };
      t.here++; if (alive) t.out++; tab.set(key, t);
      if (ph === last) {
        inLast = true;
        /* la place dans le dernier tableau : 1 + le nombre de joueurs éliminés plus tard que toi (même tour = même place) */
        const stage = new Map(), L = Math.max(0, ...all.filter((s) => s.round < 0).map((s) => -s.round));
        for (const s of all) {
          const q = pr.get(String(s.id)); if (!q || !q.w || !q.l) continue;
          if (s.round < 0) stage.set(q.l.id, -s.round);
          else if (s.round >= 99 && !/reset/i.test(s.label || "")) { stage.set(q.l.id, L + 1); stage.set(q.w.id, L + 2); }
        }
        const meId = [...stage.keys()].find((id) => all.some((s) => { const q = pr.get(String(s.id)); return q && q.slots.some((x) => x && x.id === id && isMe(x)); }));
        const mine = meId != null ? stage.get(meId) : Infinity, place = 1 + [...stage.values()].filter((v) => v > mine).length;
        if (place <= 8) top8++;
        if (place === 1) champ++;
      }
    }
    if (inLast) deep++;
  }
  const pct = (x) => Math.round((100 * x) / n);
  const outO = new Map([...opps].map(([id, m]) => [id, [...m].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nm, c]) => [nm, Math.round((100 * c) / (reach.get(id) || 1))])]));
  return { n, reach: new Map([...reach].map(([k, v]) => [k, pct(v)])), win: new Map([...win].map(([k, v]) => [k, Math.round((100 * v) / (reach.get(k) || 1))])),
           opps: outO, tables: new Map([...tab].map(([k, t]) => [k, { here: pct(t.here), out: pct(t.out) }])), lastKey: last ? last.id : "",
           multi: phases.length > 1, deep: pct(deep), top8: pct(top8), champ: pct(champ) };
}
/* le résumé en une ligne (pour le bandeau), et le pourcentage d'une étape */
function bkjSimLine(sim, tableKey, isFinal) {
  if (!sim) return "";
  const t = sim.tables.get(tableKey), bits = [];
  if (t && !isFinal) bits.push(`sortie de ce tableau <b>${t.out} %</b>`);
  if (sim.multi && !isFinal) bits.push(`phase finale ${sim.deep} %`);
  bits.push(`top 8 <b>${sim.top8} %</b>`, `victoire ${sim.champ} %`);
  return `<div class="bkj-sim">🎲 ${bits.join(" · ")} <span class="bkj-n">(${sim.n} simulations : seeds + ton face-à-face)</span></div>`;
}
/* le face-à-face de toi contre chaque adversaire, d'après tes sets : pid → [victoires, défaites] */
function bkjH2H(sets) {
  const h = {};
  for (const x of sets || []) { if (x.dq || !x.opp_id) continue; const k = String(x.opp_id), v = h[k] || [0, 0]; v[x.win ? 0 : 1]++; h[k] = v; }
  return h;
}
