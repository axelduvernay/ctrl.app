/* Édition du texte d'un bloc, et menu des slash-commandes.

   La slash-commande est le chemin clavier de la catégorisation ; le clic droit
   est son équivalent souris. Les deux aboutissent à `setCategory`, pour qu'il
   n'existe qu'une seule définition du comportement. */

import { state, begin, commit, mutate, categoryList, getCategory, removeItems, emit } from "./store.js";
import { render, nodeFor } from "./render.js";
import { el, fold, icon, ICON_PATHS } from "./util.js";
import { toList, LIST_TYPES } from "./lists.js";
import { createVariant } from "./variant.js";
import { openProps } from "./props.js";
import { askNotificationPermission } from "./reminders.js";

let slashMenu = null;
let slashRange = null;

export function startEditing(id, element, at) {
  if (!element) return;
  // Déjà en cours sur cet élément (le second clic d'un double-clic, par
  // exemple) : on déplace seulement le curseur, sans refermer ni rouvrir.
  if (state.editing === id && element.isContentEditable) {
    // Zone : on resélectionne tout le nom. Bloc : on laisse la sélection que
    // le navigateur vient de faire (un double-clic sélectionne le mot visé).
    if (state.doc.zones[id]) selectAll(element);
    return;
  }
  stopEditing();
  state.editing = id;
  element.contentEditable = "true";
  element.spellcheck = false;
  element.focus();
  if (state.doc.zones[id]) selectAll(element);  // renommer : on remplace
  else if (!at || !placeCaretAt(element, at.x, at.y)) placeCaretAtEnd(element);
  element.addEventListener("input", onInput);
  element.addEventListener("keydown", onKeyDown);
  element.addEventListener("blur", onBlur);
  begin();
  render();
}

export function stopEditing() {
  if (!state.editing) return;
  const id = state.editing;
  const node = nodeFor(id);
  const element = node?.querySelector('[contenteditable="true"]');
  state.editing = null;
  closeSlashMenu();

  if (element) {
    // Les écouteurs partent avant que l'élément ne perde son statut éditable,
    // sinon la perte de focus qui en découle relancerait une fermeture.
    element.removeEventListener("input", onInput);
    element.removeEventListener("keydown", onKeyDown);
    element.removeEventListener("blur", onBlur);
    element.contentEditable = "false";
    const text = element.textContent.trim();
    const block = state.doc.blocks[id];
    const zone = state.doc.zones[id];
    if (block) {
      block.text = element.textContent;
      block.updatedAt = Date.now();
      measure(block, node);
      // Un bloc resté vide n'a pas lieu d'encombrer le canvas.
      if (!text && block.kind === "text") {
        removeItems([id]);
      }
    } else if (zone) {
      zone.name = element.textContent.trim();
    }
  }
  commit();
  render();
}

/** Ajuste la hauteur stockée à ce que le texte occupe réellement. */
function measure(block, node) {
  if (!node || block.kind !== "text") return;
  const h = Math.max(56, Math.round(node.getBoundingClientRect().height / state.view.scale));
  block.h = h;
}

function onInput(e) {
  const element = e.currentTarget;
  const block = state.doc.blocks[state.editing];
  if (block) {
    block.text = element.textContent;
    measure(block, nodeFor(state.editing));
  }
  updateSlashMenu(element);
}

function onKeyDown(e) {
  if (slashMenu) {
    const items = [...slashMenu.querySelectorAll("button")];
    const active = slashMenu.querySelector(".is-active");
    const i = items.indexOf(active);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
      active?.classList.remove("is-active");
      next?.classList.add("is-active");
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      // L'action peut refermer l'édition : Entrée ne doit pas alors remonter
      // jusqu'au raccourci global, qui la rouvrirait aussitôt.
      e.stopPropagation();
      active?.click();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeSlashMenu();
      return;
    }
  }

  // Les touches qui terminent l'édition ne doivent pas remonter jusqu'aux
  // raccourcis globaux : Entrée y rouvrirait l'édition, Échap y viderait la
  // sélection.
  const finishes =
    e.key === "Escape" ||
    // Nom de zone ou titre de liste : une seule ligne.
    (e.key === "Enter" && (state.doc.zones[state.editing] || state.doc.blocks[state.editing]?.kind === "list")) ||
    (e.key === "Enter" && (e.metaKey || e.ctrlKey));
  if (finishes) {
    e.preventDefault();
    e.stopPropagation();
    stopEditing();
  }
}

