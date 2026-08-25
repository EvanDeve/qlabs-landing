-- La hoja de entrega del creador: cada archivo sabe a qué entregable pertenece.
--
-- Hasta hoy `application_deliveries` era una lista plana y no había forma de
-- decir "esta es la STORY 2". La hoja nueva se arma desde
-- `campaigns.deliverables` —1 Reel + 2 Stories son tres cajas— y necesita saber
-- qué caja está llena para poder cerrarse y volver a abrirse sin perder nada.

alter table public.application_deliveries
  add column slot text;

comment on column public.application_deliveries.slot is
  'Entregable al que corresponde el archivo, como "<tipo>#<n>" ("reel#1", "stories#2"). Se deriva de campaigns.deliverables. null en las filas de link y en las entregas anteriores a esta migración.';

-- Un slot, un archivo. Sin esto, dos subidas a la misma caja dejan la entrega
-- con dos reels y ninguna story, y el "2 de 3" contaría mal.
create unique index application_deliveries_slot_unico
  on public.application_deliveries (application_id, slot)
  where slot is not null;

-- La nota es UNA por entrega, no una por archivo. Vivía repetida en cada fila
-- porque el formulario viejo insertaba las dos juntas; acá los archivos se
-- guardan de a uno, a medida que terminan de subir, y la nota se escribe recién
-- al enviar.
--
-- Que viva en `applications` no es solo prolijidad: la policy de update del
-- creador es `using (status = 'accepted') with check (status = 'delivered')`,
-- así que esta columna solo se puede escribir en el mismo UPDATE que entrega la
-- pieza. Después de entregada, ni el creador puede cambiarla.
alter table public.applications
  add column delivery_note text;

-- ---------------------------------------------------------------
-- Rehacer un slot antes de enviar
-- ---------------------------------------------------------------
-- "Cambiar" en la hoja reemplaza el archivo de una caja. Como la fila ya está
-- escrita, hace falta poder borrarla — pero SOLO mientras la aplicación sigue
-- en 'accepted'. Una vez entregada, la pieza es lo que la marca va a aprobar y
-- lo que respalda el pago: no se toca.
create policy "application_deliveries_delete_antes_de_entregar"
  on public.application_deliveries for delete
  to authenticated
  using (
    creator_id = auth.uid()
    and exists (
      select 1 from public.applications a
      where a.id = application_deliveries.application_id
        and a.creator_id = auth.uid()
        and a.status = 'accepted'
    )
  );

-- Y el archivo en Storage, con el mismo corte. Sin esto el objeto quedaba
-- huérfano en el bucket cada vez que alguien cambia de idea.
create policy "deliveries_bucket_delete_antes_de_entregar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'deliveries'
    and exists (
      select 1 from public.applications a
      where a.id::text = (storage.foldername(name))[1]
        and a.creator_id = auth.uid()
        and a.status = 'accepted'
    )
  );

-- ---------------------------------------------------------------
-- La marca no ve una entrega a medio armar
-- ---------------------------------------------------------------
-- Consecuencia directa de guardar cada archivo apenas termina de subir: las
-- filas ahora existen ANTES de que el creador toque "Enviar entrega". Con las
-- policies viejas la marca ya las veía —y veía el archivo en el bucket—
-- mientras el creador todavía estaba eligiendo qué subir.
--
-- El corte es el estado de la aplicación: mientras está en 'accepted' la
-- entrega es el taller del creador y solo la ve él (y admin). Desde
-- 'delivered' en adelante es material entregado y la marca lo ve.

drop policy "application_deliveries_select" on public.application_deliveries;

create policy "application_deliveries_select"
  on public.application_deliveries for select
  to authenticated
  using (
    creator_id = auth.uid()
    or exists (
      select 1 from public.applications a
      join public.campaigns c on c.id = a.campaign_id
      where a.id = application_deliveries.application_id
        and c.brand_id = auth.uid()
        and a.status <> 'accepted'
    )
    or public.current_app_role() = 'admin'
  );

drop policy "deliveries_bucket_select" on storage.objects;

create policy "deliveries_bucket_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'deliveries'
    and (
      exists (
        select 1 from public.applications a
        where a.id::text = (storage.foldername(name))[1] and a.creator_id = auth.uid()
      )
      or exists (
        select 1 from public.applications a
        join public.campaigns c on c.id = a.campaign_id
        where a.id::text = (storage.foldername(name))[1]
          and c.brand_id = auth.uid()
          and a.status <> 'accepted'
      )
      or public.current_app_role() = 'admin'
    )
  );
