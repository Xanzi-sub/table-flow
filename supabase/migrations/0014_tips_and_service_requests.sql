-- ============================================================================
-- 1. VAT/tip venue configuration. Menu prices are VAT-inclusive (confirmed
--    with the venue), so vat_percentage is only used to show a breakdown of
--    tax already baked into the total — it never changes what's charged.
--    tip_percentage is a suggested/reference amount shown on receipts; it
--    never changes the charged total either. Real tips are captured manually
--    by staff at the point of payment (orders.tip_amount below).
-- ============================================================================
alter table venue_settings add column if not exists vat_percentage numeric not null default 15;
alter table venue_settings add column if not exists tip_percentage numeric not null default 10;

-- ============================================================================
-- 2. Service request alert — independent of table.status so staff can
--    dismiss "customer needs help" without it being tangled up with the
--    payment/completion lifecycle.
-- ============================================================================
alter table tables add column if not exists service_requested_at timestamptz;

create or replace function request_table_service(p_table_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update tables
  set status = 'awaiting_bill', updated_at = now(), service_requested_at = now()
  where id = p_table_id;
end;
$$;

-- ============================================================================
-- 3. Actual tip amount captured by staff when marking a table paid — this,
--    not the suggested tip_percentage, is what funds the tips ledger below.
-- ============================================================================
alter table orders add column if not exists tip_amount numeric not null default 0;

-- ============================================================================
-- 4. Waiter tip cash-out requests. Cash tips are assumed taken directly by
--    the waiter at the table, so only card/online tips are ever eligible for
--    cash-out. Linking an order to a request (rather than a running balance)
--    avoids double-counting/drift and lets a rejected request free its
--    orders back up automatically.
-- ============================================================================
create table tip_cashout_requests (
  id uuid primary key default gen_random_uuid(),
  waiter_id uuid references staff_profiles(id) not null,
  amount numeric not null,
  status text not null default 'pending', -- pending | scheduled | approved | rejected
  scheduled_for date,
  notes text,
  requested_at timestamptz default now(),
  resolved_at timestamptz,
  resolved_by uuid references staff_profiles(id)
);

alter table orders add column if not exists tip_cashout_request_id uuid references tip_cashout_requests(id) on delete set null;

alter table tip_cashout_requests enable row level security;

create policy "waiter reads own cashout requests" on tip_cashout_requests
  for select using (waiter_id = auth.uid() or is_manager_or_admin());

create policy "waiter creates own cashout request" on tip_cashout_requests
  for insert with check (waiter_id = auth.uid());

create policy "manager updates cashout requests" on tip_cashout_requests
  for update using (is_manager_or_admin());

-- ============================================================================
-- 5. Narrow, safe way for an anonymous guest to see their waiter's name on
--    the receipt without granting broad staff_profiles read access.
-- ============================================================================
create or replace function get_table_waiter_name(p_table_id uuid)
returns text
language sql
security definer
stable
as $$
  select sp.full_name
  from tables t
  join staff_profiles sp on sp.id = t.current_waiter_id
  where t.id = p_table_id;
$$;
