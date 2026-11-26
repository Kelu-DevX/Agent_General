import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { approveSubmission } from "../src/lib/points";
import { parsePage } from "../src/lib/queries";
import { get, signup, submit } from "./helpers";

async function subsOf(id: number) {
  return (await env.DB.prepare("SELECT id, photo_key, objective_id FROM submissions WHERE user_id = ? ORDER BY id").bind(id).all<any>()).results;
}

describe("the wall", () => {
  it("shows approved postcards only, with display names and never emails", async () => {
    const p = await signup();
    for (const o of [1, 2, 3, 4]) await submit(p.cookie, o);
    const [a, b, c, d] = await subsOf(p.id);
    await approveSubmission(env.DB, a.id);
    await env.DB.prepare("UPDATE submissions SET status = 'rejected' WHERE id = ?").bind(b.id).run();
    await approveSubmission(env.DB, c.id);
    await env.DB.prepare("UPDATE submissions SET status = 'removed' WHERE id = ?").bind(c.id).run();
    void d; // stays pending
    const html = await (await get("/wall")).text();
    const has = (s: any) => html.includes(s.photo_key.replace("photos/", ""));
    expect([has(a), has(b), has(c), has(d)]).toEqual([true, false, false, false]);
    expect(html).toContain(p.name);
    expect(html).not.toContain(p.email);
  });

  it("handles garbage page numbers gracefully", async () => {
    for (const q of ["-3", "abc", "0", "1e99", "%00", "99999999"]) {
      expect((await get(`/wall?page=${q}`)).status).toBe(200);
    }
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("7")).toBe(7);
  });
});

describe("standings", () => {
  it("renders totals in ledger order", async () => {
    const hi = await signup();
    const lo = await signup();
    await submit(hi.cookie, 4);
    await submit(lo.cookie, 2);
    await approveSubmission(env.DB, (await subsOf(hi.id))[0].id);
    await approveSubmission(env.DB, (await subsOf(lo.id))[0].id);
    const html = await (await get("/standings")).text();
    expect(html).toContain("Winter Standings");
    const iHi = html.indexOf(`>${hi.name}<`);
    const iLo = html.indexOf(`>${lo.name}<`);
    expect(iHi).toBeGreaterThan(-1);
    expect(iLo).toBeGreaterThan(iHi);
    expect(html).not.toContain(hi.email);
  });
});

describe("profiles", () => {
  it("/me shows the finisher badge only once all five are stamped", async () => {
    const p = await signup();
    for (const o of [1, 2, 3, 4, 5]) await submit(p.cookie, o);
    const subs = await subsOf(p.id);
    for (const s of subs.slice(0, 4)) await approveSubmission(env.DB, s.id);
    let html = await (await get("/me", p.cookie)).text();
    expect(html).not.toContain("Winter Finisher badge");
    expect(html).toContain("<strong>70</strong>");
    await approveSubmission(env.DB, subs[4].id);
    html = await (await get("/me", p.cookie)).text();
    expect(html).toContain("Winter Finisher badge");
    expect(html).toContain("<strong>100</strong>");
    const pub = await (await get(`/p/${encodeURIComponent(p.name)}`)).text();
    expect(pub).toContain("Winter Finisher badge");
    expect(pub).not.toContain(p.email);
  });

  it("/me needs a login; unknown public profiles 404", async () => {
    expect((await get("/me")).status).toBe(302);
    expect((await get("/p/nobody-by-this-name")).status).toBe(404);
  });
});
