import { Hono, type Context } from "hono";
import { COPY } from "../copy";
import { MAX_BYTES, JpegError, storePhoto, validateJpeg } from "../lib/photos";
import { activeObjectives, playerProgress, wallPage } from "../lib/queries";
import { pacificDayStartUtc, seasonOver } from "../lib/time";
import type { AppEnv } from "../types";
import { GamePage } from "../views/game";
import { requireUser } from "./auth";

export const DAILY_CAP = 20;

export const gameRoutes = new Hono<AppEnv>();

async function renderGame(
  c: Context<AppEnv>,
  status: 200 | 400 | 429 = 200,
  error?: { objectiveId?: number; message: string },
) {
  const user = c.get("user");
  const [objectives, progress, wall] = await Promise.all([
    activeObjectives(c.env.DB),
    user ? playerProgress(c.env.DB, user.id) : Promise.resolve(new Map()),
    wallPage(c.env.DB, 1, 12),
  ]);
  return c.html(
    <GamePage user={user} objectives={objectives} progress={progress} wall={wall.cards} wallMore={wall.hasMore}
      over={seasonOver(c.env.SEASON_END)} sent={c.req.query("sent") === "1"} error={error} />,
    status,
  );
}

gameRoutes.get("/postcards", (c) => renderGame(c));

gameRoutes.post("/postcards/submit", requireUser, async (c) => {
  const user = c.get("user")!;
  const db = c.env.DB;
  if (seasonOver(c.env.SEASON_END)) return renderGame(c, 400, { message: COPY.game.seasonOverShort });

  const body = await c.req.parseBody();
  const objectiveId = Number(body.objective_id);
  const objective = Number.isInteger(objectiveId)
    ? await db.prepare("SELECT id FROM objectives WHERE id = ? AND active = 1").bind(objectiveId).first()
    : null;
  if (!objective) return renderGame(c, 400, { message: COPY.errors.noObjective });
  const fail = (message: string, status: 400 | 429 = 400) => renderGame(c, status, { objectiveId, message });

  const existing = await db.prepare(
    "SELECT status FROM submissions WHERE user_id = ? AND objective_id = ? AND status IN ('approved', 'pending')",
  ).bind(user.id, objectiveId).all<{ status: string }>();
  if (existing.results.some((r) => r.status === "approved")) return fail(COPY.errors.alreadyStamped);
  if (existing.results.some((r) => r.status === "pending")) return fail(COPY.errors.alreadyPending);

  const today = await db.prepare("SELECT COUNT(*) AS n FROM submissions WHERE user_id = ? AND created_at >= ?")
    .bind(user.id, pacificDayStartUtc()).first<{ n: number }>();
  if ((today?.n ?? 0) >= DAILY_CAP) return fail(COPY.errors.dailyCap, 429);

  const file = body.photo;
  if (!(file instanceof File) || file.size === 0) return fail(COPY.errors.noPhoto);
  if (file.size > MAX_BYTES) return fail(COPY.errors.size);
  const bytes = await file.arrayBuffer();
  const invalid = validateJpeg(bytes);
  if (invalid) return fail(invalid);

  let key: string;
  try {
    key = await storePhoto(c.env, bytes);
  } catch (e) {
    if (e instanceof JpegError) return fail(COPY.errors.unreadable);
    throw e;
  }
  try {
    await db.prepare("INSERT INTO submissions (user_id, objective_id, photo_key) VALUES (?, ?, ?)")
      .bind(user.id, objectiveId, key).run();
  } catch (e) {
    await c.env.PHOTOS.delete(key);
    if (String(e).includes("UNIQUE")) return fail(COPY.errors.alreadyPending);
    throw e;
  }
  return c.redirect(`/postcards?sent=1#o-${objectiveId}`, 303);
});
