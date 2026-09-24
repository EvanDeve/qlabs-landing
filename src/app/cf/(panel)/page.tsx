import Link from "next/link";
import { requireMember } from "@/lib/cf/sesion";
import { cuponesDelMiembro } from "@/lib/cf/cupones";
import { CF } from "@/lib/cf/copy";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import PantallaHeader from "@/components/ugc/PantallaHeader";
import MisCupones from "@/components/ugc/creador/MisCupones";
import InstalarApp from "@/components/cf/InstalarApp";
import RefrescoVivo from "@/components/cf/RefrescoVivo";
import styles from "@/styles/qos.module.css";

/**
 * Lo que dice el Inicio al volver de un QR (ver `destinoTrasUnirse`). Un QR sin
 * cupón no necesita aviso: la persona ve el negocio nuevo en la lista.
 */
const AVISO_CUPON: Record<string, { tono: "ok" | "info"; texto: string }> = {
  nuevo: { tono: "ok", texto: "¡Listo! Tu cupón se agregó a tu wallet." },
  ya_estaba: { tono: "info", texto: "Ese cupón ya estaba en tu wallet." },
  agotado: { tono: "info", texto: "Te uniste, pero ese cupón ya se agotó." },
  vencido: { tono: "info", texto: "Te uniste, pero ese cupón ya venció." },
  no_disponible: { tono: "info", texto: "Te uniste, pero ese cupón ya no está disponible." },
  no_existe: { tono: "info", texto: "Te uniste, pero ese cupón ya no está disponible." },
};

export default async function InicioCfPage({ searchParams }: { searchParams: Promise<{ cupon?: string }> }) {
  const { cupon } = await searchParams;
  const { supabase, miembro } = await requireMember();

  const [{ mios }, { data: links }] = await Promise.all([
    cuponesDelMiembro(supabase),
    supabase.from("member_brand_links").select("brand_id, joined_at").order("joined_at", { ascending: false }),
  ]);

  const ids = (links ?? []).map((l) => l.brand_id);
  const { data: marcas } = ids.length
    ? await supabase.from("brand_public_profiles").select("profile_id, brand_name, logo_url, location").in("profile_id", ids)
    : { data: [] };
  const negocios = ids
    .map((id) => marcas?.find((m) => m.profile_id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  const porUsar = mios.filter((m) => m.estado === "por_usar");
  const aviso = cupon ? AVISO_CUPON[cupon] : undefined;
  const desde = new Date(miembro.created_at).toLocaleDateString("es-CR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Costa_Rica",
  });

  return (
    <>
      {porUsar.length > 0 && <RefrescoVivo />}
      <PantallaHeader rotulo={CF.programa} titulo={`Hola, ${miembro.agent_name}`} />

      {aviso && (
        <div
          role="status"
          className={`${styles.card} ${styles.cardPad}`}
          style={{
            marginBottom: 16,
            fontWeight: 700,
            fontSize: 15,
            background: aviso.tono === "ok" ? "#E7F7F1" : "#F6F4FD",
            color: aviso.tono === "ok" ? "#0E7A53" : "#5641D8",
          }}
        >
          {aviso.texto}
        </div>
      )}

      {/* La credencial: lo que identifica al miembro en cualquier negocio. */}
      <section
        style={{
          borderRadius: 22,
          padding: 22,
          marginBottom: 16,
          color: "#fff",
          background: "linear-gradient(140deg, #705CF6, #5641D8)",
          boxShadow: "0 24px 50px -28px rgba(86,65,216,0.8)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.75 }}>{CF.miembro}</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}>{miembro.agent_name}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 22, gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Expediente</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, letterSpacing: "0.06em" }}>
              {miembro.expediente_code}
            </div>
          </div>
          <div style={{ fontSize: 13, opacity: 0.75, textAlign: "right" }}>Desde {desde}</div>
        </div>
      </section>

      <InstalarApp />

      <div className={styles.recSeccion} style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Tu wallet</span>
        <Link href="/cf/cupones" style={{ color: "#5641D8", fontWeight: 700 }}>
          Ver todos
        </Link>
      </div>
      {porUsar.length === 0 ? (
        <div className={`${styles.card} ${styles.empty}`}>
          No tenés cupones por usar. Cuando escanees el QR de un cupón en uno de tus negocios, va a aparecer acá.
        </div>
      ) : (
        <MisCupones cupones={porUsar} solo="por_usar" />
      )}

      <div className={styles.recSeccion}>Tus negocios · {negocios.length}</div>
      <div className={styles.histCard}>
        {negocios.map((n) => (
          <div key={n.profile_id} className={styles.usadoFila}>
            <BrandAvatar name={n.brand_name} logoUrl={n.logo_url} size={38} radius={12} />
            <div style={{ minWidth: 0 }}>
              <div className={styles.usadoTitulo}>{n.brand_name}</div>
              {n.location && <div className={styles.usadoDetalle}>{n.location}</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
