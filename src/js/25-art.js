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

function drawEars(c, spec, s, back, o) {
  const b = spec.breed, fur = spec.fur, fur2 = spec.fur2, inner = spec.inner || '#E8A0A8';
  const k = b.ear;
  if (back && (k === 'droop' || k === 'flop' || k === 'button')) return;   // drawn in front
  if (!back && !(k === 'droop' || k === 'flop' || k === 'button')) return;

  const pose = EAR_POSE[(o && o.mood) || 'content'] || EAR_POSE.content;
  const ear = (sx) => {
    c.save(); c.scale(sx, 1);
    /* turn about where the ear leaves the skull, not about the face,
       or a tired ear slides off the head instead of folding down */
    if (pose.rot || pose.droop || pose.out) {
      c.translate(.22 * s + pose.out * s, -.26 * s);
      c.rotate(pose.rot);
      c.scale(1, 1 - pose.droop);
      c.translate(-.22 * s, .26 * s);
    }
    if (k === 'triangle') {
      /* Set wide on the skull and leaning out, about a third of the
         head tall. The old pair were small tabs perched on the crown. */
      c.fillStyle = fur;
      c.beginPath();
      c.moveTo(.08 * s, -.28 * s);
      c.quadraticCurveTo(.23 * s, -.82 * s, .49 * s, -.32 * s);
      c.quadraticCurveTo(.33 * s, -.14 * s, .08 * s, -.28 * s);
      c.fill();
      /* the inside of an ear is a cone: dark where it meets the skull,
         catching light toward the tip. Flat colour made it a sticker. */
      const ig1 = c.createLinearGradient(.20 * s, -.24 * s, .34 * s, -.62 * s);
      ig1.addColorStop(0, shade(inner, -.30));
      ig1.addColorStop(.55, inner);
      ig1.addColorStop(1, shade(inner, .22));
      c.fillStyle = ig1;
      c.beginPath();
      c.moveTo(.16 * s, -.30 * s);
      c.quadraticCurveTo(.26 * s, -.66 * s, .41 * s, -.33 * s);
      c.quadraticCurveTo(.29 * s, -.21 * s, .16 * s, -.30 * s);
      c.fill();
    } else if (k === 'tall') {
      c.fillStyle = spec.point || fur2;
      c.beginPath();
      c.moveTo(.12 * s, -.30 * s);
      c.quadraticCurveTo(.30 * s, -.88 * s, .50 * s, -.30 * s);
      c.quadraticCurveTo(.32 * s, -.18 * s, .12 * s, -.30 * s);
      c.fill();
      c.fillStyle = rgba('#000000', .12);
      c.beginPath();
      c.moveTo(.21 * s, -.31 * s);
      c.quadraticCurveTo(.31 * s, -.68 * s, .42 * s, -.31 * s);
      c.quadraticCurveTo(.31 * s, -.24 * s, .21 * s, -.31 * s);
      c.fill();
    } else if (k === 'round') {
      /* Round-eared, still a cat: a broad triangle with a soft tip.
         Two circles on a circle is a bear, which is what this was. */
      c.fillStyle = fur;
      c.beginPath();
      c.moveTo(.09 * s, -.27 * s);
      c.quadraticCurveTo(.20 * s, -.74 * s, .46 * s, -.35 * s);
      c.quadraticCurveTo(.32 * s, -.15 * s, .09 * s, -.27 * s);
      c.fill();
      const ig2 = c.createLinearGradient(.20 * s, -.24 * s, .32 * s, -.58 * s);
      ig2.addColorStop(0, shade(inner, -.30));
      ig2.addColorStop(.55, inner);
      ig2.addColorStop(1, shade(inner, .22));
      c.fillStyle = ig2;
      c.beginPath();
      c.moveTo(.17 * s, -.29 * s);
      c.quadraticCurveTo(.24 * s, -.60 * s, .39 * s, -.35 * s);
      c.quadraticCurveTo(.29 * s, -.21 * s, .17 * s, -.29 * s);
      c.fill();
    } else if (k === 'droop') {
      c.fillStyle = fur2;
      c.beginPath();
      c.moveTo(.28 * s, -.26 * s);
      c.quadraticCurveTo(.62 * s, -.20 * s, .58 * s, .22 * s);
      c.quadraticCurveTo(.52 * s, .48 * s, .34 * s, .38 * s);
      c.quadraticCurveTo(.30 * s, .08 * s, .28 * s, -.26 * s);
      c.fill();
      c.fillStyle = rgba('#000000', .13);
      c.beginPath();
      c.moveTo(.30 * s, -.20 * s);
      c.quadraticCurveTo(.50 * s, -.10 * s, .47 * s, .18 * s);
      c.quadraticCurveTo(.43 * s, .34 * s, .35 * s, .30 * s);
      c.fill();
    } else if (k === 'flop') {
      c.fillStyle = fur2;
      c.beginPath();
      c.moveTo(.24 * s, -.30 * s);
      c.quadraticCurveTo(.58 * s, -.34 * s, .54 * s, .06 * s);
      c.quadraticCurveTo(.50 * s, .30 * s, .30 * s, .24 * s);
      c.quadraticCurveTo(.26 * s, -.02 * s, .24 * s, -.30 * s);
      c.fill();
      c.fillStyle = rgba('#FFFFFF', .12);
      c.beginPath();
      c.moveTo(.30 * s, -.24 * s);
      c.quadraticCurveTo(.48 * s, -.22 * s, .45 * s, .04 * s);
      c.quadraticCurveTo(.42 * s, .18 * s, .34 * s, .14 * s);
      c.fill();
    } else if (k === 'button') {
      c.fillStyle = fur2;
      c.beginPath();
      c.moveTo(.16 * s, -.36 * s);
      c.quadraticCurveTo(.46 * s, -.48 * s, .44 * s, -.16 * s);
      c.quadraticCurveTo(.32 * s, -.06 * s, .18 * s, -.20 * s);
      c.closePath();
      c.fill();
      c.fillStyle = rgba('#000000', .16);
      c.beginPath();
      c.moveTo(.21 * s, -.31 * s);
      c.quadraticCurveTo(.39 * s, -.36 * s, .38 * s, -.18 * s);
      c.quadraticCurveTo(.29 * s, -.13 * s, .22 * s, -.21 * s);
      c.fill();
    }
    c.restore();
  };
  ear(1); ear(-1);
}

