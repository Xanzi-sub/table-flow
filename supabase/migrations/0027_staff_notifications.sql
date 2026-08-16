create table staff_devices (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff_profiles(id) on delete cascade,
  venue_id uuid references venue_settings(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  push_token text not null,
  device_identifier text not null,
  app_version text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(platform, push_token),
  unique(staff_id, device_identifier)
);

create table staff_notifications (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venue_settings(id) on delete cascade,
  recipient_staff_id uuid not null references staff_profiles(id) on delete cascade,
  type text not null check (type in ('new_order', 'waiter_call', 'bill_requested', 'order_cancelled', 'table_assigned', 'manager_message', 'unassigned_order')),
  title text not null check (length(title) between 1 and 160),
  body text not null check (length(body) between 1 and 1000),
  table_id uuid references tables(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  event_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(recipient_staff_id, event_key)
);

create table table_service_requests (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  customer_session_id text not null,
  request_type text not null check (request_type in ('waiter_call', 'bill_requested')),
  resolved_at timestamptz,
  resolved_by uuid references staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index table_service_requests_active_unique
  on table_service_requests(table_id, request_type)
  where resolved_at is null;
create index staff_devices_active_staff on staff_devices(staff_id) where is_active;
create index staff_notifications_recipient_created on staff_notifications(recipient_staff_id, created_at desc);
create index staff_notifications_recipient_unread on staff_notifications(recipient_staff_id, created_at desc) where read_at is null;
create index table_service_requests_active on table_service_requests(table_id, created_at desc) where resolved_at is null;

create trigger trg_staff_devices_updated_at
  before update on staff_devices
  for each row execute function set_updated_at();

alter table staff_devices enable row level security;
alter table staff_notifications enable row level security;
alter table table_service_requests enable row level security;

create policy "staff manage own devices" on staff_devices
  for all using (staff_id = auth.uid()) with check (staff_id = auth.uid());

create policy "staff read own notifications" on staff_notifications
  for select using (recipient_staff_id = auth.uid());
create policy "staff update own notification reads" on staff_notifications
  for update using (recipient_staff_id = auth.uid())
  with check (recipient_staff_id = auth.uid());

create policy "customers read own service requests" on table_service_requests
  for select using (customer_session_id = auth.uid()::text);
create policy "staff read service requests" on table_service_requests
  for select using (is_staff());
create policy "staff resolve service requests" on table_service_requests
  for update using (
    is_manager_or_admin()
    or exists (
      select 1 from tables t
      where t.id = table_service_requests.table_id
        and t.current_waiter_id = auth.uid()
    )
  );

create or replace function notification_venue_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from venue_settings limit 1
$$;

create or replace function notify_order_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_number integer;
  v_recipient uuid;
  v_items integer;
begin
  select table_number, current_waiter_id into v_table_number, v_recipient
  from tables where id = new.table_id;

  select coalesce(sum(quantity), 0)::integer into v_items
  from order_items where order_id = new.id;

  if v_recipient is not null then
    insert into staff_notifications(
      venue_id, recipient_staff_id, type, title, body, table_id, order_id, event_key, metadata
    ) values (
      notification_venue_id(), v_recipient, 'new_order',
      'New order - Table ' || coalesce(v_table_number::text, '?'),
      'A new order worth R' || to_char(new.total_amount, 'FM999999990.00') || ' is waiting.',
      new.table_id, new.id, 'new_order:' || new.id,
      jsonb_build_object('route', '/staff/dashboard?tableId=' || new.table_id || '&orderId=' || new.id, 'itemCount', v_items)
    ) on conflict do nothing;
  else
    insert into staff_notifications(
      venue_id, recipient_staff_id, type, title, body, table_id, order_id, event_key, metadata
    )
    select notification_venue_id(), sp.id, 'unassigned_order',
      'Unassigned order - Table ' || coalesce(v_table_number::text, '?'),
      'A new order needs a waiter assignment.', new.table_id, new.id,
      'unassigned_order:' || new.id || ':' || sp.id,
      jsonb_build_object('route', '/staff/dashboard?tableId=' || new.table_id || '&orderId=' || new.id)
    from staff_profiles sp
    where sp.role in ('manager', 'admin')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_notify_order_created
  after insert on orders
  for each row execute function notify_order_created();

create or replace function notify_order_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_number integer;
begin
  if new.status = 'cancelled' and old.status is distinct from new.status then
    select table_number into v_table_number from tables where id = new.table_id;
    if new.waiter_id is not null then
      insert into staff_notifications(venue_id, recipient_staff_id, type, title, body, table_id, order_id, event_key, metadata)
      values (
        notification_venue_id(), new.waiter_id, 'order_cancelled',
        'Order cancelled - Table ' || coalesce(v_table_number::text, '?'),
        'An order assigned to you was cancelled.', new.table_id, new.id,
        'order_cancelled:' || new.id,
        jsonb_build_object('route', '/staff/dashboard?tableId=' || new.table_id || '&orderId=' || new.id)
      ) on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_notify_order_cancelled
  after update of status on orders
  for each row execute function notify_order_cancelled();

create or replace function request_table_assistance(p_table_id uuid, p_request_type text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_request_id uuid;
  v_table_number integer;
  v_waiter uuid;
begin
  if p_request_type not in ('waiter_call', 'bill_requested') then
    raise exception 'Invalid service request type';
  end if;

  select * into v_order from orders
  where table_id = p_table_id
    and customer_session_id = auth.uid()::text
    and status in ('pending', 'preparing', 'served')
  order by created_at desc limit 1;
  if v_order.id is null then raise exception 'No active order for this table'; end if;

  insert into table_service_requests(table_id, order_id, customer_session_id, request_type)
  values (p_table_id, v_order.id, auth.uid()::text, p_request_type)
  on conflict (table_id, request_type) where resolved_at is null
  do update set created_at = now(), customer_session_id = excluded.customer_session_id
  returning id into v_request_id;

  update tables set
    service_requested_at = now(),
    status = case when p_request_type = 'bill_requested' then 'awaiting_bill'::table_status else status end,
    updated_at = now()
  where id = p_table_id
  returning table_number, current_waiter_id into v_table_number, v_waiter;

  if v_waiter is not null then
    insert into staff_notifications(venue_id, recipient_staff_id, type, title, body, table_id, order_id, event_key, metadata)
    values (
      notification_venue_id(), v_waiter, p_request_type,
      case when p_request_type = 'bill_requested' then 'Bill requested - Table ' else 'Table needs you - Table ' end || coalesce(v_table_number::text, '?'),
      case when p_request_type = 'bill_requested' then 'The customer is ready for the bill.' else 'The customer requested assistance.' end,
      p_table_id, v_order.id, p_request_type || ':' || v_request_id,
      jsonb_build_object('route', '/staff/dashboard?tableId=' || p_table_id || '&orderId=' || v_order.id)
    ) on conflict do nothing;
  else
    insert into staff_notifications(venue_id, recipient_staff_id, type, title, body, table_id, order_id, event_key, metadata)
    select notification_venue_id(), sp.id, 'unassigned_order',
      'Unassigned request - Table ' || coalesce(v_table_number::text, '?'),
      'A customer request needs a waiter assignment.', p_table_id, v_order.id,
      'unassigned_request:' || v_request_id || ':' || sp.id,
      jsonb_build_object('route', '/staff/dashboard?tableId=' || p_table_id || '&orderId=' || v_order.id)
    from staff_profiles sp where sp.role in ('manager', 'admin')
    on conflict do nothing;
  end if;

  return v_request_id;
end;
$$;

grant execute on function request_table_assistance(uuid, text) to authenticated;

create or replace function resolve_table_service_requests(p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_manager_or_admin() and not exists (
    select 1 from tables where id = p_table_id and current_waiter_id = auth.uid()
  ) then raise exception 'Not authorized for this table'; end if;

  update table_service_requests
  set resolved_at = now(), resolved_by = auth.uid()
  where table_id = p_table_id and resolved_at is null;

  update tables set service_requested_at = null,
    status = case when status = 'awaiting_bill' then 'dining'::table_status else status end
  where id = p_table_id;
end;
$$;

grant execute on function resolve_table_service_requests(uuid) to authenticated;

create or replace function notify_table_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_waiter_id is not null and new.current_waiter_id is distinct from old.current_waiter_id then
    insert into staff_notifications(venue_id, recipient_staff_id, type, title, body, table_id, event_key, metadata)
    values (
      notification_venue_id(), new.current_waiter_id, 'table_assigned',
      'Table ' || new.table_number || ' assigned to you',
      'You are now responsible for this table.', new.id,
      'table_assigned:' || new.id || ':' || extract(epoch from now())::bigint,
      jsonb_build_object('route', '/staff/dashboard?tableId=' || new.id)
    );
  end if;
  return new;
end;
$$;

create trigger trg_notify_table_assignment
  after update of current_waiter_id on tables
  for each row execute function notify_table_assignment();

alter publication supabase_realtime add table staff_notifications;
alter publication supabase_realtime add table table_service_requests;
