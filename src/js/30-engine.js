/* ============================================================
   30 — match-3 engine. Pure board logic; no drawing here.
   ============================================================ */
const PUP = -1;
let tileSeq = 1;

function mkTile(type, sp) {
  return {
    id: tileSeq++, type, sp: sp || SP.NONE,
    x: 0, y: 0, tx: 0, ty: 0,
    scale: 1, alpha: 1, rot: 0,
    dying: 0, born: 0, vy: 0, fallFrom: null,
    jiggle: 0
  };
}

function makeBoard(def, seed) {
  const rng = mulberry(seed || (def.n * 104729 + 17));
  const B = {
    w: def.w, h: def.h, types: def.types, def,
    cell: [], rng, exits: []
  };
  for (let r = 0; r < def.h; r++) {
    const row = [];
    for (let c = 0; c < def.w; c++) {
      row.push({ hole: false, crate: 0, mud: 0, ice: 0, bram: 0, mole: 0, moleT: 0, tile: null, r, c });
    }
    B.cell.push(row);
  }
  if (def.map) {
    for (let r = 0; r < def.h && r < def.map.length; r++) {
      const line = def.map[r];
      for (let c = 0; c < def.w && c < line.length; c++) {
        const ch = line[c], cell = B.cell[r][c];
        if (ch === '#') cell.hole = true;
        else if (ch === 'c') cell.crate = 1;
        else if (ch === 'C') cell.crate = 2;
        else if (ch === 'm') cell.mud = 1;
        else if (ch === 'M') cell.mud = 2;
        else if (ch === 'i') cell.ice = 1;
        else if (ch === 'v') cell.bram = 1;
        /* a molehill: o is one layer of earth over it, O is two */
        else if (ch === 'o') { cell.mole = 2; cell.moleT = MOLE_EVERY; }
        else if (ch === 'O') { cell.mole = 3; cell.moleT = MOLE_EVERY; }
      }
    }
  }
  /* bottom exit of each column, for walking pups home */
  for (let c = 0; c < B.w; c++) {
    let e = -1;
    for (let r = B.h - 1; r >= 0; r--) {
      const cell = B.cell[r][c];
      if (!cell.hole && cell.crate === 0) { e = r; break; }
    }
    B.exits.push(e);
  }
  /* a patch may creep back to a little over the size it started, and no
     further — otherwise a couple of unlucky moves bury the whole board */
  B.bramStart = 0;
  eachCell(B, cell => { if (cell.bram > 0) B.bramStart++; });
  fillBoard(B);
  return B;
}

function openCell(B, r, c) {
  if (r < 0 || c < 0 || r >= B.h || c >= B.w) return null;
  const cell = B.cell[r][c];
  return (cell.hole || cell.crate > 0 || cell.mole > 0) ? null : cell;
}
function tileAt(B, r, c) {
  const cell = openCell(B, r, c);
  return cell ? cell.tile : null;
}
function eachCell(B, fn) {
  for (let r = 0; r < B.h; r++) for (let c = 0; c < B.w; c++) fn(B.cell[r][c], r, c);
}

function fillBoard(B) {
  eachCell(B, (cell, r, c) => {
    if (cell.hole || cell.crate > 0 || cell.mole > 0) return;
    let t, guard = 0;
    do {
      t = Math.floor(B.rng() * B.types);
      guard++;
    } while (guard < 40 && wouldMatch(B, r, c, t));
    cell.tile = mkTile(t);
    cell.tile.x = c; cell.tile.y = r; cell.tile.tx = c; cell.tile.ty = r;
  });
  let guard = 0;
  while (!hasMove(B) && guard++ < 40) shuffleTypes(B);
}
function wouldMatch(B, r, c, t) {
  const g = (rr2, cc) => { const cell = openCell(B, rr2, cc); return cell && cell.tile ? cell.tile.type : -9; };
  if (g(r, c - 1) === t && g(r, c - 2) === t) return true;
  if (g(r - 1, c) === t && g(r - 2, c) === t) return true;
  return false;
}
function shuffleTypes(B) {
  const list = [];
  eachCell(B, cell => { if (cell.tile && cell.tile.type >= 0 && cell.tile.sp === SP.NONE) list.push(cell.tile); });
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(B.rng() * (i + 1));
    const t = list[i].type; list[i].type = list[j].type; list[j].type = t;
  }
  /* clear accidental matches */
  let guard = 0;
  while (findMatches(B).length && guard++ < 60) {
    findMatches(B).forEach(g => {
      const cell = B.cell[g.cells[0][0]][g.cells[0][1]];
      if (cell.tile && cell.tile.type >= 0) cell.tile.type = (cell.tile.type + 1 + Math.floor(B.rng() * (B.types - 1))) % B.types;
    });
  }
}

