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

-- Durante sign-up crea espacio privado. Para entornos reales reemplazar con invitaciones de equipo.
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

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;

create policy "members read own membership" on public.organization_members for select to authenticated using (user_id = (select auth.uid()));
create policy "members read own organization" on public.organizations for select to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id = id and m.user_id = (select auth.uid()))
);
create policy "members read orders" on public.orders for select to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id = orders.organization_id and m.user_id = (select auth.uid()))
);
create policy "members create orders" on public.orders for insert to authenticated with check (
  created_by = (select auth.uid()) and exists (select 1 from public.organization_members m where m.organization_id = orders.organization_id and m.user_id = (select auth.uid()))
);
create policy "members update orders" on public.orders for update to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id = orders.organization_id and m.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.organization_members m where m.organization_id = orders.organization_id and m.user_id = (select auth.uid()))
);
drop policy if exists "members delete orders" on public.orders;
create policy "members delete orders" on public.orders for delete to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id = orders.organization_id and m.user_id = (select auth.uid()))
);
create policy "members read payments" on public.payments for select to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id = payments.organization_id and m.user_id = (select auth.uid()))
);
create policy "members create payments" on public.payments for insert to authenticated with check (
  created_by = (select auth.uid()) and
  exists (select 1 from public.organization_members m where m.organization_id = payments.organization_id and m.user_id = (select auth.uid())) and
  exists (select 1 from public.orders o where o.id = payments.order_id and o.organization_id = payments.organization_id)
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
create policy "members upload own proofs" on storage.objects for insert to authenticated
with check (bucket_id = 'payment-proofs' and exists (
 select 1 from public.organization_members m where m.user_id = (select auth.uid()) and m.organization_id::text = (storage.foldername(name))[1]
));
create policy "members read own proofs" on storage.objects for select to authenticated
using (bucket_id = 'payment-proofs' and exists (
 select 1 from public.organization_members m where m.user_id = (select auth.uid()) and m.organization_id::text = (storage.foldername(name))[1]
));
create policy "members remove own proofs" on storage.objects for delete to authenticated
using (bucket_id = 'payment-proofs' and exists (
 select 1 from public.organization_members m where m.user_id = (select auth.uid()) and m.organization_id::text = (storage.foldername(name))[1]
));
