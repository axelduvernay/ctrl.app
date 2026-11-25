import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { execSync } from "node:child_process";

// Numéro de version affiché dans Réglages : commit publié et date du build.
const commit = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "local";
  }
})();

// L’app est publiée sur GitHub Pages, à l’adresse /ctrl.app/.
export default defineConfig({
  base: "/ctrl.app/",
  plugins: [react(), tailwindcss()],
  define: {
    __VERSION__: JSON.stringify(commit),
    __CONSTRUIT_LE__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
