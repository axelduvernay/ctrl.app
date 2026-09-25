/* Entrées et sorties : dépôt de fichiers, collage, export et import.

   Les images et fichiers ne sont jamais écrits dans le document : ils partent
   dans le magasin d'assets et le bloc n'en garde que la clé. */

import { state, mutate, addBlock, putAsset, emptyDoc, save, emit, migrate } from "./store.js";
import { toWorld, viewCenter } from "./viewport.js";
import { render } from "./render.js";
import { toast } from "./main.js";
import { addFiles, isAudio, toList, LIST_TYPES } from "./lists.js";

const MAX_W = 360;

export function initIO() {
  const canvas = document.getElementById("canvas");

  canvas.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });

  canvas.addEventListener("drop", async (e) => {
    e.preventDefault();
    const at = toWorld(e.clientX, e.clientY);
    const files = [...(e.dataTransfer?.files || [])];
    // Déposé sur une tracklist ou un dossier : les fichiers y entrent.
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-id]");
    const list = target && state.doc.blocks[target.dataset.id];
    if (files.length && list?.kind === "list") return addFiles(list.id, files);
    if (files.length) return dropFiles(files, at);

    const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (url) placeFromText(url, at);
  });

  addEventListener("paste", async (e) => {
    if (state.editing) return; // le collage dans un bloc en cours d'édition reste du texte
    const at = viewCenter();
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); return dropFiles(files, at); }
    const text = e.clipboardData?.getData("text/plain");
    if (text) { e.preventDefault(); placeFromText(text, at); }
  });
}

async function dropFiles(files, at) {
  // Que des morceaux : ils forment une tracklist plutôt qu'une pile de fichiers.
  if (files.every(isAudio)) {
    const block = mutate(() => {
      const b = addBlock({ x: Math.round(at.x - 150), y: Math.round(at.y - 40), text: LIST_TYPES.tracks.title });
      toList(b, "tracks");
      return b;
    });
    return addFiles(block.id, files);
  }
  let offset = 0;
  for (const file of files) {
    const key = await putAsset(file);
    if (file.type.startsWith("image/")) {
      const size = await imageSize(file);
      const scale = Math.min(1, MAX_W / size.w);
      mutate(() =>
        addBlock({
          kind: "image", asset: key, name: file.name,
          x: Math.round(at.x - (size.w * scale) / 2 + offset),
          y: Math.round(at.y - (size.h * scale) / 2 + offset),
          w: Math.round(size.w * scale), h: Math.round(size.h * scale),
        })
      );
    } else {
      mutate(() =>
        addBlock({
          kind: "file", asset: key, name: file.name,
          sub: describeSize(file.size),
          x: Math.round(at.x - 130 + offset), y: Math.round(at.y - 32 + offset),
          w: 260, h: 64,
        })
      );
    }
    offset += 22;
  }
  render();
  toast(files.length > 1 ? `${files.length} fichiers ajoutés` : "Ajouté");
}

function placeFromText(text, at) {
  const trimmed = text.trim();
  const isURL = /^https?:\/\/\S+$/i.test(trimmed);
  mutate(() =>
    addBlock(
      isURL
        ? { kind: "link", url: trimmed, name: prettyURL(trimmed), x: Math.round(at.x - 130), y: Math.round(at.y - 32), w: 260, h: 64 }
        : { kind: "text", text: trimmed, x: Math.round(at.x - 110), y: Math.round(at.y - 40), w: 240, h: 96 }
    )
  );
  render();
}

function prettyURL(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "").split("/").pop();
    return path ? decodeURIComponent(path).replace(/[-_]/g, " ") : u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function imageSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ w: 280, h: 200 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

function describeSize(bytes) {
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " Ko";
  return (bytes / 1024 / 1024).toFixed(1) + " Mo";
}

/* ---------- Export / import ---------- */

export async function exportBoard() {
  const assets = {};
  for (const [key, blob] of state.assets) {
    assets[key] = { type: blob.type, name: blob.name || "", data: await blobToBase64(blob) };
  }
  const payload = { format: "ctrl.app", version: 1, exportedAt: new Date().toISOString(), doc: state.doc, assets };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ctrl-board-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Board exporté");
}

export function importBoard() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload.format !== "ctrl.app") throw new Error("format");
      for (const [key, asset] of Object.entries(payload.assets || {})) {
        const blob = await base64ToBlob(asset.data, asset.type);
        state.assets.set(key, blob);
        await putAsset(blob);
      }
      state.doc = { ...emptyDoc(), ...payload.doc };
      migrate();
      state.selection.clear();
      save();
      render();
      emit("change");
      toast("Board importé");
    } catch {
      toast("Fichier illisible");
    }
  };
  input.click();
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.readAsDataURL(blob);
  });
}

async function base64ToBlob(data, type) {
  const res = await fetch(`data:${type || "application/octet-stream"};base64,${data}`);
  return res.blob();
}
