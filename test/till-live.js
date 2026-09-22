/* The till, played against a store.

     node test/till-live.js

   test/till.js checks the grant and the ledger with no store at all,
   which is the state every player is in until the products exist. That
   leaves untested the part that actually moves money: the page asking
   the plugin for prices, deciding it is a shop, opening the sheet,
   hearing back, writing the treats down, and only then closing the
   purchase. No store exists to test that against, and none will until
   the accounts do.

   So this puts one in the page. Before any of the game's own script
   runs, it defines `cordova` and a `CdvPurchase` that answers the calls
   17-billing.js makes — register, when().productUpdated / approved /
   pending, initialize, get, getOffer().order(), restorePurchases,
   finish — in the shapes cordova-plugin-purchase's type definitions
   give them, and fires `deviceready` the way the bridge does. Then it
   does to the game the six things a real store will:

     no products declared   the chip opens the "how treats are earned" sheet
     a sale                 the store's price on the button, treats once, closed after
     a cancelled sheet      nothing granted, nothing closed, nothing said
     a pending payment      nothing granted, and the sheet says why
     a kill before closing  the relaunch closes it and does not pay again
     paid while it was shut the relaunch pays it once, and the one after does not

   A mock that agrees with the code only proves the code agrees with the
   mock, so the mock is written from the plugin's .d.ts and store.js and
   not from 17-billing.js. And the last two rows are the reason this file
   exists at all: a real store will never kill the app on cue, so the
   order of granting and closing is something no amount of testing with
   real money would have shown. */
const { launch, at, serve } = require('../tools/_pw.js');

let bad = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ✓ ' + what);
  else { bad++; console.log('  ✗ ' + what); }
};

/* ---------- the store, as it runs inside the page ----------

   Its state lives in localStorage under its own key, because two of the
   scenarios are a relaunch and a store's queue outlives the app. */
function fakeStore(cfg) {
  const KEY = '__iap';
  const disk = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const keep = d => localStorage.setItem(KEY, JSON.stringify(d));
  keep(Object.assign({ finished: [], unfinished: [], seq: 0, next: 'approve' }, disk(), cfg || {}));

  const handlers = { productUpdated: [], approved: [], pending: [] };
  const fire = (name, x) => handlers[name].forEach(f => f(x));
  const products = {};

  const txOf = (id, sku, state) => ({
    transactionId: id,
    state: state || 'approved',
    products: [{ id: sku }],
    verify() { return Promise.resolve(); },
    finish() {
      const d = disk();
      if (d.hangFinish) return new Promise(() => {});   /* the app dies before this answers */
      d.finished.push(id);
      d.unfinished = d.unfinished.filter(t => t.id !== id);
      keep(d);
      this.state = 'finished';
      return Promise.resolve();
    }
  });

  const when = {};
  ['productUpdated', 'approved', 'pending'].forEach(n => { when[n] = cb => { handlers[n].push(cb); return when; }; });
  ['verified', 'unverified', 'finished', 'receiptUpdated', 'updated', 'initiated', 'receiptsReady']
    .forEach(n => { when[n] = () => when; });

  const store = {
    register(list) { (Array.isArray(list) ? list : [list]).forEach(p => { products[p.id] = { id: p.id }; }); },
    when() { return when; },
    initialize() {
      const prices = disk().prices || {};
      Object.keys(products).forEach(id => {
        if (!prices[id]) return;
        const p = products[id];
        p.pricing = { price: prices[id], priceMicros: 1, currency: 'TRY' };
        p.getOffer = () => ({
          order() {
            const d = disk();
            if (d.next === 'cancel') {
              return Promise.resolve({ isError: true, code: window.CdvPurchase.ErrorCode.PAYMENT_CANCELLED, message: 'cancelled' });
            }
            d.seq = (d.seq || 0) + 1;
            const t = { id: 'GPA.' + d.seq, sku: id };
            d.unfinished.push(t);
            keep(d);
            if (d.next === 'pending') setTimeout(() => fire('pending', txOf(t.id, id, 'pending')), 30);
            else setTimeout(() => fire('approved', txOf(t.id, id)), 30);
            return Promise.resolve(undefined);
          }
        });
        setTimeout(() => fire('productUpdated', p), 0);
      });
      /* what the store still holds is announced again as it connects,
         the way Play hands back purchases nobody acknowledged */
      setTimeout(() => disk().unfinished.forEach(t => fire('approved', txOf(t.id, t.sku))), 10);
      window.__iapInitialized = true;
      return Promise.resolve([]);
    },
    get(id) { return products[id]; },
    get localReceipts() { return []; },
    restorePurchases() {
      disk().unfinished.forEach(t => fire('approved', txOf(t.id, t.sku)));
      return Promise.resolve(undefined);
    }
  };

  window.cordova = {};
  window.CdvPurchase = {
    store: store,
    ErrorCode: { PAYMENT_CANCELLED: 6777006 },
    Platform: { GOOGLE_PLAY: 'android-playstore', APPLE_APPSTORE: 'ios-appstore' },
    ProductType: { CONSUMABLE: 'consumable' }
  };
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => document.dispatchEvent(new Event('deviceready')), 50);
  });
}

