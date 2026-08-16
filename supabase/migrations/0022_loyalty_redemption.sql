alter table orders
  add column if not exists loyalty_points_redeemed int not null default 0,
  add column if not exists loyalty_discount_amount numeric not null default 0;

create unique index if not exists loyalty_ledger_order_redeemed_unique
  on loyalty_ledger(order_id, entry_type)
  where order_id is not null and entry_type = 'redeemed';

create or replace function apply_loyalty_redemption(
  p_order_id uuid,
  p_points int
)
returns numeric
language plpgsql
security definer
as $$
declare
  v_order orders;
  v_profile customer_profiles;
  v_threshold int;
  v_reward_value numeric;
  v_units int;
  v_discount numeric;
begin
  if p_points <= 0 then
    return 0;
  end if;

  select * into v_order
  from orders
  where id = p_order_id
    and customer_session_id = auth.uid()::text
  for update;

  if v_order.id is null or v_order.customer_id is null then
    raise exception 'Order is not eligible for loyalty redemption';
  end if;

  if v_order.loyalty_points_redeemed > 0 then
    raise exception 'Loyalty reward already applied to this order';
  end if;

  select * into v_profile
  from customer_profiles
  where id = v_order.customer_id
  for update;

  select loyalty_reward_threshold, loyalty_reward_value
  into v_threshold, v_reward_value
  from venue_settings
  limit 1;

  if v_threshold is null or v_threshold <= 0 or v_reward_value is null or v_reward_value <= 0 then
    raise exception 'Loyalty rewards are not configured';
  end if;

  if p_points % v_threshold <> 0 then
    raise exception 'Points must be redeemed in configured reward increments';
  end if;

  if v_profile.loyalty_points < p_points then
    raise exception 'Insufficient loyalty points';
  end if;

  v_units := p_points / v_threshold;
  v_discount := v_units * v_reward_value;

  if v_discount > v_order.total_amount then
    raise exception 'Reward value exceeds this order total';
  end if;

  update customer_profiles
  set loyalty_points = loyalty_points - p_points
  where id = v_order.customer_id;

  update orders
  set loyalty_points_redeemed = p_points,
      loyalty_discount_amount = v_discount,
      total_amount = total_amount - v_discount
  where id = p_order_id;

  insert into loyalty_ledger(customer_id, order_id, points, entry_type, description)
  values (v_order.customer_id, v_order.id, -p_points, 'redeemed', 'Points redeemed against order')
  on conflict (order_id, entry_type) where order_id is not null and entry_type = 'redeemed'
  do nothing;

  return v_discount;
end;
$$;
