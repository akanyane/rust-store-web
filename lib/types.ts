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
