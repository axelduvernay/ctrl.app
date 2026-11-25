/* Tâches : créées depuis le bouton +, le Réseau (relances), les Boards. */

import { depots } from "@/data";
import type { Id, Jour, Tache } from "@/types";

export function creerTache(titre: string, options: Partial<Pick<Tache, "echeance" | "morceauId" | "contactId" | "envoiId">> = {}) {
  return depots.taches.creer({
    titre: titre.trim(),
    echeance: options.echeance ?? null,
    faite: false,
    morceauId: options.morceauId ?? null,
    contactId: options.contactId ?? null,
    envoiId: options.envoiId ?? null,
  });
}

export function basculerTache(t: Tache) {
  return depots.taches.modifier(t.id, { faite: !t.faite });
}

export function modifierTache(id: Id, modifs: { titre?: string; echeance?: Jour | null }) {
  return depots.taches.modifier(id, modifs);
}

export function supprimerTache(id: Id) {
  return depots.taches.supprimer(id);
}

/** Tâches de la semaine : non faites, échéance passée ou dans les 7 jours,
    triées par date. Les tâches sans date viennent ensuite. */
export function tachesDeLaSemaine(taches: Tache[], aujourdHui: Jour, finSemaine: Jour) {
  const datees = taches
    .filter((t) => !t.faite && t.echeance && t.echeance <= finSemaine)
    .sort((a, b) => a.echeance!.localeCompare(b.echeance!));
  const sansDate = taches.filter((t) => !t.faite && !t.echeance).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  void aujourdHui;
  return [...datees, ...sansDate];
}
