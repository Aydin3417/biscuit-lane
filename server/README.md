# Pawtika's server

Two edge functions and two tables on one Supabase project. That's the whole server. There are no accounts and no cloud saves, and nothing here ever sees a pet's name.

| | What it does | Called from |
|---|---|---|
| `functions/track` | Receives batches of anonymous gameplay events and stores them in `events` | `src/js/18-telemetry.js` |
| `functions/verify-purchase` | Asks Apple or Google whether a purchase is real, then records it in `purchases` so a receipt can't be redeemed twice | `src/js/17-billing.js` (plugin validator) |
| `migrations/…_pawtika.sql` | The two tables (RLS on, no public policies) plus ready-made views: level funnel, retention D1–D30, monetisation, onboarding, errors | Supabase SQL |

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
