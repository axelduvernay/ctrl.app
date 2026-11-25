import { Link, useNavigate } from "react-router";
import { Icone } from "./Icone";

interface Props {
  /** Écrans parents, du plus haut au plus proche. */
  liens: { libelle: string; vers: string }[];
  courant: string;
}

/** Bouton retour + fil d’Ariane, en haut à gauche des écrans de détail.
    Retour : page précédente si on vient de l’app, sinon le parent direct. */
export function FilAriane({ liens, courant }: Props) {
  const naviguer = useNavigate();
  const parent = liens[liens.length - 1]?.vers ?? "/";
  const retour = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) naviguer(-1);
    else naviguer(parent);
  };
  return (
    <div className="flex min-w-0 items-center gap-4">
      <button
        type="button"
        onClick={retour}
        aria-label="Retour"
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-filet text-texte-2 transition-colors duration-150 hover:text-texte"
      >
        <Icone nom="retour" taille={16} />
      </button>
      <nav aria-label="Fil d’Ariane" className="flex min-w-0 items-center gap-2 text-libelle text-texte-2">
        {liens.map((l) => (
          <span key={l.vers} className="flex shrink-0 items-center gap-2">
            <Link to={l.vers} className="hover:text-texte">
              {l.libelle}
            </Link>
            <span aria-hidden>/</span>
          </span>
        ))}
        <span className="truncate text-texte">{courant}</span>
      </nav>
    </div>
  );
}
