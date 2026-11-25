/* Worker : l’analyse tourne hors de l’écran, l’interface reste fluide. */
import { analyser } from "./analyse-calcul";

self.onmessage = (e: MessageEvent<{ signal: Float32Array; taux: number }>) => {
  self.postMessage(analyser(e.data.signal, e.data.taux));
};
