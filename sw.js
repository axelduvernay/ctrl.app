self.__PRECACHE__ = ["/ctrl.app/","/ctrl.app/assets/ActionsEnTete-Dr5H_qIs.js","/ctrl.app/assets/BoardPage-BnASmKay.js","/ctrl.app/assets/BoardsPage-BPCQ8gTl.js","/ctrl.app/assets/ContactPage-2tE6LKlM.js","/ctrl.app/assets/DistributionPage-CRbISLa0.js","/ctrl.app/assets/EnTete-tAfM9O5n.js","/ctrl.app/assets/EnvoiPage-Ixc_pXH_.js","/ctrl.app/assets/EtatVide-CPCR1onq.js","/ctrl.app/assets/FicheMorceau-D6BfSdMn.js","/ctrl.app/assets/FilAriane-XupJiYk1.js","/ctrl.app/assets/MusiquePage-DX6uWRMH.js","/ctrl.app/assets/ParcoursPage-VBNk0o-9.js","/ctrl.app/assets/ProjetPage-C3RG4qky.js","/ctrl.app/assets/ReglagesPage-CJ5NTThJ.js","/ctrl.app/assets/ReseauPage-DjOBiL76.js","/ctrl.app/assets/SortiePage-RXQy4pt0.js","/ctrl.app/assets/SortiesPage-DuA2Edxm.js","/ctrl.app/assets/TachesPage-BuNT8Kd-.js","/ctrl.app/assets/actions-zZIjJgsM.js","/ctrl.app/assets/analyse.worker-CqtoE2Zk.js","/ctrl.app/assets/format-BwpnR64x.js","/ctrl.app/assets/index-KuNSWOLC.css","/ctrl.app/assets/index-PcR5MDcP.js","/ctrl.app/assets/supabase-LJsHV9_a.js","/ctrl.app/favicon.svg","/ctrl.app/fonts/Satoshi-Variable.woff2","/ctrl.app/fonts/Satoshi-VariableItalic.woff2","/ctrl.app/icones/apple-touch-icon.png","/ctrl.app/icones/icone-192.png","/ctrl.app/icones/icone-512.png","/ctrl.app/icones/icone-masquable-512.png","/ctrl.app/index.html","/ctrl.app/manifest.webmanifest"];
self.__VERSION__ = "9b1d8d758c";
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
