/* Dev-only: play one move and photograph the next second of it, so the
   feel of a clear can be looked at frame by frame instead of imagined.
     node tools/motion.js [level]  */
const path = require('path'), fs = require('fs');
const PW = require('./_pw.js');
const lvl = +(process.argv[2] || 12);
const out = path.join(__dirname, '..', 'shots', 'motion');
fs.mkdirSync(out, { recursive: true });
(async () => {
  /* puts its own server up, like tools/browser.js */
  const server = await PW.serve();
  const b = await PW.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto(PW.at('/biscuit-lane.html'), { waitUntil: 'load' });
  await p.waitForFunction(() => window.BL && window.BL.save);
  await p.evaluate(() => { BL.save.pets = [BL.makePet(2, 1, 0, 'Marlow')]; BL.save.activePet = BL.save.pets[0].id; BL.persist(true); });
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => window.BL && window.BL.save.pets.length);
  await p.evaluate(n => {
    BL.BADGES.forEach(x => BL.save.badges[x.id] = 1);
    BL.save.reached = 40; BL.persist(true);
    BL.startLevel(n, { perks: [] }); BL.setScreen('game');
  }, lvl);
  await p.waitForTimeout(2600);
  await p.evaluate(() => document.querySelectorAll('.veil').forEach(v => v.remove()));
  /* pick the move that clears the most, so there is something to look at */
  const played = await p.evaluate(() => {
    const ms = BL.allMoves(BL.game.B);
    if (!ms.length) return 'no moves';
    BL.tryMove(ms[(Math.random() * ms.length) | 0]);
    return 'ok';
  });
  console.log('move: ' + played);
  const clip = { x: 0, y: 210, width: 390, height: 420 };
  for (let i = 0; i < 12; i++) {
    await p.screenshot({ path: path.join(out, 'f' + String(i).padStart(2, '0') + '.png'), clip });
    await p.waitForTimeout(70);
  }
  console.log('frames in ' + out);
  await b.close();
  server.stop();
})();
