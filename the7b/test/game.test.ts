import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { DAILY_CAP } from "../src/routes/game";
import { pacificDate, pacificDayStartUtc, seasonOver } from "../src/lib/time";
import { BASE, containsText, get, hasMarker, makeJpeg, r2Count, signup, submit } from "./helpers";

const subsFor = (userId: number) =>
  env.DB.prepare("SELECT * FROM submissions WHERE user_id = ? ORDER BY id").bind(userId).all<any>().then((r) => r.results);

describe("GET /postcards", () => {
  it("shows the five missions with stamps to anyone", async () => {
    const res = await get("/postcards");
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const t of ["Snowman Somewhere Special", "Liberty in a Beanie", "Lights on First", "Schweitzer Day", "The Quiet Mile"]) {
      expect(html).toContain(t);
    }
    expect(html).toContain("stamps");
    expect(html).toContain("Join 7B to send this one");
  });
});

describe("POST /postcards/submit", () => {
  it("sends logged-out visitors to log in, writing nothing", async () => {
    const before = await r2Count();
    const res = await submit("", 1);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/^\/login/);
    expect(await r2Count()).toBe(before);
  });

  it("creates a pending submission and a stripped R2 object", async () => {
    const { cookie, id } = await signup();
    const res = await submit(cookie, 1, makeJpeg({ exif: true, trailer: true }));
    expect(res.status).toBe(303);
    const [s] = await subsFor(id);
    expect(s.status).toBe("pending");
    const stored = new Uint8Array(await (await env.PHOTOS.get(s.photo_key))!.arrayBuffer());
    expect(hasMarker(stored, 0xe1)).toBe(false);
    expect(containsText(stored, "GPS")).toBe(false);
  });

  it("refuses a second postcard for a mission while one is in the mail", async () => {
    const { cookie } = await signup();
    await submit(cookie, 2);
    const res = await submit(cookie, 2);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("already in the mail");
  });

  it("refuses a mission that's already stamped", async () => {
    const { cookie, id } = await signup();
    await submit(cookie, 3);
    await env.DB.prepare("UPDATE submissions SET status = 'approved' WHERE user_id = ?").bind(id).run();
    const res = await submit(cookie, 3);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("already stamped");
  });

  it("allows a resubmission after a rejection and shows the reason", async () => {
    const { cookie, id } = await signup();
    await submit(cookie, 4);
    await env.DB.prepare("UPDATE submissions SET status = 'rejected', reject_reason = 'too blurry' WHERE user_id = ?").bind(id).run();
    const page = await (await get("/postcards", cookie)).text();
    expect(page).toContain("too blurry");
    expect((await submit(cookie, 4)).status).toBe(303);
    expect((await subsFor(id)).map((s) => s.status)).toEqual(["rejected", "pending"]);
  });

  it("caps uploads at twenty per Sandpoint day", async () => {
    const { cookie, id } = await signup();
    const now = pacificDayStartUtc();
    const later = new Date(Date.parse(now.replace(" ", "T") + "Z") + 60_000).toISOString().slice(0, 19).replace("T", " ");
    const stmt = env.DB.prepare(
      "INSERT INTO submissions (user_id, objective_id, photo_key, status, created_at) VALUES (?, 1, ?, 'rejected', ?)",
    );
    await env.DB.batch(Array.from({ length: DAILY_CAP }, () => stmt.bind(id, `photos/${crypto.randomUUID()}.jpg`, later)));
    const before = await r2Count();
    const res = await submit(cookie, 5);
    expect(res.status).toBe(429);
    expect(await res.text()).toContain("Save some winter for tomorrow");
    expect(await r2Count()).toBe(before);
  });

  it("ignores yesterday's uploads in the daily cap", async () => {
    const { cookie, id } = await signup();
    const stmt = env.DB.prepare(
      "INSERT INTO submissions (user_id, objective_id, photo_key, status, created_at) VALUES (?, 1, ?, 'rejected', '2020-01-01 12:00:00')",
    );
    await env.DB.batch(Array.from({ length: DAILY_CAP }, () => stmt.bind(id, `photos/${crypto.randomUUID()}.jpg`)));
    expect((await submit(cookie, 5)).status).toBe(303);
  });

  it("rejects a non-JPEG sent straight to the API, writing nothing to R2", async () => {
    const { cookie, id } = await signup();
    const before = await r2Count();
    const png = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
    const res = await submit(cookie, 1, png, "image/png");
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("JPEG only");
    expect(await r2Count()).toBe(before);
    expect(await subsFor(id)).toEqual([]);
  });

  it("rejects an oversize photo, writing nothing to R2", async () => {
    const { cookie } = await signup();
    const before = await r2Count();
    const big = new Uint8Array(2_500_001);
    big.set(makeJpeg());
    const res = await submit(cookie, 1, big);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("under 2.5 MB");
    expect(await r2Count()).toBe(before);
  });

  it("rejects a corrupt JPEG instead of storing it", async () => {
    const { cookie } = await signup();
    const before = await r2Count();
    const bad = makeJpeg();
    bad[5] = 0xff;
    const res = await submit(cookie, 1, bad);
    expect(res.status).toBe(400);
    expect(await r2Count()).toBe(before);
  });

  it("rejects a missing photo and an unknown mission", async () => {
    const { cookie } = await signup();
    expect((await submit(cookie, 1, null)).status).toBe(400);
    expect((await submit(cookie, 999)).status).toBe(400);
  });
});

