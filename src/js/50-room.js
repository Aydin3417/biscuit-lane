/* ============================================================
   50 — the room upstairs, and the lane outside
   ============================================================ */
const ROOM = {
  ctx: null, w: 0, h: 0, running: false, raf: null, lastT: 0,
  t: 0, state: 'idle', stateT: 0,
  px: .5, targetX: .5, walk: 0, facing: 1,
  bits: [], bubbleT: 0, snoreT: 0,
  idleT: 6, idleKind: null, idleLeft: 0, noticed: 0,
  /* where the finger is over the room, in the pet's own -1..1 frame,
     and how long it stays interesting after the finger lifts */
  look: null, lookT: 0, bound: false, heartT: 3
};

function roomLayout() {
  const cv = $('#room');
  const w = cv.parentElement.clientWidth;
  if (!w) return;
  const h = Math.round(clamp(w * .62, 180, 270));
  ROOM.w = w; ROOM.h = h;
  ROOM.ctx = fitCanvas(cv, w, h);
}
/* The pet follows your finger.

   This is the cheapest thing in the whole game per unit of alive. A
   drawn animal that tracks the pointer stops being a picture of an
   animal; the rig already had a gaze channel for it and nothing had
   ever fed it. Coordinates come in as a fraction of the canvas and
   leave in the -1..1 the eyes are drawn in, so the pet can look at a
   corner without its pupils leaving its head. */
function bindRoomLook() {
  if (ROOM.bound) return;
  const cv = $('#room');
  if (!cv) return;
  ROOM.bound = true;
  const at = ev => {
    const rect = cv.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const fx = (ev.clientX - rect.left) / rect.width;
    const fy = (ev.clientY - rect.top) / rect.height;
    /* the pet stands mid-floor; look is measured from there */
    ROOM.look = [clamp((fx - ROOM.px) * 2.4, -1, 1), clamp((fy - .62) * 2.2, -1, 1)];
    ROOM.lookT = 1.1;
  };
  cv.addEventListener('pointermove', at, { passive: true });
  cv.addEventListener('pointerdown', at, { passive: true });
  cv.addEventListener('pointerleave', () => { ROOM.lookT = .25; }, { passive: true });
}

function roomStart() {
  /* looking up when you walk in costs nothing and reads as alive */
  const pet = activePet();
  if (pet && !pet.asleep) ROOM.noticed = .7;
  bindRoomLook();
  if (ROOM.running) return;
  roomLayout();
  ROOM.running = true;
  ROOM.lastT = performance.now();
  const loop = t => {
    if (!ROOM.running) return;
    const dt = Math.min(.05, (t - ROOM.lastT) / 1000);
    ROOM.lastT = t;
    renderRoom(dt);
    ROOM.raf = requestAnimationFrame(loop);
  };
  ROOM.raf = requestAnimationFrame(loop);
}
function roomStop() {
  ROOM.running = false;
  if (ROOM.raf) cancelAnimationFrame(ROOM.raf);
  ROOM.raf = null;
}
function roomAct(state, dur) {
  ROOM.state = state;
  ROOM.idleKind = null; ROOM.idleLeft = 0; ROOM.idleT = rnd(4, 9);
  ROOM.stateT = dur || 2.6;
  ROOM.bits = [];
}
function roomBit(x, y, kind, col) {
  ROOM.bits.push({ x, y, vx: rnd(-14, 14), vy: rnd(-40, -18), life: 0, max: rnd(1, 1.7), kind, col, rot: rnd(-.4, .4) });
}

