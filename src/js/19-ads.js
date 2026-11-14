/* ---------- rewarded video ----------

   Rewarded only. The player asks for every video, at a moment they
   already wanted something, and nothing in the game ever interrupts a
   level, a menu or a win with one. tools/revenue.js measured the other
   trade — a forced break between levels — and it cost more in lost days
   than it paid, three times over at Turkish eCPMs.

   Decided on 30 Sep 2026, by the owner, after this file had spent a
   month as an empty seam: the game carries AdMob's rewarded format
   through @capacitor-community/admob, and nothing else. What that
   changed outside this file, all of it by hand:

     - privacy.html names Google as a third party and says what the
       advertising id is used for, in both languages.
     - store/LISTING.md: "Contains ads", Data safety and App Privacy
       answers for Device ID / advertising data, the content rating.
     - ios/App/App/Info.plist: GADApplicationIdentifier, the tracking
       usage description, and the SKAdNetwork identifiers Google lists.
     - android manifest: the AdMob application id meta-data.

   AD_UNITS below is where the ids go. Empty, the whole thing is off:
   available() answers false, no button offering a video is drawn, the
   SDK is never initialised, and the game is exactly the game it was.

   THE ORDER THINGS HAPPEN IN, because each is a legal requirement:
     1. Google's consent form (UMP), only where the law asks for one —
        the EEA, the UK, and the US states that regulate this.
     2. On iOS, Apple's tracking prompt (ATT), straight after it — before
        the SDK loads a single video. 1.2.0 asked only when a video was
        first wanted, and App Review rejected it under 5.1.2(i) on
        30 Oct 2026: the reviewer met Google's form at launch, which says
        the app tracks, and never met Apple's, because they never pressed
        a video. Apple's reading is that a launch that can track must ask
        at launch.
     3. The video, personalised only if both said yes.

   A VIDEO THAT DOES NOT FINISH PAYS NOTHING. On iOS the plugin's show
   call resolves only when a reward is earned; closed early, it never
   resolves at all. So a video is judged by events — rewarded, then
   dismissed — and not by the call returning. Awaiting the call alone
   would have hung the lose card for ever on the first skipped video. */
const AD_UNITS = {
  /* "Pawtika Rewarded iOS" and "Pawtika Rewarded Android", created
     3 Oct 2026 in the AdMob account ca-app-pub-3062307440336080. The
     app ids that go with them are in Info.plist and AndroidManifest.xml. */
  ios: 'ca-app-pub-3062307440336080/1673274319',
  android: 'ca-app-pub-3062307440336080/8565985721',
  /* Google's published test units, used instead when `testing` is on.
     A build shipped with testing on shows "Test Ad" banners and earns
     nothing, which is safe; one shipped with real ids and testing on is
     a policy strike, so testing is on only in a debuggable build. */
  testIos: 'ca-app-pub-3940256099942544/1712485313',
  testAndroid: 'ca-app-pub-3940256099942544/5224354917',
  /* The between-levels break (see ADS.breakAfterWin). Empty, it is off:
     no unit is ever asked for and the game is the rewarded-only game it
     shipped as. Filling these in is the owner's decision, made in the
     AdMob console by creating an Interstitial unit — the code waits for
     it rather than deciding it. */
  interIos: '',
  interAndroid: '',
  testInterIos: 'ca-app-pub-3940256099942544/4411468910',
  testInterAndroid: 'ca-app-pub-3940256099942544/1033173712'
};

