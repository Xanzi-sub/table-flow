create table if not exists order_feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade not null unique,
  customer_id uuid references customer_profiles(id) on delete cascade not null,
  table_id uuid references tables(id) on delete set null,
  waiter_id uuid references staff_profiles(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  recovery_status text not null default 'open', -- open | contacted | resolved
  recovery_notes text,
  created_at timestamptz default now(),
  resolved_at timestamptz,
  resolved_by uuid references staff_profiles(id)
);

alter table order_feedback enable row level security;

create policy "customers submit own order feedback" on order_feedback
  for insert with check (
    customer_id = auth.uid()
    and exists (
      select 1 from orders o
      where o.id = order_feedback.order_id
        and o.customer_id = auth.uid()
    )
  );

create policy "customers read own order feedback" on order_feedback
  for select using (customer_id = auth.uid() or is_manager_or_admin());

create policy "managers update feedback recovery" on order_feedback
  for update using (is_manager_or_admin());

create index if not exists idx_order_feedback_rating_created
  on order_feedback(rating, created_at desc);
