import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { creatorPayout } from "@/lib/ugc/payout";
import { daysUntil, dueLabel } from "@/lib/ugc/creator-task";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export const dynamic = "force-dynamic";

const KPI_COLORS = ["#6d54f3", "#c07414", "#14a06a", "#df4650"];

const colones = (n: number) => `₡${n.toLocaleString("es-CR")}`;

/**
 * Fecha límite de una entrega. No existe como columna: se deriva de cuándo la
 * marca aceptó más los días que la campaña dio de plazo. Si falta cualquiera de
 * los dos, no hay fecha — y eso se muestra como "sin fecha", nunca como vencido.
 */
function fechaLimite(acceptedAt: string | null, deadlineDays: number | null): Date | null {
  if (!acceptedAt || !deadlineDays) return null;
  const d = new Date(acceptedAt);
  d.setDate(d.getDate() + deadlineDays);
  return d;
}

function diasRestantes(limite: Date): number {
  const hoy = new Date();
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const limSinHora = new Date(limite.getFullYear(), limite.getMonth(), limite.getDate());
  return Math.round((limSinHora.getTime() - hoySinHora.getTime()) / 86_400_000);
}

export default async function CreadorHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: applications },
    { data: tasks },
    { data: taskColumns },
    { data: creatorProfile },
    { count: bookCount },
  ] = await Promise.all([
    supabase.from("applications").select("*").eq("creator_id", user!.id),
    supabase.from("creator_tasks").select("*").eq("creator_id", user!.id),
    supabase
      .from("creator_task_columns")
      .select("*")
      .eq("creator_id", user!.id)
      .order("position", { ascending: true }),
    supabase.from("creator_profiles").select("verified").eq("profile_id", user!.id).maybeSingle(),
    supabase
      .from("portfolio_items")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", user!.id),
  ]);

  const apps = applications ?? [];
  const campaignIds = [...new Set(apps.map((a) => a.campaign_id))];
  const { data: campaigns } = campaignIds.length
    ? await supabase
        .from("campaigns")
        .select("id, title, budget_amount, deadline_days, brand_id")
        .in("id", campaignIds)
    : { data: [] };
  const campaignById = new Map((campaigns ?? []).map((c) => [c.id, c]));

  const brandIds = [...new Set((campaigns ?? []).map((c) => c.brand_id))];
  const { data: brands } = brandIds.length
    ? await supabase.from("brand_profiles").select("profile_id, brand_name").in("profile_id", brandIds)
    : { data: [] };
  const brandNameById = new Map((brands ?? []).map((b) => [b.profile_id, b.brand_name]));

  const enProduccion = apps.filter((a) => a.status === "accepted");
  const esperandoRespuesta = apps.filter((a) => a.status === "pending" || a.status === "reviewing");
  // "Por cobrar" incluye lo entregado y lo aprobado: el pago se coordina por
  // fuera y no hay registro de que se haya hecho, así que aprobado ≠ cobrado.
  const porCobrar = apps.filter((a) => a.status === "delivered" || a.status === "approved");

  const montoPorCobrar = porCobrar.reduce((sum, a) => {
    const c = campaignById.get(a.campaign_id);
    return sum + (c ? creatorPayout(c.budget_amount) : 0);
  }, 0);

  const tareas = tasks ?? [];
  const columnas = taskColumns ?? [];
  // Qué cuenta como terminado lo define la columna (`is_done`), no su nombre ni
  // su posición: el creador arma sus propias columnas y puede llamarlas como
  // quiera, así que buscar "publicado" por texto no serviría.
  const columnasHechas = new Set(columnas.filter((c) => c.is_done).map((c) => c.id));
  const tareasAbiertas = tareas.filter((t) => !columnasHechas.has(t.column_id));
  const tareasAtrasadas = tareasAbiertas.filter((t) => t.due_date && daysUntil(t.due_date) < 0);

  // Entregas ordenadas por urgencia. Las que no tienen fecha van al final.
  const entregas = enProduccion
    .map((a) => {
      const c = campaignById.get(a.campaign_id);
      const limite = fechaLimite(a.accepted_at, c?.deadline_days ?? null);
      return {
        id: a.id,
        titulo: c?.title ?? "Campaña",
        marca: c ? brandNameById.get(c.brand_id) ?? null : null,
        monto: c ? creatorPayout(c.budget_amount) : null,
        dias: limite ? diasRestantes(limite) : null,
      };
    })
    .sort((a, b) => (a.dias ?? Infinity) - (b.dias ?? Infinity));

  const kpis = [
    { label: "En producción", value: String(enProduccion.length), icon: "film" },
    { label: "Esperando respuesta", value: String(esperandoRespuesta.length), icon: "clock" },
    { label: "Por cobrar", value: colones(montoPorCobrar), icon: "briefcase" },
    { label: "Tareas atrasadas", value: String(tareasAtrasadas.length), icon: "alert" },
  ];

  // Cada fila nombra algo accionable. Si no hay ninguna, no se inventa relleno:
  // la sección muestra que está todo al día.
  const atencion: { texto: string; detalle: string; href: string; urgente: boolean }[] = [];

  for (const e of entregas) {
    if (e.dias === null) continue;
    if (e.dias < 0) {
      atencion.push({
        texto: e.titulo,
        detalle: `Entrega vencida hace ${Math.abs(e.dias)} ${Math.abs(e.dias) === 1 ? "día" : "días"}`,
        href: "/ugc/creador/aplicaciones",
        urgente: true,
      });
    } else if (e.dias <= 3) {
      atencion.push({
        texto: e.titulo,
        detalle: e.dias === 0 ? "Se entrega hoy" : `Se entrega en ${e.dias} ${e.dias === 1 ? "día" : "días"}`,
        href: "/ugc/creador/aplicaciones",
        urgente: e.dias === 0,
      });
    }
  }

  for (const t of tareasAtrasadas) {
    atencion.push({
      texto: t.title,
      detalle: `Tarea ${dueLabel(t.due_date!)}`,
      href: "/ugc/creador/pipeline",
      urgente: true,
    });
  }

  if (!creatorProfile?.verified) {
    atencion.push({
      texto: "Tu perfil está en revisión",
      detalle: "Mientras tanto no podés aplicar a promos. Completá tu book para acelerar la verificación.",
      href: "/ugc/creador/book",
      urgente: false,
    });
  } else if ((bookCount ?? 0) === 0) {
    atencion.push({
      texto: "Tu book está vacío",
      detalle: "Las marcas miran tu book antes de aceptarte. Subí al menos una pieza.",
      href: "/ugc/creador/book",
      urgente: false,
    });
  }

  return (
    <div>
      <h1 className={styles.tbTitle} style={{ fontSize: "26px" }}>
        Resumen
      </h1>
      <p style={{ color: "var(--ink-2)", marginBottom: "20px" }}>
        Cómo va tu trabajo hoy.
      </p>

      <div className={styles.kpiRow}>
        {kpis.map((kpi, i) => (
          <div key={kpi.label} className={styles.kpi}>
            <div className={styles.kTop}>
              <div
                className={styles.kIc}
                style={{ background: `${KPI_COLORS[i]}22`, color: KPI_COLORS[i] }}
              >
                <QosIcon name={kpi.icon} size={16} />
              </div>
              <div className={styles.kLabel}>{kpi.label}</div>
            </div>
            <div className={styles.kNum} style={{ color: KPI_COLORS[i] }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)" }}>
        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionHeadBig}>Requiere tu atención</h2>
          </div>
          <div className={styles.cardPad} style={{ paddingTop: 0 }}>
            {atencion.length > 0 ? (
              atencion.map((a, i) => (
                <Link
                  key={`${a.texto}-${i}`}
                  href={a.href}
                  style={{
                    display: "block",
                    padding: "12px 0",
                    borderBottom: i < atencion.length - 1 ? "1px solid var(--line)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      className={styles.dot}
                      style={{ background: a.urgente ? "#df4650" : "#c07414", flexShrink: 0 }}
                    />
                    <b style={{ fontSize: "14px" }}>{a.texto}</b>
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--ink-2)", marginLeft: "16px" }}>
                    {a.detalle}
                  </div>
                </Link>
              ))
            ) : (
              <p style={{ color: "var(--ink-2)", fontSize: "13.5px", padding: "12px 0" }}>
                Todo al día. Nada vencido ni por vencer.
              </p>
            )}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <h2>Mi pipeline</h2>
            <Link href="/ugc/creador/pipeline" className={styles.sectionHeadAct}>
              Ver tablero
            </Link>
          </div>
          <div className={styles.cardPad} style={{ paddingTop: 0 }}>
            {tareas.length > 0 ? (
              columnas.map((col) => {
                const n = tareas.filter((t) => t.column_id === col.id).length;
                return (
                  <div
                    key={col.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "9px 0",
                      fontSize: "14px",
                    }}
                  >
                    <span
                      className={styles.dot}
                      style={{ background: col.color, flexShrink: 0 }}
                    />
                    <span style={{ color: "var(--ink-2)" }}>{col.name}</span>
                    <b style={{ marginLeft: "auto" }}>{n}</b>
                  </div>
                );
              })
            ) : (
              <p style={{ color: "var(--ink-2)", fontSize: "13.5px", padding: "12px 0" }}>
                Todavía no tenés tareas.{" "}
                <Link href="/ugc/creador/pipeline" style={{ color: "var(--b-600)", fontWeight: 600 }}>
                  Armá tu tablero
                </Link>
                .
              </p>
            )}
          </div>
        </section>
      </div>

      <section className={styles.card} style={{ marginTop: "16px" }}>
        <div className={styles.sectionHead}>
          <h2>Entregas en curso</h2>
          <Link href="/ugc/creador/aplicaciones" className={styles.sectionHeadAct}>
            Ver todas
          </Link>
        </div>
        <div className={styles.cardPad} style={{ paddingTop: 0 }}>
          {entregas.length > 0 ? (
            entregas.map((e, i) => (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 0",
                  borderBottom: i < entregas.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                  <b style={{ fontSize: "14px" }}>{e.titulo}</b>
                  {e.marca && (
                    <div style={{ fontSize: "13px", color: "var(--ink-2)" }}>{e.marca}</div>
                  )}
                </div>
                {e.monto !== null && (
                  <span style={{ fontWeight: 700, fontSize: "14px" }}>{colones(e.monto)}</span>
                )}
                <span
                  className={`${styles.kcDue} ${e.dias !== null && e.dias < 0 ? styles.kcDueLate : ""}`}
                >
                  <QosIcon name="clock" size={12} />
                  {e.dias === null
                    ? "sin fecha"
                    : e.dias < 0
                      ? `venció hace ${Math.abs(e.dias)}d`
                      : e.dias === 0
                        ? "vence hoy"
                        : `en ${e.dias}d`}
                </span>
              </div>
            ))
          ) : (
            <p style={{ color: "var(--ink-2)", fontSize: "13.5px", padding: "12px 0" }}>
              No tenés entregas en curso.{" "}
              <Link href="/ugc/creador/promos" style={{ color: "var(--b-600)", fontWeight: 600 }}>
                Mirá las promos abiertas
              </Link>
              .
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
