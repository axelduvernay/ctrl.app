/* Le rangement en deux clics.

   Trois critères, tous calculés sur l'appareil : aucun appel réseau, donc
   instantané et gratuit. Le résultat est une simple modification de positions,
   donc entièrement annulable par ⌘Z — ce qui le rend sans risque à essayer.

   Les zones conteneurs sont respectées : chacune range ses propres blocs à
   l'intérieur d'elle-même, puis se déplace d'un seul tenant parmi le reste.
   Un rangement ne fait jamais sortir un bloc de sa zone — les notes, tâches
   et rappels d'un projet restent ensemble. */

import { state, mutate, addZone, categoryList, getCategory, isContainer, zoneOf, childrenOf } from "./store.js";
import { render, nodeFor } from "./render.js";
import { bounds } from "./util.js";
import { fitAll } from "./viewport.js";
import { toast } from "./main.js";

const GAP = 28;
const COL_GAP = 72;
const ROW_WIDTH = 1200;
const PAD = 24;    // marge intérieure d'une zone
const LABEL = 48;  // place réservée au nom de la zone

/* Deux exceptions au rangement : les blocs archivés, qui ont déjà leur place,
   et les tracés, dont la position par rapport au reste EST le propos. */
const movable = (b) => !b.archived && b.kind !== "draw";

export function arrange(mode) {
  const zones = Object.values(state.doc.zones).filter(isContainer);
  const free = Object.values(state.doc.blocks).filter((b) => movable(b) && !zoneOf(b));
  if (!free.length && !zones.length) return toast("Rien à ranger");

  const blockTargets = new Map(); // id → { x, y }
  const zoneTargets = new Map();  // id → { x, y, w, h }

  // 1. L'intérieur de chaque zone, en coordonnées relatives à la zone.
  const inner = new Map();
  for (const z of zones) {
    const kids = childrenOf(z.id).filter(movable);
    if (!kids.length) { inner.set(z.id, null); continue; }
    const width = Math.max(z.w - PAD * 2, 480);
    const layout = mode === "category" ? columns(kids, { x: 0, y: 0 }).targets
      : flow(sortFor(mode, kids), { x: 0, y: 0 }, width);
    inner.set(z.id, layout);
  }

  // Taille de chaque zone une fois son contenu rangé.
  const units = zones.map((z) => {
    const layout = inner.get(z.id);
    if (!layout) return { zone: z, w: z.w, h: z.h };
    const box = bounds(layout.map((t) => ({ x: t.x, y: t.y, w: t.item.w, h: t.item.h })));
    return {
      zone: z,
      w: Math.max(240, box.x + box.w + PAD * 2),
      h: box.y + box.h + LABEL + PAD,
    };
  });

  // 2. Le niveau supérieur : blocs libres et zones, chaque zone comme un tout.
  const origin = bounds([...free, ...zones]);
  let autoZones = [];

  if (mode === "category") {
    // Les blocs libres en colonnes par catégorie ; les zones en rangée dessous.
    const cols = free.length ? columns(free, origin, true) : { targets: [], zones: [], bottom: origin.y - COL_GAP };
    for (const t of cols.targets) blockTargets.set(t.item.id, t);
    autoZones = cols.zones;
    // Alignée sur le bord des étiquettes de colonnes, qui débordent de 24 px.
    const below = { x: origin.x - (free.length ? 24 : 0), y: cols.bottom + COL_GAP };
    for (const t of flow(units.map(asItem), below, ROW_WIDTH)) placeZone(t);
  } else {
    const items = [...free, ...units.map(asItem)];
    for (const t of flow(sortFor(mode, items), origin, ROW_WIDTH)) {
      t.item.unit ? placeZone(t) : blockTargets.set(t.item.id, t);
    }
  }

  function placeZone(t) {
    const { zone, w, h } = t.item.unit;
    zoneTargets.set(zone.id, { x: t.x, y: t.y, w, h });
    for (const k of inner.get(zone.id) || []) {
      blockTargets.set(k.item.id, { x: t.x + PAD + k.x, y: t.y + LABEL + k.y });
    }
  }

  animate(blockTargets, zoneTargets, autoZones, mode);
}

