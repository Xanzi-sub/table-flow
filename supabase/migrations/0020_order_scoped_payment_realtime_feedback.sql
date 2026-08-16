-- Pay exactly one order. Multiple orders at the same table remain independent.
create or replace function mark_order_paid_with_loyalty(
  p_order_id uuid,
  p_method payment_method,
  p_tip_amount numeric default 0
)
returns void
language plpgsql
security definer
as $$
declare
  v_order orders;
  v_rate numeric;
  v_points int;
begin
  select * into v_order
  from orders
  where id = p_order_id
    and status in ('pending', 'preparing', 'served');

  if v_order.id is null then
    raise exception 'Open order not found';
  end if;

  if not is_manager_or_admin()
    and not (
      is_staff()
      and (
        v_order.waiter_id = auth.uid()
        or exists (
          select 1 from tables t
          where t.id = v_order.table_id
            and t.current_waiter_id = auth.uid()
        )
      )
    ) then
    raise exception 'You cannot record payment for this order';
  end if;

  update orders
  set payment_status = 'paid',
      payment_method = p_method,
      tip_amount = greatest(coalesce(p_tip_amount, 0), 0)
  where id = p_order_id;

  if v_order.customer_id is not null then
    select coalesce(loyalty_points_per_rand, 1) into v_rate
    from venue_settings
    limit 1;

    v_points := floor(v_order.total_amount * coalesce(v_rate, 1))::int;

    insert into loyalty_ledger(customer_id, order_id, points, entry_type, description)
    values (v_order.customer_id, v_order.id, v_points, 'earned', 'Points earned from paid order')
    on conflict (order_id, entry_type) where order_id is not null and entry_type = 'earned'
    do nothing;

    if found then
      update customer_profiles
      set loyalty_points = coalesce(loyalty_points, 0) + v_points
      where id = v_order.customer_id;
    end if;
  end if;
end;
$$;

-- Feedback belongs to the authenticated anonymous/customer session that owns
-- the order. Allow a customer to revise their one feedback row for that order.
drop policy if exists "customers submit own order feedback" on order_feedback;
drop policy if exists "customers read own order feedback" on order_feedback;

create policy "customers submit own order feedback" on order_feedback
  for insert with check (
    customer_id = auth.uid()
    and exists (
      select 1 from orders o
      where o.id = order_feedback.order_id
        and o.customer_session_id = auth.uid()::text
    )
  );

create policy "customers read own order feedback" on order_feedback
  for select using (customer_id = auth.uid() or is_manager_or_admin());

create policy "customers update own order feedback" on order_feedback
  for update
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());
