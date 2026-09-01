/* ============================================================
   60 — screens, shop, family, modals, onboarding
   ============================================================ */
let SCREEN = 'home';
const TABS = [
  { id: 'home', icon: 'home', key: 'tab_home' },
  { id: 'map', icon: 'play', key: 'tab_play' },
  { id: 'shop', icon: 'shop', key: 'tab_shop' },
  { id: 'family', icon: 'paw', key: 'tab_family' }
];

function buildTabs() {
  const bar = $('#tabbar');
  bar.innerHTML = '';
  TABS.forEach(t => {
    const b = document.createElement('button');
    b.className = 'tab';
    b.dataset.id = t.id;
    b.innerHTML = IC[t.icon] + '<span>' + T(t.key) + '</span>';
    b.addEventListener('click', () => { audioResume(); SFX.tap(); setScreen(t.id); });
    bar.appendChild(b);
  });
  syncTabs();
}
function syncTabs() {
  $$('#tabbar .tab').forEach(b => b.classList.toggle('on', b.dataset.id === SCREEN));
  const home = $('#tabbar .tab[data-id="home"]');
  if (home) {
    const old = $('.badge', home);
    if (old) old.remove();
    if (giftReady()) {
      const s = document.createElement('span');
      s.className = 'badge';
      s.textContent = '1';
      home.appendChild(s);
    }
  }
}
function setScreen(name) {
  if (name === SCREEN) return;
  /* a breath of air between rooms; into the board is a rise, out of
     it is a fall, so the ear knows which way you went */
  if (SCREEN) SFX.swish(name === 'game');
  SCREEN = name;
  EV.emit('screen', name);
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === 'scr-' + name));
  const inGame = name === 'game';
  $('#topbar').style.display = inGame ? 'none' : '';
  $('#tabbar').style.display = inGame ? 'none' : '';
  if (name === 'home') { renderHome(); roomLayout(); roomStart(); } else roomStop();
  if (name === 'game') {
    layoutBoard(); gameLoopStart();
    /* so the arrow keys reach the board straight away */
    setTimeout(() => { const b = $('#board'); if (b) b.focus({ preventScroll: true }); }, 60);
  } else gameLoopStop();
  if (name === 'map') { mapLayout(); scrollMapToCurrent(true); }
  if (name === 'shop') renderShop();
  if (name === 'family') renderFamily();
  syncTabs();
  syncPurse();
}

/* ---------------- top bar ---------------- */
function syncPurse() {
  heartTick();
  const h = $('#chipHearts');
  const inT = heartsIn();
  h.innerHTML = IC.heart + '<span class="num">' + SAVE.hearts + '</span>' +
    (SAVE.hearts >= HEART_MAX ? '' : '<span class="sub num">' + fmtTime(inT) + '</span>');
  $('#chipCoins').innerHTML = IC.coin + '<span class="num">' + fmt(SAVE.coins) + '</span>';
  $('#chipTreats').innerHTML = IC.treat + '<span class="num">' + fmt(SAVE.treats) + '</span>';
}

/* What the interface answers to.

   These four used to be calls made from underneath: the board called
   showWin(), the save called syncPurse(), the lane called
   openLevelIntro(). Every one of them was a lower layer deciding what
   the screen should do. They are subscriptions now, and the direction
   of the arrow is the whole point — nothing below this file names
   anything in it. */
EV.on('purse', syncPurse);
EV.on('won', showWin);
EV.on('lost', showLose);
EV.on('lane', openLevelIntro);

/* ---------------- home ---------------- */
function heroGift() {
  return `
    <button class="card todayTile giftCard" id="giftCard">
      <span class="gi">${IC.gift}</span>
      <span class="gt">
        <b>${T('home_visit_ready')}</b>
        <small>${T('daily_today', { what: giftSummary(giftFor(giftDay())) })}${SAVE.streak ? ' · ' + T('home_streak', { n: SAVE.streak }) : ''}</small>
      </span>
      <span class="btn sm">${T('home_collect')}</span>
    </button>`;
}
function renderHome() {
  const pet = activePet();
  const pad = $('#homePad');
  if (!pet) { pad.innerHTML = ''; return; }
  $('#petName').textContent = pet.name;
  $('#petMeta').textContent = breedName(pet.breed) + ' · ' + (LANG === 'tr' ? 'Bağ ' : 'Bond ') + pet.bond;
  $('#petStage').textContent = stageName(pet);

  const perks = perksFor(pet);
  /* the stat's colour belongs to its icon and its bar, so the row reads
     as one thing. Four flat bars in four unrelated primaries read as a
     settings screen. */
  const stat = (key, val, col, ic) => `
    <div class="stat" style="--tint:${col}">
      <div class="lb">${IC[ic]}<span>${T(key)}</span><span class="v">${Math.round(val)}</span></div>
      <div class="bar"><i style="width:${clamp(val, 0, 100)}%"></i></div>
    </div>`;

  const foodCount = FOODS.reduce((a, f) => a + (SAVE.food[f.id] || 0), 0);
  const bondPct = (pet.bondXp / bondNeed(pet.bond)) * 100;

  /* The screen the app opens on opens the game. Everything the card
     says is what the level card would say a tap later, so pressing it
     is never a surprise. */
  const nextN = SAVE.reached;
  const nextDef = levelDef(nextN);
  const nextBest = SAVE.scores[nextN] || 0;
  const heroCard = `
    <button class="card playHero" id="goPlay">
      <span class="ph-l">
        <span class="eyebrow">${T('home_next')}</span>
        <b>${T('lvl_intro', { n: nextN })}</b>
        <small>${nextDef.goals.map(g => goalLine({ kind: g[0], arg: g[1], need: g[2] })).join(' · ')}</small>
        ${nextBest ? `<span class="pill info ph-best">${IC.star}${T('map_best', { n: fmt(nextBest) })}</span>` : ''}
      </span>
      <span class="btn primary ph-go">${IC.play}${T('tab_play')}</span>
    </button>`;

  /* The thing the player came to do goes first, and the two smaller
     errands sit side by side under it rather than continuing the column.
     Four full-width cards stacked in a row is the shape of a settings
     screen; it gives the eye no idea which one matters. */
  pad.innerHTML = `
    ${heroCard}
    <div class="todayRow">
    ${giftReady() ? heroGift() : ''}
    ${(() => {
      const d = dailyState();
      const def = dailyLevel(SAVE.reached);
      return `
      <button class="card todayTile dailyCard" id="dailyCard">
        <span class="di">${IC.paw}</span>
        <span class="dt">
          <b>${T('daily_walk')}</b>
          <small>${d.done
        ? T('daily_walk_done') + (d.best ? ' · ' + T('daily_walk_best', { n: fmt(d.best) }) : '')
        : def.goals.map(g => goalLine({ kind: g[0], arg: g[1], need: g[2] })).join(' · ')}</small>
          ${d.streak > 1 ? `<span class="pill warn" style="margin-top:5px">${IC.flame}${T('daily_walk_streak', { n: d.streak })}</span>` : ''}
        </span>
        <span class="btn sm">${d.done ? T('daily_walk_again') : T('daily_walk_go')}</span>
      </button>`;
    })()}
    </div>

    <div class="card pad16" style="display:flex;flex-direction:column;gap:13px">
      <div class="sectitle"><h3>${T('home_care')}</h3><span class="hint">${moodLine(pet)}</span></div>
      <div class="stats">
        ${stat('st_food', pet.food, 'var(--accent)', 'bowl')}
        ${stat('st_joy', pet.joy, 'var(--rose)', 'heart')}
        ${stat('st_clean', pet.clean, 'var(--sky)', 'bath')}
        ${stat('st_energy', pet.energy, 'var(--sage)', 'bolt')}
      </div>
      <div class="careRow">
        <button class="care ${pet.food < 55 ? 'hot' : ''} ${foodCount ? '' : 'dim'}" id="careFeed" style="--tint:var(--accent)">
          ${IC.bowl}<span>${T('care_feed')}</span><span class="cost">${foodCount}</span></button>
        <button class="care ${pet.joy < 55 ? 'hot' : ''} ${pet.asleep ? 'dim' : ''}" id="carePlay" style="--tint:var(--rose)">
          ${IC.ball}<span>${T('care_play')}</span><span class="cost">−${pet.energy < 25 ? 3 : 8} ${T('st_energy').toLowerCase()}</span></button>
        <button class="care ${pet.clean < 55 ? 'hot' : ''} ${pet.asleep ? 'dim' : ''}" id="careWash" style="--tint:var(--sky)">
          ${IC.bath}<span>${T('care_wash')}</span><span class="cost">&nbsp;</span></button>
        <button class="care ${(pet.energy < 30 && !pet.asleep) || (pet.asleep && pet.energy >= 95) ? 'hot' : ''}" id="careSleep" style="--tint:var(--sage)">
          ${pet.asleep ? IC.sun : IC.moon}<span>${pet.asleep ? T('care_wake') : T('care_sleep')}</span><span class="cost">&nbsp;</span></button>
      </div>
      <div style="font-size:var(--t-micro);color:var(--text-faint);text-align:center">${T('home_care_hint')}</div>
    </div>

    ${giftReady() ? '' : `
    <div class="card pad16 giftWait" id="giftWait">
      <span class="gi">${IC.flame}</span>
      <span class="gt">
        <b>${T('home_streak', { n: SAVE.streak })}</b>
        <small>${T('daily_tomorrow', { what: giftSummary(giftFor(giftDayNext())) })}</small>
      </span>
      ${giftLadder(giftDayNext())}
    </div>`}

    <div class="card pad16" style="display:flex;flex-direction:column;gap:10px">
      <div class="sectitle"><h3>${T('home_bond', { name: pet.name })}</h3>
        <span class="hint">${T('home_bond_hint', { lv: pet.bond, have: pet.bondXp, need: bondNeed(pet.bond) })}</span></div>
      <div class="bar"><i style="width:${bondPct}%;background:linear-gradient(90deg,var(--rose),var(--accent))"></i></div>
      <div class="divide"></div>
      <div class="eyebrow">${LANG === 'tr' ? 'Karakter' : 'Who they are'}</div>
      ${pet.trait
      ? `<div style="font-size:var(--t-small)"><b style="font-family:Grandstander,sans-serif">${traitName(pet.trait)}.</b>
         <span style="color:var(--text-dim)">${traitDesc(pet.trait)}</span></div>`
      : `<div style="font-size:var(--t-small);color:var(--text-faint)">${T('trait_none')} ${T('trait_pending', { n: TRAIT_AT_BOND })}</div>`}
      <div class="divide"></div>
      <div class="eyebrow">${T('home_perk')}</div>
      ${perks.length
      ? '<div style="display:flex;gap:6px;flex-wrap:wrap">' + perks.map(p => `<span class="pill ok">${IC.check}${perkLabel(p)}</span>`).join('') + '</div>'
      : `<div style="font-size:var(--t-small);color:var(--text-faint)">${T('home_perk_none', { name: pet.name })}</div>`}
    </div>

  `;

  const gc = $('#giftCard'); if (gc) gc.addEventListener('click', openDailyGift);
  const dc = $('#dailyCard'); if (dc) dc.addEventListener('click', startDailyWalk);
  $('#careFeed').addEventListener('click', openFeed);
  $('#carePlay').addEventListener('click', carePlay);
  $('#careWash').addEventListener('click', careWash);
  $('#careSleep').addEventListener('click', careSleep);
  $('#goPlay').addEventListener('click', () => {
    /* the same route "Carry on" takes at the end of a level: the lane
       underneath, then the card for where you are */
    SFX.tap();
    setScreen('map');
    mapLayout();
    scrollMapToCurrent(true);
    setTimeout(() => openLevelIntro(SAVE.reached), 240);
  });
}
function showMood(text) {
  const b = $('#moodBubble');
  b.textContent = text;
  b.style.left = clamp(ROOM.px * ROOM.w - 40, 12, ROOM.w - 210) + 'px';
  b.style.top = (ROOM.h * .32) + 'px';
  b.classList.add('on');
  clearTimeout(b._t);
  b._t = setTimeout(() => b.classList.remove('on'), 2600);
}
function afterCare(pet, moodKey, bondXp, careKind) {
  const grew = addBond(pet, bondXp);
  const newTrait = careKind ? bumpCare(pet, careKind) : null;
  pet.lastCare = now();
  persist();
  renderHome();
  showMood(T(moodKey));
  if (grew) setTimeout(() => stageUpModal(pet), 500);
  else if (newTrait) setTimeout(() => traitModal(pet), 500);
  const won = checkBadges();
  if (won.length) setTimeout(() => badgeModal(won), grew || newTrait ? 1400 : 500);
  syncPurse();
}
function openFeed() {
  const pet = activePet();
  if (pet.asleep) { SFX.bad(); toast(T('home_asleep', { name: pet.name }), 'paw'); return; }
  const owned = FOODS.filter(f => (SAVE.food[f.id] || 0) > 0);
  if (!owned.length) { SFX.bad(); toast(T('home_no_food'), 'bowl'); return; }
  SFX.tap();
  const m = modal(`
    <h2>${T('care_feed')}</h2>
    <div class="grid2" id="feedGrid">
      ${owned.map(f => `
        <button class="good" data-id="${f.id}">
          <div class="art"><canvas data-art="${f.id}" width="74" height="74"></canvas></div>
          <div class="nm">${goodName(f)}</div>
          <div class="ds">+${f.food} ${T('st_food').toLowerCase()} · +${f.joy} ${T('st_joy').toLowerCase()}</div>
          <span class="pill info" style="align-self:center">x${SAVE.food[f.id]}</span>
        </button>`).join('')}
    </div>
    <button class="btn ghost" id="feedCancel">${T('cancel')}</button>
  `);
  paintArtCanvases(m.el);
  $$('#feedGrid .good', m.el).forEach(b => b.addEventListener('click', () => {
    const f = FOODS.find(x => x.id === b.dataset.id);
    SAVE.food[f.id]--;
    pet.food = clamp(pet.food + f.food, 0, 100);
    pet.joy = clamp(pet.joy + f.joy, 0, 100);
    pet.clean = clamp(pet.clean - 4, 0, 100);
    if (pet.asleep) pet.asleep = false;
    m.close();
    roomAct('eat', 3);
    SFX.eat();
    setTimeout(() => petVoice(pet, 1.05), 900);
    afterCare(pet, 'mood_fed', 1, 'feed');
  }));
  $('#feedCancel', m.el).addEventListener('click', m.close);
}
function carePlay() {
  const pet = activePet();
  /* say why, rather than ignoring the tap */
  if (pet.asleep) { SFX.bad(); toast(T('home_asleep', { name: pet.name }), 'paw'); return; }
  const toy = bestOwnedToy();
  if (!toy && !Object.keys(SAVE.toys || {}).length) { SFX.bad(); toast(T('home_no_toys'), 'ball'); return; }
  /* A tired pet plays anyway, just not for long. Refusing outright was a
     dead end: joy can only be raised by playing, playing was gated on
     energy, and energy has no in-session remedy at all — so a pet that
     ran down stayed miserable for good however hard the player tried. */
  const tired = pet.energy < 25;
  const joy = Math.round((toy ? toy.joy : 10) * (tired ? .45 : 1));
  pet.joy = clamp(pet.joy + joy, 0, 100);
  pet.energy = clamp(pet.energy - (tired ? 3 : 8), 0, 100);
  pet.clean = clamp(pet.clean - 6, 0, 100);
  pet.food = clamp(pet.food - 3, 0, 100);
  roomAct('play', 3);
  petVoice(pet, tired ? .95 : 1.15);
  afterCare(pet, tired ? 'mood_tired_play' : 'mood_played', tired ? 1 : 2, 'play');
}
function careWash() {
  const pet = activePet();
  if (pet.asleep) { SFX.bad(); toast(T('home_asleep', { name: pet.name }), 'paw'); return; }
  pet.clean = 100;
  pet.joy = clamp(pet.joy + (petBreed(pet).species === 'cat' ? -6 : 5), 0, 100);
  pet.energy = clamp(pet.energy - 4, 0, 100);
  roomAct('wash', 3);
  SFX.splash();
  setTimeout(() => petVoice(pet, petBreed(pet).species === 'cat' ? .85 : 1.1), 700);
  afterCare(pet, 'mood_washed', 1, 'wash');
}
function careSleep() {
  const pet = activePet();
  pet.asleep = !pet.asleep;
  roomAct('idle', .1);
  let newTrait = null;
  if (pet.asleep) { SFX.snore(); newTrait = bumpCare(pet, 'sleep'); } else petVoice(pet, 1);
  persist();
  renderHome();
  showMood(pet.asleep ? T('mood_sleeping') : T('mood_content'));
  if (newTrait) setTimeout(() => traitModal(pet), 500);
  const won = checkBadges();
  if (won.length) setTimeout(() => badgeModal(won), newTrait ? 1400 : 500);
  syncPurse();
}
function bindRoomTap() {
  $('#room').addEventListener('click', () => {
    const pet = activePet();
    if (!pet) return;
    audioResume();
    if (pet.asleep) { showMood(T('mood_sleeping')); SFX.snore(); return; }
    if (now() - pet.lastPet < 2500) { showMood(moodLine(pet)); return; }
    pet.lastPet = now();
    pet.joy = clamp(pet.joy + 3, 0, 100);
    roomAct('pet', 2);
    if (petBreed(pet).species === 'cat') SFX.purr(); else petVoice(pet, 1.1);
    afterCare(pet, 'mood_pet', .34);
  });
}
function stageUpModal(pet) {
  SFX.levelup();
  /* the ability got stronger with the stage — say by how much, because
     nothing else in the game ever would */
  const kind = petBreed(pet).ability;
  const st = petStageIdx(pet);
  const nowTxt = abilityPowerText(kind, st);
  const wasN = abilityStep(kind, Math.max(0, st - 1));
  const grewBy = (nowTxt && wasN && abilityStep(kind, st) !== wasN)
    ? T('ab_grew', { now: nowTxt, was: wasN })
    : abilityDesc(pet);
  const m = modal(`
    <canvas id="suArt" width="260" height="260" style="width:130px;height:130px;align-self:center"></canvas>
    <h2>${T('home_stage_up', { name: pet.name })}</h2>
    <p>${T('home_stage_up_sub', { stage: stagePhrase(pet) })}</p>
    <div class="goalItem"><canvas width="64" height="64" data-face="${pet.breed}"></canvas>
      <span class="t"><b>${abilityName(pet)}</b>${grewBy}</span></div>
    <button class="btn primary wide" id="suOk">${T('ok')}</button>
  `);
  const cv = $('#suArt', m.el);
  const c = fitCanvas(cv, 130, 130);
  const spec = specOfPet(pet);
  const now = STAGE_BUILD[clamp(petStageIdx(pet), 0, STAGE_BUILD.length - 1)];
  const was = STAGE_BUILD[clamp(petStageIdx(pet) - 1, 0, STAGE_BUILD.length - 1)];

  /* the sparks that come off it as it settles */
  const spark = [];
  const frame = (build, glow) => {
    c.save();
    c.clearRect(0, 0, 130, 130);
    c.translate(65, 40);
    if (glow > 0) {
      const g = c.createRadialGradient(0, 34, 4, 0, 34, 62);
      g.addColorStop(0, rgba(PAL.accent, .34 * glow));
      g.addColorStop(1, rgba(PAL.accent, 0));
      c.fillStyle = g;
      ellipse(c, 0, 34, 62, 62); c.fill();
    }
    drawBody(c, Object.assign({}, spec, { build: build }), 62, { mouth: 'open' });
    spark.forEach(p2 => {
      if (p2.life <= 0) return;
      c.fillStyle = rgba('#FFF3D6', Math.min(1, p2.life * 1.6));
      ellipse(c, p2.x, p2.y, p2.r, p2.r); c.fill();
    });
    c.restore();
  };

  if (reduceMotion()) {
    frame(now, 0);
  } else {
    const lerpBuild = (a, b, t) => ({
      k: lerp(a.k, b.k, t), sx: lerp(a.sx, b.sx, t),
      sy: lerp(a.sy, b.sy, t), head: lerp(a.head, b.head, t)
    });
    const T0 = performance.now(), DUR = 1150;
    let popped = false;
    const step = () => {
      if (!m.el.isConnected) return;
      const e = clamp((performance.now() - T0) / DUR, 0, 1);
      let build, glow = 0;
      if (e < .16) {
        /* gathers itself first */
        const q = e / .16;
        build = { k: was.k * (1 - .05 * Math.sin(q * Math.PI)), sx: was.sx * (1 + .05 * Math.sin(q * Math.PI)),
                  sy: was.sy * (1 - .07 * Math.sin(q * Math.PI)), head: was.head };
      } else if (e < .62) {
        const q = (e - .16) / .46;
        /* ease out with a little overshoot, so it lands like a body */
        const o = 1 + 2.2 * Math.pow(q - 1, 3) + 1.2 * Math.pow(q - 1, 2);
        build = lerpBuild(was, now, o);
        glow = Math.sin(q * Math.PI) * .9;
        if (!popped && q > .5) {
          popped = true;
          SFX.star();
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2 + Math.random() * .3;
            spark.push({ x: Math.sin(a) * 8, y: 34 + Math.cos(a) * 8,
                         vx: Math.sin(a) * rnd(46, 82), vy: Math.cos(a) * rnd(46, 82) - 22,
                         r: rnd(1.4, 3), life: rnd(.5, .9) });
          }
        }
      } else {
        build = now; glow = clamp((1 - e) / .38, 0, 1) * .35;
      }
      const dt = 1 / 60;
      spark.forEach(p2 => { p2.life -= dt; p2.x += p2.vx * dt; p2.y += p2.vy * dt; p2.vy += 96 * dt; });
      frame(build, glow);
      if (e < 1) requestAnimationFrame(step);
    };
    frame(was, 0);
    requestAnimationFrame(step);
  }

  paintArtCanvases(m.el);
  $('#suOk', m.el).addEventListener('click', m.close);
}

