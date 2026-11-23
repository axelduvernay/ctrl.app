/* Formats d’affichage partagés (dates, durées), en français. */

const jour = 24 * 60 * 60 * 1000;

function debutDuJour(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** « aujourd’hui », « hier », « il y a 3 jours », puis « 12 nov. ». */
export function dateRelative(iso: string, maintenant = new Date()): string {
  const d = new Date(iso);
  const ecart = Math.round((debutDuJour(maintenant) - debutDuJour(d)) / jour);
  if (ecart <= 0) return "aujourd’hui";
  if (ecart === 1) return "hier";
  if (ecart < 7) return `il y a ${ecart} jours`;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === maintenant.getFullYear() ? undefined : "numeric",
  }).format(d);
}

/** Durée en « 3:24 ». */
export function duree(secondes: number | null | undefined): string {
  if (secondes == null || !Number.isFinite(secondes)) return "–:––";
  const s = Math.max(0, Math.round(secondes));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Taille de fichier lisible : « 4,2 Mo ». */
export function taille(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

/** Jour local au format « 2026-12-04 ». */
export function jourIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Date d’un jour « 2026-12-04 », à midi pour éviter les décalages d’heure. */
export function depuisJour(jour: string): Date {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(a!, (m ?? 1) - 1, j ?? 1, 12);
}

export function ajouterJours(jour: string, n: number): string {
  const d = depuisJour(jour);
  d.setDate(d.getDate() + n);
  return jourIso(d);
}

/** « Aujourd’hui », « Demain », « Jeudi », ou « 12 déc. ». */
export function libelleJour(jour: string, maintenant = new Date()): string {
  const ecart = Math.round((depuisJour(jour).getTime() - depuisJour(jourIso(maintenant)).getTime()) / (24 * 3600 * 1000));
  if (ecart === 0) return "Aujourd’hui";
  if (ecart === 1) return "Demain";
  if (ecart === -1) return "Hier";
  if (ecart > 1 && ecart < 7) {
    const nom = new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(depuisJour(jour));
    return nom.charAt(0).toUpperCase() + nom.slice(1);
  }
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(depuisJour(jour));
}

/** « samedi 31 octobre » avec majuscule. */
export function dateLongue(d = new Date()): string {
  const t = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}
