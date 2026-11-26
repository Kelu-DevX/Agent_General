import { COPY } from "../copy";
import type { Standing } from "../lib/points";
import { photoUrl, type WallCard } from "../lib/queries";
import type { User } from "../types";
import { Layout } from "./layout";

export function Stamp(props: { points: number; small?: boolean }) {
  return (
    <span class={props.small ? "stamp stamp-sm" : "stamp"} aria-label={`${props.points} ${COPY.objectivesUnit}`}>
      <span class="stamp-n">{props.points}</span>
      <span class="stamp-u">{COPY.objectivesUnit}</span>
    </span>
  );
}

export function profileHref(name: string) {
  return `/p/${encodeURIComponent(name)}`;
}

export function WallGrid(props: { cards: WallCard[]; empty?: string; compact?: boolean }) {
  if (!props.cards.length) return <p class="empty">{props.empty ?? COPY.game.wallEmpty}</p>;
  return (
    <ul class={props.compact ? "wall wall-strip" : "wall"}>
      {props.cards.map((c) => (
        <li class={c.featured ? "pc pc-featured" : "pc"}>
          <figure>
            <div class="pc-photo">
              <img src={photoUrl(c.photo_key)} alt={`${c.title} — a postcard from ${c.display_name}`}
                loading="lazy" decoding="async" />
              {c.featured ? <span class="ribbon">{COPY.game.featured}</span> : null}
            </div>
            <figcaption>
              <span class="pc-title">{c.title}</span>
              <span class="pc-from">
                from <a href={profileHref(c.display_name)}>{c.display_name}</a>
              </span>
            </figcaption>
            <Stamp points={c.points} small />
          </figure>
        </li>
      ))}
    </ul>
  );
}

export function WallPageView(props: { user: User | null; cards: WallCard[]; page: number; hasMore: boolean }) {
  return (
    <Layout title={COPY.game.wallTitle} user={props.user} nav="postcards">
      <section class="section">
        <h1 class="section-title">{COPY.game.wallTitle}</h1>
        <p class="section-sub">{COPY.game.wallSub}</p>
        <WallGrid cards={props.cards} />
        <Pager base="/wall" page={props.page} hasMore={props.hasMore} />
      </section>
    </Layout>
  );
}

export function Pager(props: { base: string; page: number; hasMore: boolean }) {
  if (props.page <= 1 && !props.hasMore) return null;
  return (
    <nav class="pager" aria-label="Pages">
      {props.page > 1 ? <a class="btn btn-ghost" href={`${props.base}?page=${props.page - 1}`}>← Newer</a> : <span />}
      {props.hasMore ? <a class="btn btn-ghost" href={`${props.base}?page=${props.page + 1}`}>Older →</a> : <span />}
    </nav>
  );
}

export function StandingsTable(props: { rows: Standing[]; meId?: number }) {
  if (!props.rows.length) return <p class="empty">{COPY.game.standingsEmpty}</p>;
  return (
    <ol class="standings">
      {props.rows.map((r, i) => (
        <li class={r.user_id === props.meId ? "me" : undefined}>
          <span class="rank">{i + 1}</span>
          <a class="who" href={profileHref(r.display_name)}>{r.display_name}</a>
          <span class="pts">
            {r.total} <small>{COPY.objectivesUnit}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function StandingsPage(props: { user: User | null; rows: Standing[]; seasonEnd: string }) {
  return (
    <Layout title={COPY.game.standingsTitle} user={props.user} nav="standings">
      <section class="section">
        <h1 class="section-title">{COPY.game.standingsTitle}</h1>
        <p class="section-sub">
          Most stamps by March 31 gets a prize in their actual mailbox. Ties go to whoever got there first.
        </p>
        <StandingsTable rows={props.rows} meId={props.user?.id} />
      </section>
    </Layout>
  );
}
