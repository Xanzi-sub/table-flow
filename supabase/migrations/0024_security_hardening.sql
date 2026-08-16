create table security_rate_limits (
  scope text not null,
  identifier_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  primary key (scope, identifier_hash, window_started_at)
);

create index idx_security_rate_limits_expiry on security_rate_limits(expires_at);

alter table security_rate_limits enable row level security;

create or replace function consume_rate_limit(
  p_scope text,
  p_identifier_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started timestamptz;
  v_expires_at timestamptz;
  v_count integer;
begin
  if p_scope is null or length(p_scope) not between 1 and 80
    or p_identifier_hash is null or length(p_identifier_hash) <> 64
    or p_limit not between 1 and 10000
    or p_window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate limit configuration';
  end if;

  v_window_started := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_expires_at := v_window_started + make_interval(secs => p_window_seconds);

  insert into security_rate_limits(
    scope,
    identifier_hash,
    window_started_at,
    request_count,
    expires_at
  ) values (
    p_scope,
    p_identifier_hash,
    v_window_started,
    1,
    v_expires_at
  )
  on conflict (scope, identifier_hash, window_started_at)
  do update set request_count = security_rate_limits.request_count + 1
  returning request_count into v_count;

  if random() < 0.01 then
    delete from security_rate_limits where expires_at < v_now - interval '1 hour';
  end if;

  return query select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    greatest(ceil(extract(epoch from v_expires_at - v_now))::integer, 1);
end;
$$;

revoke all on table security_rate_limits from public, anon, authenticated;
revoke all on function consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function consume_rate_limit(text, text, integer, integer) to service_role;

alter table venue_settings
  add constraint venue_settings_vat_percentage_range
    check (vat_percentage between 0 and 100) not valid,
  add constraint venue_settings_tip_percentage_range
    check (tip_percentage between 0 and 100) not valid,
  add constraint venue_settings_loyalty_rate_range
    check (loyalty_points_per_rand between 0 and 1000) not valid,
  add constraint venue_settings_loyalty_threshold_range
    check (loyalty_reward_threshold between 1 and 1000000) not valid,
  add constraint venue_settings_loyalty_value_range
    check (loyalty_reward_value between 0 and 1000000) not valid;

alter table orders
  add constraint orders_tip_amount_range
    check (tip_amount between 0 and 1000000) not valid;

create or replace function apply_loyalty_redemption(
  p_order_id uuid,
  p_points int
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_profile customer_profiles;
  v_threshold int;
  v_reward_value numeric;
  v_units int;
  v_discount numeric;
begin
  if p_points is null or p_points <= 0 or p_points > 1000000 then
    raise exception 'Invalid loyalty points amount';
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

create or replace function mark_order_paid_with_loyalty(
  p_order_id uuid,
  p_method payment_method,
  p_tip_amount numeric default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_rate numeric;
  v_points int;
begin
  if p_tip_amount is null or p_tip_amount < 0 or p_tip_amount > 1000000 then
    raise exception 'Invalid tip amount';
  end if;

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
      tip_amount = p_tip_amount
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
