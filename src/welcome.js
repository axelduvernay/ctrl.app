/* Board d'accueil, posé une seule fois au tout premier lancement.

   Il sert de mode d'emploi : chaque bloc énonce un geste, et le board lui-même
   prouve à quoi ressemble un tableau rempli. Il est ordinaire — on le déplace,
   le modifie et le supprime comme n'importe quel contenu. */

import { addBlock, addZone, addLink, state } from "./store.js";

export function seedWelcome() {
  const zone = addZone({ welcome: true, x: -360, y: -250, w: 840, h: 300, name: "Bienvenue" });

  const first = addBlock({ welcome: true,
    x: -330, y: -200, w: 240, h: 92,
    text: "Double-clique n'importe où sur le fond pour écrire.",
    category: null,
  });

  const second = addBlock({ welcome: true,
    x: -60, y: -200, w: 240, h: 92,
    text: "Dans un bloc, tape /task ou /idea pour lui donner un sens.",
    category: "idea",
  });

  addBlock({ welcome: true,
    x: 210, y: -200, w: 240, h: 92,
    text: "Clic droit sur un bloc : catégorie, échéance, liens.",
    category: null,
  });

  addBlock({ welcome: true,
    x: -330, y: -80, w: 240, h: 92,
    text: "Glisse une image ou un fichier depuis ton bureau.",
    category: null,
  });

  addBlock({ welcome: true,
    x: -60, y: -80, w: 240, h: 92,
    text: "Aligne tout proprement d’un clic, avec le bouton en bas ou la touche R.",
    category: "task",
  });

  addBlock({ welcome: true,
    x: 210, y: -80, w: 240, h: 92,
    text: "⌘F pour chercher, 1 à 3 pour filtrer, ⌘Z pour annuler.",
    category: null,
  });

  addBlock({ welcome: true,
    x: -60, y: 110, w: 260, h: 92,
    text: "Supprime ces blocs quand tu n'en as plus besoin : c'est ton tableau.",
  });

  addLink(first.id, second.id);
  state.doc.rev = 1;
}
