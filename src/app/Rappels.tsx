import { useEffect, useState } from "react";
import { Link } from "react-router";
import { depots } from "@/data";
import { texteBrut } from "@/features/boards/texte";
import type { Bloc } from "@/types";

/** Rappels posés sur les blocs des boards : vérifiés toutes les 20 secondes
    tant que l’app est ouverte. Affichés dans l’app, et en notification du
    système si elle est autorisée. */
export function Rappels() {
  const [actifs, setActifs] = useState<Bloc[]>([]);

  useEffect(() => {
    const verifier = async () => {
      const maintenant = new Date().toISOString();
      const echus = (await depots.blocs.lister()).filter((b) => b.rappel && !b.rappelVu && b.rappel <= maintenant);
      if (!echus.length) return;
      const taches = await depots.taches.lister();
      for (const b of echus) {
        await depots.blocs.modifier(b.id, { rappelVu: true });
        const texte = libelle(b, taches);
        if ("Notification" in window && Notification.permission === "granted") new Notification("ctrl.app", { body: texte, icon: `${import.meta.env.BASE_URL}favicon.svg`, tag: b.id });
      }
      setActifs((a) => [...a, ...echus]);
    };
    void verifier();
    const t = setInterval(() => void verifier(), 20_000);
    return () => clearInterval(t);
  }, []);

  if (!actifs.length) return null;
  return (
    <div className="fixed right-8 bottom-28 z-50 flex w-80 flex-col gap-2">
      {actifs.map((b) => (
        <div key={b.id} role="alert" className="flex flex-col gap-2 rounded-18 border border-filet bg-surface p-4">
          <p className="text-libelle text-texte-2">Rappel</p>
          <p className="line-clamp-3">{libelle(b, [])}</p>
          <div className="flex gap-4 text-libelle">
            <Link to={`/boards/${b.boardId}`} onClick={() => setActifs((a) => a.filter((x) => x.id !== b.id))} className="text-texte hover:underline underline-offset-4">
              Voir sur le board
            </Link>
            <button type="button" onClick={() => setActifs((a) => a.filter((x) => x.id !== b.id))} className="text-texte-2 hover:text-texte">
              OK
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function libelle(b: Bloc, taches: { id: string; titre: string }[]) {
  return taches.find((t) => t.id === b.refId)?.titre || b.titre || texteBrut(b.contenu).slice(0, 140) || "Un bloc de ton board";
}
