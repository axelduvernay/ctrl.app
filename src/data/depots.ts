import { creerDepotsLocaux } from "./local";

/** Implémentation utilisée par l’app : IndexedDB, synchronisée avec Supabase
    quand un compte est connecté (voir src/data/remote). */
const local = creerDepotsLocaux();
export const depots = local.depots;
/** Réservé à la synchronisation : les écrans ne s’en servent jamais. */
export const moteurLocal = local.moteur;
