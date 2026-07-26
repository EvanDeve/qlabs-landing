-- Derechos de uso del contenido en cada campaña.
--
-- Hasta ahora no existía NINGÚN campo sobre qué puede hacer la marca con el
-- material entregado: ni dónde publicarlo, ni por cuánto tiempo, ni si puede
-- editarlo. Es la principal fuente de conflicto en UGC, así que pasa a ser
-- parte del trato explícito de la campaña y no de una conversación aparte.
--
-- Las columnas quedan NULL-ables a propósito: las campañas que ya existen se
-- pactaron sin estas condiciones, y ponerles un default sería asignarle
-- retroactivamente derechos que la marca nunca acordó con el creador. La UI las
-- muestra como "No especificado" y el formulario las exige solo para las nuevas.

create type campaign_usage_scope as enum ('organico', 'pauta', 'todo_medio');
create type campaign_usage_duration as enum ('meses_3', 'meses_6', 'meses_12', 'perpetuo');

alter table public.campaigns
  add column usage_rights_scope campaign_usage_scope,
  add column usage_rights_duration campaign_usage_duration,
  add column usage_rights_editing boolean,
  add column usage_rights_notes text;

comment on column public.campaigns.usage_rights_scope is
  'Dónde puede usar la marca el contenido: organico = solo sus redes; pauta = orgánico + anuncios pagados; todo_medio = cualquier medio (web, email, vallas).';
comment on column public.campaigns.usage_rights_duration is
  'Por cuánto tiempo la marca conserva esos derechos, contado desde la aprobación de la entrega.';
comment on column public.campaigns.usage_rights_editing is
  'Si la marca puede recortar/reeditar la pieza o debe publicarla tal cual se entregó.';
comment on column public.campaigns.usage_rights_notes is
  'Aclaraciones libres para casos que no entran en los campos estructurados.';

-- Sin cambios de RLS: las columnas viven en `campaigns`, que ya está cubierta
-- por las policies existentes. Tampoco se tocan `campaign_previews` ni
-- `brand_public_campaigns` (las dos superficies anon): los derechos de uso son
-- parte del brief, y la vista pública solo expone marca, título y formato.
