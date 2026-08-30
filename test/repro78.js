/* Reproduces the empty-cell report on a generated crate level.
   Plays L78 many times, checking board integrity after every single
   engine step rather than only after a whole move. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsDir = path.join(__dirname, '..', 'src', 'js');
const ctx = {
  console, SP: { NONE: 0, ROW: 1, COL: 2, BOMB: 3, RAIN: 4 },
  document: { createElement: () => ({ getContext: () => ({}) }) },
  window: { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 },
  performance: { now: () => Date.now() }, navigator: { language: 'en' },
  requestAnimationFrame: () => 0, setTimeout, clearTimeout, Math, Date, JSON
};
vm.createContext(ctx);
require('./_modules.js').CORE.forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(jsDir, f), 'utf8').replace(/^'use strict';?$/m, ''), ctx, { filename: f }));
const E = vm.runInContext(
  '({ makeBoard, findMatches, specialFor, settle, hasMove, allMoves, swapTiles,' +
  '   openCell, eachCell, levelDef, tilesOfType, commonType, shuffleTypes, GK, PUP, SP })', ctx);
const { makeBoard, findMatches, specialFor, settle, hasMove, allMoves, swapTiles,
  openCell, eachCell, levelDef, tilesOfType, commonType, shuffleTypes, GK, PUP, SP } = E;

function emptyOpen(B) {
  const out = [];
  eachCell(B, (cell, r, c) => {
    if (cell.hole || cell.crate > 0) return;
    if (!cell.tile) out.push([r, c]);
  });
  return out;
}
function hitCell(B, r, c, out, touched) {
  const cell = B.cell[r] && B.cell[r][c];
  if (!cell || cell.hole) return;
  const k = r + ':' + c; if (touched.has(k)) return; touched.add(k);
  if (cell.crate > 0) { cell.crate--; return; }
  if (cell.ice > 0) { cell.ice--; return; }
  const t = cell.tile; if (!t || t.type === PUP) return;
  if (t.sp !== SP.NONE) out.chain.push({ r, c, sp: t.sp, type: t.type });
  cell.tile = null;
  if (cell.mud > 0) cell.mud--;
  if (cell.bram > 0) cell.bram--;
  [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([a, b]) => {
    const n = B.cell[a] && B.cell[a][b];
    if (n && n.crate > 0) n.crate--;
  });
}
function specialKeys(B, r, c, sp, type) {
  const keys = [];
  if (sp === SP.ROW) for (let i = 0; i < B.w; i++) keys.push(r + ':' + i);
  else if (sp === SP.COL) for (let i = 0; i < B.h; i++) keys.push(i + ':' + c);
  else if (sp === SP.BOMB) { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) keys.push((r + dr) + ':' + (c + dc)); }
  else if (sp === SP.RAIN) { const tt = type < 0 ? commonType(B) : type; tilesOfType(B, tt).forEach(([a, b]) => keys.push(a + ':' + b)); }
  return keys;
}

const level = +(process.argv[2] || 78);
const runs = +(process.argv[3] || 40);
let found = 0;

for (let run = 0; run < runs && found < 3; run++) {
  const def = levelDef(level);
  const B = makeBoard(def, level * 104729 + run * 7717);
  B.pupQueue = 0;
  let step = 0;
  const note = where => {
    const e = emptyOpen(B);
    if (e.length) {
      found++;
      console.log('run ' + run + ' step ' + step + ' — ' + where + ': empty at ' + JSON.stringify(e));
      e.forEach(([r, c]) => {
        const nb = [[r - 1, c, 'up'], [r + 1, c, 'down'], [r, c - 1, 'left'], [r, c + 1, 'right'],
        [r - 1, c - 1, 'up-left'], [r - 1, c + 1, 'up-right']];
        console.log('   cell ' + r + ',' + c + ' neighbours: ' + nb.map(([a, b, n]) => {
          const cl = B.cell[a] && B.cell[a][b];
          return n + '=' + (!cl ? 'off-board' : cl.hole ? 'hole' : cl.crate > 0 ? 'crate' : cl.tile ? 'tile' : 'EMPTY');
        }).join(', '));
      });
      return true;
    }
    return false;
  };

  let moves = def.moves;
  while (moves-- > 0) {
    if (!hasMove(B)) { let g = 0; do { shuffleTypes(B); } while (!hasMove(B) && g++ < 40); }
    const ms = allMoves(B);
    if (!ms.length) break;
    const m = ms[(Math.random() * ms.length) | 0];
    swapTiles(B, m[0], m[1]);
    step++;
    /* resolve, checking after each internal stage */
    let guard = 0;
    while (guard++ < 60) {
      const groups = findMatches(B);
      if (!groups.length) break;
      const keys = new Set(); const specials = [];
      groups.forEach(g => {
        const sp = specialFor(g);
        let at = null;
        if (sp !== SP.NONE) { at = g.cells[Math.floor(g.cells.length / 2)]; specials.push({ r: at[0], c: at[1], sp }); }
        g.cells.forEach(([r, c]) => { if (!(at && r === at[0] && c === at[1])) keys.add(r + ':' + c); });
      });
      let wave = Array.from(keys), w = 0;
      while (wave.length && w++ < 24) {
        const out = { chain: [] }; const touched = new Set();
        wave.forEach(k => { const [r, c] = k.split(':').map(Number); hitCell(B, r, c, out, touched); });
        const next = [];
        out.chain.forEach(sp2 => specialKeys(B, sp2.r, sp2.c, sp2.sp, sp2.type).forEach(k => next.push(k)));
        wave = next;
      }
      specials.forEach(s => { const cell = B.cell[s.r][s.c]; if (cell.tile) cell.tile.sp = s.sp; });
      settle(B);
      if (note('after settle inside the cascade')) break;
    }
    if (note('after the move resolved')) break;
  }
}
console.log(found ? found + ' reproductions on level ' + level : 'no empty cells across ' + runs + ' runs of level ' + level);
