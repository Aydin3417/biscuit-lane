/* ============================================================
   70 — boot, ambience, resize, lifecycle
   ============================================================ */
/* Ambience behind the app frame: dust and the odd paw print,
   drifting up past the phone. Owned here, not by the scene layer. */
const AMB = { ctx: null, w: 0, h: 0, list: [], raf: null, last: 0 };
function motesLayout() {
  const cv = $('#motes');
  const w = window.innerWidth, h = window.innerHeight;
  AMB.w = w; AMB.h = h;
  AMB.ctx = fitCanvas(cv, w, h);
  const want = w > 900 ? 28 : 16;
  AMB.list.length = 0;
  for (let i = 0; i < want; i++) {
    AMB.list.push({
      x: Math.random() * w, y: Math.random() * h,
      s: rnd(4, 13), sp: rnd(6, 17), a: rnd(.05, .16),
      rot: rnd(0, 6.3), spin: rnd(-.4, .4), drift: rnd(0, 6.3),
      paw: Math.random() < .42
    });
  }
}
function motesLoop(t) {
  const c = AMB.ctx;
  if (!c) return;
  const dt = Math.min(.05, (t - AMB.last) / 1000);
  AMB.last = t;
  c.clearRect(0, 0, AMB.w, AMB.h);
  const col = PAL.dark ? '#F6EDE0' : '#7A5A3A';
  AMB.list.forEach(m => {
    m.y -= m.sp * dt;
    m.rot += m.spin * dt;
    m.drift += dt;
    if (m.y < -22) { m.y = AMB.h + 22; m.x = Math.random() * AMB.w; }
    c.save();
    c.globalAlpha = m.a;
    c.translate(m.x + Math.sin(m.drift * .6) * 9, m.y);
    c.rotate(m.rot);
    c.fillStyle = col;
    if (m.paw) {
      const r = m.s * .3;
      ellipse(c, 0, r * .6, r * .95, r * 1.15); c.fill();
      [-1, 1].forEach(sx => { ellipse(c, sx * r * 1.15, -r * .55, r * .42, r * .58); c.fill(); });
      [-1, 1].forEach(sx => { ellipse(c, sx * r * .42, -r * 1.35, r * .42, r * .58); c.fill(); });
    } else {
      ellipse(c, 0, 0, m.s * .3, m.s * .3); c.fill();
    }
    c.restore();
  });
  AMB.raf = requestAnimationFrame(motesLoop);
}

let resizeT = null;
function onResize() {
  if (resizeT) clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    motesLayout();
    readPalette();
    clearSprites();
    if (SCREEN === 'home') roomLayout();
    if (SCREEN === 'map') { mapLayout(); scrollMapToCurrent(true); }
    if (SCREEN === 'game') layoutBoard();
    paintLogo();
  }, 140);
}

/* ---------------- installed on a phone ----------------

   Three small things that decide whether this reads as a game you keep
   or a page you happened to open.

   The status bar takes the game's own background, so the strip above
   the top bar is the same colour as the top bar rather than white — and
   it follows Day and Dusk, because a dark game under a cream status bar
   looks like a bug.

   The service worker is a sibling file, so it is only there when the
   game is served rather than opened as a single file. Registration is
   wrapped: on file:// it throws, on a bare artifact host it 404s, and
   neither is a reason for anything to go wrong.

   And an installed app has no address bar to go back to, so the pull to
   refresh that Android puts on a scrollable page is a way to lose a
   level and nothing else. The layout is fixed, so it is already gone —
   this only stops the double-tap zoom that survives it. */
function themeColorSync() {
  const m = document.querySelector('meta[name="theme-color"]');
  if (!m) return;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (bg) m.setAttribute('content', bg);
}

function installApp() {
  themeColorSync();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* not served with one */ });
    });
  }
  /* iOS fires a second tap as a zoom if two land inside 300ms, which on
     a board of 42px cells is an ordinary pair of matches */
  let lastTap = 0;
  document.addEventListener('touchend', e => {
    const t = Date.now();
    if (t - lastTap < 320) e.preventDefault();
    lastTap = t;
  }, { passive: false });
  /* two fingers on a puzzle board is never a pinch */
  document.addEventListener('gesturestart', e => e.preventDefault());
}

