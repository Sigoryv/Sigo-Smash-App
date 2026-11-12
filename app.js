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
const DEF = { cfg: { sgToken: "", profile: "", repo: "", ghToken: "", pass: "" }, player: null, sets: [], chars: {}, upcoming: null,
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
    if (!T.has(k)) T.set(k, { key: k, tid: s.tid, name: s.tournament, slug: s.tslug, ts: s.ts, entrants: s.entrants, seed: s.seed, place: s.place, online: s.online, timg: s.timg, tbanner: s.tbanner, sets: [], w: 0, l: 0 });
    const t = T.get(k); t.sets.push(s); if (!s.dq) s.win ? t.w++ : t.l++; if (s.ts && s.ts < t.ts) t.ts = s.ts;
  }
  const tours = [...T.values()].map((t) => ({ ...t, spr: t.seed && t.place ? pIdx(t.seed) - pIdx(t.place) : null })).sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
  const O = new Map();
  for (const s of play) {
    if (!O.has(s.opp_id)) O.set(s.opp_id, { id: s.opp_id, name: s.opp, w: 0, l: 0, gw: 0, gl: 0, last: s.ts, sets: [] });
    const o = O.get(s.opp_id); o.sets.push(s); s.win ? o.w++ : o.l++;
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
  D.upcoming = { at: now(), me, tournaments: out.sort((a, b) => (a.start || 0) - (b.start || 0)) };
  D.lastSg = new Date().toISOString(); D.source = "phone"; save();
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
  if (snap.obj) {
    const s = await decrypt(snap.obj);
    if (s.last_sync && (!D.lastSg || new Date(s.last_sync) > new Date(D.lastSg))) {
      D.sets = s.sets || D.sets; D.chars = Object.keys(s.chars || {}).length ? s.chars : D.chars; D.player = s.player || D.player;
      if (s.upcoming && s.upcoming.tournaments && (!D.upcoming || (s.upcoming.at || 0) > (D.upcoming.at || 0))) D.upcoming = s.upcoming;
      if (!c.profile && s.profile) c.profile = "https://www.start.gg/" + s.profile;
      D.lastSg = new Date(s.last_sync).toISOString(); D.source = "hub"; snapUsed = true;
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
}

/* ------------------------------------------------------------ les écrans */
const TABS = { home: viewHome, tours: viewTours, players: viewPlayers, mu: viewMatchups, carnet: viewCarnet };
function render() {
  $$("#tabs [data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === D.tab));
  const p = D.player;
  $("#title").textContent = p ? (p.prefix ? p.prefix + " | " : "") + p.tag : "Sigo Smash";
  const v = $("#view");
  if (!D.cfg.sgToken && !D.cfg.repo) { v.innerHTML = viewWelcome(); return; }
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
  const up = (D.upcoming?.tournaments || []).filter((x) => (x.start || 0) * 1000 > Date.now() - 864e5).slice(0, 3);
  const goals = C.section("goals").map(([, g]) => g);
  return `<div class="kpis"><div class="kpi"><b>${st.pct} %</b><span>sets ${st.W}-${st.L}</span></div><div class="kpi"><b>${st.gpct} %</b><span>games ${st.gw}-${st.gl}</span></div><div class="kpi"><b>${st.tours.length}</b><span>tournois</span></div></div>
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
  const st = stats(allSets()), up = D.upcoming?.tournaments || [];
  return `<div class="seg"><button data-seg="up" class="${tourSeg === "up" ? "on" : ""}">À venir (${up.length})</button><button data-seg="past" class="${tourSeg === "past" ? "on" : ""}">Passés (${st.tours.length})</button></div>
    ${tourSeg === "up" ? (up.map((u) => `<div class="card row" data-up="${esc(u.tid)}">${logo(u.timg, u.name)}<div class="grow"><div><b>${esc(u.name)}</b></div>
        <div class="muted small">${esc(fmtDay(u.start))} · ${countdown(u.start)}${u.city ? " · " + esc(u.city) : ""}</div></div>›</div>`).join("") || '<div class="empty">Aucun tournoi à venir où tu es inscrit.</div>')
    : `<div class="card">${st.tours.map((t) => `<div class="row" data-tour="${esc(t.key)}">${logo(t.timg, t.name)}<div class="grow"><div><b>${esc(t.name)}</b></div>
        <div class="muted small">${fmtDate(t.ts)} · ${t.entrants || "?"} j. · ${wl(t.w, t.l)}</div></div><b>${ordinal(t.place)}</b></div>`).join("") || '<div class="empty">Pas encore de tournoi.</div>'}</div>`}`;
}
let pq = "";
function viewPlayers() {
  const st = stats(allSets()), list = st.opps.filter((o) => !pq || key(o.name).includes(key(pq)));
  return `<input type="search" id="pq" placeholder="Chercher un joueur…" value="${esc(pq)}" style="margin-bottom:10px">
    <div class="card">${list.slice(0, 150).map((o) => `<div class="row" data-opp="${esc(o.id)}"><div class="grow"><div><b>${esc(o.name)}</b>${C.get("opp_notes", o.id) ? " 📝" : ""}</div>
      <div class="muted small">games ${o.gw}-${o.gl} · ${fmtDate(o.last)}</div></div><span>${wl(o.w, o.l)}</span></div>`).join("") || '<div class="empty">Personne.</div>'}</div>`;
}
function viewMatchups() {
  const st = stats(allSets()), M = new Map(st.opC.map((r) => [r.k, r]));
  const ks = [...new Set([...C.section("matchups").map(([k]) => k), ...st.opC.map((r) => r.k)])];
  return `<div class="card">${ks.map((k) => { const r = M.get(k); return `<div class="row" data-mu="${esc(k)}"><div class="grow"><div><b>${esc(k)}</b>${C.get("matchups", k) ? " 📝" : ""}</div>
      <div class="muted small">${r ? `${st.pctOf(r.w, r.l)} % · games ${r.w}-${r.l}` : "pas de game renseigné"}</div></div>›</div>`; }).join("") || '<div class="empty">Aucun matchup : complète tes games, ou crée une fiche.</div>'}</div>
    <button class="fab" data-act="mu-new" aria-label="Nouvelle fiche">＋</button>`;
}
function viewCarnet() {
  const sets = allSets().slice(0, 250);
  return `<div class="card">${sets.map((s) => `<div class="row" data-set="${esc(s.id)}"><span class="res ${s.dq ? "" : s.win ? "w" : "l"}">${s.dq ? "DQ" : s.win ? "V" : "D"}</span>
      <div class="grow"><div><b>${esc(s.opp)}</b> <span class="muted small">${s.score?.[0] ?? "?"}-${s.score?.[1] ?? "?"}</span></div><div class="muted small">${fmtDate(s.ts)} · ${esc(s.tournament)}</div></div>
      <span class="small">${C.get("vods", s.id) ? "🎬" : ""}${notes(s.id) ? "📝" : ""}${s.source === "manual" ? "✍" : ""}</span></div>`).join("") || '<div class="empty">Aucun set : ⟳ pour synchroniser.</div>'}</div>
    <button class="fab" data-act="set-new" aria-label="Ajouter un set">＋</button>`;
}

/* ------------------------------------------------------------ les fiches (en bas de l'écran) */
let CUR = null, BACK = null;                 // (la fiche ouverte, et celle où revenir depuis la fiche d'un joueur)
function sheet(html) { $("#sheet").innerHTML = html; $("#sheet-back").hidden = false; $("#sheet").scrollTop = 0; }
function closeSheet() { $("#sheet-back").hidden = true; CUR = BACK = null; render(); }
const sgLink = (slug) => slug ? `<a class="sglink" href="https://www.start.gg/${esc(slug)}" target="_blank" rel="noopener" aria-label="Ouvrir sur start.gg">start.gg ↗</a>` : "";
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
  return `<div class="row run" ${tap}><span class="res ${res[0]}">${res[1]}</span>
    <div class="grow"><div><b>${esc(r.name || "?")}</b>${r.seed ? ` <span class="muted small">(seed ${r.seed})</span>` : ""}${r.fav === false ? ' <span class="chip warn">favori</span>' : ""}${r.upset ? ' <span class="chip warn">upset</span>' : ""}${r.pid && C.get("opp_notes", r.pid) ? " 📝" : ""}</div>
      <div class="muted small">${esc(r.label)}${r.score ? " · " + esc(r.score) : ""}</div></div>
    ${r.pid ? `<span class="small">${o ? wl(o.w, o.l) : '<span class="muted">1er set</span>'}</span><span class="muted">›</span>` : ""}</div>`;
}
function sheetTour(k) {
  const st = stats(allSets()), t = st.tours.find((x) => x.key === k); if (!t) return;
  CUR = () => sheetTour(k);
  const run = t.sets.slice().sort((a, b) => (a.ts || "").localeCompare(b.ts || "")).map((s) => ({ name: s.opp, pid: s.opp_id, seed: s.opp_seed, label: s.round || "",
    res: s.dq ? "wait" : s.win ? "w" : "l", score: s.dq ? "DQ" : `${s.score?.[0] ?? "?"}-${s.score?.[1] ?? "?"}`, upset: s.win && st.uf(s) > 0 }));
  sheet(`${tourHead(t.name, t.tbanner, `${fmtDate(t.ts)} · ${t.entrants || "?"} joueurs · seed ${t.seed || "?"} → <b>${ordinal(t.place)}</b> · ${wl(t.w, t.l)}`, t.slug)}
    <div class="card"><h3>🏁 Ma run</h3>${run.map((r) => runRow(r, st)).join("")}</div>
    <div class="btns">${closeBtn()}</div>`);
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
  const u = (D.upcoming?.tournaments || []).find((x) => x.tid === tid); if (!u) return;
  CUR = () => sheetUp(tid);
  const st = stats(allSets()), started = (u.start || 0) * 1000 <= Date.now();
  sheet(`${tourHead(u.name, u.tbanner, `${esc(fmtDay(u.start))} · <b>${started ? "commencé" : countdown(u.start)}</b>${u.city ? " · " + esc(u.city) : ""}${u.attendees ? ` · ${u.attendees} inscrits` : ""}`, u.slug)}
    ${u.events.map((ev) => { const path = bracketPath(ev);
      let body;
      if (started && ev.me?.id) body = `<h3>🏁 Ma run (réelle)</h3><div id="live-${esc(ev.eid)}" data-eid="${esc(ev.eid)}">${liveHTML((D.live || {})[ev.eid], st)}</div>`;
      else if (path) body = `<h3>🔮 Ma run (prévue)</h3>${path.map((r) => r.bye ? runRow({ label: r.label, res: "bye", name: "bye (personne à cette seed)" }, st)
          : runRow({ label: r.label, name: r.e?.tag || r.e?.name, pid: r.e?.pid, seed: r.seed, fav: r.fav, res: "next" }, st)).join("")}
        <div class="muted small" style="margin-top:6px">Projection : bracket unique où la meilleure seed gagne toujours (côté winners). Avec des poules, l'ordre réel diffère.</div>`;
      else body = `<div class="muted small">${ev.seeded ? "Tu n'es pas dans la liste seedée." : "Seeds pas encore publiées : ta run prévue apparaîtra ici."}</div>`;
      return `<div class="card"><h3>${esc(ev.name)} · ${ev.entrants} inscrits ${ev.me?.seed ? `· <span class="chip">ta seed ${ev.me.seed}</span>` : ""}</h3>${body}</div>`; }).join("")}
    <div class="btns">${closeBtn()}</div>`);
  if (started) loadLive(u);
}
async function loadLive(u) {
  const st = stats(allSets());
  for (const ev of u.events) {
    if (!ev.me?.id) continue;
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
    ${r.chars.length ? `<div class="card"><h3>Ses persos</h3>${r.chars.map((c) => `<div class="row"><div class="grow">${esc(c.k)}</div><span class="muted small">${c.n} games · ${Math.round(100 * c.w / c.n)} %</span></div>`).join("")}</div>` : ""}
    <div class="card"><h3>Victoires / défaites récentes</h3>${r.wins.slice(0, 5).map((x) => `<div class="small"><span class="w">V</span> ${esc(x.opp)} ${x.score?.join("-")} · <span class="muted">${esc(x.t)}</span></div>`).join("")}
      ${r.losses.slice(0, 5).map((x) => `<div class="small"><span class="l">D</span> ${esc(x.opp)} ${x.score?.join("-")} · <span class="muted">${esc(x.t)}</span></div>`).join("")}</div>
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
    <div class="muted small">Tout reste sur ce téléphone. Les jetons ne quittent l'appli que vers start.gg et GitHub. En cas de perte du téléphone : révoque les deux jetons.</div>
    <div class="btns"><button class="btn danger" data-act="reset">Tout effacer</button><button class="btn accent" data-act="save-settings">Enregistrer</button></div>`);
}

/* ------------------------------------------------------------ les gestes */
function bindView() { const q = $("#pq"); if (q) q.oninput = () => { pq = q.value; clearTimeout(q.t); q.t = setTimeout(() => { render(); const n = $("#pq"); n.focus(); n.setSelectionRange(pq.length, pq.length); }, 200); }; }
document.addEventListener("click", async (e) => {
  const tab = e.target.closest("#tabs [data-tab]"); if (tab) { D.tab = tab.dataset.tab; save(); render(); window.scrollTo(0, 0); return; }
  if (e.target.closest("#gear")) return sheetSettings();
  if (e.target.closest("#sync")) return syncAll();
  if (e.target.id === "sheet-back") return closeSheet();
  const seg = e.target.closest("[data-seg]"); if (seg) { tourSeg = seg.dataset.seg; return render(); }
  const sc = e.target.closest("[data-scout]"); if (sc && sc.dataset.scout) { if (CUR && sc.closest("#sheet")) BACK = CUR; CUR = null; return sheetScout(sc.dataset.scout, sc.dataset.name); }
  const op0 = e.target.closest("#sheet [data-opp]"); if (op0) { if (CUR) BACK = CUR; CUR = null; return sheetOpp(op0.dataset.opp); }
  const el = e.target.closest("[data-act]"), act = el?.dataset.act;
  if (act) e.preventDefault();
  if (act === "close") return closeSheet();
  if (act === "back") { const b = BACK; BACK = null; return b ? b() : closeSheet(); }
  if (act === "live-refresh") { const u = (D.upcoming?.tournaments || []).find((t) => t.events.some((ev) => ev.eid === el.closest("[data-eid]")?.dataset.eid)); if (u) loadLive(u); return; }
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
