/* ============================================================
   52 — the house project: stars won on the lane, spent on the room
   ============================================================

   WHY THE ROOM HAD NOTHING TO DO WITH THE LEVELS.

   The furniture was a coin shop. A level paid coins, and the coins
   bought an armchair or a fern from a list, and the list ran out, and
   nothing in the room said why anybody should play the next level
   rather than buy the next lamp. The owner, on 21 Nov 2026: "the part
   where we look after our animal and could spend money is the part that
   makes no sense right now." The games this one is measured against all
   answer it the same way: a level won is a star, and a star is spent on
   one small job in a place you are doing up — lay the rug, paint the
   walls, put the armchair by the window — and each job shows at once.
   The level is the work and the room is the wage.

   So: every level cleared for the first time pays stars (one, two on a
   hard level, three on a super-hard one; one for the day's walk), and
   the room is done up in four projects of seven or eight jobs, each job
   a piece of furniture or a coat of paint, each finished project a
   chest. The furniture leaves the coin shop: owning it comes from the
   project, and anything owned can still be moved about from the shop's
   Looks tab. Coins keep what they are good for — food, toys, boosters,
   hats, collars, the other paints, and carrying on a lost level.

   When every project is done the stars do not stop meaning something:
   each ten opens a chest. The art for more rooms can come later; a
   currency that dead-ends is worse than one that pays in a box. */

const PROJECTS = [
  { id: 'upstairs', en: 'The room upstairs', tr: 'Üst kattaki oda',
    reward: { coins: 150, treats: 3, booster: 'hammer' },
    tasks: [
      { id: 'u-rug', give: ['furniture', 'rug'], cost: 1, en: 'Lay a rug by the window', tr: 'Pencerenin önüne halı ser' },
      { id: 'u-plant', give: ['furniture', 'plant'], cost: 1, en: 'A fern in the corner', tr: 'Köşeye bir bitki koy' },
      { id: 'u-bed', give: ['furniture', 'petbed'], cost: 2, en: 'A soft bed of their own', tr: 'Yumuşak bir yatak' },
      { id: 'u-shelf', give: ['furniture', 'shelf'], cost: 2, en: 'Put up a shelf', tr: 'Duvara bir raf as' },
      { id: 'u-paint', give: ['theme', 'blush'], cost: 2, en: 'Paint the walls blush', tr: 'Duvarları pudra rengine boya' },
      { id: 'u-chair', give: ['furniture', 'armchair'], cost: 3, en: 'An armchair by the window', tr: 'Pencerenin önüne bir koltuk' },
      { id: 'u-lamp', give: ['furniture', 'lamp'], cost: 2, en: 'A lamp for the evenings', tr: 'Akşamlar için bir lambader' },
      { id: 'u-flags', give: ['furniture', 'bunting'], cost: 2, en: 'Hang up the bunting', tr: 'Flamaları as' }
    ] },
  { id: 'play', en: 'The play corner', tr: 'Oyun köşesi',
    reward: { coins: 250, treats: 5, booster: 'moves' },
    tasks: [
      { id: 'p-chest', give: ['furniture', 'toychest'], cost: 2, en: 'A chest for the toys', tr: 'Oyuncaklar için bir sandık' },
      { id: 'p-paint', give: ['theme', 'mint'], cost: 2, en: 'Paint the walls mint', tr: 'Duvarları nane yeşiline boya' },
      { id: 'p-tower', give: ['furniture', 'tower'], cost: 3, en: 'A tower to climb', tr: 'Tırmanmak için bir kule' },
      { id: 'p-birds', give: ['furniture', 'window'], cost: 3, en: 'A bird feeder to watch', tr: 'İzlemek için bir kuş yemliği' },
      { id: 'p-bean', give: ['furniture', 'beanbag'], cost: 3, en: 'A beanbag to sink into', tr: 'Bir armut koltuk' },
      { id: 'p-print', give: ['furniture', 'poster'], cost: 2, en: 'Frame a painting', tr: 'Duvara bir tablo as' },
      { id: 'p-lights', give: ['furniture', 'lights'], cost: 3, en: 'String up fairy lights', tr: 'Işık zinciri as' }
    ] },
  { id: 'nook', en: 'The reading nook', tr: 'Okuma köşesi',
    reward: { coins: 350, treats: 8, booster: 'swap' },
    tasks: [
      { id: 'n-paint', give: ['theme', 'butter'], cost: 2, en: 'Paint the walls buttermilk', tr: 'Duvarları ayran rengine boya' },
      { id: 'n-books', give: ['furniture', 'bookcase'], cost: 3, en: 'A bookcase, top shelf theirs', tr: 'Bir kitaplık koy' },
      { id: 'n-rocker', give: ['furniture', 'rocker'], cost: 3, en: 'A rocking chair', tr: 'Sallanan bir sandalye' },
      { id: 'n-cactus', give: ['furniture', 'cactus'], cost: 2, en: 'A cactus nobody chews', tr: 'Kimsenin kemirmediği bir kaktüs' },
      { id: 'n-fish', give: ['furniture', 'fishbowl'], cost: 3, en: 'A fishbowl to stare at', tr: 'Seyretmek için bir akvaryum' },
      { id: 'n-basket', give: ['furniture', 'basket'], cost: 2, en: 'A basket for everything', tr: 'Her şey için bir sepet' },
      { id: 'n-plant', give: ['furniture', 'monstera'], cost: 3, en: 'A monstera that never stops', tr: 'Kocaman bir deve tabanı' }
    ] },
  { id: 'evening', en: 'The evening room', tr: 'Akşam odası',
    reward: { coins: 450, treats: 10, booster: 'shuffle' },
    tasks: [
      { id: 'e-paint', give: ['theme', 'night'], cost: 3, en: 'Paint the walls deep blue', tr: 'Duvarları gece mavisine boya' },
      { id: 'e-kennel', give: ['furniture', 'kennel'], cost: 3, en: 'A kennel indoors', tr: 'İçeride bir kulübe' },
      { id: 'e-moss', give: ['theme', 'moss'], cost: 3, en: 'Try the walls in moss', tr: 'Duvarları yosun yeşiline boya' },
      { id: 'e-clay', give: ['theme', 'clay'], cost: 3, en: 'Or terracotta, warmer', tr: 'Duvarları kiremit rengine boya' }
    ] }
];
function projectTheme(id) { return PROJECTS.some(p => p.tasks.some(t => t.give[0] === 'theme' && t.give[1] === id)); }
/* after the last project, every ten stars is a chest */
const STAR_CHEST = 10;

