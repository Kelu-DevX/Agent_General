import { COPY } from "../copy";
import type { WallCard } from "../lib/queries";
import type { Objective, Submission, User } from "../types";
import { Layout } from "./layout";
import { Stamp, WallGrid } from "./wall";

export function FinisherBadge() {
  return (
    <div class="finisher" role="img" aria-label={`${COPY.finisher.name} badge`}>
      <span class="finisher-ring">
        <span class="finisher-star">★</span>
        <span class="finisher-name">{COPY.finisher.name}</span>
      </span>
      <span class="finisher-line">{COPY.finisher.line}</span>
    </div>
  );
}

const label = (s?: Submission) =>
  s?.status === "approved" ? COPY.game.stamped
    : s?.status === "pending" ? "In the mail"
    : s?.status === "rejected" ? "Try again"
    : "Not yet";

export function MePage(props: {
  user: User;
  total: number;
  objectives: Objective[];
  progress: Map<number, Submission>;
  finisher: boolean;
}) {
  return (
    <Layout title="My postcards" user={props.user} nav="me">
      <section class="card profile">
        <p class="eyebrow">Your 7B passport</p>
        <h1 class="script-title">{props.user.display_name}</h1>
        <p class="total">
          <strong>{props.total}</strong> {COPY.objectivesUnit}
        </p>
        {props.finisher ? <FinisherBadge /> : null}
        <ul class="checklist">
          {props.objectives.map((o) => {
            const s = props.progress.get(o.id);
            return (
              <li class={`check-${s?.status ?? "none"}`}>
                <span class="check-title">{o.title}</span>
                <span class="check-state">{label(s)}</span>
                <Stamp points={o.points} small />
              </li>
            );
          })}
        </ul>
        <p class="center">
          <a class="btn btn-red" href="/postcards">{COPY.home.cta}</a>
        </p>
        <p class="small center muted">Signed in as {props.user.email} — only you can see this.</p>
      </section>
    </Layout>
  );
}

export function PublicProfilePage(props: {
  viewer: User | null;
  name: string;
  total: number;
  finisher: boolean;
  cards: WallCard[];
}) {
  return (
    <Layout title={props.name} user={props.viewer} nav="standings">
      <section class="card profile">
        <p class="eyebrow">Postcards from</p>
        <h1 class="script-title">{props.name}</h1>
        <p class="total">
          <strong>{props.total}</strong> {COPY.objectivesUnit}
        </p>
        {props.finisher ? <FinisherBadge /> : null}
      </section>
      <section class="section">
        <WallGrid cards={props.cards} empty="No postcards on the wall yet." />
      </section>
    </Layout>
  );
}
