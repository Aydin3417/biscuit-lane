/* Dev-only: capture the states the look-sheet misses — the home screen
   below the fold, a board mid-play, the lose sheet, the out-of-hearts
   sheet, the family screen and first run — so the interface can be
   judged in the states a player actually meets it in.

     node tools/audit.js [outdir]
*/
const path = require('path');
const fs = require('fs');
const PW = require('./_pw.js');

const out = path.join(__dirname, '..', 'shots', process.argv[2] || 'audit');
fs.mkdirSync(out, { recursive: true });
const URL = PW.at('/biscuit-lane.html');

(async () => {
  /* puts its own server up, like tools/browser.js */
  const server = await PW.serve();
  const browser = await PW.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const shot = async (name, wait) => {
    if (wait) await page.waitForTimeout(wait);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(out, name + '.png') });
    console.log('  ' + name);
  };
  const clear = () => page.evaluate(() => {
    document.querySelector('#modals').innerHTML = '';
    document.querySelectorAll('.veil').forEach(v => v.remove());
    document.body.classList.remove('modalOpen');
  });
  page.on('console', m => { if (m.type() === 'error') console.log('  ! ' + m.text()); });

  /* --- first run, exactly as a new player meets it --- */
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save, null, { timeout: 15000 });
  await shot('00-firstrun', 1200);

  await page.evaluate(() => {
    BL.save.pets = [BL.makePet(2, 1, 0, 'Marlow')];
    BL.save.activePet = BL.save.pets[0].id;
    BL.persist(true);
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save && window.BL.save.pets.length);
  await page.evaluate(() => {
    const S = BL.save;
    S.coins = 1400; S.treats = 9; S.reached = 24;
    BL.BADGES.forEach(b => S.badges[b.id] = 1);
    for (let i = 1; i < 24; i++) S.stars[i] = 1 + (i % 3);
    S.toys = { yarn: 1, tennis: 1 }; S.food = { kibble: 4, tuna: 2, stew: 1 };
    S.furniture = { rug: 1, plant: 1, shelf: 1 }; S.roomThemes = { oat: 1, sage: 1 };
    S.room = { theme: 'oat', placed: ['rug', 'plant', 'shelf'] };
    if (S.pets[0]) { S.pets[0].bond = 16; S.pets[0].food = 82; S.pets[0].joy = 78;
                     S.pets[0].clean = 90; S.pets[0].energy = 74; S.pets[0].asleep = false; }
    BL.persist(true);
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save.pets.length);
  await page.evaluate(() => (document.querySelector('#modals').innerHTML = '', document.querySelectorAll('.veil').forEach(v => v.remove())));

  /* --- home, below the fold --- */
  await clear();
  await page.evaluate(() => BL.setScreen('home'));
  await page.waitForTimeout(400); await clear();
  await page.waitForTimeout(700);
  await page.evaluate(() => { const s = document.querySelector('#scr-home .scroller'); s.scrollTop = s.scrollHeight; });
  await shot('01-home-bottom', 500);

  /* --- family --- */
  await clear();
  await page.evaluate(() => BL.setScreen('family'));
  await shot('02-family', 700);

  /* --- a board a few moves in --- */
  await clear();
  await page.evaluate(() => {
    BL.startLevel(12, { perks: BL.perksFor(BL.activePet()) });
    BL.setScreen('game');
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    BL.game.score = 6400; BL.game.moves = 4;
    document.querySelector('#movesN').textContent = '4';
    document.querySelector('#scoreN').textContent = '6,400';
  });
  await shot('03-board-lowmoves', 600);

  /* --- lose --- */
  await page.evaluate(() => BL.showLose());
  await shot('04-lose', 700);
  await page.evaluate(() => (document.querySelector('#modals').innerHTML = '', document.querySelectorAll('.veil').forEach(v => v.remove())));

  /* --- out of hearts --- */
  await page.evaluate(() => { BL.save.hearts = 0; BL.persist(true); BL.setScreen('map'); BL.noHeartsSheet(); });
  await shot('05-nohearts', 700);
  await page.evaluate(() => { (document.querySelector('#modals').innerHTML = '', document.querySelectorAll('.veil').forEach(v => v.remove()));
                              BL.save.hearts = 5; BL.persist(true); });

  /* --- settings --- */
  await page.evaluate(() => BL.openSettings());
  await shot('06-settings', 700);
  await page.evaluate(() => (document.querySelector('#modals').innerHTML = '', document.querySelectorAll('.veil').forEach(v => v.remove())));

  /* --- board, dark --- */
  await page.evaluate(() => { BL.save.settings.theme = 'dark'; BL.applyTheme();
                              BL.startLevel(43, { perks: [] }); BL.setScreen('game'); });
  await shot('07-board-dark', 1200);

  await browser.close();
  server.stop();
  console.log('shots in ' + out);
})();
