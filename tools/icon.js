/* Dev-only: render the game's own logo to the app icons, so the thing on
   the home screen is drawn by the same code as the thing in the top bar.
   Writes src/icons.js, which the build inlines as data URIs.

     node tools/icon.js
*/
const path = require('path');
const fs = require('fs');
const PW_PATH = process.env.PLAYWRIGHT ||
  'C:/Users/Casper/Desktop/Proje/Cotidie-Ads-Opus/node_modules/playwright';
const CHROME = process.env.CHROME ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { chromium } = require(PW_PATH);

/* Maskable icons are cropped to a circle on some launchers and to a
   squircle on others, so the mark has to sit inside the middle 80%. */
const SIZES = [[512, 'any'], [192, 'any'], [512, 'maskable'], [180, 'apple']];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
  await page.goto('http://localhost:5173/biscuit-lane.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save);
  const out = {};
  for (const [px, kind] of SIZES) {
    out[kind + px] = await page.evaluate(([px, kind]) => {
      const cv = document.createElement('canvas');
      cv.width = px; cv.height = px;
      const c = cv.getContext('2d');
      /* the lane's own ground, so the icon belongs to the game */
      const g = c.createLinearGradient(0, 0, 0, px);
      g.addColorStop(0, '#F6E3C4'); g.addColorStop(1, '#E2C79E');
      c.fillStyle = g; c.fillRect(0, 0, px, px);
      const pad = kind === 'maskable' ? px * .22 : px * .11;
      /* drawLogo paints into the box 0..size, it is not centred on the
         origin — the top bar calls it straight after fitCanvas */
      c.save();
      c.translate(pad, pad);
      BL.drawLogo(c, px - pad * 2);
      c.restore();
      return cv.toDataURL('image/png');
    }, [px, kind]);
  }
  await browser.close();
  const dir = path.join(__dirname, '..', 'icons');
  fs.mkdirSync(dir, { recursive: true });
  const names = { any512: 'icon-512.png', any192: 'icon-192.png',
                  maskable512: 'icon-maskable-512.png', apple180: 'apple-touch-icon.png' };
  Object.keys(out).forEach(k => {
    const b64 = out[k].slice(out[k].indexOf(',') + 1);
    const file = path.join(dir, names[k]);
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    console.log('  ' + names[k] + '  ' + (fs.statSync(file).size / 1024).toFixed(0) + ' KB');
  });
})();
