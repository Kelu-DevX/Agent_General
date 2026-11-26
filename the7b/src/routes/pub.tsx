import { Hono } from "hono";
import { leaderboard, userTotals } from "../lib/points";
import { activeObjectives, isFinisher, parsePage, playerProgress, wallPage } from "../lib/queries";
import type { AppEnv } from "../types";
import { MePage, PublicProfilePage } from "../views/profile";
import { StandingsPage, WallPageView } from "../views/wall";
import { requireUser } from "./auth";

export const pubRoutes = new Hono<AppEnv>();

pubRoutes.get("/wall", async (c) => {
  const page = parsePage(c.req.query("page"));
  const { cards, hasMore } = await wallPage(c.env.DB, page);
  return c.html(<WallPageView user={c.get("user")} cards={cards} page={page} hasMore={hasMore} />);
});

pubRoutes.get("/standings", async (c) => {
  const rows = await leaderboard(c.env.DB);
  return c.html(<StandingsPage user={c.get("user")} rows={rows} seasonEnd={c.env.SEASON_END} />);
});
pubRoutes.get("/leaderboard", (c) => c.redirect("/standings", 301));

pubRoutes.get("/me", requireUser, async (c) => {
  const user = c.get("user")!;
  const [total, objectives, progress] = await Promise.all([
    userTotals(c.env.DB, user.id),
    activeObjectives(c.env.DB),
    playerProgress(c.env.DB, user.id),
  ]);
  return c.html(
    <MePage user={user} total={total} objectives={objectives} progress={progress}
      finisher={isFinisher(objectives, progress)} />,
  );
});

pubRoutes.get("/p/:name", async (c) => {
  const name = c.req.param("name").slice(0, 40);
  const player = await c.env.DB.prepare("SELECT id, display_name FROM users WHERE display_name = ?")
    .bind(name).first<{ id: number; display_name: string }>();
  if (!player) return c.notFound();
  const [total, objectives, progress, wall] = await Promise.all([
    userTotals(c.env.DB, player.id),
    activeObjectives(c.env.DB),
    playerProgress(c.env.DB, player.id),
    wallPage(c.env.DB, 1, 48, player.id),
  ]);
  return c.html(
    <PublicProfilePage viewer={c.get("user")} name={player.display_name} total={total}
      finisher={isFinisher(objectives, progress)} cards={wall.cards} />,
  );
});

const PHOTO_NAME = /^[a-z0-9]+-[0-9a-f-]{36}\.jpg$/;

// Approved photos are public. Anything else is visible only to its owner and admins.
pubRoutes.get("/photo/:name", async (c) => {
  const name = c.req.param("name");
  if (!PHOTO_NAME.test(name)) return c.notFound();
  const key = `photos/${name}`;
  const sub = await c.env.DB.prepare("SELECT user_id, status FROM submissions WHERE photo_key = ?")
    .bind(key).first<{ user_id: number; status: string }>();
  if (!sub) return c.notFound();
  const user = c.get("user");
  const isPublic = sub.status === "approved";
  if (!isPublic && !(user && (user.is_admin || user.id === sub.user_id))) return c.notFound();
  const obj = await c.env.PHOTOS.get(key);
  if (!obj) return c.notFound();
  return new Response(obj.body, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": isPublic ? "public, max-age=3600" : "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
