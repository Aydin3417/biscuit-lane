/* ============================================================
   15 — persistence
   ============================================================ */
const SAVE_KEY = 'pawtika-v1';
const HEART_MAX = 5;
/* Twelve minutes meant a full set came back in an hour, which is short
   enough that nobody ever met the wall: you lost a heart, wandered to
   the room for a minute, and it was already on its way back. A gate
   nobody meets is a gate that costs the player nothing and is worth
   nothing — and everything downstream of it, the refill and the store
   behind that, was being sold against a wait that never happened.
   Twenty-five puts a full set at just over two hours. */
const HEART_REFILL = ECON.heartRefillMin * MIN;
let SAVE = null;

function freshSave() {
  return {
    v: SAVE_VERSION,
    created: now(),
    lastSeen: now(),
    install: 0,               // random, made on first boot, forgotten with the save
    coins: 120,
    treats: 6,
    hearts: HEART_MAX,
    heartAt: now(),
    stars: {},                 // levelNumber -> 1..3
    scores: {},                // levelNumber -> best score seen there
    reached: 1,                // highest unlocked level
    pets: [],
    activePet: null,
    food: { kibble: 3, tuna: 1, stew: 0, cake: 0 },
    toys: {},
    boosters: { moves: 1, hammer: 2, swap: 1, shuffle: 1 },
    hats: { none: 1 },
    collars: { none: 1 },
    /* coats and eye colours unlocked, beyond the ones each animal was
       adopted wearing — see GROOM in 10-data.js. Keyed 'breedId:coatId'
       and by eye id, because both outlive any particular pet: sell a
       colour once and every animal in the house can wear it. */
    coats: {},
    eyes: {},
    furniture: {},
    roomThemes: { oat: 1 },
    room: { theme: 'oat', placed: [] },
    streak: 0,
    lastGift: 0,
    seen: {},                  // tutorial flags
    /* `notify` starts false and is only ever set by the player answering
       the system's own dialog — see 16-notify.js. Defaulting it true
       would have the settings screen showing a switch that is on while
       nothing can actually be delivered. */
    settings: { sound: true, music: true, haptics: true, lang: 'en', theme: 'auto', marks: false, telemetry: true, notify: false },
    badges: {},
    daily: { day: 0, done: false, best: 0, streak: 0 },
    jar: { fill: 0, opened: 0 },   // the treat jar, filled by playing
    /* id -> 1, except the photograph, which keeps the animal it is of */
    keepsakes: {},
    /* rewarded video, one a day each; rolls over with the gift ladder */
    ads: { day: 0, used: {} },
    /* the season book: stamps this season, and what has been taken */
    pass: { season: -1, stamps: 0, paid: false, claimed: {} },
    /* asked once, ever — see maybeAskForAReview in 60-ui.js */
    rated: { asked: 0, said: 0 },
    stats: { played: 0, cleared: 0, bestCombo: 0, tilesPopped: 0, rescued: 0, cared: 0, biggestClear: 0 }
  };
}

/* Anything that survives a reload has to survive a schema change too:
   a save written by an older build is merged onto a fresh one, every pet
   is filled in with the fields it may predate, and any value that could
   have been corrupted is put back inside its legal range. A save that
   cannot be read is replaced rather than allowed to crash the boot. */
const SAVE_VERSION = 2;
/* what a build calls itself when it reports anything. Bumped by hand,
   with android/app/build.gradle's versionName, so a crash from an old
   install is not read as one from the current one. */
const APP_VERSION = '1.0.0';

function migrate(d) {
  const v = d.v || 1;
  if (v < 2) {
    /* v2 gave pets a trait and the player an achievement ledger */
    /* runs before healPet, so entries here may still be junk */
    (Array.isArray(d.pets) ? d.pets : []).forEach(p => {
      if (p && typeof p === 'object' && p.trait === undefined) p.trait = null;
    });
    d.badges = d.badges || {};
  }
  /* Both of these are new in this build and neither is version-gated:
     an older save simply has not got them, and a player who already
     turned telemetry off must not have it turned back on by an
     upgrade. */
  if (typeof d.install !== 'number' || !d.install) d.install = 0;
  if (d.settings && d.settings.telemetry === undefined) d.settings.telemetry = true;
  d.v = SAVE_VERSION;
  return d;
}

/* one pet, with every field a current build expects */
function healPet(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const fresh = makePet(0, 0, 0, undefined);
  const out = Object.assign(fresh, p);
  out.breed = clamp(Math.round(+out.breed || 0), 0, BREEDS.length - 1);
  const coats = BREEDS[out.breed].coats;
  out.coat = clamp(Math.round(+out.coat || 0), 0, coats.length - 1);
  out.eye = clamp(Math.round(+out.eye || 0), 0, EYE_COLORS.length - 1);
  ['food', 'joy', 'clean', 'energy'].forEach(k => {
    const n = +out[k];
    out[k] = isFinite(n) ? clamp(n, 0, 100) : 60;
  });
  out.bond = Math.max(0, Math.round(+out.bond || 0));
  out.bondXp = Math.max(0, Math.round((+out.bondXp || 0) * 100) / 100);
  /* a recovered entry with no readable name is named after its breed
     rather than left blank */
  /* and a save from an older build, or one somebody edited by hand,
     gets the same treatment on the way in */
  out.name = cleanName(out.name) || breedName(out.breed);
  out.asleep = !!out.asleep;
  out.care = Object.assign({ feed: 0, play: 0, wash: 0, sleep: 0 }, out.care || {});
  Object.keys(out.care).forEach(k => { out.care[k] = Math.max(0, Math.round(+out.care[k] || 0)); });
  if (out.trait !== null && !TRAITS[out.trait]) out.trait = null;
  if (!HATS.some(h => h.id === out.hat)) out.hat = 'none';
  if (!COLLARS.some(c => c.id === out.collar)) out.collar = 'none';
  if (!out.id) out.id = 'p' + (now() % 1000000) + '_' + (petIdSeq++);
  return out;
}

