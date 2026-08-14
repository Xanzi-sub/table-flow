# TableFlow — QR Ordering & Loyalty Platform

Next.js 15 (App Router, TypeScript, Tailwind) + Supabase (Auth, Postgres, Realtime, Storage, Edge Functions) + Zendio (WhatsApp).

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

This runs, in order:
- `supabase/migrations/0001_init.sql` — core schema, RLS, RPC functions
- `supabase/migrations/0002_storage.sql` — public `menu-photos` storage bucket
- `supabase/migrations/0003_onboarding.sql` — `venue_settings`, `staff_invites`,
  the first-admin bootstrap policy, and the `claim_staff_invite(...)` function
- `supabase/migrations/0004_zendio_account.sql` — adds `zendio_account_id` /
  `zendio_account_label` to `venue_settings` (auto-detected, not hand-typed)

In Supabase Auth settings, enable:
- **Phone auth** (OTP) — every customer must verify their WhatsApp number
  before ordering, so they can receive their receipt and unlock loyalty points.
- If you leave **"Confirm email"** ON (the default), add
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
```

`send-order-receipt` fires automatically after every order, formatting a
receipt with your venue name/logo and sending it to the customer's WhatsApp
number. **Meta requires an approved message template for a business's very
first message to a customer** (the customer never messages your WhatsApp
number directly, so this is always a "first contact"). Create a template
(e.g. `order_receipt`) in your Zernio/Meta WhatsApp settings and set
`ZENDIO_RECEIPT_TEMPLATE` to its name; until then the function falls back to
a plain-text send, which only actually delivers within an existing 24h window.

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

- `/` — landing page
- `/signup` — venue owner/admin self-signup (first account only)
- `/onboarding/venue` → `/onboarding/team` → `/onboarding/staff` — first-run setup wizard
- `/staff/signup` — invited staff activate their account (email must match the invite)
- `/staff/login` — staff/admin sign in
- `/staff/dashboard` — live floor view (role-aware)
- `/admin/menu`, `/admin/menu-scan`, `/admin/analytics`, `/admin/staff` — manager/admin only
- `/menu/[qr_identifier]` — customer ordering app (create a `tables` row via
  `/staff/assign-table/[qr_identifier]` first, or insert one directly in SQL)
- `/q/[qr_identifier]` — the URL encoded on the physical table sticker; resolved by
  `src/middleware.ts` to either the staff assign-table flow or the customer menu

## Project structure

```
src/
  middleware.ts              # /q/[qr_identifier] routing + staff/admin auth guard
  types/database.ts          # hand-written Supabase types (regenerate with `supabase gen types typescript`)
  lib/supabase/              # browser/server/admin Supabase clients + middleware session helper
  app/actions/               # server actions (tables, orders, menu, scan, marketing, staff, onboarding, auth)
  app/menu/[qr_identifier]/  # customer ordering app
  app/signup, app/onboarding/ # venue + first-admin signup, venue/team/staff setup wizard
  app/staff/                 # staff login, signup (invite claim), dashboard, assign-table, marketing
  app/admin/                 # menu CRUD, menu-scan pipeline, analytics, staff management
  components/                # customer/staff/admin/onboarding UI split by surface
supabase/
  migrations/                # SQL schema, RLS policies, RPC functions, storage bucket, onboarding tables
  functions/                 # Deno Edge Functions: extract-menu-items, send-marketing-campaign, send-order-receipt
```

## Notes on the security model

- Every customer verifies their WhatsApp number via OTP (`signInWithOtp` /
  `verifyOtp`) before ordering — this is what lets `send-order-receipt` deliver
  a receipt and what identifies them for loyalty points on return visits.
  `orders.customer_session_id` stores `auth.uid()` so Row Level Security can
  verify order ownership instead of trusting a client-supplied session id.
- Order lookups from the customer app go through the `get_order_status(...)`
  Postgres function (SECURITY DEFINER) rather than a broad public `SELECT`
  policy on `orders`, so a customer can only ever read their own order.
- `SUPABASE_SERVICE_ROLE_KEY` is only ever used from `src/lib/supabase/admin.ts`
  (marked `server-only`) and in Edge Functions, never in client code.

## Important dependency pin

`@supabase/supabase-js` and `@supabase/ssr` are pinned to `2.45.4` / `0.5.2`.
Newer `supabase-js` versions ship a select-query-parser whose generics don't
resolve correctly against hand-written `Database` types (everything silently
types as `never`). If you regenerate types with the Supabase CLI and want to
upgrade, re-verify with `npx tsc --noEmit` first.

