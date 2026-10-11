import { HttpError, page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import {
  ApiError,
  ApiUnavailableError,
  deleteMe,
  getMe,
  listOrderIds,
  updateMe,
} from "../lib/api.ts";
import { authed, requireCustomer } from "../lib/guard.ts";
import { field, sentence } from "../lib/form.ts";
import { type FormErrors, validateProfile } from "../lib/validation.ts";
import type { Customer } from "../lib/types.ts";
import { Alert } from "../components/Alert.tsx";
import { ErrorSummary } from "../components/ErrorSummary.tsx";
import { Field } from "../components/Field.tsx";
import { Icon } from "../components/Icon.tsx";
import type { Flash } from "../lib/flash.ts";

const LABELS = {
  first_name: "First name",
  last_name: "Last name",
  birthday: "Birthday",
  confirm: "Confirmation",
};

interface Data {
  customer: Customer;
  /** Quantos pedidos o cliente tem; `null` se não deu para contar. */
  orders: number | null;
  values: { first_name: string; last_name: string; birthday: string };
  errors: FormErrors;
  /** O que o formulário de exclusão mostra: erro de confirmação, ou a recusa da API. */
  deleteError?: string;
  flash?: Flash;
}

/** Cliente e contagem de pedidos para renderizar a página (nas respostas de POST). */
async function loadAccount(ctx: Parameters<typeof authed>[0]) {
  const result = await authed(ctx, "/account", async (token) => {
    const [customer, orders] = await Promise.all([
      getMe(token),
      listOrderIds(token).then((list) => list.length).catch((error) => {
        if (error instanceof ApiError || error instanceof ApiUnavailableError) {
          return null;
        }
        throw error;
      }),
    ]);
    return { customer, orders };
  });
  return result;
}

export const handler = define.handlers({
  async GET(ctx) {
    const denied = requireCustomer(ctx);
    if (denied) return denied;
    const loaded = await loadAccount(ctx);
    if (!loaded.ok) return loaded.response;
    const { customer, orders } = loaded.value;
    return page<Data>({
      customer,
      orders,
      values: {
        first_name: customer.first_name,
        last_name: customer.last_name,
        birthday: customer.birthday,
      },
      errors: {},
      flash: ctx.state.flash?.scope === "account" ? ctx.state.flash : undefined,
    });
  },

  async POST(ctx) {
    const form = await ctx.req.formData();
    const intent = field(form, "intent");

    if (intent === "save") {
      const values = {
        first_name: field(form, "first_name").trim(),
        last_name: field(form, "last_name").trim(),
        birthday: field(form, "birthday").trim(),
      };
      let errors = validateProfile(values);
      if (Object.keys(errors).length === 0) {
        try {
          const saved = await authed(
            ctx,
            "/account",
            (token) => updateMe(token, values),
          );
          if (!saved.ok) return saved.response;
          ctx.state.pendingFlash = {
            scope: "account",
            tone: "success",
            message: "Changes saved",
          };
          return ctx.redirect("/account", 303);
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 422) throw error;
          errors = Object.fromEntries(
            Object.entries(error.fields).map((
              [name, message],
            ) => [name, sentence(message)]),
          );
          if (Object.keys(errors).length === 0) {
            errors = { first_name: sentence(error.message) };
          }
        }
      }
      const loaded = await loadAccount(ctx);
      if (!loaded.ok) return loaded.response;
      return page<Data>({ ...loaded.value, values, errors }, { status: 422 });
    }

    if (intent === "delete") {
      const loaded = await loadAccount(ctx);
      if (!loaded.ok) return loaded.response;
      const { customer } = loaded.value;
      const values = {
        first_name: customer.first_name,
        last_name: customer.last_name,
        birthday: customer.birthday,
      };

      // Confirmação: digitar o username (sem diferenciar maiúsculas, como o login).
      if (field(form, "confirm").trim().toLowerCase() !== customer.username) {
        return page<Data>(
          {
            ...loaded.value,
            values,
            errors: {},
            deleteError: "Type your username exactly to confirm.",
          },
          { status: 422 },
        );
      }
      try {
        const removed = await authed(
          ctx,
          "/account",
          (token) => deleteMe(token),
        );
        if (!removed.ok) return removed.response;
        ctx.state.session.clear();
        return ctx.redirect("/", 303);
      } catch (error) {
        // 409: a conta tem pedidos e a API a mantém, para o histórico ficar completo.
        if (error instanceof ApiError && error.status === 409) {
          return page<Data>(
            {
              ...loaded.value,
              values,
              errors: {},
              deleteError: sentence(error.message),
            },
            { status: 409 },
          );
        }
        throw error;
      }
    }

    throw new HttpError(400);
  },
});

