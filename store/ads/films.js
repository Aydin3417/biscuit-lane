/* The films. Each is one async function on the page's clock: it presses
   the game's own buttons, moves the camera and changes the headline.

   A film is scenes in an order, and the order is the thing being tested:
   `basket` opens on the story (a basket on the step, and who is in it),
   `board` opens on the play. Same scenes, same words, same game.

   Every headline is a sentence about the build. The table in README.md
   says which line of the game makes each one true. */
const FILMS = {};

const NAME = { tr: 'Zeytin', en: 'Olive' };
const COPY = {
  tr: {
    hook: ['Kapında bir sepet.', '[[Açar mıydın?]]'],
    pick: ['Kedi mi, köpek mi?', '[[Sen seç]]'],
    name: ['Adını da', '[[sen koy]]'],
    home: ['Hoş geldin,', '[[Zeytin]]'],
    face: ['Tahtadaki yüz artık', '[[senin kedin]]'],
    faceFirst: ['Bu tahtadaki kedi', '[[senin kedin]]'],
    leap: ['Sıkışınca', '[[Zeytin yetişir]]'],
    win: ['Üç yıldız,', '[[mutlu bir kedi]]'],
    care: ['Sev, oyna,', '[[büyümesini izle]]'],
    tag: 'Eşleştir &amp; Büyüt',
    cta: { get: 'Ücretsiz indir', soon: 'Çok yakında' },
    fine: 'iPhone · İnternetsiz oynanır · Bölümü bölen reklam yok'
  },
  en: {
    hook: ['A basket on your step.', '[[Would you open it?]]'],
    pick: ['A cat or a dog?', '[[You choose]]'],
    name: ['Then give them', '[[a name]]'],
    home: ['Welcome home,', '[[Olive]]'],
    face: ['Now the face you match', '[[is your own cat]]'],
    faceFirst: ['The cat on this board', '[[is your own cat]]'],
    leap: ['Stuck?', '[[Olive jumps in]]'],
    win: ['Three stars,', '[[one happy cat]]'],
    care: ['Play with them,', '[[watch them grow]]'],
    tag: 'Match &amp; Raise Pets',
    cta: { get: 'Download free', soon: 'Coming soon' },
    fine: 'iPhone · Plays offline · No ad breaks into a level'
  }
};
/* where the phone starts to show under the headline, in page points */
const LENS = 248;
const CTA = new URLSearchParams(location.search).get('cta') === 'soon' ? 'soon' : 'get';

/* ---------- the save a scene opens on ---------- */
/* A player a few levels in: everything the tutorial would have said has
   been said, every badge the scene could trip is already on the shelf,
   so nothing but the scene itself arrives on screen. */
function midGame(AD, lang) {
  const B = AD.BL(), S = B.save, D = AD.K().document;
  if (!S.pets.length) {
    S.pets = [B.makePet(2, 0, 0, NAME[lang])];
    S.activePet = S.pets[0].id;
    D.querySelector('#onb').classList.remove('on');
  }
  S.reached = 6; S.coins = 480; S.treats = 6; S.hearts = 5;
  for (let i = 1; i < 6; i++) S.stars[i] = 2 + (i % 2);
  S.toys = { yarn: 1 }; S.food = { kibble: 4, tuna: 2 };
  S.furniture = { rug: 1, shelf: 1, armchair: 1, basket: 1, tower: 1 };
  S.room = { theme: 'oat', placed: ['rug', 'shelf', 'armchair', 'basket', 'tower'] };
  S.seen = { swap: 1, pet: 1, special: 1, bramble: 1, mole: 1, rescue: 1, crate: 1, mud: 1, ice: 1 };
  B.BADGES.forEach(x => { S.badges[x.id] = 1; });
  S.lastGift = Date.now();
  S.settings.theme = 'light';
  B.castRebuild(); B.persist(true);
  D.querySelector('#topbar').style.visibility = '';
  D.querySelector('#tabbar').style.visibility = '';
}

