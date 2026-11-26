import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import { COPY } from "../copy";
import type { User } from "../types";

type Nav = "home" | "postcards" | "standings" | "me" | "admin" | "none";

const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#b8322a"/><rect x="6" y="6" width="52" height="52" rx="6" fill="#f6efe1"/><text x="32" y="44" font-family="Georgia,serif" font-size="30" font-weight="700" text-anchor="middle" fill="#1f4d3a">7B</text></svg>`,
  );

export function Layout(props: {
  title?: string;
  user?: User | null;
  nav?: Nav;
  description?: string;
  siteUrl?: string;
  children?: Child;
}) {
  const { user, nav = "none" } = props;
  const title = props.title ? `${props.title} · 7B` : "7B · Greetings from Sandpoint";
  const desc = props.description ?? COPY.hero.sub;
  const link = (href: string, label: string, key: Nav) => (
    <a href={href} class={nav === key ? "on" : undefined} aria-current={nav === key ? "page" : undefined}>
      {label}
    </a>
  );
  return (
    <>
    {raw("<!DOCTYPE html>")}
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{title}</title>
        <meta name="description" content={desc} />
        <meta name="theme-color" content="#1f4d3a" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        {props.siteUrl ? <meta property="og:url" content={props.siteUrl} /> : null}
        <link rel="icon" href={FAVICON} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,900&family=Caveat:wght@600&family=Work+Sans:wght@400;500;600&display=swap"
        />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <div class="airmail" aria-hidden="true"></div>
        <header class="top">
          <a class="mark" href="/" aria-label="7B home">
            <span class="mark-7b">7B</span>
            <span class="mark-sub">Sandpoint, Idaho</span>
          </a>
          <nav class="nav" aria-label="Main">
            {link("/", "Home", "home")}
            {link("/postcards", "Postcards", "postcards")}
            {link("/standings", "Standings", "standings")}
            {user ? link("/me", "Me", "me") : link("/signup", "Join", "me")}
            {user?.is_admin ? (
              <a href="/admin" class={nav === "admin" ? "on" : undefined}>
                Mail room{user.pending_count ? <span class="badge">{user.pending_count}</span> : null}
              </a>
            ) : null}
          </nav>
        </header>
        <main class="page">{props.children}</main>
        <footer class="foot">
          <p>{COPY.footer}</p>
          <p class="foot-links">
            <a href="/terms">Terms &amp; privacy</a>
            {user ? (
              <form method="post" action="/logout" class="inline">
                <button type="submit" class="linklike">Log out</button>
              </form>
            ) : (
              <a href="/login">Log in</a>
            )}
          </p>
        </footer>
      </body>
    </html>
    </>
  );
}

export function Notice(props: { kind?: "ok" | "err" | "info"; children?: Child }) {
  return (
    <p class={`notice notice-${props.kind ?? "info"}`} role={props.kind === "err" ? "alert" : "status"}>
      {props.children}
    </p>
  );
}