/* helper: paint any <canvas data-art> / data-face / data-tile inside a container

   askSize() exists because cv.width is not the size anybody wrote in the
   markup after the first paint: fitCanvas() sets the backing store to
   size x dpr. Reading it back and passing it in again squares the device
   pixel ratio every time the screen re-renders — 56, then 112, then 224 —
   and the family screen's pet grew until it pushed its own name out of
   the row. The size asked for is remembered on the element instead. */
function askSize(cv, fallback) {
  if (cv.dataset.px === undefined) cv.dataset.px = cv.width || fallback;
  return +cv.dataset.px;
}
function paintArtCanvases(root) {
  $$('canvas[data-art]', root).forEach(cv => {
    const px = askSize(cv, 54);
    const c = fitCanvas(cv, px, px);
    c.translate(px / 2, px / 2);
    /* a shadow under it, so the thing is standing in the niche rather
       than hanging in the middle of a card */
    c.save();
    c.fillStyle = rgba('#3A2A16', .13);
    ellipse(c, 0, px * .30, px * .21, px * .045); c.fill();
    c.restore();
    /* the drawings are laid out inside about six tenths of their box;
       filling more of it is the difference between a good and an icon */
    c.save(); c.scale(1.32, 1.32);
    paintGood(c, cv.dataset.art, px);
    c.restore();
  });
  $$('canvas[data-face]', root).forEach(cv => {
    const px = askSize(cv, 64);
    const c = fitCanvas(cv, px, px);
    c.translate(px / 2, px / 2 + px * .02);
    const idx = +cv.dataset.face;
    const coat = cv.dataset.coat !== undefined ? BREEDS[idx].coats[+cv.dataset.coat] : null;
    drawFace(c, Object.assign(specOf(idx, coat, cv.dataset.eye), { hat: cv.dataset.hat, collar: cv.dataset.collar }), px * .42, { mouth: 'smile' });
  });
  $$('canvas[data-body]', root).forEach(cv => {
    const px = askSize(cv, 64);
    const c = fitCanvas(cv, px, px);
    /* a list row wants a small pet in a lot of air; the win sheet wants
       the pet to be the picture. data-scale lets the caller say which */
    const k = +(cv.dataset.scale || 1);
    c.translate(px / 2, px * (k > 1 ? .20 : .14));
    const idx = +cv.dataset.body;
    const coat = cv.dataset.coat !== undefined ? BREEDS[idx].coats[+cv.dataset.coat] : null;
    drawBody(c, Object.assign(specOf(idx, coat, cv.dataset.eye),
      { hat: cv.dataset.hat, collar: cv.dataset.collar, stage: +(cv.dataset.stage || 0) }), px * .40 * k, { mouth: 'smile' });
  });
  $$('canvas[data-tile]', root).forEach(cv => {
    const px = askSize(cv, 44);
    const c = fitCanvas(cv, px, px);
    c.translate(px / 2, px / 2);
    paintTile(c, +cv.dataset.tile, SP.NONE, px * .9, SAVE.settings.marks);
  });
  $$('canvas[data-room]', root).forEach(cv => {
    const px = askSize(cv, 54);
    const c = fitCanvas(cv, px, px);
    drawFurniturePreview(c, cv.dataset.room, px);
  });
  /* A hat or collar canvas is a *preview*: the active pet wearing the
     thing, so you can see it before you buy it. A canvas that already
     says which body to draw is not one of those — and the family list's
     rows carry all three attributes, because a row states the pet's
     breed and also what it is wearing.

     Without :not([data-body]) those rows match here too, and each one
     is painted three times: once as itself, then twice more as the
     active pet. The last write won, so every pet in the family list was
     drawn as whichever pet was on the board. Two canvases, byte for
     byte identical, with the right breed in their own data attributes. */
  $$('canvas[data-hat]:not([data-body])', root).forEach(cv => {
    const px = askSize(cv, 54);
    const c = fitCanvas(cv, px, px);
    c.translate(px / 2, px * .62);
    const pet = activePet();
    drawFace(c, Object.assign(specOfPet(pet), { hat: cv.dataset.hat, collar: 'none' }), px * .34, { mouth: 'smile' });
  });
  $$('canvas[data-collar]:not([data-body])', root).forEach(cv => {
    const px = askSize(cv, 54);
    const c = fitCanvas(cv, px, px);
    c.translate(px / 2, px * .18);
    const pet = activePet();
    drawBody(c, Object.assign(specOfPet(pet), { hat: 'none', collar: cv.dataset.collar }), px * .36, { mouth: 'smile' });
  });
}
/* Shop thumbnail for one piece of furniture. The room scene draws each
   piece with its own routine, so the preview calls the same ones rather
   than staging a whole room. */
