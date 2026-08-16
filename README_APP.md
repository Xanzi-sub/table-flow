# TableFlow — Product & Application Guide

TableFlow is a restaurant operations and guest-growth platform for a single
venue. It connects QR ordering, the live floor, order and payment handling,
menu control, staff operations, customer intelligence, loyalty, WhatsApp
marketing, analytics and support in one system.

The current architecture is single-tenant: one deployment and Supabase project
serve one venue.

## Commercial model

TableFlow is sold as an ongoing SaaS service rather than a once-off software
purchase:

- **R899/month** plus **R2,500 once-off setup and onboarding**
- **R8,990/year**, saving R1,798 against monthly billing
- Limited **Founding Venue** offer: R599/month plus R1,500 setup for 12 months
- No per-order charge and no percentage of restaurant revenue
- Variable third-party WhatsApp usage may be charged separately

Setup covers venue configuration, menu import, tables and QR codes, staff
accounts, WhatsApp configuration, branding, onboarding and training.

## Users and access

| Role | Access |
|---|---|
| **Guest** | Anonymous identity. Scans a table QR, orders, tracks orders, requests service, views receipts/history, earns or redeems loyalty and leaves feedback. |
| **Waiter** | Signs in at `/staff/login`, toggles duty status and works only assigned tables, orders and tips. |
| **Manager** | Runs all venue operations plus menu, specials, customers, marketing, intelligence, staff, settings and support tickets. |
| **Admin** | Manager access plus full staff and venue administration. |
| **External support** | Uses the bearer-authenticated support API or server-side Supabase service role to triage and resolve venue tickets. |

## Public experience

The `/` route is the responsive TableFlow product landing page. It presents the
connected restaurant workflow, core capabilities, guest-growth value and the
single-plan pricing model. Venue owners start at `/signup`; existing teams use
`/staff/login`.

## Guest ordering flow

1. Each table has a QR sticker containing `/q/[qr_identifier]`.
2. A manager or admin binds the identifier to a table and section through the
   assign-table flow. Table creation is not available to waiters.
3. Guests are routed to `/menu/[qr_identifier]` and silently receive a Supabase
   anonymous identity. They provide a display name; no account, phone number or
   app download is required.
4. Guests browse grouped categories, menu items and active specials. The cart
   persists on the device.
5. Checkout prices are recalculated on the server. Percentage discounts,
   quantity/package offers, buy-pay deals, combos and loyalty redemption cannot
   be forged by the browser.
6. Creating an order moves a vacant table into service and assigns an eligible
   waiter when needed.
7. Guests follow `pending → preparing → served → completed`, request the bill
   or waiter, view an itemised receipt and revisit order history.
8. After service they can earn/redeem loyalty, submit or update feedback and,
   when opted in with a number on file, receive a WhatsApp receipt.

## Live floor and orders

`/staff/dashboard` is the realtime operating view. Supabase Realtime is backed
by polling and visibility refreshes so the floor recovers from missed events.

- Waiters see only assigned tables; managers and admins see the whole venue.
- Table cards show distinct order, bill and service alerts without overlap.
- Table details show every order and line item independently.
- Order status and payment are separate. Paying one order never marks other
  orders at the same table paid and does not force order completion.
- Supported payment methods include cash, speedpoint and online portal state.
- Managers can reassign waiters. Order history remains available after tables
  are reset for the next party.

Waiter history is at `/staff/orders`; venue-wide history is at `/admin/orders`.
Table and printable QR management lives at `/admin/tables`.

## Duty, assignments, tips and service

Waiters can toggle on/off duty from the responsive application shell. Only
checked-in waiters are eligible for automatic assignment. The allocator picks
the eligible waiter with the fewest active tables and applies a deterministic
tie-break. Managers can always assign manually.

Customer service requests are visible on the live floor. Tips are tracked per
waiter at `/staff/tips`; managers resolve cash-out requests and inspect history
at `/admin/tips` through a stable API route.

## Menu, import and specials

`/admin/menu` supports categories, optional category groups, items, photos,
prices, descriptions, availability, status and drag reordering.

`/admin/menu-scan` uploads physical menu images. Gemini extracts candidate
items through the `extract-menu-items` Edge Function, then staff review and
publish them.

`/admin/specials` supports scheduled and archived offers, percentage discounts,
package quantities, buy-pay rules and combo bundles. The customer menu displays
active offers while checkout verifies every rule server-side.

## Customers, loyalty and feedback

Every guest can have a `customer_profiles` record tied to the anonymous auth
identity. `/admin/customers` provides searchable visit count, spend, last visit,
payment behavior and marketing selection.

Loyalty is ledger-backed. Points are awarded when an order is paid and can be
redeemed at checkout according to venue-configured thresholds and reward value.
The server validates balances and writes immutable earn/redeem entries.

Order feedback stores ratings, comments and resolution state. Guests can update
their review; venue intelligence aggregates recurring themes and unresolved
feedback.

## Marketing and restaurant intelligence

`/staff/marketing` connects the venue's Zernio/Zendio WhatsApp account and sends
campaigns only to opted-in customers. Audiences may be selected from CRM or
filtered by visit recency. Campaign records remain available for reporting.

`/admin/analytics` is the manager intelligence workspace. It combines menu,
customer, floor and feedback signals, including sales trends, item performance,
repeat behavior, service operations and actionable feedback.

## Settings and support

`/admin/settings` manages venue identity and branding, VAT receipt display,
suggested tips, loyalty rules, WhatsApp connection and support tickets.

