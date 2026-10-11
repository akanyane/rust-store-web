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
  expired: boolean;
  error?: "credentials" | "unavailable";
}

/** Admin sem `next` (o formulário manda "/") vai para a lista de pedidos. */
function adminLanding(next: string): string {
  return next === "/" ? "/admin/orders" : next;
}

export const handler = define.handlers({
  GET(ctx) {
    const next = safeNext(ctx.url.searchParams.get("next"));
    if (ctx.state.role === "admin") {
      return ctx.redirect(adminLanding(next), 302);
    }
    if (ctx.state.customer) return ctx.redirect(next, 302);
    const expired = ctx.url.searchParams.get("expired") === "1" ||
      ctx.state.session.expired;
    return page<Data>({ username: "", next, expired });
  },

  async POST(ctx) {
    const form = await ctx.req.formData();
    const username = field(form, "username").trim();
    const password = field(form, "password");
    const next = safeNext(field(form, "next"));
    try {
      const tokens = await signIn(username, password);
      ctx.state.session.setTokens(tokens);
      // O admin sem destino próprio cai no console, não na vitrine.
      const { role } = await getSession(tokens.session_token);
      return ctx.redirect(role === "admin" ? adminLanding(next) : next, 303);
    } catch (error) {
      // 401 (senha errada ou usuário que não existe) e 422 (formato) mostram o mesmo texto: a
      // API não revela qual dos dois falhou, e a tela também não.
      if (error instanceof ApiError) {
        return page<Data>({
          username,
          next,
          expired: false,
          error: "credentials",
        }, { status: 401 });
      }
      if (error instanceof ApiUnavailableError) {
        return page<Data>({
          username,
          next,
          expired: false,
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
  return (
    <>
      <Head>
        <title>Sign in · Rust Store</title>
      </Head>
      <AuthCard title="Sign in" subtitle="Use your Rust Store username.">
        {data.expired && !data.error && (
          <Alert tone="warning" title="Your session expired, sign in again" />
        )}
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
        <form method="post" class="rs-form">
          <input type="hidden" name="next" value={data.next} />
          <Field
            label="Username"
            name="username"
            value={data.username}
            autocomplete="username"
            required
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
          />
          <button type="submit" class="rs-btn rs-btn--primary rs-btn--block">
            Sign in
          </button>
          <p class="rs-auth__note">
            There's no email or password reset in this store, so keep your
            password somewhere safe.
          </p>
        </form>
        <div class="rs-auth__foot">
          New here?{" "}
          <a href={signUpHref} aria-current="false">Create an account</a>
        </div>
      </AuthCard>
    </>
  );
});
