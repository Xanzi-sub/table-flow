create table customer_devices (
  id uuid primary key default gen_random_uuid(),
  customer_session_id text not null,
  platform text not null default 'web' check (platform = 'web'),
  push_token text not null unique,
  device_identifier text not null,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(customer_session_id, device_identifier)
);

create table customer_notifications (
  id uuid primary key default gen_random_uuid(),
  customer_session_id text not null,
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  title text not null,
  body text not null,
  route text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(order_id, status)
);

create index customer_notifications_session_created on customer_notifications(customer_session_id, created_at desc);
create index customer_devices_session_active on customer_devices(customer_session_id) where is_active;

alter table customer_devices enable row level security;
alter table customer_notifications enable row level security;

create policy "customers manage own devices" on customer_devices
  for all using (customer_session_id = auth.uid()::text)
  with check (customer_session_id = auth.uid()::text);
create policy "customers read own notifications" on customer_notifications
  for select using (customer_session_id = auth.uid()::text);
create policy "customers update own notification reads" on customer_notifications
  for update using (customer_session_id = auth.uid()::text)
  with check (customer_session_id = auth.uid()::text);

create or replace function register_customer_device(p_push_token text, p_device_identifier text)
returns customer_devices
language plpgsql
security definer
set search_path = public
as $$
declare v_device customer_devices;
begin
  if auth.uid() is null then raise exception 'Customer session required'; end if;
  if length(p_push_token) not between 10 and 4096 or length(p_device_identifier) not between 1 and 255 then
    raise exception 'Invalid device registration';
  end if;
  delete from customer_devices
  where push_token = p_push_token
     or (customer_session_id = auth.uid()::text and device_identifier = p_device_identifier);
  insert into customer_devices(customer_session_id, push_token, device_identifier, is_active, last_seen_at)
  values (auth.uid()::text, p_push_token, p_device_identifier, true, now())
  returning * into v_device;
  return v_device;
end;
$$;
grant execute on function register_customer_device(text, text) to authenticated;

create or replace function notify_customer_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_number integer;
  v_title text;
  v_body text;
begin
  if new.status is not distinct from old.status then return new; end if;
  select table_number into v_table_number from tables where id = new.table_id;
  v_title := case new.status
    when 'preparing' then 'Your order is being prepared'
    when 'served' then 'Your order is ready'
    when 'completed' then 'Order completed'
    when 'cancelled' then 'Order cancelled'
    else 'Order updated'
  end;
  v_body := 'Table ' || coalesce(v_table_number::text, '?') || ' - ' || case new.status
    when 'preparing' then 'The kitchen has started your order.'
    when 'served' then 'Your order has been served.'
    when 'completed' then 'Thank you for visiting.'
    when 'cancelled' then 'Please speak to a staff member for help.'
    else 'Your order status changed.'
  end;
  insert into customer_notifications(customer_session_id, order_id, status, title, body, route)
  values (new.customer_session_id, new.id, new.status, v_title, v_body, '/menu/' || (select qr_identifier from tables where id = new.table_id) || '?orderId=' || new.id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger trg_notify_customer_order_status
  after update of status on orders
  for each row execute function notify_customer_order_status();

alter publication supabase_realtime add table customer_notifications;