const PRICES = {
  treats_pocket_40: '₺64,99',
  treats_bag_110: '₺149,99',
  treats_tin_240: '₺299,99',
  treats_sack_520: '₺599,99',
  starter_pack: '₺59,99',
  treat_jar: '₺99,99',
  season_book: '₺149,99'
};
/* what the welcome pack holds, from STARTER in 10-data.js */
const WELCOME = { treats: 60, moves: 3, hammer: 3 };

/* ---------- driving it ---------- */
const disk = page => page.evaluate(() => JSON.parse(localStorage.getItem('__iap') || '{}'));
const knob = (page, patch) => page.evaluate(p => {
  const d = JSON.parse(localStorage.getItem('__iap') || '{}');
  Object.assign(d, p);
  localStorage.setItem('__iap', JSON.stringify(d));
}, patch);
const treats = page => page.evaluate(() => BL.save.treats);
/* What is on the screen, not what is in the page. textContent includes the
   inline script, and the script carries every string in both languages,
   so a check on it found "That did not go through" after a cancel that
   showed nothing, and found the pending line whether or not it was shown.
   The first run of this file failed one check and passed another for that
   same reason. innerText is what a person could read. */
const said = (page, text) => page.evaluate(t => document.body.innerText.indexOf(t) >= 0, text);

async function relaunch(page) {
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save && window.__iapInitialized, null, { timeout: 15000 });
  await page.waitForTimeout(700);
}

