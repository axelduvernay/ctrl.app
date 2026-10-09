/* Les rappels.

   Tant que ctrl.app est ouvert — onglet visible ou non — on vérifie
   régulièrement les rappels échus et on les fait sonner : notification du
   système si elle est autorisée, message dans l'app dans tous les cas.

   Application fermée, c'est le serveur qui envoie la notification (voir
   push.js). Toucher la notification ouvre le board et montre le bloc. */

import { state, save, emit, on } from "./store.js";
import { render } from "./render.js";
import { centerOn } from "./viewport.js";
import { parseLocal } from "./util.js";
import { toast } from "./main.js";
import { play } from "./sounds.js";
import { syncUser, boardsList, switchBoard } from "./sync.js";
import { pushState, enablePush } from "./push.js";

const TICK = 15000;

export function initReminders() {
  openFromNotification();
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

const firstLine = (b) => (b.text || b.name || "").trim().split("\n")[0].slice(0, 120);

function ring(block) {
  // Un rappel relié à d'autres blocs dit de quoi il parle : « Rappel ·
  // Appeler Léa → Devis studio, photo ».
  const linked = Object.values(state.doc.links)
    .filter((l) => l.kind !== "variant" && (l.from === block.id || l.to === block.id))
    .map((l) => state.doc.blocks[l.from === block.id ? l.to : l.from])
    .filter(Boolean)
    .map((b) => firstLine(b) || (b.kind === "image" ? "image" : b.kind === "draw" ? "dessin" : ""))
    .filter(Boolean);
  const own = firstLine(block) || "Rappel";
  const text = linked.length ? `${own} → ${linked.slice(0, 3).join(", ")}` : own;
  toast(`Rappel · ${text}`);
  play("reminder");

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

/* Une notification touchée : ouvrir le bon board et montrer le bloc, dès
   qu'il est là (au démarrage, la synchro peut prendre un instant). */
let wanted = null;

function openFromNotification() {
  const params = new URLSearchParams(location.search);
  if (params.has("rappel")) {
    wanted = { block: params.get("rappel"), board: params.get("board") };
    params.delete("rappel");
    params.delete("board");
    history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params : ""));
  }
  navigator.serviceWorker?.addEventListener("message", (e) => {
    if (e.data?.type !== "reveal" || !e.data.block) return;
    wanted = { block: e.data.block, board: e.data.board };
    follow();
  });
  on("board", follow);
  on("boards", follow);
  on("change", follow);
  follow();
}

function follow() {
  if (!wanted) return;
  const { block, board } = wanted;
  if (board && state.board.id !== board) {
    if (syncUser() && boardsList().some((b) => b.id === board)) {
      wanted = { block, board: null };
      switchBoard(board).then(follow);
    }
    return;
  }
  if (!state.doc.blocks[block]) return;
  wanted = null;
  setTimeout(() => reveal(block), 0);
}

/** À appeler lors d'un geste de l'utilisateur : les navigateurs l'exigent.
    Connecté, l'appareil s'abonne aussi aux notifications push. */
export function askNotificationPermission() {
  if (syncUser() && pushState() === "off") {
    enablePush().catch(() => {});
    return;
  }
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}
