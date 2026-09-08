/* The till, checked.

     node test/till.js

   This exists because of one line. The season book's buy button read

       const ok = await BILLING.buy(PASS.sku);
       if (!ok) { ... return; }
       passState().paid = true;

   and `buy` resolves to an object however it went — `{ ok: false, why:
   'cancelled' }` is as truthy as `{ ok: true }`. So the one button in the
   game that sells a four-pound item handed it over to anybody who opened
   the payment sheet and changed their mind. The treat store six hundred
   lines away had always tested `r.ok` and was never wrong, which is what
   made it invisible: the pattern was right everywhere it had been
   reviewed and wrong in the newest thing nobody had.

   Nothing in the existing suite could have caught it. test/check.js
   resolves names, not meanings; the browser layer cannot drive a store
   that does not exist. So this is half unit test and half source
   reading, and the source-reading half is the part that earns its keep:
   it fails on the next `buy` call site that forgets, whoever writes it. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsDir = path.join(__dirname, '..', 'src', 'js');
const read = f => fs.readFileSync(path.join(jsDir, f), 'utf8');

let bad = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ✓ ' + what);
  else { bad++; console.log('  ✗ ' + what); }
};

/* ---------- the modules, headless ----------

   17-billing.js reaches for window.Capacitor at call time and for the
   product tables at load, so it needs the data and save layers under it
   and a window with nothing in it — which is also the state this test
   most wants to check, because "no store behind this build" is what
   every player is in until an account exists. */
const ctx = {
  console, Math, Date, JSON, setTimeout, clearTimeout,
  SP: { NONE: 0, ROW: 1, COL: 2, BOMB: 3, RAIN: 4 },
  window: { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 },
  document: { createElement: () => ({ getContext: () => ({}) }) },
  localStorage: { getItem: () => null, setItem: () => { }, removeItem: () => { } },
  navigator: { language: 'en' },
  performance: { now: () => Date.now() },
  requestAnimationFrame: fn => setTimeout(fn, 16)
};
vm.createContext(ctx);
vm.runInContext('var LANG = "en";', ctx);
['00-util.js', '10-data.js', '11-design.js', '12-curve.js', '13-run-fit.js', '15-save.js', '17-billing.js']
  .forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
const X = vm.runInContext(
  '({ BILLING, TREAT_PACKS, JAR, PASS, grantPurchase, claimOutstanding,' +
  '   passState, passWorthBuying, passBanked, freshSave, seasonNo, seasonDaysLeft,' +
  '   SEASON_DAYS, setSave: s => { SAVE = s; }, getSave: () => SAVE })', ctx);

console.log('\nthe till\n');

/* ---------- every sku the game sells is asked about ----------

   The list was written out at the one call site that needed it and left
   the season book off, so the book showed a hardcoded dollar price on a
   live store — wrong in most of the world and wrong by a lot in the one
   this game is written for. */
const skus = X.BILLING.skus();
X.TREAT_PACKS.forEach(p =>
  ok(skus.indexOf(p.sku) >= 0, 'the store is asked the price of ' + p.sku));
ok(skus.indexOf(X.JAR.sku) >= 0, 'the store is asked the price of ' + X.JAR.sku);
ok(skus.indexOf(X.PASS.sku) >= 0, 'the store is asked the price of ' + X.PASS.sku);

