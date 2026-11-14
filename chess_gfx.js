/* =====================================================================
   chess_gfx.js — ♟ v58 : le dessin des échecs.
   - les pièces : un jeu dessiné pour le Hub (SVG, style Staunton), net à toute taille ;
   - les thèmes d'échiquier (bois, vert, bleu, ardoise), retenus d'une fois sur l'autre ;
   - l'échiquier : dernier coup, roi en échec, coordonnées sur les bords, icône de qualité du coup
     posée sur la pièce, flèches (coup joué / meilleur coup), mini-échiquiers ;
   - l'animation des pièces quand on avance ou recule dans une partie ;
   - la courbe d'avantage (blancs / noirs), avec les fautes en points cliquables.
   ===================================================================== */

/* les pièces : viewBox 45×45, base à y = 39. « dt » : les détails (traits intérieurs). */
const CHP_BASE = "M10 39.5h25v-2.6a2.4 2.4 0 0 0-2.4-2.4H12.4A2.4 2.4 0 0 0 10 36.9z";
const CHP = {
  p: `<path d="M22.5 9a4.6 4.6 0 0 0-3.3 7.8A7 7 0 0 0 16.8 22c0 2 .8 3.7 2.1 4.9C15.8 28.4 13.4 31.2 13 34.5h19c-.4-3.3-2.8-6.1-5.9-7.6a6.8 6.8 0 0 0 2.1-4.9 7 7 0 0 0-2.4-5.2A4.6 4.6 0 0 0 22.5 9z"/>
      <path d="M11 39.5h23v-2.4a2.4 2.4 0 0 0-2.4-2.4H13.4A2.4 2.4 0 0 0 11 37.1z"/>`,
  r: `<path d="M14.2 34.5l1.6-14.2h13.4l1.6 14.2z"/><path d="M12 14V8.5h4.2v2.6h3.9V8.5h4.8v2.6h3.9V8.5H33V14l-3 3.2H15z"/>
      <path d="M14.7 17.2h15.6v3.1H14.7z"/>${`<path d="${CHP_BASE}"/>`}<path class="dt" d="M16 24h13M15.6 28h13.8"/>`,
  n: `<path d="M14 34.5c-.2-5.8 2.6-9.4 6.3-12l-3 1.2c-2 .9-4.6.6-5.6-1.2-.9-1.5-.4-3 .9-4.1l6.8-6.3.6-4.1 2.7 3c5.9.4 10.6 5 11.3 11.4.5 4.6-.1 8.6-.9 12.1z"/>
      <path d="${CHP_BASE}"/><circle class="dt-f" cx="18.2" cy="15.6" r="1.1"/><path class="dt" d="M25.5 13.5c3.6 2 5.6 6 5.6 11.3M13.6 20.8l1.6-.5"/>`,
  b: `<circle cx="22.5" cy="7.6" r="2.6"/><path d="M22.5 10.4c-5.2 3.4-8.3 7.9-8.3 12.4 0 3.6 2.4 5.6 4 6.6h8.6c1.6-1 4-3 4-6.6 0-4.5-3.1-9-8.3-12.4z"/>
      <path d="M16.5 29.4h12l1.4 5.1H15.1z"/><path d="${CHP_BASE}"/><path class="dt" d="M22.5 15.2v6.4M19.3 18.4h6.4M17.6 31.9h9.8"/>`,
  q: `<circle cx="8.6" cy="12.6" r="2.2"/><circle cx="15.6" cy="9.2" r="2.2"/><circle cx="22.5" cy="7.8" r="2.2"/><circle cx="29.4" cy="9.2" r="2.2"/><circle cx="36.4" cy="12.6" r="2.2"/>
      <path d="M11.4 30.2L9 14.6l5.8 9.6L15.9 11l4.3 12.4L22.5 10l2.3 13.4L29.1 11l1.1 13.2 5.8-9.6-2.4 15.6z"/>
      <path d="M11.4 30.2c4.6-1.6 17.6-1.6 22.2 0l1 4.3H10.4z"/><path d="${CHP_BASE}"/><path class="dt" d="M12 32.4c4.4-1.2 16.6-1.2 21 0"/>`,
  k: `<path d="M21.1 3.6h2.8v2.8h2.8v2.8h-2.8v3.6h-2.8V9.2h-2.8V6.4h2.8z"/>
      <path d="M22.5 13.6c-2.2 0-3.3 1.6-3.3 3.1 0 2.2 3.3 5.6 3.3 5.6s3.3-3.4 3.3-5.6c0-1.5-1.1-3.1-3.3-3.1z"/>
      <path d="M12 30.2c-3.4-5.2-4.2-10.2-.1-12.8 4-2.5 8.2-.6 10.6 4.3 2.4-4.9 6.6-6.8 10.6-4.3 4.1 2.6 3.3 7.6-.1 12.8z"/>
      <path d="M12 30.2c4.4-1.6 16.6-1.6 21 0l1 4.3H11z"/><path d="${CHP_BASE}"/><path class="dt" d="M12.6 32.4c4.2-1.2 15.6-1.2 19.8 0M22.5 22v8"/>`,
};
(() => {                                                       // (un seul jeu de symboles dans la page, réutilisé par toutes les cases)
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("aria-hidden", "true"); s.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  s.innerHTML = Object.entries(CHP).map(([k, d]) => `<symbol id="chp-${k}" viewBox="0 0 45 45">${d}</symbol>`).join("");
  (document.body || document.documentElement).appendChild(s);
})();
const chPiece = (p) => `<svg class="chp ${p === p.toUpperCase() ? "w" : "b"}" viewBox="0 0 45 45" aria-label="${p}"><use href="#chp-${p.toLowerCase()}"/></svg>`;

