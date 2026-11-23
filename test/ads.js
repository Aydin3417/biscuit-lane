/* The rewarded video, against a plugin that behaves the way AdMob's does.

     node test/ads.js

   There is no phone in this repository's tests and no ad network either,
   and the three ways a video can go are exactly the ones nobody would
   find by reading: a unit with nothing to serve, a video watched to the
   end, and a video closed early — where the real iOS plugin's show call
   never resolves at all (see the header of src/js/19-ads.js). So the game
   is loaded with a stand-in for Capacitor's AdMob plugin and asked.

   What is held to:
     no fill      no slot is offered, so no button is drawn
     watched      show() answers true, once, and the day's count moves
     closed early show() answers false, promptly, and nothing is counted
     the funnel   a failed load says AdMob's code, a drawn button says
                  ad_offer, a slot with no video says ad_miss — the
                  events v_ads reads (14 Nov 2026)
     the break    the between-levels interstitial keeps every one of its
                  rules: no unit no break, never before its level, never
                  on install day, never for a payer, never twice inside
                  the gap, never on top of a chest
     a slow load  a card that wanted a video while one was loading is
                  told so ('loading', not 'fill') and draws its button
                  when the load lands; a video past fifty minutes is
                  thrown away and another asked for; the level card's
                  video puts a rocket on the board (1.5, 23 Nov 2026)
*/
const { launch, at, serve } = require('../tools/_pw.js');

const mock = mode => `
  window.__ad = { mode: ${JSON.stringify(mode)}, prepared: 0, shown: 0, listeners: {}, calls: [], att: 'notDetermined', attAsked: 0 };
  const AdMob = {
    initialize: async () => { __ad.calls.push('init'); },
    requestConsentInfo: async () => { __ad.calls.push('consent'); return { status: 'NOT_REQUIRED', isConsentFormAvailable: false, canRequestAds: true }; },
    showConsentForm: async () => ({}),
    /* 'att' mode plays iOS declining to show the prompt the first time
       (the app not yet active): the status stays undetermined */
    trackingAuthorizationStatus: async () => ({ status: __ad.mode === 'att' ? __ad.att : 'authorized' }),
    requestTrackingAuthorization: async () => { __ad.calls.push('att'); __ad.attAsked++; if (__ad.mode === 'att' && __ad.attAsked >= 2) __ad.att = 'authorized'; },
    prepareRewardVideoAd: async () => {
      __ad.calls.push('load');
      __ad.prepared++;
      if (__ad.mode === 'slow') await new Promise(r => setTimeout(r, 1500));
      if (__ad.mode === 'nofill') { const e = new Error('Loading failed'); e.code = 3; throw e; }
      return { adUnitId: 'x' };
    },
    /* NOT async: the native bridge hands the handle back directly, and
       a stand-in that returned a promise hid the bug that broke every
       video on a real phone (19-ads.js, show) */
    addListener: (ev, fn) => { (__ad.listeners[ev] = __ad.listeners[ev] || []).push(fn); return { remove() { __ad.listeners[ev] = __ad.listeners[ev].filter(f => f !== fn); } }; },
    /* as on iOS: resolves when a reward is earned, and never otherwise */
    prepareInterstitial: async () => { __ad.calls.push('inter'); return { adUnitId: 'i' }; },
    showInterstitial: async () => { __ad.inter = (__ad.inter || 0) + 1; setTimeout(() => (__ad.listeners.interstitialAdDismissed || []).slice().forEach(f => f()), 50); },
    showRewardVideoAd: () => new Promise(resolve => {
      __ad.shown++;
      const fire = ev => (__ad.listeners[ev] || []).slice().forEach(f => f({}));
      setTimeout(() => {
        if (__ad.mode === 'watched') { fire('onRewardedVideoAdReward'); resolve({ type: 'coins', amount: 1 }); }
        setTimeout(() => fire('onRewardedVideoAdDismissed'), 60);
      }, 120);
    })
  };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: { AdMob } };
  try { localStorage.setItem('pawtika-debug', '1'); } catch (e) {}
`;

