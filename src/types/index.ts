/* Modèle de données de ctrl.app : la seule source de vérité.
   Chaque entité porte id, createdAt, updatedAt et ownerId pour que les
   comptes et la synchronisation (Supabase) se branchent sans migration. */

export type Id = string;
/** Date ISO 8601 (ex. « 2026-11-23T14:02:00.000Z »). */
export type DateIso = string;
/** Jour sans heure (ex. « 2026-12-04 »). */
export type Jour = string;

export interface Entite {
  id: Id;
  createdAt: DateIso;
  updatedAt: DateIso;
  ownerId: Id;
}

/** Champs gérés par les repositories, jamais saisis par les écrans. */
export type ChampsSysteme = keyof Entite;
export type Nouveau<T extends Entite> = Omit<T, ChampsSysteme>;
export type Modification<T extends Entite> = Partial<Nouveau<T>>;

/* ---------- Utilisateur et profil ---------- */

export interface Utilisateur extends Entite {
  /** Renseigné quand le compte est créé (connexion par mail, plus tard). */
  email: string | null;
}

export type Role = "artiste" | "beatmaker" | "les-deux";
export type DejaPublie = "nulle-part" | "soundcloud-youtube" | "streaming";
export type Distributeur = "oui" | "non" | "ne-sait-pas";
export type Objectif =
  | "sortir-sur-plateformes"
  | "grandir-reseaux"
  | "sortir-regulierement"
  | "developper-reseau";

export interface ReseauSocial {
  plateforme: string;
  abonnes: number | null;
}

export interface Profil extends Entite {
  nomArtiste: string;
  role: Role;
  sonsEnStock: number;
  dejaPublie: DejaPublie;
  distributeur: Distributeur;
  reseaux: ReseauSocial[];
  objectifs: Objectif[];
  /** Niveau qui évolue quand une étape du parcours est validée. */
  niveau: number;
  onboardingTermineAt: DateIso | null;
}

/* ---------- Parcours ---------- */

/** A : jamais publié en streaming. B : publie déjà. */
export type CasParcours = "A" | "B";
export type StatutEtape = "a-faire" | "en-cours" | "validee";

export interface Parcours extends Entite {
  cas: CasParcours;
  titre: string;
}

export interface Etape extends Entite {
  parcoursId: Id;
  /** Clé du contenu dans src/content/parcours.ts. */
  cle: string;
  ordre: number;
  statut: StatutEtape;
  /** Morceau concerné par l’étape (ex. « Finaliser le mix » d’Après minuit). */
  morceauId: Id | null;
  valideeAt: DateIso | null;
  /** Textes réécrits par l’artiste (sinon, ceux de src/content/parcours.ts).
      Une étape ajoutée à la main a la clé « perso ». */
  titrePerso?: string | null;
  explicationPerso?: string | null;
  /** Date objectif fixée par l’artiste pour finir l’étape. */
  objectif?: Jour | null;
}

/* ---------- Musique ---------- */

export type StatutMorceau = "idee" | "maquette" | "finition" | "pret" | "sorti";

export interface Morceau extends Entite {
  titre: string;
  statut: StatutMorceau;
  bpm: number | null;
  tonalite: string | null;
  /** Ancien lien vers un projet (un morceau peut maintenant être dans
      plusieurs projets : c’est Projet.morceauIds qui fait foi). */
  projetId: Id | null;
  /** Dossier de la librairie (facultatif). */
  dossierId?: Id | null;
  /** Vrai quand BPM et tonalité viennent de l’analyse du son (pas saisis). */
  analyseAuto?: boolean;
  /** Image importée par l’utilisateur. */
  coverFichierId: Id | null;
  /** Version validée, affichée en tête. */
  versionValideeId: Id | null;
}

/** Fichier importé (audio, cover, mémo vocal), stocké dans IndexedDB. */
export interface Fichier extends Entite {
  nom: string;
  type: string;
  taille: number;
  blob: Blob;
  /** Durée en secondes pour l’audio. */
  duree: number | null;
  /** Forme d’onde : niveaux entre 0 et 1, calculés à l’import. */
  pics?: number[] | null;
}

export interface Version extends Entite {
  morceauId: Id;
  numero: number;
  nom: string;
  fichierId: Id;
  commentaire: string;
}

export type TypeNote = "paroles" | "idee" | "retour" | "mix" | "libre";

export interface Note extends Entite {
  /** Null pour une note capturée sans morceau. */
  morceauId: Id | null;
  type: TypeNote;
  contenu: string;
  /** Mémo vocal enregistré dans le navigateur (facultatif). */
  fichierId?: Id | null;
}

export type TypeProjet = "ep" | "album" | "mixtape" | "tracklist";

export interface Projet extends Entite {
  titre: string;
  type: TypeProjet;
  /** Liste ordonnée de morceaux (un morceau peut être dans plusieurs projets). */
  morceauIds: Id[];
  dossierId?: Id | null;
}

/** Dossier de la librairie : range des morceaux et des projets. */
export interface Dossier extends Entite {
  titre: string;
}

/* ---------- Calendrier ---------- */

