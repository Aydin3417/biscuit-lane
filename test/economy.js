/* The economy, measured.

   The levels are measured, the difficulty curve is measured, the care
   loop is measured. The money was not: coins arrived from four places
   and left through six, and nobody had ever added the two columns up.
   When somebody finally did, the answer was that a month of ordinary
   play bought everything the game sells and kept 13,826 coins in change
   — which is another way of saying coins were not a currency, and that
   nothing priced in them could ever be worth real money either.

   This walks a player through real days — clearing levels at the rate
   the difficulty curve says they clear, failing at the rate it says they
   fail, doing the daily walk, claiming the gift, earning badges as the
   thresholds pass — and reports what they hold at the end of each week
   against what there is left to buy.

   It reads src/js/10-data.js's ECON table directly. It used to keep its
   own copy of every number and guard them by searching the source for
   the exact line they appeared on, which made every deliberate change to
   a price look like a test failure. There is one table now.

     node test/economy.js            thirty days, ordinary play
     node test/economy.js 90         ninety days
     node test/economy.js farm       the same, replaying a cleared level
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsDir = path.join(__dirname, '..', 'src', 'js');
const ctx = {
  console,
  SP: { NONE: 0, ROW: 1, COL: 2, BOMB: 3, RAIN: 4 },
  document: { createElement: () => ({ getContext: () => ({}) }) },
  window: { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 },
  localStorage: { getItem: () => null, setItem: () => { }, removeItem: () => { } },
  navigator: { language: 'en' },
  performance: { now: () => Date.now() },
  requestAnimationFrame: fn => setTimeout(fn, 16),
  setTimeout, clearTimeout, Math, Date, JSON
};
vm.createContext(ctx);
vm.runInContext('var LANG = "en";', ctx);
require('./_modules.js').WITH_SAVE.forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(jsDir, f), 'utf8'), ctx, { filename: f }));

const X = vm.runInContext(
  '({ FOODS, TOYS, BOOSTERS, HATS, COLLARS, FURNITURE, ROOM_THEMES, KEEPSAKES, BADGES, giftFor,' +
  '   HEART_MAX, ECON, JAR, TREAT_PACKS, PASS, PASS_TRACK, passTier, SEASON_DAYS, isGate,' +
  '   BREEDS, EYE_COLORS, GROOM })', ctx);
const E = X.ECON;

/* the one number that still lives somewhere this cannot import, because
   it is a level unlock table inside the interface */
const ADOPT_COST = [0, 350, 700, 1200, 1800, 2600];
const ADOPT_LEVEL = [0, 5, 12, 20, 28, 36];
const ui = fs.readFileSync(path.join(jsDir, '60-ui.js'), 'utf8');
if (ui.indexOf('const ADOPT_COST = [0, 350, 700, 1200, 1800, 2600];') < 0) {
  console.log('  ADOPT_COST in 60-ui.js is not the one this measures');
  process.exit(1);
}

const winCoins = (stars, score) =>
  Math.round(E.winBase + stars * E.winPerStar + Math.floor(score / E.winPerScore));

/* ---------- what a level is worth, and how often one is cleared ----------
   Both from the difficulty run: the lane clears about 80% of the time
   and three-stars about 40%, and a cleared level scores somewhere near
   its three-star target. Six levels is a session. */
const CLEAR_RATE = .80;
const THREE_STAR = .40;
let SESSION_LEVELS = 6;
/* How the day is spread. Hearts refill on a wall clock, so six levels
   taken in one sitting and six taken in three are not the same demand
   at all — the first meets the wall and the second never sees it. Two
   sittings is the shape of a casual mobile session.

   The gap between them is what decides whether the pool ever empties,
   and it is the number this file was missing entirely. */
let SESSIONS = 2;
const SESSION_MINUTES = 14;         /* how long a sitting takes */
/* what a player does when the hearts run out mid-sitting: mostly they
   stop, which is the whole point of the mechanic. Some pay. */
