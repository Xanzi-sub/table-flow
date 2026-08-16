create table customer_device_identities (
  device_id uuid primary key,
  secret_hash text not null,
  customer_id uuid not null references customer_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_device_identities_customer on customer_device_identities(customer_id);
alter table customer_device_identities enable row level security;
-- Direct access is intentionally denied. Recovery only happens through the RPC.

create trigger trg_customer_device_identities_updated_at
  before update on customer_device_identities
  for each row execute function set_updated_at();

create or replace function recover_customer_device(
  p_device_id uuid,
  p_recovery_secret text,
  p_full_name text default null,
  p_legacy_customer_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_current_id uuid := auth.uid();
  v_identity customer_device_identities;
  v_old_profile customer_profiles;
  v_current_profile customer_profiles;
  v_clean_name text := nullif(trim(p_full_name), '');
  v_recovered boolean := false;
begin
  if v_current_id is null then raise exception 'Customer session required'; end if;
  if p_device_id is null or length(p_recovery_secret) < 32 or length(p_recovery_secret) > 256 then
    raise exception 'Invalid recovery credentials';
  end if;
  if v_clean_name is not null and length(v_clean_name) > 120 then
    raise exception 'Invalid customer name';
  end if;

  select * into v_identity
  from customer_device_identities
  where device_id = p_device_id
  for update;

  if v_identity.device_id is null then
    -- One-time bridge for installations created before recovery secrets existed.
    -- It requires possession of the cached legacy UUID and its exact cached name.
    if p_legacy_customer_id is not null
      and p_legacy_customer_id <> v_current_id
      and p_legacy_customer_id = p_device_id
      and v_clean_name is not null then
      select * into v_old_profile from customer_profiles where id = p_legacy_customer_id for update;
      if v_old_profile.id is not null and lower(trim(coalesce(v_old_profile.full_name, ''))) = lower(v_clean_name) then
        insert into customer_device_identities(device_id, secret_hash, customer_id)
        values (p_device_id, encode(digest(p_recovery_secret, 'sha256'), 'hex'), p_legacy_customer_id);
        v_identity.device_id := p_device_id;
        v_identity.customer_id := p_legacy_customer_id;
        v_identity.secret_hash := encode(digest(p_recovery_secret, 'sha256'), 'hex');
      end if;
    end if;

    if v_identity.device_id is null then
      insert into customer_profiles(id, full_name)
      values (v_current_id, v_clean_name)
      on conflict (id) do update set full_name = coalesce(excluded.full_name, customer_profiles.full_name)
      returning * into v_current_profile;

      insert into customer_device_identities(device_id, secret_hash, customer_id)
      values (p_device_id, encode(digest(p_recovery_secret, 'sha256'), 'hex'), v_current_id)
      returning * into v_identity;
    end if;
  end if;

  if v_identity.secret_hash <> encode(digest(p_recovery_secret, 'sha256'), 'hex') then
    raise exception 'Invalid recovery credentials';
  end if;

  if v_identity.customer_id <> v_current_id then
    select * into v_old_profile from customer_profiles where id = v_identity.customer_id for update;

    if v_old_profile.id is not null then
      insert into customer_profiles(id, full_name, loyalty_points, whatsapp_opt_in, consent_timestamp)
      values (
        v_current_id,
        coalesce(v_clean_name, v_old_profile.full_name),
        coalesce(v_old_profile.loyalty_points, 0),
        v_old_profile.whatsapp_opt_in,
        v_old_profile.consent_timestamp
      )
      on conflict (id) do update set
        full_name = coalesce(v_clean_name, customer_profiles.full_name, v_old_profile.full_name),
        loyalty_points = greatest(customer_profiles.loyalty_points, v_old_profile.loyalty_points),
        whatsapp_opt_in = customer_profiles.whatsapp_opt_in or v_old_profile.whatsapp_opt_in,
        consent_timestamp = coalesce(customer_profiles.consent_timestamp, v_old_profile.consent_timestamp);

      update orders
      set customer_session_id = v_current_id::text, customer_id = v_current_id
      where customer_session_id = v_identity.customer_id::text or customer_id = v_identity.customer_id;
      update loyalty_ledger set customer_id = v_current_id where customer_id = v_identity.customer_id;
      update order_feedback set customer_id = v_current_id where customer_id = v_identity.customer_id;
      update customer_devices set customer_session_id = v_current_id::text where customer_session_id = v_identity.customer_id::text;
      update customer_notifications set customer_session_id = v_current_id::text where customer_session_id = v_identity.customer_id::text;
      update customer_device_identities set customer_id = v_current_id where customer_id = v_identity.customer_id;

      if v_old_profile.phone_number is not null then
        update customer_profiles set phone_number = null where id = v_old_profile.id;
        update customer_profiles set phone_number = v_old_profile.phone_number where id = v_current_id;
      end if;
      delete from customer_profiles where id = v_old_profile.id;
      v_recovered := true;
    else
      update customer_device_identities set customer_id = v_current_id where device_id = p_device_id;
    end if;
  else
    insert into customer_profiles(id, full_name)
    values (v_current_id, v_clean_name)
    on conflict (id) do update set full_name = coalesce(excluded.full_name, customer_profiles.full_name);
  end if;

  select * into v_current_profile from customer_profiles where id = v_current_id;
  return jsonb_build_object(
    'customer_id', v_current_profile.id,
    'full_name', v_current_profile.full_name,
    'loyalty_points', coalesce(v_current_profile.loyalty_points, 0),
    'recovered', v_recovered
  );
end;
$$;

revoke all on function recover_customer_device(uuid, text, text, uuid) from public, anon;
grant execute on function recover_customer_device(uuid, text, text, uuid) to authenticated;

create or replace function validate_order_customer_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_session_id <> auth.uid()::text
    or (new.customer_id is not null and new.customer_id <> auth.uid()) then
    raise exception 'Invalid customer identity';
  end if;
  return new;
end;
$$;

create trigger trg_validate_order_customer_identity
  before insert or update of customer_session_id, customer_id on orders
  for each row execute function validate_order_customer_identity();