function drawFurniturePreview(c, id, px) {
  const th = ROOM_THEMES.find(x => x.id === SAVE.room.theme) || ROOM_THEMES[0];
  const cx = px / 2, base = px * .78;
  c.save();
  switch (id) {
    case 'rug': drawRug(c, cx, px * .62, px * .84, px * .34, th); break;
    case 'plant': drawFern(c, cx, base, px * .5, 0); break;
    case 'shelf': drawShelf(c, cx, px * .5, px * .78); break;
    case 'poster': drawPoster(c, cx, px * .44, px * .5, activePet()); break;
    /* a faint glow only: at full warmth the falloff is wider than the
       thumbnail and gets cropped into a visible square */
    case 'lamp': drawLamp(c, cx, base, px * .46, .22, 0); break;
    case 'tower': drawTower(c, cx, base, px * .5, px * .62); break;
    case 'window': drawFeeder(c, cx, px * .42, px * .42, 0); break;
    case 'basket': drawBasket(c, cx, px * .66, px * .5); break;
  }
  c.restore();
}

/* ---------------- traits and the shelf ---------------- */
function traitModal(pet) {
  SFX.levelup();
  const m = modal(`
    <canvas id="trArt" width="130" height="130" style="width:130px;height:130px;align-self:center"></canvas>
    <h2>${T('trait_t', { trait: traitName(pet.trait) })}</h2>
    <p>${T('trait_sub', { name: pet.name, how: traitHow(pet.trait).toLowerCase(), what: traitDesc(pet.trait) })}</p>
    <button class="btn primary wide" id="trOk">${T('ok')}</button>
  `);
  const c = fitCanvas($('#trArt', m.el), 130, 130);
  c.translate(65, 16);
  drawBody(c, specOfPet(pet), 58, { mouth: 'open' });
  $('#trOk', m.el).addEventListener('click', m.close);
}

function badgeModal(list) {
  if (!list || !list.length) return;
  SFX.star(2);
  const rows = list.map(b => `
    <div class="goalItem">
      <span class="rosette fam-${b.fam}">${IC[b.icon] || IC.crown}</span>
      <span class="t"><b>${badgeName(b)}</b>${badgeDesc(b)}</span>
      <span class="pill warn">${b.coins ? '+' + b.coins : ''}${b.treats ? ' +' + b.treats + '★' : ''}</span>
    </div>`).join('');
  const m = modal(`
    <span style="color:var(--accent-strong);width:52px;height:52px;align-self:center">${IC.crown}</span>
    <h2>${T('shelf_won')}</h2>
    <div class="goalList">${rows}</div>
    <button class="btn primary wide" id="bdOk">${T('ok')}</button>
  `);
  $('#bdOk', m.el).addEventListener('click', () => { m.close(); syncPurse(); if (SCREEN === 'family') renderFamily(); });
}

function shelfHtml() {
  const have = badgesWon();
  const cells = BADGES.map(b => {
    const got = !!SAVE.badges[b.id];
    const at = Math.min(badgeProgress(b), b.of);
    return `<div class="trophy ${got ? 'got' : ''}" title="${badgeDesc(b)}">
      <span class="bi rosette ${got ? 'fam-' + b.fam : 'locked'}">${got ? (IC[b.icon] || IC.crown) : IC.lock}</span>
      <span class="bn">${badgeName(b)}</span>
      <span class="bp">${got ? badgeDesc(b) : at + ' / ' + b.of}</span>
    </div>`;
  }).join('');
  return `
    <div class="sectitle"><h3>${T('shelf_t')}</h3>
      <span class="hint">${T('shelf_sub', { have, all: BADGES.length })}</span></div>
    <div class="trophyGrid">${cells}</div>`;
}

