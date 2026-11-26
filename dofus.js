/* =====================================================================
   dofus.js — v180 : 🧙 DOFUS DANS LA POCHE (un second écran pendant que tu joues sur le PC).
   📅 l'Almanax (le jour et la semaine, lus directement chez dofusdude, sans clé) et tes offrandes à préparer,
      cochées comme sur le PC ; 🎯 tes objectifs de team (cocher, ajouter) ; 🛒 ta liste de courses (calculée par le
      Hub, « j'en ai » modifiable) ; 📜 tes quêtes et succès épinglés (faits / en cours pour ta team principale).
   Mêmes données que le Hub : entrées « df:… » du document des espaces (spaces.js). Les quêtes complètes et leurs
   prérequis restent sur le PC (leur index est trop gros pour le téléphone).
   ===================================================================== */
const DOF = { alm: null, almErr: "", busy: false, gq: "" };
const DD = (localStorage.getItem("sigo.dev.dd") || "https://api.dofusdu.de") + "/dofus3/v1/fr";     // (les tests : un faux dofusdude)
const dDay = (d) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const dToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
const dTeams = () => E.list("df:team:").sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
const dMain = () => dTeams().find((t) => t.main) || dTeams()[0];
const dChars = (tid) => E.list("df:char:").filter((c) => c._team === tid).sort((a, b) => ((dTeams().find((t) => t.id === tid)?.order || []).indexOf(a.id)) - ((dTeams().find((t) => t.id === tid)?.order || []).indexOf(b.id)));
const dNeedHub = (what) => `<div class="card setup"><h2>🧙 ${what}</h2><p>Ça vient de tes PC, par le même dépôt privé chiffré que le carnet Smash. Lance une fois la ☁ synchro entre PC dans le Hub.</p>
  <button class="btn accent" data-act="settings" style="width:100%">⚙ Régler la synchro avec le Hub</button></div>`;
const dHub = () => D.cfg.repo && D.cfg.ghToken && D.cfg.pass && !D.espNone;

