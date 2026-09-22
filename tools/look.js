/* Photograph the screens a player actually looks at, on one phone size,
   in both palettes, so an art change is judged on the real thing side by
   side rather than through a preview pane that caches its last frame.

     node tools/look.js [outDir]      ->  shots/look/ by default

   The save is the same one tools/store.js builds: two animals, level 34,
   a room with four things in it. Levels 4, 14 and 22 are the lane's
   first mud, bramble and crate boards, which is every blocker colour the
   board has to keep apart. */
const path = require('path');
const fs = require('fs');
const { launch, at, serve } = require('./_pw.js');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'shots', 'look'));

async function setup(page) {
  await page.waitForFunction(() => window.BL && window.BL.save, null, { timeout: 20000 });
  await page.evaluate(() => {
    BL.save.pets = [BL.makePet(2, 1, 0, 'Marlow'), BL.makePet(0, 0, 0, 'Biscuit')];
    BL.save.activePet = BL.save.pets[0].id;
    const S = BL.save;
    S.reached = 34; S.coins = 1240; S.treats = 11;
    for (let i = 1; i < 34; i++) S.stars[i] = 2 + (i % 2);
    S.furniture = { rug: 1, plant: 1, shelf: 1, lamp: 1 };
    S.room = { theme: 'oat', placed: ['rug', 'plant', 'shelf', 'lamp'] };
    S.pets.forEach(p => { p.bond = 9; p.food = 62; p.joy = 84; p.clean = 70; p.energy = 45; p.asleep = false; });
    BL.persist(true);
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save.pets.length);
}

const clear = page => page.evaluate(() => {
  const m = document.getElementById('modals');
  if (m) m.innerHTML = '';
  document.querySelectorAll('.veil').forEach(v => v.remove());
});

async function board(page, n) {
  await page.evaluate(n => { BL.startLevel(n, { perks: [] }); BL.setScreen('game'); BL.layoutBoard(); }, n);
  await page.waitForTimeout(600);
  await clear(page);
  await page.evaluate(() => { BL.fast = true; });
  await page.waitForFunction(() => {
    const G = window.BL && BL.game;
    if (!G || !G.B || G.busy) return false;
    for (let r = 0; r < G.B.h; r++) for (let c = 0; c < G.B.w; c++) {
      const cell = G.B.cell[r][c];
      if (cell.hole || cell.crate > 0 || cell.mole > 0) continue;
      if (!cell.tile) return false;
    }
    return true;
  }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  await page.evaluate(() => { BL.fast = false; });
  await page.waitForTimeout(250);
  /* a badge earned on the reload opens its sheet over the first board */
  await clear(page);
  await page.waitForTimeout(150);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await launch();
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
    await page.goto(at('/pawtika.html'), { waitUntil: 'load' });
    await setup(page);
    await page.evaluate(t => { BL.save.settings.theme = t; BL.applyTheme(); }, theme);
    for (const n of [4, 14, 22]) {
      await board(page, n);
      await page.screenshot({ path: path.join(OUT, theme + '-board-' + n + '.png') });
    }
    await clear(page);
    await page.evaluate(() => { BL.setScreen('home'); BL.renderHome(); });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, theme + '-home.png') });
    await page.evaluate(() => { BL.setScreen('map'); });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, theme + '-map.png') });
    await page.close();
  }
  await browser.close();
  if (srv && srv.stop) srv.stop();
  console.log(OUT);
})().catch(e => { console.error(e.message); process.exit(1); });
