/* Rendu DOM du canvas.

   Chaque bloc est un élément positionné en coordonnées monde ; la caméra n'agit
   que sur le conteneur. Le rendu est différentiel : on réutilise les éléments
   existants plutôt que de reconstruire, pour ne pas casser une édition en cours
   ni la sélection du texte. */

import { state, getCategory, fieldsOf, depthOf } from "./store.js";
import { el, icon, formatDate, isSoon, fold, ICON_PATHS } from "./util.js";
import { assetURL as getAsset } from "./store.js";
import { renderList } from "./lists.js";

const nodes = new Map();
const urls = new Map();
let blocksRoot, zonesRoot, linksRoot;

export function initRender() {
  blocksRoot = document.getElementById("blocks");
  zonesRoot = document.getElementById("zones");
  linksRoot = document.getElementById("links");
}

export function nodeFor(id) {
  return nodes.get(id) || null;
}

export function render() {
  const seen = new Set();

  for (const zone of Object.values(state.doc.zones)) {
    seen.add(zone.id);
    let node = nodes.get(zone.id);
    if (!node) {
      node = buildZone(zone);
      nodes.set(zone.id, node);
      zonesRoot.append(node);
    }
    updateZone(node, zone);
  }

  for (const id of state.doc.order) {
    const block = state.doc.blocks[id];
    if (!block) continue;
    seen.add(id);
    let node = nodes.get(id);
    if (!node) {
      node = buildBlock(block);
      nodes.set(id, node);
      blocksRoot.append(node);
    }
    updateBlock(node, block);
  }

  // Respecte l'ordre de superposition sans tout réinsérer.
  let prev = null;
  for (const id of state.doc.order) {
    const node = nodes.get(id);
    if (!node) continue;
    if (prev ? prev.nextElementSibling !== node : blocksRoot.firstElementChild !== node) {
      prev ? prev.after(node) : blocksRoot.prepend(node);
    }
    prev = node;
  }

  for (const [id, node] of nodes) {
    if (!seen.has(id)) {
      node.remove();
      nodes.delete(id);
      const url = urls.get(id);
      if (url) { URL.revokeObjectURL(url); urls.delete(id); }
    }
  }

  renderLinks();
}

/* ---------- Blocs ---------- */

function buildBlock(block) {
  const node = el("div", { class: "block", "data-id": block.id });
  node.append(el("div", { class: "body", "data-placeholder": "Écris…" }));
  node.append(el("div", { class: "meta" }));
  node.append(resizeHandle());
  // Poignée de connexion : on la tire jusqu'à un autre bloc pour les relier.
  node.append(el("div", { class: "connect", "data-connect": true, title: "Tirer pour relier" }));
  return node;
}

function updateBlock(node, b) {
  node.style.left = b.x + "px";
  node.style.top = b.y + "px";
  node.style.width = b.w + "px";
  const grows = b.kind === "text" || b.kind === "list";
  node.style.height = grows ? "auto" : b.h + "px";
  node.style.minHeight = b.kind === "text" ? b.h + "px" : "";

  // Les classes d'effet sont posées de l'extérieur (rangement, aimant) : on
  // les garde, sinon le rendu qui suit les effacerait avant la transition.
  const kept = ["is-animating", "is-magnet", "is-settled", "is-resizing"].filter((c) => node.classList.contains(c));
  node.className = "block kind-" + b.kind;
  node.classList.add(...kept);
  if (state.selection.has(b.id)) node.classList.add("is-selected");
  if (b.done) node.classList.add("is-done");
  if (state.editing === b.id) node.classList.add("is-editing");
  if (isDimmed(b)) node.classList.add("is-dimmed");
  if (state.search.hits[state.search.index] === b.id) node.classList.add("is-hit");

  const cat = getCategory(b.category);
  if (cat) {
    node.dataset.category = b.category;
    node.style.setProperty("--cat", cat.color);
  } else {
    delete node.dataset.category;
    node.style.removeProperty("--cat");
  }

  const body = node.querySelector(".body");
  renderBody(node, body, b);
  renderMeta(node, b);
  // Une liste prend la hauteur de son contenu ; on la reporte dans le
  // document pour que liens et rangement voient la vraie taille.
  if (b.kind === "list") b.h = node.offsetHeight || b.h;
}

