/* ============================================================
   27 — physics & effects.
   A fixed-step world: springs, pooled particles, a trauma-based
   camera, and a decaying displacement field the board reads so
   explosions actually shove the tiles around them.
   Everything here is stateless about the game — the renderer
   pushes events in, this module decides how they move.
   ============================================================ */

/* ---------------- tuning ---------------- */
const PH = {
  /* board space is measured in cells; screen space in css px */
  gravity: 52,          // cells / s²  — a tile falls one row in ~.2s
  terminal: 34,         // cells / s
  restitution: 0.16,    // how much of the fall comes back up
  landSnap: 2.4,        // below this speed a tile just stops
  swapK: 340, swapD: 26,   // swap spring
  squashK: 420, squashD: 21,
  pxGravity: 2100,      // px / s²  — particles
  air: 0.86,            // per-second velocity retained by light debris
  fixed: 1 / 120,       // physics step
  maxStep: 1 / 20       // never integrate more than this in one frame
};

/* ---------------- springs ---------------- */
/* A damped spring towards a target. Returns the new value; state
   carries {v}. Used for swap slides, squash, chip bumps, camera. */
function springStep(state, target, k, d, dt) {
  const f = (target - state.p) * k - state.v * d;
  state.v += f * dt;
  state.p += state.v * dt;
  return state.p;
}
function mkSpring(p) { return { p: p || 0, v: 0 }; }
/* kick a spring without moving it — a hit, not a move */
function springKick(state, impulse) { state.v += impulse; }

/* critically damped smoothing, frame-rate independent */
function smooth(cur, target, halflife, dt) {
  return target + (cur - target) * Math.pow(2, -dt / halflife);
}

/* ---------------- particle pool ---------------- */
const P_MAX = 1000;
const POOL = [];
let pAlive = 0;
for (let i = 0; i < P_MAX; i++) {
  POOL.push({
    on: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, g: 1, drag: 0,
    r: 4, r2: 4, rot: 0, vr: 0, life: 0, ttl: 1, a: 1,
    col: '#fff', col2: '#fff', floor: 1e9, seed: 0, flip: 0, add: false
  });
}
const K = {
  SPARK: 0, TUFT: 1, CRUMB: 2, SPLINTER: 3, SHARD: 4, GLOB: 5,
  DUST: 6, SMOKE: 7, CONFETTI: 8, RING: 9, GLOW: 10, HEART: 11,
  STAR: 12, BUBBLE: 13, NOTE: 14, TRAIL: 15, LEAF: 16
};

function pAlloc() {
  /* linear scan from a rolling cursor: cheap and never allocates */
  for (let i = 0; i < P_MAX; i++) {
    const idx = (pCursor + i) % P_MAX;
    if (!POOL[idx].on) { pCursor = (idx + 1) % P_MAX; pAlive++; return POOL[idx]; }
  }
  /* pool exhausted — steal the oldest */
  let worst = POOL[0], wl = -1;
  for (let i = 0; i < P_MAX; i++) { const p = POOL[i]; if (p.life / p.ttl > wl) { wl = p.life / p.ttl; worst = p; } }
  return worst;
}
let pCursor = 0;
function pClear() { for (let i = 0; i < P_MAX; i++) POOL[i].on = false; pAlive = 0; }

/* A forty-tile cascade asks for thousands of particles. Rather than
   drop frames, the emitters thin out as the pool fills: the first
   burst of a cascade is lavish, the twentieth is a sketch, and the
   eye never notices because by then the screen is already busy.  */
/* How much the effects layer is allowed to spend.

   Two limits, and a burst gets the smaller of them.

   The first is how full the pool already is, which stops one cascade
   from starving the next.

   The second is what the last few frames actually cost. The game loop
   clamps its timestep to 50ms so the physics cannot tunnel, which means
   a phone having a hard time runs in slow motion rather than breaking —
   but it also means the game never notices. FX.load() is handed the
   real gap before the clamp, and a device that is not keeping up gets
   smaller bursts until it is. Nothing changes on hardware that can
   afford it, and there is no setting to find. */
let fxFrame = 0;                 // smoothed seconds per frame, 0 until told
function fxLoad(sec) {
  if (!(sec > 0) || sec > 2) return;        /* a tab coming back from the background */
  fxFrame = fxFrame ? fxFrame * .88 + sec * .12 : sec;
}
function loadScale() {
  if (!fxFrame) return 1;
  /* full quality up to 20ms a frame, tapering to a third by 70ms */
  return clamp(1 - (fxFrame - .020) / .050, .34, 1);
}
function density() {
  const load = pAlive / P_MAX;
  const pool = load < .28 ? 1 : clamp(1 - (load - .28) * 1.8, .15, 1);
  return Math.min(pool, loadScale());
}
function count(n) { return Math.max(1, Math.round(n * density())); }

