/* =====================================================================
   Sigo Smash — l'appli téléphone de l'espace Smash du Hub (v28).
   - start.gg en direct (ton jeton), avec repli sur l'instantané envoyé par le Hub ;
   - ton carnet synchronisé avec le Hub via ton dépôt GitHub PRIVÉ, chiffré (AES-256-GCM, PBKDF2) ;
   - tout est gardé sur le téléphone : l'appli marche sans réseau (dernière synchro).
   Rien ne parle au PC : le Hub et l'appli se retrouvent dans le dépôt.
   ===================================================================== */
"use strict";
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ULT = 1386;
const KEY = "sigo.smash.v1";
const SG = () => localStorage.getItem("sigo.dev.sg") || "https://api.start.gg/gql/alpha";      // (les tests remplacent les adresses)
const GH = () => localStorage.getItem("sigo.dev.gh") || "https://api.github.com";

/* ------------------------------------------------------------ l'état (gardé sur le téléphone) */
const DEF = { cfg: { sgToken: "", profile: "", repo: "", ghToken: "", pass: "" }, player: null, sets: [], chars: {}, upcoming: null, media: { charimg: {}, avatars: {} },
  carnet: { flat: {}, stamps: {} }, lastSg: "", lastCloud: "", source: "", scout: {}, tab: "home" };
let D;
try { D = Object.assign(structuredClone(DEF), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (_) { D = structuredClone(DEF); }
D.cfg = Object.assign({}, DEF.cfg, D.cfg); D.carnet = Object.assign({ flat: {}, stamps: {} }, D.carnet);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { toast("Stockage plein : " + e.message, true); } };
const now = () => Date.now() / 1000;

/* ------------------------------------------------------------ petits outils */
function toast(t, err) { const el = $("#toast"); el.textContent = t; el.className = err ? "err" : ""; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), err ? 5000 : 2600); }
function status(t, err) { const el = $("#status"); el.hidden = !t; el.textContent = t || ""; el.className = err ? "err" : ""; }
const fmtDate = (ts) => ts ? new Date(typeof ts === "number" ? ts * 1000 : ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "";
const fmtDay = (ts) => ts ? new Date(ts * 1000).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" }) : "";
const ago = (iso) => { if (!iso) return "jamais"; const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
const countdown = (ts) => { const d = Math.ceil((ts * 1000 - Date.now()) / 864e5); return d <= 0 ? "aujourd'hui" : d === 1 ? "demain" : `dans ${d} jours`; };
const ordinal = (n) => n ? (n === 1 ? "1er" : n + "e") : "–";
const wl = (w, l) => `<b class="w">${w}</b>-<b class="l">${l}</b>`;
const initials = (s) => (String(s || "?").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();
const logo = (url, name, cls = "logo") => `<div class="${cls}" ${url ? `style="background-image:url('${esc(url)}')"` : ""}>${url ? "" : esc(initials(name))}</div>`;
const key = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const charName = (v) => v == null || v === "" ? "" : (D.chars[String(v)] || String(v));
/* v33 : les photos de profil et les icônes des persos (adresses start.gg reçues du Hub) */
const ini = (n) => String(n || "?").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
const imgOk = (u) => /^https:\/\/images\.start\.gg\//.test(u || "") ? u : "";
function av(pid, name, cls = "") {
  const u = imgOk(((D.media || {}).avatars || {})[String(pid)]);
  return `<span class="av ${cls}"${u ? ` style="background-image:url('${esc(u)}')"` : ""}>${u ? "" : esc(ini(name))}</span>`;
}
function ci(v, cls = "") {
  const name = charName(v); if (!name) return "";
  const id = D.chars[String(v)] ? String(v) : (Object.entries(D.chars).find(([, n]) => key(n) === key(name)) || [])[0];
  const u = imgOk(((D.media || {}).charimg || {})[id]);
  return `<span class="ci ${cls}" title="${esc(name)}"${u ? ` style="background-image:url('${esc(u)}')"` : ""}>${u ? "" : esc(ini(name))}</span>`;
}

/* ------------------------------------------------------------ le carnet (le même format que le Hub, à plat) */
const C = {
  get: (sec, k) => D.carnet.flat[`${sec}/${k}`],
  set(sec, k, v) {
    const kk = `${sec}/${k}`, empty = v == null || v === "" || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);
    if (empty) { if (!(kk in D.carnet.flat)) return; delete D.carnet.flat[kk]; } else { if (JSON.stringify(D.carnet.flat[kk]) === JSON.stringify(v)) return; D.carnet.flat[kk] = v; }
    D.carnet.stamps[kk] = now(); save(); cloudSoon();
  },
  section: (sec) => Object.entries(D.carnet.flat).filter(([k]) => k.startsWith(sec + "/")).map(([k, v]) => [k.slice(sec.length + 1), v]),
};
const notes = (id) => C.get("notes", id) || "";
const allSets = () => [...D.sets, ...C.section("manual").map(([, v]) => v)].filter((s) => !s.game || s.game === ULT).sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
const games = (s) => C.get("games", s.id) || s.games || [];

/* ------------------------------------------------------------ les stats (comme le Hub) */
const PLACES = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097];
const pIdx = (p) => { let i = 0; while (i + 1 < PLACES.length && PLACES[i + 1] <= p) i++; return i; };
function stats(sets) {
  const play = sets.filter((s) => !s.dq);
  const W = play.filter((s) => s.win).length;
  let gw = 0, gl = 0; play.forEach((s) => { const [a, b] = s.score || []; if (a >= 0 && b >= 0) { gw += a || 0; gl += b || 0; } });
  const T = new Map();
  for (const s of sets) {
    if (s.source === "manual") continue;
    const k = s.eid || s.tid || s.tournament;
    if (!T.has(k)) T.set(k, { key: k, tid: s.tid, src: s.source, url: s.turl || (s.tslug ? "https://www.start.gg/" + s.tslug : ""), name: s.tournament, slug: s.tslug, ts: s.ts, entrants: s.entrants, seed: s.seed, place: s.place, online: s.online, timg: s.timg, tbanner: s.tbanner, sets: [], w: 0, l: 0 });
    const t = T.get(k); t.sets.push(s); if (!s.dq) s.win ? t.w++ : t.l++; if (s.ts && s.ts < t.ts) t.ts = s.ts;
  }
  const tours = [...T.values()].map((t) => ({ ...t, spr: t.seed && t.place ? pIdx(t.seed) - pIdx(t.place) : null })).sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
  const O = new Map();
  for (const s of play) {
    if (!O.has(s.opp_id)) O.set(s.opp_id, { id: s.opp_id, name: s.opp, w: 0, l: 0, gw: 0, gl: 0, last: s.ts, sets: [] });
    const o = O.get(s.opp_id); o.sets.push(s); s.win ? o.w++ : o.l++; if (s.opp_shobu) o.both = true;
    const [a, b] = s.score || []; if (a >= 0 && b >= 0) { o.gw += a || 0; o.gl += b || 0; }
    if ((s.ts || "") > (o.last || "")) { o.last = s.ts; o.name = s.opp; }
  }
  const opC = new Map(), myC = new Map();
  const bump = (m, k, win) => { if (!k) return; const x = m.get(k) || { k, w: 0, l: 0 }; win ? x.w++ : x.l++; m.set(k, x); };
  for (const s of play) for (const g of games(s)) { if (g.win == null) continue; bump(opC, charName(g.opp), g.win); bump(myC, charName(g.me), g.win); }
  const pct = (w, l) => (w + l ? Math.round((100 * w) / (w + l)) : 0);
  return { W, L: play.length - W, pct: pct(W, play.length - W), gw, gl, gpct: pct(gw, gl), tours, pctOf: pct,
    opps: [...O.values()].sort((a, b) => (b.w + b.l) - (a.w + a.l) || (b.last || "").localeCompare(a.last || "")),
    opC: [...opC.values()].sort((a, b) => (b.w + b.l) - (a.w + a.l)), myC: [...myC.values()].sort((a, b) => (b.w + b.l) - (a.w + a.l)),
    uf: (s) => s.seed && s.opp_seed ? pIdx(s.seed) - pIdx(s.opp_seed) : null };
}

/* ------------------------------------------------------------ start.gg (en direct) */
const SET_FIELDS = `id completedAt startedAt displayScore fullRoundText round winnerId
  event { id name numEntrants isOnline videogame { id } tournament { id name slug startAt isOnline city countryCode lat lng images { url type } } }
  slots { entrant { id name initialSeedNum standing { placement } participants { player { id gamerTag } } } standing { stats { score { value } } } }
  games { orderNum winnerId stage { name } selections { entrant { id } selectionValue } }`;
const Q_SETS = `query Sets($slug: String!, $page: Int!, $per: Int!) { user(slug: $slug) { player { id gamerTag prefix
  sets(page: $page, perPage: $per) { pageInfo { total totalPages } nodes { ${SET_FIELDS} } } } } }`;
const Q_USER = `query U($slug: String!) { user(slug: $slug) { id slug name player { id gamerTag prefix } } }`;
const Q_CHARS = `query C($id: ID!) { videogame(id: $id) { id name characters { id name } } }`;
const TOUR = `id name slug startAt endAt city countryCode isOnline numAttendees lat lng isRegistrationOpen registrationClosesAt images { url type }`;
const Q_UP = `query Up($slug: String!) { user(slug: $slug) { player { id }
  tournaments(query: {perPage: 25, page: 1, filter: {upcoming: true}}) { nodes { ${TOUR} events { id name numEntrants startAt isOnline videogame { id } } } } } }`;
const Q_ENT = `query Ent($id: ID!, $page: Int!) { event(id: $id) { id entrants(query: {page: $page, perPage: 100}) { pageInfo { totalPages }
  nodes { id name initialSeedNum participants { player { id gamerTag prefix } } } } } }`;
const Q_RUN = `query Run($id: ID!, $ent: ID!) { event(id: $id) { id state sets(page: 1, perPage: 30, filters: {entrantIds: [$ent]}) { nodes {
  id state fullRoundText round winnerId displayScore completedAt startedAt
  slots { entrant { id name initialSeedNum participants { player { id gamerTag } } } standing { stats { score { value } } } } } } } }`;
const Q_SCOUT = `query Scout($id: ID!, $page: Int!, $per: Int!) { player(id: $id) { id gamerTag prefix user { slug location { city country } }
  sets(page: $page, perPage: $per) { pageInfo { totalPages } nodes { ${SET_FIELDS} } } } }`;
async function gql(query, variables) {
  if (!D.cfg.sgToken) throw new Error("Pas de jeton start.gg (⚙ Réglages).");
  let r;
  try { r = await fetch(SG(), { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + D.cfg.sgToken }, body: JSON.stringify({ query, variables }) }); }
  catch (_) { throw new Error("start.gg injoignable depuis le téléphone (réseau, ou start.gg refuse le navigateur)."); }
  if (r.status === 401 || r.status === 403) throw new Error("Jeton start.gg refusé.");
  if (r.status === 429) throw new Error("start.gg : trop de requêtes, réessaie dans une minute.");
  if (!r.ok) throw new Error("start.gg a répondu " + r.status);
  const d = await r.json();
  if (d.errors && !d.data) throw new Error(d.errors.map((e) => e.message).join("; ").slice(0, 200));
  return d.data;
}
const isoOf = (ts) => ts ? new Date(ts * 1000).toISOString().slice(0, 19) : "";
function images(t) {
  const im = (t.images || []).filter((i) => i && i.url);
  const banner = (im.find((i) => i.type === "banner") || {}).url || "";
  return [(im.find((i) => i.type === "profile") || {}).url || (!banner && im[0] ? im[0].url : ""), banner];
}
function normalize(node, me) {
  const slots = (node.slots || []).filter((s) => s && s.entrant);
  if (slots.length !== 2) return null;
  const mine = slots.find((s) => (s.entrant.participants || []).some((p) => String((p.player || {}).id) === String(me)));
  if (!mine) return null;
  const opp = mine === slots[0] ? slots[1] : slots[0];
  const me_e = mine.entrant, op_e = opp.entrant;
  const score = (s) => ((((s.standing || {}).stats || {}).score) || {}).value;
  const ms = score(mine) ?? null, os = score(opp) ?? null;
  const ev = node.event || {}, t = ev.tournament || {}, opPl = (((op_e.participants || [{}])[0] || {}).player) || {};
  const [timg, tbanner] = images(t);
  const gs = (node.games || []).slice().sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0)).map((g) => {
    const sel = Object.fromEntries((g.selections || []).map((x) => [String((x.entrant || {}).id), x.selectionValue]));
    return { n: g.orderNum, stage: (g.stage || {}).name || "", me: sel[String(me_e.id)] ?? null, opp: sel[String(op_e.id)] ?? null, win: g.winnerId ? String(g.winnerId) === String(me_e.id) : null };
  });
  return { id: String(node.id), source: "startgg", ts: isoOf(node.completedAt || node.startedAt || t.startAt), tournament: t.name || "", tslug: t.slug || "", tid: String(t.id || ""),
    event: ev.name || "", eid: String(ev.id || ""), entrants: ev.numEntrants || 0, online: !!(ev.isOnline ?? t.isOnline), game: (ev.videogame || {}).id, city: t.city || "",
    timg, tbanner, lat: t.lat ?? null, lng: t.lng ?? null, round: node.fullRoundText || "", losers: (node.round || 0) < 0,
    seed: me_e.initialSeedNum ?? null, place: (me_e.standing || {}).placement ?? null, opp: op_e.name || opPl.gamerTag || "?", opp_id: String(opPl.id || op_e.name || ""),
    opp_seed: op_e.initialSeedNum ?? null, score: [ms, os], win: String(node.winnerId) === String(me_e.id),
    dq: (ms != null && ms < 0) || (os != null && os < 0) || /DQ/.test(node.displayScore || ""), games: gs };
}
async function syncStartgg() {
  const slug = (D.cfg.profile.match(/user\/([0-9a-zA-Z]{6,12})/) || [])[1];
  if (!slug) throw new Error("Profil start.gg manquant (⚙ Réglages).");
  if (!Object.keys(D.chars).length) { const d = await gql(Q_CHARS, { id: ULT }); D.chars = Object.fromEntries(((d.videogame || {}).characters || []).map((c) => [String(c.id), c.name])); }
  const known = new Map(D.sets.map((s) => [s.id, s])), had = known.size;
  let added = 0;
  for (let page = 1; page <= 60; page++) {
    const d = await gql(Q_SETS, { slug: "user/" + slug, page, per: 10 });
    const pl = (d.user || {}).player; if (!pl) throw new Error("Profil introuvable sur start.gg.");
    D.player = { id: String(pl.id), tag: pl.gamerTag || "", prefix: pl.prefix || "" };
    const nodes = (pl.sets || {}).nodes || []; let fresh = 0;
    for (const n of nodes) { const x = normalize(n, pl.id); if (!x) continue; if (!known.has(x.id)) { added++; fresh++; } known.set(x.id, x); }
    status(`start.gg : page ${page}…`);
    if (!nodes.length || page >= ((pl.sets.pageInfo || {}).totalPages || 0) || (had && !fresh && page > 1)) break;
    await new Promise((r) => setTimeout(r, 800));
  }
  D.sets = [...known.values()].sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
  // les tournois à venir
  const u = (await gql(Q_UP, { slug: "user/" + slug })).user || {};
  const me = String((u.player || {}).id || (D.player || {}).id || ""), out = [];
  for (const t of ((u.tournaments || {}).nodes || [])) {
    const ult = (t.events || []).filter((e) => String((e.videogame || {}).id) === String(ULT)), evs = [];
    for (const e of ult) {
      const list = await entrants(e.id), mine = list.find((x) => x.pid === me);
      if (!mine && ult.length > 1) continue;
      evs.push({ eid: String(e.id), name: e.name || "", entrants: e.numEntrants || list.length, me: mine || null, seeded: list.some((x) => x.seed), list });
    }
    const [timg, tbanner] = images(t);
    if (evs.length) out.push({ tid: String(t.id), name: t.name, slug: t.slug, start: t.startAt, city: t.city || "", online: !!t.isOnline, attendees: t.numAttendees || 0, timg, tbanner, events: evs });
  }
  const shobu = (D.upcoming?.tournaments || []).filter((t) => t.src === "shobu");      // (les tournois Shobu viennent du Hub : on les garde)
  D.upcoming = { at: now(), me, tournaments: [...out, ...shobu].sort((a, b) => (a.start || 0) - (b.start || 0)) };
  D.lastSg = new Date().toISOString(); D.source = "phone"; save();
  prefetchScouts();
  return added;
}
async function entrants(eid) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const e = ((await gql(Q_ENT, { id: eid, page })).event || {}).entrants || {};
    for (const n of e.nodes || []) { const pl = (((n.participants || [{}])[0]) || {}).player || {}; out.push({ id: String(n.id), name: n.name || pl.gamerTag || "?", seed: n.initialSeedNum ?? null, pid: String(pl.id || ""), tag: pl.gamerTag || "" }); }
    if (page >= ((e.pageInfo || {}).totalPages || 0)) break;
  }
  return out;
}
async function scout(pid, refresh) {
  const c = D.scout[pid];
  if (c && !refresh && now() - c.at < 12 * 3600) return c;
  let sets = [], info = null;
  for (const page of [1, 2]) {
    const pl = (await gql(Q_SCOUT, { id: pid, page, per: 15 })).player;
    if (!pl) throw new Error("Joueur introuvable sur start.gg.");
    const loc = (pl.user || {}).location || {};
    info = { id: String(pl.id), tag: pl.gamerTag || "", prefix: pl.prefix || "", slug: (pl.user || {}).slug || "", where: [loc.city, loc.country].filter(Boolean).join(", ") };
    sets.push(...((pl.sets || {}).nodes || []).map((n) => normalize(n, pl.id)).filter((x) => x && (!x.game || String(x.game) === String(ULT))));
    if (page >= (((pl.sets || {}).pageInfo || {}).totalPages || 0)) break;
  }
  const play = sets.filter((s) => !s.dq), T = new Map(), CH = new Map();
  for (const s of sets) { const k = s.eid || s.tid; const t = T.get(k) || { name: s.tournament, ts: s.ts, entrants: s.entrants, place: s.place, timg: s.timg, w: 0, l: 0 }; if (!s.dq) s.win ? t.w++ : t.l++; T.set(k, t); }
  for (const s of play) for (const g of s.games || []) if (g.me != null) { const n = charName(g.me), x = CH.get(n) || { k: n, n: 0, w: 0 }; x.n++; if (g.win) x.w++; CH.set(n, x); }
  const res = { at: now(), player: info, w: play.filter((s) => s.win).length, l: play.filter((s) => !s.win).length,
    tours: [...T.values()].sort((a, b) => (b.ts || "").localeCompare(a.ts || "")).slice(0, 10), chars: [...CH.values()].sort((a, b) => b.n - a.n).slice(0, 5),
    wins: play.filter((s) => s.win).slice(0, 8).map((s) => ({ opp: s.opp, score: s.score, t: s.tournament })), losses: play.filter((s) => !s.win).slice(0, 8).map((s) => ({ opp: s.opp, score: s.score, t: s.tournament })) };
  D.scout[pid] = res;
  const ids = Object.keys(D.scout); if (ids.length > 30) delete D.scout[ids.sort((a, b) => D.scout[a].at - D.scout[b].at)[0]];
  save(); return res;
}

