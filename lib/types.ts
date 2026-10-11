// Formas das respostas da API (ver README da rust-store-api). Preços em unidades inteiras.

export interface Product {
  id: string;
  name: string;
  description: string;
  active: boolean;
  /** `null` em produtos criados antes de o campo existir. */
  created_at: string | null;
}

/** Item de `GET /products`: o produto mais a faixa de preço das variantes ativas. */
export interface ProductListItem extends Product {
  /** `null` quando o produto não tem nenhuma variante ativa. */
  price_from: number | null;
  price_to: number | null;
}

export interface Variant {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  active: boolean;
}

export interface ProductDetail extends Product {
  variants: Variant[];
}

/** Par de tokens devolvido por `sign-in` e `refresh` (o `token_type` é sempre "Bearer"). */
export interface Tokens {
  session_token: string;
  refresh_token: string;
}

export interface Customer {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  /** `YYYY-MM-DD`. */
  birthday: string;
}

export type UnavailableReason = "inactive" | "insufficient_stock";

export interface CartItem {
  variant_id: string;
  product_id: string;
  /** Nome do produto (o `name` abaixo é o da variante). */
  product_name: string;
  name: string;
  sku: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  available: boolean;
  unavailable_reason: UnavailableReason | null;
}

export interface Cart {
  items: CartItem[];
  /** Soma TODAS as linhas, disponíveis ou não. */
  total: number;
  can_checkout: boolean;
}

export type OrderStatus =
  | "pending"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  variant_id: string;
  /** Nome da variante na hora da compra. */
  name: string;
  /** Nome do produto na hora da compra; `null` em pedidos antigos, que não o guardaram. */
  product_name: string | null;
  sku: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface Order {
  id: string;
  status: OrderStatus;
  total: number;
  /** ISO 8601, em UTC. */
  created_at: string;
  /** Quando virou "paid"; `null` até o pagamento (e em pedidos pagos antes do campo existir). */
  paid_at: string | null;
  items: OrderItem[];
}
