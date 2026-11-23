import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Bouton } from "@/components/Bouton";
import { ChampTexte } from "@/components/Champs";
import { EnTete } from "@/components/EnTete";
import { EtatVide } from "@/components/EtatVide";
import { Modale } from "@/components/Modale";
import { depots, useRequete } from "@/data";
import { dateRelative } from "@/lib/format";
import { creerBoard } from "./actions";

export function BoardsPage() {
  const naviguer = useNavigate();
  const [creation, setCreation] = useState(false);
  const [titre, setTitre] = useState("");
  const { donnees } = useRequete(async () => {
    const [boards, blocs] = await Promise.all([depots.boards.lister(), depots.blocs.lister()]);
    return { boards, blocs };
  });
  if (!donnees) return null;

  async function creer() {
    if (!titre.trim()) return;
    const b = await creerBoard(titre);
    setTitre("");
    setCreation(false);
    naviguer(`/boards/${b.id}`);
  }

  return (
    <div className="flex flex-col gap-10">
      <EnTete
        titre="Boards"
        actions={
          <Bouton icone="plus" onClick={() => setCreation(true)}>
            Nouveau board
          </Bouton>
        }
      />

      {donnees.boards.length === 0 ? (
        <EtatVide
          titre="Aucun board pour l’instant."
          texte="Un whiteboard infini pour réfléchir : zones, notes, tâches, tracklists, et tes morceaux ou contacts posés comme nœuds liés."
          action={
            <Bouton variante="contour" icone="plus" onClick={() => setCreation(true)}>
              Créer un board
            </Bouton>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...donnees.boards]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((b) => {
              const n = donnees.blocs.filter((x) => x.boardId === b.id).length;
              return (
                <li key={b.id}>
                  <Link
                    to={`/boards/${b.id}`}
                    className="tableau-points flex aspect-[16/10] flex-col justify-end gap-1 rounded-28 border border-filet p-6 transition-colors duration-150 hover:border-texte-2"
                  >
                    <span className="text-[22px] tracking-[-0.01em]">{b.titre}</span>
                    <span className="text-libelle text-texte-2">
                      {n === 0 ? "Vide" : `${n} bloc${n > 1 ? "s" : ""}`} · modifié {dateRelative(b.updatedAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
        </ul>
      )}

      <Modale
        ouverte={creation}
        titre="Nouveau board"
        onFermer={() => setCreation(false)}
        actions={
          <>
            <Bouton variante="lien" onClick={() => setCreation(false)}>
              Annuler
            </Bouton>
            <Bouton onClick={() => void creer()} disabled={!titre.trim()}>
              Créer
            </Bouton>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void creer();
          }}
        >
          <ChampTexte libelle="Titre" valeur={titre} onChange={setTitre} placeholder="Ex. Mes projets" autoFocus maxLength={80} />
        </form>
      </Modale>
    </div>
  );
}
