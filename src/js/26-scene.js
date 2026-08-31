/* ============================================================
   26 — scenes. The room the pet lives in, the lane you walk up,
   the tray the board sits in. Drawn, never loaded.

   Everything takes a css-pixel box and paints inside it, so the
   same routine works for a 320px phone and a 520px tablet.
   ============================================================ */

/* ---------------- light: the house has a clock ---------------- */
/* Day / golden / dusk / night, blended, so the room drifts through
   the evening while you play instead of being one flat picture.   */
function dayPhase(h) {
  const hh = h === undefined ? new Date().getHours() + new Date().getMinutes() / 60 : h;
  if (hh < 5) return { k: 'night', t: 1 };
  if (hh < 8) return { k: 'dawn', t: (hh - 5) / 3 };
  if (hh < 16) return { k: 'day', t: 1 };
  if (hh < 19) return { k: 'gold', t: (hh - 16) / 3 };
  if (hh < 21) return { k: 'dusk', t: (hh - 19) / 2 };
  return { k: 'night', t: 1 };
}
const SKY = {
  night: ['#1B2540', '#0E1526', '#2A3557'],
  dawn: ['#F5C9A8', '#E9A48E', '#FBE3C6'],
  day: ['#A9D8F0', '#7FBBE4', '#E4F3FC'],
  gold: ['#F7C978', '#EE9A5C', '#FCE7BE'],
  dusk: ['#8E7BB4', '#C97E86', '#F0C39E']
};
function skyColours(ph) { return SKY[ph.k] || SKY.day; }

/* warm lamp tint that grows as the day ends */
function lampStrength(ph) {
  if (ph.k === 'night') return 1;
  if (ph.k === 'dusk') return .55 + ph.t * .4;
  if (ph.k === 'gold') return .18 + ph.t * .3;
  if (ph.k === 'dawn') return .5 - ph.t * .35;
  return .06;
}

/* Keep the window and the room agreeing with each other: a dark
   theme is always evening, a light theme is always daytime. */
function roomPhase(dark, h) {
  const ph = dayPhase(h);
  const late = ph.k === 'night' || ph.k === 'dusk';
  if (dark) return late ? ph : { k: 'dusk', t: .85 };
  return late ? { k: 'gold', t: .45 } : ph;
}

/* ---------------- the room ---------------- */
/* o = { t, pet, rig, theme, placed[], phase, mood, floorRatio } */
function drawRoom(c, W, H, o) {
  o = o || {};
  const th = ROOM_THEMES.find(x => x.id === (o.theme || 'oat')) || ROOM_THEMES[0];
  const ph = o.phase || roomPhase(PAL.dark);
  const lamp = lampStrength(ph);
  const floorY = H * (o.floorRatio || .62);
  const t = o.t || 0;

  /* after dark the whole room is graded towards the blue the
     window is letting in — otherwise it reads as noon in a dark app */
  const night = PAL.dark;
  const wallA = night ? mix(th.wall, '#26334C', .58) : shade(th.wall, .07);
  const wallB = night ? mix(th.wall2, '#1A2438', .64) : th.wall2;
  const floorC = night ? mix(th.floor, '#232C40', .46) : th.floor;

  c.save();
  c.beginPath(); c.rect(0, 0, W, H); c.clip();

  /* ---- wall ---- */
  const wg = c.createLinearGradient(0, 0, 0, floorY);
  wg.addColorStop(0, wallA);
  wg.addColorStop(1, wallB);
  c.fillStyle = wg;
  c.fillRect(0, 0, W, floorY + 1);

  /* wallpaper: a faint vertical stripe with a repeating sprig */
  c.save();
  c.globalAlpha = PAL.dark ? .10 : .16;
  c.fillStyle = shade(wallB, -.2);
  const stripe = W / 11;
  for (let x = stripe * .5; x < W; x += stripe * 2) c.fillRect(x, 0, stripe, floorY);
  c.globalAlpha = PAL.dark ? .12 : .2;
  c.strokeStyle = shade(wallB, -.3);
  c.lineWidth = 1.2; c.lineCap = 'round';
  for (let x = stripe; x < W; x += stripe * 2) {
    for (let y = stripe * .9; y < floorY; y += stripe * 1.7) {
      c.beginPath();
      c.moveTo(x, y + stripe * .3); c.lineTo(x, y - stripe * .3);
      c.moveTo(x, y - stripe * .12); c.lineTo(x - stripe * .2, y - stripe * .3);
      c.moveTo(x, y - stripe * .12); c.lineTo(x + stripe * .2, y - stripe * .3);
      c.stroke();
    }
  }
  c.restore();

  /* ---- window with the sky in it ---- */
  const winW = W * .30, winH = H * .30, winX = W * .43, winY = H * .09;
  drawWindow(c, winX, winY, winW, winH, ph, t);

  /* light spilling from the window onto the floor */
  if (ph.k !== 'night') {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const shaft = c.createLinearGradient(winX, winY + winH, winX + winW * 1.6, floorY + H * .2);
    const sc = skyColours(ph);
    shaft.addColorStop(0, rgba(sc[2], PAL.dark ? .16 : .34));
    shaft.addColorStop(1, rgba(sc[2], 0));
    c.fillStyle = shaft;
    c.beginPath();
    c.moveTo(winX, winY + winH);
    c.lineTo(winX + winW, winY + winH);
    c.lineTo(winX + winW * 1.85, H);
    c.lineTo(winX - winW * .35, H);
    c.closePath(); c.fill();
    c.restore();
  }

  /* ---- picture rail + skirting ---- */
  const rail = shade(wallA, night ? .12 : -.14);
  c.fillStyle = rail;
  c.fillRect(0, floorY - H * .015, W, H * .015);
  c.fillStyle = rgba('#000000', .12);
  c.fillRect(0, floorY - H * .004, W, H * .004);

  /* ---- floor ---- */
  const fg = c.createLinearGradient(0, floorY, 0, H);
  fg.addColorStop(0, shade(floorC, -.10));
  fg.addColorStop(.35, floorC);
  fg.addColorStop(1, shade(floorC, night ? -.3 : .1));
  c.fillStyle = fg;
  c.fillRect(0, floorY, W, H - floorY);

  /* planks fanning towards the viewer */
  c.save();
  c.beginPath(); c.rect(0, floorY, W, H - floorY); c.clip();
  const vpX = W * .5;
  c.strokeStyle = rgba('#3A2614', PAL.dark ? .34 : .20);
  c.lineWidth = 1.1;
  for (let i = -6; i <= 6; i++) {
    const x = W * .5 + i * W * .14;
    c.beginPath();
    c.moveTo(lerp(vpX, x, .55), floorY);
    c.lineTo(lerp(vpX, x, 2.2), H);
    c.stroke();
  }
  /* cross seams get closer together towards the wall */
  c.strokeStyle = rgba('#3A2614', PAL.dark ? .22 : .13);
  for (let i = 1; i <= 5; i++) {
    const y = floorY + (H - floorY) * Math.pow(i / 5, 1.8);
    c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
  }
  /* grain */
  c.strokeStyle = rgba('#3A2614', .06);
  c.lineWidth = .8;
  for (let i = 0; i < 26; i++) {
    const y = floorY + ((i * 37) % 100) / 100 * (H - floorY);
    const x = ((i * 61) % 100) / 100 * W;
    c.beginPath();
    c.moveTo(x, y); c.quadraticCurveTo(x + W * .08, y + 2, x + W * .16, y);
    c.stroke();
  }
  c.restore();

  /* ---- furniture, back to front ---- */
  const placed = o.placed || [];
  const has = id => placed.indexOf(id) >= 0;
  if (has('shelf')) drawShelf(c, W * .84, floorY - H * .30, W * .24);
  if (has('poster')) drawPoster(c, W * .16, floorY - H * .34, W * .16, o.pet);
  /* the feeder hangs against the window frame, not in mid-air */
  if (has('window')) drawFeeder(c, winX + winW * .04, winY + winH * .62, winW * .28, t);
  if (has('rug')) drawRug(c, W * .5, floorY + (H - floorY) * .55, W * .58, (H - floorY) * .52, { wall2: wallB });
  if (has('plant')) drawFern(c, W * .10, floorY + (H - floorY) * .28, H * .17, t);
  if (has('basket')) drawBasket(c, W * .35, floorY + (H - floorY) * .30, W * .13);
  if (has('tower')) drawTower(c, W * .78, floorY + (H - floorY) * .62, W * .21, H * .32);
  if (has('lamp')) drawLamp(c, W * .95, floorY + (H - floorY) * .34, H * .32, lamp, t);

  /* ---- the pet ---- */
  if (o.pet) {
    const s = H * .17;
    const px = W * .5, py = floorY + (H - floorY) * .46;
    drawPetLive(c, o.pet, px, py, s, o.rig, o);
  }

  /* ---- lamp warmth over everything ---- */
  if (lamp > .1) {
    c.save();
    c.globalCompositeOperation = 'soft-light';
    const wl = c.createRadialGradient(W * .82, floorY - H * .05, 0, W * .82, floorY - H * .05, W * .95);
    wl.addColorStop(0, rgba('#FFC46B', .5 * lamp));
    wl.addColorStop(1, rgba('#FFC46B', 0));
    c.fillStyle = wl;
    c.fillRect(0, 0, W, H);
    c.restore();
  }

  /* ---- vignette ---- */
  const vg = c.createRadialGradient(W * .5, H * .45, Math.min(W, H) * .25, W * .5, H * .5, Math.max(W, H) * .78);
  vg.addColorStop(0, rgba('#000000', 0));
  vg.addColorStop(1, rgba('#000000', PAL.dark ? .42 : .18));
  c.fillStyle = vg;
  c.fillRect(0, 0, W, H);

  c.restore();
  return { floorY };
}

