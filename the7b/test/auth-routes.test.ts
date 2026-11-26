import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { BASE, get, signup, uniq } from "./helpers";

const form = (o: Record<string, string>) => new URLSearchParams(o);
const login = (email: string, password: string) =>
  SELF.fetch(`${BASE}/login`, { method: "POST", body: form({ email, password }), redirect: "manual" });

describe("signup", () => {
  it("creates the user, sets a session cookie and lands on Postcards", async () => {
    const { res, cookie, id } = await signup({ consent: true });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/postcards");
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    expect(cookie).toMatch(/^s7b=.{40,}/);
    const row = await env.DB.prepare("SELECT mailing_consent, pass_hash FROM users WHERE id = ?").bind(id).first<any>();
    expect(row.mailing_consent).toBe(1);
    expect(row.pass_hash).toMatch(/^pbkdf2\$/);
    expect(await (await get("/me", cookie)).text()).toContain("stamps");
  });

  it("stores mailing consent off unless checked", async () => {
    const { id } = await signup();
    const row = await env.DB.prepare("SELECT mailing_consent FROM users WHERE id = ?").bind(id).first<any>();
    expect(row.mailing_consent).toBe(0);
  });

  it("gives a friendly 400 for a duplicate email, any case", async () => {
    const email = `${uniq("dup")}@example.com`;
    await signup({ email });
    const { res } = await signup({ email: email.toUpperCase() });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("already have an account");
    expect(html).toContain("<form");
  });

  it("gives a friendly 400 for a duplicate display name, any case", async () => {
    const name = uniq("Moose ");
    await signup({ name });
    const { res } = await signup({ name: name.toLowerCase() });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("name&#39;s taken");
  });

  it("requires the agree box", async () => {
    const res = await SELF.fetch(`${BASE}/signup`, {
      method: "POST",
      body: form({ email: `${uniq()}@example.com`, display_name: uniq("Nope "), password: "longenough" }),
      redirect: "manual",
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("validates name, email and password", async () => {
    for (const bad of [
      { display_name: "ab", email: "a@b.co", password: "longenough" },
      { display_name: "Bad<script>", email: "a@b.co", password: "longenough" },
      { display_name: "Good Name", email: "not-an-email", password: "longenough" },
      { display_name: "Good Name", email: "a@b.co", password: "short" },
    ]) {
      const res = await SELF.fetch(`${BASE}/signup`, { method: "POST", body: form({ ...bad, agree: "1" }), redirect: "manual" });
      expect(res.status).toBe(400);
    }
  });

  it("keeps the redirect on this site", async () => {
    const res = await SELF.fetch(`${BASE}/signup`, {
      method: "POST",
      body: form({ email: `${uniq()}@example.com`, display_name: uniq("Nx "), password: "longenough", agree: "1", next: "//evil.example" }),
      redirect: "manual",
    });
    expect(res.headers.get("location")).toBe("/postcards");
  });
});

describe("login and logout", () => {
  it("logs in with the right password", async () => {
    const { email } = await signup({ password: "correct horse" });
    const res = await login(email, "correct horse");
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie")).toContain("s7b=");
  });

  it("answers wrong password and unknown email identically, with a 401", async () => {
    const { email } = await signup({ password: "correct horse" });
    const wrong = await login(email, "battery staple");
    const unknown = await login("nobody-here@example.com", "battery staple");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    const strip = (h: string) => h.replace(/value="[^"]*@[^"]*"/, "");
    expect(strip(await wrong.text())).toBe(strip(await unknown.text()));
  });

  it("logout clears the cookie and kills the session", async () => {
    const { cookie } = await signup();
    const res = await SELF.fetch(`${BASE}/logout`, { method: "POST", headers: { cookie }, redirect: "manual" });
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await get("/me", cookie)).status).toBe(302);
  });

  it("refuses a cross-site form post", async () => {
    const res = await SELF.fetch(`${BASE}/login`, {
      method: "POST",
      body: form({ email: "a@b.co", password: "x" }),
      headers: { origin: "https://evil.example" },
      redirect: "manual",
    });
    expect(res.status).toBe(403);
  });
});

describe("safeNext (open-redirect guard)", async () => {
  const { safeNext } = await import("../src/routes/auth");
  it("keeps plain same-site paths", () => {
    expect(safeNext("/postcards")).toBe("/postcards");
    expect(safeNext("/p/Huck%20Hank?x=1#o-2")).toBe("/p/Huck%20Hank?x=1#o-2");
  });
  it("refuses anything a browser could turn into another site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "/ /evil.com", "https://evil.com",
      "evil.com", "/%09/evil.com".replace("%09", "\t"), "\\\\evil.com", 42, undefined, "/" + "a".repeat(250)]) {
      expect(safeNext(bad)).toBeUndefined();
    }
  });
  it("won't bounce a fresh login to another site", async () => {
    const { email } = await signup({ password: "correct horse" });
    const res = await SELF.fetch(`${BASE}/login`, {
      method: "POST", body: form({ email, password: "correct horse", next: "/\t/evil.com" }), redirect: "manual",
    });
    expect(res.headers.get("location")).toBe("/postcards");
  });
});
