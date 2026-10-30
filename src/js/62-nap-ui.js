/* ============================================================
   62 — nap time: the screen, the cushions, the sleepers
   ============================================================

   The puzzle is 32-nap.js; this is everything a person touches. It is a
   screen of its own rather than a sheet, because it is a game of its
   own: the top bar and the tabs go, the way they go for a level, and
   the back button comes home with the board kept exactly as it was.

   Three things decide whether a logic puzzle feels good in the hand, and
   each is a choice made here on purpose:

     - a tap is never ambiguous. Once rules a spot out, twice lays a pet
       down, a third time clears it. Dragging across empty spots rules
       them all out, because crossing out a row one tap at a time is the
       chore that makes people put these games down.
     - the board says what it knows. A pet's shadow — its row, column,
       cushion and the eight spots round it — is dimmed as soon as it
       lies down, so the player is never asked to do bookkeeping the
       phone could do.
     - a mistake looks like the rule. Two pets that break it wake each
       other up: their eyes open and their cushions go red. Nothing is
       scored against the player for it; it is a nap, not an exam. */

/* ---------- the save ---------- */
function napSave() {
  if (!SAVE.nap) SAVE.nap = { no: 1, solved: 0, seen: false, best: {}, day: { day: 0, done: false, time: 0, clean: false, streak: 0 }, cur: null };
  return SAVE.nap;
}
/* today's entry, rolling over the way the daily walk does: yesterday
   done keeps the streak, a day missed ends it */
function napDayState() {
  const s = napSave();
  const today = dayNumber();
  if (s.day.day !== today) {
    const kept = s.day.day === today - 1 && s.day.done;
    s.day = { day: today, done: false, time: 0, clean: false, streak: kept ? s.day.streak : 0 };
  }
  return s.day;
}

/* ---------- making boards without freezing the screen ----------

   A nine-by-nine takes up to two seconds on a desk and a phone is three
   to five times slower, so boards are made in a worker built from the
   puzzle's own functions, and kept: the one in play is in the save, the
   next one is made while the player is on this one. Where there is no
   Worker (the Node tests, an old WebView) it is made in place. */
const NAP_FNS = () => [mulberry, napPlace, napRegions, napCount, napOther, napWhole, napMend,
  napUnits, napShadow, napStep, napReason, napMake, napShape, napLevel, napDaily];
const NAP = {
  worker: null, jobs: {}, cache: {}, seq: 0,
  pack(b) { return { n: b.n, reg: Array.from(b.reg), sol: Array.from(b.sol), level: b.level, no: b.no, day: b.day }; },
  unpack(o) { return o && { n: o.n, reg: Int8Array.from(o.reg), sol: Int8Array.from(o.sol), level: o.level, no: o.no, day: o.day }; },
  build(key) {
    const [k, v] = key.split(':');
    return k === 'd' ? napDaily(+v) : napLevel(+v);
  },
  boot() {
    if (this.worker !== null) return this.worker;
    this.worker = false;
    try {
      if (typeof Worker === 'undefined' || typeof Blob === 'undefined') return false;
      const src = NAP_FNS().map(f => f.toString()).join('\n') +
        '\nonmessage = e => { const [k, v] = e.data.key.split(":"); const b = k === "d" ? napDaily(+v) : napLevel(+v);' +
        ' postMessage({ id: e.data.id, b: { n: b.n, reg: Array.from(b.reg), sol: Array.from(b.sol), level: b.level, no: b.no, day: b.day } }); };';
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      const w = new Worker(url);
      w.onmessage = e => {
        const job = this.jobs[e.data.id];
        if (!job) return;
        delete this.jobs[e.data.id];
        const b = this.unpack(e.data.b);
        this.cache[job.key] = b;
        job.res(b);
      };
      w.onerror = () => {
        /* a worker that cannot run is a worker that is not there */
        this.worker = false;
        Object.keys(this.jobs).forEach(id => { const j = this.jobs[id]; delete this.jobs[id]; j.res(this.local(j.key)); });
      };
      this.worker = w;
    } catch (e) { this.worker = false; }
    return this.worker;
  },
  local(key) { const b = this.build(key); this.cache[key] = b; return b; },
  get(key) {
    if (this.cache[key]) return Promise.resolve(this.cache[key]);
    const w = this.boot();
    if (!w) return new Promise(res => setTimeout(() => res(this.local(key)), 20));
    const pend = Object.values(this.jobs).find(j => j.key === key);
    if (pend) return pend.p;
    const id = ++this.seq;
    let res;
    const p = new Promise(r => { res = r; });
    this.jobs[id] = { key, res, p };
    w.postMessage({ id, key });
    return p;
  },
  /* the next ones, made while nothing is waiting on them */
  warm() {
    const s = napSave();
    this.get('l:' + s.no);
    this.get('d:' + dayNumber());
  }
};

/* ---------- the play state ---------- */
const NS = {
  key: null, b: null, st: null, t: 0, hints: 0, undo: [], done: false,
  runFrom: 0,                 // when the clock last started, 0 if stopped
  pop: {},                    // cell -> time it changed, for the settle animation
  glow: null,                 // { cells, until, kind } — a hint being shown
  drag: null, raf: null, last: 0, cvs: 0, ox: 0, oy: 0, layer: null, sprites: {}, specs: null,
  clashes: new Set(), shadow: new Set(), zs: []
};

