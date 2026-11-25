/* Textes du parcours : à relire et modifier librement.
   Chaque étape = un titre, une explication courte (2-3 phrases) et un bouton
   vers l’action concernée dans l’app. Le suivi porte sur les étapes de
   publication, jamais sur la qualité du son.

   Règles d’écriture : tutoiement, apostrophes ’, guillemets « », pas de tiret
   long. */

import type { CasParcours } from "@/types";
import { fr } from "./typo";

export interface ContenuEtape {
  titre: string;
  explication: string;
  /** Absent pour une étape ajoutée à la main. */
  action?: { libelle: string; vers: string };
}

export const etapes = {
  /* ---------- Cas A : jamais publié en streaming ---------- */

  "choisir-son": {
    titre: "Choisir le son à sortir",
    explication:
      "Pas besoin d’attendre le morceau parfait : choisis celui qui te ressemble le plus aujourd’hui. Un son sorti t’en apprend plus qu’une version de plus. Tout le parcours se fera avec lui.",
    action: { libelle: "Choisir le son", vers: "/musique" },
  },
  "mix-master": {
    titre: "Finaliser le mix et le master",
    explication:
      "Le mix équilibre les pistes entre elles, le master prépare le morceau pour les plateformes : volume, rendu sur tous les écouteurs. Tu peux le faire toi-même ou le confier à un ingé son. Quand c’est fait, ajoute la version finale au morceau.",
    action: { libelle: "Ajouter la version finale", vers: "/musique" },
  },
  cover: {
    titre: "Créer la cover",
    explication:
      "Les plateformes demandent une image carrée d’au moins 3000 × 3000 pixels, sans lien ni logo de marque. Elle sera souvent vue en tout petit : un visuel simple se lit mieux. Tu peux la faire toi-même ou travailler avec un graphiste.",
    action: { libelle: "Importer la cover", vers: "/musique" },
  },
  distributeur: {
    titre: "Choisir un distributeur",
    explication:
      "C’est quoi un distributeur ? Un service qui envoie ton morceau sur Spotify, Deezer, Apple Music et les autres plateformes, puis te reverse tes revenus. DistroKid, TuneCore, Amuse ou LANDR sont les plus utilisés par les indépendants : compare le prix (à l’année ou par sortie) et la part qu’ils gardent.",
    action: { libelle: "Voir la checklist de sortie", vers: "/sorties" },
  },
  metadonnees: {
    titre: "Renseigner les métadonnées",
    explication:
      "Ce sont les infos qui accompagnent ton morceau : titre, artistes, crédits, genre et code ISRC. Elles servent à te retrouver sur les plateformes et à te payer, alors elles doivent être exactes. Si tu n’as pas d’ISRC, ton distributeur te le fournit.",
    action: { libelle: "Renseigner les métadonnées", vers: "/sorties" },
  },
  "date-sortie": {
    titre: "Fixer la date de sortie",
    explication:
      "Prévois trois à quatre semaines entre l’envoi au distributeur et la sortie : c’est le délai pour être proposé aux playlists. Une date fixée rend le projet concret et te laisse le temps de préparer la suite.",
    action: { libelle: "Fixer la date", vers: "/sorties" },
  },
  "contenu-reseaux": {
    titre: "Planifier le contenu réseaux",
    explication:
      "Quelques posts avant la sortie (un extrait, la cover, les coulisses) et quelques-uns après suffisent. Planifie-les dans le calendrier pour ne pas tout faire la veille. Pas besoin d’être partout : reste sur les réseaux où tu es déjà.",
    action: { libelle: "Planifier un post", vers: "/sorties" },
  },
  "publier-stats": {
    titre: "Publier et suivre les stats",
    explication:
      "Le jour J, partage le lien du morceau autour de toi et sur tes réseaux. Ensuite, regarde les écoutes et les abonnés pour savoir ce qui a marché, pas pour te juger. Après ta première sortie, Spotify for Artists te donne tes vraies stats.",
    action: { libelle: "Connecter tes comptes", vers: "/reglages" },
  },

  /* ---------- Cas B : publie déjà ---------- */

  "rythme-regulier": {
    titre: "Sortir à un rythme régulier",
    explication:
      "Les plateformes et ton public suivent mieux un artiste qui revient souvent. Fixe-toi un rythme tenable, par exemple un son toutes les six à huit semaines, et pose les prochaines dates dans le calendrier.",
    action: { libelle: "Ouvrir le calendrier", vers: "/sorties" },
  },
  playlists: {
    titre: "Proposer ses morceaux aux playlists",
    explication:
      "Avant chaque sortie, propose ton morceau aux playlists éditoriales depuis Spotify for Artists, au moins sept jours avant la date. Pour les playlists indépendantes, écris directement aux curateurs : un mail court et un lien d’écoute.",
    action: { libelle: "Préparer un envoi", vers: "/reseau" },
  },
  "stats-sorties": {
    titre: "Suivre les stats après chaque sortie",
    explication:
      "Regarde tes chiffres une semaine puis un mois après chaque sortie : écoutes, sauvegardes, nouveaux abonnés. Compare tes sorties entre elles, pas avec celles des autres.",
    action: { libelle: "Connecter tes comptes", vers: "/reglages" },
  },
  "developper-reseau": {
    titre: "Développer son réseau : collabs, envois",
    explication:
      "Les collabs et les échanges avec d’autres artistes, beatmakers ou ingés son font avancer plus vite. Garde une trace de tes contacts, de ce que tu leur as envoyé, et pense à relancer.",
    action: { libelle: "Voir tes contacts", vers: "/reseau" },
  },
} satisfies Record<string, ContenuEtape>;

export type CleEtape = keyof typeof etapes;

/** Ordre des étapes et titre du parcours selon le point de départ. */
export const parcoursParCas: Record<CasParcours, { titre: string; etapes: CleEtape[] }> = {
  A: {
    titre: "Sortir ton premier son",
    etapes: [
      "choisir-son",
      "mix-master",
      "cover",
      "distributeur",
      "metadonnees",
      "date-sortie",
      "contenu-reseaux",
      "publier-stats",
    ],
  },
  B: {
    titre: "Installer ton rythme",
    etapes: ["rythme-regulier", "playlists", "stats-sorties", "developper-reseau"],
  },
};

/** Contenu affiché d’une étape : le texte proposé, ou celui réécrit par
    l’artiste s’il l’a modifié. */
export function contenuDe(etape: { cle: string; titrePerso?: string | null; explicationPerso?: string | null }): ContenuEtape {
  const base = contenuEtape(etape.cle);
  return {
    titre: fr(etape.titrePerso?.trim() || base?.titre || "Étape"),
    explication: fr(etape.explicationPerso?.trim() || base?.explication || ""),
    action: base?.action,
  };
}

export function contenuEtape(cle: string): ContenuEtape | undefined {
  const c = (etapes as Record<string, ContenuEtape>)[cle];
  return c && { ...c, titre: fr(c.titre), explication: fr(c.explication) };
}
