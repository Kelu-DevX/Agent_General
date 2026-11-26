import { COPY } from "../copy";
import { Layout, Notice } from "./layout";

export function SignupPage(props: {
  error?: string;
  values?: { email?: string; display_name?: string; mailing_consent?: boolean };
  next?: string;
}) {
  const v = props.values ?? {};
  return (
    <Layout title={COPY.auth.signupTitle} nav="me">
      <section class="card form-card">
        <h1 class="script-title">{COPY.auth.signupTitle}</h1>
        <p class="lede">{COPY.auth.signupSub}</p>
        {props.error ? <Notice kind="err">{props.error}</Notice> : null}
        <form method="post" action="/signup" class="form">
          {props.next ? <input type="hidden" name="next" value={props.next} /> : null}
          <label>
            Display name
            <input name="display_name" required minlength={3} maxlength={24} autocomplete="nickname"
              value={v.display_name ?? ""} placeholder="e.g. Huckleberry Hank" />
            <small>Shows on the wall. Letters, numbers, spaces.</small>
          </label>
          <label>
            Email
            <input name="email" type="email" required autocomplete="email" value={v.email ?? ""} />
            <small>Never shown to anyone.</small>
          </label>
          <label>
            Password
            <input name="password" type="password" required minlength={8} autocomplete="new-password" />
          </label>
          <label class="check">
            <input type="checkbox" name="agree" value="1" required />
            <span>
              {COPY.auth.agree} <a href="/terms">Terms</a>
            </span>
          </label>
          <label class="check">
            <input type="checkbox" name="mailing_consent" value="1" checked={v.mailing_consent ?? false} />
            <span>{COPY.auth.consent}</span>
          </label>
          <button type="submit" class="btn btn-red">{COPY.auth.signupTitle}</button>
        </form>
        <p class="small center">
          Already playing? <a href={props.next ? `/login?next=${encodeURIComponent(props.next)}` : "/login"}>Log in</a>
        </p>
      </section>
    </Layout>
  );
}

export function LoginPage(props: { error?: string; email?: string; next?: string }) {
  return (
    <Layout title="Log in" nav="me">
      <section class="card form-card">
        <h1 class="script-title">{COPY.auth.loginTitle}</h1>
        {props.error ? <Notice kind="err">{props.error}</Notice> : null}
        <form method="post" action="/login" class="form">
          {props.next ? <input type="hidden" name="next" value={props.next} /> : null}
          <label>
            Email
            <input name="email" type="email" required autocomplete="email" value={props.email ?? ""} />
          </label>
          <label>
            Password
            <input name="password" type="password" required autocomplete="current-password" />
          </label>
          <button type="submit" class="btn btn-green">Log in</button>
        </form>
        <p class="small center">
          <a href="/forgot">Forgot your password?</a> · New here?{" "}
          <a href={props.next ? `/signup?next=${encodeURIComponent(props.next)}` : "/signup"}>{COPY.home.join}</a>
        </p>
      </section>
    </Layout>
  );
}

export function ForgotPage(props: { contact: string }) {
  return (
    <Layout title={COPY.auth.forgotTitle} nav="me">
      <section class="card form-card">
        <h1 class="script-title">{COPY.auth.forgotTitle}</h1>
        <p class="lede">{COPY.auth.forgotBody(props.contact)}</p>
        <p class="center">
          <a class="btn btn-green" href="/login">Back to log in</a>
        </p>
      </section>
    </Layout>
  );
}
