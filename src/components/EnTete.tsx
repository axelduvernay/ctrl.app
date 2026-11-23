import type { ReactNode } from "react";
import { fr } from "@/content/typo";
import { ActionsEnTete } from "@/app/ActionsEnTete";

interface Props {
  surtitre?: string;
  titre: string;
  actions?: ReactNode;
}

/** En-tête d’écran : surtitre gris, titre, actions de la page, puis
    Rechercher et Capturer (présents partout). */
export function EnTete({ surtitre, titre, actions }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div>
        {surtitre && <p className="mb-1 text-libelle text-texte-2">{surtitre}</p>}
        <h1 className="text-[40px] leading-tight font-medium tracking-[-0.03em]">{fr(titre)}</h1>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <ActionsEnTete />
      </div>
    </header>
  );
}
