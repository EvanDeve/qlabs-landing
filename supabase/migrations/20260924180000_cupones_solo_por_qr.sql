-- Un cliente consigue un cupón SOLO escaneando su QR.
--
-- Decisión de Evan (2026-09-24): el panel del miembro no es una vitrina. No
-- hay pestaña "Disponibles" ni reclamo desde la app: el cupón entra a la
-- wallet cuando la persona escanea el QR que le muestra el negocio (ver
-- 20260924150000). Esconder la pestaña no alcanzaba —la anon key es pública y
-- la base igual le mostraba y le dejaba reclamar cualquier cupón publicado—,
-- así que se cierra acá.

-- Ver: el miembro ya solo ve los cupones que tiene en la wallet, por
-- `coupons_select_reclamados_por_mi` (tengo_reclamo, 20260924130000).
drop policy "coupons_select_publicados_member" on public.coupons;

-- Reclamar: la única puerta es el QR (`completar_registro_miembro` →
-- `reclamar_para_miembro`). La función del panel se va entera: dejarla sin
-- grant sería dejar una puerta cerrada con la llave puesta.
drop function public.claim_coupon_member(uuid);

-- `coupons.member_scope` (all_members | brand_members) decidía qué miembros
-- VEÍAN un cupón en su app. Sin vitrina ya no decide nada: la columna queda
-- con su default porque sacarla obliga a tocar a la vez la migración, los
-- tipos y los formularios, y no molesta. Si se vuelve a abrir una vitrina, el
-- dato está.
comment on column public.coupons.member_scope is
  'Sin uso desde 20260924180000: los cupones para clientes se consiguen solo por QR.';
