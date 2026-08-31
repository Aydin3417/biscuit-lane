/* ============================================================
   40 — the level: rendering, input, cascades, abilities
   ============================================================ */
const G = {
  B: null, def: null, n: 1,
  moves: 0, score: 0, goals: [],
  busy: true, over: false, running: false,
  sel: null, pointer: null,
  charge: 0, scoreMul: 1, spending: false,
  chain: 0, bestChain: 0,
  particles: [], floats: [], beams: [], rings: [],
  cell: 40, ox: 0, oy: 0, boardW: 0, boardH: 0,
  ctx: null, cw: 0, ch: 0,
  shake: 0, flash: 0,
  armed: null, armedFirst: null,
  hintT: 0, hint: null,
  rescued: 0, pupsWanted: 0,
  petMood: 'idle', petMoodT: 0, blink: 0, blinkT: 1.5,
  compCtx: null, lastT: 0, raf: null,
  starTargets: [1, 2, 3], starsEarned: 0,
  usedExtra: false,
  cursor: null, keyMode: false,     /* keyboard play */
  creepTick: 0,
  epoch: 0                          /* bumped by every startLevel */
};

/* ---------------- geometry ---------------- */
/* Shared by layoutBoard and the self-heal check in renderGame — if the
   two ever disagreed the board would re-layout every frame and throw the
   sprite cache away with it. */
const BOARD_PAD = 14;
function boardCellFor(wrap, B) {
  if (!wrap || !B || wrap.clientWidth <= 0) return 0;
  return Math.max(22, Math.floor(Math.min(
    (wrap.clientWidth - 6 - BOARD_PAD * 2) / B.w,
    (wrap.clientHeight - 6 - BOARD_PAD * 2) / B.h)));
}
function layoutBoard() {
  const wrap = $('#boardWrap');
  const cv = $('#board');
  const availW = wrap.clientWidth - 6;
  const availH = wrap.clientHeight - 6;
  if (availW <= 0 || availH <= 0 || !G.B) return;
  const pad = BOARD_PAD;
  G.cell = boardCellFor(wrap, G.B);
  G.boardW = G.cell * G.B.w;
  G.boardH = G.cell * G.B.h;
  G.cw = G.boardW + pad * 2;
  G.ch = G.boardH + pad * 2;
  G.ox = pad; G.oy = pad;
  G.ctx = fitCanvas(cv, G.cw, G.ch);
  G.compCtx = fitCanvas($('#compCanvas'), 50, 50);
  clearSprites();
  drawLevelScene();
}
const cellX = c => G.ox + c * G.cell;
const cellY = r => G.oy + r * G.cell;

/* ---------------- tweening ---------------- */
function setTarget(t, tx, ty, dur, ease) {
  t.tw = { x0: t.x, y0: t.y, x1: tx, y1: ty, t: 0, dur: dur || .18, ease: ease || E.out };
  t.tx = tx; t.ty = ty;
}
/* Swell, then go.

   This was written inline as (1 + k * .5) * (1 - k), which is a curve
   that never rises above 1: the shrink term wins from the first frame,
   so a matched tile deflated rather than popped, and the most common
   event in the game had no moment in it. Anticipation is a third of the
   duration and most of the feeling. */
function popScale(k) {
  return Math.max(0, k < .3 ? 1 + (k / .3) * .26 : 1.26 * (1 - (k - .3) / .7));
}
/* it stays solid while it swells, and only fades on the way out */
function popAlpha(k) { return k < .52 ? 1 : Math.max(0, 1 - (k - .52) / .48); }

function stepTile(t, dt) {
  if (t.tw) {
    t.tw.t += dt;
    const k = clamp(t.tw.t / t.tw.dur, 0, 1);
    const e = t.tw.ease(k);
    t.x = lerp(t.tw.x0, t.tw.x1, e);
    t.y = lerp(t.tw.y0, t.tw.y1, e);
    if (k >= 1) {
      t.x = t.tw.x1; t.y = t.tw.y1;
      if (t.tw.land) {
        const force = t.tw.force || .4;
        t.jiggle = .35 + force * .45;
        FX.landPuff(G.ox + t.x * G.cell + G.cell / 2, G.oy + t.y * G.cell + G.cell / 2, G.cell, force);
        SFX.land(force, G.B ? (t.x / Math.max(1, G.B.w - 1)) * 1.6 - .8 : 0);
      }
      t.tw = null;
    }
  }
  /* a board full of faces should blink at you now and then */
  if (t.blinkAt === undefined) t.blinkAt = rnd(1.5, 14);
  if (t.blinkT > 0) {
    t.blinkT -= dt;
  } else {
    t.blinkAt -= dt;
    if (t.blinkAt <= 0) { t.blinkT = .12; t.blinkAt = rnd(5, 18); }
  }
  if (t.jiggle > 0) t.jiggle = Math.max(0, t.jiggle - dt * 3.4);
  if (t.dying > 0) t.dying = Math.min(1, t.dying + dt * 4.6);
  if (t.scale < 1 && !t.dying) t.scale = Math.min(1, t.scale + dt * 5);
}

/* ---------------- fx ---------------- */
/* where a cell is on screen, and how far left/right it sits — the
   sound engine pans by that so a clear on the left is heard left */
function cellFX(r, c) {
  return [
    cellX(c) + G.cell / 2,
    cellY(r) + G.cell / 2,
    G.B ? (c / Math.max(1, G.B.w - 1)) * 1.6 - .8 : 0
  ];
}
const boardFloor = () => G.oy + G.boardH - G.cell * .15;

function burst(r, c, col, n, power) {
  const [x, y] = cellFX(r, c);
  FX.pop(x, y, col, G.cell, {
    n: Math.round((n || 8) * .85),
    force: power || 1,
    floor: boardFloor(),
    shake: .03 * (power || 1)
  });
}
function ring(r, c, col) {
  G.rings.push({ x: cellX(c) + G.cell / 2, y: cellY(r) + G.cell / 2, life: 0, max: .42, col });
}
/* grid-addressed wrapper over the physics layer's floating text */
function cellFloat(r, c, text, col, size) {
  const [x, y] = cellFX(r, c);
  FX.text(x, y, text, { col: col || PAL.text, size: size || 15 });
}
function beam(r, c, dir) { G.beams.push({ r, c, dir, life: 0, max: .34 }); }

/* A cascade that outlives its level must not touch the next one. Every
   async step captures the epoch it started under and bails out if the
   board has been replaced since. */
function levelEpoch() { return G.epoch; }
function stale(ep) { return G.epoch !== ep; }

/* ---------------- level start ---------------- */
function startLevel(n, opts) {
  opts = opts || {};
  /* you cannot take a sleeping animal down the lane: it would be losing
     energy to the level and gaining it to the nap at the same time */
  const walker = activePet();
  if (walker && walker.asleep) walker.asleep = false;
  G.spending = false;      /* nothing is mid-ability on a fresh board */
  G.n = n;
  G.epoch++;                          /* anything still running belongs to the old board */
  G.def = levelDef(n);
  G.B = makeBoard(G.def, n * 104729 + (opts.reseed || 0));
  G.B.pupQueue = 0;
  const pet = activePet();
  const perks = opts.perks || [];
  let moves = G.def.moves;
  G.scoreMul = 1;
  G.charge = 0;
  perks.forEach(p => {
    if (p.id === 'moves' || p.id === 'bondmoves' || p.id === 'trait') moves += p.v;
    if (p.id === 'charge') G.charge = p.v;
    if (p.id === 'score') G.scoreMul += p.v;
  });
  if (opts.extraMoves) moves += opts.extraMoves;
  G.moves = moves;
  G.score = 0;
  G.chain = 0; G.bestChain = 0; G.bestShown = false;
  G.over = false; G.busy = true;
  G.sel = null; G.armed = null; G.armedFirst = null;
  G.particles = []; G.floats = []; G.beams = []; G.rings = [];
  G.rescued = 0; G.usedExtra = false; G.creepTick = 0; G.lastPraise = 0;
  G.starTargets = starTargets(G.def);
  G.starsEarned = 0;
  /* -1 rather than 0, so the first sync of a level always paints the
     lane once — a level that starts with a goal already partly met
     would otherwise show an unwalked path */
  G.walkStep = -1;
  G.goals = G.def.goals.map(g => ({ kind: g[0], arg: g[1], need: g[2], have: 0 }));
  G.goals.forEach(g => {
    if (g.kind === GK.BRAMBLE) g.have = clamp(g.need - brambleCount(G.B), 0, g.need);
  });
  const rescueGoal = G.goals.find(g => g.kind === GK.RESCUE);
  G.pupsWanted = rescueGoal ? rescueGoal.need : 0;

  /* seed the board with the pups that need walking home */
  if (G.pupsWanted) {
    /* a couple more baskets than the goal asks for: with exactly as many
       as you need, one landing in a slow column loses the level outright */
    const onBoard = Math.min(PUPS_IN_PLAY, G.pupsWanted + 2);
    for (let i = 0; i < onBoard; i++) placePup(G.B);
  }
  /* an energetic pet leaves a rocket lying about */
  if (perks.some(p => p.id === 'gift')) {
    const spots = [];
    eachCell(G.B, (cell, r, c) => { if (cell.tile && cell.tile.type >= 0 && cell.ice === 0) spots.push([r, c]); });
    if (spots.length) {
      const [r, c] = pick(spots);
      G.B.cell[r][c].tile.sp = Math.random() < .5 ? SP.ROW : SP.COL;
    }
  }
  buildGoalChips();
  /* Built here rather than by the caller. Four separate places started a
     level and each had to remember to build the star track afterwards;
     any route that forgot showed an empty bar with no marks on it, and
     the marks are the only thing that says how far off two stars you
     are. A thing every caller must remember is a thing that breaks. */
  buildStarTrack();
  buildBoosterBar();
  syncHud();
  layoutBoard();
  /* deal the board in: each column starts a little higher than the
     last, and falls under the same gravity, so it lands as a run */
  const dealBase = G.B.h + 1.2;
  eachCell(G.B, (cell, r, c) => {
    if (!cell.tile) return;
    const h0 = dealBase + c * .95;
    cell.tile.x = c;
    cell.tile.y = r - h0;
    cell.tile.scale = 1;
    setTarget(cell.tile, c, r, .30 * Math.sqrt(h0 / dealBase), E.drop);
    cell.tile.tw.land = true;
    cell.tile.tw.force = .45;
  });
  gameLoopStart();
  setTimeout(() => { G.busy = false; G.hintT = 0; }, 700);
  SAVE.stats.played++;
  persist();
}
/* Baskets start in the upper middle rather than the very top row: from
   row 0 a basket needs the whole column to clear beneath it before it
   reaches the door, which measured at ~11 moves each. */
