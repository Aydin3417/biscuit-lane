/* ============================================================
   20 — audio. Everything synthesised; no files, no downloads.

   Signal path
     voice ─┬─► sfxBus ─► sfxComp ─► master ─► out
            └─► verbSend ─► convolver ─► verbGain ─┘
     music ──► musBus  ─► master

   The compressor is what makes a ten-tile cascade sound like one
   happy noise instead of ten fighting ones, and the little room
   reverb is what stops the synth sounding like a test tone.
   ============================================================ */
const AU = {
  ctx: null, master: null, sfxBus: null, musBus: null, verb: null, verbGain: null,
  comp: null, ready: false, noise: null,
  musicOn: false, musicTimer: null, step: 0,
  voices: 0, lastPop: 0, intensity: 0
};

const AU_MAX_VOICES = 26;          // hard ceiling; cascades stop stacking mush
/* How loud the bed sits under everything. Measured against the
   effects: at .3 the music was peaking level with the win fanfare. */
const MUS_BED = .13;

/* Every failure here is survivable: a browser with no Web Audio, a
   device that refuses another context, a policy that blocks it. The game
   plays silently rather than not at all, and never retries in a loop. */
let audioBroken = false;
function audioInit() {
  if (AU.ctx || audioBroken) return;
  try { buildAudioGraph(); }
  catch (e) {
    /* a half-built graph is worse than none: drop it and stay silent */
    audioBroken = true;
    AU.ready = false;
    AU.ctx = null;
  }
}
function buildAudioGraph() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { audioBroken = true; return; }
  AU.ctx = new AC();
  const c = AU.ctx;

  AU.master = c.createGain();
  AU.master.gain.value = .9;
  AU.master.connect(c.destination);

  /* glue compressor: soft, slow-ish, just enough to hold it together */
  AU.comp = c.createDynamicsCompressor();
  AU.comp.threshold.value = -18;
  AU.comp.knee.value = 26;
  AU.comp.ratio.value = 3.2;
  AU.comp.attack.value = .004;
  AU.comp.release.value = .18;
  AU.comp.connect(AU.master);

  /* A ceiling, so a whole-board cascade cannot stack twenty voices
     into the top of the signal.

     Not a second DynamicsCompressor. Measured, chaining two of those in
     Chrome costs about twenty decibels on quiet material even with the
     ratio set to 1:1 — the node is not transparent when it is not
     working, and a tap went from .018 to .007 with one added to the
     path. A wave shaper is what a limiter actually is: a curve. It is
     exactly linear below the knee, so nothing quiet is touched at all,
     and it cannot overshoot however much is thrown at it. */
  AU.limit = c.createWaveShaper();
  AU.limit.oversample = '4x';
  {
    const N = 2048, curve = new Float32Array(N), knee = .72;
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * 2 - 1;
      const a = Math.abs(x);
      curve[i] = a <= knee ? x
        : Math.sign(x) * (knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee)));
    }
    AU.limit.curve = curve;
  }
  AU.comp.disconnect();
  AU.comp.connect(AU.limit);
  AU.limit.connect(AU.master);

  AU.sfxBus = c.createGain(); AU.sfxBus.gain.value = .85; AU.sfxBus.connect(AU.comp);
  AU.musBus = c.createGain(); AU.musBus.gain.value = 0; AU.musBus.connect(AU.master);

  /* a small warm room, generated */
  AU.verb = c.createConvolver();
  AU.verb.buffer = makeRoomIR(c, 1.5, 2.6, 5200);
  /* Pre-delay. With the reverb starting on the same sample as the
     source, the room is smeared over the attack and every sound reads
     as slightly out of focus. Eighteen milliseconds of air between the
     hit and its reflections is most of the difference between a sound
     that was made and a sound that was recorded somewhere. */
  AU.verbIn = c.createDelay(.2);
  AU.verbIn.delayTime.value = .018;
  /* and the room is darker than the source, always */
  AU.verbTone = c.createBiquadFilter();
  AU.verbTone.type = 'lowpass';
  AU.verbTone.frequency.value = 3600;
  AU.verbTone.Q.value = .7;
  AU.verbGain = c.createGain(); AU.verbGain.gain.value = .42;
  AU.verbIn.connect(AU.verb);
  AU.verb.connect(AU.verbTone); AU.verbTone.connect(AU.verbGain);
  AU.verbGain.connect(AU.comp);

  /* one shared noise buffer */
  const len = Math.floor(c.sampleRate * 1.2);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  AU.noise = buf;

  AU.ready = true;
}


