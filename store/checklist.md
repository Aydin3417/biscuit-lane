# Release checklist — what is done, and what only you can do

Split by who has to do it. Everything in the first list is finished and
in the repository. Everything in the second needs an account, a
password, a payment method or a Mac, and none of those are mine to have.

---

## Done — in the repo

| | Where |
| --- | --- |
| iOS platform added, portrait-locked, arm64, bundle `com.pawtika.game` | `ios/` |
| Android platform, portrait-locked, hardware back button handled | `android/` |
| Version aligned at **1.1.0 (build 2)** across Android, iOS and the crash reports | `build.gradle`, `project.pbxproj`, `15-save.js` |
| App icon and launch image for iOS, drawn from the game's own logo | `tools/icon.js` → `ios/App/App/Assets.xcassets/` |
| Android launcher icons, 5 densities, adaptive + legacy + round | `tools/icon.js` → `android/.../mipmap-*` |
| Store screenshots: Play phone 1080×1920, iPhone 6.7" 1290×2796, iPad 12.9" 2048×2732, EN + TR | `store/graphics/` (`node tools/store.js`) |
| Feature graphic 1024×500 | `store/graphics/feature-graphic.png` |
| Listing copy, EN + TR, both stores, inside character limits | `store/LISTING.md` |
| Privacy policy | `privacy.html` |
| Content-rating answers | `store/LISTING.md`, bottom |
| Telemetry and crash capture, with an opt-out and no network | `src/js/18-telemetry.js` |
| Debug APK builds green | `npm run android:apk` |
| **Release signing wired**, reading the key from outside the repo | `android/app/build.gradle` |
| **Release AAB builds green** (unsigned until you make a key) | `node tools/gradle.js bundleRelease` |
| **Purchases close properly** — every sale is consumed, so Play cannot auto-refund it after three days | `src/js/17-billing.js` |
| **Restore actually restores**, on the button and on every launch | `17-billing.js`, `70-boot.js` |
| **Purchases wired to a real plugin** — `cordova-plugin-purchase`, straight to Play Billing and StoreKit; release AAB builds with it | `17-billing.js`, `package.json` |
| **Granted before closed, and never paid twice** — transaction ids kept in the save | `15-save.js`, `test/till.js` |
| **The save survives the OS**, mirrored to native Preferences | `src/js/15-save.js` |
| **Three reminders** (hearts back, the walk, and one "your animal is waiting" after three days away), offered at the out-of-hearts moment and after the first daily walk | `src/js/16-notify.js` |
| **A review prompt**, once ever, after a three-star clear | `60-ui.js`, `maybeAskForAReview` |
| Grooming: every coat and eye colour buyable, per animal | `10-data.js` `GROOM`, `60-ui.js` `groomSheet` |
| The economy re-measured with the season book in it | `test/economy.js` |

---

## Yours — in order

### 1. Turn the till on *(the blocker for earning anything)*

The plugin is in. `cordova-plugin-purchase` 13.18 talks to Play Billing
and StoreKit directly — no third-party service, so the privacy policy
and the data forms stay true — and `17-billing.js` is written against
its type definitions rather than guessed at. The release AAB builds
with it (5.1 MB, `com.android.vending.BILLING` in the merged manifest),
and on iOS it is wired into `CapApp-SPM/Package.swift` with StoreKit
linked.

The advice that used to be here named `@capacitor-community/in-app-purchases`.
That package is not on npm, and the old seam would not have worked with
any plugin that is. Both are gone.

What is left is accounts, and nothing in the build changes for them:

- **Google Play**: a payments profile (merchant account) on the developer
  account, then Monetize → Products → In-app products — the seven below.
- **Apple**: the Paid Apps agreement, banking and tax in App Store
  Connect → Business (this can take days), then the seven as Consumable
  in-app purchases, each with a review screenshot.

Until a store answers with a price for at least one product, the shop
stays in its "here is how treats are earned" state. Shipping before the
products are live is safe, and it is the same build.

A purchase is **granted and saved first, closed with the store second**,
and its transaction id goes into the save in the same write as the
treats. A kill between the two leaves the purchase open; the next launch
finds it, closes it, and does not pay twice. `test/till.js` reads the
source to hold every buy site to that order.

**Before real money:** Play Console → Settings → License testing, add
your own Google account. Buy once, cancel once, then kill the app between
the payment sheet closing and the toast, and relaunch — the treats should
arrive once. On iOS, the same with a Sandbox account (App Store Connect →
Users and Access → Sandbox).

**Declare all seven products as CONSUMABLE**, including the season book
and the welcome pack: `treats_pocket_40`, `treats_bag_110`,
`treats_tin_240`, `treats_sack_520`, `starter_pack`, `treat_jar`,
`season_book`. The book
is per-season and the season resets, so a non-consumable would be
refused as "already owned" the second month. There is no non-consumable
in this game, deliberately: it is the only product type that needs no
account behind it.

