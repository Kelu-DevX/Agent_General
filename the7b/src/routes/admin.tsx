import { Hono, type Context } from "hono";
import { destroyUserSessions, hashPassword } from "../lib/auth";
import {
  approveSubmission, featureSubmission, rejectSubmission, removeSubmission, type Outcome,
} from "../lib/points";
import { allObjectives } from "../lib/queries";
import type { AppEnv, Happening } from "../types";
import { AdminPage, type PlayerRow, type QueueItem, type WallItem } from "../views/admin";
import { requireAdmin } from "./auth";

export const adminRoutes = new Hono<AppEnv>();
adminRoutes.use("/admin", requireAdmin);
adminRoutes.use("/admin/*", requireAdmin);

const MESSAGES: Record<string, string> = {
  approved: "Approved — it's on the wall and the stamps are counted.",
  rejected: "Rejected. They'll see your note and can try again.",
  removed: "Removed from the wall, stamps taken back.",
  featured: "Postcard of the Week! +25 stamps.",
  noop: "Already handled — nothing changed.",
  conflict: "They already have this mission stamped, so this one can't be approved. Reject it instead.",
  happening: "Saved.",
  mission: "Mission saved.",
};

async function render(c: Context<AppEnv>, extra: { tempPassword?: { name: string; password: string } } = {}) {
  const db = c.env.DB;
  const [queue, wall, happenings, objectives, players] = await Promise.all([
    db.prepare(
      `SELECT s.id, s.photo_key, s.created_at, u.display_name, o.title, o.points
         FROM submissions s JOIN users u ON u.id = s.user_id JOIN objectives o ON o.id = s.objective_id
        WHERE s.status = 'pending' ORDER BY s.id ASC LIMIT 100`,
    ).all<QueueItem>(),
    db.prepare(
      `SELECT s.id, s.photo_key, s.created_at, s.featured, u.display_name, o.title, o.points
         FROM submissions s JOIN users u ON u.id = s.user_id JOIN objectives o ON o.id = s.objective_id
        WHERE s.status = 'approved' ORDER BY s.decided_at DESC, s.id DESC LIMIT 30`,
    ).all<WallItem>(),
    db.prepare("SELECT * FROM happenings ORDER BY active DESC, sort, id").all<Happening>(),
    allObjectives(db),
    db.prepare(
      `SELECT u.id, u.display_name, u.email, u.is_admin, u.mailing_consent, u.created_at,
              COALESCE((SELECT SUM(delta) FROM points_ledger l WHERE l.user_id = u.id), 0) AS total
         FROM users u ORDER BY u.id DESC LIMIT 500`,
    ).all<PlayerRow>(),
  ]);
  const user = c.get("user")!;
  user.pending_count = queue.results.length;
  return c.html(
    <AdminPage user={user} message={MESSAGES[c.req.query("m") ?? ""]} queue={queue.results} wall={wall.results}
      happenings={happenings.results} objectives={objectives} players={players.results} {...extra} />,
  );
}

adminRoutes.get("/admin", (c) => render(c));

const idParam = (c: Context<AppEnv>) => {
  const n = Number(c.req.param("id"));
  return Number.isInteger(n) && n > 0 ? n : 0;
};
const back = (c: Context<AppEnv>, m: string, anchor: string) => c.redirect(`/admin?m=${m}#${anchor}`, 303);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

async function photoKey(db: D1Database, id: number) {
  return (await db.prepare("SELECT photo_key FROM submissions WHERE id = ?").bind(id).first<{ photo_key: string }>())
    ?.photo_key;
}

