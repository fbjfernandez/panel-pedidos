-- Run this once in Supabase SQL Editor for an existing project.
-- All signed-in users can read shared order/payment data and payment proofs.
-- Existing organization membership checks still restrict writes and deletes.
drop policy if exists "members read orders" on public.orders;
drop policy if exists "authenticated read all orders" on public.orders;
create policy "authenticated read all orders" on public.orders
for select to authenticated using (true);

drop policy if exists "members read payments" on public.payments;
drop policy if exists "authenticated read all payments" on public.payments;
create policy "authenticated read all payments" on public.payments
for select to authenticated using (true);

drop policy if exists "members read own proofs" on storage.objects;
drop policy if exists "authenticated read shared proofs" on storage.objects;
create policy "authenticated read shared proofs" on storage.objects
for select to authenticated using (bucket_id = 'payment-proofs');
