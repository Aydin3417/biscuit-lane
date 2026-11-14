-- The video funnel, added 14 Nov 2026 with the events that feed it.
--
-- Two weeks into the store the complaint was that videos almost never
-- appeared, and the only ad event the game had ever sent was a reward,
-- so nobody could say whether the network had nothing to serve or the
-- game never asked. The game now says, per slot:
--
--   ad_load    a video was asked for: ok 1, or ok 0 with AdMob's code
--              (3 = no fill, the state of an app AdMob has not approved)
--   ad_offer   a card drew a video button
--   ad_miss    a card would have drawn one and there was no video loaded
--   ad_tap     the button was pressed
--   ad_reward  the video was watched through and paid
--   ad_unpaid  closed early, or failed to show
--   ad_break   a between-levels interstitial was shown
--
-- Read it in the SQL editor:  select * from v_ads order by day desc;

create or replace view public.v_ads as
select received_at::date as day,
       coalesce(props->>'slot', '-')                                   as slot,
       count(*) filter (where name = 'ad_load' and props->>'ok' = '1') as loads_ok,
       count(*) filter (where name = 'ad_load' and props->>'ok' = '0') as loads_failed,
       count(*) filter (where name = 'ad_offer')                       as offered,
       count(*) filter (where name = 'ad_miss')                        as missed,
       count(*) filter (where name = 'ad_tap')                         as tapped,
       count(*) filter (where name = 'ad_reward')                      as rewarded,
       count(*) filter (where name = 'ad_break')                       as breaks,
       count(distinct install)                                         as players
from public.events
where name like 'ad\_%'
group by 1, 2;

-- Why loads fail, by AdMob's code.
create or replace view public.v_ad_fail as
select received_at::date as day, platform, props->>'code' as code, count(*) as n, count(distinct install) as players
from public.events
where name = 'ad_load' and props->>'ok' = '0'
group by 1, 2, 3;

-- First-attempt clear rate per level, from the attempt number the game
-- already sends with level_start: the number the curve is aimed at.
create or replace view public.v_first_try as
with s as (
  select install, (props->>'n')::int as level, (props->>'attempt')::int as attempt, received_at
  from public.events where name = 'level_start' and (props->>'n')::int > 0
), w as (
  select install, (props->>'n')::int as level, min(received_at) as won_at
  from public.events where name = 'level_win' group by 1, 2
)
select s.level,
       count(*) filter (where s.attempt = 1)                                         as first_tries,
       count(*) filter (where s.attempt = 1 and exists (
         select 1 from s s2 where s2.install = s.install and s2.level = s.level and s2.attempt = 2)) as needed_a_second,
       round(avg(s.attempt) filter (where w.won_at is not null and s.received_at <= w.won_at), 2) as attempts_to_clear
from s left join w on w.install = s.install and w.level = s.level
group by s.level order by s.level;
