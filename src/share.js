/* Sélecteur de boards et partage.

   Le sélecteur tient en un mot, en haut à gauche : le nom du board ouvert,
   en petit et en gris. Il n'apparaît que lorsqu'il y a de quoi choisir
   (plusieurs boards, un board partagé, une vue invité). Un clic ouvre la
   liste ; c'est tout.

   Le partage se fait par lien : « peut modifier » ou « lecture seule », pour
   le board entier ou pour une seule zone. Le lien s'ouvre sur une carte qui
   dit qui partage quoi ; un lien de lecture se consulte même sans compte. */

import { state, on } from "./store.js";
import { el, icon } from "./util.js";
import { toast } from "./main.js";
import { closeMenus, registerPopup } from "./menus.js";
import {
  syncUser, boardsList, switchBoard, createBoard, renameBoard,
  ensureLink, revokeLinks, listMembers, removeMember,
} from "./sync.js";
import { showLogin } from "./onboarding.js";

const CHEVRON = '<path d="M7 10l5 5 5-5"/>';
const CHECK = '<path d="M5 12.5l4.5 4.5L19 7"/>';
const PLUS = '<path d="M12 5v14M5 12h14"/>';
const CLOSE = '<path d="M6 6l12 12M18 6L6 18"/>';

/* ---------- Sélecteur de boards ---------- */

let switcher = null;

export function initShare() {
  switcher = el("button", { id: "board-switch", type: "button", "aria-haspopup": "menu", onclick: openBoards });
  document.getElementById("app").append(switcher);
  on("board", update);
  on("boards", update);
  on("sync", update);
  update();
}

function roleTag(b) {
  if (b.guest) return "lecture seule";
  if (b.zone) return b.role === "viewer" ? "zone, en lecture" : "zone partagée";
  if (b.role === "viewer") return "lecture seule";
  if (b.role === "editor") return "partagé";
  return "";
}

function update() {
  const b = state.board;
  document.body.classList.toggle("is-readonly", !!state.readOnly);
  // Rien à choisir : rien à afficher.
  const worth = b.guest || (syncUser() && (boardsList().length > 1 || b.role !== "owner"));
  switcher.hidden = !worth;
  if (!worth) return;
  const tag = roleTag(b);
  switcher.replaceChildren(...[
    el("span", { class: "name", text: b.zone && b.zoneName ? b.zoneName : b.name }),
    tag ? el("span", { class: "tag", text: tag }) : null,
    icon(CHEVRON, 13)].filter(Boolean));
}

function openBoards() {
  closeMenus();
  const list = boardsList();
  const panel = el("div", { class: "popup boards", role: "menu" });
  let renaming = false;

  const draw = () => {
    const rows = state.board.guest
      ? [el("div", { class: "board-row is-current" }, el("span", { class: "name", text: state.board.name }), el("span", { class: "tag", text: "lecture seule" }))]
      : list.map((b) => {
          const current = b.id === state.board.id;
          if (current && renaming) {
            const input = el("input", { type: "text", value: b.name, "aria-label": "Nom du board" });
            const done = () => { renameBoard(input.value); renaming = false; closeMenus(); };
            input.addEventListener("keydown", (e) => {
              e.stopPropagation();
              if (e.key === "Enter") done();
              if (e.key === "Escape") { renaming = false; draw(); }
            });
            input.addEventListener("blur", done);
            setTimeout(() => { input.focus(); input.select(); }, 0);
            return el("div", { class: "board-row is-current" }, input);
          }
          return el("button", {
            type: "button", class: "board-row" + (current ? " is-current" : ""),
            onclick: () => { closeMenus(); if (!current) switchBoard(b.id); },
          },
            el("span", { class: "name", text: b.zone && b.zoneName ? b.zoneName : b.name }),
            roleTag(b) ? el("span", { class: "tag", text: roleTag(b) }) : null,
            current ? icon(CHECK, 14) : null);
        });

    const own = state.board.role === "owner" || (state.board.role === "editor" && !state.board.zone);
    panel.replaceChildren(...[
      ...rows,
      el("div", { class: "sep" }),
      state.board.guest
        ? el("button", { type: "button", class: "board-action", onclick: () => { closeMenus(); showLogin({ link: true }); } },
            el("span", { text: "Se connecter pour l'ajouter à mes boards" }))
        : el("button", { type: "button", class: "board-action", onclick: () => { closeMenus(); createBoard(); } },
            icon(PLUS, 14), el("span", { text: "Nouveau board" })),
      own && !state.board.guest
        ? el("button", { type: "button", class: "board-action", onclick: () => { renaming = true; draw(); } }, el("span", { text: "Renommer" }))
        : null,
    ].filter(Boolean));
  };

  draw();
  document.body.append(panel);
  registerPopup(panel);
  const r = switcher.getBoundingClientRect();
  panel.style.left = r.left + "px";
  panel.style.top = r.bottom + 8 + "px";
}

