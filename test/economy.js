/* The economy, measured.

   The levels are measured, the difficulty curve is measured, the care
   loop is measured. The money is not: coins arrive from four places and
   leave through six, and nobody has ever added the two columns up.

   This walks a player through real days — clearing levels at the rate
   the difficulty curve says they clear, doing the daily walk, claiming
   the gift, earning badges as the thresholds pass — and reports what
   they hold at the end of each week against what there is left to buy.

   A currency with more coming in than there is to spend it on stops
   being a currency. That is the thing this is looking for.

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
  '({ FOODS, TOYS, BOOSTERS, HATS, COLLARS, FURNITURE, ROOM_THEMES, BADGES, giftFor, HEART_MAX })', ctx);

/* ---------------------------------------------------------------
   The two numbers this depends on live in files that need a document,
   so they are copied here — and checked, because a copy that drifts is
   worse than no measurement at all.
   --------------------------------------------------------------- */
const ui = fs.readFileSync(path.join(jsDir, '60-ui.js'), 'utf8');
const save = fs.readFileSync(path.join(jsDir, '15-save.js'), 'utf8');

const WIN_FORMULA = 'const coins = Math.round((30 + stars * 22 + Math.floor(G.score / 1400)) * traitCoinScale(activePet()));';
const ADOPT_LINE = 'const ADOPT_COST = [0, 350, 700, 1200, 1800, 2600];';
const WALK_PAY = 'SAVE.coins += 120;';

const drift = [];
if (ui.indexOf(WIN_FORMULA) < 0) drift.push('the level reward in 60-ui.js is not the one this measures');
if (ui.indexOf(ADOPT_LINE) < 0) drift.push('ADOPT_COST in 60-ui.js is not the one this measures');
if (save.indexOf(WALK_PAY) < 0) drift.push('the daily walk payout in 15-save.js is not the one this measures');
if (drift.length) {
  drift.forEach(d => console.log('  ' + d));
  console.log('\nupdate test/economy.js to match, then run it again');
  process.exit(1);
}

const ADOPT_COST = [0, 350, 700, 1200, 1800, 2600];
const ADOPT_LEVEL = [0, 5, 12, 20, 28, 36];
const winCoins = (stars, score) => Math.round(30 + stars * 22 + Math.floor(score / 1400));

/* ---------- what a level is worth, and how often one is cleared ----------
   Both from the difficulty run: the lane clears about 80% of the time
   and three-stars about 40%, and a cleared level scores somewhere near
   its three-star target. Six levels is a session; a heart is twelve
   minutes, so six is also about what the hearts pay for in one sitting. */
const CLEAR_RATE = .80;
const THREE_STAR = .40;
const SESSION_LEVELS = 6;
const SCORE_TYPICAL = 24000;

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

/* ---------- a player, day by day ---------- */
function run(days, farm) {
  let coins = 120, treats = 6, level = 1, streak = 0;
  let earned = 0, spent = 0;
  const badgesPaid = {};
  let cleared = 0, threeStars = 0;
  const weeks = [];

  /* what an attentive player buys: food to keep the perks live, and a
     pet as soon as one is affordable and unlocked */
  let pets = 1;
  const kibble = X.FOODS.find(f => f.id === 'kibble').cost;
  const stew = X.FOODS.find(f => f.id === 'stew').cost;

  for (let day = 1; day <= days; day++) {
    /* the gift ladder resets on the eighth day */
    streak = streak % 7 + 1;
    const g = X.giftFor(streak);
    coins += g.coins; treats += g.treats; earned += g.coins;

    /* the daily walk */
    coins += 120; treats += 2; earned += 120;

    /* a session of levels */
    for (let i = 0; i < SESSION_LEVELS; i++) {
      const won = Math.random() < CLEAR_RATE;
      if (!won) continue;
      const three = Math.random() < THREE_STAR;
      const stars = three ? 3 : 2;
      const c = winCoins(stars, SCORE_TYPICAL);
      coins += c; earned += c;
      cleared++;
      if (three) threeStars++;
      /* a level number only advances on a first clear; farming replays
         the same one */
      if (!farm) level++;
      if (stars === 3) treats += 1;
      if (!farm && level % 5 === 0) treats += 2;
    }

    /* badges pay once, as their thresholds pass */
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
        treats += b.treats || 0;
      }
    });

    /* spending: feeding twice a day, and a stew when flush */
    const food = coins > 800 ? stew : kibble;
    coins -= food * 2; spent += food * 2;

    /* adopt whenever the next one is affordable and unlocked */
    while (pets < 6 && level >= ADOPT_LEVEL[pets] && coins >= ADOPT_COST[pets]) {
      coins -= ADOPT_COST[pets]; spent += ADOPT_COST[pets];
      pets++;
    }

    if (day % 7 === 0) weeks.push({ day, coins, treats, level, pets, earned, spent });
  }
  return { coins, treats, level, pets, earned, spent, weeks, cleared };
}

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

console.log('\n' + days + ' days, ' + (farm ? 'replaying a cleared level' : 'ordinary play') +
  ', ' + SESSION_LEVELS + ' levels a day\n');
console.log('  day   coins  treats  level  pets      in     out');
const r = run(days, farm);
r.weeks.forEach(w => {
  console.log('  ' + String(w.day).padStart(3) + String(w.coins).padStart(8) +
    String(w.treats).padStart(8) + String(w.level).padStart(7) + String(w.pets).padStart(6) +
    String(w.earned).padStart(8) + String(w.spent).padStart(8));
});

console.log('\n  earned ' + r.earned + ', spent ' + r.spent +
  ', holding ' + r.coins + ' coins and ' + r.treats + ' treats');

const left = sinkTotal - r.spent;
console.log('\n  still to buy: ' + Math.max(0, left) + ' coins worth');
if (r.coins > left) {
  console.log('  HOLDING MORE THAN THERE IS LEFT TO BUY, by ' + (r.coins - left) + ' coins.');
  console.log('  Past this point coins stop being a currency: nothing the game');
  console.log('  sells is a decision any more, and nothing priced in coins can');
  console.log('  be worth real money either.');
} else {
  console.log('  coins still buy something the player does not have');
}
if (r.treats > 40) {
  console.log('\n  ' + r.treats + ' treats and almost nothing to spend them on —');
  console.log('  cake is the only thing in the game priced in treats.');
}
