import { Hono, type MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { COPY, contactLine } from "../copy";
import {
  COOKIE, burnPasswordCheck, clearSessionCookie, createSession, destroySession,
  hashPassword, sessionCookie, verifyPassword,
} from "../lib/auth";
import type { AppEnv } from "../types";
import { ForgotPage, LoginPage, SignupPage } from "../views/auth";
import { Layout, Notice } from "../views/layout";

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const NAME_RE = /^[A-Za-z0-9 ]{3,24}$/;

/**
 * Only same-site paths: "/x" yes; "//evil", "/\\evil", "/\t/evil" or "http://..." no.
 * Browsers drop tabs/newlines and treat backslashes as slashes, so anything with
 * control characters, spaces or backslashes is refused outright, then the result
 * must resolve to this same origin.
 */
export function safeNext(next: unknown): string | undefined {
  if (typeof next !== "string" || next.length > 200) return undefined;
  if (!next.startsWith("/") || /[\x00-\x20\x7f\\]/.test(next)) return undefined;
  try {
    const base = "https://7b.invalid";
    const u = new URL(next, base);
    if (u.origin !== base) return undefined;
    return u.pathname + u.search + u.hash;
  } catch {
    return undefined;
  }
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("user")) {
    const path = new URL(c.req.url).pathname;
    const nextPath = c.req.method === "GET" ? path : "/postcards";
    return c.redirect(`/login?next=${encodeURIComponent(nextPath)}`, 302);
  }
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login?next=%2Fadmin", 302);
  if (!user.is_admin) {
    return c.html(
      <Layout title="Mail room" user={user}>
        <section class="card">
          <Notice kind="err">{COPY.errors.forbidden}</Notice>
        </section>
      </Layout>,
      403,
    );
  }
  await next();
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

export const authRoutes = new Hono<AppEnv>();

authRoutes.get("/signup", (c) => {
  if (c.get("user")) return c.redirect("/postcards");
  return c.html(<SignupPage next={safeNext(c.req.query("next"))} />);
});

authRoutes.post("/signup", async (c) => {
  const body = await c.req.parseBody();
  const email = str(body.email).trim().toLowerCase();
  const display_name = str(body.display_name).trim().replace(/\s+/g, " ");
  const password = str(body.password);
  const agree = Boolean(body.agree);
  const mailing_consent = Boolean(body.mailing_consent);
  const next = safeNext(body.next);
  const fail = (error: string) =>
    c.html(<SignupPage error={error} next={next} values={{ email, display_name, mailing_consent }} />, 400);

  if (!NAME_RE.test(display_name)) return fail(COPY.auth.badName);
  if (!EMAIL_RE.test(email) || email.length > 254) return fail(COPY.auth.badEmail);
  if (password.length < 8 || password.length > 200) return fail(COPY.auth.badPassword);
  if (!agree) return fail(COPY.auth.needAgree);

  const db = c.env.DB;
  const taken = await db.prepare(
    "SELECT email = ? COLLATE NOCASE AS e, display_name = ? COLLATE NOCASE AS n FROM users WHERE email = ? OR display_name = ?",
  ).bind(email, display_name, email, display_name).all<{ e: number; n: number }>();
  if (taken.results.some((r) => r.e)) return fail(COPY.auth.dupEmail);
  if (taken.results.some((r) => r.n)) return fail(COPY.auth.dupName);

  let id: number;
  try {
    const row = await db.prepare(
      "INSERT INTO users (email, display_name, pass_hash, mailing_consent) VALUES (?, ?, ?, ?) RETURNING id",
    ).bind(email, display_name, await hashPassword(password), mailing_consent ? 1 : 0).first<{ id: number }>();
    id = row!.id;
  } catch (e) {
    // Lost a race with a twin signup: still a friendly message, never a 500.
    const msg = String(e);
    if (msg.includes("users.email")) return fail(COPY.auth.dupEmail);
    if (msg.includes("users.display_name")) return fail(COPY.auth.dupName);
    throw e;
  }
  const token = await createSession(db, id);
  c.header("Set-Cookie", sessionCookie(token));
  return c.redirect(next ?? "/postcards", 303);
});

authRoutes.get("/login", (c) => {
  if (c.get("user")) return c.redirect(safeNext(c.req.query("next")) ?? "/postcards");
  return c.html(<LoginPage next={safeNext(c.req.query("next"))} />);
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const email = str(body.email).trim().toLowerCase();
  const password = str(body.password);
  const next = safeNext(body.next);
  const row = await c.env.DB.prepare("SELECT id, pass_hash FROM users WHERE email = ?")
    .bind(email).first<{ id: number; pass_hash: string }>();
  const ok = row ? await verifyPassword(password, row.pass_hash) : (await burnPasswordCheck(password), false);
  if (!row || !ok) {
    return c.html(
      <LoginPage error={COPY.auth.badLogin(contactLine(c.env.CONTACT_EMAIL))} email={email} next={next} />,
      401,
    );
  }
  const token = await createSession(c.env.DB, row.id);
  c.header("Set-Cookie", sessionCookie(token));
  return c.redirect(next ?? "/postcards", 303);
});

authRoutes.post("/logout", async (c) => {
  await destroySession(c.env.DB, getCookie(c, COOKIE));
  c.header("Set-Cookie", clearSessionCookie());
  return c.redirect("/", 303);
});

authRoutes.get("/forgot", (c) => c.html(<ForgotPage contact={contactLine(c.env.CONTACT_EMAIL)} />));
