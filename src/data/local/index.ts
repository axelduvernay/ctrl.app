/* Implémentation IndexedDB (via Dexie) des repositories. */

import type { Table } from "dexie";
import type { Entite, Id, Nouveau, Modification, Utilisateur } from "@/types";
import type { Collection, Depots, Repo } from "@/data/repositories";
import { BaseLocale } from "./db";

type Ecouteur = (collection: Collection) => void;

const maintenant = () => new Date().toISOString();

export function creerDepotsLocaux(): Depots {
  const db = new BaseLocale();
  const ecouteurs = new Set<Ecouteur>();
  const signaler = (collection: Collection) => ecouteurs.forEach((e) => e(collection));

  // Un seul utilisateur local, créé au premier lancement.
  let proprietaire: Promise<Utilisateur> | null = null;
  const obtenirProprietaire = () => {
    proprietaire ??= db.transaction("rw", db.utilisateurs, async () => {
      const existant = await db.utilisateurs.toCollection().first();
      if (existant) return existant;
      const date = maintenant();
      const id = crypto.randomUUID();
      const nouvel: Utilisateur = { id, createdAt: date, updatedAt: date, ownerId: id, email: null };
      await db.utilisateurs.add(nouvel);
      return nouvel;
    });
    return proprietaire;
  };

  function repo<T extends Entite>(table: Table<T, string>, collection: Collection): Repo<T> {
    return {
      lister: () => table.toArray(),
      obtenir: (id: Id) => table.get(id),
      trouver: (champ, valeur) => table.filter((o) => o[champ] === valeur).toArray(),
      async creer(donnees: Nouveau<T>) {
        const date = maintenant();
        const { id: ownerId } = await obtenirProprietaire();
        const objet = { ...donnees, id: crypto.randomUUID(), createdAt: date, updatedAt: date, ownerId } as T;
        await table.add(objet);
        signaler(collection);
        return objet;
      },
      async modifier(id: Id, modifications: Modification<T>) {
        const actuel = await table.get(id);
        if (!actuel) throw new Error(`Introuvable : ${collection} ${id}`);
        const objet = { ...actuel, ...modifications, id, updatedAt: maintenant() } as T;
        await table.put(objet);
        signaler(collection);
        return objet;
      },
      async supprimer(id: Id) {
        await table.delete(id);
        signaler(collection);
      },
    };
  }

  return {
    utilisateurs: repo(db.utilisateurs, "utilisateurs"),
    profils: repo(db.profils, "profils"),
    parcours: repo(db.parcours, "parcours"),
    etapes: repo(db.etapes, "etapes"),
    morceaux: repo(db.morceaux, "morceaux"),
    fichiers: repo(db.fichiers, "fichiers"),
    versions: repo(db.versions, "versions"),
    notes: repo(db.notes, "notes"),
    projets: repo(db.projets, "projets"),
    taches: repo(db.taches, "taches"),
    sorties: repo(db.sorties, "sorties"),
    postsReseaux: repo(db.postsReseaux, "postsReseaux"),
    contacts: repo(db.contacts, "contacts"),
    envois: repo(db.envois, "envois"),
    modelesMail: repo(db.modelesMail, "modelesMail"),
    boards: repo(db.boards, "boards"),
    blocs: repo(db.blocs, "blocs"),
    liens: repo(db.liens, "liens"),
    connexions: repo(db.connexions, "connexions"),

    proprietaire: obtenirProprietaire,
    abonner(ecouteur) {
      ecouteurs.add(ecouteur);
      return () => ecouteurs.delete(ecouteur);
    },
    async toutEffacer() {
      await db.transaction("rw", db.tables, async () => {
        await Promise.all(db.tables.map((t) => t.clear()));
      });
      proprietaire = null;
      for (const table of db.tables) signaler(table.name as Collection);
    },
  };
}
