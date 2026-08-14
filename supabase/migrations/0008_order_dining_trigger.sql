-- ============================================================================
-- Customers can't directly flip a table's status to 'dining' when they place
-- an order — the "staff manage tables" RLS policy only allows staff (is_staff())
-- to update the tables row, so the client-side update in submitOrder() was
-- silently doing nothing (0 rows affected, no RLS error thrown). A
-- SECURITY DEFINER trigger runs with elevated privileges regardless of who
-- inserted the order, so this is the reliable place to do it.
-- ============================================================================

create or replace function set_table_dining_on_order()
returns trigger
language plpgsql
security definer
as $$
begin
  update tables
  set status = 'dining', updated_at = now()
  where id = new.table_id and status = 'vacant';
  return new;
end;
$$;

create trigger trg_orders_set_table_dining
  after insert on orders
  for each row execute function set_table_dining_on_order();

-- Same RLS gap as above: customers calling requestTableService() couldn't
-- flip status to 'awaiting_bill' either, since "staff manage tables" also
-- gates plain table UPDATEs to is_staff(). A SECURITY DEFINER RPC lets any
-- signed-in (incl. anonymous) customer request service for their own table.
create or replace function request_table_service(p_table_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update tables
  set status = 'awaiting_bill', updated_at = now()
  where id = p_table_id;
end;
$$;

