/* Dev-only: drive the built game hard and report anything it says.

   Not a substitute for the suites — this is the wide net. It walks every
   screen, opens every sheet, plays real moves, adopts, buys, switches
   language and theme, and collects console errors, page errors, failed
   requests, and a set of invariants checked after each step.

     node tools/hunt.js
*/
const PW = require('./_pw.js');
const devices = PW.devices;

const found = [];
const note = (where, what) => { const line = where + ': ' + what; if (found.indexOf(line) < 0) found.push(line); };

(async () => {
  /* puts its own server up, like tools/browser.js */
  const server = await PW.serve();
  const browser = await PW.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'], hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  let step = 'boot';
  page.on('pageerror', e => note(step, 'threw: ' + String(e).slice(0, 120)));
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') {
      const t = m.text();
      if (/favicon|Download the React|sourcemap/i.test(t)) return;
      note(step, m.type() + ': ' + t.slice(0, 120));
    }
  });
  page.on('response', r => { if (r.status() >= 400 && !/manifest|icons\//.test(r.url())) note(step, r.status() + ' ' + r.url().split('/').pop()); });

  await page.goto(PW.at('/biscuit-lane.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save, null, { timeout: 20000 });

  /* an invariant sweep run after every step */
  const check = async (where) => {
    const bad = await page.evaluate(() => {
      const out = [];
      const B = BL.game.B, S = BL.save;
      if (B) {
        let tiles = 0, holes = 0;
        for (let r = 0; r < B.h; r++) for (let c = 0; c < B.w; c++) {
          const cell = B.cell[r][c];
          if (!cell) { out.push('missing cell ' + r + ',' + c); continue; }
          if (cell.hole) { holes++; continue; }
          if (cell.tile) {
            tiles++;
            const t = cell.tile;
            if (!isFinite(t.x) || !isFinite(t.y)) out.push('tile at ' + r + ',' + c + ' has NaN position');
            if (t.type >= 0 && t.type >= B.types) out.push('tile type ' + t.type + ' above the level max ' + B.types);
          }
        }
        if (BL.screen === 'game' && !BL.game.busy && !BL.game.over && tiles === 0) out.push('the board is empty while playable');
      }
      /* the cast has to stay a permutation whatever has happened */
      const cast = BL.castOf();
      const sorted = cast.slice().sort((a, b) => a - b);
      if (sorted.length !== BL.BREEDS.length || !sorted.every((v, i) => v === i)) {
        out.push('the cast is no longer a permutation: ' + cast.join(','));
      }
      /* the save must never hold something that cannot be reloaded */
      ['coins', 'treats', 'hearts'].forEach(k => {
        if (!isFinite(S[k]) || S[k] < 0) out.push(k + ' is ' + S[k]);
      });
      (S.pets || []).forEach(p => {
        ['food', 'joy', 'clean', 'energy', 'bond'].forEach(k => {
          if (!isFinite(p[k]) || p[k] < 0 || (k !== 'bond' && p[k] > 100)) {
            out.push(p.name + '.' + k + ' is ' + p[k]);
          }
        });
        if (!BL.BREEDS[p.breed]) out.push(p.name + ' has breed ' + p.breed);
      });
      try { JSON.parse(JSON.stringify(S)); } catch (e) { out.push('the save will not serialise'); }
      return out;
    });
    bad.forEach(b => note(where, b));
  };

  const go = async (label, fn, settle) => {
    step = label;
    try { await page.evaluate(fn); } catch (e) { note(label, 'driver threw: ' + String(e).slice(0, 100)); }
    await page.waitForTimeout(settle || 500);
    await check(label);
  };

  /* --- first run --- */
  await check('first paint');
  await go('adopt', () => {
    BL.save.pets = [BL.makePet(5, 0, 0, 'Bun')];
    BL.save.activePet = BL.save.pets[0].id;
    BL.castRebuild(); BL.persist(true);
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save.pets.length);
  await go('after reload', () => { BL.save.reached = 40; BL.save.coins = 9000; BL.save.treats = 40; BL.persist(true); });

  for (const s of ['home', 'map', 'shop', 'family']) {
    await go('screen ' + s, new Function('BL.setScreen("' + s + '")'), 650);
  }
  for (const tab of ['food', 'toys', 'boost', 'style', 'room']) {
    await go('shop tab ' + tab, new Function('BL.setScreen("shop"); const b=[...document.querySelectorAll(".tabs button")].find(x=>/' + tab + '/i.test(x.textContent)); if(b) b.click();'), 450);
  }
  for (const sheet of ['openSettings', 'howToPlay', 'keyboardHelp']) {
    await go('sheet ' + sheet, new Function('document.querySelectorAll(".veil").forEach(v=>v.remove()); BL.' + sheet + '()'), 450);
  }
  await go('close sheets', () => document.querySelectorAll('.veil').forEach(v => v.remove()));

  /* --- play, for real --- */
  for (const n of [1, 6, 12, 20, 28, 34, 38, 42, 50, 57, 61, 88, 140]) {
    step = 'level ' + n;
    await page.evaluate(lv => {
      document.querySelectorAll('.veil').forEach(v => v.remove());
      BL.startLevel(lv, { perks: BL.perksFor(BL.activePet()) });
      BL.setScreen('game');
    }, n);
    await page.waitForTimeout(900);
    for (let m = 0; m < 8; m++) {
      await page.evaluate(async () => {
        for (let i = 0; i < 80 && BL.game.busy; i++) await new Promise(r => setTimeout(r, 25));
        const ms = BL.allMoves(BL.game.B);
        if (ms.length) await BL.tryMove(ms[(Math.random() * ms.length) | 0][0], ms[(Math.random() * ms.length) | 0][1]);
      }).catch(e => note(step, 'move threw: ' + String(e).slice(0, 90)));
      await page.waitForTimeout(260);
    }
    await check(step);
  }

  /* --- language, theme, adoption mid-flight --- */
  await go('turkish', () => BL.setLang('tr'), 700);
  await go('dark', () => { BL.save.settings.theme = 'dark'; BL.applyTheme(); }, 500);
  await go('adopt a second', () => {
    BL.save.pets.push(BL.makePet(2, 2, 0, 'İki'));
    BL.castRebuild(); BL.persist(true); BL.renderFamily();
  }, 600);
  await go('play after adopting', () => { BL.startLevel(29, { perks: [] }); BL.setScreen('game'); }, 1400);
  await go('english + light', () => { BL.setLang('en'); BL.save.settings.theme = 'light'; BL.applyTheme(); }, 700);

  await browser.close();
  server.stop();
  console.log(found.length ? 'FOUND ' + found.length + ':' : 'nothing found');
  found.forEach(f => console.log('  ' + f));
  process.exitCode = found.length ? 1 : 0;
})();