/* ---------- the game used to be called something else ----------

   Renaming a game renames its storage keys, and a storage key is where
   the save lives. Nobody outside this machine has ever run the old build,
   so this rescues exactly one person's progress — but it costs four lines
   and the alternative is a game that opens on an empty room and cannot
   say why.

   Once only, and only into an empty slot: if there is already a save
   under the new name, the old one is the stale copy and is dropped
   rather than allowed to overwrite anything. The old keys are removed
   either way, so this does not leave a second copy of somebody's save
   sitting in the browser forever.

   Safe to delete in a version or two — but not before the first store
   release, because until then the only installs that exist are the ones
   that predate the name.

   Each module carries its own old key rather than one table carrying
   them all: the event buffer's is in 18-telemetry.js, because a table
   here naming a constant declared three files further down is how a save
   layer comes to depend on the telemetry layer. */
const OLD_SAVE_KEY = 'biscuit-lane-v1';
function adoptOldName() {
  try {
    const old = localStorage.getItem(OLD_SAVE_KEY);
    if (!old) return;
    if (!localStorage.getItem(SAVE_KEY)) localStorage.setItem(SAVE_KEY, old);
    localStorage.removeItem(OLD_SAVE_KEY);
  } catch (e) { /* private mode: there was nothing to carry over anyway */ }
}

/* Can this window keep anything? Written once at boot, because the
   answer does not change and asking costs a write. */
let storageWorks = null;
function canStore() {
  if (storageWorks !== null) return storageWorks;
  try {
    const probe = SAVE_KEY + ':probe';
    localStorage.setItem(probe, '1');
    storageWorks = localStorage.getItem(probe) === '1';
    localStorage.removeItem(probe);
  } catch (e) {
    storageWorks = false;
  }
  return storageWorks;
}

/* ============================================================
   the copy the operating system will not throw away
   ============================================================

   Everything above this keeps the save in localStorage, which is the
   right first answer: it is synchronous, it works in every browser, and
   it costs nothing. It is also, inside a native shell, the wrong last
   answer.

   A Capacitor app is a WebView, and a WebView's localStorage is website
   data as far as the operating system is concerned. iOS treats it that
   way: WKWebView's store lives under Library/WebKit and the system is
   entitled to evict it when the device is short of space. It does not
   ask, it does not warn, and the app that comes back has never been
   played. On Android it is steadier, but "clear cache" in some cleaner
   apps takes it, and an uninstall certainly does.

   For a game that has taken money, "your save is gone" is not a bug
   report, it is a refund and a one-star review that is entirely fair.

   So: localStorage stays the working copy, and a second copy goes
   somewhere the OS treats as the app's own — Preferences, which is
   NSUserDefaults on iOS and SharedPreferences on Android, both of which
   are backed up and neither of which is evicted. Nothing here is on the
   critical path. The vault is asked once at boot, written behind the
   working copy, and on the web it does not exist at all: no plugin, no
   bridge, `recover()` resolves having done nothing, and the shipped
   file still has no dependency in it. */
const VAULT = {
  plugin: null,
  last: 0,
  /* A native round trip per keystroke-frequency save is waste. The
     working copy is already written on every persist; this one only has
     to be no more than a minute behind it, and an immediate persist —
     which is what a purchase, a level ending and the app being put in a
     pocket all do — pushes it through regardless. */
  every: 60000,

  ready() {
    if (this.plugin) return true;
    const P = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins) || null;
    if (!P) return false;
    this.plugin = P.Preferences || P.Storage || null;
    return !!this.plugin;
  },

  /* Called once, before the save is read. Resolves to the vault's copy
     if it holds one, and to null in every other case — no plugin, no
     copy, unreadable copy. The caller decides what to do with it, which
     is the only reason this does not just write into SAVE itself. */
  async recover() {
    if (!this.ready()) return null;
    try {
      const r = await this.plugin.get({ key: SAVE_KEY });
      const raw = r && r.value;
      if (!raw) return null;
      const d = JSON.parse(raw);
      return d && typeof d === 'object' ? d : null;
    } catch (e) { return null; }
  },

  write(json, force) {
    if (!this.ready()) return;
    const t = now();
    if (!force && t - this.last < this.every) return;
    this.last = t;
    try { this.plugin.set({ key: SAVE_KEY, value: json }); } catch (e) { }
  },

  clear() {
    if (!this.ready()) return;
    try { this.plugin.remove({ key: SAVE_KEY }); } catch (e) { }
  }
};

/* Which of the two copies is the one to play from.

   `lastSeen` is stamped on every write, so it is the honest comparison,
   and the vault only wins when it is genuinely ahead. That matters more
   than it sounds: a player who reinstalls onto a device whose vault
   survived should get their save back, and a player whose vault is a
   fortnight stale because they have been playing the web version on the
   same phone should not have a fortnight taken off them. Equal goes to
   the working copy, which is the one the game has been writing to. */
function vaultRecover(mirror) {
  if (!mirror) return;
  let here = null;
  try { here = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { here = null; }
  const theirs = +mirror.lastSeen || 0;
  const ours = here ? (+here.lastSeen || 0) : -1;
  if (theirs <= ours) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(mirror)); } catch (e) { }
}

