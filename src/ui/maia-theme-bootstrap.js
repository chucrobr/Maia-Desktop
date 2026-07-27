(() => {
  "use strict";
  try{
    const theme = JSON.parse(localStorage.getItem("Maia.horizon.themePayload") || "null");
    if(!theme || typeof theme !== "object") return;
    const root = document.documentElement;
    const style = root.style;
    style.setProperty("--h-primary", theme.primary || "#a78bfa");
    style.setProperty("--h-accent", theme.accent || theme.primary || "#7c3aed");
    style.setProperty("--h-soft", theme.soft || "#efe7ff");
    style.setProperty("--h-dim", theme.dim || "#62517e");
    style.setProperty("--h-bg", theme.background || "#020105");
    style.setProperty("--h-surface", theme.surface || "#160c28");
    root.dataset.theme = theme.id || "violet";
    addEventListener("DOMContentLoaded", () => {
      document.body.dataset.theme = theme.id || "violet";
    }, {once:true});
  }catch(error){}
})();
