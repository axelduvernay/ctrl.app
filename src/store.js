/* Le document et sa persistance.

   Deux magasins séparés, volontairement :
   - `doc` : blocs, zones, liens. Léger, versionné, c'est lui qui alimente l'annulation.
   - `assets` : les images et fichiers déposés. Lourds, jamais copiés dans l'historique.

   Cette séparation garde l'annulation instantanée même sur un board rempli d'images,
   et prépare la synchronisation : seul `doc` aura besoin de fusionner. */

import { uid, debounce, contains } from "./util.js";

const DB_NAME = "ctrl-app";
const DB_VERSION = 1;
const DOC_KEY = "doc";

/* Les catégories vivent dans le document, pas dans le code : elles sont
   modifiables, et elles voyageront avec le board le jour de la synchronisation.

   Chaque catégorie déclare ce qu'un bloc peut porter :
   - `checkable`     une case à cocher (ce qui en fait une tâche)
   - `fields.due`    une échéance, jour et heure facultative
   - `fields.remind` un rappel, qui sonne à l'heure dite */

const NO_FIELDS = { due: false, remind: false };
const ALL_FIELDS = { due: true, remind: true };

export const DEFAULT_CATEGORIES = [
  { id: "idea",     label: "Idée",     color: "#C9992B", cmd: "idea",     checkable: false, fields: NO_FIELDS },
  { id: "task",     label: "Tâche",    color: "#4F8A72", cmd: "task",     checkable: true,  fields: ALL_FIELDS },
  { id: "note",     label: "Note",     color: "#6F81A8", cmd: "note",     checkable: false, fields: NO_FIELDS },
  { id: "question", label: "Question", color: "#8E6FA3", cmd: "question", checkable: false, fields: NO_FIELDS },
];

/** Ce qu'un bloc peut porter : ce que sa catégorie prévoit, plus ce qu'on
    lui a ajouté à la main avec `/rappel` ou `/echeance`. */
export function fieldsOf(block) {
  const cat = block && getCategory(block.category);
  return { ...NO_FIELDS, ...cat?.fields, ...block?.fields };
}

/* Teintes désaturées, lisibles sur fond clair comme sur fond sombre.
   L'orange de la charte reste réservé au système : sélection, résultat de
   recherche, échéance proche. */
export const PALETTE = [
  "#C9992B", "#4F8A72", "#6F81A8", "#8E6FA3",
  "#B4705A", "#5E8CA8", "#8A8F6B", "#A36F86",
];

export const categoryList = () => Object.values(state.doc.categories || {}).sort((a, b) => a.order - b.order);
export const getCategory = (id) => (state.doc.categories || {})[id] || null;

export function addCategory(props = {}) {
  const id = uid();
  const used = categoryList().length;
  state.doc.categories[id] = {
    id,
    label: props.label || "Nouvelle",
    color: props.color || PALETTE[used % PALETTE.length],
    cmd: props.cmd || slugify(props.label || "nouvelle"),
    checkable: !!props.checkable,
    fields: { ...NO_FIELDS, ...props.fields },
    order: used,
  };
  return state.doc.categories[id];
}

export function updateCategory(id, patch) {
  const cat = state.doc.categories[id];
  if (!cat) return null;
  const { fields, ...rest } = patch;
  Object.assign(cat, rest);
  // Désactiver un champ le masque sans effacer les valeurs déjà saisies :
  // le réactiver les fait réapparaître.
  if (fields) cat.fields = { ...NO_FIELDS, ...cat.fields, ...fields };
  if (patch.label && !patch.cmd) cat.cmd = slugify(patch.label);
  if (cat.checkable === false) {
    for (const b of Object.values(state.doc.blocks)) if (b.category === id) b.done = false;
  }
  return cat;
}

/** Supprime une catégorie ; les blocs qui la portaient redeviennent neutres. */
export function removeCategory(id) {
  delete state.doc.categories[id];
  for (const b of Object.values(state.doc.blocks)) {
    if (b.category === id) { b.category = null; b.done = false; }
  }
}

const slugify = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || "cat";

function seedCategories() {
  const out = {};
  DEFAULT_CATEGORIES.forEach((cat, order) => { out[cat.id] = { ...cat, fields: { ...cat.fields }, order }; });
  return out;
}

