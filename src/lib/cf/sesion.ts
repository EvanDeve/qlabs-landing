import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { destinoDeSesion } from "@/lib/ugc/estado-cuenta";

/**
 * La puerta del panel Close Friends. Mismo papel que `requireRole()` en los
 * paneles del marketplace, pero aparte porque el miembro no tiene verificación
 * ni onboarding: o tiene su ficha en `members`, o no es miembro.
 *
 * La RLS es la frontera real; esto decide solo a qué pantalla va cada quien.
 * Una cuenta de creador, marca o admin que llegue acá vuelve a su panel sin
 * error, igual que pasa entre los paneles del marketplace.
 */
// `cache`: el layout y la página la llaman en el mismo request; así la
// consulta corre una vez.
export const requireMember = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/cf/entrar");

  const { data: miembro } = await supabase
    .from("members")
    .select("profile_id, expediente_code, agent_name, full_name, status, created_at")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!miembro) {
    const destino = await destinoDeSesion(supabase, user.id);
    // Sin rol todavía (se verificó el correo pero el alta no terminó): no hay
    // panel al que mandarlo, y el onboarding del marketplace no es para él.
    redirect(destino === "/ugc/onboarding" ? "/cf/entrar" : destino);
  }

  return { user, supabase, miembro };
});