function placePup(B) {
  const spots = [];
  const from = Math.min(2, B.h - 1), to = Math.min(5, B.h);
  /* every candidate cell, not the first per column — taking the first
     lined all the baskets up along one row. Columns that already hold a
     basket are skipped so they arrive spread out rather than stacked. */
  const taken = new Set();
  for (let r = 0; r < B.h; r++) {
    for (let c = 0; c < B.w; c++) {
      const cell = B.cell[r][c];
      if (cell.tile && cell.tile.type === PUP) taken.add(c);
    }
  }
  for (let c = 0; c < B.w; c++) {
    if (taken.has(c)) continue;
    for (let r = from; r < to; r++) {
      const cell = openCell(B, r, c);
      if (cell && cell.tile && cell.tile.type >= 0 && cell.tile.sp === SP.NONE && cell.ice === 0) spots.push(cell);
    }
  }
  /* every column already busy: fall back to any free cell */
  if (!spots.length) {
    for (let c = 0; c < B.w; c++) for (let r = from; r < to; r++) {
      const cell = openCell(B, r, c);
      if (cell && cell.tile && cell.tile.type >= 0 && cell.tile.sp === SP.NONE && cell.ice === 0) spots.push(cell);
    }
  }
  if (!spots.length) return false;
  const cell = pick(spots);
  cell.tile.type = PUP;
  cell.tile.sp = SP.NONE;
  return true;
}

/* ---------------- hud ---------------- */
function buildGoalChips() {
  const box = $('#goalsBox');
  box.innerHTML = '';
  G.goals.forEach((g, i) => {
    const el = document.createElement('div');
    el.className = 'goal';
    el.dataset.i = i;
    const cv = document.createElement('canvas');
    const px = 26;
    fitCanvas(cv, px, px);
    el.appendChild(cv);
    const n = document.createElement('span');
    n.className = 'n num';
    el.appendChild(n);
    box.appendChild(el);
    g.el = el; g.cv = cv; g.n = n;
    el.setAttribute('role', 'status');
    paintGoalIcon(g);
  });
  syncGoals();
}
function paintGoalIcon(g) {
  const c = g.cv.getContext('2d');
  const px = 26;
  c.save();
  c.clearRect(0, 0, px * 3, px * 3);
  c.translate(px / 2, px / 2);
  if (g.kind === GK.COLLECT) { paintTile(c, g.arg, SP.NONE, px * .92, SAVE.settings.marks); }
  else if (g.kind === GK.CRATE) paintCrate(c, px * .86, 1);
  else if (g.kind === GK.MUD) { c.save(); c.scale(.9, .9); paintMud(c, px * .9, 1); c.restore(); }
  else if (g.kind === GK.BRAMBLE) { paintBramble(c, px * .92); paintBrambleOver(c, px * .92); }
  else if (g.kind === GK.RESCUE) paintPup(c, px * .95, 0);
  else if (g.kind === GK.SCORE) {
    c.fillStyle = PAL.accent;
    c.save(); c.scale(px / 24, px / 24); c.translate(-12, -12);
    const p = new Path2D('m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.9z');
    c.fill(p); c.restore();
  }
  c.restore();
}
function syncGoals(bumpIdx) {
  G.goals.forEach((g, i) => {
    if (g.kind === GK.SCORE) g.have = G.score;
    const left = Math.max(0, g.need - g.have);
    g.n.textContent = g.kind === GK.SCORE ? fmt(Math.min(g.have, g.need)) + '/' + fmt(g.need) : left;
    g.el.classList.toggle('done', left === 0);
    g.el.setAttribute('aria-label', (function () {
      const label = g.kind === GK.SCORE ? T('g_score')
        : g.kind === GK.COLLECT ? breedName(g.arg)
          : g.kind === GK.CRATE ? T('goal_crate', { n: g.need })
            : g.kind === GK.MUD ? T('goal_mud', { n: g.need })
              : g.kind === GK.MOLE ? T('goal_mole', { n: g.need })
              : g.kind === GK.BRAMBLE ? T('goal_bramble', { n: g.need })
                : T('goal_rescue', { n: g.need });
      const have = g.kind === GK.SCORE ? G.score : g.have;
      return T('a11y_goal_line', { label, have: fmt(Math.min(have, g.need)), need: fmt(g.need) });
    })());
    if (bumpIdx === i) { g.el.classList.remove('tick'); void g.el.offsetWidth; g.el.classList.add('tick'); }
  });
  /* The lane behind the board shows the walk as a line of paw prints,
     and a print is laid when the goals move. Repainting that scene is a
     full canvas of gradients and about two hundred shapes, so it is not
     something to do on every cascade tick — only when the walk has
     actually taken a step. Fourteen prints, so fourteen repaints in a
     whole level at worst. */
  const step = Math.round(sceneProgress() * 14);
  if (step !== G.walkStep) { G.walkStep = step; drawLevelScene(); }
}
function syncHud() {
  $('#movesN').textContent = G.moves;
  const mb = $('#movesBox');
  if (mb) mb.setAttribute('aria-label', G.moves + ' ' + T('g_moves'));
  const sb = $('#scoreN');
  if (sb) sb.setAttribute('aria-label', T('g_score') + ' ' + fmt(G.score));
  $('#movesLbl').textContent = T('g_moves');
  $('#scoreLbl').textContent = T('g_score');
  $('#movesBox').classList.toggle('low', G.moves <= 5);
  $('#scoreN').textContent = fmt(G.score);
  const pct = clamp(G.score / G.starTargets[2], 0, 1) * 100;
  $('#starFill').style.width = pct + '%';
  const pet = activePet();
  const ready = G.charge >= 100;
  $('#companion').classList.toggle('ready', ready && !G.over);
  $('#chargeBar').style.width = clamp(G.charge, 0, 100) + '%';
  $('#chargeLbl').innerHTML = ready
    ? '<b>' + T('g_charge_ready', { name: petDative(pet ? pet.name : '') }) + '</b>'
    : chargeHint(pet);
}
/* What to match, and never a tile the board does not deal. When the
   pet's own breed is not in play the line says so in the pet's name
   rather than silently naming somebody else's animal. */
function chargeHint(pet) {
  if (!pet) return T('g_charge_need', { breed: castName(0) });
  const fav = favType();
  return fav === pet.breed
    ? T('g_charge_need', { breed: castName(fav) })
    : T('g_charge_swap', { name: pet.name, breed: castName(fav) });
}
function buildStarTrack() {
  const tr = $('#starTrack');
  $$('s', tr).forEach(s => s.remove());
  G.starTargets.forEach((v, i) => {
    const s = document.createElement('s');
    s.style.left = clamp(v / G.starTargets[2], 0, 1) * 100 + '%';
    s.innerHTML = IC.starOut;
    s.style.color = 'var(--text-faint)';
    s.dataset.i = i;
    tr.appendChild(s);
  });
}
function syncStars() {
  let earned = 0;
  G.starTargets.forEach((v, i) => { if (G.score >= v) earned = i + 1; });
  $$('#starTrack s').forEach((s, i) => {
    const on = i < earned;
    if (on && s.dataset.on !== '1') {
      s.dataset.on = '1';
      s.innerHTML = IC.star;
      s.style.color = 'var(--accent)';
      SFX.star(i);
      buzz(HAP.star);
    }
  });
  G.starsEarned = earned;
}
function buildBoosterBar() {
  const box = $('#boosters');
  box.innerHTML = '';
  ['hammer', 'swap', 'shuffle'].forEach(id => {
    const b = BOOSTERS.find(x => x.id === id);
    const el = document.createElement('button');
    el.className = 'booster';
    el.dataset.id = id;
    el.innerHTML = IC[b.icon] + '<span class="ct num">' + (SAVE.boosters[id] || 0) + '</span>';
    el.disabled = !(SAVE.boosters[id] > 0);
    el.setAttribute('aria-label', goodName(b));
    el.addEventListener('click', () => armBooster(id));
    box.appendChild(el);
  });
}
function syncBoosterBar() {
  $$('#boosters .booster').forEach(el => {
    const id = el.dataset.id;
    $('.ct', el).textContent = SAVE.boosters[id] || 0;
    el.disabled = !(SAVE.boosters[id] > 0) && G.armed !== id;
    el.classList.toggle('armed', G.armed === id);
  });
}

/* ---------------- boosters ---------------- */
function armBooster(id) {
  if (G.busy || G.over) return;
  audioResume();
  if (G.armed === id) { G.armed = null; G.armedFirst = null; syncBoosterBar(); return; }
  if (!(SAVE.boosters[id] > 0)) return;
  if (id === 'shuffle') {
    SAVE.boosters[id]--; persist();
    syncBoosterBar();
    SFX.select();
    doShuffle();
    return;
  }
  G.armed = id; G.armedFirst = null;
  SFX.select();
  syncBoosterBar();
  toast(id === 'swap' ? T('g_booster_swap') : T('g_booster_pick'), id === 'swap' ? 'swap' : 'hammer');
}
async function useHammer(r, c) {
  const _ep = levelEpoch();
  const cell = G.B.cell[r][c];
  if (!cell || cell.hole) return false;
  SAVE.boosters.hammer--; persist();
  G.armed = null; syncBoosterBar();
  G.busy = true;
  SFX.crate();
  const keys = new Set([r + ':' + c]);
  await blastWaves(keys, 1, true);
  if (stale(_ep)) return;
  await settleBoard();
  if (stale(_ep)) return;
  await resolveBoard(null);
  if (stale(_ep)) return;
  G.busy = false;
  checkEnd();
  return true;
}
async function useFreeSwap(a, b) {
  const _ep = levelEpoch();
  SAVE.boosters.swap--; persist();
  G.armed = null; G.armedFirst = null; syncBoosterBar();
  G.busy = true;
  const ca = G.B.cell[a[0]][a[1]], cb = G.B.cell[b[0]][b[1]];
  swapTiles(G.B, a, b);
  setTarget(ca.tile, a[1], a[0], .18);
  setTarget(cb.tile, b[1], b[0], .18);
  SFX.swap();
  await wait(190);
  if (stale(_ep)) return;
  await resolveBoard([a, b]);
  if (stale(_ep)) return;
  G.busy = false;
  checkEnd();
}
async function doShuffle() {
  const _ep = levelEpoch();
  G.busy = true;
  eachCell(G.B, cell => { if (cell.tile) cell.tile.jiggle = 1; });
  await wait(180);
  if (stale(_ep)) return;
  let guard = 0;
  do { shuffleTypes(G.B); } while (!hasMove(G.B) && guard++ < 40);
  eachCell(G.B, (cell, r, c) => {
    if (cell.tile) {
      cell.tile.x = c + rnd(-.4, .4); cell.tile.y = r + rnd(-.4, .4);
      setTarget(cell.tile, c, r, .32, E.back);
    }
  });
  SFX.swap();
  await wait(340);
  if (stale(_ep)) return;
  await resolveBoard(null);
  if (stale(_ep)) return;
  G.busy = false;
  G.hintT = 0;
  checkEnd();
}

