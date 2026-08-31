/* The economy, played out.

   Every other system in this game has been measured. This one never
   has, and it is the one that decides whether there is anything to want
   after the second week.

   A match-3 economy fails in one of two ways. Too tight and the player
   is blocked behind a wall they cannot climb; too loose and the currency
   stops meaning anything, which is worse, because a shop nobody needs is
   a screen nobody opens and a reward nobody feels. This walks a real
   player through a month and says which way this one fails.

   The player it walks is deliberately ordinary: plays until the hearts
   run out, wins about as often as the solver does at that level, keeps
   the animal fed, buys what is affordable and useful in the order a
   person would. It is a model and it is stated rather than hidden.

     node test/economy.js            thirty days
     node test/economy.js 90         a season
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, 'src', 'js', f), 'utf8');

/* ---------- the numbers, read from the game rather than restated ---------- */

const data = read('10-data.js');
const ui = read('60-ui.js');
const save = read('15-save.js');

const listOf = (name, src) => {
  const at = src.indexOf('const ' + name + ' = [');
  if (at < 0) return [];
  let depth = 0, end = at;
  for (let i = src.indexOf('[', at); i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { if (--depth === 0) { end = i; break; } }
  }
  const body = src.slice(at, end);
  return [...body.matchAll(/\{[^{}]*id: '([a-z]+)'[^{}]*\}/g)].map(m => {
    const o = { id: m[1] };
    const g = re => { const x = m[0].match(re); return x ? +x[1] : 0; };
    o.cost = g(/cost: (\d+)/);
    o.food = g(/\bfood: (\d+)/);
    o.joy = g(/\bjoy: (\d+)/);
    o.treat = /treat: true/.test(m[0]);
    return o;
  });
};

const FOODS = listOf('FOODS', data);
const TOYS = listOf('TOYS', data);
const FURNITURE = listOf('FURNITURE', data);
const HATS = listOf('HATS', data);
const COLLARS = listOf('COLLARS', data);
const THEMES = listOf('ROOM_THEMES', data);
const BOOSTERS = listOf('BOOSTERS', data);

const num = (re, src, fallback) => { const m = src.match(re); return m ? +m[1] : fallback; };
const HEART_MAX = num(/const HEART_MAX = (\d+)/, save, 5);
const HEART_REFILL_MIN = num(/const HEART_REFILL = (\d+) \* MIN/, save, 12);
const ADOPT_COST = JSON.parse((ui.match(/const ADOPT_COST = (\[[^\]]+\])/) || [])[1] || '[]');
const ADOPT_LEVEL = JSON.parse((ui.match(/const ADOPT_LEVEL = (\[[^\]]+\])/) || [])[1] || '[]');

