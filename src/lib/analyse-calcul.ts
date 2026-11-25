/* Calculs d’analyse audio, sans écran ni navigateur : forme d’onde, tempo
   (BPM) et tonalité. Utilisés par le worker de src/lib/analyse.ts. */

export interface ResultatAnalyse {
  pics: number[];
  bpm: number | null;
  tonalite: string | null;
}

const NB_PICS = 600;

/* ---------- FFT (radix 2, en place) ---------- */

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

function fenetreHann(n: number) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

/** Spectre d’amplitude de chaque trame (taille n, pas « saut »). */
function* spectres(signal: Float32Array, n: number, saut: number) {
  const w = fenetreHann(n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const mag = new Float64Array(n / 2);
  for (let debut = 0; debut + n <= signal.length; debut += saut) {
    for (let i = 0; i < n; i++) {
      re[i] = signal[debut + i]! * w[i]!;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < n / 2; k++) mag[k] = Math.hypot(re[k]!, im[k]!);
    yield mag;
  }
}

/** Moyenne par paquets de « facteur » échantillons (filtre simple + décimation). */
function decimer(signal: Float32Array, facteur: number) {
  const sortie = new Float32Array(Math.floor(signal.length / facteur));
  for (let i = 0; i < sortie.length; i++) {
    let s = 0;
    for (let j = 0; j < facteur; j++) s += signal[i * facteur + j]!;
    sortie[i] = s / facteur;
  }
  return sortie;
}

/* ---------- Forme d’onde ---------- */

export function calculerPics(signal: Float32Array, nb = NB_PICS): number[] {
  const pics: number[] = [];
  const pas = signal.length / nb;
  let max = 0;
  for (let i = 0; i < nb; i++) {
    const debut = Math.floor(i * pas);
    const fin = Math.max(debut + 1, Math.floor((i + 1) * pas));
    // Moyenne quadratique : plus lisible que le maximum (moins de barres pleines).
    let s = 0;
    for (let j = debut; j < fin && j < signal.length; j++) s += signal[j]! * signal[j]!;
    const v = Math.sqrt(s / (fin - debut));
    pics.push(v);
    if (v > max) max = v;
  }
  return pics.map((v) => (max ? Math.round((v / max) * 1000) / 1000 : 0));
}

/* ---------- Tempo ---------- */

/** Enveloppe d’attaques : hausse du spectre (en log) d’une trame à l’autre,
    calculée par bande (graves, médiums, aigus) puis équilibrée, pour que le
    kick et la caisse claire pèsent autant que les charleys. */
function enveloppeAttaques(signal: Float32Array, taux: number) {
  const n = 1024;
  const saut = 256;
  const bandes = [
    [30, 200],
    [200, 2000],
    [2000, 8000],
  ].map(([a, b]) => [Math.max(1, Math.round((a! / taux) * n)), Math.min(n / 2, Math.round((b! / taux) * n))] as const);
  const kMax = bandes[2]![1];
  let precedent: Float64Array | null = null;
  const parBande: number[][] = bandes.map(() => []);
  for (const mag of spectres(signal, n, saut)) {
    const log = new Float64Array(kMax);
    for (let k = 0; k < kMax; k++) log[k] = Math.log1p(100 * mag[k]!);
    bandes.forEach(([a, b], i) => {
      let flux = 0;
      if (precedent) for (let k = a; k < b; k++) flux += Math.max(0, log[k]! - precedent[k]!);
      parBande[i]!.push(flux);
    });
    precedent = log;
  }
  const longueur = parBande[0]!.length;
  const env = new Float64Array(longueur);
  for (const bande of parBande) {
    const propre = sansTendance(bande);
    const moyenne = propre.reduce((a, b) => a + b, 0) / longueur;
    const ecart = Math.sqrt(propre.reduce((a, b) => a + (b - moyenne) ** 2, 0) / longueur) || 1;
    for (let i = 0; i < longueur; i++) env[i]! += propre[i]! / ecart;
  }
  return { env, trames: taux / saut };
}

/** Retire la tendance lente (moyenne glissante) pour ne garder que les attaques. */
function sansTendance(env: number[]) {
  const sortie = new Float64Array(env.length);
  const demi = 8;
  for (let i = 0; i < env.length; i++) {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - demi); j <= Math.min(env.length - 1, i + demi); j++) {
      s += env[j]!;
      c++;
    }
    sortie[i] = Math.max(0, env[i]! - s / c);
  }
  return sortie;
}

function autocorrelation(x: Float64Array, lagMax: number) {
  const ac = new Float64Array(lagMax + 1);
  for (let lag = 0; lag <= lagMax; lag++) {
    let s = 0;
    for (let i = 0; i + lag < x.length; i++) s += x[i]! * x[i + lag]!;
    ac[lag] = s / (x.length - lag);
  }
  return ac;
}

/** Valeur interpolée de l’autocorrélation à un décalage non entier. */
const lire = (ac: Float64Array, lag: number) => {
  const i = Math.floor(lag);
  if (i + 1 >= ac.length) return 0;
  const f = lag - i;
  return ac[i]! * (1 - f) + ac[i + 1]! * f;
};