/* ---------------- match finding ---------------- */
function findMatches(B) {
  const runs = [];
  /* horizontal */
  for (let r = 0; r < B.h; r++) {
    let c = 0;
    while (c < B.w) {
      const t0 = tileAt(B, r, c);
      if (!t0 || t0.type < 0) { c++; continue; }
      let k = c + 1;
      while (k < B.w) {
        const t = tileAt(B, r, k);
        if (!t || t.type !== t0.type) break;
        k++;
      }
      if (k - c >= 3) {
        const cells = [];
        for (let i = c; i < k; i++) cells.push([r, i]);
        runs.push({ cells, dir: 'h', type: t0.type, len: k - c });
      }
      c = Math.max(k, c + 1);
    }
  }
  /* vertical */
  for (let c = 0; c < B.w; c++) {
    let r = 0;
    while (r < B.h) {
      const t0 = tileAt(B, r, c);
      if (!t0 || t0.type < 0) { r++; continue; }
      let k = r + 1;
      while (k < B.h) {
        const t = tileAt(B, k, c);
        if (!t || t.type !== t0.type) break;
        k++;
      }
      if (k - r >= 3) {
        const cells = [];
        for (let i = r; i < k; i++) cells.push([i, c]);
        runs.push({ cells, dir: 'v', type: t0.type, len: k - r });
      }
      r = Math.max(k, r + 1);
    }
  }
  if (!runs.length) return [];

  /* merge runs that share a cell */
  const owner = new Map();
  const groups = [];
  runs.forEach(run => {
    let g = null;
    run.cells.forEach(([r, c]) => {
      const o = owner.get(r + ':' + c);
      if (o !== undefined && (g === null || o < g)) g = o;
    });
    if (g === null) {
      g = groups.length;
      groups.push({ cells: [], type: run.type, maxH: 0, maxV: 0, keys: new Set() });
    }
    const G = groups[g];
    if (run.dir === 'h') G.maxH = Math.max(G.maxH, run.len);
    else G.maxV = Math.max(G.maxV, run.len);
    run.cells.forEach(([r, c]) => {
      const key = r + ':' + c;
      if (!G.keys.has(key)) { G.keys.add(key); G.cells.push([r, c]); }
      owner.set(key, g);
    });
  });
  /* second pass merges chains that only linked transitively */
  const merged = [];
  const seen = new Set();
  groups.forEach((G, i) => {
    if (seen.has(i)) return;
    let acc = G;
    for (let j = i + 1; j < groups.length; j++) {
      if (seen.has(j)) continue;
      const H = groups[j];
      if (H.type !== acc.type) continue;
      let touch = false;
      for (const k of H.keys) if (acc.keys.has(k)) { touch = true; break; }
      if (touch) {
        seen.add(j);
        acc = {
          cells: acc.cells.concat(H.cells.filter(([r, c]) => !acc.keys.has(r + ':' + c))),
          type: acc.type,
          maxH: Math.max(acc.maxH, H.maxH),
          maxV: Math.max(acc.maxV, H.maxV),
          keys: new Set([...acc.keys, ...H.keys])
        };
      }
    }
    merged.push(acc);
  });
  return merged;
}

function specialFor(group) {
  if (group.maxH >= 5 || group.maxV >= 5) return SP.RAIN;
  if (group.maxH >= 3 && group.maxV >= 3) return SP.BOMB;
  if (group.maxH === 4) return SP.ROW;
  if (group.maxV === 4) return SP.COL;
  return SP.NONE;
}

/* ---------------- move detection ---------------- */
function canSwap(B, a, b) {
  const ca = openCell(B, a[0], a[1]), cb = openCell(B, b[0], b[1]);
  if (!ca || !cb || !ca.tile || !cb.tile) return false;
  if (ca.ice > 0 || cb.ice > 0) return false;
  if (ca.tile.type === PUP || cb.tile.type === PUP) return false;
  return true;
}
function swapTiles(B, a, b) {
  const ca = B.cell[a[0]][a[1]], cb = B.cell[b[0]][b[1]];
  const t = ca.tile; ca.tile = cb.tile; cb.tile = t;
}
function swapMakesMatch(B, a, b) {
  const ca = B.cell[a[0]][a[1]], cb = B.cell[b[0]][b[1]];
  if (ca.tile.sp === SP.RAIN || cb.tile.sp === SP.RAIN) return true;
  if (ca.tile.sp !== SP.NONE && cb.tile.sp !== SP.NONE) return true;
  swapTiles(B, a, b);
  const m = findMatches(B).length > 0;
  swapTiles(B, a, b);
  return m;
}
function allMoves(B) {
  const out = [];
  for (let r = 0; r < B.h; r++) {
    for (let c = 0; c < B.w; c++) {
      [[r, c + 1], [r + 1, c]].forEach(n => {
        if (canSwap(B, [r, c], n) && swapMakesMatch(B, [r, c], n)) out.push([[r, c], n]);
      });
    }
  }
  return out;
}
function hasMove(B) {
  for (let r = 0; r < B.h; r++) {
    for (let c = 0; c < B.w; c++) {
      const n1 = [r, c + 1], n2 = [r + 1, c];
      if (canSwap(B, [r, c], n1) && swapMakesMatch(B, [r, c], n1)) return true;
      if (canSwap(B, [r, c], n2) && swapMakesMatch(B, [r, c], n2)) return true;
    }
  }
  return false;
}

