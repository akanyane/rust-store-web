import { HttpError, page } from "fresh";
import { Head } from "fresh/runtime";
import { define } from "../../../utils.ts";
import {
  ApiError,
  createVariant,
  deactivateProduct,
  deactivateVariant,
  getAdminProduct,
  updateProduct,
  updateVariant,
} from "../../../lib/api.ts";
import {
  formatCreated,
  validateProductEdit,
  validateVariant,
} from "../../../lib/admin.ts";
import type { Flash } from "../../../lib/flash.ts";
import { field, fieldErrorsFrom } from "../../../lib/form.ts";
import { formatNumber, unitLabel } from "../../../lib/format.ts";
import { adminAuthed, requireAdmin } from "../../../lib/guard.ts";
import type { ProductDetail, Variant } from "../../../lib/types.ts";
import type { FormErrors } from "../../../lib/validation.ts";
import { Alert } from "../../../components/Alert.tsx";
import { ErrorSummary } from "../../../components/ErrorSummary.tsx";
import { Field } from "../../../components/Field.tsx";
import { ProductStatusBadge } from "../../../components/ProductStatusBadge.tsx";
import { Switch } from "../../../components/Switch.tsx";
import PendingButton from "../../../islands/PendingButton.tsx";

const PRODUCT_LABELS = { name: "Name", description: "Description" };
const VARIANT_LABELS = {
  name: "Name",
  sku: "SKU",
  price: "Price",
  stock: "Stock",
};

interface VariantValues {
  name: string;
  sku: string;
  price: string;
  stock: string;
}

interface Data {
  product: ProductDetail;
  /** Qual formulário está aberto: a edição de uma variante, ou a criação de uma nova. */
  editId?: string;
  adding?: boolean;
  /** Valores digitados (para repor o formulário depois de um erro) e os erros de cada um. */
  productValues: { name: string; description: string; active: boolean };
  variantValues?: VariantValues;
  productErrors: FormErrors;
  variantErrors: FormErrors;
  flash?: Flash;
}

const variantValuesOf = (variant: Variant): VariantValues => ({
  name: variant.name,
  sku: variant.sku,
  price: String(variant.price),
  stock: String(variant.stock),
});

