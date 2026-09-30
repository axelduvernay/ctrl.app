/* Aligner.

   Un seul rangement, et qui respecte le board : rien n'est ramené au centre
   ni tassé dans un coin. Chaque groupe reste dans sa région, mais s'y met
   en ordre : colonnes nettes, écarts réguliers, rien qui se chevauche.

   Les zones sont rangées de l'intérieur d'abord, sous-zones comprises, puis
   s'alignent parmi le reste d'un seul tenant. Tout est calculé sur
   l'appareil et reste annulable par ⌘Z. */

import { state, mutate, isContainer, zoneOf, childrenOf, childZones, descendants } from "./store.js";
import { render, nodeFor } from "./render.js";
import { toast } from "./main.js";
import { play } from "./sounds.js";

const GAP = 28;        // écart minimal entre deux éléments
const PAD = 24;        // marge intérieure d'une zone
const LABEL = 56;      // place réservée au titre d'une zone
const MIN_W = 260;
const MIN_H = 160;

/* Les tracés gardent leur place (leur position par rapport au reste EST le
   propos) et les tâches archivées vivent dans « Fait ». */
const movable = (b) => !b.archived && b.kind !== "draw";

/** Aligne tout le board, ou seulement l'intérieur d'une zone. */
export function align(zoneId = null) {
  play("align");
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

/* Aligne des éléments de même niveau, sur place, en quatre temps :
   1. on reconnaît les colonnes — des éléments à peu près les uns sous les
      autres ;
   2. chaque colonne prend un même bord gauche, et ses blocs de texte une
      même largeur ;
   3. les colonnes voisines s'alignent par le haut et se rapprochent à un
      écart régulier, et dans chaque colonne les éléments se resserrent ;
   4. les chevauchements qui resteraient sont défaits.
   Un grand écart, lui, est gardé : il sépare volontairement deux groupes. */
function tidyLevel(items) {
  if (!items.length) return;
  const columns = findColumns(items);

  for (const col of columns) {
    const left = Math.min(...col.map((i) => i.x));
    for (const i of col) shift(i, left - i.x, 0);
    // Des blocs de texte de même largeur font une colonne nette.
    const texts = col.filter((i) => state.doc.blocks[i.id] && ["text", "list"].includes(i.kind));
    if (texts.length > 1) {
      const w = Math.max(...texts.map((i) => i.w));
      for (const i of texts) i.w = w;
    }
  }

  // Colonnes de gauche à droite : têtes alignées, écart régulier entre voisines.
  const spans = columns.map((col) => ({ col, ...span(col) })).sort((a, b) => a.left - b.left);
  for (let k = 1; k < spans.length; k++) {
    const prev = spans[k - 1];
    const cur = spans[k];
    const sideBySide = cur.top < prev.bottom && cur.bottom > prev.top;
    if (!sideBySide) continue;
    const dy = Math.abs(cur.top - prev.top) <= ROW_TOLERANCE ? prev.top - cur.top : 0;
    const gap = cur.left - prev.right;
    const dx = gap < BREAK_X ? prev.right + COL_GAP - cur.left : 0;
    if (dx || dy) {
      for (const i of cur.col) shift(i, dx, dy);
      Object.assign(cur, span(cur.col));
    }
  }

  // Dans chaque colonne, les éléments se resserrent à l'écart standard.
  for (const col of columns) {
    const sorted = [...col].sort((a, b) => a.y - b.y);
    for (let k = 1; k < sorted.length; k++) {
      const above = sorted[k - 1];
      const gap = sorted[k].y - (above.y + above.h);
      if (gap < BREAK_Y) shift(sorted[k], 0, above.y + above.h + GAP - sorted[k].y);
    }
  }

  separate(items);
}

const COL_TOLERANCE = 120; // bords gauches à moins de 120 px : même colonne
const ROW_TOLERANCE = 90;  // têtes de colonnes à moins de 90 px : même rangée
const COL_GAP = 40;        // écart entre deux colonnes voisines
const BREAK_X = 180;       // au-delà, deux colonnes restent à distance
const BREAK_Y = 140;       // au-delà, un trou dans une colonne est gardé

/** Regroupe en colonnes : bords gauches proches, ou largeurs qui se recouvrent bien. */
function findColumns(items) {
  const columns = [];
  for (const it of [...items].sort((a, b) => a.x - b.x)) {
    const col = columns.find((c) => {
      const { left, right } = span(c);
      const shared = Math.min(right, it.x + it.w) - Math.max(left, it.x);
      return it.x - left <= COL_TOLERANCE || shared >= Math.min(it.w, right - left) * 0.6;
    });
    col ? col.push(it) : columns.push([it]);
  }
  return columns;
}

function span(col) {
  return {
    left: Math.min(...col.map((i) => i.x)),
    right: Math.max(...col.map((i) => i.x + i.w)),
    top: Math.min(...col.map((i) => i.y)),
    bottom: Math.max(...col.map((i) => i.y + i.h)),
  };
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
      const sameRow = Math.abs(it.y - hit.y) < ROW_TOLERANCE && it.x >= hit.x;
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