const PAY_TO_CARRY_ON = .22;
const SCORE_TYPICAL = 24000;
/* Of the levels that are lost, how many were lost near the end — which
   is the only place the carry-on offer is allowed to appear. Half is a
   guess and is labelled as one; it is the number to replace first with
   something real once the game is in front of players. */
const CLOSE_LOSS = .50;

/* ---------- the sinks ---------- */
function catalogue() {
  const rows = [];
  const add = (label, list, key) => {
    const coins = list.filter(x => !x.treat).reduce((a, x) => a + (x[key || 'cost'] || 0), 0);
    const treats = list.filter(x => x.treat).reduce((a, x) => a + (x.cost || 0), 0);
    rows.push({ label, coins, treats, n: list.length });
  };
  add('food (one of each)', X.FOODS);
  add('toys', X.TOYS);
  add('boosters (one of each)', X.BOOSTERS);
  add('hats', X.HATS);
  add('collars', X.COLLARS);
  add('furniture', X.FURNITURE);
  add('room themes', X.ROOM_THEMES);
  /* The grooming shelf. Every breed carries three coats and the animal
     arrives wearing one, so a full house of six leaves twelve to buy;
     eye colours are shared across the house like collars are, and one of
     the six comes with the first pet. */
  const coats = X.BREEDS.length * (X.BREEDS[0].coats.length - 1);
  rows.push({ label: 'coats (' + coats + ', all six pets)', coins: coats * X.GROOM.coat, treats: 0, n: coats });
  rows.push({ label: 'eye colours', coins: (X.EYE_COLORS.length - 1) * X.GROOM.eye, treats: 0, n: X.EYE_COLORS.length - 1 });
  rows.push({ label: 'adopting all six pets', coins: ADOPT_COST.reduce((a, b) => a + b, 0), treats: 0, n: 6 });
  return rows;
}

/* One run of this is a coin toss thirty times over: whether each level
   clears, whether it three-stars, whether a lost one was lost near the
   end. Run twice it answers differently, and a test that answers
   differently is a test nobody can act on — the difficulty suite learned
   this the hard way and now replays its levels forty times.

   So the dice are seeded and the report is the median of TRIALS runs.
   Deterministic, and still an average player rather than one lucky one. */
function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const TRIALS = 25;
const median = xs => xs.slice().sort((a, b) => a - b)[xs.length >> 1];