/* ---------------- window ---------------- */
function drawWindow(c, x, y, w, h, ph, t) {
  const sc = skyColours(ph);
  c.save();
  /* recess */
  c.fillStyle = rgba('#000000', .16);
  rr(c, x - w * .05, y - h * .04, w * 1.1, h * 1.12, w * .06); c.fill();
  /* sky */
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, sc[0]); g.addColorStop(.62, sc[1]); g.addColorStop(1, sc[2]);
  c.fillStyle = g;
  rr(c, x, y, w, h, w * .04); c.fill();

  c.save();
  rr(c, x, y, w, h, w * .04); c.clip();

  if (ph.k === 'night') {
    /* stars and a moon */
    c.fillStyle = rgba('#FFFFFF', .9);
    for (let i = 0; i < 14; i++) {
      const sx = x + ((i * 53) % 100) / 100 * w;
      const sy = y + ((i * 29) % 70) / 100 * h;
      const tw = .45 + .55 * Math.abs(Math.sin(t * 1.6 + i));
      c.globalAlpha = tw * .9;
      c.beginPath(); c.arc(sx, sy, .9 + (i % 3) * .5, 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1;
    c.fillStyle = '#F6EFD8';
    c.beginPath(); c.arc(x + w * .72, y + h * .26, w * .11, 0, 6.2832); c.fill();
    c.fillStyle = sc[0];
    c.beginPath(); c.arc(x + w * .66, y + h * .21, w * .10, 0, 6.2832); c.fill();
  } else {
    /* sun glow + clouds that drift */
    const sunY = ph.k === 'gold' || ph.k === 'dusk' ? y + h * .62 : y + h * .22;
    const sg = c.createRadialGradient(x + w * .70, sunY, 0, x + w * .70, sunY, w * .5);
    sg.addColorStop(0, rgba('#FFF6D8', .95));
    sg.addColorStop(.4, rgba('#FFE0A0', .45));
    sg.addColorStop(1, rgba('#FFE0A0', 0));
    c.fillStyle = sg;
    c.fillRect(x, y, w, h);
    c.fillStyle = rgba('#FFFFFF', ph.k === 'day' ? .8 : .5);
    for (let i = 0; i < 3; i++) {
      const drift = ((t * (5 + i * 3) + i * 140) % (w + 120)) - 60;
      const cx = x + drift, cy = y + h * (.22 + i * .22);
      const s = w * (.16 + i * .04);
      ellipse(c, cx, cy, s, s * .42); c.fill();
      ellipse(c, cx + s * .5, cy + s * .06, s * .6, s * .3); c.fill();
      ellipse(c, cx - s * .5, cy + s * .08, s * .5, s * .26); c.fill();
    }
    /* rooftops across the lane */
    c.fillStyle = rgba(PAL.dark ? '#22304A' : '#8E7A63', .55);
    c.beginPath();
    c.moveTo(x, y + h);
    let hx = x;
    while (hx < x + w) {
      const hw = w * .22, hh = h * (.14 + ((hx * 7) % 5) / 40);
      c.lineTo(hx, y + h - hh);
      c.lineTo(hx + hw * .5, y + h - hh - h * .07);
      c.lineTo(hx + hw, y + h - hh);
      hx += hw;
    }
    c.lineTo(x + w, y + h);
    c.closePath(); c.fill();
  }
  c.restore();

  /* glass sheen */
  c.save();
  rr(c, x, y, w, h, w * .04); c.clip();
  const sh = c.createLinearGradient(x, y, x + w, y + h);
  sh.addColorStop(0, rgba('#FFFFFF', .3));
  sh.addColorStop(.35, rgba('#FFFFFF', .04));
  sh.addColorStop(1, rgba('#FFFFFF', 0));
  c.fillStyle = sh;
  c.beginPath();
  c.moveTo(x, y); c.lineTo(x + w * .55, y); c.lineTo(x, y + h * .8); c.closePath(); c.fill();
  c.restore();

  /* frame */
  c.strokeStyle = PAL.dark ? '#3E4A5C' : '#F3EAD9';
  c.lineWidth = Math.max(3, w * .045);
  rr(c, x, y, w, h, w * .04); c.stroke();
  c.beginPath();
  c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h);
  c.moveTo(x, y + h * .48); c.lineTo(x + w, y + h * .48);
  c.stroke();
  /* sill */
  c.fillStyle = PAL.dark ? '#46536A' : '#EFE2CC';
  rr(c, x - w * .07, y + h, w * 1.14, h * .07, h * .02); c.fill();
  c.restore();
}

/* ---------------- furniture ---------------- */
function drawRug(c, cx, cy, w, h, th) {
  c.save();
  c.fillStyle = rgba('#000000', .12);
  ellipse(c, cx, cy + h * .04, w / 2, h / 2); c.fill();
  const base = mix(th.wall2, '#C56A55', .55);
  ellipse(c, cx, cy, w / 2, h / 2); c.fillStyle = base; c.fill();
  const rings = [[.82, .28], [.62, .0], [.42, .3], [.22, .0]];
  rings.forEach((r, i) => {
    c.fillStyle = i % 2 ? shade(base, .22) : shade(base, -.16);
    ellipse(c, cx, cy, w / 2 * r[0], h / 2 * r[0]); c.fill();
  });
  /* woven texture */
  c.save();
  ellipse(c, cx, cy, w / 2, h / 2); c.clip();
  c.strokeStyle = rgba('#000000', .06); c.lineWidth = 1;
  /* the spokes start away from the middle — meeting at a point stacks
     46 strokes on one pixel and reads as a drain in the floor */
  for (let a = 0; a < 46; a++) {
    const ang = a / 46 * 6.2832;
    const inner = .30 + (a % 3) * .06;
    c.beginPath();
    c.moveTo(cx + Math.cos(ang) * w / 2 * inner, cy + Math.sin(ang) * h / 2 * inner);
    c.lineTo(cx + Math.cos(ang) * w, cy + Math.sin(ang) * h);
    c.stroke();
  }
  /* a small woven medallion where the spokes would have met */
  c.fillStyle = rgba('#000000', .05);
  ellipse(c, cx, cy, w * .07, h * .07); c.fill();
  c.restore();
  /* fringe */
  c.strokeStyle = rgba(shade(base, .3), .75);
  c.lineWidth = 1.4; c.lineCap = 'round';
  for (let a = 0; a < 64; a++) {
    const ang = a / 64 * 6.2832;
    const x1 = cx + Math.cos(ang) * w / 2 * .985, y1 = cy + Math.sin(ang) * h / 2 * .985;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x1 + Math.cos(ang) * w * .013, y1 + Math.sin(ang) * h * .022);
    c.stroke();
  }
  c.restore();
}

function drawFern(c, x, y, s, t) {
  c.save();
  c.translate(x, y);
  /* pot */
  c.fillStyle = rgba('#000000', .16);
  ellipse(c, 0, s * .04, s * .30, s * .08); c.fill();
  const pg = c.createLinearGradient(-s * .3, 0, s * .3, 0);
  pg.addColorStop(0, '#B9714F'); pg.addColorStop(.5, '#D8895F'); pg.addColorStop(1, '#9C5C3E');
  c.fillStyle = pg;
  c.beginPath();
  c.moveTo(-s * .28, -s * .30); c.lineTo(s * .28, -s * .30);
  c.lineTo(s * .21, s * .02); c.lineTo(-s * .21, s * .02); c.closePath(); c.fill();
  c.fillStyle = '#C97C58';
  rr(c, -s * .31, -s * .36, s * .62, s * .10, s * .03); c.fill();
  c.fillStyle = rgba('#3A2010', .25);
  ellipse(c, 0, -s * .34, s * .27, s * .05); c.fill();
  /* fronds */
  const sway = Math.sin(t * .9) * .05;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * .30 + sway * (1 + Math.abs(i - 4) * .3);
    const len = s * (.62 + (i % 3) * .12);
    c.save();
    c.translate(0, -s * .34);
    c.rotate(a + Math.PI / 2);
    c.strokeStyle = '#3E7A52'; c.lineWidth = s * .022; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * .2, -len * .5, len * .1, -len); c.stroke();
    c.fillStyle = i % 2 ? '#4E9163' : '#3E7A52';
    for (let k = 1; k <= 7; k++) {
      const p = k / 8;
      const px = lerp(0, len * .1, p) + Math.sin(p * 3) * len * .09;
      const py = -len * p;
      const lw = len * .13 * (1 - p * .55);
      [-1, 1].forEach(sx => {
        c.save(); c.translate(px, py); c.rotate(sx * .9 + p * .4 * sx);
        ellipse(c, sx * lw * .7, 0, lw, lw * .42); c.fill();
        c.restore();
      });
    }
    c.restore();
  }
  c.restore();
}

