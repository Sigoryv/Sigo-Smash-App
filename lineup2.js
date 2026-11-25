/* mobile/lineup2.js — v92 : la Line Up du téléphone à égalité avec le Hub.
   En plus de 🎭 Line up, 🧮 MU chart et 🏷 Tier lists : ⚖ Comparatif (deux persos, gabarit et coups clés, depuis la
   frame data envoyée par le Hub), 📊 Persos (tes games contre chaque perso adverse et avec chacun des tiens, ce qui
   est à travailler), 🗺 Stages (tes games par stage, et contre un perso) et 📒 Fiches MU (toutes tes fiches).
   Et 🎭 ta line up (main et secondaires) en tête de l'accueil. */
LU_SEGS.splice(2, 0, ["cmp", "⚖ Comparatif"], ["chars", "📊 Persos"], ["stages", "🗺 Stages"], ["fiches", "📒 Fiches MU"]);
const LU2_STATS = ["Weight", "Run Speed", "Initial Dash", "Walk Speed", "Air Speed", "Fall Speed / Fast Fall Speed", "Gravity", "Out of Shield", "Shield Grab"];
const LU2_NUM = ["Weight", "Run Speed", "Initial Dash", "Walk Speed", "Air Speed"];
const LU2_MOVES = ["Jab 1", "Forward Tilt", "Up Tilt", "Down Tilt", "Dash Attack", "Forward Smash", "Up Smash", "Down Smash", "Neutral Air", "Forward Air", "Back Air", "Up Air", "Down Air", "Grab", "Dash Grab", "Pivot Grab", "Spot Dodge"];
const lu2Pct = (w, l) => (w + l ? Math.round((100 * w) / (w + l)) : 0);
const lu2Bar = (w, l) => `<span class="lu2-bar"><i style="width:${lu2Pct(w, l)}%"></i></span>`;