async function fresh(browser, cfg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(fakeStore, cfg);
  await page.goto(at('/pawtika.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.BL && window.BL.save, null, { timeout: 15000 });
  /* past the basket on the step, the way tools/audit.js gets there */
  await page.evaluate(() => {
    if (!BL.save.pets.length) {
      BL.save.pets = [BL.makePet(2, 1, 0, 'Till')];
      BL.save.activePet = BL.save.pets[0].id;
      BL.persist(true);
    }
  });
  await relaunch(page);
  return { ctx, page, errors };
}

async function openStore(page) {
  await page.evaluate(() => {
    const m = document.getElementById('modals');
    if (m) m.innerHTML = '';
    document.querySelectorAll('.veil').forEach(v => v.remove());
    document.body.classList.remove('modalOpen');
    BL.treatStore();
  });
  await page.waitForTimeout(400);
}

/* taps the pocket and reports what the button said */
async function buyPocket(page) {
  await openStore(page);
  const label = await page.evaluate(() => {
    const b = document.querySelector('#modals [data-pay="pocket"]');
    if (!b) return null;
    const t = b.textContent.trim();
    b.click();
    return t;
  });
  await page.waitForTimeout(900);
  return label;
}

(async () => {
  const srv = await serve();
  const browser = await launch();
  const errorsSeen = [];
  try {
    console.log('\nthe till, against a store\n');

    /* ---- a plugin with nothing declared behind it ---- */
    {
      const { ctx, page, errors } = await fresh(browser, { prices: {} });
      await openStore(page);
      const shop = await page.evaluate(() => ({
        pay: !!document.querySelector('#modals [data-pay]'),
        restore: !!document.querySelector('#modals #stRestore')
      }));
      ok(await page.evaluate(() => !!window.__iapInitialized), 'the store started');
      ok(!shop.pay && !shop.restore,
        'and with no product priced, the chip opens the earning sheet rather than a shop');
      errorsSeen.push(...errors);
      await ctx.close();
    }

    /* ---- a sale ---- */
    {
      const { ctx, page, errors } = await fresh(browser, { prices: PRICES });
      const t0 = await treats(page);
      const label = await buyPocket(page);
      ok(label && label.indexOf('₺64,99') >= 0,
        'the button carries the store\'s own price (' + label + ')');
      ok(await treats(page) === t0 + 40, 'a sale grants the pocket, once (' + t0 + ' -> ' + (await treats(page)) + ')');
      const d = await disk(page);
      ok(d.finished.length === 1 && d.unfinished.length === 0, 'and the purchase was closed with the store');
      ok(await page.evaluate(() => !!(BL.save.granted && BL.save.granted['GPA.1'])),
        'and its transaction id is in the save');
      errorsSeen.push(...errors);
      await ctx.close();
    }

    /* ---- a cancelled sheet ---- */
    {
      const { ctx, page, errors } = await fresh(browser, { prices: PRICES });
      await knob(page, { next: 'cancel' });
      const t0 = await treats(page);
      await buyPocket(page);
      ok(await treats(page) === t0, 'a cancelled sheet grants nothing');
      const d = await disk(page);
      ok(d.finished.length === 0 && d.unfinished.length === 0, 'and closes nothing');
      ok(!(await said(page, 'That did not go through')), 'and does not tell the player it failed — they chose it');
      errorsSeen.push(...errors);
      await ctx.close();
    }

    /* ---- a pending payment, and the launch after it clears ---- */
    {
      const { ctx, page, errors } = await fresh(browser, { prices: PRICES });
      await knob(page, { next: 'pending' });
      const t0 = await treats(page);
      await buyPocket(page);
      ok(await treats(page) === t0, 'a pending payment grants nothing yet');
      ok(await said(page, 'still waiting on that payment'), 'and the sheet says the store is still waiting');
      let d = await disk(page);
      ok(d.finished.length === 0 && d.unfinished.length === 1, 'and leaves it open with the store');

      /* the payment clears while the game is shut; the store announces it on connect */
      await knob(page, { next: 'approve' });
      await relaunch(page);
      ok(await treats(page) === t0 + 40, 'when it has cleared, the next launch pays it');
      d = await disk(page);
      ok(d.finished.length === 1 && d.unfinished.length === 0, 'and closes it');
      await relaunch(page);
      ok(await treats(page) === t0 + 40, 'and the launch after that pays nothing more');
      errorsSeen.push(...errors);
      await ctx.close();
    }

    /* ---- killed between the treats and the close ---- */
    {
      const { ctx, page, errors } = await fresh(browser, { prices: PRICES });
      await knob(page, { hangFinish: true });
      const t0 = await treats(page);
      await buyPocket(page);
      ok(await treats(page) === t0 + 40, 'the treats are written before the store is told');
      let d = await disk(page);
      ok(d.finished.length === 0 && d.unfinished.length === 1, 'and the close had not happened when the app died');

      await knob(page, { hangFinish: false });
      await relaunch(page);
      ok(await treats(page) === t0 + 40, 'the relaunch does not pay for it a second time');
      d = await disk(page);
      ok(d.finished.length === 1 && d.unfinished.length === 0, 'and it does close it, so Play does not refund it');
      errorsSeen.push(...errors);
      await ctx.close();
    }

    /* ---- paid for, and the app never heard ---- */
    {
      const { ctx, page, errors } = await fresh(browser, { prices: PRICES });
      const t0 = await treats(page);
      await knob(page, { unfinished: [{ id: 'GPA.9', sku: 'treats_bag_110' }] });
      await relaunch(page);
      ok(await treats(page) === t0 + 110, 'a purchase the store holds is paid on the next launch');
      const d = await disk(page);
      ok(d.finished.indexOf('GPA.9') >= 0 && d.unfinished.length === 0, 'and closed');
      await relaunch(page);
      ok(await treats(page) === t0 + 110, 'and the launch after that pays nothing more');
      errorsSeen.push(...errors);
      await ctx.close();
    }

    /* ---- the welcome pack: first in the sheet, and sold once ---- */
    {
      const { ctx, page, errors } = await fresh(browser, { prices: PRICES });
      await openStore(page);
      const first = await page.evaluate(() => {
        const b = document.querySelector('#modals [data-pay]');
        return b ? { pay: b.dataset.pay, label: b.textContent.trim() } : null;
      });
      ok(first && first.pay === 'starter', 'the welcome pack is the first thing in the sheet');
      ok(first && first.label.indexOf('₺59,99') >= 0,
        'at the store\'s own price (' + (first && first.label) + ')');
      const sizes = await page.evaluate(() =>
        [...document.querySelectorAll('#modals [data-pay]')].map(b => b.dataset.pay));
      ok(['pocket', 'bag', 'tin', 'sack'].every(id => sizes.indexOf(id) >= 0), 'all four sizes are on sale beside it');
      const before = await page.evaluate(() => ({ t: BL.save.treats, m: BL.save.boosters.moves, h: BL.save.boosters.hammer }));
      await page.evaluate(() => document.querySelector('#modals [data-pay="starter"]').click());
      await page.waitForTimeout(900);
      const after = await page.evaluate(() => ({ t: BL.save.treats, m: BL.save.boosters.moves,
        h: BL.save.boosters.hammer, bought: !!(BL.save.starter && BL.save.starter.bought) }));
      ok(after.t === before.t + WELCOME.treats && after.m === before.m + WELCOME.moves &&
         after.h === before.h + WELCOME.hammer,
        'buying it hands over the treats and the boosters (' + before.t + ' -> ' + after.t + ' treats)');
      ok(after.bought, 'and the save knows it was bought');
      const d = await disk(page);
      ok(d.finished.length === 1 && d.unfinished.length === 0, 'and the sale was closed with the store');
      await openStore(page);
      ok(await page.evaluate(() => !document.querySelector('#modals [data-pay="starter"]')),
        'the sheet does not offer it again');
      await relaunch(page);
      await openStore(page);
      ok(await page.evaluate(() => !document.querySelector('#modals [data-pay="starter"]')),
        'not even after a relaunch');
      errorsSeen.push(...errors);
      await ctx.close();
    }

    ok(errorsSeen.length === 0, 'nothing threw in the page' +
      (errorsSeen.length ? ': ' + [...new Set(errorsSeen)].slice(0, 3).join(' | ') : ''));
  } finally {
    await browser.close();
    if (srv && typeof srv.stop === 'function') srv.stop();
  }

  console.log('\n' + (bad ? bad + ' failed\n' : 'the till holds against a store\n'));
  process.exitCode = bad ? 1 : 0;
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