export const state = {
  doc: emptyDoc(),
  view: { x: 0, y: 0, scale: 1 },
  selection: new Set(),
  tool: "select",
  editing: null,
  filters: { categories: new Set(), done: null },
  search: { query: "", hits: [], index: 0 },
  assets: new Map(),
  ready: false,
};

export function emptyDoc() {
  return { blocks: {}, zones: {}, links: {}, order: [], categories: seedCategories(), rev: 0 };
}

/* ---------- Événements ---------- */

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}

export function emit(event, detail) {
  for (const fn of listeners.get(event) || []) fn(detail);
}

/* ---------- Historique ---------- */

const undoStack = [];
const redoStack = [];
const HISTORY_LIMIT = 120;
let pending = null;

/** À appeler AVANT une modification. Ouvre une transaction annulable. */
export function begin() {
  if (pending) return;
  pending = JSON.stringify(state.doc);
}

/** À appeler APRÈS la modification. Referme la transaction et sauvegarde. */
export function commit() {
  if (!pending) return;
  if (pending !== JSON.stringify(state.doc)) {
    undoStack.push(pending);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
    state.doc.rev++;
    save();
  }
  pending = null;
  emit("change");
}

/** Modification atomique : begin + mutation + commit. */
export function mutate(fn) {
  begin();
  const result = fn();
  commit();
  return result;
}

export function undo() {
  if (!undoStack.length) return false;
  redoStack.push(JSON.stringify(state.doc));
  state.doc = JSON.parse(undoStack.pop());
  afterTimeTravel();
  return true;
}

export function redo() {
  if (!redoStack.length) return false;
  undoStack.push(JSON.stringify(state.doc));
  state.doc = JSON.parse(redoStack.pop());
  afterTimeTravel();
  return true;
}

export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;

function afterTimeTravel() {
  // Une sélection peut pointer vers un bloc qui n'existe plus.
  for (const id of [...state.selection]) {
    if (!state.doc.blocks[id] && !state.doc.zones[id] && !state.doc.links[id]) state.selection.delete(id);
  }
  save();
  emit("change");
}

/* ---------- Création ---------- */

export function addBlock(props) {
  const id = uid();
  const block = {
    id,
    kind: "text",
    x: 0, y: 0, w: 220, h: 96,
    text: "",
    category: null,
    done: false,
    due: null,
    remind: null,
    reminded: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...props,
    id, // après les props : une copie passe `id: undefined`
  };
  // Né dans une zone, un bloc en devient l'enfant — sauf si on a dit laquelle.
  if (props.zone === undefined) block.zone = zoneAt(block.x + block.w / 2, block.y + Math.min(block.h, 60) / 2)?.id || null;
  state.doc.blocks[id] = block;
  state.doc.order.push(id);
  return block;
}

export function addZone(props) {
  const id = uid();
  const zone = (state.doc.zones[id] = { x: 0, y: 0, w: 400, h: 300, name: "", ...props, id });
  // Posée dans une zone, elle en devient une sous-zone — sauf si on a dit où.
  if (props.parent === undefined) zone.parent = isContainer(zone) ? zoneFor(zone, id)?.id || null : null;
  return zone;
}

export function addLink(from, to, kind) {
  if (from === to) return null;
  const exists = Object.values(state.doc.links).find(
    (l) => (l.from === from && l.to === to) || (l.from === to && l.to === from)
  );
  if (exists) return exists;
  const id = uid();
  state.doc.links[id] = kind ? { id, from, to, kind } : { id, from, to };
  return state.doc.links[id];
}

/* ---------- Zones conteneurs ----------

   Une zone range des blocs : chaque bloc porte l'identifiant de sa zone dans
   `block.zone`. C'est l'appartenance qui compte, pas la géométrie : le
   rangement automatique déplace un bloc, il ne le fait jamais changer de
   zone. Seul un glisser à la main l'y fait entrer ou sortir.

   Deux sortes de zones ne rangent rien : l'archive « Fait », qui a sa propre
   logique, et les zones posées par le rangement par catégorie, simples
   étiquettes recalculées à chaque fois. */

export const isContainer = (z) => !!z && !z.archive && !z.auto;

