-- ctrl.app : base de données et stockage pour les comptes et la synchronisation.
-- À coller une seule fois dans Supabase → SQL Editor → New query → Run.
-- Le script peut être relancé sans risque.

-- 1. Une seule table : chaque objet de l’app (morceau, contact, board…) est
--    une ligne, rangée par collection. L’app est « local d’abord » : elle
--    envoie ses changements et récupère ceux des autres appareils.
create table if not exists public.objets (
  owner_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null,
  id         uuid        not null,
  donnees    jsonb,
  supprime   boolean     not null default false,
  modifie_le timestamptz not null,
  recu_le    timestamptz not null default now(),
  primary key (owner_id, collection, id)
);

create index if not exists objets_reception on public.objets (owner_id, recu_le);

-- « recu_le » est l’heure du serveur : c’est le repère pour savoir ce qui a
-- changé depuis la dernière synchronisation.
create or replace function public.objets_recu_le() returns trigger
language plpgsql as $$
begin
  new.recu_le := now();
  return new;
end $$;

drop trigger if exists objets_recu_le on public.objets;
create trigger objets_recu_le before insert or update on public.objets
for each row execute function public.objets_recu_le();

-- 2. Sécurité (Row Level Security) : chaque compte ne voit et ne modifie que
--    ses propres lignes. La clé publique de l’app n’ouvre rien d’autre.
alter table public.objets enable row level security;

drop policy if exists "objets : lire les siens" on public.objets;
create policy "objets : lire les siens" on public.objets
  for select using (owner_id = auth.uid());

drop policy if exists "objets : créer les siens" on public.objets;
create policy "objets : créer les siens" on public.objets
  for insert with check (owner_id = auth.uid());

drop policy if exists "objets : modifier les siens" on public.objets;
create policy "objets : modifier les siens" on public.objets
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "objets : supprimer les siens" on public.objets;
create policy "objets : supprimer les siens" on public.objets
  for delete using (owner_id = auth.uid());

-- 3. Stockage des fichiers (audio, covers, images), privé : chaque compte a
--    son dossier, nommé par son identifiant.
insert into storage.buckets (id, name, public)
values ('fichiers', 'fichiers', false)
on conflict (id) do nothing;

drop policy if exists "fichiers : lire les siens" on storage.objects;
create policy "fichiers : lire les siens" on storage.objects
  for select using (bucket_id = 'fichiers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "fichiers : ajouter les siens" on storage.objects;
create policy "fichiers : ajouter les siens" on storage.objects
  for insert with check (bucket_id = 'fichiers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "fichiers : modifier les siens" on storage.objects;
create policy "fichiers : modifier les siens" on storage.objects
  for update using (bucket_id = 'fichiers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "fichiers : supprimer les siens" on storage.objects;
create policy "fichiers : supprimer les siens" on storage.objects
  for delete using (bucket_id = 'fichiers' and (storage.foldername(name))[1] = auth.uid()::text);
