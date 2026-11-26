import type { Happening, Objective, Submission } from "../types";

export const WALL_PAGE_SIZE = 24;

export interface WallCard {
  id: number;
  photo_key: string;
  featured: number;
  decided_at: string;
  display_name: string;
  title: string;
  points: number;
}

/** Clamp a ?page= value to a sane positive integer. Garbage becomes page 1. */
export function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 10_000) : 1;
}

/** Approved postcards, newest first. Never selects emails. */
export async function wallPage(db: D1Database, page = 1, size = WALL_PAGE_SIZE, userId?: number) {
  const { results } = await db.prepare(
    `SELECT s.id, s.photo_key, s.featured, s.decided_at, u.display_name, o.title, o.points
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       JOIN objectives o ON o.id = s.objective_id
      WHERE s.status = 'approved' ${userId ? "AND s.user_id = ?" : ""}
      ORDER BY s.decided_at DESC, s.id DESC
      LIMIT ? OFFSET ?`,
  ).bind(...(userId ? [userId] : []), size + 1, (page - 1) * size).all<WallCard>();
  return { cards: results.slice(0, size), hasMore: results.length > size };
}

export async function activeObjectives(db: D1Database): Promise<Objective[]> {
  const { results } = await db.prepare("SELECT * FROM objectives WHERE active = 1 ORDER BY sort, id").all<Objective>();
  return results;
}

export async function allObjectives(db: D1Database): Promise<Objective[]> {
  const { results } = await db.prepare("SELECT * FROM objectives ORDER BY sort, id").all<Objective>();
  return results;
}

/** For each objective, the player's most telling submission: approved > pending > latest rejected. */
export async function playerProgress(db: D1Database, userId: number): Promise<Map<number, Submission>> {
  const { results } = await db.prepare(
    `SELECT * FROM submissions WHERE user_id = ? AND status != 'removed'
      ORDER BY CASE status WHEN 'approved' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, id DESC`,
  ).bind(userId).all<Submission>();
  const map = new Map<number, Submission>();
  for (const s of results) if (!map.has(s.objective_id)) map.set(s.objective_id, s);
  return map;
}

export function isFinisher(objectives: Objective[], progress: Map<number, Submission>): boolean {
  return objectives.length > 0 && objectives.every((o) => progress.get(o.id)?.status === "approved");
}

export async function activeHappenings(db: D1Database): Promise<Happening[]> {
  const { results } = await db.prepare("SELECT * FROM happenings WHERE active = 1 ORDER BY sort, id").all<Happening>();
  return results;
}

export async function pendingCount(db: D1Database): Promise<number> {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM submissions WHERE status = 'pending'").first<{ n: number }>();
  return r?.n ?? 0;
}

/** "photos/abc.jpg" -> "/photo/abc.jpg" */
export const photoUrl = (key: string) => `/photo/${key.replace(/^photos\//, "")}`;
