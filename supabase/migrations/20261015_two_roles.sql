-- Run once in Supabase SQL Editor after 20261014_roles.sql.
-- Migrate existing read-only users to operator before removing that role.
alter table public.app_users alter column role set default 'operator';
alter table public.app_users drop constraint if exists app_users_role_check;
update public.app_users set role = 'operator' where role = 'viewer';
alter table public.app_users
  add constraint app_users_role_check check (role in ('admin','operator'));