function drawShelf(c, cx, y, w) {
  const h = w * .05;
  c.save();
  /* the shadow it throws down the wall */
  const wsh = c.createLinearGradient(0, y + h, 0, y + h * 4.5);
  wsh.addColorStop(0, rgba('#2A1E12', .22));
  wsh.addColorStop(1, rgba('#2A1E12', 0));
  c.fillStyle = wsh;
  c.fillRect(cx - w / 2, y + h, w, h * 3.5);
  c.fillStyle = rgba('#000000', .18);
  rr(c, cx - w / 2, y + h, w * .94, h * .7, h * .3); c.fill();
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#C79A62'); g.addColorStop(1, '#8E6839');
  c.fillStyle = g;
  rr(c, cx - w / 2, y, w, h, h * .35); c.fill();
  /* brackets */
  c.fillStyle = '#7B5730';
  [-.36, .36].forEach(k => {
    c.beginPath();
    c.moveTo(cx + w * k, y + h); c.lineTo(cx + w * k + w * .05, y + h);
    c.lineTo(cx + w * k, y + h + w * .09); c.closePath(); c.fill();
  });
  /* three things and a cat-shaped gap */
  c.fillStyle = '#8FB4C8'; rr(c, cx - w * .40, y - w * .16, w * .07, w * .16, w * .012); c.fill();
  c.fillStyle = '#D2536A'; rr(c, cx - w * .31, y - w * .19, w * .06, w * .19, w * .012); c.fill();
  c.fillStyle = '#E0A73C'; rr(c, cx - w * .23, y - w * .13, w * .07, w * .13, w * .012); c.fill();
  c.fillStyle = '#7FBFA3';
  ellipse(c, cx + w * .28, y - w * .07, w * .08, w * .07); c.fill();
  c.fillStyle = '#5E9B80';
  rr(c, cx + w * .21, y - w * .01, w * .14, w * .02, w * .01); c.fill();
  c.restore();
}

function drawPoster(c, cx, cy, w, pet) {
  const h = w * 1.22;
  c.save();
  const psh = c.createLinearGradient(cx, cy - h / 2, cx + w * .5, cy + h * .7);
  psh.addColorStop(0, rgba('#2A1E12', .26));
  psh.addColorStop(1, rgba('#2A1E12', 0));
  c.fillStyle = psh;
  rr(c, cx - w / 2 + w * .05, cy - h / 2 + w * .06, w, h, w * .04); c.fill();
  c.fillStyle = rgba('#000000', .16);
  rr(c, cx - w / 2 + 2, cy - h / 2 + 3, w, h, w * .04); c.fill();
  c.fillStyle = PAL.dark ? '#3B3020' : '#8A6A46';
  rr(c, cx - w / 2, cy - h / 2, w, h, w * .04); c.fill();
  c.fillStyle = PAL.dark ? '#E9DFCB' : '#FBF4E6';
  rr(c, cx - w / 2 + w * .07, cy - h / 2 + w * .07, w * .86, h - w * .14, w * .02); c.fill();
  /* a very good dog, painted badly */
  c.save();
  c.translate(cx, cy);
  const s = w * .5;
  c.fillStyle = pet ? petCoat(pet).fur : '#C98B4E';
  ellipse(c, 0, s * .18, s * .42, s * .34); c.fill();
  ellipse(c, 0, -s * .28, s * .30, s * .27); c.fill();
  c.fillStyle = pet ? petCoat(pet).fur2 : '#9A6532';
  ellipse(c, -s * .28, -s * .34, s * .11, s * .18, -.4); c.fill();
  ellipse(c, s * .28, -s * .34, s * .11, s * .18, .4); c.fill();
  c.fillStyle = '#2B231A';
  ellipse(c, -s * .11, -s * .30, s * .04, s * .05); c.fill();
  ellipse(c, s * .11, -s * .30, s * .04, s * .05); c.fill();
  ellipse(c, 0, -s * .18, s * .05, s * .04); c.fill();
  c.restore();
  c.restore();
}

function drawLamp(c, x, y, s, warmth, t) {
  c.save();
  c.translate(x, y);
  /* base */
  c.fillStyle = rgba('#000000', .18);
  ellipse(c, 0, s * .02, s * .17, s * .045); c.fill();
  c.fillStyle = '#7C6A56';
  ellipse(c, 0, 0, s * .15, s * .04); c.fill();
  c.strokeStyle = '#8E7A63'; c.lineWidth = s * .035; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -s * .72); c.stroke();
  /* shade */
  const sg = c.createLinearGradient(-s * .26, 0, s * .26, 0);
  sg.addColorStop(0, mix('#F0DCB4', '#FFF3D2', .2));
  sg.addColorStop(.5, '#FFF6DE');
  sg.addColorStop(1, '#E4CDA2');
  c.fillStyle = sg;
  c.beginPath();
  c.moveTo(-s * .27, -s * .72); c.lineTo(s * .27, -s * .72);
  c.lineTo(s * .19, -s * .98); c.lineTo(-s * .19, -s * .98); c.closePath(); c.fill();
  c.strokeStyle = rgba('#A98A5C', .5); c.lineWidth = s * .012;
  c.stroke();
  /* the glow it throws */
  if (warmth > .05) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const flick = 1 + Math.sin(t * 7.3) * .012 + Math.sin(t * 3.1) * .01;
    const g = c.createRadialGradient(0, -s * .74, 0, 0, -s * .74, s * 1.5 * flick);
    g.addColorStop(0, rgba('#FFD489', .55 * warmth));
    g.addColorStop(.35, rgba('#FFB65B', .22 * warmth));
    g.addColorStop(1, rgba('#FFB65B', 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(0, -s * .74, s * 1.5, 0, 6.2832); c.fill();
    /* cone of light down the wall */
    const cone = c.createLinearGradient(0, -s * .7, 0, s * .1);
    cone.addColorStop(0, rgba('#FFCE84', .3 * warmth));
    cone.addColorStop(1, rgba('#FFCE84', 0));
    c.fillStyle = cone;
    c.beginPath();
    c.moveTo(-s * .2, -s * .72); c.lineTo(s * .2, -s * .72);
    c.lineTo(s * .6, s * .1); c.lineTo(-s * .6, s * .1); c.closePath(); c.fill();
    c.restore();
  }
  c.restore();
}

function drawTower(c, x, y, w, h) {
  c.save();
  c.translate(x, y);
  c.fillStyle = rgba('#000000', .18);
  ellipse(c, 0, h * .02, w * .58, h * .05); c.fill();
  /* base */
  c.fillStyle = '#C9B89C';
  rr(c, -w * .55, -h * .10, w * 1.1, h * .12, w * .06); c.fill();
  /* post wrapped in sisal */
  c.fillStyle = '#C89A5E';
  c.fillRect(-w * .13, -h * .74, w * .26, h * .66);
  c.strokeStyle = rgba('#8A6236', .55); c.lineWidth = Math.max(1, h * .008);
  for (let i = 0; i < 22; i++) {
    const yy = -h * .73 + i * h * .03;
    c.beginPath(); c.moveTo(-w * .13, yy); c.lineTo(w * .13, yy + h * .012); c.stroke();
  }
  /* platform */
  c.fillStyle = '#D9C7A9';
  rr(c, -w * .48, -h * .84, w * .96, h * .11, w * .07); c.fill();
  c.fillStyle = rgba('#8A7355', .35);
  rr(c, -w * .48, -h * .76, w * .96, h * .03, w * .015); c.fill();
  /* little cushion */
  c.fillStyle = '#C97E86';
  ellipse(c, 0, -h * .87, w * .30, h * .05); c.fill();
  c.restore();
}

function drawFeeder(c, x, y, s, t) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = rgba(PAL.dark ? '#8494AA' : '#7B6448', .8);
  c.lineWidth = Math.max(1.4, s * .05);
  c.beginPath(); c.moveTo(0, -s * .1); c.lineTo(0, s * .5); c.stroke();
  /* roof */
  c.fillStyle = '#A97B4C';
  c.beginPath();
  c.moveTo(-s * .5, s * .62); c.lineTo(0, s * .38); c.lineTo(s * .5, s * .62); c.closePath(); c.fill();
  /* tray */
  c.fillStyle = '#C79A62';
  rr(c, -s * .42, s * .62, s * .84, s * .12, s * .04); c.fill();
  /* seed */
  c.fillStyle = '#8A6236';
  for (let i = 0; i < 6; i++) { ellipse(c, -s * .3 + i * s * .12, s * .63, s * .04, s * .03); c.fill(); }
  /* a bird, sometimes */
  const cycle = (t % 14) / 14;
  if (cycle < .3) {
    const hop = Math.abs(Math.sin(cycle * 40)) * s * .06;
    c.save();
    c.translate(s * .22, s * .58 - hop);
    c.fillStyle = '#6E8FB8';
    ellipse(c, 0, 0, s * .13, s * .10); c.fill();
    ellipse(c, -s * .10, -s * .06, s * .07, s * .06); c.fill();
    c.fillStyle = '#E0A73C';
    c.beginPath();
    c.moveTo(-s * .16, -s * .06); c.lineTo(-s * .24, -s * .04); c.lineTo(-s * .16, -s * .02); c.closePath(); c.fill();
    c.fillStyle = '#1E1A22';
    ellipse(c, -s * .12, -s * .08, s * .015, s * .015); c.fill();
    c.restore();
  }
  c.restore();
}

