/* Dev-only: the same screens in both themes, into shots/<tag>/, so a
   design change can be looked at instead of argued about.

     node tools/compare.js before
     node tools/compare.js after
*/
const path = require('path'), fs = require('fs');
const PW = require('./_pw.js');
const TAG = process.argv[2] || 'now';
const OUT = path.join(__dirname, '..', 'shots', TAG);

const POSE = `(() => {
  const S = BL.save;
  S.pets = [BL.makePet(0, 0, 0, 'Biscuit')];
  S.activePet = S.pets[0].id;
  S.coins = 1840; S.treats = 12; S.hearts = 4;
  S.reached = 22;
  for (let i = 1; i < 22; i++) S.stars[i] = i % 4 === 0 ? 2 : 3;
  S.food = { kibble: 4, tuna: 2 }; S.streak = 4; S.lastGift = Date.now();
  S.seen = { mud:1, crate:1, rescue:1, bramble:1, swap:1, pet:1, special:1 };
  BL.BADGES.forEach(b => S.badges[b.id] = 1);
  const p = S.pets[0];
  p.bond = 9; p.bondXp = 3; p.food = 88; p.joy = 92; p.clean = 90; p.energy = 78;
  p.trait = 'playful'; p.asleep = false;
  BL.persist(true);
})()`;

(async () => {
  const server = await PW.serve(), browser = await PW.launch();
  fs.mkdirSync(OUT, { recursive: true });
  for (const [scheme, tag] of [['light', 'day'], ['dark', 'dusk']]) {
    const p = await browser.newPage({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme
    });
    await p.goto(PW.at('/index.html'), { waitUntil: 'load' });
    await p.waitForFunction(() => window.BL && window.BL.save, null, { timeout: 20000 });
    await p.evaluate(POSE);
    await p.reload({ waitUntil: 'load' });
    await p.waitForFunction(() => window.BL && window.BL.save.pets.length);
    await p.waitForTimeout(1500);
    await p.evaluate(() => { const b = document.getElementById('dgOk'); if (b) b.click(); });
    await p.waitForTimeout(700);
    await p.evaluate(() => document.querySelectorAll('#onb,.veil').forEach(v => v.remove()));

    await p.evaluate(() => BL.setScreen('home'));
    await p.waitForTimeout(1300);
    await p.screenshot({ path: path.join(OUT, 'home-' + tag + '.png') });
    /* and the same screen scrolled, where the card stack is at its worst */
    await p.evaluate(() => { const s = document.querySelector('#scr-home .scroller'); if (s) s.scrollTop = 520; });
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, 'home-' + tag + '-scrolled.png') });

    await p.evaluate(() => document.getElementById('goPlay').click());
    await p.waitForTimeout(1500);
    await p.evaluate(() => {
      const b = [...document.querySelectorAll('#modals button')].find(x => /Start/.test(x.innerText));
      if (b) b.click();
    });
    await p.waitForTimeout(2200);
    await p.evaluate(() => {
      const b = [...document.querySelectorAll('#modals button')].find(x => /Got it/.test(x.innerText));
      if (b) b.click();
    });
    await p.waitForTimeout(1400);
    await p.screenshot({ path: path.join(OUT, 'game-' + tag + '.png') });
    console.log('  ' + TAG + '/' + tag + ': home, home-scrolled, game');
    await p.close();
  }
  await browser.close(); if (server.stop) server.stop();
})();
