-- ctrl.app — notifications push (rappels, même app fermée).
-- À coller dans Supabase → SQL Editor → New query → Run, APRÈS schema.sql.
-- Le script peut être relancé sans risque.
--
-- Fonctionnement : chaque minute, la base appelle la fonction « push »
-- (supabase/functions/push). Elle cherche les rappels arrivés à l'heure dans
-- les boards et envoie une notification à chaque appareil abonné.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ===============================================================
-- 1. Tables
-- ===============================================================

-- Les appareils abonnés (un téléphone, un navigateur). tz : le fuseau de
-- l'appareil, car les rappels sont écrits en heure locale (« 2026-10-09T20:00 »).
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  tz         text not null default 'Europe/Paris',
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

-- Les rappels déjà envoyés : jamais deux fois le même.
create table if not exists public.push_sent (
  board_id uuid not null references public.boards (id) on delete cascade,
  block_id text not null,
  remind   text not null,
  user_id  uuid not null references auth.users (id) on delete cascade,
  sent_at  timestamptz not null default now(),
  primary key (board_id, block_id, remind, user_id)
);

-- Notifications à envoyer tout de suite (la notification de test).
create table if not exists public.push_queue (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

-- Les clés d'envoi (VAPID), créées toutes seules par la fonction au premier
-- appel. La clé privée ne sort jamais de la base et de la fonction.
create table if not exists public.push_keys (
  id          int primary key check (id = 1),
  public_key  text not null,
  private_key text not null
);

-- Personne ne touche à ces tables directement : tout passe par les
-- fonctions ci-dessous. (La fonction d'envoi utilise la clé serveur.)
alter table public.push_subscriptions enable row level security;
alter table public.push_sent enable row level security;
alter table public.push_queue enable row level security;
alter table public.push_keys enable row level security;
revoke all on public.push_subscriptions, public.push_sent, public.push_queue, public.push_keys from anon, authenticated;

-- ===============================================================
-- 2. Fonctions appelées par l'app
-- ===============================================================

-- La clé publique, pour s'abonner.
create or replace function public.push_public_key() returns text
language sql stable security definer set search_path = public as $$
  select public_key from public.push_keys where id = 1
$$;

-- Abonner cet appareil au compte connecté (il change de compte s'il le faut).
create or replace function public.save_push(sub_endpoint text, sub_p256dh text, sub_auth text, sub_tz text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if not exists (select 1 from pg_timezone_names where name = sub_tz) then sub_tz := 'Europe/Paris'; end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, tz)
  values (sub_endpoint, auth.uid(), sub_p256dh, sub_auth, sub_tz)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        tz = excluded.tz, updated_at = now();
end $$;

create or replace function public.drop_push(sub_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions s where s.endpoint = sub_endpoint and s.user_id = auth.uid()
$$;

-- « Envoyer une notification de test ».
create or replace function public.queue_test_push()
returns void language sql security definer set search_path = public as $$
  insert into public.push_queue (user_id, title, body)
  select auth.uid(), 'ctrl.app', 'Les notifications marchent sur cet appareil.'
  where auth.uid() is not null
$$;

-- ===============================================================
-- 3. Ce que la fonction d'envoi récupère, chaque minute
-- ===============================================================

-- Les rappels arrivés à l'heure (dans le quart d'heure écoulé), pour le
-- propriétaire du board et ceux qui le modifient en entier ; plus la file
-- de test. Chaque rappel est marqué envoyé au passage : un second appel ne
-- renvoie rien.
create or replace function public.claim_pushes()
returns table (endpoint text, p256dh text, auth text, title text, body text, board_id uuid, block_id text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  delete from public.push_sent where sent_at < now() - interval '30 days';

  return query
  with people as (
    select b.id as board_id, b.owner as user_id, b.doc from public.boards b
    union
    select b.id, m.user_id, b.doc from public.boards b
    join public.board_members m on m.board_id = b.id and m.role = 'editor' and m.zone_id is null
  ),
  zones as (
    select distinct on (s.user_id) s.user_id, s.tz from public.push_subscriptions s
    order by s.user_id, s.updated_at desc
  ),
  due as (
    select p.board_id, p.user_id, k.key as block_id, k.value->>'remind' as remind,
           coalesce(nullif(left(split_part(coalesce(k.value->>'text', k.value->>'name', ''), E'\n', 1), 140), ''), 'Rappel') as body
    from people p
    join zones z on z.user_id = p.user_id
    cross join lateral jsonb_each(coalesce(p.doc->'blocks', '{}'::jsonb)) k
    where jsonb_typeof(k.value) = 'object'
      and k.value->>'remind' ~ '^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$'
      and coalesce(k.value->>'done', 'false') <> 'true'
      and ((k.value->>'remind')::timestamp at time zone z.tz) <= now()
      and ((k.value->>'remind')::timestamp at time zone z.tz) > now() - interval '15 minutes'
  ),
  claimed as (
    insert into public.push_sent as ps (board_id, block_id, remind, user_id)
    select d.board_id, d.block_id, d.remind, d.user_id from due d
    on conflict do nothing
    returning ps.board_id, ps.block_id, ps.remind, ps.user_id
  ),
  tests as (
    delete from public.push_queue q
    returning q.user_id, q.title, q.body, q.created_at
  )
  select s.endpoint, s.p256dh, s.auth, 'Rappel'::text, d.body, d.board_id, d.block_id
  from claimed c
  join due d on d.board_id = c.board_id and d.block_id = c.block_id and d.user_id = c.user_id
  join public.push_subscriptions s on s.user_id = c.user_id
  union all
  select s.endpoint, s.p256dh, s.auth, t.title, t.body, null::uuid, null::text
  from tests t
  join public.push_subscriptions s on s.user_id = t.user_id
  where t.created_at > now() - interval '1 hour';
end $$;

revoke execute on function public.claim_pushes() from public, anon, authenticated;
grant execute on function public.claim_pushes() to service_role;
grant all on public.push_subscriptions, public.push_sent, public.push_queue, public.push_keys to service_role;
revoke execute on function public.save_push(text, text, text, text), public.drop_push(text),
  public.queue_test_push(), public.push_public_key() from public, anon;
grant execute on function public.save_push(text, text, text, text), public.drop_push(text),
  public.queue_test_push(), public.push_public_key() to authenticated;

-- ===============================================================
-- 4. Chaque minute, la base appelle la fonction d'envoi
-- ===============================================================

select cron.unschedule(jobid) from cron.job where jobname = 'ctrl-push';
select cron.schedule('ctrl-push', '* * * * *', $$
  select net.http_post(
    url := 'https://boksigypdsbpmshmylhv.supabase.co/functions/v1/push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb)
$$);
