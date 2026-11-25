/* =====================================================================
   scene.js — 🏅🎬 v156 : le classement local et les VODs sur le téléphone.
   Le Hub calcule (classement : Elo et points par région / ville / période ; VODs : ses chaînes YouTube, titres lus)
   et dépose scene.enc.json, chiffré, dans le dépôt de la synchro ; le téléphone le relit quand il change.
   Sans réseau : tout est gardé sur le téléphone. Relier une VOD à un set passe par le carnet (synchronisé).
   ===================================================================== */
let SCENE = null;
const SC = { period: "6m", scope: "", kind: "elo", min: 3, q: "", c1: "", c2: "" };
async function sceneLoad() {
  if (SCENE) return SCENE;
  try {
    if (self.caches) { const r = await (await caches.open("sigo-scene")).match("scene.json"); SCENE = r ? await r.json() : null; }
    else SCENE = JSON.parse(localStorage.getItem("sigo.scene") || "null");
  } catch (_) { SCENE = null; }
  return SCENE;
}
/** à la synchro : scene.enc.json, seulement si son empreinte a changé */
async function sceneSync(s) {
  const f = s?.scene; if (!f || !f.hash) return;
  if (localStorage.getItem("sigo.scene.hash") === f.hash && await sceneLoad()) return;
  const g = await ghGet("scene.enc.json"); if (!g.obj) return;
  const d = await decrypt(g.obj), body = JSON.stringify(d);
  if (self.caches) await (await caches.open("sigo-scene")).put("scene.json", new Response(body, { headers: { "Content-Type": "application/json" } }));
  else localStorage.setItem("sigo.scene", body);
  localStorage.setItem("sigo.scene.hash", f.hash); SCENE = d;
}
const scSlug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
function scCharName(sl) { const k = scSlug(sl); return Object.values(D.chars || {}).find((n) => scSlug(n) === k || scSlug(n).startsWith(k)) || sl.replace(/[-_]/g, " "); }
const scChars = (l) => (l || []).map((sl) => ci(scCharName(sl), "xs")).join("");
const scTag = (n) => key(String(n || "").split("|").pop()).replace(/[^a-z0-9]+/g, " ").trim();
const scH2H = (w, l) => w + l ? `<span class="${w > l ? "pos" : w < l ? "neg" : ""}">${w}-${l}</span>` : '<span class="muted">—</span>';

