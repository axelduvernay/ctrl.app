/* Menus : clic droit sur le canvas, et menu du compte en haut à droite. */

import { state, isContainer, zoneFor, categoryList, getCategory, addCategory, updateCategory, removeCategory, PALETTE, fieldsOf,
         mutate, addZone, addLink, removeItems, addBlock, storageUsed, emit } from "./store.js";
import { el, icon, bounds, uid, ICON_PATHS } from "./util.js";
import { openProps } from "./props.js";
import { render } from "./render.js";
import { setCategory, setDue, stopEditing } from "./editor.js";
import { align } from "./arrange.js";
import { fitAll } from "./viewport.js";
import { exportBoard, importBoard } from "./io.js";
import { toggleFilter, toggleDoneFilter, clearFilters } from "./search.js";
import { toast, VERSION } from "./main.js";
import { play, soundsEnabled, setSoundsEnabled } from "./sounds.js";
import { syncAvailable, syncUser, syncStatus, signOut, listSnapshots, restoreSnapshot } from "./sync.js";
import { showLogin } from "./onboarding.js";
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
  // offsetWidth/Height : la taille réelle, sans l'échelle de l'animation
  // d'ouverture. Sur un petit écran, le menu ne sort jamais du cadre.
  const w = popup.offsetWidth;
  const h = popup.offsetHeight;
  popup.style.left = Math.max(12, Math.min(x, innerWidth - w - 12)) + "px";
  popup.style.top = Math.max(12, Math.min(y, innerHeight - h - 12)) + "px";
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
      action("Aligner", () => align(), { hint: "R", iconPath: ALIGN_ICON }),
      sep(),
      action("Tout sélectionner", () => {
        for (const id of Object.keys(state.doc.blocks)) state.selection.add(id);
        emit("selection");
        render();
      }, { hint: "⌘A" }),
    ]);
  }

  // Seulement des traits de liaison sélectionnés : rien d'autre à proposer.
  if (ids.length && ids.every((id) => state.doc.links[id])) {
    return openPopup(x, y, [
      action(ids.length > 1 ? `Supprimer les liens (${ids.length})` : "Supprimer le lien", () => {
        mutate(() => removeItems(ids));
        play("delete");
        render();
      }, { hint: "suppr" }),
    ]);
  }

  const many = ids.length > 1;
  // Clic droit dans une zone conteneur : la ranger de l'intérieur.
  const zoneId = ids.length === 1 && isContainer(state.doc.zones[ids[0]]) ? ids[0] : null;
  const linkIds = Object.values(state.doc.links)
    .filter((l) => blockIds.includes(l.from) || blockIds.includes(l.to)).map((l) => l.id);
  return openPopup(x, y, [
    ...zoneColorItems(ids),
    zoneId ? action("Aligner la zone", () => align(zoneId), { iconPath: ALIGN_ICON }) : null,
    zoneId ? sep() : null,
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
          play("link");
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
          mutate(() => {
            // La nouvelle zone prend la place de ce qu'elle regroupe : même
            // zone parente, et les éléments regroupés deviennent ses enfants.
            const zone = addZone({ x: b.x - 28, y: b.y - 44, w: b.w + 56, h: b.h + 72, parent: null });
            for (const id of ids) {
              const z = state.doc.zones[id];
              if (z && isContainer(z)) z.parent = zone.id;
            }
            zone.parent = zoneFor(zone, zone.id)?.id || null;
            for (const id of blockIds) if (!state.doc.blocks[id].archived) state.doc.blocks[id].zone = zone.id;
          });
          render();
        })
      : null,
    ids.length ? action("Dupliquer", () => duplicate(ids), { hint: "⌘D" }) : null,
    ids.length ? sep() : null,
    ids.length
      ? action(many ? `Supprimer (${ids.length})` : "Supprimer", () => {
          mutate(() => removeItems(ids));
        play("delete");
          render();
        }, { hint: "suppr" })
      : null,
  ]);
}

/* Couleur de fond d'une zone : les teintes de la charte, posées en voile
   léger. La pastille barrée rend la zone neutre. */