/* the decay the pet actually has, per hour awake */
const decayFood = num(/awake:\s*\{ food: ([\d.]+)/, save, 3.4);

/* ---------- the player ---------- */

const DAYS = +process.argv[2] || 30;

/* What-if. The point of a model is to try a change before making it, so
   the three numbers that shape this economy can be overridden from the
   command line and the curve looked at before a line of the game moves.

     --payout 12,8,4000    flat, per star, coins per point of score
     --adopt 350,700,...   what each animal after the first costs
     --plays 8             a normal session rather than the heart ceiling
*/
const argOf = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
/* Read out of showWin rather than restated here. A model that carries
   its own copy of the formula stops measuring the game the moment
   somebody changes the game — which happened on the first attempt at
   this rebalance, and the report cheerfully described an economy that
   no longer existed. */
const payoutSrc = ui.match(/const coins = Math\.round\(\((\d+) \+ stars \* (\d+) \+ Math\.min\((\d+), Math\.floor\(G\.score \/ (\d+)\)\)/) ||
  ui.match(/const coins = Math\.round\(\((\d+) \+ stars \* (\d+) \+ Math\.floor\(G\.score \/ (\d+)\)/);
if (!payoutSrc) throw new Error('ödül formülü 60-ui.js içinde bulunamadı');
const FROM_GAME = payoutSrc.length === 5
  ? [+payoutSrc[1], +payoutSrc[2], +payoutSrc[4], +payoutSrc[3]]
  : [+payoutSrc[1], +payoutSrc[2], +payoutSrc[3], Infinity];
const PAYOUT = argOf('payout', '') ? argOf('payout', '').split(',').map(Number) : FROM_GAME;
if (PAYOUT.length < 4) PAYOUT.push(Infinity);
const ADOPT = argOf('adopt', '') ? argOf('adopt', '').split(',').map(Number) : null;
if (ADOPT) { ADOPT_COST.length = 0; ADOPT_COST.push(0, ...ADOPT); }
/* Hearts are the tap. Five in hand and one every twelve minutes is
   fifteen plays in a day if somebody never puts the phone down; a person
   with a life gets through the five they woke up with and a few more. */
const PLAYS_PER_DAY = +argOf('plays', 0) ||
  Math.round(HEART_MAX + (60 / HEART_REFILL_MIN) * 3);

/* Clear rate by level, from the design curve rather than from optimism:
   the lane is authored to land near these and the run descends. */
const laneWant = [...data.matchAll(/want: ([\d.]+)/g)].map(m => +m[1]);
const clearAt = n => n <= laneWant.length ? laneWant[n - 1] : 0.72;

/* A three-star clear is the exception, not the rule. Measured across the
   suite, roughly a third of wins take all three. */
const P_THREE = 0.37;

/* The score a level is worth, which is not a constant.

   The payout has a term in the score, and star targets grow as the lane
   goes: level 1 asks for 11,500 and level 60 for around 16,000, and the
   generated run keeps climbing. So the faucet widens on its own the
   longer somebody plays — the opposite of what an economy wants, and
   invisible unless the model reads the real numbers. */
const laneBase = [...data.matchAll(/base: (\d+)/g)].map(m => +m[1]);
const baseAt = n => n <= laneBase.length ? laneBase[n - 1]
  : Math.round(13000 * (1 + Math.min(2.2, (n - laneBase.length) / 120)));

const money = { coinsIn: 0, coinsOut: 0, treatsIn: 0, treatsOut: 0 };
const owned = { toys: {}, furniture: {}, hats: {}, collars: {}, themes: {} };
let coins = 0, treats = 0, level = 1, pets = 1, foodStock = 0, boosterSpend = 0;
const log = [];
let deadFrom = null, everBlocked = null;

/* everything that can be bought once and never again */
const oneOffs = []
  .concat(TOYS.map(t => ['toy', t]))
  .concat(FURNITURE.map(t => ['furniture', t]))
  .concat(HATS.filter(h => h.cost > 0).map(t => ['hat', t]))
  .concat(COLLARS.filter(h => h.cost > 0).map(t => ['collar', t]))
  .concat(THEMES.filter(h => h.cost > 0).map(t => ['theme', t]))
  .sort((a, b) => a[1].cost - b[1].cost);
const totalOneOff = oneOffs.reduce((a, x) => a + x[1].cost, 0);
const totalAdopt = ADOPT_COST.reduce((a, c) => a + c, 0);

const kibble = FOODS.filter(f => !f.treat).sort((a, b) => a.cost - b.cost)[0];
/* coins per unit of food, so the model buys the sensible thing rather
   than the cheapest thing */
const bestValue = FOODS.filter(f => !f.treat)
  .sort((a, b) => (a.cost / a.food) - (b.cost / b.food))[0];

for (let day = 1; day <= DAYS; day++) {
  let spentToday = 0, earnedToday = 0;
  const levelAtDawn = level;

  /* the day's play */
  for (let i = 0; i < PLAYS_PER_DAY; i++) {
    const p = clearAt(level);
    const won = Math.random() < p;
    if (!won) continue;
    const stars = Math.random() < P_THREE ? 3 : (Math.random() < 0.6 ? 2 : 1);
    /* the payout formula, straight out of showWin */
    /* winners land somewhere between the two-star line and comfortably
       past the three-star one */
    const score = Math.round(baseAt(level) * (stars === 3 ? 1.28 : stars === 2 ? 0.88 : 0.62));
    const gain = Math.round(PAYOUT[0] + stars * PAYOUT[1] +
      Math.min(PAYOUT[3], Math.floor(score / PAYOUT[2])));
    coins += gain; money.coinsIn += gain; earnedToday += gain;
    if (stars === 3) { treats += 1; money.treatsIn += 1; }
    if (level % 5 === 0) { treats += 2; money.treatsIn += 2; }
    level++;
  }
  /* the daily walk and its gift */
  coins += 58; money.coinsIn += 58; earnedToday += 58;
  if (day % 7 === 0) { treats += 2; money.treatsIn += 2; }

  /* keeping the animal fed: what it burns in a day, bought back */
  const burn = decayFood * 16 * pets;          /* awake most of the day */
  let need = burn;
  while (need > 0) {
    if (coins < bestValue.cost) { everBlocked = everBlocked || day; break; }
    coins -= bestValue.cost; money.coinsOut += bestValue.cost; spentToday += bestValue.cost;
    need -= bestValue.food;
    foodStock++;
  }

  /* Boosters, at the gates.

     This is the only sink in the game that cannot run out, and it is
     already built: boosters cost coins and are consumed when used. What
     stops it working is that coins are so plentiful the purchase is not
     a decision. The model spends like somebody who does not want to
     lose a gate — one booster for each gate met that day — so the report
     can show whether that demand is anywhere near the supply. */
  const gatesToday = Math.floor(level / 10) - Math.floor(levelAtDawn / 10);
  for (let g = 0; g < gatesToday; g++) {
    const b = BOOSTERS.filter(x => x.cost <= coins).sort((a, z) => z.cost - a.cost)[0];
    if (!b) break;
    coins -= b.cost; money.coinsOut += b.cost; spentToday += b.cost; boosterSpend += b.cost;
  }

  /* buying the things there are to buy, cheapest first, one a day at
     most — nobody buys the whole shop in one sitting */
  for (const [kind, item] of oneOffs) {
    const bag = owned[kind === 'toy' ? 'toys' : kind === 'hat' ? 'hats'
      : kind === 'collar' ? 'collars' : kind === 'theme' ? 'themes' : 'furniture'];
    if (bag[item.id]) continue;
    if (coins < item.cost) break;
    bag[item.id] = 1; coins -= item.cost; money.coinsOut += item.cost; spentToday += item.cost;
    break;
  }

  /* adopting, when the lane allows it and the purse does */
  if (pets < ADOPT_COST.length) {
    const cost = ADOPT_COST[pets], need2 = ADOPT_LEVEL[pets];
    if (level >= need2 && coins >= cost) {
      coins -= cost; money.coinsOut += cost; spentToday += cost; pets++;
    }
  }

  const boughtEverything = oneOffs.every(([kind, item]) => {
    const bag = owned[kind === 'toy' ? 'toys' : kind === 'hat' ? 'hats'
      : kind === 'collar' ? 'collars' : kind === 'theme' ? 'themes' : 'furniture'];
    return bag[item.id];
  }) && pets >= ADOPT_COST.length;
  if (boughtEverything && deadFrom === null) deadFrom = day;

  log.push({ day, level, coins, treats, pets, earnedToday, spentToday });
}

/* ---------- the report ---------- */

console.log('the economy, ' + DAYS + ' days');
console.log('');
console.log('  the model plays ' + PLAYS_PER_DAY + ' levels a day (' + HEART_MAX +
  ' hearts, one every ' + HEART_REFILL_MIN + ' minutes),');
console.log('  payout ' + PAYOUT.slice(0, 3).join('/') +
  (isFinite(PAYOUT[3]) ? ' capped at ' + PAYOUT[3] : ' uncapped') +
  ', adoption ' + ADOPT_COST.slice(1).join('/') + ',');
console.log('  wins as often as the level is designed to be won, and keeps the animal fed.');
console.log('');
console.log('day   level  coins   treats  pets   in    out');
console.log('---   -----  ------  ------  ----  ----  -----');
log.filter(r => r.day <= 7 || r.day % 5 === 0 || r.day === DAYS).forEach(r => {
  console.log(String(r.day).padStart(3) + '   ' +
    String(r.level).padStart(5) + '  ' +
    String(r.coins).padStart(6) + '  ' +
    String(r.treats).padStart(6) + '  ' +
    String(r.pets).padStart(4) + '  ' +
    String(r.earnedToday).padStart(4) + '  ' +
    String(r.spentToday).padStart(5));
});

const last = log[log.length - 1];
console.log('');
console.log('everything the shop sells, once:      ' + totalOneOff + ' coins');
console.log('every adoption:                       ' + totalAdopt + ' coins');
console.log('earned over ' + DAYS + ' days:' + ' '.repeat(Math.max(1, 26 - String(DAYS).length)) +
  money.coinsIn + ' coins');
console.log('spent:                                ' + money.coinsOut + ' coins');
console.log('left over:                            ' + last.coins + ' coins');
console.log('');
console.log('boosters bought over ' + DAYS + ' days:        ' + boosterSpend + ' coins' +
  '  (' + Math.round(boosterSpend / Math.max(1, money.coinsIn) * 100) + '% of income)');
console.log('');
console.log('the only thing bought more than once is food, at ' +
  Math.round(decayFood * 16) + ' food a day per animal —');
console.log('about ' + Math.round(decayFood * 16 / bestValue.food * bestValue.cost) +
  ' coins a day, against ' + Math.round(money.coinsIn / DAYS) + ' earned.');
console.log('');
if (everBlocked) {
  console.log('  BLOCKED  day ' + everBlocked + ': could not afford to feed the animal.');
}
if (deadFrom) {
  console.log('  DEAD     day ' + deadFrom + ': everything is bought. Coins keep arriving');
  console.log('           and there is nothing left they can be turned into.');
  const after = log.filter(r => r.day >= deadFrom);
  const idle = after.length ? after[after.length - 1].coins - after[0].coins : 0;
  console.log('           ' + idle + ' coins piled up in the ' + after.length +
    ' days after that.');
} else {
  console.log('  the shop still has something to want on day ' + DAYS + '.');
}

/* A guardrail, not a report.

   The economy was measured once and found dead on day twenty-five, and
   the thing that makes that finding worth anything is that it cannot
   come back quietly. Any change to a reward, a price or a decay rate
   runs through here.

   The bar: nobody may ever be unable to feed the animal, and there has
   to be something left worth saving for well past the point where most
   players have stopped. Sixty days is not a promise that anybody plays
   that long — it is the margin that keeps a small change to a payout
   from collapsing the month. */
const MUST_LAST = 60;
const faults = [];
if (everBlocked) faults.push('a player could not afford food on day ' + everBlocked);
if (deadFrom && deadFrom < MUST_LAST) {
  faults.push('nothing left to buy from day ' + deadFrom + ' (must reach ' + MUST_LAST + ')');
}
/* And the other way, which the first version of this check missed: a
   payout of five coins a win still passed, because the daily gift alone
   cleared the bar it was measuring. Money per day says nothing. What
   says something is whether a player who turned up every day for three
   months actually got anywhere. */
const boughtCount = oneOffs.filter(([kind, item]) => {
  const bag = owned[kind === 'toy' ? 'toys' : kind === 'hat' ? 'hats'
    : kind === 'collar' ? 'collars' : kind === 'theme' ? 'themes' : 'furniture'];
  return bag[item.id];
}).length;
if (pets < 2) faults.push('no second animal in ' + DAYS + ' days — too tight');
if (boughtCount < oneOffs.length / 2) {
  faults.push('only ' + boughtCount + ' of ' + oneOffs.length +
    ' things bought in ' + DAYS + ' days — too tight');
}
if (DAYS >= MUST_LAST) {
  faults.forEach(f => console.log('  x  ' + f));
  console.log(faults.length ? faults.length + ' sorun' : 'the economy holds for ' + DAYS + ' days');
  process.exitCode = faults.length ? 1 : 0;
}
