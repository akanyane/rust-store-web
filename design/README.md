# Handoff: Rust Store — Storefront + Admin Console

## Overview
Rust Store is a small online store for **simulated** purchases (no real money, no payment gateway). This package covers the customer storefront (catalog, product, cart, orders, account) and a separate admin console (orders, products, variants), including empty, loading, error and session-expired states, in light and dark themes, mobile-first.

Target stack: **Deno + Fresh**. Pages are server-rendered by default; small islands only where noted.

## About the Design Files
The files in `designs/` are **design references created in HTML** — mockups showing intended look and behavior, not production code to copy. Recreate them as Fresh routes/components (Preact + TSX) following Fresh conventions. Open any `.dc.html` file in a browser to view it (keep `support.js` and `tokens.css` next to them). `tokens.css` at the root of this folder **is** production-ready: ship it as `static/tokens.css`.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, copy and states. Recreate pixel-accurately. Product imagery is intentionally a typographic color-block placeholder (the API has no images).

## Global product rules
- All UI copy in English.
- Currency is **"unidade" / "unidades"**, whole numbers, thousands separator `,` (`1 unidade`, `25 unidades`, `1,240 unidades`). Never `$`, `€`, `R$`, never decimals.
- Persistent footer notice on every storefront page: `DEMO` tag + "Demo store: payments are simulated". Never render a card/payment form.
- Status is always icon + word; color is never the only signal.
- WCAG AA contrast; visible focus ring everywhere (`box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--focus)`); min hit target 44px on mobile.
- Out of scope (do not build): images, categories, search, reviews, wishlists, coupons, addresses, tracking, payment forms, email, password reset, admin user management, order notes, multi-currency.

## Layout system
- Breakpoints: mobile design at **390px**, desktop at **1280px**. Content container `max-width: 1120px; padding: 0 32px` (desktop), `16px` side padding (mobile). Tablet: use desktop layout with 2–3 grid columns.
- Storefront header: desktop 64px tall, white `--surface`, bottom border `--border`. Logo = 26×26 rust square (radius 7, "R" 700/14px) + "Rust Store" 600/17px. Nav links 36px tall, padding 0 12px, radius 8; active = `--surface-2` bg + 600 weight + `aria-current="page"`. Right: Cart link with count pill (bg `--text`, fg `--bg`), "My account" with initials avatar, or "Sign in" outlined button when signed out. Mobile header 56px: logo, cart icon (44×44) with accent count badge, menu button (44×44).
- Footer: `--surface-2` bg, top border, padding 14px 32px, demo notice left, "Prices in unidades · No real money" right (12px `--text-3`).
- Admin: **dark left rail 232px** (`--admin-bar`) with logo + "ADMIN CONSOLE" mono label, links Orders / Products (active = rgba(255,255,255,.1) bg), bottom: "View storefront ↗", "Sign out". Content padding 28px 32px. Admin mobile: dark top bar 52px + tab row (44px, active has 2px accent underline).

## Screens / Views
IDs match labels in `designs/Rust Store Storefront.dc.html` and `designs/Rust Store Admin.dc.html`.

### Customer
**A · Catalog `/`**
- A1/A2: H1 "Catalog" (34px desktop / 28px mobile, 600, -0.02em) + subline "Small-batch goods, priced in unidades." Sort segmented control "Name" (default) | "Newest" — links `?sort=name|newest`. Grid 4 cols desktop (gap 20), 2 cols mobile (gap 12).
- Product card: border `--border`, radius 14, `--surface`. Placeholder block aspect 4/3 (desktop) / 1/1 (mobile), bg `--ph-N-bg`, fg `--ph-N-fg` with N = `product.id % 5 + 1`, initials (first letters of first two words) 600/44px bottom-left, padding 16. Body padding 14/16/16: name 600/15, description 400/13 `--text-2`, price "from **12** unidades" (prefix "from" only when variants differ; number 600/16 `--text`). Hover: `--shadow-2` + `--border-strong`. Focus: ring.
- Pagination: top border, "Showing **1–12** of **57**" (N = total count), Previous / numbered pages / Next (38px squares, radius 8, current = `--text` bg). Mobile: "Showing 1–12 of 57 · Page 1 of 5" + two 44px buttons.
- A3 loading skeleton (only on slow client navigations), A4 empty "Nothing on the shelves yet", A5 error "We couldn't load the catalog" + "Try again".

