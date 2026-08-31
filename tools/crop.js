/* Zoom in on part of a screen, so shapes and edges can be judged at the
   size the eye actually inspects them.   node tools/crop.js <x> <y> <w> <h> [name] */
const path = require('path');
const fs = require('fs');
const PW = require('./_pw.js');
const [x, y, w, h] = process.argv.slice(2, 6).map(Number);
const name = process.argv[6] || 'crop';
const out = path.join(__dirname, '..', 'shots', 'look');
fs.mkdirSync(out, { recursive: true });
(async () => {
  /* puts its own server up, like tools/browser.js */
  const server = await PW.serve();
  const browser = await PW.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 4 });
  await page.goto(PW.at('/biscuit-lane.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save);
  await page.evaluate(() => {
    BL.save.pets = [BL.makePet(2, 1, 0, 'Marlow')];
    BL.save.activePet = BL.save.pets[0].id; BL.persist(true);
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save.pets.length);
  await page.evaluate(() => {
    BL.BADGES.forEach(b => BL.save.badges[b.id] = 1);
    BL.save.reached = 24; BL.persist(true);
    BL.startLevel(12, { perks: [] }); BL.setScreen('game');
  });
  await page.waitForTimeout(3500);
  await page.evaluate(() => document.querySelectorAll('.veil').forEach(v => v.remove()));
  await page.screenshot({ path: path.join(out, name + '.png'), clip: { x, y, width: w, height: h } });
  console.log('wrote ' + name);
  await browser.close();
  server.stop();
})();