/* ---------------- head ---------------- */
function headPath(c, spec, s) {
  const f = spec.breed.face;
  c.beginPath();
  if (f === 'flat') {
    c.moveTo(-.44 * s, -.06 * s);
    c.bezierCurveTo(-.46 * s, -.36 * s, -.26 * s, -.46 * s, 0, -.46 * s);
    c.bezierCurveTo(.26 * s, -.46 * s, .46 * s, -.36 * s, .44 * s, -.06 * s);
    c.bezierCurveTo(.43 * s, .26 * s, .26 * s, .42 * s, 0, .42 * s);
    c.bezierCurveTo(-.26 * s, .42 * s, -.43 * s, .26 * s, -.44 * s, -.06 * s);
  } else if (f === 'dog') {
    c.moveTo(-.40 * s, -.04 * s);
    c.bezierCurveTo(-.42 * s, -.34 * s, -.24 * s, -.44 * s, 0, -.44 * s);
    c.bezierCurveTo(.24 * s, -.44 * s, .42 * s, -.34 * s, .40 * s, -.04 * s);
    c.bezierCurveTo(.39 * s, .20 * s, .24 * s, .44 * s, 0, .44 * s);
    c.bezierCurveTo(-.24 * s, .44 * s, -.39 * s, .20 * s, -.40 * s, -.04 * s);
  } else {
    /* A cat's head is a wedge, not a ball: the skull is moderate, the
       cheeks are the widest part, and it tapers to a small chin. Drawn
       as a circle with ears on top — which is what this was — it reads
       as a bear, and the Sable read as one most of all. */
    c.moveTo(-.43 * s, .02 * s);
    c.bezierCurveTo(-.44 * s, -.26 * s, -.24 * s, -.42 * s, 0, -.42 * s);
    c.bezierCurveTo(.24 * s, -.42 * s, .44 * s, -.26 * s, .43 * s, .02 * s);
    c.bezierCurveTo(.42 * s, .22 * s, .26 * s, .36 * s, .11 * s, .42 * s);
    c.bezierCurveTo(.04 * s, .45 * s, -.04 * s, .45 * s, -.11 * s, .42 * s);
    c.bezierCurveTo(-.26 * s, .36 * s, -.42 * s, .22 * s, -.43 * s, .02 * s);
  }
  c.closePath();
}

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

