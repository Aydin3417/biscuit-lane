/* How deep do cascades actually go?

   Two badges ask for a chain of five and a chain of eight. A badge for
   something that never happens is a dead promise, so this counts what
   the engine really produces over a lot of play.

     node test/chains.js [games]
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
['00-util.js', '10-data.js', '30-engine.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(jsDir, f), 'utf8'), ctx, { filename: f }));

const X = vm.runInContext(
  '({ makeBoard, findMatches, specialFor, settle, allMoves, canSwap, levelDef, openCell, SP })', ctx);

/* one move, resolved to the end, returning how many cascade steps it took */
function resolveChain(B, a, b) {
  const ta = B.cell[a[0]][a[1]].tile, tb = B.cell[b[0]][b[1]].tile;
  B.cell[a[0]][a[1]].tile = tb; B.cell[b[0]][b[1]].tile = ta;
  let chain = 0, biggest = 0;
  for (;;) {
    const groups = X.findMatches(B);
    if (!groups.length) break;
    chain++;
    let n = 0;
    groups.forEach(g => {
      n += g.cells.length;
      g.cells.forEach(([r, c]) => { B.cell[r][c].tile = null; });
    });
    if (n > biggest) biggest = n;
    X.settle(B);
  }
  return { chain, biggest };
}

const GAMES = +(process.argv[2] || 400);
const hist = {};
let deepest = 0, biggestClear = 0, moves = 0;
for (let g = 0; g < GAMES; g++) {
  const n = 1 + (g % 60);
  const def = X.levelDef(n);
  const B = X.makeBoard(def, g * 7919 + 13);
  B.pupQueue = 0;
  for (let m = 0; m < 26; m++) {
    const legal = X.allMoves(B);
    if (!legal.length) break;
    const pick = legal[(Math.random() * legal.length) | 0];
    const r = resolveChain(B, pick[0], pick[1]);
    moves++;
    hist[r.chain] = (hist[r.chain] || 0) + 1;
    if (r.chain > deepest) deepest = r.chain;
    if (r.biggest > biggestClear) biggestClear = r.biggest;
  }
}
console.log('games', GAMES, ' moves', moves);
console.log('deepest chain', deepest, ' biggest single clear', biggestClear);
const keys = Object.keys(hist).map(Number).sort((a, b) => a - b);
keys.forEach(k => {
  const n = hist[k];
  const pct = (n / moves * 100);
  console.log('  chain ' + String(k).padStart(2) + ': ' + String(n).padStart(6) +
    '  ' + pct.toFixed(2) + '%' + (pct >= .05 ? '  ' + '#'.repeat(Math.max(1, Math.round(pct / 2))) : ''));
});
const atLeast = k => keys.filter(x => x >= k).reduce((s, x) => s + hist[x], 0);
[5, 6, 7, 8].forEach(k => {
  const n = atLeast(k);
  console.log('chain >= ' + k + ': ' + n + ' of ' + moves + ' moves (' +
    (n / moves * 100).toFixed(3) + '%)' + (n ? '  — about one in ' + Math.round(moves / n) + ' moves' : '  — NEVER'));
});
