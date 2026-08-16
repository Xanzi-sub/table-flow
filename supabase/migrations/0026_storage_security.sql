update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
where id = 'menu-photos';

drop policy if exists "staff upload menu photos" on storage.objects;
drop policy if exists "staff update menu photos" on storage.objects;
drop policy if exists "staff delete menu photos" on storage.objects;

create policy "managers upload menu photos"
  on storage.objects for insert
  with check (bucket_id = 'menu-photos' and is_manager_or_admin());

create policy "managers update menu photos"
  on storage.objects for update
  using (bucket_id = 'menu-photos' and is_manager_or_admin())
  with check (bucket_id = 'menu-photos' and is_manager_or_admin());

create policy "managers delete menu photos"
  on storage.objects for delete
  using (bucket_id = 'menu-photos' and is_manager_or_admin());
