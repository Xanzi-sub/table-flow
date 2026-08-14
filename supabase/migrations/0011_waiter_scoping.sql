-- ============================================================================
-- Waiters should only see/manage the tables currently assigned to them and
-- the orders tied to those assignments (managers/admins keep full visibility
-- for oversight). Two gaps had to be closed first:
--
-- 1. orders.waiter_id was never actually populated anywhere in the app code
--    (submitOrder() never set it), so any "my orders" scoping would've
--    matched zero rows. A BEFORE INSERT trigger now stamps it from the
--    table's current_waiter_id at order-creation time (SECURITY DEFINER,
--    same pattern as migration 0008's dining-status trigger).
-- 2. "staff manage tables" and "orders/order_items visible to ... staff"
--    used is_staff() (true for every role), granting every waiter full
--    read/write on every table and every order. Replaced with policies that
--    split manager/admin (full access) from waiter (own assignment only).
-- ============================================================================

-- ---- 1. Stamp orders.waiter_id from the table at insert time ----
create or replace function set_order_waiter_from_table()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.waiter_id is null then
    select current_waiter_id into new.waiter_id from tables where id = new.table_id;
  end if;
  return new;
end;
$$;

create trigger trg_orders_set_waiter
  before insert on orders
  for each row execute function set_order_waiter_from_table();

-- ---- 2. Scope `tables` writes: managers/admins full access, waiters only their own ----
drop policy if exists "staff manage tables" on tables;

create policy "managers manage tables" on tables
  for all using (is_manager_or_admin()) with check (is_manager_or_admin());

-- USING checks the table's current (pre-update) assignment; WITH CHECK only
-- re-confirms the caller is still a waiter (not the *new* current_waiter_id),
-- since completing an order legitimately clears current_waiter_id to null.
create policy "waiters update own tables" on tables
  for update
  using (current_staff_role() = 'waiter' and current_waiter_id = auth.uid())
  with check (current_staff_role() = 'waiter');

-- ("anyone can read tables" from migration 0001 is unchanged — table
-- number/section/status must stay publicly readable for the guest QR menu.)

-- ---- 3. Scope `orders` reads/writes: manager/admin, order owner, or assigned waiter ----
drop policy if exists "orders visible to owner or staff" on orders;
create policy "orders visible to owner manager or assigned waiter" on orders
  for select using (
    customer_session_id = auth.uid()::text
    or is_manager_or_admin()
    or waiter_id = auth.uid()
  );

drop policy if exists "owner or staff update orders" on orders;
create policy "owner manager or assigned waiter update orders" on orders
  for update using (
    customer_session_id = auth.uid()::text
    or is_manager_or_admin()
    or waiter_id = auth.uid()
  );

-- ---- 4. Same scoping for order_items, via their parent order ----
drop policy if exists "order items follow parent order" on order_items;
create policy "order items follow parent order" on order_items
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (
          o.customer_session_id = auth.uid()::text
          or is_manager_or_admin()
          or o.waiter_id = auth.uid()
        )
    )
  );

drop policy if exists "staff update order items" on order_items;
create policy "manager or assigned waiter update order items" on order_items
  for update using (
    is_manager_or_admin()
    or exists (
      select 1 from orders o
      where o.id = order_items.order_id and o.waiter_id = auth.uid()
    )
  );
-- ============================================================================
-- Waiters should only see/manage the tables currently assigned to them and
-- the orders tied to those assignments (managers/admins keep full visibility
-- for oversight). Two gaps had to be closed first:
--
-- 1. orders.waiter_id was never actually populated anywhere in the app code
--    (submitOrder() never set it), so any "my orders" scoping would've
--    matched zero rows. A BEFORE INSERT trigger now stamps it from the
--    table's current_waiter_id at order-creation time (SECURITY DEFINER,
--    same pattern as migration 0008's dining-status trigger).
-- 2. "staff manage tables" and "orders/order_items visible to ... staff"
--    used is_staff() (true for every role), granting every waiter full
--    read/write on every table and every order. Replaced with policies that
--    split manager/admin (full access) from waiter (own assignment only).
-- ============================================================================

-- ---- 1. Stamp orders.waiter_id from the table at insert time ----
create or replace function set_order_waiter_from_table()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.waiter_id is null then
    select current_waiter_id into new.waiter_id from tables where id = new.table_id;
  end if;
  return new;
end;
$$;

create trigger trg_orders_set_waiter
  before insert on orders
  for each row execute function set_order_waiter_from_table();

-- ---- 2. Scope `tables` writes: managers/admins full access, waiters only their own ----
drop policy if exists "staff manage tables" on tables;

create policy "managers manage tables" on tables
  for all using (is_manager_or_admin()) with check (is_manager_or_admin());

-- USING checks the table's current (pre-update) assignment; WITH CHECK only
-- re-confirms the caller is still a waiter (not the *new* current_waiter_id),
-- since completing an order legitimately clears current_waiter_id to null.
create policy "waiters update own tables" on tables
  for update
  using (current_staff_role() = 'waiter' and current_waiter_id = auth.uid())
  with check (current_staff_role() = 'waiter');

-- ("anyone can read tables" from migration 0001 is unchanged — table
-- number/section/status must stay publicly readable for the guest QR menu.)

-- ---- 3. Scope `orders` reads/writes: manager/admin, order owner, or assigned waiter ----
drop policy if exists "orders visible to owner or staff" on orders;
create policy "orders visible to owner manager or assigned waiter" on orders
  for select using (
    customer_session_id = auth.uid()::text
    or is_manager_or_admin()
    or waiter_id = auth.uid()
  );

drop policy if exists "owner or staff update orders" on orders;
create policy "owner manager or assigned waiter update orders" on orders
  for update using (
    customer_session_id = auth.uid()::text
    or is_manager_or_admin()
    or waiter_id = auth.uid()
  );

-- ---- 4. Same scoping for order_items, via their parent order ----
drop policy if exists "order items follow parent order" on order_items;
create policy "order items follow parent order" on order_items
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (
          o.customer_session_id = auth.uid()::text
          or is_manager_or_admin()
          or o.waiter_id = auth.uid()
        )
    )
  );

drop policy if exists "staff update order items" on order_items;
create policy "manager or assigned waiter update order items" on order_items
  for update using (
    is_manager_or_admin()
    or exists (
      select 1 from orders o
      where o.id = order_items.order_id and o.waiter_id = auth.uid()
    )
  );
