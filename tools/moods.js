/* Dev-only: the room, once per mood.

   The animal is the half of this game that is not a match-3, and until
   now it looked the same whether it was starving or delighted. These
   shots are how that gets judged rather than assumed: six moods, the
   same pet, the same room, nothing else changed.

     node tools/moods.js
*/
const PW_PATH = process.env.PLAYWRIGHT ||
  'C:/Users/Casper/Desktop/Proje/Cotidie-Ads-Opus/node_modules/playwright';
const CHROME = process.env.CHROME ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';
const path = require('path');
const fs = require('fs');
const { chromium } = require(PW_PATH);

const out = path.join(__dirname, '..', 'shots', 'moods');
fs.mkdirSync(out, { recursive: true });
const URL = 'http://localhost:5173/biscuit-lane.html';

/* the stat sets that land on each branch of moodOf() */
const MOODS = [
  ['happy',   { food: 92, joy: 90, clean: 88, energy: 86 }],
  ['content', { food: 70, joy: 62, clean: 68, energy: 66 }],
  ['lonely',  { food: 70, joy: 38, clean: 68, energy: 66 }],
  ['hungry',  { food: 14, joy: 70, clean: 70, energy: 70 }],
  ['dirty',   { food: 70, joy: 70, clean: 14, energy: 70 }],
  ['tired',   { food: 70, joy: 70, clean: 70, energy: 14 }],
  ['bored',   { food: 70, joy: 14, clean: 70, energy: 70 }]
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('  ! sayfa hatası: ' + e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save, null, { timeout: 15000 });
  await page.evaluate(() => {
    BL.save.pets = [BL.makePet(2, 1, 0, 'Marlow')];
    BL.save.activePet = BL.save.pets[0].id;
    BL.persist(true);
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save.pets.length);
  await page.evaluate(() => {
    const S = BL.save;
    S.coins = 900; S.reached = 24;
    BL.BADGES.forEach(b => S.badges[b.id] = 1);
    S.room = { theme: 'oat', placed: ['rug', 'plant', 'shelf'] };
    BL.persist(true);
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save.pets.length);
  await page.evaluate(() => document.querySelectorAll('.veil').forEach(v => v.remove()));

  /* The room sits behind whatever the game has to say — a gift, a
     badge, a stage — and those blur it. Clearing them before every
     frame is the only way to photograph the room itself. */
  /* The room is always doing something — grooming, stretching, mid-blink
     — and a frame caught during one says nothing about the mood it was
     meant to show. Two of the first three shots landed on a closed-eyed
     groom. This holds the animal still and open-eyed for the camera. */
  const still = () => page.evaluate(() => {
    BL.room.idleKind = null; BL.room.idleLeft = 0; BL.room.idleT = 999;
    BL.room.state = 'idle'; BL.room.stateT = 0; BL.room.noticed = 0;
    const p = BL.activePet();
    if (p && window.BL.petRig) {
      const r = BL.petRig(p);
      r.blink = 0; r.blinkT = -1; r.blinkAt = 999;
    }
  });
  const clear = () => page.evaluate(() => {
    const m = document.getElementById('modals');
    if (m) m.innerHTML = '';
    document.querySelectorAll('.veil').forEach(v => v.remove());
    document.body.classList.remove('modalOpen');
  });
  const box = async () => {
    await page.evaluate(() => BL.setScreen('home'));
    await page.waitForTimeout(200);
    await clear();
    return page.locator('#room').boundingBox();
  };

  for (const [name, stats] of MOODS) {
    await page.evaluate(s => {
      const p = BL.activePet();
      Object.assign(p, s, { asleep: false });
      BL.persist(true);
      BL.setScreen('home');
    }, stats);
    await clear();
    await page.waitForTimeout(1500);
    await clear();
    await still();
    await page.waitForTimeout(120);
    const got = await page.evaluate(() => BL.moodOf(BL.activePet()));
    const b = await box();
    await page.screenshot({ path: path.join(out, name + '.png'), clip: b });
    console.log('  ' + name + (got === name ? '  ✓' : '  ✗ oyun "' + got + '" diyor'));
  }

  /* asleep is its own thing */
  await page.evaluate(() => {
    const p = BL.activePet();
    Object.assign(p, { food: 60, joy: 60, clean: 60, energy: 10, asleep: true });
    BL.persist(true); BL.setScreen('home');
  });
  await clear();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(out, 'sleeping.png'), clip: await box() });
  console.log('  sleeping');

  /* and the eyes following a finger */
  await page.evaluate(() => {
    const p = BL.activePet();
    Object.assign(p, { food: 80, joy: 80, clean: 80, energy: 80, asleep: false });
    BL.persist(true); BL.setScreen('home');
  });
  await clear();
  await page.waitForTimeout(600);
  const b = await box();
  for (const [tag, fx, fy] of [['left', .08, .35], ['right', .92, .35], ['down', .5, .95]]) {
    await still();
    await page.mouse.move(b.x + b.width * fx, b.y + b.height * fy);
    await page.waitForTimeout(700);
    await still();
    await page.screenshot({ path: path.join(out, 'look-' + tag + '.png'), clip: b });
    console.log('  look-' + tag);
  }
  await browser.close();
  console.log('shots/moods/');
})();