/* ---------- nothing is given away without a store ---------- */
(async () => {
  const r = await X.BILLING.buy(X.PASS.sku);
  ok(r && r.ok === false && r.why === 'nostore', 'buying without a store refuses');
  const rs = await X.BILLING.restore();
  ok(rs && rs.ok === false && Array.isArray(rs.skus) && !rs.skus.length,
    'restoring without a store returns an empty list rather than undefined');

  /* ---------- and a refusal is an object, which is the whole point ---------- */
  ok(typeof r === 'object' && r !== null,
    'a refusal is an object — so `if (!result)` can never detect one');

  /* ---------- granting ---------- */
  X.setSave(X.freshSave());
  const before = X.getSave().treats;
  const got = X.grantPurchase('pack', X.TREAT_PACKS[0].id);
  ok(got === X.TREAT_PACKS[0].treats && X.getSave().treats === before + got,
    'a pack grants exactly what it says on it');
  ok(X.grantPurchase('pack', 'no-such-pack') === 0, 'an unknown pack grants nothing');
  ok(X.grantPurchase('nonsense', 'x') === 0, 'an unknown kind grants nothing');

  ok(X.grantPurchase('pass', 'pass') === 1, 'the book can be granted');
  ok(X.passState().paid === true, 'and the save says so');
  ok(X.grantPurchase('pass', 'pass') === 0,
    'granting it twice is not two books — a restore that reports it twice pays once');

  /* ---------- what a restore claims ---------- */
  X.setSave(X.freshSave());
  const t0 = X.getSave().treats;
  const n = X.claimOutstanding([X.TREAT_PACKS[1].sku, X.PASS.sku, 'something-else']);
  ok(n === 2, 'a restore claims what it recognises and ignores what it does not');
  ok(X.getSave().treats === t0 + X.TREAT_PACKS[1].treats, 'and the treats arrived once');

  /* ---------- the season belongs to the player ----------

     Anchored to a fixed calendar, half of all installs landed in a
     season with under a fortnight left and were offered a thirty-tier
     book anyway. Whatever day somebody starts, they get a whole one. */
  const start = 20000;
  ok(X.seasonNo(start, start) === 0, 'the day you install is day one of your first season');
  ok(X.seasonDaysLeft(start, start) === X.SEASON_DAYS,
    'and a whole season is in front of you');
  ok(X.seasonNo(start, start + X.SEASON_DAYS - 1) === 0, 'which lasts to its last day');
  ok(X.seasonNo(start, start + X.SEASON_DAYS) === 1, 'and then rolls over');

  /* ---------- and it is not sold when it cannot pay for itself ---------- */
  const pack = X.TREAT_PACKS.reduce((m, x) => Math.max(m, x.treats), 0);
  ok(X.passBanked(X.PASS.tiers * X.PASS.per) >= pack,
    'a finished track returns more treats than the pack beside it');
  ok(X.passBanked(0) === 0, 'and an untouched one returns nothing');

  X.setSave(X.freshSave());
  ok(X.passWorthBuying() === true, 'a player at the start of a season is offered the book');

  /* ---------- the source reading ----------

     Every place that calls BILLING.buy has to test `.ok` on what comes
     back. This is a blunt check and it is meant to be: it looks at the
     twenty lines after each call and fails if none of them mentions the
     field. A caller that genuinely does not need to can say so by
     testing it and ignoring the answer, which costs nothing; a caller
     that forgot is exactly what this is for. */
  const ui = read('60-ui.js');
  const calls = [];
  const re = /BILLING\.buy\(/g;
  let m;
  while ((m = re.exec(ui))) calls.push(m.index);
  ok(calls.length > 0, 'there are buy call sites to check (' + calls.length + ')');
  calls.forEach(at => {
    const line = ui.slice(0, at).split('\n').length;
    const after = ui.slice(at, at + 900);
    ok(/\.ok\b/.test(after),
      '60-ui.js:' + line + ' tests .ok on what buy resolved to');
  });

  /* The same for restore: it returns a list, and a caller that throws it
     away is a "restore purchases" button that restores nothing — which
     is what it was, and which Apple asks about at review. */
  const rcalls = [];
  const rre = /BILLING\.restore\(/g;
  while ((m = rre.exec(ui))) rcalls.push(m.index);
  rcalls.forEach(at => {
    const line = ui.slice(0, at).split('\n').length;
    ok(/claimOutstanding/.test(ui.slice(at, at + 500)),
      '60-ui.js:' + line + ' does something with what restore returned');
  });

  console.log('\n' + (bad ? bad + ' failed\n' : 'the till holds\n'));
  process.exitCode = bad ? 1 : 0;
})();
