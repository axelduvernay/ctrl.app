/* Le panneau « échéance et rappel » d'un bloc.

   Il ne montre que ce que la catégorie du bloc autorise. Les raccourcis
   couvrent les cas courants en un clic ; les champs date et heure couvrent
   tout le reste. */

import { state, mutate, fieldsOf } from "./store.js";
import { el, icon, parseLocal, localISO, formatDate, ICON_PATHS } from "./util.js";
import { render, nodeFor } from "./render.js";
import { openPopup } from "./menus.js";
import { askNotificationPermission } from "./reminders.js";

const CAL = ICON_PATHS.due;
const BELL = ICON_PATHS.remind;

export function openProps(id) {
  const block = state.doc.blocks[id];
  const node = nodeFor(id);
  if (!block || !node) return;
  const fields = fieldsOf(block);
  if (!fields.due && !fields.remind) return;

  const anchor = node.getBoundingClientRect();
  let panel = null;

  /* Le panneau est créé une fois, puis redessiné sur place : le recréer le
     repositionnerait, et les boutons glisseraient sous le curseur entre deux
     clics. */
  const draw = () => {
    const b = state.doc.blocks[id];
    if (!b) return;
    const content = [
      fields.due ? dueSection(b, draw) : null,
      fields.due && fields.remind ? el("div", { class: "sep" }) : null,
      fields.remind ? remindSection(b, draw) : null,
    ];
    if (panel && panel.isConnected) {
      panel.replaceChildren(...content.filter(Boolean));
    } else {
      panel = openPopup(anchor.left, anchor.bottom + 8, content);
      panel.classList.add("props");
    }
  };
  draw();
}

/* ---------- Échéance ---------- */

function dueSection(b, redraw) {
  const [date, time] = split(b.due);
  const set = (value) => {
    mutate(() => { b.due = value; b.updatedAt = Date.now(); });
    render();
    redraw();
  };
  // Un raccourci change le jour et garde l'heure déjà choisie.
  const day = (offset) => join(localISO(addDays(new Date(), offset)), time);

  return el("div", { class: "section" },
    heading("Échéance", CAL, b.due, () => set(null)),
    el("div", { class: "chips" },
      chip("Aujourd'hui", () => set(day(0)), date === localISO(new Date())),
      chip("Demain", () => set(day(1)), date === localISO(addDays(new Date(), 1))),
      chip("Lundi", () => set(join(localISO(nextMonday()), time)), date === localISO(nextMonday()))
    ),
    el("div", { class: "inputs" },
      el("input", {
        type: "date",
        value: date || "",
        "aria-label": "Jour d'échéance",
        onchange: (e) => set(e.target.value ? join(e.target.value, time) : null),
      }),
      el("input", {
        type: "time",
        value: time || "",
        "aria-label": "Heure d'échéance",
        // Une heure sans jour vise aujourd'hui.
        onchange: (e) => set(join(date || localISO(new Date()), e.target.value)),
      })
    )
  );
}

/* ---------- Rappel ---------- */

function remindSection(b, redraw) {
  const set = (value) => {
    if (value) askNotificationPermission();
    mutate(() => {
      b.remind = value;
      b.reminded = false; // un nouveau rappel sonnera de nouveau
      b.updatedAt = Date.now();
    });
    render();
    redraw();
  };

  const now = new Date();
  const inOneHour = roundUp(new Date(now.getTime() + 3600000), 5);
  const tonight = at(now, 20, 0);
  const tomorrowMorning = at(addDays(now, 1), 9, 0);
  const atDue = b.due ? (b.due.length > 10 ? b.due : b.due + "T09:00") : null;

  return el("div", { class: "section" },
    heading("Rappel", BELL, b.remind, () => set(null)),
    el("div", { class: "chips" },
      chip("Dans 1 h", () => set(localISO(inOneHour, true))),
      now < tonight ? chip("Ce soir 20:00", () => set(localISO(tonight, true)), b.remind === localISO(tonight, true)) : null,
      chip("Demain 9:00", () => set(localISO(tomorrowMorning, true)), b.remind === localISO(tomorrowMorning, true)),
      // Toujours présent, désactivé sans échéance : le panneau garde sa taille.
      chip("À l'échéance", () => set(atDue), !!atDue && b.remind === atDue, !atDue || parseLocal(atDue) <= now)
    ),
    el("div", { class: "inputs" },
      el("input", {
        type: "datetime-local",
        value: b.remind || "",
        "aria-label": "Moment du rappel",
        onchange: (e) => set(e.target.value || null),
      })
    ),
    el("div", { class: "hint", text: "Sonne tant que ctrl.app est ouvert, même en arrière-plan." })
  );
}

/* ---------- Éléments ---------- */

function heading(text, path, value, clear) {
  return el("div", { class: "heading" },
    icon(path, 15),
    el("span", { text }),
    el("span", { class: "value", text: value ? formatDate(value) : "aucun" }),
    // Toujours rendu, invisible sans valeur : l'en-tête ne change pas de largeur.
    el("button", {
      type: "button",
      class: "clear",
      "aria-label": `Retirer : ${text.toLowerCase()}`,
      title: "Retirer",
      disabled: !value,
      onclick: clear,
    }, icon('<path d="M6 6l12 12M18 6L6 18"/>', 12))
  );
}

function chip(text, onClick, active = false, disabled = false) {
  return el("button", {
    type: "button",
    class: "chip-btn" + (active ? " is-on" : ""),
    disabled,
    onclick: onClick,
    text,
  });
}

/* ---------- Dates ---------- */

const split = (iso) => (iso ? [iso.slice(0, 10), iso.length > 10 ? iso.slice(11, 16) : ""] : ["", ""]);
const join = (date, time) => (time ? `${date}T${time}` : date);

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function nextMonday() {
  const d = new Date();
  return addDays(d, ((8 - d.getDay()) % 7) || 7);
}

function at(date, h, m) {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function roundUp(date, minutes) {
  const step = minutes * 60000;
  return new Date(Math.ceil(date.getTime() / step) * step);
}
