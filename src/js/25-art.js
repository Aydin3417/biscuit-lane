/* ============================================================
   25 — art. Every animal, hat and biscuit is drawn with paths.
   All drawing happens in a normalised space centred on 0,0.
   ============================================================ */

/* palette read from CSS so canvases follow the Day/Dusk theme */
let PAL = {};
function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  const g = n => cs.getPropertyValue('--' + n).trim() || '#888';
  PAL = {
    bg: g('bg'), surface: g('surface'), surface2: g('surface-2'), surface3: g('surface-3'),
    line: g('line'), lineSoft: g('line-soft'), text: g('text'), textDim: g('text-dim'),
    accent: g('accent'), accentSoft: g('accent-soft'), accentInk: g('accent-ink'),
    rose: g('rose'), sage: g('sage'), plum: g('plum'), sky: g('sky'),
    boardBg: g('board-bg'), boardCell: g('board-cell'), boardCell2: g('board-cell-2')
  };
  PAL.dark = hex2rgb(PAL.bg).reduce((a, b) => a + b, 0) < 380;
}

/* ---------------- pips (shape cue for colour-blind mode) ---------------- */
function drawPip(c, kind, x, y, r, col) {
  c.save(); c.translate(x, y); c.fillStyle = col; c.strokeStyle = col;
  c.lineWidth = r * .32; c.lineCap = 'round'; c.lineJoin = 'round';
  switch (kind) {
    case 'fish':
      c.beginPath();
      c.moveTo(-r, 0); c.quadraticCurveTo(0, -r * .8, r * .6, 0); c.quadraticCurveTo(0, r * .8, -r, 0);
      c.fill();
      c.beginPath(); c.moveTo(r * .55, 0); c.lineTo(r, -r * .55); c.lineTo(r, r * .55); c.closePath(); c.fill();
      break;
    case 'bone':
      c.beginPath();
      c.roundRect ? c.roundRect(-r * .8, -r * .22, r * 1.6, r * .44, r * .22) : rr(c, -r * .8, -r * .22, r * 1.6, r * .44, r * .22);
      c.fill();
      [-1, 1].forEach(sx => {
        ellipse(c, sx * r * .78, -r * .3, r * .32, r * .32); c.fill();
        ellipse(c, sx * r * .78, r * .3, r * .32, r * .32); c.fill();
      });
      break;
    case 'moon':
      c.beginPath(); c.arc(0, 0, r, Math.PI * .35, Math.PI * 1.65);
      c.arc(r * .42, 0, r * .86, Math.PI * 1.6, Math.PI * .4, true);
      c.closePath(); c.fill();
      break;
    case 'star': {
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * .45 : r;
        i ? c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2) : c.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
      }
      c.closePath(); c.fill(); break;
    }
    case 'leaf':
      c.beginPath();
      c.moveTo(0, -r); c.quadraticCurveTo(r, -r * .2, 0, r); c.quadraticCurveTo(-r, -r * .2, 0, -r);
      c.fill();
      break;
    case 'heart':
      c.beginPath();
      c.moveTo(0, r * .85);
      c.bezierCurveTo(-r * 1.35, -r * .1, -r * .55, -r * 1.05, 0, -r * .35);
      c.bezierCurveTo(r * .55, -r * 1.05, r * 1.35, -r * .1, 0, r * .85);
      c.fill();
      break;
  }
  c.restore();
}

/* ---------------- ears ---------------- */
/* What the ears are doing.

   An animal's ears are the loudest thing on its face and these were
   welded on: the same angle whether the pet was delighted or asleep.
   The room already knows the mood — it picks idle behaviour and thought
   bubbles from it — so it costs nothing to say it here too.

   `rot` turns the ear about its base, positive being outward and down.
   `droop` shortens it, which is what a tired ear does. `out` slides it
   off the skull a little for the alert poses. */
/* how wide the pupil opens, by mood */
const PUPIL_DILATE = {
  happy: 1.16, content: 1, hungry: 1.12, lonely: .94,
  dirty: .95, bored: .86, tired: .80, sleeping: .78
};

const EAR_POSE = {
  happy:    { rot: -.13, out: .020, droop: -.04 },
  content:  { rot: 0, out: 0, droop: 0 },
  hungry:   { rot: -.08, out: .026, droop: 0 },
  lonely:   { rot: .17, out: -.010, droop: .10 },
  dirty:    { rot: .11, out: 0, droop: .07 },
  bored:    { rot: .21, out: .008, droop: .14 },
  tired:    { rot: .32, out: .018, droop: .22 },
  sleeping: { rot: .36, out: .022, droop: .26 }
};


/* A tabby mark is thick where it leaves the spine and thin where it
   ends, and it follows the curve of the skull. Stroked with a round cap
   it is a bar with two dome ends, which is what these were: at .045 of
   the head wide and .75 opaque they read as painted-on stripes rather
   than fur.

   This walks a quadratic spine and offsets it by a width that falls
   from w0 to w1, so the mark tapers along its length. */
function taperMark(c, x0, y0, cx, cy, x1, y1, w0, w1) {
  const N = 14, L = [], R = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    const px = u * u * x0 + 2 * u * t * cx + t * t * x1;
    const py = u * u * y0 + 2 * u * t * cy + t * t * y1;
    const tx = 2 * u * (cx - x0) + 2 * t * (x1 - cx);
    const ty = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len, ny = tx / len;
    const w = (w0 + (w1 - w0) * t) * .5;
    L.push([px + nx * w, py + ny * w]);
    R.push([px - nx * w, py - ny * w]);
  }
  c.beginPath();
  c.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) c.lineTo(L[i][0], L[i][1]);
  for (let i = R.length - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]);
  c.closePath();
}


/* ---------- legibility on dark coats ---------- */
/* Relative luminance, 0..1. Features drawn in near-black vanish on a
   coat that is itself near-black, so below the threshold the ink flips. */
function coatLum(hexc) {
  const [r, g, b] = hex2rgb(hexc);
  return (r * .2126 + g * .7152 + b * .0722) / 255;
}
function darkCoat(spec) { return coatLum(spec.fur) < .30; }
/* A treat, drawn small enough to sit on a map node. Same shape as the
   icon in the top bar so the two read as the same thing. */
function drawTreatPip(c, x, y, r) {
  c.save();
  c.translate(x, y);
  c.rotate(-.5);
  c.fillStyle = '#F3E2C4';
  c.strokeStyle = rgba('#6B4A22', .75);
  c.lineWidth = r * .30;
  c.lineJoin = 'round';
  const w = r * 1.5, h = r * .62, k = r * .52;
  c.beginPath();
  ellipse(c, -w / 2, -h / 2, k, k);
  c.fill(); c.stroke();
  c.beginPath();
  ellipse(c, -w / 2, h / 2, k, k);
  c.fill(); c.stroke();
  c.beginPath();
  ellipse(c, w / 2, -h / 2, k, k);
  c.fill(); c.stroke();
  c.beginPath();
  ellipse(c, w / 2, h / 2, k, k);
  c.fill(); c.stroke();
  rr(c, -w / 2, -h / 2, w, h, h * .5);
  c.fill(); c.stroke();
  c.restore();
}

/* whichever of dark or cream reads better on a given fill */
function inkOn(hex) { return coatLum(hex) > .45 ? '#22271C' : '#FFFFFF'; }

/* The line around the animal.

   These were drawn without one, on the grounds that soft shading is
   the more painterly choice. Next to the characters this game is
   measured against, the difference was not the shading, it was the
   edge: at 48dp on a tile and at 200px in the room a shape with no
   edge reads as a blob of colour with features on it, and a shape with
   a warm dark line reads as a drawn animal. The line is the coat's own
   shadow colour pulled toward ink, not black, and it is a little
   fainter on a dark coat, where the silhouette does the work. */
/* the colour a line or a nose is drawn in so that it always reads */
function featureInk(spec) { return darkCoat(spec) ? '#E4D8C8' : '#2A2118'; }

/* ---------------- eyes ----------------
   Six breeds sharing one pair of round eyes is six recolours of the
   same animal. The eye is the first thing anyone reads, so each breed
   gets its own: size, slant, lid, and whether it has brows at all. */
const FACE_LOOK = {
  /* Baby schema, which is the whole of what makes a drawn animal read
     as cute and is not a matter of taste: a large cranium, eyes that
     are big and sit at or below the middle of the face, and a nose and
     mouth clustered low and small. These eyes were .09 to .12 of the
     head and sat above the midline — the proportions of an adult
     animal, which is why the faces were merely tidy.

     Doubling them is most of the difference. `x` has to open up with
     `r` or they meet in the middle, and `y` goes positive: below
     centre, with forehead above. */
  marmalade: { r: .160, x: .200, y: .040, tilt: 0, almond: false, lid: .34, brow: 0 },
  beagle: { r: .158, x: .186, y: .030, tilt: .06, almond: false, lid: .20, brow: .8 },
  void: { r: .166, x: .200, y: .036, tilt: 0, almond: false, lid: .10, brow: 0 },
  retriever: { r: .154, x: .182, y: .022, tilt: .05, almond: false, lid: .34, brow: 0 },
  siamese: { r: .158, x: .198, y: .042, tilt: 0, almond: false, lid: .28, brow: 0 },
  pug: { r: .170, x: .198, y: .012, tilt: 0, almond: false, lid: .06, brow: .7 }
};
function lookOf(spec) { return FACE_LOOK[spec.breed.id] || FACE_LOOK.marmalade; }


/* Colour in the cheeks, by how it feels. A flat blush on a miserable
   animal is the same mistake as a fixed ear: the face wearing an
   expression it does not have. */
const BLUSH_BY_MOOD = {
  happy: 1.35, content: 1, hungry: .85, lonely: .55,
  dirty: .55, bored: .5, tired: .4, sleeping: .7
};
function drawBlush(c, spec, s, o) {
  const k = BLUSH_BY_MOOD[(o && o.mood) || 'content'];
  const a = (PAL.dark ? .20 : .24) * (k === undefined ? 1 : k);
  if (a < .02) return;
  const w = .10 * s * (k > 1 ? 1.12 : 1);
  c.fillStyle = rgba('#E88494', a);
  ellipse(c, -.27 * s, .12 * s, w, .062 * s); c.fill();
  ellipse(c, .27 * s, .12 * s, w, .062 * s); c.fill();
}

/* ---------------- hats ---------------- */
function drawHat(c, id, spec, s) {
  if (!id || id === 'none') return;
  const topY = -.44 * s;
  c.save();
  if (id === 'party') {
    c.fillStyle = '#E8798A';
    c.beginPath(); c.moveTo(-.17 * s, topY + .02 * s); c.lineTo(.02 * s, topY - .40 * s); c.lineTo(.17 * s, topY + .02 * s); c.closePath(); c.fill();
    c.fillStyle = rgba('#FFFFFF', .55);
    for (let i = 0; i < 3; i++) { ellipse(c, -.09 * s + i * .07 * s, topY - .06 * s - i * .09 * s, .026 * s, .026 * s); c.fill(); }
    c.fillStyle = PAL.accent; ellipse(c, .02 * s, topY - .42 * s, .05 * s, .05 * s); c.fill();
  } else if (id === 'beanie') {
    c.fillStyle = '#5E7FA8';
    c.beginPath();
    c.moveTo(-.36 * s, topY + .10 * s);
    c.quadraticCurveTo(-.34 * s, topY - .30 * s, 0, topY - .30 * s);
    c.quadraticCurveTo(.34 * s, topY - .30 * s, .36 * s, topY + .10 * s);
    c.closePath(); c.fill();
    c.fillStyle = '#7B9BC4';
    rr(c, -.38 * s, topY + .02 * s, .76 * s, .13 * s, .06 * s); c.fill();
    c.fillStyle = '#EDE3D2'; ellipse(c, 0, topY - .32 * s, .075 * s, .075 * s); c.fill();
  } else if (id === 'flower') {
    const px = -.28 * s, py = topY - .04 * s;
    c.fillStyle = '#F6F1E4';
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      ellipse(c, px + Math.cos(a) * .075 * s, py + Math.sin(a) * .075 * s, .055 * s, .04 * s, a); c.fill();
    }
    c.fillStyle = PAL.accent; ellipse(c, px, py, .045 * s, .045 * s); c.fill();
  } else if (id === 'crown') {
    c.fillStyle = '#E3B451';
    c.beginPath();
    c.moveTo(-.26 * s, topY + .04 * s);
    c.lineTo(-.26 * s, topY - .16 * s); c.lineTo(-.13 * s, topY - .05 * s);
    c.lineTo(0, topY - .24 * s); c.lineTo(.13 * s, topY - .05 * s);
    c.lineTo(.26 * s, topY - .16 * s); c.lineTo(.26 * s, topY + .04 * s);
    c.closePath(); c.fill();
    c.fillStyle = '#C4922F'; rr(c, -.27 * s, topY + .01 * s, .54 * s, .06 * s, .03 * s); c.fill();
    c.fillStyle = '#E8798A'; ellipse(c, 0, topY - .02 * s, .035 * s, .035 * s); c.fill();
  } else if (id === 'chef') {
    c.fillStyle = '#FAF6EC';
    ellipse(c, 0, topY - .24 * s, .26 * s, .17 * s); c.fill();
    ellipse(c, -.16 * s, topY - .17 * s, .12 * s, .11 * s); c.fill();
    ellipse(c, .16 * s, topY - .17 * s, .12 * s, .11 * s); c.fill();
    c.fillStyle = '#EDE6D6'; rr(c, -.23 * s, topY - .12 * s, .46 * s, .16 * s, .05 * s); c.fill();
  }
  c.restore();
}
function drawCollar(c, id, s, y) {
  const col = COLLARS.find(x => x.id === id);
  if (!col || !col.hex) return;
  c.save();
  if (col.bandana) {
    c.fillStyle = col.hex;
    c.beginPath();
    c.moveTo(-.30 * s, y - .05 * s); c.lineTo(.30 * s, y - .05 * s);
    c.lineTo(0, y + .28 * s); c.closePath(); c.fill();
    c.fillStyle = rgba('#FFFFFF', .3);
    for (let i = -2; i <= 2; i++) { ellipse(c, i * .09 * s, y + .05 * s, .02 * s, .02 * s); c.fill(); }
  } else {
    c.fillStyle = col.hex;
    rr(c, -.32 * s, y - .05 * s, .64 * s, .105 * s, .05 * s); c.fill();
    c.fillStyle = shade(col.hex, -.25);
    rr(c, -.32 * s, y + .028 * s, .64 * s, .026 * s, .013 * s); c.fill();
    c.fillStyle = '#E3B451';
    ellipse(c, 0, y + .10 * s, .055 * s, .055 * s); c.fill();
    c.fillStyle = rgba('#FFFFFF', .45);
    ellipse(c, -.016 * s, y + .085 * s, .018 * s, .014 * s); c.fill();
  }
  c.restore();
}

