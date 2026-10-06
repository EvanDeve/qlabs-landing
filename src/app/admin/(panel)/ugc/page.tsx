import Link from "next/link";
import { requireArea } from "@/lib/auth/areas";
import { QosIcon } from "@/lib/ugc/qos-icons";
import { estadoCuenta } from "@/lib/ugc/estado-cuenta";
import { displayHandle } from "@/lib/ugc/handles";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

/**
 * La primera pantalla del área UGC: cuánto hay de cada cosa y qué está
 * esperando a alguien del equipo. El detalle sigue en Marketplace, Loyalty y
 * Disputas; esto es para entrar y saber por dónde empezar.
 */
export default async function ResumenUgcPage() {
  const { supabase } = await requireArea("ugc");

  // Conteos con `head: true`: lo que importa es el número, y traer las filas
  // de todo el marketplace para contarlas en JS es egress tirado.
  const contar = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);

  const [
    { data: creadores },
    { data: marcas },
    campanasActivas,
    aplicacionesEnCurso,
    disputas,
    miembrosActivos,
    canjeados,
    reclamados,
  ] = await Promise.all([
    // Creadores y marcas sí vienen enteros (solo las columnas del estado): son
    // pocos, y de acá salen tanto los totales como la lista de pendientes.
    supabase
      .from("creator_profiles")
      .select("profile_id, handle, verified, rejected_at"),
    supabase
      .from("brand_profiles")
      .select("profile_id, brand_name, verified, rejected_at"),
    contar(
      supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .in("status", ["published", "in_progress"])
    ),
    contar(
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "reviewing", "accepted", "delivered"])
    ),
    contar(supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "disputed")),
    contar(supabase.from("members").select("profile_id", { count: "exact", head: true }).eq("status", "activo")),
    contar(supabase.from("redemptions").select("id", { count: "exact", head: true }).eq("status", "canjeado")),
    contar(supabase.from("redemptions").select("id", { count: "exact", head: true }).eq("status", "reclamado")),
  ]);

  const listaCreadores = creadores ?? [];
  const listaMarcas = marcas ?? [];
  const creadoresVerificados = listaCreadores.filter((c) => estadoCuenta(c) === "verificada").length;
  const marcasVerificadas = listaMarcas.filter((m) => estadoCuenta(m) === "verificada").length;

  const porVerificar = [
    ...listaCreadores
      .filter((c) => estadoCuenta(c) === "pendiente")
      .map((c) => ({ id: c.profile_id, nombre: displayHandle(c.handle), tipo: "Creador" })),
    ...listaMarcas
      .filter((m) => estadoCuenta(m) === "pendiente")
      .map((m) => ({ id: m.profile_id, nombre: m.brand_name, tipo: "Marca" })),
  ];

  // Las fichas de creador y de marca no tienen fecha propia: la del alta es la
  // de `profiles`. Lo más viejo primero, porque quien lleva más días esperando
  // es por quien se empieza.
  const { data: altas } = porVerificar.length
    ? await supabase.from("profiles").select("id, created_at").in("id", porVerificar.map((p) => p.id))
    : { data: [] };
  const altaPorId = new Map((altas ?? []).map((a) => [a.id, a.created_at]));
  const pendientes = porVerificar
    .map((p) => ({ ...p, desde: altaPorId.get(p.id) ?? null }))
    .sort((a, b) => (a.desde ?? "").localeCompare(b.desde ?? ""));

  const kpis: { label: string; value: number; sub: string; tone?: "ok" | "warn" | "risk" }[][] = [
    [
      { label: "Creadores", value: listaCreadores.length, sub: `${creadoresVerificados} verificados` },
      { label: "Marcas", value: listaMarcas.length, sub: `${marcasVerificadas} verificadas` },
      {
        label: "Por verificar",
        value: pendientes.length,
        sub: "creadores y marcas esperando",
        tone: pendientes.length > 0 ? "warn" : undefined,
      },
      { label: "Campañas activas", value: campanasActivas, sub: "publicadas o en curso" },
    ],
    [
      { label: "Aplicaciones en curso", value: aplicacionesEnCurso, sub: "sin cerrar todavía" },
      {
        label: "Disputas abiertas",
        value: disputas,
        sub: "esperan una resolución",
        tone: disputas > 0 ? "risk" : undefined,
      },
      { label: "Close Friends", value: miembrosActivos, sub: "miembros activos" },
      { label: "Cupones canjeados", value: canjeados, sub: `${reclamados} reclamados sin canjear` },
    ],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {kpis.map((fila, i) => (
        <div key={i} className={styles.statCard}>
          <div className={styles.statRow}>
            {fila.map((kpi) => (
              <div key={kpi.label} className={styles.stat}>
                <div className={styles.statLabel}>{kpi.label}</div>
                <div className={styles.statNum}>{kpi.value}</div>
                <div className={styles.statSub} data-tone={kpi.tone}>
                  {kpi.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className={styles.card} style={{ padding: 18 }}>
        <div className={styles.sectionHead}>
          <h2>Por verificar ({pendientes.length})</h2>
          <Link href="/admin/marketplace" className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}>
            Ir a Marketplace
          </Link>
        </div>
        {pendientes.length === 0 ? (
          <p className={styles.attnMeta}>
            <QosIcon name="check" size={12} /> No hay cuentas esperando verificación.
          </p>
        ) : (
          pendientes.slice(0, 10).map((p) => (
            <Link key={`${p.tipo}-${p.id}`} href="/admin/marketplace" className={styles.attnItem}>
              <div className={styles.attnBody}>
                <div className={styles.attnTitle}>{p.nombre}</div>
                <div className={styles.attnMeta}>
                  {p.tipo}
                  {p.desde &&
                    ` · se registró el ${new Date(p.desde).toLocaleDateString("es-CR", {
                      day: "numeric",
                      month: "short",
                      timeZone: "America/Costa_Rica",
                    })}`}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
