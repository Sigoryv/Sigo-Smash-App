/* ======================================================================
   watch.js — 📺 LES TOURNOIS À SUIVRE, sur le téléphone (v116)
   La liste et les fiches viennent du Hub (instantané chiffré : hub.enc.json → « watch »). Pendant un tournoi
   en cours, l'appli relit ELLE-MÊME la run des joueurs suivis (son jeton start.gg), sans attendre le PC.
   ====================================================================== */
const WTP_ST = { live: ["live", "● en cours"], next: ["", "à venir"], done: ["done", "terminé"] };
const WTP_P = { registered: ["", "inscrit"], in: ["ok", "en lice"], live: ["live", "● en jeu"], out: ["warn", "éliminé"], unknown: ["", "–"] };
const WTP_MYTZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })();
const wtpTours = () => (D.watch?.tours || []);
function wtpHour(ts, tz) {
  const o = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
  try { return new Date(ts * 1000).toLocaleString("fr-FR", tz ? { ...o, timeZone: tz } : o); } catch { return new Date(ts * 1000).toLocaleString("fr-FR", o); }
}
function wtpWhen(ts, tz) {
  if (!ts) return "date inconnue";
  const here = `${wtpHour(ts)} <span class="muted">chez toi</span>`;
  return !tz || tz === WTP_MYTZ || wtpHour(ts, tz) === wtpHour(ts) ? here : `${here}<br>${wtpHour(ts, tz)} <span class="muted">à ${esc(tz.split("/").pop().replace(/_/g, " "))}</span>`;
}
const wtpChip = (st, start) => `<span class="chip ${WTP_ST[st]?.[0] || ""}">${st === "next" && start ? countdown(start) : WTP_ST[st]?.[1] || ""}</span>`;
const wtpWho = (x) => (x.why === "me" ? "Toi" : x.tag || x.name || "?");

/* la liste (🏆 Tournois → 📺 Suivis) */
function viewWatch() {
  const ts = wtpTours();
  if (!ts.length) return `<div class="empty">Aucun tournoi suivi.<br><span class="small">Ajoute-les dans le Hub : 🎮 Smash → 🏆 Tournois → 📺 Tournois à suivre.</span></div>`;
  const grp = (st, title) => { const xs = ts.filter((t) => t.status === st); return xs.length ? `<h2>${title}</h2>${xs.map(wtpCard).join("")}` : ""; };
  return grp("live", "● En cours") + grp("next", "🗓 À venir") + grp("done", "🏁 Terminés");
}
function wtpCard(t) {
  const fol = (t.events || []).flatMap((e) => e.followed || []);
  return `<div class="card wtp-card st-${t.status}" data-act="wt" data-tid="${esc(t.id)}"><div class="row" style="border:none;padding:0">${logo(t.logo, t.name)}
    <div class="grow"><div><b>${esc(t.name)}</b> ${wtpChip(t.status, t.start)}</div><div class="muted small">${t.start ? esc(fmtDay(t.start)) : ""}${t.online ? " · en ligne" : t.city ? " · " + esc(t.city) : ""}${t.attendees ? ` · ${t.attendees} j.` : ""}</div></div>›</div>
    ${fol.length ? `<div class="wtp-fol">${fol.slice(0, 6).map((x) => { const [c, l] = x.status === "placed" ? ["ok", ordinal(x.place)] : WTP_P[x.status] || ["", ""]; return `<span class="chip ${c}">${esc(wtpWho(x))}${l ? " · " + esc(l) : ""}</span>`; }).join("")}</div>` : ""}</div>`;
}
/* 🏠 l'accueil : les tournois suivis en cours (et le prochain), en haut */
function wtpHome() {
  const ts = wtpTours(), live = ts.filter((t) => t.status === "live"), next = ts.filter((t) => t.status === "next").slice(0, 1);
  return live.length || next.length ? `<h2>📺 Tournois suivis</h2>${[...live, ...next].map(wtpCard).join("")}` : "";
}

