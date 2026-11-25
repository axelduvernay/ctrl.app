import { create } from "zustand";
import { depots } from "@/data";

/* Lecteur unique de l’app : un seul son à la fois, une file d’écoute
   (librairie, projet, tracklist) et la barre de lecture en bas de l’écran. */

export interface Piste {
  fichierId: string;
  titre: string;
  sousTitre?: string;
  /** Fiche à ouvrir depuis la barre de lecture. */
  morceauId?: string;
  coverFichierId?: string | null;
}

interface EtatLecteur {
  file: Piste[];
  index: number;
  lecture: boolean;
  position: number;
  duree: number;
  aleatoire: boolean;
  /** Boucle : rien, toute la file, ou le son en cours. */
  boucle: "non" | "tout" | "un";
  /** Volume entre 0 et 1, gardé d’une visite à l’autre. */
  volume: number;
  courante(): Piste | null;
  basculerAleatoire(): void;
  changerBoucle(): void;
  regler(volume: number): void;
  /** Lance la piste « index » de la file (ou met en pause si c’est déjà elle). */
  jouer(file: Piste[], index?: number): void;
  basculer(): void;
  suivant(): void;
  precedent(): void;
  aller(secondes: number): void;
  fermer(): void;
}

const audio = typeof Audio !== "undefined" ? new Audio() : null;
const CLE_VOLUME = "ctrlapp.volume";
const volumeGarde = () => {
  const v = Number(typeof localStorage !== "undefined" ? localStorage.getItem(CLE_VOLUME) : null);
  return localStorage.getItem(CLE_VOLUME) !== null && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
};
let adresse: string | null = null;
let chargee: string | null = null;

async function charger(fichierId: string) {
  if (!audio || chargee === fichierId) return;
  chargee = fichierId;
  const f = await depots.fichiers.obtenir(fichierId);
  if (!f || chargee !== fichierId) return;
  if (adresse) URL.revokeObjectURL(adresse);
  adresse = URL.createObjectURL(f.blob);
  audio.src = adresse;
  useLecteur.setState({ duree: f.duree ?? 0, position: 0 });
}

export const useLecteur = create<EtatLecteur>((set, get) => ({
  file: [],
  index: 0,
  lecture: false,
  position: 0,
  duree: 0,
  aleatoire: false,
  boucle: "non",
  volume: audio ? volumeGarde() : 1,
  courante: () => get().file[get().index] ?? null,
  basculerAleatoire: () => set((e) => ({ aleatoire: !e.aleatoire })),
  changerBoucle: () => set((e) => ({ boucle: e.boucle === "non" ? "tout" : e.boucle === "tout" ? "un" : "non" })),
  regler(volume) {
    if (audio) audio.volume = volume;
    localStorage.setItem(CLE_VOLUME, String(volume));
    set({ volume });
  },
  jouer(file, index = 0) {
    const cible = file[index];
    if (!audio || !cible) return;
    if (get().courante()?.fichierId === cible.fichierId) {
      set({ file, index });
      return get().basculer();
    }
    set({ file, index, position: 0, lecture: true });
    void charger(cible.fichierId).then(() => audio.play().catch(() => set({ lecture: false })));
  },
  basculer() {
    if (!audio || !get().courante()) return;
    if (audio.paused) void audio.play().catch(() => set({ lecture: false }));
    else audio.pause();
  },
  suivant() {
    const { file, index, aleatoire, boucle } = get();
    if (aleatoire && file.length > 1) {
      let i = index;
      while (i === index) i = Math.floor(Math.random() * file.length);
      return get().jouer(file, i);
    }
    if (index + 1 < file.length) get().jouer(file, index + 1);
    else if (boucle === "tout" && file.length) get().jouer(file, 0);
    else audio?.pause();
  },
  precedent() {
    const { file, index } = get();
    // Comme partout : au-delà de 3 secondes, on revient au début du son.
    if (audio && (audio.currentTime > 3 || index === 0)) return get().aller(0);
    get().jouer(file, index - 1);
  },
  aller(secondes) {
    if (!audio) return;
    audio.currentTime = secondes;
    set({ position: secondes });
  },
  fermer() {
    audio?.pause();
    if (audio) audio.removeAttribute("src");
    if (adresse) URL.revokeObjectURL(adresse);
    adresse = chargee = null;
    set({ file: [], index: 0, lecture: false, position: 0, duree: 0 });
  },
}));

if (audio) {
  audio.preload = "metadata";
  audio.volume = useLecteur.getState().volume;
  audio.addEventListener("play", () => useLecteur.setState({ lecture: true }));
  audio.addEventListener("pause", () => useLecteur.setState({ lecture: false }));
  audio.addEventListener("timeupdate", () => useLecteur.setState({ position: audio.currentTime }));
  audio.addEventListener("loadedmetadata", () => Number.isFinite(audio.duration) && useLecteur.setState({ duree: audio.duration }));
  audio.addEventListener("ended", () => {
    const l = useLecteur.getState();
    if (l.boucle === "un") {
      audio.currentTime = 0;
      void audio.play();
    } else if (l.file.length === 1 && l.boucle !== "tout") audio.pause();
    else l.suivant();
  });
}
