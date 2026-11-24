import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { Coquille } from "./Coquille";
const TachesPage = lazy(() => import("@/features/taches/TachesPage").then((m) => ({ default: m.TachesPage })));
const ParcoursPage = lazy(() => import("@/features/parcours/ParcoursPage").then((m) => ({ default: m.ParcoursPage })));
const ReglagesPage = lazy(() => import("@/features/reglages/ReglagesPage").then((m) => ({ default: m.ReglagesPage })));
const BoardPage = lazy(() => import("@/features/boards/BoardPage").then((m) => ({ default: m.BoardPage })));
const BoardsPage = lazy(() => import("@/features/boards/BoardsPage").then((m) => ({ default: m.BoardsPage })));
const EnvoiPage = lazy(() => import("@/features/reseau/EnvoiPage").then((m) => ({ default: m.EnvoiPage })));
const ContactPage = lazy(() => import("@/features/reseau/ContactPage").then((m) => ({ default: m.ContactPage })));
const ReseauPage = lazy(() => import("@/features/reseau/ReseauPage").then((m) => ({ default: m.ReseauPage })));
const DistributionPage = lazy(() => import("@/features/sorties/DistributionPage").then((m) => ({ default: m.DistributionPage })));
const SortiePage = lazy(() => import("@/features/sorties/SortiePage").then((m) => ({ default: m.SortiePage })));
const SortiesPage = lazy(() => import("@/features/sorties/SortiesPage").then((m) => ({ default: m.SortiesPage })));
const ProjetPage = lazy(() => import("@/features/musique/ProjetPage").then((m) => ({ default: m.ProjetPage })));
const FicheMorceau = lazy(() => import("@/features/musique/FicheMorceau").then((m) => ({ default: m.FicheMorceau })));
const MusiquePage = lazy(() => import("@/features/musique/MusiquePage").then((m) => ({ default: m.MusiquePage })));
import { AccueilPage } from "@/features/accueil/AccueilPage";
import { OnboardingPage } from "@/features/onboarding/OnboardingPage";

export function App() {
  return (
    // Chaque onglet se charge à la première visite (moins de code au démarrage).
    <Suspense fallback={<div className="min-h-dvh bg-fond" />}>
    <Routes>
      <Route path="/bienvenue" element={<OnboardingPage />} />
      <Route element={<Coquille />}>
        <Route index element={<AccueilPage />} />
        <Route path="/taches" element={<TachesPage />} />
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
    </Suspense>
  );
}
