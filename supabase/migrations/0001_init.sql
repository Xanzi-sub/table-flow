-- ============================================================================
-- TableFlow — Initial schema, RLS policies, and support functions
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============ ENUMS ============
create type user_role as enum ('admin', 'manager', 'waiter');
create type menu_item_status as enum ('draft', 'live', 'archived');
create type menu_item_source as enum ('manual', 'scanned');
create type scan_job_status as enum ('uploaded', 'processing', 'needs_review', 'published', 'failed');
create type order_status as enum ('pending', 'preparing', 'served', 'completed', 'cancelled');
create type payment_status as enum ('unpaid', 'portal_processing', 'paid');
create type payment_method as enum ('cash', 'speedpoint', 'online_portal');
create type table_status as enum ('vacant', 'dining', 'awaiting_bill', 'paid');

-- ============ ROLES & STAFF ============
create table staff_profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text not null,
    role user_role not null default 'waiter',
    is_checked_in boolean default false,
    current_assigned_sections int[] default '{}',
    created_at timestamptz default now()
);

-- ============ FLOOR / TABLES ============
create table tables (
    id uuid primary key default gen_random_uuid(),
    qr_identifier text unique not null,
    table_number int,
    section text,
    status table_status default 'vacant',
    current_waiter_id uuid references staff_profiles(id) on delete set null,
    updated_at timestamptz default now()
);

-- ============ MENU STRUCTURE ============
create table menu_categories (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    sort_order int default 0,
    is_active boolean default true
);

create table menu_scan_jobs (
    id uuid primary key default gen_random_uuid(),
    uploaded_by uuid references staff_profiles(id),
    image_urls text[] not null,
    status scan_job_status default 'uploaded',
    raw_ai_output jsonb,
    error_message text,
    created_at timestamptz default now()
);

create table menu_items (
    id uuid primary key default gen_random_uuid(),
    category_id uuid references menu_categories(id),
    name text not null,
    description text,
    price decimal(10,2) not null,
    image_url text,
    status menu_item_status default 'draft',
    source menu_item_source default 'manual',
    scan_confidence numeric,
    scan_job_id uuid references menu_scan_jobs(id) on delete set null,
    sort_order int default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ============ CUSTOMERS & LOYALTY ============
-- id is set to auth.uid() (anonymous or phone-verified) so RLS can key off auth.uid() directly.
create table customer_profiles (
    id uuid references auth.users on delete cascade primary key,
    phone_number text unique,
    full_name text,
    loyalty_points int default 0,
    whatsapp_opt_in boolean default false,
    consent_timestamp timestamptz,
    created_at timestamptz default now()
);

-- ============ ORDERS ============
create table orders (
    id uuid primary key default gen_random_uuid(),
    table_id uuid references tables(id) not null,
    waiter_id uuid references staff_profiles(id),
    status order_status default 'pending',
    payment_status payment_status default 'unpaid',
    payment_method payment_method,
    customer_session_id text not null, -- auth.uid() of the (anon or identified) customer session
    customer_id uuid references customer_profiles(id),
    total_amount decimal(10,2) not null default 0,
    created_at timestamptz default now()
);

create table order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid references orders(id) on delete cascade,
    menu_item_id uuid references menu_items(id),
    quantity int not null,
    notes text,
    unit_price decimal(10,2) not null
);

-- ============ MARKETING (Zendio / WhatsApp) ============
create table marketing_campaigns (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    message_body text not null,
    total_recipients int default 0,
    status text default 'pending', -- pending, processing, completed, failed
    created_by uuid references staff_profiles(id),
    created_at timestamptz default now()
);

-- ============ INDEXES ============
create index idx_menu_items_category on menu_items(category_id);
create index idx_menu_items_status on menu_items(status);
create index idx_menu_items_scan_job on menu_items(scan_job_id);
create index idx_orders_table on orders(table_id);
create index idx_orders_customer_session on orders(customer_session_id);
create index idx_order_items_order on order_items(order_id);
create index idx_tables_status on tables(status);

-- ============ HELPER FUNCTIONS ============

-- True when the current JWT belongs to a staff account (any role).
create or replace function is_staff()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from staff_profiles where id = auth.uid()
  );
$$;

-- True when the current JWT belongs to a manager or admin.
create or replace function is_manager_or_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from staff_profiles where id = auth.uid() and role in ('manager', 'admin')
  );
$$;

create or replace function current_staff_role()
returns user_role
language sql
security definer
stable
as $$
  select role from staff_profiles where id = auth.uid();
$$;

-- Generic updated_at maintenance trigger.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_menu_items_updated_at
  before update on menu_items
  for each row execute function set_updated_at();

create trigger trg_tables_updated_at
  before update on tables
  for each row execute function set_updated_at();

-- ============ ROUND-ROBIN WAITER ASSIGNMENT ============
-- Picks the checked-in waiter with the fewest currently-open tables.
create or replace function assign_next_waiter()
returns uuid
language plpgsql
security definer
as $$
declare
  next_waiter_id uuid;
begin
  select sp.id into next_waiter_id
  from staff_profiles sp
  left join tables t
    on t.current_waiter_id = sp.id
   and t.status in ('dining', 'awaiting_bill')
  where sp.role = 'waiter'
    and sp.is_checked_in = true
  group by sp.id
  order by count(t.id) asc, sp.full_name asc
  limit 1;

  return next_waiter_id;
