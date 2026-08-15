# TableFlow — What It Is & How It Works

TableFlow is a QR-ordering and staff-operations platform for a single
restaurant/venue. Guests scan a QR code at their table, browse the menu, and
order — no app download, no phone number, no account. Staff run the entire
floor (tables, orders, payments, waiter assignment) from a live dashboard, and
managers/admins get menu management, analytics, a lightweight CRM, and
WhatsApp marketing on top.

It's a single-tenant app: one deployment = one venue, with one shared
Supabase project as the backend.

## Who uses it

| Role | Access |
|---|---|
| **Guest** | Anonymous — no login. Scans a QR, orders, tracks status, sees their own order history. |
| **Waiter** | Signs in at `/staff/login`. Sees only *their own* assigned tables/orders. Toggles on/off duty. |
| **Manager** | Everything a waiter can do, plus tables/QR setup, menu, staff, orders history, customers, analytics, marketing. |
| **Admin** | Same as manager, plus venue settings and the ability to remove staff. |

## The guest ordering flow

1. Each physical table has a QR sticker encoding a unique `qr_identifier`
   (`/q/[qr_identifier]`).
2. A manager/admin binds that sticker to a real table number/section once
   (`/staff/assign-table`), auto- or manually-assigning a waiter.
3. A guest scanning the same sticker afterwards lands on `/menu/[qr_identifier]`
   — the actual ordering menu.
4. On first visit they're silently signed in as a Supabase **anonymous** user
   and asked only for a first name (no phone/OTP) — identity is cached in
   `localStorage` so it survives refreshes on the same device.
5. They browse categories/items (grouped into tabs), add to a persisted cart,
   and submit an order.
6. Submitting an order flips the table from `vacant` to `dining` and, if the
   table has no waiter yet, auto-assigns one right then (see below).
7. Guests track live order status (pending → preparing → served → completed)
   and can request the bill, all without leaving the page. They can also see
   their own past orders on that device.

## The staff floor ("Live Floor" dashboard)

- A live grid of tables color-coded by status: **vacant / dining / awaiting
  bill / paid**, updating in real time (Supabase Realtime) as guests order or
  staff act.
- Waiters only see tables assigned to them; managers/admins see everything.
- Tapping a table opens its detail: current orders, line items, customer
  name, payment status, and buttons to advance an order's status or mark it
  paid (cash/card) — payment is tracked independently of order completion, so
  marking a bill paid doesn't force-close the order until staff explicitly
  complete it.
- Managers/admins get an extra control there to manually reassign a table's
  waiter at any time.

## Waiter on/off duty & table assignment

- Every waiter has an **on/off duty** toggle, always visible in the header
  (not just on the dashboard).
- Only *checked-in* (on-duty) waiters are eligible for auto-assignment.
- When a table needs a waiter (first bound via QR, or its first order comes
  in with no waiter yet), the system picks whichever on-duty waiter currently
  has the **fewest active tables** (`dining`/`awaiting_bill`), tie-broken
  alphabetically — simple load balancing, no fixed rotation queue.
- With only one waiter on duty, everything goes to them. With nobody on duty,
  new tables/orders stay unassigned until a manager assigns one manually.
- Creating/binding tables is a **manager/admin-only** action — waiters can't
  create tables, only work the ones assigned to them.

## Menu management

- Manual menu editing: categories (optionally grouped into tabs), items with
  price/description/photo, drag-to-reorder, draft/live status.
- **AI menu import**: upload photos of a physical menu; a Gemini
  vision-capable model (via the `extract-menu-items` Edge Function) extracts
  items/prices/descriptions into a review screen before publishing.

## Orders, history & payments

- Full order lifecycle: `pending → preparing → served → completed`
  (or `cancelled`), plus a separate `payment_status`/`payment_method`.
- Waiters see only their own order history (`/staff/orders`); managers/admins
  see everything with filters by waiter/status/date (`/admin/orders`).
- Table QR codes can be generated and downloaded as printable stickers
  (venue name + QR + table number) from `/admin/tables`.

## Customers, loyalty & CRM

- Every guest gets a lightweight `customer_profiles` record (name, loyalty
  points, WhatsApp opt-in) tied to their anonymous session.
- `/admin/customers` aggregates each guest's order count, total spend, last
  visit, and a rough payment-method segment (cash/card/mixed), sortable and
  searchable — useful for spotting repeat/high-value guests.
- Selected customers can be sent straight into the marketing composer as a
  targeted send list.

## WhatsApp marketing (Zendio/Zernio)

- `/staff/marketing` connects the venue's WhatsApp account (via Zernio) and
  sends broadcast campaigns to opted-in customers, optionally filtered by
  "no visit in the last N days" or an explicit CRM-selected list — always
  intersected with WhatsApp opt-in consent, never bypassing it.
- Order receipts can also be sent over WhatsApp automatically when a phone
  number is on file.

## Analytics

- `/admin/analytics`: revenue, sales by table/section/waiter, most popular
  items, loyalty points issued, and WhatsApp opt-in counts.

## Onboarding

- First signup bootstraps exactly one admin account and walks through venue
  details → staff invites → done. Every subsequent staff account is created
  via an emailed invite claimed on first login (`claim_staff_invite`), never
  by self-registering as admin.

## Under the hood

- **Frontend**: Next.js 15 (App Router, TypeScript, Tailwind v4), React 19.
- **Backend**: Supabase — Postgres with Row Level Security as the primary
  authorization layer (not just UI checks), Realtime for live table/order
  updates, Storage for menu photos/logos, Auth (anonymous + email/password),
  and Edge Functions (Deno) for AI menu extraction and WhatsApp sends.
- **Security model**: RLS policies scope waiters to their own
  tables/orders and managers/admins to everything; sensitive operations
  (waiter auto-assignment, table-status flips on order insert, invite
  claiming) run through `SECURITY DEFINER` Postgres functions so they work
  correctly under RLS without over-widening it.
- **AI**: Gemini vision model for menu photo extraction.
- **Messaging**: Zernio (Zendio) WhatsApp Business API for marketing
  broadcasts and receipts.

See [README.md](README.md) for environment setup and migration instructions.
