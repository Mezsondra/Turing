# Status & Next Steps

Last updated: 2026-08-22

## Where the project is

The game is playable and monetization is wired end to end, but **nothing is
deployed and no payment or ad account is connected yet**. Everything below was
verified against a running server, not just typechecked.

Run it with `npm run build && npm start`, then open http://localhost:3001.
Admin is at `/admin` using `ADMIN_PASSWORD` from `.env.local`.

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

**Monetization.** $3.99/mo, $19.99/yr, $9.99 lifetime via Stripe (subscription
and one-off modes). Free players get 10 rounds/day and an interstitial every 3
rounds — both decided server-side so a client cannot opt out. With no ad
network configured the interstitial sells Premium instead of showing an empty
frame.

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

### 1. Blocked on you — no code needed

- **Stripe.** Create three prices in the dashboard, then set
  `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_PRICE_LIFETIME` and
  `STRIPE_WEBHOOK_SECRET` in `.env.local`. Checkout returns a clear error until
  then. **No revenue is possible before this.**
- **Decide the ad path.** AdSense is a poor fit — it refuses thin-content sites
  and this game has almost no text. Recommendation: web is subscription-only,
  ads go on mobile via AdMob, which judges apps rather than articles and is
  where rewarded video (the highest-yield format) actually exists. Also worth
  evaluating: publishing to CrazyGames / Poki, which bring their own audience
  and revenue-share.

### 2. Deploy

Nothing has ever run on the dedicated server. Files are in `deploy/`
(systemd unit, Caddyfile, backup cron); the process is in the README. Worth
doing before the mobile work, so there is a live site to point at.

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

## Tests

`npm test` runs eight suites covering matchmaking notification, scoring and
streaks, guest→account migration, AI retry, moderation, blocks/reports/deletion,
human typing timing, and persona variety.