function loadSave() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
  if (!raw) { SAVE = freshSave(); return false; }
  try {
    const d = migrate(JSON.parse(raw));
    const base = freshSave();
    SAVE = Object.assign(base, d);
    SAVE.settings = Object.assign(freshSave().settings, d.settings || {});
    SAVE.room = Object.assign({ theme: 'oat', placed: [] }, d.room || {});
    SAVE.stats = Object.assign(freshSave().stats, d.stats || {});
    SAVE.badges = Object.assign({}, d.badges || {});
    SAVE.daily = Object.assign({ day: 0, done: false, best: 0, streak: 0 }, d.daily || {});
    SAVE.jar = Object.assign({ fill: 0, opened: 0 }, d.jar || {});
    SAVE.jar.fill = clamp(Math.round(+SAVE.jar.fill || 0), 0, JAR.cap);
    SAVE.keepsakes = Object.assign({}, d.keepsakes || {});
    SAVE.rated = Object.assign({ asked: 0, said: 0 }, d.rated || {});
    SAVE.coats = Object.assign({}, d.coats || {});
    SAVE.eyes = Object.assign({}, d.eyes || {});
    SAVE.ads = Object.assign({ day: 0, used: {} }, d.ads || {});
    SAVE.pass = Object.assign({ season: -1, stamps: 0, paid: false, claimed: {} }, d.pass || {});
    SAVE.pass.stamps = Math.max(0, Math.round(+SAVE.pass.stamps || 0));

    SAVE.pets = (Array.isArray(d.pets) ? d.pets : []).map(healPet).filter(Boolean);
    /* Whatever every animal in the house is already wearing is owned,
       whether or not it was ever paid for. A save from before the
       grooming shelf existed has six pets in six coats and an empty
       table, and the alternative is a game that opens by telling a
       player the animal they have had for a month is wearing something
       they do not own. */
    SAVE.pets.forEach(p => lookUnlock(p.breed, p.coat, p.eye));
    if (!SAVE.pets.some(p => p.id === SAVE.activePet)) {
      SAVE.activePet = SAVE.pets.length ? SAVE.pets[0].id : null;
      CAST = null;   /* the walker leads the cast, so a repaired one rebuilds it */
    }
    /* currencies and counters can only be sane numbers */
    SAVE.coins = Math.max(0, Math.round(+SAVE.coins || 0));
    SAVE.treats = Math.max(0, Math.round(+SAVE.treats || 0));
    SAVE.hearts = clamp(Math.round(+SAVE.hearts || 0), 0, HEART_MAX);
    SAVE.reached = clamp(Math.round(+SAVE.reached || 1), 1, 9999);
    if (!SAVE.stars || typeof SAVE.stars !== 'object') SAVE.stars = {};
    if (!SAVE.scores || typeof SAVE.scores !== 'object') SAVE.scores = {};
    Object.keys(SAVE.stars).forEach(k => {
      const n = clamp(Math.round(+SAVE.stars[k] || 0), 0, 3);
      if (n) SAVE.stars[k] = n; else delete SAVE.stars[k];
    });
    /* a room theme or placed item removed from the game must not linger */
    if (!ROOM_THEMES.some(t => t.id === SAVE.room.theme)) SAVE.room.theme = 'oat';
    SAVE.room.placed = (SAVE.room.placed || []).filter(id => FURNITURE.some(f => f.id === id));
    if (!isFinite(SAVE.heartAt)) SAVE.heartAt = now();
    if (!isFinite(SAVE.lastSeen)) SAVE.lastSeen = now();
    /* a wall clock that has moved backwards leaves these in the future,
       which would freeze the hearts until real time caught up */
    if (SAVE.heartAt > now()) SAVE.heartAt = now();
    if (SAVE.lastSeen > now()) SAVE.lastSeen = now();

    return SAVE.pets.length > 0;
  } catch (e) {
    SAVE = freshSave();
    return false;
  }
}

let saveTimer = null;
let SAVE_WIPED = false;          /* once the player resets, never write again */
function persist(immediate) {
  if (SAVE_WIPED) return;
  if (saveTimer) clearTimeout(saveTimer);
  const doIt = () => {
    saveTimer = null;
    SAVE.lastSeen = now();
    const json = JSON.stringify(SAVE);
    try { localStorage.setItem(SAVE_KEY, json); } catch (e) { /* private mode */ }
    /* and behind it, the copy the system will not evict. An immediate
       persist is the game saying this one matters — a purchase, a level
       ending, the app going into a pocket — so those go through the
       throttle rather than waiting behind it. */
    VAULT.write(json, !!immediate);
  };
  if (immediate) doIt(); else saveTimer = setTimeout(doIt, 400);
}
function wipeSave() {
  SAVE_WIPED = true;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
  /* Both copies, or the next boot recovers the save the player just
     asked the game to forget. */
  VAULT.clear();
}

/* ---------- hearts ---------- */
function heartTick() {
  /* the clock can move while the game is open, too */
  if (SAVE.heartAt > now()) SAVE.heartAt = now();
  if (SAVE.hearts >= HEART_MAX) { SAVE.heartAt = now(); return; }
  const elapsed = now() - SAVE.heartAt;
  if (elapsed >= HEART_REFILL) {
    const before = SAVE.hearts;
    const gained = Math.floor(elapsed / HEART_REFILL);
    SAVE.hearts = Math.min(HEART_MAX, SAVE.hearts + gained);
    SAVE.heartAt = SAVE.hearts >= HEART_MAX ? now() : SAVE.heartAt + gained * HEART_REFILL;
    persist();
    /* announced from the one place hearts go up, because plenty of
       things call this and whoever is waiting should hear about it */
    if (SAVE.hearts > before) onHeartArrived();
  }
}
/* A heart timer that stands still reads as broken. This runs only while
   one is missing, and stops itself the moment they are full. */
let heartTimer = null;
function heartClockStart() {
  if (heartTimer) return;
  heartTimer = setInterval(() => {
    if (SAVE.hearts >= HEART_MAX) { heartClockStop(); EV.emit('purse'); return; }
    heartTick();
    EV.emit('purse');
  }, 1000);
}
function heartClockStop() {
  if (heartTimer) { clearInterval(heartTimer); heartTimer = null; }
}
/* whatever wants to know; the sheet replaces this while it is open */
let onHeartArrived = () => { };

function heartsIn() {
  if (SAVE.hearts >= HEART_MAX) return 0;
  return Math.max(0, HEART_REFILL - (now() - SAVE.heartAt));
}
function spendHeart() {
  heartTick();
  if (SAVE.hearts <= 0) return false;
  heartClockStart();
  if (SAVE.hearts === HEART_MAX) SAVE.heartAt = now();
  SAVE.hearts--;
  persist();
  return true;
}

