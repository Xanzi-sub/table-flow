-- ============================================================================
-- Menu category groups (Food / Drinks / etc.) — one level above categories,
-- so admins can bucket "Starters, Mains, Desserts" under Food and
-- "Beers, Wines, Cocktails" under Drinks, chosen per category or per batch.
-- ============================================================================

create table menu_category_groups (
    id uuid primary key default gen_random_uuid(),
    name text unique not null,
    sort_order int default 0,
    is_active boolean default true,
    created_at timestamptz default now()
);

alter table menu_categories add column group_id uuid references menu_category_groups(id) on delete set null;

insert into menu_category_groups (name, sort_order) values ('Food', 0), ('Drinks', 1);

alter table menu_category_groups enable row level security;

create policy "public reads active groups" on menu_category_groups
  for select using (is_active = true or is_staff());

create policy "managers manage groups" on menu_category_groups
  for insert with check (is_manager_or_admin());

create policy "managers update groups" on menu_category_groups
  for update using (is_manager_or_admin());

create policy "managers delete groups" on menu_category_groups
  for delete using (is_manager_or_admin());
