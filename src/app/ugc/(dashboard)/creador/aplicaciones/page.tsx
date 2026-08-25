import { createClient } from "@/lib/supabase/server";
import AplicacionCard, { type AplicacionEnCurso } from "@/components/ugc/creador/AplicacionCard";
import { APPLICATION_CLOSED, APPLICATION_STATUS_LABEL } from "@/lib/ugc/application-status";
import { APLICACION_TONO, fechaLimite } from "@/lib/ugc/application-steps";
import { slotsDeCampana } from "@/lib/ugc/delivery-slots";
import type { ApplicationStatus } from "@/lib/database.types";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

/**
 * Orden de "En curso": primero lo que te pide algo a vos.
 *
 * No es la fecha: una aplicación aceptada con el reloj corriendo importa más
 * que una entregada de la semana pasada, aunque la entregada sea más reciente.
 * Dentro de cada grupo sí manda el tiempo — plazo más cercano arriba.
 */
const URGENCIA: Record<ApplicationStatus, number> = {
  accepted: 0,
  pending: 1,
  reviewing: 1,
  delivered: 2,
  disputed: 3,
  approved: 9,
  rejected: 9,
  cancelled: 9,
};

const TONO_CLASE = {
  ok: styles.apliPillOk,
  curso: styles.apliPillCurso,
  neutro: styles.apliPillNeutro,
  espera: styles.apliPillEspera,
  problema: styles.apliPillProblema,
  cerrada: styles.apliPillCerrada,
} as const;

