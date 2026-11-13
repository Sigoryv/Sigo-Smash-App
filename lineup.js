/* mobile/lineup.js — 🎭 LA LINE UP dans la poche (v63)
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
    const rows = mine.map((m) => ({ m, sc: luScore(m.slug, opp, G), rec: luRec(G.filter((g) => g.me === m.slug && g.opp === opp)) }))
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
