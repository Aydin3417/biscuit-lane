/* One measurement worker.

   Owns a solver and nothing else. The parent sends batches of
   [level, seed, moves] and gets back a win/lose bit for each. Levels are
   rebuilt from levelDef here rather than shipped over IPC, so the
   authored table stays the single source of truth and only the one
   number under test crosses the wire. A `moves` of 0 means "as
   authored", which is how the pool is used for plain measurement. */
const { playLevel, X } = require('./_solver.js');

/* levelDef caches nothing, but it does read a module-level table, so a
   def is copied before its numbers are overwritten.

   Two levers, not one. A move budget can only take a level so far: a
   board asked to clear more mud than forty moves can reach does not
   become easier at fifty, it becomes long. Where the goal is what makes
   the level miss, the goal is what moves — scaled, never re-authored,
   so the level is still the level somebody wrote.

   A rescue count is not a continuous quantity — one basket or two, and
   the difference is enormous — so it rounds and floors at one. */
function defWith(n, moves, goalScale, counts) {
  const d = X.levelDef(n);
  const copy = {};
  for (const k in d) copy[k] = d[k];
  if (moves) copy.moves = moves;
  if (counts) {
    /* explicit per-goal counts, for asking what a level would be if one
       of its goals were smaller — a uniform scale cannot answer that,
       and on a level whose difficulty comes from stacking two goals it
       is the only question worth asking */
    copy.goals = d.goals.map((g, i) => [g[0], g[1], counts[i] === null || counts[i] === undefined ? g[2] : counts[i]])
      .filter(g => g[2] > 0);
  } else if (goalScale && goalScale !== 1) {
    copy.goals = d.goals.map(g => {
      const [kind, arg, count] = g;
      if (kind === X.GK.RESCUE) return [kind, arg, Math.max(1, Math.round(count * goalScale))];
      if (kind === X.GK.SCORE) return [kind, arg, Math.max(500, Math.round(count * goalScale))];
      return [kind, arg, Math.max(1, Math.round(count * goalScale))];
    });
    /* the table's own normalisation has already run and stamped _fixed;
       these counts are already clamped to what the map holds, and
       scaling down never exceeds that */
  }
  return copy;
}

process.on('message', msg => {
  if (msg.bye) { process.exit(0); return; }
  const won = [], score = [];
  for (let i = 0; i < msg.jobs.length; i++) {
    const [n, seed, moves, goalScale, counts] = msg.jobs[i];
    try {
      const r = playLevel(n, seed, (moves || goalScale || counts) ? defWith(n, moves, goalScale, counts) : null);
      won.push(r.won ? 1 : 0);
      score.push(r.score);
    } catch (e) {
      won.push(2);           /* 2 = threw; the parent reports these, never counts them */
      score.push(0);
    }
  }
  process.send({ id: msg.id, won, score });
});
process.send({ ready: 1 });
