# Status & Next Steps

Last updated: 2026-08-24

## Where the project is

The game is live at https://turing-test.app and payments work end to end
against a real Stripe account. No ad network is connected, and Stripe is still
in a **sandbox**, so no real money has moved. Everything below was verified
against the running server, not just typechecked.

Locally: `npm run build && npm start`, then http://localhost:3001. Admin is at
`/admin` using `ADMIN_PASSWORD` from `.env.local`.

### How it runs in production

- Host `Transkribe`, code in `/sdc/turing`, served over HTTPS by Caddy.
- Managed by **pm2**, not the systemd unit in `deploy/` - that unit was never
  installed and still points at `/srv/turing`. `pm2 logs turing` for output,
  `pm2 restart turing` after a deploy. Use `pm2 stop turing` before poking at
  the process: pm2 restarts it instantly, so `pkill` turns into a fight with
  the supervisor and fills the log with EADDRINUSE.
- **`PORT=3002`**, because an unrelated app on the same box has held 3001 since
  before this deploy. The default in the README would collide.
- Deploy is `git pull && npm run build && pm2 restart turing`. Env comes from
  `.env.local` via `--env-file`, which node reads at startup, so any restart
  picks up an edit; pm2's `--update-env` is unrelated and not needed.
- Stripe lives in its **own Stripe account**, separate from the other sites on
  this box. Nothing done in it can affect them.

### Done

**Security.** Admin password required (no default) and compared in constant
time; API keys are masked in admin responses and cannot be wiped by a masked
round-trip; `JWT_SECRET` required; CORS restricted to `CLIENT_URL`; rate limits
on auth, queue joins, messages and reports; message length capped before it
reaches a paid API.

**Core game.** Fixed the bug where half of solo players hung on "Searching…"
forever. The server owns the round clock, so both players in a human match stop
at the same instant. Scores, streaks and history persist per device with no
signup, and a guest keeps all of it when they register.

**Anti-cheat.** Scoring is entirely server-side. Guessing before the round ends
is rejected; a replayed guess is ignored by the database primary key, not by
application logic.

**Reverse role.** In a human match you are also being judged. Convincing your
partner you were a bot earns a deception bonus.

**Monetization.** $2.99/mo, $19.99/yr, $50 lifetime via Stripe (subscription
and one-off modes). Free players get 10 rounds/day and an interstitial every 3
rounds — both decided server-side so a client cannot opt out. With no ad
network configured the interstitial sells Premium instead of showing an empty
frame.

All three plans were bought and cancelled end to end in the Stripe sandbox.
Three bugs surfaced doing it, all fixed:

- The webhook handler mapped every Stripe status except `active`/`trialing` to
  `canceled`, which revoked premium from customers who had paid. A new
  subscription is `incomplete` until the first charge (or 3DS) clears, and
  `past_due` is Stripe retrying the card during dunning. Now only terminal
  states downgrade, and unknown ones do nothing.
- Nothing in the frontend called `/api/payment/create-portal`, so a subscriber
  had no way to cancel except emailing us. Settings now has **Manage
  Subscription**.
- Stripe's constructor throws on an empty key, and the module is imported from
  the route table, so an unset `STRIPE_SECRET_KEY` crashed the server at boot.

**App store compliance.** Report and block (blocks are symmetric for
matchmaking), a moderation queue at `/api/admin/reports`, message filtering,
in-app account deletion, and a 17+ age gate.

**AI realism.** Persona prompt that refuses arithmetic, denies being a bot
without over-explaining, and ignores prompt injection. Replies land at 39–46
WPM instead of 400. Each match generates a different person (name, job, mood,
typing style, habit) with a consistent typing speed. The AI does not always
speak first — it used to, which was a perfect tell. Some opponents ignore a
message or drift off for 4–10 seconds. Round length varies 51–75s.

## Next steps

### 1. Take Stripe live

A sandbox is a separate environment: **nothing in it carries over**. In the
live account, recreate from scratch:

- The three products/prices — new `price_...` ids.
- The webhook endpoint at `https://turing-test.app/api/payment/webhook`, with
  exactly `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted` — new
  `whsec_...`.
