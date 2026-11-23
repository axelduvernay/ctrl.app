import { Navigate, Outlet } from "react-router";
import { depots, useRequete } from "@/data";
import { BarreLaterale } from "./BarreLaterale";

/** Coquille de l’app : barre latérale à gauche, écran courant à droite.
    Sans profil (premier lancement ou après réinitialisation) : onboarding. */
export function Coquille() {
  const { donnees: profils, chargement } = useRequete(() => depots.profils.lister());
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
    </div>
  );
}