function drawBasket(c, x, y, w) {
  const h = w * .68;
  c.save();
  c.translate(x, y);
  c.fillStyle = rgba('#000000', .16);
  ellipse(c, 0, h * .04, w * .52, h * .1); c.fill();
  c.fillStyle = '#C79A62';
  c.beginPath();
  c.moveTo(-w * .5, -h * .6); c.lineTo(w * .5, -h * .6);
  c.lineTo(w * .38, h * .02); c.lineTo(-w * .38, h * .02); c.closePath(); c.fill();
  c.strokeStyle = rgba('#7B5730', .45); c.lineWidth = Math.max(1, w * .022);
  for (let i = 1; i < 4; i++) {
    const yy = -h * .6 + i * h * .155;
    const k = i / 4;
    c.beginPath(); c.moveTo(-w * (.5 - k * .12), yy); c.lineTo(w * (.5 - k * .12), yy); c.stroke();
  }
  c.fillStyle = '#B98B54';
  rr(c, -w * .55, -h * .68, w * 1.1, h * .12, h * .05); c.fill();
  /* toys spilling out */
  c.fillStyle = '#C8D95A'; ellipse(c, -w * .18, -h * .74, w * .13, w * .13); c.fill();
  c.fillStyle = '#E8798A'; ellipse(c, w * .14, -h * .78, w * .15, w * .15); c.fill();
  c.strokeStyle = '#E8798A'; c.lineWidth = w * .035;
  c.beginPath(); c.moveTo(w * .26, -h * .72); c.quadraticCurveTo(w * .48, -h * .6, w * .38, -h * .38); c.stroke();
  c.restore();
}

/* ============================================================
   The pet, alive.
   A rig holds the slow state — breath, blink, tail, gaze — so the
   room can animate it every frame without the caller keeping
   twenty variables. rigStep() is where the personality lives.
   ============================================================ */
const RIGS = new Map();
function petRig(p) {
  const id = p ? p.id : '_';
  let r = RIGS.get(id);
  if (!r) {
    r = {
      t: 0, breath: 0, blink: 0, blinkAt: rnd(1.5, 4), blinkT: -1,
      earT: rnd(3, 9), ear: 0, tail: 0, tailV: 0,
      gaze: [0, 0], gazeTarget: [0, 0], gazeAt: rnd(1, 3),
      hop: mkSpring(0), jig: mkJiggle(), lean: mkSpring(0),
      mouth: 'smile', sleepT: 0, purrT: 0, step: 0
    };
    RIGS.set(id, r);
  }
  return r;
}
function rigStep(r, dt, o) {
  o = o || {};
  r.dt = dt;
  r.t += dt;
  const mood = o.mood || 'content';
  const asleep = mood === 'sleeping';

  /* breath — slower and deeper asleep */
  const rate = asleep ? 1.0 : mood === 'tired' ? 1.5 : mood === 'happy' ? 2.7 : 2.1;
  r.breath = Math.sin(r.t * rate) * (asleep ? 1.35 : 1);

  /* blink: a quick close, occasionally a double */
  if (!asleep) {
    r.blinkAt -= dt;
    if (r.blinkAt <= 0 && r.blinkT < 0) { r.blinkT = 0; r.blinkAt = rnd(2.2, 6.5); }
    if (r.blinkT >= 0) {
      r.blinkT += dt;
      const d = .16;
      r.blink = r.blinkT < d * .4 ? r.blinkT / (d * .4) : 1 - (r.blinkT - d * .4) / (d * .6);
      if (r.blinkT > d) { r.blinkT = -1; r.blink = 0; if (Math.random() < .22) r.blinkAt = .12; }
    }
    if (mood === 'tired') r.blink = Math.max(r.blink, .45 + Math.sin(r.t * .8) * .12);
  } else r.blink = 1;

  /* ear flick */
  r.earT -= dt;
  if (r.earT <= 0) { r.earT = rnd(3.5, 11); springKick(r.hop, 0); r.ear = 1; }
  r.ear = Math.max(0, r.ear - dt * 3.4);

  /* tail: a lazy pendulum, faster when happy, still when asleep */
  const tailDrive = asleep ? 0 : (mood === 'happy' ? 1.0 : mood === 'bored' ? .25 : .55);
  r.tailV += (Math.sin(r.t * (asleep ? .5 : 1.5)) * tailDrive - r.tail) * 26 * dt;
  r.tailV *= Math.pow(.5, dt / .18);
  r.tail += r.tailV * dt;

  /* gaze wanders, or follows the pointer when it is nearby */
  r.gazeAt -= dt;
  if (o.look) { r.gazeTarget[0] = clamp(o.look[0], -1, 1); r.gazeTarget[1] = clamp(o.look[1], -1, 1); r.gazeAt = 1.2; }
  else if (r.gazeAt <= 0) {
    r.gazeAt = rnd(1.4, 4.2);
    r.gazeTarget[0] = asleep ? 0 : rnd(-.8, .8);
    r.gazeTarget[1] = asleep ? 0 : rnd(-.5, .6);
  }
  r.gaze[0] = smooth(r.gaze[0], r.gazeTarget[0], .09, dt);
  r.gaze[1] = smooth(r.gaze[1], r.gazeTarget[1], .09, dt);

  springStep(r.hop, 0, 260, 14, dt);
  springStep(r.lean, 0, 180, 13, dt);
  jiggleStep(r.jig, 0, dt);

  if (asleep) r.sleepT += dt;
  if (r.purrT > 0) r.purrT -= dt;
  return r;
}

/* full-body draw with the rig applied */
function drawPetLive(c, p, x, y, s, rig, o) {
  o = o || {};
  const r = rig || petRig(p);
  const spec = specOfPet(p);
  const mood = o.mood || moodOf(p);
  const asleep = mood === 'sleeping';
  const wob = r.jig.b.p * .012;

  c.save();
  c.translate(x, y + r.hop.p);

  /* contact shadow tightens as it lifts */
  const lift = clamp(-r.hop.p / (s * .3), 0, 1);
  c.fillStyle = rgba('#2A1E12', (PAL.dark ? .34 : .2) * (1 - lift * .45));
  ellipse(c, 0, s * .94, s * (.54 - lift * .06), s * (.11 - lift * .02)); c.fill();

  c.save();
  c.rotate(r.lean.p * .04 + wob);
  if (asleep) {
    /* curled up: squash the whole body and drop the head */
    c.translate(0, s * .12);
    c.scale(1.1, .86);
  }
  drawBody(c, spec, s, {
    breath: r.breath * (asleep ? 1.6 : 1),
    tail: r.tail,
    blink: r.blink,
    eyeDir: r.gaze,
    headTilt: (mood === 'bored' ? .12 : 0) + r.jig.b.p * .01,
    mouth: (mood === 'happy' && !asleep) ? 'open' : 'smile',
    shadow: false
  });
  /* ear flick rides on top */
  if (r.ear > .01 && !asleep) {
    c.save();
    c.translate(0, s * .02);
    c.globalAlpha = r.ear;
    c.rotate(Math.sin(r.t * 40) * .05 * r.ear);
    c.globalAlpha = 1;
    c.restore();
  }
  c.restore();

  /* mood ornaments */
  if (asleep) drawZs(c, s * .42, -s * .42, s * .3, r.sleepT);
  else if (mood === 'hungry') drawThought(c, s * .5, -s * .5, s * .26, 'bowl');
  else if (mood === 'dirty') drawGrime(c, s, r.t, spec);
  else if (mood === 'bored') drawThought(c, s * .5, -s * .5, s * .26, 'ball');
  else if (mood === 'happy') {
    /* an edge, not a level: see the note in 50-room.js — the same line
       written as a threshold fires on every frame it is true for */
    r.heartT = (r.heartT === undefined ? 2 : r.heartT) - (r.dt || 1 / 60);
    if (r.heartT <= 0) { r.heartT = rnd(2.4, 4.6); FXHeartsAt(x, y - s * .3); }
  }

  c.restore();
  return { x, y, s };
}
function FXHeartsAt(x, y) { if (typeof FX !== 'undefined') FX.hearts(x, y, 1); }