describe("season end", () => {
  it("knows when the season has wrapped, in Pacific time", () => {
    // 2027-04-01 06:59 UTC is still March 31 at 11:59pm in Sandpoint.
    expect(seasonOver("2027-03-31", new Date("2027-04-01T06:59:00Z"))).toBe(false);
    expect(seasonOver("2027-03-31", new Date("2027-04-01T07:01:00Z"))).toBe(true);
    expect(pacificDate(new Date("2026-12-15T07:30:00Z"))).toBe("2026-12-14");
  });

  it("computes Sandpoint midnight in UTC", () => {
    expect(pacificDayStartUtc(new Date("2026-12-15T07:30:00Z"))).toBe("2026-12-14 08:00:00");
    expect(pacificDayStartUtc(new Date("2027-07-04T20:00:00Z"))).toBe("2027-07-04 07:00:00");
  });

  it("refuses submissions after SEASON_END", async () => {
    const { cookie } = await signup();
    const original = env.SEASON_END;
    (env as any).SEASON_END = "2020-01-01";
    try {
      const res = await submit(cookie, 1);
      expect(res.status).toBe(400);
      expect(await res.text()).toContain("season&#39;s wrapped");
    } finally {
      (env as any).SEASON_END = original;
    }
  });
});

describe("photo privacy", () => {
  it("keeps unapproved photos invisible to the public, visible to their owner", async () => {
    const { cookie, id } = await signup();
    await submit(cookie, 1);
    const [s] = await subsFor(id);
    const url = `/photo/${s.photo_key.replace("photos/", "")}`;
    expect((await get(url)).status).toBe(404);
    const mine = await get(url, cookie);
    expect(mine.status).toBe(200);
    expect(mine.headers.get("cache-control")).toContain("no-store");
    const other = await signup();
    expect((await get(url, other.cookie)).status).toBe(404);
    await env.DB.prepare("UPDATE submissions SET status = 'approved' WHERE id = ?").bind(s.id).run();
    const pub = await get(url);
    expect(pub.status).toBe(200);
    expect(pub.headers.get("content-type")).toBe("image/jpeg");
  });

  it("404s on junk photo names", async () => {
    expect((await get("/photo/..%2F..%2Fsecret")).status).toBe(404);
    expect((await get(`${"/photo/"}x.jpg`)).status).toBe(404);
  });
});

void BASE;
