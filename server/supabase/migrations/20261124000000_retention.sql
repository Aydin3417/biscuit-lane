-- Who comes back, and how far the first day goes (1.5, 24 Nov 2026).
--
-- The owner asked what the game lacks; part of the answer was "we cannot
-- tell yet": six players in a fortnight, each playing a level or two a
-- sitting, and no view that said whether any of them came back the next
-- day. These read the event table the game already fills; nothing new
-- is sent. Same rule as the others: not exposed to the public keys.

-- One row per install: the day it first opened, whether it opened again
-- the next day, within a week, and how far its first day got.
create or replace view public.v_retention as
with firsts as (
  select install, min(received_at) as first_at
  from public.events where name = 'boot'
  group by install
),
days as (
  select e.install, ((e.received_at at time zone 'Europe/Istanbul')::date
                     - (f.first_at at time zone 'Europe/Istanbul')::date) as d
  from public.events e join firsts f using (install)
  where e.name = 'boot'
)
select f.install,
       (f.first_at at time zone 'Europe/Istanbul')::date as first_day,
       bool_or(d.d = 1)               as back_day1,
       bool_or(d.d between 1 and 7)   as back_week1,
       max(d.d)                       as last_day,
       (select max((e.props->>'n')::int) from public.events e
         where e.install = f.install and e.name = 'level_win'
           and e.received_at < f.first_at + interval '1 day'
           and (e.props->>'n')::int > 0) as day1_furthest
from firsts f join days d using (install)
group by f.install, f.first_at;

-- The same, by the day people arrived: how many, and what share returned.
create or replace view public.v_retention_daily as
select first_day,
       count(*)                                              as installs,
       round(100.0 * count(*) filter (where back_day1) / count(*), 0)  as day1_pct,
       round(100.0 * count(*) filter (where back_week1) / count(*), 0) as week1_pct,
       round(avg(day1_furthest), 1)                          as day1_levels
from public.v_retention
group by first_day
order by first_day desc;
