/* Règles de génération du parcours : simples, lisibles, sans IA.
   Entrée : les réponses au questionnaire. Sortie : le cas (A ou B), le titre
   et la liste ordonnée des étapes. */

import { parcoursParCas, type CleEtape } from "@/content/parcours";
import type { CasParcours, DejaPublie, Etape } from "@/types";

/** Cas B dès que l’artiste publie déjà en streaming ; sinon cas A. */
export function casDepuis(dejaPublie: DejaPublie): CasParcours {
  return dejaPublie === "streaming" ? "B" : "A";
}

export function genererParcours(dejaPublie: DejaPublie): { cas: CasParcours; titre: string; etapes: CleEtape[] } {
  const cas = casDepuis(dejaPublie);
  return { cas, ...parcoursParCas[cas] };
}

/** Le niveau est le numéro de l’étape en cours (1 au départ). Il monte d’un
    cran à chaque étape validée ; parcours terminé = nombre d’étapes + 1. */
export function niveauDepuis(etapes: Pick<Etape, "statut">[]): number {
  return etapes.filter((e) => e.statut === "validee").length + 1;
}

/** Numéro sur deux chiffres, comme « 02 ». */
export function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}
