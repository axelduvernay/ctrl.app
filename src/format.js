/* Mise en forme du texte d'un bloc : styles de paragraphe (titre,
   sous-titre, texte), gras, italique, souligné, barré, surlignage, liste.
   Un titre replie le texte qui le suit, comme dans Notes.

   Discrète par principe : aucune barre permanente. Une petite pilule flotte
   au-dessus du texte sélectionné, seulement pendant l'édition ; ⌘B, ⌘I et ⌘U
   marchent sans elle.

   Un bloc sans mise en forme reste du texte brut (`block.text`). Dès qu'il en
   a, il garde aussi un HTML (`block.html`) réduit à une poignée de balises
   sûres, sans aucun attribut : ce qui entre dans le document est toujours
   passé au crible, qu'il vienne d'une édition, d'un collage ou d'un import. */

import { el, icon } from "./util.js";

const KEEP = new Set(["B", "I", "U", "S", "MARK", "H1", "H2", "H3", "UL", "OL", "LI", "BR", "DIV", "P"]);
const HEADINGS = new Set(["H1", "H2", "H3"]);
const RENAME = { STRONG: "B", EM: "I", STRIKE: "S", DEL: "S" };
const FORMATTING = /<(b|i|u|s|mark|h1|h2|h3|ul|ol|li)\b/i;

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
    // Seul attribut gardé : l'état replié d'un titre.
    if (out && HEADINGS.has(tag) && node.hasAttribute("data-folded")) out.setAttribute("data-folded", "");
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
    applyFolds(element);
  } else if (element._html || element.textContent !== b.text) {
    element.textContent = b.text;
    element._html = null;
  }
}

/* ---------- Titres repliables ----------

   Un titre replié masque ce qui le suit, jusqu'au prochain titre de même
   niveau ou plus important. L'état est porté par le titre lui-même
   (`data-folded`), donc il se sauvegarde avec le texte. */

const level = (node) => (node.nodeType === 1 && HEADINGS.has(node.tagName) ? Number(node.tagName[1]) : 0);

export function applyFolds(element) {
  let folding = 0;
  for (const child of element.children) {
    const lvl = level(child);
    if (folding && (!lvl || lvl > folding)) { child.classList.add("is-folded-away"); continue; }
    child.classList.remove("is-folded-away");
    folding = lvl && child.hasAttribute("data-folded") ? lvl : 0;
    // Un titre sans rien dessous n'a pas de flèche.
    if (lvl) child.classList.toggle("has-body", !!nextBody(child));
  }
}

function nextBody(heading) {
  const lvl = level(heading);
  const next = heading.nextElementSibling;
  return next && (!level(next) || level(next) > lvl) ? next : null;
}

/** Replie ou déplie un titre ; renvoie le HTML à enregistrer. */
export function toggleFold(heading, element) {
  heading.toggleAttribute("data-folded");
  applyFolds(element);
  return sanitize(element.innerHTML);
}

/* ---------- La barre flottante ---------- */

/* Styles de paragraphe, en tête de la barre, écrits dans leur propre style. */
const STYLES = [
  { cmd: "h1", label: "Titre", key: "⇧⌘T" },
  { cmd: "h2", label: "Sous-titre", key: "⇧⌘H" },
  { cmd: "div", label: "Texte", key: "⇧⌘B" },
];

const ACTIONS = [
  { cmd: "bold", label: "Gras", key: "⌘B", glyph: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>' },
  { cmd: "italic", label: "Italique", key: "⌘I", glyph: '<path d="M10 5h8M6 19h8M14 5l-4 14"/>' },
  { cmd: "underline", label: "Souligné", key: "⌘U", glyph: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>' },
  { cmd: "strikeThrough", label: "Barré", glyph: '<path d="M5 12h14M16 7a4 3 0 0 0-8 0c0 3 8 2 8 6a4 3 0 0 1-8 0"/>' },
  { cmd: "hiliteColor", label: "Surligner", glyph: '<path d="M4 20h16M7 16l2-6 7-7 3 3-7 7z"/>' },
  { cmd: "insertUnorderedList", label: "Liste", glyph: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.5" cy="7" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17" r="1"/>' },
];

let bar = null;
let host = null; // l'élément en cours d'édition

/** À appeler quand un bloc passe en édition. */
export function attachFormatting(element) {
  host = element;
  element.addEventListener("paste", onPaste);
  element.addEventListener("keydown", onKey);
  element.addEventListener("input", onEdit);
}

export function detachFormatting(element) {
  element.removeEventListener("paste", onPaste);
  element.removeEventListener("keydown", onKey);
  element.removeEventListener("input", onEdit);
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

/* Raccourcis de Notes (⇧⌘T, ⇧⌘H, ⇧⌘B), et ceux du Markdown : « # » puis
   espace en début de ligne donne un titre, « ## » un sous-titre. */
function onKey(e) {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.shiftKey) {
    const style = { t: "h1", h: "h2", b: "div" }[e.key.toLowerCase()];
    if (style) { e.preventDefault(); e.stopPropagation(); return setStyle(style); }
  }
  if (e.key === " " && !mod) {
    const sel = getSelection();
    const node = sel.anchorNode;
    if (!sel.isCollapsed || !node || node.nodeType !== 3) return;
    const before = node.textContent.slice(0, sel.anchorOffset);
    const line = node.parentElement === host ? before.split("\n").pop() : before;
    const style = { "#": "h1", "##": "h2" }[line];
    if (!style || (node.previousSibling && node.parentElement !== host)) return;
    e.preventDefault();
    const range = document.createRange();
    range.setStart(node, sel.anchorOffset - line.length);
    range.setEnd(node, sel.anchorOffset);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("delete");
    setStyle(style);
  }
}

function onEdit() {
  if (host) applyFolds(host);
}

function setStyle(tag) {
  const current = (document.queryCommandValue("formatBlock") || "").toLowerCase();
  // Redemander le style déjà posé revient au texte normal.
  document.execCommand("formatBlock", false, current === tag ? "div" : tag);
  host?.dispatchEvent(new Event("input"));
  if (host) applyFolds(host);
  refresh();
}

function run(cmd) {
  if (STYLES.some((s) => s.cmd === cmd)) return setStyle(cmd);
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
  if (STYLES.some((s) => s.cmd === cmd)) {
    const current = (document.queryCommandValue("formatBlock") || "div").toLowerCase();
    return cmd === "div" ? !/^h[1-3]$/.test(current) : current === cmd;
  }
  try { return document.queryCommandState(cmd); } catch { return false; }
}

function showBar() {
  if (!bar) {
    bar = el("div", { class: "format-bar", role: "toolbar", "aria-label": "Mise en forme" },
      ...STYLES.map((s) => el("button", {
        type: "button",
        class: "style-btn style-" + s.cmd,
        "data-cmd": s.cmd,
        title: `${s.label} (${s.key})`,
        onmousedown: (e) => e.preventDefault(),
        onclick: () => run(s.cmd),
        text: s.label,
      })),
      el("span", { class: "sep" }),
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