/* les thèmes */
const CH_THEMES = { wood: ["🪵 Bois", "#eeddc0", "#b4875f"], green: ["🌿 Vert", "#ebecd0", "#739552"], blue: ["🌊 Bleu", "#dee3e6", "#8ca2ad"], slate: ["🪨 Ardoise", "#c9ccd1", "#6b7280"] };
function chTheme() { const t = S.settings?.ch_theme; return CH_THEMES[t] ? t : "wood"; }
function chApplyTheme() {
  const r = document.getElementById("space-chess"); if (!r) return;
  const [, l, d] = CH_THEMES[chTheme()]; r.style.setProperty("--chl", l); r.style.setProperty("--chd", d); r.dataset.board = chTheme();
}

/* le roi en échec : sa case */
function chCheckSq(fen) {
  try { const c = new Chess(fen); if (!c.inCheck()) return null; const k = c.turn() === "w" ? "K" : "k";
    const rows = fen.split(" ")[0].split("/"); for (let r = 0; r < 8; r++) { let f = 0; for (const ch of rows[r]) { if (/\d/.test(ch)) f += +ch; else { if (ch === k) return "abcdefgh"[f] + (8 - r); f++; } } } } catch (_) {}
  return null;
}

/* l'échiquier. arrows : [{ from, to, kind: "best" | "bad" }] ; badge : { sq, k } (??, ?, ?!) */
function chBoard(fen, { flip = false, last = null, arrow = null, arrows = null, sel = null, targets = [], hint = null, id = "", badge = null, mini = false } = {}) {
  const rows = fen.split(" ")[0].split("/"), cells = [];
  for (let r = 0; r < 8; r++) { let f = 0; for (const ch of rows[r]) { if (/\d/.test(ch)) { for (let k = 0; k < +ch; k++) cells.push({ sq: "abcdefgh"[f++] + (8 - r), p: null }); } else cells.push({ sq: "abcdefgh"[f++] + (8 - r), p: ch }); } }
  const order = flip ? cells.slice().reverse() : cells, chk = chCheckSq(fen);
  const pos = (sq) => { const f = sq.charCodeAt(0) - 97, r = +sq[1] - 1; return flip ? { x: 7 - f, y: r } : { x: f, y: 7 - r }; };
  const list = arrows || (arrow ? [{ ...arrow, kind: "best" }] : []);
  const mk = `cha${id || Math.random().toString(36).slice(2, 7)}`;
  const arr = list.length ? `<svg class="ch-arrow" viewBox="0 0 8 8"><defs>${["best", "bad"].map((k) => `<marker id="${mk}${k}" markerWidth="3" markerHeight="3" refX="1.6" refY="1.5" orient="auto"><path class="${k}" d="M0,0 L3,1.5 L0,3 Z"/></marker>`).join("")}</defs>
      ${list.map((a) => { const p = pos(a.from), q = pos(a.to), dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1, sh = .28;
        return `<line class="${a.kind || "best"}" x1="${p.x + .5}" y1="${p.y + .5}" x2="${(q.x + .5 - dx / L * sh).toFixed(3)}" y2="${(q.y + .5 - dy / L * sh).toFixed(3)}" marker-end="url(#${mk}${a.kind || "best"})"/>`; }).join("")}</svg>` : "";
  const bk = { "??": "b", "?": "m", "?!": "i", "!": "g" };
  return `<div class="ch-board ${flip ? "flip" : ""} ${mini ? "mini" : ""}" ${id ? `id="${id}"` : ""}>${order.map((c, i) => { const fi = c.sq.charCodeAt(0) - 97, ri = +c.sq[1] - 1, dark = (fi + ri) % 2 === 0;
      const cls = [dark ? "d" : "l", last && (c.sq === last.from || c.sq === last.to) ? "last" : "", sel === c.sq ? "sel" : "", targets.includes(c.sq) ? (c.p ? "cap" : "tgt") : "", hint === c.sq ? "hintsq" : "", chk === c.sq ? "chk" : ""].join(" ");
      const col = i % 8 === 0 && !mini ? `<span class="ch-rk">${c.sq[1]}</span>` : "", row = i >= 56 && !mini ? `<span class="ch-fl">${c.sq[0]}</span>` : "";
      const bd = badge && badge.sq === c.sq && bk[badge.k] ? `<span class="ch-badge ${bk[badge.k]}">${esc(badge.k)}</span>` : "";
      return `<div class="ch-sq ${cls}" data-sq="${c.sq}">${col}${row}${c.p ? chPiece(c.p) : ""}${bd}</div>`; }).join("")}${arr}</div>`;
}

