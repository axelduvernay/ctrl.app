/* Catégories d’un board, reprises du prototype ctrl.mind : elles appartiennent
   au board, on les renomme, recolore, ajoute. */

import type { Board, Categorie } from "@/types";

/** Teintes désaturées, lisibles sur fond clair comme sur fond sombre.
    L’orange reste réservé au système (progression, création). */
export const PALETTE = ["#C9992B", "#4F8A72", "#6F81A8", "#8E6FA3", "#B4705A", "#5E8CA8", "#8A8F6B", "#A36F86"];

export const CATEGORIES_PAR_DEFAUT: Categorie[] = [
  { id: "idee", nom: "Idée", couleur: "#C9992B", commande: "idee", cochable: false },
  { id: "a-faire", nom: "À faire", couleur: "#4F8A72", commande: "afaire", cochable: true },
  { id: "question", nom: "Question", couleur: "#8E6FA3", commande: "question", cochable: false },
];

export function categoriesDe(board: Pick<Board, "categories">): Categorie[] {
  return board.categories ?? CATEGORIES_PAR_DEFAUT;
}

/** « À écouter » → « aecouter » : la commande tapée après « / ». */
export function enCommande(nom: string) {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
