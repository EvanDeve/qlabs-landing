-- Fase 2, épica 2.1: bucket de storage para el book/portfolio
-- (separado de 20260707200000_portfolio_items.sql porque esa corrida no llegó
-- a crear el bucket la primera vez que se aplicó a mano en el SQL Editor)

insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

create policy "portfolio_bucket_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'portfolio');

create policy "portfolio_bucket_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "portfolio_bucket_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
