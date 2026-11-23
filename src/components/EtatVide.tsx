import type { ReactNode } from "react";

interface Props {
  titre: string;
  texte?: string;
  action?: ReactNode;
}

/** État vide d’un bloc : l’app démarre vierge, chaque bloc doit rester propre. */
export function EtatVide({ titre, texte, action }: Props) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-texte">{titre}</p>
      {texte && <p className="max-w-md text-libelle text-texte-2">{texte}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
