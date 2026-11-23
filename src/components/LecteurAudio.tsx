import { useEffect, useRef, useState } from "react";
import { useUrlFichier } from "@/data";
import { duree } from "@/lib/format";
import { Icone } from "./Icone";

/* Un seul son à la fois dans toute l’app : lancer un lecteur met les autres
   en pause. */
let enCours: HTMLAudioElement | null = null;

interface Props {
  fichierId: string;
  /** Durée connue à l’import, affichée avant le chargement. */
  dureeConnue?: number | null;
  /** Version compacte (tracklist) : bouton seul. */
  compact?: boolean;
  libelle: string;
}

export function LecteurAudio({ fichierId, dureeConnue, compact = false, libelle }: Props) {
  const url = useUrlFichier(fichierId);
  const audio = useRef<HTMLAudioElement>(null);
  const [lecture, setLecture] = useState(false);
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(dureeConnue ?? 0);

  useEffect(() => () => audio.current?.pause(), []);

  function basculer() {
    const a = audio.current;
    if (!a || !url) return;
    if (a.paused) {
      if (enCours && enCours !== a) enCours.pause();
      enCours = a;
      void a.play();
    } else a.pause();
  }

  const bouton = (
    <button
      type="button"
      onClick={basculer}
      disabled={!url}
      aria-label={`${lecture ? "Pause" : "Écouter"} ${libelle}`}
      className={`flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ${
        lecture ? "text-accent" : "text-texte hover:bg-filet"
      }`}
    >
      <Icone nom={lecture ? "pause" : "lecture"} taille={16} />
    </button>
  );

  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "min-w-0 flex-1"}`}>
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="metadata"
          onPlay={() => setLecture(true)}
          onPause={() => setLecture(false)}
          onEnded={() => {
            setLecture(false);
            setPosition(0);
          }}
          onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setTotal(e.currentTarget.duration)}
        />
      )}
      {bouton}
      {!compact && (
        <>
          <input
            type="range"
            aria-label={`Position dans ${libelle}`}
            min={0}
            max={total || 1}
            step={0.1}
            value={position}
            onChange={(e) => {
              const t = Number(e.target.value);
              if (audio.current) audio.current.currentTime = t;
              setPosition(t);
            }}
            className="lecteur h-6 min-w-0 flex-1"
            style={{ ["--avance" as string]: `${total ? (position / total) * 100 : 0}%` }}
          />
          <span className="w-20 shrink-0 text-right text-libelle text-texte-2 tabular-nums">
            {duree(position)} / {duree(total)}
          </span>
        </>
      )}
    </div>
  );
}
