import { EnTete } from "@/components/EnTete";
import { EtatVide } from "@/components/EtatVide";

export function BoardsPage() {
  return (
    <div className="flex flex-col gap-12">
      <EnTete titre="Boards" />
      <EtatVide titre="Tes boards s’afficheront ici." />
    </div>
  );
}
