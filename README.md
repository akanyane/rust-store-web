# Rust Store Web

[![Deno](https://img.shields.io/badge/Deno-2.x-black?logo=deno)](https://deno.com)
[![Fresh](https://img.shields.io/badge/Fresh-2-yellow)](https://fresh.deno.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Release](https://img.shields.io/github/v/release/akanyane/rust-store-web?include_prereleases&sort=semver)](https://github.com/akanyane/rust-store-web/releases)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-green)](LICENSE)

The storefront and admin console for
[rust-store-api](https://github.com/akanyane/rust-store-api): a store for
**simulated** purchases (no real money, no payment gateway), built with Deno and
Fresh 2 (Preact, Vite, Tailwind 4). The screens follow the design handoff in
[`design/`](design/README.md).

The currency is the **unit** (`1 unit`, `25 units`): whole numbers, no decimals.

## Highlights

- **Works without JavaScript.** Every action is a plain form that posts and
  redirects (POST-redirect-GET). Only two tiny islands exist: a quantity stepper
  and a button that shows "Placing order…" and ignores repeated clicks.
- **The browser never sees the API.** Only the Fresh server talks to it, so
  there is no CORS, and the tokens live in `httpOnly` cookies that JavaScript
  cannot read.
- **Sessions renew themselves.** An expired session is refreshed with the
  single-use refresh token, and simultaneous renewals are shared so nobody is
  signed out by accident.
- **Light and dark themes** with no flash on load, from a cookie or the system.
- **An admin console** for orders and products, on the same stack, with no extra
  client code.

## Quick start

You need [Deno](https://deno.com) and the API running (by default at
`http://localhost:3000`).

```bash
# 1) the API, in the other repository (set ADMIN_USERNAME and ADMIN_PASSWORD in
#    its .env to get an admin account)
cd ../rust-store-api && cargo run

# 2) this frontend
deno task dev                                    # development (Vite)
deno task build && deno task start               # production, at http://localhost:8000
```

| Variable  | Description                                          |
| --------- | ---------------------------------------------------- |
| `API_URL` | Address of the API. Default `http://localhost:3000`. |

Sign up in the storefront to shop. To open the admin console, sign in with the
admin account created by the API: you land on `/admin/orders`.

## Checks

```bash
deno task check        # formatting, lint and types
deno test --allow-env  # unit tests (lib/)
```

## What is in it

### Storefront

| Route           | What it does                                                                                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`             | Catalog with sort (`?sort=name\|newest`), pages of 12 (`?page=`), the total from `X-Total-Count`, and "from X units" only when a product's variants have different prices. Empty and error states (503 when the API is down). |
| `/products/:id` | Variants with price, SKU and stock label, and "Add to cart" per variant with the result on the row itself.                                                                                                                    |

### Account and cart

| Route                                 | What it does                                                                                                                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/signin`, `/signup`, `POST /signout` | Sign in, sign up (you are signed in right away) and sign out. Per-field errors with a "Please fix N fields" summary. `?next=` only accepts paths of this same site.                                                                                                 |
| `/account`                            | Edit name and birthday (the username does not change) and delete the account. The API keeps accounts that have orders, and the screen shows the refusal.                                                                                                            |
| `/cart`                               | Rows with quantity (−, +) and remove, flagged rows ("No longer sold", "Not enough stock"), an "N lines need attention" banner, and a summary with the total of every row. A row reads "Product · Variant", or just the product when the variant is the default one. |

The header shows the cart with its item count (the sum of quantities), an
"Orders" link, and the account, or "Sign in".

### Checkout and orders

| Route                                            | What it does                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /orders` (the cart's "Place order" button) | Turns the cart into a pending order and opens it. The button is enabled only when the API says `can_checkout`; if the API refuses (409: stock ran out, an item left sale, empty cart) its message shows in the cart as "Order not placed: …". On phones the summary becomes a fixed bar at the bottom.                                                                                        |
| `/orders`                                        | Order number, date, status, "N items" and total, or "No orders yet".                                                                                                                                                                                                                                                                                                                          |
| `/orders/:id`                                    | Status, "Created" and "Paid" dates, a Placed → Paid → Shipped → Delivered timeline, items with the purchase price, and the total. Pending: "Pay N units (simulated)" and "Cancel order" (confirmed at `?confirm=cancel`). Paid, shipped and delivered: no actions, with a note that there are no refunds. Cancelled: a panel instead of the timeline. Someone else's or a missing order: 404. |

### Admin console

Only for the admin account. The middleware asks the API for the role
(`GET /auth/session`): anonymous visitors go to `/signin?next=…`, regular
customers get a 403, and an API outage gives a 503. The console replaces the
storefront chrome (no cart, no "Orders").

| Route                 | What it does                                                                                                                                                                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/orders`       | Filter by status (`?status=`), pages of 10 with the total from `X-Total-Count`, and a per-filter empty state.                                                                                                                                                                                             |
| `/admin/orders/:id`   | Customer, dates, items, total, and the next steps of the cycle: pending → "Mark as paid" or "Cancel order" (returns the stock); paid → "Mark as shipped"; shipped → "Mark as delivered". Delivered and cancelled are final. A forged `status` that is not one of the offered steps never reaches the API. |
| `/admin/products`     | Filter Active / Inactive / All, sort (`name` / `newest`), pages, total stock per product, and Deactivate / Reactivate with confirmation at `?confirm=`.                                                                                                                                                   |
| `/admin/products/new` | Name, description, price and stock (creates the "Default" variant).                                                                                                                                                                                                                                       |
| `/admin/products/:id` | Edit name, description and `active`; the variants (all of them, inactive too) with add, edit (`?edit=<id>`) and activate / deactivate. A repeated SKU (409) is shown on the SKU field.                                                                                                                    |

## Display decisions

- The order number is the first 8 characters of the id, uppercased
  (`#9FST3BCC`), because the API's ids are random strings.
- Dates are shown in **UTC**, because the server does not know the browser's
  time zone.
- The API only stores the order date and the payment date, so Shipped and
  Delivered have no date (the current step says "Up next").
- Product images do not exist in the API: the card uses a colored block with
  initials, and the color comes from a hash of the id (the design uses `id % 5`,
  but the ids are strings).
- Text is ordered by name, ignoring case; numbers inside text have no natural
  order (`10 kg` comes before `5 kg`).

## Sessions and security

- Tokens live in `httpOnly` cookies (`rs_session`, 1 h; `rs_refresh`, 15 days),
  `SameSite=Lax`, and `Secure` over HTTPS. Browser JavaScript never reads them.
- **Automatic renewal:** when the session has ended, the server renews it with
  the refresh token and stores the new pair. The API's refresh token is
  single-use, so simultaneous renewals (or right after, while the browser still
  sends the old cookie) are shared for 30 s and nobody is signed out for
  nothing. Limit: this holds per server instance; several instances would need a
  shared cache.
- If the renewal fails (the API refuses), the cookies are cleared and the person
  goes to `/signin?next=…&expired=1`. If the API is down, the session is kept.
- **CSRF:** actions are `POST`s and the cookies are `SameSite=Lax`, which are
  not sent on a cross-site `POST`. Signing out only works by `POST` (a link
  cannot sign anyone out).
- Pages for signed-in users go out with `Cache-Control: private, no-store`.
- One-time messages ("Added to cart", "Changes saved") travel in a 60 s
  `rs_flash` cookie, read and deleted on the next page.

## Project layout

```
lib/          tested logic: api (client), session (renewal), cookies, flash, redirect, validation, cart, orders, admin, guard, format, pagination, links, theme
components/   Header, Footer, ProductCard, Pagination, SortToggle, StatePanel, Icon, Placeholder, Field, Alert, ErrorSummary, AuthCard, CartLine, CartSummary, AdminNav, FilterGroup, Switch, ProductStatusBadge
islands/      QuantityStepper, PendingButton
routes/       _app (layout, theme), _middleware (session), _error (404/403/503/500), storefront, account, cart, orders, admin/ (orders, products)
assets/       styles.css (uses the variables from static/tokens.css)
static/       tokens.css (the design tokens: light and dark)
design/       design handoff (reference; excluded from fmt, lint and check)
```

## Notes and limitations

- Fresh marks `aria-current` on links that match the URL by itself. The sort and
  pagination links set the value explicitly (`"true"`, `"page"` or `"false"`),
  and Fresh respects what is set by hand.
- The confirmation dialogs are CSS-only: they work without JavaScript but do not
  trap keyboard focus the way a `<dialog>` would.
- The admin forms require a price greater than zero, which is stricter than the
  API.

## Contributing and releases

Commits follow [Conventional Commits](https://www.conventionalcommits.org)
(`feat:`, `fix:`, `docs:`, and `!` or a `BREAKING CHANGE:` footer for breaking
changes). [Release Please](https://github.com/googleapis/release-please-action)
reads them on every push to `main`, keeps a release pull request open with the
next version and the `CHANGELOG.md`, and tags and publishes the release when
that pull request is merged.

## License

[The Unlicense](LICENSE): public domain, do whatever you want with it.
