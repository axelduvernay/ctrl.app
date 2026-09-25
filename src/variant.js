/* Les variantes : une v2 d'un ensemble de blocs, posée à côté de l'original.

   L'ensemble, c'est la sélection quand plusieurs blocs sont choisis ; sinon
   tout ce qui est relié au bloc, de proche en proche. On copie les blocs, les
   liens qui les unissent et les zones sélectionnées, puis un lien pointillé
   rattache la variante à son original. Chaque bloc porte son numéro de
   version, et toutes les versions d'un même ensemble partagent une lignée. */

import { state, mutate, addBlock, addZone, addLink, emit, childrenOf } from "./store.js";
import { render } from "./render.js";
import { centerOn } from "./viewport.js";
import { bounds, uid } from "./util.js";
import { toast } from "./main.js";

/** Blocs reliés à `id`, de proche en proche. */
function connected(id) {
  const seen = new Set([id]);
  const queue = [id];
  const links = Object.values(state.doc.links).filter((l) => l.kind !== "variant");
  while (queue.length) {
    const cur = queue.shift();
    for (const l of links) {
      const next = l.from === cur ? l.to : l.to === cur ? l.from : null;
      if (next && !seen.has(next) && state.doc.blocks[next]) { seen.add(next); queue.push(next); }
    }
  }
  return [...seen];
}

function groupFor(id) {
  const ids = state.selection.size > 1 && state.selection.has(id) ? [...state.selection] : connected(id);
  const zones = ids.filter((x) => state.doc.zones[x]);
  const blocks = new Set(ids.filter((x) => state.doc.blocks[x]));
  // Une zone sélectionnée emporte son contenu.
  for (const zid of zones) {
    for (const b of childrenOf(zid)) blocks.add(b.id);
  }
  return { blocks: [...blocks], zones };
}

export function createVariant(id) {
  const { blocks, zones } = groupFor(id);
  if (!blocks.length) return;
  const originals = blocks.map((x) => state.doc.blocks[x]);
  const box = bounds([...originals, ...zones.map((z) => state.doc.zones[z])]);
  const dx = box.w + 140;

  const copies = new Map();
  mutate(() => {
    const lineage = originals.find((b) => b.lineage)?.lineage || uid();
    const version = 1 + Math.max(1, ...Object.values(state.doc.blocks)
      .filter((b) => b.lineage === lineage).map((b) => b.variant || 1));

    // Les zones d'abord : les copies de blocs y retrouvent leur place.
    const zoneCopies = new Map();
    for (const zid of zones) {
      const z = state.doc.zones[zid];
      const copy = addZone({ ...z, id: undefined, archive: false, x: z.x + dx, name: `${z.name || "Zone"} v${version}` });
      zoneCopies.set(zid, copy.id);
    }

    for (const b of originals) {
      b.lineage = lineage;
      b.variant = b.variant || 1;
      const copy = addBlock({
        ...structuredClone(b), id: undefined, x: b.x + dx,
        // Une variante garde les échéances mais pas les rappels : la même
        // alarme ne doit pas sonner deux fois.
        variant: version, remind: null, reminded: false, createdAt: Date.now(), updatedAt: Date.now(),
        zone: zoneCopies.get(b.zone) || null,
      });
      copies.set(b.id, copy.id);
    }
    for (const l of Object.values(state.doc.links)) {
      if (copies.has(l.from) && copies.has(l.to)) addLink(copies.get(l.from), copies.get(l.to));
    }
    // Rattache la variante à l'original, par leurs blocs les plus à gauche.
    const anchor = originals.reduce((a, b) => (b.x < a.x ? b : a));
    addLink(anchor.id, copies.get(anchor.id), "variant");
  });

  state.selection.clear();
  for (const cid of copies.values()) state.selection.add(cid);
  emit("selection");
  render();
  centerOn({ ...box, x: box.x + dx });
  toast(copies.size > 1 ? `Variante créée · ${copies.size} blocs` : "Variante créée");
}