/* ---------------- the face ---------------- */
/* The face on a board tile. A slot is not a breed any more — the cast
   says who is standing in it, and if that is one of your pets it wears
   the coat and the eyes you chose for it rather than the breed's stock
   ones. Falls back to the plain breed when there is no save, which is
   how the engine tests and the level-design audit see it. */
function slotSpec(slot) {
  if (typeof castBreed !== 'function') return specOf(slot);
  const breed = castBreed(slot);
  const p = castPet(slot);
  return p ? specOf(breed, petCoat(p), petEye(p)) : specOf(breed);
}
function specOf(breedIdx, coat, eyeHex) {
  const b = BREEDS[breedIdx];
  const co = coat || b.coats[0];
  return {
    breed: b, fur: co.fur, fur2: co.fur2, belly: co.belly,
    eyes: eyeHex || b.eyes, inner: mix(co.fur, '#E890A0', .55),
    point: co.fur2, nose: mix(co.fur, '#E08A96', .7)
  };
}
function specOfPet(p) {
  return Object.assign(specOf(p.breed, petCoat(p), petEye(p)),
    { hat: p.hat, collar: p.collar, stage: petStageIdx(p) });
}


/* ---------------- full body (sitting) ---------------- */

/* Little tufts along an edge — the difference between a shape and
   an animal. Angles are in radians around the given centre. */
function furEdge(c, cx, cy, rx, ry, a0, a1, n, len, col) {
  c.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1 || 1);
    const a = lerp(a0, a1, t);
    const wob = .82 + Math.sin(i * 2.4) * .3;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    const nx = Math.cos(a), ny = Math.sin(a);
    const tx = -ny, ty = nx;
    const L = len * wob;
    c.beginPath();
    c.moveTo(x + tx * L * .55, y + ty * L * .55);
    c.quadraticCurveTo(x + nx * L * 1.25, y + ny * L * 1.25, x - tx * L * .55, y - ty * L * .55);
    c.closePath();
    c.fill();
  }
}


/* ============================================================
   THE ANIMALS, DRAWN AS STICKERS
   ============================================================

   The first animals were painted: gradients for volume, a key light, a
   jaw shadow, fur tufts along every edge. Beside the characters this
   game is measured against they read as blobs of colour with features
   on them, at 48dp on a tile and at 200px in the room alike, and a
   pass that added a line round the painting and lashes to the eyes was
   a polish, not a change — put side by side with the old ones nobody
   could tell which was which.

   Three generated concept sheets were asked for in three styles and
   all three came back the same way: flat fills, one shadow tone, and a
   thick warm line of even weight round everything. That is the style
   the tools draw because it is the style that sells, and it is the
   style Canvas paths are best at. So the animals are built that way
   now, from a prototype of one cat and one dog laid over the sheet:

     head about as tall as the body, eyes a third of the head, a line
     of .045 of the head everywhere, fills flat, one shadow band low on
     the body and under the chin, markings as flat strokes, front legs
     that stand, a tail that is a stroke with the line round it.

   Everything the old drawing was asked for is still answered here —
   coat, eye colour, six ear and three face types, four markings,
   moods in the ears and pupils, blink, three mouths, the stage build,
   hats and collars — so nothing that calls drawFace or drawBody had to
   change. The line is not black: black is a hole in a warm palette.
   ============================================================ */
const INK = '#3A2416';
const LINE = .045;
/* the line, and where a coat is dark enough to swallow it, a lighter
   one of its own colour so the legs still part from the body */
function inkLine(spec) {
  return darkCoat(spec) ? mix(spec.fur, '#FFFFFF', .26) : INK;
}
function inkStroke(c, spec, s, w) {
  c.strokeStyle = inkLine(spec);
  c.lineWidth = s * (w || LINE);
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.stroke();
}
/* the flat shadow tone: a little of the coat's own dark, never grey */
function shadeBand(spec) {
  return rgba(mix(spec.fur2, '#3A2416', .5), darkCoat(spec) ? .22 : .14);
}

/* ---------------- head ---------------- */
function headPath(c, spec, s) {
  const f = spec.breed.face;
  c.beginPath();
  if (f === 'flat') {
    /* a pug: wide, low, the jowls the widest part */
    c.moveTo(-.50 * s, -.02 * s);
    c.bezierCurveTo(-.50 * s, -.36 * s, -.28 * s, -.46 * s, 0, -.46 * s);
    c.bezierCurveTo(.28 * s, -.46 * s, .50 * s, -.36 * s, .50 * s, -.02 * s);
    c.bezierCurveTo(.50 * s, .30 * s, .28 * s, .44 * s, 0, .44 * s);
    c.bezierCurveTo(-.28 * s, .44 * s, -.50 * s, .30 * s, -.50 * s, -.02 * s);
  } else if (f === 'dog') {
    c.moveTo(-.48 * s, -.06 * s);
    c.bezierCurveTo(-.48 * s, -.40 * s, -.26 * s, -.50 * s, 0, -.50 * s);
    c.bezierCurveTo(.26 * s, -.50 * s, .48 * s, -.40 * s, .48 * s, -.06 * s);
    c.bezierCurveTo(.48 * s, .28 * s, .26 * s, .44 * s, 0, .44 * s);
    c.bezierCurveTo(-.26 * s, .44 * s, -.48 * s, .28 * s, -.48 * s, -.06 * s);
  } else {
    /* a cat: the cheeks are the widest part, and there is a chin */
    c.moveTo(-.50 * s, -.02 * s);
    c.bezierCurveTo(-.50 * s, -.34 * s, -.28 * s, -.46 * s, 0, -.46 * s);
    c.bezierCurveTo(.28 * s, -.46 * s, .50 * s, -.34 * s, .50 * s, -.02 * s);
    c.bezierCurveTo(.50 * s, .26 * s, .28 * s, .42 * s, 0, .42 * s);
    c.bezierCurveTo(-.28 * s, .42 * s, -.50 * s, .26 * s, -.50 * s, -.02 * s);
  }
  c.closePath();
}

/* A cat's head with its ears in the same line.

   Drawn as two triangles on a head, each with its own outline, the
   ears were stickers stuck on a sticker, and the seams showed at every
   size. The silhouette is one path now — cheek, ear, skull, ear, cheek,
   chin — filled once and lined once, and the pose the mood gives the
   ears moves the tips rather than rotating a separate shape. */
function catSilhouette(c, spec, s, o) {
  const k = spec.breed.ear;
  const pose = EAR_POSE[(o && o.mood) || 'content'] || EAR_POSE.content;
  const tall = k === 'tall';
  /* the ear: outer base on the cheek line, inner base on the skull, tip */
  const outer = [.47, -.26], inner = [.17, -.40];
  const tip0 = tall ? [.34, -.94] : [.38, -.80];
  const mid = [(outer[0] + inner[0]) / 2, (outer[1] + inner[1]) / 2];
  const vx = tip0[0] - mid[0], vy = tip0[1] - mid[1];
  const sc = 1 - pose.droop * .9, a = pose.rot;
  const tip = [mid[0] + (vx * Math.cos(a) - vy * Math.sin(a)) * sc + pose.out, mid[1] + (vx * Math.sin(a) + vy * Math.cos(a)) * sc];
  const earTips = { l: [-tip[0] * s, tip[1] * s], r: [tip[0] * s, tip[1] * s] };
  c.beginPath();
  c.moveTo(-.50 * s, .00 * s);
  c.bezierCurveTo(-.51 * s, -.16 * s, -.50 * s, -.24 * s, -outer[0] * s, outer[1] * s);
  if (k === 'round') {
    c.quadraticCurveTo(earTips.l[0] - .04 * s, earTips.l[1] + .02 * s, earTips.l[0] + .04 * s, earTips.l[1] + .04 * s);
    c.quadraticCurveTo(earTips.l[0] + .10 * s, earTips.l[1] + .08 * s, -inner[0] * s, inner[1] * s);
  } else {
    c.lineTo(earTips.l[0], earTips.l[1]);
    c.lineTo(-inner[0] * s, inner[1] * s);
  }
  c.quadraticCurveTo(0, -.47 * s, inner[0] * s, inner[1] * s);
  if (k === 'round') {
    c.quadraticCurveTo(earTips.r[0] - .10 * s, earTips.r[1] + .08 * s, earTips.r[0] - .04 * s, earTips.r[1] + .04 * s);
    c.quadraticCurveTo(earTips.r[0] + .04 * s, earTips.r[1] + .02 * s, outer[0] * s, outer[1] * s);
  } else {
    c.lineTo(earTips.r[0], earTips.r[1]);
    c.lineTo(outer[0] * s, outer[1] * s);
  }
  c.bezierCurveTo(.50 * s, -.24 * s, .51 * s, -.16 * s, .50 * s, .00 * s);
  c.bezierCurveTo(.50 * s, .26 * s, .28 * s, .42 * s, 0, .42 * s);
  c.bezierCurveTo(-.28 * s, .42 * s, -.50 * s, .26 * s, -.50 * s, .00 * s);
  c.closePath();
  return { tips: earTips, outer, inner };
}
/* the pink inside each ear, inset from the line */
function catInnerEars(c, spec, s, geo) {
  const inner = spec.inner || '#F2B7B0';
  const col = spec.breed.ear === 'tall' ? mix(inner, spec.point || spec.fur2, .35) : inner;
  c.fillStyle = col;
  [['l', -1], ['r', 1]].forEach(([side, sx]) => {
    const tip = geo.tips[side];
    const o = [sx * geo.outer[0] * s, geo.outer[1] * s], i = [sx * geo.inner[0] * s, geo.inner[1] * s];
    const cx = (tip[0] + o[0] + i[0]) / 3, cy = (tip[1] + o[1] + i[1]) / 3;
    const in_ = p => [cx + (p[0] - cx) * .62, cy + (p[1] - cy) * .62];
    const a = in_(tip), b = in_(o), d = in_(i);
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.closePath(); c.fill();
  });
}

