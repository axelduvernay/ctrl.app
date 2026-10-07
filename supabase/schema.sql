-- ctrl.app — base de données, partage et stockage (version 2).
-- À coller dans Supabase → SQL Editor → New query → Run.
-- Le script peut être relancé sans risque. Il met à niveau la version 1
-- (un board par compte) : ton board existant est repris tel quel.

-- ===============================================================
-- 0. Mise à niveau depuis la version 1
-- ===============================================================
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'boards' and column_name = 'user_id')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'boards' and column_name = 'id') then
    alter table public.boards rename to boards_v1;
  end if;
end $$;

-- ===============================================================
-- 1. Tables
-- ===============================================================

-- Un board : son contenu entier (doc) et un numéro de version (rev).
create table if not exists public.boards (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null default 'Mon board',
  doc        jsonb not null default '{}'::jsonb,
  rev        bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists boards_owner on public.boards (owner);

-- Les personnes à qui un board (ou une seule zone, zone_id) est partagé.
create table if not exists public.board_members (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  role     text not null check (role in ('editor', 'viewer')),
  zone_id  text,            -- null : tout le board ; sinon, cette zone seulement
  email    text,
  added_at timestamptz not null default now(),
  primary key (board_id, user_id)
);
create index if not exists board_members_user on public.board_members (user_id);

-- Les liens de partage. Le jeton est long et aléatoire : impossible à deviner.
create table if not exists public.board_links (
  token      text primary key default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  board_id   uuid not null references public.boards (id) on delete cascade,
  role       text not null check (role in ('editor', 'viewer')),
  zone_id    text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked    boolean not null default false
);
create index if not exists board_links_board on public.board_links (board_id);

-- Copies quotidiennes, désormais par board.
create table if not exists public.board_history (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  doc        jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.board_history add column if not exists board_id uuid references public.boards (id) on delete cascade;
create index if not exists board_history_board_created on public.board_history (board_id, created_at);

-- Reprise de la version 1 : chaque compte retrouve son board, et ses copies.
do $$
begin
  if to_regclass('public.boards_v1') is not null then
    insert into public.boards (owner, name, doc, rev, updated_at)
    select v.user_id, 'Mon board', v.doc, v.rev, v.updated_at
    from public.boards_v1 v
    where not exists (select 1 from public.boards b where b.owner = v.user_id);
  end if;
end $$;

update public.board_history h
set board_id = (select b.id from public.boards b where b.owner = h.user_id order by b.created_at limit 1)
where h.board_id is null;

-- ===============================================================
-- 2. Qui a accès à quoi
-- ===============================================================

-- Le rôle de l'utilisateur connecté sur un board : 'owner', 'editor',
-- 'viewer', ou rien ; et la zone à laquelle son accès est limité.
create or replace function public.board_access(b uuid)
returns table (role text, zone_id text)
language sql stable security definer set search_path = public as $$
  select 'owner'::text, null::text from public.boards where id = b and owner = auth.uid()
  union all
  select m.role, m.zone_id from public.board_members m where m.board_id = b and m.user_id = auth.uid()
  limit 1
$$;

-- Lecture et écriture du board entier (pas d'une seule zone).
create or replace function public.can_read_board(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.board_access(b) a where a.zone_id is null)
$$;

create or replace function public.can_write_board(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.board_access(b) a where a.zone_id is null and a.role in ('owner', 'editor'))
$$;

-- Peut inviter : propriétaire ou éditeur (d'un board entier ou d'une zone).
create or replace function public.can_share_board(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.board_access(b) a where a.role in ('owner', 'editor'))
$$;

create or replace function public.try_uuid(t text) returns uuid
language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end $$;

-- ===============================================================
-- 3. Zones partagées : on n'envoie que la zone, jamais le reste
-- ===============================================================

-- Une zone et toutes ses sous-zones.
create or replace function public.zone_subtree(doc jsonb, z text) returns text[]
language sql immutable as $$
  with recursive t(id) as (
    select z where coalesce(doc -> 'zones', '{}'::jsonb) ? z
    union
    select e.key from jsonb_each(coalesce(doc -> 'zones', '{}'::jsonb)) e, t
    where e.value ->> 'parent' = t.id
  )
  select coalesce(array_agg(id), '{}') from t
$$;

-- Le board réduit à une zone : ses sous-zones, ses blocs, leurs liens.
create or replace function public.filter_zone(doc jsonb, z text) returns jsonb
language plpgsql immutable as $$
declare
  zs text[] := public.zone_subtree(doc, z);
  bs text[];
  out jsonb;
begin
  select coalesce(array_agg(e.key), '{}') into bs
  from jsonb_each(coalesce(doc -> 'blocks', '{}'::jsonb)) e where e.value ->> 'zone' = any (zs);

  out := jsonb_build_object(
    'zones', coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(doc -> 'zones', '{}'::jsonb)) e where e.key = any (zs)), '{}'::jsonb),
    'blocks', coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(doc -> 'blocks', '{}'::jsonb)) e where e.key = any (bs)), '{}'::jsonb),
    'links', coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(doc -> 'links', '{}'::jsonb)) e
                       where e.value ->> 'from' = any (bs) and e.value ->> 'to' = any (bs)), '{}'::jsonb),
    'categories', coalesce(doc -> 'categories', '{}'::jsonb),
    'order', coalesce((select jsonb_agg(x) from jsonb_array_elements_text(coalesce(doc -> 'order', '[]'::jsonb)) x where x = any (bs)), '[]'::jsonb)
  );
  -- Vue depuis la zone partagée, celle-ci n'a pas de parent.
  if out -> 'zones' ? z then
    out := jsonb_set(out, array['zones', z, 'parent'], 'null'::jsonb);
  end if;
  return out;
