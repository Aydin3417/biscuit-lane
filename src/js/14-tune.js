/* ============================================================
   14 — live tuning: the few numbers that may change after the build
   ============================================================

   Everything about a level is compiled in. The move budgets, the coin a
   win pays, the level the nap card appears from — all of it is a
   constant in this bundle, and the bundle is what the store has.

   Twice that has been the wrong shape. The molehill goal shipped broken
   while every harness said it was fine (test/game-rules.js exists
   because of it), and the only remedy was a new build. And a new build
   is not a fix the same day: review has taken anywhere from two days to
   three weeks, and a level with a budget six moves short is a wall for
   every player who reaches it until then. A game that measures itself
   (18-telemetry.js) and cannot act on what it measures is only half a
   loop.

   So a small, bounded set of knobs is read from one JSON file on the
   same Supabase project, once per launch, in the background:

     moves   a per-level correction to the move budget, ±6 at most
     pay     a multiplier on the coins and treats a level or a nap pays
     nap     the level the nap card appears from
     notice  a sentence to show players on a build older than `min`

   Bounded is the point. A typo in that file — 60 where 6 was meant, a
   string where a number was — cannot break the game, because nothing is
   applied as written: every number is clamped to a range the harnesses
   have measured as safe, anything unexpected is ignored, and a file
   that is malformed as a whole is ignored as a whole. The last good
   copy sits in the save, so a phone offline or a bucket down plays
   exactly the game it played yesterday.

   Nothing here blocks boot and nothing here throws. The fetch is fire
   and forget; the first thing the player sees is drawn from the cached
   copy or from the compiled defaults, whichever is in force. See
   server/README.md, "Live tuning", for the file and how it is put up. */

/* Six moves either way. Measured with test/ai.js, a level's clear rate
   moves roughly five to eight points per move near the middle of the
   band, so six is a forty-point swing: enough to unwall any level in
   the lane, far short of turning it into a free one. And a floor of
   eight moves under it all, because no goal in the table resolves in
   fewer, whatever the file says. */
const TUNE_MOVES_MAX = 6;
const TUNE_MOVES_FLOOR = 8;
/* Half to double. The economy was balanced on paper over ninety days
   (test/economy.js); halving a payout stretches that to about six
   months, doubling it compresses it to six weeks, and both are still a
   game. Beyond either is a different economy, which should go through
   the suite and a build. */
const TUNE_MULT_MIN = 0.5, TUNE_MULT_MAX = 2.0;
/* the nap card can be shown from the first level to the end of the
   handcrafted lane; past sixty, the player has stopped needing to be
   introduced to anything */
const TUNE_NAP_FROM_DEFAULT = 3, TUNE_NAP_FROM_MAX = 60;
/* a notice is a sentence, not a page */
const TUNE_NOTICE_MAX = 240;

