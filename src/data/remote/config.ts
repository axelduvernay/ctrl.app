/* Projet Supabase de ctrl.app (séparé de celui de ctrl.mind).
   Ces deux valeurs sont publiques par conception : elles identifient le
   projet, elles n’ouvrent rien. Ce qui protège les données, ce sont les règles
   de la base (Row Level Security, voir supabase/schema.sql) : chaque compte ne
   lit et n’écrit que ses propres lignes.
   Ne JAMAIS mettre ici la clé secrète ni la clé « service_role ». */

export const SUPABASE_URL = "https://hsxsgszdzcupguuhgzlb.supabase.co";
export const SUPABASE_CLE = "sb_publishable_OAP9t6Z6orszgfWKGBx4wA_Oe5xkGgw";
