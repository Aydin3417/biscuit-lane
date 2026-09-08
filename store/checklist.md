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
| Version aligned at **1.0.0 (build 1)** across Android, iOS and the crash reports | `build.gradle`, `project.pbxproj`, `15-save.js` |
| App icon and launch image for iOS, drawn from the game's own logo | `tools/icon.js` → `ios/App/App/Assets.xcassets/` |
| Android launcher icons, 5 densities, adaptive + legacy + round | `tools/icon.js` → `android/.../mipmap-*` |
| Store screenshots: Play phone 1080×1920, iPhone 6.7" 1290×2796, iPad 12.9" 2048×2732 | `shots/store/` |
| Feature graphic 1024×500 | `shots/store/feature-graphic-1024x500.png` |
| Listing copy, EN + TR, both stores, inside character limits | `store/LISTING.md` |
| Privacy policy | `privacy.html` |
| Content-rating answers | `store/LISTING.md`, bottom |
| Telemetry and crash capture, with an opt-out and no network | `src/js/18-telemetry.js` |
| Debug APK builds green | `npm run android:apk` |
| **Release signing wired**, reading the key from outside the repo | `android/app/build.gradle` |
| **Release AAB builds green** (unsigned until you make a key) | `node tools/gradle.js bundleRelease` |
| **Purchases close properly** — every sale is consumed, so Play cannot auto-refund it after three days | `src/js/17-billing.js` |
| **Restore actually restores**, on the button and on every launch | `17-billing.js`, `70-boot.js` |
| **The save survives the OS**, mirrored to native Preferences | `src/js/15-save.js` |
| **Two reminders**, asked for at the out-of-hearts moment only | `src/js/16-notify.js` |
| **A review prompt**, once ever, after a three-star clear | `60-ui.js`, `maybeAskForAReview` |
| Grooming: every coat and eye colour buyable, per animal | `10-data.js` `GROOM`, `60-ui.js` `groomSheet` |
| The economy re-measured with the season book in it | `test/economy.js` |

---

## Yours — in order

### 1. Decide about billing *(this is the release blocker)*

Nothing else on this list stops you shipping. This does.

The code side is finished and tested: `test/till.js` covers it, purchases
are consumed so Play cannot auto-refund them, restore works from the
button and from every launch, and every product asks the store for its
local price. What is missing is not code. It is accounts.

Pick one:

- **Ship without purchases now.** Fastest, and defensible: it gets the game in front of people and the counters start telling you what to sell. The shop already hides its priced rows when no store is behind the build and shows "here is how treats are earned" instead — that is `earnTreatsSheet`, and it needs no change.
- **Wire it up first.** Then I need from you: a Google Play merchant account, an Apple paid-apps agreement (App Store Connect → Business), and a decision between `@capacitor-community/in-app-purchases` and RevenueCat. The seam in `17-billing.js` picks either up by name, so the code change is small — the accounts are the long pole, and Apple's banking and tax forms in particular can take days.

**Declare all four products as CONSUMABLE**, including the season book.
`treats_pocket_40`, `treats_bag_110`, `treat_jar`, `season_book`. The book
is per-season and the season resets, so a non-consumable would be
refused as "already owned" the second month. There is no non-consumable
in this game, deliberately: it is the only product type that needs no
account behind it.

**Do not sell anything on "unlimited hearts".** The economy simulation
records zero heart refills across thirty days of ordinary play at six
levels a day; the wall is real for somebody playing twelve or more, and
that is who the refill is for.

### 2. Host the privacy policy

Publish `privacy.html` — GitHub Pages is fine and
free. Before you do:

- Replace `[YOUR CONTACT EMAIL]` with a real address. Both stores check it.
- Delete the two `> **Developer note**` blocks.

Then paste the URL into Play Console and App Store Connect. Both refuse
to publish without it.

### 3. Answer the data questions

With this build, both answers are the simple ones:

- **Play → Data safety: "No data collected, no data shared."** True today: the telemetry has no sink and makes no network request.
- **Apple → App Privacy: "Data Not Collected."** Same reason.

The two reminders do not change this. A local notification is scheduled
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

### 6. Both consoles

- Google Play: $25, once, ever. **New personal developer accounts must run a closed test with 12 testers for 14 continuous days before they can go to production** — start that clock early, it is the longest lead time on this whole list.
- Apple: $99/year, and a review that usually takes 24–48 hours.

Upload from `shots/store/`: `play-phone/` for Play, `ios-6.7/` and
`ios-ipad/` for Apple.

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
2. **More furniture.** Grooming bought the catalogue two more weeks — it runs dry around day 41 now rather than day 23 — but the room is still eight objects, and it is the screen a player looks at between every level. This is the one thing on the list I would not do without you looking at it: every piece is a hand-drawn path and the house style is yours.
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
- **The animals have an edge**: an ink line round every silhouette, a lash line and crisp catchlight in the eye, a drawn mouth, breed markings on the body. Three generated concept sheets are in the session notes as references; the next step up is an illustrator with those as the brief.
- **A save that cannot be read is kept**, not overwritten; a chain is felt as it deepens; the small print is 13px.