function zoneColorItems(ids) {
  const zones = ids.map((id) => state.doc.zones[id]).filter((z) => z && !z.archive);
  if (!zones.length) return [];
  const current = zones[0].color || null;
  const pick = (color) => {
    closeMenus();
    mutate(() => { for (const z of zones) z.color = color; });
    render();
  };
  return [
    label(zones.length > 1 ? `Couleur du fond (${zones.length})` : "Couleur du fond"),
    el("div", { class: "zone-colors" },
      el("button", {
        type: "button", class: "swatch is-none" + (!current ? " is-current" : ""),
        title: "Aucune", "aria-label": "Aucune couleur", onclick: () => pick(null),
      }),
      ...PALETTE.map((color) => el("button", {
        type: "button", class: "swatch" + (current === color ? " is-current" : ""),
        style: `--c:${color}`, "aria-label": color, onclick: () => pick(color),
      }))
    ),
    sep(),
  ];
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

const ALIGN_ICON = '<path d="M4 4v16"/><rect x="7" y="6" width="10" height="4" rx="1.2"/><rect x="7" y="14" width="13" height="4" rx="1.2"/>';

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
    ...accountItems(),
    sep(),
    label("Thème"),
    action("Système", () => setTheme("system"), { hint: theme === "system" ? "✓" : "" }),
    action("Clair", () => setTheme("light"), { hint: theme === "light" ? "✓" : "" }),
    action("Sombre", () => setTheme("dark"), { hint: theme === "dark" ? "✓" : "" }),
    sep(),
    action("Sons de l'interface", () => {
      setSoundsEnabled(!soundsEnabled());
      toast(soundsEnabled() ? "Sons activés" : "Sons coupés");
    }, { hint: soundsEnabled() ? "✓" : "" }),
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
    el("div", { class: "label", text: `${describeSize(storageUsed())} · ${Object.keys(state.doc.blocks).length} blocs · v${VERSION}` }),
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

/* ---------- Compte et synchronisation ---------- */

const STATUS_TEXT = {
  synced: "Synchronisé",
  syncing: "Synchronisation…",
  pending: "Modifications en attente",
  offline: "Hors ligne — synchronisera au retour du réseau",
  error: "Synchronisation interrompue, nouvel essai bientôt",
  off: "",
};

function accountItems() {
  if (!syncAvailable()) {
    return [el("div", { class: "label", text: "Synchronisation indisponible (hors ligne)" })];
  }
  const user = syncUser();
  if (!user) {
    return [action("Se connecter…", () => showLogin(), { hint: "par e-mail" })];
  }
  return [
    el("div", { class: "account" },
      el("span", { class: "sync-dot is-" + syncStatus() }),
      el("div", {},
        el("div", { class: "account-email", text: user.email }),
        el("div", { class: "account-status", text: STATUS_TEXT[syncStatus()] || "" }))),
    action("Historique…", () => openHistory()),
    action("Se déconnecter", async () => {
      await signOut();
      toast("Déconnecté — le board reste sur cet appareil");
    }),
  ];
}

/* L'historique : une copie du board par jour, sur 30 jours. Revenir à l'une
   d'elles met d'abord le board actuel de côté. */
async function openHistory() {
  closeMenus();
  const panel = el("div", { class: "popup history", role: "dialog", "aria-label": "Historique" },
    label("Historique"), el("div", { class: "label", text: "Chargement…" }));
  document.body.append(panel);
  popup = panel;
  panel.style.left = Math.max(12, innerWidth - 300 - 18) + "px";
  panel.style.top = "68px";

  let snapshots = [];
  try { snapshots = await listSnapshots(); } catch { /* réseau */ }
  if (popup !== panel) return;
  const when = (iso) => new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  panel.replaceChildren(
    label("Historique"),
    ...(snapshots.length
      ? snapshots.map((s) => action(when(s.created_at), async () => {
          if (!confirm("Revenir à la version du " + when(s.created_at) + " ?\nLe board actuel est gardé dans l'historique.")) return;
          try {
            await restoreSnapshot(s.id);
            toast("Version restaurée · le board d'avant est dans l'historique");
          } catch {
            toast("Restauration impossible pour l'instant");
          }
        }))
      : [el("div", { class: "label", text: "Aucune copie pour l'instant. La première est faite à la prochaine synchronisation, puis une par jour." })]),
  );
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
