/* Modèles de mails selon le profil : à relire et modifier librement.
   Variables remplacées à l’envoi :
   {prenom}     premier mot du nom du contact
   {nomArtiste} ton nom d’artiste
   {morceaux}   la liste des morceaux joints, numérotée
   {nombre}     le nombre de morceaux joints */

import type { Role } from "@/types";

export interface Modele {
  id: string;
  titre: string;
  /** Profils pour qui le modèle est proposé en premier. */
  pour: Role[];
  objet: string;
  corps: string;
}

export const modelesMail: Modele[] = [
  {
    id: "pack-prods",
    titre: "Envoyer un pack de prods",
    pour: ["beatmaker", "les-deux"],
    objet: "Pack de {nombre} prods pour toi",
    corps:
      "Salut {prenom},\n\nJe t’envoie un pack de {nombre} instrumentales, toutes faites maison :\n{morceaux}\n\nSi tu veux des modifs sur certaines, je reste dispo ici ou par message.\n\nBonne écoute !\n{nomArtiste}",
  },
  {
    id: "cherche-prods",
    titre: "Chercher des prods",
    pour: ["artiste", "les-deux"],
    objet: "Recherche de prods",
    corps:
      "Salut {prenom},\n\nJe suis {nomArtiste}, je fais du son et j’aime beaucoup ce que tu produis. Je cherche des prods pour mes prochains morceaux.\n\nPour te donner une idée de mon univers :\n{morceaux}\n\nSi tu as des instrus à me faire écouter, je suis preneur.\n\nÀ bientôt,\n{nomArtiste}",
  },
  {
    id: "collab",
    titre: "Proposer une collab",
    pour: ["artiste", "beatmaker", "les-deux"],
    objet: "Une collab ?",
    corps:
      "Salut {prenom},\n\nC’est {nomArtiste}. Je suis ton travail depuis un moment et je pense qu’on pourrait faire un truc ensemble.\n\nVoilà ce que je fais en ce moment :\n{morceaux}\n\nDis-moi si ça te parle, on peut en discuter quand tu veux.\n\n{nomArtiste}",
  },
  {
    id: "playlist",
    titre: "Proposer un morceau à une playlist",
    pour: ["artiste", "beatmaker", "les-deux"],
    objet: "Proposition pour ta playlist",
    corps:
      "Salut {prenom},\n\nJe suis {nomArtiste}. Je pense que ce morceau pourrait trouver sa place dans ta playlist :\n{morceaux}\n\nMerci d’avance pour l’écoute.\n\n{nomArtiste}",
  },
  {
    id: "relance",
    titre: "Relancer",
    pour: ["artiste", "beatmaker", "les-deux"],
    objet: "Petite relance",
    corps:
      "Salut {prenom},\n\nJe me permets de revenir vers toi suite à mon dernier message. Tu as eu le temps d’écouter ?\n\nÀ bientôt,\n{nomArtiste}",
  },
];

export const rolesContact = [
  { valeur: "artiste", libelle: "Artiste" },
  { valeur: "beatmaker", libelle: "Beatmaker" },
  { valeur: "inge-son", libelle: "Ingé son" },
  { valeur: "graphiste", libelle: "Graphiste" },
  { valeur: "pro", libelle: "Pro" },
  { valeur: "autre", libelle: "Autre" },
] as const;

export function libelleRole(valeur: string) {
  return rolesContact.find((r) => r.valeur === valeur)?.libelle ?? "Autre";
}

/** Remplit les variables d’un modèle. */
export function remplir(texte: string, v: { prenom: string; nomArtiste: string; morceaux: string[] }) {
  const liste = v.morceaux.length ? v.morceaux.map((m, i) => `${i + 1}. ${m}`).join("\n") : "(aucun morceau joint)";
  return texte
    .replaceAll("{prenom}", v.prenom)
    .replaceAll("{nomArtiste}", v.nomArtiste)
    .replaceAll("{morceaux}", liste)
    .replaceAll("{nombre}", String(v.morceaux.length));
}