function drawMarkings(c, spec, s) {
  const b = spec.breed;
  c.save();
  headPath(c, spec, s); c.clip();
  if (b.mark === 'tabby') {
    c.fillStyle = rgba(spec.fur2, .58);
    /* the forehead's M, fanning out from the brow rather than three
       parallel scratches */
    taperMark(c, -.05 * s, -.22 * s, -.13 * s, -.34 * s, -.17 * s, -.44 * s, s * .052, s * .012);
    c.fill();
    taperMark(c, 0, -.24 * s, 0, -.36 * s, 0, -.47 * s, s * .050, s * .011);
    c.fill();
    taperMark(c, .05 * s, -.22 * s, .13 * s, -.34 * s, .17 * s, -.44 * s, s * .052, s * .012);
    c.fill();
    /* cheek bars, curving back with the cheek */
    c.fillStyle = rgba(spec.fur2, .46);
    [-1, 1].forEach(sx => {
      taperMark(c, sx * .25 * s, -.13 * s, sx * .36 * s, -.14 * s, sx * .44 * s, -.09 * s, s * .046, s * .014);
      c.fill();
      taperMark(c, sx * .27 * s, .01 * s, sx * .37 * s, .02 * s, sx * .44 * s, .06 * s, s * .042, s * .013);
      c.fill();
    });
  } else if (b.mark === 'patch') {
    c.fillStyle = rgba(spec.fur2, .9);
    ellipse(c, -.20 * s, -.16 * s, .19 * s, .16 * s, -.2); c.fill();
    c.fillStyle = rgba(spec.belly, .95);
    c.beginPath();
    c.moveTo(0, -.46 * s); c.quadraticCurveTo(.07 * s, -.14 * s, 0, .14 * s);
    c.quadraticCurveTo(-.07 * s, -.14 * s, 0, -.46 * s); c.fill();
  } else if (b.mark === 'points') {
    /* the points sit on the muzzle, which moved down with the features;
       left where it was the mask covered the eyes instead of the nose */
    const gr = c.createRadialGradient(0, .32 * s, .05 * s, 0, .32 * s, .34 * s);
    gr.addColorStop(0, rgba(spec.fur2, .92));
    gr.addColorStop(.62, rgba(spec.fur2, .42));
    gr.addColorStop(1, rgba(spec.fur2, 0));
    c.fillStyle = gr;
    ellipse(c, 0, .30 * s, .34 * s, .28 * s); c.fill();
  } else if (b.mark === 'mask') {
    const gr = c.createRadialGradient(0, .26 * s, .04 * s, 0, .26 * s, .36 * s);
    gr.addColorStop(0, rgba(spec.fur2, .95));
    gr.addColorStop(.55, rgba(spec.fur2, .78));
    gr.addColorStop(1, rgba(spec.fur2, 0));
    c.fillStyle = gr;
    ellipse(c, 0, .24 * s, .32 * s, .28 * s); c.fill();
    c.strokeStyle = rgba(spec.fur2, .5); c.lineWidth = s * .035; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-.17 * s, -.24 * s); c.quadraticCurveTo(0, -.34 * s, .17 * s, -.24 * s);
    c.moveTo(-.13 * s, -.15 * s); c.quadraticCurveTo(0, -.24 * s, .13 * s, -.15 * s);
    c.stroke();
  }
  c.restore();
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
  marmalade: { r: .156, x: .190, y: .045, tilt: -.09, almond: true, lid: .34, brow: 0 },
  beagle: { r: .158, x: .186, y: .030, tilt: .06, almond: false, lid: .20, brow: .8 },
  void: { r: .164, x: .194, y: .040, tilt: 0, almond: false, lid: .10, brow: 0 },
  retriever: { r: .154, x: .182, y: .022, tilt: .05, almond: false, lid: .34, brow: 0 },
  siamese: { r: .154, x: .188, y: .046, tilt: -.16, almond: true, lid: .28, brow: 0 },
  pug: { r: .170, x: .198, y: .012, tilt: 0, almond: false, lid: .06, brow: .7 }
};
function lookOf(spec) { return FACE_LOOK[spec.breed.id] || FACE_LOOK.marmalade; }

function eyePath(c, rx, ry, almond) {
  if (!almond) { ellipse(c, 0, 0, rx, ry); return; }
  c.beginPath();
  c.moveTo(-rx, ry * .12);
  c.bezierCurveTo(-rx * .5, -ry * 1.28, rx * .5, -ry * 1.18, rx, -ry * .16);
  c.bezierCurveTo(rx * .5, ry * 1.12, -rx * .5, ry * 1.18, -rx, ry * .12);
  c.closePath();
}