/* Exponentially decaying noise, gently darkened by a one-pole
   lowpass, with a couple of early reflections so it reads as a
   room and not as a hiss. */
function makeRoomIR(c, seconds, decay, cutoffHz) {
  const rate = c.sampleRate;
  const n = Math.floor(rate * seconds);
  const buf = c.createBuffer(2, n, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const env = Math.pow(1 - t, decay);
      /* A real room loses its top as it decays — air and soft
         furnishings eat the highs first. A tail filtered at one fixed
         cutoff for its whole length is the sound of a plugin preset. */
      const kk = Math.exp(-2 * Math.PI * (cutoffHz * (1 - t * .72) + 300) / rate);
      lp = (1 - kk) * (Math.random() * 2 - 1) + kk * lp;
      d[i] = lp * env * .7;
    }
    /* early reflections give the room a size */
    [[.011, .5], [.019, .38], [.031, .3], [.047, .22]].forEach(([dt, g], idx) => {
      const at = Math.floor(rate * (dt + ch * .0013 + idx * .0007));
      if (at < n) d[at] += g * (ch ? -1 : 1);
    });
  }
  return buf;
}

function audioResume() {
  audioInit();
  if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume();
}
function sfxOn() { return SAVE && SAVE.settings.sound && AU.ready; }

/* voice book-keeping so a 40-tile clear cannot melt the mixer */
function claimVoice(dur) {
  if (AU.voices >= AU_MAX_VOICES) return false;
  AU.voices++;
  setTimeout(() => { AU.voices--; }, (dur + .1) * 1000);
  return true;
}

/* build the tail of a voice: optional pan, optional reverb send */
function outputChain(node, o) {
  const c = AU.ctx;
  let last = node;
  if (o.pan !== undefined && c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = clamp(o.pan, -1, 1);
    last.connect(p); last = p;
  }
  last.connect(AU.sfxBus);
  if (o.send) {
    const s = c.createGain();
    s.gain.value = o.send;
    last.connect(s); s.connect(AU.verbIn || AU.verb);
  }
}

/* ---------------- primitives ----------------

   Every one-shot is nudged off centre before it plays. Two taps of the
   same button used to be the same sample twice, and a run of them —
   which is what a board of matches is — read as a machine gun rather
   than as a thing being struck repeatedly. A few cents and a few
   percent is all it takes; the ear stops hearing a loop and starts
   hearing an object. Musical sounds get less of it than noises do,
   because a wrong note is worse than a samey one. */
function vary(o, cents, amp) {
  const c2 = o.vary === undefined ? cents : o.vary;
  const a2 = o.varyGain === undefined ? (amp === undefined ? .08 : amp) : o.varyGain;
  return {
    detune: (Math.random() * 2 - 1) * c2,
    gain: 1 + (Math.random() * 2 - 1) * a2
  };
}
function tone(o) {
  if (!sfxOn()) return;
  const dur = o.dur || .2;
  if (!claimVoice(dur)) return;
  const c = AU.ctx, t = c.currentTime + (o.delay || 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  const v = vary(o, 11);
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + dur);
  osc.detune.value = (o.detune || 0) + v.detune;
  const peak = (o.gain === undefined ? .18 : o.gain) * v.gain;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + (o.atk || .008));
  if (o.hold) g.gain.setValueAtTime(Math.max(.0002, peak), t + (o.atk || .008) + o.hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (o.filter) {
    const f = c.createBiquadFilter();
    f.type = o.filter; f.frequency.value = o.fc || 1200; f.Q.value = o.q || 1;
    if (o.fc2) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.fc2), t + dur);
    node.connect(f); node = f;
  }
  node.connect(g);
  outputChain(g, o);
  osc.start(t); osc.stop(t + dur + .05);
  return osc;
}

