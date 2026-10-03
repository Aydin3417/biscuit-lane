/* ============================================================
   17 — the till
   ============================================================

   Everything above this file is a closed economy: coins and treats come
   from playing and go into the shop, and the two columns balance because
   test/economy.js makes them. This is the one seam where value enters
   from outside, and it is deliberately the only one.

   Nothing here interrupts a level and nothing is sold to a player who
   is not already asking for it. (The rewarded videos in 19-ads.js are
   the same rule applied to attention instead of money.)
   Every surface in this file is opened by the player: the treat chip in
   the header, or the two moments — out of moves near the end, out of
   hearts — where the game has something the player wanted and could not
   have. That is the whole of it.

   WHAT IS BEHIND IT. cordova-plugin-purchase, which talks to Google Play
   Billing and to StoreKit and to nobody else: no server of its own, no
   account of its own. Receipts go to one place only when BACKEND is
   filled in: the game's own verify-purchase function, which forwards
   them to Apple or Google and keeps nothing but the transaction id. It was chosen over RevenueCat for exactly that reason.
   RevenueCat is a service that sees every purchase, and privacy.html
   and the listing say in two languages that nobody but the store does,
   which is also what the data answers for both stores rest on. It was
   chosen over
   capacitor-plugin-cdv-purchase — the same code, packaged for Capacitor
   — because that one is reached through an `import` and the shipped page
   has none. This one puts `CdvPurchase` on window, which is how every
   other native thing in this game is reached.

   The version of this file before it guessed. It asked whatever it found
   for `getProducts`, `purchase` and `restorePurchases`, and tried four
   spellings of "consume", and no plugin in circulation answers to that
   shape; the one the checklist named, @capacitor-community/in-app-purchases,
   is not on npm at all. Installed, it would have found RevenueCat's
   `Purchases`, called methods that are not there, and sold nothing
   without an error anywhere. A seam written to fit any plugin fitted
   none. This one is written against one plugin's type definitions.

   Money still does not change hands until the products are declared in
   the Play Console and App Store Connect. Until a store has answered
   with a price for at least one of them, `ready()` is false and the shop
   shows how treats are earned instead — so a build that ships before
   its products do behaves exactly like the build that shipped before the
   plugin did.
*/
const BILLING = {
  store: null,             // CdvPurchase.store, once initialize has answered
  prices: {},              // sku -> localized price string, once a store answers
  started: null,           // the one promise every caller waits on
  waiting: {},             // sku -> the answer of the buy() open on it
  owed: {},                // transactionId -> approved and not yet handed back
  checking: false,         // a server checks receipts (BACKEND) before anything is paid
  cleared: {},             // transactionId -> the server said this one is real

  /* Whether money can actually change hands in this build: a store is up
     and it has told us the price of something we sell. A plugin with no
     products declared behind it is not a shop. Asked synchronously,
     because the interface asks it before it draws a price. */
  ready() {
    return !!this.store && Object.keys(this.prices).length > 0;
  },

  /* the price to put on a button: whatever the store said, or the
     fallback label, which is marked as approximate wherever it shows */
  price(sku, fallback) {
    return this.prices[sku] || fallback;
  },

  /* Everything this game can sell, in one list.

     It was written out at the one call site that needed it and left the
     season book off, so the book's button showed the hardcoded `$4.99`
     on a live store instead of the price in the player's own currency —
     which in Turkey is not a rounding error, it is the wrong number in
     the wrong unit. One list, and every caller reads it. */
  skus() {
    return TREAT_PACKS.map(p => p.sku).concat([JAR.sku, PASS.sku, STARTER.sku]);
  },

  /* ---------- starting the store ----------

     Once, and everybody waits on the same promise. A Cordova plugin is
     usable after `deviceready`, which comes after this file is read and
     after boot has already asked for prices. In a browser there is no
     `cordova` at all, and this answers false straight away rather than
     after the timeout, so the web build and the tests never sit waiting
     on a store that was never there.

     Every product is registered CONSUMABLE — store/LISTING.md says why
     the season book is one too. */
  boot() {
    if (this.started) return this.started;
    this.started = new Promise(resolve => {
      const w = typeof window !== 'undefined' ? window : null;
      if (!w || !w.cordova || typeof document === 'undefined') { resolve(false); return; }
      let settled = false;
      const done = v => { if (!settled) { settled = true; resolve(v); } };
      const go = () => {
        const C = w.CdvPurchase;
        if (!C || !C.store) { done(false); return; }
        const ios = !!(w.Capacitor && w.Capacitor.getPlatform && w.Capacitor.getPlatform() === 'ios');
        const platform = ios ? C.Platform.APPLE_APPSTORE : C.Platform.GOOGLE_PLAY;
        const S = C.store;
        S.register(this.skus().map(id => ({ id: id, type: C.ProductType.CONSUMABLE, platform: platform })));
        /* Without a server, arrival is `approved`, not `verified`. With no validator set the
           plugin passes every receipt without looking at it — its own
           source says "for backward compatibility, we consider that the
           receipt is verified" — so waiting for `verified` would be
           waiting on a formality, through a receipt type whose shape the
           definitions do not make plain. `verify` is still called, so
           the plugin's own bookkeeping runs its usual course. The day a
           validator is set, arrival moves to `verified` and this comment
           stops being true. */
        /* WITH A SERVER, A RECEIPT IS CHECKED BEFORE ANYTHING IS PAID.

           Without one, arrival is `approved`: the store said so, and
           that is all there is to go on — which on a rooted phone with a
           billing emulator is nothing at all. With BACKEND filled in, the
           receipt goes to server/supabase/functions/verify-purchase, which
           asks Apple or Google themselves, and arrival moves to
           `verified`. A receipt the server refuses never reaches the
           save. */
        this.checking = backendOn();
        if (this.checking) {
          /* A server that cannot be reached is not a refusal. A free
             Supabase project is paused after a week with no traffic, and a
             phone can be offline for the check and online for the store;
             either way the player has paid, and a purchase left "pending"
             because of our server is a sale lost and a player wronged. So
             no answer (no network, a paused project, a 5xx) falls back to
             the store's word, exactly as the game behaves with no server
             at all. Only an answer that says "refused" stops a grant. */
          S.validator = (body, cb) => {
            const good = { ok: true, data: { id: body.id, latest_receipt: true, transaction: body.transaction } };
            backendCall('verify-purchase', { body: body, install: SAVE.install || 0, platform: ios ? 'ios' : 'android' })
              .then(r => r.status >= 500 ? null : r.json().then(j => ({ status: r.status, j: j })))
              .then(x => {
                if (!x || !x.j || typeof x.j.ok !== 'boolean') { track('verify_skip', { why: 'noanswer' }); cb(good); return; }
                cb(x.j.ok ? good
                  : { ok: false, status: x.status, code: x.j.code || 6778003, message: x.j.message || 'refused' });
              }, () => { track('verify_skip', { why: 'unreachable' }); cb(good); });
          };
        }
        const w8 = S.when()
          .productUpdated(p => this.learn(p))
          .approved(tx => { if (!this.checking) this.arrived(tx); tx.verify(); })
          .pending(tx => this.held(tx));
        if (this.checking) {
          w8.verified(rc => {
            ((rc && rc.sourceReceipt && rc.sourceReceipt.transactions) || []).forEach(tx => {
              if (tx && tx.transactionId) this.cleared[tx.transactionId] = true;
              this.arrived(tx);
            });
          });
          w8.unverified(u => {
            const txs = (u && u.receipt && u.receipt.transactions) || [];
            const refused = u && u.payload && u.payload.code !== 6778001;
            txs.forEach(tx => ((tx && tx.products) || []).forEach(p => {
              const open = p && this.waiting[p.id];
              if (open) open({ ok: false, why: refused ? 'failed' : 'pending' });
            }));
          });
        }
        S.initialize([platform]).then(() => {
          this.store = S;
          this.skus().forEach(id => this.learn(S.get(id, platform)));
          done(true);
        }, () => done(false));
      };
      document.addEventListener('deviceready', go, false);
      /* a bridge that never comes up is a store that is not there */
      setTimeout(() => done(false), 12000);
    });
    return this.started;
  },

  /* a product the store has described: keep its price as the store wrote
     it, in the player's currency and the player's number format */
  learn(p) {
    if (p && p.id && p.pricing && p.pricing.price) this.prices[p.id] = String(p.pricing.price);
  },

  /* A transaction the store has approved.

     If a buy() is waiting on that product, this is its answer. If not,
     it is money that arrived while nobody was asking — approved after
     the app was killed, or a pending payment that has since cleared — and
     it waits in `owed` for the next restore, which every launch makes. */
  arrived(tx) {
    if (!tx || tx.state === 'finished' || !tx.transactionId) return;
    const mine = this.skus();
    (tx.products || []).forEach(p => {
      if (!p || mine.indexOf(p.id) < 0) return;
      const open = this.waiting[p.id];
      if (open) open({ ok: true, receipt: tx });
      else this.owed[tx.transactionId] = tx;
    });
  },

  /* A payment the store has accepted and not cleared: a carrier bill, a
     payment method that settles later, a parent asked to approve. It is
     not a sale yet, so nothing is granted and the sheet says so; when it
     clears it comes back through `arrived`, and the launch after that
     pays it. */
  held(tx) {
    ((tx && tx.products) || []).forEach(p => {
      const open = p && this.waiting[p.id];
      if (open) open({ ok: false, why: 'pending' });
    });
  },

  /* Ask the store what these cost where the player is. Safe to call when
     no store exists — it resolves having done nothing. */
  async refresh() {
    if (!(await this.boot())) return false;
    this.skus().forEach(id => this.learn(this.store.get(id)));
    return this.ready();
  },

  /* ---------- closing the transaction ----------

     The half of a purchase nobody sees, and the one that decides whether
     the money is actually yours.

     Google Play holds a purchase open until the app says it has handed
     the goods over. A purchase left open for three days is REFUNDED
     AUTOMATICALLY — the player keeps the treats, the money goes back,
     and nothing anywhere reports an error. Apple's queue is the same
     shape with a gentler failure: an unfinished transaction is replayed
     on every launch forever. So this is not tidying up after the sale.
     Without it there is no sale.

     Everything this game sells is a consumable. The packs and the jar
     are bought again and again by design; the season book is bought once
     per season, and a season ends; the welcome pack is bought once per
     player, and a reinstall is a new player — so every one of them has
     to be handed back to the store as used, or the second purchase is
     refused with "already owned". There is no non-consumable in this
     game and that is deliberate: it is the only product type that needs
     no account.

     And it is the second half, never the first. The caller grants the
     purchase and writes the save, and only then calls this. A
     transaction closed before the treats are written is a charge that
     can never be claimed, because a consumed purchase is in nobody's
     queue. Closed after, the worst a kill can do is leave it open — and
     the next launch finds it, closes it, and does not pay for it twice,
     because the save kept its transaction id (`granted`, 15-save.js). */
  async settle(tx) {
    if (!tx || typeof tx.finish !== 'function') return;
    try { await tx.finish(); } catch (e) { return; /* still open; the next launch closes it */ }
    if (tx.transactionId) delete this.owed[tx.transactionId];
  },
  /* Only what the save has actually paid out. This closed every owed
     transaction, including ones grantPurchase had refused — a SKU a
     later build no longer sells — and a consumed purchase is in nobody's
     queue again: the player was charged and the sale was gone. One the
     ledger does not hold stays open for a build that knows what it is. */
  async settleAll(list) {
    for (const tx of (list || [])) {
      const id = tx && tx.transactionId;
      if (id && !(SAVE.granted && SAVE.granted[id])) continue;
      await this.settle(tx);
    }
  },

  /* The purchase itself.

     Resolves { ok: true, receipt } only when a store has approved it.
     Everything else — no store, a cancelled sheet, a payment still
     pending, a network that went away — comes back { ok: false, why }
     and the caller grants nothing. There is no branch in here that
     credits an account without a receipt, in any build, including this
     one: a stub that pays out is a stub somebody ships by accident.

     `order` resolving is not the answer. It resolves when the store's
     sheet is done with, and the purchase itself is approved through the
     `approved` event, which can land just before that or just after. So
     the answer is whichever comes first: approval, a pending payment, an
     error from the order, or a minute of nothing — which is reported as
     pending rather than failed, because a charge may still clear, and if
     it does the next launch will find it.

     A receipt is checked by whoever issued it. Locally that means the
     store's own signature and nothing more, which is enough for a
     single-player game with no leaderboard — the only person a forged
     receipt cheats is the person holding the phone. It is not enough the
     day this game keeps anything on a server, and that is the day a
     validator is set. */
  async buy(sku) {
    if (!(await this.boot()) || !this.ready()) return { ok: false, why: 'nostore' };
    const product = this.store.get(sku);
    const offer = product && product.getOffer && product.getOffer();
    if (!offer) return { ok: false, why: 'nostore' };
    if (this.waiting[sku]) return { ok: false, why: 'busy' };
    const C = window.CdvPurchase;
    return new Promise(resolve => {
      let over = false;
      const answer = r => {
        if (over) return;
        over = true;
        if (this.waiting[sku] === answer) delete this.waiting[sku];
        resolve(r);
      };
      this.waiting[sku] = answer;
      offer.order().then(err => {
        if (err && err.isError) {
          answer({ ok: false, why: err.code === C.ErrorCode.PAYMENT_CANCELLED ? 'cancelled' : 'failed' });
          return;
        }
        setTimeout(() => answer({ ok: false, why: 'pending' }), 60000);
      }, () => answer({ ok: false, why: 'failed' }));
    });
  },

  /* What the store still says this player is owed.

     Consumables do not survive being consumed, so on a healthy device
     this comes back empty and that is the correct answer — there is
     nothing to restore because nothing is outstanding. What it does
     catch is the case that costs a player real money: a purchase that
     was taken but never granted, because the app was killed between the
     store saying yes and the save being written. Those sit in the queue
     until somebody claims them, and this is how they get claimed.

     What is outstanding arrives through `approved` as the store starts
     and again when it is asked to restore, and collects in `owed`; the
     local receipts are read as well, for anything approved before this
     file was listening. The transactions go back beside the product
     ids, so the caller can claim each one by its id and then hand every
     one of them back to the store — the ones the save already held
     included, since those are exactly the ones a kill left open.

     This file knows about receipts and nothing about treats. */
  async restore() {
    if (!(await this.boot())) return { ok: false, why: 'nostore', skus: [], receipts: [] };
    try { await this.store.restorePurchases(); } catch (e) { /* what already arrived still counts */ }
    const mine = this.skus();
    const ours = tx => ((tx && tx.products) || []).some(p => p && mine.indexOf(p.id) >= 0);
    (this.store.localReceipts || []).forEach(r => ((r && r.transactions) || []).forEach(tx => {
      if (tx && tx.state === 'approved' && tx.transactionId && !this.owed[tx.transactionId] && ours(tx)) {
        /* Restore read the phone's own receipts and paid whatever was
           approved, which is the one door the server check would not
           have covered. With a server, an unchecked one is sent to be
           checked and paid when the answer comes back. */
        if (this.checking && !this.cleared[tx.transactionId]) { try { tx.verify(); } catch (e) { } return; }
        this.owed[tx.transactionId] = tx;
      }
    }));
    const receipts = Object.keys(this.owed).map(k => this.owed[k]);
    const skus = [];
    receipts.forEach(tx => (tx.products || []).forEach(p => {
      if (p && mine.indexOf(p.id) >= 0) skus.push(p.id);
    }));
    return { ok: true, skus: skus, receipts: receipts };
  }
};
