/* Les blocs liste : tracklist et dossier.

   Un seul composant pour deux usages. Une tracklist garde des morceaux dans
   un ordre, et les joue à la suite ; un dossier garde des fichiers de tout
   type. Dans les deux cas on renomme, on réordonne, on retire — et les
   fichiers partent dans le magasin d'assets comme les images, le bloc n'en
   garde que la clé. */

import { state, mutate, putAsset, assetURL } from "./store.js";
import { render, nodeFor } from "./render.js";
import { el, icon, uid } from "./util.js";
import { toast } from "./main.js";

export const LIST_TYPES = {
  tracks: { title: "Tracklist", accept: "audio/*", empty: "Dépose des morceaux ici" },
  files: { title: "Dossier", accept: "", empty: "Dépose des fichiers ici" },
};

const ICONS = {
  tracks: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  files: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  file: '<path d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>',
  grip: '<path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};

export const isAudio = (file) => file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|flac|ogg|aiff?)$/i.test(file.name);

/** Transforme un bloc texte en liste ; le texte déjà écrit devient son titre. */
export function toList(block, type) {
  block.kind = "list";
  block.list = type;
  block.items = block.items || [];
  block.w = Math.max(block.w, 300);
}

/** Ajoute des fichiers à une liste. Une tracklist n'accepte que l'audio. */
export async function addFiles(id, files) {
  const b = state.doc.blocks[id];
  if (!b) return;
  const kept = b.list === "tracks" ? files.filter(isAudio) : files;
  if (kept.length < files.length) toast("Une tracklist n'accepte que des fichiers audio");
  if (!kept.length) return;
  const items = [];
  for (const file of kept) {
    items.push({
      id: uid(),
      name: file.name.replace(/\.[^.]+$/, ""),
      file: file.name,
      type: file.type,
      size: file.size,
      asset: await putAsset(file),
    });
  }
  mutate(() => { b.items.push(...items); b.updatedAt = Date.now(); });
  render();
}

function pickFiles(id) {
  const b = state.doc.blocks[id];
  const input = el("input", { type: "file", multiple: true, accept: LIST_TYPES[b.list].accept || false });
  input.onchange = () => addFiles(id, [...input.files]);
  input.click();
}

function removeItem(id, itemId) {
  const b = state.doc.blocks[id];
  if (playing && playing.block === id && playing.item === itemId) stop();
  mutate(() => { b.items = b.items.filter((it) => it.id !== itemId); });
  render();
}

/** Déplace un élément à un nouvel index — appelé pendant le glisser de la poignée. */
export function moveItem(id, itemId, index) {
  const b = state.doc.blocks[id];
  const from = b.items.findIndex((it) => it.id === itemId);
  if (from < 0 || from === index) return false;
  const [it] = b.items.splice(from, 1);
  b.items.splice(index, 0, it);
  return true;
}

/** Index visé par le pointeur, d'après la position des lignes à l'écran. */
export function indexAt(id, clientY) {
  const rows = [...(nodeFor(id)?.querySelectorAll("[data-item]") || [])];
  let index = 0;
  for (const row of rows) {
    const r = row.getBoundingClientRect();
    if (clientY > r.top + r.height / 2) index++;
  }
  return Math.min(index, rows.length - 1);
}

/* ---------- Lecture ---------- */

/* Un seul lecteur pour tout le board : lancer un morceau arrête le précédent,
   et la fin d'un morceau enchaîne sur le suivant de la même tracklist. */
const audio = new Audio();
let playing = null; // { block, item, url }

audio.addEventListener("ended", () => {
  const b = playing && state.doc.blocks[playing.block];
  const i = b ? b.items.findIndex((it) => it.id === playing.item) : -1;
  const next = b && b.items[i + 1];
  next ? play(b.id, next.id) : stop();
});

audio.addEventListener("timeupdate", () => {
  if (!playing || !audio.duration) return;
  const bar = nodeFor(playing.block)?.querySelector(`[data-item="${playing.item}"] .progress`);
  if (bar) bar.style.width = (audio.currentTime / audio.duration) * 100 + "%";
});

function play(id, itemId) {
  const it = state.doc.blocks[id]?.items.find((x) => x.id === itemId);
  const url = it && assetURL(it.asset);
  if (!url) return toast("Fichier introuvable sur cet appareil");
  if (playing?.url) URL.revokeObjectURL(playing.url);
  playing = { block: id, item: itemId, url };
  audio.src = url;
  audio.play().catch(() => {});
  render();
}