const ADS = {
  plugin: null,

  /* A day's allowance per slot. Rare enough to stay a favour and never
     the way through a wall: a player who could watch six in a row to
     carry on a level is a player the difficulty curve no longer
     describes, and one who could farm treats would never open the jar.
       carry   three moves on the lose card, once per attempt
       treat   two treats, from the earn-treats sheet
       heart   one heart, from the out-of-hearts sheet
       double  the coins of a first clear, again, on the win card

     RAISED, 14 Nov 2026, two weeks into the store. The owner's first
     complaint was that videos almost never appeared, and the arithmetic
     agreed: a player who wins — and test/all-levels.js has a player who
     cannot see a cascade winning 83-93% of the first sixty levels —
     never meets the carry, the heart or the treat sheet, so the whole
     day's offer was three "double your coins" buttons. Every cap is
     higher, and three slots sit at moments a winning player does reach:
       gift    the daily gift, again
       chest   a gate chest, again
       retry   three moves on the level card, from the second attempt
               at the same level — the moment a player is stuck, which
               is also the moment the curve below means them to be */
  caps: { carry: 5, treat: 3, heart: 5, double: 6, gift: 1, chest: 2, retry: 3 },
  retryMoves: 3,

  treatReward: 2,

  inited: false,
  initing: null,
  personalised: false,
  privacyOptions: false,   // Google says this player must be able to revisit consent
  blocked: false,          // consent says no ad may be requested yet
  loading: null,
  loaded: false,
  retry: null,

  testing() {
    try { return localStorage.getItem('pawtika-debug') === '1'; } catch (e) { return false; }
  },
  unit() {
    const ios = nativePlatform() === 'ios';
    if (this.testing()) return ios ? AD_UNITS.testIos : AD_UNITS.testAndroid;
    return ios ? AD_UNITS.ios : AD_UNITS.android;
  },

  /* Whether a video could actually be shown. Checked at call time: the
     plugin arrives with the native bridge, which is not up when this
     file is read, and a web build never has one. */
  ready() {
    if (!this.unit()) return false;
    if (this.plugin) return true;
    const P = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins) || null;
    this.plugin = (P && P.AdMob) || null;
    return !!this.plugin;
  },

  /* Once per launch, and before the first video: the SDK, then Google's
     consent form where one is required. Never throws; an SDK that will
     not start leaves every slot unavailable, which is the right failure. */
  init() {
    if (this.inited) return Promise.resolve(true);
    if (this.initing) return this.initing;
    if (!this.ready()) return Promise.resolve(false);
    const A = this.plugin;
    this.initing = (async () => {
      try {
        await A.initialize({ initializeForTesting: this.testing() });
        try {
          const info = await A.requestConsentInfo();
          if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') await A.showConsentForm();
          const after = info && info.status === 'REQUIRED' ? await A.requestConsentInfo() : info;
          /* where the law asks for consent it also asks for a way to
             change it later: Settings draws one when this is set */
          this.privacyOptions = !!(after && after.privacyOptionsRequirementStatus === 'REQUIRED');
          /* no ad is asked for until Google's form says one may be */
          if (after && after.canRequestAds === false) this.blocked = true;
        } catch (e) { /* no form, or no network: non-personalised it is */ }
        await this.askTracking();
        /* and once more shortly, for the launch where iOS said nothing
           because the app had not finished coming to the front */
        if (this.attPending) setTimeout(() => this.resumed(), 1500);
        this.inited = true;
        this.preload();
        this.preloadInter();
        return true;
      } catch (e) {
        TRACK.fail('ads_init', e && e.message);
        return false;
      } finally { this.initing = null; }
    })();
    return this.initing;
  },

  /* Apple's prompt, from init(), after Google's form and before any
     video is loaded. iOS itself shows it once ever, so "notDetermined"
     is the whole guard: a save flag would also swallow the case where
     iOS quietly declines to show it (an app not yet active) and leave
     the player never asked. Declined or unavailable, videos are still
     shown, non-personalised. */
  async askTracking() {
    if (nativePlatform() !== 'ios') { this.personalised = true; return; }
    try {
      let st = await this.plugin.trackingAuthorizationStatus();
      if (st && st.status === 'notDetermined') {
        await this.plugin.requestTrackingAuthorization();
        st = await this.plugin.trackingAuthorizationStatus();
      }
      this.personalised = !!(st && st.status === 'authorized');
      /* Still undecided after asking means iOS did not show it — an app
         not yet active when boot asked, or Google's form still on its way
         out. The next time the game comes to the front, it asks again. */
      this.attPending = !!(st && st.status === 'notDetermined');
    } catch (e) { this.personalised = false; }
  },
  attPending: false,
  async resumed() {
    if (!this.attPending || !this.plugin || nativePlatform() !== 'ios') return;
    this.attPending = false;
    const was = this.personalised;
    await this.askTracking();
    /* a video loaded before the answer was loaded non-personalised; one
       loaded after a yes may be personalised */
    if (this.personalised !== was && !this.loading) { this.loaded = false; this.preload(); }
  },

  /* Google's own sheet for changing the consent given earlier. Only
     where Google says it is required, which is where the form was. */
  async privacyChoices() {
    if (!this.plugin || !this.privacyOptions) return false;
    try { await this.plugin.showPrivacyOptionsForm(); return true; } catch (e) { return false; }
  },

  /* A video loaded ahead, so the button does not sit there for three
     seconds after it is pressed. One at a time; a failed load is simply
     tried again next time. */
  /* Every load is counted, with how long it took and, when it failed,
     the code AdMob gave. Until 14 Nov 2026 the only ad event that left
     the phone was a reward, so "videos almost never appear" could not
     be told apart from "videos are never offered": the first is fill
     (code 3, no ad to serve — the state of an app AdMob has not yet
     approved), the second is the game. v_ads in the server views reads
     these. */
  loadFails: 0,
  preload() {
    if (this.loading || !this.inited || this.blocked) return this.loading;
    this.loaded = false;
    const t0 = Date.now();
    this.loading = this.plugin.prepareRewardVideoAd({ adId: this.unit(), isTesting: this.testing(), npa: !this.personalised })
      .then(() => { this.loaded = true; this.loadFails = 0; track('ad_load', { ok: 1, ms: Date.now() - t0 }); return true; }, e => {
        /* one report per launch for a run of failures, plus the first:
           a phone with no signal would otherwise send one a minute */
        if (this.loadFails++ < 3) track('ad_load', { ok: 0, ms: Date.now() - t0, code: adErrCode(e) });
        this.loading = null;
        /* no fill is the ordinary state of a new ad unit, and of a phone
           with no signal; ask again in a while rather than never */
        if (!this.retry) this.retry = setTimeout(() => { this.retry = null; this.preload(); }, 60000);
        return false;
      });
    return this.loading;
  },

  /* The daily counters live in the save so that closing the game is not
     a way around them, and they roll over on the day boundary the gift
     ladder uses rather than on a timer of their own. */
  state() {
    if (!SAVE.ads) SAVE.ads = { day: 0, used: {} };
    const today = dayNumber();
    if (SAVE.ads.day !== today) { SAVE.ads.day = today; SAVE.ads.used = {}; }
    return SAVE.ads;
  },
  left(slot) {
    const cap = this.caps[slot] || 0;
    return Math.max(0, cap - (this.state().used[slot] || 0));
  },
  /* Only when a video is actually sitting there loaded. A button that
     is drawn because one might load, and then does nothing when pressed
     because none did, is a broken feature to the player and to whoever
     reviews the app — and a new AdMob unit serves nothing at all for its
     first days. No video, no button. */
  available(slot) {
    if (!this.ready() || this.left(slot) <= 0) return false;
    if (!this.inited) { this.init(); return false; }
    return !!this.loaded;
  },
  /* available(), said out loud: what a card asks when it is deciding
     whether to draw a button. A drawn button is an `ad_offer`; a slot
     that wanted one and had no video is an `ad_miss` with the reason,
     which is the number that says whether the network or the game is
     the reason players see so few. A web build has no plugin and says
     nothing. */
  offer(slot) {
    if (!this.ready()) return false;
    if (this.left(slot) <= 0) return false;
    const yes = this.available(slot);
    track(yes ? 'ad_offer' : 'ad_miss', yes ? { slot } : { slot, why: !this.inited ? 'init' : this.blocked ? 'consent' : 'fill' });
    return yes;
  },

  /* Show one; resolve true only if it was watched through. A network
     reports "dismissed" and "no fill" as ordinary outcomes rather than
     errors, so both land here as false and the caller leaves the player
     exactly where they were — never charged, never told off. The counter
     moves on the reward, not on the attempt. */
  async show(slot) {
    if (!this.available(slot)) return false;
    if (!await this.init()) return false;
    track('ad_tap', { slot });
    this.lastShown = Date.now();
    const A = this.plugin;
    const handles = [];
    let rewarded = false;
    try {
      const loaded = await (this.loading || this.preload());
      this.loading = null;
      this.loaded = false;
      if (!loaded) return false;
      const over = new Promise(res => {
        /* Promise.resolve, because the plugins reached through
           window.Capacitor.Plugins hand back the handle itself, not a
           promise of one: the native bridge on both platforms returns
           { remove } straight away. `.then` on that threw, the catch
           below turned it into "not watched", and every video button in
           the game played the error sound and nothing else — seen on the
           emulator on 30 Oct 2026. test/ads.js's stand-in returned a
           promise, which is why it never failed. */
        const on = (ev, fn) => Promise.resolve(A.addListener(ev, fn)).then(h => handles.push(h));
        Promise.all([
          on('onRewardedVideoAdReward', () => { rewarded = true; }),
          on('onRewardedVideoAdDismissed', () => res()),
          on('onRewardedVideoAdFailedToShow', () => res())
        ]).then(() => {
          /* resolves on the reward and never otherwise (see the header) */
          A.showRewardVideoAd().then(() => { rewarded = true; }, () => res());
        });
      });
      /* a video that neither finishes nor closes in three minutes is not
         one the player is watching */
      await Promise.race([over, new Promise(r => setTimeout(r, 180000))]);
    } catch (e) {
      rewarded = false;
    } finally {
      handles.forEach(h => { try { h.remove(); } catch (e) { } });
      this.preload();
    }
    if (!rewarded) { track('ad_unpaid', { slot }); return false; }
    const st = this.state();
    st.used[slot] = (st.used[slot] || 0) + 1;
    persist(true);
    track('ad_reward', { slot });
    return true;
  },

  /* ---------- the between-levels break ----------

     The one ad the player does not ask for, and the header's first
     paragraph is why it waited this long. It runs only when an
     Interstitial unit id has been filled in above, and then only:
       - after a WIN, on the way off the win card, never after a loss
         (a loss already costs a heart; a video on top is a punishment)
       - from level 20 (tunable), past the sixty-level lane's teaching
       - after every third win (tunable), and at least three minutes
         after any other video, rewarded ones included
       - never on the day of install, and never for a player who has
         bought anything: someone who paid has paid
     Every rule is in breakDue(), so the test can read the rules rather
     than the plumbing. */
  inter: { loading: null, loaded: false, wins: 0 },
  lastShown: 0,
  interUnit() {
    const ios = nativePlatform() === 'ios';
    if (this.testing()) return (ios ? AD_UNITS.interIos : AD_UNITS.interAndroid) ? (ios ? AD_UNITS.testInterIos : AD_UNITS.testInterAndroid) : '';
    return ios ? AD_UNITS.interIos : AD_UNITS.interAndroid;
  },
  preloadInter() {
    const I = this.inter;
    if (I.loading || I.loaded || !this.inited || this.blocked || !this.interUnit() || !this.plugin.prepareInterstitial) return;
    I.loading = this.plugin.prepareInterstitial({ adId: this.interUnit(), isTesting: this.testing(), npa: !this.personalised })
      .then(() => { I.loaded = true; I.loading = null; }, e => {
        I.loading = null;
        track('ad_load', { ok: 0, slot: 'break', code: adErrCode(e) });
      });
  },
  breakDue(n) {
    const rule = tuneAds();
    if (!rule.on || !this.interUnit()) return false;
    if ((n || 0) < rule.from) return false;
    if (SAVE.granted && Object.keys(SAVE.granted).length) return false;
    if (SAVE.created && dayNumber(SAVE.created) === dayNumber()) return false;
    if (this.inter.wins < rule.every) return false;
    if (Date.now() - this.lastShown < rule.gap * 1000) return false;
    return true;
  },
  /* Called with the level just won, as the player leaves the win card,
     `quiet` when something else is about to take the screen.
     Resolves when the video is gone (or was never there); never throws,
     never waits more than a minute. */
  async breakAfterWin(n, quiet) {
    this.inter.wins++;
    /* a chest or a pet growing up is already queued behind the card;
       an ad is never stacked on a celebration */
    if (quiet || !this.ready() || !this.inited) return false;
    this.preloadInter();
    if (!this.breakDue(n) || !this.inter.loaded) return false;
    const A = this.plugin;
    const handles = [];
    this.inter.loaded = false;
    this.inter.wins = 0;
    this.lastShown = Date.now();
    try {
      await Promise.race([
        new Promise(res => {
          const on = (ev, fn) => Promise.resolve(A.addListener(ev, fn)).then(h => handles.push(h));
          Promise.all([on('interstitialAdDismissed', () => res()), on('interstitialAdFailedToShow', () => res())])
            .then(() => A.showInterstitial().catch(() => res()));
        }),
        new Promise(r => setTimeout(r, 60000))
      ]);
      track('ad_break', { n: n || 0 });
    } catch (e) { /* the level after is what matters */ }
    finally {
      handles.forEach(h => { try { h.remove(); } catch (e) { } });
      setTimeout(() => this.preloadInter(), 2000);
    }
    return true;
  }
};
function adErrCode(e) {
  if (!e) return 'none';
  /* telemetry keeps short tokens only (18-telemetry.js), so a message
     with spaces in it would arrive as nothing at all */
  const raw = e.code !== undefined ? e.code : (e.message || e);
  return String(raw).replace(/[^\w.:-]+/g, '_').slice(0, 24) || 'none';
}
