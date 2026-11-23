import type { Morceau, Sortie } from "@/types";

/** Où mène le bouton d’une étape : vers le morceau du parcours ou sa sortie
    quand ils existent, sinon vers l’onglet concerné. */
export function cibleAction(vers: string, morceau: Morceau | undefined, sorties: Sortie[]): string {
  if (!morceau) return vers;
  if (vers === "/musique") return `/musique/${morceau.id}`;
  if (vers === "/sorties") {
    const sortie = sorties.find((s) => s.morceauId === morceau.id);
    return sortie ? `/sorties/${sortie.id}` : `/sorties?nouvelle=${morceau.id}`;
  }
  return vers;
}
