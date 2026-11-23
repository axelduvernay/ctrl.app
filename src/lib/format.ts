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