end $$;

-- ===============================================================
-- 4. Fonctions appelées par l'app
-- ===============================================================

-- Ce qu'un lien donne à voir, sans être connecté : nom du board, rôle,
-- zone. Pour la carte « X t'a partagé… ».
create or replace function public.link_info(t text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'board_id', b.id,
    'name', b.name,
    'role', l.role,
    'zone_id', l.zone_id,
    'zone_name', b.doc -> 'zones' -> l.zone_id ->> 'name',
    'owner_email', (select u.email from auth.users u where u.id = b.owner))
  from public.board_links l join public.boards b on b.id = l.board_id
  where l.token = t and not l.revoked
$$;

-- Le contenu d'un lien, lisible par n'importe qui qui a le lien (invité
-- compris) : le board entier, ou seulement la zone partagée.
create or replace function public.shared_doc(t text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'board_id', b.id, 'name', b.name, 'role', l.role, 'zone_id', l.zone_id, 'rev', b.rev,
    'doc', case when l.zone_id is null then b.doc else public.filter_zone(b.doc, l.zone_id) end)
  from public.board_links l join public.boards b on b.id = l.board_id
  where l.token = t and not l.revoked
$$;

-- Accepter un lien une fois connecté : on devient membre du board. Un
-- accès déjà plus large n'est jamais réduit.
create or replace function public.accept_link(t text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l public.board_links;
  cur public.board_members;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  select * into l from public.board_links where token = t and not revoked;
  if not found then raise exception 'lien invalide'; end if;
  if exists (select 1 from public.boards where id = l.board_id and owner = auth.uid()) then
    return l.board_id;
  end if;

  select * into cur from public.board_members where board_id = l.board_id and user_id = auth.uid();
  if not found then
    insert into public.board_members (board_id, user_id, role, zone_id, email)
    values (l.board_id, auth.uid(), l.role, l.zone_id, (select email from auth.users where id = auth.uid()));
  else
    update public.board_members set
      role = case when cur.role = 'editor' or l.role = 'editor' then 'editor' else 'viewer' end,
      zone_id = case when cur.zone_id is null or l.zone_id is null then null else l.zone_id end
    where board_id = l.board_id and user_id = auth.uid();
  end if;
  return l.board_id;
end $$;

-- Mes boards : les miens, et ceux qu'on m'a partagés.
create or replace function public.my_boards()
returns table (id uuid, name text, role text, zone_id text, zone_name text, owner_email text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, 'owner', null, null, null, b.updated_at
  from public.boards b where b.owner = auth.uid()
  union all
  select b.id, b.name, m.role, m.zone_id, b.doc -> 'zones' -> m.zone_id ->> 'name',
         (select u.email from auth.users u where u.id = b.owner), b.updated_at
  from public.board_members m join public.boards b on b.id = m.board_id
  where m.user_id = auth.uid()
$$;

-- Lecture d'une zone par un membre limité à cette zone.
create or replace function public.zone_doc(b uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a record;
begin
  select * into a from public.board_access(b);
  if a.role is null then raise exception 'accès refusé'; end if;
  return (select jsonb_build_object('rev', bo.rev, 'name', bo.name,
            'doc', case when a.zone_id is null then bo.doc else public.filter_zone(bo.doc, a.zone_id) end)
          from public.boards bo where bo.id = b);
end $$;

-- Écriture d'une zone par un éditeur limité à cette zone. Ne touche qu'à
-- ce qui est dans la zone : tout identifiant appartenant au reste du board
-- est ignoré. Renvoie la nouvelle version, ou null si le board a changé
-- entre-temps (il faut alors relire et fusionner).
create or replace function public.save_zone(b uuid, part jsonb, base_rev bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  a record;
  d jsonb;
  r bigint;
  zs text[];
  bs text[];
  outside_z text[];
  outside_b text[];
  root_parent jsonb;
  pz jsonb;
  pb jsonb;
  new_b text[];
  nd jsonb;
begin
  select * into a from public.board_access(b);
  if a.role is distinct from 'editor' or a.zone_id is null then raise exception 'accès refusé'; end if;

  select bo.doc, bo.rev into d, r from public.boards bo where bo.id = b for update;
  if r <> base_rev then return null; end if;

  zs := public.zone_subtree(d, a.zone_id);
  select coalesce(array_agg(e.key), '{}') into bs from jsonb_each(coalesce(d -> 'blocks', '{}'::jsonb)) e where e.value ->> 'zone' = any (zs);
  select coalesce(array_agg(e.key), '{}') into outside_z from jsonb_each(coalesce(d -> 'zones', '{}'::jsonb)) e where not (e.key = any (zs));
  select coalesce(array_agg(e.key), '{}') into outside_b from jsonb_each(coalesce(d -> 'blocks', '{}'::jsonb)) e where not (e.key = any (bs));
  root_parent := coalesce(d -> 'zones' -> a.zone_id -> 'parent', 'null'::jsonb);

  -- Ce qui vient de l'éditeur, sans rien qui appartienne au reste du board.
  select coalesce(jsonb_object_agg(e.key, e.value), '{}') into pz
  from jsonb_each(coalesce(part -> 'zones', '{}'::jsonb)) e where not (e.key = any (outside_z));
  select coalesce(jsonb_object_agg(e.key, e.value), '{}') into pb
  from jsonb_each(coalesce(part -> 'blocks', '{}'::jsonb)) e where not (e.key = any (outside_b));
  -- La zone partagée ne peut pas disparaître, et garde sa place d'origine.
  if not pz ? a.zone_id then
    pz := pz || jsonb_build_object(a.zone_id, d -> 'zones' -> a.zone_id);
  end if;
  pz := jsonb_set(pz, array[a.zone_id, 'parent'], root_parent);
  select coalesce(array_agg(k), '{}') into new_b from jsonb_object_keys(pb) k;

  nd := d;
  nd := jsonb_set(nd, '{zones}', coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(d -> 'zones', '{}'::jsonb)) e where not (e.key = any (zs))), '{}'::jsonb) || pz);
  nd := jsonb_set(nd, '{blocks}', coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(d -> 'blocks', '{}'::jsonb)) e where not (e.key = any (bs))), '{}'::jsonb) || pb);
  -- Liens : ceux du dehors restent ; ceux qui traversent la frontière de la
  -- zone restent tant que leur bloc dans la zone existe ; ceux de
  -- l'intérieur viennent de l'éditeur.
  nd := jsonb_set(nd, '{links}',
    coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(d -> 'links', '{}'::jsonb)) e
              where not (e.value ->> 'from' = any (bs) and e.value ->> 'to' = any (bs))
                and not (e.value ->> 'from' = any (bs) and not e.value ->> 'from' = any (new_b))
                and not (e.value ->> 'to' = any (bs) and not e.value ->> 'to' = any (new_b))), '{}'::jsonb)
    || coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(part -> 'links', '{}'::jsonb)) e
              where e.value ->> 'from' = any (new_b) and e.value ->> 'to' = any (new_b)), '{}'::jsonb));
  nd := jsonb_set(nd, '{order}',
    coalesce((select jsonb_agg(x) from jsonb_array_elements_text(coalesce(d -> 'order', '[]'::jsonb)) x where not (x = any (bs))), '[]'::jsonb)
    || coalesce((select jsonb_agg(x) from jsonb_array_elements_text(coalesce(part -> 'order', '[]'::jsonb)) x where x = any (new_b)), '[]'::jsonb));

  update public.boards set doc = nd, rev = r + 1, updated_at = now() where id = b;
  return r + 1;