function napKeyLabel(key) {
  const [k, v] = key.split(':');
  return k === 'd' ? T('nap_daily') : T('nap_level', { n: v });
}
function napElapsed() { return NS.t + (NS.runFrom ? now() - NS.runFrom : 0); }
function napClockText(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function napKeep() {
  if (!NS.b || NS.done) return;
  napSave().cur = { key: NS.key, st: Array.from(NS.st).join(''), t: napElapsed(), hints: NS.hints };
  persist();
}
function napPause() {
  if (NS.runFrom) { NS.t += now() - NS.runFrom; NS.runFrom = 0; }
  napKeep();
}

/* Open a board: the daily ('d:<day>') or a rung of the ladder
   ('l:<n>'). The screen comes up at once with the cushions still being
   made; the board lands when it is ready. */
function openNap(key) {
  const s = napSave();
  if (!s.seen) { napHowTo(() => openNap(key)); return; }
  audioResume();
  NS.key = key; NS.b = null; NS.done = false; NS.undo = []; NS.glow = null; NS.pop = {};
  NS.layer = null; NS.specs = null; NS.zs = [];
  setScreen('nap');
  napHeader();
  $('#napLoading').classList.add('on');
  track('nap_open', { key: key.split(':')[0], n: key.split(':')[1] });
  NAP.get(key).then(b => {
    if (NS.key !== key) return;
    NS.b = b;
    const cur = s.cur && s.cur.key === key ? s.cur : null;
    NS.st = new Int8Array(b.n * b.n);
    if (cur && cur.st && cur.st.length === b.n * b.n) for (let i = 0; i < cur.st.length; i++) NS.st[i] = +cur.st[i];
    NS.t = cur ? cur.t || 0 : 0;
    NS.hints = cur ? cur.hints || 0 : 0;
    NS.runFrom = 0;
    $('#napLoading').classList.remove('on');
    napRefresh();
    napLayout();
    napHeader();
    /* the next rung, so pressing "next" never waits */
    if (key[0] === 'l') NAP.get('l:' + (+key.split(':')[1] + 1));
  });
}

function napHeader() {
  if (!NS.key) return;
  $('#napTitle').textContent = napKeyLabel(NS.key);
  $('#napSub').textContent = NS.b ? T('nap_size', { n: NS.b.n }) + (NS.b.level >= 4 ? ' · ' + T('nap_tricky') : '') : '';
  $('#napClock').textContent = napClockText(napElapsed());
  const hb = $('#napHint');
  if (hb) hb.querySelector('span').textContent = NS.hints ? T('nap_hint_n', { n: NS.hints }) : T('nap_hint');
}

/* ---------- what the board knows ---------- */
function napRefresh() {
  const b = NS.b, n = b.n;
  NS.clashes = napClashes(b, NS.st);
  NS.shadow = new Set();
  for (let i = 0; i < n * n; i++) if (NS.st[i] === 2) napShadow(n, b.reg, i).forEach(j => NS.shadow.add(j));
  /* the undo button means something only when there is something to undo */
  const ub = $('#napUndo'); if (ub) ub.disabled = !NS.undo.length || NS.done;
  const cb = $('#napClear'); if (cb) cb.disabled = NS.done || !NS.st.some(v => v);
}
function napSet(i, v, record) {
  if (NS.st[i] === v) return false;
  if (record) NS.undo.push(NS.st.slice());
  if (NS.undo.length > 300) NS.undo.shift();
  NS.st[i] = v;
  NS.pop[i] = performance.now();
  return true;
}
function napAfterChange(placed) {
  if (!NS.runFrom && !NS.done) NS.runFrom = now();
  const before = NS.clashes.size;
  napRefresh();
  if (placed !== undefined) {
    if (NS.clashes.has(placed)) { SFX.bad(); buzz(HAP.no); }
    else { SFX.select(); buzz(HAP.tap); }
  }
  if (NS.clashes.size && NS.clashes.size > before) {
    const live = $('#live'); if (live) live.textContent = T('nap_clash');
  }
  if (napSolved(NS.b, NS.st)) napWin();
  else napKeep();
}

/* ---------- the cushions ----------

   Nine colours for nine cushions, picked to stay apart from each other
   in both themes and under the three common colour-blindnesses well
   enough that the thick seam between cushions carries the rest. */
const NAP_CUSHIONS = ['#F2C39A', '#BFDDB0', '#B9D3EC', '#E9BFD6', '#F2DE94', '#CFC3EC', '#A9DCCB', '#F0B2A2', '#D8CBB2'];
const NAP_EMOJI = ['🟧', '🟩', '🟦', '🟪', '🟨', '🟫', '🟥', '⬜', '⬛'];
function napCushion(k) {
  const c = NAP_CUSHIONS[k % NAP_CUSHIONS.length];
  return PAL.dark ? mix(c, PAL.bg, .32) : c;
}
/* who sleeps on which cushion: the player's own pets first, wearing the
   coats they were given, then the breeds they have not adopted yet */
function napSpecs(n) {
  const out = [];
  const pets = (SAVE.pets || []).slice();
  const act = activePet();
  if (act) { pets.splice(pets.indexOf(act), 1); pets.unshift(act); }
  pets.forEach(p => { if (out.length < n) out.push(specOfPet(p)); });
  /* then every breed the house does not already have, so two cushions
     never hold the same stranger while a breed sits unused */
  const have = new Set(pets.map(p => p.breed));
  const rest = BREEDS.map((b, i) => i).filter(i => !have.has(i));
  const all = BREEDS.map((b, i) => i);
  for (let k = 0; out.length < n; k++) {
    const pool = k < rest.length ? rest : all;
    out.push(specOf(pool[(k + (NS.b ? NS.b.n : 0)) % pool.length]));
  }
  return out;
}
function napSprite(spec, size, awake) {
  const key = (NS.b ? NS.b.n : 0) + ':' + spec.breed.id + ':' + spec.fur + ':' + spec.eyes + ':' + (spec.hat || '') + ':' + size + ':' + (awake ? 1 : 0);
  if (NS.sprites[key]) return NS.sprites[key];
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.ceil(size * dpr);
  const c = cv.getContext('2d');
  c.scale(dpr, dpr);
  c.translate(size / 2, size * .5);
  /* as big as the square allows: on a nine-by-nine a phone gives each
     sleeper about forty pixels, and a face drawn small reads as a dot */
  drawFace(c, spec, size * (NS.b && NS.b.n >= 7 ? .58 : .5), { blink: awake ? 0 : 1, tongue: false, mood: awake ? 'content' : 'sleeping' });
  NS.sprites[key] = cv;
  return cv;
}

function napLayout() {
  const wrap = $('#napWrap');
  if (!wrap || !NS.b) return;
  const w = wrap.clientWidth - 18, h = wrap.clientHeight - 12;
  const side = Math.max(160, Math.floor(Math.min(w, h, 560)));
  const cv = $('#napBoard');
  NS.ctx = fitCanvas(cv, side, side);
  NS.cvs = side;
  NS.layer = null;
  NS.sprites = {};
  napDraw();
}

/* The cushions and their seams, painted once per layout into a layer
   and stamped every frame. */
function napPaintLayer() {
  const b = NS.b, n = b.n, S = NS.cvs;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const L = document.createElement('canvas');
  L.width = L.height = Math.ceil(S * dpr);
  const c = L.getContext('2d');
  c.scale(dpr, dpr);
  const pad = Math.round(S * .035), cell = (S - pad * 2) / n;
  NS.pad = pad; NS.cell = cell;
  /* the blanket under everything */
  c.fillStyle = PAL.dark ? mix(PAL.surface, '#000000', .25) : mix(PAL.surface3, PAL.text, .06);
  rr(c, 0, 0, S, S, S * .05); c.fill();
  c.save();
  rr(c, pad, pad, S - pad * 2, S - pad * 2, S * .03); c.clip();
  for (let i = 0; i < n * n; i++) {
    const r = (i / n) | 0, col = i % n;
    const x = pad + col * cell, y = pad + r * cell;
    const base = napCushion(b.reg[i]);
    /* a little light on the top-left of every square: stuffing */
    const g = c.createLinearGradient(x, y, x + cell, y + cell);
    g.addColorStop(0, mix(base, '#FFFFFF', PAL.dark ? .06 : .22));
    g.addColorStop(1, mix(base, '#000000', PAL.dark ? .08 : .05));
    c.fillStyle = g;
    c.fillRect(x, y, cell + .5, cell + .5);
  }
  /* the soft seams inside a cushion */
  c.strokeStyle = rgba(PAL.text, PAL.dark ? .10 : .08);
  c.lineWidth = 1;
  for (let i = 0; i < n * n; i++) {
    const r = (i / n) | 0, col = i % n;
    const x = pad + col * cell, y = pad + r * cell;
    if (col < n - 1 && b.reg[i] === b.reg[i + 1]) { c.beginPath(); c.moveTo(x + cell, y + 3); c.lineTo(x + cell, y + cell - 3); c.stroke(); }
    if (r < n - 1 && b.reg[i] === b.reg[i + n]) { c.beginPath(); c.moveTo(x + 3, y + cell); c.lineTo(x + cell - 3, y + cell); c.stroke(); }
  }
  /* stitching just inside every cushion's edge */
  const inset = Math.max(3, cell * .1);
  c.strokeStyle = rgba('#FFFFFF', PAL.dark ? .22 : .7);
  c.lineWidth = Math.max(1, cell * .028);
  c.setLineDash([cell * .07, cell * .06]);
  for (let i = 0; i < n * n; i++) {
    const r = (i / n) | 0, col = i % n;
    const x = pad + col * cell, y = pad + r * cell, k = b.reg[i];
    const edge = (dr, dc) => { const rr2 = r + dr, cc = col + dc; return rr2 < 0 || cc < 0 || rr2 >= n || cc >= n || b.reg[rr2 * n + cc] !== k; };
    c.beginPath();
    if (edge(-1, 0)) { c.moveTo(x, y + inset); c.lineTo(x + cell, y + inset); }
    if (edge(1, 0)) { c.moveTo(x, y + cell - inset); c.lineTo(x + cell, y + cell - inset); }
    if (edge(0, -1)) { c.moveTo(x + inset, y); c.lineTo(x + inset, y + cell); }
    if (edge(0, 1)) { c.moveTo(x + cell - inset, y); c.lineTo(x + cell - inset, y + cell); }
    c.stroke();
  }
  c.setLineDash([]);
  /* the seams between cushions: the thing the eye reads first */
  c.strokeStyle = PAL.dark ? rgba('#000000', .7) : rgba(PAL.text, .78);
  c.lineWidth = Math.max(2.2, cell * .075);
  c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i < n * n; i++) {
    const r = (i / n) | 0, col = i % n;
    const x = pad + col * cell, y = pad + r * cell;
    if (col < n - 1 && b.reg[i] !== b.reg[i + 1]) { c.moveTo(x + cell, y); c.lineTo(x + cell, y + cell); }
    if (r < n - 1 && b.reg[i] !== b.reg[i + n]) { c.moveTo(x, y + cell); c.lineTo(x + cell, y + cell); }
  }
  c.stroke();
  c.restore();
  c.strokeStyle = PAL.dark ? rgba('#000000', .7) : rgba(PAL.text, .78);
  c.lineWidth = Math.max(2.6, cell * .085);
  rr(c, pad, pad, S - pad * 2, S - pad * 2, S * .03); c.stroke();
  NS.layer = L;
}