/* ---------- pets ---------- */
let petIdSeq = 1;
function makePet(breedIdx, coatIdx, eyeIdx, name) {
  const b = BREEDS[breedIdx];
  return {
    id: 'p' + (now() % 1000000) + '_' + (petIdSeq++),
    breed: breedIdx,
    coat: coatIdx || 0,
    eye: eyeIdx === undefined ? EYE_COLORS.findIndex(e => e.hex === b.eyes) : eyeIdx,
    /* Cleaned here as well as at every call site.

       All three places that make a pet already run cleanName over what
       the player typed, so nothing reaches this line dirty today. But
       the name goes into innerHTML in nineteen places — four directly
       and fifteen through T(), which substitutes into a template string
       — and a pet called "<3" is a perfectly ordinary thing to want.
       One line here is cheaper than nineteen escapes that have to be
       remembered every time somebody adds a twentieth. */
    name: cleanName(name) || b[LANG] || b.en,
    born: now(),
    food: 78, joy: 82, clean: 88, energy: 74,
    bond: 0, bondXp: 0,
    asleep: false,
    hat: 'none', collar: 'none',
    /* how they were looked after — decides their trait at bond 3 */
    care: { feed: 0, play: 0, wash: 0, sleep: 0 },
    trait: null,
    lastCare: now(),
    lastPet: 0
  };
}
/* ---------- what an animal is allowed to look like ----------

   Two tables, both keyed by the thing rather than by the pet, because a
   colour outlives the animal wearing it: pay for Russian blue once and
   every Sable in the house can wear it, the same way a gold collar
   works. The coat key carries the breed because "cream" means a
   different colour on a Marmalade than on a Retriever.

   What an animal was adopted in is always theirs. That is not a
   generosity, it is the only way this can be added to a game people are
   already playing without taking something off them. */
function coatKey(breedIdx, coatIdx) { return BREEDS[breedIdx].id + ':' + coatIdx; }
function coatOwned(breedIdx, coatIdx) {
  return !!(SAVE.coats && SAVE.coats[coatKey(breedIdx, coatIdx)]);
}
function eyeOwned(eyeIdx) {
  const e = EYE_COLORS[eyeIdx];
  return !!(e && SAVE.eyes && SAVE.eyes[e.id]);
}
function lookUnlock(breedIdx, coatIdx, eyeIdx) {
  if (!SAVE.coats) SAVE.coats = {};
  if (!SAVE.eyes) SAVE.eyes = {};
  SAVE.coats[coatKey(breedIdx, coatIdx)] = 1;
  const e = EYE_COLORS[eyeIdx];
  if (e) SAVE.eyes[e.id] = 1;
}

function activePet() {
  if (!SAVE.pets.length) return null;
  return SAVE.pets.find(p => p.id === SAVE.activePet) || SAVE.pets[0];
}
function petBreed(p) { return BREEDS[p.breed]; }
/* ---------------- the cast ----------------

   The premise of this game is that the animals on the board are the
   animals you keep. For a long time that was simply not true: every
   player saw the same six stock breeds in the same six slots, whatever
   was upstairs, forever. The pet sat on a rail beside the board handing
   out buffs, and you could have replaced it with a power-up meter
   without losing anything. Adoption was a change of portrait.

   So a level's tile types are slots now, not breeds, and the cast says
   who stands in each. Your own come first, in the order you took them
   in; the rest of the lane fills the slots behind them. A player with
   one pet plays a board with one friend and five strangers on it, and
   the board fills with their own as they go — and the face on the tile
   is their pet's face, in the coat they chose for it, not the breed's
   stock coat.

   None of this touches how many types a level has, so every difficulty
   figure measured against the old board still holds. */
let CAST = null;
let CAST_SIG = '';

function castRebuild() {
  const mine = [];
  const pets = (typeof SAVE === 'object' && SAVE && SAVE.pets) ? SAVE.pets : [];
  /* The one you are walking with leads.

     Not vanity: a level with five types only shows the first five slots,
     so with six pets the sixth stood in a slot no board ever drew. You
     could take that pet down the lane and its own face would not be on
     the board — and the charge meter, which wants the slot its breed is
     in, quietly fell back to slot 0 and told you to match somebody
     else's pet. Putting the walker first makes that impossible to
     arrange, and it means switching pets visibly changes the board. */
  const walker = pets.filter(p => p && p.id === SAVE.activePet)[0];
  if (walker) mine.push(walker.breed);
  pets.forEach(p => { if (p && mine.indexOf(p.breed) < 0) mine.push(p.breed); });
  const rest = [];
  for (let i = 0; i < BREEDS.length; i++) if (mine.indexOf(i) < 0) rest.push(i);
  CAST = mine.concat(rest);
  /* the signature is what the tile sprites are cached against: a coat
     changed in the shop has to reach the board */
  CAST_SIG = CAST.join('') + '|' + pets.map(p => p.breed + ':' + p.coat + ':' + p.eye).join(',');
  return CAST;
}
function castOf() { return CAST || castRebuild(); }
/* which breed stands in a board slot */
function castBreed(slot) {
  const c = castOf();
  const i = Math.max(0, Math.round(+slot || 0));
  return c[i % c.length];
}
/* the pet standing in it, if it is one of yours */
function castPet(slot) {
  const b = castBreed(slot);
  const pets = (typeof SAVE === 'object' && SAVE && SAVE.pets) ? SAVE.pets : [];
  for (let i = 0; i < pets.length; i++) if (pets[i].breed === b) return pets[i];
  return null;
}
/* the slot a breed is standing in — what the charge meter wants */
function castSlot(breed) {
  const c = castOf();
  const i = c.indexOf(Math.max(0, Math.round(+breed || 0)));
  return i < 0 ? 0 : i;
}
function castName(slot) { return breedName(castBreed(slot)); }
/* the board asks 10-data which breed rides a slot; this is the answer */
useCast(castBreed);
/* a pet arriving or leaving, or a coat bought, changes the board */
function castChanged() {
  const was = CAST_SIG;
  castRebuild();
  /* the art keeps a sprite per breed, so a household that changed is a
     cache that is wrong. The save does not know that, and should not. */
  if (was !== CAST_SIG) EV.emit('cast');
  return was !== CAST_SIG;
}

