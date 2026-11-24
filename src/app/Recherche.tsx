import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Icone } from "@/components/Icone";
import { depots, useRequete } from "@/data";
import { statut } from "@/content/statuts";
import { useUi } from "@/stores/ui";

/* Recherche globale (⌘K) : morceaux, projets, contacts, tâches et boards. */

interface Resultat {
  id: string;
  groupe: string;
  titre: string;
  detail: string;
  vers: string;
}

/** Minuscules, sans accents : « Après » se trouve en tapant « apres ». */
const normaliser = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Recherche() {
  const { recherche, fermer } = useUi();
  const naviguer = useNavigate();
  const [requete, setRequete] = useState("");
  const [actif, setActif] = useState(0);
  const dialogue = useRef<HTMLDialogElement>(null);

  const { donnees } = useRequete(async () => {
    const [morceaux, projets, contacts, taches, boards] = await Promise.all([
      depots.morceaux.lister(),
      depots.projets.lister(),
      depots.contacts.lister(),
      depots.taches.lister(),
      depots.boards.lister(),
    ]);
    const tout: Resultat[] = [
      ...morceaux.map((m) => ({ id: m.id, groupe: "Morceaux", titre: m.titre, detail: statut(m.statut).libelle, vers: `/musique/${m.id}` })),
      ...projets.map((p) => ({ id: p.id, groupe: "Projets", titre: p.titre, detail: `${p.morceauIds.length} morceaux`, vers: `/musique/projets/${p.id}` })),
      ...contacts.map((c) => ({ id: c.id, groupe: "Contacts", titre: c.nom, detail: c.email || "Contact", vers: `/reseau/${c.id}` })),
      ...taches.map((t) => ({
        id: t.id,
        groupe: "Tâches",
        titre: t.titre,
        detail: t.faite ? "Faite" : "À faire",
        vers: t.morceauId ? `/musique/${t.morceauId}` : t.contactId ? `/reseau/${t.contactId}` : "/taches",
      })),
      ...boards.map((b) => ({ id: b.id, groupe: "Boards", titre: b.titre, detail: "Board", vers: `/boards/${b.id}` })),
    ];
    return tout;
  });

  const resultats = useMemo(() => {
    const q = normaliser(requete.trim());
    if (!q || !donnees) return [];
    return donnees.filter((r) => normaliser(r.titre).includes(q)).slice(0, 20);
  }, [requete, donnees]);

  useEffect(() => {
    const d = dialogue.current;
    if (!d) return;
    if (recherche && !d.open) {
      setRequete("");
      setActif(0);
      d.showModal();
    }
    if (!recherche && d.open) d.close();
  }, [recherche]);

  useEffect(() => setActif(0), [requete]);

  function ouvrir(r?: Resultat) {
    if (!r) return;
    fermer();
    naviguer(r.vers);
  }

  return (
    <dialog
      ref={dialogue}
      onClose={fermer}
      onClick={(e) => e.target === dialogue.current && fermer()}
      aria-label="Rechercher"
      className="mx-auto mt-[12vh] w-[min(640px,calc(100vw-32px))] rounded-28 border border-filet bg-surface p-0 text-texte backdrop:bg-fond/80"
    >
      {recherche && (
        <div className="flex flex-col">
          <label className="flex items-center gap-3 border-b border-filet px-6">
            <Icone nom="recherche" taille={18} className="text-texte-2" />
            <input
              autoFocus
              value={requete}
              onChange={(e) => setRequete(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActif((a) => Math.min(a + 1, resultats.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActif((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") ouvrir(resultats[actif]);
              }}
              placeholder="Morceaux, contacts, tâches, boards…"
              aria-label="Rechercher"
              className="h-16 flex-1 bg-transparent text-[18px] text-texte placeholder:text-texte-2 focus:outline-none"
            />
            <kbd className="font-sans text-libelle text-texte-2">Échap</kbd>
          </label>
          <div className="max-h-[50vh] overflow-y-auto p-2">
            {requete.trim() === "" ? (
              <p className="px-4 py-6 text-texte-2">Tape le nom d’un morceau, d’un contact, d’une tâche ou d’un board.</p>
            ) : resultats.length === 0 ? (
              <p className="px-4 py-6 text-texte-2">Aucun résultat pour « {requete.trim()} ».</p>
            ) : (
              <ul role="listbox" aria-label="Résultats">
                {resultats.map((r, i) => (
                  <li key={`${r.groupe}-${r.id}`}>
                    {(i === 0 || resultats[i - 1]!.groupe !== r.groupe) && (
                      <p className="px-4 pt-3 pb-1 text-libelle text-texte-2">{r.groupe}</p>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === actif}
                      onMouseEnter={() => setActif(i)}
                      onClick={() => ouvrir(r)}
                      className={`flex w-full items-baseline justify-between gap-4 rounded-12 px-4 py-3 text-left ${i === actif ? "bg-filet" : ""}`}
                    >
                      <span className="truncate">{r.titre}</span>
                      <span className="shrink-0 text-libelle text-texte-2">{r.detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
