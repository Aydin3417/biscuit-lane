/* ============================================================
   THE SHAPE OF THE GAME
   ============================================================

   This file used to describe only the endless run, because only the run
   was designed. The sixty handcrafted levels in front of it were
   authored one at a time and given whatever move budget felt right, and
   then measured once. Measured again, that lane was a bathtub:

     L1-10  84%   L11-20 71%   L21-30 65%
     L31-40 66%   L41-50 65%   L51-60 73%

   Easy at both ends and a flat 65% grind for thirty levels through the
   middle — with seven levels under 45% scattered through it and ten that
   could not be lost. The hardest stretch of the whole game was levels
   21 to 50, and then it got *easier* just as the designed run took over
   at 78%. A player who quit this game quit somewhere in that plateau,
   and the plateau was not a decision anybody made.

   So the lane is designed now, on the same terms as the run, and the two
   are one curve rather than two systems. Three rules cover the whole
   game, and they turned out to be the same rules written twice:

     the gate is every tenth level          n % 10 === 0
     the beat is where you are in the block RHYTHM[(n - 1) % 10]
     the ease descends and never lands

   All figures here are the clear rate of the greedy solver in
   test/ai.js, which plays about as well as an attentive human who is not
   trying very hard. It is a proxy, and it is the one every difficulty
   number in this project has been measured with.

   They describe a player walking a *bare* pet, because that is the floor
   and the basis everything else was measured on. A cared-for one brings
   four more moves and twelve percent more score to the same board.
   ============================================================ */

/* Ten levels to a block. The gate is the last of them; the level after a
   gate is the softest thing in the game. */
const BLOCK = 10;
/* DEEPER, 14 Nov 2026. Two weeks in the store and the owner's report
   was that anybody who knows the genre finds the game easy. Measured
   the same day through the real game (test/all-levels.js, ten games a
   level), the player who cannot see a cascade and never fires two
   specials into each other cleared 93% of levels 1-20, 85% of 21-40
   and 83% of 41-60, with a third of the budget still unspent at the
   moment the goal was met, and not one of the first sixty levels
   below 50%. A player who plans specials is well above that. So the
   block asks harder at its seventh and ninth beats — the two the map
   now marks as hard levels (isHard) — and its gate is deeper. The
   relief after a gate is untouched: the shape is the same shape with
   a lower trough. */
const RHYTHM = [
  +.13,   /* 1  — relief. You have just come through a gate. */
  +.06,   /* 2  — still gentle, but it asks for something */
  +.02,   /* 3 */
  -.03,   /* 4  — the first one that can go wrong */
  +.05,   /* 5  — a breather in the middle of the block */
  -.04,   /* 6 */
  -.10,   /* 7  — a hard level */
  -.02,   /* 8  — a small step back before the run-up */
  -.12,   /* 9  — the run-up, and a hard level */
  -.21    /* 10 — the gate */
];

/* Where the authored lane ends and the generator takes over. The lane is
   levels 1-60, so level 60 is a gate and level 61 is the relief after
   it: the handoff falls on a beat rather than across one. */
const RUN_START = 61;

/* The floor the run settles toward, and how fast it gets there. Ninety
   levels in it is most of the way down; it never reaches the floor, so
   there is always somewhere left to go. */
/* THE RUN WAS TUNED FOR A PET NOBODY PLAYS WITH.

   Every number in this file describes a bare pet, and a player who feeds
   theirs clears more: measured at nine games a level, the run went from
   72% bare to 87% cared-for, and the lane from 86% to 94%. With a heart
   returned on every win, that is a game in which nobody runs out and the
   carry-on is mostly paid for with treats the player earned — so there
   was almost nothing to sell, because there was almost nothing to want.

   The run is harder by a dose. It opens at .70 instead of .78 and settles
   toward .52 instead of .61, the gate asks .18 below the ease instead of
   .15, and the floor comes down to .35. For a cared-for player that is an
   estimated eight points: relief still near nine in ten, a gate near seven
   in ten. Estimated, because the lift a pet gives is measured as an average
   and a gate is not an average level; test/run-all.js measures the
   cared-for run directly, and that is the number to believe.

   The lane is untouched. The first sixty levels are where a new player
   learns the game, and nothing should be sold there to somebody who is
   still working out what a rocket is. */