Managers and admins can create categorized, prioritized tickets, follow status,
read support replies, continue the conversation, close resolved tickets and
reopen them. Ticket messages refresh through Realtime with a polling fallback.
The data model includes human-readable ticket numbers, assignment metadata,
resolution summaries and immutable audit events.

The external support contract is `/api/support/tickets`, authenticated with
`Authorization: Bearer <SUPPORT_API_KEY>`. It supports full ticket retrieval,
incremental polling, replies, internal notes, assignment, priority, external
references, resolution, closing and reopening. See [README.md](README.md) for
request examples and environment setup.

## Onboarding and staff accounts

The first `/signup` account bootstraps the venue admin and enters the venue,
manager and waiter onboarding sequence. Later staff members are invited from
`/admin/staff` and activate their account at `/staff/signup`; they cannot
self-promote into privileged roles.

## Application shell and design system

Protected staff and admin routes share a responsive slate-and-blue operations
shell:

- role-filtered Operations and Management navigation
- Lucide icons and clear active-route state
- persistent desktop sidebar and mobile navigation drawer
- venue branding, page context, staff identity and sign-out controls
- waiter duty control with success/error feedback
- shared page headers, cards, buttons, fields, badges and readable operational
  typography through the `app-content` scope

The customer menu retains its mobile-first restaurant experience while the
public landing page uses the TableFlow green brand direction and larger logo.

## Architecture and security

- **Frontend:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4 and
  Lucide React.
- **Backend:** Supabase Postgres, Auth, RLS, Realtime, Storage and Deno Edge
  Functions.
- **Identity:** anonymous Supabase auth for guests; email/password and invites
  for staff.
- **Authorization:** RLS scopes guests and waiters; managers/admins receive
  venue-wide operational access. Sensitive mutations use server code or
  `SECURITY DEFINER` database functions.
- **Price integrity:** checkout calculates authoritative menu, special and
  loyalty values on the server.
- **Service role:** used only in server-only code, API routes and Edge Functions;
  never shipped to the browser.
- **Resilience:** critical realtime views also refresh by polling and on browser
  visibility changes.
- **Abuse protection:** an atomic Postgres rate limiter protects authentication,
  orders, service requests, feedback, imports, campaigns, support, cash-outs,
  provider connections, receipts and OTP sends across serverless instances.
- **API boundaries:** cookie-authenticated writes enforce same-origin JSON,
  request-size limits and bounded fields. Redirects accept only internal paths
  or the configured site origin.
- **Uploads and AI:** only managers/admins can write menu storage; bucket MIME
  and size restrictions are enforced, and AI extraction only fetches files
  from this project's storage origin without redirects.
- **Browser hardening:** HSTS, frame denial, MIME sniffing prevention,
  referrer policy, permissions policy and a restrictive baseline CSP are sent
  globally.
- **Native staff app:** Capacitor wraps the hosted `/staff/*` and `/admin/*`
  application for Android/iOS while guests continue using the web QR menu.
- **Notifications:** `staff_notifications` is the persistent source of truth;
  Realtime drives foreground UI/sound and FCM/APNs/Web Push handle background
  or closed apps. Tokens are stored per authenticated staff device. New orders, calls,
  bill requests, cancellations, assignments and unassigned work are routed
  from authoritative database state.
- **Operational recipients:** the assigned waiter receives the primary alert;
  managers/admins receive persistent copies of new-order, waiter-call, bill and
  cancellation alerts for venue-wide oversight.
- **Foreground alarms:** new persistent alerts trigger a repeating TableFlow
  tone for up to 60 seconds. Realtime is primary and five-second polling covers
  sleeping or disconnected WebSockets. Opening/reading the alert, marking all
  read or disabling sound stops the alarm.
- **Assignment recovery:** on-duty waiters receive unassigned-work alerts and
  can confirm **Take table & orders**. The atomic claim updates the table and
  every active order, then Realtime reflects ownership to management.
- **Install experience:** authenticated Chrome staff receive a native browser
  install prompt when eligible; standalone installs are detected and not
  prompted again. Safari receives Add to Home Screen guidance.
- **Customer install and alerts:** each QR menu exposes a table-specific PWA
  manifest. Anonymous customers can install it and register their browser for
  persistent order-status notifications, background Web Push and foreground
  sound when an order becomes preparing, served, completed or cancelled.
- **Customer recovery:** a random device ID and separate recovery secret bind
  the installed/browser device to its customer profile. If Supabase replaces
  an expired anonymous session, a secured RPC migrates profile, loyalty,
  history, feedback and notifications to the new auth identity before ordering
  is enabled. Clearing all browser storage still starts a genuinely fresh guest
  because no secure recovery proof remains.
- **Recovery fallback:** customer menus reject staff-auth sessions. If recovery
  credentials are stale or invalid, TableFlow rotates the local customer
  credentials, creates a clean anonymous profile and immediately opens name
  onboarding instead of trapping the guest in a refresh loop.
- **Floor request source:** active `table_service_requests` rows—not the lossy
  table status alone—drive waiter-call and bill-request badges, panels and
  drawer details. Realtime plus polling keeps them visible until resolved.
- **Checkout resilience:** every cart submission has a stable idempotency key,
  so an interrupted response can be retried without creating a duplicate order.
- **Database:** migrations currently run through `0035_customer_staff_identity_guard.sql`.

See [README.md](README.md) for installation, environment variables, migrations,
Edge Function deployment, routes and external support API examples.