/* ---------- Partager ---------- */

/** Ce qu'on peut partager depuis le board ouvert. */
export function canShare(zoneId = null) {
  const b = state.board;
  if (b.guest || b.id === "local") return false;
  if (b.role === "owner") return true;
  if (b.role !== "editor") return false;
  // Un éditeur limité à une zone ne partage que cette zone.
  return !b.zone || (zoneId || b.zone) === b.zone;
}

/** Le panneau de partage, pour le board entier ou une zone. */
export function openShare(zoneId = null) {
  closeMenus();
  if (!syncUser()) {
    toast("Connecte-toi pour partager");
    return showLogin();
  }
  // Connecté mais toujours sur le board de l'appareil : la base n'a pas
  // encore été mise à niveau (script SQL), ou la synchro n'a pas abouti.
  if (state.board.id === "local") {
    return toast("Partage pas encore activé : relance le script SQL dans Supabase (ETAPES-PARTAGE.txt), puis recharge l'app");
  }
  // Un éditeur de zone partage toujours sa zone.
  const zone = zoneId || state.board.zone || null;
  if (!canShare(zone)) return toast("Seuls le propriétaire et les éditeurs peuvent partager");

  const zoneName = zone && (state.doc.zones[zone]?.name || "Sans titre");
  const panel = el("div", { class: "popup share", role: "dialog", "aria-label": "Partager" });

  const linkRow = (role, label, hint) => {
    const button = el("button", { type: "button", class: "copy", text: "Copier le lien" });
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "…";
      try {
        const url = await ensureLink(role, zone);
        await copy(url);
        button.textContent = "Copié";
        button.classList.add("is-done");
        setTimeout(() => { button.textContent = "Copier le lien"; button.classList.remove("is-done"); button.disabled = false; }, 1600);
      } catch {
        button.textContent = "Copier le lien";
        button.disabled = false;
        toast("Lien impossible pour l'instant");
      }
    });
    return el("div", { class: "share-row" },
      el("div", {}, el("div", { class: "share-label", text: label }), el("div", { class: "share-hint", text: hint })),
      button);
  };

  const people = el("div", { class: "share-people" });
  panel.append(
    el("div", { class: "share-title", text: zone ? `Partager la zone « ${zoneName} »` : `Partager « ${state.board.name} »` }),
    linkRow("editor", "Peut modifier", "Il se connecte avec son e-mail."),
    linkRow("viewer", "Lecture seule", "Avec ou sans compte."),
    people,
    el("button", {
      type: "button", class: "share-revoke", text: "Désactiver les liens",
      onclick: async () => {
        try { await revokeLinks(zone); toast("Liens désactivés · les personnes déjà ajoutées gardent l'accès"); }
        catch { toast("Impossible pour l'instant"); }
      },
    }));
  document.body.append(panel);
  registerPopup(panel);
  panel.style.left = Math.max(12, innerWidth - 360 - 18) + "px";
  panel.style.top = "68px";
  drawPeople(people, zone);
}

async function drawPeople(box, zone) {
  let members = [];
  try { members = await listMembers(); } catch { return; }
  members = members.filter((m) => (zone ? m.zone_id === zone : !m.zone_id));
  if (!members.length) return;
  box.replaceChildren(
    el("div", { class: "share-label small", text: "Ont accès" }),
    ...members.map((m) => el("div", { class: "person" },
      el("span", { class: "email", text: m.email || "Sans e-mail" }),
      el("span", { class: "role", text: m.role === "editor" ? "modifie" : "lit" }),
      el("button", {
        type: "button", class: "remove", "aria-label": "Retirer l'accès", title: "Retirer l'accès",
        onclick: async (e) => {
          try { await removeMember(m.user_id); e.currentTarget.closest(".person").remove(); toast("Accès retiré"); }
          catch { toast("Impossible pour l'instant"); }
        },
      }, icon(CLOSE, 12)))));
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Presse-papiers refusé : on montre le lien à copier à la main.
    prompt("Copie ce lien :", text);
  }
}
