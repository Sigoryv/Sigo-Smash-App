/* mobile/lineup.js — 🎭 LA LINE UP dans la poche (v63 ; v64 : les persos en apprentissage ne sont pas conseillés)
   Tes persos (Main, Secondaire, Pocket, En apprentissage), « Contre qui ? » pour choisir ton perso le jour J,
   la fiche d'un perso (tes games, ta note, ta MU chart à éditer) et les fiches MU. Tout vit dans le carnet
   (sections lineup, mu_rate), synchronisé avec le Hub. Les portraits viennent d'Ultimate Frame Data (en direct). */
const LU_ROSTER = [["mario", "Mario", "mario"], ["donkey-kong", "Donkey Kong", "donkey_kong"], ["link", "Link", "link"], ["samus", "Samus", "samus"], ["dark-samus", "Dark Samus", "dark_samus"], ["yoshi", "Yoshi", "yoshi"], ["kirby", "Kirby", "kirby"], ["fox", "Fox", "fox"], ["pikachu", "Pikachu", "pikachu"], ["luigi", "Luigi", "luigi"], ["ness", "Ness", "ness"], ["captain-falcon", "Captain Falcon", "captain_falcon"], ["jigglypuff", "Jigglypuff", "jigglypuff"], ["peach", "Peach", "peach"], ["daisy", "Daisy", "daisy"], ["bowser", "Bowser", "bowser"], ["ice-climbers", "Ice Climbers", "ice_climbers"], ["sheik", "Sheik", "sheik"], ["zelda", "Zelda", "zelda"], ["dr-mario", "Dr. Mario", "dr_mario"], ["pichu", "Pichu", "pichu"], ["falco", "Falco", "falco"], ["marth", "Marth", "marth"], ["lucina", "Lucina", "lucina"], ["young-link", "Young Link", "young_link"], ["ganondorf", "Ganondorf", "ganondorf"], ["mewtwo", "Mewtwo", "mewtwo"], ["roy", "Roy", "roy"], ["chrom", "Chrom", "chrom"], ["mr-game-and-watch", "Mr. Game & Watch", "mr_game_and_watch"], ["meta-knight", "Meta Knight", "meta_knight"], ["pit", "Pit", "pit"], ["dark-pit", "Dark Pit", "dark_pit"], ["zero-suit-samus", "Zero Suit Samus", "zero_suit_samus"], ["wario", "Wario", "wario"], ["snake", "Snake", "snake"], ["ike", "Ike", "ike"], ["pokemon-trainer", "Pokémon Trainer", "pt_squirtle"], ["diddy-kong", "Diddy Kong", "diddy_kong"], ["lucas", "Lucas", "lucas"], ["sonic", "Sonic", "sonic"], ["king-dedede", "King Dedede", "king_dedede"], ["olimar", "Olimar", "olimar"], ["lucario", "Lucario", "lucario"], ["rob", "R.O.B.", "rob"], ["toon-link", "Toon Link", "toon_link"], ["wolf", "Wolf", "wolf"], ["villager", "Villager", "villager"], ["mega-man", "Mega Man", "mega_man"], ["wii-fit-trainer", "Wii Fit Trainer", "wii_fit_trainer"], ["rosalina-and-luma", "Rosalina & Luma", "rosalina_and_luma"], ["little-mac", "Little Mac", "little_mac"], ["greninja", "Greninja", "greninja"], ["mii-brawler", "Mii Brawler", "mii_brawler"], ["mii-swordfighter", "Mii Swordfighter", "mii_swordfighter"], ["mii-gunner", "Mii Gunner", "mii_gunner"], ["palutena", "Palutena", "palutena"], ["pac-man", "Pac-Man", "pac_man"], ["robin", "Robin", "robin"], ["shulk", "Shulk", "shulk"], ["bowser-jr", "Bowser Jr.", "bowser_jr"], ["duck-hunt", "Duck Hunt", "duck_hunt"], ["ryu", "Ryu", "ryu"], ["ken", "Ken", "ken"], ["cloud", "Cloud", "cloud"], ["corrin", "Corrin", "corrin"], ["bayonetta", "Bayonetta", "bayonetta"], ["inkling", "Inkling", "inkling"], ["ridley", "Ridley", "ridley"], ["simon", "Simon", "simon"], ["richter", "Richter", "richter"], ["king-k-rool", "King K. Rool", "king_k_rool"], ["isabelle", "Isabelle", "isabelle"], ["incineroar", "Incineroar", "incineroar"], ["piranha-plant", "Piranha Plant", "piranha_plant"], ["joker", "Joker", "joker"], ["hero", "Hero", "hero"], ["banjo-and-kazooie", "Banjo & Kazooie", "banjo_and_kazooie"], ["terry", "Terry", "terry"], ["byleth", "Byleth", "byleth"], ["min-min", "Min Min", "minmin"], ["steve", "Steve", "steve"], ["sephiroth", "Sephiroth", "sephiroth"], ["pyra-mythra", "Pyra/Mythra", "pyra"], ["kazuya", "Kazuya", "kazuya"], ["sora", "Sora", "sora"]];
const LU_ALIASES = {"rosalina": "rosalina-and-luma", "pyra": "pyra-mythra", "mythra": "pyra-mythra", "squirtle": "pokemon-trainer", "ivysaur": "pokemon-trainer", "charizard": "pokemon-trainer", "pt": "pokemon-trainer", "alph": "olimar", "gamewatch": "mr-game-and-watch", "gnw": "mr-game-and-watch", "gw": "mr-game-and-watch", "zss": "zero-suit-samus", "dk": "donkey-kong", "ddd": "king-dedede", "dedede": "king-dedede", "krool": "king-k-rool", "kkr": "king-k-rool", "falcon": "captain-falcon", "drmario": "dr-mario", "doc": "dr-mario", "bowserjr": "bowser-jr", "rob": "rob", "wft": "wii-fit-trainer", "banjo": "banjo-and-kazooie", "pacman": "pac-man", "minmin": "min-min", "plant": "piranha-plant", "megaman": "mega-man", "littlemac": "little-mac", "mac": "little-mac", "ics": "ice-climbers", "icies": "ice-climbers", "yink": "young-link", "ylink": "young-link", "tink": "toon-link", "mk": "meta-knight", "duckhunt": "duck-hunt", "dh": "duck-hunt", "sonic": "sonic", "brawler": "mii-brawler", "swordfighter": "mii-swordfighter", "gunner": "mii-gunner", "pkmntrainer": "pokemon-trainer"};
const LU_CATS = [["main", "⭐", "Main"], ["second", "🥈", "Secondaire"], ["pocket", "🎒", "Pocket"], ["learn", "🌱", "En apprentissage"]];
const LU_TIERS = [[2, "Très favorable"], [1, "Favorable"], [0, "Équilibré"], [-1, "Difficile"], [-2, "Très dur"]];
const UFD_ART = "https://ultimateframedata.com/characterart/";
const luNorm = (s) => String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[&+/]| and /g, " ").replace(/[^a-z0-9]/g, "");
const LU_BY = new Map(LU_ROSTER.flatMap(([s, n]) => [[luNorm(n), s], [luNorm(s), s]]));
const luR = (slug) => LU_ROSTER.find((r) => r[0] === slug);
const luN = (slug) => luR(slug)?.[1] || slug;
function luSlug(name) { const s = String(name || "").trim().toLowerCase(); if (luR(s)) return s; const n = luNorm(name); return LU_BY.get(n) || LU_ALIASES[n] || ""; }
function luArt(slug, cls = "lu-a") {
  const r = luR(slug); if (!r) return "";
  return `<span class="${cls}" title="${esc(r[1])}"><img src="${UFD_ART}${r[2]}.webp" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"><i>${esc(ini(r[1]))}</i></span>`;
}
function luMine() {
  const ci = { main: 0, second: 1, pocket: 2, learn: 3 };
  return C.section("lineup").filter(([s, v]) => luR(s) && v && ci[v.cat] != null).map(([slug, v]) => ({ slug, ...v })).sort((a, b) => ci[a.cat] - ci[b.cat] || (a.ord || 0) - (b.ord || 0));
}
function luGames() {
  const out = [];
  for (const s of allSets()) { if (s.dq) continue; for (const g of games(s)) { if (g.win == null) continue; out.push({ me: luSlug(charName(g.me)), opp: luSlug(charName(g.opp)), win: !!g.win }); } }
  return out;
}
const luRec = (l) => { const w = l.filter((g) => g.win).length; return { w, l: l.length - w, n: l.length, pct: l.length ? Math.round(100 * w / l.length) : 0 }; };
const luRate = (a, b) => C.get("mu_rate", `${a}|${b}`);
function luScore(mine, opp, G) {
  const r = luRate(mine, opp); if (r != null) return { v: r, src: "ta note" };
  const x = luRec(G.filter((g) => g.me === mine && g.opp === opp)); if (x.n < 3) return null;
  return { v: Math.max(-2, Math.min(2, Math.round((x.pct - 50) / 20))), src: `${x.w}-${x.l} en games` };
}
const luSign = (v) => v > 0 ? "+" + v : String(v);
const luCls = (v) => v == null ? "na" : v >= 1 ? "good" : v <= -1 ? "bad" : "even";

