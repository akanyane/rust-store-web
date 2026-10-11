import type {
  AdminOrder,
  AdminStats,
  Cart,
  Customer,
  Order,
  OrderStatus,
  Product,
  ProductDetail,
  ProductListItem,
  Session,
  Tokens,
  Variant,
} from "./types.ts";

export const DEFAULT_API_URL = "http://localhost:3000";
const TIMEOUT_MS = 5000;

/** Endereço da API (`API_URL`). Só o servidor fala com ela: o navegador nunca vê o endereço. */
export function apiUrl(): string {
  return (Deno.env.get("API_URL") ?? DEFAULT_API_URL).replace(/\/+$/, "");
}

/** A API respondeu com erro (`{"error": "..."}`). */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }

  /** Erro de validação (422): um mapa campo -> mensagem. */
  get fields(): Record<string, string> {
    return parseFieldErrors(this.message);
  }
}

/** A API não respondeu (rede, tempo esgotado ou erro 5xx). */
export class ApiUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiUnavailableError";
  }
}

/**
 * Erros 422 vêm como `"campo: mensagem; outro: mensagem"`: separa em `"; "` e depois no
 * primeiro `": "`. Pedaços sem `": "` (mensagens gerais) são ignorados.
 */
export function parseFieldErrors(message: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of message.split("; ")) {
    const at = part.indexOf(": ");
    if (at > 0) fields[part.slice(0, at)] = part.slice(at + 2);
  }
  return fields;
}

async function toError(response: Response): Promise<Error> {
  let message = `Request failed (${response.status})`;
  try {
    const body = await response.json();
    if (typeof body?.error === "string") message = body.error;
  } catch {
    // Corpo vazio ou não JSON: fica a mensagem genérica.
  }
  return response.status >= 500
    ? new ApiUnavailableError(message)
    : new ApiError(response.status, message);
}

interface CallOptions {
  method?: string;
  /** Session token: vai no `Authorization: Bearer`. */
  token?: string;
  body?: unknown;
}

async function call(
  path: string,
  options: CallOptions = {},
): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${apiUrl()}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    throw new ApiUnavailableError("The store API did not respond", { cause });
  }
  if (!response.ok) throw await toError(response);
  return response;
}

async function json<T>(path: string, options: CallOptions = {}): Promise<T> {
  return await (await call(path, options)).json();
}

// ---------- Catálogo (público) ----------

export interface ProductPage {
  products: ProductListItem[];
  /** Total de produtos ativos (`X-Total-Count`), independente da página. */
  total: number;
}

export interface ListProductsParams {
  sort?: "name" | "newest";
  limit?: number;
  offset?: number;
}

export async function listProducts(
  params: ListProductsParams = {},
): Promise<ProductPage> {
  const query = new URLSearchParams();
  if (params.sort) query.set("sort", params.sort);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  const suffix = query.size > 0 ? `?${query}` : "";

  const response = await call(`/products${suffix}`);
  const products: ProductListItem[] = await response.json();
  // Só um inteiro escrito no cabeçalho vale (`Number(null)` e `Number("")` dariam 0).
  const header = response.headers.get("x-total-count");
  const total = header !== null && /^\d+$/.test(header)
    ? Number(header)
    : products.length;
  return { products, total };
}

/** `null` quando o produto não existe ou está inativo (a API responde 404). */
export async function getProduct(id: string): Promise<ProductDetail | null> {
  try {
    return await json<ProductDetail>(`/products/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

// ---------- Conta e sessão ----------

export function signIn(username: string, password: string): Promise<Tokens> {
  return json<Tokens>("/auth/sign-in", {
    method: "POST",
    body: { username, password },
  });
}

export interface SignUpInput {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  birthday: string;
}

export function signUp(input: SignUpInput): Promise<Customer> {
  return json<Customer>("/auth/sign-up", { method: "POST", body: input });
}

/** Troca um refresh token por um par novo. O refresh antigo deixa de valer. */
export function refreshTokens(refreshToken: string): Promise<Tokens> {
  return json<Tokens>("/auth/refresh", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
}

export async function signOut(refreshToken: string): Promise<void> {
  await call("/auth/sign-out", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
}

export function getMe(token: string): Promise<Customer> {
  return json<Customer>("/me", { token });
}

export interface ProfileInput {
  first_name: string;
  last_name: string;
  birthday: string;
}

export function updateMe(
  token: string,
  input: ProfileInput,
): Promise<Customer> {
  return json<Customer>("/me", { method: "PUT", token, body: input });
}

export async function deleteMe(token: string): Promise<void> {
  await call("/me", { method: "DELETE", token });
}

/** Só os ids bastam: a conta usa a contagem para decidir se pode ser excluída. */
export function listOrderIds(token: string): Promise<{ id: string }[]> {
  return json<{ id: string }[]>("/orders", { token });
}

// ---------- Carrinho ----------

export function getCart(token: string): Promise<Cart> {
  return json<Cart>("/cart", { token });
}

export function addToCart(
  token: string,
  variantId: string,
  quantity: number,
): Promise<Cart> {
  return json<Cart>("/cart/items", {
    method: "POST",
    token,
    body: { variant_id: variantId, quantity },
  });
}

export function setCartQuantity(
  token: string,
  variantId: string,
  quantity: number,
): Promise<Cart> {
  return json<Cart>(`/cart/items/${encodeURIComponent(variantId)}`, {
    method: "PUT",
    token,
    body: { quantity },
  });
}

export function removeFromCart(
  token: string,
  variantId: string,
): Promise<Cart> {
  return json<Cart>(`/cart/items/${encodeURIComponent(variantId)}`, {
    method: "DELETE",
    token,
  });
}

// ---------- Pedidos ----------

/** Pedidos do cliente, do mais recente para o mais antigo (a API não pagina). */
export function listOrders(token: string): Promise<Order[]> {
  return json<Order[]>("/orders", { token });
}

/** `null` quando o pedido não existe ou é de outro cliente (a API responde 404 nos dois casos). */
export async function getOrder(
  token: string,
  id: string,
): Promise<Order | null> {
  try {
    return await json<Order>(`/orders/${encodeURIComponent(id)}`, { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Checkout: transforma o carrinho em um pedido `pending` e baixa o estoque. */
export function createOrder(token: string): Promise<Order> {
  return json<Order>("/orders", { method: "POST", token });
}

/** Pagamento simulado: só troca `pending` por `paid`. */
export function payOrder(token: string, id: string): Promise<Order> {
  return json<Order>(`/orders/${encodeURIComponent(id)}/pay`, {
    method: "POST",
    token,
  });
}

/** Cancela um pedido pendente e devolve o estoque. Pedido pago não cancela. */
export function cancelOrder(token: string, id: string): Promise<Order> {
  return json<Order>(`/orders/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    token,
  });
}

