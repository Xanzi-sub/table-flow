-- ============================================================================
-- Storage buckets for menu photos (scanned pages + dish photos)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('menu-photos', 'menu-photos', true)
on conflict (id) do nothing;

-- Anyone can view menu photos (they're rendered on the public customer menu).
create policy "public read menu photos"
  on storage.objects for select
  using (bucket_id = 'menu-photos');

-- Only staff can upload/manage menu photos.
create policy "staff upload menu photos"
  on storage.objects for insert
  with check (bucket_id = 'menu-photos' and is_staff());

create policy "staff update menu photos"
  on storage.objects for update
  using (bucket_id = 'menu-photos' and is_staff());

create policy "staff delete menu photos"
  on storage.objects for delete
  using (bucket_id = 'menu-photos' and is_staff());
