alter table staff_devices
  drop constraint if exists staff_devices_platform_check;

alter table staff_devices
  add constraint staff_devices_platform_check
  check (platform in ('android', 'ios', 'web'));
