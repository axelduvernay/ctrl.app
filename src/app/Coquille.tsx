import { useEffect } from "react";
import { Navigate, Outlet } from "react-router";
import { depots, useRequete } from "@/data";
import { useUi } from "@/stores/ui";
import { BarreLaterale, BarreOnglets } from "./BarreLaterale";
import { Ajout } from "./Ajout";
import { BarreLecture } from "./BarreLecture";
import { useLecteur } from "@/stores/lecteur";
import { rangerAnciennesCaptures } from "@/features/boards/actions";
import { Recherche } from "./Recherche";
import { Rappels } from "./Rappels";

/** Coquille de l’app : barre latérale à gauche, écran courant à droite.
    Sans profil (premier lancement ou après réinitialisation) : onboarding. */
export function Coquille() {
  const { donnees: profils, chargement } = useRequete(() => depots.profils.lister());
  const ouvrirRecherche = useUi((u) => u.ouvrirRecherche);
  const lecteur = useLecteur((l) => l.file.length > 0);

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

  const pret = !!profils?.some((p) => p.onboardingTermineAt);
  useEffect(() => {
    if (pret) void rangerAnciennesCaptures();
  }, [pret]);

  if (chargement) return <div className="min-h-dvh bg-fond" />;
  if (!profils?.some((p) => p.onboardingTermineAt)) return <Navigate to="/bienvenue" replace />;

  return (
    <div className="flex min-h-dvh bg-fond">
      <BarreLaterale />
      {/* Sur téléphone : marges réduites, et de la place en bas pour les onglets (et le lecteur). */}
      <main
        className={`min-w-0 flex-1 px-5 pt-[calc(24px+env(safe-area-inset-top))] md:px-8 md:pt-16 lg:px-[72px] ${
          lecteur ? "pb-[calc(152px+env(safe-area-inset-bottom))] md:pb-32" : "pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-16"
        }`}
      >
        <div className="mx-auto max-w-[1200px]">
          <Outlet />
        </div>
      </main>
      <Ajout />
      <BarreLecture />
      <BarreOnglets />
      <Recherche />
      <Rappels />
    </div>
  );
}