**B · Product `/products/:id`**
- Back link "← Catalog". Desktop: 420px placeholder block (aspect 4/3, radius 16, initials 96px) + title 40px, description 17/1.6 `--text-2`, "3 variants · from 12 unidades".
- "Choose a variant" list (one bordered card, rows separated). Row grid: name (600/16) + "SKU …" (mono 12.5 `--text-3`) | price (600/20 + unit 13) | stock label | stepper | "Add to cart".
- Stock labels: `> 5` "In stock" (success, check icon); `1–5` "Only N left" (warning, alert icon); `0` "Out of stock" (`--text-2`, x icon) → stepper and button disabled, button text "Out of stock".
- Stepper: 42px (44 mobile) tall, border `--border-strong`, radius 10; − / value / +; clamps 1…stock; disabled ends shown in `--border-strong`.
- Inline result under the row: 409 → warning message "Couldn't add to cart: insufficient stock. …"; success → "Added to cart. 2 × 50 g tin · View cart →".
- Mobile: variants as stacked cards; stepper + full-width button.

**C · Cart `/cart`**
- Header "Your cart" + "4 lines · 8 items".
- When `can_checkout = false`: warning banner "2 lines need attention before you can place an order" / "We never remove items for you. Lower the quantity or remove the flagged lines."
- Desktop line grid: `minmax(0,1fr) 96px 120px 110px 40px` (Item, Unit price, Quantity, Line total, remove); summary aside 300px.
- Line: 52px placeholder square, name, SKU. Flagged lines get a tinted row (`color-mix(warning-soft 45%, surface)`) and a pill (nowrap) + help text below:
  - `inactive` → "No longer sold" (neutral, x icon), help "Remove it to place your order.", stepper disabled.
  - `insufficient_stock` → "Not enough stock" (warning, alert icon), help "Lower the quantity or remove it.", + disabled.
- Summary: "Available lines (2) 108", "Flagged lines (2) 55", divider, "**Total, all lines** 163 unidades" (26px), note "The total includes flagged lines, so it may drop once you fix them." "Place order" disabled with `aria-describedby` reason "You can place your order once no lines are flagged."
- Mobile: line cards + sticky bottom summary bar.
- C3 loading: button "Placing order…" with spinner; helper "Creates a pending order and reserves stock. You'll pay (simulated) on the next screen."
- C4 empty: "Your cart is empty" + "Browse the catalog". C5: 409 shown in the summary panel "Order not placed: insufficient stock. …" (also used for "empty cart").

**D · Orders `/orders`, `/orders/:id`**
- List (desktop table: Order mono, Created, Status badge, Items, Total; mobile cards). Empty: "No orders yet".
- Status badges (pill 26px, radius 999, soft bg + strong fg + icon): Pending = warning/clock, Paid = info/coin, Shipped = accent/box, Delivered = success/check, Cancelled = neutral/x.
- Detail: "Order #1048" + badge; "Created …" and "Paid …" (or "Not yet"/"Never paid"). Timeline Placed → Paid → Shipped → Delivered (26px dots; done = accent fill + check; current = accent ring + dot, `aria-current="step"`; future = `--border-strong` ring). Horizontal on desktop, vertical on mobile.
- Items snapshot table (name, SKU, unit price, qty, line total) + Total; note "Prices are a snapshot from when the order was placed."
- Pending: aside "Waiting for payment" + primary "Pay 123 unidades (simulated)" + secondary "Cancel order" + info "Cancelling returns the items to stock. Once paid, an order can't be cancelled." Cancel opens a confirmation (bottom sheet on mobile): "Cancel order #1048?" / danger "Cancel order" / "Keep order" (default focus).
- Paid/Shipped/Delivered: no actions; info note "This order can't be cancelled. It has been paid, and this store has no refunds."
- Cancelled: timeline replaced by dashed panel "This order was cancelled — The items went back into stock. Cancelled orders are final…".

**E · Account**
- Sign in (`/signin`): Username, Password, "Sign in", note "There's no email or password reset in this store, so keep your password somewhere safe.", link "Create an account". 401 → danger message "That didn't work. Username or password is incorrect. Usernames aren't case-sensitive."
- Sign up (`/signup`): Username (hint "3–32 characters. Not case-sensitive. Can't be changed later."), Password, First name + Last name (2-col `minmax(0,1fr)`), Birthday, "Create account". 422 → summary "Please fix N fields" with links to each field + inline errors (1.5px `--danger` border, `aria-invalid`).
- Validation: username 3–32, `[A-Za-z0-9._-]`, case-insensitive; password 8–128.
- My account (`/account`): username read-only (mono, lock icon, "Can't be changed"), first/last name, birthday, "Save changes" → "Changes saved" status; "Password can't be changed here." Delete section: outlined danger "Delete account…".
- Delete refused (has orders): neutral panel with lock "This account can't be deleted — Accounts with orders are kept so order history stays complete. You have 5 orders…", button disabled, link "View your orders →". No orders: confirm dialog requiring typing the username.

