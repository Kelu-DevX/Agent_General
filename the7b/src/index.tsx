import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { COPY, contactLine } from "./copy";
import { COOKIE, getSessionUser } from "./lib/auth";
import { activeHappenings, pendingCount, wallPage } from "./lib/queries";
import { getWeather } from "./lib/weather";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { gameRoutes } from "./routes/game";
import { pubRoutes } from "./routes/pub";
import type { AppEnv } from "./types";
import { HomePage } from "./views/home";
import { Layout, Notice } from "./views/layout";
import { TermsPage } from "./views/terms";

const app = new Hono<AppEnv>();

const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "script-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join("; ");

app.use("*", async (c, next) => {
  await next();
  c.header("Content-Security-Policy", CSP);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "same-origin");
  c.header("X-Frame-Options", "DENY");
});

// Belt and braces on top of SameSite=Lax cookies: refuse form posts from other sites.
app.use("*", async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    const origin = c.req.header("origin");
    let foreign = false;
    if (origin && origin !== "null") {
      try {
        foreign = new URL(origin).host !== new URL(c.req.url).host;
      } catch {
        foreign = true;
      }
    }
    if (foreign) {
      return c.html(
        <Layout title="Hold on">
          <Notice kind="err">{COPY.errors.crossSite}</Notice>
        </Layout>,
        403,
      );
    }
  }
  await next();
});

app.use("*", async (c, next) => {
  const user = await getSessionUser(c.env.DB, getCookie(c, COOKIE));
  if (user?.is_admin) user.pending_count = await pendingCount(c.env.DB);
  c.set("user", user);
  await next();
});

app.get("/", async (c) => {
  const [weather, happenings, recent] = await Promise.all([
    getWeather(),
    activeHappenings(c.env.DB),
    wallPage(c.env.DB, 1, 6),
  ]);
  return c.html(
    <HomePage user={c.get("user")} weather={weather} happenings={happenings} recent={recent.cards}
      siteUrl={c.env.SITE_URL} />,
  );
});

app.get("/terms", (c) => c.html(<TermsPage user={c.get("user")} contact={contactLine(c.env.CONTACT_EMAIL)} />));

app.route("/", authRoutes);
app.route("/", gameRoutes);
app.route("/", pubRoutes);
app.route("/", adminRoutes);

app.notFound((c) =>
  c.html(
    <Layout title="Not found" user={c.get("user")}>
      <section class="card">
        <Notice kind="info">{COPY.errors.notFound}</Notice>
        <p class="center">
          <a class="btn btn-green" href="/">Back home</a>
        </p>
      </section>
    </Layout>,
    404,
  ),
);

app.onError((err, c) => {
  console.error(err);
  return c.html(
    <Layout title="Oops">
      <section class="card">
        <Notice kind="err">Something slipped on the ice. Try that again in a moment.</Notice>
      </section>
    </Layout>,
    500,
  );
});

export default app;
