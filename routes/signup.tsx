import { page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import { ApiError, ApiUnavailableError, signIn, signUp } from "../lib/api.ts";
import { field, sentence } from "../lib/form.ts";
import { safeNext } from "../lib/redirect.ts";
import { type FormErrors, validateSignUp } from "../lib/validation.ts";
import { AuthCard } from "../components/AuthCard.tsx";
import { ErrorSummary } from "../components/ErrorSummary.tsx";
import { Field } from "../components/Field.tsx";
import { Alert } from "../components/Alert.tsx";

const LABELS = {
  username: "Username",
  password: "Password",
  first_name: "First name",
  last_name: "Last name",
  birthday: "Birthday",
};

interface Data {
  /** O que o visitante digitou, menos a senha (ela nunca volta para a página). */
  values: {
    username: string;
    first_name: string;
    last_name: string;
    birthday: string;
  };
  errors: FormErrors;
  next: string;
  unavailable?: boolean;
}

const EMPTY: Data["values"] = {
  username: "",
  first_name: "",
  last_name: "",
  birthday: "",
};

export const handler = define.handlers({
  GET(ctx) {
    const next = safeNext(ctx.url.searchParams.get("next"));
    if (ctx.state.customer) return ctx.redirect(next, 302);
    return page<Data>({ values: EMPTY, errors: {}, next });
  },

  async POST(ctx) {
    const form = await ctx.req.formData();
    const values = {
      username: field(form, "username").trim(),
      first_name: field(form, "first_name").trim(),
      last_name: field(form, "last_name").trim(),
      birthday: field(form, "birthday").trim(),
    };
    const password = field(form, "password");
    const next = safeNext(field(form, "next"));

    const errors = validateSignUp({ ...values, password });
    if (Object.keys(errors).length > 0) {
      return page<Data>({ values, errors, next }, { status: 422 });
    }

    try {
      await signUp({ ...values, password });
      // O cadastro não devolve tokens: entra logo em seguida, com as mesmas credenciais.
      ctx.state.session.setTokens(await signIn(values.username, password));
      return ctx.redirect(next, 303);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        return page<Data>(
          {
            values,
            errors: { username: "That username is taken. Pick another one." },
            next,
          },
          { status: 409 },
        );
      }
      if (error instanceof ApiError && error.status === 422) {
        const fields = Object.fromEntries(
          Object.entries(error.fields).map((
            [name, message],
          ) => [name, sentence(message)]),
        );
        // 422 sem campo (corpo ilegível): não há onde apontar, então vira um aviso geral.
        const known = Object.keys(fields).length > 0
          ? fields
          : { username: sentence(error.message) };
        return page<Data>({ values, errors: known, next }, { status: 422 });
      }
      if (error instanceof ApiUnavailableError) {
        return page<Data>({ values, errors: {}, next, unavailable: true }, {
          status: 503,
        });
      }
      throw error;
    }
  },
});

export default define.page<typeof handler>(function SignUp({ data }) {
  const { values, errors } = data;
  const signInHref = data.next === "/"
    ? "/signin"
    : `/signin?next=${encodeURIComponent(data.next)}`;
  return (
    <>
      <Head>
        <title>Create an account · Rust Store</title>
      </Head>
      <AuthCard title="Create an account">
        {data.unavailable && (
          <Alert tone="danger" title="We couldn't reach the store." focus>
            Your details weren't saved. Try again in a moment.
          </Alert>
        )}
        <ErrorSummary errors={errors} labels={LABELS} />
        <form method="post" class="rs-form" noValidate>
          <input type="hidden" name="next" value={data.next} />
          <Field
            label="Username"
            name="username"
            value={values.username}
            error={errors.username}
            autocomplete="username"
            hint="3–32 characters. Not case-sensitive. Can't be changed later."
          />
          <Field
            label="Password"
            name="password"
            type="password"
            error={errors.password}
            autocomplete="new-password"
            hint="8–128 characters."
          />
          <div class="rs-form__row">
            <Field
              label="First name"
              name="first_name"
              value={values.first_name}
              error={errors.first_name}
              autocomplete="given-name"
            />
            <Field
              label="Last name"
              name="last_name"
              value={values.last_name}
              error={errors.last_name}
              autocomplete="family-name"
            />
          </div>
          <Field
            label="Birthday"
            name="birthday"
            value={values.birthday}
            error={errors.birthday}
            placeholder="YYYY-MM-DD"
            inputMode="numeric"
            autocomplete="bday"
          />
          <button type="submit" class="rs-btn rs-btn--primary rs-btn--block">
            Create account
          </button>
        </form>
        <div class="rs-auth__foot">
          Have an account? <a href={signInHref} aria-current="false">Sign in</a>
        </div>
      </AuthCard>
    </>
  );
});