/* ---------------- clearing ---------------- */
function hitCell(B, r, c, ctx, direct) {
  const cell = B.cell[r] && B.cell[r][c];
  if (!cell || cell.hole) return;
  const key = r + ':' + c;
  if (ctx.touched.has(key)) return;
  ctx.touched.add(key);

  if (cell.crate > 0) {
    cell.crate--;
    ctx.crate += (cell.crate === 0 ? 1 : 0);
    const [cx, cy, pan] = cellFX(r, c);
    SFX.crate(cell.crate > 0, pan);
    buzzOften(HAP.crack, 110);
    FX.splinters(cx, cy, G.cell, cell.crate === 0);
    if (cell.crate === 0) ring(r, c, '#C79A62');
    return;
  }
  if (cell.ice > 0) {
    cell.ice--;
    ctx.ice++;
    const [cx, cy, pan] = cellFX(r, c);
    SFX.ice(pan);
    buzzOften(HAP.crack, 110);
    FX.shards(cx, cy, G.cell);
    return;
  }
  const t = cell.tile;
  if (!t) return;
  if (t.type === PUP) return;                     // pups only leave by the door
  if (t.dying) return;

  if (t.sp !== SP.NONE) ctx.chain.push({ r, c, sp: t.sp, type: t.type });
  t.dying = .01;
  t.dieDelay = ctx.delay;
  ctx.removed.push({ r, c, t });
  ctx.count++;
  if (t.type >= 0) ctx.collect[t.type] = (ctx.collect[t.type] || 0) + 1;
  if (cell.mud > 0) {
    cell.mud--; ctx.mud++;
    const [mx, my, mpan] = cellFX(r, c);
    SFX.mud(mpan);
    FX.splat(mx, my, G.cell, boardFloor());
  }
  if (cell.bram > 0) {
    cell.bram--; ctx.bram++;
    const [bx, by, bpan] = cellFX(r, c);
    SFX.snip(bpan);
    FX.splinters(bx, by, G.cell, false);
    burst(r, c, '#4E7A42', 8, 1);
  }
  if (direct !== 'noCrate') {
    [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([r2, c2]) => {
      const n = B.cell[r2] && B.cell[r2][c2];
      if (n && n.crate > 0) {
        n.crate--;
        if (n.crate === 0) { ctx.crate++; ring(r2, c2, '#C79A62'); }
        const [nx, ny, npan] = cellFX(r2, c2);
        SFX.crate(n.crate > 0, npan);
        FX.splinters(nx, ny, G.cell, n.crate === 0);
      }
      /* A molehill is filled in from beside it, exactly as a crate is
         broken from beside it. Same verb, so there is nothing new to
         learn about how to deal with it — only about when. */
      if (n && n.mole > 0 && moleHit(B, n)) {
        if (n.mole === 0) { ctx.mole++; ring(r2, c2, '#8A6A44'); }
        const [nx, ny, npan] = cellFX(r2, c2);
        SFX.mud(npan);
        buzzOften(HAP.crack, 110);
        burst(r2, c2, '#6B4A2C', n.mole === 0 ? 12 : 6, 1);
      }
    });
  }
}

function specialKeys(B, r, c, sp, type) {
  const keys = [];
  const [sx, sy, span] = cellFX(r, c);
  const gem = slotGem(type);
  if (sp === SP.ROW) {
    for (let i = 0; i < B.w; i++) keys.push(r + ':' + i);
    beam(r, c, 'h'); SFX.rocket(span);
    for (let i = 0; i < B.w; i++) {
      const dir = i < c ? -1 : 1;
      FX.rocketTrail(cellX(i) + G.cell / 2, sy, gem, G.cell, dir, 0);
    }
    FX.shake(.12);
  } else if (sp === SP.COL) {
    for (let i = 0; i < B.h; i++) keys.push(i + ':' + c);
    beam(r, c, 'v'); SFX.rocket(span);
    for (let i = 0; i < B.h; i++) {
      const dir = i < r ? -1 : 1;
      FX.rocketTrail(sx, cellY(i) + G.cell / 2, gem, G.cell, 0, dir);
    }
    FX.shake(.12);
  } else if (sp === SP.BOMB) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) keys.push((r + dr) + ':' + (c + dc));
    ring(r, c, PAL.accent);
    SFX.bomb(span);
    FX.blast(sx, sy, G.cell, gem);
    FX.wave(c, r, { amp: .26, speed: 10, ttl: .5, width: 1.6 });
  } else if (sp === SP.RAIN) {
    const tt = type === undefined || type < 0 ? commonType(B) : type;
    tilesOfType(B, tt).forEach(([rr2, cc]) => keys.push(rr2 + ':' + cc));
    SFX.rainbow(); G.flash = .5;
  }
  return keys;
}

