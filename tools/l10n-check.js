/* A translation file, held to the source it was made from.

     node tools/l10n-check.js <lang.json> [more.json ...]

   A file is { strings: {key: text}, one: {key: text}, inline: {english: text} }.
   What is checked is what breaks a screen rather than what makes a
   sentence good: every key present and nothing extra, nothing empty,
   every {placeholder} of the English still there and no new one, no
   markup gained or lost, and nothing more than twice as long as the
   English where the English is a label (under twenty-five characters),
   because a button is the one place a long word does damage. */
const fs = require('fs');
const src = require('./l10n-source.js');

const holes = s => (String(s).match(/\{[a-zA-Z]+\}/g) || []).sort().join(' ');
const tags = s => (String(s).match(/<[^>]+>|&[a-z]+;/g) || []).sort().join(' ');

function check(file) {
  const bad = [];
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return ['not JSON: ' + e.message]; }
  const pairs = [];
  const table = (name, want, got) => {
    if (!got || typeof got !== 'object') { bad.push(name + ': missing'); return; }
    Object.keys(want).forEach(k => {
      if (typeof got[k] !== 'string' || !got[k].trim()) bad.push(name + ': no translation for ' + JSON.stringify(k).slice(0, 60));
      else pairs.push([name + '.' + k, want[k], got[k]]);
    });
    Object.keys(got).forEach(k => { if (!(k in want)) bad.push(name + ': unknown key ' + JSON.stringify(k).slice(0, 60)); });
  };
  table('strings', src.strings, data.strings);
  table('one', src.one, data.one);
  const inlineWant = {};
  src.inline.forEach(s => { inlineWant[s] = s; });
  table('inline', inlineWant, data.inline);
  pairs.forEach(([where, en, tr]) => {
    if (holes(en) !== holes(tr)) bad.push(where.slice(0, 50) + ': placeholders differ — ' + holes(en) + ' / ' + holes(tr));
    if (tags(en) !== tags(tr)) bad.push(where.slice(0, 50) + ': markup differs');
    if (en.length < 25 && tr.length > Math.max(14, en.length * 2)) bad.push(where.slice(0, 50) + ': ' + tr.length + ' characters for a label of ' + en.length + ' — ' + JSON.stringify(tr));
  });
  return bad;
}

if (require.main === module) {
  let failed = 0;
  process.argv.slice(2).forEach(f => {
    const bad = check(f);
    console.log(f + ': ' + (bad.length ? bad.length + ' problem(s)' : 'ok'));
    bad.slice(0, 40).forEach(b => console.log('  ' + b));
    if (bad.length) failed++;
  });
  process.exit(failed ? 1 : 0);
}
module.exports = { check };
