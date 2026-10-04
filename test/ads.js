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
*/
const { launch, at, serve } = require('../tools/_pw.js');

const mock = mode => `
  window.__ad = { mode: ${JSON.stringify(mode)}, prepared: 0, shown: 0, listeners: {} };
  const AdMob = {
    initialize: async () => {},
    requestConsentInfo: async () => ({ status: 'NOT_REQUIRED', isConsentFormAvailable: false }),
    showConsentForm: async () => ({}),
    trackingAuthorizationStatus: async () => ({ status: 'authorized' }),
    requestTrackingAuthorization: async () => {},
    prepareRewardVideoAd: async () => {
      __ad.prepared++;
      if (__ad.mode === 'nofill') throw new Error('Loading failed');
      return { adUnitId: 'x' };
    },
    addListener: async (ev, fn) => { (__ad.listeners[ev] = __ad.listeners[ev] || []).push(fn); return { remove() { __ad.listeners[ev] = __ad.listeners[ev].filter(f => f !== fn); } }; },
    /* as on iOS: resolves when a reward is earned, and never otherwise */
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

  for (const mode of ['nofill', 'watched', 'closed']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(mock(mode));
    await page.goto(at('/pawtika.html'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.BL && window.BL.ADS, null, { timeout: 20000 });
    await page.waitForTimeout(600);
    const before = await page.evaluate(() => ({ avail: BL.ADS.available('carry'), prepared: __ad.prepared, inited: BL.ADS.inited }));
    console.log(mode);
    if (mode === 'nofill') {
      ok(before.inited && before.prepared >= 1, 'the SDK was started and a video asked for', before);
      ok(before.avail === false, 'no video, so no slot is offered', before);
      const r = await page.evaluate(() => BL.ADS.show('carry'));
      ok(r === false, 'and show() answers false', r);
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
    ok(errors.length === 0, 'nothing threw in the page', errors);
    await page.close();
  }
  await browser.close();
  srv.stop();
  console.log(bad ? '\n' + bad + ' failed' : '\nthe videos behave');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
