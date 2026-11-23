import { Icone } from "@/components/Icone";
import { useUi } from "@/stores/ui";

/** Recherche ⌘K et bouton Capturer, en haut à droite des écrans. */
export function ActionsEnTete() {
  const { ouvrirCapture, ouvrirRecherche } = useUi();
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
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
      <button
        type="button"
        onClick={ouvrirCapture}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-surface px-5 text-[15px] font-medium text-texte transition-colors duration-150 hover:bg-filet"
      >
        <Icone nom="plus" taille={18} className="text-accent" />
        Capturer
      </button>
    </div>
  );
}
