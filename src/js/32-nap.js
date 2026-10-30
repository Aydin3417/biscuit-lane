/* ============================================================
   32 — nap time: the logic puzzle beside the match-3
   ============================================================

   Every cushion gets one sleeping pet. One pet in each row and each
   column, and no two pets touching — not even corner to corner, or they
   wake each other up.

   It is the rule of LinkedIn's Queens, which Meowdoku! dressed in cats
   and took to the top of both stores in October 2026 (25 million
   installs in its first year, 4.7 from 771 thousand ratings). What it
   proved is that the rule is the hook: one sentence, no luck, a board
   that is either right or wrong, and a loss that is the player's own
   rather than the dealer's. Here the rule is not a skin on a puzzle, it
   is the house: the pets are the ones from the room, and "they wake
   each other up" is the reason for the rule rather than a decoration on
   it.

   It is also the part of the game hearts do not reach. A player out of
   hearts used to have nothing to do but wait or pay; now they can put
   the house to bed.

   This file is the puzzle and nothing else: generating a board, proving
   it has exactly one answer, proving a person can reach that answer by
   reasoning rather than guessing, and the one step of reasoning a hint
   shows. No DOM, no save — test/nap.js loads it in Node. */

/* A board is { n, reg: Int8Array(n*n) of region ids, sol: Int8Array(n)
   of the solution's column per row, level: 1|2|3 }. Cells are r*n+c. */

/* ---------- the answer first ----------

   One pet per row, one per column, none touching. With one pet per row
   only the row above can touch, so the test is |c - previous c| > 1. */
function napPlace(n, rnd) {
  const sol = new Int8Array(n).fill(-1);
  const used = new Uint8Array(n);
  const go = r => {
    if (r === n) return true;
    const cols = [];
    for (let c = 0; c < n; c++) cols.push(c);
    for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = cols[i]; cols[i] = cols[j]; cols[j] = t; }
    for (const c of cols) {
      if (used[c] || (r && Math.abs(c - sol[r - 1]) < 2)) continue;
      used[c] = 1; sol[r] = c;
      if (go(r + 1)) return true;
      used[c] = 0;
    }
    sol[r] = -1;
    return false;
  };
  return go(0) ? sol : null;
}

/* ---------- then the cushions, grown out from each pet ----------

   Every region starts at its pet and takes one free neighbouring cell at
   a time. The region that grows next is picked with a weight that falls
   as it gets bigger, so a board is neither nine equal blobs (dull, and
   rarely unique) nor one sprawling region and eight single cells (each
   single cell is a pet handed over for free). */
function napRegions(n, sol, rnd) {
  const reg = new Int8Array(n * n).fill(-1);
  const size = new Int16Array(n);
  for (let r = 0; r < n; r++) { reg[r * n + sol[r]] = r; size[r] = 1; }
  let left = n * n - n;
  const free = (i, out) => {
    const r = (i / n) | 0, c = i % n;
    if (r > 0 && reg[i - n] < 0) out.push(i - n);
    if (r < n - 1 && reg[i + n] < 0) out.push(i + n);
    if (c > 0 && reg[i - 1] < 0) out.push(i - 1);
    if (c < n - 1 && reg[i + 1] < 0) out.push(i + 1);
  };
  /* each region's appetite, fixed per board: some cushions are big */
  const want = Array.from({ length: n }, () => .35 + rnd() * 1.4);
  let guard = 0;
  while (left > 0 && guard++ < n * n * 40) {
    let tot = 0;
    const w = new Float64Array(n);
    const front = [];
    for (let k = 0; k < n; k++) {
      const f = [];
      for (let i = 0; i < n * n; i++) if (reg[i] === k) free(i, f);
      front.push(f);
      if (f.length) { w[k] = want[k] / Math.pow(size[k], .85); tot += w[k]; }
    }
    if (!tot) break;
    let x = rnd() * tot, k = 0;
    for (; k < n; k++) { x -= w[k]; if (x <= 0 && front[k].length) break; }
    if (k >= n) k = front.findIndex(f => f.length);
    const f = front[k];
    const i = f[Math.floor(rnd() * f.length)];
    reg[i] = k; size[k]++; left--;
  }
  return left ? null : reg;
}

/* ---------- how many answers (stops at two) ---------- */
function napCount(n, reg, cap) {
  cap = cap || 2;
  const col = new Uint8Array(n), rg = new Uint8Array(n);
  const at = new Int8Array(n);
  let found = 0;
  const go = r => {
    if (r === n) { found++; return found >= cap; }
    for (let c = 0; c < n; c++) {
      const k = reg[r * n + c];
      if (col[c] || rg[k] || (r && Math.abs(c - at[r - 1]) < 2)) continue;
      col[c] = 1; rg[k] = 1; at[r] = c;
      if (go(r + 1)) return true;
      col[c] = 0; rg[k] = 0;
    }
    return false;
  };
  go(0);
  return found;
}