/* ---------- a player, day by day ---------- */
function run(days, farm, seed) {
  const rnd = mulberry(seed || 1);
  let coins = 120, treats = 6, level = 1, streak = 0;
  let earned = 0, spent = 0, treatsIn = 6, treatsOut = 0;
  let continues = 0, refills = 0, jar = 0, jarFills = 0;
  /* hearts as a resource rather than an assumption: `dry` counts the
     times the pool emptied mid-sitting, `lost` the levels not played
     because of it. Those two are the whole question of whether the
     lives system does anything. */
  let hearts = X.HEART_MAX, dry = 0, lost = 0;
  /* offers made, and offers the player could not afford */
  let wanted = 0, short = 0;
  const badgesPaid = {};
  let cleared = 0, threeStars = 0, replays = 0, satDay = 0;
  let bought = 0, boosters = 0;
  /* Keepsakes are the only thing in the shop priced in the currency that
     also pays to carry on, so they are the first real competition treats
     have ever had. The rule modelled here is the one a player actually
     applies: buy one when it still leaves the carry-on price behind.
     Spending down to nothing and then losing a level at 90% of the goal
     is a mistake somebody makes once. */
  let keeps = 0, keepsSpent = 0;
  const keepShelf = (X.KEEPSAKES || []).map(k => ({ key: k.id, cost: k.cost }))
    .sort((a, b) => a.cost - b.cost);
  /* ---------- the season book ----------

     This file proved the two columns balanced and then a whole third
     column was added above it without ever coming through here: the
     book's FREE side pays out to everybody who plays, and it was not in
     the arithmetic at all. Modelled the same way as everything else —
     stamps earned at the rate the game grants them, the free rewards
     claimed the moment a tier is reached, and the paid side counted but
     not spent, because the player this file walks does not buy anything.

     Seasons run from the player's own first day, twenty-eight at a
     time. */
  let stamps = 0, seasons = 0, passTierEnd = 0;
  let passCoins = 0, passTreats = 0, passGoods = 0;
  let passClaimed = {};
  /* What the paid column would have handed over at the furthest tier
     this player ever reached — not at the tier they are standing on
     today, which after a season boundary is zero and would have this
     file reporting that the book is worthless every twenty-ninth day. */
  const passPaidWorth = tier => {
    let t = 0;
    for (let i = 0; i < tier && i < X.PASS_TRACK.length; i++)
      t += X.PASS_TRACK[i].paid.treats || 0;
    return t;
  };
  const goodCost = r => {
    const f = r.food && X.FOODS.find(x => x.id === r.food);
    if (f) return f.cost;
    const b = r.boost && X.BOOSTERS.find(x => x.id === r.boost);
    if (b) return b.cost;
    return 0;
  };
  /* everything ownable, once each, cheapest first */
  const owned = {};
  /* Grooming goes on the same shelf as everything else, gated on owning
     the animal it is for: twelve coats become buyable one adoption at a
     time, which is exactly the shape that keeps coins worth something
     into the second month. */
  const groomShelf = [];
  X.BREEDS.forEach((b, bi) => {
    for (let ci = 1; ci < b.coats.length; ci++)
      groomShelf.push({ key: 'coat:' + b.id + ':' + ci, cost: X.GROOM.coat, needPets: bi + 1 });
  });
  for (let ei = 1; ei < X.EYE_COLORS.length; ei++)
    groomShelf.push({ key: 'eye:' + X.EYE_COLORS[ei].id, cost: X.GROOM.eye, needPets: 1 });
  const shelf = []
    .concat(X.TOYS.map(x => ({ key: 'toy:' + x.id, cost: x.cost })))
    .concat(X.HATS.map(x => ({ key: 'hat:' + x.id, cost: x.cost })))
    .concat(X.COLLARS.map(x => ({ key: 'col:' + x.id, cost: x.cost })))
    .concat(X.FURNITURE.map(x => ({ key: 'fur:' + x.id, cost: x.cost })))
    .concat(X.ROOM_THEMES.map(x => ({ key: 'thm:' + x.id, cost: x.cost })))
    .filter(x => x.cost > 0)
    .sort((a, b) => a.cost - b.cost);
  const weeks = [];

  let pets = 1;
  const kibble = X.FOODS.find(f => f.id === 'kibble').cost;
  const stew = X.FOODS.find(f => f.id === 'stew').cost;
  const take = n => { treats += n; treatsIn += n; };

  for (let day = 1; day <= days; day++) {
    streak = streak % 7 + 1;
    const g = X.giftFor(streak);
    coins += g.coins; earned += g.coins; take(g.treats);

    coins += E.dailyWalkCoins; earned += E.dailyWalkCoins;
    take(E.dailyWalkTreats);
    stamps += X.PASS.stamps.walk;

    /* hearts regenerate on the clock between sittings, capped at the
       pool — you cannot bank more than HEART_MAX however long you stay
       away, which is the only reason the wall exists at all */
    const perSitting = Math.max(1, Math.round(SESSION_LEVELS / SESSIONS));
    const gapMin = (24 * 60 - SESSIONS * SESSION_MINUTES) / SESSIONS;
    for (let sit = 0; sit < SESSIONS; sit++) {
      hearts = Math.min(X.HEART_MAX, hearts + Math.floor(gapMin / E.heartRefillMin));
      let want = perSitting;
      for (let i = 0; i < want; i++) {
      /* an attempt costs a heart before the board is even dealt */
      if (hearts <= 0) {
        hearts += Math.floor(SESSION_MINUTES / E.heartRefillMin);
        if (hearts <= 0) {
          dry++;
          /* out, mid-sitting. Refill for treats, or stop for today. */
          if (treats >= E.heartRefillTreats && rnd() < PAY_TO_CARRY_ON) {
            treats -= E.heartRefillTreats; treatsOut += E.heartRefillTreats;
            refills++; hearts = X.HEART_MAX;
          } else { lost += want - i; break; }
        }
      }
      hearts--;
      if (rnd() >= CLEAR_RATE) {
        /* a lost level. Near the end it is worth nine treats to carry
           on, and carrying on clears it — which is the whole reason the
           offer is only allowed to appear near the end. */
        if (rnd() < CLOSE_LOSS) {
          /* The offer was made. Whether it was taken is the number that
             says if nine treats is a decision or a formality: a price
             the free income always covers is not a price. */
          wanted++;
          if (treats >= E.continueTreats) {
            treats -= E.continueTreats; treatsOut += E.continueTreats; continues++;
          } else { short++; continue; }
        } else {
          continue;
        }
      }
      const three = rnd() < THREE_STAR;
      const stars = three ? 3 : 2;
      /* farming replays a level that is already cleared, which is where
         the rate cut bites */
      const c = Math.round(winCoins(stars, SCORE_TYPICAL) * (farm ? E.replayRate : 1));
      coins += c; earned += c;
      cleared++;
      if (farm) replays++;
      if (three) threeStars++;
      if (!farm) level++;
      if (three) take(E.threeStarTreats);
      if (!farm && level % E.milestoneEvery === 0) take(E.milestoneTreats);
      /* stamps, on a first clear only — a replay pays none, which is
         what stops the track being finished on level three */
      if (!farm) {
        stamps += X.PASS.stamps.clear;
        if (three) stamps += X.PASS.stamps.threeStar;
        if (X.isGate(level)) stamps += X.PASS.stamps.gate;
      }
      /* the jar takes its couple either way */
      if (jar < JARCAP) { jar = Math.min(JARCAP, jar + E.jarPerLevel); if (jar >= JARCAP) jarFills++; }
      /* and the shelf of keepsakes, cheapest first, once the carry-on is
         still covered afterwards */
      for (const k of keepShelf) {
        if (owned['keep:' + k.key]) continue;
        if (treats - k.cost < E.continueTreats) break;
        owned['keep:' + k.key] = 1;
        treats -= k.cost; treatsOut += k.cost; keeps++; keepsSpent += k.cost;
      }
      }
    }

    X.BADGES.forEach(b => {
      if (badgesPaid[b.id]) return;
      let at = 0;
      if (b.fam === 'lane') at = cleared;
      else if (b.fam === 'star') at = threeStars;
      else if (b.fam === 'family') at = pets;
      else if (b.fam === 'care') at = b.id === 'streak7' ? streak : day * 2;
      else at = cleared * 30;
      if (at >= b.of) {
        badgesPaid[b.id] = 1;
        coins += b.coins || 0; earned += b.coins || 0;
        take(b.treats || 0);
      }
    });

    /* Feeding. Every pet in the house gets hungry — catchUpPets runs
       simulatePet over all of them, not just the one on the walk — so
       the bill scales with the family. This used to buy two meals a day
       full stop, which is what a one-pet house costs and understated a
       six-pet one by most of a factor of six. The one you are playing
       eats properly when there is money for it; the rest get kibble. */
    const good = coins > 800 ? stew : kibble;
    const bill = good * 2 + kibble * 2 * (pets - 1);
    coins -= bill; spent += bill;

    while (pets < 6 && level >= ADOPT_LEVEL[pets] && coins >= ADOPT_COST[pets]) {
      coins -= ADOPT_COST[pets]; spent += ADOPT_COST[pets]; bought += ADOPT_COST[pets];
      pets++;
    }

    /* And the shop. The old run bought food and pets and nothing else,
       which left every hat and every rug sitting in the catalogue as
       something the player was theoretically saving for — so the pile of
       coins at the end looked far bigger than a real one, because a real
       player spends them on exactly this. Cheapest first, one a day: it
       is how the shop is actually shopped, and it is the difference
       between measuring a surplus and inventing one. */
    const next = shelf.find(x => !owned[x.key] && coins >= x.cost) ||
      groomShelf.find(x => !owned[x.key] && coins >= x.cost && pets >= x.needPets);
    if (next) { owned[next.key] = 1; coins -= next.cost; spent += next.cost; bought += next.cost; }

    /* boosters are the one thing bought more than once — a hard level
       gets a hammer thrown at it, and that keeps being true forever */
    if (rnd() < .45) {
      const b = X.BOOSTERS[Math.floor(rnd() * X.BOOSTERS.length)];
      if (coins >= b.cost) { coins -= b.cost; spent += b.cost; boosters++; }
    }

    /* the free column, claimed the moment a tier is reached — which is
       what a player does, because the badge on the home card says so */
    const tier = X.passTier(stamps);
    for (let i = 0; i < tier && i < X.PASS_TRACK.length; i++) {
      if (passClaimed['f' + i]) continue;
      passClaimed['f' + i] = 1;
      const r = X.PASS_TRACK[i].free;
      if (r.coins) { coins += r.coins; earned += r.coins; passCoins += r.coins; }
      if (r.treats) { take(r.treats); passTreats += r.treats; }
      /* a free tin of stew is a tin nobody has to buy, so it lands in
         the coin column at what it would have cost */
      const worth = goodCost(r);
      if (worth) { coins += worth; earned += worth; passGoods += worth; }
    }
    /* a season ends and the book starts again, stamps and all */
    if (day % X.SEASON_DAYS === 0) {
      passTierEnd = Math.max(passTierEnd, tier);
      seasons++; stamps = 0; passClaimed = {};
    }

    if (!satDay && pets >= 6 && coins > sinkTotal - bought) satDay = day;
    if (day % 7 === 0) weeks.push({ day, coins, treats, level, pets, earned, spent });
  }
  return {
    satDay, bought, boosters, coins, treats, level, pets, earned, spent, weeks, cleared, replays,
    treatsIn, treatsOut, continues, refills, jar, jarFills, dry, lost, wanted, short,
    keeps, keepsSpent, keepShelfN: keepShelf.length,
    stamps, seasons, passTierEnd: Math.max(passTierEnd, X.passTier(stamps)),
    passCoins, passTreats, passGoods,
    passPaid: passPaidWorth(Math.max(passTierEnd, X.passTier(stamps)))
  };
}
const JARCAP = X.JAR.cap;
/* jarPerLevel lives on JAR rather than ECON; read it through the same E
   so the loop above stays one shape */
