import { create } from "zustand";

/** Fenêtres disponibles partout : Capturer et la recherche ⌘K. */
interface EtatUi {
  capture: boolean;
  recherche: boolean;
  ouvrirCapture(): void;
  ouvrirRecherche(): void;
  fermer(): void;
}

export const useUi = create<EtatUi>((set) => ({
  capture: false,
  recherche: false,
  ouvrirCapture: () => set({ capture: true, recherche: false }),
  ouvrirRecherche: () => set({ recherche: true, capture: false }),
  fermer: () => set({ capture: false, recherche: false }),
}));
