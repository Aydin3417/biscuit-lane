# Pawtika's server

Two edge functions, two tables and one public file on one Supabase project. That's the whole server. There are no accounts and no cloud saves, and nothing here ever sees a pet's name.

| | What it does | Called from |
|---|---|---|
| `functions/track` | Receives batches of anonymous gameplay events and stores them in `events` | `src/js/18-telemetry.js` |
| `functions/verify-purchase` | Asks Apple or Google whether a purchase is real, then records it in `purchases` so a receipt can't be redeemed twice | `src/js/17-billing.js` (plugin validator) |
| `migrations/…_pawtika.sql` | The two tables (RLS on, no public policies) plus ready-made views: level funnel, retention D1–D30, monetisation, onboarding, errors | Supabase SQL |
| `config/live.json` | The live-tuning file: move corrections, payout multipliers, the nap card's level, a notice — read once per launch from the public `config` bucket (see "Live tuning") | `src/js/14-tune.js` |

**Deployed 3 Oct 2026** to the project `emkdfbpzlreozepcoykn` (organisation "Pawtika", Ireland, free plan), through the dashboard's SQL editor and function editor. `BACKEND` in `src/js/10-data.js` points at it. Both functions have "Verify JWT with legacy secret" turned off, as `config.toml` says, because the game sends the publishable key, which is not a JWT.

Checked the same day: a batch from the game itself landed in `events` and showed up in `v_level_funnel`; `verify-purchase` asked Apple about a made-up receipt and refused it (status 21002), and refused an unknown product and a missing receipt. A browser on localhost does not send unless `pawtika-debug` is set, so the test suites stay out of the table. The 133 rows from that check (installs `1` and `166198667011`) are still there; `delete from public.events where install in (1, 166198667011);` removes them.

To change a function later, edit the file here and paste it into the dashboard editor, or use the CLI steps below against the same project.

## Setting it up (about 10 minutes)

1. **A project.** On the free plan an account can have two active projects. Pause one you don't use, or create this one on a paid plan. Pick a region close to your players (Frankfurt `eu-central-1` for Turkey).
2. **The CLI**, once: `npm i -g supabase`, then `supabase login`.
3. **Link and push** from the repository root:
   ```bash
   supabase --workdir server link --project-ref <project-ref>
   supabase --workdir server db push
   supabase --workdir server functions deploy track
   supabase --workdir server functions deploy verify-purchase
   ```
4. **Google Play verification** (optional but recommended). Either:
   - `supabase --workdir server secrets set GOOGLE_SERVICE_ACCOUNT="$(cat play-service-account.json)"`, using a service account invited in Play Console → Users and permissions, with "View financial data"; or
   - `supabase --workdir server secrets set GOOGLE_PLAY_PUBLIC_KEY=<base64 licensing key>`, found in Play Console → Monetisation setup.

   Apple needs nothing.
5. **Tell the game where it is.** In `src/js/10-data.js`, set `BACKEND.url` to `https://<project-ref>.supabase.co` and `BACKEND.key` to the project's publishable (or legacy anon) key, from Project Settings → API. Both are public by design. Then `npm run sync` and build.

## Reading it

In the dashboard's SQL editor:

```sql
select * from v_level_funnel;     -- starts / wins / losses / quits / average attempt per level
select * from v_retention;        -- D1, D3, D7, D14, D30 by install day
select * from v_furthest_level order by furthest;  -- where players stop
select * from v_monetisation where day > now() - interval '7 days';
select * from v_onboarding;
select * from v_errors limit 50;
```

## What changes in the store forms once this is on

- **App Store privacy.** Collect "Usage Data → Product Interaction" and "Diagnostics → Crash Data": not linked to the user, not used for tracking. "Purchases → Purchase History" is also not linked (the transaction id is stored, and nothing identifying the person).
- **Play Data safety.** App activity (app interactions), App info and performance (crash logs): collected, not shared, optional (the Settings switch), and encrypted in transit.
- `privacy.html` already describes this.

## Live tuning

Every number in the game is compiled into the bundle, and the bundle is what the store has. Twice that has been the wrong shape: the molehill goal shipped broken while every harness said it was fine, and the fix was a build that then sat in review — two days the quick time, three weeks the slow one. A level six moves short is a wall for every player who reaches it until the review is over.

So the game reads one small JSON file from this project at every launch, in the background, and applies it within bounds. It is served from Supabase Storage, from a public bucket called `config`, at

