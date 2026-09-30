/* Les sons de l'interface.

   Chaque moment de l'app porte un nom (« create », « check »…). Le son
   correspondant est le fichier `sounds/<nom>.wav` ou `sounds/<nom>.mp3` :
   un fichier absent ne joue simplement rien. On peut donc ajouter les sons un
   par un, sans toucher au code. La liste et l'intention de chaque son sont
   dans `sounds/README.md`.

   Lecture par Web Audio plutôt que par <audio> : latence quasi nulle,
   plusieurs sons peuvent se superposer, et le volume se règle finement. */

export const SOUNDS = [
  "create", "delete", "check", "uncheck", "archive",
  "link", "unlink", "snap", "drop", "align",
  "undo", "redo", "expand", "collapse", "detent", "reminder",
];

const EXTENSIONS = ["wav", "mp3"];
const buffers = new Map();   // nom → AudioBuffer, ou null si absent
const lastPlayed = new Map();
let ctx = null;
let master = null;

const enabled = () => {
  try { return localStorage.getItem("ctrl-sounds") !== "off"; } catch { return true; }
};

export function soundsEnabled() {
  return enabled();
}

export function setSoundsEnabled(on) {
  try { localStorage.setItem("ctrl-sounds", on ? "on" : "off"); } catch {}
}

/* Les navigateurs n'autorisent le son qu'après un premier geste : le
   contexte audio naît au premier clic ou à la première touche, et les
   fichiers se chargent à ce moment-là. */
export function initSounds() {
  const unlock = () => {
    removeEventListener("pointerdown", unlock, true);
    removeEventListener("keydown", unlock, true);
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    for (const name of SOUNDS) load(name);
  };
  addEventListener("pointerdown", unlock, true);
  addEventListener("keydown", unlock, true);
}

async function load(name) {
  for (const ext of EXTENSIONS) {
    try {
      const res = await fetch(`sounds/${name}.${ext}`);
      if (!res.ok) continue;
      buffers.set(name, await ctx.decodeAudioData(await res.arrayBuffer()));
      return;
    } catch {
      // Fichier illisible : on essaie l'extension suivante.
    }
  }
  buffers.set(name, null);
}

/** Joue un son s'il existe. Un même son ne se répète pas à moins de 50 ms. */
export function play(name, { volume = 1 } = {}) {
  if (!ctx || !enabled()) return;
  const buffer = buffers.get(name);
  if (!buffer) return;
  const now = performance.now();
  if (now - (lastPlayed.get(name) || 0) < 50) return;
  lastPlayed.set(name, now);
  if (ctx.state === "suspended") ctx.resume();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(gain).connect(master);
  source.start();
}
