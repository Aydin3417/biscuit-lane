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
     2. On iOS, Apple's tracking prompt (ATT), the first time a video is
        actually asked for — not at launch, where it would read as the
        price of opening the app.
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
  testAndroid: 'ca-app-pub-3940256099942544/5224354917'
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
       double  the coins of a first clear, again, on the win card */
  caps: { carry: 3, treat: 2, heart: 3, double: 3 },

  treatReward: 2,

  inited: false,
  initing: null,
  personalised: false,
  asked: false,
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
        } catch (e) { /* no form, or no network: non-personalised it is */ }
        this.inited = true;
        this.preload();
        return true;
      } catch (e) {
        TRACK.fail('ads_init', e && e.message);
        return false;
      } finally { this.initing = null; }
    })();
    return this.initing;
  },

  /* Apple's prompt, once ever, and only when a video is first wanted.
     Declined or unavailable, videos are still shown, non-personalised. */
  async askTracking() {
    if (nativePlatform() !== 'ios') { this.personalised = true; return; }
    try {
      let st = await this.plugin.trackingAuthorizationStatus();
      if (st && st.status === 'notDetermined' && !SAVE.attAsked) {
        SAVE.attAsked = true; persist(true);
        await this.plugin.requestTrackingAuthorization();
        st = await this.plugin.trackingAuthorizationStatus();
      }
      this.personalised = !!(st && st.status === 'authorized');
    } catch (e) { this.personalised = false; }
  },

  /* A video loaded ahead, so the button does not sit there for three
     seconds after it is pressed. One at a time; a failed load is simply
     tried again next time. */
  preload() {
    if (this.loading || !this.inited) return this.loading;
    this.loaded = false;
    this.loading = this.plugin.prepareRewardVideoAd({ adId: this.unit(), isTesting: this.testing(), npa: !this.personalised })
      .then(() => { this.loaded = true; return true; }, () => {
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

  /* Show one; resolve true only if it was watched through. A network
     reports "dismissed" and "no fill" as ordinary outcomes rather than
     errors, so both land here as false and the caller leaves the player
     exactly where they were — never charged, never told off. The counter
     moves on the reward, not on the attempt. */
  async show(slot) {
    if (!this.available(slot)) return false;
    if (!await this.init()) return false;
    const A = this.plugin;
    if (!this.asked) { this.asked = true; await this.askTracking(); }
    const handles = [];
    let rewarded = false;
    try {
      const loaded = await (this.loading || this.preload());
      this.loading = null;
      this.loaded = false;
      if (!loaded) return false;
      const over = new Promise(res => {
        const on = (ev, fn) => A.addListener(ev, fn).then(h => handles.push(h));
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
    if (!rewarded) return false;
    const st = this.state();
    st.used[slot] = (st.used[slot] || 0) + 1;
    persist(true);
    track('ad_reward', { slot });
    return true;
  }
};
