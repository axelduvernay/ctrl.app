-- ctrl.app — base de données et stockage.
-- À coller UNE fois dans Supabase → SQL Editor → New query → Run.
-- Le script peut être relancé sans risque : il ne casse rien de ce qui existe.

-- ---------------------------------------------------------------
-- 1. Le board : une ligne par compte.
-- ---------------------------------------------------------------
create table if not exists public.boards (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  doc        jsonb not null,
  rev        bigint not null default 1,
  updated_at timestamptz not null default now()
);

-- Row Level Security : sans règle explicite, personne ne lit ni n'écrit rien.
alter table public.boards enable row level security;

drop policy if exists "boards_select_own" on public.boards;
create policy "boards_select_own" on public.boards
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "boards_insert_own" on public.boards;
create policy "boards_insert_own" on public.boards
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "boards_update_own" on public.boards;
create policy "boards_update_own" on public.boards
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------
-- 2. Copies quotidiennes du board, gardées 30 jours.
-- ---------------------------------------------------------------
create table if not exists public.board_history (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  doc        jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists board_history_user_created on public.board_history (user_id, created_at);

alter table public.board_history enable row level security;

drop policy if exists "history_select_own" on public.board_history;
create policy "history_select_own" on public.board_history
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "history_insert_own" on public.board_history;
create policy "history_insert_own" on public.board_history
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "history_delete_own" on public.board_history;
create policy "history_delete_own" on public.board_history
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------
-- 3. Temps réel : prévenir les autres appareils quand le board change.
-- ---------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'boards'
  ) then
    alter publication supabase_realtime add table public.boards;
  end if;
end $$;

-- ---------------------------------------------------------------
-- 4. Fichiers (images, morceaux…) : espace privé, un dossier par compte.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

drop policy if exists "assets_select_own" on storage.objects;
create policy "assets_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "assets_insert_own" on storage.objects;
create policy "assets_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "assets_update_own" on storage.objects;
create policy "assets_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "assets_delete_own" on storage.objects;
create policy "assets_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