/* ---------------- ears ---------------- */
function drawEars(c, spec, s, back, o) {
  /* a cat's are part of its silhouette — see catSilhouette */
  if (spec.breed.species === 'cat') return;
  const b = spec.breed, fur = spec.fur, fur2 = spec.fur2, inner = spec.inner || '#F2B7B0';
  const k = b.ear;
  const front = k === 'droop' || k === 'flop' || k === 'button';
  if (back === front) return;
  const pose = EAR_POSE[(o && o.mood) || 'content'] || EAR_POSE.content;
  const ear = sx => {
    c.save(); c.scale(sx, 1);
    /* turn about where the ear leaves the skull, not about the face */
    if (pose.rot || pose.droop || pose.out) {
      c.translate(.22 * s + pose.out * s, -.26 * s);
      c.rotate(pose.rot);
      c.scale(1, 1 - pose.droop);
      c.translate(-.22 * s, .26 * s);
    }
    if (k === 'triangle') {
      c.beginPath();
      c.moveTo(.14 * s, -.30 * s); c.lineTo(.38 * s, -.74 * s); c.lineTo(.52 * s, -.24 * s); c.closePath();
      c.fillStyle = fur; c.fill(); inkStroke(c, spec, s);
      c.beginPath();
      c.moveTo(.23 * s, -.33 * s); c.lineTo(.37 * s, -.60 * s); c.lineTo(.45 * s, -.30 * s); c.closePath();
      c.fillStyle = inner; c.fill();
    } else if (k === 'tall') {
      /* a Siamese: taller, set wider, and the point's colour */
      c.beginPath();
      c.moveTo(.12 * s, -.30 * s); c.lineTo(.36 * s, -.86 * s); c.lineTo(.54 * s, -.26 * s); c.closePath();
      c.fillStyle = spec.point || fur2; c.fill(); inkStroke(c, spec, s);
      c.beginPath();
      c.moveTo(.22 * s, -.34 * s); c.lineTo(.36 * s, -.70 * s); c.lineTo(.46 * s, -.32 * s); c.closePath();
      c.fillStyle = mix(inner, spec.point || fur2, .35); c.fill();
    } else if (k === 'round') {
      /* round-eared, still a cat: a wide triangle with a soft tip */
      c.beginPath();
      c.moveTo(.12 * s, -.28 * s);
      c.quadraticCurveTo(.26 * s, -.76 * s, .40 * s, -.62 * s);
      c.quadraticCurveTo(.50 * s, -.50 * s, .52 * s, -.22 * s);
      c.closePath();
      c.fillStyle = fur; c.fill(); inkStroke(c, spec, s);
      c.beginPath();
      c.moveTo(.22 * s, -.32 * s);
      c.quadraticCurveTo(.30 * s, -.62 * s, .39 * s, -.54 * s);
      c.quadraticCurveTo(.44 * s, -.46 * s, .45 * s, -.30 * s);
      c.closePath();
      c.fillStyle = inner; c.fill();
    } else if (k === 'droop') {
      /* a beagle: long, hanging beside the face, the darker coat */
      c.beginPath();
      c.moveTo(.30 * s, -.38 * s);
      c.bezierCurveTo(.64 * s, -.42 * s, .68 * s, .12 * s, .52 * s, .32 * s);
      c.bezierCurveTo(.40 * s, .42 * s, .30 * s, .30 * s, .32 * s, .08 * s);
      c.closePath();
      c.fillStyle = fur2; c.fill(); inkStroke(c, spec, s);
    } else if (k === 'flop') {
      /* a retriever: shorter and softer, the coat's own colour */
      c.beginPath();
      c.moveTo(.30 * s, -.40 * s);
      c.bezierCurveTo(.60 * s, -.44 * s, .64 * s, .02 * s, .50 * s, .18 * s);
      c.bezierCurveTo(.40 * s, .28 * s, .30 * s, .18 * s, .32 * s, 0);
      c.closePath();
      c.fillStyle = mix(fur, fur2, .45); c.fill(); inkStroke(c, spec, s);
    } else if (k === 'button') {
      /* a pug: a small dark fold at the top corner */
      c.beginPath();
      c.moveTo(.20 * s, -.42 * s);
      c.quadraticCurveTo(.50 * s, -.52 * s, .50 * s, -.20 * s);
      c.quadraticCurveTo(.40 * s, -.08 * s, .24 * s, -.22 * s);
      c.closePath();
      c.fillStyle = fur2; c.fill(); inkStroke(c, spec, s);
    }
    c.restore();
  };
  ear(1); ear(-1);
}

/* ---------------- markings ---------------- */
function drawMarkings(c, spec, s) {
  const b = spec.breed;
  c.save();
  headPath(c, spec, s); c.clip();
  c.lineCap = 'round';
  if (b.mark === 'tabby') {
    /* the forehead M as three strokes that fan out and thin, and two
       bars back along each cheek: brush marks, not scratches */
    c.fillStyle = spec.fur2;
    taperMark(c, -.06 * s, -.20 * s, -.15 * s, -.32 * s, -.21 * s, -.44 * s, s * .075, s * .014); c.fill();
    taperMark(c, 0, -.22 * s, 0, -.34 * s, 0, -.46 * s, s * .07, s * .012); c.fill();
    taperMark(c, .06 * s, -.20 * s, .15 * s, -.32 * s, .21 * s, -.44 * s, s * .075, s * .014); c.fill();
    [-1, 1].forEach(sx => {
      taperMark(c, sx * .30 * s, -.10 * s, sx * .40 * s, -.12 * s, sx * .50 * s, -.08 * s, s * .065, s * .014); c.fill();
      taperMark(c, sx * .31 * s, .06 * s, sx * .41 * s, .06 * s, sx * .50 * s, .10 * s, s * .06, s * .012); c.fill();
    });
  } else if (b.mark === 'patch') {
    /* a beagle: the blaze, from the crown down over the muzzle */
    c.fillStyle = spec.belly;
    c.beginPath();
    c.moveTo(-.06 * s, -.52 * s); c.lineTo(.06 * s, -.52 * s);
    c.bezierCurveTo(.12 * s, -.12 * s, .32 * s, .08 * s, .32 * s, .46 * s);
    c.lineTo(-.32 * s, .46 * s);
    c.bezierCurveTo(-.32 * s, .08 * s, -.12 * s, -.12 * s, -.06 * s, -.52 * s);
    c.closePath(); c.fill();
  } else if (b.mark === 'points') {
    /* the seal point's mask, from the nose up over the eyes; the blue
       eyes are drawn on top of it and that is the whole point of them */
    c.fillStyle = rgba(spec.point || spec.fur2, .45);
    ellipse(c, 0, .10 * s, .40 * s, .38 * s); c.fill();
    c.fillStyle = spec.point || spec.fur2;
    ellipse(c, 0, .12 * s, .34 * s, .32 * s); c.fill();
  } else if (b.mark === 'mask') {
    /* a pug: the black muzzle, a ring round each eye, and the wrinkles */
    const look = lookOf(spec);
    c.fillStyle = spec.fur2;
    ellipse(c, 0, .26 * s, .25 * s, .21 * s); c.fill();
    c.fillStyle = rgba(spec.fur2, .55);
    [-1, 1].forEach(sx => { ellipse(c, sx * look.x * s, look.y * s, look.r * s * 1.4, look.r * s * 1.45); c.fill(); });
    c.strokeStyle = rgba(spec.fur2, .7); c.lineWidth = .035 * s;
    c.beginPath();
    c.moveTo(-.16 * s, -.26 * s); c.quadraticCurveTo(0, -.36 * s, .16 * s, -.26 * s);
    c.moveTo(-.11 * s, -.16 * s); c.quadraticCurveTo(0, -.25 * s, .11 * s, -.16 * s);
    c.stroke();
  }
  /* every dog but the pug has a lighter muzzle, and so does a cat
     that is not wearing a mask: two pads and a chin in the belly colour */
  if (b.face === 'dog' && b.mark !== 'patch') {
    c.fillStyle = rgba(spec.belly, .85);
    ellipse(c, 0, .24 * s, .22 * s, .17 * s); c.fill();
  } else if (b.species === 'cat' && b.mark !== 'points') {
    c.fillStyle = rgba(spec.belly, darkCoat(spec) ? .55 : .9);
    ellipse(c, -.10 * s, .25 * s, .14 * s, .11 * s); c.fill();
    ellipse(c, .10 * s, .25 * s, .14 * s, .11 * s); c.fill();
    ellipse(c, 0, .34 * s, .13 * s, .09 * s); c.fill();
  }
  c.restore();
}

/* ---------------- eyes ---------------- */
function eyePath(c, rx, ry, almond) {
  if (!almond) { ellipse(c, 0, 0, rx, ry); return; }
  /* a cat's eye: an almond with a rounded point at each end */
  c.beginPath();
  c.moveTo(-rx, ry * .08);
  c.bezierCurveTo(-rx * .55, -ry * 1.22, rx * .55, -ry * 1.16, rx, -ry * .12);
  c.bezierCurveTo(rx * .55, ry * 1.14, -rx * .55, ry * 1.18, -rx, ry * .08);
  c.closePath();
}

function drawEye(c, x, y, r, spec, o, side) {
  const look = lookOf(spec);
  const blink = o.blink || 0;
  const cat = spec.breed.species === 'cat';
  const dx = (o.eyeDir ? o.eyeDir[0] : 0) * r * .26;
  const dy = (o.eyeDir ? o.eyeDir[1] : 0) * r * .26;
  const rx = r, ry = r * 1.10 * (1 - blink * .92);
  c.save();
  c.translate(x, y);
  c.rotate(look.tilt * (side || 1));
  if (blink > .82) {
    /* shut: one line, curving down, the way a drawn eye closes */
    c.strokeStyle = featureInk(spec);
    c.lineWidth = r * .22; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-rx * .78, 0);
    c.quadraticCurveTo(0, r * .34, rx * .78, 0);
    c.stroke();
    c.restore();
    return;
  }
  /* the iris is the eye. A dark iris is lifted until it parts from
     the pupil, or a brown-eyed dog has two holes for eyes. */
  let iris = spec.eyes;
  const irgb = hex2rgb(iris);
  const ilum = (irgb[0] * .299 + irgb[1] * .587 + irgb[2] * .114) / 255;
  if (ilum < .30) iris = shade(iris, .30 + (.30 - ilum) * 1.5);
  c.fillStyle = iris;
  eyePath(c, rx, ry, look.almond); c.fill();
  c.save();
  eyePath(c, rx, ry, look.almond); c.clip();
  /* a shade across the top third, flat, so the eye sits under a lid */
  c.fillStyle = rgba(shade(iris, -.35), .42);
  c.fillRect(-rx * 1.2, -ry * 1.2, rx * 2.4, ry * .48);
  /* the pupil: tall on a cat, round on a dog, open or narrow by mood */
  const dil = PUPIL_DILATE[(o && o.mood) || 'content'] || 1;
  c.fillStyle = '#1C1418';
  if (cat) ellipse(c, dx, dy + ry * .04, rx * .46 * dil, ry * .72 * dil);
  else ellipse(c, dx, dy + ry * .04, rx * .58 * dil, ry * .62 * dil);
  c.fill();
  /* two crisp reflections, the big one upper left */
  c.fillStyle = '#FFFFFF';
  ellipse(c, dx - rx * .30, dy - ry * .38, rx * .30, ry * .26); c.fill();
  c.fillStyle = rgba('#FFFFFF', .9);
  ellipse(c, dx + rx * .32, dy + ry * .34, rx * .13, ry * .12); c.fill();
  c.restore();
  /* the rim, in the ink, a little thinner than the silhouette's */
  c.strokeStyle = inkLine(spec);
  c.lineWidth = r * .20; c.lineJoin = 'round';
  eyePath(c, rx, ry, look.almond); c.stroke();
  c.restore();
}

/* ---------------- nose and mouth ---------------- */
function drawNoseMouth(c, spec, s, o) {
  const f = spec.breed.face, cat = spec.breed.species === 'cat';
  const ink = inkLine(spec), mouthInk = featureInk(spec);
  const W = s * LINE;
  let my;                                   /* where the mouth starts */
  if (cat) {
    /* a small pink triangle, point down */
    const nw = .07 * s, ny = .19 * s;
    c.fillStyle = spec.nose || '#E8828F';
    c.beginPath();
    c.moveTo(-nw, ny); c.quadraticCurveTo(0, ny - nw * .3, nw, ny);
    c.quadraticCurveTo(nw * .3, ny + nw * .9, 0, ny + nw * 1.15);
    c.quadraticCurveTo(-nw * .3, ny + nw * .9, -nw, ny); c.closePath();
    c.fill();
    c.strokeStyle = ink; c.lineWidth = W * .55; c.lineJoin = 'round'; c.stroke();
    my = ny + nw * 1.15;
  } else {
    /* a dog's: a rounded wedge, wide on a pug, in the nose colour */
    const nw = f === 'flat' ? .11 * s : .085 * s, ny = f === 'flat' ? .15 * s : .14 * s;
    c.fillStyle = darkCoat(spec) ? '#4A3A3A' : '#2A1E1A';
    c.beginPath();
    c.moveTo(-nw, ny + nw * .2);
    c.quadraticCurveTo(0, ny - nw * .55, nw, ny + nw * .2);
    c.quadraticCurveTo(nw * .7, ny + nw * 1.25, 0, ny + nw * 1.4);
    c.quadraticCurveTo(-nw * .7, ny + nw * 1.25, -nw, ny + nw * .2);
    c.closePath(); c.fill();
    c.fillStyle = rgba('#FFFFFF', .35);
    ellipse(c, -nw * .35, ny + nw * .1, nw * .28, nw * .18, -.3); c.fill();
    my = ny + nw * 1.4;
    /* the line from the nose to the lip */
    c.strokeStyle = mouthInk; c.lineWidth = W * .6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, my); c.lineTo(0, my + s * .045); c.stroke();
    my += s * .045;
  }
  const mw = cat ? .12 * s : .13 * s;
  c.strokeStyle = mouthInk; c.lineWidth = W * .65; c.lineCap = 'round'; c.lineJoin = 'round';
  if (o.mouth === 'open') {
    /* open: a dark mouth with a tongue in it, the line round it */
    c.fillStyle = '#7A2E3C';
    c.beginPath();
    c.moveTo(-mw * 1.1, my);
    c.quadraticCurveTo(0, my + mw * 2.2, mw * 1.1, my);
    c.quadraticCurveTo(0, my + mw * .3, -mw * 1.1, my);
    c.closePath(); c.fill();
    c.strokeStyle = ink; c.lineWidth = W * .55; c.stroke();
    c.fillStyle = '#E8828F';
    c.beginPath();
    c.moveTo(-mw * .55, my + mw * .8);
    c.quadraticCurveTo(0, my + mw * 2.1, mw * .55, my + mw * .8);
    c.quadraticCurveTo(0, my + mw * 1.0, -mw * .55, my + mw * .8);
    c.closePath(); c.fill();
  } else if (o.mouth === 'sad') {
    c.beginPath();
    c.moveTo(0, my + mw * .35);
    c.quadraticCurveTo(-mw * .5, my - mw * .1, -mw * 1.1, my + mw * .55);
    c.moveTo(0, my + mw * .35);
    c.quadraticCurveTo(mw * .5, my - mw * .1, mw * 1.1, my + mw * .55);
    c.stroke();
  } else {
    /* the smile: two curves out and up from the middle */
    c.beginPath();
    c.moveTo(0, my);
    c.quadraticCurveTo(-mw * .45, my + mw * .75, -mw * 1.05, my + mw * .25);
    c.moveTo(0, my);
    c.quadraticCurveTo(mw * .45, my + mw * .75, mw * 1.05, my + mw * .25);
    c.stroke();
    if (spec.breed.tongue && o.tongue !== false) {
      c.fillStyle = '#E8828F';
      c.beginPath();
      c.moveTo(-mw * .45, my + mw * .35);
      c.quadraticCurveTo(-mw * .5, my + mw * 1.9, 0, my + mw * 1.9);
      c.quadraticCurveTo(mw * .5, my + mw * 1.9, mw * .45, my + mw * .35);
      c.closePath(); c.fill();
      c.strokeStyle = ink; c.lineWidth = W * .45; c.stroke();
    }
  }
}

