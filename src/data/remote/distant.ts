/* Ce que la synchronisation attend d’un serveur. L’implémentation réelle est
   Supabase (supabase.ts) ; les tests en fournissent une fausse. */

export interface LigneDistante {
  owner_id?: string;
  id: string;
  collection: string;
  donnees: Record<string, unknown> | null;
  supprime: boolean;
  modifie_le: string;
  recu_le?: string;
}

export interface Session {
  uid: string;
  email: string;
}

export interface Distant {
  session(): Promise<Session | null>;
  surSession(rappel: (s: Session | null) => void): void;
  envoyerCode(email: string): Promise<void>;
  verifierCode(email: string, code: string): Promise<Session>;
  deconnecter(): Promise<void>;
  /** Écrit des lignes (création, modification ou suppression). */
  envoyer(lignes: LigneDistante[]): Promise<void>;
  /** Lignes reçues par le serveur après cette date (toutes si null). */
  recevoir(depuis: string | null): Promise<LigneDistante[]>;
  compter(collection: string): Promise<number>;
  deposerFichier(chemin: string, blob: Blob): Promise<void>;
  lireFichier(chemin: string): Promise<Blob>;
}
