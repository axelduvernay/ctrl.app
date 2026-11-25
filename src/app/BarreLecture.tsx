import { Link } from "react-router";
import { FormeOnde, usePics } from "@/components/FormeOnde";
import { Icone, type NomIcone } from "@/components/Icone";
import { Vignette } from "@/features/musique/communs";
import { duree } from "@/lib/format";
import { useLecteur } from "@/stores/lecteur";

/** Barre de lecture en bas de l’écran, visible dès qu’un son est lancé. */
export function BarreLecture() {
  const piste = useLecteur((l) => l.courante());
  const { lecture, position, duree: total, file, index, basculer, suivant, precedent, aller, fermer } = useLecteur();
  const pics = usePics(piste?.fichierId);
  if (!piste) return null;

  const bouton = (icone: NomIcone, libelle: string, action: () => void, desactive = false, principal = false) => (
    <button
      type="button"
      onClick={action}
      disabled={desactive}
      aria-label={libelle}
      className={`flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:opacity-30 ${
        principal ? "size-10 bg-texte text-fond hover:opacity-90" : "size-9 text-texte-2 hover:text-texte"
      }`}
    >
      <Icone nom={icone} taille={principal ? 18 : 18} />
    </button>
  );

  return (
    <div
      role="region"
      aria-label="Lecture"
      className="fixed right-0 bottom-0 left-[88px] z-30 flex h-[72px] items-center gap-6 border-t border-filet bg-fond px-8"
    >
      <div className="flex w-56 min-w-0 shrink-0 items-center gap-3">
        <Vignette fichierId={piste.coverFichierId ?? null} taille={40} arrondi="rounded-[8px]" />
        <div className="flex min-w-0 flex-col">
          {piste.morceauId ? (
            <Link to={`/musique/${piste.morceauId}`} className="truncate hover:underline underline-offset-4">
              {piste.titre}
            </Link>
          ) : (
            <span className="truncate">{piste.titre}</span>
          )}
          {piste.sousTitre && <span className="truncate text-libelle text-texte-2">{piste.sousTitre}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {bouton("precedentPiste", "Précédent", precedent)}
        {bouton(lecture ? "pause" : "lecture", lecture ? "Pause" : "Lecture", basculer, false, true)}
        {bouton("suivantPiste", "Suivant", suivant, index + 1 >= file.length)}
      </div>
      <FormeOnde pics={pics} avance={total ? position / total : 0} onAller={(r) => aller(r * total)} hauteur={40} libelle={piste.titre} />
      <span className="w-24 shrink-0 text-right text-libelle text-texte-2 tabular-nums">
        {duree(position)} / {duree(total)}
      </span>
      {bouton("fermer", "Fermer le lecteur", fermer)}
    </div>
  );
}