export const handler = define.handlers({
  async GET(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;
    const id = ctx.params.id;
    const loaded = await adminAuthed(
      ctx,
      ctx.url.pathname,
      (token) => getAdminProduct(token, id),
    );
    if (!loaded.ok) return loaded.response;
    const product = loaded.value;
    if (!product) throw new HttpError(404);

    const editParam = ctx.url.searchParams.get("edit");
    const editing = editParam
      ? product.variants.find((variant) => variant.id === editParam)
      : undefined;
    return page<Data>({
      product,
      editId: editing?.id,
      adding: ctx.url.searchParams.get("add") === "1",
      productValues: {
        name: product.name,
        description: product.description,
        active: product.active,
      },
      variantValues: editing ? variantValuesOf(editing) : undefined,
      productErrors: {},
      variantErrors: {},
      flash: ctx.state.flash?.scope === "admin" ? ctx.state.flash : undefined,
    });
  },

  async POST(ctx) {
    const id = ctx.params.id;
    const back = `/admin/products/${encodeURIComponent(id)}`;
    const form = await ctx.req.formData();
    const intent = field(form, "intent");
    const variantId = field(form, "variant_id");
    const flash = (message: string) => {
      ctx.state.pendingFlash = { scope: "admin", tone: "success", message };
      return ctx.redirect(back, 303);
    };

    // Recarrega o produto para repor a página com os erros e o formulário aberto.
    const rerender = async (
      status: number,
      extra: Partial<Data>,
    ) => {
      const loaded = await adminAuthed(
        ctx,
        back,
        (token) => getAdminProduct(token, id),
      );
      if (!loaded.ok) return loaded.response;
      if (!loaded.value) throw new HttpError(404);
      const product = loaded.value;
      return page<Data>({
        product,
        productValues: {
          name: product.name,
          description: product.description,
          active: product.active,
        },
        productErrors: {},
        variantErrors: {},
        ...extra,
      }, { status });
    };

    try {
      if (intent === "save-product") {
        const values = {
          name: field(form, "name").trim(),
          description: field(form, "description").trim(),
          active: field(form, "active") === "on",
        };
        let errors = validateProductEdit(values);
        if (Object.keys(errors).length === 0) {
          try {
            const saved = await adminAuthed(
              ctx,
              back,
              (token) => updateProduct(token, id, values),
            );
            if (!saved.ok) return saved.response;
            return flash("Product saved.");
          } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 422) {
              throw error;
            }
            errors = fieldErrorsFrom(error, "name");
          }
        }
        return await rerender(422, {
          productValues: values,
          productErrors: errors,
        });
      }

      if (intent === "toggle-product") {
        const activate = field(form, "active") === "true";
        const done = await adminAuthed(ctx, back, async (token) => {
          if (!activate) return await deactivateProduct(token, id);
          const current = await getAdminProduct(token, id);
          if (!current) throw new HttpError(404);
          await updateProduct(token, id, {
            name: current.name,
            description: current.description,
            active: true,
          });
        });
        if (!done.ok) return done.response;
        return flash(
          activate ? "Product reactivated." : "Product deactivated.",
        );
      }

      if (intent === "add-variant" || intent === "save-variant") {
        const values: VariantValues = {
          name: field(form, "name").trim(),
          sku: field(form, "sku").trim(),
          price: field(form, "price").trim(),
          stock: field(form, "stock").trim(),
        };
        const open = intent === "save-variant"
          ? { editId: variantId }
          : { adding: true };
        let errors = validateVariant(values);
        if (Object.keys(errors).length === 0) {
          const input = {
            ...values,
            price: Number(values.price),
            stock: Number(values.stock),
          };
          try {
            const saved = await adminAuthed(ctx, back, async (token) => {
              if (intent === "add-variant") {
                return await createVariant(token, id, input);
              }
              const current = (await getAdminProduct(token, id))?.variants.find(
                (v) => v.id === variantId,
              );
              if (!current) throw new HttpError(404);
              return await updateVariant(token, id, variantId, {
                ...input,
                active: current.active,
              });
            });
            if (!saved.ok) return saved.response;
            return flash(
              intent === "add-variant" ? "Variant added." : "Variant saved.",
            );
          } catch (error) {
            if (!(error instanceof ApiError)) throw error;
            if (error.status === 409) {
              // SKU repetido: a API diz qual; aparece no próprio campo.
              errors = { sku: error.message };
            } else if (error.status === 422) {
              errors = fieldErrorsFrom(error, "name");
            } else {
              throw error;
            }
          }
        }
        return await rerender(errors.sku ? 409 : 422, {
          ...open,
          variantValues: values,
          variantErrors: errors,
        });
      }

      if (intent === "toggle-variant") {
        const activate = field(form, "active") === "true";
        const done = await adminAuthed(ctx, back, async (token) => {
          if (!activate) return await deactivateVariant(token, id, variantId);
          const current = (await getAdminProduct(token, id))?.variants.find((
            v,
          ) => v.id === variantId);
          if (!current) throw new HttpError(404);
          await updateVariant(token, id, variantId, {
            name: current.name,
            sku: current.sku,
            price: current.price,
            stock: current.stock,
            active: true,
          });
        });
        if (!done.ok) return done.response;
        return flash(
          activate ? "Variant reactivated." : "Variant deactivated.",
        );
      }
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.status === 404) throw new HttpError(404);
      ctx.state.pendingFlash = {
        scope: "admin",
        tone: "error",
        message: `Not changed: ${error.message}`,
      };
      return ctx.redirect(back, 303);
    }
    throw new HttpError(400);
  },
});

function VariantForm(
  { intent, values, errors, variantId, cancelHref, title, submitLabel }: {
    intent: "add-variant" | "save-variant";
    values: VariantValues;
    errors: FormErrors;
    variantId?: string;
    cancelHref: string;
    title: string;
    submitLabel: string;
  },
) {
  return (
    <section
      class="rs-card-box rs-variantform"
      id={intent === "add-variant" ? "add-variant" : "edit-variant"}
      aria-label={title}
    >
      <h3>{title}</h3>
      <ErrorSummary errors={errors} labels={VARIANT_LABELS} />
      <form method="post" class="rs-form" noValidate>
        <input type="hidden" name="intent" value={intent} />
        {variantId && (
          <input type="hidden" name="variant_id" value={variantId} />
        )}
        <div class="rs-form__row rs-form__row--4">
          <Field
            label="Name"
            name="name"
            value={values.name}
            error={errors.name}
          />
          <Field label="SKU" name="sku" value={values.sku} error={errors.sku} />
          <Field
            label="Price"
            name="price"
            value={values.price}
            error={errors.price}
            suffix="unidades"
            inputMode="numeric"
          />
          <Field
            label="Stock"
            name="stock"
            value={values.stock}
            error={errors.stock}
            inputMode="numeric"
          />
        </div>
        <div class="rs-form__actions">
          <a href={cancelHref} class="rs-btn" aria-current="false">Cancel</a>
          <PendingButton
            label={submitLabel}
            pendingLabel="Saving…"
            variant="primary"
          />
        </div>
      </form>
    </section>
  );
}

