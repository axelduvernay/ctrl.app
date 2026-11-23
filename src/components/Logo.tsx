/* Logo : le chevron du signe control (⌃), angle droit, bouts arrondis,
   suivi du logotype « ctrl.app » en Satoshi Bold. */

interface ChevronProps {
  taille?: number;
  className?: string;
}

/** Le trait s’épaissit quand la taille baisse, comme dans la charte. */
export function Chevron({ taille = 24, className = "text-accent" }: ChevronProps) {
  const trait = taille <= 16 ? 3.4 : taille <= 32 ? 2.8 : 2.4;
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4.5 15.5 12 8l7.5 7.5" stroke="currentColor" strokeWidth={trait} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface LogoProps {
  /** Hauteur du logotype en pixels. */
  taille?: number;
  className?: string;
}

export function Logo({ taille = 28, className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center text-texte ${className}`} style={{ gap: taille * 0.28 }} aria-label="ctrl.app">
      <Chevron taille={taille * 1.05} />
      <span className="font-bold leading-none" style={{ fontSize: taille, letterSpacing: "-0.045em" }} aria-hidden>
        ctrl.app
      </span>
    </span>
  );
}