function drawEye(c, x, y, r, spec, o, side) {
  const look = lookOf(spec);
  const blink = o.blink || 0;
  /* The iris is .84 of the eye and the eye is clipped, so travel past
     the rim is not a mistake — it is how a real eye reads when it looks
     hard at something. At .22 the pupil barely left centre and the pet
     appeared to stare through you whatever it was looking at; the gaze
     only became worth wiring to a finger once it could be seen. */
  const dx = (o.eyeDir ? o.eyeDir[0] : 0) * r * .30;
  const dy = (o.eyeDir ? o.eyeDir[1] : 0) * r * .30;
  const dk = darkCoat(spec);
  const rx = r, ry = r * 1.06 * (1 - blink * .92);

  c.save();
  c.translate(x, y);
  c.rotate(look.tilt * (side || 1));

  if (blink > .82) {
    c.strokeStyle = rgba(featureInk(spec), .82);
    c.lineWidth = r * .26; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-rx * .8, 0);
    c.quadraticCurveTo(0, r * .3, rx * .8, 0);
    c.stroke();
    c.restore();
    return;
  }

  c.save();
  eyePath(c, rx, ry, look.almond); c.clip();
  c.fillStyle = dk ? '#312B36' : '#1E1A22';
  eyePath(c, rx, ry, look.almond); c.fill();

  /* iris — lifted on a dark coat so it parts from both fur and pupil */
  /* A brown-eyed dog has an iris near black, and against a pupil that
     is now half the eye it merges into one hole — the Pug went from
     eyes to voids. Anything this dark gets lifted until there is an
     iris to see. */
  let iris = dk ? shade(spec.eyes, .34) : spec.eyes;
  const irgb = hex2rgb(iris);
  const ilum = (irgb[0] * .299 + irgb[1] * .587 + irgb[2] * .114) / 255;
  if (ilum < .30) iris = shade(iris, .30 + (.30 - ilum) * 1.5);
  const ig = c.createRadialGradient(dx, dy - ry * .2, rx * .1, dx, dy, rx * .95);
  ig.addColorStop(0, shade(iris, .34));
  ig.addColorStop(.62, iris);
  ig.addColorStop(1, shade(iris, -.34));
  c.fillStyle = ig;
  ellipse(c, dx, dy, rx * .84, ry * .86); c.fill();
  /* An eye is a wet ball under a lid, and two things say so: the lid
     drops a shadow across the top of the iris, and light bounces back
     off the bottom of it. Without them the iris is a flat disc, which
     is what these were — a green circle with a black dot on it. */
  const shadeTop = c.createLinearGradient(0, dy - ry * .9, 0, dy + ry * .15);
  shadeTop.addColorStop(0, rgba('#100C16', .55));
  shadeTop.addColorStop(1, rgba('#100C16', 0));
  c.fillStyle = shadeTop;
  ellipse(c, dx, dy, rx * .84, ry * .86); c.fill();
  const bounce = c.createLinearGradient(0, dy + ry * .25, 0, dy + ry * .9);
  bounce.addColorStop(0, rgba(shade(iris, .55), 0));
  bounce.addColorStop(1, rgba(shade(iris, .55), .75));
  c.fillStyle = bounce;
  ellipse(c, dx, dy, rx * .84, ry * .86); c.fill();

  /* pupil — a slit for cats, round for dogs */
  /* A thin slit is an alert predator. Cute is a big soft pupil that
     fills the eye — every cat anyone has ever put on a T-shirt has one.
     The cat keeps a taller-than-wide shape so it is still a cat's eye,
     but it is wide enough to read as pupil rather than as a knife. */
  /* A pupil is not a fixed hole. It opens when an animal is pleased or
     wants something and closes when it is bored or half asleep, and it
     is the cheapest expression in the whole face — nothing else here
     moves and the pet still looks like it is feeling something. */
  const dil = PUPIL_DILATE[(o && o.mood) || 'content'] || 1;
  c.fillStyle = '#17141B';
  if (spec.breed.species === 'cat') ellipse(c, dx, dy, rx * .50 * dil, ry * .70 * dil);
  else ellipse(c, dx, dy, rx * .54 * dil, ry * .56 * dil);
  c.fill();

  /* the lid: what stops an eye looking like a bead */
  if (look.lid > .02) {
    /* a shadow, not a swatch of coat: at half-opaque fur colour this
       read as a brown smear sitting on the eye */
    c.fillStyle = rgba('#1A1420', .30 * look.lid + .12);
    c.beginPath();
    c.moveTo(-rx * 1.1, -ry * 1.1);
    c.lineTo(rx * 1.1, -ry * 1.1);
    c.lineTo(rx * 1.1, -ry * (1 - look.lid * .78));
    c.quadraticCurveTo(0, -ry * (1 - look.lid * .78) + ry * .5, -rx * 1.1, -ry * (1 - look.lid * .78));
    c.closePath();
    c.fill();
  }

  /* highlights */
  /* A hard white ellipse is a sticker. A reflection has a core and a
     falloff, and a second, smaller one opposite it. */
  const hx = -rx * .34 + dx, hy = -ry * .40 + dy, hr = rx * .34;
  const hg = c.createRadialGradient(hx, hy, hr * .12, hx, hy, hr);
  hg.addColorStop(0, rgba('#FFFFFF', .95));
  hg.addColorStop(.55, rgba('#FFFFFF', .62));
  hg.addColorStop(1, rgba('#FFFFFF', 0));
  c.fillStyle = hg;
  ellipse(c, hx, hy, hr, hr * .92); c.fill();
  c.fillStyle = rgba('#FFFFFF', .40);
  ellipse(c, rx * .30 + dx, ry * .34 + dy, rx * .10, ry * .09); c.fill();
  c.restore();

  /* the rim of the eye */
  c.strokeStyle = dk ? rgba('#FFFFFF', .20) : rgba('#2A2118', .22);
  c.lineWidth = r * .038;
  eyePath(c, rx, ry, look.almond); c.stroke();
  c.restore();
}

/* the pale spots above a beagle's or a pug's eyes */
function drawBrows(c, spec, s) {
  const look = lookOf(spec);
  if (!look.brow) return;
  const w = s * .075 * look.brow, h = s * .05 * look.brow;
  c.fillStyle = rgba(mix(spec.belly, spec.fur, .25), .8);
  [-1, 1].forEach(sx => {
    ellipse(c, sx * look.x * s, (look.y - .105) * s, w, h, sx * .2);
    c.fill();
  });
}

