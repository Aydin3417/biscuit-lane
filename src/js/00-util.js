/* ============================================================
   00 — utilities, icons, DOM helpers
   ============================================================ */
'use strict';

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const irnd = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const now = () => Date.now();
const HOUR = 3600000, MIN = 60000, DAY = 86400000;

/* seeded RNG so a level always builds the same board */
function mulberry(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* easings */
const E = {
  out: t => 1 - Math.pow(1 - t, 3),
  inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  bounceOut: t => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375;
    return n * (t -= 2.625 / d) * t + .984375;
  },
  elastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -9 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1
};

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Timed wait used to pace cascades.

   Driven by rAF while the page is visible so the pacing lines up with
   painted frames, and by setTimeout when it is not — otherwise a player
   switching tabs mid-cascade would freeze the board half-resolved. */
/* Set from the console by the integration harness so a whole level can
   be played in a few seconds. Never set by the game itself. */
let FAST_FORWARD = false;
function wait(ms) {
  if (FAST_FORWARD) return Promise.resolve();
  if (reduceMotion()) ms = Math.min(ms, 60);
  return new Promise(res => {
    if (document.hidden) { setTimeout(res, Math.min(ms, 120)); return; }
    const t0 = performance.now();
    const step = t => {
      if (document.hidden) { setTimeout(res, 0); return; }
      (t - t0 >= ms) ? res() : requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ---------- colour helpers ---------- */
function hex2rgb(h) {
  h = h.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb2hex(r, g, b) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
function shade(hexc, amt) {                       // amt -1..1
  const [r, g, b] = hex2rgb(hexc);
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  return rgb2hex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}
function mix(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  return rgb2hex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
function rgba(hexc, a) { const [r, g, b] = hex2rgb(hexc); return `rgba(${r},${g},${b},${a})`; }

/* ---------- canvas helpers ---------- */
function fitCanvas(cv, w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return c;
}
function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
/* squircle — softer than a rounded rect, reads as a moulded toy */
function squircle(c, x, y, w, h, n) {
  n = n || 4;
  const cx = x + w / 2, cy = y + h / 2, a = w / 2, b = h / 2, steps = 44;
  c.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps * Math.PI * 2;
    const ct = Math.cos(t), st = Math.sin(t);
    const px = cx + a * Math.sign(ct) * Math.pow(Math.abs(ct), 2 / n);
    const py = cy + b * Math.sign(st) * Math.pow(Math.abs(st), 2 / n);
    i ? c.lineTo(px, py) : c.moveTo(px, py);
  }
  c.closePath();
}

/* ---------------- tile silhouettes ----------------

   Six breeds used to be six identical rounded squares in six colours,
   which is a board you have to read one cell at a time. Shape is the
   fastest thing the eye sorts on — faster than hue, and it survives
   being small, being colour-blind, and being half-covered in mud.

   Each is star-convex about its own centre and fills the cell to about
   the same area, so no breed looks bigger than another, and each leaves
   room for a face across the middle. */
/* faceScale, because a face sized for a square hangs out of a diamond:
   each shape is given the width it actually has across the ears. */
const TILE_SHAPES = [
  { id: 'round',   faceY: 0,    faceScale: .96, pip: [-.27, -.27] },
  { id: 'square',  faceY: 0,    faceScale: 1,   pip: [-.30, -.30] },
  { id: 'hex',     faceY: .015, faceScale: .90, pip: [-.25, -.23] },
  { id: 'shield',  faceY: -.04, faceScale: .93, pip: [-.28, -.29] },
  { id: 'gem',     faceY: .01,  faceScale: .84, pip: [-.20, -.22] },
  { id: 'clover',  faceY: 0,    faceScale: .92, pip: [-.26, -.26] }
];
function tileShape(type) { return TILE_SHAPES[((type % TILE_SHAPES.length) + TILE_SHAPES.length) % TILE_SHAPES.length]; }

/* Same signature as squircle(), so it drops in wherever the tile body,
   its clip, its two bevels and its edge are traced. */
function tilePath(c, type, x, y, w, h) {
  const cx = x + w / 2, cy = y + h / 2, a = w / 2, b = h / 2;
  const id = tileShape(type).id;
  if (id === 'square') { squircle(c, x, y, w, h, 4.2); return; }
  if (id === 'shield') {
    /* a name tag: square across the shoulders, tapering to a soft point */
    const r = a * .42;
    c.beginPath();
    c.moveTo(cx - a + r, cy - b);
    c.lineTo(cx + a - r, cy - b);
    c.quadraticCurveTo(cx + a, cy - b, cx + a, cy - b + r);
    c.lineTo(cx + a * .94, cy + b * .18);
    c.quadraticCurveTo(cx + a * .82, cy + b * .82, cx, cy + b);
    c.quadraticCurveTo(cx - a * .82, cy + b * .82, cx - a * .94, cy + b * .18);
    c.lineTo(cx - a, cy - b + r);
    c.quadraticCurveTo(cx - a, cy - b, cx - a + r, cy - b);
    c.closePath();
    return;
  }
  /* the rest are one polar sweep each */
  const TAU = Math.PI * 2, steps = 72;
  const rad = t => {
    if (id === 'round') return 1;
    if (id === 'gem') {
      /* a rounded diamond. Pulled only a little past the circle: at
         1.45 it was a kite, too narrow at the shoulders to hold a face */
      const ct = Math.abs(Math.cos(t)), st = Math.abs(Math.sin(t));
      return 1 / Math.pow(Math.pow(ct, 1.42) + Math.pow(st, 1.42), 1 / 1.42);
    }
    if (id === 'hex') {
      /* regular hexagon, point upward, then eased back toward the circle
         so the corners read as corners and not as spikes */
      const k = Math.PI / 3;
      const u = ((t + Math.PI / 2) % k + k) % k - k / 2;
      const hexR = Math.cos(k / 2) / Math.cos(u);
      return hexR * .78 + .22;
    }
    /* clover: six soft lobes, deep enough to see at forty pixels */
    return .885 + .115 * Math.cos(6 * t + Math.PI / 2);
  };
  c.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps * TAU;
    const r = rad(t);
    const px = cx + a * r * Math.cos(t), py = cy + b * r * Math.sin(t);
    i ? c.lineTo(px, py) : c.moveTo(px, py);
  }
  c.closePath();
}

function ellipse(c, x, y, rx, ry, rot) {
  c.beginPath(); c.ellipse(x, y, Math.max(rx, .01), Math.max(ry, .01), rot || 0, 0, Math.PI * 2);
}

/* ---------- icons (inline svg strings) ---------- */
const IC = {
  heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.7-9.5-9C.9 8.4 2.6 4.6 6.2 4c2.2-.4 4.2.7 5.3 2.3 1.1-1.6 3-2.7 5.2-2.3 3.7.6 5.4 4.4 3.8 8-2 4.3-8.5 9-8.5 9z"/></svg>',
  coin: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="currentColor" opacity=".22"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7.2v9.6M9.4 9.4c0-1 1.1-1.8 2.6-1.8s2.6.6 2.6 1.6c0 2.4-5.2 1.2-5.2 3.6 0 1.1 1.2 1.8 2.6 1.8s2.6-.7 2.6-1.7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  treat: '<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 9.5 4.3 7.3a2.3 2.3 0 1 1 3-3l2.2 2.2M17.5 14.5l2.2 2.2a2.3 2.3 0 1 1-3 3l-2.2-2.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="5.4" y="8.2" width="13.2" height="7.6" rx="3.8" transform="rotate(45 12 12)" fill="currentColor" opacity=".25"/><rect x="5.4" y="8.2" width="13.2" height="7.6" rx="3.8" transform="rotate(45 12 12)" stroke="currentColor" stroke-width="2"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.9z"/></svg>',
  starOut: '<svg viewBox="0 0 24 24" fill="none"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none"><path d="M3.5 10.4 12 3.6l8.5 6.8V20a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M9.4 21v-5.4a2.6 2.6 0 0 1 5.2 0V21" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none"><rect x="2.8" y="2.8" width="8" height="8" rx="2.6" stroke="currentColor" stroke-width="1.9"/><rect x="13.2" y="2.8" width="8" height="8" rx="2.6" fill="currentColor"/><rect x="2.8" y="13.2" width="8" height="8" rx="2.6" fill="currentColor"/><rect x="13.2" y="13.2" width="8" height="8" rx="2.6" stroke="currentColor" stroke-width="1.9"/></svg>',
  shop: '<svg viewBox="0 0 24 24" fill="none"><path d="M3.6 8.4h16.8l-1.2 11a1.6 1.6 0 0 1-1.6 1.4H6.4a1.6 1.6 0 0 1-1.6-1.4z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M8.4 10.6V7a3.6 3.6 0 0 1 7.2 0v3.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  paw: '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="7" cy="8.4" rx="2.1" ry="2.7"/><ellipse cx="12" cy="6.6" rx="2.1" ry="2.8"/><ellipse cx="17" cy="8.4" rx="2.1" ry="2.7"/><ellipse cx="19.6" cy="13.4" rx="1.9" ry="2.3"/><path d="M12 11.2c3.4 0 5.8 2.5 5.8 5 0 2-1.6 3.3-3.6 3.3-1 0-1.6-.4-2.2-.4s-1.2.4-2.2.4c-2 0-3.6-1.3-3.6-3.3 0-2.5 2.4-5 5.8-5z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.1" stroke="currentColor" stroke-width="1.9"/><path d="M19.4 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" stroke="currentColor" stroke-width="1.7"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none"><path d="M14.5 5.5 8 12l6.5 6.5" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bowl: '<svg viewBox="0 0 24 24" fill="none"><path d="M3.4 11.4h17.2c0 4.4-3.8 7.6-8.6 7.6s-8.6-3.2-8.6-7.6z" fill="currentColor" opacity=".22"/><path d="M3.4 11.4h17.2c0 4.4-3.8 7.6-8.6 7.6s-8.6-3.2-8.6-7.6z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M8 8.4c0-1.6 1.8-1.6 1.8-3.2M12 8c0-2 2.2-2 2.2-4M16 8.6c0-1.3 1.5-1.3 1.5-2.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  ball: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.6" fill="currentColor" opacity=".2"/><circle cx="12" cy="12" r="8.6" stroke="currentColor" stroke-width="1.9"/><path d="M3.6 10.2c4 .8 8 .3 11.4-2.2M20.4 13.6c-3.9-.8-8-.3-11.3 2.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  bath: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 12.4h18v2.2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z" fill="currentColor" opacity=".2"/><path d="M3 12.4h18v2.2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M6.4 12.4V6.2a2.4 2.4 0 0 1 4.5-1.1" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="16.6" cy="6" r="1.5" stroke="currentColor" stroke-width="1.6"/><circle cx="19.4" cy="9.2" r="1" stroke="currentColor" stroke-width="1.5"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none"><path d="M20.4 14.3A8.6 8.6 0 0 1 9.7 3.6a8.6 8.6 0 1 0 10.7 10.7z" fill="currentColor" opacity=".22"/><path d="M20.4 14.3A8.6 8.6 0 0 1 9.7 3.6a8.6 8.6 0 1 0 10.7 10.7z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4.2" fill="currentColor" opacity=".25"/><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.9"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.4 2 4.6 13.2h5.3L9.2 22l9-11.6h-5.6z"/></svg>',
  hammer: '<svg viewBox="0 0 24 24" fill="none"><path d="m11.6 9.2-7.2 7.2a1.9 1.9 0 0 0 0 2.7l.5.5a1.9 1.9 0 0 0 2.7 0l7.2-7.2" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="m10.4 4.6 3-1.8 6.6 6.6-1.8 3z" fill="currentColor" opacity=".25"/><path d="m10.4 4.6 3-1.8 6.6 6.6-1.8 3z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="m9.6 7.8 5.4 5.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 8.4h13.4M13.6 4.4l4 4-4 4M20 15.6H6.6M10.4 11.6l-4 4 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none"><path d="M3.4 6.6h3.2c1.4 0 2.6.7 3.3 1.9l4.2 7c.7 1.2 2 1.9 3.3 1.9h3.2M3.4 17.4h3.2c1.4 0 2.6-.7 3.3-1.9l.9-1.5M14.1 9.9l1-1.4c.7-1.2 2-1.9 3.3-1.9h3.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="m18.4 3.6 3 3-3 3M18.4 14.4l3 3-3 3" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plusmove: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.8" fill="currentColor" opacity=".2"/><circle cx="12" cy="12" r="8.8" stroke="currentColor" stroke-width="1.9"/><path d="M12 7.8v8.4M7.8 12h8.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none"><rect x="4.6" y="10.4" width="14.8" height="10.2" rx="2.6" fill="currentColor" opacity=".2"/><rect x="4.6" y="10.4" width="14.8" height="10.2" rx="2.6" stroke="currentColor" stroke-width="1.9"/><path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none"><path d="m5 12.6 4.6 4.4L19 6.6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.4" y="9.4" width="17.2" height="11.2" rx="2" fill="currentColor" opacity=".2"/><rect x="3.4" y="9.4" width="17.2" height="11.2" rx="2" stroke="currentColor" stroke-width="1.9"/><path d="M2.4 9.4h19.2v3.4H2.4zM12 9.4v11.2" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M12 9.4S9.6 3.4 7.2 4.4 9 9.4 12 9.4zM12 9.4s2.4-6 4.8-5 -1.8 5-4.8 5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6c.6 4.3 2.5 6.2 6.8 6.8-4.3.6-6.2 2.5-6.8 6.8-.6-4.3-2.5-6.2-6.8-6.8 4.3-.6 6.2-2.5 6.8-6.8z"/><path d="M18.6 15c.3 2.2 1.3 3.1 3.4 3.4-2.1.3-3.1 1.2-3.4 3.4-.3-2.2-1.2-3.1-3.4-3.4 2.2-.3 3.1-1.2 3.4-3.4z"/></svg>',
  brush: '<svg viewBox="0 0 24 24" fill="none"><rect x="6.4" y="2.8" width="11.2" height="7.4" rx="2.4" fill="currentColor" opacity=".22"/><rect x="6.4" y="2.8" width="11.2" height="7.4" rx="2.4" stroke="currentColor" stroke-width="1.9"/><path d="M8.6 10.2v3.2M12 10.2v4.6M15.4 10.2v3.2M10.3 10.2v5.4M13.7 10.2v5.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8.4 6.8 12 12 4.6 17.2 12 21 8.4l-1.6 10.2a1 1 0 0 1-1 .8H5.6a1 1 0 0 1-1-.8z"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.9"/><path d="M12 11v5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><circle cx="12" cy="7.9" r="1.2" fill="currentColor"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.4s1.2 3.3-.9 5.6c-1.6 1.8-4.4 3-4.4 6.6a5.3 5.3 0 0 0 10.6 0c0-1.8-.7-2.9-.7-2.9s-.6 1.6-1.9 1.6c-1 0-1.4-1-1-2.4.7-2.6-1.7-8.5-1.7-8.5z"/></svg>'
};
function icon(name, cls) { return `<span class="i ${cls || ''}" aria-hidden="true">${IC[name] || ''}</span>`; }

/* ---------- toast ---------- */
let toastTimers = [];
function toast(msg, ic) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = (ic ? IC[ic] : '') + '<span>' + msg + '</span>';
  $('#toasts').appendChild(el);
  const t = setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, 1900);
  toastTimers.push(t);
  const kids = $$('#toasts .toast');
  if (kids.length > 3) kids[0].remove();
}

/* ---------- modal ---------- */
let modalStack = [];
function modal(html, opts) {
  opts = opts || {};
  const veil = document.createElement('div');
  veil.className = 'veil';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.tabIndex = -1;
  sheet.innerHTML = html;
  veil.appendChild(sheet);
  $('#modals').appendChild(veil);
  const returnFocus = document.activeElement;
  /* The keyboard follows the dialog, so it stops reaching whatever was
     behind it. Not inside the rAF below: that never fires in a hidden
     tab, and focus is not decoration. */
  const first = sheet.querySelector('button, input, select, textarea, a[href]');
  try { (first || sheet).focus({ preventScroll: true }); } catch (e) { }
  requestAnimationFrame(() => veil.classList.add('on'));
  const api = {
    el: sheet, veil,
    close() {
      veil.classList.remove('on');
      /* it lingers for the fade; it must not still be operable, and
         anything asking whether a sheet is up must see it as gone */
      veil.dataset.closing = '1';
      veil.style.pointerEvents = 'none';
      /* and nothing in it can be pressed again on the way out — several
         of these buttons spend a heart or a treat when pressed */
      sheet.querySelectorAll('button').forEach(b => { b.disabled = true; });
      setTimeout(() => veil.remove(), 300);
      modalStack = modalStack.filter(m => m !== api);
      if (returnFocus && returnFocus.isConnected && returnFocus.focus) {
        try { returnFocus.focus({ preventScroll: true }); } catch (e) { }
      }
      if (opts.onClose) opts.onClose();
    }
  };
  if (opts.dismissable !== false) {
    veil.addEventListener('click', e => { if (e.target === veil) api.close(); });
    veil.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); api.close(); }
    });
  }
  modalStack.push(api);
  return api;
}
/* Is a sheet up? Asked of the document rather than of modalStack, which
   can be left holding a sheet whose element is already gone. One on its
   way out does not count. */
function sheetIsOpen() {
  const list = document.querySelectorAll('#modals .veil');
  for (let i = 0; i < list.length; i++) if (!list[i].dataset.closing) return true;
  return false;
}

/* ---------- haptics ---------- */
function buzz(pattern) {
  try {
    if (!SAVE || !SAVE.settings.haptics) return;
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) { /* unsupported */ }
}

/* ---------- number formatting ---------- */
function fmt(n) {
  n = Math.round(n);
  return n >= 10000 ? n.toLocaleString('en-US') : String(n);
}
function fmtTime(ms) {
  if (ms <= 0) return '0:00';
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}