/** Une zone vue comme un élément à placer, avec la date de son bloc le plus récent. */
function asItem(unit) {
  const kids = childrenOf(unit.zone.id);
  return {
    unit, w: unit.w, h: unit.h, x: unit.zone.x, y: unit.zone.y,
    updatedAt: Math.max(0, ...kids.map((b) => b.updatedAt || 0)),
  };
}

function sortFor(mode, list) {
  return mode === "date"
    // Par date : le plus récent devant, en lecture de gauche à droite.
    ? [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    // Alignement simple : on garde l'ordre de lecture actuel, on tasse.
    : [...list].sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

/* Par catégorie : une colonne par catégorie. Au niveau supérieur, chaque
   colonne reçoit une zone-étiquette nommée ; dans une zone, les colonnes
   suffisent. */
function columns(blocks, origin, labelled = false) {
  const order = [...categoryList().map((c) => c.id), null];
  const groups = new Map(order.map((k) => [k, []]));
  for (const b of blocks) groups.get(groups.has(b.category) ? b.category : null).push(b);

  const targets = [];
  const zones = [];
  let x = origin.x;
  let bottom = origin.y;
  const gap = labelled ? COL_GAP : GAP * 1.5;

  for (const key of order) {
    const group = groups.get(key);
    if (!group.length) continue;
    group.sort((a, b) => b.updatedAt - a.updatedAt);

    const width = Math.max(...group.map((b) => b.w));
    let y = origin.y;
    for (const b of group) {
      targets.push({ item: b, x, y });
      y += b.h + GAP;
    }
    bottom = Math.max(bottom, y - GAP);
    if (labelled) {
      zones.push({
        name: key ? plural(getCategory(key).label) : "Sans catégorie",
        x: x - 24, y: origin.y - 36,
        w: width + 48, h: y - origin.y - GAP + 60,
      });
    }
    x += width + gap;
  }
  return { targets, zones, bottom: labelled ? bottom + 24 : bottom };
}

/** Disposition en lignes, de largeur bornée. */
function flow(list, origin, rowWidth) {
  const targets = [];
  let x = origin.x;
  let y = origin.y;
  let rowHeight = 0;

  for (const item of list) {
    if (x > origin.x && x + item.w > origin.x + rowWidth) {
      x = origin.x;
      y += rowHeight + GAP;
      rowHeight = 0;
    }
    targets.push({ item, x, y });
    x += item.w + GAP;
    rowHeight = Math.max(rowHeight, item.h);
  }
  return targets;
}

/** « Idée » → « Idées », sans doubler un s déjà présent. */
const plural = (label) => (/s$/i.test(label) ? label : label + "s");

function animate(blockTargets, zoneTargets, autoZones, mode) {
  // Les transitions CSS font le déplacement ; on les retire ensuite pour ne pas
  // ralentir les glissers à la souris.
  const ids = [...blockTargets.keys(), ...zoneTargets.keys()];
  ids.forEach((id) => nodeFor(id)?.classList.add("is-animating"));

  mutate(() => {
    for (const [id, t] of blockTargets) {
      const b = state.doc.blocks[id];
      if (b) { b.x = Math.round(t.x); b.y = Math.round(t.y); }
    }
    for (const [id, t] of zoneTargets) {
      const z = state.doc.zones[id];
      if (!z) continue;
      // Les tracés d'une zone ne sont pas rangés : ils suivent la zone.
      const dx = Math.round(t.x) - z.x;
      const dy = Math.round(t.y) - z.y;
      for (const b of childrenOf(id)) if (!movable(b)) { b.x += dx; b.y += dy; }
      Object.assign(z, { x: Math.round(t.x), y: Math.round(t.y), w: Math.round(t.w), h: Math.round(t.h) });
    }
    // Les étiquettes du rangement précédent sont remplacées, ou retirées
    // quand le nouveau rangement n'en pose pas.
    for (const [id, zone] of Object.entries(state.doc.zones)) {
      if (zone.auto && !zone.archive) delete state.doc.zones[id];
    }
    for (const spec of autoZones) addZone({ ...spec, auto: true });
  });
  render();

  setTimeout(() => ids.forEach((id) => nodeFor(id)?.classList.remove("is-animating")), 420);

  const labels = { category: "Rangé par catégorie", date: "Rangé par date", tidy: "Aligné" };
  toast(labels[mode] + " · ⌘Z pour annuler");
  setTimeout(fitAll, 120);
}
