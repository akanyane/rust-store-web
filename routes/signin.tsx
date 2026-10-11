import { page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import {
  ApiError,
  ApiUnavailableError,
  getSession,
  signIn,
} from "../lib/api.ts";
import { field } from "../lib/form.ts";
import { safeNext } from "../lib/redirect.ts";
import { Alert } from "../components/Alert.tsx";
import { AuthCard } from "../components/AuthCard.tsx";
import { Field } from "../components/Field.tsx";

interface Data {
  username: string;
  next: string;
  /** A sessão acabou: a tela vira o aviso "Your session expired" (modal no desktop). */
  expired: boolean;
  error?: "credentials" | "unavailable";
}

/** Admin sem `next` (o formulário manda "/") vai para o painel. */
function adminLanding(next: string): string {
  return next === "/" ? "/admin" : next;
}

export const handler = define.handlers({
  GET(ctx) {
    const next = safeNext(ctx.url.searchParams.get("next"));
    if (ctx.state.role === "admin") {
      return ctx.redirect(adminLanding(next), 302);
    }
    if (ctx.state.customer) return ctx.redirect(next, 302);
    // "Not you?" volta ao formulário comum e esquece o username lembrado.
    if (ctx.url.searchParams.get("switch") === "1") {
      ctx.state.forgetUser = true;
      return page<Data>({ username: "", next, expired: false });
    }
    const expired = ctx.url.searchParams.get("expired") === "1" ||
      ctx.state.session.expired;
    return page<Data>({
      username: expired ? (ctx.state.lastUser ?? "") : "",
      next,
      expired,
    });
  },

  async POST(ctx) {
    const form = await ctx.req.formData();
    const username = field(form, "username").trim();
    const password = field(form, "password");
    const next = safeNext(field(form, "next"));
    const expired = field(form, "expired") === "1";
    try {
      const tokens = await signIn(username, password);
      ctx.state.session.setTokens(tokens);
      // O papel e o username (já em minúsculas) vêm da API; o admin sem destino próprio cai no
      // console, não na vitrine.
      const who = await getSession(tokens.session_token);
      ctx.state.rememberUser = who.username;
      return ctx.redirect(
        who.role === "admin" ? adminLanding(next) : next,
        303,
      );
    } catch (error) {
      // 401 (senha errada ou usuário que não existe) e 422 (formato) mostram o mesmo texto: a
      // API não revela qual dos dois falhou, e a tela também não.
      if (error instanceof ApiError) {
        return page<Data>({
          username,
          next,
          expired,
          error: "credentials",
        }, { status: 401 });
      }
      if (error instanceof ApiUnavailableError) {
        return page<Data>({
          username,
          next,
          expired,
          error: "unavailable",
        }, { status: 503 });
      }
      throw error;
    }
  },
});

export default define.page<typeof handler>(function SignIn({ data }) {
  const signUpHref = data.next === "/"
    ? "/signup"
    : `/signup?next=${encodeURIComponent(data.next)}`;
  const otherAccountHref = `/signin?${new URLSearchParams({
    next: data.next,
    switch: "1",
  })}`;

  const alerts = (
    <>
      {data.error === "credentials" && (
        <Alert tone="danger" title="That didn't work." focus>
          Username or password is incorrect. Usernames aren't case-sensitive.
        </Alert>
      )}
      {data.error === "unavailable" && (
        <Alert tone="danger" title="We couldn't reach the store." focus>
          Try again in a moment.
        </Alert>
      )}
    </>
  );

  const form = (
    <form method="post" class="rs-form">
      <input type="hidden" name="next" value={data.next} />
      {data.expired && <input type="hidden" name="expired" value="1" />}
      <Field
        label="Username"
        name="username"
        value={data.username}
        autocomplete="username"
        autofocus={!data.username}
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autocomplete="current-password"
        autofocus={Boolean(data.username) && !data.error}
        required
      />
      <button type="submit" class="rs-btn rs-btn--primary rs-btn--block">
        {data.expired ? "Sign in again" : "Sign in"}
      </button>
    </form>
  );

  if (data.expired) {
    return (
      <>
        <Head>
          <title>Session expired · Rust Store</title>
        </Head>
        <div class="rs-modal rs-modal--session">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-title"
            class="rs-modal__box rs-session"
          >
            <h2 id="session-title">Your session expired, sign in again</h2>
            <p>You'll come back to the page you were on.</p>
            {alerts}
            {form}
            <div class="rs-auth__foot">
              Not you?{" "}
              <a href={otherAccountHref} aria-current="false">
                Sign in with another account
              </a>
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Sign in · Rust Store</title>
      </Head>
      <AuthCard title="Sign in" subtitle="Use your Rust Store username.">
        {alerts}
        {form}
        <p class="rs-auth__note">
          There's no email or password reset in this store, so keep your
          password somewhere safe.
        </p>
        <div class="rs-auth__foot">
          New here?{" "}
          <a href={signUpHref} aria-current="false">Create an account</a>
        </div>
      </AuthCard>
    </>
  );
});
