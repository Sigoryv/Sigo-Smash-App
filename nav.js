/* =====================================================================
   nav.js — v81 : ◀ LE BOUTON « RETOUR » DU TÉLÉPHONE.
   Il ne ferme plus l'appli : il ferme d'abord la fiche ouverte (ou revient à la fiche précédente),
   puis quitte la page de détail (une liste d'armée, une leçon, une partie, la révision…),
   puis revient à l'onglet ou à l'espace d'avant. Tout en haut : « Appuie encore pour quitter ».
   (L'historique du navigateur garde toujours une entrée d'avance : chaque « retour » la consomme, on la remet.)
   ===================================================================== */

const NAV = { stack: [], quitAt: 0 };
const navKey = () => `${D.space}|${D.tab}`;
const renderViewNav0 = renderView;
renderView = function () {
  renderViewNav0();
  const k = navKey();
  if (!NAV.restoring && NAV.stack[NAV.stack.length - 1] !== k) { NAV.stack = [...NAV.stack.filter((x) => x !== k), k].slice(-20); }
};
/** un « retour » : true si quelque chose a été fermé ou quitté */
function navBack() {
  if (!$("#sheet-back").hidden) {
    const back = $("#sheet [data-act=back]"); if (back) { back.click(); return true; }
    closeSheet(); return true;
  }
  if (D.space === "wh" && WHP.list && D.tab === "wlists") { WHP.list = ""; render(); return true; }
  if (D.space === "ch") {
    if (CHM.rev && D.tab === "chlearn") { CHM.rev = null; render(); return true; }
    if (CHM.les && D.tab === "chlearn") { CHM.les = null; render(); return true; }
    if (CHM.gid && D.tab === "chgames") { CHM.gid = ""; render(); return true; }
  }
  if (NAV.stack.length > 1) {
    NAV.stack.pop();
    const [space, tab] = NAV.stack[NAV.stack.length - 1].split("|");
    NAV.restoring = true;
    try { if (space !== D.space) { D.tabs[D.space] = D.tab; D.space = space; } D.tab = tab; save(); render(); } finally { NAV.restoring = false; }
    return true;
  }
  return false;
}
history.replaceState({ sigo: "base" }, "");
history.pushState({ sigo: "garde" }, "");
window.addEventListener("popstate", () => {
  if (navBack()) { history.pushState({ sigo: "garde" }, ""); return; }
  if (Date.now() - NAV.quitAt < 2500) { history.back(); return; }        // (2e appui : on laisse partir)
  NAV.quitAt = Date.now(); toast("Appuie encore sur ◀ pour quitter Sigo Hub");
  history.pushState({ sigo: "garde" }, "");
});
NAV.stack = [navKey()];
