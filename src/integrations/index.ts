/* Intégrations utilisées par l’app. Remplacer un adaptateur simulé par le
   vrai se fait ici, sans toucher aux écrans. */

import { gmailSimule } from "./gmail";
import { instagramSimule } from "./instagram";
import { tiktokSimule } from "./tiktok";
import { spotifySimule } from "./spotify";

export const integrations = {
  gmail: gmailSimule,
  instagram: instagramSimule,
  tiktok: tiktokSimule,
  spotify: spotifySimule,
};

export type * from "./types";
