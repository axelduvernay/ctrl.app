/* Le rangement en deux clics.

   Trois critères, tous calculés sur l'appareil : aucun appel réseau, donc
   instantané et gratuit. Le résultat est une simple modification de positions,
   donc entièrement annulable par ⌘Z — ce qui le rend sans risque à essayer. */

import { state, mutate, addZone, categoryList, getCategory } from "./store.js";
import { render, nodeFor } from "./render.js";
import { bounds } from "./util.js";
import { fitAll } from "./viewport.js";
import { toast } from "./main.js";

const GAP = 28;
const COL_GAP = 72;
const ROW_WIDTH = 1200;

export function arrange(mode) {
  /* Deux exceptions au rangement : les blocs archivés, qui ont déjà leur place,
     et les tracés, dont la position par rapport au reste EST le propos. */
  const blocks = Object.values(state.doc.blocks).filter((b) => !b.archived && b.kind !== "draw");
  if (!blocks.length) return toast("Rien à ranger");

  const origin = bounds(blocks);
  const targets =
    mode === "category" ? byCategory(blocks, origin)
    : mode === "date" ? byDate(blocks, origin)
    : tidy(blocks, origin);

  animate(targets, mode);
}

/* Par catégorie : une colonne par catégorie, chacune dans sa zone nommée. */
function byCategory(blocks, origin) {
  const order = [...categoryList().map((c) => c.id), null];
  const groups = new Map(order.map((k) => [k, []]));
  for (const b of blocks) {
    const key = groups.has(b.category) ? b.category : null;
    groups.get(key).push(b);
  }

  const targets = [];
  const zones = [];
  let x = origin.x;

  for (const key of order) {
    const group = groups.get(key);
    if (!group.length) continue;
    group.sort((a, b) => b.updatedAt - a.updatedAt);

    const width = Math.max(...group.map((b) => b.w));
    let y = origin.y;
    for (const b of group) {
      targets.push({ id: b.id, x, y });
      y += b.h + GAP;
    }
    zones.push({
      name: key ? plural(getCategory(key).label) : "Sans catégorie",
      x: x - 24, y: origin.y - 36,
      w: width + 48, h: y - origin.y - GAP + 60,
    });
    x += width + COL_GAP;
  }

  syncAutoZones(zones);
  return targets;
}

/* Par date : le plus récent devant, en lecture de gauche à droite. */
function byDate(blocks, origin) {
  const sorted = [...blocks].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return flow(sorted, origin);
}

/* Alignement simple : on garde l'ordre de lecture actuel, on tasse. */
function tidy(blocks, origin) {
  const sorted = [...blocks].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  return flow(sorted, origin);
}

/** Disposition en lignes, de largeur bornée. */
function flow(list, origin) {
  const targets = [];
  let x = origin.x;
  let y = origin.y;
  let rowHeight = 0;

  for (const b of list) {
    if (x > origin.x && x + b.w > origin.x + ROW_WIDTH) {
      x = origin.x;
      y += rowHeight + GAP;
      rowHeight = 0;
    }
    targets.push({ id: b.id, x, y });
    x += b.w + GAP;
    rowHeight = Math.max(rowHeight, b.h);
  }
  return targets;
}

/** Remplace les zones créées par un rangement précédent, laisse les autres. */
function syncAutoZones(specs) {
  for (const [id, zone] of Object.entries(state.doc.zones)) {
    if (zone.auto && !zone.archive) delete state.doc.zones[id];
  }
  for (const spec of specs) addZone({ ...spec, auto: true });
}

/** « Idée » → « Idées », sans doubler un s déjà présent. */
const plural = (label) => (/s$/i.test(label) ? label : label + "s");

function animate(targets, mode) {
  // Les transitions CSS font le déplacement ; on les retire ensuite pour ne pas
  // ralentir les glissers à la souris.
  const nodes = targets.map((t) => nodeFor(t.id)).filter(Boolean);
  nodes.forEach((n) => n.classList.add("is-animating"));

  mutate(() => {
    for (const t of targets) {
      const b = state.doc.blocks[t.id];
      if (b) { b.x = Math.round(t.x); b.y = Math.round(t.y); }
    }
  });
  render();

  setTimeout(() => {
    targets.forEach((t) => nodeFor(t.id)?.classList.remove("is-animating"));
  }, 420);

  const labels = { category: "Rangé par catégorie", date: "Rangé par date", tidy: "Aligné" };
  toast(labels[mode] + " · ⌘Z pour annuler");
  setTimeout(fitAll, 120);
}