/* Runs a blast and every special it sets off, wave by wave. */
async function blastWaves(startKeys, chain, silent) {
  const _ep = levelEpoch();
  let wave = Array.from(startKeys);
  let guard = 0;
  let totalTiles = 0;
  while (wave.length && guard++ < 24) {
    const ctx = { touched: new Set(), removed: [], chain: [], collect: {}, mud: 0, crate: 0, ice: 0, bram: 0, count: 0, delay: 0 };
    wave.forEach(k => {
      const [r, c] = k.split(':').map(Number);
      hitCell(G.B, r, c, ctx);
    });
    /* score + goals */
    let gained = 0;
    ctx.removed.forEach((it, i) => {
      gained += 62 * Math.min(8, chain || 1);
      burst(it.r, it.c, it.t.type >= 0 ? slotGem(it.t.type) : PAL.accent, 7, 1);
      if (!silent && i < 5) SFX.pop(chain || 1, i, cellFX(it.r, it.c)[2]);
      /* the tiles around it flinch. A board where only the matched
         cells react is a spreadsheet clearing rows; one where the
         neighbours move is a thing made of objects */
      if (!silent) [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(d2 => {
        const cell = openCell(G.B, it.r + d2[0], it.c + d2[1]);
        const nt = cell && cell.tile;
        if (nt && !nt.dying && !nt.tw) nt.jiggle = Math.max(nt.jiggle || 0, .34);
      });
    });
    /* and the whole board takes a knock, sized to how much went. Shake
       used to need a chain of two, so a plain three — the move a player
       makes more than any other — landed with nothing behind it. */
    if (!silent && ctx.removed.length) {
      G.shake = Math.max(G.shake, Math.min(5, 1.1 + ctx.removed.length * .32));
      /* and so does the hand. Rate limited, because a long cascade calls
         this every hundred and forty milliseconds and a motor held on
         for the whole of it is a buzz, not a series of taps. */
      buzzOften((chain || 1) > 1 ? HAP.chain(chain) : HAP.clear(ctx.removed.length), 90);
    }
    totalTiles += ctx.count;
    if (!silent && ctx.removed.length) {
      musicIntensity(Math.min(1, (chain || 1) / 5));
      if ((chain || 1) >= 3) {
        SFX.combo(chain);
        FX.pulse(G.ox, G.oy, G.boardW, G.boardH,
          { col: PAL.accent, a: .10 + Math.min(.16, chain * .03), ttl: .5 });
      }
    }
    addScore(gained);
    applyCounts(ctx);
    if (ctx.removed.length) await wait(reduceMotion() ? 40 : 145);
    if (stale(_ep)) return;
    ctx.removed.forEach(it => {
      const cell = G.B.cell[it.r][it.c];
      if (cell.tile === it.t) cell.tile = null;
    });
    /* next wave from specials we just consumed */
    const next = [];
    ctx.chain.forEach(s => { specialKeys(G.B, s.r, s.c, s.sp, s.type).forEach(k => next.push(k)); });
    wave = next;
    if (next.length) await wait(reduceMotion() ? 30 : 90);
    if (stale(_ep)) return;
  }
  SAVE.stats.tilesPopped += totalTiles;
  SAVE.stats.biggestClear = Math.max(SAVE.stats.biggestClear || 0, totalTiles);
  return totalTiles;
}

function applyCounts(ctx) {
  let bumped = -1;
  G.goals.forEach((g, i) => {
    if (g.kind === GK.COLLECT && ctx.collect[g.arg]) { g.have += ctx.collect[g.arg]; bumped = i; }
    if (g.kind === GK.MUD && ctx.mud) { g.have += ctx.mud; bumped = i; }
    if (g.kind === GK.CRATE && ctx.crate) { g.have += ctx.crate; bumped = i; }
    if (g.kind === GK.MOLE && ctx.mole) { g.have += ctx.mole; bumped = i; }
    if (g.kind === GK.BRAMBLE) {
      const left = brambleCount(G.B);
      const was = g.have;
      g.have = clamp(g.need - left, 0, g.need);
      if (g.have !== was) bumped = i;
    }
  });
  /* charge the pet on its own breed — but never off its own ability */
  const pet = activePet();
  if (pet && !G.over && !G.spending) {
    const fav = favType();
    let add = 0;
    for (const k in ctx.collect) add += (+k === fav ? CHARGE_FAV : CHARGE_OTHER) * ctx.collect[k];
    add *= traitChargeScale(pet);
    if (add) {
      const was = G.charge;
      G.charge = clamp(G.charge + add, 0, 100);
      if (was < 100 && G.charge >= 100) {
        petVoice(pet, 1.1); G.petMood = 'ready'; G.petMoodT = 1.4;
        /* a bark and a full bar say nothing to a screen reader, and the
           ability is the one thing on this board you have to choose to use */
        say(T('a11y_ready', { name: pet.name }), true);
      }
    }
  }
  syncGoals(bumped);
  syncHud();
}
function addScore(n) {
  if (n <= 0) return;
  G.score += Math.round(n * G.scoreMul);
  syncHud();
  syncStars();
}

/* ---------------- cascades ---------------- */
async function clearGroups(groups, swapCells) {
  const _ep = levelEpoch();
  const keys = new Set();
  const makeSpecials = [];
  groups.forEach(g => {
    const sp = specialFor(g);
    let at = null;
    if (sp !== SP.NONE) {
      if (swapCells) {
        for (const sc of swapCells) {
          if (g.cells.some(([r, c]) => r === sc[0] && c === sc[1])) { at = sc; break; }
        }
      }
      if (!at) at = g.cells[Math.floor(g.cells.length / 2)];
      makeSpecials.push({ r: at[0], c: at[1], sp, type: g.type });
    }
    g.cells.forEach(([r, c]) => {
      if (at && r === at[0] && c === at[1]) return;      // survives, becomes the special
      keys.add(r + ':' + c);
    });
  });
  if (G.chain >= 2) {
    G.bestChain = Math.max(G.bestChain, G.chain);
    /* the lifetime figure is written back only once the move has fully
       resolved, so while the chain is running it is still the old one */
    if (G.chain >= 4 && !G.bestShown && G.chain > (SAVE.stats.bestCombo || 0)) {
      G.bestShown = true;
      toast(T('g_new_best', { n: G.chain }), 'star');
      SFX.star();
      buzz(HAP.chain(G.chain));
    }
    /* One praise word at a time. A long cascade fires these a few frames
       apart and they used to stack into an unreadable pile, so a new one
       only appears once the last has had time to rise clear. */
    const t = performance.now();
    if (t - (G.lastPraise || 0) > 420) {
      G.lastPraise = t;
      const first = groups[0].cells[0];
      const words = ['g_sweet', 'g_tasty', 'g_lovely', 'g_amazing', 'g_unreal'];
      cellFloat(first[0], first[1], T(words[Math.min(words.length - 1, G.chain - 2)]), PAL.accent, 17);
    }
  }
  await blastWaves(keys, G.chain);
  if (stale(_ep)) return;
  /* now stamp the new specials */
  makeSpecials.forEach(s => {
    const cell = G.B.cell[s.r][s.c];
    if (cell && cell.tile) {
      cell.tile.sp = s.sp;
      cell.tile.scale = .4;
      cell.tile.jiggle = 1;
      ring(s.r, s.c, s.type >= 0 ? slotGem(s.type) : PAL.accent);
      addScore(210);
      SFX.select();
    }
  });
  if (makeSpecials.length) await wait(reduceMotion() ? 30 : 110);
  if (stale(_ep)) return;
}

/* Settles the board, then walks any pup that reached the door home.
   Collecting one empties its exit cell, so we settle again until the
   board comes to rest with every open cell filled. */
async function settleBoard(depth) {
  const _ep = levelEpoch();
  const moves = settle(G.B);
  if (!moves.length) {
    if (collectPups() && (depth || 0) < 12) await settleBoard((depth || 0) + 1);
    if (stale(_ep)) return;
    return;
  }
  let maxDur = 0;
  moves.forEach(m => {
    const t = m.tile;
    if (m.materialise) { t.x = m.toC; t.y = m.toR; t.scale = 0; return; }
    if (m.spawn) { t.x = m.fromC; t.y = m.fromR; }
    const dist = Math.max(Math.abs(m.toR - t.y), Math.abs(m.toC - t.x));
    const dur = clamp(.10 + dist * .050, .12, .46);
    maxDur = Math.max(maxDur, dur);
    setTarget(t, m.toC, m.toR, dur, E.drop);
    t.tw.land = true;
    t.tw.force = clamp(dist / 4, .15, 1);
  });
  SFX.drop();
  await wait(reduceMotion() ? 40 : maxDur * 1000 + 40);
  if (stale(_ep)) return;
  if (collectPups() && (depth || 0) < 12) await settleBoard((depth || 0) + 1);
  if (stale(_ep)) return;
}
function collectPups() {
  let got = 0;
  for (let c = 0; c < G.B.w; c++) {
    const r = G.B.exits[c];
    if (r < 0) continue;
    const cell = G.B.cell[r][c];
    if (cell.tile && cell.tile.type === PUP && !cell.tile.dying) {
      cell.tile = null;
      got++;
      ring(r, c, PAL.sage);
      burst(r, c, PAL.sage, 14, 1.3);
      cellFloat(r, c, '♥', PAL.rose, 20);
      SFX.coin();
      const pet = activePet();
      if (pet) petVoice(pet, 1.2);
    }
  }
  if (got) {
    G.rescued += got;
    SAVE.stats.rescued = (SAVE.stats.rescued || 0) + got;
    const g = G.goals.find(x => x.kind === GK.RESCUE);
    if (g) {
      g.have += got;
      const stillNeeded = g.need - g.have;
      let onBoard = 0;
      eachCell(G.B, cell => { if (cell.tile && cell.tile.type === PUP) onBoard++; });
      const want = Math.min(PUPS_IN_PLAY, stillNeeded + 1) - onBoard;
      for (let i = 0; i < want; i++) G.B.pupQueue = (G.B.pupQueue || 0) + 1;
      syncGoals(G.goals.indexOf(g));
    }
  }
  return got;
}

async function resolveBoard(swapCells) {
  const _ep = levelEpoch();
  G.chain = 0;
  let guard = 0;
  while (guard++ < 50) {
    const groups = findMatches(G.B);
    if (!groups.length) break;
    G.chain++;
    if (G.chain > 1) G.shake = Math.max(G.shake, Math.min(6, G.chain));
    await clearGroups(groups, swapCells);
    if (stale(_ep)) return;
    swapCells = null;
    await settleBoard();
    if (stale(_ep)) return;
  }
  SAVE.stats.bestCombo = Math.max(SAVE.stats.bestCombo || 0, G.bestChain);
  if (!G.over && !hasMove(G.B)) {
    toast(T('g_shuffle'), 'shuffle');
    await doShuffleQuiet();
    if (stale(_ep)) return;
  }
  G.hintT = 0;
}
async function doShuffleQuiet() {
  const _ep = levelEpoch();
  await wait(260);
  if (stale(_ep)) return;
  let guard = 0;
  do { shuffleTypes(G.B); } while (!hasMove(G.B) && guard++ < 40);
  eachCell(G.B, (cell, r, c) => {
    if (cell.tile) { cell.tile.x = c + rnd(-.5, .5); cell.tile.y = r + rnd(-.5, .5); setTarget(cell.tile, c, r, .34, E.back); }
  });
  await wait(360);
  if (stale(_ep)) return;
  const groups = findMatches(G.B);
  if (groups.length) await resolveBoard(null);
  if (stale(_ep)) return;
}

/* ---------------- swapping ---------------- */
function comboOf(a, b) {
  const A = a.sp, Bp = b.sp;
  if (A === SP.NONE && Bp === SP.NONE) return null;
  if (A === SP.RAIN && Bp === SP.RAIN) return 'rainrain';
  if (A === SP.RAIN || Bp === SP.RAIN) {
    const other = A === SP.RAIN ? b : a;
    if (other.sp === SP.NONE) return 'raincolor';
    return 'rainspecial';
  }
  if ((A === SP.ROW || A === SP.COL) && (Bp === SP.ROW || Bp === SP.COL)) return 'cross';
  if (A === SP.BOMB && Bp === SP.BOMB) return 'bigbomb';
  if (A === SP.BOMB || Bp === SP.BOMB) return 'rowbomb';
  return null;
}
async function runCombo(kind, a, b) {
  const _ep = levelEpoch();
  const B = G.B;
  const ca = B.cell[a[0]][a[1]], cb = B.cell[b[0]][b[1]];
  const ta = ca.tile, tb = cb.tile;
  const keys = new Set();
  const at = b;                              // the destination cell is the epicentre
  G.shake = Math.max(G.shake, 9);
  if (kind === 'rainrain') {
    eachCell(B, (cell, r, c) => { if (cell.tile) keys.add(r + ':' + c); });
    SFX.rainbow(); G.flash = .9;
  } else if (kind === 'raincolor') {
    const other = ta.sp === SP.RAIN ? tb : ta;
    const type = other.type >= 0 ? other.type : commonType(B);
    tilesOfType(B, type).forEach(([r, c]) => keys.add(r + ':' + c));
    keys.add(a[0] + ':' + a[1]); keys.add(b[0] + ':' + b[1]);
    SFX.rainbow(); G.flash = .6;
  } else if (kind === 'rainspecial') {
    const other = ta.sp === SP.RAIN ? tb : ta;
    const type = commonType(B);
    tilesOfType(B, type).forEach(([r, c]) => {
      const t = B.cell[r][c].tile;
      if (t) { t.sp = other.sp === SP.BOMB ? SP.BOMB : (Math.random() < .5 ? SP.ROW : SP.COL); t.jiggle = 1; }
    });
    SFX.rainbow(); G.flash = .8;
    await wait(280);
    if (stale(_ep)) return;
    keys.add(a[0] + ':' + a[1]); keys.add(b[0] + ':' + b[1]);
    tilesOfType(B, type).forEach(([r, c]) => keys.add(r + ':' + c));
  } else if (kind === 'cross') {
    for (let i = 0; i < B.w; i++) keys.add(at[0] + ':' + i);
    for (let i = 0; i < B.h; i++) keys.add(i + ':' + at[1]);
    beam(at[0], at[1], 'h'); beam(at[0], at[1], 'v');
    SFX.rocket();
  } else if (kind === 'rowbomb') {
    for (let d = -1; d <= 1; d++) {
      for (let i = 0; i < B.w; i++) keys.add((at[0] + d) + ':' + i);
      for (let i = 0; i < B.h; i++) keys.add(i + ':' + (at[1] + d));
    }
    beam(at[0], at[1], 'h'); beam(at[0], at[1], 'v');
    SFX.bomb();
  } else if (kind === 'bigbomb') {
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) keys.add((at[0] + dr) + ':' + (at[1] + dc));
    ring(at[0], at[1], PAL.accent);
    SFX.bomb();
  }
  /* the two combo pieces are spent */
  if (ta) ta.sp = SP.NONE;
  if (tb) tb.sp = SP.NONE;
  await blastWaves(keys, 2);
  if (stale(_ep)) return;
  await settleBoard();
  if (stale(_ep)) return;
  await resolveBoard(null);
  if (stale(_ep)) return;
}

/* A bramble patch takes one more cell every BRAMBLE_EVERY moves, which
   is the rule the reference sheet states and the rule the difficulty was
   measured against — 59% clear at 44% three-star over the generated run.

   The comment here used to describe a different rule: that the patch
   only creeps on a move where nothing was cut. Nothing implemented it.
   `G.cutThisMove` was written in three places, read in none, and sat
   next to the spread looking exactly like the condition on it. A rule
   that is only in the comment is worse than no comment, so it is gone
   rather than half-built — if it is ever wanted, brambles have 47% of
   their move budget spare and the numbers would have to move with it. */
/* The hills push earth up between moves.

   Unlike the bramble this runs whether or not the level has a molehill
   goal: a hill on a board is a hill on a board, and a level that put one
   there as a hazard rather than as a target should still have to deal
   with it. */