/* ------------------------------------------------------------ 📅 l'Almanax */
async function dAlmLoad(force) {
  const day = dToday(), key = "sigo.dofus.alm";
  if (!force) { try { const c = JSON.parse(localStorage.getItem(key) || "null"); if (c && c.from === day) { DOF.alm = c.days; return; } } catch (_) {} }
  DOF.busy = true;
  try {
    const r = await fetch(`${DD}/almanax?range[from]=${day}&range[size]=8&timezone=Europe/Paris`, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("dofusdude a répondu " + r.status);
    DOF.alm = (await r.json()).map((d) => ({ date: d.date, bonus: d.bonus?.description || "", type: d.bonus?.type?.name || "", kamas: d.reward_kamas || 0,
      item: d.tribute?.item?.name || "?", icon: d.tribute?.item?.image_urls?.icon || d.tribute?.item?.image_urls?.sd || "", qty: d.tribute?.quantity || 1 }));
    DOF.almErr = ""; localStorage.setItem(key, JSON.stringify({ from: day, days: DOF.alm }));
  } catch (e) { DOF.almErr = String(e.message || e); }
  DOF.busy = false;
}
function viewDAlm() {
  if (!DOF.alm && !DOF.almErr) { if (!DOF.busy) dAlmLoad().then(() => D.tab === "dalm" && render()); return `<h2>📅 Almanax</h2>${uxSkel(3)}`; }
  if (!DOF.alm) return `<h2>📅 Almanax</h2><div class="card err">⚠ ${esc(DOF.almErr)}</div><button class="btn" data-dact="alm-reload">⟳ Réessayer</button>`;
  const cfg = E.get("df:alm") || { watch: [], prep: {} }, prep = cfg.prep || {}, watch = (cfg.watch || []).map((w) => String(w).toLowerCase());
  const [t, ...next] = DOF.alm;
  const row = (d, big) => `<div class="card dalm ${big ? "today" : ""} ${watch.includes((d.type || "").toLowerCase()) ? "watched" : ""}">
      <div class="dalm-h">${big ? "<b>Aujourd'hui</b>" : `<b>${esc(dDay(d.date))}</b>`}${watch.includes((d.type || "").toLowerCase()) ? ' <span class="chip">🔔 surveillé</span>' : ""}</div>
      <div class="dalm-b">${d.icon ? `<img src="${esc(d.icon)}" alt="" loading="lazy">` : ""}<div class="grow"><div><b>${d.qty} × ${esc(d.item)}</b></div>
        <div class="muted small">${esc(d.bonus)}</div>${d.kamas ? `<div class="muted small">💰 ${Number(d.kamas).toLocaleString("fr-FR")} kamas</div>` : ""}</div>
        ${dHub() ? `<button class="btn dprep ${prep[d.date] ? "on" : ""}" data-dact="prep" data-d="${esc(d.date)}" title="Offrande à préparer (et ajoutée à tes courses sur le PC)">${prep[d.date] ? "✓ prévue" : "＋ prévoir"}</button>` : ""}</div></div>`;
  return `<div class="lu-h"><h2>📅 Almanax</h2><button class="btn" data-dact="alm-reload" title="Relire chez dofusdude">⟳</button></div>
    ${row(t, true)}<h3>Cette semaine</h3>${next.map((d) => row(d)).join("")}
    ${dHub() ? '<p class="muted small">« ✓ prévue » : comme sur le PC, l\'offrande s\'ajoute à tes 🛒 courses (au prochain calcul sur le Hub).</p>' : '<p class="muted small">Règle la synchro avec le Hub pour cocher tes offrandes à préparer.</p>'}
    <p class="muted small">Données : dofusdude (api.dofusdu.de).</p>`;
}

/* ------------------------------------------------------------ 🎯 les objectifs */
const D_KIND = { dofus: "🥚 Dofus", succes: "🏅 Succès", donjon: "🏰 Donjon", autre: "🎯 Autre" };
function viewDGoals() {
  if (!dHub()) return dNeedHub("Objectifs");
  const gl = E.get("df:cfg:goals") || [], teams = dTeams(), tn = (id) => teams.find((t) => t.id === id)?.name || "";
  const todo = gl.filter((g) => !g.done), done = gl.filter((g) => g.done);
  const row = (g) => `<div class="card row dgoal ${g.done ? "done" : ""}"><button class="dchk ${g.done ? "on" : ""}" data-dact="goal" data-id="${esc(g.id)}" aria-label="Fait">${g.done ? "✓" : ""}</button>
    <div class="grow"><div>${esc(g.text)}</div><div class="muted small">${esc(D_KIND[g.kind] || "🎯")}${g.team ? " · " + esc(tn(g.team)) : ""}</div></div></div>`;
  return `<div class="lu-h"><h2>🎯 Objectifs</h2><button class="btn" data-dact="goal-new">＋</button></div>
    ${todo.length ? todo.map(row).join("") : '<div class="empty">Aucun objectif en cours.</div>'}
    ${done.length ? `<h3>Faits <span class="muted small">${done.length}</span></h3>${done.slice(0, 20).map(row).join("")}` : ""}`;
}
function dGoalSheet() {
  sheet(`<h2>＋ Objectif</h2><div class="field"><input id="dg-text" placeholder="Ex. : Dofus Ocre, donjon Comte Harebourg…" maxlength="160"></div>
    <div class="seg" id="dg-kind">${Object.entries(D_KIND).map(([k, n], i) => `<button data-k="${k}" class="${i === 3 ? "on" : ""}">${n}</button>`).join("")}</div>
    <div class="field"><label class="muted small">Team</label><select id="dg-team"><option value="">Toutes</option>${dTeams().map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")}</select></div>
    <div class="btns"><button class="btn accent" data-dact="goal-add">Ajouter</button></div>`);
}

/* ------------------------------------------------------------ 🛒 les courses */
function viewDShop() {
  if (!dHub()) return dNeedHub("Courses");
  const L = E.get("df:shoplist");
  if (!L?.items?.length) return `<h2>🛒 Courses</h2><div class="empty">Pas encore de liste : ouvre 🛒 Courses dans l'espace Dofus du Hub (elle y est calculée, avec les recettes), puis synchronise.</div>`;
  const items = L.items.map((x) => ({ ...x, have: Number(E.get("df:have:" + x.key) || 0) }));
  const left = items.filter((x) => x.have < x.qty), ok = items.filter((x) => x.have >= x.qty);
  const row = (x) => `<div class="card row dshop ${x.have >= x.qty ? "done" : ""}">${x.icon ? `<img src="${esc(x.icon)}" alt="" loading="lazy">` : ""}<div class="grow"><div><b>${esc(x.name)}</b> <span class="muted small">${esc(x.type || "")}</span></div>
      <div class="muted small">${(x.for || []).map(esc).join(" · ")}</div></div>
      <div class="dqty"><button class="btn" data-dact="have" data-k="${esc(x.key)}" data-n="${Math.max(0, x.have - 1)}" aria-label="Un de moins">−</button>
        <span><b>${x.have}</b>/${x.qty}</span><button class="btn" data-dact="have" data-k="${esc(x.key)}" data-n="${x.have + 1}" aria-label="Un de plus">＋</button>
        ${x.have < x.qty ? `<button class="btn" data-dact="have" data-k="${esc(x.key)}" data-n="${x.qty}" title="J'ai tout">✓</button>` : ""}</div></div>`;
  return `<h2>🛒 Courses <span class="muted small">${left.length} à trouver</span></h2>
    <p class="muted small">Calculée sur le Hub le ${esc(new Date(L.at * 1000).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}. « J'en ai » se synchronise avec tes PC.</p>
    ${left.map(row).join("") || '<div class="empty">🎉 Tout est réuni.</div>'}${ok.length ? `<h3>Réuni <span class="muted small">${ok.length}</span></h3>${ok.map(row).join("")}` : ""}`;
}

/* ------------------------------------------------------------ 📜 l'aventure : tes épingles */
const D_ST = { done: "✓ fait", doing: "⏳ en cours" };
function viewDAdv() {
  if (!dHub()) return dNeedHub("Aventure");
  const pins = E.get("df:cfg:pins") || [], info = E.get("df:pinfo") || {}, main = dMain(), chars = main ? dChars(main.id) : [];
  if (!pins.length) return `<h2>📜 Aventure</h2><div class="empty">Aucune quête ni succès épinglé : épingle-les dans 📜 Aventure sur le Hub.</div>`;
  const stOf = (p) => { const [t, id] = p.split(":"), f = t === "q" ? "quests" : "ach"; const sts = chars.map((c) => (c[f] || {})[id] || ""); return { done: sts.filter((s) => s === "done").length, doing: sts.filter((s) => s === "doing").length, n: sts.length }; };
  return `<h2>📜 Aventure</h2><p class="muted small">Tes épingles, pour <b>${esc(main?.name || "ta team")}</b> (${chars.length} perso${chars.length > 1 ? "s" : ""}). Marquer « fait » ici ne coche pas les prérequis : le Hub, si.</p>
    ${pins.map((p) => { const s = stOf(p), i = info[p] || {}, all = s.n && s.done === s.n;
      return `<div class="card dpin ${all ? "done" : ""}"><div><b>${p.startsWith("q:") ? "📜" : "🏅"} ${esc(i.name || p)}</b>${i.lvl ? ` <span class="muted small">niv. ${i.lvl}</span>` : ""}</div>
        <div class="muted small">${s.n ? `${s.done}/${s.n} fait${s.doing ? ` · ${s.doing} en cours` : ""}` : "Pas de perso dans la team principale"}</div>
        ${s.n ? `<div class="seg dpin-seg">${[["done", "✓ Fait"], ["doing", "⏳ En cours"], ["", "↺ Rien"]].map(([k, n]) => `<button data-dact="pin-st" data-p="${esc(p)}" data-s="${k}" class="${(k === "done" && all) || (k === "doing" && s.doing === s.n) || (k === "" && !s.done && !s.doing) ? "on" : ""}">${n}</button>`).join("")}</div>` : ""}</div>`; }).join("")}`;
}

/* ------------------------------------------------------------ les actions */
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-dact]"); if (!el) return;
  const a = el.dataset.dact;
  if (a === "alm-reload") { DOF.alm = null; DOF.almErr = ""; await dAlmLoad(true); return render(); }
  if (a === "prep") {
    const cfg = E.get("df:alm") || { watch: [], prep: {} }; cfg.prep = cfg.prep || {};
    if (cfg.prep[el.dataset.d]) delete cfg.prep[el.dataset.d]; else cfg.prep[el.dataset.d] = true;
    E.set("df:alm", cfg); return render();
  }
  if (a === "goal") {
    const gl = E.get("df:cfg:goals") || [], g = gl.find((x) => x.id === el.dataset.id); if (!g) return;
    g.done = !g.done; E.set("df:cfg:goals", gl); return render();
  }
  if (a === "goal-new") return dGoalSheet();
  if (a === "goal-add") {
    const text = ($("#dg-text")?.value || "").trim().slice(0, 160); if (!text) return toast("Quel objectif ?", true);
    const gl = E.get("df:cfg:goals") || []; if (gl.length >= 200) return toast("200 objectifs au plus.", true);
    gl.push({ id: "g" + Date.now() + Math.random().toString(16).slice(2, 6), text, kind: $("#dg-kind .on")?.dataset.k || "autre", team: $("#dg-team")?.value || "", done: false, added: dToday() });
    E.set("df:cfg:goals", gl); closeSheetQuiet(); toast("🎯 Objectif ajouté."); return render();
  }
  if (a === "have") { const n = Math.max(0, Math.min(99999, +el.dataset.n || 0)); E.set("df:have:" + el.dataset.k, n || null); return render(); }
  if (a === "pin-st") {
    const [t, id] = el.dataset.p.split(":"), f = t === "q" ? "quests" : "ach", main = dMain(); if (!main) return;
    for (const c of dChars(main.id)) { const m = { ...(c[f] || {}) }; if (el.dataset.s) m[id] = el.dataset.s; else delete m[id]; const n = { ...c, [f]: m }; if (!Object.keys(m).length) delete n[f]; E.set("df:char:" + c.id, n); }
    return render();
  }
});
document.addEventListener("click", (e) => { const b = e.target.closest("#dg-kind [data-k]"); if (!b) return; $$("#dg-kind [data-k]").forEach((x) => x.classList.toggle("on", x === b)); });
TABS.dalm = viewDAlm; TABS.dgoals = viewDGoals; TABS.dshop = viewDShop; TABS.dadv = viewDAdv;