/* ---------------- gravity ---------------- */
/* Returns a list of {tile, fromR, fromC, toR, toC, spawn} describing what moved. */
function settle(B) {
  const moves = [];
  let changed = true, guard = 0;
  while (changed && guard++ < 40) {
    changed = false;
    /* 1. straight down */
    for (let c = 0; c < B.w; c++) {
      let write = B.h - 1;
      for (let r = B.h - 1; r >= 0; r--) {
        const cell = B.cell[r][c];
        if (cell.hole || cell.crate > 0 || cell.mole > 0 || cell.ice > 0) { write = r - 1; continue; }
        if (cell.tile) {
          if (write !== r && write >= 0) {
            const dst = B.cell[write][c];
            dst.tile = cell.tile; cell.tile = null;
            moves.push({ tile: dst.tile, fromR: r, fromC: c, toR: write, toC: c });
            changed = true;
          }
          write--;
        }
      }
    }
    /* 2. slide diagonally past blockers */
    for (let r = B.h - 1; r >= 1; r--) {
      for (let c = 0; c < B.w; c++) {
        const cell = openCell(B, r, c);
        if (!cell || cell.tile || cell.ice > 0) continue;
        const above = B.cell[r - 1][c];
        if (!above.hole && above.crate === 0 && above.mole === 0 && above.ice === 0 && above.tile) continue;
        for (const dc of (B.rng() < .5 ? [-1, 1] : [1, -1])) {
          const src = openCell(B, r - 1, c + dc);
          if (src && src.tile && src.ice === 0) {
            cell.tile = src.tile; src.tile = null;
            moves.push({ tile: cell.tile, fromR: r - 1, fromC: c + dc, toR: r, toC: c });
            changed = true;
            break;
          }
        }
      }
    }
    /* 3. spawn at the top of each column */
    for (let c = 0; c < B.w; c++) {
      let top = -1;
      for (let r = 0; r < B.h; r++) {
        const cell = B.cell[r][c];
        if (cell.hole || cell.crate > 0 || cell.mole > 0) continue;
        top = r; break;
      }
      if (top < 0) continue;
      const cell = B.cell[top][c];
      if (cell.tile || cell.ice > 0) continue;
      const t = mkTile(nextSpawnType(B));
      cell.tile = t;
      t.x = c; t.y = top - 1.15;
      moves.push({ tile: t, fromR: top - 1.15, fromC: c, toR: top, toC: c, spawn: true });
      changed = true;
    }
  }
  /* 4. anything still empty and unreachable simply appears */
  eachCell(B, (cell, r, c) => {
    if (cell.hole || cell.crate > 0 || cell.mole > 0 || cell.tile) return;
    const t = mkTile(nextSpawnType(B));
    t.x = c; t.y = r; t.scale = 0;
    cell.tile = t;
    moves.push({ tile: t, fromR: r, fromC: c, toR: r, toC: c, materialise: true });
  });
  return moves;
}
function nextSpawnType(B) {
  if (B.pupQueue > 0) { B.pupQueue--; return PUP; }
  return Math.floor(B.rng() * B.types);
}
/* One bramble creeps into a neighbouring cell. Called when the player
   went a whole move without cutting any: keep up and the patch holds
   still, fall behind and it takes more ground. Returns the cell taken. */
function spreadBramble(B) {
  const seeds = [], open = [];
  eachCell(B, (cell, r, c) => {
    if (cell.hole || cell.crate > 0) return;
    open.push(cell);
    if (cell.bram > 0) seeds.push([r, c]);
  });
  if (!seeds.length) return null;
  const covered = seeds.length;
  const cap = Math.min(Math.floor(open.length * BRAMBLE_CAP), (B.bramStart || 0) + 4);
  if (covered >= cap) return null;
  /* try a few seeds so a boxed-in one does not stall the spread */
  for (let i = 0; i < 12; i++) {
    const [r, c] = seeds[Math.floor(B.rng() * seeds.length)];
    const near = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
      .map(([a, b]) => openCell(B, a, b))
      .filter(x => x && x.bram === 0);
    if (near.length) {
      const cell = near[Math.floor(B.rng() * near.length)];
      cell.bram = 1;
      return [cell.r, cell.c];
    }
  }
  return null;
}
/* The molehill.

   Every other blocker in this game is patient. A crate waits, mud waits,
   ice waits; a bramble spreads, but it spreads slowly and everywhere at
   once, so it never asks the player to care about one square in
   particular.

   This one does. It counts down in plain sight, and at zero it pushes up
   a patch of earth on a neighbour and starts again. That is the decision
   it adds: carry on with the goal, or spend two moves now shutting the
   thing up. Nothing else on this board makes the player choose a place
   rather than a match.

   It is closed the way a crate is broken — by clearing a tile next to it
   — because a mechanic that needs a new verb is a mechanic that needs a
   tutorial nobody reads. */