async function workMoles() {
  const _ep = levelEpoch();
  if (G.over || !G.B) return;
  if (moleCount(G.B) === 0) return;
  const pushed = moleTick(G.B);
  if (!pushed.length) return;
  pushed.forEach(rc => {
    ring(rc[0], rc[1], '#8A6A44');
    burst(rc[0], rc[1], '#6B4A2C', 7, .8);
  });
  SFX.mud(G.B ? (pushed[0][1] / Math.max(1, G.B.w - 1)) * 1.6 - .8 : 0);
  buzzOften(HAP.crack, 140);
  say(T('a11y_mole_pushed', { n: pushed.length }));
  /* a mud goal counts what is on the board, so earth arriving moves it
     the wrong way and the player has to be shown that */
  const g = G.goals.find(x => x.kind === GK.MUD);
  if (g) syncGoals(G.goals.indexOf(g));
  /* the render loop redraws every frame, so there is nothing to repaint
     here — only a beat, so the earth is seen arriving rather than being
     found already there */
  await wait(reduceMotion() ? 30 : 160);
  if (stale(_ep)) return;
}

async function creepBrambles() {
  const _ep = levelEpoch();
  if (G.over) return;
  const goal = G.goals.find(g => g.kind === GK.BRAMBLE);
  if (!goal || brambleCount(G.B) === 0) return;
  G.creepTick = (G.creepTick || 0) + 1;
  if (G.creepTick % BRAMBLE_EVERY !== 0) return;
  const at = spreadBramble(G.B);
  if (!at) return;
  const g = G.goals.find(x => x.kind === GK.BRAMBLE);
  if (g) g.have = clamp(g.need - brambleCount(G.B), 0, g.need);
  syncGoals(G.goals.indexOf(g));
  ring(at[0], at[1], '#4E7A42');
  burst(at[0], at[1], '#2E4A2A', 6, .7);
  SFX.creak(G.B ? (at[1] / Math.max(1, G.B.w - 1)) * 1.6 - .8 : 0);
  say(T('a11y_bramble_grew'));
  await wait(reduceMotion() ? 30 : 160);
  if (stale(_ep)) return;
}

function spendMove() {
  G.moves = Math.max(0, G.moves - 1);
  /* the last three moves get their own low note */
  if (G.moves > 0 && G.moves <= 3) SFX.tension(1 - (G.moves - 1) / 3);
  const el = $('#movesBox');
  el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
  syncHud();
}

async function tryMove(a, b) {
  const _ep = levelEpoch();
  if (G.busy || G.over) return;
  if (!canSwap(G.B, a, b)) { SFX.bad(); return; }
  G.busy = true;
  G.sel = null;
  const ca = G.B.cell[a[0]][a[1]], cb = G.B.cell[b[0]][b[1]];
  const ta = ca.tile, tb = cb.tile;
  const combo = comboOf(ta, tb);
  const legal = combo || swapMakesMatch(G.B, a, b);

  swapTiles(G.B, a, b);
  setTarget(ta, b[1], b[0], .17);
  setTarget(tb, a[1], a[0], .17);
  SFX.swap();
  /* Not yet. This fired before the board had said whether the swap was
     legal, so a move it refused felt in the hand exactly like one it
     took — the one moment the player most needs telling apart. */
  buzz(legal ? HAP.swap : HAP.no);
  await wait(180);
  if (stale(_ep)) return;

  if (!legal) {
    swapTiles(G.B, a, b);
    setTarget(ta, a[1], a[0], .17);
    setTarget(tb, b[1], b[0], .17);
    ta.jiggle = .8; tb.jiggle = .8;
    SFX.bad();
    await wait(190);
    if (stale(_ep)) return;
    G.busy = false;
    return;
  }
  spendMove();
  if (combo) await runCombo(combo, a, b);
  else await resolveBoard([a, b]);
  if (stale(_ep)) return;
  await creepBrambles();
  await workMoles();
  if (stale(_ep)) return;
  G.busy = false;
  checkEnd();
}

/* ---------------- pet ability ---------------- */
async function firePetAbility() {
  const _ep = levelEpoch();
  const pet = activePet();
  if (!pet || G.busy || G.over || G.charge < 100) return;
  G.busy = true;
  G.charge = 0;
  /* An ability's own clears must not refill the meter that paid for it.
     They did, and firing costs no move — so a chorus that took out three
     crosses handed back seventy-six percent of its own cost for free,
     and a lucky board could have handed back all of it. You charge the
     meter by playing, not by spending it. */
  G.spending = true;
  syncHud();
  petVoice(pet, 1);
  buzz([12, 40, 18]);   /* the ability: a wind-up and a release */
  G.petMood = 'act'; G.petMoodT = 1.2;
  G.flash = .35;
  const stage = petStageIdx(pet);
  const kind = petBreed(pet).ability;
  const B = G.B;
  const goalType = primaryGoalType();
  const keys = new Set();

  if (kind === 'pounce') {
    const spots = pickSpots(goalType, abilityStep('pounce', stage));
    spots.forEach(([r, c]) => {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) keys.add((r + dr) + ':' + (c + dc));
      ring(r, c, PAL.accent);
    });
    SFX.bomb();
  } else if (kind === 'dig') {
    const blockers = [];
    eachCell(B, (cell, r, c) => { if (cell.crate > 0 || cell.mud > 0 || cell.ice > 0 || cell.bram > 0) blockers.push([r, c]); });
    shuffleArr(blockers);
    blockers.slice(0, abilityStep('dig', stage)).forEach(([r, c]) => keys.add(r + ':' + c));
    if (!blockers.length) pickSpots(goalType, 3 + stage).forEach(([r, c]) => keys.add(r + ':' + c));
    SFX.crate();
  } else if (kind === 'shadow') {
    const spots = [];
    eachCell(B, (cell, r, c) => { if (cell.tile && cell.tile.type >= 0 && cell.tile.sp === SP.NONE && cell.ice === 0) spots.push([r, c]); });
    shuffleArr(spots);
    spots.slice(0, abilityStep('shadow', stage)).forEach(([r, c]) => {
      const t = B.cell[r][c].tile;
      t.sp = Math.random() < .5 ? SP.ROW : SP.COL;
      t.jiggle = 1; t.scale = .5;
      ring(r, c, slotGem(t.type));
    });
    SFX.select();
    await wait(420);
    if (stale(_ep)) return;
    G.busy = false; G.spending = false;
    checkEnd();
    return;
  } else if (kind === 'fetch') {
    /* through pickSpots, so a board holding fewer of the wanted colour
       than the card promises still gets the number the card promises */
    pickSpots(goalType, abilityStep('fetch', stage)).forEach(([r, c]) => keys.add(r + ':' + c));
    SFX.rocket();
  } else if (kind === 'chorus') {
    const spots = pickSpots(goalType, abilityStep('chorus', stage));
    spots.forEach(([r, c]) => {
      for (let i = 0; i < B.w; i++) keys.add(r + ':' + i);
      for (let i = 0; i < B.h; i++) keys.add(i + ':' + c);
      beam(r, c, 'h'); beam(r, c, 'v');
    });
    SFX.rocket();
  } else if (kind === 'snuffle') {
    snuffleSpots(goalType, abilityStep('snuffle', stage)).forEach(([r, c]) => {
      const t = B.cell[r][c].tile;
      t.type = goalType; t.jiggle = 1; t.scale = .6;
      burst(r, c, BREEDS[goalType].gem, 6, .8);
    });
    SFX.select();
    await wait(400);
    if (stale(_ep)) return;
    await resolveBoard(null);
    if (stale(_ep)) return;
    G.busy = false; G.spending = false;
    checkEnd();
    return;
  }
  await blastWaves(keys, 2);
  if (stale(_ep)) return;
  await settleBoard();
  if (stale(_ep)) return;
  await resolveBoard(null);
  if (stale(_ep)) return;
  G.busy = false; G.spending = false;
  checkEnd();
}
/* Which tile the pet is charged by and aims at on this board. The
   breed while the board deals it; the tile beside it when it does not,
   so no ability is ever pointed at a colour that is not in play. */
function favType() {
  const pet = activePet();
  /* the slot the pet is standing in, not its breed index: with the cast
     putting your own first, those are no longer the same number */
  return favTypeFor(pet ? castSlot(pet.breed) : 0, G.B ? G.B.types : 0);
}
/* "Sniffs out tiles and turns them into what you actually need."

   It used to paint n random tiles the wanted colour and hope three of
   them landed in a line. On a quiet board they did not, and a grown
   pet's whole meter went on a move that cleared nothing — the one
   ability in the game that could visibly do nothing at all.

   It lays a run of three first, chosen where it costs the fewest
   conversions, so the move always clears something; then it spends what
   is left of its budget beside tiles of that colour, which is where the
   next match is. Convertible means an open cell holding an ordinary
   tile: never a basket, never one under frost. */
function snuffleSpots(type, n) {
  const B = G.B;
  const canTake = (r, c) => {
    const cell = openCell(B, r, c);
    return !!(cell && cell.tile && cell.tile.type >= 0 && cell.ice === 0);
  };
  const out = [], seen = new Set();
  const take = (r, c) => {
    const k = r + ':' + c;
    if (out.length >= n || seen.has(k) || !canTake(r, c)) return;
    if (B.cell[r][c].tile.type === type) return;      // already what we want
    seen.add(k); out.push([r, c]);
  };
  /* the cheapest run of three */
  const runs = [];
  eachCell(B, (cell, r, c) => {
    runs.push([[r, c], [r, c + 1], [r, c + 2]]);
    runs.push([[r, c], [r + 1, c], [r + 2, c]]);
  });
  shuffleArr(runs);
  let best = null, bestCost = 1e9;
  runs.forEach(run => {
    let cost = 0;
    for (let i = 0; i < 3; i++) {
      const [r, c] = run[i];
      if (!canTake(r, c)) return;
      if (B.cell[r][c].tile.type !== type) cost++;
    }
    if (cost >= 1 && cost <= n && cost < bestCost) { bestCost = cost; best = run; }
  });
  if (best) best.forEach(([r, c]) => take(r, c));
  /* then next to what is already that colour, then anywhere */
  const near = [], far = [];
  eachCell(B, (cell, r, c) => {
    if (!canTake(r, c) || cell.tile.type === type) return;
    const touches = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
      .some(([r2, c2]) => { const o = openCell(B, r2, c2); return o && o.tile && o.tile.type === type; });
    (touches ? near : far).push([r, c]);
  });
  shuffleArr(near); shuffleArr(far);
  near.concat(far).forEach(([r, c]) => take(r, c));
  return out;
}
function primaryGoalType() {
  const g = G.goals.find(x => x.kind === GK.COLLECT && x.have < x.need);
  if (g) return g.arg;
  return activePet() ? favType() : commonType(G.B);
}
/* Every ability card promises a number — "Pounce · 3 tiles" — so the
   ability has to find that many. This used to take whatever tiles of
   the wanted colour were lying about and then top up from random
   interior cells, giving up on the first one that came back a hole: on
   a board with a few blockers in the middle a grown pet regularly
   pounced once for a card that said three. It fills up from the tiles
   that are actually there now, and only runs short when the board is. */
