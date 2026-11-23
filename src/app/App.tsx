import { Navigate, Route, Routes } from "react-router";
import { Coquille } from "./Coquille";
import { AccueilPage } from "@/features/accueil/AccueilPage";
import { MusiquePage } from "@/features/musique/MusiquePage";
import { SortiesPage } from "@/features/sorties/SortiesPage";
import { ReseauPage } from "@/features/reseau/ReseauPage";
import { BoardsPage } from "@/features/boards/BoardsPage";
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
        <Route path="/sorties" element={<SortiesPage />} />
        <Route path="/reseau" element={<ReseauPage />} />
        <Route path="/boards" element={<BoardsPage />} />
        <Route path="/reglages" element={<ReglagesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