/* ---------------- the face ---------------- */
function drawFace(c, spec, s, o) {
  o = o || {};
  const cat = spec.breed.species === 'cat';
  c.save();
  if (o.squash) c.scale(1 + o.squash, 1 - o.squash);
  drawEars(c, spec, s, true, o);
  let geo = null;
  c.fillStyle = spec.fur;
  if (cat) geo = catSilhouette(c, spec, s, o); else headPath(c, spec, s);
  c.fill();
  /* one flat shadow tone under the chin */
  c.save();
  headPath(c, spec, s); c.clip();
  c.fillStyle = shadeBand(spec);
  c.fillRect(-.6 * s, .30 * s, 1.2 * s, .3 * s);
  c.restore();
  drawMarkings(c, spec, s);
  if (cat) catSilhouette(c, spec, s, o); else headPath(c, spec, s);
  inkStroke(c, spec, s);
  if (cat) catInnerEars(c, spec, s, geo);
  drawEars(c, spec, s, false, o);
  drawBlush(c, spec, s, o);
  const look = lookOf(spec);
  drawEye(c, -look.x * s, look.y * s, look.r * s * 1.06, spec, o, -1);
  drawEye(c, look.x * s, look.y * s, look.r * s * 1.06, spec, o, 1);
  drawNoseMouth(c, spec, s, o);
  if (spec.hat) drawHat(c, spec.hat, spec, s);
  c.restore();
}

/* ---------------- full body (sitting) ----------------
   Origin sits at the head. The body reaches about .94s below it,
   which is what the room and the board rely on for placement.   */
function drawBody(c, spec, s, o) {
  o = o || {};
  const breath = o.breath || 0;
  const tailA = o.tail || 0;
  const b = spec.breed, cat = b.species === 'cat';
  const lift = breath * .012 * s;
  const gb = spec.build || STAGE_BUILD[clamp(spec.stage || 0, 0, STAGE_BUILD.length - 1)];
  const drop = (1 - gb.sy) * .60 * s;
  const W = s * LINE;
  /* the legs of a point cat are its points; a beagle's are white */
  const legFur = b.mark === 'points' ? (spec.point || spec.fur2) : b.mark === 'patch' ? spec.belly : spec.fur;

  c.save();
  if (gb.k !== 1) { c.translate(0, .93 * s); c.scale(gb.k, gb.k); c.translate(0, -.93 * s); }

  /* ---- contact shadow ---- */
  if (o.shadow !== false) {
    c.fillStyle = rgba('#2A1E12', PAL.dark ? .34 : .16);
    ellipse(c, 0, .94 * s, .50 * s, .09 * s); c.fill();
  }

  c.save();
  if (gb.sy !== 1 || gb.sx !== 1) { c.translate(0, .90 * s); c.scale(gb.sx, gb.sy); c.translate(0, -.90 * s); }

  /* ---- tail, behind everything: a stroke with the line round it ---- */
  const tail = () => {
    c.beginPath();
    if (cat) {
      c.moveTo(.26 * s, .84 * s);
      c.bezierCurveTo(.70 * s + tailA * .10 * s, .92 * s, .86 * s + tailA * .16 * s, .40 * s, .64 * s + tailA * .22 * s, .16 * s - tailA * .10 * s);
    } else {
      c.moveTo(.26 * s, .82 * s);
      c.bezierCurveTo(.62 * s + tailA * .12 * s, .86 * s, .74 * s + tailA * .18 * s, .44 * s, .58 * s + tailA * .24 * s, .30 * s - tailA * .08 * s);
    }
  };
  const tailW = (cat ? .16 : .15) * s;
  const tailFur = b.mark === 'points' ? (spec.point || spec.fur2) : b.mark === 'patch' ? spec.fur2 : spec.fur;
  tail(); c.strokeStyle = inkLine(spec); c.lineWidth = tailW + W * 2; c.lineCap = 'round'; c.stroke();
  tail(); c.strokeStyle = tailFur; c.lineWidth = tailW; c.stroke();
  if (b.mark === 'patch') {
    /* the white tip every beagle has */
    c.save(); tail(); c.strokeStyle = spec.belly; c.lineWidth = tailW; c.setLineDash([tailW * .9, s * 3]); c.lineDashOffset = -s * 1.02; c.stroke(); c.restore();
  }
  if (b.mark === 'tabby') {
    c.save(); tail(); c.strokeStyle = spec.fur2; c.lineWidth = tailW; c.setLineDash([tailW * .32, tailW * .5]); c.lineDashOffset = -s * .3; c.stroke(); c.restore();
  }

  /* ---- torso: narrow at the shoulder, widest where it sits ---- */
  const torso = () => {
    c.beginPath();
    c.moveTo(-.33 * s, .34 * s + lift);
    c.bezierCurveTo(-.50 * s, .52 * s + lift, -.50 * s, .88 * s, -.28 * s, .92 * s);
    c.lineTo(.28 * s, .92 * s);
    c.bezierCurveTo(.50 * s, .88 * s, .50 * s, .52 * s + lift, .33 * s, .34 * s + lift);
    c.closePath();
  };
  c.fillStyle = b.mark === 'patch' ? spec.belly : spec.fur;
  torso(); c.fill();
  c.save();
  torso(); c.clip();
  if (b.mark === 'patch') {
    /* a beagle's saddle: the coat over the shoulders, the dark over the back */
    c.fillStyle = spec.fur;
    ellipse(c, 0, .40 * s + lift, .44 * s, .24 * s); c.fill();
    c.fillStyle = mix(spec.fur2, '#2A1E1A', .5);
    ellipse(c, -.36 * s, .54 * s, .16 * s, .20 * s, .3); c.fill();
    ellipse(c, .36 * s, .54 * s, .16 * s, .20 * s, -.3); c.fill();
  } else if (b.mark === 'tabby') {
    c.fillStyle = spec.fur2;
    [-1, 1].forEach(sx => [.46, .60, .74].forEach(y => {
      taperMark(c, sx * .50 * s, y * s, sx * .36 * s, (y - .03) * s, sx * .24 * s, (y + .02) * s, s * .07, s * .014); c.fill();
    }));
  }
  /* the chest, lighter, on every coat that has a lighter belly */
  if (b.mark !== 'patch') {
    c.fillStyle = spec.belly;
    ellipse(c, 0, .60 * s + lift, .19 * s, .25 * s); c.fill();
  }
  /* one flat shadow band where the body meets the floor */
  c.fillStyle = shadeBand(spec);
  c.fillRect(-.6 * s, .76 * s, 1.2 * s, .3 * s);
  c.restore();
  torso(); inkStroke(c, spec, s);

  /* ---- front legs: they stand ---- */
  [-1, 1].forEach(sx => {
    const leg = () => {
      c.beginPath();
      c.moveTo(sx * .07 * s, .54 * s);
      c.lineTo(sx * .07 * s, .86 * s);
      c.quadraticCurveTo(sx * .07 * s, .935 * s, sx * .15 * s, .935 * s);
      c.lineTo(sx * .23 * s, .935 * s);
      c.quadraticCurveTo(sx * .31 * s, .935 * s, sx * .29 * s, .86 * s);
      c.lineTo(sx * .27 * s, .54 * s);
      c.closePath();
    };
    c.fillStyle = legFur;
    leg(); c.fill();
    c.save(); leg(); c.clip(); c.fillStyle = shadeBand(spec); c.fillRect(sx * .07 * s - s * .3, .80 * s, s * .6, .2 * s); c.restore();
    leg(); inkStroke(c, spec, s);
    /* toes */
    c.strokeStyle = inkLine(spec); c.lineWidth = W * .7; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(sx * .14 * s, .935 * s); c.lineTo(sx * .14 * s, .885 * s);
    c.moveTo(sx * .21 * s, .935 * s); c.lineTo(sx * .21 * s, .885 * s);
    c.stroke();
  });

  if (spec.collar) drawCollar(c, spec.collar, s, .38 * s + lift);
  c.restore();                                    /* end of the squash */

  /* ---- head ---- */
  c.save();
  c.translate(0, .02 * s + drop + breath * .012 * s);
  if (o.headTilt) c.rotate(o.headTilt);
  drawFace(c, spec, s * (.82 + gb.head), o);
  c.restore();

  c.restore();
}

/* ---------------- tiles ---------------- */
const SP = { NONE: 0, ROW: 1, COL: 2, BOMB: 3, RAIN: 4 };
const spriteCache = new Map();
function tileSprite(type, sp, px, marks, blink, cheer) {
  const key = type + '|' + sp + '|' + Math.round(px) + '|' + (marks ? 1 : 0)
    + '|' + (blink ? 'b' : '_') + '|' + (cheer ? 'c' : '_') + '|' + (PAL.dark ? 'd' : 'l')
    /* who is standing in the slot, and in what coat: adopting a pet or
       buying it a new coat has to reach the board */
    + '|' + (typeof CAST_SIG === 'string' ? CAST_SIG : '');
  let cv = spriteCache.get(key);
  if (cv) return cv;
  const pad = Math.round(px * .16);
  const W = px + pad * 2;
  cv = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr);
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.translate(W / 2, W / 2);
  paintTile(c, type, sp, px, marks, blink, cheer);
  cv._pad = pad; cv._w = W;
  spriteCache.set(key, cv);
  return cv;
}
/* ---------------- blocker sprites ----------------
   Crates, mud and ice are as detailed as the tiles and were being
   redrawn from paths on every cell of every frame. A board with
   forty muddy cells cost 71 ms a frame that way — fourteen frames a
   second. They never animate, so they cache exactly like tiles.  */
const blockerCache = new Map();
function blockerSprite(kind, px, hp) {
  const key = kind + '|' + Math.round(px) + '|' + hp + '|' + (PAL.dark ? 'd' : 'l');
  let cv = blockerCache.get(key);
  if (cv) return cv;
  const pad = Math.round(px * .18);
  const W = Math.round(px) + pad * 2;
  cv = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr);
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.translate(W / 2, W / 2);
  if (kind === 'crate') paintCrate(c, px, hp);
  else if (kind === 'mud') paintMud(c, px, hp);
  else if (kind === 'mudOver') paintMudOver(c, px, hp);
  else if (kind === 'ice') paintIce(c, px);
  else if (kind === 'bram') paintBramble(c, px, hp);
  else if (kind === 'bramOver') paintBrambleOver(c, px);
  else if (kind === 'mole') paintMole(c, px, hp);
  cv._w = W;
  blockerCache.set(key, cv);
  return cv;
}
/* draws centred on (cx, cy) — the same contract the paint* calls had */
function drawBlocker(c, kind, cx, cy, px, hp) {
  const sp = blockerSprite(kind, px, hp || 1);
  c.drawImage(sp, cx - sp._w / 2, cy - sp._w / 2, sp._w, sp._w);
}