/* les tournois à venir ; « en cours » depuis plus d'une semaine = l'orga a oublié de le clore : il passe dans les Passés */
const ups = () => (D.upcoming?.tournaments || []).filter((u) => (u.start || 0) * 1000 >= Date.now() - 7 * 864e5);
const liveOk = (ev) => !!ev.me?.id && (String(ev.eid).startsWith("shobu:") ? !!(D.cfg.shobuKey && D.cfg.shobuUser) : !!D.cfg.sgToken);

/* ------------------------------------------------------------ 🥋 Shobu en direct (clé sur le téléphone) */
const SB = () => localStorage.getItem("sigo.dev.sb") || "https://api.shobuapp.fr/api/public/v1";
const norm = (x) => String(x || "").replace(/\s+/g, " ").trim().toLowerCase();
function isMe(e, user) {
  if (!e || !user) return false;
  const u = norm(user), p = e.player || {}, n = norm(e.name);
  return norm(p.username) === u || norm(p.name) === u || n === u || n.split(" | ").pop() === u;
}
function sgIdForTag(pid, name) {          // 🔗 même pseudo sur start.gg : sa fiche start.gg (s'il est unique)
  const tags = [String(pid || "").replace(/^shobu:/, ""), norm(name).split(" | ").pop()].filter(Boolean), hits = new Set();
  for (const s of D.sets) if (s.source === "startgg" && tags.includes(norm(s.opp).split(" | ").pop())) hits.add(String(s.opp_id));
  return hits.size === 1 ? [...hits][0] : "";
}
async function shobuLive(ev) {
  let r;
  try { r = await fetch(`${SB()}/events/${encodeURIComponent(String(ev.eid).slice(6))}/bracket`, { headers: { Authorization: "Bearer " + D.cfg.shobuKey, Accept: "application/json" }, cache: "no-store" }); }
  catch (_) { throw new Error("Shobu injoignable depuis le téléphone (réseau, ou Shobu refuse le navigateur)."); }
  if (r.status === 401) throw new Error("Clé Shobu refusée (⚙ Réglages).");
  if (r.status === 429) throw new Error("Shobu : trop de requêtes, réessaie dans un instant.");
  if (!r.ok) throw new Error("Shobu a répondu " + r.status);
  const d = await r.json(), user = D.cfg.shobuUser, rows = [];
  for (const s of d.sets || []) {
    const slots = (s.slots || []).filter(Boolean), mine = slots.find((x) => isMe(x.entrant, user)); if (!mine) continue;
    const opp = slots.find((x) => x !== mine) || {}; if (opp.isBye) continue;
    const oe = opp.entrant, p = oe?.player || {}, st = String(s.status || "").toUpperCase(), done = st === "COMPLETED";
    const spid = oe ? "shobu:" + norm(p.username || oe.name) : "";
    rows.push({ order: (done ? 0 : 1e6) + (s.number || 0), name: oe ? (oe.name || p.username) : "À déterminer", pid: spid ? (sgIdForTag(spid, oe.name) || spid) : "", seed: oe?.seed ?? null,
      label: s.roundName || "", res: done ? (mine.isWinner ? "w" : "l") : !oe ? "wait" : ["IN_PROGRESS", "ONGOING", "STARTED"].includes(st) ? "live" : "next",
      score: done ? `${mine.score ?? "?"}-${opp.score ?? "?"}` : st.startsWith("IN") ? "en cours" : !oe ? "adversaire pas encore connu" : "à jouer" });
  }
  rows.sort((a, b) => a.order - b.order);
  const losses = rows.filter((x) => x.res === "l").length, state = String((d.event || {}).status || "").toUpperCase();
  const res = { at: now(), state: state === "COMPLETED" ? "COMPLETED" : "ACTIVE", sets: rows, out: losses >= 2 || (losses >= 1 && state === "COMPLETED") };
  D.live = D.live || {}; D.live[ev.eid] = res; save();
  return res;
}

/* ------------------------------------------------------------ 🏆 le bracket d'une épreuve (v42 : le même que dans le Hub) */
const Q_BR = `query Br($id: ID!, $page: Int!, $per: Int!) { event(id: $id) { id name numEntrants state tournament { name }
  phases { id name phaseOrder }
  sets(page: $page, perPage: $per, sortType: ROUND) { pageInfo { totalPages } nodes { id round fullRoundText identifier state winnerId displayScore
    phaseGroup { id displayIdentifier phase { id } }
    slots { entrant { id name initialSeedNum participants { player { id } } } standing { stats { score { value } } } }
    games { selections { entrant { id } selectionValue } } } } } }`;
let BK = null;
async function loadBracket(eid) {
  if (String(eid).startsWith("shobu:")) return shobuBracket(eid);
  for (const per of [16, 8, 4]) {
    try {
      const sets = []; let ev = null, page = 1, total = 1;
      while (page <= Math.min(total, Math.ceil(1800 / per))) {
        const d = (await gql(Q_BR, { id: eid, page, per })).event; if (!d) throw new Error("Épreuve introuvable sur start.gg.");
        ev = ev || d; total = d.sets?.pageInfo?.totalPages || 1;
        for (const n of d.sets?.nodes || []) {
          const chars = {};
          for (const g of n.games || []) for (const x of g.selections || []) { const k = String(x.entrant?.id || ""); if (k && x.selectionValue != null) (chars[k] = chars[k] || []).includes(x.selectionValue) || chars[k].push(x.selectionValue); }
          sets.push({ id: String(n.id), round: n.round || 0, label: n.fullRoundText || "", ident: n.identifier || "", state: { 1: "next", 2: "live", 3: "done" }[n.state] || "next",
            winner: String(n.winnerId || ""), chars, phase: String(n.phaseGroup?.phase?.id || ""), group: String(n.phaseGroup?.id || ""), gname: n.phaseGroup?.displayIdentifier || "",
            slots: [0, 1].map((i) => { const x = (n.slots || [])[i], e = x?.entrant; return e ? { id: String(e.id), name: e.name || "?", seed: e.initialSeedNum, pid: String(e.participants?.[0]?.player?.id || ""), score: x.standing?.stats?.score?.value } : null; }) });
        }
        page++;
      }
      const phases = (ev.phases || []).slice().sort((a, b) => (a.phaseOrder || 0) - (b.phaseOrder || 0)).map((p) => {
        const gs = new Map(); for (const st of sets.filter((x) => x.phase === String(p.id))) { if (!gs.has(st.group)) gs.set(st.group, { id: st.group, name: st.gname, sets: [] }); gs.get(st.group).sets.push(st); }
        return { id: String(p.id), name: p.name, groups: [...gs.values()].sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name)) };
      }).filter((p) => p.groups.length);
      return { eid, name: ev.name, tournament: ev.tournament?.name || "", state: ev.state === "COMPLETED" ? "done" : ev.state === "ACTIVE" ? "live" : "next", me: String(D.player?.id || ""), phases, at: now() };
    } catch (e) { if (!/complexity/i.test(e.message) || per === 4) throw e; }
  }
}
async function shobuBracket(eid) {
  if (!D.cfg.shobuKey) throw new Error("Ajoute ta clé Shobu dans ⚙ pour voir ce bracket.");
  const r = await fetch(`${SB()}/events/${encodeURIComponent(String(eid).slice(6))}/bracket`, { headers: { Authorization: "Bearer " + D.cfg.shobuKey, Accept: "application/json" }, cache: "no-store" });
  if (!r.ok) throw new Error("Shobu a répondu " + r.status);
  const d = await r.json(), me = norm(D.cfg.shobuUser || "");
  const rd = (name) => { const n = String(name || "").toLowerCase(), m = n.match(/round\s*(\d+)/); let k = m ? +m[1] : n.includes("quarter") ? 90 : n.includes("semi") ? 91 : n.includes("final") ? 92 : 50; if (n.includes("grand")) k = 99 + (n.includes("reset") ? 1 : 0); return n.includes("loser") ? -k : k; };
  const sets = (d.sets || []).filter((x) => !(x.slots || []).some((y) => y?.isBye)).map((x) => {
    const slots = [0, 1].map((i) => { const y = (x.slots || [])[i], e = y?.entrant; return e ? { id: "shobu:" + norm(e.player?.username || e.name), name: e.name || e.player?.username || "?", seed: e.seed, pid: "", score: y.score } : null; });
    const w = (x.slots || []).findIndex((y) => y?.isWinner), st = String(x.status || "").toUpperCase();
    return { id: String(x.id), round: rd(x.roundName), label: x.roundName || "", ident: "", order: x.number || 0, state: st === "COMPLETED" ? "done" : st.startsWith("IN") || st === "ONGOING" || st === "STARTED" ? "live" : "next", winner: w >= 0 && slots[w] ? slots[w].id : "", chars: {}, slots };
  });
  return { eid, name: d.event?.name || "Bracket", tournament: "", state: sets.length && sets.every((x) => x.state === "done") ? "done" : "live", me: me ? "shobu:" + me : "", phases: sets.length ? [{ id: "", name: "Bracket", groups: [{ id: "", name: "", sets }] }] : [], at: now() };
}
/* 📡 en direct (v44) : tant que le bracket est ouvert et le tournoi en cours, il se relit seul (60 s, ou dès que
   l'appli revient au premier plan) sans perdre la phase, la poule, le joueur suivi ni la position ; les sets
   qui viennent de finir clignotent, et le joueur suivi (toi, ou celui que tu as touché) a son bandeau :
   set en cours, prochain adversaire (🔭 scouting), en attente, éliminé. Une alerte quand son set change. */
