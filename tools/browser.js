/* Run the DOM layer's tests without a human opening a file.

   test/integration.html has always carried the checks that only mean
   anything in a real document — focus order, sheets that can be
   reached, canvases that do not double, a level actually played through
   the interface. It was run by opening it and looking, which means it
   was run when somebody remembered to. A test nobody is made to run is
   a test that quietly stops being true.

     node tools/browser.js
*/
const PW = require('./_pw.js');
const URL = process.env.URL || PW.at('/test/integration.html');

(async () => {
  /* The suite puts its own server up. It used to require one already
     running in another terminal, on a port this repository does not
     serve, which is most of why it stopped being run. If something is
     already listening there, that is used instead and this is a no-op. */
  const server = await PW.serve();
  const browser = await PW.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const noise = [];
  page.on('pageerror', e => noise.push('sayfa hatası: ' + e.message));
  page.on('requestfailed', r => noise.push('istek başarısız: ' + r.url()));
  page.on('response', r => { if (r.status() >= 400) noise.push(r.status() + ': ' + r.url()); });
  /* Chrome refuses navigator.vibrate until the frame has been tapped,
     and says so once per call. The game asks for a buzz on every swap
     and every clear, so a full suite produces thousands of these. It is
     the browser's policy talking, not the game misbehaving — verified
     by reading buzz(), which returns before touching the API whenever
     haptics are off. Everything else on the error channel is kept. */
  const benign = /navigator\.vibrate/;
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!benign.test(t)) noise.push('konsol: ' + t);
  });

  /* domcontentloaded, not load.

     `load` waits for the Google Fonts stylesheet and the two woff2 files
     behind it. On a slow line that is most of half a minute — measured
     at 25.5s against a 30s default — so the suite failed with a
     navigation timeout and nothing at all to say the cause was the
     typeface rather than the game. The real gate is the line below:
     RESULTS.done, with its own generous timeout. Waiting for `load`
     first added a second, tighter deadline governed by a third party.

     The fonts still load; nothing stops them. They are simply no longer
     something the suite can fail on. */
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => window.RESULTS && window.RESULTS.done, null, { timeout: 180000 });
  } catch (e) {
    const so_far = await page.evaluate(() => window.RESULTS ? window.RESULTS.tests.length : -1);
    console.log('takıldı: ' + so_far + ' testten sonra bitmedi');
    await browser.close();
    server.stop();
    process.exit(1);
  }

  const R = await page.evaluate(() => ({
    pass: RESULTS.pass, fail: RESULTS.fail,
    bad: RESULTS.tests.filter(t => !t.ok).map(t => t.name + (t.detail ? ' — ' + t.detail : ''))
  }));
  await browser.close();
  server.stop();

  R.bad.forEach(b => console.log('  ✗ ' + b));
  /* A page error during a passing suite is still a fault: something
     threw where nothing asserted. */
  noise.slice(0, 8).forEach(n => console.log('  ! ' + n));
  console.log('tarayıcı katmanı: ' + R.pass + ' geçti, ' + R.fail + ' kaldı' +
    (noise.length ? ', ' + noise.length + ' konsol gürültüsü' : ''));
  process.exit(R.fail || noise.length ? 1 : 0);
})();
