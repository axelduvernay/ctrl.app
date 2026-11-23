/* TikTok : stats du compte. Simulé pour l’instant, sans aucun faux chiffre. */

import type { IntegrationReseau } from "../types";
import { connexionSimulee } from "../simulee";

export type TikTokIntegration = IntegrationReseau;

export const tiktokSimule: TikTokIntegration = {
  ...connexionSimulee("tiktok", "TikTok"),
  async stats() {
    return null;
  },
};