function petCoat(p) { const b = petBreed(p); return b.coats[p.coat] || b.coats[0]; }
function petEye(p) { return (EYE_COLORS[p.eye] || { hex: petBreed(p).eyes }).hex; }
function petStageIdx(p) {
  let s = 0;
  for (let i = 0; i < STAGES.length; i++) if (p.bond >= STAGES[i].bond) s = i;
  return s;
}
function stageName(p) {
  const st = STAGES[petStageIdx(p)];
  if (LANG === 'tr') return st.tr;
  return petBreed(p).species === 'dog' ? st.enDog : st.en;
}
function stagePhrase(p) {
  const st = STAGES[petStageIdx(p)];
  if (LANG === 'tr') return st.phTr;
  return petBreed(p).species === 'dog' ? st.phDog : st.ph;
}
/* The player's own words are the only strings in the game that end up
   in markup without having been written by us, so they are cleaned once,
   here, rather than escaped at each of the dozen places they are read. */
function cleanName(v) {
  const src = String(v == null ? '' : v);
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const c = src.charCodeAt(i);
    /* < > & " ' — written as codes because a quote inside a regex
       literal is enough to confuse anything that strips strings, and
       test/check.js is one of those things */
    if (c === 60 || c === 62 || c === 38 || c === 34 || c === 39) continue;
    out += src[i];
  }
  return out.trim().slice(0, 14);
}
function breedName(i) { const b = BREEDS[i]; return LANG === 'tr' ? b.tr : b.en; }
function breedDesc(i) { const b = BREEDS[i]; return LANG === 'tr' ? b.trDesc : b.enDesc; }
function abilityOf(p) { return ABILITIES[petBreed(p).ability]; }
function abilityName(p) { const a = abilityOf(p); return LANG === 'tr' ? a.tr : a.en; }
function abilityDesc(p) { const a = abilityOf(p); return LANG === 'tr' ? a.trDesc : a.enDesc; }
/* how far the ability reaches at a given stage, and how to say it */
function abilityStep(kind, stage) {
  const a = ABILITIES[kind];
  if (!a || !a.steps) return 0;
  return a.steps[clamp(stage, 0, a.steps.length - 1)];
}
function abilityPowerText(kind, stage) {
  const a = ABILITIES[kind];
  const n = abilityStep(kind, stage);
  if (!a || !n) return '';
  if (LANG === 'tr') return n + ' ' + a.trUnit;
  return n + ' ' + a.enUnit[n === 1 ? 0 : 1];
}
function abilityPower(p) {
  if (!p) return '';
  return abilityPowerText(petBreed(p).ability, petStageIdx(p));
}
function goodName(g) { return LANG === 'tr' ? (g.tr || g.en) : g.en; }
function goodDesc(g) { return LANG === 'tr' ? (g.trDesc || g.enDesc || '') : (g.enDesc || ''); }

/* bond levels needed: 4, 6, 8, 10 ... */
function bondNeed(level) { return 4 + level * 2; }
function addBond(p, xp) {
  if (!p) return false;
  /* Petting is worth .34 — a third of a proper care action, on purpose.
     Three of them is 1.0200000000000002 in binary floating point, and
     the home card printed that number in full: "Level 5 ·
     1.0200000000000002/14 to next". Rounded on the way in, so the error
     can never compound across a save's lifetime rather than being tidied
     up at each of the places that read it. */
  p.bondXp = Math.round((p.bondXp + xp) * 100) / 100;
  let grew = false;
  const before = petStageIdx(p);
  while (p.bondXp >= bondNeed(p.bond)) {
    p.bondXp -= bondNeed(p.bond);
    p.bond++;
  }
  if (petStageIdx(p) > before) grew = true;
  persist();
  return grew;
}

/* ---------- traits ----------
   Whichever kind of care a pet got most of becomes who they are, once
   there is enough of a bond for it to have meant something. */
function bumpCare(p, kind) {
  if (!p) return null;
  p.care = p.care || { feed: 0, play: 0, wash: 0, sleep: 0 };
  if (p.care[kind] !== undefined) p.care[kind]++;
  SAVE.stats.cared = (SAVE.stats.cared || 0) + 1;
  return settleTrait(p);
}
function settleTrait(p) {
  if (!p || p.trait || p.bond < TRAIT_AT_BOND) return null;
  const map = { feed: 'greedy', play: 'playful', wash: 'tidy', sleep: 'dozy' };
  let best = null, bestN = 0;
  Object.keys(map).forEach(k => {
    const n = (p.care && p.care[k]) || 0;
    if (n > bestN) { bestN = n; best = map[k]; }
  });
  if (!best || bestN < TRAIT_AT_CARE) return null;   /* not enough of a pattern yet */
  p.trait = best;
  persist();
  return best;
}
/* what a trait is worth on the board */
function traitOf(p) { return p && p.trait ? p.trait : null; }
function traitCoinScale(p) { return traitOf(p) === 'greedy' ? 1.15 : 1; }
function traitChargeScale(p) { return traitOf(p) === 'playful' ? 1.25 : 1; }
function traitMoveBonus(p) { return traitOf(p) === 'tidy' ? 1 : 0; }
function traitDecayScale(p) { return traitOf(p) === 'dozy' ? 0.75 : 1; }

/* ---------- the shelf ----------
   Every badge reads its own progress from the save, so unlocking is just
   a sweep. Returns whatever became true since the last sweep. */
function badgeProgress(b) {
  try { return b.at(SAVE) || 0; } catch (e) { return 0; }
}
function checkBadges() {
  const won = [];
  BADGES.forEach(b => {
    if (SAVE.badges[b.id]) return;
    if (badgeProgress(b) >= b.of) {
      SAVE.badges[b.id] = now();
      if (b.coins) SAVE.coins += b.coins;
      if (b.treats) SAVE.treats += b.treats;
      won.push(b);
    }
  });
  if (won.length) persist(true);
  return won;
}
function badgesWon() { return BADGES.filter(b => SAVE.badges[b.id]).length; }

/* ---------- pet decay ----------

   Rates are per hour and come in two sets, because an animal curled up
   asleep is not spending itself at the same rate as one pacing the rug.
   They are tuned around a once-a-day visit: a full day away should leave
   a pet hungry and dull, not annihilated. Emptying every bar in
   nineteen hours only taught players that the room could not be won. */
