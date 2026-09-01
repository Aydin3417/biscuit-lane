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
  '({ FOODS, TOYS, BOOSTERS, HATS, COLLARS, FURNITURE, ROOM_THEMES, BADGES, giftFor,' +
  '   HEART_MAX, ECON, JAR, PET_CLUB, TREAT_PACKS })', ctx);
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
const SESSION_LEVELS = 6;
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
  const badgesPaid = {};
  let cleared = 0, threeStars = 0, replays = 0, satDay = 0;
  let bought = 0, boosters = 0;
  /* everything ownable, once each, cheapest first */
  const owned = {};
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

    for (let i = 0; i < SESSION_LEVELS; i++) {
      if (rnd() >= CLEAR_RATE) {
        /* a lost level. Near the end it is worth nine treats to carry
           on, and carrying on clears it — which is the whole reason the
           offer is only allowed to appear near the end. */
        if (rnd() < CLOSE_LOSS && treats >= E.continueTreats) {
          treats -= E.continueTreats; treatsOut += E.continueTreats; continues++;
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
      if (!farm && level % 5 === 0) take(E.everyFifthTreats);
      /* the jar takes its couple either way */
      if (jar < JARCAP) { jar = Math.min(JARCAP, jar + E.jarPerLevel); if (jar >= JARCAP) jarFills++; }
    }

    /* Hearts. Five, one every twenty-five minutes, one spent per
       attempt: a six-level session at an 80% clear rate is between seven
       and eight attempts, so the wall is met most days. A patient player
       waits it out; this one buys a refill only when treats are piling
       up and it costs nothing to. */
    if (treats >= 40 && rnd() < .5) {
      treats -= E.heartRefillTreats; treatsOut += E.heartRefillTreats; refills++;
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
    const next = shelf.find(x => !owned[x.key] && coins >= x.cost);
    if (next) { owned[next.key] = 1; coins -= next.cost; spent += next.cost; bought += next.cost; }

    /* boosters are the one thing bought more than once — a hard level
       gets a hammer thrown at it, and that keeps being true forever */
    if (rnd() < .45) {
      const b = X.BOOSTERS[Math.floor(rnd() * X.BOOSTERS.length)];
      if (coins >= b.cost) { coins -= b.cost; spent += b.cost; boosters++; }
    }

    if (!satDay && pets >= 6 && coins > sinkTotal - bought) satDay = day;
    if (day % 7 === 0) weeks.push({ day, coins, treats, level, pets, earned, spent });
  }
  return {
    satDay, bought, boosters, coins, treats, level, pets, earned, spent, weeks, cleared, replays,
    treatsIn, treatsOut, continues, refills, jar, jarFills
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
console.log('  jar:    ' + r.jar + ' of ' + JARCAP + ', filled ' + r.jarFills + ' time(s)');

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
