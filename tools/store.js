/* Dev-only: the pictures a store listing needs, drawn from the real
   game rather than mocked up.

     node tools/store.js

   Play wants phone shots at 1080x1920 and one 1024x500 feature graphic.
   App Store wants 6.7" iPhone at 1290x2796, and iPad 12.9" at 2048x2732
   if the app ships for iPad. All three phone sizes are the same layout
   at a different device pixel ratio, so they are captured from the same
   CSS viewport and only the scale changes — which is also why they all
   agree with each other, and with what a player actually sees.

   The save is posed, not faked: a real pet, real progress, real boards.
   A listing screenshot of a state the game cannot reach is the fastest
   way to have a review rejected and the slowest way to find out. */
const path = require('path');
const fs = require('fs');
const PW = require('./_pw.js');

const OUT = path.join(__dirname, '..', 'shots', 'store');

/* [folder, css width, css height, dpr] -> the pixel size a store wants */
const DEVICES = [
  ['play-phone', 360, 640, 3],      // 1080 x 1920
  ['ios-6.7', 430, 932, 3],         // 1290 x 2796
  ['ios-ipad', 512, 683, 4]         // 2048 x 2732
];

/* A pet far enough along to have a room worth looking at, and a lane
   with stars behind it. Nothing here is unreachable. */
const POSE = `(() => {
  const S = BL.save;
  S.pets = [BL.makePet(0, 0, 0, 'Biscuit')];
  S.activePet = S.pets[0].id;
  S.coins = 1840; S.treats = 12; S.hearts = 5;
  S.reached = 28;
  for (let i = 1; i < 28; i++) S.stars[i] = i % 4 === 0 ? 2 : 3;
  S.scores[7] = 18240; S.scores[12] = 24980;
  S.food = { kibble: 4, tuna: 2, stew: 1, cake: 1 };
  S.toys = { yarn: 1, tennis: 1 };
  S.boosters = { moves: 3, hammer: 2, swap: 2, shuffle: 1 };
  S.furniture = { rug: 1, plant: 1, shelf: 1 };
  S.roomThemes = { oat: 1, sage: 1 };
  S.room = { theme: 'oat', placed: ['rug', 'plant', 'shelf'] };
  S.seen = { mud:1, crate:1, rescue:1, bramble:1, swap:1, pet:1, special:1 };
  S.streak = 4; S.lastGift = Date.now();
  S.jar = { fill: 96, opened: 0 };
  BL.BADGES.forEach(b => S.badges[b.id] = 1);   /* no congratulations mid-shot */
  const p = S.pets[0];
  p.bond = 14; p.food = 88; p.joy = 92; p.clean = 90; p.energy = 78;
  p.trait = 'playful'; p.asleep = false;
  BL.persist(true);
})()`;

