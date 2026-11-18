/* The music under a film, written here and synthesised here.

   The game has no music (it was taken out), and a film with only taps
   and pops in it is mostly silence: measured on the first cut, sound was
   present for under a third of its twenty-six seconds. So there is a
   bed, and like every other sound in this project it is made of
   oscillators, not of a file: nothing to license, nothing to credit.

   It is in C, because the game is. Every effect the board makes is a
   note of C major pentatonic (PENT and semi() in 20-audio.js, middle C
   at 261.63), so a bed in C cannot disagree with a pop or a win however
   they land on it.

   The tempo is not fixed. The film says where its last card arrives,
   and the tempo is whichever one near 104 puts a bar line exactly
   there, so the last chord lands with the name of the game. */
(() => {
  const RATE = 48000;
  const semi = n => 261.63 * Math.pow(2, n / 12);

  /* four bars, round and round: C, A minor, F, G */
  const ARP = [
    [0, 7, 16, 7, 12, 7, 16, 7],
    [-3, 4, 12, 4, 9, 4, 12, 4],
    [-7, 0, 9, 0, 5, 0, 9, 0],
    [-5, 2, 11, 2, 7, 2, 11, 2]
  ];
  const BASS = [-24, -27, -31, -29];
  /* the tune, in beats from the start of a four-bar phrase: two phrases,
     taken in turn, all of it pentatonic */
  const TUNE = [
    [[0, 16, 1], [1.5, 19, .5], [2, 21, 1.5], [4, 19, 1], [5.5, 16, .5], [6, 12, 1.5],
     [8, 21, 1], [9.5, 24, .5], [10, 21, 1.5], [12, 19, 1], [13, 14, 1], [14, 16, 1.5]],
    [[0, 24, 1], [1, 21, .5], [1.5, 19, .5], [2, 16, 1.5], [4, 12, 1], [5, 16, .5], [5.5, 19, .5], [6, 21, 1.5],
     [8, 24, 1.5], [10, 21, 1], [11, 19, 1], [12, 26, 1], [13, 24, 1], [14, 19, 1.5]]
  ];

  function render(total, endAt) {
    const c = new OfflineAudioContext(2, Math.ceil(total * RATE), RATE);
    /* a bar line on the last card */
    const bars = Math.max(1, Math.round(endAt / (240 / 104)));
    const bar = endAt / bars, beat = bar / 4;

    const out = c.createGain(); out.gain.value = 1; out.connect(c.destination);
    /* a little room, so it is not a ringtone */
    const verb = c.createConvolver();
    {
      const n = Math.floor(RATE * 1.3), ir = c.createBuffer(2, n, RATE);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch); let lp = 0;
        for (let i = 0; i < n; i++) { lp = .82 * lp + .18 * (Math.random() * 2 - 1); d[i] = lp * Math.pow(1 - i / n, 2.8); }
      }
      verb.buffer = ir;
    }
    const wet = c.createGain(); wet.gain.value = .5; verb.connect(wet); wet.connect(out);

    const noise = c.createBuffer(1, RATE, RATE);
    { const d = noise.getChannelData(0); for (let i = 0; i < RATE; i++) d[i] = Math.random() * 2 - 1; }

    /* a wooden bar: the note, and its fourth harmonic for the knock */
    const mallet = (t, n, gain, dur, pan, send) => {
      const g = c.createGain(), p = c.createStereoPanner();
      p.pan.value = pan || 0;
      [[1, 1, dur], [4, .22, dur * .22], [10, .05, .04]].forEach(([mult, amp, d]) => {
        const o = c.createOscillator(), e = c.createGain();
        o.type = 'sine'; o.frequency.value = semi(n) * mult;
        e.gain.setValueAtTime(.0001, t);
        e.gain.exponentialRampToValueAtTime(gain * amp, t + .005);
        e.gain.exponentialRampToValueAtTime(.0001, t + d);
        o.connect(e); e.connect(g); o.start(t); o.stop(t + d + .05);
      });
      g.connect(p); p.connect(out);
      const s = c.createGain(); s.gain.value = send === undefined ? .3 : send; p.connect(s); s.connect(verb);
    };
    const bass = (t, n, gain, dur) => {
      const o = c.createOscillator(), o2 = c.createOscillator(), e = c.createGain(), f = c.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = semi(n);
      o2.type = 'sine'; o2.frequency.value = semi(n);
      f.type = 'lowpass'; f.frequency.value = 420;
      e.gain.setValueAtTime(.0001, t);
      e.gain.exponentialRampToValueAtTime(gain, t + .012);
      e.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(f); o2.connect(f); f.connect(e); e.connect(out);
      o.start(t); o2.start(t); o.stop(t + dur + .05); o2.stop(t + dur + .05);
    };
    const shake = (t, gain) => {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), e = c.createGain();
      s.buffer = noise; f.type = 'highpass'; f.frequency.value = 6500;
      e.gain.setValueAtTime(.0001, t);
      e.gain.exponentialRampToValueAtTime(gain, t + .004);
      e.gain.exponentialRampToValueAtTime(.0001, t + .06);
      s.connect(f); f.connect(e); e.connect(out); s.start(t, Math.random() * .5, .08);
    };
    const thump = (t, gain) => {
      const o = c.createOscillator(), e = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(118, t); o.frequency.exponentialRampToValueAtTime(46, t + .13);
      e.gain.setValueAtTime(.0001, t);
      e.gain.exponentialRampToValueAtTime(gain, t + .006);
      e.gain.exponentialRampToValueAtTime(.0001, t + .2);
      o.connect(e); e.connect(out); o.start(t); o.stop(t + .25);
    };

    for (let b = 0; b < bars; b++) {
      const t0 = b * bar, ch = b % 4, ph = Math.floor(b / 4);
      /* the first bar is the arpeggio alone, so the film opens on a
         question and the pulse arrives with the answer */
      const full = b >= 1;
      ARP[ch].forEach((n, i) => mallet(t0 + i * beat / 2, n, i % 4 === 0 ? .13 : .095, .7, (i % 2 ? .28 : -.28), .28));
      if (full) {
        bass(t0, BASS[ch], .1, beat * 1.7);
        bass(t0 + beat * 2.5, BASS[ch] + 12, .06, beat * .8);
        thump(t0, .075); thump(t0 + beat * 2, .05);
        for (let i = 0; i < 8; i++) if (i % 2) shake(t0 + i * beat / 2, i % 4 === 3 ? .034 : .022);
      }
      if (b >= 2) TUNE[ph % 2].forEach(([at, n, d]) => {
        if (Math.floor(at / 4) === ch) mallet(t0 + (at - ch * 4) * beat, n, .17, Math.max(.5, d * beat * 1.6), 0, .45);
      });
    }
    /* the last card: the chord, rolled upward, and left to ring */
    [-24, -12, 0, 4, 7, 12, 16, 19, 24].forEach((n, i) => {
      if (i < 2) bass(endAt, n, .1, 2.2);
      else mallet(endAt + (i - 2) * .055, n, .12, 2.4, (i % 2 ? .3 : -.3), .55);
    });
    thump(endAt, .08);
    shake(endAt, .04);
    out.gain.setValueAtTime(1, Math.max(0, total - .9));
    out.gain.linearRampToValueAtTime(.0001, total);
    return c.startRendering();
  }

  window.BED = async (total, endAt) => {
    const buf = await render(total, endAt);
    const n = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(1);
    const v = new DataView(new ArrayBuffer(44 + n * 4));
    const s = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    s(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); s(8, 'WAVEfmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, RATE, true); v.setUint32(28, RATE * 4, true);
    v.setUint16(32, 4, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) {
      v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
      v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    }
    const u8 = new Uint8Array(v.buffer);
    let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  };
})();