const BK_EVERY = () => +localStorage.getItem("sigo.dev.bkpoll") || 60000;
const BKDRAW = () => drawBracket();
async function sheetBracket(eid, title) {
  BK = { eid, title, data: (D.brackets || {})[eid] || null, phase: null, group: null, hl: null, live: true, fresh: new Set(), next: 0 };
  if (CUR && CUR !== BKDRAW) BACK = CUR; CUR = BKDRAW;
  drawBracket();
  await refreshBracket(false);
}
const bkFocus = (r) => BK.hl ? (x) => x.id === BK.hl : (x) => isMeBk(x, r);
const bkAll = (r) => r.phases.flatMap((p) => p.groups.flatMap((g) => g.sets.map((s) => ({ ...s, pname: p.name, gid: g.id, pid0: p.id }))));
function bkStatus(r) {          // (où en est le joueur suivi)
  const f = bkFocus(r), mine = bkAll(r).filter((s) => s.slots.some((x) => x && f(x)));
  if (!mine.length) return null;
  const who = mine[0].slots.find((x) => x && f(x)), opp = (s) => s.slots.find((x) => x && !f(x));
  const live = mine.find((s) => s.state === "live"), next = mine.filter((s) => s.state === "next").sort((a, b) => !!opp(b) - !!opp(a) || Math.abs(a.round) - Math.abs(b.round))[0];
  const done = mine.filter((s) => s.state === "done"), lost = done.filter((s) => s.winner && s.winner !== who.id);
  const dbl = bkAll(r).some((s) => s.round < 0);                       // (double élimination : il faut perdre en losers, ou deux fois)
  const out = !live && !next && (lost.some((s) => s.round < 0) || lost.length >= 2 || (lost.length > 0 && !dbl));
  return { who, set: live || next || null, kind: live ? "live" : next ? "next" : out ? "out" : done.length ? "wait" : "none", opp: (live || next) ? opp(live || next) : null, w: done.length - lost.length, l: lost.length };
}
const bkKey = (st) => st ? `${st.kind}:${st.set?.id || ""}:${st.opp?.id || ""}` : "";
async function refreshBracket(auto) {
  if (!BK || BK.busy) return;
  const eid = BK.eid, old = BK.data, before = old ? bkKey(bkStatus(old)) : null;
  BK.busy = true; const cd = $("#bk-cd"); if (cd) cd.textContent = "lecture…";
  try {
    const r = await loadBracket(eid);
    if (BK?.eid !== eid) return;
    if (old) { const o = new Map(bkAll(old).map((s) => [s.id, s.state])); BK.fresh = new Set(bkAll(r).filter((s) => s.state === "done" && o.has(s.id) && o.get(s.id) !== "done").map((s) => s.id)); }
    BK.data = r; D.brackets = Object.fromEntries(Object.entries({ ...(D.brackets || {}), [eid]: r }).slice(-5)); save();
    const st = bkStatus(r);
    if (old && before !== null && bkKey(st) !== before && st) {
      const nm = BK.hl ? st.who.name : "Toi", o = st.opp?.name;
      const msg = st.kind === "live" ? `${nm} : set lancé${o ? " contre " + o : ""} (${bkLab(st.set.label)})` : st.kind === "next" ? (o ? `${nm} : prochain adversaire ${o} (${bkLab(st.set.label)})` : `${nm} : en attente du prochain set`)
        : st.kind === "out" ? `${nm} : éliminé·e (${st.w}–${st.l} en sets)` : `${nm} : set terminé`;
      alertMe(r.name, msg);
    }
    if (BK.fresh.size && auto) toast(`📡 ${BK.fresh.size} nouveau(x) résultat(s)`);
  } catch (e) {
    if (BK?.eid !== eid) return;
    if (!BK.data) { BK.busy = false; return sheet(`<h2>🏆 ${esc(BK.title)}</h2><div class="card">⚠ ${esc(e.message)}</div><div class="btns">${closeBtn()}</div>`); }
    if (!auto) toast(e.message + " (dernière version gardée)", true);
  } finally { if (BK?.eid === eid) { BK.busy = false; BK.next = Date.now() + BK_EVERY(); } }
  if (BK?.eid === eid && CUR === BKDRAW && !$("#sheet-back").hidden) { const w = $(".bk-wrap")?.scrollLeft, t = $("#sheet").scrollTop; drawBracket(); if ($(".bk-wrap") && w != null) $(".bk-wrap").scrollLeft = w; $("#sheet").scrollTop = t; }
}
setInterval(() => {
  if (!BK || CUR !== BKDRAW || $("#sheet-back").hidden || !BK.data || BK.data.state === "done") return;
  const cd = $("#bk-cd"); if (!BK.live) { if (cd) cd.textContent = "en pause"; return; }
  const left = Math.max(0, Math.ceil((BK.next - Date.now()) / 1000));
  if (cd && !BK.busy) cd.textContent = `maj dans ${left} s`;
  if (!left && !document.hidden) refreshBracket(true);
}, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && BK && CUR === BKDRAW && BK.live && BK.data?.state !== "done" && !$("#sheet-back").hidden) refreshBracket(true); });
function bkBanner(r) {
  if (r.state === "done" && !BK.hl) return "";
  const st = bkStatus(r); if (!st) return "";
  const nm = BK.hl ? esc(st.who.name) : "Toi", s = st.set, o = st.opp;
  const sc = (x) => x?.score == null ? "" : x.score;
  const go = s ? ` <button class="btn small" data-act="bk-go" data-id="${esc(s.id)}">🎯 Voir</button>` : "";
  const scoutB = o && /^\d+$/.test(o.pid || "") ? `<button class="btn small" data-scout="${esc(o.pid)}" data-name="${esc(o.name)}">🔭 Scouter</button>` : "";
  const body = st.kind === "live" ? `<b>🔴 Set en cours</b> · ${esc(bkLab(s.label))}<div class="bk-vs">${nm} <b>${sc(s.slots.find((x) => x && x !== o))}–${sc(o)}</b> ${esc(o?.name || "?")}</div>`
    : st.kind === "next" ? `<b>⏭ Prochain set</b> · ${esc(bkLab(s.label))}${s.pname && r.phases.length > 1 ? " · " + esc(s.pname) : ""}<div class="bk-vs">${nm} vs ${o ? `<b>${esc(o.name)}</b>${o.seed ? ` <span class="muted">(seed ${o.seed})</span>` : ""}` : '<span class="muted">adversaire pas encore connu</span>'}</div>`
    : st.kind === "out" ? `<b>${BK.hl ? "Éliminé·e" : "Run terminée"}</b> · ${st.w}–${st.l} en sets` : st.kind === "wait" ? `<b>⏳ En attente</b> · ${st.w}–${st.l} en sets pour l'instant` : `<b>${nm}</b> : pas encore de set`;
  return `<div class="card bk-live ${st.kind}">${BK.hl ? `<div class="muted small">⭐ Suivi : ${esc(st.who.name)} · <a href="#" data-act="bk-me">revenir à moi</a></div>` : ""}${body}${go || scoutB ? `<div class="btns" style="margin-top:6px">${go}${scoutB}</div>` : ""}</div>`;
}
const isMeBk = (x, r) => !!r.me && (x.pid === r.me || x.id === r.me);
function drawBracket() {
  const r = BK?.data;
  if (!r) return sheet(`<h2>🏆 ${esc(BK.title)}</h2><div class="card muted">Lecture du bracket…</div><div class="btns">${closeBtn()}</div>`);
  CUR = BKDRAW;
  const meIn = (g) => g.sets.some((s) => s.slots.some((x) => x && isMeBk(x, r)));
  if (!r.phases.some((p) => p.id === BK.phase)) { const ph = r.phases.slice().reverse().find((p) => p.groups.some(meIn)) || r.phases[r.phases.length - 1]; BK.phase = ph?.id; BK.group = (ph?.groups.find(meIn) || ph?.groups[0])?.id; }
  const ph = r.phases.find((p) => p.id === BK.phase), g = ph?.groups.find((x) => x.id === BK.group) || ph?.groups[0];
  const isGF = (s) => s.round > 0 && /grand/i.test(s.label);
  const col = (lab, l) => `<div class="bk-col"><div class="bk-rd">${esc(lab)}</div><div class="bk-sets">${l.map(bkSet).join("")}</div></div>`;
  const side = (pos) => { const m = new Map(); for (const s of (g?.sets || [])) if ((pos ? s.round > 0 : s.round < 0) && !isGF(s)) { if (!m.has(s.round)) m.set(s.round, []); m.get(s.round).push(s); }
    const cols = [...m.keys()].sort((a, b) => Math.abs(a) - Math.abs(b)).map((k) => col(bkLab(m.get(k)[0].label), m.get(k).sort((a, b) => a.ident.length - b.ident.length || a.ident.localeCompare(b.ident) || (a.order || 0) - (b.order || 0))));
    if (pos) (g?.sets || []).filter(isGF).sort((a, b) => /reset/i.test(a.label) - /reset/i.test(b.label) || a.id.localeCompare(b.id, undefined, { numeric: true })).forEach((s, i) => cols.push(col(i ? "Grande finale (reset)" : "Grande finale", [s])));
    return cols.join(""); };
  const bkSet = (s) => {
    const me = s.slots.some((x) => x && isMeBk(x, r)), on = BK.hl && s.slots.some((x) => x && x.id === BK.hl);
    const row = (x) => { if (!x) return '<div class="bk-p empty"><span class="bk-seed"></span><span class="bk-name">—</span></div>';
      const done = s.state === "done", win = done && s.winner === x.id, lose = done && s.winner && !win, sc = x.score == null ? (win ? "✓" : "") : x.score < 0 ? "DQ" : x.score;
      return `<div class="bk-p ${win ? "win" : ""} ${lose ? "lose" : ""} ${isMeBk(x, r) ? "me" : ""}" data-bkp="${esc(x.id)}"><span class="bk-seed">${x.seed ?? ""}</span><span class="bk-name">${esc(x.name)}</span><span class="bk-ch">${(s.chars[x.id] || []).slice(0, 2).map((c) => ci(c, "xs")).join("")}</span><b class="bk-sc">${sc}</b></div>`; };
    return `<div class="bk-set ${me ? "me" : ""} ${on ? "on" : ""} ${s.state} ${BK.hl && !on ? "dim" : ""} ${BK.fresh?.has(s.id) ? "fresh" : ""}" data-bks="${esc(s.id)}">${s.state === "live" ? '<span class="bk-dot">● en cours</span>' : ""}${row(s.slots[0])}${row(s.slots[1])}</div>`; };
  const w = side(true), l = side(false), st = { done: "terminé", live: "en cours", next: "à venir" }[r.state];
  sheet(`<h2 style="margin-bottom:2px">🏆 ${esc(r.name)}</h2><div class="muted small">${esc(r.tournament || BK.title)} · <b>${st}</b> · lu ${ago(new Date(r.at * 1000).toISOString())} · <a href="#" data-act="bk-refresh">actualiser</a></div>
    ${r.state !== "done" ? `<div class="bk-direct small"><button class="stage ${BK.live ? "on" : ""}" data-act="bk-live">📡 Direct ${BK.live ? "activé" : "en pause"}</button> <span class="muted" id="bk-cd">${BK.busy ? "lecture…" : BK.live ? "" : "en pause"}</span></div>` : ""}
    ${bkBanner(r)}
    ${r.phases.length > 1 ? `<div class="chips">${r.phases.map((p) => `<button class="stage ${p.id === ph.id ? "on" : ""}" data-act="bk-ph" data-id="${esc(p.id)}">${esc(p.name)}${p.groups.some(meIn) ? " ★" : ""}</button>`).join("")}</div>` : ""}
    ${ph && ph.groups.length > 1 ? `<div class="chips">${ph.groups.map((x) => `<button class="stage ${x.id === g.id ? "on" : ""}" data-act="bk-g" data-id="${esc(x.id)}">${esc(x.name || "Poule")}${meIn(x) ? " ★" : ""}</button>`).join("")}</div>` : ""}
    <div class="bk-wrap">${w ? `<div class="bk-sname">Winners</div><div class="bk-cols">${w}</div>` : ""}${l ? `<div class="bk-sname">Losers</div><div class="bk-cols">${l}</div>` : ""}${!w && !l ? '<div class="muted small">Pas encore de sets.</div>' : ""}</div>
    <div class="muted small">Touche un joueur pour suivre son parcours. Glisse pour te déplacer.</div><div class="btns">${closeBtn()}</div>`);
}
const bkLab = (s) => String(s || "").replace(/^(Winners|Losers) /, "").replace("Round", "Tour").replace("Quarter-Final", "Quart").replace("Semi-Final", "Demie").replace("Final", "Finale");