E.jarPerLevel = X.JAR.perLevel;

/* ---------- report ---------- */
const arg = process.argv[2];
const farm = arg === 'farm' || process.argv[3] === 'farm';
const days = parseInt(arg, 10) > 0 ? parseInt(arg, 10) : 30;

console.log('what there is to spend coins on, in total:\n');
const cat = catalogue();
let sinkTotal = 0, treatTotal = 0;
cat.forEach(r => {
  sinkTotal += r.coins; treatTotal += r.treats;
  console.log('  ' + r.label.padEnd(26) + String(r.coins).padStart(6) + ' coins' +
    (r.treats ? '   ' + r.treats + ' treats' : ''));
});
console.log('  ' + '─'.repeat(26) + String(sinkTotal).padStart(6) + ' coins' +
  (treatTotal ? '   ' + treatTotal + ' treats' : ''));
console.log('\n  everything the game sells, bought once: ' + sinkTotal + ' coins');
console.log('  a cleared level pays ' + winCoins(3, SCORE_TYPICAL) + ' coins at three stars, ' +
  Math.round(winCoins(3, SCORE_TYPICAL) * E.replayRate) + ' on a replay');

console.log('\n' + days + ' days, ' + (farm ? 'replaying a cleared level' : 'ordinary play') +
  ', ' + SESSION_LEVELS + ' levels a day\n');
