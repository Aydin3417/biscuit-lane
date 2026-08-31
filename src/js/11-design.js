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
const RHYTHM = [
  +.13,   /* 1  — relief. You have just come through a gate. */
  +.06,   /* 2  — still gentle, but it asks for something */
  +.02,   /* 3 */
  -.03,   /* 4  — the first one that can go wrong */
  +.05,   /* 5  — a breather in the middle of the block */
  -.04,   /* 6 */
  -.07,   /* 7 */
  -.02,   /* 8  — a small step back before the run-up */
  -.09,   /* 9  — the run-up */
  -.15    /* 10 — the gate */
];

/* Where the authored lane ends and the generator takes over. The lane is
   levels 1-60, so level 60 is a gate and level 61 is the relief after
   it: the handoff falls on a beat rather than across one. */
const RUN_START = 61;

/* The floor the run settles toward, and how fast it gets there. Ninety
   levels in it is most of the way down; it never reaches the floor, so
   there is always somewhere left to go. */
const EASE_FROM = .78, EASE_TO = .61, EASE_OVER = 210;

/* Where the game opens, and how it bends down to meet EASE_FROM at the
   handoff. A bend of 1 would be a straight line and would spend the
   whole of the first twenty levels being nearly as hard as level fifty;
   1.4 puts the give where a new player needs it and flattens out by the
   time they don't. */
const LANE_FROM = .93, LANE_BEND = 1.6;

/* Never certain, never impossible. The lane is allowed to be gentler at
   both ends than the run: nobody should fail level one, and nobody
   should meet a 45% wall before they have met every mechanic. */
const CLEAR_FLOOR = .45, CLEAR_CEIL = .88;
const LANE_FLOOR = .58, LANE_CEIL = .97;

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
const MODEL_BIAS = .09;

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
function targetClear(n) {
  const lane = n < RUN_START;
  if (lane && typeof LEVELS !== 'undefined' && LEVELS[n - 1] && LEVELS[n - 1].want !== undefined) {
    return LEVELS[n - 1].want;
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
