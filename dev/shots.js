/* dev/shots.js — headless art renderer.

   Loads the drawing modules with a minimal DOM shim and writes PNG
   contact sheets, so every piece, blocker, pet and room can be looked
   at side by side without opening a browser or playing to level 12.

     npm i @napi-rs/canvas          (once, anywhere on the path)
     node dev/shots.js              light theme
     node dev/shots.js dark         dark theme

   Sheets land in dev/shots/. */
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const THEME = process.argv[2] === 'dark' ? 'dark' : 'light';

/* ---------- CSS custom properties, straight from the stylesheet ---------- */
const css = fs.readFileSync(path.join(ROOT, 'src/style.css'), 'utf8');
function varsFrom(block) {
  const out = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(block))) out[m[1]] = m[2].trim();
  return out;
}
function blockAfter(marker) {
  const i = css.indexOf(marker);
  if (i < 0) return '';
  const open = css.indexOf('{', i);
  let depth = 0;
  for (let k = open; k < css.length; k++) {
    if (css[k] === '{') depth++;
    else if (css[k] === '}') { depth--; if (!depth) return css.slice(open, k); }
  }
  return '';
}
const VARS = Object.assign({}, varsFrom(blockAfter(':root')));
if (THEME === 'dark') {
  Object.assign(VARS, varsFrom(blockAfter('[data-theme="dark"]')));
  Object.assign(VARS, varsFrom(blockAfter("[data-theme='dark']")));
}

/* ---------- the smallest DOM these modules will accept ---------- */
function mkCanvas() {
  const cv = createCanvas(1, 1);
  cv.style = {};
  return cv;
}
global.window = {
  devicePixelRatio: 2,
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  innerWidth: 400, innerHeight: 800,
  addEventListener() {},
  AudioContext: null
};
global.document = {
  createElement: t => (t === 'canvas' ? mkCanvas() : { style: {}, appendChild() {}, addEventListener() {} }),
  documentElement: { getAttribute: () => THEME, setAttribute() {} },
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  readyState: 'complete'
};
global.getComputedStyle = () => ({ getPropertyValue: n => VARS[n.replace(/^--/, '')] || '' });
global.navigator = { language: 'en', vibrate: () => {} };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = fn => setTimeout(() => fn(Date.now()), 16);
global.matchMedia = global.window.matchMedia;
global.devicePixelRatio = 2;

/* ---------- load the drawing layers ---------- */
const MODULES = ['00-util', '05-i18n', '10-data', '15-save', '20-audio', '25-art', '26-scene', '27-physics'];
const src = MODULES
  .map(m => fs.readFileSync(path.join(ROOT, 'src/js', m + '.js'), 'utf8'))
  .join('\n');
/* the modules declare with const/let at top level, so run them as one
   script body and hand back the names this file needs */
const api = new Function(src + `
  return {
    readPalette, pal: () => PAL, BREEDS, SP, tileSprite, paintTile, paintCrate, paintMud, paintIce,
    paintPup, paintGood, drawBody, drawBlocker, drawFace, specOf, specOfPet, drawTileFx,
    drawRoom, drawTray, drawCellBed, drawHole, drawTileShadow,
    drawSelectRing, drawHintRing, petRig, rigStep, drawPetLive,
    makePet, EYE_COLORS, loadSave, ROOM_THEMES, FX,
    setPAL: v => { for (const k in v) PAL[k] = v[k]; }
  };
`)();

api.loadSave();
global.SAVE = undefined;                      // loadSave set it inside the closure
api.readPalette();
api.pal().dark = THEME === 'dark';

function sheet(name, w, h, draw) {
  const cv = createCanvas(w * 2, h * 2);
  const c = cv.getContext('2d');
  c.scale(2, 2);
  c.fillStyle = VARS['bg-deep'] || VARS['bg'] || '#fff';
  c.fillRect(0, 0, w, h);
  draw(c, w, h);
  fs.writeFileSync(path.join(OUT, name + '-' + THEME + '.png'), cv.toBuffer('image/png'));
  console.log('  ' + name + '-' + THEME + '.png  ' + w + 'x' + h);
}

/* ---------- 1. the pieces ---------- */
sheet('tiles', 6 * 92 + 24, 5 * 92 + 24, (c, W, H) => {
  const px = 74, gap = 92;
  const sps = [api.SP.NONE, api.SP.ROW, api.SP.COL, api.SP.BOMB, api.SP.RAIN];
  for (let r = 0; r < 5; r++) {
    for (let i = 0; i < 6; i++) {
      const x = 12 + i * gap + gap / 2, y = 12 + r * gap + gap / 2;
      api.drawCellBed(c, x, y, px + 10, { hole: false }, (r + i) % 2 === 0);
      api.drawTileShadow(c, x, y, px + 10, 0);
      const sp = api.tileSprite(i, sps[r], px, false);
      c.drawImage(sp, x - sp._w / 2, y - sp._w / 2, sp._w, sp._w);
      c.save();
      c.translate(x, y);
      api.drawTileFx(c, i, sps[r], px, 1.4, i);
      c.restore();
    }
  }
});

