import { page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../../../utils.ts";
import { ApiError, createProduct } from "../../../lib/api.ts";
import { validateNewProduct } from "../../../lib/admin.ts";
import { field, fieldErrorsFrom } from "../../../lib/form.ts";
import { adminAuthed, requireAdmin } from "../../../lib/guard.ts";
import type { FormErrors } from "../../../lib/validation.ts";
import { ErrorSummary } from "../../../components/ErrorSummary.tsx";
import { Field } from "../../../components/Field.tsx";
import { Icon } from "../../../components/Icon.tsx";
import PendingButton from "../../../islands/PendingButton.tsx";

const LABELS = {
  name: "Name",
  description: "Description",
  price: "Initial price",
  stock: "Initial stock",
};

interface Data {
  values: { name: string; description: string; price: string; stock: string };
  errors: FormErrors;
}

export const handler = define.handlers({
  GET(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;
    return page<Data>({
      values: { name: "", description: "", price: "", stock: "" },
      errors: {},
    });
  },

  async POST(ctx) {
    const form = await ctx.req.formData();
    const values = {
      name: field(form, "name").trim(),
      description: field(form, "description").trim(),
      price: field(form, "price").trim(),
      stock: field(form, "stock").trim(),
    };
    let errors = validateNewProduct(values);
    if (Object.keys(errors).length === 0) {
      try {
        const created = await adminAuthed(
          ctx,
          "/admin/products/new",
          (token) =>
            createProduct(token, {
              name: values.name,
              description: values.description,
              price: Number(values.price),
              stock: Number(values.stock),
            }),
        );
        if (!created.ok) return created.response;
        ctx.state.pendingFlash = {
          scope: "admin",
          tone: "success",
          message:
            "Product created. A default variant was created with this price and stock.",
        };
        return ctx.redirect(
          `/admin/products/${encodeURIComponent(created.value.id)}`,
          303,
        );
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 422) throw error;
        errors = fieldErrorsFrom(error, "name");
      }
    }
    return page<Data>({ values, errors }, { status: 422 });
  },
});

export default define.page<typeof handler>(function NewProduct({ data }) {
  const { values, errors } = data;
  return (
    <>
      <Head>
        <title>New product · Admin · Rust Store</title>
      </Head>
      <a href="/admin/products" class="rs-back" aria-current="false">
        ← Products
      </a>
      <h1 class="rs-h1">New product</h1>
      <ErrorSummary errors={errors} labels={LABELS} />
      <form method="post" class="rs-form rs-form--narrow" noValidate>
        <Field
          label="Name"
          name="name"
          value={values.name}
          error={errors.name}
        />
        <Field
          label="Description"
          name="description"
          value={values.description}
          error={errors.description}
          rows={3}
        />
        <div class="rs-form__row">
          <Field
            label="Initial price"
            name="price"
            value={values.price}
            error={errors.price}
            suffix="unidades"
            inputMode="numeric"
          />
          <Field
            label="Initial stock"
            name="stock"
            value={values.stock}
            error={errors.stock}
            inputMode="numeric"
          />
        </div>
        <p class="rs-info-note">
          <Icon name="info" />
          A default variant is created with this price and stock. Add more
          variants on the product page afterwards.
        </p>
        <div class="rs-form__actions">
          <a href="/admin/products" class="rs-btn" aria-current="false">
            Cancel
          </a>
          <PendingButton
            label="Create product"
            pendingLabel="Creating…"
            variant="primary"
          />
        </div>
      </form>
    </>
  );
});
