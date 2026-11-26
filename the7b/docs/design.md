# 7B — Winter Pilot Design (v1)

Date: 2026-11-25
Owner: Luke
Status: Draft for Luke's approval

## Intent & Why

7B (the7b.me) is a Sandpoint, Idaho community handbook and game — "the town's trifold pamphlet, but online and gamified." Long-term it covers everything in/around/about Sandpoint: events, what's-big news, pictures, lifestyle, history tidbits, and (later) a sponsored local-business directory. It is free for everyone; it grows quietly with the town rather than being pushed on anyone.

This document covers only the **winter pilot**: a real public soft launch (~mid-December 2026) with a 5-objective photo challenge game called **Postcards** plus a small hand-updated handbook page. Purpose of the pilot: learn whether locals and visitors actually play, before the polished 10-objective summer 2027 build.

Brand feel: warm, happy, wholesome — "grandkids visiting for the holidays" joy, kid-like excitement without being a kids' toy. Audience is both locals and tourists; winter skews local (plus Schweitzer visitors). Marketing: Sandpoint Facebook groups + physical mailers to homeowners (postcard-styled, with one pulling headline and the URL).

## Goals

- Live at the7b.me by ~mid-December 2026.
- A stranger lands from a mailer or Facebook post and understands the game in under 30 seconds, signs up in under 2 minutes.
- Luke can run the entire thing from his Samsung phone: approve photos, edit the "what's going on" list, see the leaderboard.
- Photo feed ("postcard wall") is public, clean, and wholesome — nothing posts without Luke's approval.
- Winter season leaderboard with a mailed prize (~$50 budget) at season end; everyone who completes all 5 gets a finisher badge on their profile.

## Non-goals (winter pilot)

- No auto-scraped news, event feeds, or parking/conditions data (summer 2027).
- No business directory or sponsored listings (later, after traction).
- No blogging, comments, likes, DMs, or follower mechanics.
- No native app — mobile-first website only.
- No payment handling of any kind.

## Anti-goals (failure even if it works)

- Looking like a side project or a kids' toy — design must feel polished and warm (first public impression of the 7B brand).
- Feeling like marketing/spam — no ads, no upsells, minimal data collected.
- Exposing anything private: no addresses, no location data on photos (EXIF must be stripped), no minors' info solicited.
- Unmoderated content reaching the public wall.

## Constraints