function renderBody(node, body, b) {
  if (b.kind === "text") {
    if (body.textContent !== b.text && state.editing !== b.id) body.textContent = b.text;
    const cat = getCategory(b.category);
    body.dataset.placeholder = cat && cat.checkable ? "Quoi faire ?" : "Écris, ou tape /";
    return;
  }

  if (b.kind === "list") return renderList(node, body, b);

  if (b.kind === "image") {
    let img = node.querySelector("img");
    if (!img) {
      img = el("img", { alt: b.name || "Image", draggable: "false" });
      body.replaceWith(img);
      node.prepend(img);
    }
    const url = resolveAsset(b);
    if (url && img.src !== url) img.src = url;
    return;
  }

  if (b.kind === "draw") {
    // Le chemin est exprimé dans le repère d'origine du tracé ; le viewBox le
    // met à l'échelle du bloc, donc un redimensionnement reste net.
    let svg = node.querySelector("svg");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.append(document.createElementNS("http://www.w3.org/2000/svg", "path"));
      body.replaceWith(svg);
      node.prepend(svg);
    }
    svg.setAttribute("viewBox", `0 0 ${b.viewW || b.w} ${b.viewH || b.h}`);
    svg.setAttribute("preserveAspectRatio", "none");
    const path = svg.querySelector("path");
    if (path.getAttribute("d") !== b.path) path.setAttribute("d", b.path);
    path.setAttribute("stroke-width", b.stroke || 3);
    return;
  }

  if (b.kind === "file") {
    body.className = "body";
    body.replaceChildren(
      el("div", { class: "file" },
        el("div", { class: "icon" }, icon('<path d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>', 17)),
        el("div", { style: "min-width:0" },
          el("div", { class: "name", text: b.name || "Fichier" }),
          el("div", { class: "sub", text: b.sub || "" })
        )
      )
    );
    const url = resolveAsset(b);
    if (url) {
      const a = el("a", { href: url, download: b.name || "fichier", class: "file-dl" });
      // Le clic d'ouverture est géré dans interact.js pour ne pas gêner le glisser.
      node.dataset.download = url;
    }
    return;
  }

  if (b.kind === "link") {
    let host = "";
    try { host = new URL(b.url).hostname.replace(/^www\./, ""); } catch {}
    body.className = "body";
    body.replaceChildren(
      el("div", { class: "link" },
        el("div", { class: "favicon" },
          host
            ? el("img", { src: `https://www.google.com/s2/favicons?domain=${host}&sz=64`, alt: "", loading: "lazy" })
            : icon('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>', 17)
        ),
        el("div", { style: "min-width:0" },
          el("div", { class: "name", text: b.name || host || b.url }),
          el("div", { class: "sub", text: host })
        )
      )
    );
    return;
  }
}

function renderMeta(node, b) {
  const meta = node.querySelector(".meta");
  if (!meta) return;
  const cat = getCategory(b.category);
  const parts = [];

  if (b.variant) parts.push(el("span", { class: "version", text: "v" + b.variant }));
  if (cat) parts.push(el("span", { class: "tag", text: cat.label.toLowerCase() }));

  // Les champs n'apparaissent que si la catégorie les prévoit.
  const fields = fieldsOf(b);
  if (fields.due && b.due) {
    parts.push(propChip("due", formatDate(b.due), isSoon(b.due) && !b.done ? "is-soon" : ""));
  }
  if (fields.remind && b.remind) {
    parts.push(propChip("remind", formatDate(b.remind), b.reminded && !b.done ? "is-ringing" : ""));
  }

  // Bloc seul sélectionné : on propose discrètement les champs encore vides.
  const focused = state.selection.size === 1 && state.selection.has(b.id) && state.editing !== b.id;
  if (focused && !b.done) {
    if (fields.due && !b.due) parts.push(propChip("due", "échéance", "is-ghost"));
    if (fields.remind && !b.remind) parts.push(propChip("remind", "rappel", "is-ghost"));
  }

  meta.replaceChildren(...parts);

  // La case à cocher n'apparaît que sur les catégories qui la demandent.
  let check = node.querySelector(".check");
  node.classList.toggle("has-check", !!(cat && cat.checkable));
  if (cat && cat.checkable) {
    if (!check) {
      check = el("button", { class: "check", "data-check": true, "aria-label": "Terminer" },
        icon('<path d="M4 12l5 5L20 6"/>', 13));
      node.append(check);
    }
    check.setAttribute("aria-pressed", String(!!b.done));
  } else if (check) {
    check.remove();
  }
}

