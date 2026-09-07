/* ============================================================
   16 — the two things worth interrupting somebody for
   ============================================================

   This game shipped with no way of ever reaching a player who had put it
   down. Not a thin one — none. A phone game with no notification is a
   phone game that is played until the day somebody forgets it exists,
   and then never again, and nothing anywhere records which day that was.

   That is a retention problem and it is also, indirectly, the whole
   revenue problem: purchases, the season book and the jar all scale with
   days played, and days played is exactly what a forgotten app stops
   accumulating.

   WHAT THIS WILL AND WILL NOT SEND.

   Two, and only ever two, and both are the game finishing a sentence it
   already started:

     the hearts came back    — sent only to somebody who was actually
                               stopped by the wall and told they would
                               have to wait. It is the end of a wait they
                               were shown a countdown for.

     the walk is waiting     — the daily walk, once, the morning after a
                               day it went untaken. Not every morning:
                               the moment it is sent twice to somebody
                               who did not come back the first time, it
                               is a game nagging, and a nagging game gets
                               its notifications turned off at the system
                               level, which takes the useful one with it.

   No streak-loss threats, no "we miss you", no offers, nothing timed to
   a sale. A notification that sells something is the reason people
   switch them off for a whole category of app.

   WHEN IT ASKS. Not at boot. A permission dialog on first launch, before
   the player knows what the game is, is a dialog that gets declined —
   and on both platforms a decline is close to permanent, so the cheapest
   possible moment to ask is also the worst. It asks at the one moment
   the answer is obviously yes: the player has just run out of hearts and
   been shown a two-hour countdown. That is the sentence a notification
   finishes, and it is the only place in the game this is raised.

   Nothing here reaches a network. A local notification is scheduled by
   the operating system on the device and delivered by it; there is no
   server, no push token, no identifier, and the Play data-safety answer
   and privacy.html are both unchanged by this file. Guarded on the
   bridge, so in a browser it registers nothing, schedules nothing and
   costs nothing. */

const NOTIFY = {
  plugin: null,
  /* Fixed ids rather than generated ones: scheduling the same id twice
     replaces rather than stacks, which is what makes "cancel and
     reschedule on every heart tick" safe to call as often as it likes. */
  ids: { hearts: 1001, walk: 1002 },
  asked: false,

  ready() {
    if (this.plugin) return true;
    const P = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins) || null;
    if (!P) return false;
    this.plugin = P.LocalNotifications || null;
    return !!this.plugin;
  },

  /* The player's own switch, which is a different question from the
     system's. Somebody who said yes to the operating system and then
     turned these off in settings has said no, and the system permission
     is not a licence to ignore that. */
  on() {
    return !!(SAVE && SAVE.settings && SAVE.settings.notify);
  },

  /* Ask, once, and never again in this install — a second dialog after a
     decline is not allowed to show on either platform anyway, so asking
     again only produces a silent no that the code then has to guess at.
     Resolves true if there is permission afterwards, however it got
     there. */
  async ask() {
    if (!this.ready() || this.asked) return this.on();
    this.asked = true;
    try {
      let s = await this.plugin.checkPermissions();
      if (!s || s.display !== 'granted') s = await this.plugin.requestPermissions();
      const ok = !!(s && s.display === 'granted');
      SAVE.settings.notify = ok;
      persist(true);
      track('notify_ask', { ok: ok });
      return ok;
    } catch (e) { return false; }
  },

  async cancel(which) {
    if (!this.ready()) return;
    try { await this.plugin.cancel({ notifications: [{ id: this.ids[which] }] }); } catch (e) { }
  },

  /* One notification, at a wall-clock moment. Anything already at that
     id is replaced, and a time already past is simply not scheduled —
     the operating systems disagree about what to do with one of those
     and none of the answers is "nothing", which is the only acceptable
     one here.

     `isExactNotification: false` IS THE WHOLE OF THIS COMMENT.

     Without it, on any phone running Android 12 or newer, turning
     Reminders on threw the player out of the game and into Android's
     "Alarms & reminders" settings screen — a page about battery use —
     for agreeing to be told their hearts had come back. Twice, because
     the sheet asks and then the resume re-syncs.

     The flag defaults to true, and true means "this is an alarm": the
     plugin asks for SCHEDULE_EXACT_ALARM, finds the app has not declared
     it, and opens the settings page to beg for it. Declaring the
     permission is not the fix — Play restricts it to alarm clocks and
     calendars and a puzzle game would not get it past review.

     False is not a workaround, it is the correct description. Nothing
     here is time-critical: "some time around ten" is the entire
     requirement, and an inexact alarm delivered on the phone's next wake
     is exactly right for a reminder that a walk is waiting.

     Found on an emulator in four minutes. No browser and no test in this
     repository could have found it, because none of them has a plugin
     behind the seam. */
  async at(which, when, title, body) {
    if (!this.ready() || !this.on()) return;
    if (!(when > Date.now() + 30000)) return;
    try {
      await this.plugin.schedule({
        notifications: [{
          id: this.ids[which],
          title: title,
          body: body,
          isExactNotification: false,
          schedule: { at: new Date(when) }
        }]
      });
    } catch (e) { }
  },

  /* ---------- the two ----------

     Both are recomputed rather than remembered, and both are cancelled
     before they are set, so the state of the queue is a function of the
     save rather than a history of what this function has done. Called
     whenever the game is put down, which is the only moment either
     answer can still be wrong.

     The heart one is scheduled from the same arithmetic the countdown on
     screen uses, so the notification and the number the player was
     looking at cannot disagree. */
  async sync() {
    if (!this.ready()) return;
    if (!this.on()) { this.cancel('hearts'); this.cancel('walk'); return; }

    this.cancel('hearts');
    if (SAVE.hearts <= 0) {
      /* At a full pool rather than at the first heart, and that is a
         choice rather than an oversight. The first one lands twenty-five
         minutes later and buys a single level — which, at a clear rate
         of four in five, is one level in five a session that ends
         exactly where it started, stopped again with nothing to do about
         it. A full set is about two hours, which is a sitting, and two
         hours is also the difference between a game that reminds you and
         a game that pesters you. */
      const full = now() + heartsIn() + (HEART_MAX - 1) * HEART_REFILL;
      this.at('hearts', full, T('note_hearts_t'), T('note_hearts_s'));
    }

    /* Ten in the morning, and ONLY for somebody who let today's walk go
       — early enough to be the day's first idle moment, late enough not
       to be an alarm clock.

       The condition is the whole of the difference between a reminder
       and a nag. A player who walks every day never sees this at all,
       which is correct: they have the habit, and telling somebody about
       a thing they have already done is how an app teaches its user that
       its notifications are not worth reading. */
    this.cancel('walk');
    if (!dailyState().done) {
      const d = new Date();
      d.setHours(10, 0, 0, 0);
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
      this.at('walk', d.getTime(), T('note_walk_t'), T('note_walk_s'));
    }
  }
};