function noiseBurst(o) {
  if (!sfxOn()) return;
  const dur = o.dur || .25;
  if (!claimVoice(dur)) return;
  const c = AU.ctx, t = c.currentTime + (o.delay || 0);
  const v = vary(o, 0, .10);
  const src = c.createBufferSource();
  src.buffer = AU.noise;
  /* and start somewhere else in the buffer, so the same hiss is never
     replayed twice from the same sample */
  src.playbackRate.value = (o.rate || 1) * (1 + (Math.random() * 2 - 1) * .05);
  const f = c.createBiquadFilter();
  f.type = o.filter || 'bandpass';
  f.frequency.setValueAtTime(o.fc || 900, t);
  if (o.fc2) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.fc2), t + dur);
  if (o.fc3) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.fc3), t + dur * 1.6);
  f.Q.value = o.q || 1.4;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(.0002, (o.gain === undefined ? .2 : o.gain) * v.gain), t + (o.atk || .006));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g);
  outputChain(g, o);
  const from = (o.offset || 0) + Math.random() * .4;
  src.start(t, from); src.stop(t + dur + .05);
}

/* a struck bar: fundamental plus the inharmonic partials a real
   wooden key has. This is what makes a match sound like an object. */
function mallet(f, o) {
  o = o || {};
  if (!sfxOn()) return;
  const dur = o.dur || .34;
  if (!claimVoice(dur)) return;
  const c = AU.ctx, t = c.currentTime + (o.delay || 0);
  const mv = vary(o, 5, .07);
  const gain = (o.gain === undefined ? .16 : o.gain) * mv.gain;
  const partials = o.partials || [[1, 1, 1], [3.94, .30, .55], [10.6, .10, .28]];
  const bus = c.createGain();
  bus.gain.value = 1;
  partials.forEach(([mult, amp, decay]) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = mult === 1 ? (o.type || 'sine') : 'sine';
    osc.detune.value = mv.detune;
    osc.frequency.setValueAtTime(f * mult, t);
    /* real bars drop a touch in pitch as they ring out */
    osc.frequency.exponentialRampToValueAtTime(f * mult * .995, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002, gain * amp), t + .004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * decay);
    osc.connect(g); g.connect(bus);
    osc.start(t); osc.stop(t + dur + .05);
  });
  /* mallet click */
  const cl = c.createBufferSource();
  cl.buffer = AU.noise;
  const cf = c.createBiquadFilter();
  cf.type = 'bandpass'; cf.frequency.value = f * 4.2; cf.Q.value = 1.2;
  const cg = c.createGain();
  cg.gain.setValueAtTime(gain * .5, t);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + .028);
  cl.connect(cf); cf.connect(cg); cg.connect(bus);
  cl.start(t); cl.stop(t + .06);

  outputChain(bus, { pan: o.pan, send: o.send === undefined ? .16 : o.send });
}

/* The part of an impact you feel rather than hear. Almost everything in
   this game lived above two hundred hertz, which is why it all sounded
   like it was coming out of a phone speaker even when it wasn't: there
   was nothing underneath any of it. A short sine an octave or two below
   the body, gone in a tenth of a second, is the whole trick. */
function thump(f, gain, dur, pan) {
  tone({
    f: f, f2: f * .55, dur: dur || .09, type: 'sine',
    gain: gain === undefined ? .1 : gain, atk: .002, pan: pan, vary: 4, send: 0
  });
}

/* The tick of contact, before any of the tone arrives. Buttons in
   expensive software click before they ring; the click is two
   milliseconds of filtered noise and it is most of what tells you the
   press registered. */
function click(fc, gain, pan) {
  noiseBurst({ fc: fc || 5200, dur: .014, gain: gain === undefined ? .07 : gain,
    q: .8, filter: 'highpass', pan: pan, send: 0 });
}

const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const semi = n => 261.63 * Math.pow(2, n / 12);

/* duck the music for a beat when something big happens */
function musicDuck(amount, time) {
  if (!AU.ready || !AU.musicOn) return;
  const g = AU.musBus.gain, t = AU.ctx.currentTime;
  const target = Math.max(.015, MUS_BED * (1 - amount));
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(target, t + .04);
  g.linearRampToValueAtTime(MUS_BED, t + (time || .5));
}

/* ============================================================
   The sound effects.
   ============================================================ */
