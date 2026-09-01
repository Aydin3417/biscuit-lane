/* Which module reaches into which.

   The bundle concatenates fifteen files into one scope, so every
   top-level name is visible to every other file whether or not that was
   intended. The layering in the README — the engine does no drawing,
   the art knows no rules — is a convention held up by whoever is
   reading, and nothing has ever checked it.

   This reports the graph: for each module, the names it uses that
   another module declares. A cycle here is what decides whether the
   file split is a real architecture or only an order of concatenation.

     node test/deps.js               the matrix and the cycles
     node test/deps.js --edges       every crossing, with counts
     node test/deps.js --names A B   which names A takes from B
     node test/deps.js --shadows     names skipped as locals

   Exits 1 on any cycle not in KNOWN at the bottom of this file.

   One blind spot, stated because a check whose limits are not written
   down gets trusted past them. A name a file declares locally is not
   counted as a crossing, because 30-engine.js writes `const G` inside
   findMatches and 40-game.js calls its own state G — reading that as a
   dependency would have sent a refactor at the one module that is
   already clean. The cost is that a real reference to game's G *from*
   the engine would also be invisible.

   --shadows lists every name this applies to, and the list is meant to
   be read rather than trusted. It caught its own bug: `if (SCREEN ===
   'map') {` parsed as a parameter list, which marked SCREEN local to
   70-boot.js and hid a real reference from the boot into the interface.
   A check that reports clean because it stopped looking is worse than
   no check. There are six now, all of them loop counters and locals. */
const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, '..', 'src', 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();
const short = f => f.replace(/^\d+-/, '').replace(/\.js$/, '');

/* ---------------------------------------------------------------
   A scanner, not a regex.

   check.js says of its own literal stripper that it "cannot survive
   nested template literals and was silently swallowing whole spans of
   the ui module". That is exactly the failure that would matter here:
   60-ui.js is the largest file and the one most full of template
   literals, so a stripper that gives up inside one would report it as
   depending on nothing at all.

   This walks the text once, tracking what it is inside. Comments and
   string bodies are blanked; the expressions inside a template hole are
   kept, because those are real code holding real references.
   --------------------------------------------------------------- */
function code(src) {
  const out = [];
  const tpl = [];                    /* brace depth at each open template */
  let i = 0, state = 'code', depth = 0;
  const keep = ch => out.push(ch);
  const drop = ch => out.push(ch === '\n' ? '\n' : ' ');
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (state === 'code') {
      if (c === '/' && d === '*') { state = 'block'; drop(c); drop(d); i += 2; continue; }
      if (c === '/' && d === '/') { state = 'line'; drop(c); drop(d); i += 2; continue; }
      if (c === "'") { state = 'sq'; drop(c); i++; continue; }
      if (c === '"') { state = 'dq'; drop(c); i++; continue; }
      if (c === '`') { state = 'tpl'; tpl.push(depth); drop(c); i++; continue; }
      if (c === '{') depth++;
      if (c === '}') {
        /* a closing brace at the depth a template hole opened at ends
           the hole rather than a block */
        if (tpl.length && depth === tpl[tpl.length - 1]) { state = 'tpl'; drop(c); i++; continue; }
        depth--;
      }
      keep(c); i++; continue;
    }
    if (state === 'block') {
      if (c === '*' && d === '/') { state = 'code'; drop(c); drop(d); i += 2; continue; }
      drop(c); i++; continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; keep(c); i++; continue; }
      drop(c); i++; continue;
    }
    if (state === 'sq' || state === 'dq') {
      if (c === '\\') { drop(c); i++; if (i < src.length) { drop(src[i]); i++; } continue; }
      if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"')) { state = 'code'; drop(c); i++; continue; }
      drop(c); i++; continue;
    }
    /* inside a template body */
    if (c === '\\') { drop(c); i++; if (i < src.length) { drop(src[i]); i++; } continue; }
    if (c === '`') { state = 'code'; tpl.pop(); drop(c); i++; continue; }
    if (c === '$' && d === '{') { state = 'code'; depth++; drop(c); keep(d); i += 2; continue; }
    drop(c); i++;
  }
  return out.join('');
}

/* column-0 declarations: the same rule the bundle's single scope uses */
const TOP = /^(?:async[ \t]+)?function[ \t]*\*?[ \t]*([A-Za-z_$][\w$]*)|^(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)/gm;

/* Declarations at any depth, so a local can be told from a reference.
   Without this the tool reports that the engine reaches into the game's
   state object, because findMatches writes `const G = groups[g]` and the
   game happens to call its own state G. That is a local shadowing a
   global, not a dependency, and reading it as one would have sent a
   refactor at the one module that is already clean. */
