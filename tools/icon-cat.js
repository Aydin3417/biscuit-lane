/* Dev-only: a candidate app icon drawn by the game's own animal code.

     node tools/icon-cat.js            writes design/icon-cat-candidate.png

   WHY THERE IS A SECOND ICON

   The shipped mark is a drawing of a paw-shaped handheld with two pixel
   animals in its screen (tools/icon.js). At the size a search result
   shows it, about sixty points, it reads as a pink toy: nothing in it
   says cat or dog. Every game that outranks this one for "kedi oyunu"
   or "cat game" puts one large animal face in the middle of its icon.

   This draws that: Marmalade's face, the game's own drawFace at a size
   the eye can find, on the warm ground the game itself uses. It writes
   a candidate only. Nothing here touches the shipped icon set; the
   owner chooses, and tools/icon.js stays the way the shipped one is
   made until he does. */
const path = require('path');
const fs = require('fs');
const PW = require('./_pw.js');

const OUT = path.join(__dirname, '..', 'design', 'icon-cat-candidate.png');
const PX = 1024;

(async () => {
  const server = await PW.serve();
  const browser = await PW.launch();
  const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
  await page.goto(PW.at('/pawtika.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save);
  const url = await page.evaluate(px => {
    const cv = document.createElement('canvas');
    cv.width = px; cv.height = px;
    const c = cv.getContext('2d');
    /* the ground: the shipped mark's own pastel, pink into lilac, so the
       ginger face stands off it the way orange on orange did not */
    const g = c.createRadialGradient(px * .32, px * .26, px * .05, px * .5, px * .55, px * .78);
    g.addColorStop(0, '#FFF4FA');
    g.addColorStop(.55, '#F7CDE6');
    g.addColorStop(1, '#C9AEEB');
    c.fillStyle = g;
    c.fillRect(0, 0, px, px);
    /* paw prints, faint, so the ground is not a flat field */
    c.save();
    c.globalAlpha = .13;
    c.fillStyle = '#8E5BB8';
    const paw = (x, y, s, a) => {
      c.save(); c.translate(x, y); c.rotate(a);
      c.beginPath(); c.ellipse(0, s * .25, s * .42, s * .36, 0, 0, Math.PI * 2); c.fill();
      [[-.42, -.22], [-.15, -.48], [.15, -.48], [.42, -.22]].forEach(([dx, dy]) => {
        c.beginPath(); c.ellipse(dx * s, dy * s, s * .15, s * .19, 0, 0, Math.PI * 2); c.fill();
      });
      c.restore();
    };
    paw(px * .14, px * .86, px * .09, -.4);
    paw(px * .88, px * .16, px * .07, .5);
    paw(px * .86, px * .84, px * .06, .3);
    c.restore();
    /* the face, as large as the icon's safe area allows */
    const i = BL.BREEDS.findIndex(b => /marmalade/i.test(b.name || b.en || b.id || ''));
    const spec = BL.specOf(i >= 0 ? i : 0);
    c.save();
    c.translate(px * .5, px * .57);
    BL.drawFace(c, spec, px * .56, { mouth: 'open', mood: 'happy', blink: 0 });
    c.restore();
    return cv.toDataURL('image/png');
  }, PX);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote ' + OUT);
  await browser.close();
  if (server && server.stop) server.stop();
})().catch(e => { console.error(e); process.exit(1); });