/* ---------- scene: the basket ---------- */
async function basket(AD, lang) {
  const { wait, K } = AD, c = COPY[lang], D = K().document;
  const q = s => D.querySelector(s);
  AD.setLens(LENS);
  AD.setCam(AD.frame(...AD.span('#obHero', '#obNext'), { y1: 770 }));
  AD.statusAuto();
  AD.mark('basket');
  AD.copy(c.hook, { out: 0 });
  await wait(1250);
  await AD.tap('#obNext');

  AD.mark('pick');
  AD.copy(c.pick);
  AD.cam(AD.frame(...AD.span('#onbCard h2', '#obNext'), { y1: 770 }), 380);
  await wait(520);
  await AD.tap('[data-b="2"]', { stay: true });
  await wait(420);
  /* the coat is a screen of its own; the film goes straight through it */
  await AD.tap('#obNext', { then: () => q('#obNext').click() });

  AD.mark('name');
  AD.copy(c.name);
  AD.cam(AD.frame(...AD.span('#obArt', '#obNext'), { y1: 770 }), 380);
  await wait(400);
  await AD.tap('#obName');
  await AD.type('#obName', NAME[lang], 90);
  await wait(260);
  await AD.tap('#obNext');

  AD.mark('home');
  AD.copy(c.home);
  await wait(60);
  AD.cam(AD.frame(...AD.span('#wcArt', '#wcGo'), { y1: 770, max: 1.2 }), 420);
  await wait(1300);
}

/* ---------- scene: the board ---------- */
async function board(AD, lang, first) {
  const { wait, kwait, K, BL } = AD, c = COPY[lang], D = K().document;
  await AD.offcam(async () => {
    AD.clearModals();
    midGame(AD, lang);
    const B = BL();
    if (K().__clock) K().__clock.seed(4107);
    B.startLevel(1, { perks: [] }); B.setScreen('game'); B.layoutBoard();
    await kwait(40);
    AD.clearModals();
  });
  const B = BL(), G = B.game, SP = B.SP;
  /* The first level, which asks for thirty-four of the cat's own face,
     some way in: a rocket and a bomb already made and lying side by
     side, her move charged, the goal five short. */
  const mine = B.castSlot(B.activePet().breed);
  const plain = (r, k) => { const t = G.B.cell[r][k].tile; return t && t.type >= 0 && t.sp === SP.NONE; };
  let at = null;
  for (const r of [4, 3, 5, 2]) { for (const k of [2, 3, 1, 4]) if (!at && plain(r, k) && plain(r, k + 1)) at = [r, k]; }
  G.B.cell[at[0]][at[1]].tile.sp = SP.ROW;
  G.B.cell[at[0]][at[1] + 1].tile.sp = SP.BOMB;
  /* two moves left and two to play: the level is won on the last one,
     so no leftover moves stand between the blast and the card */
  G.moves = 2;
  G.goals.forEach(g => { g.have = g.need - 5; });
  G.score = Math.round(G.starTargets[2] * .86);
  G.charge = 100;
  B.syncStars(); B.syncGoals(); B.syncHud();

  AD.setLens(LENS);
  const [bt] = AD.span('#board'), [, gb] = AD.span('.gbottom');
  AD.setCam(AD.frame(bt - 84, gb, { y1: 790 }));
  AD.statusAuto();
  AD.mark('board');
  if (!first) AD.bg('sage', 300);
  AD.copy(first ? c.faceFirst : c.face, { out: first ? 0 : 120 });
  AD.punch(.035, 300);
  await wait(950);

  /* a match of the cat's own face, well clear of the rocket and the bomb */
  const moves = B.allMoves(G.B).filter(([a, b]) => {
    const ta = G.B.cell[a[0]][a[1]].tile, tb = G.B.cell[b[0]][b[1]].tile;
    if (ta.sp !== SP.NONE || tb.sp !== SP.NONE) return false;
    if (Math.max(a[0], b[0]) >= at[0] - 1) return false;
    return ta.type === mine || tb.type === mine;
  });
  const m1 = moves[0] || B.allMoves(G.B)[0];
  await AD.swipe(m1[0], m1[1]);
  await AD.still();
  await wait(260);

  /* the cat's own move: she leaves rockets where she lands */
  AD.mark('leap');
  AD.copy(c.leap);
  await wait(380);
  await AD.tap('#companion');
  await AD.still();
  await wait(520);

  /* the rocket into the bomb, wherever the first match left them */
  let pair = null;
  for (let r = 0; r < G.B.h; r++) for (let k = 0; k < G.B.w - 1; k++) {
    const a = G.B.cell[r][k].tile, b = G.B.cell[r][k + 1].tile;
    if (a && b && ((a.sp === SP.BOMB && (b.sp === SP.ROW || b.sp === SP.COL)) || (b.sp === SP.BOMB && (a.sp === SP.ROW || a.sp === SP.COL)))) pair = [[r, k], [r, k + 1]];
  }
  if (!pair) pair = B.allMoves(G.B)[0];
  AD.mark('blast');
  const blast = AD.swipe(pair[0], pair[1], { nowait: true });
  await wait(330);
  AD.punch(.05, 420);
  await blast;
  AD.mark('settled');
  /* the win card, once the last moves have gone off as fireworks */
  for (let i = 0; i < 400 && !D.querySelector('#modals .modal, #modals > *'); i++) await wait(34);
  /* a film that ends on anything but three stars is not this film */
  if (G.starsEarned !== 3 || !D.querySelector('#modals h2')) throw new Error('the level did not end on three stars (' + G.starsEarned + '): shoot it again');
  AD.mark('win');
  AD.copy(c.win);
  AD.cam(AD.frame(...AD.span('#modals h2'), { y1: 770, max: 1.12 }), 500);
  await wait(1900);
}