const DECAY = {
  awake: { food: 3.4, joy: 2.6, clean: 2.4, energy: -4.4 },
  asleep: { food: 1.2, joy: 0.9, clean: 1.0, energy: 16 }
};
const SLEEPY = 20;                 // nods off on its own below this
const MAX_OFFLINE = 30 * HOUR;
const STEP = 1;                    // hours per simulated slice

/* Stepped rather than multiplied out, for two reasons. A pet that runs
   out of energy mid-absence has to be able to fall asleep and start
   recovering — one flat multiply can never model a state change. And the
   neglect penalty below has to be charged for the hours the pet was
   actually hungry: applied to the whole gap at the end-state, as it was,
   a pet that dipped under 15 in the last minute of a day away was billed
   for the entire day. */
function simulatePet(p, ms) {
  if (!p) return;
  let h = Math.min(ms, MAX_OFFLINE) / HOUR * traitDecayScale(p);
  if (h <= 0) return;
  while (h > 0) {
    const dt = Math.min(h, STEP);
    h -= dt;
    const d = p.asleep ? DECAY.asleep : DECAY.awake;
    p.food = clamp(p.food - d.food * dt, 0, 100);
    p.clean = clamp(p.clean - d.clean * dt, 0, 100);
    p.joy = clamp(p.joy - d.joy * dt, 0, 100);
    p.energy = clamp(p.energy + d.energy * dt, 0, 100);
    /* neglect nudges joy down a little faster, for these hours only */
    if (p.food < 15) p.joy = clamp(p.joy - 2 * dt, 0, 100);
    if (p.clean < 15) p.joy = clamp(p.joy - 1.5 * dt, 0, 100);
    /* Animals sleep when they are tired, and a pet that has slept its
       fill stays curled up until somebody comes and wakes it. Both
       halves matter. Without the first, a pet left alone stands awake
       for thirty hours burning energy it has no way to recover, and
       arrives flat however well it is looked after. Without the second,
       it wakes the moment it tops up and starts spending again, so how
       rested you find it comes down to what hour you happened to open
       the app — the one stat the player could not influence at all. */
    if (!p.asleep && p.energy <= SLEEPY) p.asleep = true;
  }
}
function catchUpPets() {
  const gap = now() - (SAVE.lastSeen || now());
  if (gap < MIN) return;
  SAVE.pets.forEach(p => {
    simulatePet(p, gap);
    /* You are what wakes it. A pet that has slept its fill gets up when
       somebody comes home, which is both how animals behave and the only
       way the room stays a room: leave it to wake itself and a
       once-a-day player finds a sleeping animal every single time. One
       still short of rested stays down, which is worth seeing. */
    if (p.asleep && p.energy >= 100) p.asleep = false;
  });
  SAVE.lastSeen = now();
  persist();
}

/* ---------- mood ---------- */
function moodOf(p) {
  if (!p) return 'content';
  if (p.asleep) return 'sleeping';
  if (p.food < 26) return 'hungry';
  if (p.clean < 26) return 'dirty';
  if (p.energy < 22) return 'tired';
  if (p.joy < 26) return 'bored';
  const avg = (p.food + p.joy + p.clean + p.energy) / 4;
  if (avg > 78) return 'happy';
  if (p.joy < 45) return 'lonely';
  return 'content';
}
function moodLine(p) { return T('mood_' + moodOf(p)); }

/* ---------- perks: care feeds directly into the board ---------- */
function perksFor(p) {
  const out = [];
  if (!p) return out;
  if (p.food >= 70) out.push({ id: 'moves', en: '+2 moves', tr: '+2 hamle', v: 2 });
  if (p.joy >= 70) out.push({ id: 'charge', en: 'Starts 35% charged', tr: '%35 dolu başlar', v: 35 });
  if (p.clean >= 70) out.push({ id: 'score', en: '+12% score', tr: '+%12 puan', v: .12 });
  if (p.energy >= 70) out.push({ id: 'gift', en: 'A rocket on the board', tr: 'Tahtada bir roket', v: 1 });
  const tidy = traitMoveBonus(p);
  if (tidy) out.push({ id: 'trait', en: '+' + tidy + ' move (' + traitName(p.trait) + ')', tr: '+' + tidy + ' hamle (' + traitName(p.trait) + ')', v: tidy });
  /* the other three do just as much and used to say nothing. These are
     read out, not applied: each one is already applied where it belongs. */
  const nm = traitOf(p) ? traitName(p.trait) : '';
  if (traitOf(p) === 'greedy') {
    out.push({ id: 'traitnote', v: 0,
      en: '+' + Math.round((traitCoinScale(p) - 1) * 100) + '% coins (' + nm + ')',
      tr: '+%' + Math.round((traitCoinScale(p) - 1) * 100) + ' altın (' + nm + ')' });
  }
  if (traitOf(p) === 'playful') {
    out.push({ id: 'traitnote', v: 0,
      en: 'Charges ' + Math.round((traitChargeScale(p) - 1) * 100) + '% faster (' + nm + ')',
      tr: '%' + Math.round((traitChargeScale(p) - 1) * 100) + ' daha hızlı dolar (' + nm + ')' });
  }
  if (traitOf(p) === 'dozy') {
    out.push({ id: 'traitnote', v: 0,
      en: 'Slower to go hungry (' + nm + ')',
      tr: 'Daha geç acıkır (' + nm + ')' });
  }
  /* Tied to the stages, and capped there. Bond itself has no ceiling,
     and an uncapped move bonus quietly retunes every level in the game
     — measured, it took the clear rate from 76% to 88%. */
  const bonusMoves = STAGE_MOVES[clamp(petStageIdx(p), 0, STAGE_MOVES.length - 1)];
  if (bonusMoves > 0) {
    const label = stageName(p).toLowerCase();
    out.push({
      id: 'bondmoves',
      en: '+' + bonusMoves + (bonusMoves === 1 ? ' move' : ' moves') + ' (' + label + ')',
      tr: '+' + bonusMoves + ' hamle (' + label + ')',
      v: bonusMoves
    });
  }
  return out;
}
function perkLabel(perk) { return LANG === 'tr' ? perk.tr : perk.en; }
/* The card used to print every perk end to end, which read as a run-on
   sentence and said "+2 moves" twice — once for a full belly and once
   for the pet's stage — as though they were separate things. Move
   bonuses are one number to the player, so they are added up. */