end $$;

-- ===============================================================
-- 5. Règles de sécurité (Row Level Security)
-- ===============================================================

alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.board_links enable row level security;
alter table public.board_history enable row level security;

-- Boards : lecture et écriture pour qui a accès au board entier ;
-- création à son nom ; suppression par le propriétaire seulement.
drop policy if exists "boards_select" on public.boards;
-- Le propriétaire est reconnu sur la ligne elle-même : à la création, la
-- fonction d'accès ne voit pas encore le board qu'on est en train d'écrire.
create policy "boards_select" on public.boards for select to authenticated
  using (owner = (select auth.uid()) or public.can_read_board(id));
drop policy if exists "boards_insert" on public.boards;
create policy "boards_insert" on public.boards for insert to authenticated with check (owner = (select auth.uid()));
drop policy if exists "boards_update" on public.boards;
create policy "boards_update" on public.boards for update to authenticated
  using (owner = (select auth.uid()) or public.can_write_board(id))
  with check (owner = (select auth.uid()) or public.can_write_board(id));
drop policy if exists "boards_delete" on public.boards;
create policy "boards_delete" on public.boards for delete to authenticated using (owner = (select auth.uid()));
-- Un éditeur modifie le contenu et le nom, jamais le propriétaire.
revoke update on public.boards from authenticated, anon;
grant update (name, doc, rev, updated_at) on public.boards to authenticated;

