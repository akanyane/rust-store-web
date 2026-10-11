import type { ProductDetail, ProductListItem } from "./types.ts";

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

async function call(path: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl()}${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    throw new ApiUnavailableError("The store API did not respond", { cause });
  }
  if (!response.ok) throw await toError(response);
  return response;
}

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
    const response = await call(`/products/${encodeURIComponent(id)}`);
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
