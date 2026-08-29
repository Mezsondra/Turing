# Status & Next Steps

Last updated: 2026-08-29

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
- Deploy is `git pull && npm run build && pm2 restart turing`. Schema changes
  apply themselves on boot from `runMigrations` in `server/database/db.ts`, so
  there is never a separate migration step - but read `pm2 logs turing` after a
  restart, because a migration that throws is caught and ignored by design.
- Env comes from
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

**Accounts.** Sign in with a one-time email code (Resend) or with Google.
Passwords still work; the code path exists so nobody has to invent one.

**Onboarding.** A four-slide intro that ends on the community rules, so a new
player meets the conduct standard before their first stranger.

**App store compliance.** Report and block (blocks are symmetric for
matchmaking), a moderation queue at `/api/admin/reports`, message filtering,
in-app account deletion, and a 17+ age gate. Privacy policy at `/privacy.html`
and terms at `/terms.html`, linked from Settings and accepted at the age gate.

**Bans.** "Actioned" in the moderation queue now actually suspends the reported
player instead of only relabelling the report; "No action needed" lifts it,
which is the only undo, because an actioned report leaves the open queue and
there is no other UI to unban from. The ban covers the account and the hashed
IPs it played from, since a guest mints a new identity by clearing
localStorage. It survives account deletion on purpose - otherwise Settings →
Delete Account is a documented one-tap evasion. To lift one by hand:

```bash
sqlite3 /sdc/turing/turing.db \
  "UPDATE users SET banned_at = NULL WHERE email = 'them@example.com';
   DELETE FROM banned_ips WHERE ip_hash IN
     (SELECT ip_hash FROM round_starts WHERE user_id =
       (SELECT id FROM users WHERE email = 'them@example.com'));"
```

**Moderation.** Two passes. The wordlist blocks the unambiguous before delivery;
a Gemini classifier reviews every human-to-human message after delivery and
files anything subtler into the same queue a player report goes to, as
`auto:<category>`. It runs after delivery on purpose - an LLM call is
300-1500ms, and in a game where reply timing is the tell, a blocking check would
stall the chat and signal that the app, not your partner, was thinking.

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

### 3. Confirm the moderation classifier against a real key

The classifier is wired and its parsing is tested, but no local key here is
real, so it has **never returned an actual verdict** - the only thing proven is
that the request forms and reaches Google. Before launch, on the server:

```bash
npx tsx -e "import('./server/moderation.js').then(m => \
  m.classifyMessage('you are worthless, go kill yourself').then(console.log))"
```

Expect `threat`. Then send a real message in a human match and check the report
lands in `/admin` as `auto:threat`. Two things to watch: `gemini-3.6-flash` must
still be a live model id, and the `BLOCK_NONE` safety settings must be accepted
by the account - without them the classifier refuses to read the very messages
it exists to catch and every verdict silently becomes `none`.

The server logs `WARNING: no Gemini key - LLM moderation is OFF` at boot when
nothing is configured. It cannot tell a placeholder key from a real one, so the
absence of that warning is not proof the classifier works.

### 4. Mobile (Capacitor)

Needs Xcode / Android Studio locally, so it is a session at your desk.
Capacitor wraps the existing build; add `@capacitor-community/admob` and
RevenueCat. Note this is a **second payment integration, not a port** — Apple
and Google require their own IAP for digital goods, so Stripe stays web-only
and the entitlement check has to accept either source.

Still needed for submission: nothing legal - the privacy policy, terms and the
24-hour abuse commitment are live. The store listing needs its own copies of
those URLs, and App Store Connect wants the 17+ rating answered to match.

### 5. Measuring whether the AI is actually convincing

Deferred, and deliberately not "log the conversations so the AI learns". The
model is stateless: nothing you store is fed back into it, and no amount of
logging makes it better on its own. The only loop that exists is a human
reading failures and editing the persona prompt.

**Rung 1 - free, no new storage.** `game_sessions` already records the answer:

```bash
sqlite3 turing.db "SELECT partner_type, COUNT(*) rounds, SUM(was_correct) caught,
  ROUND(100.0*SUM(was_correct)/COUNT(*),1) pct FROM game_sessions
  WHERE guess IS NOT NULL GROUP BY partner_type;"
```

On 2026-08-29 this read `AI | 15 | 5 | 33.3` - players identified the AI a third
of the time, worse than guessing. Small sample, but nothing there says the AI
needs improving. Near 50% is the target; if it climbs, go to rung 2.

