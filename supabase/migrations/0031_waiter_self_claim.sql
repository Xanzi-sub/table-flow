create or replace function claim_table_assignment(p_table_id uuid)
returns tables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile staff_profiles;
  v_table tables;
begin
  select * into v_profile
  from staff_profiles
  where id = auth.uid();

  if v_profile.id is null or v_profile.role <> 'waiter' then
    raise exception 'Only waiters can claim a table';
  end if;
  if not v_profile.is_checked_in then
    raise exception 'Go on duty before claiming a table';
  end if;

  select * into v_table
  from tables
  where id = p_table_id
  for update;

  if v_table.id is null then raise exception 'Table not found'; end if;
  if v_table.current_waiter_id is not null and v_table.current_waiter_id <> auth.uid() then
    raise exception 'This table is already assigned to another waiter';
  end if;

  if v_table.current_waiter_id is null then
    update tables
    set current_waiter_id = auth.uid(), updated_at = now()
    where id = p_table_id
    returning * into v_table;

    update orders
    set waiter_id = auth.uid()
    where table_id = p_table_id
      and waiter_id is null
      and status in ('pending', 'preparing', 'served');
  end if;

  return v_table;
end;
$$;

grant execute on function claim_table_assignment(uuid) to authenticated;

create or replace function fanout_unassigned_notification_to_waiters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_role user_role;
  v_reference text;
begin
  if new.type <> 'unassigned_order' then return new; end if;
  select role into v_recipient_role from staff_profiles where id = new.recipient_staff_id;
  if v_recipient_role not in ('manager', 'admin') then return new; end if;

  v_reference := coalesce(new.order_id::text, new.table_id::text, new.id::text);

  insert into staff_notifications(
    venue_id, recipient_staff_id, type, title, body, table_id, order_id,
    metadata, event_key, created_at
  )
  select
    new.venue_id, waiter.id, new.type, new.title, new.body, new.table_id,
    new.order_id, new.metadata,
    'unassigned_claim:' || v_reference || ':' || waiter.id,
    new.created_at
  from staff_profiles waiter
  where waiter.role = 'waiter' and waiter.is_checked_in = true
  on conflict do nothing;

  return new;
end;
$$;

create trigger trg_fanout_unassigned_notification_to_waiters
  after insert on staff_notifications
  for each row execute function fanout_unassigned_notification_to_waiters();

-- Historical ownership can only be inferred safely when the venue has one
-- waiter. In multi-waiter venues, leave old rows unassigned rather than guess.
do $$
declare
  v_waiter_id uuid;
begin
  if (select count(*) from staff_profiles where role = 'waiter') = 1 then
    select id into v_waiter_id from staff_profiles where role = 'waiter' limit 1;
    update orders set waiter_id = v_waiter_id where waiter_id is null;
  end if;
end;
$$;
