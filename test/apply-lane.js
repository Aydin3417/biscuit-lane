/* Write measured move budgets, star thresholds and design intent back
   into the level table.

   Only three numbers per level are touched, and each is edited in place
   by finding the property in the authored text. That matters: LEVELS is
   hand-written, with maps laid out as readable rows and comments
   explaining what each stretch is for. Regenerating the table would
   produce the same levels and throw away the reason they exist.

   Levels are located by brace matching rather than by a regex assembled
   from a string. The first version of this file built its pattern that
   way and shipped a broken one — an escape collapsed on the way in, so
   the `\b` in the source became a backspace character and not one level
   in sixty matched. It failed loudly and wrote nothing, which is the
   only reason that was cheap. Regex literals below are safe because
   they are literals; nothing here assembles a pattern out of text.
*/
const fs = require('fs');
const path = require('path');

/* the span of the object literal that opens at or after `from` */
function objectAt(src, from) {
  const open = src.indexOf('{', from);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return { open, close: i + 1 };
  }
  return null;
}

/* Every top-level entry of LEVELS, keyed by its own `n:` field rather
   than by position, so a level that gains or loses a sibling does not
   silently retune its neighbour. */
function entries(table) {
  const out = {};
  let i = 0;
  while (true) {
    const span = objectAt(table, i);
    if (!span) break;
    const body = table.slice(span.open, span.close);
    const m = body.match(/\bn:\s*(\d+)/);
    if (m) out[+m[1]] = span;
    i = span.close;
  }
  return out;
}

module.exports = function apply(state) {
  const p = path.join(__dirname, '..', 'src', 'js', '10-data.js');
  const src = fs.readFileSync(p, 'utf8');
  const start = src.indexOf('const LEVELS = [');
  if (start < 0) throw new Error('LEVELS tablosu bulunamadı');

  let depth = 0, end = -1;
  for (let i = src.indexOf('[', start); i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { if (--depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error('LEVELS tablosu kapanmıyor');

  const head = src.slice(0, start);
  let table = src.slice(start, end);
  const tail = src.slice(end);

  const rows = Object.keys(state).map(k => state[k]).sort((a, b) => b.n - a.n);
  let moved = 0, restarred = 0, aimed = 0;
  const missed = [];

  /* Back to front, so an edit never shifts an offset that has not been
     used yet. */
  for (const row of rows) {
    const found = entries(table)[row.n];
    if (!found) { missed.push(row.n); continue; }
    const before = table.slice(found.open, found.close);
    let block = before;

    if (row.moves !== undefined) block = block.replace(/\bmoves:\s*\d+/, 'moves: ' + row.moves);
    if (row.base !== undefined) block = block.replace(/\bbase:\s*\d+/, 'base: ' + row.base);

    /* `want` is the design intent for this level: what share of games it
       is meant to be won. It lives in the table rather than in a formula
       because the lane's rhythm is fitted to what each level can carry,
       and because a number a person can read and override is worth more
       than one that has to be derived. */
    if (row.want !== undefined) {
      block = /\bwant:\s*[\d.]+/.test(block)
        ? block.replace(/\bwant:\s*[\d.]+/, 'want: ' + row.want)
        : block.replace(/\bbase:\s*(\d+)/, 'base: $1, want: ' + row.want);
    }

    if (block === before) { missed.push(row.n); continue; }
    if (row.m0 !== undefined && row.moves !== row.m0) moved++;
    if (row.base0 !== undefined && row.base !== row.base0) restarred++;
    if (row.want !== undefined) aimed++;
    table = table.slice(0, found.open) + block + table.slice(found.close);
  }

  if (missed.length) throw new Error('yamalanamayan seviyeler: ' + missed.join(', '));
  fs.writeFileSync(p, head + table + tail);
  console.log('10-data.js güncellendi: ' + moved + ' hamle bütçesi, ' +
    restarred + ' yıldız eşiği, ' + aimed + ' tasarım hedefi');
};

if (require.main === module) {
  const f = path.join(__dirname, '..', 'tuned-lane.json');
  module.exports(JSON.parse(fs.readFileSync(f, 'utf8')));
}
