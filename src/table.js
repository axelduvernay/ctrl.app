/* Le bloc tableau : découpages techniques, scripts, listes à colonnes.

   Une ligne d'en-tête (le nom des colonnes) et des lignes de cellules, le
   tout dans une grille. Les cellules s'éditent directement quand le bloc est
   sélectionné ; on circule au clavier comme dans un tableur :
   Tab / ⇧Tab cellule suivante / précédente, Entrée cellule du dessous
   (⇧Entrée pour un retour à la ligne), Échap pour sortir. Arriver au bout
   crée la ligne suivante. Un collage depuis un tableur (Numbers, Excel,
   Google Sheets) remplit plusieurs cellules d'un coup.

   Données : block.table = { cols: [{ id, name, w }], rows: [{ id, cells: { colId: texte } }] } */

import { state, begin, commit, mutate } from "./store.js";
import { render, nodeFor } from "./render.js";
import { el, icon, uid } from "./util.js";

export const TABLE_PRESETS = {
  table: {
    label: "Tableau",
    cols: [["Colonne 1", 160], ["Colonne 2", 160], ["Colonne 3", 160]],
    rows: 3,
  },
  decoupage: {
    label: "Découpage technique",
    cols: [["Séq.", 56], ["Plan", 56], ["Valeur", 96], ["Mouvement", 110], ["Action / description", 260], ["Son", 160], ["Durée", 70]],
    rows: 4,
  },
};

const PAD = 16;     // marge intérieure du bloc, de chaque côté
const MIN_COL = 48;

/** Transforme un bloc en tableau. Le texte déjà écrit devient son titre. */
export function toTable(block, preset = "table") {
  const p = TABLE_PRESETS[preset] || TABLE_PRESETS.table;
  const cols = p.cols.map(([name, w]) => ({ id: uid(), name, w }));
  block.kind = "table";
  block.table = {
    cols,
    rows: Array.from({ length: p.rows }, () => ({ id: uid(), cells: {} })),
  };
  fitWidth(block);
}

export function fitWidth(b) {
  b.w = b.table.cols.reduce((sum, c) => sum + c.w, 0) + PAD * 2;
}

/* ---------- Lignes et colonnes ---------- */

export function addRow(id, after = null) {
  const b = state.doc.blocks[id];
  const row = { id: uid(), cells: {} };
  mutate(() => {
    const i = after ? b.table.rows.findIndex((r) => r.id === after) : b.table.rows.length - 1;
    b.table.rows.splice(i + 1, 0, row);
    b.updatedAt = Date.now();
  });
  render();
  return row;
}

export function addCol(id, after = null) {
  const b = state.doc.blocks[id];
  const col = { id: uid(), name: "", w: 140 };
  mutate(() => {
    const i = after ? b.table.cols.findIndex((c) => c.id === after) : b.table.cols.length - 1;
    b.table.cols.splice(i + 1, 0, col);
    fitWidth(b);
    b.updatedAt = Date.now();
  });
  render();
  return col;
}

export function removeRow(id, rowId) {
  const b = state.doc.blocks[id];
  if (b.table.rows.length <= 1) return;
  mutate(() => { b.table.rows = b.table.rows.filter((r) => r.id !== rowId); b.updatedAt = Date.now(); });
  render();
}

export function removeCol(id, colId) {
  const b = state.doc.blocks[id];
  if (b.table.cols.length <= 1) return;
  mutate(() => {
    b.table.cols = b.table.cols.filter((c) => c.id !== colId);
    for (const r of b.table.rows) delete r.cells[colId];
    fitWidth(b);
    b.updatedAt = Date.now();
  });
  render();
}

/** Redimensionne une colonne (glisser sur son bord droit, dans l'en-tête). */
export function resizeCol(id, colId, w) {
  const b = state.doc.blocks[id];
  const col = b.table.cols.find((c) => c.id === colId);
  if (!col) return;
  col.w = Math.max(MIN_COL, Math.round(w));
  fitWidth(b);
  render();
}

/** Le texte de toutes les cellules, pour la recherche. */
export const tableText = (b) =>
  [...b.table.cols.map((c) => c.name), ...b.table.rows.flatMap((r) => Object.values(r.cells))].join(" ");

/* ---------- Rendu ---------- */

export function renderTable(node, body, b) {
  const selected = state.selection.has(b.id) && state.selection.size === 1;
  // Une cellule en cours de saisie : on ne reconstruit rien sous les doigts.
  if (body.contains(document.activeElement) && document.activeElement !== body) return;
  const sig = JSON.stringify([b.text, b.table, selected]);
  if (node._sig === sig) return;
  node._sig = sig;

  const { cols, rows } = b.table;
  const grid = el("div", { class: "tbl", style: `grid-template-columns:${cols.map((c) => c.w + "px").join(" ")}` });

  cols.forEach((c, ci) => {
    grid.append(el("div", {
      class: "cell head" + (c.name ? "" : " is-empty"), "data-cell": true, "data-row": "head", "data-col": c.id,
      contenteditable: selected && !state.readOnly ? "true" : false, spellcheck: "false",
      "data-placeholder": `Colonne ${ci + 1}`, text: c.name,
    }, el("span", { class: "col-resize", "data-col-resize": c.id, contenteditable: "false" })));
  });
  for (const r of rows) {
    for (const c of cols) {
      grid.append(el("div", {
        class: "cell", "data-cell": true, "data-row": r.id, "data-col": c.id,
        contenteditable: selected && !state.readOnly ? "true" : false, spellcheck: "false",
        text: r.cells[c.id] || "",
      }));
    }
  }

  body.className = "body table-body";
  body.replaceChildren(...[
    b.text ? el("div", { class: "tbl-title", text: b.text }) : null,
    grid,
    selected && !state.readOnly ? el("div", { class: "tbl-tools" },
      el("button", { type: "button", "data-action": true, onclick: () => focusCell(b.id, addRow(b.id).id, cols[0].id) },
        icon('<path d="M12 5v14M5 12h14"/>', 13), el("span", { text: "Ligne" })),
      el("button", { type: "button", "data-action": true, onclick: () => focusCell(b.id, "head", addCol(b.id).id) },
        icon('<path d="M12 5v14M5 12h14"/>', 13), el("span", { text: "Colonne" }))) : null,
  ].filter(Boolean));
  for (const cell of grid.children) wireCell(cell, b.id);
}