/* l'animation : la pièce arrivée sur « to » glisse depuis « from » (en avant comme en arrière) */
/* (v70) 🔊 les sons (facultatifs, réglage « Sons » de l'espace Échecs) : synthétisés, aucun fichier */
const CHS = { ctx: null };
function chSound(san) {
  if (!S.settings?.ch_sound || san == null) return;
  try {
    const ctx = CHS.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const kind = /[+#]/.test(san) ? "check" : /x/.test(san) ? "cap" : "move";
    const tone = (f, t0, d, g, type = "triangle") => { const o = ctx.createOscillator(), v = ctx.createGain(), t = ctx.currentTime + t0;
      o.type = type; o.frequency.value = f; v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(v).connect(ctx.destination); o.start(t); o.stop(t + d + 0.02); };
    if (kind === "move") tone(420, 0, 0.06, 0.16);
    else if (kind === "cap") { tone(250, 0, 0.09, 0.24, "square"); tone(170, 0.025, 0.1, 0.18); }
    else { tone(660, 0, 0.07, 0.16); tone(880, 0.08, 0.1, 0.15); }
    CHS.last = kind;
  } catch (_) {}
}
/** l'échiquier unifié (v70) : la barre d'évaluation (point de vue des blancs) à gauche de n'importe quel échiquier */
function chEvalBar(ev, flip) {
  const cp = ev == null ? null : ev.mate != null ? (ev.mate > 0 ? 10000 : -10000) : (typeof ev === "number" ? ev : ev.cp);
  const txt = ev == null ? "" : ev.mate != null ? `#${Math.abs(ev.mate)}` : Math.abs(cp) >= 9000 ? `#${Math.ceil((10000 - Math.abs(cp)) / 10)}` : (cp > 0 ? "+" : "") + (cp / 100).toFixed(1);
  return `<div class="ch-evbar ${flip ? "flip" : ""} ${cp != null && cp < 0 ? "neg" : ""}" title="Évaluation Stockfish (point de vue des blancs)"><span style="height:${cp == null ? 50 : chWp(cp)}%"></span><b>${txt}</b></div>`;
}
function chAnimate(board, from, to, san) {
  chSound(san);
  if (!board || !from || !to || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const a = board.querySelector(`[data-sq="${from}"]`), b = board.querySelector(`[data-sq="${to}"]`), pc = b?.querySelector(".chp"); if (!a || !pc) return;
  const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
  pc.style.transition = "none"; pc.style.transform = `translate(${ra.left - rb.left}px, ${ra.top - rb.top}px)`; pc.style.zIndex = 4;
  requestAnimationFrame(() => requestAnimationFrame(() => { pc.style.transition = "transform .18s ease-out"; pc.style.transform = ""; setTimeout(() => { pc.style.zIndex = ""; }, 200); }));
}

/* la courbe d'avantage : zone blanche (avantage blancs) / noire, tes fautes en points, clic = aller au coup */
function chEvalGraph(ev, ply, color, cls = []) {
  const W = 600, H = 120, n = ev.length, x = (i) => (i / Math.max(1, n - 1)) * W, y = (cp) => H - (chWp(cp) / 100) * H;
  const d = ev.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const dots = (cls || []).map((k, i) => k && (k === "??" || k === "?" || k === "?!") ? { k, i: i + 1, mine: (i % 2 === 0) === (CH.game?.moves?.[0]?.color === "w" ? color === "w" : color === "b") } : null).filter(Boolean);
  const kc = { "??": "b", "?": "m", "?!": "i" };
  return `<div class="ch-gwrap"><svg class="ch-graph" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" id="ch-graph">
      <path d="${d}L${W},${H}L0,${H}Z" class="wa"/><path d="${d}" class="ln"/><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" class="mid"/>
      <line x1="${x(ply)}" x2="${x(ply)}" y1="0" y2="${H}" class="cur"/></svg>
    ${dots.map((o) => `<span class="ch-gdot ${kc[o.k]} ${o.mine ? "me" : ""}" data-ply="${o.i}" style="left:${(100 * o.i / Math.max(1, n - 1)).toFixed(2)}%;top:${(100 * y(ev[o.i]) / H).toFixed(2)}%" title="${Math.ceil(o.i / 2)}. ${esc(CH.game?.moves?.[o.i - 1]?.san || "")} ${o.k}${o.mine ? " (toi)" : ""}"></span>`).join("")}
    <span class="ch-gcur" style="left:${(100 * ply / Math.max(1, n - 1)).toFixed(2)}%;top:${(100 * y(ev[ply] ?? 0) / H).toFixed(2)}%"></span></div>`;
}

/* un mini-échiquier pour un moment clé : la position avant ton coup, le coup joué (rouge) et le meilleur (vert) */
function chMiniKey(G, an, i) {
  const m = G.moves[i]; let best = null;
  try { if (an.best?.[i]) { const c = new Chess(m.before); const mv = c.move(an.best[i]); best = { from: mv.from, to: mv.to }; } } catch (_) {}
  return chBoard(m.before, { flip: CH.flip, mini: true, arrows: [{ from: m.from, to: m.to, kind: "bad" }, ...(best ? [{ ...best, kind: "best" }] : [])], id: "mk" + i });
}

/* 🍩 l'anneau victoires / nulles / défaites */
function chDonut(w, d, l) {
  const t = w + d + l || 1, R = 15.9155, seg = (v, off, cls) => v ? `<circle class="${cls}" r="${R}" cx="21" cy="21" stroke-dasharray="${(100 * v / t).toFixed(2)} ${(100 - 100 * v / t).toFixed(2)}" stroke-dashoffset="${(25 - off).toFixed(2)}"/>` : "";
  const pw = 100 * w / t, pd = 100 * d / t;
  return `<div class="ch-donut"><svg viewBox="0 0 42 42"><circle class="bg" r="${R}" cx="21" cy="21"/>${seg(w, 0, "W")}${seg(d, pw, "D")}${seg(l, pw + pd, "L")}</svg>
    <div class="ch-donut-c"><b>${Math.round((100 * (w + d / 2)) / t)} %</b><span class="muted small">score</span></div></div>
    <div class="ch-donut-k"><span><i class="W"></i>${w} victoire${w > 1 ? "s" : ""}</span><span><i class="D"></i>${d} nulle${d > 1 ? "s" : ""}</span><span><i class="L"></i>${l} défaite${l > 1 ? "s" : ""}</span></div>`;
}

/* 🗓 le calendrier : un carré par jour (26 semaines), plus foncé quand tu as beaucoup joué */
function chCalendar(games) {
  const day = (ts) => { const d = new Date(ts * 1000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const by = new Map(); for (const g of games) { const k = day(g.end); const x = by.get(k) || { n: 0, w: 0, d: 0, l: 0 }; x.n++; x[g.res === "W" ? "w" : g.res === "D" ? "d" : "l"]++; by.set(k, x); }
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - 7 * 25 - ((today.getDay() + 6) % 7));
  const mx = Math.max(1, ...[...by.values()].map((x) => x.n)), cols = [];
  let played = 0, days = 0;
  for (let w = 0; w < 26; w++) {
    const cells = [];
    for (let k = 0; k < 7; k++) {
      const d = new Date(start); d.setDate(start.getDate() + w * 7 + k);
      if (d > today) { cells.push('<i class="out"></i>'); continue; }
      const key = day(d.getTime() / 1000), x = by.get(key); days++; if (x) played++;
      const lv = x ? Math.min(4, Math.ceil((4 * x.n) / mx)) : 0;
      cells.push(`<i class="l${lv}" title="${d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} : ${x ? `${x.n} partie${x.n > 1 ? "s" : ""} (${x.w}V ${x.d}N ${x.l}D)` : "pas de partie"}"></i>`);
    }
    const first = new Date(start); first.setDate(start.getDate() + w * 7);
    cols.push(`<div class="ch-cal-col">${first.getDate() <= 7 ? `<span class="ch-cal-m">${first.toLocaleDateString("fr-FR", { month: "short" })}</span>` : '<span class="ch-cal-m"></span>'}${cells.join("")}</div>`);
  }
  return `<div class="ch-cal">${cols.join("")}</div><div class="muted small">Tu as joué ${played} jour${played > 1 ? "s" : ""} sur les ${days} derniers · <span class="ch-cal-key">moins <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> plus</span></div>`;
}

/* 🆚 les avatars Chess.com (chargés en direct, jamais copiés) : <span class="ch-ava" data-av="pseudo"> */
const CH_AV = new Map();
function chAva(name, cls = "") { return `<span class="ch-ava ${cls}" data-av="${esc(String(name || "").toLowerCase())}">${esc(initials(name || "?"))}</span>`; }
async function chFillAvatars(root) {
  const els = [...(root || document).querySelectorAll(".ch-ava[data-av]")]; if (!els.length) return;
  const need = [...new Set(els.map((e) => e.dataset.av))].filter((n) => !CH_AV.has(n));
  if (need.length) { try { const r = await api().chess_avatars(need); for (const n of need) CH_AV.set(n, r?.[n] || ""); } catch (_) {} }
  for (const e of els) { const u = CH_AV.get(e.dataset.av); if (u && !e.querySelector("img")) { const i = new Image(); i.referrerPolicy = "no-referrer"; i.alt = ""; i.onload = () => e.classList.add("has"); i.onerror = () => i.remove(); i.src = u; e.appendChild(i); } }
}
