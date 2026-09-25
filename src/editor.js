/* Édition du texte d'un bloc, et menu des slash-commandes.

   La slash-commande est le chemin clavier de la catégorisation ; le clic droit
   est son équivalent souris. Les deux aboutissent à `setCategory`, pour qu'il
   n'existe qu'une seule définition du comportement. */

import { state, begin, commit, mutate, categoryList, getCategory, emit } from "./store.js";
import { render, nodeFor } from "./render.js";
import { el, fold } from "./util.js";

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
        delete state.doc.blocks[id];
        state.doc.order = state.doc.order.filter((x) => x !== id);
        state.selection.delete(id);
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
    (e.key === "Enter" && state.doc.zones[state.editing]) ||  // nom de zone : une ligne
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

function updateSlashMenu(element) {
  const found = currentSlashQuery(element);
  if (!found) return closeSlashMenu();

  slashRange = found;
  const q = fold(found.query);
  const matches = categoryList().filter(
    (cat) => !q || fold(cat.cmd).startsWith(q) || fold(cat.label).startsWith(q)
  );
  if (!matches.length) return closeSlashMenu();

  if (!slashMenu) {
    slashMenu = el("div", { class: "popup", role: "menu" });
    document.body.append(slashMenu);
  }

  slashMenu.replaceChildren(
    el("div", { class: "label", text: "Transformer en" }),
    ...matches.map((cat, i) =>
      el("button", {
        class: i === 0 ? "is-active" : "",
        type: "button",
        onmousedown: (ev) => ev.preventDefault(),
        onclick: () => applySlash(cat.id, element),
      },
        el("span", { class: "dot", style: `--c:${cat.color}` }),
        el("span", { text: cat.label }),
        el("span", { class: "hint", text: "/" + cat.cmd })
      )
    )
  );

  const rect = caretRect(element);
  slashMenu.style.left = Math.min(rect.left, innerWidth - 210) + "px";
  slashMenu.style.top = rect.bottom + 6 + "px";
}

function caretRect(element) {
  const sel = getSelection();
  if (sel.rangeCount) {
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (r.width || r.height || r.left) return r;
  }
  return element.getBoundingClientRect();
}

function applySlash(category, element) {
  // Retire le texte « /xxx » saisi, puis applique la catégorie.
  if (slashRange) {
    const { node, start, query } = slashRange;
    const text = node.textContent;
    node.textContent = text.slice(0, start) + text.slice(start + query.length + 1);
    const range = document.createRange();
    range.setStart(node, Math.min(start, node.textContent.length));
    range.collapse(true);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  closeSlashMenu();
  const block = state.doc.blocks[state.editing];
  if (block) {
    block.text = element.textContent;
    block.category = category;
    block.done = false;
  }
  render();
  element.focus();
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
