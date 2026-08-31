/* Run the DOM layer's tests without a human opening a file.

   test/integration.html has always carried the checks that only mean
   anything in a real document — focus order, sheets that can be
   reached, canvases that do not double, a level actually played through
   the interface. It was run by opening it and looking, which means it
   was run when somebody remembered to. A test nobody is made to run is
   a test that quietly stops being true.

     node tools/browser.js
*/
const PW_PATH = process.env.PLAYWRIGHT ||
  'C:/Users/Casper/Desktop/Proje/Cotidie-Ads-Opus/node_modules/playwright';
const CHROME = process.env.CHROME ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { chromium } = require(PW_PATH);
const URL = process.env.URL || 'http://localhost:5173/test/integration.html';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
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

  await page.goto(URL, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.RESULTS && window.RESULTS.done, null, { timeout: 180000 });
  } catch (e) {
    const so_far = await page.evaluate(() => window.RESULTS ? window.RESULTS.tests.length : -1);
    console.log('takıldı: ' + so_far + ' testten sonra bitmedi');
    await browser.close();
    process.exit(1);
  }

  const R = await page.evaluate(() => ({
    pass: RESULTS.pass, fail: RESULTS.fail,
    bad: RESULTS.tests.filter(t => !t.ok).map(t => t.name + (t.detail ? ' — ' + t.detail : ''))
  }));
  await browser.close();

  R.bad.forEach(b => console.log('  ✗ ' + b));
  /* A page error during a passing suite is still a fault: something
     threw where nothing asserted. */
  noise.slice(0, 8).forEach(n => console.log('  ! ' + n));
  console.log('tarayıcı katmanı: ' + R.pass + ' geçti, ' + R.fail + ' kaldı' +
    (noise.length ? ', ' + noise.length + ' konsol gürültüsü' : ''));
  process.exit(R.fail || noise.length ? 1 : 0);
})();
