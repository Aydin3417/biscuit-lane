/* ============================================================
   dev/lab.js — the art, physics and sound bench.
   Not shipped. It exists so every asset can be looked at, poked
   and listened to without playing to level 12 first.
   ============================================================ */
(function () {
  'use strict';

  /* ---- boot the bits the game normally sets up ---- */
  loadSave();
  SAVE.settings.sound = true;
  /* the bench always shows one of every breed, whatever is saved */
  SAVE.pets = BREEDS.map((b, i) => makePet(i, i % 3, i % EYE_COLORS.length));
  SAVE.pets[2].bond = 16; SAVE.pets[4].bond = 8;
  SAVE.pets[1].hat = 'beanie'; SAVE.pets[3].collar = 'red';
  SAVE.pets[5].hat = 'crown'; SAVE.pets[0].collar = 'bandana';
  SAVE.activePet = SAVE.pets[0].id;
  readPalette();

  const cv = id => document.getElementById(id);
  const ctxs = {};
  function ctx(id, w, h) {
    const el = cv(id);
    if (!el) return null;
    if (!ctxs[id] || ctxs[id]._w !== w || ctxs[id]._h !== h) {
      const c = fitCanvas(el, w, h);
      c._w = w; c._h = h;
      ctxs[id] = c;
    }
    return ctxs[id];
  }

  /* ============ 1. tiles ============ */
  function drawTiles() {
    const cols = BREEDS.length, rows = 5;
    const px = 62, gapX = 76, gapY = 84;
    const W = cols * gapX + 24, H = rows * gapY + 24;
    const c = ctx('cTiles', W, H);
    c.clearRect(0, 0, W, H);
    const sps = [SP.NONE, SP.ROW, SP.COL, SP.BOMB, SP.RAIN];
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < cols; i++) {
        const sprite = tileSprite(i, sps[r], px, r === 0 && i > 2);
        const x = 12 + i * gapX + gapX / 2, y = 12 + r * gapY + gapY / 2;
        c.drawImage(sprite, x - sprite._w / 2, y - sprite._w / 2, sprite._w, sprite._w);
      }
    }
  }

  /* ============ 2. blockers ============ */
  function drawBlockers() {
    const items = ['crate2', 'crate1', 'mud2', 'mud1', 'ice', 'pup'];
    const px = 68, gap = 86;
    const W = items.length * gap + 24, H = gap + 30;
    const c = ctx('cBlock', W, H);
    c.clearRect(0, 0, W, H);
    c.fillStyle = PAL.boardBg;
    rr(c, 0, 0, W, H, 14); c.fill();
    items.forEach((id, i) => {
      const x = 12 + i * gap + gap / 2, y = H / 2 - 4;
      c.save();
      drawCellBed(c, x, y, px, { hole: false }, i % 2 === 0);
      c.translate(x, y);
      if (id === 'crate2') paintCrate(c, px, 2);
      else if (id === 'crate1') paintCrate(c, px, 1);
      else if (id === 'mud2') paintMud(c, px, 2);
      else if (id === 'mud1') paintMud(c, px, 1);
      else if (id === 'ice') { const s = tileSprite(2, SP.NONE, px * .9, false); c.drawImage(s, -s._w / 2, -s._w / 2, s._w, s._w); paintIce(c, px); }
      else paintPup(c, px, 3);
      c.restore();
    });
  }

  /* ============ 3. pets ============ */
  const petRigs = SAVE.pets.map(p => petRig(p));
  function drawPets(dt, t) {
    const W = 720, H = 260;
    const c = ctx('cPets', W, H);
    c.clearRect(0, 0, W, H);
    c.fillStyle = PAL.surface2;
    rr(c, 0, 0, W, H, 16); c.fill();
    const base = H * .58;
    c.fillStyle = rgba(PAL.line, .5);
    c.fillRect(0, base + 62 * .93, W, 2);
    const moods = ['happy', 'content', 'sleeping', 'hungry', 'bored', 'dirty'];
    SAVE.pets.slice(0, 6).forEach((p, i) => {
      const r = petRigs[i];
      rigStep(r, dt, { mood: moods[i] });
      const x = W / 6 * (i + .5);
      drawPetLive(c, p, x, base, 62, r, { mood: moods[i] });
      c.fillStyle = PAL.textDim;
      c.font = '600 11px Karla, sans-serif';
      c.textAlign = 'center';
      c.fillText(moods[i], x, H - 12);
    });
  }

  /* ============ 4. room ============ */
  const roomRig = petRig(SAVE.pets[0]);
  let roomHour = null;
  function drawRoomCard(dt, t) {
    const W = 360, H = 300;
    const c = ctx('cRoom', W, H);
    rigStep(roomRig, dt, { mood: 'content' });
    drawRoom(c, W, H, {
      t, pet: SAVE.pets[0], rig: roomRig, theme: cv('roomTheme').value,
      placed: ['rug', 'plant', 'shelf', 'lamp', 'tower', 'window', 'basket', 'poster'],
      phase: roomHour === null ? undefined : dayPhase(roomHour),
      mood: 'content'
    });
  }

  /* ============ 5. lane ============ */
  let laneScroll = 0;
  function drawLaneCard(dt, t) {
    const W = 360, H = 300;
    const c = ctx('cLane', W, H);
    laneScroll += dt * 18;
    drawLane(c, W, H, {
      t, scroll: laneScroll, gap: 104, reached: 7,
      stars: { 1: 3, 2: 3, 3: 2, 4: 3, 5: 1, 6: 2 },
      phase: roomHour === null ? undefined : dayPhase(roomHour)
    });
  }

  /* ============ 6. fx playground ============ */
  const FXW = 360, FXH = 300;
  function drawFxCard(dt, t) {
    const c = ctx('cFx', FXW, FXH);
    c.clearRect(0, 0, FXW, FXH);
    c.save();
    c.translate(FXW / 2, FXH / 2);
    camApply(c);
    c.translate(-FXW / 2, -FXH / 2);
    drawTray(c, 20, 20, FXW - 40, FXH - 40, 10);
    /* a few tiles so the effects have something to sit on */
    const s = 54;
    for (let r = 0; r < 4; r++) {
      for (let i = 0; i < 5; i++) {
        const x = 46 + i * s * 1.1, y = 46 + r * s * 1.1;
        drawCellBed(c, x, y, s, { hole: false }, (r + i) % 2 === 0);
        const sp = tileSprite((r + i) % BREEDS.length, SP.NONE, s * .92, false);
        c.drawImage(sp, x - sp._w / 2, y - sp._w / 2, sp._w, sp._w);
      }
    }
    FX.draw(c);
    FX.drawText(c);
    c.restore();
  }
  function fxAt() { return [rnd(70, FXW - 70), rnd(70, FXH - 70)]; }
  const fxActions = {
    pop() { const [x, y] = fxAt(); FX.pop(x, y, pick(BREEDS).gem, 54, { floor: FXH - 30 }); SFX.pop(1, 0, (x / FXW) * 2 - 1); FX.text(x, y - 20, '+120', { col: '#FFF' }); },
    cascade() {
      for (let i = 0; i < 6; i++) setTimeout(() => {
        const [x, y] = fxAt();
        FX.pop(x, y, pick(BREEDS).gem, 54, { floor: FXH - 30 });
        SFX.pop(Math.min(i + 1, 5), 0, (x / FXW) * 2 - 1);
        FX.text(x, y - 20, '+' + (120 * (i + 1)), { col: PAL.accent });
      }, i * 150);
      SFX.combo(4);
    },
    blast() { const [x, y] = fxAt(); FX.blast(x, y, 54); SFX.bomb((x / FXW) * 2 - 1); },
    rocket() {
      const y = rnd(60, FXH - 60);
      SFX.rocket(0);
      let x = 30;
      const id = setInterval(() => {
        FX.rocketTrail(x, y, PAL.accent, 54, 1, 0);
        x += 16;
        if (x > FXW - 20) clearInterval(id);
      }, 16);
    },
    wood() { const [x, y] = fxAt(); FX.splinters(x, y, 54, true); SFX.crate(true, (x / FXW) * 2 - 1); },
    ice() { const [x, y] = fxAt(); FX.shards(x, y, 54); SFX.ice((x / FXW) * 2 - 1); },
    mud() { const [x, y] = fxAt(); FX.splat(x, y, 54, FXH - 34); SFX.mud((x / FXW) * 2 - 1); },
    confetti() { FX.confetti(FXW / 2, 20, FXW, FXH - 26, 70); SFX.win(); },
    hearts() { FX.hearts(FXW / 2, FXH * .6, 8); SFX.purr(); },
    shake() { FX.shake(.6); FX.punchZoom(-2); SFX.bomb(0); }
  };

  /* ============ 7. gravity bench ============ */
  const GW = 360, GH = 300;
  const dropCols = 5, dropTiles = [];
  let dropTimer = 0;
  function seedDrop() {
    dropTiles.length = 0;
    for (let i = 0; i < dropCols; i++) {
      for (let k = 0; k < 3; k++) {
        dropTiles.push({
          id: i * 10 + k, type: (i + k) % BREEDS.length,
          x: i, y: -1.4 - k * 1.15 - i * .1, ty: 3 - k,
          vy: 0, rest: false, sq: mkSpring(0)
        });
      }
    }
  }
  seedDrop();
  function drawGravity(dt, t) {
    const c = ctx('cGrav', GW, GH);
    c.clearRect(0, 0, GW, GH);
    const s = 56, ox = (GW - dropCols * s) / 2, oy = 40;
    drawTray(c, ox - 6, oy - 6, dropCols * s + 12, 4 * s + 12, 10);
    for (let r = 0; r < 4; r++) for (let i = 0; i < dropCols; i++) {
      drawCellBed(c, ox + i * s + s / 2, oy + r * s + s / 2, s, { hole: false }, (r + i) % 2 === 0);
    }
    dropTiles.forEach(tile => {
      fallTick(tile, dt, (tl, force) => {
        SFX.land(force, (tl.x / dropCols) * 2 - 1);
        FX.landPuff(ox + tl.x * s + s / 2, oy + tl.ty * s + s / 2, s, force);
      });
      const sq = squashOf(tile, dt);
      const x = ox + tile.x * s + s / 2;
      const y = oy + tile.y * s + s / 2;
      const sp = tileSprite(tile.type, SP.NONE, s * .92, false);
      c.save();
      c.translate(x, y);
      c.scale(sq[0], sq[1]);
      c.drawImage(sp, -sp._w / 2, -sp._w / 2, sp._w, sp._w);
      c.restore();
    });
    FX.draw(c, false);
    dropTimer += dt;
    if (dropTimer > 2.6) { dropTimer = 0; seedDrop(); }
  }

  /* ============ sound board ============ */
  const SOUNDS = [
    ['tap', () => SFX.tap()], ['select', () => SFX.select()], ['bad', () => SFX.bad()],
    ['swap', () => SFX.swap()], ['pop x1', () => SFX.pop(1, 0, 0)], ['pop x4', () => SFX.pop(4, 0, .5)],
    ['combo', () => SFX.combo(5)], ['rocket', () => SFX.rocket(-.4)], ['bomb', () => SFX.bomb(0)],
    ['rainbow', () => SFX.rainbow()], ['crate', () => SFX.crate(true, 0)], ['ice', () => SFX.ice(0)],
    ['mud', () => SFX.mud(0)], ['land', () => SFX.land(1, 0)], ['whoosh', () => SFX.whoosh(0)],
    ['coin', () => SFX.coin()], ['star 1', () => SFX.star(0)], ['star 3', () => SFX.star(2)],
    ['charge', () => SFX.chargeReady()], ['win', () => SFX.win()], ['lose', () => SFX.lose()],
    ['level up', () => SFX.levelup()], ['meow', () => SFX.meow(1)], ['kitten', () => SFX.meow(1.3)],
    ['bark', () => SFX.bark(1)], ['puppy', () => SFX.bark(1.35)], ['purr', () => SFX.purr()],
    ['eat', () => SFX.eat()], ['splash', () => SFX.splash()], ['snore', () => SFX.snore()],
    ['brush', () => SFX.brush()]
  ];

  /* ============ wiring ============ */
  function buildButtons() {
    const fxBox = cv('fxBtns');
    Object.keys(fxActions).forEach(k => {
      const b = document.createElement('button');
      b.className = 'lb';
      b.textContent = k;
      b.onclick = () => { audioResume(); fxActions[k](); };
      fxBox.appendChild(b);
    });
    const sBox = cv('sfxBtns');
    SOUNDS.forEach(([label, fn]) => {
      const b = document.createElement('button');
      b.className = 'lb';
      b.textContent = label;
      b.onclick = () => { audioResume(); fn(); };
      sBox.appendChild(b);
    });
    cv('cFx').addEventListener('pointerdown', e => {
      audioResume();
      const r = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      FX.pop(x, y, pick(BREEDS).gem, 54, { floor: FXH - 30 });
      SFX.pop(1, 0, (x / FXW) * 2 - 1);
    });
    cv('cPets').addEventListener('pointerdown', e => {
      audioResume();
      const r = e.currentTarget.getBoundingClientRect();
      const i = Math.floor((e.clientX - r.left) / (r.width / 6));
      const p = SAVE.pets[i];
      if (!p) return;
      rigPoke(petRigs[i], 1);
      petVoice(p);
      FX.hearts(0, 0, 0);
    });
    cv('themeBtn').onclick = () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      readPalette();
      clearSprites();
      drawTiles(); drawBlockers();
      cv('themeBtn').textContent = next === 'dark' ? 'Dusk' : 'Day';
    };
    cv('hourSlide').oninput = e => {
      roomHour = Number(e.target.value);
      cv('hourLbl').textContent = String(roomHour).padStart(2, '0') + ':00';
    };
    cv('roomTheme').onchange = () => { };
    cv('musicBtn').onclick = () => {
      audioResume();
      if (AU.musicOn) { musicStop(); cv('musicBtn').textContent = 'Music: off'; }
      else { musicStart(); cv('musicBtn').textContent = 'Music: on'; }
    };
    ROOM_THEMES.forEach(t => {
      const o = document.createElement('option');
      o.value = t.id; o.textContent = t.en;
      cv('roomTheme').appendChild(o);
    });
  }

  /* ============ loop ============ */
  let last = performance.now();
  function frame(now2) {
    const dt = Math.min((now2 - last) / 1000, 1 / 20);
    last = now2;
    const t = now2 / 1000;
    FX.step(dt);
    drawPets(dt, t);
    drawRoomCard(dt, t);
    drawLaneCard(dt, t);
    drawFxCard(dt, t);
    drawGravity(dt, t);
    cv('pcount').textContent = FX.count() + ' particles · ' + AU.voices + ' voices';
    requestAnimationFrame(frame);
  }

  buildButtons();
  drawTiles();
  drawBlockers();
  requestAnimationFrame(frame);
  window.addEventListener('pointerdown', () => audioResume(), { once: true });
})();