-- Membres : visibles par ceux qui ont accès au board ; retirés par qui peut
-- inviter, ou par soi-même (quitter). L'ajout passe par accept_link.
drop policy if exists "members_select" on public.board_members;
create policy "members_select" on public.board_members for select to authenticated
  using (exists (select 1 from public.board_access(board_id)));
drop policy if exists "members_delete" on public.board_members;
create policy "members_delete" on public.board_members for delete to authenticated
  using (public.can_share_board(board_id) or user_id = (select auth.uid()));
drop policy if exists "members_update" on public.board_members;
create policy "members_update" on public.board_members for update to authenticated
  using (exists (select 1 from public.boards b where b.id = board_id and b.owner = (select auth.uid())));

-- Liens : gérés par qui peut inviter. Un éditeur limité à une zone ne crée
-- que des liens vers cette zone.
drop policy if exists "links_select" on public.board_links;
create policy "links_select" on public.board_links for select to authenticated using (public.can_share_board(board_id));
drop policy if exists "links_insert" on public.board_links;
create policy "links_insert" on public.board_links for insert to authenticated with check (
  public.can_share_board(board_id)
  and exists (select 1 from public.board_access(board_links.board_id) a
             where a.zone_id is null or a.zone_id = board_links.zone_id));
drop policy if exists "links_update" on public.board_links;
create policy "links_update" on public.board_links for update to authenticated using (public.can_share_board(board_id));

-- Historique : pour qui peut écrire le board entier.
drop policy if exists "history_select_own" on public.board_history;
drop policy if exists "history_insert_own" on public.board_history;
drop policy if exists "history_delete_own" on public.board_history;
drop policy if exists "history_select" on public.board_history;
create policy "history_select" on public.board_history for select to authenticated using (public.can_write_board(board_id));
drop policy if exists "history_insert" on public.board_history;
create policy "history_insert" on public.board_history for insert to authenticated with check (public.can_write_board(board_id));
drop policy if exists "history_delete" on public.board_history;
create policy "history_delete" on public.board_history for delete to authenticated using (public.can_write_board(board_id));

-- Fonctions : celles des liens sont ouvertes aux invités ; le reste demande
-- d'être connecté.
revoke execute on function public.accept_link(text), public.my_boards(), public.zone_doc(uuid),
  public.save_zone(uuid, jsonb, bigint) from public, anon;
grant execute on function public.accept_link(text), public.my_boards(), public.zone_doc(uuid),
  public.save_zone(uuid, jsonb, bigint) to authenticated;
grant execute on function public.link_info(text), public.shared_doc(text) to anon, authenticated;

-- ===============================================================
-- 6. Temps réel
-- ===============================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'boards') then
    alter publication supabase_realtime add table public.boards;
  end if;
end $$;

-- ===============================================================
-- 7. Fichiers
-- ===============================================================
-- « assets » (privé) : un dossier par board, lisible par qui a accès au
-- board. L'ancien dossier par compte reste lisible par son propriétaire.
-- « shared » (public) : copie des fichiers d'un board partagé par lien,
-- pour que les invités sans compte voient aussi les images. Les chemins
-- contiennent l'identifiant du board et une clé aléatoire : impossibles à
-- deviner, et le dossier ne peut pas être listé.
insert into storage.buckets (id, name, public) values ('assets', 'assets', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('shared', 'shared', true) on conflict (id) do nothing;

drop policy if exists "assets_select_own" on storage.objects;
drop policy if exists "assets_insert_own" on storage.objects;
drop policy if exists "assets_update_own" on storage.objects;
drop policy if exists "assets_delete_own" on storage.objects;

drop policy if exists "assets_select" on storage.objects;
create policy "assets_select" on storage.objects for select to authenticated using (
  bucket_id = 'assets' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.board_access(public.try_uuid((storage.foldername(name))[1])))));
drop policy if exists "assets_insert" on storage.objects;
create policy "assets_insert" on storage.objects for insert to authenticated with check (
  bucket_id in ('assets', 'shared') and public.can_share_board(public.try_uuid((storage.foldername(name))[1])));
drop policy if exists "assets_update" on storage.objects;
create policy "assets_update" on storage.objects for update to authenticated using (
  bucket_id in ('assets', 'shared') and public.can_share_board(public.try_uuid((storage.foldername(name))[1])));
drop policy if exists "assets_delete" on storage.objects;
create policy "assets_delete" on storage.objects for delete to authenticated using (
  bucket_id in ('assets', 'shared') and public.can_share_board(public.try_uuid((storage.foldername(name))[1])));