```
https://<project-ref>.supabase.co/storage/v1/object/public/config/live.json
```

`src/js/14-tune.js` fetches it after the save has loaded, never blocking boot. The last copy that validated is kept in the save (`SAVE.tune`), so a phone offline, or a bucket that is down, plays the same game it played yesterday rather than snapping back to the compiled numbers. A browser on localhost does not fetch unless `pawtika-debug` is set — the same gate telemetry uses — so the test suites measure the game as built, never whatever is in the bucket today.

### The file

`config/live.json` in this directory is the sample, with everything at its neutral value. The whole schema:

```json
{
  "v": 1,
  "moves": { "17": 3, "42": -2, "daily": 1 },
  "pay": { "coin": 1.0, "treat": 1.0, "nap": 1.0 },
  "nap": { "from": 3 },
  "notice": { "min": "1.3.0", "en": "A new version is out.", "tr": "Yeni sürüm çıktı." }
}
```

| Key | Meaning | Range the game enforces |
|---|---|---|
| `v` | Schema version. Must be `1`; any other value and the whole file is ignored. | — |
| `moves.<level>` | Added to that level's move budget. `<level>` is a level number (`"17"`) or `"daily"` for the walk. Levels not listed are unchanged. | Integer, clamped to −6 … +6; the result never drops below 8 moves |
| `pay.coin` | Multiplies the coins a cleared level and the daily walk pay | 0.5 … 2.0 |
| `pay.treat` | Multiplies the treats a three-star and the walk pay | 0.5 … 2.0 |
| `pay.nap` | Multiplies what a nap board pays (`NAP_PAY` in `src/js/62-nap-ui.js`) | 0.5 … 2.0 |
| `nap.from` | The level the nap card appears on the home screen from | 1 … 60, default 3 |
| `notice` | A sentence shown to players on a build older than `min`, in the player's language; `null` or missing for none | `min` is `major.minor.patch`; `en` is required, `tr` falls back to it; cut at 240 characters |

Every field is optional except `v`. Payouts are rounded to whole numbers after the multiplier, and anything that paid at all still pays at least one.

**The game clamps everything, so a typo cannot break it.** `60` where `6` was meant becomes `+6`; `"nine"` where a number was meant is dropped; `pay.coin: 0` becomes `0.5`; a key the game does not know is ignored; a file that is not a JSON object with `v: 1` is ignored entirely and the previous copy stays in force. None of this can throw. The ranges are the ones the harnesses have measured as safe (±6 moves is about a forty-point swing in clear rate, half-to-double keeps the ninety-day economy between six weeks and six months); anything outside them is a design change and goes through `node test/run-all.js` and a build. The clamps themselves are tested by `node test/live-tune.js`.

### Creating the bucket (once)

In the dashboard: Storage → New bucket → name `config`, **Public bucket** on, file size limit 64 KB, allowed MIME type `application/json`. Or in the SQL editor:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('config', 'config', true, 65536, array['application/json']);
```

A public bucket lets anyone *read* `live.json`, which is the point — the game sends only the publishable key. Writing stays behind the dashboard login and the service role: do not add an insert or update policy on `storage.objects` for this bucket, and nothing in it is secret.

**CORS.** Public object reads go through `/storage/v1/object/public/…`, which Supabase serves with `Access-Control-Allow-Origin: *`, so the game can fetch it from `capacitor://localhost`, `https://localhost` and the web build without any configuration. If the file ever moves to a host of your own, that header is the one it needs. The game fetches with `cache: 'no-store'`; Supabase's CDN still holds a public object for up to an hour after an upload, so a change can take that long to reach a phone that launches right away.

### Uploading a change

Edit `server/config/live.json`, run the test, then upload with `--upsert` so the second time overwrites the first:

```bash
node test/live-tune.js
supabase --workdir server storage cp ./config/live.json ss:///config/live.json --upsert \
  --content-type application/json
```

(`ss:///` is the CLI's own scheme for the linked project's storage; the project must be linked as in step 3 above.) Or in the dashboard: Storage → `config` → Upload file, replacing `live.json`. Then confirm it is live from any machine:

```bash
curl -s https://<project-ref>.supabase.co/storage/v1/object/public/config/live.json
```

Keep the file in this directory in sync with what is uploaded: the repository is the record of what the live game was doing and when, and a correction that stays in the bucket for months should become a change to `LEVELS` at the next build, not a permanent patch.
