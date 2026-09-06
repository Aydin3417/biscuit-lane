# Release checklist — what is done, and what only you can do

Split by who has to do it. Everything in the first list is finished and
in the repository. Everything in the second needs an account, a
password, a payment method or a Mac, and none of those are mine to have.

---

## Done — in the repo

| | Where |
| --- | --- |
| iOS platform added, portrait-locked, arm64, bundle `com.biscuitlane.game` | `ios/` |
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

---

## Yours — in order

### 1. Decide about billing *(this is the release blocker)*

Nothing else on this list stops you shipping. This does.

Pick one:

- **Ship without purchases now.** Fastest, and defensible: it gets the game in front of people and the analytics start telling you what to sell. I would hide the paid rows first so nobody taps a shut door — say the word and it is a ten-minute change.
- **Wire it up first.** Then I need from you: a Google Play merchant account, an Apple paid-apps agreement (App Store Connect → Business), and a decision between `@capacitor-community/in-app-purchases` and RevenueCat. The seam in `17-billing.js` picks either up by name, so the code change is small — the accounts are the long pole, and Apple's banking and tax forms in particular can take days.

Either way, **do not sell the Pet Club subscription on "unlimited hearts"** until the lives system actually binds. The economy simulation records zero heart refills across thirty days of ordinary play, so today that promise removes a wait nobody is having.

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

Google Fonts is a web-font request, not data collection, and does not
change either answer. If you later attach a telemetry sink, both answers
change and the privacy policy has to be rewritten first.

### 4. Android signing

You need an upload key and it must never be lost — losing it means you
can never update the app under the same listing.

```bash
keytool -genkey -v -keystore biscuit-lane-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Keep the `.jks` and its passwords in a password manager, not in the
repo — `.gitignore` should already keep them out, but check. Then add a
`signingConfigs` block to `android/app/build.gradle` reading the
passwords from `~/.gradle/gradle.properties`, and turn on Play App
Signing when you first upload.

Ship an **AAB**, not an APK: `node tools/gradle.js bundleRelease`.

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

## What I would still do before you spend money on installs

None of these blocks release. All of them decide whether the people you
pay to acquire are still there on day seven.

1. **Chapter the lane.** Sixty well-tuned levels arranged as a corridor with nothing to walk toward. Six named stretches of ten with a landmark you can see coming is the single biggest retention change available.
2. **Extend the catalogue.** The economy simulation empties the shop on day 28. After that coins accumulate against nothing.
3. **Strip level 1.** Ten concepts before the first swap, in minute one.
4. **Escalate ordinary cascades.** The pet's move is loud now; a seven-chain still feels like a three-chain.
5. **Make the tiles animals.** Six shapes, six colours, one shared face. It is the reason the game reads as a reskin in a screenshot.