function stop() {
  audio.pause();
  if (playing?.url) URL.revokeObjectURL(playing.url);
  playing = null;
  render();
}

function toggle(id, itemId) {
  if (playing && playing.block === id && playing.item === itemId) {
    audio.paused ? audio.play() : audio.pause();
    render();
  } else {
    play(id, itemId);
  }
}

/* Un dossier ouvre ce que le navigateur sait afficher, et télécharge le reste. */
function open(it) {
  const url = assetURL(it.asset);
  if (!url) return toast("Fichier introuvable sur cet appareil");
  const viewable = /^(image|video|audio|text)\/|^application\/pdf$/.test(it.type || "");
  const a = el("a", { href: url, target: "_blank", rel: "noopener", download: viewable ? false : it.file || it.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ---------- Renommer un élément ---------- */

let renaming = null;

export function renameItem(id, itemId, element) {
  renaming = itemId;
  element.contentEditable = "true";
  element.focus();
  const range = document.createRange();
  range.selectNodeContents(element);
  getSelection().removeAllRanges();
  getSelection().addRange(range);

  const finish = (keep) => {
    element.removeEventListener("blur", onBlur);
    element.removeEventListener("keydown", onKey);
    element.contentEditable = "false";
    renaming = null;
    const name = element.textContent.trim();
    const it = state.doc.blocks[id]?.items.find((x) => x.id === itemId);
    if (keep && it && name && name !== it.name) mutate(() => { it.name = name; });
    render();
  };
  const onBlur = () => finish(true);
  const onKey = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); element.blur(); }
    if (e.key === "Escape") { e.preventDefault(); finish(false); }
  };
  element.addEventListener("blur", onBlur);
  element.addEventListener("keydown", onKey);
}

/* ---------- Rendu ---------- */

export function renderList(node, body, b) {
  const isPlaying = (it) => playing && playing.block === b.id && playing.item === it.id;
  // Pas de reconstruction pendant une saisie : elle ferait perdre le curseur.
  const sig = JSON.stringify([b.text, b.list, b.items.map((it) => [it.id, it.name]),
    playing?.block === b.id ? [playing.item, audio.paused] : null]);
  if (state.editing === b.id || renaming || node._sig === sig) return;
  node._sig = sig;

  const type = LIST_TYPES[b.list] || LIST_TYPES.files;
  const rows = b.items.map((it, i) =>
    el("li", { class: "item" + (isPlaying(it) ? " is-playing" : ""), "data-item": it.id },
      b.list === "tracks"
        ? el("button", {
            type: "button", class: "item-btn", "data-action": true,
            "aria-label": isPlaying(it) && !audio.paused ? "Pause" : "Lire",
            onclick: () => toggle(b.id, it.id),
          }, icon(isPlaying(it) && !audio.paused ? ICONS.pause : ICONS.play, 14))
        : el("button", {
            type: "button", class: "item-btn", "data-action": true, "aria-label": "Ouvrir",
            onclick: () => open(it),
          }, icon(ICONS.file, 14)),
      b.list === "tracks" ? el("span", { class: "item-num", text: String(i + 1) }) : null,
      el("span", { class: "item-name", "data-item-name": true, title: "Double-clic pour renommer", text: it.name }),
      el("span", { class: "item-grip", "data-item-grip": true, title: "Glisser pour réordonner" }, icon(ICONS.grip, 14)),
      el("button", {
        type: "button", class: "item-x", "data-action": true, "aria-label": "Retirer",
        onclick: () => removeItem(b.id, it.id),
      }, icon(ICONS.close, 12)),
      isPlaying(it) ? el("span", { class: "progress" }) : null
    )
  );

  body.className = "body list-body";
  body.replaceChildren(
    el("div", { class: "list-head" },
      icon(ICONS[b.list] || ICONS.files, 16),
      el("span", { class: "list-title", "data-list-title": true, "data-placeholder": type.title, text: b.text || "" }),
      el("span", { class: "list-count", text: b.items.length ? String(b.items.length) : "" })
    ),
    rows.length ? el("ol", { class: "items" }, rows) : el("div", { class: "list-empty", text: type.empty }),
    el("button", {
      type: "button", class: "list-add", "data-action": true,
      onclick: () => pickFiles(b.id),
    }, icon(ICONS.plus, 14), el("span", { text: b.list === "tracks" ? "Ajouter des morceaux" : "Ajouter des fichiers" }))
  );
}
