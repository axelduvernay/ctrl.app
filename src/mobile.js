/* Le téléphone : la page reste immobile, seul le board bouge.

   - Safari ignore « user-scalable=no » : un pincement sur une barre ou un
     menu zoomait toute la page, et l'app restait coincée agrandie. On bloque
     les gestes de la page ; le board, lui, gère ses propres pincements.
   - Le clavier fait défiler la page pour montrer le curseur, et iOS oublie
     parfois de la remettre en place : tout se retrouvait décalé sous les
     doigts. On la recale dès que le clavier se ferme.
   - L'appui long ne sélectionne pas de texte et n'ouvre pas la loupe hors
     de l'édition. */

export function initMobile() {
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
  // Deux doigts hors du board (barre, menu) : pas de zoom de la page.
  document.addEventListener("touchmove", (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  const settle = () => {
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  };
  document.addEventListener("focusout", () => setTimeout(settle, 60));
  visualViewport?.addEventListener("resize", () => {
    // Clavier refermé : la fenêtre visible retrouve toute sa hauteur.
    if (visualViewport.height >= innerHeight - 1) settle();
  });
  addEventListener("orientationchange", () => setTimeout(settle, 300));
}
