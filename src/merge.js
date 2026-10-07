/* Fusion de deux versions d'un board, pour la synchronisation.

   Fusion à trois : `base` est la dernière version que cet appareil et le
   cloud avaient en commun ; `local` et `remote` en sont partis chacun de leur
   côté. Pour chaque élément (bloc, zone, lien, catégorie) :
   - s'il n'a changé que d'un côté, ce côté gagne — y compris une
     suppression ;
   - s'il a changé des deux côtés, la modification la plus récente gagne
     (`updatedAt`), et à défaut celle de cet appareil.
   Ainsi deux ordinateurs qui touchent à des blocs différents ne se
   marchent jamais dessus.

   Module pur, sans DOM : il se teste seul. */

const COLLECTIONS = ["blocks", "zones", "links", "categories"];
// Propres à chaque appareil, jamais synchronisés.
const LOCAL_ONLY = new Set(["rev"]);

/* Comparaison indépendante de l'ordre des clés : deux versions égales
   doivent être vues égales, même si les objets ont été reconstruits. */
function stable(v) {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort()
      .map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  }
  return v === undefined ? "null" : JSON.stringify(v);
}
const same = (a, b) => stable(a) === stable(b);

function pick(base, local, remote) {
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;
  // Modifié des deux côtés : le plus récent l'emporte.
  const lt = (local && local.updatedAt) || 0;
  const rt = (remote && remote.updatedAt) || 0;
  return rt > lt ? remote : local;
}

function mergeMap(base = {}, local = {}, remote = {}) {
  const out = {};
  for (const id of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const v = pick(base[id], local[id], remote[id]);
    if (v !== undefined) out[id] = v;
  }
  return out;
}

/** L'ordre de superposition : celui de cet appareil, complété par le cloud. */
function mergeOrder(local = [], remote = [], blocks) {
  const seen = new Set();
  const out = [];
  for (const id of [...local, ...remote, ...Object.keys(blocks)]) {
    if (blocks[id] && !seen.has(id)) { seen.add(id); out.push(id); }
  }
  return out;
}

export function merge(base, local, remote) {
  base = base || {};
  const out = {};
  for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    if (key === "order" || LOCAL_ONLY.has(key)) continue;
    out[key] = COLLECTIONS.includes(key)
      ? mergeMap(base[key], local[key], remote[key])
      : pick(base[key], local[key], remote[key]);
  }
  for (const key of COLLECTIONS) out[key] ||= {};
  out.order = mergeOrder(local.order, remote.order, out.blocks);
  // Un lien vers un bloc supprimé ailleurs n'a plus de sens.
  for (const [id, l] of Object.entries(out.links)) {
    if (!out.blocks[l.from] || !out.blocks[l.to]) delete out.links[id];
  }
  return out;
}

/** Ce qui part dans le cloud : le document sans ce qui est propre à l'appareil. */
export function shareable(doc) {
  const out = {};
  for (const [k, v] of Object.entries(doc)) if (!LOCAL_ONLY.has(k)) out[k] = v;
  return JSON.parse(JSON.stringify(out));
}

/** Retire le board d'accueil : sur un nouvel appareil, il ne doit pas
    rejoindre le board déjà synchronisé. */
export function withoutWelcome(doc) {
  const out = JSON.parse(JSON.stringify(doc));
  for (const key of ["blocks", "zones"]) {
    for (const [id, it] of Object.entries(out[key] || {})) if (it.welcome) delete out[key][id];
  }
  out.order = (out.order || []).filter((id) => out.blocks[id]);
  for (const [id, l] of Object.entries(out.links || {})) {
    if (!out.blocks[l.from] || !out.blocks[l.to]) delete out.links[id];
  }
  return out;
}

export const sameDoc = (a, b) => same(shareable(a), shareable(b));
