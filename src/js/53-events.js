/* ---------- timed events (1.5) ----------

   Asked for on 24 Nov 2026: what does the game lack next to the big
   ones? The answer that mattered most was a reason to open it today
   rather than some day. Everything here was permanent — a chest missed
   is a chest later, a job undone waits — so nothing was ever lost by
   staying away. The genre's answer is a calendar of short events, each
   with a deadline and a prize, and this is the smallest honest one.

   Two, on a weekly rhythm, both worked out from the date alone so there
   is no server to keep in step and the same week is the same for
   everyone:

     the week's breed     Monday to Sunday, one breed of the six. Clear
                          its tiles on any board; prizes at 120, 300
                          and 600. At about thirty of one breed a level,
                          the first is a sitting, the last a keen week.
     the weekend run      Friday to Sunday: win seven levels in a row.
                          A loss, or leaving a level, starts it again.
                          One prize per weekend.

   No invented rivals: a leaderboard of made-up players beating you by
   a little is the genre's habit and it is a lie told to a player, so
   the race is against the clock and the player's own record. */

const EV_COLLECT_TIERS = [
  { need: 120, coins: 150 },
  { need: 300, treats: 3, boost: 'rocket' },
  { need: 600, coins: 350, treats: 5, boost: 'star' }
];
const EV_RACE = { need: 7, coins: 300, treats: 5, boost: 'bomb' };
/* the events open with the rest of the day's errands (renderHome's
   `settled`): a player four levels in has enough to learn already */
const EV_FROM = 5;

/* dayNumber() counts days from 1 Jan 1970, a Thursday. Weeks here run
   Monday to Sunday, the way a Turkish or European calendar draws them. */
function evWeek(day) { return Math.floor(((day === undefined ? dayNumber() : day) + 3) / 7); }
function evWeekday(day) { return ((day === undefined ? dayNumber() : day) + 3) % 7; }   /* 0 Monday … 6 Sunday */
function evRaceOn(day) { return evWeekday(day) >= 4; }
function evBreed(week) { return (week === undefined ? evWeek() : week) % BREEDS.length; }
function evOpen() { return (SAVE.reached || 1) >= EV_FROM; }

function evState() {
  const w = evWeek();
  if (!SAVE.events || SAVE.events.week !== w) {
    SAVE.events = { week: w, got: 0, tiers: 0, run: 0, best: 0, raced: false };
  }
  return SAVE.events;
}

/* milliseconds until Monday 00:00 local, which is when both end */
function evLeftMs() {
  const d = new Date(now());
  const back = (d.getDay() + 6) % 7;            /* days since Monday */
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back + 7).getTime();
  return Math.max(0, next - now());
}

function evGrant(r, why) {
  if (r.coins) SAVE.coins += r.coins;
  if (r.treats) SAVE.treats += r.treats;
  if (r.boost) SAVE.boosters[r.boost] = (SAVE.boosters[r.boost] || 0) + 1;
  track('event_prize', { why });
  persist(true);
  toast(T('ev_prize') + ': ' + evPrizeLine(r), 'gift');
}
/* "150 coins · 3 treats · Start rocket" */
function evPrizeLine(r) {
  const out = [];
  if (r.coins) out.push(T('fam_cost', { n: r.coins }));
  if (r.treats) out.push(T('store_pack', { n: r.treats }));
  if (r.boost) out.push(loc(BOOSTERS.find(x => x.id === r.boost)));
  return out.join(' · ');
}

/* Tiles cleared on a board, by slot, from the board itself (40-game.js
   emits them once a cascade settles). */
function evTiles(bySlot) {
  if (!evOpen() || !bySlot) return;
  const st = evState();
  const want = evBreed(st.week);
  let n = 0;
  Object.keys(bySlot).forEach(slot => { if (castBreed(+slot) === want) n += bySlot[slot]; });
  if (!n) return;
  st.got += n;
  while (st.tiers < EV_COLLECT_TIERS.length && st.got >= EV_COLLECT_TIERS[st.tiers].need) {
    evGrant(EV_COLLECT_TIERS[st.tiers], 'collect' + (st.tiers + 1));
    st.tiers++;
  }
}

function evWon() {
  if (!evOpen() || !evRaceOn()) return;
  const st = evState();
  if (st.raced) return;
  st.run++;
  st.best = Math.max(st.best, st.run);
  if (st.run >= EV_RACE.need) { st.raced = true; evGrant(EV_RACE, 'race'); }
  persist();
}
/* a loss, or a level left before its end */
function evLost() {
  if (!evOpen() || !evRaceOn()) return;
  const st = evState();
  if (st.raced || !st.run) return;
  st.run = 0;
  st.broke = true;
  persist();
}

EV.on('tiles', evTiles);
EV.on('won', evWon);
EV.on('lost', evLost);