function napDraw() {
  const c = NS.ctx, b = NS.b;
  if (!c || !b) return;
  if (!NS.layer) napPaintLayer();
  const S = NS.cvs, n = b.n, pad = NS.pad, cell = NS.cell;
  const t = performance.now();
  c.clearRect(0, 0, S, S);
  c.drawImage(NS.layer, 0, 0, S, S);
  if (!NS.specs) NS.specs = napSpecs(n);
  const ink = PAL.text;
  for (let i = 0; i < n * n; i++) {
    const r = (i / n) | 0, col = i % n;
    const x = pad + col * cell, y = pad + r * cell, cx = x + cell / 2, cy = y + cell / 2;
    const v = NS.st[i];
    const age = NS.pop[i] ? (t - NS.pop[i]) / 220 : 1;
    const k = age < 1 ? 1 + Math.sin(age * Math.PI) * .22 * (1 - age) - (1 - age) * .25 : 1;
    if (v === 0 && NS.shadow.has(i)) {
      /* a pet's shadow: somebody would wake up here */
      c.fillStyle = rgba(ink, PAL.dark ? .28 : .2);
      c.beginPath(); c.arc(cx, cy, cell * .055, 0, Math.PI * 2); c.fill();
    } else if (v === 1) {
      c.save(); c.translate(cx, cy); c.scale(k, k);
      c.strokeStyle = rgba(ink, PAL.dark ? .62 : .5);
      c.lineWidth = Math.max(1.6, cell * .06); c.lineCap = 'round';
      const a = cell * .13;
      c.beginPath(); c.moveTo(-a, -a); c.lineTo(a, a); c.moveTo(a, -a); c.lineTo(-a, a); c.stroke();
      c.restore();
    } else if (v === 2) {
      const bad = NS.clashes.has(i);
      if (bad) {
        const p = .5 + .5 * Math.sin(t / 160);
        c.fillStyle = rgba(PAL.rose, .22 + p * .18);
        rr(c, x + 2, y + 2, cell - 4, cell - 4, cell * .2); c.fill();
      }
      const spec = NS.specs[b.reg[i] % NS.specs.length];
      const size = Math.round(cell * .98);
      const spr = napSprite(spec, size, bad);
      /* breathing, slowly, out of step with the neighbours */
      const breath = bad ? 0 : Math.sin(t / 900 + i) * .025;
      c.save();
      c.translate(cx, cy + cell * .02);
      c.scale(k * (1 + breath), k * (1 - breath));
      c.drawImage(spr, -size / 2, -size * .56, size, size);
      /* tucked in: a fold of the cushion over the chin */
      if (!bad) {
        c.fillStyle = mix(napCushion(b.reg[i]), '#FFFFFF', PAL.dark ? .04 : .25);
        c.strokeStyle = rgba(ink, .35); c.lineWidth = Math.max(1, cell * .025);
        c.beginPath();
        c.moveTo(-cell * .4, cell * .27);
        c.quadraticCurveTo(0, cell * .15, cell * .4, cell * .27);
        c.lineTo(cell * .4, cell * .43); c.lineTo(-cell * .4, cell * .43); c.closePath();
        c.fill(); c.stroke();
      } else {
        c.fillStyle = PAL.rose;
        c.font = `800 ${Math.round(cell * .3)}px Grandstander, sans-serif`;
        c.textAlign = 'center';
        c.fillText('!', cell * .32, -cell * .2);
      }
      c.restore();
    }
  }
  /* a hint being pointed at */
  if (NS.glow && t < NS.glow.until) {
    const p = .5 + .5 * Math.sin(t / 140);
    c.strokeStyle = NS.glow.kind === 'wrong' ? PAL.rose : PAL.accent;
    c.lineWidth = Math.max(2.5, cell * .08);
    NS.glow.cells.forEach(i => {
      const r = (i / n) | 0, col = i % n;
      const g = cell * (.08 + p * .05);
      rr(c, pad + col * cell + g, pad + r * cell + g, cell - g * 2, cell - g * 2, cell * .2); c.stroke();
    });
  } else NS.glow = null;
  /* the z's, rising from whoever is asleep — all of them, once it is solved */
  const dt = Math.min(.05, (t - (NS.last || t)) / 1000);
  NS.last = t;
  if (NS.done || Math.random() < dt * .7) {
    const sleepers = [];
    for (let i = 0; i < n * n; i++) if (NS.st[i] === 2 && !NS.clashes.has(i)) sleepers.push(i);
    if (sleepers.length && (!NS.done || Math.random() < dt * 4)) {
      const i = sleepers[Math.floor(Math.random() * sleepers.length)];
      NS.zs.push({ x: pad + (i % n) * cell + cell * .72, y: pad + ((i / n) | 0) * cell + cell * .22, a: 0 });
    }
  }
  c.fillStyle = PAL.dark ? rgba('#FFFFFF', .8) : rgba(PAL.text, .7);
  c.textAlign = 'center';
  NS.zs = NS.zs.filter(z => {
    z.a += dt / 1.8;
    if (z.a >= 1) return false;
    c.globalAlpha = Math.sin(z.a * Math.PI);
    c.font = `800 ${Math.round(cell * (.16 + z.a * .1))}px Grandstander, sans-serif`;
    c.fillText('z', z.x + Math.sin(z.a * 6) * cell * .06, z.y - z.a * cell * .45);
    c.globalAlpha = 1;
    return true;
  });
}
function napLoop() {
  NS.raf = requestAnimationFrame(napLoop);
  if (document.hidden || SCREEN !== 'nap') return;
  napDraw();
  /* the clock on the screen, once a second is plenty */
  const s = Math.floor(napElapsed() / 1000);
  if (s !== NS.shownS) { NS.shownS = s; const el = $('#napClock'); if (el) el.textContent = napClockText(napElapsed()); }
}
function napLoopStart() { if (!NS.raf) { NS.last = 0; NS.raf = requestAnimationFrame(napLoop); } }
function napLoopStop() { if (NS.raf) { cancelAnimationFrame(NS.raf); NS.raf = null; } }

