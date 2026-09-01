/* The pictures a store asks for.

   Play wants a 1024x500 feature graphic and between two and eight phone
   screenshots; the App Store wants the screenshots at its own sizes.
   None of that is art direction — it is a spec, and a spec is a thing a
   script should meet so that nobody is cropping a PNG by hand at
   midnight the day before a submission.

   The screenshots are the real game, driven through the real interface,
   at the size the store asks for. Not mockups and not a phone frame
   pasted round a crop: what somebody sees on the page is what they get.

   The feature graphic is drawn in the page, with the game's own tokens
   and its own tile shapes, because everything else in this project is
   drawn rather than downloaded and a banner made in an image editor
   would be the only file here that was not.

     node tools/store.js        ->  store/graphics/
*/
const path = require('path');
const fs = require('fs');
const { launch, at, serve } = require('./_pw.js');

const OUT = path.join(__dirname, '..', 'store', 'graphics');

/* Play's phone screenshot spec: 16:9 or 9:16, each side 320-3840px.
   1080x1920 is the size every device mock uses and the one Play's own
   preview is laid out for. */
const PHONE = { width: 540, height: 960, scale: 2 };      /* -> 1080x1920 */

/* Each shot is a state of the real game and a line saying what it is,
   because a store listing is read in a scroll and a screenshot with no
   caption is a screenshot nobody parses. */
const SHOTS = [
  {
    file: '1-board',
    caption: { en: 'The faces you match are your own animals', tr: 'Eşleştirdiğin yüzler senin hayvanların' },
    /* A collect level rather than a bramble one: the hero shot should
       show the animals, and a board webbed with cut brambles shows the
       webbing. */
    go: async page => page.evaluate(() => {
      BL.startLevel(12, { perks: [] }); BL.setScreen('game'); BL.layoutBoard();
    }),
    settle: true
  },
  {
    file: '2-room',
    caption: { en: 'One of them is waiting upstairs', tr: 'Biri üst katta seni bekliyor' },
    go: async page => page.evaluate(() => { BL.setScreen('home'); BL.renderHome(); })
  },
  {
    file: '3-lane',
    caption: { en: 'Sixty levels down a country road, then a lane that keeps going',
               tr: 'Kır yolunda altmış bölüm, sonra devam eden bir sokak' },
    go: async page => page.evaluate(() => {
      BL.setScreen('map');
      const w = document.getElementById('mapWrap');
      const n = BL.map.nodes.find(x => x.n === 30);
      if (n && w) w.scrollTop = Math.max(0, n.y - w.clientHeight * 0.55);
    })
  },
  {
    file: '4-family',
    caption: { en: 'Six to bring home, each with its own move', tr: 'Eve götürülecek altı can, her birinin kendi hamlesi' },
    go: async page => page.evaluate(() => { BL.setScreen('family'); BL.renderFamily(); })
  },
  {
    file: '5-dusk',
    caption: { en: 'Day and Dusk, and it works in flight mode', tr: 'Gündüz ve Akşam, uçak modunda da çalışır' },
    go: async page => page.evaluate(() => {
      BL.save.settings.theme = 'dusk'; BL.applyTheme(); BL.persist(true);
      BL.setScreen('home'); BL.renderHome();
    })
  }
];

/* the caption band, drawn over the frame rather than beside it, so the
   image is all game and the words sit in the sky above the hedge */
async function caption(page, text) {
  await page.evaluate(t => {
    const el = document.createElement('div');
    el.id = '_cap';
    el.textContent = t;
    Object.assign(el.style, {
      position: 'fixed', left: '0', right: '0', top: '0', zIndex: '9999',
      padding: '18px 22px 20px', textAlign: 'center',
      font: '800 21px/1.25 Grandstander, sans-serif',
      color: 'var(--text)',
      /* solid, not a fade: a gradient let the moves counter ghost through
         it, which reads as a rendering fault rather than as a caption */
      background: 'var(--bg)',
      borderBottom: '1px solid var(--line-soft, rgba(0,0,0,.06))',
      pointerEvents: 'none'
    });
    document.body.appendChild(el);
  }, text);
}