/* ------------------------------------------------------------ l'onglet */
function viewLineup() {
  const mine = luMine(), G = luGames(), opp = D.luOpp || "";
  let pick = "";
  if (opp && luR(opp)) {
    const rows = mine.filter((m) => m.cat !== "learn").map((m) => ({ m, sc: luScore(m.slug, opp, G), rec: luRec(G.filter((g) => g.me === m.slug && g.opp === opp)) }))
      .sort((a, b) => (b.sc?.v ?? -9) - (a.sc?.v ?? -9) || b.rec.pct - a.rec.pct);
    pick = `<div class="lu-vs">${luArt(opp, "lu-a lg")}<div class="grow"><div class="muted small">Contre</div><b>${esc(luN(opp))}</b>
        ${C.get("matchups", luN(opp)) ? `<div class="small muted lu-mu-peek">📒 ${esc(C.get("matchups", luN(opp)).slice(0, 90))}</div>` : ""}</div>
        <button class="btn" data-mu="${esc(luN(opp))}">📒 Fiche</button></div>
      ${rows.map(({ m, sc, rec }, i) => `<div class="row" data-lch="${m.slug}">${luArt(m.slug)}<div class="grow"><div><b>${esc(luN(m.slug))}</b>${i === 0 && sc && sc.v >= 0 ? ' <span class="chip ok">conseillé</span>' : ""}</div>
        <div class="muted small">${sc ? `${luSign(sc.v)} · ${esc(sc.src)}` : "pas d'info"}${rec.n && sc?.src === "ta note" ? ` · ${rec.w}-${rec.l} en games` : ""}</div></div><span class="lu-dot ${luCls(sc?.v)}"></span></div>`).join("") || '<div class="empty">Ajoute d\'abord tes persos (＋ ci-dessous).</div>'}`;
  }
  return `<div class="card"><h3>🎯 Contre qui ?</h3><select id="lu-opp"><option value="">— le perso de ton adversaire —</option>${[...LU_ROSTER].sort((a, b) => a[1].localeCompare(b[1])).map(([s, n]) => `<option value="${s}" ${s === opp ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>${pick}</div>
    <div class="card"><div class="lu-h"><h3 style="margin:0">🎭 Ma line up</h3><button class="btn" data-lact="add">＋ Perso</button></div>
      ${LU_CATS.map(([c, ico, n]) => { const l = mine.filter((m) => m.cat === c); if (!l.length) return "";
        return `<div class="muted small lu-cat-h">${ico} ${n}</div><div class="lu-strip">${l.map((m) => { const r = luRec(G.filter((g) => g.me === m.slug));
          return `<button class="lu-tile" data-lch="${m.slug}">${luArt(m.slug, "lu-a tile")}<b>${esc(luN(m.slug))}</b><span class="small">${r.n ? `${wl(r.w, r.l)}` : '<span class="muted">–</span>'}</span></button>`; }).join("")}</div>`; }).join("")
        || '<div class="empty">Ta line up est vide : ＋ Perso, ou range-les depuis le Hub.</div>'}</div>
    <h2>📒 Fiches MU</h2>${viewMatchups()}`;
}

/* ------------------------------------------------------------ les fiches */
function sheetLuChar(slug) {
  const G = luGames(), mineG = G.filter((g) => g.me === slug), rec = luRec(mineG), lu = C.get("lineup", slug) || {};
  const opps = [...new Set([...mineG.map((g) => g.opp).filter(Boolean), ...C.section("mu_rate").map(([k]) => k.split("|")).filter(([a]) => a === slug).map(([, b]) => b)])];
  const rows = opps.map((o) => ({ o, rec: luRec(mineG.filter((g) => g.opp === o)), v: luRate(slug, o) })).sort((a, b) => (b.v ?? -9) - (a.v ?? -9) || b.rec.n - a.rec.n);
  sheet(`<div class="lu-head">${luArt(slug, "lu-a xl")}<div class="grow"><h2 style="margin:0">${esc(luN(slug))}</h2>
      <div class="small">${rec.n ? `${wl(rec.w, rec.l)} en games · ${rec.pct} %` : '<span class="muted">aucune game renseignée</span>'}</div>
      <select id="lu-cat" data-slug="${slug}"><option value="">— pas dans ma line up —</option>${LU_CATS.map(([c, ico, n]) => `<option value="${c}" ${c === lu.cat ? "selected" : ""}>${ico} ${n}</option>`).join("")}</select></div></div>
    ${lu.cat ? `<label>📝 Mes notes</label><textarea id="lu-note" placeholder="Plan de jeu, combos, ce que tu travailles…">${esc(lu.note || "")}</textarea>` : ""}
    <h3 style="margin-top:14px">🧮 Mes matchups</h3>
    <div class="card">${rows.map((r) => `<div class="row">${luArt(r.o)}<div class="grow"><div><b>${esc(luN(r.o))}</b></div><div class="muted small">${r.rec.n ? `${r.rec.w}-${r.rec.l} en games` : "pas de game"}</div></div>
        <select class="lu-rate ${luCls(r.v)}" data-rate="${r.o}" data-me="${slug}" style="width:auto"><option value="">—</option>${LU_TIERS.map(([t, n]) => `<option value="${t}" ${r.v === t ? "selected" : ""}>${luSign(t)} ${n}</option>`).join("")}</select></div>`).join("") || '<div class="empty">Aucun matchup : note-les ici ou dans le Hub.</div>'}
      <div class="row"><select id="lu-new-opp" data-me="${slug}"><option value="">＋ noter un autre matchup…</option>${[...LU_ROSTER].sort((a, b) => a[1].localeCompare(b[1])).filter(([s]) => !opps.includes(s)).map(([s, n]) => `<option value="${s}">${esc(n)}</option>`).join("")}</select></div></div>
    <div class="btns"><button class="btn" data-act="close">Fermer</button>${lu.cat ? `<button class="btn accent" data-lact="save-note" data-slug="${slug}">Enregistrer</button>` : ""}</div>`);
  CUR = () => sheetLuChar(slug);
}
function sheetLuAdd() {
  const draw = (q) => { $("#lu-grid").innerHTML = LU_ROSTER.filter(([s, n]) => !q || luNorm(n).includes(luNorm(q))).map(([s, n]) => { const c = C.get("lineup", s)?.cat;
    return `<button class="lu-tile ${c ? "in" : ""}" data-lact="pick" data-slug="${s}">${luArt(s, "lu-a tile")}<b>${esc(n)}</b>${c ? `<span class="small">${LU_CATS.find((x) => x[0] === c)[1]}</span>` : ""}</button>`; }).join(""); };
  sheet(`<h2>＋ Ajouter à ma line up</h2><select id="lu-add-cat">${LU_CATS.map(([c, ico, n]) => `<option value="${c}">${ico} ${n}</option>`).join("")}</select>
    <input type="search" id="lu-q" placeholder="Chercher un perso…" style="margin-top:8px"><div class="lu-grid" id="lu-grid"></div>
    <div class="btns"><button class="btn accent" data-act="close">Terminé</button></div>`);
  draw(""); $("#lu-q").oninput = (e) => draw(e.target.value);
}
function luSetCat(slug, cat) {
  const all = C.section("lineup").map(([, v]) => v), cur = C.get("lineup", slug) || {};
  if (!cat) return C.set("lineup", slug, null);
  const ord = cur.cat === cat ? cur.ord : 1 + Math.max(0, ...all.filter((v) => v?.cat === cat).map((v) => v.ord || 0));
  C.set("lineup", slug, { ...cur, cat, ord, alt: cur.alt || 1 });
}

/* ------------------------------------------------------------ les gestes */
document.addEventListener("click", (e) => {
  const ch = e.target.closest("[data-lch]"); if (ch) { e.preventDefault(); return sheetLuChar(ch.dataset.lch); }
  const el = e.target.closest("[data-lact]"); if (!el) return;
  e.preventDefault();
  const a = el.dataset.lact;
  if (a === "add") return sheetLuAdd();
  if (a === "pick") { const cat = $("#lu-add-cat").value; luSetCat(el.dataset.slug, cat); el.classList.add("in"); return toast(`🎭 ${luN(el.dataset.slug)} → ${LU_CATS.find((x) => x[0] === cat)[2]}`); }
  if (a === "save-note") { const s = el.dataset.slug, cur = C.get("lineup", s); if (cur) { const t = $("#lu-note").value.trim(); const n = { ...cur }; if (t) n.note = t; else delete n.note; C.set("lineup", s, n); } toast("📝 Enregistré."); return closeSheet(); }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "lu-opp") { D.luOpp = t.value; save(); return render(); }
  if (t.id === "lu-cat") { luSetCat(t.dataset.slug, t.value); toast(t.value ? "🎭 Rangé." : "🎭 Retiré de la line up."); return sheetLuChar(t.dataset.slug); }
  if (t.dataset.rate) { C.set("mu_rate", `${t.dataset.me}|${t.dataset.rate}`, t.value === "" ? null : +t.value); t.className = "lu-rate " + luCls(t.value === "" ? null : +t.value); return; }
  if (t.id === "lu-new-opp" && t.value) { C.set("mu_rate", `${t.dataset.me}|${t.value}`, 0); return sheetLuChar(t.dataset.me); }
});
TABS.mu = viewLineup;
if (D.tab === "mu") render();

/* ============================================================ v65 : la frame data, les MU charts, les tier lists, 🔎 Infos */
const LU_MCATS = [["groundattacks", "Au sol"], ["aerialattacks", "Aériens"], ["specialattacks", "Spéciaux"], ["grabs", "Chopes"], ["dodges", "Esquives"]];
const UFD = "https://ultimateframedata.com/";
const LUF = { pages: null };
const luPages = (slug) => ({ "pokemon-trainer": ["pt_squirtle", "pt_ivysaur", "pt_charizard"], "pyra-mythra": ["pyra", "mythra"] }[slug] || [luR(slug)?.[2] || slug]);
const LU_FORMS = { pt_squirtle: "Squirtle", pt_ivysaur: "Ivysaur", pt_charizard: "Charizard", pyra: "Pyra", mythra: "Mythra" };
async function luFramesLoad() {
  if (LUF.pages) return LUF.pages;
  try {
    if (self.caches) { const r = await (await caches.open("sigo-frames")).match("frames.json"); LUF.pages = r ? await r.json() : {}; }
    else LUF.pages = JSON.parse(localStorage.getItem("sigo.frames") || "{}");
  } catch (e) { LUF.pages = {}; }
  return LUF.pages;
}
/** à la synchro : les fichiers frames-N.enc.json du Hub, seulement s'ils ont changé */
async function luSyncFrames(s) {
  const f = s?.frames; if (!f || !f.n || localStorage.getItem("sigo.frames.hash") === f.hash) return;
  const pages = {};
  for (let i = 0; i < f.n; i++) { const g = await ghGet(`frames-${i}.enc.json`); if (!g.obj) return; Object.assign(pages, (await decrypt(g.obj)).pages || {}); }
  LUF.pages = pages;
  const body = JSON.stringify(pages);
  if (self.caches) await (await caches.open("sigo-frames")).put("frames.json", new Response(body, { headers: { "Content-Type": "application/json" } }));
  else localStorage.setItem("sigo.frames", body);
  localStorage.setItem("sigo.frames.hash", f.hash);
}

/* ------------------------------------------------------------ la page d'un perso (move set, stats, mes MU) */
const LUC = { slug: "", seg: "moves", page: "", cat: "all" };
async function sheetChar(slug, seg) {
  Object.assign(LUC, { slug, seg: seg || LUC.seg || "moves" }); if (!luPages(slug).includes(LUC.page)) LUC.page = luPages(slug)[0];
  const P = await luFramesLoad(), F = P[LUC.page], lu = C.get("lineup", slug), r = luR(slug);
  const cat = lu?.cat ? LU_CATS.find((x) => x[0] === lu.cat) : null;
  const G = luGames(), rec = luRec(G.filter((g) => g.me === slug));
  const forms = luPages(slug).length > 1 ? `<div class="chips">${luPages(slug).map((p) => `<button class="chip-b ${p === LUC.page ? "on" : ""}" data-lact="form" data-p="${p}">${esc(LU_FORMS[p] || p)}</button>`).join("")}</div>` : "";
  let body = "";
  if (LUC.seg === "moves") {
    if (!F) body = `<div class="card empty">Pas de frame data pour ${esc(r[1])} sur ce téléphone.<br><span class="small">Dans le Hub : 🎮 Smash → 🔎 Infos → ouvre ce perso (ou « 📥 Tout le roster »), puis ⟳ ici.</span>
      <br><a class="btn" style="display:inline-block;margin-top:10px" href="${UFD}${LUC.page}" target="_blank" rel="noopener">Ouvrir Ultimate Frame Data ↗</a></div>`;
    else {
      const mv = F.m.filter((m) => LUC.cat === "all" || m[0] === LUC.cat);
      body = `<div class="chips">${[["all", "Tout"], ...LU_MCATS].map(([k, n]) => `<button class="chip-b ${LUC.cat === k ? "on" : ""}" data-lact="mcat" data-k="${k}">${n}</button>`).join("")}</div>
        ${mv.map((m) => `<div class="mv">${m[10]?.[0] ? `<img class="mv-gif" src="${UFD}${esc(m[10][0])}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
          <div class="mv-b"><b>${esc(m[1])}</b><div class="mv-s"><span><i>Startup</i>${esc(m[2] || "–")}</span><span><i>Actif</i>${esc(m[3] || "–")}</span><span><i>Total</i>${esc(m[4] || "–")}</span>
          <span><i>Bouclier</i><b class="${parseInt(m[8], 10) >= -4 ? "w" : parseInt(m[8], 10) <= -15 ? "l" : ""}">${esc(m[8] || "–")}</b></span><span><i>Dégâts</i>${esc(m[7] || "–")}</span><span><i>${m[6] ? "Atterr." : "Endlag"}</i>${esc(m[6] || m[5] || "–")}</span></div>
          ${m[9] ? `<div class="small muted">${esc(m[9])}</div>` : ""}${C.get("move_notes", `${slug}|${m[1]}`) ? `<div class="small">📝 ${esc(C.get("move_notes", `${slug}|${m[1]}`))}</div>` : ""}</div></div>`).join("")}
        <div class="muted small" style="text-align:center">Frame data : Ultimate Frame Data · <a href="${UFD}${LUC.page}" target="_blank" rel="noopener">la page ↗</a></div>`;
    }
  } else if (LUC.seg === "stats") {
    body = F ? `<div class="card">${F.s.map(([k, v]) => `<div class="row" style="min-height:0"><div class="grow muted small">${esc(k)}</div><b class="small">${esc(v)}</b></div>`).join("")}</div>` : '<div class="card empty">Pas de frame data sur ce téléphone.</div>';
  } else {
    const opps = [...new Set([...G.filter((g) => g.me === slug).map((g) => g.opp).filter(Boolean), ...C.section("mu_rate").map(([k]) => k.split("|")).filter(([a]) => a === slug).map(([, b]) => b)])];
    body = `<div class="card">${opps.map((o) => { const x = luRec(G.filter((g) => g.me === slug && g.opp === o)), v = luRate(slug, o);
      return `<div class="row">${luArt(o)}<div class="grow"><div><b>${esc(luN(o))}</b></div><div class="muted small">${x.n ? `${x.w}-${x.l} en games` : "pas de game"}</div></div>
        <select class="lu-rate ${luCls(v)}" data-rate="${o}" data-me="${slug}" style="width:auto"><option value="">—</option>${LU_TIERS.map(([t, n]) => `<option value="${t}" ${v === t ? "selected" : ""}>${luSign(t)} ${n}</option>`).join("")}</select></div>`; }).join("") || '<div class="empty">Aucun matchup noté ni joué.</div>'}</div>`;
  }
  sheet(`<div class="lu-head">${luArt(slug, "lu-a xl")}<div class="grow"><h2 style="margin:0">${esc(r[1])}</h2>
      <div class="small">${cat ? `${cat[1]} ${cat[2]} · ` : ""}${rec.n ? `${wl(rec.w, rec.l)} en games` : '<span class="muted">aucune game</span>'}</div>
      ${lu ? `<button class="btn" data-lch="${slug}" style="min-height:36px;padding:6px 10px">🎭 Ma fiche</button>` : ""}</div></div>
    <div class="seg" style="margin-top:10px">${[["moves", "🥊 Coups"], ["stats", "📏 Stats"], ["mu", "🧮 Mes MU"]].map(([k, n]) => `<button class="${LUC.seg === k ? "on" : ""}" data-lact="cseg" data-k="${k}">${n}</button>`).join("")}</div>
    ${LUC.seg !== "mu" ? forms : ""}${body}
    <div class="btns"><button class="btn" data-act="close">Fermer</button></div>`);
  CUR = () => sheetChar(LUC.slug);
}
function sheetFind() {
  const recent = (() => { try { return JSON.parse(localStorage.getItem("sigo.find.recent") || "[]"); } catch (e) { return []; } })();
  const draw = (q) => {
    const n = luNorm(q), al = Object.entries(LU_ALIASES).filter(([k]) => n && k.startsWith(n)).map(([, v]) => v);
    const list = n ? LU_ROSTER.filter(([s, nm]) => luNorm(nm).includes(n) || al.includes(s)) : [...recent.map(luR).filter(Boolean), ...LU_ROSTER.filter(([s]) => !recent.includes(s))];
    $("#find-grid").innerHTML = list.map(([s, nm]) => `<button class="lu-tile" data-lact="open-char" data-slug="${s}">${luArt(s, "lu-a tile")}<b>${esc(nm)}</b></button>`).join("") || '<div class="empty">Aucun perso.</div>';
  };
  sheet(`<h2>🔎 Infos persos</h2><input type="search" id="find-char-q" placeholder="Un perso ou un surnom (zss, ddd…)" autocomplete="off">
    <div class="lu-grid" id="find-grid"></div><div class="btns"><button class="btn" data-act="close">Fermer</button></div>`);
  draw(""); const q = $("#find-char-q"); q.oninput = () => draw(q.value); q.focus();
  q.onkeydown = (e) => { if (e.key === "Enter") { const b = $("#find-grid [data-slug]"); if (b) b.click(); } };
}

/* ------------------------------------------------------------ 🧮 la MU chart et 🏷 les tier lists */
const LU_SEGS = [["mine", "🎭 Line up"], ["chart", "🧮 MU chart"], ["tiers", "🏷 Tier lists"]];
const TLP = { tier: [["S", "#ff7f7f"], ["A", "#ffbf7f"], ["B", "#ffdf7f"], ["C", "#bfff7f"], ["D", "#7fbfff"]], mu: [["+2", "#3fb950"], ["+1", "#8fd18a"], ["0", "#e3b341"], ["-1", "#f0907a"], ["-2", "#d9534f"]] };
function viewMuChart() {
  const mine = luMine().filter((m) => m.cat !== "learn"); D.luMc = D.luMc && luR(D.luMc) ? D.luMc : mine[0]?.slug || "";
  const me = D.luMc, G = luGames();
  const sel = `<select id="lu-mc">${mine.length ? `<optgroup label="Ma line up">${mine.map((m) => `<option value="${m.slug}" ${m.slug === me ? "selected" : ""}>${esc(luN(m.slug))}</option>`).join("")}</optgroup>` : ""}
    <optgroup label="Tout le roster">${[...LU_ROSTER].sort((a, b) => a[1].localeCompare(b[1])).filter(([s]) => !mine.some((m) => m.slug === s)).map(([s, n]) => `<option value="${s}" ${s === me ? "selected" : ""}>${esc(n)}</option>`).join("")}</optgroup></select>`;
  if (!me) return `<div class="card">${sel}<div class="empty">Choisis un perso.</div></div>`;
  const icon = (s) => { const x = luRec(G.filter((g) => g.me === me && g.opp === s)); return `<button class="mc" data-lact="mc" data-slug="${s}">${luArt(s)}${x.n ? `<i class="${x.pct >= 50 ? "w" : "l"}">${x.w}-${x.l}</i>` : ""}</button>`; };
  const others = LU_ROSTER.map((r) => r[0]).filter((s) => s !== me);
  return `<div class="card">${sel}<div class="muted small" style="margin-top:6px">Touche un perso pour le noter, ou appuie longuement et glisse-le dans un rang.</div></div>
    ${LU_TIERS.map(([t, n]) => { const l = others.filter((s) => luRate(me, s) === t); return `<div class="tier ${luCls(t)}" data-v="${t}"><div class="tier-h">${luSign(t)} <span class="small">${n}</span></div><div class="tier-l">${l.map(icon).join("") || '<span class="muted small">—</span>'}</div></div>`; }).join("")}
    <details class="card mc-na" data-v="na" ${D.luMcOpen === false ? "" : "open"}><summary class="small muted">Pas encore notés (${others.filter((s) => luRate(me, s) == null).length})</summary><div class="tier-l" style="margin-top:8px">${others.filter((s) => luRate(me, s) == null).map(icon).join("")}</div></details>`;
}
function sheetRate(me, opp) {
  const v = luRate(me, opp), x = luRec(luGames().filter((g) => g.me === me && g.opp === opp));
  sheet(`<div class="lu-head">${luArt(me, "lu-a lg")}<div class="grow"><div class="muted small">MU</div><h2 style="margin:0">${esc(luN(me))} contre ${esc(luN(opp))}</h2><div class="small">${x.n ? `${wl(x.w, x.l)} en games` : '<span class="muted">pas de game</span>'}</div></div>${luArt(opp, "lu-a lg")}</div>
    <div class="rates">${LU_TIERS.map(([t, n]) => `<button class="btn ${luCls(t)} ${v === t ? "on" : ""}" data-lact="rate" data-v="${t}">${luSign(t)}<span class="small">${n}</span></button>`).join("")}</div>
    <div class="btns"><button class="btn" data-lact="rate" data-v="">Effacer</button><button class="btn" data-mu="${esc(luN(opp))}">📒 Fiche MU</button><button class="btn" data-lact="open-char" data-slug="${opp}">🥊 Ses coups</button></div>`);
  LUC.rate = [me, opp];
}
function tlGet(id) { return C.get("tierlists", id); }
function viewTierLists() {
  const L = C.section("tierlists").map(([, v]) => v).filter(Boolean).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  return `<div class="card">${L.map((l) => `<div class="row" data-lact="tl" data-id="${esc(l.id)}">${l.kind === "mu" ? luArt(l.char) : '<span class="lu-a"><i>🏷</i></span>'}<div class="grow"><div><b>${esc(l.name)}</b></div>
      <div class="muted small">${l.kind === "mu" ? "MU chart · " : ""}${l.tiers.reduce((n, t) => n + t.ids.length, 0)} persos · ${l.tiers.length} rangs</div></div>›</div>`).join("") || '<div class="empty">Pas encore de tier list.</div>'}</div>
    <div class="btns"><button class="btn" data-lact="tl-new" data-k="tier">＋ Tier list</button><button class="btn" data-lact="tl-new" data-k="mu">＋ MU chart</button></div>`;
}
const TLE = { id: "", sel: "", edit: false };
function tlStore(L) { L.at = new Date().toISOString().slice(0, 19); C.set("tierlists", L.id, L); }
function sheetTier(id) {
  const L = tlGet(id); if (!L) return closeSheet();
  TLE.id = id;
  const placed = new Set(L.tiers.flatMap((t) => t.ids));
  const ch = (s) => `<button class="tl-c ${TLE.sel === s ? "sel" : ""}" data-lact="tl-c" data-slug="${s}">${luArt(s)}</button>`;
  sheet(`<div class="lu-h"><h2 style="margin:0">${L.kind === "mu" ? "🧮" : "🏷"} ${esc(L.name)}</h2><button class="btn" data-lact="tl-edit" style="min-height:36px;padding:6px 10px">${TLE.edit ? "✓ Fini" : "✏ Modifier"}</button></div>
    ${L.kind === "mu" ? `<div class="muted small">MU chart de ${esc(luN(L.char))}</div>` : ""}
    ${TLE.edit ? `<div class="muted small" style="margin:6px 0">Touche un perso, puis un rang (ou « À placer » pour le retirer).</div>` : ""}
    ${L.tiers.map((t, i) => `<div class="tl-r" data-lact="tl-row" data-i="${i}"><div class="tl-l" style="background:${esc(t.c)}">${esc(t.n)}${TLE.edit ? `<span class="tl-tools"><button data-lact="tl-ren" data-i="${i}">✏</button><button data-lact="tl-up" data-i="${i}">▲</button><button data-lact="tl-rm" data-i="${i}">✕</button></span>` : ""}</div>
      <div class="tl-d">${t.ids.map(ch).join("")}</div></div>`).join("")}
    ${TLE.edit ? `<button class="btn" data-lact="tl-add" style="width:100%;margin-top:6px">＋ un rang</button>
      <h3 style="margin-top:12px">À placer</h3><input type="search" id="tl-pq" placeholder="Filtrer…" autocomplete="off" style="margin-bottom:6px"><div class="tl-pool" data-lact="tl-row" data-i="pool">${LU_ROSTER.map((r) => r[0]).filter((s) => !placed.has(s) && s !== L.char).map(ch).join("")}</div>` : ""}
    <div class="btns">${L.kind === "mu" && TLE.edit ? `<button class="btn" data-lact="tl-apply">➜ Mes notes de MU</button>` : ""}<button class="btn danger" data-lact="tl-del">🗑</button><button class="btn" data-act="close">Fermer</button></div>`);
  CUR = () => sheetTier(TLE.id);
  const pq = $("#tl-pq"); if (pq) pq.oninput = () => { const n = luNorm(pq.value); $$("#sheet .tl-pool .tl-c").forEach((b) => { b.hidden = !!n && !luNorm(luN(b.dataset.slug)).includes(n); }); };
}

/* la vue de l'onglet : trois parties */
const viewLineupV63 = viewLineup;
function viewLineupAll() {
  const seg = D.luSeg || "mine";
  const head = `<div class="seg">${LU_SEGS.map(([k, n]) => `<button class="${seg === k ? "on" : ""}" data-lact="seg" data-k="${k}">${n}</button>`).join("")}</div>`;
  return head + (seg === "chart" ? viewMuChart() : seg === "tiers" ? viewTierLists() : viewLineupV63());
}
TABS.mu = viewLineupAll;

document.addEventListener("click", (e) => {
  if (e.target.closest("#find-char")) { D.tab = "infos"; save(); render(); window.scrollTo(0, 0); setTimeout(() => $("#inf-q")?.focus(), 50); return; }
  const el = e.target.closest("[data-lact]"); if (!el) return;
  const a = el.dataset.lact;
  if (["seg", "mc", "rate", "open-char", "cseg", "mcat", "form", "tl", "tl-new", "tl-edit", "tl-c", "tl-row", "tl-ren", "tl-up", "tl-rm", "tl-add", "tl-apply", "tl-del"].includes(a)) { e.preventDefault(); e.stopPropagation(); }
  if (a === "seg") { D.luSeg = el.dataset.k; save(); return render(); }
  if (a === "mc") return sheetRate(D.luMc, el.dataset.slug);
  if (a === "rate") { const [me, o] = LUC.rate || []; if (me) C.set("mu_rate", `${me}|${o}`, el.dataset.v === "" ? null : +el.dataset.v); closeSheet(); return; }
  if (a === "open-char") { try { localStorage.setItem("sigo.find.recent", JSON.stringify([el.dataset.slug, ...JSON.parse(localStorage.getItem("sigo.find.recent") || "[]").filter((x) => x !== el.dataset.slug)].slice(0, 8))); } catch (_) {} return sheetChar(el.dataset.slug, "moves"); }
  if (a === "cseg") { LUC.seg = el.dataset.k; return sheetChar(LUC.slug); }
  if (a === "mcat") { LUC.cat = el.dataset.k; return sheetChar(LUC.slug); }
  if (a === "form") { LUC.page = el.dataset.p; return sheetChar(LUC.slug); }
  if (a === "tl") { TLE.edit = false; TLE.sel = ""; return sheetTier(el.dataset.id); }
  if (a === "tl-new") {
    let char = "";
    if (el.dataset.k === "mu") {
      const nm = prompt("MU chart de quel perso ?", luN(luMine()[0]?.slug || "mario")); if (!nm) return;
      char = luSlug(nm); if (!char) return toast("Perso inconnu.", true);
    }
    const id = "t" + Date.now().toString(36), k = el.dataset.k;
    const L = { id, name: k === "mu" ? `MU chart ${luN(char)}` : "Ma tier list", kind: k, char, tiers: TLP[k].map(([n, c]) => ({ n, c, ids: [] })) };
    if (k === "mu") { const by = Object.fromEntries(L.tiers.map((t, i) => [t.n.replace("+", ""), i])); C.section("mu_rate").forEach(([kk, v]) => { const [x, y] = kk.split("|"); if (x === char && by[String(v)] != null) L.tiers[by[String(v)]].ids.push(y); }); }
    const nm = prompt("Nom de la liste ?", L.name); if (nm === null) return; L.name = nm.trim().slice(0, 80) || L.name;
    tlStore(L); TLE.edit = true; TLE.sel = ""; render(); return sheetTier(id);
  }
  const L = tlGet(TLE.id);
  if (!L) return;
  if (a === "tl-edit") { TLE.edit = !TLE.edit; TLE.sel = ""; return sheetTier(L.id); }
  if (a === "tl-c") {
    if (!TLE.edit) return;
    const s = el.dataset.slug, row = el.closest("[data-i]")?.dataset.i;
    if (TLE.sel && TLE.sel !== s) { tlPlace(L, TLE.sel, row); return; }
    TLE.sel = TLE.sel === s ? "" : s; return sheetTier(L.id);
  }
  if (a === "tl-row") { if (TLE.edit && TLE.sel) tlPlace(L, TLE.sel, el.dataset.i); return; }
  if (a === "tl-ren") { const i = +el.dataset.i, n = prompt("Nom du rang ?", L.tiers[i].n); if (n !== null) { L.tiers[i].n = n.trim().slice(0, 24) || "?"; tlStore(L); } return sheetTier(L.id); }
  if (a === "tl-up") { const i = +el.dataset.i; if (i > 0) { [L.tiers[i - 1], L.tiers[i]] = [L.tiers[i], L.tiers[i - 1]]; tlStore(L); } return sheetTier(L.id); }
  if (a === "tl-rm") { if (L.tiers.length > 1) { L.tiers.splice(+el.dataset.i, 1); tlStore(L); } return sheetTier(L.id); }
  if (a === "tl-add") { L.tiers.push({ n: "?", c: "#9e9e9e", ids: [] }); tlStore(L); return sheetTier(L.id); }
  if (a === "tl-apply") {
    if (!confirm(`Remplacer tes notes de MU de ${luN(L.char)} par cette MU chart ?`)) return;
    C.section("mu_rate").filter(([k]) => k.startsWith(L.char + "|")).forEach(([k]) => C.set("mu_rate", k, null));
    let n = 0; L.tiers.forEach((t) => { const v = parseInt(t.n, 10); if (!isNaN(v) && v >= -2 && v <= 2) t.ids.forEach((s) => { C.set("mu_rate", `${L.char}|${s}`, v); n++; }); });
    toast(`🧮 ${n} notes de MU enregistrées.`); return;
  }
  if (a === "tl-del") { if (confirm(`Supprimer « ${L.name} » ?`)) { C.set("tierlists", L.id, null); closeSheet(); } return; }
}, true);
function tlPlace(L, s, to) {
  L.tiers.forEach((t) => { t.ids = t.ids.filter((x) => x !== s); });
  if (to !== "pool" && to != null) L.tiers[+to].ids.push(s);
  TLE.sel = ""; tlStore(L); sheetTier(L.id);
}
document.addEventListener("change", (e) => { if (e.target.id === "lu-mc") { D.luMc = e.target.value; save(); render(); } });
if (D.tab === "mu") render();

/* ============================================================ v67 : l'onglet 🔎 Infos */
const INFQ = { q: "" };
const infRecent = () => { try { return JSON.parse(localStorage.getItem("sigo.find.recent") || "[]"); } catch (e) { return []; } };
function infList(q) {
  const n = luNorm(q), al = Object.entries(LU_ALIASES).filter(([k]) => n && k.startsWith(n)).map(([, v]) => v);
  return n ? LU_ROSTER.filter(([s, nm]) => luNorm(nm).includes(n) || al.includes(s)) : [...LU_ROSTER].sort((a, b) => a[1].localeCompare(b[1]));
}
function infTiles(list) {
  const P = LUF.pages || {};
  return list.map(([s, nm]) => `<button class="lu-tile" data-lact="open-char" data-slug="${s}">${luArt(s, "lu-a tile")}<b>${esc(nm)}</b>${luPages(s).every((p) => P[p]) ? '<span class="fd" title="Frame data sur ce téléphone">🥊</span>' : ""}</button>`).join("") || '<div class="empty">Aucun perso.</div>';
}
function viewInfos() {
  const rec = infRecent().map(luR).filter(Boolean), have = Object.keys(LUF.pages || {}).length;
  if (!LUF.pages) luFramesLoad().then(() => { if (D.tab === "infos") { const g = $("#inf-grid"); if (g) g.innerHTML = infTiles(infList(INFQ.q)); const c = $("#inf-n"); if (c) c.textContent = Object.keys(LUF.pages).length; } });
  return `<div class="inf-q"><input type="search" id="inf-q" placeholder="Un perso, un surnom (zss, ddd, kkr…)" value="${esc(INFQ.q)}" autocomplete="off"></div>
    ${rec.length ? `<div id="inf-rec" ${INFQ.q ? "hidden" : ""}><h3>🕘 Récemment</h3><div class="lu-strip" style="margin-bottom:10px">${infTiles(rec)}</div></div>` : ""}
    <div class="muted small" style="margin:0 2px 6px">🥊 frame data sur ce téléphone : <b id="inf-n">${have}</b> page(s)${have < 89 ? " · le reste : Hub → 🔎 Infos → « 📥 Tout le roster », puis ⟳" : ""}</div>
    <div class="lu-grid" id="inf-grid">${infTiles(infList(INFQ.q))}</div>`;
}
TABS.infos = viewInfos;
document.addEventListener("input", (e) => {
  if (e.target.id !== "inf-q") return;
  INFQ.q = e.target.value; const r = $("#inf-rec"); if (r) r.hidden = !!INFQ.q; const g = $("#inf-grid"); if (g) g.innerHTML = infTiles(infList(INFQ.q));
});
document.addEventListener("keydown", (e) => { if (e.target.id === "inf-q" && e.key === "Enter") { const b = $("#inf-grid [data-slug]"); if (b) { e.target.blur(); b.click(); } } });
if (D.tab === "mu" || D.tab === "infos") render();

/* ============================================================ v68 : 🧮 glisser-déposer dans la MU chart (appui long), « pas encore notés » reste ouvert */
document.addEventListener("toggle", (e) => { if (e.target.classList?.contains("mc-na")) { D.luMcOpen = e.target.open; save(); } }, true);
const DRG = { t: null, el: null, ghost: null, slug: "", sx: 0, sy: 0, on: false, block: false, over: null };
function drgGhost(x, y) { if (DRG.ghost) { DRG.ghost.style.left = x - 24 + "px"; DRG.ghost.style.top = y - 24 + "px"; } }
function drgEnd() {
  clearTimeout(DRG.t); DRG.ghost?.remove(); DRG.el?.classList.remove("dragging"); DRG.over?.classList.remove("over");
  Object.assign(DRG, { t: null, el: null, ghost: null, on: false, over: null });
}
document.addEventListener("pointerdown", (e) => {
  const b = e.target.closest(".mc[data-slug]"); if (!b || D.tab !== "mu" || (D.luSeg || "mine") !== "chart") return;
  drgEnd(); Object.assign(DRG, { el: b, slug: b.dataset.slug, sx: e.clientX, sy: e.clientY });
  DRG.t = setTimeout(() => {
    DRG.on = true; navigator.vibrate?.(15);
    const g = b.cloneNode(true); g.className = "mc mc-ghost"; g.removeAttribute("data-lact"); document.body.appendChild(g); DRG.ghost = g;
    drgGhost(DRG.sx, DRG.sy); b.classList.add("dragging");
  }, 260);
});
document.addEventListener("pointermove", (e) => {
  if (!DRG.el) return;
  if (!DRG.on) { if (Math.hypot(e.clientX - DRG.sx, e.clientY - DRG.sy) > 10) drgEnd(); return; }
  drgGhost(e.clientX, e.clientY);
  const t = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-v]");
  if (t !== DRG.over) { DRG.over?.classList.remove("over"); DRG.over = t; t?.classList.add("over"); }
});
document.addEventListener("touchmove", (e) => { if (DRG.on) e.preventDefault(); }, { passive: false });
document.addEventListener("pointerup", (e) => {
  if (!DRG.el) return;
  if (DRG.on) {
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-v]"), slug = DRG.slug;
    DRG.block = true; setTimeout(() => (DRG.block = false), 300);
    drgEnd();
    if (t && D.luMc) { const v = t.dataset.v; C.set("mu_rate", `${D.luMc}|${slug}`, v === "na" ? null : +v); render(); toast(`🧮 ${luN(slug)} : ${v === "na" ? "pas noté" : luSign(+v)}`); }
    return;
  }
  drgEnd();
});
document.addEventListener("pointercancel", drgEnd);
document.addEventListener("contextmenu", (e) => { if (e.target.closest(".mc")) e.preventDefault(); });
window.addEventListener("click", (e) => { if (DRG.block) { e.stopPropagation(); e.preventDefault(); } }, true);

