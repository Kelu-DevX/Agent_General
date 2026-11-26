import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  clearSessionCookie, createSession, destroyUserSessions, getSessionUser,
  hashPassword, sessionCookie, verifyPassword,
} from "../src/lib/auth";

async function user() {
  const n = crypto.randomUUID().slice(0, 8);
  const r = await env.DB.prepare(
    "INSERT INTO users (email, display_name, pass_hash) VALUES (?, ?, 'x') RETURNING id",
  ).bind(`${n}@b.co`, `u${n}`).first<{ id: number }>();
  return r!.id;
}

describe("passwords", () => {
  it("round-trips", async () => {
    const h = await hashPassword("huckleberry pie");
    expect(h).toMatch(/^pbkdf2\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(await verifyPassword("huckleberry pie", h)).toBe(true);
  });
  it("rejects a wrong password", async () => {
    expect(await verifyPassword("nope", await hashPassword("huckleberry pie"))).toBe(false);
  });
  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });
  it("rejects a tampered or garbage stored string", async () => {
    const h = await hashPassword("huckleberry pie");
    const parts = h.split("$");
    parts[3] = parts[3].slice(0, -4) + "AAAA";
    expect(await verifyPassword("huckleberry pie", parts.join("$"))).toBe(false);
    expect(await verifyPassword("huckleberry pie", "garbage")).toBe(false);
    expect(await verifyPassword("huckleberry pie", "pbkdf2$1$x$y")).toBe(false);
  });
});

describe("sessions", () => {
  it("returns the user for a fresh session", async () => {
    const id = await user();
    const token = await createSession(env.DB, id);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect((await getSessionUser(env.DB, token))?.id).toBe(id);
  });
  it("never stores the raw token", async () => {
    const token = await createSession(env.DB, await user());
    const row = await env.DB.prepare("SELECT 1 AS hit FROM sessions WHERE token = ?").bind(token).first();
    expect(row).toBeNull();
  });
  it("returns null for expired, unknown and missing tokens", async () => {
    const id = await user();
    const token = await createSession(env.DB, id);
    await env.DB.prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z' WHERE user_id = ?")
      .bind(id).run();
    expect(await getSessionUser(env.DB, token)).toBeNull();
    expect(await getSessionUser(env.DB, "unknown")).toBeNull();
    expect(await getSessionUser(env.DB, undefined)).toBeNull();
  });
  it("destroys every session for a user", async () => {
    const id = await user();
    const a = await createSession(env.DB, id);
    const b = await createSession(env.DB, id);
    await destroyUserSessions(env.DB, id);
    expect(await getSessionUser(env.DB, a)).toBeNull();
    expect(await getSessionUser(env.DB, b)).toBeNull();
  });
  it("builds hardened cookies", () => {
    const c = sessionCookie("tok");
    for (const part of ["s7b=tok", "HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=2592000"]) {
      expect(c).toContain(part);
    }
    expect(clearSessionCookie()).toContain("Max-Age=0");
  });
});
