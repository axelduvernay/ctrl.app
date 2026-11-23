import { Navigate, Route, Routes } from "react-router";
import { Coquille } from "./Coquille";
import { AccueilPage } from "@/features/accueil/AccueilPage";
import { MusiquePage } from "@/features/musique/MusiquePage";
import { FicheMorceau } from "@/features/musique/FicheMorceau";
import { ProjetPage } from "@/features/musique/ProjetPage";
import { SortiesPage } from "@/features/sorties/SortiesPage";
import { SortiePage } from "@/features/sorties/SortiePage";
import { DistributionPage } from "@/features/sorties/DistributionPage";
import { ReseauPage } from "@/features/reseau/ReseauPage";
import { ContactPage } from "@/features/reseau/ContactPage";
import { EnvoiPage } from "@/features/reseau/EnvoiPage";
import { BoardsPage } from "@/features/boards/BoardsPage";
import { BoardPage } from "@/features/boards/BoardPage";
import { ReglagesPage } from "@/features/reglages/ReglagesPage";
import { OnboardingPage } from "@/features/onboarding/OnboardingPage";
import { ParcoursPage } from "@/features/parcours/ParcoursPage";

export function App() {
  return (
    <Routes>
      <Route path="/bienvenue" element={<OnboardingPage />} />
      <Route element={<Coquille />}>
        <Route index element={<AccueilPage />} />
        <Route path="/parcours" element={<ParcoursPage />} />
        <Route path="/musique" element={<MusiquePage />} />
        <Route path="/musique/projets/:id" element={<ProjetPage />} />
        <Route path="/musique/:id" element={<FicheMorceau />} />
        <Route path="/sorties" element={<SortiesPage />} />
        <Route path="/sorties/distribution" element={<DistributionPage />} />
        <Route path="/sorties/:id" element={<SortiePage />} />
        <Route path="/reseau" element={<ReseauPage />} />
        <Route path="/reseau/envoi" element={<EnvoiPage />} />
        <Route path="/reseau/:id" element={<ContactPage />} />
        <Route path="/boards" element={<BoardsPage />} />
        <Route path="/boards/:id" element={<BoardPage />} />
        <Route path="/reglages" element={<ReglagesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
