import type { ReactNode } from "react";
import { fr } from "@/content/typo";
import { ActionsEnTete } from "@/app/ActionsEnTete";
import { FilAriane } from "./FilAriane";

interface Props {
  surtitre?: string;
  titre: string;
  actions?: ReactNode;
  /** Écran de détail : bouton retour et fil d’Ariane au-dessus du titre. */
  retour?: { libelle: string; vers: string }[];
}

/** En-tête d’écran : surtitre gris, titre, actions de la page, puis
    Rechercher et le bouton + (présents partout). */
export function EnTete({ surtitre, titre, actions, retour }: Props) {
  return (
    // Téléphone : recherche et + en haut à droite du titre, les actions de la page en dessous.
    <header className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-6">
          {retour && <FilAriane liens={retour} courant={titre} />}
          <div>
            {surtitre && <p className="mb-1 text-libelle text-texte-2">{surtitre}</p>}
            <h1 className="text-page">{fr(titre)}</h1>
          </div>
        </div>
        <div className="shrink-0 md:hidden">
          <ActionsEnTete />
        </div>
      </div>
      <div className={`flex flex-wrap items-center gap-2 ${actions ? "" : "max-md:hidden"}`}>
        {actions}
        <div className="max-md:hidden">
          <ActionsEnTete />
        </div>
      </div>
    </header>
  );
}
