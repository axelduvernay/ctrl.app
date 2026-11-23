/* Écritures de l’onglet Musique, toujours via les repositories. */

import { depots } from "@/data";
import type { Id, Modification, Morceau, StatutMorceau, TypeNote, TypeProjet } from "@/types";

/* ---------- Morceaux ---------- */

export function creerMorceau(titre: string, statut: StatutMorceau) {
  return depots.morceaux.creer({
    titre: titre.trim(),
    statut,
    bpm: null,
    tonalite: null,
    projetId: null,
    coverFichierId: null,
    versionValideeId: null,
  });
}

export function modifierMorceau(id: Id, modifications: Modification<Morceau>) {
  return depots.morceaux.modifier(id, modifications);
}

/** Supprime le morceau et tout ce qui lui appartient (versions, fichiers,
    notes, cover), et le retire de son projet. */
export async function supprimerMorceau(morceau: Morceau) {
  for (const v of await depots.versions.trouver("morceauId", morceau.id)) {
    await depots.fichiers.supprimer(v.fichierId);
    await depots.versions.supprimer(v.id);
  }
  for (const n of await depots.notes.trouver("morceauId", morceau.id)) await depots.notes.supprimer(n.id);
  if (morceau.coverFichierId) await depots.fichiers.supprimer(morceau.coverFichierId);
  if (morceau.projetId) await retirerDuProjet(morceau.projetId, morceau.id);
  await depots.morceaux.supprimer(morceau.id);
}

/* ---------- Versions ---------- */

/** Lit la durée d’un fichier audio (null si le navigateur ne sait pas la lire). */
function lireDuree(fichier: File): Promise<number | null> {
  return new Promise((resoudre) => {
    const url = URL.createObjectURL(fichier);
    const a = new Audio();
    const fin = (d: number | null) => {
      URL.revokeObjectURL(url);
      resoudre(d);
    };
    a.preload = "metadata";
    a.onloadedmetadata = () => fin(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => fin(null);
    a.src = url;
  });
}

export function estAudio(fichier: File) {
  return fichier.type.startsWith("audio/") || /\.(wav|mp3|m4a|aiff?|flac|ogg|aac)$/i.test(fichier.name);
}

/** Ajoute une version : le numéro suit le dernier. */
export async function importerVersion(morceauId: Id, fichier: File) {
  const existantes = await depots.versions.trouver("morceauId", morceauId);
  const numero = Math.max(0, ...existantes.map((v) => v.numero)) + 1;
  const stocke = await depots.fichiers.creer({
    nom: fichier.name,
    type: fichier.type || "audio/mpeg",
    taille: fichier.size,
    blob: fichier,
    duree: await lireDuree(fichier),
  });
  const nom = fichier.name.replace(/\.[^.]+$/, "");
  await depots.versions.creer({ morceauId, numero, nom, fichierId: stocke.id, commentaire: "" });
  await depots.morceaux.modifier(morceauId, {}); // « modifié aujourd’hui »
}

/** La version validée s’affiche en tête de la fiche. Re-cliquer l’annule. */
export async function basculerVersionValidee(morceau: Morceau, versionId: Id) {
  await depots.morceaux.modifier(morceau.id, {
    versionValideeId: morceau.versionValideeId === versionId ? null : versionId,
  });
}

export async function supprimerVersion(morceau: Morceau, versionId: Id) {
  const v = await depots.versions.obtenir(versionId);
  if (!v) return;
  await depots.fichiers.supprimer(v.fichierId);
  await depots.versions.supprimer(v.id);
  if (morceau.versionValideeId === versionId) await depots.morceaux.modifier(morceau.id, { versionValideeId: null });
}

/* ---------- Cover ---------- */

export async function definirCover(morceau: Morceau, image: File) {
  const stocke = await depots.fichiers.creer({
    nom: image.name,
    type: image.type,
    taille: image.size,
    blob: image,
    duree: null,
  });
  if (morceau.coverFichierId) await depots.fichiers.supprimer(morceau.coverFichierId);
  await depots.morceaux.modifier(morceau.id, { coverFichierId: stocke.id });
}

export async function retirerCover(morceau: Morceau) {
  if (!morceau.coverFichierId) return;
  await depots.fichiers.supprimer(morceau.coverFichierId);
  await depots.morceaux.modifier(morceau.id, { coverFichierId: null });
}

/* ---------- Notes ---------- */

export function ajouterNote(morceauId: Id, type: TypeNote) {
  return depots.notes.creer({ morceauId, type, contenu: "" });
}

export function modifierNote(id: Id, contenu: string) {
  return depots.notes.modifier(id, { contenu });
}

export function supprimerNote(id: Id) {
  return depots.notes.supprimer(id);
}

/* ---------- Projets ---------- */

export function creerProjet(titre: string, type: TypeProjet) {
  return depots.projets.creer({ titre: titre.trim(), type, morceauIds: [] });
}

/** Un morceau appartient à un seul projet : le projet garde l’ordre,
    le morceau garde la référence. Les deux restent d’accord. */
export async function definirProjet(morceauId: Id, projetId: Id | null) {
  const morceau = await depots.morceaux.obtenir(morceauId);
  if (!morceau || morceau.projetId === projetId) return;
  if (morceau.projetId) await retirerDuProjet(morceau.projetId, morceauId);
  if (projetId) {
    const projet = await depots.projets.obtenir(projetId);
    if (projet) await depots.projets.modifier(projetId, { morceauIds: [...projet.morceauIds, morceauId] });
  }
  await depots.morceaux.modifier(morceauId, { projetId });
}

async function retirerDuProjet(projetId: Id, morceauId: Id) {
  const projet = await depots.projets.obtenir(projetId);
  if (projet) await depots.projets.modifier(projetId, { morceauIds: projet.morceauIds.filter((id) => id !== morceauId) });
}

export async function deplacerDansProjet(projetId: Id, index: number, sens: -1 | 1) {
  const projet = await depots.projets.obtenir(projetId);
  if (!projet) return;
  const ids = [...projet.morceauIds];
  const cible = index + sens;
  if (cible < 0 || cible >= ids.length) return;
  [ids[index], ids[cible]] = [ids[cible]!, ids[index]!];
  await depots.projets.modifier(projetId, { morceauIds: ids });
}

/** Supprime le projet ; ses morceaux restent dans le catalogue. */
export async function supprimerProjet(projetId: Id) {
  const projet = await depots.projets.obtenir(projetId);
  if (!projet) return;
  for (const id of projet.morceauIds) await depots.morceaux.modifier(id, { projetId: null });
  await depots.projets.supprimer(projetId);
}
