import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limpiarCodigoInvitacion } from "@/lib/cf/registro";
import type { AppRole } from "@/lib/database.types";

export type Invitacion = { codigo: string; negocio: string; logoUrl: string | null };

/**
 * Lo que necesitan las dos pantallas del QR: el negocio del código y quién
 * está mirando.
 *
 * El negocio sale de `invitacion_publica` (service role): nombre y logo, nunca
 * su id, que no viaja al navegador. `null` es "este código no sirve", sin
 * distinguir inventado de pausado: no se confirma qué códigos existen.
 *
 * `vinculado` dice si quien mira ya es miembro de ESTE negocio. Se resuelve
 * acá con service role porque el id del negocio no sale del servidor.
 */
export async function leerInvitacion(
  codigoCrudo: string,
  { contarEscaneo }: { contarEscaneo: boolean }
): Promise<{
  invitacion: Invitacion | null;
  sesion: { userId: string; rol: AppRole | null; vinculado: boolean } | null;
}> {
  const codigo = limpiarCodigoInvitacion(codigoCrudo);
  if (!codigo) return { invitacion: null, sesion: null };

  const admin = createAdminClient();
  const supabase = await createClient();
  const [{ data }, { data: auth }] = await Promise.all([
    admin.rpc("invitacion_publica", { p_code: codigo, p_contar_escaneo: contarEscaneo }),
    supabase.auth.getUser(),
  ]);

  const invitacion = data ? { codigo, negocio: data.brand_name, logoUrl: data.logo_url } : null;
  if (!auth.user) return { invitacion, sesion: null };

  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
  let vinculado = false;
  if (invitacion && perfil?.role === "member") {
    const { data: inv } = await admin.from("brand_invite_codes").select("brand_id").eq("code", codigo).single();
    const { data: link } = await admin
      .from("member_brand_links")
      .select("member_id")
      .eq("member_id", auth.user.id)
      .eq("brand_id", inv!.brand_id)
      .maybeSingle();
    vinculado = Boolean(link);
  }

  return { invitacion, sesion: { userId: auth.user.id, rol: perfil?.role ?? null, vinculado } };
}
