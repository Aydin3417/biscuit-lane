/* Dev-only: walks a new player through 1.4 on a phone, as Pixel 7 with
   touch, photographing each step and collecting every console error.

     node design/concept/walk.js        shots in design/concept/shots/walk-*.png

   First launch, the first level played to a win by the in-game hint, the
   stars it paid spent on a job in the room, the deal of the day bought,
   a level lost and carried on with coins. Fails if anything threw. */
const path = require('path');
const fs = require('fs');
const PW = require('../../tools/_pw.js');
const OUT = path.join(__dirname, 'shots');

(async () => {
  const server = await PW.serve();
  const browser = await PW.launch();
  const ctx = await browser.newContext(Object.assign({}, PW.devices['Pixel 7'], { colorScheme: 'light' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(() => { Date.prototype.getHours = () => 12; Date.prototype.getMinutes = () => 0; });
  await page.goto(PW.at('/pawtika.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save);
  fs.mkdirSync(OUT, { recursive: true });
  let k = 0;
  const shot = async name => { await page.waitForTimeout(900); await page.screenshot({ path: path.join(OUT, 'walk-' + String(++k).padStart(2, '0') + '-' + name + '.png') }); console.log('  shot ' + name); };
  const tapText = async t => { const el = page.locator('button', { hasText: t }).first(); await el.tap(); };
  const ev = (fn, arg) => page.evaluate(fn, arg);

  /* 1. first launch */
  await shot('welcome');
  await tapText('Next'); await page.waitForTimeout(500);
  await tapText('Bring them home'); await page.waitForTimeout(800);
  await shot('name');
  await tapText('Play the first level'); await page.waitForTimeout(1500);
  await shot('level1');

  /* 2. play level 1 to the end, a hinted move at a time */
  const result = await ev(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let n = 0;
    for (let w = 0; w < 100 && BL.game.busy; w++) await sleep(60);
    while (!BL.game.over && n++ < 60) {
      const h = BL.bestHint && BL.bestHint();
      const m = h ? [h.a || h[0], h.b || h[1]] : (BL.allMoves(BL.game.B)[0] || null);
      if (!m) break;
      await BL.tryMove(m[0], m[1]);
      for (let w = 0; w < 100 && BL.game.busy; w++) await sleep(60);
      await sleep(120);
    }
    await sleep(1500);
    return { over: BL.game.over, moves: n, stars: BL.save.stars[1] || 0, home: BL.save.home && BL.save.home.stars };
  });
  console.log('  level 1:', JSON.stringify(result));
  await shot('win');

  /* 3. home: the stars and a job */
  await ev(() => { document.querySelectorAll('.veil').forEach(v => v.remove()); document.getElementById('modals').innerHTML = ''; BL.setScreen('home'); BL.renderHome(); });
  await shot('home');
  const before = await ev(() => BL.save.home.stars);
  const task = page.locator('[data-task]').first();
  if (await task.count()) { await task.tap(); }
  await page.waitForTimeout(1200);
  const after = await ev(() => ({ stars: BL.save.home.stars, done: Object.keys(BL.save.home.done), placed: BL.save.room.placed }));
  console.log('  job:', before, '->', JSON.stringify(after));
  await shot('job');

  /* 4. shop: the deal of the day */
  await ev(() => { BL.save.coins = 600; BL.persist(true); });
  await page.locator('.tab', { hasText: 'Shop' }).tap(); await page.waitForTimeout(800);
  await shot('shop');
  const coins0 = await ev(() => BL.save.coins);
  const deal = page.locator('#dealBuy');
  if (await deal.count()) await deal.tap();
  await page.waitForTimeout(800);
  console.log('  deal:', coins0, '->', await ev(() => ({ coins: BL.save.coins, deal: BL.save.deal })));
  await shot('deal');

  /* 5. a level lost close to the goal, carried on with coins */
  await ev(async () => {
    BL.save.coins = 900; BL.save.hearts = 5; BL.persist(true);
    BL.startLevel(2, { perks: [] }); BL.setScreen('game'); BL.layoutBoard();
    await new Promise(r => setTimeout(r, 700));
    BL.game.goals.forEach(g => { g.have = Math.floor(g.need * .8); });
    BL.syncGoals(); BL.game.moves = 0; BL.game.over = true; BL.showLose();
  });
  await shot('lose');
  const ec = page.locator('#lCoins');
  const c0 = await ev(() => BL.save.coins);
  if (await ec.count()) await ec.tap();
  await page.waitForTimeout(900);
  console.log('  carry on:', c0, '->', await ev(() => ({ coins: BL.save.coins, moves: BL.game.moves, over: BL.game.over })));
  await shot('carried');

  console.log(errors.length ? '\nERRORS:\n  ' + errors.join('\n  ') : '\nno errors on the walk');
  await browser.close();
  if (server && server.stop) server.stop();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
