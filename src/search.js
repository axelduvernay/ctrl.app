/* Recherche et filtres.

   Principe commun aux deux : on grise ce qui ne correspond pas au lieu de le
   masquer. Le paysage reste reconnaissable, donc la mémoire spatiale continue
   de fonctionner pendant qu'on filtre. */

import { state, getCategory, on, emit } from "./store.js";
import { el, icon, fold } from "./util.js";
import { render } from "./render.js";
import { centerOn } from "./viewport.js";

let bar = null;
let input = null;
let countLabel = null;
let chips = null;

export function initSearch() {
  chips = el("div", { id: "filters" });
  document.getElementById("app").append(chips);
  on("change", renderChips);
  on("filters", renderChips);
  renderChips();
}

/* ---------- Barre de recherche ---------- */

export function openSearch() {
  if (bar) return input.select();

  input = el("input", {
    type: "search",
    placeholder: "Chercher dans le tableau…",
    "aria-label": "Chercher",
    oninput: () => runSearch(input.value),
    onkeydown: (e) => {
      if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
      if (e.key === "Enter") { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
    },
  });

  countLabel = el("span", { class: "count" });

  bar = el("div", { id: "search" },
    icon('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 17),
    input,
    countLabel,
    el("button", { type: "button", "aria-label": "Résultat précédent", onclick: () => step(-1) },
      icon('<path d="M18 15l-6-6-6 6"/>', 16)),
    el("button", { type: "button", "aria-label": "Résultat suivant", onclick: () => step(1) },
      icon('<path d="M6 9l6 6 6-6"/>', 16)),
    el("button", { type: "button", "aria-label": "Fermer", onclick: closeSearch },
      icon('<path d="M6 6l12 12M18 6L6 18"/>', 16))
  );

  document.getElementById("app").append(bar);
  input.focus();
}

export function closeSearch() {
  bar?.remove();
  bar = null;
  state.search = { query: "", hits: [], index: 0 };
  render();
}

export const isSearchOpen = () => !!bar;

function runSearch(query) {
  const q = fold(query.trim());
  state.search.query = query.trim();
  state.search.index = 0;
  state.search.hits = !q
    ? []
    : Object.values(state.doc.blocks)
        .filter((b) => fold([b.text, b.name, b.url, b.category, ...(b.items || []).map((it) => it.name)].filter(Boolean).join(" ")).includes(q))
        .sort((a, b) => (a.y - b.y) || (a.x - b.x))
        .map((b) => b.id);

  updateCount();
  render();
  if (state.search.hits.length) reveal();
}

function step(direction) {
  const { hits } = state.search;
  if (!hits.length) return;
  state.search.index = (state.search.index + direction + hits.length) % hits.length;
  updateCount();
  render();
  reveal();
}

function reveal() {
  const id = state.search.hits[state.search.index];
  const block = state.doc.blocks[id];
  if (block) centerOn(block);
}

function updateCount() {
  if (!countLabel) return;
  const { hits, index, query } = state.search;
  countLabel.textContent = !query ? "" : hits.length ? `${index + 1}/${hits.length}` : "aucun";
}

/* ---------- Filtres ---------- */

export function toggleFilter(category) {
  const set = state.filters.categories;
  set.has(category) ? set.delete(category) : set.add(category);
  emit("filters");
  render();
}

export function toggleDoneFilter(value) {
  state.filters.done = state.filters.done === value ? null : value;
  emit("filters");
  render();
}

export function clearFilters() {
  state.filters.categories.clear();
  state.filters.done = null;
  emit("filters");
  render();
}

function renderChips() {
  if (!chips) return;
  const items = [];

  for (const key of state.filters.categories) {
    const cat = getCategory(key);
    if (!cat) continue;
    items.push(
      el("span", { class: "chip" },
        el("span", { class: "dot", style: `--c:${cat.color}` }),
        el("span", { text: cat.label }),
        el("button", { type: "button", "aria-label": `Retirer le filtre ${cat.label}`, text: "×", onclick: () => toggleFilter(key) })
      )
    );
  }

  if (state.filters.done !== null) {
    items.push(
      el("span", { class: "chip" },
        el("span", { text: state.filters.done ? "Terminé" : "À faire" }),
        el("button", { type: "button", "aria-label": "Retirer le filtre", text: "×", onclick: () => toggleDoneFilter(state.filters.done) })
      )
    );
  }

  chips.replaceChildren(...items);
}
