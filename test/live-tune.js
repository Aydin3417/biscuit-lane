/* The live-tuning file, fed to the game as it would arrive.

   One JSON file in a public bucket can now change the move budget of
   any level on every phone that launches. The thing that makes that
   safe is not the person uploading it, it is 14-tune.js refusing to
   apply anything outside its ranges — so this is a test of the refusing,
   not of the fetching. A good file goes through intact; a file with
   numbers out of range comes out clamped; a file with the wrong shape
   is ignored whole; and nothing in any of them can make a call throw.

   Then the same through the game's own functions, because a clamp that
   is right in isolation and never reached by levelDef() is decoration:
   the level the table hands out has to carry the corrected budget, and
   a payout has to come out as the whole number the card can show.

     node test/live-tune.js
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
  '({ TUNE, tuneMoves, tunePay, tuneNapFrom, levelDef, dailyLevel, DAILY_LEVEL, LEVELS, APP_VERSION,' +
  '   setLang: l => { LANG = l; }, setSave: s => { SAVE = s; }, freshSave })', ctx);
const { TUNE, tuneMoves, tunePay, tuneNapFrom, levelDef, dailyLevel, DAILY_LEVEL } = X;
/* what boot hands in; headless there is no address and no fetch */
TUNE.version = X.APP_VERSION;
const io = s => ({ version: X.APP_VERSION, load: () => s.tune, store: t => { s.tune = t; } });

let fails = 0, checks = 0;
function ok(cond, what) {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + what); }
}
function eq(a, b, what) { ok(a === b, what + ' — got ' + JSON.stringify(a) + ', wanted ' + JSON.stringify(b)); }
function reset() { TUNE.data = null; TUNE.at = 0; }

/* ---- the defaults, with nothing applied ---- */
console.log('nothing applied');
reset();
eq(tuneMoves(5, 31), 31, 'moves pass through untouched');
eq(tuneMoves('daily', 28), 28, 'the walk passes through untouched');
eq(tunePay('coin', 120), 120, 'coins pass through untouched');
eq(tunePay('nap', 0), 0, 'a zero payout stays zero');
eq(tuneNapFrom(), 3, 'the nap card from level three');
eq(TUNE.notice(), '', 'no notice');
const row5 = levelDef(5);
ok(row5 === levelDef(5), 'untuned, levelDef hands out the table row itself');

/* ---- a good file ---- */
console.log('a good file');
const good = {
  v: 1,
  moves: { 5: 3, 12: -2, daily: 1 },
  pay: { coin: 1.25, treat: 0.75, nap: 2 },
  nap: { from: 2 },
  notice: { min: '9.0.0', en: 'A new build is out.', tr: 'Yeni sürüm çıktı.' }
};
ok(TUNE.apply(good, 1000), 'applies');
eq(tuneMoves(5, 31), 34, '+3 on level five');
eq(tuneMoves(12, 36), 34, '-2 on level twelve');
eq(tuneMoves(7, 36), 36, 'a level not in the file is untouched');
eq(tuneMoves('daily', 28), 29, '+1 on the walk');
eq(tunePay('coin', 100), 125, 'coins ×1.25');
eq(tunePay('treat', 2), 2, 'treats ×0.75: 1.5 rounds to 2, a whole number');
eq(tunePay('treat', 1), 1, 'a treat that paid still pays at least one');
eq(tunePay('nap', 30), 60, 'nap coins ×2');
eq(tunePay('coin', 0), 0, 'a zero payout stays zero under a multiplier');
eq(tuneNapFrom(), 2, 'the nap card from level two');
eq(TUNE.notice(), 'A new build is out.', 'the notice in English, this build being older than 9.0.0');
X.setLang('tr');
eq(TUNE.notice(), 'Yeni sürüm çıktı.', 'and in Turkish');
X.setLang('en');
eq(JSON.stringify(TUNE.data.moves), '{"5":3,"12":-2,"daily":1}', 'the moves table as given');

/* the notice compares version parts, not strings */
ok(TUNE.apply({ v: 1, notice: { min: X.APP_VERSION, en: 'x' } }), 'a notice at this very version applies');
eq(TUNE.notice(), '', 'but is not shown: this build is not older than itself');
ok(TUNE.apply({ v: 1, notice: { min: '0.9.0', en: 'x' } }), 'an older min applies');
eq(TUNE.notice(), '', 'and is not shown either');
ok(TUNE.apply({ v: 1, notice: { min: '1.10.0', en: 'ten' } }), '1.10.0 applies');
eq(TUNE.notice(), X.APP_VERSION.split('.').map(Number)[1] < 10 ? 'ten' : '', '1.10 is read as ten, not as one point one');

/* ---- through the game's own tables ---- */
console.log('through levelDef and dailyLevel');
reset();
const base5 = levelDef(5).moves, base70 = levelDef(70).moves;
const baseDaily = dailyLevel(10, 20000).moves;
TUNE.apply({ v: 1, moves: { 5: 4, 70: -3, daily: 2 } });
eq(levelDef(5).moves, base5 + 4, 'an authored level carries the correction');
ok(levelDef(5) !== row5, 'on a copy, not the table row');
eq(X.LEVELS[4].moves, base5, 'and the table row itself is unchanged');
eq(levelDef(5).moves, base5 + 4, 'the same on the second call: it does not compound');
eq(levelDef(70).moves, base70 - 3, 'a generated level carries it');
eq(dailyLevel(10, 20000).moves, baseDaily + 2, 'the walk carries it');
const g5 = JSON.stringify(levelDef(5).goals), r5 = JSON.stringify(row5.goals);
eq(g5, r5, 'the goals are the level\'s own: only the budget moved');

