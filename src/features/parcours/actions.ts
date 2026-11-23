/* Écritures liées au profil et au parcours, toujours via les repositories. */

import { depots } from "@/data";
import type { Etape, Nouveau, Profil } from "@/types";
import { genererParcours, niveauDepuis } from "./regles";

export type ReponsesOnboarding = Omit<Nouveau<Profil>, "niveau" | "onboardingTermineAt">;

/** Fin du questionnaire : crée le profil, le parcours et ses étapes. */
export async function terminerOnboarding(reponses: ReponsesOnboarding) {
  const { cas, titre, etapes } = genererParcours(reponses.dejaPublie);

  // Refaire le questionnaire remplace l’ancien profil et l’ancien parcours.
  for (const p of await depots.profils.lister()) await depots.profils.supprimer(p.id);
  for (const e of await depots.etapes.lister()) await depots.etapes.supprimer(e.id);
  for (const p of await depots.parcours.lister()) await depots.parcours.supprimer(p.id);

  const parcours = await depots.parcours.creer({ cas, titre });
  await Promise.all(
    etapes.map((cle, i) =>
      depots.etapes.creer({
        parcoursId: parcours.id,
        cle,
        ordre: i + 1,
        statut: i === 0 ? "en-cours" : "a-faire",
        morceauId: null,
        valideeAt: null,
      }),
    ),
  );
  await depots.profils.creer({ ...reponses, niveau: 1, onboardingTermineAt: new Date().toISOString() });
}

/** Valide une étape : la suivante passe en cours, le niveau monte. */
export async function validerEtape(etape: Etape) {
  await depots.etapes.modifier(etape.id, { statut: "validee", valideeAt: new Date().toISOString() });
  await recalculer(etape.parcoursId);
}

/** Annule la validation d’une étape (clic par erreur). */
export async function rouvrirEtape(etape: Etape) {
  await depots.etapes.modifier(etape.id, { statut: "a-faire", valideeAt: null });
  await recalculer(etape.parcoursId);
}

/** Une seule étape en cours : la première non validée. Le niveau suit. */
async function recalculer(parcoursId: string) {
  const etapes = (await depots.etapes.trouver("parcoursId", parcoursId)).sort((a, b) => a.ordre - b.ordre);
  const premiere = etapes.find((e) => e.statut !== "validee");
  for (const e of etapes) {
    if (e.statut === "validee") continue;
    const statut = e.id === premiere?.id ? "en-cours" : "a-faire";
    if (e.statut !== statut) await depots.etapes.modifier(e.id, { statut });
  }
  const [profil] = await depots.profils.lister();
  if (profil) await depots.profils.modifier(profil.id, { niveau: niveauDepuis(etapes) });
}

/** Lecture groupée pour l’Accueil et l’écran Parcours. */
export async function lireParcours() {
  const [profil] = await depots.profils.lister();
  const [parcours] = await depots.parcours.lister();
  const etapes = parcours
    ? (await depots.etapes.trouver("parcoursId", parcours.id)).sort((a, b) => a.ordre - b.ordre)
    : [];
  return { profil, parcours, etapes, enCours: etapes.find((e) => e.statut === "en-cours") };
}

/** Le son que l’artiste sort avec ce parcours : relié à toutes les étapes. */
export async function definirSonDuParcours(morceauId: string | null) {
  const [parcours] = await depots.parcours.lister();
  if (!parcours) return;
  for (const e of await depots.etapes.trouver("parcoursId", parcours.id)) {
    if (e.morceauId !== morceauId) await depots.etapes.modifier(e.id, { morceauId });
  }
}