/* ---------- touch ---------- */
function napCellAt(e) {
  const cv = $('#napBoard'), r = cv.getBoundingClientRect();
  const x = e.clientX - r.left - NS.pad, y = e.clientY - r.top - NS.pad;
  const n = NS.b.n;
  const col = Math.floor(x / NS.cell), row = Math.floor(y / NS.cell);
  if (col < 0 || row < 0 || col >= n || row >= n) return -1;
  return row * n + col;
}
function napBindInput() {
  const cv = $('#napBoard');
  cv.addEventListener('pointerdown', e => {
    if (!NS.b || NS.done) return;
    markGesture();
    const i = napCellAt(e);
    if (i < 0) return;
    try { cv.setPointerCapture(e.pointerId); } catch (er) { }
    NS.drag = { start: i, moved: false, painted: false, snap: NS.st.slice() };
  });
  cv.addEventListener('pointermove', e => {
    const d = NS.drag;
    if (!d || !NS.b) return;
    const i = napCellAt(e);
    if (i < 0 || (i === d.start && !d.moved)) return;
    if (!d.moved) {
      d.moved = true;
      /* a drag only ever crosses out, and only empty spots: dragging
         over a pet must never move or remove it */
      if (NS.st[d.start] === 0) { napSet(d.start, 1); d.painted = true; }
    }
    if (NS.st[i] === 0) { napSet(i, 1); d.painted = true; SFX.tap(); }
  });
  const up = e => {
    const d = NS.drag;
    NS.drag = null;
    if (!d || !NS.b || NS.done) return;
    if (d.moved) {
      /* the spot the finger lifted on: a fast swipe can end there
         without a move event ever having landed in it */
      const last = e && e.clientX !== undefined ? napCellAt(e) : -1;
      if (last >= 0 && NS.st[last] === 0) { napSet(last, 1); d.painted = true; }
      if (d.painted) { NS.undo.push(d.snap); napAfterChange(); }
      return;
    }
    const i = d.start;
    const next = (NS.st[i] + 1) % 3;
    napSet(i, next, true);
    napAfterChange(next === 2 ? i : undefined);
    if (next === 1) SFX.tap();
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', () => { NS.drag = null; });

  $('#napBack').addEventListener('click', () => { SFX.tap(); setScreen('home'); });
  $('#napUndo').addEventListener('click', () => {
    if (!NS.undo.length || NS.done) return;
    NS.st = NS.undo.pop();
    SFX.tap();
    napAfterChange();
  });
  $('#napClear').addEventListener('click', () => {
    if (NS.done || !NS.st.some(v => v)) return;
    NS.undo.push(NS.st.slice());
    NS.st.fill(0);
    SFX.swish(false);
    napAfterChange();
  });
  $('#napHint').addEventListener('click', napHintPress);
}

/* ---------- the hint ----------

   It shows rather than tells: the spot glows for a moment and then the
   pet is laid down, or the spots are crossed out, so the player sees
   the reasoning land. A wrong pet is pointed at, not removed — taking
   it away would be making the player's move for them. */
function napHintPress() {
  if (!NS.b || NS.done) return;
  const h = napHint(NS.b, NS.st);
  if (!h) { toast(T('nap_hint_none'), 'info'); return; }
  NS.hints++;
  track('nap_hint', { key: NS.key.split(':')[0], kind: h.kind, rule: h.rule || 0 });
  NS.glow = { cells: h.cells, until: performance.now() + (h.kind === 'wrong' ? 2200 : 1100), kind: h.kind };
  napHeader();
  if (h.kind === 'wrong') { SFX.bad(); toast(T('nap_wrong'), 'info'); napKeep(); return; }
  SFX.select();
  const why = h.rule === 1 ? T('nap_why1') : h.rule === 2 ? T('nap_why2') : h.rule === 3 ? T('nap_why3') : T('nap_why4');
  toast(why, 'info', 3200);
  const snap = NS.st.slice();
  setTimeout(() => {
    if (!NS.b || NS.done) return;
    NS.undo.push(snap);
    h.cells.forEach(i => napSet(i, h.kind === 'pet' ? 2 : 1));
    napAfterChange(h.kind === 'pet' ? h.cells[0] : undefined);
  }, 900);
}

/* ---------- solved ---------- */
function napWin() {
  if (NS.done) return;
  NS.done = true;
  if (NS.runFrom) { NS.t += now() - NS.runFrom; NS.runFrom = 0; }
  const ms = NS.t, clean = NS.hints === 0;
  const s = napSave();
  s.cur = null;
  s.solved = (s.solved || 0) + 1;
  const [k, v] = NS.key.split(':');
  let coins = 0, treats = 0, first = false, streak = 0;
  if (k === 'd') {
    const d = napDayState();
    if (!d.done) {
      first = true;
      d.done = true; d.time = ms; d.clean = clean;
      d.streak = (d.streak || 0) + 1;
      coins = tunePay('nap', NAP_PAY.daily);
      if (d.streak % 7 === 0) treats = tunePay('nap', NAP_PAY.week);
      const pet = activePet();
      if (pet) addBond(pet, NAP_PAY.bond);
    }
    streak = d.streak;
  } else {
    const no = +v;
    first = !s.best[no];
    if (!s.best[no] || ms < s.best[no]) s.best[no] = ms;
    if (first) {
      coins = tunePay('nap', NAP_PAY.rung);
      if (no % 10 === 0) treats = 1;
    }
    if (no >= s.no) s.no = no + 1;
  }
  SAVE.coins += coins;
  SAVE.treats += treats;
  persist(true);
  syncPurse();
  track('nap_win', { key: k, n: v, ms: Math.round(ms / 1000), hints: NS.hints, size: NS.b.n, level: NS.b.level });
  napRefresh();
  SFX.snore();
  setTimeout(() => SFX.win(), 380);
  buzz(HAP.win);
  /* the house goes quiet, then the card */
  setTimeout(() => napWinCard({ k, v, ms, clean, coins, treats, first, streak }), 1300);
  NAP.warm();
}
/* small on purpose: this sits beside the levels, it does not replace
   them, and test/economy.js balances coins against what the lane pays.
   Paid through tunePay('nap', …), so the live file can move all three
   together, by half to double — see 14-tune.js */
const NAP_PAY = { daily: 30, rung: 8, week: 2, bond: 2 };

function napWinCard(w) {
  const pets = (NS.specs || []).slice(0, 3);
  const m = modal(`
    <canvas class="napWinArt" width="240" height="96" aria-hidden="true"></canvas>
    <h2>${T('nap_win_t')}</h2>
    <p style="color:var(--text-dim)">${napKeyLabel(NS.key)} · ${T('nap_size', { n: NS.b.n })}</p>
    <div class="napWinStats">
      <span class="pill info">${IC.moon}${napClockText(w.ms)}</span>
      ${w.clean ? `<span class="pill ok">${IC.sparkle}${T('nap_clean')}</span>` : `<span class="pill info">${T('nap_hint_n', { n: NS.hints })}</span>`}
      ${w.streak > 1 ? `<span class="pill warn">${IC.flame}${T('nap_streak', { n: w.streak })}</span>` : ''}
    </div>
    ${w.coins || w.treats ? `<div class="napWinStats">
      ${w.coins ? `<span class="reward" style="color:var(--accent-strong)">${IC.coin}+${w.coins}</span>` : ''}
      ${w.treats ? `<span class="reward" style="color:var(--plum)">${IC.treat}+${w.treats}</span>` : ''}
    </div>` : ''}
    ${w.k === 'd' ? `<button class="btn wide" id="nwShare">${T('nap_share')}</button>` : ''}
    <div class="row">
      <button class="btn ghost" id="nwHome">${T('nap_home')}</button>
      <button class="btn primary" id="nwNext">${w.k === 'd' ? T('nap_ladder', { n: napSave().no }) : T('nap_next')}</button>
    </div>
  `, { dismissable: false });
  /* three of tonight's sleepers on the card */
  const cv = $('.napWinArt', m.el);
  if (cv) {
    const c = fitCanvas(cv, 240, 96);
    pets.forEach((sp, i) => {
      c.save(); c.translate(56 + i * 64, 54);
      drawFace(c, sp, 26, { blink: 1, tongue: false });
      c.restore();
    });
    c.fillStyle = PAL.textDim; c.font = '800 16px Grandstander, sans-serif';
    c.fillText('z', 206, 30); c.font = '800 12px Grandstander, sans-serif'; c.fillText('z', 220, 18);
  }
  const sh = $('#nwShare', m.el);
  if (sh) sh.addEventListener('click', () => napShare(w));
  $('#nwHome', m.el).addEventListener('click', () => { m.close(); setScreen('home'); });
  $('#nwNext', m.el).addEventListener('click', () => { m.close(); openNap('l:' + napSave().no); });
  /* a good moment to ask — see maybeAskForAReview */
  if (w.first && typeof maybeAskForAReview === 'function') maybeAskForAReview('nap');
}

/* The daily as a picture made of squares, the way a word game's result
   travels: the cushions' shape, never where anybody sleeps, so a friend
   can be sent it before they have played. */
function napShare(w) {
  const b = NS.b, n = b.n;
  const rows = [];
  for (let r = 0; r < n; r++) {
    let line = '';
    for (let c = 0; c < n; c++) line += NAP_EMOJI[b.reg[r * n + c] % NAP_EMOJI.length];
    rows.push(line);
  }
  const d = new Date();
  const date = d.toLocaleDateString(T('nap_locale'), { day: 'numeric', month: 'short' });
  const text = T('nap_share_text', {
    d: date, grid: rows.join('\n'), t: napClockText(w.ms),
    clean: w.clean ? ' · ' + T('nap_clean') + ' ✨' : '',
    streak: w.streak > 1 ? ' · 🔥' + w.streak : ''
  });
  const url = storeLink() || '';
  track('nap_share');
  const P = (window.Capacitor && window.Capacitor.Plugins) || {};
  if (P.Share && P.Share.share) { try { P.Share.share({ title: 'Pawtika', text: text, url: url || undefined }); return; } catch (e) { } }
  if (navigator.share) { navigator.share({ title: 'Pawtika', text: text, url: url || undefined }).catch(() => { }); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text + (url ? '\n' + url : '')).then(() => toast(T('share_copied'), 'check'), () => { });
  }
}

