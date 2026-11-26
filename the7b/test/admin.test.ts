import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { tempPassword } from "../src/routes/admin";
import { BASE, get, makeAdmin, post, r2Count, signup, submit } from "./helpers";

async function admin() {
  const a = await signup();
  await makeAdmin(a.id);
  return a;
}
async function pendingFrom(objective = 1) {
  const p = await signup();
  await submit(p.cookie, objective);
  const s = await env.DB.prepare("SELECT id, photo_key FROM submissions WHERE user_id = ?").bind(p.id).first<any>();
  return { ...p, subId: s.id as number, key: s.photo_key as string };
}
const photoPath = (key: string) => `/photo/${key.replace("photos/", "")}`;

describe("admin access", () => {
  it("sends logged-out visitors to log in", async () => {
    const res = await get("/admin");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login");
  });
  it("gives players a 403, never a crash", async () => {
    const { cookie } = await signup();
    expect((await get("/admin", cookie)).status).toBe(403);
    expect((await post("/admin/submissions/1/approve", cookie)).status).toBe(403);
    expect((await post("/admin/users/1/temp-password", cookie)).status).toBe(403);
    expect((await get("/admin/mailing.csv", cookie)).status).toBe(403);
  });
  it("opens for admins with a pending count", async () => {
    const a = await admin();
    await pendingFrom();
    const res = await get("/admin", a.cookie);
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/In the mail \(\d+\)/);
  });
});

describe("moderation", () => {
  it("approve flips the status and puts the photo on the public wall", async () => {
    const a = await admin();
    const p = await pendingFrom(2);
    expect(await (await get("/wall")).text()).not.toContain(photoPath(p.key));
    const res = await post(`/admin/submissions/${p.subId}/approve`, a.cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin?m=approved#queue");
    const wall = await (await get("/wall")).text();
    expect(wall).toContain(photoPath(p.key));
    expect(wall).toContain(p.name);
    expect(wall).not.toContain(p.email);
    expect((await get(photoPath(p.key))).status).toBe(200);
  });

  it("reject shows the reason to the player and deletes the photo", async () => {
    const a = await admin();
    const p = await pendingFrom(3);
    await post(`/admin/submissions/${p.subId}/reject`, a.cookie, { reason: "we can't spot the lights" });
    expect(await env.PHOTOS.get(p.key)).toBeNull();
    expect(await (await get("/postcards", p.cookie)).text()).toContain("we can&#39;t spot the lights");
  });

  it("remove takes it off the wall and takes back its stamps", async () => {
    const a = await admin();
    const p = await pendingFrom(4);
    await post(`/admin/submissions/${p.subId}/approve`, a.cookie);
    await post(`/admin/submissions/${p.subId}/feature`, a.cookie);
    expect(await (await get("/me", p.cookie)).text()).toContain("<strong>55</strong>");
    await post(`/admin/submissions/${p.subId}/remove`, a.cookie);
    expect(await (await get("/wall")).text()).not.toContain(photoPath(p.key));
    expect(await (await get("/me", p.cookie)).text()).toContain("<strong>0</strong>");
    expect((await get(photoPath(p.key))).status).toBe(404);
  });

  it("a repeated tap says it's already handled", async () => {
    const a = await admin();
    const p = await pendingFrom(5);
    await post(`/admin/submissions/${p.subId}/approve`, a.cookie);
    const again = await post(`/admin/submissions/${p.subId}/approve`, a.cookie);
    expect(again.headers.get("location")).toContain("m=noop");
  });

  it("404s unknown actions", async () => {
    const a = await admin();
    expect((await post("/admin/submissions/1/delete-everything", a.cookie)).status).toBe(404);
  });
});

describe("happenings and missions", () => {
  it("adds and edits what's going on", async () => {
    const a = await admin();
    await post("/admin/happenings", a.cookie, { text: "Tree lighting at Farmin Park", date_label: "Sat 5pm" });
    const h = await env.DB.prepare("SELECT * FROM happenings WHERE text LIKE 'Tree lighting%'").first<any>();
    expect(h.date_label).toBe("Sat 5pm");
    expect(h.active).toBe(1);
    await post(`/admin/happenings/${h.id}`, a.cookie, { text: "Tree lighting (moved)", date_label: "", sort: "3" });
    const after = await env.DB.prepare("SELECT * FROM happenings WHERE id = ?").bind(h.id).first<any>();
    expect(after).toMatchObject({ text: "Tree lighting (moved)", date_label: null, sort: 3, active: 0 });
  });

  it("edits a mission", async () => {
    const a = await admin();
    const o = await env.DB.prepare("SELECT * FROM objectives WHERE id = 5").first<any>();
    await post("/admin/objectives/5", a.cookie, { title: o.title, description: o.description, points: "35", sort: "5", active: "1" });
    expect((await env.DB.prepare("SELECT points FROM objectives WHERE id = 5").first<any>()).points).toBe(35);
    await post("/admin/objectives/5", a.cookie, { title: o.title, description: o.description, points: "30", sort: "5", active: "1" });
  });
});

describe("temp passwords", () => {
  it("are readable and unbiased in shape", () => {
    const p = tempPassword();
    expect(p).toMatch(/^[a-hjkmnp-z2-9]{10}$/);
  });

  it("shows a password once that then logs in, and logs the player out everywhere", async () => {
    const a = await admin();
    const p = await signup({ password: "forgotten-it" });
    const res = await post(`/admin/users/${p.id}/temp-password`, a.cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const temp = (await res.text()).match(/<code class="temp-pass">([a-z0-9]{10})<\/code>/)![1];
    expect((await get("/me", p.cookie)).status).toBe(302); // old session gone
    const login = await SELF.fetch(`${BASE}/login`, {
      method: "POST", body: new URLSearchParams({ email: p.email, password: temp }), redirect: "manual",
    });
    expect(login.status).toBe(303);
    const old = await SELF.fetch(`${BASE}/login`, {
      method: "POST", body: new URLSearchParams({ email: p.email, password: "forgotten-it" }), redirect: "manual",
    });
    expect(old.status).toBe(401);
  });
});

describe("mail list", () => {
  it("exports only people who said yes", async () => {
    const a = await admin();
    const yes = await signup({ consent: true });
    const no = await signup();
    const res = await get("/admin/mailing.csv", a.cookie);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const csv = await res.text();
    expect(csv).toContain(yes.email);
    expect(csv).not.toContain(no.email);
  });
});

void r2Count;