function propChip(field, text, modifier = "") {
  return el("button", { type: "button", class: `prop ${modifier}`.trim(), "data-prop": field },
    icon(ICON_PATHS[field], 12),
    el("span", { text })
  );
}

function resolveAsset(b) {
  if (!b.asset) return b.src || null;
  if (urls.has(b.id)) return urls.get(b.id);
  const url = getAsset(b.asset);
  if (url) urls.set(b.id, url);
  return url;
}

/** Le coin qu'on tire : un arc au repos, deux traits quand on l'approche. */
function resizeHandle() {
  return el("div", { class: "resize", "data-resize": true },
    el("span", { class: "rz-arc" }),
    el("span", { class: "rz-v" }),
    el("span", { class: "rz-h" }));
}

/* ---------- Zones ---------- */

function buildZone(zone) {
  const node = el("div", { class: "zone", "data-id": zone.id, "data-zone": true });
  node.append(el("div", { class: "zone-name", "data-zone-name": true }));
  node.append(resizeHandle());
  return node;
}

function updateZone(node, z) {
  node.style.left = z.x + "px";
  node.style.top = z.y + "px";
  node.style.width = z.w + "px";
  node.style.height = z.h + "px";
  // Une sous-zone passe devant sa zone parente, sinon on ne pourrait pas la viser.
  node.style.zIndex = depthOf(z);
  node.classList.toggle("is-selected", state.selection.has(z.id));
  node.classList.toggle("is-archive", !!z.archive);
  node.classList.toggle("is-dimmed", state.filters.categories.size > 0 || !!state.search.query);
  const name = node.querySelector(".zone-name");
  if (name.textContent !== z.name && state.editing !== z.id) name.textContent = z.name;
}

/* ---------- Liens ---------- */

function renderLinks() {
  const links = Object.values(state.doc.links);
  linksRoot.replaceChildren();
  for (const link of links) {
    const a = state.doc.blocks[link.from];
    const b = state.doc.blocks[link.to];
    if (!a || !b) continue;
    const d = curve(a, b);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    if (state.selection.has(a.id) || state.selection.has(b.id)) path.classList.add("is-highlighted");
    if (state.selection.has(link.id)) path.classList.add("is-selected");
    if (link.kind === "variant") path.classList.add("is-variant");
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hit.setAttribute("d", d);
    hit.setAttribute("class", "hit");
    hit.dataset.link = link.id;
    linksRoot.append(path, hit);
  }
}

/** Courbe d'un bloc vers un point libre — l'aperçu pendant qu'on tire un lien. */
export function curveTo(a, p) {
  return curve(a, { x: p.x, y: p.y, w: 0, h: 0 });
}

/* Courbe entre deux blocs : on part du bord le plus proche plutôt que du centre,
   pour que le trait ne traverse jamais les blocs qu'il relie. */
function curve(a, b) {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const p1 = edgePoint(a, ac, bc);
  const p2 = edgePoint(b, bc, ac);
  const dx = Math.abs(p2.x - p1.x) * 0.4;
  return `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
}

function edgePoint(rect, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (!dx && !dy) return from;
  const hw = rect.w / 2;
  const hh = rect.h / 2;
  const scale = Math.min(Math.abs(hw / (dx || 1e-6)), Math.abs(hh / (dy || 1e-6)));
  return { x: from.x + dx * scale, y: from.y + dy * scale };
}

/* ---------- Filtres ---------- */

function isDimmed(b) {
  const { categories, done } = state.filters;
  if (categories.size && !categories.has(b.category)) return true;
  if (done === false && b.done) return true;
  if (done === true && !b.done) return true;
  if (state.search.query) {
    const q = fold(state.search.query);
    const items = (b.items || []).map((it) => it.name);
    const hay = fold([b.text, b.name, b.url, b.category, ...items].filter(Boolean).join(" "));
    if (!hay.includes(q)) return true;
  }
  return false;
}

export { isDimmed };
