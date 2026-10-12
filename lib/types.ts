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

export type Role = "customer" | "admin";

/** Quem está logado (`GET /auth/session`): serve para cliente e para admin. */
export interface Session {
  id: string;
  username: string;
  role: Role;
}

/** Pedido na visão de admin: o de sempre mais o id de quem comprou (nenhum dado pessoal). */
export interface AdminOrder extends Order {
  customer_id: string;
}

/** Variante com pouco estoque, como `GET /admin/stats` a lista. */
export interface LowStockItem {
  product_id: string;
  product_name: string;
  variant_id: string;
  variant_name: string;
  sku: string;
  stock: number;
}

/** Os números do painel de admin (`GET /admin/stats`). Valores em unidades. */
/** Pedidos contados por status (`total` soma todos). */
export interface OrderCounts {
  total: number;
  pending: number;
  paid: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}

export interface AdminStats {
  orders: OrderCounts;
  /** Soma dos totais dos pedidos pagos, enviados e entregues. */
  revenue: number;
  products: { active: number; inactive: number };
  low_stock: LowStockItem[];
}

/**
 * Um cliente na visão de admin (`GET /admin/customers/{id}`): só o username e o que ele fez.
 * A API não devolve nome nem nascimento, e a tela nunca os pede.
 */
/** Um cliente na listagem de admin (`GET /admin/customers`): só o username e a atividade. */
export interface AdminCustomerListItem {
  id: string;
  username: string;
  created_at: string;
  /** Quantos pedidos, de qualquer status. */
  orders: number;
  /** Soma dos totais dos pedidos pagos, enviados e entregues. */
  spent: number;
  /** `null` para quem ainda não comprou. */
  last_order_at: string | null;
}

export interface AdminCustomer {
  id: string;
  username: string;
  /** Quando a conta foi criada. */
  created_at: string;
  orders: OrderCounts;
  /** Soma dos totais dos pedidos pagos, enviados e entregues. */
  spent: number;
  /** `null` para quem ainda não comprou. */
  last_order_at: string | null;
}
