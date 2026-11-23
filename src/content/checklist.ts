/* Checklist de sortie : textes à relire et modifier librement.
   Adaptée au niveau : le cas A (premier son) a une explication par point,
   le cas B (publie déjà) une liste courte. Le suivi porte sur les étapes,
   jamais sur la qualité du son. */

import type { CasParcours, CleChecklist } from "@/types";

interface Point {
  titre: Record<CasParcours, string>;
  explication: string;
}

export const ordreChecklist: CleChecklist[] = ["mix-master", "cover", "distributeur", "metadonnees", "date", "contenus-reseaux"];

export const pointsChecklist: Record<CleChecklist, Point> = {
  "mix-master": {
    titre: { A: "Mix et master finalisés", B: "Mix et master finalisés" },
    explication: "Valide la version finale dans la fiche du morceau : c’est elle que tu enverras au distributeur.",
  },
  cover: {
    titre: { A: "Cover prête", B: "Cover prête" },
    explication: "Une image carrée d’au moins 3000 × 3000 pixels, sans lien ni logo de marque. Importe-la dans la fiche du morceau.",
  },
  distributeur: {
    titre: { A: "Choisir un distributeur", B: "Envoyer au distributeur" },
    explication:
      "Le distributeur envoie ton morceau sur les plateformes et te reverse tes revenus (DistroKid, TuneCore, Amuse, LANDR…). Coche quand ton compte est créé et le morceau envoyé.",
  },
  metadonnees: {
    titre: { A: "Métadonnées renseignées", B: "Métadonnées renseignées" },
    explication: "Titre, artistes, genre et crédits, plus bas sur cette page. L’ISRC peut venir de ton distributeur.",
  },
  date: {
    titre: { A: "Date de sortie fixée", B: "Date de sortie fixée" },
    explication: "Prévois trois à quatre semaines après l’envoi au distributeur, le temps d’être proposé aux playlists.",
  },
  "contenus-reseaux": {
    titre: { A: "Contenus réseaux planifiés", B: "Contenus réseaux planifiés" },
    explication: "Planifie au moins un post avant ou après la sortie : il s’affiche dans le calendrier.",
  },
};

export const plateformesPost = ["Instagram", "TikTok", "YouTube", "X", "Autre"];
