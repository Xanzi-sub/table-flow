-- ============================================================================
-- CRITICAL FIX: "first admin bootstrap" policy's `not exists (select 1 from
-- staff_profiles)` subquery is itself subject to staff_profiles' own RLS
-- ("staff can read own profile": id = auth.uid() or is_manager_or_admin()).
-- Any brand-new user (including an invited waiter/manager who hasn't claimed
-- their invite yet) can't see ANY existing rows under that policy, so the
-- subquery always evaluates to "no rows" from their perspective — meaning
-- "not exists" was always true for them, letting every invited staff member
-- insert themselves as role='admin' instead of going through
-- claim_staff_invite(). This silently gave every invited user admin rights
-- and sent them to /onboarding/venue instead of claiming their real role.
--
-- Fix: do the emptiness check in a SECURITY DEFINER function so it sees the
-- true state of the table, not the RLS-filtered view of the calling user.
-- ============================================================================

create or replace function staff_profiles_is_empty()
returns boolean
language sql
security definer
stable
as $$
  select not exists (select 1 from staff_profiles);
$$;

drop policy if exists "first admin bootstrap" on staff_profiles;
create policy "first admin bootstrap" on staff_profiles
  for insert with check (
    role = 'admin' and staff_profiles_is_empty()
  );
