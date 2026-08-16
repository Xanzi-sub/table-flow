# TableFlow — Restaurant Operations & Guest Growth

TableFlow is a single-venue restaurant SaaS platform combining QR ordering,
live floor operations, menu and staff management, customer intelligence,
loyalty, WhatsApp marketing, analytics, specials, tips and support workflows.

**Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4,
Lucide icons, Supabase (Auth, Postgres, RLS, Realtime, Storage and Edge
Functions), Gemini menu extraction and Zernio/Zendio WhatsApp.

See [README_APP.md](README_APP.md) for the product behavior and role-by-role
workflow guide.

## 1. Configure environment variables

Copy the values from your Supabase project into `.env.local` (already scaffolded at the repo root):

```
NEXT_PUBLIC_SUPABASE_URL=            # Project Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # Project Settings → API → anon public key
SUPABASE_SERVICE_ROLE_KEY=           # Project Settings → API → service_role key (server-only, never expose)

NEXT_PUBLIC_SITE_URL=http://localhost:3000

GEMINI_API_KEY=                      # vision-capable model key, used by the extract-menu-items Edge Function
GEMINI_VISION_MODEL=gemini-3.6-flash

ZENDIO_API_KEY=                      # Zernio/Zendio WhatsApp Business API key (Settings → API Keys)
ZENDIO_RECEIPT_TEMPLATE=             # optional: approved WhatsApp template name for receipts

SUPPORT_API_KEY=                     # random server-only bearer key for the external support app
```

The `GEMINI_*` and `ZENDIO_*` values are only consumed by the Supabase Edge
Functions (Deno runtime) — set them as **function secrets**, not just in
`.env.local`:

```
supabase secrets set GEMINI_API_KEY=... GEMINI_VISION_MODEL=gemini-3.6-flash
supabase secrets set ZENDIO_API_KEY=...
```

