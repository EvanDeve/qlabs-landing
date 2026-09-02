-- El estado REAL de un envío de WhatsApp, y no el que asumimos al mandarlo.
--
-- Hasta hoy `status` pasaba a 'sent' apenas Twilio aceptaba el mensaje, y eso
-- no quiere decir entregado: quiere decir "Twilio lo tiene". El 2026-09-02 la
-- salida hacia WhatsApp llevaba tres días caída —Twilio encolando sin error, ni
-- un mensaje llegando— y la base decía 'sent' para siete mensajes que nunca
-- salieron. El único motivo por el que nos enteramos fue que alguien pidió una
-- revisión a mano.
--
-- Los estados que faltaban son justamente los que separan "Twilio lo tiene" de
-- "le llegó a la persona": 'delivered' y 'read' de un lado, 'undelivered' y
-- 'canceled' del otro. Sin ellos no hay forma de escribir la pregunta "¿se
-- entregó algo en las últimas 24 horas?", que es la que dispara el aviso.
--
-- Los nombres son los de Twilio tal cual, sin traducir: cuando haya que
-- comparar una fila con lo que dice su consola, que sea la misma palabra.

-- Se buscan por catálogo y no por nombre: las dos restricciones se crearon
-- inline (`status text not null default 'queued' check (...)`), así que el
-- nombre lo puso Postgres y darlo por sabido es la clase de suposición que
-- deja la migración a medio aplicar.
do $$
declare c record;
begin
  for c in
    select conname, conrelid::regclass::text as tabla
    from pg_constraint
    where conrelid in ('public.wa_messages'::regclass, 'public.wa_public_messages'::regclass)
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table %s drop constraint %I', c.tabla, c.conname);
  end loop;
end $$;

alter table public.wa_messages
  add constraint wa_messages_status_check
  check (status in (
    -- en vuelo: Twilio lo tiene, la persona todavía no
    'queued', 'accepted', 'sending', 'sent',
    -- llegó
    'delivered', 'read',
    -- no llegó, y ya no va a llegar
    'undelivered', 'failed', 'canceled',
    -- entrantes
    'received'
  ));

alter table public.wa_public_messages
  add constraint wa_public_messages_status_check
  check (status in (
    'queued', 'accepted', 'sending', 'sent',
    'delivered', 'read',
    'undelivered', 'failed', 'canceled',
    'received'
  ));

-- La consulta del reconciliador: los salientes que todavía no tienen un estado
-- final. Sin el índice es un scan de toda la tabla una vez por día — barato hoy
-- con cientos de filas, no dentro de un año.
create index if not exists wa_messages_en_vuelo_idx
  on public.wa_messages (created_at desc)
  where direction = 'out' and status in ('queued', 'accepted', 'sending', 'sent');