/* ------------------------------------------------------------ 🏅 le classement local */
async function sheetRank() {
  const me = () => sheetRank(); if (CUR && CUR !== me) BACK = CUR; CUR = me;
  const S = await sceneLoad(), R = S?.rank;
  if (!R) { sheet(`<h2>🏅 Classement local</h2><div class="card muted">Le classement se calcule sur le Hub (Smash → Adversaires → Classement local : 📥 lire les tournois de la région), puis la synchro l'apporte ici.</div><div class="btns">${closeBtn()}</div>`); return; }
  const rows0 = R.tables[`${SC.period}|${SC.scope}`] || [], nT = R.tables[`${SC.period}|${SC.scope}#n`] || 0, myId = String(D.player?.id || "");
  const elo = SC.kind === "elo";
  const rows = rows0.map((r) => ({ pid: r[0], name: r[1], city: r[2], elo: r[3], trend: r[4], pts: r[5], w: r[6], l: r[7], tours: r[8], best: r[9], hw: r[10], hl: r[11], me: r[0] === myId }))
    .filter((x) => x.tours >= SC.min || x.me).sort((a, b) => elo ? b.elo - a.elo || b.w + b.l - (a.w + a.l) : b.pts - a.pts || b.elo - a.elo);
  let n = 0; rows.forEach((x) => { x.rank = x.tours >= SC.min ? ++n : null; });
  const mine = rows.find((x) => x.me), above = mine?.rank ? rows.filter((x) => x.rank && x.rank < mine.rank).slice(-3) : [];
  const P = [["3m", "3 mois"], ["6m", "6 mois"], ["12m", "12 mois"], ["year", "Cette année"]];
  sheet(`<h2>🏅 Classement local</h2>
    <div class="seg sc-scroll">${["", ...R.cities].map((c) => `<button class="${SC.scope === c ? "on" : ""}" data-act="sc-scope" data-v="${esc(c)}">${esc(c || R.region)}</button>`).join("")}</div>
    <div class="sc-ctl"><div class="seg"><button class="${elo ? "on" : ""}" data-act="sc-kind" data-v="elo">📈 Elo</button><button class="${elo ? "" : "on"}" data-act="sc-kind" data-v="points">🏆 Points</button></div>
      <select id="sc-period">${P.map(([k, l]) => `<option value="${k}" ${SC.period === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select id="sc-min">${[1, 2, 3, 5].map((v) => `<option value="${v}" ${SC.min === v ? "selected" : ""}>≥ ${v} tournoi${v > 1 ? "s" : ""}</option>`).join("")}</select></div>
    ${mine ? `<div class="card sc-me"><div class="muted small">Toi${SC.scope ? " à " + esc(SC.scope) : " en " + esc(R.region)}</div><div class="big">${mine.rank ? "#" + mine.rank : "—"} <span class="muted small">sur ${n}</span></div>
      <div class="small">${elo ? `${mine.elo} Elo${mine.trend ? ` <span class="${mine.trend > 0 ? "pos" : "neg"}">${mine.trend > 0 ? "▲ +" : "▼ "}${mine.trend}</span>` : ""}` : `${mine.pts} pts`} · ${mine.w}-${mine.l} · ${mine.tours} tournoi${mine.tours > 1 ? "s" : ""}</div>
      ${above.length ? `<div class="muted small" style="margin-top:8px">⬆ Juste au-dessus de toi</div>${above.map((x) => `<div class="row" ${/^\d+$/.test(x.pid) ? `data-scout="${esc(x.pid)}" data-name="${esc(x.name)}"` : ""}><b class="grow">#${x.rank} ${esc(x.name)}</b><span class="muted small">${elo ? `+${x.elo - mine.elo}` : `+${x.pts - mine.pts} pts`}</span> <span class="small">toi ${scH2H(x.hw, x.hl)}</span></div>`).join("")}` : ""}</div>` : ""}
    <div class="muted small" style="margin:6px 2px">${nT} tournoi${nT > 1 ? "s" : ""} · ${n} classés · calculé par le Hub ${fmtDate(new Date((R.at || 0) * 1000).toISOString())}</div>
    <div class="card">${rows.slice(0, 150).map((x) => `<div class="row sc-r ${x.me ? "me" : ""}" ${/^\d+$/.test(x.pid) && !x.me ? `data-scout="${esc(x.pid)}" data-name="${esc(x.name)}"` : ""}>
      <span class="sc-n">${x.rank || "—"}</span><div class="grow"><b>${esc(x.name)}</b><div class="muted small">${esc(x.city || "—")} · ${x.w}-${x.l} · ${x.tours} t.${x.me ? "" : " · toi " + scH2H(x.hw, x.hl)}</div></div>
      <span class="sc-v"><b>${elo ? x.elo : x.pts}</b>${elo && x.trend ? `<br><span class="small ${x.trend > 0 ? "pos" : "neg"}">${x.trend > 0 ? "+" : ""}${x.trend}</span>` : elo ? "" : `<br><span class="small muted">${x.best ? ordinal(x.best) : ""}</span>`}</span></div>`).join("") || '<div class="empty">Personne sur cette période.</div>'}</div>
    <div class="btns">${closeBtn()}</div>`, true);
  $("#sc-period").onchange = (e) => { SC.period = e.target.value; SHEET_KEEP = true; sheetRank(); };
  $("#sc-min").onchange = (e) => { SC.min = +e.target.value; SHEET_KEEP = true; sheetRank(); };
}

/* ------------------------------------------------------------ 🎬 les VODs */
function scVods() {
  const V = SCENE?.vods; if (!V) return [];
  return V.list.map((r) => { const [vid, t] = String(r[0]).split("@");          // (📑 v160 : « vid@754 » = un set d'un stream, à 754 s)
    return { id: vid, key: r[0], start: t ? +t : 0, title: r[1], ch: V.channels[r[2]] || "", at: r[3], p1: r[4], c1: r[5], p2: r[6], c2: r[7], round: r[8], event: r[9],
             url: "https://www.youtube.com/watch?v=" + vid + (t ? `&t=${t}s` : "") }; });
}
function scVodRow(v, extra = "") {
  return `<a class="row sc-v-row" href="${esc(v.url)}" target="_blank" rel="noopener"><img class="sc-th" src="https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg" loading="lazy" referrerpolicy="no-referrer" alt="">
    <div class="grow"><div class="small"><b>${esc(v.title)}</b></div><div class="muted small">${esc(v.ch)} · ${esc(v.at.split("-").reverse().join("/"))}${v.start ? ` · 📑 à ${Math.floor(v.start / 3600) ? Math.floor(v.start / 3600) + ":" : ""}${String(Math.floor(v.start / 60) % 60).padStart(Math.floor(v.start / 3600) ? 2 : 1, "0")}:${String(v.start % 60).padStart(2, "0")}` : ""}</div>
    ${v.p1 ? `<div class="small">${esc(v.p1)} ${scChars(v.c1)} <span class="muted">vs</span> ${esc(v.p2)} ${scChars(v.c2)}${v.round ? ` <span class="chip">${esc(v.round)}</span>` : ""}</div>` : ""}${extra}</div></a>`;
}
async function sheetVods(q) {
  const me = () => sheetVods(); if (CUR && CUR !== me) BACK = CUR; CUR = me;
  if (q != null) { SC.q = q; SC.c1 = SC.c2 = ""; }
  const S = await sceneLoad();
  if (!S?.vods) { sheet(`<h2>🎬 VODs</h2><div class="card muted">Les VODs viennent des chaînes YouTube réglées sur le Hub (Smash → Carnet → VODs), puis la synchro les apporte ici.</div><div class="btns">${closeBtn()}</div>`); return; }
  const all = scVods(), words = key(SC.q).split(/\s+/).filter(Boolean), c1 = scSlug(SC.c1), c2 = scSlug(SC.c2);
  const has = (l, c) => !c || (l || []).some((x) => scSlug(x) === c || scSlug(scCharName(x)) === c);
  const res = all.filter((v) => (!words.length || words.every((w) => key(v.title).includes(w))) && (!c1 && !c2 || v.p1 && ((has(v.c1, c1) && has(v.c2, c2)) || (has(v.c2, c1) && has(v.c1, c2)))));
  const mine = (S.vods.mine || []).filter(([sid]) => !(C.get("vods", sid) || {}).url).map(([sid, vid, sure]) => ({ s: allSets().find((x) => String(x.id) === String(sid)), v: all.find((x) => x.key === vid), sure })).filter((m) => m.s && m.v);
  const names = [...new Set(Object.values(D.chars || {}))].sort((a, b) => a.localeCompare(b));
  const opt = (v) => `<option value="">perso…</option>${names.map((n) => `<option ${v === n ? "selected" : ""}>${esc(n)}</option>`).join("")}`;
  sheet(`<h2>🎬 VODs</h2>
    ${mine.length ? `<div class="card"><h3>🎯 Tes sets filmés</h3>${mine.slice(0, 20).map((m) => `<div class="sc-mine"><div class="small">${m.sure ? "✅" : "❔"} <b>${esc(m.s.opp)}</b> ${esc((m.s.score || []).join("-"))} · <span class="muted">${esc(m.s.tournament || "")}</span></div>
      ${scVodRow(m.v)}<button class="btn small" data-act="sc-link" data-id="${esc(m.s.id)}" data-url="${esc(m.v.url)}">🔗 Lier à ce set</button></div>`).join("")}<div class="muted small">« ✕ Pas ce set » : sur le Hub.</div></div>` : ""}
    <input type="search" id="sc-q" placeholder="Un joueur, un tournoi, des mots du titre…" value="${esc(SC.q)}">
    <div class="sc-ctl"><select id="sc-c1">${opt(SC.c1)}</select><span class="muted small">contre</span><select id="sc-c2">${opt(SC.c2)}</select></div>
    <div class="muted small" style="margin:6px 2px">${res.length} vidéo${res.length > 1 ? "s" : ""}${res.length > 60 ? " · les 60 premières" : ""}</div>
    <div class="card">${res.slice(0, 60).map((v) => scVodRow(v)).join("") || '<div class="empty">Rien.</div>'}</div><div class="btns">${closeBtn()}</div>`, true);
  const go = () => { SC.q = $("#sc-q").value.trim(); SC.c1 = $("#sc-c1").value; SC.c2 = $("#sc-c2").value; SHEET_KEEP = true; sheetVods(); };
  $("#sc-q").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } };
  $("#sc-c1").onchange = $("#sc-c2").onchange = go;
}
/* 🗺 dans le plan de match : ses VODs (son perso contre un des tiens d'abord) */
function scVodsFor(name, his = [], mine = []) {
  const t = scTag(name); if (!t || !SCENE?.vods) return "";
  const H = his.map(scSlug), M = mine.map(scSlug);
  const hit = (l, S) => (l || []).some((x) => S.includes(scSlug(x)) || S.includes(scSlug(scCharName(x))));
  const res = scVods().filter((v) => v.p1 && (scTag(v.p1) === t || scTag(v.p2) === t)).map((v) => {
    const a = scTag(v.p1) === t, hc = a ? v.c1 : v.c2, oc = a ? v.c2 : v.c1;
    return { ...v, hc, oc, vs: a ? v.p2 : v.p1, mu: hit(hc, H) && hit(oc, M), s: (hit(hc, H) ? 2 : 0) + (hit(oc, M) ? 1 : 0) };
  }).sort((a, b) => b.s - a.s || b.at.localeCompare(a.at));
  if (!res.length) return "";
  return `<div class="card"><h3>🎬 Ses VODs <span class="muted small">${res.length}</span></h3>${res.slice(0, 6).map((v) => `<a class="row" href="${esc(v.url)}" target="_blank" rel="noopener"><span>${v.mu ? "⚔" : "▶"}</span><div class="grow small">${scChars(v.hc)} vs <b>${esc(v.vs)}</b> ${scChars(v.oc)}<div class="muted">${esc(v.round || "")} · ${esc(v.event || v.ch)} · ${esc(v.at.split("-").reverse().join("/"))}</div></div></a>`).join("")}
    ${res.length > 6 ? `<button class="btn small" data-act="sc-vods" data-q="${esc(name.split("|").pop().trim())}">Tout voir (${res.length}) →</button>` : ""}</div>`;
}
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const a = el.dataset.act;
  if (a === "sc-rank") return sheetRank();
  if (a === "sc-vods") { if (BACK === null && CUR) BACK = CUR; CUR = null; return sheetVods(el.dataset.q != null ? el.dataset.q : null); }
  if (a === "sc-scope") { SC.scope = el.dataset.v; SHEET_KEEP = true; return sheetRank(); }
  if (a === "sc-kind") { SC.kind = el.dataset.v; SHEET_KEEP = true; return sheetRank(); }
  if (a === "sc-link") { const was = C.get("vods", el.dataset.id) || { marks: [] }; C.set("vods", el.dataset.id, { url: el.dataset.url, marks: was.marks || [] }); toast("🔗 VOD reliée (synchronisée avec le Hub)."); SHEET_KEEP = true; return sheetVods(); }
});