**Unlimited hearts are sold now, and only as time inside something
else.** This used to say never. It rested on the economy file reporting
that a player on twelve levels a day ran dry sixty times a month — which
was that file charging a heart for every attempt, when the game gives one
back for every win. Measured with the game's own rule, hearts bind for
somebody playing twenty-four levels a day or more, and that is who a
stretch of unlimited hearts is worth something to. It comes inside the
welcome pack (1 hour), the biscuit tin (1 hour), the feed sack (3 hours)
and the book's paid column (two hours in three pieces). There is no
product that is only unlimited hearts.

### 2. Host the privacy policy

It is already published: `https://aydin3417.github.io/biscuit-lane/privacy.html`
answers 200 (checked 11 Sep 2026). Contact address filled in, developer
notes gone. The listing used to give `/pawtika/privacy.html`, which is a
404 and would have been refused by both stores; it is corrected there.
Checked against the live page on 11 Sep: the contact address is there and
the developer notes are gone. The one sentence added since, about keeping
transaction numbers, reaches the live page when the branch GitHub Pages
serves is pushed.

Then paste the URL into Play Console and App Store Connect. Both refuse
to publish without it.

### 3. Answer the data questions

With this build, both answers are the simple ones:

- **Play → Data safety: "No data collected, no data shared."** True today: the telemetry has no sink and makes no network request.
- **Apple → App Privacy: "Data Not Collected."** Same reason.

Purchases do not change what the app itself does: the plugin has no
server and no validator is set, so nothing about a purchase leaves the
phone except through the store's own sheet, and the game keeps only the
store's transaction number, in the save, on the device. Read the store's
own guidance on "purchase history" when you fill the form in, and answer
from that — I have not had the form in front of me.

The three reminders do not change this. A local notification is scheduled
and delivered by the phone itself — no push service, no token, no server
— so nothing about them is collected or shared. Play will still ask you
to tick the notifications permission on the Android form; that is a
permission declaration, not a data declaration.

The fonts are inside the page, so the game fetches nothing at all while
it plays. If you later attach a telemetry sink, both answers change and
the privacy policy has to be rewritten first.

### 4. Android signing

You need an upload key and it must never be lost — losing it means you
can never update the app under the same listing.

```bash
keytool -genkey -v -keystore pawtika-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

The `signingConfigs` block is already in `android/app/build.gradle` and
`.gitignore` already refuses `*.jks` and `keystore.properties`. All it
needs is four lines in `~/.gradle/gradle.properties`, which is outside
this repository:

```
BL_STORE_FILE=C:/somewhere/safe/pawtika-upload.jks
BL_STORE_PASSWORD=...
BL_KEY_ALIAS=upload
BL_KEY_PASSWORD=...
```

Until those exist the release build still succeeds and produces an
**unsigned** bundle, and `node tools/gradle.js bundleRelease` says so
before it starts rather than leaving you to find out at the upload.

Keep the `.jks` and its passwords in a password manager. Turn on Play App
Signing when you first upload.

Ship an **AAB**, not an APK: `node tools/gradle.js bundleRelease` —
it lands in `android/app/build/outputs/bundle/release/`.

### 5. iOS needs a Mac

There is no way around this and I want to be plain about it rather than
leave you to discover it: **the iOS app cannot be built, signed or
uploaded from Windows.** Xcode is macOS-only. The `ios/` folder is
complete and correct and will open straight away, but it needs one of:

- a Mac, or
- a hosted Mac (MacStadium, Scaleway) for the ten minutes an upload takes, or
- a CI runner with a macOS image (GitHub Actions gives free macOS minutes on public repos).

You also need an **Apple Developer Program membership — $99/year**, which
Google's $25 one-off does not cover. On the Mac: `npm run ios`, set the
signing team in Xcode, then Product → Archive → Distribute.

Use `npm run ios` rather than opening `ios/App` in Xcode straight from a
fresh clone. The iOS sources of the purchase plugin are generated by
`npx cap sync` and are not in the repository (`ios/.gitignore` refuses
`capacitor-cordova-ios-plugins`), so until a sync has run, Xcode cannot
resolve `CordovaPluginPurchase` and the build stops before it starts.

### 6. Both consoles

- Google Play: $25, once, ever. **New personal developer accounts must run a closed test with 12 testers for 14 continuous days before they can go to production** — start that clock early, it is the longest lead time on this whole list. Checked 11 Sep 2026 against Play Console Help: still 12 testers for 14 continuous days, per app, for personal accounts made on or after 13 November 2023. An organization account is exempt, but it needs a D-U-N-S number, which is a wait of its own.
- Fees: both stores keep 15% of the first USD 1 million a year. Google applies it by itself; Apple only once you enroll in the App Store Small Business Program, so enroll before the first sale rather than after.
- Apple: $99/year, and a review that usually takes 24–48 hours.

Upload from `store/graphics/`: the files at the top of that folder are
Play's 1080×1920, `ios-6.7/` and `ios-ipad/` are Apple's. `shots/store/`
is an older tool's output and is two art passes behind — the animals in it
are not the animals in the build. Re-run `node tools/store.js` after any
change to the drawing code, and look at one before you upload five.

### 7. Tell me when the analytics has somewhere to go

The counters run and the crash handler is live, but with no sink the
events only sit on the device. When you have picked somewhere for them —
your own endpoint, a Supabase table, anything that accepts a POST — it is
one function in `18-telemetry.js` and I will wire it, along with the
privacy policy and store answers that have to change with it.

Until then you can read any device by hand: open the game, and in the
console `BL.TRACK.dump()` gives you everything it has seen.

---

### 8. Two links, once you have listings

`STORE_LINKS` in `src/js/10-data.js`. The Play address is already there
and starts working the day the listing goes live. Apple's is a number
App Store Connect assigns when you create the app record — paste it in
as `https://apps.apple.com/app/id0000000000`.

