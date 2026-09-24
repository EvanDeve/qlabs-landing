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

  // Los dos permisos son generales (20260924170000): la fila vigente es la que
  // no tiene negocio. Las viejas por negocio quedan como historial.
  const vigente = (kind: string) => consents?.find((c) => c.kind === kind && c.brand_id === null)?.granted ?? false;

  const nombres = ids.map((id) => marcas?.find((m) => m.profile_id === id)?.brand_name).filter(Boolean);
  const permisos: Permiso[] = [
    {
      kind: "share_with_brand",
      titulo: "Compartir mis datos con mis negocios",
      detalle: `Nombre, WhatsApp y correo${nombres.length ? `, hoy con ${nombres.join(", ")}` : ""} y los que se sumen. Si no, te ven solo por tu nombre de agente.`,
      icono: "🤝",
      granted: vigente("share_with_brand"),
    },
    {
      kind: "whatsapp_marketing",
      titulo: "Avisos por WhatsApp",
      detalle: "Ofertas y eventos de tus negocios",
      icono: "💬",
      granted: vigente("whatsapp_marketing"),
    },
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
