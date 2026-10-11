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

**Fase 1: catálogo e página de produto** (leitura pública), **fase 2: login,
cadastro, conta e carrinho**, **fase 3: checkout e pedidos** e **fase 4: console
de admin**.

- `/`: catálogo com ordem (`?sort=name|newest`), paginação de 12 em 12
  (`?page=`), total vindo de `X-Total-Count` e "from X unidades" só quando as
  variantes têm preços diferentes (`price_from` / `price_to`). Estados vazio e
  de erro (503 quando a API não responde).
- `/products/:id`: variantes com preço, SKU e rótulo de estoque.
- `404`/`403`/erro: páginas do design.
- Tema claro/escuro: cookie `theme`, ou o do sistema (sem piscar).

**Fase 2:**

- `/signin`, `/signup`, `POST /signout`: entrar, cadastrar (entra logo em
  seguida) e sair. Erros de formulário por campo, com o resumo "Please fix N
  fields". O `?next=` só aceita caminhos do próprio site.
- `/account`: editar nome e nascimento (o username não muda) e excluir a conta.
  A API mantém contas com pedidos, e a tela mostra a recusa.
- `/cart`: linhas com quantidade (−, +) e remover, linhas sinalizadas ("No
  longer sold", "Not enough stock"), a faixa "N lines need attention" e o resumo
  com o total de todas as linhas. Ainda sem o botão de finalizar a compra (fase
  3). O nome da linha é "Produto · Variante" (`product_name` da API), e só o
  produto quando a variante é a padrão ("Default"); as iniciais do bloco
  colorido saem do produto.
- `/products/:id`: "Add to cart" por variante, com o resultado na própria linha.
- Cabeçalho: o carrinho com a contagem (soma das quantidades) e a conta, ou
  "Sign in".

**Fase 3:**

- **Checkout** (`POST /orders`, pelo botão "Place order" do carrinho): o
  carrinho vira um pedido pendente e a pessoa vai para a página dele. O botão só
  fica habilitado com `can_checkout`; se a API recusar (409: estoque que acabou,
  item que saiu de venda, carrinho vazio), a mensagem da API aparece no carrinho
  como "Order not placed: …". No celular o resumo vira uma barra fixa embaixo.
- `/orders`: lista com número, data, status, "N items" e total, ou "No orders
  yet".
- `/orders/:id`: status, "Created" e "Paid", linha do tempo Placed → Paid →
  Shipped → Delivered, itens ("Produto · Variante", SKU, preço da compra) e o
  total. Pendente: "Pay N unidades (simulated)" e "Cancel order" (com
  confirmação em `?confirm=cancel`). Pago, enviado e entregue: sem ações, com a
  nota de que não há reembolso. Cancelado: painel no lugar da linha do tempo.
  Pedido de outro cliente ou inexistente: 404.
- Cabeçalho: link "Orders" (no celular, um ícone de caixa).
- A única ilha nova é o `PendingButton`: mostra "Placing order…", "Paying…" ou
  "Cancelling…" e ignora cliques repetidos. Sem JavaScript, os formulários
  funcionam do mesmo jeito.

**Decisões de exibição:** o número do pedido são os 8 primeiros caracteres do id
em maiúsculas (`#9FST3BCC`), porque os ids da API são textos aleatórios; as
datas saem em **UTC**, porque o servidor não sabe o fuso do navegador; a API só
guarda a data do pedido e a do pagamento, então Shipped e Delivered não têm data
(o passo da vez diz "Up next"); e a confirmação de cancelamento é um modal só de
CSS, que funciona sem JavaScript mas não prende o foco do teclado como um
`<dialog>` faria.

**Fase 4: console de admin** (só para a conta admin; a API cria o admin com
`ADMIN_USERNAME` e `ADMIN_PASSWORD`).

- **Acesso:** o middleware pergunta o papel à API (`GET /auth/session`). Sem
  login, `/admin/*` vai para `/signin?next=…`; cliente comum recebe 403; com a
  API fora do ar, 503. O admin que entra sem destino cai em `/admin/orders`, e o
  console não mostra a vitrine (sem carrinho, sem "Orders").
- `/admin/orders`: filtro por status (`?status=`), paginação de 10 em 10 com o
  total de `X-Total-Count`, e estado vazio por filtro.
- `/admin/orders/:id`: cliente, datas, itens, total e os próximos passos do
  ciclo: pendente → "Mark as paid" ou "Cancel order" (devolve o estoque); pago →
  "Mark as shipped"; enviado → "Mark as delivered". Entregue e cancelado são
  finais ("Final status. No further changes."). Um `status` forjado no `POST`
  que não seja um dos passos oferecidos nem chega à API.
- `/admin/products`: filtro Active/Inactive/All, ordem (`name`/`newest`),
  paginação, estoque total por produto, "Deactivate"/"Reactivate" com
  confirmação em `?confirm=`.
- `/admin/products/new`: nome, descrição, preço e estoque (cria a variante
  "Default").
- `/admin/products/:id`: editar nome, descrição e `active`; variantes (todas,
  inclusive as inativas) com adicionar, editar (`?edit=<id>`) e
  ativar/desativar. SKU repetido (409) aparece no campo SKU.
- Tudo é formulário com redirecionamento (POST → GET), então funciona sem
  JavaScript; não há ilhas novas.

Limites conhecidos: o modal de confirmação não prende o foco do teclado; a tela
exige preço maior que zero, mais estrito que a API; o layout do console foi
conferido pelo HTML e pelas respostas do servidor, não num navegador.

## Sessão e segurança

- Os tokens ficam em cookies `httpOnly` (`rs_session`, 1 h; `rs_refresh`, 15
  dias), `SameSite=Lax`, e `Secure` em HTTPS. O JavaScript do navegador nunca os
  lê.
- **Renovação automática:** se a sessão acabou, o servidor renova pelo refresh e
  grava o par novo. O refresh token da API vale uma vez só; por isso as
  renovações simultâneas (ou logo em seguida, enquanto o navegador ainda manda o
  cookie antigo) são compartilhadas por 30 s, e ninguém é deslogado à toa.
  Limite: isso vale por instância do servidor; com várias instâncias seria
  preciso um cache compartilhado.
- Falhou a renovação (a API recusou): os cookies são apagados e a pessoa vai
  para `/signin?next=…&expired=1`. Se a API estiver fora do ar, a sessão não é
  apagada.
- **CSRF:** as ações são `POST` e os cookies são `SameSite=Lax`, que não vão em
  `POST` vindo de outro site. Sair só funciona por `POST` (um link não desloga
  ninguém).
- Páginas de quem está logado saem com `Cache-Control: private, no-store`.
- As mensagens de uma vez ("Added to cart", "Changes saved") viajam num cookie
  `rs_flash` de 60 s, lido e apagado na página seguinte. Tudo funciona sem
  JavaScript; a única ilha é o seletor de quantidade da página de produto.

## Estrutura

```
lib/          lógica pura e testada: api (cliente), session (renovação), cookies, flash, redirect, validation, cart, orders, admin, guard, format, pagination, links, theme
components/   Header, Footer, ProductCard, Pagination, SortToggle, StatePanel, Icon, Placeholder, Field, Alert, ErrorSummary, AuthCard, CartLine, CartSummary, AdminNav, FilterGroup, Switch, ProductStatusBadge
islands/      QuantityStepper, PendingButton
routes/       _app (layout, tema), _middleware (sessão), _error (404/403/503/500), index, products/[id], signin, signup, signout, account, cart, cart/items/[variantId], orders, orders/[id] (pay, cancel), admin/ (orders, products)
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
