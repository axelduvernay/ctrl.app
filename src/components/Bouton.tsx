import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icone, type NomIcone } from "./Icone";

/* principal : la pilule claire, une seule par écran.
   secondaire : pilule pleine discrète (ex. un bouton de page discret).
   contour : pilule avec filet (ex. « Voir le parcours »).
   lien : texte seul, souvent suivi d’une flèche.
   accent : orange, réservé aux actions de création (ex. le + du board). */
type Variante = "principal" | "secondaire" | "contour" | "lien" | "accent";

const styles: Record<Variante, string> = {
  principal: "h-11 px-6 rounded-full bg-inverse text-sur-inverse",
  secondaire: "h-11 px-5 rounded-full bg-surface text-texte hover:bg-filet",
  contour: "h-11 px-5 rounded-full border border-filet text-texte hover:bg-surface",
  lien: "h-11 px-1 text-texte hover:text-texte-2",
  accent: "h-11 px-6 rounded-full bg-accent text-sur-accent",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  icone?: NomIcone;
  iconeApres?: NomIcone;
  children: ReactNode;
}

export function Bouton({ variante = "principal", icone, iconeApres, className = "", children, ...props }: Props) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 text-[15px] font-medium whitespace-nowrap transition-colors duration-150 disabled:opacity-40 ${styles[variante]} ${className}`}
      {...props}
    >
      {icone && <Icone nom={icone} taille={18} className={variante === "secondaire" ? "text-accent" : ""} />}
      {children}
      {iconeApres && <Icone nom={iconeApres} taille={16} />}
    </button>
  );
}

interface BoutonIconeProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icone: NomIcone;
  libelle: string;
}

/** Bouton rond de 44 px, icône seule (le libellé sert aux lecteurs d’écran). */
export function BoutonIcone({ icone, libelle, className = "", ...props }: BoutonIconeProps) {
  return (
    <button
      type="button"
      aria-label={libelle}
      className={`inline-flex size-11 items-center justify-center rounded-full border border-filet text-texte transition-colors duration-150 hover:bg-surface ${className}`}
      {...props}
    >
      <Icone nom={icone} taille={18} />
    </button>
  );
}
