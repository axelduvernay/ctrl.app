import { create } from "zustand";

export type Theme = "sombre" | "clair";

/* Préférence d’affichage, propre à cet appareil. Clé préfixée « ctrlapp. »
   pour ne pas croiser celles de ctrl.mind (même origine). */
const CLE = "ctrlapp.theme";

function lire(): Theme {
  try {
    return localStorage.getItem(CLE) === "clair" ? "clair" : "sombre";
  } catch {
    return "sombre";
  }
}

function appliquer(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "clair" ? "#e9ecef" : "#141415");
  try {
    localStorage.setItem(CLE, theme);
  } catch {
    /* navigation privée : le thème n’est simplement pas retenu */
  }
}

interface EtatTheme {
  theme: Theme;
  choisir(theme: Theme): void;
  basculer(): void;
}

export const useTheme = create<EtatTheme>((set, get) => ({
  theme: lire(),
  choisir(theme) {
    appliquer(theme);
    set({ theme });
  },
  basculer() {
    get().choisir(get().theme === "sombre" ? "clair" : "sombre");
  },
}));