/* Any answer other than `sol`, or null. */
function napOther(n, reg, sol) {
  const col = new Uint8Array(n), rg = new Uint8Array(n);
  const at = new Int8Array(n);
  let out = null;
  const go = r => {
    if (r === n) {
      for (let k = 0; k < n; k++) if (at[k] !== sol[k]) { out = Int8Array.from(at); return true; }
      return false;
    }
    for (let c = 0; c < n; c++) {
      const k = reg[r * n + c];
      if (col[c] || rg[k] || (r && Math.abs(c - at[r - 1]) < 2)) continue;
      col[c] = 1; rg[k] = 1; at[r] = c;
      if (go(r + 1)) return true;
      col[c] = 0; rg[k] = 0;
    }
    return false;
  };
  go(0);
  return out;
}
/* Is region k still in one piece without cell x? */
function napWhole(n, reg, k, x) {
  let start = -1, total = 0;
  for (let i = 0; i < n * n; i++) if (reg[i] === k && i !== x) { total++; if (start < 0) start = i; }
  if (!total) return false;
  const seen = new Uint8Array(n * n), q = [start];
  seen[start] = 1;
  let got = 0;
  while (q.length) {
    const i = q.pop(); got++;
    const r = (i / n) | 0, c = i % n;
    const nb = [];
    if (r > 0) nb.push(i - n); if (r < n - 1) nb.push(i + n);
    if (c > 0) nb.push(i - 1); if (c < n - 1) nb.push(i + 1);
    for (const j of nb) if (!seen[j] && j !== x && reg[j] === k) { seen[j] = 1; q.push(j); }
  }
  return got === total;
}
/* Grown at random, a big board almost always has more than one answer —
   one in several hundred 7x7 boards came out unique, and a nine took
   seconds. So the board is mended instead of thrown away: find another
   answer, take one of its pets that is not in ours, and hand that cell
   to a neighbouring cushion, which that other answer cannot survive.
   A few dozen mends and nearly every board is unique. */
function napMend(n, reg, sol, rnd) {
  const pet = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) pet[r * n + sol[r]] = 1;
  for (let round = 0; round < n * 12; round++) {
    const alt = napOther(n, reg, sol);
    if (!alt) return true;
    const cand = [];
    for (let r = 0; r < n; r++) if (alt[r] !== sol[r]) cand.push(r * n + alt[r]);
    let moved = false;
    for (let t = cand.length - 1; t > 0; t--) { const j = Math.floor(rnd() * (t + 1)); const q = cand[t]; cand[t] = cand[j]; cand[j] = q; }
    for (const x of cand) {
      if (pet[x] || !napWhole(n, reg, reg[x], x)) continue;
      const r = (x / n) | 0, c = x % n;
      const nb = [];
      if (r > 0) nb.push(x - n); if (r < n - 1) nb.push(x + n);
      if (c > 0) nb.push(x - 1); if (c < n - 1) nb.push(x + 1);
      const to = nb.map(j => reg[j]).filter(k => k !== reg[x]);
      if (!to.length) continue;
      reg[x] = to[Math.floor(rnd() * to.length)];
      moved = true;
      break;
    }
    if (!moved) return false;
  }
  return napCount(n, reg, 2) === 1;
}

/* ---------- reasoning, the way a person does it ----------

   A state is an Int8Array over the cells: 0 unknown, 1 crossed out, 2 a
   pet. `napStep` finds the next thing a person could be sure of and
   returns it as { kind, rule, cells } without applying it, so the same
   code is the generator's judge of difficulty and the hint button.

     rule 1  a row, column or cushion with one cell left takes the pet;
             a pet crosses out its row, column, cushion and neighbours
     rule 2  a cushion whose cells all lie in one row (or column) owns
             that row; so does a row lying wholly in one cushion
     rule 3  a cell is crossed out if a pet there would leave some row,
             column or cushion with nowhere to go
     rule 4  k cushions squeezed into k rows (or columns) own them all

   A board is accepted only if these four, and nothing cleverer, solve
   it — so no board ever asks the player to guess. */