/* la fiche */
D.wtTop = D.wtTop || 16;
function sheetWatch(tid, keep) {
  const t = wtpTours().find((x) => x.id === tid); if (!t) return;
  CUR = () => sheetWatch(tid, true);
  const evs = t.events || [];
  const evi = Math.min(D.wtEv?.[tid] || 0, Math.max(0, evs.length - 1)), e = evs[evi];
  const place = t.online ? "En ligne" : [t.venue || t.city, t.country].filter(Boolean).join(" · ");
  const streams = (t.streams || []).filter((s) => s.url);
  sheet(`${tourHead(t.name, t.banner, `${wtpChip(t.status, t.start)} ${t.attendees ? `· ${t.attendees} inscrits` : ""}${t.at ? ` · fiche du Hub ${ago(new Date(t.at * 1000).toISOString())}` : ""}`, t.url)}
    <div class="card wtp-info">
      <div class="row"><span class="wtp-k">📅</span><div class="grow small">${wtpWhen(t.start, t.tz)}</div></div>
      ${place ? `<div class="row"><span class="wtp-k">📍</span><div class="grow small">${esc(place)}</div>${!t.online && (t.venue || t.city) ? `<a class="sglink" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([t.venue, t.city, t.country].filter(Boolean).join(", "))}">carte ↗</a>` : ""}</div>` : ""}
      ${streams.length ? `<div class="row"><span class="wtp-k">📺</span><div class="grow chips">${streams.map((s) => `<a class="btn wtp-stream" target="_blank" rel="noopener" href="${esc(s.url)}">📺 ${esc(s.name)} <span class="muted small">${esc(s.source || "")}</span></a>`).join("")}</div></div>`
        : '<div class="row"><span class="wtp-k">📺</span><div class="grow muted small">Pas de stream renseigné.</div></div>'}
    </div>
    ${evs.length > 1 ? `<div class="seg">${evs.map((x, i) => `<button data-act="wt-ev" data-tid="${esc(tid)}" data-i="${i}" class="${i === evi ? "on" : ""}">${esc(x.name)}</button>`).join("")}</div>` : ""}
    ${e ? wtpEvent(t, e) : '<div class="card muted small">Ouvre ce tournoi une fois dans le Hub pour avoir sa fiche ici.</div>'}
    <div class="btns">${closeBtn()}</div>`, keep);
  if (e && e.state === "live" && canLive(e) && !keep) wtpLive(t, e);
}
function wtpEvent(t, e) {
  const st = stats(allSets()), top = D.wtTop;
  const fol = e.followed || [];
  return `<div class="card"><h3>⭐ Joueurs à suivre · ${esc(e.name)}</h3>
      ${fol.length ? fol.map((x) => wtpPlayer(t, e, x, st)).join("") : '<div class="muted small">Aucun de tes joueurs à suivre n\'est inscrit.</div>'}
      ${(e.absent || []).length ? `<div class="muted small">Pas inscrits : ${e.absent.map(esc).join(", ")}</div>` : ""}
      ${e.state === "live" ? `<div class="muted small" style="margin-top:6px">${canLive(e) ? `<a href="#" data-act="wt-live" data-tid="${esc(t.id)}">⟳ relire les runs en direct</a>` : String(e.eid).startsWith("shobu:") ? "Ajoute ta clé Shobu (⚙) pour suivre les runs en direct ici." : "Ajoute ton jeton start.gg (⚙) pour suivre les runs en direct ici."}</div>` : ""}
      <button class="btn" data-act="bracket" data-eid="${esc(e.eid)}" data-title="${esc(t.name + " · " + e.name)}" style="width:100%;margin-top:8px">🏆 Voir le bracket</button></div>
    ${(e.standings || []).length ? `<div class="card"><h3>🏅 Classement</h3>${e.standings.map((s) => `<div class="row"><b style="min-width:34px">${ordinal(s.place)}</b>${av(s.pid, s.name, "sm")}<div class="grow">${esc(s.name)}</div><span class="muted small">${s.seed ? "seed " + s.seed : ""}</span></div>`).join("")}</div>` : ""}
    ${(e.upsets || []).length ? `<div class="card"><h3>💥 Upsets</h3>${e.upsets.map((u) => `<div class="small wtp-up"><span class="chip ok">+${u.uf}</span> <b>${esc(u.w.name)}</b> <span class="muted">(${u.w.seed})</span> bat <b>${esc(u.l.name)}</b> <span class="muted">(${u.l.seed})</span> · ${u.w.score ?? "?"}-${u.l.score ?? "?"}</div>`).join("")}</div>` : ""}
    ${(e.top || []).length ? `<div class="card"><h3>🌱 ${e.seeded ? "Seeding" : "Inscrits"}</h3><div class="chips">${[8, 16, 32, 64].map((n) => `<button class="stage ${top === n ? "on" : ""}" data-act="wt-top" data-n="${n}" data-tid="${esc(t.id)}">Top ${n}</button>`).join("")}</div>
      ${(e.seeded ? e.top.filter((x) => x.seed && x.seed <= top) : e.top.slice(0, top)).map((x) => `<div class="row ${fol.some((f) => f.pid === x.pid) ? "wtp-hl" : ""}"><span class="muted" style="min-width:28px;text-align:right">${x.seed || ""}</span>${av(x.pid, x.tag || x.name, "sm")}<div class="grow">${x.prefix ? `<span class="muted">${esc(x.prefix)} | </span>` : ""}<b>${esc(x.tag || x.name)}</b></div></div>`).join("")}</div>` : ""}`;
}
function wtpPlayer(t, e, x, st) {
  const live = (D.wlive || {})[`${e.eid}:${x.id}`], sets = live?.sets || x.sets || [];
  const now = live?.out ? "out" : live && sets.some((s) => s.res === "live" || s.res === "called") ? "live" : x.status;
  const [c, l] = x.status === "placed" ? ["ok", `${ordinal(x.place)} place`] : WTP_P[now] || ["", ""];
  const res = { w: ["w", "V"], l: ["l", "D"], live: ["live", "●"], next: ["", "…"], wait: ["", "?"], called: ["called", "📣"] };
  return `<div class="wtp-p"><div class="row" style="border:none;padding:4px 0">${av(x.pid, wtpWho(x))}<div class="grow"><b>${esc(wtpWho(x))}</b> <span class="muted small">${x.seed ? "seed " + x.seed : ""}</span></div><span class="chip ${c}">${esc(l)}</span></div>
    ${sets.map((s) => `<div class="row run small" ${/^\d+$/.test(s.pid || "") ? `data-scout="${esc(s.pid)}" data-name="${esc(s.name)}"` : ""}><span class="res ${(res[s.res] || [""])[0]}">${(res[s.res] || ["", "·"])[1]}</span>
      <div class="grow">${esc(s.name || "?")}${s.seed ? ` <span class="muted">(${s.seed})</span>` : ""}<div class="muted">${esc(dayLab(s.label))}${s.score ? " · " + esc(s.score) : ""}</div></div>
      ${s.stream ? `<a class="sglink" target="_blank" rel="noopener" href="${esc(s.stream_src === "YOUTUBE" ? "https://www.youtube.com/@" + s.stream : "https://www.twitch.tv/" + s.stream)}">📺</a>` : ""}</div>`).join("")}
    ${live ? `<div class="muted small">en direct · lu ${ago(new Date(live.at * 1000).toISOString())}</div>` : ""}</div>`;
}
/* ⟳ la run des joueurs suivis, relue directement sur start.gg (même requête que « ma run en direct ») */
const canLive = (e) => String(e?.eid || "").startsWith("shobu:") ? hubOk() : !!D.cfg.sgToken;     // (🥋 v135 : Shobu via le Hub)
async function wtpLive(t, e) {
  D.wlive = D.wlive || {};
  if (String(e.eid).startsWith("shobu:")) return wtpLiveShobu(t, e);
  let n = 0, err = "";
  for (const x of e.followed || []) {
    if (!x.id) continue;
    try {
      const d = (await gql(Q_RUN, { id: e.eid, ent: x.id })).event || {};
      const sets = ((d.sets || {}).nodes || []).map((m) => {
        const sl = m.slots || [], mine = sl.find((y) => y.entrant && String(y.entrant.id) === String(x.id)), opp = sl.find((y) => y !== mine);
        const oe = opp?.entrant, pl = (((oe?.participants || [])[0]) || {}).player || {}, sc = (y) => ((((y || {}).standing || {}).stats || {}).score || {}).value;
        const done = m.state === 3 || !!m.winnerId;
        return { order: m.completedAt || m.startedAt || 9e12 + (m.round < 0 ? 1e6 : 0) + Math.abs(m.round || 0), name: oe ? (oe.name || pl.gamerTag) : "À déterminer", pid: String(pl.id || ""),
          seed: oe?.initialSeedNum ?? null, label: m.fullRoundText || "", res: done ? (String(m.winnerId) === String(x.id) ? "w" : "l") : !oe ? "wait" : m.state === 2 ? "live" : m.state === 6 ? "called" : "next",
          score: done ? `${sc(mine) ?? "?"}-${sc(opp) ?? "?"}` : "" };
      }).sort((a, b) => a.order - b.order);
      D.wlive[`${e.eid}:${x.id}`] = { at: Date.now() / 1000, sets, out: sets.filter((s) => s.res === "l").length >= 2 };
      n++;
    } catch (er) { err = er.message; }                 // (un joueur illisible n'arrête pas les autres)
  }
  if (!n && err) toast(err, true);
  save();
  if (n && CUR && !$("#sheet-back").hidden) sheetWatch(t.id, true);
}
/* 🥋 (v131 → v135) un tournoi Shobu suivi : son bracket, relu par le Hub (synchro), la run de chaque joueur suivi */
async function wtpLiveShobu(t, e) {
  let d;
  try { d = await sbRaw(e.eid); } catch (er) { toast(er.message, true); return; }
  if (!d) { toast(SB_MISSING, true); return; }
  let n = 0;
  for (const x of e.followed || []) {
    if (!x.id) continue;
    const rows = [];
    for (const s of d.sets || []) {
      const sl = (s.slots || []).filter(Boolean), mine = sl.find((y) => String(y.entrant?.id) === String(x.id)); if (!mine) continue;
      const opp = sl.find((y) => y !== mine) || {}; if (opp.isBye) continue;
      const oe = opp.entrant, p = oe?.player || {}, st = String(s.status || "").toUpperCase(), done = st === "COMPLETED";
      const spid = oe ? "shobu:" + norm(p.username || oe.name) : "";
      rows.push({ order: (done ? 0 : 1e6) + (s.number || 0), name: oe ? (oe.name || p.username) : "À déterminer", pid: spid ? (sgIdForTag(spid, oe.name) || spid) : "", seed: oe?.seed ?? null,
        label: s.roundName || "", res: done ? (mine.isWinner ? "w" : "l") : !oe ? "wait" : ["IN_PROGRESS", "ONGOING", "STARTED", "ACTIVE"].includes(st) ? "live" : "next",
        score: done ? `${mine.score ?? "?"}-${opp.score ?? "?"}` : "" });
    }
    rows.sort((a, b) => a.order - b.order);
    D.wlive[`${e.eid}:${x.id}`] = { at: Date.now() / 1000, sets: rows, out: rows.filter((r) => r.res === "l").length >= 2 }; n++;
  }
  save();
  if (n && CUR && !$("#sheet-back").hidden) sheetWatch(t.id, true);
}
document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-act^='wt']"); if (!el) return;
  const act = el.dataset.act, tid = el.dataset.tid;
  if (act === "wt") { ev.stopPropagation(); return sheetWatch(tid); }
  if (act === "wt-ev") { ev.stopPropagation(); D.wtEv = { ...(D.wtEv || {}), [tid]: +el.dataset.i }; save(); return sheetWatch(tid); }
  if (act === "wt-top") { ev.stopPropagation(); D.wtTop = +el.dataset.n; save(); return sheetWatch(tid, true); }
  if (act === "wt-live") { ev.preventDefault(); ev.stopPropagation(); const t = wtpTours().find((x) => x.id === tid), e = t?.events?.[D.wtEv?.[tid] || 0]; if (e) { toast("⟳ Lecture des runs…"); wtpLive(t, e); } }
}, true);
