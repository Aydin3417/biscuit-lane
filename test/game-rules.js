/* The rules, played through the real 40-game.js rather than a copy.

   Every other headless harness here carries its own resolve loop, and
   that is how the molehill goal shipped broken: the solver's counter had
   a `mole` field and the game's did not, so every test said level 76
   was fine while no player could win it. This loads the game's own file
   with the document stubbed out and plays moves through tryMove, so what
   it checks is what a player gets.

     node test/game-rules.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsDir = path.join(__dirname, '..', 'src', 'js');
const read = f => fs.readFileSync(path.join(jsDir, f), 'utf8');
const noop = () => {};
function el() {
  return {
    classList: { toggle: noop, add: noop, remove: noop }, style: {}, dataset: {},
    setAttribute: noop, appendChild: noop, addEventListener: noop, remove: noop,
    querySelectorAll: () => [], querySelector: () => el(),
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    getContext: () => new Proxy({}, { get: () => noop }),
    textContent: '', innerHTML: '', offsetWidth: 0, clientWidth: 400, clientHeight: 400
  };
}
const ctx = {
  console, SP: { NONE: 0, ROW: 1, COL: 2, BOMB: 3, RAIN: 4 },
  document: { createElement: el, querySelector: el, querySelectorAll: () => [], addEventListener: noop, body: el() },
  window: { matchMedia: () => ({ matches: false }), devicePixelRatio: 1, addEventListener: noop },
  performance: { now: () => Date.now() }, navigator: { language: 'en' },
  requestAnimationFrame: fn => setTimeout(fn, 0), setTimeout, clearTimeout,
  Math, Date, JSON, Promise, Set, Map, Array,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop }
};
vm.createContext(ctx);
require('./_modules.js').CORE.forEach(f =>
  vm.runInContext(read(f).replace(/^'use strict';?$/m, ''), ctx, { filename: f }));
/* everything 40-game.js reaches for that lives in a module with a
   document in it: sound, art, the save, the interface */
const stubs = {
  SFX: 'new Proxy({}, { get: () => () => {} })', FX: 'new Proxy({}, { get: () => () => {} })',
  SAVE: '{ stats: { tilesPopped: 0, played: 0 }, boosters: { hammer: 3, swap: 3, shuffle: 3 }, settings: {}, stars: {}, winRun: 0, reached: 999, seen: {} }',
  persist: '() => {}', track: '() => {}', toast: '() => {}', activePet: '() => null',
  slotGem: "() => '#fff'", PAL: "new Proxy({}, { get: () => '#000' })",
  audioResume: '() => {}', petVoice: '() => {}', say: '() => {}', drawLevelScene: '() => {}',
  clearSprites: '() => {}', tileSprite: '() => {}', sceneProgress: '() => 0',
  breedName: "() => ''", castName: "() => ''", petDative: "() => ''", T: '(k) => k',
  paintTile: '() => {}', paintCrate: '() => {}', paintMud: '() => {}', paintBramble: '() => {}',
  paintBrambleOver: '() => {}', paintPup: '() => {}', paintMole: '() => {}', Path2D: 'function () {}',
  goodName: "() => ''", specOfPet: '() => ({})', drawFace: '() => {}', DAILY_LEVEL: '-7', petStageIdx: '() => 0'
};
for (const k in stubs) vm.runInContext(`if (typeof ${k} === 'undefined') globalThis.${k} = ${stubs[k]};`, ctx);
vm.runInContext('globalThis.__events = []; EV.emit = function (e) { globalThis.__events.push(e); };', ctx);
vm.runInContext(read('40-game.js'), ctx, { filename: '40-game.js' });
vm.runInContext('gameLoopStart = () => {}; layoutBoard = () => {}; FAST_FORWARD = true;', ctx);

const run = src => vm.runInContext('(async () => {' + src + '})()', ctx);

/* A board the test controls. Two colours in a checker never line up, so
   nothing clears unless the test says so; refills are random, so it is
   painted again before every move. A move is then set up as a row of
   three at (row, c0..c0+2), completed by swapping the tile below its
   right end up into it. */
