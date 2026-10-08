import Link from "next/link";
import { requireArea } from "@/lib/auth/areas";
import { fechaCorta } from "@/lib/ugc/loyalty";
import { CF } from "@/lib/cf/copy";
import { cargarCfPorNegocio } from "@/lib/cf/por-negocio";
import { resolverEliminacionAction } from "@/lib/actions/close-friends-admin";
import ConfirmDeleteButton from "@/components/ugc/admin/ConfirmDeleteButton";
import FiltroSelects from "@/components/ugc/admin/FiltroSelects";
import { diasDesde, textoDias } from "@/lib/ugc/marketplace-admin";
import type { MemberStatus } from "@/lib/database.types";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

const ESTADOS: { id: MemberStatus; label: string }[] = [
  { id: "activo", label: "Activos" },
  { id: "eliminacion_pedida", label: "Pidieron eliminación" },
  { id: "suspendido", label: "Suspendidos" },
];

const PILL_ESTADO: Record<MemberStatus, { label: string; clase: string }> = {
  activo: { label: "Activo", clase: styles.riskOk },
  eliminacion_pedida: { label: "Pidió eliminación", clase: styles.riskRisk },
  suspendido: { label: "Suspendido", clase: styles.riskMuted },
};

/**
 * Close Friends desde adentro: cuántos clientes se sumaron, por qué negocio,
 * y qué pidieron. Es solo lectura —el alta, los vínculos y los canjes pasan
 * por las funciones de la base— salvo las solicitudes de eliminación, que
 * alguien del equipo atiende borrando la cuenta (resolverEliminacionAction).
 *
 * Los datos personales (teléfono, fecha de nacimiento) NO se muestran: para
 * administrar el programa alcanza con el nombre de agente y el expediente.
 */
