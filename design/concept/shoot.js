/* Dev-only: photographs the built game at a phone's size after a setup
   script, for checking the 1.4 screens.

     node design/concept/shoot.js <name> "<js run in the page>" [light|dark]

   A fresh save each time: the onboarding is clicked through, a pet is
   brought home, then the given script runs and the page is shot to
   design/concept/shots/<name>.png at 390x844, 2x. */
const path = require('path');
const fs = require('fs');
const PW = require('../../tools/_pw.js');

const [name, setup, scheme] = process.argv.slice(2);
(async () => {
  const server = await PW.serve();
  const browser = await PW.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    colorScheme: scheme === 'dark' ? 'dark' : 'light', hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => { Date.prototype.getHours = () => 12; Date.prototype.getMinutes = () => 0; });
  await page.goto(PW.at('/pawtika.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save);
  await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const click = t => { const b = [...document.querySelectorAll('button')].find(x => x.innerText.trim() === t); if (b) b.click(); return !!b; };
    if (click('Next')) { await sleep(500); click('Bring them home'); await sleep(900); click('Play the first level'); await sleep(900); }
    BL.save.pets.forEach(p => { p.asleep = false; p.energy = 90; p.food = 82; p.joy = 80; p.clean = 84; });
    BL.save.seen = Object.assign(BL.save.seen || {}, { swap: 1 });
    BL.persist(true);
  });
  if (setup) await page.evaluate(new Function('return (async () => {' + setup + '})()'));
  await page.waitForTimeout(1400);
  const out = path.join(__dirname, 'shots', name + '.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log('shot ' + out);
  await browser.close();
  if (server && server.stop) server.stop();
})().catch(e => { console.error(e.message); process.exit(1); });
