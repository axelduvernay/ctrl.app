import { EnTete } from "@/components/EnTete";
import { EtatVide } from "@/components/EtatVide";

export function AccueilPage() {
  return (
    <div className="flex flex-col gap-12">
      <EnTete titre="Accueil" />
      <EtatVide titre="Ton parcours, ta semaine et tes morceaux en cours s’afficheront ici." />
    </div>
  );
}