function emit(kind, x, y, o) {
  o = o || {};
  const p = pAlloc();
  p.on = true; p.kind = kind;
  p.x = x; p.y = y;
  p.vx = o.vx || 0; p.vy = o.vy || 0;
  p.g = o.g === undefined ? 1 : o.g;
  p.drag = o.drag === undefined ? .04 : o.drag;
  p.r = o.r || 4; p.r2 = o.r2 === undefined ? p.r : o.r2;
  p.rot = o.rot === undefined ? rnd(0, 6.28) : o.rot;
  p.vr = o.vr === undefined ? 0 : o.vr;
  p.ttl = o.ttl || .6; p.life = 0;
  p.a = o.a === undefined ? 1 : o.a;
  p.col = o.col || '#FFFFFF';
  p.col2 = o.col2 || p.col;
  p.floor = o.floor === undefined ? 1e9 : o.floor;
  p.seed = Math.random();
  p.flip = o.flip || 0;
  p.add = !!o.add;
  return p;
}

/* ---------------- camera: trauma shake ---------------- */
/* Trauma decays linearly, offset uses trauma² so small hits stay
   subtle and a bomb really lands. */
const CAM = { trauma: 0, t: 0, x: 0, y: 0, rot: 0, zoom: 1, zoomS: mkSpring(1) };
function shake(amount) { CAM.trauma = clamp(CAM.trauma + amount, 0, 1); }
function punchZoom(amount) { springKick(CAM.zoomS, amount); }
function camStep(dt) {
  CAM.t += dt;
  CAM.trauma = Math.max(0, CAM.trauma - dt * 1.5);
  const s = CAM.trauma * CAM.trauma * (reduceMotion() ? .25 : 1);
  const n = (o, f) => Math.sin(CAM.t * f + o) * Math.sin(CAM.t * f * 1.7 + o * 2.3);
  CAM.x = n(0, 41) * 13 * s;
  CAM.y = n(2.1, 37) * 13 * s;
  CAM.rot = n(4.7, 29) * .016 * s;
  springStep(CAM.zoomS, 1, 260, 20, dt);
  CAM.zoom = CAM.zoomS.p;
}
function camApply(c) {
  if (CAM.trauma <= 0 && Math.abs(CAM.zoom - 1) < .0005) return false;
  c.translate(CAM.x, CAM.y);
  c.rotate(CAM.rot);
  return true;
}

/* ---------------- displacement field ----------------
   Explosions leave a short-lived ring that pushes tiles outwards
   and then lets them settle. The renderer asks the field where a
   tile should really be drawn. Coordinates are board cells.      */
const WAVES = [];
function wave(cx, cy, o) {
  o = o || {};
  WAVES.push({
    x: cx, y: cy, t: 0,
    ttl: o.ttl || .55,
    amp: o.amp === undefined ? .30 : o.amp,
    speed: o.speed === undefined ? 11 : o.speed,
    width: o.width === undefined ? 1.5 : o.width,
    pull: !!o.pull
  });
  if (WAVES.length > 12) WAVES.shift();
}
function waveStep(dt) {
  for (let i = WAVES.length - 1; i >= 0; i--) {
    WAVES[i].t += dt;
    if (WAVES[i].t >= WAVES[i].ttl) WAVES.splice(i, 1);
  }
}
/* returns [dx, dy, scaleBump] in cell units for a tile at (cx,cy) */
const _disp = [0, 0, 0];
function displace(cx, cy) {
  _disp[0] = 0; _disp[1] = 0; _disp[2] = 0;
  for (let i = 0; i < WAVES.length; i++) {
    const w = WAVES[i];
    const dx = cx - w.x, dy = cy - w.y;
    const d = Math.hypot(dx, dy);
    if (d < .001) continue;
    const front = w.speed * w.t;
    const band = Math.abs(d - front);
    if (band > w.width) continue;
    const k = Math.cos(band / w.width * Math.PI * .5);          // 1 at the crest
    const decay = 1 - w.t / w.ttl;
    const push = w.amp * k * k * decay * decay * (w.pull ? -1 : 1);
    _disp[0] += dx / d * push;
    _disp[1] += dy / d * push;
    _disp[2] += push * .6;
  }
  return _disp;
}

