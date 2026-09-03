/* What advertising would be worth, if there were any.

     node tools/revenue.js [installs]

   There are no ads in this game and 17-billing.js says why. This exists
   to put a number on that decision rather than leaving it a feeling, and
   it is a model, not a measurement: everything above the line marked
   ASSUMPTIONS is a public benchmark, not something this repository
   knows. Change them and the answer changes — that is the point of
   having them in one place instead of in a paragraph.

   What the model does take from the game itself is the shape of play:
   how often a level is lost, how often the carry-on offer is allowed to
   appear (it is gated at 70% of the goal), and how often hearts run out
   — all of which test/economy.js measures. Those are the only three
   moments an ad could honestly go. */

const ECON_CONTINUE_GATE = 0.70;   /* the offer's own gate, from ECON */

/* ---------------- ASSUMPTIONS ---------------- */

/* Retention and depth. Casual puzzle, no brand, no marketing spend.
   `days` is the average number of days an install is still playing,
   which is what a retention curve of 35/12/4 comes to when integrated. */
const AUDIENCE = {
  d1: 0.35, d7: 0.12, d30: 0.04,
  daysPlayed: 3.5,          /* average active days per install, month one */
  levelsPerDay: 8           /* across casual and engaged together */
};

/* Measured in test/economy.js, not assumed: a level is cleared about
   four times in five, and the carry-on is only offered on a near miss. */
const PLAY = {
  clearRate: 0.80,
  nearMissShare: 0.50,      /* of losses, how many were close enough to offer */
  heartDryPerActiveDay: 0.5 /* median across the intensity sweep */
};

/* Two ad formats, and the difference between them is not money, it is
   whether the player asked.

   `interstitialRetentionCost` is the one number that decides this whole
   argument. A forced break between levels raises revenue per day and
   lowers the number of days — and since purchases, rewarded views and
   interstitials all scale with days played, the cost lands on all three
   at once, not just on the format that caused it. Published figures for
   casual puzzle put it between five and twenty-five percent depending
   on how often the break comes; a third of that range is a break every
   three levels. */
const ADS = {
  rewardedTake: 0.40,       /* offered a video for a carry-on, how many watch */
  interstitialEvery: 3,     /* levels between forced breaks */
  interstitialRetentionCost: 0.15,
  fill: 0.90
};

/* eCPM — revenue per thousand impressions. The single number that most
   changes the answer, and it is decided by where the players live, not
   by anything in this repository. */
const MARKETS = [
  ['Tier 1  (US, UK, DE)', { rewarded: 14, interstitial: 8 }],
  ['Tier 2  (S. Europe)', { rewarded: 6, interstitial: 3.5 }],
  ['Türkiye / Tier 3', { rewarded: 3, interstitial: 1.5 }]
];

/* In-app purchase, for comparison. Casual puzzle converts badly. */
const IAP = { payerShare: 0.015, spendPerPayer: 5.5 };

/* ---------------- the model ---------------- */

const installs = +process.argv[2] || 1000;

/* Everything downstream scales with how long people stay, so the two
   worlds get their own play volume rather than sharing one. */
function world(days) {
  const levels = installs * days * AUDIENCE.levelsPerDay;
  const losses = levels * (1 - PLAY.clearRate);
  const offers = losses * PLAY.nearMissShare;         /* the 70% gate */
  return {
    days, levels, losses, offers,
    rewarded: offers * ADS.rewardedTake * ADS.fill +
      installs * days * PLAY.heartDryPerActiveDay * 0.5 * ADS.fill,
    interstitials: (levels / ADS.interstitialEvery) * ADS.fill,
    /* a payer's spend follows how much game they got through */
    iap: installs * IAP.payerShare * IAP.spendPerPayer * (days / AUDIENCE.daysPlayed)
  };
}
const clean = world(AUDIENCE.daysPlayed);
const withInter = world(AUDIENCE.daysPlayed * (1 - ADS.interstitialRetentionCost));

const levels = clean.levels, losses = clean.losses, offers = clean.offers;
const rewardedViews = clean.rewarded, heartViews = 0;
const interstitials = withInter.interstitials;

const money = (n, cpm) => n / 1000 * cpm;
const usd = n => '$' + n.toFixed(0);

