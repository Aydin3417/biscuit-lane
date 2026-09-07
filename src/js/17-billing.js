/* ============================================================
   17 — the till
   ============================================================

   Everything above this file is a closed economy: coins and treats come
   from playing and go into the shop, and the two columns balance because
   test/economy.js makes them. This is the one seam where value enters
   from outside, and it is deliberately the only one.

   No advertising. Nothing here interrupts a level, nothing plays a
   video, nothing is sold to a player who is not already asking for it.
   Every surface in this file is opened by the player: the treat chip in
   the header, or the two moments — out of moves near the end, out of
   hearts — where the game has something the player wanted and could not
   have. That is the whole of it.

   Nothing here can take money yet, and it says so rather than pretending
   otherwise. A store needs a merchant account, products declared in the
   Play Console, and a receipt somebody trusts; none of those exist. What
   exists is the shape of it, so that wiring a billing plugin is a change
   to one function rather than to the game.
*/

/* ---------- the seam ----------

   One object, four questions, and exactly one place that would have to
   change to make this real. `ready` is what the interface asks before it
   offers anything: false means the buttons are shown but explain
   themselves instead of lying.

   A Capacitor billing plugin — @capacitor-community/in-app-purchases, or
   RevenueCat's, they present the same three calls — would be picked up
   here by name. Until one is installed this stays honest. */
const BILLING = {
  plugin: null,
  prices: {},              // sku -> localized price string, once a store answers

  /* Whether money can actually change hands in this build. Checked at
     call time rather than cached at load: the plugin arrives with the
     native bridge, which is not up yet when this file is read. */
  ready() {
    if (this.plugin) return true;
    const P = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins) || null;
    if (!P) return false;
    this.plugin = P.InAppPurchases || P.Purchases || P.CdvPurchase || null;
    return !!this.plugin;
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
    return TREAT_PACKS.map(p => p.sku).concat([JAR.sku, PASS.sku]);
  },

  /* Ask the store what these cost where the player is. Safe to call when
     no store exists — it resolves having done nothing. */
  async refresh() {
    if (!this.ready()) return false;
    try {
      const skus = this.skus();
      const r = await this.plugin.getProducts({ productIdentifiers: skus, productIds: skus });
      const list = (r && (r.products || r.productList)) || [];
      list.forEach(p => {
        const id = p.productId || p.identifier || p.id;
        const shown = p.priceString || p.localizedPrice || p.price;
        if (id && shown) this.prices[id] = String(shown);
      });
      return true;
    } catch (e) { return false; }
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
     per season, and a season ends — so all three have to be handed back
     to the store as used, or the second purchase is refused with
     "already owned". There is no non-consumable in this game and that is
     deliberate: it is the only product type that needs no account.

     The four names below are the four ways the plugins in circulation
     spell the same call. Trying each is not indecision, it is the same
     bet `ready()` makes: this seam should fit whichever one gets
     installed without the game learning its name. */
  async settle(receipt, sku) {
    if (!this.plugin || !receipt) return;
    const id = receipt.transactionId || receipt.purchaseToken || receipt.token || sku;
    const arg = { productIdentifier: sku, productId: sku, transactionId: id, purchaseToken: id };
    const names = ['consumePurchase', 'finishTransaction', 'consume', 'acknowledgePurchase'];
    for (const n of names) {
      if (typeof this.plugin[n] !== 'function') continue;
      try { await this.plugin[n](arg); return; } catch (e) { /* try the next spelling */ }
    }
  },

  /* The purchase itself.

     Resolves { ok: true } only when a store has said so. Everything else
     — no plugin, a cancelled sheet, a network that went away — comes
     back { ok: false, why } and the caller grants nothing. There is no
     branch in here that credits an account without a receipt, in any
     build, including this one: a stub that pays out is a stub somebody
     ships by accident. */
  async buy(sku) {
    if (!this.ready()) return { ok: false, why: 'nostore' };
    try {
      const r = await this.plugin.purchase({ productIdentifier: sku, productId: sku });
      if (!r || r.cancelled || r.responseCode === 1) return { ok: false, why: 'cancelled' };
      /* A receipt is checked by whoever issued it. Locally that means
         the plugin's own verification and nothing more, which is enough
         for a single-player game with no leaderboard — the only person
         a forged receipt cheats is the person holding the phone. It is
         not enough the day this game keeps anything on a server, and
         that is the day this call grows a second half. */
      await this.settle(r, sku);
      return { ok: true, receipt: r };
    } catch (e) {
      return { ok: false, why: 'failed' };
    }
  },

  /* What the store still says this player owns.

     Consumables do not survive being consumed, so on a healthy device
     this comes back empty and that is the correct answer — there is
     nothing to restore because nothing is outstanding. What it does
     catch is the case that costs a player real money: a purchase that
     was taken but never granted, because the app was killed between the
     store saying yes and the save being written. Those sit in the queue
     until somebody claims them, and this is how they get claimed.

     Returns the product ids, so the caller decides what each one is
     worth. This file knows about receipts and nothing about treats. */
  async restore() {
    if (!this.ready()) return { ok: false, why: 'nostore', skus: [] };
    try {
      const r = await this.plugin.restorePurchases({ productIds: this.skus() });
      const list = (r && (r.purchases || r.transactions || r.results)) || [];
      const skus = list
        .map(p => p && (p.productId || p.productIdentifier || p.identifier || p.id))
        .filter(Boolean);
      return { ok: true, skus: skus, receipts: list };
    } catch (e) { return { ok: false, why: 'failed', skus: [] }; }
  }
};
