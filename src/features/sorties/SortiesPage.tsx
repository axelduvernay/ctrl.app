import { EnTete } from "@/components/EnTete";
import { EtatVide } from "@/components/EtatVide";

export function SortiesPage() {
  return (
    <div className="flex flex-col gap-12">
      <EnTete titre="Sorties" />
      <EtatVide titre="Ton calendrier de sorties et tes checklists s’afficheront ici." />
    </div>
  );
}
