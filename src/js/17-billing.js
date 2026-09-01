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

  /* Ask the store what these cost where the player is. Safe to call when
     no store exists — it resolves having done nothing. */
  async refresh() {
    if (!this.ready()) return false;
    try {
      const skus = TREAT_PACKS.map(p => p.sku).concat([PET_CLUB.sku, JAR.sku]);
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
      return { ok: true, receipt: r };
    } catch (e) {
      return { ok: false, why: 'failed' };
    }
  },

  async restore() {
    if (!this.ready()) return { ok: false, why: 'nostore' };
    try { await this.plugin.restorePurchases(); return { ok: true }; }
    catch (e) { return { ok: false, why: 'failed' }; }
  }
};
