import { create } from "zustand";
import type { Session } from "@/data/remote/distant";

export type EtatSynchro = "inactif" | "en-cours" | "ok" | "hors-ligne" | "erreur";

/** Compte connecté et état de la synchronisation, pour l’interface. */
interface EtatCompte {
  session: Session | null;
  etat: EtatSynchro;
  erreur: string | null;
  derniere: string | null;
  attente: number;
  maj(e: Partial<Omit<EtatCompte, "maj">>): void;
}

export const useCompte = create<EtatCompte>((set) => ({
  session: null,
  etat: "inactif",
  erreur: null,
  derniere: null,
  attente: 0,
  maj: (e) => set(e),
}));