/** Événement ajouté à la main (studio, concert, rendez-vous…). */
export interface Evenement extends Entite {
  titre: string;
  date: Jour;
  /** « 14:30 », ou null pour toute la journée. */
  heure: string | null;
  notes: string;
}

/* ---------- Tâches ---------- */

export interface Tache extends Entite {
  titre: string;
  echeance: Jour | null;
  faite: boolean;
  morceauId: Id | null;
  contactId: Id | null;
  /** Relance d’un envoi : la tâche rappelle de relancer. */
  envoiId: Id | null;
}

/* ---------- Sorties ---------- */

export type CleChecklist =
  | "cover"
  | "mix-master"
  | "distributeur"
  | "metadonnees"
  | "date"
  | "contenus-reseaux";

export interface ElementChecklist {
  cle: CleChecklist;
  fait: boolean;
}

export interface Credit {
  nom: string;
  role: string;
}

export interface Metadonnees {
  titre: string;
  artistes: string[];
  credits: Credit[];
  isrc: string;
  genre: string;
}

export interface Sortie extends Entite {
  morceauId: Id | null;
  projetId: Id | null;
  date: Jour | null;
  checklist: ElementChecklist[];
  metadonnees: Metadonnees;
}

/** Post réseaux planifié, affiché dans le calendrier avec les sorties. */
export interface PostReseau extends Entite {
  date: Jour;
  plateforme: string;
  description: string;
  sortieId: Id | null;
}

/* ---------- Réseau (CRM) ---------- */

export type RoleContact =
  | "artiste"
  | "beatmaker"
  | "inge-son"
  | "graphiste"
  | "pro"
  | "autre";

export interface Contact extends Entite {
  nom: string;
  role: RoleContact;
  email: string;
  liens: string[];
  notes: string;
  /** Morceaux échangés avec ce contact. */
  morceauIds: Id[];
}

export type StatutEnvoi = "envoye" | "ouvert" | "relance";

export interface Envoi extends Entite {
  contactId: Id;
  modeleId: Id | null;
  objet: string;
  corps: string;
  morceauIds: Id[];
  statut: StatutEnvoi;
  /** Vrai tant que Gmail est simulé : affiché « simulé » dans l’historique. */
  simule: boolean;
  envoyeAt: DateIso;
}

export interface ModeleMail extends Entite {
  titre: string;
  /** Profil pour lequel le modèle est proposé. */
  pour: Role;
  objet: string;
  corps: string;
}

/* ---------- Boards ---------- */

export interface VueBoard {
  x: number;
  y: number;
  zoom: number;
}

/** Catégorie d’un board (Idée, Question…) : renommable, recolorable.
    « cochable » ajoute une case à cocher aux blocs qui la portent. */
export interface Categorie {
  id: Id;
  nom: string;
  couleur: string;
  commande: string;
  cochable: boolean;
}

export interface Board extends Entite {
  titre: string;
  vue: VueBoard;
  /** Absent sur un board créé avant les catégories : valeurs par défaut. */
  categories?: Categorie[];
}

export type TypeBloc =
  | "note"
  | "tache"
  | "tracklist"
  | "zone"
  | "image"
  | "dessin"
  | "tableau"
  | "dossier"
  /* Nœuds liés : le même objet que dans les autres onglets. */
  | "morceau"
  | "contact";

export interface Bloc extends Entite {
  boardId: Id;
  type: TypeBloc;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  /** Zone qui contient le bloc, s’il y en a une. */
  zoneId: Id | null;
  /** Titre d’une zone ou d’une tracklist. */
  titre: string;
  /** Texte d’une note. */
  contenu: string;
  /** Objet lié : tâche, morceau ou contact. */
  refId: Id | null;
  /** Tracklist : morceaux numérotés, dans l’ordre. */
  morceauIds: Id[];
  /* Champs facultatifs (ajoutés avec le board complet). */
  categorieId?: Id | null;
  /** Case cochée (catégorie cochable). */
  fait?: boolean;
  echeance?: Jour | null;
  rappel?: DateIso | null;
  rappelVu?: boolean;
  /** Image importée. */
  fichierId?: Id | null;
  /** Dossier : fichiers rangés dans l’ordre. */
  fichierIds?: Id[];
  /** Dessin : tracé vectoriel (attribut d de SVG) et taille d’origine. */
  trace?: { d: string; w: number; h: number } | null;
  /** Tableau : lignes de cellules, la première sert d’en-tête. */
  cellules?: string[][];
  /** Zone : teinte du fond. */
  couleur?: string | null;
  /** Variante : même lignée, numéro de version. */
  variante?: { lignee: Id; numero: number } | null;
}

export interface Lien extends Entite {
  boardId: Id;
  deBlocId: Id;
  versBlocId: Id;
  /** « variante » : lien pointillé entre deux versions. */
  type?: "variante" | null;
}

/* ---------- Intégrations (simulées pour l’instant) ---------- */

export type Service = "gmail" | "instagram" | "tiktok" | "spotify";

export interface Connexion extends Entite {
  service: Service;
  /** Toujours « simulee » tant que les vraies API ne sont pas branchées. */
  etat: "simulee" | "reelle";
  connecteeAt: DateIso;
}
