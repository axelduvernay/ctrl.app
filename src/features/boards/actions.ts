/* Écritures des Boards, via les repositories. Les nœuds liés pointent vers
   les vrais objets de l’app (tâches, morceaux, contacts). */

import { depots } from "@/data";
import { creerTache } from "@/features/taches/actions";
import type { Bloc, Id, TypeBloc, VueBoard } from "@/types";

export function creerBoard(titre: string) {
  return depots.boards.creer({ titre: titre.trim(), vue: { x: 0, y: 0, zoom: 1 } });
}

export async function supprimerBoard(id: Id) {
  for (const l of await depots.liens.trouver("boardId", id)) await depots.liens.supprimer(l.id);
  for (const b of await depots.blocs.trouver("boardId", id)) await depots.blocs.supprimer(b.id);
  await depots.boards.supprimer(id);
}

export function enregistrerVue(id: Id, vue: VueBoard) {
  return depots.boards.modifier(id, { vue });
}

const tailles: Record<TypeBloc, { largeur: number; hauteur: number }> = {
  note: { largeur: 240, hauteur: 0 },
  tache: { largeur: 240, hauteur: 0 },
  tracklist: { largeur: 280, hauteur: 0 },
  zone: { largeur: 560, hauteur: 420 },
  morceau: { largeur: 260, hauteur: 0 },
  contact: { largeur: 240, hauteur: 0 },
};

export async function creerBloc(boardId: Id, type: TypeBloc, x: number, y: number, extra: Partial<Pick<Bloc, "refId" | "titre" | "contenu">> = {}) {
  let refId = extra.refId ?? null;
  if (type === "tache" && !refId) refId = (await creerTache(extra.titre || "Nouvelle tâche")).id;
  const t = tailles[type];
  return depots.blocs.creer({
    boardId,
    type,
    x: Math.round(x - t.largeur / 2),
    y: Math.round(y - (t.hauteur || 80) / 2),
    largeur: t.largeur,
    hauteur: t.hauteur,
    zoneId: null,
    titre: extra.titre ?? (type === "zone" ? "Zone" : type === "tracklist" ? "Tracklist" : ""),
    contenu: extra.contenu ?? "",
    refId,
    morceauIds: [],
  });
}

export function deplacerBlocs(positions: { id: Id; x: number; y: number }[]) {
  return Promise.all(positions.map((p) => depots.blocs.modifier(p.id, { x: Math.round(p.x), y: Math.round(p.y) })));
}

export function modifierBloc(id: Id, modifs: Partial<Pick<Bloc, "titre" | "contenu" | "largeur" | "hauteur">>) {
  return depots.blocs.modifier(id, modifs);
}

export function basculerMorceauTracklist(id: Id, morceauId: Id) {
  return depots.blocs.transformer(id, (b) => ({
    morceauIds: b.morceauIds.includes(morceauId) ? b.morceauIds.filter((x) => x !== morceauId) : [...b.morceauIds, morceauId],
  }));
}

/** Supprime le bloc et ses liens. L’objet lié (tâche, morceau, contact) reste dans l’app. */
export async function supprimerBloc(id: Id) {
  for (const l of await depots.liens.lister()) if (l.deBlocId === id || l.versBlocId === id) await depots.liens.supprimer(l.id);
  await depots.blocs.supprimer(id);
}

export async function relier(boardId: Id, de: Id, vers: Id) {
  if (de === vers) return;
  const existants = await depots.liens.trouver("boardId", boardId);
  if (existants.some((l) => (l.deBlocId === de && l.versBlocId === vers) || (l.deBlocId === vers && l.versBlocId === de))) return;
  await depots.liens.creer({ boardId, deBlocId: de, versBlocId: vers });
}

export function supprimerLien(id: Id) {
  return depots.liens.supprimer(id);
}