export function estimerBpm(signal: Float32Array, taux: number): number | null {
  if (signal.length < taux * 6) return null; // moins de 6 secondes : pas fiable
  const { env, trames } = enveloppeAttaques(signal, taux);
  const lagMax = Math.ceil(trames * (60 / 50) * 8) + 2;
  const ac = autocorrelation(env, Math.min(lagMax, env.length - 1));
  if (!ac[0]) return null;

  // Score d’un tempo : l’autocorrélation à chaque multiple de la période
  // (plus on va loin, plus la mesure est précise), avec une préférence douce
  // pour les tempos courants (autour de 110 BPM).
  const score = (bpm: number) => {
    const periode = (60 / bpm) * trames;
    let s = 0;
    for (let k = 1; k <= 8; k++) s += lire(ac, k * periode) / Math.sqrt(k);
    // Demi-temps et contretemps : un vrai tempo a aussi du sens à mi-période.
    s += 0.25 * lire(ac, periode / 2);
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 115) / 1.1) ** 2);
    return s * prior;
  };

  let meilleur = 0;
  let meilleurScore = -Infinity;
  for (let bpm = 60; bpm <= 190; bpm += 0.5) {
    const s = score(bpm);
    if (s > meilleurScore) [meilleur, meilleurScore] = [bpm, s];
  }
  // Affinage au centième autour du meilleur.
  for (let bpm = meilleur - 1; bpm <= meilleur + 1; bpm += 0.02) {
    const s = score(bpm);
    if (s > meilleurScore) [meilleur, meilleurScore] = [bpm, s];
  }
  if (meilleurScore <= 0) return null;
  return Math.round(meilleur);
}

/* ---------- Tonalité ---------- */

const NOTES = ["Do", "Do♯", "Ré", "Mi♭", "Mi", "Fa", "Fa♯", "Sol", "La♭", "La", "Si♭", "Si"];
// Profils de Krumhansl-Kessler (importance de chaque degré dans la gamme).
const MAJEUR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINEUR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlation(a: number[], b: number[]) {
  const ma = a.reduce((s, x) => s + x, 0) / a.length;
  const mb = b.reduce((s, x) => s + x, 0) / b.length;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i]! - ma) * (b[i]! - mb);
    da += (a[i]! - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Chromagramme du morceau : énergie de chacune des 12 notes, sur tout le
    spectre et dans les basses seules (la basse appuie souvent la tonique). */
export function chroma(signal: Float32Array, taux: number) {
  const facteur = Math.max(1, Math.floor(taux / 11025));
  const s = decimer(signal, facteur);
  const t = taux / facteur;
  const n = 8192;
  const total = new Array<number>(12).fill(0);
  const basses = new Array<number>(12).fill(0);
  // Note (en demi-tons depuis le La 440) de chaque case du spectre.
  const notes: { k: number; classe: number; poids: number; basse: boolean }[] = [];
  for (let k = 1; k < n / 2; k++) {
    const f = (k * t) / n;
    if (f < 55 || f > 1760) continue;
    const demiTons = 12 * Math.log2(f / 440);
    const proche = Math.round(demiTons);
    const ecart = Math.abs(demiTons - proche);
    if (ecart > 0.35) continue; // entre deux notes : on ignore
    notes.push({ k, classe: (((proche + 9) % 12) + 12) % 12, poids: 1 - ecart / 0.35, basse: f < 220 });
  }
  for (const mag of spectres(s, n, n / 2)) {
    const trame = new Array<number>(12).fill(0);
    const grave = new Array<number>(12).fill(0);
    for (const { k, classe, poids, basse } of notes) {
      // Ne garde que les pics locaux (les harmoniques nettes, pas le bruit).
      if (mag[k]! < mag[k - 1]! || mag[k]! < mag[k + 1]!) continue;
      const v = Math.sqrt(mag[k]!) * poids;
      trame[classe]! += v;
      if (basse) grave[classe]! += v;
    }
    const somme = trame.reduce((a, b) => a + b, 0);
    if (somme > 0) for (let i = 0; i < 12; i++) total[i]! += trame[i]! / somme;
    const sommeGrave = grave.reduce((a, b) => a + b, 0);
    if (sommeGrave > 0) for (let i = 0; i < 12; i++) basses[i]! += grave[i]! / sommeGrave;
  }
  return { total, basses };
}

export function estimerTonalite(signal: Float32Array, taux: number): string | null {
  if (signal.length < taux * 4) return null;
  const { total: c, basses } = chroma(signal, taux);
  if (c.every((v) => v === 0)) return null;
  const sommeBasses = basses.reduce((a, b) => a + b, 0) || 1;
  let meilleur = { nom: "", score: -Infinity };
  for (let tonique = 0; tonique < 12; tonique++) {
    const tourne = c.slice(tonique).concat(c.slice(0, tonique));
    // Bonus si la tonique est la note la plus présente dans les basses.
    const appui = 0.6 * (basses[tonique]! / sommeBasses);
    const maj = correlation(tourne, MAJEUR) + appui;
    const min = correlation(tourne, MINEUR) + appui;
    if (maj > meilleur.score) meilleur = { nom: `${NOTES[tonique]} majeur`, score: maj };
    if (min > meilleur.score) meilleur = { nom: `${NOTES[tonique]} mineur`, score: min };
  }
  return meilleur.score > 0.3 ? meilleur.nom : null;
}

export function analyser(signal: Float32Array, taux: number): ResultatAnalyse {
  return {
    pics: calculerPics(signal),
    bpm: estimerBpm(signal, taux),
    tonalite: estimerTonalite(signal, taux),
  };
}