/* ---------- the first time: the rule, drawn ---------- */
function napHowTo(then) {
  const m = modal(`
    <canvas class="napHowArt" width="232" height="150" aria-hidden="true"></canvas>
    <h2>${T('nap_how_t')}</h2>
    <p style="color:var(--text-dim)">${T('nap_how_s')}</p>
    <div class="napRulesCol">${napRulesHTML()}</div>
    <button class="btn primary wide" id="nhGo">${T('nap_how_go')}</button>
  `, { dismissable: false });
  const cv = $('.napHowArt', m.el);
  if (cv) {
    /* a four-by-four that is already right, so the first picture is of
       the rule kept rather than the rule broken */
    const c = fitCanvas(cv, 232, 150);
    const reg = [0, 0, 1, 1, 0, 2, 2, 1, 3, 3, 2, 1, 3, 3, 2, 2], sol = [1, 3, 0, 2], n = 4, cell = 34, ox = 48, oy = 7;
    for (let i = 0; i < 16; i++) {
      c.fillStyle = napCushion(reg[i]);
      c.fillRect(ox + (i % n) * cell, oy + ((i / n) | 0) * cell, cell, cell);
    }
    c.strokeStyle = rgba(PAL.text, .78); c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = (i / n) | 0, col = i % n, x = ox + col * cell, y = oy + r * cell;
      if (col < 3 && reg[i] !== reg[i + 1]) { c.moveTo(x + cell, y); c.lineTo(x + cell, y + cell); }
      if (r < 3 && reg[i] !== reg[i + 4]) { c.moveTo(x, y + cell); c.lineTo(x + cell, y + cell); }
    }
    c.stroke();
    rr(c, ox, oy, cell * 4, cell * 4, 6); c.stroke();
    const specs = napSpecs(4);
    sol.forEach((col, r) => {
      c.save(); c.translate(ox + col * cell + cell / 2, oy + r * cell + cell * .55);
      drawFace(c, specs[reg[r * n + col]], cell * .34, { blink: 1, tongue: false });
      c.restore();
    });
  }
  $('#nhGo', m.el).addEventListener('click', () => {
    napSave().seen = true; persist(true);
    m.close();
    setTimeout(then, 120);
  });
}
function napRulesHTML() {
  const grid = '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3v18" stroke="currentColor" stroke-width="1.4" opacity=".5"/><circle cx="7.5" cy="16.5" r="2.2" fill="currentColor"/><circle cx="16.5" cy="7.5" r="2.2" fill="currentColor"/></svg>';
  const cushion = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7c0-1.7 1.3-3 3-3h10c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H7c-1.7 0-3-1.3-3-3z" fill="currentColor" opacity=".18" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 6.5h11v11h-11z" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2" opacity=".6"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/></svg>';
  const touch = '<svg viewBox="0 0 24 24" fill="none"><circle cx="8" cy="8" r="3" fill="currentColor"/><circle cx="16" cy="16" r="3" fill="currentColor" opacity=".45"/><path d="M5 19 19 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  return `<span class="napRule">${grid}${T('nap_rule_line')}</span>
    <span class="napRule">${cushion}${T('nap_rule_cushion')}</span>
    <span class="napRule">${touch}${T('nap_rule_touch')}</span>`;
}

/* ---------- where it is entered from ---------- */

/* Somebody who has never put a house to bed starts on the four-by-four,
   whichever door they came in by. "Today's nap" on a Friday is eight by
   eight, and a first board that size teaches nothing except that the
   game is hard — found on the emulator on 30 Oct 2026. */
function napEntry(want) {
  const s = napSave();
  if (!s.solved && !(s.cur && s.cur.key === 'l:1')) return 'l:1';
  return want;
}

/* The card on the home screen: today's board, the ladder, and a small
   painting of a cushion with somebody asleep on it, because a card that
   only says "new mode" is a card nobody presses. */
function napHomeCard() {
  const s = napSave();
  const d = napDayState();
  return `
    <div class="card napCard" id="napCard">
      <canvas class="napCardArt" width="92" height="92" aria-hidden="true"></canvas>
      <span class="nc-t">
        <span class="eyebrow">${s.solved ? T('nap_t') : T('nap_new')}</span>
        <b>${d.done ? T('nap_done_today', { t: napClockText(d.time) }) : s.solved ? T('nap_daily') : T('nap_t')}</b>
        <small>${d.done ? T('nap_tomorrow') : T('nap_card_s')}</small>
        ${d.streak > 1 ? `<span class="pill warn" style="margin-top:5px;align-self:flex-start">${IC.flame}${T('nap_streak', { n: d.streak })}</span>` : ''}
      </span>
      <span class="nc-b">
        <button class="btn sm ${d.done ? '' : 'primary'}" id="napToday">${d.done ? T('nap_again') : T('nap_play')}</button>
        ${s.solved ? `<button class="btn sm ghost" id="napRung">${T('nap_level', { n: s.no })}</button>` : ''}
      </span>
    </div>`;
}
function napHomeBind(root) {
  const t = $('#napToday', root), r = $('#napRung', root);
  if (t) t.addEventListener('click', () => { SFX.tap(); openNap(napEntry('d:' + dayNumber())); });
  if (r) r.addEventListener('click', () => { SFX.tap(); openNap('l:' + napSave().no); });
  const cv = $('.napCardArt', root);
  if (cv) {
    const c = fitCanvas(cv, 92, 92);
    const cell = 30;
    const reg = [0, 0, 1, 2, 0, 1, 2, 2, 1];
    for (let i = 0; i < 9; i++) { c.fillStyle = napCushion(reg[i]); c.fillRect(1 + (i % 3) * cell, 1 + ((i / 3) | 0) * cell, cell, cell); }
    c.strokeStyle = rgba(PAL.text, .7); c.lineWidth = 2.4; c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < 9; i++) {
      const rr2 = (i / 3) | 0, col = i % 3, x = 1 + col * cell, y = 1 + rr2 * cell;
      if (col < 2 && reg[i] !== reg[i + 1]) { c.moveTo(x + cell, y); c.lineTo(x + cell, y + cell); }
      if (rr2 < 2 && reg[i] !== reg[i + 3]) { c.moveTo(x, y + cell); c.lineTo(x + cell, y + cell); }
    }
    c.stroke(); rr(c, 1, 1, 90, 90, 8); c.stroke();
    const specs = napSpecs(3);
    [[0, 0], [2, 1]].forEach(([r0, c0], k) => {
      c.save(); c.translate(1 + c0 * cell + cell / 2, 1 + r0 * cell + cell * .56);
      drawFace(c, specs[k], cell * .34, { blink: 1, tongue: false });
      c.restore();
    });
    c.fillStyle = PAL.textDim; c.font = '800 13px Grandstander, sans-serif'; c.fillText('z', 76, 74);
  }
}

/* the words in the markup, in the player's language */
function napLabels() {
  $('#napBack').innerHTML = IC.back;
  $('#napBack').setAttribute('aria-label', T('nap_home'));
  $('#napUndo').innerHTML = `<span>${T('nap_undo')}</span>`;
  $('#napClear').innerHTML = `<span>${T('nap_clear')}</span>`;
  $('#napHint').innerHTML = `${IC.sparkle}<span>${T('nap_hint')}</span>`;
  $('#napLoadingT').textContent = T('nap_loading');
  $('#napHelp').textContent = T('nap_help');
  $('#napRules').innerHTML = napRulesHTML();
  $('#napBoard').setAttribute('aria-label', T('nap_t'));
  if (NS.key) napHeader();
}

/* the screen comes and goes with the board kept */
EV.on('screen', name => {
  if (name === 'nap') { napLoopStart(); return; }
  napLoopStop();
  if (NS.b && !NS.done) napPause();
});
document.addEventListener('visibilitychange', () => {
  if (SCREEN !== 'nap' || !NS.b) return;
  if (document.hidden) napPause();
});
window.addEventListener('resize', () => { if (SCREEN === 'nap') napLayout(); });
EV.on('repaint', () => { NS.layer = null; NS.sprites = {}; if (SCREEN === 'nap') napDraw(); });
