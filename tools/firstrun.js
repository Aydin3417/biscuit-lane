/* The first five minutes, played rather than imagined.

   Everything else in this project measures the game from the inside: the
   solver plays levels, the model plays months, the suite drives the DOM.
   None of it answers the only question a store page is really asking —
   what happens to somebody who has never seen this before, in the first
   session, tap by tap.

   So this starts from an empty save and does what a person does: opens
   the game, goes through the onboarding by pressing whatever the screen
   offers, plays the first levels with real moves through the real
   interface, and photographs every state it passes through. It counts
   the taps and the seconds between them, because the two things that
   kill a first session are being asked for too many and being left with
   nothing to do.

   It reports rather than asserts. A first session is judged by looking.

     node tools/firstrun.js            five levels
     node tools/firstrun.js 8          eight
*/
const path = require('path');
const fs = require('fs');
const { launch, at, serve } = require('./_pw.js');

const OUT = path.join(__dirname, '..', 'shots', 'firstrun');
const LEVELS = +process.argv[2] || 5;

const log = [];
let step = 0;
const t0 = Date.now();

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const srv = await serve();
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  const problems = [];
  page.on('pageerror', e => problems.push('threw: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/vibrate|favicon/.test(t)) return;
    problems.push('console: ' + t.slice(0, 120));
  });

  const shot = async (name) => {
    await page.waitForTimeout(140);
    const file = String(++step).padStart(2, '0') + '-' + name + '.png';
    await page.screenshot({ path: path.join(OUT, file) });
    log.push({ at: ((Date.now() - t0) / 1000).toFixed(1) + 's', shot: file });
    return file;
  };

  /* a genuinely empty save: no pets, no progress, nothing seen */
  await page.goto(at('/biscuit-lane.html'), { waitUntil: 'load' });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL, null, { timeout: 20000 });
  await page.waitForTimeout(900);

  await shot('cold-open');

  /* ---- onboarding, pressed the way a person presses it ---- */
  let taps = 0;
  for (let i = 0; i < 10; i++) {
    const done = await page.evaluate(() => !!(BL.save.pets && BL.save.pets.length));
    if (done) break;

    /* pick something if the screen is offering a choice and none is made */
    const picked = await page.evaluate(() => {
      const ch = [...document.querySelectorAll('.choice')].filter(x => x.offsetParent !== null);
      if (ch.length > 1 && !document.querySelector('.choice.on')) { ch[1].click(); return true; }
      return false;
    });
    if (picked) { taps++; await page.waitForTimeout(260); }

    const label = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].filter(x => {
        const r = x.getBoundingClientRect();
        return r.width > 60 && r.height > 30 && x.offsetParent !== null;
      });
      const primary = b.find(x => /primary/.test(x.className)) || b[b.length - 1];
      if (!primary) return null;
      primary.setAttribute('data-probe', '1');
      return primary.textContent.trim().slice(0, 26);
    });
    if (!label) break;

    await shot('onboard-' + i + '-' + label.replace(/[^a-zA-Z]+/g, '').slice(0, 12).toLowerCase());
    await page.click('[data-probe="1"]').catch(() => {});
    taps++;
    await page.evaluate(() => document.querySelectorAll('[data-probe]').forEach(x => x.removeAttribute('data-probe')));
    await page.waitForTimeout(520);
  }
  const adopted = await page.evaluate(() => (BL.save.pets || []).length > 0);
  log.push({ note: 'onboarding: ' + taps + ' taps, ' + ((Date.now() - t0) / 1000).toFixed(1) + 's' });

  await shot('home-first');

  /* ---- the first levels, played for real ---- */
  for (let n = 1; n <= LEVELS; n++) {
    const before = Date.now();

    /* whatever the home screen offers to play next */
    await page.evaluate(() => {
      const m = document.getElementById('modals');
      if (m) m.innerHTML = '';
      document.querySelectorAll('.veil').forEach(v => v.remove());
    });
    await page.evaluate(lv => { BL.openLevelIntro(lv); }, n);
    await page.waitForTimeout(650);
    if (n <= 2) await shot('level' + n + '-card');

    const started = await page.evaluate(() => {
      const b = document.querySelector('#liGo');
      if (!b) return false;
      b.click(); return true;
    });
    if (!started) { problems.push('level ' + n + ': no start button on the card'); break; }
    await page.waitForTimeout(1400);

    /* Dismiss whatever the level opened with before playing it.

       The first version did not, and the first level's tutorial — "drag
       one tile onto its neighbour" — stayed on screen for the whole
       level and the win sheet queued behind it. The photograph showed
       the game explaining how to swap over a board that had already been
       cleared, which is a fault in the bot rather than in the game, and
       exactly the sort of thing that gets reported as a bug. A person
       taps Got it and then plays. */
    let taught = 0;
    for (let g = 0; g < 4; g++) {
      const gone = await page.evaluate(() => {
        const v = document.querySelector('#modals .veil:not([data-queued])');
        if (!v) return true;
        const b = v.querySelector('button');
        if (b) { b.click(); return false; }
        v.remove(); return false;
      });
      if (gone) break;
      taught++;
      await page.waitForTimeout(420);
    }
    if (taught) log.push({ note: 'level ' + n + ': ' + taught + ' thing(s) to read before the first move' });
    if (n === 1) await shot('level1-board');

    /* play it: the game's own legal moves, chosen at random, which is a
       worse player than a person and therefore a fair floor */
    const result = await page.evaluate(async () => {
      const G = BL.game;
      let guard = 0;
      while (!G.over && G.moves > 0 && guard++ < 200) {
        const ms = BL.allMoves(G.B);
        if (!ms.length) break;
        const m = ms[(Math.random() * ms.length) | 0];
        await BL.tryMove(m[0], m[1]);
      }
      return { over: G.over, left: G.moves, score: G.score,
               goals: G.goals.map(g => g.have + '/' + g.need) };
    });
    /* How long the game takes to say anything after the last move.

       The first version waited a fixed 1.6 seconds and then reported
       that four levels out of five "ended and nothing was shown", which
       was not true: the celebration was still running. The number that
       matters is not whether a sheet appears but how long somebody sits
       in front of a finished board waiting for it — that is dead time in
       the single most important moment of the session. */
    const lastMove = Date.now();
    const sheet = await page.waitForFunction(() => {
      const h = document.querySelector('#modals .veil:not([data-queued]) h2');
      return h ? h.textContent.trim() : false;
    }, null, { timeout: 12000 }).then(h => h.jsonValue()).catch(() => null);
    const wait = ((Date.now() - lastMove) / 1000).toFixed(1);
    const secs = ((Date.now() - before) / 1000).toFixed(1);
    log.push({ note: 'level ' + n + ': ' + wait + 's from the last move to "' +
      (sheet || 'nothing') + '"' });
    log.push({ level: n, secs: secs + 's', sheet: sheet || '(none)', goals: result.goals.join(' ') });
    if (n <= 2 || !sheet || /out of|hamle bitti/i.test(sheet || '')) {
      await shot('level' + n + '-result');
    }
    if (!sheet) problems.push('level ' + n + ': the level ended and nothing was shown');

    /* dismiss whatever is up and go round again */
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('#modals button')];
      const go = btns.find(b => /map|lane|sokak|next|devam|kapat|close|tamam|ok/i.test(b.textContent));
      (go || btns[0] || {}).click && (go || btns[0]).click();
    });
    await page.waitForTimeout(900);
  }

  await page.evaluate(() => {
    const m = document.getElementById('modals');
    if (m) m.innerHTML = '';
    document.querySelectorAll('.veil').forEach(v => v.remove());
    BL.setScreen('home'); BL.renderHome();
  });
  await shot('home-after');

  const state = await page.evaluate(() => ({
    reached: BL.save.reached, coins: BL.save.coins, treats: BL.save.treats,
    hearts: BL.save.hearts, bond: (BL.save.pets[0] || {}).bond,
    stars: Object.keys(BL.save.stars || {}).length
  }));

  await browser.close();
  if (srv && srv.stop) srv.stop();

  /* ---- the report ---- */
  console.log('the first session, ' + LEVELS + ' levels\n');
  log.forEach(l => {
    if (l.note) console.log('  ' + l.note);
    else if (l.level !== undefined) {
      console.log('  level ' + String(l.level).padEnd(3) + l.secs.padStart(7) +
        '   ' + l.sheet.padEnd(18) + l.goals);
    }
  });
  console.log('');
  console.log('  after ' + LEVELS + ' levels: reached ' + state.reached +
    ', ' + state.coins + ' coins, ' + state.treats + ' treats, ' +
    state.hearts + ' hearts, bond ' + state.bond);
  console.log('  total ' + ((Date.now() - t0) / 1000).toFixed(0) + 's, ' + step + ' frames');
  console.log('');
  if (problems.length) {
    [...new Set(problems)].slice(0, 10).forEach(p => console.log('  ! ' + p));
  } else {
    console.log('  nothing threw and every level said something when it ended');
  }
  console.log('\n' + OUT);
})().catch(e => { console.error(e.message); process.exit(1); });
