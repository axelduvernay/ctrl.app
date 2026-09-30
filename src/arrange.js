/* Aligner.

   Un seul rangement, et qui respecte le board : rien n'est ramené au centre
   ni tassé dans un coin. Chaque élément reste dans sa région ; ceux qui sont
   presque alignés le deviennent vraiment — même bord gauche pour une
   colonne, même haut pour une rangée — puis les chevauchements sont défaits
   en poussant vers la droite ou vers le bas.

   Les zones sont rangées de l'intérieur d'abord, sous-zones comprises, puis
   s'alignent parmi le reste d'un seul tenant. Tout est calculé sur
   l'appareil et reste annulable par ⌘Z. */

import { state, mutate, isContainer, zoneOf, childrenOf, childZones, descendants } from "./store.js";
import { render, nodeFor } from "./render.js";
import { toast } from "./main.js";

const GAP = 28;        // écart minimal entre deux éléments
const TOLERANCE = 48;  // en deçà, deux bords sont « presque alignés »
const PAD = 24;        // marge intérieure d'une zone
const LABEL = 56;      // place réservée au titre d'une zone
const MIN_W = 260;
const MIN_H = 160;

/* Les tracés gardent leur place (leur position par rapport au reste EST le
   propos) et les tâches archivées vivent dans « Fait ». */
const movable = (b) => !b.archived && b.kind !== "draw";

/** Aligne tout le board, ou seulement l'intérieur d'une zone. */
export function align(zoneId = null) {
  const zone = zoneId && state.doc.zones[zoneId];
  animateAll(() => {
    if (zone) return tidyZone(zone);
    const tops = Object.values(state.doc.zones).filter((z) => isContainer(z) && !z.parent);
    for (const z of tops) tidyZone(z);
    const free = Object.values(state.doc.blocks).filter((b) => movable(b) && !zoneOf(b));
    tidyLevel([...free, ...tops]);
  });
  toast((zone ? "Zone alignée" : "Aligné") + " · ⌘Z pour annuler");
}

/* L'intérieur d'une zone : ses sous-zones d'abord, puis ses éléments, puis
   la zone s'ajuste à son contenu. */
function tidyZone(z) {
  const subs = childZones(z.id);
  for (const s of subs) tidyZone(s);
  const items = [...childrenOf(z.id).filter(movable), ...subs];
  if (!items.length) return;
  tidyLevel(items);

  // Le contenu ne déborde ni sous le titre ni à gauche.
  const left = Math.min(...items.map((i) => i.x));
  const top = Math.min(...items.map((i) => i.y));
  const dx = Math.max(0, z.x + PAD - left);
  const dy = Math.max(0, z.y + LABEL - top);
  if (dx || dy) for (const i of items) shift(i, dx, dy);

  const right = Math.max(...items.map((i) => i.x + i.w));
  const bottom = Math.max(...items.map((i) => i.y + i.h));
  z.w = Math.max(MIN_W, Math.round(right + PAD - z.x));
  z.h = Math.max(MIN_H, Math.round(bottom + PAD - z.y));
}

/** Aligne des éléments de même niveau, sur place. */
function tidyLevel(items) {
  if (items.length < 2) return;
  snapClusters(items, "x");
  snapClusters(items, "y");
  separate(items);
}

/* Les bords presque alignés le deviennent : on regroupe les positions
   proches, et chaque groupe prend la plus petite — le bord le plus à gauche
   pour une colonne, le plus haut pour une rangée. */
function snapClusters(items, axis) {
  const sorted = [...items].sort((a, b) => a[axis] - b[axis]);
  let group = [];
  const flush = () => {
    const to = Math.min(...group.map((i) => i[axis]));
    for (const i of group) shift(i, axis === "x" ? to - i.x : 0, axis === "y" ? to - i.y : 0);
    group = [];
  };
  for (const i of sorted) {
    if (group.length && i[axis] - group[0][axis] > TOLERANCE) flush();
    group.push(i);
  }
  if (group.length) flush();
}

/* Défait les chevauchements, dans l'ordre de lecture. Un élément qui en
   touche un autre sur la même rangée est poussé à droite ; sinon, vers le bas. */
function separate(items) {
  const order = [...items].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const placed = [];
  for (const it of order) {
    for (let guard = 0; guard < 200; guard++) {
      const hit = placed.find((p) => overlaps(it, p));
      if (!hit) break;
      const sameRow = Math.abs(it.y - hit.y) < TOLERANCE && it.x >= hit.x;
      if (sameRow) shift(it, hit.x + hit.w + GAP - it.x, 0);
      else shift(it, 0, hit.y + hit.h + GAP - it.y);
    }
    placed.push(it);
  }
}

const overlaps = (a, b) =>
  a.x < b.x + b.w + GAP && a.x + a.w + GAP > b.x && a.y < b.y + b.h + GAP && a.y + a.h + GAP > b.y;

/** Déplace un élément ; une zone emporte tout ce qu'elle contient. */
function shift(it, dx, dy) {
  dx = Math.round(dx);
  dy = Math.round(dy);
  if (!dx && !dy) return;
  it.x += dx;
  it.y += dy;
  if (state.doc.zones[it.id]) {
    // Sous-zones et blocs, tracés compris, à toute profondeur.
    const d = descendants(it.id);
    for (const m of [...d.zones, ...d.blocks]) { m.x += dx; m.y += dy; }
  }
}

/* Tout glisse vers sa nouvelle place sur un ressort, puis la classe
   d'animation est retirée pour ne pas alourdir les glissers suivants. */
function animateAll(change) {
  const nodes = [...Object.keys(state.doc.blocks), ...Object.keys(state.doc.zones)]
    .map((id) => nodeFor(id)).filter(Boolean);
  nodes.forEach((n) => n.classList.add("is-animating"));
  mutate(change);
  render();
  setTimeout(() => nodes.forEach((n) => n.classList.remove("is-animating")), 520);
}
