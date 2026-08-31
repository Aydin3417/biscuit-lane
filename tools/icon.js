/* Dev-only: render the game's own logo to the app icons, so the thing on
   the home screen is drawn by the same code as the thing in the top bar.
   Writes src/icons.js, which the build inlines as data URIs.

     node tools/icon.js
*/
const path = require('path');
const fs = require('fs');
const PW = require('./_pw.js');

/* Maskable icons are cropped to a circle on some launchers and to a
   squircle on others, so the mark has to sit inside the middle 80%. */
const SIZES = [[512, 'any'], [192, 'any'], [512, 'maskable'], [180, 'apple']];

/* ---------- and the same mark, for the Android launcher ----------

   A generated Capacitor project ships with Capacitor's own logo, which
   is what a player would have found on their home screen. The web
   manifest icons above cannot simply be copied there: Android wants a
   legacy square, a pre-rounded copy for launchers that ask for one, and
   an adaptive foreground on a 108dp canvas whose outer fifth the system
   is free to crop, mask or animate.

   Densities are the usual ladder — mdpi is 1x, and 48dp of launcher
   icon is 48px there and 192px at xxxhdpi. */
const DENSITIES = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]];
const LEGACY_DP = 48, ADAPTIVE_DP = 108;
/* the middle 72 of 108dp is the only part guaranteed to survive the
   mask, so the mark is drawn to fit inside that and nothing else */
const SAFE = 72 / 108;

(async () => {
  /* puts its own server up, like tools/browser.js */
  const server = await PW.serve();
  const browser = await PW.launch();
  const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
  await page.goto(PW.at('/biscuit-lane.html'), { waitUntil: 'load' });
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
  /* the launcher set, drawn by the same drawLogo() */
  const droid = await page.evaluate(([densities, legacyDp, adaptiveDp, safe]) => {
    const ground = (c, px) => {
      const g = c.createLinearGradient(0, 0, 0, px);
      g.addColorStop(0, '#F6E3C4'); g.addColorStop(1, '#E2C79E');
      c.fillStyle = g; c.fillRect(0, 0, px, px);
    };
    const mark = (c, px, frac) => {
      const pad = px * (1 - frac) / 2;
      c.save(); c.translate(pad, pad); BL.drawLogo(c, px * frac); c.restore();
    };
    const make = (px, how) => {
      const cv = document.createElement('canvas');
      cv.width = px; cv.height = px;
      const c = cv.getContext('2d');
      if (how === 'round') {
        c.save();
        c.beginPath(); c.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2); c.clip();
        ground(c, px); mark(c, px, .78);
        c.restore();
      } else if (how === 'fg') {
        /* transparent: the adaptive background is a colour resource, and
           painting one here would show through the mask as a square */
        mark(c, px, safe * .74);
      } else {
        ground(c, px); mark(c, px, .78);
      }
      return cv.toDataURL('image/png');
    };
    const out = {};
    densities.forEach(([name, k]) => {
      out[name] = {
        ic_launcher: make(Math.round(legacyDp * k), 'square'),
        ic_launcher_round: make(Math.round(legacyDp * k), 'round'),
        ic_launcher_foreground: make(Math.round(adaptiveDp * k), 'fg')
      };
    });
    return out;
  }, [DENSITIES, LEGACY_DP, ADAPTIVE_DP, SAFE]);

  await browser.close();
  server.stop();

  const res = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
  if (fs.existsSync(res)) {
    let n = 0;
    Object.keys(droid).forEach(density => {
      const dir = path.join(res, 'mipmap-' + density);
      fs.mkdirSync(dir, { recursive: true });
      Object.keys(droid[density]).forEach(name => {
        const url = droid[density][name];
        fs.writeFileSync(path.join(dir, name + '.png'),
          Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
        n++;
      });
    });
    /* the adaptive background is a flat colour behind a transparent
       foreground; the generated project left it white */
    fs.writeFileSync(path.join(res, 'values', 'ic_launcher_background.xml'),
      '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' +
      '    <color name="ic_launcher_background">#F6E3C4</color>\n</resources>\n', 'utf8');
    /* the vectors the generated project pointed at are Capacitor's mark
       and nothing references them now */
    ['drawable/ic_launcher_background.xml', 'drawable-v24/ic_launcher_foreground.xml']
      .forEach(f => { try { fs.unlinkSync(path.join(res, f)); } catch (e) { } });
    console.log('  android launcher: ' + n + ' files across ' + DENSITIES.length + ' densities');
  } else {
    console.log('  android/ not present — skipped the launcher set');
  }

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
