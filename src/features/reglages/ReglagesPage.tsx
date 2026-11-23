import { EnTete } from "@/components/EnTete";
import { Icone } from "@/components/Icone";
import { useTheme, type Theme } from "@/stores/theme";

const modes: { valeur: Theme; libelle: string }[] = [
  { valeur: "sombre", libelle: "Sombre" },
  { valeur: "clair", libelle: "Clair" },
];

export function ReglagesPage() {
  const { theme, choisir } = useTheme();
  return (
    <div className="flex flex-col gap-12">
      <EnTete titre="Réglages" />
      <section className="flex flex-col gap-4 border-t border-filet pt-8">
        <h2 className="text-libelle text-texte-2">Mode d’affichage</h2>
        <div role="radiogroup" aria-label="Mode d’affichage" className="inline-flex w-fit gap-1 rounded-full border border-filet p-1">
          {modes.map((m) => (
            <button
              key={m.valeur}
              type="button"
              role="radio"
              aria-checked={theme === m.valeur}
              onClick={() => choisir(m.valeur)}
              className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-[15px] transition-colors duration-150 ${
                theme === m.valeur ? "bg-surface text-texte" : "text-texte-2 hover:text-texte"
              }`}
            >
              <Icone nom={m.valeur} taille={16} />
              {m.libelle}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
