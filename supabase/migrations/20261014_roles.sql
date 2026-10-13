-- In Supabase SQL Editor, run the ENTIRE file after 20261013_share_orders.sql.
create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'operator' check (role in ('admin','operator')),
  created_at timestamptz not null default now()
);

insert into public.app_users (id,email)
select id, coalesce(email,'') from auth.users
on conflict (id) do update set email = excluded.email;

create or replace function public.has_app_role(required_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_users
    where id = (select auth.uid()) and role = required_role
  );
$$;
revoke all on function public.has_app_role(text) from public;
grant execute on function public.has_app_role(text) to authenticated;

create or replace function public.sync_app_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.app_users (id,email) values (new.id, coalesce(new.email,''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_app_user on auth.users;
create trigger on_auth_user_created_app_user after insert or update of email on auth.users
for each row execute function public.sync_app_user();

create or replace function public.protect_last_app_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  admin_count integer;
begin
  if old.role = 'admin' and new.role <> 'admin' then
    select count(*) into admin_count from public.app_users where role = 'admin';
    if admin_count <= 1 then
      raise exception 'Debe quedar al menos un administrador';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists app_users_require_admin on public.app_users;
drop trigger if exists protect_last_app_admin on public.app_users;
create trigger protect_last_app_admin before update of role on public.app_users
for each row execute function public.protect_last_app_admin();

alter table public.app_users enable row level security;
grant select on public.app_users to authenticated;
grant update (role) on public.app_users to authenticated;
drop policy if exists "users read own profile or admins read all" on public.app_users;
create policy "users read own profile or admins read all" on public.app_users for select to authenticated
using (id = (select auth.uid()) or (select public.has_app_role('admin')));
drop policy if exists "admins update user roles" on public.app_users;
create policy "admins update user roles" on public.app_users for update to authenticated
using ((select public.has_app_role('admin')))
with check ((select public.has_app_role('admin')));

drop policy if exists "members create orders" on public.orders;
drop policy if exists "operators create orders" on public.orders;
create policy "operators create orders" on public.orders for insert to authenticated with check (
  created_by = (select auth.uid()) and (select public.has_app_role('admin') or public.has_app_role('operator')) and
  exists (select 1 from public.organization_members m where m.organization_id = orders.organization_id and m.user_id = (select auth.uid()))
);
drop policy if exists "members update orders" on public.orders;
drop policy if exists "operators update all orders" on public.orders;
create policy "operators update all orders" on public.orders for update to authenticated using (
  (select public.has_app_role('admin') or public.has_app_role('operator'))
) with check (
  (select public.has_app_role('admin') or public.has_app_role('operator'))
);
drop policy if exists "members delete orders" on public.orders;
drop policy if exists "admins delete orders" on public.orders;
create policy "admins delete orders" on public.orders for delete to authenticated using ((select public.has_app_role('admin')));

drop policy if exists "members create payments" on public.payments;
drop policy if exists "operators create payments" on public.payments;
create policy "operators create payments" on public.payments for insert to authenticated with check (
  created_by = (select auth.uid()) and (select public.has_app_role('admin') or public.has_app_role('operator')) and
  exists (select 1 from public.orders o where o.id = payments.order_id and o.organization_id = payments.organization_id)
);

drop policy if exists "members upload own proofs" on storage.objects;
drop policy if exists "operators upload shared proofs" on storage.objects;
create policy "operators upload shared proofs" on storage.objects for insert to authenticated
with check (bucket_id = 'payment-proofs' and (select public.has_app_role('admin') or public.has_app_role('operator')));
drop policy if exists "members remove own proofs" on storage.objects;
drop policy if exists "admins remove shared proofs" on storage.objects;
create policy "admins remove shared proofs" on storage.objects for delete to authenticated
using (bucket_id = 'payment-proofs' and (select public.has_app_role('admin')));

-- After running this migration, replace the email with the account that should
-- manage roles and execute this once to bootstrap the first administrator:
-- update public.app_users set role = 'admin' where email = 'admin@example.com';