/* Les zones s'imbriquent : une zone porte sa zone parente dans `zone.parent`,
   comme un bloc porte la sienne. On en tire la profondeur (pour l'ordre
   d'affichage) et la descendance (ce qui suit une zone qu'on déplace). */

export const parentOf = (z) => (z && z.parent && isContainer(state.doc.zones[z.parent]) ? state.doc.zones[z.parent] : null);

/** Vrai si la zone `id` est `ancestor` ou se trouve quelque part dedans. */
export function isWithin(id, ancestor) {
  for (let z = state.doc.zones[id]; z; z = parentOf(z)) if (z.id === ancestor) return true;
  return false;
}

export function depthOf(z) {
  let d = 0;
  for (let p = parentOf(z); p && d < 50; p = parentOf(p)) d++;
  return d;
}

export const childZones = (id) => Object.values(state.doc.zones).filter((z) => z.parent === id && isContainer(z));

/** Tout ce que contient une zone, sous-zones comprises, à toute profondeur. */
export function descendants(id) {
  const zones = [];
  const blocks = [...childrenOf(id)];
  for (const sub of childZones(id)) {
    zones.push(sub);
    const d = descendants(sub.id);
    zones.push(...d.zones);
    blocks.push(...d.blocks);
  }
  return { zones, blocks };
}

/** La plus petite zone conteneur sous ce point, s'il y en a une. */
export function zoneAt(x, y, except) {
  let best = null;
  for (const z of Object.values(state.doc.zones)) {
    if (!isContainer(z) || z.id === except) continue;
    if (x < z.x || y < z.y || x > z.x + z.w || y > z.y + z.h) continue;
    if (!best || z.w * z.h < best.w * best.h) best = z;
  }
  return best;
}

/* Part du bloc qui doit recouvrir une zone pour y entrer. Un tiers suffit :
   lâché à cheval sur le bord, le bloc est attiré dedans. */
const JOIN_SHARE = 0.3;

/** La zone qui recouvre le plus un bloc (ou une zone), si elle en recouvre
    assez. `except` écarte une zone et tout ce qu'elle contient : une zone ne
    peut pas entrer dans elle-même. À recouvrement égal, la plus petite gagne —
    c'est la plus profonde. */
export function zoneFor(b, except) {
  const area = Math.max(1, b.w * b.h);
  let best = null;
  let bestShare = JOIN_SHARE;
  for (const z of Object.values(state.doc.zones)) {
    if (!isContainer(z) || (except && isWithin(z.id, except))) continue;
    const w = Math.min(b.x + b.w, z.x + z.w) - Math.max(b.x, z.x);
    const h = Math.min(b.y + b.h, z.y + z.h) - Math.max(b.y, z.y);
    if (w <= 0 || h <= 0) continue;
    const share = (w * h) / area;
    if (share > bestShare + 1e-6 || (Math.abs(share - bestShare) <= 1e-6 && best && z.w * z.h < best.w * best.h)) {
      best = z;
      bestShare = share;
    }
  }
  return best;
}

/** La zone d'un bloc, si elle existe encore. */
export const zoneOf = (b) => (b && b.zone && isContainer(state.doc.zones[b.zone]) ? state.doc.zones[b.zone] : null);

/** Ce que contient une zone : ses enfants, ou pour une étiquette ce qu'elle recouvre. */
export function childrenOf(zoneId) {
  const z = state.doc.zones[zoneId];
  if (!z) return [];
  const blocks = Object.values(state.doc.blocks);
  // Une tâche archivée garde sa zone d'origine pour y revenir, mais vit dans
  // « Fait » : elle ne suit pas les déplacements de sa zone.
  return isContainer(z) ? blocks.filter((b) => b.zone === zoneId && !b.archived) : blocks.filter((b) => contains(z, b));
}

/** Recalcule la zone d'un bloc, ou la zone parente d'une zone, d'après sa
    position — après un glisser. */
export function adopt(it) {
  if (state.doc.zones[it.id]) {
    if (isContainer(it)) it.parent = zoneFor(it, it.id)?.id || null;
    return;
  }
  if (it.archived) return;
  it.zone = zoneFor(it)?.id || null;
}

/** Le lien entre deux blocs, dans un sens ou dans l'autre. */
export const linkBetween = (a, b) =>
  Object.values(state.doc.links).find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a)) || null;

