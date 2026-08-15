create table menu_specials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  kind text not null check (kind in ('item_discount', 'combo')),
  item_ids uuid[] not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed_price')),
  discount_value numeric not null check (discount_value >= 0),
  status menu_item_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order int not null default 0,
  created_by uuid references staff_profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint menu_specials_has_items check (cardinality(item_ids) > 0),
  constraint menu_specials_combo_has_pair check (kind <> 'combo' or cardinality(item_ids) >= 2),
  constraint menu_specials_dates_valid check (starts_at is null or ends_at is null or starts_at < ends_at),
  constraint menu_specials_percentage_valid check (discount_type <> 'percentage' or discount_value between 0 and 100)
);

create trigger trg_menu_specials_updated_at
  before update on menu_specials
  for each row execute function set_updated_at();

create index idx_menu_specials_status_dates on menu_specials(status, starts_at, ends_at);

alter table menu_specials enable row level security;

create policy "public reads active menu specials" on menu_specials
  for select using (
    is_staff()
    or (
      status = 'live'
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
    )
  );

create policy "managers create menu specials" on menu_specials
  for insert with check (is_manager_or_admin());

create policy "managers update menu specials" on menu_specials
  for update using (is_manager_or_admin());

create policy "managers delete menu specials" on menu_specials
  for delete using (is_manager_or_admin());

alter table order_items add column if not exists bundle_id uuid;
alter table order_items add column if not exists special_id uuid references menu_specials(id) on delete set null;
alter table order_items add column if not exists special_name text;

create index if not exists idx_order_items_special_id on order_items(special_id);
create index if not exists idx_order_items_bundle_id on order_items(bundle_id);
