/* Runs in every frame of the recording page before anything else does:
   the page's idea of time, taken away from the machine and handed to
   record.js.

   Headless Chromium rasterises on the CPU here, so a film of the game
   playing in real time is a film of dropped frames. With this in place
   the game advances by exactly one sixtieth of a second whenever it is
   told to and waits for the photograph in between, so the film is as
   smooth as a phone however long each frame took to take.

   Four things keep time in the game, and all four are driven from here:
     - performance.now, Date.now, requestAnimationFrame and the timers
     - CSS animations and transitions, stepped through the Web Animations
       API (they follow the compositor's clock otherwise)
     - the sound: AudioContext becomes an OfflineAudioContext that renders
       in step with the frames, so a pop is on the frame that drew it
     - Math.random, seeded, so the Turkish take and the English take are
       the same game */
(() => {
  const W = window;
  if (W.__clock) return;
  const P = new URLSearchParams(location.search);
  const top = W === W.top;

  /* ---- randomness ---- */
  let seed = (+(P.get('seed') || 0) || 20261005) >>> 0;
  const rnd = () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Math.random = rnd;

  /* ---- time ---- */
  let vt = 0, live = true, seq = 1;
  const realNow = performance.now.bind(performance);
  const realRAF = W.requestAnimationFrame.bind(W);
  const date0 = Date.now();
  const timers = new Map();
  let rafs = new Map();
  performance.now = () => vt;
  Date.now = () => date0 + vt;
  W.requestAnimationFrame = cb => { const id = seq++; rafs.set(id, cb); return id; };
  W.cancelAnimationFrame = id => { rafs.delete(id); };
  const timer = (fn, ms, every, args) => {
    const id = seq++;
    timers.set(id, { at: vt + Math.max(0, +ms || 0), fn, args, every });
    return id;
  };
  W.setTimeout = (fn, ms, ...a) => timer(fn, ms, 0, a);
  W.setInterval = (fn, ms, ...a) => timer(fn, ms, Math.max(1, +ms || 0), a);
  W.clearTimeout = W.clearInterval = id => { timers.delete(id); };

  /* ---- CSS animations and transitions ---- */
  const born = new WeakMap();
  const stepAnims = () => {
    if (!document.getAnimations) return;
    document.getAnimations().forEach(a => {
      try {
        let t0 = born.get(a);
        if (t0 === undefined) { t0 = vt; born.set(a, t0); a.pause(); }
        if (a.playState === 'finished') return;
        const end = a.effect ? a.effect.getComputedTiming().endTime : 0;
        const t = vt - t0;
        if (isFinite(end) && t >= end) a.finish(); else a.currentTime = t;
      } catch (e) { }
    });
  };

  const advance = dt => {
    const target = vt + dt;
    for (let guard = 0; guard < 5000; guard++) {
      let best = null, bid = 0;
      timers.forEach((t, id) => { if (t.at <= target && (!best || t.at < best.at)) { best = t; bid = id; } });
      if (!best) break;
      vt = Math.max(vt, best.at);
      if (best.every) best.at += best.every; else timers.delete(bid);
      try { if (typeof best.fn === 'function') best.fn.apply(W, best.args); } catch (e) { console.error(e); }
    }
    vt = target;
    const q = rafs; rafs = new Map();
    q.forEach(cb => { try { cb(vt); } catch (e) { console.error(e); } });
    stepAnims();
  };

  /* until record.js takes over, the page keeps real time by itself */
  let last = realNow();
  const pump = () => {
    if (!live) return;
    const t = realNow();
    advance(Math.min(50, t - last)); last = t;
    realRAF(pump);
  };
  realRAF(pump);

  /* ---- sound ---- */
  const RATE = 48000;
  const AU = { ctx: null, started: false, t: 0, done: null, resume: null, max: +(P.get('audio') || 90) };
  if (!top && W.OfflineAudioContext) {
    const Fake = function () {
      const c = new W.OfflineAudioContext(2, Math.ceil(AU.max * RATE), RATE);
      AU.ctx = c;
      AU.resume = c.resume.bind(c);
      /* the game resumes its context on every touch; this one is only
         ever moved by the frame counter */
      c.resume = () => Promise.resolve();
      c.close = () => Promise.resolve();
      return c;
    };
    W.AudioContext = Fake; W.webkitAudioContext = Fake;
  }
  /* render the sound up to `sec`, and stop there */
  const audioTo = async sec => {
    const c = AU.ctx;
    if (!c || sec <= AU.t + 1e-6 || sec >= AU.max - .1) return;
    const p = c.suspend(sec);
    if (!AU.started) { AU.started = true; AU.done = c.startRendering(); } else AU.resume();
    await p;
    AU.t = sec;
  };
  const wav = async () => {
    const c = AU.ctx;
    if (!c || !AU.started) return null;
    AU.resume();
    const buf = await AU.done;
    const n = Math.min(buf.length, Math.ceil((AU.t + .6) * RATE));
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const out = new DataView(new ArrayBuffer(44 + n * 4));
    const s = (o, str) => { for (let i = 0; i < str.length; i++) out.setUint8(o + i, str.charCodeAt(i)); };
    s(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); s(8, 'WAVEfmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
    out.setUint32(24, RATE, true); out.setUint32(28, RATE * 4, true);
    out.setUint16(32, 4, true); out.setUint16(34, 16, true); s(36, 'data'); out.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) {
      out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
      out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    }
    const u8 = new Uint8Array(out.buffer);
    let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  };

  W.__clock = {
    get t() { return vt; },
    get audio() { return AU; },
    freeze() { live = false; },
    /* start the dice again from a known place: a scene that reseeds is
       the same scene whatever was filmed before it */
    seed(n) { seed = n >>> 0; },
    advance, audioTo, wav,
    /* a tween on the page's own clock, for the camera and the finger */
    tween(ms, fn, ease) {
      const t0 = vt;
      return new Promise(done => {
        const step = () => {
          const k = ms <= 0 ? 1 : Math.min(1, (vt - t0) / ms);
          fn(ease ? ease(k) : k);
          if (k < 1) W.requestAnimationFrame(step); else done();
        };
        step();
      });
    },
    wait: ms => new Promise(done => W.setTimeout(done, ms))
  };
})();