function drawZs(c, x, y, s, t) {
  c.save();
  c.fillStyle = rgba(PAL.text, .55);
  c.font = `800 ${s}px "Grandstander",sans-serif`;
  c.textAlign = 'center';
  for (let i = 0; i < 3; i++) {
    const k = ((t * .5 + i / 3) % 1);
    c.globalAlpha = (1 - k) * .75;
    c.font = `800 ${s * (.6 + k * .7)}px "Grandstander",sans-serif`;
    c.fillText('z', x + k * s * .8, y - k * s * 1.6);
  }
  c.restore();
}
function drawThought(c, x, y, s, what) {
  c.save();
  c.fillStyle = rgba(PAL.surface, .95);
  c.strokeStyle = rgba(PAL.line, .9);
  c.lineWidth = Math.max(1, s * .06);
  ellipse(c, x, y, s, s * .8); c.fill(); c.stroke();
  ellipse(c, x - s * .8, y + s * .7, s * .22, s * .18); c.fill(); c.stroke();
  ellipse(c, x - s * 1.05, y + s * .95, s * .12, s * .1); c.fill(); c.stroke();
  c.save();
  c.translate(x, y);
  c.fillStyle = PAL.textDim;
  if (what === 'bowl') {
    c.beginPath();
    c.moveTo(-s * .42, -s * .06); c.lineTo(s * .42, -s * .06);
    c.quadraticCurveTo(s * .3, s * .38, 0, s * .38);
    c.quadraticCurveTo(-s * .3, s * .38, -s * .42, -s * .06);
    c.fill();
    c.fillStyle = PAL.accent;
    ellipse(c, 0, -s * .08, s * .42, s * .1); c.fill();
  } else if (what === 'heart') {
    /* wanting company, which is not the same as wanting a toy */
    drawPip(c, 'heart', 0, s * .04, s * .38, PAL.rose);
  } else {
    c.fillStyle = '#C8D95A'; ellipse(c, 0, s * .06, s * .34, s * .34); c.fill();
    c.strokeStyle = '#F6F1E4'; c.lineWidth = s * .07;
    c.beginPath(); c.arc(-s * .32, s * .06, s * .38, -.9, .9); c.stroke();
  }
  c.restore();
  c.restore();
}
/* A dirty animal has to look dirty on its own coat.

   Brown at a third opacity is a smudge on a cream retriever and is
   nothing at all on a black cat, which is exactly what shipped: sable
   coats went unwashed because the game had no way of saying so. The
   smudge takes the opposite side of the coat now, and the fly flies
   close enough to belong to the animal rather than to the wall. */
function drawGrime(c, s, t, spec) {
  const dk = spec ? darkCoat(spec) : false;
  c.save();
  c.fillStyle = dk ? rgba('#C9A46B', .5) : rgba('#6B4A2C', .38);
  [[-.22, .55], [.18, .68], [.3, .42], [-.3, .74]].forEach((p, i) => {
    const w = s * (.055 + (i % 3) * .018);
    ellipse(c, p[0] * s, p[1] * s, w, w * .7, i); c.fill();
  });
  /* a fly, doing laps close to the head */
  const a = t * 2.4;
  const fx = Math.cos(a) * s * .42, fy = -s * .34 + Math.sin(a * 1.7) * s * .09;
  c.fillStyle = rgba(PAL.text, .22);
  ellipse(c, fx, fy, s * .05, s * .04); c.fill();          /* its own little shadow of motion */
  c.fillStyle = rgba(PAL.text, .78);
  ellipse(c, fx, fy, s * .028, s * .021); c.fill();
  c.restore();
}

/* ============================================================
   The board tray — the thing the tiles live in.
   Cell beds are cached sprites: a squircle recess with felt
   texture, an inner shadow and a bounce light. Drawing that with
   paths on every cell of every frame is pure waste.
   ============================================================ */
const bedCache = new Map();
function cellSprite(px, odd) {
  const key = Math.round(px) + '|' + (odd ? 1 : 0) + '|' + (PAL.dark ? 'd' : 'l');
  let cv = bedCache.get(key);
  if (cv) return cv;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const W = Math.round(px) + 4;
  cv = document.createElement('canvas');
  cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr);
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.translate(W / 2, W / 2);
  const s = px;

  const base = odd ? PAL.boardCell : PAL.boardCell2;
  squircle(c, -s * .48, -s * .48, s * .96, s * .96, 4.2);
  c.fillStyle = base;
  c.fill();

  c.save();
  squircle(c, -s * .48, -s * .48, s * .96, s * .96, 4.2);
  c.clip();

  /* felt: a fine speckle, seeded so every cell of a size matches */
  const r = mulberry(odd ? 1337 : 4242);
  c.globalAlpha = PAL.dark ? .07 : .05;
  for (let i = 0; i < 60; i++) {
    c.fillStyle = r() > .5 ? '#FFFFFF' : '#000000';
    const x = (r() - .5) * s, y = (r() - .5) * s;
    c.fillRect(x, y, 1.1, 1.1);
  }
  c.globalAlpha = 1;

  /* recess: dark at the top, light bounce at the bottom */
  const top = c.createLinearGradient(0, -s * .5, 0, -s * .1);
  top.addColorStop(0, rgba('#000000', PAL.dark ? .34 : .14));
  top.addColorStop(1, rgba('#000000', 0));
  c.fillStyle = top;
  c.fillRect(-s * .5, -s * .5, s, s * .4);

  const bot = c.createLinearGradient(0, s * .18, 0, s * .5);
  bot.addColorStop(0, rgba('#FFFFFF', 0));
  bot.addColorStop(1, rgba('#FFFFFF', PAL.dark ? .06 : .28));
  c.fillStyle = bot;
  c.fillRect(-s * .5, s * .18, s, s * .32);
  c.restore();

  /* the lip of the recess */
  c.strokeStyle = rgba('#000000', PAL.dark ? .28 : .09);
  c.lineWidth = Math.max(.7, s * .018);
  squircle(c, -s * .47, -s * .47, s * .94, s * .94, 4.2);
  c.stroke();

  cv._w = W;
  bedCache.set(key, cv);
  return cv;
}
function clearBeds() { bedCache.clear(); }

function drawCellBed(c, cx, cy, s, cell, odd) {
  if (cell && cell.hole) return;
  const sp = cellSprite(s, odd);
  c.drawImage(sp, cx - sp._w / 2, cy - sp._w / 2, sp._w, sp._w);
}

/* the soft shadow a tile drops into its own cell */
function drawTileShadow(c, cx, cy, s, lift) {
  const k = clamp(lift === undefined ? 0 : lift, 0, 1);
  const r = s * (.40 + k * .16);
  c.save();
  c.globalAlpha = (PAL.dark ? .42 : .26) * (1 - k * .25);
  c.drawImage(blobBrush('#1B1207'),
    cx - r, cy - r * .62 + s * (.10 + k * .10), r * 2, r * 1.24);
  c.restore();
}

/* a hole in the board: you can see down into the dark */
const holeCache = new Map();
function holeSprite(px) {
  const key = Math.round(px) + (PAL.dark ? 'd' : 'l');
  let cv = holeCache.get(key);
  if (cv) return cv;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const W = Math.round(px) + 4;
  cv = document.createElement('canvas');
  cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr);
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.translate(W / 2, W / 2);
  const s = px;
  const g = c.createRadialGradient(0, -s * .08, s * .04, 0, 0, s * .52);
  g.addColorStop(0, rgba('#000000', PAL.dark ? .62 : .44));
  g.addColorStop(.72, rgba('#000000', PAL.dark ? .3 : .18));
  g.addColorStop(1, rgba('#000000', 0));
  c.fillStyle = g;
  c.beginPath(); c.arc(0, 0, s * .52, 0, 6.2832); c.fill();
  /* a glint on the far lip so it reads as an opening, not a stain */
  c.strokeStyle = rgba('#FFFFFF', PAL.dark ? .08 : .22);
  c.lineWidth = Math.max(.8, s * .02);
  c.beginPath(); c.arc(0, s * .02, s * .34, Math.PI * .15, Math.PI * .85);
  c.stroke();
  cv._w = W;
  holeCache.set(key, cv);
  return cv;
}
function drawHole(c, cx, cy, s) {
  const sp = holeSprite(s);
  c.drawImage(sp, cx - sp._w / 2, cy - sp._w / 2, sp._w, sp._w);
}

