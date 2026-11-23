/* Icônes dessinées sur mesure.
   Pour remplacer une icône de la librairie (Lucide) par la tienne, ajoute ici
   un composant sous le même nom (voir NomIcone dans Icone.tsx). Dessine-la
   dans une grille de 24 × 24, trait de 1,6, bouts et angles arrondis, et
   utilise currentColor pour qu’elle suive le thème. Exemple :

   export const personnalisees = {
     boards: (props: SVGProps<SVGSVGElement>) => (
       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
         <circle cx="6" cy="6" r="2.5" />
         <rect x="15" y="15" width="5" height="5" rx="1.5" />
         <path d="M8.5 6H12a3 3 0 0 1 3 3v6" />
       </svg>
     ),
   };
*/

import type { ComponentType, SVGProps } from "react";
import type { NomIcone } from "../Icone";

export const personnalisees: Partial<Record<NomIcone, ComponentType<SVGProps<SVGSVGElement>>>> = {};