function pickSpots(type, n) {
  const list = tilesOfType(G.B, type);
  shuffleArr(list);
  const out = list.slice(0, n);
  if (out.length >= n) return out;
  const rest = [];
  eachCell(G.B, (cell, r, c) => {
    if (cell.hole || cell.crate > 0 || cell.ice > 0) return;
    if (!cell.tile || cell.tile.type < 0) return;
    if (cell.tile.type === type) return;              // already taken above
    rest.push([r, c]);
  });
  shuffleArr(rest);
  return out.concat(rest.slice(0, n - out.length));
}
function shuffleArr(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } }

/* ---------------- win / lose ---------------- */
const isDaily = () => G.n === DAILY_LEVEL;
function goalsMet() {
  return G.goals.every(g => {
    /* brambles are judged by what is left on the board: one that grew
       back is one still to cut, however many have been cut before */
    if (g.kind === GK.BRAMBLE) return brambleCount(G.B) === 0;
    return (g.kind === GK.SCORE ? G.score : g.have) >= g.need;
  });
}
/* A level whose only goal is a score is the one case where the goal and
   the star metric are the same quantity. Ending it the moment the target
   is passed leaves the stars to whatever the last cascade added, so it
   plays out its moves instead: the chip fills, and the rest is what
   decides two stars from three. */
function scoreOnlyLevel() {
  return G.goals.length > 0 && G.goals.every(g => g.kind === GK.SCORE);
}
function checkEnd() {
  if (G.over) return;
  if (goalsMet()) {
    if (scoreOnlyLevel() && G.moves > 0) return;      /* keep going for the stars */
    G.over = true; finishWin(); return;
  }
  if (G.moves <= 0) {
    G.over = true;
    if (scoreOnlyLevel() && goalsMet()) finishWin(); else finishLose();
  }
}

async function finishWin() {
  const _ep = levelEpoch();
  G.busy = true;
  SFX.win();
  buzz(HAP.win);
  FX.sweep(G.ox, G.oy, G.boardW, G.boardH, { ttl: .9, col: '#FFFFFF', a: .5 });
  FX.confetti(G.ox + G.boardW / 2, G.oy - 10, G.boardW, G.oy + G.boardH - G.cell * .2, 70);
  FX.punchZoom(1.2);
  const pet = activePet();
  if (pet) { G.petMood = 'happy'; G.petMoodT = 3; petVoice(pet, 1.05); }
  await wait(420);
  if (stale(_ep)) return;
  /* leftover moves turn into fireworks — a score level has already spent
     its own, which is the point of letting it run on */
  let left = G.moves;
  while (left > 0) {
    const spots = [];
    eachCell(G.B, (cell, r, c) => { if (cell.tile && cell.tile.type >= 0 && cell.tile.sp === SP.NONE) spots.push([r, c]); });
    if (!spots.length) break;
    const take = Math.min(left, 3);
    for (let i = 0; i < take && spots.length; i++) {
      const [r, c] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
      const t = G.B.cell[r][c].tile;
      t.sp = Math.random() < .35 ? SP.BOMB : (Math.random() < .5 ? SP.ROW : SP.COL);
      t.jiggle = 1;
    }
    left -= take;
    G.moves = left;
    syncHud();
    await wait(140);
    if (stale(_ep)) return;
    const keys = new Set();
    eachCell(G.B, (cell, r, c) => { if (cell.tile && cell.tile.sp !== SP.NONE) keys.add(r + ':' + c); });
    await blastWaves(keys, 3, false);
    if (stale(_ep)) return;
    await settleBoard();
    if (stale(_ep)) return;
    await resolveBoard(null);
    if (stale(_ep)) return;
  }
  await wait(360);
  if (stale(_ep)) return;
  showWin();
}
async function finishLose() {
  const _ep = levelEpoch();
  G.busy = true;
  SFX.lose();
  buzz(HAP.lose);
  const pet = activePet();
  if (pet) { G.petMood = 'sad'; G.petMoodT = 3; }
  await wait(600);
  if (stale(_ep)) return;
  showLose();
}

/* ---------------- render ---------------- */
function gameLoopStart() {
  if (G.running) return;
  G.running = true;
  G.lastT = performance.now();
  const loop = t => {
    if (!G.running) return;
    const raw = (t - G.lastT) / 1000;
    const dt = Math.min(.05, raw);
    G.lastT = t;
    /* the real gap, before the clamp hides it: the effects layer scales
       itself down on a device that is not keeping up */
    FX.load(raw);
    renderGame(dt);
    G.raf = requestAnimationFrame(loop);
  };
  G.raf = requestAnimationFrame(loop);
}
function gameLoopStop() {
  G.running = false;
  if (G.raf) cancelAnimationFrame(G.raf);
  G.raf = null;
}

