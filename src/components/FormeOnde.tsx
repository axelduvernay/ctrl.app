import { useEffect, useRef, useState } from "react";
import { depots } from "@/data";
import { analyserAudio } from "@/lib/analyse";

/** Niveaux de la forme d’onde d’un fichier. Les fichiers importés avant
    l’analyse sont analysés une fois, puis le résultat est gardé. */
export function usePics(fichierId: string | null | undefined) {
  const [pics, setPics] = useState<number[] | null>(null);
  useEffect(() => {
    setPics(null);
    if (!fichierId) return;
    let actif = true;
    void depots.fichiers.obtenir(fichierId).then(async (f) => {
      if (!f || !actif) return;
      if (f.pics?.length) return setPics(f.pics);
      const r = await analyserAudio(f.blob);
      if (!r || !actif) return;
      setPics(r.pics);
      await depots.fichiers.modifier(f.id, { pics: r.pics, duree: f.duree ?? r.duree });
    });
    return () => {
      actif = false;
    };
  }, [fichierId]);
  return pics;
}

/** Regroupe les niveaux en « nb » barres (le maximum de chaque paquet). */
function regrouper(pics: number[], nb: number) {
  if (nb <= 0) return [];
  const sortie: number[] = [];
  const pas = pics.length / nb;
  for (let i = 0; i < nb; i++) {
    let max = 0;
    for (let j = Math.floor(i * pas); j < Math.max(Math.floor(i * pas) + 1, Math.floor((i + 1) * pas)); j++) max = Math.max(max, pics[j] ?? 0);
    sortie.push(max);
  }
  return sortie;
}

interface Props {
  pics: number[] | null;
  /** Avancement de la lecture, entre 0 et 1. */
  avance: number;
  onAller?(ratio: number): void;
  hauteur?: number;
  libelle: string;
}

/** Forme d’onde en barres fines : la partie écoutée en couleur de texte,
    le reste en gris, et un curseur fin. Cliquer déplace la lecture. */
export function FormeOnde({ pics, avance, onAller, hauteur = 48, libelle }: Props) {
  const boite = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const el = boite.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setLargeur(e!.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const pas = 3; // barre de 2 px + 1 px d’espace
  const barres = pics ? regrouper(pics, Math.floor(largeur / pas)) : [];
  const ratio = Math.min(1, Math.max(0, avance));

  function viser(clientX: number) {
    const r = boite.current?.getBoundingClientRect();
    if (!r || !onAller) return;
    onAller(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  }

  return (
    <div
      ref={boite}
      role="slider"
      aria-label={`Position dans ${libelle}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      tabIndex={onAller ? 0 : -1}
      onPointerDown={(e) => {
        if (!onAller) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        viser(e.clientX);
      }}
      onPointerMove={(e) => e.buttons === 1 && e.currentTarget.hasPointerCapture(e.pointerId) && viser(e.clientX)}
      onKeyDown={(e) => {
        if (!onAller) return;
        if (e.key === "ArrowRight") onAller(Math.min(1, ratio + 0.02));
        if (e.key === "ArrowLeft") onAller(Math.max(0, ratio - 0.02));
      }}
      className={`relative min-w-0 flex-1 focus-visible:outline-none ${onAller ? "cursor-pointer" : ""}`}
      style={{ height: hauteur }}
    >
      {pics ? (
        <svg width={largeur} height={hauteur} className="block" aria-hidden>
          {barres.map((v, i) => {
            const h = Math.max(2, v * (hauteur - 4));
            const joue = (i + 0.5) / barres.length <= ratio;
            return (
              <rect
                key={i}
                x={i * pas}
                y={(hauteur - h) / 2}
                width={2}
                height={h}
                rx={1}
                className={joue ? "fill-texte" : "fill-texte-2 opacity-50"}
              />
            );
          })}
        </svg>
      ) : (
        // Pendant le calcul : un trait discret à la place de la forme.
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-filet" />
      )}
      {ratio > 0 && <span aria-hidden className="absolute inset-y-0 w-0.5 rounded-full bg-accent" style={{ left: `calc(${ratio * 100}% - 1px)` }} />}
    </div>
  );
}