async function setup(page) {
  await page.waitForFunction(() => window.BL && window.BL.save, null, { timeout: 20000 });
  await page.evaluate(() => {
    BL.save.pets = [BL.makePet(2, 1, 0, 'Marlow'), BL.makePet(0, 0, 0, 'Biscuit')];
    BL.save.activePet = BL.save.pets[0].id;
    BL.persist(true);
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save.pets.length);
  await page.evaluate(() => {
    const S = BL.save;
    S.reached = 34; S.coins = 1240; S.treats = 11;
    BL.BADGES.forEach(b => S.badges[b.id] = 1);
    for (let i = 1; i < 34; i++) S.stars[i] = 2 + (i % 2);
    S.toys = { yarn: 1, tennis: 1 }; S.food = { kibble: 5, tuna: 2 };
    S.furniture = { rug: 1, plant: 1, shelf: 1, lamp: 1 };
    S.room = { theme: 'oat', placed: ['rug', 'plant', 'shelf', 'lamp'] };
    S.pets.forEach(p => { p.bond = 9; p.food = 88; p.joy = 84; p.clean = 90; p.energy = 80; p.asleep = false; });
    BL.persist(true);
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save.pets.length);
}

const clear = page => page.evaluate(() => {
  const m = document.getElementById('modals');
  if (m) m.innerHTML = '';
  document.querySelectorAll('.veil').forEach(v => v.remove());
  const c = document.getElementById('_cap');
  if (c) c.remove();
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await launch();

  for (const lang of ['en', 'tr']) {
    const page = await browser.newPage({
      viewport: { width: PHONE.width, height: PHONE.height },
      deviceScaleFactor: PHONE.scale
    });
    await page.goto(at('/biscuit-lane.html'), { waitUntil: 'load' });
    await setup(page);
    await page.evaluate(l => { BL.setLang(l); }, lang);

    for (const shot of SHOTS) {
      await clear(page);
      await shot.go(page);
      await page.waitForTimeout(1100);
      /* A board photographed while it is still filling is half empty
         tiles and half falling ones, which is what the first attempt at
         this shipped. Wait for every cell to hold something and for the
         game to stop resolving. */
      if (shot.settle) {
        /* The model fills before the animation does, so waiting on the
           cells alone still photographs a staircase of tiles in mid-air —
           which is exactly what the second attempt shipped. BL.fast skips
           the tweens, which is what it is for. */
        await page.evaluate(() => { BL.fast = true; });
        await page.waitForFunction(() => {
          const G = window.BL && BL.game;
          if (!G || !G.B || G.busy) return false;
          for (let r = 0; r < G.B.h; r++) for (let c = 0; c < G.B.w; c++) {
            const cell = G.B.cell[r][c];
            if (cell.hole || cell.crate > 0 || cell.mole > 0) continue;
            if (!cell.tile) return false;
          }
          return true;
        }, null, { timeout: 15000 }).catch(() => {});
        /* and one more frame with the tweens off, so nothing is caught
           mid-swell either */
        await page.waitForTimeout(900);
        await page.evaluate(() => { BL.fast = false; });
        await page.waitForTimeout(220);
      }
      await clear(page);
      await caption(page, shot.caption[lang]);
      await page.waitForTimeout(180);
      const file = path.join(OUT, lang + '-' + shot.file + '.png');
      await page.screenshot({ path: file });
      console.log('  ' + path.basename(file));
    }
    await page.close();
  }

  /* ---- the feature graphic, 1024x500 ---- */
  const fg = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await fg.goto(at('/biscuit-lane.html'), { waitUntil: 'load' });
  await setup(fg);
  await fg.evaluate(() => {
    /* Drawn in the page so it uses the game's own palette, its own tile
       silhouettes and its own animal drawing code — the banner and the
       game cannot drift apart, because they are the same functions. */
    document.body.innerHTML = '<canvas id="fg" width="1024" height="500"></canvas>';
    document.body.style.margin = '0';
    const c = document.getElementById('fg').getContext('2d');
    const P = BL.PAL || {};
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#F6EADA';

    const g = c.createLinearGradient(0, 0, 0, 500);
    g.addColorStop(0, '#FBF1E2'); g.addColorStop(1, bg);
    c.fillStyle = g; c.fillRect(0, 0, 1024, 500);

    /* the verge and the hedge, the same shapes the lane is built from */
    c.fillStyle = '#B7CE95'; c.fillRect(0, 330, 1024, 170);
    c.fillStyle = '#4E8A5E';
    for (let x = -20; x < 1060; x += 42) {
      c.beginPath(); c.ellipse(x, 336, 34, 22, 0, 0, 6.2832); c.fill();
    }

    /* a row of tiles, each in its own silhouette, each a real breed */
    const order = [0, 1, 2, 3, 4, 5];
    order.forEach((t, i) => {
      const x = 596 + (i % 3) * 132, y = 118 + Math.floor(i / 3) * 132;
      c.save(); c.translate(x, y);
      BL.paintTile(c, t, 0, 108, false);
      c.restore();
    });

    /* the animal, drawn by the game */
    const pet = BL.activePet();
    if (pet) {
      c.save(); c.translate(300, 330);
      BL.drawBody(c, BL.specOfPet(pet), 150, { mouth: 'open', breath: .3 });
      c.restore();
    }

    c.fillStyle = '#2C2118';
    c.font = '800 62px Grandstander, sans-serif';
    c.textBaseline = 'alphabetic';
    c.fillText('Biscuit Lane', 62, 118);
    c.fillStyle = '#6B5949';
    c.font = '500 26px Karla, sans-serif';
    c.fillText('The cats and dogs on the board', 64, 162);
    c.fillText('are the pets you take home.', 64, 196);
  });
  await fg.waitForTimeout(700);
  await fg.screenshot({ path: path.join(OUT, 'feature-graphic.png') });
  console.log('  feature-graphic.png');
  await fg.close();

  await browser.close();
  if (srv && srv.stop) srv.stop();
  console.log('\n' + OUT);
})().catch(e => { console.error(e.message); process.exit(1); });