/* ---------- 2. blockers ---------- */
sheet('blockers', 6 * 100 + 24, 124, (c, W, H) => {
  const px = 80, gap = 100;
  const items = ['crate2', 'crate1', 'mud2', 'mud1', 'ice', 'pup'];
  items.forEach((id, i) => {
    const x = 12 + i * gap + gap / 2, y = H / 2;
    api.drawCellBed(c, x, y, px + 12, { hole: false }, i % 2 === 0);
    if (id === 'crate2') api.drawBlocker(c, 'crate', x, y, px, 2);
    else if (id === 'crate1') api.drawBlocker(c, 'crate', x, y, px, 1);
    else if (id === 'mud2') api.drawBlocker(c, 'mud', x, y, px, 2);
    else if (id === 'mud1') api.drawBlocker(c, 'mud', x, y, px, 1);
    else if (id === 'ice') {
      const sp = api.tileSprite(2, api.SP.NONE, px * .9, false);
      c.drawImage(sp, x - sp._w / 2, y - sp._w / 2, sp._w, sp._w);
      api.drawBlocker(c, 'ice', x, y, px, 1);
    } else { c.save(); c.translate(x, y); api.paintPup(c, px, 3); c.restore(); }
  });
});

/* ---------- 3. a board, as it actually appears ---------- */
sheet('board', 400, 460, (c, W, H) => {
  const cell = 44, cols = 8, rows = 9;
  const bw = cell * cols, bh = cell * rows;
  const ox = (W - bw) / 2, oy = (H - bh) / 2;
  api.drawTray(c, ox, oy, bw, bh, 11);
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      const x = ox + i * cell + cell / 2, y = oy + r * cell + cell / 2;
      const hole = (r === 4 && (i === 2 || i === 5));
      if (hole) { api.drawHole(c, x, y, cell); continue; }
      api.drawCellBed(c, x, y, cell - 3, { hole: false }, (r + i) % 2 === 0);
      if (r > 6 && i < 3) { c.save(); c.translate(x, y); api.paintMud(c, cell - 3, r > 7 ? 2 : 1); c.restore(); }
      if (r === 0 && i > 4) { c.save(); c.translate(x, y); api.paintCrate(c, cell * .96, i === 7 ? 2 : 1); c.restore(); }
      else {
        const type = (r * 3 + i * 5) % 6;
        const sp2 = (r === 2 && i === 3) ? api.SP.BOMB : (r === 5 && i === 6) ? api.SP.ROW : api.SP.NONE;
        api.drawTileShadow(c, x, y, cell, 0);
        const sp = api.tileSprite(type, sp2, cell * .9, false);
        c.drawImage(sp, x - sp._w / 2, y - sp._w / 2, sp._w, sp._w);
        c.save(); c.translate(x, y);
        api.drawTileFx(c, type, sp2, cell * .9, 1.4, type);
        c.restore();
      }
    }
  }
  api.drawSelectRing(c, ox + 3 * cell + cell / 2, oy + 4 * cell + cell / 2, cell, .4, api.pal().accent);
});

/* ---------- 4. the pets ---------- */
sheet('pets', 6 * 130, 260, (c, W, H) => {
  const pets = api.BREEDS.map((b, i) => api.makePet(i, i % 3, i % api.EYE_COLORS.length));
  pets[1].hat = 'beanie'; pets[3].collar = 'red'; pets[5].hat = 'crown'; pets[0].collar = 'bandana';
  const moods = ['happy', 'content', 'sleeping', 'hungry', 'bored', 'dirty'];
  pets.forEach((p, i) => {
    const rig = api.petRig(p);
    for (let k = 0; k < 40; k++) api.rigStep(rig, 1 / 60, { mood: moods[i] });
    api.drawPetLive(c, p, W / 6 * (i + .5), H * .60, 74, rig, { mood: moods[i] });
  });
});

/* ---------- 5. the room and the lane ---------- */
sheet('room', 400, 300, (c, W, H) => {
  const pets = [api.makePet(0, 0, 0)];
  const rig = api.petRig(pets[0]);
  for (let k = 0; k < 40; k++) api.rigStep(rig, 1 / 60, { mood: 'content' });
  api.drawRoom(c, W, H, {
    t: 3, theme: 'sage', floorRatio: .70,
    placed: ['rug', 'plant', 'shelf', 'lamp', 'tower', 'window', 'basket', 'poster']
  });
  api.drawPetLive(c, pets[0], W * .5, H * .70 + (H - H * .70) * .58 - 58 * .92, 58, rig, { mood: 'content' });
});

console.log('done — ' + OUT);
