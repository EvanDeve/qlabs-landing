import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pasosDeCampana, fechaLimite } from "@/lib/ugc/application-steps";
import { entregablesEnLinea } from "@/lib/ugc/deliverables";
import { displayHandle } from "@/lib/ugc/handles";
import RielCampana from "@/components/ugc/marca/RielCampana";
import AvataresAplicantes, { type CaraAplicante } from "@/components/ugc/marca/AvataresAplicantes";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";
import PantallaHeader from "@/components/ugc/PantallaHeader";

export const dynamic = "force-dynamic";

/**
 * El Resumen de la marca.
 *
 * ⚠️ Acá vivía el "Centro de Mando": tres KPIs y una grilla de seis tarjetas
 * con los sistemas de Q Labs —UGC·CRC, Loyalty Loop y cuatro más que linkeaban
 * a qlabsmethod.com—. Evan las sacó el 2026-08-26 al rediseñar la pantalla: la
 * home pasó a ser lo que hay que decidir HOY. Se le señaló que con eso se va la
 * única vitrina de los otros cuatro sistemas dentro del panel y aun así eligió
 * sacarlas, así que **no volver a proponerlas**. UGC·CRC y Loyalty Loop no se
 * perdieron: son dos de las cuatro pestañas de la barra de abajo.
 */
