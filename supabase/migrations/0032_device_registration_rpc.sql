create or replace function register_staff_device(
  p_platform text,
  p_push_token text,
  p_device_identifier text,
  p_app_version text default null
)
returns staff_devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device staff_devices;
  v_venue_id uuid;
begin
  if auth.uid() is null or not exists (select 1 from staff_profiles where id = auth.uid()) then
    raise exception 'Authenticated staff account required';
  end if;
  if p_platform not in ('android', 'ios', 'web') then raise exception 'Invalid platform'; end if;
  if length(p_push_token) not between 10 and 4096 then raise exception 'Invalid push token'; end if;
  if length(p_device_identifier) not between 1 and 255 then raise exception 'Invalid device identifier'; end if;
  if p_app_version is not null and length(p_app_version) > 100 then raise exception 'Invalid app version'; end if;

  select id into v_venue_id from venue_settings limit 1;

  -- A browser push subscription belongs to whichever staff account is
  -- currently signed in on that browser profile. Remove stale ownership and
  -- token-refresh rows before inserting the current authoritative record.
  delete from staff_devices
  where (platform = p_platform and push_token = p_push_token)
     or (staff_id = auth.uid() and device_identifier = p_device_identifier);

  insert into staff_devices(
    staff_id, venue_id, platform, push_token, device_identifier, app_version,
    is_active, last_seen_at
  ) values (
    auth.uid(), v_venue_id, p_platform, p_push_token, p_device_identifier,
    p_app_version, true, now()
  )
  returning * into v_device;

  return v_device;
end;
$$;

grant execute on function register_staff_device(text, text, text, text) to authenticated;
