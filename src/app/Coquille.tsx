import { useEffect } from "react";
import { Navigate, Outlet } from "react-router";
import { depots, useRequete } from "@/data";
import { useUi } from "@/stores/ui";
import { BarreLaterale } from "./BarreLaterale";
import { Capture } from "./Capture";
import { Recherche } from "./Recherche";

/** Coquille de l’app : barre latérale à gauche, écran courant à droite.
    Sans profil (premier lancement ou après réinitialisation) : onboarding. */
export function Coquille() {
  const { donnees: profils, chargement } = useRequete(() => depots.profils.lister());
  const ouvrirRecherche = useUi((u) => u.ouvrirRecherche);

  // ⌘K (Mac) ou Ctrl+K : recherche globale, depuis n’importe quel écran.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ouvrirRecherche();
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvrirRecherche]);

  if (chargement) return <div className="min-h-dvh bg-fond" />;
  if (!profils?.some((p) => p.onboardingTermineAt)) return <Navigate to="/bienvenue" replace />;

  return (
    <div className="flex min-h-dvh bg-fond">
      <BarreLaterale />
      <main className="min-w-0 flex-1 px-8 py-16 lg:px-[72px]">
        <div className="mx-auto max-w-[1200px]">
          <Outlet />
        </div>
      </main>
      <Capture />
      <Recherche />
    </div>
  );
}
