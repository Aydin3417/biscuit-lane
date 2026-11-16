/* The store page's English, gathered for a translator.

     node tools/store-source.js <out.json>

   The listing text lives in store/LISTING.md as fenced blocks under
   headings, and the eight slides' copy in store/slides/slides.html.
   A localisation of the page needs all of it at once, with the limits
   App Store Connect enforces, so this reads both and writes one file:
   name (30), subtitle (30), promotional text (170), keywords (100, a
   comma-separated list with no spaces), the description (4000), what
   is new, and for each slide an eyebrow, a two-line headline with the
   emphasised half in [[double brackets]], and a line under it. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'store', 'LISTING.md'), 'utf8');

/* the first fenced block after a marker, after a starting point */
function block(after, marker) {
  const from = md.indexOf(after);
  const at = md.indexOf(marker, from);
  const open = md.indexOf('```', at);
  const close = md.indexOf('```', open + 3);
  return md.slice(md.indexOf('\n', open) + 1, close).trim();
}
const html = fs.readFileSync(path.join(root, 'store', 'slides', 'slides.html'), 'utf8');
const a = html.indexOf('const SLIDES = ['), b = html.indexOf('\n];', a);
const SLIDES = new Function('return ' + html.slice(a + 'const SLIDES = '.length, b + 2))();

const data = {
  limits: { name: 30, subtitle: 30, promo: 170, keywords: 100, description: 4000 },
  name: block('## App Store — English', '**Name**'),
  subtitle: block('## App Store — English', '**Subtitle**'),
  promo: block('## App Store — English', '**Promotional text**'),
  keywords: block('## App Store — English', '**Keywords**'),
  description: block('## Full description', '**English**'),
  whatsnew: block("## What's new", '**English**'),
  slides: SLIDES.map(s => ({ screen: s.screen, eyebrow: s.en.eyebrow || '', h: s.en.h, sub: s.en.sub })),
  turkish_for_context: {
    name: block('## App Store — Türkçe', '**Ad**'),
    subtitle: block('## App Store — Türkçe', '**Altyazı**'),
    keywords: block('## App Store — Türkçe', '**Anahtar kelimeler**')
  }
};
if (require.main === module && process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(data, null, 1));
if (require.main === module) console.log('name ' + data.name.length + ', subtitle ' + data.subtitle.length + ', promo ' + data.promo.length +
  ', keywords ' + data.keywords.length + ', description ' + data.description.length + ', ' + data.slides.length + ' slides');
module.exports = data;
