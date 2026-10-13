-- Ejecutar en SQL Editor de Supabase. Entorno de demo: una organización por usuario registrado.
create extension if not exists pgcrypto;
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now()
);
create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','staff')),
  primary key (organization_id, user_id)
);
create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'operator' check (role in ('admin','operator')),
  created_at timestamptz not null default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  created_by uuid not null references auth.users(id),
  customer_name text not null,
  customer_dni text not null,
  destination text not null check (destination in ('Lima','Shalom','Olva')),
  agency text not null default '',
  address text not null,
  phone text not null default '',
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'Nuevo' check (status in ('Nuevo','Preparando','Enviado','Entregado')),
  created_at timestamptz not null default now()
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  created_by uuid not null references auth.users(id),
  method text not null check (method in ('Yape','Plin','Transferencia')),
  reference text not null default '',
  proof_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists orders_org_date_idx on public.orders(organization_id, created_at desc);
create index if not exists payments_order_date_idx on public.payments(order_id, created_at desc);

-- Cada cuenta conserva una organización de atribución; los roles controlan las acciones compartidas.
create or replace function public.create_user_workspace() returns trigger language plpgsql security definer set search_path = '' as $$
declare new_org uuid;
begin
  insert into public.organizations (name) values ('Mi negocio') returning id into new_org;
  insert into public.organization_members (organization_id,user_id,role) values (new_org,new.id,'owner');
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_workspace on auth.users;
create trigger on_auth_user_created_workspace after insert on auth.users for each row execute function public.create_user_workspace();

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
insert into public.app_users (id,email)
select id, coalesce(email,'') from auth.users
on conflict (id) do update set email = excluded.email;
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

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.app_users enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;

grant select on public.app_users to authenticated;
grant update (role) on public.app_users to authenticated;
create policy "users read own profile or admins read all" on public.app_users for select to authenticated
using (id = (select auth.uid()) or (select public.has_app_role('admin')));
create policy "admins update user roles" on public.app_users for update to authenticated
using ((select public.has_app_role('admin')))
with check ((select public.has_app_role('admin')));
create policy "members read own membership" on public.organization_members for select to authenticated using (user_id = (select auth.uid()));
create policy "members read own organization" on public.organizations for select to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id = id and m.user_id = (select auth.uid()))
);
create policy "authenticated read all orders" on public.orders for select to authenticated using (true);
create policy "operators create orders" on public.orders for insert to authenticated with check (
  created_by = (select auth.uid()) and (select public.has_app_role('admin') or public.has_app_role('operator')) and
  exists (select 1 from public.organization_members m where m.organization_id = orders.organization_id and m.user_id = (select auth.uid()))
);
drop policy if exists "members update orders" on public.orders;
create policy "operators update all orders" on public.orders for update to authenticated using (
  (select public.has_app_role('admin') or public.has_app_role('operator'))
) with check (
  (select public.has_app_role('admin') or public.has_app_role('operator'))
);
drop policy if exists "members delete orders" on public.orders;
create policy "admins delete orders" on public.orders for delete to authenticated using ((select public.has_app_role('admin')));
create policy "authenticated read all payments" on public.payments for select to authenticated using (true);
drop policy if exists "members create payments" on public.payments;
create policy "operators create payments" on public.payments for insert to authenticated with check (
  created_by = (select auth.uid()) and (select public.has_app_role('admin') or public.has_app_role('operator')) and
  exists (select 1 from public.orders o where o.id = payments.order_id and o.organization_id = payments.organization_id)
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "members upload own proofs" on storage.objects;
create policy "operators upload shared proofs" on storage.objects for insert to authenticated
with check (bucket_id = 'payment-proofs' and (select public.has_app_role('admin') or public.has_app_role('operator')));
create policy "authenticated read shared proofs" on storage.objects for select to authenticated
using (bucket_id = 'payment-proofs');
drop policy if exists "members remove own proofs" on storage.objects;
create policy "admins remove shared proofs" on storage.objects for delete to authenticated
using (bucket_id = 'payment-proofs' and (select public.has_app_role('admin')));
