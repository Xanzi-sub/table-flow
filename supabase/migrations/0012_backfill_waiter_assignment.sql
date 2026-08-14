-- ============================================================================
-- Bug found while testing: admin's "Tables & QR" manager creates tables via
-- createTable() with no waiter at all (only the QR-scan binding flow calls
-- assign_table(), which does auto-assign). When a customer then places the
-- first order on one of those tables, the BEFORE INSERT trigger from
-- migration 0011 stamped orders.waiter_id from the table's current_waiter_id
-- — which was still null — so the order (and the table itself) stayed
-- unassigned forever, even though a waiter was on duty.
--
-- Fix: the same trigger now also backfills the table's current_waiter_id
-- (round-robin via assign_next_waiter()) the first time it gets an order,
-- then stamps the order from that freshly-assigned value — both in one
-- atomic BEFORE INSERT step, so ordering is never an issue.
-- ============================================================================

create or replace function set_order_waiter_from_table()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.waiter_id is null then
    update tables
    set current_waiter_id = coalesce(current_waiter_id, assign_next_waiter())
    where id = new.table_id
    returning current_waiter_id into new.waiter_id;
  end if;
  return new;
end;
$$;

-- One-time backfill for tables/orders already stuck unassigned from before this fix.
update tables
set current_waiter_id = assign_next_waiter()
where current_waiter_id is null
  and status <> 'vacant';

update orders o
set waiter_id = t.current_waiter_id
from tables t
where o.table_id = t.id
  and o.waiter_id is null
  and t.current_waiter_id is not null
  and o.status in ('pending', 'preparing', 'served');