export default async function MisAplicacionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: applications } = await supabase
    .from("applications")
    .select(
      "id, campaign_id, status, created_at, status_changed_at, accepted_at, delivered_at, approved_at, rating, conflict_reason, admin_note"
    )
    .eq("creator_id", user!.id)
    .order("created_at", { ascending: false });

  const campaignIds = [...new Set((applications ?? []).map((a) => a.campaign_id))];
  const { data: campaigns } = campaignIds.length
    ? await supabase
        .from("campaigns")
        .select("id, title, brand_id, budget_amount, deadline_days, brief, deliverables")
        .in("id", campaignIds)
    : { data: [] };

  const brandIds = [...new Set((campaigns ?? []).map((c) => c.brand_id))];
  const { data: brandProfiles } = brandIds.length
    ? await supabase
        .from("brand_profiles")
        .select("profile_id, brand_name, logo_url")
        .in("profile_id", brandIds)
    : { data: [] };

  // Los puntos de cada colaboración salen del ledger, no de una constante: una
  // aprobada con 5★ deja aplicar (5) + te eligieron (50) + entregada (150) +
  // rating (50). Sumar `delivery_approved` solo dejaría el número corto.
  const applicationIds = (applications ?? []).map((a) => a.id);
  const { data: pointsEvents } = applicationIds.length
    ? await supabase
        .from("points_events")
        .select("points, reference_id")
        .eq("creator_id", user!.id)
        .eq("reference_type", "application")
        .in("reference_id", applicationIds)
    : { data: [] };

  // Lo que el creador ya subió y todavía no envió. Solo importa en las
  // aceptadas: desde 'delivered' la entrega está cerrada y la hoja no se abre.
  const aceptadasIds = (applications ?? []).filter((a) => a.status === "accepted").map((a) => a.id);
  const { data: yaSubidos } = aceptadasIds.length
    ? await supabase
        .from("application_deliveries")
        .select("application_id, slot, note")
        .in("application_id", aceptadasIds)
        .eq("kind", "file")
        .not("slot", "is", null)
    : { data: [] };

  const campaignById = new Map((campaigns ?? []).map((c) => [c.id, c]));
  const brandById = new Map((brandProfiles ?? []).map((b) => [b.profile_id, b]));

  const guardadosPorAplicacion = new Map<string, { slot: string; nombre: string | null; peso: null }[]>();
  for (const d of yaSubidos ?? []) {
    if (!d.slot) continue;
    const lista = guardadosPorAplicacion.get(d.application_id) ?? [];
    // El peso no se guarda en la base: lo sabe el navegador en el momento de
    // subir y no vale una columna. Al reabrir la hoja se muestra sin él.
    lista.push({ slot: d.slot, nombre: d.note, peso: null });
    guardadosPorAplicacion.set(d.application_id, lista);
  }

  const puntosPorAplicacion = new Map<string, number>();
  for (const ev of pointsEvents ?? []) {
    if (!ev.reference_id) continue;
    puntosPorAplicacion.set(ev.reference_id, (puntosPorAplicacion.get(ev.reference_id) ?? 0) + ev.points);
  }

  const items = (applications ?? []).map((app) => {
    const campaign = campaignById.get(app.campaign_id);
    const brand = campaign ? brandById.get(campaign.brand_id) : null;
    return {
      ...app,
      titulo: campaign?.title ?? "Campaña",
      marca: brand?.brand_name ?? null,
      logo: brand?.logo_url ?? null,
      monto: campaign?.budget_amount ?? null,
      deadlineDays: campaign?.deadline_days ?? null,
      brief: campaign?.brief ?? null,
      slots: slotsDeCampana(campaign?.deliverables ?? null),
      guardados: guardadosPorAplicacion.get(app.id) ?? [],
    } satisfies AplicacionEnCurso & Record<string, unknown>;
  });

  const enCurso = items
    .filter((a) => !APPLICATION_CLOSED.includes(a.status))
    .sort((a, b) => {
      const porUrgencia = URGENCIA[a.status] - URGENCIA[b.status];
      if (porUrgencia !== 0) return porUrgencia;
      const limA = fechaLimite(a.accepted_at, a.deadlineDays)?.getTime();
      const limB = fechaLimite(b.accepted_at, b.deadlineDays)?.getTime();
      if (limA && limB) return limA - limB;
      if (limA) return -1;
      if (limB) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const historial = items
    .filter((a) => APPLICATION_CLOSED.includes(a.status))
    .sort((a, b) => new Date(b.status_changed_at).getTime() - new Date(a.status_changed_at).getTime());

  return (
    <div>
      <div className={styles.feedHead}>
        <h1 className={styles.feedTitle}>Mis aplicaciones</h1>
      </div>

      {items.length === 0 && (
        <div className={`${styles.card} ${styles.empty}`}>Todavía no aplicaste a ninguna campaña.</div>
      )}

      {enCurso.length > 0 && (
        <>
          <h2 className={styles.apliSeccion}>En curso</h2>
          <div className={styles.apliLista}>
            {enCurso.map((app) => (
              <AplicacionCard key={app.id} app={app} />
            ))}
          </div>
        </>
      )}

      {historial.length > 0 && (
        <>
          <h2 className={styles.apliSeccion}>Historial</h2>
          <div className={styles.apliHist}>
            {historial.map((app) => {
              const puntos = puntosPorAplicacion.get(app.id) ?? 0;
              const premiada = app.status === "approved" && (app.rating != null || puntos > 0);
              return (
                <div key={app.id} className={styles.apliHistFila}>
                  <div className={styles.apliHistIdent}>
                    <div className={styles.apliHistTitulo}>{app.titulo}</div>
                    {premiada && (
                      <div className={styles.apliHistPremio}>
                        {app.rating != null && (
                          <span aria-label={`${app.rating} de 5 estrellas`}>
                            {"★".repeat(app.rating)}
                            {"☆".repeat(5 - app.rating)}
                          </span>
                        )}
                        {puntos > 0 && <span>· +{puntos} pts</span>}
                      </div>
                    )}
                    {app.status === "cancelled" && app.conflict_reason && (
                      <div className={styles.apliHistNota}>{app.conflict_reason}</div>
                    )}
                    {app.admin_note && (
                      <div className={styles.apliHistNota}>
                        <b>Resolución de Q Labs: </b>
                        {app.admin_note}
                      </div>
                    )}
                  </div>
                  <span className={`${styles.apliPill} ${TONO_CLASE[APLICACION_TONO[app.status]]}`}>
                    {APPLICATION_STATUS_LABEL[app.status]}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
