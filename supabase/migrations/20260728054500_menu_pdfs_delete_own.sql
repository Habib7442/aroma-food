-- The vendor app now replaces a restaurant's menu PDF in place (delete old,
-- upload new) rather than accumulating one object per import — the
-- menu-pdfs bucket only ever had insert_own/select_public policies, so
-- storage.remove() would have silently failed on this table's RLS. Mirrors
-- menu_pdfs_insert_own's exact ownership check.

create policy "menu_pdfs_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'menu-pdfs'
  and (select auth_org_id()) = (storage.foldername(name))[1]
);