function clearSprites() {
  spriteCache.clear();
  blockerCache.clear();
  mudOverCache.clear();
  /* the room and the physics keep their own caches off the same
     palette; they say so themselves rather than being named here */
  EV.emit('repaint');
}
EV.on('cast', clearSprites);

/* How much of a tile the animal takes.

   It was .715, and that is why the board read as amateur. A face across
   seventy percent of a piece leaves no piece: seventy-two tiles became a
   hundred and forty-four large glossy eyes all looking at you at once,
   and the silhouette underneath — the diamond, the hexagon, the shield,
   the star — was almost entirely hidden behind it. Shape is the fastest
   thing the eye sorts on and it had been painted over.

   At about half, the tile is a shape again and the animal is the detail
   inside it, which is the right way round: you match on the silhouette,
   and the face is the reason you smile while you do it. Rendered side by
   side at .715, .60, .50 and .42 before choosing. */
let TILE_FACE = .52;
function paintTile(c, type, sp, px, marks, blink, cheer) {
  /* the look belongs to whoever is standing in the slot, not to the slot */
  const breed = slotBreed(type);
  const b = BREEDS[breed];
  const s = px;
  if (sp === SP.RAIN) { paintRainbow(c, s); return; }
  const gem = b.gem, gem2 = b.gem2;

  /* ---- the piece ----
     A pale metal ring around every tile turned the board to porridge
     at forty pixels. What actually reads at that size is: one strong
     colour, a dark line to cut it out of the background, a lit top
     edge, and a shadow under the rim. Four moves, no fuss.        */
  const ink = mix(gem2, '#160D06', .62);

  /* the body, domed towards the light */
  const eg = c.createRadialGradient(-s * .17, -s * .21, s * .02, 0, s * .06, s * .66);
  eg.addColorStop(0, shade(gem, .46));
  eg.addColorStop(.36, shade(gem, .12));
  eg.addColorStop(.78, gem);
  eg.addColorStop(1, shade(gem2, -.14));
  c.fillStyle = eg;
  tilePath(c, breed, -s * .47, -s * .47, s * .94, s * .94);
  c.fill();

  c.save();
  tilePath(c, breed, -s * .47, -s * .47, s * .94, s * .94);
  c.clip();

  /* light bouncing back up off the cell below it */
  const bounce = c.createLinearGradient(0, s * .04, 0, s * .47);
  bounce.addColorStop(0, rgba(shade(gem, .35), 0));
  bounce.addColorStop(1, rgba(shade(gem, .55), .5));
  c.fillStyle = bounce;
  c.fillRect(-s * .55, s * .04, s * 1.1, s * .55);

  /* grain: enough to catch the eye, not enough to notice */
  const gr = mulberry(type * 977 + 13);
  c.globalAlpha = .05;
  for (let i = 0; i < 46; i++) {
    c.fillStyle = gr() > .5 ? '#FFFFFF' : '#000000';
    c.fillRect((gr() - .5) * s * .88, (gr() - .5) * s * .88, 1.2, 1.2);
  }
  c.globalAlpha = 1;

  /* the shadow the rim casts inward — this is the depth cue */
  c.save();
  c.globalCompositeOperation = 'multiply';
  c.strokeStyle = rgba(ink, .5);
  c.lineWidth = s * .10;
  c.translate(0, s * .028);
  tilePath(c, breed, -s * .47, -s * .47, s * .94, s * .94);
  c.stroke();
  c.restore();

  /* the lit top edge, tight against the outline */
  c.strokeStyle = rgba('#FFFFFF', .62);
  c.lineWidth = s * .055;
  c.save(); c.translate(0, s * .034);
  tilePath(c, breed, -s * .47, -s * .47, s * .94, s * .94);
  c.stroke();
  c.restore();

  /* the glaze: one crescent across the shoulder */
  const gl = c.createLinearGradient(-s * .4, -s * .44, s * .08, s * .06);
  gl.addColorStop(0, rgba('#FFFFFF', .5));
  gl.addColorStop(.52, rgba('#FFFFFF', .12));
  gl.addColorStop(1, rgba('#FFFFFF', 0));
  c.fillStyle = gl;
  c.beginPath();
  c.moveTo(-s * .55, -s * .55);
  c.lineTo(s * .34, -s * .55);
  c.quadraticCurveTo(-s * .14, -s * .04, -s * .55, s * .24);
  c.closePath();
  c.fill();
  c.restore();

  /* the line that cuts it out of the board */
  c.strokeStyle = rgba(ink, .85);
  c.lineWidth = s * .045;
  tilePath(c, breed, -s * .47, -s * .47, s * .94, s * .94);
  c.stroke();

  /* Speed stripes go on before the face. Painted over it, the
     chevrons landed straight across the eyes. */
  if (sp === SP.ROW || sp === SP.COL) paintRocket(c, s, sp === SP.COL, type);

  /* the animal */
  const spec = slotSpec(type);
  const shape = tileShape(breed);
  c.save();
  c.translate(0, s * (.015 + shape.faceY));
  /* a matched tile is having the best moment of its short life */
  drawFace(c, spec, s * TILE_FACE * shape.faceScale,
    { mouth: cheer ? 'open' : 'smile', blink: blink ? 1 : 0, mood: cheer ? 'happy' : 'content' });
  c.restore();

  /* the casing goes on last, around the outside */
  if (sp === SP.BOMB) paintBomb(c, s, type);

  /* The shape cue. It has to be readable at the size a tile actually is
     — about 42px on a narrow phone — because for a player who needs it
     there is no colour to fall back on. */
  if (marks) {
    const px = s * shape.pip[0], py = s * shape.pip[1], pr = s * .165;
    c.save();
    c.fillStyle = rgba('#1A1712', .30);
    ellipse(c, px, py + s * .012, pr, pr); c.fill();
    c.fillStyle = '#FFFFFF';
    ellipse(c, px, py, pr, pr); c.fill();
    c.strokeStyle = rgba('#1A1712', .22);
    c.lineWidth = s * .012;
    ellipse(c, px, py, pr, pr); c.stroke();
    /* ink picked against the disc, not the tile it sits on */
    drawPip(c, b.pip, px, py, s * .108, coatLum(gem2) > .55 ? '#2B2418' : gem2);
    c.restore();
  }
}
function paintRocket(c, s, vert, type) {
  /* Two chevrons pressed into the face of the piece, pointing the way
     it will fire. Stuck-on white triangles read as clip art; a carved
     mark with a lit edge reads as part of the object. */
  c.save();
  tilePath(c, type || 0, -s * .45, -s * .45, s * .90, s * .90);
  c.clip();
  if (vert) c.rotate(Math.PI / 2);

  /* the track it will travel down */
  const g = c.createLinearGradient(-s * .5, 0, s * .5, 0);
  g.addColorStop(0, rgba('#FFFFFF', 0));
  g.addColorStop(.5, rgba('#FFFFFF', .16));
  g.addColorStop(1, rgba('#FFFFFF', 0));
  c.fillStyle = g;
  c.fillRect(-s * .5, -s * .16, s, s * .32);

  [-1, 1].forEach(dir => {
    c.save();
    c.scale(dir, 1);
    const chev = (ox, w, h) => {
      c.beginPath();
      c.moveTo(ox, -h);
      c.lineTo(ox + w, 0);
      c.lineTo(ox, h);
      c.lineTo(ox - w * .46, h);
      c.lineTo(ox + w * .54, 0);
      c.lineTo(ox - w * .46, -h);
      c.closePath();
    };
    /* pressed in: dark above, bright below */
    c.fillStyle = rgba('#2A1B0C', .45);
    c.save(); c.translate(0, -s * .02); chev(s * .30, s * .14, s * .21); c.fill(); c.restore();
    c.fillStyle = rgba('#FFFFFF', .95);
    chev(s * .30, s * .14, s * .21); c.fill();
    c.fillStyle = rgba('#FFFFFF', .45);
    chev(s * .155, s * .12, s * .18); c.fill();
    c.restore();
  });
  c.restore();
}
function paintBomb(c, s, type) {
  /* A casing wrapped around the rim rather than a ring drawn across
     the middle: the animal is the thing you match on, and it has to
     stay legible with the fuse lit. */
  c.save();
  c.save();
  tilePath(c, type || 0, -s * .47, -s * .47, s * .94, s * .94);
  c.clip();
  /* the dark band, just inside the outline. Wider and darker than it
     was: at 45px on a phone the bomb was the one special a player
     could look straight past — the rocket has its chevrons and the
     rainbow its swirl, and this had a thin ring that read as a shadow */
  c.strokeStyle = rgba('#241A12', .92);
  c.lineWidth = s * .18;
  tilePath(c, type || 0, -s * .47, -s * .47, s * .94, s * .94);
  c.stroke();
  /* lit on top, shaded underneath, so the band has thickness */
  c.strokeStyle = rgba('#FFFFFF', .28);
  c.lineWidth = s * .03;
  c.save(); c.translate(0, s * .055);
  tilePath(c, type || 0, -s * .47, -s * .47, s * .94, s * .94); c.stroke();
  c.restore();
  c.restore();

  /* rivets around the band */
  c.fillStyle = rgba('#F6E9D0', .85);
  for (let i = 0; i < 8; i++) {
    const a2 = i / 8 * Math.PI * 2 + Math.PI / 8;
    ellipse(c, Math.cos(a2) * s * .40, Math.sin(a2) * s * .40, s * .032, s * .032);
    c.fill();
  }

  /* fuse */
  c.strokeStyle = '#8A6A4A'; c.lineWidth = s * .045; c.lineCap = 'round';
  c.beginPath();
  c.moveTo(s * .22, -s * .40);
  c.quadraticCurveTo(s * .40, -s * .50, s * .34, -s * .56);
  c.stroke();
  c.restore();
}

function paintRainbow(c, s) {
  c.save();
  c.shadowColor = rgba('#000000', PAL.dark ? .5 : .25);
  c.shadowBlur = s * .16; c.shadowOffsetY = s * .05;
  const rimLit = PAL.dark ? '#D8C29B' : '#FBF0D8';
  const rimDim = PAL.dark ? '#6A5A40' : '#B99C6E';
  const mg = c.createLinearGradient(-s * .42, -s * .46, s * .42, s * .46);
  mg.addColorStop(0, shade(rimLit, .16));
  mg.addColorStop(.32, rimLit);
  mg.addColorStop(.62, rimDim);
  mg.addColorStop(1, shade(rimDim, -.2));
  c.fillStyle = mg;
  squircle(c, -s * .47, -s * .47, s * .94, s * .94, 4.2);
  c.fill();
  const g = c.createLinearGradient(-s * .4, -s * .4, s * .4, s * .4);
  BREEDS.forEach((b, i) => g.addColorStop(i / (BREEDS.length - 1), b.gem));
  c.fillStyle = g;
  squircle(c, -s * .395, -s * .395, s * .79, s * .79, 4.2);
  c.fill();
  c.restore();
  c.save();
  squircle(c, -s * .395, -s * .395, s * .79, s * .79, 4.2); c.clip();
  /* swirl */
  for (let i = 0; i < 6; i++) {
    c.save();
    c.rotate(i / 6 * Math.PI * 2);
    c.fillStyle = rgba('#FFFFFF', .16);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(s * .3, -s * .12, s * .6, s * .1);
    c.quadraticCurveTo(s * .3, s * .02, 0, 0);
    c.fill();
    c.restore();
  }
  c.strokeStyle = rgba('#FFFFFF', .5); c.lineWidth = s * .07;
  squircle(c, -s * .455, -s * .47, s * .91, s * .92, 4.2); c.stroke();
  c.restore();
  /* white paw badge */
  c.save();
  c.fillStyle = rgba('#FFFFFF', .95);
  ellipse(c, 0, 0, s * .26, s * .26); c.fill();
  c.fillStyle = '#3A2E22';
  const r = s * .05;
  ellipse(c, -r * 1.5, -r * 1.2, r * .55, r * .72); c.fill();
  ellipse(c, -r * .5, -r * 1.7, r * .55, r * .75); c.fill();
  ellipse(c, r * .5, -r * 1.7, r * .55, r * .75); c.fill();
  ellipse(c, r * 1.5, -r * 1.2, r * .55, r * .72); c.fill();
  c.beginPath();
  c.moveTo(0, -r * .3);
  c.bezierCurveTo(r * 2, -r * .3, r * 2, r * 2.1, 0, r * 2.1);
  c.bezierCurveTo(-r * 2, r * 2.1, -r * 2, -r * .3, 0, -r * .3);
  c.fill();
  c.restore();
}

/* ---------------- live overlays ----------------
   The tile itself is a cached bitmap. These few strokes ride on
   top of it each frame, which is what stops a special from
   looking like a sticker.
   ============================================================ */
