/* Dev-only: render the brand mark to every icon the two stores and the
   web app ask for.

     node tools/icon.js

   Writes icons/, the Android launcher set across five densities, and the
   Xcode asset set. Also writes src/js/02-logo.js, which the build inlines
   so the game draws the same mark in its own top bar.

   ---------------------------------------------------------------
   WHY THIS FILE STOPPED DRAWING AND STARTED CROPPING

   It used to call BL.drawLogo() — the game's own code-drawn paw — so the
   thing on the home screen was made by the same lines as the thing in
   the top bar, at any size, perfectly sharp. That was the better
   arrangement and it is worth writing down that it was given up
   deliberately rather than lost.

   The game is called Pawtika now and the mark is a drawing somebody
   made: a paw-shaped handheld with two pixel animals in its screen.
   There is no code that produces it, so it comes in as pixels.

   THE ONE PROBLEM WITH THAT, AND WHAT IS DONE ABOUT IT. The source is a
   1024x559 JPEG of a wide banner, and the device occupies about 380
   pixels of it. Apple wants a 1024 icon. Scaling 380 to 1024 is a 2.7x
   upscale of a lossy source and it looks like one.

   So the icon is not a crop of the banner. It is composited:

     - the ground is the banner's own pastel, taken from a corner it has
       no wordmark in, and blurred. Blurring an upscale is free — nobody
       can see detail that was never meant to be looked at, and the swirl
       and the clouds survive.

     - the device is cropped tight and drawn over it at the size the icon
       actually wants, which for a 1024 icon is about 780 rather than
       1024. That is 2x rather than 2.7x, and it is the only part of the
       picture anybody looks at closely.

   Launch screens are the exception and are on the GAME's ground rather
   than the mark's, for a reason written where they are made.

   A 1024x1024 source of the device alone would remove even that, and if
   one ever arrives this file needs one number changed. See DEVICE. */
const path = require('path');
const fs = require('fs');
const PW = require('./_pw.js');

/* Where the device sits in design/pawtika.jpg, measured off the file:
   the ring at the top, the whole body, and nothing of the wordmark
   underneath. Replace the file with a square close-up and this becomes
   {x: 0, y: 0, w: <width>, h: <height>}. */
const SRC = path.join(__dirname, '..', 'design', 'pawtika.jpg');
const DEVICE = { x: 325, y: 28, w: 382, h: 388 };

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

