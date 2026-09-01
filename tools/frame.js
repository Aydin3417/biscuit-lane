/* Dev-only: time a frame in a real browser, away from the test harness.
     node tools/frame.js  */
const PW = require('./_pw.js');
(async () => {
  /* puts its own server up, like tools/browser.js */
  const server = await PW.serve();
  const b = await PW.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto(PW.at('/biscuit-lane.html'), { waitUntil: 'load' });
  await p.waitForFunction(() => window.BL && window.BL.save);
  await p.evaluate(() => { BL.save.pets = [BL.makePet(2, 1, 0, 'M')]; BL.save.activePet = BL.save.pets[0].id; BL.persist(true); });
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => window.BL && window.BL.save.pets.length);
  const out = await p.evaluate(() => {
    BL.save.reached = 40; BL.setScreen('game'); BL.startLevel(39, { perks: [] }); BL.layoutBoard();
    for (let i = 0; i < 30; i++) BL.renderGame(1 / 60);
    const time = n => { const t = performance.now(); for (let i = 0; i < n; i++) BL.renderGame(1 / 60);
      return +((performance.now() - t) / n).toFixed(2); };
    BL.game.__lb = 0;
    const quiet = time(120);
    const relayouts = BL.game.__lb;
    const G = BL.game;
    const burst = (cells, n) => { let k = 0;
      for (let r = 0; r < G.B.h && k < cells; r++) for (let c = 0; c < G.B.w && k < cells; c++, k++)
        BL.FX.pop(G.ox + (c + .5) * G.cell, G.oy + (r + .5) * G.cell, BL.PAL.accent, G.cell, { n }); };
    const measure = (cells, n) => {
      while (BL.FX.count() > 0) BL.renderGame(1 / 6);
      burst(cells, n);
      const born = BL.FX.count(), f = [];
      for (let i = 0; i < 24; i++) { const t = performance.now(); BL.renderGame(1 / 60); f.push(performance.now() - t); }
      f.sort((x, y) => x - y);
      return { born, med: +f[12].toFixed(1), p90: +f[21].toFixed(1), worst: +f[23].toFixed(1) };
    };
    const runs = { realistic: [], storm: [] };
    for (let k = 0; k < 3; k++) { runs.realistic.push(measure(22, 7)); runs.storm.push(measure(72, 9)); }
    return { quiet, relayouts, runs };
  });
  console.log(JSON.stringify(out));
  await b.close();
  server.stop();
})();