function boot() {
  const had = loadSave();
  if (SAVE.settings.lang) LANG = SAVE.settings.lang;
  else { LANG = (navigator.language || 'en').toLowerCase().indexOf('tr') === 0 ? 'tr' : 'en'; SAVE.settings.lang = LANG; }

  applyTheme();
  readPalette();
  installApp();
  motesLayout();
  AMB.last = performance.now();
  if (!reduceMotion()) AMB.raf = requestAnimationFrame(motesLoop);

  paintLogo();
  $('#brandSub').textContent = T('brandSub');
  { const rt = $('#rotT'), rs = $('#rotS');
    if (rt) rt.textContent = T('rot_t');
    if (rs) rs.textContent = T('rot_s'); }
  buildTabs();
  bindBoard();
  bindMap();
  bindRoomTap();
  $('#btnSettings').innerHTML = IC.gear;
  $('#btnSettings').addEventListener('click', () => { audioResume(); openSettings(); });
  $('#btnQuit').innerHTML = IC.back;
  $('#btnQuit').addEventListener('click', () => { SFX.tap(); confirmQuit(); });
  $('#chipHearts').addEventListener('click', () => { if (SAVE.hearts < HEART_MAX) noHeartsSheet(); });
  $('#chipTreats').addEventListener('click', () => {
    const m = modal(`<span style="color:var(--plum);width:48px;height:48px;align-self:center">${IC.treat}</span>
      <h2>${T('shop_treats_t')}</h2><p>${T('shop_treats_s')}</p>
      <button class="btn primary wide" id="trOk">${T('ok')}</button>`);
    $('#trOk', m.el).addEventListener('click', m.close);
  });

  catchUpPets();
  heartTick();
  syncPurse();
  /* a save carried over from an older build may already have earned
     things, so sweep once on load rather than waiting for the next win */
  const owed = checkBadges();
  if (owed.length) setTimeout(() => badgeModal(owed), 1200);

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => { if (SAVE.settings.theme === 'auto') applyTheme(); };
    mq.addEventListener ? mq.addEventListener('change', h) : mq.addListener(h);
  }
  /* A phone in a pocket should not be running a game loop. The browser
     throttles rAF for a hidden tab anyway, but "throttled" is not
     "stopped", and an installed app spends a lot of its life in the
     background. Stopping them also fixes the first frame back: both
     loops take their timestamp when they start, so a loop left running
     across ten minutes in a pocket wakes up with a ten-minute gap to
     account for. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      musicStop(); persist(true);
      gameLoopStop(); roomStop();
    } else {
      catchUpPets(); heartTick(); syncPurse(); syncTabs();
      if (SAVE.hearts < HEART_MAX) heartClockStart();
      if (SAVE.settings.music) musicStart();
      if (SCREEN === 'home') { renderHome(); roomLayout(); roomStart(); }
      if (SCREEN === 'game') { layoutBoard(); gameLoopStart(); }
    }
  });
  window.addEventListener('beforeunload', () => persist(true));
  setInterval(() => {
    heartTick();
    if (SCREEN !== 'game') syncPurse();
  }, 1000);
  setInterval(() => {
    /* slow live decay while the app is open */
    SAVE.pets.forEach(p => simulatePet(p, 30000));
    SAVE.lastSeen = now();
    persist();
    if (SCREEN === 'home') renderHome();
  }, 30000);

  relabelControls();

  /* If the window refuses to store anything the game still plays, and a
     whole evening of it disappears when the tab closes. Say so once. */
  if (!canStore()) setTimeout(() => toast(T('no_save'), 'lock'), 1400);

  /* a heart on its way back gets a second hand from the start, not only
     after the player spends one */
  if (SAVE.hearts < HEART_MAX) heartClockStart();

  /* first gesture starts the audio engine */
  const kick = () => { audioResume(); musicSync(); document.removeEventListener('pointerdown', kick); };
  document.addEventListener('pointerdown', kick);

  if (!had) {
    $('#topbar').style.visibility = 'hidden';
    $('#tabbar').style.visibility = 'hidden';
    runOnboarding();
    const watch = setInterval(() => {
      if (SAVE.pets.length) {
        clearInterval(watch);
        $('#topbar').style.visibility = '';
        $('#tabbar').style.visibility = '';
        syncPurse();
      }
    }, 300);
    SCREEN = '';
    setScreen('home');
  } else {
    SCREEN = '';
    setScreen('home');
    if (giftReady()) setTimeout(openDailyGift, 700);
  }
}

/* a small handle for debugging in the console */
window.BL = {
  set fast(v) { FAST_FORWARD = !!v; },
  get fast() { return FAST_FORWARD; },
  get save() { return SAVE; },
  get game() { return G; },
  get screen() { return SCREEN; },
  get room() { return ROOM; },
  get map() { return MAP; },
  /* the sound can only be measured by rebuilding it against an offline
     context, so the harness needs to be able to throw the graph away */
  audio: {
    get au() { return AU; },
    init: audioInit,
    /* the music schedules on a wall clock, which does not run in an
       offline context, so a harness has to place the beats itself */
    beat: musicBeat,
    get step() { return AU.step; },
    set step(v) { AU.step = v; },
    reset() {
      /* the music keeps a timer that schedules notes into whatever
         context is current, which would land in the one being measured */
      try { musicStop(); } catch (e) { }
      AU.musicOn = false;
      if (AU.musicTimer) { clearTimeout(AU.musicTimer); AU.musicTimer = null; }
      try { if (AU.ctx && AU.ctx.close) AU.ctx.close(); } catch (e) { }
      AU.ctx = null; AU.master = null; AU.sfxBus = null; AU.musBus = null;
      AU.verb = null; AU.verbGain = null; AU.comp = null; AU.noise = null;
      AU.ready = false; AU.voices = 0; AU.intensity = 0;
      audioBroken = false;
    }
  },
  setScreen, startLevel, openLevelIntro, renderHome, renderShop, renderFamily,
  levelDef, findMatches, allMoves, hasMove, tryMove, canSwap, firePetAbility, persist, wipeSave,
  perksFor, activePet, makePet, healPet, loadSave, freshSave, BREEDS, LEVELS,
  checkBadges, badgesWon, badgeProgress, bumpCare, settleTrait,
  dailyState, dailyDone, dailyLevel, dayNumber, DAILY_LEVEL, startDailyWalk,
  setLang,
  openSettings, openDailyGift, keyboardHelp, howToPlay, badgeModal, traitModal, stageUpModal, noHeartsSheet, confirmQuit,
  traitChargeScale, traitCoinScale, traitMoveBonus, traitDecayScale, BADGES, TRAITS,
  simulatePet, carePlay, careWash, careSleep, moodOf, DECAY, SLEEPY,
  popScale, popAlpha, showWin, showLose, bestHint, hintScore, drawLogo,
  /* render entry points, so a frame can be forced without rAF */
  renderGame, renderRoom, drawMap, layoutBoard, mapLayout, roomLayout, applyTheme,
  paintTile, paintCrate, paintMud, paintPup, paintGood, drawFace, drawBody,
  specOf, specOfPet, fitCanvas, get PAL() { return PAL; }, FX, SFX
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
