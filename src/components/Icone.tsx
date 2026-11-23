import {
  House,
  Music,
  CalendarDays,
  Users,
  Workflow,
  Moon,
  Sun,
  SlidersHorizontal,
  Plus,
  Search,
  ArrowRight,
} from "lucide-react";
import { personnalisees } from "./icones/personnalisees";

/* Toutes les icônes de l’app passent par ce composant : trait fin de 1,6.
   Une icône peut être remplacée par un SVG maison dans icones/personnalisees.tsx. */
const librairie = {
  accueil: House,
  musique: Music,
  sorties: CalendarDays,
  reseau: Users,
  boards: Workflow,
  sombre: Moon,
  clair: Sun,
  reglages: SlidersHorizontal,
  plus: Plus,
  recherche: Search,
  fleche: ArrowRight,
} as const;

export type NomIcone = keyof typeof librairie;

interface Props {
  nom: NomIcone;
  taille?: number;
  className?: string;
}

export function Icone({ nom, taille = 20, className }: Props) {
  const Maison = personnalisees[nom];
  if (Maison) return <Maison width={taille} height={taille} className={className} aria-hidden />;
  const Composant = librairie[nom];
  return <Composant size={taille} strokeWidth={1.6} absoluteStrokeWidth className={className} aria-hidden />;
}