/* ---------------- shop ---------------- */
let SHOP_TAB = 'food';
function renderShop() {
  const pad = $('#shopPad');
  const tabs = [
    ['food', T('shop_food')], ['toys', T('shop_toys')], ['boost', T('shop_boost')],
    ['style', T('shop_style')], ['room', T('shop_room')]
  ];
  let body = '';
  if (SHOP_TAB === 'food') body = shopFood();
  else if (SHOP_TAB === 'toys') body = shopToys();
  else if (SHOP_TAB === 'boost') body = shopBoost();
  else if (SHOP_TAB === 'style') body = shopStyle();
  else body = shopRoom();

  pad.innerHTML = `
    <div class="tabs">${tabs.map(t => `<button data-t="${t[0]}" class="${SHOP_TAB === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div>
    ${body}
    <div class="card pad16" style="text-align:center">
      <div class="eyebrow" style="margin-bottom:6px">${T('shop_treats_t')}</div>
      <div style="font-size:var(--t-small);color:var(--text-faint);line-height:1.5">${T('shop_treats_s')}</div>
    </div>`;
  $$('.tabs button', pad).forEach(b => b.addEventListener('click', () => { SFX.uiTick(); SHOP_TAB = b.dataset.t; renderShop(); }));
  paintArtCanvases(pad);
  $$('[data-buy]', pad).forEach(b => b.addEventListener('click', () => buyThing(b.dataset.buy, b.dataset.kind)));
  $$('[data-equip]', pad).forEach(b => b.addEventListener('click', () => equipThing(b.dataset.equip, b.dataset.kind)));
  syncPurse();
}
function priceTag(cost, treat) {
  return `<span style="display:inline-flex;align-items:center;gap:4px">${treat ? IC.treat : IC.coin}<span class="num">${cost}</span></span>`;
}
function shopFood() {
  return `<div class="sectitle"><h3>${T('shop_food')}</h3></div>
  <div class="grid2">${FOODS.map(f => `
    <div class="good">
      <div class="art"><canvas data-art="${f.id}" width="74" height="74"></canvas>
        ${(SAVE.food[f.id] || 0) ? `<span class="stock" title="${T('shop_have', { n: SAVE.food[f.id] })}">&times;${SAVE.food[f.id]}</span>` : ''}</div>
      <div class="nm">${goodName(f)}</div>
      <div class="ds">${goodDesc(f)}</div>
      <button class="btn sm price" data-buy="${f.id}" data-kind="food">${T('shop_buy')} ${priceTag(f.cost, f.treat)}</button>
    </div>`).join('')}</div>`;
}
function shopToys() {
  return `<div class="sectitle"><h3>${T('shop_toys')}</h3><span class="hint">${LANG === 'tr' ? 'En iyisi kullanılır' : 'The best one gets used'}</span></div>
  <div class="grid2">${TOYS.map(t => {
    const owned = !!SAVE.toys[t.id];
    return `<div class="good ${owned ? 'owned' : ''}">
      <div class="art"><canvas data-art="${t.id}" width="74" height="74"></canvas></div>
      <div class="nm">${goodName(t)}</div>
      <div class="ds">${goodDesc(t)} +${t.joy} ${T('st_joy').toLowerCase()}</div>
      ${owned ? `<span class="pill ok" style="align-self:flex-start">${IC.check}${T('shop_owned')}</span>`
        : `<button class="btn sm price" data-buy="${t.id}" data-kind="toy">${T('shop_buy')} ${priceTag(t.cost)}</button>`}
    </div>`;
  }).join('')}</div>`;
}
function shopBoost() {
  return `<div class="sectitle"><h3>${T('shop_boost')}</h3></div>
  <div class="grid2">${BOOSTERS.map(b => `
    <div class="good">
      <div class="art" style="color:var(--accent-strong)"><span style="display:block;width:54px;height:54px">${IC[b.icon]}</span>
        ${(SAVE.boosters[b.id] || 0) ? `<span class="stock" title="${T('shop_have', { n: SAVE.boosters[b.id] })}">&times;${SAVE.boosters[b.id]}</span>` : ''}</div>
      <div class="nm">${goodName(b)}</div>
      <div class="ds">${goodDesc(b)}</div>
      <button class="btn sm price" data-buy="${b.id}" data-kind="boost">${T('shop_buy')} ${priceTag(b.cost)}</button>
    </div>`).join('')}</div>`;
}
function shopStyle() {
  const pet = activePet();
  return `
  <div class="sectitle"><h3>${LANG === 'tr' ? 'Şapkalar' : 'Hats'}</h3><span class="hint">${pet ? pet.name : ''}</span></div>
  <div class="grid3">${HATS.map(h => {
    const owned = !!SAVE.hats[h.id];
    const worn = pet && pet.hat === h.id;
    return `<div class="good ${worn ? 'owned' : ''}" style="padding:9px 7px">
      <div class="art"><canvas data-hat="${h.id}" width="64" height="64"></canvas></div>
      <div class="nm" style="font-size:var(--t-micro);text-align:center">${goodName(h)}</div>
      ${owned
        ? `<button class="btn sm ${worn ? 'ghost' : ''}" data-equip="${h.id}" data-kind="hat">${worn ? T('shop_worn') : T('shop_wear')}</button>`
        : `<button class="btn sm price" data-buy="${h.id}" data-kind="hat">${T('shop_buy')} ${priceTag(h.cost)}</button>`}
    </div>`;
  }).join('')}</div>
  <div class="sectitle"><h3>${LANG === 'tr' ? 'Tasmalar' : 'Collars'}</h3></div>
  <div class="grid3">${COLLARS.map(h => {
    const owned = !!SAVE.collars[h.id];
    const worn = pet && pet.collar === h.id;
    return `<div class="good ${worn ? 'owned' : ''}" style="padding:9px 7px">
      <div class="art"><canvas data-collar="${h.id}" width="64" height="64"></canvas></div>
      <div class="nm" style="font-size:var(--t-micro);text-align:center">${goodName(h)}</div>
      ${owned
        ? `<button class="btn sm ${worn ? 'ghost' : ''}" data-equip="${h.id}" data-kind="collar">${worn ? T('shop_worn') : T('shop_wear')}</button>`
        : `<button class="btn sm price" data-buy="${h.id}" data-kind="collar">${T('shop_buy')} ${priceTag(h.cost)}</button>`}
    </div>`;
  }).join('')}</div>`;
}
function shopRoom() {
  return `
  <div class="sectitle"><h3>${LANG === 'tr' ? 'Eşya' : 'Things'}</h3></div>
  <div class="grid2">${FURNITURE.map(f => {
    const owned = !!SAVE.furniture[f.id];
    const placed = SAVE.room.placed.indexOf(f.id) >= 0;
    return `<div class="good ${placed ? 'owned' : ''}">
      <div class="art"><canvas data-room="${f.id}" width="82" height="74"></canvas></div>
      <div class="nm">${goodName(f)}</div>
      <div class="ds">${goodDesc(f)}</div>
      ${owned
        ? `<button class="btn sm ${placed ? 'ghost' : ''}" data-equip="${f.id}" data-kind="furniture">${placed ? T('shop_placed') : T('shop_place')}</button>`
        : `<button class="btn sm price" data-buy="${f.id}" data-kind="furniture">${T('shop_buy')} ${priceTag(f.cost)}</button>`}
    </div>`;
  }).join('')}</div>
  <div class="sectitle"><h3>${LANG === 'tr' ? 'Duvar' : 'Walls'}</h3></div>
  <div class="grid2">${ROOM_THEMES.map(t => {
    const owned = !!SAVE.roomThemes[t.id];
    const on = SAVE.room.theme === t.id;
    return `<div class="good ${on ? 'owned' : ''}">
      <div class="art"><span style="display:block;width:52px;height:40px;border-radius:9px;background:linear-gradient(160deg,${t.wall},${t.wall2} 60%,${t.floor} 60%)"></span></div>
      <div class="nm">${goodName(t)}</div>
      ${owned
        ? `<button class="btn sm ${on ? 'ghost' : ''}" data-equip="${t.id}" data-kind="theme">${on ? T('shop_placed') : T('shop_place')}</button>`
        : `<button class="btn sm price" data-buy="${t.id}" data-kind="theme">${T('shop_buy')} ${priceTag(t.cost)}</button>`}
    </div>`;
  }).join('')}</div>`;
}
function buyThing(id, kind) {
  audioResume();
  const table = { food: FOODS, toy: TOYS, boost: BOOSTERS, hat: HATS, collar: COLLARS, furniture: FURNITURE, theme: ROOM_THEMES };
  const item = table[kind].find(x => x.id === id);
  if (!item) return;
  /* one of a kind: taking the coins twice for a single hat is theft */
  const once = { toy: SAVE.toys, hat: SAVE.hats, collar: SAVE.collars,
                 furniture: SAVE.furniture, theme: SAVE.roomThemes }[kind];
  if (once && once[id]) return;
  if (item.treat) {
    if (SAVE.treats < item.cost) { SFX.bad(); toast(LANG === 'tr' ? 'Ödül yetmiyor' : 'Not enough treats', 'treat'); return; }
    SAVE.treats -= item.cost;
  } else {
    if (SAVE.coins < item.cost) { SFX.bad(); toast(T('shop_poor'), 'coin'); return; }
    SAVE.coins -= item.cost;
  }
  if (kind === 'food') SAVE.food[id] = (SAVE.food[id] || 0) + 1;
  else if (kind === 'toy') SAVE.toys[id] = 1;
  else if (kind === 'boost') SAVE.boosters[id] = (SAVE.boosters[id] || 0) + 1;
  else if (kind === 'hat') { SAVE.hats[id] = 1; equipThing(id, 'hat', true); }
  else if (kind === 'collar') { SAVE.collars[id] = 1; equipThing(id, 'collar', true); }
  else if (kind === 'furniture') { SAVE.furniture[id] = 1; equipThing(id, 'furniture', true); }
  else if (kind === 'theme') { SAVE.roomThemes[id] = 1; equipThing(id, 'theme', true); }
  SFX.coin();
  buzz(10);
  toast(T('shop_bought', { item: goodName(item) }), 'check');
  persist(true);
  renderShop();
  syncPurse();
}
function equipThing(id, kind, quiet) {
  const pet = activePet();
  if (kind === 'hat' && pet) pet.hat = pet.hat === id ? 'none' : id;
  if (kind === 'collar' && pet) pet.collar = pet.collar === id ? 'none' : id;
  if (kind === 'furniture') {
    const i = SAVE.room.placed.indexOf(id);
    if (i >= 0) SAVE.room.placed.splice(i, 1);
    else {
      const slot = FURNITURE.find(f => f.id === id).slot;
      SAVE.room.placed = SAVE.room.placed.filter(x => {
        const o = FURNITURE.find(f => f.id === x);
        return !o || o.slot !== slot || slot === 'wall';
      });
      SAVE.room.placed.push(id);
    }
  }
  if (kind === 'theme') SAVE.room.theme = id;
  if (!quiet) SFX.select();
  persist(true);
  if (!quiet) renderShop();
}

/* ---------------- family ---------------- */
/* Cheap at the front, steep at the back.

   The old curve was near enough linear, and against the old faucet it
   meant every animal was home inside a week — the whole marquee arc of
   the game, spent in five days. This one hands the second animal over
   almost immediately, because that is the moment somebody learns the
   game gives things back, and then stretches: the fifth is a month of
   playing and the sixth is a long way past that. */
const ADOPT_COST = [0, 250, 650, 1600, 3200, 6000];
const ADOPT_LEVEL = [0, 5, 12, 20, 28, 36];
/* Order matters here more than it looks.

   The shelf used to sit between the pets and the adopt card, which put
   the one thing this screen exists to let you do — bring another animal
   home — underneath nineteen trophy cards. On a phone that is most of a
   minute of scrolling past things you have already done to reach the
   thing you have not. The family comes first now, then who you could
   add to it, then what you have won. */
function renderFamily() {
  const pad = $('#familyPad');
  const ownedBreeds = SAVE.pets.map(p => p.breed);
  const nextIdx = SAVE.pets.length;
  const cost = ADOPT_COST[Math.min(nextIdx, ADOPT_COST.length - 1)];
  const need = ADOPT_LEVEL[Math.min(nextIdx, ADOPT_LEVEL.length - 1)];
  const canAdopt = nextIdx < BREEDS.length;

  pad.innerHTML = `
    <div class="sectitle"><h3>${T('fam_title')}</h3><span class="hint">${SAVE.pets.length}/${BREEDS.length}</span></div>
    ${SAVE.pets.map(p => {
    const active = p.id === (activePet() || {}).id;
    return `<button class="card petrow ${active ? 'active' : ''}" data-pet="${p.id}">
        <canvas data-body="${p.breed}" data-coat="${p.coat}" data-eye="${petEye(p)}" data-hat="${p.hat}" data-collar="${p.collar}" data-stage="${petStageIdx(p)}" width="56" height="56"></canvas>
        <span class="info" style="text-align:left">
          <span class="nm">${p.name}</span>
          <span class="br">${breedName(p.breed)} · ${stageName(p)} · ${LANG === 'tr' ? 'bağ' : 'bond'} ${p.bond}</span>
          <span class="statPills">
            <span class="pill ${p.food > 55 ? 'ok' : p.food > 25 ? 'warn' : 'bad'}" title="${T('st_food')}">${IC.bowl}${Math.round(p.food)}</span>
            <span class="pill ${p.joy > 55 ? 'ok' : p.joy > 25 ? 'warn' : 'bad'}" title="${T('st_joy')}">${IC.heart}${Math.round(p.joy)}</span>
            <span class="pill ${p.clean > 55 ? 'ok' : p.clean > 25 ? 'warn' : 'bad'}" title="${T('st_clean')}">${IC.bath}${Math.round(p.clean)}</span>
          </span>
        </span>
        ${active ? `<span class="pill warn">${T('fam_active')}</span>` : `<span class="pill info">${IC.paw}</span>`}
      </button>`;
  }).join('')}

    ${canAdopt ? `
    <div class="card pad16" style="display:flex;flex-direction:column;gap:11px">
      <div class="sectitle"><h3>${T('fam_adopt')}</h3></div>
      <div style="font-size:var(--t-small);color:var(--text-faint)">${T('fam_adopt_sub')}</div>
      <div class="grid3">
        ${BREEDS.map((b, i) => ownedBreeds.indexOf(i) >= 0 ? '' : `
          <button class="choice" data-adopt="${i}" style="padding:10px 6px">
            <canvas data-face="${i}" width="56" height="56"></canvas>
            <span class="nm" style="font-size:var(--t-small)">${breedName(i)}</span>
          </button>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:8px;justify-content:center;font-size:var(--t-small);font-weight:700">
        ${SAVE.reached >= need
        ? `<span class="pill warn">${T('fam_cost', { n: cost })}</span>`
        : `<span class="pill bad">${IC.lock}${T('fam_locked', { n: need })}</span>`}
      </div>
    </div>` : ''}

    ${shelfHtml()}
  `;
  paintArtCanvases(pad);
  $$('[data-pet]', pad).forEach(b => b.addEventListener('click', () => openPetSheet(b.dataset.pet)));
  $$('[data-adopt]', pad).forEach(b => b.addEventListener('click', () => tryAdopt(+b.dataset.adopt, cost, need)));
}
function openPetSheet(id) {
  const p = SAVE.pets.find(x => x.id === id);
  if (!p) return;
  SFX.tap();
  const isActive = p.id === (activePet() || {}).id;
  const m = modal(`
    <canvas id="psArt" width="150" height="150" style="width:150px;height:150px;align-self:center"></canvas>
    <h2>${p.name}</h2>
    <p>${breedName(p.breed)} · ${stageName(p)}</p>
    <div class="goalItem">
      <canvas data-tile="${p.breed}" width="34" height="34"></canvas>
      <span class="t"><b>${T('fam_fav')}</b>${breedName(p.breed)}</span>
    </div>
    <div class="goalItem">
      <span style="width:32px;display:grid;place-items:center;color:var(--accent-strong)">${IC.sparkle}</span>
      <span class="t"><b>${abilityName(p)} · ${abilityPower(p)}</b>${abilityDesc(p)}</span>
    </div>
    <div class="goalItem">
      <span style="width:32px;display:grid;place-items:center;color:var(--rose)">${IC.heart}</span>
      <span class="t">${p.trait
        ? '<b>' + traitName(p.trait) + '</b>' + traitDesc(p.trait)
        : '<b>' + T('trait_none') + '</b>' + T('trait_pending', { n: TRAIT_AT_BOND })}</span>
    </div>
    <div class="row">
      ${isActive ? '' : `<button class="btn primary" id="psActive">${T('fam_setactive')}</button>`}
      <button class="btn" id="psRename">${T('fam_rename')}</button>
    </div>
    <button class="btn ghost wide" id="psClose">${T('close')}</button>
  `);
  const c = fitCanvas($('#psArt', m.el), 150, 150);
  c.translate(75, 20);
  drawBody(c, specOfPet(p), 68, { mouth: 'smile' });
  paintArtCanvases(m.el);
  const act = $('#psActive', m.el);
  if (act) act.addEventListener('click', () => {
    SAVE.activePet = p.id; castChanged(); persist(true); m.close();
    renderFamily(); renderHome();
    petVoice(p, 1); toast(T('fam_active'), 'paw');
  });
  $('#psRename', m.el).addEventListener('click', () => { m.close(); renameSheet(p); });
  $('#psClose', m.el).addEventListener('click', m.close);
}
function renameSheet(p) {
  const m = modal(`
    <h2>${T('fam_rename')}</h2>
    <input class="field" id="rnField" maxlength="14" value="${p.name.replace(/"/g, '')}">
    <div class="row"><button class="btn ghost" id="rnCancel">${T('cancel')}</button>
    <button class="btn primary" id="rnOk">${T('ok')}</button></div>
  `);
  const f = $('#rnField', m.el);
  const okBtn = $('#rnOk', m.el);
  setTimeout(() => { f.focus(); f.select(); }, 120);
  /* nothing to save is not something to press */
  const sync = () => { okBtn.disabled = !cleanName(f.value); };
  f.addEventListener('input', sync);
  sync();
  const done = () => {
    const v = cleanName(f.value);
    if (!v) return;
    p.name = v;
    persist(true); m.close(); renderFamily(); renderHome();
  };
  okBtn.addEventListener('click', done);
  $('#rnCancel', m.el).addEventListener('click', m.close);
  f.addEventListener('keydown', e => { if (e.key === 'Enter') done(); });
}
function tryAdopt(breedIdx, cost, need) {
  if (SAVE.reached < need) { SFX.bad(); toast(T('fam_locked', { n: need }), 'lock'); return; }
  if (SAVE.coins < cost) { SFX.bad(); toast(T('shop_poor'), 'coin'); return; }
  SFX.tap();
  customiseSheet(breedIdx, (coat, eye, name) => {
    SAVE.coins -= cost;
    const p = makePet(breedIdx, coat, eye, name);
    SAVE.pets.push(p);
    /* the lane fills with your own: one fewer stranger on every board
       from here on, and this one wearing the coat you just picked */
    castChanged();
    persist(true);
    SFX.levelup();
    petVoice(p, 1.1);
    toast(T('fam_adopted', { name: p.name }), 'heart');
    const won = checkBadges();
    if (won.length) setTimeout(() => badgeModal(won), 700);
    renderFamily();
    syncPurse();
  });
}
/* shared coat/eye/name picker, used by adoption */
function customiseSheet(breedIdx, done) {
  let coat = 0, eye = EYE_COLORS.findIndex(e => e.hex === BREEDS[breedIdx].eyes);
  if (eye < 0) eye = 0;
  const names = NAME_POOL[BREEDS[breedIdx].species];
  const m = modal(`
    <h2>${breedName(breedIdx)}</h2>
    <canvas id="csArt" width="140" height="140" style="width:140px;height:140px;align-self:center"></canvas>
    <div class="eyebrow">${T('onb_coat')}</div>
    <div class="choiceGrid" id="csCoats" style="grid-template-columns:repeat(3,1fr)"></div>
    <div class="eyebrow">${T('onb_eyes')}</div>
    <div class="swatches" id="csEyes"></div>
    <div class="eyebrow">${T('onb_name')}</div>
    <input class="field" id="csName" maxlength="14" placeholder="${T('onb_placeholder')}">
    <div class="nameSuggest" id="csSuggest">${names.slice(0, 5).map(n => `<button data-n="${n}">${n}</button>`).join('')}</div>
    <div class="row"><button class="btn ghost" id="csCancel">${T('cancel')}</button>
    <button class="btn primary" id="csOk">${T('onb_done')}</button></div>
  `);
  const art = () => {
    const c = fitCanvas($('#csArt', m.el), 140, 140);
    c.translate(70, 16);
    drawBody(c, specOf(breedIdx, BREEDS[breedIdx].coats[coat], EYE_COLORS[eye].hex), 64, { mouth: 'smile' });
  };
  $('#csCoats', m.el).innerHTML = BREEDS[breedIdx].coats.map((co, i) => `
    <button class="choice ${i === coat ? 'on' : ''}" data-coat="${i}" style="padding:9px 4px">
      <canvas data-face="${breedIdx}" data-coat="${i}" width="46" height="46"></canvas>
      <span class="nm" style="font-size:var(--t-micro)">${LANG === 'tr' ? co.tr : co.en}</span>
    </button>`).join('');
  $('#csEyes', m.el).innerHTML = EYE_COLORS.map((e, i) =>
    `<button class="sw ${i === eye ? 'on' : ''}" data-eye="${i}" style="background:${e.hex}"></button>`).join('');
  paintArtCanvases(m.el); art();
  $$('[data-coat]', m.el).forEach(b => b.addEventListener('click', () => {
    coat = +b.dataset.coat; SFX.tap();
    $$('[data-coat]', m.el).forEach(x => x.classList.toggle('on', x === b));
    art();
  }));
  $$('[data-eye]', m.el).forEach(b => b.addEventListener('click', () => {
    eye = +b.dataset.eye; SFX.tap();
    $$('[data-eye]', m.el).forEach(x => x.classList.toggle('on', x === b));
    art();
  }));
  $$('#csSuggest button', m.el).forEach(b => b.addEventListener('click', () => { $('#csName', m.el).value = b.dataset.n; SFX.tap(); }));
  $('#csCancel', m.el).addEventListener('click', m.close);
  $('#csOk', m.el).addEventListener('click', () => {
    const nm = cleanName($('#csName', m.el).value) || pick(names);
    m.close();
    done(coat, eye, nm);
  });
}
const NAME_POOL = {
  cat: ['Biscuit', 'Olive', 'Pepper', 'Mochi', 'Saffron', 'Juniper', 'Tuna', 'Clove'],
  dog: ['Barley', 'Rusty', 'Maple', 'Otto', 'Pickle', 'Hazel', 'Bramble', 'Nugget']
};

/* ---------------- level intro / results ---------------- */
function goalLine(g) {
  if (g.kind === GK.SCORE) return T('goal_score', { n: fmt(g.need !== undefined ? g.need : g[2]) });
  const n = g.need !== undefined ? g.need : g[2];
  /* The breed goes inside the sentence, not after it. Glued on the end
     it reads "Collect 44 Marmalade" in English and "44 tane topla
     Marmelat" in Turkish, which is English word order wearing Turkish
     words. Each language orders its own sentence. */
  if (g.kind === GK.COLLECT)
    return T('goal_collect', { n, breed: castName(g.arg !== undefined ? g.arg : g[1]) });
  if (g.kind === GK.CRATE) return T('goal_crate', { n });
  if (g.kind === GK.MUD) return T('goal_mud', { n });
  if (g.kind === GK.BRAMBLE) return T('goal_bramble', { n });
  if (g.kind === GK.MOLE) return T('goal_mole', { n });
  if (g.kind === GK.RESCUE) return T('goal_rescue', { n });
  return '';
}
function goalIconHtml(kind, arg) {
  if (kind === GK.COLLECT) return `<canvas data-tile="${arg}" width="34" height="34"></canvas>`;
  return `<canvas data-goalicon="${kind}" width="34" height="34"></canvas>`;
}
function paintGoalIcons(root) {
  $$('canvas[data-goalicon]', root).forEach(cv => {
    const px = 34;
    const c = fitCanvas(cv, px, px);
    c.translate(px / 2, px / 2);
    const k = cv.dataset.goalicon;
    if (k === GK.CRATE) paintCrate(c, px * .9, 1);
    else if (k === GK.MUD) paintMud(c, px * .88, 1);
    else if (k === GK.BRAMBLE) { paintBramble(c, px * .9); paintBrambleOver(c, px * .9); }
    else if (k === GK.RESCUE) paintPup(c, px, 0);
    else { c.fillStyle = PAL.accent; c.save(); c.scale(px / 24, px / 24); c.translate(-12, -12); c.fill(new Path2D('m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.9z')); c.restore(); }
  });
}
function openLevelIntro(n) {
  heartTick();
  const def = levelDef(n);
  const pet = activePet();
  const perks = perksFor(pet);
  let useMoves = false;
  if (SAVE.hearts <= 0) { noHeartsSheet(); return; }

  /* every fifth level pays treats the first time, and used to do it
     without warning anyone it was going to */
  const firstTreats = (n !== DAILY_LEVEL && n % 5 === 0 && !SAVE.stars[n]) ? ECON.everyFifthTreats : 0;

  const m = modal(`
    <div class="eyebrow">${T('lvl_intro', { n })} · ${T('lvl_moves', { n: def.moves + (perks.reduce((a, p) => a + (p.id === 'moves' || p.id === 'bondmoves' || p.id === 'trait' ? p.v : 0), 0)) })}${SAVE.scores[n] ? ' · ' + T('map_best', { n: fmt(SAVE.scores[n]) }) : ''}</div>
    <h2>${T('lvl_goals')}</h2>
    ${def.gate ? `<div class="goalItem gateNote">
      <span style="width:32px;display:grid;place-items:center;color:var(--rose)">${IC.flame}</span>
      <span class="t"><b>${T('gate_t')}</b>${T('gate_s')}</span>
    </div>` : ''}
    ${firstTreats ? `<div class="goalItem" style="background:color-mix(in srgb,var(--plum) 12%, var(--surface-2))">
      <span style="width:32px;display:grid;place-items:center;color:var(--plum)">${IC.treat}</span>
      <span class="t"><b>${T('lvl_first_treats', { n: firstTreats })}</b></span>
    </div>` : ''}
    <div class="goalList">
      ${def.goals.map(g => `<div class="goalItem">${goalIconHtml(g[0], g[1])}<span class="t"><b>${goalLine({ kind: g[0], arg: g[1], need: g[2] })}</b></span></div>`).join('')}
    </div>
    ${pet ? `
    <div class="goalItem" style="background:color-mix(in srgb,var(--accent) 10%, var(--surface-2))">
      <canvas data-face="${pet.breed}" data-coat="${pet.coat}" data-eye="${petEye(pet)}" data-hat="${pet.hat}" width="44" height="44"></canvas>
      <span class="t"><b>${pet.name} · ${abilityName(pet)} · ${abilityPower(pet)}</b>
      ${perks.length
        ? `<span class="perkchips">${perkChips(perks).map(x => `<span class="pill ok">${x}</span>`).join('')}</span>`
        : (LANG === 'tr' ? 'Bakımı desteği açar' : 'Care unlocks perks')}</span>
    </div>
    <div class="goalItem">
      <canvas data-tile="${favType(def.types)}" width="34" height="34"></canvas>
      <span class="t"><b>${T('lvl_charges')}</b>${castName(favType(def.types))}</span>
    </div>` : ''}
    <div class="eyebrow">${T('lvl_boosters')}</div>
    <button class="goalItem" id="pickMoves" style="width:100%">
      <span style="width:32px;display:grid;place-items:center;color:var(--accent-strong)">${IC.plusmove}</span>
      <span class="t"><b>${LANG === 'tr' ? '+5 hamle' : '+5 moves'}</b>${T('shop_have', { n: SAVE.boosters.moves || 0 })}</span>
      <span class="pill info" id="movesPill">${LANG === 'tr' ? 'Kapalı' : 'Off'}</span>
    </button>
    <div class="row">
      <button class="btn ghost" id="liCancel">${T('cancel')}</button>
      <button class="btn primary" id="liGo">${IC.heart}${T('lvl_start')}</button>
    </div>
  `);
  paintArtCanvases(m.el);
  paintGoalIcons(m.el);
  $('#pickMoves', m.el).addEventListener('click', () => {
    if (!(SAVE.boosters.moves > 0)) { SFX.bad(); toast(LANG === 'tr' ? 'Elinde yok' : 'You have none', 'plusmove'); return; }
    useMoves = !useMoves;
    SFX.tap();
    const pill = $('#movesPill', m.el);
    pill.textContent = useMoves ? (LANG === 'tr' ? 'Açık' : 'On') : (LANG === 'tr' ? 'Kapalı' : 'Off');
    pill.className = 'pill ' + (useMoves ? 'ok' : 'info');
  });
  $('#liCancel', m.el).addEventListener('click', m.close);
  let starting = false;
  $('#liGo', m.el).addEventListener('click', () => {
    /* hearts are the scarcest thing in the game; two taps in one frame
       used to cost two of them and start one level */
    if (starting) return;
    starting = true;
    if (!spendHeart()) { m.close(); noHeartsSheet(); return; }
    if (useMoves) { SAVE.boosters.moves--; persist(); }
    m.close();
    syncPurse();
    setScreen('game');
    startLevel(n, { perks, extraMoves: useMoves ? 5 : 0 });
    maybeTutorial(def);
  });
}
/* The one place money is asked for.

   Opened three ways and no others: the treat chip in the header, and the
   two moments the player has just been told no — out of moves near the
   end of a level, out of hearts. `why` is which of those it was, and it
   puts a line at the top saying what the treats would have done, because
   a store that opens without saying why it opened is an interruption.

   Nothing in here can charge anything yet. When BILLING is not ready the
   prices still show — they are what the thing will cost — and the button
   says the shop is shut instead of pretending to take a card. */
function treatStore(why) {
  const live = BILLING.ready();
  const j = jarState();
  const reason = why === 'continue' ? T('store_why_continue')
    : why === 'hearts' ? T('store_why_hearts') : '';
  const tag = (sku, usd) => {
    const p = BILLING.price(sku, null);
    return p ? p : `<span style="opacity:.75">${T('store_about', { p: usd })}</span>`;
  };
  const row = (id, kind, title, sub, btn, on) => `
    <div class="offer"${on ? ' style="opacity:.6"' : ''}>
      <span class="ot"><b>${title}</b><small>${sub}</small></span>
      ${on ? `<span class="btn sm" style="pointer-events:none">${IC.check}</span>`
      : `<button class="btn sm" data-pay="${id}" data-kind="${kind}">${btn}</button>`}
    </div>`;

  const m = modal(`
    <span style="color:var(--plum);width:48px;height:48px;align-self:center">${IC.treat}</span>
    <h2>${T('store_t')}</h2>
    ${reason ? `<p><b style="color:var(--accent-strong)">${reason}</b></p>` : ''}
    <p style="color:var(--text-dim)">${T('store_s')}</p>

    ${!j.fill ? '' : jarFull()
      ? row('jar', 'jar', T('store_jar_t'), T('store_jar_full', { n: j.fill }),
        `${T('store_jar_open')} · ${tag(JAR.sku, JAR.usd)}`)
      /* A jar that is not full has no button on it.

         It had one, at the full price, which meant a player could pay
         $2.99 for the sixty-eight treats in it on a day the same $2.99
         would have bought a hundred and fifty a fortnight later. That is
         a worse deal than the smallest pack and it is only ever taken by
         somebody who did not do the arithmetic — which is the precise
         thing I said this file would not do. So it fills in public and
         sells nothing until it is worth buying. */
      : `<div class="offer" style="opacity:.7">
          <span class="ot"><b>${T('store_jar_t')}</b>
            <small>${T('store_jar_s', { n: j.fill, c: JAR.cap })}</small>
            <span style="display:block;height:5px;border-radius:3px;background:var(--surface-3);overflow:hidden;margin-top:5px">
              <span style="display:block;height:100%;width:${Math.round(j.fill / JAR.cap * 100)}%;background:var(--plum)"></span>
            </span></span>
        </div>`}

    ${TREAT_PACKS.map(p => row(p.id, 'pack',
      T('store_pack', { n: p.treats }) + (p.best ? ' ★' : ''),
      p[LANG] || p.en, tag(p.sku, p.usd))).join('')}

    ${row('club', 'club', T('store_club_t'),
      clubActive() ? T('store_club_on') : T('store_club_s', { n: PET_CLUB.dailyTreats }),
      tag(PET_CLUB.sku, PET_CLUB.usd) + T('store_per_month'), clubActive())}

    ${live ? `<button class="btn ghost wide" id="stRestore"
      style="font-size:var(--t-micro)">${T('store_restore')}</button>` : ''}
    <button class="btn primary wide" id="stOk">${T('ok')}</button>
  `);

  /* Every button lands here, and the grant is on the far side of a
     receipt. There is no path through this function that adds a treat
     because a store was missing. */
  $$('[data-pay]', m.el).forEach(b => b.addEventListener('click', async () => {
    if (!live) { SFX.bad(); storeShut(); return; }
    const kind = b.dataset.kind;
    const id = b.dataset.pay;
    const sku = kind === 'pack' ? TREAT_PACKS.find(x => x.id === id).sku
      : kind === 'jar' ? JAR.sku : PET_CLUB.sku;
    b.disabled = true;
    const r = await BILLING.buy(sku);
    b.disabled = false;
    if (!r.ok) {
      if (r.why === 'nostore') { storeShut(); return; }
      if (r.why !== 'cancelled') { SFX.bad(); toast(T('store_failed'), 'treat'); }
      return;
    }
    const got = grantPurchase(kind, id);
    SFX.coin();
    syncPurse();
    m.close();
    if (kind === 'club') toast(T('store_club_on'), 'treat');
    else toast(T('store_thanks', { n: got }), 'treat');
  }));
  const rs = $('#stRestore', m.el);
  if (rs) rs.addEventListener('click', async () => { await BILLING.restore(); syncPurse(); });
  $('#stOk', m.el).addEventListener('click', m.close);
}
/* Said plainly, in its own card, rather than as a disabled button with
   no explanation — which reads as a bug rather than as a fact. */
function storeShut() {
  const m = modal(`
    <h2>${T('store_shut_t')}</h2>
    <p>${T('store_shut_s')}</p>
    <button class="btn primary wide" id="ssOk">${T('ok')}</button>`);
  $('#ssOk', m.el).addEventListener('click', m.close);
}

function noHeartsSheet() {
  const line = () => T('lvl_no_hearts_sub', { m: HEART_REFILL / MIN, t: fmtTime(heartsIn()) });
  let tick = null;
  const m = modal(`
    <span style="color:var(--rose);width:52px;height:52px;align-self:center">${IC.heart}</span>
    <h2>${T('lvl_no_hearts')}</h2>
    <p id="nhLine">${line()}</p>
    <div class="row">
      <button class="btn ghost" id="nhWait">${T('lvl_wait')}</button>
      <button class="btn primary" id="nhBuy">${T('lvl_buy_hearts', { n: ECON.heartRefillTreats })}</button>
    </div>
  `, { onClose: () => { if (tick) clearInterval(tick); onHeartArrived = () => { }; } });

  /* the number has to move, or waiting looks like nothing happening */
  heartClockStart();
  tick = setInterval(() => {
    const el = $('#nhLine', m.el);
    if (!el || !el.isConnected) { clearInterval(tick); return; }
    el.textContent = line();
  }, 1000);
  /* and when one lands, stop asking the player to buy what they have */
  onHeartArrived = () => {
    m.close();
    syncPurse();
    SFX.coin();
    toast(T('lvl_heart_back'), 'heart');
  };
  $('#nhWait', m.el).addEventListener('click', m.close);
  $('#nhBuy', m.el).addEventListener('click', () => {
    if (SAVE.treats < ECON.heartRefillTreats) { SFX.bad(); treatStore('hearts'); return; }
    SAVE.treats -= ECON.heartRefillTreats;
    SAVE.hearts = HEART_MAX;
    SAVE.heartAt = now();
    persist(true);
    SFX.coin();
    syncPurse();
    m.close();
  });
}
function showWin() {
  const n = G.n;
  say(T('a11y_cleared', { stars: Math.max(1, G.starsEarned) }), true);
  /* the daily walk is not a numbered level: no stars ledger, no unlock */
  if (n === DAILY_LEVEL) { showDailyResult(true); return; }
  const stars = Math.max(1, G.starsEarned);
  const first = !SAVE.stars[n];
  const prev = SAVE.stars[n] || 0;
  SAVE.stars[n] = Math.max(prev, stars);
  /* A level you have three-starred still has a number on it worth
     beating. Without somewhere to put that number, the only reason to
     replay was to farm coins — which is the least interesting reason. */
  const prevBest = SAVE.scores[n] || 0;
  const newBest = G.score > prevBest;
  if (newBest) SAVE.scores[n] = G.score;
  SAVE.reached = Math.max(SAVE.reached, n + 1);
  SAVE.stats.cleared++;
  /* A cleared level paid its full reward every time it was cleared, so
     the fastest coins in the game were on whichever early level you
     could three-star in ninety seconds — and a currency you can farm is
     not a currency. First clear pays in full; going back pays a tenth,
     or a quarter if you actually beat the number you left there. */
  const base = Math.round((ECON.winBase + stars * ECON.winPerStar
    + Math.floor(G.score / ECON.winPerScore)) * traitCoinScale(activePet()));
  const rate = first ? 1 : (newBest ? ECON.replayBestRate : ECON.replayRate);
  const coins = Math.max(first ? 0 : 1, Math.round(base * rate));
  let treats = 0;
  if (stars === 3 && prev < 3) treats += ECON.threeStarTreats;
  if (first && n % 5 === 0) treats += ECON.everyFifthTreats;
  /* and the jar takes its couple, on a replay as well: it is the one
     thing in the economy that is paid for time rather than progress,
     which is exactly why it is the offer I trust */
  const jarFilled = jarAdd();
  SAVE.coins += coins;
  SAVE.treats += treats;
  const pet = activePet();
  const bondXp = 2 + stars;
  const grew = pet ? addBond(pet, bondXp) : false;
  if (pet) { pet.joy = clamp(pet.joy + 6, 0, 100); pet.energy = clamp(pet.energy - 5, 0, 100); }
  persist(true);

  const m = modal(`
    ${pet ? `<div class="winPet"><canvas data-body="${pet.breed}" data-coat="${pet.coat}"
      data-eye="${petEye(pet)}" data-hat="${pet.hat}" data-collar="${pet.collar}"
      data-stage="${petStageIdx(pet)}" data-scale="1.55" width="116" height="116"></canvas></div>` : ''}
    <div class="starsRow">${[0, 1, 2].map(i => `<span class="s" data-i="${i}">${i < stars ? IC.star : IC.starOut}</span>`).join('')}</div>
    <h2>${T('win_t')}</h2>
    <p>${T('lvl_intro', { n })} · <span class="num">${fmt(G.score)}</span></p>
    ${newBest && prevBest ? `<p style="color:var(--accent-strong)"><b>${T('win_new_best')}</b></p>`
      : prevBest ? `<p style="color:var(--text-dim)">${T('map_best', { n: fmt(prevBest) })}</p>` : ''}
    <div class="rewardRow">
      <span class="reward" style="color:var(--accent-strong)">${IC.coin}+${coins}</span>
      ${treats ? `<span class="reward" style="color:var(--plum)">${IC.treat}+${treats}</span>` : ''}
      <span class="reward" style="color:var(--sage)">${IC.paw}+${bondXp} ${T('win_bond')}</span>
    </div>
    ${first ? '' : `<p style="color:var(--text-faint);font-size:var(--t-micro);margin-top:-4px">${T('win_replay')}</p>`}
    ${jarFilled && jarFull() ? `<div class="offer">
      <span class="ot"><b>${T('store_jar_t')}</b>
        <small>${T('store_jar_full', { n: jarState().fill })}</small></span>
      <button class="btn sm" id="wJar">${T('store_jar_open')}</button>
    </div>` : ''}
    ${pet ? `<p>${T('win_petline', { name: pet.name })}</p>` : ''}
    <div class="row">
      <button class="btn ghost" id="wMap">${T('to_map')}</button>
      <button class="btn primary" id="wNext">${T('keep_going')}</button>
    </div>
  `, { dismissable: false });
  paintArtCanvases(m.el);
  const wj = $('#wJar', m.el);
  if (wj) wj.addEventListener('click', () => { SFX.tap(); treatStore(); });
  $$('.starsRow .s', m.el).forEach((s, i) => {
    if (i < stars) setTimeout(() => { s.classList.add('pop'); SFX.star(i); }, 220 + i * 260);
    else s.classList.add('pop');
    if (i < stars) s.style.color = 'var(--accent)'; else s.style.color = 'var(--text-faint)';
  });
  $('#wMap', m.el).addEventListener('click', () => { m.close(); leaveLevel(); });
  $('#wNext', m.el).addEventListener('click', () => {
    m.close();
    gameLoopStop();
    setScreen('map');
    mapLayout();
    setTimeout(() => openLevelIntro(SAVE.reached), 260);
  });
  syncPurse();
  const wonBadges = checkBadges();
  if (grew) setTimeout(() => stageUpModal(pet), 900);
  if (wonBadges.length) setTimeout(() => badgeModal(wonBadges), grew ? 2000 : 900);
}
function showLose() {
  say(T('a11y_failed'), true);
  if (G.n === DAILY_LEVEL) { showDailyResult(false); return; }
  const pet = activePet();
  /* What was left, rather than what was asked for.

     "You needed 6 mud" reads exactly the same at 34 of 40 as it does at
     2 of 40, and the difference between those two is the whole of
     whether the level is worth another heart. The card carried the ask
     and threw the progress away at the one moment a player is deciding
     whether to come back — so it shows the count it showed all level,
     and says so out loud when the answer was nearly yes. */
  const short = G.goals
    .map(g => {
      /* judged the way goalsMet judges it, or a bramble that grew back
         after the counter was full shows a finished bar on a lost level */
      let have = g.kind === GK.SCORE ? G.score : g.have;
      if (g.kind === GK.BRAMBLE) have = Math.max(0, g.need - brambleCount(G.B));
      return { g, have: Math.min(have, g.need) };
    })
    .filter(x => x.have < x.g.need);
  const close = short.length > 0 && short.every(x => x.have / x.g.need >= .8);
  /* Whether the level is worth carrying on with, which is a different
     question from whether the card should say "so close" — that one is
     about every goal being nearly done, this one is about the board as a
     whole. Five more moves finishes a board at eight tenths. It does not
     finish one at two, and offering it there sells a player a level that
     was already lost. They find that out after paying, once, and then
     the button is dead for the rest of the game. So below the line the
     card does not carry the offer at all. */
  const done = G.goals.reduce((a, g) => {
    const have = g.kind === GK.SCORE ? G.score
      : g.kind === GK.BRAMBLE ? Math.max(0, g.need - brambleCount(G.B)) : g.have;
    return a + Math.min(1, have / g.need);
  }, 0) / Math.max(1, G.goals.length);
  const worthCarryingOn = done >= ECON.continueAt;
  /* The subtitle used to read the shortfall back as a sentence:
     "You needed Walk 2 home, Score 9500." Goal lines are written as
     instructions — "Walk 2 home", "Collect 44 Sable" — and an
     instruction does not survive being used as a noun halfway through
     somebody else's sentence, in either language. It was also saying
     exactly what the list underneath says, only without the progress
     bars, which are the part worth reading. So it is a label now. */
  const m = modal(`
    <span style="color:var(--text-faint);width:52px;height:52px;align-self:center">${IC.starOut}</span>
    <h2>${T('lose_t')}</h2>
    <p>${close ? `<b style="color:var(--accent-strong)">${T('lose_close')}</b> ` : ''}<span style="color:var(--text-dim)">${T('lose_s')}</span></p>
    <div class="goalList">
      ${short.map(({ g, have }) => `<div class="goalItem">${goalIconHtml(g.kind, g.arg)}
        <span class="t"><b>${fmt(have)} / ${fmt(g.need)}</b>
        <span style="display:block;height:5px;border-radius:3px;background:var(--surface-3);overflow:hidden;margin-top:5px">
          <span style="display:block;height:100%;width:${Math.round(have / g.need * 100)}%;background:var(--accent)"></span>
        </span></span>
      </div>`).join('')}
    </div>
    ${pet ? `<p>${T('lose_petline', { name: pet.name })}</p>` : ''}
    <div class="row">
      <button class="btn ghost" id="lMap">${T('to_map')}</button>
      <button class="btn primary" id="lRetry">${T('retry')}</button>
    </div>
    ${G.usedExtra || !worthCarryingOn ? '' : `
    <div class="offer">
      <span class="ot">
        <b>${T('lose_extra', { n: ECON.continueMoves })}</b>
        <small>${T('lose_extra_sub', { n: ECON.continueTreats })}</small>
      </span>
      <button class="btn sm" id="lExtra">${T('shop_buy')}</button>
    </div>`}
  `, { dismissable: false });
  paintGoalIcons(m.el);
  paintArtCanvases(m.el);
  const ex = $('#lExtra', m.el);
  if (ex) ex.addEventListener('click', () => {
    /* short of treats is the one moment the player actually wants the
       jar, so it opens there rather than being told no by a toast */
    if (SAVE.treats < ECON.continueTreats) { SFX.bad(); treatStore('continue'); return; }
    SAVE.treats -= ECON.continueTreats; persist(true); syncPurse();
    m.close();
    G.usedExtra = true;
    G.over = false; G.busy = false;
    G.moves = ECON.continueMoves;
    syncHud();
    SFX.coin();
  });
  $('#lMap', m.el).addEventListener('click', () => { m.close(); leaveLevel(); });
  $('#lRetry', m.el).addEventListener('click', () => {
    m.close();
    if (!spendHeart()) { noHeartsSheet(); leaveLevel(); return; }
    syncPurse();
    const pet2 = activePet();
    startLevel(G.n, { perks: perksFor(pet2), reseed: Math.floor(Math.random() * 9999) });
  });
}
function leaveLevel() {
  gameLoopStop();
  G.over = true;
  setScreen('map');
  mapLayout();
  scrollMapToCurrent();
  syncPurse();
}
function confirmQuit() {
  if (G.over) { leaveLevel(); return; }
  const m = modal(`
    <h2>${T('g_quit_t')}</h2>
    <p>${T('g_quit_s')}</p>
    <div class="row">
      <button class="btn primary" id="qNo">${T('g_quit_no')}</button>
      <button class="btn ghost" id="qYes">${T('g_quit_yes')}</button>
    </div>
  `);
  $('#qNo', m.el).addEventListener('click', m.close);
  $('#qYes', m.el).addEventListener('click', () => {
    m.close();
    SAVE.hearts = Math.min(HEART_MAX, SAVE.hearts + 1);
    persist(true);
    leaveLevel();
  });
}

/* ---------------- the reference sheet ---------------- */
/* Draws the real pieces rather than describing them, so what is on the
   card is exactly what is on the board. */
function howToPlay() {
  SFX.tap();
  const row = (art, text) => `<div class="howRow"><span class="howArt">${art}</span><span class="howText">${text}</span></div>`;
  const tile = (sp, type) => `<canvas class="howTile" data-howtile="${type}" data-howsp="${sp}" width="40" height="40"></canvas>`;
  const pair = (a, b) => tile(a, 0) + '<span class="howPlus">+</span>' + tile(b, 1);
  const block = (kind) => `<canvas class="howTile" data-howblock="${kind}" width="40" height="40"></canvas>`;

  const m = modal(`
    <h2>${T('how_t')}</h2>
    <div class="eyebrow">${T('how_make')}</div>
    <div class="howList">
      ${row(tile(SP.ROW, 0), T('how_row4'))}
      ${row(tile(SP.BOMB, 3), T('how_LT'))}
      ${row(tile(SP.RAIN, 0), T('how_row5'))}
    </div>
    <div class="eyebrow">${T('how_pair')}</div>
    <div class="howList">
      ${row(pair(SP.ROW, SP.COL), T('how_rr'))}
      ${row(pair(SP.ROW, SP.BOMB), T('how_rb'))}
      ${row(pair(SP.BOMB, SP.BOMB), T('how_bb'))}
      ${row(pair(SP.RAIN, SP.ROW), T('how_sr'))}
      ${row(pair(SP.RAIN, SP.RAIN), T('how_ss'))}
    </div>
    <div class="eyebrow">${T('how_block')}</div>
    <div class="howList">
      ${row(block('crate'), T('how_crate'))}
      ${row(block('mud'), T('how_mud'))}
      ${row(block('ice'), T('how_ice'))}
      ${row(block('bram'), T('how_bram'))}
      ${row(block('pup'), T('how_basket'))}
    </div>
    <button class="btn primary wide" id="howOk">${T('ok')}</button>
  `);
  $$('canvas[data-howtile]', m.el).forEach(cv => {
    const px = 40;
    const c = fitCanvas(cv, px, px);
    c.translate(px / 2, px / 2);
    paintTile(c, +cv.dataset.howtile, +cv.dataset.howsp, px * .9, SAVE.settings.marks);
  });
  $$('canvas[data-howblock]', m.el).forEach(cv => {
    const px = 40;
    const c = fitCanvas(cv, px, px);
    c.translate(px / 2, px / 2);
    const k = cv.dataset.howblock;
    if (k === 'crate') paintCrate(c, px * .9, 2);
    else if (k === 'mud') paintMud(c, px * .9, 2);
    else if (k === 'ice') { paintTile(c, 1, SP.NONE, px * .88, false); paintIce(c, px * .9); }
    else if (k === 'bram') { paintTile(c, 4, SP.NONE, px * .88, false); paintBrambleOver(c, px * .9); }
    else paintPup(c, px * .95, 0);
  });
  $('#howOk', m.el).addEventListener('click', m.close);
}

/* ---------------- the daily walk ---------------- */
/* Free of hearts, so it is always available; the same board for everyone
   on a given day; a streak of its own. */
function startDailyWalk() {
  audioResume();
  SFX.tap();
  const def = dailyLevel(SAVE.reached);
  const pet = activePet();
  const perks = perksFor(pet);
  const m = modal(`
    <div class="eyebrow">${T('daily_walk')}</div>
    <h2>${T('daily_walk_sub')}</h2>
    <div class="goalList">
      ${def.goals.map(g => `<div class="goalItem">${goalIconHtml(g[0], g[1])}<span class="t"><b>${goalLine({ kind: g[0], arg: g[1], need: g[2] })}</b>${T('lvl_moves', { n: def.moves })}</span></div>`).join('')}
    </div>
    ${dailyState().best ? `<p>${T('daily_walk_best', { n: fmt(dailyState().best) })}</p>` : ''}
    <div class="row">
      <button class="btn ghost" id="dwCancel">${T('cancel')}</button>
      <button class="btn primary" id="dwGo">${T('daily_walk_go')}</button>
    </div>
  `);
  paintArtCanvases(m.el);
  paintGoalIcons(m.el);
  $('#dwCancel', m.el).addEventListener('click', m.close);
  $('#dwGo', m.el).addEventListener('click', () => {
    m.close();
    setScreen('game');
    startLevel(DAILY_LEVEL, { perks });
  });
}

function showDailyResult(won) {
  const d = dailyState();
  let reward = { first: false };
  if (won) reward = dailyDone(G.score);
  const stars = won ? Math.max(1, G.starsEarned) : 0;
  const pet = activePet();
  if (won) { SFX.win(); } else { SFX.lose(); }
  const m = modal(`
    <div class="starsRow">${[0, 1, 2].map(i => `<span class="s pop" style="color:${i < stars ? 'var(--accent)' : 'var(--text-faint)'}">${i < stars ? IC.star : IC.starOut}</span>`).join('')}</div>
    <h2>${won ? T('win_t') : T('lose_t')}</h2>
    <p>${T('daily_walk')} · <span class="num">${fmt(G.score)}</span></p>
    ${reward.first ? `<div class="rewardRow">
      <span class="reward" style="color:var(--accent-strong)">${IC.coin}+${reward.coins}</span>
      <span class="reward" style="color:var(--plum)">${IC.treat}+${reward.treats}</span></div>
      <p>${T('daily_first')}${d.streak > 1 ? ' · ' + T('daily_walk_streak', { n: d.streak }) : ''}</p>` : ''}
    ${d.best ? `<p>${T('daily_walk_best', { n: fmt(d.best) })}</p>` : ''}
    <div class="row">
      <button class="btn ghost" id="dwHome">${T('to_map')}</button>
      <button class="btn primary" id="dwAgain">${T('daily_walk_again')}</button>
    </div>
  `, { dismissable: false });
  $('#dwHome', m.el).addEventListener('click', () => {
    m.close(); gameLoopStop(); G.over = true; setScreen('home'); renderHome(); syncPurse();
  });
  $('#dwAgain', m.el).addEventListener('click', () => {
    m.close();
    startLevel(DAILY_LEVEL, { perks: perksFor(activePet()) });
  });
  syncPurse();
  const won2 = checkBadges();
  if (won2.length) setTimeout(() => badgeModal(won2), 900);
}

/* ---------------- daily gift ---------------- */
/* one day of the ladder, drawn from the table the claim reads */
function giftIcon(r) {
  if (r.booster) { const b = BOOSTERS.find(x => x.id === r.booster); return IC[b.icon]; }
  if (r.treats) return IC.treat;
  if (r.food) return IC.bowl;
  return IC.coin;
}
/* the shortest honest sentence for a basket: the thing in it worth
   coming back for, not the whole inventory */
function giftSummary(r) {
  if (r.booster) { const b = BOOSTERS.find(x => x.id === r.booster); return goodName(b); }
  if (r.treats) return T('daily_n_treats', { n: r.treats });
  if (r.food) { const f = FOODS.find(x => x.id === r.food); return goodName(f); }
  return T('fam_cost', { n: r.coins });
}
function giftLadder(day) {
  let out = '<div class="ladder" aria-hidden="true">';
  for (let d = 1; d <= 7; d++) {
    const cls = d < day ? 'past' : d === day ? 'now' : 'fut';
    out += '<span class="d ' + cls + (d === 7 ? ' jack' : '') + '">'
      + '<i>' + (d < day ? IC.check : giftIcon(giftFor(d))) + '</i>'
      + '<b>' + d + '</b></span>';
  }
  return out + '</div>';
}
function openDailyGift() {
  if (!giftReady()) return;
  const day = giftDay();
  const { reward } = claimGift();
  SFX.levelup();
  const bits = [];
  if (reward.coins) bits.push(`<span class="reward" style="color:var(--accent-strong)">${IC.coin}+${reward.coins}</span>`);
  if (reward.treats) bits.push(`<span class="reward" style="color:var(--plum)">${IC.treat}+${reward.treats}</span>`);
  if (reward.food) { const f = FOODS.find(x => x.id === reward.food); bits.push(`<span class="reward">${goodName(f)}</span>`); }
  if (reward.booster) { const b = BOOSTERS.find(x => x.id === reward.booster); bits.push(`<span class="reward" style="color:var(--sage)">${IC[b.icon]}${goodName(b)}</span>`); }
  const tom = day === 7 ? '' : T('daily_tomorrow', { what: giftSummary(giftFor(day + 1)) });
  const m = modal(`
    <span style="color:var(--accent-strong);width:56px;height:56px;align-self:center">${IC.gift}</span>
    <h2>${T('daily_t')}</h2>
    <p>${T('daily_s', { n: SAVE.streak })}</p>
    <div class="rewardRow">${bits.join('')}</div>
    <div class="divide"></div>
    <div class="eyebrow">${T('daily_ladder')}</div>
    ${giftLadder(day)}
    <p class="ladderNote">${tom || T('daily_best_day')}</p>
    <p class="ladderMiss">${T('daily_miss')}</p>
    <button class="btn primary wide" id="dgOk">${T('daily_take')}</button>
  `, { dismissable: false });
  /* the rung you have just landed on arrives after the sheet does, so
     the eye is drawn to the week rather than to the coins */
  const nowPip = $('.ladder .d.now', m.el);
  if (nowPip) setTimeout(() => nowPip.classList.add('land'), 340);
  $('#dgOk', m.el).addEventListener('click', () => { m.close(); syncPurse(); renderHome(); syncTabs(); });
}

/* ---------------- settings ---------------- */
/* The one place the language changes. LANG is a module variable, so
   writing SAVE.settings.lang alone does nothing — which is how the
   layout test came to measure English twice. */
function setLang(code) {
  LANG = (code === 'tr') ? 'tr' : 'en';
  SAVE.settings.lang = LANG;
  persist(true);
  /* the labels a screen reader reads live in the markup and follow
     nothing on their own, so changing the language has to move them.
     Done here rather than at the call site: this is the one place the
     language changes, and a caller that forgets leaves the game half
     translated for the people least able to notice. */
  relabelControls();
  return LANG;
}
function openSettings() {
  SFX.tap();
  const row = (id, label, sub, on) => `
    <button class="switchRow" data-toggle="${id}">
      <span class="lb">${label}<small>${sub}</small></span>
      <span class="sw2 ${on ? 'on' : ''}"></span>
    </button><div class="divide"></div>`;
  const m = modal(`
    <h2>${T('set_t')}</h2>
    <div class="card" style="text-align:left">
      ${row('sound', T('set_sound'), T('set_sound_s'), SAVE.settings.sound)}
      ${row('music', T('set_music'), T('set_music_s'), SAVE.settings.music)}
      ${row('haptics', T('set_haptics'), T('set_haptics_s'), SAVE.settings.haptics)}
      ${row('marks', T('set_marks'), T('set_marks_s'), SAVE.settings.marks)}
      <div class="switchRow themeRow">
        <span class="lb">${T('set_theme')}<small>${T('set_theme_s')}</small></span>
        <span class="seg" id="segTheme">
          <button data-th="auto" class="${SAVE.settings.theme === 'auto' ? 'on' : ''}">${T('set_auto')}</button>
          <button data-th="light" class="${SAVE.settings.theme === 'light' ? 'on' : ''}">${T('set_day')}</button>
          <button data-th="dark" class="${SAVE.settings.theme === 'dark' ? 'on' : ''}">${T('set_dusk')}</button>
        </span>
      </div>
      <div class="divide"></div>
      <div class="switchRow">
        <span class="lb">${T('set_lang')}</span>
        <span class="seg" id="segLang">
          <button data-lang="en" class="${LANG === 'en' ? 'on' : ''}">English</button>
          <button data-lang="tr" class="${LANG === 'tr' ? 'on' : ''}">Türkçe</button>
        </span>
      </div>
    </div>
    <button class="btn ghost wide" id="setHow">${T('how_open')}</button>
    <button class="btn ghost wide" id="setKeys">${T('a11y_help_t')}</button>
    <div style="font-size:var(--t-micro);color:var(--text-faint);line-height:1.5">${T('set_credits')}</div>
    <div style="font-size:var(--t-micro);color:var(--text-faint);display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
      <span>${LANG === 'tr' ? 'Oynanan' : 'Played'}: <b class="num">${SAVE.stats.played}</b></span>
      <span>${LANG === 'tr' ? 'Geçilen' : 'Cleared'}: <b class="num">${SAVE.stats.cleared}</b></span>
      <span>${LANG === 'tr' ? 'En iyi kombo' : 'Best combo'}: <b class="num">x${SAVE.stats.bestCombo || 0}</b></span>
    </div>
    <button class="btn ghost wide" id="setReset" style="color:var(--rose)">${T('set_reset')}</button>
    <button class="btn primary wide" id="setClose">${T('close')}</button>
  `);
  $$('[data-toggle]', m.el).forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.toggle;
    SAVE.settings[k] = !SAVE.settings[k];
    $('.sw2', b).classList.toggle('on', SAVE.settings[k]);
    persist(true);
    if (k === 'music') musicSync();
    if (k === 'marks') { clearSprites(); G.goals && G.goals.forEach(paintGoalIcon); }
    if (k === 'sound' && SAVE.settings.sound) { audioResume(); SFX.select(); }
    if (k === 'haptics') buzz(14);
  }));
  $$('#segTheme button', m.el).forEach(b => b.addEventListener('click', () => {
    SAVE.settings.theme = b.dataset.th;
    $$('#segTheme button', m.el).forEach(x => x.classList.toggle('on', x === b));
    persist(true); applyTheme(); SFX.tap();
  }));
  $$('#segLang button', m.el).forEach(b => b.addEventListener('click', () => {
    setLang(b.dataset.lang);
    m.close();
    relabelEverything();
    SFX.tap();
    setTimeout(openSettings, 60);
  }));
  $('#setHow', m.el).addEventListener('click', () => { m.close(); howToPlay(); });
  $('#setKeys', m.el).addEventListener('click', () => { m.close(); keyboardHelp(); });
  $('#setClose', m.el).addEventListener('click', m.close);
  $('#setReset', m.el).addEventListener('click', () => {
    const c2 = modal(`
      <h2>${T('set_reset_confirm')}</h2>
      <p>${T('set_reset_confirm_s')}</p>
      <div class="row">
        <button class="btn primary" id="rsNo">${T('set_reset_no')}</button>
        <button class="btn rose" id="rsYes">${T('set_reset_yes')}</button>
      </div>`);
    $('#rsNo', c2.el).addEventListener('click', c2.close);
    $('#rsYes', c2.el).addEventListener('click', () => { wipeSave(); location.reload(); });
  });
}
function applyTheme() {
  const t = SAVE.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  readPalette();
  themeColorSync();   /* the strip above the top bar follows Day and Dusk */
  clearSprites();
  paintLogo();
  if (SCREEN === 'map') drawMap();
  if (SCREEN === 'game') drawLevelScene();   /* the lane is painted once, so it has to be repainted here */
  if (G.goals && G.goals.length) G.goals.forEach(paintGoalIcon);
  if (SCREEN === 'shop') renderShop();
  if (SCREEN === 'family') renderFamily();
}
/* The labels only a screen reader hears. They live in the markup, so
   nothing else would ever change them. */
