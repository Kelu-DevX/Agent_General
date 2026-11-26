import { COPY } from "../copy";
import { photoUrl, type WallCard } from "../lib/queries";
import type { Objective, Submission, User } from "../types";
import { Layout, Notice } from "./layout";
import { Stamp, WallGrid } from "./wall";

function ObjectiveCard(props: {
  o: Objective;
  n: number;
  user: User | null;
  sub?: Submission;
  over: boolean;
  error?: string;
}) {
  const { o, sub, user } = props;
  const state = sub?.status;
  return (
    <li class={`mission${state === "approved" ? " mission-done" : ""}`} id={`o-${o.id}`}>
      <div class="mission-head">
        <span class="mission-n">No. {props.n}</span>
        <Stamp points={o.points} />
      </div>
      <h3 class="mission-title">{o.title}</h3>
      <p class="mission-desc">{o.description}</p>

      {props.error ? <Notice kind="err">{props.error}</Notice> : null}

      {state === "approved" ? (
        <div class="mission-stamped">
          <img src={photoUrl(sub!.photo_key)} alt={`Your ${o.title} postcard`} loading="lazy" />
          <span class="postmark">{COPY.game.stamped}</span>
        </div>
      ) : state === "pending" ? (
        <Notice kind="info">{COPY.game.pending}</Notice>
      ) : (
        <>
          {state === "rejected" ? <Notice kind="err">{COPY.game.rejected(sub!.reject_reason)}</Notice> : null}
          {props.over ? null : user ? (
            <form method="post" action="/postcards/submit" enctype="multipart/form-data" class="send" data-upload="">
              <input type="hidden" name="objective_id" value={String(o.id)} />
              <label class="file">
                <input type="file" name="photo" accept="image/jpeg,image/*" required />
                <span class="file-label">Choose a photo</span>
              </label>
              <button type="submit" class="btn btn-red">{COPY.game.send}</button>
              <p class="hint">{COPY.game.sendHint}</p>
            </form>
          ) : (
            <a class="btn btn-green" href="/signup?next=%2Fpostcards">{COPY.game.loginToPlay}</a>
          )}
        </>
      )}
    </li>
  );
}

export function GamePage(props: {
  user: User | null;
  objectives: Objective[];
  progress: Map<number, Submission>;
  wall: WallCard[];
  wallMore: boolean;
  over: boolean;
  sent?: boolean;
  error?: { objectiveId?: number; message: string };
}) {
  const general = props.error && !props.objectives.some((o) => o.id === props.error!.objectiveId);
  return (
    <Layout title={COPY.gameName} user={props.user} nav="postcards">
      <section class="game-hero">
        <p class="eyebrow">Winter season · through March 31</p>
        <h1 class="script-title">Postcards</h1>
        <p class="lede">{COPY.game.intro}</p>
        <p>
          <a class="link-arrow" href="/standings">{COPY.game.standingsTitle} →</a>
        </p>
      </section>

      {props.over ? <Notice kind="info">{COPY.game.seasonOver}</Notice> : null}
      {props.sent ? <Notice kind="ok">{COPY.game.sent}</Notice> : null}
      {general ? <Notice kind="err">{props.error!.message}</Notice> : null}

      <ol class="missions">
        {props.objectives.map((o, i) => (
          <ObjectiveCard o={o} n={i + 1} user={props.user} sub={props.progress.get(o.id)} over={props.over}
            error={props.error?.objectiveId === o.id ? props.error.message : undefined} />
        ))}
      </ol>

      <section class="section" id="wall">
        <h2 class="section-title">{COPY.game.wallTitle}</h2>
        <p class="section-sub">{COPY.game.wallSub}</p>
        <WallGrid cards={props.wall} />
        {props.wallMore ? (
          <p class="center">
            <a class="btn btn-ghost" href="/wall?page=2">See more of the wall</a>
          </p>
        ) : null}
      </section>
      <script src="/upload.js" defer></script>
    </Layout>
  );
}