**F · System**
- Session expired (silent renewal failed): desktop modal over the current page / mobile full page. Title "Your session expired, sign in again", username prefilled, password, "Sign in again", "Not you? Sign in with another account". Return to `?next=`.
- 404 "We can't find that page"; 403 "You don't have access to this".

### Admin
**G · Orders `/admin/orders`**: status segmented filter All/Pending/Paid/Shipped/Delivered/Cancelled (`?status=`; select on mobile). Table columns: Order, Customer (id only, mono), Status, Total (right), Created, Paid ("—" if null), Open. Newest first. "Showing 1–10 of 312" + Previous / "Page 1 of 32" / Next. Empty filter: dashed panel "No shipped orders" + "Show all orders".
**G4 · Order detail**: meta row Customer / Created / Paid / Total; items table; "Change status" panel shows only allowed transitions:
- pending → "Mark as paid" (primary) or "Cancel order" (returns stock)
- paid → "Mark as shipped"; shipped → "Mark as delivered"
- delivered, cancelled → lock icon "Final status. No further changes."
409 shown inside the panel: "Not changed (409): <message>" + "Reload".
**H · Products `/admin/products`**: filter Active / Inactive / All, sort Name / Newest, "+ New product". Columns: Product (name + description), ID, Status (Active success / Inactive neutral pause icon; inactive rows `--surface-2`), Created ("—" when null), Edit + Deactivate/Reactivate. Confirmation dialog: "Deactivate "Oolong Tea"?" explaining it hides from catalog and carts, nothing deleted; "Keep active" (focused) / danger "Deactivate".
**H2 · New product**: Name, Description, Initial price (suffix "unidades", whole ≥ 1), Initial stock (≥ 0), note "A default variant is created with this price and stock." 422 summary + inline errors.
**H3 · Product detail `/admin/products/:id`**: inline form Name, Description, Active switch, Save. Variants table (all, incl. inactive dimmed): Name, SKU, Price, Stock (warning ≤5, danger 0), Status, Edit / Deactivate|Reactivate; "+ Add variant". Inline edit row (accent-soft bg) with SKU uniqueness error on the field: "sku: already used by "50 g tin"".

## Interactions & Behavior
- Sort, filter, pagination = GET links / GET forms (no JS required).
- Every mutation = `<form method="post">` handled in the route handler; islands enhance in place.
- Loading: pressed button shows 14–16px spinner (2px border, right side transparent, `rotate 0.8s linear infinite`) + verb ("Adding…", "Placing order…", "Cancelling…"); `aria-busy="true"`.
- Skeleton: pulse opacity 1 → .5, 1.4s ease-in-out infinite.
- Hover transitions optional, ≤150ms.
- On error, focus moves to the message (role="alert"); never lose form input.

## Fresh routes & islands
| Route | SSR | Island |
|---|---|---|
| `/` | grid, sort, pagination | — (FilterSubmit for mobile sort optional) |
| `/products/:id` | details, variant rows | `QuantityStepper`, `AddToCart` (inline 409/success) |
| `/cart` | lines, flags, total, can_checkout | `CartLineQuantity`, Place order loading/409 |
| `/orders`, `/orders/:id` | list, timeline, items | `OrderActions` (pending only) |
| `/signin`, `/signup`, `/account` | forms, 422/401 parsing, delete refusal | `DeleteConfirm` (optional) |
| `/admin/orders`, `/:id` | table, filter, detail | `FilterSubmit` (mobile), `ChangeStatus` |
| `/admin/products`, `/new`, `/:id` | tables, forms | `ConfirmDialog`, `VariantRowEditor` |
| `_app` | theme attr, footer | `SessionGuard` (session expired dialog) |