function viewLuCompare() {
  if (!LUF.pages) { luFramesLoad().then(() => { if (D.tab === "mu" && D.luSeg === "cmp") render(); }); return '<div class="card muted">Lecture de la frame data…</div>'; }
  const mine = luMine(), C2 = D.luCmp || [];
  const a = C2[0] || mine[0]?.slug || "mario", b = C2[1] || mine[1]?.slug || (a === "mario" ? "luigi" : "mario");
  const G = luGames(), opt = (v) => `${mine.length ? `<optgroup label="Ma line up">${mine.map((m) => `<option value="${m.slug}" ${m.slug === v ? "selected" : ""}>${esc(luN(m.slug))}</option>`).join("")}</optgroup>` : ""}
    <optgroup label="Tout le roster">${LU_ROSTER.map(([s, n]) => `<option value="${s}" ${s === v && !mine.some((m) => m.slug === v) ? "selected" : ""}>${esc(n)}</option>`).join("")}</optgroup>`;
  const F = [a, b].map((s) => LUF.pages[luPages(s)[0]]);
  const head = [a, b].map((s, i) => { const r = luRec(G.filter((g) => g.me === s));
    return `<div class="lu2-ch">${luArt(s, "lu-a xl")}<select data-lu2-cmp="${i}">${opt(s)}</select><div class="muted small">${r.n ? `${wl(r.w, r.l)} · ${r.pct} %` : "aucune game"}</div></div>`; }).join("");
  if (F.some((f) => !f)) return `<div class="card"><div class="lu2-cmp-h">${head}</div></div><div class="card empty">Pas de frame data pour ${esc(luN(F[0] ? b : a))} sur ce téléphone.<br><span class="small">Dans le Hub : 🔎 Infos → « 📥 Tout le roster », puis ⟳ ici.</span></div>`;
  const stat = (f, k) => f.s.filter(([n]) => n.startsWith(k)).map(([n, v]) => k === "Out of Shield" ? n.replace("Out of Shield, ", "") + " : " + v : v).join("<br>");
  const num = (v) => parseFloat(String(v || "").replace(",", "."));
  const better = (x, y, low) => { const p = num(x), q = num(y); if (isNaN(p) || isNaN(q) || p === q) return ["", ""]; return (low ? p < q : p > q) ? ["w", ""] : ["", "w"]; };
  const mv = (f, n) => f.m.find((m) => String(m[1]).toLowerCase() === n.toLowerCase());
  const rowsS = LU2_STATS.map((k) => { const x = stat(F[0], k), y = stat(F[1], k); if (!x && !y) return "";
    const [cx, cy] = LU2_NUM.includes(k) ? better(x, y, false) : ["", ""];
    return `<tr><td class="muted">${esc(k)}</td><td class="${cx}">${x || "–"}</td><td class="${cy}">${y || "–"}</td></tr>`; }).join("");
  const rowsM = LU2_MOVES.map((n) => { const x = mv(F[0], n), y = mv(F[1], n); if (!x && !y) return "";
    const [sx, sy] = better(x?.[2], y?.[2], true), [ax, ay] = better(x?.[8], y?.[8], false);
    const cell = (m, cs, ca) => m ? `<b class="${cs}">${esc(m[2] || "–")}</b><span class="muted">f</span> · <b class="${ca}">${esc(m[8] || "–")}</b>` : "–";
    return `<tr><td class="muted">${esc(n)}</td><td>${cell(x, sx, ax)}</td><td>${cell(y, sy, ay)}</td></tr>`; }).join("");
  return `<div class="card"><div class="lu2-cmp-h">${head}</div></div>
    <div class="card lu2-t"><h3>📏 Gabarit et vitesses</h3><table>${rowsS}</table></div>
    <div class="card lu2-t"><h3>🥊 Coups clés <span class="muted small">startup · sur bouclier (en vert : le meilleur)</span></h3><table>${rowsM}</table></div>
    <div class="muted small" style="text-align:center">Frame data : Ultimate Frame Data (données de la communauté).</div>`;
}
function viewLuChars() {
  const st = stats(allSets());
  const work = st.opC.filter((r) => r.w + r.l >= 3 && r.l > r.w).sort((a, b) => (b.l - b.w) - (a.l - a.w)).slice(0, 5);
  const row = (r, mu) => { const s = luSlug(r.k);
    return `<div class="row" ${mu ? `data-mu="${esc(r.k)}"` : s ? `data-lact="open-char" data-slug="${s}"` : ""}>${s ? luArt(s) : ""}<div class="grow"><div><b>${esc(r.k)}</b>${mu && C.get("matchups", r.k) ? " 📒" : ""}</div><div class="muted small">${r.w + r.l} game(s)</div></div>
      <div style="text-align:right"><div class="small">${wl(r.w, r.l)} · ${lu2Pct(r.w, r.l)} %</div>${lu2Bar(r.w, r.l)}</div></div>`; };
  return `${work.length ? `<div class="card"><h3>🎯 À travailler <span class="muted small">les persos qui te battent le plus</span></h3>${work.map((r) => row(r, true)).join("")}</div>` : ""}
    <div class="card"><h3>Contre (perso adverse)</h3>${st.opC.map((r) => row(r, true)).join("") || '<div class="muted small">Aucune game renseignée.</div>'}</div>
    <div class="card"><h3>Avec (tes persos)</h3>${st.myC.map((r) => row(r, false)).join("") || '<div class="muted small">Aucune game renseignée.</div>'}</div>`;
}
function viewLuStages() {
  const opp = D.luStOpp || "", M = new Map(), chars = new Set();
  for (const s of allSets()) { if (s.dq) continue; for (const g of games(s)) { if (!g.stage || g.win == null) continue; const c = charName(g.opp); if (c) chars.add(c);
    if (opp && c !== opp) continue; const x = M.get(g.stage) || { k: g.stage, w: 0, l: 0 }; g.win ? x.w++ : x.l++; M.set(g.stage, x); } }
  const rows = [...M.values()].sort((a, b) => (b.w + b.l) - (a.w + a.l));
  return `<div class="card"><label class="small muted">Contre</label><select data-lu2-stopp><option value="">(tous les persos)</option>${[...chars].sort().map((c) => `<option ${c === opp ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
    <div class="card">${rows.map((r) => `<div class="row"><div class="grow"><b>${esc(r.k)}</b><div class="muted small">${r.w + r.l} game(s)</div></div><div style="text-align:right"><div class="small">${wl(r.w, r.l)} · ${lu2Pct(r.w, r.l)} %</div>${lu2Bar(r.w, r.l)}</div></div>`).join("")
      || '<div class="muted small">Pas encore de stage renseigné dans tes games (📓 Carnet du Hub).</div>'}</div>`;
}
function viewLuFiches() {
  const L0 = C.section("matchups").filter(([, v]) => v && String(v).trim()).sort((a, b) => a[0].localeCompare(b[0])), st = stats(allSets());
  return `<div class="card">${L0.map(([k, v]) => { const r = st.opC.find((x) => x.k === k), s = luSlug(k);
      return `<div class="row" data-mu="${esc(k)}">${s ? luArt(s) : ""}<div class="grow"><div><b>${esc(k)}</b> <span class="small">${r ? wl(r.w, r.l) : ""}</span></div><div class="muted small">${esc(String(v).replace(/\s+/g, " ").slice(0, 90))}</div></div>›</div>`; }).join("")
    || '<div class="muted small">Pas encore de fiche MU. Ouvre un perso dans 📊 Persos pour en écrire une.</div>'}</div>`;
}
/* 🗂 v163 : 6 boutons comme sur le Hub (Matchups et Mes persos ont une 2e rangée) */
const LU_GROUPS = [["mine", "🎭 Line up", [["mine", "Line up"]]], ["mu", "🧮 Matchups", [["chart", "🧮 MU chart"], ["fiches", "📒 Fiches MU"]]],
  ["persos", "📊 Mes persos", [["chars", "📊 Stats"], ["cmp", "⚖ Comparatif"]]], ["stages", "🗺 Stages", [["stages", "Stages"]]],
  ["infos", "🔎 Infos", [["infos", "Infos"]]], ["tiers", "🏷 Tiers", [["tiers", "Tier lists"]]]];
viewLineupAll = function () {
  const seg = D.luSeg || "mine", grp = LU_GROUPS.find((g) => g[2].some(([k]) => k === seg)) || LU_GROUPS[0];
  D.luLast ||= {}; D.luLast[grp[0]] = seg;
  const head = `<div class="seg lu2-seg">${LU_GROUPS.map(([g, n, subs]) => `<button class="${g === grp[0] ? "on" : ""}" data-lact="seg" data-grp="${g}" data-k="${D.luLast[g] || subs[0][0]}">${n}</button>`).join("")}</div>`
    + (grp[2].length > 1 ? `<div class="seg lu-sub">${grp[2].map(([k, n]) => `<button class="${seg === k ? "on" : ""}" data-lact="seg" data-k="${k}">${n}</button>`).join("")}</div>` : "");
  const body = { chart: viewMuChart, tiers: viewTierLists, cmp: viewLuCompare, chars: viewLuChars, stages: viewLuStages, fiches: viewLuFiches, infos: viewInfos }[seg] || viewLineupV63;
  return head + body();
};
TABS.mu = viewLineupAll;
document.addEventListener("change", (e) => {
  const c = e.target.closest("[data-lu2-cmp]"); if (c) { const v = D.luCmp || [luMine()[0]?.slug || "mario", luMine()[1]?.slug || "luigi"]; v[+c.dataset.lu2Cmp] = c.value; D.luCmp = v; save(); return render(); }
  if (e.target.matches("[data-lu2-stopp]")) { D.luStOpp = e.target.value; save(); render(); }
});

/* ------------------------------------------------------------ 🎭 ta line up en tête de l'accueil */
const viewHomeLu0 = viewHome;
viewHome = function () {
  const mine = luMine().filter((m) => m.cat === "main" || m.cat === "second"), G = luGames();
  const lu = mine.length ? `<div class="card lu2-home"><div class="lu2-hh"><b>🎭 Ma line up</b><a href="#" data-lu2-go class="small">voir tout ›</a></div><div class="lu2-hl">${mine.map((m) => { const r = luRec(G.filter((g) => g.me === m.slug));
      return `<button class="lu2-hc ${m.cat}" data-lact="open-char" data-slug="${m.slug}">${luArt(m.slug, "lu-a xl")}<b>${esc(luN(m.slug))}</b><span class="muted small">${m.cat === "main" ? "⭐ Main" : "🥈 Second"}${r.n ? ` · ${r.pct} %` : ""}</span></button>`; }).join("")}</div></div>` : "";
  const h = viewHomeLu0(), i = h.indexOf('<div class="kpis">');
  return i >= 0 ? h.slice(0, i) + lu + h.slice(i) : lu + h;
};
TABS.home = viewHome;
document.addEventListener("click", (e) => { if (e.target.closest("[data-lu2-go]")) { e.preventDefault(); D.tab = "mu"; D.luSeg = "mine"; save(); render(); } });
