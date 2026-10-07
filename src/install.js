/* ctrl.app comme une app, sur le téléphone.

   - Sur iPhone, dans Safari : une petite invitation, une seule fois, à
     l'ajouter à l'écran d'accueil (Partager → Sur l'écran d'accueil). Elle
     s'ouvre ensuite en plein écran, comme une app.
   - Sur Android : le bouton « Installer » du navigateur, proposé au même
     endroit.
   - Ouvert avec ?new=text ou ?new=task (raccourcis de l'icône sur Android),
     un bloc est créé tout de suite, prêt à écrire : noter une idée en deux
     gestes. */

import { el, icon } from "./util.js";
import { createBlockAtCenter } from "./interact.js";

const DISMISSED = "ctrl-install-hint";
const SHARE = '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/>';

const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isPhone = () => matchMedia("(pointer: coarse)").matches && Math.min(innerWidth, innerHeight) < 700;
const isIOS = () => /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

let deferred = null; // l'invite d'installation d'Android, gardée pour plus tard

export function initInstall() {
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    hint();
  });
  quickCapture();
  if (isIOS()) setTimeout(hint, 2500);
}

function quickCapture() {
  const kind = new URLSearchParams(location.search).get("new");
  if (!kind) return;
  history.replaceState(null, "", location.pathname);
  setTimeout(() => createBlockAtCenter(kind === "task" ? { category: "task" } : {}), 300);
}

function hint() {
  let dismissed = false;
  try { dismissed = !!localStorage.getItem(DISMISSED); } catch {}
  if (dismissed || standalone() || !isPhone() || document.querySelector(".install-hint")) return;

  const close = () => {
    try { localStorage.setItem(DISMISSED, "1"); } catch {}
    card.classList.remove("is-visible");
    setTimeout(() => card.remove(), 400);
  };
  const text = deferred
    ? el("span", { text: "Installe ctrl sur ton téléphone : il s'ouvre comme une app." })
    : el("span", {}, "Ajoute ctrl à ton écran d'accueil : ", icon(SHARE, 15), " puis « Sur l'écran d'accueil ».");
  const card = el("div", { class: "install-hint", role: "status" },
    el("img", { src: "icons/icon-192.png", alt: "" }),
    text,
    deferred ? el("button", { type: "button", class: "install-go", text: "Installer", onclick: async () => {
      deferred.prompt();
      await deferred.userChoice.catch(() => {});
      deferred = null;
      close();
    } }) : null,
    el("button", { type: "button", class: "install-close", "aria-label": "Fermer", onclick: close }, icon('<path d="M6 6l12 12M18 6L6 18"/>', 14)));
  document.body.append(card);
  requestAnimationFrame(() => card.classList.add("is-visible"));
}
