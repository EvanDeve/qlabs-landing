import { requireMember } from "@/lib/cf/sesion";
import { salirCfAction } from "@/lib/actions/close-friends";
import { CF } from "@/lib/cf/copy";
import PantallaHeader from "@/components/ugc/PantallaHeader";
import { DatosMiembro, EliminarCuenta, PermisosMiembro, type Permiso } from "@/components/cf/PerfilMiembro";
import { fechaCorta } from "@/lib/ugc/loyalty";
import styles from "@/styles/qos.module.css";

export default async function PerfilCfPage() {
  const { user, supabase, miembro } = await requireMember();

  const [{ data: ficha }, { data: links }, { data: consents }, { data: pedido }] = await Promise.all([
    supabase.from("members").select("full_name, phone").eq("profile_id", user.id).single(),
    supabase.from("member_brand_links").select("brand_id, joined_at").order("joined_at", { ascending: false }),
    supabase.from("member_consents_vigentes").select("kind, brand_id, granted"),
    supabase
      .from("member_deletion_requests")
      .select("created_at")
      .eq("status", "pendiente")
      .maybeSingle(),
  ]);

  const ids = (links ?? []).map((l) => l.brand_id);
  const { data: marcas } = ids.length
    ? await supabase.from("brand_public_profiles").select("profile_id, brand_name, logo_url").in("profile_id", ids)
    : { data: [] };

  const vigente = (kind: string, brandId: string | null) =>
    consents?.find((c) => c.kind === kind && c.brand_id === brandId)?.granted ?? false;

  const permisos: Permiso[] = [
    {
      kind: "whatsapp_marketing",
      brandId: null,
      titulo: "Avisos por WhatsApp",
      detalle: "Ofertas y eventos de tus negocios",
      granted: vigente("whatsapp_marketing", null),
    },
    ...ids.flatMap((id) => {
      const m = marcas?.find((x) => x.profile_id === id);
      if (!m) return [];
      return [
        {
          kind: "share_with_brand" as const,
          brandId: id,
          titulo: `Compartir mis datos con ${m.brand_name}`,
          detalle: "Nombre, WhatsApp y correo. Si no, te ve solo por tu nombre de agente.",
          logo: { nombre: m.brand_name, url: m.logo_url },
          granted: vigente("share_with_brand", id),
        },
      ];
    }),
  ];

  return (
    <>
      <PantallaHeader titulo="Perfil" descripcion={`${CF.miembro} · ${miembro.expediente_code}`} />

      <div className={styles.recSeccion}>Tus datos</div>
      <DatosMiembro fullName={ficha?.full_name ?? ""} phone={ficha?.phone ?? ""} agentName={miembro.agent_name} />
      <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "8px 4px 0" }}>
        Entrás con {user.email}.
      </p>

      <div className={styles.recSeccion}>Permisos</div>
      <PermisosMiembro permisos={permisos} />

      <div className={styles.recSeccion}>Cuenta</div>
      <form action={salirCfAction} style={{ marginBottom: 12 }}>
        <button type="submit" className={styles.btnAplicar} style={{ background: "#fff", color: "#0A0B10", border: "1px solid rgba(10,11,16,0.12)" }}>
          Cerrar sesión
        </button>
      </form>
      <EliminarCuenta pedidoEl={pedido ? fechaCorta(pedido.created_at) : null} />
    </>
  );
}