function renderGame(dt) {
  /* same guard as the room: a board sized against a zero-height layout
     would stay at the minimum cell size until something forced a resize */
  const wrap = $('#boardWrap');
  if (wrap && G.B) {
    const want = boardCellFor(wrap, G.B);
    if (want > 0 && want !== G.cell) layoutBoard();
  }
  const c = G.ctx;
  if (!c || !G.B) return;
  const B = G.B;
  FX.step(dt);
  c.save();
  c.clearRect(0, 0, G.cw, G.ch);
  /* the old shake counter feeds the trauma camera */
  if (G.shake > 0) { FX.shake(Math.min(.55, G.shake * .05)); G.shake = 0; }
  c.translate(G.cw / 2, G.ch / 2);
  camApply(c);
  c.translate(-G.cw / 2, -G.ch / 2);

  /* the tray the board sits in */
  drawTray(c, G.ox, G.oy, G.boardW, G.boardH, 11);

  /* cells */
  eachCell(B, (cell, r, c2) => {
    const x = cellX(c2) + G.cell / 2, y = cellY(r) + G.cell / 2;
    if (cell.hole) { drawHole(c, x, y, G.cell); return; }
    drawCellBed(c, x, y, G.cell - 3, cell, (r + c2) % 2 === 0);
    if (cell.mud > 0) {
      /* full cell, so it shows around the tile's rounded corners */
      drawBlocker(c, 'mud', x, y, G.cell, cell.mud);
    }
    if (cell.bram > 0) {
      drawBlocker(c, 'bram', x, y, G.cell, cell.bram);
    }
  });

  /* clip tiles to the board */
  c.save();
  rr(c, G.ox - 4, G.oy - 4, G.boardW + 8, G.boardH + 8, 16);
  c.clip();

  /* tiles */
  const drawT = [];
  eachCell(B, (cell, r, c2) => {
    if (cell.tile) { stepTile(cell.tile, dt); drawT.push({ t: cell.tile, cell, r, c: c2 }); }
  });
  drawT.sort((a, b2) => (a.t.dying ? 1 : 0) - (b2.t.dying ? 1 : 0));
  const tsec = performance.now() / 1000;
  const selKey = G.sel ? G.sel[0] + ':' + G.sel[1] : null;
  drawT.forEach(({ t, cell, r, c: cc }) => {
    /* an explosion nearby shoves the tile off its cell for a beat */
    const d = displace(t.x, t.y);
    const picked = selKey === r + ':' + cc;
    /* a resting board still breathes, a hair, out of phase per tile */
    const bob = (t.tw || t.dying) ? 0 : idleBob(t, tsec);
    const lift = picked ? .10 : 0;
    const px = G.ox + (t.x + d[0]) * G.cell + G.cell / 2;
    const py = G.oy + (t.y + d[1] + bob - lift) * G.cell + G.cell / 2;
    let sc = t.scale * (1 + d[2] * .25) * (picked ? 1.07 : 1);
    let sx = 1, sy = 1;
    let alpha = 1;
    if (t.dying > 0) {
      const k = clamp((t.dying - (t.dieDelay || 0)), 0, 1);
      sc = t.scale * popScale(k);
      alpha = popAlpha(k);
    }
    if (t.jiggle > 0) {
      /* squash on impact, then wobble out — volume stays put, so it
         widens as it flattens instead of just getting smaller */
      const q = Math.sin(t.jiggle * 13) * .17 * t.jiggle;
      sx = 1 + q; sy = 1 - q;
    }
    if (sc <= .01 || alpha <= .01) return;
    /* the shadow it drops into its own cell, and further when lifted */
    if (!t.dying) {
      drawTileShadow(c, G.ox + (t.x + d[0]) * G.cell + G.cell / 2,
        G.oy + (t.y + d[1]) * G.cell + G.cell / 2, G.cell, picked ? 1 : 0);
    }
    c.save();
    c.globalAlpha = alpha;
    c.translate(px, py);
    c.scale(sc * sx, sc * sy);
    if (t.type === PUP) {
      /* a slot, not a breed: paintPup resolves through the cast now, so
         handing it a breed index shows whoever happens to stand in the
         slot with that number — the basket held a Siamese for a player
         walking a Pug */
      paintPup(c, G.cell * .94, activePet() ? castSlot(activePet().breed) : 0);
    } else {
      const sp = tileSprite(t.type, t.sp, G.cell * .90, SAVE.settings.marks,
        t.blinkT > 0 && !t.dying);
      const w = sp._w;
      c.drawImage(sp, -w / 2, -w / 2, w, w);
      if (t.dying > 0) {
        const dk = clamp(t.dying - (t.dieDelay || 0), 0, 1);
        if (dk < .4) {
          c.save();
          c.globalCompositeOperation = 'lighter';
          c.globalAlpha = (1 - dk / .4) * .75;
          c.drawImage(sp, -w / 2, -w / 2, w, w);
          c.restore();
        }
      } else if (t.sp !== SP.NONE) {
        drawTileFx(c, t.type, t.sp, G.cell * .90, tsec, t.id);
      }
    }
    c.restore();
    /* ice on top */
    if (cell.ice > 0) {
      drawBlocker(c, 'ice', cellX(cc) + G.cell / 2, cellY(r) + G.cell / 2, G.cell * .96);
    }
  });

  /* thorns lie over the tile they have grown across */
  eachCell(B, (cell, r, c2) => {
    if (cell.bram > 0 && cell.tile) {
      drawBlocker(c, 'bramOver', cellX(c2) + G.cell / 2, cellY(r) + G.cell / 2, G.cell * .96);
    }
  });

  /* muddy cells say so over the tile as well, or the layer is invisible */
  eachCell(B, (cell, r, c2) => {
    if (cell.mud > 0 && cell.tile) {
      drawBlocker(c, 'mudOver', cellX(c2) + G.cell / 2, cellY(r) + G.cell / 2, G.cell * .96, cell.mud);
    }
  });

  /* crates sit above everything in their cell */
  eachCell(B, (cell, r, c2) => {
    if (cell.crate > 0) {
      drawBlocker(c, 'crate', cellX(c2) + G.cell / 2, cellY(r) + G.cell / 2, G.cell * .96, cell.crate);
    }
    /* Molehills, and the number that makes them worth caring about.

       The mound is a cached sprite; the count is not, because it changes
       every move and is the entire point. It sits in a pale disc so it
       reads against turned earth, and it goes warm on the last move
       before something is pushed up — the one frame where a player
       should feel like doing something about it. */
    if (cell.mole > 0) {
      const x = cellX(c2) + G.cell / 2, y = cellY(r) + G.cell / 2;
      drawBlocker(c, 'mole', x, y, G.cell * .96, cell.mole);
      const left = cell.moleT;
      const soon = left <= 1;
      const rr = G.cell * .17;
      c.save();
      c.beginPath(); c.arc(x, y + G.cell * .22, rr, 0, Math.PI * 2);
      c.fillStyle = soon ? PAL.accent : rgba('#F6EADA', .92);
      c.fill();
      c.lineWidth = Math.max(1, G.cell * .022);
      c.strokeStyle = rgba('#3A2A18', soon ? .5 : .3); c.stroke();
      c.fillStyle = soon ? inkOn(PAL.accent) : '#3A2A18';
      c.font = '800 ' + Math.round(G.cell * .24) + 'px Grandstander, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(left), x, y + G.cell * .235);
      c.restore();
    }
  });

  /* selection + hint */
  if (G.sel) {
    const [r, c2] = G.sel;
    drawSelectRing(c, cellX(c2) + G.cell / 2, cellY(r) + G.cell / 2, G.cell, tsec, PAL.accent);
  }
  /* keyboard cursor: a dashed square that is clearly not the selection */
  if (G.keyMode && G.cursor) {
    const [r, c2] = G.cursor;
    c.save();
    c.strokeStyle = PAL.text;
    c.globalAlpha = .55 + Math.sin(tsec * 4) * .2;
    c.lineWidth = Math.max(2, G.cell * .05);
    c.setLineDash([G.cell * .18, G.cell * .12]);
    rr(c, cellX(c2) + 3, cellY(r) + 3, G.cell - 6, G.cell - 6, G.cell * .26);
    c.stroke();
    c.restore();
  }
  if (G.hint && !G.busy && !G.over) {
    G.hint.forEach(([r, c2]) => {
      drawHintRing(c, cellX(c2) + G.cell / 2, cellY(r) + G.cell / 2, G.cell, tsec, PAL.sage);
    });
  }
  if (G.armedFirst) {
    const [r, c2] = G.armedFirst;
    drawSelectRing(c, cellX(c2) + G.cell / 2, cellY(r) + G.cell / 2, G.cell, tsec, PAL.rose);
  }

  /* beams */
  G.beams = G.beams.filter(b => {
    b.life += dt;
    const k = b.life / b.max;
    if (k >= 1) return false;
    const a = Math.sin(k * Math.PI);
    c.save();
    c.globalAlpha = a * .8;
    const grad = b.dir === 'h'
      ? c.createLinearGradient(G.ox, 0, G.ox + G.boardW, 0)
      : c.createLinearGradient(0, G.oy, 0, G.oy + G.boardH);
    grad.addColorStop(0, rgba(PAL.accent, 0));
    grad.addColorStop(.5, '#FFFFFF');
    grad.addColorStop(1, rgba(PAL.accent, 0));
    c.fillStyle = grad;
    const thick = G.cell * (.2 + a * .5);
    if (b.dir === 'h') c.fillRect(G.ox, cellY(b.r) + G.cell / 2 - thick / 2, G.boardW, thick);
    else c.fillRect(cellX(b.c) + G.cell / 2 - thick / 2, G.oy, thick, G.boardH);
    c.restore();
    return true;
  });
  c.restore(); /* end clip */

  /* rings */
  G.rings = G.rings.filter(rg => {
    rg.life += dt;
    const k = rg.life / rg.max;
    if (k >= 1) return false;
    c.save();
    c.globalAlpha = (1 - k) * .8;
    c.strokeStyle = rg.col; c.lineWidth = G.cell * .12 * (1 - k) + 1.5;
    c.beginPath();
    c.arc(rg.x, rg.y, G.cell * (.25 + k * 1.1), 0, Math.PI * 2);
    c.stroke();
    c.restore();
    return true;
  });
  /* particles */
  G.particles = G.particles.filter(p => {
    p.life += dt;
    const k = p.life / p.max;
    if (k >= 1) return false;
    p.x += p.vx; p.y += p.vy;
    p.vy += G.cell * .012;
    p.vx *= .985;
    c.save();
    c.globalAlpha = 1 - k * k;
    c.fillStyle = p.col;
    if (p.shape === 'star') {
      c.translate(p.x, p.y); c.rotate(p.life * 7);
      c.fillRect(-p.size / 2, -p.size / 6, p.size, p.size / 3);
      c.fillRect(-p.size / 6, -p.size / 2, p.size / 3, p.size);
    } else {
      c.beginPath(); c.arc(p.x, p.y, p.size * (1 - k * .55), 0, Math.PI * 2); c.fill();
    }
    c.restore();
    return true;
  });
  /* the physics layer draws last: debris, sparks, floating numbers.
     One pass, not one per blend mode — the pool is scanned once and
     the composite flips per particle. */
  FX.draw(c);
  FX.drawBands(c);
  FX.drawText(c);

  /* the last few moves get warmer and start to breathe */
  if (!G.over && G.moves <= 3 && G.moves > 0) {
    const beat = (performance.now() / 1000) % 1.1;
    c.save();
    c.globalAlpha = .10 + .10 * Math.max(0, Math.sin(beat / 1.1 * Math.PI));
    const vg = c.createRadialGradient(G.cw / 2, G.ch / 2, Math.min(G.cw, G.ch) * .3,
      G.cw / 2, G.ch / 2, Math.max(G.cw, G.ch) * .7);
    vg.addColorStop(0, rgba(PAL.rose, 0));
    vg.addColorStop(1, rgba(PAL.rose, 1));
    c.fillStyle = vg;
    c.fillRect(0, 0, G.cw, G.ch);
    c.restore();
  }

  /* white flash on the big ones */
  if (G.flash > 0) {
    c.save();
    c.globalAlpha = G.flash * .5;
    c.fillStyle = '#FFFFFF';
    c.fillRect(0, 0, G.cw, G.ch);
    c.restore();
    G.flash = Math.max(0, G.flash - dt * 2.2);
  }
  c.restore();

  /* idle hint */
  if (!G.busy && !G.over) {
    G.hintT += dt;
    if (G.hintT > 5 && !G.hint) G.hint = bestHint();
  } else { G.hint = null; }

  drawCompanion(dt);
}

/* The best move on the board, not a move on the board.

   A player who has stopped for five seconds has stopped because they
   cannot see anything. Pointing them at a plain three while a five sits
   two rows down is worse than useless: it is the game telling them that
   what they could not find is all there was.

   Every legal swap is tried on the real board and put straight back —
   findMatches() does not mutate, and the swap is undone before anything
   else can see it. Scored by how much it clears, with a special worth
   more than its size and anything touching a goal worth more again.
   Sixty-odd swaps once, five seconds after the player went quiet. */
function hintScore(a, b) {
  const ca = G.B.cell[a[0]][a[1]], cb = G.B.cell[b[0]][b[1]];
  if (!ca || !cb || !ca.tile || !cb.tile) return -1;
  /* two specials together, or anything with a rainbow, beats any match */
  if (ca.tile.sp === SP.RAIN || cb.tile.sp === SP.RAIN) return 200;
  if (ca.tile.sp !== SP.NONE && cb.tile.sp !== SP.NONE) return 180;
  let best = 0, wanted = 0;
  const collect = G.goals.filter(g => g.kind === GK.COLLECT && g.have < g.need).map(g => g.arg);
  /* The swap happens on the live board, so putting it back is not
     optional and not conditional. Anything thrown in between would
     otherwise leave two tiles transposed with no move having been made. */
  swapTiles(G.B, a, b);
  try {
    findMatches(G.B).forEach(run => {
      if (run.len > best) best = run.len;
      run.cells.forEach(([r2, c2]) => {
        const cell = openCell(G.B, r2, c2);
        if (!cell) return;
        if (cell.mud) wanted += 3;
        if (cell.tile && collect.indexOf(cell.tile.type) >= 0) wanted += 1;
        /* a match beside a crate is what breaks the crate */
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(d => {
          const nb = openCell(G.B, r2 + d[0], c2 + d[1]);
          if (nb && nb.crate) wanted += 2;
        });
      });
    });
  } finally {
    swapTiles(G.B, a, b);
  }
  /* four and five in a row make specials, which are worth more than the
     one extra tile they clear */
  const shape = best >= 5 ? 40 : best >= 4 ? 18 : best;
  return shape + wanted;
}
function bestHint() {
  const moves = allMoves(G.B);
  if (!moves.length) return null;
  let best = null, bestScore = -1;
  moves.forEach(m => {
    const v = hintScore(m[0], m[1]);
    if (v > bestScore) { bestScore = v; best = m; }
  });
  return best;
}

/* the pet on the rail, watching */
function drawCompanion(dt) {
  const c = G.compCtx;
  const pet = activePet();
  if (!c || !pet) return;
  c.clearRect(0, 0, 50, 50);
  G.blinkT -= dt;
  if (G.blinkT < 0) { G.blink = 1; G.blinkT = rnd(2.2, 5.4); }
  if (G.blink > 0) G.blink = Math.max(0, G.blink - dt * 7);
  if (G.petMoodT > 0) G.petMoodT -= dt; else G.petMood = 'idle';
  const t = performance.now() / 1000;
  const spec = specOfPet(pet);
  const ready = G.charge >= 100;
  let bob = Math.sin(t * 2.1) * 1.1;
  let tilt = Math.sin(t * .7) * .045;
  let mouth = 'smile';
  if (G.petMood === 'happy' || ready) { bob = Math.abs(Math.sin(t * 7)) * -3.4; mouth = 'open'; }
  if (G.petMood === 'act') { bob = -4; mouth = 'open'; tilt = Math.sin(t * 22) * .18; }
  if (G.petMood === 'sad') { bob = 2; tilt = .16; }
  c.save();
  c.translate(25, 30 + bob);
  c.rotate(tilt);
  drawFace(c, spec, 28, {
    blink: G.petMood === 'sad' ? .55 : (1 - G.blink < .12 ? 1 : 0),
    mouth,
    eyeDir: [clamp(Math.sin(t * .9) * 1.4, -1, 1), G.petMood === 'sad' ? .6 : .25]
  });
  c.restore();
}