function relabelControls() {
  const set = (sel, key) => { const el = $(sel); if (el) el.setAttribute('aria-label', T(key)); };
  set('#btnSettings', 'aria_settings');
  set('#btnQuit', 'aria_quit');
  set('#companion', 'aria_ability');
  const b = $('#board');
  if (b) b.setAttribute('aria-label', T('a11y_help'));
}
function relabelEverything() {
  $('#brandSub').textContent = T('brandSub');
  const rt = $('#rotT'), rs = $('#rotS');
  if (rt) rt.textContent = T('rot_t');
  if (rs) rs.textContent = T('rot_s');
  relabelControls();
  buildTabs();
  renderHome();
  if (SCREEN === 'shop') renderShop();
  if (SCREEN === 'family') renderFamily();
  if (SCREEN === 'map') mapLayout();
  syncHud();
}
function paintLogo() {
  const cv = $('#logo');
  const c = fitCanvas(cv, 30, 30);
  drawLogo(c, 30);
}

/* ---------------- tutorials ---------------- */
function maybeTutorial(def) {
  const pet = activePet();
  const steps = [];
  if (!SAVE.seen.swap) steps.push({ k: 'swap', text: T('tut_swap') + ' ' + T('tut_match') });
  if (!SAVE.seen.pet && pet) steps.push({ k: 'pet', text: T('tut_pet', { name: pet.name, breed: breedName(pet.breed) }) });
  if (def.tut === 'special' && !SAVE.seen.special) steps.push({ k: 'special', text: T('tut_special') });
  if (def.goals.some(g => g[0] === GK.BRAMBLE) && !SAVE.seen.bramble) {
    steps.push({ k: 'bramble', text: T('tut_bramble') });
  }
  /* Molehills turn up seventy-six levels in, so this is the one
     explanation a player meets when they already know how to play. It
     has to say the rule and the counter-move and nothing else. */
  if (def.goals.some(g => g[0] === GK.MOLE) && !SAVE.seen.mole) {
    steps.push({ k: 'mole', text: T('tut_mole'), art: 'mole' });
  }
  if (def.goals.some(g => g[0] === GK.RESCUE) && !SAVE.seen.rescue) {
    steps.push({ k: 'rescue', text: LANG === 'tr' ? 'Sepetteki minikleri en alt sıraya indir; kapıdan çıkıp eve girerler.' : 'Walk the little ones down to the bottom row and they are home.' });
  }
  /* the three that arrived with no explanation at all */
  const onMap = def.map ? def.map.join('') : '';
  const firstSight = (chars, key, text, art) => {
    if (SAVE.seen[key]) return;
    for (const ch of chars) if (onMap.indexOf(ch) >= 0) { steps.push({ k: key, text, art }); return; }
  };
  firstSight('cC', 'crate', T('how_crate'), 'crate');
  firstSight('mM', 'mud', T('how_mud'), 'mud');
  firstSight('i', 'ice', T('how_ice'), 'ice');
  if (!steps.length) return;
  let i = 0;
  const show = () => {
    if (i >= steps.length) return;
    const s = steps[i++];
    SAVE.seen[s.k] = 1; persist();
    const m = modal(`
      <canvas id="tutArt" width="120" height="120" style="width:120px;height:120px;align-self:center"></canvas>
      <p style="font-size:var(--t-body);color:var(--text)">${s.text}</p>
      <button class="btn primary wide" id="tutOk">${T('tut_got')}</button>
    `, { dismissable: false });
    const c = fitCanvas($('#tutArt', m.el), 120, 120);
    if (s.art) {
      /* a card about a crate should show a crate */
      c.translate(60, 60);
      if (s.art === 'crate') paintCrate(c, 82, 2);
      else if (s.art === 'mud') paintMud(c, 82, 2);
      else if (s.art === 'mole') paintMole(c, 82, 2);
      else { paintTile(c, 1, SP.NONE, 78, SAVE.settings.marks); paintIce(c, 82); }
    } else {
      c.translate(60, 18);
      if (pet) drawBody(c, specOfPet(pet), 54, { mouth: 'open' });
    }
    $('#tutOk', m.el).addEventListener('click', () => { m.close(); setTimeout(show, 180); });
  };
  setTimeout(show, 520);
}