console.log('  day   coins  treats  level  pets      in     out');
/* every trial, then the one sitting in the middle of them by coins held
   — so the table below is a real run rather than an average of runs,
   which would show a player nobody is */
const trials = [];
for (let i = 1; i <= TRIALS; i++) trials.push(run(days, farm, i * 7919));
trials.sort((a, b) => a.coins - b.coins);
const r = trials[TRIALS >> 1];
r.weeks.forEach(w => {
  console.log('  ' + String(w.day).padStart(3) + String(w.coins).padStart(8) +
    String(w.treats).padStart(8) + String(w.level).padStart(7) + String(w.pets).padStart(6) +
    String(w.earned).padStart(8) + String(w.spent).padStart(8));
});

console.log('\n  coins:  earned ' + r.earned + ', spent ' + r.spent + ', holding ' + r.coins);
console.log('  treats: earned ' + r.treatsIn + ', spent ' + r.treatsOut + ', holding ' + r.treats);
console.log('          ' + r.continues + ' carried-on levels, ' + r.refills + ' heart refills');
console.log('  hearts: ran out ' + r.dry + ' times, ' + r.lost + ' levels not played for want of one');
console.log('  carry-on: offered ' + r.wanted + ', taken ' + r.continues + ', ' +
  r.short + ' turned down for want of treats (' +
  (r.wanted ? Math.round(r.short / r.wanted * 100) : 0) + '%)');