function drawTileFx(c, type, sp, s, t, seed) {
  if (sp === SP.NONE) return;
  const ph = t + (seed || 0) * .7;
  /* the silhouette belongs to whoever stands in the slot, same as the
     tile it is drawn over */
  const breed = slotBreed(type);

  if (sp === SP.BOMB) {
    /* the fuse spark: jitters, flickers, throws light on the tile */
    const fx = s * .34 + Math.sin(ph * 21) * s * .012;
    const fy = -s * .55 + Math.cos(ph * 17) * s * .012;
    const flick = .72 + .28 * Math.sin(ph * 27) * Math.sin(ph * 11);
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = flick;
    c.drawImage(blobBrush('#FFC24A'), fx - s * .28, fy - s * .28, s * .56, s * .56);
    c.globalAlpha = flick * .9;
    c.drawImage(blobBrush('#FFF6D2'), fx - s * .09, fy - s * .09, s * .18, s * .18);
    /* the glow it casts back down onto the casing */
    c.globalAlpha = flick * .22;
    c.drawImage(blobBrush('#FFB43C'), -s * .1, -s * .5, s * .6, s * .6);
    c.restore();
    return;
  }

  if (sp === SP.RAIN) {
    /* the swirl turns and the surface shimmers */
    c.save();
    tilePath(c, breed, -s * .45, -s * .45, s * .90, s * .90);
    c.clip();
    c.rotate(ph * .55);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      c.save();
      c.rotate(i / 3 * 6.2832);
      c.globalAlpha = .1 + .06 * Math.sin(ph * 2 + i);
      c.fillStyle = '#FFFFFF';
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(s * .3, -s * .14, s * .68, s * .1);
      c.quadraticCurveTo(s * .3, s * .02, 0, 0);
      c.fill();
      c.restore();
    }
    c.restore();
    return;
  }

  /* rockets: a light running along the axis it will fire down */
  c.save();
  tilePath(c, breed, -s * .45, -s * .45, s * .90, s * .90);
  c.clip();
  if (sp === SP.COL) c.rotate(Math.PI / 2);
  const k = ((ph * .8) % 1);
  const x = lerp(-s * .6, s * .6, k);
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = Math.sin(k * Math.PI) * .5;
  c.drawImage(blobBrush('#FFFFFF'), x - s * .3, -s * .5, s * .6, s);
  c.restore();
}

/* ---------------- blockers ---------------- */
/* A molehill: a heap of turned earth with a hole in the top and a
   couple of clods beside it. Two layers deep it is bigger and darker,
   the way a crate is heavier at two.

   Drawn rather than iconified, because it sits on the board next to the
   animals and an icon would look like a button. The countdown is not
   painted here — it changes every move and this is a cached sprite. */
function paintMole(c, s, hp) {
  const deep = hp > 1;
  const r = s * (deep ? .46 : .40);
  c.save();
  /* the mound */
  const g = c.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, deep ? '#8A6A44' : '#9C7A50');
  g.addColorStop(1, deep ? '#4C3722' : '#5E452C');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-r, r * .62);
  c.bezierCurveTo(-r * .82, -r * .70, r * .82, -r * .70, r, r * .62);
  c.closePath();
  c.fill();
  /* the hole */
  c.fillStyle = '#241A10';
  ellipse(c, 0, -r * .04, r * .30, r * .20); c.fill();
  c.fillStyle = rgba('#000000', .35);
  ellipse(c, 0, -r * .10, r * .30, r * .20); c.fill();
  /* clods, so the heap reads as loose earth and not as a dome */
  c.fillStyle = deep ? '#A5824F' : '#B08B57';
  const cl = mulberry(hp * 977 + 31);
  for (let i = 0; i < (deep ? 7 : 5); i++) {
    const a = cl() * Math.PI * 2, d = r * (.45 + cl() * .45);
    ellipse(c, Math.cos(a) * d, r * .44 + Math.sin(a) * r * .14,
      r * (.07 + cl() * .06), r * (.05 + cl() * .04)); c.fill();
  }
  c.restore();
}

function paintCrate(c, s, hp) {
  /* a real crate: four planks, iron corners, nails, and damage
     that only shows once you have already hit it. */
  /* The well behind these is #6B563A. At the old browns a crate was a
     slightly different shade of the board rather than a thing sitting on
     it, and half a board of them read as a hole. */
  const wood = hp > 1 ? '#A6713F' : '#C69257';
  c.save();
  c.shadowColor = rgba('#000000', PAL.dark ? .45 : .22);
  c.shadowBlur = s * .1; c.shadowOffsetY = s * .04;
  const g = c.createLinearGradient(-s * .4, -s / 2, s * .4, s / 2);
  g.addColorStop(0, shade(wood, .22));
  g.addColorStop(.55, wood);
  g.addColorStop(1, shade(wood, -.2));
  c.fillStyle = g;
  rr(c, -s * .46, -s * .46, s * .92, s * .92, s * .1); c.fill();
  c.restore();

  c.save();
  rr(c, -s * .46, -s * .46, s * .92, s * .92, s * .1); c.clip();

  /* plank seams */
  c.strokeStyle = rgba('#2E1F10', .38);
  c.lineWidth = s * .035;
  for (let i = 1; i < 4; i++) {
    const y = -s * .46 + i * s * .23;
    c.beginPath(); c.moveTo(-s * .5, y); c.lineTo(s * .5, y); c.stroke();
  }
  c.strokeStyle = rgba('#FFFFFF', .12);
  c.lineWidth = s * .016;
  for (let i = 1; i < 4; i++) {
    const y = -s * .46 + i * s * .23 + s * .022;
    c.beginPath(); c.moveTo(-s * .5, y); c.lineTo(s * .5, y); c.stroke();
  }
  /* grain: long wavering lines along each plank */
  c.strokeStyle = rgba('#2E1F10', .13);
  c.lineWidth = s * .012;
  for (let i = 0; i < 5; i++) {
    const y = -s * .38 + i * .19 * s;
    c.beginPath();
    c.moveTo(-s * .5, y);
    c.quadraticCurveTo(0, y + (i % 2 ? s * .022 : -s * .022), s * .5, y);
    c.stroke();
  }
  /* a couple of knots */
  [[-.20, -.28], [.24, .16]].forEach((k, i) => {
    c.strokeStyle = rgba('#2E1F10', .28);
    c.lineWidth = s * .014;
    for (let ring = 1; ring <= 3; ring++) {
      ellipse(c, k[0] * s, k[1] * s, s * .022 * ring, s * .014 * ring, i ? .4 : -.3);
      c.stroke();
    }
  });
  /* diagonal brace */
  c.strokeStyle = rgba('#2E1F10', .15);
  c.lineWidth = s * .055;
  c.beginPath(); c.moveTo(-s * .46, s * .46); c.lineTo(s * .46, -s * .46); c.stroke();
  c.strokeStyle = rgba('#FFFFFF', .09);
  c.lineWidth = s * .018;
  c.beginPath(); c.moveTo(-s * .44, s * .44); c.lineTo(s * .48, -s * .44); c.stroke();

  /* reinforcement: an iron band, so a two-hit crate is a different shape
     and not merely a different brown */
  if (hp > 1) {
    const bg = c.createLinearGradient(0, -s * .13, 0, s * .13);
    bg.addColorStop(0, '#7B8595');
    bg.addColorStop(.42, '#5A6472');
    bg.addColorStop(1, '#414A56');
    c.fillStyle = bg;
    c.fillRect(-s * .5, -s * .115, s, s * .23);
    c.fillStyle = rgba('#FFFFFF', .22);
    c.fillRect(-s * .5, -s * .115, s, s * .028);
    c.fillStyle = rgba('#1A1F26', .35);
    c.fillRect(-s * .5, s * .085, s, s * .03);
    /* rivets */
    [-.34, .34].forEach(x => {
      c.fillStyle = '#8E98A6';
      ellipse(c, x * s, 0, s * .045, s * .045); c.fill();
      c.fillStyle = rgba('#FFFFFF', .45);
      ellipse(c, x * s - s * .013, -s * .013, s * .018, s * .015); c.fill();
      c.fillStyle = rgba('#20262E', .4);
      ellipse(c, x * s + s * .012, s * .014, s * .016, s * .012); c.fill();
    });
  }

  /* damage: splits and a chipped corner, only on the last hit point */
  if (hp <= 1) {
    c.strokeStyle = rgba('#241708', .55);
    c.lineWidth = s * .026; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-s * .3, -s * .44);
    c.lineTo(-s * .18, -s * .18); c.lineTo(-s * .26, s * .02); c.lineTo(-s * .12, s * .3);
    c.moveTo(s * .18, -s * .1); c.lineTo(s * .3, s * .12);
    c.stroke();
    c.fillStyle = rgba('#241708', .35);
    c.beginPath();
    c.moveTo(s * .46, s * .18); c.lineTo(s * .3, s * .3); c.lineTo(s * .46, s * .46); c.closePath();
    c.fill();
  }

  /* inner shadow so it sits down in the well */
  const sh = c.createLinearGradient(0, -s * .46, 0, s * .46);
  sh.addColorStop(0, rgba('#000000', .22));
  sh.addColorStop(.3, rgba('#000000', 0));
  sh.addColorStop(1, rgba('#000000', .16));
  c.fillStyle = sh;
  c.fillRect(-s * .5, -s * .5, s, s);
  c.restore();

  /* A defined edge. Without one the crate's own gradient runs straight
     into the well behind it and the tile has no silhouette — which is
     what made a board that is half crates read as a hole rather than as
     a stack of boxes. */
  c.strokeStyle = rgba('#3A2614', PAL.dark ? .55 : .42);
  c.lineWidth = Math.max(1, s * .035);
  rr(c, -s * .46, -s * .46, s * .92, s * .92, s * .1); c.stroke();

  /* iron corners and their nails */
  c.save();
  const iron = PAL.dark ? '#5E6A7A' : '#7A6A58';
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(pair => {
    c.save(); c.scale(pair[0], pair[1]);
    c.fillStyle = iron;
    c.beginPath();
    c.moveTo(s * .46, s * .46); c.lineTo(s * .18, s * .46);
    c.lineTo(s * .18, s * .38); c.lineTo(s * .38, s * .38);
    c.lineTo(s * .38, s * .18); c.lineTo(s * .46, s * .18);
    c.closePath(); c.fill();
    c.fillStyle = rgba('#FFFFFF', .3);
    c.fillRect(s * .19, s * .385, s * .18, s * .012);
    c.fillStyle = shade(iron, -.3);
    ellipse(c, s * .30, s * .30, s * .028, s * .028); c.fill();
    c.fillStyle = rgba('#FFFFFF', .45);
    ellipse(c, s * .293, s * .293, s * .012, s * .012); c.fill();
    c.restore();
  });
  c.strokeStyle = rgba('#2E1F10', .5);
  c.lineWidth = s * .04;
  rr(c, -s * .46, -s * .46, s * .92, s * .92, s * .1); c.stroke();
  c.restore();
}

function paintMud(c, s, hp) {
  /* thick and wet: a hollow filled to the brim, not a flat sticker */
  const deep = hp > 1;
  const col = deep ? '#3B2A17' : '#59421F';
  c.save();
  c.fillStyle = rgba('#000000', deep ? .3 : .2);
  rr(c, -s * .5, -s * .5, s, s, s * .1); c.fill();

  c.save();
  rr(c, -s * .5, -s * .5, s, s, s * .1); c.clip();

  const g = c.createRadialGradient(-s * .16, -s * .2, s * .05, 0, s * .1, s * .82);
  g.addColorStop(0, shade(col, .26));
  g.addColorStop(.55, col);
  g.addColorStop(1, shade(col, -.34));
  c.fillStyle = g;
  c.fillRect(-s * .55, -s * .55, s * 1.1, s * 1.1);
  /* the surface meniscus — mud pulls away from the corners a little */
  c.fillStyle = rgba('#000000', .16);
  c.beginPath();
  c.rect(-s * .55, -s * .55, s * 1.1, s * 1.1);
  const lobes = 14;
  for (let i = lobes; i >= 0; i--) {
    const a = i / lobes * Math.PI * 2;
    const rad = s * (.53 + Math.sin(a * 3 + (deep ? 1.2 : .3)) * .03);
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad * .98;
    i === lobes ? c.moveTo(x, y) : c.lineTo(x, y);
  }
  c.closePath();
  c.fill('evenodd');

  /* wet sheen */
  c.fillStyle = rgba('#FFFFFF', deep ? .13 : .2);
  ellipse(c, -s * .14, -s * .2, s * .22, s * .09, -.5); c.fill();
  c.fillStyle = rgba('#FFFFFF', .12);
  ellipse(c, s * .2, s * .16, s * .1, s * .05, -.4); c.fill();

  /* bubbles pushing up through it */
  [[-.24, .2, .07], [.1, -.28, .05], [.26, -.04, .045], [-.05, .3, .055]].forEach(b => {
    c.fillStyle = rgba('#000000', .16);
    ellipse(c, b[0] * s, b[1] * s, b[2] * s, b[2] * s * .8); c.fill();
    c.strokeStyle = rgba('#FFFFFF', .16); c.lineWidth = s * .012;
    ellipse(c, b[0] * s, b[1] * s, b[2] * s, b[2] * s * .8); c.stroke();
    c.fillStyle = rgba('#FFFFFF', .2);
    ellipse(c, (b[0] - b[2] * .3) * s, (b[1] - b[2] * .35) * s, b[2] * s * .3, b[2] * s * .22); c.fill();
  });
  /* grit */
  c.fillStyle = rgba('#000000', .2);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, rad = s * (.1 + (i % 4) * .09);
    ellipse(c, Math.cos(a) * rad, Math.sin(a) * rad * .9, s * .014, s * .011, a); c.fill();
  }
  /* a visible second layer means "this one takes two" */
  if (deep) {
    c.strokeStyle = rgba('#FFFFFF', .12);
    c.lineWidth = s * .03;
    c.beginPath();
    for (let i = 0; i <= 9; i++) {
      const a = i / 9 * Math.PI * 2;
      const x = Math.cos(a) * s * .33, y = Math.sin(a) * s * .33;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath(); c.stroke();
  }
  c.restore();
  c.restore();
}