/* .70 and .52 until 14 Nov 2026, measured too kind (see RHYTHM) */
const EASE_FROM = .64, EASE_TO = .47, EASE_OVER = 210;

/* Where the game opens, and how it bends down to meet EASE_FROM at the
   handoff. A bend of 1 would be a straight line and would spend the
   whole of the first twenty levels being nearly as hard as level fifty;
   1.4 puts the give where a new player needs it and flattens out by the
   time they don't. */
/* The bend was 1.6, which kept the first forty levels near the top of
   the band: level 40 was drawn at .80 and measured at 85% bare. At 1.15
   the give is still where a new player needs it — level ten is drawn
   within two points of where it was — and it is spent by the middle of
   the lane instead of at the end of it. */
const LANE_FROM = .93, LANE_BEND = 1.15;

/* Never certain, never impossible. The lane is allowed to be gentler at
   both ends than the run: nobody should fail level one, and nobody
   should meet a 45% wall before they have met every mechanic. */
/* CLEAR_CEIL was .88; .80 since 17 Nov 2026 (see tierOf) */
const CLEAR_FLOOR = .35, CLEAR_CEIL = .80;
const LANE_FLOOR = .50, LANE_CEIL = .97, LANE_LATE_CEIL = .82;

/* A level that teaches a mechanic for the first time is not a test of
   it. The lift is big enough to be felt and small enough that the level
   still has to be played. */
const TUT_LIFT = .06;

/* The rhythm is felt at full strength by the time the run starts, and
   softened before that. A -.15 gate at level ten lands on somebody who
   has swapped maybe two hundred tiles; the same gate at level sixty
   lands on somebody who knows what a rocket is. */
function beatScale(n) {
  return n >= RUN_START ? 1 : .35 + .65 * ((n - 1) / (RUN_START - 1));
}

/* The descent, across the whole game. Continuous at the handoff by
   construction: the lane term vanishes exactly at RUN_START. */
function easeAt(n) {
  if (n >= RUN_START) return EASE_TO + (EASE_FROM - EASE_TO) * Math.exp(-(n - RUN_START) / EASE_OVER);
  const k = (n - 1) / (RUN_START - 1);
  return EASE_FROM + (LANE_FROM - EASE_FROM) * Math.pow(1 - k, LANE_BEND);
}

/* The generator lands about nine points easier than it aims for.

   Measured twice over the run at different sample sizes — +7% across
   levels 61-110 at fourteen games, +11% across 61-100 at ten — so it is
   a systematic offset rather than a coin. It is the residual of the
   model: the response curves know what a move budget does on an average
   map of a kind, and the map in front of the player is not the average
   one. Corrected in one place by aiming low, which is honest about
   there being an error rather than hiding it in the constants.

   The lane needs no such correction. Its levels are not modelled, they
   are measured one at a time and solved for directly, so there is
   nothing between the intent and the number. */
/* Re-measured after the curves were remade for the player who cannot
   see cascades: aiming nine points low, the run came out eight points
   *harder* than drawn (levels 61-120, twelve games each, bias -8%,
   gates 8-33% against 58-62%). The old offset belonged to the old
   player. Near zero now; the gates are watched separately below. */
const MODEL_BIAS = .01;

/* The daily walk sits outside the curve on purpose. It is the same
   promise every day — the one level that carries a streak, so the one
   place where a hard roll costs something a replay cannot give back.
   Generous, and the same kind of generous whatever it rolls. */
const DAILY_CLEAR = .85;

/* What share of games this level is meant to be won.

   For the generated run this is the curve above, computed. For the
   authored lane it is read off the level, because the lane's rhythm is
   fitted to what each of its sixty levels can actually carry rather
   than assigned by position — see test/fit-lane.js. A lane level with
   no `want` has never been fitted, and falls back to the curve so that
   a newly written level still has an intent before anybody measures it. */