const SFX = {

  /* ---- interface ---- */
  /* The interface used to be made of different material from the board.

     Rendered offline and measured, tap was 0.0005 rms against a tile
     pop's 0.003 and a win's 0.029 — six times under the quietest thing
     the game does on purpose — 47ms long against the pop's 387, and
     half again as bright. A click and a blip, which is what a phone
     keypad is made of. And it is not a minor voice: tap is called
     twenty-one times in 60-ui.js and select twice, so almost every
     sound a player hears while moving around the game was that one.

     They are mallets now, the same voice the board clears tiles with,
     and they sit on the same pentatonic PENT that pop and combo use
     rather than on the arbitrary 620 and 520 they had. Moving through
     the game is consonant with playing it, and choosing something
     rises: tap sits on E, select a fifth above it on G. The tick sits
     higher than either, small and quick, because it marks a thumb
     passing rather than answers a decision. */
  tap() {
    mallet(semi(PENT[7]), { gain: .085, dur: .17, send: .10,
      partials: [[1, 1, 1], [3.94, .16, .40]] });
    click(5200, .028);
  },
  select() {
    mallet(semi(PENT[8]), { gain: .105, dur: .24, send: .15 });
    noiseBurst({ fc: 3400, dur: .04, gain: .03, q: 2 });
    thump(150, .04, .07);
  },
  bad() {
    tone({ f: 200, f2: 140, dur: .16, type: 'sawtooth', gain: .09, filter: 'lowpass', fc: 700 });
    tone({ f: 196, f2: 138, dur: .17, type: 'sawtooth', gain: .05, detune: 22, filter: 'lowpass', fc: 620 });
  },
  swap() {
    tone({ f: 380, f2: 560, dur: .12, type: 'sine', gain: .095, send: .12 });
    noiseBurst({ fc: 1200, fc2: 2600, dur: .1, gain: .038, q: .8 });
    thump(120, .05, .08);
  },
  /* The lightest of the three, for a control a thumb runs along rather
     than presses once — the shop's five category tabs, which used to
     fire the full tap each time. It was also dead: nothing called it,
     and at a 0.009 peak it was under the 0.012 the suite calls
     inaudible, so it could not have been heard if anything had. It is
     in the suite's list now. */
  uiTick() {
    mallet(semi(PENT[9]), { gain: .075, dur: .11, send: .05, partials: [[1, 1, 1]] });
  },

  /* ---- the board ----
     `chain` is the cascade depth, `i` the index inside one clear,
     `pan` where it happened across the board (-1..1).            */
  pop(chain, i, pan) {
    const step = Math.min(PENT.length - 1, (chain - 1) * 2 + (i || 0));
    const f = semi(PENT[step] + 12);
    mallet(f, {
      gain: .17 - Math.min(.06, (i || 0) * .012),
      dur: .3, delay: (i || 0) * .028,
      pan: pan === undefined ? 0 : pan * .55,
      send: .18 + Math.min(.2, chain * .04)
    });
    if (chain > 1) {
      /* a fifth above, quietly, so deep cascades brighten */
      mallet(f * 1.5, { gain: .05, dur: .22, delay: (i || 0) * .028 + .01, pan: pan ? pan * .5 : 0, send: .25 });
    }
    /* one piece of low end for the clear, not one per tile: nine tiles
       going at once should land like a handful of something dropped,
       not like nine kick drums */
    if (!i) thump(82 + Math.min(4, chain) * 6, .105, .12, pan === undefined ? 0 : pan * .3);
  },

  /* a rising sweep as the cascade gets deeper */
  combo(chain) {
    const n = Math.min(chain, 8);
    tone({
      f: semi(PENT[Math.min(n, PENT.length - 1)]), f2: semi(PENT[Math.min(n + 2, PENT.length - 1)] + 12),
      /* a bandpass up at 900Hz sat above the note and removed it; the
         chain reward needs to be heard over the pops it crowns */
      dur: .3, type: 'triangle', gain: .20 + n * .022, filter: 'lowpass', fc: 3400, send: .3
    });
    musicDuck(.25, .4);
  },

  /* ---- specials ---- */
  rocket(pan) {
    /* body: a filtered roar that pitches down as it leaves */
    noiseBurst({ fc: 2600, fc2: 400, dur: .38, gain: .27, filter: 'bandpass', q: .9, pan, send: .22 });
    tone({ f: 700, f2: 180, dur: .3, type: 'sawtooth', gain: .12, filter: 'lowpass', fc: 1400, pan });
    tone({ f: 350, f2: 90, dur: .34, type: 'triangle', gain: .07, pan });
    /* the launch click */
    noiseBurst({ fc: 5000, dur: .03, gain: .15, q: 1.5, pan });
  },
  bomb(pan) {
    tone({ f: 150, f2: 44, dur: .48, type: 'sine', gain: .25, pan, send: .3 });
    tone({ f: 92, f2: 34, dur: .55, type: 'triangle', gain: .15, pan });
    noiseBurst({ fc: 1400, fc2: 150, dur: .42, gain: .17, filter: 'lowpass', q: .7, pan, send: .35 });
    noiseBurst({ fc: 6000, fc2: 2000, dur: .09, gain: .12, q: .8, pan });
    musicDuck(.5, .7);
  },
  rainbow() {
    for (let i = 0; i < 7; i++) {
      mallet(semi(PENT[i] + 24), { gain: .1, dur: .5, delay: i * .045, send: .4, pan: -.6 + i * .2 });
    }
    noiseBurst({ fc: 3200, fc2: 2200, dur: .5, gain: .07, filter: 'bandpass', q: 2, send: .5 });
    musicDuck(.4, .8);
  },

  /* ---- blockers, by material ---- */
  crate(hard, pan) {
    /* transient, wooden body, then splinters falling */
    noiseBurst({ fc: 4200, dur: .022, gain: .21, q: .9, filter: 'highpass', pan });
    tone({ f: hard ? 150 : 190, f2: hard ? 96 : 120, dur: .16, type: 'square', gain: .13, filter: 'lowpass', fc: 900, pan });
    tone({ f: hard ? 226 : 288, f2: 180, dur: .13, type: 'triangle', gain: .07, pan });
    noiseBurst({ fc: 900, fc2: 260, dur: .24, gain: .24, filter: 'bandpass', q: 1.1, pan, send: .18 });
    thump(hard ? 62 : 74, .13, .13, pan);
    for (let i = 0; i < 3; i++) {
      noiseBurst({ fc: rnd(1400, 2600), dur: .05, gain: .05, q: 3, delay: .1 + i * .06, pan });
    }
  },
  ice(pan) {
    /* a bright crack, then glassy shards skittering */
    noiseBurst({ fc: 7000, fc2: 4200, dur: .05, gain: .18, q: 1, pan });
    tone({ f: 1900, f2: 2600, dur: .16, type: 'sine', gain: .13, pan, send: .35 });
    tone({ f: 2840, f2: 3600, dur: .12, type: 'sine', gain: .07, pan, send: .4 });
    for (let i = 0; i < 5; i++) {
      noiseBurst({ fc: rnd(4200, 8000), dur: .03, gain: .05, q: 6, delay: .05 + i * .045, pan, send: .3 });
    }
  },
  creak(pan) {
    /* something growing where it should not: a low woody groan */
    tone({ f: 88, f2: 132, dur: .34, type: 'sawtooth', gain: .07, filter: 'lowpass', fc: 420, pan, send: .2 });
    noiseBurst({ fc: 320, fc2: 680, dur: .3, gain: .05, filter: 'bandpass', q: 2.4, pan });
  },
  snip(pan) {
    /* secateurs: a short bright shear, then the cut stem falling away.
       Deliberately drier than the crate so the two never blur together. */
    noiseBurst({ fc: 5200, fc2: 3000, dur: .035, gain: .17, q: 2.2, pan });
    noiseBurst({ fc: 3400, fc2: 1800, dur: .05, gain: .11, q: 2.6, delay: .035, pan });
    tone({ f: 620, f2: 380, dur: .10, type: 'triangle', gain: .08, pan, send: .12 });
    noiseBurst({ fc: 800, fc2: 300, dur: .18, gain: .07, filter: 'bandpass', q: 1.2, delay: .07, pan, send: .2 });
  },
  mud(pan) {
    /* squelch: a resonant filter opening then closing on wet noise */
    noiseBurst({ fc: 200, fc2: 900, fc3: 260, dur: .22, gain: .20, filter: 'lowpass', q: 7, pan });
    tone({ f: 130, f2: 62, dur: .18, type: 'sine', gain: .13, pan });
    noiseBurst({ fc: 500, fc2: 180, dur: .3, gain: .09, filter: 'bandpass', q: .8, delay: .06, pan, send: .12 });
  },

  /* ---- falling ---- */
  drop(pan) { tone({ f: 300, f2: 200, dur: .12, type: 'sine', gain: .09, pan }); },
  land(force, pan) {
    const f = clamp(force, 0, 1);
    if (f < .1) return;
    /* rate-limit: gravity lands a lot of tiles at once */
    const t = now();
    if (t - AU.lastPop < 26) return;
    AU.lastPop = t;
    tone({ f: 108 - f * 26, f2: 62, dur: .06 + f * .05, type: 'sine', gain: .04 + f * .07, pan });
    noiseBurst({ fc: 700, fc2: 250, dur: .05 + f * .04, gain: .03 + f * .05, filter: 'lowpass', q: .7, pan });
  },
  whoosh(pan) {
    /* a narrow band on noise passes a fraction of what the gain says:
       measured, this needs about four times what a tone would */
    noiseBurst({ fc: 400, fc2: 2400, fc3: 300, dur: .3, gain: .9, filter: 'bandpass', q: 1.4, pan, send: .2 });
  },

  /* ---- rewards ---- */
  coin() {
    tone({ f: 1180, dur: .09, type: 'square', gain: .1, send: .2 });
    tone({ f: 1580, dur: .13, type: 'square', gain: .09, delay: .07, send: .25 });
  },
  star(i) {
    const f = semi(PENT[4 + (i || 0) * 2] + 24);
    mallet(f, { gain: .18, dur: .7, send: .45, partials: [[1, 1, 1], [2.76, .3, .6], [5.4, .12, .35]] });
    tone({ f: f * 1.5, dur: .35, type: 'sine', gain: .06, send: .4 });
  },
  chargeReady() {
    [0, 4, 7].forEach((n, i) => mallet(semi(n + 24), { gain: .11, dur: .45, delay: i * .06, send: .35 }));
    noiseBurst({ fc: 2600, fc2: 5200, dur: .3, gain: .04, q: 2, send: .4 });
  },
  win() {
    [0, 4, 7, 12].forEach((n, i) => {
      mallet(semi(n + 12), { gain: .15, dur: .8, delay: i * .1, send: .4 });
      tone({ f: semi(n + 24), dur: .4, type: 'sine', gain: .05, delay: i * .1, send: .5 });
    });
    tone({ f: semi(-12), f2: semi(-12), dur: 1.4, type: 'sine', gain: .12, delay: .3 });
  },
  lose() {
    [7, 4, 2, -1].forEach((n, i) => tone({
      f: semi(n + 12), dur: .34, type: 'triangle', gain: .12, delay: i * .13, send: .3
    }));
    tone({ f: semi(-13), dur: .9, type: 'sine', gain: .1, delay: .45 });
  },
  levelup() {
    [0, 4, 7, 11, 12].forEach((n, i) => mallet(semi(n + 12), { gain: .13, dur: .6, delay: i * .085, send: .4 }));
  },

  /* ---- animals ----
     Two formants over a moving source: the cheapest way to make a
     synth sound like it came out of a throat.                    */
  meow(pitch) {
    if (!sfxOn()) return;
    if (!claimVoice(.55)) return;
    const base = 460 * (pitch || 1);
    const c = AU.ctx, t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * .74, t);
    osc.frequency.linearRampToValueAtTime(base * 1.24, t + .13);
    osc.frequency.linearRampToValueAtTime(base * .70, t + .44);
    /* vibrato */
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 17; lg.gain.value = base * .035;
    lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + .5);
    /* two formants sweeping from "ee" towards "ow" */
    const f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter();
    f1.type = 'bandpass'; f1.Q.value = 6;
    f1.frequency.setValueAtTime(720, t);
    f1.frequency.linearRampToValueAtTime(520, t + .42);
    f2.type = 'bandpass'; f2.Q.value = 8;
    f2.frequency.setValueAtTime(2100, t);
    f2.frequency.linearRampToValueAtTime(1150, t + .42);
    const m1 = c.createGain(), m2 = c.createGain();
    m1.gain.value = 1.6; m2.gain.value = .85;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(.30, t + .05);
    g.gain.exponentialRampToValueAtTime(.21, t + .28);
    g.gain.exponentialRampToValueAtTime(0.0001, t + .5);
    osc.connect(f1); osc.connect(f2);
    f1.connect(m1); f2.connect(m2);
    m1.connect(g); m2.connect(g);
    outputChain(g, { send: .3 });
    osc.start(t); osc.stop(t + .52);
  },

  bark(pitch) {
    const p = pitch || 1;
    /* the shape of a bark is a hard consonant then a short vowel */
    noiseBurst({ fc: 900 * p, fc2: 380 * p, dur: .12, gain: .28, filter: 'bandpass', q: 2.2, send: .22 });
    tone({ f: 210 * p, f2: 118 * p, dur: .14, type: 'sawtooth', gain: .20, filter: 'lowpass', fc: 1100, send: .2 });
    tone({ f: 420 * p, f2: 260 * p, dur: .11, type: 'triangle', gain: .09 });
    noiseBurst({ fc: 700 * p, fc2: 320 * p, dur: .1, gain: .13, filter: 'bandpass', q: 2.2, delay: .17, send: .25 });
    tone({ f: 195 * p, f2: 120 * p, dur: .12, type: 'sawtooth', gain: .1, filter: 'lowpass', fc: 1000, delay: .17 });
  },

  purr() {
    if (!sfxOn()) return;
    if (!claimVoice(1.3)) return;
    const c = AU.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = AU.noise; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; f.Q.value = 2;
    /* a purr is amplitude modulation at ~25 Hz, not a tone */
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(.13, t + .12);
    g.gain.setValueAtTime(.13, t + .8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
    const trem = c.createOscillator(), tg = c.createGain();
    trem.type = 'triangle'; trem.frequency.value = 25; tg.gain.value = .115;
    trem.connect(tg); tg.connect(g.gain); trem.start(t); trem.stop(t + 1.3);
    /* a body under it */
    const sub = c.createOscillator(), sg = c.createGain();
    sub.type = 'sine'; sub.frequency.value = 62;
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(.055, t + .15);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    const tg2 = c.createGain(); tg2.gain.value = .04;
    trem.connect(tg2); tg2.connect(sg.gain);
    sub.connect(sg);
    src.connect(f); f.connect(g);
    outputChain(g, { send: .14 });
    outputChain(sg, {});
    src.start(t); src.stop(t + 1.3);
    sub.start(t); sub.stop(t + 1.3);
  },

  eat() {
    for (let i = 0; i < 5; i++) {
      noiseBurst({ fc: rnd(700, 1200), fc2: 480, dur: .06, gain: .12, q: 2.4, delay: i * .105 });
      tone({ f: rnd(150, 210), f2: 110, dur: .05, type: 'square', gain: .04, delay: i * .105 });
    }
  },
  splash() {
    noiseBurst({ fc: 2400, fc2: 700, dur: .5, gain: .13, filter: 'bandpass', q: .8, send: .3 });
    for (let i = 0; i < 4; i++) {
      tone({ f: rnd(600, 1400), f2: rnd(1600, 2600), dur: .12, type: 'sine', gain: .05, delay: rnd(.02, .3), send: .35 });
    }
  },
  snore() {
    tone({ f: 92, f2: 66, dur: .8, type: 'sawtooth', gain: .07, filter: 'lowpass', fc: 240 });
    noiseBurst({ fc: 300, fc2: 160, dur: .7, gain: .04, filter: 'lowpass', q: 3 });
    tone({ f: 74, f2: 96, dur: .5, type: 'sine', gain: .05, delay: .85 });
  },
  /* the room tightens when the moves run out */
  tension(level) {
    const k = clamp(level, 0, 1);
    tone({ f: 72, f2: 58, dur: .5, type: 'sine', gain: .05 + k * .05, send: .2 });
    tone({ f: 108, f2: 96, dur: .35, type: 'triangle', gain: .02 + k * .03, delay: .16 });
  },
  /* a short breath of air between screens */
  swish(up) {
    noiseBurst({
      fc: up ? 500 : 2200, fc2: up ? 2400 : 420, dur: .26,
      gain: .38, filter: 'bandpass', q: 1.1, send: .25
    });
  },
  brush() {
    for (let i = 0; i < 3; i++) {
      noiseBurst({ fc: 1800, fc2: 900, dur: .22, gain: .08, filter: 'bandpass', q: 1.2, delay: i * .26, pan: i % 2 ? .3 : -.3 });
    }
  }
};

