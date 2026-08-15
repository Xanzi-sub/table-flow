-- Configurable loyalty rules. Points are awarded only when staff records payment.
alter table venue_settings add column if not exists loyalty_points_per_rand numeric not null default 1;
alter table venue_settings add column if not exists loyalty_reward_threshold int not null default 500;
alter table venue_settings add column if not exists loyalty_reward_value numeric not null default 50;

create table if not exists loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customer_profiles(id) on delete cascade not null,
  order_id uuid references orders(id) on delete set null,
  points int not null,
  entry_type text not null default 'earned', -- earned | redeemed | adjustment
  description text,
  created_at timestamptz default now()
);

create unique index if not exists loyalty_ledger_order_earned_unique
  on loyalty_ledger(order_id, entry_type)
  where order_id is not null and entry_type = 'earned';

alter table loyalty_ledger enable row level security;

create policy "customers read own loyalty ledger" on loyalty_ledger
  for select using (customer_id = auth.uid() or is_manager_or_admin());

create policy "managers manage loyalty ledger" on loyalty_ledger
  for all using (is_manager_or_admin()) with check (is_manager_or_admin());

-- Atomic payment + tip + loyalty operation. SECURITY DEFINER is required so
-- waiters can award points without broad UPDATE access to customer_profiles.
create or replace function mark_table_paid_with_loyalty(
  p_table_id uuid,
  p_method payment_method,
  p_tip_amount numeric default 0
)
returns void
language plpgsql
security definer
as $$
declare
  v_first_order_id uuid;
  v_order record;
  v_rate numeric;
  v_points int;
begin
  if not is_staff() then
    raise exception 'Only staff can record payment';
  end if;

  select id into v_first_order_id
  from orders
  where table_id = p_table_id
    and status in ('pending', 'preparing', 'served')
  order by created_at
  limit 1;

  if v_first_order_id is null then
    raise exception 'No open orders to mark as paid';
  end if;

  update orders
  set payment_status = 'paid', payment_method = p_method
  where table_id = p_table_id
    and status in ('pending', 'preparing', 'served');

  if greatest(coalesce(p_tip_amount, 0), 0) > 0 then
    update orders
    set tip_amount = greatest(p_tip_amount, 0)
    where id = v_first_order_id;
  end if;

  select coalesce(loyalty_points_per_rand, 1) into v_rate
  from venue_settings
  limit 1;

  for v_order in
    select id, customer_id, total_amount
    from orders
    where table_id = p_table_id
      and payment_status = 'paid'
      and status in ('pending', 'preparing', 'served')
      and customer_id is not null
  loop
    v_points := floor(v_order.total_amount * v_rate)::int;

    insert into loyalty_ledger(customer_id, order_id, points, entry_type, description)
    values (v_order.customer_id, v_order.id, v_points, 'earned', 'Points earned from paid order')
    on conflict (order_id, entry_type) where order_id is not null and entry_type = 'earned'
    do nothing;

    if found then
      update customer_profiles
      set loyalty_points = coalesce(loyalty_points, 0) + v_points
      where id = v_order.customer_id;
    end if;
  end loop;
end;
$$;
