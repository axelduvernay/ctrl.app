/** Ouvre le sélecteur de fichiers du système. À appeler directement dans un
    clic (les navigateurs l’exigent). */
export function choisirFichiers(accept: string, multiple = true): Promise<File[]> {
  return new Promise((resoudre) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resoudre([...(input.files ?? [])]);
    input.click();
  });
}

export const ACCEPTE_AUDIO = "audio/*,.wav,.mp3,.m4a,.aif,.aiff,.flac";