/* what a first clear of level n pays in stars: the tier is the price */
function starsForLevel(n) {
  const t = typeof tierOf === 'function' ? tierOf(n) : '';
  return t === 'super' ? 3 : t === 'hard' ? 2 : 1;
}

/* The project's own state lives in the save under `home`. Read through
   here so that a save from before 1.4 is brought in on first touch: the
   furniture and paint it already bought count as jobs done, and it is
   given a few stars to start with — capped, so a player a hundred
   levels in finds a project under way rather than a finished one. */
function homeState() {
  if (!SAVE.home) {
    SAVE.home = { stars: 0, earned: 0, done: {}, chests: 0 };
    PROJECTS.forEach(p => p.tasks.forEach(t => { if (taskOwned(t)) SAVE.home.done[t.id] = 1; }));
    const cleared = Object.keys(SAVE.stars || {}).filter(k => SAVE.stars[k] > 0).length;
    SAVE.home.stars = Math.min(10, cleared);
  }
  return SAVE.home;
}
function taskOwned(t) {
  const [kind, id] = t.give;
  return kind === 'theme' ? !!(SAVE.roomThemes && SAVE.roomThemes[id]) : !!(SAVE.furniture && SAVE.furniture[id]);
}
function currentProject() {
  const h = homeState();
  return PROJECTS.find(p => p.tasks.some(t => !h.done[t.id])) || null;
}
function projectProgress(p) {
  const h = homeState();
  return { done: p.tasks.filter(t => h.done[t.id]).length, all: p.tasks.length };
}
function addHomeStars(n, why) {
  if (!(n > 0)) return;
  const h = homeState();
  h.stars += n; h.earned += n;
  track('home_stars', { n, why: why || 'level', have: h.stars });
}

