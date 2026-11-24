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
  // Distributeur déjà choisi : l’étape « Choisir un distributeur » est validée d’office.
  const dejaFaite = (cle: string) => cle === "distributeur" && reponses.distributeur === "oui";
  await Promise.all(
    etapes.map((cle, i) =>
      depots.etapes.creer({
        parcoursId: parcours.id,
        cle,
        ordre: i + 1,
        statut: dejaFaite(cle) ? "validee" : "a-faire",
        morceauId: null,
        valideeAt: dejaFaite(cle) ? new Date().toISOString() : null,
      }),
    ),
  );
  await depots.profils.creer({ ...reponses, niveau: 1, onboardingTermineAt: new Date().toISOString() });
  await recalculer(parcours.id);
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

/** Une seule étape en cours : la première non validée. Le niveau suit.
    Les numéros sont remis à 1, 2, 3… dans l’ordre. */
async function recalculer(parcoursId: string) {
  const etapes = (await depots.etapes.trouver("parcoursId", parcoursId)).sort((a, b) => a.ordre - b.ordre);
  for (const [i, e] of etapes.entries()) {
    if (e.ordre !== i + 1) {
      await depots.etapes.modifier(e.id, { ordre: i + 1 });
      e.ordre = i + 1;
    }
  }
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

/* ---------- Parcours sur mesure ---------- */

export function renommerParcours(id: string, titre: string) {
  return depots.parcours.modifier(id, { titre: titre.trim() });
}

export function modifierEtape(id: string, modifs: { titrePerso?: string | null; explicationPerso?: string | null }) {
  return depots.etapes.modifier(id, modifs);
}

export async function deplacerEtape(etape: Etape, sens: -1 | 1) {
  const etapes = (await depots.etapes.trouver("parcoursId", etape.parcoursId)).sort((a, b) => a.ordre - b.ordre);
  const i = etapes.findIndex((e) => e.id === etape.id);
  const voisine = etapes[i + sens];
  if (!voisine) return;
  await depots.etapes.modifier(etape.id, { ordre: voisine.ordre });
  await depots.etapes.modifier(voisine.id, { ordre: etape.ordre });
  await recalculer(etape.parcoursId);
}

export async function retirerEtape(etape: Etape) {
  await depots.etapes.supprimer(etape.id);
  await recalculer(etape.parcoursId);
}

/** Ajoute une étape à la fin : proposée (clé du contenu) ou écrite à la main (« perso »). */
export async function ajouterEtape(parcoursId: string, cle: string, titrePerso: string | null = null) {
  const etapes = await depots.etapes.trouver("parcoursId", parcoursId);
  const e = await depots.etapes.creer({
    parcoursId,
    cle,
    ordre: Math.max(0, ...etapes.map((x) => x.ordre)) + 1,
    statut: "a-faire",
    morceauId: etapes[0]?.morceauId ?? null,
    valideeAt: null,
    titrePerso,
    explicationPerso: null,
  });
  await recalculer(parcoursId);
  return e;
}

/** Revient au parcours proposé à partir des réponses au questionnaire.
    Le son du parcours est gardé. */
export async function revenirAuParcoursPropose() {
  const [profil] = await depots.profils.lister();
  const [parcours] = await depots.parcours.lister();
  if (!profil || !parcours) return;
  const anciennes = await depots.etapes.trouver("parcoursId", parcours.id);
  const morceauId = anciennes[0]?.morceauId ?? null;
  for (const e of anciennes) await depots.etapes.supprimer(e.id);
  const { titre, etapes } = genererParcours(profil.dejaPublie);
  await depots.parcours.modifier(parcours.id, { titre });
  const dejaFaite = (cle: string) => cle === "distributeur" && profil.distributeur === "oui";
  for (const [i, cle] of etapes.entries())
    await depots.etapes.creer({
      parcoursId: parcours.id,
      cle,
      ordre: i + 1,
      statut: dejaFaite(cle) ? "validee" : "a-faire",
      morceauId,
      valideeAt: dejaFaite(cle) ? new Date().toISOString() : null,
    });
  await recalculer(parcours.id);
}
