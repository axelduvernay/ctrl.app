import { useEffect, useRef, type ReactNode } from "react";
import { BoutonIcone } from "./Bouton";
import { fr } from "@/content/typo";

interface Props {
  ouverte: boolean;
  titre: string;
  onFermer(): void;
  children: ReactNode;
  /** Boutons du bas (une seule pilule principale). */
  actions?: ReactNode;
}

/** Fenêtre modale native (<dialog>) : Échap ferme, le focus reste dedans. */
export function Modale({ ouverte, titre, onFermer, children, actions }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouverte && !d.open) d.showModal();
    if (!ouverte && d.open) d.close();
  }, [ouverte]);

  return (
    <dialog
      ref={ref}
      onClose={onFermer}
      onClick={(e) => e.target === ref.current && onFermer()}
      className="m-auto w-[min(560px,calc(100vw-32px))] rounded-28 border border-filet bg-surface p-0 text-texte backdrop:bg-fond/80"
    >
      {ouverte && (
        <div className="flex flex-col gap-8 p-8">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-[28px] leading-tight font-medium tracking-[-0.02em]">{fr(titre)}</h2>
            <BoutonIcone icone="fermer" libelle="Fermer" onClick={onFermer} className="-mt-1 -mr-2 border-transparent" />
          </div>
          {children}
          {actions && <div className="flex items-center justify-end gap-3">{actions}</div>}
        </div>
      )}
    </dialog>
  );
}
