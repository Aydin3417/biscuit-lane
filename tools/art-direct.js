/* Art direction, as a round trip.

   Gemini looks at the game and judges it against design/DIRECTION.md.
   Not at a mockup of the game, and not at a description of it — at
   screenshots of the built thing, taken from the real interface by
   tools/shots.js, in both themes.

   What comes back is structured: a finding names the screen, says what
   is wrong, says why in terms of the direction, and proposes something
   specific enough to build. Vague praise is filtered out by asking for
   JSON with required fields; "the palette is warm and inviting" cannot
   be expressed in this schema.

   What does NOT come back is art. There are no image files in this game
   and there never will be — the reason is in DIRECTION.md, and it is
   arithmetic rather than taste. Gemini directs; the drawing is Canvas
   code and stays that way.

     node tools/shots.js look          take the pictures first
     node tools/art-direct.js          then ask
     node tools/art-direct.js --shots  do both

   Findings land in design/critique/<n>.json and are printed. Nothing is
   applied automatically: a finding is an argument, and some of them are
   wrong.
*/
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ask, pickModel } = require('./gemini.js');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'shots', 'look');
const OUT = path.join(ROOT, 'design', 'critique');

/* One frame per thing worth judging, and no more: every image is tokens,
   and twenty near-identical boards teach less than one board and one
   room. Ordered so the model meets the game the way a player does. */
const WANTED = [
  ['01-room.png', 'Home. The room upstairs, where the pet lives.'],
  ['02-map.png', 'The lane. Levels are nodes along a road; every tenth is a gate.'],
  ['03-board.png', 'Playing a level. The board sits on the lane scenery.'],
  ['08-levelcard.png', 'The card shown before a level starts.'],
  ['16-lose-sheet.png', 'Losing a level.'],
  ['06-shop.png', 'The shop.'],
  ['07-family.png', 'The family screen: your pets, then adoption, then badges.'],
  ['09-room-dark.png', 'The same room at Dusk.'],
  ['10-map-dark.png', 'The same lane at Dusk.']
];

const SCHEMA = {
  type: 'object',
  properties: {
    verdict: {
      type: 'string',
      description: 'Two sentences at most. What this game looks like right now, said plainly.'
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          screen: { type: 'string', description: 'Which screenshot. Use the filename.' },
          element: { type: 'string', description: 'The specific thing. Not "the layout".' },
          problem: { type: 'string', description: 'What is wrong, in one sentence.' },
          why: { type: 'string', description: 'Which part of the direction it fails, and how.' },
          fix: {
            type: 'string',
            description: 'Something buildable in Canvas 2D or CSS tokens. Name numbers where you can: hex values, ratios, pixel sizes.'
          },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          confidence: { type: 'string', enum: ['sure', 'worth trying', 'a hunch'] }
        },
        required: ['screen', 'element', 'problem', 'why', 'fix', 'severity', 'confidence']
      }
    },
    answers: {
      type: 'array',
      description: 'One entry per standing question in the direction that you can actually answer from these images.',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' }
        },
        required: ['question', 'answer']
      }
    },
    keep: {
      type: 'array',
      description: 'What is already right and must not be lost in fixing the rest.',
      items: { type: 'string' }
    }
  },
  required: ['verdict', 'findings', 'keep']
};

const SYSTEM = `You are the art director on a small premium mobile game.

You are looking at screenshots of the built game, not at mockups. Judge
what is there.

Hold these rules, which come from how the game is made and are not
negotiable:

- There are no image files and there will be none. Every pixel is drawn
  at runtime with Canvas 2D paths, and every colour comes from CSS
  custom properties so both themes work. Never propose a photograph, a
  texture bitmap, an illustration asset, a font that is not already
  loaded, or anything that would ship as a file. Propose geometry,
  colour, proportion, spacing, weight and light.
- The six tile colours are gameplay. Two tiles a player cannot separate
  at a glance is a difficulty bug, not a taste question.
- Everything redraws at 60fps on a phone. Per-tile per-frame gradients
  are not available. Per-layout cost is fine.
- Every colour must work in both a cream Day theme and a dark Dusk one.
- Text contrast is checked and enforced.

Be specific and be willing to be wrong. A finding that names an element,
a number and a reason is worth ten that say something is "clean" or
"could be more dynamic". If something is already right, say so under
keep, because the next round must not break it.

Do not pad the list. Six sharp findings beat twenty soft ones.`;

(async () => {
  if (process.argv.includes('--shots')) {
    console.log('ekran görüntüleri alınıyor…');
    execFileSync(process.execPath, [path.join(__dirname, 'shots.js'), 'look'], { stdio: 'inherit' });
  }

  const parts = [];
  const direction = fs.readFileSync(path.join(ROOT, 'design', 'DIRECTION.md'), 'utf8');
  parts.push('Here is the direction this game is being held to.\n\n' + direction);

  const missing = [];
  parts.push('\nAnd here is the game as it is built today.');
  for (const [file, caption] of WANTED) {
    const p = path.join(SHOTS, file);
    if (!fs.existsSync(p)) { missing.push(file); continue; }
    parts.push('\n' + file + ' — ' + caption);
    parts.push(p);
  }
  if (missing.length) {
    console.error('eksik kare: ' + missing.join(', ') + '\n  önce: node tools/shots.js look');
    if (missing.length === WANTED.length) process.exit(1);
  }

  /* the measured facts, so the critique argues with numbers rather than
     around them */
  let palette = '';
  try {
    palette = execFileSync(process.execPath, [path.join(ROOT, 'test', 'palette.js')],
      { encoding: 'utf8' });
  } catch (e) { palette = (e.stdout || '') + (e.stderr || ''); }
  parts.push('\nThe palette, measured:\n\n' + palette);

  parts.push('\nNow judge it against the direction. Answer the standing questions you can.');

  console.log('model: ' + await pickModel() + ', ' +
    (WANTED.length - missing.length) + ' kare gönderiliyor…');
  const res = await ask(parts, { schema: SCHEMA, temperature: 0.6, system: SYSTEM });

  fs.mkdirSync(OUT, { recursive: true });
  const n = fs.readdirSync(OUT).filter(f => /^\d+\.json$/.test(f)).length + 1;
  const file = path.join(OUT, String(n).padStart(3, '0') + '.json');
  fs.writeFileSync(file, JSON.stringify(res, null, 1) + '\n');

  console.log('\n' + res.verdict + '\n');
  const rank = { high: 0, medium: 1, low: 2 };
  (res.findings || []).sort((a, b) => rank[a.severity] - rank[b.severity]).forEach((f, i) => {
    console.log((i + 1) + '. [' + f.severity + '/' + f.confidence + '] ' +
      f.screen + ' — ' + f.element);
    console.log('   sorun  ' + f.problem);
    console.log('   neden  ' + f.why);
    console.log('   öneri  ' + f.fix + '\n');
  });
  (res.answers || []).forEach(a => console.log('? ' + a.question + '\n  ' + a.answer + '\n'));
  if (res.keep && res.keep.length) {
    console.log('bozulmaması gerekenler:');
    res.keep.forEach(k => console.log('  · ' + k));
  }
  console.log('\n' + file);
})().catch(e => { console.error(e.message); process.exit(1); });
