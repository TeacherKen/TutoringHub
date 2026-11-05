-- Speed (Supabase advisor): check the sign-in once per query, not once per row. Same rule as before.
drop policy if exists app_users_self_read on tutoring.app_users;
create policy app_users_self_read on tutoring.app_users for select to authenticated using (
  email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'provider', '') = 'google'
);
