/* Écritures de l’onglet Musique, toujours via les repositories. */

import { depots } from "@/data";
import { analyserAudio } from "@/lib/analyse";
import type { Id, Modification, Morceau, StatutMorceau, TypeNote, TypeProjet } from "@/types";

/* ---------- Morceaux ---------- */

/** projetId : projet où le morceau est rangé (importé dans un EP, il
    n’apparaît pas en plus comme single dans la librairie). */
export function creerMorceau(titre: string, statut: StatutMorceau, dossierId: Id | null = null, projetId: Id | null = null) {
  return depots.morceaux.creer({
    titre: titre.trim(),
    statut,
    bpm: null,
    tonalite: null,
    projetId,
    dossierId,
    analyseAuto: true,
    coverFichierId: null,
    versionValideeId: null,
  });
}

/** Nouveau single : un morceau par fichier audio, titre tiré du nom du
    fichier, son analysé (BPM, tonalité, forme d’onde). */
export async function importerSingles(fichiers: File[], dossierId: Id | null = null, statut: StatutMorceau = "maquette") {
  const crees: Morceau[] = [];
  for (const f of fichiers.filter(estAudio)) {
    const m = await creerMorceau(f.name.replace(/\.[^.]+$/, "") || "Sans titre", statut, dossierId);
    await importerVersion(m.id, f);
    crees.push(m);
  }
  return crees;
}

/** Sons importés depuis l’ordinateur directement dans un projet (EP, album,
    mixtape), dans l’ordre des noms de fichiers (« 01 … », « 02 … »). */
export async function importerDansProjet(projetId: Id, fichiers: File[]) {
  const tries = fichiers.filter(estAudio).sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
  for (const f of tries) {
    const m = await creerMorceau(f.name.replace(/\.[^.]+$/, "") || "Sans titre", "maquette", null, projetId);
    await importerVersion(m.id, f);
    await ajouterAuProjet(projetId, [m.id]);
  }
  return tries.length;
}

/** BPM ou tonalité corrigés à la main : l’analyse ne les remplace plus. */
export function corrigerAnalyse(id: Id, modifs: { bpm?: number | null; tonalite?: string | null }) {
  return depots.morceaux.modifier(id, { ...modifs, analyseAuto: false });
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
  for (const n of await depots.notes.trouver("morceauId", morceau.id)) await supprimerNote(n.id);
  if (morceau.coverFichierId) await depots.fichiers.supprimer(morceau.coverFichierId);
  for (const p of await depots.projets.lister())
    if (p.morceauIds.includes(morceau.id)) await depots.projets.transformer(p.id, (x) => ({ morceauIds: x.morceauIds.filter((id) => id !== morceau.id) }));
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

/** Ajoute une version : le numéro suit le dernier. Le son est analysé :
    forme d’onde, durée, et BPM / tonalité s’ils n’ont pas été corrigés. */
export async function importerVersion(morceauId: Id, fichier: Blob & { name?: string }, duree?: number) {
  const existantes = await depots.versions.trouver("morceauId", morceauId);
  const numero = Math.max(0, ...existantes.map((v) => v.numero)) + 1;
  const analyse = await analyserAudio(fichier);
  const nomFichier = fichier.name || `Mémo ${new Date().toLocaleString("fr-FR")}.webm`;
  const stocke = await depots.fichiers.creer({
    nom: nomFichier,
    type: fichier.type || "audio/mpeg",
    taille: fichier.size,
    blob: fichier,
    duree: duree ?? analyse?.duree ?? (fichier instanceof File ? await lireDuree(fichier) : null),
    pics: analyse?.pics ?? null,
  });
  const nom = nomFichier.replace(/\.[^.]+$/, "");
  await depots.versions.creer({ morceauId, numero, nom, fichierId: stocke.id, commentaire: "" });
  await depots.morceaux.transformer(morceauId, (m) =>
    analyse && m.analyseAuto !== false
      ? { bpm: analyse.bpm ?? m.bpm, tonalite: analyse.tonalite ?? m.tonalite, analyseAuto: true }
      : {}, // « modifié aujourd’hui »
  );
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

/** Supprime la note et son mémo vocal s’il y en a un. */
export async function supprimerNote(id: Id) {
  const n = await depots.notes.obtenir(id);
  if (n?.fichierId) await depots.fichiers.supprimer(n.fichierId);
  await depots.notes.supprimer(id);
}

/* ---------- Projets ---------- */

export function creerProjet(titre: string, type: TypeProjet, dossierId: Id | null = null) {
  return depots.projets.creer({ titre: titre.trim(), type, morceauIds: [], dossierId });
}

/** Un morceau peut être dans plusieurs projets (un single et l’EP).
    C’est la liste du projet qui fait foi. */
export async function ajouterAuProjet(projetId: Id, morceauIds: Id[]) {
  await depots.projets.transformer(projetId, (p) => ({ morceauIds: [...p.morceauIds, ...morceauIds.filter((id) => !p.morceauIds.includes(id))] }));
}

/** Retiré du projet où il était rangé, le morceau revient dans la librairie. */
export async function retirerDuProjet(projetId: Id, morceauId: Id) {
  if (await depots.projets.obtenir(projetId))
    await depots.projets.transformer(projetId, (p) => ({ morceauIds: p.morceauIds.filter((id) => id !== morceauId) }));
  const m = await depots.morceaux.obtenir(morceauId);
  if (m?.projetId === projetId) await depots.morceaux.modifier(morceauId, { projetId: null });
}

export async function deplacerDansProjet(projetId: Id, index: number, sens: -1 | 1) {
  await depots.projets.transformer(projetId, (p) => {
    const ids = [...p.morceauIds];
    const cible = index + sens;
    if (cible < 0 || cible >= ids.length) return {};
    [ids[index], ids[cible]] = [ids[cible]!, ids[index]!];
    return { morceauIds: ids };
  });
}

/** Supprime le projet ; ses morceaux restent dans la librairie. Une
    tracklist de board liée à ce projet garde ses morceaux. */
export async function supprimerProjet(projetId: Id) {
  const projet = await depots.projets.obtenir(projetId);
  if (!projet) return;
  for (const b of await depots.blocs.trouver("refId", projetId)) await depots.blocs.modifier(b.id, { refId: null, morceauIds: projet.morceauIds, titre: projet.titre });
  for (const m of await depots.morceaux.trouver("projetId", projetId)) await depots.morceaux.modifier(m.id, { projetId: null });
  await depots.projets.supprimer(projetId);
}

/* ---------- Dossiers ---------- */

export function creerDossier(titre: string) {
  return depots.dossiers.creer({ titre: titre.trim() });
}

export function renommerDossier(id: Id, titre: string) {
  return depots.dossiers.modifier(id, { titre: titre.trim() });
}

/** Range un morceau ou un projet dans un dossier (null : à la racine). */
export function ranger(element: { type: "morceau" | "projet"; id: Id }, dossierId: Id | null) {
  return element.type === "morceau" ? depots.morceaux.modifier(element.id, { dossierId }) : depots.projets.modifier(element.id, { dossierId });
}

/** Supprime le dossier ; son contenu revient à la racine de la librairie. */
export async function supprimerDossier(id: Id) {
  for (const m of await depots.morceaux.lister()) if (m.dossierId === id) await depots.morceaux.modifier(m.id, { dossierId: null });
  for (const p of await depots.projets.lister()) if (p.dossierId === id) await depots.projets.modifier(p.id, { dossierId: null });
  await depots.dossiers.supprimer(id);
}
