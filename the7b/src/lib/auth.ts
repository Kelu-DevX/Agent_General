import type { User } from "../types";

// bcrypt can't run on Workers; WebCrypto PBKDF2 is the pinned choice.
// 100k is the maximum iteration count Workers' PBKDF2 accepts.
const ITERATIONS = 100_000;
const SESSION_DAYS = 30;
export const COOKIE = "s7b";

const enc = new TextEncoder();

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64url(bytes: Uint8Array): string {
  return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function derive(pw: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pw, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  try {
    const [scheme, iter, saltB64, hashB64] = stored.split("$");
    const iterations = Number(iter);
    if (scheme !== "pbkdf2" || !Number.isInteger(iterations) || iterations < 10_000 || iterations > ITERATIONS) {
      return false;
    }
    const expected = unb64(hashB64);
    const actual = await derive(pw, unb64(saltB64), iterations);
    return equal(actual, expected);
  } catch {
    return false;
  }
}

// Spend the same time as a real check, so "no such email" and "wrong password" look alike.
let dummy: Promise<string> | undefined;
export async function burnPasswordCheck(pw: string): Promise<void> {
  dummy ??= hashPassword("not-a-real-password");
  await verifyPassword(pw, await dummy);
}

async function sha256(s: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))));
}

export async function createSession(db: D1Database, userId: number): Promise<string> {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), userId, expires).run();
  return token;
}

export async function getSessionUser(db: D1Database, token: string | undefined): Promise<User | null> {
  if (!token || token.length > 100) return null;
  const row = await db.prepare(
    `SELECT u.id, u.email, u.display_name, u.is_admin, u.mailing_consent, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?`,
  ).bind(await sha256(token), new Date().toISOString()).first<User>();
  return row ?? null;
}

export async function destroySession(db: D1Database, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.prepare("DELETE FROM sessions WHERE token = ?").bind(await sha256(token)).run();
}

export async function destroyUserSessions(db: D1Database, userId: number): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

export function sessionCookie(token: string): string {
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86_400}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
