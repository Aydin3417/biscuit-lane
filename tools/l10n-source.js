/* What a translator needs, in one file.

   The game's text lives in three places: the string table (05-i18n.js),
   its singular forms (ONE), and sentences the data tables carry inline
   as en/tr pairs — breed names, badge descriptions, the stray tales.
   The third kind is found by reading the source for `en:` and its
   siblings, because half of it is built inside functions and cannot be
   walked as data. Other languages look those sentences up by their
   English (XLATE, 05-i18n.js), so the English is the key and this is
   the list of keys.

     node tools/l10n-source.js <out.json>
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const out = require.main === module ? process.argv[2] : null;
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'src/js/05-i18n.js'), 'utf8') +
  ';globalThis.__S = STRINGS; globalThis.__O = ONE;', ctx);

const STR = `('(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*")`;
const reEn = new RegExp('\\b(en|enDesc|enHow|enUnit|enDog|ph|phDog)\\s*:\\s*' + STR, 'g');
const reTr = new RegExp('\\b(tr|trDesc|trHow|trUnit|phTr)\\s*:\\s*' + STR);
const inline = [], seen = new Set(), trOf = {};
fs.readdirSync(path.join(root, 'src/js')).filter(f => f.endsWith('.js') && !/^0[56]-/.test(f)).forEach(f => {
  const src = fs.readFileSync(path.join(root, 'src/js', f), 'utf8');
  let m;
  while ((m = reEn.exec(src))) {
    let v;
    try { v = vm.runInNewContext(m[2]); } catch (e) { continue; }
    if (typeof v !== 'string' || !v.trim() || seen.has(v)) continue;
    /* a locale code is not a sentence: NUM_LOCALES in 00-util.js has an `en:` of its own */
    if (/^[a-z]{2}-[A-Z]{2}$/.test(v)) continue;
    seen.add(v);
    inline.push(v);
    /* the Turkish that follows it, as context */
    const after = src.slice(m.index, m.index + 600).match(reTr);
    if (after) { try { trOf[v] = vm.runInNewContext(after[2]); } catch (e) { } }
  }
});
const data = { strings: ctx.__S.en, strings_tr: ctx.__S.tr, one: ctx.__O.en, inline: inline, inline_tr: trOf };
/* Only when run as a tool. This file is also required by l10n-check.js,
   and argv[2] is then the translation being checked: for its first day
   the checker overwrote every file it was asked to check with this dump
   and reported 536 problems in what it had just written. All five
   translators met it. */
if (require.main === module) {
  if (out) fs.writeFileSync(out, JSON.stringify(data, null, 1));
  console.log(Object.keys(data.strings).length + ' keys, ' + Object.keys(data.one).length + ' singular forms, ' + inline.length + ' inline sentences');
}
module.exports = data;
