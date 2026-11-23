/* Spotify for Artists : stats de streaming, disponibles après une première
   sortie. Simulé pour l’instant, sans aucun faux chiffre. */

import { depots } from "@/data";
import type { IntegrationReseau } from "../types";
import { connexionSimulee } from "../simulee";

export interface SpotifyIntegration extends IntegrationReseau {
  /** Faux tant qu’aucun morceau n’a le statut Sorti. */
  estDisponible(): Promise<boolean>;
}

export const spotifySimule: SpotifyIntegration = {
  ...connexionSimulee("spotify", "Spotify for Artists"),
  async estDisponible() {
    return (await depots.morceaux.trouver("statut", "sorti")).length > 0;
  },
  async stats() {
    return null;
  },
};
