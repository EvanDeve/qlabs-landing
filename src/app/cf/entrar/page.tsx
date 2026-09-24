import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { destinoDeSesion } from "@/lib/ugc/estado-cuenta";
import { CF } from "@/lib/cf/copy";
import { Encabezado, Pantalla } from "@/components/cf/ui";
import FormularioEntrar from "@/components/cf/FormularioEntrar";

export const dynamic = "force-dynamic";

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const destino = await destinoDeSesion(supabase, user.id);
    // Una cuenta sin rol (verificó el correo pero el alta no terminó) se queda
    // acá: no tiene panel, y el onboarding del marketplace no es para ella.
    if (destino !== "/ugc/onboarding") redirect(destino);
  }

  // Solo se acepta volver a la página de un QR; cualquier otra cosa se ignora.
  const nextValido = next && /^\/cf\/unirme\/[A-Z0-9]{10}$/.test(next) ? next : undefined;

  return (
    <Pantalla>
      <Encabezado />
      <div className="mt-12">
        <FormularioEntrar next={nextValido} />
      </div>
      <p className="mt-auto pt-10 text-center text-[15px] leading-relaxed text-ink-soft">
        ¿Todavía no sos parte de {CF.programa}? Escaneá el QR que te muestra el negocio.
      </p>
    </Pantalla>
  );
}
