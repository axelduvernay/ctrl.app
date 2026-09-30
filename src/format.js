/* Mise en forme du texte d'un bloc : gras, italique, souligné, barré,
   surlignage, titre, liste.

   Discrète par principe : aucune barre permanente. Une petite pilule flotte
   au-dessus du texte sélectionné, seulement pendant l'édition ; ⌘B, ⌘I et ⌘U
   marchent sans elle.

   Un bloc sans mise en forme reste du texte brut (`block.text`). Dès qu'il en
   a, il garde aussi un HTML (`block.html`) réduit à une poignée de balises
   sûres, sans aucun attribut : ce qui entre dans le document est toujours
   passé au crible, qu'il vienne d'une édition, d'un collage ou d'un import. */

import { el, icon } from "./util.js";

const KEEP = new Set(["B", "I", "U", "S", "MARK", "H3", "UL", "OL", "LI", "BR", "DIV", "P"]);
const RENAME = { STRONG: "B", EM: "I", STRIKE: "S", DEL: "S" };
const FORMATTING = /<(b|i|u|s|mark|h3|ul|ol|li)\b/i;

/** Ne garde que les balises autorisées, sans attributs ; le reste devient du texte. */
export function sanitize(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  clean(tpl.content);
  return tpl.innerHTML;
}

const HIGHLIGHT = /background(-color)?\s*:\s*(?!transparent|initial|inherit|rgba\(0,\s*0,\s*0,\s*0\))/i;

function clean(parent) {
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) continue;
    if (node.nodeType !== Node.ELEMENT_NODE) { node.remove(); continue; }
    clean(node);
    const tag = RENAME[node.tagName] || node.tagName;
    // Le surlignage du navigateur arrive en style (background-color), posé
    // sur un <span> ou directement sur un <b>, un <i>… On le traduit en <mark>.
    const highlighted = tag !== "MARK" && HIGHLIGHT.test(node.getAttribute("style") || "");
    let out = KEEP.has(tag) ? document.createElement(tag) : null;
    if (highlighted) {
      const mark = document.createElement("mark");
      mark.append(...node.childNodes);
      out ? out.append(mark) : (out = mark);
    } else if (out) {
      out.append(...node.childNodes);
    }
    out ? node.replaceWith(out) : node.replaceWith(...node.childNodes);
  }
}

/** Ce qu'on enregistre d'un élément édité : le texte brut, et le HTML s'il y a de la mise en forme. */
export function readRich(element) {
  const text = element.innerText.replace(/\n$/, "");
  const html = sanitize(element.innerHTML);
  return { text, html: FORMATTING.test(html) ? html : null };
}

/** Affiche le contenu d'un bloc dans son élément, sans le réécrire s'il n'a pas changé. */
export function writeRich(element, b) {
  if (b.html) {
    if (element._html === b.html) return;
    element.innerHTML = sanitize(b.html);
    element._html = b.html;
  } else if (element._html || element.textContent !== b.text) {
    element.textContent = b.text;
    element._html = null;
  }
}

/* ---------- La barre flottante ---------- */

const ACTIONS = [
  { cmd: "bold", label: "Gras", key: "⌘B", glyph: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>' },
  { cmd: "italic", label: "Italique", key: "⌘I", glyph: '<path d="M10 5h8M6 19h8M14 5l-4 14"/>' },
  { cmd: "underline", label: "Souligné", key: "⌘U", glyph: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>' },
  { cmd: "strikeThrough", label: "Barré", glyph: '<path d="M5 12h14M16 7a4 3 0 0 0-8 0c0 3 8 2 8 6a4 3 0 0 1-8 0"/>' },
  { cmd: "hiliteColor", label: "Surligner", glyph: '<path d="M4 20h16M7 16l2-6 7-7 3 3-7 7z"/>' },
  { cmd: "heading", label: "Titre", glyph: '<path d="M6 5v14M18 5v14M6 12h12"/>' },
  { cmd: "insertUnorderedList", label: "Liste", glyph: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.5" cy="7" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17" r="1"/>' },
];

let bar = null;
let host = null; // l'élément en cours d'édition

/** À appeler quand un bloc passe en édition. */
export function attachFormatting(element) {
  host = element;
  element.addEventListener("paste", onPaste);
}

export function detachFormatting(element) {
  element.removeEventListener("paste", onPaste);
  host = null;
  hideBar();
}

/* Un collage arrive en texte brut : les styles d'une page web n'ont rien à
   faire dans un bloc. */
function onPaste(e) {
  const text = e.clipboardData?.getData("text/plain");
  if (text == null) return;
  e.preventDefault();
  document.execCommand("insertText", false, text);
}

function run(cmd) {
  document.execCommand("styleWithCSS", false, false);
  if (cmd === "hiliteColor") {
    const mark = highlightAt();
    if (mark) {
      // Déjà surligné : on défait le surlignage qui entoure la sélection.
      mark.replaceWith(...mark.childNodes);
    } else {
      document.execCommand("styleWithCSS", false, true);
      document.execCommand("hiliteColor", false, "rgba(224, 109, 59, 0.22)");
      document.execCommand("styleWithCSS", false, false);
    }
  } else if (cmd === "heading") {
    const on = /h3/i.test(document.queryCommandValue("formatBlock"));
    document.execCommand("formatBlock", false, on ? "div" : "h3");
  } else {
    document.execCommand(cmd);
  }
  host?.dispatchEvent(new Event("input"));
  refresh();
}

function highlightAt() {
  const node = getSelection().anchorNode;
  const elm = node && (node.nodeType === 1 ? node : node.parentElement);
  const mark = elm?.closest("mark, span[style*='background']");
  return mark && host?.contains(mark) ? mark : null;
}

const isHighlighted = () => !!highlightAt();

function isOn(cmd) {
  if (cmd === "hiliteColor") return isHighlighted();
  if (cmd === "heading") return /h3/i.test(document.queryCommandValue("formatBlock"));
  try { return document.queryCommandState(cmd); } catch { return false; }
}

function showBar() {
  if (!bar) {
    bar = el("div", { class: "format-bar", role: "toolbar", "aria-label": "Mise en forme" },
      ...ACTIONS.map((a) => el("button", {
        type: "button",
        "data-cmd": a.cmd,
        title: a.key ? `${a.label} (${a.key})` : a.label,
        "aria-label": a.label,
        // Garder la sélection : un clic ne doit pas déplacer le focus.
        onmousedown: (e) => e.preventDefault(),
        onclick: () => run(a.cmd),
      }, icon(a.glyph, 15)))
    );
    document.body.append(bar);
  }
  bar.hidden = false;
  refresh();
}

function hideBar() {
  if (bar) { bar.hidden = true; bar.classList.remove("is-visible"); }
}

function refresh() {
  if (!bar || bar.hidden) return;
  for (const b of bar.querySelectorAll("button")) b.classList.toggle("is-on", isOn(b.dataset.cmd));
  const sel = getSelection();
  if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0).getBoundingClientRect();
  const w = bar.offsetWidth;
  bar.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
  const above = r.top - bar.offsetHeight - 10;
  bar.style.top = (above > 8 ? above : r.bottom + 10) + "px";
  requestAnimationFrame(() => bar.classList.add("is-visible"));
}

/* La barre suit la sélection : visible dès qu'un bout de texte est
   sélectionné dans le bloc édité, cachée sinon. */
document.addEventListener("selectionchange", () => {
  const sel = getSelection();
  const inside = host && sel.rangeCount && !sel.isCollapsed && host.contains(sel.anchorNode) && host.contains(sel.focusNode);
  inside ? showBar() : hideBar();
});