function perkChips(perks) {
  const moveIds = { moves: 1, bondmoves: 1, trait: 1 };
  let moves = 0;
  const out = [];
  perks.forEach(p => {
    if (moveIds[p.id]) { moves += p.v; return; }
    if (p.id === 'traitnote') return;
    out.push(perkLabel(p));
  });
  if (moves) out.unshift(LANG === 'tr' ? '+' + moves + ' hamle' : '+' + moves + ' move' + (moves > 1 ? 's' : ''));
  return out;
}

/* ---------- the jar ----------
   State, so it lives with the rest of the state. The store that charges
   for any of it is 17-billing, and it knows about these; they do not
   know about it. */
function jarState() {
  if (!SAVE.jar) SAVE.jar = { fill: 0, opened: 0 };
  return SAVE.jar;
}
/* called from the win card, once per cleared level */
function jarAdd(n) {
  const j = jarState();
  if (j.fill >= JAR.cap) return false;
  const before = j.fill;
  j.fill = Math.min(JAR.cap, j.fill + (n || JAR.perLevel));
  return j.fill > before;
}
function jarFull() { return jarState().fill >= JAR.cap; }

/* What the object is made of, recorded at the moment it is bought.

   The photograph is the only one that has to be: a tag reads the name
   off the pet every time it is drawn and a blanket reads the coat, so
   those two follow the animal as it changes. A photograph that quietly
   updated itself to the animal's current stage would not be a
   photograph — the whole point is that it is of the kitten, after the
   kitten has grown up. */
function keepsakeOf(id) {
  const p = activePet();
  if (id !== 'photo' || !p) return 1;
  return { breed: p.breed, coat: p.coat, eye: p.eye, hat: p.hat,
           collar: p.collar, stage: petStageIdx(p), name: p.name, bond: p.bond };
}
/* ---------- the season book ----------

   Stamps are earned in one function so that there is one place to look
   when the rate is wrong, and the season rolls over here rather than at
   boot: a save opened after a two-month gap has to land in the season it
   is actually in, not resume the one it left. Unclaimed tiers go with
   the old season, which is what a season is. */
/* The day this player's seasons are counted from: their first.

   A save older than the change has no `created` worth trusting to the
   day — it does, but a save restored from a backup can carry a date the
   phone has since disagreed with — so it is clamped to today. A start in
   the future would put the player in season -1 and hand them a book that
   never ends. */
function seasonStart() {
  const today = dayNumber();
  return Math.min(today, dayNumber(SAVE.created || Date.now()));
}
function passState() {
  if (!SAVE.pass) SAVE.pass = { season: -1, stamps: 0, paid: false, claimed: {} };
  const now = seasonNo(seasonStart());
  if (SAVE.pass.season !== now) {
    SAVE.pass = { season: now, stamps: 0, paid: false, claimed: {} };
  }
  return SAVE.pass;
}
function passStamp(kind, n) {
  const p = passState();
  const worth = PASS.stamps[kind] || 0;
  if (!worth) return 0;
  const got = worth * (n || 1);
  p.stamps += got;
  return got;
}
/* Whether the book is worth what it costs, from where this player is
   standing today.

   The rule is the jar's rule: nothing in this game is offered for money
   when the thing next to it, for the same money, is better. The jar
   refuses to open until it holds more than a pack; the book refuses to
   be sold until the paid side would return more treats than the pack it
   sits beside. Everything else the book carries — the collars, the hats,
   the keepsake, the month of having something to come back to — is on
   top of a number that already stands on its own.

   Projected at the player's own pace rather than at the designer's,
   because the designer's pace is an average of people who are not this
   one. Before there is enough of a week to have a pace, the track's own
   design rate stands in: it is drawn to be finished in a season, and a
   player on their second day should be taken at the game's word rather
   than judged on two days of stamps. */
function passWorthBuying() {
  const p = passState();
  const left = seasonDaysLeft(seasonStart());
  const gone = SEASON_DAYS - left;
  const designed = PASS.tiers * PASS.per / SEASON_DAYS;
  const rate = gone >= 5 ? p.stamps / gone : designed;
  const projected = p.stamps + rate * left;
  const pack = TREAT_PACKS.reduce((m, x) => Math.max(m, x.treats), 0);
  return passBanked(projected) >= pack;
}

/* Whether a reward is there to be taken: the tier has been reached, it
   has not been taken already, and — for the paid column — the book has
   been bought. Buying it in the last week hands over every paid reward
   back to tier one, which is the only reason anybody buys one late. */
function passClaimable(i, paid) {
  const p = passState();
  if (i >= PASS_TRACK.length || passTier(p.stamps) <= i) return false;
  if (paid && !p.paid) return false;
  return !p.claimed[(paid ? 'p' : 'f') + i];
}
function passClaim(i, paid) {
  if (!passClaimable(i, paid)) return null;
  const p = passState();
  const r = PASS_TRACK[i][paid ? 'paid' : 'free'];
  p.claimed[(paid ? 'p' : 'f') + i] = 1;
  grantReward(r);
  persist(true);
  return r;
}
/* One reward, whatever kind it is. A cosmetic somebody already owns is
   paid as treats instead: a track that hands a player their own hat back
   is worse than one that hands them nothing, because it looks like the
   game lost count. */
