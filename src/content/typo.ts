/** Typographie française : espace insécable fine avant « : ; ! ? » et à
    l’intérieur des guillemets, pour qu’aucun signe ne tombe seul en début
    de ligne. */
export function fr(texte: string): string {
  return texte
    .replace(/ ([:;!?»])/g, " $1")
    .replace(/« /g, "« ");
}
