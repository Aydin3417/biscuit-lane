/* The week's events (53-events.js), rule by rule.

     weeks run Monday to Sunday; the weekend run is open Friday to Sunday
     only the week's breed counts, and each prize is paid once, in order
     seven wins in a row pay the weekend run once; a loss, or leaving a
     level, starts it again; on a weekday a win does nothing to it
     a new week starts both afresh
     nothing happens before the events open (level 5)

     node test/events.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsDir = path.join(__dirname, '..', 'src', 'js');
const ctx = {
  console,
  SP: { NONE: 0, ROW: 1, COL: 2, BOMB: 3, RAIN: 4 },
  document: { createElement: () => ({ getContext: () => ({}) }), querySelector: () => null },
  window: { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 },
  localStorage: { getItem: () => null, setItem: () => { }, removeItem: () => { } },
  navigator: { language: 'en' },
  performance: { now: () => Date.now() },
  requestAnimationFrame: fn => setTimeout(fn, 16),
  setTimeout: fn => fn(), clearTimeout, Math, Date, JSON
};
vm.createContext(ctx);
vm.runInContext('var LANG = "en";', ctx);
require('./_modules.js').WITH_SAVE.forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(jsDir, f), 'utf8'), ctx, { filename: f }));
vm.runInContext(`
  var __toasts = [], __day = 0;
  function T(k) { return k; } function track() {} function toast(t) { __toasts.push(t); }
  dayNumber = function () { return __day; };
  castBreed = function (slot) { return slot; };
`, ctx);
vm.runInContext(fs.readFileSync(path.join(jsDir, '53-events.js'), 'utf8'), ctx, { filename: '53-events.js' });
const X = vm.runInContext(`({ evWeek, evWeekday, evRaceOn, evBreed, evState, evTiles, evWon, evLost, EV_COLLECT_TIERS, EV_RACE, EV,
  freshSave, setSave: s => { SAVE = s; }, day: d => { __day = d; }, toasts: () => __toasts })`, ctx);

let bad = 0;
const ok = (cond, name, got) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : '   got ' + JSON.stringify(got))); if (!cond) bad++; };
const fresh = () => { const s = X.freshSave(); s.reached = 12; X.setSave(s); return s; };

/* 23 Nov 2026 was a Monday */
const MON = Math.floor(Date.UTC(2026, 10, 23) / 86400000);
ok(X.evWeekday(MON) === 0 && X.evWeekday(MON + 6) === 6, 'Monday is the first day of the week, Sunday the last', [X.evWeekday(MON), X.evWeekday(MON + 6)]);
ok(X.evWeek(MON) === X.evWeek(MON + 6) && X.evWeek(MON + 7) === X.evWeek(MON) + 1, 'a week runs Monday to Sunday', [X.evWeek(MON), X.evWeek(MON + 6), X.evWeek(MON + 7)]);
ok(!X.evRaceOn(MON + 3) && X.evRaceOn(MON + 4) && X.evRaceOn(MON + 6), 'the weekend run is open Friday to Sunday', [MON + 3, MON + 4].map(X.evRaceOn));

let s = fresh(); X.day(MON);
const want = X.evBreed(X.evWeek(MON)), other = (want + 1) % 6;
const coins0 = s.coins;
X.evTiles({ [other]: 500 });
ok(X.evState().got === 0, "another breed's tiles do not count", X.evState());
X.evTiles({ [want]: 119 });
ok(X.evState().tiers === 0, 'nothing is paid below the first prize', X.evState());
X.evTiles({ [want]: 1 });
ok(X.evState().tiers === 1 && s.coins === coins0 + X.EV_COLLECT_TIERS[0].coins, 'the first prize is paid at 120', { st: X.evState(), coins: s.coins - coins0 });
X.evTiles({ [want]: 1000 });
ok(X.evState().tiers === 3, 'a big clear pays every prize it passes, in order', X.evState());
const treats = s.treats, starN = s.boosters.star || 0;
X.evTiles({ [want]: 1000 });
ok(s.treats === treats && (s.boosters.star || 0) === starN, 'and none of them twice', { treats: s.treats - treats });

s = fresh(); X.day(MON + 2);
for (let i = 0; i < 9; i++) X.evWon();
ok(X.evState().run === 0, 'on a weekday a win does nothing to the weekend run', X.evState());
X.day(MON + 4);
for (let i = 0; i < 6; i++) X.evWon();
X.evLost();
ok(X.evState().run === 0 && X.evState().broke, 'a loss on the sixth starts it again, and says so', X.evState());
const c1 = s.coins;
for (let i = 0; i < 7; i++) X.evWon();
ok(X.evState().raced && s.coins === c1 + X.EV_RACE.coins, 'seven in a row pay the weekend prize', { st: X.evState(), coins: s.coins - c1 });
const c2 = s.coins;
for (let i = 0; i < 7; i++) X.evWon();
ok(s.coins === c2, 'once a weekend', s.coins - c2);

X.day(MON + 7);
ok(X.evState().got === 0 && X.evState().run === 0 && !X.evState().raced, 'a new week starts both afresh', X.evState());

s = fresh(); s.reached = 3; X.day(MON + 5);
X.evTiles({ [X.evBreed(X.evWeek(MON + 5))]: 999 }); X.evWon();
ok(!s.events, 'nothing happens before the events open', s.events);

console.log(bad ? '\n' + bad + ' failed' : '\nthe week has its events');
process.exit(bad ? 1 : 0);
