/* Menus : clic droit sur le canvas, et menu du compte en haut à droite. */

import { state, categoryList, getCategory, addCategory, updateCategory, removeCategory, PALETTE, fieldsOf,
         mutate, addZone, addLink, removeItems, addBlock, storageUsed, emit } from "./store.js";
import { el, icon, bounds, uid, ICON_PATHS } from "./util.js";
import { openProps } from "./props.js";
import { render } from "./render.js";
import { setCategory, setDue, stopEditing } from "./editor.js";
import { arrange } from "./arrange.js";
import { fitAll } from "./viewport.js";
import { exportBoard, importBoard } from "./io.js";
import { toggleFilter, toggleDoneFilter, clearFilters } from "./search.js";
import { toast } from "./main.js";
import { createVariant } from "./variant.js";
import { toList, LIST_TYPES } from "./lists.js";

let popup = null;

export function closeMenus() {
  popup?.remove();
  popup = null;
  document.getElementById("menu-btn")?.setAttribute("aria-expanded", "false");
}

export function openPopup(x, y, children) {
  closeMenus();
  popup = el("div", { class: "popup", role: "menu" }, ...children.filter(Boolean));
  document.body.append(popup);
  const rect = popup.getBoundingClientRect();
  popup.style.left = Math.min(x, innerWidth - rect.width - 12) + "px";
  popup.style.top = Math.min(y, innerHeight - rect.height - 12) + "px";
  return popup;
}

const sep = () => el("div", { class: "sep" });
const label = (text) => el("div", { class: "label", text });

function action(text, onClick, { hint, dot, disabled, iconPath } = {}) {
  return el("button", {
    type: "button",
    disabled: disabled || false,
    onclick: () => { closeMenus(); onClick(); },
  },
    dot ? el("span", { class: "dot", style: `--c:${dot}` }) : iconPath ? icon(iconPath, 16) : null,
    el("span", { text }),
    hint ? el("span", { class: "hint", text: hint }) : null
  );
}

/* ---------- Clic droit ---------- */

export function openContextMenu(x, y, { onEmpty, world }) {
  stopEditing();
  const ids = [...state.selection];
  const blockIds = ids.filter((id) => state.doc.blocks[id]);

  if (onEmpty && !ids.length) {
    return openPopup(x, y, [
      action("Nouveau bloc", () => {
        import("./interact.js").then((m) => m.createBlockAt(world.x, world.y));
      }, { hint: "double-clic" }),
      action("Nouvelle tracklist", () => newList("tracks", world), { hint: "/tracklist" }),
      action("Nouveau dossier", () => newList("files", world), { hint: "/folder" }),
      action("Nouvelle zone", () => {
        mutate(() => addZone({ x: world.x - 210, y: world.y - 150, w: 420, h: 300 }));
        render();
      }),
      sep(),
      ...arrangeItems(),
      sep(),
      action("Tout sélectionner", () => {
        for (const id of Object.keys(state.doc.blocks)) state.selection.add(id);
        emit("selection");
        render();
      }, { hint: "⌘A" }),
    ]);
  }

  const many = ids.length > 1;
  const linkIds = Object.values(state.doc.links)
    .filter((l) => blockIds.includes(l.from) || blockIds.includes(l.to)).map((l) => l.id);
  return openPopup(x, y, [
    blockIds.length ? label("Catégorie") : null,
    ...(blockIds.length
      ? categoryList().map((cat) =>
          action(cat.label, () => setCategory(blockIds, cat.id), { dot: cat.color, hint: "/" + cat.cmd })
        )
      : []),
    blockIds.length ? sep() : null,
    ...fieldItems(blockIds),
    many && blockIds.length > 1
      ? action("Lier les blocs", () => {
          mutate(() => {
            for (let i = 0; i < blockIds.length - 1; i++) addLink(blockIds[i], blockIds[i + 1]);
          });
          render();
          toast(`${blockIds.length} blocs liés`);
        })
      : null,
    linkIds.length
      ? action(linkIds.length > 1 ? `Retirer les liens (${linkIds.length})` : "Retirer le lien", () => {
          mutate(() => { for (const id of linkIds) delete state.doc.links[id]; });
          render();
        })
      : null,
    blockIds.length
      ? action("Créer une variante", () => createVariant(blockIds[0]), { hint: "/variant" })
      : null,
    ids.length
      ? action("Grouper dans une zone", () => {
          const items = ids.map((id) => state.doc.blocks[id] || state.doc.zones[id]).filter(Boolean);
          const b = bounds(items);
          if (!b) return;
          mutate(() => addZone({ x: b.x - 28, y: b.y - 40, w: b.w + 56, h: b.h + 68 }));
          render();
        })
      : null,
    ids.length ? action("Dupliquer", () => duplicate(ids), { hint: "⌘D" }) : null,
    ids.length ? sep() : null,
    ids.length
      ? action(many ? `Supprimer (${ids.length})` : "Supprimer", () => {
          mutate(() => removeItems(ids));
          render();
        }, { hint: "suppr" })
      : null,
  ]);
}

