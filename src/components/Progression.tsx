/* Progression du parcours : segments fins, orange pour les étapes validées,
   couleur du texte pour l’étape en cours, filet pour la suite. */

interface Props {
  total: number;
  /** Nombre d’étapes validées. */
  faites: number;
  /** Afficher l’étape en cours (segment clair). */
  enCours?: boolean;
  className?: string;
}

export function Progression({ total, faites, enCours = true, className = "" }: Props) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={faites}
      className={`flex gap-1.5 ${className}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-0.5 flex-1 rounded-full transition-colors duration-150 ${
            i < faites ? "bg-accent" : i === faites && enCours ? "bg-texte" : "bg-filet"
          }`}
        />
      ))}
    </div>
  );
}

/** Grand numéro « 02 » avec « /08 » en exposant, comme sur l’Accueil du dossier. */
export function NumeroEtape({ numero, total, taille = 140 }: { numero: string; total: string; taille?: number }) {
  return (
    <p className="flex items-start font-light leading-[0.85] tracking-[-0.04em] tabular-nums" style={{ fontSize: taille }}>
      {numero}
      <span className="mt-[0.06em] ml-1 text-[22px] font-medium tracking-normal text-texte-2" style={{ fontSize: Math.max(16, taille * 0.16) }}>
        /{total}
      </span>
    </p>
  );
}