/* ---- out of range: clamped, never refused ---- */
console.log('out of range');
reset();
ok(TUNE.apply({
  v: 1,
  moves: { 1: 60, 2: -60, 3: 2.6, 4: 0, 5: 'nine', 6: null, abc: 3, 0: 5, '-1': 5, 99999: 5 },
  pay: { coin: 0, treat: 100, nap: -1, gold: 7 },
  nap: { from: 500 },
  notice: { min: 'latest', en: 'x' }
}), 'a file with every number wrong still applies');
eq(tuneMoves(1, 20), 26, '60 is clamped to +6');
eq(tuneMoves(2, 20), 14, '-60 is clamped to -6');
eq(tuneMoves(2, 10), 8, 'and the floor of eight holds under it');
eq(tuneMoves(3, 20), 23, '2.6 is rounded to 3');
eq(tuneMoves(4, 20), 20, 'a zero delta is a no-op');
eq(tuneMoves(5, 20), 20, 'a word is not a delta');
eq(tuneMoves(6, 20), 20, 'nor is null');
eq(tuneMoves(0, 20), 20, 'level 0 is not a level');
eq(tuneMoves(-1, 20), 20, 'nor -1 (the walk is "daily", not the level number)');
eq(tuneMoves(99999, 20), 20, 'a five-digit level is out of range');
ok(!('abc' in TUNE.data.moves), 'an unknown key is dropped');
eq(tunePay('coin', 100), 50, 'coin ×0 is clamped to ×0.5');
eq(tunePay('treat', 2), 4, 'treat ×100 is clamped to ×2');
eq(tunePay('nap', 30), 15, 'nap ×-1 is clamped to ×0.5');
eq(tunePay('gold', 10), 10, 'an unknown payout kind is untouched');
ok(!('gold' in TUNE.data.pay), 'and not kept');
eq(tuneNapFrom(), 60, 'from 500 is clamped to 60');
eq(TUNE.notice(), '', 'a notice whose min is not a version is dropped');

ok(TUNE.apply({ v: 1, nap: { from: 0 } }), 'from 0 applies');
eq(tuneNapFrom(), 1, 'as 1');
ok(TUNE.apply({ v: 1, nap: { from: -3.7 } }), 'from -3.7 applies');
eq(tuneNapFrom(), 1, 'as 1 too');

/* ---- malformed: ignored whole, and what was in force stays ---- */
console.log('malformed');
reset();
ok(TUNE.apply({ v: 1, moves: { 5: 3 } }), 'something in force first');
const bad = [
  null, undefined, 42, 'v: 1', true, [], [1, 2],
  {}, { v: 2 }, { v: '1' }, { v: 1.5 }, { moves: { 5: 3 } },
  { v: 1, moves: [3, 3] }, { v: 1, moves: 'none' }, { v: 1, pay: 5 }, { v: 1, nap: 'late' },
  { v: 1, notice: 'soon' }, { v: 1, notice: { en: 'no min' } }, { v: 1, notice: { min: '1.0.0' } }
];
bad.forEach(b => {
  let threw = false, applied;
  try { applied = TUNE.apply(b); } catch (e) { threw = true; }
  ok(!threw, 'does not throw on ' + JSON.stringify(b));
  const whole = b && typeof b === 'object' && !Array.isArray(b) && b.v === 1;
  if (!whole) {
    ok(applied === false, 'refuses ' + JSON.stringify(b));
    eq(tuneMoves(5, 20), 23, 'and what was in force stays, after ' + JSON.stringify(b));
  } else {
    /* a well-formed file with one bad field keeps the good fields and
       drops the bad one: that is clamping, not refusal */
    ok(applied === true, 'applies ' + JSON.stringify(b) + ' with the bad field dropped');
    eq(tuneMoves(5, 20), 20, 'and it carries no moves');
    eq(tunePay('coin', 10), 10, 'and no multiplier');
    eq(TUNE.notice(), '', 'and no notice');
    TUNE.apply({ v: 1, moves: { 5: 3 } });
  }
});

/* a notice too long to be a notice is cut, not refused */
ok(TUNE.apply({ v: 1, notice: { min: '9.9.9', en: 'x'.repeat(5000) } }), 'a 5000-character notice applies');
eq(TUNE.notice().length, 240, 'cut to 240');

/* ---- the save: the cached copy comes back through the same gate ---- */
console.log('the cached copy');
reset();
TUNE.started = false;
const s = X.freshSave();
eq(s.tune, null, 'a fresh save carries no tuning');
s.tune = { at: 5, data: { v: 1, moves: { 5: 60 }, pay: { coin: 9 } } };
X.setSave(s);
TUNE.init(io(s));
eq(tuneMoves(5, 20), 26, 'a cached copy from a build with looser ranges is clamped on the way in');
eq(tunePay('coin', 10), 20, 'both ways');
eq(TUNE.at, 5, 'and keeps its time');
reset();
TUNE.started = false;
s.tune = { at: 1, data: { v: 7 } };
X.setSave(s);
TUNE.init(io(s));
eq(TUNE.data, null, 'a cached copy of the wrong version is left alone');
/* headless there is no location and no fetch: refresh() says so and
   does not throw, which is what keeps the suites off the bucket */
let p;
try { p = TUNE.refresh(); } catch (e) { p = null; }
ok(p && typeof p.then === 'function', 'refresh() returns a promise headless');
if (p) p.then(r => {
  eq(r, false, 'and it resolves false: nothing fetched');
  report();
}, () => { fails++; console.log('  FAIL  refresh() rejected headless'); report(); });
else report();

function report() {
  console.log((fails ? fails + ' of ' : 'all ') + checks + ' checks ' + (fails ? 'FAILED' : 'passed'));
  process.exitCode = fails ? 1 : 0;
}
