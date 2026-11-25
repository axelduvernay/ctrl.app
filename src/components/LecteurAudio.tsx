import { useEffect, useRef, useState } from "react";
import { duree } from "@/lib/format";
import { useLecteur, type Piste } from "@/stores/lecteur";
import { FormeOnde, usePics } from "./FormeOnde";
import { Icone } from "./Icone";

interface Props {
  /** Fichier stocké dans l’app (joué par le lecteur global)… */
  fichierId?: string;
  /** …ou adresse directe (ex. mémo pas encore enregistré). */
  source?: string | null;
  /** Durée connue à l’import, affichée avant le chargement. */
  dureeConnue?: number | null;
  /** Version compacte (tracklist) : bouton seul. */
  compact?: boolean;
  libelle: string;
  /** Infos affichées dans la barre de lecture. */
  piste?: Omit<Piste, "fichierId">;
  /** File d’écoute (la suite de la liste) ; sinon ce son seul. */
  file?: Piste[];
}

export function LecteurAudio(props: Props) {
  return props.source !== undefined ? <LecteurLocal {...props} /> : <LecteurGlobal {...props} />;
}

function BoutonLecture({ lecture, onClick, libelle, desactive = false }: { lecture: boolean; onClick(): void; libelle: string; desactive?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      aria-label={`${lecture ? "Pause" : "Écouter"} ${libelle}`}
      className={`flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ${
        lecture ? "text-accent" : "text-texte hover:bg-filet"
      }`}
    >
      <Icone nom={lecture ? "pause" : "lecture"} taille={16} />
    </button>
  );
}

/** Son stocké : passe par le lecteur global (un seul son à la fois). */
function LecteurGlobal({ fichierId, dureeConnue, compact = false, libelle, piste, file }: Props) {
  const actif = useLecteur((l) => !!fichierId && l.courante()?.fichierId === fichierId);
  const lecture = useLecteur((l) => l.lecture) && actif;
  const position = useLecteur((l) => (actif ? l.position : 0));
  const dureeLue = useLecteur((l) => (actif ? l.duree : 0));
  const pics = usePics(compact ? null : fichierId);
  const total = dureeLue || dureeConnue || 0;

  function jouer(depuis?: number) {
    if (!fichierId) return;
    const lecteur = useLecteur.getState();
    if (depuis !== undefined && actif) return lecteur.aller(depuis);
    const liste = file ?? [{ fichierId, titre: piste?.titre ?? libelle, ...piste }];
    const index = Math.max(0, liste.findIndex((p) => p.fichierId === fichierId));
    lecteur.jouer(liste, index);
  }

  const bouton = <BoutonLecture lecture={lecture} onClick={() => jouer()} libelle={libelle} desactive={!fichierId} />;
  if (compact) return bouton;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {bouton}
      <FormeOnde
        pics={pics}
        avance={total ? position / total : 0}
        libelle={libelle}
        onAller={(r) => (actif ? useLecteur.getState().aller(r * total) : jouer())}
      />
      <span className="w-24 shrink-0 text-right text-libelle text-texte-2 tabular-nums">
        {duree(position)} / {duree(total)}
      </span>
    </div>
  );
}

/** Son pas encore enregistré (aperçu d’un mémo) : lecteur local simple. */
function LecteurLocal({ source, dureeConnue, libelle }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const [lecture, setLecture] = useState(false);
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(dureeConnue ?? 0);

  useEffect(() => () => audio.current?.pause(), []);
  useEffect(() => setTotal(dureeConnue ?? 0), [dureeConnue, source]);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {source && (
        <audio
          ref={audio}
          src={source}
          preload="metadata"
          onPlay={() => {
            useLecteur.getState().lecture && useLecteur.getState().basculer();
            setLecture(true);
          }}
          onPause={() => setLecture(false)}
          onEnded={() => {
            setLecture(false);
            setPosition(0);
          }}
          onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setTotal(e.currentTarget.duration)}
        />
      )}
      <BoutonLecture
        lecture={lecture}
        libelle={libelle}
        desactive={!source}
        onClick={() => (audio.current?.paused ? void audio.current.play() : audio.current?.pause())}
      />
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
      <span className="w-24 shrink-0 text-right text-libelle text-texte-2 tabular-nums">
        {duree(position)} / {duree(total)}
      </span>
    </div>
  );
}