/* ------------------------------------------------------------ 🏟 mode tournoi : la run se met à jour seule, avec des alertes */
function liveTournaments() {
  const t = Date.now();
  return ups().filter((u) => (u.start || 0) * 1000 <= t && (u.start || 0) * 1000 > t - 3 * 864e5 && u.events.some(liveOk));
}
const nextKey = (r) => (r?.sets || []).filter((x) => x.res === "next" || x.res === "live").map((x) => x.res + ":" + (x.pid || x.name)).join("|");
async function pollLive() {
  if (document.hidden || (!D.cfg.sgToken && !D.cfg.shobuKey)) return;
  const lt = liveTournaments(); if (!lt.length) return;
  for (const u of lt) for (const ev of u.events) {
    if (!liveOk(ev)) continue;
    const before = (D.live || {})[ev.eid];
    let r; try { r = await liveRun(ev); } catch (_) { continue; }
    if (before && nextKey(before) !== nextKey(r)) {
      const nx = r.sets.find((x) => x.res === "live") || r.sets.find((x) => x.res === "next");
      if (nx) { alertMe(u.name, nx.res === "live" ? `Ton set contre ${nx.name} est lancé (${nx.label})` : `Prochain adversaire : ${nx.name} (${nx.label})`); if (nx.pid) scout(nx.pid).catch(() => {}); }
    }
    const el = $(`#live-${CSS.escape(ev.eid)}`); if (el) el.innerHTML = liveHTML(r, stats(allSets()));
  }
  if (D.tab === "home" && $("#sheet-back").hidden) render();
}
function alertMe(title, body) {
  try { navigator.vibrate?.([200, 100, 200]); } catch (_) {}
  toast("🏟 " + body);
  window.__alerts = (window.__alerts || []).concat(body);
  if ("Notification" in window && Notification.permission === "granted" && navigator.serviceWorker?.controller)
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, { body, icon: "icon-192.png", badge: "icon-192.png", tag: "sigo-run", renotify: true })).catch(() => {});
}
setInterval(pollLive, +localStorage.getItem("sigo.dev.poll") || 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) pollLive(); });

/* ------------------------------------------------------------ 📥 le scouting préparé d'avance (lisible hors ligne) */
let prefetching = false;
async function prefetchScouts() {
  if (prefetching || !D.cfg.sgToken) return;
  prefetching = true;
  const want = new Map();
  for (const u of ups()) for (const ev of u.events) {
    if ((u.start || 0) * 1000 > Date.now()) (bracketPath(ev) || []).forEach((r) => /^\d+$/.test(r.e?.pid || "") && want.set(r.e.pid, r.e.tag || r.e.name));
    const r = (D.live || {})[ev.eid]; (r?.sets || []).filter((x) => (x.res === "next" || x.res === "live") && x.pid).forEach((x) => want.set(x.pid, x.name));
  }
  let n = 0;
  for (const [pid] of [...want].slice(0, 10)) {
    if (D.scout[pid] && now() - D.scout[pid].at < 24 * 3600) continue;
    try { await scout(pid, true); n++; } catch (_) { break; }
    await new Promise((r) => setTimeout(r, 700));
  }
  prefetching = false;
  if (n) { status(`📥 Scouting préparé : ${n} fiche(s), lisible(s) sans réseau.`); setTimeout(() => status(""), 4000); }
}