/* ---------------- onboarding ---------------- */
function runOnboarding() {
  $('#onb').classList.add('on');
  const card = $('#onbCard');
  let step = 0, breedIdx = 0, coat = 0, eye = 0;
  let name = '';

  const dots = n => `<div class="dots">${[0, 1, 2, 3].map(i => `<i class="${i === n ? 'on' : ''}"></i>`).join('')}</div>`;

  const render = () => {
    if (step === 0) {
      card.innerHTML = `
        <canvas id="obHero" width="180" height="180" style="width:180px;height:180px;align-self:center"></canvas>
        <h1 style="font-size:var(--t-hero)">${T('onb_hi')}</h1>
        <p style="color:var(--text-dim)">${T('onb_hi_sub')}</p>
        <button class="btn primary wide" id="obNext">${T('onb_start')}</button>
        ${dots(0)}`;
      const c = fitCanvas($('#obHero'), 180, 180);
      c.translate(90, 90);
      paintPup(c, 150, 0);
    } else if (step === 1) {
      card.innerHTML = `
        <h2>${T('onb_pick')}</h2>
        <p style="font-size:var(--t-small)">${T('onb_pick_sub')}</p>
        <div class="choiceGrid" style="grid-template-columns:repeat(3,1fr)">
          ${BREEDS.map((b, i) => `
            <button class="choice ${i === breedIdx ? 'on' : ''}" data-b="${i}">
              <canvas data-face="${i}" width="84" height="84"></canvas>
              <span class="nm">${breedName(i)}</span>
              <span class="ds">${breedDesc(i)}</span>
            </button>`).join('')}
        </div>
        <div class="row"><button class="btn ghost" id="obBack">${T('onb_back')}</button>
        <button class="btn primary" id="obNext">${T('onb_next')}</button></div>
        ${dots(1)}`;
      paintArtCanvases(card);
      $$('[data-b]', card).forEach(b => b.addEventListener('click', () => {
        breedIdx = +b.dataset.b; coat = 0;
        eye = Math.max(0, EYE_COLORS.findIndex(e => e.hex === BREEDS[breedIdx].eyes));
        SFX.tap(); petVoiceBreed(breedIdx);
        render();
      }));
    } else if (step === 2) {
      card.innerHTML = `
        <canvas id="obArt" width="150" height="122" style="width:150px;height:122px;align-self:center"></canvas>
        <h2>${T('onb_coat')}</h2>
        <p style="font-size:var(--t-small)">${T('onb_coat_sub')}</p>
        <div class="choiceGrid" style="grid-template-columns:repeat(3,1fr)">
          ${BREEDS[breedIdx].coats.map((co, i) => `
            <button class="choice ${i === coat ? 'on' : ''}" data-c="${i}" style="padding:10px 5px">
              <canvas data-face="${breedIdx}" data-coat="${i}" width="66" height="66"></canvas>
              <span class="nm" style="font-size:var(--t-small)">${LANG === 'tr' ? co.tr : co.en}</span>
            </button>`).join('')}
        </div>
        <div class="eyebrow">${T('onb_eyes')}</div>
        <div class="swatches">
          ${EYE_COLORS.map((e, i) => `<button class="sw ${i === eye ? 'on' : ''}" data-e="${i}" style="background:${e.hex}"></button>`).join('')}
        </div>
        <div class="row"><button class="btn ghost" id="obBack">${T('onb_back')}</button>
        <button class="btn primary" id="obNext">${T('onb_next')}</button></div>
        ${dots(2)}`;
      paintArtCanvases(card);
      const art = () => {
        const c = fitCanvas($('#obArt'), 150, 122);
        c.translate(75, 12);
        drawBody(c, specOf(breedIdx, BREEDS[breedIdx].coats[coat], EYE_COLORS[eye].hex), 74, { mouth: 'smile' });
      };
      art();
      $$('[data-c]', card).forEach(b => b.addEventListener('click', () => { coat = +b.dataset.c; SFX.tap(); render(); }));
      $$('[data-e]', card).forEach(b => b.addEventListener('click', () => { eye = +b.dataset.e; SFX.tap(); render(); }));
    } else {
      const names = NAME_POOL[BREEDS[breedIdx].species];
      card.innerHTML = `
        <canvas id="obArt" width="146" height="118" style="width:146px;height:118px;align-self:center"></canvas>
        <h2>${T('onb_name')}</h2>
        <p style="font-size:var(--t-small)">${T('onb_name_sub')}</p>
        <input class="field" id="obName" maxlength="14" placeholder="${T('onb_placeholder')}" value="${name}">
        <div style="font-size:var(--t-micro);color:var(--text-faint)">${T('onb_suggest')}</div>
        <div class="nameSuggest">${names.slice(0, 6).map(n => `<button data-n="${n}">${n}</button>`).join('')}</div>
        <div class="row"><button class="btn ghost" id="obBack">${T('onb_back')}</button>
        <button class="btn primary" id="obNext">${T('onb_done')}</button></div>
        ${dots(3)}`;
      const c = fitCanvas($('#obArt'), 146, 118);
      c.translate(73, 11);
      drawBody(c, specOf(breedIdx, BREEDS[breedIdx].coats[coat], EYE_COLORS[eye].hex), 68, { mouth: 'smile' });
      $$('[data-n]', card).forEach(b => b.addEventListener('click', () => {
        name = b.dataset.n; $('#obName').value = name; SFX.tap();
      }));
      $('#obName').addEventListener('input', e => { name = e.target.value; });
    }
    const nx = $('#obNext'); if (nx) nx.addEventListener('click', next);
    const bk = $('#obBack'); if (bk) bk.addEventListener('click', () => { step--; SFX.tap(); render(); });
  };
  const petVoiceBreed = i => { if (BREEDS[i].species === 'cat') SFX.meow(1.25); else SFX.bark(1.2); };
  let adopted = false;
  const next = () => {
    audioResume();
    SFX.tap();
    if (step < 3) { step++; render(); return; }
    /* two taps in one frame would adopt twice and greet the first pet
       by the second one's name */
    if (adopted) return;
    adopted = true;
    const nm = cleanName(name) || pick(NAME_POOL[BREEDS[breedIdx].species]);
    const p = makePet(breedIdx, coat, eye, nm);
    SAVE.pets = [p];
    SAVE.activePet = p.id;
    castChanged();
    persist(true);
    $('#onb').classList.remove('on');
    petVoiceBreed(breedIdx);
    welcomeModal(p);
  };
  render();
}
function welcomeModal(p) {
  const m = modal(`
    <canvas id="wcArt" width="160" height="160" style="width:160px;height:160px;align-self:center"></canvas>
    <h2>${T('onb_welcome', { name: p.name })}</h2>
    <p>${T('onb_welcome_sub', { name: p.name, breed: breedName(p.breed) })}</p>
    <button class="btn primary wide" id="wcGo">${T('onb_go')}</button>
  `, { dismissable: false });
  const c = fitCanvas($('#wcArt', m.el), 160, 160);
  c.translate(80, 18);
  drawBody(c, specOfPet(p), 74, { mouth: 'open' });
  $('#wcGo', m.el).addEventListener('click', () => {
    m.close();
    renderHome();
    setScreen('map');
    setTimeout(() => openLevelIntro(1), 340);
  });
}
