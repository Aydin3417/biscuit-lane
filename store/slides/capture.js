/* The raw material for store/slides/slides.html: the real game, at an
   iPhone's own point size, in the states the slides talk about.

     node store/slides/capture.js          ->  store/slides/raw/

   The slides are a frame and a headline around these pictures and
   nothing else. Nothing in a slide is redrawn by hand — every screen is
   the game itself, set up the way tools/store.js sets it up (the same
   save, the same two animals), so a slide cannot promise a screen the
   build does not have.

   393 x 798 at 3x is an iPhone 6.9"-class screen less the status bar:
   the frame in the slide draws the island and the clock above it, where
   the phone's own safe area would be. The iPad set is 1032 x 1376 at 2x,
   the 13" screen whole. Each animal is also drawn alone on a clear
   canvas by the game's own drawBody, for the slides to sit one on top of
   the phone. */
const path = require('path');
const fs = require('fs');
const { launch, at, serve } = require('../../tools/_pw.js');

const OUT = path.join(__dirname, 'raw');
const DEVICES = [
  { id: 'phone', width: 393, height: 798, scale: 3 },
  { id: 'pad', width: 1032, height: 1336, scale: 2 }
];

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
    S.reached = 34; S.coins = 1240; S.treats = 11; S.hearts = 5;
    const bs = Object.assign({}, S.stats || {});
    Object.assign(bs, { played: 41, cleared: 33, bestCombo: 6, tilesPopped: 5400, rescued: 12, cared: 60, biggestClear: 28 });
    S.stats = bs;
    BL.checkBadges();
    for (let i = 1; i < 34; i++) S.stars[i] = 2 + (i % 2);
    S.toys = { yarn: 1, tennis: 1 }; S.food = { kibble: 5, tuna: 2 };
    S.furniture = { rug: 1, shelf: 1, armchair: 1, basket: 1, tower: 1 };
    S.room = { theme: 'oat', placed: ['rug', 'shelf', 'armchair', 'basket', 'tower'] };
    S.pets.forEach(p => { p.bond = 9; p.food = 88; p.joy = 84; p.clean = 90; p.energy = 80; p.asleep = false; });
    S.seen = { swap: 1, pet: 1, special: 1, bramble: 1, mole: 1, rescue: 1, crate: 1, mud: 1, ice: 1 };
    S.settings.theme = 'light';
    BL.persist(true);
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save.pets.length);
}

const clear = page => page.evaluate(() => {
  const m = document.getElementById('modals');
  if (m) m.innerHTML = '';
  document.querySelectorAll('.veil').forEach(v => v.remove());
  const t = document.getElementById('toasts');
  if (t) t.innerHTML = '';
});

async function settle(page) {
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
  await page.waitForTimeout(900);
  await page.evaluate(() => { BL.fast = false; });
  await page.waitForTimeout(250);
}

