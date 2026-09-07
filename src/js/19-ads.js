/* ---------- rewarded video, if there is ever any ----------

   There is no advertising in this game and there is no ad SDK in this
   bundle. This file is the shape one would take, built the same way as
   17-billing.js and 18-telemetry.js and for the same reason: so that the
   day somebody decides to wire a network up, it is a change to one
   function rather than a change to the game.

   `plugin` is null. Nothing here opens a socket, loads a script or reads
   an identifier, `available()` answers false for every slot, and every
   button that would offer a video is therefore never drawn. The game
   still works in flight mode and still ships with no runtime dependency.

   WHAT CHANGES THE DAY A PLUGIN IS INSTALLED, and none of it is code:

     - store/LISTING.md says "No advertising" in two languages, twice,
       and the Play Data safety answers below it are all "No".
     - privacy.html says there is no advertising and no third-party SDK,
       in two languages. Every rewarded network collects an advertising
       id; that sentence stops being true the moment one is linked.
     - the content rating declares Ads: none.
     - the listing sells this game on "drawn, not downloaded" and "works
       in flight mode from the first launch". An ad SDK is a network
       dependency and takes both.

   That is not a reason never to do it. It is the reason the decision
   belongs to a person rather than to a merge, and the reason this file
   stops short of making it.

   WHY REWARDED AND NOT INTERSTITIAL. Measured in tools/revenue.js: a
   break between levels costs retention, and retention carries purchases
   and rewarded views as well as its own format, so a forced break pays
   for its lost days three times over. At Turkish eCPMs the whole thing
   comes out negative. A rewarded video is the opposite trade — the
   player asks for it, at a moment they already wanted something. */
const ADS = {
  plugin: null,

  /* One a day, each. A rewarded video is a favour while it is rare and a
     grind the moment it is not, and a player who can watch four in a row
     to skip a wall is a player the difficulty curve no longer describes.
     The cap is also what keeps the offer honest against the shop: it can
     rescue an evening, it cannot replace the jar. */
  caps: { carry: 1, treat: 1 },

  /* What the daily one hands over. Two is a fifth of a carry-on and
     about half a day of ordinary treat income — enough to be worth the
     thirty seconds, nowhere near enough to make the rest of the economy
     a formality. */
  treatReward: 2,

  /* Whether a video could actually be shown. Checked at call time, not
     cached at load: a plugin arrives with the native bridge, which is
     not up yet when this file is read. */
  ready() {
    if (this.plugin) return true;
    const P = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins) || null;
    if (!P) return false;
    this.plugin = P.AdMob || P.RewardedVideo || P.Ads || null;
    return !!this.plugin;
  },

  /* The daily counters live in the save so that closing the game is not
     a way around them, and they roll over on the same day boundary the
     gift ladder uses rather than on a timer of their own. */
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
  available(slot) {
    return this.ready() && this.left(slot) > 0;
  },

  /* Show one, and resolve true only if it was actually watched through.
     A network reports "dismissed" and "no fill" as ordinary outcomes
     rather than as errors, so both land here as false and the caller
     leaves the player exactly where they were — never charged, never
     told off. The counter moves on the reward, not on the attempt,
     because a video that failed to load is not one the player used. */
  async show(slot) {
    if (!this.available(slot)) return false;
    try {
      const r = await this.plugin.showRewardVideoAd({ slot });
      const won = !!(r && (r.rewarded || r.type || r.amount));
      if (!won) return false;
      const st = this.state();
      st.used[slot] = (st.used[slot] || 0) + 1;
      persist(true);
      track('ad_reward', { slot });
      return true;
    } catch (e) {
      return false;
    }
  }
};