**Rung 2 - log the persona, not the conversation.** Six trait indices written
with the round and joined against `was_correct`, which answers "the grumpy ones
get caught, the distracted ones don't" - directly actionable on the prompt. No
personal data, so no privacy policy change. Note `personaFor` uses
`Math.random()` into an in-memory map and forgets the persona when the match
ends, so it has to be recorded at round start. Do **not** make it deterministic
from `matchId` to avoid the column: the client knows its own match id, so a
derivable persona lets a cheater ask "what's your name?" and confirm the bot.

**Rung 3 - transcripts.** Only if rung 2 is not enough. The privacy policy
promises we do not keep conversations, so this needs a policy change and an
opt-in, not just a table. Fine-tuning sits above even that and wants thousands
of curated examples to beat a well-written prompt.

### 6. Three-way rooms - the one that changes the game

Worth more than everything in §7 combined, and the only idea so far that
changes what the product is rather than tuning it. Three seats in one room,
everyone chats, everyone votes on who the bot is.

**The constraint that shapes the design.** As of 2026-08-29: 148 users, 15
rounds ever, **zero human-vs-human rounds have ever completed**. On the busiest
day, 7 rounds across 7 distinct users - never two of them online at the same
moment, so the 5-second fallback in `matchmaking.ts` has fired 100% of the
time. "Two humans plus one AI" would never fill a room. Do not build that.

**Build seat degradation instead.** A room has three seats; each is filled by a
human if one is queued and by an AI if not. The player is never told the mix -
two bots, one bot and one person, or two people on a good day. It is exactly
the trick 1v1 already plays after five seconds, applied one seat over. At
today's traffic every room is you plus two bots and the game is still better
than what ships now; as traffic grows the same code improves on its own with
nothing to rewrite.

It also gives you somewhere to put a second human when one finally arrives.
Today the all-or-nothing five-second window wastes them: the previous player
was already matched to a bot.

**Why this beats difficulty tiers.** The AI's hard test was never answering
you - it is holding a three-way. Turn-taking, being addressed by name, working
out that a message was not meant for it, reacting to what two other people
said. Detection rises off 33% because the format is harder to fake than the
conversation is, with no persona dial touched and no anti-cheat leak: every
seat is equally suspect. Guessing gets richer too - vote on each other seat,
which keeps the deception bonus and adds scoring for being wrongly called a
bot.

**What it costs.** The largest item in this file:

- `matchmaking.ts` pairs exactly two. Rooms of N is real surgery.
- `getPartnerInMatch` becomes a room broadcast carrying speaker identity;
  `ChatScreen` needs names on messages.
- `aiService.sendMessage(matchId, message)` is one session per match. Two bots
  need two sessions, each seeing who said what, each deciding whether a message
  was even for them.
- `GuessScreen` and `scoring.ts` go from one binary to per-seat verdicts.

**Three traps, in order of how quietly they bite:**

1. `personaFor(matchId)` and `typingSpeedFor(matchId)` are keyed by match
   alone. Two bots in one room would be different people typing at **identical
   speed** - a perfect tell, and the subtlest bug in the feature. Key both by
   seat.
2. Two bots must talk to *each other* convincingly, or the room dies the moment
   the human stops typing. Hardest part, and the most interesting.
3. API spend roughly doubles per round, on a game handing out 5-10 free rounds
   a day. Check that against the free caps before building.

### 7. Deferred gameplay, in rough value order

- Leaderboard (daily/weekly) — accounts now exist, so it can be cheat-resistant
- Daily challenge — one fixed opponent everyone faces
- ~~AI difficulty tiers, sellable as a Premium unlock~~ - as written this is
  backwards, and §6 supersedes it. Detection is already 33%, so players lose to
  the current AI; a *harder* tier sells more losing to the people who already
  pay. Worse, difficulty can only apply to AI seats, so a visibly dumber bot
  means any opponent who is *not* obviously robotic must be human - it leaks
  which pool you are in. If you ever want it, change the player's affordances
  (longer round, second guess, one hint), never the opponent's realism.

## Known limits, accepted on purpose

- **Single instance only.** Matches live in memory and the database is a local
  SQLite file. Correct until one machine strains; then matches move to Redis
  and the database to Postgres.
- **Guest identity is self-asserted.** Clearing localStorage yields a fresh
  identity. Fine for persistence, not sufficient for a money-carrying
  leaderboard — that needs real accounts, which exist.
- **An IP ban catches a household, not a person.** A phone switching to mobile
  data walks straight past it, and a shared connection punishes whoever else is
  on it. It moves evasion from trivial to annoying, which is the right ceiling
  until bans are actually seen being evaded; device fingerprinting is the next
  rung and is not worth its complexity or its privacy cost before then.
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