function drawNoseMouth(c, spec, s, o) {
  const f = spec.breed.face, cat = spec.breed.species === 'cat';
  /* under the eyes, not beside them: with the eyes doubled the muzzle
     has to drop or the face has no forehead and no chin, just features */
  const ny = f === 'dog' ? .30 * s : f === 'flat' ? .26 * s : .27 * s;
  const nw = f === 'dog' ? .075 * s : f === 'flat' ? .095 * s : .064 * s;

  /* muzzle patch */
  if (f !== 'cat' || spec.breed.mark === 'points') {
    c.fillStyle = rgba(spec.belly, f === 'flat' ? .35 : .8);
    ellipse(c, 0, ny + .04 * s, nw * 2.5, nw * 1.9); c.fill();
  }
  /* A cat has two whisker pads with the nose sitting in the notch
     between them. Cats were the one face that got no muzzle at all —
     the test above excludes them — so the nose floated on a flat plane
     and the whiskers came out of nowhere. That, more than anything
     else, is what stopped them reading as cats.

     Lightened fur rather than the belly colour, because a dark coat's
     belly is dark too and the pads have to catch light on Sable. */
  if (cat) {
    const pw = nw * 1.95, ph = nw * 1.45, py = ny + nw * .95;
    c.save();
    c.fillStyle = rgba('#000000', .07);
    ellipse(c, 0, py + nw * .30, pw * 1.9, ph * 1.15); c.fill();
    /* a dark coat needs a gentler lift or the pads become a pale mask */
    c.fillStyle = rgba(mix(spec.fur, '#FFFFFF', darkCoat(spec) ? .16 : .30),
      darkCoat(spec) ? .55 : .85);
    ellipse(c, -pw * .60, py, pw, ph); c.fill();
    ellipse(c, pw * .60, py, pw, ph); c.fill();
    c.restore();
  }
  /* nose */
  const noseBase = cat ? (spec.nose || '#E08A96')
    : darkCoat(spec) ? mix('#33292A', '#B6A79E', .6) : '#33292A';
  /* a nose is a small wet wedge, not a flat swatch */
  const ng = c.createLinearGradient(0, ny - nw, 0, ny + nw);
  ng.addColorStop(0, shade(noseBase, .26));
  ng.addColorStop(.6, noseBase);
  ng.addColorStop(1, shade(noseBase, -.24));
  c.fillStyle = ng;
  c.beginPath();
  c.moveTo(-nw, ny - nw * .5);
  c.quadraticCurveTo(0, ny - nw * .85, nw, ny - nw * .5);
  c.quadraticCurveTo(nw * .75, ny + nw * .75, 0, ny + nw * .95);
  c.quadraticCurveTo(-nw * .75, ny + nw * .75, -nw, ny - nw * .5);
  c.fill();
  const nhx = -nw * .28, nhy = ny - nw * .30;
  const nh = c.createRadialGradient(nhx, nhy, nw * .04, nhx, nhy, nw * .38);
  nh.addColorStop(0, rgba('#FFFFFF', .62));
  nh.addColorStop(1, rgba('#FFFFFF', 0));
  c.fillStyle = nh;
  ellipse(c, nhx, nhy, nw * .38, nw * .26, -.3); c.fill();

  /* mouth */
  /* the smile was s*.034 at .7 — a thick dark squiggle against a face
     whose other lines are half that. */
  c.strokeStyle = rgba(featureInk(spec), darkCoat(spec) ? .42 : .52);
  c.lineWidth = s * .024; c.lineCap = 'round';
  const my = ny + nw * .95;
  if (o.mouth === 'open') {
    c.fillStyle = '#8C3B4A';
    c.beginPath();
    c.moveTo(-nw * 1.5, my);
    c.quadraticCurveTo(0, my + nw * 2.4, nw * 1.5, my);
    c.quadraticCurveTo(0, my + nw * .4, -nw * 1.5, my);
    c.fill();
    c.fillStyle = '#E4808F';
    c.beginPath();
    c.moveTo(-nw * .8, my + nw * .9);
    c.quadraticCurveTo(0, my + nw * 2.5, nw * .8, my + nw * .9);
    c.quadraticCurveTo(0, my + nw * 1.1, -nw * .8, my + nw * .9);
    c.fill();
  } else {
    c.beginPath();
    c.moveTo(0, my - s * .01);
    c.quadraticCurveTo(-nw * .8, my + nw * .95, -nw * 1.7, my + nw * .1);
    c.moveTo(0, my - s * .01);
    c.quadraticCurveTo(nw * .8, my + nw * .95, nw * 1.7, my + nw * .1);
    c.stroke();
    if (spec.breed.tongue && o.tongue !== false) {
      c.fillStyle = '#E4808F';
      c.beginPath();
      c.moveTo(-nw * .55, my + nw * .5);
      c.quadraticCurveTo(-nw * .7, my + nw * 2.3, 0, my + nw * 2.3);
      c.quadraticCurveTo(nw * .7, my + nw * 2.3, nw * .55, my + nw * .5);
      c.closePath(); c.fill();
      c.strokeStyle = rgba('#B85B6B', .6); c.lineWidth = s * .018;
      c.beginPath(); c.moveTo(0, my + nw * .9); c.lineTo(0, my + nw * 2); c.stroke();
    }
  }
  /* whiskers */
  if (cat) {
    /* A whisker is thick at the pad and comes to a point, and it droops.
       Stroked at an even width these were three grey wires the length of
       the head — the most machine-looking thing on the face. */
    const wc = PAL.dark ? '#FFFFFF' : '#3A2E22';
    [-1, 1].forEach(sx => {
      c.save(); c.scale(sx, 1);
      c.fillStyle = rgba(wc, .30);
      taperMark(c, .16 * s, ny + .02 * s, .31 * s, ny - .07 * s, .45 * s, ny - .12 * s, s * .020, s * .002);
      c.fill();
      c.fillStyle = rgba(wc, .26);
      taperMark(c, .15 * s, ny + .07 * s, .31 * s, ny + .05 * s, .46 * s, ny + .04 * s, s * .019, s * .002);
      c.fill();
      c.fillStyle = rgba(wc, .20);
      taperMark(c, .14 * s, ny + .10 * s, .29 * s, ny + .15 * s, .41 * s, ny + .19 * s, s * .016, s * .002);
      c.fill();
      c.restore();
    });
  }
}

/* Colour in the cheeks, by how it feels. A flat blush on a miserable
   animal is the same mistake as a fixed ear: the face wearing an
   expression it does not have. */
