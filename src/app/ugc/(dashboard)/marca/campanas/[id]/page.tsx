import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PublishCampaignButton from "@/components/ugc/marca/PublishCampaignButton";
import CampaignCoverEditor from "@/components/ugc/marca/CampaignCoverEditor";
import ApplicantDecisionButtons from "@/components/ugc/marca/ApplicantDecisionButtons";
import ApproveWithRatingForm from "@/components/ugc/marca/ApproveWithRatingForm";
import { entregablesEnLinea } from "@/lib/ugc/deliverables";
import { AGENCY_FEE_RATE, creatorPayout } from "@/lib/ugc/payout";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/ugc/campaign-status";
import AvataresAplicantes from "@/components/ugc/marca/AvataresAplicantes";
import { slotsDeCampana } from "@/lib/ugc/delivery-slots";
import { DELIVERIES_BUCKET, DELIVERY_SIGNED_URL_TTL_SECONDS } from "@/lib/ugc/deliveries";
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_STYLE,
  canCancel,
  canDispute,
} from "@/lib/ugc/application-status";
import ConflictActionButton from "@/components/ugc/ConflictActionButton";
import { hasUsageRights, usageRightsChips } from "@/lib/ugc/usage-rights";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";
import { displayHandle } from "@/lib/ugc/handles";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (!campaign || campaign.brand_id !== user!.id) {
    notFound();
  }

  const [{ data: applications }, { data: brand }] = await Promise.all([
    supabase.from("applications").select("*").eq("campaign_id", id).order("created_at", { ascending: false }),
    // Para el respaldo de la portada: sin foto, la tarjeta del feed muestra el
    // logo de la marca sobre su degradado, y acá se previsualiza igual.
    supabase.from("brand_profiles").select("brand_name, logo_url").eq("profile_id", user!.id).maybeSingle(),
  ]);

  const creatorIds = applications?.map((a) => a.creator_id) ?? [];

  const [{ data: profiles }, { data: creatorProfiles }] = creatorIds.length
    ? await Promise.all([
        supabase.from("profiles").select("*").in("id", creatorIds),
        supabase.from("creator_profiles").select("*").in("profile_id", creatorIds),
      ])
    : [{ data: [] }, { data: [] }];

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const creatorProfileById = new Map((creatorProfiles ?? []).map((c) => [c.profile_id, c]));

  const applicationIds = (applications ?? []).map((a) => a.id);
  const { data: deliveries } = applicationIds.length
    ? await supabase
        .from("application_deliveries")
        .select("*")
        .in("application_id", applicationIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Las piezas van en el orden en que la marca las pidió —Reel, Story 1, Story
  // 2—, no en el que el creador terminó de subirlas. Por fecha salían al revés,
  // y encima los links del post arriba de las piezas.
  const slots = slotsDeCampana(campaign.deliverables);
  const ordenDeSlot = new Map(slots.map((s, i) => [s.id, i]));
  const etiquetaDeSlot = new Map(slots.map((s) => [s.id, s.etiqueta]));
  const posicion = (d: { slot: string | null }) =>
    d.slot ? (ordenDeSlot.get(d.slot) ?? 900) : 999;

  const deliveriesByApplicationId = new Map<string, typeof deliveries>();
  for (const delivery of deliveries ?? []) {
    const list = deliveriesByApplicationId.get(delivery.application_id) ?? [];
    list.push(delivery);
    deliveriesByApplicationId.set(delivery.application_id, list);
  }
  for (const list of deliveriesByApplicationId.values()) {
    list?.sort((a, b) => posicion(a) - posicion(b));
  }

  const fileDeliveries = (deliveries ?? []).filter((d) => d.kind === "file" && d.storage_path);
  const signedUrlByPath = new Map<string, string>();
  await Promise.all(
    fileDeliveries.map(async (d) => {
      const { data } = await supabase.storage
        .from(DELIVERIES_BUCKET)
        .createSignedUrl(d.storage_path!, DELIVERY_SIGNED_URL_TTL_SECONDS);
      if (data?.signedUrl) signedUrlByPath.set(d.storage_path!, data.signedUrl);
    })
  );

  const porAprobar = (applications ?? []).filter((a) => a.status === "delivered");
  const porRevisar = (applications ?? []).filter(
    (a) => a.status === "pending" || a.status === "reviewing"
  );

  // La entrega que espera: la más vieja primero, que es la que lleva más tiempo
  // parada del lado de la marca.
  const entregaPendiente = porAprobar[porAprobar.length - 1];
  const perfilPendiente = entregaPendiente
    ? creatorProfileById.get(entregaPendiente.creator_id)
    : null;
  const piezasPendientes = entregaPendiente
    ? (deliveriesByApplicationId.get(entregaPendiente.id) ?? [])
    : [];
  const primeraPieza = piezasPendientes[0];
  const linkPrimeraPieza = primeraPieza
    ? (primeraPieza.external_url ??
      (primeraPieza.storage_path ? signedUrlByPath.get(primeraPieza.storage_path) : null))
    : null;

  const comision = campaign.budget_amount
    ? Math.round(campaign.budget_amount * AGENCY_FEE_RATE)
    : 0;
  const neto = campaign.budget_amount ? creatorPayout(campaign.budget_amount) : 0;
  const crc = (n: number) => `₡${n.toLocaleString("es-CR")}`;

  const derechos = usageRightsChips(campaign).join(" · ");

  const pedido: [string, string][] = [
    ["Brief", campaign.brief ?? ""],
    ["Entregables", entregablesEnLinea(campaign.deliverables)],
    ["Plazo", campaign.deadline_days ? `${campaign.deadline_days} días de plazo` : ""],
    ["Audiencia", campaign.target_audience ?? ""],
    ["Compensación", campaign.compensation_details ?? ""],
    ["Derechos de uso", hasUsageRights(campaign) ? derechos : ""],
  ].filter(([, v]) => Boolean(v)) as [string, string][];

  return (
    <div className={styles.mcCol}>
      <div className={styles.mcFormBar}>
        <Link href="/ugc/marca/ugc" className={styles.mcCancelar}>
          <QosIcon name="chevL" size={15} /> Campañas
        </Link>
        <span className={styles.mcFormTitulo}>Campaña</span>
      </div>

      <div className={styles.mcDetHead}>
        <div className={styles.mcDetTop}>
          <h1 className={styles.mcDetTitulo}>{campaign.title}</h1>
          <span
            className={`${styles.mcEstado} ${
              campaign.status === "published" ? "" : styles.mcEstadoQuieto
            }`}
          >
            {CAMPAIGN_STATUS_LABEL[campaign.status]}
          </span>
        </div>
        <div className={styles.mcDetMeta}>
          {[
            campaign.published_at &&
              `Publicada el ${new Date(campaign.published_at).toLocaleDateString("es-CR", {
                day: "numeric",
                month: "short",
              })}`,
            // "días de plazo" y NO "cierra en N días" como decía el mockup: es
            // el tiempo que tiene el creador para entregar DESPUÉS de que la
            // marca lo acepta. Una campaña publicada no tiene fecha de cierre.
            campaign.deadline_days && `${campaign.deadline_days} días de plazo`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>

      {/* ---- Lo que hay que decidir ahora ---- */}
      {entregaPendiente && (
        <div className={styles.mcDecidir}>
          <div className={styles.mcDecidirLabel}>Te toca aprobar</div>
          <div className={styles.mcAprobarFila}>
            <span className={styles.mcAprobarThumb}>
              <QosIcon name="play" size={19} />
            </span>
            <span className={styles.mcDecidirTxt}>
              <span className={styles.mcDecidirNum}>
                {displayHandle(perfilPendiente?.handle ?? "") || "Un creador"} entregó
                {piezasPendientes.length > 1 ? ` ${piezasPendientes.length} piezas` : " su pieza"}
              </span>
              <span className={styles.mcDecidirSub}>
                {entregaPendiente.delivered_at
                  ? new Date(entregaPendiente.delivered_at).toLocaleString("es-CR", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Esperando tu revisión"}
              </span>
            </span>
          </div>

          {/* Ver la pieza va primero: aprobar sin mirar no es una decisión. */}
          <div className={styles.mcAprobarAcciones}>
            {linkPrimeraPieza && (
              <a
                href={linkPrimeraPieza}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.mcAprobarSec}
              >
                Ver la pieza
              </a>
            )}
            <ApproveWithRatingForm
              applicationId={entregaPendiente.id}
              campaignId={campaign.id}
              oscuro
            />
          </div>

          <ConflictActionButton
            applicationId={entregaPendiente.id}
            kind="dispute"
            label="Reportar un problema"
            className={styles.mcAprobarReportar}
          />
        </div>
      )}

      {!entregaPendiente && porRevisar.length > 0 && (
        <div className={styles.mcDecidir}>
          <div className={styles.mcDecidirLabel}>Te toca decidir</div>
          <div className={styles.mcDecidirFila}>
            <AvataresAplicantes
              caras={porRevisar.map((a) => ({
                id: a.id,
                nombre: profileById.get(a.creator_id)?.display_name ?? "Creador",
                avatarUrl: profileById.get(a.creator_id)?.avatar_url ?? null,
              }))}
            />
            <span className={styles.mcDecidirTxt}>
              <span className={styles.mcDecidirNum}>
                {porRevisar.length} aplicante{porRevisar.length === 1 ? "" : "s"} por revisar
              </span>
              <span className={styles.mcDecidirSub}>Están abajo, con su book</span>
            </span>
          </div>
        </div>
      )}

      {campaign.status === "draft" && (
        <div style={{ marginBottom: "20px" }}>
          <PublishCampaignButton campaignId={campaign.id} />
        </div>
      )}

      {/* ---- El pago ---- */}
      {campaign.budget_amount != null && (
        <>
          <div className={styles.mcPago}>
            <div className={styles.mcPagoFila}>
              <span className={styles.mcPagoK}>Presupuesto</span>
              <span className={styles.mcPagoV}>{crc(campaign.budget_amount)}</span>
            </div>
            <div className={styles.mcPagoFila}>
              <span className={styles.mcPagoK}>
                Comisión de Q Labs ({Math.round(AGENCY_FEE_RATE * 100)}%)
              </span>
              <span className={styles.mcPagoV}>− {crc(comision)}</span>
            </div>
            <div className={`${styles.mcPagoFila} ${styles.mcPagoTotal}`}>
              <span className={styles.mcPagoK}>Recibe el creador</span>
              <span className={styles.mcPagoV}>{crc(neto)}</span>
            </div>
          </div>
          <p className={styles.mcPagoNota}>El pago lo coordina Q Labs por fuera de la app.</p>
        </>
      )}

      {/* ---- Lo que pediste ---- */}
      {pedido.length > 0 && (
        <>
          <h2 className={styles.mcSecTit}>Lo que pediste</h2>
          <div className={styles.mcPedido}>
            {pedido.map(([k, v]) => (
              <div key={k} className={styles.mcPedidoFila}>
                <span className={styles.mcPedidoK}>{k}</span>
                <span className={styles.mcPedidoV}>{v}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---- Aplicantes ---- */}
      <h2 className={styles.mcSecTit} style={{ marginTop: "24px" }}>
        Aplicantes {applications && applications.length > 0 ? `· ${applications.length}` : ""}
      </h2>

      {applications && applications.length > 0 ? (
        applications.map((app) => {
          const profile = profileById.get(app.creator_id);
          const cp = creatorProfileById.get(app.creator_id);
          const piezas = deliveriesByApplicationId.get(app.id) ?? [];

          return (
            <div key={app.id} className={styles.mcCard}>
              <div className={styles.mcCardTop}>
                <div style={{ minWidth: 0 }}>
                  <div className={styles.mcCardTitulo}>
                    {displayHandle(cp?.handle ?? "") || profile?.display_name || "Creador"}
                  </div>
                  <div className={styles.mcCardMeta}>
                    {[
                      cp?.followers_count
                        ? `${cp.followers_count.toLocaleString("es-CR")} seguidores`
                        : null,
                      profile?.city,
                      cp?.niches?.[0],
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <span
                  className={`${styles.riskPill} ${styles["risk" + APPLICATION_STATUS_STYLE[app.status]]}`}
                >
                  {APPLICATION_STATUS_LABEL[app.status]}
                </span>
              </div>

              {app.pitch_message && (
                <p className={styles.mcPitch}>“{app.pitch_message}”</p>
              )}

              {piezas.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  {piezas.map((d) => {
                    const url =
                      d.external_url ??
                      (d.storage_path ? signedUrlByPath.get(d.storage_path) : null);
                    return url ? (
                      <a
                        key={d.id}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.mcCardFila}
                      >
                        <span className={styles.mcFilaPunto} />
                        <span className={styles.mcFilaTxt}>
                          {(d.slot && etiquetaDeSlot.get(d.slot)) ?? "Pieza"}
                        </span>
                        <QosIcon name="external" size={15} className={styles.mcFilaChev} />
                      </a>
                    ) : null;
                  })}
                </div>
              )}

              {app.rating && (
                <div className={styles.mcCardMeta} style={{ marginTop: "10px" }}>
                  Calificada {"★".repeat(app.rating)}
                  <span style={{ color: "var(--line-strong)" }}>{"★".repeat(5 - app.rating)}</span>
                </div>
              )}

              {app.conflict_reason && (
                <p className={styles.mcCanjeAviso} style={{ marginTop: "12px" }}>
                  {app.status === "cancelled" ? "Motivo de la cancelación: " : "Caso abierto: "}
                  {app.conflict_reason}
                </p>
              )}

              <div className={styles.mcAplicanteAcciones}>
                {cp?.handle && (
                  <Link
                    href={`/ugc/creadores/${cp.handle.replace(/^@/, "")}`}
                    className={styles.mcCuponBtn}
                  >
                    Ver book
                  </Link>
                )}
                {(app.status === "pending" || app.status === "reviewing") && (
                  <ApplicantDecisionButtons
                    applicationId={app.id}
                    campaignId={campaign.id}
                    creatorName={
                      cp?.handle ? displayHandle(cp.handle) : (profile?.display_name ?? "el creador")
                    }
                  />
                )}
                {canCancel(app.status) && (
                  <ConflictActionButton
                    applicationId={app.id}
                    kind="cancel"
                    label="Cancelar colaboración"
                    className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                  />
                )}
                {canDispute(app.status) && app.status !== "delivered" && (
                  <ConflictActionButton
                    applicationId={app.id}
                    kind="dispute"
                    label="Reportar un problema"
                    className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                  />
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className={styles.mcVacio}>
          <QosIcon name="users" size={26} className={styles.trVacioIc} />
          <p className={styles.mcVacioTxt}>
            Todavía nadie aplicó. Cuando alguien lo haga, te avisamos.
          </p>
        </div>
      )}

      {/* La portada no está en el mockup y se conserva: es lo primero que ve un
          creador en el feed, y sin ella la tarjeta cae al logo de la marca. */}
      <h2 className={styles.mcSecTit} style={{ marginTop: "24px" }}>
        Portada
      </h2>
      <div className={styles.mcCard}>
        <CampaignCoverEditor
          campaignId={campaign.id}
          coverUrl={campaign.cover_url}
          brandName={brand?.brand_name ?? "Marca"}
          brandLogoUrl={brand?.logo_url ?? null}
        />
      </div>
    </div>
  );
}