## State Management / Data
- Product: `id, name, description, active, created_at|null`; detail adds `variants[]` (`id, product_id, name, sku, price, stock, active`).
- Cart: `items[{variant_id, product_id, name, sku, unit_price, quantity, line_total, available, unavailable_reason: "inactive"|"insufficient_stock"}]`, `total` (sums ALL lines), `can_checkout`. Never auto-remove flagged lines.
- Order: `id, status, total, created_at, paid_at|null, items[]`; admin adds `customer_id`.
- Errors: `{"error": "message"}`. 422 → split on `"; "` then first `": "` → field map. 401 → re-auth; 403 → Not allowed; 404 → Not found; 409 → show message next to triggering action.
- Session 1h with silent renewal; on failure SessionGuard shows F1/F2.
- Theme: `data-theme="light|dark"` on `<html>`, from cookie or `prefers-color-scheme`, set server-side to avoid flash.

## Design Tokens (see `tokens.css`)
Light / Dark:
- `--bg` #FAF8F5 / #151311 · `--surface` #FFFFFF / #1D1A17 · `--surface-2` #F3EFEA / #26221E · `--surface-sunken` #EEE9E2 / #110F0D
- `--border` #E4DDD4 / #36302A · `--border-strong` #C9BFB2 / #52483F
- `--text` #1F1B17 / #F2EDE7 · `--text-2` #5A5148 / #BFB5AA · `--text-3` #736960 / #A0958A
- `--accent` #A4441C / #E58358 · `--accent-hover` #8A3815 / #EE9A74 · `--accent-soft` #F7E6DC / #3A231A · `--accent-soft-text` #7A3112 / #F2B496 · `--on-accent` #FFFFFF / #1A0E08 · `--focus` #A4441C / #F09C76
- `--success` #2C6A39 / #86C994 (soft #E2EFE1 / #1D2E21) · `--warning` #855600 / #E8BC62 (soft #FAEDCF / #33290F) · `--danger` #B42318 / #F4928A (soft #FCE7E4 / #3B1D1A) · `--info` #2B5887 / #95BCE6 (soft #E2EBF5 / #1B2837) · `--neutral` #5A5148 / #BFB5AA (soft #ECE6DF / #2C2723)
- Placeholders `--ph-1..5-bg/fg`: clay, sage, slate, sand, plum (values in tokens.css)
- `--admin-bar` #1F1B17 / #0B0A09 · `--overlay` rgba(31,27,23,.45) / rgba(0,0,0,.6)
- Typography: `--font-sans` "Instrument Sans" (400/500/600/700), `--font-mono` "JetBrains Mono" (SKUs, ids). Scale: 12 / 14 / 16 / 18 / 22 / 28 / 36 / 48 (`--fs-xs`…`--fs-4xl`). Headings 600 with -0.01 to -0.025em tracking; body 1.5–1.6 line-height; numbers `font-variant-numeric: tabular-nums`.
- Spacing (4px base): 4, 8, 12, 16, 24, 32, 48, 64 (`--sp-1`…`--sp-8`).
- Radii: `--r-sm` 6, `--r-md` 10 (buttons, inputs), `--r-lg` 14 (cards), `--r-pill` 999 (badges).
- Shadows: `--shadow-1` (segments), `--shadow-2` (card hover, popover), `--shadow-3` (dialogs).
- Buttons: 40px (desktop) / 44–48px (mobile), padding 0 14–18px, 600/14–15. Primary = accent; Secondary = surface + border-strong; Danger = `--danger`; Ghost = transparent accent text. Disabled = `--surface-2` bg, `--text-3` text, `--border` border, `cursor: not-allowed`.
- Inputs: 42–46px, radius 10, border `--border-strong`; focus border `--focus` + 3px `--accent-soft` ring; error 1.5px `--danger` + message 500/12.5 with alert icon.

## Assets
No images. Icons are simple 16×16 stroke icons (1.8px, round caps): check, x, alert triangle, info, clock, coin, box, trash, lock, cart, chevron, menu. Replace with your icon set (e.g. Lucide: Check, X, TriangleAlert, Info, Clock, CircleMinus, Package, Trash2, Lock, ShoppingCart, ChevronDown, Menu). Fonts from Google Fonts (imported in tokens.css).

## Files
- `tokens.css` — production token stylesheet (light + dark).
- `designs/Rust Store Design System.dc.html` — foundations + all component states.
- `designs/Rust Store Storefront.dc.html` — customer screens A–F.
- `designs/Rust Store Admin.dc.html` — admin screens G–H.
- `designs/Rust Store Handoff.dc.html` — route/island/error map.
- `designs/Store Header.dc.html`, `Store Footer.dc.html`, `Admin Nav.dc.html` — shared chrome.
- `designs/support.js`, `designs/tokens.css` — needed to open the HTML references in a browser.