const BLUSH_BY_MOOD = {
  happy: 1.35, content: 1, hungry: .85, lonely: .55,
  dirty: .55, bored: .5, tired: .4, sleeping: .7
};
function drawBlush(c, spec, s, o) {
  const k = BLUSH_BY_MOOD[(o && o.mood) || 'content'];
  const a = (PAL.dark ? .26 : .3) * (k === undefined ? 1 : k);
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

function drawFace(c, spec, s, o) {
  o = o || {};
  c.save();
  if (o.squash) c.scale(1 + o.squash, 1 - o.squash);
  drawEars(c, spec, s, true, o);
  /* head */
  const gr = c.createLinearGradient(0, -.45 * s, 0, .45 * s);
  gr.addColorStop(0, shade(spec.fur, .13));
  gr.addColorStop(.55, spec.fur);
  gr.addColorStop(1, shade(spec.fur, -.1));
  c.fillStyle = gr;
  headPath(c, spec, s); c.fill();
  drawMarkings(c, spec, s);
  /* Form. The head was filled with one linear gradient running top to
     bottom, which is a flat disc with a lighter half — a balloon. A key
     light from the upper left and an occlusion under the jaw give it a
     front and a back, and the markings sit under both because pigment
     is under light, not over it. */
  c.save();
  headPath(c, spec, s); c.clip();
  const key = c.createRadialGradient(-.16 * s, -.24 * s, s * .04, -.10 * s, -.14 * s, s * .74);
  key.addColorStop(0, rgba('#FFFFFF', .30));
  key.addColorStop(.5, rgba('#FFFFFF', .10));
  key.addColorStop(1, rgba('#FFFFFF', 0));
  c.fillStyle = key;
  headPath(c, spec, s); c.fill();
  const jaw = c.createLinearGradient(0, .06 * s, 0, .46 * s);
  jaw.addColorStop(0, rgba('#2A1E12', 0));
  jaw.addColorStop(1, rgba('#2A1E12', .20));
  c.fillStyle = jaw;
  headPath(c, spec, s); c.fill();
  c.restore();
  /* rim light */
  c.save();
  headPath(c, spec, s); c.clip();
  c.strokeStyle = rgba('#FFFFFF', .28); c.lineWidth = s * .07;
  headPath(c, spec, s * .995); c.stroke();
  c.restore();

  /* fur along the jaw, so the head has an edge made of hair rather than
     a bezier. The body already had this; the head was a smooth outline. */
  c.save();
  headPath(c, spec, s); c.clip();
  furEdge(c, 0, .02 * s, .43 * s, .43 * s, Math.PI * .18, Math.PI * .82, 11, s * .030,
    rgba(shade(spec.fur, -.12), .5));
  furEdge(c, 0, .02 * s, .43 * s, .43 * s, Math.PI * 1.16, Math.PI * 1.84, 9, s * .026,
    rgba(shade(spec.fur, .16), .45));
  c.restore();

  drawBlush(c, spec, s, o);
  const look = lookOf(spec);
  drawBrows(c, spec, s);
  drawEye(c, -look.x * s, look.y * s, look.r * s, spec, o, -1);
  drawEye(c, look.x * s, look.y * s, look.r * s, spec, o, 1);
  drawNoseMouth(c, spec, s, o);
  drawEars(c, spec, s, false, o);
  if (spec.hat) drawHat(c, spec.hat, spec, s);
  c.restore();
}

/* ---------------- full body (sitting) ---------------- */
/* A tapered tail: a polygon swept along a curve, so it thins to a
   point the way fur does instead of ending in a round cap. */
function tailPath(c, s, pts, w0, w1) {
  const N = 18;
  const left = [], right = [];
  const at = t => {
    /* quadratic through p0, p1, p2 */
    const u = 1 - t;
    return [
      u * u * pts[0][0] + 2 * u * t * pts[1][0] + t * t * pts[2][0],
      u * u * pts[0][1] + 2 * u * t * pts[1][1] + t * t * pts[2][1]
    ];
  };
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [x, y] = at(t);
    const [x2, y2] = at(Math.min(1, t + .02));
    const dx = x2 - x, dy = y2 - y;
    const L = Math.hypot(dx, dy) || 1;
    const w = lerp(w0, w1, t * t) * s * .5;
    left.push([x - dy / L * w, y + dx / L * w]);
    right.push([x + dy / L * w, y - dx / L * w]);
  }
  c.beginPath();
  left.forEach((pt, i) => i ? c.lineTo(pt[0], pt[1]) : c.moveTo(pt[0], pt[1]));
  for (let i = right.length - 1; i >= 0; i--) c.lineTo(right[i][0], right[i][1]);
  c.closePath();
}

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

/* ---------------- full body (sitting) ----------------
   Origin sits at the head. The body reaches about .94s below it,
   which is what the room and the board rely on for placement.   */