end;
$$;

-- Binds a QR sticker to a table number/section, assigning a waiter
-- (explicit waiter_id, or automatic round-robin when null).
create or replace function assign_table(
  p_qr_identifier text,
  p_table_number int,
  p_section text default null,
  p_waiter_id uuid default null
)
returns tables
language plpgsql
security definer
as $$
declare
  v_waiter_id uuid;
  v_table tables;
begin
  if not is_staff() then
    raise exception 'Only staff can assign tables';
  end if;

  v_waiter_id := coalesce(p_waiter_id, assign_next_waiter());

  insert into tables (qr_identifier, table_number, section, current_waiter_id, status)
  values (p_qr_identifier, p_table_number, p_section, v_waiter_id, 'dining')
  on conflict (qr_identifier)
  do update set
    table_number = excluded.table_number,
    section = coalesce(excluded.section, tables.section),
    current_waiter_id = excluded.current_waiter_id,
    updated_at = now()
  returning * into v_table;

  return v_table;
end;
$$;

-- Returns a single order + its items as JSON, gated to the owning
-- customer session or staff — avoids a broad public SELECT policy on orders.
create or replace function get_order_status(p_order_id uuid, p_session_id text)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_result jsonb;
begin
  select to_jsonb(o) || jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'menu_item_id', oi.menu_item_id,
        'name', mi.name,
        'quantity', oi.quantity,
        'notes', oi.notes,
        'unit_price', oi.unit_price
      ))
      from order_items oi
      join menu_items mi on mi.id = oi.menu_item_id
      where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  into v_result
  from orders o
  where o.id = p_order_id
    and (o.customer_session_id = p_session_id or is_staff());

  return v_result;
end;
$$;

-- ============ ROW LEVEL SECURITY ============
alter table staff_profiles enable row level security;
alter table tables enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table menu_scan_jobs enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table customer_profiles enable row level security;
alter table marketing_campaigns enable row level security;

-- ---- staff_profiles ----
create policy "staff can read own profile" on staff_profiles
  for select using (id = auth.uid() or is_manager_or_admin());

create policy "admins manage staff profiles" on staff_profiles
  for insert with check (is_manager_or_admin());

create policy "admins update staff profiles" on staff_profiles
  for update using (is_manager_or_admin() or id = auth.uid());

create policy "admins delete staff profiles" on staff_profiles
  for delete using (is_manager_or_admin());

-- ---- tables ----
create policy "anyone can read tables" on tables
  for select using (true);

create policy "staff manage tables" on tables
  for all using (is_staff()) with check (is_staff());

-- ---- menu_categories ----
create policy "public reads active categories" on menu_categories
  for select using (is_active = true or is_staff());

create policy "managers manage categories" on menu_categories
  for insert with check (is_manager_or_admin());

create policy "managers update categories" on menu_categories
  for update using (is_manager_or_admin());

create policy "managers delete categories" on menu_categories
  for delete using (is_manager_or_admin());

-- ---- menu_items ----
create policy "public reads live items" on menu_items
  for select using (status = 'live' or is_staff());

create policy "managers insert items" on menu_items
  for insert with check (is_manager_or_admin());

create policy "managers update items" on menu_items
  for update using (is_manager_or_admin());

create policy "managers delete items" on menu_items
  for delete using (is_manager_or_admin());

-- ---- menu_scan_jobs (staff-only, no public access) ----
create policy "managers read scan jobs" on menu_scan_jobs
  for select using (is_manager_or_admin());

create policy "managers create scan jobs" on menu_scan_jobs
  for insert with check (is_manager_or_admin());

create policy "managers update scan jobs" on menu_scan_jobs
  for update using (is_manager_or_admin());

-- ---- customer_profiles ----
create policy "customers read own profile" on customer_profiles
  for select using (id = auth.uid() or is_staff());

create policy "customers create own profile" on customer_profiles
  for insert with check (id = auth.uid());

create policy "customers update own profile" on customer_profiles
  for update using (id = auth.uid() or is_manager_or_admin());

-- ---- orders ----
-- Customers see/manage only their own session's orders; staff see everything.
create policy "orders visible to owner or staff" on orders
  for select using (customer_session_id = auth.uid()::text or is_staff());

create policy "customers create own orders" on orders
  for insert with check (customer_session_id = auth.uid()::text);

create policy "owner or staff update orders" on orders
  for update using (customer_session_id = auth.uid()::text or is_staff());

-- ---- order_items ----
create policy "order items follow parent order" on order_items
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (o.customer_session_id = auth.uid()::text or is_staff())
    )
  );

create policy "customers insert own order items" on order_items
  for insert with check (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and o.customer_session_id = auth.uid()::text
    )
    or is_staff()
  );

create policy "staff update order items" on order_items
  for update using (is_staff());

-- ---- marketing_campaigns ----
create policy "managers read campaigns" on marketing_campaigns
  for select using (is_manager_or_admin());

create policy "managers create campaigns" on marketing_campaigns
  for insert with check (is_manager_or_admin());

create policy "managers update campaigns" on marketing_campaigns
  for update using (is_manager_or_admin());

-- ============ REALTIME ============
alter publication supabase_realtime add table tables;
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
alter publication supabase_realtime add table menu_scan_jobs;
alter publication supabase_realtime add table menu_items;
