-- ============================================================================
-- TableFlow — Venue onboarding: venue settings + staff invite/claim flow
-- ============================================================================

-- ============ VENUE SETTINGS (singleton) ============
create table venue_settings (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    logo_url text,
    address text,
    phone text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Only one venue row ever exists (single-tenant deployment).
create unique index venue_settings_singleton on venue_settings ((true));

create trigger trg_venue_settings_updated_at
  before update on venue_settings
  for each row execute function set_updated_at();

alter table venue_settings enable row level security;

-- Public can read (venue name/logo shown on the customer menu header).
create policy "anyone can read venue settings" on venue_settings
  for select using (true);

create policy "admins manage venue settings" on venue_settings
  for insert with check (is_manager_or_admin());

create policy "admins update venue settings" on venue_settings
  for update using (is_manager_or_admin());

-- ============ STAFF PROFILE CONTACT INFO ============
-- Denormalized copy of the invite's email/phone so the team list can show
-- contact details without ever needing client-side access to auth.users.
alter table staff_profiles add column email text;
alter table staff_profiles add column phone text;

-- ============ STAFF INVITES (pre-registration, claimed on first login) ============
create table staff_invites (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    full_name text not null,
    phone text,
    role user_role not null default 'waiter',
    invited_by uuid references staff_profiles(id) on delete set null,
    claimed_by uuid references staff_profiles(id) on delete set null,
    claimed_at timestamptz,
    created_at timestamptz default now()
);

create index idx_staff_invites_email on staff_invites (lower(email));

alter table staff_invites enable row level security;

-- Only managers/admins can see/manage the invite list. Looking an invite up by
-- email during signup is done via the claim_staff_invite() function below
-- (SECURITY DEFINER), not a public SELECT policy.
create policy "managers read invites" on staff_invites
  for select using (is_manager_or_admin());

create policy "managers create invites" on staff_invites
  for insert with check (is_manager_or_admin());

create policy "managers update invites" on staff_invites
  for update using (is_manager_or_admin());

create policy "managers delete invites" on staff_invites
  for delete using (is_manager_or_admin());

-- ============ BOOTSTRAP THE FIRST ADMIN ============
-- Allows exactly one self-service admin signup when no staff exist yet.
-- Every subsequent staff_profiles row must come through claim_staff_invite().
create policy "first admin bootstrap" on staff_profiles
  for insert with check (
    role = 'admin' and not exists (select 1 from staff_profiles)
  );

-- ============ CLAIM AN INVITE ON FIRST LOGIN ============
-- Called right after a new auth user signs up. Links them to their pending
-- invite (matched by email) and creates their staff_profiles row.
create or replace function claim_staff_invite(p_user_id uuid, p_email text)
returns staff_profiles
language plpgsql
security definer
as $$
declare
  v_invite staff_invites;
  v_profile staff_profiles;
begin
  select * into v_invite
  from staff_invites
  where lower(email) = lower(p_email) and claimed_by is null
  limit 1;

  if v_invite.id is null then
    raise exception 'No pending invite found for %. Ask your manager to add you first.', p_email;
  end if;

  insert into staff_profiles (id, full_name, role, email, phone)
  values (p_user_id, v_invite.full_name, v_invite.role, v_invite.email, v_invite.phone)
  returning * into v_profile;

  update staff_invites
  set claimed_by = p_user_id, claimed_at = now()
  where id = v_invite.id;

  return v_profile;
end;
$$;