- Budget: hosting must be $0/month for the pilot (Luke's decision 2026-11-26); domain the7b.me ($11/$20yr) to be purchased later — build against a temporary URL; prize ~$50. Luke funds out of pocket.
- Timeline: live by ~mid-December; Luke builds nights.
- Luke's stack familiarity: Render (web services + Postgres), Cloudflare (R2, domains), Node/JS. Reuse it.
- Admin must work well on a Samsung phone browser.
- 7B is a new venture of Luke's (not part of Perfection Lawn & Landscape branding).

## Approaches considered

1. **Static site + third-party form service** (photos via Google Form). Cheapest, but the public postcard wall, points, and leaderboard would be manual or absent — kills the game loop. Rejected.
2. **Full app with accounts, uploads, queue, feed (chosen)** — one small web service + Postgres + R2 object storage. Matches the game loop exactly; small enough to ship in days.
3. **No-code builder (Webflow/Lovable)** — fast landing page, but the approval queue + points logic fights the platform, and Luke wants to own his stack long-term. Rejected.

Luke picked the real public soft launch shape; approach 2 is the only one that delivers it. (Approach choice within "how it's built" is the designer's call, stated below.)

## Decided design

### Brand
- Site/brand: **7B** — domain **the7b.me** (Luke purchasing). Locals' county-plate badge; said aloud as "the 7B."
- Game: **Postcards** ("Play Postcards"). Photos are postcards; points are stamps.
- Tone/visual: vintage-postcard warmth ("Greetings from Sandpoint" energy), snow-season palette for the pilot. Must not read as templated or corporate. (Exact visual design: builder's craft within this direction.)

### Pages (mobile-first)
1. **Home** — postcard-style hero + headline sentence; current Sandpoint weather (automatic, via a free weather API); "What's going on in 7B" — a short list Luke edits by hand from admin (events, what's big this week); big "Play Postcards" CTA; strip of recent approved postcards.
2. **Postcards (game)** — the 5 objectives as cards (name, description, point value, example illustration), each with an upload button; the public postcard wall (approved photos, newest first, with display name + objective + stamp/points); winter leaderboard.
3. **My profile** — display name, points, which objectives completed, finisher badge.
4. **Terms & privacy** — short plain-language page (below).
5. **Admin (Luke only)** — approval queue (approve/reject each photo, one tap), edit "what's going on" list, view users/leaderboard, feature a weekly best photo (+25 bonus).

### Winter objectives (content, editable by Luke in admin)
1. Build a snowman somewhere recognizable in Sandpoint — 20 pts
2. Photo with the Statue of Liberty at City Beach in winter gear — 10 pts
3. Downtown Sandpoint under the Christmas lights — 10 pts
4. Schweitzer day: summit or lodge shot — 30 pts
5. Winter trail or sledding shot anywhere in Bonner County — 30 pts
- Finish all 5 → finisher badge. Weekly featured photo picked by Luke → +25.
- Season: launch through March 31, 2027. Top points wins mailed prize; ties broken by earliest completion.

### Core flow
Sign up (email + display name + password; no email verification in the pilot) → pick objective → upload photo (client resizes; EXIF/GPS stripped server-side) → status "pending" → Luke's queue → approve (posts to wall, points granted) or reject (with optional short reason shown to user) → leaderboard updates.

### Content & legal floor
- Upload checkbox: "I took this photo and I'm OK with it being shown publicly on the7b.me."
- Short Terms of Use: Luke may reject/remove anything, photos grant 7B display rights, no private info or other people's kids, 13+ to create an account (COPPA floor), prizes are small and for fun, "sponsored ≠ recommendation" clause pre-staged for the future directory.
- Privacy: only email + display name collected; emails used for the site and (with a consent checkbox at signup) future 7B mailings; never sold.
- Public wall shows display name only — never email, never location.

### Stack (designer's calls; constraint: $0/month hosting for the pilot)
Luke chose free-only hosting. Render's free web service sleeps (30s+ cold start for mailer visitors) and its free Postgres expires after ~30 days — both unacceptable for a season running to March 31. So the pilot runs entirely on Cloudflare's free tier, which has neither problem:
- **App**: Cloudflare Worker (Hono, JS/TS) serving server-rendered pages + a little client JS. No cold sleep, free tier far exceeds pilot traffic.
- **DB**: Cloudflare D1 (SQLite; free tier ample for pilot scale).
- **Photos**: Cloudflare R2, originals resized to web size on upload, EXIF/GPS stripped.
- **URL**: temporary `*.workers.dev` URL until Luke buys the7b.me (domain is config; attaching it later is a 10-minute DNS change, no rebuild).
- **Auth**: email+password sessions (bcrypt/scrypt, httpOnly cookies). No OAuth in pilot. Luke's account flagged admin in DB.
- Repo: new GitHub repo `the7b` under Luke's account.
- Cost: $0/month until traction justifies more.

### Launch checklist (after build)
Deploy to temp URL (domain DNS swap whenever Luke buys the7b.me) → Luke seeds 5 objectives + first "what's going on" items → Luke tests full loop with 1–2 friendly users → Facebook group posts → mailer (separate design task, after site is live).

### Game rules (designer's calls)
- One approved photo per objective per user; points granted once per objective. A pending or rejected submission can be replaced/resubmitted; one pending submission per objective at a time.
- Weekly featured bonus (+25) counts toward the leaderboard total.
- Tiebreak: whoever reached the tied final total first (timestamp of the point-earning approval that got them there).
- Admin can remove an already-approved photo; removal revokes its points. Points stored as a ledger (grants/revocations), totals computed.

### Email & notifications (designer's calls)
- No outbound email service in the pilot. Password reset: a "forgot password" link that tells the user to email Luke (admin can set a new temporary password from the admin page).
- Pending-photo awareness: admin page shows a pending count badge; Luke checks when he's on his phone. (An email/push alert can be added later if the queue gets busy.)
- The future-mailings consent list accepts unverified emails; it's a pilot-grade list.

### Prize & winner contact (designer's call)
- Winner's mailing address is collected off-platform (Luke emails the winner at season end). No address field in the app; terms note the winner will be contacted by email.

### Provisioning (designer's call)
- Claude provisions via Luke's connected accounts: GitHub repo `the7b`, Cloudflare Worker + D1 + R2 — with Luke's explicit go-ahead before anything deploys live or incurs cost. Nothing in the pilot should incur cost.

## What's left to the builder

- Visual design within the brand direction (postcard aesthetic, warm, polished).
- Exact DB schema, routes, and file structure.
- Image-processing details (resize targets, EXIF stripping library).
- Rate limiting / abuse basics (per-account upload cap, max file size).
- Copy drafts for pages (Luke reviews headline + terms before launch).

## Explicitly deferred to summer 2027 build

10 summer objectives; auto event/news aggregation; business directory with paid sponsored listings (labeled "sponsored, not a recommendation"); multi-season accounts with year-over-year stats; the x.fit-style novelty subdomains; CdA/regional expansion content.