const DECL = /(?:^|[\s;({[,])(?:async[ \t]+)?function[ \t]*\*?[ \t]*([A-Za-z_$][\w$]*)|(?:^|[\s;({[])(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)/gm;
/* a shorthand method in an object literal is a declaration, not a use:
   `emit(ev, arg) {` inside EV is not a reference to the particle
   emitter that happens to share the name */
const METHOD = /^[ \t]{2,}(?:async[ \t]+|get[ \t]+|set[ \t]+)?([A-Za-z_$][\w$]*)[ \t]*\([^()]*\)[ \t]*\{/gm;
/* A parameter list, and not `if (SCREEN === 'map') {`.

   The word before the paren is captured so control flow can be told
   from a signature. Without that check this reads SCREEN as a parameter
   of something, marks it local to 70-boot.js, and hides a real
   reference from boot into the interface — a false clean bill, which is
   the one kind of wrong answer a check like this must not give. */
const PARAMS = /(\w*)[ \t]*\(([^()]*)\)[ \t]*(?:=>|\{)/g;
const CONTROL = new Set(['if', 'for', 'while', 'switch', 'catch', 'do', 'return', 'typeof']);
const ARROW1 = /(?:^|[\s(,=])([A-Za-z_$][\w$]*)[ \t]*=>/g;
const CATCH = /catch[ \t]*\([ \t]*([A-Za-z_$][\w$]*)/g;

const owner = new Map();
const clean = new Map();
const local = new Map();
files.forEach(f => {
  const raw = fs.readFileSync(path.join(jsDir, f), 'utf8');
  const text = code(raw);
  clean.set(f, text);
  let m; TOP.lastIndex = 0;
  while ((m = TOP.exec(raw))) {
    const n = m[1] || m[2];
    if (!owner.has(n)) owner.set(n, f);
  }
  const mine = new Set();
  [DECL, METHOD, ARROW1, CATCH].forEach(re => {
    re.lastIndex = 0;
    while ((m = re.exec(text))) { const n = m[1] || m[2]; if (n) mine.add(n); }
  });
  PARAMS.lastIndex = 0;
  while ((m = PARAMS.exec(text))) {
    if (CONTROL.has(m[1])) continue;
    m[2].split(',').forEach(a => {
      const n = a.trim().replace(/^\.\.\./, '').split(/[=:\s)]/)[0];
      if (/^[A-Za-z_$][\w$]*$/.test(n)) mine.add(n);
    });
  }
  local.set(f, mine);
});
/* a name this file itself declares at column 0 is its own, not a local
   shadow of somebody else's */
files.forEach(f => { local.get(f).forEach(n => { if (owner.get(n) === f) local.get(f).delete(n); }); });

/* A reference is an identifier that is neither a property access nor an
   object-literal key: `t.score` and `{ score: 1 }` are not uses of a
   top-level `score`. */
const REF = /(?<![.\w$])([A-Za-z_$][\w$]*)(?!\s*:)/g;

const edges = new Map();                  /* "from>to" -> Map(name -> uses) */
const shadowed = new Map();               /* file -> Set(name) skipped as local */
files.forEach(f => {
  const text = clean.get(f);
  const mine = local.get(f);
  shadowed.set(f, new Set());
  let m; REF.lastIndex = 0;
  while ((m = REF.exec(text))) {
    const home = owner.get(m[1]);
    if (!home || home === f) continue;
    /* declared in this file too: a local, not a crossing. Recorded
       rather than dropped, so nothing goes missing in silence. */
    if (mine.has(m[1])) { shadowed.get(f).add(m[1]); continue; }
    const key = f + '>' + home;
    if (!edges.has(key)) edges.set(key, new Map());
    const names = edges.get(key);
    names.set(m[1], (names.get(m[1]) || 0) + 1);
  }
});

const out = new Map(files.map(f => [f, new Set()]));
edges.forEach((names, key) => {
  const [from, to] = key.split('>');
  out.get(from).add(to);
});

const arg = process.argv[2];

if (arg === '--names') {
  const a = files.find(f => f.indexOf(process.argv[3]) >= 0);
  const b = files.find(f => f.indexOf(process.argv[4]) >= 0);
  if (!a || !b) { console.log('name a module on each side'); process.exit(1); }
  const names = edges.get(a + '>' + b);
  if (!names) { console.log(short(a) + ' does not reference ' + short(b)); process.exit(0); }
  console.log(short(a) + ' -> ' + short(b) + '  (' + names.size + ' names)');
  [...names].sort((x, y) => y[1] - x[1]).forEach(([n, c]) => console.log('  ' + String(c).padStart(4) + '  ' + n));
  process.exit(0);
}

if (arg === '--edges') {
  [...edges].sort().forEach(([key, names]) => {
    const [from, to] = key.split('>');
    let total = 0; names.forEach(c => { total += c; });
    console.log(short(from).padEnd(10) + ' -> ' + short(to).padEnd(10) +
      String(names.size).padStart(4) + ' names ' + String(total).padStart(5) + ' uses');
  });
  process.exit(0);
}

console.log(files.length + ' modules, ' + owner.size + ' top-level names\n');
console.log(' '.repeat(11) + files.map(f => short(f).slice(0, 3).padStart(5)).join(''));
files.forEach(f => {
  const row = files.map(g => {
    if (g === f) return '    .';
    const names = edges.get(f + '>' + g);
    return names ? String(names.size).padStart(5) : '    -';
  }).join('');
  console.log(short(f).padEnd(11) + row);
});
console.log('\n(a row uses the columns; the number is how many distinct names)');

let shadows = 0;
shadowed.forEach(s => { shadows += s.size; });
if (shadows) console.log(shadows + ' names skipped as locals shadowing another module (--shadows to list)');
if (arg === '--shadows') {
  shadowed.forEach((s, f) => { if (s.size) console.log('  ' + short(f).padEnd(10) + [...s].sort().join(' ')); });
}

/* ---------- cycles ---------- */
const cycles = [];
const colour = new Map();
const stack = [];
function walk(f) {
  colour.set(f, 1); stack.push(f);
  [...out.get(f)].sort().forEach(g => {
    if (colour.get(g) === 1) {
      const at = stack.indexOf(g);
      cycles.push(stack.slice(at).concat(g).map(short).join(' -> '));
    } else if (!colour.has(g)) walk(g);
  });
  stack.pop(); colour.set(f, 2);
}
files.forEach(f => { if (!colour.has(f)) walk(f); });

/* Back edges: a module naming one that is concatenated after it. These
   work, because function declarations hoist across the whole bundle,
   and they are still a module reaching forward past its own place in
   the order. Reported, not failed — a cycle is the thing that makes a
   file split fictional; a lone forward reference is a numbering
   question. */
const back = [];
files.forEach((f, i) => {
  [...out.get(f)].forEach(g => { if (files.indexOf(g) > i) back.push(short(f) + ' -> ' + short(g)); });
});

/* The cycles that are known, and why they are still here.

   This list is the check. The graph went from seven cycles to one, and
   the way it stays at one is that a new cycle cannot appear without
   somebody editing this line and writing down why — which is a harder
   thing to do by accident than adding a call.

   data <-> design: the generator in 10-data.js reads the difficulty
   curve, and targetClear() in 11-design.js reads LEVELS to find the
   authored intent of a lane level. Both directions are right; the file
   split is what is wrong. LEVELS is content and belongs in front of
   both of them, along with the GK enum its rows are written in. That is
   a move, not a rewrite, and it is the next thing to do here. */
const KNOWN = ['data <-> design'];

console.log('');
if (back.length) console.log(back.length + ' forward reference' + (back.length === 1 ? '' : 's') +
  ' (works by hoisting, but reaches past its place): ' + back.join(', ') + '\n');

const uniq = [...new Set(cycles)];
if (!uniq.length) {
  console.log('no cycles: the file order is a real dependency order');
} else {
  /* the pair cycles are the ones worth naming: a two-file loop is two
     modules that cannot be separated without moving something */
  const pairs = uniq.filter(c => c.split(' -> ').length === 3);
  console.log(uniq.length + ' cycle' + (uniq.length === 1 ? '' : 's') +
    ', ' + pairs.length + ' of them between just two modules');
  const surprises = [];
  pairs.forEach(c => {
    const [a, b] = c.split(' -> ');
    const af = files.find(f => short(f) === a), bf = files.find(f => short(f) === b);
    const ab = edges.get(af + '>' + bf).size, ba = edges.get(bf + '>' + af).size;
    const label = a + ' <-> ' + b;
    const ok = KNOWN.indexOf(label) >= 0;
    if (!ok) surprises.push(label);
    console.log('  ' + (ok ? '  ' : '! ') + a.padEnd(9) + ' <-> ' + b.padEnd(9) +
      '   ' + String(ab).padStart(3) + ' names one way, ' + String(ba).padStart(3) + ' the other' +
      (ok ? '   (known)' : '   NEW'));
  });
  /* a cycle of three or more is never on the list: the list is for
     pairs somebody looked at and decided to live with */
  uniq.filter(c => c.split(' -> ').length > 3).forEach(c => surprises.push(c));

  if (surprises.length) {
    console.log('\nNEW CYCLES: ' + surprises.length);
    console.log('A module that names one which names it back is not a layer.');
    console.log('Break it, or add it to KNOWN in this file and say why.');
    process.exitCode = 1;
  } else {
    console.log('\nno new cycles');
  }
}