/* ---------- scene: the room upstairs ---------- */
async function room(AD, lang) {
  const { wait, kwait, K, BL } = AD, c = COPY[lang], D = K().document;
  await AD.offcam(async () => {
    AD.clearModals();
    const B = BL(), S = B.save, p = B.activePet();
    p.food = 72; p.joy = 44; p.clean = 84; p.energy = 78; p.asleep = false;
    /* one game short of growing up: a game is worth two (carePlay) */
    p.bond = 5; p.bondXp = 0;
    const q = JSON.parse(JSON.stringify(p));
    let need = 0;
    while (q.bond < 6 && need < 99) { B.addBond(q, 1); need++; }
    p.bondXp = need - 2;
    B.persist(true);
    B.setScreen('home'); B.renderHome();
    await kwait(700);
    AD.clearModals();
    const row = D.querySelector('.careRow');
    let sc = row.parentElement;
    while (sc && !(sc.scrollHeight > sc.clientHeight + 20 && /auto|scroll/.test(K().getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    if (sc) sc.scrollTop += row.getBoundingClientRect().top - sc.getBoundingClientRect().top - 14;
    await kwait(300);
  });
  AD.setLens(LENS);
  const [rt] = AD.span('#room'), [, cb] = AD.span('.careRow');
  AD.setCam(AD.frame(rt, cb + 10, { y1: 770 }));
  AD.statusAuto();
  AD.mark('room');
  AD.bg('plum', 300);
  AD.copy(c.care, { out: 120 });
  AD.punch(.035, 300);
  await wait(1000);
  await AD.tap('#carePlay');
  /* she chases the wool, and it was the game that did it */
  for (let i = 0; i < 200 && !D.querySelector('#suArt'); i++) await wait(34);
  AD.mark('grew');
  AD.cam(AD.frame(...AD.span('#suArt', '#modals h2'), { y1: 760, max: 1.16 }), 480);
  await wait(2100);
}

/* ---------- scene: the name of the game ---------- */
async function last(AD, lang) {
  const c = COPY[lang];
  AD.mark('end');
  AD.copy(null, { out: 200 });
  AD.bg('navy', 420);
  const s0 = AD.camNow.s, lens0 = AD.lensAt;
  AD.tween(420, k => { document.getElementById('lens').style.opacity = 1 - k; AD.setCam({ s: s0 * (1 - .08 * k) }); });
  await AD.wait(260);
  await AD.endCard({ tag: c.tag, cta: c.cta[CTA], fine: c.fine, pets: [0, 2, 1] });
  await AD.wait(2300);
}

/* the onboarding is drawn before the language is known (see README:
   a fresh save is English whatever the phone says), so step forward and
   back once to have it drawn again */
FILMS['basket:before'] = async AD => {
  const D = AD.K().document;
  D.querySelector('#obNext').click();
  await new Promise(r => setTimeout(r, 120));
  D.querySelector('#obBack').click();
  await new Promise(r => setTimeout(r, 200));
};

FILMS.basket = async (AD, lang) => {
  AD.BL().audio.init();
  await basket(AD, lang);
  await board(AD, lang, false);
  await room(AD, lang);
  await last(AD, lang);
};

FILMS['board:before'] = async (AD, lang) => { midGame(AD, lang); await AD.bg('sage', 0); };
FILMS.board = async (AD, lang) => {
  AD.BL().audio.init();
  await board(AD, lang, true);
  await room(AD, lang);
  await last(AD, lang);
};