/* a job, paid for and shown */
function doTask(id) {
  const h = homeState();
  const p = PROJECTS.find(q => q.tasks.some(t => t.id === id));
  const t = p && p.tasks.find(x => x.id === id);
  if (!t || h.done[id]) return false;
  if (h.stars < t.cost) { SFX.bad(); toast(T('proj_need', { n: t.cost - h.stars }), 'star'); return false; }
  h.stars -= t.cost;
  h.done[id] = 1;
  const [kind, thing] = t.give;
  if (kind === 'theme') { SAVE.roomThemes[thing] = 1; equipThing(thing, 'theme', true); }
  else { SAVE.furniture[thing] = 1; if (SAVE.room.placed.indexOf(thing) < 0) equipThing(thing, 'furniture', true); }
  const pet = activePet();
  if (pet) addBond(pet, 1);
  track('home_task', { id, cost: t.cost, left: h.stars });
  persist(true);
  SFX.levelup(); buzz(HAP.win);
  roomCelebrate();
  /* the room is what changed, so it is what the player is shown */
  const sc = document.querySelector('#scr-home .scroller');
  if (sc && sc.scrollTop > 0) sc.scrollTo({ top: 0, behavior: 'smooth' });
  toast(T('proj_task_done', { task: locText(t) }), 'check');
  const pr = projectProgress(p);
  if (pr.done === pr.all) setTimeout(() => projectDoneModal(p), 900);
  renderHome();
  return true;
}
function projectDoneModal(p) {
  const r = p.reward;
  SAVE.coins += r.coins; SAVE.treats += r.treats;
  if (r.booster) SAVE.boosters[r.booster] = (SAVE.boosters[r.booster] || 0) + 1;
  persist(true); syncPurse();
  track('home_project', { id: p.id });
  const next = currentProject();
  const b = BOOSTERS.find(x => x.id === r.booster);
  const m = modal(`
    <div class="chestPop"><canvas id="pjCv" width="150" height="130"></canvas></div>
    <h2>${T('proj_done_t')}</h2>
    <p>${T('proj_done_s', { name: locText(p) })}</p>
    <div class="rewardRow">
      <span class="reward" style="color:var(--accent-strong)">${IC.coin}+${r.coins}</span>
      <span class="reward" style="color:var(--plum)">${IC.treat}+${r.treats}</span>
      ${b ? `<span class="reward" style="color:var(--sage)">${IC[b.icon]}${goodName(b)}</span>` : ''}
    </div>
    <button class="btn primary wide big" id="pjOk">${next ? T('proj_next', { name: locText(next) }) : T('ok')}</button>`);
  const c = fitCanvas($('#pjCv', m.el), 150, 130);
  if (c) { c.translate(75, 118); drawChest(c, 0, 0, 96, true); }
  SFX.win();
  $('#pjOk', m.el).addEventListener('click', () => { m.close(); renderHome(); });
}
/* the stars after the last project: ten to a chest, forever */
function openStarChest() {
  const h = homeState();
  if (h.stars < STAR_CHEST) { SFX.bad(); toast(T('proj_need', { n: STAR_CHEST - h.stars }), 'star'); return; }
  h.stars -= STAR_CHEST; h.chests++;
  const pick = ['moves', 'hammer', 'swap', 'shuffle'][h.chests % 4];
  SAVE.boosters[pick] = (SAVE.boosters[pick] || 0) + 1;
  SAVE.coins += 120;
  persist(true); syncPurse();
  track('home_chest', { n: h.chests });
  chestModal({ coins: 120, treats: 0, booster: pick });
  renderHome();
}

/* The card on the home screen: where the house is, what the next jobs
   cost, and the stars in hand. Three jobs at a time, the cheapest first
   among those not done, because a list of eight reads as homework. */
function projectCardHtml() {
  const h = homeState();
  const p = currentProject();
  const star = `<span class="pstar" aria-hidden="true"></span>`;
  if (!p) {
    return `<div class="card pad16 projCard">
      <div class="projHead"><span class="ribbon">${T('proj_all_t')}</span><span class="projStars">${star}${h.stars}</span></div>
      <p class="projNote">${T('proj_all_s', { n: STAR_CHEST })}</p>
      <button class="btn primary wide" id="starChest" ${h.stars < STAR_CHEST ? 'disabled' : ''}>${T('proj_chest')} <span class="price">${star}${STAR_CHEST}</span></button>
    </div>`;
  }
  const pr = projectProgress(p);
  const open = p.tasks.filter(t => !h.done[t.id]).slice(0, 2);
  const thumb = t => t.give[0] === 'theme'
    ? (() => { const th = ROOM_THEMES.find(x => x.id === t.give[1]); return `<span class="swatch" style="background:linear-gradient(160deg,${th.wall},${th.wall2} 60%,${th.floor} 60%)"></span>`; })()
    : `<canvas data-room="${t.give[1]}" width="52" height="46"></canvas>`;
  return `<div class="card pad16 projCard">
    <div class="projHead"><span class="ribbon">${locText(p)}</span><span class="projStars" title="${T('proj_stars')}">${star}${h.stars}</span></div>
    <div class="projBar"><i style="width:${Math.round(pr.done / pr.all * 100)}%"></i><b>${pr.done} / ${pr.all}</b></div>
    ${open.map(t => `<div class="task">
      <span class="thumb">${thumb(t)}</span>
      <span class="t">${locText(t)}</span>
      <button class="btn sm ${h.stars >= t.cost ? 'primary' : 'locked'}" data-task="${t.id}">${star}${t.cost}</button>
    </div>`).join('')}
    ${open.every(t => h.stars < t.cost) ? `<p class="projNote">${T('proj_play_hint')}</p>` : ''}
  </div>`;
}
function bindProjectCard(root) {
  $$('[data-task]', root).forEach(b => b.addEventListener('click', () => { audioResume(); doTask(b.dataset.task); }));
  const sc = $('#starChest', root); if (sc) sc.addEventListener('click', openStarChest);
  const cv = $$('canvas[data-room]', root); if (cv.length) paintArtCanvases(root.querySelector('.projCard') || root);
}