function grantReward(r) {
  if (!r) return;
  if (r.coins) SAVE.coins += r.coins;
  if (r.treats) SAVE.treats += r.treats;
  if (r.food) SAVE.food[r.food] = (SAVE.food[r.food] || 0) + 1;
  if (r.boost) SAVE.boosters[r.boost] = (SAVE.boosters[r.boost] || 0) + 1;
  if (r.hat) { if (SAVE.hats[r.hat]) SAVE.treats += 4; else SAVE.hats[r.hat] = 1; }
  if (r.collar) { if (SAVE.collars[r.collar]) SAVE.treats += 4; else SAVE.collars[r.collar] = 1; }
  if (r.keepsake) {
    if (SAVE.keepsakes[r.keepsake]) SAVE.treats += 20;
    else SAVE.keepsakes[r.keepsake] = keepsakeOf(r.keepsake);
  }
}

/* ---------- granting ----------

   Kept apart from BILLING.buy so there is one function that adds treats
   to a save and it is called from one place, after a receipt.

   The season book used to be the exception: it was granted inline in the
   sheet that sold it, three lines that set a flag. Being the exception
   is how it came to be the one purchase in the game that paid out on a
   cancelled sheet — the store's `buy` returns an object and the sheet
   tested it for truthiness, so `{ ok: false, why: 'cancelled' }` read as
   a sale. The treat store next to it had always tested `r.ok` and was
   never wrong. That is the argument for one door rather than two, and
   the book comes through this one now. */
function grantPurchase(kind, id) {
  if (kind === 'pack') {
    const p = TREAT_PACKS.find(x => x.id === id);
    if (!p) return 0;
    SAVE.treats += p.treats;
    persist(true);
    return p.treats;
  }
  if (kind === 'jar') {
    const j = jarState();
    const got = j.fill;
    SAVE.treats += got;
    j.fill = 0;
    j.opened = (j.opened || 0) + 1;
    persist(true);
    return got;
  }
  if (kind === 'pass') {
    const p = passState();
    if (p.paid) return 0;              /* already theirs; a restore said so twice */
    p.paid = true;
    persist(true);
    return 1;
  }

  return 0;
}

/* ---------- a purchase that was paid for and never arrived ----------

   The app can be killed between the store saying yes and the save being
   written — a low-memory kill, a battery that ran out, a player who
   swiped the app away while the sheet was closing. The money is gone and
   the treats never came, and the player has no way to tell that story to
   anybody.

   The store still knows. Consumables sit in its queue until the app
   claims them, so the fix is to ask on every launch and grant whatever
   is outstanding. Nothing here can double-pay: a pack that has been
   granted was consumed in the same breath and is no longer in the queue,
   and the book checks `paid` before it sets it.

   This is also the whole of what the "restore a purchase" button does,
   which is why the button and the boot call the same function. */
function claimOutstanding(skus) {
  let n = 0;
  (skus || []).forEach(sku => {
    const pack = TREAT_PACKS.find(p => p.sku === sku);
    if (pack) { n += grantPurchase('pack', pack.id) ? 1 : 0; return; }
    if (sku === JAR.sku) { n += grantPurchase('jar', 'jar') ? 1 : 0; return; }
    if (sku === PASS.sku) { n += grantPurchase('pass', 'pass') ? 1 : 0; }
  });
  return n;
}

/* ---------- the daily walk ---------- */
function dailyState() {
  const today = dayNumber();
  if (SAVE.daily.day !== today) {
    /* a new day: yesterday's result is kept only as a streak */
    const wasYesterday = SAVE.daily.day === today - 1 && SAVE.daily.done;
    SAVE.daily = { day: today, done: false, best: 0, streak: wasYesterday ? SAVE.daily.streak : 0 };
    persist();
  }
  return SAVE.daily;
}
function dailyDone(score) {
  const d = dailyState();
  d.best = Math.max(d.best || 0, score);
  if (!d.done) {
    d.done = true;
    d.streak = (d.streak || 0) + 1;
    /* The walk paid 120 coins and 2 treats a day, forever, for four
       minutes of play. Over a month that alone is 3,600 coins and 60
       treats — most of a treat balance that nothing was asking for.
       It is still the best-paid four minutes in the game; it is no
       longer a salary. */
    SAVE.coins += ECON.dailyWalkCoins;
    SAVE.treats += ECON.dailyWalkTreats;
    persist(true);
    return { coins: ECON.dailyWalkCoins, treats: ECON.dailyWalkTreats, first: true };
  }
  persist(true);
  return { first: false };
}

/* ---------- daily gift ---------- */
function dayStamp(t) { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function giftReady() { return dayStamp(now()) !== dayStamp(SAVE.lastGift || 0); }
/* The ladder, in one place. It used to live inside claimGift, which
   meant the sheet could only report what today held — and the day-7
   basket, five treats and a booster, was a week's worth of reason that
   nothing anywhere mentioned. The interface reads this table now, so
   what is promised and what is paid cannot drift apart. */
function giftFor(day) {
  const r = { coins: 40 + day * 18, treats: ECON.giftTreats[day] || 0, food: null, booster: null };
  if (day === 2 || day === 5) r.food = 'tuna';
  if (day === 4) r.food = 'stew';
  if (day === 3) r.booster = 'hammer';
  if (day === 6) r.booster = 'shuffle';
  if (day === 7) r.booster = 'moves';
  return r;
}
/* which rung the basket on the step is standing on, without taking it */
function giftDay() {
  const yesterday = dayStamp(now() - DAY);
  const last = dayStamp(SAVE.lastGift || 0);
  return (((last === yesterday ? SAVE.streak + 1 : 1) - 1) % 7) + 1;
}
/* and which one tomorrow's would be, which is the number a player who
   has already opened today's needs in order to come back */
function giftDayNext() { return (SAVE.streak % 7) + 1; }
function claimGift() {
  const day = giftDay();
  const yesterday = dayStamp(now() - DAY);
  const last = dayStamp(SAVE.lastGift || 0);
  SAVE.streak = (last === yesterday) ? SAVE.streak + 1 : 1;
  SAVE.lastGift = now();
  const reward = giftFor(day);
  SAVE.coins += reward.coins;
  SAVE.treats += reward.treats;
  if (reward.food) SAVE.food[reward.food] = (SAVE.food[reward.food] || 0) + 1;
  if (reward.booster) SAVE.boosters[reward.booster] = (SAVE.boosters[reward.booster] || 0) + 1;
  persist(true);
  return { reward, day };
}
