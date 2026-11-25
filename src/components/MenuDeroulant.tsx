import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icone, type NomIcone } from "./Icone";

export interface ElementMenu {
  libelle: string;
  icone?: NomIcone;
  /** Pastille de couleur à la place de l’icône (statuts). */
  couleur?: string;
  actif?: boolean;
  onClick(): void;
}

interface Props {
  /** Bouton qui ouvre le menu (reçoit l’état et la fonction d’ouverture). */
  declencheur(ouvert: boolean, basculer: () => void): ReactNode;
  elements: (ElementMenu | "separateur")[];
  /** Côté où le menu s’aligne sous le bouton. */
  cote?: "gauche" | "droite";
  /** Ouvre le menu au-dessus du bouton (près du bas de l’écran). */
  dessus?: boolean;
  libelle: string;
}

/** Petit menu sous un bouton : Échap ou un clic ailleurs le ferme. */
export function MenuDeroulant({ declencheur, elements, cote = "gauche", dessus = false, libelle }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => !boite.current?.contains(e.target as Node) && setOuvert(false);
    const echap = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    document.addEventListener("pointerdown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("pointerdown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  return (
    <div ref={boite} className="relative">
      {declencheur(ouvert, () => setOuvert((o) => !o))}
      {ouvert && (
        <div
          role="menu"
          aria-label={libelle}
          className={`absolute z-40 flex min-w-56 flex-col rounded-18 border border-filet bg-surface p-1.5 ${cote === "droite" ? "right-0" : "left-0"} ${
            dessus ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {elements.map((e, i) =>
            e === "separateur" ? (
              <span key={i} className="my-1 h-px bg-filet" />
            ) : (
              <button
                key={e.libelle}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOuvert(false);
                  e.onClick();
                }}
                className="flex items-center gap-3 rounded-12 px-3 py-2.5 text-left text-[15px] whitespace-nowrap text-texte hover:bg-filet"
              >
                {e.couleur ? (
                  <span aria-hidden className="mx-1 size-2 shrink-0 rounded-full" style={{ background: e.couleur }} />
                ) : (
                  e.icone && <Icone nom={e.icone} taille={16} className="text-texte-2" />
                )}
                <span className="flex-1">{e.libelle}</span>
                {e.actif && <Icone nom="valide" taille={16} className="text-texte-2" />}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
