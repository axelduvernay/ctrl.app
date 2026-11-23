/* Statuts d’un morceau : libellés exacts et couleurs dédiées. */

import type { StatutMorceau, TypeNote, TypeProjet } from "@/types";

export const statuts: { valeur: StatutMorceau; libelle: string; couleur: string }[] = [
  { valeur: "idee", libelle: "Idée", couleur: "var(--statut-idee)" },
  { valeur: "maquette", libelle: "Maquette", couleur: "var(--statut-maquette)" },
  { valeur: "finition", libelle: "Finition", couleur: "var(--statut-finition)" },
  { valeur: "pret", libelle: "Prêt", couleur: "var(--statut-pret)" },
  { valeur: "sorti", libelle: "Sorti", couleur: "var(--statut-sorti)" },
];

export function statut(valeur: StatutMorceau) {
  return statuts.find((s) => s.valeur === valeur) ?? statuts[0]!;
}

export const typesNote: { valeur: TypeNote; libelle: string; vide: string }[] = [
  { valeur: "paroles", libelle: "Paroles", vide: "Écris ou colle tes paroles ici." },
  { valeur: "idee", libelle: "Idées", vide: "Une direction, une référence, un détail à ne pas oublier." },
  { valeur: "retour", libelle: "Retours", vide: "Ce qu’on t’a dit sur le morceau, et qui te l’a dit." },
  { valeur: "mix", libelle: "Notes de mix", vide: "Niveaux, effets, choses à corriger avant le master." },
];

export const typesProjet: { valeur: TypeProjet; libelle: string }[] = [
  { valeur: "ep", libelle: "EP" },
  { valeur: "album", libelle: "Album" },
  { valeur: "mixtape", libelle: "Mixtape" },
  { valeur: "tracklist", libelle: "Tracklist" },
];

export function typeProjet(valeur: TypeProjet) {
  return typesProjet.find((t) => t.valeur === valeur)?.libelle ?? "Projet";
}