/* Échéance et rappel dépendent de la catégorie : un bloc seul ouvre son
   panneau ; plusieurs blocs reçoivent les raccourcis d'échéance communs. */
function fieldItems(blockIds) {
  const withDue = blockIds.filter((id) => fieldsOf(state.doc.blocks[id]).due);
  const single = blockIds.length === 1 ? state.doc.blocks[blockIds[0]] : null;

  if (single) {
    const f = fieldsOf(single);
    // Sans champ prévu par sa catégorie, n'importe quel bloc peut recevoir un rappel.
    if (!f.due && !f.remind) {
      return [action("Ajouter un rappel…", () => {
        mutate(() => { single.fields = { ...single.fields, remind: true }; });
        render();
        openProps(single.id);
      }, { iconPath: ICON_PATHS.remind, hint: "/rappel" }), sep()];
    }
    const text = f.due && f.remind ? "Échéance et rappel…" : f.due ? "Échéance…" : "Rappel…";
    return [action(text, () => openProps(single.id), { iconPath: ICON_PATHS[f.due ? "due" : "remind"] }), sep()];
  }

  if (!withDue.length) return [];
  return [
    label(`Échéance (${withDue.length})`),
    action("Aujourd'hui", () => setDue(withDue, today(0))),
    action("Demain", () => setDue(withDue, today(1))),
    action("Dans une semaine", () => setDue(withDue, today(7))),
    action("Aucune", () => setDue(withDue, null)),
    sep(),
  ];
}

function arrangeItems() {
  return [
    label("Ranger le tableau"),
    action("Par catégorie", () => arrange("category")),
    action("Par date", () => arrange("date")),
    action("Aligner proprement", () => arrange("tidy")),
  ];
}

export function openArrangeMenu(x, y) {
  openPopup(x, y, arrangeItems());
}

/* Date locale au format AAAA-MM-JJ.
   `toISOString` passerait par UTC : passé minuit en heure d'été, « demain »
   se serait enregistré comme aujourd'hui. */