console.log('\n  ' + installs.toLocaleString('en-US') + ' indirme, ilk ay\n');
console.log('  oynanan bölüm        ' + Math.round(levels).toLocaleString('en-US'));
console.log('  kaybedilen           ' + Math.round(losses).toLocaleString('en-US'));
console.log('  devam teklifi        ' + Math.round(offers).toLocaleString('en-US') +
  '   (%70 hedef barajını geçmiş kayıplar)');
console.log('');
console.log('  ödüllü video izlenme ' + Math.round(rewardedViews + heartViews).toLocaleString('en-US'));
console.log('  bölüm arası reklam   ' + Math.round(interstitials).toLocaleString('en-US') +
  '   (her ' + ADS.interstitialEvery + ' bölümde bir)');
console.log('');

const iap = clean.iap;

console.log('  pazar                  sadece ödüllü    ödüllü+arası      IAP     toplam');
console.log('  ' + '-'.repeat(68));
MARKETS.forEach(([name, cpm]) => {
  const a1 = money(clean.rewarded, cpm.rewarded) + clean.iap;
  const b1 = money(withInter.rewarded, cpm.rewarded) +
             money(withInter.interstitials, cpm.interstitial) + withInter.iap;
  console.log('  ' + name.padEnd(22) +
    usd(money(clean.rewarded, cpm.rewarded)).padStart(12) +
    usd(money(withInter.rewarded, cpm.rewarded) + money(withInter.interstitials, cpm.interstitial)).padStart(16) +
    usd(clean.iap).padStart(11) + usd(Math.max(a1, b1)).padStart(11));
});

console.log('');
console.log('  ' + '-'.repeat(68));
console.log('  ARA REKLAMIN NET ETKİSİ');
console.log('');
console.log('  Reklamsız oynanan gün: ' + clean.days.toFixed(2) +
  '   ara reklamlı: ' + withInter.days.toFixed(2) +
  '   (-' + (ADS.interstitialRetentionCost * 100).toFixed(0) + '%)');
console.log('');
console.log('  pazar                    reklamsız    ara reklamlı        net');
console.log('  ' + '-'.repeat(60));
MARKETS.forEach(([name, cpm]) => {
  const a1 = money(clean.rewarded, cpm.rewarded) + clean.iap;
  const b1 = money(withInter.rewarded, cpm.rewarded) +
             money(withInter.interstitials, cpm.interstitial) + withInter.iap;
  const d = b1 - a1;
  console.log('  ' + name.padEnd(22) + usd(a1).padStart(11) + usd(b1).padStart(16) +
    ((d >= 0 ? '+' : '') + usd(d)).padStart(11));
});

/* The number worth knowing, and the reason this file exists: how much
   retention a forced break may cost before it stops paying for itself.
   Below that line it is free money; above it you are selling days of
   play for pennies an impression. */
console.log('');
console.log('  başabaş — ara reklam kaç puan tutundurma yiyene kadar kârlı:');
MARKETS.forEach(([name, cpm]) => {
  let be = null;
  for (let c = 0; c <= 0.9; c += 0.005) {
    const w = world(AUDIENCE.daysPlayed * (1 - c));
    const a1 = money(clean.rewarded, cpm.rewarded) + clean.iap;
    const b1 = money(w.rewarded, cpm.rewarded) + money(w.interstitials, cpm.interstitial) + w.iap;
    if (b1 < a1) { be = c; break; }
  }
  console.log('    ' + name.padEnd(22) + (be === null ? 'her zaman kârlı' : '%' + (be * 100).toFixed(0)));
});

console.log('');
console.log('  ' + '-'.repeat(68));
console.log('  Ödüllü video oyuncunun istediği şeydir: kaybettiği bölümü');
console.log('  sürdürür, kimseyi bölmez, ve bu oyunun "istemeyene bir şey');
console.log('  satılmaz" ilkesiyle çelişmez.');
console.log('');
console.log('  Ara reklamın bedeli yalnız kendi formatına binmez: satın');
console.log('  almaya ve ödüllü videoya da biner, çünkü üçü de oynanan');
console.log('  gün sayısıyla ölçeklenir. Kaybettiği günü üç kez öder.');
