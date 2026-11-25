import { useNavigate } from "react-router";
import { Icone } from "@/components/Icone";
import { MenuDeroulant } from "@/components/MenuDeroulant";
import { importerSingles } from "@/features/musique/actions";
import { ACCEPTE_AUDIO, choisirFichiers } from "@/lib/choisirFichiers";
import { useUi } from "@/stores/ui";

/** Recherche ⌘K et bouton +, en haut à droite de tous les écrans. */
export function ActionsEnTete() {
  const naviguer = useNavigate();
  const { ouvrirAjout, ouvrirRecherche, annoncer } = useUi();
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  async function morceaux(fichiers: File[]) {
    if (!fichiers.length) return;
    annoncer(fichiers.length === 1 ? "Import et analyse du son…" : `Import et analyse de ${fichiers.length} sons…`);
    const crees = await importerSingles(fichiers);
    useUi.setState({ annonce: null });
    if (crees.length === 1) naviguer(`/musique/${crees[0]!.id}`);
    else if (crees.length) naviguer("/musique");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={ouvrirRecherche}
        className="hidden h-11 w-64 items-center gap-3 rounded-full border border-filet px-4 text-texte-2 transition-colors duration-150 hover:text-texte md:flex"
      >
        <Icone nom="recherche" taille={16} />
        <span className="flex-1 text-left text-[15px]">Rechercher</span>
        <kbd className="font-sans text-libelle">{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      <MenuDeroulant
        libelle="Ajouter"
        cote="droite"
        declencheur={(ouvert, basculer) => (
          <button
            type="button"
            onClick={basculer}
            aria-label="Ajouter"
            aria-expanded={ouvert}
            className="flex size-11 items-center justify-center rounded-full bg-surface text-accent transition-colors duration-150 hover:bg-filet"
          >
            <Icone nom="plus" taille={20} />
          </button>
        )}
        elements={[
          { libelle: "Une tâche", icone: "tacheBloc", onClick: () => ouvrirAjout("tache") },
          { libelle: "Un événement", icone: "calendrier", onClick: () => ouvrirAjout("evenement") },
          { libelle: "Un contact", icone: "contactPlus", onClick: () => ouvrirAjout("contact") },
          { libelle: "Une note", icone: "note", onClick: () => ouvrirAjout("note") },
          { libelle: "Un morceau", icone: "musique", onClick: () => void choisirFichiers(ACCEPTE_AUDIO).then(morceaux) },
          { libelle: "Un mémo vocal", icone: "micro", onClick: () => ouvrirAjout("memo") },
        ]}
      />
    </div>
  );
}
