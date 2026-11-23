import { EtatVide } from "@/components/EtatVide";
import { ChampSelect } from "@/components/Champs";
import { LecteurAudio } from "@/components/LecteurAudio";
import { depots, useRequete } from "@/data";
import { dateRelative } from "@/lib/format";
import { useUi } from "@/stores/ui";
import { Bouton } from "@/components/Bouton";

/** Notes et mémos capturés sans morceau : à ranger plus tard, ou jamais. */
export function Captures() {
  const ouvrirCapture = useUi((u) => u.ouvrirCapture);
  const { donnees } = useRequete(async () => {
    const [notes, morceaux, fichiers] = await Promise.all([depots.notes.lister(), depots.morceaux.lister(), depots.fichiers.lister()]);
    return { notes: notes.filter((n) => !n.morceauId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), morceaux, fichiers };
  });
  if (!donnees) return null;

  if (donnees.notes.length === 0)
    return (
      <EtatVide
        titre="Rien de capturé pour l’instant."
        texte="Les notes et mémos vocaux pris avec « Capturer » sans choisir de morceau arrivent ici. Tu les ranges quand tu veux."
        action={
          <Bouton variante="contour" icone="plus" onClick={ouvrirCapture}>
            Capturer une idée
          </Bouton>
        }
      />
    );

  const options = [
    { valeur: "", libelle: "Ranger dans un morceau…" },
    ...donnees.morceaux.sort((a, b) => a.titre.localeCompare(b.titre, "fr")).map((m) => ({ valeur: m.id, libelle: m.titre })),
  ];

  return (
    <ul className="flex flex-col">
      {donnees.notes.map((n) => (
        <li key={n.id} className="grid gap-4 border-t border-filet py-5 last:border-b md:grid-cols-[1fr_260px]">
          <div className="flex min-w-0 flex-col gap-2">
            {n.fichierId && (
              <LecteurAudio fichierId={n.fichierId} dureeConnue={donnees.fichiers.find((f) => f.id === n.fichierId)?.duree} libelle="le mémo vocal" />
            )}
            {n.contenu && <p className="whitespace-pre-wrap">{n.contenu}</p>}
            <p className="text-libelle text-texte-2">
              {n.fichierId ? "Mémo vocal" : "Note"} · {dateRelative(n.createdAt)}
            </p>
          </div>
          <div className="flex items-end gap-3">
            <ChampSelect
              libelle="Ranger"
              className="flex-1 [&>span:first-child]:sr-only"
              valeur=""
              options={options}
              onChange={(id) => id && void depots.notes.modifier(n.id, { morceauId: id })}
            />
            <button
              type="button"
              onClick={async () => {
                if (n.fichierId) await depots.fichiers.supprimer(n.fichierId);
                await depots.notes.supprimer(n.id);
              }}
              className="h-12 text-libelle text-texte-2 hover:text-texte"
            >
              Supprimer
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
