/* Nap time, the puzzle itself: every board the game will ever deal.

     node test/nap.js [levels] [days]

   A logic puzzle has one promise to keep, and the whole genre lives or
   dies on it: the board has exactly one answer, and a person can reach
   it by reasoning without ever guessing. A board with two answers marks
   a correct player wrong; a board that needs a guess is a coin toss
   dressed as a puzzle. So each board is checked against both, plus the
   things the game leans on: the same seed makes the same board on every
   phone (the daily is the same for everybody), a hint never points at a
   cell outside the answer, and the time a board takes to make, since a
   phone is three to five times slower than the desk this runs on. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsDir = path.join(__dirname, '..', 'src', 'js');
const util = fs.readFileSync(path.join(jsDir, '00-util.js'), 'utf8');
const ctx = { Math, Date, Int8Array, Int16Array, Uint8Array, Float64Array, Array, Set, console };
vm.createContext(ctx);
vm.runInContext(util.match(/function mulberry[\s\S]*?\n}\n/)[0], ctx);
vm.runInContext(fs.readFileSync(path.join(jsDir, '32-nap.js'), 'utf8'), ctx, { filename: '32-nap.js' });
const N = ctx;

const LEVELS = +(process.argv[2] || 120), DAYS = +(process.argv[3] || 120);
let bad = 0;
const fail = (what, got) => { bad++; console.log('  ✗ ' + what + (got !== undefined ? '   got ' + JSON.stringify(got) : '')); };
const ok = what => console.log('  ✓ ' + what);

function check(b, label) {
  const n = b.n;
  if (N.napCount(n, b.reg, 2) !== 1) return fail(label + ' has exactly one answer');
  /* the stored answer is the answer */
  const st = new Int8Array(n * n);
  for (let r = 0; r < n; r++) st[r * n + b.sol[r]] = 2;
  if (!N.napSolved(b, st)) return fail(label + ' keeps its own rule', Array.from(b.sol));
  if (!N.napReason(b, 4)) return fail(label + ' is reached by reasoning');
  /* every cushion is one piece */
  for (let k = 0; k < n; k++) if (!N.napWhole(n, b.reg, k, -1)) return fail(label + ' cushion ' + k + ' is in one piece');
  /* hints, from empty, walk to the answer and never off it */
  const play = new Int8Array(n * n);
  for (let guard = 0; guard < n * n * 2; guard++) {
    if (N.napSolved(b, play)) break;
    const h = N.napHint(b, play);
    if (!h) return fail(label + ' hint has something to say until it is solved');
    if (h.kind === 'wrong') return fail(label + ' hint calls a correct pet wrong');
    for (const i of h.cells) {
      const r = (i / n) | 0, c = i % n;
      if (h.kind === 'pet' && b.sol[r] !== c) return fail(label + ' hint puts a pet off the answer', i);
      if (h.kind === 'x' && b.sol[r] === c) return fail(label + ' hint crosses out the answer', i);
      play[i] = h.kind === 'pet' ? 2 : 1;
    }
  }
  if (!N.napSolved(b, play)) return fail(label + ' hints alone solve it');
  return true;
}

console.log('the ladder, 1-' + LEVELS);
let worst = 0, sizes = {};
for (let no = 1; no <= LEVELS; no++) {
  const t = Date.now();
  const b = N.napLevel(no);
  const ms = Date.now() - t;
  worst = Math.max(worst, ms);
  if (!b) { fail('level ' + no + ' is made'); continue; }
  sizes[b.n] = (sizes[b.n] || 0) + 1;
  check(b, 'level ' + no);
  if (no === 1 && b.n !== 4) fail('the first board is the small one', b.n);
}
ok('made, unique and reasoned out (' + Object.keys(sizes).map(k => k + '×' + k + ': ' + sizes[k]).join(', ') + '), slowest ' + worst + ' ms');

console.log('the daily, ' + DAYS + ' days');
worst = 0;
for (let d = 20700; d < 20700 + DAYS; d++) {
  const t = Date.now();
  const b = N.napDaily(d);
  worst = Math.max(worst, Date.now() - t);
  if (!b) { fail('day ' + d + ' is made'); continue; }
  check(b, 'day ' + d);
}
ok('made, unique and reasoned out, slowest ' + worst + ' ms');
if (worst > 4000) fail('a daily board takes under four seconds on a desk', worst);

console.log('the same everywhere');
const a = N.napDaily(20756), b2 = N.napDaily(20756);
if (Array.from(a.reg).join() !== Array.from(b2.reg).join()) fail('one day, one board');
else ok('one day, one board');
const l1 = N.napLevel(7), l2 = N.napLevel(7);
if (Array.from(l1.reg).join() !== Array.from(l2.reg).join()) fail('one rung, one board');
else ok('one rung, one board');

console.log('the rule, as the board shows it');
{
  const b = N.napLevel(1), n = b.n, st = new Int8Array(n * n);
  st[0] = 2; st[1] = 2;
  const cl = N.napClashes(b, st);
  if (!(cl.has(0) && cl.has(1))) fail('two pets side by side wake each other', Array.from(cl));
  else ok('two pets side by side wake each other');
  const st2 = new Int8Array(n * n);
  st2[0] = 2; st2[n + 1] = 2;
  if (!N.napClashes(b, st2).has(0)) fail('corner to corner counts as touching');
  else ok('corner to corner counts as touching');
  /* a wrong pet is what the hint names first */
  const st3 = new Int8Array(n * n);
  const wrongC = (b.sol[0] + 2) % n;
  st3[wrongC] = 2;
  const h = N.napHint(b, st3);
  if (!h || h.kind !== 'wrong' || h.cells[0] !== wrongC) fail('a wrong pet is pointed at before anything else', h);
  else ok('a wrong pet is pointed at before anything else');
}

console.log(bad ? '\n' + bad + ' problem(s)' : '\nevery board keeps its promise');
process.exit(bad ? 1 : 0);
