/* Annuler / rétablir, par board : avant chaque modification, on garde une
   copie des blocs et des liens. Annuler réécrit cette copie. Les objets liés
   (morceaux, contacts, tâches) ne sont pas concernés. */

import { depots } from "@/data";
import type { Bloc, Id, Lien } from "@/types";

interface Etat {
  blocs: Bloc[];
  liens: Lien[];
}

const LIMITE = 100;
const piles = new Map<Id, { annuler: Etat[]; retablir: Etat[] }>();

function pile(boardId: Id) {
  let p = piles.get(boardId);
  if (!p) piles.set(boardId, (p = { annuler: [], retablir: [] }));
  return p;
}

const copier = (e: Etat): Etat => structuredClone(e);

/** À appeler juste avant une modification, avec l’état affiché. */
export function memoriser(boardId: Id, etat: Etat) {
  const p = pile(boardId);
  p.annuler.push(copier(etat));
  if (p.annuler.length > LIMITE) p.annuler.shift();
  p.retablir = [];
}

async function appliquer(boardId: Id, cible: Etat) {
  const [blocs, liens] = await Promise.all([depots.blocs.trouver("boardId", boardId), depots.liens.trouver("boardId", boardId)]);
  const idsBlocs = new Set(cible.blocs.map((b) => b.id));
  const idsLiens = new Set(cible.liens.map((l) => l.id));
  for (const l of liens) if (!idsLiens.has(l.id)) await depots.liens.supprimer(l.id);
  for (const b of blocs) if (!idsBlocs.has(b.id)) await depots.blocs.supprimer(b.id);
  for (const b of cible.blocs) await depots.blocs.remplacer(b);
  for (const l of cible.liens) await depots.liens.remplacer(l);
}

export async function annuler(boardId: Id, actuel: Etat) {
  const p = pile(boardId);
  const precedent = p.annuler.pop();
  if (!precedent) return false;
  p.retablir.push(copier(actuel));
  await appliquer(boardId, precedent);
  return true;
}

export async function retablir(boardId: Id, actuel: Etat) {
  const p = pile(boardId);
  const suivant = p.retablir.pop();
  if (!suivant) return false;
  p.annuler.push(copier(actuel));
  await appliquer(boardId, suivant);
  return true;
}
