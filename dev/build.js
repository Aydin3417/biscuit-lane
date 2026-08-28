/* dev/build.js — assembles the source into single-file pages.
     node dev/build.js
   writes
     dev/game.html   the whole app, for testing in a browser
     dev/lab.html    the art / physics / sound bench
   Everything is inlined so both open straight from the filesystem. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const read = p => fs.readFileSync(p, 'utf8');

const css = read(path.join(src, 'style.css'));
const head = read(path.join(src, 'head.html'));
const bodyHtml = read(path.join(src, 'body.html'));
const jsDir = path.join(src, 'js');
const allJs = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();

function bundle(files) {
  return files.map(f => `\n/* ===== ${f} ===== */\n` + read(path.join(jsDir, f))).join('\n');
}
function page(title, theme, extraCss, body, script) {
  return `<!doctype html>
<html lang="en"${theme ? ` data-theme="${theme}"` : ''}>
<head>
<meta charset="utf-8">
${head}
<style>${css}${extraCss || ''}</style>
</head>
<body>
${body}
<script>
${script}
</script>
</body>
</html>`;
}

/* ---------- the game ---------- */
fs.writeFileSync(
  path.join(__dirname, 'game.html'),
  page('Biscuit Lane', null, '', bodyHtml, bundle(allJs)),
  'utf8'
);

/* ---------- the bench ---------- */
/* only the layers the bench exercises: no screens, no boot */
const labModules = allJs.filter(f => parseInt(f, 10) <= 30);

const labCss = `
  body{ background:var(--bg-deep); color:var(--text); padding:0 0 60px; overflow-y:auto; }
  .wrap{ max-width:1100px; margin:0 auto; padding:18px 16px 40px; }
  .labhead{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:18px 0 8px; }
  .labhead h1{ font-size:26px; }
  .card{ background:var(--surface); border:1px solid var(--line-soft); border-radius:18px;
         padding:14px 16px 16px; margin:14px 0; box-shadow:var(--shadow-1); }
  .card h2{ font-size:13px; letter-spacing:.06em; text-transform:uppercase; color:var(--text-dim); margin-bottom:10px; }
  .row{ display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; }
  canvas.demo{ border-radius:14px; background:var(--surface-2); display:block; }
  .lb{ background:var(--surface-2); border:1px solid var(--line); border-radius:999px;
       padding:6px 13px; font-size:13px; font-weight:600; }
  .lb:hover{ background:var(--accent-soft); }
  .btns{ display:flex; gap:7px; flex-wrap:wrap; max-width:360px; }
  .meta{ color:var(--text-faint); font-size:12px; margin-top:8px; font-variant-numeric:tabular-nums; }
  select{ background:var(--surface-2); color:var(--text); border:1px solid var(--line);
          border-radius:8px; padding:5px 8px; font:inherit; }
`;

const labBody = `
<div class="wrap">
  <div class="labhead">
    <h1>Biscuit Lane — bench</h1>
    <button class="lb" id="themeBtn">Day</button>
    <button class="lb" id="musicBtn">Music: off</button>
    <span class="meta" id="pcount"></span>
  </div>

  <div class="card">
    <h2>Tiles — plain, rocket, column, bomb, rainbow</h2>
    <canvas class="demo" id="cTiles"></canvas>
    <div class="meta">Top row: the last three carry the colour-blind pip.</div>
  </div>

  <div class="card">
    <h2>Blockers</h2>
    <canvas class="demo" id="cBlock"></canvas>
    <div class="meta">Crate ×2, crate ×1, mud ×2, mud ×1, ice over a tile, rescue basket.</div>
  </div>

  <div class="card">
    <h2>Pets — idle rigs</h2>
    <canvas class="demo" id="cPets"></canvas>
    <div class="meta">Tap one: it hops, wobbles and speaks. Each shows a different mood.</div>
  </div>

  <div class="row">
    <div class="card">
      <h2>The room</h2>
      <canvas class="demo" id="cRoom"></canvas>
      <div class="row" style="margin-top:10px;align-items:center;gap:10px">
        <select id="roomTheme"></select>
        <input type="range" id="hourSlide" min="0" max="23" value="19" style="width:140px">
        <span class="meta" id="hourLbl">19:00</span>
      </div>
    </div>
    <div class="card">
      <h2>The lane</h2>
      <canvas class="demo" id="cLane"></canvas>
      <div class="meta">Scrolls on its own. Scenery is seeded per level, so it never twitches.</div>
    </div>
  </div>

  <div class="row">
    <div class="card">
      <h2>Effects</h2>
      <canvas class="demo" id="cFx"></canvas>
      <div class="btns" id="fxBtns" style="margin-top:10px"></div>
      <div class="meta">Tap the board to pop a tile where you touch.</div>
    </div>
    <div class="card">
      <h2>Gravity, bounce, squash</h2>
      <canvas class="demo" id="cGrav"></canvas>
      <div class="meta">Real gravity, a small bounce, and squash on landing.</div>
    </div>
  </div>

  <div class="card">
    <h2>Sound</h2>
    <div class="btns" id="sfxBtns" style="max-width:none"></div>
    <div class="meta">Everything synthesised at runtime — no audio files anywhere.</div>
  </div>
</div>`;

fs.writeFileSync(
  path.join(__dirname, 'lab.html'),
  page('Bench', 'light', labCss, labBody, bundle(labModules) + '\n' + read(path.join(__dirname, 'lab.js'))),
  'utf8'
);

console.log('dev/game.html  ' + allJs.length + ' modules');
console.log('dev/lab.html   ' + labModules.length + ' modules');
