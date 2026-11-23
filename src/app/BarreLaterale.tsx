import { NavLink, useLocation } from "react-router";
import { Chevron } from "@/components/Logo";
import { Icone, type NomIcone } from "@/components/Icone";
import { useTheme } from "@/stores/theme";

const onglets: { vers: string; nom: NomIcone; libelle: string }[] = [
  { vers: "/", nom: "accueil", libelle: "Accueil" },
  { vers: "/musique", nom: "musique", libelle: "Musique" },
  { vers: "/sorties", nom: "sorties", libelle: "Sorties" },
  { vers: "/reseau", nom: "reseau", libelle: "Réseau" },
  { vers: "/boards", nom: "boards", libelle: "Boards" },
];

const cellule =
  "group relative flex size-11 items-center justify-center rounded-12 transition-colors duration-150";

/** Libellé qui apparaît à droite de l’icône au survol ou au clavier. */
function Infobulle({ texte }: { texte: string }) {
  return (
    <span
      role="presentation"
      className="pointer-events-none absolute left-full z-20 ml-3 rounded-12 border border-filet bg-surface px-3 py-1.5 text-libelle whitespace-nowrap text-texte opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {texte}
    </span>
  );
}

function classeOnglet({ isActive }: { isActive: boolean }) {
  return `${cellule} ${isActive ? "bg-surface text-texte" : "text-texte-2 hover:text-texte"}`;
}

export function BarreLaterale() {
  const { theme, basculer } = useTheme();
  // Le parcours fait partie de l’Accueil : l’onglet reste allumé.
  const surParcours = useLocation().pathname === "/parcours";
  const prochain = theme === "sombre" ? "Mode clair" : "Mode sombre";

  return (
    <nav
      aria-label="Navigation principale"
      className="sticky top-0 flex h-dvh w-[88px] shrink-0 flex-col items-center border-r border-filet py-10"
    >
      <NavLink to="/" aria-label="ctrl.app, accueil" className="mb-14 flex size-11 items-center justify-center">
        <Chevron taille={28} />
      </NavLink>

      <ul className="flex flex-col gap-2">
        {onglets.map((o) => (
          <li key={o.vers}>
            <NavLink
              to={o.vers}
              end={o.vers === "/"}
              aria-label={o.libelle}
              className={({ isActive }) => classeOnglet({ isActive: isActive || (o.vers === "/" && surParcours) })}
            >
              <Icone nom={o.nom} />
              <Infobulle texte={o.libelle} />
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col gap-2">
        <button type="button" onClick={basculer} aria-label={prochain} className={`${cellule} text-texte-2 hover:text-texte`}>
          <Icone nom={theme === "sombre" ? "sombre" : "clair"} />
          <Infobulle texte={prochain} />
        </button>
        <NavLink to="/reglages" aria-label="Réglages" className={classeOnglet}>
          <Icone nom="reglages" />
          <Infobulle texte="Réglages" />
        </NavLink>
      </div>
    </nav>
  );
}