export default async function MarcaResumenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: brand }, { data: campaigns }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user!.id).single(),
    supabase.from("brand_profiles").select("brand_name").eq("profile_id", user!.id).maybeSingle(),
    supabase
      .from("campaigns")
      .select("id, title, status, budget_amount, deliverables, deadline_days, created_at")
      .eq("brand_id", user!.id)
      .in("status", ["published", "in_progress"])
      .order("created_at", { ascending: false }),
  ]);

  const activas = campaigns ?? [];
  const ids = activas.map((c) => c.id);

  // Las aplicaciones traen el perfil del creador para las caras de la tarjeta
  // negra y para decir quién entrega. Un solo viaje: pedirlas por campaña sería
  // una consulta por tarjeta.
  const { data: apps } = ids.length
    ? await supabase
        .from("applications")
        .select(
          "id, campaign_id, status, accepted_at, delivered_at, approved_at, created_at, creator:profiles!applications_creator_id_fkey(id, display_name, avatar_url, creator_profiles(handle))"
        )
        .in("campaign_id", ids)
    : { data: [] };

  const aplicaciones = (apps ?? []) as unknown as {
    id: string;
    campaign_id: string;
    status: string;
    accepted_at: string | null;
    delivered_at: string | null;
    approved_at: string | null;
    created_at: string;
    creator: {
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      creator_profiles: { handle: string | null } | null;
    } | null;
  }[];

  const porRevisar = aplicaciones.filter((a) => a.status === "pending" || a.status === "reviewing");

  // Los cupones que alguien reclamó y todavía no canjeó: es lo único de Loyalty
  // que le pide algo a la marca (que valide cuando la persona llegue).
  const { data: cupones } = await supabase
    .from("coupons")
    .select("id, title")
    .eq("brand_id", user!.id);

  // Los canjes van en su propia consulta y no anidados bajo `coupons`: la
  // relación no está declarada en los tipos generados y el join no compila.
  const { data: reclamos } = (cupones ?? []).length
    ? await supabase
        .from("redemptions")
        .select("id, coupon_id, creator_id, expires_at")
        // Ojo: los estados de `redemptions` están en español. "claimed" compila
        // como string pero no matchea ninguna fila, y la tarjeta no aparecería
        // nunca sin que nadie se entere.
        .eq("status", "reclamado")
        .in("coupon_id", (cupones ?? []).map((c) => c.id))
    : { data: [] };

  // Un cupón vencido no es "sin usar": la tarjeta dice que la persona PUEDE
  // llegar a canjearlo, y con la fecha pasada eso ya no es cierto. El estado
  // 'expirado' lo pone un job, así que no alcanza con filtrar por status.
  // Server Component con `force-dynamic`: corre una vez por request y "ahora"
  // es el dato que hace falta para saber si el cupón todavía sirve. No hay
  // re-render que lo mueva, que es contra lo que protege la regla.
  // eslint-disable-next-line react-hooks/purity
  const ahora = Date.now();
  const sinUsar = (reclamos ?? [])
    .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > ahora)
    .map((r) => ({
      cupon: (cupones ?? []).find((c) => c.id === r.coupon_id)?.title ?? "",
      creatorId: r.creator_id,
    }));

  // El handle de quien tiene el cupón sin usar. Se pide aparte porque
  // `redemptions` cuelga de `coupons` y no del perfil.
  const { data: handlesCupon } = sinUsar.length
    ? await supabase
        .from("creator_profiles")
        .select("profile_id, handle")
        .in("profile_id", [...new Set(sinUsar.map((s) => s.creatorId))])
    : { data: [] };

  const handleDe = (id: string) =>
    displayHandle((handlesCupon ?? []).find((h) => h.profile_id === id)?.handle ?? "");

  const caras: CaraAplicante[] = porRevisar.map((a) => ({
    id: a.id,
    nombre: a.creator?.display_name ?? "Creador",
    avatarUrl: a.creator?.avatar_url ?? null,
  }));

  // De qué campaña son los que hay que revisar. Si vienen de varias, decir el
  // título de una sería mentir sobre las otras.
  const campanasConPendientes = new Set(porRevisar.map((a) => a.campaign_id));
  const subtituloDecidir =
    campanasConPendientes.size === 1
      ? (activas.find((c) => c.id === [...campanasConPendientes][0])?.title ?? "")
      : `En ${campanasConPendientes.size} campañas`;

  // El mockup dice "Buenas, Marce" con el negocio arriba, o sea que espera el
  // nombre de una PERSONA. Pero en muchas cuentas `display_name` es el nombre
  // del negocio —se copia al registrarse— y el saludo salía "Buenas, Cafetería"
  // debajo de "Cafetería Los Higuerones". Si son lo mismo, no se saluda por
  // nombre: mejor un saludo corto que repetir la línea de arriba.
  const nombrePersona = (profile?.display_name ?? "").trim();
  const esElNegocio =
    !nombrePersona ||
    nombrePersona.toLowerCase() === (brand?.brand_name ?? "").trim().toLowerCase();
  const saludo = esElNegocio ? "Buenas" : `Buenas, ${nombrePersona.split(" ")[0]}`;

  return (
    <div className={styles.mcCol}>
      <PantallaHeader rotulo={brand?.brand_name || undefined} titulo={saludo} />

      {porRevisar.length > 0 && (
        <div className={styles.mcDecidir}>
          <div className={styles.mcDecidirLabel}>Te toca decidir</div>
          <div className={styles.mcDecidirFila}>
            <AvataresAplicantes caras={caras} />
            <span className={styles.mcDecidirTxt}>
              <span className={styles.mcDecidirNum}>
                {porRevisar.length} aplicante{porRevisar.length === 1 ? "" : "s"} por revisar
              </span>
              <span className={styles.mcDecidirSub}>{subtituloDecidir}</span>
            </span>
          </div>
          <Link
            href={
              campanasConPendientes.size === 1
                ? `/ugc/marca/campanas/${[...campanasConPendientes][0]}`
                : "/ugc/marca/ugc"
            }
            className={styles.mcDecidirBtn}
          >
            Revisar aplicantes
          </Link>
        </div>
      )}

      <h2 className={styles.mcSecTit}>
        {activas.length === 1 ? "Tu campaña activa" : "Tus campañas activas"}
      </h2>

      {activas.length > 0 ? (
        activas.map((c) => {
          const suyas = aplicaciones.filter((a) => a.campaign_id === c.id);
          // Solo las que avanzaron cuentan para el riel: una rechazada o
          // cancelada no es un paso adelante de la campaña.
          const vivas = suyas.filter((a) => !["rejected", "cancelled"].includes(a.status));
          const entregando = vivas.filter((a) => a.accepted_at && !a.delivered_at && !a.approved_at);
          // Las que ya entregaron y esperan la aprobación. Sin esta línea, una
          // campaña con su única colaboración entregada mostraba el riel en
          // "Aprobás vos" y ni una palabra de quién ni de qué hay que aprobar.
          const porAprobar = vivas.filter((a) => a.delivered_at && !a.approved_at);
          const entregables = entregablesEnLinea(c.deliverables);

          return (
            <div key={c.id} className={styles.mcCard}>
              <div className={styles.mcCardTop}>
                <div style={{ minWidth: 0 }}>
                  <div className={styles.mcCardTitulo}>{c.title}</div>
                  <div className={styles.mcCardMeta}>
                    {c.budget_amount != null &&
                      `₡${c.budget_amount.toLocaleString("es-CR")} de presupuesto`}
                    {c.budget_amount != null && entregables && " · "}
                    {entregables}
                  </div>
                </div>
                <span
                  className={`${styles.mcEstado} ${
                    c.status === "published" ? "" : styles.mcEstadoQuieto
                  }`}
                >
                  {c.status === "published" ? "Publicada" : "En curso"}
                </span>
              </div>

              <RielCampana pasos={pasosDeCampana(vivas)} />

              {entregando.map((a) => {
                const limite = fechaLimite(a.accepted_at, c.deadline_days);
                return (
                  <Link
                    key={a.id}
                    href={`/ugc/marca/campanas/${c.id}`}
                    className={styles.mcCardFila}
                  >
                    <span className={styles.mcFilaPunto} />
                    <span className={styles.mcFilaTxt}>
                      {displayHandle(a.creator?.creator_profiles?.handle ?? "") || "Un creador"}{" "}
                      {limite
                        ? `entrega el ${limite.toLocaleDateString("es-CR", {
                            day: "numeric",
                            month: "long",
                          })}`
                        : "está grabando"}
                    </span>
                    <QosIcon name="chevR" size={16} className={styles.mcFilaChev} />
                  </Link>
                );
              })}

              {porAprobar.map((a) => (
                <Link
                  key={a.id}
                  href={`/ugc/marca/campanas/${c.id}`}
                  className={styles.mcCardFila}
                >
                  <span className={styles.mcFilaPunto} style={{ background: "var(--ok)" }} />
                  <span className={styles.mcFilaTxt}>
                    {displayHandle(a.creator?.creator_profiles?.handle ?? "") || "Un creador"} ya
                    entregó — te toca aprobar
                  </span>
                  <QosIcon name="chevR" size={16} className={styles.mcFilaChev} />
                </Link>
              ))}

            </div>
          );
        })
      ) : (
        <div className={styles.mcVacio}>
          <QosIcon name="megaphone" size={26} className={styles.trVacioIc} />
          <p className={styles.mcVacioTxt}>
            No tenés campañas corriendo. Publicá una y los creadores verificados van a poder
            aplicar.
          </p>
        </div>
      )}

      {sinUsar.length > 0 && (
        <div className={styles.mcCupon}>
          <span className={styles.mcCuponIc}>
            <QosIcon name="grid" size={19} />
          </span>
          <span className={styles.mcCuponTxt}>
            <span className={styles.mcCuponTit}>
              {sinUsar.length} cupón{sinUsar.length === 1 ? "" : "es"} sin usar
            </span>
            <span className={styles.mcCuponSub}>
              {sinUsar.length === 1
                ? `${handleDe(sinUsar[0].creatorId)} puede llegar a canjearlo`
                : "Pueden llegar a canjearlos"}
            </span>
          </span>
          <Link href="/ugc/marca/validar" className={styles.mcCuponBtn}>
            Validar
          </Link>
        </div>
      )}

      <Link href="/ugc/marca/campanas/nueva" className={styles.mcPublicar}>
        <QosIcon name="plus" size={17} />
        Publicar {activas.length > 0 ? "otra" : "una"} campaña
      </Link>
    </div>
  );
}