- The Customer Portal config (Settings → Billing). Keep **cancel at end of
  billing period**: the customer paid for the period, and the code deliberately
  keeps them premium until it ends.
- `sk_live_...`, the new price ids and the new webhook secret in `.env.local`,
  then `pm2 restart turing`.

Two dashboard settings that cost real money if skipped:

- **Statement descriptor.** It currently reads `Stripe`, which is what the
  customer sees on their bank statement. Nobody recognises that weeks after
  buying a game, and unrecognised charges become chargebacks. Set it to
  something like `TURING TEST` under Settings → Business → Public details.
- **Currency conversion.** The sandbox lifetime sale showed $50 settling as
  £36.69 with £2.09 in fees — 5.7%, not the ~3% headline, because Stripe
  converts USD into a GBP payout on top of the international card rate. Either
  add a USD bank account so it settles without converting, or accept it.
  It hits the $2.99 monthly plan hardest, which is one more reason the yearly
  plan carries the "best value" badge.

Still untested: the **Manage Subscription** button, against the sandbox
lifetime customer, once the portal config is saved.

### 2. Decide the ad path — blocked on you, no code needed

AdSense is a poor fit — it refuses thin-content sites and this game has almost
no text. Recommendation: web is subscription-only, ads go on mobile via AdMob,
which judges apps rather than articles and is where rewarded video (the
highest-yield format) actually exists. Also worth evaluating: publishing to
CrazyGames / Poki, which bring their own audience and revenue-share.

### 3. Upgrade moderation before any real launch

`server/moderation.ts` is a wordlist, not a classifier. It catches slurs and
contact-sharing and nothing subtler. It exists because stores require *a*
filtering mechanism alongside report/block. Replace it with an LLM moderation
call on flagged or sampled messages. **Treat this as required, not optional.**

### 4. Mobile (Capacitor)

Needs Xcode / Android Studio locally, so it is a session at your desk.
Capacitor wraps the existing build; add `@capacitor-community/admob` and
RevenueCat. Note this is a **second payment integration, not a port** — Apple
and Google require their own IAP for digital goods, so Stripe stays web-only
and the entitlement check has to accept either source.

Still needed for submission: a privacy policy, an EULA, and a published abuse
contact with a 24-hour response commitment.

### 5. Deferred gameplay, in rough value order

- Leaderboard (daily/weekly) — accounts now exist, so it can be cheat-resistant
- Daily challenge — one fixed opponent everyone faces
- AI difficulty tiers, sellable as a Premium unlock

## Known limits, accepted on purpose

- **Single instance only.** Matches live in memory and the database is a local
  SQLite file. Correct until one machine strains; then matches move to Redis
  and the database to Postgres.
- **Guest identity is self-asserted.** Clearing localStorage yields a fresh
  identity. Fine for persistence, not sufficient for a money-carrying
  leaderboard — that needs real accounts, which exist.
- **Auth reloads the page** rather than reconnecting the socket in place.
  One line, and correct, versus fiddly listener re-registration.
- **`admin-config.json` is gitignored** because it holds API keys. The prompts
  live in `server/adminConfig.ts` defaults so a fresh deploy gets them; admin
  edits at runtime are machine-local and are not backed up by git.

## Refunds and chargebacks

Neither is automated, and neither is visible from inside the app. A refund in
Stripe does **nothing** to the database, so a refunded buyer keeps premium
until you revoke it by hand:

```bash
sqlite3 /sdc/turing/turing.db \
  "UPDATE subscriptions SET plan = 'free', status = 'expired',
   updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
   WHERE user_id = (SELECT id FROM users WHERE email = 'buyer@example.com');"
```

Entitlement needs `plan='premium'` AND `status='active'`, so that ends it. For
a subscription, cancel it in Stripe too or billing continues.

A chargeback (`charge.dispute.created`) is the same manual fix, but you only
learn about it from Stripe's email — do not filter those.

Automating this is a `charge.refunded` handler, maybe a dozen lines. Not worth
it while refunds are rare enough to remember individually; the first week two
happen, write it.

## Tests

`npm test` runs nine suites covering matchmaking notification, scoring and
streaks, guest→account migration, AI retry, moderation, blocks/reports/deletion,
human typing timing, persona variety, and Stripe subscription status mapping.