vm.runInContext(`
  globalThis.__levelDef = levelDef;
  globalThis.__level = function (def) {
    def._fixed = true;
    levelDef = () => JSON.parse(JSON.stringify(def));
    startLevel(def.n, {});
    G.busy = false;
  };
  globalThis.__paint = function () {
    eachCell(G.B, (cell, r, c) => { if (cell.tile) { cell.tile.type = 3 + ((r + c) % 2); cell.tile.sp = SP.NONE; } });
  };
  globalThis.__three = function (row, c0) {
    __paint();
    const B = G.B;
    B.cell[row][c0].tile.type = 0; B.cell[row][c0 + 1].tile.type = 0;
    B.cell[row][c0 + 2].tile.type = 1; B.cell[row + 1][c0 + 2].tile.type = 0;
    return [[row + 1, c0 + 2], [row, c0 + 2]];
  };
`, ctx);

const ok = [], problems = [];
const check = (cond, good, bad) => (cond ? ok : problems).push(cond ? good : bad);

(async () => {
  /* 1. a molehill closed by play moves its goal, and the level is won */
  const mole = await run(`
    __level({ n: 9001, w: 6, h: 6, types: 5, moves: 20, base: 1000, goals: [[GK.MOLE, 0, 1]],
      map: ['......', '......', '..o...', '......', '......', '......'] });
    const hill = G.B.cell[2][2];
    hill.moleT = 99;                       /* no earth pushed up mid-test */
    const layers0 = hill.mole;
    let m = __three(3, 1); await tryMove(m[0], m[1]);
    const layers1 = hill.mole, have1 = G.goals[0].have;
    m = __three(3, 1); await tryMove(m[0], m[1]);
    return { layers0, layers1, layers2: hill.mole, have1, have2: G.goals[0].have,
      met: goalsMet(), over: G.over, won: __events.includes('goal') };
  `);
  check(mole.layers0 === 2 && mole.layers1 === 1 && mole.layers2 === 0,
    'a hill loses one layer a move to a clear beside it (2, 1, 0)',
    'hill layers went ' + [mole.layers0, mole.layers1, mole.layers2].join(', ') + ', expected 2, 1, 0');
  check(mole.have1 === 0 && mole.have2 === 1,
    'closing the hill moves the molehill goal (0 then 1 of 1)',
    'molehill goal read ' + mole.have1 + ' then ' + mole.have2 + ', expected 0 then 1');
  check(mole.met && mole.over && mole.won,
    'goalsMet() is true and the level is won',
    'hill closed but goalsMet=' + mole.met + ' over=' + mole.over + ' won=' + mole.won);

  /* 2. a kill during the last move's cascade: the save written at the
     spend has no moves left, and the resumed level must end rather than
     take the move again */
  const last = await run(`
    __events.length = 0;
    let saved = null;
    persist = function () { if (SAVE.inLevel) saved = JSON.parse(JSON.stringify(SAVE.inLevel)); };
    __level({ n: 9002, w: 6, h: 6, types: 5, moves: 1, base: 999999, goals: [[GK.SCORE, 0, 999999]] });
    const m = __three(3, 1);
    saved = null;
    const p = tryMove(m[0], m[1]);
    await new Promise(r => setTimeout(r, 0));
    const atSpend = saved;               /* what a kill mid-cascade leaves */
    await p;
    const lostFirst = __events.includes('lost');
    /* relaunched and left alone: it has to end by itself */
    __events.length = 0;
    startLevel(atSpend.n, { resume: atSpend });
    const resumed = { moves: G.moves, over: G.over, made: G.made };
    await new Promise(r => setTimeout(r, 800));       /* the deal-in */
    const over = G.over, lost = __events.includes('lost');
    /* relaunched and swiped at straight away: the swap is refused */
    startLevel(atSpend.n, { resume: atSpend });
    G.busy = false;
    const m2 = allMoves(G.B)[0];
    await tryMove(m2[0], m2[1]);
    const madeAfter = G.made;
    return { snapMoves: atSpend.moves, lostFirst, resumed, madeAfter, over, lost };
  `);
  check(last.snapMoves === 0 && last.lostFirst && last.resumed.moves === 0 && !last.resumed.over,
    'the save at the last move\'s spend resumes with 0 moves, not yet over',
    'set-up did not reproduce: ' + JSON.stringify(last));
  check(last.madeAfter === last.resumed.made,
    'a swap with 0 moves left is refused',
    'a swap with 0 moves left was played (made ' + last.resumed.made + ' -> ' + last.madeAfter + ')');
  check(last.over && last.lost,
    'the resumed level with 0 moves ends in a loss once dealt in',
    'the resumed level with 0 moves sat there: over=' + last.over + ' lost=' + last.lost);

  /* 3. a rocket that is the swapped tile of a four fires, rather than
     being stamped over by the new rocket */
  const four = await run(`
    __level({ n: 9003, w: 6, h: 6, types: 5, moves: 20, base: 999999, goals: [[GK.SCORE, 0, 999999]] });
    __paint();
    const B = G.B;
    B.cell[2][0].tile.type = 0; B.cell[2][1].tile.type = 0; B.cell[2][2].tile.type = 1; B.cell[2][3].tile.type = 0;
    B.cell[3][2].tile.type = 0; B.cell[3][2].tile.sp = SP.COL;
    const ids = [0, 1, 4, 5].map(r => B.cell[r][2].tile.id);
    const fired = [];
    const real = specialKeys;
    specialKeys = function (B2, r, c, sp, t) { fired.push(sp); return real(B2, r, c, sp, t); };
    await tryMove([3, 2], [2, 2]);
    specialKeys = real;
    const left = [0, 1, 4, 5].filter(r => B.cell[r][2].tile && ids.includes(B.cell[r][2].tile.id)).length;
    return { fired, left };
  `);
  check(four.fired.includes(1) || four.fired.includes(2),
    'a rocket swapped into a four fires',
    'the rocket in the four never fired (specials fired: ' + JSON.stringify(four.fired) + ')');
  check(four.left === 0,
    'its column is cleared',
    four.left + ' of 4 tiles in the rocket\'s column untouched');

  /* 4. a hill chipped by the hammer can still be chipped by the next swap */
  const ham = await run(`
    __level({ n: 9004, w: 6, h: 6, types: 5, moves: 20, base: 999999, goals: [[GK.SCORE, 0, 999999]],
      map: ['......', '......', '..O...', '......', '......', '......'] });
    const hill = G.B.cell[2][2];
    hill.moleT = 99;
    __paint();
    const layers0 = hill.mole;
    await useHammer(2, 1);
    const layers1 = hill.mole;
    const m = __three(3, 1); await tryMove(m[0], m[1]);
    return { layers0, layers1, layers2: hill.mole };
  `);
  check(ham.layers0 === 3 && ham.layers1 === 2 && ham.layers2 === 1,
    'a hammer hit on a hill does not use up the next move\'s hit (3, 2, 1)',
    'hill layers went ' + [ham.layers0, ham.layers1, ham.layers2].join(', ') + ', expected 3, 2, 1');

  /* 5. the bramble goal asks for the patch, which is what winning takes */
  const bram = await run(`
    let levels = 0, wrong = [];
    for (let n = 1; n <= 400; n++) {
      const def = __levelDef(n);
      const g = def.goals.find(x => x[0] === GK.BRAMBLE);
      if (!g) continue;
      levels++;
      const onBoard = brambleCount(makeBoard(def, n * 104729));
      if (g[2] !== onBoard) wrong.push(n + ': ' + g[2] + ' asked, ' + onBoard + ' on the board');
    }
    return { levels, wrong };
  `);
  check(bram.levels > 0 && bram.wrong.length === 0,
    'every bramble goal in 1-400 asks for the whole patch (' + bram.levels + ' levels)',
    bram.wrong.length + ' of ' + bram.levels + ' bramble goals differ from the patch: ' + bram.wrong.slice(0, 5).join('; '));

  console.log('the rules, through the real game:');
  ok.forEach(s => console.log('  ok   ' + s));
  problems.forEach(s => console.log('  BAD  ' + s));
  console.log(problems.length ? '\n' + problems.length + ' problem(s)' : '\nthe rules hold');
  process.exitCode = problems.length ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
