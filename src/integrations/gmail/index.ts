/* Gmail : envoi des mails depuis le Réseau. Simulé pour l’instant :
   l’envoi est enregistré dans l’historique avec la mention « simulé ». */

import type { IntegrationMail } from "../types";
import { connexionSimulee } from "../simulee";

export type GmailIntegration = IntegrationMail;

export const gmailSimule: GmailIntegration = {
  ...connexionSimulee("gmail", "Gmail"),
  async envoyer() {
    return { simule: true, envoyeAt: new Date().toISOString() };
  },
};