function renderRoom(dt) {
  /* If the canvas was measured while the page had no layout — a hidden
     tab, a pane that had not opened yet — it would stay blank forever.
     Re-measure whenever the parent's width no longer matches. */
  const cv = $('#room');
  if (cv && cv.parentElement) {
    const want = cv.parentElement.clientWidth;
    if (want > 0 && (!ROOM.ctx || Math.abs(want - ROOM.w) > 1)) roomLayout();
  }
  const c = ROOM.ctx, W = ROOM.w, H = ROOM.h;
  if (!c || W <= 0 || H <= 0) return;
  const pet = activePet();
  /* A NaN here would spread into every sine below, and canvas ignores a
     NaN transform without complaining, so the room would keep drawing —
     just with the pet stuck in the corner. Clamp the step, heal a clock
     that has already been spoiled. */
  dt = (typeof dt === 'number' && isFinite(dt)) ? clamp(dt, 0, .05) : 1 / 60;
  if (!isFinite(ROOM.t)) ROOM.t = 0;
  ROOM.t += dt;
  const floorY = H * .70;

  /* wall, window, floor, furniture and the light in the room all
     come from the scene layer, so the art stays in one place */
  c.clearRect(0, 0, W, H);
  drawRoom(c, W, H, {
    t: ROOM.t,
    theme: SAVE.room.theme,
    placed: SAVE.room.placed,
    floorRatio: .70
  });

  /* the bowl */
  const bowlX = W * .18, bowlY = floorY + (H - floorY) * .48;
  drawBowl(c, bowlX, bowlY, W * .075, ROOM.state === 'eat');

  /* the pet */
  if (pet) {
    /* One mood, read once, used by everything below. It used to be read
       inside the idle branch only, which is why the pet's face never
       knew how it felt: the mood decided which idle behaviour to pick
       and then went out of scope. */
    const mood = moodOf(pet);

    /* The rig carries the slow, involuntary things — breath, a blink
       that actually closes, a tail that swings on its own weight, eyes
       that go where they are looking. It has existed in the scene layer
       since the room was written and was never once stepped: drawRoom
       draws a live pet only when handed one, and the room draws its own,
       so petRig, rigStep and every mood ornament sat unreachable. The
       room kept its own single-frame blink and two sine waves instead.
       The state machine below is the room's and stays the room's; what
       the animal does without deciding to comes from here. */
    if (ROOM.lookT > 0) ROOM.lookT -= dt;
    const rig = rigStep(petRig(pet), dt, {
      mood,
      look: (ROOM.lookT > 0 && ROOM.look) ? ROOM.look : null
    });

    /* wander */
    /* something to do between wanders: which options depend on the
       animal and on how it is feeling */
    if (ROOM.state === 'idle' && !pet.asleep) {
      if (ROOM.idleLeft > 0) {
        ROOM.idleLeft -= dt;
        if (ROOM.idleLeft <= 0) ROOM.idleKind = null;
      } else {
        ROOM.idleT -= dt;
        if (ROOM.idleT <= 0) {
          ROOM.idleT = rnd(5, 11);
          const cat = petBreed(pet).species === 'cat';
          const mood = moodOf(pet);
          const options = cat ? ['groom', 'stretch', 'stare'] : ['stretch', 'shake', 'stare'];
          if (pet.clean < 55 && cat) options.push('groom', 'groom');
          if (pet.energy < 40) options.push('stretch');
          if (mood === 'bored' || mood === 'lonely') options.push('stare', 'stare');
          ROOM.idleKind = pick(options);
          ROOM.idleLeft = ROOM.idleKind === 'stare' ? rnd(1.6, 3) : rnd(1.4, 2.2);
          if (ROOM.idleKind === 'shake' && Math.random() < .4) petVoice(pet, 1.05);
        }
      }
    } else { ROOM.idleKind = null; ROOM.idleLeft = 0; }

    if (ROOM.state === 'idle' && !pet.asleep && !ROOM.idleKind) {
      ROOM.walk -= dt;
      if (ROOM.walk <= 0) { ROOM.targetX = rnd(.24, .76); ROOM.walk = rnd(3.5, 8); }
      const d = ROOM.targetX - ROOM.px;
      if (Math.abs(d) > .006) { ROOM.px += Math.sign(d) * Math.min(Math.abs(d), dt * .13); ROOM.facing = Math.sign(d) || 1; }
    }
    if (ROOM.state === 'eat') ROOM.px += (0.24 - ROOM.px) * dt * 3;
    /* drawBody builds the animal to its stage, so hand over full size */
    const scale = H * .30;
    const gx = W * ROOM.px;
    /* drawBody hangs about .92 of its scale below the origin, so
       put the feet on the floor and work the origin back up */
    const gy = floorY + (H - floorY) * .58 - scale * .92;

    let bob = Math.sin(ROOM.t * 2) * .012;
    /* the eyes are drawn from a 0..1 lid, not a flag: a blink that
       snaps between open and shut is the difference between a drawing
       and a face */
    let tilt = 0, mouth = 'smile', blink = rig.blink;
    const moving = ROOM.state === 'idle' && Math.abs(ROOM.targetX - ROOM.px) > .006 && !pet.asleep;
    if (moving) bob = Math.abs(Math.sin(ROOM.t * 9)) * .04;

    if (pet.asleep) {
      blink = 1; bob = Math.sin(ROOM.t * 1.1) * .022; tilt = .2;
      ROOM.snoreT -= dt;
      if (ROOM.snoreT <= 0) { ROOM.snoreT = 2.6; roomBit(gx + scale * .3, gy - scale * .5, 'z', PAL.textDim); if (Math.random() < .5) SFX.snore(); }
    } else if (ROOM.state === 'eat') {
      mouth = Math.sin(ROOM.t * 16) > 0 ? 'open' : 'smile';
      bob = Math.sin(ROOM.t * 16) * .03; tilt = .12;
      /* per second, not per frame: a probability rolled once a frame is
         a different animal on a 120Hz phone than on a 60Hz one, and
         these were written against sixty. Same rate on any display. */
      if (Math.random() < 10.8 * dt) roomBit(bowlX + rnd(-8, 8), bowlY - 6, 'crumb', '#B5763F');
    } else if (ROOM.state === 'play') {
      bob = -Math.abs(Math.sin(ROOM.t * 11)) * .1;
      mouth = 'open';
      tilt = Math.sin(ROOM.t * 11) * .12;
    } else if (ROOM.state === 'wash') {
      bob = Math.sin(ROOM.t * 5) * .02;
      blink = 1;
      ROOM.bubbleT -= dt;
      if (ROOM.bubbleT <= 0) { ROOM.bubbleT = .09; roomBit(gx + rnd(-scale * .4, scale * .4), gy - rnd(0, scale * .6), 'bubble', '#BFE4F5'); }
    } else if (ROOM.state === 'pet') {
      mouth = 'smile'; blink = 1; tilt = Math.sin(ROOM.t * 3) * .1;
      if (Math.random() < 7.2 * dt) roomBit(gx + rnd(-18, 18), gy - scale * .7, 'heart', PAL.rose);
    } else if (ROOM.state === 'happy') {
      bob = -Math.abs(Math.sin(ROOM.t * 10)) * .12; mouth = 'open';
    } else if (ROOM.idleKind === 'groom') {
      /* a paw comes up and the head follows it round */
      const k = ROOM.t * 7;
      tilt = .34 + Math.sin(k) * .16;
      bob = Math.sin(k) * .014;
      blink = 1;
    } else if (ROOM.idleKind === 'stretch') {
      /* front end down, back end up, then back to normal */
      const k = clamp(1 - ROOM.idleLeft / 1.8, 0, 1);
      const arc = Math.sin(k * Math.PI);
      bob = arc * .05;
      tilt = arc * -.22;
      mouth = arc > .55 ? 'open' : 'smile';
      blink = arc > .5 ? 1 : blink;
    } else if (ROOM.idleKind === 'shake') {
      const k = ROOM.t * 26;
      tilt = Math.sin(k) * .13;
      bob = Math.abs(Math.sin(k * .5)) * .02;
      mouth = 'open';
    } else if (ROOM.idleKind === 'stare') {
      /* looks straight out of the screen at you */
      bob = Math.sin(ROOM.t * 1.6) * .008;
      tilt = Math.sin(ROOM.t * .5) * .05;
    }

    /* a beat of attention when you come back to the room */
    if (ROOM.noticed > 0) {
      ROOM.noticed -= dt;
      const k = clamp(ROOM.noticed / .7, 0, 1);
      bob -= Math.sin(k * Math.PI) * .05;
      tilt += Math.sin(k * Math.PI) * .1 * ROOM.facing;
      mouth = 'open';
    }

    c.save();
    c.translate(gx, gy + bob * scale);
    c.scale(ROOM.facing, 1);
    const spec = specOfPet(pet);
    /* the shape of the animal itself, for the one behaviour that needs
       more than a head tilt to read */
    if (ROOM.idleKind === 'stretch') {
      const base = STAGE_BUILD[clamp(petStageIdx(pet), 0, STAGE_BUILD.length - 1)];
      const arc = Math.sin(clamp(1 - ROOM.idleLeft / 1.8, 0, 1) * Math.PI);
      spec.build = {
        k: base.k,
        sx: base.sx * (1 + arc * .10),
        sy: base.sy * (1 - arc * .13),
        head: base.head
      };
    }
    /* Where the eyes go, in order of who has the strongest claim:
       something the room is deliberately doing, then your finger, then
       the rig's own wandering. Walking still pulls the gaze along the
       direction of travel, because an animal looks where it is going. */
    let eyeDir;
    if (ROOM.idleKind === 'stare' || ROOM.noticed > 0) eyeDir = [0, -.15];
    else if (pet.asleep) eyeDir = [0, .4];
    else if (ROOM.lookT > 0 && ROOM.look) eyeDir = [rig.gaze[0] * ROOM.facing, rig.gaze[1]];
    else if (moving) eyeDir = [clamp((ROOM.targetX - ROOM.px) * 6, -1, 1) * ROOM.facing, 0];
    else eyeDir = [rig.gaze[0] * ROOM.facing, rig.gaze[1]];

    drawBody(c, spec, scale, {
      blink, mouth, headTilt: tilt * ROOM.facing,
      /* the ears already know how it feels; so does everything else on
         this screen, and they were the last part still deadpan */
      mood,
      /* a moving animal breathes with its steps, a still one with the
         rig; asleep the rig already deepens it */
      breath: moving ? Math.sin(ROOM.t * 4.5) : rig.breath,
      tail: (moving || ROOM.state === 'play')
        ? Math.sin(ROOM.t * 9)
        : rig.tail,
      eyeDir
    });
    c.restore();

    /* How it feels, without reading anything.

       The mood line under the care buttons was the only place the pet's
       state was ever stated, which made the animal itself decorative:
       starving and content looked identical. These are the scene
       layer's own ornaments, drawn at last. */
    if (!pet.asleep) {
      const ox = gx + scale * .52 * ROOM.facing, oy = gy - scale * .12;
      if (mood === 'hungry') drawThought(c, ox, oy, scale * .26, 'bowl');
      else if (mood === 'bored') drawThought(c, ox, oy, scale * .26, 'ball');
      else if (mood === 'lonely') drawThought(c, ox, oy, scale * .26, 'heart');
      else if (mood === 'dirty') { c.save(); c.translate(gx, gy); drawGrime(c, scale, ROOM.t, spec); c.restore(); }
      else if (mood === 'happy') {
        /* A timer, not a threshold on a sine.

           `Math.sin(t * .8) > .985` reads like "every so often" and is
           not: the sine stays above that line for about four tenths of
           a second, which at sixty frames is twenty-six hearts at once,
           every eight seconds. It rendered as a red smear over the
           pet's head. The scene layer's own copy of this line has the
           same fault. A contented animal gives off one heart at a time.

           An ambient heart is also not the burst you get for stroking
           the animal: it stays near the pet and goes, rather than
           climbing the wall and reading as wallpaper. */
        ROOM.heartT -= dt;
        if (ROOM.heartT <= 0) {
          ROOM.heartT = rnd(2.4, 4.6);
          ROOM.bits.push({
            x: gx + rnd(-10, 10), y: gy - scale * .35, vx: rnd(-6, 6), vy: rnd(-20, -11),
            life: 0, max: rnd(.8, 1.1), kind: 'heart', col: PAL.rose, rot: rnd(-.3, .3)
          });
        }
      }
    }

    /* the bouncing toy */
    if (ROOM.state === 'play') {
      const bestToy = bestOwnedToy();
      const bx = gx + Math.sin(ROOM.t * 5) * scale * .8;
      const by = gy - Math.abs(Math.sin(ROOM.t * 11)) * scale * .8;
      c.save(); c.translate(bx, by); c.rotate(ROOM.t * 4);
      paintGood(c, bestToy ? bestToy.art : 'tennis', scale * .55);
      c.restore();
    }
  }

  /* floating bits */
  ROOM.bits = ROOM.bits.filter(b => {
    b.life += dt;
    const k = b.life / b.max;
    if (k >= 1) return false;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.kind === 'crumb') b.vy += 120 * dt; else b.vy += 6 * dt;
    c.save();
    c.globalAlpha = 1 - k * k;
    c.translate(b.x, b.y);
    if (b.kind === 'heart') { c.rotate(b.rot); drawPip(c, 'heart', 0, 0, 7, b.col); }
    else if (b.kind === 'z') {
      c.fillStyle = b.col; c.font = '800 15px Grandstander, sans-serif';
      c.fillText('z', 0, 0);
    } else if (b.kind === 'bubble') {
      c.strokeStyle = rgba('#BFE4F5', .9); c.lineWidth = 1.6;
      c.beginPath(); c.arc(0, 0, 4 + k * 5, 0, Math.PI * 2); c.stroke();
      c.fillStyle = rgba('#FFFFFF', .3); c.fill();
    } else {
      c.fillStyle = b.col; c.beginPath(); c.arc(0, 0, 2.4, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    return true;
  });

  if (ROOM.stateT > 0) {
    ROOM.stateT -= dt;
    if (ROOM.stateT <= 0) ROOM.state = 'idle';
  }
}

function drawBowl(c, x, y, r, active) {
  c.save();
  c.fillStyle = rgba('#2A1E12', PAL.dark ? .3 : .15);
  ellipse(c, x, y + r * .5, r * 1.1, r * .22); c.fill();
  c.fillStyle = '#D2536A';
  c.beginPath();
  c.moveTo(x - r, y - r * .3);
  c.quadraticCurveTo(x - r * .95, y + r * .5, x, y + r * .5);
  c.quadraticCurveTo(x + r * .95, y + r * .5, x + r, y - r * .3);
  c.closePath(); c.fill();
  c.fillStyle = '#B04256';
  ellipse(c, x, y - r * .3, r, r * .3); c.fill();
  const pet = activePet();
  const fed = pet && pet.food > 45;
  if (fed || active) {
    c.fillStyle = '#B5763F';
    ellipse(c, x, y - r * .3, r * .72, r * .2); c.fill();
    c.fillStyle = '#8C5A2E';
    for (let i = 0; i < 4; i++) ellipse(c, x - r * .4 + i * r * .27, y - r * .34, r * .11, r * .07), c.fill();
  }
  c.fillStyle = rgba('#FFFFFF', .3);
  ellipse(c, x - r * .5, y, r * .16, r * .1, -.5); c.fill();
  c.restore();
}

function bestOwnedToy() {
  let best = null;
  TOYS.forEach(t => { if (SAVE.toys[t.id] && (!best || t.joy > best.joy)) best = t; });
  return best;
}

/* ============================================================
   The lane — a level map you scroll
   ============================================================ */
const MAP = { ctx: null, w: 0, h: 0, nodes: [], scrolled: false };

function mapLayout() {
  const cv = $('#mapCanvas');
  const wrap = $('#mapWrap');
  const spacer = $('#mapSpacer');
  const w = wrap.clientWidth;
  if (!w) return;
  const top = Math.max(SAVE.reached + 5, 12);
  const rowH = 94;
  const total = top * rowH + 120;
  MAP.w = w;
  MAP.total = total;                      /* the whole lane, in css px */
  MAP.view = Math.max(1, wrap.clientHeight);
  MAP.h = MAP.view;                       /* the canvas is only this tall */
  spacer.style.height = total + 'px';
  MAP.ctx = fitCanvas(cv, w, MAP.view);
  MAP.nodes = [];
  for (let i = 1; i <= top; i++) {
    const idx = top - i;                   /* level 1 at the bottom */
    const y = 70 + idx * rowH;
    const x = w / 2 + Math.sin(i * .82) * (w * .26);
    MAP.nodes.push({ n: i, x, y });
  }
  drawMap();
}

function drawMap() {
  const c = MAP.ctx, W = MAP.w, H = MAP.h;
  if (!c) return;
  const wrap = $('#mapWrap');
  const off = wrap ? wrap.scrollTop : 0;
  MAP.off = off;
  c.save();
  c.clearRect(0, 0, W, H);
  c.translate(0, -off);
  /* ---- the ground the lane runs over ---- */
  const ph = roomPhase(PAL.dark);
  const sky = skyColours(ph);
  const total = MAP.total || H;
  const grad = c.createLinearGradient(0, 0, 0, total);
  grad.addColorStop(0, PAL.dark ? '#1A2430' : mix(sky[2], '#C7D8A8', .5));
  grad.addColorStop(.14, PAL.dark ? '#20301F' : '#B7CE95');
  grad.addColorStop(1, PAL.dark ? '#1B2A1B' : '#A8C489');
  c.fillStyle = grad;
  c.fillRect(0, 0, W, total);

  /* grass, seeded so it never crawls between frames */
  c.save();
  c.globalAlpha = PAL.dark ? .18 : .26;
  c.strokeStyle = PAL.dark ? '#4A6B48' : '#8FAE6E';
  c.lineWidth = 1.6; c.lineCap = 'round';
  const rr2 = mulberry(99);
  for (let i = 0; i < 420; i++) {
    const x = rr2() * W, y = rr2() * total, len = 4 + rr2() * 7;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (rr2() - .5) * 4, y - len);
    c.stroke();
  }
  c.restore();

  /* Patches, so the field is a field. A single flat green with a few
     tick marks on it is a texture, not a place, and it left the whole
     side of the screen the lane does not use reading as blank paper. */
  c.save();
  const pr = mulberry(3301);
  for (let i = 0; i < Math.ceil(total / 90) + 6; i++) {
    const x = pr() * W, y = pr() * total;
    const rx = 46 + pr() * 78, ry = 26 + pr() * 40;
    c.globalAlpha = .07 + pr() * .07;
    c.fillStyle = pr() > .45
      ? (PAL.dark ? '#2C4430' : '#8FB673')
      : (PAL.dark ? '#16241A' : '#CBDDA9');
    ellipse(c, x, y, rx, ry); c.fill();
  }
  c.globalAlpha = 1;
  /* clover and daisies, in clumps because that is how they grow */
  c.globalAlpha = .72;
  for (let i = 0; i < Math.ceil(total / 260) + 2; i++) {
    const cx2 = pr() * W, cy2 = pr() * total;
    const petal = pr() > .5 ? (PAL.dark ? '#9BA9C0' : '#EFE4C4') : (PAL.dark ? '#8F82AA' : '#E5CB84');
    for (let k = 0; k < 3 + (pr() * 3 | 0); k++) {
      const x = cx2 + (pr() - .5) * 46, y = cy2 + (pr() - .5) * 34;
      c.fillStyle = PAL.dark ? '#3E5C3C' : '#84A867';
      c.fillRect(x - .4, y, 1, 3.2);
      c.fillStyle = petal;
      ellipse(c, x, y - .8, 1.4, 1.4); c.fill();
    }
  }
  c.globalAlpha = 1;
  c.restore();

  /* ---- the road ---- */
  const laneOrder = MAP.nodes.slice().reverse();
  const lanePath = () => {
    c.beginPath();
    laneOrder.forEach((n, i) => {
      if (!i) { c.moveTo(n.x, n.y + 90); c.lineTo(n.x, n.y); return; }
      const prev = laneOrder[i - 1];
      const my = lerp(prev.y, n.y, .5);
      c.bezierCurveTo(prev.x, my, n.x, my, n.x, n.y);
    });
    const last = laneOrder[laneOrder.length - 1];
    if (last) c.lineTo(last.x, last.y - 70);
    c.stroke();
  };
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = PAL.dark ? '#2F3F2C' : '#C7D8A8';
  c.lineWidth = 46; lanePath();
  c.strokeStyle = PAL.dark ? '#5C5142' : '#E8D8B6';
  c.lineWidth = 32; lanePath();
  c.strokeStyle = rgba(PAL.dark ? '#3E362B' : '#CBB68F', .75);
  c.lineWidth = 2.4; c.setLineDash([7, 13]); lanePath();
  c.setLineDash([]);
  c.restore();

  /* ---- what stands beside the road ---- */
  const warmth = lampStrength(ph);
  /* Things stand at a distance that says what they are. A lamppost
     lights the road, so it stands at the kerb; a hedge follows it; a
     cottage is set back off it. Dropped at one arbitrary distance they
     all read as clip art floating in a field. */
  const KERB = 23;
  /* An honest random picks the same thing three times in a row often
     enough to notice, and three lampposts in a row is the one thing a
     lane is never going to have. Each node takes the next kind that is
     not one of the last two. */
  let lastKinds = [];
  MAP.nodes.forEach(n => {
    const r = mulberry(n.n * 7717);
    const side = (n.n % 2) ? 1 : -1;
    let kind = Math.floor(r() * 5);
    for (let g = 0; g < 5 && lastKinds.indexOf(kind) >= 0; g++) kind = (kind + 1) % 5;
    lastKinds.push(kind); if (lastKinds.length > 2) lastKinds.shift();
    /* clamped by the prop's own half width, or a cottage set near the
       edge hangs half of itself off the screen */
    const at = (d, half) => clamp(n.x + side * d, (half || 20) + 6, W - (half || 20) - 6);
    const y = n.y + 16;
    /* The end of a block gets a gate on the verge instead of whatever
       the roll said. It is the one place on this lane where something
       happens, and the map used to mark it with a ring around the node
       and nothing in the world. It stands open once the level behind it
       is cleared. */
    if (typeof isGate === 'function' && isGate(n.n)) {
      drawGateway(c, at(KERB + 52, 34), y + 8, 64, SAVE.stars[n.n] > 0);
      if (r() > .45) drawBush(c, clamp(n.x - side * (KERB + 20 + r() * 40), 24, W - 24), y + 22, 9 + r() * 6);
      return;
    }
    if (kind === 0) drawTree(c, at(KERB + 34 + r() * 30, 26), y + 6, 28 + r() * 18, n.n * .7);
    else if (kind === 1) drawCottage(c, at(KERB + 62 + r() * 34, 30), y, 38 + r() * 14, n.n);
    else if (kind === 2) {
      /* a run of fence along the verge, not one panel in the middle of nowhere */
      const fx = at(KERB + 12, 20);
      for (let k = -1; k <= 1; k++) drawFence(c, fx, y + k * 30, 34);
    } else if (kind === 3) drawLampPost(c, at(KERB + 6, 12), y, 46, warmth, n.n * .9);
    else {
      /* bushes come in threes, tucked into the verge */
      const bx = at(KERB + 16 + r() * 18, 26);
      drawBush(c, bx, y, 17 + r() * 8);
      drawBush(c, bx + side * 17, y + 9, 12 + r() * 6);
      drawBush(c, bx - side * 13, y + 12, 10 + r() * 5);
    }
    /* whatever is on one side, put something small on the other, so the
       lane is not bare down one flank for a whole screen at a time */
    if (r() > .45) drawBush(c, clamp(n.x - side * (KERB + 20 + r() * 40), 24, W - 24), y + 22, 9 + r() * 6);
  });

  /* paw prints between nodes */
  c.save();
  c.globalAlpha = .3;
  const rev = MAP.nodes.slice().reverse();
  for (let i = 0; i < rev.length - 1; i++) {
    const a = rev[i], b = rev[i + 1];
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      const x = lerp(a.x, b.x, t) + (k % 2 ? 9 : -9);
      const y = lerp(a.y, b.y, t);
      c.save(); c.translate(x, y); c.rotate(Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2);
      c.fillStyle = PAL.textDim;
      ellipse(c, 0, 2.5, 3.4, 4.4); c.fill();
      [-1, 1].forEach(s2 => { ellipse(c, s2 * 3.2, -2.6, 1.5, 2); c.fill(); });
      [-1, 1].forEach(s2 => { ellipse(c, s2 * 1.1, -4.4, 1.5, 2); c.fill(); });
      c.restore();
    }
  }
  c.restore();

  MAP.nodes.forEach(n => {
    if (n.y < off - 90 || n.y > off + H + 90) return;   /* off screen */
    drawMapNode(c, n);
  });

  /* header at the top of the scroll */
  c.save();
  c.textAlign = 'center';
  c.fillStyle = PAL.textDim;
  c.font = '700 12px Karla, sans-serif';
  c.fillText(LANG === 'tr' ? 'YUKARISI HENÜZ İNŞA EDİLMEDİ' : 'THE LANE KEEPS GOING', W / 2, 34);
  c.restore();
  c.restore();                            /* undo the scroll translate */
}
function drawMapNode(c, n) {
  const gate = typeof isGate === 'function' && isGate(n.n);
  const cleared = SAVE.stars[n.n] > 0;
  const unlocked = n.n <= SAVE.reached;
  const current = n.n === SAVE.reached;
  const R = current ? 29 : 24;
  c.save();
  /* shadow */
  c.fillStyle = rgba('#2A1E12', PAL.dark ? .45 : .18);
  ellipse(c, n.x, n.y + R * .5, R * .9, R * .3); c.fill();
  /* body */
  let fill1, fill2, txt;
  if (!unlocked) { fill1 = PAL.surface3; fill2 = shade(PAL.surface3, -.14); txt = PAL.textDim; }
  else if (cleared) { fill1 = mix(PAL.sage, '#FFFFFF', .25); fill2 = PAL.sage; txt = inkOn(PAL.sage); }
  else { fill1 = mix(PAL.accent, '#FFFFFF', .3); fill2 = PAL.accent; txt = inkOn(PAL.accent); }
  const g = c.createLinearGradient(0, n.y - R, 0, n.y + R);
  g.addColorStop(0, fill1); g.addColorStop(1, fill2);
  c.fillStyle = g;
  ellipse(c, n.x, n.y, R, R); c.fill();
  c.strokeStyle = rgba('#FFFFFF', .5); c.lineWidth = 2.4;
  ellipse(c, n.x, n.y - 1, R - 2, R - 2); c.stroke();
  /* The gate at the end of a block wears a ring of its own, so it can be
     seen coming from four levels away — which is the whole point of
     putting one there. */
  if (gate && unlocked && !cleared) {
    c.save();
    c.strokeStyle = PAL.rose; c.lineWidth = 2.6;
    c.setLineDash([5, 4]);
    ellipse(c, n.x, n.y, R + 4, R + 4); c.stroke();
    c.restore();
  } else if (gate && cleared) {
    c.save();
    c.strokeStyle = rgba(PAL.rose, .5); c.lineWidth = 2;
    ellipse(c, n.x, n.y, R + 4, R + 4); c.stroke();
    c.restore();
  }
  if (current) {
    c.strokeStyle = PAL.accent; c.lineWidth = 3;
    c.globalAlpha = .35 + (Math.sin(performance.now() / 380) + 1) / 2 * .5;
    ellipse(c, n.x, n.y, R + 7, R + 7); c.stroke();
    c.globalAlpha = 1;
  }
  /* label */
  if (!unlocked) {
    c.save();
    c.translate(n.x - 9, n.y - 9);
    c.scale(.75, .75);
    c.fillStyle = txt;
    c.fillRect(2, 12, 20, 13);
    c.strokeStyle = txt; c.lineWidth = 2.6;
    c.beginPath(); c.arc(12, 12, 6, Math.PI, 0); c.stroke();
    c.restore();
  } else {
    c.fillStyle = txt;
    c.font = '800 ' + (current ? 19 : 16) + 'px Grandstander, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(n.n, n.x, n.y + 1);
  }
  /* Every fifth level pays two treats the first time it is cleared, and
     nothing said so. Shown until it has been paid. */
  if (unlocked && !cleared && n.n % 5 === 0) {
    const bx = n.x + R * .78, by = n.y - R * .78, br = R * .46;
    c.fillStyle = rgba('#2A1E12', PAL.dark ? .5 : .25);
    ellipse(c, bx, by + R * .07, br, br); c.fill();
    c.fillStyle = PAL.surface;
    ellipse(c, bx, by, br, br); c.fill();
    c.strokeStyle = rgba(PAL.accent, .9); c.lineWidth = R * .075;
    ellipse(c, bx, by, br, br); c.stroke();
    drawTreatPip(c, bx, by, R * .24);
  }

  /* stars */
  if (cleared) {
    const s = SAVE.stars[n.n];
    const PIP = new Path2D('m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.9z');
    for (let i = 0; i < 3; i++) {
      /* a shallow crown across the top of the node, not a wide scatter */
      const a = -Math.PI * .66 + i * Math.PI * .16;
      const won = i < s;
      const rad = R + 7 + (i === 1 ? 1.5 : 0);          /* middle one rides higher */
      const sx = n.x + Math.cos(a) * rad, sy = n.y + Math.sin(a) * rad;
      c.save();
      c.translate(sx, sy);
      c.scale(won ? .42 : .38, won ? .42 : .38);
      c.translate(-12, -12);
      /* a dark seat under every pip so it reads on grass or on path */
      c.fillStyle = rgba('#1B2416', .45);
      c.save(); c.translate(0, 1.6); c.fill(PIP); c.restore();
      c.fillStyle = won ? PAL.accent : rgba(PAL.textDim, .62);
      c.fill(PIP);
      c.restore();
    }
  }
  c.restore();
}
/* Whether the lane is the screen being looked at. It used to read
   SCREEN, which lives in 60-ui.js — the map asking the interface where
   the player is. It is told instead. */
let mapShown = false;
EV.on('screen', name => { mapShown = name === 'map'; });

function bindMap() {
  const cv = $('#mapCanvas');
  const wrap = $('#mapWrap');
  let queued = false;
  wrap.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; if (mapShown) drawMap(); });
  }, { passive: true });
  cv.addEventListener('click', ev => {
    const rect = cv.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top + ($('#mapWrap') ? $('#mapWrap').scrollTop : 0);
    for (const n of MAP.nodes) {
      if (Math.hypot(n.x - x, n.y - y) < 32) {
        audioResume();
        if (n.n > SAVE.reached) { SFX.bad(); toast(T('map_locked', { n: SAVE.reached }), 'lock'); return; }
        SFX.select();
        EV.emit('lane', n.n);
        return;
      }
    }
  });
}
function scrollMapToCurrent(instant) {
  const wrap = $('#mapWrap');
  const node = MAP.nodes.find(n => n.n === SAVE.reached);
  if (!node) return;
  const target = clamp(node.y - wrap.clientHeight * .62, 0, Math.max(0, (MAP.total || 0) - wrap.clientHeight));
  wrap.scrollTo({ top: target, behavior: instant ? 'auto' : 'smooth' });
}