function today(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function newList(type, world) {
  const block = mutate(() => {
    const b = addBlock({ x: Math.round(world.x - 150), y: Math.round(world.y - 40), text: LIST_TYPES[type].title });
    toList(b, type);
    return b;
  });
  state.selection.clear();
  state.selection.add(block.id);
  emit("selection");
  render();
}

export function duplicate(ids) {
  const fresh = [];
  mutate(() => {
    for (const id of ids) {
      const b = state.doc.blocks[id];
      if (b) {
        const copy = addBlock({ ...structuredClone(b), id: undefined, x: b.x + 24, y: b.y + 24 });
        fresh.push(copy.id);
      }
      const z = state.doc.zones[id];
      if (z) {
        const copy = addZone({ ...z, id: undefined, x: z.x + 24, y: z.y + 24 });
        fresh.push(copy.id);
      }
    }
  });
  state.selection.clear();
  for (const id of fresh) state.selection.add(id);
  emit("selection");
  render();
}

/* ---------- Menu du compte ---------- */

export function openMainMenu(anchor) {
  const btn = document.getElementById("menu-btn");
  if (popup) return closeMenus();
  btn.setAttribute("aria-expanded", "true");
  const rect = anchor.getBoundingClientRect();
  const theme = localStorage.getItem("ctrl-theme") || "system";

  const menu = openPopup(rect.right - 212, rect.bottom + 8, [
    label("Compte"),
    action("Se connecter avec Google", () => toast("La connexion arrivera avec la synchronisation"), { disabled: true }),
    action("Se connecter avec Apple", () => toast("La connexion arrivera avec la synchronisation"), { disabled: true }),
    sep(),
    label("Thème"),
    action("Système", () => setTheme("system"), { hint: theme === "system" ? "✓" : "" }),
    action("Clair", () => setTheme("light"), { hint: theme === "light" ? "✓" : "" }),
    action("Sombre", () => setTheme("dark"), { hint: theme === "dark" ? "✓" : "" }),
    sep(),
    label("Filtrer"),
    ...categoryList().map((cat, i) =>
      action(cat.label, () => toggleFilter(cat.id), {
        dot: cat.color,
        hint: state.filters.categories.has(cat.id) ? "✓" : String(i + 1),
      })
    ),
    action("Modifier les catégories…", () => openCategoryManager()),
    action("À faire seulement", () => toggleDoneFilter(false), { hint: state.filters.done === false ? "✓" : "" }),
    hasFilters() ? action("Tout afficher", () => clearFilters(), { hint: "esc" }) : null,
    sep(),
    action("Tout voir", () => fitAll(), { hint: "maj+1" }),
    action("Exporter le board", () => exportBoard()),
    action("Importer un board…", () => importBoard()),
    sep(),
    el("div", { class: "label", text: `${describeSize(storageUsed())} · ${Object.keys(state.doc.blocks).length} blocs` }),
  ]);
  menu.style.minWidth = "212px";
}

const hasFilters = () => state.filters.categories.size > 0 || state.filters.done !== null;

function describeSize(bytes) {
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " Ko";
  return (bytes / 1024 / 1024).toFixed(1) + " Mo";
}

export function setTheme(theme) {
  localStorage.setItem("ctrl-theme", theme);
  applyTheme();
}

export function applyTheme() {
  const theme = localStorage.getItem("ctrl-theme") || "system";
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = theme;
}

/* ---------- Gestionnaire de catégories ---------- */

/* Les catégories appartiennent au board : on les renomme, on les recolore, on
   en ajoute. Supprimer une catégorie ne supprime aucun bloc — les blocs
   concernés redeviennent simplement neutres. */

export function openCategoryManager() {
  closeMenus();
  const panel = el("div", { class: "popup cat-manager", role: "dialog", "aria-label": "Catégories" });
  let expanded = null; // catégorie dont la palette est ouverte

  const draw = () => {
    const rows = categoryList().map((cat) => {
      const row = el("div", { class: "cat-row", style: `--c:${cat.color}` },
        el("button", {
          class: "dot",
          type: "button",
          "aria-label": `Couleur de ${cat.label}`,
          title: "Changer la couleur",
          onclick: () => { expanded = expanded === cat.id ? null : cat.id; draw(); },
        }),
        el("input", {
          type: "text",
          value: cat.label,
          "aria-label": "Nom de la catégorie",
          // Pas de reconstruction du panneau ici : elle détacherait l'élément
          // sous le curseur avant que le clic suivant n'aboutisse.
          oninput: (e) => {
            mutate(() => updateCategory(cat.id, { label: e.target.value }));
            render();
          },
        }),
        toggle(cat.checkable, "Case à cocher", ICON_PATHS.check,
          () => updateCategory(cat.id, { checkable: !cat.checkable })),
        toggle(cat.fields?.due, "Échéance", ICON_PATHS.due,
          () => updateCategory(cat.id, { fields: { due: !cat.fields?.due } })),
        toggle(cat.fields?.remind, "Rappel", ICON_PATHS.remind,
          () => updateCategory(cat.id, { fields: { remind: !cat.fields?.remind } })),
        el("button", {
          class: "remove",
          type: "button",
          title: "Supprimer la catégorie",
          "aria-label": `Supprimer ${cat.label}`,
          onclick: () => {
            mutate(() => removeCategory(cat.id));
            state.filters.categories.delete(cat.id);
            emit("filters");
            render();
            draw();
          },
        }, icon('<path d="M6 6l12 12M18 6L6 18"/>', 14))
      );

      if (expanded !== cat.id) return row;

      const swatches = el("div", { class: "swatches" },
        ...PALETTE.map((color) =>
          el("button", {
            class: "swatch" + (color === cat.color ? " is-current" : ""),
            type: "button",
            style: `background:${color}`,
            "aria-label": color,
            onclick: () => {
              mutate(() => updateCategory(cat.id, { color }));
              expanded = null;
              render();
              draw();
            },
          })
        )
      );
      return [row, swatches];
    });

    panel.replaceChildren(
      label("Catégories"),
      ...rows.flat(),
      el("div", { class: "sep" }),
      el("button", {
        class: "add",
        type: "button",
        onclick: () => { mutate(() => addCategory({ label: "Nouvelle" })); draw(); },
      }, icon('<path d="M12 5v14M5 12h14"/>', 16), el("span", { text: "Ajouter une catégorie" })),
      el("div", { class: "label", text: "Les trois boutons donnent à la catégorie une case à cocher, une échéance, un rappel." })
    );
  };

  function toggle(on, name, path, change) {
    return el("button", {
      class: "toggle" + (on ? " is-on" : ""),
      type: "button",
      title: (on ? "Retirer : " : "Ajouter : ") + name.toLowerCase(),
      "aria-label": name,
      "aria-pressed": String(!!on),
      onclick: () => { mutate(change); render(); draw(); },
    }, icon(path, 14));
  }

  draw();
  document.body.append(panel);
  popup = panel;
  const rect = panel.getBoundingClientRect();
  panel.style.left = Math.max(12, innerWidth - rect.width - 18) + "px";
  panel.style.top = "68px";
  panel.querySelector("input")?.focus();
}
