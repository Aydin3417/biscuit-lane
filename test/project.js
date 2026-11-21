/* The house project (52-project.js), rule by rule.

     a first clear pays one star, two on a hard level, three on a super-hard
     a save from before 1.4 counts what it already owns as jobs done, and
       is given stars for its cleared levels, at most ten
     a job without the stars for it changes nothing
     a job paid for spends exactly its stars, owns and places its thing
     the last job of a project moves the house to the next one
     every piece of furniture is a job exactly once; every paint a job names
       exists; no two jobs share an id; the shop is told which paints are
       the project's

     node test/project.js
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
/* the interface the project calls into, as quiet stand-ins */
vm.runInContext(`
  var __shown = [];
  function T(k) { return k; } function track() {}
  function toast() {} function renderHome() {} function roomCelebrate() {} function buzz() {}
  var SFX = { bad() {}, levelup() {}, win() {}, coin() {} };
  function projectDoneModal(p) { __shown.push(p.id); }
  function equipThing(id, kind) {
    if (kind === 'theme') { SAVE.room.theme = id; return; }
    const slot = roomThing(id).slot;
    SAVE.room.placed = SAVE.room.placed.filter(x => { const o = roomThing(x); return !o || o.slot !== slot || slot === 'wall'; });
    SAVE.room.placed.push(id);
  }
`, ctx);
const src = fs.readFileSync(path.join(jsDir, '52-project.js'), 'utf8')
  /* the done-card is the interface's to draw; this measures the rules */
  .replace(/function projectDoneModal\(p\) \{[\s\S]*?\n\}\n/, '');
vm.runInContext(src, ctx, { filename: '52-project.js' });
const X = vm.runInContext('({ PROJECTS, FURNITURE, ROOM_THEMES, starsForLevel, homeState, doTask, currentProject, projectProgress, addHomeStars, projectTheme, freshSave, tierOf, setSave: s => { SAVE = s; }, shown: () => __shown })', ctx);

let bad = 0;
const ok = (cond, name, got) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : '   got ' + JSON.stringify(got))); if (!cond) bad++; };
const fresh = () => { const s = X.freshSave(); s.pets = []; X.setSave(s); return s; };

const hardN = [17, 19, 27].find(n => X.tierOf(n) === 'hard'), superN = [20, 30].find(n => X.tierOf(n) === 'super');
ok(X.starsForLevel(3) === 1, 'an ordinary first clear pays one star', X.starsForLevel(3));
ok(X.starsForLevel(hardN) === 2, 'a hard level pays two (' + hardN + ')', X.starsForLevel(hardN));
ok(X.starsForLevel(superN) === 3, 'a super-hard level pays three (' + superN + ')', X.starsForLevel(superN));

let s = fresh();
s.furniture.rug = 1; s.roomThemes.blush = 1;
for (let i = 1; i <= 30; i++) s.stars[i] = 2;
const h = X.homeState();
ok(h.done['u-rug'] && h.done['u-paint'], 'a save from before 1.4 counts what it owns as jobs done', h.done);
ok(h.stars === 10, 'and starts with its cleared levels in stars, at most ten', h.stars);

s = fresh(); X.homeState().stars = 0;
const before = JSON.stringify(s.room);
ok(X.doTask('u-plant') === false && JSON.stringify(s.room) === before && !s.furniture.plant, 'a job without the stars changes nothing', s.room);

s = fresh(); X.homeState().stars = 5;
ok(X.doTask('u-bed') === true, 'a job paid for is done', s.home);
ok(s.home.stars === 3, 'it spends exactly its two stars', s.home.stars);
ok(s.furniture.petbed && s.room.placed.indexOf('petbed') >= 0, 'and owns and places what it gives', s.room.placed);
ok(X.doTask('u-bed') === false && s.home.stars === 3, 'a job is done once', s.home.stars);

s = fresh();
X.homeState().stars = 999;
const first = X.PROJECTS[0];
first.tasks.forEach(t => X.doTask(t.id));
ok(X.shown().indexOf(first.id) >= 0, 'the last job of a project finishes it', X.shown());
ok(X.currentProject() === X.PROJECTS[1], 'and the house moves on to the next', X.currentProject() && X.currentProject().id);
ok(s.room.theme === 'blush', 'a paint job paints the room', s.room.theme);

const given = {}; const ids = {};
let dupId = false;
X.PROJECTS.forEach(p => p.tasks.forEach(t => {
  if (ids[t.id]) dupId = true; ids[t.id] = 1;
  given[t.give[0] + ':' + t.give[1]] = (given[t.give[0] + ':' + t.give[1]] || 0) + 1;
}));
const missing = X.FURNITURE.filter(f => given['furniture:' + f.id] !== 1).map(f => f.id);
ok(missing.length === 0, 'every piece of furniture is a job exactly once', missing);
const ghostThemes = Object.keys(given).filter(k => k.startsWith('theme:') && !X.ROOM_THEMES.some(t => 'theme:' + t.id === k));
ok(ghostThemes.length === 0, 'every paint a job names exists', ghostThemes);
ok(!dupId, 'no two jobs share an id', ids);
ok(X.projectTheme('blush') && !X.projectTheme('sage'), 'the shop is told which paints are the project\'s', [X.projectTheme('blush'), X.projectTheme('sage')]);
const total = X.PROJECTS.reduce((a, p) => a + p.tasks.reduce((b, t) => b + t.cost, 0), 0);
console.log('  ' + X.PROJECTS.length + ' projects, ' + Object.keys(ids).length + ' jobs, ' + total + ' stars in all');

console.log(bad ? '\n' + bad + ' failed' : '\nthe house is done up a star at a time');
process.exit(bad ? 1 : 0);