// ---------- Sessão ----------

export function getSession(token: string): Promise<Session> {
  return json<Session>("/auth/session", { token });
}

// ---------- Admin: pedidos ----------

function totalOf(response: Response, fallback: number): number {
  const header = response.headers.get("x-total-count");
  return header !== null && /^\d+$/.test(header) ? Number(header) : fallback;
}

export interface AdminOrdersParams {
  status?: OrderStatus;
  limit: number;
  offset: number;
}

export async function listAdminOrders(
  token: string,
  params: AdminOrdersParams,
): Promise<{ orders: AdminOrder[]; total: number }> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.status) query.set("status", params.status);
  const response = await call(`/admin/orders?${query}`, { token });
  const orders: AdminOrder[] = await response.json();
  return { orders, total: totalOf(response, orders.length) };
}

/** `null` quando o pedido não existe (a API responde 404). */
export async function getAdminOrder(
  token: string,
  id: string,
): Promise<AdminOrder | null> {
  try {
    return await json<AdminOrder>(`/admin/orders/${encodeURIComponent(id)}`, {
      token,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Muda o status seguindo o ciclo da API; fora dele, 409. */
export function setOrderStatus(
  token: string,
  id: string,
  status: OrderStatus,
): Promise<AdminOrder> {
  return json<AdminOrder>(`/admin/orders/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    token,
    body: { status },
  });
}

// ---------- Admin: produtos ----------

export interface AdminProductsParams {
  active?: boolean;
  sort?: "name" | "newest";
  limit: number;
  offset: number;
}

export async function listAdminProducts(
  token: string,
  params: AdminProductsParams,
): Promise<{ products: Product[]; total: number }> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.active !== undefined) query.set("active", String(params.active));
  if (params.sort) query.set("sort", params.sort);
  const response = await call(`/admin/products?${query}`, { token });
  const products: Product[] = await response.json();
  return { products, total: totalOf(response, products.length) };
}

/** Quantos produtos casam com o filtro, lido do `X-Total-Count` de uma página de 1 item. */
export async function countAdminProducts(
  token: string,
  active?: boolean,
): Promise<number> {
  const query = new URLSearchParams({ limit: "1" });
  if (active !== undefined) query.set("active", String(active));
  return totalOf(await call(`/admin/products?${query}`, { token }), 0);
}

/** `null` quando o produto não existe. Traz TODAS as variantes, inclusive as inativas. */
export async function getAdminProduct(
  token: string,
  id: string,
): Promise<ProductDetail | null> {
  try {
    return await json<ProductDetail>(
      `/admin/products/${encodeURIComponent(id)}`,
      { token },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export interface NewProductInput {
  name: string;
  description: string;
  price: number;
  stock: number;
}

export function createProduct(
  token: string,
  input: NewProductInput,
): Promise<Product> {
  return json<Product>("/products", { method: "POST", token, body: input });
}

export interface ProductEdit {
  name: string;
  description: string;
  active: boolean;
}

export function updateProduct(
  token: string,
  id: string,
  input: ProductEdit,
): Promise<Product> {
  return json<Product>(`/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    token,
    body: input,
  });
}

/** Exclusão lógica: marca o produto como inativo (pedidos e carrinhos apontam para ele). */
export async function deactivateProduct(
  token: string,
  id: string,
): Promise<void> {
  await call(`/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}

export interface NewVariantInput {
  name: string;
  sku: string;
  price: number;
  stock: number;
}

export function createVariant(
  token: string,
  productId: string,
  input: NewVariantInput,
): Promise<Variant> {
  return json<Variant>(`/products/${encodeURIComponent(productId)}/variants`, {
    method: "POST",
    token,
    body: input,
  });
}

export interface VariantEdit extends NewVariantInput {
  active: boolean;
}

export function updateVariant(
  token: string,
  productId: string,
  variantId: string,
  input: VariantEdit,
): Promise<Variant> {
  return json<Variant>(
    `/products/${encodeURIComponent(productId)}/variants/${
      encodeURIComponent(variantId)
    }`,
    { method: "PUT", token, body: input },
  );
}

export async function deactivateVariant(
  token: string,
  productId: string,
  variantId: string,
): Promise<void> {
  await call(
    `/products/${encodeURIComponent(productId)}/variants/${
      encodeURIComponent(variantId)
    }`,
    { method: "DELETE", token },
  );
}

// ---------- Admin: painel ----------

export function getAdminStats(token: string): Promise<AdminStats> {
  return json<AdminStats>("/admin/stats", { token });
}
