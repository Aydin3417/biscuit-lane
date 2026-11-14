/* The budget that follows the player, rule by rule.

   adaptMoves (15-save.js) changes the number of moves a level is dealt,
   which is the one lever every difficulty number in this project is
   measured against — so each of its promises is held here, against the
   game's own functions rather than a description of them:

     nobody new is touched: under six first attempts on record, below
       level fifteen, on the daily, on a level already cleared
     a player in form is cut, more for more room left, never past
       eighteen percent and never under the tuning floor
     a player who is winning narrowly, or losing, is not cut at all
     the third failure at a level starts adding a move a failure, up to
       four, three on a gate — and the cut never applies to it
     the live file can switch it off or scale it, and scaling is clamped
     the form keeps ten entries, the last ten

     node test/adapt.js
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
const X = vm.runInContext('({ TUNE, adaptMoves, noteForm, formOf, freshSave, DAILY_LEVEL, isGate, isHard, ' +
  'setSave: s => { SAVE = s; } })', ctx);

let bad = 0;
const ok = (cond, name, got) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : '   got ' + JSON.stringify(got))); if (!cond) bad++; };
const fresh = () => { const s = X.freshSave(); s.stars = {}; X.setSave(s); return s; };
const form = (entries) => { const s = fresh(); entries.forEach(([w, sp]) => X.noteForm(w, sp)); return s; };
const many = (k, w, sp) => Array.from({ length: k }, () => [w, sp]);

fresh();
ok(X.adaptMoves(40, 30, 0) === 0, 'a new player is dealt the budget as fitted', X.adaptMoves(40, 30, 0));
form(many(5, 1, .5));
ok(X.adaptMoves(40, 30, 0) === 0, 'five first attempts are not yet a form', X.adaptMoves(40, 30, 0));

form(many(10, 1, .4));
const strong = X.adaptMoves(40, 30, 0);
ok(strong < 0, 'ten wins with forty percent to spare cut the budget', strong);
ok(strong >= -Math.round(30 * .18), 'by no more than eighteen percent', strong);
ok(X.adaptMoves(12, 30, 0) === 0, 'never below level fifteen', X.adaptMoves(12, 30, 0));
ok(X.adaptMoves(X.DAILY_LEVEL, 30, 0) === 0, 'never on the daily', 0);
const s = form(many(10, 1, .4)); s.stars[40] = 3;
ok(X.adaptMoves(40, 30, 0) === 0, 'never on a level already cleared', X.adaptMoves(40, 30, 0));
form(many(10, 1, .4));
ok(30 + X.adaptMoves(40, 9, 0) >= 30 + (8 - 9), 'never under the tuning floor', X.adaptMoves(40, 9, 0));
ok(X.adaptMoves(40, 30, 2) === 0, 'the cut stops at the third attempt', X.adaptMoves(40, 30, 2));

form(many(10, 1, .30));
const mid = X.adaptMoves(40, 30, 0);
ok(mid < 0 && mid > strong, 'less room left, a smaller cut', { mid, strong });
form(many(10, 1, .12));
ok(X.adaptMoves(40, 30, 0) === 0, 'winning narrowly is no reason to cut', X.adaptMoves(40, 30, 0));
form(many(5, 1, .5).concat(many(5, 0, 0)));
ok(X.adaptMoves(40, 30, 0) === 0, 'half the attempts lost is no reason to cut', X.adaptMoves(40, 30, 0));

fresh();
ok(X.adaptMoves(41, 30, 2) === 0, 'two failures add nothing', X.adaptMoves(41, 30, 2));
ok(X.adaptMoves(41, 30, 3) === 1, 'the third failure adds a move', X.adaptMoves(41, 30, 3));
ok(X.adaptMoves(41, 30, 9) === 4, 'up to four', X.adaptMoves(41, 30, 9));
ok(X.adaptMoves(50, 30, 9) === 3, 'three on a gate', X.adaptMoves(50, 30, 9));
form(many(10, 1, .5));
ok(X.adaptMoves(41, 30, 4) === 2, 'help for being stuck wins over the cut for being good', X.adaptMoves(41, 30, 4));

form(many(10, 1, .4));
X.TUNE.apply({ v: 1, adapt: { on: 0 } }, 0);
ok(X.adaptMoves(40, 30, 0) === 0 && X.adaptMoves(41, 30, 9) === 0, 'the live file can switch it off', 0);
X.TUNE.apply({ v: 1, adapt: { k: 9 } }, 0);
ok(X.TUNE.data.adapt.k === 2, 'and its strength is clamped to double', X.TUNE.data.adapt);
X.TUNE.data = null;

const f = form(many(14, 1, .3));
ok(f.form.length === 10, 'the form keeps the last ten', f.form.length);

/* and the hard levels the map marks: two or so a block, never a gate,
   none in the opening dozen */
let hard = 0, early = 0, gates = 0;
for (let n = 1; n <= 300; n++) {
  if (!X.isHard(n)) continue;
  hard++;
  if (n < 12) early++;
  if (X.isGate(n)) gates++;
}
ok(early === 0 && gates === 0, 'no hard level in the opening dozen, and no gate is one', { early, gates });
ok(hard >= 30 && hard <= 90, 'between one and three hard levels a block over three hundred (' + hard + ')', hard);

console.log(bad ? '\n' + bad + ' failed' : '\nthe budget follows the player');
process.exit(bad ? 1 : 0);
