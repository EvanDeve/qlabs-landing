import Link from "next/link";
import { requireArea } from "@/lib/auth/areas";
import { fechaCorta } from "@/lib/ugc/loyalty";
import { CF } from "@/lib/cf/copy";
import { cargarCfPorNegocio } from "@/lib/cf/por-negocio";
import { resolverEliminacionAction } from "@/lib/actions/close-friends-admin";
import ConfirmDeleteButton from "@/components/ugc/admin/ConfirmDeleteButton";
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

const DIA_MS = 24 * 60 * 60 * 1000;

/** Días enteros desde ese instante hasta ahora. */
function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DIA_MS);
}

/**
 * Close Friends desde adentro: cuántos clientes se sumaron, por qué negocio,
 * y qué pidieron. Es solo lectura —el alta, los vínculos y los canjes pasan
 * por las funciones de la base— salvo las solicitudes de eliminación, que
 * alguien del equipo atiende borrando la cuenta (resolverEliminacionAction).
 *
 * Los datos personales (teléfono, fecha de nacimiento) NO se muestran: para
 * administrar el programa alcanza con el nombre de agente y el expediente.
 */
// En celular las tablas son más anchas que la pantalla: scrollean dentro de su
// tarjeta y no arrastran la página entera de costado.
export default async function AdminCloseFriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ negocio?: string; estado?: string }>;
}) {
  const { supabase } = await requireArea("ugc");
  const { negocio, estado } = await searchParams;

  const [{ data: miembros }, { data: solicitudes }, { negocios, vinculos: listaVinculos }] = await Promise.all([
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
  for (const v of listaVinculos) negociosDe.set(v.member_id, [...(negociosDe.get(v.member_id) ?? []), v.brand_id]);

  const estadoFiltro = ESTADOS.some((e) => e.id === estado) ? (estado as MemberStatus) : null;
  const negocioFiltro = negocio && porNegocio.has(negocio) ? negocio : null;
  const filtrados = listaMiembros.filter(
    (m) =>
      (!estadoFiltro || m.status === estadoFiltro) &&
      (!negocioFiltro || (negociosDe.get(m.profile_id) ?? []).includes(negocioFiltro))
  );

  const miembroPorId = new Map(listaMiembros.map((m) => [m.profile_id, m]));

  const contar = (s: MemberStatus) => listaMiembros.filter((m) => m.status === s).length;
  const totalEscaneos = negocios.reduce((n, f) => n + f.escaneos, 0);
  const totalCanjeados = negocios.reduce((n, f) => n + f.canjeados, 0);
  const pendientes = solicitudes ?? [];

  const kpis: { label: string; value: number; sub: string; tone?: "warn" | "risk" }[] = [
    { label: "Miembros activos", value: contar("activo"), sub: `${listaMiembros.length} en total` },
    { label: "Negocios", value: negocios.length, sub: "con QR o con miembros" },
    { label: "Escaneos del QR", value: totalEscaneos, sub: `${negocios.reduce((n, f) => n + f.registros, 0)} terminaron en registro` },
    { label: "Cupones canjeados", value: totalCanjeados, sub: "por miembros, en caja" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className={styles.statCard}>
        <div className={styles.statRow}>
          {kpis.map((kpi) => (
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

      {/* Va primero cuando hay: es lo único de la pantalla que espera a
          alguien del equipo. */}
      {pendientes.length > 0 && (
        <div className={`${styles.card} ${styles.cardPad}`}>
          <div className={styles.sectionHead}>
            <h2>Solicitudes de eliminación ({pendientes.length})</h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className={styles.acctTable}>
              <thead>
                <tr>
                  <th>Miembro</th>
                  <th>Expediente</th>
                  <th>Motivo</th>
                  <th>Pedida</th>
                  <th style={{ textAlign: "right" }}>Días esperando</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pendientes.map((s) => {
                  const m = s.member_id ? miembroPorId.get(s.member_id) : undefined;
                  const dias = diasDesde(s.created_at);
                  return (
                    <tr key={s.id}>
                      <td>
                        <b>{m?.agent_name ?? "—"}</b>
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{m?.expediente_code ?? "—"}</td>
                      <td style={{ color: "var(--ink-2)" }}>{s.reason || "Sin motivo"}</td>
                      <td style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>{fechaCorta(s.created_at)}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className={`${styles.riskPill} ${dias >= 7 ? styles.riskRisk : styles.riskWarn}`}>{dias}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <ConfirmDeleteButton
                          action={resolverEliminacionAction.bind(null, s.id)}
                          confirmMessage={`Se borra la cuenta de ${m?.agent_name ?? "este miembro"} con todos sus datos personales, consentimientos y vínculos con negocios. Sus canjes quedan en los registros de cada negocio, sin su nombre. No se puede deshacer.`}
                          className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          Eliminar cuenta
                        </ConfirmDeleteButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={`${styles.card} ${styles.cardPad}`}>
        <div className={styles.sectionHead}>
          <h2>Por negocio</h2>
        </div>
        {negocios.length === 0 ? (
          <div className={styles.empty}>Ningún negocio tiene {CF.programa} todavía.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className={styles.acctTable}>
              <thead>
                <tr>
                  <th>Negocio</th>
                  <th style={{ textAlign: "right" }}>Miembros</th>
                  <th style={{ textAlign: "right" }}>Escaneos</th>
                  <th style={{ textAlign: "right" }}>Registros</th>
                  <th style={{ textAlign: "right" }}>Cupones reclamados</th>
                  <th style={{ textAlign: "right" }}>Canjeados</th>
                </tr>
              </thead>
              <tbody>
                {negocios.map((f) => (
                  <tr key={f.id}>
                    <td>
                      {/* El nombre filtra la lista de abajo: la pregunta que
                          sigue a "Zonna tiene 12" es "¿quiénes?". */}
                      <Link href={`/admin/close-friends?negocio=${f.id}#miembros`}>
                        <b>{f.nombre}</b>
                      </Link>
                    </td>
                    <td style={{ textAlign: "right" }}>{f.miembros}</td>
                    <td style={{ textAlign: "right" }}>{f.escaneos}</td>
                    <td style={{ textAlign: "right" }}>{f.registros}</td>
                    <td style={{ textAlign: "right" }}>{f.reclamados}</td>
                    <td style={{ textAlign: "right" }}>{f.canjeados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div id="miembros" className={`${styles.card} ${styles.cardPad}`}>
        <div className={styles.sectionHead}>
          <h2>
            {CF.miembros} ({filtrados.length}
            {filtrados.length !== listaMiembros.length ? ` de ${listaMiembros.length}` : ""})
          </h2>
        </div>

        {/* Un GET de toda la vida: el filtro queda en la URL y funciona sin
            JavaScript. */}
        <form method="get" action="/admin/close-friends#miembros" style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end", marginBottom: "16px" }}>
          <div className={styles.field} style={{ minWidth: "200px" }}>
            <label>Negocio</label>
            <select name="negocio" defaultValue={negocioFiltro ?? ""} className={styles.selectInp}>
              <option value="">Todos</option>
              {negocios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field} style={{ minWidth: "200px" }}>
            <label>Estado</label>
            <select name="estado" defaultValue={estadoFiltro ?? ""} className={styles.selectInp}>
              <option value="">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label} ({contar(e.id)})
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
            Filtrar
          </button>
          {(negocioFiltro || estadoFiltro) && (
            <Link href="/admin/close-friends#miembros" className={`${styles.btn} ${styles.btnGhost}`}>
              Limpiar
            </Link>
          )}
        </form>

        {filtrados.length === 0 ? (
          <div className={styles.empty}>
            {listaMiembros.length === 0 ? `Todavía no se sumó nadie a ${CF.programa}.` : "Nadie coincide con ese filtro."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className={styles.acctTable}>
              <thead>
                <tr>
                  <th>Agente</th>
                  <th>Expediente</th>
                  <th>Negocios</th>
                  <th>Estado</th>
                  <th>Se sumó</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((m) => (
                  <tr key={m.profile_id}>
                    <td>
                      <b>{m.agent_name}</b>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{m.expediente_code}</td>
                    <td style={{ color: "var(--ink-2)" }}>
                      {(negociosDe.get(m.profile_id) ?? []).map((id) => porNegocio.get(id)?.nombre ?? "—").join(", ") || "—"}
                    </td>
                    <td>
                      <span className={`${styles.riskPill} ${PILL_ESTADO[m.status].clase}`}>{PILL_ESTADO[m.status].label}</span>
                    </td>
                    <td style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>{fechaCorta(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
