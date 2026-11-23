import { statut } from "@/content/statuts";
import type { StatutMorceau } from "@/types";

/** Point de couleur du statut, suivi du libellé si demandé. */
export function PastilleStatut({ valeur, libelle = true }: { valeur: StatutMorceau; libelle?: boolean }) {
  const s = statut(valeur);
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: s.couleur }} />
      {libelle ? s.libelle : <span className="sr-only">{s.libelle}</span>}
    </span>
  );
}
