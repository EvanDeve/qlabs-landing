-- Q·OS: ajustes al detalle de Hero pedidos por el usuario.
-- "Objetivo" no tenía un propósito claro — se quita. "Contactos" era un solo
-- input de texto libre, pero un Hero puede tener varias personas de
-- contacto — pasa a ser un arreglo estructurado (nombre/rol/teléfono/email).

alter table public.agency_clients drop column objetivo;

alter table public.agency_clients
  alter column contacts type jsonb using (
    case when contacts is null or contacts = '' then '[]'::jsonb
    else jsonb_build_array(jsonb_build_object('name', contacts))
    end
  );

alter table public.agency_clients alter column contacts set default '[]'::jsonb;
alter table public.agency_clients alter column contacts set not null;