function petVoice(p, pitch) {
  if (!p) return;
  const st = petStageIdx(p);
  const k = (pitch || 1) * (st === 0 ? 1.28 : st === 1 ? 1.1 : .95);
  if (petBreed(p).species === 'cat') SFX.meow(k); else SFX.bark(k);
}

/* ============================================================
   Music — a slow lamp-lit loop, scheduled against the audio clock
   so it does not drift when the tab is busy drawing.
   ============================================================ */
const CHORDS = [
  [-5, 0, 4, 7], [-7, -2, 2, 5], [-3, 2, 5, 9], [-5, 0, 4, 11]
];
const MUS = { next: 0, look: .12, beat: .52 };

function musicStart() {
  audioInit();
  if (!AU.ready || AU.musicOn) return;
  AU.musicOn = true;
  const g = AU.musBus.gain, t0 = AU.ctx.currentTime;
  g.cancelScheduledValues(t0);
  g.setValueAtTime(g.value, t0);
  g.linearRampToValueAtTime(MUS_BED, t0 + 1.4);
  AU.step = 0;
  MUS.next = AU.ctx.currentTime + .1;
  const tick = () => {
    if (!AU.musicOn) return;
    while (MUS.next < AU.ctx.currentTime + MUS.look) {
      musicBeat(MUS.next);
      MUS.next += MUS.beat;
      AU.step++;
    }
    AU.musicTimer = setTimeout(tick, 25);
  };
  tick();
}

