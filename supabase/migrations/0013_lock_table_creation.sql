-- ============================================================================
-- Table creation/binding is a manager/admin-only workflow (waiters no longer
-- reach /staff/assign-table at all — see middleware.ts + its layout guard).
-- Enforce the same rule at the DB layer, not just in the UI.
-- ============================================================================

create or replace function assign_table(
  p_qr_identifier text,
  p_table_number int,
  p_section text default null,
  p_waiter_id uuid default null
)
returns tables
language plpgsql
security definer
as $$
declare
  v_waiter_id uuid;
  v_table tables;
begin
  if not is_manager_or_admin() then
    raise exception 'Only managers/admins can create or bind tables';
  end if;

  v_waiter_id := coalesce(p_waiter_id, assign_next_waiter());

  insert into tables (qr_identifier, table_number, section, current_waiter_id, status)
  values (p_qr_identifier, p_table_number, p_section, v_waiter_id, 'dining')
  on conflict (qr_identifier)
  do update set
    table_number = excluded.table_number,
    section = coalesce(excluded.section, tables.section),
    current_waiter_id = excluded.current_waiter_id,
    updated_at = now()
  returning * into v_table;

  return v_table;
end;
$$;

-- Lets the admin Staff page reflect on/off-duty toggles live instead of on refresh.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'staff_profiles'
  ) then
    alter publication supabase_realtime add table staff_profiles;
  end if;
end;
$$;