/* the frame around the whole board */
function drawTray(c, x, y, w, h, pad) {
  pad = pad === undefined ? Math.max(8, w * .028) : pad;
  const r = pad * 1.7;
  c.save();

  /* drop shadow */
  c.fillStyle = rgba('#2A1E12', PAL.dark ? .55 : .2);
  rr(c, x - pad, y - pad + pad * .5, w + pad * 2, h + pad * 2, r); c.fill();

  /* the frame, with a grain running along it */
  const g = c.createLinearGradient(x - pad, y - pad, x + w * .2, y + h + pad);
  if (PAL.dark) {
    g.addColorStop(0, '#3A4A5C'); g.addColorStop(.5, '#2A3746'); g.addColorStop(1, '#1C2836');
  } else {
    g.addColorStop(0, '#E2C9A2'); g.addColorStop(.5, '#CDA97C'); g.addColorStop(1, '#AE8A62');
  }
  c.fillStyle = g;
  rr(c, x - pad, y - pad, w + pad * 2, h + pad * 2, r); c.fill();

  c.save();
  rr(c, x - pad, y - pad, w + pad * 2, h + pad * 2, r); c.clip();
  c.strokeStyle = rgba('#3A2614', PAL.dark ? .22 : .16);
  c.lineWidth = Math.max(.6, pad * .1);
  for (let i = 0; i < 7; i++) {
    const yy = y - pad + (i + .5) * (h + pad * 2) / 7;
    c.beginPath();
    c.moveTo(x - pad, yy);
    c.quadraticCurveTo(x + w * .5, yy + (i % 2 ? pad * .3 : -pad * .3), x + w + pad, yy);
    c.stroke();
  }
  c.restore();

  /* top bevel and bottom shade */
  c.strokeStyle = rgba('#FFFFFF', PAL.dark ? .12 : .4);
  c.lineWidth = Math.max(1, pad * .26);
  c.beginPath();
  const rr2 = r - pad * .2;
  c.moveTo(x - pad * .8 + rr2, y - pad * .8);
  c.arcTo(x + w + pad * .8, y - pad * .8, x + w + pad * .8, y + h, rr2);
  c.stroke();
  c.strokeStyle = rgba('#000000', .18);
  c.beginPath();
  c.moveTo(x + w + pad * .8, y + h);
  c.arcTo(x + w + pad * .8, y + h + pad * .8, x, y + h + pad * .8, rr2);
  c.arcTo(x - pad * .8, y + h + pad * .8, x - pad * .8, y, rr2);
  c.stroke();

  /* four brass studs, because good boards have hardware */
  const studs = [[x - pad * .5, y - pad * .5], [x + w + pad * .5, y - pad * .5],
                 [x - pad * .5, y + h + pad * .5], [x + w + pad * .5, y + h + pad * .5]];
  studs.forEach(pt => {
    const sr = Math.max(2.6, pad * .34);
    const sg = c.createLinearGradient(pt[0], pt[1] - sr, pt[0], pt[1] + sr);
    sg.addColorStop(0, '#F0DCA8'); sg.addColorStop(1, '#9C7A3E');
    c.fillStyle = sg;
    c.beginPath(); c.arc(pt[0], pt[1], sr, 0, 6.2832); c.fill();
    c.fillStyle = rgba('#FFFFFF', .6);
    c.beginPath(); c.arc(pt[0] - sr * .28, pt[1] - sr * .3, sr * .3, 0, 6.2832); c.fill();
  });

  /* the well the tiles sit in */
  c.fillStyle = PAL.boardBg;
  rr(c, x, y, w, h, pad); c.fill();
  c.save();
  rr(c, x, y, w, h, pad); c.clip();
  const sh = c.createLinearGradient(0, y, 0, y + pad * 2.6);
  sh.addColorStop(0, rgba('#000000', PAL.dark ? .45 : .2));
  sh.addColorStop(1, rgba('#000000', 0));
  c.fillStyle = sh; c.fillRect(x, y, w, pad * 2.6);
  const sv = c.createLinearGradient(x, 0, x + pad * 2, 0);
  sv.addColorStop(0, rgba('#000000', PAL.dark ? .3 : .13));
  sv.addColorStop(1, rgba('#000000', 0));
  c.fillStyle = sv; c.fillRect(x, y, pad * 2, h);
  c.restore();
  c.restore();
}

/* The ring around the tile you have picked up: corner brackets and
   a breathing glow, instead of a marching-ants rectangle. */
function drawSelectRing(c, cx, cy, s, t, col) {
  const pulse = .5 + .5 * Math.sin(t * 5.2);
  c.save();
  c.translate(cx, cy);
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = .22 + pulse * .16;
  c.drawImage(blobBrush(col), -s * .8, -s * .8, s * 1.6, s * 1.6);
  c.restore();

  c.save();
  c.translate(cx, cy);
  c.rotate(Math.sin(t * 2.2) * .02);
  const k = s * (.52 + pulse * .015);
  c.strokeStyle = col;
  c.lineWidth = Math.max(2, s * .055);
  c.lineCap = 'round';
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(pair => {
    c.save(); c.scale(pair[0], pair[1]);
    c.beginPath();
    c.moveTo(k - s * .22, k);
    c.lineTo(k - s * .06, k);
    c.quadraticCurveTo(k, k, k, k - s * .06);
    c.lineTo(k, k - s * .22);
    c.stroke();
    c.restore();
  });
  c.restore();
}

/* the softer version used for hints */
function drawHintRing(c, cx, cy, s, t, col) {
  const pulse = .5 + .5 * Math.sin(t * 3.4);
  c.save();
  c.globalAlpha = .3 + pulse * .35;
  c.strokeStyle = col;
  c.lineWidth = Math.max(1.6, s * .045);
  squircle(c, cx - s * .44, cy - s * .44, s * .88, s * .88, 4.2);
  c.stroke();
  c.restore();
}

/* ---------------- scenery pieces ---------------- */
/* Two trees, chosen by position so a given tree is always the same
   tree. A lane lined with one silhouette repeated at three sizes reads
   as a tiled background; a second shape and a second green is enough to
   stop the eye noticing the repeat. */
function drawTree(c, x, y, s, t) {
  c.save(); c.translate(x, y);
  const kind = Math.floor(mulberry(Math.round(x) * 131 + Math.round(y))() * 2);
  const sway = Math.sin(t * .7 + x * .01) * .03;
  c.fillStyle = rgba('#2A1E12', .18);
  ellipse(c, 0, 0, s * .5, s * .12); c.fill();
  const trunk = PAL.dark ? '#4A3A2A' : '#8A6A4A';
  const cols = PAL.dark
    ? (kind ? ['#27412F', '#33523D'] : ['#2E4A38', '#3C5C46'])
    : (kind ? ['#44815A', '#5C9A6C'] : ['#4E8F63', '#63A876']);
  if (kind) {
    /* the taller one: a narrow crown in three tiers */
    c.fillStyle = trunk;
    c.beginPath();
    c.moveTo(-s * .07, 0); c.lineTo(-s * .04, -s * .84);
    c.lineTo(s * .04, -s * .84); c.lineTo(s * .07, 0); c.closePath(); c.fill();
    c.save(); c.translate(0, -s * .84); c.rotate(sway);
    c.fillStyle = cols[0];
    ellipse(c, 0, -s * .10, s * .34, s * .30); c.fill();
    ellipse(c, 0, -s * .32, s * .27, s * .24); c.fill();
    c.fillStyle = cols[1];
    ellipse(c, -s * .10, -s * .24, s * .18, s * .16); c.fill();
    ellipse(c, s * .11, -s * .44, s * .15, s * .13); c.fill();
    c.restore();
  } else {
    c.fillStyle = trunk;
    c.beginPath();
    c.moveTo(-s * .09, 0); c.lineTo(-s * .05, -s * .7);
    c.lineTo(s * .05, -s * .7); c.lineTo(s * .09, 0); c.closePath(); c.fill();
    c.save(); c.translate(0, -s * .7); c.rotate(sway);
    c.fillStyle = cols[0];
    ellipse(c, 0, -s * .2, s * .55, s * .48); c.fill();
    c.fillStyle = cols[1];
    ellipse(c, -s * .22, -s * .3, s * .32, s * .28); c.fill();
    ellipse(c, s * .24, -s * .26, s * .3, s * .26); c.fill();
    c.restore();
  }
  c.restore();
}
function drawBush(c, x, y, s) {
  c.save(); c.translate(x, y);
  c.fillStyle = PAL.dark ? '#2C4433' : '#5E9B6E';
  ellipse(c, 0, 0, s * .7, s * .5); c.fill();
  ellipse(c, -s * .4, s * .1, s * .42, s * .32); c.fill();
  ellipse(c, s * .42, s * .12, s * .4, s * .3); c.fill();
  c.fillStyle = rgba('#FFFFFF', .45);
  [[-.2, -.24], [.25, -.16], [0, -.34]].forEach(p => { ellipse(c, p[0] * s, p[1] * s, s * .07, s * .06); c.fill(); });
  c.restore();
}
/* A gate on the verge, at the end of every block.

   The tenth level of each block is a gate, and the map said so with a
   dashed ring around the node. A ring is a label. The lane itself had no
   idea anything happened there — three hundred levels of the same five
   props, with nothing to walk past and remember.

   So there is a gate in the hedge. It stands shut while the level in
   front of it is unbeaten and swings open once it is cleared, which
   means scrolling back down the lane shows every gate you have come
   through standing open behind you.

   Drawn in the fence's own hand — the same two colours, the same round
   caps, the same weight of line — because it is the same fence. */