export function removeItems(ids) {
  for (const id of ids) {
    delete state.doc.blocks[id];
    delete state.doc.links[id];
    // Une zone supprimée n'emporte rien : ses blocs et ses sous-zones
    // remontent d'un cran, dans sa zone parente s'il y en a une.
    const gone = state.doc.zones[id];
    const up = gone ? gone.parent || null : null;
    for (const b of Object.values(state.doc.blocks)) if (b.zone === id) b.zone = up;
    for (const z of Object.values(state.doc.zones)) if (z.parent === id) z.parent = up;
    delete state.doc.zones[id];
    state.doc.order = state.doc.order.filter((x) => x !== id);
    for (const [lid, link] of Object.entries(state.doc.links)) {
      if (link.from === id || link.to === id) delete state.doc.links[lid];
    }
    state.selection.delete(id);
  }
}

/** Remonte un bloc au premier plan. */
export function raise(id) {
  const i = state.doc.order.indexOf(id);
  if (i >= 0 && i < state.doc.order.length - 1) {
    state.doc.order.splice(i, 1);
    state.doc.order.push(id);
  }
}

export const item = (id) => state.doc.blocks[id] || state.doc.zones[id] || null;
export const blocksInOrder = () => state.doc.order.map((id) => state.doc.blocks[id]).filter(Boolean);

/* ---------- Persistance (IndexedDB) ---------- */

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
      if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => resolve(req && req.result);
        t.onerror = () => reject(t.error);
      })
  );
}

export const save = debounce(() => {
  tx("state", "readwrite", (s) => s.put(JSON.parse(JSON.stringify(state.doc)), DOC_KEY))
    .then(() => emit("saved"))
    .catch((err) => console.error("Sauvegarde impossible", err));
}, 400);

export function saveView() {
  try {
    localStorage.setItem("ctrl-view", JSON.stringify(state.view));
  } catch {}
}

/** Met à niveau un board venu d'une version antérieure — au chargement comme à l'import. */
export function migrate() {
  // Board créé avant les catégories modifiables : on installe celles d'origine.
  if (!state.doc.categories || !Object.keys(state.doc.categories).length) {
    state.doc.categories = seedCategories();
  }
  // Catégories antérieures aux champs : les catégories cochables reçoivent
  // échéance et rappel, comme la Tâche d'origine.
  for (const cat of Object.values(state.doc.categories)) {
    if (!cat.fields) cat.fields = cat.checkable ? { ...ALL_FIELDS } : { ...NO_FIELDS };
  }
  // Board antérieur aux zones conteneurs : un bloc entièrement dans une zone
  // en devient l'enfant.
  for (const b of Object.values(state.doc.blocks)) {
    if (b.zone !== undefined || b.archived) continue;
    const home = Object.values(state.doc.zones).filter((z) => isContainer(z) && contains(z, b))
      .sort((a, c) => a.w * a.h - c.w * c.h)[0];
    b.zone = home ? home.id : null;
  }
}

export async function load() {
  try {
    const doc = await tx("state", "readonly", (s) => s.get(DOC_KEY));
    if (doc && doc.blocks) state.doc = { ...emptyDoc(), ...doc };
    migrate();
    const assets = await tx("assets", "readonly", (s) => s.getAll());
    const keys = await tx("assets", "readonly", (s) => s.getAllKeys());
    keys.forEach((k, i) => state.assets.set(k, assets[i]));
  } catch (err) {
    console.error("Chargement impossible", err);
  }
  try {
    const view = JSON.parse(localStorage.getItem("ctrl-view") || "null");
    if (view && Number.isFinite(view.x)) state.view = view;
  } catch {}
  state.ready = true;
}

/** Stocke un blob (image, fichier) hors de l'historique et renvoie sa clé. */
export async function putAsset(blob) {
  const key = uid();
  state.assets.set(key, blob);
  await tx("assets", "readwrite", (s) => s.put(blob, key));
  return key;
}

export function assetURL(key) {
  const blob = state.assets.get(key);
  return blob ? URL.createObjectURL(blob) : null;
}

/** Poids approximatif du board — alimente le futur modèle par quota. */
export function storageUsed() {
  let bytes = JSON.stringify(state.doc).length;
  for (const blob of state.assets.values()) bytes += blob.size || 0;
  return bytes;
}
