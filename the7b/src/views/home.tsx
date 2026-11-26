import { COPY } from "../copy";
import type { WallCard } from "../lib/queries";
import type { Weather } from "../lib/weather";
import type { Happening, User } from "../types";
import { Layout } from "./layout";
import { WallGrid } from "./wall";

export function Postmark(props: { weather: Weather }) {
  return (
    <div class="postmark-weather" role="group" aria-label={COPY.home.weatherLabel}>
      <span class="pw-ring" aria-hidden="true"></span>
      <span class="pw-label">{COPY.home.weatherLabel}</span>
      <span class="pw-temp">{props.weather.tempF}°</span>
      {props.weather.desc ? <span class="pw-desc">{props.weather.desc}</span> : null}
    </div>
  );
}

export function HomePage(props: {
  user: User | null;
  weather: Weather | null;
  happenings: Happening[];
  recent: WallCard[];
  siteUrl: string;
}) {
  return (
    <Layout user={props.user} nav="home" siteUrl={props.siteUrl}>
      <section class="hero">
        <h1 class="hero-title">
          <span class="hero-greet">Greetings from</span>
          <span class="hero-letters" aria-label="7B">7B</span>
        </h1>
        <p class="hero-kicker">{COPY.hero.kicker}</p>
        <p class="hero-sub">{COPY.hero.sub}</p>
        <p class="hero-ctas">
          <a class="btn btn-red btn-big" href="/postcards">{COPY.home.cta}</a>
          {props.user ? null : <a class="btn btn-ghost btn-big" href="/signup">{COPY.home.join}</a>}
        </p>
        {props.weather ? <Postmark weather={props.weather} /> : null}
      </section>

      <section class="section notes" aria-labelledby="going-on">
        <h2 id="going-on" class="section-title">{COPY.home.happeningsTitle}</h2>
        {props.happenings.length ? (
          <ul class="ruled">
            {props.happenings.map((h) => (
              <li>
                {h.date_label ? <span class="when">{h.date_label}</span> : null}
                <span class="what">{h.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p class="empty">{COPY.home.happeningsEmpty}</p>
        )}
      </section>

      <section class="section" aria-labelledby="fresh">
        <h2 id="fresh" class="section-title">{COPY.home.stripTitle}</h2>
        <WallGrid cards={props.recent} empty={COPY.home.stripEmpty} compact />
        {props.recent.length ? (
          <p class="center">
            <a class="btn btn-ghost" href="/wall">See the whole wall</a>
          </p>
        ) : null}
      </section>
    </Layout>
  );
}
