/* Le rangement en deux clics.

   Trois critères, tous calculés sur l'appareil : aucun appel réseau, donc
   instantané et gratuit. Le résultat est une simple modification de positions,
   donc entièrement annulable par ⌘Z — ce qui le rend sans risque à essayer.

   Les zones conteneurs sont respectées, à toute profondeur : chaque zone range
   ses propres blocs et sous-zones à l'intérieur d'elle-même, puis se déplace
   d'un seul tenant parmi le reste. Un rangement ne fait jamais sortir un bloc
   de sa zone — les notes, tâches et rappels d'un projet restent ensemble. */

import { state, mutate, addZone, categoryList, getCategory, isContainer, zoneOf, childrenOf, childZones } from "./store.js";
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

/* Une zone à placer : sa taille une fois rangée, et la position de chacun de
   ses éléments relativement à son coin intérieur (sous le nom). */
function unit(zone, placements, w, h) {
  const kids = childrenOf(zone.id);
  return {
    unit: { zone, placements, w, h },
    w, h, x: zone.x, y: zone.y,
    updatedAt: Math.max(0, ...kids.map((b) => b.updatedAt || 0)),
  };
}

/** Range l'intérieur d'une zone, sous-zones comprises, sans la placer. */
function pack(zone, mode) {
  const blocks = childrenOf(zone.id).filter(movable);
  const subs = childZones(zone.id).map((z) => pack(z, mode));
  if (!blocks.length && !subs.length) return unit(zone, [], zone.w, zone.h);
  const width = Math.max(zone.w - PAD * 2, 480);
  const placements = mode === "category"
    ? columnsThenZones(blocks, subs, { x: 0, y: 0 }, false).placements
    : flow(sortFor(mode, [...blocks, ...subs]), { x: 0, y: 0 }, width);
  return sized(zone, placements);
}

/** Garde l'intérieur tel quel : la zone se déplace d'un bloc. */
function rigid(zone) {
  const origin = { x: zone.x + PAD, y: zone.y + LABEL };
  const placements = [
    ...childrenOf(zone.id).filter(movable).map((b) => ({ item: b, x: b.x - origin.x, y: b.y - origin.y })),
    ...childZones(zone.id).map((z) => ({ item: rigid(z), x: z.x - origin.x, y: z.y - origin.y })),
  ];
  return unit(zone, placements, zone.w, zone.h);
}

/** Taille d'une zone ajustée à son contenu rangé. */
function sized(zone, placements) {
  const box = bounds(placements.map((p) => ({ x: p.x, y: p.y, w: p.item.w, h: p.item.h })));
  return unit(zone, placements,
    Math.max(240, box.x + box.w + PAD * 2),
    box.y + box.h + LABEL + PAD);
}

/* Pose une zone et, récursivement, tout ce qu'elle contient. Les tracés de la
   zone ne sont pas rangés : ils la suivent. */
function place(u, x, y, blockTargets, zoneTargets) {
  const { zone, placements, w, h } = u.unit;
  zoneTargets.set(zone.id, { x, y, w, h });
  const dx = x - zone.x;
  const dy = y - zone.y;
  for (const b of childrenOf(zone.id)) if (!movable(b)) blockTargets.set(b.id, { x: b.x + dx, y: b.y + dy });
  for (const p of placements) {
    const px = x + PAD + p.x;
    const py = y + LABEL + p.y;
    p.item.unit ? place(p.item, px, py, blockTargets, zoneTargets) : blockTargets.set(p.item.id, { x: px, y: py });
  }
}

export function arrange(mode) {
  const zones = Object.values(state.doc.zones).filter((z) => isContainer(z) && !z.parent);
  const free = Object.values(state.doc.blocks).filter((b) => movable(b) && !zoneOf(b));
  if (!free.length && !zones.length) return toast("Rien à ranger");

  const units = zones.map((z) => pack(z, mode));
  const origin = bounds([...free, ...zones]);
  const blockTargets = new Map();
  const zoneTargets = new Map();
  let autoZones = [];
  let placements;

  if (mode === "category") {
    // Les blocs libres en colonnes par catégorie, étiquetées ; les zones en
    // rangée dessous.
    const laid = columnsThenZones(free, units, origin, true);
    placements = laid.placements;
    autoZones = laid.labels;
  } else {
    placements = flow(sortFor(mode, [...free, ...units]), origin, ROW_WIDTH);
  }
  for (const p of placements) {
    p.item.unit ? place(p.item, p.x, p.y, blockTargets, zoneTargets) : blockTargets.set(p.item.id, { x: p.x, y: p.y });
  }
  animate(blockTargets, zoneTargets, autoZones, mode);
}

/* Réorganiser une seule zone, sur place : une colonne par catégorie, les
   tâches à faire en tête et par échéance, et les blocs sans catégorie
   regroupés par nature (textes, puis listes, fichiers, liens, images). Les
   sous-zones gardent leur intérieur et se rangent en rangée dessous. La zone
   ne bouge pas, elle s'ajuste à son contenu. */
