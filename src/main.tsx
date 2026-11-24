import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./app/App";
import "./styles/index.css";
import { demarrer } from "./data/remote/sync";

createRoot(document.getElementById("racine")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// Hors ligne : en production seulement (en développement, le cache gênerait).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}

// Comptes : reprend la session et la synchronisation si cet appareil est relié à un compte.
void demarrer();