/* ------------------------------------------------------------ 🗺 l'assistant de stages */
const DEF_STARTERS = ["Battlefield", "Final Destination", "Pokémon Stadium 2", "Smashville", "Town and City"];
const DEF_CPS = ["Small Battlefield", "Kalos Pokémon League", "Hollow Bastion", "Yoshi's Story"];
const starters = () => D.cfg.starters?.length ? D.cfg.starters : DEF_STARTERS;
const counterpicks = () => D.cfg.cps?.length ? D.cfg.cps : DEF_CPS;
function stageStats(char) {
  const all = new Map(), vs = new Map();
  const add = (m, k, w) => { const x = m.get(k) || { w: 0, l: 0 }; w ? x.w++ : x.l++; m.set(k, x); };
  for (const s of allSets()) if (!s.dq) for (const g of games(s)) {
    if (!g.stage || g.win == null) continue;
    add(all, g.stage, g.win); if (char && charName(g.opp) === char) add(vs, g.stage, g.win);
  }
  return { all, vs };
}
function stageScore(name, ss) {   // (lissé : 1 victoire sur 1 ne vaut pas 100 %)
  const v = ss.vs.get(name), a = ss.all.get(name);
  if (v && v.w + v.l >= 2) return { s: (v.w + 1) / (v.w + v.l + 2), src: "vs", x: v };
  if (a && a.w + a.l >= 2) return { s: (a.w + 1) / (a.w + a.l + 2), src: "all", x: a };
  return { s: null };
}
function stageBlock(char) {
  const chars = [...new Set(Object.values(D.chars))].sort();
  const ss = stageStats(char), pool = [...new Set([...starters(), ...counterpicks()])];
  const scored = pool.map((n) => ({ n, ...stageScore(n, ss) })).filter((x) => x.s != null);
  const asc = scored.slice().sort((a, b) => a.s - b.s), half = Math.ceil(asc.length / 2);
  const bans = asc.slice(0, Math.min(2, half)).filter((x) => x.s < .5 || asc.length > 1);                     // (les plus faibles…
  const picks = asc.slice().reverse().filter((x) => !bans.includes(x) && x.s >= .5).slice(0, 2);            //  …et les meilleures, jamais les mêmes)
  const line = (x) => `<b>${esc(x.n)}</b> <span class="muted small">${x.x.w}-${x.x.l}${x.src === "all" ? " (tous persos)" : ""}</span>`;
  return `<div class="card stages" data-char="${esc(char)}"><h3>🗺 Stages ${char ? `contre ${esc(char)}` : ""}</h3>
    <select class="stage-char" aria-label="Personnage adverse"><option value="">(tous les persos)</option>${chars.map((c) => `<option ${c === char ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
    ${scored.length ? `${bans.length ? `<div class="small" style="margin-top:8px">🚫 À bannir : ${bans.map(line).join(" · ")}</div>` : ""}${picks.length ? `<div class="small" style="margin-top:4px">✅ Counterpick : ${picks.map(line).join(" · ")}</div>` : ""}`
      : '<div class="muted small" style="margin-top:8px">Pas assez de games avec le stage renseigné pour conseiller (2 games par stage au moins). Le strike marche quand même.</div>'}
    <div class="small muted" style="margin-top:10px">Strike des starters : touche un stage pour le barrer.</div>
    <div class="chips">${starters().map((n) => `<button class="stage" data-act="strike" data-stage="${esc(n)}">${esc(n)}</button>`).join("")}</div>
    <div class="small strike-hint"></div></div>`;
}
function strikeHint(box) {
  if (!box) return;
  const ss = stageStats(box.dataset.char), left = $$(".stage:not(.struck)", box).map((b) => b.dataset.stage);
  const h = $(".strike-hint", box);
  if (left.length <= 1) { h.innerHTML = left.length ? `➡ On joue sur <b>${esc(left[0])}</b>.` : ""; return; }
  const sc = left.map((n) => ({ n, ...stageScore(n, ss) })).filter((x) => x.s != null).sort((a, b) => a.s - b.s);
  h.innerHTML = sc.length ? `À barrer en priorité : <b>${esc(sc[0].n)}</b> <span class="muted">(${Math.round(sc[0].s * 100)} % estimé)</span> · ta meilleure : <b>${esc(sc[sc.length - 1].n)}</b>` : "";
}
document.addEventListener("change", (e) => {
  if (!e.target.matches(".stage-char")) return;
  const old = e.target.closest(".stages"); old.outerHTML = stageBlock(e.target.value);
});

/* ------------------------------------------------------------ 📤 partager la carte de résultat */
async function cardImage(t, st) {
  const W = 1080, H = 1080, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const img = (src) => new Promise((res) => { if (!src) return res(null); const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  const [banner, lg] = await Promise.all([img(t.tbanner), img(t.timg)]);
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#12141c"); g.addColorStop(1, "#262b48"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const T = (s, X, Y, f, col = "#fff", al = "left") => { x.font = f; x.fillStyle = col; x.textAlign = al; x.fillText(s, X, Y); x.textAlign = "left"; };
  try {
    if (banner) { const r = Math.max(W / banner.width, 300 / banner.height); x.globalAlpha = .5; x.drawImage(banner, (W - banner.width * r) / 2, (300 - banner.height * r) / 2, banner.width * r, banner.height * r); x.globalAlpha = 1; }
    if (lg) { x.save(); x.beginPath(); x.roundRect(70, 220, 150, 150, 24); x.clip(); x.drawImage(lg, 70, 220, 150, 150); x.restore(); }
    c.toDataURL();                                                   // (une image sans CORS « tache » le canvas : on la retire)
  } catch (_) { x.fillStyle = g; x.fillRect(0, 0, W, H); }
  const fade = x.createLinearGradient(0, 200, 0, 330); fade.addColorStop(0, "rgba(18,20,28,0)"); fade.addColorStop(1, "#171a2a"); x.fillStyle = fade; x.fillRect(0, 200, W, 130);
  x.font = "800 52px system-ui, sans-serif"; let name = t.name; while (x.measureText(name).width > 760 && name.length > 8) name = name.slice(0, -2);
  T(name + (name !== t.name ? "…" : ""), 250, 300, "800 52px system-ui, sans-serif");
  T(`${fmtDate(t.ts)} · ${t.entrants || "?"} joueurs`, 252, 350, "400 30px system-ui, sans-serif", "#aab0c8");
  T(ordinal(t.place), 70, 580, "800 190px system-ui, sans-serif", "#e8a33d");
  T(`seed ${t.seed || "?"}${t.spr != null ? ` · ${t.spr > 0 ? "+" : ""}${t.spr} palier(s)` : ""} · ${t.w}-${t.l} en sets`, 76, 650, "500 32px system-ui, sans-serif", "#cfd4ea");
  let y = 740;
  for (const s of t.sets.slice().sort((a, b) => (a.ts || "").localeCompare(b.ts || "")).slice(0, 6)) {
    x.fillStyle = s.win ? "#4cc38a" : "#e5646e"; x.beginPath(); x.roundRect(70, y - 30, 48, 40, 8); x.fill();
    T(s.win ? "V" : "D", 94, y, "800 24px system-ui, sans-serif", "#12141c", "center");
    T(s.opp.slice(0, 26), 140, y, "600 32px system-ui, sans-serif"); T(`${s.score?.[0] ?? "?"}-${s.score?.[1] ?? "?"}`, 760, y, "400 30px system-ui, sans-serif", "#aab0c8");
    if (s.win && st.uf(s) > 0) T("UPSET", 1010, y, "700 24px system-ui, sans-serif", "#e8a33d", "right");
    y += 52;
  }
  const p = D.player; T(p ? (p.prefix ? p.prefix + " | " : "") + p.tag : "", 70, H - 50, "700 32px system-ui, sans-serif", "#cfd4ea");
  T("Smash Ultimate · start.gg", W - 70, H - 50, "400 24px system-ui, sans-serif", "#7c8199", "right");
  return new Promise((res) => c.toBlob(res, "image/png"));
}
async function shareCard(k) {
  const st = stats(allSets()), t = st.tours.find((x) => x.key === k); if (!t) return;
  toast("🖼 Préparation de l'image…");
  const blob = await cardImage(t, st), file = new File([blob], `Smash - ${t.name.replace(/[^\w\- ]+/g, "")}.png`, { type: "image/png" });
  window.__lastCard = blob.size;
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: t.name, text: `${ordinal(t.place)} à ${t.name}` }); } catch (_) {} return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  toast("💾 Image enregistrée dans tes téléchargements.");
}

/* ------------------------------------------------------------ le casier : GitHub privé, chiffré */
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(String(s).replace(/\s+/g, "")), (c) => c.charCodeAt(0));
async function aesKey(pw, salt, iter) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encrypt(obj) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iter = 150000;
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(D.cfg.pass, salt, iter), enc.encode(JSON.stringify(obj))));
  return { sigo: 1, enc: "AES-256-GCM", kdf: "PBKDF2-SHA256", iter, salt: b64(salt), iv: b64(iv), data: b64(ct) };
}
async function decrypt(env) {
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(env.iv) }, await aesKey(D.cfg.pass, unb64(env.salt), env.iter || 150000), unb64(env.data));
    return JSON.parse(dec.decode(plain));
  } catch (_) { throw new Error("Déchiffrement impossible : le mot de passe n'est pas le même que dans le Hub."); }
}
async function gh(method, name, body) {
  let r;
  try {
    r = await fetch(`${GH()}/repos/${D.cfg.repo}/contents/${name}`, { method, cache: "no-store",
      headers: { Authorization: "Bearer " + D.cfg.ghToken, Accept: "application/vnd.github+json", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch (_) { throw new Error("GitHub injoignable (réseau)."); }
  if (method === "GET" && r.status === 404) return null;
  if (method === "PUT" && (r.status === 409 || r.status === 422)) return { conflict: true };
  if (r.status === 401) throw new Error("Jeton GitHub refusé (⚙ Réglages).");
  if (r.status === 403 || r.status === 404) throw new Error("GitHub refuse l'accès au dépôt : vérifie son nom et les droits du jeton (Contents : lecture et écriture).");
  if (!r.ok) throw new Error("GitHub a répondu " + r.status);
  return r.json();
}
async function ghGet(name) { const d = await gh("GET", name); return d ? { obj: JSON.parse(dec.decode(unb64(d.content))), sha: d.sha } : { obj: null, sha: null }; }
const ghPut = (name, obj, sha, message) => gh("PUT", name, { message, content: b64(enc.encode(JSON.stringify(obj))), ...(sha ? { sha } : {}) });
function merge(flat, stamps, remote) {
  const out = {}, st = {}, doc = {}, t0 = now();
  for (const k of new Set([...Object.keys(flat), ...Object.keys(stamps), ...Object.keys(remote)])) {
    const lt = stamps[k] ?? (k in flat ? 1 : 0), r = remote[k];
    let t, v;
    if (r && +r.t > lt) { t = +r.t; v = r.v ?? null; } else { t = lt; v = k in flat ? flat[k] : null; }
    if (v == null && t0 - t > 180 * 86400) continue;
    st[k] = t; doc[k] = { t, v }; if (v != null) out[k] = v;
  }
  return [out, st, doc];
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function syncCloud() {
  const c = D.cfg;
  if (!c.repo || !c.ghToken || !c.pass) throw new Error("Synchro avec le Hub pas réglée (⚙ Réglages).");
  let got = 0, sent = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { obj, sha } = await ghGet("carnet.enc.json");
    const remote = obj ? ((await decrypt(obj)).entries || {}) : {};
    const [flat, st, doc] = merge(D.carnet.flat, D.carnet.stamps, remote);
    got = Object.keys({ ...flat, ...D.carnet.flat }).filter((k) => !same(flat[k], D.carnet.flat[k])).length;
    D.carnet = { flat, stamps: st }; save();
    sent = Object.keys(doc).filter((k) => !same(remote[k], doc[k])).length;
    if (!sent && obj) break;
    const r = await ghPut("carnet.enc.json", await encrypt({ v: 1, entries: doc }), sha, "Carnet Smash (depuis le téléphone)");
    if (!r.conflict) break;
    if (attempt === 2) throw new Error("Le Hub écrivait en même temps : réessaie.");
  }
  // l'instantané start.gg du Hub : pris s'il est plus récent que le nôtre
  const snap = await ghGet("hub.enc.json");
  let snapUsed = false;
  let snapShobu = null;
  if (snap.obj) {
    const s = await decrypt(snap.obj); snapShobu = s;
    if (s.last_sync && (!D.lastSg || new Date(s.last_sync) > new Date(D.lastSg))) {
      D.sets = s.sets || D.sets; D.chars = Object.keys(s.chars || {}).length ? s.chars : D.chars; D.player = s.player || D.player;
      if (s.charimg || s.avatars) D.media = { charimg: s.charimg || {}, avatars: s.avatars || {} };
      if (s.upcoming && s.upcoming.tournaments && (!D.upcoming || (s.upcoming.at || 0) > (D.upcoming.at || 0))) D.upcoming = s.upcoming;
      if (!c.profile && s.profile) c.profile = "https://www.start.gg/" + s.profile;
      if (!c.shobuUser && s.shobu_user) c.shobuUser = s.shobu_user;
      D.lastSg = new Date(s.last_sync).toISOString(); D.source = "hub"; snapUsed = true;
    }
  }
  if (snap.obj) {                                   // 🥋 les tournois Shobu (trouvés ou cochés dans le Hub) : toujours ceux du Hub
    const s = snapShobu;
    if (s?.upcoming?.tournaments) {
      const sh = s.upcoming.tournaments.filter((t) => t.src === "shobu");
      const mine = (D.upcoming?.tournaments || []).filter((t) => t.src !== "shobu");
      D.upcoming = { ...(D.upcoming || { at: s.upcoming.at, me: s.upcoming.me }), tournaments: [...mine, ...sh].sort((a, b) => (a.start || 0) - (b.start || 0)) };
    }
  }
  D.lastCloud = new Date().toISOString(); save();
  return { got, sent, snapUsed };
}
let cloudT = null;
function cloudSoon() { if (!D.cfg.repo || !D.cfg.ghToken || !D.cfg.pass) return; clearTimeout(cloudT); cloudT = setTimeout(() => syncCloud().then(() => render()).catch((e) => status("☁ " + e.message, true)), 4000); }
async function syncAll() {
  if ($("#sync").classList.contains("spin")) return;
  $("#sync").classList.add("spin"); status("Synchronisation…");
  const msgs = []; let err = false;
  if (D.cfg.repo && D.cfg.ghToken && D.cfg.pass) {
    try { const r = await syncCloud(); msgs.push(`☁ Hub : ${r.got} reçue(s), ${r.sent} envoyée(s)${r.snapUsed ? ", données start.gg du PC" : ""}`); }
    catch (e) { msgs.push("☁ " + e.message); err = true; }
  }
  if (D.cfg.sgToken && D.cfg.profile) {
    try { const n = await syncStartgg(); msgs.push(`start.gg : ${n} nouveau(x) set(s)`); }
    catch (e) { msgs.push(e.message + (D.lastSg ? ` · données du ${fmtDate(D.lastSg)}` : "")); err = true; }
  }
  if (!msgs.length) { msgs.push("Rien à synchroniser : ⚙ Réglages."); err = true; }
  $("#sync").classList.remove("spin");
  status(msgs.join(" · "), err); if (!err) setTimeout(() => status(""), 4000);
  render();
  pollLive(); prefetchScouts();
}

/* ------------------------------------------------------------ les écrans */
const TABS = { home: viewHome, tours: viewTours, players: viewPlayers, mu: viewMatchups, carnet: viewCarnet };
function render() {
  $$("#tabs [data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === D.tab));
  const p = D.player;
  $("#title").textContent = p ? (p.prefix ? p.prefix + " | " : "") + p.tag : "Sigo Smash";
  const v = $("#view");
  if (!D.cfg.sgToken && !D.cfg.repo && !D.cfg.shobuKey) { v.innerHTML = viewWelcome(); return; }
  v.innerHTML = (TABS[D.tab] || viewHome)();
  bindView();
}
function viewWelcome() {
  return `<div class="card setup"><h2>🎮 Sigo Smash</h2><p>L'espace Smash du Hub, dans ta poche : tes stats start.gg, tes prochains tournois et ton chemin dans le bracket, le scouting, ton carnet.</p>
    <ol><li>Dans le Hub : 🎮 Smash → 📱 Téléphone, pour créer ton dépôt privé et tes jetons.</li><li>Ici : ⚙ Réglages, colle les mêmes informations.</li><li>⟳ pour tout récupérer.</li></ol>
    <button class="btn accent" data-act="settings" style="width:100%">⚙ Réglages</button></div>`;
}
function viewHome() {
  const sets = allSets(), st = stats(sets), t = st.tours[0];
  const up = ups().filter((x) => (x.start || 0) * 1000 > Date.now() - 864e5).slice(0, 3);
  const goals = C.section("goals").map(([, g]) => g);
  const live = liveTournaments();
  const ask = live.length && "Notification" in window && Notification.permission === "default";
  return `${live.map((u) => { const r = u.events.map((ev) => (D.live || {})[ev.eid]).find(Boolean), nx = r && (r.sets.find((x) => x.res === "live") || r.sets.find((x) => x.res === "next"));
      return `<div class="card tmode" data-up="${esc(u.tid)}"><div class="small tmode-h">🏟 MODE TOURNOI · actualisé chaque minute</div><b>${esc(u.name)}</b>
        <div class="small">${r ? (r.out ? "Éliminé · " : "") + (nx ? (nx.res === "live" ? `● En cours contre <b>${esc(nx.name)}</b>` : `Prochain : <b>${esc(nx.name)}</b> · ${esc(nx.label)}`) : r.out ? "" : "En attente du prochain set") : "Lecture de ta run…"}</div></div>`; }).join("")}
    ${ask ? '<button class="btn" data-act="notif" style="width:100%;margin-bottom:10px">🔔 Activer les alertes (prochain adversaire, set lancé)</button>' : ""}
    <div class="kpis"><div class="kpi"><b>${st.pct} %</b><span>sets ${st.W}-${st.L}</span></div><div class="kpi"><b>${st.gpct} %</b><span>games ${st.gw}-${st.gl}</span></div><div class="kpi"><b>${st.tours.length}</b><span>tournois</span></div></div>
    ${up.length ? `<h2>🗓 À venir</h2>${up.map((u) => `<div class="card row" data-up="${esc(u.tid)}">${logo(u.timg, u.name)}<div class="grow"><div><b>${esc(u.name)}</b></div><div class="muted small">${esc(fmtDay(u.start))} · <b>${countdown(u.start)}</b>${u.events[0]?.me?.seed ? ` · seed ${u.events[0].me.seed}` : ""}</div></div>›</div>`).join("")}` : ""}
    ${t ? `<h2>🏆 Dernier tournoi</h2><div class="card" data-tour="${esc(t.key)}"><div class="banner" ${t.tbanner ? `style="background-image:url('${esc(t.tbanner)}')"` : ""}></div>
      <div class="row" style="border:none;padding:0">${logo(t.timg, t.name)}<div class="grow"><div><b>${esc(t.name)}</b></div><div class="muted small">${fmtDate(t.ts)} · ${t.entrants || "?"} joueurs</div></div>
      <div style="text-align:right"><div class="big">${ordinal(t.place)}</div><div class="small">${wl(t.w, t.l)}</div></div></div></div>` : ""}
    ${goals.length ? `<h2>🎯 Objectifs</h2>${goals.map((g) => goalCard(g, sets)).join("")}` : ""}
    <div class="muted small" style="text-align:center;margin-top:14px">start.gg : ${D.lastSg ? fmtDate(D.lastSg) + (D.source === "hub" ? " (via le Hub)" : "") : "jamais"} · Hub : ${ago(D.lastCloud)}</div>`;
}
function goalTitle(g) { return g.title || { place: `Top ${g.n || "?"}${g.filter ? " à « " + g.filter + " »" : ""}`, beat: `Battre ${g.opp || "?"}`, winrate: `${g.n || "?"} % de victoires`, count: `Faire ${g.n || "?"} tournois`, free: "Objectif" }[g.kind]; }
function goalCard(g, sets) {
  const end = g.until || new Date().toISOString().slice(0, 10);
  const st = stats(sets.filter((s) => (s.ts || "").slice(0, 10) >= g.since && (s.ts || "").slice(0, 10) <= end));
  let pct = 0, done = false, txt = "";
  if (g.kind === "place") { const b = st.tours.filter((t) => t.place && (!g.filter || key(t.name).includes(key(g.filter)))).sort((a, c) => a.place - c.place)[0]; done = !!b && b.place <= g.n; pct = done ? 100 : b ? Math.max(5, Math.round(100 * (1 - (pIdx(b.place) - pIdx(g.n || 1)) / 6))) : 0; txt = b ? "meilleur : " + ordinal(b.place) : "pas encore de tournoi"; }
  else if (g.kind === "beat") { const o = st.opps.find((x) => x.id === g.opp_id); done = !!o && o.w > 0; pct = done ? 100 : 0; txt = o ? `${o.w}-${o.l} sur la période` : "pas encore joué"; }
  else if (g.kind === "winrate") { done = st.W + st.L >= 5 && st.pct >= g.n; pct = Math.min(100, Math.round(100 * st.pct / (g.n || 100))); txt = `${st.pct} % (${st.W}-${st.L})`; }
  else if (g.kind === "count") { done = st.tours.length >= g.n; pct = Math.min(100, Math.round(100 * st.tours.length / (g.n || 1))); txt = `${st.tours.length} / ${g.n}`; }
  else { done = !!g.done; pct = done ? 100 : 0; txt = done ? "fait" : "touche pour cocher"; }
  return `<div class="card" ${g.kind === "free" ? `data-goal="${esc(g.id)}"` : ""}><div class="row" style="border:none;padding:0;min-height:0"><div class="grow"><b>${esc(goalTitle(g))}</b></div><span class="small">${done ? "✅" : "⏳"}</span></div>
    <div class="bar ${done ? "done" : ""}"><span style="width:${pct}%"></span></div><div class="muted small">${txt}</div></div>`;
}
let tourSeg = "up";
function viewTours() {
  const st = stats(allSets()), up = ups();
  return `<div class="seg"><button data-seg="up" class="${tourSeg === "up" ? "on" : ""}">À venir (${up.length})</button><button data-seg="past" class="${tourSeg === "past" ? "on" : ""}">Passés (${st.tours.length})</button><button data-seg="find" class="${tourSeg === "find" ? "on" : ""}">🔎 Chercher</button></div>
    ${tourSeg === "find" ? viewFind() : tourSeg === "up" ? (up.map((u) => `<div class="card row" data-up="${esc(u.tid)}">${logo(u.timg, u.name)}<div class="grow"><div><b>${esc(u.name)}</b></div>
        <div class="muted small">${esc(fmtDay(u.start))} · ${countdown(u.start)}${u.city ? " · " + esc(u.city) : ""}</div></div>›</div>`).join("") || '<div class="empty">Aucun tournoi à venir où tu es inscrit.</div>')
    : `<div class="card">${st.tours.map((t) => `<div class="row" data-tour="${esc(t.key)}">${logo(t.timg, t.name)}<div class="grow"><div><b>${esc(t.name)}</b>${t.src === "shobu" ? ' <span class="chip shobu">Shobu</span>' : ""}</div>
        <div class="muted small">${fmtDate(t.ts)} · ${t.entrants || "?"} j. · ${wl(t.w, t.l)}</div></div><b>${ordinal(t.place)}</b></div>`).join("") || '<div class="empty">Pas encore de tournoi.</div>'}</div>`}`;
}
/* 🔎 chercher n'importe quel tournoi start.gg par son nom (une requête) ou son lien, pour voir son bracket ;
   la dernière recherche et les 12 derniers consultés restent sur le téléphone */
const T_F = `id name slug startAt city numAttendees isOnline images { url type } events(filter: {videogameId: [${ULT}]}) { id name numEntrants state }`;
const Q_TSEARCH = `query TS($q: String!) { tournaments(query: {perPage: 12, sortBy: "startAt desc", filter: {name: $q, videogameIds: [${ULT}]}}) { nodes { ${T_F} } } }`;
const Q_TSLUG = `query TSlug($slug: String!) { tournament(slug: $slug) { ${T_F} } }`;
const tView = (t) => ({ id: String(t.id), name: t.name || "", slug: t.slug || "", start: t.startAt || 0, city: t.city || "", online: !!t.isOnline, attendees: t.numAttendees || 0,
  logo: images(t)[0] || "", events: (t.events || []).map((e) => ({ eid: String(e.id), name: e.name || "", entrants: e.numEntrants || 0, state: e.state === "ACTIVE" ? "live" : e.state === "COMPLETED" ? "done" : "next" })) });
function findCard(t) {
  return `<div class="card"><div class="row" style="border:0;padding:0 0 6px">${logo(t.logo, t.name)}<div class="grow"><div><b>${esc(t.name)}</b></div>
      <div class="muted small">${t.start ? fmtDay(t.start) : ""}${t.online ? " · en ligne" : t.city ? " · " + esc(t.city) : ""}${t.attendees ? ` · ${t.attendees} j.` : ""}</div></div></div>
    <div class="chips">${t.events.map((e) => `<button class="stage" data-act="find-ev" data-tid="${esc(t.id)}" data-eid="${esc(e.eid)}">🏆 ${esc(e.name)} <span class="muted">${e.entrants || ""}</span>${e.state === "live" ? ' <span class="chip warn">● en cours</span>' : ""}</button>`).join("") || '<span class="muted small">Pas d\'épreuve Ultimate.</span>'}</div></div>`;
}
function viewFind() {
  const F = D.find || {};
  return `<div class="card"><div class="find"><input type="search" id="find-q" placeholder="Nom du tournoi (ou lien start.gg)…" value="${esc(F.q || "")}" enterkeyhint="search"><button class="btn accent" data-act="find-go">Chercher</button></div></div>
    <div id="find-res">${F.busy ? '<div class="muted small" style="padding:8px">Recherche sur start.gg…</div>' : F.error ? `<div class="card">⚠ ${esc(F.error)}</div>`
      : F.q ? `<h3 class="find-h">${/tournament\//.test(F.q) ? "Lien start.gg" : `Résultats pour « ${esc(F.q)} »`}</h3>${(F.results || []).map(findCard).join("") || '<div class="empty">Aucun tournoi Ultimate à ce nom.</div>'}` : ""}</div>
    ${(() => { const shown = new Set((F.q && !F.busy ? F.results || [] : []).map((t) => t.id)), rec = (F.recent || []).filter((t) => !shown.has(t.id));
      return rec.length ? `<h3 class="find-h">🕘 Derniers consultés</h3>${rec.map(findCard).join("")}` : ""; })()}`;
}
async function findGo() {
  const q = ($("#find-q")?.value || "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (q.length < 2) return toast("Tape au moins 2 lettres du nom du tournoi.", true);
  D.find = { ...(D.find || {}), q, busy: true, error: "" }; render();
  try {
    const m = q.match(/tournament\/([\w-]+)/);
    const nodes = m ? [(await gql(Q_TSLUG, { slug: m[1] })).tournament].filter(Boolean) : ((await gql(Q_TSEARCH, { q })).tournaments || {}).nodes || [];
    D.find = { ...D.find, busy: false, results: nodes.map(tView) };
  } catch (e) { D.find = { ...D.find, busy: false, error: e.message }; }
  save(); render();
}
let pq = "";
function viewPlayers() {
  const st = stats(allSets()), list = st.opps.filter((o) => !pq || key(o.name).includes(key(pq)));
  return `<input type="search" id="pq" placeholder="Chercher un joueur…" value="${esc(pq)}" style="margin-bottom:10px">
    <div class="card">${list.slice(0, 150).map((o) => `<div class="row" data-opp="${esc(o.id)}">${av(o.id, o.name)}<div class="grow"><div><b>${esc(o.name)}</b>${o.both ? ' <span class="chip shobu">🔗 Shobu</span>' : ""}${C.get("opp_notes", o.id) ? " 📝" : ""}</div>
      <div class="muted small">games ${o.gw}-${o.gl} · ${fmtDate(o.last)}</div></div><span>${wl(o.w, o.l)}</span></div>`).join("") || '<div class="empty">Personne.</div>'}</div>`;
}
function viewMatchups() {
  const st = stats(allSets()), M = new Map(st.opC.map((r) => [r.k, r]));
  const ks = [...new Set([...C.section("matchups").map(([k]) => k), ...st.opC.map((r) => r.k)])];
  return `<div class="card">${ks.map((k) => { const r = M.get(k); return `<div class="row" data-mu="${esc(k)}">${ci(k)}<div class="grow"><div><b>${esc(k)}</b>${C.get("matchups", k) ? " 📝" : ""}</div>
      <div class="muted small">${r ? `${st.pctOf(r.w, r.l)} % · games ${r.w}-${r.l}` : "pas de game renseigné"}</div></div>›</div>`; }).join("") || '<div class="empty">Aucun matchup : complète tes games, ou crée une fiche.</div>'}</div>
    <button class="fab" data-act="mu-new" aria-label="Nouvelle fiche">＋</button>`;
}
function viewCarnet() {
  const sets = allSets().slice(0, 250);
  return `<div class="card">${sets.map((s) => `<div class="row" data-set="${esc(s.id)}"><span class="res ${s.dq ? "" : s.win ? "w" : "l"}">${s.dq ? "DQ" : s.win ? "V" : "D"}</span>
      ${av(s.opp_id, s.opp, "sm")}<div class="grow"><div><b>${esc(s.opp)}</b> <span class="muted small">${s.score?.[0] ?? "?"}-${s.score?.[1] ?? "?"}</span>${[...new Set(games(s).map((g) => charName(g.opp)).filter(Boolean))].slice(0, 3).map((c) => ci(c, "xs")).join("")}</div><div class="muted small">${fmtDate(s.ts)} · ${esc(s.tournament)}</div></div>
      <span class="small">${C.get("vods", s.id) ? "🎬" : ""}${notes(s.id) ? "📝" : ""}${s.source === "manual" ? "✍" : ""}</span></div>`).join("") || '<div class="empty">Aucun set : ⟳ pour synchroniser.</div>'}</div>
    <button class="fab" data-act="set-new" aria-label="Ajouter un set">＋</button>`;
}

/* ------------------------------------------------------------ les fiches (en bas de l'écran) */
let CUR = null, BACK = null;                 // (la fiche ouverte, et celle où revenir depuis la fiche d'un joueur)
function sheet(html) { $("#sheet").innerHTML = html; $("#sheet-back").hidden = false; $("#sheet").scrollTop = 0; }
function closeSheet() { $("#sheet-back").hidden = true; CUR = BACK = null; render(); }
const sgLink = (url) => url ? `<a class="sglink" href="${esc(url)}" target="_blank" rel="noopener">${url.includes("shobuapp") ? "Shobu" : "start.gg"} ↗</a>` : "";
const closeBtn = () => BACK ? `<button class="btn" data-act="back">‹ Retour</button>` : `<button class="btn" data-act="close">Fermer</button>`;
function tourHead(name, banner, sub, slug) {
  return `<div class="card">${banner ? `<div class="banner" style="background-image:url('${esc(banner)}')"></div>` : ""}
    <div class="thead"><h2 style="margin:0;flex:1">${esc(name)}</h2>${sgLink(slug)}</div><div class="muted small">${sub}</div></div>`;
}
/* une ligne de « ma run » : un clic ouvre la fiche du joueur */
function runRow(r, st) {
  const o = r.pid && st.opps.find((x) => x.id === r.pid);
  const tap = r.pid ? (/^\d+$/.test(r.pid) ? `data-scout="${esc(r.pid)}" data-name="${esc(r.name)}"` : `data-opp="${esc(r.pid)}"`) : "";
  const res = { w: ["w", "V"], l: ["l", "D"], live: ["live", "●"], next: ["", "…"], bye: ["", "–"], wait: ["", "?"] }[r.res] || ["", "·"];
  return `<div class="row run" ${tap}><span class="res ${res[0]}">${res[1]}</span>${r.pid ? av(r.pid, r.name, "sm") : ""}
    <div class="grow"><div><b>${esc(r.name || "?")}</b>${r.seed ? ` <span class="muted small">(seed ${r.seed})</span>` : ""}${r.fav === false ? ' <span class="chip warn">favori</span>' : ""}${r.upset ? ' <span class="chip warn">upset</span>' : ""}${r.pid && C.get("opp_notes", r.pid) ? " 📝" : ""}${r.pid && D.scout[r.pid] ? ' <span title="Fiche de scouting disponible hors ligne">📥</span>' : ""}</div>
      <div class="muted small">${esc(r.label)}${r.score ? " · " + esc(r.score) : ""}</div></div>
    ${r.pid ? `<span class="small">${o ? wl(o.w, o.l) : '<span class="muted">1er set</span>'}</span><span class="muted">›</span>` : ""}</div>`;
}
function sheetTour(k) {
  const st = stats(allSets()), t = st.tours.find((x) => x.key === k); if (!t) return;
  CUR = () => sheetTour(k);
  const run = t.sets.slice().sort((a, b) => (a.ts || "").localeCompare(b.ts || "")).map((s) => ({ name: s.opp, pid: s.opp_id, seed: s.opp_seed, label: s.round || "",
    res: s.dq ? "wait" : s.win ? "w" : "l", score: s.dq ? "DQ" : `${s.score?.[0] ?? "?"}-${s.score?.[1] ?? "?"}`, upset: s.win && st.uf(s) > 0 }));
  sheet(`${tourHead(t.name, t.tbanner, `${fmtDate(t.ts)} · ${t.entrants || "?"} joueurs · seed ${t.seed || "?"} → <b>${ordinal(t.place)}</b> · ${wl(t.w, t.l)}`, t.url)}
    <div class="card"><h3>🏁 Ma run</h3>${run.map((r) => runRow(r, st)).join("")}</div>
    ${t.sets[0]?.eid ? `<button class="btn" data-act="bracket" data-eid="${esc(t.sets[0].eid)}" data-title="${esc(t.name)}" style="width:100%">🏆 Voir le bracket</button>` : ""}
    <div class="btns">${closeBtn()}<button class="btn accent" data-act="share" data-k="${esc(k)}">📤 Partager</button></div>`);
}
function bracketPath(ev) {
  const seeded = ev.list.filter((e) => e.seed), N = seeded.length, s = ev.me?.seed;
  if (!s || N < 2) return null;
  const by = new Map(seeded.map((e) => [e.seed, e])); let size = 1; while (size < N) size *= 2;
  const out = [];
  for (let m = size; m >= 2; m /= 2) {
    const o = m + 1 - s, label = m === 2 ? "Finale winners" : m === 4 ? "Demi-finale winners" : m === 8 ? "Quart de finale winners" : `Winners · top ${m}`;
    out.push(o > N ? { label, bye: true } : { label, seed: o, e: by.get(o), fav: s < o });
    if (o < s) break;
  }
  return out;
}
/* la run réelle d'un tournoi commencé : mes sets de l'event, lus en direct */
async function liveRun(ev) {
  if (String(ev.eid).startsWith("shobu:")) return shobuLive(ev);
  const d = (await gql(Q_RUN, { id: ev.eid, ent: ev.me.id })).event || {};
  const sets = ((d.sets || {}).nodes || []).map((n) => {
    const slots = (n.slots || []), mine = slots.find((x) => x.entrant && String(x.entrant.id) === String(ev.me.id)), opp = slots.find((x) => x !== mine);
    const oe = opp?.entrant, pl = (((oe?.participants || [])[0]) || {}).player || {};
    const sc = (x) => ((((x || {}).standing || {}).stats || {}).score || {}).value;
    const done = n.state === 3 || !!n.winnerId;
    return { order: n.completedAt || n.startedAt || (done ? 0 : 9e12) + (n.round < 0 ? 1e6 : 0) + Math.abs(n.round || 0), name: oe ? (oe.name || pl.gamerTag) : "À déterminer", pid: String(pl.id || ""),
      seed: oe?.initialSeedNum ?? null, label: n.fullRoundText || "", res: done ? (String(n.winnerId) === String(ev.me.id) ? "w" : "l") : !oe ? "wait" : n.state === 2 ? "live" : "next",
      score: done ? `${sc(mine) ?? "?"}-${sc(opp) ?? "?"}` : n.state === 2 ? "en cours" : !oe ? "adversaire pas encore connu" : "à jouer", upset: false };
  }).sort((a, b) => a.order - b.order);
  const losses = sets.filter((x) => x.res === "l").length;
  const r = { at: now(), state: d.state, sets, out: losses >= 2 || (losses >= 1 && d.state === "COMPLETED") };
  D.live = D.live || {}; D.live[ev.eid] = r; save();
  return r;
}
function liveHTML(r, st) {
  if (!r) return '<div class="muted small">Lecture de start.gg…</div>';
  const head = r.out ? "Éliminé" : r.state === "COMPLETED" ? "Tournoi terminé" : "En cours";
  return `${r.sets.map((x) => runRow(x, st)).join("") || '<div class="muted small">Aucun set pour l\'instant.</div>'}
    <div class="muted small" style="margin-top:6px">${head} · lu ${ago(new Date(r.at * 1000).toISOString())} · <a href="#" data-act="live-refresh">actualiser</a></div>`;
}
function sheetUp(tid) {
  const u = ups().find((x) => x.tid === tid); if (!u) return;
  CUR = () => sheetUp(tid);
  const st = stats(allSets()), started = (u.start || 0) * 1000 <= Date.now();
  sheet(`${tourHead(u.name, u.tbanner, `${esc(fmtDay(u.start))} · <b>${started ? "commencé" : countdown(u.start)}</b>${u.city ? " · " + esc(u.city) : ""}${u.attendees ? ` · ${u.attendees} inscrits` : ""}`, u.url || (u.slug ? "https://www.start.gg/" + u.slug : ""))}
    ${u.events.map((ev) => { const path = bracketPath(ev);
      let body;
      const shobu = String(ev.eid).startsWith("shobu:");
      if (started && shobu && !liveOk(ev)) body = `<h3>🏁 Ma run</h3><div class="muted small">Tournoi Shobu : ajoute ta clé Shobu dans ⚙ pour suivre ta run en direct ici (sinon, elle est dans le Hub). ${path ? "Ta run prévue :" : ""}</div>${path ? path.map((r) => r.bye ? "" : runRow({ label: r.label, name: r.e?.tag || r.e?.name, pid: r.e?.pid, seed: r.seed, fav: r.fav, res: "next" }, st)).join("") : ""}`;
      else if (started && ev.me?.id) body = `<h3>🏁 Ma run (réelle)</h3><div id="live-${esc(ev.eid)}" data-eid="${esc(ev.eid)}">${liveHTML((D.live || {})[ev.eid], st)}</div>`;
      else if (path) body = `<h3>🔮 Ma run (prévue)</h3>${path.map((r) => r.bye ? runRow({ label: r.label, res: "bye", name: "bye (personne à cette seed)" }, st)
          : runRow({ label: r.label, name: r.e?.tag || r.e?.name, pid: r.e?.pid, seed: r.seed, fav: r.fav, res: "next" }, st)).join("")}
        <div class="muted small" style="margin-top:6px">Projection : bracket unique où la meilleure seed gagne toujours (côté winners). Avec des poules, l'ordre réel diffère.</div>`;
      else body = `<div class="muted small">${ev.seeded ? "Tu n'es pas dans la liste seedée." : shobu && !ev.me ? "Inscrit (coché dans le Hub) : ta run prévue apparaîtra quand le bracket Shobu sera publié." : "Seeds pas encore publiées : ta run prévue apparaîtra ici."}</div>`;
      return `<div class="card"><h3>${esc(ev.name)} · ${ev.entrants} inscrits ${ev.me?.seed ? `· <span class="chip">ta seed ${ev.me.seed}</span>` : ""}</h3>${body}
        <button class="btn" data-act="bracket" data-eid="${esc(ev.eid)}" data-title="${esc(u.name + " · " + ev.name)}" style="width:100%;margin-top:8px">🏆 Voir le bracket</button></div>`; }).join("")}
    <div class="btns">${closeBtn()}</div>`);
  if (started) loadLive(u);
}
async function loadLive(u) {
  const st = stats(allSets());
  for (const ev of u.events) {
    if (!liveOk(ev)) continue;
    try { await liveRun(ev); } catch (e) { const el = $(`#live-${CSS.escape(ev.eid)}`); if (el) el.insertAdjacentHTML("beforeend", `<div class="muted small">⚠ ${esc(e.message)}</div>`); continue; }
    const el = $(`#live-${CSS.escape(ev.eid)}`); if (el) el.innerHTML = liveHTML(D.live[ev.eid], st);
  }
}
async function sheetScout(pid, name, refresh) {
  const st = stats(allSets()), mine = st.opps.find((o) => o.id === pid);
  sheet(`<h2>🔭 ${esc(name || "…")}</h2><div class="muted">Lecture de start.gg…</div>`);
  let r;
  try { r = await scout(pid, refresh); }
  catch (e) { sheet(`<h2>🔭 ${esc(name)}</h2><div class="card">${esc(e.message)}</div>${oppBlock(pid, name, mine)}<div class="btns">${closeBtn()}<button class="btn accent" data-act="save-opp" data-pid="${esc(pid)}">Enregistrer</button></div>`); return; }
  const p = r.player;
  sheet(`<h2>🔭 ${p.prefix ? `<span class="muted">${esc(p.prefix)} | </span>` : ""}${esc(p.tag)}</h2>
    <div class="muted small">${p.where ? esc(p.where) + " · " : ""}${r.w}-${r.l} sur ses ${r.w + r.l} derniers sets · <a href="#" data-act="rescout" data-pid="${esc(pid)}" data-name="${esc(name)}">actualiser</a></div>
    <div class="kpis" style="margin-top:10px"><div class="kpi"><b>${mine ? wl(mine.w, mine.l) : "–"}</b><span>toi contre lui</span></div><div class="kpi"><b>${r.chars[0] ? esc(r.chars[0].k) : "?"}</b><span>son perso</span></div><div class="kpi"><b>${r.tours[0] ? ordinal(r.tours[0].place) : "–"}</b><span>dernier tournoi</span></div></div>
    <div class="card"><h3>Ses derniers tournois</h3>${r.tours.map((t) => `<div class="row">${logo(t.timg, t.name)}<div class="grow"><div>${esc(t.name)}</div><div class="muted small">${fmtDate(t.ts)} · ${t.entrants || "?"} j.</div></div><b>${ordinal(t.place)}</b></div>`).join("") || '<div class="muted small">–</div>'}</div>
    ${r.chars.length ? `<div class="card"><h3>Ses persos</h3>${r.chars.map((c) => `<div class="row">${ci(c.k)}<div class="grow">${esc(c.k)}</div><span class="muted small">${c.n} games · ${Math.round(100 * c.w / c.n)} %</span></div>`).join("")}</div>` : ""}
    <div class="card"><h3>Victoires / défaites récentes</h3>${r.wins.slice(0, 5).map((x) => `<div class="small"><span class="w">V</span> ${esc(x.opp)} ${x.score?.join("-")} · <span class="muted">${esc(x.t)}</span></div>`).join("")}
      ${r.losses.slice(0, 5).map((x) => `<div class="small"><span class="l">D</span> ${esc(x.opp)} ${x.score?.join("-")} · <span class="muted">${esc(x.t)}</span></div>`).join("")}</div>
    ${stageBlock(r.chars[0]?.k || "")}
    ${oppBlock(pid, p.tag, mine)}<div class="btns">${closeBtn()}<button class="btn accent" data-act="save-opp" data-pid="${esc(pid)}">Enregistrer</button></div>`);
}
function oppBlock(pid, name, o) {
  return `${o ? `<div class="card"><h3>Vos sets</h3>${o.sets.map((s) => `<div class="small"><span class="${s.win ? "w" : "l"}">${s.win ? "V" : "D"}</span> ${s.score?.join("-")} · ${esc(s.tournament)} <span class="muted">${fmtDate(s.ts)}</span></div>`).join("")}</div>` : ""}
    <label>📝 Ta note sur ${esc(name)}</label><textarea id="opp-note" placeholder="Ses habitudes, ce qui marche contre lui…">${esc(C.get("opp_notes", pid) || "")}</textarea>`;
}
function sheetOpp(pid) {
  const o = stats(allSets()).opps.find((x) => x.id === pid); if (!o) return;
  sheet(`<h2>🆚 ${esc(o.name)} <span class="small">${wl(o.w, o.l)}</span></h2><div class="muted small">games ${o.gw}-${o.gl}</div>
    ${oppBlock(pid, o.name, o)}<div class="btns">${BACK ? closeBtn() : ""}${/^\d+$/.test(pid) ? `<button class="btn" data-scout="${esc(pid)}" data-name="${esc(o.name)}">🔭 Scouter</button>` : ""}<button class="btn accent" data-act="save-opp" data-pid="${esc(pid)}">Enregistrer</button></div>`);
}
function sheetSet(id) {
  const s = allSets().find((x) => x.id === id); if (!s) return;
  const v = C.get("vods", id) || { url: "", marks: [] }, gs = games(s);
  sheet(`<h2>${s.win ? "✅" : "❌"} ${esc(s.opp)} <span class="muted small">${s.score?.[0] ?? "?"}-${s.score?.[1] ?? "?"}</span></h2>
    <div class="muted small">${fmtDate(s.ts)} · ${esc(s.tournament)}${s.round ? " · " + esc(s.round) : ""}</div>
    ${gs.length ? `<div class="card" style="margin-top:10px">${gs.map((g, i) => `<div class="small">G${i + 1} · ${esc(charName(g.me) || "?")} vs ${esc(charName(g.opp) || "?")}${g.stage ? " · " + esc(g.stage) : ""} · ${g.win == null ? "?" : g.win ? '<span class="w">V</span>' : '<span class="l">D</span>'}</div>`).join("")}</div>` : ""}
    <label>📝 Note</label><textarea id="set-note" placeholder="Ce qui a marché, ce qui n'a pas marché…">${esc(notes(id))}</textarea>
    <label>🎬 VOD</label><input type="url" id="vod-url" placeholder="https://youtu.be/…" value="${esc(v.url)}">
    <div id="marks" style="margin-top:6px">${(v.marks || []).map(markRow).join("")}</div><button class="btn" data-act="mark-add" style="width:100%">＋ un moment</button>
    <div class="btns">${s.source === "manual" ? `<button class="btn danger" data-act="set-del" data-id="${esc(id)}">Supprimer</button>` : ""}<button class="btn" data-act="close">Annuler</button><button class="btn accent" data-act="save-set" data-id="${esc(id)}">Enregistrer</button></div>`);
}
const markRow = (m = {}) => `<div class="mark"><input type="text" class="mk-t" inputmode="numeric" placeholder="2:14" value="${esc(m.t || "")}"><input type="text" class="mk-x" placeholder="Ce qui se passe" value="${esc(m.text || "")}"><button class="btn" data-act="mark-go">▶</button></div>`;
const secs = (t) => { t = String(t || "").trim(); if (/^\d+$/.test(t)) return +t; const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/); return m ? (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3] : null; };
const fmtT = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`; };
function vodAt(url, s) { if (!s) return url; const base = url.replace(/[?&]t=[^&]*/, ""), j = base.includes("?") ? "&" : "?"; return /twitch\.tv/.test(url) ? `${base}${j}t=${Math.floor(s / 3600)}h${Math.floor(s % 3600 / 60)}m${s % 60}s` : `${base}${j}t=${s}s`; }
function sheetMu(k) {
  const r = stats(allSets()).opC.find((x) => x.k === k);
  sheet(`<h2>📒 ${esc(k)}</h2><div class="muted small">${r ? `games ${r.w}-${r.l}` : "pas de game renseigné"}</div>
    <textarea id="mu-text" style="min-height:220px;margin-top:10px" placeholder="Ses options dangereuses, comment le punir, tes stages…">${esc(C.get("matchups", k) || "")}</textarea>
    ${stageBlock(k)}
    <div class="btns"><button class="btn" data-act="close">Fermer</button><button class="btn accent" data-act="save-mu" data-k="${esc(k)}">Enregistrer</button></div>`);
}
function sheetNewSet() {
  sheet(`<h2>＋ Un set hors start.gg</h2><label>Adversaire</label><input type="text" id="ns-opp">
    <label>Score (toi – lui)</label><div class="mark"><input type="number" id="ns-a" value="2" min="0" max="9"><input type="number" id="ns-b" value="0" min="0" max="9"></div>
    <label>Date</label><input type="date" id="ns-d" value="${new Date().toISOString().slice(0, 10)}"><label>Tournoi</label><input type="text" id="ns-t" placeholder="(facultatif)">
    <div class="btns"><button class="btn" data-act="close">Annuler</button><button class="btn accent" data-act="ns-save">Ajouter</button></div>`);
}
function sheetSettings() {
  const c = D.cfg;
  sheet(`<h2>⚙ Réglages</h2>
    <div class="card"><h3>start.gg</h3><label>Ton profil</label><input type="url" id="s-prof" placeholder="https://www.start.gg/user/…" value="${esc(c.profile)}">
      <label>Jeton start.gg</label><input type="password" id="s-sg" autocomplete="off" placeholder="${c.sgToken ? "•••••• (enregistré)" : "Developer Settings → Personal Access Tokens"}"></div>
    <div class="card"><h3>☁ Synchro avec le Hub</h3><label>Dépôt GitHub privé</label><input type="text" id="s-repo" placeholder="ton-pseudo/sigo-smash-data" value="${esc(c.repo)}" autocapitalize="off">
      <label>Jeton GitHub (ce dépôt seulement)</label><input type="password" id="s-gh" autocomplete="off" placeholder="${c.ghToken ? "•••••• (enregistré)" : "github_pat_…"}">
      <label>Mot de passe de synchro (le même que dans le Hub)</label><input type="password" id="s-pw" autocomplete="off" placeholder="${c.pass ? "•••••• (enregistré)" : "8 caractères au moins"}"></div>
    <div class="card"><h3>🗺 Stages</h3><label>Starters de ton ruleset (séparés par des virgules)</label><input type="text" id="s-starters" value="${esc(starters().join(", "))}">
      <label>Counterpicks</label><input type="text" id="s-cps" value="${esc(counterpicks().join(", "))}"></div>
    <div class="card"><h3>🥋 Shobu (facultatif : ta run en direct sur les tournois Shobu)</h3><label>Ton pseudo Shobu</label><input type="text" id="s-sbu" autocapitalize="off" value="${esc(c.shobuUser || "")}">
      <label>Clé API Shobu</label><input type="password" id="s-sbk" autocomplete="off" placeholder="${c.shobuKey ? "•••••• (enregistrée)" : "shobu_pk_…"}"></div>
    <div class="muted small">Tout reste sur ce téléphone. Les jetons et la clé ne quittent l'appli que vers start.gg, GitHub et Shobu. En cas de perte du téléphone : révoque-les (start.gg, GitHub, Shobu).</div>
    <div class="btns"><button class="btn danger" data-act="reset">Tout effacer</button><button class="btn accent" data-act="save-settings">Enregistrer</button></div>`);
}

/* ------------------------------------------------------------ les gestes */
function bindView() {
  const fq = $("#find-q"); if (fq) fq.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); findGo(); } };
  const q = $("#pq"); if (q) q.oninput = () => { pq = q.value; clearTimeout(q.t); q.t = setTimeout(() => { render(); const n = $("#pq"); n.focus(); n.setSelectionRange(pq.length, pq.length); }, 200); }; }
document.addEventListener("click", async (e) => {
  const tab = e.target.closest("#tabs [data-tab]"); if (tab) { D.tab = tab.dataset.tab; save(); render(); window.scrollTo(0, 0); return; }
  if (e.target.closest("#gear")) return sheetSettings();
  if (e.target.closest("#sync")) return syncAll();
  if (e.target.id === "sheet-back") return closeSheet();
  const seg = e.target.closest("[data-seg]"); if (seg) { tourSeg = seg.dataset.seg; return render(); }
  const sc = e.target.closest("[data-scout]"); if (sc && sc.dataset.scout) { if (CUR && sc.closest("#sheet")) BACK = CUR; CUR = null; return sheetScout(sc.dataset.scout, sc.dataset.name); }
  const bkp = e.target.closest("#sheet [data-bkp]"); if (bkp && BK) { BK.hl = BK.hl === bkp.dataset.bkp ? null : bkp.dataset.bkp; const sc = $(".bk-wrap")?.scrollLeft; drawBracket(); if ($(".bk-wrap")) $(".bk-wrap").scrollLeft = sc || 0; return; }
  const op0 = e.target.closest("#sheet [data-opp]"); if (op0) { if (CUR) BACK = CUR; CUR = null; return sheetOpp(op0.dataset.opp); }
  const el = e.target.closest("[data-act]"), act = el?.dataset.act;
  if (act) e.preventDefault();
  if (act === "close") return closeSheet();
  if (act === "notif") { try { await Notification.requestPermission(); } catch (_) {} return render(); }
  if (act === "share") return shareCard(el.dataset.k);
  if (act === "bracket") return sheetBracket(el.dataset.eid, el.dataset.title);
  if (act === "find-go") return findGo();
  if (act === "find-ev") {
    const F = D.find || {}, t = [...(F.results || []), ...(F.recent || [])].find((x) => x.id === el.dataset.tid), ev = t?.events.find((x) => x.eid === el.dataset.eid);
    if (t) { F.recent = [t, ...(F.recent || []).filter((x) => x.id !== t.id)].slice(0, 12); D.find = F; save(); render(); }
    return sheetBracket(el.dataset.eid, `${t?.name || ""}${ev ? " · " + ev.name : ""}`);
  }
  if (act === "bk-refresh") return refreshBracket(false);
  if (act === "bk-live") { BK.live = !BK.live; BK.next = Date.now() + BK_EVERY(); return drawBracket(); }
  if (act === "bk-me") { BK.hl = null; return drawBracket(); }
  if (act === "bk-go") {               // (ouvre la phase / poule du set, et le centre)
    const s = bkAll(BK.data).find((x) => x.id === el.dataset.id); if (!s) return;
    BK.phase = s.pid0; BK.group = s.gid; drawBracket();
    const n = $(`#sheet [data-bks="${CSS.escape(s.id)}"]`); if (n) { n.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }); n.classList.add("pulse"); setTimeout(() => n.classList.remove("pulse"), 1600); }
    return;
  }
  if (act === "bk-ph") { BK.phase = el.dataset.id; BK.group = null; BK.hl = null; return drawBracket(); }
  if (act === "bk-g") { BK.group = el.dataset.id; return drawBracket(); }
  if (act === "strike") { el.classList.toggle("struck"); return strikeHint(el.closest(".stages")); }
  if (act === "stage-char") return;
  if (act === "back") { const b = BACK; BACK = null; return b ? b() : closeSheet(); }
  if (act === "live-refresh") { const u = ups().find((t) => t.events.some((ev) => ev.eid === el.closest("[data-eid]")?.dataset.eid)); if (u) loadLive(u); return; }
  if (act === "settings") return sheetSettings();
  if (act === "rescout") return sheetScout(el.dataset.pid, el.dataset.name, true);
  if (act === "save-opp") { C.set("opp_notes", el.dataset.pid, $("#opp-note").value.trim()); toast("📝 Note enregistrée."); if (BACK) { const b = BACK; BACK = null; return b(); } return closeSheet(); }
  if (act === "save-mu") { C.set("matchups", el.dataset.k, $("#mu-text").value.trim()); toast("📒 Fiche enregistrée."); return closeSheet(); }
  if (act === "mu-new") { const k = prompt("Fiche matchup : quel personnage ?"); if (k && k.trim()) sheetMu(k.trim()); return; }
  if (act === "mark-add") { $("#marks").insertAdjacentHTML("beforeend", markRow()); $("#marks .mark:last-child .mk-t").focus(); return; }
  if (act === "mark-go") { const u = $("#vod-url").value.trim(); if (!/^https?:\/\//.test(u)) return toast("Mets d'abord le lien de la VOD.", true); window.open(vodAt(u, secs(el.parentElement.querySelector(".mk-t").value) || 0), "_blank", "noopener"); return; }
  if (act === "save-set") {
    const id = el.dataset.id;
    C.set("notes", id, $("#set-note").value.trim());
    const url = $("#vod-url").value.trim();
    if (url && !/^https?:\/\//.test(url)) return toast("Le lien de la VOD doit commencer par https://", true);
    const marks = $$("#marks .mark").map((m) => ({ t: m.querySelector(".mk-t").value.trim(), text: m.querySelector(".mk-x").value.trim().slice(0, 200) }))
      .filter((m) => m.text && secs(m.t) != null).map((m) => ({ t: fmtT(secs(m.t)), text: m.text })).sort((a, b) => secs(a.t) - secs(b.t));
    C.set("vods", id, url || marks.length ? { url, marks } : null);
    toast("📓 Enregistré."); return closeSheet();
  }
  if (act === "set-del") { if (confirm("Supprimer ce set ajouté à la main ?")) { const id = el.dataset.id; C.set("manual", id, null); C.set("notes", id, null); C.set("vods", id, null); closeSheet(); } return; }
  if (act === "set-new") return sheetNewSet();
  if (act === "ns-save") {
    const opp = $("#ns-opp").value.trim().slice(0, 60); if (!opp) return toast("Indique l'adversaire.", true);
    const a = +$("#ns-a").value || 0, b = +$("#ns-b").value || 0, id = "m" + new Date().toISOString().replace(/\D/g, "").slice(0, 17) + "p";
    C.set("manual", id, { id, source: "manual", ts: ($("#ns-d").value || new Date().toISOString().slice(0, 10)) + "T12:00:00", tournament: $("#ns-t").value.trim().slice(0, 80) || "Hors tournoi",
      event: "", entrants: 0, online: false, game: ULT, round: "", losers: false, seed: null, place: null, opp, opp_id: "m:" + opp.toLowerCase(), opp_seed: null, score: [a, b], win: a > b, dq: false, games: [] });
    toast("✍ Set ajouté."); return closeSheet();
  }
  if (act === "save-settings") {
    const c = D.cfg, prof = $("#s-prof").value.trim(), repo = $("#s-repo").value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$|\/$/g, "");
    if (prof && !/user\/[0-9a-zA-Z]{6,12}/.test(prof)) return toast("Profil : https://www.start.gg/user/…", true);
    if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) return toast("Dépôt : ton-pseudo/sigo-smash-data", true);
    const pw = $("#s-pw").value; if (pw && pw.length < 8) return toast("Mot de passe : 8 caractères au moins.", true);
    const list = (id) => $(id).value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12);
    c.starters = list("#s-starters"); c.cps = list("#s-cps");
    c.shobuUser = $("#s-sbu").value.trim().replace(/^@/, "").slice(0, 40); if ($("#s-sbk").value.trim()) c.shobuKey = $("#s-sbk").value.trim();
    Object.assign(c, { profile: prof, repo, sgToken: $("#s-sg").value.trim() || c.sgToken, ghToken: $("#s-gh").value.trim() || c.ghToken, pass: pw || c.pass });
    save(); closeSheet(); toast("Enregistré : synchronisation…"); return syncAll();
  }
  if (act === "reset") { if (confirm("Effacer toutes les données de l'appli sur ce téléphone ? (Le Hub et le dépôt ne sont pas touchés.)")) { localStorage.removeItem(KEY); location.reload(); } return; }
  const goal = e.target.closest("[data-goal]");
  if (goal) { const g = C.get("goals", goal.dataset.goal); if (g) { C.set("goals", g.id, { ...g, done: !g.done }); render(); } return; }
  const up = e.target.closest("[data-up]"); if (up) return sheetUp(up.dataset.up);
  const tr = e.target.closest("[data-tour]"); if (tr) return sheetTour(tr.dataset.tour);
  const st = e.target.closest("[data-set]"); if (st) return sheetSet(st.dataset.set);
  const op = e.target.closest("[data-opp]"); if (op) return sheetOpp(op.dataset.opp);
  const mu = e.target.closest("[data-mu]"); if (mu) return sheetMu(mu.dataset.mu);
});

/* ------------------------------------------------------------ démarrage */
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
render();
if (navigator.onLine && (D.cfg.sgToken || D.cfg.repo) && (!D.lastCloud || Date.now() - new Date(D.lastCloud).getTime() > 10 * 60000)) syncAll();
window.addEventListener("online", () => cloudSoon());