const SHOTS = [
  {
    id: 'board',
    go: async page => {
      await page.evaluate(() => { BL.startLevel(12, { perks: [] }); BL.setScreen('game'); BL.layoutBoard(); });
      await page.waitForTimeout(900);
      await clear(page);
      await settle(page);
      await page.evaluate(() => {
        const G = BL.game, SP = BL.SP;
        [[2, 1, SP.ROW], [4, 5, SP.BOMB], [6, 2, SP.COL], [5, 6, SP.ROW]].forEach(([r, c, sp]) => {
          const cell = G.B.cell[r] && G.B.cell[r][c];
          if (cell && cell.tile && cell.tile.type >= 0) cell.tile.sp = sp;
        });
        G.moves = Math.max(4, G.moves - 7);
        G.score = Math.round((G.starTargets[0] + G.starTargets[1]) / 2);
        G.goals.forEach(g => { g.have = Math.round(g.need * .55); });
        G.charge = 62;
        G.hintT = 0; G.hint = null;
        BL.syncStars(); BL.syncGoals(); BL.syncHud();
      });
    }
  },
  {
    id: 'room',
    go: async page => { await page.evaluate(() => { BL.setScreen('home'); BL.renderHome(); }); }
  },
  {
    id: 'lane',
    go: async page => {
      await page.evaluate(() => {
        BL.setScreen('map');
        const w = document.getElementById('mapWrap');
        const n = BL.map.nodes.find(x => x.n === 31);
        if (n && w) w.scrollTop = Math.max(0, n.y - w.clientHeight * 0.5);
      });
    }
  },
  {
    id: 'shop',
    go: async page => {
      await page.evaluate(() => { BL.setScreen('shop'); BL.renderShop(); });
      await page.waitForTimeout(300);
      await page.evaluate(() => { const b = document.querySelector('.tabs [data-t="look"]'); if (b) b.click(); });
      await page.waitForTimeout(500);
      /* down to the furniture: that is the shelf with pictures on it */
      await page.evaluate(() => {
        const things = [...document.querySelectorAll('.sectitle h3')].find(h => /^(Things|Eşya)/.test((h.innerText || '').trim()));
        if (!things) return;
        let sc = things.parentElement;
        while (sc && !(sc.scrollHeight > sc.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
        if (sc) sc.scrollTop += things.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12;
      });
    }
  },
  {
    id: 'gift',
    go: async page => {
      await page.evaluate(() => { BL.setScreen('home'); BL.renderHome(); BL.save.lastGift = 0; BL.save.streak = 3; BL.openDailyGift(); });
      await page.waitForTimeout(600);
    },
    keepModal: true
  },
  {
    id: 'win',
    go: async page => {
      await page.evaluate(() => { BL.startLevel(BL.save.reached, { perks: [] }); BL.setScreen('game'); BL.layoutBoard(); });
      await page.waitForTimeout(900);
      await clear(page);
      await settle(page);
      await page.evaluate(() => {
        const G = BL.game;
        G.score = G.starTargets[2] + 1840;
        G.moves = 0;
        BL.syncStars(); BL.syncHud();
        G.starsEarned = 3;
        BL.showWin();
      });
      await page.waitForTimeout(1600);
      await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
    },
    keepModal: true
  }
];

/* the six animals, alone, on nothing */
async function pets(page) {
  return page.evaluate(() => {
    const out = {};
    BL.BREEDS.forEach((b, i) => {
      const cv = document.createElement('canvas');
      const S = 600;
      cv.width = S; cv.height = S;
      const c = cv.getContext('2d');
      c.translate(S / 2, S * .3);
      BL.art.drawBody(c, BL.art.specOf(i, b.coats[0], b.eyes), S * .42, { mouth: i % 2 ? 'open' : 'smile' });
      /* trimmed to what was drawn, so a slide can stand it on an edge */
      const px = c.getImageData(0, 0, S, S).data;
      let x0 = S, y0 = S, x1 = 0, y1 = 0;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (px[(y * S + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      const t = document.createElement('canvas');
      t.width = x1 - x0 + 1; t.height = y1 - y0 + 1;
      t.getContext('2d').drawImage(cv, x0, y0, t.width, t.height, 0, 0, t.width, t.height);
      out[b.id || ('b' + i)] = t.toDataURL('image/png');
    });
    return out;
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await launch();
  /* the phone unless asked: the app ships for iPhone only (see README.md
     here), and the iPad captures are kept for the day that changes */
  const only = process.argv[2] || 'phone';
  for (const dev of DEVICES) {
    if (only !== 'all' && only !== dev.id) continue;
    for (const lang of ['en', 'tr']) {
      const ctx = await browser.newContext({
        viewport: { width: dev.width, height: dev.height },
        deviceScaleFactor: dev.scale, isMobile: true, hasTouch: true
      });
      const page = await ctx.newPage();
      await page.goto(at('/pawtika.html'), { waitUntil: 'load' });

      /* the breed picker first, on a game nobody has started */
      await page.waitForFunction(() => window.BL, null, { timeout: 20000 });
      await page.evaluate(l => { BL.setLang(l); }, lang);
      await page.evaluate(() => { const b = document.querySelector('#obNext'); if (b) b.click(); });
      await page.waitForTimeout(700);
      if (await page.$('.choiceGrid')) {
        await page.screenshot({ path: path.join(OUT, `${dev.id}-${lang}-breeds.png`) });
        console.log(`${dev.id}-${lang}-breeds`);
      }

      await setup(page);
      await page.evaluate(l => { BL.setLang(l); }, lang);
      if (dev.id === 'phone' && lang === 'en') {
        const p = await pets(page);
        Object.keys(p).forEach(k => fs.writeFileSync(path.join(OUT, `pet-${k}.png`), Buffer.from(p[k].split(',')[1], 'base64')));
        console.log('pets', Object.keys(p).join(' '));
      }
      for (const shot of SHOTS) {
        await clear(page);
        await shot.go(page);
        await page.waitForTimeout(1000);
        if (!shot.keepModal) await clear(page);
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(OUT, `${dev.id}-${lang}-${shot.id}.png`) });
        console.log(`${dev.id}-${lang}-${shot.id}`);
      }
      await ctx.close();
    }
  }
  await browser.close();
  srv.stop();
})().catch(e => { console.error(e); process.exit(1); });
