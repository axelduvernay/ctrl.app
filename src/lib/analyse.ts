/* Analyse d’un fichier audio dans le navigateur : forme d’onde, BPM et
   tonalité. Le décodage utilise le navigateur, les calculs un worker. */

import type { ResultatAnalyse } from "./analyse-calcul";

export type { ResultatAnalyse };

/** Décode le son en mono (moyenne des canaux). */
async function decoder(blob: Blob) {
  const contexte = new OfflineAudioContext(1, 1, 44100);
  const tampon = await contexte.decodeAudioData(await blob.arrayBuffer());
  const mono = new Float32Array(tampon.length);
  for (let c = 0; c < tampon.numberOfChannels; c++) {
    const canal = tampon.getChannelData(c);
    for (let i = 0; i < mono.length; i++) mono[i]! += canal[i]! / tampon.numberOfChannels;
  }
  return { signal: mono, taux: tampon.sampleRate, duree: tampon.duration };
}

/** Analyse complète. Renvoie null si le navigateur ne sait pas lire le fichier. */
export async function analyserAudio(blob: Blob): Promise<(ResultatAnalyse & { duree: number }) | null> {
  let decode: Awaited<ReturnType<typeof decoder>>;
  try {
    decode = await decoder(blob);
  } catch {
    return null;
  }
  const { signal, taux, duree } = decode;
  const resultat = await new Promise<ResultatAnalyse>((resoudre, rejeter) => {
    const worker = new Worker(new URL("./analyse.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<ResultatAnalyse>) => {
      resoudre(e.data);
      worker.terminate();
    };
    worker.onerror = (e) => {
      rejeter(e);
      worker.terminate();
    };
    worker.postMessage({ signal, taux }, [signal.buffer]);
  });
  return { ...resultat, duree };
}
