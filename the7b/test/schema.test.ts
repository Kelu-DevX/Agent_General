import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function user(name: string) {
  const r = await env.DB.prepare(
    "INSERT INTO users (email, display_name, pass_hash) VALUES (?, ?, 'x') RETURNING id",
  ).bind(`${name}@example.com`, name).first<{ id: number }>();
  return r!.id;
}
const sub = (u: number, o: number, status: string) =>
  env.DB.prepare(
    "INSERT INTO submissions (user_id, objective_id, photo_key, status) VALUES (?, ?, ?, ?)",
  ).bind(u, o, `photos/${crypto.randomUUID()}.jpg`, status).run();

describe("schema", () => {
  it("seeds the five winter objectives with 20/10/10/30/30 stamps", async () => {
    const { results } = await env.DB.prepare(
      "SELECT title, points FROM objectives ORDER BY sort",
    ).all<{ title: string; points: number }>();
    expect(results.map((r) => r.points)).toEqual([20, 10, 10, 30, 30]);
    expect(results.map((r) => r.title)).toEqual([
      "Snowman Somewhere Special",
      "Liberty in a Beanie",
      "Lights on First",
      "Schweitzer Day",
      "The Quiet Mile",
    ]);
  });

  it("allows only one approved submission per user per objective", async () => {
    const u = await user("ann");
    await sub(u, 1, "approved");
    await expect(sub(u, 1, "approved")).rejects.toThrow();
  });

  it("allows only one pending submission per user per objective", async () => {
    const u = await user("bo");
    await sub(u, 1, "pending");
    await expect(sub(u, 1, "pending")).rejects.toThrow();
  });

  it("lets pending, approved and rejected coexist", async () => {
    const u = await user("cy");
    await sub(u, 1, "approved");
    await sub(u, 1, "pending");
    await sub(u, 1, "rejected");
    await sub(u, 1, "rejected");
  });

  it("treats email and display name as case-insensitive unique", async () => {
    await user("Dee");
    await expect(
      env.DB.prepare("INSERT INTO users (email, display_name, pass_hash) VALUES ('x@y.z', 'dee', 'x')").run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare("INSERT INTO users (email, display_name, pass_hash) VALUES ('DEE@example.com', 'other', 'x')").run(),
    ).rejects.toThrow();
  });

  it("rejects an unknown submission status", async () => {
    const u = await user("ed");
    await expect(sub(u, 1, "lost")).rejects.toThrow();
  });

  it("never grants the same ledger reason twice for one submission", async () => {
    const u = await user("flo");
    await sub(u, 2, "approved");
    const id = (await env.DB.prepare("SELECT id FROM submissions WHERE user_id=?").bind(u).first<{ id: number }>())!.id;
    const grant = () =>
      env.DB.prepare("INSERT INTO points_ledger (user_id, submission_id, delta, reason) VALUES (?, ?, 10, 'approve')")
        .bind(u, id).run();
    await grant();
    await expect(grant()).rejects.toThrow();
  });
});
