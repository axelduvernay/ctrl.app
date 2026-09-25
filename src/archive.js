/* La zone « Fait ».

   Une tâche cochée ne disparaît pas et ne reste pas en travers du chemin : elle
   glisse vers une zone d'archive, où elle reste consultable. Le canvas retrouve
   sa place utile sans que rien ne soit perdu.

   L'appartenance à l'archive est portée par `block.archived`, pas déduite de la
   géométrie : déplacer la zone à la main ne doit pas désarchiver son contenu. */

import { state, mutate, addZone } from "./store.js";
import { render, nodeFor } from "./render.js";
import { bounds } from "./util.js";

const PAD = 26;
const GAP = 14;
const LABEL = 40;
const DELAY = 550;

export const archivedBlocks = () =>
  Object.values(state.doc.blocks).filter((b) => b.archived);

function findZone() {
  return Object.values(state.doc.zones).find((z) => z.archive) || null;
}

/** La zone d'archive, créée sous le contenu existant si elle n'existe pas. */
function ensureZone() {
  let zone = findZone();
  if (zone) return zone;

  const others = [
    ...Object.values(state.doc.blocks).filter((b) => !b.archived),
    ...Object.values(state.doc.zones),
  ];
  const b = bounds(others);
  return addZone({
    x: b ? b.x : -200,
    y: b ? b.y + b.h + 120 : 200,
    w: 360, h: 180,
    name: "Fait",
    archive: true,
  });
}

/* Les tâches cochées attendent un court instant avant de partir : voir la case
   se cocher fait partie de la satisfaction, et l'animation serait volée si le
   bloc filait immédiatement. */
const pending = new Map();

export function scheduleArchive(id) {
  clearTimeout(pending.get(id));
  pending.set(
    id,
    setTimeout(() => {
      pending.delete(id);
      const block = state.doc.blocks[id];
      if (!block || !block.done || block.archived) return;
      archive(id);
    }, DELAY)
  );
}

export function cancelArchive(id) {
  clearTimeout(pending.get(id));
  pending.delete(id);
}

export function archive(id) {
  const block = state.doc.blocks[id];
  if (!block || block.archived) return;
  markAnimating();
  mutate(() => {
    ensureZone();
    block.archived = true;
    layout();
  });
  render();
  clearAnimating();
}

/** Ressort un bloc de l'archive et le pose juste au-dessus de la zone. */
export function unarchive(id) {
  const block = state.doc.blocks[id];
  if (!block || !block.archived) return;
  const zone = findZone();
  markAnimating();
  mutate(() => {
    block.archived = false;
    if (zone) {
      block.x = zone.x;
      block.y = zone.y - block.h - 40;
    }
    layout();
  });
  render();
  clearAnimating();
}

/** Range les blocs archivés en colonne et ajuste la zone à son contenu. */
function layout() {
  const zone = findZone();
  if (!zone) return;

  const blocks = archivedBlocks().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  if (!blocks.length) {
    // Une archive vide n'a pas lieu d'occuper le canvas.
    delete state.doc.zones[zone.id];
    state.selection.delete(zone.id);
    return;
  }

  const width = Math.max(240, ...blocks.map((b) => b.w));
  let y = zone.y + LABEL;
  for (const block of blocks) {
    block.x = zone.x + PAD;
    block.y = y;
    y += block.h + GAP;
  }

  zone.w = width + PAD * 2;
  zone.h = y - zone.y - GAP + PAD;
}

/* L'animation passe par une classe CSS le temps du déplacement, puis on la
   retire : la laisser ralentirait chaque glisser à la souris. */
function markAnimating() {
  for (const block of Object.values(state.doc.blocks)) {
    nodeFor(block.id)?.classList.add("is-animating");
  }
}

function clearAnimating() {
  setTimeout(() => {
    for (const block of Object.values(state.doc.blocks)) {
      nodeFor(block.id)?.classList.remove("is-animating");
    }
  }, 420);
}
