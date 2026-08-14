-- ============================================================================
-- Idempotent repair for 0005: that migration's table-create step had already
-- run against remote out-of-band, so db push failed on statement 0 and rolled
-- back everything after it (column, seed rows, RLS). This re-applies the rest
-- safely regardless of what already exists.
-- ============================================================================

alter table menu_categories add column if not exists group_id uuid references menu_category_groups(id) on delete set null;

insert into menu_category_groups (name, sort_order)
  values ('Food', 0), ('Drinks', 1)
  on conflict (name) do nothing;

alter table menu_category_groups enable row level security;

drop policy if exists "public reads active groups" on menu_category_groups;
create policy "public reads active groups" on menu_category_groups
  for select using (is_active = true or is_staff());

drop policy if exists "managers manage groups" on menu_category_groups;
create policy "managers manage groups" on menu_category_groups
  for insert with check (is_manager_or_admin());

drop policy if exists "managers update groups" on menu_category_groups;
create policy "managers update groups" on menu_category_groups
  for update using (is_manager_or_admin());

drop policy if exists "managers delete groups" on menu_category_groups;
create policy "managers delete groups" on menu_category_groups
  for delete using (is_manager_or_admin());
