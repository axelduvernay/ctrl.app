/* Instagram : stats du compte. Simulé pour l’instant, sans aucun faux chiffre. */

import type { IntegrationReseau } from "../types";
import { connexionSimulee } from "../simulee";

export type InstagramIntegration = IntegrationReseau;

export const instagramSimule: InstagramIntegration = {
  ...connexionSimulee("instagram", "Instagram"),
  async stats() {
    return null;
  },
};
