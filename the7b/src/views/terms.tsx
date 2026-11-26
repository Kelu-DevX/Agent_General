import type { User } from "../types";
import { Layout } from "./layout";

// Full text from docs/COPY.md, "Terms & privacy".
export function TermsPage(props: { user: User | null; contact: string }) {
  return (
    <Layout title="Terms & privacy" user={props.user}>
      <article class="card prose">
        <h1 class="section-title">Terms &amp; privacy</h1>
        <p class="lede">
          <strong>The short version:</strong> be kind, post your own photos, keep it wholesome.
        </p>
        <ol class="terms">
          <li>
            <strong>Your photos.</strong> Only upload photos you took. By uploading, you let 7B display them publicly
            on the wall. They're still yours.
          </li>
          <li>
            <strong>Moderation.</strong> Every photo is reviewed by a human before it posts. We can decline or remove
            anything, anytime — usually for privacy, safety, or vibe. No hard feelings.
          </li>
          <li>
            <strong>People in photos.</strong> Don't post other people without their OK, and never other people's kids.
          </li>
          <li>
            <strong>Age.</strong> You need to be 13 or older to make an account.
          </li>
          <li>
            <strong>Privacy.</strong> We collect your email and display name. That's it. The wall shows your display
            name only — never your email, never your location. Photos are scrubbed of location data before they're
            stored. We never sell your info.
          </li>
          <li>
            <strong>Prizes.</strong> Seasonal prizes are small, fun, and mailed — winners are contacted by email. Not a
            lottery, just neighbors playing a game.
          </li>
          <li>
            <strong>Down the road.</strong> If local businesses ever appear on a 7B page, "sponsored" means they paid
            for the spot — it's not a recommendation.
          </li>
          <li>
            <strong>The spirit of the thing.</strong> 7B exists to make Sandpoint a little more fun and a little more
            connected. Play like your grandma's watching the wall. (She might be.)
          </li>
        </ol>
        <p class="small muted">Questions? {props.contact}.</p>
      </article>
    </Layout>
  );
}
