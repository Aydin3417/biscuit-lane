/* The real 40-game.js, loaded in Node with the document stubbed out.

   Every other headless harness in this directory resolves moves in a
   copy of the engine, and a copy is how the molehill goal shipped
   broken: the solver's blast counter had a `mole` field, the game's did
   not, and every test said level 76 was fine while nobody could win it.
   test/game-rules.js and test/all-levels.js play the game's own file
   instead, and they need the same stubs to do it — so the stubs live
   here once rather than drifting apart in two files.

   loadGame() returns the vm context with the game in it, FAST_FORWARD
   on so every wait() in a cascade resolves at once, the render loop
   and layout disabled, and EV.emit replaced by a recorder
   (globalThis.__events). Math is a copy rather than the host object,
   so a harness can seed Math.random inside the game without touching
   Node's own. */
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

function loadGame() {
  const M = {};
  Object.getOwnPropertyNames(Math).forEach(k => { M[k] = Math[k]; });
  const ctx = {
    console, SP: { NONE: 0, ROW: 1, COL: 2, BOMB: 3, RAIN: 4 },
    document: { createElement: el, querySelector: el, querySelectorAll: () => [], addEventListener: noop, body: el() },
    window: { matchMedia: () => ({ matches: false }), devicePixelRatio: 1, addEventListener: noop },
    performance: { now: () => Date.now() }, navigator: { language: 'en' },
    requestAnimationFrame: fn => setTimeout(fn, 0), setTimeout, clearTimeout,
    Math: M, Date, JSON, Promise, Set, Map, Array,
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop }
  };
  vm.createContext(ctx);
  require('./_modules.js').CORE.forEach(f =>
    vm.runInContext(read(f).replace(/^'use strict';?$/m, ''), ctx, { filename: f }));
  for (const k in stubs) vm.runInContext(`if (typeof ${k} === 'undefined') globalThis.${k} = ${stubs[k]};`, ctx);
  vm.runInContext('globalThis.__events = []; EV.emit = function (e) { globalThis.__events.push(e); };', ctx);
  vm.runInContext(read('40-game.js'), ctx, { filename: '40-game.js' });
  vm.runInContext('gameLoopStart = () => {}; layoutBoard = () => {}; FAST_FORWARD = true;', ctx);
  const run = src => vm.runInContext('(async () => {' + src + '})()', ctx);
  return { ctx, run, vm };
}

module.exports = { loadGame };