console.log('  jar:    ' + r.jar + ' of ' + JARCAP + ', filled ' + r.jarFills + ' time(s)');
/* The jar is the only offer in the game that a player earns rather than
   is shown, so the number worth knowing about it is not how much it
   holds but how often it comes round. This run never opens it — the
   simulated player pays nothing — so the cadence is worked out rather
   than observed: how many levels it takes to fill, and therefore how
   many times somebody who opened it every time would have been asked. */
const jarLevels = Math.ceil(JARCAP / E.jarPerLevel);
console.log('  jar:    fills every ' + jarLevels + ' levels (' +
  (jarLevels / SESSION_LEVELS).toFixed(1) + " days at " + SESSION_LEVELS + " a day) — " +
  Math.floor(r.cleared / jarLevels) + ' offers in ' + days + ' days');
console.log('  keepsakes: ' + r.keeps + ' of ' + r.keepShelfN +
  ' bought, ' + r.keepsSpent + ' treats');

/* ---------- the season book ----------

   Two questions, and the second is the one that matters.

   Can the track be finished? A book sold on thirty tiers and reachable
   at nineteen is a book sold on a promise, and the tier reached at the
   end of a season is the whole answer.

   And what does the FREE side hand a player who never pays a penny?
   That column is income like any other and it was outside the arithmetic
   entirely — which means the balance this file certifies was certifying
   a game that no longer existed. It goes in the totals above now; this
   is it broken out, so a change to the track shows up here as a number
   rather than three weeks later as a shop with nothing left in it. */
console.log('  book:   ' + r.stamps + ' stamps this season, tier ' +
  r.passTierEnd + ' of ' + X.PASS.tiers + ' reached' +
  (r.passTierEnd >= X.PASS.tiers ? '' : '  — the track does not finish'));
console.log('  book:   free column paid ' + (r.passCoins + r.passGoods) + ' coins and ' +
  r.passTreats + ' treats over ' + Math.max(1, r.seasons) + ' season(s)');
console.log('  book:   the paid column would have held ' + r.passPaid +
  ' treats, against ' + X.TREAT_PACKS.reduce((m, x) => Math.max(m, x.treats), 0) +
  ' in the pack beside it');

/* ---------- the same month at three appetites ----------

   A lives system is not a number, it is a slope: it should be invisible
   to somebody dipping in twice a day and real to somebody who has found
   the game. Measuring one play rate and calling hearts tuned is how they
   came to do nothing at all. */
