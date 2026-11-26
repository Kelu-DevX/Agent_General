# 7B winter pilot — launch checklist

Nothing below has been run against your real Cloudflare account yet. Every step is yours to say go on.
Steps marked 🧑 need you, because they need your account or your judgment.

Free-tier headroom for the pilot (Cloudflare free plan): Workers 100k requests/day, D1 5 GB and
5M row reads/day, R2 10 GB storage. A busy pilot uses a sliver of that. Cost: $0/month.

## 0. Before you start

- [ ] Node 20+ on the machine you deploy from. In this folder: `npm ci`, then `npm test` (all green).
- [ ] 🧑 `npx wrangler login`. A browser window opens for your Cloudflare account.
- [ ] 🧑 R2 has to be switched on once in the Cloudflare dashboard (R2 → Get started). Cloudflare asks
      for a payment method even on the free tier; nothing is charged within the free limits.

## 1. Give it its own repo

The design calls for a GitHub repo named `the7b`. For now the code lives in `Agent_General/the7b/`.

- [ ] 🧑 Create an empty private repo `the7b` on GitHub.
- [ ] Copy this folder's contents into it (everything except `node_modules/` and `.wrangler/`) and push.

## 2. Create the database and photo bucket

```sh
npx wrangler d1 create the7b
```
- [ ] Paste the `database_id` it prints into `wrangler.toml` (replacing the all-zeros placeholder).

```sh
npx wrangler r2 bucket create the7b-photos
npm run db:migrate:remote
```

## 3. Settings

In `wrangler.toml` under `[vars]`:
- [ ] `SITE_URL`: leave it for now, then set it to the `*.workers.dev` URL after the first deploy.
- [ ] 🧑 `CONTACT_EMAIL`: the address shown in "forgot password" and on the terms page. While it's
      empty, the site says "Message Luke".
- [ ] `SEASON_END = "2027-03-31"`, the last day (Sandpoint time) postcards are accepted.

## 4. Deploy to the temporary URL

```sh
npx wrangler deploy
```
- [ ] Note the `https://the7b.<your-subdomain>.workers.dev` URL it prints. Put it in `SITE_URL` and deploy again.

## 5. Make yourself the admin

- [ ] 🧑 Sign up on the live site with your own email.
- [ ] Then flag your account as admin:
```sh
npx wrangler d1 execute the7b --remote --command "UPDATE users SET is_admin = 1 WHERE email = 'YOUR-EMAIL'"
```
- [ ] Reload. "Mail" appears in the menu, with a red count when photos are waiting.

Admins are left out of Winter Standings, so you can't win your own prize.

## 6. Fill it in

- [ ] 🧑 Mail room → "What's going on in 7B": add the first few events.
- [ ] 🧑 Mail room → Missions: the five winter missions are already seeded with the copy from
      `docs/COPY.md`. Edit there if you want to change any of them.
- [ ] 🧑 Read the headline and terms on the live site. Headline: "Greetings from 7B." with
      "Wish you were here. (Oh wait — you are.)". Alternates are in `docs/COPY.md`.

## 7. Friendly test run (1–2 people, on their phones)

- [ ] Sign up, send a postcard for one mission, see "In the mail".
- [ ] Approve it from your phone. It shows on the wall and the home page, and the stamps count on Winter Standings.
- [ ] Reject one with a reason. They see the reason and can send another.
- [ ] Feature one (+25). Remove one, and its stamps come back off.
- [ ] Forgot-password path: they message you, you press "Temp password" in Mail room, read it to them,
      and they log in with it. That also logs them out everywhere else.
- [ ] Try an iPhone photo. The page converts it to JPEG before sending.

## 7b. Basic abuse protection (free)

- [ ] 🧑 Cloudflare dashboard → your domain (once the7b.me is on Cloudflare) → Security → WAF →
      Rate limiting rules → one rule: requests to `/login` or `/signup`, more than 10 per minute from
      one IP → Block for 10 minutes. The free plan includes one rule, which is all this needs.
      (Not available on a bare `workers.dev` address, so do it at the domain swap.)

## 8. Go public

- [ ] 🧑 Post in the Sandpoint Facebook groups.
- [ ] 🧑 The mailer is its own design task once the site's live. A draft is in `docs/COPY.md`.

## When you buy the7b.me

1. Add `the7b.me` to your Cloudflare account (or point its nameservers at Cloudflare).
2. Workers & Pages → the7b → Settings → Domains & Routes → Add custom domain → `the7b.me`.
3. Set `SITE_URL = "https://the7b.me"` and `npx wrangler deploy`.

Sessions are tied to the address people logged in on, so everyone logs in once more on the new domain.
Nothing else changes.

## Housekeeping

- Backup the database anytime: `npx wrangler d1 export the7b --remote --output 7b-backup.sql`
- Roll back a bad deploy: `npx wrangler rollback`
- Mail list (only people who ticked the box): Mail room → Players → "Download the 7B mail list".

## Season end (April 1, 2027)

- [ ] Submissions close automatically after March 31, Sandpoint time.
- [ ] 🧑 Check Winter Standings. Ties go to whoever reached the total first.
- [ ] 🧑 Email the winner for a mailing address. It's never stored in the app.
