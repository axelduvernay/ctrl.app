/* Interfaces des repositories.
   Les écrans ne connaissent que ces interfaces : l’implémentation locale
   (IndexedDB) peut être remplacée par Supabase sans toucher aux écrans. */

import type {
  Entite,
  Id,
  Nouveau,
  Modification,
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
  Dossier,
  Evenement,
} from "@/types";

export interface Repo<T extends Entite> {
  lister(): Promise<T[]>;
  obtenir(id: Id): Promise<T | undefined>;
  /** Tous les éléments dont le champ vaut exactement la valeur donnée. */
  trouver<K extends keyof T>(champ: K, valeur: T[K]): Promise<T[]>;
  creer(donnees: Nouveau<T>): Promise<T>;
  modifier(id: Id, modifications: Modification<T>): Promise<T>;
  /** Modification calculée à partir de la version la plus récente, sans
      risque d’écraser une écriture faite juste avant (listes, objets imbriqués). */
  transformer(id: Id, calcul: (actuel: T) => Modification<T>): Promise<T>;
  supprimer(id: Id): Promise<void>;
  /** Réécrit un objet complet, tel quel (annuler / rétablir). */
  remplacer(objet: T): Promise<void>;
}

export type UtilisateursRepo = Repo<Utilisateur>;
export type ProfilsRepo = Repo<Profil>;
export type ParcoursRepo = Repo<Parcours>;
export type EtapesRepo = Repo<Etape>;
export type MorceauxRepo = Repo<Morceau>;
export type FichiersRepo = Repo<Fichier>;
export type VersionsRepo = Repo<Version>;
export type NotesRepo = Repo<Note>;
export type ProjetsRepo = Repo<Projet>;
export type TachesRepo = Repo<Tache>;
export type SortiesRepo = Repo<Sortie>;
export type PostsReseauxRepo = Repo<PostReseau>;
export type ContactsRepo = Repo<Contact>;
export type EnvoisRepo = Repo<Envoi>;
export type ModelesMailRepo = Repo<ModeleMail>;
export type BoardsRepo = Repo<Board>;
export type BlocsRepo = Repo<Bloc>;
export type LiensRepo = Repo<Lien>;
export type ConnexionsRepo = Repo<Connexion>;
export type DossiersRepo = Repo<Dossier>;
export type EvenementsRepo = Repo<Evenement>;

/** Nom de chaque collection, utilisé pour signaler les changements. */
export type Collection = keyof Omit<Depots, "abonner" | "toutEffacer" | "proprietaire" | "exporter" | "importer">;

export interface Depots {
  utilisateurs: UtilisateursRepo;
  profils: ProfilsRepo;
  parcours: ParcoursRepo;
  etapes: EtapesRepo;
  morceaux: MorceauxRepo;
  fichiers: FichiersRepo;
  versions: VersionsRepo;
  notes: NotesRepo;
  projets: ProjetsRepo;
  taches: TachesRepo;
  sorties: SortiesRepo;
  postsReseaux: PostsReseauxRepo;
  contacts: ContactsRepo;
  envois: EnvoisRepo;
  modelesMail: ModelesMailRepo;
  boards: BoardsRepo;
  blocs: BlocsRepo;
  liens: LiensRepo;
  connexions: ConnexionsRepo;
  dossiers: DossiersRepo;
  evenements: EvenementsRepo;

  /** Utilisateur à qui appartiennent les données (un seul, en local). */
  proprietaire(): Promise<Utilisateur>;
  /** Prévient à chaque écriture ; renvoie la fonction de désabonnement. */
  abonner(ecouteur: (collection: Collection) => void): () => void;
  /** Efface tout : retour à l’onboarding (« Réinitialiser l’app »). */
  toutEffacer(): Promise<void>;
  /** Toutes les données, fichiers audio et images compris, dans un fichier .json. */
  exporter(): Promise<Blob>;
  /** Remplace toutes les données par celles d’un export. Lève une erreur si le fichier n’est pas un export ctrl.app. */
  importer(fichier: Blob): Promise<void>;
}