adminRoutes.post("/admin/submissions/:id/:action{approve|reject|remove|feature}", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const action = c.req.param("action");
  let outcome: Outcome;
  if (action === "approve") outcome = await approveSubmission(db, id);
  else if (action === "feature") outcome = await featureSubmission(db, id);
  else {
    const key = await photoKey(db, id);
    outcome = action === "reject"
      ? await rejectSubmission(db, id, str((await c.req.parseBody()).reason))
      : await removeSubmission(db, id);
    // Rejected and removed photos aren't kept around.
    if (outcome === "done" && key) await c.env.PHOTOS.delete(key);
  }
  const done = { approve: "approved", reject: "rejected", remove: "removed", feature: "featured" }[action]!;
  return back(c, outcome === "done" ? done : outcome, action === "approve" || action === "reject" ? "queue" : "wall");
});

function happeningFields(body: Record<string, unknown>) {
  const sort = Number.parseInt(str(body.sort), 10);
  return {
    text: str(body.text).slice(0, 200),
    date_label: str(body.date_label).slice(0, 40) || null,
    sort: Number.isFinite(sort) ? sort : 0,
  };
}

adminRoutes.post("/admin/happenings", async (c) => {
  const f = happeningFields(await c.req.parseBody());
  if (f.text) {
    await c.env.DB.prepare(
      "INSERT INTO happenings (text, date_label, sort) VALUES (?, ?, COALESCE((SELECT MAX(sort) + 1 FROM happenings), 0))",
    ).bind(f.text, f.date_label).run();
  }
  return back(c, "happening", "happenings");
});

adminRoutes.post("/admin/happenings/:id", async (c) => {
  const body = await c.req.parseBody();
  const f = happeningFields(body);
  if (f.text) {
    await c.env.DB.prepare("UPDATE happenings SET text = ?, date_label = ?, sort = ?, active = ? WHERE id = ?")
      .bind(f.text, f.date_label, f.sort, body.active ? 1 : 0, idParam(c)).run();
  }
  return back(c, "happening", "happenings");
});

adminRoutes.post("/admin/objectives/:id", async (c) => {
  const body = await c.req.parseBody();
  const title = str(body.title).slice(0, 60);
  const description = str(body.description).slice(0, 300);
  const points = Number.parseInt(str(body.points), 10);
  const sort = Number.parseInt(str(body.sort), 10);
  if (title && description && Number.isFinite(points) && points >= 0 && points <= 500) {
    await c.env.DB.prepare("UPDATE objectives SET title = ?, description = ?, points = ?, sort = ?, active = ? WHERE id = ?")
      .bind(title, description, points, Number.isFinite(sort) ? sort : 0, body.active ? 1 : 0, idParam(c)).run();
  }
  return back(c, "mission", "missions");
});

const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i

export function tempPassword(length = 10): string {
  const out: string[] = [];
  const limit = 256 - (256 % TEMP_ALPHABET.length); // reject-sample to avoid modulo bias
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < limit && out.length < length) out.push(TEMP_ALPHABET[b % TEMP_ALPHABET.length]);
    }
  }
  return out.join("");
}

adminRoutes.post("/admin/users/:id/temp-password", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const player = await db.prepare("SELECT display_name FROM users WHERE id = ?").bind(id).first<{ display_name: string }>();
  if (!player) return c.notFound();
  const password = tempPassword();
  await db.prepare("UPDATE users SET pass_hash = ? WHERE id = ?").bind(await hashPassword(password), id).run();
  await destroyUserSessions(db, id);
  c.header("Cache-Control", "no-store");
  return render(c, { tempPassword: { name: player.display_name, password } });
});

adminRoutes.get("/admin/mailing.csv", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT display_name, email, created_at FROM users WHERE mailing_consent = 1 ORDER BY id",
  ).all<{ display_name: string; email: string; created_at: string }>();
  // Quote every field; neutralise spreadsheet formulas.
  const cell = (v: string) => `"${(/^[=+\-@]/.test(v) ? "'" + v : v).replace(/"/g, '""')}"`;
  const csv = ["display_name,email,joined", ...results.map((r) => [r.display_name, r.email, r.created_at].map(cell).join(","))]
    .join("\r\n");
  return c.body(csv + "\r\n", 200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": 'attachment; filename="7b-mail-list.csv"',
    "cache-control": "no-store",
  });
});