function drawBody(c, spec, s, o) {
  o = o || {};
  const breath = o.breath || 0;
  const tailA = o.tail || 0;
  const cat = spec.breed.species === 'cat';
  const lift = breath * .012 * s;
  /* spec.build lets the stage-up animation pass a half-way build */
  const gb = spec.build || STAGE_BUILD[clamp(spec.stage || 0, 0, STAGE_BUILD.length - 1)];
  /* the head has to come down by however much the squash lowered the
     shoulders, or it floats off the neck */
  const drop = (1 - gb.sy) * .60 * s;

  c.save();
  /* grow about the floor line so the feet stay where they were */
  if (gb.k !== 1) {
    c.translate(0, .93 * s); c.scale(gb.k, gb.k); c.translate(0, -.93 * s);
  }

  /* ---- contact shadow ---- */
  if (o.shadow !== false) {
    const sg = c.createRadialGradient(0, .93 * s, s * .04, 0, .93 * s, s * .55);
    sg.addColorStop(0, rgba('#2A1E12', PAL.dark ? .38 : .22));
    sg.addColorStop(1, rgba('#2A1E12', 0));
    c.fillStyle = sg;
    ellipse(c, 0, .93 * s, .55 * s, .12 * s); c.fill();
  }

  /* everything below the neck is squat on a young animal; the head is
     drawn after this closes, at its true proportions */
  c.save();
  if (gb.sy !== 1 || gb.sx !== 1) {
    c.translate(0, .90 * s); c.scale(gb.sx, gb.sy); c.translate(0, -.90 * s);
  }

  /* ---- tail, behind everything ---- */
  c.save();
  /* one definition, used for the fill and again as the clip, so the
     highlight can never end up outside the tail it belongs to */
  const tailPts = cat ? [
    [.24 * s, .84 * s],
    [.74 * s + tailA * .12 * s, .86 * s],
    [.72 * s + tailA * .22 * s, .30 * s - tailA * .12 * s]
  ] : [
    [.24 * s, .82 * s],
    [.62 * s + tailA * .16 * s, .82 * s],
    [.60 * s + tailA * .26 * s, .42 * s]
  ];
  const tailW = cat ? [.17, .045] : [.15, .05];
  const tailShape = () => tailPath(c, s, tailPts, tailW[0], tailW[1]);

  const tg = c.createLinearGradient(0, .4 * s, .8 * s, .9 * s);
  tg.addColorStop(0, shade(spec.fur2, -.06));
  tg.addColorStop(1, shade(spec.fur2, .12));
  c.fillStyle = tg;
  tailShape();
  c.fill();

  /* the same key light as the head, running along the top of the tail */
  c.save();
  tailShape();
  c.clip();
  c.fillStyle = rgba(spec.belly, cat ? .35 : .26);
  tailPath(c, s, [
    [lerp(tailPts[0][0], tailPts[1][0], .55), lerp(tailPts[0][1], tailPts[1][1], .5) - s * .06],
    [tailPts[1][0], tailPts[1][1] - s * .10],
    [tailPts[2][0], tailPts[2][1]]
  ], tailW[0] * .55, tailW[1] * .9);
  c.fill();
  c.restore();
  c.restore();

  /* ---- haunch (the back leg you can see from the front) ---- */
  c.fillStyle = shade(spec.fur, -.08);
  ellipse(c, .30 * s, .74 * s, .17 * s, .19 * s, -.18); c.fill();
  ellipse(c, -.30 * s, .74 * s, .17 * s, .19 * s, .18); c.fill();

  /* ---- body mass ---- */
  /* A seated animal is narrow at the shoulder and widest at the haunch.
     This was a symmetric bell — the same curve up and down, widest
     halfway — which is why the room pet read as a mound with a head on
     it. The shoulders come in and the widest point drops; a cat carries
     it a little narrower than a dog. */
  const shoulder = cat ? .235 : .255;
  const flank = cat ? .455 : .475;
  const bodyPath = () => {
    c.beginPath();
    c.moveTo(-shoulder * s, .30 * s + lift);
    c.bezierCurveTo(-.42 * s, .52 * s, -flank * s, .90 * s, 0, .90 * s);
    c.bezierCurveTo(flank * s, .90 * s, .42 * s, .52 * s, shoulder * s, .30 * s + lift);
    c.closePath();
  };
  const bodyGr = c.createLinearGradient(-.2 * s, .28 * s, .28 * s, .95 * s);
  bodyGr.addColorStop(0, shade(spec.fur, .16));
  bodyGr.addColorStop(.45, spec.fur);
  bodyGr.addColorStop(1, shade(spec.fur, -.16));
  c.fillStyle = bodyGr;
  bodyPath();
  c.fill();

  /* rim light down the shoulder, same key light as the head */
  c.save();
  bodyPath(); c.clip();
  c.strokeStyle = rgba('#FFFFFF', .22);
  c.lineWidth = s * .075;
  c.save(); c.translate(s * .012, s * .012);
  bodyPath(); c.stroke();
  c.restore();
  /* and a cool bounce along the floor edge */
  const bounce = c.createLinearGradient(0, .78 * s, 0, .92 * s);
  bounce.addColorStop(0, rgba(spec.belly, 0));
  bounce.addColorStop(1, rgba(spec.belly, .3));
  c.fillStyle = bounce;
  c.fillRect(-.5 * s, .78 * s, s, .16 * s);
  c.restore();

  /* fur along the silhouette */
  furEdge(c, 0, .62 * s, .445 * s, .30 * s, Math.PI * .62, Math.PI * .38, 9, s * .035, rgba(spec.fur, .95));
  furEdge(c, 0, .62 * s, .445 * s, .30 * s, Math.PI * 1.38, Math.PI * 1.62, 7, s * .03, rgba(shade(spec.fur, .08), .9));

  /* ---- chest fluff: feathered, not a pasted ellipse ---- */
  c.save();
  bodyPath();
  c.clip();
  const cg = c.createRadialGradient(0, .58 * s + lift, s * .04, 0, .62 * s + lift, s * .30);
  cg.addColorStop(0, rgba(spec.belly, .95));
  cg.addColorStop(.62, rgba(spec.belly, .72));
  cg.addColorStop(1, rgba(spec.belly, 0));
  c.fillStyle = cg;
  ellipse(c, 0, .60 * s + lift, .215 * s, .275 * s); c.fill();
  furEdge(c, 0, .60 * s + lift, .20 * s, .26 * s, Math.PI * .35, Math.PI * .65, 5, s * .028, rgba(spec.belly, .5));

  /* ambient occlusion where the head meets the chest */
  const ao = c.createLinearGradient(0, .26 * s + lift, 0, .52 * s + lift);
  ao.addColorStop(0, rgba('#2A1E12', .30));
  ao.addColorStop(1, rgba('#2A1E12', 0));
  c.fillStyle = ao;
  c.fillRect(-.5 * s, .26 * s + lift, s, .28 * s);
  c.restore();

  /* ---- front legs ---- */
  [-1, 1].forEach(sx => {
    c.save();
    c.scale(sx, 1);
    const legPath = () => {
      c.beginPath();
      c.moveTo(.085 * s, .63 * s);
      c.bezierCurveTo(.05 * s, .78 * s, .065 * s, .86 * s, .105 * s, .878 * s);
      c.lineTo(.25 * s, .878 * s);
      c.bezierCurveTo(.285 * s, .84 * s, .265 * s, .70 * s, .215 * s, .61 * s);
      c.closePath();
    };
    /* the leg throws a shadow onto the torso behind it */
    c.save();
    c.filter = 'none';
    c.fillStyle = rgba('#2A1E12', .16);
    c.save(); c.translate(-s * .022, -s * .012);
    legPath(); c.fill();
    c.restore();
    c.restore();

    const lg = c.createLinearGradient(.06 * s, .62 * s, .27 * s, .90 * s);
    lg.addColorStop(0, shade(spec.fur, .24));
    lg.addColorStop(.55, shade(spec.fur, .08));
    lg.addColorStop(1, shade(spec.fur, -.10));
    c.fillStyle = lg;
    legPath();
    c.fill();
    /* a hair-thin edge so it never melts into the body */
    c.strokeStyle = rgba(spec.fur2, .32);
    c.lineWidth = s * .012;
    legPath();
    c.stroke();

    /* paw and toes */
    c.fillStyle = shade(spec.fur, .2);
    ellipse(c, .178 * s, .872 * s, .088 * s, .054 * s); c.fill();
    c.fillStyle = rgba('#FFFFFF', .18);
    ellipse(c, .16 * s, .858 * s, .045 * s, .022 * s, -.2); c.fill();
    c.strokeStyle = rgba(spec.fur2, .5);
    c.lineWidth = s * .013; c.lineCap = 'round';
    [-.032, .032].forEach(dx => {
      c.beginPath();
      c.moveTo(.178 * s + dx * s, .842 * s);
      c.lineTo(.178 * s + dx * s, .876 * s);
      c.stroke();
    });
    c.restore();
  });

  if (spec.collar) drawCollar(c, spec.collar, s, .36 * s + lift);
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
  drawFace(c, spec, s * .715 * shape.faceScale,
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
  /* the dark band, just inside the outline */
  c.strokeStyle = rgba('#241A12', .82);
  c.lineWidth = s * .14;
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
    c.drawImage(blobBrush('#FFC24A'), fx - s * .22, fy - s * .22, s * .44, s * .44);
    c.globalAlpha = flick * .9;
    c.drawImage(blobBrush('#FFF6D2'), fx - s * .07, fy - s * .07, s * .14, s * .14);
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
function drawLogo(c, s) {
  c.save();
  c.translate(s / 2, s / 2);
  const g = c.createLinearGradient(0, -s * .45, 0, s * .45);
  g.addColorStop(0, PAL.accent);
  g.addColorStop(1, mix(PAL.accent, PAL.rose, .5));
  c.fillStyle = g;
  squircle(c, -s * .46, -s * .46, s * .92, s * .92, 4.2); c.fill();
  c.strokeStyle = rgba('#FFFFFF', .35); c.lineWidth = s * .05;
  squircle(c, -s * .44, -s * .45, s * .88, s * .9, 4.2); c.stroke();
  /* a cat and a dog ear meeting over a biscuit */
  c.fillStyle = rgba(PAL.dark ? '#131A26' : '#3A2A18', .85);
  c.beginPath();
  c.moveTo(-s * .30, -s * .04); c.quadraticCurveTo(-s * .22, -s * .38, -s * .06, -s * .1);
  c.quadraticCurveTo(-s * .18, -s * .02, -s * .30, -s * .04); c.fill();
  c.beginPath();
  c.moveTo(s * .30, -s * .06); c.quadraticCurveTo(s * .34, -s * .3, s * .1, -s * .22);
  c.quadraticCurveTo(s * .16, -s * .06, s * .30, -s * .06); c.fill();
  ellipse(c, 0, s * .14, s * .24, s * .21); c.fill();
  c.fillStyle = rgba('#FFFFFF', .9);
  ellipse(c, -s * .09, s * .1, s * .045, s * .05); c.fill();
  ellipse(c, s * .09, s * .1, s * .045, s * .05); c.fill();
  c.restore();
}
