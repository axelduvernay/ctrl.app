/* Implémentation IndexedDB (via Dexie) des repositories.
   Chaque écriture est aussi notée dans un journal (_attente) : c’est ce que
   la synchronisation enverra quand un compte est connecté. */

import type { Table } from "dexie";
import type { Entite, Id, Nouveau, Modification, Utilisateur } from "@/types";
import type { Collection, Depots, Repo } from "@/data/repositories";
import { BaseLocale } from "./db";

type Ecouteur = (collection: Collection) => void;

const maintenant = () => new Date().toISOString();
const FORMAT_EXPORT = "ctrl.app";
const estInterne = (nom: string) => nom.startsWith("_");

function versDataUrl(blob: Blob): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(lecteur.result as string);
    lecteur.onerror = () => rejeter(lecteur.error);
    lecteur.readAsDataURL(blob);
  });
}

/** Ce que seule la synchronisation utilise (jamais les écrans). */
export interface MoteurLocal {
  collections(): Collection[];
  attente(): Promise<{ cle: string; collection: Collection; id: Id; supprime: boolean; at: string }[]>;
  retirerAttente(cles: string[]): Promise<void>;
  lire(collection: Collection, id: Id): Promise<(Entite & Record<string, unknown>) | undefined>;
  /** Écrit un objet reçu d’un autre appareil, sans le remettre dans le journal. */
  ecrireRecu(collection: Collection, objet: Entite & Record<string, unknown>): Promise<void>;
  supprimerRecu(collection: Collection, id: Id): Promise<void>;
  /** Tout remettre dans le journal (première connexion d’un appareil). */
  toutMarquer(): Promise<void>;
  /** Les données de cet appareil passent au compte connecté. */
  changerProprietaire(uid: Id, email: string): Promise<void>;
  effacerSansJournal(collections: Collection[], ids?: Set<Id>): Promise<void>;
  meta<T>(cle: string): Promise<T | undefined>;
  ecrireMeta(cle: string, valeur: unknown): Promise<void>;
  signaler(collections: Collection[]): void;
}

