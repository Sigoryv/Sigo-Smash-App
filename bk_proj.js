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
function bkjProject(sets) {
  const by = new Map(sets.map((s) => [String(s.id), s])), memo = new Map();
  const seedOf = (x) => (x && x.seed != null ? +x.seed : 1e9);
  const P = (id) => {
    if (memo.has(id)) return memo.get(id);
    const out = { slots: [undefined, undefined], w: undefined, l: undefined }; memo.set(id, out);     // (garde-fou contre une boucle)
    const s = by.get(id); if (!s) return out;
    const reset = /reset/i.test(s.label || "");
    out.slots = [0, 1].map((i) => {
      const x = s.slots[i]; if (x) return x;
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
    else { out.w = seedOf(a) <= seedOf(b) ? a : b; out.l = out.w === a ? b : a; }
    return out;
  };
  for (const s of sets) P(String(s.id));
  return memo;
}
/* la run prévue de celui pour qui isMe(x) est vrai : ses sets dans le rejeu, winners puis losers puis grande finale.
   byes : les sets à bye du tableau (cachés à l'écran, mais ils font passer leur joueur au tour suivant) */
function bkjRun(sets, isMe, byes = []) {
  const pr = bkjProject(sets.concat(byes)), A = (s) => Math.abs(s.round);
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
    return `<button class="bkj-c ${t.res} ${t.done ? "done" : ""} ${t.live ? "live" : ""}" ${o.goAttr}="${bkjEsc(t.s.id)}" title="${t.done ? "Joué" : t.live ? "En cours" : "Prévu (meilleure seed)"}"><span class="bkj-r">${bkjEsc(bkjLab(t.s.label) || "Tour " + Math.abs(t.s.round))}</span> vs ${vs} <b>${ic}</b></button>`;
  };
  const row = (side, lab) => { const l = steps.filter((t) => t.side === side); return l.length ? `<div class="bkj-row"><span class="bkj-side">${lab}</span>${l.map(chip).join('<span class="bkj-ar">›</span>')}</div>` : ""; };
  const last = steps[steps.length - 1], lw = steps.filter((t) => t.side === "w").pop(), dropped = steps.some((t) => t.side === "l");
  const end = last.side === "gf" ? (last.res === "w" ? "🏆 gagne le tableau" : "🥈 finaliste")
    : last.res === "l" && last.side === "l" ? `éliminé·e en losers · ${bkjEsc(bkjLab(last.s.label))}`
    : last.res === "l" ? `perd en winners · ${bkjEsc(bkjLab(last.s.label))} <span class="bkj-n">(sa suite en losers n'est pas encore connue)</span>`
    : last.res === "?" ? "la suite dépend d'un adversaire pas encore connu" : "se qualifie pour la suite";
  return `<div class="bkj"><div class="bkj-h">🔮 <b>Run prévue</b> · ${who} → <b>${end}</b>${dropped && lw && lw.res === "l" ? ` <span class="bkj-n">(tombe en losers après ${bkjEsc(bkjLab(lw.s.label))})</span>` : ""}</div>
    ${row("w", "Winners")}${row("l", "Losers")}${row("gf", "Finale")}
    <div class="bkj-n">Sets joués : résultat réel · à venir : la meilleure seed gagne (🔮 = adversaire prévu).</div></div>`;
}
/* un slot vide d'un set de la run, rempli par le rejeu (sinon null) */
function bkjFill(steps, s, i) {
  const t = steps.find((x) => x.s.id === s.id);
  return t && !s.slots[i] && t.p.slots[i] ? t.p.slots[i] : null;
}