/* ---------- Saisie ---------- */

function wireCell(cell, id) {
  cell.addEventListener("focus", () => begin());
  cell.addEventListener("blur", () => {
    commit();
    // La sortie d'une cellule laisse le rendu se remettre à jour.
    setTimeout(() => { if (!nodeFor(id)?.contains(document.activeElement)) render(); }, 0);
  });
  cell.addEventListener("input", () => {
    write(id, cell);
    cell.classList.toggle("is-empty", !cell.innerText.trim());
    render(); // hauteur du bloc, liens
  });
  cell.addEventListener("keydown", (e) => onKey(e, id, cell));
  cell.addEventListener("paste", (e) => onPaste(e, id, cell));
}

function write(id, cell) {
  const b = state.doc.blocks[id];
  if (!b) return;
  const text = cell.innerText.replace(/\n$/, "");
  const { row, col } = cell.dataset;
  if (row === "head") {
    const c = b.table.cols.find((x) => x.id === col);
    if (c) c.name = text;
  } else {
    const r = b.table.rows.find((x) => x.id === row);
    if (r) text ? (r.cells[col] = text) : delete r.cells[col];
  }
  b.updatedAt = Date.now();
}

function onKey(e, id, cell) {
  e.stopPropagation();
  const b = state.doc.blocks[id];
  const { cols, rows } = b.table;
  const ci = cols.findIndex((c) => c.id === cell.dataset.col);
  const ri = cell.dataset.row === "head" ? -1 : rows.findIndex((r) => r.id === cell.dataset.row);
  const rowAt = (i) => (i < 0 ? "head" : rows[i]?.id);

  if (e.key === "Escape") { e.preventDefault(); cell.blur(); return; }

  if (e.key === "Tab") {
    e.preventDefault();
    let c = ci + (e.shiftKey ? -1 : 1);
    let r = ri;
    if (c >= cols.length) { c = 0; r++; }
    if (c < 0) { c = cols.length - 1; r--; }
    if (r < -1) return;
    cell.blur();
    if (r >= rows.length) return focusCell(id, addRow(id).id, cols[0].id);
    return focusCell(id, rowAt(r), cols[c].id);
  }

  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    cell.blur();
    if (ri + 1 >= rows.length) return focusCell(id, addRow(id).id, cols[ci].id);
    return focusCell(id, rowAt(ri + 1), cols[ci].id);
  }
}

/* Un collage venu d'un tableur arrive en lignes séparées par des retours et
   en colonnes séparées par des tabulations : il remplit le tableau à partir
   de la cellule visée, en ajoutant lignes et colonnes au besoin. */
function onPaste(e, id, cell) {
  const text = e.clipboardData?.getData("text/plain");
  if (text == null) return;
  e.preventDefault();
  if (!/[\t\n]/.test(text.replace(/\n$/, ""))) {
    document.execCommand("insertText", false, text);
    return;
  }
  const grid = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t"));
  const b = state.doc.blocks[id];
  cell.blur();
  mutate(() => {
    const t = b.table;
    const c0 = t.cols.findIndex((c) => c.id === cell.dataset.col);
    let r0 = cell.dataset.row === "head" ? -1 : t.rows.findIndex((r) => r.id === cell.dataset.row);
    while (t.cols.length < c0 + Math.max(...grid.map((l) => l.length))) t.cols.push({ id: uid(), name: "", w: 140 });
    grid.forEach((line, i) => {
      const ri = r0 + i;
      if (ri >= 0) while (t.rows.length <= ri) t.rows.push({ id: uid(), cells: {} });
      line.forEach((value, j) => {
        const col = t.cols[c0 + j];
        if (ri < 0) col.name = value;
        else if (value) t.rows[ri].cells[col.id] = value;
      });
    });
    fitWidth(b);
    b.updatedAt = Date.now();
  });
  render();
}

/** Met le curseur dans une cellule — tout de suite, pour qu'aucune frappe
    ne se perde entre deux cellules. */
export function focusCell(id, rowId, colId) {
  render();
  const cell = nodeFor(id)?.querySelector(`[data-row="${rowId}"][data-col="${colId}"]`);
  if (!cell) return;
  cell.focus();
  const range = document.createRange();
  range.selectNodeContents(cell);
  range.collapse(false);
  getSelection().removeAllRanges();
  getSelection().addRange(range);
}
