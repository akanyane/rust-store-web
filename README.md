# Rust Store Web

Frontend da [rust-store-api](https://github.com/akanyane/rust-store-api): loja
de compras **simuladas** (sem dinheiro nem gateway de pagamento reais), em
Deno + Fresh 2 (Preact, Vite, Tailwind 4). As telas seguem o handoff de design
em [`design/`](design/README.md).

A moeda é a **unidade** (`1 unidade`, `25 unidades`): números inteiros, sem
casas decimais.

## Como rodar

Precisa do Deno e da API rodando (por padrão em `http://localhost:3000`).

```bash
# 1) a API, no outro repositório
cd ../rust-store-api && cargo run

# 2) o frontend
API_URL=http://localhost:3000 deno task dev      # desenvolvimento (Vite)
deno task build && deno task start               # produção, em http://localhost:8000
```

| Variável  | Descrição                                        |
| --------- | ------------------------------------------------ |
| `API_URL` | Endereço da API. Padrão `http://localhost:3000`. |

Só o **servidor** do Fresh fala com a API; o navegador nunca vê o endereço dela.
Por isso não há CORS, e (nas próximas fases) os tokens ficarão em cookies
`httpOnly`.

## Verificação

```bash
deno task check        # formatação, lint e tipos
deno test --allow-env  # testes de unidade (lib/)
```

## Estado

**Fase 1: catálogo e página de produto** (leitura pública).

- `/`: catálogo com ordem (`?sort=name|newest`), paginação de 12 em 12
  (`?page=`), total vindo de `X-Total-Count` e "from X unidades" só quando as
  variantes têm preços diferentes (`price_from` / `price_to`). Estados vazio e
  de erro (503 quando a API não responde).
- `/products/:id`: variantes com preço, SKU e rótulo de estoque.
- `404`/`403`/erro: páginas do design.
- Tema claro/escuro: cookie `theme`, ou o do sistema (sem piscar).

Próximas fases: login, cadastro e carrinho; checkout e pedidos; console de
admin.

## Estrutura

```
lib/          lógica pura e testada: api (cliente), format (unidades, estoque), pagination, links, theme
components/   Header, Footer, ProductCard, Pagination, SortToggle, StatePanel, Icon, Placeholder
routes/       _app (layout, tema), _error (404/403/500), index (catálogo), products/[id]
assets/       styles.css (usa as variáveis de static/tokens.css)
static/       tokens.css (tokens do design: claro e escuro)
design/       handoff de design (referência; fora do fmt, lint e check)
```

## Notas

- O Fresh marca sozinho `aria-current` nos links que casam com a URL. Os links
  de ordem e de paginação definem o valor explicitamente (`"true"`, `"page"` ou
  `"false"`); o Fresh respeita o que for definido na mão.
- A API não tem imagens de produto: o card usa um bloco colorido com iniciais, e
  a cor sai de um hash do id (o design usa `id % 5`, mas os ids são textos).
- Ordem de texto: por nome, sem diferenciar maiúsculas; números dentro do texto
  não têm ordem natural (`10 kg` vem antes de `5 kg`).
