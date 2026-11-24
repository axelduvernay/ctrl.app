/* Service worker de ctrl.app : l’app démarre et fonctionne hors ligne.

   - À l’installation, il met en cache toute l’app construite (la liste des
     fichiers est injectée par scripts/apres-build.mjs).
   - Pages : réseau d’abord, cache si le réseau manque.
   - Fichiers de l’app (noms avec empreinte) : cache d’abord.
   - Il efface aussi les caches de l’ancienne app qui vivait à cette adresse
     (ctrl.mind, ex-ctrl.app : caches « ctrl-app-… »). Ne pas supprimer.
   Les données de l’utilisateur ne passent jamais par ici : elles sont dans
   IndexedDB. */

const FICHIERS = self.__PRECACHE__ || [];
const CACHE = "ctrlapp-" + (self.__VERSION__ || "dev");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(FICHIERS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cles = await caches.keys();
      await Promise.all(cles.filter((c) => c !== CACHE && (c.startsWith("ctrl-app-") || c.startsWith("ctrlapp-"))).map((c) => caches.delete(c)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  const portee = new URL(self.registration.scope).pathname;
  if (!new URL(req.url).pathname.startsWith(portee)) return;

  if (req.mode === "navigate") {
    // Réseau d’abord ; hors ligne, l’app (index.html) gère la route.
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(req, { ignoreVary: true })) || (await caches.match(portee + "index.html", { ignoreVary: true })) || Response.error()),
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (enCache) =>
        enCache ||
        fetch(req).then((rep) => {
          if (rep.ok && new URL(req.url).pathname.startsWith(portee + "assets/")) {
            const copie = rep.clone();
            void caches.open(CACHE).then((c) => c.put(req, copie));
          }
          return rep;
        }),
    ),
  );
});