function napUnits(n, reg) {
  const units = [];
  for (let r = 0; r < n; r++) units.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) units.push(Array.from({ length: n }, (_, r) => r * n + c));
  for (let k = 0; k < n; k++) {
    const u = [];
    for (let i = 0; i < n * n; i++) if (reg[i] === k) u.push(i);
    units.push(u);
  }
  return units;
}
/* every cell a pet at i rules out */
function napShadow(n, reg, i) {
  const r = (i / n) | 0, c = i % n, out = [];
  for (let j = 0; j < n * n; j++) {
    if (j === i) continue;
    const rj = (j / n) | 0, cj = j % n;
    if (rj === r || cj === c || reg[j] === reg[i] || (Math.abs(rj - r) < 2 && Math.abs(cj - c) < 2)) out.push(j);
  }
  return out;
}
function napStep(b, st, maxRule) {
  const n = b.n, reg = b.reg;
  const units = b.units || (b.units = napUnits(n, reg));
  maxRule = maxRule || 4;
  /* rule 1a: a pet's shadow not yet crossed out */
  for (let i = 0; i < n * n; i++) {
    if (st[i] !== 2) continue;
    const xs = napShadow(n, reg, i).filter(j => st[j] === 0);
    if (xs.length) return { kind: 'x', rule: 1, cells: xs, from: [i] };
  }
  /* rule 1b: one cell left */
  for (let u = 0; u < units.length; u++) {
    const cells = units[u];
    if (cells.some(j => st[j] === 2)) continue;
    const open = cells.filter(j => st[j] === 0);
    if (open.length === 1) return { kind: 'pet', rule: 1, cells: open, unit: u };
  }
  if (maxRule < 2) return null;
  /* rule 2: a cushion inside one line owns the line, and the reverse */
  for (let u = 0; u < units.length; u++) {
    const cells = units[u];
    if (cells.some(j => st[j] === 2)) continue;
    const open = cells.filter(j => st[j] === 0);
    if (!open.length) continue;
    const isReg = u >= 2 * n;
    const lines = isReg
      ? [new Set(open.map(j => (j / n) | 0)), new Set(open.map(j => j % n))]
      : [new Set(open.map(j => reg[j]))];
    for (let t = 0; t < lines.length; t++) {
      if (lines[t].size !== 1) continue;
      const v = [...lines[t]][0];
      const xs = [];
      for (let j = 0; j < n * n; j++) {
        if (st[j] !== 0 || cells.indexOf(j) >= 0) continue;
        const hit = isReg ? (t === 0 ? ((j / n) | 0) === v : j % n === v) : reg[j] === v;
        if (hit) xs.push(j);
      }
      if (xs.length) return { kind: 'x', rule: 2, cells: xs, unit: u };
    }
  }
  if (maxRule < 3) return null;
  /* rule 3: a pet here would empty another unit */
  for (let i = 0; i < n * n; i++) {
    if (st[i] !== 0) continue;
    const sh = new Set(napShadow(n, reg, i)); sh.add(i);
    for (let u = 0; u < units.length; u++) {
      const cells = units[u];
      if (cells.indexOf(i) >= 0 || cells.some(j => st[j] === 2)) continue;
      if (cells.every(j => st[j] !== 0 || sh.has(j))) return { kind: 'x', rule: 3, cells: [i], unit: u };
    }
  }
  if (maxRule < 4) return null;
  /* rule 4: k cushions in k lines (k = 2, 3) */
  const regs = [];
  for (let k = 0; k < n; k++) {
    const cells = units[2 * n + k];
    if (cells.some(j => st[j] === 2)) continue;
    const open = cells.filter(j => st[j] === 0);
    if (open.length) regs.push({ k, open });
  }
  for (const axis of [0, 1]) {
    const lineOf = j => axis ? j % n : (j / n) | 0;
    for (let a = 0; a < regs.length; a++) for (let bb = a + 1; bb < regs.length; bb++) {
      const sets = [[regs[a], regs[bb]]];
      for (let cc = bb + 1; cc < regs.length; cc++) sets.push([regs[a], regs[bb], regs[cc]]);
      for (const group of sets) {
        const lines = new Set();
        group.forEach(g => g.open.forEach(j => lines.add(lineOf(j))));
        if (lines.size !== group.length) continue;
        const inGroup = new Set(group.map(g => g.k));
        const xs = [];
        for (let j = 0; j < n * n; j++) if (st[j] === 0 && lines.has(lineOf(j)) && !inGroup.has(reg[j])) xs.push(j);
        if (xs.length) return { kind: 'x', rule: 4, cells: xs };
      }
    }
  }
  return null;
}
/* Solve by reasoning alone. Returns the hardest rule needed and how
   often each was leaned on, or null if reasoning runs out. */
function napReason(b, maxRule) {
  const n = b.n, st = new Int8Array(n * n);
  let hardest = 1, steps = 0;
  const used = [0, 0, 0, 0, 0];
  for (let guard = 0; guard < n * n * 4; guard++) {
    const s = napStep(b, st, maxRule);
    if (!s) break;
    steps++; used[s.rule]++;
    if (s.rule > hardest) hardest = s.rule;
    s.cells.forEach(j => { st[j] = s.kind === 'pet' ? 2 : 1; });
  }
  let pets = 0;
  for (let i = 0; i < n * n; i++) if (st[i] === 2) pets++;
  return pets === n ? { hardest, steps, used } : null;
}