/* Mud sits under the tile, and a tile covers almost the whole cell, so
   the layer underneath needs to say so on top as well: a wet edge
   vignette plus a few flecks, light enough to read the face through. */
/* One canvas per (size, depth) rather than a gradient per cell per
   frame: the picture never changes, and a board can hold thirty of them. */
const mudOverCache = new Map();
function mudOverSprite(px, hp) {
  const key = Math.round(px) + '|' + hp;
  let cv = mudOverCache.get(key);
  if (cv) return cv;
  const W = Math.ceil(px) + 2;
  cv = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr);
  const cc = cv.getContext('2d');
  cc.setTransform(dpr, 0, 0, dpr, 0, 0);
  cc.translate(W / 2, W / 2);
  drawMudOver(cc, px, hp);
  cv._w = W;
  mudOverCache.set(key, cv);
  return cv;
}
function paintMudOver(c, s, hp) {
  const sp = mudOverSprite(s, hp);
  c.drawImage(sp, -sp._w / 2, -sp._w / 2, sp._w, sp._w);
}
function drawMudOver(c, s, hp) {
  const deep = hp > 1;
  const col = deep ? '#4A3018' : '#6E4F2E';
  c.save();
  squircle(c, -s * .5, -s * .5, s, s, 4.2); c.clip();
  const g = c.createRadialGradient(0, 0, s * .16, 0, 0, s * .62);
  g.addColorStop(0, rgba(col, 0));
  g.addColorStop(.62, rgba(col, deep ? .20 : .10));
  g.addColorStop(1, rgba(col, deep ? .62 : .38));
  c.fillStyle = g;
  c.fillRect(-s * .5, -s * .5, s, s);
  /* flecks thrown up the side of the tile */
  c.fillStyle = rgba(col, deep ? .55 : .34);
  const rr2 = mulberry(deep ? 91 : 37);
  for (let i = 0; i < (deep ? 7 : 4); i++) {
    const a = rr2() * Math.PI * 2, rad = s * (.30 + rr2() * .18);
    ellipse(c, Math.cos(a) * rad, Math.sin(a) * rad, s * (.035 + rr2() * .03), s * (.028 + rr2() * .025), a);
    c.fill();
  }
  /* A second pass is a shape, not a shade: mud wells up into all four
     corners, where it is not covering the animal's face, so the cells
     that cost two moves can be read at a glance. */
  if (deep) {
    c.fillStyle = rgba('#3A2410', .82);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      c.save();
      c.translate(sx * s * .5, sy * s * .5);
      c.scale(sx, sy);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(s * .34, 0);
      c.quadraticCurveTo(s * .17, s * .10, s * .13, s * .21);
      c.quadraticCurveTo(s * .09, s * .30, 0, s * .34);
      c.closePath();
      c.fill();
      c.restore();
    });
    c.strokeStyle = rgba('#8A6634', .45);
    c.lineWidth = s * .022;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      c.save();
      c.translate(sx * s * .5, sy * s * .5);
      c.scale(sx, sy);
      c.beginPath();
      c.moveTo(s * .34, 0);
      c.quadraticCurveTo(s * .17, s * .10, s * .13, s * .21);
      c.quadraticCurveTo(s * .09, s * .30, 0, s * .34);
      c.stroke();
      c.restore();
    });
  }
  c.restore();
}

/* ---------------- brambles ---------------- */
/* Drawn twice like mud: a bed under the tile that shows in the corners,
   and a thorned outline over it so a covered tile is unmistakable. */
function paintBramble(c, s) {
  c.save();
  c.fillStyle = rgba('#2E4A2A', .55);
  rr(c, -s * .5, -s * .5, s, s, s * .12); c.fill();
  c.restore();
}
function paintBrambleOver(c, s) {
  const dark = '#20361D', leaf = '#4E7A42';
  c.save();
  squircle(c, -s * .5, -s * .5, s, s, 4.2); c.clip();
  /* a vine running corner to corner, with a couple of runners off it */
  c.strokeStyle = dark; c.lineWidth = s * .075; c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-s * .55, -s * .30);
  c.bezierCurveTo(-s * .12, -s * .48, s * .10, -s * .04, s * .55, -s * .22);
  c.moveTo(-s * .55, s * .26);
  c.bezierCurveTo(-s * .10, s * .44, s * .14, s * .04, s * .55, s * .30);
  c.stroke();
  c.strokeStyle = leaf; c.lineWidth = s * .034;
  c.beginPath();
  c.moveTo(-s * .30, -s * .36); c.lineTo(-s * .34, -s * .12);
  c.moveTo(s * .22, -s * .10); c.lineTo(s * .30, -s * .34);
  c.moveTo(-s * .18, s * .38); c.lineTo(-s * .24, s * .16);
  c.moveTo(s * .16, s * .16); c.lineTo(s * .26, s * .40);
  c.stroke();
  /* thorns */
  c.fillStyle = dark;
  const rr2 = mulberry(23);
  for (let i = 0; i < 7; i++) {
    const a = rr2() * 6.2832, rad = s * (.20 + rr2() * .26);
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad * .8;
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath();
    c.moveTo(0, -s * .05); c.lineTo(s * .085, 0); c.lineTo(0, s * .05);
    c.closePath(); c.fill();
    c.restore();
  }
  /* darkens toward the edges so the tile face stays readable */
  const g = c.createRadialGradient(0, 0, s * .18, 0, 0, s * .62);
  g.addColorStop(0, rgba(dark, 0));
  g.addColorStop(1, rgba(dark, .42));
  c.fillStyle = g;
  c.fillRect(-s * .5, -s * .5, s, s);
  c.restore();
}

function paintIce(c, s) {
  /* frozen over: a faceted slab, frost creeping in from the
     corners, a cold bright rim */
  c.save();
  rr(c, -s * .48, -s * .48, s * .96, s * .96, s * .14);
  c.save(); c.clip();

  const g = c.createLinearGradient(-s * .4, -s * .48, s * .4, s * .48);
  g.addColorStop(0, rgba('#EAF7FF', .62));
  g.addColorStop(.45, rgba('#BFE4F5', .42));
  g.addColorStop(1, rgba('#93C6E4', .55));
  c.fillStyle = g;
  c.fillRect(-s * .5, -s * .5, s, s);

  const facets = [
    [[-.5, -.5], [.1, -.5], [-.2, 0], [-.5, -.1]],
    [[.1, -.5], [.5, -.5], [.5, -.05], [-.2, 0]],
    [[-.5, -.1], [-.2, 0], [-.05, .5], [-.5, .5]],
    [[-.2, 0], [.5, -.05], [.5, .5], [-.05, .5]]
  ];
  const alphas = [.16, .05, .1, .02];
  facets.forEach((f, i) => {
    c.fillStyle = rgba('#FFFFFF', alphas[i]);
    c.beginPath();
    f.forEach((pt, k) => k ? c.lineTo(pt[0] * s, pt[1] * s) : c.moveTo(pt[0] * s, pt[1] * s));
    c.closePath(); c.fill();
  });

  /* cracks, drawn twice for a soft halo */
  const cracks = cc => {
    cc.beginPath();
    cc.moveTo(-s * .34, -s * .46); cc.lineTo(-s * .1, -s * .12);
    cc.lineTo(-s * .28, s * .22); cc.lineTo(-s * .16, s * .46);
    cc.moveTo(-s * .1, -s * .12); cc.lineTo(s * .22, -s * .3);
    cc.moveTo(s * .38, -s * .2); cc.lineTo(s * .12, s * .08); cc.lineTo(s * .3, s * .42);
    cc.stroke();
  };
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = rgba('#FFFFFF', .22); c.lineWidth = s * .07; cracks(c);
  c.strokeStyle = rgba('#FFFFFF', .65); c.lineWidth = s * .026; cracks(c);

  /* frost feathering in from every corner */
  c.strokeStyle = rgba('#FFFFFF', .5);
  c.lineWidth = s * .014;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(pair => {
    c.save(); c.scale(pair[0], pair[1]);
    for (let i = 0; i < 5; i++) {
      const a = .35 + i * .22;
      const len = s * (.30 - i * .03);
      const ex = s * .46 - Math.cos(a) * len, ey = s * .46 - Math.sin(a) * len;
      c.beginPath();
      c.moveTo(s * .46, s * .46);
      c.lineTo(ex, ey);
      for (let k = 1; k <= 3; k++) {
        const px = lerp(s * .46, ex, k / 4), py = lerp(s * .46, ey, k / 4);
        c.moveTo(px, py);
        c.lineTo(px - Math.cos(a - .9) * len * .18, py - Math.sin(a - .9) * len * .18);
        c.moveTo(px, py);
        c.lineTo(px - Math.cos(a + .9) * len * .18, py - Math.sin(a + .9) * len * .18);
      }
      c.stroke();
    }
    c.restore();
  });
  c.restore();

  c.strokeStyle = rgba('#FFFFFF', .8); c.lineWidth = s * .05;
  c.stroke();
  c.strokeStyle = rgba('#6FA8C8', .35); c.lineWidth = s * .016;
  rr(c, -s * .44, -s * .44, s * .88, s * .88, s * .12); c.stroke();
  c.restore();
}
/* the little one you walk home */
function paintPup(c, s, type) {
  const spec = slotSpec(type === undefined ? 0 : type);
  c.save();
  /* woven basket */
  c.fillStyle = '#C79A62';
  c.beginPath();
  c.moveTo(-s * .40, -s * .02);
  c.lineTo(s * .40, -s * .02);
  c.lineTo(s * .32, s * .40);
  c.lineTo(-s * .32, s * .40);
  c.closePath(); c.fill();
  c.strokeStyle = rgba('#7B5730', .5); c.lineWidth = s * .035;
  for (let i = 0; i < 3; i++) {
    const y = -s * .02 + (i + 1) * s * .11;
    c.beginPath(); c.moveTo(-s * .39 + i * s * .02, y); c.lineTo(s * .39 - i * s * .02, y); c.stroke();
  }
  c.fillStyle = '#B98B54';
  rr(c, -s * .44, -s * .09, s * .88, s * .1, s * .05); c.fill();
  c.save();
  c.translate(0, -s * .22);
  drawFace(c, spec, s * .52, { mouth: 'smile' });
  c.restore();
  c.restore();
}

