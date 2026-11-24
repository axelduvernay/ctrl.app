import Dexie, { type Table } from "dexie";
import type {
  Utilisateur,
  Profil,
  Parcours,
  Etape,
  Morceau,
  Fichier,
  Version,
  Note,
  Projet,
  Tache,
  Sortie,
  PostReseau,
  Contact,
  Envoi,
  ModeleMail,
  Board,
  Bloc,
  Lien,
  Connexion,
} from "@/types";

/* Nom distinct de celui de ctrl.mind (« ctrl-app ») : les deux apps sont
   servies depuis la même origine axelduvernay.github.io. */
export const NOM_BASE = "ctrlapp-donnees";

export class BaseLocale extends Dexie {
  utilisateurs!: Table<Utilisateur, string>;
  profils!: Table<Profil, string>;
  parcours!: Table<Parcours, string>;
  etapes!: Table<Etape, string>;
  morceaux!: Table<Morceau, string>;
  fichiers!: Table<Fichier, string>;
  versions!: Table<Version, string>;
  notes!: Table<Note, string>;
  projets!: Table<Projet, string>;
  taches!: Table<Tache, string>;
  sorties!: Table<Sortie, string>;
  postsReseaux!: Table<PostReseau, string>;
  contacts!: Table<Contact, string>;
  envois!: Table<Envoi, string>;
  modelesMail!: Table<ModeleMail, string>;
  boards!: Table<Board, string>;
  blocs!: Table<Bloc, string>;
  liens!: Table<Lien, string>;
  connexions!: Table<Connexion, string>;
  _attente!: Table<{ cle: string; collection: string; id: string; supprime: boolean; at: string }, string>;
  _meta!: Table<{ cle: string; valeur: unknown }, string>;

  constructor() {
    super(NOM_BASE);
    this.version(1).stores({
      utilisateurs: "id",
      profils: "id",
      parcours: "id",
      etapes: "id, parcoursId, ordre",
      morceaux: "id, statut, projetId, updatedAt",
      fichiers: "id",
      versions: "id, morceauId",
      notes: "id, morceauId",
      projets: "id",
      taches: "id, echeance, morceauId, contactId, envoiId",
      sorties: "id, morceauId, projetId, date",
      postsReseaux: "id, date, sortieId",
      contacts: "id, nom",
      envois: "id, contactId",
      modelesMail: "id",
      boards: "id",
      blocs: "id, boardId, refId",
      liens: "id, boardId",
      connexions: "id, service",
    });
    // Synchronisation : changements à envoyer, et réglages internes.
    this.version(2).stores({
      _attente: "cle",
      _meta: "cle",
    });
  }
}
