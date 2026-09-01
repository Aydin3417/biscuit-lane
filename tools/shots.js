/* Dev-only: drive the built game in a real browser and save each screen
   as a PNG, so the look can be judged instead of guessed at. Playwright
   is borrowed from a sibling project rather than added as a dependency —
   the game itself still has none.

     node tools/shots.js [outdir]
*/
const path = require('path');
const fs = require('fs');
const PW = require('./_pw.js');

const out = path.join(__dirname, '..', 'shots', process.argv[2] || 'look');
fs.mkdirSync(out, { recursive: true });
const URL = PW.at('/biscuit-lane.html');

(async () => {
  /* puts its own server up, like tools/browser.js */
  const server = await PW.serve();
  const browser = await PW.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const clearVeils = () => page.evaluate(() =>
    document.querySelectorAll('.veil').forEach(v => v.remove()));
  const shot = async (name, wait) => {
    if (wait) await page.waitForTimeout(wait);
    if (!/card|sheet|modal/.test(name)) await clearVeils();
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(out, name + '.png') });
    console.log('  ' + name);
  };
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save, null, { timeout: 15000 });

  /* adopt, then reload: the first-run branch is decided at boot from
     whether a save existed, so it cannot be skipped from inside */
  await page.evaluate(() => {
    BL.save.pets = [BL.makePet(2, 1, 0, 'Marlow')];
    BL.save.activePet = BL.save.pets[0].id;
    BL.persist(true);
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save && window.BL.save.pets.length);

  /* a save with some progress, so the screens are not all empty state */
  await page.evaluate(() => {
    const S = BL.save;
    S.coins = 1400; S.treats = 9; S.reached = 24;
    BL.BADGES.forEach(b => S.badges[b.id] = 1);   /* no congratulations mid-shot */
    for (let i = 1; i < 24; i++) S.stars[i] = 1 + (i % 3);
    S.scores[7] = 18240;
    S.toys = { yarn: 1, tennis: 1 }; S.food = { kibble: 4, tuna: 2, stew: 1 };
    S.furniture = { rug: 1, plant: 1, shelf: 1 }; S.roomThemes = { oat: 1, sage: 1 };
    S.room = { theme: 'oat', placed: ['rug', 'plant', 'shelf'] };
    if (S.pets[0]) { S.pets[0].bond = 16; S.pets[0].food = 82; S.pets[0].joy = 78;
                     S.pets[0].clean = 90; S.pets[0].energy = 74; S.pets[0].asleep = false; }
    BL.persist(true);
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save.pets.length);
  await page.evaluate(() => { const v = document.querySelector('.veil'); if (v) v.remove(); });

  await page.evaluate(() => BL.setScreen('home'));
  await shot('01-room', 900);
  await page.evaluate(() => BL.setScreen('map'));
  await shot('02-map', 700);
  await page.evaluate(() => { BL.setScreen('map'); BL.startLevel(12, { perks: BL.perksFor(BL.activePet()) }); BL.setScreen('game'); });
  await shot('03-board', 1400);
  await page.evaluate(() => { BL.startLevel(28, { perks: [] }); BL.setScreen('game'); });
  await shot('04-board-mud', 1400);
  await page.evaluate(() => { BL.startLevel(43, { perks: [] }); BL.setScreen('game'); });
  await shot('05-board-crate', 1400);
  await page.evaluate(() => BL.setScreen('shop'));
  await shot('06-shop', 700);
  await page.evaluate(() => BL.setScreen('family'));
  await shot('07-family', 700);
  await page.evaluate(() => { BL.setScreen('map'); BL.openLevelIntro(12); });
  await shot('08-levelcard', 700);

  await page.evaluate(() => { document.querySelectorAll('.veil').forEach(v => v.remove()); BL.openSettings(); });
  await shot('14-settings-sheet', 700);
  await page.evaluate(() => { document.querySelectorAll('.veil').forEach(v => v.remove()); BL.howToPlay(); });
  await shot('15-howto-sheet', 700);
  await page.evaluate(() => { document.querySelectorAll('.veil').forEach(v => v.remove());
    BL.startLevel(20, { perks: [] }); BL.setScreen('game'); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { BL.game.moves = 0; BL.showLose && BL.showLose(); });
  await shot('16-lose-sheet', 900);

  /* dark */
  await page.evaluate(() => { document.querySelector('.veil') && document.querySelector('.veil').remove();
                              BL.save.settings.theme = 'dark'; BL.applyTheme(); BL.setScreen('home'); });
  await shot('09-room-dark', 900);
  await page.evaluate(() => BL.setScreen('map'));
  await shot('10-map-dark', 700);
  await page.evaluate(() => { document.querySelectorAll('.veil').forEach(v => v.remove()); BL.setScreen('shop'); });
  await shot('17-shop-dark', 700);
  await page.evaluate(() => { document.querySelectorAll('.veil').forEach(v => v.remove()); BL.setScreen('family'); });
  await shot('18-family-dark', 700);

  await browser.close();
  server.stop();
  console.log('shots in ' + out);
})();
