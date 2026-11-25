import { create } from "zustand";

/** Ce qu’on peut ajouter depuis le bouton + présent sur tous les écrans. */
export type TypeAjout = "tache" | "evenement" | "contact" | "note" | "memo";

/** Fenêtres disponibles partout : ajout rapide et recherche ⌘K. */
interface EtatUi {
  ajout: TypeAjout | null;
  recherche: boolean;
  /** Message bref en bas de l’écran (« Note ajoutée à ton board »), avec un lien. */
  annonce: { texte: string; vers?: string; libelle?: string } | null;
  annoncer(texte: string, lien?: { vers: string; libelle: string }): void;
  ouvrirAjout(type: TypeAjout): void;
  ouvrirRecherche(): void;
  fermer(): void;
}

let minuteur: ReturnType<typeof setTimeout> | undefined;

export const useUi = create<EtatUi>((set) => ({
  ajout: null,
  recherche: false,
  annonce: null,
  annoncer: (texte, lien) => {
    set({ annonce: { texte, vers: lien?.vers, libelle: lien?.libelle } });
    clearTimeout(minuteur);
    minuteur = setTimeout(() => set({ annonce: null }), 5000);
  },
  ouvrirAjout: (ajout) => set({ ajout, recherche: false }),
  ouvrirRecherche: () => set({ recherche: true, ajout: null }),
  fermer: () => set({ ajout: null, recherche: false }),
}));
