/* The ice rule, checked directly.

   "Frost. The tile underneath will not move until you match it where it
   is." That is three claims: an iced tile cannot be swapped, it does not
   fall, and matching it in place takes the frost off. Ice first appears
   on level 38, which is far enough in that nothing had ever exercised it
   deliberately.

     node test/ice.js
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
  performance: { now: () => Date.now() },
  navigator: { language: 'en' },
  requestAnimationFrame: fn => setTimeout(fn, 16),
  setTimeout, clearTimeout, Math, Date, JSON
};
vm.createContext(ctx);
require('./_modules.js').CORE.forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(jsDir, f), 'utf8'), ctx, { filename: f }));

const X = vm.runInContext(
  '({ makeBoard, findMatches, settle, allMoves, canSwap, levelDef, openCell })', ctx);

const problems = [];
const ok = [];

/* a small board with one iced cell in the middle */
const def = {
  n: 900, w: 6, h: 6, types: 5, moves: 20, base: 5000,
  goals: [['score', 0, 5000]],
  map: ['......', '......', '..i...', '......', '......', '......']
};
const B = X.makeBoard(def, 4242);
const iced = B.cell[2][2];
if (!iced.ice) problems.push('the map said i and the cell has no ice');
else ok.push('an i in the map makes an iced cell');

/* 1. it cannot be swapped with anything */
let swappable = 0;
[[1, 2], [3, 2], [2, 1], [2, 3]].forEach(([r, c]) => {
  if (X.canSwap(B, [2, 2], [r, c])) swappable++;
});
if (swappable) problems.push('an iced tile can be swapped with ' + swappable + ' of its 4 neighbours');
else ok.push('an iced tile cannot be swapped');

/* and no legal move names it */
const named = X.allMoves(B).filter(m =>
  (m[0][0] === 2 && m[0][1] === 2) || (m[1][0] === 2 && m[1][1] === 2));
if (named.length) problems.push('allMoves offers ' + named.length + ' move(s) onto the iced cell');
else ok.push('no legal move offers to move it');

/* 2. it does not fall when the cell below empties */
const before = B.cell[2][2].tile;
B.cell[3][2].tile = null;
X.settle(B);
if (B.cell[2][2].tile !== before) problems.push('an iced tile fell when the cell below emptied');
else ok.push('an iced tile stays put when the space below opens');

/* 3. matching it in place takes the frost off */
const B2 = X.makeBoard(def, 77);
B2.cell[2][2].ice = 1;
const t = B2.cell[2][2].tile.type;
/* line the row up around it so a match forms through the iced cell */
[[2, 0], [2, 1], [2, 3], [2, 4]].forEach(([r, c]) => { B2.cell[r][c].tile.type = t; });
const groups = X.findMatches(B2);
const hit = groups.some(g => g.cells.some(([r, c]) => r === 2 && c === 2));
if (!hit) problems.push('a line through an iced tile does not count as a match');
else ok.push('an iced tile can be matched where it stands');

console.log('the ice rule:');
ok.forEach(s => console.log('  ok   ' + s));
problems.forEach(s => console.log('  BAD  ' + s));
console.log(problems.length ? '\n' + problems.length + ' problem(s)' : '\nthe rule holds');
process.exitCode = problems.length ? 1 : 0;