Until each one exists, the review prompt and the "tell somebody about
them" button are **hidden on that platform**, deliberately: a rate-us
button that opens a 404 is worse than no button.

---

## What I would still do before you spend money on installs

None of these blocks release. All of them decide whether the people you
pay to acquire are still there on day seven.

1. **Make the tiles animals.** Six shapes, six colours, one shared face. It is the reason the game reads as a reskin in a screenshot.
2. ~~**More furniture.**~~ Done 24 Sep 2026: the room has twenty pieces now, twelve of them generated pictures in the house style (README, "The first pictures"); the catalogue went from 15,503 coins to 17,533.
3. **Read the counters before changing anything else.** `BL.TRACK.dump()` on a device, or wire the sink. Everything above this line is measured against a simulation; none of it is measured against people.

---

## Done since the last pass

Kept here so the list above stays a list of what is left.

- **Chaptered the lane.** Six named stretches of ten, each with its own ground.
- **Extended the catalogue.** Room themes, collars, and then grooming — every coat and eye colour, per animal. Day 23 → day 41.
- **Stripped level 1.** One goal, 7×7, one concept.
- **Fixed the season book giving itself away** on a cancelled purchase, and put `test/till.js` around it.
- **Anchored the season to the player**, not to a global calendar.
- **Retuned the lane to a player who cannot see cascades** (`test/_solver.js` `human`, the default now). Levels 3, 9 and the first gate lost their score goals; overall clear for that player 66% → 83%, no level under 50%.
- **One-volley finale.** Last move to results card 12–38 s → 6 s; a tap hurries it. Whole-board clears are staged rather than instant.
- **Six play scenes**, one per stretch, day and dusk.
- **Cards that answer**: rolling score, a jumping animal, a sad one on a loss, a "next time" line by the goal that fell shortest, an honest carry-on price.
- **A level survives a kill**: board, moves and goals resume on the next launch; the heart is not lost twice.
- **Seven kept promises**: map treat pips, `family6`, season rollover claims, streak grace and DST, walk reminder for the lapsed, a notification pre-prompt, badge thresholds.
- **iOS haptics** through `@capacitor/haptics` (an iPhone web view has no `navigator.vibrate`).
- **Version 1.1.0 (build 2)** across Android, iOS and the crash reports.
- **Fitted the run to the player, level by level** (`test/fit-run.js` → `src/js/13-run-fit.js`). The model missed its own targets by sixteen points on average; measured, every level from 61 to 360 lands within four, every gate within eleven, and the rhythm reads (relief 84%, gates 54%). Fourteen crate levels needed more crates rather than fewer moves.
- **The first move is performed**: a hand presses and slides the hint on levels 1-3, and on level one it comes the moment the cards close.
- **Forty-four inline translations** moved into the table; `test/strings.js` now fails on a new one.
- **The tray is painted once**, the companion at thirty, the map draws what is on screen (5.7 → 3.0 ms a scroll frame at level 300).
- **A voice per breed**, and the breed picker plays it.
- **Six moods for six stretches**: the music loop follows the chapter, the way the scene does.
- **The animals are stickers now**: rebuilt flat with a thick warm line, big eyes, breed markings on head, body, legs and tail, after three generated concept sheets all came back in that style. Still no image files; the sheets are the brief if an illustrator is ever hired.
- **A save that cannot be read is kept**, not overwritten; a chain is felt as it deepens; the small print is 13px.
- **The run deals every kind.** Past level 60 there was one mud level and no molehill in 400; now each of the seven kinds turns up about 57 times, on four board sizes, with varied score goals and a second goal on some obstacle levels. Refitted, mean miss 5%.
- **A board you can read.** The well is aubergine instead of brown, so crates, mud and bramble stand off it; the walker above the board is no longer cut off at the legs; the home screen's care card is one row. Store shots redone: a level in progress, and a three-star win in the fifth slot instead of the home screen in the dark.