(async () => {
  const server = await PW.serve();
  const browser = await PW.launch();

  for (const [name, w, h, dpr] of DEVICES) {
    const dir = path.join(OUT, name);
    fs.mkdirSync(dir, { recursive: true });
    const page = await browser.newPage({
      viewport: { width: w, height: h }, deviceScaleFactor: dpr
    });
    await page.goto(PW.at('/index.html'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.BL && window.BL.save, null, { timeout: 20000 });
    await page.evaluate(POSE);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.BL && window.BL.save.pets.length);
    await page.waitForTimeout(1400);
    /* the daily gift is the one sheet that opens itself */
    await page.evaluate(() => { const b = document.getElementById('dgOk'); if (b) b.click(); });
    await page.waitForTimeout(700);
    await page.evaluate(() => document.querySelectorAll('#onb,.veil').forEach(v => v.remove()));

    const shot = async n => {
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(dir, n + '.png') });
      console.log('  ' + name + '/' + n + '.png');
    };

    /* 1 — the room, which is what makes this not a candy game */
    await page.evaluate(() => BL.setScreen('home'));
    await page.waitForTimeout(1200);
    await shot('1-home');

    /* 2 — the board mid-level, the thing being sold */
    await page.evaluate(() => document.getElementById('goPlay').click());
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('#modals button')].find(x => /Start/.test(x.innerText));
      if (b) b.click();
    });
    await page.waitForTimeout(2200);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('#modals button')].find(x => /Got it/.test(x.innerText));
      if (b) b.click();
    });
    await page.waitForTimeout(1200);
    /* a few real moves so the board is not a fresh deal, and the score
       and the star track have something on them */
    await page.evaluate(async () => {
      const g = BL.game;
      for (let i = 0; i < 6; i++) {
        const h = BL.bestHint(); if (!h) break;
        BL.tryMove(h[0], h[1]);
        for (let k = 0; k < 60 && g.busy; k++) await new Promise(r => setTimeout(r, 50));
      }
    });
    await shot('2-board');

    /* 3 — the pet's own move, caught mid-leap off the board canvas */
    const leap = await page.evaluate(async () => {
      const g = BL.game; g.charge = 100;
      const cv = document.getElementById('board');
      let url = null;
      const watch = () => {
        if (g.leap && !url && g.leap.t / g.leap.ttl >= 0.5) url = cv.toDataURL('image/png');
        if (!url) requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
      BL.firePetAbility();
      await new Promise(r => setTimeout(r, 1400));
      return url;
    });
    if (leap) {
      fs.writeFileSync(path.join(dir, '3-ability.png'),
        Buffer.from(leap.slice(leap.indexOf(',') + 1), 'base64'));
      console.log('  ' + name + '/3-ability.png (board canvas)');
    }

    /* 4 — the lane, which is the progression */
    await page.evaluate(() => { BL.game.over = true; BL.setScreen('map'); });
    await page.waitForTimeout(1400);
    await page.evaluate(() => document.querySelectorAll('.veil').forEach(v => v.remove()));
    await shot('4-lane');

    /* 5 — the family, which is the reason to come back */
    await page.evaluate(() => BL.setScreen('family'));
    await page.waitForTimeout(1300);
    await shot('5-family');

    await page.close();
  }

  /* ---------- the feature graphic ----------

     Play asks for 1024x500 and puts text over the top of it in places
     you cannot predict, so the mark sits left of centre and the right
     third is left as ground on purpose. */
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await page.goto(PW.at('/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save);
  /* the fonts the game uses have to be there before anything is drawn
     into a canvas with them, or the first frame falls back to serif */
  await page.evaluate(() => document.fonts.ready);
  const feat = await page.evaluate(() => {
    const W = 1024, H = 500;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#FBF0DC'); g.addColorStop(1, '#E7C89A');
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    /* the lane, curving away to the right, so the eye lands on the cast */
    c.fillStyle = '#8FB878';
    c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) c.lineTo(x, H - 150 - Math.sin(x / 140) * 22);
    c.lineTo(W, H); c.closePath(); c.fill();
    c.fillStyle = '#79A365';
    c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) c.lineTo(x, H - 92 - Math.sin(x / 110 + 1.2) * 14);
    c.lineTo(W, H); c.closePath(); c.fill();
    /* the path itself */
    c.fillStyle = '#D8BE92';
    c.beginPath();
    c.moveTo(360, H); c.bezierCurveTo(430, H - 90, 700, H - 110, W, H - 130);
    c.lineTo(W, H); c.closePath(); c.fill();

    /* the mark and the name, left, where Play leaves room */
    c.save(); c.translate(58, 96); BL.drawLogo(c, 104); c.restore();
    c.fillStyle = '#3E2A18';
    c.font = '800 76px Grandstander, sans-serif';
    c.textBaseline = 'alphabetic';
    c.fillText('Biscuit Lane', 58, 292);
    c.fillStyle = 'rgba(62,42,24,.72)';
    c.font = '500 27px Karla, sans-serif';
    c.fillText('Match three. Raise the animals you match.', 60, 336);

    /* the cast, on the path, right of the text */
    /* feet on the path, and the far one pulled in from the edge: a
       clipped animal on a store banner reads as a mistake */
    [[2, 664, 322, 130], [0, 800, 286, 166], [3, 928, 322, 130]]
      .forEach(([breed, x, y, s]) => {
        c.save(); c.translate(x, y);
        BL.drawBody(c, BL.specOf(breed, undefined, undefined), s, { mouth: 'smile' });
        c.restore();
      });
    return cv.toDataURL('image/png');
  });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'feature-graphic-1024x500.png'),
    Buffer.from(feat.slice(feat.indexOf(',') + 1), 'base64'));
  console.log('  feature-graphic-1024x500.png');

  await browser.close();
  if (server.stop) server.stop();
  console.log('\nwritten to ' + OUT);
})();