/* ============================================================ v68 : 🤖 les analyses gardées (faites dans le Hub) */
function mdLite(t) {
  const lines = esc(String(t || "")).split("\n"), out = []; let ul = false;
  for (let l of lines) {
    l = l.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
    const li = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(l), h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (li) { if (!ul) { out.push("<ul>"); ul = true; } out.push(`<li>${li[1]}</li>`); continue; }
    if (ul) { out.push("</ul>"); ul = false; }
    if (h) out.push(`<h4>${h[2]}</h4>`); else if (l.trim()) out.push(`<p>${l}</p>`);
  }
  if (ul) out.push("</ul>");
  return out.join("");
}
const anaAll = () => C.section("analyses").map(([, v]) => v).filter(Boolean).sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
function anaItem(a) {
  const kind = { me: "🙋 Moi", opp: "🆚 " + (a.name || "un joueur"), mu: "🎭 " + (a.name || "matchup") }[a.kind] || "🙋 Moi";
  return `<details class="ana"><summary><span class="chip">${esc(kind)}</span> ${esc(a.q)} <span class="muted small">· ${fmtDate(a.ts)}</span></summary>
    <div class="ana-b">${a.text ? mdLite(a.text) : `<div class="muted small">${a.status === "pending" ? "L'agent travaille encore : la réponse arrivera avec la synchro." : "Pas de réponse."}</div>`}</div></details>`;
}
function anaBlock(pid) {
  const l = anaAll().filter((a) => a.kind === "opp" && String(a.pid) === String(pid));
  return l.length ? `<div class="card"><h3>🤖 Mes analyses sur lui</h3>${l.map(anaItem).join("")}</div>` : "";
}
const _oppBlock = oppBlock;
oppBlock = function (pid, name, o) { return anaBlock(pid) + _oppBlock(pid, name, o); };
const _viewPlayers = viewPlayers;
TABS.players = function () {
  const l = anaAll();
  return (l.length ? `<details class="card ana-all" ${D.anaOpen ? "open" : ""}><summary><b>🤖 Mes analyses</b> <span class="muted small">${l.length}</span></summary>${l.slice(0, 40).map(anaItem).join("")}</details>` : "") + _viewPlayers();
};
document.addEventListener("toggle", (e) => { if (e.target.classList?.contains("ana-all")) { D.anaOpen = e.target.open; save(); } }, true);
if (D.tab === "players") render();
