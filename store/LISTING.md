# Store listing

Everything a Play Console or App Store submission asks for in words,
in both languages the game ships in. Copy from here; do not retype.

The graphics are generated: `node tools/store.js`.

---

## Title

Google Play allows 30 characters, the App Store 30.

```
Biscuit Lane
```

Turkish stores take the same name. It is a place in the game, not a
phrase to translate.

---

## Short description — 80 characters

**English** (77)

```
A match-3 where the cats and dogs on the board are the pets you take home.
```

**Türkçe** (79)

```
Tahtadaki kediler ve köpekler, eve götürüp büyüttüğün hayvanların ta kendisi.
```

---

## Full description — 4000 characters

**English**

```
Somebody has left a basket on the step.

Biscuit Lane is a match-3 puzzle about the animal you choose on the first
screen. Pick a cat or a dog, pick its coat, give it a name — and from
then on it is the face you match on every board, and the one waiting in
the room upstairs when you stop playing.

THE LANE
Sixty handmade levels along a country road, and then a lane that keeps
going. Collect faces, break crates, clear mud, cut back brambles, walk
the little ones home in their baskets. Every tenth level is a gate: a
wooden gate in the hedge that stands open once you have come through it,
so you can see how far you have walked.

THE ROOM UPSTAIRS
Your animal lives there. Feed it, play with it, wash it, let it sleep. It
gets hungry while you are away and pleased when you come back, it grows
from a kitten or a puppy into a full-grown animal, and how you looked
after it decides the temperament it settles into.

It is not decoration. A well-kept animal walks onto the board with you
and brings something with it — more moves, a rocket, a head start on its
own special move. The care and the puzzle are one loop, not two screens.

SIX TO BRING HOME
Six breeds, each with its own move. Adopt a second and it joins the
board; your own animals crowd out the strangers, until every face you
are matching is one of yours.

DRAWN, NOT DOWNLOADED
Every cat, every dog, every crate, every room and every sound in this
game is drawn and synthesised in code as it runs. There is not one image
file or audio file in it. That is why it is small, why it opens instantly
and why it works with the phone in flight mode from the very first
launch.

QUIET ABOUT YOU
No accounts. No advertising. No analytics. Nothing is collected and
nothing is sent — your animals and your progress live on your phone and
nowhere else.

Day and Dusk, English and Turkish, and a symbol on every tile for anybody
who would rather not tell them apart by colour.
```

**Türkçe**

```
Kapının önüne bir sepet bırakmışlar.

Biscuit Lane, ilk ekranda seçtiğin hayvanın etrafında dönen bir eşleştirme
oyunu. Bir kedi ya da köpek seç, tüyünü seç, adını koy — o günden sonra
her tahtada eşleştirdiğin yüz o olur, sen oynamayı bıraktığında üst
kattaki odada seni bekleyen de.

SOKAK
Kır yolu boyunca altmış el yapımı bölüm, sonra devam eden bir sokak.
Yüzleri topla, kasaları kır, çamuru temizle, böğürtlenleri buda,
minikleri sepetleriyle eve yürüt. Her onuncu bölüm bir kapı: çitteki
tahta kapı, bir kez geçtikten sonra açık kalır — nereye kadar
yürüdüğünü görürsün.

ÜST KATTAKİ ODA
Hayvanın orada yaşıyor. Yedir, oyna, yıka, uyut. Sen yokken acıkır, geri
geldiğinde sevinir; yavruyken büyür, koca bir hayvana dönüşür ve nasıl
baktığın onun huyunu belirler.

Bu süs değil. İyi bakılmış bir hayvan tahtaya seninle çıkar ve yanında
bir şey getirir: fazladan hamle, bir roket, kendi özel hamlesine erken
başlangıç. Bakım ve bulmaca iki ayrı ekran değil, tek bir döngü.

EVE GÖTÜRÜLECEK ALTI CAN
Altı cins, her birinin kendi hamlesi var. İkincisini sahiplendiğinde
tahtaya o da katılır; kendi hayvanların yabancıları yavaş yavaş kovar,
sonunda eşleştirdiğin her yüz senin olur.

ÇİZİLİYOR, İNDİRİLMİYOR
Bu oyundaki her kedi, her köpek, her kasa, her oda ve her ses, oyun
çalışırken kodla çiziliyor ve sentezleniyor. İçinde tek bir görsel ya da
ses dosyası yok. Küçük olmasının, anında açılmasının ve daha ilk
açılıştan itibaren telefon uçak modundayken çalışmasının sebebi bu.

SENİN HAKKINDA SESSİZ
Hesap yok. Reklam yok. Analitik yok. Hiçbir şey toplanmıyor ve hiçbir yere
gönderilmiyor — hayvanların ve ilerlemen yalnızca telefonunda duruyor.

Gündüz ve Akşam, İngilizce ve Türkçe, ve renkten ayırt etmek istemeyenler
için her taşta bir sembol.
```

---

## Data safety (Play Console)

Answer the form like this. Every answer is checked against the code in
`privacy.html`, which links to it.

| Question | Answer |
|---|---|
| Does your app collect or share any required user data types? | **No** |
| Is all user data encrypted in transit? | Not applicable — no data leaves the device |
| Do you provide a way for users to request data deletion? | Not applicable — deleting the app deletes everything; Settings also has "Start over" |

Privacy policy URL: `https://aydin3417.github.io/biscuit-lane/privacy.html`

## Content rating

- No violence, no language, no gambling, no user-generated content, no
  social features, no location, no advertising.
- Purchases: only if in-app products are enabled before submitting.
- Expected: **PEGI 3 / ESRB Everyone / USK 0**.

## Category

Games → Puzzle. Tags: match 3, casual, pets, offline.

---

## What only you can do

These need an account, a payment or a private key, and are deliberately
not automated.

1. **Google Play Developer account** — one-off $25.
2. **Signing key** — `keytool -genkey -v -keystore biscuit-lane.jks
   -alias biscuit -keyalg RSA -keysize 2048 -validity 10000`. Keep it and
   its password somewhere you will still have them in five years; losing
   it means never updating this app again. Do not commit it.
3. **Release build** — `npm run pack && npx cap sync && node tools/gradle.js bundleRelease`,
   signed with that key, produces the `.aab` Play wants.
4. **Publish `privacy.html`** at the URL above (GitHub Pages already
   serves the repository root, so pushing it is enough).
5. **In-app products**, if you want them — the code has a billing bridge
   waiting but no plugin installed and no SKUs defined.
