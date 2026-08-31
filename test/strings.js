/* Every string the game can show, checked against every string it has.

   Three ways this file has gone wrong before, each of which shipped:
   a key added to English and forgotten in Turkish, so a Turkish player
   saw a raw key; a string written, wired to nothing, and left sitting in
   the table for months; and a sentence whose {placeholder} was dropped
   in translation, so the number never appeared.

   Word boundaries here are found by hand rather than by regex. That is
   not a style choice — a backslash escape written into this file from a
   shell heredoc collapses, and a \b that silently becomes a backspace
   character makes every key look unused. It has done exactly that. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'src');

const src = fs.readFileSync(path.join(root, 'js', '05-i18n.js'), 'utf8');

/* the body of one language table, by brace matching */
function tableOf(code) {
  const at = src.indexOf(code + ': {');
  if (at < 0) throw new Error(code + ' tablosu yok');
  let depth = 0;
  for (let i = src.indexOf('{', at); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(at, i);
  }
  throw new Error(code + ' tablosu kapanmıyor');
}
const LANGS = [...src.matchAll(/^ {2}([a-z]{2}): \{/gm)].map(m => m[1]);
const body = {}, keys = {};
LANGS.forEach(c => {
  body[c] = tableOf(c);
  keys[c] = [...body[c].matchAll(/^ {4}([A-Za-z0-9_]+):/gm)].map(m => m[1]);
});

const isWord = c => /[A-Za-z0-9_$]/.test(c);
function mentions(hay, word) {
  let i = -1;
  while ((i = hay.indexOf(word, i + 1)) >= 0) {
    const before = i > 0 ? hay[i - 1] : ' ';
    const after = hay[i + word.length] || ' ';
    if (!isWord(before) && !isWord(after)) return true;
  }
  return false;
}

const other = fs.readdirSync(path.join(root, 'js'))
  .filter(f => f !== '05-i18n.js')
  .map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8'))
  .concat(['body.html', 'head.html'].map(f => fs.readFileSync(path.join(root, f), 'utf8')))
  .join('\n');

const valueOf = (code, k) => {
  const m = body[code].match(new RegExp('^ {4}' + k + ': (.+)$', 'm'));
  return m ? m[1] : '';
};
const holes = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

const faults = [];
const base = LANGS[0];

LANGS.slice(1).forEach(c => {
  keys[base].filter(k => keys[c].indexOf(k) < 0)
    .forEach(k => faults.push(c + ' dilinde eksik: ' + k));
  keys[c].filter(k => keys[base].indexOf(k) < 0)
    .forEach(k => faults.push(c + ' dilinde fazla: ' + k));
  keys[base].filter(k => keys[c].indexOf(k) >= 0 && holes(valueOf(base, k)) !== holes(valueOf(c, k)))
    .forEach(k => faults.push(k + ': yer tutucular uyuşmuyor (' +
      base + ' "' + holes(valueOf(base, k)) + '" / ' + c + ' "' + holes(valueOf(c, k)) + '")'));
});

/* Not every key is written out in full where it is used. moodLine asks
   for T('mood_' + moodOf(p)), so mood_hungry appears nowhere in the
   source and is shown constantly. Any literal that ends in an
   underscore and is being concatenated is a family of keys, and the
   whole family counts as reached — the first version of this check
   reported all six moods as dead strings, which was a fault in the
   check and not in the game. */
const families = [...other.matchAll(/'([A-Za-z0-9_]+_)' *\+/g)].map(m => m[1]);
const reached = k => mentions(other, k) || families.some(f => k.indexOf(f) === 0);

/* A key nothing asks for is either a feature that was never wired up or
   a string left behind by one that was removed. Both are worth knowing
   about; neither is worth failing a build over on its own. */
const orphans = keys[base].filter(k => !reached(k));

console.log(LANGS.map(c => c + ' ' + keys[c].length).join(' / ') + ' anahtar');
if (orphans.length) console.log('kimsenin istemediği (' + orphans.length + '): ' + orphans.join(', '));
faults.forEach(f => console.log('  ✗ ' + f));
console.log(faults.length ? faults.length + ' sorun' : 'diller tutarlı');
process.exit(faults.length ? 1 : 0);