/* The banner's own background colour, for the one thing that needs a
   flat one: the adaptive icon's background layer, which sits behind a
   transparent foreground and cannot be a picture. Sampled from the
   source below and printed, so a new source updates it rather than
   leaving a stale hex behind. */

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error('no source picture at design/pawtika.jpg');
    process.exit(1);
  }
  const dataUrl = 'data:image/jpeg;base64,' + fs.readFileSync(SRC).toString('base64');

  const server = await PW.serve();
  const browser = await PW.launch();
  const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
  await page.goto(PW.at('/pawtika.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save);

  /* Everything below runs in the page because a canvas is the only
     image resizer in this toolchain, and it is a good one: Chromium's
     drawImage with high smoothing is a proper filter rather than a
     nearest-neighbour smear. */
  await page.evaluate(async ([url, dev]) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    window.__src = img;
    window.__dev = dev;

    /* The ground, cover-cropped from the banner and blurred.

       Blur is not decoration here. The background is being enlarged past
       what a 1024-wide JPEG holds, and a blurred upscale is honest —
       there is no detail to lose in a pastel swirl, and the compression
       blocks that would otherwise show up along the colour ramps go with
       it. */
    window.__ground = (c, px) => {
      const s = window.__src;
      /* From the banner's top-left corner, not its middle. The middle
         contains the device and the wordmark, and a blurred wordmark
         under the icon reads as a smudge somebody failed to clean up. */
      const side = Math.min(340, s.width, s.height);
      const sx = 0, sy = 0;
      c.save();
      c.filter = 'blur(' + Math.max(1, px * 0.012) + 'px)';
      /* drawn slightly oversize so the blur has something to bleed from
         and does not leave a soft edge inside the icon */
      const over = px * 0.06;
      c.drawImage(s, sx, sy, side, side, -over, -over, px + over * 2, px + over * 2);
      c.restore();
    };

    /* The device, cropped and drawn to fill `frac` of the square, with
       the crop's own corners feathered away.

       The crop is a rectangle of a banner, so it carries the banner's
       pastel in its corners. On the icon that is invisible — the ground
       behind it is the same pastel. Anywhere else it is a hard-edged
       square: the Android adaptive foreground is supposed to be
       transparent and was not, and the launch screen showed a pastel
       card sitting on the game's cream like a sticker somebody forgot to
       trim.

       A rounded-rectangle mask with a soft edge takes the corners off.
       The device's own silhouette is a rounded paw, so the mask follows
       it closely enough that nothing of the device is lost — what goes
       is the background that was never wanted. */
    window.__mark = (c, px, frac) => {
      const s = window.__src, d = window.__dev;
      const box = px * frac;
      const k = Math.min(box / d.w, box / d.h);
      const w = Math.max(1, Math.round(d.w * k)), h = Math.max(1, Math.round(d.h * k));

      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      const o = off.getContext('2d');
      o.imageSmoothingEnabled = true;
      o.imageSmoothingQuality = 'high';
      o.drawImage(s, d.x, d.y, d.w, d.h, 0, 0, w, h);

      /* the mask, drawn blurred so its edge is a fade rather than a cut */
      o.globalCompositeOperation = 'destination-in';
      const r = Math.min(w, h) * 0.30;
      const inset = Math.min(w, h) * 0.02;
      o.filter = 'blur(' + Math.max(1, Math.min(w, h) * 0.02) + 'px)';
      o.fillStyle = '#000';
      o.beginPath();
      if (o.roundRect) o.roundRect(inset, inset, w - inset * 2, h - inset * 2, r);
      else o.rect(inset, inset, w - inset * 2, h - inset * 2);
      o.fill();

      c.drawImage(off, (px - w) / 2, (px - h) / 2);
    };
  }, [dataUrl, DEVICE]);

  /* the flat colour behind the adaptive icon and under the app */
  const flat = await page.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = 1; cv.height = 1;
    const c = cv.getContext('2d');
    /* the average of the banner, which is the colour the eye reads it as */
    c.drawImage(window.__src, 0, 0, 1, 1);
    const p = c.getImageData(0, 0, 1, 1).data;
    const hex = n => n.toString(16).padStart(2, '0');
    return '#' + hex(p[0]) + hex(p[1]) + hex(p[2]);
  });

  const out = {};
  for (const [px, kind] of SIZES) {
    out[kind + px] = await page.evaluate(([px, kind]) => {
      const cv = document.createElement('canvas');
      cv.width = px; cv.height = px;
      const c = cv.getContext('2d');
      window.__ground(c, px);
      window.__mark(c, px, kind === 'maskable' ? 0.56 : 0.76);
      return cv.toDataURL('image/png');
    }, [px, kind]);
  }

  const droid = await page.evaluate(([densities, legacyDp, adaptiveDp, safe]) => {
    const make = (px, how) => {
      const cv = document.createElement('canvas');
      cv.width = px; cv.height = px;
      const c = cv.getContext('2d');
      if (how === 'round') {
        c.save();
        c.beginPath(); c.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2); c.clip();
        window.__ground(c, px); window.__mark(c, px, 0.74);
        c.restore();
      } else if (how === 'fg') {
        /* transparent: the adaptive background is a colour resource, and
           painting one here would show through the mask as a square */
        window.__mark(c, px, safe * 0.78);
      } else {
        window.__ground(c, px); window.__mark(c, px, 0.78);
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

  /* ---------- the mark the game itself draws ----------

     The top bar used to call drawLogo(). It draws this instead, so the
     icon on the home screen and the mark above the board are the same
     picture. Written as a data URI into src/logo.js, which build.js
     inlines — the shipped page stays one file.

     128 is the size it is drawn at on the densest phone the top bar can
     be on, doubled. Anything larger is weight for nothing: this is a
     thirty-pixel mark. */
  const inGame = await page.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const c = cv.getContext('2d');
    window.__mark(c, 128, 1);
    return cv.toDataURL('image/png');
  });

  /* ---------- and the same mark again, for iOS ----------

     Xcode wants one 1024 icon and three copies of a launch image, all
     under Assets.xcassets with the filenames the generated Contents.json
     already names. A generated Capacitor project ships Capacitor's own
     logo in both slots, which is what would have gone to review.

     The icon is drawn without a safe-area inset: iOS masks to a fixed
     squircle rather than letting a launcher choose, so the mark can use
     the same margin the web icon does. The splash is the ground with the
     mark small and centred, on a square big enough for any device in
     either orientation. */
  const iosDir = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets');
  let ios = null;
  if (fs.existsSync(iosDir)) {
    ios = await page.evaluate(() => {
      const square = (px, frac) => {
        const cv = document.createElement('canvas');
        cv.width = px; cv.height = px;
        const c = cv.getContext('2d');
        window.__ground(c, px);
        window.__mark(c, px, frac);
        return cv.toDataURL('image/png');
      };
      /* The splash is on the GAME's ground, not the mark's.

         The icon sits on the brand's pastel because that is what it is
         for — being picked out of a grid of other icons. A launch screen
         is a different job: it is the half-second before the game, and
         the game is oat. Pastel there means the player watches the
         screen change colour on every cold start, which reads as a
         stutter rather than as branding. Android does the same thing by
         a different route — see @color/splashBackground. */
      const splash = px => {
        const cv = document.createElement('canvas');
        cv.width = px; cv.height = px;
        const c = cv.getContext('2d');
        const g = c.createLinearGradient(0, 0, 0, px);
        g.addColorStop(0, '#F6E3C4'); g.addColorStop(1, '#E2C79E');
        c.fillStyle = g; c.fillRect(0, 0, px, px);
        /* a fifth of the square: it has to look deliberate on a tall
           phone and on a wide tablet, and only the middle is safe on
           both */
        window.__mark(c, px, 0.2);
        return cv.toDataURL('image/png');
      };
      return { icon: square(1024, 0.76), splash: splash(2732) };
    });
  }

  await browser.close();
  server.stop();

  if (ios) {
    const put = (rel, url) => {
      const f = path.join(iosDir, rel);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
      return (fs.statSync(f).size / 1024).toFixed(0);
    };
    put('AppIcon.appiconset/AppIcon-512@2x.png', ios.icon);
    ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']
      .forEach(n => put('Splash.imageset/' + n, ios.splash));
    console.log('  ios: AppIcon 1024 and three launch images');
  } else {
    console.log('  ios/ not present — skipped the Xcode asset set');
  }

  /* Into src/js/ rather than src/, because build.js concatenates that
     directory and nothing else — and numbered 02 so the constant exists
     before any module that draws it. It is generated, it is data, and it
     is the one file in there nobody should ever open. */
  const logoJs = path.join(__dirname, '..', 'src', 'js', '02-logo.js');
  fs.writeFileSync(logoJs,
    '/* GENERATED by tools/icon.js from design/pawtika.jpg. Do not edit —\n' +
    '   run the tool again.\n\n' +
    '   The brand mark as a picture, at the size the top bar draws it on\n' +
    '   the densest phone, doubled. Every store icon is this same crop of\n' +
    '   the same file at another size, so the mark above the board and the\n' +
    '   one on the home screen cannot drift apart. */\n' +
    'const LOGO_SRC = ' + JSON.stringify(inGame) + ';\n', 'utf8');
  console.log('  src/js/02-logo.js  ' + (fs.statSync(logoJs).size / 1024).toFixed(0) +
    ' KB inlined, ground ' + flat);

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
    fs.writeFileSync(path.join(res, 'values', 'ic_launcher_background.xml'),
      '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' +
      '    <color name="ic_launcher_background">' + flat + '</color>\n</resources>\n', 'utf8');
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
