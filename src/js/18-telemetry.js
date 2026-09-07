/* ============================================================
   18 — telemetry: what the game knows about how it is going
   ============================================================

   The game shipped with no measurement of any kind. Not a thin one —
   none: no analytics, no crash capture, nothing that could answer "how
   far did people get" or "did it fall over on somebody's phone". A
   thousand installs would have produced a thousand silences.

   This is the seam for it, built the same way as 17-billing.js and for
   the same reason: the shape exists so that choosing a vendor is a
   change to one function rather than to the game. Nothing here talks to
   a network. There is no endpoint, no key, no third-party script, and
   the bundle still has no runtime dependency — `sink` is null and
   events go into a ring buffer on the device and nowhere else.

   Two rules underneath, and they are not negotiable when a sink does
   get wired up:

     Nothing identifying ever goes in. No pet names, no free text, no
     device id, no ad id. `install` is a random number this file makes
     up, it lives only in the save, and wiping the save forgets it.

     The player can turn it off, and off means nothing is queued rather
     than queued-but-unsent. That is what makes the Play data-safety
     answer "no data collected" honest while there is no sink, and what
     makes it truthful afterwards.
*/

const TELEMETRY_MAX = 300;        /* events held before the oldest drop */
const TELEMETRY_KEY = 'pawtika-events';
const OLD_TELEMETRY_KEY = 'biscuit-lane-events';   /* before the rename */

const TRACK = {
  /* ---------- the seam ----------

     Assign a function here and every buffered event, and everything
     after it, is handed over. It takes an array and returns a promise
     resolving true when the batch is safely away; anything else and the
     batch stays in the buffer to go again next time.

       TRACK.sink = async batch => {
         const r = await fetch(MY_ENDPOINT, {
           method: 'POST', headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ events: batch })
         });
         return r.ok;
       };

     Wiring one is the point at which this stops being local, so it is
     also the point at which the privacy policy and the Play data-safety
     form have to say so. */
  sink: null,

  buf: [],
  install: 0,
  session: 0,
  t0: 0,
  ready: false,

  on() {
    /* no sink means nothing leaves the device, but the switch still
       governs whether anything is even written down */
    return !!(SAVE && SAVE.settings && SAVE.settings.telemetry !== false);
  },

  init() {
    if (this.ready) return;
    this.ready = true;
    this.t0 = now();
    this.session = Math.floor(Math.random() * 1e9);
    if (!SAVE.install) SAVE.install = Math.floor(Math.random() * 1e12);
    this.install = SAVE.install;
    try {
      /* The buffer carried the old name until this build. Adopted the
         same way the save is, and for the same reason — a crash report
         from before the rename is still a crash report. See
         adoptOldName() in 15-save.js; this is the half that belongs to
         this file, so the save layer does not have to name a constant
         declared below it. */
      const stale = localStorage.getItem(OLD_TELEMETRY_KEY);
      if (stale) {
        if (!localStorage.getItem(TELEMETRY_KEY)) localStorage.setItem(TELEMETRY_KEY, stale);
        localStorage.removeItem(OLD_TELEMETRY_KEY);
      }
      const held = localStorage.getItem(TELEMETRY_KEY);
      if (held) this.buf = JSON.parse(held) || [];
    } catch (e) { this.buf = []; }
    /* Anything the game throws, caught where it lands.

       The board swallows a lot on purpose — a broken sound must not
       stop a level — so an exception can happen and leave no trace at
       all. These two are the only places it cannot hide. */
    window.addEventListener('error', e => {
      TRACK.fail('error', e && e.message, e && e.filename, e && e.lineno);
    });
    window.addEventListener('unhandledrejection', e => {
      const r = e && e.reason;
      TRACK.fail('reject', r && (r.message || String(r)), r && r.stack);
    });
  },

  /* An event is a name, a few numbers, and when. Values are coerced:
     a number stays a number, a short token stays a token, and anything
     else is dropped rather than guessed at — which is how a pet's name
     would otherwise have found its way into a payload. */
  track(name, props) {
    if (!this.on() || !this.ready) return;
    const e = { e: name, t: now() - this.t0, s: this.session };
    if (props) Object.keys(props).forEach(k => {
      const v = props[k];
      if (typeof v === 'number' && isFinite(v)) e[k] = Math.round(v * 100) / 100;
      else if (typeof v === 'boolean') e[k] = v ? 1 : 0;
      else if (typeof v === 'string' && v.length <= 24 && /^[\w.:-]+$/.test(v)) e[k] = v;
    });
    this.buf.push(e);
    if (this.buf.length > TELEMETRY_MAX) this.buf.splice(0, this.buf.length - TELEMETRY_MAX);
    this.save();
  },

  /* Failures carry a trimmed message and no stack beyond the first
     frame: a stack is where file paths and, on some devices, usernames
     live. The line number is enough to find it in a build you made. */
  fail(kind, msg, where, line) {
    if (!this.on() || !this.ready) return;
    this.buf.push({
      e: 'fail', k: kind, t: now() - this.t0, s: this.session,
      m: String(msg || '').slice(0, 120),
      w: String(where || '').split('/').pop().slice(0, 40),
      l: +line || 0
    });
    if (this.buf.length > TELEMETRY_MAX) this.buf.shift();
    this.save();
  },

  save() {
    try { localStorage.setItem(TELEMETRY_KEY, JSON.stringify(this.buf)); } catch (e) { }
  },

  /* Hand the buffer over, if there is anywhere to hand it. Failure is
     silent and keeps the batch: a game does not owe the player a
     message about its own bookkeeping. */
  async flush() {
    if (!this.sink || !this.buf.length || !this.on()) return false;
    const batch = this.buf.slice(0, 120);
    try {
      const ok = await this.sink(batch.map(e =>
        Object.assign({ i: this.install, v: APP_VERSION }, e)));
      if (ok !== true) return false;
      this.buf = this.buf.slice(batch.length);
      this.save();
      return true;
    } catch (e) { return false; }
  },

  /* What the buffer holds, for the settings screen and for anyone
     wanting to read it off a device before a sink exists. */
  dump() { return this.buf.slice(); },
  clear() { this.buf = []; this.save(); }
};

/* The shorthand the rest of the game calls. A free function because
   `TRACK.track(...)` at two hundred call sites reads like bookkeeping,
   and this is meant to disappear into the line it sits on. */
function track(name, props) { TRACK.track(name, props); }
