create or replace function fanout_operational_notification_to_managers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_role user_role;
begin
  if new.type not in ('new_order', 'waiter_call', 'bill_requested', 'order_cancelled') then
    return new;
  end if;

  select role into v_recipient_role
  from staff_profiles
  where id = new.recipient_staff_id;

  if v_recipient_role not in ('waiter') then
    return new;
  end if;

  insert into staff_notifications(
    venue_id,
    recipient_staff_id,
    type,
    title,
    body,
    table_id,
    order_id,
    metadata,
    event_key,
    created_at
  )
  select
    new.venue_id,
    staff.id,
    new.type,
    new.title,
    new.body,
    new.table_id,
    new.order_id,
    new.metadata,
    new.event_key || ':manager:' || staff.id,
    new.created_at
  from staff_profiles staff
  where staff.role in ('manager', 'admin')
    and staff.id <> new.recipient_staff_id
  on conflict do nothing;

  return new;
end;
$$;

create trigger trg_fanout_operational_notification_to_managers
  after insert on staff_notifications
  for each row execute function fanout_operational_notification_to_managers();

-- Make recent unresolved alerts visible immediately to managers/admins after
-- this migration, without generating duplicates on future retries.
insert into staff_notifications(
  venue_id,
  recipient_staff_id,
  type,
  title,
  body,
  table_id,
  order_id,
  metadata,
  event_key,
  created_at
)
select
  source.venue_id,
  manager.id,
  source.type,
  source.title,
  source.body,
  source.table_id,
  source.order_id,
  source.metadata,
  source.event_key || ':manager:' || manager.id,
  source.created_at
from staff_notifications source
join staff_profiles recipient on recipient.id = source.recipient_staff_id
cross join staff_profiles manager
where recipient.role = 'waiter'
  and manager.role in ('manager', 'admin')
  and source.type in ('new_order', 'waiter_call', 'bill_requested', 'order_cancelled')
  and source.created_at >= now() - interval '24 hours'
on conflict do nothing;