/* ---------- a board, from a seed ----------

   `level` is the hardest rule the board may need (1 gentle, 4 the
   hardest), and `min` the hardest it must need, so a board meant to be
   hard is not quietly an easy one. Deterministic: the same seed is the
   same board on every phone, which is what makes the daily one daily. */
function napMake(n, seed, min, max) {
  const rnd = mulberry(seed >>> 0);
  min = min || 1; max = max || 4;
  let fallback = null;
  for (let tries = 0; tries < 4000; tries++) {
    const sol = napPlace(n, rnd);
    if (!sol) continue;
    const reg = napRegions(n, sol, rnd);
    if (!reg || !napMend(n, reg, sol, rnd)) continue;
    const b = { n, reg, sol };
    const why = napReason(b, max);
    if (!why) continue;
    b.level = why.hardest;
    if (why.hardest >= min) return b;
    if (!fallback) fallback = b;
    /* a phone is three to five times slower than the desk this was
       measured on; a board a little easier than asked for beats a
       second of a frozen screen */
    if (fallback && tries > 24) return fallback;
  }
  return fallback;
}

/* ---------- the ladder and the day ----------

   Size and difficulty by puzzle number. Four by four teaches the rule
   with nothing else in the way; the board grows a cell at a time; the
   hard rules arrive only once the easy ones are habits. */
function napShape(no) {
  if (no <= 2) return { n: 4, min: 1, max: 1 };
  if (no <= 6) return { n: 5, min: 1, max: 2 };
  if (no <= 14) return { n: 6, min: 2, max: 3 };
  if (no <= 30) return { n: 7, min: 2, max: 3 };
  if (no <= 60) return { n: 8, min: 3, max: 4 };
  return { n: no % 3 ? 8 : 9, min: 3, max: 4 };
}
function napLevel(no) {
  const s = napShape(no);
  const b = napMake(s.n, no * 7919 + 104729, s.min, s.max);
  b.no = no;
  return b;
}
/* Monday gentle, Sunday big: the week has a shape, like a newspaper's */
function napDaily(day) {
  const wd = (day + 4) % 7;          /* day 0 was a Thursday */
  const s = [{ n: 7, min: 2, max: 3 }, { n: 6, min: 1, max: 2 }, { n: 7, min: 1, max: 3 },
  { n: 7, min: 2, max: 3 }, { n: 8, min: 2, max: 3 }, { n: 8, min: 3, max: 4 }, { n: 9, min: 3, max: 4 }][wd];
  const b = napMake(s.n, day * 2654435761 + 31, s.min, s.max);
  b.day = day;
  return b;
}

/* ---------- checking a player's board ----------

   Which placed pets wake somebody up: sharing a row, a column or a
   cushion, or touching. Returns the set of cell ids in trouble. */
function napClashes(b, st) {
  const n = b.n, bad = new Set(), pets = [];
  for (let i = 0; i < n * n; i++) if (st[i] === 2) pets.push(i);
  for (let a = 0; a < pets.length; a++) for (let c = a + 1; c < pets.length; c++) {
    const i = pets[a], j = pets[c];
    const ri = (i / n) | 0, ci = i % n, rj = (j / n) | 0, cj = j % n;
    if (ri === rj || ci === cj || b.reg[i] === b.reg[j] || (Math.abs(ri - rj) < 2 && Math.abs(ci - cj) < 2)) { bad.add(i); bad.add(j); }
  }
  return bad;
}
function napSolved(b, st) {
  let pets = 0;
  for (let i = 0; i < b.n * b.n; i++) if (st[i] === 2) pets++;
  return pets === b.n && napClashes(b, st).size === 0;
}
/* The hint: the next thing reasoning gives from the pets the player has
   placed correctly — never from a wrong one, which would be reasoning
   from a mistake. A wrong pet is pointed at first. */
function napHint(b, st) {
  const n = b.n;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c;
    if (st[i] === 2 && b.sol[r] !== c) return { kind: 'wrong', cells: [i] };
  }
  const clean = new Int8Array(n * n);
  for (let i = 0; i < n * n; i++) if (st[i] === 2) clean[i] = 2;
  for (let guard = 0; guard < n * n * 4; guard++) {
    const s = napStep(b, clean, 4);
    if (!s) return null;
    if (s.kind === 'pet') return s;
    /* a pet's own shadow is drawn on the board already, so it is
       never the hint; nor are crossings the player has already made */
    if (s.from) { s.cells.forEach(j => { clean[j] = 1; }); continue; }
    if (s.cells.some(j => st[j] === 0)) return Object.assign(s, { cells: s.cells.filter(j => st[j] === 0) });
    s.cells.forEach(j => { clean[j] = 1; });
  }
  return null;
}