export default async function AdminCloseFriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ negocio?: string; estado?: string }>;
}) {
  const { supabase } = await requireArea("ugc");
  const { negocio, estado } = await searchParams;

  const [{ data: miembros }, { data: solicitudes }, { negocios, vinculos: listaVinculos }] =
    await Promise.all([
      supabase
        .from("members")
        .select("profile_id, expediente_code, agent_name, status, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("member_deletion_requests")
        .select("id, member_id, reason, created_at")
        .eq("status", "pendiente")
        .order("created_at", { ascending: true }),
      cargarCfPorNegocio(supabase),
    ]);

  const listaMiembros = miembros ?? [];
  const porNegocio = new Map(negocios.map((n) => [n.id, n]));

  // ---- Miembros, con el filtro de la URL ----
  const negociosDe = new Map<string, string[]>();
  for (const v of listaVinculos)
    negociosDe.set(v.member_id, [...(negociosDe.get(v.member_id) ?? []), v.brand_id]);

  const estadoFiltro = ESTADOS.some((e) => e.id === estado) ? (estado as MemberStatus) : null;
  const negocioFiltro = negocio && porNegocio.has(negocio) ? negocio : null;
  const filtrados = listaMiembros.filter(
    (m) =>
      (!estadoFiltro || m.status === estadoFiltro) &&
      (!negocioFiltro || (negociosDe.get(m.profile_id) ?? []).includes(negocioFiltro)),
  );

  const miembroPorId = new Map(listaMiembros.map((m) => [m.profile_id, m]));

  const contar = (s: MemberStatus) => listaMiembros.filter((m) => m.status === s).length;
  const totalEscaneos = negocios.reduce((n, f) => n + f.escaneos, 0);
  const totalCanjeados = negocios.reduce((n, f) => n + f.canjeados, 0);
  const pendientes = solicitudes ?? [];

  const totalRegistros = negocios.reduce((n, f) => n + f.registros, 0);
  const totalReclamados = negocios.reduce((n, f) => n + f.reclamados, 0);
  const stats: { label: string; value: number; sub: string }[] = [
    { label: "Miembros activos", value: contar("activo"), sub: `${listaMiembros.length} en total` },
    { label: "Negocios", value: negocios.length, sub: "en el programa" },
    { label: "Escaneos del QR", value: totalEscaneos, sub: `${totalRegistros} terminaron en registro` },
    { label: "Cupones canjeados", value: totalCanjeados, sub: `${totalReclamados} reclamados` },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p className={styles.bajada} style={{ marginBottom: 4 }}>
        Clientes de los negocios. No se muestran datos personales.
      </p>

      <div className={`${styles.statCard} ${styles.statCardGrupo}`} style={{ paddingTop: 8 }}>
        <div className={styles.statRow}>
          {stats.map((s) => (
            <div key={s.label} className={styles.stat}>
              <div className={styles.statLabel}>{s.label}</div>
              <div className={styles.statNum}>{s.value}</div>
              <div className={styles.statSub}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lo urgente arriba: es lo único de la pantalla que espera a alguien del
          equipo, y tiene plazo. Una franja por solicitud. */}
      {pendientes.map((s) => {
        const m = s.member_id ? miembroPorId.get(s.member_id) : undefined;
        const dias = diasDesde(s.created_at);
        const detalle = [
          m?.agent_name ?? "Un miembro",
          m?.expediente_code ? `exp. ${m.expediente_code}` : null,
          s.reason ? `“${s.reason}”` : "sin motivo",
          `pidió el ${fechaCorta(s.created_at)}`,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <div key={s.id} className={`${styles.card} ${styles.franjaRisk}`}>
            <b>Solicitud de eliminación</b>
            <span className={styles.franjaTxt}>{detalle}</span>
            <span className={`${styles.riskPill} ${dias >= 7 ? styles.riskRisk : styles.riskWarn}`}>
              {textoDias(dias)} esperando
            </span>
            <ConfirmDeleteButton
              action={resolverEliminacionAction.bind(null, s.id)}
              confirmMessage={`Se borra la cuenta de ${m?.agent_name ?? "este miembro"} con todos sus datos personales, consentimientos y vínculos con negocios. Sus canjes quedan en los registros de cada negocio, sin su nombre. No se puede deshacer.`}
              className={`${styles.btn} ${styles.btnSm} ${styles.btnGhostDanger}`}
              style={{ whiteSpace: "nowrap" }}
            >
              Eliminar cuenta
            </ConfirmDeleteButton>
          </div>
        );
      })}

      <div className={`${styles.resGrid} ${styles.cfGrid}`} style={{ alignItems: "start" }}>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <div className={styles.sectionHead}>
            <h2>Por negocio</h2>
          </div>
          {negocios.length === 0 ? (
            <div className={styles.empty}>Ningún negocio tiene {CF.programa} todavía.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className={`${styles.acctTable} ${styles.tablaCompacta}`}>
                <thead>
                  <tr>
                    <th>Negocio</th>
                    <th style={{ textAlign: "right" }}>Miembros</th>
                    <th style={{ textAlign: "right" }}>Escaneos</th>
                    <th style={{ textAlign: "right" }}>Registros</th>
                    {/* Canjeados de reclamados, en una columna: con las dos por
                        separado la tabla no entraba al lado de Miembros. */}
                    <th style={{ textAlign: "right" }}>Canjes</th>
                  </tr>
                </thead>
                <tbody>
                  {negocios.map((f) => (
                    <tr key={f.id}>
                      <td>
                        {/* El nombre filtra la lista de al lado: la pregunta que
                            sigue a "Zonna tiene 12" es "¿quiénes?". */}
                        <Link
                          href={`/admin/close-friends?negocio=${f.id}#miembros`}
                          className={styles.fichaLink}
                        >
                          <b>{f.nombre}</b>
                        </Link>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <b>{f.miembros}</b>
                      </td>
                      <td style={{ textAlign: "right" }}>{f.escaneos}</td>
                      <td style={{ textAlign: "right" }}>{f.registros}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {f.canjeados}
                        <span style={{ color: "var(--ink-3)" }}> de {f.reclamados}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div id="miembros" className={`${styles.card} ${styles.cardPad}`}>
          <div className={`${styles.sectionHead} ${styles.sectionHeadWrap}`}>
            <h2>
              Miembros
              {filtrados.length !== listaMiembros.length && (
                <span className={styles.sectionHeadNota}>
                  {" "}
                  {filtrados.length} de {listaMiembros.length}
                </span>
              )}
            </h2>
            <FiltroSelects
              base="/admin/close-friends"
              selects={[
                {
                  name: "negocio",
                  value: negocioFiltro,
                  todos: "Todos los negocios",
                  opciones: negocios.map((f) => ({ id: f.id, label: f.nombre })),
                },
                {
                  name: "estado",
                  value: estadoFiltro,
                  todos: "Todos los estados",
                  opciones: ESTADOS.map((e) => ({ id: e.id, label: `${e.label} (${contar(e.id)})` })),
                },
              ]}
            />
          </div>

          {filtrados.length === 0 ? (
            <div className={styles.empty}>
              {listaMiembros.length === 0
                ? `Todavía no se sumó nadie a ${CF.programa}.`
                : "Nadie coincide con ese filtro."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className={`${styles.acctTable} ${styles.tablaCompacta}`}>
                <thead>
                  <tr>
                    <th>Agente</th>
                    <th>Expediente</th>
                    <th>Negocios</th>
                    <th>Estado</th>
                    <th style={{ textAlign: "right" }}>Alta</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((m) => (
                    <tr key={m.profile_id}>
                      <td>
                        <b>{m.agent_name}</b>
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--ink-2)" }}>
                        {m.expediente_code}
                      </td>
                      <td style={{ color: "var(--ink-2)", whiteSpace: "normal" }}>
                        {(negociosDe.get(m.profile_id) ?? [])
                          .map((id) => porNegocio.get(id)?.nombre ?? "—")
                          .join(", ") || "—"}
                      </td>
                      <td>
                        <span className={`${styles.riskPill} ${PILL_ESTADO[m.status].clase}`}>
                          {PILL_ESTADO[m.status].label}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "nowrap", color: "var(--ink-2)", textAlign: "right" }}>
                        {fechaCorta(m.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
