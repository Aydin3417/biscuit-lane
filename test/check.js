/* Static integrity check across the module set.
   The bundle concatenates every module into one scope, so it catches:
     1. the same COLUMN-0 name declared in two files (fatal)
     2. a bare function call with no declaration anywhere
     3. a bundle that does not parse
   Run it after any module is refactored. */
const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, '..', 'src', 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();

/* comments only — safe on any source */
function stripComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1 ');
}

/* strip comments and literals so they cannot fake a match */
function strip(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

const TOP = /^(?:async[ \t]+)?function[ \t]*\*?[ \t]*([A-Za-z_$][\w$]*)|^(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)/gm;
const ANY_DECL = /(?:^|[\s;({[,])(?:async[ \t]+)?function[ \t]*\*?[ \t]*([A-Za-z_$][\w$]*)|(?:^|[\s;({[])(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)/gm;
const METHOD = /^[ \t]{2,}(?:async[ \t]+|get[ \t]+|set[ \t]+)?([A-Za-z_$][\w$]*)[ \t]*\([^()]*\)[ \t]*\{/gm;
const PARAMS = /\(([^()]*)\)[ \t]*(?:=>|\{)/g;
const ARROW1 = /(?:^|[\s(,=])([A-Za-z_$][\w$]*)[ \t]*=>/g;
/* no space before the paren: a real call is `name(`, prose is `hamle (` */
const CALL = /(?<![.:\w$?])([a-zA-Z_$][\w$]*)\(/g;

const BUILTIN = new Set(('if for while switch catch return typeof function new await yield delete void ' +
  'do else try in of instanceof case default break continue throw class extends this super export import ' +
  'Math JSON Object Array Set Map WeakMap Number String Boolean Promise Date RegExp Error Symbol Path2D ' +
  'Float32Array Float64Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array ' +
  'parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent structuredClone queueMicrotask ' +
  'requestAnimationFrame cancelAnimationFrame setTimeout clearTimeout setInterval clearInterval ' +
  'getComputedStyle matchMedia fetch alert confirm prompt console localStorage sessionStorage ' +
  'document window navigator performance location history screen Image Audio Blob URL FileReader ' +
  'AudioContext webkitAudioContext DOMMatrix OffscreenCanvas ResizeObserver IntersectionObserver ' +
  'Infinity NaN undefined null true false constructor').split(/\s+/));

/* names that only ever appear inside css text in template literals */
const CSSFN = new Set(['repeat', 'var', 'calc', 'rgba', 'rgb', 'hsl', 'hsla', 'url', 'translate', 'translateX',
  'translateY', 'translateZ', 'scale', 'scaleX', 'scaleY', 'rotate', 'skew', 'blur', 'brightness',
  'min', 'max', 'clamp', 'linear', 'cubic', 'attr', 'matrix', 'perspective', 'drop', 'saturate',
  'linear-gradient', 'radial-gradient', 'gradient', 'color-mix', 'srgb', 'steps', 'counter', 'env', 'fit-content']);

const topLevel = new Map();
const dupes = [];
const declared = new Set();

files.forEach(f => {
  const raw = fs.readFileSync(path.join(jsDir, f), 'utf8');
  const t = raw;                    /* column-0 anchors need no stripping */
  let m;
  TOP.lastIndex = 0;
  while ((m = TOP.exec(t))) {
    const n = m[1] || m[2];
    if (topLevel.has(n)) dupes.push(`${n}  — ${topLevel.get(n)} and ${f}`);
    else topLevel.set(n, f);
  }
  [ANY_DECL, METHOD].forEach(re => {
    re.lastIndex = 0;
    while ((m = re.exec(t))) { const n = m[1] || m[2]; if (n) declared.add(n); }
  });
  ARROW1.lastIndex = 0;
  while ((m = ARROW1.exec(t))) declared.add(m[1]);
  PARAMS.lastIndex = 0;
  while ((m = PARAMS.exec(t))) {
    m[1].split(',').forEach(a => {
      const n = a.trim().replace(/^\.\.\./, '').split(/[=:\s)]/)[0];
      if (/^[A-Za-z_$][\w$]*$/.test(n)) declared.add(n);
    });
  }
});
topLevel.forEach((f, n) => declared.add(n));

const missing = new Map();
files.forEach(f => {
  /* raw, not stripped: the literal-stripper cannot survive nested template
     literals and was silently swallowing whole spans of the ui module,
     which turned real missing calls into false passes */
  const t = fs.readFileSync(path.join(jsDir, f), 'utf8');
  let m;
  CALL.lastIndex = 0;
  while ((m = CALL.exec(t))) {
    const n = m[1];
    if (BUILTIN.has(n) || declared.has(n) || CSSFN.has(n)) continue;
    if (!missing.has(n)) missing.set(n, f);
  }
});

let bad = 0;
console.log(files.length + ' modules, ' + topLevel.size + ' top-level names');
if (dupes.length) { bad = 1; console.log('\nDUPLICATE TOP-LEVEL NAMES (fatal):'); dupes.forEach(d => console.log('  ' + d)); }
else console.log('no duplicate top-level names');

if (missing.size) { bad = 1; console.log('\nUNDECLARED FUNCTIONS CALLED:'); missing.forEach((f, n) => console.log(`  ${n}()  in ${f}`)); }
else console.log('every called function resolves');

const bundle = path.join(__dirname, '..', 'biscuit-lane.html');
if (fs.existsSync(bundle)) {
  const html = fs.readFileSync(bundle, 'utf8');
  const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</' + 'script>'));
/* ---------------- the other direction ----------------
   Calls with no declaration are a fatal error; declarations with no call
   are only a smell, so this reports rather than fails. It is worth
   reporting: two of the ones this found first time sat in the engine
   looking exactly like the rule for breaking a crate, and were not it. */
/* Read from the source exactly as written. Both strippers mangle this
   file set — `strip` swallows the markup-heavy template literals along
   with real code, and even comment removal costs enough call sites to
   fill the report with functions that are called on the next line. A
   name that appears only in a comment counts as used here, which is the
   safe direction to be wrong in for something that only reports. */
const declaredFns = [];
files.forEach(f => {
  const t = fs.readFileSync(path.join(jsDir, f), 'utf8');
  let m;
  const re = /^(?:async[ \t]+)?function[ \t]*\*?[ \t]*([A-Za-z_$][\w$]*)/gm;
  while ((m = re.exec(t))) declaredFns.push([m[1], f]);
});
const allSrc = files.map(f => fs.readFileSync(path.join(jsDir, f), 'utf8')).join(String.fromCharCode(10));
const unused = declaredFns.filter(([n]) =>
  allSrc.split(new RegExp('(?<![.\\w$])' + n + '(?![\\w$])')).length - 1 <= 1);
if (unused.length) {
  console.log('declared and never called (' + unused.length + ', not an error):');
  unused.forEach(([n, f]) => console.log('  ' + n + '  in ' + f));
} else {
  console.log('no function is declared and never called (' + declaredFns.length + ' checked)');
}

/* ---------------- data tables ----------------
   A closed set of static objects, so a dotted reference into one can be
   checked against what it actually holds. This is the check that was
   missing when GEN.collect.goal was deleted out from under its callers. */
function objectAt(src, open) {
  /* balanced braces from `open`, which points at the { */
  let depth = 0, i = open, inStr = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (!depth) return src.slice(open, i + 1); }
  }
  return null;
}
/* Keys of a data table.

   The keys are read off the source layout rather than by parsing
   JavaScript, which is simpler and much harder to get subtly wrong.
   Two passes: every `name:` at the top level of the literal, in any of
   the shapes these tables are written in, and then the child keys of any
   value that is a small object written out on one line — which is the
   shape of GEN, the table that broke.

   Its whole job is to know that GEN.collect has no key called goal. */
function keyTree(body) {
  const out = {};
  let m;
  const top = /(?:^  |[{,][ \t]*)([A-Za-z_$][\w$]*)[ \t]*:/gm;
  while ((m = top.exec(body))) out[m[1]] = null;
  /* a method: `pop(x, y) {` */
  const meth = /^  (?:async[ \t]+|get[ \t]+|set[ \t]+)?([A-Za-z_$][\w$]*)[ \t]*\(/gm;
  while ((m = meth.exec(body))) out[m[1]] = null;
  /* a name carried in from elsewhere, alone or among others on the line:
     `shake, punchZoom, wave,` and `sweep, pulse, drawBands: bandsDraw,` */
  const shortLine = /^  ([^\n]*)$/gm;
  while ((m = shortLine.exec(body))) {
    m[1].split(',').forEach(piece => {
      const w = piece.match(/^[ \t]*([A-Za-z_$][\w$]*)[ \t]*$/);
      if (w) out[w[1]] = null;
    });
  }
  /* `mud: { fill: .58, deep: .45 },` — one line, so its keys are certain */
  const nested = /^  ([A-Za-z_$][\w$]*)[ \t]*:[ \t]*\{([^{}]*)\},?[ \t]*$/gm;
  while ((m = nested.exec(body))) {
    if (/=>|function/.test(m[2])) continue;
    const kids = [];
    const kre = /(?:^|,)[ \t]*([A-Za-z_$][\w$]*)[ \t]*:/g;
    let k;
    while ((k = kre.exec(m[2]))) kids.push(k[1]);
    if (kids.length) out[m[1]] = kids;
  }
  return out;
}

const tables = {};
const bodies = {};
files.forEach(f => {
  const src = strip(fs.readFileSync(path.join(jsDir, f), 'utf8'));
  const re = /^const[ \t]+([A-Z][A-Z0-9_]+)[ \t]*=[ \t]*\{/gm;
  let m;
  while ((m = re.exec(src))) {
    const body = objectAt(src, src.indexOf('{', m.index));
    if (body) { tables[m[1]] = keyTree(body); bodies[m[1]] = body; }
  }
});
/* a key can also arrive by assignment */
const whole = files.map(f => stripComments(fs.readFileSync(path.join(jsDir, f), 'utf8'))).join('\n');
Object.keys(tables).forEach(name => {
  const re = new RegExp('\\b' + name + '\\.([A-Za-z_$][\\w$]*)\\s*=[^=]', 'g');
  let m;
  while ((m = re.exec(whole))) if (!(m[1] in tables[name])) tables[name][m[1]] = null;
});

const tableProblems = [];
let checked = 0;
const checkedNames = [];
Object.keys(tables).forEach(name => {
  const tree = tables[name];
  if (!Object.keys(tree).length) return;
  /* A table that is written into is state, not a table: its keys move
     about at runtime and nothing static can be said about them. A table
     holding functions is fine — a function is a key like any other. */

  if (new RegExp('(?<![.\\w$])' + name + '\\.[A-Za-z_$][\\w$]*\\s*[-+*/|&?]{0,2}=[^=]').test(whole)) return;
  checked++;
  checkedNames.push(name);
  const re = new RegExp('(?<![.\\w$])' + name + '\\.([A-Za-z_$][\\w$]*)(?:\\.([A-Za-z_$][\\w$]*))?', 'g');
  let m;
  while ((m = re.exec(whole))) {
    const a = m[1], b = m[2];
    if (!(a in tree)) { tableProblems.push(name + '.' + a + ' — no such key'); continue; }
    const kids = tree[a];
    if (b && Array.isArray(kids) && kids.length && !kids.includes(b)) {
      tableProblems.push(name + '.' + a + '.' + b + ' — ' + name + '.' + a +
        ' holds ' + kids.join(', '));
    }
  }
});
const uniqueTable = [...new Set(tableProblems)];
if (uniqueTable.length) {
  console.log('DEAD REFERENCES INTO A DATA TABLE (' + uniqueTable.length + '):');
  uniqueTable.forEach(t => console.log('  ' + t));
  bad = true;
} else {
  console.log('every data-table reference resolves (' + checked + ' tables: ' + checkedNames.join(', ') + ')');
}

/* ---------------- the two language books ----------------

   Two things worth knowing about STRINGS that nothing checked before.

   Parity: every key has to be written twice, once per language, and a
   key present in one book and missing from the other shows up as a
   blank in the interface rather than as an error.

   Orphans: a key with no caller is a translation being maintained for
   nothing, and a reliable fossil of a rule that was removed — home_tired
   outlived "a tired pet refuses to play" by exactly one commit.

   Keys are not always literal: moodOf() returns a word that becomes
   'mood_' + it. So a prefix used in a concatenation vouches for every
   key beginning with it. */
{
  const chr10 = String.fromCharCode(10);
  const src = fs.readFileSync(path.join(jsDir, '05-i18n.js'), 'utf8');
  const book = tag => {
    const at = src.indexOf(chr10 + '  ' + tag + ': {');
    if (at < 0) return null;
    /* to the line that closes this book at the same indent */
    const rest = src.slice(at);
    const end = rest.search(/^  \},?\s*$/m);
    const body = rest.slice(0, end < 0 ? rest.length : end);
    const out = new Set();
    let m;
    const re = /(?:^\s{4}|[{,]\s*)([A-Za-z_$][\w$]*)\s*:/gm;
    while ((m = re.exec(body))) out.add(m[1]);
    return out;
  };
  const EN = book('en'), TR = book('tr');
  if (!EN || !TR) {
    console.log('COULD NOT READ THE LANGUAGE BOOKS'); bad = true;
  } else {
    const onlyEn = [...EN].filter(k => !TR.has(k));
    const onlyTr = [...TR].filter(k => !EN.has(k));
    if (onlyEn.length || onlyTr.length) {
      console.log('THE TWO LANGUAGES DISAGREE:');
      onlyEn.forEach(k => console.log('  ' + k + ' — English only'));
      onlyTr.forEach(k => console.log('  ' + k + ' — Turkish only'));
      bad = true;
    } else {
      console.log('both languages carry the same ' + EN.size + ' keys');
    }
    const used = new Set();
    const prefixes = [];
    let m;
    const lit = /\bT\(\s*'([A-Za-z0-9_$]+)'/g;
    while ((m = lit.exec(whole))) used.add(m[1]);
    const say = /\b(?:say|toast|tut|T)\(\s*'([A-Za-z0-9_$]+)'/g;
    while ((m = say.exec(whole))) used.add(m[1]);
    /* T('mood_' + x) style construction, and keys handed about as data */
    const cat = /'([A-Za-z0-9_$]+_)'\s*\+/g;
    while ((m = cat.exec(whole))) prefixes.push(m[1]);
    const quoted = /'([A-Za-z0-9_$]+)'/g;
    while ((m = quoted.exec(whole))) if (EN.has(m[1])) used.add(m[1]);
    const orphans = [...EN].filter(k =>
      !used.has(k) && !prefixes.some(p => k !== p && k.startsWith(p)));
    if (orphans.length) {
      console.log('STRINGS NOBODY SHOWS (' + orphans.length + '):');
      orphans.forEach(k => console.log('  ' + k));
      bad = true;
    } else {
      console.log('every string has a caller');
    }
  }
}
  try { new Function(js); console.log('bundle parses (' + (js.length / 1024).toFixed(0) + ' KB of js)'); }
  catch (e) { bad = 1; console.log('BUNDLE SYNTAX ERROR: ' + e.message); }
}
process.exitCode = bad ? 1 : 0;