export default define.page<typeof handler>(function AdminProduct({ data }) {
  const {
    product,
    editId,
    adding,
    productValues,
    productErrors,
    variantErrors,
    flash,
  } = data;
  const here = `/admin/products/${encodeURIComponent(product.id)}`;
  const inactiveVariants = product.variants.filter((variant) =>
    !variant.active
  ).length;
  const emptyValues: VariantValues = {
    name: "",
    sku: "",
    price: "",
    stock: "",
  };
  const editing = editId
    ? product.variants.find((variant) => variant.id === editId)
    : undefined;

  return (
    <>
      <Head>
        <title>{product.name} · Admin · Rust Store</title>
      </Head>
      <a href="/admin/products" class="rs-back" aria-current="false">
        ← Products
      </a>
      <div class="rs-order-head">
        <h1 class="rs-h1">{product.name}</h1>
        <ProductStatusBadge active={product.active} />
        <span class="rs-muted">
          ID <span class="rs-mono-cell">{product.id}</span> · created{" "}
          {formatCreated(product.created_at)}
        </span>
      </div>

      {flash && (
        <Alert
          tone={flash.tone === "success" ? "success" : "danger"}
          title={flash.message}
        />
      )}
      <ErrorSummary errors={productErrors} labels={PRODUCT_LABELS} />

      <form
        method="post"
        class="rs-form rs-form--narrow rs-card-box"
        noValidate
      >
        <input type="hidden" name="intent" value="save-product" />
        <Field
          label="Name"
          name="name"
          value={productValues.name}
          error={productErrors.name}
        />
        <Field
          label="Description"
          name="description"
          value={productValues.description}
          error={productErrors.description}
          rows={2}
        />
        <div class="rs-form__actions rs-form__actions--between">
          <Switch name="active" label="Active" checked={productValues.active} />
          <PendingButton
            label="Save"
            pendingLabel="Saving…"
            variant="primary"
          />
        </div>
      </form>

      <section class="rs-variants-admin" aria-labelledby="variants-title">
        <div class="rs-admin__head">
          <h2 id="variants-title">
            Variants{" "}
            <span class="rs-muted">
              {product.variants.length}
              {inactiveVariants > 0
                ? `, including ${inactiveVariants} inactive`
                : ""}
            </span>
          </h2>
          <a
            href={`${here}?add=1#add-variant`}
            class="rs-btn"
            aria-current="false"
          >
            + Add variant
          </a>
        </div>

        <div class="rs-tablewrap">
          <table class="rs-table">
            <thead>
              <tr>
                <th>Name</th>
                <th class="rs-col-wide">SKU</th>
                <th class="rs-table__right">Price</th>
                <th class="rs-table__right">Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant) => (
                <tr
                  key={variant.id}
                  class={variant.active ? "" : "rs-table__row--off"}
                >
                  <td>{variant.name}</td>
                  <td class="rs-mono-cell rs-col-wide">{variant.sku}</td>
                  <td class="rs-table__right rs-nums">
                    {formatNumber(variant.price)}{" "}
                    <span class="rs-muted-unit">
                      {unitLabel(variant.price)}
                    </span>
                  </td>
                  <td
                    class={`rs-table__right rs-nums ${
                      variant.stock === 0
                        ? "rs-stock-cell--out"
                        : variant.stock <= 5
                        ? "rs-stock-cell--low"
                        : ""
                    }`}
                  >
                    {variant.stock}
                  </td>
                  <td>
                    <ProductStatusBadge active={variant.active} />
                  </td>
                  <td>
                    <div class="rs-table__actions">
                      <a
                        href={`${here}?edit=${
                          encodeURIComponent(variant.id)
                        }#edit-variant`}
                        aria-current="false"
                      >
                        Edit
                      </a>
                      <form method="post" class="rs-inline-form">
                        <input
                          type="hidden"
                          name="intent"
                          value="toggle-variant"
                        />
                        <input
                          type="hidden"
                          name="variant_id"
                          value={variant.id}
                        />
                        <input
                          type="hidden"
                          name="active"
                          value={variant.active ? "false" : "true"}
                        />
                        <button type="submit" class="rs-linkbtn">
                          {variant.active ? "Deactivate" : "Reactivate"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editing && data.variantValues && (
          <VariantForm
            intent="save-variant"
            variantId={editing.id}
            values={data.variantValues}
            errors={variantErrors}
            cancelHref={here}
            title={`Editing "${editing.name}"`}
            submitLabel="Save variant"
          />
        )}
        {adding && (
          <VariantForm
            intent="add-variant"
            values={data.variantValues ?? emptyValues}
            errors={variantErrors}
            cancelHref={here}
            title="New variant"
            submitLabel="Add variant"
          />
        )}
      </section>
    </>
  );
});