There's no `ZENDIO_ACCOUNT_ID` to find or paste — connect WhatsApp once at
[zernio.com](https://zernio.com) → Connect Account → WhatsApp, then click
**"Detect Connected Account"** on `/staff/marketing` in the app. It calls
Zernio's accounts API, finds the connected WhatsApp account, and saves its id
into `venue_settings` automatically (see `src/app/actions/zendio.ts`).

## 2. Apply the database migrations

```
supabase link --project-ref <your-project-ref>
supabase db push
```

This applies all migrations through `0023_support_tickets.sql`. The migration
history covers the core schema and storage, onboarding and staff invites,
category groups, Zernio account data, waiter scoping and assignment, tips and
service requests, loyalty and feedback, menu specials and quantity deals,
order-scoped payments, loyalty redemption, and the support ticket workflow.

Do not skip older migrations on a fresh project. Supabase records which files
have already been applied and only runs the missing migrations.

In Supabase Auth settings:
- Enable **anonymous sign-ins**. Guests are silently given an anonymous
  Supabase identity and enter only a display name; no account or phone number
  is required to order.
- If you leave **Confirm email** on for staff accounts, add
  `http://localhost:3000/auth/callback` (and your production URL) to
  **Auth → URL Configuration → Redirect URLs**. `/signup` and `/staff/signup`
  already send confirmation links there; [src/app/auth/callback/route.ts](src/app/auth/callback/route.ts)
  exchanges the code, then finishes the first-admin bootstrap or invite claim
  automatically. Turning it OFF is simplest for local dev (skips the email round-trip).

## 3. Deploy the Edge Functions

```
supabase functions deploy extract-menu-items
supabase functions deploy send-marketing-campaign
supabase functions deploy send-order-receipt
supabase functions deploy send-otp-whatsapp --no-verify-jwt
```

`send-order-receipt` formats a branded receipt and sends it when a customer has
a WhatsApp number on file. Meta requires an approved template outside an open
24-hour conversation window. Configure `ZENDIO_RECEIPT_TEMPLATE` with that
approved template name.

## 4. Create your venue (no manual SQL needed)

1. Go to `/signup` and create the owner/admin account (email + password —
   Google sign-in is a planned addition). The very first person to sign up
   automatically becomes `admin`; every signup after that must come through an
   invite (see below), enforced by the `first admin bootstrap` RLS policy.
2. You're walked through onboarding: venue details (name/logo/address/phone) →
   add manager(s) → add waiters/staff. Each person you add becomes a row in
   `staff_invites` — no password is set for them yet.
3. Invited staff activate their own account at `/staff/signup` using the exact
   email they were added with. `claim_staff_invite(...)` (SECURITY DEFINER)
   matches that email against the pending invite and creates their
   `staff_profiles` row automatically — no manual linking required.
4. You can keep inviting/removing staff later from `/admin/staff`.

## 5. Run the app

```
npm install
npm run dev
```

- `/` — public product and pricing landing page
- `/signup` — venue owner/admin self-signup (first account only)
- `/onboarding/venue` → `/onboarding/team` → `/onboarding/staff` — first-run setup wizard
- `/staff/signup` — invited staff activate their account (email must match the invite)
- `/staff/login` — staff/admin sign in
- `/staff/dashboard` — live floor view (role-aware)
- `/staff/orders`, `/staff/tips` — waiter order history and tips
- `/admin/tables`, `/admin/orders`, `/admin/customers`, `/admin/tips` — venue operations
- `/admin/menu`, `/admin/specials`, `/admin/menu-scan` — menu and offer management
- `/staff/marketing`, `/admin/analytics`, `/admin/staff` — growth, intelligence and team management
- `/admin/settings` — venue, billing, loyalty, WhatsApp and support tickets
- `/menu/[qr_identifier]` — customer ordering app (create a `tables` row via
  `/staff/assign-table/[qr_identifier]` first, or insert one directly in SQL)
- `/q/[qr_identifier]` — the URL encoded on the physical table sticker; resolved by
  `src/middleware.ts` to either the staff assign-table flow or the customer menu

## Support app integration

Managers and admins create and follow tickets in `/admin/settings`. The external
support app calls `/api/support/tickets` with
`Authorization: Bearer <SUPPORT_API_KEY>`. It may also send
`X-Support-Agent-Id` and `X-Support-Agent-Name` headers for assignment and audit
attribution.

- `GET /api/support/tickets` lists tickets with messages and audit events.
- `GET /api/support/tickets?ticketId=<uuid>` gets one complete ticket.
- `GET /api/support/tickets?since=<ISO timestamp>&status=open,in_progress` supports incremental polling.
- `POST { "action": "reply", "ticketId": "<uuid>", "message": "...", "isInternal": false }` adds a support reply.
- `PATCH { "ticketId": "<uuid>", "status": "resolved", "resolutionSummary": "..." }` updates workflow state.
- The same `PATCH` accepts `priority`, `externalAssigneeId`,
  `externalAssigneeName`, and `externalReference`.

Supported statuses are `open`, `in_progress`, `waiting_on_venue`, `resolved`,
and `closed`. Internal support replies and service-role database access are
never exposed to the venue browser.

## Project structure

```
src/
  middleware.ts              # /q/[qr_identifier] routing + staff/admin auth guard
  types/database.ts          # hand-written Supabase types (regenerate with `supabase gen types typescript`)
  lib/supabase/              # browser/server/admin Supabase clients + middleware session helper
  app/actions/               # secured application mutations and aggregation queries
  app/api/                   # stable support, cash-out and Zernio integration routes
  app/menu/[qr_identifier]/  # customer ordering app
  app/signup, app/onboarding/ # venue + first-admin signup, venue/team/staff setup wizard
  app/staff/                 # staff login, signup (invite claim), dashboard, assign-table, marketing
  app/admin/                 # venue operations, CRM, menu, intelligence, staff and settings
  components/                # customer/staff/admin/onboarding UI split by surface
supabase/
  migrations/                # schema, RLS, triggers and RPCs through migration 0023
  functions/                 # AI extraction, WhatsApp campaigns, receipts and OTP
```

## Notes on the security model

- Guests use Supabase anonymous auth. `orders.customer_session_id` stores
  `auth.uid()` so Row Level Security verifies ownership instead of trusting a
  client-supplied session ID. Phone and WhatsApp opt-in are optional customer
  profile data, not an ordering prerequisite.
- Order lookups from the customer app go through the `get_order_status(...)`
  Postgres function (SECURITY DEFINER) rather than a broad public `SELECT`
  policy on `orders`, so a customer can only ever read their own order.
- `SUPABASE_SERVICE_ROLE_KEY` is only ever used from `src/lib/supabase/admin.ts`
  (marked `server-only`) and in Edge Functions, never in client code.

## Pricing model

The public offer is one complete venue plan: **R899/month** plus **R2,500
once-off setup and onboarding**, or **R8,990/year**. A limited Founding Venue
offer is displayed as **R599/month plus R1,500 setup for 12 months**. TableFlow
does not charge per order or take a percentage of restaurant revenue. Variable
third-party WhatsApp usage may be billed separately.

## Dependency notes

`@supabase/supabase-js` and `@supabase/ssr` are pinned to `2.50.0` and `0.5.2`.
The project uses hand-authored `Database` types, so verify any Supabase client
upgrade with `npm run build`. The staff/admin shell uses `lucide-react`.

