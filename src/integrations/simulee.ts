/* Base des adaptateurs simulés : l’état « connecté » est enregistré via les
   repositories, rien d’autre n’est inventé. */

import { depots } from "@/data";
import type { Service } from "@/types";
import type { Integration } from "./types";

export function connexionSimulee(service: Service, nom: string): Integration {
  const trouver = () => depots.connexions.trouver("service", service);
  return {
    service,
    nom,
    simulee: true,
    async estConnectee() {
      return (await trouver()).length > 0;
    },
    async connecter() {
      if ((await trouver()).length > 0) return;
      await depots.connexions.creer({ service, etat: "simulee", connecteeAt: new Date().toISOString() });
    },
    async deconnecter() {
      for (const c of await trouver()) await depots.connexions.supprimer(c.id);
    },
  };
}
