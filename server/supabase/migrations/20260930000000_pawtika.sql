-- Pawtika's whole server: two tables, both written only by the edge
-- functions (service role) and closed to the public keys by RLS.
--
-- events     what the game's telemetry sends (src/js/18-telemetry.js):
--            anonymous, keyed by a random install number, no names, no
--            device or advertising ids.
-- purchases  one row per store transaction the verify-purchase function
--            has accepted, so the same receipt cannot be redeemed on a
--            second install.

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  install     bigint not null,
  version     text,
  platform    text,
  session     bigint,
  name        text not null,
  client_ms   bigint,
  props       jsonb not null default '{}'::jsonb
);
create index if not exists events_name_received on public.events (name, received_at);
create index if not exists events_install on public.events (install, received_at);

create table if not exists public.purchases (
  transaction_id text primary key,
  platform       text not null,
  sku            text not null,
  install        bigint not null,
  environment    text,
  created_at     timestamptz not null default now()
);

alter table public.events enable row level security;
alter table public.purchases enable row level security;
-- No policies: the anon and publishable keys can neither read nor write.
-- The edge functions use the service role, which bypasses RLS.

-- The questions the audit said nobody could answer, as views over the
-- event table. Read them in the Supabase dashboard (SQL editor or the
-- table view); they are not exposed to the public keys either.

-- Where players stop: the furthest level each install has started.
create or replace view public.v_furthest_level as
select install, max((props->>'n')::int) as furthest, max(received_at) as last_seen
from public.events where name = 'level_start' and (props->>'n')::int > 0
group by install;

-- Which level is a wall: starts, wins, losses and first-attempt wins per level.
create or replace view public.v_level_funnel as
select (props->>'n')::int as level,
       count(*) filter (where name = 'level_start')                       as starts,
       count(*) filter (where name = 'level_win')                         as wins,
       count(*) filter (where name = 'level_lose')                        as losses,
       count(*) filter (where name = 'level_quit')                        as quits,
       count(distinct install) filter (where name = 'level_start')        as players,
       round(avg((props->>'attempt')::numeric) filter (where name = 'level_start'), 2) as avg_attempt
from public.events
where name in ('level_start', 'level_win', 'level_lose', 'level_quit') and (props->>'n')::int > 0
group by 1 order by 1;

-- Day-N retention by install cohort (the day an install first sent anything).
create or replace view public.v_retention as
with first_seen as (
  select install, min(received_at)::date as d0 from public.events group by install
), active as (
  select distinct e.install, e.received_at::date as d from public.events e
)
select f.d0 as cohort,
       count(distinct f.install) as installs,
       count(distinct a.install) filter (where a.d = f.d0 + 1)  as d1,
       count(distinct a.install) filter (where a.d = f.d0 + 3)  as d3,
       count(distinct a.install) filter (where a.d = f.d0 + 7)  as d7,
       count(distinct a.install) filter (where a.d = f.d0 + 14) as d14,
       count(distinct a.install) filter (where a.d = f.d0 + 30) as d30
from first_seen f left join active a on a.install = f.install
group by f.d0 order by f.d0;

-- Money and attention: purchases, continues, refills, videos, boosters.
create or replace view public.v_monetisation as
select received_at::date as day, name, props->>'sku' as sku, props->>'slot' as slot, props->>'id' as item,
       count(*) as n, count(distinct install) as players
from public.events
where name in ('buy_try', 'buy_ok', 'buy_fail', 'continue_buy', 'hearts_refill', 'ad_reward', 'booster_use', 'purse_buy', 'store_open', 'hearts_empty')
group by 1, 2, 3, 4, 5 order by 1 desc, 2;

-- Onboarding: how many installs reach each step.
create or replace view public.v_onboarding as
select name, props->>'step' as step, count(distinct install) as installs
from public.events where name like 'onb_%' group by 1, 2 order by 3 desc;

-- Crashes and swallowed errors, newest first.
create or replace view public.v_errors as
select received_at, version, platform, props->>'k' as kind, props->>'m' as message, props->>'w' as file, props->>'l' as line
from public.events where name = 'fail' order by received_at desc;

-- Views run with the owner's rights by default; make them respect RLS so
-- they are as closed as the tables beneath them.
alter view public.v_furthest_level set (security_invoker = true);
alter view public.v_level_funnel set (security_invoker = true);
alter view public.v_retention set (security_invoker = true);
alter view public.v_monetisation set (security_invoker = true);
alter view public.v_onboarding set (security_invoker = true);
alter view public.v_errors set (security_invoker = true);

-- privacy.html promises play data is kept for 18 months. This is what
-- keeps that promise: every night, anything older goes.
create extension if not exists pg_cron;
select cron.schedule('pawtika-events-retention', '15 3 * * *',
  $$delete from public.events where received_at < now() - interval '18 months'$$);