const TUNE = {
  /* the validated configuration in force, or null for the defaults */
  data: null,
  /* when it was fetched, as a clock reading; 0 for a cached copy of
     unknown age or for nothing at all */
  at: 0,
  started: false,
  /* What boot hands in, and this file never looks up for itself: the
     file's address, whether a fetch is allowed at all, this build's
     version, and where the last good copy is kept. Handed in rather
     than named because the data and the save both read from here
     (tuneMoves, tunePay), and a module that also named them back would
     be a loop, not a layer (test/deps.js). Headless, with nothing
     handed in, every knob is at its compiled default and refresh() is
     a no-op. */
  io: null,
  version: '0',

  /* Take a parsed JSON value and return the configuration it describes,
     or null if it cannot be trusted at all. Every field is optional and
     every number is pulled inside its range; the shape that comes out
     is the same every time, so nothing downstream has to check again.

     `v` is the one field that is required. A file with the wrong
     version, or none, is a file this build does not know how to read,
     and guessing at it is how a renamed key becomes a silent default. */
  validate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (raw.v !== 1) return null;
    const num = v => typeof v === 'number' && isFinite(v) ? v : NaN;
    const out = { v: 1, moves: {}, pay: { coin: 1, treat: 1, nap: 1 }, nap: { from: TUNE_NAP_FROM_DEFAULT }, notice: null };

    if (raw.moves && typeof raw.moves === 'object' && !Array.isArray(raw.moves)) {
      Object.keys(raw.moves).forEach(k => {
        /* a level number, or the daily walk */
        if (!(/^[1-9]\d{0,3}$/.test(k) || k === 'daily')) return;
        const d = Math.round(num(raw.moves[k]));
        if (isNaN(d)) return;
        const c = clamp(d, -TUNE_MOVES_MAX, TUNE_MOVES_MAX);
        if (c) out.moves[k] = c;
      });
    }
    if (raw.pay && typeof raw.pay === 'object') {
      ['coin', 'treat', 'nap'].forEach(k => {
        const m = num(raw.pay[k]);
        if (!isNaN(m)) out.pay[k] = clamp(m, TUNE_MULT_MIN, TUNE_MULT_MAX);
      });
    }
    if (raw.nap && typeof raw.nap === 'object') {
      const f = Math.round(num(raw.nap.from));
      if (!isNaN(f)) out.nap.from = clamp(f, 1, TUNE_NAP_FROM_MAX);
    }
    if (raw.notice && typeof raw.notice === 'object') {
      const n = raw.notice;
      const str = v => typeof v === 'string' ? v.slice(0, TUNE_NOTICE_MAX) : '';
      /* English is the fallback for every string in the game (05-i18n.js
         does the same), so a notice with no English is no notice */
      if (/^\d+(\.\d+){0,2}$/.test(String(n.min || '')) && str(n.en)) {
        out.notice = { min: String(n.min), en: str(n.en), tr: str(n.tr) || str(n.en) };
      }
    }
    return out;
  },

  /* put a configuration in force; false if it was not fit to apply */
  apply(raw, at) {
    const ok = this.validate(raw);
    if (!ok) return false;
    this.data = ok;
    this.at = at || 0;
    return true;
  },

  /* At boot, after loadSave(): the cached copy first, so that the map
     and the first level are drawn with yesterday's numbers rather than
     the compiled ones and then corrected under the player; then the
     fetch, which replaces them when it lands. Re-validated on the way
     out of the save, not trusted because it was written by us: the
     ranges above may be tighter in this build than in the one that
     wrote it. */
  init(io) {
    if (this.started) return;
    this.started = true;
    this.io = io || {};
    if (typeof this.io.version === 'string') this.version = this.io.version;
    try {
      const c = this.io.load ? this.io.load() : null;
      if (c && c.data) this.apply(c.data, +c.at || 0);
    } catch (e) { /* a cached copy is a convenience; nothing waits on it */ }
    this.refresh();
  },

  /* io.on is the same gate telemetry uses (backendOn): nothing from a
     test, nothing from localhost without the debug flag, so the suites
     play the compiled game and not whatever is in the bucket today */
  refresh() {
    const io = this.io || {};
    let on = false;
    try { on = !!(io.url && io.on && io.on() && typeof fetch === 'function'); } catch (e) { on = false; }
    if (!on) return Promise.resolve(false);
    return fetch(io.url, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!j) return false;
        if (!this.apply(j, now())) return false;
        /* the validated copy, not the raw one: what is cached is what
           was applied, so the two can never disagree */
        try {
          if (io.store) io.store({ at: this.at, data: this.data });
        } catch (e) { /* storage full or gone; the fetch still applied */ }
        return true;
      })
      .catch(() => false);
  },

  /* The notice for this build, in the current language, or '' — shown
     only on a build older than `min`. Compared part by part, because
     '1.10.0' is newer than '1.9.0' and a string compare says otherwise.
     Where to show it is the home screen's business; see 60-ui.js. */
  notice() {
    const n = this.data && this.data.notice;
    if (!n) return '';
    const a = String(this.version).split('.').map(Number);
    const b = n.min.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return x < y ? (n[LANG] || n.en) : '';
    }
    return '';
  }
};

/* The move budget a level is actually dealt: the compiled one plus the
   correction for that level, if the file carries one. `n` is a level
   number, or the word 'daily' for the walk: the walk's own level
   number is the data's business, and this file does not name it. The
   floor is the last word. */
function tuneMoves(n, base) {
  const t = TUNE.data;
  if (!t) return base;
  const d = t.moves[String(n)];
  if (!d) return base;
  return Math.max(TUNE_MOVES_FLOOR, base + d);
}
/* A payout through its multiplier, as a whole number. `kind` is 'coin',
   'treat' or 'nap'. Zero stays zero, and anything that paid at all still
   pays at least one: a reward that rounds to nothing reads as a bug. */
function tunePay(kind, n) {
  const t = TUNE.data;
  if (!t || !n) return n;
  const m = t.pay[kind];
  if (!m || m === 1) return n;
  return Math.max(1, Math.round(n * m));
}
/* the level the nap card appears from */
function tuneNapFrom() {
  return TUNE.data ? TUNE.data.nap.from : TUNE_NAP_FROM_DEFAULT;
}
