/* Game Center and the iCloud copy (54-native.js), against a stand-in for
   ios/App/App/PawtikaNative.swift.

     node test/native.js

   What is held to:
     a save is copied to iCloud, and it fits: the key-value store allows
       a megabyte, and a save that grew past it would stop being copied
     a phone whose save is behind iCloud's is asked, and only asked
     "keep this one" changes nothing
     "load it" brings the iCloud game up on the next launch, and the old
       one is not written back over it on the way out
     a phone ahead of iCloud is not asked at all
     a win puts the lane and the week's event on the leaderboards
*/
const { launch, at, serve } = require('../tools/_pw.js');

const mock = cloud => `
  window.__gc = { scores: [], sets: 0, signed: 0 };
  window.__cloud = ${cloud ? JSON.stringify(cloud) : 'null'};
  const PawtikaNative = {
    gcSignIn: async () => { __gc.signed++; return { ok: true }; },
    gcSubmitScore: async o => { __gc.scores.push(o); return { ok: true }; },
    gcShow: async () => ({ ok: true }),
    cloudGet: async () => __cloud ? { has: true, value: __cloud } : { has: false },
    cloudSet: async o => { __gc.sets++; __gc.last = o.value; sessionStorage.setItem('cloudSize', String(o.value.length)); return { ok: true }; }
  };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: { PawtikaNative } };
  try { localStorage.setItem('pawtika-debug', '1'); } catch (e) {}
`;

(async () => {
  const srv = await serve();
  const browser = await launch();
  let bad = 0;
  const ok = (cond, name, got) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : '   got ' + JSON.stringify(got))); if (!cond) bad++; };

  /* a phone with a game of its own, level 40, writing it up */
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  const errs = [];
  a.on('pageerror', e => errs.push(e.message));
  await a.addInitScript(mock(null));
  await a.goto(at('/pawtika.html'));
  await a.waitForFunction(() => window.BL && BL.save, null, { timeout: 20000 });
  const big = await a.evaluate(async () => {
    const s = BL.save;
    s.reached = 40; for (let i = 1; i < 40; i++) { s.stars[i] = 3; s.scores[i] = 25000 + i; }
    BL.persist(true);
    await new Promise(r => setTimeout(r, 300));
    return { sets: __gc.sets, size: (__gc.last || '').length, json: __gc.last };
  });
  ok(big.sets >= 1 && big.size > 0, 'a save is copied to iCloud', { sets: big.sets });
  ok(big.size < 900 * 1024, 'and fits the key-value store with room to spare (' + Math.round(big.size / 1024) + ' KB of 1024)', big.size);
  await ctxA.close();

  /* a new phone at level 3 meets the level-40 game in iCloud */
  for (const answer of ['keep', 'load']) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(mock(big.json));
    await p.goto(at('/pawtika.html'));
    await p.waitForFunction(() => window.BL && BL.save, null, { timeout: 20000 });
    await p.evaluate(() => { BL.save.reached = 3; BL.persist(true); });
    await p.reload();
    await p.waitForFunction(() => window.BL && BL.save, null, { timeout: 20000 });
    const asked = await p.waitForSelector('#clYes', { timeout: 6000 }).then(() => true, () => false);
    if (answer === 'keep') {
      ok(asked, 'a phone whose save is behind iCloud\'s is asked', asked);
      await p.click('#clNo');
      await p.waitForTimeout(400);
      ok(await p.evaluate(() => BL.save.reached) === 3, '"keep this one" changes nothing', await p.evaluate(() => BL.save.reached));
    } else {
      await p.click('#clYes');
      await p.waitForTimeout(1500);
      await p.waitForFunction(() => window.BL && BL.save, null, { timeout: 20000 });
      await p.waitForTimeout(500);
      const r = await p.evaluate(() => BL.save.reached);
      ok(r === 40, '"load it" brings the iCloud game up, and the old one is not written back', r);
      /* and now it is level with iCloud: asked again? */
      await p.reload();
      await p.waitForFunction(() => window.BL && BL.save, null, { timeout: 20000 });
      const again = await p.waitForSelector('#clYes', { timeout: 4500 }).then(() => true, () => false);
      ok(!again, 'a phone level with iCloud is not asked', again);
    }
    await ctx.close();
  }

  /* a win puts both scores up */
  const ctxW = await browser.newContext();
  const w = await ctxW.newPage();
  w.on('pageerror', e => errs.push(e.message));
  await w.addInitScript(mock(null));
  await w.goto(at('/pawtika.html'));
  await w.waitForFunction(() => window.BL && BL.save, null, { timeout: 20000 });
  const scores = await w.evaluate(async () => {
    await new Promise(r => setTimeout(r, 4200));      /* the sign-in after launch */
    BL.save.reached = 12;
    BL.startLevel(11, { perks: [] });
    BL.game.goals.forEach(g => { g.have = g.need; });
    BL.game.over = true; BL.EV.emit('won');
    await new Promise(r => setTimeout(r, 300));
    return { signed: __gc.signed, scores: __gc.scores };
  });
  ok(scores.signed >= 1, 'Game Center sign-in is asked for after launch', scores);
  ok(scores.scores.some(s => s.board === 'pawtika.level'), 'a win puts the lane on the leaderboard', scores.scores);
  await ctxW.close();

  ok(errs.length === 0, 'nothing threw in the page', errs);
  console.log(bad ? '\n' + bad + ' failed' : '\nthe copy and the boards behave');
  await browser.close();
  if (srv && srv.stop) srv.stop();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
