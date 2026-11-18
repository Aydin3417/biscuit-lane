/* Films one advertisement: stage.html, a frame at a time.

     node store/ads/record.js basket tr          ->  out/basket-tr.mp4
     node store/ads/record.js basket en --look   ->  out/look/basket-en-*.jpg

   The page does not run in real time while this is filming. clock.js
   hands its clock to this loop, which moves the game on by a sixtieth of
   a second, photographs it, and moves it on again; the sound is rendered
   by the game's own synthesiser in step with the frames. --look keeps a
   small photograph every quarter second and makes no film: that is for
   reading a film while writing it.

   Needs ffmpeg on the path. */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { launch, at, serve } = require('../../tools/_pw.js');

const args = process.argv.slice(2);
const flag = n => args.includes('--' + n);
const opt = (n, d) => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : d; };
const [film = 'basket', lang = 'en'] = args.filter(a => !a.startsWith('--'));
const LOOK = flag('look');
const FPS = +opt('fps', 30);
const EVERY = Math.round(60 / FPS);
const SEED = opt('seed', '');
const LOOK_EVERY = +opt('every', 15);
const CTA = opt('cta', '');

const OUT = path.join(__dirname, 'out');
const name = `${film}-${lang}${CTA ? '-' + CTA : ''}`;
const frames = path.join(OUT, LOOK ? 'look' : 'frames-' + name);

(async () => {
  /* a look at one film leaves the looks at the others alone */
  if (LOOK) { if (fs.existsSync(frames)) fs.readdirSync(frames).filter(x => x.startsWith(name + '-')).forEach(x => fs.rmSync(path.join(frames, x))); }
  else fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  const srv = await serve();
  const browser = await launch();
  const ctx = await browser.newContext({
    viewport: { width: 540, height: 960 }, deviceScaleFactor: LOOK ? 1 : 2,
    serviceWorkers: 'block', locale: lang === 'tr' ? 'tr-TR' : 'en-US'
  });
  await ctx.addInitScript({ path: path.join(__dirname, 'clock.js') });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text().slice(0, 300)); });
  page.on('pageerror', e => console.log('[page]', String(e).slice(0, 300)));
  await page.goto(at(`/store/ads/stage.html?film=${film}&lang=${lang}${SEED ? '&seed=' + SEED : ''}${CTA ? '&cta=' + CTA : ''}`), { waitUntil: 'load' });
  await page.waitForFunction(() => window.AD && window.AD.ready, null, { timeout: 30000 });
  const cdp = await ctx.newCDPSession(page);

  await page.evaluate(() => AD.start());
  const t0 = Date.now();
  let kept = 0, last = { n: 0 };
  for (let guard = 0; guard < 60 * 240; guard++) {
    const r = await page.evaluate(() => AD.tick());
    if (r.err) { console.error(r.err); break; }
    if (r.rec && r.n !== last.n) {
      const every = LOOK ? LOOK_EVERY : EVERY;
      if (r.n % every === 0) {
        const shot = await cdp.send('Page.captureScreenshot', LOOK
          ? { format: 'jpeg', quality: 72 }
          /* the clip is what makes this 1080 x 1920: asked for without one,
             the page drawn at 2x comes back at 540 x 960, and the first six
             films were written at half size before anybody measured one */
          : { format: 'png', optimizeForSpeed: true, clip: { x: 0, y: 0, width: 540, height: 960, scale: 2 } });
        const file = LOOK ? `${name}-${(r.n / 60).toFixed(2).padStart(6, '0')}.jpg` : String(kept).padStart(5, '0') + '.png';
        fs.writeFileSync(path.join(frames, file), Buffer.from(shot.data, 'base64'));
        kept++;
      }
    }
    last = r;
    if (r.done) break;
  }
  const marks = await page.evaluate(() => AD.marks);
  const secs = last.n / 60;
  console.log(`${name}: ${secs.toFixed(2)} s, ${kept} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s to film`);
  marks.forEach(m => console.log('  ' + m.at.toFixed(2).padStart(6) + '  ' + m.name));

  if (!LOOK) {
    const b64 = await page.evaluate(() => AD.wav());
    const wav = path.join(OUT, name + '-sfx.wav');
    if (!b64) throw new Error('the game made no sound');
    fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
    /* the music is written once the film knows how long it is and where
       its last card arrives (bed.js) */
    const end = marks.find(m => m.name === 'end');
    const bed = path.join(OUT, name + '-bed.wav');
    fs.writeFileSync(bed, Buffer.from(await page.evaluate(([t, e]) => BED(t, e), [secs, end ? end.at + .3 : secs - 2]), 'base64'));

    /* H.264 high, yuv420p, AAC: what every ad manager and the App Store
       take. Two films from one set of frames: the game's own sounds over
       the bed, and the game's own sounds alone, for laying a platform's
       licensed track over. Both are brought to the level a feed plays at. */
    const video = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-r', String(FPS), '-movflags', '+faststart', '-t', secs.toFixed(3)];
    const sound = ['-c:a', 'aac', '-b:a', '256k', '-ar', '48000'];
    const fade = `afade=t=out:st=${Math.max(0, secs - .6).toFixed(2)}:d=0.6`;
    const cuts = [
      [name + '.mp4', ['-i', wav, '-i', bed, '-filter_complex',
        `[1:a]volume=1.5[s];[2:a]volume=${opt('bed', '0.8')}[b];[s][b]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,${fade}[a]`, '-map', '0:v', '-map', '[a]']],
      [name + '-sfx.mp4', ['-i', wav, '-af', `loudnorm=I=-18:TP=-1.5:LRA=11,${fade}`]]
    ];
    for (const [file, audio] of cuts) {
      const mp4 = path.join(OUT, file);
      const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, '%05d.png'),
        ...audio, ...video, ...sound, mp4], { stdio: 'inherit' });
      if (r.status !== 0) { console.error('ffmpeg failed on ' + file); process.exitCode = 1; }
      else console.log(mp4 + '  ' + (fs.statSync(mp4).size / 1048576).toFixed(1) + ' MB');
    }
    /* the still a feed shows before the film plays: the headline has
       arrived and nothing has been pressed yet */
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(frames, String(Math.round(FPS * 1.1)).padStart(5, '0') + '.png'),
      '-q:v', '2', path.join(OUT, name + '-cover.jpg')], { stdio: 'inherit' });
    if (!process.exitCode && !flag('keep')) {
      fs.rmSync(frames, { recursive: true, force: true });
      fs.rmSync(wav, { force: true }); fs.rmSync(bed, { force: true });
    }
  }
  await browser.close();
  srv.stop();
})().catch(e => { console.error(e); process.exit(1); });