export function arrangeZone(zoneId) {
  const z = state.doc.zones[zoneId];
  const kids = z ? childrenOf(zoneId).filter(movable) : [];
  const subs = z ? childZones(zoneId).map(rigid) : [];
  if (!z || (!kids.length && !subs.length)) return toast("Rien à ranger dans cette zone");

  const byNature = (b) => ["text", "list", "file", "link", "image"].indexOf(b.kind);
  const groups = new Map();
  for (const b of kids) {
    const key = getCategory(b.category) ? b.category : "kind:" + (b.kind === "text" ? "text" : "media");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }
  const order = [...categoryList().map((c) => c.id), "kind:text", "kind:media"].filter((k) => groups.has(k));
  for (const key of order) {
    groups.get(key).sort((a, b) =>
      (a.done - b.done)                                   // à faire d'abord
      || ((a.due || "~").localeCompare(b.due || "~"))     // échéance la plus proche
      || (byNature(a) - byNature(b))
      || ((b.updatedAt || 0) - (a.updatedAt || 0)));
  }

  let placements = [];
  if (order.length === 1) {
    // Une seule famille : une grille plutôt qu'une longue colonne.
    placements = flow(groups.get(order[0]), { x: 0, y: 0 }, Math.max(z.w - PAD * 2, 480));
  } else if (order.length) {
    placements = stack(order.map((k) => groups.get(k)), { x: 0, y: 0 }, GAP * 1.5).placements;
  }
  const bottom = placements.length ? Math.max(...placements.map((p) => p.y + p.item.h)) + GAP * 2 : 0;
  placements.push(...flow(subs, { x: 0, y: bottom }, Math.max(z.w - PAD * 2, 480)));

  const u = sized(z, placements);
  const blockTargets = new Map();
  const zoneTargets = new Map();
  place(u, z.x, z.y, blockTargets, zoneTargets);
  animate(blockTargets, zoneTargets, null, "zone");
}

function sortFor(mode, list) {
  return mode === "date"
    // Par date : le plus récent devant, en lecture de gauche à droite.
    ? [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    // Alignement simple : on garde l'ordre de lecture actuel, on tasse.
    : [...list].sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

/* Par catégorie : une colonne par catégorie, puis les zones en rangée
   dessous. Au niveau supérieur (`labelled`), chaque colonne reçoit une
   zone-étiquette nommée ; dans une zone, les colonnes suffisent. */
function columnsThenZones(blocks, units, origin, labelled) {
  const order = [...categoryList().map((c) => c.id), null];
  const groups = new Map(order.map((k) => [k, []]));
  for (const b of blocks) groups.get(groups.has(b.category) ? b.category : null).push(b);
  const keys = order.filter((k) => groups.get(k).length);
  for (const k of keys) groups.get(k).sort((a, b) => b.updatedAt - a.updatedAt);

  const cols = stack(keys.map((k) => groups.get(k)), origin, labelled ? COL_GAP : GAP * 1.5);
  const labels = labelled
    ? cols.columns.map((c, i) => ({
        name: keys[i] ? plural(getCategory(keys[i]).label) : "Sans catégorie",
        x: c.x - 24, y: origin.y - 36, w: c.w + 48, h: c.h + 60,
      }))
    : [];

  const placements = [...cols.placements];
  if (units.length) {
    // Les étiquettes débordent de 24 px à gauche et en bas : on s'aligne dessus.
    const below = blocks.length
      ? { x: origin.x - (labelled ? 24 : 0), y: cols.bottom + (labelled ? 24 + COL_GAP : GAP * 2) }
      : origin;
    placements.push(...flow(units, below, ROW_WIDTH));
  }
  return { placements, labels };
}

/** Des colonnes côte à côte, chacune empilée de haut en bas. */
function stack(columns, origin, gap) {
  const placements = [];
  const out = [];
  let x = origin.x;
  let bottom = origin.y;
  for (const group of columns) {
    const width = Math.max(...group.map((b) => b.w));
    let y = origin.y;
    for (const b of group) {
      placements.push({ item: b, x, y });
      y += b.h + GAP;
    }
    out.push({ x, w: width, h: y - origin.y - GAP });
    bottom = Math.max(bottom, y - GAP);
    x += width + gap;
  }
  return { placements, columns: out, bottom };
}

/** Disposition en lignes, de largeur bornée. */
function flow(list, origin, rowWidth) {
  const placements = [];
  let x = origin.x;
  let y = origin.y;
  let rowHeight = 0;

  for (const item of list) {
    if (x > origin.x && x + item.w > origin.x + rowWidth) {
      x = origin.x;
      y += rowHeight + GAP;
      rowHeight = 0;
    }
    placements.push({ item, x, y });
    x += item.w + GAP;
    rowHeight = Math.max(rowHeight, item.h);
  }
  return placements;
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
      if (z) Object.assign(z, { x: Math.round(t.x), y: Math.round(t.y), w: Math.round(t.w), h: Math.round(t.h) });
    }
    // Les étiquettes du rangement précédent sont remplacées, ou retirées
    // quand le nouveau rangement n'en pose pas. Réorganiser une seule zone
    // (autoZones nul) n'y touche pas.
    if (autoZones) {
      for (const [id, zone] of Object.entries(state.doc.zones)) {
        if (zone.auto && !zone.archive) delete state.doc.zones[id];
      }
      for (const spec of autoZones) addZone({ ...spec, auto: true });
    }
  });
  render();

  setTimeout(() => ids.forEach((id) => nodeFor(id)?.classList.remove("is-animating")), 420);

  const labels = { category: "Rangé par catégorie", date: "Rangé par date", tidy: "Aligné", zone: "Zone réorganisée" };
  toast(labels[mode] + " · ⌘Z pour annuler");
  if (mode !== "zone") setTimeout(fitAll, 120);
}