/* ---------------- input ---------------- */
function boardPos(ev) {
  const cv = $('#board');
  const rect = cv.getBoundingClientRect();
  const x = (ev.clientX - rect.left) - G.ox;
  const y = (ev.clientY - rect.top) - G.oy;
  const c = Math.floor(x / G.cell), r = Math.floor(y / G.cell);
  if (r < 0 || c < 0 || r >= G.B.h || c >= G.B.w) return null;
  return [r, c, x, y];
}
/* ============================================================
   Keyboard play

   The board is a canvas, so none of it is reachable by tab or readable
   by a screen reader on its own. This gives it a cursor, a spoken
   description of whatever the cursor is on, and a running commentary of
   moves left, score and goals.

   Arrows move · Enter/Space picks up · arrow then swaps · Escape drops
   H hint · P pet ability · S read the state out
   ============================================================ */

let sayTimer = null;
function say(text, assertive) {
  const el = $(assertive ? '#liveAssertive' : '#live');
  if (!el) return;
  /* the same string twice running is not re-announced unless it changes,
     so a space is toggled on the end to force it */
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => {
    el.textContent = (el.textContent === text) ? text + ' ' : text;
  }, 30);
}

/* what is in a cell, in words */
function describeCell(r, c) {
  const B = G.B;
  if (!B || r < 0 || c < 0 || r >= B.h || c >= B.w) return T('a11y_hole');
  const cell = B.cell[r][c];
  if (cell.hole) return T('a11y_hole');
  if (cell.crate > 0) return T('a11y_crate', { n: cell.crate });
  const t = cell.tile;
  let what;
  if (!t) what = T('a11y_empty');
  else if (t.type === PUP) what = T('a11y_basket');
  else if (t.sp === SP.RAIN) what = T('a11y_rainbow');
  else {
    what = breedName(t.type);
    if (t.sp === SP.ROW) what = T('a11y_rocket_h', { what });
    else if (t.sp === SP.COL) what = T('a11y_rocket_v', { what });
    else if (t.sp === SP.BOMB) what = T('a11y_bomb', { what });
  }
  const extra = [];
  if (cell.ice > 0) extra.push(T('a11y_ice'));
  if (cell.mud > 0) extra.push(T('a11y_mud', { n: cell.mud }));
  if (cell.bram > 0) extra.push(T('a11y_bramble'));
  if (cell.mole > 0) extra.push(T('a11y_mole', { n: cell.moleT }));
  return what + (extra.length ? ', ' + extra.join(', ') : '');
}
function sayCell(r, c) {
  if (!G.B) return;
  say(T('a11y_cell', {
    what: describeCell(r, c),
    r: r + 1, rows: G.B.h, c: c + 1, cols: G.B.w
  }));
}
function goalWords() {
  return G.goals.map(g => {
    let label;
    if (g.kind === GK.SCORE) label = T('g_score');
    else if (g.kind === GK.COLLECT) label = breedName(g.arg);
    else if (g.kind === GK.CRATE) label = T('goal_crate', { n: g.need });
    else if (g.kind === GK.MUD) label = T('goal_mud', { n: g.need });
    else if (g.kind === GK.BRAMBLE) label = T('goal_bramble', { n: g.need });
    else label = T('goal_rescue', { n: g.need });
    const have = g.kind === GK.SCORE ? G.score : g.have;
    return T('a11y_goal_line', { label, have: fmt(Math.min(have, g.need)), need: fmt(g.need) });
  }).join('. ');
}
function sayState(assertive) {
  say(T('a11y_state', { moves: G.moves, score: fmt(G.score), goals: goalWords() }), assertive);
}

/* the first open cell at or after a position, walking in one direction */
function nextOpen(r, c, dr, dc) {
  const B = G.B;
  for (let i = 0; i < Math.max(B.w, B.h); i++) {
    r += dr; c += dc;
    if (r < 0 || c < 0 || r >= B.h || c >= B.w) return null;
    if (openCell(B, r, c)) return [r, c];
  }
  return null;
}
function firstOpen() {
  const B = G.B;
  for (let r = 0; r < B.h; r++) for (let c = 0; c < B.w; c++) if (openCell(B, r, c)) return [r, c];
  return null;
}

function onBoardKey(ev) {
  if (!G.B || G.over) return;
  /* a sheet is over the board: the keys belong to it, not to us */
  if (sheetIsOpen()) return;
  const k = ev.key;
  const dirs = {
    ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1],
    W: [-1, 0], S: [1, 0], A: [0, -1], D: [0, 1]
  };

  /* keys that work whether or not a cursor is up */
  if (k === 'h' || k === 'H') {
    ev.preventDefault();
    const moves = allMoves(G.B);
    if (!moves.length) { say(T('g_shuffle')); return; }
    G.hint = pick(moves);
    G.hintT = 0;
    const [a] = G.hint;
    G.cursor = [a[0], a[1]];
    G.keyMode = true;
    sayCell(a[0], a[1]);
    return;
  }
  if (k === 'p' || k === 'P') {
    ev.preventDefault();
    if (G.charge >= 100) firePetAbility();
    else say(chargeHint(activePet()).replace(/<[^>]*>/g, ''));
    return;
  }
  if (k === 'S' && ev.shiftKey) { ev.preventDefault(); sayState(true); return; }
  if (k === '?' || (k === '/' && ev.shiftKey)) { ev.preventDefault(); keyboardHelp(); return; }

  if (!dirs[k] && k !== 'Enter' && k !== ' ' && k !== 'Escape' && k !== 'Spacebar') return;
  ev.preventDefault();
  if (G.busy) return;

  /* first keypress puts the cursor on the board */
  if (!G.cursor) {
    G.cursor = firstOpen();
    G.keyMode = true;
    if (G.cursor) sayCell(G.cursor[0], G.cursor[1]);
    return;
  }
  G.keyMode = true;
  const [cr, cc] = G.cursor;

  if (k === 'Escape') {
    if (G.sel) { G.sel = null; say(T('a11y_dropped')); SFX.tap(); }
    return;
  }
  if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
    const cell = openCell(G.B, cr, cc);
    if (!cell || !cell.tile) { SFX.bad(); return; }
    if (G.sel && G.sel[0] === cr && G.sel[1] === cc) {
      G.sel = null; say(T('a11y_dropped')); SFX.tap(); return;
    }
    if (G.sel) {                       /* second pick: swap if adjacent */
      const d = Math.abs(G.sel[0] - cr) + Math.abs(G.sel[1] - cc);
      if (d === 1) { attemptKeySwap(G.sel, [cr, cc]); return; }
    }
    if (cell.ice > 0 || cell.tile.type === PUP) { SFX.bad(); say(T('a11y_nomatch')); return; }
    G.sel = [cr, cc];
    SFX.select();
    say(T('a11y_picked', { what: describeCell(cr, cc) }));
    return;
  }

  const [dr, dc] = dirs[k];
  /* with a tile in hand an arrow means "swap that way" */
  if (G.sel && G.sel[0] === cr && G.sel[1] === cc) {
    const target = [cr + dr, cc + dc];
    if (!openCell(G.B, target[0], target[1])) { SFX.bad(); say(T('a11y_edge')); return; }
    attemptKeySwap([cr, cc], target);
    return;
  }
  const nxt = nextOpen(cr, cc, dr, dc);
  if (!nxt) { SFX.bad(); say(T('a11y_edge')); return; }
  G.cursor = nxt;
  SFX.tap();
  sayCell(nxt[0], nxt[1]);
}

async function attemptKeySwap(a, b) {
  const _ep = levelEpoch();
  const before = G.moves;
  G.cursor = [b[0], b[1]];
  await tryMove(a, b);
  if (stale(_ep)) return;
  G.sel = null;
  if (G.moves === before && !G.over) say(T('a11y_nomatch'));
  else if (!G.over) sayState();
}

function keyboardHelp() {
  const m = modal(
    '<h2>' + T('a11y_help_t') + '</h2>' +
    '<p style="text-align:left">' + T('a11y_help') + '</p>' +
    '<button class="btn primary wide" id="khOk">' + T('ok') + '</button>'
  );
  $('#khOk', m.el).addEventListener('click', m.close);
}

function bindBoard() {
  const cv = $('#board');
  let start = null, moved = false;

  const down = ev => {
    if (G.busy || G.over || !G.B) return;
    audioResume();
    const p = boardPos(ev);
    if (!p) return;
    /* capture keeps a drag alive if the finger leaves the canvas, but it
       throws if the pointer has already been released — and this is the
       first line of the handler, so an exception here would swallow the
       whole interaction */
    try { cv.setPointerCapture && cv.setPointerCapture(ev.pointerId); } catch (e) { /* no live pointer */ }
    start = { r: p[0], c: p[1], x: ev.clientX, y: ev.clientY };
    moved = false;
    G.hintT = 0; G.hint = null;

    if (G.armed === 'hammer') { useHammer(p[0], p[1]); start = null; return; }
    if (G.armed === 'swap') {
      if (!G.armedFirst) {
        if (openCell(G.B, p[0], p[1]) && G.B.cell[p[0]][p[1]].tile) { G.armedFirst = [p[0], p[1]]; SFX.select(); }
      } else {
        const a = G.armedFirst, b = [p[0], p[1]];
        if (a[0] === b[0] && a[1] === b[1]) { G.armedFirst = null; }
        else if (canSwap(G.B, a, b)) useFreeSwap(a, b);
        else SFX.bad();
      }
      start = null; return;
    }
    const cell = openCell(G.B, p[0], p[1]);
    if (!cell || !cell.tile) return;
    if (G.sel && (Math.abs(G.sel[0] - p[0]) + Math.abs(G.sel[1] - p[1])) === 1) {
      tryMove(G.sel, [p[0], p[1]]);
      start = null;
      return;
    }
    G.sel = [p[0], p[1]];
    SFX.tap();
  };
  const move = ev => {
    if (!start || G.busy || G.over) return;
    const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
    const th = Math.max(12, G.cell * .34);
    if (!moved && (Math.abs(dx) > th || Math.abs(dy) > th)) {
      moved = true;
      let b;
      if (Math.abs(dx) > Math.abs(dy)) b = [start.r, start.c + (dx > 0 ? 1 : -1)];
      else b = [start.r + (dy > 0 ? 1 : -1), start.c];
      if (openCell(G.B, b[0], b[1])) tryMove([start.r, start.c], b);
      else SFX.bad();
      start = null;
    }
  };
  const up = () => { start = null; };
  cv.addEventListener('keydown', onBoardKey);
  /* a pointer press hides the keyboard cursor again */
  cv.addEventListener('pointerdown', () => { G.keyMode = false; });
  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  $('#companion').addEventListener('click', () => {
    audioResume();
    if (G.charge >= 100) firePetAbility();
    else { const p = activePet(); if (p) { petVoice(p, .95); toast(chargeHint(p), 'paw'); } }
  });
}
