create sequence if not exists support_ticket_number_seq start 1;

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique not null default ('TF-' || lpad(nextval('support_ticket_number_seq')::text, 6, '0')),
  venue_id uuid references venue_settings(id) on delete set null,
  venue_name text not null,
  subject text not null,
  description text not null,
  category text not null check (category in ('technical', 'billing', 'menu', 'orders', 'payments', 'whatsapp', 'account', 'other')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_on_venue', 'resolved', 'closed')),
  created_by uuid references staff_profiles(id) on delete set null,
  external_assignee_id text,
  external_assignee_name text,
  external_reference text,
  resolution_summary text,
  last_reply_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_type text not null check (author_type in ('venue', 'support', 'system')),
  author_staff_id uuid references staff_profiles(id) on delete set null,
  author_name text not null,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz default now()
);

create table support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  event_type text not null,
  actor_type text not null check (actor_type in ('venue', 'support', 'system')),
  actor_id text,
  actor_name text,
  old_value text,
  new_value text,
  created_at timestamptz default now()
);

create index idx_support_tickets_status_updated on support_tickets(status, updated_at desc);
create index idx_support_tickets_priority_status on support_tickets(priority, status);
create index idx_support_ticket_messages_ticket_created on support_ticket_messages(ticket_id, created_at);
create index idx_support_ticket_events_ticket_created on support_ticket_events(ticket_id, created_at);

create trigger trg_support_tickets_updated_at
  before update on support_tickets
  for each row execute function set_updated_at();

create or replace function log_support_ticket_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status is distinct from old.status then
    insert into support_ticket_events(ticket_id, event_type, actor_type, actor_id, old_value, new_value)
    values (new.id, 'status_changed', case when auth.uid() is null then 'support' else 'venue' end, auth.uid()::text, old.status, new.status);
  end if;
  if new.priority is distinct from old.priority then
    insert into support_ticket_events(ticket_id, event_type, actor_type, actor_id, old_value, new_value)
    values (new.id, 'priority_changed', case when auth.uid() is null then 'support' else 'venue' end, auth.uid()::text, old.priority, new.priority);
  end if;
  if new.external_assignee_id is distinct from old.external_assignee_id then
    insert into support_ticket_events(ticket_id, event_type, actor_type, actor_id, old_value, new_value)
    values (new.id, 'assigned', case when auth.uid() is null then 'support' else 'venue' end, auth.uid()::text, old.external_assignee_id, new.external_assignee_id);
  end if;
  return new;
end;
$$;

create trigger trg_support_ticket_events
  after update on support_tickets
  for each row execute function log_support_ticket_update();

create or replace function touch_support_ticket_from_message()
returns trigger
language plpgsql
security definer
as $$
begin
  update support_tickets
  set last_reply_at = new.created_at,
      status = case
        when new.author_type = 'support' and status not in ('resolved', 'closed') then 'waiting_on_venue'
        when new.author_type = 'venue' and status = 'waiting_on_venue' then 'in_progress'
        else status
      end
  where id = new.ticket_id;
  return new;
end;
$$;

create trigger trg_support_message_touch_ticket
  after insert on support_ticket_messages
  for each row execute function touch_support_ticket_from_message();

alter table support_tickets enable row level security;
alter table support_ticket_messages enable row level security;
alter table support_ticket_events enable row level security;

create policy "managers read support tickets" on support_tickets
  for select using (is_manager_or_admin());
create policy "managers create support tickets" on support_tickets
  for insert with check (is_manager_or_admin() and created_by = auth.uid());
create policy "managers update support tickets" on support_tickets
  for update using (is_manager_or_admin()) with check (is_manager_or_admin());

create policy "managers read support messages" on support_ticket_messages
  for select using (
    is_manager_or_admin()
    and (not is_internal or author_type = 'venue')
  );
create policy "managers create venue messages" on support_ticket_messages
  for insert with check (
    is_manager_or_admin()
    and author_type = 'venue'
    and author_staff_id = auth.uid()
    and is_internal = false
  );

create policy "managers read support events" on support_ticket_events
  for select using (is_manager_or_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'support_tickets'
  ) then
    alter publication supabase_realtime add table support_tickets;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'support_ticket_messages'
  ) then
    alter publication supabase_realtime add table support_ticket_messages;
  end if;
end;
$$;
