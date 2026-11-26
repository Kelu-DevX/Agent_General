# 7B

The handbook for everything in, around, and about Sandpoint, Idaho, plus a little game called **Postcards**.

This is the **winter pilot**: five winter missions, photo uploads, a moderated public wall, Winter Standings,
and a hand-updated "What's going on in 7B" list. Home will be [the7b.me](https://the7b.me) once the domain
is bought; until then it runs on a `*.workers.dev` address.

- Design: [`docs/design.md`](docs/design.md)
- Build plan: [`docs/plan.txt`](docs/plan.txt)
- All site copy: [`docs/COPY.md`](docs/COPY.md). The brand is "7B", never "the 7B".
- Going live: [`docs/LAUNCH.md`](docs/LAUNCH.md)

## Stack

Cloudflare Workers (Hono, server-rendered JSX) + D1 (SQLite) + R2 (photos). $0/month on the free tier.
No email service, no paid APIs. Weather is Open-Meteo (free, no key).

## Run it

```sh
npm ci
npm test                    # Vitest inside the Workers runtime
npm run db:migrate:local    # once
npm run dev                 # http://localhost:8787
```

To use the Mail room locally, sign up, then:
`npx wrangler d1 execute the7b --local --command "UPDATE users SET is_admin = 1 WHERE email = 'you@example.com'"`

## How it's put together

| Path | What |
| --- | --- |
| `src/index.tsx` | App entry: security headers, cross-site form check, session loading, home and terms |
| `src/routes/auth.tsx` | Signup, login, logout, forgot-password, `requireUser` / `requireAdmin` |
| `src/routes/game.tsx` | Postcards page and photo submission rules |
| `src/routes/pub.tsx` | Wall, standings, profiles, photo serving |
| `src/routes/admin.tsx` | Mail room: approve/reject/remove/feature, happenings, missions, temp passwords, mail list |
| `src/lib/points.ts` | The points ledger (every change is one all-or-nothing transaction) |
| `src/lib/photos.ts` | JPEG checks and byte-level metadata stripping (EXIF/GPS never stored) |
| `src/lib/time.ts` | Sandpoint (Pacific) time for the season end and the daily cap |
| `src/copy.ts` | Every user-facing string |
| `public/` | Stylesheet and the in-browser photo shrinker |

## Privacy rules the code keeps

- Public pages show display names only, never emails.
- Photos are re-encoded in the browser and stripped again on the server. No location data is stored.
- Nothing reaches the wall until it's approved. Unapproved photos can only be seen by their owner and the admin.
- Rejected and removed photos are deleted.
