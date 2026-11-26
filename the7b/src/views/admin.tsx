import { photoUrl } from "../lib/queries";
import { pacificShort as when } from "../lib/time";
import type { Happening, Objective, User } from "../types";
import { Layout, Notice } from "./layout";

export interface QueueItem {
  id: number;
  photo_key: string;
  created_at: string;
  display_name: string;
  title: string;
  points: number;
}
export interface WallItem extends QueueItem {
  featured: number;
}
export interface PlayerRow {
  id: number;
  display_name: string;
  email: string;
  is_admin: number;
  mailing_consent: number;
  created_at: string;
  total: number;
}


function Btn(props: { action: string; label: string; kind: string }) {
  return (
    <form method="post" action={props.action} class="inline">
      <button type="submit" class={`btn ${props.kind}`}>{props.label}</button>
    </form>
  );
}

export function AdminPage(props: {
  user: User;
  message?: string;
  queue: QueueItem[];
  wall: WallItem[];
  happenings: Happening[];
  objectives: Objective[];
  players: PlayerRow[];
  tempPassword?: { name: string; password: string };
}) {
  return (
    <Layout title="Mail room" user={props.user} nav="admin">
      <h1 class="script-title">Mail room</h1>
      {props.message ? <Notice kind="ok">{props.message}</Notice> : null}
      {props.tempPassword ? (
        <Notice kind="info">
          Temporary password for <strong>{props.tempPassword.name}</strong>:{" "}
          <code class="temp-pass">{props.tempPassword.password}</code> — shown once. They've been logged out everywhere.
        </Notice>
      ) : null}

      <nav class="admin-jump" aria-label="Sections">
        <a href="#queue">Queue ({props.queue.length})</a>
        <a href="#wall">Wall</a>
        <a href="#happenings">Going on</a>
        <a href="#missions">Missions</a>
        <a href="#players">Players</a>
      </nav>

      <section class="section" id="queue">
        <h2 class="section-title">In the mail ({props.queue.length})</h2>
        {props.queue.length === 0 ? <p class="empty">Queue's clear. Go enjoy the snow.</p> : null}
        <ul class="queue">
          {props.queue.map((q) => (
            <li class="queue-item">
              <img src={photoUrl(q.photo_key)} alt={`${q.title} from ${q.display_name}`} loading="lazy" />
              <p class="queue-meta">
                <strong>{q.title}</strong> · {q.points} stamps
                <br />
                from {q.display_name} · {when(q.created_at)}
              </p>
              <div class="queue-actions">
                <Btn action={`/admin/submissions/${q.id}/approve`} label="Approve" kind="btn-green btn-big" />
                <details class="reject">
                  <summary class="btn btn-ghost btn-big">Reject…</summary>
                  <form method="post" action={`/admin/submissions/${q.id}/reject`} class="form">
                    <label>
                      Reason (optional, they'll see it)
                      <input name="reason" maxlength={140} placeholder="e.g. we can't spot the statue" />
                    </label>
                    <button type="submit" class="btn btn-red">Reject</button>
                  </form>
                </details>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section class="section" id="wall">
        <h2 class="section-title">On the wall</h2>
        {props.wall.length === 0 ? <p class="empty">Nothing approved yet.</p> : null}
        <ul class="admin-wall">
          {props.wall.map((w) => (
            <li>
              <img src={photoUrl(w.photo_key)} alt="" loading="lazy" />
              <p class="queue-meta">
                <strong>{w.title}</strong> · {w.display_name}
                {w.featured ? <span class="tag">Postcard of the Week</span> : null}
              </p>
              <div class="queue-actions">
                {w.featured ? null : <Btn action={`/admin/submissions/${w.id}/feature`} label="Feature +25" kind="btn-gold" />}
                <details class="reject">
                  <summary class="btn btn-ghost">Remove…</summary>
                  <p class="small">Takes it off the wall and takes back its stamps.</p>
                  <Btn action={`/admin/submissions/${w.id}/remove`} label="Yes, remove it" kind="btn-red" />
                </details>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section class="section" id="happenings">
        <h2 class="section-title">What's going on in 7B</h2>
        <form method="post" action="/admin/happenings" class="form card">
          <label>
            New item
            <input name="text" required maxlength={200} placeholder="Tree lighting at Farmin Park" />
          </label>
          <label>
            When (optional)
            <input name="date_label" maxlength={40} placeholder="Sat Dec 6, 5pm" />
          </label>
          <button type="submit" class="btn btn-green">Add it</button>
        </form>
        <ul class="edit-list">
          {props.happenings.map((h) => (
            <li>
              <form method="post" action={`/admin/happenings/${h.id}`} class="form card">
                <input name="text" required maxlength={200} value={h.text} aria-label="Text" />
                <div class="row">
                  <input name="date_label" maxlength={40} value={h.date_label ?? ""} aria-label="When" placeholder="When" />
                  <input name="sort" type="number" value={String(h.sort)} aria-label="Order" class="narrow" />
                </div>
                <label class="check">
                  <input type="checkbox" name="active" value="1" checked={!!h.active} />
                  <span>Showing on the home page</span>
                </label>
                <button type="submit" class="btn btn-ghost">Save</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section class="section" id="missions">
        <h2 class="section-title">Missions</h2>
        <p class="small">Changing stamps only affects future approvals.</p>
        <ul class="edit-list">
          {props.objectives.map((o) => (
            <li>
              <form method="post" action={`/admin/objectives/${o.id}`} class="form card">
                <input name="title" required maxlength={60} value={o.title} aria-label="Title" />
                <textarea name="description" required maxlength={300} rows={3} aria-label="Description">{o.description}</textarea>
                <div class="row">
                  <label>
                    Stamps <input name="points" type="number" min={0} max={500} value={String(o.points)} class="narrow" />
                  </label>
                  <label>
                    Order <input name="sort" type="number" value={String(o.sort)} class="narrow" />
                  </label>
                </div>
                <label class="check">
                  <input type="checkbox" name="active" value="1" checked={!!o.active} />
                  <span>On the board</span>
                </label>
                <button type="submit" class="btn btn-ghost">Save</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section class="section" id="players">
        <h2 class="section-title">Players ({props.players.length})</h2>
        <p class="small">
          <a href="/admin/mailing.csv">Download the 7B mail list</a> (only people who said yes).
        </p>
        <ul class="players">
          {props.players.map((p) => (
            <li>
              <p>
                <strong>{p.display_name}</strong>
                {p.is_admin ? <span class="tag">admin</span> : null} · {p.total} stamps
                <br />
                <span class="small">{p.email}{p.mailing_consent ? " · ✉ yes" : ""}</span>
              </p>
              <form method="post" action={`/admin/users/${p.id}/temp-password`} class="inline">
                <button type="submit" class="btn btn-ghost btn-sm">Temp password</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
