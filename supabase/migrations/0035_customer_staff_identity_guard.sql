create or replace function prevent_staff_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from staff_profiles where id = new.id) then
    raise exception 'Staff accounts cannot be used as customer profiles';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_staff_customer_profile
  before insert or update of id on customer_profiles
  for each row execute function prevent_staff_customer_profile();

create or replace function start_fresh_customer_device(
  p_device_id uuid,
  p_recovery_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_current_id uuid := auth.uid();
begin
  if v_current_id is null or exists (select 1 from staff_profiles where id = v_current_id) then
    raise exception 'Anonymous customer session required';
  end if;
  if p_device_id is null or length(p_recovery_secret) < 32 or length(p_recovery_secret) > 256 then
    raise exception 'Invalid recovery credentials';
  end if;

  insert into customer_profiles(id, full_name)
  values (v_current_id, null)
  on conflict (id) do update set full_name = customer_profiles.full_name;

  insert into customer_device_identities(device_id, secret_hash, customer_id)
  values (p_device_id, encode(digest(p_recovery_secret, 'sha256'), 'hex'), v_current_id)
  on conflict (device_id) do update set
    secret_hash = excluded.secret_hash,
    customer_id = excluded.customer_id,
    updated_at = now();

  return jsonb_build_object(
    'customer_id', v_current_id,
    'full_name', null,
    'loyalty_points', 0,
    'recovered', false
  );
end;
$$;

revoke all on function start_fresh_customer_device(uuid, text) from public, anon;
grant execute on function start_fresh_customer_device(uuid, text) to authenticated;