export function creerDepotsLocaux(): { depots: Depots; moteur: MoteurLocal } {
  const db = new BaseLocale();
  const ecouteurs = new Set<Ecouteur>();
  const signaler = (collection: Collection) => ecouteurs.forEach((e) => e(collection));
  const tables = () => db.tables.filter((t) => !estInterne(t.name));
  const table = (c: Collection) => db.table(c) as Table<Entite & Record<string, unknown>, string>;

  const noter = (collection: Collection, id: Id, supprime = false) =>
    db._attente.put({ cle: `${collection}:${id}`, collection, id, supprime, at: maintenant() });

  // Un seul utilisateur local, créé au premier lancement.
  let proprietaire: Promise<Utilisateur> | null = null;
  const obtenirProprietaire = () => {
    proprietaire ??= db.transaction("rw", db.utilisateurs, db._attente, async () => {
      const existant = await db.utilisateurs.toCollection().first();
      if (existant) return existant;
      const date = maintenant();
      const id = crypto.randomUUID();
      const nouvel: Utilisateur = { id, createdAt: date, updatedAt: date, ownerId: id, email: null };
      await db.utilisateurs.add(nouvel);
      await noter("utilisateurs", id);
      return nouvel;
    });
    return proprietaire;
  };

  function repo<T extends Entite>(t: Table<T, string>, collection: Collection): Repo<T> {
    return {
      lister: () => t.toArray(),
      obtenir: (id: Id) => t.get(id),
      trouver: (champ, valeur) => t.filter((o) => o[champ] === valeur).toArray(),
      async creer(donnees: Nouveau<T>) {
        const date = maintenant();
        const { id: ownerId } = await obtenirProprietaire();
        const objet = { ...donnees, id: crypto.randomUUID(), createdAt: date, updatedAt: date, ownerId } as T;
        await db.transaction("rw", t, db._attente, async () => {
          await t.add(objet);
          await noter(collection, objet.id);
        });
        signaler(collection);
        return objet;
      },
      modifier(id: Id, modifications: Modification<T>) {
        return this.transformer(id, () => modifications);
      },
      async transformer(id: Id, calcul: (actuel: T) => Modification<T>) {
        // Lecture et écriture dans la même transaction : deux modifications
        // rapprochées (ex. BPM puis tonalité) ne s’écrasent pas.
        const objet = await db.transaction("rw", t, db._attente, async () => {
          const actuel = await t.get(id);
          if (!actuel) throw new Error(`Introuvable : ${collection} ${id}`);
          const nouvel = { ...actuel, ...calcul(actuel), id, updatedAt: maintenant() } as T;
          await t.put(nouvel);
          await noter(collection, id);
          return nouvel;
        });
        signaler(collection);
        return objet;
      },
      async supprimer(id: Id) {
        await db.transaction("rw", t, db._attente, async () => {
          await t.delete(id);
          await noter(collection, id, true);
        });
        signaler(collection);
      },
      async remplacer(objet: T) {
        const nouvel = { ...objet, updatedAt: maintenant() };
        await db.transaction("rw", t, db._attente, async () => {
          await t.put(nouvel);
          await noter(collection, objet.id);
        });
        signaler(collection);
      },
    };
  }

  const depots: Depots = {
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
    async exporter() {
      const contenu: Record<string, unknown[]> = {};
      for (const t of tables()) {
        const lignes = await t.toArray();
        contenu[t.name] = await Promise.all(lignes.map(async (l) => (l.blob instanceof Blob ? { ...l, blob: await versDataUrl(l.blob) } : l)));
      }
      const fichier = { format: FORMAT_EXPORT, version: 1, exporteLe: maintenant(), tables: contenu };
      return new Blob([JSON.stringify(fichier)], { type: "application/json" });
    },
    async importer(fichier: Blob) {
      let contenu: { format?: string; tables?: Record<string, Record<string, unknown>[]> };
      try {
        contenu = JSON.parse(await fichier.text());
      } catch {
        throw new Error("Ce fichier n’est pas un export ctrl.app.");
      }
      if (contenu.format !== FORMAT_EXPORT || !contenu.tables) throw new Error("Ce fichier n’est pas un export ctrl.app.");
      const source = contenu.tables;
      const lignes: Record<string, unknown[]> = {};
      for (const t of tables()) {
        lignes[t.name] = await Promise.all(
          (source[t.name] ?? []).map(async (l) => (typeof l.blob === "string" ? { ...l, blob: await (await fetch(l.blob)).blob() } : l)),
        );
      }
      await db.transaction("rw", db.tables, async () => {
        for (const t of tables()) {
          for (const ancien of await t.toCollection().primaryKeys()) await noter(t.name as Collection, String(ancien), true);
          await t.clear();
          await t.bulkAdd(lignes[t.name] ?? []);
          for (const l of lignes[t.name] ?? []) await noter(t.name as Collection, (l as Entite).id);
        }
      });
      proprietaire = null;
      for (const t of tables()) signaler(t.name as Collection);
    },
    async toutEffacer() {
      await db.transaction("rw", db.tables, async () => {
        await Promise.all(db.tables.map((t) => t.clear()));
      });
      proprietaire = null;
      for (const t of tables()) signaler(t.name as Collection);
    },
  };

  const moteur: MoteurLocal = {
    collections: () => tables().map((t) => t.name as Collection),
    attente: () => db._attente.toArray() as ReturnType<MoteurLocal["attente"]>,
    async retirerAttente(cles) {
      await db._attente.bulkDelete(cles);
    },
    lire: (c, id) => table(c).get(id),
    async ecrireRecu(c, objet) {
      await table(c).put(objet);
    },
    async supprimerRecu(c, id) {
      await table(c).delete(id);
    },
    async toutMarquer() {
      await db.transaction("rw", db.tables, async () => {
        for (const t of tables()) for (const id of await t.toCollection().primaryKeys()) await noter(t.name as Collection, String(id));
      });
    },
    async changerProprietaire(uid, email) {
      await db.transaction("rw", db.tables, async () => {
        for (const t of tables()) {
          if (t.name === "utilisateurs") continue;
          await t.toCollection().modify((o: Entite) => {
            o.ownerId = uid;
          });
        }
        const date = maintenant();
        for (const ancien of await db.utilisateurs.toArray()) if (ancien.id !== uid) {
          await db.utilisateurs.delete(ancien.id);
          await db._attente.delete(`utilisateurs:${ancien.id}`);
        }
        const actuel = await db.utilisateurs.get(uid);
        await db.utilisateurs.put({ id: uid, ownerId: uid, email, createdAt: actuel?.createdAt ?? date, updatedAt: date });
      });
      proprietaire = null;
    },
    async effacerSansJournal(collections, ids) {
      await db.transaction("rw", db.tables, async () => {
        for (const c of collections) {
          if (ids) await table(c).bulkDelete([...ids]);
          else await table(c).clear();
          for (const k of await db._attente.where("cle").startsWith(`${c}:`).primaryKeys())
            if (!ids || ids.has(String(k).slice(c.length + 1))) await db._attente.delete(k);
        }
      });
    },
    async meta<T>(cle: string) {
      return (await db._meta.get(cle))?.valeur as T | undefined;
    },
    async ecrireMeta(cle, valeur) {
      await db._meta.put({ cle, valeur });
    },
    signaler(collections) {
      collections.forEach(signaler);
    },
  };

  return { depots, moteur };
}
