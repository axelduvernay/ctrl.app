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
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex flex-col gap-6">
        {retour && <FilAriane liens={retour} courant={titre} />}
        <div>
        {surtitre && <p className="mb-1 text-libelle text-texte-2">{surtitre}</p>}
        <h1 className="text-[40px] leading-tight font-medium tracking-[-0.03em]">{fr(titre)}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <ActionsEnTete />
      </div>
    </header>
  );
}
