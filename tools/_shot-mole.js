/* One board, photographed, for tools/palette-preview.js.

   Kept separate because the preview has to rebuild the bundle between
   shots, and a browser holding a stale page would photograph the
   previous palette — a fresh process per shot is the only way to be
   sure what is on screen is what was just built.

     node tools/shot-palette.js <tag>
*/
const PW_PATH = process.env.PLAYWRIGHT ||
  'C:/Users/Casper/Desktop/Proje/Cotidie-Ads-Opus/node_modules/playwright';
const CHROME = process.env.CHROME ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';
const path = require('path');
const fs = require('fs');
const { chromium } = require(PW_PATH);

const tag = process.argv[2] || 'shot';
const OUT = path.join(__dirname, '..', 'shots', 'palette');
const URL = 'http://localhost:5173/biscuit-lane.html?v=' + Date.now();

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save, null, { timeout: 20000 });
  await page.evaluate(() => {
    BL.save.pets = [BL.makePet(2, 1, 0, 'Marlow')];
    BL.save.activePet = BL.save.pets[0].id;
    BL.persist(true);
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save.pets.length);
  await page.evaluate(() => {
    const S = BL.save;
    S.reached = 90; S.coins = 900;
    BL.BADGES.forEach(b => S.badges[b.id] = 1);
    S.room = { theme: 'oat', placed: ['rug', 'plant', 'shelf'] };
    BL.persist(true);
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save.pets.length);

  const clear = () => page.evaluate(() => {
    const m = document.getElementById('modals');
    if (m) m.innerHTML = '';
    document.querySelectorAll('.veil').forEach(v => v.remove());
  });

  /* a six-colour board, which is the only view that shows every tile at
     once and is therefore the only one worth comparing */
  await page.evaluate(() => {
    BL.startLevel(77, { perks: [] });
    BL.setScreen('game');
    BL.layoutBoard();
  });
  await page.waitForTimeout(1200);
  await clear();
  const board = await page.locator('#boardWrap').boundingBox();
  await page.screenshot({ path: path.join(OUT, tag + '-board.png'), clip: board });

  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
