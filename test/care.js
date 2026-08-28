/* The care loop, measured.

   The room is not decoration: a pet at 70 or better in a stat hands the
   board a real perk — two extra moves, a part-charged meter, a score
   bonus, a free rocket. So "can a reasonable player hold those?" is a
   difficulty question, not a flavour one, and it deserves the same kind
   of measurement the levels get.

   This walks a pet through real elapsed time using the game's own
   simulatePet(), does what an attentive player would do at each visit,
   and reports which perks are live when the level actually starts.

     node test/care.js
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
['00-util.js', '10-data.js', '15-save.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(jsDir, f), 'utf8'), ctx, { filename: f }));

const X = vm.runInContext(
  '({ simulatePet, perksFor, DECAY, FOODS, TOYS, HOUR, clamp })', ctx);

const HOUR = X.HOUR;

/* a fresh pet, every stat full, no trait */
function pet() {
  return { id: 'p1', name: 'Test', breed: 0, stage: 2, bond: 40, trait: null,
    food: 100, joy: 100, clean: 100, energy: 100, asleep: false, care: {} };
}

/* what an attentive player does on arriving: feed the best food they
   own, play with the best toy they own, wash. Each is the game's own
   arithmetic, copied from carePlay/careWash/the feed sheet. */
function visit(p, opts) {
  const acts = [];
  const food = X.FOODS.find(f => f.id === (opts.food || 'stew'));
  if (p.asleep) { p.asleep = false; }
  if (p.food < 100) {
    p.food = X.clamp(p.food + food.food, 0, 100);
    p.joy = X.clamp(p.joy + food.joy, 0, 100);
    acts.push('feed');
  }
  const toy = X.TOYS.find(t => t.id === (opts.toy || 'puzzle'));
  if (p.energy >= 12) {
    p.joy = X.clamp(p.joy + toy.joy, 0, 100);
    p.energy = X.clamp(p.energy - 8, 0, 100);
    p.clean = X.clamp(p.clean - 6, 0, 100);
    p.food = X.clamp(p.food - 3, 0, 100);
    acts.push('play');
  } else acts.push('play BLOCKED');
  p.clean = 100;
  p.energy = X.clamp(p.energy - 4, 0, 100);
  acts.push('wash');
  return acts;
}

const r = n => Math.round(n);
const problems = [];

/* Perks are read when a level starts, so that is where they have to be
   measured. A session is: arrive, do the round, then play levels — and
   each level cleared costs the pet 5 energy and gives it 6 joy, exactly
   as showWin() does. The interesting number is not "does the player get
   the perk" but "how far into a session does it last". */
const LEVELS_PER_SESSION = 6;

function session(p) {
  const perLevel = [];
  for (let i = 0; i < LEVELS_PER_SESSION; i++) {
    perLevel.push(X.perksFor(p).map(x => x.id));
    p.joy = X.clamp(p.joy + 6, 0, 100);
    p.energy = X.clamp(p.energy - 5, 0, 100);
  }
  return perLevel;
}

const KEYS = ['moves', 'charge', 'score', 'gift'];

function run(label, gapHours, bedtime) {
  const p = pet();
  const days = [];
  for (let day = 0; day < 20; day++) {
    /* what catchUpPets() does when the player opens the app: run the
       clock forward, then let a fully rested pet get up to greet them */
    X.simulatePet(p, gapHours * HOUR);
    if (p.asleep && p.energy >= 100) p.asleep = false;
    const before = { food: p.food, joy: p.joy, clean: p.clean, energy: p.energy };
    const wasAsleep = p.asleep;
    visit(p, {});
    const perLevel = session(p);
    days.push({ day: day + 1, before, wasAsleep, perLevel });
    if (bedtime) p.asleep = true;
  }
  console.log('');
  console.log(`=== ${label} ===`);
  console.log('day  arrives (f/j/c/e)      found    perks live at level 1..6 of the session');
  days.slice(0, 6).forEach(x => {
    console.log(
      String(x.day).padEnd(5) +
      `${r(x.before.food)}/${r(x.before.joy)}/${r(x.before.clean)}/${r(x.before.energy)}`.padEnd(24) +
      (x.wasAsleep ? 'asleep' : 'up').padEnd(9) +
      x.perLevel.map(ps => ps.filter(k => KEYS.includes(k)).length).join(' ') +
      '   ' + x.perLevel[0].filter(k => KEYS.includes(k)).join(' '));
  });
  /* settled behaviour: the last ten days */
  const tail = days.slice(-10);
  const freq = {};
  KEYS.forEach(k => freq[k] = Math.round(
    tail.filter(x => x.perLevel[0].includes(k)).length / tail.length * 100));
  /* how deep into a session the rocket survives */
  const giftDepth = tail.reduce((a, x) =>
    a + x.perLevel.filter(ps => ps.includes('gift')).length, 0) / tail.length;
  console.log('  settles at, on level 1: ' + KEYS.map(k => `${k} ${freq[k]}%`).join('   '));
  console.log(`  the rocket lasts ${giftDepth.toFixed(1)} of the ${LEVELS_PER_SESSION} levels in a session`);
  return { freq, giftDepth };
}

const daily = run('opens it once a day (24h)', 24, false);
const bedtime = run('once a day, tapped Sleep on the way out', 24, true);
const twice = run('opens it twice a day (12h)', 12, false);

console.log('');
console.log('perk names: moves=+2 moves  charge=35% charged  score=+12% score  gift=free rocket');

/* Three of the four are the reward for turning up and doing the round,
   so they should be dependable. Energy is the one the player spends by
   playing, so the rocket is meant to run out partway through a session —
   it must neither be unreachable nor free for the whole session. */
[['once a day', daily], ['twice a day', twice], ['with a bedtime', bedtime]].forEach(([label, m]) => {
  ['moves', 'charge', 'score'].forEach(k => {
    if (m.freq[k] < 90) problems.push(`${label}: ${k} is live only ${m.freq[k]}% of days — the routine should hold it`);
  });
  if (m.giftDepth < 1) problems.push(`${label}: the rocket almost never appears (${m.giftDepth.toFixed(1)} levels) — energy is unreachable`);
  if (m.giftDepth >= LEVELS_PER_SESSION) problems.push(`${label}: the rocket never runs out — energy costs the player nothing`);
});
/* the sleep button must reward using it, not punish it */
if (bedtime.giftDepth < daily.giftDepth)
  problems.push(`tapping Sleep leaves the pet worse rested (${bedtime.giftDepth.toFixed(1)} vs ${daily.giftDepth.toFixed(1)} levels) — the button punishes using it`);

console.log('');
if (problems.length) { problems.forEach(x => console.log('  PROBLEM  ' + x)); process.exit(1); }
console.log('the care loop pays out');