/* Five moves, not four.

   At four the mechanic was on a knife edge: three self-healing hills
   need two hits each inside their own window, three times over, and at
   the budget the model chose that came to eighteen moves. Levels
   identical in size, tile count, hill count and budget then measured
   anywhere from 25% to 91% cleared, decided by nothing but where the
   three hills happened to land.

   That is not difficulty, it is a coin. One more move in the cycle is
   what turns the same idea into something a player can plan around and
   a budget can steer. */
const MOLE_EVERY = 5, MOLE_MAX = 3;

/* One layer a move, however big the match.

   A hill damaged per cleared cell is a hill that a single four-in-a-row
   beside it removes outright, which measured at a hundred percent
   cleared and made the countdown decoration. Capping it to one layer per
   move is what turns it into the thing it was built to be: something you
   have to come back to, on purpose, several moves running, while the
   clock on it runs.

   The cap is keyed on the board rather than on the cell so that a
   cascade — which is one move, resolved in several waves — cannot chip
   the same hill four times on the way down. */
function moleHit(B, cell) {
  if (!cell || cell.mole <= 0) return false;
  if (!B.moleHitThisMove) B.moleHitThisMove = new Set();
  const key = cell.r + ':' + cell.c;
  if (B.moleHitThisMove.has(key)) return false;
  B.moleHitThisMove.add(key);
  cell.mole--;
  return true;
}

function moleCount(B) {
  let n = 0;
  for (let r = 0; r < B.h; r++) for (let c = 0; c < B.w; c++) if (B.cell[r][c].mole > 0) n++;
  return n;
}

/* One tick for every hill still open. Returns the cells that threw up
   earth, so the caller can animate and announce them. */
function moleTick(B) {
  const pushed = [];
  B.moleHitThisMove = null;      /* a new move: every hill can be hit again */
  for (let r = 0; r < B.h; r++) {
    for (let c = 0; c < B.w; c++) {
      const cell = B.cell[r][c];
      if (cell.mole <= 0) continue;
      if (--cell.moleT > 0) continue;
      cell.moleT = MOLE_EVERY;
      /* Earth goes onto a neighbour that has none. A hill that piled the
         same square higher and higher would be a countdown the player
         could safely ignore after the first one. */
      const around = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .map(rc => B.cell[rc[0]] && B.cell[rc[0]][rc[1]])
        .filter(x => x && !x.hole && x.crate === 0 && x.mole === 0 && x.ice === 0);
      const clean = around.filter(x => x.mud === 0);
      const pool = clean.length ? clean : around.filter(x => x.mud < 2);
      if (!pool.length) continue;
      const pick = pool[Math.floor(B.rng() * pool.length)];
      pick.mud = Math.min(2, pick.mud + 1);
      /* And it digs itself back in.

         Without this the hill closed as a side effect of ordinary play:
         adjacent clears happen constantly on a full board, so three of
         them measured at a hundred percent cleared with a third of the
         moves spare. A blocker that deals with itself is not a decision,
         and the decision was the entire reason for building it.

         Now it is a race. Land the clears inside the countdown and the
         hill is gone; miss it and you are further back than when you
         started. Which is what makes a player stop and choose a square. */
      cell.mole = Math.min(MOLE_MAX, cell.mole + 1);
      pushed.push([pick.r, pick.c]);
    }
  }
  return pushed;
}

function brambleCount(B) {
  let n = 0;
  eachCell(B, cell => { if (cell.bram > 0) n++; });
  return n;
}

function commonType(B) {
  const count = new Array(B.types).fill(0);
  eachCell(B, cell => { if (cell.tile && cell.tile.type >= 0) count[cell.tile.type]++; });
  let best = 0;
  for (let i = 1; i < B.types; i++) if (count[i] > count[best]) best = i;
  return best;
}
function tilesOfType(B, type) {
  const out = [];
  eachCell(B, (cell, r, c) => { if (cell.tile && cell.tile.type === type) out.push([r, c]); });
  return out;
}