function onBlur(e) {
  // Un clic dans le menu slash ne doit pas fermer l'édition.
  if (slashMenu && slashMenu.contains(e.relatedTarget)) return;
  const id = state.editing;
  const element = e.currentTarget;
  // Fermeture différée, et seulement si le focus n'est pas revenu entre-temps
  // sur la même édition.
  setTimeout(() => {
    if (state.editing === id && document.activeElement !== element) stopEditing();
  }, 0);
}

/** Place le curseur sous le point cliqué, si ce point tombe dans le texte. */
function placeCaretAt(element, x, y) {
  const range = document.caretRangeFromPoint?.(x, y)
    ?? (() => {
      const pos = document.caretPositionFromPoint?.(x, y);
      if (!pos) return null;
      const r = document.createRange();
      r.setStart(pos.offsetNode, pos.offset);
      return r;
    })();
  if (!range || !element.contains(range.startContainer)) return false;
  range.collapse(true);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

function selectAll(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function placeCaretAtEnd(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

/* ---------- Menu des slash-commandes ---------- */

function currentSlashQuery(element) {
  const sel = getSelection();
  if (!sel.rangeCount) return null;
  const node = sel.focusNode;
  if (!node || !element.contains(node)) return null;
  const text = node.textContent || "";
  const upto = text.slice(0, sel.focusOffset);
  const match = upto.match(/(?:^|\s)\/([\p{L}]*)$/u);
  if (!match) return null;
  return { query: match[1], start: sel.focusOffset - match[1].length - 1, node };
}

/* Au-delà des catégories, la slash-commande crée des blocs spécialisés et
   ajoute des champs. Chaque entrée a des alias : on tape le mot qui vient. */
const SLASH_ACTIONS = [
  { id: "reminder", label: "Rappel", cmd: "rappel", aliases: ["reminder", "alarme", "notif"], section: "Ajouter", icon: ICON_PATHS.remind },
  { id: "due", label: "Échéance", cmd: "echeance", aliases: ["date", "due", "deadline"], section: "Ajouter", icon: ICON_PATHS.due },
  { id: "tracks", label: "Tracklist", cmd: "tracklist", aliases: ["music", "musique", "playlist", "audio", "son"], section: "Bloc", icon: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>' },
  { id: "files", label: "Dossier", cmd: "folder", aliases: ["dossier", "fichiers", "files"], section: "Bloc", icon: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' },
  { id: "variant", label: "Variante", cmd: "variant", aliases: ["variante", "branche", "version", "v2"], section: "Bloc", icon: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 5-8 3-11.5 7"/>' },
];

function slashMatches(q) {
  const hit = (...words) => !q || words.some((w) => fold(w).startsWith(q));
  const cats = categoryList().filter((cat) => hit(cat.cmd, cat.label))
    .map((cat) => ({ section: "Catégorie", label: cat.label, cmd: cat.cmd, color: cat.color, run: (el) => applySlash(cat.id, el) }));
  const block = state.doc.blocks[state.editing];
  const actions = SLASH_ACTIONS
    // Une liste ne redevient pas une liste ; un titre de liste garde les autres actions.
    .filter((a) => !(block?.kind === "list" && (a.id === "tracks" || a.id === "files")))
    .filter((a) => hit(a.cmd, a.label, ...a.aliases))
    .map((a) => {
      const alias = q && !fold(a.cmd).startsWith(q) ? a.aliases.find((w) => fold(w).startsWith(q)) : null;
      return { section: a.section, label: a.label, cmd: alias || a.cmd, glyph: a.icon, run: (el) => applyAction(a.id, el) };
    });
  return [...cats, ...actions];
}

function updateSlashMenu(element) {
  const found = currentSlashQuery(element);
  if (!found) return closeSlashMenu();

  slashRange = found;
  const matches = slashMatches(fold(found.query));
  if (!matches.length) return closeSlashMenu();

  if (!slashMenu) {
    slashMenu = el("div", { class: "popup slash", role: "menu" });
    document.body.append(slashMenu);
  }

  let section = null;
  const children = [];
  matches.forEach((m, i) => {
    if (m.section !== section) {
      section = m.section;
      children.push(el("div", { class: "label", text: section === "Catégorie" ? "Transformer en" : section }));
    }
    children.push(el("button", {
      class: i === 0 ? "is-active" : "",
      type: "button",
      onmousedown: (ev) => ev.preventDefault(),
      onclick: () => m.run(element),
    },
      m.color ? el("span", { class: "dot", style: `--c:${m.color}` }) : el("span", { class: "glyph" }, icon(m.glyph, 14)),
      el("span", { text: m.label }),
      el("span", { class: "hint", text: "/" + m.cmd })
    ));
  });
  slashMenu.replaceChildren(...children);

  const rect = caretRect(element);
  slashMenu.style.left = Math.min(rect.left, innerWidth - 230) + "px";
  const below = rect.bottom + 6;
  const height = slashMenu.getBoundingClientRect().height;
  slashMenu.style.top = (below + height > innerHeight - 12 ? Math.max(12, rect.top - height - 6) : below) + "px";
}

function caretRect(element) {
  const sel = getSelection();
  if (sel.rangeCount) {
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (r.width || r.height || r.left) return r;
  }
  return element.getBoundingClientRect();
}

/** Retire le « /xxx » tapé, curseur laissé à sa place. */
function stripSlash() {
  if (slashRange) {
    const { node, start, query } = slashRange;
    const text = node.textContent;
    const after = text.slice(start + query.length + 1);
    // Commande tapée en fin de texte : on ne laisse pas l'espace qui la précédait.
    node.textContent = (after ? text.slice(0, start) : text.slice(0, start).trimEnd()) + after;
    const range = document.createRange();
    range.setStart(node, Math.min(start, node.textContent.length));
    range.collapse(true);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  closeSlashMenu();
}

function applySlash(category, element) {
  stripSlash();
  const block = state.doc.blocks[state.editing];
  if (block) {
    block.text = element.textContent;
    block.category = category;
    block.done = false;
  }
  render();
  element.focus();
}

function applyAction(action, element) {
  stripSlash();
  const id = state.editing;
  const block = state.doc.blocks[id];
  if (!block) return;

  if (action === "tracks" || action === "files") {
    // Le texte déjà écrit devient le titre ; l'édition se referme dans la
    // même transaction, donc une seule annulation défait le tout.
    element.textContent = element.textContent.trim() || LIST_TYPES[action].title;
    toList(block, action);
    stopEditing();
    return;
  }

  if (action === "reminder" || action === "due") {
    const field = action === "reminder" ? "remind" : "due";
    // Un bloc vide devient un bloc rappel à part entière, qu'on relie ensuite.
    if (!element.textContent.trim()) element.textContent = action === "reminder" ? "Rappel" : "Échéance";
    block.fields = { ...block.fields, [field]: true };
    if (field === "remind") askNotificationPermission();
    stopEditing();
    openProps(id);
    return;
  }

  if (action === "variant") {
    stopEditing();
    if (state.doc.blocks[id]) createVariant(id);
  }
}

function closeSlashMenu() {
  slashMenu?.remove();
  slashMenu = null;
  slashRange = null;
}

/* ---------- Catégorisation (partagée avec le clic droit) ---------- */

export function setCategory(ids, category) {
  mutate(() => {
    for (const id of ids) {
      const b = state.doc.blocks[id];
      if (!b) continue;
      b.category = b.category === category ? null : category;
      const cat = getCategory(b.category);
      if (!cat || !cat.checkable) b.done = false;
      b.updatedAt = Date.now();
    }
  });
  render();
}

export function setDue(ids, iso) {
  mutate(() => {
    for (const id of ids) {
      const b = state.doc.blocks[id];
      if (b) { b.due = iso; b.updatedAt = Date.now(); }
    }
  });
  render();
}