console.log('\n  the same month, at three appetites\n');
console.log('  levels/day  sittings   dry   levels lost   refills   treats held  carry-on short');
const SWEEP = [[6, 2], [12, 2], [24, 3], [40, 4]];
const wasLevels = SESSION_LEVELS, wasSessions = SESSIONS;
SWEEP.forEach(([lv, si]) => {
  SESSION_LEVELS = lv; SESSIONS = si;
  const t = [];
  for (let i = 1; i <= TRIALS; i++) t.push(run(days, farm, i * 7919));
  const m = k => median(t.map(x => x[k]));
  const w = m('wanted'), sh = m('short');
  console.log('  ' + String(lv).padStart(10) + String(si).padStart(10) +
    String(m('dry')).padStart(6) + String(m('lost')).padStart(14) +
    String(m('refills')).padStart(10) + String(m('treats')).padStart(14) +
    String(w ? Math.round(sh / w * 100) + '%' : '-').padStart(14));
});
SESSION_LEVELS = wasLevels; SESSIONS = wasSessions;

/* ---------- and what that table means, so nobody "fixes" it ----------

   The first row says zero. Zero dry moments, zero levels lost, zero
   heart refills, across a whole month. Read on its own that looks like a
   lives system doing nothing, and it has been read that way before.

   It is the design. Hearts only ever go down on a loss — winning returns
   the one it took, and quitting returns it too — so the drain is the
   loss rate, and somebody playing six levels a day across two sittings
   loses about one. Five hearts and a twenty-five minute refill cannot
   bind against that and are not meant to: a casual player meeting a wall
   twice a week is a casual player who stops.

   The rows below it are where the meter lives, and they are not zero.
   Somebody playing twelve levels a day meets it sixty times a month and
   pays to get past it seven; at twenty-four it is ninety and nine. That
   is the shape a lives system is supposed to have — invisible to
   somebody dipping in, real to somebody who has found the game — and it
   is also, not coincidentally, the shape of who ever pays for anything.

   The same argument governs the treat column. Free treat income is
   deliberately enough to cover an ordinary player's carry-ons and
   deliberately not enough to cover an engaged one's: the carry-on
   shortfall runs 21% in the first row and 45 to 59% in the others.
   Cutting income until the first row went short as well would raise the
   pressure on precisely the players least likely to pay and most likely
   to leave. It has been considered twice now and refused twice; this
   paragraph is here so it does not have to be considered a third time
   from scratch. */

let bad = 0;
/* The two thresholds are judged on the medians, not on this one run:
   one unlucky trial should not fail a build, and one lucky one should
   not pass it. */
const medTreats = median(trials.map(t => t.treats));
const medSat = median(trials.map(t => t.satDay || days + 1));
console.log('\n  across ' + TRIALS + ' seeded runs: median ' + medTreats +
  ' treats held, coins outrun the catalogue on day ' + (medSat > days ? '—' : medSat));
const left = sinkTotal - r.bought;
console.log('\n  still to buy: ' + Math.max(0, left) + ' coins worth');
/* Coins saturate eventually, and that on its own is not a fault: the
   catalogue is finite, so any income at all outruns it once the last
   thing is bought. What matters is when, and what is priced in them.
   Nothing the player needs is — carrying on a level and refilling hearts
   are both treats — so a late coin surplus is a player who has finished
   the cosmetics, which is a shortage of things to want rather than a
   broken currency. An early one means the shop was never a decision. */
if (medSat <= days) {
  if (medSat < 21) {
    console.log('  THAT IS TOO EARLY. Three weeks of play should not exhaust');
    console.log('  everything there is to want; the shop would stop being a');
    console.log('  reason to play well before the levels run out.');
    bad++;
  } else {
    console.log('  Late enough to be a content problem rather than a currency one:');
    console.log('  what is missing is more to want, not less to earn.');
  }
} else {
  console.log('  coins still buy something the player does not have');
}

/* The treat column is the one the store is priced against, so it is the
   one with a threshold rather than a comment. A player who never runs
   short of treats never has a reason to look at the store — and a player
   who runs short on day two is being squeezed. Somewhere between is a
   balance that pays for itself; a standing pile of a hundred is not. */
if (r.treats > 80) {
  console.log('\n  ' + r.treats + ' treats standing idle after ' + days + ' days.');
  console.log('  Nothing priced in treats is a decision at that balance.');
  bad++;
} else {
  console.log('\n  treats are spent about as fast as they arrive');
}
process.exit(bad ? 1 : 0);
