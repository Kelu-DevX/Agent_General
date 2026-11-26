import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  approveSubmission, featureSubmission, leaderboard, rejectSubmission, removeSubmission, userTotals,
} from "../src/lib/points";
import { uniq } from "./helpers";

const db = () => env.DB;

async function player(admin = false) {
  const n = uniq("pl");
  const r = await db().prepare(
    "INSERT INTO users (email, display_name, pass_hash, is_admin) VALUES (?, ?, 'x', ?) RETURNING id",
  ).bind(`${n}@example.com`, n, admin ? 1 : 0).first<{ id: number }>();
  return r!.id;
}
async function pending(userId: number, objectiveId: number) {
  const r = await db().prepare(
    "INSERT INTO submissions (user_id, objective_id, photo_key) VALUES (?, ?, ?) RETURNING id",
  ).bind(userId, objectiveId, `photos/${crypto.randomUUID()}.jpg`).first<{ id: number }>();
  return r!.id;
}
const status = async (id: number) =>
  (await db().prepare("SELECT status FROM submissions WHERE id = ?").bind(id).first<{ status: string }>())!.status;
const ledgerRows = async (subId: number) =>
  (await db().prepare("SELECT COUNT(*) AS n FROM points_ledger WHERE submission_id = ?").bind(subId).first<{ n: number }>())!.n;

describe("points engine", () => {
  it("approve grants exactly the mission's stamps", async () => {
    const u = await player();
    const s = await pending(u, 4); // Schweitzer Day, 30
    expect(await approveSubmission(db(), s)).toBe("done");
    expect(await status(s)).toBe("approved");
    expect(await userTotals(db(), u)).toBe(30);
  });

  it("a double approve grants once", async () => {
    const u = await player();
    const s = await pending(u, 1);
    await approveSubmission(db(), s);
    expect(await approveSubmission(db(), s)).toBe("noop");
    expect(await userTotals(db(), u)).toBe(20);
  });

  it("two admins approving at the same moment grant once", async () => {
    const u = await player();
    const s = await pending(u, 1);
    await Promise.all([approveSubmission(db(), s), approveSubmission(db(), s), approveSubmission(db(), s)]);
    expect(await userTotals(db(), u)).toBe(20);
    expect(await ledgerRows(s)).toBe(1);
  });

  it("a half-finished approval heals on the next tap", async () => {
    const u = await player();
    const s = await pending(u, 2);
    await db().prepare("UPDATE submissions SET status = 'approved' WHERE id = ?").bind(s).run(); // grant never landed
    expect(await userTotals(db(), u)).toBe(0);
    expect(await approveSubmission(db(), s)).toBe("done");
    expect(await userTotals(db(), u)).toBe(10);
  });

  it("refuses to approve a second photo for an already stamped mission", async () => {
    const u = await player();
    const first = await pending(u, 3);
    await approveSubmission(db(), first);
    const second = await pending(u, 3); // pending can sit beside approved
    expect(await approveSubmission(db(), second)).toBe("conflict");
    expect(await status(second)).toBe("pending");
    expect(await userTotals(db(), u)).toBe(10);
  });

  it("reject grants nothing, and can't touch an approved photo", async () => {
    const u = await player();
    const s = await pending(u, 1);
    expect(await rejectSubmission(db(), s, "  can't see a snowman  ")).toBe("done");
    expect(await userTotals(db(), u)).toBe(0);
    const row = await db().prepare("SELECT status, reject_reason FROM submissions WHERE id = ?").bind(s).first<any>();
    expect(row).toEqual({ status: "rejected", reject_reason: "can't see a snowman" });

    const a = await pending(u, 2);
    await approveSubmission(db(), a);
    expect(await rejectSubmission(db(), a)).toBe("noop");
    expect(await status(a)).toBe("approved");
  });

  it("feature adds 25 once, and only to approved photos", async () => {
    const u = await player();
    const s = await pending(u, 5);
    expect(await featureSubmission(db(), s)).toBe("noop"); // still pending
    await approveSubmission(db(), s);
    expect(await featureSubmission(db(), s)).toBe("done");
    expect(await featureSubmission(db(), s)).toBe("noop");
    expect(await userTotals(db(), u)).toBe(55);
  });

  it("remove after approve and feature nets the player back to zero, exactly once", async () => {
    const u = await player();
    const s = await pending(u, 4);
    await approveSubmission(db(), s);
    await featureSubmission(db(), s);
    expect(await userTotals(db(), u)).toBe(55);
    expect(await removeSubmission(db(), s)).toBe("done");
    expect(await removeSubmission(db(), s)).toBe("noop");
    await Promise.all([removeSubmission(db(), s), removeSubmission(db(), s)]);
    expect(await userTotals(db(), u)).toBe(0);
    expect(await status(s)).toBe("removed");
    expect(await ledgerRows(s)).toBe(4); // approve, featured, and one revoke for each
    expect(await approveSubmission(db(), s)).toBe("noop"); // a removed photo stays removed
    expect(await featureSubmission(db(), s)).toBe("noop");
  });

  it("can't remove something that was never approved", async () => {
    const u = await player();
    const s = await pending(u, 1);
    expect(await removeSubmission(db(), s)).toBe("noop");
    expect(await status(s)).toBe("pending");
  });
});

describe("leaderboard", () => {
  it("orders by stamps, breaks ties by who got there first, and leaves admins out", async () => {
    const early = await player();
    const late = await player();
    const top = await player();
    const admin = await player(true);
    const nobody = await player();
    await approveSubmission(db(), await pending(early, 2)); // 10
    await approveSubmission(db(), await pending(late, 3)); // 10, later
    await approveSubmission(db(), await pending(top, 4)); // 30
    await approveSubmission(db(), await pending(admin, 5)); // 30, but admin
    const all = await leaderboard(db(), 10_000);
    const ours = new Set([early, late, top, admin, nobody]);
    const rows = all.filter((r) => ours.has(r.user_id));
    expect(rows.map((r) => [r.user_id, r.total])).toEqual([[top, 30], [early, 10], [late, 10]]);
    expect(rows[0]).not.toHaveProperty("email");
  });
});
