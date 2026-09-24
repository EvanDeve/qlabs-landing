import { requireMember } from "@/lib/cf/sesion";
import { salirCfAction } from "@/lib/actions/close-friends";
import { CF } from "@/lib/cf/copy";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import { BOTON_SUAVE, Encabezado, Pantalla } from "@/components/cf/ui";

/**
 * Inicio del miembro. Por ahora (paso 2) es a donde se llega al terminar el
 * registro: quién es, su expediente y los negocios a los que se unió. Los
 * cupones, el perfil y la barra de abajo llegan con el panel completo.
 */
export default async function InicioCfPage() {
  const { supabase, miembro } = await requireMember();

  const { data: links } = await supabase
    .from("member_brand_links")
    .select("brand_id, joined_at")
    .order("joined_at", { ascending: false });

  const ids = (links ?? []).map((l) => l.brand_id);
  const { data: marcas } = ids.length
    ? await supabase.from("brand_public_profiles").select("profile_id, brand_name, logo_url").in("profile_id", ids)
    : { data: [] };
  const negocios = ids
    .map((id) => marcas?.find((m) => m.profile_id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  return (
    <Pantalla>
      <Encabezado />

      <h1 className="mt-8 text-[28px] font-extrabold leading-tight tracking-tight">
        Hola, {miembro.agent_name}
      </h1>

      {/* La "credencial": expediente y alias, lo que identifica al miembro. */}
      <section className="mt-6 overflow-hidden rounded-[22px] bg-gradient-to-br from-violet to-violet-deep p-6 text-white shadow-[0_24px_50px_-28px_rgba(86,65,216,0.8)]">
        <p className="text-[13px] font-semibold text-white/70">{CF.miembro}</p>
        <p className="mt-1 text-2xl font-extrabold">{miembro.agent_name}</p>
        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[13px] text-white/70">Expediente</p>
            <p className="font-mono text-lg font-bold tracking-wider">{miembro.expediente_code}</p>
          </div>
          <p className="text-right text-[13px] text-white/70">
            Desde {new Date(miembro.created_at).toLocaleDateString("es-CR", { month: "long", year: "numeric", timeZone: "America/Costa_Rica" })}
          </p>
        </div>
      </section>

      <h2 className="mt-8 text-lg font-extrabold">Tus negocios</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {negocios.map((n) => (
          <li key={n.profile_id} className="flex min-h-14 items-center gap-3 rounded-card bg-white px-4 py-3 ring-1 ring-line">
            <BrandAvatar name={n.brand_name} logoUrl={n.logo_url} size={40} radius={12} />
            <span className="text-base font-bold">{n.brand_name}</span>
          </li>
        ))}
      </ul>

      <p className="mt-6 rounded-card bg-white/70 px-4 py-3 text-[15px] leading-relaxed text-ink-soft ring-1 ring-line">
        Muy pronto vas a ver acá los cupones de tus negocios.
      </p>

      <form action={salirCfAction} className="mt-auto pt-10">
        <button type="submit" className={BOTON_SUAVE}>
          Cerrar sesión
        </button>
      </form>
    </Pantalla>
  );
}
