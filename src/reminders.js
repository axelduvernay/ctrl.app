/* Les rappels.

   Tant que ctrl.app est ouvert — onglet visible ou non — on vérifie
   régulièrement les rappels échus et on les fait sonner : notification du
   système si elle est autorisée, message dans l'app dans tous les cas.

   Limite assumée : application fermée, rien ne sonne. Faire sonner un appareil
   éteint exige un serveur qui envoie la notification ; il arrivera avec la
   synchronisation. */

import { state, save, emit } from "./store.js";
import { render } from "./render.js";
import { centerOn } from "./viewport.js";
import { parseLocal } from "./util.js";
import { toast } from "./main.js";

const TICK = 15000;

export function initReminders() {
  tick();
  setInterval(tick, TICK);
  addEventListener("focus", tick);
  document.addEventListener("visibilitychange", tick);
}

function tick() {
  const now = Date.now();
  const due = Object.values(state.doc.blocks).filter(
    (b) => b.remind && !b.reminded && !b.done && parseLocal(b.remind)?.getTime() <= now
  );
  if (!due.length) return;

  // Marquer « sonné » n'est pas une action de l'utilisateur : ça ne va pas dans
  // l'historique d'annulation, mais ça se sauvegarde.
  for (const block of due) block.reminded = true;
  save();
  render();

  for (const block of due) ring(block);
}

function ring(block) {
  const text = (block.text || block.name || "Rappel").trim().split("\n")[0].slice(0, 120);
  toast(`Rappel · ${text}`);

  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification("ctrl.app", { body: text, icon: "icon.svg", tag: block.id });
    n.onclick = () => {
      window.focus();
      reveal(block.id);
      n.close();
    };
  } catch {
    // Certains navigateurs n'autorisent les notifications que via le service
    // worker ; le message dans l'app a déjà été affiché.
  }
}

function reveal(id) {
  const block = state.doc.blocks[id];
  if (!block) return;
  state.selection.clear();
  state.selection.add(id);
  emit("selection");
  render();
  centerOn(block);
}

/** À appeler lors d'un geste de l'utilisateur : les navigateurs l'exigent. */
export function askNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}