function musicBeat(t) {
  const c = AU.ctx;
  const bar = Math.floor(AU.step / 4) % CHORDS.length;
  const ch = CHORDS[bar];
  const s = AU.step % 4;

  /* bass on 1 and 3 */
  if (s === 0 || s === 2) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = semi(ch[0] - 12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(.22, t + .04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + .9);
    o.connect(g); g.connect(AU.musBus);
    o.start(t); o.stop(t + 1);
  }
  /* soft pad, slightly detuned so it breathes */
  if (s === 0) {
    ch.slice(1).forEach((n, i) => {
      [0, 7].forEach(det => {
        const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = 'triangle'; o.frequency.value = semi(n); o.detune.value = det;
        f.type = 'lowpass'; f.frequency.value = 1500;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(.03, t + .5);
        /* a bar is 2.08s, so a pad that died at 2.05 left a hole in it */
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.75);
        o.connect(f); f.connect(g); g.connect(AU.musBus);
        o.start(t + i * .02); o.stop(t + 2.9);
      });
    });
  }
  /* a bell that wanders, more often when the board is busy */
  if (Math.random() < .42 + AU.intensity * .2) {
    const n = ch[1 + Math.floor(Math.random() * 3)] + 12;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = semi(n);
    g.gain.setValueAtTime(0.0001, t + .06);
    g.gain.exponentialRampToValueAtTime(.075, t + .1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    o.connect(g); g.connect(AU.musBus);
    if (AU.verb) { const sd = c.createGain(); sd.gain.value = .3; g.connect(sd); sd.connect(AU.verbIn || AU.verb); }
    o.start(t); o.stop(t + 1.4);
  }
  AU.intensity *= .92;
}

function musicStop() {
  AU.musicOn = false;
  if (AU.musicTimer) clearTimeout(AU.musicTimer);
  if (AU.ready) {
    const g = AU.musBus.gain, t = AU.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + .6);
  }
}
function musicSync() {
  if (SAVE.settings.music) musicStart(); else musicStop();
}
/* the board tells the music how lively things are, 0..1 */
function musicIntensity(v) { AU.intensity = clamp(v, 0, 1); }
