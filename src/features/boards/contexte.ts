import { createContext, useContext } from "react";
import type { Bloc, Categorie, Contact, Fichier, Id, Morceau, Tache, Version } from "@/types";
import type { Commande } from "./EditeurTexte";

export interface Edition {
  id: Id;
  point?: { x: number; y: number } | null;
  cellule?: { l: number; c: number } | null;
}

/** Ce que les blocs ont besoin de connaître du board qui les affiche. */
export interface ContexteBoard {
  boardId: Id;
  categories: Categorie[];
  morceaux: Morceau[];
  contacts: Contact[];
  taches: Tache[];
  versions: Version[];
  fichiers: Map<Id, Fichier>;
  edition: Edition | null;
  setEdition(e: Edition | null): void;
  commandes: Commande[];
  onCommande(bloc: Bloc, cle: string, html?: string): void;
  /** À appeler avant une modification, pour pouvoir l’annuler. */
  memoriser(): void;
  basculerFait(bloc: Bloc): void;
  ajouterMorceaux(bloc: Bloc): void;
}

export const BoardCtx = createContext<ContexteBoard | null>(null);

export function useBoard() {
  const c = useContext(BoardCtx);
  if (!c) throw new Error("useBoard hors d’un board");
  return c;
}
