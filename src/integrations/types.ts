/* Contrats communs des intégrations.
   Tant que les vraies API ne sont pas branchées, les adaptateurs sont
   simulés : ils le disent (simulee = true) et ne renvoient aucun faux chiffre. */

import type { DateIso, Service } from "@/types";

export interface Integration {
  service: Service;
  nom: string;
  /** Vrai pour un adaptateur simulé : l’interface affiche « connexion simulée ». */
  simulee: boolean;
  estConnectee(): Promise<boolean>;
  connecter(): Promise<void>;
  deconnecter(): Promise<void>;
}

export interface StatsReseau {
  abonnes: number;
  evolutionSemaine: number | null;
}

export interface IntegrationReseau extends Integration {
  /** Null quand aucune donnée réelle n’est disponible (toujours le cas en simulé). */
  stats(): Promise<StatsReseau | null>;
}

export interface MailAEnvoyer {
  a: string;
  objet: string;
  corps: string;
}

export interface ResultatEnvoi {
  simule: boolean;
  envoyeAt: DateIso;
}

export interface IntegrationMail extends Integration {
  envoyer(mail: MailAEnvoyer): Promise<ResultatEnvoi>;
}
