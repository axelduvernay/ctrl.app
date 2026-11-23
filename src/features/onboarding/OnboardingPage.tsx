import { Logo } from "@/components/Logo";

/** Premier lancement : le questionnaire en 4 étapes arrive ici. */
export function OnboardingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-fond px-8 py-10 lg:px-[72px]">
      <Logo taille={24} />
      <div className="flex flex-1 flex-col justify-center gap-4">
        <h1 className="text-titre">Tu fais quoi ?</h1>
        <p className="text-texte-2">Le questionnaire en 4 étapes arrive ici.</p>
      </div>
    </main>
  );
}
