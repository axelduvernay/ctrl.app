/* Connexion au cloud (Supabase).

   Ces deux valeurs sont publiques par conception : elles identifient le
   projet, elles n'ouvrent rien. Ce qui protège les données, ce sont les
   règles de la base (Row Level Security, voir supabase/schema.sql) : chaque
   compte ne lit et n'écrit que ses propres lignes.

   Ne JAMAIS mettre ici la clé « secret » / « service_role ». */

export const SUPABASE_URL = "https://boksigypdsbpmshmylhv.supabase.co";
export const SUPABASE_KEY = "sb_publishable_M_PWhjw8JyeAqPUZwyQWGA_8VydEc6A";

// Bibliothèque chargée à la demande depuis le CDN : sans réseau, l'app
// démarre quand même, simplement sans synchronisation.
export const SUPABASE_LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm";
