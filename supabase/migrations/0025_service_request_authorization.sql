create or replace function request_table_service(p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from orders
    where table_id = p_table_id
      and customer_session_id = auth.uid()::text
      and status in ('pending', 'preparing', 'served')
  ) then
    raise exception 'No active order for this table';
  end if;

  update tables
  set status = 'awaiting_bill',
      updated_at = now(),
      service_requested_at = now()
  where id = p_table_id;

  if not found then
    raise exception 'Table not found';
  end if;
end;
$$;