/* ---------------- goods art ---------------- */
function paintGood(c, id, s) {
  c.save();
  switch (id) {
    case 'kibble': {
      c.fillStyle = '#B5763F';
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2, r = s * .22;
        c.save(); c.translate(Math.cos(a) * r, Math.sin(a) * r * .55 + s * .06); c.rotate(a);
        c.beginPath();
        for (let k = 0; k < 4; k++) {
          const aa = k / 4 * Math.PI * 2 + .4;
          const px = Math.cos(aa) * s * .09, py = Math.sin(aa) * s * .09;
          k ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.closePath(); c.fill(); c.restore();
      }
      c.fillStyle = '#8C5A2E';
      ellipse(c, 0, s * .12, s * .3, s * .12); c.globalAlpha = .3; c.fill(); c.globalAlpha = 1;
      break;
    }
    case 'tuna': {
      c.fillStyle = '#9AA7B4';
      rr(c, -s * .3, -s * .16, s * .6, s * .34, s * .06); c.fill();
      c.fillStyle = '#C3CDD8';
      rr(c, -s * .3, -s * .16, s * .6, s * .1, s * .05); c.fill();
      c.fillStyle = '#E8A487';
      ellipse(c, 0, -s * .2, s * .26, s * .07); c.fill();
      c.strokeStyle = '#7C8894'; c.lineWidth = s * .03;
      c.beginPath(); c.arc(0, -s * .2, s * .26, Math.PI, 0); c.stroke();
      c.fillStyle = '#D98A6A';
      ellipse(c, s * .05, -s * .3, s * .1, s * .05, -.5); c.fill();
      break;
    }
    case 'stew': {
      c.fillStyle = '#7A5A3E';
      c.beginPath(); c.moveTo(-s * .32, -s * .1); c.lineTo(s * .32, -s * .1);
      c.quadraticCurveTo(s * .3, s * .3, 0, s * .3);
      c.quadraticCurveTo(-s * .3, s * .3, -s * .32, -s * .1); c.closePath(); c.fill();
      c.fillStyle = '#A6714A';
      ellipse(c, 0, -s * .1, s * .32, s * .1); c.fill();
      c.fillStyle = '#C98B4E';
      [[-.1, -.12], [.08, -.14], [0, -.07]].forEach(p => { ellipse(c, p[0] * s, p[1] * s, s * .07, s * .05); c.fill(); });
      c.strokeStyle = rgba('#FFFFFF', .35); c.lineWidth = s * .03; c.lineCap = 'round';
      [-.12, 0, .12].forEach((x, i) => {
        c.beginPath(); c.moveTo(x * s, -s * .2);
        c.quadraticCurveTo(x * s + s * .05, -s * .3, x * s, -s * .38); c.stroke();
      });
      break;
    }
    case 'cake': {
      /* a slice from the side: two sponges, cream between and on top,
         and a marzipan carrot leaning on it. It was a beige rectangle */
      const w = s * .30, top = -s * .10, bot = s * .30;
      /* sponge, in two layers with a filling between them */
      const sponge = (y0, y1) => {
        c.beginPath();
        c.moveTo(-w, y0); c.lineTo(w, y0);
        c.lineTo(w * .88, y1); c.lineTo(-w * .88, y1);
        c.closePath(); c.fill();
      };
      c.fillStyle = '#C98A55'; sponge(top + s * .07, top + s * .19);
      c.fillStyle = '#F6EBD8'; sponge(top + s * .19, top + s * .23);
      c.fillStyle = '#BE8150'; sponge(top + s * .23, bot);
      /* crumb */
      const cr = mulberry(4242);
      c.fillStyle = rgba('#8A5A2E', .35);
      for (let i = 0; i < 16; i++) {
        const y = top + s * .07 + cr() * (bot - top - s * .07);
        if (y > top + s * .19 && y < top + s * .23) continue;
        ellipse(c, (cr() - .5) * w * 1.7, y, s * .012, s * .012); c.fill();
      }
      /* frosting, swagged over the top and dripping a little down the front */
      c.fillStyle = '#FBF3E4';
      c.beginPath();
      c.moveTo(-w * 1.06, top + s * .08);
      c.quadraticCurveTo(-w * .5, top - s * .05, 0, top + s * .02);
      c.quadraticCurveTo(w * .55, top + s * .09, w * 1.06, top + s * .05);
      c.lineTo(w * 1.06, top + s * .13);
      c.quadraticCurveTo(w * .4, top + s * .19, -w * .2, top + s * .12);
      c.quadraticCurveTo(-w * .7, top + s * .09, -w * 1.06, top + s * .15);
      c.closePath(); c.fill();
      c.fillStyle = rgba('#E7D6B8', .7);
      c.beginPath();
      c.moveTo(-w * .2, top + s * .12);
      c.quadraticCurveTo(-w * .1, top + s * .21, w * .04, top + s * .13);
      c.closePath(); c.fill();
      /* the carrot on top */
      c.save();
      c.translate(w * .16, top - s * .02); c.rotate(.42);
      c.fillStyle = '#E8853C';
      c.beginPath();
      c.moveTo(-s * .045, -s * .05); c.lineTo(s * .045, -s * .05);
      c.quadraticCurveTo(s * .02, s * .10, 0, s * .12);
      c.quadraticCurveTo(-s * .02, s * .10, -s * .045, -s * .05);
      c.closePath(); c.fill();
      c.strokeStyle = rgba('#B85E22', .5); c.lineWidth = s * .011;
      [-.02, .015].forEach(x => { c.beginPath();
        c.moveTo(x * s - s * .02, 0); c.lineTo(x * s + s * .02, s * .005); c.stroke(); });
      c.fillStyle = '#63A45E';
      [-.55, 0, .55].forEach(a => { c.save(); c.rotate(a);
        ellipse(c, 0, -s * .10, s * .015, s * .05); c.fill(); c.restore(); });
      c.restore();
      break;
    }
    case 'yarn': {
      const g = c.createRadialGradient(-s * .08, -s * .08, s * .04, 0, 0, s * .3);
      g.addColorStop(0, '#E8798A'); g.addColorStop(1, '#B94E62');
      c.fillStyle = g; ellipse(c, 0, s * .02, s * .28, s * .28); c.fill();
      c.strokeStyle = rgba('#7C3346', .5); c.lineWidth = s * .028;
      for (let i = 0; i < 4; i++) {
        c.save(); c.translate(0, s * .02); c.rotate(i * .6);
        c.beginPath(); c.ellipse(0, 0, s * .27, s * .12, 0, 0, Math.PI * 2); c.stroke(); c.restore();
      }
      c.strokeStyle = '#E8798A'; c.lineWidth = s * .03;
      c.beginPath(); c.moveTo(s * .26, s * .06); c.quadraticCurveTo(s * .42, s * .16, s * .34, s * .3); c.stroke();
      break;
    }
    case 'tennis': {
      c.fillStyle = '#C8D95A'; ellipse(c, 0, s * .02, s * .27, s * .27); c.fill();
      c.strokeStyle = '#F6F1E4'; c.lineWidth = s * .045;
      c.beginPath(); c.arc(-s * .26, s * .02, s * .3, -.9, .9); c.stroke();
      c.beginPath(); c.arc(s * .26, s * .02, s * .3, Math.PI - .9, Math.PI + .9); c.stroke();
      break;
    }
    case 'wand': {
      c.strokeStyle = '#8A6A4A'; c.lineWidth = s * .045; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-s * .3, s * .28); c.lineTo(s * .12, -s * .12); c.stroke();
      ['#E8798A', '#F5B851', '#7FBFA3'].forEach((col, i) => {
        c.save(); c.translate(s * .14, -s * .14); c.rotate(-.5 + i * .55);
        c.fillStyle = col;
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * .1, -s * .06, s * .26, -s * .02);
        c.quadraticCurveTo(s * .1, s * .04, 0, 0); c.fill();
        c.restore();
      });
      break;
    }
    case 'puzzle': {
      /* body */
      const bg = c.createLinearGradient(0, -s * .22, 0, s * .26);
      bg.addColorStop(0, '#7FA0C9');
      bg.addColorStop(1, '#54739B');
      c.fillStyle = bg;
      rr(c, -s * .29, -s * .22, s * .58, s * .48, s * .07); c.fill();
      /* the lid, a shade lighter, with a seam under it */
      c.fillStyle = '#93B2D8';
      rr(c, -s * .29, -s * .22, s * .58, s * .16, s * .07); c.fill();
      c.fillStyle = rgba('#22354D', .35);
      c.fillRect(-s * .29, -s * .075, s * .58, s * .015);
      /* three holes, each with a rim of shadow so it has depth */
      const holes = [[-.15, .04], [.14, .04], [0, .17]];
      holes.forEach(h => {
        c.fillStyle = rgba('#16283D', .78);
        ellipse(c, h[0] * s, h[1] * s, s * .082, s * .075); c.fill();
        c.strokeStyle = rgba('#FFFFFF', .16); c.lineWidth = s * .016;
        ellipse(c, h[0] * s, h[1] * s - s * .008, s * .078, s * .068); c.stroke();
      });
      /* one biscuit still in there */
      c.save();
      ellipse(c, -.15 * s, .04 * s, s * .082, s * .075); c.clip();
      c.fillStyle = '#D9A057';
      rr(c, -.20 * s, .0 * s, s * .09, s * .075, s * .015); c.fill();
      c.fillStyle = rgba('#8A5C2A', .5);
      rr(c, -.135 * s, .045 * s, s * .06, s * .05, s * .012); c.fill();
      c.restore();
      /* light along the top edge */
      c.strokeStyle = rgba('#FFFFFF', .3); c.lineWidth = s * .018;
      c.beginPath();
      c.moveTo(-s * .24, -s * .205); c.lineTo(s * .18, -s * .205);
      c.stroke();
      break;
    }
  }
  c.restore();
}

/* ---------------- logo ---------------- */
/* The mark.

   It was a dark muzzle and two small dark ears on an orange tile, and at
   the size an icon is actually seen — 48px in a launcher, less in a
   store grid — dark-on-orange has almost no contrast, so all three
   shapes collapsed into one brown blob with two dots in it. The idea
   underneath was right and worth keeping: one head wearing a cat's ear
   and a dog's, because that is the whole game in one shape.

   So the same idea, drawn to survive being small. The head is cream on
   the warm ground rather than the other way round, which is the single
   biggest gain. The two ears are large and different in silhouette — a
   pricked triangle against a hanging lobe — so the joke is legible
   rather than implied. And the eyes are big and dark, because at 48px
   the eyes are the only feature that still reads.

   Checked at 512, 180, 96, 48 and 32 before it was kept. */
/* ---------------- the brand mark ----------------

   The game is called Pawtika and its mark is a drawing, so the mark is a
   picture — 02-logo.js, generated by tools/icon.js from the same file
   every store icon is cut from. Loading starts the moment this file is
   read; the source is a data URI already inside the page, so it is
   decoded within a frame or two of boot and never touches the network.

   The paw below it is still here and is still drawn. It is the fallback
   for the frames before the picture has decoded, and for the one context
   where there is no Image at all — the headless harness in test/, which
   renders logos without a document. A blank top bar for two frames is a
   worse bug than a mark that changes once. */
const LOGO_IMG = (function () {
  if (typeof Image === 'undefined' || typeof LOGO_SRC !== 'string') return null;
  const im = new Image();
  im.src = LOGO_SRC;
  return im;
})();
function logoReady() {
  return !!(LOGO_IMG && LOGO_IMG.complete && LOGO_IMG.naturalWidth);
}
function drawLogo(c, s) {
  if (logoReady()) { c.drawImage(LOGO_IMG, 0, 0, s, s); return; }
  drawLogoPaw(c, s);
}

/* The mark this game had for its whole first life: a cat and a dog
   sharing a tile, drawn in paths. Kept whole rather than deleted — it is
   what shows while the picture decodes, and it is the only version of
   the mark that is sharp at any size. */
function drawLogoPaw(c, s) {
  c.save();
  c.translate(s / 2, s / 2);

  /* the tile */
  const g = c.createLinearGradient(0, -s * .5, 0, s * .5);
  g.addColorStop(0, mix(PAL.accent, '#FFFFFF', .12));
  g.addColorStop(1, mix(PAL.accent, PAL.rose, .42));
  c.fillStyle = g;
  squircle(c, -s * .46, -s * .46, s * .92, s * .92, 4.2); c.fill();
  c.strokeStyle = rgba('#FFFFFF', .3); c.lineWidth = s * .045;
  squircle(c, -s * .44, -s * .44, s * .88, s * .88, 4.2); c.stroke();

  const fur = '#FBEBD2';
  const ear = '#EBD3B0';        /* a shade back, so an ear is not the head */
  /* the hanging ear reaches further right than the pricked one does
     left, so the animal is nudged over to sit on the tile's centre */
  c.translate(-s * .022, 0);

  /* Ears first and darker, with the head laid over them: an ear that is
     the same colour as the skull it is attached to has no edge, and the
     first draft lost the dog's entirely. */
  c.fillStyle = ear;

  /* the cat's, pricked, left — a short wide triangle rather than a spike */
  c.beginPath();
  c.moveTo(-s * .265, -s * .04);
  c.lineTo(-s * .245, -s * .33);
  c.lineTo(-s * .025, -s * .155);
  c.closePath(); c.fill();

  /* the dog's, hanging clear of the head on the right */
  c.beginPath();
  c.moveTo(s * .10, -s * .17);
  c.bezierCurveTo(s * .32, -s * .25, s * .40, s * .02, s * .31, s * .17);
  c.bezierCurveTo(s * .24, s * .25, s * .13, s * .11, s * .10, -s * .17);
  c.closePath(); c.fill();

  /* the head */
  c.fillStyle = fur;
  ellipse(c, 0, s * .04, s * .275, s * .265); c.fill();

  /* eyes: the only feature that survives 32px */
  c.fillStyle = '#3A2A18';
  ellipse(c, -s * .105, s * .0, s * .058, s * .068); c.fill();
  ellipse(c, s * .105, s * .0, s * .058, s * .068); c.fill();
  c.fillStyle = rgba('#FFFFFF', .92);
  ellipse(c, -s * .086, -s * .024, s * .021, s * .025); c.fill();
  ellipse(c, s * .124, -s * .024, s * .021, s * .025); c.fill();

  /* and a nose, small enough to be a detail rather than a third eye */
  c.fillStyle = '#C87A5A';
  c.beginPath();
  c.moveTo(-s * .032, s * .115); c.lineTo(s * .032, s * .115);
  c.quadraticCurveTo(0, s * .175, -s * .032, s * .115);
  c.closePath(); c.fill();

  c.restore();
}

