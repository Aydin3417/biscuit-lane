/* A store page in another language, held to the limits App Store
   Connect enforces and to the shape the slides need.

     node tools/store-check.js store/l10n/<lang>.json [...]

   name 30, subtitle 30, promotional text 170, keywords 100 (commas, no
   spaces around them), description 4000; eight slides in the source's
   order, each with a two-line headline carrying exactly one [[emphasis]]
   and a line under it. */
const fs = require('fs');
const src = require('./store-source.js');

function check(file) {
  const bad = [];
  let d;
  try { d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return ['not JSON: ' + e.message]; }
  const lim = src.limits;
  ['name', 'subtitle', 'promo', 'keywords', 'description', 'whatsnew'].forEach(k => {
    if (typeof d[k] !== 'string' || !d[k].trim()) bad.push(k + ': missing');
    else if (lim[k] && [...d[k]].length > lim[k]) bad.push(k + ': ' + [...d[k]].length + ' characters, limit ' + lim[k]);
  });
  if (typeof d.keywords === 'string' && /,\s|\s,/.test(d.keywords)) bad.push('keywords: spaces around a comma waste characters');
  if (typeof d.name === 'string' && d.name.indexOf('Pawtika') !== 0) bad.push('name: must begin with Pawtika');
  if (!Array.isArray(d.slides) || d.slides.length !== src.slides.length) bad.push('slides: ' + (d.slides ? d.slides.length : 0) + ', expected ' + src.slides.length);
  else d.slides.forEach((s, i) => {
    if (!Array.isArray(s.h) || s.h.length !== 2) bad.push('slide ' + (i + 1) + ': headline must be two lines');
    else if ((s.h.join(' ').match(/\[\[/g) || []).length !== 1 || (s.h.join(' ').match(/\]\]/g) || []).length !== 1) bad.push('slide ' + (i + 1) + ': exactly one [[emphasis]]');
    else if (s.h.some(l => [...l.replace(/\[\[|\]\]/g, '')].length > 28)) bad.push('slide ' + (i + 1) + ': a headline line over 28 characters will not fit — ' + JSON.stringify(s.h));
    if (typeof s.sub !== 'string' || !s.sub.trim()) bad.push('slide ' + (i + 1) + ': no line under the headline');
    else if ([...s.sub].length > 110) bad.push('slide ' + (i + 1) + ': the line under the headline is ' + [...s.sub].length + ' characters, limit 110');
    if (src.slides[i].eyebrow && !(s.eyebrow || '').trim()) bad.push('slide ' + (i + 1) + ': no eyebrow');
  });
  return bad;
}
if (require.main === module) {
  let failed = 0;
  process.argv.slice(2).forEach(f => {
    const bad = check(f);
    console.log(f + ': ' + (bad.length ? bad.length + ' problem(s)' : 'ok'));
    bad.forEach(b => console.log('  ' + b));
    if (bad.length) failed++;
  });
  process.exit(failed ? 1 : 0);
}
module.exports = { check };