export default define.page<typeof handler>(function Account({ data }) {
  const { customer, orders, values, errors } = data;
  const hasOrders = orders !== null && orders > 0;
  return (
    <main class="rs-main rs-account">
      <Head>
        <title>My account · Rust Store</title>
      </Head>
      <div class="rs-account__head">
        <h1 class="rs-h1">My account</h1>
        <form method="post" action="/signout">
          <button type="submit" class="rs-btn">Sign out</button>
        </form>
      </div>

      {data.flash && (
        <Alert
          tone={data.flash.tone === "success" ? "success" : "danger"}
          title={data.flash.message}
        />
      )}
      <ErrorSummary errors={errors} labels={LABELS} />

      <section class="rs-card-box" aria-labelledby="profile-title">
        <h2 id="profile-title">Profile</h2>
        <form method="post" class="rs-form" noValidate>
          <input type="hidden" name="intent" value="save" />
          <label class="rs-field" for="username">
            <span class="rs-field__label">Username</span>
            <span class="rs-readonly">
              <input
                id="username"
                class="rs-input rs-input--mono"
                value={customer.username}
                readOnly
                aria-describedby="username-hint"
              />
              <Icon name="lock" size={16} />
            </span>
            <span id="username-hint" class="rs-field__hint">
              Can't be changed.
            </span>
          </label>
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
          <div class="rs-form__actions">
            <button type="submit" class="rs-btn rs-btn--primary">
              Save changes
            </button>
            <span class="rs-field__hint">Password can't be changed here.</span>
          </div>
        </form>
      </section>

      <section class="rs-card-box" aria-labelledby="delete-title">
        <h2 id="delete-title">Delete account</h2>
        {hasOrders
          ? (
            <div class="rs-locked" role="note">
              <span class="rs-locked__icon">
                <Icon name="lock" size={18} />
              </span>
              <div>
                <b>This account can't be deleted</b>
                <p>
                  Accounts with orders are kept so order history stays complete.
                  You have {orders} {orders === 1 ? "order" : "orders"}.
                </p>
                <button type="button" class="rs-btn" disabled>
                  Delete account…
                </button>
                <a href="/orders" class="rs-locked__link" aria-current="false">
                  View your orders →
                </a>
              </div>
            </div>
          )
          : orders === null
          ? (
            <p class="rs-muted">
              We couldn't check your orders right now, so deleting is
              unavailable. Try again in a moment.
            </p>
          )
          : (
            <>
              <p class="rs-muted">
                Deleting your account removes your profile and your cart. This
                can't be undone.
              </p>
              <details
                class="rs-confirm"
                open={data.deleteError ? true : undefined}
              >
                <summary class="rs-btn rs-btn--danger-outline">
                  Delete account…
                </summary>
                <form method="post" class="rs-form">
                  <input type="hidden" name="intent" value="delete" />
                  <Field
                    label={`Type your username (${customer.username}) to confirm`}
                    name="confirm"
                    error={data.deleteError}
                    autocomplete="off"
                  />
                  <button type="submit" class="rs-btn rs-btn--danger">
                    Delete my account
                  </button>
                </form>
              </details>
            </>
          )}
        {hasOrders && data.deleteError && (
          <Alert tone="danger" title={data.deleteError} />
        )}
      </section>
    </main>
  );
});