/* HARD AND SUPER HARD, BY POSITION, AND NOTHING FREE.

   17 Nov 2026, the owner: some levels should be hard enough that people
   get stuck on them once or twice, and not every level should be a
   pushover. The games this one is shelved beside do it the same way: a
   level or two in every ten marked hard before it starts, the end of
   the block marked super hard, and after the first hour no level that
   simply plays itself.

   The hard and super-hard beats used to be offsets from the ease, so
   they drifted with it — a "hard" level at 61 was drawn at 54%, which
   nobody gets stuck on. They are absolute now, for the player every
   budget is fitted to (test/_solver.js's human policy, a little below
   an average person):

     hard        the 7th and 9th of every block from level 17
                 40%, falling to 30% by the end of the run
     super hard  the 10th of every block from level 20
                 28%, falling to 20%
     the rest    the rhythm as before, but never above 80% after
                 level 20 (82% in the lane, which still teaches)

   A person a little better than that player clears a hard level at
   about half, which is "stuck once"; a super-hard level a third of the
   time, "stuck twice". The adaptive budget (15-save.js) gives a move
   back from the third failure, so nobody is stuck for good. */
const HARD_FROM = 17, SUPER_FROM = 20;
function tierOf(n) {
  if (!(n > 0) || n === DAILY_LEVEL) return '';
  if (n >= SUPER_FROM && isGate(n)) return 'super';
  if (n >= HARD_FROM && (n % BLOCK === 7 || n % BLOCK === 9)) return 'hard';
  return '';
}
function tierWant(n, tier) {
  /* 0 at level 61, 1 by the end of the descent */
  const late = n < RUN_START ? 0 : 1 - Math.exp(-(n - RUN_START) / EASE_OVER);
  if (tier === 'super') return .28 - .08 * late;
  return .40 - .10 * late;
}
function targetClear(n) {
  const lane = n < RUN_START;
  const tier = tierOf(n);
  if (tier) return tierWant(n, tier);
  if (lane && typeof LEVELS !== 'undefined' && LEVELS[n - 1] && LEVELS[n - 1].want !== undefined) {
    return Math.min(LEVELS[n - 1].want, n > 20 ? LANE_LATE_CEIL : 1);
  }
  const ease = easeAt(n);
  const beat = RHYTHM[(n - 1) % BLOCK] * beatScale(n);
  /* a little variation so the rhythm is felt rather than counted; the
     lane is authored level by level and wants no dice in it */
  const jitter = lane ? 0 : (mulberry(n * 60013)() - .5) * .04;
  let want = ease + beat + jitter;
  if (lane && typeof LEVELS !== 'undefined' && LEVELS[n - 1] && LEVELS[n - 1].tut) want += TUT_LIFT;
  return clamp(want, lane ? LANE_FLOOR : CLEAR_FLOOR, lane ? LANE_CEIL : CLEAR_CEIL);
}

/* Whether this level is the one at the end of a block. The map screen
   marks it, and the level card says so: a wall you did not know was
   coming is just an unfair level.

   Every tenth. The run's own reading of this — nine levels past the
   handoff, then every ten — is the same set of levels, because the lane
   is sixty long and sixty is a multiple of ten. */
function isGate(n) {
  return n >= BLOCK && n % BLOCK === 0;
}

/* A hard level: one the curve draws well below its own block, said on
   the map and on the card the way a gate is, and paid for — a wall you
   were warned about and rewarded for is a challenge; the same wall
   unannounced is the game cheating. Read off the target rather than off
   the position, because the lane hands its beats out by what each level
   can carry (test/fit-lane.js), so its hard levels are not always the
   seventh and the ninth. Never in the first dozen levels, and never a
   gate, which is already its own thing. */
/* by position now (tierOf, above); a super-hard level is hard as well,
   for everything that only asks whether a level is one to be warned of */
function isHard(n) { return tierOf(n) === 'hard'; }
function isSuperHard(n) { return tierOf(n) === 'super'; }