/* ---------------- floating text ---------------- */
const FLOATS = [];
function fxText(x, y, text, o) {
  o = o || {};
  FLOATS.push({
    x, y, vx: o.vx || rnd(-14, 14), vy: o.vy === undefined ? -130 : o.vy,
    t: 0, ttl: o.ttl || 1.05, text: String(text),
    col: o.col || '#FFFFFF', size: o.size || 20, weight: o.weight || 800,
    s: mkSpring(0), stroke: o.stroke !== false
  });
  springKick(FLOATS[FLOATS.length - 1].s, 46);
  if (FLOATS.length > 40) FLOATS.shift();
}
function floatsStep(dt) {
  for (let i = FLOATS.length - 1; i >= 0; i--) {
    const f = FLOATS[i];
    f.t += dt;
    f.vy += 190 * dt;             // gentle gravity so it arcs
    f.vy *= Math.pow(.5, dt / .5);
    f.x += f.vx * dt; f.y += f.vy * dt;
    springStep(f.s, 1, 300, 17, dt);
    if (f.t >= f.ttl) FLOATS.splice(i, 1);
  }
}
function floatsDraw(c) {
  for (let i = 0; i < FLOATS.length; i++) {
    const f = FLOATS[i];
    const k = f.t / f.ttl;
    const a = k < .75 ? 1 : 1 - (k - .75) / .25;
    const sc = clamp(f.s.p, 0, 1.6);
    c.save();
    c.globalAlpha = a;
    c.translate(f.x, f.y);
    c.scale(sc, sc);
    c.font = `${f.weight} ${f.size}px "Grandstander","Trebuchet MS",sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (f.stroke) {
      c.lineWidth = f.size * .34; c.lineJoin = 'round';
      c.strokeStyle = rgba('#2A1E12', .55);
      c.strokeText(f.text, 0, 0);
    }
    c.fillStyle = f.col;
    c.fillText(f.text, 0, 0);
    c.restore();
  }
}

/* ---------------- sweeps and pulses ----------------
   A band of light crossing the board, and a full-board tint. Both
   are single draws, so they cost nothing and read as production
   value rather than as more particles.                          */
const BANDS = [];
function sweep(x, y, w, h, o) {
  o = o || {};
  BANDS.push({
    kind: 'sweep', x, y, w, h, t: 0,
    ttl: o.ttl || .7, col: o.col || '#FFFFFF',
    vert: o.vert !== false, thick: o.thick || .22, a: o.a === undefined ? .55 : o.a
  });
}
function pulse(x, y, w, h, o) {
  o = o || {};
  BANDS.push({
    kind: 'pulse', x, y, w, h, t: 0,
    ttl: o.ttl || .6, col: o.col || '#FFFFFF',
    a: o.a === undefined ? .3 : o.a, hz: o.hz || 1
  });
}
function bandsStep(dt) {
  for (let i = BANDS.length - 1; i >= 0; i--) {
    BANDS[i].t += dt;
    if (BANDS[i].t >= BANDS[i].ttl) BANDS.splice(i, 1);
  }
}
function bandsDraw(c) {
  for (let i = 0; i < BANDS.length; i++) {
    const b = BANDS[i];
    const k = b.t / b.ttl;
    c.save();
    if (b.kind === 'pulse') {
      const env = Math.sin(k * Math.PI) * Math.abs(Math.sin(k * Math.PI * b.hz));
      c.globalAlpha = b.a * env;
      const g = c.createRadialGradient(
        b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * .2,
        b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) * .72);
      g.addColorStop(0, rgba(b.col, 0));
      g.addColorStop(1, rgba(b.col, 1));
      c.fillStyle = g;
      c.fillRect(b.x, b.y, b.w, b.h);
    } else {
      const span = b.vert ? b.h : b.w;
      const thick = span * b.thick;
      const pos = lerp(-thick, span + thick, E.inOut(k));
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = b.a * Math.sin(Math.min(1, k * 1.15) * Math.PI);
      const g = b.vert
        ? c.createLinearGradient(0, b.y + pos - thick, 0, b.y + pos + thick)
        : c.createLinearGradient(b.x + pos - thick, 0, b.x + pos + thick, 0);
      g.addColorStop(0, rgba(b.col, 0));
      g.addColorStop(.5, rgba(b.col, 1));
      g.addColorStop(1, rgba(b.col, 0));
      c.fillStyle = g;
      c.fillRect(b.x, b.y, b.w, b.h);
    }
    c.restore();
  }
}

/* ---------------- the world step ---------------- */
let _acc = 0;
function physStep(dtRaw) {
  let dt = Math.min(dtRaw, PH.maxStep);
  _acc += dt;
  let guard = 0;
  while (_acc >= PH.fixed && guard++ < 8) {
    stepOnce(PH.fixed);
    _acc -= PH.fixed;
  }
  camStep(dt);
  waveStep(dt);
  bandsStep(dt);
  floatsStep(dt);
}
function stepOnce(dt) {
  pAlive = 0;
  for (let i = 0; i < P_MAX; i++) {
    const p = POOL[i];
    if (!p.on) continue;
    pAlive++;
    p.life += dt;
    if (p.life >= p.ttl) { p.on = false; continue; }

    if (p.kind === K.RING || p.kind === K.GLOW) continue;   // pure visuals

    const dragK = Math.pow(1 - p.drag, dt * 60);
    p.vx *= dragK;
    p.vy = p.vy * dragK + PH.pxGravity * p.g * dt;

    if (p.kind === K.SMOKE || p.kind === K.BUBBLE) {
      p.vx += Math.sin(p.life * 5 + p.seed * 9) * 22 * dt;   // wobble upwards
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;

    /* bounce on the floor line — crumbs and splinters skitter */
    if (p.y > p.floor) {
      p.y = p.floor;
      if (Math.abs(p.vy) > 40) {
        p.vy *= -(p.kind === K.GLOB ? .12 : .38);
        p.vx *= .74;
        p.vr *= .6;
      } else { p.vy = 0; p.vx *= .82; p.g = 0; }
    }
  }
}

/* ---------------- cached brushes ----------------
   A soft blob and a tapered streak, rendered once per colour and
   then blitted. Building a gradient for every particle on every
   frame is what makes canvas particle systems crawl.            */
const _blobs = new Map();
function blobBrush(col) {
  let cv = _blobs.get(col);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, rgba(col, 1));
  g.addColorStop(.34, rgba(col, .45));
  g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  _blobs.set(col, cv);
  return cv;
}
const _streaks = new Map();
function streakBrush(col) {
  let cv = _streaks.get(col);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = 64; cv.height = 16;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, rgba(col, 0));
  g.addColorStop(.55, rgba(col, .9));
  g.addColorStop(1, '#FFFFFF');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(0, 8); c.quadraticCurveTo(34, .5, 64, 8);
  c.quadraticCurveTo(34, 15.5, 0, 8);
  c.fill();
  _streaks.set(col, cv);
  return cv;
}
/* A tuft is four bezier curves, a fill, an ellipse and a second fill.
   At the end of a whole-board combo there are three hundred and sixty of
   them and every one of those paths was being walked again on every
   frame — measured, about six milliseconds of a sixteen millisecond
   budget, on the single moment in the game that most wants to be smooth.

   The shape never changes. Only its position, its rotation and its
   opacity do, and a canvas can do all three with one drawImage. Cached
   per colour and per size bucket, which comes to a handful of small
   bitmaps for a whole level. */
const _tufts = new Map();
const TUFT_PX = 48;
function tuftBrush(col) {
  let cv = _tufts.get(col);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = TUFT_PX; cv.height = TUFT_PX;
  const c = cv.getContext('2d');
  const r = TUFT_PX * .42;
  c.translate(TUFT_PX / 2, TUFT_PX / 2);
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(-r, r * .3);
  c.quadraticCurveTo(-r * .5, -r * 1.1, 0, -r * .35);
  c.quadraticCurveTo(r * .5, -r * 1.15, r, r * .25);
  c.quadraticCurveTo(0, r * .95, -r, r * .3);
  c.fill();
  c.fillStyle = rgba('#FFFFFF', .3);
  ellipse(c, -r * .2, -r * .25, r * .3, r * .2, -.5); c.fill();
  _tufts.set(col, cv);
  return cv;
}
const _crumbs = new Map();
const CRUMB_PX = 32;
function crumbBrush(col, col2) {
  const key = col + '|' + col2;
  let cv = _crumbs.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = CRUMB_PX; cv.height = CRUMB_PX;
  const c = cv.getContext('2d');
  const r = CRUMB_PX * .40;
  c.translate(CRUMB_PX / 2, CRUMB_PX / 2);
  c.fillStyle = col;
  rr(c, -r, -r * .8, r * 2, r * 1.6, r * .5); c.fill();
  c.fillStyle = rgba(col2, .8);
  ellipse(c, r * .18, -r * .12, r * .3, r * .24); c.fill();
  _crumbs.set(key, cv);
  return cv;
}
function clearBrushes() { _blobs.clear(); _streaks.clear(); _tufts.clear(); _crumbs.clear(); }

/* ---------------- particle drawing ---------------- */
function drawParticles(c, filterAdd) {
  if (pAlive === 0) return;
  let prevAdd = false;
  c.save();
  for (let i = 0; i < P_MAX; i++) {
    const p = POOL[i];
    if (!p.on) continue;
    if (filterAdd !== undefined && p.add !== filterAdd) continue;
    const k = p.life / p.ttl;
    if (p.add !== prevAdd) {
      c.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      prevAdd = p.add;
    }
    drawOne(c, p, k);
  }
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

function drawOne(c, p, k) {
  const fade = k < .18 ? k / .18 : 1 - Math.pow((k - .18) / .82, 2);
  const a = clamp(p.a * fade, 0, 1);
  if (a <= .004) return;
  const r = lerp(p.r, p.r2, k);
  c.globalAlpha = a;

  switch (p.kind) {

    case K.SPARK: {
      /* stretched along travel — reads as speed, not as a dot */
      const sp = Math.hypot(p.vx, p.vy);
      const len = clamp(sp * .012, r, r * 5) * 1.4;
      const br = streakBrush(p.col);
      c.save();
      c.translate(p.x, p.y);
      c.rotate(Math.atan2(p.vy, p.vx));
      c.drawImage(br, -len, -r * .8, len * 1.3, r * 1.6);
      c.restore();
      break;
    }

    case K.TUFT: {
      /* a scrap of fur: drawn once into a brush, stamped ever after */
      const br = tuftBrush(p.col);
      const d = r / (TUFT_PX * .42) * TUFT_PX;
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      c.drawImage(br, -d / 2, -d / 2, d, d);
      c.restore();
      break;
    }

    case K.CRUMB: {
      const br = crumbBrush(p.col, p.col2);
      const d = r / (CRUMB_PX * .40) * CRUMB_PX;
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      c.drawImage(br, -d / 2, -d / 2, d, d);
      c.restore();
      break;
    }

    case K.SPLINTER: {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      const w = r * .34;
      c.fillStyle = p.col;
      c.beginPath();
      c.moveTo(-r, -w * .5); c.lineTo(r, -w); c.lineTo(r, w); c.lineTo(-r, w * .6);
      c.closePath(); c.fill();
      c.fillStyle = rgba(p.col2, .75);
      c.fillRect(-r, -w * .5, r * 2, w * .5);
      c.restore();
      break;
    }

    case K.SHARD: {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      c.fillStyle = rgba(p.col, .62);
      c.beginPath();
      c.moveTo(0, -r); c.lineTo(r * .8, r * .5); c.lineTo(-r * .6, r * .85);
      c.closePath(); c.fill();
      c.strokeStyle = rgba('#FFFFFF', .85); c.lineWidth = Math.max(.6, r * .16);
      c.stroke();
      c.restore();
      break;
    }

    case K.GLOB: {
      /* mud: fat blob that flattens as it slows */
      const squash = clamp(1 - Math.abs(p.vy) / 900, .35, 1);
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      c.fillStyle = p.col;
      ellipse(c, 0, 0, r / squash, r * squash); c.fill();
      c.fillStyle = rgba('#FFFFFF', .18);
      ellipse(c, -r * .25, -r * .3, r * .3, r * .2, -.4); c.fill();
      c.restore();
      break;
    }

    case K.DUST: {
      c.globalAlpha = a * .5;
      c.drawImage(blobBrush(p.col), p.x - r, p.y - r, r * 2, r * 2);
      break;
    }

    case K.SMOKE: {
      c.globalAlpha = a * .34;
      c.drawImage(blobBrush(p.col), p.x - r, p.y - r, r * 2, r * 2);
      break;
    }

    case K.CONFETTI: {
      /* fake 3-D: the strip turns edge-on and vanishes for a beat */
      const spin = Math.cos(p.life * p.flip + p.seed * 6.28);
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      c.scale(1, Math.abs(spin) * .9 + .1);
      c.fillStyle = spin > 0 ? p.col : p.col2;
      rr(c, -r * .5, -r * .9, r, r * 1.8, r * .18); c.fill();
      c.restore();
      break;
    }

    case K.RING: {
      const t = k;
      const rad = lerp(p.r, p.r2, E.out(t));
      c.save();
      c.strokeStyle = p.col;
      c.lineWidth = Math.max(.8, p.r * .55 * (1 - t));
      c.globalAlpha = a * (1 - t);
      c.beginPath(); c.arc(p.x, p.y, rad, 0, 6.2832); c.stroke();
      c.restore();
      break;
    }

    case K.GLOW: {
      const rad = lerp(p.r, p.r2, E.out(k));
      c.globalAlpha = a * .62;
      c.drawImage(blobBrush(p.col), p.x - rad, p.y - rad, rad * 2, rad * 2);
      break;
    }

    case K.HEART: {
      c.save(); c.translate(p.x, p.y); c.rotate(Math.sin(p.life * 4 + p.seed * 6) * .22);
      c.fillStyle = p.col;
      c.beginPath();
      c.moveTo(0, r * .85);
      c.bezierCurveTo(-r * 1.35, -r * .1, -r * .55, -r * 1.05, 0, -r * .35);
      c.bezierCurveTo(r * .55, -r * 1.05, r * 1.35, -r * .1, 0, r * .85);
      c.fill();
      c.fillStyle = rgba('#FFFFFF', .5);
      ellipse(c, -r * .3, -r * .3, r * .18, r * .13, -.4); c.fill();
      c.restore();
      break;
    }

    case K.STAR: {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      c.fillStyle = p.col;
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = i / 8 * 6.2832, rad = i % 2 ? r * .38 : r;
        i ? c.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad) : c.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      }
      c.closePath(); c.fill();
      c.restore();
      break;
    }

    case K.BUBBLE: {
      c.save();
      c.strokeStyle = rgba('#FFFFFF', .8); c.lineWidth = Math.max(.7, r * .14);
      c.fillStyle = rgba(p.col, .22);
      c.beginPath(); c.arc(p.x, p.y, r, 0, 6.2832); c.fill(); c.stroke();
      c.fillStyle = rgba('#FFFFFF', .85);
      ellipse(c, p.x - r * .32, p.y - r * .34, r * .2, r * .15, -.5); c.fill();
      c.restore();
      break;
    }

    case K.NOTE: {
      c.save(); c.translate(p.x, p.y); c.rotate(Math.sin(p.life * 3 + p.seed * 6) * .3);
      c.fillStyle = p.col;
      ellipse(c, -r * .3, r * .55, r * .46, r * .34, -.35); c.fill();
      c.fillRect(r * .05, -r, r * .22, r * 1.6);
      c.beginPath();
      c.moveTo(r * .27, -r);
      c.quadraticCurveTo(r * .95, -r * .82, r * .78, -r * .3);
      c.quadraticCurveTo(r * .78, -r * .66, r * .27, -r * .62);
      c.fill();
      c.restore();
      break;
    }

    case K.TRAIL: {
      c.globalAlpha = a * .6;
      c.drawImage(blobBrush(p.col), p.x - r, p.y - r, r * 2, r * 2);
      c.globalAlpha = a * .45;
      c.drawImage(blobBrush('#FFFFFF'), p.x - r * .45, p.y - r * .45, r * .9, r * .9);
      break;
    }

    case K.LEAF: {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      c.fillStyle = p.col;
      c.beginPath();
      c.moveTo(0, -r); c.quadraticCurveTo(r * .9, 0, 0, r); c.quadraticCurveTo(-r * .9, 0, 0, -r);
      c.fill();
      c.strokeStyle = rgba(p.col2, .6); c.lineWidth = Math.max(.5, r * .12);
      c.beginPath(); c.moveTo(0, -r * .8); c.lineTo(0, r * .8); c.stroke();
      c.restore();
      break;
    }
  }
  c.globalAlpha = 1;
}

/* ============================================================
   Emitter presets — the vocabulary the game speaks in.
   All coordinates are css px in the canvas being drawn.
   ============================================================ */
const RING_WHITE = rgba('#FFFFFF', .9);
const FX = {

  /* a tile clears: bright core, a ring, fur tufts and crumbs */
  pop(x, y, col, s, opts) {
    opts = opts || {};
    const n = reduceMotion() ? 2 : count(opts.n || 7);
    /* shade() builds a colour string. Called inside these loops it built
       one per particle — eight hundred throwaway strings in the single
       frame where the whole board goes at once, which is exactly where a
       garbage collection is least welcome. They do not vary per
       particle, so they are made once. */
    const sparkCol = shade(col, .4);
    const tuftCol = shade(col, .22);
    emit(K.GLOW, x, y, { col, r: s * .2, r2: s * .95, ttl: .3, a: .85, add: true });
    emit(K.RING, x, y, { col: RING_WHITE, r: s * .3, r2: s * 1.15, ttl: .34 });
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.2832), sp = rnd(90, 340) * (opts.force || 1);
      emit(K.SPARK, x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        col, col2: sparkCol, r: s * .09, r2: s * .03,
        g: .25, drag: .07, ttl: rnd(.26, .46), add: true
      });
    }
    for (let i = 0; i < Math.ceil(n * .45); i++) {
      const a = rnd(0, 6.2832), sp = rnd(60, 210);
      emit(K.TUFT, x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90,
        col: tuftCol, r: s * rnd(.10, .17), r2: s * .05,
        g: .55, drag: .05, vr: rnd(-9, 9), ttl: rnd(.5, .8)
      });
    }
    for (let i = 0; i < count(2); i++) {
      emit(K.CRUMB, x, y, {
        vx: rnd(-130, 130), vy: rnd(-260, -90),
        col: '#C89A5E', col2: '#8A6236', r: s * .07,
        g: 1, drag: .02, vr: rnd(-14, 14), ttl: rnd(.6, .95),
        floor: opts.floor === undefined ? 1e9 : opts.floor
      });
    }
    if (!reduceMotion()) shake(opts.shake === undefined ? .05 : opts.shake);
  },

  /* a rocket streaks: a hot core and a soft exhaust that lingers */
  rocketTrail(x, y, col, s, dirX, dirY) {
    emit(K.TRAIL, x, y, { col, r: s * .42, r2: s * .1, ttl: .3, add: true });
    for (let i = 0; i < count(2); i++) {
      emit(K.SPARK, x, y, {
        vx: -dirX * rnd(120, 300) + rnd(-70, 70),
        vy: -dirY * rnd(120, 300) + rnd(-70, 70),
        col: '#FFE9AE', col2: col, r: s * .07, r2: s * .02,
        g: .1, drag: .1, ttl: rnd(.18, .32), add: true
      });
    }
    emit(K.SMOKE, x, y, {
      vx: rnd(-24, 24), vy: rnd(-40, -6),
      col: PAL.dark ? '#8A93A6' : '#C9B49A',
      r: s * .18, r2: s * .6, g: -.03, drag: .1, ttl: rnd(.5, .85)
    });
  },

  /* a bomb: shockwave ring, dust, smoke, embers, real shake */
  blast(x, y, s, col) {
    emit(K.GLOW, x, y, { col: '#FFDFA0', r: s * .4, r2: s * 2.2, ttl: .3, add: true, a: .85 });
    emit(K.RING, x, y, { col: rgba('#FFFFFF', .95), r: s * .5, r2: s * 3.1, ttl: .46 });
    emit(K.RING, x, y, { col: rgba(col || '#F5B851', .8), r: s * .3, r2: s * 2.3, ttl: .34 });
    const n = reduceMotion() ? 6 : count(20);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.2832), sp = rnd(200, 720);
      emit(K.SPARK, x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        col: '#FFD98A', col2: '#F5872F', r: s * .11, r2: s * .02,
        g: .4, drag: .06, ttl: rnd(.3, .6), add: true
      });
    }
    for (let i = 0; i < count(7); i++) {
      emit(K.SMOKE, x, y, {
        vx: rnd(-160, 160), vy: rnd(-190, -20),
        col: PAL.dark ? '#6E7789' : '#B9A288',
        r: s * .3, r2: s * 1.5, g: -.06, drag: .08, ttl: rnd(.7, 1.2)
      });
    }
    shake(.34); punchZoom(-1.6);
  },

  /* crate: splinters with grain, a puff of sawdust */
  splinters(x, y, s, hard) {
    const n = reduceMotion() ? 4 : count(hard ? 12 : 8);
    for (let i = 0; i < n; i++) {
      const a = rnd(-3.4, .3), sp = rnd(140, 420);
      emit(K.SPLINTER, x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        col: pick(['#A97B4C', '#8A6039', '#C39866']),
        col2: '#E4CBA6',
        r: s * rnd(.12, .24), g: 1, drag: .02,
        vr: rnd(-22, 22), ttl: rnd(.55, .95)
      });
    }
    for (let i = 0; i < count(3); i++) {
      emit(K.DUST, x + rnd(-s * .2, s * .2), y + rnd(-s * .2, s * .2), {
        vx: rnd(-50, 50), vy: rnd(-60, -10),
        col: '#D8BE95', r: s * .18, r2: s * .7, g: -.02, drag: .12, ttl: rnd(.4, .7)
      });
    }
    shake(.1);
  },

  /* ice: cold shards, a sharp white flash, glitter */
  shards(x, y, s) {
    emit(K.GLOW, x, y, { col: '#DFF3FF', r: s * .2, r2: s * 1.2, ttl: .22, add: true });
    const n = reduceMotion() ? 4 : count(10);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.2832), sp = rnd(120, 380);
      emit(K.SHARD, x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70,
        col: '#BFE4F5', r: s * rnd(.09, .19), r2: s * .04,
        g: .85, drag: .03, vr: rnd(-16, 16), ttl: rnd(.45, .8)
      });
    }
    for (let i = 0; i < count(5); i++) {
      emit(K.SPARK, x, y, {
        vx: rnd(-180, 180), vy: rnd(-220, 40),
        col: '#FFFFFF', col2: '#BFE4F5', r: s * .05, r2: s * .01,
        g: .3, drag: .08, ttl: rnd(.25, .5), add: true
      });
    }
    shake(.08);
  },

  /* mud: heavy globs that fall and flatten, no bounce to speak of */
  splat(x, y, s, floor) {
    const n = reduceMotion() ? 4 : count(9);
    for (let i = 0; i < n; i++) {
      const a = rnd(-3.1, 0), sp = rnd(90, 300);
      emit(K.GLOB, x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        col: pick(['#6B4A2C', '#8A6742', '#5A3D24']),
        r: s * rnd(.07, .14), g: 1.15, drag: .01,
        vr: rnd(-6, 6), ttl: rnd(.5, .85),
        floor: floor === undefined ? y + s * 1.2 : floor
      });
    }
    emit(K.RING, x, y, { col: rgba('#3F2A18', .5), r: s * .2, r2: s * .9, ttl: .3 });
    shake(.07);
  },

  /* a tile lands: a low puff, sized by how hard it hit */
  landPuff(x, y, s, force) {
    const f = clamp(force, 0, 1);
    if (f < .12) return;
    const n = Math.round(1 + f * 3);
    for (let i = 0; i < n; i++) {
      emit(K.DUST, x + rnd(-s * .3, s * .3), y + s * .42, {
        vx: rnd(-70, 70) * f, vy: rnd(-30, -4),
        col: PAL.dark ? '#5A6478' : '#C9B092',
        r: s * .1, r2: s * (.3 + f * .4), g: -.02, drag: .14, ttl: rnd(.24, .42), a: .7 * f
      });
    }
  },

  /* confetti for a cleared level — falls to the bottom of the frame */
  confetti(x, y, w, floor, n) {
    n = reduceMotion() ? 14 : (n || 60);
    const cols = [PAL.accent, PAL.rose, PAL.sage, PAL.sky, PAL.plum, '#FFFFFF'];
    for (let i = 0; i < n; i++) {
      const col = pick(cols);
      emit(K.CONFETTI, x + rnd(-w / 2, w / 2), y + rnd(-20, 20), {
        vx: rnd(-190, 190), vy: rnd(-620, -260),
        col, col2: shade(col, -.3),
        r: rnd(6, 11), g: .42, drag: .015,
        vr: rnd(-9, 9), flip: rnd(7, 15), ttl: rnd(1.6, 2.8), floor
      });
    }
  },

  /* the pet is happy — hearts drifting up */
  hearts(x, y, n, col) {
    for (let i = 0; i < (n || 5); i++) {
      emit(K.HEART, x + rnd(-16, 16), y + rnd(-8, 8), {
        vx: rnd(-34, 34), vy: rnd(-150, -80),
        col: col || PAL.rose, r: rnd(6, 11), r2: rnd(4, 7),
        g: -.03, drag: .05, ttl: rnd(1.1, 1.7)
      });
    }
  },
  notes(x, y, n) {
    for (let i = 0; i < (n || 3); i++) {
      emit(K.NOTE, x + rnd(-14, 14), y, {
        vx: rnd(-30, 30), vy: rnd(-120, -70),
        col: PAL.plum, r: rnd(6, 10), g: -.02, drag: .05, ttl: rnd(1, 1.6)
      });
    }
  },
  bubbles(x, y, n, w) {
    for (let i = 0; i < (n || 8); i++) {
      emit(K.BUBBLE, x + rnd(-(w || 40), (w || 40)), y + rnd(-10, 10), {
        vx: rnd(-20, 20), vy: rnd(-110, -40),
        col: '#BFE4F5', r: rnd(4, 12), r2: rnd(3, 9),
        g: -.05, drag: .06, ttl: rnd(1, 1.8)
      });
    }
  },
  crumbs(x, y, n, floor) {
    for (let i = 0; i < (n || 6); i++) {
      emit(K.CRUMB, x + rnd(-10, 10), y, {
        vx: rnd(-120, 120), vy: rnd(-220, -60),
        col: pick(['#C89A5E', '#B5763F', '#8C5A2E']), col2: '#E7CFA6',
        r: rnd(2.5, 5), g: 1, drag: .02, vr: rnd(-14, 14),
        ttl: rnd(.7, 1.2), floor
      });
    }
  },
  sparkle(x, y, col, n, spread) {
    for (let i = 0; i < (n || 6); i++) {
      emit(K.STAR, x + rnd(-(spread || 14), (spread || 14)), y + rnd(-(spread || 14), (spread || 14)), {
        vx: rnd(-40, 40), vy: rnd(-70, -10),
        col: col || PAL.accent, r: rnd(3, 7), r2: 0,
        g: -.02, drag: .06, vr: rnd(-6, 6), ttl: rnd(.5, .95), add: true
      });
    }
  },
  ring(x, y, r0, r1, col, ttl) {
    emit(K.RING, x, y, { col: col || rgba('#FFFFFF', .8), r: r0, r2: r1, ttl: ttl || .4 });
  },
  glow(x, y, r0, r1, col, ttl) {
    emit(K.GLOW, x, y, { col: col || PAL.accent, r: r0, r2: r1, ttl: ttl || .35, add: true });
  },

  /* housekeeping */
  clear: pClear,
  count: () => pAlive,
  step: physStep,
  load: fxLoad,
  quality: loadScale,
  draw: drawParticles,
  text: fxText,
  drawText: floatsDraw,
  shake, punchZoom, wave, displace,
  sweep, pulse, drawBands: bandsDraw,
  cam: CAM
};

/* ============================================================
   Tile motion — the part players feel without naming it.
   ============================================================ */

/* A fall that accelerates, overshoots by a hair and settles.
   E.out decelerates into place, which reads as floating; this is
   what a dropped object actually does.                           */
E.drop = t => {
  const k = .82;
  if (t < k) { const u = t / k; return u * u * 1.055; }
  const u = (t - k) / (1 - k);
  return 1.055 - .055 * (1 - Math.pow(1 - u, 2));
};

/* Squash/stretch driven by the spring: returns [sx, sy]. Volume
   preserving, so a squashed tile widens instead of shrinking.   */
const _ss = [1, 1];

/* Idle life for a resting tile — a slow, per-tile breath so the
   board is never completely still. Cheap: one sin per tile.     */
function idleBob(t, time) {
  const ph = (t.id % 97) * .0647;
  return Math.sin(time * 1.6 + ph * 6.28) * .006;
}

/* Pet body physics: a two-spring chain that lags behind the body
   so the head and belly wobble when the pet moves or is tapped. */
function mkJiggle() { return { a: mkSpring(0), b: mkSpring(0) }; }
function jiggleStep(j, drive, dt) {
  springStep(j.a, drive, 190, 12, dt);
  springStep(j.b, j.a.p, 130, 9, dt);
  return j.b.p;
}
