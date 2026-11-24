/* ---------- Game Center and the iCloud copy (1.5) ----------

   Both through ios/App/App/PawtikaNative.swift, and both silent where
   there is no such plugin — the web, Android, a test page — so the game
   is the same game without them.

   GAME CENTER. Two leaderboards, made in App Store Connect:
     pawtika.level   how far down the lane: the levels cleared
     pawtika.week    the week's event (53-events.js), a recurring board
                     that starts again every Monday, scored by the tiles
                     of the week's breed — so the event has a table to
                     climb, and the table is of real players
   Sign-in is asked for once, a few seconds after launch, and Game
   Center's own sheet does the asking; a player who says no is not asked
   again by the game (iOS stops showing the sheet anyway).

   THE iCLOUD COPY. Every immediate save — a level ending, a purchase,
   the app going into a pocket — is written to iCloud's key-value store
   as well, at most once a minute otherwise. On a phone whose own save is
   behind the copy (a new phone, a reinstall), the game says so and asks
   before taking it: it never replaces a save on its own. */

const GC_BOARDS = { level: 'pawtika.level', week: 'pawtika.week' };

const KIT = {
  plugin: null,
  ready() {
    if (this.plugin) return true;
    const P = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins) || null;
    this.plugin = (P && P.PawtikaNative) || null;
    return !!this.plugin;
  },

  /* ---- Game Center ---- */
  signedIn: false,
  async signIn() {
    if (!this.ready()) return false;
    try {
      const r = await this.plugin.gcSignIn();
      this.signedIn = !!(r && r.ok);
      track('gc_sign_in', { ok: this.signedIn ? 1 : 0 });
    } catch (e) { this.signedIn = false; }
    return this.signedIn;
  },
  submit(board, score) {
    if (!this.ready() || !this.signedIn || !(score > 0)) return;
    try { this.plugin.gcSubmitScore({ board, score: Math.floor(score) }); } catch (e) { }
  },
  show(board) {
    if (!this.ready()) return;
    const go = () => { try { this.plugin.gcShow({ board: board || '' }); } catch (e) { } };
    if (this.signedIn) go(); else this.signIn().then(ok => { if (ok) go(); });
  },

  /* ---- the iCloud copy ---- */
  last: 0,
  every: 60000,
  write(json, force) {
    if (!this.ready()) return;
    const t = now();
    if (!force && t - this.last < this.every) return;
    this.last = t;
    try { this.plugin.cloudSet({ key: SAVE_KEY, value: json }); } catch (e) { }
  },
  async read() {
    if (!this.ready()) return null;
    try {
      const r = await this.plugin.cloudGet({ key: SAVE_KEY });
      if (!r || !r.has || !r.value) return null;
      const d = JSON.parse(r.value);
      return d && typeof d === 'object' ? d : null;
    } catch (e) { return null; }
  }
};

/* How far a save has got, for comparing two of them: the lane first,
   then the stars on it. Equal is "not ahead". */
function saveProgress(s) {
  if (!s) return 0;
  const stars = s.stars ? Object.keys(s.stars).reduce((a, k) => a + (+s.stars[k] || 0), 0) : 0;
  return (+s.reached || 0) * 1000 + stars;
}

/* the save layer says when it wrote (15-save.js persist); the copy goes up */
EV.on('saved', w => KIT.write(w.json, w.immediate));

/* Every win puts both scores up; a player not signed in costs nothing. */
EV.on('won', () => {
  if (!KIT.signedIn) return;
  KIT.submit(GC_BOARDS.level, Math.max(0, (SAVE.reached || 1) - 1));
  if (typeof evOpen === 'function' && evOpen()) KIT.submit(GC_BOARDS.week, evState().got);
});

/* After launch: Game Center, then whether iCloud holds a game further on
   than this one. `offer` is the interface's (60-ui.js): it draws the
   question and, on a yes, hands the copy back to take. */
function nativeBoot(offer) {
  if (!KIT.ready()) return;
  setTimeout(() => { if (SAVE.settings.gc !== false) KIT.signIn(); }, 3500);
  setTimeout(async () => {
    const theirs = await KIT.read();
    if (!theirs || saveProgress(theirs) <= saveProgress(SAVE)) return;
    track('cloud_offer', { theirs: +theirs.reached || 0, ours: +SAVE.reached || 0 });
    offer(theirs);
  }, 1800);
}
/* take the copy: written where the next launch reads it, then a launch */
function takeCloudSave(theirs) {
  track('cloud_take', { n: +theirs.reached || 0 });
  const json = JSON.stringify(theirs);
  try { localStorage.setItem(SAVE_KEY, json); } catch (e) { }
  VAULT.write(json, true);
  /* nothing may write the old game back over it on the way out: the
     page-hide save would otherwise put this phone's save straight back */
  SAVE_WIPED = true;
  setTimeout(() => location.reload(), 150);
}
