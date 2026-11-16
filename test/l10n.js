/* The five languages that are not written in the source.

   English and Turkish sit beside the things they name and are held to
   each other by test/strings.js. Spanish, German, French, Portuguese
   and Italian arrive as files (src/l10n/<lang>.json) and reach the game
   through one generated module, so there are three ways for them to go
   wrong that nothing else would notice:

     a file falls behind the English — a key added, a sentence reworded
       — and the game quietly shows English in the middle of a Spanish
       screen (loc() and T() both fall back rather than fail);
     the generated module falls behind the files;
     a language is in the picker (LANGS, 00-util.js) with no table
       behind it, or has a table and is not in the picker.

     node test/l10n.js
*/
const fs = require('fs');
const path = require('path');
const { check } = require('../tools/l10n-check.js');
const { build } = require('../tools/l10n-build.js');

const root = path.join(__dirname, '..');
let bad = 0;
const ok = (cond, name, why) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : '   ' + why)); if (!cond) bad++; };

const dir = path.join(root, 'src', 'l10n');
const files = fs.readdirSync(dir).filter(f => /^[a-z]{2}\.json$/.test(f));
files.forEach(f => {
  const problems = check(path.join(dir, f));
  ok(problems.length === 0, f + ' carries every string, placeholder for placeholder', problems.length + ' problem(s): ' + problems.slice(0, 3).join(' | '));
});

const made = build();
const onDisk = fs.readFileSync(path.join(root, 'src', 'js', '06-l10n.js'), 'utf8');
ok(made.text === onDisk, 'src/js/06-l10n.js is what the files build', 'stale: run node tools/l10n-build.js');
ok(made.left.length === 0, 'no language was left out of the build', made.left.join('; '));

const util = fs.readFileSync(path.join(root, 'src', 'js', '00-util.js'), 'utf8');
const picker = (util.match(/const LANGS = \[([\s\S]*?)\];/) || ['', ''])[1].match(/\['([a-z]{2})'/g).map(x => x.slice(2, 4));
const built = files.map(f => f.slice(0, 2)).sort();
const offered = picker.filter(l => l !== 'en' && l !== 'tr').sort();
ok(JSON.stringify(built) === JSON.stringify(offered), 'the picker offers exactly the languages that have a table (' + offered.join(', ') + ')',
  'picker: ' + offered.join(',') + ' — files: ' + built.join(','));

console.log(bad ? '\n' + bad + ' failed' : '\nfive more languages, all whole');
process.exit(bad ? 1 : 0);