function drawGateway(c, x, y, s, open) {
  /* Wood, not fence-cream. The first version borrowed the fence's own
     colours, and a fence reads at that weight because it is a repeated
     row of pales — a texture. One gate at the same weight is three pale
     lines on green and reads as nothing at all. */
  const post = PAL.dark ? '#7A6446' : '#9A7748';
  const rail = PAL.dark ? '#8B7350' : '#B08B57';
  c.save(); c.translate(x, y);
  c.lineCap = 'round';

  /* the ground shadow every other prop on this lane has */
  c.fillStyle = rgba('#2A1E12', PAL.dark ? .32 : .14);
  ellipse(c, 0, 2, s * .60, s * .10); c.fill();

  /* the two posts it hangs between, heavier than a fence pale */
  c.lineWidth = s * .11;
  c.strokeStyle = post;
  [-1, 1].forEach(sd => {
    c.beginPath(); c.moveTo(sd * s * .5, 0); c.lineTo(sd * s * .5, -s * .62); c.stroke();
    c.fillStyle = post;
    c.beginPath(); c.arc(sd * s * .5, -s * .64, s * .06, 0, Math.PI * 2); c.fill();
  });

  /* The gate, hinged on the left post.

     An open gate was first drawn by rotating the panel about its hinge,
     which in a flat elevation like this one reads as a ladder falling
     over rather than as a gate standing open. Swung toward the viewer
     it foreshortens instead: the same gate, narrow, still upright,
     still on its hinge. */
  const w = (open ? .30 : .96) * s;
  const h = s * .46;
  c.save();
  c.translate(-s * .5, -s * .10);
  c.strokeStyle = rail;
  c.lineWidth = s * .065;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.stroke();
  c.beginPath(); c.moveTo(0, -h); c.lineTo(w, -h); c.stroke();
  /* the diagonal brace every wooden gate has */
  c.lineWidth = s * .05;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(w, -h); c.stroke();
  c.lineWidth = s * .055;
  const bars = open ? 2 : 4;
  for (let i = 0; i <= bars; i++) {
    const px = (w / bars) * i;
    c.beginPath(); c.moveTo(px, .02); c.lineTo(px, -h - .02); c.stroke();
  }
  c.restore();
  c.restore();
}

