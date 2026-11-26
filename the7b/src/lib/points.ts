// The points engine. Every state change is one D1 batch (a single transaction):
// the status UPDATE is guarded so it only fires from the right state, and the
// ledger INSERT is guarded on the resulting state plus "not already granted".
// So: double taps are no-ops, two admins racing can't double-award, and a
// half-finished approval (status flipped, grant missing) heals on the next tap.
// The ledger_once_per_reason unique index is the last safety net underneath.

export const FEATURE_BONUS = 25;

export type Outcome = "done" | "noop" | "conflict";

const changed = (r: D1Result) => (r.meta?.changes ?? 0) > 0;

export async function approveSubmission(db: D1Database, id: number): Promise<Outcome> {
  try {
    const [upd, ins] = await db.batch([
      db.prepare(
        "UPDATE submissions SET status = 'approved', decided_at = CURRENT_TIMESTAMP, reject_reason = NULL WHERE id = ? AND status = 'pending'",
      ).bind(id),
      db.prepare(
        `INSERT INTO points_ledger (user_id, submission_id, delta, reason)
         SELECT s.user_id, s.id, o.points, 'approve'
           FROM submissions s JOIN objectives o ON o.id = s.objective_id
          WHERE s.id = ? AND s.status = 'approved'
            AND NOT EXISTS (SELECT 1 FROM points_ledger l WHERE l.submission_id = s.id AND l.reason = 'approve')`,
      ).bind(id),
    ]);
    return changed(upd) || changed(ins) ? "done" : "noop";
  } catch (e) {
    // The one-approved-per-objective index refused it: this player already has this one stamped.
    if (String(e).includes("UNIQUE")) return "conflict";
    throw e;
  }
}

export async function rejectSubmission(db: D1Database, id: number, reason?: string | null): Promise<Outcome> {
  const r = await db.prepare(
    "UPDATE submissions SET status = 'rejected', decided_at = CURRENT_TIMESTAMP, reject_reason = ? WHERE id = ? AND status = 'pending'",
  ).bind(reason?.trim().slice(0, 140) || null, id).run();
  return changed(r) ? "done" : "noop";
}

export async function removeSubmission(db: D1Database, id: number): Promise<Outcome> {
  const [upd, ins] = await db.batch([
    db.prepare(
      "UPDATE submissions SET status = 'removed', decided_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'approved'",
    ).bind(id),
    // One compensating row for each grant (approve, featured) not yet revoked.
    db.prepare(
      `INSERT INTO points_ledger (user_id, submission_id, delta, reason)
       SELECT g.user_id, g.submission_id, -g.delta, 'revoke_' || g.reason
         FROM points_ledger g JOIN submissions s ON s.id = g.submission_id
        WHERE g.submission_id = ? AND s.status = 'removed' AND g.reason IN ('approve', 'featured')
          AND NOT EXISTS (SELECT 1 FROM points_ledger r WHERE r.submission_id = g.submission_id AND r.reason = 'revoke_' || g.reason)`,
    ).bind(id),
  ]);
  return changed(upd) || changed(ins) ? "done" : "noop";
}

export async function featureSubmission(db: D1Database, id: number): Promise<Outcome> {
  const [upd, ins] = await db.batch([
    db.prepare("UPDATE submissions SET featured = 1 WHERE id = ? AND status = 'approved' AND featured = 0").bind(id),
    db.prepare(
      `INSERT INTO points_ledger (user_id, submission_id, delta, reason)
       SELECT s.user_id, s.id, ?, 'featured' FROM submissions s
        WHERE s.id = ? AND s.status = 'approved' AND s.featured = 1
          AND NOT EXISTS (SELECT 1 FROM points_ledger l WHERE l.submission_id = s.id AND l.reason = 'featured')`,
    ).bind(FEATURE_BONUS, id),
  ]);
  return changed(upd) || changed(ins) ? "done" : "noop";
}

export interface Standing {
  user_id: number;
  display_name: string;
  total: number;
  last_earned: string;
}

/**
 * Season standings. Admins are left out (no winning your own prize).
 * Ties go to whoever reached the tied total first: the ledger row that
 * brought them to it is their latest one, so earliest latest-row wins.
 */
export async function leaderboard(db: D1Database, limit = 100): Promise<Standing[]> {
  const { results } = await db.prepare(
    `SELECT u.id AS user_id, u.display_name, SUM(l.delta) AS total,
            MAX(l.created_at) AS last_earned, MAX(l.id) AS last_id
       FROM points_ledger l JOIN users u ON u.id = l.user_id
      WHERE u.is_admin = 0
      GROUP BY u.id
     HAVING SUM(l.delta) > 0
      ORDER BY total DESC, last_id ASC
      LIMIT ?`,
  ).bind(limit).all<Standing & { last_id: number }>();
  return results.map(({ last_id: _ignored, ...s }) => s);
}

export async function userTotals(db: D1Database, userId: number): Promise<number> {
  const r = await db.prepare("SELECT COALESCE(SUM(delta), 0) AS total FROM points_ledger WHERE user_id = ?")
    .bind(userId).first<{ total: number }>();
  return r?.total ?? 0;
}