(async () => {
  const srv = await serve();
  const browser = await launch();
  let bad = 0;
  const ok = (cond, name, got) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : '   got ' + JSON.stringify(got))); if (!cond) bad++; };

  for (const mode of ['att', 'nofill', 'watched', 'closed', 'slow']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(mock(mode));
    await page.goto(at('/pawtika.html'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.BL && window.BL.ADS, null, { timeout: 20000 });
    await page.waitForTimeout(600);
    const before = await page.evaluate(() => ({ avail: BL.ADS.available('carry'), prepared: __ad.prepared, inited: BL.ADS.inited }));
    console.log(mode);
    if (mode === 'att') {
      /* The rejection of 30 Oct 2026, 5.1.2(i): the reviewer met the
         consent form at launch and never Apple's prompt, because it
         waited for a video nobody asked for. The prompt comes before any
         ad is loaded now, and if iOS swallowed it, it is asked again
         when the game comes to the front. */
      const calls = await page.evaluate(() => __ad.calls.slice());
      ok(calls.indexOf('att') >= 0 && calls.indexOf('att') < calls.indexOf('load'), "Apple's prompt is asked before the first ad is loaded", calls);
      ok(calls.indexOf('consent') < calls.indexOf('att'), "and after Google's consent form", calls);
      const again = await page.evaluate(async () => { await new Promise(r => setTimeout(r, 2200)); await BL.ADS.resumed(); return { asked: __ad.attAsked, status: __ad.att, personalised: BL.ADS.personalised }; });
      ok(again.asked >= 2 && again.status === 'authorized', 'a prompt iOS did not show is asked again', again);
    } else if (mode === 'slow') {
      const r = await page.evaluate(async () => {
        await new Promise(res => setTimeout(res, 2000));     /* the launch's own load lands */
        BL.ADS.loaded = false; BL.ADS.loading = null;        /* and is spent */
        BL.ADS.preload();                                    /* the next is on its way */
        const offered = BL.ADS.offer('gift');
        const miss = BL.TRACK.buf.filter(e => e.e === 'ad_miss').pop();
        let drawn = 0;
        BL.ADS.later('gift', () => { drawn++; });
        await new Promise(res => setTimeout(res, 2200));
        const late = BL.TRACK.buf.filter(e => e.e === 'ad_offer').pop();
        /* a video loaded an hour ago is no video */
        const before = __ad.prepared;
        BL.ADS.loadedAt = Date.now() - 51 * 60000;
        const stale = BL.ADS.available('gift');
        return { offered, miss, drawn, late, stale, reasked: __ad.prepared > before };
      });
      ok(r.offered === false && r.miss && JSON.stringify(r.miss).includes('loading'), "a slot asked while a video loads is a miss 'loading', not 'fill'", r.miss);
      ok(r.drawn === 1 && r.late && JSON.stringify(r.late).includes('late'), 'and its button is drawn when the video lands', r);
      ok(r.stale === false && r.reasked, 'a video loaded fifty minutes ago is not offered, and another is asked for', r);
      const rk = await page.evaluate(() => {
        BL.save.winRun = 0;
        const count = () => { let n = 0; for (let y = 0; y < BL.game.B.h; y++) for (let x = 0; x < BL.game.B.w; x++) { const t = BL.game.B.cell[y][x].tile; if (t && t.sp) n++; } return n; };
        BL.startLevel(3, { perks: [] }); const plain = count();
        BL.startLevel(3, { perks: [], adRockets: 1 }); const boosted = count();
        return { plain, boosted };
      });
      ok(rk.boosted === rk.plain + 1, "the level card's video puts one rocket on the board", rk);
    } else if (mode === 'nofill') {
      ok(before.inited && before.prepared >= 1, 'the SDK was started and a video asked for', before);
      ok(before.avail === false, 'no video, so no slot is offered', before);
      const r = await page.evaluate(() => BL.ADS.show('carry'));
      ok(r === false, 'and show() answers false', r);
      const ev = await page.evaluate(() => { BL.ADS.offer('double'); return BL.TRACK.buf.slice(); });
      const load = ev.find(e => e.e === 'ad_load');
      const miss = ev.find(e => e.e === 'ad_miss');
      ok(load && JSON.stringify(load).includes('"code":"3"'), "a failed load is reported with AdMob's code", ev.slice(-4));
      ok(miss && JSON.stringify(miss).includes('fill'), 'a slot with no video is reported as a miss for want of fill', ev.slice(-4));
    } else {
      ok(before.avail === true, 'a loaded video is offered', before);
      const t0 = Date.now();
      const r = await page.evaluate(async () => {
        const res = await BL.ADS.show('carry');
        return { res, used: BL.ADS.state().used.carry || 0, shown: __ad.shown, left: BL.ADS.left('carry') };
      });
      const ms = Date.now() - t0;
      if (mode === 'watched') {
        ok(r.res === true, 'watched to the end: show() answers true', r);
        ok(r.used === 1, 'and the day\'s count moves by one', r);
      } else {
        ok(r.res === false, 'closed early: show() answers false', r);
        ok(r.used === 0, 'and nothing is counted', r);
        ok(ms < 5000, 'without waiting on a call that never returns (' + ms + ' ms)', ms);
      }
      const again = await page.evaluate(async () => { await new Promise(r => setTimeout(r, 300)); return { avail: BL.ADS.available('carry'), prepared: __ad.prepared }; });
      ok(again.prepared >= 2 && again.avail === true, 'the next video is loaded behind it', again);
    }
    if (mode === 'watched') {
      /* the break, rule by rule */
      const b = await page.evaluate(async () => {
        const A = BL.ADS, S = BL.save, out = {};
        out.noUnit = await A.breakAfterWin(40);
        A.interUnit = () => 'unit';
        A.inter.loaded = true; A.lastShown = 0; A.inter.wins = 5;
        const created = S.created, granted = S.granted;
        S.created = Date.now();
        out.installDay = A.breakDue(40);
        S.created = Date.now() - 3 * 86400000;
        out.early = A.breakDue(12);
        S.granted = { tx: 1 };
        out.payer = A.breakDue(40);
        S.granted = {};
        out.due = A.breakDue(40);
        out.quiet = await A.breakAfterWin(40, true);
        out.shown = await A.breakAfterWin(40);
        A.inter.loaded = true; A.inter.wins = 9;
        out.gap = A.breakDue(40);
        A.lastShown = 0; A.inter.wins = 1;
        out.tooSoon = A.breakDue(40);
        out.count = __ad.inter || 0;
        /* the count is the save's, so a win before closing the app
           still counts after it opens again */
        A.inter.wins = 2;
        out.inSave = S.adWins;
        S.adWins = 1;
        out.fromSave = A.inter.wins;
        S.created = created; S.granted = granted;
        return out;
      });
      ok(b.noUnit === false, 'no interstitial unit, no break', b);
      ok(b.installDay === false, 'never on the day of install', b);
      ok(b.early === false, 'never before level 20', b);
      ok(b.payer === false, 'never for a player who has paid', b);
      ok(b.due === true, 'due after enough wins, past its level, outside the gap', b);
      ok(b.quiet === false, 'never on top of a chest or a stage-up', b);
      ok(b.shown === true && b.count === 1, 'shown once when due', b);
      ok(b.gap === false, 'never twice inside the gap', b);
      ok(b.tooSoon === false, 'never before enough wins', b);
      ok(b.inSave === 2 && b.fromSave === 1, 'the count of wins is kept in the save, across launches', b);
    }
    ok(errors.length === 0, 'nothing threw in the page', errors);
    await page.close();
  }
  await browser.close();
  srv.stop();
  console.log(bad ? '\n' + bad + ' failed' : '\nthe videos behave');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