function drawFence(c, x, y, s) {
  c.save(); c.translate(x, y);
  c.strokeStyle = PAL.dark ? '#6A5B48' : '#EDE0C6';
  c.lineWidth = s * .07; c.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    c.beginPath(); c.moveTo(i * s * .22, 0); c.lineTo(i * s * .22, -s * .42); c.stroke();
  }
  c.lineWidth = s * .055;
  c.beginPath(); c.moveTo(-s * .5, -s * .30); c.lineTo(s * .5, -s * .30); c.stroke();
  c.restore();
}
function drawCottage(c, x, y, s, seed) {
  const r = mulberry(seed * 331);
  const roof = ['#B4685E', '#7E8FA8', '#8E7A63'][Math.floor(r() * 3)];
  c.save(); c.translate(x, y);
  c.fillStyle = rgba('#2A1E12', .18);
  ellipse(c, 0, 0, s * .6, s * .1); c.fill();
  c.fillStyle = PAL.dark ? '#3C4657' : '#F3E7D2';
  rr(c, -s * .42, -s * .62, s * .84, s * .62, s * .05); c.fill();
  c.fillStyle = PAL.dark ? mix(roof, '#16202E', .5) : roof;
  c.beginPath();
  c.moveTo(-s * .52, -s * .60); c.lineTo(0, -s * .98); c.lineTo(s * .52, -s * .60); c.closePath(); c.fill();
  c.fillStyle = PAL.dark ? '#F5C542' : '#E0A73C';
  rr(c, -s * .26, -s * .46, s * .2, s * .2, s * .03); c.fill();
  rr(c, s * .08, -s * .46, s * .2, s * .2, s * .03); c.fill();
  c.fillStyle = PAL.dark ? '#5A4632' : '#A97B4C';
  rr(c, -s * .10, -s * .26, s * .2, s * .26, s * .03); c.fill();
  c.restore();
}
function drawLampPost(c, x, y, s, warmth, t) {
  /* At map scale this was a hairline pole with a pale trapezoid over it,
     both the colour of the sky behind them: two thin shapes that read as
     a broken picture rather than as a lamp. It is drawn with weight now
     — a tapered post, a crossbar, and a shade with a dark rim so its
     silhouette survives being forty pixels tall on a green field. */
  const dark = PAL.dark;
  c.save(); c.translate(x, y);
  c.fillStyle = rgba('#2A1E12', dark ? .4 : .16);
  ellipse(c, 0, 0, s * .17, s * .05); c.fill();
  const post = dark ? '#46536A' : '#6B563C';
  /* a post with a base and a taper, not a line */
  c.fillStyle = post;
  c.beginPath();
  c.moveTo(-s * .07, 0); c.lineTo(s * .07, 0);
  c.lineTo(s * .035, -s * .84); c.lineTo(-s * .035, -s * .84);
  c.closePath(); c.fill();
  rr(c, -s * .10, -s * .07, s * .2, s * .07, s * .02); c.fill();
  /* the crossbar the lamp hangs off */
  rr(c, -s * .12, -s * .86, s * .24, s * .05, s * .02); c.fill();
  /* the shade: a solid body with a rim, so it is an object */
  const lit = warmth > .3;
  c.beginPath();
  c.moveTo(-s * .16, -s * .86); c.lineTo(s * .16, -s * .86);
  c.lineTo(s * .09, -s * 1.06); c.lineTo(-s * .09, -s * 1.06);
  c.closePath();
  c.fillStyle = lit ? '#FFE1A0' : (dark ? '#3A4557' : '#E4D6BC');
  c.fill();
  c.strokeStyle = post; c.lineWidth = Math.max(1, s * .035); c.stroke();
  c.fillStyle = post;
  rr(c, -s * .11, -s * 1.10, s * .22, s * .05, s * .02); c.fill();
  if (lit) {
    /* the pool of light it throws, not a halo around the bulb */
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(0, -s * .9, 0, 0, -s * .9, s * .95);
    g.addColorStop(0, rgba('#FFCE84', .26 * warmth * (1 + Math.sin(t * 6 + x) * .05)));
    g.addColorStop(1, rgba('#FFCE84', 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(0, -s * .9, s * .95, 0, 6.2832); c.fill();
    c.restore();
    c.fillStyle = rgba('#FFF3D4', .5);
    ellipse(c, 0, -s * .02, s * .3, s * .09); c.fill();
  }
  c.restore();
}


/* ============================================================
   Small illustrations used by the UI.
   ============================================================ */

/* ============================================================
   THE PATCH OF LANE A LEVEL IS PLAYED ON
   ============================================================

   The board used to float in the middle of a flat beige panel with
   about a hundred pixels of nothing above it and a hundred and thirty
   below. Nothing was wrong with it and nothing was there either, which
   is the look of a screen that was laid out rather than composed.

   So the level is now a place: the same grass, the same verge, the same
   scenery as the lane on the map, with the board set down on the path
   like a seed tray somebody carried out. Going from the map into a
   level reads as walking up to it rather than as changing screens.

   Painted once per layout, and again when the walk takes a step — see
   the paw prints below. Nothing in it animates. */

/* How far the walk has got: the share of the level's goals that are in.

   Averaged across goals rather than summed, so a level asking for two
   things is half done when one of them is. A score goal is read off the
   live score, which the goal object does not carry between syncs. */
function sceneProgress() {
  if (typeof G === 'undefined' || !G || !G.goals || !G.goals.length) return 0;
  let sum = 0;
  for (const g of G.goals) {
    const have = (typeof GK !== 'undefined' && g.kind === GK.SCORE) ? G.score : g.have;
    sum += g.need > 0 ? clamp(have / g.need, 0, 1) : 1;
  }
  return sum / G.goals.length;
}

function drawLevelScene() {
  const cv = $('#scene'), wrap = $('#boardWrap');
  if (!cv || !wrap) return;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (W <= 0 || H <= 0) return;
  const c = fitCanvas(cv, W, H);
  if (!c) return;
  const ph = roomPhase(PAL.dark);
  const sky = skyColours(ph);
  const dark = PAL.dark;
  /* where the board actually landed, asked rather than assumed: the
     wrap is bottom-weighted, and guessing it was centred put the hedge
     through the middle of the tray */
  const bd = $('#board');
  let bw = G.cw || W * .9, bh = G.ch || H * .8, bx = (W - bw) / 2, by = H - bh - 14;
  if (bd) {
    const a = bd.getBoundingClientRect(), b = wrap.getBoundingClientRect();
    if (a.width > 4 && a.height > 4) { bw = a.width; bh = a.height; bx = a.left - b.left; by = a.top - b.top; }
  }
  const topBand = Math.max(0, by), botBand = Math.max(0, H - (by + bh));
  c.clearRect(0, 0, W, H);

  /* the same ground the lane is drawn on, so it reads as one world */
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, dark ? '#1A2430' : mix(sky[2], '#C7D8A8', .55));
  g.addColorStop(.22, dark ? '#20301F' : '#B7CE95');
  g.addColorStop(1, dark ? '#1B2A1B' : '#A5C186');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  /* A hedge along the far side, which is what gives the ground a far
     side at all — without a horizon the grass is only a green fill.
     Built from overlapping lumps rather than a wavy band: a band reads
     as a ribbon of colour, and the eye wants to see leaves. */
  const hy = Math.min(topBand * .58, 44);
  if (topBand > 30) {
    const back = dark ? '#1E2D1C' : '#4E8A5E';
    const mid = dark ? '#27391F' : '#5E9B6E';
    const lit = dark ? '#37502F' : '#78B983';
    c.save();
    c.fillStyle = back;
    c.fillRect(-4, hy + 2, W + 8, 30);
    const lump = (x, y, rx, ry, col) => { c.fillStyle = col; ellipse(c, x, y, rx, ry); c.fill(); };
    const hr = mulberry(8821);
    for (let x = -14; x < W + 20; x += 21) lump(x + hr() * 8, hy + 10 + hr() * 5, 20 + hr() * 9, 15 + hr() * 6, back);
    for (let x = -10; x < W + 20; x += 26) lump(x + hr() * 9, hy + 3 + hr() * 5, 17 + hr() * 8, 13 + hr() * 5, mid);
    for (let x = -6; x < W + 20; x += 34) lump(x + hr() * 11, hy - 3 + hr() * 4, 12 + hr() * 6, 9 + hr() * 4, lit);
    c.restore();
  }

  /* The lane itself, running from the hedge down to the tray: narrow at
     the horizon and wide at your feet. It is the depth cue the whole
     scene hangs off, and it is what the middle of the screen is for —
     without it that band was a hundred and fifty pixels of plain green. */
  if (topBand > 90) {
    const y0 = hy + 22, y1 = by + 10, span = y1 - y0;
    const w0 = 13, w1 = Math.min(W * .30, bw * .34);
    /* a bend, so it is a lane and not a ramp: the centre line drifts one
       way and comes back, and the width eases in rather than ruling out */
    const cxAt = u => W * .56 - Math.sin(u * 3.0) * W * .085 - u * W * .045;
    const wAt = u => w0 + (w1 - w0) * (u * u * .72 + u * .28);
    const N = 30;
    c.save();
    c.beginPath();
    for (let i = 0; i <= N; i++) { const u = i / N, y = y0 + span * u;
      const x = cxAt(u) - wAt(u); i ? c.lineTo(x, y) : c.moveTo(x, y); }
    for (let i = N; i >= 0; i--) { const u = i / N, y = y0 + span * u;
      c.lineTo(cxAt(u) + wAt(u), y); }
    c.closePath();
    c.fillStyle = dark ? '#3A4034' : '#DFCDA4';
    c.fill();
    c.save(); c.clip();
    /* worn down the middle, brighter at the edges where nobody treads */
    const wear = c.createLinearGradient(0, y0, 0, y1);
    wear.addColorStop(0, rgba(dark ? '#20261C' : '#B79E6C', .00));
    wear.addColorStop(1, rgba(dark ? '#20261C' : '#B79E6C', .26));
    c.fillStyle = wear; c.fillRect(0, y0, W, span);
    /* grit, so it is a surface and not a fill */
    const gr = mulberry(515);
    c.globalAlpha = dark ? .18 : .3;
    for (let i = 0; i < 130; i++) {
      const u = gr(), y = y0 + span * u, x = cxAt(u) + (gr() - .5) * 2 * wAt(u);
      c.fillStyle = gr() > .5 ? (dark ? '#5A6050' : '#C9B588') : (dark ? '#2A3026' : '#F0E3C4');
      const s = .8 + u * 1.9;
      ellipse(c, x, y, s, s * .7); c.fill();
    }
    c.globalAlpha = 1;
    /* The walk home.

       A third of the play screen is this band of grass, and it was a
       picture: a hedge, a house, a lane, and nine paw prints that meant
       nothing. Meanwhile the game's whole idea is walking an animal
       home, and the only place that progress was stated was a row of
       counters at the top of the screen.

       So the prints are the walk. They run from the tray by your hands
       up the lane toward the house, and they are laid as the goals come
       in: the ones behind the walk are pressed into the path, the ones
       ahead are barely there, and the one being made is a little
       heavier than the rest. Nothing new is drawn and nothing animates
       — it is the picture that was already here, told in order.

       Fourteen rather than nine, because nine steps is a coarse thing
       to measure a whole level with. */
    const walked = sceneProgress();
    const PRINTS = 14;
    c.fillStyle = dark ? '#6E7A66' : '#9C8354';
    for (let k = 0; k < PRINTS; k++) {
      const u = (k + .5) / PRINTS;
      /* u runs from the hedge down to the tray and the walk runs the
         other way, so a print exists once the walk has come up past it */
      const made = clamp((walked - (1 - u)) * PRINTS + .5, 0, 1);
      c.globalAlpha = .07 + made * .31;
      const y = y0 + span * (u * u * .5 + u * .5);
      const sc = (.32 + u * .9) * (made > .12 && made < .88 ? 1.16 : 1);
      const x = cxAt(u) + (k % 2 ? 1 : -1) * wAt(u) * .3;
      c.save(); c.translate(x, y); c.scale(sc, sc);
      ellipse(c, 0, 2.5, 3.4, 4.4); c.fill();
      [-1, 1].forEach(s => { ellipse(c, s * 3.2, -2.6, 1.5, 2); c.fill(); });
      [-1, 1].forEach(s => { ellipse(c, s * 1.1, -4.4, 1.5, 2); c.fill(); });
      c.restore();
    }
    c.restore();
    /* tufts breaking the edge, so the join is not a ruled line */
    c.globalAlpha = .85;
    const tr = mulberry(77);
    c.strokeStyle = dark ? '#3E5C3C' : '#7FA262';
    c.lineCap = 'round';
    for (let i = 0; i < 34; i++) {
      const u = tr(), y = y0 + span * u, side = tr() > .5 ? 1 : -1;
      const x = cxAt(u) + side * wAt(u);
      const h2 = 3 + u * 6;
      c.lineWidth = 1.3 + u * .9;
      c.beginPath(); c.moveTo(x, y + 1); c.lineTo(x + (tr() - .5) * 4, y - h2); c.stroke();
    }
    c.restore();
  }

  /* grass, seeded so it is the same blades every time the board relays out */
  c.save();
  c.globalAlpha = dark ? .2 : .3;
  c.strokeStyle = dark ? '#4A6B48' : '#8FAE6E';
  c.lineWidth = 1.6; c.lineCap = 'round';
  const r = mulberry(4211);
  for (let i = 0; i < 300; i++) {
    const x = r() * W, y = r() * H, len = 4 + r() * 7;
    c.beginPath(); c.moveTo(x, y);
    c.lineTo(x + (r() - .5) * 4, y - len); c.stroke();
  }
  c.restore();

  /* Scenery goes in the two bands the board leaves, and is anchored to
     the board's own edges rather than dropped at random, so it composes
     at any screen size instead of drifting about. */
  const warmth = lampStrength(ph);
  /* placed by depth: far things small and high, near things big and low,
     which is the whole of perspective and costs three numbers */
  if (topBand > 130) {
    const far = hy + 30, mid = hy + (by - hy) * .46, near = by - 10;
    drawCottage(c, W * .16, far + 10, 26, 7);
    drawBush(c, W * .78, far + 12, 9);
    drawTree(c, W * .90, mid + 22, 31, 0);
    drawFence(c, W * .12, mid + 24, 30);
    drawBush(c, W * .06, near, 16);
    drawBush(c, W * .95, near - 4, 14);
  } else if (topBand > 52) {
    drawTree(c, W * .87, by - 12, Math.min(36, topBand * .58), 0);
    drawCottage(c, W * .17, by - 14, Math.min(30, topBand * .44), 7);
    drawBush(c, W * .44, by - 12, 11);
  } else if (topBand > 26) {
    drawBush(c, W * .84, by - 8, 11);
  }
  /* The foreground: the strip you are standing in. Bigger than the
     things at the hedge and allowed to run off the edges, because that
     is what near things do, and it is what stops the lower half of the
     screen reading as leftover space. */
  if (botBand > 20) {
    c.save();
    const fg = c.createLinearGradient(0, H - botBand, 0, H);
    fg.addColorStop(0, rgba(dark ? '#16220F' : '#8FB273', 0));
    fg.addColorStop(1, rgba(dark ? '#16220F' : '#8FB273', .55));
    c.fillStyle = fg;
    c.fillRect(0, H - botBand, W, botBand);
    c.restore();
  }
  if (botBand > 40) {
    drawBush(c, -6, H + 6, 26 + Math.min(14, botBand * .12));
    drawBush(c, W + 8, H + 10, 22 + Math.min(12, botBand * .1));
    if (warmth > .3 && botBand > 70) drawLampPost(c, W * .78, H + 2, 46, warmth, 0);
    else if (botBand > 62) drawFence(c, W * .80, H - 4, 32);
  }

  /* paw prints coming up to the tray */
  if (botBand > 30) {
    c.save();
    c.globalAlpha = .42;
    c.fillStyle = dark ? '#8DA085' : '#6F8B58';
    for (let k = 0; k < 3; k++) {
      const x = W * .40 + (k % 2 ? 12 : -4);
      const y = H - 14 - k * 18;
      c.save(); c.translate(x, y);
      ellipse(c, 0, 2.5, 3.2, 4.1); c.fill();
      [-1, 1].forEach(s => { ellipse(c, s * 3, -2.5, 1.4, 1.9); c.fill(); });
      [-1, 1].forEach(s => { ellipse(c, s * 1, -4.2, 1.4, 1.9); c.fill(); });
      c.restore();
    }
    c.restore();
  }

  /* the tray sits on the grass rather than hovering over it */
  c.save();
  c.fillStyle = rgba('#243018', dark ? .45 : .2);
  ellipse(c, W / 2, by + bh - 4, bw * .46, 12);
  c.fill();
  c.restore();
}
