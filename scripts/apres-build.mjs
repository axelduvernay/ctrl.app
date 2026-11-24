/* Après « vite build » :
   1. copie index.html en 404.html (GitHub Pages sert 404.html pour les
      adresses inconnues : l’app gère alors elle-même la route) ;
   2. injecte dans dist/sw.js la liste des fichiers à mettre en cache et une
      version (empreinte de cette liste), pour le mode hors ligne. */

import { createHash } from "node:crypto";
import { copyFileSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const dist = "dist";
const base = "/ctrl.app/";
copyFileSync(join(dist, "index.html"), join(dist, "404.html"));

function lister(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? lister(chemin) : [chemin];
  });
}

const fichiers = lister(dist)
  .map((f) => relative(dist, f).split("\\").join("/"))
  .filter((f) => !["sw.js", "404.html"].includes(f))
  .map((f) => base + f)
  .concat(base)
  .sort();

const empreinte = createHash("sha1");
for (const f of fichiers) {
  const local = f === base ? "index.html" : f.slice(base.length);
  empreinte.update(f).update(readFileSync(join(dist, local)));
}
const version = empreinte.digest("hex").slice(0, 10);

const sw = join(dist, "sw.js");
writeFileSync(sw, `self.__PRECACHE__ = ${JSON.stringify(fichiers)};\nself.__VERSION__ = "${version}";\n` + readFileSync(sw, "utf8"));
console.log(`sw.js : ${fichiers.length} fichiers en cache, version ${version}`);
