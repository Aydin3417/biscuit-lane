/* Dev-only: the game's own drawings exported as PNGs for the 1.4 concept
   page next to this file. Nothing here ships; it lets the concept use the
   actual room, animals, food and furniture rather than placeholders.

     node design/concept/export-art.js */
const path = require('path');
const fs = require('fs');
const PW = require('../../tools/_pw.js');
const OUT = path.join(__dirname, 'art');

(async () => {
  const server = await PW.serve();
  const browser = await PW.launch();
  const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
  /* the room and the theme keep the real hour; the concept is shown at noon */
  await page.addInitScript(() => { Date.prototype.getHours = () => 12; Date.prototype.getMinutes = () => 0; });
  await page.goto(PW.at('/pawtika.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save);
  const files = await page.evaluate(() => {
    const out = {};
    const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const breed = re => Math.max(0, BL.BREEDS.findIndex(b => re.test(b.name || b.en || b.id || '')));
    /* animals, sitting */
    [['marmalade', /marmalade/i], ['beagle', /beagle/i], ['sable', /sable/i], ['siamese', /siamese/i]].forEach(([id, re]) => {
      const c = cv(400, 420); const x = c.getContext('2d');
      x.translate(200, 70); BL.drawBody(x, Object.assign(BL.specOf(breed(re)), { stage: 1 }), 170, { mouth: 'open', mood: 'happy' });
      out['pet-' + id] = c.toDataURL('image/png');
    });
    /* food and toys */
    ['kibble', 'tuna', 'stew', 'cake', 'yarn', 'tennis', 'wand', 'puzzle'].forEach(id => {
      const c = cv(300, 300); const x = c.getContext('2d');
      x.translate(150, 150); BL.paintGood(x, id, 230);
      out['good-' + id] = c.toDataURL('image/png');
    });
    /* the room, as the home screen draws it, bare and furnished */
    const room = (placed, name) => {
      BL.save.room.placed = placed; BL.save.room.theme = 'oat';
      BL.setScreen('home'); BL.renderRoom(0.016); BL.renderRoom(0.016);
      out[name] = document.querySelector('#room').toDataURL('image/png');
    };
    room([], 'room-bare');
    room(['rug', 'armchair', 'lamp', 'shelf', 'petbed', 'plant', 'lights'], 'room-done');
    room(['rug', 'plant'], 'room-started');
    return out;
  });
  fs.mkdirSync(OUT, { recursive: true });
  for (const k in files) fs.writeFileSync(path.join(OUT, k + '.png'), Buffer.from(files[k].split(',')[1], 'base64'));
  console.log(Object.keys(files).length + ' pictures in ' + OUT);
  await browser.close();
  if (server && server.stop) server.stop();
})().catch(e => { console.error(e); process.exit(1); });
