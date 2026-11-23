/* Nettoyage de l’ancienne app.
   Avant d’être renommée ctrl.mind, l’ancienne app vivait à cette adresse et
   installait un service worker ici. Les navigateurs qui l’ont gardé vont
   chercher ce fichier : il efface l’ancien cache, se désinstalle, puis
   recharge la page pour afficher la nouvelle app. */

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cles = await caches.keys();
      await Promise.all(cles.filter((c) => c.startsWith("ctrl-app-")).map((c) => caches.delete(c)));
      await self.registration.unregister();
      const fenetres = await self.clients.matchAll({ type: "window" });
      for (const f of fenetres) f.navigate(f.url);
    })(),
  );
});
